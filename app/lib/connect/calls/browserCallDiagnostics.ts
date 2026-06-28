import type { ConnectCallSignalSender } from "./server/localCallSignals";

export function recordConnectCallLifecycleEvent(input: {
  actorRole: ConnectCallSignalSender | "system";
  callId: string;
  connectAuthHeaders: () => Promise<Record<string, string>>;
  details?: Record<string, unknown>;
  eventType: string;
  mainConnectUserPersonId: string;
}) {
  if (typeof window === "undefined") return;
  if (!input.callId || !input.mainConnectUserPersonId || !input.eventType) return;

  void input.connectAuthHeaders()
    .then((headers) =>
      fetch(`/api/connect/calls/${encodeURIComponent(input.callId)}/events`, {
        body: JSON.stringify({
          actorRole: input.actorRole,
          details: input.details ?? {},
          eventType: input.eventType,
          mainConnectUserPersonId: input.mainConnectUserPersonId,
        }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        method: "POST",
      }).catch(() => undefined)
    )
    .catch(() => undefined);
}
