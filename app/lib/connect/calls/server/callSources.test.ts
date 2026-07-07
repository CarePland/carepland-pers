import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { callsVisibleToConnectSurface } from "./callSources";
import type { ConnectCallRecord } from "../callScoping";

const personId = "person-rob";

describe("Connect call source selection", () => {
  it("uses persisted calls only for bound Receiver access", () => {
    const calls = callsVisibleToConnectSurface({
      accessType: "receiver_device",
      persistedCalls: [
        callRecord({ callId: "real-ended", state: "hung_up" }),
      ],
      personId,
      prototypeCalls: [
        callRecord({ callId: "stale-prototype-ringing", state: "ringing" }),
      ],
    });

    assert.deepEqual(
      calls.map((call) => call.callId),
      ["real-ended"]
    );
  });

  it("prefers persisted calls over prototype calls once real call history exists", () => {
    const calls = callsVisibleToConnectSurface({
      accessType: "user",
      persistedCalls: [
        callRecord({ callId: "real-connected", state: "connected" }),
      ],
      personId,
      prototypeCalls: [
        callRecord({ callId: "prototype-ringing", state: "ringing" }),
      ],
    });

    assert.deepEqual(
      calls.map((call) => call.callId),
      ["real-connected"]
    );
  });

  it("keeps prototype fallback available before real call history exists", () => {
    const calls = callsVisibleToConnectSurface({
      accessType: "user",
      persistedCalls: [],
      personId,
      prototypeCalls: [
        callRecord({ callId: "prototype-ringing", state: "ringing" }),
      ],
    });

    assert.deepEqual(
      calls.map((call) => call.callId),
      ["prototype-ringing"]
    );
  });
});

function callRecord(input: Partial<ConnectCallRecord>): ConnectCallRecord {
  return {
    callId: input.callId || "call",
    callerName: "Andrew",
    mainConnectUserPersonId: input.mainConnectUserPersonId || personId,
    recipientName: "Rob",
    recipientPersonId: input.recipientPersonId || personId,
    state: input.state || "ringing",
    updatedAt: input.updatedAt || "2026-07-07T10:00:00.000Z",
  };
}
