const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const careCircleService = require("./care-circle-service");
const smsParticipantService = require("./sms-participant-service");
const {
  ensureAudioStorage,
  saveAudioBase64Artifact,
  saveAudioBase64Message,
  transcribeAudioFile,
} = require("./audio-storage-service");
const {
  audioCatalogItems,
  audioArtifactKindCatalog,
  audioCapabilityCatalog,
  audioDirectionCatalog,
  audioDomainModel,
  audioDomainCatalogSnapshot,
  audioEventCatalog,
  audioEventCatalogItems,
  audioMaintenanceActionCatalog,
  audioReadinessCatalog,
  audioReadinessItem,
  audioReadinessStatusCatalog,
  classifyAudioArtifact,
} = require("../shared/audio-domain-model.cjs");

const app = express();
const port = Number(process.env.PORT || 8790);
const uploadsDir = path.join(__dirname, "uploads");
const dataDir = path.join(__dirname, "data");
const provisioningStatePath = path.join(dataDir, "connect-provisioning-state.json");
const audioStatePath = path.join(dataDir, "audio-state.json");
const cpPersEnvPath =
  process.env.CP_PERS_ENV_PATH ||
  "/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/.env.local";
const audioEnvPath = process.env.AUDIO_ENV_PATH || cpPersEnvPath;
const connectWebBaseUrl = (process.env.CONNECT_WEB_BASE_URL || "http://localhost:4174").replace(/\/$/, "");
const audioStateSchemaVersion = 2;
const audioStateCollectionLimits = Object.freeze({
  messages: 700,
  audioArtifacts: 700,
  audioTimelineEvents: 1000,
  hearingFeedbackEvents: 400,
  audioEnhancementEvents: 600,
});

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use("/uploads", express.static(uploadsDir));

let nextEventId = 1;
let nextMessageId = 1;
const eventsByReceiver = new Map();
const calls = new Map();
const activeReceivers = new Set();
const receivers = new Map();
const receiverDevices = new Map();
const supplementalReceiverHouseholds = new Map();
const supplementalReceiverPeople = new Map();
const receiverSetupTokens = new Map();
const receiverDeviceTokens = new Map();
const provisioningAuditEvents = [];
const receiverHeartbeatAuditAt = new Map();
const messages = [];
const audioArtifacts = [];
const audioTimelineEvents = [];
const hearingFeedbackEvents = [];
const audioEnhancementEvents = [];
const receiverThemes = new Map();
let audioStateMetadata = {
  version: 0,
  audioDomain: audioDomainModel.domain,
  audioDomainVersion: audioDomainModel.version,
  savedAt: "",
  loadedAt: "",
};

const callStates = Object.freeze([
  "ringing",
  "answered",
  "connected",
  "declined",
  "receiver_unavailable",
  "hung_up",
  "missed",
  "failed",
]);
const terminalCallStates = new Set(["declined", "receiver_unavailable", "hung_up", "missed", "failed"]);
const callStateTransitions = Object.freeze({
  ringing: new Set(["answered", "connected", "declined", "receiver_unavailable", "missed", "failed", "hung_up"]),
  answered: new Set(["connected", "hung_up", "failed"]),
  connected: new Set(["hung_up", "failed"]),
  declined: new Set([]),
  receiver_unavailable: new Set([]),
  hung_up: new Set([]),
  missed: new Set([]),
  failed: new Set([]),
});

const connectProvisioningRegistry = Object.freeze({
  productKey: "connect",
  areaKey: "provisioning",
  registryAreaKey: "connect.provisioning",
  label: "Connect Provisioning",
  adminProductSurface: {
    product: "connect",
    area: "provisioning",
  },
  reservedPanelKeys: [
    "connect.provisioning.households",
  ],
  relatedConnectAreas: [
    "connect.audio",
    "connect.request_interpretation",
    "connect.interaction_traces",
  ],
  childSurfaces: [
    "receiver_households",
    "receiver_devices",
    "setup_links",
    "pairing_status",
    "revocation",
    "receiver_heartbeat",
    "audit_events",
  ],
});

const defaultConnectTheme = Object.freeze({
  name: "Classic Green",
  primaryActionColor: "#26661A",
  secondaryActionColor: "#fffdf7",
  informationActionColor: "#2d5c87",
  recordActionColor: "#111111",
  secondaryUtilityColor: "#5f665f",
  panelBackgroundColor: "#f4f5f3",
  outerFrameColor: "#202423",
  textColor: "#17231d",
  borderColor: "#b9beb8",
});

const connectThemeFields = Object.freeze([
  "primaryActionColor",
  "secondaryActionColor",
  "informationActionColor",
  "recordActionColor",
  "secondaryUtilityColor",
  "panelBackgroundColor",
  "outerFrameColor",
  "textColor",
  "borderColor",
]);

const setupCodeWords = Object.freeze({
  adjectives: [
    "brave",
    "calm",
    "clear",
    "cozy",
    "eager",
    "gentle",
    "happy",
    "kind",
    "lucky",
    "merry",
    "quick",
    "ready",
    "sunny",
    "tidy",
    "warm",
    "wise",
  ],
  nouns: [
    "anchor",
    "bridge",
    "garden",
    "harbor",
    "lantern",
    "maple",
    "meadow",
    "porch",
    "river",
    "signal",
    "table",
    "window",
  ],
  closers: [
    "apron",
    "basket",
    "button",
    "chair",
    "clock",
    "drawer",
    "kettle",
    "pillow",
    "radio",
    "shelf",
    "teacup",
    "ticket",
  ],
});

ensureAudioStorage(uploadsDir);

function receiverEvents(receiverId) {
  if (!eventsByReceiver.has(receiverId)) {
    eventsByReceiver.set(receiverId, []);
  }
  return eventsByReceiver.get(receiverId);
}

const receiverUiStates = new Map();

function addEvent(receiverId, type, payload) {
  const event = {
    id: nextEventId++,
    type,
    createdAt: new Date().toISOString(),
    ...payload,
    receiverId,
  };
  const events = receiverEvents(receiverId);
  events.push(event);
  if (events.length > 100) {
    events.shift();
  }
  return event;
}

function addEventForReceivers(receiverIds, type, payload) {
  const events = [];
  for (const receiverId of receiverIds) {
    events.push(addEvent(receiverId, type, payload));
  }
  return events;
}

function normalizeReceiverId(value) {
  return String(value || "living-room-receiver").trim() || "living-room-receiver";
}

function sanitizeGuideRect(rect = {}) {
  if (!rect || typeof rect !== "object") return null;
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : NaN;
  const left = number(rect.left);
  const top = number(rect.top);
  const width = number(rect.width);
  const height = number(rect.height);
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }
  return {
    left: Math.max(0, Math.min(768, left)),
    top: Math.max(0, Math.min(900, top)),
    width: Math.max(24, Math.min(768, width)),
    height: Math.max(24, Math.min(900, height)),
  };
}

function normalizeConnectTheme(theme = {}) {
  const normalized = { ...defaultConnectTheme };
  for (const field of connectThemeFields) {
    const value = String(theme[field] || "");
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      normalized[field] = value;
    }
  }
  normalized.name = String(theme.name || normalized.name || "Custom").trim() || "Custom";
  return normalized;
}

