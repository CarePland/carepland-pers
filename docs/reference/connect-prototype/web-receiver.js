import {
  connectContacts,
  nextAppointment,
  receiverMessages,
  receiverModel,
  receiverSettings,
  reminders,
} from "./shared/receiver-models.js";
import {
  createAskRecovery,
  createAskRecoveryCoordinatorMessage,
  createReceiverAskMessage,
  getReceiverAskSuggestions,
  interpretReceiverAskRequest,
} from "./shared/receiver-ask-service.js";
import {
  ConnectAskEventType,
  ConnectAskOutcome,
  appendConnectAskEvent,
  completeConnectAskInteraction,
  createConnectAskInteraction,
} from "./shared/connect-ask-trace.js";
import {
  getSupportRecipe,
  loadSupportHelpState,
  saveGeneratedSupportRecipe,
  saveSupportHelpState,
} from "./shared/support-recipe-service.js";
import { issueFromSoundResult } from "./shared/support-recipes.js";
import {
  browserAudioRecordingAvailable,
  startBrowserAudioRecording,
} from "./shared/audio-recording-service.js";
import {
  postAudioEnhancementEvent,
  requestAudioTranscription,
  sendAudioMessage,
} from "./shared/audio-client-service.js";
import {
  applyAudioHearingFeedback,
  createAudioHearingFeedbackEvent,
  loadAudioHearingProfile,
  postAudioHearingFeedback,
  saveAudioHearingProfile,
} from "./shared/audio-hearing-profile-service.js";
import { createBrowserAudioController } from "./shared/audio-playback-service.js";
import {
  applyConnectTheme,
  loadConnectTheme,
} from "./shared/connect-theme-service.js";

const receiverRuntimeStorageKey = "carepland.receiver.runtime.v1";
const receiverProvisioningStorageKey = "carepland.receiver.provisioning.v1";
const receiverHearingProfileStorageKey = "carepland.receiver.hearingProfile.v1";
const receiverThemePollMs = 8000;
const applianceDesignWidth = 768;
const applianceDesignHeight = 900;
const applianceMinimumScale = 0.72;
const incomingRingRepeatMs = 3600;
const storedRuntimeState = loadStoredRuntimeState();
const storedProvisioning = loadStoredProvisioning();
const storedContactExists = connectContacts.some((contact) => contact.id === storedRuntimeState.selectedContactId);

const state = {
  selectedContactId: storedContactExists ? storedRuntimeState.selectedContactId : connectContacts[0].id,
  messages: [...receiverMessages],
  serverMessages: [],
  settings: loadStoredSettings(),
  activeReminder: null,
  activeCall: null,
  activeConversation: storedRuntimeState.activeConversation || null,
  receiverStarted: storedRuntimeState.receiverStarted,
  localServerUrl: defaultLocalServerUrl(),
  provisioning: storedProvisioning,
  setupNotice: "",
  lastEventId: 0,
  receiverPollTimer: null,
  heartbeatTimer: null,
  messagePollTimer: null,
  themePollTimer: null,
  uiMirrorTimer: null,
  lastPublishedUiState: "",
  lastMirroredUiStateAt: "",
  serverOnline: false,
  focusedMessageIndex: 0,
  soundDiagnostic: "",
  soundHelp: null,
  supportHelpState: loadSupportHelpState(),
  lastAudioTestResult: "not_run",
  lastButtonBeepAt: 0,
  askRecoveries: [],
  askInteractions: [],
  activeAskInteraction: null,
  activeAskRecording: null,
  askRecordingResult: null,
  activeContactRecording: null,
  contactRecordingResult: null,
  activeRecoveryRecording: null,
  recoveryRecordingResult: null,
  activeGuideTarget: null,
  activeMessageAudioId: null,
  activeMessageAudioElement: null,
  activeMessageAudioTimer: null,
  incomingRingTimer: null,
  cpPersAppointmentsAvailable: null,
  cpPersAppointments: [],
};

const audioPack = {
  button: "./assets/audio/microwave-beep.mp3",
  incoming: "./assets/audio/old-phone-ringing.mp3",
  ringback: "./assets/audio/in-call-ring.wav",
};

const browserAudio = createBrowserAudioController({
  resolveUrl: resolveAudioUrl,
  volumeLevel: comfortVolumeLevel,
  defaultVolume: "medium",
  playbackGain: 1.6,
  onEnhancementProfile: reportAudioEnhancementProfile,
  onPlaybackBlocked: () => {
    setStatus("Audio playback was blocked by the browser.");
  },
});

function reportAudioEnhancementProfile(event) {
  postAudioEnhancementEvent(
    {
      ...event,
      receiverId: activeReceiverId(),
      surface: "web_receiver",
    },
    { baseUrl: state.localServerUrl, receiverId: activeReceiverId() }
  ).catch(() => {
    // Playback should not depend on analytics/profile sync.
  });
}

const receiverRecordingOptions = {
  stopAfterSilenceMs: 2600,
  silenceGraceMs: 1200,
  silenceThreshold: 0.018,
  maxDurationMs: 20000,
};
const requestReadyButtonLabel = "This text is what I want to send";

const isAppleTouchBrowser =
  /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
  (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

const activationScreen = document.querySelector("#activationScreen");
const startReceiverButton = document.querySelector("#startReceiverButton");
const setupCodeForm = document.querySelector("#setupCodeForm");
const setupCodeInput = document.querySelector("#setupCodeInput");
const submitSetupCodeButton = document.querySelector("#submitSetupCodeButton");
const timeText = document.querySelector("#timeText");
const dateText = document.querySelector("#dateText");
const greetingText = document.querySelector("#greetingText");
const receiverLocation = document.querySelector("#receiverLocation");
const peopleStrip = document.querySelector("#peopleStrip");
const appointmentLabel = document.querySelector("#appointmentLabel");
const appointmentTitle = document.querySelector("#appointmentTitle");
const appointmentDay = document.querySelector("#appointmentDay");
const appointmentTime = document.querySelector("#appointmentTime");
const callButton = document.querySelector("#callButton");
const moreButton = document.querySelector("#moreButton");
const voiceAskButton = document.querySelector("#voiceAskButton");
const optionalSoundsButton = document.querySelector("#optionalSoundsButton");
const appointmentButton = document.querySelector("#appointmentButton");
const statusLine = document.querySelector("#statusLine");
const workspacePages = document.querySelector("#workspacePages");
const applianceCanvas = document.querySelector("#applianceCanvas");
const receiverGuideLayer = document.querySelector("#receiverGuideLayer");
const modal = document.querySelector("#modal");
const modalPanel = document.querySelector("#modalPanel");

applyConnectTheme(loadConnectTheme());
loadRemoteConnectTheme();

function scaleAppliance() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const fitScale = Math.min(
    viewportWidth / applianceDesignWidth,
    viewportHeight / applianceDesignHeight
  );
  const scale = Math.max(applianceMinimumScale, fitScale);
  const root = document.documentElement;
  root.style.setProperty("--appliance-scale", String(scale));
  root.style.setProperty("--scaled-width", `${applianceDesignWidth * scale}px`);
  root.style.setProperty("--scaled-height", `${applianceDesignHeight * scale}px`);
  document.body.dataset.applianceBelowMinimum = String(fitScale < applianceMinimumScale);
  if (applianceCanvas) {
    applianceCanvas.setAttribute("data-scale", scale.toFixed(3));
  }
}

function selectedContact() {
  return connectContacts.find((contact) => contact.id === state.selectedContactId) || connectContacts[0];
}

function updateClock() {
  const now = new Date();
  timeText.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  dateText.textContent = now.toLocaleDateString([], { month: "short", day: "numeric" });
  greetingText.textContent = `${greetingFor(now)}, ${receiverModel.careVipName}`;
  receiverLocation.textContent = receiverModel.locationLabel;
}

function greetingFor(date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 22) return "Good Evening";
  return "Good Night";
}

function renderPeople() {
  peopleStrip.innerHTML = "";
  connectContacts.forEach((contact) => {
    const button = document.createElement("button");
    button.className = `person-button${contact.id === state.selectedContactId ? " selected" : ""}`;
    button.type = "button";
    button.innerHTML = `
      <strong>${escapeHtml(contact.displayName)}</strong>
      <span>${escapeHtml(contact.availabilityLabel)}</span>
    `;
    button.addEventListener("click", () => {
      playButtonBeep();
      state.selectedContactId = contact.id;
      saveStoredRuntimeState();
      render();
      setStatus(`${contact.displayName} is selected.`);
    });
    peopleStrip.append(button);
  });
}

function renderAppointment() {
  appointmentLabel.textContent = nextAppointment.label;
  appointmentTitle.textContent = nextAppointment.title;
  appointmentDay.textContent = nextAppointment.dayLabel;
  appointmentTime.textContent = nextAppointment.timeLabel;
}

function renderActions() {
  const contact = selectedContact();
  callButton.textContent = `Contact ${contact.displayName}`;
  appointmentButton.hidden = state.cpPersAppointmentsAvailable === false;
}

function renderWorkspace() {
  workspacePages.innerHTML = "";
  if (state.focusedMessageIndex >= state.messages.length) {
    state.focusedMessageIndex = Math.max(0, state.messages.length - 1);
  }

  const nav = document.createElement("div");
  nav.className = "workspace-nav";
  const previous = actionButton("Previous", "secondary", () => {
    state.focusedMessageIndex = Math.max(0, state.focusedMessageIndex - 1);
    renderWorkspace();
  });
  previous.disabled = state.focusedMessageIndex === 0;
  const title = document.createElement("strong");
  title.textContent = "Messages";
  const showAll = actionButton("Show All", "secondary workspace-show-all", openAllMessagesPanel);
  const next = actionButton("Next", "secondary", () => {
    state.focusedMessageIndex = Math.min(state.messages.length - 1, state.focusedMessageIndex + 1);
    renderWorkspace();
  });
  next.disabled = state.focusedMessageIndex >= state.messages.length - 1;
  const spacer = document.createElement("span");
  spacer.className = "workspace-nav-spacer";
  nav.append(title, showAll, spacer, previous, next);
  workspacePages.append(nav);

  if (!state.messages.length) {
    const empty = document.createElement("article");
    empty.className = "message-card focused";
    empty.innerHTML = `<p>No messages yet.</p>`;
    workspacePages.append(empty);
    return;
  }

  const message = state.messages[state.focusedMessageIndex];
  const card = document.createElement("article");
  card.className = "message-card focused";
  card.innerHTML = `
    <strong>${escapeHtml(messageHeader(message))}</strong>
    <p>${escapeHtml(messageText(message))}</p>
  `;

  const actions = document.createElement("div");
  actions.className = "message-actions";
  const messageIsPlaying = state.activeMessageAudioId === message.id;
  actions.append(
    actionButton(messageIsPlaying ? "STOP ■" : "PLAY ▶", messageIsPlaying ? "stop-audio" : "blue", () => hearMessage(message), { beep: false }),
    actionButton("READ", "", () => readMessage(message)),
    actionButton("CALL BACK", "green", () => callContact(message.from))
  );
  if (message.audioUrl) {
    actions.append(
      actionButton("That was hard to hear", "secondary hearing-help", () => replayMessageForHearing(message))
    );
  }
  card.append(actions);
  workspacePages.append(card);
}

function actionButton(label, tone, action, options = {}) {
  const button = document.createElement("button");
  button.className = `message-action ${tone}`;
  button.type = "button";
  button.textContent = label;
  if (options.beep === false) {
    button.dataset.noBeep = "true";
  }
  button.addEventListener("click", () => {
    if (options.beep !== false) {
      playButtonBeep();
    }
    action();
  });
  return button;
}

function messageHeader(message) {
  const name = message.from === "receiver_user" ? message.to : message.from;
  return `${name || "CarePland"} • ${messageTimeLabel(message.createdAt)}`;
}

function messageText(message) {
  return message.transcript || message.body || "This message is not available to read yet.";
}

function hearMessage(message) {
  // TODO: replace local audio URLs with GET /api/connect/receiver/messages shared by Android and Web.
  if (state.activeMessageAudioId === message.id) {
    stopMessagePlayback();
    setStatus("Message stopped.");
    return;
  }

  markMessageState(message, { heard: true });
  if (message.audioUrl && playMessageAudioFile(message)) {
    return;
  }

  setStatus(`Speaking message text from ${message.from}.`);
  state.activeMessageAudioId = message.id;
  renderWorkspace();
  speak(message.transcript || message.body);
  window.clearTimeout(state.activeMessageAudioTimer);
  state.activeMessageAudioTimer = window.setTimeout(() => {
    if (state.activeMessageAudioId === message.id) {
      state.activeMessageAudioId = null;
      renderWorkspace();
    }
  }, estimatedSpeechDurationMs(messageText(message)));
}

function playMessageAudioFile(message) {
  const audioUrl = resolveAudioUrl(message.audioUrl || "");
  if (!audioUrl || comfortVolumeLevel() === 0) return false;

  stopActiveAudio();
  const audio = new Audio(audioUrl);
  audio.volume = comfortVolumeLevel();
  state.activeMessageAudioElement = audio;
  state.activeMessageAudioId = message.id;
  audio.addEventListener(
    "ended",
    () => {
      if (state.activeMessageAudioId === message.id) {
        state.activeMessageAudioId = null;
        state.activeMessageAudioElement = null;
        renderWorkspace();
      }
      setStatus(`Finished message from ${message.from}.`);
    },
    { once: true }
  );
  audio.addEventListener(
    "error",
    () => {
      if (state.activeMessageAudioId === message.id) {
        state.activeMessageAudioId = null;
        state.activeMessageAudioElement = null;
        renderWorkspace();
      }
      speak(message.transcript || message.body);
    },
    { once: true }
  );
  audio.play().catch(() => {
    if (state.activeMessageAudioId === message.id) {
      state.activeMessageAudioId = null;
      state.activeMessageAudioElement = null;
      renderWorkspace();
    }
    speak(message.transcript || message.body);
  });
  renderWorkspace();
  setStatus(`Playing message from ${message.from}.`);
  return true;
}

function stopMessagePlayback() {
  if (state.activeMessageAudioElement) {
    state.activeMessageAudioElement.pause();
    state.activeMessageAudioElement.currentTime = 0;
    state.activeMessageAudioElement = null;
  }
  stopActiveAudio();
  window.clearTimeout(state.activeMessageAudioTimer);
  state.activeMessageAudioTimer = null;
  state.activeMessageAudioId = null;
  renderWorkspace();
}

function estimatedSpeechDurationMs(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1800, Math.min(18000, words * 520));
}

function replayMessageForHearing(message) {
  if (!message.audioUrl) {
    speak(messageText(message));
    return;
  }
  setStatus("Adjusting to make that voice easier to hear.");
  speak("Adjusting to make that voice easier to hear.");
  const playbackGain = hearingHelpPlaybackGain();
  window.setTimeout(() => {
    playAudio(message.audioUrl, {
      artifactId: message.audioArtifactId || "",
      artifactKind: message.messageType === "audio" ? "coordinator_message" : "",
      audioDirection: message.messageType === "audio" ? "coordinator_to_receiver" : "",
      playbackGain,
      source: "receiver_message_hearing_help",
      onEnded: () => showHearingImprovementPrompt(message),
    });
  }, 1200);
}

function showHearingImprovementPrompt(message) {
  openModal(`
    <h2>Did that sound better?</h2>
    <div class="settings-row two">
      <button class="modal-button" type="button" data-action="better-yes">Yes</button>
      <button class="modal-button secondary" type="button" data-action="better-no">No</button>
    </div>
  `);
  modalPanel.querySelector('[data-action="better-yes"]').addEventListener("click", () => {
    playButtonBeep();
    saveHearingFeedback(message, true, { playbackGain: hearingHelpPlaybackGain() });
    closeModal();
    setStatus("Good. I will use the clearer playback for messages like that.");
  });
  modalPanel.querySelector('[data-action="better-no"]').addEventListener("click", () => {
    playButtonBeep();
    saveHearingFeedback(message, false, { playbackGain: hearingHelpPlaybackGain() });
    closeModal();
    setStatus("Okay. I will keep the original message available.");
    readMessage(message);
  });
}

function preferredMessagePlaybackGain() {
  const profile = loadHearingProfile();
  return boundedPlaybackGain(profile.summary?.preferredPlaybackGain, 1.6);
}

