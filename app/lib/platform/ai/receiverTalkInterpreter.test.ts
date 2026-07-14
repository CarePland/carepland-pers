import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createObservation } from "./observationPipeline";
import {
  interpretReceiverTalkObservation,
  receiverTalkShouldHandleText,
} from "./receiverTalkInterpreter";

describe("Receiver Talk interpreter", () => {
  it("interprets speech from Observation through MeaningFrame", () => {
    const interpretation = interpretReceiverTalkObservation({
      appointments: [
        {
          id: "appt-1",
          startsAt: "2026-07-13T19:00:00.000Z",
          title: "Next vet visit for Dixie",
        },
      ],
      careCircleId: "circle-1",
      observation: createObservation({
        deviceId: "receiver-device-1",
        modality: "speech",
        observedAt: "2026-07-10T20:00:00.000Z",
        personId: "person-1",
        source: "receiver",
        surface: "ask_tell",
        text: "When is my next appointment?",
      }),
      now: new Date("2026-07-10T20:00:00.000Z"),
    });

    assert.equal(interpretation.meaningFrame.normalizedText, "When is my next appointment?");
    assert.equal(interpretation.meaningFrame.provenance.modality, "speech");
    assert.equal(interpretation.meaningFrame.provenance.source, "receiver");
    assert.equal(interpretation.meaningFrame.provenance.deviceId, "receiver-device-1");
    assert.equal(interpretation.result.intent, "appointment_question");
    assert.equal(interpretation.result.proposedAction, "answer_appointment_question");
  });

  it("preserves existing unknown Talk behavior", () => {
    const interpretation = interpretReceiverTalkObservation({
      careCircleId: "circle-1",
      observation: createObservation({
        modality: "speech",
        personId: "person-1",
        source: "receiver",
        text: "The purple idea is sideways.",
      }),
      now: new Date("2026-07-10T20:00:00.000Z"),
    });

    assert.equal(interpretation.result.intent, "unknown");
    assert.equal(interpretation.result.needsReview, true);
    assert.equal(interpretation.result.trackEventDraft, undefined);
  });

  it("identifies deterministic recordable text without taking over Ask/message text", () => {
    assert.equal(receiverTalkShouldHandleText("I went for a walk."), true);
    assert.equal(receiverTalkShouldHandleText("I weighed 185 pounds."), true);
    assert.equal(receiverTalkShouldHandleText("I took my morning medications."), true);
    assert.equal(receiverTalkShouldHandleText("Tell Andrew my knee hurts."), false);
    assert.equal(receiverTalkShouldHandleText("I need milk."), false);
    assert.equal(receiverTalkShouldHandleText("What should I bring tomorrow?"), false);
  });
});
