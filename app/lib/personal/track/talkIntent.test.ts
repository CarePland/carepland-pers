import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  interpretTalkInput,
  talkResultShouldWrite,
  type TalkInterpretationInput,
} from "./talkIntent";

describe("Talk intent interpretation", () => {
  it("creates a walking Track Event draft without storing the raw transcript", () => {
    const result = interpretTalkInput(
      input({ inputText: "I walked to the mailbox." })
    );

    assert.equal(result.intent, "track_event_activity");
    assert.equal(result.trackEventDraft?.eventType, "activity.walking");
    assert.equal(result.trackEventDraft?.source, "talk_voice");
    assert.equal(result.trackEventDraft?.title, "Walked to mailbox");
    assert.equal(result.structuredPayload.destination, "mailbox");
    assert.equal("interpretedFrom" in result.structuredPayload, false);
    assert.equal(talkResultShouldWrite(result), true);
  });

  it("matches a broad medication Focus Item and creates a completion event", () => {
    const result = interpretTalkInput(
      input({
        focusItems: [
          {
            careCircleId: "circle-1",
            careSubjectId: "person-1",
            completionEventType: "medication.taken",
            completionType: "medication",
            id: "focus-med-morning",
            promptText: "Did you take your morning medications?",
            title: "Morning medications",
          },
        ],
        inputText: "I took my morning medications.",
      })
    );

    assert.equal(result.intent, "focus_item_completion");
    assert.equal(result.completedFocusItemId, "focus-med-morning");
    assert.equal(result.trackEventDraft?.focusItemId, "focus-med-morning");
    assert.equal(result.trackEventDraft?.eventType, "medication.taken");
    assert.equal(result.structuredPayload.medicationScope, "broad");
    assert.equal(result.structuredPayload.medicationWindow, "Morning");
    assert.equal(talkResultShouldWrite(result), true);
  });

  it("extracts a measured weight value and unit", () => {
    const result = interpretTalkInput(
      input({ inputText: "I weighed 185 pounds." })
    );

    assert.equal(result.intent, "measured_track_event");
    assert.equal(result.trackEventDraft?.eventType, "measurement.weight");
    assert.equal(result.trackEventDraft?.value, 185);
    assert.equal(result.trackEventDraft?.unit, "lb");
    assert.equal(talkResultShouldWrite(result), true);
  });

  it("identifies a Connect call request by contact name", () => {
    const result = interpretTalkInput(
      input({
        contacts: [{ displayName: "Andrew", id: "contact-andrew" }],
        inputText: "Call Andrew.",
      })
    );

    assert.equal(result.intent, "connect_call_request");
    assert.equal(result.proposedAction, "request_call");
    assert.equal(result.structuredPayload.contactId, "contact-andrew");
    assert.equal(result.trackEventDraft, undefined);
  });

  it("answers an appointment question from supplied upcoming appointments", () => {
    const result = interpretTalkInput(
      input({
        appointments: [
          {
            id: "appt-2",
            startsAt: "2026-07-03T17:00:00.000Z",
            title: "Dental Checkup",
          },
          {
            id: "appt-1",
            startsAt: "2026-07-02T16:00:00.000Z",
            title: "Cardiology Follow-Up",
          },
        ],
        inputText: "When is my next appointment?",
      })
    );

    assert.equal(result.intent, "appointment_question");
    assert.equal(result.proposedAction, "answer_appointment_question");
    assert.equal(result.structuredPayload.appointmentId, "appt-1");
    assert.match(result.displayResponse, /Cardiology Follow-Up/);
    assert.equal(result.trackEventDraft, undefined);
  });

  it("keeps unknown input out of permanent Track records", () => {
    const result = interpretTalkInput(
      input({ inputText: "The purple idea is sideways." })
    );

    assert.equal(result.intent, "unknown");
    assert.equal(result.needsReview, true);
    assert.equal(result.trackEventDraft, undefined);
    assert.equal(talkResultShouldWrite(result), false);
  });
});

function input(
  overrides: Partial<TalkInterpretationInput>
): TalkInterpretationInput {
  return {
    careCircleId: "circle-1",
    careSubjectId: "person-1",
    inputText: "",
    now: new Date("2026-07-01T15:00:00.000Z"),
    ...overrides,
  };
}
