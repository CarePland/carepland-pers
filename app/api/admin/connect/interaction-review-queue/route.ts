import { NextResponse } from "next/server";

import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "@/app/lib/platform/server/supabase";
import {
  deriveInteractionReviewQueue,
  readLocalInteractionAttempts,
  type InteractionAttemptEventRecord,
  type InteractionAttemptRecord,
  type InteractionAttemptObservationRecord,
  type PlatformReviewAnalysisRecord,
  type PlatformReviewRecord,
} from "@/app/lib/platform/ai/interactionAttempts";
import type { AiPlatformRecord, Observation } from "@/app/lib/platform/ai/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const attemptId = url.searchParams.get("attemptId")?.trim() || "";
    if (attemptId) {
      const supabaseDetail = await readSupabaseInteractionAttemptDetail(attemptId);
      if (supabaseDetail) {
        return NextResponse.json({ detail: supabaseDetail, ok: true, source: "supabase" });
      }
      const localDetail = await readLocalInteractionAttemptDetail(attemptId);
      return NextResponse.json({ detail: localDetail, ok: true, source: "local" });
    }

    const supabaseQueue = await readSupabaseInteractionReviewQueue();
    if (supabaseQueue) {
      return NextResponse.json({ items: supabaseQueue, ok: true, source: "supabase" });
    }

    const store = await readLocalInteractionAttempts();
    return NextResponse.json({
      items: deriveInteractionReviewQueue(store),
      ok: true,
      source: "local",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load Interaction Review Queue.";
    return NextResponse.json({ error: message, ok: false }, { status: 403 });
  }
}

async function readLocalInteractionAttemptDetail(attemptId: string) {
  const store = await readLocalInteractionAttempts();
  const attempt = store.attempts.find((item) => item.id === attemptId) ?? null;
  const detailStore = {
    attempts: attempt ? [attempt] : [],
    events: store.events.filter((event) => event.attemptId === attemptId),
    observations: store.observations.filter(
      (observation) => observation.attemptId === attemptId
    ),
    reviewAnalyses: store.reviewAnalyses.filter(
      (analysis) => analysis.attemptId === attemptId
    ),
    reviews: store.reviews.filter((review) => review.attemptId === attemptId),
  };
  return {
    ...detailStore,
    queueItem: deriveInteractionReviewQueue(detailStore)[0] ?? null,
  };
}

async function requireAdmin(request: Request) {
  const accessToken = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!accessToken) {
    throw new Error("Admin sign-in is required to load Interaction Review Queue.");
  }

  const userClient = createSupabaseUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError) throw userError;

  const userId = userData.user?.id ?? "";
  if (!userId) {
    throw new Error("Admin sign-in is required to load Interaction Review Queue.");
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;
  if ((profile as { is_admin?: boolean } | null)?.is_admin !== true) {
    throw new Error("Admin access is required to load Interaction Review Queue.");
  }
}

async function readSupabaseInteractionReviewQueue() {
  try {
    const supabase = createSupabaseServiceClient();
    const { data: attempts, error: attemptsError } = await supabase
      .from("interaction_attempts")
      .select(
        "id,care_circle_id,care_subject_id,surface,active_workflow,status,outcome,latest_observation_id,revision_count,receiver_device_id,device_id,created_by_user_id,metadata,created_at,updated_at,completed_at"
      )
      .order("created_at", { ascending: false })
      .limit(250);
    if (attemptsError) throw attemptsError;

    const attemptIds = (attempts ?? []).map((attempt) => stringValue(attempt.id));
    if (attemptIds.length === 0) return [];

    const [
      { data: observations, error: observationsError },
      { data: events, error: eventsError },
      { data: reviews, error: reviewsError },
      { data: analyses, error: analysesError },
    ] = await Promise.all([
      supabase
        .from("interaction_attempt_observations")
        .select(
          "id,attempt_id,observation_id,revision_index,parent_observation_id,revision_reason,observation_snapshot,observed_at,created_at"
        )
        .in("attempt_id", attemptIds),
      supabase
        .from("interaction_attempt_events")
        .select("id,attempt_id,event_type,observation_id,actor_role,payload,created_at")
        .in("attempt_id", attemptIds),
      supabase
        .from("interaction_attempt_platform_reviews")
        .select("id,attempt_id,reviewer_user_id,comment,metadata,created_at")
        .in("attempt_id", attemptIds),
      supabase
        .from("interaction_attempt_platform_review_analyses")
        .select(
          "id,review_id,attempt_id,analysis_text,identified_concerns,affected_platform_layers,suggested_refinement_areas,model,model_version,metadata,created_at"
        )
        .in("attempt_id", attemptIds),
    ]);
    if (observationsError || eventsError || reviewsError || analysesError) {
      throw observationsError ?? eventsError ?? reviewsError ?? analysesError;
    }

    const careSubjectIds = [
      ...new Set((attempts ?? []).map((attempt) => stringValue(attempt.care_subject_id)).filter(Boolean)),
    ];
    const careSubjectNamesById = await readCareSubjectNamesById(
      supabase,
      careSubjectIds
    );

    return deriveInteractionReviewQueue(
      {
        attempts: (attempts ?? []).map(attemptFromRow),
        events: (events ?? []).map(eventFromRow),
        observations: (observations ?? []).map(observationFromRow),
        reviewAnalyses: (analyses ?? []).map(analysisFromRow),
        reviews: (reviews ?? []).map(reviewFromRow),
      },
      { careSubjectNamesById }
    );
  } catch {
    return null;
  }
}

