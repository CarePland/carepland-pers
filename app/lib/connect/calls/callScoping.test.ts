import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyConnectCallSummary,
  filterCallsForMainConnectUser,
  mergeConnectCalls,
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
      { callId: "ended", state: "hung_up", updatedAt: "2026-06-20T12:00:00.000Z" },
      { callId: "latest", state: "ringing", updatedAt: "2026-06-21T12:00:00.000Z" },
      { callId: "connected", state: "connected", updatedAt: "2026-06-20T13:00:00.000Z" },
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

  it("merges calls with local records winning matching call ids", () => {
    const calls = mergeConnectCalls(
      [
        {
          callId: "same-call",
          state: "connected",
          updatedAt: "2026-06-21T12:01:00.000Z",
        },
      ],
      [
        {
          callId: "same-call",
          state: "ringing",
          updatedAt: "2026-06-21T12:00:00.000Z",
        },
        {
          callId: "prototype-only",
          state: "ringing",
          updatedAt: "2026-06-21T11:59:00.000Z",
        },
      ]
    );

    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.callId, "same-call");
    assert.equal(calls[0]?.state, "connected");
    assert.equal(calls[1]?.callId, "prototype-only");
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
