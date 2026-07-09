export type ConnectMessageState =
  | "acknowledged"
  | "callback_requested"
  | "heard"
  | "read";

export function resolveConnectMessageState(payload: {
  acknowledged?: boolean;
  callbackRequested?: boolean;
  heard?: boolean;
  read?: boolean;
  state?: string;
}): ConnectMessageState {
  if (payload.state === "acknowledged" || payload.acknowledged) return "acknowledged";
  if (payload.state === "callback_requested" || payload.callbackRequested) {
    return "callback_requested";
  }
  if (payload.state === "heard" || payload.heard) return "heard";
  return "read";
}
