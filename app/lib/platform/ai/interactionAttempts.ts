import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { careplandRuntimeTempPath } from "../server/runtimeTemp";
import type { AiPlatformRecord, Observation } from "./contracts";

export type InteractionAttemptStatus =
  | "abandoned"
  | "cancelled"
  | "completed"
  | "escalated"
  | "in_progress"
  | "timed_out";

export type InteractionAttemptOutcome =
  | ""
  | "abandoned"
  | "answered"
  | "cancelled"
  | "communicated"
  | "not_helpful"
  | "sent"
  | "timed_out"
  | "workflow_completed";

export type InteractionAttemptRevisionReason =
  | "clarification"
  | "correction"
  | "initial"
  | "modality_switch"
  | "rephrase"
  | "retry";

export type InteractionAttemptEventType =
  | "abandoned"
  | "attempt_started"
  | "cancelled"
  | "helpful_selected"
  | "message_condensation_approved"
  | "message_condensation_draft_edited"
  | "message_condensation_triggered"
  | "not_helpful_selected"
  | "observation_submitted"
  | "rephrase_selected"
  | "response_presented"
  | "revision_observation_submitted"
  | "send_selected"
  | "timed_out"
  | "workflow_completed";

export type InteractionAttemptRecord = {
  activeWorkflow: string;
  careCircleId: string;
  careSubjectId: string;
  completedAt: string;
  createdAt: string;
  createdByUserId: string;
  deviceId: string;
  id: string;
  latestObservationId: string;
  metadata: AiPlatformRecord;
  outcome: InteractionAttemptOutcome;
  receiverDeviceId: string;
  revisionCount: number;
  status: InteractionAttemptStatus;
  surface: string;
  updatedAt: string;
};

export type InteractionAttemptObservationRecord = {
  attemptId: string;
  createdAt: string;
  id: string;
  observationId: string;
  observationSnapshot: Observation;
  observedAt: string;
  parentObservationId: string;
  revisionIndex: number;
  revisionReason: InteractionAttemptRevisionReason;
};

export type InteractionAttemptEventRecord = {
  actorRole: string;
  attemptId: string;
  createdAt: string;
  eventType: InteractionAttemptEventType;
  id: string;
  observationId: string;
  payload: AiPlatformRecord;
};

export type PlatformReviewRecord = {
  attemptId: string;
  comment: string;
  createdAt: string;
  id: string;
  metadata: AiPlatformRecord;
  reviewerUserId: string;
};

export type PlatformReviewAnalysisRecord = {
  affectedPlatformLayers: string[];
  analysisText: string;
  attemptId: string;
  createdAt: string;
  id: string;
  identifiedConcerns: string[];
  metadata: AiPlatformRecord;
  model: string;
  modelVersion: string;
  reviewId: string;
  suggestedRefinementAreas: string[];
};

export type InteractionReviewQueueItem = {
  attemptId: string;
  capabilityMissing: boolean;
  careSubjectDisplayName: string;
  careSubjectId: string;
  familyChanged: boolean;
  familyEvolution: string[];
  finalUserWording: string;
  hasNotHelpful: boolean;
  hasPlatformReview: boolean;
  hasRevision: boolean;
  includeReasons: string[];
  originalUserWording: string;
  outcome: InteractionAttemptOutcome;
  reviewAnalysisCount: number;
  reviewCount: number;
  reviewState: "analyzed" | "reviewed" | "unreviewed";
  revisionCount: number;
  startedAt: string;
  status: InteractionAttemptStatus;
  surface: string;
};

type InteractionAttemptLocalStore = {
  attempts: InteractionAttemptRecord[];
  events: InteractionAttemptEventRecord[];
  observations: InteractionAttemptObservationRecord[];
  reviewAnalyses: PlatformReviewAnalysisRecord[];
  reviews: PlatformReviewRecord[];
  updatedAt: string;
  version: 1;
};

export type StartInteractionAttemptInput = {
  activeWorkflow?: string | null;
  careCircleId: string;
  careSubjectId?: string | null;
  createdByUserId?: string | null;
  deviceId?: string | null;
  id?: string;
  metadata?: AiPlatformRecord;
  receiverDeviceId?: string | null;
  surface?: string | null;
};

