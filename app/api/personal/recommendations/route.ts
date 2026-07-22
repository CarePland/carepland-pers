import { NextResponse } from "next/server";

import {
  generateRecommendationCandidates,
  recommendationEvidenceHash,
  type RecommendationCandidate,
  type RecommendationEvidence,
  type RecommendationPriority,
  type RecommendationStatus,
} from "@/app/lib/personal/recommendations";
import {
  buildFocusItemDraftFromRecommendation,
  focusItemRankingDecisionFromRecommendation,
  recommendationStatusForReviewAction,
  type RecommendationReviewAction,
} from "@/app/lib/personal/recommendations/focusConversion";
import {
  buildRecommendationInputSources,
  type RecommendationAppointmentNoteRow,
  type RecommendationAppointmentRow,
  type RecommendationCarePrepRow,
  type RecommendationTopicMentionRow,
  type RecommendationTrackEventRow,
} from "@/app/lib/personal/recommendations/sources";
import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
  getActiveSupabaseUser,
} from "@/app/lib/platform/server/supabase";

type UserContext = {
  accessToken: string;
  careCircleId: string;
  isAdmin: boolean;
  personId: string;
  userId: string;
};

type CareSubjectRow = {
  care_circle_id: string;
  id: string;
};

type CareCircleMembershipRow = {
  care_circle_id: string;
};

type RecommendationRow = {
  care_circle_id: string;
  care_subject_id: string;
  confidence: number;
  created_at: string;
  dedupe_key: string;
  description: string | null;
  expires_at: string | null;
  id: string;
  metadata: Record<string, unknown> | null;
  priority: string;
  reason: string;
  recommendation_type: string;
  source_id: string | null;
  source_table: string | null;
  source_type: string;
  status: RecommendationStatus;
  structured_payload: Record<string, unknown> | null;
  title: string;
  updated_at: string;
};

type RecommendationEvidenceRow = {
  confidence: number;
  evidence_hash: string;
  evidence_text: string;
  id: string;
  occurred_at: string | null;
  recommendation_id: string;
  source_id: string | null;
  source_label: string | null;
  source_table: string | null;
  source_type: string;
};

type RecommendationDismissalType =
  | "permanent"
  | "snooze_until_new_evidence"
  | "temporary";

type RecommendationReviewAuditInput = {
  action: RecommendationReviewAction;
  dismissalType?: RecommendationDismissalType | null;
  focusItemId?: string | null;
  priorStatus: RecommendationStatus;
  recommendation: RecommendationRow & {
    converted_focus_item_id?: string | null;
    priority: RecommendationPriority;
  };
  recommendationOutcome: RecommendationOutcome;
  resultingStatus: RecommendationStatus;
  reviewNote: string;
  reviewedAt: string;
};

