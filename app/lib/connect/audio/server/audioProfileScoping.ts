import type { ConnectAudioHearingProfile } from "../types";
import {
  localAudioPlaybackProfile,
  type LocalAudioPlaybackEvent,
} from "./localAudioPlaybackEvents";

export function filterAudioPlaybackEventsForMainConnectUser(
  events: LocalAudioPlaybackEvent[],
  personId: string
) {
  if (!personId) return events;

  return events.filter((event) => event.mainConnectUserPersonId === personId);
}

export function buildConnectAudioProfile({
  localPlaybackEvents,
  prototypeProfile,
}: {
  localPlaybackEvents: LocalAudioPlaybackEvent[];
  prototypeProfile: ConnectAudioHearingProfile | null;
}) {
  return mergeAudioProfiles(
    prototypeProfile,
    localAudioPlaybackProfile(localPlaybackEvents)
  );
}

export function mergeAudioProfiles(
  prototypeProfile: ConnectAudioHearingProfile | null,
  localProfile: ReturnType<typeof localAudioPlaybackProfile>
) {
  const prototypeSummary = prototypeProfile?.summary ?? {};
  const localSummary = localProfile.summary;

  return {
    ...(prototypeProfile ?? {}),
    enhancementEvents: [
      ...localProfile.enhancementEvents,
      ...((prototypeProfile?.enhancementEvents as Array<Record<string, unknown>> | undefined) ??
        []),
    ],
    events: prototypeProfile?.events ?? [],
    summary: {
      ...prototypeSummary,
      averageProfile:
        (prototypeSummary as { averageProfile?: Record<string, unknown> }).averageProfile ??
        localSummary.averageProfile,
      commonReasons:
        localSummary.commonReasons.length > 0
          ? localSummary.commonReasons
          : (prototypeSummary as { commonReasons?: Array<Record<string, unknown>> })
              .commonReasons,
      enhancementEvents:
        Number(
          (prototypeSummary as { enhancementEvents?: number }).enhancementEvents ?? 0
        ) + localSummary.enhancementEvents,
      feedbackEvents:
        Number((prototypeSummary as { feedbackEvents?: number }).feedbackEvents ?? 0) +
        localSummary.feedbackEvents,
      learningSummary:
        localSummary.learningSummary.total > 0
          ? localSummary.learningSummary
          : (prototypeSummary as { learningSummary?: Record<string, unknown> })
              .learningSummary,
      playbackEnded:
        Number((prototypeSummary as { playbackEnded?: number }).playbackEnded ?? 0) +
        localSummary.playbackEnded,
      playbackErrors:
        Number((prototypeSummary as { playbackErrors?: number }).playbackErrors ?? 0) +
        localSummary.playbackErrors,
      playbackFallbacks:
        Number((prototypeSummary as { playbackFallbacks?: number }).playbackFallbacks ?? 0) +
        localSummary.playbackFallbacks,
      playbackStarted:
        Number((prototypeSummary as { playbackStarted?: number }).playbackStarted ?? 0) +
        localSummary.playbackStarted,
      playbackStopped:
        Number((prototypeSummary as { playbackStopped?: number }).playbackStopped ?? 0) +
        localSummary.playbackStopped,
      sourceSummaries: [
        ...localSummary.sourceSummaries,
        ...(prototypeSummary.sourceSummaries ?? []),
      ],
      total: Number(prototypeSummary.total ?? 0) + localSummary.total,
    },
  };
}