function hearingHelpPlaybackGain() {
  return boundedPlaybackGain(preferredMessagePlaybackGain() + 0.35, 2.05);
}

function boundedPlaybackGain(value, fallback) {
  const gain = Number(value);
  if (!Number.isFinite(gain)) return fallback;
  return Math.max(1, Math.min(2.2, Number(gain.toFixed(2))));
}

function saveHearingFeedback(message, improved, enhancement = {}) {
  const profile = loadHearingProfile();
  const event = createAudioHearingFeedbackEvent({
    receiverId: activeReceiverId(),
    subjectName: receiverModel.careVipName,
    careVipName: receiverModel.careVipName,
    artifactId: message.audioArtifactId || "",
    artifactKind: message.messageType === "audio" ? "coordinator_message" : "",
    audioDirection: message.messageType === "audio" ? "coordinator_to_receiver" : "",
    messageId: message.id || "",
    messageFrom: message.from || "",
    messageSource: message.source || "",
    audioUrl: message.audioUrl || "",
    improved: Boolean(improved),
    enhancement,
    audioEnhancementProfile: message.audioUrl ? browserAudio.getEnhancementProfile(message.audioUrl) : null,
  });
  saveHearingProfile(applyAudioHearingFeedback(profile, event, {
    receiverId: activeReceiverId(),
    subjectName: receiverModel.careVipName,
  }));
  postHearingFeedback(event);
}

function postHearingFeedback(event) {
  postAudioHearingFeedback(event, { baseUrl: state.localServerUrl }).catch(() => {
    // Local profile is already saved; server sync can catch up later.
  });
}

function loadHearingProfile() {
  try {
    return loadAudioHearingProfile({
      storageKey: receiverHearingProfileStorageKey,
      receiverId: activeReceiverId(),
      subjectName: receiverModel.careVipName,
      preferredPlaybackGain: 1.6,
    });
  } catch {
    return loadAudioHearingProfile();
  }
}

function saveHearingProfile(profile) {
  try {
    saveAudioHearingProfile(profile, { storageKey: receiverHearingProfileStorageKey });
  } catch {
    // Hearing feedback is useful, but should never block playback.
  }
}

function readMessage(message) {
  markMessageState(message, { read: true });
  openReader(message, messageText(message));
}

function markMessageState(message, nextState) {
  if (!message?.id || !state.serverOnline) return;
  const now = new Date().toISOString();
  if (nextState.heard && !message.heardAt) {
    message.heardAt = now;
  }
  if (nextState.read && !message.readAt) {
    message.readAt = now;
  }
  localApi(`/messages/${encodeURIComponent(message.id)}/state`, {
    method: "PATCH",
    body: JSON.stringify({
      receiverId: activeReceiverId(),
      ...nextState,
    }),
  }).catch(() => {
    // Message state is telemetry; HEAR and READ must keep working offline.
  });
}

function callContact(name) {
  const contact = contactByName(name) || selectedContact();
  if (!contactCanCallNow(contact)) {
    setStatus(`${contact.displayName} is unavailable right now.`);
    return;
  }
  setStatus(`Calling ${contact.displayName}.`);
}

function adminContact() {
  return connectContacts.find((contact) => contact.displayName === "Andrew") || connectContacts[0];
}

function receiverAskContext() {
  return {
    selectedContact: selectedContact(),
    adminContact: adminContact(),
    receiver: receiverModel,
    careVipName: receiverModel.careVipName,
    receiverName: receiverModel.displayName,
    receiverLocation: receiverModel.locationLabel,
    nextAppointment,
    availableContacts: connectContacts,
    surface: "web_receiver",
    interpreterVersion: "local-web-v1",
    timestamp: new Date().toISOString(),
  };
}

function startAskTrace(text, method = "typed", selectedSuggestion = null) {
  const interaction = createConnectAskInteraction({ text, method, selectedSuggestion }, receiverAskContext());
  state.activeAskInteraction = interaction;
  state.askInteractions.unshift(interaction);
  appendAskTrace(ConnectAskEventType.INPUT_CAPTURED, {
    text,
    method,
    selectedSuggestion,
    audioCapture: askRecordingTracePayload(state.askRecordingResult),
  });
  return interaction;
}

function appendAskTrace(type, payload = {}) {
  return appendConnectAskEvent(state.activeAskInteraction, type, payload);
}

function completeAskTrace(outcome, payload = {}) {
  if (!state.activeAskInteraction) return;
  appendAskTrace(ConnectAskEventType.COMPLETED, { outcome, ...payload });
  completeConnectAskInteraction(state.activeAskInteraction, outcome);
  state.activeAskInteraction = null;
}

function sendReceiverAskMessage(interpretationResult) {
  const message = createReceiverAskMessage(interpretationResult, receiverAskContext());
  if (!message.body) {
    setStatus("Type your request first.");
    return null;
  }
  state.messages.unshift(message);
  state.focusedMessageIndex = 0;
  renderWorkspace();
  setStatus(`Your message was sent to ${message.to}.`);
  return message;
}

function defaultLocalServerUrl() {
  const configuredServerUrl = new URLSearchParams(window.location.search).get("serverUrl");
  if (configuredServerUrl) {
    return configuredServerUrl;
  }
  const host = window.location.hostname;
  if (host && host !== "localhost" && host !== "127.0.0.1" && host !== "::1") {
    return `http://${host}:8790`;
  }
  return "http://localhost:8790";
}

function isReceiverPreviewMode() {
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

function localApiUrl(path) {
  return `${state.localServerUrl}${path}`;
}

function activeReceiverId() {
  return state.provisioning?.receiverDevice?.receiverId || state.provisioning?.receiverDevice?.id || receiverModel.id;
}

function receiverAuthorizationHeaders() {
  return state.provisioning?.deviceToken
    ? { Authorization: `Bearer ${state.provisioning.deviceToken}` }
    : {};
}

async function localApi(path, options = {}) {
  const response = await fetch(localApiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...receiverAuthorizationHeaders(),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    if (response.status === 401 && state.provisioning?.deviceToken) {
      clearStoredProvisioning();
      setStatus("Receiver setup was revoked. Open a new setup link to pair this device again.");
    }
    throw new Error(payload.error || `Local server request failed: ${response.status}`);
  }
  return payload;
}

function absoluteLocalApiUrl(pathOrUrl) {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith("blob:")) {
    return pathOrUrl;
  }
  return localApiUrl(pathOrUrl);
}

async function registerReceiver() {
  // TODO: replace local registration with POST /api/connect/receivers/heartbeat.
  const payload = await localApi("/receivers/register", {
    method: "POST",
    body: JSON.stringify({
      receiverId: activeReceiverId(),
      deviceToken: state.provisioning?.deviceToken || "",
      displayName: `${state.provisioning?.receiverDevice?.name || receiverModel.displayName} (Web)`,
      deviceType: "web",
      status: state.activeCall ? state.activeCall.state : receiverModel.status,
    }),
  });
  state.serverOnline = true;
  return payload.receiver;
}

async function pollReceiverEvents() {
  // TODO: replace polling with GET /api/connect/receivers/:id/events or websocket/SSE.
  const payload = await localApi(
    `/receivers/${encodeURIComponent(activeReceiverId())}/events?since=${encodeURIComponent(state.lastEventId)}`
  );
  state.serverOnline = true;
  state.lastEventId = Math.max(state.lastEventId, Number(payload.latestEventId || 0));
  (payload.events || []).forEach(handleReceiverEvent);
}

function receiverUiStateSnapshot() {
  return {
    receiverStarted: state.receiverStarted,
    selectedContactId: state.selectedContactId,
    activeConversation: state.activeConversation || null,
    statusLine: statusLine?.textContent || "",
    source: "receiver",
  };
}

function publishReceiverUiState() {
  if (isReceiverPreviewMode() || !state.localServerUrl) return Promise.resolve(null);
  const snapshot = receiverUiStateSnapshot();
  const serialized = JSON.stringify(snapshot);
  if (serialized === state.lastPublishedUiState) return Promise.resolve(null);
  state.lastPublishedUiState = serialized;
  return localApi(`/receivers/${encodeURIComponent(activeReceiverId())}/ui-state`, {
    method: "POST",
    body: JSON.stringify(snapshot),
  }).catch(() => null);
}

async function pollReceiverUiState() {
  const payload = await localApi(`/receivers/${encodeURIComponent(activeReceiverId())}/ui-state`);
  state.serverOnline = true;
  if (payload.uiState) {
    applyMirroredReceiverUiState(payload.uiState);
  }
}

function applyMirroredReceiverUiState(uiState) {
  if (!isReceiverPreviewMode() || !uiState || uiState.updatedAt === state.lastMirroredUiStateAt) return;
  state.lastMirroredUiStateAt = uiState.updatedAt;
  const selectedExists = connectContacts.some(contact => contact.id === uiState.selectedContactId);
  if (selectedExists) {
    state.selectedContactId = uiState.selectedContactId;
  }
  state.receiverStarted = Boolean(uiState.receiverStarted);
  state.activeConversation = uiState.activeConversation || null;
  render();
  if (state.activeConversation) {
    restoreActiveConversation();
  } else {
    closeModal();
  }
  if (uiState.statusLine) {
    setStatus(uiState.statusLine);
  }
}

async function fetchServerMessages() {
  // TODO: replace local message fetch with GET /api/connect/receiver/messages.
  const payload = await localApi(`/messages?receiverId=${encodeURIComponent(activeReceiverId())}`);
  state.serverMessages = (payload.messages || []).map(normalizeServerMessage);
  state.messages = mergeMessages(state.serverMessages, receiverMessages);
  renderWorkspace();
}

async function loadRemoteConnectTheme(options = {}) {
  try {
    const payload = await localApi(`/connect/theme?receiverId=${encodeURIComponent(activeReceiverId())}`);
    if (payload.theme) {
      applyConnectTheme(payload.theme);
      if (options.announce && payload.source !== "default") {
        setStatus(`Receiver appearance updated to ${payload.theme.name || "Custom"}.`);
      }
    }
  } catch {
    applyConnectTheme(loadConnectTheme());
  }
}

async function fetchUpcomingAppointments() {
  // TODO: replace local bridge with GET /api/connect/personal/appointments/upcoming.
  const payload = await localApi("/personal/appointments/upcoming?limit=8");
  state.cpPersAppointmentsAvailable = Boolean(payload.available !== false);
  state.cpPersAppointments = Array.isArray(payload.appointments) ? payload.appointments : [];
  renderActions();
  return state.cpPersAppointments;
}

async function refreshAppointmentAvailability() {
  try {
    await fetchUpcomingAppointments();
  } catch {
    state.cpPersAppointmentsAvailable = false;
    state.cpPersAppointments = [];
    renderActions();
  }
}

function startServerSync() {
  stopServerSync();
  const previewMode = isReceiverPreviewMode();
  const connectPromise = previewMode
    ? pollReceiverUiState()
    : registerReceiver().then(() => publishReceiverUiState());
  connectPromise
    .then(() => {
      setStatus(`Receiver connected to ${state.localServerUrl}.`);
    })
    .catch(() => {
      state.serverOnline = false;
      setStatus("Local server not reached. Receiver is running in local demo mode.");
    });
  pollReceiverEvents().catch(markServerOffline);
  fetchServerMessages().catch(markServerOffline);
  loadRemoteConnectTheme().catch(() => {});
  refreshAppointmentAvailability();
  state.heartbeatTimer = window.setInterval(() => {
    if (previewMode) {
      pollReceiverUiState().catch(markServerOffline);
    } else {
      registerReceiver().then(() => publishReceiverUiState()).catch(markServerOffline);
    }
  }, 5000);
  state.receiverPollTimer = window.setInterval(() => {
    pollReceiverEvents().catch(markServerOffline);
  }, 1500);
  state.messagePollTimer = window.setInterval(() => {
    fetchServerMessages().catch(markServerOffline);
  }, 6000);
  state.themePollTimer = window.setInterval(() => {
    loadRemoteConnectTheme().catch(() => {});
  }, receiverThemePollMs);
  if (previewMode) {
    state.uiMirrorTimer = window.setInterval(() => {
      pollReceiverUiState().catch(markServerOffline);
    }, 700);
  }
}

function stopServerSync() {
  window.clearInterval(state.heartbeatTimer);
  window.clearInterval(state.receiverPollTimer);
  window.clearInterval(state.messagePollTimer);
  window.clearInterval(state.themePollTimer);
  window.clearInterval(state.uiMirrorTimer);
  state.heartbeatTimer = null;
  state.receiverPollTimer = null;
  state.messagePollTimer = null;
  state.themePollTimer = null;
  state.uiMirrorTimer = null;
}

function markServerOffline() {
  if (state.serverOnline) {
    setStatus("Local server connection paused. Receiver will keep trying.");
  }
  state.serverOnline = false;
}

function handleReceiverEvent(event) {
  if (!event || !event.id) return;
  state.lastEventId = Math.max(state.lastEventId, Number(event.id || 0));

  if (event.type === "call.started") {
    openIncomingCall(event);
    return;
  }

  if (event.type === "message.created") {
    fetchServerMessages().catch(markServerOffline);
    return;
  }

  if (event.type === "theme.updated" || event.type === "theme.reset") {
    loadRemoteConnectTheme({ announce: true }).catch(markServerOffline);
    return;
  }

  if (event.type === "guide.target") {
    showReceiverGuideTarget(event);
    return;
  }

  if (event.type === "guide.completed") {
    clearReceiverGuideTarget(event.guideId || "");
    return;
  }

  if (event.type === "guide.cleared") {
    clearReceiverGuideTarget(event.guideId || "");
    return;
  }

  if (event.type?.startsWith("call.")) {
    updateCallFromEvent(event);
  }
}