type RecommendationOutcome =
  | "approved"
  | "dismissed_permanent"
  | "dismissed_temporary"
  | "snoozed_time"
  | "snoozed_until_new_evidence"
  | "written_to_focus";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const personId = requestUrl.searchParams.get("personId")?.trim();
    const status = requestUrl.searchParams.get("status")?.trim() || "candidate";

    if (!personId) {
      return NextResponse.json(
        {
          error: "Choose a Care VIP before loading recommendations.",
          ok: false,
          recommendations: [],
        },
        { status: 400 }
      );
    }

    if (status !== "all" && !isRecommendationStatus(status)) {
      return NextResponse.json(
        {
          error: "Recommendation status is not supported.",
          ok: false,
          recommendations: [],
        },
        { status: 400 }
      );
    }

    const userContext = await verifyPersonAccess(personId, request);
    const supabase = recommendationSupabaseClient(userContext);
    const recommendations = await listRecommendations(supabase, personId, status);

    return NextResponse.json({
      ok: true,
      personId,
      recommendations,
    });
  } catch (error) {
    return recommendationsRouteError(error, "Unable to load recommendations.");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const personId =
      stringValue(body.personId) ||
      new URL(request.url).searchParams.get("personId")?.trim() ||
      "";

    if (!personId) {
      return NextResponse.json(
        {
          error: "Choose a Care VIP before generating recommendations.",
          ok: false,
          recommendations: [],
        },
        { status: 400 }
      );
    }

    const userContext = await verifyPersonAccess(personId, request);
    const supabase = recommendationSupabaseClient(userContext);
    const sources = await collectRecommendationSources(supabase, personId);
    const candidates = generateRecommendationCandidates(sources);
    const persistence = await persistRecommendationCandidates(
      supabase,
      userContext,
      candidates
    );
    const recommendations = await listRecommendations(supabase, personId, "candidate");

    return NextResponse.json({
      candidatesGenerated: candidates.length,
      created: persistence.created,
      evidenceAdded: persistence.evidenceAdded,
      ok: true,
      personId,
      recommendations,
      sourcesScanned: sources.length,
      suppressed: persistence.suppressed,
      updated: persistence.updated,
    });
  } catch (error) {
    return recommendationsRouteError(error, "Unable to generate recommendations.");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const personId = stringValue(body.personId);
    const recommendationId = stringValue(body.recommendationId);
    const action = reviewActionValue(body.action);
    const dismissalType = dismissalTypeValue(body.dismissalType);
    const reviewNote = stringValue(body.reviewNote);

    if (!personId || !recommendationId || !action) {
      return NextResponse.json(
        {
          error: "Recommendation review requires a person, recommendation, and action.",
          ok: false,
        },
        { status: 400 }
      );
    }

    if (action === "dismiss" && (!reviewNote || !dismissalType)) {
      return NextResponse.json(
        {
          error: "Choose a dismissal type and add a short dismissal reason.",
          ok: false,
        },
        { status: 400 }
      );
    }

    const userContext = await verifyPersonAccess(personId, request);
    const supabase = recommendationSupabaseClient(userContext);
    const recommendation = await loadRecommendationForReview(
      supabase,
      userContext,
      recommendationId
    );

    if (action === "convert_to_focus") {
      const focusItem = await convertRecommendationToFocusItem(
        supabase,
        userContext,
        recommendation,
        null,
        reviewNote
      );
      const recommendations = await listRecommendations(supabase, personId, "all");

      return NextResponse.json({
        focusItem,
        ok: true,
        personId,
        recommendationId,
        recommendations,
        status: "converted_to_focus",
      });
    }

    const status = recommendationStatusForReviewAction(action);
    const recommendationRow = await updateRecommendationStatus(
      supabase,
      userContext,
      recommendation,
      action,
      action === "dismiss" ? dismissalType : null,
      status,
      reviewNote
    );

    return NextResponse.json({
      ok: true,
      personId,
      recommendation: recommendationRow,
      recommendationId,
      status,
    });
  } catch (error) {
    return recommendationsRouteError(error, "Unable to update recommendation.");
  }
}