function createCallRecord(input = {}) {
  const now = new Date().toISOString();
  const receiverId = normalizeReceiverId(input.receiverId);
  const call = {
    callId: String(input.callId || `call-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    receiverId,
    receiverIds: [receiverId],
    callerName: String(input.callerName || "Andrew").trim() || "Andrew",
    recipientName: String(input.recipientName || "Mom").trim() || "Mom",
    state: "ringing",
    transport: String(input.transport || "prototype_state_only"),
    createdAt: now,
    updatedAt: now,
    ringingAt: now,
    answeredAt: "",
    connectedAt: "",
    endedAt: "",
    endedReason: "",
    durationMs: 0,
    stateHistory: [],
  };
  appendCallStateHistory(call, {
    nextState: "ringing",
    source: input.source || "coordinator_dashboard",
  });
  return call;
}

function appendCallStateHistory(call, transition = {}) {
  const now = transition.changedAt || new Date().toISOString();
  call.stateHistory = Array.isArray(call.stateHistory) ? call.stateHistory : [];
  call.stateHistory.push({
    state: transition.nextState || call.state,
    previousState: transition.previousState || "",
    changedAt: now,
    source: String(transition.source || "local_server"),
    note: String(transition.note || ""),
  });
  if (call.stateHistory.length > 25) {
    call.stateHistory = call.stateHistory.slice(-25);
  }
}

function transitionCallState(call, nextState, input = {}) {
  const cleanState = String(nextState || "").trim();
  if (!callStates.includes(cleanState)) {
    return { ok: false, status: 400, error: "Invalid call state" };
  }
  const previousState = call.state || "ringing";
  if (previousState === cleanState) {
    return { ok: true, changed: false, call };
  }
  if (terminalCallStates.has(previousState)) {
    return { ok: false, status: 409, error: `Call is already ${previousState}.` };
  }
  const allowed = callStateTransitions[previousState] || new Set();
  if (!allowed.has(cleanState)) {
    return { ok: false, status: 409, error: `Cannot move call from ${previousState} to ${cleanState}.` };
  }

  const now = new Date().toISOString();
  call.state = cleanState;
  call.updatedAt = now;
  if (cleanState === "answered" && !call.answeredAt) call.answeredAt = now;
  if (cleanState === "connected" && !call.connectedAt) {
    call.connectedAt = now;
    if (!call.answeredAt) call.answeredAt = now;
  }
  if (terminalCallStates.has(cleanState)) {
    call.endedAt = now;
    call.endedReason = String(input.reason || cleanState);
    if (call.connectedAt) {
      call.durationMs = Math.max(0, new Date(now) - new Date(call.connectedAt));
    }
  }
  appendCallStateHistory(call, {
    previousState,
    nextState: cleanState,
    changedAt: now,
    source: input.source || "receiver",
    note: input.note || "",
  });
  return { ok: true, changed: true, call, previousState };
}

function publicCall(call) {
  return {
    ...call,
    terminal: terminalCallStates.has(call.state),
  };
}

function normalizeAudioArtifactRecord(input = {}) {
  const classification = classifyAudioArtifact(input);
  return {
    ...input,
    artifactKind: classification.artifactKind,
    audioDirection: classification.audioDirection,
    captureContext: sanitizeAudioCaptureContext(input.captureContext),
  };
}

function sanitizeAudioCaptureContext(context = {}) {
  if (!context || typeof context !== "object") return {};
  const text = (value, max = 240) => String(value || "").slice(0, max);
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  return {
    capturedAt: text(context.capturedAt, 40),
    captureSurface: text(context.captureSurface || context.surface, 80),
    captureRole: text(context.captureRole || context.role, 80),
    recordingMimeType: text(context.recordingMimeType, 80),
    recordingDurationMs: number(context.recordingDurationMs),
    clientUserAgent: text(context.clientUserAgent, 360),
    clientPlatform: text(context.clientPlatform, 120),
    clientLanguage: text(context.clientLanguage, 40),
    clientLanguages: Array.isArray(context.clientLanguages)
      ? context.clientLanguages.slice(0, 4).map(value => text(value, 40))
      : [],
    clientVendor: text(context.clientVendor, 120),
    clientHardwareConcurrency: number(context.clientHardwareConcurrency),
    clientMaxTouchPoints: number(context.clientMaxTouchPoints),
    clientTimeZone: text(context.clientTimeZone, 80),
    clientAudioCaptureId: text(context.clientAudioCaptureId, 120),
    artifactKind: text(context.artifactKind, 80),
    audioDirection: text(context.audioDirection, 80),
    askInteractionId: text(context.askInteractionId, 160),
  };
}

function recordAudioArtifact(input = {}) {
  const classification = classifyAudioArtifact(input);
  const artifact = {
    id: String(input.id || `audio-artifact-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    createdAt: String(input.createdAt || new Date().toISOString()),
    receiverId: normalizeReceiverId(input.receiverId),
    source: String(input.source || "audio").trim() || "audio",
    artifactKind: classification.artifactKind,
    audioDirection: classification.audioDirection,
    from: String(input.from || ""),
    to: String(input.to || ""),
    messageId: String(input.messageId || ""),
    clientMessageId: String(input.clientMessageId || ""),
    clientAudioCaptureId: String(input.clientAudioCaptureId || input.captureContext?.clientAudioCaptureId || ""),
    askInteractionId: String(input.askInteractionId || input.captureContext?.askInteractionId || ""),
    audioUrl: String(input.audioUrl || ""),
    audioMimeType: String(input.audioMimeType || ""),
    audioByteSize: Number(input.audioByteSize || 0),
    audioSha256: String(input.audioSha256 || ""),
    audioDurationMs: Number(input.audioDurationMs || 0),
    captureContext: sanitizeAudioCaptureContext(input.captureContext),
    transcript: String(input.transcript || ""),
    transcriptStatus: String(input.transcriptStatus || "not_requested"),
    transcriptionRetriedAt: String(input.transcriptionRetriedAt || ""),
    originalPreserved: Boolean(input.audioUrl),
  };
  audioArtifacts.push(artifact);
  if (audioArtifacts.length > audioStateCollectionLimits.audioArtifacts) {
    audioArtifacts.shift();
  }
  saveAudioState();
  recordAudioTimelineEvent({
    receiverId: artifact.receiverId,
    type: "audio.artifact_preserved",
    artifactId: artifact.id,
    messageId: artifact.messageId,
    audioUrl: artifact.audioUrl,
    summary: "Original audio preserved",
    detail: {
      source: artifact.source,
      artifactKind: artifact.artifactKind,
      audioDirection: artifact.audioDirection,
      transcriptStatus: artifact.transcriptStatus,
      audioByteSize: artifact.audioByteSize,
      audioSha256: artifact.audioSha256,
      captureSurface: artifact.captureContext.captureSurface || "",
    },
  });
  return artifact;
}

function recordAudioTimelineEvent(input = {}) {
  const id = String(input.id || `audio-event-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  const existing = audioTimelineEvents.find(event => event.id === id);
  if (existing) return existing;
  const event = {
    id,
    createdAt: String(input.createdAt || new Date().toISOString()),
    receiverId: normalizeReceiverId(input.receiverId),
    type: String(input.type || "audio.event"),
    artifactId: String(input.artifactId || ""),
    messageId: String(input.messageId || ""),
    audioUrl: String(input.audioUrl || ""),
    summary: String(input.summary || ""),
    detail: input.detail && typeof input.detail === "object" ? input.detail : {},
  };
  audioTimelineEvents.push(event);
  if (audioTimelineEvents.length > audioStateCollectionLimits.audioTimelineEvents) {
    audioTimelineEvents.shift();
  }
  saveAudioState();
  return event;
}

function audioFilePathForUrl(audioUrl = "") {
  const value = String(audioUrl || "");
  if (!value.startsWith("/uploads/")) return "";
  const filename = path.basename(value);
  if (!filename || filename !== value.slice("/uploads/".length)) return "";
  return path.join(uploadsDir, filename);
}

function audioMimeTypeForFilename(filename = "") {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".webm") return "audio/webm";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".m4a") return "audio/mp4";
  return "application/octet-stream";
}

function audioFileIntegrity(filePath) {
  try {
    const bytes = fs.readFileSync(filePath);
    return {
      audioByteSize: bytes.length,
      audioSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    };
  } catch {
    return { audioByteSize: 0, audioSha256: "" };
  }
}

function stableJsonHash(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableJsonValue(value)))
    .digest("hex");
}

function stableJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableJsonValue);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableJsonValue(value[key]);
      return result;
    }, {});
}

function recoveredAudioSourceForFilename(filename = "") {
  const basename = path.basename(filename, path.extname(filename));
  const source = basename
    .replace(/-\d{10,}-.+$/, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return source ? `recovered_${source}` : "recovered_upload";
}

function listRecoverableUploadArtifacts(receiverId) {
  const indexedUrls = new Set(audioArtifacts.map(artifact => normalizeAudioUrl(artifact.audioUrl)));
  let filenames = [];
  try {
    filenames = fs.readdirSync(uploadsDir);
  } catch {
    return [];
  }
  return filenames
    .filter(filename => /\.(webm|m4a|mp3|wav|ogg)$/i.test(filename))
    .filter(filename => !indexedUrls.has(`/uploads/${filename}`))
    .map((filename) => {
      const filePath = path.join(uploadsDir, filename);
      const stat = fs.statSync(filePath);
      const integrity = audioFileIntegrity(filePath);
      const source = recoveredAudioSourceForFilename(filename);
      return {
        receiverId,
        source,
        ...classifyAudioArtifact({ receiverId, source, audioUrl: `/uploads/${filename}` }),
        audioUrl: `/uploads/${filename}`,
        audioMimeType: audioMimeTypeForFilename(filename),
        ...integrity,
        audioDurationMs: 0,
        transcript: "",
        transcriptStatus: "recovered_untranscribed",
        createdAt: stat.mtime?.toISOString?.() || new Date().toISOString(),
      };
    });
}

function backfillAudioArtifactIntegrity(receiverId, limit = 100) {
  const candidates = audioArtifacts
    .filter(artifact => (!receiverId || artifact.receiverId === receiverId) && artifact.audioUrl && (!artifact.audioSha256 || !artifact.audioByteSize))
    .slice(0, limit);
  const updated = [];
  const missing = [];
  for (const artifact of candidates) {
    const audioPath = audioFilePathForUrl(artifact.audioUrl);
    if (!audioPath || !fs.existsSync(audioPath)) {
      missing.push(artifact);
      continue;
    }
    const integrity = audioFileIntegrity(audioPath);
    artifact.audioByteSize = integrity.audioByteSize;
    artifact.audioSha256 = integrity.audioSha256;
    artifact.integrityUpdatedAt = new Date().toISOString();
    updated.push(artifact);
  }
  if (updated.length) {
    saveAudioState();
  }
  return { missing, updated };
}

function audioStorageHealthFor(receiverId) {
  const artifacts = audioArtifacts.filter(artifact => !receiverId || artifact.receiverId === receiverId);
  const missingOriginals = [];
  const unhashedArtifacts = [];
  let totalBytes = 0;

  artifacts.forEach((artifact) => {
    if (artifact.audioByteSize) {
      totalBytes += Number(artifact.audioByteSize || 0);
    }
    if (artifact.audioUrl) {
      const audioPath = audioFilePathForUrl(artifact.audioUrl);
      if (!audioPath || !fs.existsSync(audioPath)) {
        missingOriginals.push(artifact);
      }
    }
    if (artifact.audioUrl && (!artifact.audioSha256 || !artifact.audioByteSize)) {
      unhashedArtifacts.push(artifact);
    }
  });

  const recoverableUploads = listRecoverableUploadArtifacts(receiverId || "living-room-receiver");
  const duplicateGroups = audioDuplicateGroups(artifacts);
  return {
    receiverId,
    artifactCount: artifacts.length,
    indexedOriginals: artifacts.filter(artifact => artifact.audioUrl).length,
    missingOriginals: missingOriginals.length,
    unhashedArtifacts: unhashedArtifacts.length,
    recoverableUploads: recoverableUploads.length,
    duplicateGroups: duplicateGroups.length,
    duplicateArtifacts: duplicateGroups.reduce((sum, group) => sum + group.count, 0),
    totalBytes,
    status:
      missingOriginals.length
        ? "missing_originals"
        : unhashedArtifacts.length || recoverableUploads.length
          ? "needs_maintenance"
          : "ok",
  };
}

function backfillAudioTimeline(receiverId, limit = 200) {
  const artifacts = audioArtifacts
    .filter(artifact => (!receiverId || artifact.receiverId === receiverId) && artifact.audioUrl)
    .slice(0, limit);
  const events = [];
  artifacts.forEach((artifact) => {
    events.push(recordAudioTimelineEvent({
      id: `audio-event-backfill-preserved-${artifact.id}`,
      createdAt: artifact.createdAt || new Date().toISOString(),
      receiverId: artifact.receiverId,
      type: "audio.artifact_preserved",
      artifactId: artifact.id,
      messageId: artifact.messageId,
      audioUrl: artifact.audioUrl,
      summary: "Original audio preserved",
      detail: {
        backfilled: true,
        source: artifact.source,
        artifactKind: artifact.artifactKind,
        audioDirection: artifact.audioDirection,
        transcriptStatus: artifact.transcriptStatus,
        audioByteSize: artifact.audioByteSize,
        audioSha256: artifact.audioSha256,
      },
    }));
    if (artifact.transcriptionRetriedAt) {
      events.push(recordAudioTimelineEvent({
        id: `audio-event-backfill-transcript-${artifact.id}`,
        createdAt: artifact.transcriptionRetriedAt,
        receiverId: artifact.receiverId,
        type: "audio.transcription_retried",
        artifactId: artifact.id,
        messageId: artifact.messageId,
        audioUrl: artifact.audioUrl,
        summary: "Transcript retry completed",
        detail: {
          backfilled: true,
          transcriptStatus: artifact.transcriptStatus,
        },
      }));
    }
  });
  return events;
}

function audioEventArtifactLinkCandidates(receiverId) {
  const enhancementEvents = audioEnhancementEvents
    .filter(event => (!receiverId || event.receiverId === receiverId) && !event.artifactId)
    .map(event => ({ event, eventType: "audio.enhanced_playback" }))
    .filter(({ event }) => audioArtifactForEventLink(event));
  const feedbackEvents = hearingFeedbackEvents
    .filter(event => (!receiverId || event.receiverId === receiverId) && !event.artifactId)
    .map(event => ({ event, eventType: "audio.hearing_feedback" }))
    .filter(({ event }) => audioArtifactForEventLink(event));
  return [...enhancementEvents, ...feedbackEvents];
}

function audioEventLinkHealthFor(receiverId) {
  const enhancementEvents = audioEnhancementEvents
    .filter(event => !receiverId || event.receiverId === receiverId);
  const feedbackEvents = hearingFeedbackEvents
    .filter(event => !receiverId || event.receiverId === receiverId);
  const allEvents = [
    ...enhancementEvents.map(event => ({ event, eventType: "audio.enhanced_playback" })),
    ...feedbackEvents.map(event => ({ event, eventType: "audio.hearing_feedback" })),
  ];
  const linkedEvents = allEvents.filter(({ event }) => Boolean(event.artifactId));
  const resolvableUnlinked = audioEventArtifactLinkCandidates(receiverId);
  const unresolvedEvents = allEvents.filter(({ event }) => {
    if (event.artifactId) return false;
    return !audioArtifactForEventLink(event);
  });
  const byType = {};
  allEvents.forEach(({ event, eventType }) => {
    if (!byType[eventType]) {
      byType[eventType] = { total: 0, linked: 0, resolvable: 0, unresolved: 0 };
    }
    byType[eventType].total += 1;
    if (event.artifactId) {
      byType[eventType].linked += 1;
    } else if (audioArtifactForEventLink(event)) {
      byType[eventType].resolvable += 1;
    } else {
      byType[eventType].unresolved += 1;
    }
  });
  return {
    receiverId,
    eventCount: allEvents.length,
    linkedCount: linkedEvents.length,
    resolvableUnlinkedCount: resolvableUnlinked.length,
    unresolvedCount: unresolvedEvents.length,
    byType,
    status:
      unresolvedEvents.length
        ? "unresolved_events"
        : resolvableUnlinked.length
          ? "needs_backfill"
          : "ok",
    sampleResolvable: resolvableUnlinked.slice(0, 8).map(publicMaintenanceAudioEvent),
    sampleUnresolved: unresolvedEvents.slice(0, 8).map(publicMaintenanceAudioEvent),
  };
}

function backfillAudioEventArtifactLinks(receiverId, limit = 200) {
  const candidates = audioEventArtifactLinkCandidates(receiverId).slice(0, limit);
  const updated = [];
  candidates.forEach(({ event, eventType }) => {
    const artifact = audioArtifactForEventLink(event);
    if (!artifact) return;
    Object.assign(event, audioArtifactEventFields(artifact));
    updated.push({ eventId: event.id, eventType, artifactId: artifact.id });
  });
  if (updated.length) {
    saveAudioState();
  }
  return updated;
}

function audioMaintenancePreviewFor(receiverId) {
  const artifacts = audioArtifacts.filter(artifact => !receiverId || artifact.receiverId === receiverId);
  const recoverableUploads = listRecoverableUploadArtifacts(receiverId || "living-room-receiver");
  const integrityBackfillCandidates = artifacts.filter(
    artifact => artifact.audioUrl && (!artifact.audioSha256 || !artifact.audioByteSize)
  );
  const transcriptRetryCandidates = artifacts.filter(canRetryArtifactTranscription);
  const eventLinkBackfillCandidates = audioEventArtifactLinkCandidates(receiverId);
  const timelineBackfillCandidates = artifacts.filter(
    artifact => artifact.audioUrl && !audioTimelineEvents.some(event => event.id === `audio-event-backfill-preserved-${artifact.id}`)
  );
  const missingOriginals = artifacts.filter((artifact) => {
    if (!artifact.audioUrl) return false;
    const audioPath = audioFilePathForUrl(artifact.audioUrl);
    return !audioPath || !fs.existsSync(audioPath);
  });
  return {
    receiverId,
    generatedAt: new Date().toISOString(),
    storageHealth: audioStorageHealthFor(receiverId),
    actions: [
      audioMaintenanceActionPreview("recover_upload_index", {
        count: recoverableUploads.length,
        sample: recoverableUploads.slice(0, 8).map(publicMaintenanceArtifact),
      }),
      audioMaintenanceActionPreview("backfill_integrity", {
        count: integrityBackfillCandidates.length,
        sample: integrityBackfillCandidates.slice(0, 8).map(publicMaintenanceArtifact),
      }),
      audioMaintenanceActionPreview("backfill_timeline", {
        count: timelineBackfillCandidates.length,
        sample: timelineBackfillCandidates.slice(0, 8).map(publicMaintenanceArtifact),
      }),
      audioMaintenanceActionPreview("backfill_event_artifact_links", {
        count: eventLinkBackfillCandidates.length,
        sample: eventLinkBackfillCandidates.slice(0, 8).map(publicMaintenanceAudioEvent),
      }),
      audioMaintenanceActionPreview("retry_pending_transcripts", {
        count: transcriptRetryCandidates.length,
        sample: transcriptRetryCandidates.slice(0, 8).map(publicMaintenanceArtifact),
      }),
      audioMaintenanceActionPreview("inspect_missing_originals", {
        count: missingOriginals.length,
        sample: missingOriginals.slice(0, 8).map(publicMaintenanceArtifact),
      }),
    ],
  };
}

function audioMaintenanceActionPreview(action, preview = {}) {
  const catalogEntry = audioMaintenanceActionCatalog[action] || {};
  return {
    action,
    label: catalogEntry.label || action.replace(/_/g, " "),
    description: catalogEntry.description || "",
    stateChanging: Boolean(catalogEntry.stateChanging),
    count: preview.count || 0,
    sample: Array.isArray(preview.sample) ? preview.sample : [],
  };
}

function publicMaintenanceArtifact(artifact) {
  return {
    id: artifact.id || "",
    source: artifact.source || "",
    artifactKind: artifact.artifactKind || "",
    audioDirection: artifact.audioDirection || "",
    audioUrl: artifact.audioUrl || "",
    audioMimeType: artifact.audioMimeType || "",
    audioByteSize: artifact.audioByteSize || 0,
    audioSha256: artifact.audioSha256 || "",
    clientAudioCaptureId: artifact.clientAudioCaptureId || "",
    askInteractionId: artifact.askInteractionId || "",
    captureSurface: artifact.captureContext?.captureSurface || "",
    captureRole: artifact.captureContext?.captureRole || "",
    transcriptStatus: artifact.transcriptStatus || "",
    createdAt: artifact.createdAt || "",
  };
}

function publicMaintenanceAudioEvent(candidate) {
  const event = candidate.event || {};
  const artifact = audioArtifactForEventLink(event);
  return {
    id: event.id || "",
    eventType: candidate.eventType || "",
    audioUrl: event.audioUrl || "",
    messageId: event.messageId || "",
    createdAt: event.createdAt || "",
    resolvedArtifactId: artifact?.id || "",
    artifactKind: artifact?.artifactKind || "",
    audioDirection: artifact?.audioDirection || "",
  };
}

function applyArtifactTranscription(artifact, transcription) {
  artifact.transcript = String(transcription.transcript || "");
  artifact.transcriptStatus = String(transcription.status || "failed");
  artifact.transcriptionRetriedAt = new Date().toISOString();
  syncMessageTranscriptionForArtifact(artifact);
  saveAudioState();
  return artifact;
}

function canRetryArtifactTranscription(artifact) {
  if (!artifact?.audioUrl) return false;
  if (String(artifact.transcript || "").trim()) return false;
  return String(artifact.transcriptStatus || "").toLowerCase() !== "completed";
}

function syncMessageTranscriptionForArtifact(artifact) {
  const message = messages.find((entry) => {
    if (artifact.messageId && entry.id === artifact.messageId) return true;
    return artifact.clientMessageId && entry.clientMessageId === artifact.clientMessageId;
  });
  if (!message) return null;
  message.transcript = artifact.transcript;
  message.transcriptStatus = artifact.transcriptStatus;
  message.searchableText = [message.body, message.transcript, message.from, message.to]
    .filter(Boolean)
    .join(" ");
  return message;
}

function audioArtifactForEventLink(input = {}) {
  const receiverId = input.receiverId ? normalizeReceiverId(input.receiverId) : "";
  const artifactId = String(input.artifactId || "");
  if (artifactId) {
    const artifact = audioArtifacts.find(entry => entry.id === artifactId && (!receiverId || entry.receiverId === receiverId));
    if (artifact) return artifact;
  }
  const audioUrl = normalizeAudioUrl(input.audioUrl);
  const messageId = String(input.messageId || "");
  return audioArtifacts.find((artifact) => {
    if (receiverId && artifact.receiverId !== receiverId) return false;
    if (messageId && artifact.messageId === messageId) return true;
    return audioUrl && normalizeAudioUrl(artifact.audioUrl) === audioUrl;
  }) || null;
}

function audioArtifactEventFields(artifact) {
  if (!artifact) {
    return {
      artifactId: "",
      artifactKind: "",
      audioDirection: "",
      audioSha256: "",
    };
  }
  return {
    artifactId: artifact.id || "",
    artifactKind: artifact.artifactKind || "",
    audioDirection: artifact.audioDirection || "",
    audioSha256: artifact.audioSha256 || "",
  };
}

function explicitAudioArtifactEventFields(input = {}) {
  return {
    artifactId: String(input.artifactId || ""),
    artifactKind: String(input.artifactKind || ""),
    audioDirection: String(input.audioDirection || ""),
    audioSha256: String(input.audioSha256 || ""),
  };
}

function publicReceiverDevice(device) {
  if (!device) return null;
  const { deviceToken, ...publicDevice } = device;
  return {
    ...publicDevice,
    presence: receiverDevicePresence(device),
  };
}

function receiverDevicePresence(device) {
  if (!device || device.status === "revoked") {
    return { state: "revoked", label: "Revoked", lastSeenAgeMs: null };
  }
  if (!device.pairedAt) {
    return { state: "not_paired", label: "Not paired", lastSeenAgeMs: null };
  }
  const lastSeenTime = new Date(device.lastSeenAt || 0).getTime();
  if (!lastSeenTime) {
    return { state: "offline", label: "No heartbeat", lastSeenAgeMs: null };
  }
  const lastSeenAgeMs = Math.max(Date.now() - lastSeenTime, 0);
  if (lastSeenAgeMs < 15000) {
    return { state: "online", label: "Online", lastSeenAgeMs };
  }
  if (lastSeenAgeMs < 2 * 60 * 1000) {
    return { state: "stale", label: "Recently seen", lastSeenAgeMs };
  }
  return { state: "offline", label: "Offline", lastSeenAgeMs };
}

function receiverHouseholdSummary(careCircleId = "care-circle-mom", options = {}) {
  const baseHouseholds = careCircleService.getReceiverHouseholds(careCircleId);
  const supplementalHouseholds = [...supplementalReceiverHouseholds.values()]
    .filter(household =>
      household.careCircleId === careCircleId &&
      (options.includeInactiveHouseholds || household.active !== false)
    );
  const receiverHouseholds = [...baseHouseholds, ...supplementalHouseholds];
  const receiverPeople = [
    ...careCircleService.getReceiverPeople(careCircleId),
    ...[...supplementalReceiverPeople.values()]
      .filter(person =>
        person.careCircleId === careCircleId &&
        (options.includeInactivePeople || person.active !== false)
      ),
  ];
  return receiverHouseholds.map((household) => {
    const people = receiverPeople.filter(person => person.receiverHouseholdId === household.id);
    return {
      ...household,
      receiverPeople: people,
      receiverPersonCount: people.length,
    };
  });
}

function countBy(items, keyForItem) {
  return items.reduce((counts, item) => {
    const key = keyForItem(item) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function provisioningSummary(careCircleId = "care-circle-mom") {
  const devices = [...receiverDevices.values()].map(publicReceiverDevice);
  const setupTokens = [...receiverSetupTokens.values()].map(expireSetupTokenIfNeeded);
  const households = receiverHouseholdSummary(careCircleId);
  const activeDevices = devices.filter(device => device.status !== "revoked");
  return {
    generatedAt: new Date().toISOString(),
    careCircleId,
    totals: {
      households: households.length,
      receiverPeople: households.reduce((sum, household) => sum + (household.receiverPersonCount || 0), 0),
      receiverDevices: devices.length,
      activeReceiverDevices: activeDevices.length,
      revokedReceiverDevices: devices.length - activeDevices.length,
      setupTokens: setupTokens.length,
      activeSetupTokens: setupTokens.filter(token => token.status === "active").length,
    },
    devicesByStatus: countBy(devices, device => device.status),
    devicesByPresence: countBy(devices, device => device.presence?.state),
    setupTokensByStatus: countBy(setupTokens, token => token.status),
    households: households.map((household) => {
      const householdDevices = devices.filter(device => device.receiverHouseholdId === household.id);
      return {
        id: household.id,
        displayName: household.displayName,
        receiverPersonCount: household.receiverPersonCount,
        receiverDeviceCount: householdDevices.length,
        activeReceiverDeviceCount: householdDevices.filter(device => device.status !== "revoked").length,
        devicesByStatus: countBy(householdDevices, device => device.status),
        devicesByPresence: countBy(householdDevices, device => device.presence?.state),
      };
    }),
  };
}

function provisioningDeviceDetail(receiverDeviceId) {
  seedReceiverDevices();
  const receiverDevice = receiverDevices.get(receiverDeviceId);
  if (!receiverDevice) {
    return { ok: false, status: 404, error: "Receiver device not found." };
  }
  const setupTokens = [...receiverSetupTokens.values()]
    .map(expireSetupTokenIfNeeded)
    .filter(token => token.receiverDeviceId === receiverDevice.id)
    .sort((first, second) => new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime());
  const auditEvents = provisioningAuditEvents
    .filter(event => event.receiverDeviceId === receiverDevice.id)
    .slice(0, 20);
  const household = receiverHouseholdSummary(receiverDevice.careCircleId)
    .find(item => item.id === receiverDevice.receiverHouseholdId) || null;
  return {
    ok: true,
    registry: connectProvisioningRegistry,
    receiverDevice: publicReceiverDevice(receiverDevice),
    receiverHousehold: household,
    setupTokens,
    auditEvents,
  };
}

function provisioningHouseholdDetail(receiverHouseholdId, careCircleId = "care-circle-mom", options = {}) {
  seedReceiverDevices();
  const household = receiverHouseholdSummary(careCircleId, {
    includeInactiveHouseholds: options.includeInactiveHouseholds,
  })
    .find(item => item.id === receiverHouseholdId);
  if (!household) {
    return { ok: false, status: 404, error: "Receiver household not found." };
  }
  const inactiveReceiverPeople = options.includeInactivePeople
    ? [...supplementalReceiverPeople.values()]
      .filter(person =>
        person.careCircleId === careCircleId &&
        person.receiverHouseholdId === household.id &&
        person.active === false
      )
    : [];
  const devices = [...receiverDevices.values()]
    .map(publicReceiverDevice)
    .filter(device => device.receiverHouseholdId === household.id)
    .sort((first, second) => new Date(second.updatedAt || second.createdAt || 0).getTime() - new Date(first.updatedAt || first.createdAt || 0).getTime());
  const deviceIds = new Set(devices.map(device => device.id));
  const setupTokens = [...receiverSetupTokens.values()]
    .map(expireSetupTokenIfNeeded)
    .filter(token => deviceIds.has(token.receiverDeviceId))
    .sort((first, second) => new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime());
  const auditEvents = provisioningAuditEvents
    .filter(event => event.receiverHouseholdId === household.id || deviceIds.has(event.receiverDeviceId))
    .slice(0, 30);
  return {
    ok: true,
    registry: connectProvisioningRegistry,
    receiverHousehold: household,
    summary: {
    receiverDeviceCount: devices.length,
      activeReceiverDeviceCount: devices.filter(device => device.status !== "revoked").length,
      setupTokenCount: setupTokens.length,
      activeSetupTokenCount: setupTokens.filter(token => token.status === "active").length,
      devicesByStatus: countBy(devices, device => device.status),
      devicesByPresence: countBy(devices, device => device.presence?.state),
      setupTokensByStatus: countBy(setupTokens, token => token.status),
    },
    inactiveReceiverPeople,
    receiverDevices: devices,
    setupTokens,
    auditEvents,
  };
}

function slugifyLocalId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);
}

function createReceiverHousehold(body = {}) {
  seedReceiverDevices();
  const cleanCareCircleId = String(body.careCircleId || "care-circle-mom").trim() || "care-circle-mom";
  const displayName = String(body.displayName || "").trim();
  if (!displayName) {
    return { ok: false, status: 400, error: "Receiver household display name is required." };
  }
  const existing = receiverHouseholdSummary(cleanCareCircleId)
    .find(household => household.displayName.toLowerCase() === displayName.toLowerCase());
  if (existing) {
    return { ok: true, created: false, receiverHousehold: existing };
  }
  const baseId = slugifyLocalId(displayName) || `household-${Date.now()}`;
  let id = `receiver-household-${baseId}`;
  while (receiverHouseholdSummary(cleanCareCircleId).some(household => household.id === id)) {
    id = `receiver-household-${baseId}-${Math.random().toString(16).slice(2, 6)}`;
  }
  const now = new Date().toISOString();
  const receiverHousehold = {
    id,
    careCircleId: cleanCareCircleId,
    displayName,
    defaultTarget: String(body.defaultTarget || "household").trim() || "household",
    active: true,
    createdAt: now,
    updatedAt: now,
    source: "connect_provisioning",
  };
  supplementalReceiverHouseholds.set(id, receiverHousehold);
  addProvisioningAuditEvent("receiver_household.created", {
    careCircleId: cleanCareCircleId,
    receiverHouseholdId: id,
    displayName,
  });
  saveProvisioningState();
  return { ok: true, created: true, receiverHousehold };
}

function deactivateReceiverHousehold(receiverHouseholdId) {
  seedReceiverDevices();
  const receiverHousehold = supplementalReceiverHouseholds.get(receiverHouseholdId);
  if (!receiverHousehold) {
    return {
      ok: false,
      status: 404,
      error: "Receiver household not found or is managed outside Connect provisioning.",
    };
  }
  const assignedActiveDevices = [...receiverDevices.values()]
    .filter(device => device.receiverHouseholdId === receiverHouseholdId && device.status !== "revoked");
  if (assignedActiveDevices.length) {
    return {
      ok: false,
      status: 409,
      error: "Move or revoke receiver devices before archiving this household.",
      assignedReceiverDevices: assignedActiveDevices.map(publicReceiverDevice),
    };
  }
  if (receiverHousehold.active === false) {
    return { ok: true, changed: false, receiverHousehold };
  }
  receiverHousehold.active = false;
  receiverHousehold.updatedAt = new Date().toISOString();
  addProvisioningAuditEvent("receiver_household.deactivated", {
    careCircleId: receiverHousehold.careCircleId,
    receiverHouseholdId: receiverHousehold.id,
    displayName: receiverHousehold.displayName,
  });
  saveProvisioningState();
  return { ok: true, changed: true, receiverHousehold };
}

function restoreReceiverHousehold(receiverHouseholdId) {
  seedReceiverDevices();
  const receiverHousehold = supplementalReceiverHouseholds.get(receiverHouseholdId);
  if (!receiverHousehold) {
    return {
      ok: false,
      status: 404,
      error: "Receiver household not found or is managed outside Connect provisioning.",
    };
  }
  if (receiverHousehold.active !== false) {
    return { ok: true, changed: false, receiverHousehold };
  }
  receiverHousehold.active = true;
  receiverHousehold.updatedAt = new Date().toISOString();
  addProvisioningAuditEvent("receiver_household.restored", {
    careCircleId: receiverHousehold.careCircleId,
    receiverHouseholdId: receiverHousehold.id,
    displayName: receiverHousehold.displayName,
  });
  saveProvisioningState();
  return { ok: true, changed: true, receiverHousehold };
}

function createReceiverPerson(receiverHouseholdId, body = {}) {
  seedReceiverDevices();
  const cleanCareCircleId = String(body.careCircleId || "care-circle-mom").trim() || "care-circle-mom";
  const household = receiverHouseholdSummary(cleanCareCircleId)
    .find(item => item.id === receiverHouseholdId);
  if (!household) {
    return { ok: false, status: 404, error: "Receiver household not found." };
  }
  const displayName = String(body.displayName || "").trim();
  if (!displayName) {
    return { ok: false, status: 400, error: "Receiver person display name is required." };
  }
  const existing = (household.receiverPeople || [])
    .find(person => person.displayName.toLowerCase() === displayName.toLowerCase());
  if (existing) {
    return { ok: true, created: false, receiverPerson: existing, receiverHousehold: household };
  }
  const baseId = slugifyLocalId(displayName) || `person-${Date.now()}`;
  let id = `receiver-person-${baseId}`;
  while (supplementalReceiverPeople.has(id)) {
    id = `receiver-person-${baseId}-${Math.random().toString(16).slice(2, 6)}`;
  }
  const receiverPerson = {
    id,
    careCircleId: cleanCareCircleId,
    receiverHouseholdId,
    displayName,
    linkedCareVipId: "",
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: "connect_provisioning",
  };
  supplementalReceiverPeople.set(id, receiverPerson);
  addProvisioningAuditEvent("receiver_person.created", {
    careCircleId: cleanCareCircleId,
    receiverHouseholdId,
    receiverPersonId: id,
    displayName,
  });
  saveProvisioningState();
  return {
    ok: true,
    created: true,
    receiverPerson,
    receiverHousehold: receiverHouseholdSummary(cleanCareCircleId)
      .find(item => item.id === receiverHouseholdId),
  };
}

function deactivateReceiverPerson(receiverPersonId) {
  seedReceiverDevices();
  const receiverPerson = supplementalReceiverPeople.get(receiverPersonId);
  if (!receiverPerson) {
    return {
      ok: false,
      status: 404,
      error: "Receiver person not found or is managed outside Connect provisioning.",
    };
  }
  if (receiverPerson.active === false) {
    return { ok: true, changed: false, receiverPerson };
  }
  receiverPerson.active = false;
  receiverPerson.updatedAt = new Date().toISOString();
  addProvisioningAuditEvent("receiver_person.deactivated", {
    careCircleId: receiverPerson.careCircleId,
    receiverHouseholdId: receiverPerson.receiverHouseholdId,
    receiverPersonId: receiverPerson.id,
    displayName: receiverPerson.displayName,
  });
  saveProvisioningState();
  return { ok: true, changed: true, receiverPerson };
}

function restoreReceiverPerson(receiverPersonId) {
  seedReceiverDevices();
  const receiverPerson = supplementalReceiverPeople.get(receiverPersonId);
  if (!receiverPerson) {
    return {
      ok: false,
      status: 404,
      error: "Receiver person not found or is managed outside Connect provisioning.",
    };
  }
  if (receiverPerson.active !== false) {
    return { ok: true, changed: false, receiverPerson };
  }
  receiverPerson.active = true;
  receiverPerson.updatedAt = new Date().toISOString();
  addProvisioningAuditEvent("receiver_person.restored", {
    careCircleId: receiverPerson.careCircleId,
    receiverHouseholdId: receiverPerson.receiverHouseholdId,
    receiverPersonId: receiverPerson.id,
    displayName: receiverPerson.displayName,
  });
  saveProvisioningState();
  return { ok: true, changed: true, receiverPerson };
}

function createLocalToken(prefix) {
  return `${prefix}_${crypto.randomBytes(18).toString("base64url")}`;
}

function createSetupCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = [
      randomSetupWord(setupCodeWords.adjectives),
      randomSetupWord(setupCodeWords.nouns),
      randomSetupWord(setupCodeWords.closers),
    ].join("-");
    const codeAlreadyActive = [...receiverSetupTokens.values()]
      .map(expireSetupTokenIfNeeded)
      .some(token => token.status === "active" && normalizeSetupCode(token.setupCode) === code);

    if (!codeAlreadyActive) {
      return code;
    }
  }

  return `ready-${crypto.randomBytes(2).toString("hex")}`;
}

function randomSetupWord(words) {
  return words[crypto.randomInt(0, words.length)];
}

function normalizeSetupCode(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.includes("-")) {
    return raw
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
  }

  const compact = raw.replace(/[^a-z0-9]/g, "");
  if (/^[a-f0-9]{4,}$/i.test(compact)) {
    const legacy = compact.toUpperCase().slice(0, 6);
    return legacy.length > 3 ? `${legacy.slice(0, 3)}-${legacy.slice(3)}` : legacy;
  }

  return compact.slice(0, 80);
}

function addProvisioningAuditEvent(type, payload = {}) {
  const event = {
    id: `provisioning-event-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    productKey: "connect",
    areaKey: "provisioning",
    registryAreaKey: connectProvisioningRegistry.registryAreaKey,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  provisioningAuditEvents.unshift(event);
  if (provisioningAuditEvents.length > 100) {
    provisioningAuditEvents.length = 100;
  }
  return event;
}

function listProvisioningAuditEvents(limit = 20) {
  return provisioningAuditEvents.slice(0, Math.min(Math.max(Number(limit || 20), 1), 100));
}

function maybeAuditReceiverHeartbeat(receiverDevice, now) {
  if (!receiverDevice?.id) return;
  const previous = receiverHeartbeatAuditAt.get(receiverDevice.id) || 0;
  const current = new Date(now).getTime();
  if (current - previous < 60 * 1000) return;
  receiverHeartbeatAuditAt.set(receiverDevice.id, current);
  addProvisioningAuditEvent("receiver_device.heartbeat", {
    receiverDeviceId: receiverDevice.id,
    receiverId: receiverDevice.receiverId,
    careCircleId: receiverDevice.careCircleId,
    receiverHouseholdId: receiverDevice.receiverHouseholdId,
    name: receiverDevice.name,
    locationLabel: receiverDevice.locationLabel,
    status: receiverDevice.status,
    lastSeenAt: receiverDevice.lastSeenAt,
  });
}

function saveProvisioningState() {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(
      provisioningStatePath,
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        receiverHouseholds: [...supplementalReceiverHouseholds.values()],
        receiverPeople: [...supplementalReceiverPeople.values()],
        receiverDevices: [...receiverDevices.values()],
        setupTokens: [...receiverSetupTokens.values()],
        auditEvents: provisioningAuditEvents,
      }, null, 2)
    );
  } catch (error) {
    console.warn("Unable to save Connect provisioning state:", error.message);
  }
}

