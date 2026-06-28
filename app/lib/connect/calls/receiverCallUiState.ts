export type ReceiverCallUiState =
  | "idle"
  | "incoming"
  | "connecting"
  | "connected"
  | "ended"
  | "failed";

const terminalEndedStates = new Set(["declined", "ended", "hung_up", "missed"]);
const terminalFailedStates = new Set(["failed", "receiver_unavailable"]);

export function receiverCallUiStateFromRecordState(
  state: string | null | undefined
): ReceiverCallUiState {
  const normalized = String(state || "").trim().toLowerCase();

  if (!normalized) return "idle";
  if (normalized === "ringing") return "incoming";
  if (normalized === "answered") return "connecting";
  if (normalized === "connected") return "connected";
  if (terminalEndedStates.has(normalized)) return "ended";
  if (terminalFailedStates.has(normalized)) return "failed";

  return "idle";
}

export function receiverCallRecordStateIsActive(state: string | null | undefined) {
  const uiState = receiverCallUiStateFromRecordState(state);
  return uiState === "incoming" || uiState === "connecting" || uiState === "connected";
}
