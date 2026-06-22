import type { ConnectMessageRecord } from "../types";

export function mergeConnectMessages(
  localMessages: ConnectMessageRecord[],
  prototypeMessages: ConnectMessageRecord[]
) {
  const seen = new Set<string>();

  return [...localMessages, ...prototypeMessages]
    .filter((message) => {
      const key = message.id || `${message.createdAt}-${message.from}-${message.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export function filterMessagesForMainConnectUser(
  messages: ConnectMessageRecord[],
  personId: string
) {
  if (!personId) return messages;

  return messages.filter(
    (message) => message.mainConnectUserPersonId === personId
  );
}

export function summarizeConnectMessages({
  localMessages,
  messages,
  prototypeMessages,
}: {
  localMessages: ConnectMessageRecord[];
  messages: ConnectMessageRecord[];
  prototypeMessages: ConnectMessageRecord[];
}) {
  return {
    audioMessages: messages.filter(
      (message) => message.audioArtifactId || message.audioUrl
    ).length,
    localMessages: localMessages.length,
    prototypeMessages: prototypeMessages.length,
    total: messages.length,
  };
}

export function emptyConnectMessagesSummary() {
  return {
    audioMessages: 0,
    localMessages: 0,
    prototypeMessages: 0,
    total: 0,
  };
}
