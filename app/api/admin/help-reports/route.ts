import { NextRequest, NextResponse } from "next/server";

import {
  buildHelpReportTimeline,
  extractProblemReportSummary,
  groupedHelpReportLogs,
  helpReportResolutionCategories,
  helpReportStatuses,
  isHelpReportResolutionCategory,
  isHelpReportStatus,
} from "@/app/lib/platform/helpReports";
import { requireAdminCaller } from "@/app/lib/platform/server/adminAuth";
import { isMissingServerEnvError } from "@/app/lib/platform/server/env";
import { createSupabaseServiceClient } from "@/app/lib/platform/server/supabase";

export const dynamic = "force-dynamic";

type HelpReportRow = {
  admin_notes: string | null;
  assigned_admin_user_id: string | null;
  browser_summary: string | null;
  build_identifier: string | null;
  current_route: string | null;
  derived_summary: Record<string, unknown>;
  device_summary: string | null;
  diagnostic_packet?: Record<string, unknown> | null;
  feature_area: string | null;
  first_reviewed_at: string | null;
  id: string;
  likely_category: string | null;
  reference_id: string;
  resolution_category: string | null;
  resolved_at: string | null;
  severity: string;
  status: string;
  submitted_at: string;
  submitted_by_user_id: string | null;
  updated_at: string;
  user_happened_instead: string | null;
  user_trying_to_do: string | null;
  profiles?:
    | {
    display_name: string | null;
    email: string | null;
    family_name: string | null;
    given_name: string | null;
      }
    | Array<{
        display_name: string | null;
        email: string | null;
        family_name: string | null;
        given_name: string | null;
      }>
    | null;
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const searchParams = request.nextUrl.searchParams;
    const reportId = searchParams.get("id");
    const adminClient = createSupabaseServiceClient();

    if (reportId) {
      const { data, error } = await adminClient
        .from("help_reports")
        .select(
          "*, profiles:submitted_by_user_id(display_name,email,given_name,family_name)"
        )
        .eq("id", reportId)
        .single();

      if (error) throw error;

      const report = data as HelpReportRow;
      return NextResponse.json({
        events: await loadReportEvents(adminClient, report.id),
        report: serializeReport(report, true),
      });
    }

    let query = adminClient
      .from("help_reports")
      .select(
        "id,reference_id,submitted_at,submitted_by_user_id,current_route,feature_area,build_identifier,device_summary,browser_summary,user_trying_to_do,user_happened_instead,derived_summary,likely_category,severity,status,assigned_admin_user_id,admin_notes,first_reviewed_at,resolved_at,resolution_category,updated_at,profiles:submitted_by_user_id(display_name,email,given_name,family_name)"
      )
      .order("submitted_at", { ascending: false })
      .limit(100);

    const status = searchParams.get("status");
    const feature = searchParams.get("feature");
    const search = searchParams.get("search")?.trim();

    if (status && status !== "all" && helpReportStatuses.includes(status as never)) {
      query = query.eq("status", status);
    }

    if (feature && feature !== "all") {
      query = query.eq("feature_area", feature);
    }

    const { data, error } = await query;
    if (error) throw error;

    let reports = ((data ?? []) as unknown as HelpReportRow[]).map((row) =>
      serializeReport(row, false)
    );

    if (search) {
      const normalizedSearch = search.toLowerCase();
      reports = reports.filter((report) =>
        [
          report.referenceId,
          report.user,
          report.userTryingToDo,
          report.userHappenedInstead,
          report.currentRoute,
          report.featureArea,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch)
      );
    }

    if (searchParams.get("hasFrontendErrors") === "true") {
      reports = reports.filter((report) => report.derivedSummary.hasFrontendErrors);
    }
    if (searchParams.get("hasFailedApiCalls") === "true") {
      reports = reports.filter((report) => report.derivedSummary.hasFailedApiCalls);
    }

    return NextResponse.json({
      reports,
      statusOptions: helpReportStatuses,
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminUserId = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      adminNotes?: unknown;
      assignToMe?: unknown;
      id?: unknown;
      resolutionCategory?: unknown;
      status?: unknown;
    };
    const reportId = typeof body.id === "string" ? body.id : "";

    if (!reportId) {
      throw new Error("Help report id is required.");
    }

    const adminClient = createSupabaseServiceClient();
    const { data: current, error: currentError } = await adminClient
      .from("help_reports")
      .select("id,status,admin_notes,resolution_category,first_reviewed_at,resolved_at,assigned_admin_user_id")
      .eq("id", reportId)
      .single();

    if (currentError) throw currentError;

    const currentRow = current as {
      admin_notes: string | null;
      assigned_admin_user_id: string | null;
      first_reviewed_at: string | null;
      resolution_category: string | null;
      resolved_at: string | null;
      status: string;
    };
    const nextStatus = isHelpReportStatus(body.status) ? body.status : currentRow.status;
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      updated_at: now,
    };

    if (isHelpReportStatus(body.status)) {
      patch.status = nextStatus;
      if (!currentRow.first_reviewed_at && nextStatus !== "new") {
        patch.first_reviewed_at = now;
      }
      if (nextStatus === "resolved" || nextStatus === "dismissed") {
        patch.resolved_at = now;
      } else {
        patch.resolved_at = null;
      }
    }

    if (typeof body.adminNotes === "string") {
      patch.admin_notes = body.adminNotes.slice(0, 5000);
    }

    if (
      body.resolutionCategory === null ||
      isHelpReportResolutionCategory(body.resolutionCategory)
    ) {
      patch.resolution_category = body.resolutionCategory;
    } else if (
      body.resolutionCategory !== undefined &&
      !helpReportResolutionCategories.includes(body.resolutionCategory as never)
    ) {
      throw new Error("Unsupported resolution category.");
    }

    if (body.assignToMe === true) {
      patch.assigned_admin_user_id = adminUserId;
    }

    const { data, error } = await adminClient
      .from("help_reports")
      .update(patch)
      .eq("id", reportId)
      .select("*")
      .single();

    if (error) throw error;

    await adminClient.from("help_report_events").insert({
      actor_user_id: adminUserId,
      event_type: "admin_update",
      help_report_id: reportId,
      new_value: patch,
      old_value: {
        admin_notes: currentRow.admin_notes,
        assigned_admin_user_id: currentRow.assigned_admin_user_id,
        resolution_category: currentRow.resolution_category,
        status: currentRow.status,
      },
    });

    return NextResponse.json({ report: serializeReport(data as HelpReportRow, true) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

async function requireAdmin(request: Request) {
  const { userId } = await requireAdminCaller(request, {
    adminRequiredMessage: "Admin access is required to open Help Reports.",
    signInMessage: "Please sign in before opening Help Reports.",
  });

  return userId;
}

async function loadReportEvents(adminClient: ReturnType<typeof createSupabaseServiceClient>, reportId: string) {
  const { data, error } = await adminClient
    .from("help_report_events")
    .select("*")
    .eq("help_report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

function serializeReport(row: HelpReportRow, includePacket: boolean) {
  const packet = row.diagnostic_packet ?? {};

  return {
    adminNotes: row.admin_notes ?? "",
    assignedAdminUserId: row.assigned_admin_user_id,
    browserSummary: row.browser_summary ?? "",
    buildIdentifier: row.build_identifier ?? "",
    currentRoute: row.current_route ?? "",
    derivedSummary: row.derived_summary,
    deviceSummary: row.device_summary ?? "",
    eventsTimeline: includePacket ? buildHelpReportTimeline(packet) : [],
    featureArea: row.feature_area ?? "unknown",
    firstReviewedAt: row.first_reviewed_at,
    groupedLogs: includePacket ? groupedHelpReportLogs(packet) : [],
    id: row.id,
    likelyCategory: row.likely_category ?? "unknown",
    packet: includePacket ? packet : null,
    problemReport: extractProblemReportSummary(packet),
    referenceId: row.reference_id,
    resolutionCategory: row.resolution_category,
    resolvedAt: row.resolved_at,
    severity: row.severity,
    status: row.status,
    submittedAt: row.submitted_at,
    submittedByUserId: row.submitted_by_user_id,
    updatedAt: row.updated_at,
    user: userLabel(row),
    userHappenedInstead: row.user_happened_instead ?? "",
    userTryingToDo: row.user_trying_to_do ?? "",
  };
}

function userLabel(row: HelpReportRow) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const fullName = [profile?.given_name, profile?.family_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return profile?.display_name || fullName || profile?.email || row.submitted_by_user_id || "Unknown user";
}

function adminErrorResponse(error: unknown) {
  const status = isMissingServerEnvError(error)
    ? 500
    : error instanceof Error && /admin access|required/i.test(error.message)
      ? 403
      : 400;

  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "CarePland could not load Help Reports.",
    },
    { status }
  );
}
