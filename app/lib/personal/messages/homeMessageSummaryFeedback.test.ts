import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeHomeMessageSummaryFeedbackDraft } from "./homeMessageSummaryFeedback";

describe("Home message summary feedback", () => {
  it("normalizes Not quite feedback with provenance for audit", () => {
    const feedback = normalizeHomeMessageSummaryFeedbackDraft(
      {
        decisionTrace: { matchedRules: ["bring_eyewear"] },
        keyPoints: [{ normalizedMeaning: "bring glasses", sourceMessageIds: ["m1"] }],
        personId: "person-1",
        sourceMessageIds: ["m1", "m1", "m2"],
        summary: " Bring glasses. ",
        summaryModelVersion: "deterministic_v1",
        userComment: " It missed the exercise papers. ",
      },
      { careCircleId: "circle-1", userId: "user-1" }
    );

    assert.equal(feedback.care_circle_id, "circle-1");
    assert.equal(feedback.care_subject_id, "person-1");
    assert.equal(feedback.feedback_value, "not_quite");
    assert.equal(feedback.summary_text, "Bring glasses.");
    assert.equal(feedback.user_comment, "It missed the exercise papers.");
    assert.deepEqual(feedback.source_message_ids, ["m1", "m2"]);
    assert.deepEqual(feedback.decision_trace, { matchedRules: ["bring_eyewear"] });
    assert.equal(feedback.summary_snapshot.summary, "Bring glasses.");
    assert.equal(feedback.should_influence_future_generation, true);
  });

  it("requires a user concern", () => {
    assert.throws(
      () =>
        normalizeHomeMessageSummaryFeedbackDraft(
          {
            personId: "person-1",
            summary: "Bring glasses.",
            userComment: " ",
          },
          { careCircleId: "circle-1", userId: "user-1" }
        ),
      /describe what was not quite right/i
    );
  });
});
