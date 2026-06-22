import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  PreservedAudioStorageAdapter,
  PreservedAudioStorageObject,
  PreserveAudioInput,
} from "./storage";

type LocalAudioStorageOptions = {
  baseDir: string;
  publicUrlPrefix?: string;
};

export function createLocalFileAudioStorageAdapter({
  baseDir,
  publicUrlPrefix = "/uploads/audio",
}: LocalAudioStorageOptions): PreservedAudioStorageAdapter {
  return {
    async preserveOriginalAudio(input: PreserveAudioInput) {
      const bytes = await audioInputBytes(input);

      if (!bytes.length) {
        throw new Error("Audio payload is empty.");
      }

      await mkdir(baseDir, { recursive: true });

      const createdAt = new Date().toISOString();
      const storageKey = [
        safePathPart(input.receiverId || "unknown-receiver"),
        `${safePathPart(input.intent)}-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2, 8)}${audioExtensionForMimeType(input.audioMimeType)}`,
      ].join("/");
      const filePath = path.join(baseDir, storageKey);

      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, bytes);

      return {
        audioByteSize: bytes.length,
        audioMimeType: input.audioMimeType || "",
        audioSha256: createHash("sha256").update(bytes).digest("hex"),
        audioUrl: `${publicUrlPrefix.replace(/\/$/, "")}/${storageKey}`,
        createdAt,
        storageKey,
      } satisfies PreservedAudioStorageObject;
    },
  };
}

async function audioInputBytes(input: PreserveAudioInput) {
  if (input.audioBase64) {
    return Buffer.from(input.audioBase64.trim(), "base64");
  }

  if (input.audioBlob) {
    return Buffer.from(await input.audioBlob.arrayBuffer());
  }

  return Buffer.alloc(0);
}

function audioExtensionForMimeType(mimeType = "") {
  const value = mimeType.toLowerCase();
  if (value.includes("webm")) return ".webm";
  if (value.includes("mpeg") || value.includes("mp3")) return ".mp3";
  if (value.includes("wav")) return ".wav";
  if (value.includes("ogg")) return ".ogg";
  if (value.includes("mp4")) return ".m4a";
  return ".audio";
}

function safePathPart(value: string) {
  return value.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "audio";
}
