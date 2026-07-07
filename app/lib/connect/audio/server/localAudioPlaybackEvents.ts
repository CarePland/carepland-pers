import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { careplandRuntimeTempPath } from "../../../platform/server/runtimeTemp";

export type LocalAudioPlaybackEvent = {
  artifactId?: string;
  audioEnhancementProfile?: {
    adjustments?: {
      bassReduction?: string;
      compression?: string;
      speed?: string;
      timbre?: string;
    };
    compressor?: {
      ratio?: number;
      thresholdDb?: number;
    };
    gainMultiplier?: number;
    highPassHz?: number;
    lowMidGainDb?: number;
    playbackGain?: number;
    playbackRate?: number;
    presenceGainDb?: number;
    profileId?: string;
    reasons?: string[];
  };
  audioUrl?: string;
  createdAt: string;
  eventId: string;
  mainConnectUserPersonId?: string;
  messageFrom?: string;
  messageId?: string;
  playbackState: "ended" | "error" | "fallback" | "feedback" | "started" | "stopped";
  receiverId?: string;
  source?: string;
  surface?: string;
};

type LocalAudioPlaybackEventInput = Omit<
  Partial<LocalAudioPlaybackEvent>,
  "createdAt" | "eventId"
>;

type LocalAudioPlaybackEventIndex = {
  events: LocalAudioPlaybackEvent[];
  updatedAt: string;
  version: 1;
};

const defaultIndexPath = careplandRuntimeTempPath(
  "connect-audio",
  "playback-events.json"
);

export async function readLocalAudioPlaybackEvents(
  options: { indexPath?: string } = {}
) {
  return readLocalPlaybackEventIndex(options.indexPath ?? defaultIndexPath);
}

export async function recordLocalAudioPlaybackEvent(
  input: LocalAudioPlaybackEventInput,
  options: { indexPath?: string } = {}
) {
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readLocalPlaybackEventIndex(indexPath);
  const event: LocalAudioPlaybackEvent = {
    artifactId: input.artifactId || "",
    audioEnhancementProfile: normalizeAudioEnhancementProfile(
      input.audioEnhancementProfile
    ),
    audioUrl: input.audioUrl || "",
    createdAt: new Date().toISOString(),
    eventId: `audio-playback-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2, 8)}`,
    mainConnectUserPersonId: input.mainConnectUserPersonId || "",
    messageFrom: input.messageFrom || "",
    messageId: input.messageId || "",
    playbackState: input.playbackState || "started",
    receiverId: input.receiverId || "",
    source: input.source || "receiver_message_playback",
    surface: input.surface || "web_receiver",
  };

  index.events = [event, ...index.events].slice(0, 500);
  await writeLocalPlaybackEventIndex(index, indexPath);

  return event;
}

function normalizeAudioEnhancementProfile(
  profile?: LocalAudioPlaybackEventInput["audioEnhancementProfile"]
) {
  if (!profile) {
    return {
      adjustments: {
        bassReduction: "none",
        compression: "none",
        speed: "normal",
        timbre: "standard",
      },
      gainMultiplier: 1,
      playbackGain: 1,
      playbackRate: 1,
      profileId: "standard",
      reasons: ["receiver_playback"],
    };
  }

  if (profile.profileId === "bright_speech_clarity") {
    return {
      ...profile,
      highPassHz: profile.highPassHz ?? 165,
    };
  }

  return profile;
}

export function localAudioPlaybackProfile(
  events: LocalAudioPlaybackEvent[]
) {
  const enhancementEvents = events.map((event) => ({
    ...event,
    improved: event.playbackState === "ended",
  }));
  const started = countPlaybackState(events, "started");
  const ended = countPlaybackState(events, "ended");
  const stopped = countPlaybackState(events, "stopped");
  const fallback = countPlaybackState(events, "fallback");
  const error = countPlaybackState(events, "error");
  const failed = events.filter(
    (event) => event.playbackState === "error" || event.playbackState === "fallback"
  ).length;
  const feedbackEvents = events.filter((event) => event.playbackState === "feedback");
  const learningSummary = localAudioLearningSummary(feedbackEvents);
  const averageProfile = averageAudioEnhancementProfile(events);
  const commonReasons = commonAudioReasons(events);

  return {
    enhancementEvents,
    summary: {
      averageProfile,
      commonReasons,
      didNotHelp: failed,
      enhancementEvents: enhancementEvents.length,
      feedbackEvents: feedbackEvents.length,
      helped: ended,
      helpedRate: enhancementEvents.length ? ended / enhancementEvents.length : null,
      playbackEnded: ended,
      playbackErrors: error,
      playbackFallbacks: fallback,
      playbackStarted: started,
      playbackStopped: stopped,
      learningSummary,
      sourceSummaries: [
        {
          enhancementEvents: enhancementEvents.length,
          feedbackEvents: feedbackEvents.length,
          commonReasons,
          helped: ended,
          helpedRate: enhancementEvents.length ? ended / enhancementEvents.length : null,
          key: "web_receiver",
          label: "Receiver playback",
          lastUpdatedAt: events[0]?.createdAt || "",
          sourceType: "receiver_playback",
        },
      ],
      total: enhancementEvents.length,
    },
  };
}

