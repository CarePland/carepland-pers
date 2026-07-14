import type { ConnectMessageRecord } from "@/app/lib/connect/messaging";

export const homeMessageSummaryModelVersion = "deterministic_v1";

export type HomeMessageSummaryMessage = Pick<
  ConnectMessageRecord,
  "body" | "createdAt" | "id" | "transcript"
>;

export type HomeMessageSummaryPersonInput = {
  messages: HomeMessageSummaryMessage[];
  personId: string;
  personName: string;
};

export type HomeMessageSummaryKeyPoint = {
  normalizedMeaning: string;
  sourceMessageIds: string[];
  summaryText: string;
  topic: string;
};

export type HomeMessageIndividualSummary = {
  keyPoints: HomeMessageSummaryKeyPoint[];
  personId: string;
  personName: string;
  sourceMessageIds: string[];
  summary: string;
};

export type HomeMessageEveryoneReinforcedTopic = {
  normalizedMeaning: string;
  personIds: string[];
  sourceMessageIds: string[];
  topic: string;
};

export type HomeMessageEveryoneSummary = {
  reinforcedTopics: HomeMessageEveryoneReinforcedTopic[];
  summary: string;
  uniqueSupportingPoint: {
    personId: string;
    sourceMessageIds: string[];
    text: string;
  } | null;
};

export type HomeMessageSummaryDecisionTrace = {
  layer: "home_message_summary";
  matchedRules: string[];
  omittedEveryoneSummaryReason?: string;
  rationale: string;
  sourceMessageIds: string[];
  version: string;
};

export type HomeMessageSummaryResult = {
  decisionTrace: HomeMessageSummaryDecisionTrace;
  everyoneSummary: HomeMessageEveryoneSummary | null;
  individualSummaries: HomeMessageIndividualSummary[];
};

type ExtractedPoint = HomeMessageSummaryKeyPoint & {
  everyoneText: string;
  matchedRule: string;
  supportText: string;
  weight: number;
};

const trivialMessagePattern =
  /^(?:ok|okay|k|kk|thanks|thank you|thx|got it|sounds good|will do|yes|yep|no problem|sure)\.?$/i;

