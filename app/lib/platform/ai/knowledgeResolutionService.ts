import type {
  Concept,
  DecisionTrace,
  HouseholdConcept,
  ResolvedConcept,
} from "./contracts";

export type KnowledgeResolutionInput = {
  concepts?: Concept[];
  householdConcepts?: HouseholdConcept[];
  observedAt?: string;
};

export type KnowledgeResolutionResult = {
  decisionTrace: DecisionTrace<"knowledge_resolution">;
  resolvedConcepts: ResolvedConcept[];
};

export function resolveKnowledgeConcepts({
  concepts = [],
  householdConcepts = [],
  observedAt,
}: KnowledgeResolutionInput = {}): KnowledgeResolutionResult {
  return {
    decisionTrace: {
      confidence: 0,
      context: {
        conceptCount: concepts.length,
        householdConceptCount: householdConcepts.length,
      },
      criticalFactors: [
        "Knowledge Resolution is scaffolded only; consumer and household concepts are not merged yet.",
      ],
      evidence: [],
      execution: {
        policy: "no_write",
        status: "completed",
      },
      humanReview: {
        required: false,
      },
      inputSummary: `${concepts.length} consumer concept(s), ${householdConcepts.length} household concept(s)`,
      layer: "knowledge_resolution",
      matchedPhrases: [],
      matchedRules: ["knowledge_resolution.noop_scaffold.v1"],
      outputSummary: "no_resolved_concepts",
      timestamp: observedAt ?? new Date().toISOString(),
      version: "knowledge_resolution_noop_scaffold_v1",
    },
    resolvedConcepts: [],
  };
}
