import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  approveLocalConnectCallSummary,
  markStaleLocalConnectCallsMissed,
  readLocalConnectCalls,
  recordLocalConnectCall,
  updateLocalConnectCallState,
} from "./localCalls";

async function withTempCallIndex<T>(callback: (indexPath: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(tmpdir(), "connect-local-calls-"));
  try {
    return await callback(path.join(dir, "calls.json"));
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

describe("local Connect calls", () => {
  it("records app-native calls for the selected Main Connect User", async () => {
    await withTempCallIndex(async (indexPath) => {
      const call = await recordLocalConnectCall(
        {
          callerName: "Andrew",
          mainConnectUserPersonId: "person-bob",
          recipientName: "Bob",
          receiverId: "living-room-receiver",
        },
        { indexPath }
      );
      const index = await readLocalConnectCalls({ indexPath });

      assert.ok(call.callId?.startsWith("connect-call-"));
      assert.equal(call.state, "ringing");
      assert.equal(call.mainConnectUserPersonId, "person-bob");
      assert.equal(call.recipientPersonId, "person-bob");
      assert.equal(index.calls.length, 1);
    });
  });

  it("updates allowed call state transitions", async () => {
    await withTempCallIndex(async (indexPath) => {
      const call = await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "ringing",
        },
        { indexPath }
      );
      const answered = await updateLocalConnectCallState(call.callId ?? "", "answered", {
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });
      const connected = await updateLocalConnectCallState(call.callId ?? "", "connected", {
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });

      assert.equal(answered?.state, "answered");
      assert.equal(connected?.state, "connected");
    });
  });

  it("does not update another person's call", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "ringing",
        },
        { indexPath }
      );
      const updated = await updateLocalConnectCallState("call-1", "answered", {
        indexPath,
        mainConnectUserPersonId: "person-alice",
      });
      const index = await readLocalConnectCalls({ indexPath });

      assert.equal(updated, null);
      assert.equal(index.calls[0]?.state, "ringing");
    });
  });

  it("leaves terminal calls unchanged", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "declined",
        },
        { indexPath }
      );
      const updated = await updateLocalConnectCallState("call-1", "connected", {
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });
      const index = await readLocalConnectCalls({ indexPath });

      assert.equal(updated?.state, "declined");
      assert.equal(index.calls[0]?.state, "declined");
    });
  });

  it("marks stale ringing calls missed", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "old-ringing",
          mainConnectUserPersonId: "person-bob",
          state: "ringing",
          updatedAt: "2026-06-21T12:00:00.000Z",
        },
        { indexPath }
      );
      await recordLocalConnectCall(
        {
          callId: "fresh-ringing",
          mainConnectUserPersonId: "person-bob",
          state: "ringing",
          updatedAt: "2026-06-21T12:00:55.000Z",
        },
        { indexPath }
      );
      await recordLocalConnectCall(
        {
          callId: "connected",
          mainConnectUserPersonId: "person-bob",
          state: "connected",
          updatedAt: "2026-06-21T12:00:00.000Z",
        },
        { indexPath }
      );

      const changed = await markStaleLocalConnectCallsMissed({
        indexPath,
        now: new Date("2026-06-21T12:01:00.000Z"),
        ringingTimeoutMs: 45_000,
      });
      const index = await readLocalConnectCalls({ indexPath });

      assert.equal(changed, 1);
      assert.equal(
        index.calls.find((call) => call.callId === "old-ringing")?.state,
        "missed"
      );
      assert.equal(
        index.calls.find((call) => call.callId === "fresh-ringing")?.state,
        "ringing"
      );
      assert.equal(
        index.calls.find((call) => call.callId === "connected")?.state,
        "connected"
      );
    });
  });

  it("approves summaries by deleting temporary transcript text", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "hung_up",
          summaryStatus: "completed",
          summaryText: "Medication was discussed.",
          transcriptStatus: "ready_for_summary",
          transcriptText: "Long raw transcript that should not remain after approval.",
        },
        { indexPath }
      );

      const approved = await approveLocalConnectCallSummary("call-1", {
        approvedBy: "receiver",
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });
      const index = await readLocalConnectCalls({ indexPath });
      const storedCall = index.calls[0];

      assert.equal(approved?.summaryStatus, "approved");
      assert.equal(approved?.summaryText, "Medication was discussed.");
      assert.equal(approved?.transcriptText, undefined);
      assert.equal(approved?.transcriptStatus, "deleted");
      assert.equal(storedCall?.summaryStatus, "approved");
      assert.equal(storedCall?.summaryText, "Medication was discussed.");
      assert.equal(storedCall?.transcriptText, undefined);
      assert.equal(storedCall?.transcriptStatus, "deleted");
      assert.ok(storedCall?.transcriptDeletedAt);
    });
  });
});
