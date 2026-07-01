import {
  type FocusCompletionType,
  type FocusItemDraft,
  type TrackEventDraft,
  buildTrackEventFromFocusCompletion,
  normalizeImportanceScore,
} from ".";
import {
  rankTodayFocusItems,
  type RankedTodayFocusItem,
  type TodayFocusRankingContext,
  type TodayFocusRankingTrace,
} from "./todayFocusRanking";

export const receiverTodayFocusItemLimit = 3;

export type ReceiverTodayFocusRow = {
  active_end_date?: string | null;
  active_start_date?: string | null;
  care_circle_id: string;
  care_subject_id: string;
  completion_config?: Record<string, unknown> | null;
  completion_event_type?: string | null;
  completion_prompt_text?: string | null;
  completion_type: string;
  created_at?: string | null;
  focus_type?: string | null;
  id: string;
  importance_score?: number | null;
  metadata?: Record<string, unknown> | null;
  prompt_text?: string | null;
  recurrence_rule?: string | null;
  schedule?: Record<string, unknown> | null;
  sort_order?: number | null;
  status?: string | null;
  title: string;
};

export type ReceiverTodayFocusItem = FocusItemDraft & {
  id: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  todayFocusRanking?: TodayFocusRankingTrace;
};

export type ReceiverFocusCompletionInput = {
  focusItem: ReceiverTodayFocusItem;
  note?: string | null;
  occurredAt?: string | null;
  unit?: string | null;
  value?: number | null;
};

export function normalizeReceiverTodayFocusRows(
  rows: ReceiverTodayFocusRow[],
  referenceDate: Date = new Date(),
  rankingContext: TodayFocusRankingContext = {}
): ReceiverTodayFocusItem[] {
  const activeItems = rows
    .filter((row) => isActiveOnDate(row, referenceDate))
    .filter((row) => !isAppointmentReminderFocusRow(row))
    .map(normalizeReceiverTodayFocusRow);

  return rankTodayFocusItems(activeItems, {
    ...rankingContext,
    referenceDate,
  }) as Array<RankedTodayFocusItem<ReceiverTodayFocusItem>>;
}

export function buildReceiverTodayFocusCompletionEvent({
  focusItem,
  note,
  occurredAt,
  unit,
  value,
}: ReceiverFocusCompletionInput): TrackEventDraft {
  if (focusItem.completionType === "measured_value") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Measured Focus Items require a numeric value.");
    }

    const resolvedUnit = resolveMeasuredUnit(focusItem, unit);

    return {
      ...buildTrackEventFromFocusCompletion({
        focusItem,
        occurredAt: occurredAt || new Date().toISOString(),
        source: "receiver_today_focus",
        structuredPayload: {
          completionType: focusItem.completionType,
          source: "receiver_today_focus",
        },
        unit: resolvedUnit,
        value,
      }),
      note: note?.trim() || null,
    };
  }

  if (focusItem.completionType !== "simple_done") {
    throw new Error("Receiver Today’s Focus only supports simple and measured completions right now.");
  }

  return {
    ...buildTrackEventFromFocusCompletion({
      focusItem,
      occurredAt: occurredAt || new Date().toISOString(),
      source: "receiver_today_focus",
      structuredPayload: {
        completionType: focusItem.completionType,
        source: "receiver_today_focus",
      },
    }),
    note: note?.trim() || null,
  };
}

function normalizeReceiverTodayFocusRow(
  row: ReceiverTodayFocusRow
): ReceiverTodayFocusItem {
  return {
    activeEndDate: row.active_end_date ?? null,
    activeStartDate: row.active_start_date ?? null,
    careCircleId: row.care_circle_id,
    careSubjectId: row.care_subject_id,
    completionConfig: normalizeCompletionConfigFromRow(row.completion_config),
    completionEventType: row.completion_event_type ?? null,
    completionPromptText: row.completion_prompt_text ?? null,
    completionType: completionTypeFromRow(row.completion_type),
    createdAt: row.created_at || "",
    focusType: row.focus_type || "daily_prompt",
    id: row.id,
    importanceScore: normalizeImportanceScore(row.importance_score ?? undefined),
    metadata: row.metadata ?? {},
    promptText: row.prompt_text ?? null,
    recurrenceRule: row.recurrence_rule ?? null,
    schedule: row.schedule ?? {},
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : 100,
    status: row.status === "paused" || row.status === "archived" ? row.status : "active",
    title: row.title,
  };
}

function isActiveOnDate(row: ReceiverTodayFocusRow, referenceDate: Date) {
  if ((row.status || "active") !== "active") {
    return false;
  }

  const referenceDay = referenceDate.toISOString().slice(0, 10);

  if (row.active_start_date && row.active_start_date > referenceDay) {
    return false;
  }

  if (row.active_end_date && row.active_end_date < referenceDay) {
    return false;
  }

  return true;
}

function isAppointmentReminderFocusRow(row: ReceiverTodayFocusRow) {
  const focusType = (row.focus_type || "").toLowerCase();

  if (
    focusType.includes("appointment") ||
    focusType.includes("calendar") ||
    focusType === "reminder_prompt"
  ) {
    return true;
  }

  const title = row.title.toLowerCase();
  const promptText = (row.prompt_text || "").toLowerCase();
  const text = `${title} ${promptText}`;

  return (
    text.includes("appointment") ||
    text.includes("doctor") ||
    text.includes("cardiology") ||
    text.includes("follow-up") ||
    text.includes("follow up")
  );
}

function completionTypeFromRow(value: string): FocusCompletionType {
  return value === "measured_value" ||
    value === "medication" ||
    value === "symptom_check" ||
    value === "yes_no" ||
    value === "note_required" ||
    value === "custom"
    ? value
    : "simple_done";
}

function normalizeCompletionConfigFromRow(
  value: Record<string, unknown> | null | undefined
) {
  return {
    eventType: stringOrNull(value?.eventType),
    medicationOutcomeOptions: stringArray(value?.medicationOutcomeOptions),
    requiredNote: value?.requiredNote === true,
    unit: stringOrNull(value?.unit),
    unitOptions: stringArray(value?.unitOptions),
    valuePromptText: stringOrNull(value?.valuePromptText),
  };
}

function resolveMeasuredUnit(
  focusItem: ReceiverTodayFocusItem,
  requestedUnit: string | null | undefined
) {
  const normalizedUnit = requestedUnit?.trim();

  if (normalizedUnit) {
    return normalizedUnit;
  }

  const configuredUnit = focusItem.completionConfig?.unit?.trim();

  if (configuredUnit) {
    return configuredUnit;
  }

  const firstUnitOption = focusItem.completionConfig?.unitOptions?.[0]?.trim();

  return firstUnitOption || null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
