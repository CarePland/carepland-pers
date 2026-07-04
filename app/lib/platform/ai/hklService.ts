import type { DecisionTrace, HouseholdConcept } from "./contracts";

export type HklNormalizationInput = {
  careCircleId?: string | null;
  careSubjectId?: string | null;
  observedAt?: string;
  text?: string;
};

export type HklNormalizationResult = {
  decisionTrace: DecisionTrace<"household_knowledge">;
  householdConcepts: HouseholdConcept[];
};

export function normalizeHouseholdKnowledge({
  careCircleId,
  careSubjectId,
  observedAt,
  text = "",
}: HklNormalizationInput = {}): HklNormalizationResult {
  const inputSummary = text.replace(/\s+/g, " ").trim().slice(0, 240);

  return {
    decisionTrace: {
      confidence: 0,
      context: {
        ...(careCircleId ? { careCircleId } : {}),
        ...(careSubjectId ? { careSubjectId } : {}),
      },
      criticalFactors: [
        "Household Knowledge Layer is scaffolded only; no household aliases are resolved yet.",
      ],
      evidence: [],
      execution: {
        policy: "no_write",
        status: "completed",
      },
      humanReview: {
        required: false,
      },
      inputSummary: inputSummary || "no_input",
      layer: "household_knowledge",
      matchedPhrases: [],
      matchedRules: ["hkl.noop_scaffold.v1"],
      outputSummary: "no_household_concepts",
      timestamp: observedAt ?? new Date().toISOString(),
      version: "hkl_noop_scaffold_v1",
    },
    householdConcepts: [],
  };
}
