export const connectCallsDeprecated = true;
export const connectReceiverGuideDeprecated = true;

export type ConnectRecurringRequestReason =
  | "initial"
  | "poll"
  | "retry"
  | "realtime"
  | "user";

export type ConnectRecurringRequestSource =
  | "connect_dashboard_call_summary"
  | "connect_dashboard_guide_feedback"
  | "connect_dashboard_guide_sessions"
  | "connect_receiver_binding"
  | "connect_receiver_calls"
  | "connect_receiver_diagnostics"
  | "connect_receiver_guide"
  | "connect_receiver_messages"
  | "connect_receiver_today_focus";

export const connectPollingIntervals = {
  dashboardGuideFeedbackMs: 5_000,
  dashboardGuideSessionsMs: 5_000,
  hiddenMs: 60_000,
  receiverBindingMs: 60_000,
  receiverDiagnosticsMs: 60_000,
  receiverGuideMs: 30_000,
  receiverMessagesMs: 10_000,
  receiverTodayFocusMs: 60_000,
} as const;

export function connectPollingIntervalMs(input: {
  hidden?: boolean;
  intervalMs: number;
  prerequisitesMet?: boolean;
}) {
  if (input.prerequisitesMet === false) return null;
  return input.hidden
    ? Math.max(input.intervalMs, connectPollingIntervals.hiddenMs)
    : input.intervalMs;
}

export function connectPollingDailyInvocationEstimate(input: {
  intervalSeconds: number;
  openClients?: number;
  pollers?: number;
}) {
  if (input.intervalSeconds <= 0) return 0;
  return (
    (86_400 / input.intervalSeconds) *
    (input.pollers ?? 1) *
    (input.openClients ?? 1)
  );
}

export function recordConnectPollingRequest(input: {
  caller: ConnectRecurringRequestSource | string;
  endpoint: string;
  reason: ConnectRecurringRequestReason;
}) {
  if (process.env.NODE_ENV === "production") return;
  if (typeof window === "undefined") return;

  const debugWindow = window as typeof window & {
    __careplandConnectPolling?: Array<{
      caller: string;
      endpoint: string;
      reason: ConnectRecurringRequestReason;
      timestamp: string;
    }>;
  };
  const entries = debugWindow.__careplandConnectPolling ?? [];
  entries.push({
    caller: input.caller,
    endpoint: input.endpoint,
    reason: input.reason,
    timestamp: new Date().toISOString(),
  });
  debugWindow.__careplandConnectPolling = entries.slice(-250);
}