function showReceiverGuideTarget(event) {
  const rect = normalizeGuideRect(event.rect);
  if (!rect || !receiverGuideLayer) return;
  state.activeGuideTarget = {
    guideId: event.guideId || "",
    label: event.label || "this button",
    rect,
  };
  receiverGuideLayer.innerHTML = "";
  const highlight = document.createElement("span");
  highlight.className = "receiver-guide-highlight";
  highlight.style.left = `${rect.left}px`;
  highlight.style.top = `${rect.top}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;
  receiverGuideLayer.append(highlight);
  receiverGuideLayer.classList.remove("hidden");
}

function normalizeGuideRect(rect = {}) {
  const left = Number(rect.left);
  const top = Number(rect.top);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }
  return {
    left: Math.max(0, Math.min(applianceDesignWidth, left)),
    top: Math.max(0, Math.min(applianceDesignHeight, top)),
    width: Math.max(24, Math.min(applianceDesignWidth, width)),
    height: Math.max(24, Math.min(applianceDesignHeight, height)),
  };
}

function handleReceiverGuideActivation(event) {
  const target = state.activeGuideTarget;
  if (!target?.rect || !applianceCanvas) return;
  const canvasRect = applianceCanvas.getBoundingClientRect();
  const scale = Number(applianceCanvas.getAttribute("data-scale") || 1) || 1;
  const x = (event.clientX - canvasRect.left) / scale;
  const y = (event.clientY - canvasRect.top) / scale;
  const matchedTarget =
    x >= target.rect.left &&
    x <= target.rect.left + target.rect.width &&
    y >= target.rect.top &&
    y <= target.rect.top + target.rect.height;
  const pressed = receiverGuidePressedTarget(event.target, x, y, scale);
  window.setTimeout(() => completeReceiverGuideTarget(target, {
    ...pressed,
    matchedTarget,
  }), 0);
}

function receiverGuidePressedTarget(element, x, y, scale) {
  const guideElement = closestGuideableElement(element);
  if (!guideElement || !applianceCanvas) {
    return {
      pressedLabel: "the screen",
      pressedRect: {
        left: Math.max(0, x - 42),
        top: Math.max(0, y - 42),
        width: 84,
        height: 84,
      },
    };
  }
  const canvasRect = applianceCanvas.getBoundingClientRect();
  const elementRect = guideElement.getBoundingClientRect();
  const padding = 16;
  return {
    pressedLabel: receiverGuideElementLabel(guideElement),
    pressedRect: {
      left: (elementRect.left - canvasRect.left) / scale - padding,
      top: (elementRect.top - canvasRect.top) / scale - padding,
      width: elementRect.width / scale + padding * 2,
      height: elementRect.height / scale + padding * 2,
    },
  };
}

function closestGuideableElement(element) {
  const selector = "button, a, input, select, textarea, [role='button'], [data-action], [data-interpreter-action]";
  while (element && element.nodeType === 1) {
    if (element.matches?.(selector)) return element;
    element = element.parentElement;
  }
  return null;
}

function receiverGuideElementLabel(element) {
  return String(
    element?.getAttribute?.("aria-label") ||
      element?.textContent ||
      element?.value ||
      "this button"
  ).trim().replace(/\s+/g, " ").slice(0, 120) || "this button";
}

function clearReceiverGuideTarget(guideId = "") {
  if (guideId && state.activeGuideTarget?.guideId && state.activeGuideTarget.guideId !== guideId) return;
  state.activeGuideTarget = null;
  receiverGuideLayer?.classList.add("hidden");
  if (receiverGuideLayer) {
    receiverGuideLayer.innerHTML = "";
  }
}

function completeReceiverGuideTarget(target, completion = {}) {
  clearReceiverGuideTarget(target.guideId || "");
  if (!target.guideId) return;
  localApi(`/receivers/${encodeURIComponent(activeReceiverId())}/guide-target/${encodeURIComponent(target.guideId)}/complete`, {
    method: "POST",
    body: JSON.stringify({
      source: "receiver",
      pressedLabel: completion.pressedLabel || "",
      pressedRect: completion.pressedRect || null,
      matchedTarget: Boolean(completion.matchedTarget),
    }),
  }).catch(() => {
    // The local clear already happened; server completion can catch up later.
  });
}

function updateCallFromEvent(event) {
  if (!state.activeCall || state.activeCall.callId !== event.callId) return;
  state.activeCall = { ...state.activeCall, ...event };

  if (event.state === "hung_up" || event.state === "declined" || event.state === "receiver_unavailable") {
    stopIncomingRing();
    closeModal();
    setStatus(callStateStatus(event));
    state.activeCall = null;
    return;
  }

  if (event.state === "answered" || event.state === "connected") {
    stopIncomingRing();
    renderIncomingCallModal();
  }
  setStatus(callStateStatus(event));
}

function openIncomingCall(call) {
  state.activeCall = {
    callId: call.callId,
    callerName: call.callerName || "Andrew",
    recipientName: call.recipientName || receiverModel.careVipName,
    state: "ringing",
  };
  if (state.settings.retroSounds && state.settings.retroRingers) {
    startIncomingRing();
  }
  renderIncomingCallModal();
  setStatus(`${state.activeCall.callerName} is calling.`);
}

function renderIncomingCallModal() {
  const call = state.activeCall;
  if (!call) return;
  const caller = escapeHtml(call.callerName);
  const connected = call.state === "answered" || call.state === "connected";
  openModal(`
    <section class="incoming-call-panel ${connected ? "connected" : "ringing"}" aria-live="assertive">
      <p class="incoming-call-kicker">${connected ? "Call Connected" : "Call Coming In"}</p>
      <h2>${connected ? caller : caller}</h2>
      <p class="incoming-call-copy">${connected ? "You are connected now." : "Press Answer to talk now."}</p>
    </section>
    ${
      connected
        ? `<button class="modal-button danger incoming-call-end" type="button" data-action="hang-up">Hang Up</button>`
        : `
          <div class="incoming-call-actions">
            <button class="modal-button incoming-call-answer" type="button" data-action="answer">Answer</button>
            <button class="modal-button secondary incoming-call-not-now" type="button" data-action="decline">Not Now</button>
          </div>
        `
    }
  `);
  modalPanel.classList.add("incoming-call-modal");

  const answer = modalPanel.querySelector('[data-action="answer"]');
  if (answer) {
    answer.addEventListener("click", () => {
      playButtonBeep();
      reportCallState(call.callId, "answered");
      window.setTimeout(() => reportCallState(call.callId, "connected"), 250);
      stopIncomingRing();
      state.activeCall = { ...state.activeCall, state: "connected" };
      renderIncomingCallModal();
      setStatus(`Connected to ${call.callerName}.`);
    });
  }

  const decline = modalPanel.querySelector('[data-action="decline"]');
  if (decline) {
    decline.addEventListener("click", () => {
      playButtonBeep();
      reportCallState(call.callId, "declined");
      stopIncomingRing();
      closeModal();
      state.activeCall = null;
      setStatus(`Call from ${call.callerName} was not answered.`);
    });
  }

  const hangUp = modalPanel.querySelector('[data-action="hang-up"]');
  if (hangUp) {
    hangUp.addEventListener("click", () => {
      playButtonBeep();
      reportCallState(call.callId, "hung_up");
      stopIncomingRing();
      closeModal();
      state.activeCall = null;
      setStatus(`Call with ${call.callerName} ended.`);
    });
  }
}

function startIncomingRing() {
  stopIncomingRing();
  playIncomingRing();
  state.incomingRingTimer = window.setInterval(() => {
    if (!state.activeCall || state.activeCall.state !== "ringing") {
      stopIncomingRing();
      return;
    }
    playIncomingRing();
  }, incomingRingRepeatMs);
}

function playIncomingRing() {
  playAudio(audioPack.incoming, {
    enhanceSpeech: false,
    stopActive: false,
    source: "receiver_incoming_call_ring",
  });
}

function stopIncomingRing() {
  window.clearInterval(state.incomingRingTimer);
  state.incomingRingTimer = null;
  stopActiveAudio();
}

function reportCallState(callId, nextState) {
  // TODO: replace local state write with POST /api/connect/calls/:callId/state.
  return localApi(`/calls/${encodeURIComponent(callId)}/state`, {
    method: "POST",
    body: JSON.stringify({ state: nextState }),
  }).catch(() => {
    setStatus("Could not update call state on the local server.");
  });
}

function callStateStatus(call) {
  const name = call.callerName || "Caller";
  if (call.state === "answered" || call.state === "connected") return `Connected to ${name}.`;
  if (call.state === "declined") return `Call from ${name} was not answered.`;
  if (call.state === "hung_up") return `Call with ${name} ended.`;
  if (call.state === "receiver_unavailable") return "Receiver unavailable.";
  return `${name} is calling.`;
}

function normalizeServerMessage(message) {
  return {
    id: message.id,
    from: message.from || "receiver_user",
    to: message.to || receiverModel.careVipName,
    messageType: message.messageType || "text",
    body: message.body || "",
    transcript: message.transcript || "",
    transcriptStatus: message.transcriptStatus || "not_requested",
    audioUrl: absoluteLocalApiUrl(message.audioUrl || ""),
    audioArtifactId: message.audioArtifactId || "",
    audioDurationMs: message.audioDurationMs || 0,
    heardAt: message.heardAt || "",
    createdAt: message.createdAt || new Date().toISOString(),
    source: message.source || "receiver",
  };
}

function mergeMessages(serverMessages, fallbackMessages) {
  const seen = new Set();
  return [...serverMessages, ...fallbackMessages].filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

function openReminder(reminder) {
  // TODO: replace mock reminder with GET /api/connect/receiver/reminders/due.
  state.activeReminder = reminder;
  openModal(`
    <h2>${escapeHtml(reminder.name)}</h2>
    <p class="reader-text">${escapeHtml(reminder.message)}</p>
    <button class="modal-button" type="button" data-action="okay">OKAY</button>
    <button class="modal-button secondary" type="button" data-action="snooze">REMIND ME LATER</button>
  `);
  modalPanel.querySelector('[data-action="okay"]').addEventListener("click", () => {
    playButtonBeep();
    closeModal();
    setStatus("Reminder acknowledged.");
  });
  modalPanel.querySelector('[data-action="snooze"]').addEventListener("click", () => {
    playButtonBeep();
    closeModal();
    setStatus(`Reminder snoozed for ${reminder.snoozeMinutes} minutes.`);
  });

  speak(reminder.message);
}

function openContactPanel(contact = selectedContact(), initialText = "") {
  cancelContactRecording();
  state.contactRecordingResult = null;
  persistActiveConversation({ type: "contact_input", contactId: contact.id, text: initialText || "" });
  const canCall = contactCanCallNow(contact);
  openModal(`
    <div class="modal-title-row">
      <h2>${escapeHtml(contactTitle(contact, canCall))}</h2>
      <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
    </div>
    ${canCall ? "" : `
      <p class="diagnostic-text contact-availability">
        ${escapeHtml(contact.displayName)} is unavailable right now.
      </p>
    `}
    <textarea class="request-input contact-input" data-contact-input placeholder="Type your message here"></textarea>
    <button class="modal-button secondary recovery-record" type="button" data-action="record-contact">
      <span class="retro-mic" aria-hidden="true"><span></span></span>
      Record Message
    </button>
    <p class="diagnostic-text hidden" data-contact-recording-status></p>
    <button class="modal-button request-submit inactive" type="button" data-action="send-contact">Type or record first</button>
    ${canCall ? `
      <button class="modal-button secondary contact-call-button" type="button" data-action="call-contact">
        Call ${escapeHtml(contact.displayName)}
      </button>
    ` : ""}
  `);
  modalPanel.classList.add("contact-panel");
  const input = modalPanel.querySelector("[data-contact-input]");
  const submitButton = modalPanel.querySelector('[data-action="send-contact"]');
  const recordingStatus = modalPanel.querySelector("[data-contact-recording-status]");
  if (initialText) {
    input.value = initialText;
  }
  updateContactSubmitButton(submitButton, input.value);

  let contactUpdateTimer = 0;
  input.addEventListener("input", () => {
    clearInputStatus(input, "Type your message here");
    state.contactRecordingResult = null;
    window.clearTimeout(contactUpdateTimer);
    contactUpdateTimer = window.setTimeout(() => {
      updateContactSubmitButton(submitButton, input.value);
      persistActiveConversation({ type: "contact_input", contactId: contact.id, text: input.value });
    }, 700);
  });
  modalPanel.querySelector('[data-action="record-contact"]').addEventListener("click", () => {
    toggleContactRecording(contact, input, submitButton, recordingStatus);
  });
  submitButton.addEventListener("click", () => {
    sendContactMessage(contact, {
      text: input.value,
      recording: state.contactRecordingResult,
    });
  });
  const callContactButton = modalPanel.querySelector('[data-action="call-contact"]');
  if (callContactButton) {
    callContactButton.addEventListener("click", () => {
      playButtonBeep();
      cancelContactRecording();
      clearActiveConversation();
      closeModal();
      callContact(contact.displayName);
    });
  }
  modalPanel.querySelector('[data-action="close"]').addEventListener("click", () => {
    playButtonBeep();
    cancelContactRecording();
    clearActiveConversation();
    closeModal();
  });
}

function contactCanCallNow(contact) {
  return Boolean(contact?.canCall !== false && contact?.availability === "free");
}

function contactTitle(contact, canCall) {
  if (!canCall) return `Send a message to ${contact.displayName}`;
  return `Tell ${contact.displayName} something`;
}

function updateContactSubmitButton(button, rawText) {
  const hasText = Boolean(String(rawText || "").trim());
  const hasAudio = Boolean(state.contactRecordingResult?.blob);
  button.textContent = hasText || hasAudio ? "Send Message" : "Type or record first";
  button.classList.toggle("inactive", !(hasText || hasAudio));
}

async function toggleContactRecording(contact, input, submitButton, status) {
  if (state.activeContactRecording?.state === "recording") {
    const recording = await stopContactRecording();
    await transcribeContactRecording(contact, recording, input, submitButton, status);
    return;
  }

  if (!browserAudioRecordingAvailable()) {
    showRecordingStatus(status, "Recording is not available on this browser. Typing still works.", input);
    return;
  }

  try {
    state.contactRecordingResult = null;
    setInputStatus(input, "Listening...", { clearValue: !String(input.value || "").trim() });
    updateContactSubmitButton(submitButton, input.value);
    state.activeContactRecording = await startBrowserAudioRecording({
      ...receiverRecordingOptions,
      onAutoStop: (reason) => {
        finishContactRecordingAfterAutoStop(contact, input, submitButton, status, reason);
      },
    });
    showRecordingStatus(status, "Recording. Tap again to stop.", input);
    const recordButton = modalPanel.querySelector('[data-action="record-contact"]');
    if (recordButton) {
      setRecordRequestButtonLabel(recordButton, "Stop Recording");
    }
  } catch {
    showRecordingStatus(status, "Recording could not start. Typing still works.", input);
  }
}

async function finishContactRecordingAfterAutoStop(contact, input, submitButton, status, reason) {
  if (!state.activeContactRecording) return;
  showRecordingStatus(status, reason === "silence" ? "Got it. Turning recording into text..." : "Time is up. Turning recording into text...", input);
  const recording = await stopContactRecording();
  await transcribeContactRecording(contact, recording, input, submitButton, status);
}

async function stopContactRecording() {
  const active = state.activeContactRecording;
  if (!active) return state.contactRecordingResult;
  const recording = await active.stop();
  state.activeContactRecording = null;
  state.contactRecordingResult = recording?.size ? recording : null;
  const recordButton = modalPanel.querySelector('[data-action="record-contact"]');
  if (recordButton) {
    setRecordRequestButtonLabel(recordButton, "Record Again");
  }
  return state.contactRecordingResult;
}

function cancelContactRecording() {
  if (state.activeContactRecording) {
    state.activeContactRecording.cancel();
  }
  state.activeContactRecording = null;
}

async function transcribeContactRecording(contact, recording, input, submitButton, status) {
  if (!recording?.blob) {
    showRecordingStatus(status, "Recording was empty. Try again or type your message.", input);
    updateContactSubmitButton(submitButton, input.value);
    return;
  }

  showRecordingStatus(status, "Turning recording into text...", input);
  try {
    const transcription = await requestAudioTranscription(recording, {
      baseUrl: state.localServerUrl,
      receiverId: activeReceiverId(),
      source: "contact-message-draft",
      artifactKind: "receiver_message",
      audioDirection: "receiver_local_input",
    });
    const transcript = String(transcription.transcript || "").trim();
    state.contactRecordingResult = {
      ...recording,
      artifactId: transcription.artifactId || "",
      audioUrl: transcription.audioUrl || "",
      transcript,
      transcriptStatus: transcription.transcriptStatus || "not_requested",
      clientAudioCaptureId: transcription.clientAudioCaptureId || "",
    };
    if (transcript) {
      clearInputStatus(input, "Type your message here");
      input.value = transcript;
      persistActiveConversation({ type: "contact_input", contactId: contact.id, text: input.value, inputMethod: "voice_transcript" });
      hideRecordingStatus(status);
    } else {
      showRecordingStatus(status, transcriptionFallbackText(transcription.transcriptStatus), input);
    }
  } catch {
    state.contactRecordingResult = recording;
    showRecordingStatus(status, "Recording saved. You can send it or type your message.", input);
  }
  updateContactSubmitButton(submitButton, input.value);
}

async function sendContactMessage(contact, input = {}) {
  const text = String(input.text || "").trim();
  const recording = input.recording;
  if (!text && !recording?.blob) {
    setStatus("Type or record your message first.");
    return;
  }

  const message = recording?.blob
    ? await sendContactAudioMessage(contact, text, recording)
    : await sendContactTextMessage(contact, text);
  if (!message) return;

  state.messages.unshift(message);
  state.focusedMessageIndex = 0;
  cancelContactRecording();
  state.contactRecordingResult = null;
  clearActiveConversation();
  renderWorkspace();
  showContactSentConfirmation(contact);
  setStatus(`Message sent to ${contact.displayName}.`);
}

async function sendContactAudioMessage(contact, text, recording) {
  try {
    const uploaded = await sendAudioMessage(recording, {
      baseUrl: state.localServerUrl,
      receiverId: activeReceiverId(),
      from: "receiver_user",
      to: contact.displayName,
      body: text || recording.transcript || "Voice message",
      clientMessageId: `contact-audio-${Date.now()}`,
      source: "receiver_contact_message",
      artifactKind: "receiver_message",
      audioDirection: "receiver_to_coordinator",
      clientAudioCaptureId: recording.clientAudioCaptureId || "",
    });
    return normalizeServerMessage(uploaded.message);
  } catch {
    setStatus("Audio could not upload. Sending the typed message if available.");
    if (text) {
      return sendContactTextMessage(contact, text);
    }
    return localContactMessage(contact, "Voice message", { messageType: "audio" });
  }
}

async function sendContactTextMessage(contact, text) {
  try {
    const payload = await localApi("/messages", {
      method: "POST",
      body: JSON.stringify({
        receiverId: activeReceiverId(),
        from: "receiver_user",
        to: contact.displayName,
        body: text,
        messageType: "text",
        source: "receiver_contact_message",
      }),
    });
    return normalizeServerMessage(payload.message);
  } catch {
    return localContactMessage(contact, text);
  }
}

function localContactMessage(contact, body, options = {}) {
  return {
    id: `message-contact-${Date.now()}`,
    from: "receiver_user",
    to: contact.displayName,
    receiverId: activeReceiverId(),
    messageType: options.messageType || "text",
    body,
    transcript: "",
    transcriptStatus: "not_requested",
    audioUrl: "",
    audioDurationMs: 0,
    heardAt: "",
    createdAt: new Date().toISOString(),
    source: "receiver_contact_message",
  };
}

function showContactSentConfirmation(contact) {
  openModal(`
    <div class="modal-title-row">
      <h2>Message Sent</h2>
      <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
    </div>
    <p class="reader-text">Your message was sent to ${escapeHtml(contact.displayName)}.</p>
  `);
  modalPanel.querySelector('[data-action="close"]').addEventListener("click", () => {
    playButtonBeep();
    closeModal();
  });
}

function openSettings(initialText = "", options = {}) {
  cancelAskInputRecording();
  state.askRecordingResult = null;
  persistActiveConversation({ type: "ask_input", text: initialText || "" });
  const voiceFirst = Boolean(options.voiceFirst);
  const suggestions = getReceiverAskSuggestions(receiverAskContext());
  openModal(`
    <div class="modal-title-row">
      <h2>${voiceFirst ? "Recording your voice" : "What would you like to do?"}</h2>
      <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
    </div>
    ${voiceFirst ? "" : '<p class="modal-copy">Type anything, or click a button.</p>'}
    <textarea class="request-input" data-request-input placeholder="Example: I need milk"></textarea>
    ${
      voiceFirst
        ? ""
        : `<div class="request-examples" aria-label="Examples">
            ${suggestions.map((suggestion) => requestExampleButton(suggestion)).join("")}
          </div>`
    }
    <button class="modal-button secondary recovery-record" type="button" data-action="record-request">
      <span class="retro-mic" aria-hidden="true"><span></span></span>
      ${voiceFirst ? "Stop Recording" : "Record Request"}
    </button>
    <p class="diagnostic-text hidden" data-request-recording-status></p>
    <button class="modal-button request-submit inactive" type="button" data-action="send-request">Type your request</button>
  `);
  const requestInput = modalPanel.querySelector("[data-request-input]");
  const submitButton = modalPanel.querySelector('[data-action="send-request"]');
  const recordingStatus = modalPanel.querySelector("[data-request-recording-status]");
  if (initialText) {
    requestInput.value = initialText;
    updateRequestSubmitButton(submitButton, requestInput.value);
  }
  let requestUpdateTimer = 0;
  requestInput.addEventListener("input", () => {
    clearInputStatus(requestInput, "Example: I need milk");
    state.askRecordingResult = null;
    window.clearTimeout(requestUpdateTimer);
    requestUpdateTimer = window.setTimeout(() => {
      updateRequestSubmitButton(submitButton, requestInput.value);
      persistActiveConversation({ type: "ask_input", text: requestInput.value });
    }, 1500);
  });
  modalPanel.querySelectorAll("[data-request-example]").forEach((button) => {
    button.addEventListener("click", () => {
      playButtonBeep();
      if (button.classList.contains("selected")) {
        routeReceiverAskRequest(button.dataset.requestExample, {
          method: "suggestion_button",
          selectedSuggestion: button.dataset.requestExample,
        });
        return;
      }
      modalPanel.querySelectorAll("[data-request-example]").forEach((exampleButton) => {
        exampleButton.classList.toggle("selected", exampleButton === button);
      });
      clearInputStatus(requestInput, "Example: I need milk");
      requestInput.value = button.dataset.requestExample;
      state.askRecordingResult = null;
      updateRequestSubmitButton(submitButton, requestInput.value);
      persistActiveConversation({ type: "ask_input", text: requestInput.value });
    });
  });
  modalPanel.querySelector('[data-action="record-request"]').addEventListener("click", () => {
    toggleAskInputRecording(requestInput, submitButton, recordingStatus);
  });
  submitButton.addEventListener("click", () => {
    routeReceiverAskRequest(requestInput.value, {
      method: state.askRecordingResult?.transcript ? "voice_transcript" : "typed",
    });
  });
  modalPanel.querySelector('[data-action="close"]').addEventListener("click", () => {
    playButtonBeep();
    cancelAskInputRecording();
    clearActiveConversation();
    closeModal();
  });
  if (voiceFirst) {
    toggleAskInputRecording(requestInput, submitButton, recordingStatus);
  }
}

function requestExampleButton(text) {
  return `
    <button class="request-example" type="button" data-request-example="${escapeHtml(text)}">
      ${escapeHtml(text)}
    </button>
  `;
}

function updateRequestSubmitButton(button, rawText) {
  const cleanText = String(rawText || "").trim().replace(/\s+/g, " ");
  if (!cleanText) {
    button.textContent = "Type your request";
    button.classList.add("inactive");
    return;
  }
  button.textContent = requestReadyButtonLabel;
  button.classList.remove("inactive");
}

async function toggleAskInputRecording(input, submitButton, status) {
  if (state.activeAskRecording?.state === "recording") {
    const recording = await stopAskInputRecording();
    await transcribeAskInputRecording(recording, input, submitButton, status);
    return;
  }

  if (!browserAudioRecordingAvailable()) {
    showRecordingStatus(status, "Recording is not available on this browser. Typing still works.", input);
    return;
  }

  try {
    state.askRecordingResult = null;
    setInputStatus(input, "Listening...", { clearValue: true });
    updateRequestSubmitButton(submitButton, input.value);
    state.activeAskRecording = await startBrowserAudioRecording({
      ...receiverRecordingOptions,
      onAutoStop: (reason) => {
        finishAskInputRecordingAfterAutoStop(input, submitButton, status, reason);
      },
    });
    showRecordingStatus(status, "Recording. Tap again to stop.", input);
    const recordButton = modalPanel.querySelector('[data-action="record-request"]');
    if (recordButton) {
      setRecordRequestButtonLabel(recordButton, "Stop Recording");
    }
  } catch {
    showRecordingStatus(status, "Recording could not start. Typing still works.", input);
  }
}

async function finishAskInputRecordingAfterAutoStop(input, submitButton, status, reason) {
  if (!state.activeAskRecording) return;
  showRecordingStatus(status, reason === "silence" ? "Got it. Turning recording into text..." : "Time is up. Turning recording into text...", input);
  const recording = await stopAskInputRecording();
  await transcribeAskInputRecording(recording, input, submitButton, status);
}

async function stopAskInputRecording() {
  const active = state.activeAskRecording;
  if (!active) return state.askRecordingResult;
  const recording = await active.stop();
  state.activeAskRecording = null;
  state.askRecordingResult = recording?.size ? recording : null;
  const recordButton = modalPanel.querySelector('[data-action="record-request"]');
  if (recordButton) {
    setRecordRequestButtonLabel(recordButton, "Record Again");
  }
  return state.askRecordingResult;
}

function setRecordRequestButtonLabel(button, label) {
  if (!button) return;
  button.innerHTML = `<span class="retro-mic" aria-hidden="true"><span></span></span>${escapeHtml(label)}`;
}

function cancelAskInputRecording() {
  if (state.activeAskRecording) {
    state.activeAskRecording.cancel();
  }
  state.activeAskRecording = null;
}

async function transcribeAskInputRecording(recording, input, submitButton, status) {
  if (!recording?.blob) {
    showRecordingStatus(status, "Recording was empty. Try again or type your request.", input);
    return;
  }

  showRecordingStatus(status, "Turning recording into text...", input);
  try {
    const transcription = await requestAudioTranscription(recording, {
      baseUrl: state.localServerUrl,
      receiverId: activeReceiverId(),
      source: "ask-input",
      artifactKind: "ask_input",
      audioDirection: "receiver_local_input",
    });
    const transcript = String(transcription.transcript || "").trim();
    state.askRecordingResult = {
      ...recording,
      artifactId: transcription.artifactId || "",
      audioUrl: transcription.audioUrl || "",
      transcript,
      transcriptStatus: transcription.transcriptStatus || "not_requested",
      clientAudioCaptureId: transcription.clientAudioCaptureId || "",
    };
    if (transcript) {
      clearInputStatus(input, "Example: I need milk");
      input.value = transcript;
      updateRequestSubmitButton(submitButton, input.value);
      persistActiveConversation({ type: "ask_input", text: input.value, inputMethod: "voice_transcript" });
      hideRecordingStatus(status);
      return;
    }
    showRecordingStatus(status, transcriptionFallbackText(transcription.transcriptStatus), input);
  } catch {
    showRecordingStatus(status, "Recording could not be turned into text. Typing still works.", input);
  }
}

function transcriptionFallbackText(status) {
  if (status === "not_configured") {
    return "Recording saved, but transcription is not set up here. Typing still works.";
  }
  return "I could not turn that recording into text. Try again or type your request.";
}

function setInputStatus(input, text, options = {}) {
  if (!input) return;
  if (options.clearValue) {
    input.value = "";
  }
  input.placeholder = text;
  input.classList.add("status-placeholder");
}

function clearInputStatus(input, fallbackPlaceholder = "Type here") {
  if (!input) return;
  input.placeholder = fallbackPlaceholder;
  input.classList.remove("status-placeholder");
}

function showRecordingStatus(status, text, input = null) {
  if (input) {
    setInputStatus(input, text, { clearValue: !String(input.value || "").trim() });
    hideRecordingStatus(status);
    return;
  }
  if (!status) return;
  status.classList.remove("hidden");
  status.textContent = text;
}

function hideRecordingStatus(status) {
  if (!status) return;
  status.classList.add("hidden");
  status.textContent = "";
}

function routeReceiverAskRequest(rawText, options = {}) {
  const cleanText = String(rawText || "").trim();
  if (!cleanText) {
    setStatus("Type your request first.");
    return;
  }

  startAskTrace(cleanText, options.method || "typed", options.selectedSuggestion || null);
  if (state.askRecordingResult?.artifactId) {
    appendAskTrace(ConnectAskEventType.AUDIO_CAPTURED, askRecordingTracePayload(state.askRecordingResult));
    appendAskTrace(ConnectAskEventType.AUDIO_TRANSCRIBED, askRecordingTracePayload(state.askRecordingResult));
  }
  const result = interpretReceiverAskRequest(cleanText, receiverAskContext());
  appendAskTrace(ConnectAskEventType.INTERPRETATION_RETURNED, {
    intent: result.intent,
    answerType: result.answerType,
    confidence: result.confidence,
    receiverMessage: result.receiverMessage,
    buttons: result.buttons,
    proposedAction: result.proposedAction,
  });
  showAskInterpretation(result);
}

function askRecordingTracePayload(recording) {
  if (!recording) return null;
  return {
    clientAudioCaptureId: recording.clientAudioCaptureId || "",
    artifactId: recording.artifactId || "",
    audioUrl: recording.audioUrl || "",
    audioMimeType: recording.mimeType || recording.audioMimeType || "",
    audioDurationMs: recording.durationMs || recording.audioDurationMs || 0,
    transcript: recording.transcript || "",
    transcriptStatus: recording.transcriptStatus || "",
    artifactKind: "ask_input",
    audioDirection: "receiver_local_input",
  };
}

function showAskInterpretation(result, options = {}) {
  result = refreshAskResult(result);
  if (!options.restoring) {
    persistActiveConversation({ type: "ask_result", result });
  }
  if (result.answerType === "clarification" || result.answerType === "low_confidence") {
    appendAskTrace(ConnectAskEventType.ANSWER_SHOWN, {
      answerType: result.answerType,
      receiverMessage: result.receiverMessage,
      buttons: result.buttons,
    });
    showClarificationResult(result);
    return;
  }
  if (result.intent === "appointment_question") {
    appendAskTrace(ConnectAskEventType.ANSWER_SHOWN, {
      answerType: result.answerType,
      receiverMessage: result.receiverMessage,
      buttons: result.buttons,
    });
    showAppointmentAskResult(result);
    return;
  }

  const action = result.proposedAction || {};
  const body = action.body || result.rawText || "";
  const buttons = result.buttons || [];
  appendAskTrace(ConnectAskEventType.ANSWER_SHOWN, {
    answerType: result.answerType,
    receiverMessage: result.receiverMessage,
    buttons,
  });
  openModal(`
    <div class="modal-title-row">
      <h2>${escapeHtml(intentTitle(result.intent))}</h2>
      <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
    </div>
    <p class="interpreter-message">${escapeHtml(result.receiverMessage)}</p>
    ${body ? `<blockquote class="interpreter-quote">${escapeHtml(body)}</blockquote>` : ""}
    <div class="interpreter-actions">
      ${buttons.map((button) => interpreterButton(button)).join("")}
    </div>
  `);
  modalPanel.querySelectorAll("[data-interpreter-action]").forEach((button) => {
    button.addEventListener("click", () => {
      playButtonBeep();
      handleInterpreterAction(button.dataset.interpreterAction, result, {
        followupPrompt: button.dataset.followupPrompt || "",
        label: button.textContent.trim(),
      });
    });
  });
  modalPanel.querySelector('[data-action="close"]').addEventListener("click", () => {
    playButtonBeep();
    clearActiveConversation();
    closeModal();
  });
}

function showClarificationResult(result) {
  const lowConfidence = result.answerType === "low_confidence";
  openModal(`
    <div class="modal-title-row asked-title-row">
      <div class="asked-header">
        <span>You asked:</span>
        <strong>${escapeHtml(result.rawText)}</strong>
      </div>
      <button class="modal-button secondary title-back" type="button" data-action="back">${lowConfidence ? "Exit this" : "Go Back"}</button>
    </div>
    <p class="interpreter-message">${escapeHtml(result.receiverMessage)}</p>
    <div class="interpreter-actions">
      ${clarificationButtons(result)}
    </div>
  `);
  modalPanel.classList.add("appointment-ask-panel");
  modalPanel.querySelectorAll("[data-interpreter-action]").forEach((button) => {
    button.addEventListener("click", () => {
      playButtonBeep();
      handleInterpreterAction(button.dataset.interpreterAction, result, {
        followupPrompt: button.dataset.followupPrompt || "",
        label: button.textContent.trim(),
      });
    });
  });
  modalPanel.querySelector('[data-action="back"]').addEventListener("click", () => {
    playButtonBeep();
    if (lowConfidence) {
      clearActiveConversation();
      closeModal();
      completeAskTrace(ConnectAskOutcome.ABANDONED, { action: "exit_low_confidence" });
      return;
    }
    openSettings(result.rawText || "");
  });
}

function clarificationButtons(result) {
  const buttons = Array.isArray(result.buttons) ? result.buttons : [];
  return buttons.map((button) => {
    const isCall = button.action === "call_contact";
    const isSend = button.action === "confirm_send";
    const className = isCall || isSend ? "modal-button" : "modal-button secondary";
    return `
      <button
        class="${className}"
        type="button"
        data-interpreter-action="${escapeHtml(button.action)}"
        ${button.prompt ? `data-followup-prompt="${escapeHtml(button.prompt)}"` : ""}
      >
        ${escapeHtml(button.label)}
      </button>
    `;
  }).join("");
}

function showAppointmentAskResult(result) {
  result = refreshAskResult(result);
  persistActiveConversation({ type: "ask_result", result });
  const admin = adminContact();
  openModal(`
    <div class="modal-title-row asked-title-row">
      <div class="asked-header">
        <span>You asked:</span>
        <strong>${escapeHtml(result.rawText)}</strong>
      </div>
      <button class="modal-button secondary title-back" type="button" data-action="back">Go Back</button>
    </div>
    <p class="interpreter-message">${escapeHtml(result.receiverMessage)}</p>
    <textarea class="request-input followup-input" data-followup-input placeholder="Type more here"></textarea>
    <button class="modal-button request-submit inactive" type="button" data-action="followup">Type your request</button>
    <div class="interpreter-actions">
      ${appointmentInterpreterButtons(result, admin.displayName)}
    </div>
  `);
  modalPanel.classList.add("appointment-ask-panel");

  const followupInput = modalPanel.querySelector("[data-followup-input]");
  const followupButton = modalPanel.querySelector('[data-action="followup"]');
  let followupTimer = 0;
  followupInput.addEventListener("input", () => {
    window.clearTimeout(followupTimer);
    followupTimer = window.setTimeout(() => {
      updateRequestSubmitButton(followupButton, followupInput.value);
    }, 900);
  });
  followupButton.addEventListener("click", () => {
    appendAskTrace(ConnectAskEventType.FOLLOWUP_INPUT_CAPTURED, {
      text: followupInput.value,
      parentQuestion: result.rawText,
    });
    routeReceiverAskRequest(followupInput.value, { method: "followup_typed" });
  });
  modalPanel.querySelectorAll("[data-interpreter-action]").forEach((button) => {
    button.addEventListener("click", () => {
      playButtonBeep();
      handleInterpreterAction(button.dataset.interpreterAction, result, {
        label: button.textContent.trim(),
      });
    });
  });
  modalPanel.querySelector('[data-action="back"]').addEventListener("click", () => {
    playButtonBeep();
    openSettings(result.rawText || "");
  });
}

function refreshAskResult(result) {
  if (!result?.rawText) return result;
  return interpretReceiverAskRequest(result.rawText, receiverAskContext());
}

function appointmentInterpreterButtons(result, adminName) {
  const sourceButtons = Array.isArray(result.buttons) && result.buttons.length
    ? result.buttons
    : [
        { label: "That answered my question", action: "done" },
        { label: "This wasn't helpful", action: "not_helpful" },
        { label: `Ask ${adminName}`, action: "confirm_send" },
      ];
  const buttons = [
    ...sourceButtons.filter((button) => button.action !== "confirm_send"),
    ...sourceButtons.filter((button) => button.action === "confirm_send"),
  ];
  return buttons.map((button) => {
    let className = "modal-button secondary";
    if (button.action === "confirm_send") {
      className = "modal-button";
    } else if (button.action === "done") {
      className = "modal-button request-submit inactive";
    }
    return `
      <button
        class="${className}"
        type="button"
        data-interpreter-action="${escapeHtml(button.action)}"
        ${button.prompt ? `data-followup-prompt="${escapeHtml(button.prompt)}"` : ""}
      >
        ${escapeHtml(button.label)}
      </button>
    `;
  }).join("");
}

function interpreterButton(button) {
  const tone = button.action === "confirm_send" || button.action === "call_contact" || button.action === "done"
    ? ""
    : "secondary";
  return `
    <button class="modal-button ${tone}" type="button" data-interpreter-action="${escapeHtml(button.action)}">
      ${escapeHtml(button.label)}
    </button>
  `;
}

function handleInterpreterAction(action, result, options = {}) {
  appendAskTrace(ConnectAskEventType.BUTTON_SELECTED, {
    action,
    label: options.label || "",
    intent: result.intent,
    answerType: result.answerType,
  });
  if (action === "confirm_send") {
    const message = sendReceiverAskMessage(result);
    if (message) {
      appendAskTrace(ConnectAskEventType.MESSAGE_ESCALATED, {
        to: message.to,
        body: message.body,
        source: message.source,
      });
      clearActiveConversation();
      showRequestConfirmation(message.to);
      completeAskTrace(ConnectAskOutcome.ESCALATED, { to: message.to });
    }
    return;
  }
  if (action === "call_contact") {
    const contact = contactByName(result.proposedAction?.recipientName) || adminContact();
    clearActiveConversation();
    closeModal();
    state.selectedContactId = contact.id;
    saveStoredRuntimeState();
    render();
    setStatus(`Calling ${contact.displayName}.`);
    appendAskTrace(ConnectAskEventType.CALL_ESCALATED, { to: contact.displayName });
    completeAskTrace(ConnectAskOutcome.ESCALATED, { to: contact.displayName, mode: "call" });
    return;
  }
  if (action === "edit") {
    openSettings(result.rawText || "");
    const input = modalPanel.querySelector("[data-request-input]");
    const submit = modalPanel.querySelector('[data-action="send-request"]');
    if (input) {
      updateRequestSubmitButton(submit, input.value);
      input.focus();
    }
    return;
  }
  if (action === "record_request") {
    openSettings("");
    setStatus("Tap Record Request to say what you need.");
    return;
  }
  if (action === "choose_appointment") {
    persistActiveConversation({ type: "appointment_chooser_from_ask", result });
    openAppointmentsPanel({ returnTo: () => showAppointmentAskResult(result) });
    return;
  }
  if (action === "ask_followup") {
    routeReceiverAskRequest(options.followupPrompt || result.rawText || "");
    return;
  }
  if (action === "show_week") {
    showWeekContextPanel(result);
    return;
  }
  if (action === "context_not_quite_right") {
    openContextCorrectionPanel(result);
    return;
  }
  if (action === "not_helpful") {
    openAskRecoveryPanel(result);
    return;
  }
  if (action === "done") {
    clearActiveConversation();
    closeModal();
    completeAskTrace(ConnectAskOutcome.ANSWERED, { action });
    return;
  }
  clearActiveConversation();
  closeModal();
  completeAskTrace(ConnectAskOutcome.ANSWERED, { action });
}

function showRequestConfirmation(contactName) {
  openModal(`
    <div class="modal-title-row">
      <h2>Message Sent</h2>
      <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
    </div>
    <p class="reader-text">Your message was sent to ${escapeHtml(contactName)}.</p>
  `);
  modalPanel.querySelector('[data-action="close"]').addEventListener("click", () => {
    playButtonBeep();
    clearActiveConversation();
    closeModal();
  });
}

function showWeekContextPanel(result) {
  persistActiveConversation({
    type: "ask_week_context",
    result,
  });
  openModal(`
    <div class="modal-title-row asked-title-row">
      <div class="asked-header">
        <span>You asked:</span>
        <strong>${escapeHtml(result.rawText)}</strong>
      </div>
      <button class="modal-button secondary title-back" type="button" data-action="back">Go Back</button>
    </div>
    <p class="interpreter-message">This week, the next saved item is ${escapeHtml(nextAppointment.title)} ${escapeHtml(nextAppointment.dayLabel)} at ${escapeHtml(nextAppointment.timeLabel)}.</p>
    <div class="interpreter-actions">
      <button class="modal-button request-submit inactive" type="button" data-interpreter-action="done">That answered my question</button>
      <button class="modal-button secondary" type="button" data-interpreter-action="not_helpful">This wasn't helpful</button>
      <button class="modal-button" type="button" data-interpreter-action="confirm_send">Ask ${escapeHtml(adminContact().displayName)}</button>
    </div>
  `);
  modalPanel.classList.add("appointment-ask-panel");
  modalPanel.querySelectorAll("[data-interpreter-action]").forEach((button) => {
    button.addEventListener("click", () => {
      playButtonBeep();
      handleInterpreterAction(button.dataset.interpreterAction, result, {
        label: button.textContent.trim(),
      });
    });
  });
  modalPanel.querySelector('[data-action="back"]').addEventListener("click", () => {
    playButtonBeep();
    showClarificationResult(result);
  });
}

function openContextCorrectionPanel(result) {
  persistActiveConversation({
    type: "ask_context_correction",
    result,
  });
  const label = contextualCorrectionLabel(result.answerType);
  openModal(`
    <div class="modal-title-row">
      <h2>${escapeHtml(label.title)}</h2>
      <button class="modal-button secondary title-back" type="button" data-action="back">Go Back</button>
    </div>
    <p class="modal-copy recovery-question">${escapeHtml(label.prompt)}</p>
    <textarea class="request-input recovery-input" data-correction-input placeholder="Type here"></textarea>
    <button class="modal-button request-submit inactive" type="button" data-action="continue">Type your request</button>
  `);
  const input = modalPanel.querySelector("[data-correction-input]");
  const continueButton = modalPanel.querySelector('[data-action="continue"]');
  let correctionTimer = 0;
  input.addEventListener("input", () => {
    window.clearTimeout(correctionTimer);
    correctionTimer = window.setTimeout(() => {
      updateRequestSubmitButton(continueButton, input.value);
    }, 700);
  });
  continueButton.addEventListener("click", () => {
    const text = String(input.value || "").trim();
    if (!text) {
      setStatus("Type what should change first.");
      return;
    }
    routeReceiverAskRequest(text);
  });
  modalPanel.querySelector('[data-action="back"]').addEventListener("click", () => {
    playButtonBeep();
    showAskInterpretation(result);
  });
}

function contextualCorrectionLabel(answerType) {
  if (answerType === "appointment_bring_list") {
    return {
      title: "That's not what you need?",
      prompt: "What were you trying to find out?",
    };
  }
  if (answerType === "appointment_location") {
    return {
      title: "Wrong place?",
      prompt: "Which place did you mean?",
    };
  }
  if (answerType === "appointment_time") {
    return {
      title: "Wrong time?",
      prompt: "Which time did you need?",
    };
  }
  return {
    title: "Wrong appointment?",
    prompt: "Which appointment did you mean?",
  };
}

function openAskRecoveryPanel(result, initialText = "") {
  cancelAskRecoveryRecording();
  state.recoveryRecordingResult = null;
  appendAskTrace(ConnectAskEventType.RECOVERY_STARTED, {
    originalQuestion: result.rawText,
    intent: result.intent,
    answerShown: result.receiverMessage,
  });
  persistActiveConversation({
    type: "ask_recovery",
    result,
    clarificationText: initialText,
  });
  openModal(`
    <div class="modal-title-row">
      <h2>Sorry that wasn't the answer you needed.</h2>
      <button class="modal-button secondary title-back" type="button" data-action="back">Go Back</button>
    </div>
    <p class="modal-copy recovery-question">What were you really looking for?</p>
    <textarea class="request-input recovery-input" data-recovery-input placeholder="Type here">${escapeHtml(initialText)}</textarea>
    <button class="modal-button secondary recovery-record" type="button" data-action="record">
      <span class="retro-mic" aria-hidden="true"><span></span></span>
      Record What You Needed
    </button>
    <p class="diagnostic-text hidden" data-recovery-status></p>
    <button class="modal-button request-submit inactive" type="button" data-action="continue">Type or record first</button>
  `);

  const input = modalPanel.querySelector("[data-recovery-input]");
  const continueButton = modalPanel.querySelector('[data-action="continue"]');
  const status = modalPanel.querySelector("[data-recovery-status]");
  let recoveryTimer = 0;
  updateAskRecoveryContinueButton(continueButton, input.value);

  input.addEventListener("input", () => {
    clearInputStatus(input, "Type here");
    window.clearTimeout(recoveryTimer);
    recoveryTimer = window.setTimeout(() => {
      persistActiveConversation({
        type: "ask_recovery",
        result,
        clarificationText: input.value,
      });
      updateAskRecoveryContinueButton(continueButton, input.value);
    }, 600);
  });

  modalPanel.querySelector('[data-action="record"]').addEventListener("click", () => {
    toggleAskRecoveryRecording(result, input, continueButton, status);
  });
  continueButton.addEventListener("click", () => {
    const recoveryText = String(input.value || "").trim();
    if (!recoveryText && !state.recoveryRecordingResult?.localUrl) {
      setStatus("Type or record what you needed first.");
      return;
    }
    showAskRecoveryConfirmation(result, {
      clarificationText: recoveryText,
      clarificationAudioUrl: state.recoveryRecordingResult?.localUrl || null,
      recording: state.recoveryRecordingResult || null,
    });
  });
  modalPanel.querySelector('[data-action="back"]').addEventListener("click", () => {
    playButtonBeep();
    cancelAskRecoveryRecording();
    showAskInterpretation(result);
  });
}

function updateAskRecoveryContinueButton(button, text) {
  const hasText = Boolean(String(text || "").trim());
  const hasAudio = Boolean(state.recoveryRecordingResult?.localUrl);
  button.textContent = hasText || hasAudio ? requestReadyButtonLabel : "Type or record first";
  button.classList.toggle("inactive", !(hasText || hasAudio));
}

async function toggleAskRecoveryRecording(result, input, continueButton, status) {
  if (state.activeRecoveryRecording?.state === "recording") {
    const recording = await stopAskRecoveryRecording(result);
    showRecordingStatus(
      status,
      recording?.size ? "Recording saved. You can type more or continue." : "Recording was empty. Try again or type what you needed.",
      input
    );
    updateAskRecoveryContinueButton(continueButton, input.value);
    return;
  }

  if (!browserAudioRecordingAvailable()) {
    showRecordingStatus(status, "Recording is not available on this browser. Typing still works.", input);
    return;
  }

  try {
    state.recoveryRecordingResult = null;
    setInputStatus(input, "Listening...", { clearValue: !String(input.value || "").trim() });
    state.activeRecoveryRecording = await startBrowserAudioRecording({
      ...receiverRecordingOptions,
      onAutoStop: (reason) => {
        finishAskRecoveryRecordingAfterAutoStop(result, input, continueButton, status, reason);
      },
    });
    showRecordingStatus(status, "Recording. Tap again to stop.", input);
    modalPanel.querySelector('[data-action="record"]').textContent = "Stop Recording";
  } catch {
    showRecordingStatus(status, "Recording could not start. Typing still works.", input);
  }
}

async function stopAskRecoveryRecording(result = null) {
  const active = state.activeRecoveryRecording;
  if (!active) return state.recoveryRecordingResult;
  const recording = await active.stop();
  state.activeRecoveryRecording = null;
  state.recoveryRecordingResult = recording?.size ? recording : null;
  persistActiveConversation({
    type: "ask_recovery",
    result,
    clarificationText: modalPanel.querySelector("[data-recovery-input]")?.value || "",
    hasAudio: Boolean(state.recoveryRecordingResult),
  });
  return state.recoveryRecordingResult;
}

async function finishAskRecoveryRecordingAfterAutoStop(result, input, continueButton, status, reason) {
  if (!state.activeRecoveryRecording) return;
  const recording = await stopAskRecoveryRecording(result);
  showRecordingStatus(
    status,
    recording?.size
      ? reason === "silence"
        ? "Got it. You can type more or continue."
        : "Time is up. You can type more or continue."
      : "Recording was empty. Try again or type what you needed.",
    input
  );
  updateAskRecoveryContinueButton(continueButton, input.value);
}

function cancelAskRecoveryRecording() {
  if (state.activeRecoveryRecording) {
    state.activeRecoveryRecording.cancel();
  }
  state.activeRecoveryRecording = null;
}

function showAskRecoveryConfirmation(result, recoveryInput) {
  const admin = adminContact();
  persistActiveConversation({
    type: "ask_recovery_confirm",
    result,
    recoveryInput,
  });
  openModal(`
    <div class="modal-title-row">
      <h2>Send this to ${escapeHtml(admin.displayName)}?</h2>
      <button class="modal-button secondary title-back" type="button" data-action="back">Go Back</button>
    </div>
    ${recoveryInput.clarificationText ? `<blockquote class="interpreter-quote">${escapeHtml(recoveryInput.clarificationText)}</blockquote>` : ""}
    ${recoveryInput.clarificationAudioUrl ? `<p class="diagnostic-text">Audio clarification recorded.</p>` : ""}
    <div class="interpreter-actions">
      <button class="modal-button" type="button" data-action="send">Send to ${escapeHtml(admin.displayName)}</button>
      <button class="modal-button secondary" type="button" data-action="edit">Edit</button>
      <button class="modal-button secondary" type="button" data-action="cancel">Go Back</button>
    </div>
  `);
  modalPanel.querySelector('[data-action="send"]').addEventListener("click", () => {
    playButtonBeep();
    sendAskRecovery(result, recoveryInput);
  });
  modalPanel.querySelector('[data-action="edit"]').addEventListener("click", () => {
    playButtonBeep();
    openAskRecoveryPanel(result, recoveryInput.clarificationText || "");
  });
  modalPanel.querySelectorAll('[data-action="back"], [data-action="cancel"]').forEach((button) => {
    button.addEventListener("click", () => {
      playButtonBeep();
      openAskRecoveryPanel(result, recoveryInput.clarificationText || "");
    });
  });
}

async function sendAskRecovery(result, recoveryInput) {
  const admin = adminContact();
  const uploadedAudio = await uploadAskRecoveryRecording(result, recoveryInput);
  const recovery = createAskRecovery({
    ...recoveryInput,
    clarificationAudioUrl: uploadedAudio.audioUrl || recoveryInput.clarificationAudioUrl,
    clarificationAudioArtifactId: uploadedAudio.artifactId || null,
    clarificationAudioCaptureId: uploadedAudio.clientAudioCaptureId || recoveryInput.recording?.clientAudioCaptureId || null,
    transcriptText: uploadedAudio.transcript || recoveryInput.transcriptText || null,
    interpretationResult: result,
  }, receiverAskContext());
  const message = createAskRecoveryCoordinatorMessage(recovery, receiverAskContext());
  if (uploadedAudio.message) {
    message.id = uploadedAudio.message.id;
    message.clientMessageId = uploadedAudio.message.clientMessageId;
    message.audioArtifactId = uploadedAudio.artifactId || uploadedAudio.message.audioArtifactId || "";
    message.audioDurationMs = uploadedAudio.message.audioDurationMs || recoveryInput.recording?.durationMs || 0;
    message.transcriptStatus = uploadedAudio.message.transcriptStatus || message.transcriptStatus;
    message.audioUrl = absoluteLocalApiUrl(uploadedAudio.message.audioUrl || message.audioUrl);
  }
  state.askRecoveries.unshift(recovery);
  state.messages.unshift(message);
  state.focusedMessageIndex = 0;
  appendAskTrace(ConnectAskEventType.RECOVERY_SENT, {
    recoveryId: recovery.id,
    clarificationText: recovery.clarificationText,
    hasAudio: Boolean(recovery.clarificationAudioUrl),
    audioArtifactId: recovery.clarificationAudioArtifactId || "",
    clientAudioCaptureId: recovery.clarificationAudioCaptureId || "",
  });
  clearActiveConversation();
  state.activeRecoveryRecording = null;
  state.recoveryRecordingResult = null;
  renderWorkspace();
  completeAskTrace(ConnectAskOutcome.RECOVERY_SENT, { recoveryId: recovery.id });
  openModal(`
    <div class="modal-title-row">
      <h2>Sent to ${escapeHtml(admin.displayName)}.</h2>
      <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
    </div>
    <p class="reader-text">Sent to ${escapeHtml(admin.displayName)}.</p>
  `);
  modalPanel.querySelector('[data-action="close"]').addEventListener("click", () => {
    playButtonBeep();
    closeModal();
  });
}

async function uploadAskRecoveryRecording(result, recoveryInput) {
  const recording = recoveryInput.recording;
  if (!recording?.blob) {
    return {};
  }
  try {
    const body = recoveryInput.clarificationText || `Ask recovery for: ${result.rawText || "question"}`;
    const uploaded = await sendAudioMessage(recording, {
      baseUrl: state.localServerUrl,
      receiverId: activeReceiverId(),
      from: "receiver_user",
      to: adminContact().displayName,
      body,
      clientMessageId: `ask-recovery-audio-${Date.now()}`,
      source: "receiver_ask_recovery",
      artifactKind: "ask_recovery",
      audioDirection: "receiver_to_coordinator",
      askInteractionId: state.activeAskInteraction?.id || "",
    });
    return {
      clientAudioCaptureId: uploaded.clientAudioCaptureId || "",
      message: uploaded.message,
      artifactId: uploaded.artifactId || "",
      artifact: uploaded.artifact || null,
      audioUrl: uploaded.audioUrl || "",
      transcript: uploaded.transcript || "",
    };
  } catch {
    setStatus("Audio could not upload. Sending the recovery note locally.");
    return {};
  }
}

function contactByName(name) {
  return connectContacts.find((contact) => contact.displayName === name);
}

function contactById(id) {
  return connectContacts.find((contact) => contact.id === id);
}

function intentTitle(intent) {
  if (intent === "appointment_question") return "Appointment";
  if (intent === "concern_or_symptom") return "Check In";
  if (intent === "device_help") return "Help";
  return "Send Message";
}

function openAllMessagesPanel() {
  openModal(`
    <div class="modal-title-row">
      <h2>All Messages</h2>
      <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
    </div>
    <div class="all-messages-list">
      ${state.messages.map((message, index) => `
        <button class="appointment-choice" type="button" data-message-index="${index}">
          <strong>${escapeHtml(messageHeader(message))}</strong>
        </button>
      `).join("")}
    </div>
  `);
  bindModalClose();
  modalPanel.querySelectorAll("[data-message-index]").forEach((button) => {
    button.addEventListener("click", () => {
      playButtonBeep();
      state.focusedMessageIndex = Number(button.dataset.messageIndex || 0);
      closeModal();
      renderWorkspace();
    });
  });
}

async function openAppointmentsPanel(options = {}) {
  setStatus("Loading appointments from CP Pers.");
  openModal(`
    <div class="modal-title-row">
      <h2>Appointments</h2>
      <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
    </div>
    <p class="reader-text">Looking for upcoming appointments.</p>
  `);
  bindModalClose(options.returnTo);

  try {
    const appointments = await fetchUpcomingAppointments();
    if (!appointments.length) {
      openModal(`
        <div class="modal-title-row">
          <h2>Appointments</h2>
          <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
        </div>
        <p class="reader-text">No upcoming appointments were found.</p>
      `);
      bindModalClose(options.returnTo);
      setStatus("No upcoming appointments found.");
      return;
    }
    renderAppointmentListPanel(appointments, options);
    setStatus(`${appointments.length} upcoming appointment${appointments.length === 1 ? "" : "s"} loaded.`);
  } catch (error) {
    state.cpPersAppointmentsAvailable = false;
    renderActions();
    openModal(`
      <div class="modal-title-row">
        <h2>Appointments</h2>
        <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
      </div>
      <p class="reader-text">Appointments are not connected right now.</p>
    `);
    bindModalClose(options.returnTo);
    setStatus(error.message || "Appointments are not connected right now.");
  }
}

function renderAppointmentListPanel(appointments, options = {}) {
  openModal(`
    <div class="modal-title-row">
      <h2>Which appointment do you mean?</h2>
      <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
    </div>
    <div class="appointment-list">
      ${appointments.map((appointment) => `
        <button class="appointment-choice" type="button" data-appointment-id="${escapeHtml(appointment.id)}">
          <strong>${escapeHtml(appointment.title || "Appointment")}</strong>
        </button>
      `).join("")}
    </div>
  `);
  bindModalClose(options.returnTo);
  modalPanel.querySelectorAll("[data-appointment-id]").forEach((button) => {
    button.addEventListener("click", () => {
      playButtonBeep();
      const appointment = appointments.find((item) => item.id === button.dataset.appointmentId);
      if (appointment) {
        renderAppointmentDetailPanel(appointment, appointments, options);
      }
    });
  });
}

function renderAppointmentDetailPanel(appointment, appointments, options = {}) {
  const hasAddress = Boolean(appointment.locationAddress);
  openModal(`
    <div class="modal-title-row">
      <h2>Appointment</h2>
      <button class="modal-button secondary title-back" type="button" data-action="list">Go Back</button>
    </div>
    <section class="appointment-detail">
      <h3>${escapeHtml(appointment.title || "Appointment")}</h3>
      <p class="appointment-time">${escapeHtml(appointmentDateTimeLabel(appointment))}</p>
      ${appointmentSubtitle(appointment) ? `<p>${escapeHtml(appointmentSubtitle(appointment))}</p>` : ""}
      ${appointment.locationName ? `<p>${escapeHtml(appointment.locationName)}</p>` : ""}
      ${appointment.reason ? `<p>${escapeHtml(appointment.reason)}</p>` : ""}
    </section>
    ${hasAddress ? `<button class="modal-button blue" type="button" data-action="where">Where is it?</button>` : ""}
    <button class="modal-button secondary" type="button" data-action="done">Done</button>
  `);
  modalPanel.querySelector('[data-action="list"]').addEventListener("click", () => {
    playButtonBeep();
    renderAppointmentListPanel(appointments, options);
  });
  modalPanel.querySelector('[data-action="done"]').addEventListener("click", () => {
    playButtonBeep();
    closeModal();
  });
  const whereButton = modalPanel.querySelector('[data-action="where"]');
  if (whereButton) {
    whereButton.addEventListener("click", () => {
      playButtonBeep();
      showAppointmentAddress(appointment, appointments, options);
    });
  }
  setStatus(`${appointment.title || "Appointment"} selected.`);
}

function showAppointmentAddress(appointment, appointments, options = {}) {
  openModal(`
    <div class="modal-title-row">
      <h2>Where is it?</h2>
      <button class="modal-button secondary title-back" type="button" data-action="appointment">Go Back</button>
    </div>
    <p class="reader-text">${escapeHtml(appointment.locationAddress || "No address is saved for this appointment.")}</p>
    ${appointment.locationPhone ? `<p class="modal-copy">${escapeHtml(appointment.locationPhone)}</p>` : ""}
  `);
  modalPanel.querySelector('[data-action="appointment"]').addEventListener("click", () => {
    playButtonBeep();
    renderAppointmentDetailPanel(appointment, appointments, options);
  });
}

function bindModalClose(onClose) {
  const closeButton = modalPanel.querySelector('[data-action="close"]');
  if (!closeButton) return;
  closeButton.addEventListener("click", () => {
    playButtonBeep();
    if (typeof onClose === "function") {
      onClose();
      return;
    }
    closeModal();
  });
}

function openOptionalSoundsPanel() {
  const showVolumeControls = state.settings.retroSounds && state.settings.buttonBeeps;
  openModal(`
    <div class="modal-title-row">
      <h2>Optional Sounds</h2>
      <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
    </div>
    <p>These sounds give helpful feedback but are not required.</p>
    ${toggleRow("Retro Sounds", "retroSounds")}
    ${toggleRow("Retro Ringers", "retroRingers")}
    ${toggleRow("Button Beeps", "buttonBeeps")}
    ${showVolumeControls ? volumeRow() : ""}
    <button class="modal-button gold" type="button" data-action="optional-sounds-help" data-no-beep="true">Fix Sounds</button>
  `);
  modalPanel.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggle;
      const value = button.dataset.value === "true";
      state.settings[key] = value;
      if (key === "retroSounds" && !value) {
        state.settings.buttonBeeps = false;
        state.settings.retroRingers = false;
      }
      saveStoredSettings();
      if (state.settings.retroSounds && key !== "retroSounds") {
        playButtonBeep();
      } else if (key === "retroSounds" && value) {
        playButtonBeep();
      }
      openOptionalSoundsPanel();
      setStatus(`${settingLabel(key)} ${value ? "on" : "off"}.`);
    });
  });
  modalPanel.querySelectorAll("[data-volume]").forEach((button) => {
    button.addEventListener("click", () => {
      state.settings.comfortVolume = button.dataset.volume;
      saveStoredSettings();
      previewVolume(button.dataset.volume);
      openOptionalSoundsPanel();
      setStatus(`Volume set to ${button.dataset.volume}.`);
    });
  });
  modalPanel.querySelector('[data-action="close"]').addEventListener("click", () => {
    playButtonBeep();
    closeModal();
  });
  modalPanel.querySelector('[data-action="optional-sounds-help"]').addEventListener("click", () => {
    openOptionalSoundsHelpPanel();
  });
}

function openOptionalSoundsHelpPanel() {
  openModal(`
    <div class="modal-title-row">
      <h2>Test Sounds</h2>
      <button class="modal-button blue" type="button" data-action="test-now" data-no-beep="true">Run Test</button>
      <button class="modal-button secondary title-back" type="button" data-action="settings">Go Back</button>
    </div>
    ${soundStatePanel()}
    ${soundDiagnosticPanel()}
    <div class="sound-help sound-help-note">
      <p>Button beeps and retro sounds are optional.</p>
      <p>Speech reminders may still work even if optional sounds are quiet or blocked.</p>
      <p>Use the device volume buttons while this screen is open.</p>
      <p>Check the current audio output if this device supports it.</p>
      <p>If speech works but beeps are faint, this device may reduce regular browser audio.</p>
    </div>
    <div class="sound-problem-grid">
      <p class="settings-label">Problem:</p>
      <button class="setting-choice" type="button" data-sound-result="speech_only">No Beeps</button>
      <button class="setting-choice" type="button" data-sound-result="faint_beep">Faint Beeps</button>
      <span></span>
      <button class="setting-choice" type="button" data-sound-result="no_ringers">No Ring Sounds</button>
      <button class="setting-choice" type="button" data-sound-result="none">No Optional Sounds</button>
    </div>
    ${soundHelpPanel()}
    ${soundContextPanel()}
  `);
  modalPanel.querySelector('[data-action="test-now"]').addEventListener("click", () => {
    updateSupportHelpState({ status: "needs_help" });
    runSoundDiagnostic();
  });
  modalPanel.querySelectorAll('[data-action="test-again"]').forEach((button) => {
    button.addEventListener("click", () => {
      runSoundDiagnostic();
    });
  });
  bindSoundTestAgainButtons();
  modalPanel.querySelectorAll("[data-sound-result]").forEach((button) => {
    button.addEventListener("click", () => {
      state.soundHelp = generateSoundHelp(button.dataset.soundResult);
      updateSupportHelpState({
        issue: issueFromSoundResult(button.dataset.soundResult),
        status: "instructions_shown",
      });
      updateSoundHelpPanel();
    });
  });
  modalPanel.querySelector('[data-action="settings"]').addEventListener("click", () => {
    playButtonBeep();
    openOptionalSoundsPanel();
  });
}

function toggleRow(label, key) {
  const enabled = Boolean(state.settings[key]);
  return `
    <strong>${label}</strong>
    <div class="settings-row two">
      <button class="setting-choice ${enabled ? "selected" : ""}" data-toggle="${key}" data-value="true" type="button">
        ${enabled ? "ON" : "On"}
      </button>
      <button class="setting-choice ${!enabled ? "selected" : ""}" data-toggle="${key}" data-value="false" type="button">
        ${!enabled ? "OFF" : "Off"}
      </button>
    </div>
  `;
}

function volumeRow() {
  return `
    <strong>Volume</strong>
    <div class="settings-row three">
      ${["low", "med", "high"].map((value) => `
        <button class="setting-choice ${state.settings.comfortVolume === value ? "selected" : ""}" data-volume="${value}" type="button">
          ${state.settings.comfortVolume === value ? value.toUpperCase() : capitalize(value)}
        </button>
      `).join("")}
    </div>
  `;
}

function soundDiagnosticPanel() {
  if (!state.soundDiagnostic) return "";
  return `<p class="diagnostic-text">${escapeHtml(state.soundDiagnostic)}</p>`;
}

function soundContextPanel() {
  const context = soundHelpContext();
  return `
    <dl class="sound-context">
      <div><dt>Device</dt><dd>${escapeHtml(context.device)}</dd></div>
      <div><dt>Browser</dt><dd>${escapeHtml(context.browser)}</dd></div>
      <div><dt>App mode</dt><dd>${escapeHtml(context.appMode)}</dd></div>
      <div><dt>Last test</dt><dd>${escapeHtml(context.lastAudioTestResult)}</dd></div>
      <div><dt>Sound permission</dt><dd>${escapeHtml(context.soundPermissionStatus)}</dd></div>
    </dl>
  `;
}

function soundStatePanel() {
  const status = state.supportHelpState?.status || "not_started";
  if (status === "not_started") return "";
  return `<p class="diagnostic-text">Sound Help status: ${escapeHtml(formatSupportHelpStatus(status))}</p>`;
}

function soundHelpPanel() {
  if (!state.soundHelp) return "";
  const steps = state.soundHelp.steps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");
  const warnings = (state.soundHelp.warnings || [])
    .map((warning) => `<li>${escapeHtml(warning)}</li>`)
    .join("");
  const notes = (state.soundHelp.notes || [])
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("");
  const actions = (state.soundHelp.actions || [])
    .map((item) => `
      <button class="modal-button gold" type="button" data-recipe-action="${escapeHtml(item.action)}" data-no-beep="true">
        ${escapeHtml(item.label)}
      </button>
    `)
    .join("");
  return `
    <section class="sound-help-panel">
      <h3>${escapeHtml(state.soundHelp.title)}</h3>
      <p>${escapeHtml(state.soundHelp.summary)}</p>
      <ol>${steps}</ol>
      ${actions}
      ${warnings ? `<p class="sound-help-subhead">Do not:</p><ul>${warnings}</ul>` : ""}
      ${notes ? `<p class="sound-help-subhead">Notes:</p><ul>${notes}</ul>` : ""}
      <button class="modal-button blue" type="button" data-action="test-again" data-no-beep="true">Test Sound Again</button>
      <div class="settings-row two">
        <button class="setting-choice" type="button" data-action="fixed" data-no-beep="true">This Fixed It</button>
        <button class="setting-choice" type="button" data-action="still-no-sound" data-no-beep="true">Still No Sound</button>
      </div>
    </section>
  `;
}

function updateSoundHelpPanel() {
  const existing = modalPanel.querySelector(".sound-help-panel");
  if (existing) {
    existing.outerHTML = soundHelpPanel();
    bindSoundTestAgainButtons();
    return;
  }
  const problemGrid = modalPanel.querySelector(".sound-problem-grid");
  if (!problemGrid || !state.soundHelp) return;
  problemGrid.insertAdjacentHTML("afterend", soundHelpPanel());
  bindSoundTestAgainButtons();
}

function bindSoundTestAgainButtons() {
  modalPanel.querySelectorAll('[data-action="test-again"]').forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      runSoundDiagnostic();
    });
  });
  modalPanel.querySelectorAll("[data-recipe-action]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      runSupportRecipeAction(button.dataset.recipeAction);
    });
  });
  modalPanel.querySelectorAll('[data-action="fixed"]').forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      updateSupportHelpState({ status: "resolved" });
      state.soundDiagnostic = "Sound Help marked resolved on this device.";
      updateSoundDiagnosticPanel();
      openOptionalSoundsHelpPanel();
    });
  });
  modalPanel.querySelectorAll('[data-action="still-no-sound"]').forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      updateSupportHelpState({ status: "needs_help" });
      state.soundDiagnostic = "Sound still needs attention on this device.";
      updateSoundDiagnosticPanel();
      openOptionalSoundsHelpPanel();
    });
  });
}

function generateSoundHelp(result) {
  // TODO: replace local helper with POST /api/connect/receiver/sound-help using the active
  // CP Admin Connect prompt: connect_receiver_sound_help.
  state.lastAudioTestResult = result || state.lastAudioTestResult;
  const issue = issueFromSoundResult(result);
  const recipeContext = supportRecipeContext();
  const recipeMatch = getSupportRecipe(issue, recipeContext);
  if (recipeMatch.recipe) {
    return soundHelpFromRecipe(recipeMatch.recipe, recipeMatch.matchedKey, recipeMatch.lookupKeys);
  }

  const context = soundHelpContext();
  const generated = generateLocalSoundHelp(result, context);
  const recipe = saveGeneratedSupportRecipe(issue, recipeContext, generated);
  return soundHelpFromRecipe(recipe, recipe.key, [recipe.key]);
}

function generateLocalSoundHelp(result, context) {
  const device = context.device;
  const webAudio = audioStateLabel();
  const baseSteps = [
    "Keep this receiver page open while changing volume or audio settings.",
    "Press the physical volume up button several times while this page is visible.",
    "Open Control Center and confirm audio is playing through this device, not headphones or another output.",
  ];

  if (result === "all") {
    return {
      title: "Sounds Are Working",
      summary: `This ${device} is allowing receiver sounds. Browser: ${context.browser}. App mode: ${context.appMode}. Web Audio reports ${webAudio}.`,
      steps: [
        "Leave Retro Sounds and Button Beeps on if the confirmation sounds are helpful.",
        "Use Low, Med, or High to choose the comfort level.",
        "If sound later disappears, return to Sound Help and run Test Sound again.",
      ],
      warnings: ["Do not reset the device.", "Do not erase content or settings."],
      notes: ["This local generated recipe can later be replaced by an Admin-reviewed support recipe."],
      actions: [],
    };
  }

  if (result === "speech_only") {
    return {
      title: "Speech Works, Beeps Are Muted",
      summary: `This ${device} is allowing spoken prompts but reducing or muting regular browser audio. Browser: ${context.browser}. App mode: ${context.appMode}. Web Audio reports ${webAudio}.`,
      steps: [
        ...baseSteps,
        "Check whether Silent Mode, Focus, or a mute setting is active.",
        "If available, open this receiver from the Home Screen icon and test again.",
        "Tap once anywhere on the receiver page, then use Test Sound Again.",
        "In Safari, look for website settings or Auto-Play settings if this iPadOS version shows them.",
        "Receiver reminders can still use spoken prompts, but button beeps may be best-effort on this device.",
      ],
      warnings: ["Do not reset the device.", "Do not erase content or settings."],
      notes: ["Speech synthesis may be more reliable than browser media audio on some iPadOS versions."],
      actions: [
        { action: "enable_retro_button_sounds", label: "Turn On Receiver Sounds" },
        { action: "set_volume_high", label: "Set Receiver Volume to High" },
      ],
    };
  }

  if (result === "no_spoken_reminders") {
    return {
      title: "Spoken Reminders Are Not Playing",
      summary: `This ${device} is not reliably playing spoken prompts. Browser: ${context.browser}. App mode: ${context.appMode}.`,
      steps: [
        ...baseSteps,
        "Tap Start Receiver again, then test immediately.",
        "Check whether this browser has blocked speech or site audio.",
        "Try opening the receiver in Safari or from a Home Screen icon if available.",
        "Avoid resetting device or account settings; this should be handled as a sound setup issue.",
      ],
      warnings: ["Do not reset the device.", "Do not erase content or settings."],
      notes: [],
      actions: [],
    };
  }

  if (result === "faint_beep") {
    return {
      title: "Beeps Are Faint",
      summary: `This ${device} is playing receiver beeps, but regular web audio is quieter than speech. Web Audio reports ${webAudio}.`,
      steps: [
        ...baseSteps,
        "Tap once anywhere on the receiver page, then use Test Sound Again.",
        "If using Safari, check whether this site has an Auto-Play or media setting.",
        "Treat button beeps as optional feedback on this device; spoken reminders remain the more reliable sound path.",
      ],
      warnings: ["Do not reset the device.", "Do not erase content or settings."],
      notes: [],
      actions: [{ action: "set_volume_high", label: "Set Receiver Volume to High" }],
    };
  }

  if (result === "no_ringers") {
    return {
      title: "Ring Sounds Are Not Playing",
      summary: `This ${device} did not play receiver ring sounds. Browser: ${context.browser}. Web Audio reports ${webAudio}.`,
      steps: [
        ...baseSteps,
        "Make sure Retro Sounds and Retro Ringers are on.",
        "Tap Test Sound Again after changing Optional Sounds.",
        "If speech works but ring sounds do not, continue using the receiver and treat ringers as optional on this device.",
      ],
      warnings: ["Do not reset the device.", "Do not erase content or settings."],
      notes: ["Ringers are optional receiver feedback. They should not block reminders, messages, or calls."],
      actions: [{ action: "set_volume_high", label: "Set Receiver Volume to High" }],
    };
  }

  return {
    title: "No Sound Heard",
    summary: `This ${device} did not play the test sounds. Web Audio reports ${webAudio}.`,
    steps: [
      ...baseSteps,
      "Check that the browser tab is not muted and that the iPad is not in Silent Mode.",
      "If available, open this receiver from the Home Screen icon and test again.",
      "Tap once anywhere on the receiver page, then use Test Sound Again.",
      "Try Safari if testing in another iPad browser; iPad browsers share Apple audio rules but behavior can still differ.",
      "Close and reopen the receiver page, then tap Start Receiver before testing again.",
    ],
    warnings: ["Do not reset the device.", "Do not erase content or settings."],
    notes: [],
    actions: [],
  };
}

function soundHelpFromRecipe(recipe, matchedKey, lookupKeys) {
  return {
    title: recipe.title,
    summary:
      recipe.source === "static"
        ? "Using saved CarePland support instructions for this device."
        : "Using locally generated support instructions for this device.",
    steps: recipe.steps || [],
    actions: recipe.actions || [],
    warnings: recipe.warnings || [],
    notes: recipe.notes || [],
    recipe,
  };
}

function runSupportRecipeAction(action) {
  if (action === "set_volume_high") {
    state.settings.comfortVolume = "high";
    saveStoredSettings();
    state.soundDiagnostic = "Receiver volume set to High.";
    updateSoundDiagnosticPanel();
    previewVolume("high");
    return;
  }

  if (action === "enable_retro_button_sounds") {
    state.settings.retroSounds = true;
    state.settings.buttonBeeps = true;
    if (!state.settings.comfortVolume || state.settings.comfortVolume === "off") {
      state.settings.comfortVolume = "high";
    }
    saveStoredSettings();
    state.soundDiagnostic = "Receiver sounds and button beeps are on.";
    updateSoundDiagnosticPanel();
    previewVolume(state.settings.comfortVolume);
  }
}

function supportRecipeContext() {
  const os = detectedOsDetails();
  const browser = detectedBrowserDetails();
  return {
    appMode: detectedAppMode(),
    browserName: browser.name,
    browserVersion: browser.version,
    deviceFamily: detectedDeviceType(),
    deviceModel: detectedDeviceModel(),
    mode: detectedAppMode().toLowerCase().includes("browser") ? "browser" : "standalone",
    osName: os.name,
    osVersion: os.version,
  };
}

function updateSupportHelpState(nextState) {
  state.supportHelpState = saveSupportHelpState(nextState);
}

function formatSupportHelpStatus(status) {
  if (status === "tested_ok") return "Tested OK";
  if (status === "needs_help") return "Needs help";
  if (status === "instructions_shown") return "Instructions shown";
  if (status === "resolved") return "Resolved";
  if (status === "dismissed") return "Dismissed";
  return "Not started";
}

function detectedOsDetails() {
  const ua = window.navigator.userAgent || "";
  const iosMatch = ua.match(/OS ([\d_]+) like Mac OS X/);
  if (/iPad|iPhone|iPod/.test(ua) || isAppleTouchBrowser) {
    return { name: "iOS", version: iosMatch ? iosMatch[1].replace(/_/g, ".") : "" };
  }
  const androidMatch = ua.match(/Android ([\d.]+)/);
  if (androidMatch) return { name: "Android", version: androidMatch[1] };
  const macMatch = ua.match(/Mac OS X ([\d_]+)/);
  if (macMatch) return { name: "macOS", version: macMatch[1].replace(/_/g, ".") };
  const windowsMatch = ua.match(/Windows NT ([\d.]+)/);
  if (windowsMatch) return { name: "Windows", version: windowsMatch[1] };
  return { name: "unknown", version: "" };
}

function detectedBrowserDetails() {
  const ua = window.navigator.userAgent || "";
  const safariMatch = ua.match(/Version\/([\d.]+).*Safari\//);
  const chromeIosMatch = ua.match(/CriOS\/([\d.]+)/);
  const firefoxIosMatch = ua.match(/FxiOS\/([\d.]+)/);
  const chromeMatch = ua.match(/Chrome\/([\d.]+)/);
  const firefoxMatch = ua.match(/Firefox\/([\d.]+)/);
  if (chromeIosMatch) return { name: "Chrome", version: chromeIosMatch[1] };
  if (firefoxIosMatch) return { name: "Firefox", version: firefoxIosMatch[1] };
  if (safariMatch) return { name: "Safari", version: safariMatch[1] };
  if (chromeMatch) return { name: "Chrome", version: chromeMatch[1] };
  if (firefoxMatch) return { name: "Firefox", version: firefoxMatch[1] };
  return { name: "unknown", version: "" };
}

function detectedDeviceModel() {
  const family = detectedDeviceType();
  return family === "Browser device" ? "" : family;
}

function soundHelpContext() {
  return {
    appMode: detectedAppMode(),
    audioContextState: audioStateLabel(),
    browser: detectedBrowserLabel(),
    device: detectedDeviceType(),
    isAppleTouchBrowser,
    lastAudioTestResult: formatSoundTestResult(state.lastAudioTestResult),
    soundPermissionStatus: "No browser sound permission is exposed",
  };
}

function detectedDeviceType() {
  const ua = window.navigator.userAgent || "";
  if (/iPad/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)) {
    return "iPad";
  }
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  return "Browser device";
}

function detectedBrowserLabel() {
  const ua = window.navigator.userAgent || "";
  const safariMatch = ua.match(/Version\/([\d.]+).*Safari\//);
  if (/CriOS\//.test(ua)) return `Chrome iOS${safariMatch ? ` / WebKit ${safariMatch[1]}` : ""}`;
  if (/FxiOS\//.test(ua)) return `Firefox iOS${safariMatch ? ` / WebKit ${safariMatch[1]}` : ""}`;
  if (safariMatch) return `Safari ${safariMatch[1]}`;
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  return "Unknown browser";
}

function detectedAppMode() {
  if (window.navigator.standalone) return "Home Screen web app";
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "Standalone web app";
  return "Browser";
}

function formatSoundTestResult(result) {
  if (result === "all") return "Beep and speech heard";
  if (result === "speech_only") return "Speech only";
  if (result === "faint_beep") return "Faint beeps";
  if (result === "none") return "No sound";
  if (result === "no_spoken_reminders") return "No spoken reminders";
  if (result === "test_running") return "Test running";
  if (result === "test_finished_user_confirmation_needed") return "Test finished";
  return "Not run";
}

function settingLabel(key) {
  if (key === "retroSounds") return "Retro sounds";
  if (key === "buttonBeeps") return "Button beeps";
  if (key === "retroRingers") return "Retro ringers";
  return "Setting";
}

function loadStoredSettings() {
  try {
    const stored = window.localStorage.getItem("carepland.receiver.settings");
    const settings = stored ? { ...receiverSettings, ...JSON.parse(stored) } : { ...receiverSettings };
    if (settings.comfortVolume === "off") {
      settings.comfortVolume = "med";
    }
    return settings;
  } catch {
    return { ...receiverSettings };
  }
}

function saveStoredSettings() {
  try {
    window.localStorage.setItem("carepland.receiver.settings", JSON.stringify(state.settings));
  } catch {
    // Local storage can be unavailable in some embedded browser modes.
  }
}

function loadStoredRuntimeState() {
  try {
    if (resetProvisioningRequested()) {
      window.localStorage.removeItem(receiverRuntimeStorageKey);
      return { receiverStarted: false };
    }
    const stored = window.localStorage.getItem(receiverRuntimeStorageKey);
    return stored ? JSON.parse(stored) : { receiverStarted: false };
  } catch {
    return { receiverStarted: false };
  }
}

function loadStoredProvisioning() {
  try {
    if (resetProvisioningRequested()) {
      window.localStorage.removeItem(receiverProvisioningStorageKey);
      return null;
    }
    const stored = window.localStorage.getItem(receiverProvisioningStorageKey);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function resetProvisioningRequested() {
  try {
    return new URLSearchParams(window.location.search).get("resetProvisioning") === "1";
  } catch {
    return false;
  }
}

function saveStoredProvisioning() {
  try {
    window.localStorage.setItem(receiverProvisioningStorageKey, JSON.stringify(state.provisioning));
  } catch {
    // Local storage can be unavailable in some embedded browser modes.
  }
}

function clearStoredProvisioning() {
  state.provisioning = null;
  state.receiverStarted = false;
  state.setupNotice = "Receiver setup was revoked. Ask Andrew for a new setup link.";
  try {
    window.localStorage.removeItem(receiverProvisioningStorageKey);
  } catch {
    // Local storage can be unavailable in some embedded browser modes.
  }
  stopServerSync();
  saveStoredRuntimeState();
  updateActivationPanel("Setup Needed");
  activationScreen.classList.remove("hidden");
}

function saveStoredRuntimeState() {
  try {
    window.localStorage.setItem(receiverRuntimeStorageKey, JSON.stringify({
      receiverStarted: state.receiverStarted,
      selectedContactId: state.selectedContactId,
      activeConversation: state.activeConversation,
      lastReadyAt: new Date().toISOString(),
    }));
  } catch {
    // Local storage can be unavailable in some embedded browser modes.
  }
  publishReceiverUiState();
}

function persistActiveConversation(conversation) {
  state.activeConversation = conversation;
  saveStoredRuntimeState();
}

function clearActiveConversation() {
  if (!state.activeConversation) return;
  state.activeConversation = null;
  saveStoredRuntimeState();
}

function restoreActiveConversation() {
  const conversation = state.activeConversation;
  if (!conversation || !conversation.type) return;

  if (conversation.type === "ask_input") {
    openSettings(conversation.text || "");
    return;
  }
  if (conversation.type === "contact_input") {
    openContactPanel(contactById(conversation.contactId) || selectedContact(), conversation.text || "");
    return;
  }
  if (conversation.type === "ask_result" && conversation.result) {
    showAskInterpretation(conversation.result, { restoring: true });
    return;
  }
  if (conversation.type === "appointment_chooser_from_ask" && conversation.result) {
    openAppointmentsPanel({ returnTo: () => showAppointmentAskResult(conversation.result) });
    return;
  }
  if (conversation.type === "ask_recovery" && conversation.result) {
    openAskRecoveryPanel(conversation.result, conversation.clarificationText || "");
    return;
  }
  if (conversation.type === "ask_recovery_confirm" && conversation.result) {
    showAskRecoveryConfirmation(conversation.result, conversation.recoveryInput || {});
    return;
  }
  if (conversation.type === "ask_context_correction" && conversation.result) {
    openContextCorrectionPanel(conversation.result);
    return;
  }
  if (conversation.type === "ask_week_context" && conversation.result) {
    showWeekContextPanel(conversation.result);
  }
}

function openReader(message, text, pageIndex = 0) {
  const size = state.settings.messageTextSize || "large";
  const pages = paginateReaderText(text, size);
  const page = Math.max(0, Math.min(pages.length - 1, pageIndex));
  openModal(`
    <div class="modal-title-row reader-title-row">
      <h2>${escapeHtml(messageHeader(message))}</h2>
      <button class="modal-button secondary title-back" type="button" data-action="close">Go Back</button>
    </div>
    <div class="reader-size-row" aria-label="Message text size">
      ${readerSizeButton("standard", "Standard")}
      ${readerSizeButton("large", "Large")}
      ${readerSizeButton("extra", "Extra Large")}
    </div>
    <p class="reader-text reader-text-${escapeHtml(size)}">${escapeHtml(pages[page] || "")}</p>
    ${
      pages.length > 1
        ? `<div class="reader-page-controls" aria-label="Message page controls">
            <button class="modal-button secondary" type="button" data-action="reader-prev" ${page === 0 ? "disabled" : ""}>◀</button>
            <span>${page + 1} / ${pages.length}</span>
            <button class="modal-button secondary" type="button" data-action="reader-next" ${page >= pages.length - 1 ? "disabled" : ""}>▶</button>
          </div>`
        : ""
    }
  `);
  modalPanel.querySelectorAll("[data-reader-size]").forEach((button) => {
    button.addEventListener("click", () => {
      playButtonBeep();
      state.settings.messageTextSize = button.dataset.readerSize;
      saveStoredSettings();
      openReader(message, text, 0);
    });
  });
  modalPanel.querySelector('[data-action="reader-prev"]')?.addEventListener("click", () => {
    playButtonBeep();
    openReader(message, text, page - 1);
  });
  modalPanel.querySelector('[data-action="reader-next"]')?.addEventListener("click", () => {
    playButtonBeep();
    openReader(message, text, page + 1);
  });
  modalPanel.querySelector('[data-action="close"]').addEventListener("click", () => {
    playButtonBeep();
    closeModal();
  });
}

function readerPageCharacterLimit(size) {
  if (size === "standard") return 420;
  if (size === "large") return 210;
  return 90;
}

function paginateReaderText(text, size) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ");
  if (!normalized) return [""];
  const limit = readerPageCharacterLimit(size);
  const pages = [];
  let remaining = normalized;
  while (remaining.length > limit) {
    const slice = remaining.slice(0, limit + 1);
    const breakAt = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "), slice.lastIndexOf(" "));
    const pageEnd = breakAt > Math.floor(limit * 0.62) ? breakAt + 1 : limit;
    pages.push(remaining.slice(0, pageEnd).trim());
    remaining = remaining.slice(pageEnd).trim();
  }
  if (remaining) pages.push(remaining);
  return pages;
}

function readerSizeButton(value, label) {
  const selected = (state.settings.messageTextSize || "large") === value;
  return `
    <button class="setting-choice ${selected ? "selected" : ""}" type="button" data-reader-size="${value}">
      ${selected ? label.toUpperCase() : label}
    </button>
  `;
}

function openModal(html) {
  modalPanel.className = "modal-panel";
  modalPanel.innerHTML = html;
  modalPanel.scrollTop = 0;
  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
  modalPanel.className = "modal-panel";
  modalPanel.innerHTML = "";
}

function setStatus(message) {
  statusLine.textContent = message;
  publishReceiverUiState();
}

function normalizeSetupCodeInput(value) {
  const cleaned = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return cleaned.length > 3 ? `${cleaned.slice(0, 3)}-${cleaned.slice(3)}` : cleaned;
}

function storeProvisioningPayload(payload) {
  state.provisioning = {
    receiverDevice: payload.receiverDevice,
    deviceToken: payload.deviceToken,
    tokenScope: payload.tokenScope,
    pairedAt: new Date().toISOString(),
    localServerUrl: state.localServerUrl,
  };
  saveStoredProvisioning();
  state.lastEventId = 0;
  state.setupNotice = `${payload.receiverDevice?.name || "Receiver"} is paired to this device.`;
  updateActivationPanel("Receiver Paired");
  setStatus(`${payload.receiverDevice?.name || "Receiver"} paired.`);
}

async function applyProvisioningFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const setupToken = params.get("setupToken");
  if (!setupToken) {
    updateActivationPanel();
    return;
  }

  startReceiverButton.disabled = true;
  startReceiverButton.textContent = "Setting Up Receiver...";
  try {
    const payload = await localApi(`/receiver-setup-tokens/${encodeURIComponent(setupToken)}/exchange`, {
      method: "POST",
      body: JSON.stringify({ deviceType: "web" }),
    });
    storeProvisioningPayload(payload);
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (error) {
    state.setupNotice = "This setup link is expired, revoked, or already used. Ask Andrew for a new setup link.";
    updateActivationPanel("Setup Link Not Available");
    setStatus(error.message || "Setup link is expired or already used.");
  } finally {
    startReceiverButton.disabled = false;
  }
}

async function pairReceiverWithSetupCode(event) {
  event?.preventDefault();
  const setupCode = normalizeSetupCodeInput(setupCodeInput?.value || "");
  if (!setupCode || setupCode.length < 7) {
    state.setupNotice = "Enter the six-character setup code from Andrew.";
    updateActivationPanel("Setup Needed");
    return;
  }

  submitSetupCodeButton.disabled = true;
  setupCodeInput.disabled = true;
  state.setupNotice = "Checking setup code...";
  updateActivationPanel("Pairing Receiver");
  try {
    const payload = await localApi(`/receiver-setup-codes/${encodeURIComponent(setupCode)}/exchange`, {
      method: "POST",
      body: JSON.stringify({ deviceType: "web" }),
    });
    if (setupCodeInput) setupCodeInput.value = "";
    storeProvisioningPayload(payload);
  } catch (error) {
    state.setupNotice = error.message || "That setup code is expired, revoked, or already used.";
    updateActivationPanel("Setup Code Not Available");
    setStatus(state.setupNotice);
  } finally {
    submitSetupCodeButton.disabled = false;
    setupCodeInput.disabled = false;
  }
}

function updateActivationPanel(title = "") {
  const panel = activationScreen.querySelector(".activation-panel");
  const heading = panel?.querySelector("h1");
  const kicker = panel?.querySelector("p");
  let detail = panel?.querySelector(".activation-detail");
  const device = state.provisioning?.receiverDevice;
  if (panel && !detail) {
    detail = document.createElement("p");
    detail.className = "activation-detail";
    startReceiverButton.before(detail);
  }
  if (kicker) {
    kicker.textContent = device ? `${device.name} · ${device.locationLabel || "Receiver"}` : "CarePland Connect";
  }
  if (heading) {
    heading.textContent = title || (device ? "Receiver Paired" : "Receiver");
  }
  if (detail) {
    detail.textContent = state.setupNotice || (
      device
        ? "This receiver is paired. Start it to receive calls and messages."
        : "Open a setup link from Andrew on this device to pair the receiver."
    );
  }
  if (setupCodeForm) {
    setupCodeForm.classList.toggle("hidden", Boolean(device));
  }
  startReceiverButton.textContent = device ? "Start Paired Receiver" : "Start Receiver";
}

function startReceiver(options = {}) {
  const autoResume = Boolean(options.autoResume);
  state.receiverStarted = true;
  saveStoredRuntimeState();
  activationScreen.classList.add("hidden");
  if (!autoResume) {
    unlockAudio();
    playButtonBeep({ force: true });
    prepareLowLatencyAudio();
    speak("CarePland Receiver ready.");
    setStatus(`Receiver ready. Andrew is selected. Audio ${audioStateLabel()}.`);
  } else {
    prepareLowLatencyAudio();
    setStatus(`Receiver available. Andrew is selected. Audio will resume after touch.`);
    restoreActiveConversation();
  }
  startServerSync();
}

function comfortVolumeLevel(value = state.settings.comfortVolume) {
  if (value === "off") return 0;
  if (value === "low") return 0.18;
  if (value === "high") return 1;
  return 0.5;
}

function playButtonBeep(options = {}) {
  const volume = options.volume || state.settings.comfortVolume;
  const now = performance.now();
  if (!options.force && now - state.lastButtonBeepAt < 140) {
    return false;
  }
  if (
    !state.receiverStarted ||
    !state.settings.retroSounds ||
    !state.settings.buttonBeeps ||
    comfortVolumeLevel(volume) === 0
  ) {
    return false;
  }
  state.lastButtonBeepAt = now;
  if (playBufferedButtonBeep(volume)) {
    return true;
  }
  return playOneShot(audioPack.button, volume);
}

function previewVolume(volume) {
  if (
    !state.receiverStarted ||
    !state.settings.retroSounds ||
    !state.settings.buttonBeeps ||
    comfortVolumeLevel(volume) === 0
  ) {
    return false;
  }
  if (playBufferedButtonBeep(volume)) {
    return true;
  }
  return playOneShot(audioPack.button, volume);
}

function playOneShot(url, volume = state.settings.comfortVolume) {
  return browserAudio.playOneShot(url, volume);
}

function prepareLowLatencyAudio() {
  return browserAudio.prepareBuffer("button", audioPack.button);
}

function ensureAudioContext() {
  return browserAudio.ensureAudioContext();
}

function unlockAudio() {
  return browserAudio.unlock();
}

function audioStateLabel() {
  return browserAudio.audioStateLabel();
}

function runSoundDiagnostic() {
  unlockAudio();
  state.lastAudioTestResult = "test_running";
  state.soundDiagnostic = `Testing sound. Web audio is ${audioStateLabel()}. You should hear the receiver button sound, then "Sound test."`;
  updateSoundDiagnosticPanel();
  setStatus(`Testing sound. Web audio is ${audioStateLabel()}.`);
  previewVolume("high");
  window.setTimeout(() => {
    speak("Sound test.");
    state.lastAudioTestResult = "test_finished_user_confirmation_needed";
    state.soundDiagnostic =
      `Sound test finished. Web audio is ${audioStateLabel()}. If the beep was faint, this iPad/browser is reducing regular web audio compared with speech.`;
    updateSoundDiagnosticPanel();
    setStatus(`Sound test finished. Web audio is ${audioStateLabel()}.`);
  }, 650);
}

function updateSoundDiagnosticPanel() {
  const existing = modalPanel.querySelector(".diagnostic-text");
  if (existing) {
    existing.textContent = state.soundDiagnostic;
    return;
  }
  const anchor = modalPanel.querySelector('[data-action="test-now"]') || modalPanel.querySelector('[data-action="close"]');
  if (!anchor || !state.soundDiagnostic) return;
  const panel = document.createElement("p");
  panel.className = "diagnostic-text";
  panel.textContent = state.soundDiagnostic;
  anchor.after(panel);
}

function playBufferedButtonBeep(volume = state.settings.comfortVolume) {
  return browserAudio.playBuffer("button", volume);
}

function playAudio(url, options = {}) {
  if (!state.receiverStarted || comfortVolumeLevel() === 0) {
    return false;
  }

  return browserAudio.play(url, {
    onEnded: options.onEnded,
    playbackGain: options.playbackGain,
    enhanceSpeech: options.enhanceSpeech,
    stopActive: options.stopActive,
    source: options.source,
  });
}

function stopActiveAudio() {
  browserAudio.stop();
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function resolveAudioUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${state.localServerUrl}${url}`;
  return url;
}

