import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildReceiverTodayFocusCompletionEvent,
  normalizeReceiverTodayFocusRows,
  receiverTodayFocusItemLimit,
  type ReceiverTodayFocusItem,
} from "./receiverTodayFocus";

describe("receiver Today Focus", () => {
  it("returns a hard max of three items ranked by Today Focus policy", () => {
    const items = normalizeReceiverTodayFocusRows(
      [
        row({ id: "routine", metadata: { source: "routine" } }),
        row({ id: "user-goal", metadata: { source: "user_goal" }, sort_order: 5 }),
        row({ id: "caregiver-goal", metadata: { source: "caregiver_goal" } }),
        row({
          completion_event_type: "medication.taken",
          completion_type: "medication",
          id: "medication",
        }),
      ],
      new Date("2026-07-01T12:00:00.000Z")
    );

    assert.equal(items.length, receiverTodayFocusItemLimit);
    assert.deepEqual(
      items.map((item) => item.id),
      ["user-goal", "caregiver-goal", "medication"]
    );
    assert.equal(items[0]?.todayFocusRanking?.baseWeight, 100);
  });

  it("filters inactive and out-of-window focus items", () => {
    const items = normalizeReceiverTodayFocusRows(
      [
        row({ id: "active" }),
        row({ id: "paused", status: "paused" }),
        row({ active_start_date: "2026-07-02", id: "future" }),
        row({ active_end_date: "2026-06-30", id: "ended" }),
      ],
      new Date("2026-07-01T12:00:00.000Z")
    );

    assert.deepEqual(
      items.map((item) => item.id),
      ["active"]
    );
  });

  it("keeps appointment reminders out of Receiver Today Focus", () => {
    const items = normalizeReceiverTodayFocusRows(
      [
        row({ focus_type: "appointment_reminder", id: "appointment", title: "Cardiology Follow-Up" }),
        row({ id: "doctor", title: "Virtual doctor's call 4pm" }),
        row({ id: "focus", title: "Take morning medications" }),
      ],
      new Date("2026-07-01T12:00:00.000Z")
    );

    assert.deepEqual(
      items.map((item) => item.id),
      ["focus"]
    );
  });

  it("removes items already completed today", () => {
    const items = normalizeReceiverTodayFocusRows(
      [
        row({ id: "completed", metadata: { source: "user_goal" } }),
        row({ id: "remaining", metadata: { source: "caregiver_goal" } }),
      ],
      new Date("2026-07-01T12:00:00.000Z"),
      { completedFocusItemIds: ["completed"] }
    );

    assert.deepEqual(
      items.map((item) => item.id),
      ["remaining"]
    );
  });

  it("applies ranking modifiers with rationale", () => {
    const items = normalizeReceiverTodayFocusRows(
      [
        row({
          active_end_date: "2026-07-01",
          id: "provider-backed",
          metadata: {
            recommendationTrace: {
              priorityDecision: { signals: ["provider_or_careprep_source"] },
              sourceTypeCounts: { appointment_note: 1 },
            },
            source: "care_recommendation",
          },
        }),
        row({ id: "routine", metadata: { source: "routine" } }),
      ],
      new Date("2026-07-01T12:00:00.000Z")
    );

    assert.equal(items[0]?.id, "provider-backed");
    assert.equal(items[0]?.todayFocusRanking?.baseWeight, 70);
    assert.deepEqual(
      items[0]?.todayFocusRanking?.modifiers.map((modifier) => modifier.label),
      ["provider_explicitly_recommended", "expires_today"]
    );
    assert.equal(items[0]?.todayFocusRanking?.finalScore, 110);
  });

  it("creates a simple done Track Event from a focus item", () => {
    const event = buildReceiverTodayFocusCompletionEvent({
      focusItem: focusItem({
        completionEventType: "activity.walking",
        completionType: "simple_done",
        title: "Walk to mailbox",
      }),
      occurredAt: "2026-07-01T21:40:00.000Z",
    });

    assert.equal(event.eventType, "activity.walking");
    assert.equal(event.source, "receiver_today_focus");
    assert.equal(event.title, "Walk to mailbox");
  });

  it("requires measured values and resolves a configured unit", () => {
    const event = buildReceiverTodayFocusCompletionEvent({
      focusItem: focusItem({
        completionConfig: { unit: "lb" },
        completionEventType: "measurement.weight",
        completionType: "measured_value",
        title: "Weigh yourself",
      }),
      occurredAt: "2026-07-01T14:00:00.000Z",
      value: 183.4,
    });

    assert.equal(event.eventType, "measurement.weight");
    assert.equal(event.value, 183.4);
    assert.equal(event.unit, "lb");
  });

  it("rejects unsupported Receiver completion types for now", () => {
    assert.throws(
      () =>
        buildReceiverTodayFocusCompletionEvent({
          focusItem: focusItem({ completionType: "medication" }),
        }),
      /only supports simple and measured/
    );
  });
});

function row(
  overrides: Partial<Parameters<typeof normalizeReceiverTodayFocusRows>[0][number]>
) {
  return {
    care_circle_id: "circle-1",
    care_subject_id: "person-1",
    completion_type: "simple_done",
    created_at: "2026-07-01T00:00:00.000Z",
    id: "focus-1",
    importance_score: 50,
    metadata: {},
    sort_order: 100,
    status: "active",
    title: "Focus item",
    ...overrides,
  };
}

function focusItem(
  overrides: Partial<ReceiverTodayFocusItem> = {}
): ReceiverTodayFocusItem {
  return {
    careCircleId: "circle-1",
    careSubjectId: "person-1",
    completionConfig: {},
    completionEventType: "activity.completed",
    completionPromptText: null,
    completionType: "simple_done",
    createdAt: "2026-07-01T00:00:00.000Z",
    focusType: "daily_prompt",
    id: "focus-1",
    importanceScore: 50,
    metadata: {},
    promptText: null,
    recurrenceRule: null,
    schedule: {},
    sortOrder: 100,
    status: "active",
    title: "Focus item",
    ...overrides,
  };
}
