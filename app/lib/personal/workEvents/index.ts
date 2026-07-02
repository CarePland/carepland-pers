import type { SupabaseClient } from "@supabase/supabase-js";

export type CarePlandWorkType =
  | "appointment_context_organized"
  | "assignment_conflict_resolved"
  | "call_summary_prepared"
  | "careprep_prepared"
  | "duplicate_information_detected"
  | "errand_reassigned"
  | "focus_ranked"
  | "health_story_connected"
  | "message_delivery_confirmed"
  | "note_linked"
  | "recommendation_identified"
  | "reminder_coordinated"
  | "schedule_change_coordinated"
  | "supporting_evidence_found";

export type CarePlandWorkOutcomeCategory =
  | "context_connected"
  | "coordination_reduced"
  | "duplication_reduced"
  | "focus_supported"
  | "household_in_sync"
  | "information_ready"
  | "message_heard"
  | "ownership_clarified"
  | "recommendation_surfaced"
  | "review_supported"
  | "visit_prepared";

export type CarePlandWorkSourceType =
  | "appointments"
  | "careprep"
  | "connect"
  | "family"
  | "health_focus"
  | "import_anything"
  | "recommendations"
  | "reminders"
  | "system"
  | "today_focus"
  | "track";

export type CarePlandWorkRelatedSource = {
  label?: string;
  role?: string;
  source_id?: string | null;
  source_table?: string | null;
  source_type: CarePlandWorkSourceType | string;
};

export type RecordCarePlandWorkEventInput = {
  avoidedEffortMax?: number | null;
  avoidedEffortMin?: number | null;
  avoidedEffortUnit?:
    | "call_or_text"
    | "duplicate_entry"
    | "handoff"
    | "lookup"
    | "minute"
    | "schedule_check"
    | null;
  careCircleId: string;
  careSubjectId?: string | null;
  confidence?: number;
  createdByUserId?: string | null;
  effortModelVersion?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string | null;
  outcomeCategory: CarePlandWorkOutcomeCategory;
  relatedSources?: CarePlandWorkRelatedSource[];
  sourceId?: string | null;
  sourceTable?: string | null;
  sourceType: CarePlandWorkSourceType;
  structuredPayload?: Record<string, unknown>;
  summary?: string | null;
  title: string;
  workType: CarePlandWorkType;
};

export function isCarePlandWorkEventsUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message?.toLowerCase() ?? "";

  return (
    maybeError.code === "42P01" ||
    maybeError.code === "42703" ||
    maybeError.code === "PGRST205" ||
    message.includes("carepland_work_events")
  );
}

export async function recordCarePlandWorkEvent(
  supabase: SupabaseClient,
  input: RecordCarePlandWorkEventInput
) {
  const confidence = Math.max(0, Math.min(1, input.confidence ?? 1));
  const row = {
    avoided_effort_max: input.avoidedEffortMax ?? null,
    avoided_effort_min: input.avoidedEffortMin ?? null,
    avoided_effort_unit: input.avoidedEffortUnit ?? null,
    care_circle_id: input.careCircleId,
    care_subject_id: input.careSubjectId ?? null,
    confidence,
    created_by_user_id: input.createdByUserId ?? null,
    effort_model_version: input.effortModelVersion ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    metadata: input.metadata ?? {},
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    outcome_category: input.outcomeCategory,
    related_sources: input.relatedSources ?? [],
    source_id: input.sourceId ?? null,
    source_table: input.sourceTable ?? null,
    source_type: input.sourceType,
    structured_payload: input.structuredPayload ?? {},
    summary: input.summary ?? null,
    title: input.title,
    work_type: input.workType,
  };
  const { error } = await supabase.from("carepland_work_events").insert(row);

  if (error && !isCarePlandWorkEventsUnavailable(error)) {
    if (error.code === "23505" && input.idempotencyKey) {
      return { recorded: false };
    }

    throw error;
  }

  return { recorded: !error };
}

export async function recordCarePlandWorkEventBestEffort(
  supabase: SupabaseClient,
  input: RecordCarePlandWorkEventInput
) {
  try {
    return await recordCarePlandWorkEvent(supabase, input);
  } catch (error) {
    console.warn("Unable to record CarePland work event", error);
    return { recorded: false };
  }
}
