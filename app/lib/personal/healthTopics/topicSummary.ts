import { normalizeTopicSlug } from ".";

export type HealthStoryStatus =
  | "follow_up"
  | "new"
  | "ongoing"
  | "resolved"
  | "unknown";

export type RelatedTopicLike = {
  displayName: string;
  mentionCount?: number;
  topicSlug: string;
};

export type TopicContextSignature = {
  frequencyLabel: string;
  recencyLabel: string;
  spanLabel: string;
};

const healthFocusCardSummaryHardMax = 200;

const statusDisplayLabels: Record<HealthStoryStatus, string> = {
  follow_up: "follow-up",
  new: "new",
  ongoing: "ongoing",
  resolved: "resolved",
  unknown: "saved",
};

const multiStatusNarrativePhrases = [
  "Appears across different stages of care.",
  "Shows up across different phases of care.",
  "Has carried forward across multiple visits.",
  "Forms part of a broader care pattern.",
  "Connects to multiple visits over time.",
  "Has remained part of the story over time.",
  "Shows up across several parts of the care record.",
];

const focusedStatusNarrativePhrases = [
  "Has carried forward across {statuses} visits.",
  "Has been present in {statuses} visits.",
  "Shows up in {statuses} visits.",
  "Provides context across {statuses} visits.",
  "Appears alongside {statuses} care discussions.",
];

export const supportingHealthFocusTopicSlugs = new Set([
  "follow_up",
  "home_monitoring",
  "imaging",
  "lab_results",
]);

export const genericRelatedTopicSlugs = new Set([
  "follow_up",
  "home_monitoring",
  "imaging",
  "lab_results",
  "pain",
  "procedures",
]);

export const userFacingHealthFocusTopicSlugs = new Set([
  "anxiety_stress",
  "arthritis",
  "asthma_breathing",
  "blood_pressure",
  "cardiology",
  "cholesterol",
  "dental_oral_health",
  "diabetes",
  "dizziness",
  "fatigue",
  "knee_pain",
  "medication_changes",
  "mood_depression",
  "nutrition_weight",
  "orthopedics",
  "pain",
  "physical_therapy",
  "preventive_care",
  "sleep",
  "walking_balance",
]);

export function isPrimaryHealthFocusTopic(topicSlug: string, category: string) {
  if (supportingHealthFocusTopicSlugs.has(topicSlug)) {
    return false;
  }

  if (userFacingHealthFocusTopicSlugs.has(topicSlug)) {
    return true;
  }

  return !["diagnostics", "follow_up", "labs"].includes(category);
}

export function cleanSourceSnippet(value: string | null): string {
  const snippet = value?.trim() ?? "";

  if (!snippet || /^matched term:/i.test(snippet)) {
    return "Relevant saved note text was not available.";
  }

  return snippet;
}

