import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { createLocalFileAudioStorageAdapter } from "./localFileStorage";

describe("local file audio storage", () => {
  it("preserves original audio and returns integrity metadata", async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), "carepland-audio-"));

    try {
      const storage = createLocalFileAudioStorageAdapter({
        baseDir,
        publicUrlPrefix: "/dev-audio",
      });
      const result = await storage.preserveOriginalAudio({
        audioBase64: Buffer.from("audio-bytes").toString("base64"),
        audioMimeType: "audio/webm",
        intent: "ask_input",
        receiverId: "living-room-receiver",
      });

      assert.equal(result.audioByteSize, 11);
      assert.equal(result.audioMimeType, "audio/webm");
      assert.match(result.audioSha256 ?? "", /^[a-f0-9]{64}$/);
      assert.match(
        result.audioUrl,
        /^\/dev-audio\/living-room-receiver\/ask-input-.*\.webm$/
      );
      assert.equal(
        await readFile(path.join(baseDir, result.storageKey ?? ""), "utf8"),
        "audio-bytes"
      );
    } finally {
      await rm(baseDir, { force: true, recursive: true });
    }
  });
});
