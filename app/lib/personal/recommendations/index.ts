export type RecommendationPriority = "high" | "low" | "normal" | "strong";

export type RecommendationStatus =
  | "approved"
  | "candidate"
  | "converted_to_focus"
  | "dismissed"
  | "expired";

export type RecommendationSourceType =
  | "appointment_note"
  | "caregiver_goal"
  | "caregiver_note"
  | "careprep_guidance"
  | "custom"
  | "health_focus"
  | "import_anything"
  | "manual_note"
  | "provider_recommendation"
  | "reminder"
  | "system"
  | "talk_voice"
  | "track_history"
  | "user_goal";

export type RecommendationEvidence = {
  confidence?: number;
  evidenceText: string;
  occurredAt?: string | null;
  sourceId?: string | null;
  sourceLabel?: string | null;
  sourceTable?: string | null;
  sourceType: RecommendationSourceType;
};

export type RecommendationCandidate = {
  confidence: number;
  dedupeKey: string;
  description?: string | null;
  evidence: RecommendationEvidence[];
  priority: RecommendationPriority;
  reason: string;
  recommendationType: "daily_focus_candidate";
  sourceId?: string | null;
  sourceTable?: string | null;
  sourceType: RecommendationSourceType;
  status: RecommendationStatus;
  structuredPayload: {
    completionConfig?: Record<string, unknown>;
    completionEventType?: string;
    completionType?: string;
    generationRule: string;
    recommendationTrace?: RecommendationDecisionTrace;
    relatedTopics?: string[];
    snoozeReturn?: {
      dismissedRecommendationId: string;
      newEvidenceCount: number;
      rationale: string;
      returnedAt: string;
    };
  };
  title: string;
};

export type RecommendationInputSource = RecommendationEvidence & {
  text: string;
};

type RecommendationRule = {
  completionEventType: string;
  completionType: "measured_value" | "note_required" | "simple_done";
  description: string;
  eventKeywords: RecommendationKeyword[];
  generationRule: string;
  reason: string;
  relatedTopics: string[];
  title: string;
};

type RecommendationKeyword = {
  label: string;
  pattern: RegExp;
};

export type RecommendationDecisionTrace = {
  confidenceDecision: {
    averageEvidenceConfidence: number;
    confidence: number;
    rationale: string;
    sourceBoost: number;
  };
  evidenceCount: number;
  generationRule: string;
  matchedKeywords: string[];
  priorityDecision: {
    priority: RecommendationPriority;
    rationale: string;
    signals: string[];
  };
  sortDecision: {
    confidence: number;
    priorityRank: number;
  };
  sourceSummary: Array<{
    sourceId?: string | null;
    sourceLabel?: string | null;
    sourceTable?: string | null;
    sourceType: RecommendationSourceType;
  }>;
  sourceTypeCounts: Record<string, number>;
  uniqueSourceCount: number;
  version: 1;
};

