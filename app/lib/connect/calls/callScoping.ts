export type ConnectCallRecord = {
  approvedSummaryText?: string;
  callId?: string;
  callerName?: string;
  mainConnectUserPersonId?: string;
  modelSummaryText?: string;
  recipientName?: string;
  recipientPersonId?: string;
  state?: string;
  summaryApprovedAt?: string;
  summaryApprovedBy?: string;
  summaryStatus?: string;
  summaryText?: string;
  transcriptDeletedAt?: string;
  transcriptCleanupStatus?: "completed" | "pending";
  transcriptStatus?: string;
  transcriptText?: string;
  updatedAt?: string;
};

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
    total: sortedCalls.length,
  };
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
    total: 0,
  };
}
