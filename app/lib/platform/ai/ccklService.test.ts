import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildConsumerCareKnowledgeContext } from "../../personal/consumerCareKnowledge";
import { normalizeConsumerCareKnowledge } from ".";

describe("CCKL platform service", () => {
  it("normalizes GEHA from phonetic ghee-hah text", () => {
    const result = normalizeConsumerCareKnowledge({
      observedAt: "2026-07-04T12:00:00.000Z",
      text: "Ghee hah said the specialist is in network.",
      useCase: "transcript_interpretation",
    });

    assert.deepEqual(
      result.concepts.map((concept) => concept.conceptId),
      ["insurance_access.geha"]
    );
    assert.equal(result.concepts[0]?.displayName, "G.E.H.A");
    assert.equal(result.concepts[0]?.matchedText, "ghee hah");
    assert.equal(result.concepts[0]?.ambiguity, "medium");
    assert.equal(result.decisionTrace.layer, "consumer_care_knowledge");
    assert.equal(result.decisionTrace.execution?.policy, "no_write");
    assert.deepEqual(result.decisionTrace.matchedPhrases, ["ghee hah"]);
  });

  it("preserves existing prompt context output", () => {
    const input = {
      maxEntries: 2,
      text: "She uses GoodRx and sent a message in MyChart.",
      useCase: "user_question" as const,
    };
    const existing = buildConsumerCareKnowledgeContext(input.text, {
      maxEntries: input.maxEntries,
      useCase: input.useCase,
    });
    const platform = normalizeConsumerCareKnowledge({
      ...input,
      observedAt: "2026-07-04T12:00:00.000Z",
    });

    assert.equal(platform.existingContext.promptContext, existing.promptContext);
    assert.deepEqual(platform.existingContext.conceptIds, existing.conceptIds);
    assert.deepEqual(platform.existingContext.matchedTerms, existing.matchedTerms);
  });

  it("emits Concept entries that match existing helper matches", () => {
    const text = "PillPack, GoodRx, and MyChart were discussed.";
    const existing = buildConsumerCareKnowledgeContext(text, {
      useCase: "admin_review",
    });
    const platform = normalizeConsumerCareKnowledge({
      observedAt: "2026-07-04T12:00:00.000Z",
      text,
      useCase: "admin_review",
    });

    assert.deepEqual(
      platform.concepts.map((concept) => ({
        conceptId: concept.conceptId,
        confidence: concept.confidence,
        displayName: concept.displayName,
        matchedText: concept.matchedText,
      })),
      existing.matches.map((match) => ({
        conceptId: match.entry.conceptId,
        confidence: match.confidence,
        displayName: match.entry.canonicalTerm,
        matchedText: match.matchedText,
      }))
    );
  });

  it("normalizes PillPack from pill pack text", () => {
    const result = normalizeConsumerCareKnowledge({
      observedAt: "2026-07-04T12:00:00.000Z",
      text: "The pill pack was late this month.",
    });

    assert.equal(result.concepts[0]?.conceptId, "medication_adherence.pillpack");
    assert.equal(result.concepts[0]?.displayName, "PillPack");
    assert.equal(result.concepts[0]?.matchedText, "pill pack");
    assert.equal(result.decisionTrace.outputSummary, "medication_adherence.pillpack");
  });

  it("normalizes MyChart from my chart text", () => {
    const result = normalizeConsumerCareKnowledge({
      observedAt: "2026-07-04T12:00:00.000Z",
      text: "The test result is in my chart.",
    });

    assert.equal(result.concepts[0]?.conceptId, "appointments_portals.mychart");
    assert.equal(result.concepts[0]?.displayName, "MyChart");
    assert.equal(result.concepts[0]?.matchedText, "my chart");
  });

  it("normalizes GoodRx from supported good rx text", () => {
    const result = normalizeConsumerCareKnowledge({
      observedAt: "2026-07-04T12:00:00.000Z",
      text: "She used good rx for the refill.",
    });

    assert.equal(result.concepts[0]?.conceptId, "medication_access.goodrx");
    assert.equal(result.concepts[0]?.displayName, "GoodRx");
    assert.equal(result.concepts[0]?.matchedText, "good rx");
  });

  it("documents the unsupported GoodRx phonetic gap without adding a new alias", () => {
    const result = normalizeConsumerCareKnowledge({
      observedAt: "2026-07-04T12:00:00.000Z",
      text: "She used good are ex for the refill.",
    });

    assert.deepEqual(result.concepts, []);
    assert.equal(result.decisionTrace.outputSummary, "no_concepts");
    assert.deepEqual(result.decisionTrace.criticalFactors, [
      "No Consumer Care Knowledge seed entries matched the supplied text.",
    ]);
  });

  it("preserves existing bounded context behavior for use-case wrappers", () => {
    const result = normalizeConsumerCareKnowledge({
      maxEntries: 1,
      observedAt: "2026-07-04T12:00:00.000Z",
      text: "GoodRx and MyChart were both mentioned.",
      useCase: "user_question",
    });

    assert.equal(result.concepts.length, 1);
    assert.equal(result.existingContext.matches.length, 1);
    assert.match(result.existingContext.promptContext, /user question/);
  });
});
