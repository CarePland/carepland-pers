import type { ConnectAudioArtifactKind, ConnectAudioDirection } from "./domain";
import type { ConnectAudioCaptureContext } from "./types";

const preferredAudioTypes = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
];

export type ConnectAudioRecording = {
  blob: Blob;
  durationMs: number;
  localUrl: string;
  mimeType: string;
  size: number;
};

export type ConnectAudioRecordingChunk = {
  blob: Blob;
  chunkIndex: number;
  durationMs: number;
  mimeType: string;
  startedAtMs: number;
};

export type ConnectAudioRecordingController = {
  cancel(): void;
  readonly state: RecordingState;
  stop(): Promise<ConnectAudioRecording>;
};

export type ConnectAudioCaptureContextInput = {
  artifactKind?: ConnectAudioArtifactKind | string;
  askInteractionId?: string;
  audioDirection?: ConnectAudioDirection | string;
  clientAudioCaptureId?: string;
  role?: string;
  surface?: string;
  timeZone?: string;
};

type RecordingOptions = {
  chunkIntervalMs?: number;
  maxDurationMs?: number;
  onChunk?: (chunk: ConnectAudioRecordingChunk) => void | Promise<void>;
  onAutoStop?: (reason: "max_duration" | "silence") => void;
  silenceGraceMs?: number;
  silenceThreshold?: number;
  stopAfterSilenceMs?: number;
};

export function browserConnectAudioRecordingAvailable() {
  const mediaDevices =
    typeof navigator === "undefined"
      ? null
      : (navigator as Navigator & {
          mediaDevices?: { getUserMedia?: unknown };
        }).mediaDevices;

  return Boolean(
    typeof mediaDevices?.getUserMedia === "function" &&
      typeof window !== "undefined" &&
      typeof window.MediaRecorder === "function"
  );
}

export function preferredConnectAudioMimeType() {
  if (
    typeof window === "undefined" ||
    typeof window.MediaRecorder?.isTypeSupported !== "function"
  ) {
    return "";
  }

  return (
    preferredAudioTypes.find((type) => window.MediaRecorder.isTypeSupported(type)) ||
    ""
  );
}

export async function startConnectAudioRecording(
  options: RecordingOptions = {}
): Promise<ConnectAudioRecordingController> {
  if (!browserConnectAudioRecordingAvailable()) {
    throw new Error("Recording is not available on this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = preferredConnectAudioMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  const startedAtMs = Date.now();
  const chunkCapture = options.chunkIntervalMs && options.onChunk
    ? createChunkCapture(stream, {
        chunkIntervalMs: options.chunkIntervalMs,
        onChunk: options.onChunk,
      })
    : null;
  const silenceMonitor = options.stopAfterSilenceMs
    ? createSilenceMonitor(stream, {
        graceMs: options.silenceGraceMs,
        maxDurationMs: options.maxDurationMs,
        onAutoStop: options.onAutoStop,
        silenceThreshold: options.silenceThreshold,
        stop: () => {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        },
        stopAfterSilenceMs: options.stopAfterSilenceMs,
      })
    : null;

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  const stopped = new Promise<ConnectAudioRecording>((resolve) => {
    recorder.addEventListener("stop", () => {
      chunkCapture?.stop();
      silenceMonitor?.stop();
      const blob = new Blob(chunks, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      stopStream(stream);
      resolve({
        blob,
        durationMs: Math.max(0, Date.now() - startedAtMs),
        localUrl: URL.createObjectURL(blob),
        mimeType: blob.type || recorder.mimeType || mimeType || "audio/webm",
        size: blob.size,
      });
    });
  });

  recorder.start();
  silenceMonitor?.start();
  chunkCapture?.start();

  return {
    cancel() {
      chunkCapture?.stop();
      silenceMonitor?.stop();
      stopStream(stream);
      if (recorder.state === "recording") {
        recorder.stop();
      }
    },
    get state() {
      return recorder.state;
    },
    stop() {
      chunkCapture?.stop();
      if (recorder.state === "recording") {
        recorder.stop();
      }
      return stopped;
    },
  };
}

function createChunkCapture(
  stream: MediaStream,
  options: {
    chunkIntervalMs: number;
    onChunk: (chunk: ConnectAudioRecordingChunk) => void | Promise<void>;
  }
) {
  let chunkIndex = 0;
  let intervalId = 0;
  let stopped = false;
  const activeRecorders = new Set<MediaRecorder>();
  const chunkIntervalMs = Math.max(1000, Math.floor(options.chunkIntervalMs));
  const captureStartedAtMs = Date.now();

  function start() {
    recordWindow();
    intervalId = window.setInterval(recordWindow, chunkIntervalMs);
  }

  function stop() {
    stopped = true;
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalId = 0;
    }
    activeRecorders.forEach((recorder) => {
      try {
        if (recorder.state === "recording") recorder.stop();
      } catch {
        // Best-effort chunk recorder cleanup.
      }
    });
    activeRecorders.clear();
  }

  function recordWindow() {
    if (stopped) return;
    const currentChunkIndex = chunkIndex;
    const startedAtMs = Math.max(0, Date.now() - captureStartedAtMs);
    chunkIndex += 1;
    void recordChunkWindow(stream, chunkIntervalMs, activeRecorders).then((recording) => {
      if (!recording || stopped) return;
      void options.onChunk({
        ...recording,
        chunkIndex: currentChunkIndex,
        startedAtMs,
      });
    });
  }

  return { start, stop };
}

function recordChunkWindow(
  stream: MediaStream,
  durationMs: number,
  activeRecorders: Set<MediaRecorder>
) {
  return new Promise<{
    blob: Blob;
    durationMs: number;
    mimeType: string;
  } | null>((resolve) => {
    try {
      const mimeType = preferredConnectAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      const startedAtMs = Date.now();
      let resolved = false;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        if (resolved) return;
        resolved = true;
        activeRecorders.delete(recorder);
        const blob = new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        resolve(
          blob.size
            ? {
                blob,
                durationMs: Math.max(0, Date.now() - startedAtMs),
                mimeType: blob.type || recorder.mimeType || mimeType || "audio/webm",
              }
            : null
        );
      });

      activeRecorders.add(recorder);
      recorder.start();
      window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, durationMs);
    } catch {
      resolve(null);
    }
  });
}

