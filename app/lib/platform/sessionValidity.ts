export type SessionValidityState =
  | "authenticated"
  | "temporarily_offline"
  | "session_lost"
  | "offline_access_expired"
  | "reauthenticating";

export type SessionValiditySurface = "main" | "family" | "receiver" | "shared";

export type SessionValiditySnapshot = {
  duplicateLossCount: number;
  reason: string;
  returnTo: string;
  state: SessionValidityState;
  surface: SessionValiditySurface;
};

export type SessionLossInput = {
  errorCode?: string | null;
  message?: string | null;
  status?: number | null;
};

type SessionValidityListener = () => void;

const terminalAuthMessagePatterns = [
  "auth session missing",
  "expired refresh token",
  "invalid refresh token",
  "jwt expired",
  "session expired",
  "session revoked",
  "revoked session",
  "authentication invalid",
  "invalid authentication",
  "invalid token",
  "refresh token not found",
];

const transientFailurePatterns = [
  "aborted",
  "airplane",
  "dns",
  "failed to fetch",
  "load failed",
  "network",
  "offline",
  "timeout",
];

export function createSessionValidityStore(
  initialSnapshot: SessionValiditySnapshot = {
    duplicateLossCount: 0,
    reason: "",
    returnTo: "",
    state: "authenticated",
    surface: "shared",
  }
) {
  let snapshot = initialSnapshot;
  const listeners = new Set<SessionValidityListener>();

  function emit() {
    for (const listener of listeners) listener();
  }

  function setSnapshot(nextSnapshot: SessionValiditySnapshot) {
    if (
      snapshot.state === nextSnapshot.state &&
      snapshot.surface === nextSnapshot.surface &&
      snapshot.reason === nextSnapshot.reason &&
      snapshot.returnTo === nextSnapshot.returnTo &&
      snapshot.duplicateLossCount === nextSnapshot.duplicateLossCount
    ) {
      return;
    }

    snapshot = nextSnapshot;
    emit();
  }

  return {
    getSnapshot() {
      return snapshot;
    },
    markAuthenticated() {
      setSnapshot({
        duplicateLossCount: 0,
        reason: "",
        returnTo: "",
        state: "authenticated",
        surface: "shared",
      });
    },
    markOfflineAccessExpired(
      surface: SessionValiditySurface,
      reason = "Offline access expired.",
      returnTo = ""
    ) {
      setSnapshot({
        duplicateLossCount: 0,
        reason,
        returnTo,
        state: "offline_access_expired",
        surface,
      });
    },
    markReauthenticating(surface: SessionValiditySurface) {
      setSnapshot({
        ...snapshot,
        state: "reauthenticating",
        surface,
      });
    },
    markTemporarilyOffline(surface: SessionValiditySurface, reason = "Network unavailable.") {
      if (snapshot.state === "session_lost" || snapshot.state === "offline_access_expired") {
        return;
      }

      setSnapshot({
        duplicateLossCount: 0,
        reason,
        returnTo: snapshot.returnTo,
        state: "temporarily_offline",
        surface,
      });
    },
    reportSessionLost(
      surface: SessionValiditySurface,
      reason = "Authentication was rejected.",
      returnTo = ""
    ) {
      if (snapshot.state === "session_lost") {
        setSnapshot({
          ...snapshot,
          duplicateLossCount: snapshot.duplicateLossCount + 1,
        });
        return false;
      }

      setSnapshot({
        duplicateLossCount: 0,
        reason,
        returnTo,
        state: "session_lost",
        surface,
      });
      return true;
    },
    subscribe(listener: SessionValidityListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const sessionValidityStore = createSessionValidityStore();

export function classifySessionLoss(input: SessionLossInput) {
  const status = input.status ?? null;
  if (status === 401) return true;
  if (status && status >= 500) return false;

  const message = `${input.errorCode ?? ""} ${input.message ?? ""}`.toLowerCase();
  if (!message.trim()) return false;
  if (transientFailurePatterns.some((pattern) => message.includes(pattern))) {
    return false;
  }

  return terminalAuthMessagePatterns.some((pattern) => message.includes(pattern));
}

export function reportSessionLossFromResponse(
  response: Pick<Response, "status">,
  options: {
    reason?: string;
    returnTo?: string;
    surface: SessionValiditySurface;
  }
) {
  if (!classifySessionLoss({ status: response.status })) return false;

  return sessionValidityStore.reportSessionLost(
    options.surface,
    options.reason ?? `Request was rejected with ${response.status}.`,
    options.returnTo ?? currentReturnTo()
  );
}

export function reportSessionLossFromError(
  error: unknown,
  options: {
    returnTo?: string;
    surface: SessionValiditySurface;
  }
) {
  const maybeError = error as { code?: string; message?: string; status?: number } | null;
  const message = error instanceof Error ? error.message : maybeError?.message ?? String(error || "");
  const status =
    typeof maybeError?.status === "number" ? maybeError.status : undefined;
  const errorCode = maybeError?.code;

  if (!classifySessionLoss({ errorCode, message, status })) return false;

  return sessionValidityStore.reportSessionLost(
    options.surface,
    message || "Authentication was rejected.",
    options.returnTo ?? currentReturnTo()
  );
}

export function currentReturnTo() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