function loadProvisioningState() {
  try {
    const contents = fs.readFileSync(provisioningStatePath, "utf8");
    const payload = JSON.parse(contents);
    receiverDevices.clear();
    supplementalReceiverHouseholds.clear();
    supplementalReceiverPeople.clear();
    receiverSetupTokens.clear();
    receiverDeviceTokens.clear();
    provisioningAuditEvents.length = 0;
    let migrated = false;

    for (const household of payload.receiverHouseholds || []) {
      if (!household?.id) continue;
      supplementalReceiverHouseholds.set(household.id, { ...household });
    }
    for (const person of payload.receiverPeople || []) {
      if (!person?.id) continue;
      supplementalReceiverPeople.set(person.id, { ...person });
    }
    for (const device of payload.receiverDevices || []) {
      if (!device?.id) continue;
      const normalizedDevice = { ...device };
      if (!normalizedDevice.deviceToken && !normalizedDevice.pairedAt && normalizedDevice.status === "available") {
        normalizedDevice.status = "setup_pending";
        migrated = true;
      }
      receiverDevices.set(normalizedDevice.id, normalizedDevice);
      if (normalizedDevice.deviceToken) {
        receiverDeviceTokens.set(normalizedDevice.deviceToken, normalizedDevice.id);
      }
    }
    for (const setupToken of payload.setupTokens || []) {
      if (!setupToken?.token) continue;
      receiverSetupTokens.set(setupToken.token, { ...setupToken });
    }
    provisioningAuditEvents.push(...(payload.auditEvents || []).slice(0, 100));
    if (migrated) {
      saveProvisioningState();
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Unable to load Connect provisioning state:", error.message);
    }
  }
}

function saveAudioState() {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    audioStateMetadata = {
      ...audioStateMetadata,
      version: audioStateSchemaVersion,
      audioDomain: audioDomainModel.domain,
      audioDomainVersion: audioDomainModel.version,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      audioStatePath,
      JSON.stringify({
        version: audioStateMetadata.version,
        audioDomain: audioStateMetadata.audioDomain,
        audioDomainVersion: audioStateMetadata.audioDomainVersion,
        savedAt: audioStateMetadata.savedAt,
        messages,
        audioArtifacts,
        audioTimelineEvents,
        hearingFeedbackEvents,
        audioEnhancementEvents,
      }, null, 2)
    );
  } catch (error) {
    console.warn("Unable to save audio state:", error.message);
  }
}

function loadAudioState() {
  try {
    const contents = fs.readFileSync(audioStatePath, "utf8");
    const payload = JSON.parse(contents);
    audioStateMetadata = {
      version: Number(payload.version || 1),
      audioDomain: String(payload.audioDomain || audioDomainModel.domain),
      audioDomainVersion: Number(payload.audioDomainVersion || audioDomainModel.version),
      savedAt: String(payload.savedAt || ""),
      loadedAt: new Date().toISOString(),
    };
    messages.length = 0;
    audioArtifacts.length = 0;
    audioTimelineEvents.length = 0;
    hearingFeedbackEvents.length = 0;
    audioEnhancementEvents.length = 0;
    messages.push(...(payload.messages || []).filter(entry => entry?.id).slice(-audioStateCollectionLimits.messages));
    audioArtifacts.push(...(payload.audioArtifacts || []).filter(entry => entry?.id).slice(-audioStateCollectionLimits.audioArtifacts).map(normalizeAudioArtifactRecord));
    audioTimelineEvents.push(...(payload.audioTimelineEvents || []).filter(entry => entry?.id).slice(-audioStateCollectionLimits.audioTimelineEvents));
    hearingFeedbackEvents.push(...(payload.hearingFeedbackEvents || []).filter(entry => entry?.id).slice(-audioStateCollectionLimits.hearingFeedbackEvents));
    audioEnhancementEvents.push(...(payload.audioEnhancementEvents || []).filter(entry => entry?.id).slice(-audioStateCollectionLimits.audioEnhancementEvents));
    nextMessageId = Math.max(
      nextMessageId,
      ...messages.map((message) => Number(String(message.id || "").replace(/^message-/, ""))).filter(Number.isFinite).map(value => value + 1),
      1
    );
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("Unable to load audio state:", error.message);
    }
  }
}

function seedReceiverDevices() {
  if (receiverDevices.size) return;
  const modeledDevices = careCircleService.getReceiverDevices("care-circle-mom");
  modeledDevices.forEach((device) => {
    const receiverId = normalizeReceiverId(device.receiverId || device.id);
    receiverDevices.set(device.id, {
      id: device.id,
      careCircleId: device.careCircleId,
      receiverHouseholdId: device.receiverHouseholdId,
      receiverId,
      name: device.name || "Receiver",
      locationLabel: device.locationLabel || "",
      status: "setup_pending",
      lastSeenAt: device.lastSeenAt || "",
      pairedAt: "",
      revokedAt: "",
      createdAt: device.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deviceToken: "",
    });
  });
}

function findReceiverDeviceByReceiverId(receiverId) {
  return [...receiverDevices.values()].find(device => device.receiverId === receiverId) || null;
}

function receiverDeviceFromToken(deviceToken) {
  const receiverDeviceId = receiverDeviceTokens.get(deviceToken);
  const receiverDevice = receiverDeviceId ? receiverDevices.get(receiverDeviceId) || null : null;
  if (!receiverDevice || receiverDevice.revokedAt) return null;
  return receiverDevice;
}

function expireSetupTokenIfNeeded(setupToken) {
  if (!setupToken || setupToken.status !== "active") return setupToken;
  if (new Date(setupToken.expiresAt).getTime() <= Date.now()) {
    setupToken.status = "expired";
    saveProvisioningState();
  }
  return setupToken;
}

