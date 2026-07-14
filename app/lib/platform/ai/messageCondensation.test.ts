import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { condenseReceiverSpeechMessage } from "./messageCondensation";

describe("Receiver message condensation", () => {
  it("leaves short messages unchanged", () => {
    const result = condenseReceiverSpeechMessage({
      maxLength: 100,
      transcript: "Tell Andrew my knee hurts.",
    });

    assert.equal(result.draft, "Tell Andrew my knee hurts.");
    assert.equal(result.wasCondensed, false);
    assert.equal(result.originalLength, "Tell Andrew my knee hurts.".length);
  });

  it("condenses long spoken messages into a bounded draft", () => {
    const result = condenseReceiverSpeechMessage({
      maxLength: 100,
      transcript:
        "Andrew, I want you to know that we're going to have to go to the store and pick up a few more things because we're almost out of milk and bread and I do not want to forget before tomorrow morning.",
    });

    assert.ok(result.wasCondensed);
    assert.ok(result.draft.length <= 100);
    assert.match(result.draft, /store/i);
    assert.match(result.draft, /milk/i);
    assert.match(result.draft, /bread/i);
  });

  it("preserves medically relevant facts when choosing long-message content", () => {
    const result = condenseReceiverSpeechMessage({
      maxLength: 100,
      transcript:
        "I was sitting in the chair for a while and then I got up slowly and I want Andrew to know that I felt dizzy after taking my medicine this morning and my knee still hurts.",
    });

    assert.ok(result.wasCondensed);
    assert.ok(result.draft.length <= 100);
    assert.match(result.draft, /dizzy|medicine|knee/i);
  });

  it("turns long appointment preparation speech into a concise message draft", () => {
    const result = condenseReceiverSpeechMessage({
      maxLength: 90,
      transcript:
        "So I think for this doctor's appointment coming up, we need to get quite a few things together, make sure we bring the insurance card, the medication list, the hearing aids, and maybe ask Andrew to help us get everything ready before tomorrow morning.",
    });

    assert.ok(result.wasCondensed);
    assert.ok(result.draft.length < 100);
    assert.doesNotMatch(result.draft, /^So I think/i);
    assert.match(result.draft, /doctor appointment/i);
    assert.match(result.draft, /insurance card/i);
    assert.match(result.draft, /med list/i);
    assert.match(result.draft, /hearing aids/i);
  });

  it("does not expose appointment-prep transcript as a health concern draft", () => {
    const result = condenseReceiverSpeechMessage({
      maxLength: 90,
      transcript:
        "So I think for this doctor's appointment coming up, and as you know, we have some things we have to make sure we have some things we have to make.",
    });

    assert.ok(result.wasCondensed);
    assert.ok(result.draft.length < 100);
    assert.doesNotMatch(result.draft, /^Health concern:/i);
    assert.doesNotMatch(result.draft, /as you know/i);
    assert.match(result.draft, /doctor appointment|appointment/i);
  });

  it("preserves specific appointment prep items instead of flattening them into a health concern", () => {
    const result = condenseReceiverSpeechMessage({
      maxLength: 90,
      transcript:
        "Here is the message that will be sent. For the doctor's appointment, make sure we bring the list of medications, the non-RX meds, the blood sugar sensor, and the exercise log.",
    });

    assert.ok(result.wasCondensed);
    assert.ok(result.draft.length < 100);
    assert.doesNotMatch(result.draft, /^Health concern:/i);
    assert.match(result.draft, /appointment/i);
    assert.match(result.draft, /med list/i);
    assert.match(result.draft, /OTC meds/i);
    assert.match(result.draft, /blood sugar sensor/i);
    assert.match(result.draft, /exercise log/i);
  });
});
