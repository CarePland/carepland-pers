import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  focusCadenceSuppressionForRows,
  focusCadenceTargetFromMetadata,
  snoozedUntilForFocusCadenceAction,
} from "./focusCadencePreferences";

describe("focus cadence preferences", () => {
  it("suppresses stopped recommendation-backed items until evidence changes", () => {
    const target = focusCadenceTargetFromMetadata({
      focusItemId: "focus-1",
      metadata: {
        recommendationId: "rec-1",
        recommendationTrace: {
          evidenceHashes: ["b", "a"],
        },
      },
    });

    assert.deepEqual(
      focusCadenceSuppressionForRows(
        [
          {
            evidence_signature: "a|b",
            preference_action: "stop_suggesting",
            recommendation_id: "rec-1",
          },
        ],
        target
      ),
      { reason: "stopped" }
    );

    assert.equal(
      focusCadenceSuppressionForRows(
        [
          {
            evidence_signature: "old",
            preference_action: "stop_suggesting",
            recommendation_id: "rec-1",
          },
        ],
        target
      ),
      null
    );
  });

  it("suppresses snoozed items until the snooze date passes", () => {
    const referenceDate = new Date("2026-07-02T12:00:00.000Z");
    const target = focusCadenceTargetFromMetadata({
      focusItemId: "focus-1",
      metadata: {},
    });

    assert.deepEqual(
      focusCadenceSuppressionForRows(
        [
          {
            focus_item_id: "focus-1",
            preference_action: "snooze_30_days",
            snoozed_until: "2026-07-10",
          },
        ],
        target,
        referenceDate
      ),
      { reason: "snoozed" }
    );

    assert.equal(
      focusCadenceSuppressionForRows(
        [
          {
            focus_item_id: "focus-1",
            preference_action: "snooze_30_days",
            snoozed_until: "2026-07-01",
          },
        ],
        target,
        referenceDate
      ),
      null
    );
  });

  it("calculates a simple 30 day snooze date", () => {
    assert.equal(
      snoozedUntilForFocusCadenceAction(
        "snooze_30_days",
        new Date("2026-07-02T00:00:00.000Z")
      ),
      "2026-08-01"
    );
  });
});
