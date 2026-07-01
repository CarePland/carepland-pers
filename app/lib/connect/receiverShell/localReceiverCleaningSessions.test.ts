import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  readLocalReceiverCleaningSessions,
  recordLocalReceiverCleaningSession,
} from "./localReceiverCleaningSessions";

describe("local Receiver screen cleaning sessions", () => {
  it("records start and completion details for one cleaning session", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "receiver-cleaning-"));
    const indexPath = path.join(dir, "screen-cleaning-sessions.json");

    try {
      await recordLocalReceiverCleaningSession(
        {
          cleaningCount: 5,
          cleaningStartedAt: "2026-06-28T12:00:00.000Z",
          deviceIdentifier: "receiver-device-1",
          mainConnectUserPersonId: "person-bob",
          message: "Thanks for the fifth cleaning.\nI feel better already!",
          receiverDeviceId: "receiver-device-1",
          receiverInstallId: "install-1",
          receiverMode: "Dedicated",
          sessionId: "cleaning-1",
        },
        { indexPath }
      );

      await recordLocalReceiverCleaningSession(
        {
          cleaningCompletedAt: "2026-06-28T12:02:00.000Z",
          cleaningStartedAt: "2026-06-28T12:00:00.000Z",
          duration: 120,
          sessionId: "cleaning-1",
        },
        { indexPath }
      );

      const index = await readLocalReceiverCleaningSessions({ indexPath });
      const session = index.sessions[0];

      assert.equal(index.sessions.length, 1);
      assert.equal(session?.cleaningCount, 5);
      assert.equal(session?.cleaningCompletedAt, "2026-06-28T12:02:00.000Z");
      assert.equal(session?.duration, 120);
      assert.equal(session?.mainConnectUserPersonId, "person-bob");
      assert.equal(session?.message, "Thanks for the fifth cleaning.\nI feel better already!");
      assert.equal(session?.receiverMode, "Dedicated");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});
