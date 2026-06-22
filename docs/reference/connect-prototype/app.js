import {
  applyConnectTheme,
  connectThemeFields,
  connectThemePresets,
  defaultConnectTheme,
  loadConnectTheme,
  presetByName,
  resetConnectTheme,
  saveConnectTheme,
} from "./shared/connect-theme-service.js";
import { createBrowserAudioController } from "./shared/audio-playback-service.js";
import {
  browserAudioRecordingAvailable,
  startBrowserAudioRecording,
} from "./shared/audio-recording-service.js";
import {
  postAudioEnhancementEvent,
  requestAudioTranscription,
  sendAudioMessage,
} from "./shared/audio-client-service.js?v=audio-enhancement-events-1";

const state = {
  caregiver: "Andrew",
  recipient: "Mom",
  location: "Home",
  status: "requested",
  requestId: 0,
  activeEndpoint: null,
  timers: [],
  visualTheme: "modern",
  retroTerms: true,
  retroAudio: false,
  ringbackTimer: null,
  ringbackAudio: null,
  localServerUrl: "http://localhost:8790",
  receiverId: "living-room-receiver",
  activeDashboardSection: "call",
  receiverPreviewVisible: false,
  receiverGuideMode: false,
  selectedReceiverHouseholdId: "",
  activeCallId: null,
  callStatePollTimer: null,
  messagePollTimer: null,
  receiverEventPollTimer: null,
  receiverLastEventId: 0,
  receiverEventPollPrimed: false,
  receiverPressedHighlightTimer: null,
  careCircleContext: null,
  receivers: [],
  provisioningSummary: null,
  receiverHouseholds: [],
  receiverDevices: [],
  showRevokedDevices: false,
  showInactiveHouseholds: false,
  expandedReceiverDeviceId: "",
  receiverDeviceDetails: {},
  receiverHouseholdDetails: {},
  setupTokens: [],
  provisioningAuditEvents: [],
  setupLink: "",
  receiverMessages: [],
  messageDetailView: false,
  audioProfile: null,
  audioArtifacts: [],
  audioReview: null,
  audioMaintenancePreview: null,
  audioArtifactFilter: "all",
  activeCoordinatorRecording: null,
  coordinatorRecordingResult: null,
  draftContacts: [],
  importMode: null,
  pendingReceiverPersonRemovalId: "",
  pendingReceiverPersonRemovalTimer: null,
  pendingHouseholdArchiveId: "",
  pendingHouseholdArchiveTimer: null,
  connectTheme: loadConnectTheme(),
};

const receiverPreviewDesignWidth = 768;
const receiverPreviewDesignHeight = 900;

const statusLabels = {
  requested: "Requested",
  notified: "Notified",
  accepted: "Accepted",
  connecting: "Connecting",
  connected: "Connected",
  declined: "Declined",
  no_response: "No response",
  failed: "Failed",
  ended: "Ended",
  ready: "Ready",
};

const retroStatusLabels = {
  ready: "Ready",
  requested: "Calling",
  notified: "Ringing",
  accepted: "Answered",
  connecting: "Connecting",
  connected: "Connected",
  declined: "Line Busy",
  no_response: "Receiver Unavailable",
  failed: "Receiver Unavailable",
  ended: "Hung Up",
};

const callStatusPillLabels = {
  ready: "Ready",
  requested: "Calling",
  notified: "Incoming Call",
  accepted: "Accepted",
  connecting: "Connecting",
  connected: "Connected",
  declined: "Declined",
  no_response: "No Response",
  failed: "Unavailable",
  ended: "Ended",
};

const form = document.querySelector("#connectForm");
const visualTheme = document.querySelector("#visualTheme");
const retroAudio = document.querySelector("#retroAudio");
const requestTitle = document.querySelector("#requestTitle");
const goalText = document.querySelector("#goalText");
const sectionTitle = document.querySelector("#sectionTitle");
const sectionSummary = document.querySelector("#sectionSummary");
const navItems = [...document.querySelectorAll("[data-section-tab]")];
const sectionSurfaces = [...document.querySelectorAll(".section-surface")];
const localServerUrlInput = document.querySelector("#localServerUrl");
const refreshReceiversButton = document.querySelector("#refreshReceiversButton");
const createSetupLinkButton = document.querySelector("#createSetupLinkButton");
const refreshProvisioningButton = document.querySelector("#refreshProvisioningButton");
const copySetupLinkButton = document.querySelector("#copySetupLinkButton");
const refreshMessagesButton = document.querySelector("#refreshMessagesButton");
const refreshAudioProfileButton = document.querySelector("#refreshAudioProfileButton");
const refreshAudioReviewButton = document.querySelector("#refreshAudioReviewButton");
const refreshAudioArtifactsButton = document.querySelector("#refreshAudioArtifactsButton");
const retryPendingTranscriptsButton = document.querySelector("#retryPendingTranscriptsButton");
const recoverAudioIndexButton = document.querySelector("#recoverAudioIndexButton");
const backfillAudioIntegrityButton = document.querySelector("#backfillAudioIntegrityButton");
const previewAudioMaintenanceButton = document.querySelector("#previewAudioMaintenanceButton");
const backfillAudioTimelineButton = document.querySelector("#backfillAudioTimelineButton");
const backfillAudioEventLinksButton = document.querySelector("#backfillAudioEventLinksButton");
const openAudioManifestLink = document.querySelector("#openAudioManifestLink");
const openAudioBundleLink = document.querySelector("#openAudioBundleLink");
const downloadAudioBundleLink = document.querySelector("#downloadAudioBundleLink");
const openAudioDomainModelLink = document.querySelector("#openAudioDomainModelLink");
const openAudioTimelineLink = document.querySelector("#openAudioTimelineLink");
const refreshCareCircleButton = document.querySelector("#refreshCareCircleButton");
const messageSearch = document.querySelector("#messageSearch");
const coordinatorMessageText = document.querySelector("#coordinatorMessageText");
const messageComposerTitle = document.querySelector("#messageComposerTitle");
const recordCoordinatorMessageButton = document.querySelector("#recordCoordinatorMessageButton");
const sendCoordinatorMessageButton = document.querySelector("#sendCoordinatorMessageButton");
const clearCoordinatorMessageButton = document.querySelector("#clearCoordinatorMessageButton");
const coordinatorMessageStatus = document.querySelector("#coordinatorMessageStatus");
const messageDetailToggle = document.querySelector("#messageDetailToggle");
const messageHistoryPrevButton = document.querySelector("#messageHistoryPrevButton");
const messageHistoryNextButton = document.querySelector("#messageHistoryNextButton");
const receiverList = document.querySelector("#receiverList");
const receiverDeviceList = document.querySelector("#receiverDeviceList");
const setupChecklist = document.querySelector("#setupChecklist");
const provisioningAudit = document.querySelector("#provisioningAudit");
const provisioningHouseholdSummary = document.querySelector("#provisioningHouseholdSummary");
const setupHouseholdSelect = document.querySelector("#setupHouseholdSelect");
const newHouseholdName = document.querySelector("#newHouseholdName");
const createHouseholdButton = document.querySelector("#createHouseholdButton");
const newReceiverPersonName = document.querySelector("#newReceiverPersonName");
const createReceiverPersonButton = document.querySelector("#createReceiverPersonButton");
const showInactiveHouseholds = document.querySelector("#showInactiveHouseholds");
const setupDeviceName = document.querySelector("#setupDeviceName");
const setupLocationLabel = document.querySelector("#setupLocationLabel");
const setupLinkCard = document.querySelector("#setupLinkCard");
const setupCardTitle = document.querySelector("#setupCardTitle");
const setupCardMeta = document.querySelector("#setupCardMeta");
const setupCode = document.querySelector("#setupCode");
const setupQr = document.querySelector("#setupQr");
const setupLink = document.querySelector("#setupLink");
const openSetupLinkButton = document.querySelector("#openSetupLinkButton");
const setupStatus = document.querySelector("#setupStatus");
const receiverMessagesList = document.querySelector("#receiverMessagesList");
const receiverPreviewTitle = document.querySelector("#receiverPreviewTitle");
const receiverPreviewSelect = document.querySelector("#receiverPreviewSelect");
const toggleReceiverGuideButton = document.querySelector("#toggleReceiverGuideButton");
const receiverPreviewFrame = document.querySelector("#receiverPreviewFrame");
const receiverPreviewIframe = document.querySelector("#receiverPreviewIframe");
const receiverGuideOverlay = document.querySelector("#receiverGuideOverlay");
const receiverCoachLine = document.querySelector("#receiverCoachLine");
const audioProfilePanel = document.querySelector("#audioProfilePanel");
const audioArtifactSummary = document.querySelector("#audioArtifactSummary");
const audioArtifactFilters = document.querySelector("#audioArtifactFilters");
const audioMaintenancePreview = document.querySelector("#audioMaintenancePreview");
const audioArtifactsList = document.querySelector("#audioArtifactsList");
const careCircleContext = document.querySelector("#careCircleContext");
const localServerStatus = document.querySelector("#localServerStatus");
const conversationStatus = document.querySelector("#conversationStatus");
const connectionPill = document.querySelector("#connectionPill");
const callStatusPill = document.querySelector("#callStatusPill");
const endpointLabel = document.querySelector("#endpointLabel");
const deviceStage = document.querySelector("#deviceStage");
const deviceLine = document.querySelector("#deviceLine");
const deviceSubline = document.querySelector("#deviceSubline");
const timeline = document.querySelector("#timeline");
const auditList = document.querySelector("#auditList");
const startButton = document.querySelector("#startButton");
const resetButton = document.querySelector("#resetButton");
const acceptButton = document.querySelector("#acceptButton");
const incomingCallModal = document.querySelector("#incomingCallModal");
const incomingCallTitle = document.querySelector("#incomingCallTitle");
const incomingCallInstruction = document.querySelector("#incomingCallInstruction");
const incomingCallAvatar = document.querySelector("#incomingCallAvatar");
const incomingAnswerButton = document.querySelector("#incomingAnswerButton");
const incomingNotNowButton = document.querySelector("#incomingNotNowButton");
const endButton = document.querySelector("#endButton");
const declineButton = document.querySelector("#declineButton");
const ignoreButton = document.querySelector("#ignoreButton");
const personCards = [...document.querySelectorAll(".person-card")];
const termNodes = [...document.querySelectorAll("[data-term]")];
const contactForm = document.querySelector("#contactForm");
const contactName = document.querySelector("#contactName");
const contactPhone = document.querySelector("#contactPhone");
const contactEmail = document.querySelector("#contactEmail");
const contactRelationship = document.querySelector("#contactRelationship");
const importContactsButton = document.querySelector("#importContactsButton");
const careVipsButton = document.querySelector("#careVipsButton");
const importPanel = document.querySelector("#importPanel");
const importTitle = document.querySelector("#importTitle");
const importHelp = document.querySelector("#importHelp");
const importList = document.querySelector("#importList");
const closeImportButton = document.querySelector("#closeImportButton");
const draftContactsList = document.querySelector("#draftContactsList");
const draftCount = document.querySelector("#draftCount");
const connectThemePreset = document.querySelector("#connectThemePreset");
const connectThemePreview = document.querySelector("#connectThemePreview");
const connectThemeColorGrid = document.querySelector("#connectThemeColorGrid");
const saveConnectThemeButton = document.querySelector("#saveConnectThemeButton");
const resetConnectThemeButton = document.querySelector("#resetConnectThemeButton");
const connectThemeStatus = document.querySelector("#connectThemeStatus");

const contactStorageKey = "carepland-connect-draft-contacts-v1";
const dashboardStorageKey = "carepland-connect-dashboard-state-v1";
const themeFieldLabels = {
  primaryActionColor: "Primary action",
  secondaryActionColor: "Secondary action",
  informationActionColor: "Information action",
  recordActionColor: "Record action",
  secondaryUtilityColor: "Secondary utility",
  panelBackgroundColor: "Panel background",
  outerFrameColor: "Outer frame",
  textColor: "Text",
  borderColor: "Border",
};

const dashboardSections = {
  call: {
    title: "Home",
    summary: "Call, guide, message, and monitor the selected receiver.",
  },
  people: {
    title: "People",
    summary: "Manage household context, care circle contacts, and person-level audio settings.",
  },
  devices: {
    title: "Receivers",
    summary: "Provision, pair, revoke, and route approved receiver endpoints.",
  },
  settings: {
    title: "Appearance",
    summary: "Tune receiver presentation, themes, and prototype visual modes.",
  },
  receiver: {
    title: "Receiver",
    summary: "Mirror the selected receiver, switch devices, and guide without taking control.",
  },
};

const mockDeviceContacts = [
  { displayName: "Cousin Ann", relationshipLabel: "Family", phoneNumber: "555-0104", email: "ann@example.com" },
  { displayName: "Blaine", relationshipLabel: "Neighbor", phoneNumber: "555-0108", email: "" },
  { displayName: "Maria Santos", relationshipLabel: "Care helper", phoneNumber: "555-0112", email: "maria@example.com" },
];

const mockCareVips = [
  { displayName: "Mom", relationshipLabel: "Care VIP", phoneNumber: "555-0119", email: "" },
  { displayName: "Cousin Ann", relationshipLabel: "Care VIP", phoneNumber: "555-0104", email: "ann@example.com" },
  { displayName: "Blaine", relationshipLabel: "Care VIP", phoneNumber: "", email: "blaine@example.com" },
];

const terms = {
  modern: {
    connectRequestLabel: "Connect request",
    startButton: "Start Connect Request",
    invitationTitle: "Conversation invitation",
    acceptButton: "Accept and connect",
    endButton: "End conversation",
    noResponseButton: "No response",
    trackingLabel: "Connection tracking",
    endpointLabel: "Approved endpoints",
    activeEndpoint: "No active endpoint",
    unavailable: "Receiver unavailable",
  },
  retro: {
    connectRequestLabel: "Call request",
    startButton: "Call",
    invitationTitle: "Incoming call",
    acceptButton: "Answer",
    endButton: "Hang Up",
    noResponseButton: "Receiver unavailable",
    trackingLabel: "Call progress",
    endpointLabel: "Approved receivers",
    activeEndpoint: "No active receiver",
    unavailable: "Receiver unavailable",
  },
};

const audioPack = {
  incoming: "./assets/audio/old-phone-ringing.mp3",
  ringback: "./assets/audio/in-call-ring.wav",
  sit: "./assets/audio/sit.wav",
  unavailable: "./assets/audio/number-not-available.mp3",
  busy: "./assets/audio/phone-busy-line.mp3",
  button: "./assets/audio/microwave-beep.mp3",
};

const browserAudio = createBrowserAudioController({
  defaultVolume: 0.45,
  onEnhancementProfile: reportAudioEnhancementProfile,
});

function reportAudioEnhancementProfile(event) {
  postAudioEnhancementEvent(
    {
      ...event,
      receiverId: state.receiverId,
      surface: "coordinator_dashboard",
    },
    { baseUrl: state.localServerUrl, receiverId: state.receiverId }
  ).catch(() => {
    // Audio enhancement reporting is useful, but playback must remain best-effort.
  });
}

function selectedEndpoints() {
  return [...document.querySelectorAll('input[name="endpoint"]:checked')].map((input) => input.value);
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createDraftContact(values, source) {
  const now = new Date().toISOString();
  return {
    id: `contact-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    displayName: String(values.displayName || "").trim(),
    relationshipLabel: String(values.relationshipLabel || "").trim(),
    phoneNumber: String(values.phoneNumber || "").trim(),
    email: String(values.email || "").trim(),
    source,
    status: "draft",
    canCall: false,
    createdAt: now,
    updatedAt: now,
  };
}

function loadDraftContacts() {
  try {
    const raw = localStorage.getItem(contactStorageKey);
    state.draftContacts = raw ? JSON.parse(raw) : [];
  } catch {
    state.draftContacts = [];
  }
}

function saveDraftContacts() {
  localStorage.setItem(contactStorageKey, JSON.stringify(state.draftContacts));
}

function isDuplicateContact(contact, existingId = null) {
  const phone = normalizePhone(contact.phoneNumber);
  const email = normalizeText(contact.email);
  const name = normalizeText(contact.displayName);
  return state.draftContacts.some((item) => {
    if (item.id === existingId) return false;
    if (phone && normalizePhone(item.phoneNumber) === phone) return true;
    if (email && normalizeText(item.email) === email) return true;
    return name && normalizeText(item.displayName) === name;
  });
}

function addDraftContact(values, source) {
  const contact = createDraftContact(values, source);
  if (!contact.displayName) return { ok: false, message: "Name is required." };
  if (isDuplicateContact(contact)) {
    return { ok: false, message: `${contact.displayName} is already in Draft Contacts.` };
  }
  state.draftContacts.unshift(contact);
  saveDraftContacts();
  renderDraftContacts();
  return { ok: true, message: `${contact.displayName} added as a draft contact.` };
}

function updateDraftContact(id, updates) {
  const index = state.draftContacts.findIndex((contact) => contact.id === id);
  if (index < 0) return;
  const next = {
    ...state.draftContacts[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  if (!next.displayName.trim() || isDuplicateContact(next, id)) {
    return;
  }
  state.draftContacts[index] = next;
  saveDraftContacts();
  renderDraftContacts();
}

function removeDraftContact(id) {
  state.draftContacts = state.draftContacts.filter((contact) => contact.id !== id);
  saveDraftContacts();
  renderDraftContacts();
}

function renderDraftContacts() {
  draftCount.textContent = `${state.draftContacts.length} draft${state.draftContacts.length === 1 ? "" : "s"}`;
  if (!state.draftContacts.length) {
    draftContactsList.innerHTML = '<p class="empty">No draft contacts yet.</p>';
    return;
  }

  draftContactsList.innerHTML = "";
  state.draftContacts.forEach((contact) => {
    const row = document.createElement("article");
    row.className = "contact-row";
    const details = [
      contact.relationshipLabel,
      contact.phoneNumber,
      contact.email,
    ].filter(Boolean).join(" · ");
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(contact.displayName)}</strong>
        <small>${escapeHtml(details || "No phone or email yet")}</small>
        <span class="draft-status">Not invited yet · ${escapeHtml(contact.source)}</span>
      </div>
      <div class="contact-actions">
        <button class="secondary-button compact" type="button" data-action="edit">Edit</button>
        <button class="secondary-button compact" type="button" data-action="remove">Remove</button>
      </div>
    `;
    row.querySelector('[data-action="remove"]').addEventListener("click", () => removeDraftContact(contact.id));
    row.querySelector('[data-action="edit"]').addEventListener("click", () => {
      const displayName = window.prompt("Name", contact.displayName);
      if (displayName === null) return;
      const phoneNumber = window.prompt("Mobile phone", contact.phoneNumber);
      if (phoneNumber === null) return;
      const email = window.prompt("Email", contact.email);
      if (email === null) return;
      const relationshipLabel = window.prompt("Relationship", contact.relationshipLabel);
      if (relationshipLabel === null) return;
      updateDraftContact(contact.id, {
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        relationshipLabel: relationshipLabel.trim(),
      });
    });
    draftContactsList.append(row);
  });
}

