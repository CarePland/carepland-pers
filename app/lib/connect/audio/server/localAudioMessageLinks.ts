import type { ConnectAudioArtifact } from "../types";
import type { ConnectMessageRecord } from "../../messaging";

export function findLocalAudioArtifactMessageLinks(
  artifact: ConnectAudioArtifact,
  messages: ConnectMessageRecord[],
  options: { mainConnectUserPersonId?: string } = {}
) {
  const artifactIds = new Set(
    [artifact.id, artifact.artifactId].filter(Boolean).map(String)
  );
  const audioUrl = normalizeAudioLinkUrl(artifact.audioUrl);
  const mainConnectUserPersonId = options.mainConnectUserPersonId || "";

  return messages
    .filter((message) => {
      if (
        mainConnectUserPersonId &&
        message.mainConnectUserPersonId !== mainConnectUserPersonId
      ) {
        return false;
      }

      const messageArtifactId = String(message.audioArtifactId || "");
      const messageAudioUrl = normalizeAudioLinkUrl(message.audioUrl);

      return (
        (messageArtifactId && artifactIds.has(messageArtifactId)) ||
        (audioUrl && messageAudioUrl === audioUrl)
      );
    })
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
}

export function attachLocalAudioArtifactMessageLinks(
  artifacts: ConnectAudioArtifact[],
  messages: ConnectMessageRecord[],
  options: { mainConnectUserPersonId?: string } = {}
) {
  return artifacts.flatMap((artifact) => {
    const artifactBelongsToMainConnectUser =
      options.mainConnectUserPersonId &&
      artifact.mainConnectUserPersonId === options.mainConnectUserPersonId;
    const messageLinks = findLocalAudioArtifactMessageLinks(
      artifact,
      messages,
      options
    );

    if (
      options.mainConnectUserPersonId &&
      !artifactBelongsToMainConnectUser &&
      !messageLinks.length
    ) {
      return [];
    }

    return {
      ...artifact,
      relatedMessage: messageLinks[0] ?? artifact.relatedMessage ?? null,
    };
  });
}

function normalizeAudioLinkUrl(value?: string) {
  return String(value || "").replace(/^https?:\/\/[^/]+/i, "");
}