const pointRules: Array<{
  everyoneText: string;
  matchedRule: string;
  normalizedMeaning: string;
  pattern: RegExp;
  summaryText: (text: string) => string;
  supportText: string;
  topic: string;
  weight: number;
}> = [
  {
    everyoneText: "your eyes will be dilated",
    matchedRule: "eye_dilation",
    normalizedMeaning: "eye appointment includes pupil dilation",
    pattern: /\b(?:eyes?|pupils?)\b.{0,48}\bdilat(?:e|ed|ing|ion)\b|\bdilat(?:e|ed|ing|ion)\b.{0,48}\b(?:eyes?|pupils?)\b/i,
    summaryText: () => "Your eyes will be dilated.",
    supportText: "your eyes will be dilated",
    topic: "eye_dilation",
    weight: 90,
  },
  {
    everyoneText: "glasses or vision prescription should be brought",
    matchedRule: "bring_eyewear",
    normalizedMeaning: "bring glasses sunglasses or vision prescription",
    pattern: /\b(?:bring|take|pack|carry|remember)\b.{0,80}\b(?:glasses|eyeglasses|spectacles|sunglasses|vision prescription|prescription|rx)\b/i,
    summaryText: eyewearSummaryText,
    supportText: "bringing glasses, sunglasses, or vision prescription",
    topic: "bring_eyewear",
    weight: 80,
  },
  {
    everyoneText: "a ride home should be arranged",
    matchedRule: "arrange_ride_home",
    normalizedMeaning: "arrange a ride home",
    pattern: /\b(?:arrange|plan|need|have|ask|recommend|recommended|should)\b.{0,80}\b(?:ride|driver|drive home|take you home|bring you home)\b|\bride home\b/i,
    summaryText: () => "Arrange a ride home.",
    supportText: "arranging a ride home",
    topic: "ride_home",
    weight: 85,
  },
  {
    everyoneText: "insurance card or photo ID should be brought",
    matchedRule: "bring_insurance_or_id",
    normalizedMeaning: "bring insurance card or photo id",
    pattern: /\b(?:bring|take|pack|carry|remember)\b.{0,80}\b(?:insurance|photo id|id card|identification)\b/i,
    summaryText: insuranceSummaryText,
    supportText: "bringing insurance card or photo ID",
    topic: "bring_insurance_or_id",
    weight: 75,
  },
  {
    everyoneText: "a current medication list should be brought",
    matchedRule: "bring_medication_list",
    normalizedMeaning: "bring current medication list",
    pattern: /\b(?:bring|take|pack|carry|remember)\b.{0,80}\b(?:medication list|medicine list|med list|prescription list|current meds)\b/i,
    summaryText: () => "Bring your current medication list.",
    supportText: "bringing the current medication list",
    topic: "bring_medication_list",
    weight: 75,
  },
  {
    everyoneText: "exercise plan papers should be brought",
    matchedRule: "bring_exercise_plan_papers",
    normalizedMeaning: "bring exercise plan papers",
    pattern: /\b(?:bring|take|pack|carry|remember)\b.{0,80}\b(?:exercise plan|exercise papers|plan papers|exercise paperwork|therapy plan)\b/i,
    summaryText: () => "Bring exercise plan papers.",
    supportText: "bringing exercise plan papers",
    topic: "bring_exercise_plan_papers",
    weight: 70,
  },
  {
    everyoneText: "fasting is needed before the appointment",
    matchedRule: "fasting_instruction",
    normalizedMeaning: "fast before appointment",
    pattern: /\b(?:fast|fasting|nothing to eat|do not eat|don't eat)\b/i,
    summaryText: () => "Follow the fasting instructions before the appointment.",
    supportText: "following the fasting instructions",
    topic: "fasting_instruction",
    weight: 80,
  },
  {
    everyoneText: "a follow-up call or scheduling step is needed",
    matchedRule: "follow_up_action",
    normalizedMeaning: "follow up call or scheduling needed",
    pattern: /\b(?:follow up|call|schedule|reschedule|confirm)\b.{0,80}\b(?:office|appointment|portal|doctor|clinic)\b/i,
    summaryText: followUpSummaryText,
    supportText: "following up",
    topic: "follow_up_action",
    weight: 65,
  },
];

export function buildHomeMessageSummary(
  people: HomeMessageSummaryPersonInput[]
): HomeMessageSummaryResult {
  const matchedRules = new Set<string>();
  const sourceMessageIds = new Set<string>();
  const individualSummaries = people
    .map((person) => {
      const keyPointMap = new Map<string, ExtractedPoint>();

      for (const message of sortMessagesOldestFirst(person.messages)) {
        const messageText = messageTextForHomeSummary(message);
        if (!messageText || trivialMessagePattern.test(messageText)) continue;
        sourceMessageIds.add(message.id);

        for (const point of extractPoints(messageText)) {
          matchedRules.add(point.matchedRule);
          const existing = keyPointMap.get(point.normalizedMeaning);
          const nextSourceIds = Array.from(
            new Set([...(existing?.sourceMessageIds ?? []), message.id])
          );
          const nextPoint =
            existing && existing.weight > point.weight
              ? existing
              : existing && existing.weight === point.weight
                ? chooseRicherPoint(existing, point)
                : point;
          keyPointMap.set(point.normalizedMeaning, {
            ...nextPoint,
            sourceMessageIds: nextSourceIds,
          });
        }
      }

      const keyPoints = Array.from(keyPointMap.values()).sort(comparePoints);
      return {
        keyPoints: keyPoints.map(stripInternalPointFields),
        personId: person.personId,
        personName: person.personName,
        sourceMessageIds: Array.from(
          new Set(keyPoints.flatMap((point) => point.sourceMessageIds))
        ),
        summary: joinSummarySentences(keyPoints.map((point) => point.summaryText)),
      } satisfies HomeMessageIndividualSummary;
    })
    .filter((summary) => summary.summary);

  const everyoneSummary = buildEveryoneSummary(people, individualSummaries);
  return {
    decisionTrace: {
      layer: "home_message_summary",
      matchedRules: Array.from(matchedRules).sort(),
      omittedEveryoneSummaryReason: everyoneSummary
        ? undefined
        : everyoneOmissionReason(individualSummaries),
      rationale:
        "Recent durable Connect messages were grouped by person, normalized into concrete communication points, and compared across people for independently reinforced meaning.",
      sourceMessageIds: Array.from(sourceMessageIds),
      version: homeMessageSummaryModelVersion,
    },
    everyoneSummary,
    individualSummaries,
  };
}

function buildEveryoneSummary(
  people: HomeMessageSummaryPersonInput[],
  individualSummaries: HomeMessageIndividualSummary[]
): HomeMessageEveryoneSummary | null {
  const personNames = new Map(people.map((person) => [person.personId, person.personName]));
  const reinforcedTopics = new Map<string, HomeMessageEveryoneReinforcedTopic>();
  const pointInternals = new Map<string, ExtractedPoint>();

  for (const person of people) {
    for (const message of person.messages) {
      for (const point of extractPoints(messageTextForHomeSummary(message))) {
        pointInternals.set(point.normalizedMeaning, point);
      }
    }
  }

  for (const individual of individualSummaries) {
    for (const point of individual.keyPoints) {
      const existing = reinforcedTopics.get(point.normalizedMeaning) ?? {
        normalizedMeaning: point.normalizedMeaning,
        personIds: [],
        sourceMessageIds: [],
        topic: point.topic,
      };
      existing.personIds = Array.from(new Set([...existing.personIds, individual.personId]));
      existing.sourceMessageIds = Array.from(
        new Set([...existing.sourceMessageIds, ...point.sourceMessageIds])
      );
      reinforcedTopics.set(point.normalizedMeaning, existing);
    }
  }

  const reinforced = Array.from(reinforcedTopics.values())
    .filter((topic) => topic.personIds.length >= 2)
    .sort((a, b) => {
      const aWeight = pointInternals.get(a.normalizedMeaning)?.weight ?? 0;
      const bWeight = pointInternals.get(b.normalizedMeaning)?.weight ?? 0;
      return bWeight - aWeight || a.topic.localeCompare(b.topic);
    });

  if (reinforced.length === 0) return null;

  const primary = reinforced[0];
  const primaryPoint = pointInternals.get(primary.normalizedMeaning);
  const uniqueSupportingPoint = findUniqueSupportingPoint({
    individualSummaries,
    pointInternals,
    reinforcedMeaning: primary.normalizedMeaning,
  });
  const supportingText = uniqueSupportingPoint
    ? `${firstName(personNames.get(uniqueSupportingPoint.personId)) || "Someone"} also recommended ${uniqueSupportingPoint.text}.`
    : "";

  return {
    reinforcedTopics: reinforced,
    summary: joinSummarySentences([
      `More than one person mentioned that ${primaryPoint?.everyoneText ?? primary.topic}.`,
      supportingText,
    ]),
    uniqueSupportingPoint: uniqueSupportingPoint
      ? {
          personId: uniqueSupportingPoint.personId,
          sourceMessageIds: uniqueSupportingPoint.sourceMessageIds,
          text: uniqueSupportingPoint.text,
        }
      : null,
  };
}

function findUniqueSupportingPoint({
  individualSummaries,
  pointInternals,
  reinforcedMeaning,
}: {
  individualSummaries: HomeMessageIndividualSummary[];
  pointInternals: Map<string, ExtractedPoint>;
  reinforcedMeaning: string;
}) {
  const candidates = individualSummaries.flatMap((summary) =>
    summary.keyPoints
      .filter((point) => point.normalizedMeaning !== reinforcedMeaning)
      .map((point) => ({
        personId: summary.personId,
        point,
        sourceMessageIds: point.sourceMessageIds,
        supportText: pointInternals.get(point.normalizedMeaning)?.supportText ?? "",
        weight: pointInternals.get(point.normalizedMeaning)?.weight ?? 0,
      }))
  );
  const uniqueCandidates = candidates.filter((candidate) => {
    const personCount = individualSummaries.filter((summary) =>
      summary.keyPoints.some(
        (point) => point.normalizedMeaning === candidate.point.normalizedMeaning
      )
    ).length;
    return personCount === 1 && candidate.supportText;
  });
  uniqueCandidates.sort((a, b) => b.weight - a.weight);
  const selected = uniqueCandidates[0];
  return selected
    ? {
        personId: selected.personId,
        sourceMessageIds: selected.sourceMessageIds,
        text: selected.supportText,
      }
    : null;
}

function chooseRicherPoint(existing: ExtractedPoint, candidate: ExtractedPoint) {
  if (
    existing.normalizedMeaning === "bring glasses sunglasses or vision prescription" &&
    candidate.normalizedMeaning === existing.normalizedMeaning
  ) {
    return {
      ...candidate,
      summaryText: eyewearSummaryText(`${existing.summaryText} ${candidate.summaryText}`),
    };
  }

  return cleanText(candidate.summaryText).length > cleanText(existing.summaryText).length
    ? candidate
    : existing;
}

function extractPoints(messageText: string): ExtractedPoint[] {
  const cleaned = cleanText(messageText);
  if (!cleaned) return [];

  return pointRules
    .filter((rule) => rule.pattern.test(cleaned))
    .map((rule) => ({
      everyoneText: rule.everyoneText,
      matchedRule: rule.matchedRule,
      normalizedMeaning: rule.normalizedMeaning,
      sourceMessageIds: [],
      summaryText: rule.summaryText(cleaned),
      supportText: rule.supportText,
      topic: rule.topic,
      weight: rule.weight,
    }))
    .filter((point) => point.summaryText);
}

function messageTextForHomeSummary(message: HomeMessageSummaryMessage) {
  return cleanText(message.body || message.transcript);
}

function sortMessagesOldestFirst(messages: HomeMessageSummaryMessage[]) {
  return [...messages].sort((a, b) => {
    const aTime = Date.parse(a.createdAt || "");
    const bTime = Date.parse(b.createdAt || "");
    return (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
  });
}

function comparePoints(a: HomeMessageSummaryKeyPoint, b: HomeMessageSummaryKeyPoint) {
  const aRule = pointRules.find((rule) => rule.normalizedMeaning === a.normalizedMeaning);
  const bRule = pointRules.find((rule) => rule.normalizedMeaning === b.normalizedMeaning);
  return (bRule?.weight ?? 0) - (aRule?.weight ?? 0) || a.topic.localeCompare(b.topic);
}

function stripInternalPointFields(point: ExtractedPoint): HomeMessageSummaryKeyPoint {
  return {
    normalizedMeaning: point.normalizedMeaning,
    sourceMessageIds: point.sourceMessageIds,
    summaryText: point.summaryText,
    topic: point.topic,
  };
}

function eyewearSummaryText(text: string) {
  const normalized = text.toLowerCase();
  const hasGlasses = /\b(glasses|eyeglasses|spectacles)\b/.test(normalized);
  const hasSunglasses = /\bsunglasses\b/.test(normalized);
  const hasPrescription = /\b(vision prescription|prescription|rx)\b/.test(normalized);

  if (hasGlasses && hasSunglasses && hasPrescription) {
    return "Bring prescription glasses and sunglasses.";
  }
  if (hasGlasses && hasSunglasses) return "Bring glasses and sunglasses.";
  if (hasSunglasses && hasPrescription) return "Bring prescription sunglasses.";
  if (hasSunglasses) return "Bring sunglasses.";
  if (hasGlasses && hasPrescription) return "Bring your glasses and vision prescription.";
  if (hasPrescription) return "Bring your vision prescription.";
  return "Bring your glasses.";
}

function insuranceSummaryText(text: string) {
  const normalized = text.toLowerCase();
  const hasInsurance = /\binsurance\b/.test(normalized);
  const hasId = /\b(photo id|id card|identification)\b/.test(normalized);

  if (hasInsurance && hasId) return "Bring your insurance card and photo ID.";
  if (hasInsurance) return "Bring your insurance card.";
  return "Bring your photo ID.";
}

function followUpSummaryText(text: string) {
  const cleaned = cleanText(text);
  if (/^follow up/i.test(cleaned)) return sentenceCase(cleaned);
  if (/^call/i.test(cleaned)) return sentenceCase(cleaned);
  return "Follow up on the scheduling or portal step.";
}

function joinSummarySentences(sentences: string[]) {
  return sentences.map(cleanText).filter(Boolean).join(" ");
}

function sentenceCase(value: string) {
  const cleaned = cleanText(value);
  if (!cleaned) return "";
  const withPeriod = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  return `${withPeriod.charAt(0).toUpperCase()}${withPeriod.slice(1)}`;
}

function everyoneOmissionReason(individualSummaries: HomeMessageIndividualSummary[]) {
  if (individualSummaries.length < 2) {
    return "fewer_than_two_people_with_summaries";
  }

  return "no_concrete_meaning_reinforced_by_multiple_people";
}

function firstName(value: unknown) {
  return cleanText(value)
    .replace(/\([^)]*\)/g, "")
    .split(" ")[0] ?? "";
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
