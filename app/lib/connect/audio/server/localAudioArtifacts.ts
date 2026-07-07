import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  classifyConnectAudioArtifact,
  type ConnectAudioArtifactKind,
  type ConnectAudioDirection,
} from "../domain";
import { careplandRuntimeTempPath } from "../../../platform/server/runtimeTemp";
import type { ConnectAudioArtifact, ConnectAudioCaptureContext } from "../types";

type LocalAudioArtifactInput = {
  askInteractionId?: string;
  audioByteSize?: number;
  audioDirection?: string;
  audioDurationMs?: number;
  audioMimeType?: string;
  audioSha256?: string;
  audioUrl?: string;
  artifactKind?: string;
  captureContext?: ConnectAudioCaptureContext | Record<string, unknown>;
  clientAudioCaptureId?: string;
  mainConnectUserPersonId?: string;
  receiverId?: string;
  source?: string;
  transcript?: string;
  transcriptStatus?: string;
};

type LocalAudioArtifactIndex = {
  artifacts: ConnectAudioArtifact[];
  updatedAt: string;
  version: 1;
};

const defaultIndexPath = careplandRuntimeTempPath("connect-audio", "artifacts.json");

export function localConnectAudioUploadsDir() {
  return careplandRuntimeTempPath("connect-audio", "uploads");
}

export async function recordLocalConnectAudioArtifact(
  input: LocalAudioArtifactInput,
  options: { indexPath?: string } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalAudioArtifactIndex(indexPath);
  const classification = classifyConnectAudioArtifact({
    artifactKind: input.artifactKind,
    audioDirection: input.audioDirection,
    audioUrl: input.audioUrl,
    source: input.source,
  });
  const createdAt = new Date().toISOString();
  const artifactId = `audio-artifact-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;
  const artifact: ConnectAudioArtifact = {
    artifactId,
    artifactKind: classification.artifactKind satisfies ConnectAudioArtifactKind,
    audioByteSize: input.audioByteSize,
    audioDirection:
      classification.audioDirection satisfies ConnectAudioDirection,
    audioDurationMs: input.audioDurationMs,
    audioMimeType: input.audioMimeType,
    audioSha256: input.audioSha256,
    audioUrl: input.audioUrl,
    captureContext: input.captureContext,
    createdAt,
    id: artifactId,
    mainConnectUserPersonId: input.mainConnectUserPersonId,
    receiverId: input.receiverId,
    source: input.source,
    transcript: input.transcript,
    transcriptStatus: input.transcriptStatus,
  };

  index.artifacts.unshift(artifact);
  await writeLocalAudioArtifactIndex(index, indexPath);

  return artifact;
}

export async function readLocalConnectAudioArtifacts(
  options: { indexPath?: string } = {}
) {
  return readLocalAudioArtifactIndex(options.indexPath ?? defaultIndexPath);
}

async function readLocalAudioArtifactIndex(indexPath: string) {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as Partial<
      LocalAudioArtifactIndex
    >;

    if (Array.isArray(parsed.artifacts)) {
      return {
        artifacts: parsed.artifacts,
        updatedAt: parsed.updatedAt || "",
        version: 1,
      } satisfies LocalAudioArtifactIndex;
    }
  } catch {
    // Start a local dev index on first write.
  }

  return {
    artifacts: [],
    updatedAt: "",
    version: 1,
  } satisfies LocalAudioArtifactIndex;
}

async function writeLocalAudioArtifactIndex(
  index: LocalAudioArtifactIndex,
  indexPath: string
) {
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(
    indexPath,
    `${JSON.stringify({ ...index, updatedAt: new Date().toISOString() }, null, 2)}\n`
  );
}
