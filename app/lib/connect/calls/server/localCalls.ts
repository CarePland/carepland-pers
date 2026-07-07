import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { careplandRuntimeTempPath } from "../../../platform/server/runtimeTemp";
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

const defaultIndexPath = careplandRuntimeTempPath("connect-calls", "calls.json");
const defaultRingingTimeoutMs = 45_000;
const defaultTranscriptRetentionMs = 7 * 24 * 60 * 60 * 1000;
const expiredUnreviewedNote =
  "Transcript expired before formal approval. Generated summary retained as unapproved.";

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
  options: {
    indexPath?: string;
    mainConnectUserPersonId?: string;
    now?: Date;
    ringingTimeoutMs?: number;
  } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalCallsIndex(indexPath);
  const nowMs = (options.now ?? new Date()).getTime();
  const timeoutMs = options.ringingTimeoutMs ?? defaultRingingTimeoutMs;
  let changed = 0;

  index.calls = index.calls.map((call) => {
    if (call.state !== "ringing") return call;
    if (
      options.mainConnectUserPersonId &&
      call.mainConnectUserPersonId !== options.mainConnectUserPersonId
    ) {
      return call;
    }

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
    generatedSummaryText: input.generatedSummaryText,
    recipientName: input.recipientName || "",
    recipientPersonId: personId,
    state: isConnectCallState(input.state) ? input.state : "ringing",
    summaryApprovedAt: input.summaryApprovedAt,
    summaryApprovedBy: input.summaryApprovedBy,
    summaryApprovalDraftText: input.summaryApprovalDraftText,
    summaryApprovalDraftUpdatedAt: input.summaryApprovalDraftUpdatedAt,
    summaryApprovalDraftUpdatedBy: input.summaryApprovalDraftUpdatedBy,
    summaryReviewNote: input.summaryReviewNote,
    summaryReviewStatus: input.summaryReviewStatus,
    summaryStatus: input.summaryStatus || "not_requested",
    summaryText: input.summaryText,
    transcriptDeletedAt: input.transcriptDeletedAt,
    transcriptExpiresAt: input.transcriptExpiresAt,
    transcriptSegments: input.transcriptSegments,
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
      options.approvedSummaryText?.trim() ||
      call.summaryApprovalDraftText?.trim() ||
      call.generatedSummaryText ||
      call.modelSummaryText ||
      call.summaryText ||
      "";
    updated = {
      ...call,
      approvedSummaryText,
      generatedSummaryText:
        call.generatedSummaryText || call.modelSummaryText || call.summaryText || "",
      modelSummaryText: call.modelSummaryText || call.generatedSummaryText || call.summaryText || "",
      summaryApprovedAt: now,
      summaryApprovedBy: options.approvedBy || "receiver",
      summaryApprovalDraftText: approvedSummaryText,
      summaryApprovalDraftUpdatedAt: call.summaryApprovalDraftUpdatedAt,
      summaryApprovalDraftUpdatedBy: call.summaryApprovalDraftUpdatedBy,
      summaryReviewStatus: "approved",
      summaryStatus: "approved",
      summaryText: approvedSummaryText,
      transcriptDeletedAt: now,
      transcriptCleanupStatus: "completed",
      transcriptStatus: "deleted",
      transcriptSegments: undefined,
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

    const segment: ConnectCallTranscriptSegment = {
      chunkEndedMs: input.chunkEndedMs,
      chunkIndex: input.chunkIndex,
      chunkStartedMs: input.chunkStartedMs,
      overlapStartedMs: input.overlapStartedMs,
      transcriptStatus: input.transcriptStatus,
      transcriptText: input.transcriptText,
    };
    storedSegment = segment;
    const existingSegments = call.transcriptSegments || [];
    const transcriptSegments = [
      ...existingSegments.filter((item) => item.chunkIndex !== segment.chunkIndex),
      segment,
    ].sort((a, b) => a.chunkIndex - b.chunkIndex);
    const nextTranscriptText = assembleConnectCallTranscript(transcriptSegments);
    const transcriptStatus = nextTranscriptText
      ? "capturing"
      : input.transcriptStatus === "failed" || input.transcriptStatus === "not_configured"
        ? "failed"
        : "not_started";

    updated = {
      ...call,
      transcriptStatus,
      transcriptSegments,
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

    const nextStatus = normalizeLocalSummaryStatus(input.summaryStatus);
    const generatedSummaryText = nextStatus === "pending_review" ? input.summaryText : call.generatedSummaryText;
    updated = {
      ...call,
      generatedSummaryText,
      modelSummaryText:
        nextStatus === "pending_review"
          ? input.summaryText
          : call.modelSummaryText,
      summaryApprovalDraftText:
        nextStatus === "pending_review" ? call.summaryApprovalDraftText || input.summaryText : call.summaryApprovalDraftText,
      summaryReviewStatus:
        nextStatus === "pending_review" ? "pending_review" : call.summaryReviewStatus,
      summaryStatus: nextStatus,
      summaryText: input.summaryText,
      transcriptExpiresAt:
        nextStatus === "pending_review"
          ? call.transcriptExpiresAt || new Date(Date.parse(now) + defaultTranscriptRetentionMs).toISOString()
          : call.transcriptExpiresAt,
      updatedAt: now,
    };
    return updated;
  });

  if (updated) {
    await writeLocalCallsIndex(index, indexPath);
  }

  return updated;
}

export async function saveLocalConnectCallSummaryDraft(
  callId: string,
  input: {
    draftText: string;
    mainConnectUserPersonId?: string;
    updatedBy?: string;
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
      summaryApprovalDraftText: input.draftText,
      summaryApprovalDraftUpdatedAt: now,
      summaryApprovalDraftUpdatedBy: input.updatedBy || "receiver",
      updatedAt: now,
    };
    return updated;
  });

  if (updated) await writeLocalCallsIndex(index, indexPath);
  return updated;
}

