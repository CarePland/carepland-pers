import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateRecommendationCandidates,
  type RecommendationCandidate,
  type RecommendationDecisionTrace,
} from "../../personal/recommendations";
import type {
  DecisionTrace,
  Observation,
  WorkflowSelection,
} from "./contracts";

describe("AI platform contracts", () => {
  it("describes a basic observation without choosing an intent", () => {
    const observation = {
      context: {
        careCircleId: "care-circle-1",
        careSubjectId: "person-1",
        deviceId: "receiver-1",
        surface: "receiver",
      },
      observedAt: "2026-07-04T12:00:00.000Z",
      rawText: "I walked to the mailbox.",
      source: "receiver",
    } satisfies Observation;

    assert.equal(observation.source, "receiver");
  });

  it("maps a recommendation candidate to the platform workflow contract", () => {
    const [candidate] = generateRecommendationCandidates([
      {
        confidence: 0.9,
        evidenceText:
          "Provider asked the family to track home blood pressure readings.",
        sourceId: "note-1",
        sourceTable: "appointment_notes",
        sourceType: "appointment_note",
        text: "Provider asked the family to track home blood pressure readings.",
      },
    ]);

    assert.ok(candidate);

    const workflowSelection = recommendationToWorkflowSelection(candidate);

    assert.equal(workflowSelection.workflow, "recommendations");
    assert.equal(workflowSelection.action, "review_daily_focus_candidate");
    assert.equal(workflowSelection.requiresHumanReview, true);
    assert.equal(workflowSelection.decisionTrace?.layer, "workflow_selection");
  });
});

function recommendationToWorkflowSelection(
  candidate: RecommendationCandidate
): WorkflowSelection<"recommendations", "review_daily_focus_candidate"> {
  return {
    action: "review_daily_focus_candidate",
    confidence: candidate.confidence,
    decisionTrace: recommendationTraceToPlatformTrace(
      candidate.structuredPayload.recommendationTrace
    ),
    executionPolicy: "review_required",
    rationale: candidate.reason,
    requiresHumanReview: true,
    structuredPayload: {
      dedupeKey: candidate.dedupeKey,
      priority: candidate.priority,
      recommendationType: candidate.recommendationType,
    },
    target: {
      id: candidate.sourceId ?? null,
      table: candidate.sourceTable ?? null,
      type: candidate.sourceType,
    },
    workflow: "recommendations",
  };
}

function recommendationTraceToPlatformTrace(
  trace: RecommendationDecisionTrace | undefined
): DecisionTrace<"workflow_selection", "recommendations"> | undefined {
  if (!trace) {
    return undefined;
  }

  return {
    confidence: trace.confidenceDecision.confidence,
    evidence: trace.sourceSummary.map((source) => ({
      sourceId: source.sourceId,
      sourceTable: source.sourceTable,
      sourceType: source.sourceType,
    })),
    execution: {
      policy: "review_required",
      status: "not_started",
    },
    humanReview: {
      reason: "Recommendations remain reviewable candidates in v1.",
      required: true,
    },
    inputSummary: `${trace.evidenceCount} recommendation evidence item(s)`,
    layer: "workflow_selection",
    matchedPhrases: trace.matchedKeywords,
    matchedRules: [trace.generationRule],
    outputSummary: trace.priorityDecision.priority,
    timestamp: "2026-07-04T00:00:00.000Z",
    version: `recommendation_trace_v${trace.version}`,
  };
}