function renderConnectThemeControls() {
  if (!connectThemePreset || !connectThemeColorGrid) return;
  connectThemePreset.innerHTML = `
    <option value="">Custom</option>
    ${connectThemePresets.map((preset) => `
    <option value="${escapeHtml(preset.name)}">${escapeHtml(preset.name)}</option>
  `).join("")}`;
  connectThemeColorGrid.innerHTML = connectThemeFields.map((field) => `
    <label>
      ${escapeHtml(themeFieldLabels[field] || field)}
      <input type="color" data-theme-field="${escapeHtml(field)}" value="${escapeHtml(state.connectTheme[field] || defaultConnectTheme[field])}" />
    </label>
  `).join("");
  syncConnectThemeControls();
  connectThemeColorGrid.querySelectorAll("[data-theme-field]").forEach((input) => {
    input.addEventListener("input", () => {
      state.connectTheme = {
        ...state.connectTheme,
        name: "Custom",
        [input.dataset.themeField]: input.value,
      };
      syncConnectThemeControls({ status: "Custom receiver appearance preview. Save to apply on receiver reload." });
    });
  });
}

function syncConnectThemeControls(options = {}) {
  if (connectThemePreview) {
    applyConnectTheme(state.connectTheme, connectThemePreview);
  }
  if (connectThemePreset) {
    const matchingPreset = connectThemePresets.find((preset) =>
      connectThemeFields.every((field) => preset[field].toLowerCase() === state.connectTheme[field].toLowerCase())
    );
    connectThemePreset.value = matchingPreset?.name || "";
  }
  connectThemeColorGrid?.querySelectorAll("[data-theme-field]").forEach((input) => {
    input.value = state.connectTheme[input.dataset.themeField] || defaultConnectTheme[input.dataset.themeField];
  });
  if (connectThemeStatus) {
    connectThemeStatus.textContent = options.status || `Previewing ${state.connectTheme.name || "Custom"} receiver appearance.`;
  }
}

function selectConnectThemePreset() {
  state.connectTheme = { ...presetByName(connectThemePreset.value) };
  syncConnectThemeControls({ status: `Previewing ${state.connectTheme.name}. Save to apply on receiver reload.` });
}

function persistConnectTheme() {
  state.connectTheme = saveConnectTheme(state.connectTheme);
  syncConnectThemeControls({ status: `${state.connectTheme.name || "Custom"} appearance saved for the web receiver.` });
}

function resetConnectAppearance() {
  state.connectTheme = resetConnectTheme();
  syncConnectThemeControls({ status: "Receiver appearance reset to Classic Green." });
}

function renderImportList(items, source) {
  importList.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "selectable-contact";
    const alreadyAdded = isDuplicateContact(createDraftContact(item, source));
    row.disabled = alreadyAdded;
    row.innerHTML = `
      <span>
        <strong>${escapeHtml(item.displayName)}</strong>
        <small>${escapeHtml([item.relationshipLabel, item.phoneNumber, item.email].filter(Boolean).join(" · ") || "No details")}</small>
      </span>
      <span>${alreadyAdded ? "Added" : "Add"}</span>
    `;
    row.addEventListener("click", () => {
      const result = addDraftContact(item, source);
      importHelp.textContent = result.message;
      renderImportList(items, source);
    });
    importList.append(row);
  });
}

function openImportPanel(mode) {
  state.importMode = mode;
  importPanel.classList.remove("hidden");
  const isCareVip = mode === "careVip";
  importTitle.textContent = isCareVip ? "Add From Care VIPs" : "Import Contacts";
  importHelp.textContent = isCareVip
    ? "Select individual Care VIPs to add as draft contacts. No one can call yet."
    : "Browser contacts are mocked for this prototype. Select individual contacts only.";
  renderImportList(isCareVip ? mockCareVips : mockDeviceContacts, isCareVip ? "sample" : "imported");
}

function refreshLocalSettings() {
  state.localServerUrl = localServerUrlInput.value.trim() || "http://localhost:8790";
  updateAudioManifestLink();
  updateReceiverPreviewUrl();
  persistDashboardState();
}

function updateAudioManifestLink() {
  if (openAudioManifestLink) {
    openAudioManifestLink.href = `${state.localServerUrl}/audio/manifest?receiverId=${encodeURIComponent(state.receiverId)}`;
  }
  if (openAudioBundleLink) {
    openAudioBundleLink.href = `${state.localServerUrl}/audio/review-bundle?receiverId=${encodeURIComponent(state.receiverId)}`;
  }
  if (downloadAudioBundleLink) {
    downloadAudioBundleLink.href = `${state.localServerUrl}/audio/review-bundle?receiverId=${encodeURIComponent(state.receiverId)}&download=1`;
  }
  if (openAudioDomainModelLink) {
    openAudioDomainModelLink.href = `${state.localServerUrl}/audio/domain-model`;
  }
  if (openAudioTimelineLink) {
    openAudioTimelineLink.href = `${state.localServerUrl}/audio/timeline?receiverId=${encodeURIComponent(state.receiverId)}`;
  }
}

function loadDashboardState() {
  try {
    const raw = localStorage.getItem(dashboardStorageKey);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.caregiver = String(saved.caregiver || state.caregiver);
    state.recipient = String(saved.recipient || state.recipient);
    state.location = String(saved.location || state.location);
    state.visualTheme = String(saved.visualTheme || state.visualTheme);
    state.retroAudio = Boolean(saved.retroAudio);
    state.localServerUrl = String(saved.localServerUrl || state.localServerUrl);
    state.receiverId = String(saved.receiverId || state.receiverId);
    state.receiverPreviewVisible = Boolean(saved.receiverPreviewVisible);
    state.receiverGuideMode = Boolean(saved.receiverGuideMode);
    state.activeDashboardSection = dashboardSections[saved.activeDashboardSection]
      ? saved.activeDashboardSection
      : state.activeDashboardSection;
    state.selectedReceiverHouseholdId = String(saved.selectedReceiverHouseholdId || "");
    state.showRevokedDevices = Boolean(saved.showRevokedDevices);
    state.showInactiveHouseholds = Boolean(saved.showInactiveHouseholds);
    state.audioArtifactFilter = String(saved.audioArtifactFilter || state.audioArtifactFilter);
    state.messageDetailView = Boolean(saved.messageDetailView);
    if (localServerUrlInput) localServerUrlInput.value = state.localServerUrl;
    if (visualTheme) visualTheme.value = state.visualTheme;
    if (retroAudio) retroAudio.checked = state.retroAudio;
    if (showInactiveHouseholds) showInactiveHouseholds.checked = state.showInactiveHouseholds;
    if (messageDetailToggle) messageDetailToggle.checked = state.messageDetailView;
    if (setupDeviceName && saved.setupDeviceName) setupDeviceName.value = String(saved.setupDeviceName);
    if (setupLocationLabel && saved.setupLocationLabel) setupLocationLabel.value = String(saved.setupLocationLabel);
    if (messageSearch && saved.messageSearch) messageSearch.value = String(saved.messageSearch);
    personCards.forEach((card) => {
      card.classList.toggle(
        "selected",
        card.dataset.recipient === state.recipient &&
          card.dataset.location === state.location &&
          card.dataset.caregiver === state.caregiver
      );
    });
  } catch {
    localStorage.removeItem(dashboardStorageKey);
  }
}

function persistDashboardState() {
  try {
    localStorage.setItem(dashboardStorageKey, JSON.stringify({
      caregiver: state.caregiver,
      recipient: state.recipient,
      location: state.location,
      visualTheme: state.visualTheme,
      retroAudio: state.retroAudio,
      localServerUrl: state.localServerUrl,
      receiverId: state.receiverId,
      receiverPreviewVisible: state.receiverPreviewVisible,
      receiverGuideMode: state.receiverGuideMode,
      activeDashboardSection: state.activeDashboardSection,
      selectedReceiverHouseholdId: setupHouseholdSelect?.value || state.selectedReceiverHouseholdId,
      setupDeviceName: setupDeviceName?.value || "",
      setupLocationLabel: setupLocationLabel?.value || "",
      showRevokedDevices: state.showRevokedDevices,
      showInactiveHouseholds: state.showInactiveHouseholds,
      audioArtifactFilter: state.audioArtifactFilter,
      messageDetailView: state.messageDetailView,
      messageSearch: messageSearch?.value || "",
    }));
  } catch {
    // Local persistence is a prototype convenience only.
  }
}

function resetHorizontalScroll() {
  if (window.scrollX) {
    window.scrollTo(0, window.scrollY);
  }
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
}

function switchDashboardSection(sectionKey) {
  const section = dashboardSections[sectionKey] ? sectionKey : "call";
  state.activeDashboardSection = section;
  navItems.forEach((item) => {
    const isSettingsButton = item.classList.contains("settings-button");
    const isSettingsArea = ["people", "devices", "settings"].includes(section);
    item.classList.toggle("active", item.dataset.sectionTab === section || (isSettingsButton && isSettingsArea));
  });
  sectionSurfaces.forEach((surface) => {
    const sections = String(surface.dataset.section || "").split(/\s+/).filter(Boolean);
    surface.hidden = !sections.includes(section);
  });
  if (section === "receiver") {
    state.receiverPreviewVisible = true;
    renderReceiverPreviewControls();
  }
  renderIncomingCallModal();
  if (sectionTitle) {
    sectionTitle.textContent = dashboardSections[section].title;
  }
  if (sectionSummary) {
    sectionSummary.textContent = dashboardSections[section].summary;
  }
  document.body.dataset.dashboardSection = section;
  resetHorizontalScroll();
  persistDashboardState();
}

function initDashboardSections() {
  document.addEventListener("click", (event) => {
    const item = event.target.closest("[data-section-tab]");
    if (!item) return;
    switchDashboardSection(item.dataset.sectionTab);
  });
  switchDashboardSection(state.activeDashboardSection);
}

loadDashboardState();
updateAudioManifestLink();
renderReceiverPreviewControls();
initDashboardSections();

async function refreshReceivers() {
  refreshLocalSettings();
  localServerStatus.textContent = `Checking receivers at ${state.localServerUrl}...`;
  try {
    const response = await fetch(`${state.localServerUrl}/receivers`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const body = await response.json();
    state.receivers = body.receivers || [];
    if (!state.receivers.some(receiver => receiver.receiverId === state.receiverId)) {
      const preferred = state.receivers.find(receiver => receiver.online) || state.receivers[0];
      if (preferred) {
        state.receiverId = preferred.receiverId;
        updateAudioManifestLink();
      }
    }
    renderReceivers();
    renderReceiverPreviewControls();
    localServerStatus.textContent = state.receivers.length
      ? `${state.receivers.length} receiver${state.receivers.length === 1 ? "" : "s"} found.`
      : "No receivers registered yet.";
  } catch {
    receiverList.innerHTML = '<p class="server-status">Receiver list unavailable.</p>';
    localServerStatus.textContent = "Local receiver list unavailable.";
  }
}

async function refreshProvisioning() {
  refreshLocalSettings();
  if (!receiverDeviceList) return;
  receiverDeviceList.innerHTML = '<p class="server-status">Loading receiver devices...</p>';
  try {
    const response = await fetch(`${state.localServerUrl}/connect/provisioning${state.showInactiveHouseholds ? "?includeInactiveHouseholds=1" : ""}`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const body = await response.json();
    state.provisioningSummary = body.summary || null;
    state.receiverHouseholds = body.receiverHouseholds || [];
    state.receiverDevices = body.receiverDevices || [];
    state.receiverHouseholdDetails = {};
    state.setupTokens = body.setupTokens || [];
    state.provisioningAuditEvents = body.auditEvents || [];
    renderProvisioningHouseholds();
    selectPreferredProvisionedReceiver();
    renderReceiverDevices();
    renderReceiverPreviewControls();
    renderSetupChecklist();
    renderProvisioningAudit();
  } catch {
    receiverDeviceList.innerHTML = '<p class="server-status">Provisioning service unavailable.</p>';
    if (setupChecklist) {
      setupChecklist.innerHTML = '<p class="server-status">Setup progress unavailable.</p>';
    }
    if (provisioningAudit) {
      provisioningAudit.innerHTML = '<p class="server-status">Provisioning audit unavailable.</p>';
    }
  }
}

function selectPreferredProvisionedReceiver() {
  const candidates = state.receiverDevices
    .filter(device => device.receiverId && device.status !== "revoked")
    .filter(device => device.pairedAt || device.status === "setup_pending")
    .sort((first, second) => {
      const firstTime = new Date(first.lastSeenAt || first.pairedAt || first.updatedAt || first.createdAt || 0).getTime();
      const secondTime = new Date(second.lastSeenAt || second.pairedAt || second.updatedAt || second.createdAt || 0).getTime();
      return secondTime - firstTime;
    });
  const preferred = candidates[0];
  if (candidates.some(device => device.receiverId === state.receiverId)) {
    return;
  }
  if (preferred && state.receiverId !== preferred.receiverId) {
      state.receiverId = preferred.receiverId;
      updateAudioManifestLink();
      renderReceiverPreviewControls();
    persistDashboardState();
    localServerStatus.textContent = `Selected ${preferred.name || preferred.receiverId} for Connect requests.`;
    renderReceivers();
  }
}

async function createSetupLink(receiverDeviceId = "") {
  refreshLocalSettings();
  setupStatus.textContent = "Creating receiver setup link...";
  const path = receiverDeviceId
    ? `/receiver-devices/${encodeURIComponent(receiverDeviceId)}/setup-token`
    : "/receiver-setup-tokens";
  try {
    const response = await fetch(`${state.localServerUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        careCircleId: "care-circle-mom",
        receiverHouseholdId: selectedReceiverHouseholdId(),
        name: setupDeviceName.value,
        locationLabel: setupLocationLabel.value,
        createdByUserId: "user-andrew",
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    showSetupLink(body);
    if (body.receiverDevice?.receiverId) {
      state.receiverId = body.receiverDevice.receiverId;
      persistDashboardState();
      renderReceiverPreviewControls();
    }
    setupStatus.textContent = receiverDeviceId
      ? "Re-pair link created. The previous receiver token is no longer valid."
      : "Setup link created. It expires after 30 minutes and can be used once.";
    await refreshProvisioning();
  } catch (error) {
    setupStatus.textContent = error.message || "Could not create setup link.";
  }
}

function showSetupLink(result) {
  const receiverDevice = result.receiverDevice || {};
  const setupToken = result.setupToken || {};
  const receiverUrl = new URL(result.setupPath || "/web-receiver.html", window.location.href);
  receiverUrl.searchParams.set("serverUrl", state.localServerUrl);
  state.setupLink = receiverUrl.toString();
  setupLink.href = state.setupLink;
  setupLink.textContent = state.setupLink;
  if (openSetupLinkButton) {
    openSetupLinkButton.href = state.setupLink;
  }
  if (setupCardTitle) {
    setupCardTitle.textContent = receiverDevice.name || "Receiver setup card";
  }
  if (setupCardMeta) {
    setupCardMeta.textContent = setupToken.expiresAt
      ? `Single-use link expires ${formatShortDateTime(setupToken.expiresAt)}`
      : "Single-use local setup link";
  }
  if (setupCode) {
    setupCode.textContent = setupToken.setupCode || "---";
  }
  renderSetupPattern(state.setupLink);
  setupLinkCard.classList.remove("hidden");
}

function renderSetupPattern(value) {
  if (!setupQr) return;
  const source = String(value || "carepland-connect");
  const cells = 49;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  setupQr.innerHTML = "";
  for (let index = 0; index < cells; index += 1) {
    hash ^= index + 0x9e3779b9;
    hash = Math.imul(hash, 16777619);
    const cell = document.createElement("span");
    cell.className = (hash >>> 0) % 3 === 0 ? "on" : "";
    setupQr.append(cell);
  }
}

async function revokeReceiverDevice(receiverDeviceId) {
  refreshLocalSettings();
  setupStatus.textContent = "Revoking receiver device...";
  try {
    const response = await fetch(
      `${state.localServerUrl}/receiver-devices/${encodeURIComponent(receiverDeviceId)}/revoke`,
      { method: "POST" }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    setupStatus.textContent = `${body.receiverDevice?.name || "Receiver"} revoked. Re-pair to use it again.`;
    await refreshProvisioning();
    await refreshReceivers();
  } catch (error) {
    setupStatus.textContent = error.message || "Could not revoke receiver device.";
  }
}

async function revokeSetupToken(token, receiverDeviceId = "") {
  refreshLocalSettings();
  setupStatus.textContent = "Revoking setup link...";
  try {
    const response = await fetch(
      `${state.localServerUrl}/connect/provisioning/setup-tokens/${encodeURIComponent(token)}/revoke`,
      { method: "POST" }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    setupStatus.textContent = `${body.setupToken?.setupCode || "Setup link"} revoked.`;
    state.receiverDeviceDetails = {};
    state.receiverHouseholdDetails = {};
    await refreshProvisioning();
    if (receiverDeviceId) {
      state.expandedReceiverDeviceId = "";
      await toggleReceiverDeviceDetail(receiverDeviceId);
    }
  } catch (error) {
    setupStatus.textContent = error.message || "Could not revoke setup link.";
  }
}

async function createReceiverHousehold() {
  refreshLocalSettings();
  const displayName = String(newHouseholdName?.value || "").trim();
  if (!displayName) {
    setupStatus.textContent = "Enter a receiver household name.";
    newHouseholdName?.focus();
    return;
  }
  setupStatus.textContent = "Creating receiver household...";
  try {
    const response = await fetch(`${state.localServerUrl}/connect/provisioning/households`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        careCircleId: "care-circle-mom",
        displayName,
        defaultTarget: "household",
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    state.selectedReceiverHouseholdId = body.receiverHousehold?.id || state.selectedReceiverHouseholdId;
    if (newHouseholdName) newHouseholdName.value = "";
    setupStatus.textContent = body.created === false
      ? `${body.receiverHousehold?.displayName || displayName} already exists.`
      : `${body.receiverHousehold?.displayName || displayName} created.`;
    persistDashboardState();
    await refreshProvisioning();
  } catch (error) {
    setupStatus.textContent = error.message || "Could not create receiver household.";
  }
}

async function createReceiverPerson() {
  refreshLocalSettings();
  const displayName = String(newReceiverPersonName?.value || "").trim();
  const receiverHouseholdId = selectedReceiverHouseholdId();
  if (!displayName) {
    setupStatus.textContent = "Enter a receiver person name.";
    newReceiverPersonName?.focus();
    return;
  }
  setupStatus.textContent = "Adding receiver person...";
  try {
    const response = await fetch(
      `${state.localServerUrl}/connect/provisioning/households/${encodeURIComponent(receiverHouseholdId)}/receiver-people`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          careCircleId: "care-circle-mom",
          displayName,
        }),
      }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    if (newReceiverPersonName) newReceiverPersonName.value = "";
    state.receiverHouseholdDetails = {};
    setupStatus.textContent = body.created === false
      ? `${body.receiverPerson?.displayName || displayName} already exists in this household.`
      : `${body.receiverPerson?.displayName || displayName} added to ${body.receiverHousehold?.displayName || "selected household"}.`;
    await refreshProvisioning();
  } catch (error) {
    setupStatus.textContent = error.message || "Could not add receiver person.";
  }
}

async function deactivateReceiverHousehold(receiverHouseholdId) {
  refreshLocalSettings();
  setupStatus.textContent = "Archiving receiver household...";
  cancelPendingHouseholdArchive();
  try {
    const response = await fetch(
      `${state.localServerUrl}/connect/provisioning/households/${encodeURIComponent(receiverHouseholdId)}/deactivate`,
      { method: "POST" }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    state.receiverHouseholdDetails = {};
    setupStatus.textContent = body.changed === false
      ? `${body.receiverHousehold?.displayName || "Receiver household"} was already archived.`
      : `${body.receiverHousehold?.displayName || "Receiver household"} archived.`;
    state.selectedReceiverHouseholdId = "";
    await refreshProvisioning();
  } catch (error) {
    setupStatus.textContent = error.message || "Could not archive receiver household.";
  }
}

async function restoreReceiverHousehold(receiverHouseholdId) {
  refreshLocalSettings();
  setupStatus.textContent = "Restoring receiver household...";
  cancelPendingHouseholdArchive();
  try {
    const response = await fetch(
      `${state.localServerUrl}/connect/provisioning/households/${encodeURIComponent(receiverHouseholdId)}/restore`,
      { method: "POST" }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    state.receiverHouseholdDetails = {};
    state.selectedReceiverHouseholdId = body.receiverHousehold?.id || state.selectedReceiverHouseholdId;
    setupStatus.textContent = body.changed === false
      ? `${body.receiverHousehold?.displayName || "Receiver household"} is already active.`
      : `${body.receiverHousehold?.displayName || "Receiver household"} restored.`;
    await refreshProvisioning();
  } catch (error) {
    setupStatus.textContent = error.message || "Could not restore receiver household.";
  }
}

function armHouseholdArchive(receiverHouseholdId, displayName = "receiver household") {
  if (state.pendingHouseholdArchiveId === receiverHouseholdId) {
    deactivateReceiverHousehold(receiverHouseholdId);
    return;
  }
  cancelPendingHouseholdArchive({ render: false });
  state.pendingHouseholdArchiveId = receiverHouseholdId;
  setupStatus.textContent = `Click Confirm archive to archive ${displayName}. Assigned active devices must be moved or revoked first.`;
  state.pendingHouseholdArchiveTimer = window.setTimeout(() => {
    cancelPendingHouseholdArchive();
  }, 7000);
  renderProvisioningHouseholds();
}

function cancelPendingHouseholdArchive(options = {}) {
  if (state.pendingHouseholdArchiveTimer) {
    window.clearTimeout(state.pendingHouseholdArchiveTimer);
    state.pendingHouseholdArchiveTimer = null;
  }
  const hadPending = Boolean(state.pendingHouseholdArchiveId);
  state.pendingHouseholdArchiveId = "";
  if (hadPending && options.render !== false) {
    renderProvisioningHouseholds();
  }
}

async function deactivateReceiverPerson(receiverPersonId) {
  refreshLocalSettings();
  setupStatus.textContent = "Removing receiver person...";
  cancelPendingReceiverPersonRemoval();
  try {
    const response = await fetch(
      `${state.localServerUrl}/connect/provisioning/receiver-people/${encodeURIComponent(receiverPersonId)}/deactivate`,
      { method: "POST" }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    state.receiverHouseholdDetails = {};
    setupStatus.textContent = body.changed === false
      ? `${body.receiverPerson?.displayName || "Receiver person"} was already removed.`
      : `${body.receiverPerson?.displayName || "Receiver person"} removed from provisioning.`;
    await refreshProvisioning();
  } catch (error) {
    setupStatus.textContent = error.message || "Could not remove receiver person.";
  }
}

async function restoreReceiverPerson(receiverPersonId) {
  refreshLocalSettings();
  setupStatus.textContent = "Restoring receiver person...";
  try {
    const response = await fetch(
      `${state.localServerUrl}/connect/provisioning/receiver-people/${encodeURIComponent(receiverPersonId)}/restore`,
      { method: "POST" }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    state.receiverHouseholdDetails = {};
    setupStatus.textContent = body.changed === false
      ? `${body.receiverPerson?.displayName || "Receiver person"} is already active.`
      : `${body.receiverPerson?.displayName || "Receiver person"} restored.`;
    await refreshProvisioning();
  } catch (error) {
    setupStatus.textContent = error.message || "Could not restore receiver person.";
  }
}

function armReceiverPersonRemoval(receiverPersonId, displayName = "receiver person") {
  if (state.pendingReceiverPersonRemovalId === receiverPersonId) {
    deactivateReceiverPerson(receiverPersonId);
    return;
  }
  cancelPendingReceiverPersonRemoval({ render: false });
  state.pendingReceiverPersonRemovalId = receiverPersonId;
  setupStatus.textContent = `Click Remove again to remove ${displayName} from this receiver household.`;
  state.pendingReceiverPersonRemovalTimer = window.setTimeout(() => {
    cancelPendingReceiverPersonRemoval();
  }, 6000);
  renderProvisioningHouseholds();
}

function cancelPendingReceiverPersonRemoval(options = {}) {
  if (state.pendingReceiverPersonRemovalTimer) {
    window.clearTimeout(state.pendingReceiverPersonRemovalTimer);
    state.pendingReceiverPersonRemovalTimer = null;
  }
  const hadPending = Boolean(state.pendingReceiverPersonRemovalId);
  state.pendingReceiverPersonRemovalId = "";
  if (hadPending && options.render !== false) {
    renderProvisioningHouseholds();
  }
}

async function updateReceiverDevice(receiverDeviceId) {
  refreshLocalSettings();
  const row = receiverDeviceList?.querySelector(`[data-device-row="${CSS.escape(receiverDeviceId)}"]`);
  const nameInput = row?.querySelector("[data-edit-device-name]");
  const locationInput = row?.querySelector("[data-edit-device-location]");
  const name = String(nameInput?.value || "").trim();
  const locationLabel = String(locationInput?.value || "").trim();
  if (!name) {
    setupStatus.textContent = "Receiver device name is required.";
    nameInput?.focus();
    return;
  }
  setupStatus.textContent = "Saving receiver device...";
  try {
    const response = await fetch(
      `${state.localServerUrl}/connect/provisioning/receiver-devices/${encodeURIComponent(receiverDeviceId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, locationLabel }),
      }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    state.receiverDevices = state.receiverDevices.map(device => (
      device.id === receiverDeviceId ? body.receiverDevice : device
    ));
    delete state.receiverDeviceDetails[receiverDeviceId];
    setupStatus.textContent = `${body.receiverDevice?.name || "Receiver"} saved.`;
    await refreshProvisioning();
    state.expandedReceiverDeviceId = "";
    await toggleReceiverDeviceDetail(receiverDeviceId);
  } catch (error) {
    setupStatus.textContent = error.message || "Could not save receiver device.";
  }
}

async function moveReceiverDeviceHousehold(receiverDeviceId) {
  refreshLocalSettings();
  const row = receiverDeviceList?.querySelector(`[data-device-row="${CSS.escape(receiverDeviceId)}"]`);
  const householdSelect = row?.querySelector("[data-edit-device-household]");
  const receiverHouseholdId = String(householdSelect?.value || "").trim();
  if (!receiverHouseholdId) {
    setupStatus.textContent = "Choose a receiver household first.";
    return;
  }
  setupStatus.textContent = "Moving receiver device...";
  try {
    const response = await fetch(
      `${state.localServerUrl}/connect/provisioning/receiver-devices/${encodeURIComponent(receiverDeviceId)}/household`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receiverHouseholdId }),
      }
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    state.receiverDeviceDetails = {};
    state.receiverHouseholdDetails = {};
    const revokedCount = body.revokedSetupTokens?.length || 0;
    const revokedSuffix = revokedCount
      ? ` ${revokedCount} active setup link${revokedCount === 1 ? "" : "s"} revoked.`
      : "";
    setupStatus.textContent = body.changed === false
      ? `${body.receiverDevice?.name || "Receiver"} is already assigned to that household.`
      : `${body.receiverDevice?.name || "Receiver"} moved to ${body.receiverHousehold?.displayName || "selected household"}.${revokedSuffix}`;
    await refreshProvisioning();
    state.expandedReceiverDeviceId = "";
    await toggleReceiverDeviceDetail(receiverDeviceId);
  } catch (error) {
    setupStatus.textContent = error.message || "Could not move receiver device.";
  }
}

