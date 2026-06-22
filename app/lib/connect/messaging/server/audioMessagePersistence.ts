import { classifyConnectAudioArtifact } from "../../audio/domain";
import {
  localConnectAudioUploadsDir,
  recordLocalConnectAudioArtifact,
} from "../../audio/server/localAudioArtifacts";
import type { ConnectAudioCaptureContext } from "../../audio/types";
import { createLocalFileAudioStorageAdapter } from "../../../platform/audio/localFileStorage";
import type { ConnectMessageRecord } from "../types";

export type ConnectAudioMessagePayload = Partial<ConnectMessageRecord> & {
  artifactKind?: string;
  audioBase64?: string;
  audioDirection?: string;
  captureContext?: ConnectAudioCaptureContext | Record<string, unknown>;
  clientAudioCaptureId?: string;
};

type EnsureAudioMessageOptions = {
  audioIndexPath?: string;
  uploadsDir?: string;
};

export async function ensureAudioMessageOriginalPreserved(
  payload: ConnectAudioMessagePayload,
  options: EnsureAudioMessageOptions = {}
): Promise<Partial<ConnectMessageRecord>> {
  const audioBase64 = String(payload.audioBase64 || "").trim();

  if (!audioBase64 || payload.audioUrl) {
    return stripTransientAudioFields(payload);
  }

  const classification = classifyConnectAudioArtifact({
    artifactKind: payload.artifactKind,
    audioDirection: payload.audioDirection,
    from: payload.from,
    source: payload.source,
    to: payload.to,
  });
  const storage = createLocalFileAudioStorageAdapter({
    baseDir: options.uploadsDir ?? localConnectAudioUploadsDir(),
    publicUrlPrefix: "/api/connect/audio/media",
  });
  const preserved = await storage.preserveOriginalAudio({
    audioBase64,
    audioMimeType: payload.audioMimeType,
    intent: classification.artifactKind,
    receiverId: payload.receiverId,
  });
  const artifact = await recordLocalConnectAudioArtifact(
    {
      audioByteSize: preserved.audioByteSize,
      audioDirection: classification.audioDirection,
      audioDurationMs: payload.audioDurationMs,
      audioMimeType: payload.audioMimeType || preserved.audioMimeType,
      audioSha256: preserved.audioSha256,
      audioUrl: preserved.audioUrl,
      artifactKind: classification.artifactKind,
      captureContext: payload.captureContext,
      clientAudioCaptureId: payload.clientAudioCaptureId,
      mainConnectUserPersonId: payload.mainConnectUserPersonId,
      receiverId: payload.receiverId,
      source: payload.source || "connect_audio_message",
      transcript: payload.transcript,
      transcriptStatus: payload.transcriptStatus || "not_requested",
    },
    options.audioIndexPath ? { indexPath: options.audioIndexPath } : {}
  );

  return {
    ...stripTransientAudioFields(payload),
    audioArtifactId: artifact.artifactId || artifact.id,
    audioMimeType: artifact.audioMimeType,
    audioUrl: artifact.audioUrl,
    messageType: payload.messageType || "audio",
    transcriptStatus: payload.transcriptStatus || "not_requested",
  };
}

function stripTransientAudioFields(
  payload: ConnectAudioMessagePayload
): Partial<ConnectMessageRecord> {
  const message = { ...payload };
  delete message.artifactKind;
  delete message.audioBase64;
  delete message.audioDirection;
  delete message.captureContext;
  delete message.clientAudioCaptureId;

  return message;
}