export async function cleanupExpiredLocalConnectCallTranscripts(
  options: { indexPath?: string; mainConnectUserPersonId?: string; now?: Date } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalCallsIndex(indexPath);
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  let changed = 0;

  index.calls = index.calls.map((call) => {
    if (
      options.mainConnectUserPersonId &&
      call.mainConnectUserPersonId !== options.mainConnectUserPersonId &&
      call.recipientPersonId !== options.mainConnectUserPersonId
    ) {
      return call;
    }
    if (call.summaryStatus === "approved") return call;
    const expiresAtMs = Date.parse(String(call.transcriptExpiresAt || ""));
    if (!Number.isFinite(expiresAtMs) || expiresAtMs > now.getTime()) return call;
    if (!call.transcriptText && call.transcriptStatus === "deleted") return call;

    changed += 1;
    return {
      ...call,
      generatedSummaryText: call.generatedSummaryText || call.modelSummaryText || call.summaryText || "",
      summaryReviewNote: expiredUnreviewedNote,
      summaryReviewStatus: "expired_unreviewed",
      summaryStatus: call.summaryStatus === "not_needed" ? "not_needed" : "expired_unreviewed",
      transcriptCleanupStatus: "completed",
      transcriptDeletedAt: nowIso,
      transcriptStatus: "deleted",
      transcriptSegments: undefined,
      transcriptText: undefined,
      updatedAt: nowIso,
    };
  });

  if (changed > 0) await writeLocalCallsIndex(index, indexPath);
  return changed;
}

export function isConnectCallState(value: unknown): value is ConnectCallState {
  return connectCallStates.has(String(value || ""));
}

function normalizeLocalSummaryStatus(value: unknown) {
  const status = String(value || "");
  if (status === "completed" || status === "pending") return "pending_review";
  if (status === "failed") return "summary_failed";
  return [
    "approved",
    "cleanup_pending",
    "expired_unreviewed",
    "not_needed",
    "pending_review",
    "summary_failed",
  ].includes(status)
    ? status
    : "summary_failed";
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