async function toggleReceiverDeviceDetail(receiverDeviceId) {
  if (state.expandedReceiverDeviceId === receiverDeviceId) {
    state.expandedReceiverDeviceId = "";
    renderReceiverDevices();
    return;
  }
  state.expandedReceiverDeviceId = receiverDeviceId;
  renderReceiverDevices();
  if (state.receiverDeviceDetails[receiverDeviceId]) return;
  try {
    const response = await fetch(`${state.localServerUrl}/connect/provisioning/receiver-devices/${encodeURIComponent(receiverDeviceId)}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    state.receiverDeviceDetails[receiverDeviceId] = body;
  } catch (error) {
    state.receiverDeviceDetails[receiverDeviceId] = {
      ok: false,
      error: error.message || "Device detail unavailable.",
    };
  }
  renderReceiverDevices();
}

async function loadReceiverHouseholdDetail(receiverHouseholdId) {
  if (!receiverHouseholdId || state.receiverHouseholdDetails[receiverHouseholdId]) return;
  state.receiverHouseholdDetails[receiverHouseholdId] = { loading: true };
  try {
    const response = await fetch(`${state.localServerUrl}/connect/provisioning/households/${encodeURIComponent(receiverHouseholdId)}?includeInactivePeople=1`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Server returned ${response.status}`);
    state.receiverHouseholdDetails[receiverHouseholdId] = body;
  } catch (error) {
    state.receiverHouseholdDetails[receiverHouseholdId] = {
      ok: false,
      error: error.message || "Household detail unavailable.",
    };
  }
  renderProvisioningHouseholds();
}

async function copySetupLink() {
  if (!state.setupLink) return;
  try {
    await navigator.clipboard.writeText(state.setupLink);
    setupStatus.textContent = "Setup link copied.";
  } catch {
    setupStatus.textContent = "Copy unavailable in this browser. Open the link directly.";
  }
}

async function refreshReceiverMessages() {
  refreshLocalSettings();
  if (!receiverMessagesList) return;
  try {
    const query = messageSearch?.value.trim() || "";
    const response = await fetch(
      `${state.localServerUrl}/messages?receiverId=${encodeURIComponent(state.receiverId)}&q=${encodeURIComponent(query)}`
    );
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const body = await response.json();
    state.receiverMessages = body.messages || [];
    renderReceiverMessages();
  } catch {
    receiverMessagesList.innerHTML = '<p class="server-status">Receiver messages unavailable.</p>';
  }
}

async function refreshCareCircleContext() {
  refreshLocalSettings();
  if (!careCircleContext) return;
  careCircleContext.innerHTML = '<p class="server-status">Loading care circle context...</p>';
  try {
    const response = await fetch(`${state.localServerUrl}/care-circles/care-circle-mom`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const body = await response.json();
    state.careCircleContext = body;
    renderCareCircleContext();
  } catch {
    careCircleContext.innerHTML = '<p class="server-status">Care circle context unavailable.</p>';
  }
}

function renderCareCircleContext() {
  if (!careCircleContext) return;
  const context = state.careCircleContext;
  if (!context?.careCircle) {
    careCircleContext.innerHTML = '<p class="server-status">No care circle context loaded.</p>';
    return;
  }

  const members = context.members || [];
  const owner = members.find(member => member.userId === context.careCircle.ownerUserId);
  const primaryAdmin = members.find(member => member.userId === context.careCircle.primaryAdminUserId);
  const additionalAdmin = members.find(member => member.userId === context.careCircle.additionalAdminUserId);
  const participants = members.filter(member => member.role === "participant");
  const receiverPeople = context.receiverPeople || [];
  const receiverHouseholds = context.receiverHouseholds || [];
  const receiverDevices = context.receiverDevices || [];
  const escalation = (context.escalationPolicies || [])[0];

  careCircleContext.innerHTML = `
    <div class="context-grid">
      ${contextBlock("Care circle", [
        context.careCircle.displayName || context.careCircle.name,
        `Owner: ${owner?.displayName || "Not set"}`,
        `Primary admin: ${primaryAdmin?.displayName || "Not set"}`,
        `Additional admin: ${additionalAdmin?.displayName || "None"}`,
      ])}
      ${contextBlock("Household", [
        receiverHouseholds.map(item => item.displayName).join(", ") || "No household modeled",
        `People: ${receiverPeople.map(item => item.displayName).join(", ") || "None"}`,
      ])}
      ${contextBlock("Receiver devices", receiverDevices.map(device => (
        `${device.name || device.receiverId} · ${device.locationLabel || "No location"} · ${device.status || "unknown"}`
      )))}
      ${contextBlock("Participants", participants.map(member => (
        `${member.displayName} · ${member.relationshipLabel || "Participant"} · ${member.visibility || "private"}`
      )))}
      ${contextBlock("Escalation policy", [
        escalation ? `Enabled: ${escalation.enabled ? "yes" : "no"}` : "Not configured",
        escalation ? `Level: ${formatToken(escalation.escalationLevel)}` : "",
        escalation ? `Consent: ${formatToken(escalation.consentStatus)}` : "",
      ].filter(Boolean))}
    </div>
  `;
}

function contextBlock(title, lines) {
  const safeLines = (lines || []).filter(Boolean);
  return `
    <section class="context-block">
      <strong>${escapeHtml(title)}</strong>
      ${safeLines.length
        ? `<ul>${safeLines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
        : '<p class="server-status">None</p>'}
    </section>
  `;
}

function formatToken(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "None";
}

function setCoordinatorMessageInputStatus(text, options = {}) {
  if (!coordinatorMessageText) return;
  if (options.clearValue) {
    coordinatorMessageText.value = "";
  }
  coordinatorMessageText.placeholder = text;
  coordinatorMessageText.classList.add("status-placeholder");
}

function clearCoordinatorMessageInputStatus() {
  if (!coordinatorMessageText) return;
  coordinatorMessageText.placeholder = "Type a message, or record one";
  coordinatorMessageText.classList.remove("status-placeholder");
}

function updateCoordinatorMessageControls() {
  const hasRecording = Boolean(state.coordinatorRecordingResult?.blob);
  const hasText = Boolean(String(coordinatorMessageText?.value || "").trim());
  if (sendCoordinatorMessageButton) {
    sendCoordinatorMessageButton.classList.toggle("inactive", !hasRecording && !hasText);
    sendCoordinatorMessageButton.disabled = !hasRecording && !hasText;
  }
  if (recordCoordinatorMessageButton) {
    const recording = state.activeCoordinatorRecording?.state === "recording";
    recordCoordinatorMessageButton.classList.toggle("recording", recording);
    recordCoordinatorMessageButton.innerHTML = `<span class="record-icon" aria-hidden="true"></span> ${
      recording ? "Stop" : "Record"
    }`;
  }
}

async function toggleCoordinatorMessageRecording() {
  refreshLocalSettings();
  if (state.activeCoordinatorRecording?.state === "recording") {
    const recording = await stopCoordinatorMessageRecording();
    if (recording?.size) {
      await transcribeCoordinatorRecordingDraft(recording);
    } else {
      setCoordinatorMessageInputStatus("Recording was empty. Try again.", { clearValue: true });
      coordinatorMessageStatus.textContent = "No audio captured.";
    }
    updateCoordinatorMessageControls();
    return;
  }

  if (!browserAudioRecordingAvailable()) {
    setCoordinatorMessageInputStatus("Recording is not available in this browser.");
    coordinatorMessageStatus.textContent = "Use a browser with microphone recording support.";
    return;
  }

  try {
    state.coordinatorRecordingResult = null;
    setCoordinatorMessageInputStatus("Listening...", { clearValue: true });
    coordinatorMessageStatus.textContent = "Recording. Tap Stop when done.";
    state.activeCoordinatorRecording = await startBrowserAudioRecording({
      stopAfterSilenceMs: 2600,
      silenceGraceMs: 1200,
      silenceThreshold: 0.018,
      maxDurationMs: 30000,
      onAutoStop: (reason) => {
        finishCoordinatorMessageAfterAutoStop(reason);
      },
    });
    updateCoordinatorMessageControls();
  } catch {
    setCoordinatorMessageInputStatus("Recording could not start.");
    coordinatorMessageStatus.textContent = "Microphone permission may be blocked.";
    updateCoordinatorMessageControls();
  }
}

async function finishCoordinatorMessageAfterAutoStop(reason) {
  if (!state.activeCoordinatorRecording) return;
  const recording = await stopCoordinatorMessageRecording();
  if (recording?.size) {
    await transcribeCoordinatorRecordingDraft(recording, reason);
  } else {
    setCoordinatorMessageInputStatus("Recording was empty. Try again.", { clearValue: true });
    coordinatorMessageStatus.textContent = "No audio captured.";
  }
  updateCoordinatorMessageControls();
}

async function stopCoordinatorMessageRecording() {
  const active = state.activeCoordinatorRecording;
  if (!active) return state.coordinatorRecordingResult;
  const recording = await active.stop();
  state.activeCoordinatorRecording = null;
  state.coordinatorRecordingResult = recording?.size ? recording : null;
  return state.coordinatorRecordingResult;
}

async function transcribeCoordinatorRecordingDraft(recording, reason = "") {
  if (!recording?.blob) return;
  clearCoordinatorMessageInputStatus();
  coordinatorMessageStatus.textContent = "Transcribing recording...";
  if (coordinatorMessageText) {
    coordinatorMessageText.value = "";
    coordinatorMessageText.placeholder = "Transcribing recording...";
  }
  try {
    const transcription = await requestAudioTranscription(recording, {
      baseUrl: state.localServerUrl,
      receiverId: state.receiverId,
      source: "coordinator_message_draft",
      artifactKind: "coordinator_message",
      audioDirection: "coordinator_to_receiver",
      captureContext: {
        role: state.caregiver,
        surface: "coordinator_message_composer",
      },
    });
    const transcript = String(transcription.transcript || "").trim();
    recording.draftTranscript = transcript;
    recording.draftTranscriptStatus = transcription.transcriptStatus || "";
    if (coordinatorMessageText) {
      coordinatorMessageText.value = transcript || "Recorded voice message";
      coordinatorMessageText.placeholder = "Type a message, or record one";
    }
    coordinatorMessageStatus.textContent = transcript
      ? "Recording transcribed. Original audio and transcript will be sent."
      : "Recording ready. Original audio will be sent.";
  } catch {
    if (coordinatorMessageText) {
      coordinatorMessageText.value = "Recorded voice message";
      coordinatorMessageText.placeholder = "Type a message, or record one";
    }
    coordinatorMessageStatus.textContent = "Recording ready. Original audio will be sent.";
  }
}

async function sendCoordinatorAudioMessage() {
  refreshLocalSettings();
  const recording = state.coordinatorRecordingResult;
  const body = String(coordinatorMessageText?.value || "").trim();
  if (!recording?.blob && !body) {
    coordinatorMessageStatus.textContent = "Type or record a message first.";
    return;
  }

  clearCoordinatorMessageInputStatus();
  coordinatorMessageStatus.textContent = recording?.blob ? "Sending audio message..." : "Sending message...";
  sendCoordinatorMessageButton.disabled = true;
  recordCoordinatorMessageButton.disabled = true;
  try {
    let uploaded = null;
    if (recording?.blob) {
      uploaded = await sendAudioMessage(recording, {
        baseUrl: state.localServerUrl,
        receiverId: state.receiverId,
        from: state.caregiver,
        to: state.recipient,
        body: body || "Voice message",
        clientMessageId: `coordinator-audio-${Date.now()}`,
        source: "coordinator_audio_message",
      });
    } else {
      const response = await fetch(`${state.localServerUrl}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          receiverId: state.receiverId,
          from: state.caregiver,
          to: state.recipient,
          body,
          messageType: "text",
          clientMessageId: `coordinator-text-${Date.now()}`,
          source: "coordinator_text_message",
        }),
      });
      uploaded = await response.json().catch(() => ({}));
      if (!response.ok || uploaded.ok === false) throw new Error(uploaded.error || `Server returned ${response.status}`);
    }
    state.coordinatorRecordingResult = null;
    if (coordinatorMessageText) {
      coordinatorMessageText.value = recording?.blob ? uploaded.transcript || "" : "";
      coordinatorMessageText.placeholder = "Type a message, or record one";
    }
    coordinatorMessageStatus.textContent = recording?.blob && uploaded.transcript
      ? "Audio message sent with transcript."
      : recording?.blob
        ? "Audio message sent. Original audio is preserved."
        : "Message sent. The receiver can read it aloud.";
    await refreshReceiverMessages();
    if (recording?.blob) {
      await refreshAudioArtifacts();
    }
  } catch (error) {
    coordinatorMessageStatus.textContent = error.message || "Message could not be sent.";
  } finally {
    recordCoordinatorMessageButton.disabled = false;
    updateCoordinatorMessageControls();
  }
}

