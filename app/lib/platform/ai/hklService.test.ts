import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeHouseholdKnowledge } from ".";
import type { HouseholdConcept } from "./contracts";

describe("HKL platform service scaffold", () => {
  it("emits an empty HouseholdConcept list with a household_knowledge DecisionTrace", () => {
    const result = normalizeHouseholdKnowledge({
      careCircleId: "care-circle-1",
      careSubjectId: "person-1",
      observedAt: "2026-07-04T12:00:00.000Z",
      text: "Dr. Bob said to call Mom's pharmacy.",
    });

    const householdConcepts: HouseholdConcept[] = result.householdConcepts;

    assert.deepEqual(householdConcepts, []);
    assert.equal(result.decisionTrace.layer, "household_knowledge");
    assert.equal(result.decisionTrace.execution?.policy, "no_write");
    assert.equal(result.decisionTrace.execution?.status, "completed");
    assert.equal(result.decisionTrace.context?.careCircleId, "care-circle-1");
    assert.equal(result.decisionTrace.context?.careSubjectId, "person-1");
    assert.equal(result.decisionTrace.outputSummary, "no_household_concepts");
  });

  it("does not resolve household aliases yet", () => {
    const result = normalizeHouseholdKnowledge({
      observedAt: "2026-07-04T12:00:00.000Z",
      text: "Ask heart doctor about the blue pills.",
    });

    assert.deepEqual(result.householdConcepts, []);
    assert.deepEqual(result.decisionTrace.matchedPhrases, []);
    assert.deepEqual(result.decisionTrace.matchedRules, [
      "hkl.noop_scaffold.v1",
    ]);
    assert.deepEqual(result.decisionTrace.criticalFactors, [
      "Household Knowledge Layer is scaffolded only; no household aliases are resolved yet.",
    ]);
  });
});
