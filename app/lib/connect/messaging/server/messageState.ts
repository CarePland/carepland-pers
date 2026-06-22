export type ConnectMessageState = "heard" | "read";

export function resolveConnectMessageState(payload: {
  heard?: boolean;
  read?: boolean;
  state?: string;
}): ConnectMessageState {
  if (payload.state === "heard" || payload.heard) return "heard";
  return "read";
}