async function collectRecommendationSources(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  personId: string
) {
  const { data: appointmentRows, error: appointmentsError } = await supabase
    .from("appointments")
    .select("id,care_circle_id,care_subject_id,title,starts_at,provider_name")
    .eq("care_subject_id", personId)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(80);

  if (appointmentsError) {
    throw appointmentsError;
  }

  const appointments = (appointmentRows ?? []) as RecommendationAppointmentRow[];
  const appointmentIds = appointments.map((appointment) => appointment.id);
  const [
    appointmentNotesResult,
    carePrepResult,
    topicMentionsResult,
    trackEventsResult,
  ] = await Promise.all([
    appointmentIds.length > 0
      ? supabase
          .from("appointment_notes")
          .select("id,appointment_id,input_text,summary_short,takeaways,followups,created_at,source")
          .in("appointment_id", appointmentIds)
          .eq("is_current", true)
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    appointmentIds.length > 0
      ? supabase
          .from("careprep_guidance")
          .select("id,appointment_id,summary,key_questions,bring_list,watchouts,med_review,since_last_visit,next_steps,generated_at")
          .in("appointment_id", appointmentIds)
          .eq("is_current", true)
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("topic_mentions")
      .select("id,normalized_topic_slug,source_snippet,confidence,appointment_starts_at,created_at,source_table,source_id")
      .eq("care_subject_id", personId)
      .eq("is_active", true)
      .limit(200),
    supabase
      .from("track_events")
      .select("id,event_type,title,note,occurred_at,confidence,source")
      .eq("care_subject_id", personId)
      .eq("event_status", "active")
      .order("occurred_at", { ascending: false, nullsFirst: false })
      .limit(100),
  ]);

  throwIfRequiredSourceError(appointmentNotesResult.error);
  throwIfRequiredSourceError(carePrepResult.error);

  return buildRecommendationInputSources({
    appointmentNotes: (appointmentNotesResult.data ??
      []) as RecommendationAppointmentNoteRow[],
    appointments,
    carePrepGuidance: (carePrepResult.data ?? []) as RecommendationCarePrepRow[],
    topicMentions: optionalRows<RecommendationTopicMentionRow>(topicMentionsResult),
    trackEvents: optionalRows<RecommendationTrackEventRow>(trackEventsResult),
  });
}

async function persistRecommendationCandidates(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  userContext: UserContext,
  candidates: RecommendationCandidate[]
) {
  let created = 0;
  let evidenceAdded = 0;
  let suppressed = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const { data: existingRows, error: existingError } = await supabase
      .from("care_recommendations")
      .select("id,status")
      .eq("care_subject_id", userContext.personId)
      .eq("recommendation_type", candidate.recommendationType)
      .eq("dedupe_key", candidate.dedupeKey)
      .in("status", ["candidate", "approved"])
      .limit(1);

    if (existingError) {
      throw existingError;
    }

    const existing = (existingRows ?? [])[0] as { id: string } | undefined;
    const payload = recommendationPayload(candidate, userContext);
    let recommendationId = existing?.id ?? "";

    if (recommendationId) {
      const { error: updateError } = await supabase
        .from("care_recommendations")
        .update({
          confidence: payload.confidence,
          description: payload.description,
          priority: payload.priority,
          reason: payload.reason,
          source_id: payload.source_id,
          source_table: payload.source_table,
          source_type: payload.source_type,
          structured_payload: payload.structured_payload,
          title: payload.title,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recommendationId);

      if (updateError) {
        throw updateError;
      }

      updated += 1;
    } else {
      const dismissedCandidateContext = await dismissedCandidateReturnContext(
        supabase,
        userContext,
        candidate
      );

      if (dismissedCandidateContext.suppress) {
        suppressed += 1;
        continue;
      }

      if (dismissedCandidateContext.snoozeReturn) {
        payload.structured_payload = {
          ...(payload.structured_payload ?? {}),
          snoozeReturn: dismissedCandidateContext.snoozeReturn,
        };
      }

      const { data: inserted, error: insertError } = await supabase
        .from("care_recommendations")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      recommendationId = (inserted as { id: string }).id;
      created += 1;
    }

    evidenceAdded += await insertMissingEvidence(
      supabase,
      userContext,
      recommendationId,
      candidate.evidence
    );
  }

  return { created, evidenceAdded, suppressed, updated };
}

async function loadRecommendationForReview(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  userContext: UserContext,
  recommendationId: string
) {
  const { data, error } = await supabase
    .from("care_recommendations")
    .select(
      "id,care_circle_id,care_subject_id,recommendation_type,title,description,reason,dedupe_key,source_type,source_table,source_id,confidence,priority,expires_at,status,created_at,updated_at,structured_payload,metadata,converted_focus_item_id"
    )
    .eq("id", recommendationId)
    .eq("care_subject_id", userContext.personId)
    .eq("care_circle_id", userContext.careCircleId)
    .single();

  if (error) {
    throw error;
  }

  return data as RecommendationRow & {
    converted_focus_item_id?: string | null;
    priority: RecommendationPriority;
  };
}