function createReceiverSetupToken({
  careCircleId = "care-circle-mom",
  receiverHouseholdId = "receiver-household-elizabeth-robert",
  name = "Kitchen Receiver",
  locationLabel = "Kitchen",
  createdByUserId = "user-andrew",
  expiresInMinutes = 30,
  receiverDeviceId = "",
} = {}) {
  seedReceiverDevices();
  const cleanCareCircleId = String(careCircleId || "care-circle-mom").trim();
  const cleanReceiverHouseholdId = String(receiverHouseholdId || "receiver-household-elizabeth-robert").trim();
  const cleanName = String(name || "Kitchen Receiver").trim() || "Kitchen Receiver";
  const cleanLocationLabel = String(locationLabel || "Kitchen").trim() || "Kitchen";
  const cleanCreatedByUserId = String(createdByUserId || "user-andrew").trim() || "user-andrew";
  const cleanExpiresInMinutes = Math.min(Math.max(Number(expiresInMinutes || 30), 1), 1440);
  let cleanReceiverDeviceId = String(receiverDeviceId || "").trim();
  let receiverDevice = cleanReceiverDeviceId ? receiverDevices.get(cleanReceiverDeviceId) : null;

  if (!receiverDevice) {
    cleanReceiverDeviceId = `receiver-device-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    receiverDevice = {
      id: cleanReceiverDeviceId,
      careCircleId: cleanCareCircleId,
      receiverHouseholdId: cleanReceiverHouseholdId,
      receiverId: cleanReceiverDeviceId,
      name: cleanName,
      locationLabel: cleanLocationLabel,
      status: "setup_pending",
      lastSeenAt: "",
      pairedAt: "",
      revokedAt: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deviceToken: "",
    };
    receiverDevices.set(cleanReceiverDeviceId, receiverDevice);
    addProvisioningAuditEvent("receiver_device.created", {
      receiverDeviceId: receiverDevice.id,
      receiverId: receiverDevice.receiverId,
      careCircleId: receiverDevice.careCircleId,
      receiverHouseholdId: receiverDevice.receiverHouseholdId,
      name: receiverDevice.name,
      locationLabel: receiverDevice.locationLabel,
    });
  } else {
    if (receiverDevice.deviceToken) {
      receiverDeviceTokens.delete(receiverDevice.deviceToken);
    }
    receivers.delete(receiverDevice.receiverId);
    activeReceivers.delete(receiverDevice.receiverId);
    receiverDevice.deviceToken = "";
    receiverDevice.name = cleanName || receiverDevice.name;
    receiverDevice.locationLabel = cleanLocationLabel || receiverDevice.locationLabel;
    receiverDevice.status = "setup_pending";
    receiverDevice.revokedAt = "";
    receiverDevice.updatedAt = new Date().toISOString();
    addProvisioningAuditEvent("receiver_device.repair_started", {
      receiverDeviceId: receiverDevice.id,
      receiverId: receiverDevice.receiverId,
      careCircleId: receiverDevice.careCircleId,
      receiverHouseholdId: receiverDevice.receiverHouseholdId,
      name: receiverDevice.name,
      locationLabel: receiverDevice.locationLabel,
    });
  }

  for (const existingToken of receiverSetupTokens.values()) {
    if (existingToken.receiverDeviceId === receiverDevice.id && existingToken.status === "active") {
      existingToken.status = "revoked";
      addProvisioningAuditEvent("setup_token.superseded", {
        receiverDeviceId: receiverDevice.id,
        setupCode: existingToken.setupCode,
        setupTokenStatus: existingToken.status,
      });
    }
  }

  const token = createLocalToken("setup");
  const setupToken = {
    token,
    setupCode: createSetupCode(),
    receiverDeviceId: receiverDevice.id,
    careCircleId: receiverDevice.careCircleId,
    receiverHouseholdId: receiverDevice.receiverHouseholdId,
    expiresAt: new Date(Date.now() + cleanExpiresInMinutes * 60 * 1000).toISOString(),
    usedAt: "",
    createdAt: new Date().toISOString(),
    createdByUserId: cleanCreatedByUserId,
    status: "active",
  };
  receiverSetupTokens.set(token, setupToken);
  addProvisioningAuditEvent("setup_token.created", {
    receiverDeviceId: receiverDevice.id,
    receiverId: receiverDevice.receiverId,
    careCircleId: receiverDevice.careCircleId,
    receiverHouseholdId: receiverDevice.receiverHouseholdId,
    setupCode: setupToken.setupCode,
    expiresAt: setupToken.expiresAt,
    createdByUserId: setupToken.createdByUserId,
  });
  saveProvisioningState();
  return {
    ok: true,
    receiverDevice: publicReceiverDevice(receiverDevice),
    setupToken,
    setupPath: `/web-receiver.html?setupToken=${encodeURIComponent(token)}&serverUrl=${encodeURIComponent(`http://localhost:${port}`)}`,
  };
}

function provisioningSnapshot(options = {}) {
  seedReceiverDevices();
  const careCircle = careCircleService.getCareCircle("care-circle-mom");
  const summary = provisioningSummary(careCircle?.id || "care-circle-mom");
  return {
    ok: true,
    registry: connectProvisioningRegistry,
    careCircle,
    summary,
    receiverHouseholds: receiverHouseholdSummary(careCircle?.id || "care-circle-mom", {
      includeInactiveHouseholds: options.includeInactiveHouseholds,
      includeInactivePeople: options.includeInactivePeople,
    }),
    receiverDevices: [...receiverDevices.values()].map(publicReceiverDevice),
    setupTokens: [...receiverSetupTokens.values()].map(expireSetupTokenIfNeeded),
    auditEvents: listProvisioningAuditEvents(12),
  };
}

function revokeReceiverDevice(receiverDeviceId) {
  seedReceiverDevices();
  const receiverDevice = receiverDevices.get(receiverDeviceId);
  if (!receiverDevice) {
    return { ok: false, status: 404, error: "Receiver device not found." };
  }

  if (receiverDevice.deviceToken) {
    receiverDeviceTokens.delete(receiverDevice.deviceToken);
  }
  const now = new Date().toISOString();
  receiverDevice.deviceToken = "";
  receiverDevice.status = "revoked";
  receiverDevice.revokedAt = now;
  receiverDevice.updatedAt = now;
  receivers.delete(receiverDevice.receiverId);
  activeReceivers.delete(receiverDevice.receiverId);
  for (const setupToken of receiverSetupTokens.values()) {
    if (setupToken.receiverDeviceId === receiverDevice.id && setupToken.status === "active") {
      setupToken.status = "revoked";
      addProvisioningAuditEvent("setup_token.revoked", {
        receiverDeviceId: receiverDevice.id,
        setupCode: setupToken.setupCode,
      });
    }
  }

  addProvisioningAuditEvent("receiver_device.revoked", {
    receiverDeviceId: receiverDevice.id,
    receiverId: receiverDevice.receiverId,
    careCircleId: receiverDevice.careCircleId,
    receiverHouseholdId: receiverDevice.receiverHouseholdId,
    name: receiverDevice.name,
    locationLabel: receiverDevice.locationLabel,
  });
  saveProvisioningState();
  return { ok: true, receiverDevice: publicReceiverDevice(receiverDevice) };
}

function updateReceiverDeviceMetadata(receiverDeviceId, body = {}) {
  seedReceiverDevices();
  const receiverDevice = receiverDevices.get(receiverDeviceId);
  if (!receiverDevice) {
    return { ok: false, status: 404, error: "Receiver device not found." };
  }
  if (receiverDevice.status === "revoked") {
    return { ok: false, status: 409, error: "Revoked receiver devices cannot be edited." };
  }

  const previous = {
    name: receiverDevice.name,
    locationLabel: receiverDevice.locationLabel,
  };
  const nextName = String(body.name || receiverDevice.name || "Receiver").trim();
  const nextLocationLabel = String(body.locationLabel || receiverDevice.locationLabel || "").trim();
  if (!nextName) {
    return { ok: false, status: 400, error: "Receiver device name is required." };
  }

  receiverDevice.name = nextName;
  receiverDevice.locationLabel = nextLocationLabel;
  receiverDevice.updatedAt = new Date().toISOString();

  const activeReceiver = receivers.get(receiverDevice.receiverId);
  if (activeReceiver) {
    activeReceiver.displayName = nextName;
  }

  addProvisioningAuditEvent("receiver_device.updated", {
    receiverDeviceId: receiverDevice.id,
    receiverId: receiverDevice.receiverId,
    careCircleId: receiverDevice.careCircleId,
    receiverHouseholdId: receiverDevice.receiverHouseholdId,
    previous,
    current: {
      name: receiverDevice.name,
      locationLabel: receiverDevice.locationLabel,
    },
  });
  saveProvisioningState();
  return { ok: true, receiverDevice: publicReceiverDevice(receiverDevice) };
}

function assignReceiverDeviceHousehold(receiverDeviceId, body = {}) {
  seedReceiverDevices();
  const receiverDevice = receiverDevices.get(receiverDeviceId);
  if (!receiverDevice) {
    return { ok: false, status: 404, error: "Receiver device not found." };
  }
  if (receiverDevice.status === "revoked") {
    return { ok: false, status: 409, error: "Revoked receiver devices cannot be reassigned." };
  }
  const nextReceiverHouseholdId = String(body.receiverHouseholdId || "").trim();
  const nextHousehold = receiverHouseholdSummary(receiverDevice.careCircleId)
    .find(household => household.id === nextReceiverHouseholdId);
  if (!nextHousehold) {
    return { ok: false, status: 400, error: "Receiver household is not available for this care circle." };
  }
  const previousReceiverHouseholdId = receiverDevice.receiverHouseholdId;
  if (previousReceiverHouseholdId === nextReceiverHouseholdId) {
    return {
      ok: true,
      changed: false,
      receiverDevice: publicReceiverDevice(receiverDevice),
      receiverHousehold: nextHousehold,
    };
  }

  const revokedSetupTokens = [];
  for (const setupToken of receiverSetupTokens.values()) {
    if (setupToken.receiverDeviceId === receiverDevice.id && setupToken.status === "active") {
      setupToken.status = "revoked";
      setupToken.revokedAt = new Date().toISOString();
      revokedSetupTokens.push(setupToken);
      addProvisioningAuditEvent("setup_token.revoked", {
        receiverDeviceId: receiverDevice.id,
        receiverId: receiverDevice.receiverId,
        careCircleId: receiverDevice.careCircleId,
        receiverHouseholdId: previousReceiverHouseholdId,
        setupCode: setupToken.setupCode,
        reason: "receiver_household_reassigned",
      });
    }
  }

  receiverDevice.receiverHouseholdId = nextReceiverHouseholdId;
  receiverDevice.updatedAt = new Date().toISOString();
  addProvisioningAuditEvent("receiver_device.household_assigned", {
    receiverDeviceId: receiverDevice.id,
    receiverId: receiverDevice.receiverId,
    careCircleId: receiverDevice.careCircleId,
    previousReceiverHouseholdId,
    receiverHouseholdId: nextReceiverHouseholdId,
    name: receiverDevice.name,
    locationLabel: receiverDevice.locationLabel,
    revokedSetupTokenCount: revokedSetupTokens.length,
  });
  saveProvisioningState();
  return {
    ok: true,
    changed: true,
    receiverDevice: publicReceiverDevice(receiverDevice),
    receiverHousehold: nextHousehold,
    revokedSetupTokens,
  };
}

function createSetupTokenForReceiverDevice(receiverDeviceId, body = {}) {
  seedReceiverDevices();
  const receiverDevice = receiverDevices.get(receiverDeviceId);
  if (!receiverDevice) {
    return { ok: false, status: 404, error: "Receiver device not found." };
  }
  return createReceiverSetupToken({
    ...body,
    receiverDeviceId: receiverDevice.id,
    careCircleId: receiverDevice.careCircleId,
    receiverHouseholdId: receiverDevice.receiverHouseholdId,
    name: body.name || receiverDevice.name,
    locationLabel: body.locationLabel || receiverDevice.locationLabel,
  });
}

function revokeReceiverSetupToken(token) {
  seedReceiverDevices();
  const setupToken = expireSetupTokenIfNeeded(receiverSetupTokens.get(token));
  if (!setupToken) {
    return { ok: false, status: 404, error: "Setup token not found." };
  }
  if (setupToken.status !== "active") {
    return { ok: false, status: 409, error: `Setup token is already ${setupToken.status}.` };
  }
  const receiverDevice = receiverDevices.get(setupToken.receiverDeviceId) || null;
  setupToken.status = "revoked";
  setupToken.revokedAt = new Date().toISOString();
  addProvisioningAuditEvent("setup_token.revoked", {
    receiverDeviceId: setupToken.receiverDeviceId,
    receiverId: receiverDevice?.receiverId || "",
    careCircleId: setupToken.careCircleId,
    receiverHouseholdId: setupToken.receiverHouseholdId,
    setupCode: setupToken.setupCode,
    revokedByUserId: "user-andrew",
  });
  saveProvisioningState();
  return {
    ok: true,
    setupToken,
    receiverDevice: publicReceiverDevice(receiverDevice),
  };
}

function exchangeReceiverSetupToken(token) {
  seedReceiverDevices();
  const setupToken = expireSetupTokenIfNeeded(receiverSetupTokens.get(token));
  if (!setupToken || setupToken.status !== "active") {
    return { ok: false, status: 410, error: "Setup link is expired or has already been used." };
  }
  const receiverDevice = receiverDevices.get(setupToken.receiverDeviceId);
  if (!receiverDevice || receiverDevice.revokedAt) {
    return { ok: false, status: 404, error: "Receiver device is not available for setup." };
  }

  const deviceToken = createLocalToken("receiver");
  const now = new Date().toISOString();
  setupToken.status = "used";
  setupToken.usedAt = now;
  if (receiverDevice.deviceToken) {
    receiverDeviceTokens.delete(receiverDevice.deviceToken);
  }
  receiverDevice.deviceToken = deviceToken;
  receiverDeviceTokens.set(deviceToken, receiverDevice.id);
  receiverDevice.receiverId = receiverDevice.id;
  receiverDevice.status = "available";
  receiverDevice.pairedAt = now;
  receiverDevice.revokedAt = "";
  receiverDevice.updatedAt = now;

  addProvisioningAuditEvent("setup_token.exchanged", {
    receiverDeviceId: receiverDevice.id,
    receiverId: receiverDevice.receiverId,
    careCircleId: receiverDevice.careCircleId,
    receiverHouseholdId: receiverDevice.receiverHouseholdId,
    setupCode: setupToken.setupCode,
    tokenScope: "receiver_device",
  });
  addProvisioningAuditEvent("receiver_device.paired", {
    receiverDeviceId: receiverDevice.id,
    receiverId: receiverDevice.receiverId,
    careCircleId: receiverDevice.careCircleId,
    receiverHouseholdId: receiverDevice.receiverHouseholdId,
    name: receiverDevice.name,
    locationLabel: receiverDevice.locationLabel,
  });
  saveProvisioningState();
  return {
    ok: true,
    receiverDevice: publicReceiverDevice(receiverDevice),
    deviceToken,
    tokenScope: "receiver_device",
  };
}

function exchangeReceiverSetupCode(setupCode) {
  seedReceiverDevices();
  const normalizedSetupCode = normalizeSetupCode(setupCode);
  const setupToken = [...receiverSetupTokens.values()]
    .map(expireSetupTokenIfNeeded)
    .find(token => normalizeSetupCode(token.setupCode) === normalizedSetupCode && token.status === "active");
  if (!setupToken) {
    return { ok: false, status: 410, error: "Setup code is expired, revoked, or already used." };
  }
  return exchangeReceiverSetupToken(setupToken.token);
}

function readEnvFileValue(filePath, key) {
  try {
    const contents = fs.readFileSync(filePath, "utf8");
    const line = contents
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${key}=`));
    if (!line) return "";
    let value = line.slice(key.length + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  } catch {
    return "";
  }
}

function hydrateAudioEnvFromFile() {
  if (!process.env.OPENAI_API_KEY) {
    const apiKey = readEnvFileValue(audioEnvPath, "OPENAI_API_KEY");
    if (apiKey) {
      process.env.OPENAI_API_KEY = apiKey;
    }
  }
  if (!process.env.OPENAI_TRANSCRIBE_MODEL) {
    const model = readEnvFileValue(audioEnvPath, "OPENAI_TRANSCRIBE_MODEL");
    if (model) {
      process.env.OPENAI_TRANSCRIBE_MODEL = model;
    }
  }
}

loadProvisioningState();
loadAudioState();
hydrateAudioEnvFromFile();

function cpPersConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    readEnvFileValue(cpPersEnvPath, "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    readEnvFileValue(cpPersEnvPath, "SUPABASE_SERVICE_ROLE_KEY") ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    readEnvFileValue(cpPersEnvPath, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { supabaseUrl, supabaseKey };
}

function normalizeAppointment(row) {
  return {
    id: row.id,
    title: row.title || row.reason || "Appointment",
    reason: row.reason || "",
    startsAt: row.starts_at || "",
    status: row.status || "",
    providerName: row.provider_name || "",
    providerOrganization: row.provider_organization || "",
    locationName: row.location_name || "",
    locationAddress: row.location_address || "",
    locationPhone: row.location_phone || "",
    careCircleId: row.care_circle_id || "",
    careSubjectId: row.care_subject_id || "",
    source: "cp_pers",
  };
}

async function fetchCpPersUpcomingAppointments(limit = 8) {
  const { supabaseUrl, supabaseKey } = cpPersConfig();
  if (!supabaseUrl || !supabaseKey) {
    return {
      ok: false,
      status: 503,
      error: "CP Pers Supabase settings are not configured for this local server.",
    };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,care_circle_id,care_subject_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone,deleted_at"
  );
  params.set("deleted_at", "is.null");
  params.set("starts_at", `gte.${todayStart.toISOString()}`);
  params.set("order", "starts_at.asc.nullslast");
  params.set("limit", String(limit));

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/appointments?${params}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload?.message || "Unable to load CP Pers appointments.",
    };
  }
  return { ok: true, appointments: payload.map(normalizeAppointment) };
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "carepland-connect-local-trigger-server" });
});

app.get("/", (req, res) => {
  res.redirect(302, `${connectWebBaseUrl}/index.html`);
});

app.get(["/index.html", "/web-receiver.html"], (req, res) => {
  const target = new URL(`${connectWebBaseUrl}${req.path}`);
  for (const [key, value] of Object.entries(req.query || {})) {
    target.searchParams.set(key, String(value));
  }
  res.redirect(302, target.toString());
});

app.get("/personal/appointments/upcoming", async (req, res) => {
  // TODO: replace this local bridge with a first-class CP Pers/Connect API contract.
  const limit = Math.min(Math.max(Number(req.query.limit || 8), 1), 20);
  try {
    const result = await fetchCpPersUpcomingAppointments(limit);
    if (!result.ok) {
      res.status(result.status || 500).json({ ok: false, error: result.error, appointments: [] });
      return;
    }
    res.json({
      ok: true,
      source: "cp_pers",
      appointments: result.appointments,
      available: true,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || "Unable to load CP Pers appointments.",
      appointments: [],
      available: false,
    });
  }
});

app.post("/reset", (req, res) => {
  nextEventId = 1;
  nextMessageId = 1;
  eventsByReceiver.clear();
  calls.clear();
  receivers.clear();
  receiverDevices.clear();
  receiverSetupTokens.clear();
  receiverDeviceTokens.clear();
  provisioningAuditEvents.length = 0;
  receiverHeartbeatAuditAt.clear();
  activeReceivers.clear();
  messages.length = 0;
  seedReceiverDevices();
  saveProvisioningState();
  res.json({ ok: true });
});

app.get("/receivers", (req, res) => {
  seedReceiverDevices();
  const now = Date.now();
  const receiverList = [...receivers.values()].map(receiver => ({
    ...receiver,
    receiverDevice: publicReceiverDevice(findReceiverDeviceByReceiverId(receiver.receiverId)),
    online: now - receiver.lastSeenMs < 8000,
  }));
  res.json({ ok: true, receivers: receiverList });
});

app.get("/receiver-devices", (req, res) => {
  res.json(provisioningSnapshot());
});

app.get("/receiver-devices/:receiverDeviceId", (req, res) => {
  const result = provisioningDeviceDetail(req.params.receiverDeviceId);
  res.status(result.status || 200).json(result);
});

app.patch("/receiver-devices/:receiverDeviceId", (req, res) => {
  const result = updateReceiverDeviceMetadata(req.params.receiverDeviceId, req.body);
  res.status(result.status || 200).json(result);
});

app.post("/receiver-devices/:receiverDeviceId/household", (req, res) => {
  const result = assignReceiverDeviceHousehold(req.params.receiverDeviceId, req.body);
  res.status(result.status || 200).json(result);
});

app.get("/connect/provisioning", (req, res) => {
  res.json(provisioningSnapshot({
    includeInactiveHouseholds: req.query.includeInactiveHouseholds === "1" || req.query.includeInactiveHouseholds === "true",
    includeInactivePeople: req.query.includeInactivePeople === "1" || req.query.includeInactivePeople === "true",
  }));
});

app.get("/connect/provisioning/metadata", (req, res) => {
  res.json({ ok: true, registry: connectProvisioningRegistry });
});

app.get("/connect/provisioning/summary", (req, res) => {
  seedReceiverDevices();
  const careCircleId = String(req.query.careCircleId || "care-circle-mom");
  res.json({
    ok: true,
    registry: connectProvisioningRegistry,
    summary: provisioningSummary(careCircleId),
  });
});

app.get("/connect/provisioning/receiver-devices", (req, res) => {
  res.json(provisioningSnapshot());
});

app.get("/connect/provisioning/receiver-devices/:receiverDeviceId", (req, res) => {
  const result = provisioningDeviceDetail(req.params.receiverDeviceId);
  res.status(result.status || 200).json(result);
});

app.patch("/connect/provisioning/receiver-devices/:receiverDeviceId", (req, res) => {
  const result = updateReceiverDeviceMetadata(req.params.receiverDeviceId, req.body);
  res.status(result.status || 200).json(result);
});

app.post("/connect/provisioning/receiver-devices/:receiverDeviceId/household", (req, res) => {
  const result = assignReceiverDeviceHousehold(req.params.receiverDeviceId, req.body);
  res.status(result.status || 200).json(result);
});

app.get("/connect/provisioning/households", (req, res) => {
  const careCircleId = String(req.query.careCircleId || "care-circle-mom");
  res.json({
    ok: true,
    registry: connectProvisioningRegistry,
    receiverHouseholds: receiverHouseholdSummary(careCircleId, {
      includeInactiveHouseholds: req.query.includeInactiveHouseholds === "1" || req.query.includeInactiveHouseholds === "true",
    }),
  });
});

app.post("/connect/provisioning/households", (req, res) => {
  const result = createReceiverHousehold(req.body);
  res.status(result.status || 200).json(result);
});

app.post("/connect/provisioning/households/:receiverHouseholdId/deactivate", (req, res) => {
  const result = deactivateReceiverHousehold(req.params.receiverHouseholdId);
  res.status(result.status || 200).json(result);
});

app.post("/connect/provisioning/households/:receiverHouseholdId/restore", (req, res) => {
  const result = restoreReceiverHousehold(req.params.receiverHouseholdId);
  res.status(result.status || 200).json(result);
});

app.post("/connect/provisioning/households/:receiverHouseholdId/receiver-people", (req, res) => {
  const result = createReceiverPerson(req.params.receiverHouseholdId, req.body);
  res.status(result.status || 200).json(result);
});

app.post("/connect/provisioning/receiver-people/:receiverPersonId/deactivate", (req, res) => {
  const result = deactivateReceiverPerson(req.params.receiverPersonId);
  res.status(result.status || 200).json(result);
});

app.post("/connect/provisioning/receiver-people/:receiverPersonId/restore", (req, res) => {
  const result = restoreReceiverPerson(req.params.receiverPersonId);
  res.status(result.status || 200).json(result);
});

app.get("/connect/provisioning/households/:receiverHouseholdId", (req, res) => {
  const careCircleId = String(req.query.careCircleId || "care-circle-mom");
  const result = provisioningHouseholdDetail(req.params.receiverHouseholdId, careCircleId, {
    includeInactivePeople: req.query.includeInactivePeople === "1" || req.query.includeInactivePeople === "true",
    includeInactiveHouseholds: req.query.includeInactiveHouseholds === "1" || req.query.includeInactiveHouseholds === "true",
  });
  res.status(result.status || 200).json(result);
});

app.get("/connect/provisioning/audit-events", (req, res) => {
  res.json({
    ok: true,
    registry: connectProvisioningRegistry,
    auditEvents: listProvisioningAuditEvents(req.query.limit),
  });
});

app.post("/receiver-setup-tokens", (req, res) => {
  res.json(createReceiverSetupToken(req.body));
});

app.post("/connect/provisioning/setup-tokens", (req, res) => {
  res.json(createReceiverSetupToken(req.body));
});

app.post("/receiver-devices/:receiverDeviceId/revoke", (req, res) => {
  const result = revokeReceiverDevice(req.params.receiverDeviceId);
  res.status(result.status || 200).json(result);
});

app.post("/connect/provisioning/receiver-devices/:receiverDeviceId/revoke", (req, res) => {
  const result = revokeReceiverDevice(req.params.receiverDeviceId);
  res.status(result.status || 200).json(result);
});

app.post("/receiver-devices/:receiverDeviceId/setup-token", (req, res) => {
  const result = createSetupTokenForReceiverDevice(req.params.receiverDeviceId, req.body);
  res.status(result.status || 200).json(result);
});

app.post("/connect/provisioning/receiver-devices/:receiverDeviceId/setup-token", (req, res) => {
  const result = createSetupTokenForReceiverDevice(req.params.receiverDeviceId, req.body);
  res.status(result.status || 200).json(result);
});

app.post("/receiver-setup-tokens/:token/revoke", (req, res) => {
  const result = revokeReceiverSetupToken(req.params.token);
  res.status(result.status || 200).json(result);
});

app.post("/connect/provisioning/setup-tokens/:token/revoke", (req, res) => {
  const result = revokeReceiverSetupToken(req.params.token);
  res.status(result.status || 200).json(result);
});

app.post("/receiver-setup-tokens/:token/exchange", (req, res) => {
  const result = exchangeReceiverSetupToken(req.params.token);
  res.status(result.status || 200).json(result);
});

app.post("/connect/provisioning/setup-tokens/:token/exchange", (req, res) => {
  const result = exchangeReceiverSetupToken(req.params.token);
  res.status(result.status || 200).json(result);
});

app.post("/receiver-setup-codes/:setupCode/exchange", (req, res) => {
  const result = exchangeReceiverSetupCode(req.params.setupCode);
  res.status(result.status || 200).json(result);
});

app.post("/connect/provisioning/setup-codes/:setupCode/exchange", (req, res) => {
  const result = exchangeReceiverSetupCode(req.params.setupCode);
  res.status(result.status || 200).json(result);
});

app.get("/care-circles", (req, res) => {
  res.json({ ok: true, careCircles: careCircleService.allCareCircles() });
});

app.get("/care-circles/:careCircleId", (req, res) => {
  const careCircle = careCircleService.getCareCircle(req.params.careCircleId);
  if (!careCircle) {
    res.status(404).json({ ok: false, error: "Care circle not found." });
    return;
  }
  res.json({
    ok: true,
    careCircle,
    members: careCircleService.getMembers(careCircle.id),
    receiverDevices: careCircleService.getReceiverDevices(careCircle.id),
    receiverHouseholds: careCircleService.getReceiverHouseholds(careCircle.id),
    receiverPeople: careCircleService.getReceiverPeople(careCircle.id),
    escalationPolicies: careCircleService.getEscalationPolicies(careCircle.id),
    participantConnections: careCircleService.getConnections(careCircle.id),
  });
});

