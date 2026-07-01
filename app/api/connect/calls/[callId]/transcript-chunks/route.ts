import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

import { readConnectCallPersonAccessForRequest } from "@/app/lib/connect/calls/server/callAccess";
import { generateConnectCallCareSummary } from "@/app/lib/connect/calls/server/callSummaryGeneration";
import {
  recordLocalConnectCallTranscriptSegment,
  updateLocalConnectCallSummary,
} from "@/app/lib/connect/calls/server/localCalls";
import {
  recordSupabaseConnectCallEvent,
  recordSupabaseConnectCallGeneratedSummary,
  recordSupabaseConnectCallTranscriptSegment,
} from "@/app/lib/connect/calls/server/supabaseCallStore";
import { normalizeConnectCallTranscriptChunk } from "@/app/lib/connect/calls/transcriptChunking";
import { transcribeConnectAudioFile } from "@/app/lib/connect/audio/server/transcription";

type RouteContext = {
  params: Promise<{ callId: string }>;
};

type TranscriptChunkPayload = {
  audioBase64?: string;
  audioDurationMs?: number;
  audioMimeType?: string;
  chunkEndedMs?: number;
  chunkIndex?: number;
  chunkStartedMs?: number;
  mainConnectUserPersonId?: string;
  overlapStartedMs?: number;
  source?: string;
};

export async function POST(request: Request, context: RouteContext) {
  let tempDir = "";

  try {
    const { callId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as TranscriptChunkPayload;
    const personId = payload.mainConnectUserPersonId?.trim() ?? "";
    const audioBase64 = String(payload.audioBase64 || "").trim();

    if (!personId) {
      return NextResponse.json(
        {
          error: "Select a Main Connect User before uploading a call transcript chunk.",
          ok: false,
        },
        { status: 400 }
      );
    }

    if (!audioBase64) {
      return NextResponse.json(
        { error: "audioBase64 is required for call transcript chunks.", ok: false },
        { status: 400 }
      );
    }

    const access = await readConnectCallPersonAccessForRequest(request, personId);
    const chunk = normalizeConnectCallTranscriptChunk(payload);
    tempDir = await mkdtemp(path.join(tmpdir(), "connect-call-chunk-"));
    const audioPath = path.join(tempDir, `chunk-${chunk.chunkIndex}.webm`);

    await writeFile(audioPath, Buffer.from(audioBase64, "base64"));
    const transcription = await transcribeConnectAudioFile(
      audioPath,
      payload.audioMimeType
    );
    const stored =
      (await recordSupabaseConnectCallTranscriptSegment(
        {
          audioDurationMs: payload.audioDurationMs,
          audioMimeType: payload.audioMimeType,
          callId,
          chunkEndedMs: chunk.chunkEndedMs,
          chunkIndex: chunk.chunkIndex,
          chunkStartedMs: chunk.chunkStartedMs,
          overlapStartedMs: chunk.overlapStartedMs,
          transcriptStatus: transcription.status,
          transcriptText: transcription.transcript,
        },
        access
      )) ??
      (await recordLocalConnectCallTranscriptSegment(
        {
          callId,
          chunkEndedMs: chunk.chunkEndedMs,
          chunkIndex: chunk.chunkIndex,
          chunkStartedMs: chunk.chunkStartedMs,
          mainConnectUserPersonId: personId,
          overlapStartedMs: chunk.overlapStartedMs,
          transcriptStatus: transcription.status,
          transcriptText: transcription.transcript,
        }
      ));

    void recordSupabaseConnectCallEvent(
      {
        actorRole: "system",
        callId,
        details: {
          chunkIndex: chunk.chunkIndex,
          source: payload.source || "connect_call_transcript_chunk",
          transcriptStatus: transcription.status,
        },
        eventType: "call_transcript_chunk_processed",
      },
      access
    );

    if (!stored) {
      return NextResponse.json(
        {
          error: "Call transcript chunk storage is unavailable.",
          ok: false,
        },
        { status: 503 }
      );
    }

    const refreshedSummary = await refreshTerminalCallSummaryFromTranscript({
      access,
      callId,
      personId,
      source: payload.source || "connect_call_transcript_chunk",
      stored,
    });

    return NextResponse.json({
      assembledTranscriptText: stored.assembledTranscriptText,
      chunk,
      ok: true,
      segment: stored.segment,
      summaryStatus: refreshedSummary?.summaryStatus,
      transcriptStatus: transcription.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process Connect call transcript chunk.",
        ok: false,
      },
      { status: 500 }
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
    }
  }
}

async function refreshTerminalCallSummaryFromTranscript({
  access,
  callId,
  personId,
  source,
  stored,
}: {
  access: Awaited<ReturnType<typeof readConnectCallPersonAccessForRequest>>;
  callId: string;
  personId: string;
  source: string;
  stored: {
    assembledTranscriptText?: string;
    call?: {
      state?: string;
      summaryStatus?: string;
      transcriptText?: string;
    };
  };
}) {
  const call = stored.call;
  const transcriptText = String(
    stored.assembledTranscriptText || call?.transcriptText || ""
  ).trim();

  if (!call || !transcriptText) return null;
  if (!terminalCallStates.has(String(call.state || ""))) return null;
  if (String(call.summaryStatus || "") === "approved") return null;

  const generatedSummary = await generateConnectCallCareSummary({ transcriptText });
  const summaryCall =
    (await recordSupabaseConnectCallGeneratedSummary(
      callId,
      {
        summaryStatus: generatedSummary.summaryStatus,
        summaryText: generatedSummary.summaryText,
      },
      access
    )) ??
    (await updateLocalConnectCallSummary(callId, {
      mainConnectUserPersonId: personId,
      summaryStatus: generatedSummary.summaryStatus,
      summaryText: generatedSummary.summaryText,
    }));

  void recordSupabaseConnectCallEvent(
    {
      actorRole: "system",
      callId,
      details: {
        source,
        summaryStatus: generatedSummary.summaryStatus,
      },
      eventType: "call_summary_refreshed_after_transcript_chunk",
    },
    access
  );

  return summaryCall ?? generatedSummary;
}

const terminalCallStates = new Set([
  "declined",
  "failed",
  "hung_up",
  "missed",
  "receiver_unavailable",
]);