function speak(text) {
  if (!state.receiverStarted || !text || !("speechSynthesis" in window)) {
    return;
  }
  browserAudio.speak(text);
}

function appointmentSubtitle(appointment) {
  return [
    appointment.providerName,
    appointment.providerOrganization,
    appointment.locationName,
  ].filter(Boolean).join(" · ");
}

function appointmentDateTimeLabel(appointment) {
  if (!appointment.startsAt) return "Time not saved";
  const date = new Date(appointment.startsAt);
  if (Number.isNaN(date.getTime())) return "Time not saved";
  const day = date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

function messageTimeLabel(createdAt) {
  const date = createdAt ? new Date(createdAt) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const messageStart = startOfLocalDay(date);
  const dayDifference = Math.round((todayStart - messageStart) / 86400000);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (dayDifference <= 0) return `Today ${time}`;
  if (dayDifference === 1) return `Yesterday ${time}`;
  if (dayDifference === 2) return `Two days ago ${time}`;
  if (dayDifference < 7) {
    return `${date.toLocaleDateString([], { weekday: "long" })} ${time}`;
  }
  return `${date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  })} • ${time}`;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function render() {
  updateClock();
  renderPeople();
  renderAppointment();
  renderActions();
  renderWorkspace();
}

callButton.addEventListener("click", () => {
  playButtonBeep();
  openContactPanel(selectedContact());
});
moreButton.addEventListener("click", () => {
  playButtonBeep();
  openSettings();
});
voiceAskButton.addEventListener("click", () => {
  playButtonBeep();
  openSettings("", { voiceFirst: true });
});
optionalSoundsButton.addEventListener("click", () => {
  playButtonBeep();
  openOptionalSoundsPanel();
});
appointmentButton.addEventListener("click", () => {
  playButtonBeep();
  openAppointmentsPanel();
});
applianceCanvas?.addEventListener("pointerdown", handleReceiverGuideActivation, true);
setupCodeInput?.addEventListener("input", () => {
  const normalized = normalizeSetupCodeInput(setupCodeInput.value);
  if (setupCodeInput.value !== normalized) {
    setupCodeInput.value = normalized;
  }
});
setupCodeForm?.addEventListener("submit", pairReceiverWithSetupCode);
startReceiverButton.addEventListener("click", startReceiver);
startReceiverButton.addEventListener(
  "pointerdown",
  () => {
    unlockAudio();
  },
  { capture: true }
);
document.addEventListener(
  "pointerdown",
  (event) => {
    const button = event.target.closest("button");
    if (!button || button.disabled || button.matches("[data-volume], [data-no-beep]")) {
      return;
    }
    unlockAudio();
    playButtonBeep();
  },
  { capture: true }
);
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    if (state.activeCall) {
      return;
    }
    playButtonBeep();
    cancelAskInputRecording();
    cancelContactRecording();
    cancelAskRecoveryRecording();
    clearActiveConversation();
    closeModal();
  }
});
window.addEventListener("resize", scaleAppliance);
window.addEventListener("orientationchange", () => {
  window.setTimeout(scaleAppliance, 120);
});

scaleAppliance();
render();
await applyProvisioningFromUrl();
if (state.receiverStarted) {
  startReceiver({ autoResume: true });
}
window.setInterval(updateClock, 30000);
