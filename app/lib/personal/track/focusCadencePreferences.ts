export const focusCadencePreferenceActions = [
  "show_less_often",
  "hide_until_next_appointment",
  "snooze_30_days",
  "stop_suggesting",
] as const;

export type FocusCadencePreferenceAction =
  (typeof focusCadencePreferenceActions)[number];

export const focusCadencePreferenceCadences = [
  "few_times_a_week",
  "weekly",
  "every_couple_of_weeks",
  "monthly",
  "only_before_appointments",
] as const;

export type FocusCadencePreferenceCadence =
  (typeof focusCadencePreferenceCadences)[number];

export type FocusCadencePreferenceRow = {
  cadence?: string | null;
  evidence_signature?: string | null;
  focus_item_id?: string | null;
  preference_action?: string | null;
  recommendation_id?: string | null;
  snoozed_until?: string | null;
  target_key?: string | null;
  target_type?: string | null;
};

export type FocusCadencePreferenceInput = {
  action: FocusCadencePreferenceAction;
  cadence?: FocusCadencePreferenceCadence | null;
  focusItemId: string;
  note?: string | null;
  personId: string;
};

export type FocusCadenceTarget = {
  evidenceSignature?: string | null;
  focusItemId: string;
  recommendationId?: string | null;
  targetKey: string;
  targetType: "focus_item" | "recommendation";
};

export type FocusCadenceSuppression = {
  reason: "snoozed" | "stopped";
};

export function normalizeFocusCadenceAction(
  value: unknown
): FocusCadencePreferenceAction | null {
  return typeof value === "string" &&
    focusCadencePreferenceActions.includes(
      value as FocusCadencePreferenceAction
    )
    ? (value as FocusCadencePreferenceAction)
    : null;
}

export function normalizeFocusCadence(
  value: unknown
): FocusCadencePreferenceCadence | null {
  return typeof value === "string" &&
    focusCadencePreferenceCadences.includes(
      value as FocusCadencePreferenceCadence
    )
    ? (value as FocusCadencePreferenceCadence)
    : null;
}

export function snoozedUntilForFocusCadenceAction(
  action: FocusCadencePreferenceAction,
  referenceDate = new Date()
) {
  if (action !== "snooze_30_days") {
    return null;
  }

  const date = new Date(referenceDate);
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString().slice(0, 10);
}

export function focusCadenceTargetFromMetadata(input: {
  focusItemId: string;
  metadata?: Record<string, unknown> | null;
}): FocusCadenceTarget {
  const recommendationId =
    typeof input.metadata?.recommendationId === "string"
      ? input.metadata.recommendationId
      : null;
  const evidenceSignature = recommendationEvidenceSignature(input.metadata);

  return {
    evidenceSignature,
    focusItemId: input.focusItemId,
    recommendationId,
    targetKey: recommendationId ?? input.focusItemId,
    targetType: recommendationId ? "recommendation" : "focus_item",
  };
}

export function focusCadenceSuppressionForRows(
  rows: FocusCadencePreferenceRow[],
  target: FocusCadenceTarget,
  referenceDate = new Date()
): FocusCadenceSuppression | null {
  const referenceDay = referenceDate.toISOString().slice(0, 10);
  const matchingRows = rows.filter((row) => preferenceMatchesTarget(row, target));

  for (const row of matchingRows) {
    if (
      row.preference_action === "stop_suggesting" &&
      !hasNewEvidenceSincePreference(row, target)
    ) {
      return { reason: "stopped" };
    }

    if (
      (row.preference_action === "snooze_30_days" ||
        row.preference_action === "hide_until_next_appointment") &&
      row.snoozed_until &&
      row.snoozed_until >= referenceDay &&
      !hasNewEvidenceSincePreference(row, target)
    ) {
      return { reason: "snoozed" };
    }
  }

  return null;
}

function preferenceMatchesTarget(
  row: FocusCadencePreferenceRow,
  target: FocusCadenceTarget
) {
  return (
    row.focus_item_id === target.focusItemId ||
    (target.recommendationId && row.recommendation_id === target.recommendationId) ||
    (row.target_type === target.targetType && row.target_key === target.targetKey)
  );
}

function hasNewEvidenceSincePreference(
  row: FocusCadencePreferenceRow,
  target: FocusCadenceTarget
) {
  return Boolean(
    row.evidence_signature &&
      target.evidenceSignature &&
      row.evidence_signature !== target.evidenceSignature
  );
}

function recommendationEvidenceSignature(metadata?: Record<string, unknown> | null) {
  const trace =
    metadata?.recommendationTrace && typeof metadata.recommendationTrace === "object"
      ? (metadata.recommendationTrace as Record<string, unknown>)
      : null;
  const evidenceHashes = trace?.evidenceHashes;

  if (Array.isArray(evidenceHashes) && evidenceHashes.length > 0) {
    return evidenceHashes
      .filter((value): value is string => typeof value === "string")
      .sort()
      .join("|");
  }

  return null;
}
