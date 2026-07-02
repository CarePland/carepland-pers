export type ConnectReceiverGuideRect = {
  height: number;
  label: string;
  width: number;
  x: number;
  y: number;
};

export type ConnectReceiverGuidePress = {
  label?: string;
  pressedAt: number;
  receiverSessionId?: string;
  target?: string | null;
};

export type ConnectReceiverGuideSession = {
  deviceProfile?: string;
  lastSeenAt: number;
  pageUrl?: string;
  receiverSessionId: string;
  uiLayout?: string;
};

export type ConnectReceiverGuideIdentifyRequest = {
  code: string;
  expiresAt: number;
  receiverSessionId: string;
};

export type ConnectReceiverGuideState = {
  activeSessions?: ConnectReceiverGuideSession[];
  identifyRequests?: ConnectReceiverGuideIdentifyRequest[];
  lastPress?: ConnectReceiverGuidePress;
  receiverId: string;
  rect?: ConnectReceiverGuideRect | null;
  targetReceiverSessionId?: string;
  target?: string | null;
  updatedAt: number;
};

const guideStates = new Map<string, ConnectReceiverGuideState>();
const sessionTtlMs = 15_000;
const identifyTtlMs = 45_000;

export function readConnectReceiverGuideState(receiverId: string) {
  const current = guideStates.get(receiverId) ?? {
    receiverId,
    rect: null,
    target: null,
    updatedAt: 0,
  };
  const activeSessions = (current.activeSessions ?? []).filter(
    (session) => Date.now() - session.lastSeenAt <= sessionTtlMs
  );
  const identifyRequests = (current.identifyRequests ?? []).filter(
    (request) => Date.now() <= request.expiresAt
  );
  const next = { ...current, activeSessions, identifyRequests };
  guideStates.set(receiverId, next);
  return next;
}

export function readAllConnectReceiverGuideStates() {
  return Array.from(guideStates.values()).map((state) =>
    readConnectReceiverGuideState(state.receiverId)
  );
}

export function setConnectReceiverGuideRect(
  receiverId: string,
  rect: ConnectReceiverGuideRect,
  targetReceiverSessionId?: string
) {
  const current = readConnectReceiverGuideState(receiverId);
  const next: ConnectReceiverGuideState = {
    ...current,
    receiverId,
    rect,
    targetReceiverSessionId,
    target: null,
    updatedAt: Date.now(),
  };
  guideStates.set(receiverId, next);
  return next;
}

export function clearConnectReceiverGuideState(
  receiverId: string,
  lastPress?: ConnectReceiverGuidePress
) {
  const current = readConnectReceiverGuideState(receiverId);
  const next: ConnectReceiverGuideState = {
    ...current,
    lastPress: lastPress ?? current.lastPress,
    receiverId,
    rect: null,
    targetReceiverSessionId: undefined,
    target: null,
    updatedAt: Date.now(),
  };
  guideStates.set(receiverId, next);
  return next;
}

export function setConnectReceiverGuideIdentifyRequests(
  receiverId: string,
  requests: Array<{ code: string; receiverSessionId: string }>
) {
  const current = readConnectReceiverGuideState(receiverId);
  const expiresAt = Date.now() + identifyTtlMs;
  const next = {
    ...current,
    identifyRequests: requests.map((request) => ({
      code: request.code,
      expiresAt,
      receiverSessionId: request.receiverSessionId,
    })),
    receiverId,
    updatedAt: Date.now(),
  };
  guideStates.set(receiverId, next);
  return next;
}

export function recordConnectReceiverGuidePresence(
  receiverId: string,
  receiverSessionId: string,
  details: {
    deviceProfile?: string;
    pageUrl?: string;
    uiLayout?: string;
  } = {}
) {
  const current = readConnectReceiverGuideState(receiverId);
  const now = Date.now();
  const activeSessions = [
    ...(current.activeSessions ?? []).filter(
      (session) => session.receiverSessionId !== receiverSessionId
    ),
    {
      deviceProfile: details.deviceProfile,
      lastSeenAt: now,
      pageUrl: details.pageUrl,
      receiverSessionId,
      uiLayout: details.uiLayout,
    },
  ].filter((session) => now - session.lastSeenAt <= sessionTtlMs);
  const next = {
    ...current,
    activeSessions,
    receiverId,
  };
  guideStates.set(receiverId, next);
  return next;
}
