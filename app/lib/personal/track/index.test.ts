import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTrackEventFromFocusCompletion,
  measuredValuePromptFromConfig,
  normalizeFocusItemDraft,
  normalizeTrackEventType,
} from ".";

describe("track foundation", () => {
  it("keeps focus item intent separate from recorded track events", () => {
    const focusItem = normalizeFocusItemDraft({
      careCircleId: "circle-1",
      careSubjectId: "person-1",
      completionEventType: "Activity Walking",
      completionType: "simple_done",
      title: "  Walk   to the mailbox ",
    });

    const event = buildTrackEventFromFocusCompletion({
      focusItem: { ...focusItem, id: "focus-1" },
      occurredAt: "2026-07-01T21:40:00.000Z",
      source: "receiver_today_focus",
      title: "Walked to mailbox",
    });

    assert.equal(focusItem.title, "Walk to the mailbox");
    assert.equal(focusItem.completionEventType, "activity_walking");
    assert.equal(event.focusItemId, "focus-1");
    assert.equal(event.title, "Walked to mailbox");
    assert.equal(event.source, "receiver_today_focus");
  });

  it("represents measured follow-up prompts in completion config", () => {
    const focusItem = normalizeFocusItemDraft({
      careCircleId: "circle-1",
      careSubjectId: "person-1",
      completionConfig: {
        eventType: "Measurement Weight",
        unit: "lb",
      },
      completionType: "measured_value",
      title: "Weigh yourself",
    });

    const event = buildTrackEventFromFocusCompletion({
      focusItem,
      occurredAt: "2026-07-01T14:00:00.000Z",
      unit: "lb",
      value: 183.4,
    });

    assert.equal(focusItem.completionPromptText, "What was the value in lb?");
    assert.equal(event.eventType, "measurement_weight");
    assert.equal(event.value, 183.4);
    assert.equal(event.unit, "lb");
  });

  it("normalizes event type namespaces conservatively", () => {
    assert.equal(normalizeTrackEventType(" Measurement: Blood Sugar "), "measurement_blood_sugar");
  });

  it("supports explicit measured prompt wording", () => {
    assert.equal(
      measuredValuePromptFromConfig({
        unitOptions: ["mg/dL", "mmol/L"],
        valuePromptText: "What was the blood sugar reading?",
      }),
      "What was the blood sugar reading?"
    );
  });
});