function clearCoordinatorAudioMessage() {
  if (state.activeCoordinatorRecording) {
    state.activeCoordinatorRecording.cancel();
  }
  state.activeCoordinatorRecording = null;
  state.coordinatorRecordingResult = null;
  if (coordinatorMessageText) {
    coordinatorMessageText.value = "";
    clearCoordinatorMessageInputStatus();
  }
  coordinatorMessageStatus.textContent = "Recordings keep original audio and transcript.";
  recordCoordinatorMessageButton.disabled = false;
  updateCoordinatorMessageControls();
}

async function refreshAudioProfile() {
  refreshLocalSettings();
  if (!audioProfilePanel) return;
  audioProfilePanel.innerHTML = '<p class="server-status">Loading audio profile...</p>';
  try {
    const response = await fetch(`${state.localServerUrl}/audio/hearing-profile?receiverId=${encodeURIComponent(state.receiverId)}`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const body = await response.json();
    state.audioProfile = body.profile;
    renderAudioProfile();
    if (state.audioArtifacts.length) {
      renderAudioArtifacts();
    }
  } catch {
    audioProfilePanel.innerHTML = '<p class="server-status">Audio profile unavailable.</p>';
  }
}

async function refreshAudioReviewData() {
  const response = await fetch(`${state.localServerUrl}/audio/review?receiverId=${encodeURIComponent(state.receiverId)}`);
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  const body = await response.json();
  state.audioReview = body.review || null;
  state.audioProfile = state.audioReview?.profile || null;
  state.audioArtifacts = state.audioReview?.artifacts || [];
  renderAudioMaintenancePreview(state.audioReview?.maintenancePreview);
}

async function refreshAudioArtifacts() {
  refreshLocalSettings();
  if (!audioArtifactsList) return;
  audioArtifactsList.innerHTML = '<p class="server-status">Loading audio artifacts...</p>';
  try {
    try {
      await refreshAudioReviewData();
    } catch {
      const response = await fetch(`${state.localServerUrl}/audio/artifacts?receiverId=${encodeURIComponent(state.receiverId)}`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const body = await response.json();
      state.audioArtifacts = body.artifacts || [];
    }
    renderAudioArtifacts();
  } catch {
    audioArtifactsList.innerHTML = '<p class="server-status">Audio artifacts unavailable.</p>';
  }
}

async function refreshAudioReview() {
  refreshLocalSettings();
  if (audioProfilePanel) audioProfilePanel.innerHTML = '<p class="server-status">Loading audio review...</p>';
  if (audioArtifactsList) audioArtifactsList.innerHTML = '<p class="server-status">Loading audio review...</p>';
  try {
    await refreshAudioReviewData();
    renderAudioProfile();
    renderAudioArtifacts();
  } catch {
    await Promise.all([refreshAudioProfile(), refreshAudioArtifacts()]);
  }
}

function renderAudioArtifacts() {
  if (!audioArtifactsList) return;
  renderAudioArtifactSummary();
  renderAudioArtifactFilters();
  if (!state.audioArtifacts.length) {
    audioArtifactsList.innerHTML = '<p class="server-status">No saved audio artifacts for this receiver yet.</p>';
    return;
  }
  const artifacts = filteredAudioArtifacts();
  if (!artifacts.length) {
    audioArtifactsList.innerHTML = '<p class="server-status">No audio artifacts match this filter.</p>';
    return;
  }
  audioArtifactsList.innerHTML = artifacts.map((artifact) => {
    const related = relatedAudioActivity(artifact);
    return `
      <article class="audio-artifact-row">
        <div>
          <strong>${escapeHtml(audioArtifactKindLabel(artifact))}</strong>
          <small>${escapeHtml(artifact.createdAt ? new Date(artifact.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No timestamp")}${artifact.audioDurationMs ? ` · ${escapeHtml(formatDuration(artifact.audioDurationMs))}` : ""}${artifact.audioMimeType ? ` · ${escapeHtml(artifact.audioMimeType)}` : ""}${artifact.audioByteSize ? ` · ${escapeHtml(formatBytes(artifact.audioByteSize))}` : ""}</small>
          <small>${escapeHtml(audioArtifactDirectionLabel(artifact))}${audioArtifactCaptureLabel(artifact) ? ` · ${escapeHtml(audioArtifactCaptureLabel(artifact))}` : ""}${artifact.source ? ` · source ${escapeHtml(formatToken(artifact.source))}` : ""}${artifact.messageId ? ` · message ${escapeHtml(artifact.messageId)}` : ""}</small>
        </div>
        <div class="artifact-meta">
          <span>${escapeHtml(artifact.transcriptStatus || "not_requested")}</span>
          <span>${artifact.originalPreserved ? "Original preserved" : "Original missing"}</span>
          <span>${escapeHtml(audioArtifactDeliveryLabel(artifact))}</span>
          ${artifact.audioSha256 ? `<span>sha ${escapeHtml(shortHash(artifact.audioSha256))}</span>` : ""}
          ${artifact.duplicateInfo ? `<span>${escapeHtml(artifact.duplicateInfo.duplicateCount)} duplicates</span>` : ""}
          <span>${related.enhancements} enhanced</span>
          <span>${related.feedback} feedback</span>
          ${artifact.id ? `<a href="${escapeHtml(`${state.localServerUrl}/audio/artifacts/${encodeURIComponent(artifact.id)}/detail?receiverId=${encodeURIComponent(state.receiverId)}`)}" target="_blank" rel="noreferrer">Open details</a>` : ""}
          ${artifact.audioUrl ? `<a href="${escapeHtml(state.localServerUrl + artifact.audioUrl)}" target="_blank" rel="noreferrer">Open audio</a>` : ""}
          ${artifact.audioUrl ? `<button class="artifact-link-button" type="button" data-play-artifact-enhanced="${escapeHtml(state.localServerUrl + artifact.audioUrl)}" data-artifact-id="${escapeHtml(artifact.id || "")}" data-artifact-kind="${escapeHtml(artifact.artifactKind || "")}" data-audio-direction="${escapeHtml(artifact.audioDirection || "")}">Play enhanced</button>` : ""}
          ${canRetryArtifactTranscription(artifact) ? `<button class="artifact-link-button" type="button" data-retry-artifact-transcript="${escapeHtml(artifact.id)}">Retry transcript</button>` : ""}
        </div>
        ${artifact.audioUrl ? `<audio class="artifact-audio" controls src="${escapeHtml(state.localServerUrl + artifact.audioUrl)}"></audio>` : ""}
        ${artifact.transcript ? `<p class="message-transcript">${escapeHtml(artifact.transcript)}</p>` : ""}
      </article>
    `;
  }).join("");
  audioArtifactsList.querySelectorAll("[data-play-artifact-enhanced]").forEach((button) => {
    button.addEventListener("click", (event) => {
      playEnhancedDashboardAudio(event.currentTarget.dataset.playArtifactEnhanced, "audio_artifact_play_enhanced", {
        artifactId: event.currentTarget.dataset.artifactId || "",
        artifactKind: event.currentTarget.dataset.artifactKind || "",
        audioDirection: event.currentTarget.dataset.audioDirection || "",
      });
    });
  });
  audioArtifactsList.querySelectorAll("[data-retry-artifact-transcript]").forEach((button) => {
    button.addEventListener("click", (event) => {
      retryAudioArtifactTranscription(event.currentTarget.dataset.retryArtifactTranscript);
    });
  });
}

function renderAudioArtifactSummary() {
  if (!audioArtifactSummary) return;
  const summary = audioArtifactStats(state.audioArtifacts);
  if (!summary.total) {
    audioArtifactSummary.innerHTML = '<p class="server-status">Load artifacts to review originals, transcripts, and enhanced playback activity.</p>';
    return;
  }
  audioArtifactSummary.innerHTML = `
    <div class="audio-artifact-metrics">
      ${audioReviewReadinessCard(state.audioReview?.reviewReadiness)}
      ${audioMetricCard("Artifacts", String(summary.total), `${summary.originalsPreserved}/${summary.total} originals preserved`)}
      ${audioMetricCard("Transcripts", String(summary.transcribed), `${summary.needsTranscript} need text`)}
      ${audioMetricCard("Delivery", `${summary.heard} heard`, `${summary.read} read`)}
      ${audioMetricCard("Enhanced", String(summary.enhanced), `${summary.feedback} feedback · ${summary.duplicates} duplicates`)}
      ${audioStorageHealthCard(state.audioReview?.storageHealth)}
      ${audioTranscriptionHealthCard(state.audioReview?.transcriptionHealth)}
      ${audioEventLinkHealthCard(state.audioReview?.eventLinkHealth)}
      ${audioCaptureHealthCard(state.audioReview?.captureHealth)}
      ${audioTimelineSummaryCard(state.audioReview?.timelineSummary)}
    </div>
  `;
}

function audioStorageHealthCard(health) {
  if (!health) {
    return audioMetricCard("Storage", "Unknown", "Refresh audio review");
  }
  const detail = [
    `${health.missingOriginals || 0} missing`,
    `${health.unhashedArtifacts || 0} unhashed`,
    `${health.recoverableUploads || 0} recoverable`,
    health.totalBytes ? formatBytes(health.totalBytes) : "",
  ].filter(Boolean).join(" · ");
  return audioMetricCard("Storage", formatToken(health.status || "unknown"), detail);
}

function audioReviewReadinessCard(readiness) {
  if (!readiness) {
    return audioMetricCard("Readiness", "Unknown", "Refresh audio review");
  }
  const detail = [
    readiness.blockers?.length ? `${readiness.blockers.length} blockers` : "",
    readiness.maintenance?.length ? `${readiness.maintenance.length} maintenance` : "",
    readiness.notes?.length ? `${readiness.notes.length} notes` : "",
  ].filter(Boolean).join(" · ") || "No issues found";
  return audioMetricCard("Readiness", formatToken(readiness.status || "unknown"), detail);
}

function audioTranscriptionHealthCard(health) {
  if (!health) {
    return audioMetricCard("Transcription", "Unknown", "Refresh audio review");
  }
  const detail = [
    `${health.transcribed || 0}/${health.artifactCount || 0} transcribed`,
    `${health.retryable || 0} retryable`,
    health.transcriptionConfigured ? health.transcriptionModel || "configured" : "not configured",
  ].join(" · ");
  return audioMetricCard("Transcription", formatToken(health.status || "unknown"), detail);
}

function audioEventLinkHealthCard(health) {
  if (!health) {
    return audioMetricCard("Event Links", "Unknown", "Refresh audio review");
  }
  const detail = [
    `${health.linkedCount || 0}/${health.eventCount || 0} linked`,
    `${health.resolvableUnlinkedCount || 0} backfillable`,
    `${health.unresolvedCount || 0} unresolved`,
  ].join(" · ");
  return audioMetricCard("Event Links", formatToken(health.status || "unknown"), detail);
}

function audioCaptureHealthCard(health) {
  if (!health) {
    return audioMetricCard("Capture", "Unknown", "Refresh audio review");
  }
  const detail = [
    `${health.withCaptureContext || 0}/${health.artifactCount || 0} contextual`,
    `${health.missingCaptureContext || 0} legacy`,
  ].join(" · ");
  return audioMetricCard("Capture", formatToken(health.status || "unknown"), detail);
}

function audioTimelineSummaryCard(timelineSummary) {
  if (!timelineSummary) {
    return audioMetricCard("Timeline", "Unknown", "Refresh audio review");
  }
  const detail = [
    timelineSummary.latestEventType ? formatToken(timelineSummary.latestEventType) : "",
    timelineSummary.lastArtifactAt ? `last artifact ${new Date(timelineSummary.lastArtifactAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "",
  ].filter(Boolean).join(" · ") || "No timeline events yet";
  return audioMetricCard("Timeline", `${timelineSummary.eventCount || 0} events`, detail);
}

function renderAudioArtifactFilters() {
  if (!audioArtifactFilters) return;
  const filters = audioArtifactFilterOptions();
  if (!filters.length) {
    audioArtifactFilters.innerHTML = "";
    return;
  }
  audioArtifactFilters.innerHTML = filters.map((filter) => `
    <button class="${state.audioArtifactFilter === filter.id ? "active" : ""}" type="button" data-artifact-filter="${escapeHtml(filter.id)}">
      ${escapeHtml(filter.label)}
      <span>${escapeHtml(filter.count)}</span>
    </button>
  `).join("");
  audioArtifactFilters.querySelectorAll("[data-artifact-filter]").forEach((button) => {
    button.addEventListener("click", (event) => {
      state.audioArtifactFilter = event.currentTarget.dataset.artifactFilter || "all";
      persistDashboardState();
      renderAudioArtifacts();
    });
  });
}

function filteredAudioArtifacts() {
  return state.audioArtifacts.filter((artifact) => audioArtifactMatchesFilter(artifact, state.audioArtifactFilter));
}

function audioArtifactFilterOptions() {
  if (!state.audioArtifacts.length) return [];
  const filters = [
    ["all", "All"],
    ["receiver_voice", "Receiver voice"],
    ["coordinator_messages", "Coordinator"],
    ["transcribed", "Transcribed"],
    ["needs_text", "Needs text"],
    ["enhanced", "Enhanced"],
  ];
  return filters.map(([id, label]) => ({
    id,
    label,
    count: String(state.audioArtifacts.filter((artifact) => audioArtifactMatchesFilter(artifact, id)).length),
  }));
}

function audioArtifactMatchesFilter(artifact, filter) {
  const source = normalizeText(artifact.source);
  const artifactKind = normalizeText(artifact.artifactKind);
  const audioDirection = normalizeText(artifact.audioDirection);
  const transcriptStatus = normalizeText(artifact.transcriptStatus);
  const hasTranscript = Boolean(String(artifact.transcript || "").trim());
  const related = relatedAudioActivity(artifact);
  switch (filter) {
    case "receiver_voice":
      return artifactKind.includes("ask") || artifactKind === "receiver_message" || audioDirection === "receiver_to_coordinator" || artifact.from === "receiver_user" || source.includes("ask") || source.includes("recovery");
    case "coordinator_messages":
      return artifactKind === "coordinator_message" || audioDirection === "coordinator_to_receiver" || artifact.from === "coordinator_user" || artifact.to === "receiver_user" || source.includes("coordinator") || source.includes("message");
    case "transcribed":
      return hasTranscript || transcriptStatus === "completed";
    case "needs_text":
      return !hasTranscript && ["failed", "not_configured", "not_requested", "missing_audio", ""].includes(transcriptStatus);
    case "enhanced":
      return related.enhancements > 0 || related.feedback > 0;
    case "all":
    default:
      return true;
  }
}

function audioArtifactKindLabel(artifact) {
  return formatToken(artifact.artifactKind || artifact.source || "audio");
}

function audioArtifactDirectionLabel(artifact) {
  if (artifact.audioDirection && artifact.audioDirection !== "unknown") {
    return formatToken(artifact.audioDirection);
  }
  return `${artifact.from || "Unknown"} -> ${artifact.to || "Unknown"}`;
}

function audioArtifactCaptureLabel(artifact) {
  const context = artifact.captureContext || {};
  const surface = context.captureSurface ? formatToken(context.captureSurface) : "";
  const platform = context.clientPlatform || "";
  return [surface, platform].filter(Boolean).join(" on ");
}

function audioArtifactDeliveryLabel(artifact) {
  const message = artifact.relatedMessage || {};
  const states = [];
  if (message.heardAt) {
    states.push(`Heard ${formatMessageStateTime(message.heardAt)}`);
  }
  if (message.readAt) {
    states.push(`Read ${formatMessageStateTime(message.readAt)}`);
  }
  return states.join(" · ") || "Not heard/read yet";
}

function canRetryArtifactTranscription(artifact) {
  return Boolean(artifact?.id && artifact?.audioUrl) && normalizeText(artifact.transcriptStatus) !== "completed";
}

async function retryAudioArtifactTranscription(artifactId) {
  if (!artifactId || !audioArtifactsList) return;
  refreshLocalSettings();
  const artifact = state.audioArtifacts.find((entry) => entry.id === artifactId);
  if (!artifact) return;
  artifact.transcriptStatus = "retrying";
  renderAudioArtifacts();
  try {
    const response = await fetch(`${state.localServerUrl}/audio/artifacts/${encodeURIComponent(artifactId)}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: state.receiverId }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Server returned ${response.status}`);
    }
    state.audioArtifacts = state.audioArtifacts.map((entry) => (
      entry.id === artifactId ? body.artifact : entry
    ));
    renderAudioArtifacts();
    refreshReceiverMessages();
  } catch (error) {
    state.audioArtifacts = state.audioArtifacts.map((entry) => (
      entry.id === artifactId
        ? { ...entry, transcriptStatus: error.message || "retry_failed" }
        : entry
    ));
    renderAudioArtifacts();
  }
}

async function retryPendingAudioTranscripts() {
  if (!audioArtifactsList) return;
  refreshLocalSettings();
  audioArtifactsList.innerHTML = '<p class="server-status">Retrying pending transcripts from preserved originals...</p>';
  try {
    const response = await fetch(`${state.localServerUrl}/audio/artifacts/transcribe-pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: state.receiverId, limit: 10 }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Server returned ${response.status}`);
    }
    if (body.review) {
      state.audioReview = body.review;
      state.audioProfile = body.review.profile || null;
      state.audioArtifacts = body.review.artifacts || [];
      renderAudioMaintenancePreview(body.review.maintenancePreview);
      renderAudioProfile();
      renderAudioArtifacts();
    } else {
      await refreshAudioReview();
    }
    refreshReceiverMessages();
  } catch (error) {
    audioArtifactsList.innerHTML = `<p class="server-status">${escapeHtml(error.message || "Pending transcript retry failed.")}</p>`;
  }
}

async function recoverAudioUploadIndex() {
  if (!audioArtifactsList) return;
  refreshLocalSettings();
  audioArtifactsList.innerHTML = '<p class="server-status">Recovering preserved uploads into the audio index...</p>';
  try {
    const response = await fetch(`${state.localServerUrl}/audio/artifacts/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: state.receiverId, limit: 50 }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Server returned ${response.status}`);
    }
    if (body.review) {
      state.audioReview = body.review;
      state.audioProfile = body.review.profile || null;
      state.audioArtifacts = body.review.artifacts || [];
      renderAudioMaintenancePreview(body.review.maintenancePreview);
      renderAudioProfile();
      renderAudioArtifacts();
    } else {
      await refreshAudioReview();
    }
  } catch (error) {
    audioArtifactsList.innerHTML = `<p class="server-status">${escapeHtml(error.message || "Upload index recovery failed.")}</p>`;
  }
}

async function backfillAudioIntegrity() {
  if (!audioArtifactsList) return;
  refreshLocalSettings();
  audioArtifactsList.innerHTML = '<p class="server-status">Backfilling audio file hashes from preserved originals...</p>';
  try {
    const response = await fetch(`${state.localServerUrl}/audio/artifacts/backfill-integrity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: state.receiverId, limit: 100 }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Server returned ${response.status}`);
    }
    if (body.review) {
      state.audioReview = body.review;
      state.audioProfile = body.review.profile || null;
      state.audioArtifacts = body.review.artifacts || [];
      renderAudioMaintenancePreview(body.review.maintenancePreview);
      renderAudioProfile();
      renderAudioArtifacts();
    } else {
      await refreshAudioReview();
    }
  } catch (error) {
    audioArtifactsList.innerHTML = `<p class="server-status">${escapeHtml(error.message || "Audio hash backfill failed.")}</p>`;
  }
}

async function backfillAudioTimeline() {
  if (!audioArtifactsList) return;
  refreshLocalSettings();
  audioArtifactsList.innerHTML = '<p class="server-status">Backfilling audio timeline from indexed artifacts...</p>';
  try {
    const response = await fetch(`${state.localServerUrl}/audio/timeline/backfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: state.receiverId, limit: 200 }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Server returned ${response.status}`);
    }
    if (body.review) {
      state.audioReview = body.review;
      state.audioProfile = body.review.profile || null;
      state.audioArtifacts = body.review.artifacts || [];
      renderAudioMaintenancePreview(body.review.maintenancePreview);
      renderAudioProfile();
      renderAudioArtifacts();
    } else {
      await refreshAudioReview();
    }
  } catch (error) {
    audioArtifactsList.innerHTML = `<p class="server-status">${escapeHtml(error.message || "Audio timeline backfill failed.")}</p>`;
  }
}

async function backfillAudioEventLinks() {
  if (!audioArtifactsList) return;
  refreshLocalSettings();
  audioArtifactsList.innerHTML = '<p class="server-status">Backfilling audio event artifact links...</p>';
  try {
    const response = await fetch(`${state.localServerUrl}/audio/events/backfill-artifact-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId: state.receiverId, limit: 200 }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Server returned ${response.status}`);
    }
    if (body.review) {
      state.audioReview = body.review;
      state.audioProfile = body.review.profile || null;
      state.audioArtifacts = body.review.artifacts || [];
      renderAudioMaintenancePreview(body.review.maintenancePreview);
      renderAudioProfile();
      renderAudioArtifacts();
    } else {
      await refreshAudioReview();
    }
  } catch (error) {
    audioArtifactsList.innerHTML = `<p class="server-status">${escapeHtml(error.message || "Audio event link backfill failed.")}</p>`;
  }
}

async function previewAudioMaintenance() {
  if (!audioMaintenancePreview) return;
  refreshLocalSettings();
  audioMaintenancePreview.innerHTML = '<p class="server-status">Loading audio maintenance preview...</p>';
  try {
    const response = await fetch(`${state.localServerUrl}/audio/maintenance-preview?receiverId=${encodeURIComponent(state.receiverId)}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Server returned ${response.status}`);
    }
    renderAudioMaintenancePreview(body.preview);
  } catch (error) {
    audioMaintenancePreview.innerHTML = `<p class="server-status">${escapeHtml(error.message || "Audio maintenance preview unavailable.")}</p>`;
  }
}

function renderAudioMaintenancePreview(preview) {
  if (!audioMaintenancePreview) return;
  state.audioMaintenancePreview = preview || null;
  updateAudioMaintenanceControls();
  if (!preview) {
    audioMaintenancePreview.innerHTML = "";
    return;
  }
  const actions = preview.actions || [];
  audioMaintenancePreview.innerHTML = `
    <div class="audio-maintenance-chips">
      ${actions.map(action => `
        <span>
          <strong>${escapeHtml(action.label || action.action)}</strong>
          ${escapeHtml(String(action.count || 0))}
        </span>
      `).join("")}
    </div>
  `;
}

function updateAudioMaintenanceControls() {
  const countFor = (actionId) => {
    const action = state.audioMaintenancePreview?.actions?.find(item => item.action === actionId);
    return action ? Number(action.count || 0) : null;
  };
  const setActionDisabled = (button, actionId) => {
    if (!button) return;
    const count = countFor(actionId);
    button.disabled = count === 0;
  };
  setActionDisabled(recoverAudioIndexButton, "recover_upload_index");
  setActionDisabled(backfillAudioIntegrityButton, "backfill_integrity");
  setActionDisabled(backfillAudioTimelineButton, "backfill_timeline");
  setActionDisabled(backfillAudioEventLinksButton, "backfill_event_artifact_links");
  setActionDisabled(retryPendingTranscriptsButton, "retry_pending_transcripts");
}

function audioArtifactStats(artifacts) {
  const kindCounts = new Map();
  const stats = artifacts.reduce((acc, artifact) => {
    const artifactKind = audioArtifactKindLabel(artifact);
    const transcriptStatus = normalizeText(artifact.transcriptStatus);
    const hasTranscript = Boolean(String(artifact.transcript || "").trim()) || transcriptStatus === "completed";
    const related = relatedAudioActivity(artifact);
    kindCounts.set(artifactKind, (kindCounts.get(artifactKind) || 0) + 1);
    acc.total += 1;
    acc.originalsPreserved += artifact.originalPreserved ? 1 : 0;
    acc.transcribed += hasTranscript ? 1 : 0;
    acc.needsTranscript += hasTranscript ? 0 : 1;
    acc.heard += artifact.relatedMessage?.heardAt ? 1 : 0;
    acc.read += artifact.relatedMessage?.readAt ? 1 : 0;
    acc.duplicates += artifact.duplicateInfo ? 1 : 0;
    acc.enhanced += related.enhancements;
    acc.feedback += related.feedback;
    return acc;
  }, {
    total: 0,
    originalsPreserved: 0,
    transcribed: 0,
    needsTranscript: 0,
    heard: 0,
    read: 0,
    duplicates: 0,
    enhanced: 0,
    feedback: 0,
    kindCount: 0,
    topKinds: [],
  });
  stats.kindCount = kindCounts.size;
  stats.topKinds = [...kindCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([artifactKind, count]) => `${artifactKind} (${count})`);
  return stats;
}

function renderAudioProfile() {
  if (!audioProfilePanel) return;
  const profile = state.audioProfile;
  if (!profile?.summary || (!profile.summary.total && !profile.summary.enhancementEvents)) {
    audioProfilePanel.innerHTML = '<p class="server-status">No audio profile yet. Enhanced playback and receiver feedback will appear here.</p>';
    return;
  }
  const summary = profile.summary;
  const average = summary.averageProfile || {};
  const commonReasons = (summary.commonReasons || []).slice(0, 4).map(item => formatAudioReason(item.reason)).join(", ") || "None yet";
  audioProfilePanel.innerHTML = `
    <div class="audio-profile-summary">
      ${audioMetricCard("Feedback", `${summary.helped}/${summary.total} helped`, summary.helpedRate === null ? "No rate yet" : `${Math.round(summary.helpedRate * 100)}% helpful`)}
      ${audioMetricCard("Enhancement", `${summary.enhancementEvents || 0} playbacks`, "automatic EQ/leveling events")}
      ${audioMetricCard("Playback", formatNullable(average.playbackGain, "x"), "average requested gain")}
      ${audioMetricCard("EQ", `${formatNullable(average.highPassHz, " Hz")} high-pass`, `${formatSignedDb(average.lowMidGainDb)} low-mid · ${formatSignedDb(average.presenceGainDb)} presence`)}
      ${audioMetricCard("Dynamics", average.compressorRatio ? `${average.compressorRatio}:1 compression` : "light limiter only", average.compressorThresholdDb ? `${average.compressorThresholdDb} dB threshold` : "conservative")}
    </div>
    <p class="server-status">Common signals: ${escapeHtml(commonReasons)}${summary.lastUpdatedAt ? ` · Updated ${escapeHtml(new Date(summary.lastUpdatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}` : ""}</p>
    <details class="audio-profile-details">
      <summary>Detail view</summary>
      <div class="audio-profile-events">
        ${(profile.events || []).map(renderAudioProfileEvent).join("")}
        ${(profile.enhancementEvents || []).map(renderAudioEnhancementEvent).join("")}
      </div>
    </details>
  `;
}

function audioMetricCard(label, value, detail) {
  return `
    <section>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(detail || "")}</small>
    </section>
  `;
}

function renderAudioProfileEvent(event) {
  const profile = event.audioEnhancementProfile || {};
  const metrics = profile.metrics || {};
  return `
    <article class="audio-profile-event">
      <strong>${escapeHtml(event.improved ? "Helped" : "Did not help")} · ${escapeHtml(event.messageFrom || "Unknown speaker")}</strong>
      <small>${escapeHtml(event.createdAt ? new Date(event.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "")}</small>
      <p>Gain ${escapeHtml(formatNullable(event.enhancement?.playbackGain, "x"))}; high-pass ${escapeHtml(formatNullable(profile.highPassHz, " Hz"))}; low-mid ${escapeHtml(formatSignedDb(profile.lowMidGainDb))}; presence ${escapeHtml(formatSignedDb(profile.presenceGainDb))}; compression ${escapeHtml(profile.compressor?.ratio ? `${profile.compressor.ratio}:1` : "none")}.</p>
      <p>Input rms ${escapeHtml(formatNullable(metrics.rms))}; peak ${escapeHtml(formatNullable(metrics.peak))}; noise ${escapeHtml(formatNullable(metrics.noiseRatio))}; clipping ${escapeHtml(formatNullable(metrics.clippingRatio))}; reasons ${(profile.reasons || []).map(formatAudioReason).join(", ") || "none"}.</p>
    </article>
  `;
}

function renderAudioEnhancementEvent(event) {
  const profile = event.audioEnhancementProfile || {};
  const metrics = profile.metrics || {};
  return `
    <article class="audio-profile-event">
      <strong>Enhanced playback · ${escapeHtml(event.surface || event.source || "unknown")}</strong>
      <small>${escapeHtml(event.createdAt ? new Date(event.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "")}</small>
      <p>Gain ${escapeHtml(formatNullable(event.enhancement?.playbackGain, "x"))}; high-pass ${escapeHtml(formatNullable(profile.highPassHz, " Hz"))}; low-mid ${escapeHtml(formatSignedDb(profile.lowMidGainDb))}; presence ${escapeHtml(formatSignedDb(profile.presenceGainDb))}; compression ${escapeHtml(profile.compressor?.ratio ? `${profile.compressor.ratio}:1` : "none")}.</p>
      <p>Input rms ${escapeHtml(formatNullable(metrics.rms))}; peak ${escapeHtml(formatNullable(metrics.peak))}; noise ${escapeHtml(formatNullable(metrics.noiseRatio))}; clipping ${escapeHtml(formatNullable(metrics.clippingRatio))}; reasons ${(profile.reasons || []).map(formatAudioReason).join(", ") || "none"}.</p>
    </article>
  `;
}

function relatedAudioActivity(artifact) {
  const audioUrl = normalizeAudioUrl(artifact.audioUrl);
  if (!audioUrl || !state.audioProfile) {
    return { enhancements: 0, feedback: 0 };
  }
  return {
    enhancements: (state.audioProfile.enhancementEvents || []).filter(
      (event) => normalizeAudioUrl(event.audioUrl) === audioUrl
    ).length,
    feedback: (state.audioProfile.events || []).filter(
      (event) => normalizeAudioUrl(event.audioUrl) === audioUrl
    ).length,
  };
}

function normalizeAudioUrl(value) {
  return String(value || "").replace(/^https?:\/\/[^/]+/i, "");
}

function playEnhancedDashboardAudio(url, source, artifact = {}) {
  if (!url) return;
  browserAudio.play(url, {
    artifactId: artifact.artifactId || "",
    artifactKind: artifact.artifactKind || "",
    audioDirection: artifact.audioDirection || "",
    playbackGain: 1.6,
    volume: 1,
    source,
    onBlocked: () => {
      localServerStatus.textContent = "Enhanced playback was blocked by the browser.";
    },
    onEnded: () => {
      refreshAudioProfile();
    },
  });
}

function formatNullable(value, suffix = "") {
  return value === null || value === undefined || value === "" ? "n/a" : `${value}${suffix}`;
}

function formatSignedDb(value) {
  if (value === null || value === undefined || value === "") return "n/a";
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) return "0 dB";
  return `${numeric > 0 ? "+" : ""}${numeric} dB`;
}

function formatAudioReason(reason) {
  return String(reason || "")
    .split("_")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Unknown";
}

function renderReceiverMessages() {
  if (!receiverMessagesList) return;
  receiverMessagesList.classList.toggle("detail-view", state.messageDetailView);
  if (!state.receiverMessages.length) {
    receiverMessagesList.innerHTML = '<p class="server-status">No receiver messages yet.</p>';
    return;
  }
  receiverMessagesList.innerHTML = "";
  state.receiverMessages.forEach(message => {
    const row = document.createElement("article");
    row.className = "receiver-message-row";
    const createdAt = message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
    const duration = message.audioDurationMs ? formatDuration(message.audioDurationMs) : "";
    const audioUrl = message.audioUrl ? `${state.localServerUrl}${message.audioUrl}` : "";
    const transcript = message.transcript || "";
    const transcriptStatus = transcript
      ? "completed"
      : message.transcriptStatus || "not requested";
    const messageState = messageReadHeardSummary(message, createdAt);
    const detailBadge = `Transcript: ${transcriptStatus}`;
    const body = message.body || transcript || "";
    row.innerHTML = `
      <div class="message-row-heading">
        <strong>${escapeHtml(messageTitle(message))}</strong>
        ${state.messageDetailView ? `<span class="draft-status">${escapeHtml(detailBadge)}</span>` : ""}
      </div>
      <small class="message-meta">To ${escapeHtml(message.to || state.caregiver)}${createdAt ? ` - ${createdAt}` : ""}${duration ? ` · ${duration}` : ""} * ${escapeHtml(messageState)}</small>
      <div class="message-body">
        ${body ? `<p>${escapeHtml(body)}</p>` : ""}
      </div>
      ${audioUrl ? `
        <div class="message-audio-tools">
          <audio controls src="${escapeHtml(audioUrl)}"></audio>
          <button class="secondary-button compact" type="button" data-play-normalized="${escapeHtml(audioUrl)}">Play enhanced</button>
        </div>
      ` : ""}
      ${state.messageDetailView && transcript && message.body ? `<p class="message-transcript">${escapeHtml(transcript)}</p>` : ""}
    `;
    row.querySelector("[data-play-normalized]")?.addEventListener("click", (event) => {
      playEnhancedDashboardAudio(event.currentTarget.dataset.playNormalized, "coordinator_message_play_enhanced", {
        artifactId: message.audioArtifactId || "",
        artifactKind: message.messageType === "audio" ? "coordinator_message" : "",
        audioDirection: message.messageType === "audio" ? "coordinator_to_receiver" : "",
      });
    });
    receiverMessagesList.append(row);
  });
  window.requestAnimationFrame(updateMessageHistoryNav);
}

function messageReadHeardSummary(message, fallbackTime = "") {
  const states = [];
  if (message.readAt) {
    states.push(`Read ${formatMessageStateTime(message.readAt)}`);
  }
  if (message.heardAt) {
    states.push(`Heard ${formatMessageStateTime(message.heardAt)}`);
  }
  return states.join(" / ") || `Sent ${fallbackTime || "recently"}`;
}

function scrollMessageHistory(direction) {
  if (!receiverMessagesList) return;
  const amount = Math.max(320, Math.floor(receiverMessagesList.clientWidth * 0.9));
  receiverMessagesList.scrollBy({
    left: direction * amount,
    behavior: "smooth",
  });
  window.setTimeout(updateMessageHistoryNav, 260);
}

function updateMessageHistoryNav() {
  if (!receiverMessagesList || !messageHistoryPrevButton || !messageHistoryNextButton) return;
  const overflow = receiverMessagesList.scrollWidth > receiverMessagesList.clientWidth + 2;
  const atStart = receiverMessagesList.scrollLeft <= 2;
  const atEnd = receiverMessagesList.scrollLeft + receiverMessagesList.clientWidth >= receiverMessagesList.scrollWidth - 2;
  messageHistoryPrevButton.classList.toggle("invisible", !overflow || atStart);
  messageHistoryNextButton.classList.toggle("invisible", !overflow || atEnd);
}

function messageStateSummary(message) {
  const states = [];
  if (message.heardAt) {
    states.push(`Heard ${formatMessageStateTime(message.heardAt)}`);
  }
  if (message.readAt) {
    states.push(`Read ${formatMessageStateTime(message.readAt)}`);
  }
  return states.join(" · ") || "Not heard or read yet";
}

function formatMessageStateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function messageTitle(message) {
  const sender = displayMessageSender(message.from);
  if (message.source === "sms_participant") {
    return `Message from ${sender} via SMS`;
  }
  if (message.messageType === "audio") {
    return `Voice message from ${sender}`;
  }
  return `Message from ${sender}`;
}

function displayMessageSender(from) {
  return from === "receiver_user" ? state.recipient : from || state.recipient;
}

function formatDuration(durationMs) {
  const seconds = Math.max(1, Math.round(Number(durationMs || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes > 0) {
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }
  return `${seconds} sec`;
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortHash(value) {
  const hash = String(value || "");
  return hash.length > 12 ? hash.slice(0, 12) : hash;
}

function renderReceivers() {
  if (!state.receivers.length) {
    receiverList.innerHTML = '<p class="server-status">No receivers registered yet.</p>';
    return;
  }
  receiverList.innerHTML = "";
  state.receivers.forEach(receiver => {
    const freshness = receiver.online ? receiver.status : "offline";
    const button = document.createElement("button");
    button.type = "button";
    button.className = `receiver-option${receiver.receiverId === state.receiverId ? " selected" : ""}`;
    button.innerHTML = `
      <span>
        <strong>${receiver.displayName || receiver.receiverId}</strong>
        <small>${freshness} · ${receiver.deviceType || "receiver"} · ${receiver.receiverId}</small>
      </span>
      <span class="receiver-status-dot ${freshness}"></span>
    `;
    button.addEventListener("click", () => {
      state.receiverId = receiver.receiverId;
      updateAudioManifestLink();
      renderReceiverPreviewControls();
      persistDashboardState();
      renderReceivers();
      localServerStatus.textContent = `Selected ${receiver.displayName || receiver.receiverId}.`;
      refreshReceiverMessages();
    });
    receiverList.append(button);
  });
}

function receiverPreviewOptions() {
  const byId = new Map();
  state.receiverDevices
    .filter(device => device.receiverId && device.status !== "revoked")
    .forEach((device) => {
      byId.set(device.receiverId, {
        receiverId: device.receiverId,
        label: device.name || device.displayName || device.receiverId,
        detail: [device.locationLabel, formatToken(device.status || ""), device.presence?.label].filter(Boolean).join(" · "),
        online: device.presence?.state === "online" || device.status === "available",
      });
    });
  state.receivers.forEach((receiver) => {
    const current = byId.get(receiver.receiverId) || {};
    byId.set(receiver.receiverId, {
      receiverId: receiver.receiverId,
      label: current.label || receiver.displayName || receiver.receiverId,
      detail: [
        current.detail,
        receiver.online ? "online" : "offline",
        receiver.deviceType || "receiver",
      ].filter(Boolean).join(" · "),
      online: Boolean(receiver.online || current.online),
    });
  });
  if (!byId.has(state.receiverId)) {
    byId.set(state.receiverId, {
      receiverId: state.receiverId,
      label: state.receiverId || "Living Room Receiver",
      detail: "Local receiver",
      online: false,
    });
  }
  return [...byId.values()].sort((first, second) => first.label.localeCompare(second.label));
}

function selectedReceiverPreviewOption() {
  return receiverPreviewOptions().find(option => option.receiverId === state.receiverId) || receiverPreviewOptions()[0] || null;
}

function receiverPreviewUrl() {
  const url = new URL("./web-receiver.html", window.location.href);
  url.searchParams.set("serverUrl", state.localServerUrl);
  url.searchParams.set("receiverId", state.receiverId);
  url.searchParams.set("preview", "1");
  return url.toString();
}

function updateReceiverPreviewUrl(options = {}) {
  const url = receiverPreviewUrl();
  const currentUrl = receiverPreviewIframe?.getAttribute("src") || "";
  const shouldLoad =
    receiverPreviewIframe &&
    state.receiverPreviewVisible &&
    options.reload !== false &&
    currentUrl !== url;
  if (shouldLoad) {
    receiverPreviewFrame?.classList.add("loading");
    receiverPreviewIframe.src = url;
  }
}

function fitReceiverPreviewFrame() {
  if (!receiverPreviewFrame || !receiverPreviewIframe) return;
  const availableWidth = Math.max(receiverPreviewFrame.clientWidth, 1);
  const scale = Math.min(1, availableWidth / receiverPreviewDesignWidth);
  receiverPreviewFrame.style.setProperty("--receiver-preview-scale", scale.toFixed(4));
  receiverPreviewFrame.style.height = `${Math.ceil(receiverPreviewDesignHeight * scale)}px`;
}

function watchReceiverPreviewFrame() {
  if (!receiverPreviewFrame) return;
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => fitReceiverPreviewFrame());
    observer.observe(receiverPreviewFrame);
  } else {
    window.addEventListener("resize", fitReceiverPreviewFrame);
  }
  fitReceiverPreviewFrame();
}

function renderReceiverPreviewControls() {
  if (!receiverPreviewSelect) return;
  const options = receiverPreviewOptions();
  if (!options.some(option => option.receiverId === state.receiverId) && options[0]) {
    state.receiverId = options[0].receiverId;
  }
  receiverPreviewSelect.innerHTML = options.map((option, index) => `
    <label class="receiver-radio-option">
      <input
        type="radio"
        name="receiverPreview"
        value="${escapeHtml(option.receiverId)}"
        ${option.receiverId === state.receiverId || (!state.receiverId && index === 0) ? "checked" : ""}
      />
      <span>${escapeHtml(option.label)}${option.online ? " · online" : ""}</span>
    </label>
  `).join("");
  const selected = selectedReceiverPreviewOption();
  if (receiverPreviewTitle) {
    receiverPreviewTitle.textContent = selected?.label || "Receiver";
  }
  if (receiverCoachLine) {
    receiverCoachLine.textContent = receiverCoachLineText(selected);
  }
  if (toggleReceiverGuideButton) {
    toggleReceiverGuideButton.textContent = state.receiverGuideMode ? "Stop guiding" : "Guide mode";
    toggleReceiverGuideButton.classList.toggle("active", state.receiverGuideMode);
  }
  receiverPreviewFrame?.classList.toggle("hidden", !state.receiverPreviewVisible);
  receiverPreviewFrame?.classList.toggle("guide-mode", state.receiverGuideMode);
  renderStatus();
  updateReceiverPreviewUrl();
  fitReceiverPreviewFrame();
}

function receiverCoachLineText(selected) {
  if (!selected) return "Select a receiver.";
  if (state.receiverGuideMode) {
    return "Guide Mode: What you see is what they see. Click a button to point it out. They stay in control and can press anything.";
  }
  return `This does not reflect what is actually seen on ${selected.label} but is a reference for discussion.`;
}

function selectReceiverForPreview(receiverId) {
  if (!receiverId) return;
  state.receiverId = receiverId;
  resetReceiverGuideEventCursor();
  updateAudioManifestLink();
  renderReceivers();
  renderReceiverPreviewControls();
  persistDashboardState();
  refreshReceiverMessages();
}

function toggleReceiverGuideMode() {
  state.receiverGuideMode = !state.receiverGuideMode;
  if (state.receiverGuideMode) {
    state.receiverPreviewVisible = true;
  } else {
    receiverGuideOverlay?.querySelectorAll(".receiver-guide-highlight").forEach((node) => node.remove());
    publishReceiverGuideClear();
  }
  renderReceiverPreviewControls();
  persistDashboardState();
}

function showReceiverGuideTarget(event) {
  if (!state.receiverGuideMode || !receiverGuideOverlay || !receiverPreviewFrame) return;
  const overlayRect = receiverGuideOverlay.getBoundingClientRect();
  const clickX = Math.max(0, Math.min(event.clientX - overlayRect.left, overlayRect.width));
  const clickY = Math.max(0, Math.min(event.clientY - overlayRect.top, overlayRect.height));
  const scale = Number(getComputedStyle(receiverPreviewFrame).getPropertyValue("--receiver-preview-scale")) || 1;
  const guideTarget = receiverGuideHighlightTarget(clickX, clickY) || {
    rect: {
      left: clickX / scale - 42,
      top: clickY / scale - 42,
      width: 84,
      height: 84,
    },
    label: "this spot",
  };
  const highlightRect = scaleGuideRect(guideTarget.rect, scale);
  receiverGuideOverlay.querySelectorAll(".receiver-guide-highlight").forEach((node) => node.remove());
  const highlight = document.createElement("span");
  highlight.className = "receiver-guide-highlight";
  highlight.style.left = `${Math.max(8, highlightRect.left)}px`;
  highlight.style.top = `${Math.max(8, highlightRect.top)}px`;
  highlight.style.width = `${Math.max(64, highlightRect.width)}px`;
  highlight.style.height = `${Math.max(44, highlightRect.height)}px`;
  receiverGuideOverlay.append(highlight);
  publishReceiverGuideTarget(guideTarget);
}

function receiverGuideHighlightTarget(clickX, clickY) {
  if (!receiverPreviewIframe?.contentDocument) return null;
  const scale = Number(getComputedStyle(receiverPreviewFrame).getPropertyValue("--receiver-preview-scale")) || 1;
  const iframeX = clickX / scale;
  const iframeY = clickY / scale;
  let element = receiverPreviewIframe.contentDocument.elementFromPoint(iframeX, iframeY);
  element = closestGuideableReceiverElement(element);
  if (!element) return null;
  const elementRect = element.getBoundingClientRect();
  const padding = 16;
  return {
    rect: {
      left: elementRect.left - padding,
      top: elementRect.top - padding,
      width: elementRect.width + padding * 2,
      height: elementRect.height + padding * 2,
    },
    label: receiverGuideElementLabel(element),
  };
}

function scaleGuideRect(rect, scale) {
  return {
    left: rect.left * scale,
    top: rect.top * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

function closestGuideableReceiverElement(element) {
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

async function publishReceiverGuideTarget(guideTarget) {
  refreshLocalSettings();
  try {
    await fetch(`${state.localServerUrl}/receivers/${encodeURIComponent(state.receiverId)}/guide-target`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: guideTarget.label,
        rect: guideTarget.rect,
        source: "coordinator_dashboard",
      }),
    });
  } catch {
    receiverCoachLine.textContent = "Guide target is visible here, but could not reach the receiver.";
  }
}

async function publishReceiverGuideClear() {
  refreshLocalSettings();
  try {
    await fetch(`${state.localServerUrl}/receivers/${encodeURIComponent(state.receiverId)}/guide-target/clear`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "coordinator_dashboard" }),
    });
  } catch {
    if (receiverCoachLine) {
      receiverCoachLine.textContent = "Guide mode stopped here, but could not reach the receiver.";
    }
  }
}

function resetReceiverGuideEventCursor() {
  state.receiverLastEventId = 0;
  state.receiverEventPollPrimed = false;
  clearReceiverPressedHighlight();
}

async function pollReceiverGuideEvents() {
  refreshLocalSettings();
  const response = await fetch(
    `${state.localServerUrl}/receivers/${encodeURIComponent(state.receiverId)}/events?since=${encodeURIComponent(state.receiverLastEventId)}`
  );
  if (!response.ok) return;
  const payload = await response.json();
  const events = Array.isArray(payload.events) ? payload.events : [];
  if (!state.receiverEventPollPrimed) {
    state.receiverLastEventId = Number(payload.latestEventId || 0);
    state.receiverEventPollPrimed = true;
    return;
  }
  state.receiverLastEventId = Math.max(state.receiverLastEventId, Number(payload.latestEventId || 0));
  events.forEach(handleReceiverGuideEvent);
}

function startReceiverGuideEventPolling() {
  if (state.receiverEventPollTimer) return;
  pollReceiverGuideEvents().catch(() => {});
  state.receiverEventPollTimer = window.setInterval(() => {
    pollReceiverGuideEvents().catch(() => {});
  }, 700);
}

function handleReceiverGuideEvent(event) {
  if (!event || event.type !== "guide.completed") return;
  const label = String(event.pressedLabel || "something").trim() || "something";
  const matchedTarget = Boolean(event.matchedTarget);
  receiverGuideOverlay?.querySelectorAll(".receiver-guide-highlight").forEach((node) => node.remove());
  clearReceiverPressedHighlight();
  renderReceiverPreviewControls();
  if (receiverCoachLine) {
    receiverCoachLine.textContent = matchedTarget
      ? `Mom pressed the highlighted ${label}.`
      : `Mom pressed: ${label}`;
  }
  if (!matchedTarget) {
    showReceiverPressedHighlight(event.pressedRect);
  }
}

function showReceiverPressedHighlight(rect) {
  if (!receiverPreviewFrame) return;
  const safeRect = normalizeReceiverPreviewRect(rect);
  clearReceiverPressedHighlight();
  const scale = Number(getComputedStyle(receiverPreviewFrame).getPropertyValue("--receiver-preview-scale")) || 1;
  const highlightRect = scaleGuideRect(safeRect, scale);
  const highlight = document.createElement("span");
  highlight.className = "receiver-guide-highlight receiver-pressed-highlight";
  highlight.style.left = `${Math.max(8, highlightRect.left)}px`;
  highlight.style.top = `${Math.max(8, highlightRect.top)}px`;
  highlight.style.width = `${Math.max(64, highlightRect.width)}px`;
  highlight.style.height = `${Math.max(44, highlightRect.height)}px`;
  receiverPreviewFrame.append(highlight);
  state.receiverPressedHighlightTimer = window.setTimeout(clearReceiverPressedHighlight, 2000);
}

function normalizeReceiverPreviewRect(rect = {}) {
  const left = Number(rect?.left);
  const top = Number(rect?.top);
  const width = Number(rect?.width);
  const height = Number(rect?.height);
  if ([left, top, width, height].every(Number.isFinite) && width > 0 && height > 0) {
    return { left, top, width, height };
  }
  return {
    left: receiverPreviewDesignWidth / 2 - 70,
    top: receiverPreviewDesignHeight / 2 - 45,
    width: 140,
    height: 90,
  };
}

function clearReceiverPressedHighlight() {
  window.clearTimeout(state.receiverPressedHighlightTimer);
  state.receiverPressedHighlightTimer = null;
  document.querySelectorAll(".receiver-pressed-highlight").forEach((node) => node.remove());
}

function renderReceiverDevices() {
  if (!receiverDeviceList) return;
  if (!state.receiverDevices.length) {
    receiverDeviceList.innerHTML = '<p class="server-status">No receiver devices created yet.</p>';
    return;
  }
  receiverDeviceList.innerHTML = "";
  const hiddenRevokedCount = state.receiverDevices.filter(device => device.status === "revoked").length;
  const devicesToRender = state.showRevokedDevices
    ? state.receiverDevices
    : state.receiverDevices.filter(device => device.status !== "revoked");
  if (!devicesToRender.length) {
    receiverDeviceList.innerHTML = `
      <p class="server-status">No active receiver devices. ${hiddenRevokedCount} revoked device${hiddenRevokedCount === 1 ? "" : "s"} hidden.</p>
      <button class="secondary-button compact" type="button" data-toggle-revoked-devices>Show revoked</button>
    `;
    receiverDeviceList.querySelector("[data-toggle-revoked-devices]")?.addEventListener("click", toggleRevokedDevices);
    return;
  }
  const householdOrder = state.receiverHouseholds.map(household => household.id);
  if (hiddenRevokedCount) {
    const toggleRow = document.createElement("div");
    toggleRow.className = "provisioning-filter-row";
    toggleRow.innerHTML = `
      <span>${state.showRevokedDevices ? "Revoked devices shown" : `${hiddenRevokedCount} revoked device${hiddenRevokedCount === 1 ? "" : "s"} hidden`}</span>
      <button class="secondary-button compact" type="button" data-toggle-revoked-devices>
        ${state.showRevokedDevices ? "Hide revoked" : "Show revoked"}
      </button>
    `;
    toggleRow.querySelector("[data-toggle-revoked-devices]")?.addEventListener("click", toggleRevokedDevices);
    receiverDeviceList.append(toggleRow);
  }
  const sortedDevices = [...devicesToRender].sort((first, second) => {
    const firstHousehold = householdOrder.indexOf(first.receiverHouseholdId);
    const secondHousehold = householdOrder.indexOf(second.receiverHouseholdId);
    const firstRank = firstHousehold === -1 ? Number.MAX_SAFE_INTEGER : firstHousehold;
    const secondRank = secondHousehold === -1 ? Number.MAX_SAFE_INTEGER : secondHousehold;
    if (firstRank !== secondRank) return firstRank - secondRank;
    return new Date(second.updatedAt || second.createdAt || 0).getTime() - new Date(first.updatedAt || first.createdAt || 0).getTime();
  });
  let currentHouseholdId = "";
  sortedDevices.forEach(device => {
    if (device.receiverHouseholdId !== currentHouseholdId) {
      currentHouseholdId = device.receiverHouseholdId;
      const header = document.createElement("div");
      header.className = "provisioning-household-header";
      header.innerHTML = `
        <strong>${escapeHtml(receiverHouseholdName(currentHouseholdId))}</strong>
        <span>${escapeHtml(receiverHouseholdPeopleLabel(currentHouseholdId))}</span>
      `;
      receiverDeviceList.append(header);
    }
    const activeToken = state.setupTokens.find(token =>
      token.receiverDeviceId === device.id && token.status === "active"
    );
    const pairedLabel = device.pairedAt
      ? `Paired ${formatShortDateTime(device.pairedAt)}`
      : device.status === "setup_pending"
        ? "Waiting for pairing"
        : "Not paired";
    const presence = device.presence || {};
    const lastSeen = device.lastSeenAt ? `Last seen ${formatShortDateTime(device.lastSeenAt)}` : "No heartbeat yet";
    const connectionLine = device.pairedAt
      ? `${pairedLabel} · ${lastSeen}`
      : `Waiting for pairing · ${lastSeen}`;
    const status = activeToken ? "setup link active" : formatToken(device.status || "unknown");
    const presenceLabel = presence.label || "Presence unknown";
    const presenceClass = presence.state || "offline";
    const canRevoke = device.status !== "revoked" && device.status !== "setup_pending";
    const row = document.createElement("article");
    row.className = "receiver-option provisioning-option";
    row.dataset.deviceRow = device.id;
    row.innerHTML = `
      <span>
        <strong>${escapeHtml(device.name || device.id)}</strong>
        <small>${escapeHtml(device.locationLabel || "No location")} · ${escapeHtml(receiverHouseholdName(device.receiverHouseholdId))} · ${escapeHtml(status)} · ${escapeHtml(presenceLabel)}</small>
        <small>${escapeHtml(connectionLine)}</small>
      </span>
      <span class="provisioning-actions">
        <span class="receiver-status-dot ${escapeHtml(presenceClass)}"></span>
        <button class="secondary-button compact" type="button" data-detail-device="${escapeHtml(device.id)}">
          ${state.expandedReceiverDeviceId === device.id ? "Hide details" : "Details"}
        </button>
        <button class="secondary-button compact" type="button" data-setup-device="${escapeHtml(device.id)}">
          ${device.status === "revoked" ? "Re-pair" : "New link"}
        </button>
        <button class="secondary-button compact danger" type="button" data-revoke-device="${escapeHtml(device.id)}" ${canRevoke ? "" : "disabled"}>
          Revoke
        </button>
      </span>
    `;
    if (state.expandedReceiverDeviceId === device.id) {
      row.insertAdjacentHTML("beforeend", renderReceiverDeviceDetail(device.id));
    }
    row.querySelector("[data-detail-device]")?.addEventListener("click", () => toggleReceiverDeviceDetail(device.id));
    row.querySelector("[data-setup-device]")?.addEventListener("click", () => createSetupLink(device.id));
    row.querySelector("[data-revoke-device]")?.addEventListener("click", () => revokeReceiverDevice(device.id));
    row.querySelector("[data-save-device]")?.addEventListener("click", () => updateReceiverDevice(device.id));
    row.querySelector("[data-move-device]")?.addEventListener("click", () => moveReceiverDeviceHousehold(device.id));
    row.querySelectorAll("[data-revoke-setup-token]").forEach((button) => {
      button.addEventListener("click", () => revokeSetupToken(button.dataset.revokeSetupToken, device.id));
    });
    receiverDeviceList.append(row);
  });
}

function toggleRevokedDevices() {
  state.showRevokedDevices = !state.showRevokedDevices;
  persistDashboardState();
  renderReceiverDevices();
}

function renderReceiverDeviceDetail(receiverDeviceId) {
  const detail = state.receiverDeviceDetails[receiverDeviceId];
  if (!detail) {
    return '<div class="receiver-device-detail"><p class="server-status">Loading device detail...</p></div>';
  }
  if (detail.ok === false) {
    return `<div class="receiver-device-detail"><p class="server-status">${escapeHtml(detail.error || "Device detail unavailable.")}</p></div>`;
  }
  const tokens = detail.setupTokens || [];
  const events = detail.auditEvents || [];
  const household = detail.receiverHousehold;
  const device = detail.receiverDevice || {};
  const canEdit = device.status !== "revoked";
  const householdOptions = state.receiverHouseholds.map(item => `
    <option value="${escapeHtml(item.id)}" ${item.id === device.receiverHouseholdId ? "selected" : ""}>${escapeHtml(item.displayName || item.id)}</option>
  `).join("");
  return `
    <div class="receiver-device-detail">
      <div class="detail-grid">
        <span>
          <strong>Household</strong>
          <em>${escapeHtml(household?.displayName || "Unknown")}</em>
        </span>
        <span>
          <strong>Setup tokens</strong>
          <em>${tokens.length}</em>
        </span>
        <span>
          <strong>Audit events</strong>
          <em>${events.length}</em>
        </span>
      </div>
      <div class="device-edit-grid">
        <label>
          <span>Name</span>
          <input type="text" data-edit-device-name value="${escapeHtml(device.name || "")}" ${canEdit ? "" : "disabled"}>
        </label>
        <label>
          <span>Location</span>
          <input type="text" data-edit-device-location value="${escapeHtml(device.locationLabel || "")}" ${canEdit ? "" : "disabled"}>
        </label>
        <button class="secondary-button compact" type="button" data-save-device="${escapeHtml(receiverDeviceId)}" ${canEdit ? "" : "disabled"}>
          Save
        </button>
      </div>
      <div class="device-assignment-grid">
        <label>
          <span>Receiver household</span>
          <select data-edit-device-household ${canEdit ? "" : "disabled"}>
            ${householdOptions}
          </select>
        </label>
        <button class="secondary-button compact" type="button" data-move-device="${escapeHtml(receiverDeviceId)}" ${canEdit ? "" : "disabled"}>
          Move
        </button>
      </div>
      <p class="detail-note">Moving a receiver keeps its device token but revokes active setup links for that device.</p>
      <div class="detail-columns">
        <div>
          <strong>Setup history</strong>
          ${tokens.length ? `
            <ul>
              ${tokens.slice(0, 6).map(token => `
                <li>
                  ${escapeHtml(formatToken(token.status || "unknown"))} · ${escapeHtml(token.setupCode || "no code")} · ${escapeHtml(setupTokenTimeLabel(token))}
                  ${token.status === "active" ? `
                    <button class="inline-link-button danger" type="button" data-revoke-setup-token="${escapeHtml(token.token)}">
                      Revoke link
                    </button>
                  ` : ""}
                </li>
              `).join("")}
            </ul>
          ` : '<p>No setup tokens yet.</p>'}
        </div>
        <div>
          <strong>Recent events</strong>
          ${events.length ? `
            <ul>
              ${events.slice(0, 6).map(event => `
                <li>${escapeHtml(formatProvisioningEventType(event.type))} · ${escapeHtml(provisioningEventDetail(event))}</li>
              `).join("")}
            </ul>
          ` : '<p>No device events yet.</p>'}
        </div>
      </div>
    </div>
  `;
}

function selectedReceiverHouseholdId() {
  return setupHouseholdSelect?.value ||
    state.selectedReceiverHouseholdId ||
    state.receiverHouseholds[0]?.id ||
    "receiver-household-elizabeth-robert";
}

function receiverHouseholdName(receiverHouseholdId) {
  return state.receiverHouseholds.find(household => household.id === receiverHouseholdId)?.displayName ||
    receiverHouseholdId ||
    "Unassigned household";
}

function receiverHouseholdPeopleLabel(receiverHouseholdId) {
  const household = state.receiverHouseholds.find(item => item.id === receiverHouseholdId);
  if (!household) return "No receiver people modeled";
  const people = household.receiverPeople || [];
  return people.length
    ? people.map(person => person.displayName).join(", ")
    : "No receiver people modeled";
}

function selectedHouseholdProvisioningSummary(receiverHouseholdId) {
  return state.provisioningSummary?.households?.find(household => household.id === receiverHouseholdId) || null;
}

function summaryCountLine(summary) {
  if (!summary) return "";
  const statuses = summary.devicesByStatus || {};
  const presence = summary.devicesByPresence || {};
  return [
    `${summary.activeReceiverDeviceCount || 0} active`,
    statuses.setup_pending ? `${statuses.setup_pending} setup pending` : "",
    presence.online ? `${presence.online} online` : "",
    presence.stale ? `${presence.stale} recently seen` : "",
    presence.offline ? `${presence.offline} offline` : "",
    presence.not_paired ? `${presence.not_paired} not paired` : "",
  ].filter(Boolean).join(" · ");
}

function renderProvisioningHouseholds() {
  if (setupHouseholdSelect && state.receiverHouseholds.length) {
    const currentValue = selectedReceiverHouseholdId();
    setupHouseholdSelect.innerHTML = state.receiverHouseholds.map(household => `
      <option value="${escapeHtml(household.id)}">${escapeHtml(household.displayName || household.id)}</option>
    `).join("");
    setupHouseholdSelect.value = state.receiverHouseholds.some(household => household.id === currentValue)
      ? currentValue
      : state.receiverHouseholds[0].id;
    state.selectedReceiverHouseholdId = setupHouseholdSelect.value;
  }

  if (!provisioningHouseholdSummary) return;
  const selected = state.receiverHouseholds.find(household => household.id === selectedReceiverHouseholdId());
  if (!selected) {
    provisioningHouseholdSummary.innerHTML = '<p class="server-status">No receiver household loaded.</p>';
    return;
  }
  const householdDevices = state.receiverDevices.filter(device => device.receiverHouseholdId === selected.id);
  const detail = state.receiverHouseholdDetails[selected.id];
  const summary = detail?.summary || selectedHouseholdProvisioningSummary(selected.id);
  const detailDevices = detail?.receiverDevices || householdDevices;
  const detailTokens = detail?.setupTokens || [];
  const recentEvents = detail?.auditEvents || [];
  const canArchiveHousehold = selected.source === "connect_provisioning" && selected.active !== false;
  const canRestoreHousehold = selected.source === "connect_provisioning" && selected.active === false;
  const archivePending = state.pendingHouseholdArchiveId === selected.id;
  provisioningHouseholdSummary.innerHTML = `
    <div>
      <strong>${escapeHtml(selected.displayName || selected.id)}</strong>
      <span>${selected.active === false ? "Archived" : escapeHtml(receiverHouseholdPeopleLabel(selected.id))}</span>
    </div>
    <small>${detailDevices.length} receiver device${detailDevices.length === 1 ? "" : "s"} in this household · ${escapeHtml(formatToken(selected.defaultTarget || "household"))}</small>
    ${summary ? `<small>${escapeHtml(summaryCountLine(summary))}</small>` : ""}
    ${detail ? renderReceiverHouseholdDetailSummary(detail, detailTokens, recentEvents) : '<small>Loading household drill-down...</small>'}
    ${canArchiveHousehold || canRestoreHousehold ? `
      <div class="household-admin-actions">
        ${canArchiveHousehold ? `
          <button class="secondary-button compact danger ${archivePending ? "confirming" : ""}" type="button" data-deactivate-household="${escapeHtml(selected.id)}" data-deactivate-household-name="${escapeHtml(selected.displayName || "receiver household")}">
            ${archivePending ? "Confirm archive" : "Archive household"}
          </button>
        ` : ""}
        ${canRestoreHousehold ? `
          <button class="secondary-button compact" type="button" data-restore-household="${escapeHtml(selected.id)}">
            Restore household
          </button>
        ` : ""}
      </div>
    ` : ""}
  `;
  if (!detail) {
    loadReceiverHouseholdDetail(selected.id);
  }
}

function renderReceiverHouseholdDetailSummary(detail, setupTokens, auditEvents) {
  if (detail.loading) {
    return '<small>Loading household drill-down...</small>';
  }
  if (detail.ok === false) {
    return `<small>${escapeHtml(detail.error || "Household detail unavailable.")}</small>`;
  }
  const summary = detail.summary || {};
  const activeTokens = summary.activeSetupTokenCount || 0;
  const tokenCount = setupTokens.length || summary.setupTokenCount || 0;
  const recent = auditEvents.slice(0, 2);
  const people = detail.receiverHousehold?.receiverPeople || [];
  const inactivePeople = detail.inactiveReceiverPeople || [];
  return `
    <div class="household-people-list">
      ${people.length ? people.map(person => {
        const removalPending = state.pendingReceiverPersonRemovalId === person.id;
        return `
        <span class="household-person-chip">
          <span class="person-name-chip">${escapeHtml(person.displayName || person.id)}</span>
          ${person.source === "connect_provisioning" ? `
            <button class="chip-remove-button ${removalPending ? "confirming" : ""}" type="button" data-remove-receiver-person="${escapeHtml(person.id)}" data-remove-receiver-person-name="${escapeHtml(person.displayName || "receiver person")}" aria-label="${removalPending ? "Confirm remove" : "Remove"} ${escapeHtml(person.displayName || "receiver person")}">
              ${removalPending ? "Confirm" : "Remove"}
            </button>
          ` : ""}
        </span>
      `;}).join("") : '<span class="household-person-chip"><span class="person-name-chip">No receiver people yet</span></span>'}
    </div>
    ${inactivePeople.length ? `
      <div class="household-people-list inactive">
        ${inactivePeople.map(person => `
          <span class="household-person-chip">
            <span class="person-name-chip inactive">${escapeHtml(person.displayName || person.id)}</span>
            <button class="chip-remove-button restore" type="button" data-restore-receiver-person="${escapeHtml(person.id)}" aria-label="Restore ${escapeHtml(person.displayName || "receiver person")}">
              Restore
            </button>
          </span>
        `).join("")}
      </div>
    ` : ""}
    <div class="household-detail-metrics">
      <span><strong>${summary.activeReceiverDeviceCount || 0}</strong><em>active devices</em></span>
      <span><strong>${activeTokens}/${tokenCount}</strong><em>active setup links</em></span>
      <span><strong>${auditEvents.length}</strong><em>recent events</em></span>
    </div>
    ${recent.length ? `
      <div class="household-event-list">
        ${recent.map(event => `
          <span>${escapeHtml(formatProvisioningEventType(event.type))} · ${escapeHtml(provisioningEventDetail(event))}</span>
        `).join("")}
      </div>
    ` : '<small>No household events yet.</small>'}
  `;
}

function renderSetupChecklist() {
  if (!setupChecklist) return;
  const device = selectedProvisioningDevice();
  if (!device) {
    setupChecklist.innerHTML = '<p class="server-status">Create a setup link to begin receiver provisioning.</p>';
    return;
  }
  const tokens = setupTokensForDevice(device.id);
  const activeToken = tokens.find(token => token.status === "active");
  const usedToken = tokens.find(token => token.status === "used");
  const steps = [
    {
      label: "Receiver device record",
      complete: Boolean(device.id),
      detail: device.name || device.id,
    },
    {
      label: "Single-use setup link",
      complete: Boolean(activeToken || usedToken),
      detail: activeToken
        ? `${activeToken.setupCode || "Active"} expires ${formatShortDateTime(activeToken.expiresAt)}`
        : usedToken
          ? "Used"
          : "Not created",
    },
    {
      label: "Device token paired",
      complete: Boolean(device.pairedAt && device.status !== "revoked"),
      detail: device.pairedAt ? formatShortDateTime(device.pairedAt) : "Waiting for receiver",
    },
    {
      label: "Receiver heartbeat",
      complete: ["online", "stale"].includes(device.presence?.state),
      detail: device.presence?.label
        ? `${device.presence.label}${device.lastSeenAt ? ` · ${formatShortDateTime(device.lastSeenAt)}` : ""}`
        : "No heartbeat yet",
    },
  ];
  setupChecklist.innerHTML = `
    <div class="setup-progress-heading">
      <strong>${escapeHtml(device.name || "Receiver setup")}</strong>
      <span>${escapeHtml(formatToken(device.status || "unknown"))}</span>
    </div>
    <div class="setup-progress-list">
      ${steps.map(step => `
        <span class="setup-progress-item ${step.complete ? "complete" : "pending"}">
          <strong>${step.complete ? "✓" : "•"}</strong>
          <span>
            ${escapeHtml(step.label)}
            <em>${escapeHtml(step.detail)}</em>
          </span>
        </span>
      `).join("")}
    </div>
  `;
}

function selectedProvisioningDevice() {
  return state.receiverDevices.find(device => device.receiverId === state.receiverId) ||
    state.receiverDevices.find(device => device.status === "setup_pending") ||
    state.receiverDevices.find(device => device.status !== "revoked") ||
    state.receiverDevices[0] ||
    null;
}

function renderProvisioningAudit() {
  if (!provisioningAudit) return;
  const events = state.provisioningAuditEvents || [];
  if (!events.length) {
    provisioningAudit.innerHTML = '<p class="server-status">No provisioning events yet.</p>';
    return;
  }
  provisioningAudit.innerHTML = `
    <div class="audit-heading">
      <strong>Provisioning events</strong>
      <span>${events.length} recent</span>
    </div>
    <div class="audit-event-list">
      ${events.slice(0, 6).map(event => `
        <span class="audit-event-row">
          <strong>${escapeHtml(formatProvisioningEventType(event.type))}</strong>
          <small>${escapeHtml(provisioningEventDetail(event))}</small>
        </span>
      `).join("")}
    </div>
  `;
}

function formatProvisioningEventType(type) {
  return formatToken(String(type || "event").replace(/^receiver_device\./, "").replace(/^setup_token\./, ""));
}

function provisioningEventDetail(event) {
  return [
    event.name || event.receiverDeviceId,
    event.setupCode,
    event.createdAt ? formatShortDateTime(event.createdAt) : "",
  ].filter(Boolean).join(" · ");
}

function setupTokensForDevice(receiverDeviceId) {
  return state.setupTokens
    .filter(token => token.receiverDeviceId === receiverDeviceId)
    .sort((first, second) => new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime())
    .slice(0, 4);
}

function renderSetupTokenHistory(tokens) {
  if (!tokens.length) {
    return '<span class="setup-history muted">No setup links yet.</span>';
  }
  return `
    <span class="setup-history">
      ${tokens.map(token => `
        <span class="setup-history-item ${escapeHtml(token.status || "unknown")}">
          ${escapeHtml(formatToken(token.status || "unknown"))}
          <em>${escapeHtml(setupTokenHistoryLabel(token))}</em>
        </span>
      `).join("")}
    </span>
  `;
}

function setupTokenHistoryLabel(token) {
  const timeLabel = setupTokenTimeLabel(token);
  if (token.status === "active" && token.setupCode) {
    return `${token.setupCode} · ${timeLabel}`;
  }
  return timeLabel;
}

function setupTokenTimeLabel(token) {
  if (token.usedAt) return formatShortDateTime(token.usedAt);
  if (token.status === "active" && token.expiresAt) return `expires ${formatShortDateTime(token.expiresAt)}`;
  if (token.createdAt) return formatShortDateTime(token.createdAt);
  return "";
}

function formatShortDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function activeTerms() {
  return state.retroTerms ? terms.retro : terms.modern;
}

function term(key) {
  return activeTerms()[key] || terms.modern[key] || key;
}

function applyPresentationLayer() {
  document.body.classList.toggle("retro", state.visualTheme === "retro");
  document.body.classList.toggle("woodgrain", state.visualTheme === "woodgrain");
  termNodes.forEach((node) => {
    node.textContent = term(node.dataset.term);
  });
  document.querySelector('[data-term="startButton"]').textContent = state.retroTerms
    ? `Call ${state.recipient}`
    : "Start Connect Request";
  requestTitle.textContent = state.retroTerms ? `Call ${state.recipient}` : `Talk to ${state.recipient}`;
  goalText.textContent = `Live conversation with ${state.recipient}`;
  if (messageComposerTitle) {
    messageComposerTitle.textContent = `Send a Message to ${state.recipient}`;
  }
  if (!state.activeEndpoint) {
    endpointLabel.textContent = term("activeEndpoint");
  }
  renderStatus();
}

function displayStatus(status) {
  return state.retroTerms ? retroStatusLabels[status] || status : status;
}

function displayTimelineLabel(status) {
  return state.retroTerms
    ? retroStatusLabels[status] || statusLabels[status] || status
    : statusLabels[status] || status;
}

function renderStatus() {
  const statusText = (state.retroTerms ? retroStatusLabels[state.status] : statusLabels[state.status]) || state.status;
  const callStatusText = callStatusPillLabels[state.status] || statusText;
  conversationStatus.textContent = displayStatus(state.status);
  connectionPill.textContent = statusText;
  if (callStatusPill) {
    callStatusPill.dataset.status = state.status;
    const label = callStatusPill.querySelector("strong");
    if (label) label.textContent = callStatusText;
    const receiverLabel = callStatusPill.querySelector("small");
    if (receiverLabel) {
      receiverLabel.textContent = selectedReceiverPreviewOption()?.label || state.receiverId || "Receiver";
    }
  }
  renderIncomingCallModal();
}

function renderIncomingCallModal() {
  if (!incomingCallModal) return;
  const isIncoming = state.status === "notified";
  incomingCallModal.classList.toggle("hidden", !isIncoming);
  document.body.classList.toggle("incoming-call-active", isIncoming && state.activeDashboardSection === "call");
  if (!isIncoming) return;
  if (incomingCallTitle) incomingCallTitle.textContent = `${state.caregiver} is calling`;
  if (incomingCallInstruction) incomingCallInstruction.textContent = "Press Answer to talk.";
  if (incomingCallAvatar) {
    incomingCallAvatar.textContent = String(state.caregiver || "?").trim().charAt(0).toUpperCase() || "?";
  }
}

function createAudio(src, loop = false) {
  return browserAudio.createAudio(src, { loop });
}

function stopActiveAudio() {
  browserAudio.stop();

  if (state.ringbackAudio) {
    state.ringbackAudio.pause();
    state.ringbackAudio.currentTime = 0;
    state.ringbackAudio = null;
  }
  if (state.ringbackTimer) {
    window.clearTimeout(state.ringbackTimer);
    state.ringbackTimer = null;
  }
}

function playAudio(name, options = {}) {
  if (!state.retroAudio) return;
  browserAudio.play(audioPack[name], {
    loop: Boolean(options.loop),
    stopActive: false,
    active: false,
    enhanceSpeech: false,
  });
}

function playButtonPressAudio() {
  if (!state.retroAudio) return;
  browserAudio.playOneShot(audioPack.button, 0.35);
}

function startOutgoingRingback() {
  if (!state.retroAudio || state.ringbackTimer || state.ringbackAudio) return;

  const playOnce = () => {
    if (!state.retroAudio || !["requested", "notified"].includes(state.status)) {
      state.ringbackTimer = null;
      state.ringbackAudio = null;
      return;
    }

    const audio = createAudio(audioPack.ringback);
    state.ringbackAudio = audio;
    const hardStop = window.setTimeout(() => {
      if (state.ringbackAudio === audio) {
        audio.pause();
        audio.currentTime = 0;
        state.ringbackAudio = null;
        state.ringbackTimer = window.setTimeout(playOnce, 2000);
      }
    }, 7000);
    audio.addEventListener(
      "ended",
      () => {
        window.clearTimeout(hardStop);
        if (state.ringbackAudio === audio) {
          state.ringbackAudio = null;
        }
        state.ringbackTimer = window.setTimeout(playOnce, 2000);
      },
      { once: true },
    );
    audio.play().catch(() => {
      window.clearTimeout(hardStop);
      if (state.ringbackAudio === audio) {
        state.ringbackAudio = null;
      }
      state.ringbackTimer = window.setTimeout(playOnce, 2000);
    });
  };

  playOnce();
}

function playUnavailableSequence() {
  if (!state.retroAudio) return;
  const sit = createAudio(audioPack.sit);
  sit.addEventListener(
    "ended",
    () => {
      playAudio("unavailable");
    },
    { once: true },
  );
  sit.play().catch(() => {
    playAudio("unavailable");
  });
}

function setStatus(status) {
  state.status = status;
  renderStatus();
}

function nowStamp() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

function clearTimers() {
  state.timers.forEach((timer) => window.clearTimeout(timer));
  state.timers = [];
}

function stopCallStatePolling() {
  if (state.callStatePollTimer) {
    window.clearInterval(state.callStatePollTimer);
    state.callStatePollTimer = null;
  }
}

function addTimer(callback, delay) {
  const timer = window.setTimeout(callback, delay);
  state.timers.push(timer);
}

function addTimeline(status, message, tone = "done") {
  const item = document.createElement("li");
  item.className = tone;
  item.innerHTML = `<span></span><p><strong>${displayTimelineLabel(status)}</strong> ${message}</p>`;
  timeline.append(item);
}

function resetTimeline() {
  timeline.innerHTML = "";
}

function setRecipientControls(enabled) {
  acceptButton.disabled = !enabled;
  declineButton.disabled = !enabled;
  ignoreButton.disabled = !enabled;
  endButton.disabled = true;
}

function setEndControl(enabled) {
  endButton.disabled = !enabled;
}

function setRequestControls(disabled) {
  startButton.disabled = disabled;
  personCards.forEach((card) => {
    card.disabled = disabled;
  });
}

function logAudit(outcome) {
  if (auditList.querySelector(".empty")) {
    auditList.innerHTML = "";
  }

  const item = document.createElement("article");
  item.className = "audit-item";
  item.innerHTML = `
    <p><strong>${state.caregiver}</strong> requested a live conversation with <strong>${state.recipient}</strong>.</p>
    <small>${nowStamp()} · ${outcome} · ${state.activeEndpoint || "No endpoint"}</small>
  `;
  auditList.prepend(item);
}

function updateRecipientDisplay(mode) {
  if (mode === "idle") {
    endpointLabel.textContent = term("activeEndpoint");
    deviceStage.classList.remove("ringing");
    deviceLine.textContent = "Waiting for a Connect Request.";
    deviceSubline.textContent = "A live conversation starts only if the recipient accepts.";
    return;
  }

  if (mode === "ringing") {
    endpointLabel.textContent = state.activeEndpoint;
    deviceStage.classList.add("ringing");
    deviceLine.textContent = state.retroTerms
      ? `Incoming call from ${state.caregiver}.`
      : `${state.caregiver} would like to talk with you.`;
    deviceSubline.textContent = state.retroTerms
      ? `Answer to begin a live conversation from ${state.location}.`
      : `Accept to begin a live conversation from ${state.location}.`;
    return;
  }

  if (mode === "connected") {
    deviceStage.classList.remove("ringing");
    deviceLine.textContent = `Connected with ${state.caregiver}.`;
    deviceSubline.textContent = "Live conversation in progress.";
    return;
  }

  if (mode === "ended") {
    deviceStage.classList.remove("ringing");
    deviceLine.textContent = "Conversation ended.";
    deviceSubline.textContent = "The live session has been closed.";
    return;
  }

  if (mode === "closed") {
    deviceStage.classList.remove("ringing");
    deviceSubline.textContent = "Conversation was not established.";
  }
}

function displayModeForCurrentStatus() {
  if (!state.activeEndpoint) return "idle";
  if (state.status === "connected") return "connected";
  if (state.status === "ended") return "ended";
  if (state.status === "notified") return "ringing";
  if (state.status === "declined" || state.status === "no_response" || state.status === "failed") return "closed";
  return "idle";
}

function startConnectRequest(event) {
  event.preventDefault();
  clearTimers();
  stopActiveAudio();

  const endpoints = selectedEndpoints();
  if (!endpoints.length) {
    resetTimeline();
    addTimeline("failed", "Select at least one approved endpoint.", "failed");
    setStatus("failed");
    playUnavailableSequence();
    return;
  }

  state.requestId += 1;
  state.activeEndpoint = endpoints[0];
  setStatus("requested");
  setRequestControls(true);
  setRecipientControls(false);
  resetTimeline();
  updateRecipientDisplay("idle");

  addTimeline("requested", `${state.caregiver} started a Connect Request to talk with ${state.recipient}.`);
  logAudit("requested");
  startOutgoingRingback();
  triggerLocalReceiverCall();

  addTimer(() => {
    setStatus("notified");
    updateRecipientDisplay("ringing");
    setRecipientControls(true);
    addTimeline("notified", `Conversation invitation reached ${state.activeEndpoint}.`);
  }, 650);

  addTimer(() => {
    if (state.status === "notified") {
      setStatus("no_response");
      setRecipientControls(false);
      setRequestControls(false);
      updateRecipientDisplay("closed");
      deviceLine.textContent = `${state.recipient} did not respond.`;
      addTimeline("no_response", "No approved endpoint produced an acceptance before timeout.", "failed");
      logAudit("no_response");
      stopActiveAudio();
      playUnavailableSequence();
    }
  }, 15000);
}

async function triggerLocalReceiverCall() {
  refreshLocalSettings();
  localServerStatus.textContent = `Sending call to ${state.receiverId} via ${state.localServerUrl}...`;
  try {
    const response = await fetch(`${state.localServerUrl}/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        receiverId: state.receiverId,
        callerName: state.caregiver,
        recipientName: state.recipient,
      }),
    });
    if (!response.ok) {
      throw new Error(`Local server returned ${response.status}`);
    }
    const body = await response.json();
    state.activeCallId = body.call.callId;
    const receiver = state.receivers.find(item => item.receiverId === state.receiverId);
    localServerStatus.textContent = `Call sent to ${receiver?.displayName || state.receiverId}. Waiting for receiver state...`;
    addTimeline("notified", `Local Android receiver trigger sent to ${state.receiverId}.`);
    startCallStatePolling();
  } catch (error) {
    localServerStatus.textContent = "Local trigger unavailable. Browser simulation is still active.";
    addTimeline("failed", "Local receiver server not available; using browser-only simulation.", "failed");
  }
}

