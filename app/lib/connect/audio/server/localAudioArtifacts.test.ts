import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  readLocalConnectAudioArtifacts,
  recordLocalConnectAudioArtifact,
} from "./localAudioArtifacts";

describe("local Connect audio artifacts", () => {
  it("records stored audio artifacts with classification metadata", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "connect-audio-index-"));
    const indexPath = path.join(dir, "artifacts.json");

    try {
      const artifact = await recordLocalConnectAudioArtifact(
        {
          audioByteSize: 42,
          audioMimeType: "audio/webm",
          audioSha256: "a".repeat(64),
          audioUrl: "/api/connect/audio/media/receiver/ask-input.webm",
          receiverId: "receiver",
          source: "ask-input",
          transcriptStatus: "not_configured",
        },
        { indexPath }
      );
      const index = await readLocalConnectAudioArtifacts({ indexPath });

      assert.equal(artifact.artifactKind, "ask_input");
      assert.equal(artifact.audioDirection, "receiver_local_input");
      assert.equal(index.artifacts.length, 1);
      assert.equal(index.artifacts[0]?.audioSha256, "a".repeat(64));
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("records Main Connect User and capture metadata for preserved audio", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "connect-audio-index-"));
    const indexPath = path.join(dir, "artifacts.json");

    try {
      const artifact = await recordLocalConnectAudioArtifact(
        {
          audioByteSize: 128,
          audioDurationMs: 2400,
          audioMimeType: "audio/webm",
          audioSha256: "b".repeat(64),
          audioUrl: "/api/connect/audio/media/receiver/message.webm",
          captureContext: {
            clientAudioCaptureId: "capture-1",
            captureRole: "receiver_user",
            captureSurface: "receiver_contact_message",
          },
          clientAudioCaptureId: "capture-1",
          mainConnectUserPersonId: "person-bob",
          receiverId: "receiver",
          source: "receiver_contact_message",
          transcript: "Hello Andrew",
          transcriptStatus: "completed",
        },
        { indexPath }
      );
      const index = await readLocalConnectAudioArtifacts({ indexPath });

      assert.equal(artifact.mainConnectUserPersonId, "person-bob");
      assert.equal(artifact.audioDurationMs, 2400);
      assert.deepEqual(artifact.captureContext, {
        clientAudioCaptureId: "capture-1",
        captureRole: "receiver_user",
        captureSurface: "receiver_contact_message",
      });
      assert.equal(index.artifacts[0]?.mainConnectUserPersonId, "person-bob");
      assert.equal(index.artifacts[0]?.transcriptStatus, "completed");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});