export function createConnectAudioCaptureId(source = "audio") {
  return `${source.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;
}

export function createConnectAudioCaptureContext(
  recording: Partial<ConnectAudioRecording>,
  context: ConnectAudioCaptureContextInput = {}
): ConnectAudioCaptureContext {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const timeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  })();

  return {
    artifactKind: context.artifactKind,
    askInteractionId: context.askInteractionId,
    audioDirection: context.audioDirection,
    capturedAt: new Date().toISOString(),
    captureRole: String(context.role || ""),
    captureSurface: String(context.surface || "audio_capture"),
    clientAudioCaptureId: String(context.clientAudioCaptureId || ""),
    clientLanguage: String(nav?.language || ""),
    clientLanguages: Array.isArray(nav?.languages)
      ? nav.languages.slice(0, 4).map(String)
      : [],
    clientPlatform: String(nav?.platform || ""),
    clientTimeZone: String(context.timeZone || timeZone),
    clientUserAgent: String(nav?.userAgent || ""),
    recordingDurationMs: Number(recording.durationMs || 0),
    recordingMimeType: recording.mimeType || "",
  };
}

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const dataUrl = String(reader.result || "");
      resolve(dataUrl.includes(",") ? dataUrl.split(",").pop() || "" : dataUrl);
    });
    reader.addEventListener("error", () =>
      reject(reader.error || new Error("Unable to read recording."))
    );
    reader.readAsDataURL(blob);
  });
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function createSilenceMonitor(
  stream: MediaStream,
  options: {
    graceMs?: number;
    maxDurationMs?: number;
    onAutoStop?: (reason: "max_duration" | "silence") => void;
    silenceThreshold?: number;
    stop: () => void;
    stopAfterSilenceMs: number;
  }
) {
  let audioContext: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let frameId = 0;
  let silentSinceMs = 0;
  let stopped = false;
  const data = new Uint8Array(128);
  const graceMs = Number(options.graceMs || 1100);
  const stopAfterSilenceMs = Number(options.stopAfterSilenceMs || 2600);
  const threshold = Number(options.silenceThreshold || 0.018);
  const maxDurationMs = Number(options.maxDurationMs || 15000);
  const startedAtMs = Date.now();

  function start() {
    try {
      audioContext = new AudioContext();
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      tick();
    } catch {
      frameId = window.setTimeout(() => autoStop("max_duration"), maxDurationMs);
    }
  }

  function tick() {
    if (stopped || !analyser) return;
    const elapsedMs = Date.now() - startedAtMs;
    if (elapsedMs >= maxDurationMs) {
      autoStop("max_duration");
      return;
    }

    analyser.getByteTimeDomainData(data);
    const rms = Math.sqrt(
      data.reduce((total, value) => {
        const centered = (value - 128) / 128;
        return total + centered * centered;
      }, 0) / data.length
    );

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

  function autoStop(reason: "max_duration" | "silence") {
    if (stopped) return;
    stopped = true;
    options.onAutoStop?.(reason);
    options.stop();
    closeAudioContext();
  }

  function stop() {
    stopped = true;
    if (frameId) {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
    }
    closeAudioContext();
  }

  function closeAudioContext() {
    try {
      source?.disconnect();
      void audioContext?.close();
    } catch {
      // Best-effort cleanup only.
    }
  }

  return { start, stop };
}
