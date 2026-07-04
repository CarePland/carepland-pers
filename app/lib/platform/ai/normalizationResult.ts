import type {
  Concept,
  DecisionTrace,
  HouseholdConcept,
  ResolvedConcept,
} from "./contracts";

export type PlatformNormalizationResult = {
  concepts: Concept[];
  householdConcepts: HouseholdConcept[];
  resolvedConcepts: ResolvedConcept[];
  traces: DecisionTrace[];
};

export type PlatformNormalizationResultInput = {
  concepts?: Concept[];
  householdConcepts?: HouseholdConcept[];
  resolvedConcepts?: ResolvedConcept[];
  traces?: DecisionTrace[];
};

export function createPlatformNormalizationResult({
  concepts = [],
  householdConcepts = [],
  resolvedConcepts = [],
  traces = [],
}: PlatformNormalizationResultInput = {}): PlatformNormalizationResult {
  return {
    concepts,
    householdConcepts,
    resolvedConcepts,
    traces,
  };
}
