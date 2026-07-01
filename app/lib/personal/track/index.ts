export const trackEventSources = [
  "ai_suggestion",
  "appointment_note",
  "caregiver_note",
  "connect_call_summary",
  "custom",
  "focus_item",
  "import_anything",
  "manual",
  "receiver_today_focus",
  "reminder",
  "system",
  "talk_voice",
] as const;

export type TrackEventSource = (typeof trackEventSources)[number];

export const trackEventTypes = [
  "activity.walking",
  "medication.skipped",
  "medication.taken",
  "measurement.blood_sugar",
  "measurement.weight",
  "note.caregiver",
  "reminder.response",
  "symptom.check",
] as const;

export type KnownTrackEventType = (typeof trackEventTypes)[number];

export const focusCompletionTypes = [
  "custom",
  "measured_value",
  "medication",
  "note_required",
  "simple_done",
  "symptom_check",
  "yes_no",
] as const;

export type FocusCompletionType = (typeof focusCompletionTypes)[number];

export type FocusItemStatus = "active" | "archived" | "paused";

export type FocusCompletionConfig = {
  eventType?: string | null;
  medicationOutcomeOptions?: string[];
  requiredNote?: boolean;
  unit?: string | null;
  unitOptions?: string[];
  valuePromptText?: string | null;
};

export type FocusItemDraft = {
  activeEndDate?: string | null;
  activeStartDate?: string | null;
  careCircleId: string;
  careSubjectId: string;
  completionConfig?: FocusCompletionConfig;
  completionEventType?: string | null;
  completionPromptText?: string | null;
  completionType: FocusCompletionType;
  focusType?: string;
  importanceScore?: number;
  promptText?: string | null;
  recurrenceRule?: string | null;
  schedule?: Record<string, unknown>;
  sortOrder?: number;
  status?: FocusItemStatus;
  title: string;
};

export type TrackEventDraft = {
  careCircleId: string;
  careSubjectId: string;
  confidence?: number;
  eventType: string;
  focusItemId?: string | null;
  needsReview?: boolean;
  note?: string | null;
  occurredAt: string;
  source: TrackEventSource;
  structuredPayload?: Record<string, unknown>;
  title: string;
  unit?: string | null;
  value?: number | null;
};

export function normalizeTrackEventType(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_\.]+|[_\.]+$/g, "");
}

export function normalizeFocusType(value: string | undefined): string {
  return normalizeTrackEventType(value || "daily_prompt");
}

export function normalizeFocusItemDraft(draft: FocusItemDraft): FocusItemDraft {
  const completionConfig = normalizeCompletionConfig(draft.completionConfig);
  const completionEventType =
    draft.completionEventType ??
    completionConfig.eventType ??
    defaultEventTypeForCompletionType(draft.completionType);

  return {
    ...draft,
    completionConfig,
    completionEventType: completionEventType
      ? normalizeTrackEventType(completionEventType)
      : null,
    completionPromptText:
      draft.completionPromptText?.trim() ||
      measuredValuePromptFromConfig(completionConfig) ||
      null,
    focusType: normalizeFocusType(draft.focusType),
    promptText: draft.promptText?.trim() || null,
    importanceScore: normalizeImportanceScore(draft.importanceScore),
    recurrenceRule: draft.recurrenceRule?.trim() || null,
    schedule: draft.schedule ?? {},
    sortOrder: Number.isFinite(draft.sortOrder) ? draft.sortOrder : 100,
    status: draft.status ?? "active",
    title: normalizeTrackTitle(draft.title),
  };
}

export function measuredValuePromptFromConfig(
  config: FocusCompletionConfig | undefined
): string | null {
  const normalized = normalizeCompletionConfig(config);

  if (normalized.valuePromptText) {
    return normalized.valuePromptText;
  }

  if (normalized.unitOptions && normalized.unitOptions.length > 1) {
    return `What was the value? (${normalized.unitOptions.join(" / ")})`;
  }

  if (normalized.unit) {
    return `What was the value in ${normalized.unit}?`;
  }

  return null;
}

export function buildTrackEventFromFocusCompletion({
  focusItem,
  occurredAt,
  source = "focus_item",
  structuredPayload,
  title,
  unit,
  value,
}: {
  focusItem: FocusItemDraft & { id?: string | null };
  occurredAt: string;
  source?: TrackEventSource;
  structuredPayload?: Record<string, unknown>;
  title?: string;
  unit?: string | null;
  value?: number | null;
}): TrackEventDraft {
  const normalizedFocus = normalizeFocusItemDraft(focusItem);

  return {
    careCircleId: normalizedFocus.careCircleId,
    careSubjectId: normalizedFocus.careSubjectId,
    eventType:
      normalizedFocus.completionEventType ??
      defaultEventTypeForCompletionType(normalizedFocus.completionType),
    focusItemId: focusItem.id ?? null,
    occurredAt,
    source,
    structuredPayload: structuredPayload ?? {},
    title: normalizeTrackTitle(title || normalizedFocus.title),
    unit: unit ?? normalizedFocus.completionConfig?.unit ?? null,
    value: value ?? null,
  };
}

function defaultEventTypeForCompletionType(
  completionType: FocusCompletionType
): string {
  switch (completionType) {
    case "medication":
      return "medication.taken";
    case "measured_value":
      return "measurement.custom";
    case "symptom_check":
      return "symptom.check";
    case "note_required":
      return "note.caregiver";
    case "yes_no":
      return "reminder.response";
    case "custom":
    case "simple_done":
    default:
      return "activity.completed";
  }
}

function normalizeCompletionConfig(
  config: FocusCompletionConfig | undefined
): FocusCompletionConfig {
  return {
    ...config,
    eventType: config?.eventType ? normalizeTrackEventType(config.eventType) : null,
    medicationOutcomeOptions: uniqueTrimmed(config?.medicationOutcomeOptions ?? []),
    unit: config?.unit?.trim() || null,
    unitOptions: uniqueTrimmed(config?.unitOptions ?? []),
    valuePromptText: config?.valuePromptText?.trim() || null,
  };
}

function normalizeTrackTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeImportanceScore(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueTrimmed(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, allValues) => allValues.indexOf(value) === index);
}