export type RecordInteractionAttemptObservationInput = {
  attemptId: string;
  observation: Observation;
  parentObservationId?: string | null;
  revisionIndex: number;
  revisionReason: InteractionAttemptRevisionReason;
};

export type RecordInteractionAttemptEventInput = {
  actorRole?: string | null;
  attemptId: string;
  eventType: InteractionAttemptEventType;
  observationId?: string | null;
  payload?: AiPlatformRecord;
};

export type RecordPlatformReviewInput = {
  attemptId: string;
  comment: string;
  metadata?: AiPlatformRecord;
  reviewerUserId?: string | null;
};

export type RecordPlatformReviewAnalysisInput = {
  affectedPlatformLayers?: string[];
  analysisText: string;
  attemptId: string;
  identifiedConcerns?: string[];
  metadata?: AiPlatformRecord;
  model?: string | null;
  modelVersion?: string | null;
  reviewId: string;
  suggestedRefinementAreas?: string[];
};

const defaultIndexPath = careplandRuntimeTempPath(
  "interaction-attempts",
  "attempts.json"
);

export async function readLocalInteractionAttempts(
  options: { indexPath?: string } = {}
) {
  return readLocalInteractionAttemptStore(options.indexPath ?? defaultIndexPath);
}

export function deriveInteractionReviewQueue(
  store: Pick<
    InteractionAttemptLocalStore,
    "attempts" | "events" | "observations" | "reviewAnalyses" | "reviews"
  >,
  options: {
    careSubjectNamesById?: Record<string, string>;
    limit?: number;
  } = {}
): InteractionReviewQueueItem[] {
  const namesById = options.careSubjectNamesById ?? {};
  return store.attempts
    .map((attempt) => {
      const observations = store.observations
        .filter((observation) => observation.attemptId === attempt.id)
        .sort((left, right) => left.revisionIndex - right.revisionIndex);
      const events = store.events
        .filter((event) => event.attemptId === attempt.id)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      const reviews = store.reviews.filter((review) => review.attemptId === attempt.id);
      const analyses = store.reviewAnalyses.filter(
        (analysis) => analysis.attemptId === attempt.id
      );
      const familyEvolution = familyEvolutionFromEvents(events);
      const hasRevision =
        observations.some((observation) => observation.revisionIndex > 0) ||
        Math.max(attempt.revisionCount, observations.length) > 1;
      const hasNotHelpful = events.some(
        (event) => event.eventType === "not_helpful_selected"
      );
      const terminalProblem =
        attempt.status === "abandoned" ||
        attempt.status === "timed_out" ||
        attempt.outcome === "abandoned" ||
        attempt.outcome === "timed_out" ||
        events.some(
          (event) => event.eventType === "abandoned" || event.eventType === "timed_out"
        );
      const capabilityMissing = events.some((event) =>
        eventSignalsCapabilityMissing(event)
      );
      const familyChanged =
        familyEvolution.length > 1 &&
        familyEvolution.some((family, index) => family !== familyEvolution[index - 1]);
      const hasPlatformReview = reviews.length > 0;
      const includeReasons = [
        hasNotHelpful ? "not_helpful_selected" : "",
        hasRevision ? "revised_observation" : "",
        terminalProblem ? "abandoned_or_timed_out" : "",
        capabilityMissing ? "capability_missing" : "",
        familyChanged ? "family_changed" : "",
        hasPlatformReview ? "platform_review" : "",
      ].filter(Boolean);

      if (includeReasons.length === 0) return null;

      const firstObservation = observations[0] ?? null;
      const finalObservation = observations[observations.length - 1] ?? firstObservation;
      return {
        attemptId: attempt.id,
        capabilityMissing,
        careSubjectDisplayName:
          namesById[attempt.careSubjectId] || attempt.careSubjectId || "Unknown",
        careSubjectId: attempt.careSubjectId,
        familyChanged,
        familyEvolution,
        finalUserWording: observationText(finalObservation),
        hasNotHelpful,
        hasPlatformReview,
        hasRevision,
        includeReasons,
        originalUserWording: observationText(firstObservation),
        outcome: attempt.outcome,
        reviewAnalysisCount: analyses.length,
        reviewCount: reviews.length,
        reviewState: analyses.length ? "analyzed" : reviews.length ? "reviewed" : "unreviewed",
        revisionCount: Math.max(attempt.revisionCount, observations.length),
        startedAt: attempt.createdAt,
        status: attempt.status,
        surface: attempt.surface,
      } satisfies InteractionReviewQueueItem;
    })
    .filter((item): item is InteractionReviewQueueItem => item !== null)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, options.limit ?? 100);
}

