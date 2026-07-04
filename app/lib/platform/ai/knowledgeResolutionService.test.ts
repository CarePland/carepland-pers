import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveKnowledgeConcepts } from ".";
import type { Concept, HouseholdConcept, ResolvedConcept } from "./contracts";

describe("Knowledge Resolution platform service scaffold", () => {
  it("returns empty resolved concepts for empty input", () => {
    const result = resolveKnowledgeConcepts({
      observedAt: "2026-07-04T12:00:00.000Z",
    });

    const resolvedConcepts: ResolvedConcept[] = result.resolvedConcepts;

    assert.deepEqual(resolvedConcepts, []);
    assert.equal(result.decisionTrace.layer, "knowledge_resolution");
    assert.equal(result.decisionTrace.execution?.policy, "no_write");
    assert.equal(result.decisionTrace.execution?.status, "completed");
    assert.equal(result.decisionTrace.context?.conceptCount, 0);
    assert.equal(result.decisionTrace.context?.householdConceptCount, 0);
    assert.equal(result.decisionTrace.outputSummary, "no_resolved_concepts");
  });

  it("does not resolve household meaning from CCKL-only input", () => {
    const result = resolveKnowledgeConcepts({
      concepts: [consumerConcept()],
      observedAt: "2026-07-04T12:00:00.000Z",
    });

    assert.deepEqual(result.resolvedConcepts, []);
    assert.equal(result.decisionTrace.context?.conceptCount, 1);
    assert.equal(result.decisionTrace.context?.householdConceptCount, 0);
    assert.deepEqual(result.decisionTrace.matchedRules, [
      "knowledge_resolution.noop_scaffold.v1",
    ]);
  });

  it("does not resolve consumer-care meaning from HKL-only input", () => {
    const result = resolveKnowledgeConcepts({
      householdConcepts: [householdConcept()],
      observedAt: "2026-07-04T12:00:00.000Z",
    });

    assert.deepEqual(result.resolvedConcepts, []);
    assert.equal(result.decisionTrace.context?.conceptCount, 0);
    assert.equal(result.decisionTrace.context?.householdConceptCount, 1);
    assert.deepEqual(result.decisionTrace.criticalFactors, [
      "Knowledge Resolution is scaffolded only; consumer and household concepts are not merged yet.",
    ]);
  });

  it("performs no resolution for mixed CCKL and HKL input yet", () => {
    const result = resolveKnowledgeConcepts({
      concepts: [consumerConcept()],
      householdConcepts: [householdConcept()],
      observedAt: "2026-07-04T12:00:00.000Z",
    });

    assert.deepEqual(result.resolvedConcepts, []);
    assert.equal(result.decisionTrace.context?.conceptCount, 1);
    assert.equal(result.decisionTrace.context?.householdConceptCount, 1);
    assert.deepEqual(result.decisionTrace.matchedPhrases, []);
    assert.equal(result.decisionTrace.outputSummary, "no_resolved_concepts");
  });
});

function consumerConcept(): Concept {
  return {
    ambiguity: "none",
    conceptId: "appointments_portals.mychart",
    confidence: 0.95,
    displayName: "MyChart",
    matchedText: "my chart",
    sourceVocabulary: "consumer_care_knowledge",
  };
}

function householdConcept(): HouseholdConcept {
  return {
    aliases: ["heart doctor"],
    careCircleId: "care-circle-1",
    careSubjectId: "person-1",
    confidence: 0.9,
    displayName: "Dr. Cardiology",
    householdConceptId: "household-provider-1",
    linkedConceptId: null,
    resolutionStatus: "unresolved",
  };
}
