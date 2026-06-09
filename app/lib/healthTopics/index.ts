export type HealthTopicDomain = "care_logistics" | "general" | "health";

export type TopicMentionStatus =
  | "follow_up"
  | "new"
  | "ongoing"
  | "resolved"
  | "unknown";

export type HealthTopic = {
  aliases: string[];
  category: string;
  displayName: string;
  domain: HealthTopicDomain;
  parentSlug?: string;
  slug: string;
};

export type TopicMentionCandidate = {
  aiSuggestedStatus?: TopicMentionStatus;
  appointmentStartsAt?: string | null;
  appointmentType?: string | null;
  isMarkedImportant?: boolean;
  providerName?: string | null;
  providerOrganization?: string | null;
  sourceAppointmentId?: string | null;
  specialty?: string | null;
  status?: TopicMentionStatus;
  statusSource?: "ai" | "system" | "user";
  topicSlugs: string[];
};

export type RelevanceTarget = {
  appointmentStartsAt?: string | null;
  appointmentType?: string | null;
  providerName?: string | null;
  providerOrganization?: string | null;
  specialty?: string | null;
  topicSlugs: string[];
};

export type ContextRelevanceFactor = {
  factorKey: string;
  weight: number;
};

export type RelevanceScoreBreakdown = {
  factorKey: string;
  reason: string;
  score: number;
};

export type RelevanceScore = {
  breakdown: RelevanceScoreBreakdown[];
  score: number;
  sharedTopicSlugs: string[];
};

export const defaultRelevanceFactors: ContextRelevanceFactor[] = [
  { factorKey: "topic_overlap", weight: 45 },
  { factorKey: "unresolved_follow_up", weight: 28 },
  { factorKey: "user_marked_important", weight: 30 },
  { factorKey: "same_provider", weight: 24 },
  { factorKey: "same_practice", weight: 20 },
  { factorKey: "same_specialty", weight: 16 },
  { factorKey: "same_appointment_type", weight: 12 },
  { factorKey: "recent_urgent_care", weight: 20 },
  { factorKey: "pcp_broad_context", weight: 8 },
  { factorKey: "recency_decay", weight: 18 },
];

const unresolvedStatuses = new Set<TopicMentionStatus>([
  "follow_up",
  "new",
  "ongoing",
]);

export function normalizeTopicSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeComparableText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildTopicAliasMap(topics: HealthTopic[]): Map<string, string> {
  const aliasMap = new Map<string, string>();

  topics.forEach((topic) => {
    aliasMap.set(normalizeTopicSlug(topic.slug), topic.slug);
    aliasMap.set(normalizeTopicSlug(topic.displayName), topic.slug);

    topic.aliases.forEach((alias) => {
      aliasMap.set(normalizeTopicSlug(alias), topic.slug);
    });
  });

  return aliasMap;
}

export function resolveTopicSlug(
  value: string,
  aliasMap: Map<string, string>
): string {
  const normalized = normalizeTopicSlug(value);
  return aliasMap.get(normalized) ?? normalized;
}

export function sharedTopicSlugs(
  leftTopicSlugs: string[],
  rightTopicSlugs: string[]
): string[] {
  const right = new Set(rightTopicSlugs.map(normalizeTopicSlug));

  return leftTopicSlugs
    .map(normalizeTopicSlug)
    .filter((topicSlug, index, topicSlugs) => {
      return right.has(topicSlug) && topicSlugs.indexOf(topicSlug) === index;
    });
}

export function relatedTopicSlugsForMention(
  topicSlug: string,
  allTopicSlugs: string[]
): string[] {
  const normalizedTopicSlug = normalizeTopicSlug(topicSlug);

  return allTopicSlugs
    .map(normalizeTopicSlug)
    .filter((candidateSlug, index, topicSlugs) => {
      return (
        candidateSlug &&
        candidateSlug !== normalizedTopicSlug &&
        topicSlugs.indexOf(candidateSlug) === index
      );
    })
    .sort();
}