function startCallStatePolling() {
  if (!state.activeCallId || state.callStatePollTimer) return;
  state.callStatePollTimer = window.setInterval(async () => {
    try {
      const response = await fetch(`${state.localServerUrl}/calls/${state.activeCallId}`);
      if (!response.ok) return;
      const body = await response.json();
      applyRemoteCallState(body.call.state);
    } catch {
      // Keep the local browser simulation alive if the server disappears during a test.
    }
  }, 1200);
}

function startMessagePolling() {
  if (state.messagePollTimer) return;
  state.messagePollTimer = window.setInterval(refreshReceiverMessages, 2500);
}

function applyRemoteCallState(remoteState) {
  if (remoteState === "answered" && ["requested", "notified"].includes(state.status)) {
    localServerStatus.textContent = "Receiver answered.";
    acceptConversation();
    return;
  }
  if (remoteState === "declined" && ["requested", "notified"].includes(state.status)) {
    localServerStatus.textContent = "Receiver declined.";
    declineConversation();
    return;
  }
  if (remoteState === "receiver_unavailable" && ["requested", "notified"].includes(state.status)) {
    localServerStatus.textContent = "Receiver unavailable.";
    ignoreConversation();
    return;
  }
  if (remoteState === "hung_up" && state.status === "connected") {
    localServerStatus.textContent = "Receiver hung up.";
    endConversation();
  }
}