const recommendationRules: RecommendationRule[] = [
  {
    completionEventType: "measurement.blood_pressure",
    completionType: "measured_value",
    description: "Record a home blood pressure reading for later review.",
    eventKeywords: [
      { label: "track home blood pressure", pattern: /\btrack home blood pressure\b/i },
      { label: "home bp", pattern: /\bhome bp\b/i },
      { label: "home blood pressure", pattern: /\bhome blood pressure\b/i },
      { label: "blood pressure log", pattern: /\bblood pressure log\b/i },
      { label: "home monitoring", pattern: /\bhome monitoring\b/i },
    ],
    generationRule: "home_blood_pressure_monitoring",
    reason: "Found in provider notes or CarePrep around home blood pressure monitoring.",
    relatedTopics: ["blood_pressure", "home_monitoring"],
    title: "Track home blood pressure readings",
  },
  {
    completionEventType: "activity.walking",
    completionType: "simple_done",
    description: "Encourage a short walk when it fits the person’s day.",
    eventKeywords: [
      { label: "walking tolerance", pattern: /\bwalking tolerance\b/i },
      { label: "walking", pattern: /\bwalking\b/i },
      { label: "balance", pattern: /\bbalance\b/i },
      { label: "activity planning", pattern: /\bactivity planning\b/i },
      { label: "mobility", pattern: /\bmobility\b/i },
    ],
    generationRule: "walking_mobility_support",
    reason: "Walking or mobility appeared in care notes, PT, or activity-planning context.",
    relatedTopics: ["walking_balance", "physical_therapy"],
    title: "Take a short walk",
  },
  {
    completionEventType: "measurement.weight",
    completionType: "measured_value",
    description: "Record weight when weight is part of the recent care story.",
    eventKeywords: [
      { label: "weight", pattern: /\bweight\b/i },
      { label: "nutrition", pattern: /\bnutrition\b/i },
      { label: "appetite", pattern: /\bappetite\b/i },
    ],
    generationRule: "weight_or_nutrition_monitoring",
    reason: "Weight appears in nutrition, lab, appetite, or follow-up preparation context.",
    relatedTopics: ["nutrition_weight"],
    title: "Record weight",
  },
  {
    completionEventType: "note.caregiver",
    completionType: "note_required",
    description: "Capture a note about medication timing questions or follow-up context.",
    eventKeywords: [
      { label: "medication timing", pattern: /\bmedication timing\b/i },
      { label: "medication list", pattern: /\bmedication list\b/i },
      { label: "medications", pattern: /\bmedications?\b/i },
    ],
    generationRule: "medication_timing_review",
    reason: "Medication timing appears in provider or CarePrep follow-up context.",
    relatedTopics: ["medication_changes"],
    title: "Review medication timing notes",
  },
];

const generalCareContextRule: RecommendationRule = {
  completionEventType: "note.caregiver",
  completionType: "note_required",
  description:
    "Review recent CarePland context and decide whether anything belongs in Today's Focus.",
  eventKeywords: [],
  generationRule: "review_recent_care_context",
  reason:
    "Recent CarePland context exists, but no more specific Today's Focus rule matched yet.",
  relatedTopics: ["care_context_review"],
  title: "Review recent care context",
};

export function generateRecommendationCandidates(
  sources: RecommendationInputSource[]
): RecommendationCandidate[] {
  const candidates = new Map<string, RecommendationCandidate>();

  for (const rule of recommendationRules) {
    const matchingEvidence = sources.filter((source) =>
      rule.eventKeywords.some((keyword) => keyword.pattern.test(source.text))
    );

    if (matchingEvidence.length === 0) {
      continue;
    }

    const candidate = recommendationCandidateFromEvidence(rule, matchingEvidence);
    candidates.set(rule.generationRule, candidate);
  }

  if (candidates.size === 0) {
    const generalEvidence = generalCareContextEvidence(sources);

    if (generalEvidence.length > 0) {
      candidates.set(
        generalCareContextRule.generationRule,
        recommendationCandidateFromEvidence(
          generalCareContextRule,
          generalEvidence
        )
      );
    }
  }

  return Array.from(candidates.values()).sort(compareRecommendationCandidates);
}

export function recommendationPriorityFromEvidence(
  evidence: RecommendationEvidence[]
): RecommendationPriority {
  return recommendationPriorityDecisionFromEvidence(evidence).priority;
}

