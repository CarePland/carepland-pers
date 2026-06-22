export function createBrowserAudioController(options = {}) {
  const enhancementStorageKey = options.enhancementStorageKey || "carepland.audio.enhancementProfiles.v1";
  const activePlayers = new Set();
  const activeSources = new Set();
  const buffers = new Map();
  let activeAudio = null;
  let audioContext = null;
  let unlocked = false;

  function resolveUrl(url) {
    if (!url) return "";
    if (typeof options.resolveUrl === "function") {
      return options.resolveUrl(url);
    }
    return url;
  }

  function volumeLevel(volume = options.defaultVolume) {
    if (typeof options.volumeLevel === "function") {
      const value = Number(options.volumeLevel(volume));
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.45;
    }
    const value = Number(volume ?? 0.45);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.45;
  }

  function normalizedGain(settings = {}) {
    const multiplier = Number(settings.playbackGain ?? options.playbackGain ?? 1);
    const gain = volumeLevel(settings.volume) * (Number.isFinite(multiplier) ? multiplier : 1);
    return Math.max(0, Math.min(Number(options.maxPlaybackGain ?? 2.2), gain));
  }

  function createAudio(url, settings = {}) {
    const audio = new Audio(resolveUrl(url));
    audio.preload = settings.preload || "auto";
    audio.loop = Boolean(settings.loop);
    audio.volume = volumeLevel(settings.volume);
    activePlayers.add(audio);
    audio.addEventListener(
      "ended",
      () => {
        activePlayers.delete(audio);
      },
      { once: true }
    );
    return audio;
  }

  function stop() {
    activeSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    });
    activeSources.clear();
    activePlayers.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    activePlayers.clear();
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }
  }

  function play(url, settings = {}) {
    if (!url || volumeLevel(settings.volume) === 0) {
      return false;
    }
    if (settings.stopActive !== false) {
      stop();
    }
    if (settings.virtualNormalize !== false && playDecoded(url, settings)) {
      return true;
    }
    const audio = createAudio(url, settings);
    if (settings.active !== false) {
      activeAudio = audio;
    }
    audio.addEventListener(
      "ended",
      () => {
        if (activeAudio === audio) {
          activeAudio = null;
        }
        settings.onEnded?.();
      },
      { once: true }
    );
    audio.play().catch(() => {
      activePlayers.delete(audio);
      if (activeAudio === audio) {
        activeAudio = null;
      }
      settings.onBlocked?.();
      options.onPlaybackBlocked?.();
    });
    return true;
  }

  function playDecoded(url, settings = {}) {
    if (!ensureAudioContext()) {
      return false;
    }

    const gainValue = normalizedGain(settings);
    if (gainValue === 0) {
      return false;
    }

    fetch(resolveUrl(url))
      .then((response) => {
        if (!response.ok) throw new Error(`Audio fetch failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
      .then((buffer) => {
        const source = audioContext.createBufferSource();
        const resolvedUrl = resolveUrl(url);
        const cachedProfile = settings.enhanceSpeech === false ? null : loadEnhancementProfile(resolvedUrl);
        const profile = settings.enhanceSpeech === false
          ? null
          : cachedProfile || saveEnhancementProfile(resolvedUrl, analyzeSpeechBuffer(buffer));
        reportEnhancementProfile(resolvedUrl, profile, settings, {
          cached: Boolean(cachedProfile),
          durationMs: Math.round(buffer.duration * 1000),
        });
        const chain = createSpeechEnhancementChain(settings, profile);
        source.buffer = buffer;
        source.loop = Boolean(settings.loop);
        source.connect(chain.input);
        chain.output.connect(audioContext.destination);
        activeSources.add(source);
        if (settings.active !== false) {
          activeAudio = null;
        }
        source.addEventListener(
          "ended",
          () => {
            activeSources.delete(source);
            settings.onEnded?.();
          },
          { once: true }
        );
        source.start(0);
      })
      .catch(() => {
        const fallbackSettings = { ...settings, virtualNormalize: false };
        play(url, fallbackSettings);
      });
    return true;
  }

  function playOneShot(url, volume = options.defaultVolume) {
    if (!url || volumeLevel(volume) === 0) {
      return false;
    }
    const audio = createAudio(url, { volume });
    audio.play().catch(() => {
      activePlayers.delete(audio);
      options.onPlaybackBlocked?.();
    });
    return true;
  }

  function createSpeechEnhancementChain(settings = {}, profile = null) {
    const input = audioContext.createGain();
    let tail = input;
    const effectiveGain = Math.max(0, Math.min(Number(options.maxPlaybackGain ?? 2.2), normalizedGain(settings) * (profile?.gainMultiplier || 1)));

    if (profile?.highPassHz) {
      const highPass = audioContext.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.value = profile.highPassHz;
      highPass.Q.value = 0.7;
      tail.connect(highPass);
      tail = highPass;
    }

    if (profile?.lowMidGainDb) {
      const lowMid = audioContext.createBiquadFilter();
      lowMid.type = "peaking";
      lowMid.frequency.value = 300;
      lowMid.Q.value = 0.9;
      lowMid.gain.value = profile.lowMidGainDb;
      tail.connect(lowMid);
      tail = lowMid;
    }

    if (profile?.presenceGainDb) {
      const presence = audioContext.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 3000;
      presence.Q.value = 0.85;
      presence.gain.value = profile.presenceGainDb;
      tail.connect(presence);
      tail = presence;
    }

    if (profile?.compressor) {
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = profile.compressor.thresholdDb;
      compressor.knee.value = 18;
      compressor.ratio.value = profile.compressor.ratio;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.18;
      tail.connect(compressor);
      tail = compressor;
    }

    const outputGain = audioContext.createGain();
    outputGain.gain.value = effectiveGain;
    tail.connect(outputGain);

    const limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 2;
    limiter.ratio.value = 18;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.08;
    outputGain.connect(limiter);

    return { input, output: limiter };
  }

  function analyzeSpeechBuffer(buffer) {
    const metrics = collectAudioMetrics(buffer);
    const quiet = metrics.rms < 0.055 && metrics.peak < 0.72;
    const alreadyHot = metrics.rms > 0.18 || metrics.peak > 0.9 || metrics.clippingRatio > 0.003;
    const noisy = metrics.noiseRatio > 0.42;
    const rumbly = metrics.lowCrossingRatio < 0.055 && metrics.rms > 0.012;
    const harsh = metrics.highCrossingRatio > 0.24 || metrics.clippingRatio > 0.0015;
    const boxy = metrics.midDenseRatio > 0.42 && !harsh;
    const wideDynamics = metrics.dynamicRange > 7;
    const reasons = [];

    const profile = {
      version: 1,
      metrics,
      gainMultiplier: quiet && !alreadyHot ? 1.2 : alreadyHot ? 0.9 : 1,
      highPassHz: rumbly ? 115 : 85,
      lowMidGainDb: boxy ? -2.5 : 0,
      presenceGainDb: harsh || noisy ? 0 : quiet ? 2.2 : 1.2,
      compressor: quiet || wideDynamics
        ? { thresholdDb: quiet ? -30 : -24, ratio: quiet ? 2.3 : 1.8 }
        : alreadyHot
          ? null
          : { thresholdDb: -22, ratio: 1.45 },
      createdAt: new Date().toISOString(),
      reasons,
    };

    if (quiet) reasons.push("quiet");
    if (alreadyHot) reasons.push("already_loud_or_limited");
    if (rumbly) reasons.push("low_rumble");
    if (boxy) reasons.push("boxy_low_mid");
    if (harsh) reasons.push("harsh_or_clipped");
    if (noisy) reasons.push("noisy_floor");
    if (wideDynamics) reasons.push("wide_dynamics");
    if (noisy) {
      profile.presenceGainDb = Math.min(profile.presenceGainDb, 0.8);
      profile.compressor = profile.compressor ? { thresholdDb: -22, ratio: 1.35 } : null;
    }
    return profile;
  }

  function collectAudioMetrics(buffer) {
    const channelCount = Math.min(2, buffer.numberOfChannels || 1);
    const sampleRate = buffer.sampleRate || 44100;
    const frameSize = Math.max(256, Math.round(sampleRate * 0.03));
    const maxSamples = 180000;
    const stride = Math.max(1, Math.floor(buffer.length / maxSamples));
    const frameRmsValues = [];
    let sumSquares = 0;
    let peak = 0;
    let sampleCount = 0;
    let clipped = 0;
    let crossings = 0;
    let previous = 0;
    let frameSquares = 0;
    let frameSamples = 0;

    for (let i = 0; i < buffer.length; i += stride) {
      let sample = 0;
      for (let channel = 0; channel < channelCount; channel += 1) {
        sample += buffer.getChannelData(channel)[i] || 0;
      }
      sample /= channelCount;
      const abs = Math.abs(sample);
      peak = Math.max(peak, abs);
      if (abs >= 0.98) clipped += 1;
      if ((sample >= 0 && previous < 0) || (sample < 0 && previous >= 0)) crossings += 1;
      previous = sample;
      sumSquares += sample * sample;
      frameSquares += sample * sample;
      frameSamples += 1;
      sampleCount += 1;
      if (frameSamples >= frameSize / stride) {
        frameRmsValues.push(Math.sqrt(frameSquares / frameSamples));
        frameSquares = 0;
        frameSamples = 0;
      }
    }
    if (frameSamples) {
      frameRmsValues.push(Math.sqrt(frameSquares / frameSamples));
    }

    const sortedFrames = frameRmsValues.slice().sort((a, b) => a - b);
    const noiseFloor = percentile(sortedFrames, 0.15);
    const speechLevel = percentile(sortedFrames, 0.82);
    const rms = Math.sqrt(sumSquares / Math.max(1, sampleCount));
    const crossingRatio = crossings / Math.max(1, sampleCount);
    return {
      rms: roundMetric(rms),
      peak: roundMetric(peak),
      clippingRatio: roundMetric(clipped / Math.max(1, sampleCount)),
      noiseFloor: roundMetric(noiseFloor),
      speechLevel: roundMetric(speechLevel),
      noiseRatio: roundMetric(noiseFloor / Math.max(0.0001, speechLevel)),
      dynamicRange: roundMetric(speechLevel / Math.max(0.0001, noiseFloor)),
      lowCrossingRatio: roundMetric(crossingRatio),
      highCrossingRatio: roundMetric(crossingRatio),
      midDenseRatio: roundMetric(Math.max(0, 1 - Math.abs(crossingRatio - 0.09) * 7)),
    };
  }

  function loadEnhancementProfile(url) {
    if (!url || options.persistEnhancementProfiles === false || !window.localStorage) return null;
    try {
      const profiles = JSON.parse(window.localStorage.getItem(enhancementStorageKey) || "{}");
      return profiles[url] || null;
    } catch {
      return null;
    }
  }

  function saveEnhancementProfile(url, profile) {
    if (!url || options.persistEnhancementProfiles === false || !window.localStorage) return profile;
    try {
      const profiles = JSON.parse(window.localStorage.getItem(enhancementStorageKey) || "{}");
      profiles[url] = profile;
      const entries = Object.entries(profiles).slice(-80);
      window.localStorage.setItem(enhancementStorageKey, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // Playback enhancement is best-effort.
    }
    return profile;
  }

  function reportEnhancementProfile(url, profile, settings = {}, meta = {}) {
    if (!profile || typeof options.onEnhancementProfile !== "function") return;
    try {
      options.onEnhancementProfile({
        artifactId: String(settings.artifactId || ""),
        artifactKind: String(settings.artifactKind || ""),
        audioDirection: String(settings.audioDirection || ""),
        audioUrl: url,
        createdAt: new Date().toISOString(),
        durationMs: meta.durationMs || 0,
        enhancement: {
          playbackGain: Number(settings.playbackGain ?? options.playbackGain ?? 1),
          virtualNormalize: settings.virtualNormalize !== false,
          enhanceSpeech: settings.enhanceSpeech !== false,
        },
        profile,
        source: settings.enhancementSource || settings.source || "browser_playback",
        cached: Boolean(meta.cached),
      });
    } catch {
      // Enhancement reporting should never interrupt playback.
    }
  }

  function percentile(sortedValues, amount) {
    if (!sortedValues.length) return 0;
    const index = Math.max(0, Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * amount)));
    return sortedValues[index];
  }

  function roundMetric(value) {
    return Number(Number(value || 0).toFixed(5));
  }

  function ensureAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!audioContext) {
      audioContext = new AudioContextClass();
    }
    try {
      audioContext.resume?.();
    } catch {
      return false;
    }
    return true;
  }

  async function prepareBuffer(key, url) {
    if (!ensureAudioContext()) return false;
    if (buffers.has(key)) return true;
    try {
      const response = await fetch(resolveUrl(url));
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      buffers.set(key, buffer);
      return true;
    } catch {
      buffers.delete(key);
      return false;
    }
  }

  function playBuffer(key, volume = options.defaultVolume) {
    if (!audioContext || !buffers.has(key) || volumeLevel(volume) === 0) {
      return false;
    }
    try {
      audioContext.resume?.();
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = buffers.get(key);
      gain.gain.value = normalizedGain({ volume, playbackGain: options.cuePlaybackGain ?? 1 });
      source.connect(gain);
      gain.connect(audioContext.destination);
      source.start(0);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (!ensureAudioContext()) {
      return false;
    }
    try {
      const now = audioContext.currentTime;
      const buffer = audioContext.createBuffer(1, 1, 22050);
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(0.0001, now);
      source.connect(gain);
      gain.connect(audioContext.destination);
      source.start(now);
      source.stop(now + 0.01);
      unlocked = true;
      return true;
    } catch {
      return false;
    }
  }

  function speak(text, settings = {}) {
    if (!text || !("speechSynthesis" in window)) {
      return false;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.rate ?? 0.92;
    utterance.pitch = settings.pitch ?? 1.0;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  return {
    get activeAudio() {
      return activeAudio;
    },
    get audioContext() {
      return audioContext;
    },
    get audioUnlocked() {
      return unlocked;
    },
    audioStateLabel() {
      return audioContext?.state || "not ready";
    },
    analyzeSpeechBuffer,
    createAudio,
    ensureAudioContext,
    getEnhancementProfile(url) {
      return loadEnhancementProfile(resolveUrl(url));
    },
    prepareBuffer,
    play,
    playBuffer,
    playOneShot,
    speak,
    stop,
    unlock,
  };
}
