import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { readLocalConnectAudioArtifacts } from "../../audio/server/localAudioArtifacts";
import { ensureAudioMessageOriginalPreserved } from "./audioMessagePersistence";

describe("audio message persistence", () => {
  it("preserves raw audio on message send when no audio URL exists yet", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "connect-audio-message-"));
    const uploadsDir = path.join(dir, "uploads");
    const audioIndexPath = path.join(dir, "artifacts.json");

    try {
      const message = await ensureAudioMessageOriginalPreserved(
        {
          artifactKind: "receiver_message",
          audioBase64: Buffer.from("voice-message").toString("base64"),
          audioDirection: "receiver_to_coordinator",
          audioDurationMs: 1200,
          audioMimeType: "audio/webm",
          body: "Voice message",
          from: "receiver_user",
          mainConnectUserPersonId: "person-bob",
          receiverId: "living-room",
          source: "receiver_contact_message",
          to: "Andrew",
        },
        { audioIndexPath, uploadsDir }
      );
      const artifacts = await readLocalConnectAudioArtifacts({ indexPath: audioIndexPath });

      assert.equal(message.messageType, "audio");
      assert.match(message.audioArtifactId ?? "", /^audio-artifact-/);
      assert.match(
        message.audioUrl ?? "",
        /^\/api\/connect\/audio\/media\/living-room\/receiver-message-.*\.webm$/
      );
      assert.equal(artifacts.artifacts.length, 1);
      assert.equal(artifacts.artifacts[0]?.artifactKind, "receiver_message");
      assert.equal(artifacts.artifacts[0]?.audioDirection, "receiver_to_coordinator");
      assert.equal(artifacts.artifacts[0]?.mainConnectUserPersonId, "person-bob");
      assert.equal(
        await readFile(
          path.join(
            uploadsDir,
            String(message.audioUrl || "").replace("/api/connect/audio/media/", "")
          ),
          "utf8"
        ),
        "voice-message"
      );
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("does not duplicate audio when the message already has a preserved URL", async () => {
    const message = await ensureAudioMessageOriginalPreserved({
      audioBase64: Buffer.from("voice-message").toString("base64"),
      audioUrl: "/api/connect/audio/media/living-room/existing.webm",
      body: "Voice message",
    });

    assert.equal(message.audioUrl, "/api/connect/audio/media/living-room/existing.webm");
    assert.equal("audioBase64" in message, false);
  });
});