export function recommendationPriorityDecisionFromEvidence(
  evidence: RecommendationEvidence[]
) {
  if (
    evidence.some((item) =>
      /\b(strongly|important|priority)\b/i.test(item.evidenceText)
    )
  ) {
    return {
      priority: "strong" as const,
      rationale:
        "Priority is strong because at least one source explicitly used strong importance language.",
      signals: ["explicit_strong_importance_language"],
    };
  }

  const providerBacked = evidence.some((item) =>
    item.sourceType === "provider_recommendation" ||
    item.sourceType === "appointment_note" ||
    item.sourceType === "careprep_guidance"
  );

  if (providerBacked || uniqueSourceCount(evidence) >= 3) {
    return {
      priority: "high" as const,
      rationale: providerBacked
        ? "Priority is high because at least one supporting source is a provider note or CarePrep item."
        : "Priority is high because three or more independent sources support the candidate.",
      signals: [
        ...(providerBacked ? ["provider_or_careprep_source"] : []),
        ...(uniqueSourceCount(evidence) >= 3 ? ["three_or_more_sources"] : []),
      ],
    };
  }

  if (evidence.some((item) => (item.confidence ?? 0.5) < 0.45)) {
    return {
      priority: "low" as const,
      rationale:
        "Priority is low because at least one supporting source has low extraction confidence.",
      signals: ["low_confidence_source"],
    };
  }

  return {
    priority: "normal" as const,
    rationale:
      "Priority is normal because the candidate has supporting evidence but no strong-importance language, provider/CarePrep boost, three-source boost, or low-confidence downgrade.",
    signals: ["supported_candidate"],
  };
}

export function normalizeRecommendationConfidence(
  evidence: RecommendationEvidence[]
): number {
  return recommendationConfidenceDecisionFromEvidence(evidence).confidence;
}

export function recommendationConfidenceDecisionFromEvidence(
  evidence: RecommendationEvidence[]
) {
  if (evidence.length === 0) {
    return {
      averageEvidenceConfidence: 0.5,
      confidence: 0.5,
      rationale: "Confidence defaults to 0.5 because no evidence was available.",
      sourceBoost: 0,
    };
  }

  const average =
    evidence.reduce((total, item) => total + normalizeConfidence(item.confidence), 0) /
    evidence.length;
  const sourceBoost = Math.min(0.15, Math.max(0, uniqueSourceCount(evidence) - 1) * 0.05);
  const confidence = Number(Math.min(1, average + sourceBoost).toFixed(3));

  return {
    averageEvidenceConfidence: Number(average.toFixed(3)),
    confidence,
    rationale:
      "Confidence is the average source confidence plus a small boost for independent supporting sources, capped at 1.0.",
    sourceBoost: Number(sourceBoost.toFixed(3)),
  };
}

export function recommendationEvidenceHash(evidence: RecommendationEvidence) {
  const normalized = normalizeEvidence(evidence);

  return [
    normalized.sourceType,
    normalized.sourceTable ?? "",
    normalized.sourceId ?? "",
    normalized.evidenceText.toLowerCase(),
  ]
    .join(":")
    .replace(/\s+/g, " ")
    .trim();
}

function recommendationCandidateFromEvidence(
  rule: RecommendationRule,
  evidence: RecommendationEvidence[]
): RecommendationCandidate {
  const normalizedEvidence = evidence.map(normalizeEvidence);
  const primaryEvidence = normalizedEvidence[0];
  const confidenceDecision = recommendationConfidenceDecisionFromEvidence(normalizedEvidence);
  const priorityDecision = recommendationPriorityDecisionFromEvidence(normalizedEvidence);

  return {
    confidence: confidenceDecision.confidence,
    dedupeKey: rule.generationRule,
    description: rule.description,
    evidence: normalizedEvidence,
    priority: priorityDecision.priority,
    reason: reasonWithSourceCount(rule.reason, normalizedEvidence),
    recommendationType: "daily_focus_candidate",
    sourceId: primaryEvidence?.sourceId ?? null,
    sourceTable: primaryEvidence?.sourceTable ?? null,
    sourceType: primaryEvidence?.sourceType ?? "system",
    status: "candidate",
    structuredPayload: {
      completionEventType: rule.completionEventType,
      completionType: rule.completionType,
      generationRule: rule.generationRule,
      recommendationTrace: buildRecommendationDecisionTrace({
        confidenceDecision,
        evidence: normalizedEvidence,
        priorityDecision,
        rule,
      }),
      relatedTopics: rule.relatedTopics,
    },
    title: rule.title,
  };
}