async function updateRecommendationStatus(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  userContext: UserContext,
  recommendation: RecommendationRow & {
    converted_focus_item_id?: string | null;
    priority: RecommendationPriority;
  },
  action: RecommendationReviewAction,
  dismissalType: RecommendationDismissalType | null,
  status: RecommendationStatus,
  reviewNote: string
) {
  const reviewedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("care_recommendations")
    .update({
      metadata: reviewMetadata(recommendation.metadata, {
        action,
        dismissalType,
        priorStatus: recommendation.status,
        resultingStatus: status,
        reviewedAt,
        reviewedByUserId: userContext.userId,
        reviewNote,
      }),
      status,
      status_updated_at: reviewedAt,
      status_updated_by_user_id: userContext.userId,
      updated_at: reviewedAt,
    })
    .eq("id", recommendation.id)
    .eq("care_subject_id", userContext.personId)
    .select(
      "id,care_subject_id,title,reason,priority,status,status_updated_at,converted_focus_item_id"
    )
    .single();

  if (error) {
    throw error;
  }

  await insertRecommendationReviewEvent(supabase, userContext, {
    action,
    dismissalType,
    focusItemId: null,
    priorStatus: recommendation.status,
    recommendation,
    recommendationOutcome: recommendationOutcomeForReview(action, dismissalType),
    resultingStatus: status,
    reviewNote,
    reviewedAt,
  });

  return data;
}

async function convertRecommendationToFocusItem(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  userContext: UserContext,
  recommendation: RecommendationRow & {
    converted_focus_item_id?: string | null;
    priority: RecommendationPriority;
  },
  dismissalType: RecommendationDismissalType | null,
  reviewNote: string
) {
  if (recommendation.converted_focus_item_id) {
    return {
      id: recommendation.converted_focus_item_id,
      reusedExisting: true,
    };
  }

  if (
    recommendation.status !== "candidate" &&
    recommendation.status !== "approved"
  ) {
    throw new Error("Only candidate or approved recommendations can become Focus Items.");
  }

  const draft = buildFocusItemDraftFromRecommendation({
    careCircleId: recommendation.care_circle_id,
    careSubjectId: recommendation.care_subject_id,
    description: recommendation.description,
    id: recommendation.id,
    priority: recommendation.priority,
    reason: recommendation.reason,
    status: recommendation.status,
    structuredPayload: recommendation.structured_payload,
    title: recommendation.title,
  });
  const rankingDecision = focusItemRankingDecisionFromRecommendation({
    careCircleId: recommendation.care_circle_id,
    careSubjectId: recommendation.care_subject_id,
    description: recommendation.description,
    id: recommendation.id,
    priority: recommendation.priority,
    reason: recommendation.reason,
    status: recommendation.status,
    structuredPayload: recommendation.structured_payload,
    title: recommendation.title,
  });

  const { data: focusItem, error: focusError } = await supabase
    .from("focus_items")
    .insert({
      active_end_date: draft.activeEndDate ?? null,
      active_start_date: draft.activeStartDate ?? null,
      care_circle_id: draft.careCircleId,
      care_subject_id: draft.careSubjectId,
      completion_config: draft.completionConfig ?? {},
      completion_event_type: draft.completionEventType,
      completion_prompt_text: draft.completionPromptText,
      completion_type: draft.completionType,
      created_by_user_id: userContext.userId,
      focus_type: draft.focusType,
      importance_score: draft.importanceScore,
      metadata: {
        focusRankingDecision: rankingDecision,
        focusTitle: draft.title,
        recommendationId: recommendation.id,
        recommendationReason: recommendation.reason,
        recommendationTitle: recommendation.title,
        recommendationTrace:
          recommendation.structured_payload?.recommendationTrace ?? null,
        source: "care_recommendation",
      },
      prompt_text: draft.promptText,
      recurrence_rule: draft.recurrenceRule,
      schedule: draft.schedule ?? {},
      sort_order: draft.sortOrder,
      status: draft.status,
      title: draft.title,
    })
    .select(
      "id,title,completion_type,completion_event_type,completion_prompt_text,importance_score,status"
    )
    .single();

  if (focusError) {
    throw focusError;
  }

  const reviewedAt = new Date().toISOString();
  const { error: recommendationUpdateError } = await supabase
    .from("care_recommendations")
    .update({
      converted_focus_item_id: (focusItem as { id: string }).id,
      metadata: reviewMetadata(recommendation.metadata, {
        action: "convert_to_focus",
        dismissalType,
        focusItemId: (focusItem as { id: string }).id,
        priorStatus: recommendation.status,
        resultingStatus: "converted_to_focus",
        reviewedAt,
        reviewedByUserId: userContext.userId,
        reviewNote,
      }),
      status: "converted_to_focus",
      status_updated_at: reviewedAt,
      status_updated_by_user_id: userContext.userId,
      updated_at: reviewedAt,
    })
    .eq("id", recommendation.id)
    .eq("care_subject_id", userContext.personId);

  if (recommendationUpdateError) {
    throw recommendationUpdateError;
  }

  await insertRecommendationReviewEvent(supabase, userContext, {
    action: "convert_to_focus",
    dismissalType,
    focusItemId: (focusItem as { id: string }).id,
    priorStatus: recommendation.status,
    recommendation,
    recommendationOutcome: "written_to_focus",
    resultingStatus: "converted_to_focus",
    reviewNote,
    reviewedAt,
  });

  return focusItem;
}

