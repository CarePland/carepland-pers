export const todayFocusRankingLimit = 3;

export type TodayFocusSourceCategory =
  | "ai_recommendation"
  | "appointment_today"
  | "appointment_tomorrow_prep"
  | "caregiver_goal"
  | "low_priority_suggestion"
  | "medication_reminder"
  | "routine_habit"
  | "user_today_goal";

export type TodayFocusRankableItem = {
  activeEndDate?: string | null;
  completionEventType?: string | null;
  completionType?: string | null;
  createdAt?: string | null;
  focusType?: string | null;
  id: string;
  importanceScore?: number;
  metadata?: Record<string, unknown> | null;
  promptText?: string | null;
  schedule?: Record<string, unknown> | null;
  sortOrder?: number;
  title: string;
};

export type TodayFocusRankingContext = {
  completedFocusItemIds?: string[];
  referenceDate?: Date;
  skippedFocusItemIds?: string[];
};

export type RankedTodayFocusItem<T extends TodayFocusRankableItem> = T & {
  todayFocusRanking: TodayFocusRankingTrace;
};

export type TodayFocusRankingTrace = {
  baseWeight: number;
  finalScore: number;
  modifiers: Array<{
    label: string;
    rationale: string;
    value: number;
  }>;
  rationale: string;
  removed: boolean;
  sourceCategory: TodayFocusSourceCategory;
  sourceCategoryRationale: string;
  version: 1;
};

const baseWeights: Record<TodayFocusSourceCategory, number> = {
  ai_recommendation: 70,
  appointment_today: 90,
  appointment_tomorrow_prep: 80,
  caregiver_goal: 95,
  low_priority_suggestion: 20,
  medication_reminder: 90,
  routine_habit: 50,
  user_today_goal: 100,
};

export function rankTodayFocusItems<T extends TodayFocusRankableItem>(
  items: T[],
  context: TodayFocusRankingContext = {}
): Array<RankedTodayFocusItem<T>> {
  return items
    .map((item) => ({
      ...item,
      todayFocusRanking: buildTodayFocusRankingTrace(item, context),
    }))
    .filter((item) => !item.todayFocusRanking.removed)
    .sort(compareRankedTodayFocusItems)
    .slice(0, todayFocusRankingLimit);
}

export function buildTodayFocusRankingTrace(
  item: TodayFocusRankableItem,
  context: TodayFocusRankingContext = {}
): TodayFocusRankingTrace {
  const referenceDay = dayString(context.referenceDate ?? new Date());
  const sourceDecision = sourceCategoryForItem(item, referenceDay);
  const baseWeight = baseWeights[sourceDecision.sourceCategory];
  const modifiers = todayFocusModifiers(item, {
    ...context,
    referenceDate: context.referenceDate ?? new Date(),
  });
  const finalScore = clampScore(
    baseWeight + modifiers.reduce((total, modifier) => total + modifier.value, 0)
  );
  const removed =
    (context.completedFocusItemIds ?? []).includes(item.id) ||
    metadataBoolean(item.metadata, "completedToday");

  return {
    baseWeight,
    finalScore,
    modifiers,
    rationale: removed
      ? "Removed because this Focus Item already has a completion recorded today."
      : `Base ${baseWeight} from ${sourceDecision.sourceCategory}; modifiers changed the score by ${finalScore - baseWeight}.`,
    removed,
    sourceCategory: sourceDecision.sourceCategory,
    sourceCategoryRationale: sourceDecision.rationale,
    version: 1,
  };
}

function todayFocusModifiers(
  item: TodayFocusRankableItem,
  context: Required<Pick<TodayFocusRankingContext, "referenceDate">> &
    TodayFocusRankingContext
) {
  const modifiers: TodayFocusRankingTrace["modifiers"] = [];
  const referenceDay = dayString(context.referenceDate);

  if (isOverdue(item, referenceDay)) {
    modifiers.push({
      label: "overdue",
      rationale: "Added 20 because the Focus Item is marked or scheduled overdue.",
      value: 20,
    });
  }

  if (
    (context.skippedFocusItemIds ?? []).includes(item.id) ||
    metadataBoolean(item.metadata, "repeatedlySkipped")
  ) {
    modifiers.push({
      label: "repeatedly_skipped",
      rationale: "Added 15 because recent Track history suggests it was repeatedly skipped.",
      value: 15,
    });
  }

  if (providerExplicitlyRecommended(item)) {
    modifiers.push({
      label: "provider_explicitly_recommended",
      rationale: "Added 25 because supporting evidence came from provider/CarePrep context.",
      value: 25,
    });
  }

  if (item.activeEndDate === referenceDay || metadataDate(item.metadata, "expiresAt") === referenceDay) {
    modifiers.push({
      label: "expires_today",
      rationale: "Added 15 because the Focus Item expires today.",
      value: 15,
    });
  }

  return modifiers;
}

