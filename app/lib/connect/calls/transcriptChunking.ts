export const connectCallTranscriptChunkWindowMs = 35_000;
export const connectCallTranscriptChunkStepMs = 30_000;
export const connectCallTranscriptChunkOverlapMs =
  connectCallTranscriptChunkWindowMs - connectCallTranscriptChunkStepMs;

export type ConnectCallTranscriptSegment = {
  chunkEndedMs: number;
  chunkIndex: number;
  chunkStartedMs: number;
  overlapStartedMs: number;
  transcriptStatus: string;
  transcriptText: string;
};

export function normalizeConnectCallTranscriptChunk(input: {
  chunkEndedMs?: unknown;
  chunkIndex?: unknown;
  chunkStartedMs?: unknown;
  overlapStartedMs?: unknown;
}) {
  const chunkIndex = Math.max(0, Math.floor(Number(input.chunkIndex || 0)));
  const chunkStartedMs = Math.max(
    0,
    Math.floor(Number(input.chunkStartedMs ?? chunkIndex * connectCallTranscriptChunkStepMs))
  );
  const chunkEndedMs = Math.max(
    chunkStartedMs,
    Math.floor(
      Number(input.chunkEndedMs ?? chunkStartedMs + connectCallTranscriptChunkWindowMs)
    )
  );
  const overlapStartedMs = Math.max(
    chunkStartedMs,
    Math.floor(
      Number(input.overlapStartedMs ?? chunkEndedMs - connectCallTranscriptChunkOverlapMs)
    )
  );

  return {
    chunkEndedMs,
    chunkIndex,
    chunkStartedMs,
    overlapStartedMs: Math.min(overlapStartedMs, chunkEndedMs),
  };
}

export function assembleConnectCallTranscript(
  segments: ConnectCallTranscriptSegment[]
) {
  const completedSegments = [...segments]
    .filter(
      (segment) =>
        segment.transcriptStatus === "completed" && Boolean(segment.transcriptText.trim())
    )
    .sort((a, b) => a.chunkIndex - b.chunkIndex);

  let assembled = "";

  for (const segment of completedSegments) {
    assembled = appendTranscriptSegment(assembled, segment.transcriptText);
  }

  return assembled.trim();
}

function appendTranscriptSegment(assembled: string, nextText: string) {
  const current = assembled.trim();
  const next = nextText.trim();

  if (!current) return next;
  if (!next) return current;

  const currentWords = current.split(/\s+/);
  const nextWords = next.split(/\s+/);
  const maxOverlap = Math.min(24, currentWords.length, nextWords.length);

  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    const currentTail = currentWords.slice(-overlap).join(" ").toLowerCase();
    const nextHead = nextWords.slice(0, overlap).join(" ").toLowerCase();

    if (currentTail === nextHead) {
      return `${current} ${nextWords.slice(overlap).join(" ")}`.trim();
    }
  }

  return `${current} ${next}`.trim();
}
