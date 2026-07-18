import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import {
  deriveHelpReportSummary,
  generateHelpReportReference,
  helpReportMaxPayloadBytes,
  validateAndPrepareHelpReportSubmission,
} from "@/app/lib/platform/helpReports";
import { isMissingServerEnvError } from "@/app/lib/platform/server/env";
import { careplandRuntimeTempPath } from "@/app/lib/platform/server/runtimeTemp";
import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "@/app/lib/platform/server/supabase";

export const dynamic = "force-dynamic";

const diagnosticsDir = careplandRuntimeTempPath("platform", "help-diagnostics");
const submissionWindowMs = 60 * 1000;
const maxSubmissionsPerWindow = 5;
const recentSubmissions = new Map<string, number[]>();

export async function POST(request: Request) {
  if (!allowSubmission(request)) {
    return NextResponse.json(
      { error: "Please wait a moment before sending another help report." },
      { status: 429 }
    );
  }

  const rawBody = await request.text();

  if (Buffer.byteLength(rawBody, "utf8") > helpReportMaxPayloadBytes) {
    return NextResponse.json(
      { error: "Diagnostic packet is too large." },
      { status: 413 }
    );
  }

  let body: {
    packet?: unknown;
    userInput?: {
      happenedInstead?: unknown;
      tryingToDo?: unknown;
    };
  };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Diagnostic packet must be valid JSON." },
      { status: 400 }
    );
  }

  try {
    const prepared = validateAndPrepareHelpReportSubmission({
      packet: body.packet,
      userInput: body.userInput,
    });
    const userContext = await userContextFromRequest(request);
    const referenceId = generateHelpReportReference();
    const submittedAt = new Date().toISOString();
    const storedReport = {
      admin_notes: "",
      browser_summary: browserSummary(prepared.packet.device),
      build_identifier: buildIdentifier(prepared.packet.app),
      care_circle_id: null,
      care_subject_id: null,
      current_route: prepared.route,
      derived_summary: prepared.derivedSummary,
      device_summary: deviceSummary(prepared.packet.device),
      diagnostic_packet: prepared.packet,
      feature_area: prepared.featureArea,
      likely_category: prepared.derivedSummary.likelyCategory,
      packet_schema_version: prepared.packetSchemaVersion,
      reference_id: referenceId,
      severity: severityFromSummary(prepared.derivedSummary),
      status: "new",
      submitted_at: submittedAt,
      submitted_by_user_id: userContext?.userId ?? null,
      user_happened_instead: prepared.userHappenedInstead,
      user_trying_to_do: prepared.userTryingToDo,
    };

    const storedId = await persistHelpReport(storedReport);

    return NextResponse.json({
      includedSummary:
        "CarePland saved recent activity, technical errors, device details, and a sanitized view of this screen.",
      ok: true,
      referenceId,
      reportId: storedId,
      submittedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) || "CarePland could not save this help report." },
      { status: 400 }
    );
  }
}

async function persistHelpReport(report: Record<string, unknown>) {
  try {
    const adminClient = createSupabaseServiceClient();
    const { data, error } = await adminClient
      .from("help_reports")
      .insert(report)
      .select("id")
      .single();

    if (error) throw error;

    const reportId = String((data as { id?: string } | null)?.id ?? "");
    if (reportId) {
      await adminClient.from("help_report_events").insert({
        event_type: "report_submitted",
        help_report_id: reportId,
        new_value: {
          reference_id: report.reference_id,
          status: report.status,
        },
      });
    }

    return reportId;
  } catch (error) {
    if (!isMissingServerEnvError(error)) {
      throw error;
    }

    await mkdir(diagnosticsDir, { recursive: true });
    const localId = String(report.reference_id || generateHelpReportReference());
    await writeFile(
      path.join(diagnosticsDir, `${localId}.json`),
      `${JSON.stringify({ ...report, id: localId, localFallback: true }, null, 2)}\n`
    );

    return localId;
  }
}

async function userContextFromRequest(request: Request) {
  const accessToken = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!accessToken) return null;

  const userClient = createSupabaseUserClient(accessToken);
  const { data, error } = await userClient.auth.getUser();

  if (error || !data.user?.id) return null;

  return { userId: data.user.id };
}

function buildIdentifier(app: Record<string, unknown> | undefined) {
  const buildNumber = typeof app?.buildNumber === "string" ? app.buildNumber : "";
  const buildDttm = typeof app?.buildDttm === "string" ? app.buildDttm : "";

  return [buildNumber, buildDttm].filter(Boolean).join(" · ");
}

function browserSummary(device: Record<string, unknown> | undefined) {
  const userAgent = typeof device?.userAgent === "string" ? device.userAgent : "";
  return userAgent.slice(0, 300);
}

function deviceSummary(device: Record<string, unknown> | undefined) {
  return [
    typeof device?.platform === "string" ? device.platform : "",
    typeof device?.viewport === "string" ? `viewport ${device.viewport}` : "",
    typeof device?.screen === "string" ? `screen ${device.screen}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function severityFromSummary(summary: ReturnType<typeof deriveHelpReportSummary>) {
  if (summary.errorCount > 0 || summary.failedRequestCount > 0) return "medium";
  if (summary.warningCount > 0 || summary.slowRequestCount > 0) return "low";
  return "info";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error || "");
}

function allowSubmission(request: Request) {
  const key =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const now = Date.now();
  const recent = (recentSubmissions.get(key) ?? []).filter(
    (timestamp) => now - timestamp < submissionWindowMs
  );

  if (recent.length >= maxSubmissionsPerWindow) {
    recentSubmissions.set(key, recent);
    return false;
  }

  recent.push(now);
  recentSubmissions.set(key, recent);
  return true;
}