app.get("/care-circles/:careCircleId/member-view/:viewerMemberId", (req, res) => {
  const view = careCircleService.viewForMember(req.params.careCircleId, req.params.viewerMemberId, {
    includeDiscoverable: String(req.query.includeDiscoverable || "false") === "true",
  });
  if (!view) {
    res.status(404).json({ ok: false, error: "Care circle member view not found." });
    return;
  }
  res.json({ ok: true, ...view });
});

app.get("/care-circles/:careCircleId/connections", (req, res) => {
  const careCircle = careCircleService.getCareCircle(req.params.careCircleId);
  if (!careCircle) {
    res.status(404).json({ ok: false, error: "Care circle not found." });
    return;
  }
  res.json({
    ok: true,
    participantConnections: careCircleService.getConnections(careCircle.id),
  });
});

app.get("/receiver-settings", (req, res) => {
  const careCircleId = String(req.query.careCircleId || "care-circle-mom");
  const settings = careCircleService.getReceiverSettings(careCircleId);
  if (!settings) {
    res.status(404).json({ ok: false, error: "Receiver settings not found." });
    return;
  }
  res.json({ ok: true, ...settings });
});

app.put("/receiver-settings/identity", (req, res) => {
  const result = careCircleService.updateReceiverIdentity(
    String(req.body.receiverDeviceId || ""),
    {
      name: req.body.name,
      locationLabel: req.body.locationLabel,
    }
  );
  if (!result.ok) {
    res.status(result.status || 400).json({ ok: false, error: result.error });
    return;
  }
  res.json(result);
});

app.put("/receiver-settings/lockdown", (req, res) => {
  const result = careCircleService.updateReceiverLockdown({
    hideOperationalSettingsOnReceiver: req.body.hideOperationalSettingsOnReceiver,
    allowReceiverComfortSettings: req.body.allowReceiverComfortSettings,
    requireAdminApprovalForContactChanges: req.body.requireAdminApprovalForContactChanges,
  });
  res.json(result);
});

app.put("/receiver-settings/contact-permissions/:memberId", (req, res) => {
  const result = careCircleService.updateMemberReceiverPermissions(req.params.memberId, {
    canCallReceiver: req.body.canCallReceiver,
    canMessageReceiver: req.body.canMessageReceiver,
    canRequestAttention: req.body.canRequestAttention,
  });
  if (!result.ok) {
    res.status(result.status || 400).json({ ok: false, error: result.error });
    return;
  }
  res.json(result);
});

app.post("/care-circles/:careCircleId/connections/request", (req, res) => {
  const result = careCircleService.requestConnection(
    req.params.careCircleId,
    String(req.body.requesterParticipantId || ""),
    String(req.body.recipientParticipantId || "")
  );
  if (!result.ok) {
    res.status(result.status || 400).json({ ok: false, error: result.error });
    return;
  }
  res.json(result);
});

app.post("/care-circles/:careCircleId/connections/:connectionId/state", (req, res) => {
  const careCircle = careCircleService.getCareCircle(req.params.careCircleId);
  if (!careCircle) {
    res.status(404).json({ ok: false, error: "Care circle not found." });
    return;
  }
  const result = careCircleService.updateConnectionStatus(
    req.params.connectionId,
    String(req.body.status || "")
  );
  if (!result.ok) {
    res.status(result.status || 400).json({ ok: false, error: result.error });
    return;
  }
  res.json(result);
});

app.post("/receivers/register", (req, res) => {
  seedReceiverDevices();
  const bearerToken = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const submittedDeviceToken = String(req.body.deviceToken || "").trim();
  const deviceToken = bearerToken || submittedDeviceToken;
  const pairedDevice = deviceToken ? receiverDeviceFromToken(deviceToken) : null;
  if (deviceToken && !pairedDevice) {
    res.status(401).json({ ok: false, error: "Receiver device token is invalid or revoked." });
    return;
  }
  const receiverId = normalizeReceiverId(req.body.receiverId);
  const displayName = String(req.body.displayName || "Living Room Receiver").trim() || "Living Room Receiver";
  const status = String(req.body.status || "available").trim() || "available";
  const effectiveReceiverId = pairedDevice ? pairedDevice.receiverId : receiverId;
  const now = new Date().toISOString();
  const receiver = {
    receiverId: effectiveReceiverId,
    receiverDeviceId: pairedDevice?.id || "",
    careCircleId: pairedDevice?.careCircleId || "",
    receiverHouseholdId: pairedDevice?.receiverHouseholdId || "",
    displayName,
    deviceType: String(req.body.deviceType || "android").trim() || "android",
    status,
    lastSeen: now,
    lastSeenMs: Date.now(),
  };
  if (pairedDevice) {
    pairedDevice.status = status;
    pairedDevice.lastSeenAt = now;
    pairedDevice.updatedAt = now;
    maybeAuditReceiverHeartbeat(pairedDevice, now);
    saveProvisioningState();
  }
  receivers.set(effectiveReceiverId, receiver);
  activeReceivers.add(effectiveReceiverId);
  res.json({ ok: true, receiver });
});

app.get("/receivers/:receiverId/events", (req, res) => {
  const receiverId = normalizeReceiverId(req.params.receiverId);
  activeReceivers.add(receiverId);
  const latestEventId = nextEventId - 1;
  let since = Number(req.query.since || 0);
  if (since > latestEventId) {
    since = 0;
  }
  const events = receiverEvents(receiverId).filter(event => event.id > since);
  res.json({ ok: true, receiverId, latestEventId, activeReceivers: [...activeReceivers], events });
});

app.get("/receivers/:receiverId/ui-state", (req, res) => {
  const receiverId = normalizeReceiverId(req.params.receiverId);
  activeReceivers.add(receiverId);
  const uiState = receiverUiStates.get(receiverId) || null;
  res.json({ ok: true, receiverId, uiState });
});

app.post("/receivers/:receiverId/ui-state", (req, res) => {
  const receiverId = normalizeReceiverId(req.params.receiverId);
  activeReceivers.add(receiverId);
  const uiState = {
    receiverId,
    updatedAt: new Date().toISOString(),
    receiverStarted: Boolean(req.body.receiverStarted),
    selectedContactId: String(req.body.selectedContactId || ""),
    activeConversation: req.body.activeConversation && typeof req.body.activeConversation === "object"
      ? req.body.activeConversation
      : null,
    statusLine: String(req.body.statusLine || "").slice(0, 240),
    source: String(req.body.source || "receiver"),
  };
  receiverUiStates.set(receiverId, uiState);
  res.json({ ok: true, receiverId, uiState });
});

