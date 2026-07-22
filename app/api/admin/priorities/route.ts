import { NextRequest, NextResponse } from "next/server";

import {
  buildAdminPriorities,
  buildAdminPrioritySummary,
  checkpointBacklogPriorityCandidate,
  groupedRepeatedFailures,
  helpReportPriorityCandidate,
  adminPriorityLifecycleStatuses,
  type AdminPriorityCandidate,
  type AdminPriorityState,
  type AdminPriorityStatus,
} from "@/app/lib/admin/priorities";
import { requireAdminCaller } from "@/app/lib/platform/server/adminAuth";
import { isMissingServerEnvError } from "@/app/lib/platform/server/env";
import { createSupabaseServiceClient } from "@/app/lib/platform/server/supabase";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

type HelpReportPriorityRow = {
  derived_summary: JsonRecord | null;
  feature_area: string | null;
  id: string;
  likely_category: string | null;
  reference_id: string;
  severity: string | null;
  status: string;
  submitted_at: string;
  submitted_by_user_id: string | null;
  updated_at: string | null;
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

type CheckpointPriorityRow = {
  account_user_id: string | null;
  created_at: string;
  id: string;
};

type InteractionAttemptPriorityRow = {
  active_workflow: string | null;
  care_subject_id: string | null;
  completed_at: string | null;
  created_at: string;
  device_id: string | null;
  id: string;
  outcome: string | null;
  receiver_device_id: string | null;
  status: string | null;
  surface: string | null;
  updated_at: string | null;
};

type PriorityStateRow = {
  acknowledged_at: string | null;
  assigned_admin_user_id: string | null;
  deferred_until: string | null;
  dismissed_at: string | null;
  incident_key: string;
  last_action_at: string | null;
  last_action_by_user_id: string | null;
  note: string | null;
  resolved_at: string | null;
  status: string;
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const adminClient = createSupabaseServiceClient();
    const candidates = await collectPriorityCandidates(adminClient);
    const states = await loadPriorityStates(adminClient);
    const priorities = buildAdminPriorities({ candidates, states });

    return NextResponse.json({
      inventory: operationalSourceInventory,
      ok: true,
      priorities,
      summary: buildAdminPrioritySummary(priorities),
    });
  } catch (error) {
    return adminPriorityError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminUserId = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as JsonRecord;
    const incidentKey = stringValue(body.incidentKey);
    const sourceType = stringValue(body.sourceType);
    const status = stringValue(body.status) as AdminPriorityStatus;
    const note = stringValue(body.note).slice(0, 2000);
    const deferredUntil = stringValue(body.deferredUntil) || null;

    if (!incidentKey || !sourceType) {
      throw new Error("Priority incident key and source type are required.");
    }

    if (!adminPriorityLifecycleStatuses.includes(status)) {
      throw new Error("Unsupported priority status.");
    }

    if (status === "deferred" && !deferredUntil) {
      throw new Error("Deferred priorities need a return time.");
    }

    const adminClient = createSupabaseServiceClient();
    const { data: current } = await adminClient
      .from("admin_priority_states")
      .select("status")
      .eq("incident_key", incidentKey)
      .maybeSingle();
    const oldStatus = stringValue((current as { status?: unknown } | null)?.status) || "open";
    const now = new Date().toISOString();
    const patch = {
      acknowledged_at:
        status === "acknowledged" || status === "in_progress"
          ? now
          : status === "open"
            ? null
            : undefined,
      assigned_admin_user_id:
        status === "acknowledged" || status === "in_progress" ? adminUserId : undefined,
      deferred_until: status === "deferred" ? deferredUntil : null,
      dismissed_at: status === "dismissed" ? now : null,
      incident_key: incidentKey,
      last_action_at: now,
      last_action_by_user_id: adminUserId,
      note,
      resolved_at: status === "resolved" ? now : null,
      source_type: sourceType,
      status,
      updated_at: now,
    };

    const { error } = await adminClient
      .from("admin_priority_states")
      .upsert(removeUndefined(patch), { onConflict: "incident_key" });
    if (error) throw error;

    const { error: eventError } = await adminClient
      .from("admin_priority_events")
      .insert({
        actor_user_id: adminUserId,
        incident_key: incidentKey,
        new_status: status,
        note,
        old_status: oldStatus,
      });
    if (eventError) throw eventError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminPriorityError(error);
  }
}

