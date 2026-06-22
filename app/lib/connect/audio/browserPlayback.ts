import type { ConnectAudioEnhancementProfile } from "./playbackEnhancement";

export type ConnectComfortVolume = "high" | "low" | "med";
export type ConnectPlaybackHandle = { pause: () => void };

export function connectComfortVolumeLevel(value: ConnectComfortVolume) {
  if (value === "low") return 0.18;
  if (value === "high") return 1;
  return 0.5;
}

export function connectEnhancedOutputGain(
  volume: ConnectComfortVolume,
  profile: Pick<ConnectAudioEnhancementProfile, "gainMultiplier" | "playbackGain">
) {
  return Math.min(
    1.8,
    connectComfortVolumeLevel(volume) * profile.gainMultiplier * profile.playbackGain
  );
}

export async function playConnectMessageAudio(
  url: string,
  volume: ConnectComfortVolume,
  options: {
    enhancementProfile?: ConnectAudioEnhancementProfile | null;
    onEnded?: () => void;
    onError?: () => void;
  } = {}
) {
  if (typeof window === "undefined") return null;

  if (options.enhancementProfile) {
    const enhancedAudio = await playEnhancedConnectMessageAudio(
      url,
      volume,
      options.enhancementProfile,
      options
    );
    if (enhancedAudio) return enhancedAudio;
  }

  const audio = new Audio(url);
  audio.preload = "auto";
  audio.playbackRate = options.enhancementProfile?.playbackRate ?? 1;
  audio.volume = Math.min(
    1,
    connectComfortVolumeLevel(volume) * (options.enhancementProfile?.gainMultiplier ?? 1)
  );
  if (options.onEnded) audio.addEventListener("ended", options.onEnded, { once: true });
  if (options.onError) audio.addEventListener("error", options.onError, { once: true });
  await audio.play();
  return audio;
}

async function playEnhancedConnectMessageAudio(
  url: string,
  volume: ConnectComfortVolume,
  profile: ConnectAudioEnhancementProfile,
  options: { onEnded?: () => void } = {}
): Promise<ConnectPlaybackHandle | null> {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  const context = new AudioContextConstructor();
  let stopped = false;

  try {
    const response = await fetch(url, { cache: "no-store" });
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = profile.playbackRate;

    const highPass = context.createBiquadFilter();
    highPass.type = "highpass";
    highPass.frequency.value = profile.highPassHz;
    highPass.Q.value = 0.7;

    const lowMid = context.createBiquadFilter();
    lowMid.type = "peaking";
    lowMid.frequency.value = 420;
    lowMid.Q.value = 0.9;
    lowMid.gain.value = profile.lowMidGainDb;

    const presence = context.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 2600;
    presence.Q.value = 1.1;
    presence.gain.value = profile.presenceGainDb;

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = profile.compressor?.thresholdDb ?? -26;
    compressor.knee.value = 18;
    compressor.ratio.value = profile.compressor?.ratio ?? 5;
    compressor.attack.value = 0.006;
    compressor.release.value = 0.18;

    const gain = context.createGain();
    gain.gain.value = connectEnhancedOutputGain(volume, profile);

    source.connect(highPass);
    highPass.connect(lowMid);
    lowMid.connect(presence);
    presence.connect(compressor);
    compressor.connect(gain);
    gain.connect(context.destination);

    source.onended = () => {
      void context.close().catch(() => undefined);
      if (!stopped) options.onEnded?.();
    };

    source.start();
    return {
      pause: () => {
        stopped = true;
        try {
          source.stop();
        } catch {
          // The source may already have ended.
        }
        void context.close().catch(() => undefined);
      },
    };
  } catch {
    void context.close().catch(() => undefined);
    return null;
  }
}