async function dismissedCandidateReturnContext(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  userContext: UserContext,
  candidate: RecommendationCandidate
) {
  const { data: dismissedRows, error: dismissedError } = await supabase
    .from("care_recommendations")
    .select("id,metadata,status_updated_at,updated_at")
    .eq("care_subject_id", userContext.personId)
    .eq("recommendation_type", candidate.recommendationType)
    .eq("dedupe_key", candidate.dedupeKey)
    .eq("status", "dismissed")
    .order("status_updated_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (dismissedError) {
    throw dismissedError;
  }

  const dismissed = (dismissedRows ?? [])[0] as
    | { id: string; metadata: Record<string, unknown> | null }
    | undefined;
  const dismissalType = dismissalTypeFromMetadata(dismissed?.metadata);

  if (
    !dismissed ||
    (dismissalType !== "permanent" &&
      dismissalType !== "snooze_until_new_evidence")
  ) {
    return { suppress: false };
  }

  const { data: evidenceRows, error: evidenceError } = await supabase
    .from("care_recommendation_evidence")
    .select("evidence_hash")
    .eq("recommendation_id", dismissed.id);

  if (evidenceError) {
    throw evidenceError;
  }

  const priorEvidenceHashes = new Set(
    ((evidenceRows ?? []) as { evidence_hash: string }[])
      .map((row) => row.evidence_hash)
      .filter(Boolean)
  );
  const currentEvidenceHashes = candidate.evidence.map(recommendationEvidenceHash);

  const suppress =
    priorEvidenceHashes.size > 0 &&
    currentEvidenceHashes.every((hash) => priorEvidenceHashes.has(hash));

  if (suppress || dismissalType !== "snooze_until_new_evidence") {
    return { suppress };
  }

  const newEvidenceCount = currentEvidenceHashes.filter(
    (hash) => !priorEvidenceHashes.has(hash)
  ).length;

  return {
    snoozeReturn: {
      dismissedRecommendationId: dismissed.id,
      newEvidenceCount,
      rationale:
        newEvidenceCount > 0
          ? `This recommendation was previously snoozed until new evidence. It returned because ${newEvidenceCount} new supporting evidence item(s) were found.`
          : "This recommendation was previously snoozed and returned after the evidence set changed.",
      returnedAt: new Date().toISOString(),
    },
    suppress: false,
  };
}