function buildRecommendationDecisionTrace({
  confidenceDecision,
  evidence,
  priorityDecision,
  rule,
}: {
  confidenceDecision: ReturnType<typeof recommendationConfidenceDecisionFromEvidence>;
  evidence: RecommendationEvidence[];
  priorityDecision: ReturnType<typeof recommendationPriorityDecisionFromEvidence>;
  rule: RecommendationRule;
}): RecommendationDecisionTrace {
  const matchedKeywords = uniqueTrimmed(
    evidence.flatMap((item) =>
      rule.eventKeywords
        .filter((keyword) => keyword.pattern.test(item.evidenceText))
        .map((keyword) => keyword.label)
    )
  );

  return {
    confidenceDecision,
    evidenceCount: evidence.length,
    generationRule: rule.generationRule,
    matchedKeywords,
    priorityDecision,
    sortDecision: {
      confidence: confidenceDecision.confidence,
      priorityRank: priorityRank(priorityDecision.priority),
    },
    sourceSummary: evidence.map((item) => ({
      sourceId: item.sourceId ?? null,
      sourceLabel: item.sourceLabel ?? null,
      sourceTable: item.sourceTable ?? null,
      sourceType: item.sourceType,
    })),
    sourceTypeCounts: sourceTypeCounts(evidence),
    uniqueSourceCount: uniqueSourceCount(evidence),
    version: 1,
  };
}

function compareRecommendationCandidates(
  left: RecommendationCandidate,
  right: RecommendationCandidate
) {
  const priorityDelta = priorityRank(right.priority) - priorityRank(left.priority);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return right.confidence - left.confidence;
}

function generalCareContextEvidence(sources: RecommendationInputSource[]) {
  const supportedSources = sources.filter((source) =>
    [
      "appointment_note",
      "careprep_guidance",
      "health_focus",
      "provider_recommendation",
      "track_history",
    ].includes(source.sourceType)
  );

  return supportedSources
    .sort((left, right) => {
      const sourceDelta =
        generalSourceRank(right.sourceType) - generalSourceRank(left.sourceType);

      if (sourceDelta !== 0) {
        return sourceDelta;
      }

      return timestampValue(right.occurredAt) - timestampValue(left.occurredAt);
    })
    .slice(0, 5);
}

function timestampValue(value: string | null | undefined) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function generalSourceRank(sourceType: RecommendationSourceType) {
  switch (sourceType) {
    case "provider_recommendation":
    case "appointment_note":
    case "careprep_guidance":
      return 3;
    case "health_focus":
      return 2;
    case "track_history":
      return 1;
    default:
      return 0;
  }
}

function priorityRank(priority: RecommendationPriority) {
  switch (priority) {
    case "strong":
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

function reasonWithSourceCount(
  reason: string,
  evidence: RecommendationEvidence[]
) {
  const count = uniqueSourceCount(evidence);

  if (count <= 1) {
    return reason;
  }

  return `${reason} Supported by ${count} sources.`;
}

function normalizeEvidence(evidence: RecommendationEvidence): RecommendationEvidence {
  return {
    confidence: normalizeConfidence(evidence.confidence),
    evidenceText: evidence.evidenceText.trim().replace(/\s+/g, " "),
    occurredAt: evidence.occurredAt ?? null,
    sourceId: evidence.sourceId?.trim() || null,
    sourceLabel: evidence.sourceLabel?.trim() || null,
    sourceTable: evidence.sourceTable?.trim().toLowerCase() || null,
    sourceType: evidence.sourceType,
  };
}

function normalizeConfidence(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.5;
  }

  return Math.max(0, Math.min(1, value));
}

function uniqueSourceCount(evidence: RecommendationEvidence[]) {
  return new Set(
    evidence.map((item) =>
      [item.sourceType, item.sourceTable ?? "", item.sourceId ?? item.evidenceText]
        .join(":")
        .toLowerCase()
    )
  ).size;
}

function sourceTypeCounts(evidence: RecommendationEvidence[]) {
  return evidence.reduce<Record<string, number>>((counts, item) => {
    counts[item.sourceType] = (counts[item.sourceType] ?? 0) + 1;
    return counts;
  }, {});
}

function uniqueTrimmed(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, allValues) => allValues.indexOf(value) === index);
}
