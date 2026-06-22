import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyConnectCallSummary,
  filterCallsForMainConnectUser,
  summarizeConnectCalls,
} from "./callScoping";

describe("Connect call scoping", () => {
  it("filters calls to the selected Main Connect User", () => {
    const calls = [
      {
        callId: "call-bob-main",
        mainConnectUserPersonId: "person-bob",
        recipientPersonId: "person-alice",
      },
      {
        callId: "call-bob-recipient",
        recipientPersonId: "person-bob",
      },
      {
        callId: "call-alice",
        mainConnectUserPersonId: "person-alice",
      },
      {
        callId: "call-untagged",
      },
    ];

    assert.deepEqual(
      filterCallsForMainConnectUser(calls, "person-bob").map((call) => call.callId),
      ["call-bob-main", "call-bob-recipient"]
    );
  });

  it("summarizes only the already-scoped calls it receives", () => {
    const summary = summarizeConnectCalls([
      { callId: "latest", state: "ringing" },
      { callId: "connected", state: "connected" },
      { callId: "ended", state: "hung_up" },
      { callId: "unknown" },
    ]);

    assert.equal(summary.total, 4);
    assert.equal(summary.active, 2);
    assert.deepEqual(summary.byState, {
      connected: 1,
      hung_up: 1,
      ringing: 1,
      unknown: 1,
    });
    assert.equal(summary.latestCall?.callId, "latest");
  });

  it("returns a stable empty summary shape", () => {
    assert.deepEqual(emptyConnectCallSummary(), {
      active: 0,
      byState: {},
      latestCall: null,
      total: 0,
    });
  });
});