async function requireAdmin(request: NextRequest) {
  const { userId } = await requireAdminCaller(request, {
    adminRequiredMessage: "Admin access is required to load Priorities.",
    signInMessage: "Admin sign-in is required to load Priorities.",
  });

  return userId;
}

async function collectPriorityCandidates(adminClient: ReturnType<typeof createSupabaseServiceClient>) {
  const candidates: AdminPriorityCandidate[] = [];

  const [helpReports, checkpointRuns, attempts] = await Promise.all([
    loadHelpReportCandidates(adminClient),
    loadCheckpointCandidates(adminClient),
    loadInteractionFailureCandidates(adminClient),
  ]);

  candidates.push(...helpReports, ...checkpointRuns, ...attempts);
  return candidates;
}

async function loadHelpReportCandidates(
  adminClient: ReturnType<typeof createSupabaseServiceClient>
): Promise<AdminPriorityCandidate[]> {
  const { data, error } = await adminClient
    .from("help_reports")
    .select(
      "id,reference_id,submitted_at,submitted_by_user_id,feature_area,derived_summary,likely_category,severity,status,updated_at,profiles:submitted_by_user_id(display_name,email,given_name,family_name)"
    )
    .in("status", ["new", "reviewing", "needs_follow_up"])
    .order("submitted_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = (data ?? []) as unknown as HelpReportPriorityRow[];
  const explicitReports = rows
    .map((row) =>
      helpReportPriorityCandidate({
        featureArea: row.feature_area,
        id: row.id,
        referenceId: row.reference_id,
        severity: row.severity,
        status: row.status,
        submittedAt: row.submitted_at,
        submittedByUserId: row.submitted_by_user_id,
        updatedAt: row.updated_at,
        userLabel: userLabel(row),
      })
    )
    .filter((candidate): candidate is AdminPriorityCandidate => Boolean(candidate));
  const sessionRows = rows
    .filter((row) => row.likely_category === "authentication/session issue")
    .map((row) => ({
      affectedLabel: userLabel(row),
      affectedPersonId: row.submitted_by_user_id ?? undefined,
      id: row.id,
      occurredAt: row.submitted_at,
      succeeded: false,
    }));

  return [
    ...explicitReports,
    ...groupedRepeatedFailures({
      destination: "/admin?tab=helpReports&category=session_authentication",
      failures: sessionRows,
      groupKey: (row) => row.affectedPersonId || "unknown-user",
      sourceType: "session_loss",
      title: "Repeated session loss reported",
    }),
  ];
}

async function loadCheckpointCandidates(
  adminClient: ReturnType<typeof createSupabaseServiceClient>
): Promise<AdminPriorityCandidate[]> {
  const { data, error } = await adminClient
    .from("checkpoint_runs")
    .select("id,account_user_id,created_at")
    .is("checkpoint_decision", null)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;

  const candidate = checkpointBacklogPriorityCandidate(
    ((data ?? []) as unknown as CheckpointPriorityRow[]).map((row) => ({
      accountUserId: row.account_user_id,
      createdAt: row.created_at,
      id: row.id,
    }))
  );

  return candidate ? [candidate] : [];
}

async function loadInteractionFailureCandidates(
  adminClient: ReturnType<typeof createSupabaseServiceClient>
): Promise<AdminPriorityCandidate[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await adminClient
    .from("interaction_attempts")
    .select(
      "id,care_subject_id,surface,active_workflow,status,outcome,receiver_device_id,device_id,created_at,updated_at,completed_at"
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw error;

  const rows = (data ?? []) as unknown as InteractionAttemptPriorityRow[];
  const talkRows = rows
    .filter((row) => {
      const text = `${row.surface ?? ""} ${row.active_workflow ?? ""}`.toLowerCase();
      return text.includes("receiver") || text.includes("talk");
    })
    .map((row) => ({
      affectedLabel: row.receiver_device_id
        ? `Receiver ${row.receiver_device_id.slice(0, 8)}`
        : row.care_subject_id
          ? `Care VIP ${row.care_subject_id.slice(0, 8)}`
          : "Receiver user",
      affectedPersonId: row.care_subject_id ?? undefined,
      id: row.id,
      occurredAt: row.updated_at || row.created_at,
      receiverId: row.receiver_device_id || row.device_id || undefined,
      succeeded: row.status === "completed" || row.outcome === "answered",
    }));
  const operationalRows = rows
    .filter((row) => ["timed_out", "abandoned", "escalated"].includes(row.status ?? ""))
    .map((row) => ({
      affectedLabel: row.care_subject_id
        ? `Care VIP ${row.care_subject_id.slice(0, 8)}`
        : "CarePland user",
      affectedPersonId: row.care_subject_id ?? undefined,
      id: row.id,
      occurredAt: row.updated_at || row.created_at,
      receiverId: row.receiver_device_id || row.device_id || undefined,
      succeeded: false,
    }));

  return [
    ...groupedRepeatedFailures({
      destination: "/admin?tab=connect&panel=interactionTraces",
      failures: talkRows,
      groupKey: (row) => row.receiverId || row.affectedPersonId || "receiver-talk",
      sourceType: "interaction_failure",
      title: "Receiver Talk failed repeatedly",
    }),
    ...groupedRepeatedFailures({
      destination: "/admin?tab=connect&panel=interactionTraces",
      failures: operationalRows,
      groupKey: (row) => row.receiverId || row.affectedPersonId || "operational",
      sourceType: "operational_failure",
      title: "Repeated operation did not complete",
    }),
  ];
}

async function loadPriorityStates(
  adminClient: ReturnType<typeof createSupabaseServiceClient>
): Promise<AdminPriorityState[]> {
  try {
    const { data, error } = await adminClient
      .from("admin_priority_states")
      .select(
        "incident_key,status,assigned_admin_user_id,acknowledged_at,deferred_until,resolved_at,dismissed_at,note,last_action_by_user_id,last_action_at"
      );
    if (error) throw error;

    return ((data ?? []) as unknown as PriorityStateRow[]).map((row) => ({
      acknowledgedAt: row.acknowledged_at,
      assignedAdminUserId: row.assigned_admin_user_id,
      deferredUntil: row.deferred_until,
      dismissedAt: row.dismissed_at,
      incidentKey: row.incident_key,
      lastActionAt: row.last_action_at,
      lastActionByUserId: row.last_action_by_user_id,
      note: row.note,
      resolvedAt: row.resolved_at,
      status: adminPriorityLifecycleStatuses.includes(row.status as AdminPriorityStatus)
        ? (row.status as AdminPriorityStatus)
        : "open",
    }));
  } catch {
    return [];
  }
}

function userLabel(row: HelpReportPriorityRow) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const fullName = [profile?.given_name, profile?.family_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    profile?.display_name ||
    fullName ||
    profile?.email ||
    row.submitted_by_user_id ||
    "Unknown user"
  );
}

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function adminPriorityError(error: unknown) {
  const status = isMissingServerEnvError(error)
    ? 500
    : error instanceof Error && /admin access|required|sign-in/i.test(error.message)
      ? 403
      : 400;

  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "CarePland could not load Priorities.",
      ok: false,
    },
    { status }
  );
}

const operationalSourceInventory = [
  {
    connected: true,
    source: "help_reports",
    summary: "Human-submitted Send Help reports with admin review states.",
  },
  {
    connected: true,
    source: "checkpoint_runs",
    summary: "Generated Checkpoint runs without reviewer decisions become one review backlog.",
  },
  {
    connected: true,
    source: "interaction_attempts",
    summary: "Receiver Talk and interaction attempts are grouped when failures repeat.",
  },
  {
    connected: true,
    source: "help_reports likely_category",
    summary: "Repeated authentication/session Help reports are grouped by affected user.",
  },
  {
    connected: false,
    source: "carepland_work_events",
    summary: "Inspected. Current rows mainly represent completed work, not unresolved failures.",
  },
  {
    connected: false,
    source: "AI operation cost logs",
    summary: "Inspected. Useful analytics, but not a quality or failure triage queue.",
  },
  {
    connected: false,
    source: "Receiver diagnostics endpoint",
    summary: "Inspected. Current endpoint controls diagnostic mode; durable unresolved diagnostic records are future work.",
  },
];