function sourceCategoryForItem(
  item: TodayFocusRankableItem,
  referenceDay: string
): { rationale: string; sourceCategory: TodayFocusSourceCategory } {
  const metadata = item.metadata ?? {};
  const source = stringValue(metadata.source).toLowerCase();
  const goalSource = stringValue(metadata.goalSource).toLowerCase();
  const createdByRole = stringValue(metadata.createdByRole).toLowerCase();
  const focusType = (item.focusType ?? "").toLowerCase();
  const eventType = (item.completionEventType ?? "").toLowerCase();

  if (source.includes("user") || goalSource === "user" || createdByRole === "user") {
    return {
      rationale: "Base 100 because metadata indicates this is a user-created Today goal.",
      sourceCategory: "user_today_goal",
    };
  }

  if (
    source.includes("caregiver") ||
    goalSource === "caregiver" ||
    createdByRole === "caregiver"
  ) {
    return {
      rationale: "Base 95 because metadata indicates this is a caregiver-created goal.",
      sourceCategory: "caregiver_goal",
    };
  }

  const appointmentDay = metadataDate(metadata, "appointmentDate");
  if (focusType.includes("appointment") && appointmentDay === referenceDay) {
    return {
      rationale: "Base 90 because this is tied to an appointment today.",
      sourceCategory: "appointment_today",
    };
  }

  if (focusType.includes("appointment") && appointmentDay === addDays(referenceDay, 1)) {
    return {
      rationale: "Base 80 because this is appointment prep for tomorrow.",
      sourceCategory: "appointment_tomorrow_prep",
    };
  }

  if (item.completionType === "medication" || eventType.startsWith("medication.")) {
    return {
      rationale: "Base 90 because the completion type/event type is medication-related.",
      sourceCategory: "medication_reminder",
    };
  }

  if (
    source.includes("care_recommendation") ||
    source.includes("ai") ||
    Boolean(metadata.recommendationId)
  ) {
    return {
      rationale: "Base 70 because this came from a recommendation candidate.",
      sourceCategory: "ai_recommendation",
    };
  }

  if (
    item.importanceScore !== undefined &&
    item.importanceScore <= 25 ||
    stringValue(metadata.priority).toLowerCase() === "low"
  ) {
    return {
      rationale: "Base 20 because this is marked as a low-priority suggestion.",
      sourceCategory: "low_priority_suggestion",
    };
  }

  return {
    rationale: "Base 50 because this is treated as a routine habit.",
    sourceCategory: "routine_habit",
  };
}

function compareRankedTodayFocusItems<T extends TodayFocusRankableItem>(
  left: RankedTodayFocusItem<T>,
  right: RankedTodayFocusItem<T>
) {
  const scoreDelta =
    right.todayFocusRanking.finalScore - left.todayFocusRanking.finalScore;

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const sortDelta = (left.sortOrder ?? 100) - (right.sortOrder ?? 100);

  if (sortDelta !== 0) {
    return sortDelta;
  }

  return (right.createdAt || "").localeCompare(left.createdAt || "");
}

function providerExplicitlyRecommended(item: TodayFocusRankableItem) {
  const trace = objectValue(item.metadata?.recommendationTrace);
  const sourceCounts = objectValue(trace?.sourceTypeCounts);
  const prioritySignals = stringArrayValue(
    objectValue(trace?.priorityDecision)?.signals
  );

  return (
    Number(sourceCounts?.appointment_note ?? 0) > 0 ||
    Number(sourceCounts?.careprep_guidance ?? 0) > 0 ||
    prioritySignals.includes("provider_or_careprep_source") ||
    metadataBoolean(item.metadata, "providerRecommended")
  );
}

function isOverdue(item: TodayFocusRankableItem, referenceDay: string) {
  const dueDate = metadataDate(item.metadata, "dueDate") || metadataDate(item.schedule, "dueDate");

  return (
    metadataBoolean(item.metadata, "overdue") ||
    metadataBoolean(item.schedule, "overdue") ||
    Boolean(dueDate && dueDate < referenceDay)
  );
}

function metadataBoolean(value: unknown, key: string) {
  const object = objectValue(value);
  return object?.[key] === true;
}

function metadataDate(value: unknown, key: string) {
  const rawValue = stringValue(objectValue(value)?.[key]);
  return rawValue ? rawValue.slice(0, 10) : "";
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => stringValue(item)).filter(Boolean)
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dayString(date);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(150, Math.round(value)));
}
