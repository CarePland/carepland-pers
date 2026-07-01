import {
  normalizeFocusItemDraft,
  type FocusCompletionConfig,
  type FocusCompletionType,
  type FocusItemDraft,
} from "../track";
import type { RecommendationPriority, RecommendationStatus } from ".";

export type RecommendationForFocusConversion = {
  careCircleId: string;
  careSubjectId: string;
  description?: string | null;
  id: string;
  priority: RecommendationPriority | string;
  reason: string;
  status: RecommendationStatus;
  structuredPayload?: Record<string, unknown> | null;
  title: string;
};

export type RecommendationReviewAction =
  | "approve"
  | "convert_to_focus"
  | "dismiss"
  | "expire";

export function recommendationStatusForReviewAction(
  action: RecommendationReviewAction
): RecommendationStatus {
  switch (action) {
    case "approve":
      return "approved";
    case "convert_to_focus":
      return "converted_to_focus";
    case "dismiss":
      return "dismissed";
    case "expire":
      return "expired";
  }
}

export function buildFocusItemDraftFromRecommendation(
  recommendation: RecommendationForFocusConversion
): FocusItemDraft {
  const payload = recommendation.structuredPayload ?? {};
  const completionType = completionTypeFromPayload(payload.completionType);
  const completionEventType = stringValue(payload.completionEventType);
  const completionConfig = completionConfigFromPayload(
    payload.completionConfig,
    completionEventType
  );
  const rankingDecision = focusItemRankingDecisionFromRecommendation(recommendation);

  return normalizeFocusItemDraft({
    activeStartDate: new Date().toISOString().slice(0, 10),
    careCircleId: recommendation.careCircleId,
    careSubjectId: recommendation.careSubjectId,
    completionConfig,
    completionEventType,
    completionPromptText: stringValue(payload.completionPromptText),
    completionType,
    focusType: "daily_focus",
    importanceScore: rankingDecision.importanceScore,
    promptText: recommendation.description || recommendation.reason,
    recurrenceRule: "daily",
    schedule: {},
    sortOrder: 100,
    status: "active",
    title: recommendation.title,
  });
}

export function importanceScoreFromPriority(priority: RecommendationPriority | string) {
  return focusItemRankingDecisionFromPriority(priority).importanceScore;
}

export function focusItemRankingDecisionFromRecommendation(
  recommendation: RecommendationForFocusConversion
) {
  const priorityDecision = focusItemRankingDecisionFromPriority(recommendation.priority);

  return {
    ...priorityDecision,
    recommendationId: recommendation.id,
    recommendationStatus: recommendation.status,
    source: "care_recommendation_v1",
  };
}

export function focusItemRankingDecisionFromPriority(
  priority: RecommendationPriority | string
) {
  switch (priority) {
    case "critical":
      return {
        importanceScore: 95,
        priority,
        rationale:
          "Converted Focus Item importance is 95 because the recommendation priority is critical.",
      };
    case "high":
      return {
        importanceScore: 85,
        priority,
        rationale:
          "Converted Focus Item importance is 85 because the recommendation priority is high.",
      };
    case "low":
      return {
        importanceScore: 35,
        priority,
        rationale:
          "Converted Focus Item importance is 35 because the recommendation priority is low.",
      };
    case "normal":
    default:
      return {
        importanceScore: 60,
        priority: "normal",
        rationale:
          "Converted Focus Item importance is 60 because the recommendation priority is normal or unknown.",
      };
  }
}

function completionTypeFromPayload(value: unknown): FocusCompletionType {
  switch (value) {
    case "custom":
    case "measured_value":
    case "medication":
    case "note_required":
    case "simple_done":
    case "symptom_check":
    case "yes_no":
      return value;
    default:
      return "simple_done";
  }
}

function completionConfigFromPayload(
  value: unknown,
  completionEventType: string
): FocusCompletionConfig {
  const payloadConfig =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const defaults = measuredDefaultsForEventType(completionEventType);

  return {
    ...defaults,
    ...payloadConfig,
    unit: stringValue(payloadConfig.unit) || defaults.unit || null,
    unitOptions: stringArrayValue(payloadConfig.unitOptions) || defaults.unitOptions,
    valuePromptText:
      stringValue(payloadConfig.valuePromptText) || defaults.valuePromptText || null,
  };
}

function measuredDefaultsForEventType(eventType: string): FocusCompletionConfig {
  switch (eventType) {
    case "measurement.weight":
      return {
        unit: "lb",
        unitOptions: ["lb", "kg"],
        valuePromptText: "What was the weight?",
      };
    case "measurement.blood_pressure":
      return {
        unit: "mmHg",
        valuePromptText: "What was the blood pressure reading?",
      };
    case "measurement.blood_sugar":
      return {
        unit: "mg/dL",
        unitOptions: ["mg/dL", "mmol/L"],
        valuePromptText: "What was the blood sugar reading?",
      };
    default:
      return {};
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArrayValue(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}
