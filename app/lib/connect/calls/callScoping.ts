import type { ConnectCallTranscriptSegment } from "./transcriptChunking";

export type ConnectCallRecord = {
  approvedSummaryText?: string;
  callId?: string;
  callerName?: string;
  generatedSummaryText?: string;
  mainConnectUserPersonId?: string;
  modelSummaryText?: string;
  recipientName?: string;
  recipientPersonId?: string;
  state?: string;
  summaryApprovedAt?: string;
  summaryApprovedBy?: string;
  summaryApprovalDraftText?: string;
  summaryApprovalDraftUpdatedAt?: string;
  summaryApprovalDraftUpdatedBy?: string;
  summaryReviewNote?: string;
  summaryReviewStatus?: string;
  summaryStatus?: string;
  summaryText?: string;
  transcriptDeletedAt?: string;
  transcriptCleanupStatus?: "completed" | "pending";
  transcriptExpiresAt?: string;
  transcriptSegments?: ConnectCallTranscriptSegment[];
  transcriptStatus?: string;
  transcriptText?: string;
  updatedAt?: string;
};

const pendingSummaryReviewStatuses = new Set(["pending_review", "pending", "completed"]);
const terminalCallStates = new Set([
  "declined",
  "failed",
  "hung_up",
  "missed",
  "receiver_unavailable",
]);

export function callMainConnectUserPersonId(call: ConnectCallRecord) {
  return call.mainConnectUserPersonId || call.recipientPersonId || "";
}

export function filterCallsForMainConnectUser(
  calls: ConnectCallRecord[],
  personId: string
) {
  return calls.filter((call) => callMainConnectUserPersonId(call) === personId);
}

export function summarizeConnectCalls(calls: ConnectCallRecord[]) {
  const byState: Record<string, number> = {};
  const sortedCalls = [...calls].sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  );
  const pendingSummaryReviews = filterPendingConnectCallSummaryReviews(sortedCalls);

  for (const call of sortedCalls) {
    const state = call.state || "unknown";
    byState[state] = (byState[state] ?? 0) + 1;
  }

  return {
    active: sortedCalls.filter((call) =>
      ["answered", "connected", "ringing"].includes(String(call.state || ""))
    ).length,
    byState,
    latestCall: sortedCalls[0] ?? null,
    pendingSummaryReviewCount: pendingSummaryReviews.length,
    pendingSummaryReviews,
    total: sortedCalls.length,
  };
}

export function filterPendingConnectCallSummaryReviews(
  calls: ConnectCallRecord[],
  options: { now?: Date } = {}
) {
  const nowMs = (options.now ?? new Date()).getTime();

  return calls.filter((call) => {
    const summaryStatus = String(call.summaryStatus || "");
    if (!pendingSummaryReviewStatuses.has(summaryStatus)) return false;
    if (String(call.summaryStatus || "") === "approved") return false;
    if (!terminalCallStates.has(String(call.state || ""))) return false;
    if (!String(call.generatedSummaryText || call.modelSummaryText || call.summaryText || "").trim()) {
      return false;
    }
    const expiresAt = Date.parse(String(call.transcriptExpiresAt || ""));
    if (Number.isFinite(expiresAt) && expiresAt <= nowMs) return false;
    return true;
  });
}

export function mergeConnectCalls(
  primaryCalls: ConnectCallRecord[],
  secondaryCalls: ConnectCallRecord[]
) {
  const callsById = new Map<string, ConnectCallRecord>();

  for (const call of [...secondaryCalls, ...primaryCalls]) {
    const key =
      call.callId ||
      [
        call.mainConnectUserPersonId || call.recipientPersonId || "",
        call.callerName || "",
        call.recipientName || "",
        call.updatedAt || "",
      ].join(":");
    if (!key) continue;
    callsById.set(key, call);
  }

  return Array.from(callsById.values()).sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  );
}

export function emptyConnectCallSummary() {
  return {
    active: 0,
    byState: {},
    latestCall: null,
    pendingSummaryReviewCount: 0,
    pendingSummaryReviews: [],
    total: 0,
  };
}
