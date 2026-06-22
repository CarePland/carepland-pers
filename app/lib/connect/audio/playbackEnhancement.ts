export type ConnectPlaybackVariant = "default" | "original" | "version1" | "version2";
export type ConnectComparisonPlaybackVariant = Exclude<ConnectPlaybackVariant, "default">;

export type ConnectComparisonVersion = {
  choice: "original" | "version_1" | "version_2";
  variant: ConnectComparisonPlaybackVariant;
};

export type ConnectAudioPreference = {
  originalCount: number;
  preferredVariant: ConnectComparisonPlaybackVariant | null;
  sameCount: number;
  version1Count: number;
  version2Count: number;
};

export type ConnectAudioEnhancementProfile = {
  adjustments: {
    bassReduction: "gentle" | "strong";
    compression: "moderate" | "strong";
    speed: "normal" | "slower";
    timbre: "brighter" | "warmer";
  };
  compressor?: {
    ratio: number;
    thresholdDb: number;
  };
  gainMultiplier: number;
  highPassHz: number;
  lowMidGainDb: number;
  playbackGain: number;
  playbackRate: number;
  presenceGainDb: number;
  profileId: string;
  reasons: string[];
};

export function defaultConnectAudioPreference(): ConnectAudioPreference {
  return {
    originalCount: 0,
    preferredVariant: null,
    sameCount: 0,
    version1Count: 0,
    version2Count: 0,
  };
}

export function randomizedConnectComparisonVersions(
  random = Math.random
): ConnectComparisonVersion[] {
  const versions: ConnectComparisonVersion[] = [
    { choice: "original", variant: "original" },
    { choice: "version_1", variant: "version1" },
    { choice: "version_2", variant: "version2" },
  ];

  for (let index = versions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [versions[index], versions[swapIndex]] = [versions[swapIndex], versions[index]];
  }

  return versions;
}

export function connectAudioEnhancementProfileForVariant(
  variant: ConnectPlaybackVariant,
  preference: ConnectAudioPreference
): ConnectAudioEnhancementProfile | null {
  const preferredVariant = preference.preferredVariant ?? "version1";
  const resolvedVariant = variant === "default" ? preferredVariant : variant;

  if (resolvedVariant === "original") return null;

  if (resolvedVariant === "version2") {
    return {
      adjustments: {
        bassReduction: "gentle",
        compression: "strong",
        speed: "slower",
        timbre: "warmer",
      },
      compressor: { ratio: 7, thresholdDb: -30 },
      gainMultiplier: 1.18,
      highPassHz: 95,
      lowMidGainDb: 2.5,
      playbackGain: 1.1,
      playbackRate: 0.88,
      presenceGainDb: 3.5,
      profileId: "steady_slow_speech",
      reasons: [
        "slower_playback",
        "gentler_low_voice_support",
        preference.preferredVariant === "version2" ? "listener_preferred" : "comparison_version_2",
      ],
    };
  }

  return {
    adjustments: {
      bassReduction: "strong",
      compression: "moderate",
      speed: "normal",
      timbre: "brighter",
    },
    compressor: { ratio: 5, thresholdDb: -27 },
    gainMultiplier: 1.25,
    highPassHz: 165,
    lowMidGainDb: -3.5,
    playbackGain: 1.18,
    playbackRate: 1,
    presenceGainDb: 8,
    profileId: "bright_speech_clarity",
    reasons: [
      "presence_boost",
      "rumble_reduction",
      preference.preferredVariant === "version1" ? "listener_preferred" : "comparison_version_1",
    ],
  };
}

export function connectAudioPreferenceFromEvents(
  events: Array<Record<string, unknown>>
) {
  const preference = defaultConnectAudioPreference();

  for (const event of events) {
    const source = String(event.source || "");
    if (!source.startsWith("receiver_audio_feedback_")) continue;

    if (source.endsWith("original")) preference.originalCount += 1;
    if (source.endsWith("version_1")) preference.version1Count += 1;
    if (source.endsWith("version_2")) preference.version2Count += 1;
    if (source.endsWith("same")) preference.sameCount += 1;
  }

  preference.preferredVariant = preferredConnectAudioVariant(preference);

  return preference;
}

export function connectAudioPreferenceWithFeedback(
  current: ConnectAudioPreference,
  choice: string
): ConnectAudioPreference {
  const next = { ...current };
  if (choice === "original") next.originalCount += 1;
  if (choice === "version_1") next.version1Count += 1;
  if (choice === "version_2") next.version2Count += 1;
  if (choice === "same") next.sameCount += 1;

  next.preferredVariant = preferredConnectAudioVariant(next);

  return next;
}

export function preferredConnectAudioVariant(
  preference: Pick<ConnectAudioPreference, "originalCount" | "version1Count" | "version2Count">
): ConnectAudioPreference["preferredVariant"] {
  const variants = [
    ["original", preference.originalCount],
    ["version1", preference.version1Count],
    ["version2", preference.version2Count],
  ] as const;
  const winner = variants.reduce((best, item) => (item[1] > best[1] ? item : best));
  return winner[1] > 0 ? winner[0] : null;
}