async function insertRecommendationReviewEvent(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  userContext: UserContext,
  input: RecommendationReviewAuditInput
) {
  const { error } = await supabase
    .from("care_recommendation_review_events")
    .insert({
      action: input.action,
      care_circle_id: input.recommendation.care_circle_id,
      care_subject_id: input.recommendation.care_subject_id,
      dismissal_type: input.dismissalType ?? null,
      focus_item_id: input.focusItemId ?? null,
      metadata: {
        recommendationOutcome: input.recommendationOutcome,
        source: "todays_focus_review_v1",
      },
      prior_status: input.priorStatus,
      recommendation_id: input.recommendation.id,
      recommendation_outcome: input.recommendationOutcome,
      resulting_status: input.resultingStatus,
      review_note: input.reviewNote || null,
      reviewed_at: input.reviewedAt,
      reviewed_by_user_id: userContext.userId,
    });

  if (error && !isReviewEventsTableUnavailable(error)) {
    throw error;
  }
}

function reviewMetadata(
  metadata: Record<string, unknown> | null,
  input: {
    action: RecommendationReviewAction;
    dismissalType?: RecommendationDismissalType | null;
    focusItemId?: string | null;
    priorStatus: RecommendationStatus;
    resultingStatus: RecommendationStatus;
    reviewedAt: string;
    reviewedByUserId: string;
    reviewNote: string;
  }
) {
  return {
    ...(metadata ?? {}),
    latestReview: {
      action: input.action,
      dismissalType: input.dismissalType ?? null,
      focusItemId: input.focusItemId ?? null,
      priorStatus: input.priorStatus,
      recommendationOutcome: recommendationOutcomeForReview(
        input.action,
        input.dismissalType ?? null
      ),
      resultingStatus: input.resultingStatus,
      reviewNote: input.reviewNote || null,
      reviewedAt: input.reviewedAt,
      reviewedByUserId: input.reviewedByUserId,
    },
  };
}

function recommendationOutcomeForReview(
  action: RecommendationReviewAction,
  dismissalType: RecommendationDismissalType | null
): RecommendationOutcome {
  if (action === "approve") {
    return "approved";
  }

  if (action === "convert_to_focus") {
    return "written_to_focus";
  }

  if (action === "dismiss") {
    switch (dismissalType) {
      case "permanent":
        return "dismissed_permanent";
      case "snooze_until_new_evidence":
        return "snoozed_until_new_evidence";
      case "temporary":
      default:
        return "dismissed_temporary";
    }
  }

  return "dismissed_temporary";
}

function dismissalTypeFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): RecommendationDismissalType | null {
  const latestReview =
    metadata?.latestReview &&
    typeof metadata.latestReview === "object" &&
    !Array.isArray(metadata.latestReview)
      ? (metadata.latestReview as Record<string, unknown>)
      : null;

  return dismissalTypeValue(latestReview?.dismissalType);
}

function recommendationPayload(
  candidate: RecommendationCandidate,
  userContext: UserContext
) {
  return {
    care_circle_id: userContext.careCircleId,
    care_subject_id: userContext.personId,
    confidence: candidate.confidence,
    created_by_user_id: userContext.userId,
    dedupe_key: candidate.dedupeKey,
    description: candidate.description ?? null,
    priority: candidate.priority,
    reason: candidate.reason,
    recommendation_type: candidate.recommendationType,
    source_id: candidate.sourceId ?? null,
    source_table: candidate.sourceTable ?? null,
    source_type: candidate.sourceType,
    status: candidate.status,
    structured_payload: candidate.structuredPayload,
    title: candidate.title,
  };
}

