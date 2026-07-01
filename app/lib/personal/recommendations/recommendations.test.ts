import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateRecommendationCandidates,
  recommendationEvidenceHash,
  recommendationPriorityFromEvidence,
} from ".";
import {
  buildFocusItemDraftFromRecommendation,
  focusItemRankingDecisionFromRecommendation,
  recommendationStatusForReviewAction,
} from "./focusConversion";
import { buildRecommendationInputSources } from "./sources";

describe("recommendations foundation", () => {
  it("generates blood pressure candidates from provider and CarePrep evidence", () => {
    const [candidate] = generateRecommendationCandidates([
      {
        confidence: 0.9,
        evidenceText: "Track home blood pressure readings before the next visit.",
        sourceId: "note-1",
        sourceLabel: "Primary care note",
        sourceTable: "appointment_notes",
        sourceType: "appointment_note",
        text: "Track home blood pressure readings before the next visit.",
      },
      {
        confidence: 0.85,
        evidenceText: "Bring any home blood pressure readings to the visit.",
        sourceId: "careprep-1",
        sourceLabel: "Cardiology CarePrep",
        sourceTable: "careprep_guidance",
        sourceType: "careprep_guidance",
        text: "Bring any home blood pressure readings to the visit.",
      },
    ]);

    assert.equal(candidate?.title, "Track home blood pressure readings");
    assert.equal(candidate?.dedupeKey, "home_blood_pressure_monitoring");
    assert.equal(candidate?.priority, "high");
    assert.equal(candidate?.structuredPayload.completionType, "measured_value");
    assert.equal(candidate?.structuredPayload.completionEventType, "measurement.blood_pressure");
    assert.equal(candidate?.evidence.length, 2);
    assert.equal(
      candidate?.structuredPayload.recommendationTrace?.generationRule,
      "home_blood_pressure_monitoring"
    );
    assert.deepEqual(
      candidate?.structuredPayload.recommendationTrace?.matchedKeywords,
      ["track home blood pressure", "home blood pressure"]
    );
    assert.match(
      candidate?.structuredPayload.recommendationTrace?.priorityDecision.rationale ?? "",
      /provider note or CarePrep/i
    );
    assert.equal(
      candidate?.structuredPayload.recommendationTrace?.sourceTypeCounts.appointment_note,
      1
    );
    assert.equal(
      candidate?.structuredPayload.recommendationTrace?.sourceTypeCounts.careprep_guidance,
      1
    );
  });

  it("keeps medication timing as a note candidate instead of an instruction", () => {
    const [candidate] = generateRecommendationCandidates([
      {
        evidenceText: "Medication timing may matter for dizziness.",
        sourceTable: "appointment_notes",
        sourceType: "appointment_note",
        text: "Medication timing may matter for dizziness.",
      },
    ]);

    assert.equal(candidate?.title, "Review medication timing notes");
    assert.equal(candidate?.structuredPayload.completionType, "note_required");
    assert.equal(candidate?.structuredPayload.completionEventType, "note.caregiver");
  });

  it("uses evidence wording for critical priority and does not infer it otherwise", () => {
    assert.equal(
      recommendationPriorityFromEvidence([
        {
          evidenceText: "Physical therapist recommended daily walking.",
          sourceType: "caregiver_goal",
        },
      ]),
      "normal"
    );

    assert.equal(
      recommendationPriorityFromEvidence([
        {
          evidenceText: "Urgent provider instruction was documented.",
          sourceType: "appointment_note",
        },
      ]),
      "critical"
    );
  });

  it("generates walking and weight examples from project-style sample data", () => {
    const candidates = generateRecommendationCandidates([
      {
        evidenceText: "Walking tolerance and balance were reviewed in PT.",
        sourceTable: "topic_mentions",
        sourceType: "health_focus",
        text: "Walking tolerance and balance were reviewed in PT.",
      },
      {
        evidenceText: "Nutrition and weight were reviewed with cholesterol labs.",
        sourceTable: "appointment_notes",
        sourceType: "appointment_note",
        text: "Nutrition and weight were reviewed with cholesterol labs.",
      },
    ]);

    assert.deepEqual(
      candidates.map((candidate) => candidate.title),
      ["Record weight", "Take a short walk"]
    );
  });

  it("builds recommendation sources from existing CarePland rows", () => {
    const sources = buildRecommendationInputSources({
      appointmentNotes: [
        {
          appointment_id: "appointment-1",
          created_at: "2026-06-20T12:00:00.000Z",
          followups: ["Bring home blood pressure log."],
          id: "note-1",
          input_text: "",
          summary_short: "Provider asked for home BP monitoring.",
          takeaways: [],
        },
      ],
      appointments: [
        {
          care_circle_id: "circle-1",
          care_subject_id: "person-1",
          id: "appointment-1",
          provider_name: "Dr. Allen",
          starts_at: "2026-06-18T16:00:00.000Z",
          title: "Cardiology follow-up",
        },
      ],
      carePrepGuidance: [
        {
          appointment_id: "appointment-1",
          bring_list: ["Medication list"],
          generated_at: "2026-06-17T12:00:00.000Z",
          id: "careprep-1",
          key_questions: [],
          med_review: "Ask about medication timing.",
          next_steps: [],
          since_last_visit: "",
          summary: "Prepare medication timing questions.",
          watchouts: [],
        },
      ],
    });

    assert.deepEqual(
      sources.map((source) => source.sourceType),
      ["appointment_note", "careprep_guidance"]
    );
    assert.match(sources[0]?.text ?? "", /home BP monitoring/i);
    assert.equal(
      sources[0]?.sourceLabel,
      "Cardiology follow-up - Dr. Allen"
    );
  });

  it("creates stable evidence hashes for rerunnable scans", () => {
    const hash = recommendationEvidenceHash({
      evidenceText: "  Bring home blood pressure readings. ",
      sourceId: "note-1",
      sourceTable: "appointment_notes",
      sourceType: "appointment_note",
    });

    assert.equal(
      hash,
      "appointment_note:appointment_notes:note-1:bring home blood pressure readings."
    );
  });

  it("maps review actions to recommendation statuses", () => {
    assert.equal(recommendationStatusForReviewAction("approve"), "approved");
    assert.equal(recommendationStatusForReviewAction("dismiss"), "dismissed");
    assert.equal(recommendationStatusForReviewAction("expire"), "expired");
    assert.equal(
      recommendationStatusForReviewAction("convert_to_focus"),
      "converted_to_focus"
    );
  });

  it("converts a measured recommendation into an active Focus Item draft", () => {
    const focusItem = buildFocusItemDraftFromRecommendation({
      careCircleId: "circle-1",
      careSubjectId: "person-1",
      description: "Record weight when weight is part of the recent care story.",
      id: "recommendation-1",
      priority: "high",
      reason: "Weight appears in nutrition context.",
      status: "approved",
      structuredPayload: {
        completionEventType: "measurement.weight",
        completionType: "measured_value",
        generationRule: "weight_or_nutrition_monitoring",
      },
      title: "Record weight",
    });

    assert.equal(focusItem.status, "active");
    assert.equal(focusItem.completionType, "measured_value");
    assert.equal(focusItem.completionEventType, "measurement.weight");
    assert.equal(focusItem.completionConfig?.unit, "lb");
    assert.equal(focusItem.completionPromptText, "What was the weight?");
    assert.equal(focusItem.importanceScore, 85);
  });

  it("explains recommendation-to-focus ranking decisions", () => {
    const decision = focusItemRankingDecisionFromRecommendation({
      careCircleId: "circle-1",
      careSubjectId: "person-1",
      id: "recommendation-1",
      priority: "high",
      reason: "Provider-backed recommendation.",
      status: "approved",
      title: "Record weight",
    });

    assert.equal(decision.importanceScore, 85);
    assert.equal(decision.source, "care_recommendation_v1");
    assert.match(decision.rationale, /priority is high/i);
  });
});
