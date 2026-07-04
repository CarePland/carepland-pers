import {
  buildConsumerCareKnowledgeContext,
  type ConsumerCareKnowledgeContext,
  type ConsumerCareKnowledgeEntry,
  type ConsumerCareKnowledgeUseCase,
} from "../../personal/consumerCareKnowledge";
import type { Concept, DecisionTrace } from "./contracts";

export type CcklNormalizationInput = {
  entries?: ConsumerCareKnowledgeEntry[];
  maxEntries?: number;
  observedAt?: string;
  text: string;
  useCase?: ConsumerCareKnowledgeUseCase;
};

export type CcklNormalizationResult = {
  concepts: Concept[];
  decisionTrace: DecisionTrace<"consumer_care_knowledge">;
  existingContext: ConsumerCareKnowledgeContext;
};

export function normalizeConsumerCareKnowledge({
  entries,
  maxEntries,
  observedAt,
  text,
  useCase,
}: CcklNormalizationInput): CcklNormalizationResult {
  const timestamp = observedAt ?? new Date().toISOString();
  const existingContext = buildConsumerCareKnowledgeContext(text, {
    entries,
    maxEntries,
    useCase,
  });
  const concepts = existingContext.matches.map((match): Concept => {
    const normalizedMatch = normalizeMatchedText(match.matchedText);

    return {
      ambiguity: ambiguityForCcklConfidence(match.confidence),
      category: match.entry.category,
      conceptId: match.entry.conceptId,
      confidence: match.confidence,
      displayName: match.entry.canonicalTerm,
      evidence: [
        {
          label: match.entry.canonicalTerm,
          sourceType: "consumer_care_knowledge_seed",
          text: match.matchedText,
          weight: match.confidence,
        },
      ],
      matchedText: match.matchedText,
      normalizedText: normalizedMatch,
      sourceVocabulary: "consumer_care_knowledge",
    };
  });

  return {
    concepts,
    decisionTrace: {
      confidence: concepts.length
        ? Number(
            (
              concepts.reduce((total, concept) => total + concept.confidence, 0) /
              concepts.length
            ).toFixed(3)
          )
        : 0,
      criticalFactors: concepts.length
        ? [
            "Matched existing Consumer Care Knowledge seed entries using current alias/canonical/consumer phrase matching.",
          ]
        : [
            "No Consumer Care Knowledge seed entries matched the supplied text.",
          ],
      evidence: existingContext.matches.map((match) => ({
        label: match.entry.canonicalTerm,
        sourceType: "consumer_care_knowledge_seed",
        text: match.matchedText,
        weight: match.confidence,
      })),
      execution: {
        policy: "no_write",
        status: "completed",
      },
      humanReview: {
        required: false,
      },
      inputSummary: text.replace(/\s+/g, " ").trim().slice(0, 240),
      layer: "consumer_care_knowledge",
      matchedPhrases: existingContext.matches.map((match) => match.matchedText),
      matchedRules: ["cckl.seed_match.v1"],
      outputSummary: concepts.length
        ? concepts.map((concept) => concept.conceptId).join(", ")
        : "no_concepts",
      timestamp,
      version: "cckl_seed_normalizer_v1",
    },
    existingContext,
  };
}

function ambiguityForCcklConfidence(
  confidence: number
): Concept["ambiguity"] {
  if (confidence >= 0.9) {
    return "none";
  }

  if (confidence >= 0.8) {
    return "medium";
  }

  return "high";
}

function normalizeMatchedText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