app.post("/receivers/:receiverId/guide-target", (req, res) => {
  const receiverId = normalizeReceiverId(req.params.receiverId);
  const rect = sanitizeGuideRect(req.body.rect);
  if (!rect) {
    res.status(400).json({ ok: false, error: "Guide target rect is required" });
    return;
  }
  const guide = {
    guideId: String(req.body.guideId || `guide-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    label: String(req.body.label || "this button").trim().slice(0, 120) || "this button",
    rect,
    source: String(req.body.source || "coordinator_dashboard"),
    state: "active",
    createdAt: new Date().toISOString(),
  };
  const event = addEvent(receiverId, "guide.target", guide);
  res.json({ ok: true, receiverId, guide, event });
});

app.post("/receivers/:receiverId/guide-target/clear", (req, res) => {
  const receiverId = normalizeReceiverId(req.params.receiverId);
  const event = addEvent(receiverId, "guide.cleared", {
    guideId: String(req.body.guideId || "").trim(),
    state: "cleared",
    clearedAt: new Date().toISOString(),
    source: String(req.body.source || "coordinator_dashboard"),
  });
  res.json({ ok: true, receiverId, event });
});

app.post("/receivers/:receiverId/guide-target/:guideId/complete", (req, res) => {
  const receiverId = normalizeReceiverId(req.params.receiverId);
  const guideId = String(req.params.guideId || "").trim();
  const pressedRect = sanitizeGuideRect(req.body.pressedRect);
  const event = addEvent(receiverId, "guide.completed", {
    guideId,
    state: "completed",
    completedAt: new Date().toISOString(),
    source: String(req.body.source || "receiver"),
    pressedLabel: String(req.body.pressedLabel || "").trim().slice(0, 120),
    pressedRect,
    matchedTarget: Boolean(req.body.matchedTarget),
  });
  res.json({ ok: true, receiverId, event });
});

app.post("/call", (req, res) => {
  const receiverId = normalizeReceiverId(req.body.receiverId);
  const callerName = String(req.body.callerName || "Andrew").trim() || "Andrew";
  const recipientName = String(req.body.recipientName || "Mom").trim() || "Mom";
  const callerMember = careCircleService.findMemberByDisplayName(callerName);
  if (callerMember && !careCircleService.canMemberCallReceiver(callerMember)) {
    res.status(403).json({ ok: false, error: `${callerName} is not allowed to call this receiver.` });
    return;
  }
  const call = createCallRecord({
    receiverId,
    callerName,
    recipientName,
    source: "coordinator_dashboard",
  });
  calls.set(call.callId, call);
  const events = addEventForReceivers(call.receiverIds, "call.started", call);
  res.json({ ok: true, call: publicCall(call), events });
});

app.get("/messages", (req, res) => {
  const receiverId = req.query.receiverId ? normalizeReceiverId(req.query.receiverId) : "";
  const q = String(req.query.q || "").trim().toLowerCase();
  let filtered = receiverId
    ? messages.filter(message => message.receiverId === receiverId)
    : messages;
  if (q) {
    filtered = filtered.filter(message => {
      const searchable = [
        message.body,
        message.transcript,
        message.to,
        message.from,
        message.source,
      ].join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }
  res.json({ ok: true, messages: filtered.slice().reverse() });
});

app.patch("/messages/:messageId/state", (req, res) => {
  const messageId = String(req.params.messageId || "").trim();
  const receiverId = req.body.receiverId ? normalizeReceiverId(req.body.receiverId) : "";
  const now = new Date().toISOString();
  const message = messages.find((entry) => entry.id === messageId);
  if (!message) {
    res.status(404).json({ ok: false, error: "Message not found" });
    return;
  }
  if (receiverId && message.receiverId !== receiverId) {
    res.status(404).json({ ok: false, error: "Message not found for receiver" });
    return;
  }

  const heard = Boolean(req.body.heard);
  const read = Boolean(req.body.read);
  let newlyHeard = false;
  let newlyRead = false;
  if (heard && !message.heardAt) {
    message.heardAt = now;
    newlyHeard = true;
  }
  if (read && !message.readAt) {
    message.readAt = now;
    newlyRead = true;
  }
  message.updatedAt = now;
  addEvent(message.receiverId, "message.state_updated", {
    messageId: message.id,
    heardAt: message.heardAt || "",
    readAt: message.readAt || "",
  });
  if (newlyHeard) {
    recordAudioTimelineEvent({
      receiverId: message.receiverId,
      type: "message.heard",
      artifactId: message.audioArtifactId || "",
      messageId: message.id,
      audioUrl: message.audioUrl || "",
      summary: "Message heard on receiver",
      detail: { heardAt: message.heardAt || "" },
    });
  }
  if (newlyRead) {
    recordAudioTimelineEvent({
      receiverId: message.receiverId,
      type: "message.read",
      artifactId: message.audioArtifactId || "",
      messageId: message.id,
      audioUrl: message.audioUrl || "",
      summary: "Message read on receiver",
      detail: { readAt: message.readAt || "" },
    });
  }
  saveAudioState();
  res.json({ ok: true, message });
});

app.get("/connect/theme", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId);
  const saved = receiverThemes.get(receiverId);
  res.json({
    ok: true,
    receiverId,
    theme: normalizeConnectTheme(saved || defaultConnectTheme),
    source: saved ? "local_connect_server" : "default",
  });
});

app.put("/connect/theme", (req, res) => {
  const receiverId = normalizeReceiverId(req.body.receiverId);
  const theme = normalizeConnectTheme(req.body.theme || req.body);
  receiverThemes.set(receiverId, {
    ...theme,
    updatedAt: new Date().toISOString(),
  });
  addEvent(receiverId, "theme.updated", { themeName: theme.name });
  res.json({
    ok: true,
    receiverId,
    theme,
  });
});

app.delete("/connect/theme", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId || req.body.receiverId);
  receiverThemes.delete(receiverId);
  addEvent(receiverId, "theme.reset", { themeName: defaultConnectTheme.name });
  res.json({
    ok: true,
    receiverId,
    theme: { ...defaultConnectTheme },
  });
});

app.post("/audio/transcriptions", async (req, res) => {
  const receiverId = normalizeReceiverId(req.body.receiverId);
  const audioBase64 = String(req.body.audioBase64 || "").trim();
  const audioMimeType = String(req.body.audioMimeType || "").trim();
  const audioDurationMs = Number(req.body.audioDurationMs || 0);
  const source = String(req.body.source || "audio_capture").trim() || "audio_capture";
  const artifactKind = String(req.body.artifactKind || "").trim();
  const audioDirection = String(req.body.audioDirection || "").trim();
  const clientAudioCaptureId = String(req.body.clientAudioCaptureId || "").trim();
  const askInteractionId = String(req.body.askInteractionId || "").trim();
  const captureContext = sanitizeAudioCaptureContext(req.body.captureContext);
  if (!audioBase64) {
    res.status(400).json({ ok: false, error: "audioBase64 is required" });
    return;
  }

  const savedAudio = await saveAudioBase64Artifact({
    uploadsDir,
    audioBase64,
    audioMimeType,
    filePrefix: source,
  });
  if (!savedAudio.ok) {
    res.status(savedAudio.status || 400).json({ ok: false, error: savedAudio.error });
    return;
  }
  const artifact = recordAudioArtifact({
    receiverId,
    source,
    artifactKind,
    audioDirection,
    clientAudioCaptureId,
    askInteractionId,
    audioUrl: savedAudio.audioUrl,
    audioMimeType,
    audioByteSize: savedAudio.audioByteSize,
    audioSha256: savedAudio.audioSha256,
    audioDurationMs,
    captureContext,
    transcript: savedAudio.transcript,
    transcriptStatus: savedAudio.transcriptStatus,
  });

  res.json({
    ok: true,
    artifact,
    audioUrl: savedAudio.audioUrl,
    audioMimeType,
    transcript: savedAudio.transcript,
    transcriptStatus: savedAudio.transcriptStatus,
  });
});

app.post("/messages", async (req, res) => {
  const receiverId = normalizeReceiverId(req.body.receiverId);
  const to = String(req.body.to || "Andrew").trim() || "Andrew";
  const from = String(req.body.from || "receiver_user").trim() || "receiver_user";
  const body = String(req.body.body || "").trim() || "Voice message";
  const messageType = String(req.body.messageType || "text").trim() || "text";
  const audioBase64 = String(req.body.audioBase64 || "").trim();
  const audioMimeType = String(req.body.audioMimeType || "").trim();
  const audioDurationMs = Number(req.body.audioDurationMs || 0);
  const clientMessageId = String(req.body.clientMessageId || "").trim();
  const clientAudioCaptureId = String(req.body.clientAudioCaptureId || "").trim();
  const askInteractionId = String(req.body.askInteractionId || "").trim();
  const artifactKind = String(req.body.artifactKind || "").trim();
  const audioDirection = String(req.body.audioDirection || "").trim();
  const captureContext = sanitizeAudioCaptureContext(req.body.captureContext);
  let audioUrl = "";
  let audioByteSize = 0;
  let audioSha256 = "";
  let transcript = "";
  let transcriptStatus = messageType === "audio" ? "not_configured" : "not_requested";

  if (messageType === "audio") {
    if (!audioBase64) {
      res.status(400).json({ ok: false, error: "audioBase64 is required for audio messages" });
      return;
    }
    const savedAudio = await saveAudioBase64Message({
      uploadsDir,
      audioBase64,
      audioMimeType,
    });
    if (!savedAudio.ok) {
      res.status(savedAudio.status || 400).json({ ok: false, error: savedAudio.error });
      return;
    }
    audioUrl = savedAudio.audioUrl;
    audioByteSize = savedAudio.audioByteSize || 0;
    audioSha256 = savedAudio.audioSha256 || "";
    transcript = savedAudio.transcript;
    transcriptStatus = savedAudio.transcriptStatus;
  }

  const message = {
    id: `message-${nextMessageId++}`,
    clientMessageId,
    clientAudioCaptureId,
    askInteractionId,
    receiverId,
    from,
    to,
    body,
    messageType,
    audioUrl,
    audioMimeType,
    audioDurationMs,
    captureContext: messageType === "audio" ? captureContext : {},
    transcript,
    transcriptStatus,
    heardAt: "",
    readAt: "",
    searchableText: [body, transcript, from, to].filter(Boolean).join(" "),
    createdAt: new Date().toISOString(),
    source: String(req.body.source || "receiver").trim() || "receiver",
  };
  messages.push(message);
  saveAudioState();
  let audioArtifact = null;
  if (messageType === "audio") {
    audioArtifact = recordAudioArtifact({
      receiverId,
      source: message.source,
      from,
      to,
      messageId: message.id,
      clientMessageId,
      clientAudioCaptureId,
      askInteractionId,
      artifactKind,
      audioDirection,
      audioUrl,
      audioMimeType,
      audioByteSize,
      audioSha256,
      audioDurationMs,
      captureContext,
      transcript,
      transcriptStatus,
    });
    message.audioArtifactId = audioArtifact.id;
    saveAudioState();
  }
  addEvent(receiverId, "message.created", { messageId: message.id, messageType, to });
  res.json({ ok: true, message, artifact: audioArtifact });
});

app.get("/audio/artifacts", (req, res) => {
  const receiverId = req.query.receiverId ? normalizeReceiverId(req.query.receiverId) : "";
  const q = String(req.query.q || "").trim().toLowerCase();
  let filtered = receiverId
    ? audioArtifacts.filter(artifact => artifact.receiverId === receiverId)
    : audioArtifacts;
  if (q) {
    filtered = filtered.filter(artifact => {
      const searchable = [
        artifact.source,
        artifact.from,
        artifact.to,
        artifact.messageId,
        artifact.clientMessageId,
        artifact.transcript,
        artifact.transcriptStatus,
      ].join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }
  res.json({ ok: true, artifacts: filtered.slice().reverse() });
});

app.post("/audio/artifacts/reconcile", (req, res) => {
  const receiverId = normalizeReceiverId(req.body.receiverId);
  const dryRun = Boolean(req.body.dryRun);
  const limit = Math.max(1, Math.min(Number(req.body.limit || 50), 200));
  const recoverable = listRecoverableUploadArtifacts(receiverId).slice(0, limit);
  const recovered = dryRun
    ? []
    : recoverable.map((artifact) => recordAudioArtifact(artifact));
  res.json({
    ok: true,
    dryRun,
    receiverId,
    recoverableCount: recoverable.length,
    recoveredCount: recovered.length,
    artifacts: dryRun ? recoverable : recovered,
    review: dryRun ? null : audioReviewFor(receiverId),
  });
});

app.post("/audio/artifacts/backfill-integrity", (req, res) => {
  const receiverId = req.body.receiverId ? normalizeReceiverId(req.body.receiverId) : "";
  const limit = Math.max(1, Math.min(Number(req.body.limit || 100), 500));
  const result = backfillAudioArtifactIntegrity(receiverId, limit);
  res.json({
    ok: true,
    receiverId,
    limit,
    updatedCount: result.updated.length,
    missingCount: result.missing.length,
    updated: result.updated,
    missing: result.missing,
    review: receiverId ? audioReviewFor(receiverId) : null,
  });
});

app.post("/audio/timeline/backfill", (req, res) => {
  const receiverId = req.body.receiverId ? normalizeReceiverId(req.body.receiverId) : "";
  const limit = Math.max(1, Math.min(Number(req.body.limit || 200), 500));
  const events = backfillAudioTimeline(receiverId, limit);
  res.json({
    ok: true,
    receiverId,
    limit,
    eventCount: events.length,
    events,
    review: receiverId ? audioReviewFor(receiverId) : null,
  });
});

app.post("/audio/events/backfill-artifact-links", (req, res) => {
  const receiverId = req.body.receiverId ? normalizeReceiverId(req.body.receiverId) : "";
  const limit = Math.max(1, Math.min(Number(req.body.limit || 200), 500));
  const updated = backfillAudioEventArtifactLinks(receiverId, limit);
  res.json({
    ok: true,
    receiverId,
    limit,
    updatedCount: updated.length,
    updated,
    review: receiverId ? audioReviewFor(receiverId) : null,
  });
});

app.post("/audio/artifacts/:artifactId/transcribe", async (req, res) => {
  const artifactId = String(req.params.artifactId || "").trim();
  const receiverId = req.body.receiverId ? normalizeReceiverId(req.body.receiverId) : "";
  const artifact = audioArtifacts.find((entry) => entry.id === artifactId);
  if (!artifact) {
    res.status(404).json({ ok: false, error: "Audio artifact not found" });
    return;
  }
  if (receiverId && artifact.receiverId !== receiverId) {
    res.status(404).json({ ok: false, error: "Audio artifact not found for receiver" });
    return;
  }
  const audioPath = audioFilePathForUrl(artifact.audioUrl);
  if (!audioPath || !fs.existsSync(audioPath)) {
    artifact.transcriptStatus = "missing_audio";
    artifact.transcriptionRetriedAt = new Date().toISOString();
    saveAudioState();
    res.status(404).json({
      ok: false,
      artifact,
      error: "Original audio file is missing",
    });
    return;
  }

  const transcription = await transcribeAudioFile(audioPath, artifact.audioMimeType);
  applyArtifactTranscription(artifact, transcription);
  addEvent(artifact.receiverId, "audio.transcription_retried", {
    artifactId: artifact.id,
    messageId: artifact.messageId,
    transcriptStatus: artifact.transcriptStatus,
  });
  recordAudioTimelineEvent({
    receiverId: artifact.receiverId,
    type: "audio.transcription_retried",
    artifactId: artifact.id,
    messageId: artifact.messageId,
    audioUrl: artifact.audioUrl,
    summary: "Transcript retry completed",
    detail: { transcriptStatus: artifact.transcriptStatus },
  });
  res.json({
    ok: true,
    artifact,
    transcript: artifact.transcript,
    transcriptStatus: artifact.transcriptStatus,
  });
});

app.post("/audio/artifacts/transcribe-pending", async (req, res) => {
  const receiverId = req.body.receiverId ? normalizeReceiverId(req.body.receiverId) : "";
  const limit = Math.max(1, Math.min(Number(req.body.limit || 10), 25));
  const candidates = audioArtifacts
    .filter(artifact => (!receiverId || artifact.receiverId === receiverId) && canRetryArtifactTranscription(artifact))
    .slice(0, limit);
  const results = [];

  for (const artifact of candidates) {
    const audioPath = audioFilePathForUrl(artifact.audioUrl);
    if (!audioPath || !fs.existsSync(audioPath)) {
      artifact.transcriptStatus = "missing_audio";
      artifact.transcriptionRetriedAt = new Date().toISOString();
      saveAudioState();
      results.push({ artifact, ok: false, error: "Original audio file is missing" });
      continue;
    }
    const transcription = await transcribeAudioFile(audioPath, artifact.audioMimeType);
    applyArtifactTranscription(artifact, transcription);
    addEvent(artifact.receiverId, "audio.transcription_retried", {
      artifactId: artifact.id,
      messageId: artifact.messageId,
      transcriptStatus: artifact.transcriptStatus,
    });
    recordAudioTimelineEvent({
      receiverId: artifact.receiverId,
      type: "audio.transcription_retried",
      artifactId: artifact.id,
      messageId: artifact.messageId,
      audioUrl: artifact.audioUrl,
      summary: "Transcript retry completed",
      detail: { transcriptStatus: artifact.transcriptStatus },
    });
    results.push({
      artifact,
      ok: artifact.transcriptStatus === "completed",
      transcriptStatus: artifact.transcriptStatus,
    });
  }

  res.json({
    ok: true,
    limit,
    receiverId,
    attempted: results.length,
    completed: results.filter(result => result.transcriptStatus === "completed").length,
    results,
    review: receiverId ? audioReviewFor(receiverId) : null,
  });
});

app.post("/audio/hearing-feedback", (req, res) => {
  const receiverId = normalizeReceiverId(req.body.receiverId);
  const linkedArtifact = audioArtifactForEventLink({
    receiverId,
    artifactId: req.body.artifactId,
    audioUrl: req.body.audioUrl,
    messageId: req.body.messageId,
  });
  const artifactFields = linkedArtifact
    ? audioArtifactEventFields(linkedArtifact)
    : explicitAudioArtifactEventFields(req.body);
  const event = {
    id: String(req.body.id || `hearing-feedback-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    createdAt: String(req.body.createdAt || new Date().toISOString()),
    receiverId,
    ...artifactFields,
    careVipName: String(req.body.careVipName || "Mom"),
    messageId: String(req.body.messageId || ""),
    messageFrom: String(req.body.messageFrom || ""),
    messageSource: String(req.body.messageSource || ""),
    audioUrl: String(req.body.audioUrl || ""),
    improved: Boolean(req.body.improved),
    enhancement: req.body.enhancement && typeof req.body.enhancement === "object" ? req.body.enhancement : {},
    audioEnhancementProfile:
      req.body.audioEnhancementProfile && typeof req.body.audioEnhancementProfile === "object"
        ? req.body.audioEnhancementProfile
        : null,
  };
  hearingFeedbackEvents.push(event);
  if (hearingFeedbackEvents.length > audioStateCollectionLimits.hearingFeedbackEvents) {
    hearingFeedbackEvents.shift();
  }
  recordAudioTimelineEvent({
    receiverId,
    type: "audio.hearing_feedback",
    artifactId: event.artifactId,
    messageId: event.messageId,
    audioUrl: event.audioUrl,
    summary: event.improved ? "Enhanced playback helped" : "Enhanced playback did not help",
    detail: {
      artifactKind: event.artifactKind,
      audioDirection: event.audioDirection,
      improved: event.improved,
      messageFrom: event.messageFrom,
      messageSource: event.messageSource,
    },
  });
  saveAudioState();
  res.json({ ok: true, event, profile: hearingProfileFor(receiverId) });
});

app.post("/audio/enhancement-events", (req, res) => {
  const receiverId = normalizeReceiverId(req.body.receiverId);
  const linkedArtifact = audioArtifactForEventLink({
    receiverId,
    artifactId: req.body.artifactId,
    audioUrl: req.body.audioUrl,
  });
  const artifactFields = linkedArtifact
    ? audioArtifactEventFields(linkedArtifact)
    : explicitAudioArtifactEventFields(req.body);
  const event = {
    id: String(req.body.id || `audio-enhancement-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    createdAt: String(req.body.createdAt || new Date().toISOString()),
    receiverId,
    ...artifactFields,
    surface: String(req.body.surface || req.body.source || "unknown"),
    source: String(req.body.source || "browser_playback"),
    audioUrl: String(req.body.audioUrl || ""),
    durationMs: Number(req.body.durationMs || 0),
    cached: Boolean(req.body.cached),
    enhancement: req.body.enhancement && typeof req.body.enhancement === "object" ? req.body.enhancement : {},
    audioEnhancementProfile:
      req.body.profile && typeof req.body.profile === "object"
        ? req.body.profile
        : req.body.audioEnhancementProfile && typeof req.body.audioEnhancementProfile === "object"
          ? req.body.audioEnhancementProfile
          : null,
  };
  audioEnhancementEvents.push(event);
  if (audioEnhancementEvents.length > audioStateCollectionLimits.audioEnhancementEvents) {
    audioEnhancementEvents.shift();
  }
  recordAudioTimelineEvent({
    receiverId,
    type: "audio.enhanced_playback",
    artifactId: event.artifactId,
    audioUrl: event.audioUrl,
    summary: "Enhanced playback profile applied",
    detail: {
      artifactKind: event.artifactKind,
      audioDirection: event.audioDirection,
      surface: event.surface,
      source: event.source,
      cached: event.cached,
      durationMs: event.durationMs,
      reasons: event.audioEnhancementProfile?.reasons || [],
    },
  });
  saveAudioState();
  res.json({ ok: true, event, profile: hearingProfileFor(receiverId) });
});

app.get("/audio/enhancement-events", (req, res) => {
  const receiverId = req.query.receiverId ? normalizeReceiverId(req.query.receiverId) : "";
  const events = receiverId
    ? audioEnhancementEvents.filter(event => event.receiverId === receiverId)
    : audioEnhancementEvents;
  res.json({ ok: true, events: events.slice().reverse() });
});

app.get("/audio/domain-model", (req, res) => {
  res.json({
    ok: true,
    audioDomainModel,
  });
});

app.get("/audio/domain-catalogs", (req, res) => {
  res.json({
    ok: true,
    ...audioDomainCatalogSnapshot(),
    endpoints: audioDomainCatalogEndpoints(),
  });
});

app.get("/audio/state-metadata", (req, res) => {
  res.json({
    ok: true,
    audioDomainModel,
    state: audioStateMetadataFor(),
  });
});

app.get("/audio/migration-readiness", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId);
  res.json({
    ok: true,
    readiness: audioMigrationReadinessFor(receiverId),
  });
});

app.get("/audio/capabilities", (req, res) => {
  const capabilities = audioCapabilitiesFor();
  res.json({
    ok: true,
    audioDomainModel,
    runtime: capabilities.runtime,
    capabilities: capabilities.items,
  });
});

app.get("/audio/readiness-catalog", (req, res) => {
  res.json({
    ok: true,
    audioDomainModel,
    statuses: audioReadinessStatusCatalog,
    catalog: audioReadinessCatalog,
    items: audioCatalogItems(audioReadinessCatalog, "code"),
  });
});

app.get("/audio/event-catalog", (req, res) => {
  res.json({
    ok: true,
    audioDomainModel,
    catalog: audioEventCatalog,
    items: audioEventCatalogItems(),
  });
});

app.get("/audio/artifact-catalog", (req, res) => {
  res.json({
    ok: true,
    audioDomainModel,
    artifactKinds: audioCatalogItems(audioArtifactKindCatalog, "kind"),
    audioDirections: audioCatalogItems(audioDirectionCatalog, "direction"),
  });
});

app.get("/audio/hearing-profile", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId);
  res.json({ ok: true, profile: hearingProfileFor(receiverId) });
});

app.get("/audio/storage-health", (req, res) => {
  const receiverId = req.query.receiverId ? normalizeReceiverId(req.query.receiverId) : "";
  res.json({ ok: true, health: audioStorageHealthFor(receiverId) });
});

app.get("/audio/maintenance-preview", (req, res) => {
  const receiverId = req.query.receiverId ? normalizeReceiverId(req.query.receiverId) : "";
  res.json({ ok: true, preview: audioMaintenancePreviewFor(receiverId) });
});

app.get("/audio/maintenance-catalog", (req, res) => {
  res.json({
    ok: true,
    audioDomainModel,
    actions: audioCatalogItems(audioMaintenanceActionCatalog, "action"),
  });
});

app.get("/audio/artifacts/:artifactId/detail", (req, res) => {
  const receiverId = req.query.receiverId ? normalizeReceiverId(req.query.receiverId) : "";
  const artifactId = String(req.params.artifactId || "").trim();
  const detail = audioArtifactDetailFor(artifactId, receiverId);
  if (!detail) {
    res.status(404).json({ ok: false, error: "Audio artifact not found" });
    return;
  }
  res.json({ ok: true, detail });
});

app.get("/audio/manifest", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId);
  res.json({ ok: true, manifest: audioManifestFor(receiverId) });
});

app.get("/audio/export-manifest", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId);
  res.json({ ok: true, exportManifest: audioExportManifestFor(receiverId) });
});

app.get("/audio/export-index", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId);
  res.json({ ok: true, exportIndex: audioExportIndexFor(receiverId) });
});

app.get("/audio/media-manifest", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId);
  res.json({ ok: true, mediaManifest: audioMediaManifestFor(receiverId) });
});

app.get("/audio/transcript-manifest", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId);
  res.json({ ok: true, transcriptManifest: audioTranscriptManifestFor(receiverId) });
});

app.get("/audio/hearing-profile-manifest", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId);
  res.json({ ok: true, hearingProfileManifest: audioHearingProfileManifestFor(receiverId) });
});

app.get("/audio/timeline", (req, res) => {
  const receiverId = req.query.receiverId ? normalizeReceiverId(req.query.receiverId) : "";
  res.json({ ok: true, timeline: audioTimelineFor(receiverId) });
});

app.get("/audio/review", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId);
  res.json({ ok: true, review: audioReviewFor(receiverId) });
});

app.get("/audio/review-bundle", (req, res) => {
  const receiverId = normalizeReceiverId(req.query.receiverId);
  const bundle = audioReviewBundleFor(receiverId);
  if (req.query.download === "1" || req.query.download === "true") {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="connect-audio-review-${receiverId}-${timestamp}.json"`
    );
    res.send(JSON.stringify({ ok: true, bundle }, null, 2));
    return;
  }
  res.json({ ok: true, bundle });
});

app.get("/sms/participant/messages", (req, res) => {
  res.json({
    ok: true,
    messages: smsParticipantService.listSmsParticipantMessages(),
    pendingConfirmations: smsParticipantService.listPendingConfirmations(),
  });
});

app.post("/sms/participant/inbound", (req, res) => {
  // TODO: replace this local test endpoint with the SMS provider webhook.
  const result = smsParticipantService.inboundSms(req.body.fromPhone, req.body.body);
  if (result.action === "sent" && result.message) {
    routeSentSmsParticipantMessage(result.message);
  }
  res.json(result);
});

function routeSentSmsParticipantMessage(smsMessage) {
  if (smsMessage.toType === "receiver_user") {
    const message = {
      id: `message-${nextMessageId++}`,
      clientMessageId: smsMessage.id,
      receiverId: "living-room-receiver",
      careCircleId: smsMessage.careCircleId,
      from: smsMessage.fromDisplayName,
      fromParticipantId: smsMessage.fromParticipantId,
      to: smsMessage.toDisplayName,
      toType: smsMessage.toType,
      toId: smsMessage.toId,
      body: smsMessage.body,
      messageType: "text",
      audioUrl: "",
      audioDurationMs: 0,
      transcript: "",
      transcriptStatus: "not_requested",
      heardAt: null,
      readAt: null,
      searchableText: [smsMessage.body, smsMessage.fromDisplayName, smsMessage.toDisplayName].filter(Boolean).join(" "),
      createdAt: new Date().toISOString(),
      source: "sms_participant",
      smsParticipantMessageId: smsMessage.id,
    };
    messages.push(message);
    saveAudioState();
    addEvent("living-room-receiver", "message.created", {
      messageId: message.id,
      messageType: message.messageType,
      from: message.from,
      source: message.source,
    });
    return message;
  }

  if (smsMessage.toType === "coordinator") {
    addEvent("coordinator-andrew", "message.created", {
      messageId: smsMessage.id,
      messageType: "text",
      from: smsMessage.fromDisplayName,
      source: "sms_participant",
      body: smsMessage.body,
    });
  }

  return null;
}

app.get("/debug", (req, res) => {
  res.json({
    ok: true,
    nextEventId,
    activeReceivers: [...activeReceivers],
    calls: [...calls.values()],
    messages,
    audioArtifacts,
    audioTimelineEvents,
    hearingFeedbackEvents,
    audioEnhancementEvents,
    transcriptionConfigured: Boolean(process.env.OPENAI_API_KEY),
    transcriptionModel: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    receiverEventCounts: Object.fromEntries([...eventsByReceiver.entries()].map(([id, events]) => [id, events.length])),
    careCircles: careCircleService.allCareCircles(),
    careCircleMembers: careCircleService.getMembers("care-circle-mom"),
    receiverDevices: careCircleService.getReceiverDevices("care-circle-mom"),
    receiverHouseholds: careCircleService.getReceiverHouseholds("care-circle-mom"),
    receiverPeople: careCircleService.getReceiverPeople("care-circle-mom"),
    escalationPolicies: careCircleService.getEscalationPolicies("care-circle-mom"),
    participantConnections: careCircleService.getConnections("care-circle-mom"),
    smsParticipantMessages: smsParticipantService.listSmsParticipantMessages(),
    smsPendingConfirmations: smsParticipantService.listPendingConfirmations(),
  });
});

function hearingProfileFor(receiverId) {
  const events = hearingFeedbackEvents
    .filter(event => event.receiverId === receiverId)
    .slice()
    .reverse();
  const enhancementEvents = audioEnhancementEvents
    .filter(event => event.receiverId === receiverId)
    .slice()
    .reverse();
  const helpedEvents = events.filter(event => event.improved);
  const profiles = [
    ...events.map(event => event.audioEnhancementProfile),
    ...enhancementEvents.map(event => event.audioEnhancementProfile),
  ].filter(Boolean);
  const average = (values) => {
    const numeric = values.map(Number).filter(Number.isFinite);
    if (!numeric.length) return null;
    return Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(3));
  };
  const reasonCounts = {};
  profiles.forEach(profile => {
    (profile.reasons || []).forEach(reason => {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
  });
  const averageProfile = {
    playbackGain: average([
      ...events.map(event => event.enhancement?.playbackGain),
      ...enhancementEvents.map(event => event.enhancement?.playbackGain),
    ]),
    gainMultiplier: average(profiles.map(profile => profile.gainMultiplier)),
    highPassHz: average(profiles.map(profile => profile.highPassHz)),
    lowMidGainDb: average(profiles.map(profile => profile.lowMidGainDb)),
    presenceGainDb: average(profiles.map(profile => profile.presenceGainDb)),
    compressorRatio: average(profiles.map(profile => profile.compressor?.ratio)),
    compressorThresholdDb: average(profiles.map(profile => profile.compressor?.thresholdDb)),
    rms: average(profiles.map(profile => profile.metrics?.rms)),
    peak: average(profiles.map(profile => profile.metrics?.peak)),
    noiseRatio: average(profiles.map(profile => profile.metrics?.noiseRatio)),
    clippingRatio: average(profiles.map(profile => profile.metrics?.clippingRatio)),
    dynamicRange: average(profiles.map(profile => profile.metrics?.dynamicRange)),
  };
  return {
    receiverId,
    careVipName: events[0]?.careVipName || "Mom",
    summary: {
      total: events.length,
      enhancementEvents: enhancementEvents.length,
      helped: helpedEvents.length,
      didNotHelp: events.length - helpedEvents.length,
      helpedRate: events.length ? Number((helpedEvents.length / events.length).toFixed(3)) : null,
      lastUpdatedAt: events[0]?.createdAt || enhancementEvents[0]?.createdAt || "",
      commonReasons: Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count]) => ({ reason, count })),
      averageProfile,
      sourceSummaries: audioProfileSourceSummaries(events, enhancementEvents),
    },
    events,
    enhancementEvents,
  };
}

function audioProfileSourceSummaries(events = [], enhancementEvents = []) {
  const groups = new Map();
  const ensureGroup = (key, label, sourceType) => {
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        sourceType,
        feedbackEvents: 0,
        enhancementEvents: 0,
        helped: 0,
        didNotHelp: 0,
        artifactIds: new Set(),
        reasonCounts: {},
        lastUpdatedAt: "",
      });
    }
    return groups.get(key);
  };
  const touch = (group, event) => {
    if (event.artifactId) group.artifactIds.add(event.artifactId);
    if (event.createdAt && (!group.lastUpdatedAt || new Date(event.createdAt) > new Date(group.lastUpdatedAt))) {
      group.lastUpdatedAt = event.createdAt;
    }
    (event.audioEnhancementProfile?.reasons || []).forEach((reason) => {
      group.reasonCounts[reason] = (group.reasonCounts[reason] || 0) + 1;
    });
  };
  events.forEach((event) => {
    const label = event.messageFrom || event.messageSource || "Unknown speaker";
    const group = ensureGroup(`feedback:${label.toLowerCase()}`, label, "hearing_feedback");
    group.feedbackEvents += 1;
    if (event.improved) group.helped += 1;
    else group.didNotHelp += 1;
    touch(group, event);
  });
  enhancementEvents.forEach((event) => {
    const label = event.surface || event.source || event.artifactKind || "Playback";
    const group = ensureGroup(`enhancement:${label.toLowerCase()}`, label, "enhancement");
    group.enhancementEvents += 1;
    touch(group, event);
  });
  return [...groups.values()]
    .map((group) => ({
      key: group.key,
      label: group.label,
      sourceType: group.sourceType,
      feedbackEvents: group.feedbackEvents,
      enhancementEvents: group.enhancementEvents,
      helped: group.helped,
      didNotHelp: group.didNotHelp,
      helpedRate: group.feedbackEvents ? Number((group.helped / group.feedbackEvents).toFixed(3)) : null,
      artifactIds: [...group.artifactIds].slice(0, 10),
      commonReasons: Object.entries(group.reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count })),
      lastUpdatedAt: group.lastUpdatedAt,
    }))
    .sort((a, b) => {
      const countDiff = (b.feedbackEvents + b.enhancementEvents) - (a.feedbackEvents + a.enhancementEvents);
      if (countDiff) return countDiff;
      return new Date(b.lastUpdatedAt || 0) - new Date(a.lastUpdatedAt || 0);
    });
}

