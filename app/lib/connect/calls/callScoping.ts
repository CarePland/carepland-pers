export type ConnectCallRecord = {
  callId?: string;
  callerName?: string;
  mainConnectUserPersonId?: string;
  recipientName?: string;
  recipientPersonId?: string;
  state?: string;
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

  for (const call of calls) {
    const state = call.state || "unknown";
    byState[state] = (byState[state] ?? 0) + 1;
  }

  return {
    active: calls.filter((call) =>
      ["answered", "connected", "ringing"].includes(String(call.state || ""))
    ).length,
    byState,
    latestCall: calls[0] ?? null,
    total: calls.length,
  };
}

export function emptyConnectCallSummary() {
  return {
    active: 0,
    byState: {},
    latestCall: null,
    total: 0,
  };
}
