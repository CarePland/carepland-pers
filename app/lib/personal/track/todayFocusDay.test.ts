import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  todayFocusCompletionWindow,
  todayFocusResetHour,
} from "./todayFocusDay";

describe("today Focus day window", () => {
  it("starts the Focus day at 4am in the requested local time zone", () => {
    const window = todayFocusCompletionWindow(
      new Date("2026-07-01T15:00:00.000Z"),
      "America/Los_Angeles"
    );

    assert.equal(todayFocusResetHour, 4);
    assert.equal(window.startUtc.toISOString(), "2026-07-01T11:00:00.000Z");
    assert.equal(window.endUtc.toISOString(), "2026-07-02T11:00:00.000Z");
  });

  it("uses the previous local 4am before the morning reset", () => {
    const window = todayFocusCompletionWindow(
      new Date("2026-07-01T10:30:00.000Z"),
      "America/Los_Angeles"
    );

    assert.equal(window.startUtc.toISOString(), "2026-06-30T11:00:00.000Z");
    assert.equal(window.endUtc.toISOString(), "2026-07-01T11:00:00.000Z");
  });
});