function acceptConversation() {
  if (state.status !== "notified") return;

  clearTimers();
  stopActiveAudio();
  setRecipientControls(false);
  setStatus("accepted");
  addTimeline("accepted", `${state.recipient} accepted the conversation invitation.`);

  addTimer(() => {
    setStatus("connecting");
    addTimeline("connecting", "CarePland is establishing the live conversation.");
  }, 450);

  addTimer(() => {
    setStatus("connected");
    setRequestControls(true);
    setEndControl(true);
    updateRecipientDisplay("connected");
    addTimeline("connected", `Live conversation started between ${state.caregiver} and ${state.recipient}.`);
    logAudit("connected");
  }, 1200);
}

function endConversation() {
  if (state.status !== "connected") return;
  reportLocalCallState("hung_up");
  clearTimers();
  stopCallStatePolling();
  stopActiveAudio();
  setEndControl(false);
  setRequestControls(false);
  setStatus("ended");
  updateRecipientDisplay("ended");
  addTimeline("ended", `Live conversation between ${state.caregiver} and ${state.recipient} ended.`);
  logAudit("ended");
}

function declineConversation() {
  if (state.status !== "notified") return;
  reportLocalCallState("declined");
  clearTimers();
  stopCallStatePolling();
  stopActiveAudio();
  setRecipientControls(false);
  setRequestControls(false);
  setStatus("declined");
  updateRecipientDisplay("closed");
  deviceLine.textContent = `${state.recipient} declined the invitation.`;
  addTimeline("declined", "Conversation was not established.", "failed");
  logAudit("declined");
  playAudio("busy");
}