export function recencyMultiplier(
  appointmentStartsAt: string | null | undefined,
  referenceDate: Date,
  halfLifeDays = 180,
  floor = 0.15
): number {
  if (!appointmentStartsAt) {
    return floor;
  }

  const appointmentDate = new Date(appointmentStartsAt);

  if (Number.isNaN(appointmentDate.getTime())) {
    return floor;
  }

  const ageMs = Math.max(0, referenceDate.getTime() - appointmentDate.getTime());
  const ageDays = ageMs / 86_400_000;
  const multiplier = Math.pow(0.5, ageDays / halfLifeDays);

  return Math.max(floor, Math.min(1, multiplier));
}

export function truncateSourceSnippet(value: string, maxLength = 160): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd() + "...";
}

export function scoreContextCandidate(
  candidate: TopicMentionCandidate,
  target: RelevanceTarget,
  options: {
    factors?: ContextRelevanceFactor[];
    referenceDate?: Date;
  } = {}
): RelevanceScore {
  const factors = new Map(
    (options.factors ?? defaultRelevanceFactors).map((factor) => [
      factor.factorKey,
      factor.weight,
    ])
  );
  const referenceDate = options.referenceDate ?? new Date();
  const matchedTopicSlugs = sharedTopicSlugs(candidate.topicSlugs, target.topicSlugs);
  const breakdown: RelevanceScoreBreakdown[] = [];

  function addFactor(factorKey: string, reason: string, multiplier = 1) {
    const weight = factors.get(factorKey) ?? 0;

    if (weight <= 0 || multiplier <= 0) {
      return;
    }

    breakdown.push({
      factorKey,
      reason,
      score: Number((weight * multiplier).toFixed(3)),
    });
  }

  if (matchedTopicSlugs.length > 0) {
    addFactor("topic_overlap", "Shares one or more normalized topics.");
  }

  if (candidate.status && unresolvedStatuses.has(candidate.status)) {
    addFactor("unresolved_follow_up", "Prior topic is still open or follow-up oriented.");
  }

  if (candidate.isMarkedImportant) {
    addFactor("user_marked_important", "User marked the prior context as important.");
  }

  if (
    normalizeComparableText(candidate.providerName) &&
    normalizeComparableText(candidate.providerName) ===
      normalizeComparableText(target.providerName)
  ) {
    addFactor("same_provider", "Same provider.");
  }

  if (
    normalizeComparableText(candidate.providerOrganization) &&
    normalizeComparableText(candidate.providerOrganization) ===
      normalizeComparableText(target.providerOrganization)
  ) {
    addFactor("same_practice", "Same practice or organization.");
  }

  if (
    normalizeComparableText(candidate.specialty) &&
    normalizeComparableText(candidate.specialty) ===
      normalizeComparableText(target.specialty)
  ) {
    addFactor("same_specialty", "Same specialty.");
  }

  if (
    normalizeComparableText(candidate.appointmentType) &&
    normalizeComparableText(candidate.appointmentType) ===
      normalizeComparableText(target.appointmentType)
  ) {
    addFactor("same_appointment_type", "Same appointment type.");
  }

  if (
    normalizeTopicSlug(candidate.appointmentType ?? "") === "urgent_care" &&
    recencyMultiplier(candidate.appointmentStartsAt, referenceDate, 30, 0) >= 0.5
  ) {
    addFactor("recent_urgent_care", "Recent urgent care context.");
  }

  if (normalizeTopicSlug(target.appointmentType ?? "") === "primary_care") {
    addFactor("pcp_broad_context", "Primary care can benefit from broader context.");
  }

  addFactor(
    "recency_decay",
    "More recent appointment context.",
    recencyMultiplier(candidate.appointmentStartsAt, referenceDate)
  );

  return {
    breakdown,
    score: Number(
      breakdown.reduce((total, item) => total + item.score, 0).toFixed(3)
    ),
    sharedTopicSlugs: matchedTopicSlugs,
  };
}
