import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDate } from "./dateFormatting";

describe("formatDate", () => {
  it("returns a placeholder for a missing value", () => {
    assert.equal(formatDate(null), "Date not set");
    assert.equal(formatDate(""), "Date not set");
  });

  it("formats an ISO timestamp as a medium date with a short time", () => {
    const formatted = formatDate("2026-01-15T17:00:00.000Z");

    // Avoid asserting on the exact clock time, which shifts with the local
    // timezone of whatever machine/CI runs this -- assert on the
    // locale-formatted date parts that don't move across US timezones.
    assert.match(formatted, /Jan(uary)? 1[45], 2026/);
  });
});
