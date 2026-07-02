import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  listReceiverContextualPrompts,
  receiverContextualPromptCandidateAreas,
  receiverContextualPromptById,
} from "./receiverContextualPrompts";

describe("receiver contextual prompts", () => {
  it("catalogs the Today's Focus undo duration question", () => {
    const prompt = receiverContextualPromptById("todays_focus_undo_duration");

    assert.ok(prompt);
    assert.equal(
      prompt.question,
      "When you want to undo completing a Today's Focus item, do you feel CarePland gives you enough time?"
    );
    assert.deepEqual(
      prompt.options.map((option) => option.label),
      ["Not enough time", "About right", "Too much time"]
    );
    assert.equal(prompt.status, "cataloged_future_trigger");
    assert.equal(prompt.candidateArea, "timing");
    assert.match(prompt.intendedUse, /connect_receiver_undo_seconds/);
  });

  it("keeps Receiver contextual prompts lightweight and non-interruptive", () => {
    for (const prompt of listReceiverContextualPrompts()) {
      assert.ok(receiverContextualPromptCandidateAreas.includes(prompt.candidateArea));
      assert.equal(prompt.constraints.askOnlyOneQuestion, true);
      assert.equal(prompt.constraints.directlyRelatedToRecentExperience, true);
      assert.equal(prompt.constraints.easyToDismiss, true);
      assert.equal(prompt.constraints.infrequent, true);
      assert.equal(prompt.constraints.neverInterruptUrgentWorkflows, true);
      assert.ok(prompt.options.length >= 2);
    }
  });
});