async function insertMissingEvidence(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  userContext: UserContext,
  recommendationId: string,
  evidence: RecommendationEvidence[]
) {
  const rows = evidence.map((item) => ({
    care_circle_id: userContext.careCircleId,
    care_subject_id: userContext.personId,
    confidence: item.confidence ?? 0.5,
    evidence_hash: recommendationEvidenceHash(item),
    evidence_text: item.evidenceText,
    occurred_at: item.occurredAt ?? null,
    recommendation_id: recommendationId,
    source_id: item.sourceId ?? null,
    source_label: item.sourceLabel ?? null,
    source_table: item.sourceTable ?? null,
    source_type: item.sourceType,
  }));

  if (rows.length === 0) {
    return 0;
  }

  const { data: existingEvidence, error: existingError } = await supabase
    .from("care_recommendation_evidence")
    .select("evidence_hash")
    .eq("recommendation_id", recommendationId);

  if (existingError) {
    throw existingError;
  }

  const existingHashes = new Set(
    ((existingEvidence ?? []) as { evidence_hash: string }[]).map(
      (row) => row.evidence_hash
    )
  );
  const newRows = rows.filter((row) => !existingHashes.has(row.evidence_hash));

  if (newRows.length === 0) {
    return 0;
  }

  const { error: insertError } = await supabase
    .from("care_recommendation_evidence")
    .insert(newRows);

  if (insertError) {
    throw insertError;
  }

  return newRows.length;
}

