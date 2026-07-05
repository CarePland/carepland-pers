import { NextResponse } from "next/server";
import path from "node:path";

import { classifyConnectAudioArtifact } from "@/app/lib/connect/audio/domain";
import {
  localConnectAudioUploadsDir,
  recordLocalConnectAudioArtifact,
} from "@/app/lib/connect/audio/server/localAudioArtifacts";
import { transcribeConnectAudioFile } from "@/app/lib/connect/audio/server/transcription";
import type { ConnectAudioCaptureContext } from "@/app/lib/connect/audio/types";
import { verifyConnectAudioPersonAccess } from "@/app/lib/connect/audio/server/audioAccess";
import { createLocalFileAudioStorageAdapter } from "@/app/lib/platform/audio/localFileStorage";

type AudioTranscriptionRequest = {
  askInteractionId?: string;
  audioBase64?: string;
  audioDirection?: string;
  audioDurationMs?: number;
  audioMimeType?: string;
  artifactKind?: string;
  captureContext?: ConnectAudioCaptureContext | Record<string, unknown>;
  clientAudioCaptureId?: string;
  mainConnectUserPersonId?: string;
  receiverId?: string;
  source?: string;
};

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as AudioTranscriptionRequest;
  const audioBase64 = String(payload.audioBase64 || "").trim();
  const personId = payload.mainConnectUserPersonId?.trim() ?? "";

  if (!audioBase64) {
    return NextResponse.json(
      { error: "audioBase64 is required", ok: false },
      { status: 400 }
    );
  }

  if (!personId) {
    return NextResponse.json(
      { error: "Select a Main Connect User before transcribing Connect audio.", ok: false },
      { status: 400 }
    );
  }

  try {
    const deniedResponse = await verifyConnectAudioPersonAccess(
      personId,
      request,
      {},
      { body: payload as unknown as Record<string, unknown> }
    );
    if (deniedResponse) return deniedResponse;

    const source = String(payload.source || "audio_capture").trim() || "audio_capture";
    const classification = classifyConnectAudioArtifact({
      artifactKind: payload.artifactKind,
      audioDirection: payload.audioDirection,
      source,
    });
    const uploadsDir = localConnectAudioUploadsDir();
    const storage = createLocalFileAudioStorageAdapter({
      baseDir: uploadsDir,
      publicUrlPrefix: "/api/connect/audio/media",
    });
    const preserved = await storage.preserveOriginalAudio({
      audioBase64,
      audioMimeType: payload.audioMimeType,
      intent: classification.artifactKind,
      receiverId: payload.receiverId,
    });
    const audioPath = path.join(uploadsDir, preserved.storageKey || "");
    const transcription = await transcribeConnectAudioFile(
      audioPath,
      payload.audioMimeType
    );
    const artifact = await recordLocalConnectAudioArtifact({
      askInteractionId: payload.askInteractionId,
      audioByteSize: preserved.audioByteSize,
      audioDirection: classification.audioDirection,
      audioDurationMs: Number(payload.audioDurationMs || 0),
      audioMimeType: payload.audioMimeType || preserved.audioMimeType,
      audioSha256: preserved.audioSha256,
      audioUrl: preserved.audioUrl,
      artifactKind: classification.artifactKind,
      captureContext: payload.captureContext,
      clientAudioCaptureId: payload.clientAudioCaptureId,
      mainConnectUserPersonId: personId,
      receiverId: payload.receiverId,
      source,
      transcript: transcription.transcript,
      transcriptStatus: transcription.status,
    });

    return NextResponse.json({
      artifact,
      audioMimeType: artifact.audioMimeType,
      audioUrl: artifact.audioUrl,
      ok: true,
      transcript: transcription.transcript,
      transcriptStatus: transcription.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to preserve and transcribe audio.",
        ok: false,
      },
      { status: 500 }
    );
  }
}