export async function startLocalInteractionAttempt(
  input: StartInteractionAttemptInput,
  options: { indexPath?: string; now?: Date } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const store = await readLocalInteractionAttemptStore(indexPath);
  const now = (options.now ?? new Date()).toISOString();
  const attempt: InteractionAttemptRecord = {
    activeWorkflow: input.activeWorkflow?.trim() || "",
    careCircleId: input.careCircleId,
    careSubjectId: input.careSubjectId?.trim() || "",
    completedAt: "",
    createdAt: now,
    createdByUserId: input.createdByUserId?.trim() || "",
    deviceId: input.deviceId?.trim() || "",
    id: input.id || createInteractionAttemptId(),
    latestObservationId: "",
    metadata: input.metadata ?? {},
    outcome: "",
    receiverDeviceId: input.receiverDeviceId?.trim() || "",
    revisionCount: 0,
    status: "in_progress",
    surface: input.surface?.trim() || "",
    updatedAt: now,
  };

  store.attempts = [attempt, ...store.attempts.filter((item) => item.id !== attempt.id)];
  store.events.push(createLocalInteractionAttemptEvent({
    actorRole: "system",
    attemptId: attempt.id,
    eventType: "attempt_started",
    payload: {
      activeWorkflow: attempt.activeWorkflow,
      surface: attempt.surface,
    },
  }, now));
  await writeLocalInteractionAttemptStore(store, indexPath);
  return attempt;
}

export async function recordLocalInteractionAttemptObservation(
  input: RecordInteractionAttemptObservationInput,
  options: { indexPath?: string; now?: Date } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const store = await readLocalInteractionAttemptStore(indexPath);
  const now = (options.now ?? new Date()).toISOString();
  const observationId = input.observation.observationId || "";

  if (!observationId) {
    throw new Error("Interaction Attempt Observation requires an observation id.");
  }

  if (
    store.observations.some(
      (row) => row.attemptId === input.attemptId && row.observationId === observationId
    )
  ) {
    return store.observations.find(
      (row) => row.attemptId === input.attemptId && row.observationId === observationId
    )!;
  }

  const record: InteractionAttemptObservationRecord = {
    attemptId: input.attemptId,
    createdAt: now,
    id: createInteractionAttemptId("attempt-observation"),
    observationId,
    observationSnapshot: structuredCloneJson(input.observation) as Observation,
    observedAt: input.observation.observedAt,
    parentObservationId: input.parentObservationId?.trim() || "",
    revisionIndex: Math.max(0, Math.trunc(input.revisionIndex)),
    revisionReason: input.revisionReason,
  };

  store.observations.push(record);
  store.events.push(createLocalInteractionAttemptEvent({
    actorRole: "system",
    attemptId: input.attemptId,
    eventType:
      record.revisionIndex === 0 ? "observation_submitted" : "revision_observation_submitted",
    observationId,
    payload: {
      parentObservationId: record.parentObservationId,
      revisionIndex: record.revisionIndex,
      revisionReason: record.revisionReason,
    },
  }, now));
  store.attempts = store.attempts.map((attempt) =>
    attempt.id === input.attemptId
      ? {
          ...attempt,
          latestObservationId: observationId,
          revisionCount: Math.max(attempt.revisionCount, record.revisionIndex + 1),
          updatedAt: now,
        }
      : attempt
  );
  await writeLocalInteractionAttemptStore(store, indexPath);
  return record;
}