export function cleanDate(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function statusNarrativePhrase(
  statuses: HealthStoryStatus[],
  seed = ""
) {
  const uniqueStatuses = Array.from(
    new Set(statuses.filter((status) => status !== "unknown"))
  );

  if (uniqueStatuses.length === 0) {
    return "";
  }

  if (uniqueStatuses.length >= 3) {
    return seededPhrase(multiStatusNarrativePhrases, seed);
  }

  const statusText = topicListSentence(
    uniqueStatuses.map((status) => statusDisplayLabels[status] ?? status)
  );

  return seededPhrase(focusedStatusNarrativePhrases, seed).replace(
    "{statuses}",
    statusText
  );
}

export function monthYear(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function seasonYear(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const month = date.getMonth();
  const season =
    month <= 1 || month === 11
      ? "Winter"
      : month <= 4
        ? "Spring"
        : month <= 7
          ? "Summer"
          : "Fall";

  return `${season} ${date.getFullYear()}`;
}

function validDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function calendarMonthDelta(left: Date, right: Date) {
  return (
    (left.getFullYear() - right.getFullYear()) * 12 +
    left.getMonth() -
    right.getMonth()
  );
}

function seededPhrase(phrases: string[], seed: string) {
  if (phrases.length === 0) {
    return "";
  }

  const value = Array.from(seed || "carepland").reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );

  return phrases[value % phrases.length];
}

export function getRecencyLabel(
  lastMentionDate: string | null,
  referenceDate = new Date()
) {
  const latest = validDate(lastMentionDate);

  if (!latest) {
    return "No Date";
  }

  const startOfLatest = new Date(
    latest.getFullYear(),
    latest.getMonth(),
    latest.getDate()
  );
  const startOfReference = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const dayDelta = Math.floor(
    (startOfReference.getTime() - startOfLatest.getTime()) / 86_400_000
  );

  if (dayDelta === 0) {
    return "Today";
  }

  if (dayDelta === 1) {
    return "Yesterday";
  }

  if (dayDelta > 1 && dayDelta <= 3) {
    return "Past Few Days";
  }

  if (dayDelta > 3 && dayDelta <= 7) {
    return "This Week";
  }

  const monthDelta = calendarMonthDelta(referenceDate, latest);

  if (monthDelta === 0) {
    return "This Month";
  }

  if (monthDelta === 1) {
    return "Last Month";
  }

  if (latest.getFullYear() === referenceDate.getFullYear()) {
    return "Earlier This Year";
  }

  if (latest.getFullYear() === referenceDate.getFullYear() - 1) {
    return "Last Year";
  }

  return "Before Last Year";
}

export function getFrequencyLabel(
  mentionCount: number,
  totalVisitCount: number
) {
  if (mentionCount <= 1) {
    return "Once";
  }

  if (mentionCount <= 3) {
    return "A Few Times";
  }

  if (totalVisitCount <= 0) {
    return mentionCount >= 8 ? "Frequent" : "Fairly Often";
  }

  const ratio = mentionCount / totalVisitCount;

  if (ratio > 0.75) {
    return "Most Visits";
  }

  if (ratio > 0.5) {
    return "Frequent";
  }

  if (ratio >= 0.25) {
    return "Fairly Often";
  }

  return "Occasionally";
}

export function getSpanLabel(
  firstMentionDate: string | null,
  lastMentionDate: string | null
) {
  const first = validDate(firstMentionDate);
  const last = validDate(lastMentionDate);

  if (!first || !last) {
    return "One Visit";
  }

  const spanDays = Math.abs(
    (last.getTime() - first.getTime()) / 86_400_000
  );

  if (spanDays < 14) {
    return "One Visit";
  }

  if (spanDays < 60) {
    return "Several Weeks";
  }

  if (spanDays < 330) {
    return "Several Months";
  }

  if (spanDays < 730) {
    return "About a Year";
  }

  return "Multiple Years";
}

export function buildTopicContextSignature({
  firstMentionAt,
  latestMentionAt,
  mentionCount,
  totalVisitCount,
}: {
  firstMentionAt: string | null;
  latestMentionAt: string | null;
  mentionCount: number;
  totalVisitCount: number;
}): TopicContextSignature {
  return {
    frequencyLabel: getFrequencyLabel(mentionCount, totalVisitCount),
    recencyLabel: getRecencyLabel(latestMentionAt),
    spanLabel: getSpanLabel(firstMentionAt, latestMentionAt),
  };
}

export function providerContextPhrase(providerNames: string[]) {
  if (providerNames.length === 0) {
    return "";
  }

  if (providerNames.length === 1) {
    return `This seems mainly tied to care with ${providerNames[0]}`;
  }

  return `This spans care with ${providerNames
    .slice(0, 2)
    .join(" and ")}`;
}

export function meaningfulRelatedTopics(
  relatedTopics: RelatedTopicLike[],
  options: { maxCount?: number } = {}
) {
  const maxCount = options.maxCount ?? 4;
  const uniqueTopics = new Map<string, RelatedTopicLike>();

  relatedTopics.forEach((topic) => {
    const topicSlug = normalizeTopicSlug(topic.topicSlug);

    if (!topicSlug) {
      return;
    }

    uniqueTopics.set(topicSlug, { ...topic, topicSlug });
  });

  const allTopics = Array.from(uniqueTopics.values()).sort((left, right) => {
    const countDelta = (right.mentionCount ?? 0) - (left.mentionCount ?? 0);

    return countDelta || left.displayName.localeCompare(right.displayName);
  });
  const specificTopics = allTopics.filter(
    (topic) => !genericRelatedTopicSlugs.has(topic.topicSlug)
  );

  return (specificTopics.length > 0 ? specificTopics : allTopics).slice(
    0,
    maxCount
  );
}

export function relatedContextPhrase(relatedTopicNames: string[]) {
  if (relatedTopicNames.length === 0) {
    return "";
  }

  return `This may overlap with ${relatedTopicNames
    .slice(0, 3)
    .join(", ")}`;
}

function sentenceJoin(parts: string[]) {
  const sentences = parts.filter(Boolean);

  if (sentences.length === 0) {
    return "";
  }

  return sentences.join(". ").replace(/\.$/, "") + ".";
}

function userContextSentence(userContextTexts: string[]) {
  const contextText = userContextTexts
    .map((text) => text.trim())
    .find(
      (text) =>
        text &&
        !/interpretation was confirmed by the user/i.test(text) &&
        !/marked not accurate by the user/i.test(text)
    );

  if (!contextText) {
    return "";
  }

  if (/^You (confirmed|corrected|marked|noted)\b/i.test(contextText)) {
    return contextText.replace(/\.$/, "");
  }

  return `You've clarified: ${contextText.replace(/\.$/, "")}`;
}

function hasTopic(relatedTopics: RelatedTopicLike[], topicSlug: string) {
  return relatedTopics.some((topic) => topic.topicSlug === topicSlug);
}

function hasAnyTopic(relatedTopics: RelatedTopicLike[], topicSlugs: string[]) {
  return topicSlugs.some((topicSlug) => hasTopic(relatedTopics, topicSlug));
}

const topicPhraseOverrides: Record<string, string> = {
  anxiety_stress: "anxiety or stress",
  arthritis: "arthritis",
  asthma_breathing: "breathing or asthma symptoms",
  blood_pressure: "blood pressure",
  cholesterol: "cholesterol",
  dental_oral_health: "dental care",
  dizziness: "dizziness",
  follow_up: "follow-up care",
  imaging: "imaging",
  knee_pain: "knee pain",
  lab_results: "lab results",
  medication_changes: "medication changes",
  nutrition_weight: "nutrition and weight",
  orthopedics: "orthopedic care",
  physical_therapy: "physical therapy",
};

function phraseForTopic(topic: RelatedTopicLike) {
  return (
    topicPhraseOverrides[topic.topicSlug] ??
    topic.displayName.charAt(0).toLowerCase() + topic.displayName.slice(1)
  );
}

function phrasesFor(relatedTopics: RelatedTopicLike[], topicSlugs: string[]) {
  return topicSlugs
    .map((topicSlug) =>
      relatedTopics.find((topic) => topic.topicSlug === topicSlug)
    )
    .filter((topic): topic is RelatedTopicLike => Boolean(topic))
    .map((topic) => phraseForTopic(topic));
}

function providerThread(providerNames: string[]) {
  if (providerNames.length === 0) {
    return "";
  }

  if (providerNames.length === 1) {
    return `mainly with ${providerNames[0]}`;
  }

  return `with ${providerNames.slice(0, 2).join(" and ")}`;
}

function topicListSentence(topicNames: string[]) {
  if (topicNames.length === 0) {
    return "";
  }

  if (topicNames.length === 1) {
    return topicNames[0];
  }

  if (topicNames.length === 2) {
    return topicNames.join(" and ");
  }

  return `${topicNames.slice(0, -1).join(", ")}, and ${
    topicNames[topicNames.length - 1]
  }`;
}

function specificTopicNarrative({
  displayName,
  mentionCount,
  providerNames,
  relatedTopics,
  statuses,
  topicSlug,
  userContextTexts = [],
}: {
  displayName: string;
  latestMentionAt: string | null;
  mentionCount: number;
  providerNames: string[];
  relatedTopics: RelatedTopicLike[];
  statuses: HealthStoryStatus[];
  topicSlug: string;
  userContextTexts?: string[];
}) {
  const providerPhrase = providerThread(providerNames);
  const hasFollowUp = statuses.includes("follow_up");
  const hasResolved = statuses.includes("resolved");
  const userContext = userContextSentence(userContextTexts);
  const orthoThread = hasAnyTopic(relatedTopics, [
    "arthritis",
    "imaging",
    "knee_pain",
    "orthopedics",
    "physical_therapy",
  ]);
  const dentalThread = hasTopic(relatedTopics, "dental_oral_health");

  if (topicSlug === "knee_pain") {
    const related = phrasesFor(relatedTopics, [
      "imaging",
      "arthritis",
      "physical_therapy",
      "follow_up",
    ]);
    const relatedText = topicListSentence(related);

    return sentenceJoin([
      relatedText
        ? `Source topics connect this with ${relatedText}`
        : "This looks more like a specific orthopedic concern than a general pain reference",
      hasResolved
        ? "Some source details mark this thread as resolved, though the underlying visits are still available below"
        : "",
      userContext,
    ]);
  }

  if (topicSlug === "physical_therapy") {
    const related = phrasesFor(relatedTopics, [
      "knee_pain",
      "arthritis",
      "imaging",
      "orthopedics",
      "follow_up",
    ]);
    const relatedText = topicListSentence(related);

    return sentenceJoin([
      relatedText
        ? `It sits alongside ${relatedText}`
        : "It seems more like supporting care than a standalone health concern",
      userContext,
    ]);
  }

  if (topicSlug === "dental_oral_health") {
    const related = phrasesFor(relatedTopics, ["pain", "follow_up"]);
    const relatedText = topicListSentence(related);

    return sentenceJoin([
      relatedText
        ? `The saved topics include ${relatedText}`
        : "",
      userContext,
    ]);
  }

  if (topicSlug === "blood_pressure") {
    const related = phrasesFor(relatedTopics, [
      "dizziness",
      "cholesterol",
      "medication_changes",
      "nutrition_weight",
      "anxiety_stress",
      "follow_up",
    ]);
    const relatedText = topicListSentence(related);

    return sentenceJoin([
      relatedText
        ? `It appears alongside ${relatedText}, which may be useful context for future primary care or cardiology conversations`
        : "This looks like health monitoring context rather than only a standalone measurement",
      userContext,
    ]);
  }

  if (topicSlug === "pain") {
    if (orthoThread && dentalThread) {
      return sentenceJoin([
        "Dental care and knee-related care both contribute to this topic",
        "The source topics suggest more than one pain thread rather than one single issue",
        userContext,
      ]);
    }

    if (orthoThread) {
      const related = phrasesFor(relatedTopics, [
        "knee_pain",
        "imaging",
        "arthritis",
        "physical_therapy",
      ]);
      const relatedText = topicListSentence(related);

      return sentenceJoin([
        relatedText
          ? `This looks like a knee-related story involving ${relatedText}`
          : "",
        userContext,
      ]);
    }
  }

  if (topicSlug === "asthma_breathing") {
    const related = phrasesFor(relatedTopics, [
      "blood_pressure",
      "dizziness",
      "medication_changes",
      "follow_up",
    ]);
    const relatedText = topicListSentence(related);

    return sentenceJoin([
      relatedText
        ? `They appear alongside broader monitoring topics like ${relatedText}`
        : "",
      hasFollowUp ? "Follow-up also seems to be part of this thread" : "",
      userContext,
    ]);
  }

  if (topicSlug === "nutrition_weight") {
    const related = phrasesFor(relatedTopics, [
      "blood_pressure",
      "cholesterol",
      "diabetes",
      "lab_results",
      "follow_up",
    ]);
    const relatedText = topicListSentence(related);

    return sentenceJoin([
      relatedText
        ? "This looks more like background health context than one isolated concern"
        : "This looks more like background health context than one isolated concern",
      userContext,
    ]);
  }

  if (topicSlug === "medication_changes") {
    const related = phrasesFor(relatedTopics, [
      "blood_pressure",
      "cholesterol",
      "dizziness",
      "asthma_breathing",
      "follow_up",
    ]);
    const relatedText = topicListSentence(related);

    return sentenceJoin([
      relatedText
        ? `They seem tied to ${relatedText}, with attention to timing, adjustments, or follow-up around other concerns`
        : "The notes point to medication starts, stops, timing, or dose changes",
      userContext,
    ]);
  }

  if (mentionCount <= 1) {
    return sentenceJoin([
      `${displayName} has limited context so far${providerPhrase ? `, ${providerPhrase}` : ""}`,
      "This may be a smaller thread unless it shows up in more visits",
      userContext,
    ]);
  }

  return "";
}

export function healthStoryNarrative({
  displayName,
  latestMentionAt,
  mentionCount,
  providerNames,
  relatedTopics = [],
  statuses,
  topicSlug,
  userContextTexts = [],
}: {
  displayName: string;
  latestMentionAt: string | null;
  mentionCount: number;
  providerNames: string[];
  relatedTopics?: RelatedTopicLike[];
  statuses: HealthStoryStatus[];
  topicSlug: string;
  userContextTexts?: string[];
}) {
  const specificNarrative = specificTopicNarrative({
    displayName,
    latestMentionAt,
    mentionCount,
    providerNames,
    relatedTopics,
    statuses,
    topicSlug,
    userContextTexts,
  });

  if (specificNarrative) {
    return specificNarrative;
  }

  const relatedNames = relatedTopics.map((topic) => topic.displayName);

  return [
    `${displayName} appears in this care history, but the pattern is still broad`,
    providerContextPhrase(providerNames),
    relatedContextPhrase(relatedNames),
    userContextSentence(userContextTexts),
  ]
    .filter(Boolean)
    .join(". ")
    .replace(/\.$/, "") + ".";
}

export function healthFocusCardSummary({
  displayName,
  mentionCount,
  providerNames,
  relatedTopics = [],
  statuses,
  topicSlug,
  userContextTexts = [],
}: {
  displayName: string;
  mentionCount: number;
  providerNames: string[];
  relatedTopics?: RelatedTopicLike[];
  statuses: HealthStoryStatus[];
  topicSlug: string;
  userContextTexts?: string[];
}) {
  const hasFollowUp = statuses.includes("follow_up");
  const providerPhrase = providerThread(providerNames);
  const relatedNames = relatedTopics.map((topic) => topic.displayName);
  const topicSpecific = conciseTopicSummary({
    displayName,
    hasFollowUp,
    providerPhrase,
    relatedTopics,
    topicSlug,
  });
  const fallback = sentenceJoin([
    topicSpecific ||
      `${displayName} appears in this care history${
        providerPhrase ? ` ${providerPhrase}` : ""
      }`,
    !topicSpecific && relatedNames.length > 0
      ? `The clearest related context is ${topicListSentence(
          relatedNames.slice(0, 2)
        )}`
      : "",
    !topicSpecific && mentionCount <= 1
      ? "There is limited saved context so far"
      : "",
    userContextSentence(userContextTexts),
  ]);

  return enforceCardSummaryLength(fallback);
}

function conciseTopicSummary({
  displayName,
  hasFollowUp,
  providerPhrase,
  relatedTopics,
  topicSlug,
}: {
  displayName: string;
  hasFollowUp: boolean;
  providerPhrase: string;
  relatedTopics: RelatedTopicLike[];
  topicSlug: string;
}) {
  const hasRelated = (slugs: string[]) => hasAnyTopic(relatedTopics, slugs);
  const orthoThread = hasRelated([
    "arthritis",
    "imaging",
    "knee_pain",
    "orthopedics",
    "physical_therapy",
  ]);
  const dentalThread = hasTopic(relatedTopics, "dental_oral_health");

  if (topicSlug === "knee_pain") {
    if (hasRelated(["imaging", "arthritis", "physical_therapy", "follow_up"])) {
      return "Knee pain appears to be a clear care thread involving imaging, arthritis, physical therapy, and follow-up care.";
    }

    return "Knee pain appears to be a specific orthopedic care thread rather than a general pain reference.";
  }

  if (topicSlug === "blood_pressure") {
    return "Blood pressure appears to be part of broader health monitoring rather than a standalone concern.";
  }

  if (topicSlug === "physical_therapy") {
    return "Physical therapy appears mainly connected to the knee pain care thread rather than standing alone.";
  }

  if (topicSlug === "dental_oral_health") {
    return "Dental and oral health appears to be its own care thread, separate from orthopedic or general medical topics.";
  }

  if (topicSlug === "pain") {
    if (orthoThread && dentalThread) {
      return "You've discussed both dental pain and knee-related pain. These appear to be separate concerns.";
    }

    if (orthoThread) {
      return "Pain seems mainly tied to the orthopedic part of this history, especially the knee-related thread.";
    }
  }

  if (topicSlug === "asthma_breathing") {
    return "Breathing or asthma-related notes appear as part of broader monitoring and follow-up context.";
  }

  if (topicSlug === "nutrition_weight") {
    return "Nutrition and weight appears to be background health context rather than one isolated concern.";
  }

  if (topicSlug === "medication_changes") {
    return "Medication changes appear to support other care threads, including timing, adjustments, or follow-up.";
  }

  if (hasFollowUp) {
    return `${displayName} appears connected to follow-up care${
      providerPhrase ? ` ${providerPhrase}` : ""
    }.`;
  }

  return "";
}

function enforceCardSummaryLength(summary: string) {
  const normalized = summary.replace(/\s+/g, " ").trim();

  if (normalized.length <= healthFocusCardSummaryHardMax) {
    return normalized;
  }

  const sentences = normalized.match(/[^.!?]+[.!?]/g) ?? [];
  const firstSentence = sentences[0]?.trim();

  if (firstSentence && firstSentence.length <= healthFocusCardSummaryHardMax) {
    return firstSentence;
  }

  const words = normalized.slice(0, healthFocusCardSummaryHardMax + 1).split(" ");
  words.pop();

  return `${words.join(" ").replace(/[,.]$/, "")}.`;
}
