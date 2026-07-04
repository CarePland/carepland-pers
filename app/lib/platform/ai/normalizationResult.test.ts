import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPlatformNormalizationResult } from ".";
import type {
  Concept,
  DecisionTrace,
  HouseholdConcept,
  ResolvedConcept,
} from "./contracts";

describe("AI platform normalization result container", () => {
  it("preserves supplied concepts", () => {
    const concepts = [consumerConcept()];
    const result = createPlatformNormalizationResult({ concepts });

    assert.strictEqual(result.concepts, concepts);
    assert.deepEqual(result.concepts, concepts);
  });

  it("preserves supplied householdConcepts", () => {
    const householdConcepts = [householdConcept()];
    const result = createPlatformNormalizationResult({ householdConcepts });

    assert.strictEqual(result.householdConcepts, householdConcepts);
    assert.deepEqual(result.householdConcepts, householdConcepts);
  });

  it("preserves supplied resolvedConcepts", () => {
    const resolvedConcepts = [resolvedConcept()];
    const result = createPlatformNormalizationResult({ resolvedConcepts });

    assert.strictEqual(result.resolvedConcepts, resolvedConcepts);
    assert.deepEqual(result.resolvedConcepts, resolvedConcepts);
  });

  it("preserves trace ordering", () => {
    const traces = [
      trace("consumer_care_knowledge"),
      trace("household_knowledge"),
      trace("knowledge_resolution"),
    ];
    const result = createPlatformNormalizationResult({ traces });

    assert.strictEqual(result.traces, traces);
    assert.deepEqual(
      result.traces.map((item) => item.layer),
      [
        "consumer_care_knowledge",
        "household_knowledge",
        "knowledge_resolution",
      ]
    );
  });

  it("returns a safe empty default result", () => {
    assert.deepEqual(createPlatformNormalizationResult(), {
      concepts: [],
      householdConcepts: [],
      resolvedConcepts: [],
      traces: [],
    });
  });
});

function consumerConcept(): Concept {
  return {
    ambiguity: "none",
    conceptId: "appointments_portals.mychart",
    confidence: 0.95,
    displayName: "MyChart",
    sourceVocabulary: "consumer_care_knowledge",
  };
}

function householdConcept(): HouseholdConcept {
  return {
    careCircleId: "care-circle-1",
    confidence: 0.8,
    displayName: "Dr. Bob",
    householdConceptId: "household-provider-1",
    resolutionStatus: "unresolved",
  };
}

function resolvedConcept(): ResolvedConcept {
  return {
    ambiguity: "none",
    conceptId: "appointments_portals.mychart",
    confidence: 0.95,
    resolution: "universal_only",
    resolvedConceptId: "resolved-1",
    universalConcept: consumerConcept(),
  };
}

function trace<TLayer extends DecisionTrace["layer"]>(
  layer: TLayer
): DecisionTrace<TLayer> {
  return {
    confidence: 0,
    execution: {
      policy: "no_write",
      status: "completed",
    },
    inputSummary: `${layer} input`,
    layer,
    outputSummary: `${layer} output`,
    timestamp: "2026-07-04T12:00:00.000Z",
    version: `${layer}_test_v1`,
  };
}
