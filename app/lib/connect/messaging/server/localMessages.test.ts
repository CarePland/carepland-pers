import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  readLocalConnectMessages,
  recordLocalConnectMessage,
  updateLocalConnectMessageState,
} from "./localMessages";

describe("local Connect messages", () => {
  it("records messages with audio artifact references and state updates", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "connect-messages-"));
    const indexPath = path.join(dir, "messages.json");

    try {
      const message = await recordLocalConnectMessage(
        {
          audioArtifactId: "audio-artifact-1",
          audioMimeType: "audio/webm",
          audioUrl: "/api/connect/audio/media/receiver/audio.webm",
          body: "Voice message",
          from: "receiver_user",
          mainConnectUserPersonId: "person-bob",
          receiverId: "living-room-receiver",
          to: "Andrew",
          transcriptStatus: "completed",
        },
        { indexPath }
      );
      await updateLocalConnectMessageState(message.id, "heard", { indexPath });
      const index = await readLocalConnectMessages({ indexPath });

      assert.equal(index.messages.length, 1);
      assert.equal(index.messages[0]?.audioArtifactId, "audio-artifact-1");
      assert.equal(Boolean(index.messages[0]?.heardAt), true);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("does not update message state for another Main Connect User", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "connect-messages-"));
    const indexPath = path.join(dir, "messages.json");

    try {
      const message = await recordLocalConnectMessage(
        {
          body: "For Bob",
          from: "Andrew",
          mainConnectUserPersonId: "person-bob",
          to: "Bob",
        },
        { indexPath }
      );
      const updated = await updateLocalConnectMessageState(message.id, "read", {
        indexPath,
        mainConnectUserPersonId: "person-alice",
      });
      const index = await readLocalConnectMessages({ indexPath });

      assert.equal(updated, null);
      assert.equal(index.messages[0]?.readAt, "");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("keeps local fallback messages person-owned instead of receiver-owned", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "connect-messages-"));
    const indexPath = path.join(dir, "messages.json");

    try {
      const message = await recordLocalConnectMessage(
        {
          body: "Dinner is ready.",
          from: "Andrew",
          mainConnectUserPersonId: "person-bob",
          receiverDeviceId: "old-bedroom-receiver",
          receiverId: "old-bedroom-receiver",
          to: "Bob",
        },
        { indexPath }
      );
      const index = await readLocalConnectMessages({ indexPath });

      assert.equal(message.mainConnectUserPersonId, "person-bob");
      assert.equal(message.receiverDeviceId, "");
      assert.equal(message.receiverId, "");
      assert.equal(index.messages[0]?.mainConnectUserPersonId, "person-bob");
      assert.equal(index.messages[0]?.receiverDeviceId, "");
      assert.equal(index.messages[0]?.receiverId, "");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("records acknowledgement and callback request state for local fallback", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "connect-messages-"));
    const indexPath = path.join(dir, "messages.json");

    try {
      const message = await recordLocalConnectMessage(
        {
          allowsCallbackRequest: true,
          body: "Please call when you can.",
          from: "Andrew",
          mainConnectUserPersonId: "person-bob",
          requiresAcknowledgement: true,
          to: "Bob",
        },
        { indexPath }
      );
      await updateLocalConnectMessageState(message.id, "acknowledged", {
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });
      await updateLocalConnectMessageState(message.id, "callback_requested", {
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });
      const index = await readLocalConnectMessages({ indexPath });

      assert.equal(index.messages[0]?.requiresAcknowledgement, true);
      assert.equal(index.messages[0]?.allowsCallbackRequest, true);
      assert.equal(Boolean(index.messages[0]?.acknowledgedAt), true);
      assert.equal(Boolean(index.messages[0]?.callbackRequestedAt), true);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});