function countPlaybackState(
  events: LocalAudioPlaybackEvent[],
  state: LocalAudioPlaybackEvent["playbackState"]
) {
  return events.filter((event) => event.playbackState === state).length;
}

function averageAudioEnhancementProfile(events: LocalAudioPlaybackEvent[]) {
  const profiles = events
    .map((event) => event.audioEnhancementProfile)
    .filter((profile): profile is NonNullable<LocalAudioPlaybackEvent["audioEnhancementProfile"]> =>
      Boolean(profile)
    );

  return {
    compressorRatio: averageNumber(
      profiles.map((profile) => profile.compressor?.ratio)
    ),
    compressorThresholdDb: averageNumber(
      profiles.map((profile) => profile.compressor?.thresholdDb)
    ),
    gainMultiplier: averageNumber(profiles.map((profile) => profile.gainMultiplier)),
    highPassHz: averageNumber(profiles.map((profile) => profile.highPassHz)),
    lowMidGainDb: averageNumber(profiles.map((profile) => profile.lowMidGainDb)),
    playbackGain: averageNumber(profiles.map((profile) => profile.playbackGain)),
    playbackRate: averageNumber(profiles.map((profile) => profile.playbackRate)),
    presenceGainDb: averageNumber(profiles.map((profile) => profile.presenceGainDb)),
  };
}

function averageNumber(values: Array<number | undefined>) {
  const numericValues = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (!numericValues.length) return null;
  const total = numericValues.reduce((sum, value) => sum + value, 0);
  return Number((total / numericValues.length).toFixed(2));
}

function commonAudioReasons(events: LocalAudioPlaybackEvent[]) {
  const counts = new Map<string, number>();

  for (const event of events) {
    for (const reason of event.audioEnhancementProfile?.reasons ?? []) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([reason, count]) => ({ count, reason }));
}

function localAudioLearningSummary(events: LocalAudioPlaybackEvent[]) {
  const preferenceCounts = {
    original: 0,
    same: 0,
    version1: 0,
    version2: 0,
  };
  const adjustments: Record<string, Record<string, number>> = {
    bassReduction: {},
    compression: {},
    speed: {},
    timbre: {},
  };
  const profileCounts: Record<string, number> = {};

  for (const event of events) {
    const source = event.source || "";
    if (source.endsWith("original")) preferenceCounts.original += 1;
    if (source.endsWith("version_1")) preferenceCounts.version1 += 1;
    if (source.endsWith("version_2")) preferenceCounts.version2 += 1;
    if (source.endsWith("same")) preferenceCounts.same += 1;

    const profile = event.audioEnhancementProfile;
    if (profile?.profileId) {
      profileCounts[profile.profileId] = (profileCounts[profile.profileId] ?? 0) + 1;
    }

    for (const key of Object.keys(adjustments) as Array<keyof NonNullable<LocalAudioPlaybackEvent["audioEnhancementProfile"]>["adjustments"]>) {
      const value = profile?.adjustments?.[key];
      if (!value) continue;
      adjustments[key][value] = (adjustments[key][value] ?? 0) + 1;
    }
  }

  return {
    adjustments,
    preferredChoice: preferredLearningChoice(preferenceCounts),
    preferenceCounts,
    profileCounts,
    total: events.length,
  };
}

function preferredLearningChoice(counts: {
  original: number;
  same: number;
  version1: number;
  version2: number;
}) {
  const choices = [
    ["original", counts.original],
    ["version_1", counts.version1],
    ["version_2", counts.version2],
    ["same", counts.same],
  ] as const;
  const winner = choices.reduce((best, item) => (item[1] > best[1] ? item : best));
  return winner[1] > 0 ? winner[0] : "";
}

async function readLocalPlaybackEventIndex(indexPath: string) {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as Partial<
      LocalAudioPlaybackEventIndex
    >;

    if (Array.isArray(parsed.events)) {
      return {
        events: parsed.events,
        updatedAt: parsed.updatedAt || "",
        version: 1,
      } satisfies LocalAudioPlaybackEventIndex;
    }
  } catch {
    // Start a local playback index on first write.
  }

  return {
    events: [],
    updatedAt: "",
    version: 1,
  } satisfies LocalAudioPlaybackEventIndex;
}

async function writeLocalPlaybackEventIndex(
  index: LocalAudioPlaybackEventIndex,
  indexPath: string
) {
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(
    indexPath,
    `${JSON.stringify({ ...index, updatedAt: new Date().toISOString() }, null, 2)}\n`
  );
}
