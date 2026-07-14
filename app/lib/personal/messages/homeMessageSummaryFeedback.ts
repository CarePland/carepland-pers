export type HomeMessageSummaryFeedbackDraft = {
  decisionTrace?: Record<string, unknown> | null;
  keyPoints?: Array<Record<string, unknown>>;
  personId: string;
  sourceMessageIds?: string[];
  summary: string;
  summaryModelVersion?: string;
  userComment: string;
};

export type HomeMessageSummaryFeedbackInsert = {
  care_circle_id: string;
  care_subject_id: string;
  decision_trace: Record<string, unknown>;
  feedback_value: "not_quite";
  incorporation_status: "pending";
  metadata: Record<string, unknown>;
  model: string | null;
  should_influence_future_generation: boolean;
  source_message_ids: string[];
  summary_snapshot: Record<string, unknown>;
  summary_text: string;
  target_type: "home_message_summary";
  user_comment: string;
  user_id: string;
};

export function normalizeHomeMessageSummaryFeedbackDraft(
  draft: HomeMessageSummaryFeedbackDraft,
  context: {
    careCircleId: string;
    userId: string;
  }
): HomeMessageSummaryFeedbackInsert {
  const summary = cleanText(draft.summary).slice(0, 2000);
  const userComment = cleanText(draft.userComment).slice(0, 2000);
  const personId = cleanText(draft.personId);

  if (!personId) {
    throw new Error("Choose a Care VIP before sending summary feedback.");
  }

  if (!summary) {
    throw new Error("There is no message summary to review.");
  }

  if (!userComment) {
    throw new Error("Please describe what was not quite right.");
  }

  return {
    care_circle_id: context.careCircleId,
    care_subject_id: personId,
    decision_trace: objectValue(draft.decisionTrace),
    feedback_value: "not_quite",
    incorporation_status: "pending",
    metadata: {
      feedbackSource: "home_messages_summary_not_quite",
    },
    model: cleanText(draft.summaryModelVersion) || null,
    should_influence_future_generation: true,
    source_message_ids: uniqueTextValues(draft.sourceMessageIds ?? []),
    summary_snapshot: {
      keyPoints: Array.isArray(draft.keyPoints) ? draft.keyPoints : [],
      summary,
    },
    summary_text: summary,
    target_type: "home_message_summary",
    user_comment: userComment,
    user_id: context.userId,
  };
}

function uniqueTextValues(values: string[]) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
