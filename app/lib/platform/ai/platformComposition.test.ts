import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeConsumerCareKnowledge,
  normalizeHouseholdKnowledge,
  resolveKnowledgeConcepts,
} from ".";

describe("AI platform in-memory layer composition", () => {
  it("composes CCKL to HKL to Knowledge Resolution without runtime wiring", () => {
    const observedAt = "2026-07-04T12:00:00.000Z";
    const input = "Ghee hah mentioned MyChart and Mom's pharmacy.";

    const cckl = normalizeConsumerCareKnowledge({
      observedAt,
      text: input,
      useCase: "transcript_interpretation",
    });
    const hkl = normalizeHouseholdKnowledge({
      careCircleId: "care-circle-1",
      careSubjectId: "person-1",
      observedAt,
      text: input,
    });
    const resolution = resolveKnowledgeConcepts({
      concepts: cckl.concepts,
      householdConcepts: hkl.householdConcepts,
      observedAt,
    });

    assert.deepEqual(
      cckl.concepts.map((concept) => concept.conceptId).sort(),
      ["insurance_access.geha", "appointments_portals.mychart"]
        .sort()
    );
    assert.deepEqual(hkl.householdConcepts, []);
    assert.deepEqual(resolution.resolvedConcepts, []);

    assert.equal(cckl.decisionTrace.layer, "consumer_care_knowledge");
    assert.equal(hkl.decisionTrace.layer, "household_knowledge");
    assert.equal(resolution.decisionTrace.layer, "knowledge_resolution");

    assert.equal(cckl.decisionTrace.execution?.policy, "no_write");
    assert.equal(hkl.decisionTrace.execution?.policy, "no_write");
    assert.equal(resolution.decisionTrace.execution?.policy, "no_write");
  });
});