function audioHearingProfileManifestFor(receiverId) {
  const profile = hearingProfileFor(receiverId);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    receiverId,
    audioDomainModel,
    audioStateMetadata: audioStateMetadataFor(),
    summary: profile.summary,
    sourceSummaries: profile.summary?.sourceSummaries || [],
    integrity: {
      algorithm: "sha256",
      profileSummaryHash: stableJsonHash(withoutGeneratedFields(profile.summary || {})),
      feedbackEventsHash: stableJsonHash(withoutGeneratedFields(profile.events || [])),
      enhancementEventsHash: stableJsonHash(withoutGeneratedFields(profile.enhancementEvents || [])),
    },
    feedbackEvents: profile.events || [],
    enhancementEvents: profile.enhancementEvents || [],
  };
}

function audioReviewFor(receiverId) {
  const artifacts = audioArtifacts
    .filter(artifact => artifact.receiverId === receiverId)
    .slice()
    .reverse();
  const profile = hearingProfileFor(receiverId);
  const duplicateGroups = audioDuplicateGroups(artifacts);
  const duplicateByHash = new Map();
  duplicateGroups.forEach((group) => {
    group.artifactIds.forEach((artifactId) => {
      duplicateByHash.set(artifactId, {
        duplicateCount: group.count,
        duplicateGroupHash: group.sha256,
        duplicateArtifactIds: group.artifactIds.filter(id => id !== artifactId),
      });
    });
  });
  const linkedArtifacts = artifacts.map(artifact => {
    const message = messageForAudioArtifact(artifact);
    const enhancements = audioEnhancementEvents
      .filter(event => event.receiverId === receiverId && normalizeAudioUrl(event.audioUrl) === normalizeAudioUrl(artifact.audioUrl))
      .slice()
      .reverse();
    const feedback = hearingFeedbackEvents
      .filter(event => event.receiverId === receiverId && normalizeAudioUrl(event.audioUrl) === normalizeAudioUrl(artifact.audioUrl))
      .slice()
      .reverse();
    return {
      ...artifact,
      duplicateInfo: duplicateByHash.get(artifact.id) || null,
      relatedMessage: message ? publicAudioReviewMessage(message) : null,
      relatedActivity: {
        enhancements,
        feedback,
        enhancementCount: enhancements.length,
        feedbackCount: feedback.length,
      },
    };
  });
  const storageHealth = audioStorageHealthFor(receiverId);
  const eventLinkHealth = audioEventLinkHealthFor(receiverId);
  const captureHealth = audioCaptureHealthFor(receiverId, linkedArtifacts);
  const transcriptionHealth = audioTranscriptionHealthFor(receiverId, linkedArtifacts);
  const timelineSummary = audioTimelineSummaryFor(receiverId, linkedArtifacts);
  return {
    audioDomainModel,
    receiverId,
    summary: audioReviewSummary(linkedArtifacts, profile),
    reviewReadiness: audioReviewReadinessFor({
      captureHealth,
      eventLinkHealth,
      storageHealth,
      timelineSummary,
      transcriptionHealth,
    }),
    storageHealth,
    eventLinkHealth,
    captureHealth,
    transcriptionHealth,
    maintenancePreview: audioMaintenancePreviewFor(receiverId),
    timelineSummary,
    duplicateGroups,
    artifacts: linkedArtifacts,
    profile,
  };
}

function audioReviewReadinessFor({
  captureHealth,
  eventLinkHealth,
  storageHealth,
  timelineSummary,
  transcriptionHealth,
}) {
  const blockers = [];
  const maintenance = [];
  const notes = [];
  if (storageHealth?.missingOriginals) blockers.push("missing_originals");
  if (storageHealth?.unhashedArtifacts) maintenance.push("unhashed_artifacts");
  if (storageHealth?.recoverableUploads) maintenance.push("recoverable_uploads");
  if (transcriptionHealth?.status === "transcription_not_configured") blockers.push("transcription_not_configured");
  if (transcriptionHealth?.retryable) maintenance.push("retryable_transcripts");
  if (eventLinkHealth?.resolvableUnlinkedCount) maintenance.push("backfillable_event_links");
  if (eventLinkHealth?.unresolvedCount) notes.push("unresolved_event_links");
  if (captureHealth?.missingCaptureContext) notes.push("legacy_capture_context");
  if (!timelineSummary?.eventCount) maintenance.push("timeline_not_backfilled");
  const status = blockers.length
    ? "blocked"
    : maintenance.length
      ? "needs_maintenance"
      : notes.length
        ? "reviewable_with_legacy_notes"
        : "ready";
  return {
    status,
    blockers,
    maintenance,
    notes,
    items: [
      ...blockers.map(code => audioReadinessItem(code, "blocker")),
      ...maintenance.map(code => audioReadinessItem(code, "maintenance")),
      ...notes.map(code => audioReadinessItem(code, "note")),
    ],
  };
}

function audioCapabilitiesFor() {
  const transcriptionConfigured = Boolean(process.env.OPENAI_API_KEY);
  const runtime = {
    transcriptionConfigured,
    transcriptionModel: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    storageMode: "local_uploads",
    enhancementMode: "browser_playback",
    reviewMode: "local_admin",
  };
  return {
    runtime,
    items: Object.entries(audioCapabilityCatalog).map(([id, capability]) => ({
      id,
      ...capability,
      status: audioCapabilityStatus(id, runtime),
    })),
  };
}

function audioDomainCatalogEndpoints() {
  return {
    domainModel: "/audio/domain-model",
    domainCatalogs: "/audio/domain-catalogs",
    stateMetadata: "/audio/state-metadata",
    migrationReadiness: "/audio/migration-readiness",
    exportIndex: "/audio/export-index",
    exportManifest: "/audio/export-manifest",
    mediaManifest: "/audio/media-manifest",
    transcriptManifest: "/audio/transcript-manifest",
    hearingProfileManifest: "/audio/hearing-profile-manifest",
    capabilities: "/audio/capabilities",
    readinessCatalog: "/audio/readiness-catalog",
    eventCatalog: "/audio/event-catalog",
    artifactCatalog: "/audio/artifact-catalog",
    maintenanceCatalog: "/audio/maintenance-catalog",
  };
}

function audioMigrationReadinessFor(receiverId) {
  const review = audioReviewFor(receiverId);
  const state = audioStateMetadataFor();
  const populatedCollections = state.collections.filter(collection => collection.count > 0);
  const emptyCollections = state.collections.filter(collection => collection.count === 0);
  const blockers = [];
  const maintenance = [];
  const notes = [];

  if (state.migrationNeeded) {
    maintenance.push("audio_state_schema_outdated");
  }
  if (review.reviewReadiness?.blockers?.length) {
    blockers.push(...review.reviewReadiness.blockers);
  }
  if (review.reviewReadiness?.maintenance?.length) {
    maintenance.push(...review.reviewReadiness.maintenance);
  }
  if (review.reviewReadiness?.notes?.length) {
    notes.push(...review.reviewReadiness.notes);
  }
  if (!populatedCollections.length) {
    notes.push("audio_state_empty");
  }

  const status = blockers.length
    ? "blocked"
    : maintenance.length
      ? "needs_maintenance"
      : "ready";

  return {
    status,
    receiverId,
    generatedAt: new Date().toISOString(),
    audioDomainModel,
    state,
    reviewReadiness: review.reviewReadiness,
    blockers: [...new Set(blockers)],
    maintenance: [...new Set(maintenance)],
    notes: [...new Set(notes)],
    populatedCollections,
    emptyCollections,
    exportEndpoints: {
      reviewBundle: `/audio/review-bundle?receiverId=${encodeURIComponent(receiverId)}`,
      reviewBundleDownload: `/audio/review-bundle?receiverId=${encodeURIComponent(receiverId)}&download=1`,
      manifest: `/audio/manifest?receiverId=${encodeURIComponent(receiverId)}`,
      stateMetadata: "/audio/state-metadata",
      domainCatalogs: "/audio/domain-catalogs",
    },
  };
}

function audioStateMetadataFor() {
  const collections = audioStateCollectionsFor();
  return {
    ...audioStateMetadata,
    currentSchemaVersion: audioStateSchemaVersion,
    currentAudioDomain: audioDomainModel.domain,
    currentAudioDomainVersion: audioDomainModel.version,
    artifactCount: audioArtifacts.length,
    timelineEventCount: audioTimelineEvents.length,
    hearingFeedbackEventCount: hearingFeedbackEvents.length,
    enhancementEventCount: audioEnhancementEvents.length,
    messageCount: messages.length,
    collections,
    migrationNeeded:
      Number(audioStateMetadata.version || 0) < audioStateSchemaVersion ||
      Number(audioStateMetadata.audioDomainVersion || 0) < Number(audioDomainModel.version || 0),
  };
}

function audioStateCollectionsFor() {
  return [
    audioStateCollection("messages", {
      count: messages.length,
      description: "Coordinator and receiver text/audio messages plus heard/read delivery state.",
    }),
    audioStateCollection("audioArtifacts", {
      count: audioArtifacts.length,
      description: "Preserved original audio files and their product-neutral classification, transcript, integrity, and linkage metadata.",
    }),
    audioStateCollection("audioTimelineEvents", {
      count: audioTimelineEvents.length,
      description: "Chronological audio-domain events for preserved artifacts, transcript retries, playback, and feedback.",
    }),
    audioStateCollection("hearingFeedbackEvents", {
      count: hearingFeedbackEvents.length,
      description: "Receiver yes/no feedback about whether adjusted playback was easier to hear.",
    }),
    audioStateCollection("audioEnhancementEvents", {
      count: audioEnhancementEvents.length,
      description: "Automatic playback enhancement profiles and clarity settings applied by receiver/browser playback.",
    }),
  ];
}

function audioStateCollection(name, input = {}) {
  return {
    name,
    count: input.count || 0,
    retentionLimit: audioStateCollectionLimits[name] || 0,
    persisted: true,
    description: input.description || "",
  };
}

function audioCapabilityStatus(id, runtime) {
  if (id === "transcription") {
    return runtime.transcriptionConfigured ? "available" : "not_configured";
  }
  return "available";
}

function audioTranscriptionHealthFor(receiverId, artifacts = []) {
  const statusCounts = {};
  let transcribed = 0;
  let needsTranscript = 0;
  artifacts.forEach((artifact) => {
    const status = artifact.transcriptStatus || "not_requested";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    const hasTranscript = Boolean(String(artifact.transcript || "").trim()) || status === "completed";
    if (hasTranscript) transcribed += 1;
    else needsTranscript += 1;
  });
  const retryable = artifacts.filter(canRetryArtifactTranscription).length;
  return {
    receiverId,
    artifactCount: artifacts.length,
    transcriptionConfigured: Boolean(process.env.OPENAI_API_KEY),
    transcriptionModel: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    transcribed,
    needsTranscript,
    retryable,
    statusCounts,
    status:
      needsTranscript === 0
        ? "ok"
        : process.env.OPENAI_API_KEY
          ? "needs_transcription"
          : "transcription_not_configured",
  };
}

function audioCaptureHealthFor(receiverId, artifacts = []) {
  const surfaceCounts = {};
  const platformCounts = {};
  let withCaptureContext = 0;
  artifacts.forEach((artifact) => {
    const context = artifact.captureContext || {};
    if (context.captureSurface || context.clientPlatform || context.clientUserAgent) {
      withCaptureContext += 1;
    }
    const surface = context.captureSurface || "unknown";
    surfaceCounts[surface] = (surfaceCounts[surface] || 0) + 1;
    const platform = context.clientPlatform || "unknown";
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;
  });
  const missingCaptureContext = Math.max(artifacts.length - withCaptureContext, 0);
  return {
    receiverId,
    artifactCount: artifacts.length,
    withCaptureContext,
    missingCaptureContext,
    surfaceCounts,
    platformCounts,
    status: missingCaptureContext ? "legacy_context_missing" : "ok",
  };
}

function audioManifestFor(receiverId) {
  const review = audioReviewFor(receiverId);
  return {
    version: 1,
    audioDomainModel,
    audioStateMetadata: audioStateMetadataFor(),
    audioCapabilities: audioCapabilitiesFor(),
    audioEventCatalog: audioEventCatalogItems(),
    audioArtifactCatalog: {
      artifactKinds: audioCatalogItems(audioArtifactKindCatalog, "kind"),
      audioDirections: audioCatalogItems(audioDirectionCatalog, "direction"),
    },
    audioMaintenanceActionCatalog: audioCatalogItems(audioMaintenanceActionCatalog, "action"),
    generatedAt: new Date().toISOString(),
    receiverId,
    reviewReadiness: review.reviewReadiness,
    storageHealth: review.storageHealth,
    eventLinkHealth: review.eventLinkHealth,
    captureHealth: review.captureHealth,
    transcriptionHealth: review.transcriptionHealth,
    summary: review.summary,
    duplicateGroups: review.duplicateGroups,
    timeline: audioTimelineFor(receiverId),
    artifacts: review.artifacts.map((artifact) => ({
      id: artifact.id,
      createdAt: artifact.createdAt,
      source: artifact.source,
      artifactKind: artifact.artifactKind || "",
      audioDirection: artifact.audioDirection || "",
      originalPreserved: artifact.originalPreserved,
      audioUrl: artifact.audioUrl,
      audioMimeType: artifact.audioMimeType,
      audioByteSize: artifact.audioByteSize || 0,
      audioSha256: artifact.audioSha256 || "",
      audioDurationMs: artifact.audioDurationMs || 0,
      captureContext: artifact.captureContext || {},
      transcriptStatus: artifact.transcriptStatus,
      transcriptionRetriedAt: artifact.transcriptionRetriedAt || "",
      messageId: artifact.messageId || "",
      clientMessageId: artifact.clientMessageId || "",
      clientAudioCaptureId: artifact.clientAudioCaptureId || "",
      askInteractionId: artifact.askInteractionId || "",
      from: artifact.from || "",
      to: artifact.to || "",
      duplicateInfo: artifact.duplicateInfo,
      relatedMessage: artifact.relatedMessage,
    })),
  };
}

function audioExportManifestFor(receiverId) {
  const review = audioReviewFor(receiverId);
  const manifest = audioManifestFor(receiverId);
  const artifactIndex = audioArtifactIndexForReview(review, receiverId);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    receiverId,
    audioDomainModel,
    audioStateMetadata: audioStateMetadataFor(),
    migrationReadiness: audioMigrationReadinessFor(receiverId),
    bundleIntegrity: audioBundleIntegrityFor({ artifactIndex, manifest, receiverId, review }),
    reviewReadiness: review.reviewReadiness,
    summary: {
      artifactCount: artifactIndex.length,
      duplicateGroupCount: review.duplicateGroups?.length || 0,
      indexedBytes: review.storageHealth?.indexedBytes || 0,
      timelineEventCount: review.timelineSummary?.eventCount || 0,
      enhancementEventCount: review.profile?.summary?.enhancementEvents || 0,
      hearingFeedbackEventCount: review.profile?.summary?.feedbackEvents || 0,
    },
    exportSurfaces: [
      audioExportSurface("export_index", "Export index", `/audio/export-index?receiverId=${encodeURIComponent(receiverId)}`),
      audioExportSurface("review_bundle", "Review bundle", `/audio/review-bundle?receiverId=${encodeURIComponent(receiverId)}`),
      audioExportSurface("review_bundle_download", "Downloadable review bundle", `/audio/review-bundle?receiverId=${encodeURIComponent(receiverId)}&download=1`),
      audioExportSurface("manifest", "Full audio manifest", `/audio/manifest?receiverId=${encodeURIComponent(receiverId)}`),
      audioExportSurface("media_manifest", "Original media manifest", `/audio/media-manifest?receiverId=${encodeURIComponent(receiverId)}`),
      audioExportSurface("transcript_manifest", "Transcript manifest", `/audio/transcript-manifest?receiverId=${encodeURIComponent(receiverId)}`),
      audioExportSurface("hearing_profile_manifest", "Hearing profile manifest", `/audio/hearing-profile-manifest?receiverId=${encodeURIComponent(receiverId)}`),
      audioExportSurface("timeline", "Audio timeline", `/audio/timeline?receiverId=${encodeURIComponent(receiverId)}`),
      audioExportSurface("domain_catalogs", "Domain catalogs", "/audio/domain-catalogs"),
      audioExportSurface("state_metadata", "State metadata", "/audio/state-metadata"),
    ],
  };
}

function audioExportSurface(id, label, path) {
  return { id, label, path };
}

function audioExportIndexFor(receiverId) {
  const review = audioReviewFor(receiverId);
  const entries = [
    audioExportIndexEntry("domain_catalogs", "Domain catalogs", "/audio/domain-catalogs", audioDomainCatalogSnapshot()),
    audioExportIndexEntry("state_metadata", "State metadata", "/audio/state-metadata", audioStateMetadataFor()),
    audioExportIndexEntry("migration_readiness", "Migration readiness", `/audio/migration-readiness?receiverId=${encodeURIComponent(receiverId)}`, audioMigrationReadinessFor(receiverId)),
    audioExportIndexEntry("export_manifest", "Export manifest", `/audio/export-manifest?receiverId=${encodeURIComponent(receiverId)}`, audioExportManifestFor(receiverId)),
    audioExportIndexEntry("review_bundle", "Review bundle", `/audio/review-bundle?receiverId=${encodeURIComponent(receiverId)}`, audioReviewBundleFor(receiverId)),
    audioExportIndexEntry("review_bundle_download", "Downloadable review bundle", `/audio/review-bundle?receiverId=${encodeURIComponent(receiverId)}&download=1`, null),
    audioExportIndexEntry("manifest", "Full audio manifest", `/audio/manifest?receiverId=${encodeURIComponent(receiverId)}`, audioManifestFor(receiverId)),
    audioExportIndexEntry("media_manifest", "Original media manifest", `/audio/media-manifest?receiverId=${encodeURIComponent(receiverId)}`, audioMediaManifestFor(receiverId)),
    audioExportIndexEntry("transcript_manifest", "Transcript manifest", `/audio/transcript-manifest?receiverId=${encodeURIComponent(receiverId)}`, audioTranscriptManifestFor(receiverId)),
    audioExportIndexEntry("hearing_profile_manifest", "Hearing profile manifest", `/audio/hearing-profile-manifest?receiverId=${encodeURIComponent(receiverId)}`, audioHearingProfileManifestFor(receiverId)),
    audioExportIndexEntry("timeline", "Audio timeline", `/audio/timeline?receiverId=${encodeURIComponent(receiverId)}`, audioTimelineFor(receiverId)),
  ];
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    receiverId,
    audioDomainModel,
    audioStateMetadata: audioStateMetadataFor(),
    migrationReadiness: audioMigrationReadinessFor(receiverId),
    summary: {
      exportCount: entries.length,
      artifactCount: review.artifacts.length,
      mediaFileCount: review.storageHealth?.indexedOriginals || 0,
      transcriptStatus: review.transcriptionHealth?.status || "unknown",
      readinessStatus: review.reviewReadiness?.status || "unknown",
    },
    integrity: {
      algorithm: "sha256",
      exportIndexHash: stableJsonHash(entries),
    },
    entries,
  };
}

