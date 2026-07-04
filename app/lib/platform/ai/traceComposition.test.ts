import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { composePlatformKnowledgeTraces } from ".";
import type { DecisionTrace } from "./contracts";

describe("AI platform trace composition", () => {
  it("retains original trace layers and no_write execution policies", () => {
    const traces = composePlatformKnowledgeTraces({
      consumerCareKnowledge: trace("consumer_care_knowledge"),
      householdKnowledge: trace("household_knowledge"),
      knowledgeResolution: trace("knowledge_resolution"),
    });

    assert.deepEqual(
      traces.map((item) => item.layer),
      [
        "consumer_care_knowledge",
        "household_knowledge",
        "knowledge_resolution",
      ]
    );
    assert.deepEqual(
      traces.map((item) => item.execution?.policy),
      ["no_write", "no_write", "no_write"]
    );
  });

  it("uses deterministic platform layer ordering independent of object key order", () => {
    const traces = composePlatformKnowledgeTraces({
      knowledgeResolution: trace("knowledge_resolution"),
      consumerCareKnowledge: trace("consumer_care_knowledge"),
      householdKnowledge: trace("household_knowledge"),
    });

    assert.deepEqual(
      traces.map((item) => item.layer),
      [
        "consumer_care_knowledge",
        "household_knowledge",
        "knowledge_resolution",
      ]
    );
  });

  it("handles empty trace input safely", () => {
    assert.deepEqual(composePlatformKnowledgeTraces(), []);
    assert.deepEqual(composePlatformKnowledgeTraces({}), []);
  });
});

function trace<TLayer extends PlatformKnowledgeLayer>(
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

type PlatformKnowledgeLayer =
  | "consumer_care_knowledge"
  | "household_knowledge"
  | "knowledge_resolution";
