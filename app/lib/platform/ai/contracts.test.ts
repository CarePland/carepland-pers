import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateRecommendationCandidates,
  type RecommendationCandidate,
  type RecommendationDecisionTrace,
} from "../../personal/recommendations";
import type {
  DecisionTrace,
  InteractionFamily,
  InteractionFamilyClassification,
  MeaningFrame,
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

  it("describes a MeaningFrame between Observation and IntentResult", () => {
    const meaningFrame = {
      ambiguity: "none",
      confidence: 1,
      concepts: [],
      contactReferences: [],
      decisionTraceFragments: [],
      householdReferences: [],
      normalizedText: "I need milk",
      observationId: "obs-1",
      personReferences: [],
      provenance: {
        modality: "typed",
        observedAt: "2026-07-10T12:00:00.000Z",
        observationId: "obs-1",
        source: "receiver",
        surface: "ask_tell",
      },
      temporalReferences: [],
    } satisfies MeaningFrame;

    assert.equal(meaningFrame.normalizedText, "I need milk");
    assert.equal(meaningFrame.provenance.modality, "typed");
  });

  it("describes canonical interaction families as human-purpose classifications", () => {
    const families = [
      "ask",
      "observe",
      "need",
      "communicate",
      "remind",
      "plan",
      "decide",
      "discover",
      "express",
      "escalate",
      "contextual_response",
      "unclear",
    ] satisfies InteractionFamily[];

    const classification = {
      candidateFamilies: [
        { confidence: 0.88, kind: "need" },
        { confidence: 0.42, kind: "communicate", rejectionReason: "No recipient was named." },
      ],
      confidence: 0.88,
      family: "need",
      meaningFrame: {
        ambiguity: "low",
        confidence: 0.9,
        concepts: [],
        contactReferences: [],
        decisionTraceFragments: [],
        householdReferences: [],
        normalizedText: "I need milk",
        observationId: "obs-need-1",
        personReferences: [],
        provenance: {
          modality: "typed",
          observedAt: "2026-07-10T12:00:00.000Z",
          observationId: "obs-need-1",
          source: "receiver",
          surface: "ask_tell",
        },
        temporalReferences: [],
      },
      requiresClarification: false,
      secondaryFamilies: [],
    } satisfies InteractionFamilyClassification<"need" | "communicate">;

    assert.equal(families.length, 12);
    assert.equal(classification.family, "need");
    assert.equal(classification.meaningFrame.normalizedText, "I need milk");
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