function audioExportIndexEntry(id, label, path, payload) {
  const hasPayload = Boolean(payload);
  const entry = {
    id,
    label,
    path,
    contentType: "application/json",
    hashAlgorithm: "sha256",
    payloadHash: hasPayload ? stableJsonHash(withoutGeneratedFields(payload)) : "",
  };
  if (payload?.summary && typeof payload.summary === "object") {
    entry.summary = payload.summary;
  }
  if (payload?.bundleIntegrity && typeof payload.bundleIntegrity === "object") {
    entry.bundleIntegrity = payload.bundleIntegrity;
  }
  return entry;
}

function audioMediaManifestFor(receiverId) {
  const review = audioReviewFor(receiverId);
  const mediaFiles = review.artifacts
    .filter(artifact => artifact.audioUrl)
    .map(audioMediaManifestFile);
  const presentFiles = mediaFiles.filter(file => file.exists);
  const missingFiles = mediaFiles.filter(file => !file.exists);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    receiverId,
    audioDomainModel,
    audioStateMetadata: audioStateMetadataFor(),
    summary: {
      fileCount: mediaFiles.length,
      presentCount: presentFiles.length,
      missingCount: missingFiles.length,
      totalIndexedBytes: mediaFiles.reduce((sum, file) => sum + Number(file.indexedByteSize || 0), 0),
      totalCurrentBytes: mediaFiles.reduce((sum, file) => sum + Number(file.currentByteSize || 0), 0),
      integrityMismatchCount: mediaFiles.filter(file => file.exists && !file.integrityMatches).length,
    },
    integrity: {
      algorithm: "sha256",
      fileManifestHash: stableJsonHash(mediaFiles),
      presentAudioHashSetHash: stableJsonHash(presentFiles.map(file => file.currentSha256).filter(Boolean).sort()),
    },
    mediaFiles,
  };
}

function audioMediaManifestFile(artifact) {
  const storage = audioArtifactStorageDetail(artifact);
  return {
    artifactId: artifact.id,
    artifactKind: artifact.artifactKind || "",
    audioDirection: artifact.audioDirection || "",
    source: artifact.source || "",
    audioUrl: storage.audioUrl,
    audioPath: storage.audioPath,
    audioMimeType: artifact.audioMimeType || "",
    exists: storage.exists,
    originalPreserved: storage.originalPreserved,
    indexedByteSize: storage.indexedByteSize,
    indexedSha256: storage.indexedSha256,
    currentByteSize: storage.currentByteSize,
    currentSha256: storage.currentSha256,
    integrityMatches: storage.integrityMatches,
    transcriptStatus: artifact.transcriptStatus || "",
    createdAt: artifact.createdAt || "",
  };
}

function audioTranscriptManifestFor(receiverId) {
  const review = audioReviewFor(receiverId);
  const transcripts = review.artifacts.map(audioTranscriptManifestEntry);
  const completed = transcripts.filter(entry => entry.hasTranscript || entry.transcriptStatus === "completed");
  const retryable = review.artifacts.filter(canRetryArtifactTranscription).length;
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    receiverId,
    audioDomainModel,
    audioStateMetadata: audioStateMetadataFor(),
    transcriptionHealth: review.transcriptionHealth,
    summary: {
      artifactCount: transcripts.length,
      completedCount: completed.length,
      needsTranscriptCount: Math.max(transcripts.length - completed.length, 0),
      retryableCount: retryable,
      transcriptTextHash: stableJsonHash(transcripts.map(entry => ({
        artifactId: entry.artifactId,
        transcript: entry.transcript,
        transcriptStatus: entry.transcriptStatus,
      }))),
    },
    transcripts,
  };
}

function audioTranscriptManifestEntry(artifact) {
  const message = messageForAudioArtifact(artifact);
  const transcript = String(artifact.transcript || "");
  return {
    artifactId: artifact.id,
    artifactKind: artifact.artifactKind || "",
    audioDirection: artifact.audioDirection || "",
    source: artifact.source || "",
    audioUrl: artifact.audioUrl || "",
    audioSha256: artifact.audioSha256 || "",
    transcript,
    hasTranscript: Boolean(transcript.trim()),
    transcriptStatus: artifact.transcriptStatus || "",
    transcriptionRetriedAt: artifact.transcriptionRetriedAt || "",
    messageId: artifact.messageId || message?.id || "",
    clientMessageId: artifact.clientMessageId || message?.clientMessageId || "",
    messageBody: message?.body || "",
    messageTranscriptStatus: message?.transcriptStatus || "",
  };
}

function audioReviewBundleFor(receiverId) {
  const review = audioReviewFor(receiverId);
  const manifest = audioManifestFor(receiverId);
  const artifactIndex = audioArtifactIndexForReview(review, receiverId);
  return {
    version: 1,
    audioDomainModel,
    audioStateMetadata: audioStateMetadataFor(),
    migrationReadiness: audioMigrationReadinessFor(receiverId),
    bundleIntegrity: audioBundleIntegrityFor({ artifactIndex, manifest, receiverId, review }),
    generatedAt: new Date().toISOString(),
    receiverId,
    reviewReadiness: review.reviewReadiness,
    reviewSummary: review.summary,
    storageHealth: review.storageHealth,
    eventLinkHealth: review.eventLinkHealth,
    captureHealth: review.captureHealth,
    transcriptionHealth: review.transcriptionHealth,
    timelineSummary: review.timelineSummary,
    maintenancePreview: review.maintenancePreview,
    profileSummary: review.profile?.summary || null,
    duplicateGroups: review.duplicateGroups,
    manifest,
    artifactIndex,
    endpoints: {
      ...audioDomainCatalogEndpoints(),
      manifest: `/audio/manifest?receiverId=${encodeURIComponent(receiverId)}`,
      mediaManifest: `/audio/media-manifest?receiverId=${encodeURIComponent(receiverId)}`,
      transcriptManifest: `/audio/transcript-manifest?receiverId=${encodeURIComponent(receiverId)}`,
      hearingProfileManifest: `/audio/hearing-profile-manifest?receiverId=${encodeURIComponent(receiverId)}`,
      review: `/audio/review?receiverId=${encodeURIComponent(receiverId)}`,
      timeline: `/audio/timeline?receiverId=${encodeURIComponent(receiverId)}`,
      maintenancePreview: `/audio/maintenance-preview?receiverId=${encodeURIComponent(receiverId)}`,
    },
  };
}

function audioArtifactIndexForReview(review, receiverId) {
  return review.artifacts.map((artifact) => ({
    id: artifact.id,
    artifactKind: artifact.artifactKind || "",
    audioDirection: artifact.audioDirection || "",
    source: artifact.source || "",
    audioUrl: artifact.audioUrl || "",
    audioSha256: artifact.audioSha256 || "",
    captureSurface: artifact.captureContext?.captureSurface || "",
    captureRole: artifact.captureContext?.captureRole || "",
    transcriptStatus: artifact.transcriptStatus || "",
    relatedMessageId: artifact.relatedMessage?.id || artifact.messageId || "",
    enhancementCount: artifact.relatedActivity?.enhancementCount || 0,
    feedbackCount: artifact.relatedActivity?.feedbackCount || 0,
    detailPath: `/audio/artifacts/${encodeURIComponent(artifact.id)}/detail?receiverId=${encodeURIComponent(receiverId)}`,
  }));
}

function audioBundleIntegrityFor({ artifactIndex, manifest, receiverId, review }) {
  const artifactHashes = artifactIndex
    .map(artifact => artifact.audioSha256)
    .filter(Boolean)
    .sort();
  return {
    algorithm: "sha256",
    receiverId,
    generatedFrom: "audioReviewBundleFor",
    artifactCount: artifactIndex.length,
    duplicateGroupCount: review.duplicateGroups?.length || 0,
    totalIndexedBytes: review.storageHealth?.indexedBytes || 0,
    manifestHash: stableJsonHash(withoutGeneratedFields(manifest)),
    artifactIndexHash: stableJsonHash(artifactIndex),
    artifactAudioHashSetHash: stableJsonHash(artifactHashes),
  };
}

function withoutGeneratedFields(value) {
  if (Array.isArray(value)) {
    return value.map(withoutGeneratedFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.keys(value).reduce((result, key) => {
    if (key === "generatedAt" || key === "savedAt" || key === "loadedAt") {
      return result;
    }
    result[key] = withoutGeneratedFields(value[key]);
    return result;
  }, {});
}

function audioArtifactDetailFor(artifactId, receiverId = "") {
  const artifact = audioArtifacts.find((entry) => {
    if (entry.id !== artifactId) return false;
    return !receiverId || entry.receiverId === receiverId;
  });
  if (!artifact) return null;

  const normalizedUrl = normalizeAudioUrl(artifact.audioUrl);
  const message = messageForAudioArtifact(artifact);
  const timelineEvents = audioTimelineEvents
    .filter(event =>
      event.artifactId === artifact.id ||
      (normalizedUrl && normalizeAudioUrl(event.audioUrl) === normalizedUrl) ||
      (artifact.messageId && event.messageId === artifact.messageId)
    )
    .slice()
    .sort(compareCreatedAtDescending);
  const enhancementEvents = audioEnhancementEvents
    .filter(event =>
      event.receiverId === artifact.receiverId &&
      (event.artifactId === artifact.id || (normalizedUrl && normalizeAudioUrl(event.audioUrl) === normalizedUrl))
    )
    .slice()
    .sort(compareCreatedAtDescending);
  const feedbackEvents = hearingFeedbackEvents
    .filter(event =>
      event.receiverId === artifact.receiverId &&
      (event.artifactId === artifact.id || (normalizedUrl && normalizeAudioUrl(event.audioUrl) === normalizedUrl))
    )
    .slice()
    .sort(compareCreatedAtDescending);

  return {
    artifact,
    storage: audioArtifactStorageDetail(artifact),
    relatedMessage: message ? publicAudioReviewMessage(message) : null,
    timelineEvents,
    enhancementEvents,
    feedbackEvents,
    auditTrail: audioArtifactAuditTrail({
      artifact,
      timelineEvents,
      enhancementEvents,
      feedbackEvents,
      message,
    }),
  };
}

function audioArtifactStorageDetail(artifact) {
  const audioPath = audioFilePathForUrl(artifact.audioUrl);
  const exists = Boolean(audioPath && fs.existsSync(audioPath));
  const currentIntegrity = exists ? audioFileIntegrity(audioPath) : { audioByteSize: 0, audioSha256: "" };
  return {
    originalPreserved: Boolean(artifact.originalPreserved && artifact.audioUrl),
    audioUrl: artifact.audioUrl || "",
    audioPath: exists ? audioPath : "",
    exists,
    indexedByteSize: artifact.audioByteSize || 0,
    indexedSha256: artifact.audioSha256 || "",
    currentByteSize: currentIntegrity.audioByteSize,
    currentSha256: currentIntegrity.audioSha256,
    integrityMatches:
      exists &&
      Boolean(artifact.audioSha256) &&
      artifact.audioSha256 === currentIntegrity.audioSha256 &&
      Number(artifact.audioByteSize || 0) === Number(currentIntegrity.audioByteSize || 0),
  };
}

function audioArtifactAuditTrail({ artifact, timelineEvents, enhancementEvents, feedbackEvents, message }) {
  const events = [
    {
      type: "audio.artifact_indexed",
      createdAt: artifact.createdAt || "",
      summary: "Audio artifact indexed",
      detail: {
        artifactKind: artifact.artifactKind || "",
        audioDirection: artifact.audioDirection || "",
        source: artifact.source || "",
        transcriptStatus: artifact.transcriptStatus || "",
      },
    },
  ];
  if (artifact.transcriptionRetriedAt) {
    events.push({
      type: "audio.transcription_retried",
      createdAt: artifact.transcriptionRetriedAt,
      summary: "Transcript retry recorded on artifact",
      detail: { transcriptStatus: artifact.transcriptStatus || "" },
    });
  }
  if (message?.heardAt) {
    events.push({
      type: "message.heard",
      createdAt: message.heardAt,
      summary: "Linked message was heard",
      detail: { messageId: message.id },
    });
  }
  if (message?.readAt) {
    events.push({
      type: "message.read",
      createdAt: message.readAt,
      summary: "Linked message was read",
      detail: { messageId: message.id },
    });
  }
  timelineEvents.forEach(event => events.push({
    type: event.type,
    createdAt: event.createdAt,
    summary: event.summary || event.type,
    detail: event.detail || {},
  }));
  enhancementEvents.forEach(event => events.push({
    type: "audio.enhancement_event",
    createdAt: event.createdAt,
    summary: "Playback enhancement event",
    detail: {
      artifactId: event.artifactId,
      artifactKind: event.artifactKind,
      audioDirection: event.audioDirection,
      surface: event.surface,
      source: event.source,
      cached: event.cached,
      reasons: event.audioEnhancementProfile?.reasons || [],
      enhancement: event.enhancement || {},
    },
  }));
  feedbackEvents.forEach(event => events.push({
    type: "audio.hearing_feedback",
    createdAt: event.createdAt,
    summary: event.improved ? "Enhanced playback helped" : "Enhanced playback did not help",
    detail: {
      artifactId: event.artifactId,
      artifactKind: event.artifactKind,
      audioDirection: event.audioDirection,
      improved: event.improved,
      messageFrom: event.messageFrom,
      messageSource: event.messageSource,
    },
  }));
  return events
    .filter(event => event.createdAt)
    .sort(compareCreatedAtDescending);
}

function compareCreatedAtDescending(first, second) {
  return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
}

function audioTimelineFor(receiverId) {
  return audioTimelineEvents
    .filter(event => !receiverId || event.receiverId === receiverId)
    .slice()
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
    .map((event) => ({
      id: event.id,
      createdAt: event.createdAt,
      receiverId: event.receiverId,
      type: event.type,
      artifactId: event.artifactId,
      messageId: event.messageId,
      audioUrl: event.audioUrl,
      summary: event.summary,
      detail: event.detail,
    }));
}

function audioTimelineSummaryFor(receiverId, artifacts = []) {
  const timeline = audioTimelineFor(receiverId);
  const typeCounts = {};
  timeline.forEach((event) => {
    typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
  });
  const artifactDates = artifacts
    .map(artifact => new Date(artifact.createdAt).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return {
    eventCount: timeline.length,
    latestEventAt: timeline[0]?.createdAt || "",
    latestEventType: timeline[0]?.type || "",
    firstArtifactAt: artifactDates.length ? new Date(artifactDates[0]).toISOString() : "",
    lastArtifactAt: artifactDates.length ? new Date(artifactDates[artifactDates.length - 1]).toISOString() : "",
    typeCounts,
  };
}

function audioDuplicateGroups(artifacts) {
  const byHash = new Map();
  artifacts.forEach((artifact) => {
    if (!artifact.audioSha256) return;
    if (!byHash.has(artifact.audioSha256)) {
      byHash.set(artifact.audioSha256, []);
    }
    byHash.get(artifact.audioSha256).push(artifact);
  });
  return [...byHash.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([sha256, group]) => ({
      sha256,
      count: group.length,
      artifactIds: group.map(artifact => artifact.id),
      audioUrls: group.map(artifact => artifact.audioUrl).filter(Boolean),
      sources: [...new Set(group.map(artifact => artifact.source || "audio"))],
      artifactKinds: [...new Set(group.map(artifact => artifact.artifactKind || "unknown"))],
      audioDirections: [...new Set(group.map(artifact => artifact.audioDirection || "unknown"))],
    }));
}

function audioReviewSummary(artifacts, profile) {
  const sourceCounts = {};
  const kindCounts = {};
  const directionCounts = {};
  artifacts.forEach(artifact => {
    const source = artifact.source || "audio";
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    const artifactKind = artifact.artifactKind || "unknown";
    kindCounts[artifactKind] = (kindCounts[artifactKind] || 0) + 1;
    const audioDirection = artifact.audioDirection || "unknown";
    directionCounts[audioDirection] = (directionCounts[audioDirection] || 0) + 1;
  });
  const transcribed = artifacts.filter(artifact => artifact.transcript || artifact.transcriptStatus === "completed").length;
  const heard = artifacts.filter(artifact => artifact.relatedMessage?.heardAt).length;
  const read = artifacts.filter(artifact => artifact.relatedMessage?.readAt).length;
  const enhanced = artifacts.reduce((sum, artifact) => sum + artifact.relatedActivity.enhancementCount, 0);
  const feedback = artifacts.reduce((sum, artifact) => sum + artifact.relatedActivity.feedbackCount, 0);
  const duplicateArtifacts = artifacts.filter(artifact => artifact.duplicateInfo).length;
  return {
    artifactCount: artifacts.length,
    originalsPreserved: artifacts.filter(artifact => artifact.originalPreserved).length,
    transcribed,
    needsTranscript: artifacts.length - transcribed,
    heard,
    read,
    enhancedPlaybacks: enhanced,
    feedbackEvents: feedback,
    duplicateArtifacts,
    profileEvents: profile.summary?.total || 0,
    automaticEnhancementEvents: profile.summary?.enhancementEvents || 0,
    sourceCounts,
    kindCounts,
    directionCounts,
    lastArtifactAt: artifacts[0]?.createdAt || "",
    lastProfileUpdatedAt: profile.summary?.lastUpdatedAt || "",
  };
}

function messageForAudioArtifact(artifact) {
  return messages.find((message) => {
    if (artifact.messageId && message.id === artifact.messageId) return true;
    return artifact.clientMessageId && message.clientMessageId === artifact.clientMessageId;
  }) || null;
}

function publicAudioReviewMessage(message) {
  return {
    id: message.id,
    audioArtifactId: message.audioArtifactId || "",
    clientMessageId: message.clientMessageId || "",
    from: message.from || "",
    to: message.to || "",
    source: message.source || "",
    messageType: message.messageType || "",
    heardAt: message.heardAt || "",
    readAt: message.readAt || "",
    createdAt: message.createdAt || "",
  };
}

function normalizeAudioUrl(value) {
  return String(value || "").replace(/^https?:\/\/[^/]+/i, "");
}

app.get("/calls", (req, res) => {
  const receiverId = req.query.receiverId ? normalizeReceiverId(req.query.receiverId) : "";
  const includeEnded = String(req.query.includeEnded || "true") !== "false";
  const callList = [...calls.values()]
    .filter(call => !receiverId || call.receiverIds?.includes(receiverId) || call.receiverId === receiverId)
    .filter(call => includeEnded || !terminalCallStates.has(call.state))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    .map(publicCall);
  res.json({ ok: true, calls: callList });
});

app.get("/calls/summary", (req, res) => {
  const receiverId = req.query.receiverId ? normalizeReceiverId(req.query.receiverId) : "";
  const callList = [...calls.values()]
    .filter(call => !receiverId || call.receiverIds?.includes(receiverId) || call.receiverId === receiverId);
  res.json({
    ok: true,
    summary: {
      receiverId,
      total: callList.length,
      active: callList.filter(call => !terminalCallStates.has(call.state)).length,
      byState: countBy(callList, call => call.state || "unknown"),
      latestCall: callList
        .slice()
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .map(publicCall)[0] || null,
    },
  });
});

app.get("/calls/:callId", (req, res) => {
  const call = calls.get(req.params.callId);
  if (!call) {
    res.status(404).json({ ok: false, error: "Call not found" });
    return;
  }
  res.json({ ok: true, call: publicCall(call) });
});

app.post("/calls/:callId/state", (req, res) => {
  const call = calls.get(req.params.callId);
  if (!call) {
    res.status(404).json({ ok: false, error: "Call not found" });
    return;
  }

  const state = String(req.body.state || "").trim();
  const transition = transitionCallState(call, state, {
    source: String(req.body.source || "receiver"),
    reason: String(req.body.reason || ""),
    note: String(req.body.note || ""),
  });
  if (!transition.ok) {
    res.status(transition.status || 400).json({ ok: false, error: transition.error });
    return;
  }

  const receiverIds = call.receiverIds || [call.receiverId];
  const events = transition.changed ? addEventForReceivers(receiverIds, `call.${state}`, {
    callId: call.callId,
    callerName: call.callerName,
    recipientName: call.recipientName,
    previousState: transition.previousState || "",
    state,
    updatedAt: call.updatedAt,
    answeredAt: call.answeredAt || "",
    connectedAt: call.connectedAt || "",
    endedAt: call.endedAt || "",
    endedReason: call.endedReason || "",
    durationMs: call.durationMs || 0,
  }) : [];
  res.json({ ok: true, changed: transition.changed, call: publicCall(call), events });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`CarePland local trigger server listening on http://0.0.0.0:${port}`);
});
