import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assembleConnectCallTranscript,
  connectCallTranscriptChunkOverlapMs,
  connectCallTranscriptChunkStepMs,
  connectCallTranscriptChunkWindowMs,
  normalizeConnectCallTranscriptChunk,
} from "./transcriptChunking";

describe("Connect call transcript chunking", () => {
  it("uses the 35 second window, 30 second step, and 5 second overlap model", () => {
    assert.equal(connectCallTranscriptChunkWindowMs, 35_000);
    assert.equal(connectCallTranscriptChunkStepMs, 30_000);
    assert.equal(connectCallTranscriptChunkOverlapMs, 5_000);

    assert.deepEqual(normalizeConnectCallTranscriptChunk({ chunkIndex: 2 }), {
      chunkEndedMs: 95_000,
      chunkIndex: 2,
      chunkStartedMs: 60_000,
      overlapStartedMs: 90_000,
    });
  });

  it("stitches overlapping transcript text without duplicating matching phrases", () => {
    const transcript = assembleConnectCallTranscript([
      {
        chunkEndedMs: 35_000,
        chunkIndex: 0,
        chunkStartedMs: 0,
        overlapStartedMs: 30_000,
        transcriptStatus: "completed",
        transcriptText: "She started the new blood pressure medicine and",
      },
      {
        chunkEndedMs: 65_000,
        chunkIndex: 1,
        chunkStartedMs: 30_000,
        overlapStartedMs: 60_000,
        transcriptStatus: "completed",
        transcriptText: "blood pressure medicine and felt dizzy this morning.",
      },
    ]);

    assert.equal(
      transcript,
      "She started the new blood pressure medicine and felt dizzy this morning."
    );
  });

  it("omits failed or blank transcript chunks from the assembled transcript", () => {
    const transcript = assembleConnectCallTranscript([
      {
        chunkEndedMs: 35_000,
        chunkIndex: 0,
        chunkStartedMs: 0,
        overlapStartedMs: 30_000,
        transcriptStatus: "failed",
        transcriptText: "ignore me",
      },
      {
        chunkEndedMs: 65_000,
        chunkIndex: 1,
        chunkStartedMs: 30_000,
        overlapStartedMs: 60_000,
        transcriptStatus: "completed",
        transcriptText: "Keep this care relevant chunk.",
      },
    ]);

    assert.equal(transcript, "Keep this care relevant chunk.");
  });
});
