import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ConnectCallRecord } from "../callScoping";
import type { ConnectCallTranscriptSegment } from "../transcriptChunking";
import { assembleConnectCallTranscript } from "../transcriptChunking";

export type ConnectCallState =
  | "answered"
  | "connected"
  | "declined"
  | "failed"
  | "hung_up"
  | "missed"
  | "receiver_unavailable"
  | "ringing";

type LocalCallsIndex = {
  calls: ConnectCallRecord[];
  updatedAt: string;
  version: 1;
};

const defaultIndexPath = path.join(process.cwd(), "tmp", "connect-calls", "calls.json");
const defaultRingingTimeoutMs = 45_000;

const connectCallStates = new Set<string>([
  "answered",
  "connected",
  "declined",
  "failed",
  "hung_up",
  "missed",
  "receiver_unavailable",
  "ringing",
]);

const callStateTransitions: Record<ConnectCallState, Set<ConnectCallState>> = {
  answered: new Set(["connected", "failed", "hung_up"]),
  connected: new Set(["failed", "hung_up"]),
  declined: new Set([]),
  failed: new Set([]),
  hung_up: new Set([]),
  missed: new Set([]),
  receiver_unavailable: new Set([]),
  ringing: new Set([
    "answered",
    "connected",
    "declined",
    "failed",
    "hung_up",
    "missed",
    "receiver_unavailable",
  ]),
};

export async function readLocalConnectCalls(options: { indexPath?: string } = {}) {
  return readLocalCallsIndex(options.indexPath ?? defaultIndexPath);
}

export async function markStaleLocalConnectCallsMissed(
  options: { indexPath?: string; now?: Date; ringingTimeoutMs?: number } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalCallsIndex(indexPath);
  const nowMs = (options.now ?? new Date()).getTime();
  const timeoutMs = options.ringingTimeoutMs ?? defaultRingingTimeoutMs;
  let changed = 0;

  index.calls = index.calls.map((call) => {
    if (call.state !== "ringing") return call;

    const updatedAtMs = Date.parse(call.updatedAt || "");
    if (!Number.isFinite(updatedAtMs) || nowMs - updatedAtMs < timeoutMs) return call;

    changed += 1;
    return {
      ...call,
      state: "missed",
      updatedAt: new Date(nowMs).toISOString(),
    };
  });

  if (changed > 0) {
    await writeLocalCallsIndex(index, indexPath);
  }

  return changed;
}

