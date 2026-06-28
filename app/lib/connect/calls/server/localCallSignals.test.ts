import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  compactLocalConnectCallSignals,
  filterLocalConnectCallSignals,
  readLocalConnectCallSignals,
  recordLocalConnectCallSignal,
} from "./localCallSignals";

async function withTempSignalIndex<T>(callback: (indexPath: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(tmpdir(), "connect-call-signals-"));
  try {
    return await callback(path.join(dir, "signals.json"));
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

describe("local Connect call signals", () => {
  it("records WebRTC-style call signals with person scope", async () => {
    await withTempSignalIndex(async (indexPath) => {
      const signal = await recordLocalConnectCallSignal(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          payload: { sdp: "offer-sdp", type: "offer" },
          sender: "dashboard",
          type: "offer",
        },
        { indexPath }
      );
      const index = await readLocalConnectCallSignals({ indexPath });

      assert.equal(signal?.callId, "call-1");
      assert.equal(signal?.mainConnectUserPersonId, "person-bob");
      assert.equal(signal?.sender, "dashboard");
      assert.equal(signal?.type, "offer");
      assert.equal(index.signals.length, 1);
    });
  });

  it("filters signals by call, person, sender, and cursor", async () => {
    await withTempSignalIndex(async (indexPath) => {
      const first = await recordLocalConnectCallSignal(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          payload: { candidate: "first" },
          sender: "dashboard",
          type: "ice_candidate",
        },
        { indexPath }
      );
      const second = await recordLocalConnectCallSignal(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          payload: { sdp: "answer-sdp" },
          sender: "receiver",
          type: "answer",
        },
        { indexPath }
      );
      await recordLocalConnectCallSignal(
        {
          callId: "call-2",
          mainConnectUserPersonId: "person-bob",
          payload: { sdp: "other" },
          sender: "receiver",
          type: "answer",
        },
        { indexPath }
      );
      await recordLocalConnectCallSignal(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-alice",
          payload: { sdp: "wrong-person" },
          sender: "receiver",
          type: "answer",
        },
        { indexPath }
      );

      const index = await readLocalConnectCallSignals({ indexPath });
      const receiverSignals = filterLocalConnectCallSignals(index.signals, {
        callId: "call-1",
        mainConnectUserPersonId: "person-bob",
        notSender: "dashboard",
      });
      const afterFirst = filterLocalConnectCallSignals(index.signals, {
        afterSignalId: first?.signalId,
        callId: "call-1",
        mainConnectUserPersonId: "person-bob",
      });

      assert.deepEqual(
        receiverSignals.map((signal) => signal.signalId),
        [second?.signalId]
      );
      assert.deepEqual(
        afterFirst.map((signal) => signal.signalId),
        [second?.signalId]
      );
    });
  });

  it("rejects malformed signals", async () => {
    await withTempSignalIndex(async (indexPath) => {
      const signal = await recordLocalConnectCallSignal(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          payload: { sdp: "offer-sdp" },
          sender: "unknown",
          type: "offer",
        },
        { indexPath }
      );
      const index = await readLocalConnectCallSignals({ indexPath });

      assert.equal(signal, null);
      assert.equal(index.signals.length, 0);
    });
  });

  it("compacts stale call signals", async () => {
    await withTempSignalIndex(async (indexPath) => {
      await writeFile(
        indexPath,
        `${JSON.stringify(
          {
            signals: [
              {
                callId: "call-1",
                createdAt: "2026-06-24T10:00:00.000Z",
                mainConnectUserPersonId: "person-bob",
                payload: { sdp: "old-offer", type: "offer" },
                sender: "dashboard",
                signalId: "old-signal",
                type: "offer",
              },
              {
                callId: "call-2",
                createdAt: "2026-06-24T11:59:00.000Z",
                mainConnectUserPersonId: "person-bob",
                payload: { sdp: "new-offer", type: "offer" },
                sender: "dashboard",
                signalId: "new-signal",
                type: "offer",
              },
            ],
            updatedAt: "",
            version: 1,
          },
          null,
          2
        )}\n`
      );

      const compacted = await compactLocalConnectCallSignals({
        indexPath,
        maxAgeMs: 60 * 60 * 1000,
        now: new Date("2026-06-24T12:00:00.000Z"),
      });

      assert.deepEqual(
        compacted.signals.map((signal) => signal.signalId),
        ["new-signal"]
      );
    });
  });
});
