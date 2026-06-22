const preferredAudioTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
];

export function browserAudioRecordingAvailable() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

export function preferredAudioMimeType() {
  if (!window.MediaRecorder?.isTypeSupported) return "";
  return preferredAudioTypes.find((type) => window.MediaRecorder.isTypeSupported(type)) || "";
}

export async function startBrowserAudioRecording(options = {}) {
  if (!browserAudioRecordingAvailable()) {
    throw new Error("Recording is not available on this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = preferredAudioMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  const startedAtMs = Date.now();
  const silenceMonitor = options.stopAfterSilenceMs
    ? createSilenceMonitor(stream, {
        stopAfterSilenceMs: options.stopAfterSilenceMs,
        graceMs: options.silenceGraceMs,
        threshold: options.silenceThreshold,
        maxDurationMs: options.maxDurationMs,
        onAutoStop: options.onAutoStop,
        stop: () => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        },
      })
    : null;

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  const stopped = new Promise((resolve) => {
    recorder.addEventListener("stop", async () => {
      silenceMonitor?.stop();
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      stopStream(stream);
      resolve({
        blob,
        localUrl: URL.createObjectURL(blob),
        mimeType: blob.type || recorder.mimeType || mimeType || "audio/webm",
        durationMs: Math.max(0, Date.now() - startedAtMs),
        size: blob.size,
      });
    });
  });

  recorder.start();
  silenceMonitor?.start();

  return {
    recorder,
    startedAtMs,
    get state() {
      return recorder.state;
    },
    stop() {
      if (recorder.state === "recording") {
        recorder.stop();
      }
      return stopped;
    },
    cancel() {
      silenceMonitor?.stop();
      stopStream(stream);
      if (recorder.state === "recording") {
        recorder.stop();
      }
    },
  };
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const dataUrl = String(reader.result || "");
      resolve(dataUrl.includes(",") ? dataUrl.split(",").pop() : dataUrl);
    });
    reader.addEventListener("error", () => reject(reader.error || new Error("Unable to read recording.")));
    reader.readAsDataURL(blob);
  });
}

function stopStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}

function createSilenceMonitor(stream, options) {
  let audioContext = null;
  let source = null;
  let analyser = null;
  let frameId = 0;
  let silentSinceMs = 0;
  let stopped = false;
  const data = new Uint8Array(128);
  const graceMs = Number(options.graceMs || 1100);
  const stopAfterSilenceMs = Number(options.stopAfterSilenceMs || 2600);
  const threshold = Number(options.threshold || 0.018);
  const maxDurationMs = Number(options.maxDurationMs || 15000);
  const startedAtMs = Date.now();

  function start() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        startMaxDurationFallback();
        return;
      }
      audioContext = new AudioContextClass();
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      tick();
    } catch {
      startMaxDurationFallback();
    }
  }

  function tick() {
    if (stopped) return;
    const elapsedMs = Date.now() - startedAtMs;
    if (elapsedMs >= maxDurationMs) {
      autoStop("max_duration");
      return;
    }
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (const value of data) {
      const centered = (value - 128) / 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    if (elapsedMs > graceMs && rms < threshold) {
      if (!silentSinceMs) {
        silentSinceMs = Date.now();
      } else if (Date.now() - silentSinceMs >= stopAfterSilenceMs) {
        autoStop("silence");
        return;
      }
    } else {
      silentSinceMs = 0;
    }
    frameId = window.requestAnimationFrame(tick);
  }

  function startMaxDurationFallback() {
    frameId = window.setTimeout(() => autoStop("max_duration"), maxDurationMs);
  }

  function autoStop(reason) {
    if (stopped) return;
    stopped = true;
    options.onAutoStop?.(reason);
    options.stop();
    closeAudioContext();
  }

  function stop() {
    stopped = true;
    if (frameId) {
      window.cancelAnimationFrame?.(frameId);
      window.clearTimeout?.(frameId);
    }
    closeAudioContext();
  }

  function closeAudioContext() {
    try {
      source?.disconnect?.();
      audioContext?.close?.();
    } catch {
      // Best-effort cleanup only.
    }
  }

  return { start, stop };
}
