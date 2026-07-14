import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createObservation } from "./observationPipeline";
import { createMeaningFrameFromObservation } from "./meaningFrame";
import { classifyInteractionFamily } from "./interactionFamilyClassifier";

describe("Interaction Family classifier", () => {
  it("classifies proto-beta Receiver utterances by human purpose", () => {
    const examples = [
      ["When is my next appointment?", "ask"],
      ["I went for a walk.", "observe"],
      ["Tell Andrew my knee hurts.", "communicate"],
      ["I need milk.", "need"],
      ["Remind me to take my pills.", "remind"],
    ] as const;

    for (const [text, family] of examples) {
      const classification = classifyInteractionFamily(
        createMeaningFrameFromObservation(
          createObservation({
            modality: "typed",
            source: "receiver",
            text,
          })
        )
      );

      assert.equal(classification.family, family, text);
    }
  });

  it("treats what-should-I-bring as Ask rather than a message request", () => {
    const classification = classifyInteractionFamily(
      createMeaningFrameFromObservation(
        createObservation({
          modality: "typed",
          source: "receiver",
          text: "What should I bring?",
        })
      )
    );

    assert.equal(classification.family, "ask");
  });

  it("treats dizzy input as an observation with elevated secondary meaning", () => {
    const classification = classifyInteractionFamily(
      createMeaningFrameFromObservation(
        createObservation({
          modality: "typed",
          source: "receiver",
          text: "I feel dizzy.",
        })
      )
    );

    assert.equal(classification.family, "observe");
    assert.ok(classification.secondaryFamilies?.includes("express"));
  });

  it("gives judgment requests precedence over communication verbs", () => {
    const examples = [
      ["Should I call the doctor?", "decide", ["communicate"]],
      ["Should I call Andrew?", "decide", ["communicate"]],
      ["Call Andrew.", "communicate", []],
      ["I need to call Andrew.", "communicate", ["need"]],
      ["Did Andrew call?", "ask", ["communicate"]],
      ["Andrew should call the doctor.", "communicate", []],
      ["Should Andrew call the doctor?", "decide", ["communicate"]],
      ["I need to tell Susan something.", "communicate", ["need"]],
    ] as const;

    for (const [text, family, secondaryFamilies] of examples) {
      const classification = classifyInteractionFamily(
        createMeaningFrameFromObservation(
          createObservation({
            modality: "typed",
            source: "receiver",
            text,
          })
        )
      );

      assert.equal(classification.family, family, text);
      for (const secondaryFamily of secondaryFamilies) {
        assert.ok(
          classification.secondaryFamilies?.includes(secondaryFamily),
          `${text} should include secondary ${secondaryFamily}`
        );
      }
    }
  });

  it("does not use Ask as the universal fallback", () => {
    const examples = [
      ["I’m cold.", "unclear"],
      ["I’m hungry.", "unclear"],
      ["I’m tired.", "unclear"],
      ["Never mind.", "contextual_response"],
      ["Yes.", "contextual_response"],
      ["That’s not right.", "contextual_response"],
      ["I can’t breathe well.", "escalate"],
      ["Andrew needs to know.", "communicate"],
      ["Someone should know about this.", "communicate"],
      ["We should let everyone know.", "communicate"],
    ] as const;

    for (const [text, family] of examples) {
      const classification = classifyInteractionFamily(
        createMeaningFrameFromObservation(
          createObservation({
            modality: "typed",
            source: "receiver",
            text,
          })
        )
      );

      assert.equal(classification.family, family, text);
    }
  });

  it("recognizes broader communication phrasing without defaulting to need or ask", () => {
    const examples = [
      ["Ask him if he's coming.", "communicate", []],
      ["My daughter ought to hear this.", "communicate", []],
      ["I need to talk to someone.", "communicate", ["need"]],
    ] as const;

    for (const [text, family, secondaryFamilies] of examples) {
      const classification = classifyInteractionFamily(
        createMeaningFrameFromObservation(
          createObservation({
            modality: "typed",
            source: "receiver",
            text,
          })
        )
      );

      assert.equal(classification.family, family, text);
      for (const secondaryFamily of secondaryFamilies) {
        assert.ok(classification.secondaryFamilies?.includes(secondaryFamily), text);
      }
    }
  });

  it("recognizes additional contextual replies before family classification", () => {
    const examples = ["That's the one.", "Not that one.", "Close enough."];

    for (const text of examples) {
      const classification = classifyInteractionFamily(
        createMeaningFrameFromObservation(
          createObservation({
            modality: "typed",
            source: "receiver",
            text,
          })
        )
      );

      assert.equal(classification.family, "contextual_response", text);
    }
  });

  it("keeps reminder payload verbs from becoming active secondary communication", () => {
    const classification = classifyInteractionFamily(
      createMeaningFrameFromObservation(
        createObservation({
          modality: "typed",
          source: "receiver",
          text: "Remind me to ask the doctor about this.",
        })
      )
    );

    assert.equal(classification.family, "remind");
    assert.ok(!classification.secondaryFamilies?.includes("communicate"));
  });

  it("keeps guidance questions from leaking nested communication verbs", () => {
    const classification = classifyInteractionFamily(
      createMeaningFrameFromObservation(
        createObservation({
          modality: "typed",
          source: "receiver",
          text: "What should I ask?",
        })
      )
    );

    assert.equal(classification.family, "ask");
    assert.ok(!classification.secondaryFamilies?.includes("communicate"));
  });

  it("routes evaluation and help requests without generic Ask fallback", () => {
    const examples = [
      ["Is this bad?", "decide"],
      ["Can somebody help me?", "need"],
      ["I forgot.", "unclear"],
    ] as const;

    for (const [text, family] of examples) {
      const classification = classifyInteractionFamily(
        createMeaningFrameFromObservation(
          createObservation({
            modality: "typed",
            source: "receiver",
            text,
          })
        )
      );

      assert.equal(classification.family, family, text);
    }
  });
});