export async function recordLocalConnectCall(
  input: Partial<ConnectCallRecord> & {
    receiverId?: string;
  },
  options: { indexPath?: string } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalCallsIndex(indexPath);
  const now = new Date().toISOString();
  const personId = input.mainConnectUserPersonId || input.recipientPersonId || "";
  const call: ConnectCallRecord = {
    approvedSummaryText: input.approvedSummaryText,
    callId:
      input.callId ||
      `connect-call-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    callerName: input.callerName || "Andrew",
    mainConnectUserPersonId: personId,
    modelSummaryText: input.modelSummaryText,
    recipientName: input.recipientName || "",
    recipientPersonId: personId,
    state: isConnectCallState(input.state) ? input.state : "ringing",
    summaryApprovedAt: input.summaryApprovedAt,
    summaryApprovedBy: input.summaryApprovedBy,
    summaryStatus: input.summaryStatus || "not_requested",
    summaryText: input.summaryText,
    transcriptDeletedAt: input.transcriptDeletedAt,
    transcriptStatus: input.transcriptStatus || "not_started",
    transcriptText: input.transcriptText,
    updatedAt: input.updatedAt || now,
  };

  index.calls = [
    call,
    ...index.calls.filter((item) => item.callId !== call.callId),
  ].slice(0, 300);
  await writeLocalCallsIndex(index, indexPath);

  return call;
}

export async function updateLocalConnectCallState(
  callId: string,
  state: string,
  options: { indexPath?: string; mainConnectUserPersonId?: string } = {}
): Promise<ConnectCallRecord | null> {
  if (!isConnectCallState(state)) return null;

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalCallsIndex(indexPath);
  let updated: ConnectCallRecord | null = null;

  index.calls = index.calls.map((call) => {
    if (call.callId !== callId) return call;
    if (
      options.mainConnectUserPersonId &&
      call.mainConnectUserPersonId !== options.mainConnectUserPersonId &&
      call.recipientPersonId !== options.mainConnectUserPersonId
    ) {
      return call;
    }

    const currentState = isConnectCallState(call.state) ? call.state : "ringing";
    if (!callStateTransitions[currentState].has(state)) {
      updated = call;
      return call;
    }

    updated = {
      ...call,
      state,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });

  if (updated) {
    await writeLocalCallsIndex(index, indexPath);
  }

  return updated;
}

export async function approveLocalConnectCallSummary(
  callId: string,
  options: {
    approvedBy?: string;
    approvedSummaryText?: string;
    indexPath?: string;
    mainConnectUserPersonId?: string;
  } = {}
): Promise<ConnectCallRecord | null> {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalCallsIndex(indexPath);
  const now = new Date().toISOString();
  let updated: ConnectCallRecord | null = null;

  index.calls = index.calls.map((call) => {
    if (call.callId !== callId) return call;
    if (
      options.mainConnectUserPersonId &&
      call.mainConnectUserPersonId !== options.mainConnectUserPersonId &&
      call.recipientPersonId !== options.mainConnectUserPersonId
    ) {
      return call;
    }

    const approvedSummaryText =
      options.approvedSummaryText?.trim() || call.summaryText || "";
    updated = {
      ...call,
      approvedSummaryText,
      modelSummaryText: call.modelSummaryText || call.summaryText || "",
      summaryApprovedAt: now,
      summaryApprovedBy: options.approvedBy || "receiver",
      summaryStatus: "approved",
      summaryText: approvedSummaryText,
      transcriptDeletedAt: now,
      transcriptCleanupStatus: "completed",
      transcriptStatus: "deleted",
      transcriptText: undefined,
      updatedAt: now,
    };
    return updated;
  });

  if (updated) {
    await writeLocalCallsIndex(index, indexPath);
  }

  return updated;
}

export async function recordLocalConnectCallTranscriptSegment(
  input: {
    callId: string;
    chunkEndedMs: number;
    chunkIndex: number;
    chunkStartedMs: number;
    mainConnectUserPersonId?: string;
    overlapStartedMs: number;
    transcriptStatus: string;
    transcriptText: string;
  },
  options: { indexPath?: string } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalCallsIndex(indexPath);
  const now = new Date().toISOString();
  let updated: ConnectCallRecord | null = null;
  let storedSegment: ConnectCallTranscriptSegment | null = null;

  index.calls = index.calls.map((call) => {
    if (call.callId !== input.callId) return call;
    if (
      input.mainConnectUserPersonId &&
      call.mainConnectUserPersonId !== input.mainConnectUserPersonId &&
      call.recipientPersonId !== input.mainConnectUserPersonId
    ) {
      return call;
    }

    const previousTranscript = call.transcriptText?.trim();
    const segment: ConnectCallTranscriptSegment = {
      chunkEndedMs: input.chunkEndedMs,
      chunkIndex: input.chunkIndex,
      chunkStartedMs: input.chunkStartedMs,
      overlapStartedMs: input.overlapStartedMs,
      transcriptStatus: input.transcriptStatus,
      transcriptText: input.transcriptText,
    };
    storedSegment = segment;
    const nextTranscriptText = assembleConnectCallTranscript([
      previousTranscript
        ? {
            chunkEndedMs: Math.max(0, input.chunkStartedMs - 1),
            chunkIndex: input.chunkIndex - 1,
            chunkStartedMs: 0,
            overlapStartedMs: 0,
            transcriptStatus: "completed",
            transcriptText: previousTranscript,
          }
        : null,
      segment,
    ].filter((item): item is ConnectCallTranscriptSegment => Boolean(item)));
    const transcriptStatus = nextTranscriptText
      ? "capturing"
      : input.transcriptStatus === "failed" || input.transcriptStatus === "not_configured"
        ? "failed"
        : "not_started";

    updated = {
      ...call,
      transcriptStatus,
      transcriptText: nextTranscriptText || call.transcriptText,
      updatedAt: now,
    };
    return updated;
  });

  if (updated) {
    await writeLocalCallsIndex(index, indexPath);
  }

  const updatedCall = updated as ConnectCallRecord | null;

  return updatedCall
    ? {
        assembledTranscriptText: updatedCall.transcriptText || "",
        call: updatedCall,
        segment: storedSegment,
      }
    : null;
}

export async function updateLocalConnectCallSummary(
  callId: string,
  input: {
    mainConnectUserPersonId?: string;
    summaryStatus: string;
    summaryText: string;
  },
  options: { indexPath?: string } = {}
): Promise<ConnectCallRecord | null> {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalCallsIndex(indexPath);
  const now = new Date().toISOString();
  let updated: ConnectCallRecord | null = null;

  index.calls = index.calls.map((call) => {
    if (call.callId !== callId) return call;
    if (
      input.mainConnectUserPersonId &&
      call.mainConnectUserPersonId !== input.mainConnectUserPersonId &&
      call.recipientPersonId !== input.mainConnectUserPersonId
    ) {
      return call;
    }

    updated = {
      ...call,
      modelSummaryText:
        input.summaryStatus === "completed"
          ? input.summaryText
          : call.modelSummaryText,
      summaryStatus: input.summaryStatus,
      summaryText: input.summaryText,
      updatedAt: now,
    };
    return updated;
  });

  if (updated) {
    await writeLocalCallsIndex(index, indexPath);
  }

  return updated;
}

export function isConnectCallState(value: unknown): value is ConnectCallState {
  return connectCallStates.has(String(value || ""));
}

async function readLocalCallsIndex(indexPath: string) {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as Partial<LocalCallsIndex>;

    if (Array.isArray(parsed.calls)) {
      return {
        calls: parsed.calls,
        updatedAt: parsed.updatedAt || "",
        version: 1,
      } satisfies LocalCallsIndex;
    }
  } catch {
    // Start a local call index on first write.
  }

  return {
    calls: [],
    updatedAt: "",
    version: 1,
  } satisfies LocalCallsIndex;
}

async function writeLocalCallsIndex(index: LocalCallsIndex, indexPath: string) {
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(
    indexPath,
    `${JSON.stringify({ ...index, updatedAt: new Date().toISOString() }, null, 2)}\n`
  );
}