function ignoreConversation() {
  if (state.status !== "notified") return;
  reportLocalCallState("receiver_unavailable");
  clearTimers();
  stopCallStatePolling();
  stopActiveAudio();
  setRecipientControls(false);
  setRequestControls(false);
  setStatus("no_response");
  updateRecipientDisplay("closed");
  deviceLine.textContent = `${state.recipient} did not respond.`;
  addTimeline("no_response", "Conversation invitation expired without acceptance.", "failed");
  logAudit("no_response");
  playUnavailableSequence();
}

function resetFlow() {
  if (state.activeCallId && ["requested", "notified", "accepted", "connecting", "connected"].includes(state.status)) {
    reportLocalCallState("hung_up");
  }
  clearTimers();
  stopCallStatePolling();
  stopActiveAudio();
  state.activeEndpoint = null;
  state.activeCallId = null;
  localServerStatus.textContent = "Local trigger ready.";
  setStatus("ready");
  setRequestControls(false);
  setRecipientControls(false);
  resetTimeline();
  addTimeline("ready", "Ready to initiate a Connect Request.", "pending");
  updateRecipientDisplay("idle");
}

async function reportLocalCallState(remoteState) {
  if (!state.activeCallId) return;
  try {
    await fetch(`${state.localServerUrl}/calls/${state.activeCallId}/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: remoteState }),
    });
  } catch {
    // Best-effort local sync only.
  }
}

function chooseRecipient(card) {
  if (startButton.disabled) return;
  personCards.forEach((item) => item.classList.remove("selected"));
  card.classList.add("selected");
  state.recipient = card.dataset.recipient;
  state.location = card.dataset.location;
  state.caregiver = card.dataset.caregiver;
  persistDashboardState();
  applyPresentationLayer();
  resetFlow();
}

form?.addEventListener("submit", startConnectRequest);
visualTheme?.addEventListener("change", () => {
  state.visualTheme = visualTheme.value;
  applyPresentationLayer();
  persistDashboardState();
});
retroAudio?.addEventListener("change", () => {
  state.retroAudio = retroAudio.checked;
  persistDashboardState();
  if (!state.retroAudio) {
    stopActiveAudio();
  }
});
acceptButton?.addEventListener("click", acceptConversation);
incomingAnswerButton?.addEventListener("click", acceptConversation);
endButton?.addEventListener("click", endConversation);
declineButton?.addEventListener("click", declineConversation);
incomingNotNowButton?.addEventListener("click", declineConversation);
ignoreButton?.addEventListener("click", ignoreConversation);
resetButton?.addEventListener("click", resetFlow);
refreshReceiversButton?.addEventListener("click", refreshReceivers);
createHouseholdButton?.addEventListener("click", createReceiverHousehold);
createReceiverPersonButton?.addEventListener("click", createReceiverPerson);
showInactiveHouseholds?.addEventListener("change", () => {
  state.showInactiveHouseholds = showInactiveHouseholds.checked;
  persistDashboardState();
  refreshProvisioning();
});
provisioningHouseholdSummary?.addEventListener("click", (event) => {
  const deactivateHouseholdButton = event.target.closest("[data-deactivate-household]");
  if (deactivateHouseholdButton) {
    armHouseholdArchive(
      deactivateHouseholdButton.dataset.deactivateHousehold,
      deactivateHouseholdButton.dataset.deactivateHouseholdName || "receiver household"
    );
    return;
  }
  const restoreHouseholdButton = event.target.closest("[data-restore-household]");
  if (restoreHouseholdButton) {
    restoreReceiverHousehold(restoreHouseholdButton.dataset.restoreHousehold);
    return;
  }
  const restoreButton = event.target.closest("[data-restore-receiver-person]");
  if (restoreButton) {
    restoreReceiverPerson(restoreButton.dataset.restoreReceiverPerson);
    return;
  }
  const button = event.target.closest("[data-remove-receiver-person]");
  if (!button) {
    cancelPendingHouseholdArchive();
    cancelPendingReceiverPersonRemoval();
    return;
  }
  armReceiverPersonRemoval(
    button.dataset.removeReceiverPerson,
    button.dataset.removeReceiverPersonName || "receiver person"
  );
});
createSetupLinkButton?.addEventListener("click", () => createSetupLink());
refreshProvisioningButton?.addEventListener("click", refreshProvisioning);
copySetupLinkButton?.addEventListener("click", copySetupLink);
refreshMessagesButton?.addEventListener("click", refreshReceiverMessages);
messageDetailToggle?.addEventListener("change", () => {
  state.messageDetailView = messageDetailToggle.checked;
  renderReceiverMessages();
  persistDashboardState();
});
messageHistoryPrevButton?.addEventListener("click", () => scrollMessageHistory(-1));
messageHistoryNextButton?.addEventListener("click", () => scrollMessageHistory(1));
receiverMessagesList?.addEventListener("scroll", updateMessageHistoryNav, { passive: true });
window.addEventListener("resize", () => {
  resetHorizontalScroll();
  updateMessageHistoryNav();
});
window.addEventListener("load", resetHorizontalScroll);
refreshAudioProfileButton?.addEventListener("click", refreshAudioProfile);
refreshAudioReviewButton?.addEventListener("click", refreshAudioReview);
refreshAudioArtifactsButton?.addEventListener("click", refreshAudioArtifacts);
retryPendingTranscriptsButton?.addEventListener("click", retryPendingAudioTranscripts);
recoverAudioIndexButton?.addEventListener("click", recoverAudioUploadIndex);
backfillAudioIntegrityButton?.addEventListener("click", backfillAudioIntegrity);
previewAudioMaintenanceButton?.addEventListener("click", previewAudioMaintenance);
backfillAudioTimelineButton?.addEventListener("click", backfillAudioTimeline);
backfillAudioEventLinksButton?.addEventListener("click", backfillAudioEventLinks);
recordCoordinatorMessageButton?.addEventListener("click", toggleCoordinatorMessageRecording);
sendCoordinatorMessageButton?.addEventListener("click", sendCoordinatorAudioMessage);
clearCoordinatorMessageButton?.addEventListener("click", clearCoordinatorAudioMessage);
coordinatorMessageText?.addEventListener("input", updateCoordinatorMessageControls);
refreshCareCircleButton?.addEventListener("click", refreshCareCircleContext);
receiverPreviewSelect?.addEventListener("change", (event) => {
  const input = event.target.closest('input[name="receiverPreview"]');
  if (input) selectReceiverForPreview(input.value);
});
toggleReceiverGuideButton?.addEventListener("click", toggleReceiverGuideMode);
receiverGuideOverlay?.addEventListener("click", showReceiverGuideTarget);
receiverPreviewIframe?.addEventListener("load", () => {
  receiverPreviewFrame?.classList.remove("loading");
});
connectThemePreset?.addEventListener("change", selectConnectThemePreset);
saveConnectThemeButton?.addEventListener("click", persistConnectTheme);
resetConnectThemeButton?.addEventListener("click", resetConnectAppearance);
setupHouseholdSelect?.addEventListener("change", renderProvisioningHouseholds);
setupHouseholdSelect?.addEventListener("change", () => {
  state.selectedReceiverHouseholdId = setupHouseholdSelect.value;
  persistDashboardState();
});
setupDeviceName?.addEventListener("input", persistDashboardState);
setupLocationLabel?.addEventListener("input", persistDashboardState);
localServerUrlInput?.addEventListener("input", () => {
  state.localServerUrl = localServerUrlInput.value.trim() || "http://localhost:8790";
  resetReceiverGuideEventCursor();
  updateAudioManifestLink();
  updateReceiverPreviewUrl({ reload: false });
  persistDashboardState();
});
messageSearch?.addEventListener("input", () => {
  persistDashboardState();
  window.clearTimeout(state.messageSearchTimer);
  state.messageSearchTimer = window.setTimeout(refreshReceiverMessages, 250);
});
personCards.forEach((card) => card.addEventListener("click", () => chooseRecipient(card)));
document.addEventListener("click", (event) => {
  if (event.target.closest("button")) {
    playButtonPressAudio();
  }
});
contactForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = addDraftContact(
    {
      displayName: contactName.value,
      phoneNumber: contactPhone.value,
      email: contactEmail.value,
      relationshipLabel: contactRelationship.value,
    },
    "manual",
  );
  if (result.ok) {
    contactForm.reset();
  }
});
importContactsButton?.addEventListener("click", () => openImportPanel("device"));
careVipsButton?.addEventListener("click", () => openImportPanel("careVip"));
closeImportButton?.addEventListener("click", () => {
  importPanel.classList.add("hidden");
  state.importMode = null;
});

loadDraftContacts();
renderConnectThemeControls();
updateCoordinatorMessageControls();
applyPresentationLayer();
resetFlow();
renderDraftContacts();
watchReceiverPreviewFrame();
refreshReceivers();
refreshProvisioning();
refreshReceiverMessages();
refreshAudioProfile();
refreshCareCircleContext();
startMessagePolling();
startReceiverGuideEventPolling();