async function readSupabaseInteractionAttemptDetail(attemptId: string) {
  try {
    const supabase = createSupabaseServiceClient();
    const { data: attempt, error: attemptError } = await supabase
      .from("interaction_attempts")
      .select(
        "id,care_circle_id,care_subject_id,surface,active_workflow,status,outcome,latest_observation_id,revision_count,receiver_device_id,device_id,created_by_user_id,metadata,created_at,updated_at,completed_at"
      )
      .eq("id", attemptId)
      .single();
    if (attemptError || !attempt) throw attemptError ?? new Error("Attempt not found.");

    const [
      { data: observations, error: observationsError },
      { data: events, error: eventsError },
      { data: reviews, error: reviewsError },
      { data: analyses, error: analysesError },
    ] = await Promise.all([
      supabase
        .from("interaction_attempt_observations")
        .select(
          "id,attempt_id,observation_id,revision_index,parent_observation_id,revision_reason,observation_snapshot,observed_at,created_at"
        )
        .eq("attempt_id", attemptId)
        .order("revision_index", { ascending: true }),
      supabase
        .from("interaction_attempt_events")
        .select("id,attempt_id,event_type,observation_id,actor_role,payload,created_at")
        .eq("attempt_id", attemptId)
        .order("created_at", { ascending: true }),
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
    if (observationsError || eventsError || reviewsError || analysesError) {
      throw observationsError ?? eventsError ?? reviewsError ?? analysesError;
    }

    const careSubjectId = stringValue(attempt.care_subject_id);
    const careSubjectNamesById = await readCareSubjectNamesById(
      supabase,
      careSubjectId ? [careSubjectId] : []
    );
    const detailStore = {
      attempts: [attemptFromRow(attempt)],
      events: (events ?? []).map(eventFromRow),
      observations: (observations ?? []).map(observationFromRow),
      reviewAnalyses: (analyses ?? []).map(analysisFromRow),
      reviews: (reviews ?? []).map(reviewFromRow),
    };

    return {
      ...detailStore,
      queueItem:
        deriveInteractionReviewQueue(detailStore, { careSubjectNamesById })[0] ??
        null,
    };
  } catch {
    return null;
  }
}

async function readCareSubjectNamesById(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  careSubjectIds: string[]
) {
  if (careSubjectIds.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from("care_subjects")
      .select("id,display_name")
      .in("id", careSubjectIds);
    if (error) throw error;
    return Object.fromEntries(
      (data ?? []).map((row) => [
        stringValue(row.id),
        stringValue(row.display_name) || stringValue(row.id),
      ])
    );
  } catch {
    return {};
  }
}

function attemptFromRow(row: Record<string, unknown>): InteractionAttemptRecord {
  return {
    activeWorkflow: stringValue(row.active_workflow),
    careCircleId: stringValue(row.care_circle_id),
    careSubjectId: stringValue(row.care_subject_id),
    completedAt: stringValue(row.completed_at),
    createdAt: stringValue(row.created_at),
    createdByUserId: stringValue(row.created_by_user_id),
    deviceId: stringValue(row.device_id),
    id: stringValue(row.id),
    latestObservationId: stringValue(row.latest_observation_id),
    metadata: platformRecord(row.metadata),
    outcome: stringValue(row.outcome) as InteractionAttemptRecord["outcome"],
    receiverDeviceId: stringValue(row.receiver_device_id),
    revisionCount: numberValue(row.revision_count),
    status: stringValue(row.status) as InteractionAttemptRecord["status"],
    surface: stringValue(row.surface),
    updatedAt: stringValue(row.updated_at),
  };
}

function observationFromRow(
  row: Record<string, unknown>
): InteractionAttemptObservationRecord {
  return {
    attemptId: stringValue(row.attempt_id),
    createdAt: stringValue(row.created_at),
    id: stringValue(row.id),
    observationId: stringValue(row.observation_id),
    observationSnapshot: (row.observation_snapshot ?? {}) as Observation,
    observedAt: stringValue(row.observed_at),
    parentObservationId: stringValue(row.parent_observation_id),
    revisionIndex: numberValue(row.revision_index),
    revisionReason: stringValue(row.revision_reason) as InteractionAttemptObservationRecord["revisionReason"],
  };
}

function eventFromRow(row: Record<string, unknown>): InteractionAttemptEventRecord {
  return {
    actorRole: stringValue(row.actor_role),
    attemptId: stringValue(row.attempt_id),
    createdAt: stringValue(row.created_at),
    eventType: stringValue(row.event_type) as InteractionAttemptEventRecord["eventType"],
    id: stringValue(row.id),
    observationId: stringValue(row.observation_id),
    payload: platformRecord(row.payload),
  };
}

function reviewFromRow(row: Record<string, unknown>): PlatformReviewRecord {
  return {
    attemptId: stringValue(row.attempt_id),
    comment: stringValue(row.comment),
    createdAt: stringValue(row.created_at),
    id: stringValue(row.id),
    metadata: platformRecord(row.metadata),
    reviewerUserId: stringValue(row.reviewer_user_id),
  };
}

function analysisFromRow(row: Record<string, unknown>): PlatformReviewAnalysisRecord {
  return {
    affectedPlatformLayers: stringArray(row.affected_platform_layers),
    analysisText: stringValue(row.analysis_text),
    attemptId: stringValue(row.attempt_id),
    createdAt: stringValue(row.created_at),
    id: stringValue(row.id),
    identifiedConcerns: stringArray(row.identified_concerns),
    metadata: platformRecord(row.metadata),
    model: stringValue(row.model),
    modelVersion: stringValue(row.model_version),
    reviewId: stringValue(row.review_id),
    suggestedRefinementAreas: stringArray(row.suggested_refinement_areas),
  };
}

function platformRecord(value: unknown): AiPlatformRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AiPlatformRecord;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
