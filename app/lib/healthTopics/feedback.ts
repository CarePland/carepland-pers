import { normalizeTopicSlug } from ".";

export type HealthTopicFeedbackMode = "binary" | "clarification";

export type HealthTopicFeedbackTarget =
  | "health_focus_card"
  | "health_story"
  | "report"
  | "source_snippet"
  | "timeline"
  | "topic_relationship"
  | "topic_summary";

export type HealthTopicFeedbackValue =
  | "looks_right"
  | "not_accurate"
  | "related"
  | "resolved"
  | "still_active"
  | "unclear"
  | "unrelated";

export type HealthTopicFeedbackDraft = {
  careCircleId: string;
  careSubjectId: string;
  feedbackMode: HealthTopicFeedbackMode;
  feedbackValue?: HealthTopicFeedbackValue | null;
  relatedTopicSlug?: string | null;
  reportId?: string | null;
  shouldInfluenceFutureGeneration?: boolean;
  sourceAppointmentIds?: string[];
  sourceTopicMentionIds?: string[];
  systemSnapshot?: Record<string, unknown>;
  systemSummaryText?: string | null;
  targetType: HealthTopicFeedbackTarget;
  topicSlug: string;
  topicSummaryId?: string | null;
  userComment?: string | null;
};

export type HealthTopicFeedbackInsert = {
  care_circle_id: string;
  care_subject_id: string;
  feedback_mode: HealthTopicFeedbackMode;
  feedback_value: HealthTopicFeedbackValue | null;
  interpreted_correction: Record<string, unknown>;
  related_topic_slug: string | null;
  relationship_feedback: "related" | "unrelated" | "unclear" | null;
  report_id: string | null;
  should_influence_future_generation: boolean;
  source_appointment_ids: string[];
  source_topic_mention_ids: string[];
  system_snapshot: Record<string, unknown>;
  system_summary_text: string | null;
  target_type: HealthTopicFeedbackTarget;
  topic_slug: string;
  topic_summary_id: string | null;
  user_comment: string | null;
  user_id: string;
};

export type HealthTopicUserContextInsert = {
  care_circle_id: string;
  care_subject_id: string;
  context_text: string;
  context_type:
    | "other"
    | "source_correction"
    | "status_correction"
    | "summary_preference"
    | "timeline_correction"
    | "topic_relationship"
    | "topic_scope";
  related_topic_slug: string | null;
  source_appointment_ids: string[];
  source_feedback_id?: string;
  source_topic_mention_ids: string[];
  structured_context: Record<string, unknown>;
  topic_slug: string;
  user_id: string;
};

const relationshipValues = new Set(["related", "unrelated", "unclear"]);

export function normalizeFeedbackDraft(
  draft: HealthTopicFeedbackDraft,
  userId: string
): HealthTopicFeedbackInsert {
  const topicSlug = normalizeTopicSlug(draft.topicSlug);
  const relatedTopicSlug = draft.relatedTopicSlug
    ? normalizeTopicSlug(draft.relatedTopicSlug)
    : null;
  const feedbackValue = draft.feedbackValue ?? null;
  const relationshipFeedback =
    feedbackValue && relationshipValues.has(feedbackValue)
      ? (feedbackValue as "related" | "unrelated" | "unclear")
      : null;
  const userComment = draft.userComment?.trim() || null;

  return {
    care_circle_id: draft.careCircleId,
    care_subject_id: draft.careSubjectId,
    feedback_mode: draft.feedbackMode,
    feedback_value: feedbackValue,
    interpreted_correction: buildInterpretedCorrection({
      feedbackValue,
      relatedTopicSlug,
      targetType: draft.targetType,
      topicSlug,
      userComment,
    }),
    related_topic_slug: relatedTopicSlug,
    relationship_feedback: relationshipFeedback,
    report_id: draft.reportId ?? null,
    should_influence_future_generation:
      draft.shouldInfluenceFutureGeneration ?? true,
    source_appointment_ids: uniqueIds(draft.sourceAppointmentIds ?? []),
    source_topic_mention_ids: uniqueIds(draft.sourceTopicMentionIds ?? []),
    system_snapshot: draft.systemSnapshot ?? {},
    system_summary_text: draft.systemSummaryText?.trim() || null,
    target_type: draft.targetType,
    topic_slug: topicSlug,
    topic_summary_id: draft.topicSummaryId ?? null,
    user_comment: userComment,
    user_id: userId,
  };
}

export function buildUserContextFromFeedback(
  feedback: HealthTopicFeedbackInsert,
  feedbackId?: string
): HealthTopicUserContextInsert | null {
  if (!feedback.should_influence_future_generation) {
    return null;
  }

  const contextText = contextTextFromFeedback(feedback);

  if (!contextText) {
    return null;
  }

  return {
    care_circle_id: feedback.care_circle_id,
    care_subject_id: feedback.care_subject_id,
    context_text: contextText,
    context_type: contextTypeFromFeedback(feedback),
    related_topic_slug: feedback.related_topic_slug,
    source_appointment_ids: feedback.source_appointment_ids,
    source_feedback_id: feedbackId,
    source_topic_mention_ids: feedback.source_topic_mention_ids,
    structured_context: {
      feedback_mode: feedback.feedback_mode,
      feedback_value: feedback.feedback_value,
      relationship_feedback: feedback.relationship_feedback,
      system_summary_text: feedback.system_summary_text,
      target_type: feedback.target_type,
    },
    topic_slug: feedback.topic_slug,
    user_id: feedback.user_id,
  };
}

function buildInterpretedCorrection({
  feedbackValue,
  relatedTopicSlug,
  targetType,
  topicSlug,
  userComment,
}: {
  feedbackValue: HealthTopicFeedbackValue | null;
  relatedTopicSlug: string | null;
  targetType: HealthTopicFeedbackTarget;
  topicSlug: string;
  userComment: string | null;
}) {
  return {
    feedback_value: feedbackValue,
    related_topic_slug: relatedTopicSlug,
    target_type: targetType,
    topic_slug: topicSlug,
    user_comment: userComment,
  };
}

function contextTextFromFeedback(feedback: HealthTopicFeedbackInsert) {
  if (feedback.user_comment) {
    return feedback.user_comment;
  }

  if (feedback.relationship_feedback && feedback.related_topic_slug) {
    return `${feedback.topic_slug} and ${feedback.related_topic_slug} were marked ${feedback.relationship_feedback}.`;
  }

  if (feedback.feedback_value === "looks_right") {
    return `${feedback.topic_slug} interpretation was confirmed by the user.`;
  }

  if (feedback.feedback_value === "not_accurate") {
    return `${feedback.topic_slug} interpretation was marked not accurate by the user.`;
  }

  return "";
}

function contextTypeFromFeedback(
  feedback: HealthTopicFeedbackInsert
): HealthTopicUserContextInsert["context_type"] {
  if (feedback.relationship_feedback || feedback.target_type === "topic_relationship") {
    return "topic_relationship";
  }

  if (feedback.target_type === "timeline") {
    return "timeline_correction";
  }

  if (feedback.target_type === "source_snippet") {
    return "source_correction";
  }

  if (
    feedback.feedback_value === "resolved" ||
    feedback.feedback_value === "still_active"
  ) {
    return "status_correction";
  }

  return "topic_scope";
}

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