export async function recordLocalInteractionAttemptEvent(
  input: RecordInteractionAttemptEventInput,
  options: { indexPath?: string; now?: Date } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const store = await readLocalInteractionAttemptStore(indexPath);
  const now = (options.now ?? new Date()).toISOString();
  const event = createLocalInteractionAttemptEvent(input, now);
  store.events.push(event);
  store.attempts = store.attempts.map((attempt) =>
    attempt.id === input.attemptId
      ? applyAttemptEventToAttempt(attempt, input.eventType, now, input.payload)
      : attempt
  );
  await writeLocalInteractionAttemptStore(store, indexPath);
  return event;
}

export async function recordLocalPlatformReview(
  input: RecordPlatformReviewInput,
  options: { indexPath?: string; now?: Date } = {}
) {
  const comment = input.comment.trim();
  if (!comment) {
    throw new Error("Platform Review comment is required.");
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const store = await readLocalInteractionAttemptStore(indexPath);
  const now = (options.now ?? new Date()).toISOString();
  const review: PlatformReviewRecord = {
    attemptId: input.attemptId,
    comment,
    createdAt: now,
    id: createInteractionAttemptId("platform-review"),
    metadata: input.metadata ?? {},
    reviewerUserId: input.reviewerUserId?.trim() || "",
  };
  store.reviews.push(review);
  await writeLocalInteractionAttemptStore(store, indexPath);
  return review;
}

export async function recordLocalPlatformReviewAnalysis(
  input: RecordPlatformReviewAnalysisInput,
  options: { indexPath?: string; now?: Date } = {}
) {
  const analysisText = input.analysisText.trim();
  if (!analysisText) {
    throw new Error("Platform Review analysis text is required.");
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const store = await readLocalInteractionAttemptStore(indexPath);
  const now = (options.now ?? new Date()).toISOString();
  const analysis: PlatformReviewAnalysisRecord = {
    affectedPlatformLayers: cleanStringList(input.affectedPlatformLayers),
    analysisText,
    attemptId: input.attemptId,
    createdAt: now,
    id: createInteractionAttemptId("platform-review-analysis"),
    identifiedConcerns: cleanStringList(input.identifiedConcerns),
    metadata: input.metadata ?? {},
    model: input.model?.trim() || "local-advisory",
    modelVersion: input.modelVersion?.trim() || "v1",
    reviewId: input.reviewId,
    suggestedRefinementAreas: cleanStringList(input.suggestedRefinementAreas),
  };
  store.reviewAnalyses.push(analysis);
  await writeLocalInteractionAttemptStore(store, indexPath);
  return analysis;
}

export async function startSupabaseInteractionAttempt(
  input: StartInteractionAttemptInput,
  supabase: SupabaseClient
) {
  try {
    const { data, error } = await supabase
      .from("interaction_attempts")
      .insert({
        active_workflow: input.activeWorkflow || "",
        care_circle_id: input.careCircleId,
        care_subject_id: input.careSubjectId || null,
        created_by_user_id: input.createdByUserId || null,
        device_id: input.deviceId || null,
        metadata: input.metadata ?? {},
        receiver_device_id: input.receiverDeviceId || null,
        surface: input.surface || "",
      })
      .select("id")
      .single();
    if (error) throw error;
    const id = String((data as { id?: string } | null)?.id || "");
    if (!id) return null;
    await recordSupabaseInteractionAttemptEvent(
      {
        actorRole: "system",
        attemptId: id,
        eventType: "attempt_started",
        payload: {
          activeWorkflow: input.activeWorkflow || "",
          surface: input.surface || "",
        },
      },
      supabase
    );
    return { id };
  } catch {
    return null;
  }
}

export async function recordSupabaseInteractionAttemptObservation(
  input: RecordInteractionAttemptObservationInput,
  supabase: SupabaseClient
) {
  try {
    const observationId = input.observation.observationId || "";
    if (!observationId) return null;
    const { data, error } = await supabase
      .from("interaction_attempt_observations")
      .insert({
        attempt_id: input.attemptId,
        observation_id: observationId,
        observation_snapshot: input.observation,
        observed_at: input.observation.observedAt,
        parent_observation_id: input.parentObservationId || null,
        revision_index: Math.max(0, Math.trunc(input.revisionIndex)),
        revision_reason: input.revisionReason,
      })
      .select("id")
      .single();
    if (error) throw error;
    await recordSupabaseInteractionAttemptEvent(
      {
        actorRole: "system",
        attemptId: input.attemptId,
        eventType:
          input.revisionIndex === 0
            ? "observation_submitted"
            : "revision_observation_submitted",
        observationId,
        payload: {
          parentObservationId: input.parentObservationId || "",
          revisionIndex: input.revisionIndex,
          revisionReason: input.revisionReason,
        },
      },
      supabase
    );
    await supabase
      .from("interaction_attempts")
      .update({
        latest_observation_id: observationId,
        revision_count: input.revisionIndex + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.attemptId);
    return data;
  } catch {
    return null;
  }
}

export async function recordSupabaseInteractionAttemptEvent(
  input: RecordInteractionAttemptEventInput,
  supabase: SupabaseClient
) {
  try {
    const { data, error } = await supabase
      .from("interaction_attempt_events")
      .insert({
        actor_role: input.actorRole || "system",
        attempt_id: input.attemptId,
        event_type: input.eventType,
        observation_id: input.observationId || null,
        payload: input.payload ?? {},
      })
      .select("id")
      .single();
    if (error) throw error;

    const terminal = attemptStatusForEvent(input.eventType);
    if (terminal) {
      await supabase
        .from("interaction_attempts")
        .update({
          completed_at: new Date().toISOString(),
          outcome: attemptOutcomeForEvent(input.eventType, input.payload),
          status: terminal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.attemptId);
    } else {
      await supabase
        .from("interaction_attempts")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", input.attemptId);
    }

    return data;
  } catch {
    return null;
  }
}

export async function recordSupabasePlatformReview(
  input: RecordPlatformReviewInput & { careCircleId: string },
  supabase: SupabaseClient
) {
  try {
    const comment = input.comment.trim();
    if (!comment) return null;
    const { data, error } = await supabase
      .from("interaction_attempt_platform_reviews")
      .insert({
        attempt_id: input.attemptId,
        care_circle_id: input.careCircleId,
        comment,
        metadata: input.metadata ?? {},
        reviewer_user_id: input.reviewerUserId || null,
      })
      .select("id,attempt_id,reviewer_user_id,comment,metadata,created_at")
      .single();
    if (error) throw error;
    return platformReviewRecordFromRow(data);
  } catch {
    return null;
  }
}

export async function recordSupabasePlatformReviewAnalysis(
  input: RecordPlatformReviewAnalysisInput & { careCircleId: string },
  supabase: SupabaseClient
) {
  try {
    const analysisText = input.analysisText.trim();
    if (!analysisText) return null;
    const { data, error } = await supabase
      .from("interaction_attempt_platform_review_analyses")
      .insert({
        affected_platform_layers: cleanStringList(input.affectedPlatformLayers),
        analysis_text: analysisText,
        attempt_id: input.attemptId,
        care_circle_id: input.careCircleId,
        identified_concerns: cleanStringList(input.identifiedConcerns),
        metadata: input.metadata ?? {},
        model: input.model || "local-advisory",
        model_version: input.modelVersion || "v1",
        review_id: input.reviewId,
        suggested_refinement_areas: cleanStringList(input.suggestedRefinementAreas),
      })
      .select(
        "id,review_id,attempt_id,analysis_text,identified_concerns,affected_platform_layers,suggested_refinement_areas,model,model_version,metadata,created_at"
      )
      .single();
    if (error) throw error;
    return platformReviewAnalysisRecordFromRow(data);
  } catch {
    return null;
  }
}

export async function listSupabasePlatformReviewsForAttempt(
  attemptId: string,
  supabase: SupabaseClient
) {
  try {
    const [{ data: reviewRows, error: reviewError }, { data: analysisRows, error: analysisError }] =
      await Promise.all([
        supabase
          .from("interaction_attempt_platform_reviews")
          .select("id,attempt_id,reviewer_user_id,comment,metadata,created_at")
          .eq("attempt_id", attemptId)
          .order("created_at", { ascending: true }),
        supabase
          .from("interaction_attempt_platform_review_analyses")
          .select(
            "id,review_id,attempt_id,analysis_text,identified_concerns,affected_platform_layers,suggested_refinement_areas,model,model_version,metadata,created_at"
          )
          .eq("attempt_id", attemptId)
          .order("created_at", { ascending: true }),
      ]);
    if (reviewError || analysisError) throw reviewError ?? analysisError;
    return {
      analyses: (analysisRows ?? []).map(platformReviewAnalysisRecordFromRow),
      reviews: (reviewRows ?? []).map(platformReviewRecordFromRow),
    };
  } catch {
    return null;
  }
}

export function createAdvisoryPlatformReviewAnalysis(
  review: Pick<PlatformReviewRecord, "attemptId" | "comment" | "id">
): Omit<PlatformReviewAnalysisRecord, "createdAt" | "id"> {
  const comment = review.comment.trim();
  const lowered = comment.toLowerCase();
  const concerns = new Set<string>();
  const layers = new Set<string>();
  const areas = new Set<string>();

  if (/\b(classif|family|ask|observe|need|communicat|remind)\b/.test(lowered)) {
    concerns.add("Potential Interaction Family mismatch");
    layers.add("Interaction Family classification");
    areas.add("Family classification examples");
  }
  if (/\btypo|misspell|transcrib|heard|speech|voice\b/.test(lowered)) {
    concerns.add("Input normalization or transcription sensitivity");
    layers.add("Observation capture");
    layers.add("MeaningFrame normalization");
    areas.add("Typo and transcript normalization");
  }
  if (/\bmissing|not available|capability|can't|cannot|unsupported\b/.test(lowered)) {
    concerns.add("Missing capability rather than incorrect interpretation");
    layers.add("Workflow capability planning");
    areas.add("Capability gap taxonomy");
  }
  if (/\bui|button|screen|wording|copy|presentation\b/.test(lowered)) {
    concerns.add("Presentation or recovery experience issue");
    layers.add("Presentation policy");
    areas.add("Receiver diagnostic UI");
  }
  if (/\brephrase|recover|not helpful|clarif/.test(lowered)) {
    concerns.add("Recovery path may need refinement");
    layers.add("Interaction Attempt recovery");
    areas.add("Clarification and recovery flows");
  }

  if (!concerns.size) {
    concerns.add("Reviewer identified a platform improvement opportunity");
    layers.add("Platform review");
    areas.add("Collect similar examples before changing behavior");
  }

  return {
    affectedPlatformLayers: [...layers],
    analysisText: [
      "Advisory review analysis.",
      "",
      `Concern identified: ${[...concerns].join("; ")}.`,
      `Likely platform area: ${[...layers].join("; ")}.`,
      "Suggested next step: collect similar attempts before changing production interpretation behavior.",
    ].join("\n"),
    attemptId: review.attemptId,
    identifiedConcerns: [...concerns],
    metadata: { advisoryOnly: true, productionBehaviorUnaffected: true },
    model: "local-advisory",
    modelVersion: "v1",
    reviewId: review.id,
    suggestedRefinementAreas: [...areas],
  };
}

function createLocalInteractionAttemptEvent(
  input: RecordInteractionAttemptEventInput,
  now: string
): InteractionAttemptEventRecord {
  return {
    actorRole: input.actorRole?.trim() || "system",
    attemptId: input.attemptId,
    createdAt: now,
    eventType: input.eventType,
    id: createInteractionAttemptId("attempt-event"),
    observationId: input.observationId?.trim() || "",
    payload: input.payload ?? {},
  };
}

function applyAttemptEventToAttempt(
  attempt: InteractionAttemptRecord,
  eventType: InteractionAttemptEventType,
  now: string,
  payload?: AiPlatformRecord
): InteractionAttemptRecord {
  const status = attemptStatusForEvent(eventType);
  return {
    ...attempt,
    completedAt: status ? now : attempt.completedAt,
    outcome: status ? attemptOutcomeForEvent(eventType, payload) : attempt.outcome,
    status: status ?? attempt.status,
    updatedAt: now,
  };
}

function attemptStatusForEvent(
  eventType: InteractionAttemptEventType
): InteractionAttemptStatus | null {
  if (eventType === "abandoned") return "abandoned";
  if (eventType === "cancelled") return "cancelled";
  if (eventType === "timed_out") return "timed_out";
  if (eventType === "workflow_completed" || eventType === "helpful_selected") return "completed";
  return null;
}

function attemptOutcomeForEvent(
  eventType: InteractionAttemptEventType,
  payload?: AiPlatformRecord
): InteractionAttemptOutcome {
  if (eventType === "abandoned") return "abandoned";
  if (eventType === "cancelled") return "cancelled";
  if (eventType === "timed_out") return "timed_out";
  if (eventType === "helpful_selected") return "answered";
  if (eventType === "workflow_completed" && payload?.outcome === "communicated") {
    return "communicated";
  }
  if (eventType === "workflow_completed") return "workflow_completed";
  return "";
}

function familyEvolutionFromEvents(events: InteractionAttemptEventRecord[]) {
  return events
    .filter((event) => event.eventType === "response_presented")
    .map((event) => stringValue(event.payload.family))
    .filter(Boolean)
    .filter((family, index, families) => family !== families[index - 1]);
}

function eventSignalsCapabilityMissing(event: InteractionAttemptEventRecord) {
  const values = [
    event.payload.capability,
    event.payload.askCapabilityStatus,
    event.payload.capabilityMissing,
    event.payload.reason,
    event.payload.result,
    event.payload.responseType,
    event.payload.route,
    event.payload.answer,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
  return (
    values.includes("capability_missing") ||
    values.includes("capability missing") ||
    values.includes("missing capability") ||
    values.includes("not available in this preview") ||
    values.includes("unsupported")
  );
}

function observationText(
  observation: InteractionAttemptObservationRecord | null | undefined
) {
  const snapshot = observation?.observationSnapshot;
  return (
    snapshot?.rawText?.trim() ||
    snapshot?.transcriptText?.trim() ||
    ""
  );
}

async function readLocalInteractionAttemptStore(indexPath: string) {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as Partial<
      InteractionAttemptLocalStore
    >;
    if (
      Array.isArray(parsed.attempts) &&
      Array.isArray(parsed.observations) &&
      Array.isArray(parsed.events)
    ) {
      return {
        attempts: parsed.attempts,
        events: parsed.events,
        observations: parsed.observations,
        reviewAnalyses: Array.isArray(parsed.reviewAnalyses)
          ? parsed.reviewAnalyses
          : [],
        reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
        updatedAt: parsed.updatedAt || "",
        version: 1,
      } satisfies InteractionAttemptLocalStore;
    }
  } catch {
    // Start empty on first write.
  }

  return {
    attempts: [],
    events: [],
    observations: [],
    reviewAnalyses: [],
    reviews: [],
    updatedAt: "",
    version: 1,
  } satisfies InteractionAttemptLocalStore;
}

async function writeLocalInteractionAttemptStore(
  store: InteractionAttemptLocalStore,
  indexPath: string
) {
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(
    indexPath,
    `${JSON.stringify({ ...store, updatedAt: new Date().toISOString() }, null, 2)}\n`
  );
}

function createInteractionAttemptId(prefix = "interaction-attempt") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function structuredCloneJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function cleanStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

function platformReviewRecordFromRow(row: unknown): PlatformReviewRecord {
  const value = row as Record<string, unknown>;
  return {
    attemptId: stringValue(value.attempt_id),
    comment: stringValue(value.comment),
    createdAt: stringValue(value.created_at),
    id: stringValue(value.id),
    metadata: platformRecord(value.metadata),
    reviewerUserId: stringValue(value.reviewer_user_id),
  };
}

function platformReviewAnalysisRecordFromRow(row: unknown): PlatformReviewAnalysisRecord {
  const value = row as Record<string, unknown>;
  return {
    affectedPlatformLayers: cleanStringList(value.affected_platform_layers),
    analysisText: stringValue(value.analysis_text),
    attemptId: stringValue(value.attempt_id),
    createdAt: stringValue(value.created_at),
    id: stringValue(value.id),
    identifiedConcerns: cleanStringList(value.identified_concerns),
    metadata: platformRecord(value.metadata),
    model: stringValue(value.model),
    modelVersion: stringValue(value.model_version),
    reviewId: stringValue(value.review_id),
    suggestedRefinementAreas: cleanStringList(value.suggested_refinement_areas),
  };
}

function platformRecord(value: unknown): AiPlatformRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AiPlatformRecord;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
