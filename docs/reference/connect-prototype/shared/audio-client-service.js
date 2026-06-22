import { blobToBase64 } from "./audio-recording-service.js";

export async function requestAudioTranscription(recording, options = {}) {
  const clientAudioCaptureId = options.clientAudioCaptureId || createClientAudioCaptureId(options.source || "audio");
  const payload = await postAudioJson(options.baseUrl, "/audio/transcriptions", {
    receiverId: options.receiverId || "",
    audioBase64: await recordingToBase64(recording),
    audioMimeType: recording.mimeType || "",
    audioDurationMs: recording.durationMs || 0,
    source: options.source || "audio-capture",
    artifactKind: options.artifactKind || "",
    audioDirection: options.audioDirection || "",
    clientAudioCaptureId,
    askInteractionId: options.askInteractionId || "",
    captureContext: audioCaptureContext(recording, {
      ...options.captureContext,
      role: options.captureContext?.role || "receiver_user",
      surface: options.captureContext?.surface || options.source || "audio_transcription",
      clientAudioCaptureId,
      artifactKind: options.artifactKind,
      audioDirection: options.audioDirection,
      askInteractionId: options.askInteractionId,
    }),
  });

  return {
    clientAudioCaptureId,
    artifactId: payload.artifact?.id || "",
    artifact: payload.artifact || null,
    audioUrl: absoluteApiUrl(options.baseUrl, payload.audioUrl || ""),
    audioMimeType: payload.audioMimeType || recording.mimeType || "",
    transcript: payload.transcript || "",
    transcriptStatus: payload.transcriptStatus || "not_requested",
  };
}

export async function sendAudioMessage(recording, options = {}) {
  const clientAudioCaptureId = options.clientAudioCaptureId || createClientAudioCaptureId(options.source || "message");
  const payload = await postAudioJson(options.baseUrl, "/messages", {
    receiverId: options.receiverId,
    from: options.from || "receiver_user",
    to: options.to || "Andrew",
    body: options.body || "Voice message",
    messageType: "audio",
    audioBase64: await recordingToBase64(recording),
    audioMimeType: recording.mimeType || "",
    audioDurationMs: recording.durationMs || 0,
    clientMessageId: options.clientMessageId || `audio-message-${Date.now()}`,
    source: options.source || "audio_message",
    artifactKind: options.artifactKind || "",
    audioDirection: options.audioDirection || "",
    clientAudioCaptureId,
    askInteractionId: options.askInteractionId || "",
    captureContext: audioCaptureContext(recording, {
      ...options.captureContext,
      role: options.captureContext?.role || options.from || "",
      surface: options.captureContext?.surface || options.source || "audio_message",
      clientAudioCaptureId,
      artifactKind: options.artifactKind,
      audioDirection: options.audioDirection,
      askInteractionId: options.askInteractionId,
    }),
  });

  const message = payload.message || {};
  return {
    clientAudioCaptureId,
    message: {
      ...message,
      audioUrl: absoluteApiUrl(options.baseUrl, message.audioUrl || ""),
    },
    artifactId: payload.artifact?.id || message.audioArtifactId || "",
    artifact: payload.artifact || null,
    audioUrl: absoluteApiUrl(options.baseUrl, message.audioUrl || ""),
    transcript: message.transcript || "",
    transcriptStatus: message.transcriptStatus || "not_requested",
  };
}

export async function postAudioEnhancementEvent(event, options = {}) {
  const payload = await postAudioJson(options.baseUrl, options.path || "/audio/enhancement-events", {
    ...event,
    receiverId: event.receiverId || options.receiverId || "",
  });
  return payload.event || event;
}

async function recordingToBase64(recording) {
  if (!recording?.blob) {
    throw new Error("Recording is empty.");
  }
  return blobToBase64(recording.blob);
}

function audioCaptureContext(recording, context = {}) {
  const nav = typeof navigator !== "undefined" ? navigator : {};
  const intlTimeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  })();
  return {
    capturedAt: new Date().toISOString(),
    captureSurface: String(context.surface || "audio_capture"),
    captureRole: String(context.role || ""),
    clientAudioCaptureId: String(context.clientAudioCaptureId || ""),
    artifactKind: String(context.artifactKind || ""),
    audioDirection: String(context.audioDirection || ""),
    askInteractionId: String(context.askInteractionId || ""),
    recordingMimeType: recording?.mimeType || "",
    recordingDurationMs: Number(recording?.durationMs || 0),
    clientUserAgent: String(nav.userAgent || ""),
    clientPlatform: String(nav.platform || ""),
    clientLanguage: String(nav.language || ""),
    clientLanguages: Array.isArray(nav.languages) ? nav.languages.slice(0, 4).map(String) : [],
    clientVendor: String(nav.vendor || ""),
    clientHardwareConcurrency: Number(nav.hardwareConcurrency || 0),
    clientMaxTouchPoints: Number(nav.maxTouchPoints || 0),
    clientTimeZone: String(context.timeZone || intlTimeZone),
  };
}

function createClientAudioCaptureId(source) {
  return `${String(source || "audio").replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;
}

async function postAudioJson(baseUrl, path, body) {
  const response = await fetch(absoluteApiUrl(baseUrl, path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Audio request failed: ${response.status}`);
  }
  return payload;
}

function absoluteApiUrl(baseUrl, pathOrUrl) {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith("blob:")) {
    return pathOrUrl;
  }
  return `${String(baseUrl || "").replace(/\/$/, "")}${pathOrUrl}`;
}
