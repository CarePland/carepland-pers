import { blobToBase64, createConnectAudioCaptureContext } from "./browserRecording";
import type {
  ConnectAudioCaptureContext,
  ConnectAudioArtifact,
} from "./types";
import { connectAuthHeaders } from "../context/client";

type RequestConnectAudioTranscriptionInput = {
  askInteractionId?: string;
  audioDirection?: string;
  artifactKind?: string;
  captureContext?: ConnectAudioCaptureContext | Record<string, unknown>;
  clientAudioCaptureId?: string;
  durationMs?: number;
  mainConnectUserPersonId?: string;
  mimeType?: string;
  receiverId?: string;
  recording: Blob;
  source?: string;
};

export async function requestConnectAudioTranscription({
  askInteractionId,
  audioDirection,
  artifactKind,
  captureContext,
  clientAudioCaptureId,
  durationMs = 0,
  mainConnectUserPersonId = "",
  mimeType = "",
  receiverId = "",
  recording,
  source = "audio_capture",
}: RequestConnectAudioTranscriptionInput) {
  const response = await fetch("/api/connect/audio/transcriptions", {
    body: JSON.stringify({
      askInteractionId,
      audioBase64: await blobToBase64(recording),
      audioDirection,
      audioDurationMs: durationMs,
      audioMimeType: mimeType || recording.type,
      artifactKind,
      captureContext:
        captureContext ??
        createConnectAudioCaptureContext(
          { blob: recording, durationMs, mimeType: mimeType || recording.type },
          {
            artifactKind,
            askInteractionId,
            audioDirection,
            clientAudioCaptureId,
            surface: source,
          }
        ),
      clientAudioCaptureId,
      mainConnectUserPersonId,
      receiverId,
      source,
    }),
    headers: {
      ...(await connectAuthHeaders()),
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    artifact?: ConnectAudioArtifact;
    audioMimeType?: string;
    audioUrl?: string;
    error?: string;
    ok?: boolean;
    transcript?: string;
    transcriptStatus?: string;
  };

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Audio transcription failed: ${response.status}`);
  }

  return payload;
}