async function listRecommendations(
  supabase: ReturnType<typeof createSupabaseUserClient>,
  personId: string,
  status: string
) {
  let query = supabase
    .from("care_recommendations")
    .select(
      "id,care_circle_id,care_subject_id,recommendation_type,title,description,reason,dedupe_key,source_type,source_table,source_id,confidence,priority,expires_at,status,created_at,updated_at,structured_payload"
    )
    .eq("care_subject_id", personId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const recommendations = ((data ?? []) as RecommendationRow[]).sort(
    compareRecommendationRows
  );
  const ids = recommendations.map((recommendation) => recommendation.id);

  if (ids.length === 0) {
    return [];
  }

  const { data: evidenceRows, error: evidenceError } = await supabase
    .from("care_recommendation_evidence")
    .select(
      "id,recommendation_id,source_type,source_table,source_id,source_label,evidence_text,evidence_hash,occurred_at,confidence"
    )
    .in("recommendation_id", ids)
    .order("occurred_at", { ascending: false, nullsFirst: false });

  if (evidenceError) {
    throw evidenceError;
  }

  const evidenceByRecommendationId = groupEvidence(
    (evidenceRows ?? []) as RecommendationEvidenceRow[]
  );

  return recommendations.map((recommendation) => ({
    ...recommendation,
    evidence: evidenceByRecommendationId.get(recommendation.id) ?? [],
  }));
}

async function verifyPersonAccess(
  personId: string,
  request: Request
): Promise<UserContext> {
  const accessToken = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!accessToken) {
    throw new Error("Please sign in before loading recommendations.");
  }

  const supabase = createSupabaseUserClient(accessToken);
  const user = await getActiveSupabaseUser(
    supabase,
    "Please sign in before loading recommendations."
  );
  const userId = user.id;

  const { data: adminProfile, error: adminProfileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (adminProfileError) {
    throw adminProfileError;
  }

  const isAdmin = adminProfile?.is_admin === true;

  const { data: memberships, error: membershipsError } = await supabase
    .from("care_circle_memberships")
    .select("care_circle_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (membershipsError) {
    throw membershipsError;
  }

  const careCircleIds = ((memberships ?? []) as CareCircleMembershipRow[])
    .map((membership) => membership.care_circle_id)
    .filter(Boolean);

  if (careCircleIds.length === 0 && !isAdmin) {
    throw new RecommendationAccessDeniedError();
  }

  const subjectClient = isAdmin ? createSupabaseServiceClient() : supabase;
  let peopleQuery = subjectClient
    .from("care_subjects")
    .select("id,care_circle_id")
    .eq("id", personId)
    .limit(1);

  if (!isAdmin) {
    peopleQuery = peopleQuery.in("care_circle_id", careCircleIds);
  }

  const { data: people, error: peopleError } = await peopleQuery;

  if (peopleError) {
    throw peopleError;
  }

  const person = ((people ?? []) as CareSubjectRow[])[0];

  if (!person) {
    throw new RecommendationAccessDeniedError();
  }

  return {
    accessToken,
    careCircleId: person.care_circle_id,
    isAdmin,
    personId: person.id,
    userId,
  };
}

function recommendationSupabaseClient(userContext: UserContext) {
  return userContext.isAdmin
    ? createSupabaseServiceClient()
    : createSupabaseUserClient(userContext.accessToken);
}

function groupEvidence(rows: RecommendationEvidenceRow[]) {
  const grouped = new Map<string, RecommendationEvidenceRow[]>();

  for (const row of rows) {
    const existing = grouped.get(row.recommendation_id) ?? [];
    existing.push(row);
    grouped.set(row.recommendation_id, existing);
  }

  return grouped;
}

function compareRecommendationRows(left: RecommendationRow, right: RecommendationRow) {
  const priorityDelta = priorityRank(right.priority) - priorityRank(left.priority);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return Number(right.confidence) - Number(left.confidence);
}

function priorityRank(priority: string) {
  switch (priority) {
    case "strong":
    case "critical":
      return 4;
    case "high":
      return 3;
    case "normal":
      return 2;
    case "low":
    default:
      return 1;
  }
}

function optionalRows<T>(result: { data: unknown; error: unknown }): T[] {
  if (result.error) {
    if (isOptionalSourceUnavailable(result.error)) {
      return [];
    }

    throw result.error;
  }

  return (result.data ?? []) as T[];
}

function throwIfRequiredSourceError(error: unknown) {
  if (!error) {
    return;
  }

  throw error;
}

function recommendationsRouteError(error: unknown, fallbackMessage: string) {
  if (error instanceof RecommendationAccessDeniedError) {
    return NextResponse.json(
      {
        error: "Choose a Care VIP from your CarePland collection.",
        ok: false,
      },
      { status: 403 }
    );
  }

  if (isRecommendationStorageUnavailable(error)) {
    return NextResponse.json(
      {
        error: "Recommendation storage is not available yet.",
        ok: false,
        recommendations: [],
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      error: getErrorMessage(error) || fallbackMessage,
      ok: false,
    },
    { status: 500 }
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (!error || typeof error !== "object") {
    return "";
  }

  const maybeError = error as {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  };
  const messageParts = [
    maybeError.message,
    maybeError.details,
    maybeError.hint ? `Hint: ${maybeError.hint}` : "",
    maybeError.code ? `Code: ${maybeError.code}` : "",
  ].filter(Boolean);

  return messageParts.join(" ");
}

function isRecommendationStorageUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string };

  return ["42P01", "42703", "PGRST205", "PGRST204"].includes(
    maybeError.code ?? ""
  );
}

function isReviewEventsTableUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";

  return (
    maybeError.code === "42P01" ||
    maybeError.code === "42703" ||
    maybeError.code === "PGRST205" ||
    message.includes("care_recommendation_review_events") ||
    message.includes("dismissal_type") ||
    message.includes("recommendation_outcome")
  );
}

function isOptionalSourceUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "42P01" ||
    maybeError.code === "42703" ||
    maybeError.code === "PGRST205"
  );
}

function isRecommendationStatus(value: string): value is RecommendationStatus {
  return [
    "approved",
    "candidate",
    "converted_to_focus",
    "dismissed",
    "expired",
  ].includes(value);
}

function reviewActionValue(value: unknown): RecommendationReviewAction | null {
  if (
    value === "approve" ||
    value === "convert_to_focus" ||
    value === "dismiss" ||
    value === "expire"
  ) {
    return value;
  }

  return null;
}

function dismissalTypeValue(value: unknown): RecommendationDismissalType | null {
  if (
    value === "permanent" ||
    value === "snooze_until_new_evidence" ||
    value === "temporary"
  ) {
    return value;
  }

  return null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

class RecommendationAccessDeniedError extends Error {
  constructor() {
    super("Choose a Care VIP from your CarePland collection.");
    this.name = "RecommendationAccessDeniedError";
  }
}
