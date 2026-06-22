import type {
  ConnectAudioArtifact,
  ConnectAudioArtifactDetail,
  ConnectAudioReview,
} from "../types";
import type { ConnectMessageRecord } from "../../messaging";

export function buildConnectAudioArtifactsResponse({
  localArtifacts,
  mainConnectUserPersonId,
  prototypeArtifacts,
}: {
  localArtifacts: ConnectAudioArtifact[];
  mainConnectUserPersonId?: string;
  prototypeArtifacts: ConnectAudioArtifact[];
}) {
  const artifacts = [...localArtifacts, ...prototypeArtifacts];

  return {
    artifacts,
    localArtifacts,
    mainConnectUserPersonId: mainConnectUserPersonId || null,
    ok: true,
    prototypeArtifacts,
    scope: mainConnectUserPersonId ? "main_connect_user" : "admin_broad",
    summary: {
      linkedLocalArtifacts: localArtifacts.filter(
        (artifact) => artifact.relatedMessage
      ).length,
      localArtifacts: localArtifacts.length,
      prototypeArtifacts: prototypeArtifacts.length,
      total: artifacts.length,
    },
  };
}

export function buildConnectAudioReviewResponse({
  localArtifacts,
  mainConnectUserPersonId,
  prototypeReview,
}: {
  localArtifacts: ConnectAudioArtifact[];
  mainConnectUserPersonId?: string;
  prototypeReview: ConnectAudioReview | null;
}) {
  const artifacts = [
    ...localArtifacts,
    ...(prototypeReview?.artifacts ?? []),
  ];
  const linkedLocalArtifacts = localArtifacts.filter(
    (artifact) => artifact.relatedMessage
  ).length;

  return {
    ok: true,
    review: {
      ...(prototypeReview ?? {}),
      artifacts,
      mainConnectUserPersonId: mainConnectUserPersonId || null,
      scope: mainConnectUserPersonId ? "main_connect_user" : "admin_broad",
      summary: {
        ...(prototypeReview?.summary ?? {}),
        artifacts: artifacts.length,
        linkedLocalArtifacts,
        localArtifacts: localArtifacts.length,
      },
    },
  };
}

type LocalAudioArtifactStorageDetail = NonNullable<
  ConnectAudioArtifactDetail["storage"]
>;

export function buildLocalAudioArtifactDetailResponse({
  localArtifact,
  mainConnectUserPersonId,
  messageLinks,
  storage,
}: {
  localArtifact: ConnectAudioArtifact;
  mainConnectUserPersonId?: string;
  messageLinks: ConnectMessageRecord[];
  storage: LocalAudioArtifactStorageDetail;
}) {
  const relatedMessage = messageLinks[0] ?? null;

  return {
    detail: {
      artifact: {
        ...localArtifact,
        relatedMessage: relatedMessage ?? localArtifact.relatedMessage ?? null,
      },
      auditTrail: [
        {
          createdAt: localArtifact.createdAt,
          summary: "Original audio preserved by carepland-all local storage.",
          type: "audio.artifact_preserved",
        },
      ],
      relatedMessage,
      storage: {
        ...storage,
        indexedByteSize: localArtifact.audioByteSize,
        indexedSha256: localArtifact.audioSha256,
        integrityMatches: localAudioArtifactIntegrityMatches({
          currentByteSize: storage.currentByteSize,
          currentSha256: storage.currentSha256,
          indexedByteSize: localArtifact.audioByteSize,
          indexedSha256: localArtifact.audioSha256,
        }),
      },
      timelineEvents: [],
    },
    mainConnectUserPersonId: mainConnectUserPersonId || null,
    ok: true,
    scope: mainConnectUserPersonId ? "main_connect_user" : "admin_broad",
  };
}

export function localAudioArtifactIntegrityMatches({
  currentByteSize,
  currentSha256,
  indexedByteSize,
  indexedSha256,
}: {
  currentByteSize?: number;
  currentSha256?: string;
  indexedByteSize?: number;
  indexedSha256?: string;
}) {
  if (currentSha256 && indexedSha256) {
    return currentSha256 === indexedSha256;
  }

  if (currentByteSize === undefined || indexedByteSize === undefined) {
    return undefined;
  }

  return currentByteSize === indexedByteSize;
}
