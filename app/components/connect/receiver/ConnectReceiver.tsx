"use client";

import {
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  blobToBase64,
  browserConnectAudioRecordingAvailable,
  connectAudioEnhancementProfileForVariant,
  connectAudioPreferenceFromEvents,
  connectAudioPreferenceWithFeedback,
  connectComfortVolumeLevel,
  createConnectAudioCaptureContext,
  createConnectAudioCaptureId,
  defaultConnectAudioPreference,
  playConnectMessageAudio,
  randomizedConnectComparisonVersions,
  requestConnectAudioTranscription,
  startConnectAudioRecording,
  type ConnectAudioEnhancementProfile,
  type ConnectAudioPreference,
  type ConnectPlaybackHandle,
  type ConnectAudioRecording,
  type ConnectAudioRecordingController,
  type ConnectPlaybackVariant,
} from "../../../lib/connect/audio";
import {
  connectAuthHeaders,
  fetchConnectMainUserContext,
  updateConnectMainUserContext,
} from "../../../lib/connect/context/client";
import {
  TodayFocusList,
  type TodayFocusCadencePreferenceAction,
  type TodayFocusCadencePreferenceCadence,
} from "../../todayFocus/TodayFocusList";
import {
  createConnectCallAudioController,
  type ConnectCallAudioStatus,
  type ConnectCallAudioController,
} from "../../../lib/connect/calls/browserCallAudio";
import { recordConnectCallLifecycleEvent } from "../../../lib/connect/calls/browserCallDiagnostics";
import {
  receiverCallRecordStateIsActive,
  receiverCallUiStateFromRecordState,
  type ReceiverCallUiState,
} from "../../../lib/connect/calls/receiverCallUiState";
import {
  connectPrototypeEndpoints,
  connectPrototypeReceiverId,
} from "../../../lib/connect/prototypeClient";
import { formatBrowserReceiverPairingCode } from "../../../lib/connect/receiverShell/browserPairing";
import {
  formatReceiverCacheTimestamp,
  readReceiverAppointmentCache,
  receiverConnectivityStatusLabel,
  receiverOfflineActionMessage,
  writeReceiverAppointmentCache,
  type ReceiverAppointmentCacheEntry,
} from "../../../lib/connect/receiver/offlineAppointmentCache";
import styles from "./ConnectReceiver.module.css";

type Contact = {
  id: string;
  displayName: string;
  availability: "free" | "busy" | "away";
  availabilityLabel: string;
  canCall: boolean;
};

type ReceiverUser = {
  id: string;
  displayName: string;
  statusLabel: string;
};

type ReceiverTodayFocusHomeItem = {
  completionConfig?: {
    unit?: string | null;
    unitOptions?: string[];
    valuePromptText?: string | null;
  } | null;
  completionType?: string | null;
  id: string;
  kind?: "checkoff" | "weight";
  promptText?: string | null;
  title: string;
};

type ReceiverTodayFocusCompletionInput = {
  unit?: string | null;
  value?: number | null;
};

type ReceiverTodayFocusPendingCompletion = {
  trackEventId: string;
};

type Message = {
  audioArtifactId?: string;
  audioDurationMs?: number;
  audioMimeType?: string;
  audioUrl?: string;
  id: string;
  from: string;
  to: string;
  body: string;
  createdAt: string;
  heardAt?: string;
  mainConnectUserPersonId?: string;
  messageType?: string;
  readAt?: string;
  transcript?: string;
  transcriptStatus?: string;
};

type ReceiverCall = {
  approvedSummaryText?: string;
  callId: string;
  callerName: string;
  generatedSummaryText?: string;
  state: string;
  summaryApprovalDraftText?: string;
  summaryStatus?: string;
  summaryText?: string;
  transcriptCleanupStatus?: string;
  transcriptStatus?: string;
  transcriptText?: string;
};

type SoundSettings = {
  buttonBeeps: boolean;
  comfortVolume: "low" | "med" | "high";
  retroRingers: boolean;
  retroSounds: boolean;
};

type SoundProblem = "speech_only" | "faint_beep" | "no_ringers" | "none";

type SoundHelp = {
  title: string;
  summary: string;
  steps: string[];
  actions?: Array<"enable_sounds" | "set_volume_high">;
};

type ReceiverAttentionItem =
  | {
      kind: "call_summary_review";
      label: "Review";
      priority: 100;
      call: Partial<ReceiverCall>;
    }
  | {
      kind: "new_message";
      label: "Message";
      priority: 80;
      message: Message;
    };

const RECEIVER_CANVAS_WIDTH = 900;
const RECEIVER_CANVAS_HEIGHT = 1047;
const DESK_PHONE_CANVAS_WIDTH = 1024;
const DESK_PHONE_CANVAS_HEIGHT = 600;
const RECEIVER_BINDING_HEARTBEAT_MS = 60_000;
const SCREEN_CLEANING_DURATION_SECONDS = 120;
const DEFAULT_TODAY_FOCUS_UNDO_WINDOW_MS = 10_000;
const receiverAudioPack = {
  button: "/connect/receiver/audio/microwave-beep.mp3",
  incoming: "/connect/receiver/audio/old-phone-ringing.mp3",
  ringback: "/connect/receiver/audio/in-call-ring.wav",
  sit: "/connect/receiver/audio/sit.wav",
  unavailable: "/connect/receiver/audio/number-not-available.mp3",
};

type ReaderTextSize = "standard" | "large" | "extra";

type PendingContactRecording = {
  artifactId?: string;
  audioUrl?: string;
  clientAudioCaptureId: string;
  recording: ConnectAudioRecording;
  transcript: string;
  transcriptStatus: string;
};

type PendingAskAudio = {
  artifactId: string;
  audioByteSize?: number;
  audioMimeType?: string;
  audioSha256?: string;
  audioUrl: string;
  clientAudioCaptureId: string;
  transcript: string;
  transcriptStatus: string;
};

type AutoHearPreference = "on" | "off";
type HearingFeedbackStep = "choice" | "compare" | "thanks" | null;
type PlaybackVariant = ConnectPlaybackVariant;
type ReceiverPlaybackHandle = ConnectPlaybackHandle;
type AudioPreference = ConnectAudioPreference;
type ReceiverAudioEnhancementProfile = ConnectAudioEnhancementProfile;

type ScreenCleaningSession = {
  cleaningCount: number;
  message: string;
  receiverDeviceId: string;
  receiverId: string;
  receiverInstallId: string;
  receiverMode: "Dedicated" | "Personal";
  sessionId: string;
  startedAt: string;
};

type AskAnswer = {
  question: string;
  answer: string;
  actionLabel: string;
  messageBody: string;
  recipientId: string;
  type: "answer" | "message";
};

type TalkApiResult = {
  completed_focus_item_id?: string;
  confidence?: number;
  created_track_event_id?: string;
  decision_trace?: Record<string, unknown>;
  display_response?: string;
  intent?: string;
  needs_confirmation?: boolean;
  needs_review?: boolean;
  proposed_action?: string;
  spoken_response?: string;
  structured_payload?: Record<string, unknown>;
  title?: string;
};

type ReceiverAppointment = {
  id: string;
  title: string;
  startsAt: string;
  providerName?: string;
  providerOrganization?: string;
  locationName?: string;
  locationAddress?: string;
  locationPhone?: string;
  reason?: string;
};

type ReceiverAppointmentDisplayState = {
  appointments: ReceiverAppointment[];
  cachedAt?: string;
  source: "cache" | "fallback" | "online";
};

type GuideTarget = "contact" | "primary" | "ask";

type GuideRect = {
  height: number;
  label: string;
  width: number;
  x: number;
  y: number;
};

type NativeReceiverProvisioningConfig = {
  deviceProfile?: string;
  detectedHardwareProfile?: string;
  displayDensity?: number;
  displayDensityDpi?: number;
  displayHeightDp?: number;
  displayHeightPx?: number;
  displayWidthDp?: number;
  displayWidthPx?: number;
  hardwareProfile?: string;
  bindingStatus?: string;
  deviceOwner?: boolean;
  lockTaskActive?: boolean;
  lockTaskPermitted?: boolean;
  lastRecoveryAction?: string;
  lastRecoveryAtMs?: number;
  manufacturer?: string;
  model?: string;
  provisionedAtMs?: number;
  provisioningCompletedAtMs?: number;
  receiverMode?: "dedicated" | "personal" | string;
  receiverDeviceId?: string;
  receiverInstallId?: string;
  receiverUrl?: string;
  setupClaim?: string;
  setupCode?: string;
  shellVersion?: string;
  nativeSdk?: number;
  sdkVersion?: number;
  uiLayout?: string;
  updatePolicyUrl?: string;
  versionCode?: number;
  versionName?: string;
  capabilities?: {
    batteryOptimization?: string;
    bootStart?: string;
    fullscreen?: string;
    keepAwake?: string;
    kiosk?: string;
    microphone?: string;
    updateChecks?: string;
  };
};

type StoredReceiverBinding = {
  bindingStatus?: string;
  capabilityStatuses?: NativeReceiverProvisioningConfig["capabilities"];
  deviceOwner?: boolean;
  deviceProfile?: string;
  hardwareProfile?: string;
  lastRecoveryAction?: string;
  lastRecoveryAt?: string;
  lockTaskActive?: boolean;
  lockTaskPermitted?: boolean;
  nativeManufacturer?: string;
  nativeModel?: string;
  nativeSdk?: number;
  nativeVersionCode?: number;
  nativeVersionName?: string;
  mainConnectUserPersonId?: string;
  provisioningCompletedAt?: string;
  receiverDeviceId?: string;
  receiverInstallId?: string;
  receiverMode?: string;
  receiverUrl?: string;
  shellVersion?: string;
  storageSource?: string;
  uiLayout?: string;
};

declare global {
  interface Window {
    CarePlandReceiver?: {
      getProvisioningJson?: () => string;
      getUpdatePolicyUrl?: () => string;
      reloadReceiver?: () => void;
      reportReceiverError?: (message: string) => void;
      receiverReady?: () => void;
      receiverSetupRequired?: (message: string) => void;
      saveBinding?: (
        receiverDeviceId: string,
        bindingStatus: string,
        deviceProfile: string,
        hardwareProfile: string,
        uiLayout: string
      ) => void;
    };
  }
}

type ModalState =
  | { type: "contact"; contactId: string }
  | { type: "offlineNotice" }
  | { type: "ask" }
  | { type: "screenCleaningConfirm" }
  | { type: "askRecordReview"; transcript: string }
  | { type: "askAnswer"; answer: AskAnswer; page?: number }
  | { type: "askRecovery"; question: string; page?: number }
  | { type: "appointmentsLoading" }
  | { type: "appointmentsEmpty" }
  | { type: "appointmentsList"; appointments: ReceiverAppointment[]; cachedAt?: string; page: number }
  | { type: "appointmentDetail"; appointment: ReceiverAppointment; appointments: ReceiverAppointment[]; cachedAt?: string; page: number }
  | { type: "appointmentAddress"; appointment: ReceiverAppointment; appointments: ReceiverAppointment[]; cachedAt?: string; page: number }
  | { type: "todayFocusWeight"; item: ReceiverTodayFocusHomeItem }
  | { type: "sent"; recipientName: string }
  | { type: "reader"; message: Message; returnPage?: number; returnTo?: "allMessages" | "home" }
  | { type: "allMessages"; page: number }
  | { type: "soundSettings"; view: "settings" | "help" }
  | {
      type: "incomingCall";
      callEndedAt?: string;
      callId?: string;
      callerName: string;
      callStartedAt?: string;
      callState: Exclude<ReceiverCallUiState, "idle">;
      summaryApproval?: "approved";
      approvedSummaryText?: string;
      generatedSummaryText?: string;
      summaryDraft?: string;
      summaryDraftSavedText?: string;
      summaryPage?: number;
      summaryAutoOpened?: boolean;
      summaryStatus?: string;
      summaryText?: string;
      transcriptStatus?: string;
      transcriptText?: string;
      transcriptCleanupStatus?: string;
      textView?: "captions" | "summary";
    }
  | null;

const receiver = {
  careVipName: "Main Connect User",
  locationLabel: "Living Rm",
};

const contacts: Contact[] = [
  {
    id: "contact-andrew",
    displayName: "Andrew",
    availability: "free",
    availabilityLabel: "Free",
    canCall: true,
  },
];

const receiverUsers: ReceiverUser[] = [];
const testReceiverRegistrationCode = "12345";
const testReceiverUser: ReceiverUser = {
  id: "local-test-rob-robson",
  displayName: "Rob Robson",
  statusLabel: "Registered test receiver",
};
const noMainConnectUser: ReceiverUser = {
  id: "",
  displayName: "Choose Main Connect User",
  statusLabel: "not selected",
};

const initialMessages: Message[] = [];

const nextAppointment = {
  label: "Next up:",
  title: "Cardiology Follow-Up",
  dayLabel: "Tomorrow",
  timeLabel: "2 PM",
};

function appointmentAt(dayOffset: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function fallbackNextReceiverAppointment(): ReceiverAppointment {
  return {
    id: "local-next-cardiology-follow-up",
    startsAt: appointmentAt(1, 14),
    title: nextAppointment.title,
  };
}

const receiverGuideTargetStorageKey = "carepland-connect-guide-target";
const receiverGuideRectStorageKey = "carepland-connect-guide-rect";
const receiverLastPressStorageKey = "carepland-connect-last-press";
const receiverGuideEndpoint = "/api/connect/receiver-guide";
const receiverGuideSessionStorageKey = "carepland-connect-receiver-guide-session";
const receiverBindingStorageKey = "carepland-connect-receiver-binding";
const receiverBrowserInstallStorageKey = "carepland-connect-web-receiver-install-id";
const receiverRegistrationStorageKey = "carepland-connect-receiver-registration";
const receiverSessionStorageKey = "carepland-connect-receiver-session";
const receiverAutoHearStorageKey = "carepland-connect-auto-hear-messages";
const receiverDeviceProfileStorageKey = "carepland-connect-receiver-device-profile";
const connectMessagesEndpoint = "/api/connect/messages";
const connectCallsEndpoint = "/api/connect/calls";
const connectTodayFocusEndpoint = "/api/connect/today-focus";
const connectTodayFocusPreferencesEndpoint = "/api/connect/today-focus/preferences";
const connectTalkEndpoint = "/api/connect/talk";
const connectAudioPlaybackEventsEndpoint = "/api/connect/audio/playback-events";
const connectAudioProfileEndpoint = "/api/connect/audio/profile";
const connectReceiverCleaningSessionsEndpoint = "/api/connect/receiver/cleaning-sessions";
const receiverApkDownloadEndpoint = "/api/connect/receiver-shell/apk/debug";
const receiverScreenCleaningDefaultSeenStorageKey =
  "carepland-connect-screen-cleaning-default-seen";
const receiverScreenCleaningCountStorageKey =
  "carepland-connect-screen-cleaning-count";

const brainStretchPrompt =
  "What is the only English word that is five letters long, is eaten by people, and when you remove the first letter, turns into a form of energy?";

function measurementDigitLimitForFocusItem(item: ReceiverTodayFocusHomeItem): number {
  switch (item.kind) {
    case "weight":
      return 3;
    default:
      return 6;
  }
}

function isAppointmentReminderFocusItem(item: ReceiverTodayFocusHomeItem): boolean {
  const text = `${item.title} ${item.promptText || ""}`.toLowerCase();

  return (
    text.includes("appointment") ||
    text.includes("doctor") ||
    text.includes("cardiology") ||
    text.includes("follow-up") ||
    text.includes("follow up")
  );
}

function normalizeDecimalMeasurementInput(value: string, maxDigits: number): string {
  let nextValue = "";
  let digitCount = 0;
  let hasDecimal = false;

  for (const character of value) {
    if (/\d/.test(character)) {
      if (digitCount >= maxDigits) continue;
      nextValue += character;
      digitCount += 1;
      continue;
    }

    if (character === "." && !hasDecimal) {
      nextValue = nextValue ? `${nextValue}.` : "0.";
      hasDecimal = true;
    }
  }

  return nextValue;
}

const screenCleaningMessages = [
  "You can safely clean the screen.\nIt's good to have a clean machine.",
  "No matter what the season\nWe can do a little screen cleaning.",
  "Rub-a-dub-dub,\nTwo minutes to scrub.",
  "Dust or rain or winter's gleam,\nNothing beats a cleaner screen.",
  "A swipe, a shine, a little care-\nA cleaner screen is nice to share.",
  "When smudges gather here and there,\nA little cleaning shows you care.",
  "A little polish, a little sheen-\nNow that's a happy, healthy screen.",
  "Fingerprints smudge the best of intentions.\nThanks for taking back your screen.",
  "You're quite the overachiever\nFor cleaning the CarePland Receiver.",
  "Don't change that dial!\nWe'll be back in just a minute.",
  "The smudges, the pawprints\nwe're wipin' them varmints.",
  "Dust be gone, streaks take flight.\nWe'll have things looking just right.",
  "Every swipe's a little cheer.\nThanks for keeping CarePland clear.",
  "Shine it up from edge to edge.\nYour Receiver says, \"Much obliged!\"",
  "Smudges come and smudges go.\nA cleaner screen helps CarePland glow.",
];

const screenCleaningMilestoneMessages: Record<number, string> = {
  5: "Thanks for the fifth cleaning.\nI feel better already!",
  10: "This is the tenth screen cleaning!\nNice work keeping the Receiver easy to read.",
  20: "Twenty cleanings makes for 2/3 of an hour well spent.",
  24: "Twenty-four cleanings.\nIf you had an hour for every cleaning..",
  31: "The 31st cleaning - your favorite flavor is clean!\nAnd you've now given the Receiver more than an hour of care.",
  50: "You have a half-century of shine: 50 cleanings!\nThanks for having such a clean machine!",
  64: "Will you still clean me?\nClearly so, at 64!",
  81: "81 minutes: London to Paris.\n81 cleanings: your screen has a capital shine!",
  88: "One cleaning for every piano key.\n\n(Hint: you've got 88!)",
  96: "96 Cleanings! That would be two orbits of Sputnik 1.",
  100: "A full century of cleanings.\nHere's to the next 100!",
  108: "108 Cleanings!\nYuri Gagarin completed the first ever human spaceflight in 108 minutes.",
  127: "127 Cleanings!\nIt takes 127 minutes for sunlight to reach Saturn.",
  143: "143 Cleanings!\nNeil Armstrong and Buzz Aldrin took 143 minutes to complete their Apollo 11 moonwalk.",
  151: "151 Cleanings!\n151 minutes from Chicago to New York City.",
  162: "162 Cleanings!\nJames Cameron's epic sci-fi film Avatar is 162 minutes.",
  169: "169 Cleanings!\nIt takes 169 minutes for the high-speed train to travel from Tokyo to Kyoto.\nYou just completed the roundtrip!",
};

const defaultSoundSettings: SoundSettings = {
  buttonBeeps: true,
  comfortVolume: "med",
  retroRingers: true,
  retroSounds: true,
};

type StoredReceiverModal =
  | { type: "contact"; contactId: string }
  | { type: "ask" }
  | { type: "askRecordReview"; transcript: string }
  | { type: "soundSettings"; view: "settings" | "help" }
  | null;

type StoredReceiverSession = {
  askDraft?: string;
  contactDraft?: string;
  mainConnectUserPersonId?: string;
  messageTextSize?: ReaderTextSize;
  modal?: StoredReceiverModal;
  selectedContactId?: string;
  /** Legacy local key. Do not restore this as active identity. */
  selectedReceiverUserId?: string;
  soundSettings?: Partial<SoundSettings>;
  started?: boolean;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

function readInitialPreviewMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

function redirectGxvLikeBrowserToClassicReceiver() {
  if (typeof window === "undefined") return false;
  if (window.location.pathname.includes("/connect/receiver/legacy")) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("receiver_runtime") === "classic_webview") return false;
  if (params.get("preview") === "1") return false;

  const screenWidth = Number(window.screen?.width || 0);
  const screenHeight = Number(window.screen?.height || 0);
  const viewportWidth = Number(window.innerWidth || 0);
  const viewportHeight = Number(window.innerHeight || 0);
  const shortSide = Math.min(nonZeroDisplaySide(screenWidth), nonZeroDisplaySide(screenHeight));
  const longSide = Math.max(nonZeroDisplaySide(screenWidth), nonZeroDisplaySide(screenHeight));
  const viewportShortSide = Math.min(
    nonZeroDisplaySide(viewportWidth),
    nonZeroDisplaySide(viewportHeight)
  );
  const viewportLongSide = Math.max(
    nonZeroDisplaySide(viewportWidth),
    nonZeroDisplaySide(viewportHeight)
  );
  const userAgent = window.navigator.userAgent.toLowerCase();
  const gxvUserAgent = userAgent.includes("gxv3370") || userAgent.includes("grandstream");
  const androidGxvSized =
    userAgent.includes("android") &&
    (nearDisplaySize(shortSide, longSide, 600, 1024) ||
      nearDisplaySize(viewportShortSide, viewportLongSide, 600, 1024));

  if (!gxvUserAgent && !androidGxvSized) return false;

  params.set("device", params.get("device") || "gxv3370");
  params.set("hardwareProfile", params.get("hardwareProfile") || "grandstream_gxv3370");
  params.set("uiLayout", params.get("uiLayout") || "desk_phone_1024x600");
  params.set("receiver_runtime", "classic_webview");
  if (screenWidth) params.set("displayWidthPx", String(screenWidth));
  if (screenHeight) params.set("displayHeightPx", String(screenHeight));
  if (window.devicePixelRatio) params.set("displayDensity", String(window.devicePixelRatio));
  window.location.replace(`/connect/receiver/legacy?${params.toString()}`);
  return true;
}

function nearDisplaySize(
  shortSide: number,
  longSide: number,
  expectedShort: number,
  expectedLong: number
) {
  return (
    Number.isFinite(shortSide) &&
    Number.isFinite(longSide) &&
    Math.abs(shortSide - expectedShort) <= 90 &&
    Math.abs(longSide - expectedLong) <= 140
  );
}

function nonZeroDisplaySide(value: number) {
  return value > 0 ? value : Number.POSITIVE_INFINITY;
}

function readNativeReceiverProvisioningConfig(): NativeReceiverProvisioningConfig {
  if (typeof window === "undefined") return {};

  try {
    const rawConfig = window.CarePlandReceiver?.getProvisioningJson?.();
    if (!rawConfig) return {};
    const parsed = JSON.parse(rawConfig) as NativeReceiverProvisioningConfig;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizedProfileValue(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

function hardwareProfileFromDisplay(config: NativeReceiverProvisioningConfig) {
  const density = Number(config.displayDensity || 0);
  const width = Number(config.displayWidthDp || (density ? Number(config.displayWidthPx || 0) / density : config.displayWidthPx || 0));
  const height = Number(config.displayHeightDp || (density ? Number(config.displayHeightPx || 0) / density : config.displayHeightPx || 0));
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);

  if (shortSide >= 560 && shortSide <= 700 && longSide >= 960 && longSide <= 1120) {
    return "studio_gxv3370_1024x600";
  }

  if (/android/i.test(typeof window === "undefined" ? "" : window.navigator.userAgent || "")) {
    return width > height ? "generic_landscape_android" : "generic_android_phone";
  }

  return "";
}

function readReceiverProfileSelection() {
  if (typeof window === "undefined") {
    return {
      hardwareProfile: "",
      uiLayout: "default_receiver",
    };
  }
  const params = new URLSearchParams(window.location.search);
  const nativeConfig = readNativeReceiverProvisioningConfig();
  const explicitUiLayout = normalizedProfileValue(params.get("uiLayout") || params.get("layout") || nativeConfig.uiLayout);
  const legacyDevice = normalizedProfileValue(params.get("device") || nativeConfig.deviceProfile);
  const hardwareProfile = normalizedProfileValue(
    params.get("hardwareProfile") ||
      params.get("hardware_profile") ||
      params.get("detectedHardwareProfile") ||
      params.get("detected_hardware_profile") ||
      nativeConfig.hardwareProfile ||
      nativeConfig.detectedHardwareProfile ||
      hardwareProfileFromDisplay(nativeConfig)
  );
  const modelLabel = normalizedProfileValue(
    `${params.get("nativeManufacturer") || nativeConfig.manufacturer || ""} ${
      params.get("nativeModel") || nativeConfig.model || ""
    }`
  );

  if (
    explicitUiLayout === "desk_phone_1024x600" ||
    ["gxv3370", "deskphone", "desk_phone"].includes(legacyDevice) ||
    [
      "grandstream_gxv3370",
      "gxv3370",
      "studio_gxv3370_1024x600",
      "desk_phone_1024x600",
    ].includes(hardwareProfile) ||
    modelLabel.includes("gxv3370")
  ) {
    window.localStorage.setItem(receiverDeviceProfileStorageKey, "gxv3370");
    return {
      hardwareProfile: hardwareProfile || legacyDevice || "desk_phone_1024x600",
      uiLayout: "desk_phone_1024x600",
    };
  }

  if (
    explicitUiLayout === "default_receiver" ||
    ["default", "web", "tablet", "android_receiver"].includes(legacyDevice) ||
    ["generic_android_phone", "generic_android_tablet", "generic_landscape_android", "web"].includes(hardwareProfile)
  ) {
    window.localStorage.removeItem(receiverDeviceProfileStorageKey);
    return {
      hardwareProfile: hardwareProfile || legacyDevice || "generic_android_phone",
      uiLayout: "default_receiver",
    };
  }

  const storedDeskPhone = window.localStorage.getItem(receiverDeviceProfileStorageKey) === "gxv3370";
  return {
    hardwareProfile: storedDeskPhone ? "stored_gxv3370" : hardwareProfile,
    uiLayout: storedDeskPhone ? "desk_phone_1024x600" : "default_receiver",
  };
}

function readInitialDeskPhoneMode() {
  return readReceiverProfileSelection().uiLayout === "desk_phone_1024x600";
}

function readInitialGxvHomeLayout() {
  if (typeof window === "undefined") return "classic";
  const params = new URLSearchParams(window.location.search);
  const value = normalizedProfileValue(
    params.get("homeLayout") ||
      params.get("home_layout") ||
      params.get("gxvHome") ||
      params.get("gxv_home")
  );

  return ["focus", "focus_v1", "today_focus", "v1"].includes(value)
    ? "focus_v1"
    : "classic";
}

function statusLooksEnabled(value?: string | null) {
  return ["1", "active", "allowed", "available", "enabled", "locked", "on", "permitted", "true"].includes(
    normalizedProfileValue(value)
  );
}

function readInitialKioskManagedFullscreen() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const nativeConfig = readNativeReceiverProvisioningConfig();
  const storedBinding = readStoredReceiverBinding();
  const nativeCapabilities = nativeConfig.capabilities || {};
  const storedCapabilities = storedBinding.capabilityStatuses || {};

  return (
    params.get("kiosk") === "1" ||
    params.get("kioskMode") === "1" ||
    params.get("lockTaskActive") === "1" ||
    nativeConfig.lockTaskActive === true ||
    storedBinding.lockTaskActive === true ||
    statusLooksEnabled(params.get("kiosk")) ||
    statusLooksEnabled(params.get("kioskMode")) ||
    statusLooksEnabled(params.get("lockTaskActive")) ||
    statusLooksEnabled(nativeCapabilities.kiosk) ||
    statusLooksEnabled(storedCapabilities.kiosk)
  );
}

function readStoredReceiverSession(): StoredReceiverSession {
  if (typeof window === "undefined") return {};

  try {
    const rawSession = window.localStorage.getItem(receiverSessionStorageKey);
    if (!rawSession) return {};
    const parsed = JSON.parse(rawSession) as StoredReceiverSession;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readInitialStarted() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const nativeConfig = readNativeReceiverProvisioningConfig();
  return (
    params.get("nativeShell") === "android" ||
    Boolean(nativeConfig.receiverUrl) ||
    readInitialPreviewMode() ||
    readStoredReceiverSession().started === true
  );
}

function readInitialSelectedContactId() {
  const storedContactId = readStoredReceiverSession().selectedContactId;
  return contacts.some((contact) => contact.id === storedContactId) ? storedContactId : contacts[0].id;
}

function readInitialSelectedReceiverUserId() {
  if (readInitialReceiverRegistration()) {
    return readStoredReceiverBinding().mainConnectUserPersonId || testReceiverUser.id;
  }
  // Receiver identity comes from /api/connect/context after real registration.
  return "";
}

function readInitialReceiverUsers() {
  if (!readInitialReceiverRegistration()) return receiverUsers;
  const mainConnectUserPersonId = readStoredReceiverBinding().mainConnectUserPersonId;
  if (!mainConnectUserPersonId) return [testReceiverUser];
  return [
    {
      displayName: "Receiver Active Person",
      id: mainConnectUserPersonId,
      statusLabel: "Receiver ready",
    },
  ];
}

function readInitialReceiverRegistration() {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(receiverRegistrationStorageKey) === testReceiverUser.id ||
    Boolean(readStoredReceiverBinding().receiverDeviceId) ||
    readLocalTestReceiverProvisioning()
  );
}

function readLocalTestReceiverProvisioning() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const nativeConfig = readNativeReceiverProvisioningConfig();
  const bindingStatus = normalizedProfileValue(
    params.get("receiverBindingStatus") || nativeConfig.bindingStatus
  );
  const setupCode = (
    params.get("setupCode") ||
    params.get("code") ||
    nativeConfig.setupCode ||
    ""
  ).trim();
  return bindingStatus === "local_test" && setupCode === testReceiverRegistrationCode;
}

function readReceiverShellClaim() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const nativeConfig = readNativeReceiverProvisioningConfig();
  return (params.get("setupClaim") || params.get("claim") || nativeConfig.setupClaim || "").trim();
}

function readReceiverInstallId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const nativeConfig = readNativeReceiverProvisioningConfig();
  const storedBinding = readStoredReceiverBinding();
  return (
    params.get("receiverInstallId") ||
    nativeConfig.receiverInstallId ||
    storedBinding.receiverInstallId ||
    readOrCreateBrowserReceiverInstallId() ||
    ""
  ).trim();
}

function readOrCreateBrowserReceiverInstallId() {
  if (typeof window === "undefined") return "";
  const current = window.localStorage.getItem(receiverBrowserInstallStorageKey);
  if (current) return current;
  const next =
    typeof window.crypto?.randomUUID === "function"
      ? `web-${window.crypto.randomUUID()}`
      : `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(receiverBrowserInstallStorageKey, next);
  return next;
}

function readReceiverDeviceId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const nativeConfig = readNativeReceiverProvisioningConfig();
  const storedBinding = readStoredReceiverBinding();
  return (
    params.get("receiverDeviceId") ||
    nativeConfig.receiverDeviceId ||
    storedBinding.receiverDeviceId ||
    ""
  ).trim();
}

async function connectReceiverRequestHeaders() {
  return {
    ...(await connectAuthHeaders()),
    ...receiverDeviceAuthHeaders(),
  };
}

function receiverDeviceAuthHeaders() {
  const receiverDeviceId = readReceiverDeviceId();
  const receiverInstallId = readReceiverInstallId();
  const headers: Record<string, string> = {};
  if (receiverDeviceId) {
    headers["x-carepland-receiver-device-id"] = receiverDeviceId;
  }
  if (receiverInstallId) {
    headers["x-carepland-receiver-install-id"] = receiverInstallId;
  }
  return headers;
}

function readReceiverGuideId() {
  if (typeof window === "undefined") return connectPrototypeReceiverId;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("receiverId") ||
    params.get("receiverDeviceId") ||
    readReceiverDeviceId() ||
    connectPrototypeReceiverId
  ).trim();
}

function readReceiverGuideSessionId() {
  if (typeof window === "undefined") return "";
  const current = window.sessionStorage.getItem(receiverGuideSessionStorageKey);
  if (current) return current;
  const next =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `receiver-session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.sessionStorage.setItem(receiverGuideSessionStorageKey, next);
  return next;
}

function readReceiverModeLabel(): ScreenCleaningSession["receiverMode"] {
  if (typeof window === "undefined") return "Dedicated";
  const params = new URLSearchParams(window.location.search);
  const nativeConfig = readNativeReceiverProvisioningConfig();
  const storedBinding = readStoredReceiverBinding();
  const rawMode = (
    params.get("receiverMode") ||
    nativeConfig.receiverMode ||
    storedBinding.receiverMode ||
    ""
  )
    .trim()
    .toLowerCase();

  return rawMode === "personal" ? "Personal" : "Dedicated";
}

function nextScreenCleaningCount() {
  if (typeof window === "undefined") return 1;

  const storedCount = Number(
    window.localStorage.getItem(receiverScreenCleaningCountStorageKey) || "0"
  );
  const nextCount = Number.isFinite(storedCount) && storedCount >= 0
    ? Math.floor(storedCount) + 1
    : 1;
  window.localStorage.setItem(receiverScreenCleaningCountStorageKey, String(nextCount));

  return nextCount;
}

function chooseScreenCleaningMessage(cleaningCount: number) {
  const milestoneMessage = screenCleaningMilestoneMessages[cleaningCount];
  if (milestoneMessage) return milestoneMessage;

  if (typeof window === "undefined") return screenCleaningMessages[0];

  const defaultSeen =
    window.localStorage.getItem(receiverScreenCleaningDefaultSeenStorageKey) === "true";
  if (!defaultSeen) {
    window.localStorage.setItem(receiverScreenCleaningDefaultSeenStorageKey, "true");
    return screenCleaningMessages[0];
  }

  const index = Math.floor(Math.random() * screenCleaningMessages.length);
  return screenCleaningMessages[index] || screenCleaningMessages[0];
}

function readStoredReceiverBinding(): StoredReceiverBinding {
  if (typeof window === "undefined") return {};
  try {
    const rawBinding = window.localStorage.getItem(receiverBindingStorageKey);
    if (!rawBinding) return {};
    const parsed = JSON.parse(rawBinding) as StoredReceiverBinding;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveReceiverBinding(binding: StoredReceiverBinding) {
  if (typeof window === "undefined") return;
  const receiverDeviceId = binding.receiverDeviceId?.trim() || "";
  const receiverInstallId = binding.receiverInstallId?.trim() || readReceiverInstallId();
  if (!receiverDeviceId || !receiverInstallId) return;

  const storedBinding: StoredReceiverBinding = {
    bindingStatus: binding.bindingStatus?.trim() || "bound",
    capabilityStatuses: binding.capabilityStatuses,
    deviceOwner: binding.deviceOwner,
    deviceProfile: binding.deviceProfile?.trim() || "",
    hardwareProfile: binding.hardwareProfile?.trim() || "",
    lastRecoveryAction: binding.lastRecoveryAction?.trim() || "",
    lastRecoveryAt: binding.lastRecoveryAt?.trim() || "",
    lockTaskActive: binding.lockTaskActive,
    lockTaskPermitted: binding.lockTaskPermitted,
    nativeManufacturer: binding.nativeManufacturer?.trim() || "",
    nativeModel: binding.nativeModel?.trim() || "",
    nativeSdk: binding.nativeSdk,
    nativeVersionCode: binding.nativeVersionCode,
    nativeVersionName: binding.nativeVersionName?.trim() || "",
    mainConnectUserPersonId: binding.mainConnectUserPersonId?.trim() || "",
    provisioningCompletedAt: binding.provisioningCompletedAt?.trim() || "",
    receiverDeviceId,
    receiverInstallId,
    receiverMode: binding.receiverMode?.trim() || "",
    receiverUrl: binding.receiverUrl?.trim() || "",
    shellVersion: binding.shellVersion?.trim() || "",
    storageSource: binding.storageSource?.trim() || "",
    uiLayout: binding.uiLayout?.trim() || "",
  };
  window.localStorage.setItem(receiverBindingStorageKey, JSON.stringify(storedBinding));
  window.localStorage.setItem(receiverRegistrationStorageKey, testReceiverUser.id);
  window.CarePlandReceiver?.saveBinding?.(
    storedBinding.receiverDeviceId || "",
    storedBinding.bindingStatus || "bound",
    storedBinding.deviceProfile || "",
    storedBinding.hardwareProfile || "",
    storedBinding.uiLayout || ""
  );
}

function clearReceiverBinding() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(receiverBindingStorageKey);
  window.localStorage.removeItem(receiverRegistrationStorageKey);
  window.CarePlandReceiver?.receiverSetupRequired?.("Receiver setup is required.");
}

function isReceiverSetupRequiredMessage(message: string) {
  return (
    message.includes("expired") ||
    message.includes("revoked") ||
    message.includes("not found") ||
    message.includes("does not match")
  );
}

async function verifyReceiverBindingHeartbeat() {
  const receiverDeviceId = readReceiverDeviceId();
  const receiverInstallId = readReceiverInstallId();
  if (!receiverDeviceId || !receiverInstallId) return null;

  const nativeConfig = readNativeReceiverProvisioningConfig();
  const response = await fetch("/api/connect/receiver-shell/devices/binding", {
    body: JSON.stringify({
      capabilities: nativeConfig.capabilities,
      deviceOwner: nativeConfig.deviceOwner,
      lastRecoveryAction: nativeConfig.lastRecoveryAction,
      lastRecoveryAtMs: nativeConfig.lastRecoveryAtMs,
      lockTaskActive: nativeConfig.lockTaskActive,
      lockTaskPermitted: nativeConfig.lockTaskPermitted,
      nativeManufacturer: nativeConfig.manufacturer,
      nativeModel: nativeConfig.model,
      nativeSdk: nativeConfig.nativeSdk || nativeConfig.sdkVersion,
      nativeVersionCode: nativeConfig.versionCode,
      nativeVersionName: nativeConfig.versionName,
      provisioningCompletedAtMs: nativeConfig.provisioningCompletedAtMs,
      receiverDeviceId,
      receiverInstallId,
      receiverMode: nativeConfig.receiverMode,
      shellVersion: nativeConfig.shellVersion,
    }),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = (await response.json().catch(() => ({}))) as StoredReceiverBinding & {
    error?: string;
    ok?: boolean;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Receiver setup could not be confirmed.");
  }

  return {
    ...payload,
    receiverDeviceId,
    receiverInstallId,
  };
}

function readInitialModal(): ModalState {
  const storedModal = readStoredReceiverSession().modal;

  if (storedModal?.type === "contact") {
    return contacts.some((contact) => contact.id === storedModal.contactId) ? storedModal : null;
  }

  if (storedModal?.type === "ask") return storedModal;
  if (storedModal?.type === "askRecordReview") {
    return storedModal.transcript ? storedModal : null;
  }
  if (storedModal?.type === "soundSettings") {
    return storedModal.view === "help" ? storedModal : { type: "soundSettings", view: "settings" };
  }

  return null;
}

function readInitialSoundSettings(): SoundSettings {
  const storedSettings = readStoredReceiverSession().soundSettings || {};
  const comfortVolume =
    storedSettings.comfortVolume === "low" ||
    storedSettings.comfortVolume === "med" ||
    storedSettings.comfortVolume === "high"
      ? storedSettings.comfortVolume
      : defaultSoundSettings.comfortVolume;

  return {
    buttonBeeps:
      typeof storedSettings.buttonBeeps === "boolean"
        ? storedSettings.buttonBeeps
        : defaultSoundSettings.buttonBeeps,
    comfortVolume,
    retroRingers:
      typeof storedSettings.retroRingers === "boolean"
        ? storedSettings.retroRingers
        : defaultSoundSettings.retroRingers,
    retroSounds:
      typeof storedSettings.retroSounds === "boolean"
        ? storedSettings.retroSounds
        : defaultSoundSettings.retroSounds,
  };
}

function readInitialMessageTextSize(): ReaderTextSize {
  const storedTextSize = readStoredReceiverSession().messageTextSize;
  if (storedTextSize === "standard" || storedTextSize === "large" || storedTextSize === "extra") {
    return storedTextSize;
  }

  return "large";
}

function readInitialAutoHearPreference(): AutoHearPreference {
  if (typeof window === "undefined") return "off";
  return window.localStorage.getItem(receiverAutoHearStorageKey) === "on" ? "on" : "off";
}

function storableReceiverModal(modal: ModalState): StoredReceiverModal {
  if (
    modal?.type === "contact" ||
    modal?.type === "ask" ||
    modal?.type === "askRecordReview"
  ) {
    return modal;
  }

  return null;
}

function parseGuideTarget(value: string | null): GuideTarget | null {
  return value === "contact" || value === "primary" || value === "ask" ? value : null;
}

function parseGuideRect(value: string | null): GuideRect | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<GuideRect>;
    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      typeof parsed.width !== "number" ||
      typeof parsed.height !== "number"
    ) {
      return null;
    }

    return {
      height: Math.max(16, parsed.height),
      label: typeof parsed.label === "string" ? parsed.label : "a receiver control",
      width: Math.max(16, parsed.width),
      x: parsed.x,
      y: parsed.y,
    };
  } catch {
    return null;
  }
}

function currentIsoTimestamp() {
  return new Date().toISOString();
}

function currentEpochMs() {
  return Date.now();
}

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

function firstDisplayName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

function contactCanCallNow(contact: Contact) {
  return contact.canCall && contact.availability === "free";
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatPairingExpiryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";
  return formatTime(date);
}

function formatDate(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function stripCareSummaryHeading(text: string) {
  return text.replace(/^\s*care summary\s*:?\s*/i, "").trimStart();
}

function formatReceiverCallDuration(
  startedAt: string | undefined,
  endedAt: string | undefined,
  now: Date
) {
  if (!startedAt) return "0:00";

  const started = new Date(startedAt).getTime();
  const ended = endedAt ? new Date(endedAt).getTime() : now.getTime();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) {
    return "0:00";
  }

  const totalSeconds = Math.floor((ended - started) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatCountdownSeconds(totalSeconds: number) {
  const boundedSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(boundedSeconds / 60);
  const seconds = String(boundedSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function receiverTranscriptStatusLabel(status: string) {
  if (status === "capturing") return "Transcript chunks are processing.";
  if (status === "not_configured") return "Transcription is not configured in this environment.";
  if (status === "failed") return "Transcription failed for this call.";
  if (status === "deleted") return "Transcript was deleted after summary approval.";
  return "Closed captioning is waiting for call transcript text. When chunks are transcribed, this view will show the temporary conversation text for summary review.";
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function messageTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const todayStart = startOfLocalDay(new Date());
  const messageStart = startOfLocalDay(date);
  const dayDifference = Math.round((todayStart.getTime() - messageStart.getTime()) / 86400000);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (dayDifference <= 0) return `Today ${time}`;
  if (dayDifference === 1) return `Yesterday ${time}`;
  if (dayDifference === 2) return `Two days ago ${time}`;
  if (dayDifference < 7) {
    return `${date.toLocaleDateString([], { weekday: "long" })} ${time}`;
  }

  return `${date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    weekday: "long",
  })} • ${time}`;
}

function messageHeader(message: Message) {
  const name = message.from === "receiver_user" ? message.to : message.from;
  return `${name || "CarePland"} • ${messageTimeLabel(message.createdAt)}`;
}

function normalizeAppointment(
  appointment: Partial<ReceiverAppointment> & { id?: string },
  fallbackIndex = 0
): ReceiverAppointment {
  return {
    id: String(appointment.id || `appointment-${fallbackIndex}`),
    locationAddress: String(appointment.locationAddress || ""),
    locationName: String(appointment.locationName || ""),
    locationPhone: String(appointment.locationPhone || ""),
    providerName: String(appointment.providerName || ""),
    providerOrganization: String(appointment.providerOrganization || ""),
    reason: String(appointment.reason || ""),
    startsAt: String(appointment.startsAt || appointmentAt(fallbackIndex + 1, 14)),
    title: String(appointment.title || "Appointment"),
  };
}

function appointmentSubtitle(appointment: ReceiverAppointment) {
  return [
    appointment.providerName,
    appointment.providerOrganization,
    appointment.locationName,
  ]
    .filter(Boolean)
    .join(" • ");
}

function appointmentDateTimeLabel(appointment: ReceiverAppointment) {
  if (!appointment.startsAt) return "Time not saved";

  const date = new Date(appointment.startsAt);
  if (Number.isNaN(date.getTime())) return "Time not saved";

  const day = date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return `${day} • ${time}`;
}

function appointmentChoiceLineCost(appointment: ReceiverAppointment) {
  const length = (appointment.title || "Appointment").length;
  if (length > 74) return 3;
  if (length > 38) return 2;
  return 1;
}

function paginateAppointments(appointments: ReceiverAppointment[]) {
  const pages: ReceiverAppointment[][] = [];
  let currentPage: ReceiverAppointment[] = [];
  let currentCost = 0;
  const maxCost = 5;

  for (const appointment of appointments) {
    const cost = appointmentChoiceLineCost(appointment);
    if (currentPage.length && currentCost + cost > maxCost) {
      pages.push(currentPage);
      currentPage = [];
      currentCost = 0;
    }

    currentPage.push(appointment);
    currentCost += cost;
  }

  if (currentPage.length) pages.push(currentPage);
  return pages.length ? pages : [[]];
}

function soundSettingLabel(key: keyof SoundSettings) {
  if (key === "retroSounds") return "Retro sounds";
  if (key === "retroRingers") return "Retro ringers";
  if (key === "buttonBeeps") return "Button beeps";
  return "Volume";
}

function audioStateLabel() {
  if (typeof window === "undefined") return "unknown";
  return typeof Audio === "undefined" ? "unavailable" : "available";
}

function playReceiverAudioFile(
  url: string,
  volume: SoundSettings["comfortVolume"],
  options: { loop?: boolean; onEnded?: () => void } = {}
) {
  if (typeof window === "undefined") return false;
  const audio = new Audio(url);
  audio.volume = connectComfortVolumeLevel(volume);
  audio.loop = Boolean(options.loop);
  if (options.onEnded) audio.addEventListener("ended", options.onEnded, { once: true });
  void audio.play().catch(() => undefined);
  return audio;
}

function playReceiverBeep(settings: SoundSettings, volume = settings.comfortVolume, force = false) {
  if (!force && (!settings.retroSounds || !settings.buttonBeeps)) return false;
  return playReceiverAudioFile(receiverAudioPack.button, volume);
}

function playReceiverIncomingRing(settings: SoundSettings, force = false, loop = false) {
  if (!force && (!settings.retroSounds || !settings.retroRingers)) return false;
  return playReceiverAudioFile(receiverAudioPack.incoming, settings.comfortVolume, { loop });
}

function playReceiverRingback(settings: SoundSettings, force = false, loop = false) {
  if (!force && (!settings.retroSounds || !settings.retroRingers)) return false;
  return playReceiverAudioFile(receiverAudioPack.ringback, settings.comfortVolume, { loop });
}

function playReceiverUnavailableSequence(settings: SoundSettings, force = false) {
  if (!force && (!settings.retroSounds || !settings.retroRingers)) return false;
  return playReceiverAudioFile(receiverAudioPack.sit, settings.comfortVolume, {
    onEnded: () => {
      playReceiverAudioFile(receiverAudioPack.unavailable, settings.comfortVolume);
    },
  });
}

function speakSoundTest() {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance("Sound test."));
  return true;
}

function detectedBrowserLabel() {
  if (typeof window === "undefined") return "Unknown browser";
  const ua = window.navigator.userAgent || "";
  const safariMatch = ua.match(/Version\/([\d.]+).*Safari\//);
  if (/CriOS\//.test(ua)) return "Chrome";
  if (/FxiOS\//.test(ua)) return "Firefox";
  if (safariMatch) return `Safari ${safariMatch[1]}`;
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  return "Unknown browser";
}

function detectedDeviceType() {
  if (typeof window === "undefined") return "Browser device";
  const ua = window.navigator.userAgent || "";
  if (/iPad/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)) {
    return "iPad";
  }
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  return "Browser device";
}

function detectedAppMode() {
  if (typeof window === "undefined") return "Browser";
  const standaloneNavigator = window.navigator as Navigator & { standalone?: boolean };
  if (standaloneNavigator.standalone) return "Home Screen web app";
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "Standalone web app";
  return "Browser";
}

function receiverApplianceStyle(
  initialDevicePixelRatio: number,
  deskPhoneMode = false
): CSSProperties {
  const canvasWidth = deskPhoneMode ? DESK_PHONE_CANVAS_WIDTH : RECEIVER_CANVAS_WIDTH;
  const canvasHeight = deskPhoneMode ? DESK_PHONE_CANVAS_HEIGHT : RECEIVER_CANVAS_HEIGHT;

  if (typeof window === "undefined") {
    return {
      "--receiver-canvas-height": `${canvasHeight}px`,
      "--receiver-canvas-width": `${canvasWidth}px`,
      "--receiver-scale": "1",
    } as CSSProperties;
  }

  const currentDevicePixelRatio = window.devicePixelRatio || initialDevicePixelRatio || 1;
  const zoomRatio = Math.max(0.1, currentDevicePixelRatio / initialDevicePixelRatio);
  const baseViewportWidth = window.innerWidth * zoomRatio;
  const baseViewportHeight = window.innerHeight * zoomRatio;
  const baseScale = Math.min(
    baseViewportWidth / canvasWidth,
    baseViewportHeight / canvasHeight
  );
  const cssScale = Math.max(0.1, baseScale / zoomRatio);

  return {
    "--receiver-canvas-height": `${canvasHeight}px`,
    "--receiver-canvas-width": `${canvasWidth}px`,
    "--receiver-scale": cssScale.toFixed(5),
  } as CSSProperties;
}

function generateSoundHelp(problem: SoundProblem): SoundHelp {
  if (problem === "speech_only") {
    return {
      actions: ["enable_sounds", "set_volume_high"],
      steps: [
        "Press the physical volume up button while this page is open.",
        "Check that the browser tab or site is not muted.",
        "If available, open the receiver from the Home Screen icon and test again.",
        "Keep spoken reminders on; they may work even when button beeps are reduced.",
      ],
      summary: "Speech works, but browser beeps are muted or reduced on this device.",
      title: "Speech Works, Beeps Are Muted",
    };
  }

  if (problem === "faint_beep") {
    return {
      actions: ["set_volume_high"],
      steps: [
        "Set receiver volume to High.",
        "Press the physical volume up button while this page is open.",
        "Check the current audio output in Control Center or system settings.",
        "Treat button beeps as optional if spoken reminders remain clear.",
      ],
      summary: "Beeps are playing, but regular browser audio is quieter than speech.",
      title: "Beeps Are Faint",
    };
  }

  if (problem === "no_ringers") {
    return {
      actions: ["enable_sounds", "set_volume_high"],
      steps: [
        "Make sure Retro Sounds and Retro Ringers are on.",
        "Run Test again.",
        "If speech works but ringers do not, continue using the receiver; ringers are optional feedback.",
      ],
      summary: "Receiver ring sounds did not play.",
      title: "Ring Sounds Are Not Playing",
    };
  }

  return {
    steps: [
      "Keep this receiver page open while changing volume.",
      "Press the physical volume up button several times.",
      "Check that sound is playing through this device, not headphones or another output.",
      "Tap Run Test again after changing settings.",
      "Do not reset the device or erase settings for this issue.",
    ],
    summary: "No beep, ring, or spoken sound was heard.",
    title: "No Sound Heard",
  };
}

function messageText(message: Message) {
  return message.transcript || message.body || "This message is not available to read yet.";
}

function initialReceiverDevicePixelRatio() {
  return typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
}

function messageStateUrl(messageId: string) {
  return `${connectMessagesEndpoint}/${encodeURIComponent(messageId)}/state`;
}

function receiverAudioUrl(audioUrl?: string) {
  if (!audioUrl) return "";
  if (/^https?:\/\//i.test(audioUrl)) return audioUrl;
  if (audioUrl.startsWith("/api/") || audioUrl.startsWith("/connect/")) return audioUrl;
  return connectPrototypeEndpoints.audioArtifactMedia(audioUrl);
}

function readerPageCharacterLimit(size: ReaderTextSize) {
  if (size === "standard") return 420;
  if (size === "large") return 210;
  return 90;
}

function paginateReaderText(text: string, size: ReaderTextSize) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return [""];

  const limit = readerPageCharacterLimit(size);
  const pages: string[] = [];
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

function replacePaginatedTextPage(
  pages: string[],
  pageIndex: number,
  nextPageText: string
) {
  const nextPages = pages.length ? [...pages] : [""];
  nextPages[Math.max(0, Math.min(pageIndex, nextPages.length - 1))] = nextPageText;
  return nextPages.join("\n\n").trim();
}

function normalizeServerMessage(
  message: Partial<Message> & { id?: string },
  fallback?: Partial<Message>
): Message {
  return {
    audioArtifactId: String(message.audioArtifactId || fallback?.audioArtifactId || ""),
    audioDurationMs: Number(message.audioDurationMs || fallback?.audioDurationMs || 0),
    audioMimeType: String(message.audioMimeType || fallback?.audioMimeType || ""),
    audioUrl: String(message.audioUrl || fallback?.audioUrl || ""),
    body: String(message.body || message.transcript || fallback?.body || "Voice message"),
    createdAt: String(message.createdAt || fallback?.createdAt || currentIsoTimestamp()),
    from: String(message.from || fallback?.from || "Andrew"),
    heardAt: String(message.heardAt || fallback?.heardAt || ""),
    id: String(message.id || fallback?.id || `message-${currentEpochMs()}`),
    mainConnectUserPersonId: String(
      message.mainConnectUserPersonId || fallback?.mainConnectUserPersonId || ""
    ),
    messageType: String(message.messageType || fallback?.messageType || "text"),
    readAt: String(message.readAt || fallback?.readAt || ""),
    to: String(message.to || fallback?.to || receiver.careVipName),
    transcript: String(message.transcript || fallback?.transcript || ""),
    transcriptStatus: String(message.transcriptStatus || fallback?.transcriptStatus || ""),
  };
}

function resolveReceiverAttentionItem(input: {
  messages: Message[];
  pendingCallSummaryReviews: Array<Partial<ReceiverCall>>;
}): ReceiverAttentionItem | null {
  const items: ReceiverAttentionItem[] = [];
  const pendingCallSummary = input.pendingCallSummaryReviews[0];
  const unreadMessage = input.messages.find((message) => !message.readAt);

  if (pendingCallSummary) {
    items.push({
      call: pendingCallSummary,
      kind: "call_summary_review",
      label: "Review",
      priority: 100,
    });
  }

  if (unreadMessage) {
    items.push({
      kind: "new_message",
      label: "Message",
      message: unreadMessage,
      priority: 80,
    });
  }

  // Future inputs should plug in here: reminder due -> "Reminder",
  // receiver update available -> "Update", and device/audio issue -> "Help".
  return items.sort((a, b) => b.priority - a.priority)[0] ?? null;
}

function isLowConfidenceAsk(rawText: string) {
  const text = rawText.trim().toLowerCase();
  if (!text) return false;

  const knownTerms = [
    "appointment",
    "doctor",
    "leave",
    "leaving",
    "bring",
    "milk",
    "grocery",
    "dizzy",
    "hurt",
    "pain",
    "tv",
    "remote",
    "sound",
    "volume",
    "tell",
    "message",
  ];

  return !knownTerms.some((term) => text.includes(term));
}

function answerForAsk(rawText: string, selectedContact: Contact): AskAnswer {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  if (lower.includes("appointment") || lower.includes("doctor") || lower.includes("leave")) {
    return {
      question: text,
      answer: "I can check upcoming appointments for the active Main Connect User.",
      actionLabel: "That answered my question",
      messageBody: "",
      recipientId: "",
      type: "answer",
    };
  }

  if (lower.includes("dizzy") || lower.includes("hurt") || lower.includes("pain")) {
    return {
      question: text,
      answer: `This may be important. I can send this to Andrew now.`,
      actionLabel: "Send this to Andrew",
      messageBody: text,
      recipientId: contacts[0].id,
      type: "message",
    };
  }

  return {
    question: text,
    answer: `I can send this to ${selectedContact.displayName}.`,
    actionLabel: `Send to ${selectedContact.displayName}`,
    messageBody: text.replace(/^(tell|message|send)\s+/i, ""),
    recipientId: selectedContact.id,
    type: "message",
  };
}

export function ConnectReceiver() {
  const initialDevicePixelRatioRef = useRef(initialReceiverDevicePixelRatio());
  const [deskPhoneMode] = useState(readInitialDeskPhoneMode);
  const [gxvHomeLayout, setGxvHomeLayout] = useState(readInitialGxvHomeLayout);
  const [kioskManagedFullscreen] = useState(readInitialKioskManagedFullscreen);
  const [applianceStyle, setApplianceStyle] = useState<CSSProperties>(() =>
    receiverApplianceStyle(initialReceiverDevicePixelRatio(), readInitialDeskPhoneMode())
  );
  const [soundPrimed, setSoundPrimed] = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [receiverSessionRestored, setReceiverSessionRestored] = useState(false);
  const [started, setStarted] = useState(readInitialStarted);
  const [selectedContactId] = useState(readInitialSelectedContactId);
  const [activeReceiverUsers, setActiveReceiverUsers] =
    useState<ReceiverUser[]>(readInitialReceiverUsers);
  const [selectedReceiverUserId, setSelectedReceiverUserId] = useState(readInitialSelectedReceiverUserId);
  const [receiverRegistered, setReceiverRegistered] = useState(readInitialReceiverRegistration);
  const [registrationCode, setRegistrationCode] = useState(testReceiverRegistrationCode);
  const [registrationError, setRegistrationError] = useState("");
  const [browserPairingCode, setBrowserPairingCode] = useState("");
  const [browserPairingExpiresAt, setBrowserPairingExpiresAt] = useState("");
  const [browserPairingStatus, setBrowserPairingStatus] = useState("Preparing Receiver setup...");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [receiverOnline, setReceiverOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [appointmentDisplay, setAppointmentDisplay] =
    useState<ReceiverAppointmentDisplayState>({
      appointments: [fallbackNextReceiverAppointment()],
      source: "fallback",
    });
  const [todayFocusItems, setTodayFocusItems] = useState<ReceiverTodayFocusHomeItem[]>([]);
  const [todayFocusCompletingId, setTodayFocusCompletingId] = useState("");
  const [todayFocusCompletedIds, setTodayFocusCompletedIds] = useState<string[]>([]);
  const [todayFocusPendingCompletions, setTodayFocusPendingCompletions] =
    useState<Record<string, ReceiverTodayFocusPendingCompletion>>({});
  const [todayFocusUndoWindowMs, setTodayFocusUndoWindowMs] = useState(
    DEFAULT_TODAY_FOCUS_UNDO_WINDOW_MS
  );
  const [todayFocusLoadState, setTodayFocusLoadState] = useState<
    "idle" | "loading" | "ready" | "empty" | "error"
  >("idle");
  const [todayFocusStatus, setTodayFocusStatus] = useState("");
  const [pendingCallSummaryReviews, setPendingCallSummaryReviews] = useState<
    Array<Partial<ReceiverCall>>
  >([]);
  const [interruptedReviewIncomingCall, setInterruptedReviewIncomingCall] =
    useState<Partial<ReceiverCall> | null>(null);
  const [todayFocusPreferenceItem, setTodayFocusPreferenceItem] =
    useState<ReceiverTodayFocusHomeItem | null>(null);
  const [todayFocusPreferenceStep, setTodayFocusPreferenceStep] =
    useState<"main" | "cadence">("main");
  const [messageTextSize, setMessageTextSize] = useState<ReaderTextSize>(readInitialMessageTextSize);
  const [focusedMessageIndex, setFocusedMessageIndex] = useState(0);
  const [, setStatus] = useState("Ready.");
  const [modal, setModal] = useState<ModalState>(readInitialModal);
  const modalRef = useRef<ModalState>(modal);
  const [screenCleaningSecondsRemaining, setScreenCleaningSecondsRemaining] =
    useState<number | null>(null);
  const [screenCleaningSession, setScreenCleaningSession] =
    useState<ScreenCleaningSession | null>(null);
  const [contactDraft, setContactDraft] = useState(() => readStoredReceiverSession().contactDraft || "");
  const [askDraft, setAskDraft] = useState(() => readStoredReceiverSession().askDraft || "");
  const [guideTarget, setGuideTarget] = useState<GuideTarget | null>(null);
  const [guideRect, setGuideRect] = useState<GuideRect | null>(null);
  const [guideIdentifyCode, setGuideIdentifyCode] = useState("");
  const [receiverRecording, setReceiverRecording] = useState(false);
  const [receiverRecordingProcessing, setReceiverRecordingProcessing] = useState(false);
  const [contactRecording, setContactRecording] = useState(false);
  const [contactRecordingProcessing, setContactRecordingProcessing] = useState(false);
  const [pendingContactRecording, setPendingContactRecording] =
    useState<PendingContactRecording | null>(null);
  const [pendingAskAudio, setPendingAskAudio] = useState<PendingAskAudio | null>(
    null
  );
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(readInitialSoundSettings);
  const [soundDiagnostic, setSoundDiagnostic] = useState("");
  const [lastSoundTestResult, setLastSoundTestResult] = useState("Not run");
  const [soundHelp, setSoundHelp] = useState<SoundHelp | null>(null);
  const [selectedSoundProblem, setSelectedSoundProblem] = useState<SoundProblem | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [autoHearPreference, setAutoHearPreference] = useState<AutoHearPreference>(
    readInitialAutoHearPreference
  );
  const [audioPreference, setAudioPreference] = useState<AudioPreference>(defaultConnectAudioPreference);
  const [callAudioStatus, setCallAudioStatus] =
    useState<ConnectCallAudioStatus>("idle");
  const [callMuted, setCallMuted] = useState(false);
  const audioRef = useRef<ReceiverPlaybackHandle | null>(null);
  const liveCallAudioRef = useRef<ConnectCallAudioController | null>(null);
  const callStartedAtByCallIdRef = useRef<Record<string, string>>({});
  const locallyEndedCallIdsRef = useRef<Set<string>>(new Set());
  const pendingCallSummaryReviewsRef = useRef<Array<Partial<ReceiverCall>>>([]);
  const summaryApprovalAdvanceTimerRef = useRef<number | null>(null);
  const playingEnhancementProfileRef = useRef<ReceiverAudioEnhancementProfile | null>(null);
  const playingMessageRef = useRef<Message | null>(null);
  const cueAudioRef = useRef<HTMLAudioElement | null>(null);
  const cueTimeoutRef = useRef<number | null>(null);
  const todayFocusCompletionTimersRef = useRef<Record<string, number>>({});
  const receiverRecordingControllerRef = useRef<ConnectAudioRecordingController | null>(null);
  const receiverCaptureIdRef = useRef("");
  const contactRecordingControllerRef = useRef<ConnectAudioRecordingController | null>(null);
  const contactCaptureIdRef = useRef("");
  const screenCleaningSessionRef = useRef<ScreenCleaningSession | null>(null);
  const gxvFocusHomeEnabled = deskPhoneMode && gxvHomeLayout === "focus_v1";
  const onlineRequiredActionClass = receiverOnline ? "" : styles.offlineDisabledAction;

  useEffect(() => {
    redirectGxvLikeBrowserToClassicReceiver();
  }, []);

  useEffect(() => {
    window.CarePlandReceiver?.receiverReady?.();

    function reportNativeReceiverError(message: string) {
      window.CarePlandReceiver?.reportReceiverError?.(message);
    }

    function handleWindowError(event: ErrorEvent) {
      reportNativeReceiverError(
        `${event.message || "Receiver script error"} at ${event.filename || "unknown"}:${event.lineno || 0}`
      );
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason instanceof Error
        ? event.reason.message
        : String(event.reason || "Receiver promise error");
      reportNativeReceiverError(reason);
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    function syncBrowserConnectivity() {
      setReceiverOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    }

    syncBrowserConnectivity();
    window.addEventListener("online", syncBrowserConnectivity);
    window.addEventListener("offline", syncBrowserConnectivity);

    return () => {
      window.removeEventListener("online", syncBrowserConnectivity);
      window.removeEventListener("offline", syncBrowserConnectivity);
    };
  }, []);

  function markReceiverOnline() {
    setReceiverOnline(true);
  }

  function markReceiverOffline() {
    setReceiverOnline(false);
  }

  function explainOfflineAction() {
    clearGuideBecauseReceiverActed();
    setStatus(receiverOfflineActionMessage());
    setModal({ type: "offlineNotice" });
  }

  function readCachedAppointmentDisplay(personId: string): ReceiverAppointmentDisplayState | null {
    const cached = readReceiverAppointmentCache(window.localStorage, personId);
    if (!cached || cached.appointments.length === 0) return null;

    return {
      appointments: cached.appointments.map((appointment, index) =>
        normalizeAppointment(appointment, index)
      ),
      cachedAt: cached.cachedAt,
      source: "cache",
    };
  }

  function updateStoredAppointmentCache(
    personId: string,
    appointments: ReceiverAppointment[]
  ): ReceiverAppointmentCacheEntry | null {
    return writeReceiverAppointmentCache(window.localStorage, personId, appointments);
  }

  const refreshMessages = useCallback(async () => {
    if (!selectedReceiverUserId) return;

    try {
      const messagesUrl = `${connectMessagesEndpoint}?personId=${encodeURIComponent(selectedReceiverUserId)}`;
      const response = await fetch(messagesUrl, {
        cache: "no-store",
        headers: await connectReceiverRequestHeaders(),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        messages?: Array<Partial<Message> & { id?: string }>;
      };

      if (!response.ok || !Array.isArray(payload.messages)) return;
      markReceiverOnline();

      const nextMessages = payload.messages
        .filter((message): message is Partial<Message> & { id: string } => Boolean(message.id))
        .map((message) => normalizeServerMessage(message));

      if (nextMessages.length) {
        setMessages(nextMessages);
        setFocusedMessageIndex((index) => Math.min(index, nextMessages.length - 1));
      }
    } catch {
      markReceiverOffline();
      // Keep the local seed messages if the Connect local server is unavailable.
    }
  }, [selectedReceiverUserId]);

  function resetTodayFocusList(items: ReceiverTodayFocusHomeItem[]) {
    setTodayFocusItems(items);
    setTodayFocusCompletedIds([]);
    setTodayFocusPendingCompletions({});
    setTodayFocusCompletingId("");
    setTodayFocusStatus("");
    setTodayFocusLoadState(items.length ? "ready" : "empty");
    clearTodayFocusCompletionTimers();
  }

  function clearTodayFocusCompletionTimers() {
    for (const timerId of Object.values(todayFocusCompletionTimersRef.current)) {
      window.clearTimeout(timerId);
    }
    todayFocusCompletionTimersRef.current = {};
  }

  function clearTodayFocusCompletionTimer(focusItemId: string) {
    const timerId = todayFocusCompletionTimersRef.current[focusItemId];
    if (timerId) {
      window.clearTimeout(timerId);
      delete todayFocusCompletionTimersRef.current[focusItemId];
    }
  }

  function normalizeTodayFocusUndoWindowMs(value: unknown) {
    const milliseconds =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : DEFAULT_TODAY_FOCUS_UNDO_WINDOW_MS;

    return Math.min(30_000, Math.max(3_000, Math.round(milliseconds)));
  }

  useEffect(() => {
    setTodayFocusItems([]);
    setTodayFocusCompletedIds([]);
    setTodayFocusPendingCompletions({});
    setTodayFocusCompletingId("");
    setTodayFocusStatus("");
    setTodayFocusLoadState(selectedReceiverUserId ? "loading" : "idle");
    clearTodayFocusCompletionTimers();
  }, [selectedReceiverUserId]);

  const refreshTodayFocus = useCallback(async () => {
    if (!selectedReceiverUserId) {
      if (todayFocusItems.length === 0) {
        setTodayFocusLoadState("idle");
      }
      setTodayFocusStatus("Choose a Main Connect User to show Today’s Focus.");
      return;
    }

    setTodayFocusLoadState((current) =>
      todayFocusItems.length > 0 && current === "ready" ? "ready" : "loading"
    );
    if (todayFocusItems.length === 0) {
      setTodayFocusStatus("");
    }

    try {
      const response = await fetch(
        `${connectTodayFocusEndpoint}?personId=${encodeURIComponent(selectedReceiverUserId)}`,
        {
          cache: "no-store",
          headers: await connectReceiverRequestHeaders(),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        focusItems?: Array<
          Partial<ReceiverTodayFocusHomeItem> & { id?: string; title?: string }
        >;
        receiverConfig?: {
          undoWindowMs?: unknown;
        };
      };

      if (!response.ok || !Array.isArray(payload.focusItems)) {
        setTodayFocusLoadState(todayFocusItems.length ? "ready" : "error");
        if (todayFocusItems.length === 0) {
          setTodayFocusStatus(
            "Today’s Focus could not load for this Receiver user."
          );
        }
        return;
      }
      markReceiverOnline();

      setTodayFocusUndoWindowMs(
        normalizeTodayFocusUndoWindowMs(payload.receiverConfig?.undoWindowMs)
      );

      const nextItems = payload.focusItems
        .filter((item): item is ReceiverTodayFocusHomeItem => Boolean(item.id && item.title))
        .map((item) => ({
          completionConfig: item.completionConfig ?? null,
          completionType: item.completionType ?? null,
          id: String(item.id),
          kind:
            item.completionType === "measured_value" ? "weight" : item.kind,
          promptText: item.promptText ?? null,
          title: String(item.title),
        }))
        .filter((item) => !isAppointmentReminderFocusItem(item))
        .slice(0, 3);

      if (nextItems.length) {
        resetTodayFocusList(nextItems);
        return;
      }

      if (todayFocusItems.length > 0) {
        setTodayFocusLoadState("ready");
        return;
      }

      resetTodayFocusList([]);
      setTodayFocusStatus("No Today’s Focus items are ready for this person.");
    } catch {
      markReceiverOffline();
      // Today's Focus should improve the home screen when available, never block it.
      setTodayFocusLoadState(todayFocusItems.length ? "ready" : "error");
      if (todayFocusItems.length === 0) {
        setTodayFocusStatus("Today’s Focus could not load right now.");
      }
    }
  }, [selectedReceiverUserId, todayFocusItems.length]);

  const refreshCalls = useCallback(async () => {
    if (!selectedReceiverUserId) return;

    try {
      const response = await fetch(
        `${connectCallsEndpoint}?personId=${encodeURIComponent(selectedReceiverUserId)}`,
        {
          cache: "no-store",
          headers: await connectReceiverRequestHeaders(),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        calls?: Array<Partial<ReceiverCall>>;
      };

      if (!response.ok || !Array.isArray(payload.calls)) return;
      markReceiverOnline();
      const pendingReviews = payload.calls.filter((call) => {
        const status = String(call.summaryStatus || "");
        return (
          ["pending_review", "pending", "completed"].includes(status) &&
          Boolean(String(call.summaryText || call.generatedSummaryText || "").trim())
        );
      });
      setPendingCallSummaryReviews(pendingReviews);

      const activeCall = payload.calls.find((call) =>
        receiverCallRecordStateIsActive(String(call.state || ""))
      );
      if (activeCall?.callId && locallyEndedCallIdsRef.current.has(String(activeCall.callId))) {
        setInterruptedReviewIncomingCall((current) =>
          current?.callId === activeCall.callId ? null : current
        );
        setModal((current) => {
          if (
            current?.type !== "incomingCall" ||
            current.callId !== activeCall.callId ||
            current.callState !== "ended"
          ) {
            return current;
          }

          return {
            ...current,
            summaryStatus: String(activeCall.summaryStatus || current.summaryStatus || ""),
            summaryText: String(activeCall.summaryText || current.summaryText || ""),
            generatedSummaryText: String(
              activeCall.generatedSummaryText || current.generatedSummaryText || ""
            ),
            transcriptStatus: String(activeCall.transcriptStatus || current.transcriptStatus || ""),
            transcriptText: String(activeCall.transcriptText || current.transcriptText || ""),
            transcriptCleanupStatus: String(
              activeCall.transcriptCleanupStatus || current.transcriptCleanupStatus || ""
            ),
          };
        });
        logReceiverCallEvent(String(activeCall.callId), "call_receiver_poll_ignored_locally_ended_call", {
          source: "refreshCalls",
          serverState: String(activeCall.state || ""),
        });
        return;
      }
      if (!activeCall?.callId) {
        setInterruptedReviewIncomingCall(null);
        setModal((current) => {
          if (current?.type !== "incomingCall") return current;
          if (current.callState === "ended") {
            const endedCall = payload.calls?.find(
              (call) => call.callId === current.callId
            );
            if (!endedCall) return current;
            const nextSummaryStatus = String(
              endedCall.summaryStatus || current.summaryStatus || ""
            );
            const nextSummaryText = String(
              endedCall.summaryText || current.summaryText || ""
            );
            const nextDraftText = String(
              endedCall.summaryApprovalDraftText ||
                current.summaryDraft ||
                endedCall.summaryText ||
                current.summaryText ||
                ""
            );
            const summaryReadyForReview =
              Boolean(nextSummaryText.trim()) ||
              ["failed", "summary_failed", "not_needed", "approved", "pending_review", "expired_unreviewed"].includes(nextSummaryStatus);

            return {
              ...current,
              approvedSummaryText: String(
                endedCall.approvedSummaryText || current.approvedSummaryText || ""
              ),
              generatedSummaryText: String(
                endedCall.generatedSummaryText || current.generatedSummaryText || nextSummaryText
              ),
              summaryAutoOpened: current.summaryAutoOpened || summaryReadyForReview,
              summaryStatus: nextSummaryStatus,
              summaryText: nextSummaryText,
              summaryDraft: stripCareSummaryHeading(nextDraftText),
              summaryDraftSavedText:
                endedCall.summaryApprovalDraftText || current.summaryDraftSavedText,
              transcriptStatus: String(
                endedCall.transcriptStatus || current.transcriptStatus || ""
              ),
              transcriptText: String(
                endedCall.transcriptText || current.transcriptText || ""
              ),
              transcriptCleanupStatus: String(
                endedCall.transcriptCleanupStatus || current.transcriptCleanupStatus || ""
              ),
              textView:
                current.textView ||
                (!current.summaryAutoOpened && summaryReadyForReview ? "summary" : undefined),
            };
          }
          logReceiverCallEvent(current.callId, "call_receiver_poll_no_active_call", {
            currentCallState: current.callState,
            source: "refreshCalls",
          });
          stopLiveCallAudio();
          setStatus("Call ended.");
          return {
            ...current,
            callEndedAt: current.callEndedAt || new Date().toISOString(),
            callState: "ended",
            textView: undefined,
          };
        });
        return;
      }

      const callState = String(activeCall.state || "ringing");
      const receiverCallState = receiverCallUiStateFromRecordState(callState);
      const callerName = String(activeCall.callerName || "Andrew");
      const summaryStatus = String(activeCall.summaryStatus || "");
      const summaryText = String(activeCall.summaryText || "");
      const generatedSummaryText = String(activeCall.generatedSummaryText || summaryText || "");
      const summaryDraftText = stripCareSummaryHeading(
        String(activeCall.summaryApprovalDraftText || summaryText || "")
      );
      const transcriptStatus = String(activeCall.transcriptStatus || "");
      const transcriptText = String(activeCall.transcriptText || "");
      const activeCallId = String(activeCall.callId);
      const visibleModal = modalRef.current;
      const activeCallWouldInterruptSummaryReview =
        visibleModal?.type === "incomingCall" &&
        visibleModal.callId !== activeCall.callId &&
        visibleModal.textView === "summary" &&
        visibleModal.summaryApproval !== "approved";
      setInterruptedReviewIncomingCall(
        activeCallWouldInterruptSummaryReview && receiverCallState === "incoming"
          ? activeCall
          : null
      );
      if (receiverCallState !== "incoming" && !callStartedAtByCallIdRef.current[activeCallId]) {
        callStartedAtByCallIdRef.current[activeCallId] = new Date().toISOString();
      }
      setModal((current) => {
        const currentIsSameCall =
          current?.type === "incomingCall" && current.callId === activeCall.callId;
        const stableCallStartedAt =
          callStartedAtByCallIdRef.current[activeCallId] ||
          (currentIsSameCall ? current.callStartedAt : undefined) ||
          (receiverCallState === "incoming" ? undefined : new Date().toISOString());
        if (stableCallStartedAt && !callStartedAtByCallIdRef.current[activeCallId]) {
          callStartedAtByCallIdRef.current[activeCallId] = stableCallStartedAt;
        }
        const shouldPreserveLocalAnsweredState =
          currentIsSameCall &&
          (current.callState === "connecting" || current.callState === "connected") &&
          (receiverCallState === "incoming" || receiverCallState === "connecting");
        if (
          currentIsSameCall &&
          current.callState !== receiverCallState
        ) {
          logReceiverCallEvent(String(activeCall.callId), "call_receiver_poll_state_changed", {
            nextCallState: callState,
            previousCallState: current.callState,
            source: "refreshCalls",
            preservedLocalAnsweredState: shouldPreserveLocalAnsweredState,
          });
        }
        if (
          currentIsSameCall &&
          (current.callState === receiverCallState || shouldPreserveLocalAnsweredState)
        ) {
          if (!receiverCallRecordStateIsActive(String(activeCall.state || ""))) {
            locallyEndedCallIdsRef.current.delete(String(activeCall.callId));
          }
          return {
            ...current,
            callState: shouldPreserveLocalAnsweredState
              ? current.callState
              : receiverCallState,
            callStartedAt: stableCallStartedAt,
            approvedSummaryText: String(
              activeCall.approvedSummaryText || current.approvedSummaryText || ""
            ),
            generatedSummaryText,
            summaryStatus,
            summaryText,
            summaryDraft: current.summaryDraft?.trim()
              ? stripCareSummaryHeading(current.summaryDraft)
              : summaryDraftText || current.summaryDraft,
            summaryDraftSavedText:
              activeCall.summaryApprovalDraftText || current.summaryDraftSavedText,
            transcriptStatus,
            transcriptText,
          };
        }
        if (
          activeCallWouldInterruptSummaryReview
        ) {
          return current;
        }

        return {
          callId: String(activeCall.callId),
          callerName,
          callState: receiverCallState === "idle" ? "incoming" : receiverCallState,
          callStartedAt: stableCallStartedAt,
          approvedSummaryText: String(activeCall.approvedSummaryText || ""),
          generatedSummaryText,
          transcriptText,
          transcriptStatus,
          summaryStatus,
          summaryDraft: summaryDraftText,
          summaryDraftSavedText: activeCall.summaryApprovalDraftText,
          summaryText,
          type: "incomingCall",
        };
      });
      setStatus(
        receiverCallState === "incoming"
          ? `${callerName} is calling.`
          : receiverCallState === "connecting"
            ? `Connecting to ${callerName}.`
            : `Connected to ${callerName}.`
      );
    } catch {
      markReceiverOffline();
      // Keep the receiver usable if the Connect local server is unavailable.
    }
  }, [selectedReceiverUserId]);

  function openPendingCallSummaryReview(call: Partial<ReceiverCall>) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    if (!call.callId) return;
    const summaryText = String(call.summaryText || call.generatedSummaryText || "");
    setModal({
      approvedSummaryText: String(call.approvedSummaryText || ""),
      callId: String(call.callId),
      callerName: String(call.callerName || "Andrew"),
      callState: "ended",
      generatedSummaryText: String(call.generatedSummaryText || summaryText),
      summaryDraft: stripCareSummaryHeading(String(call.summaryApprovalDraftText || summaryText)),
      summaryDraftSavedText: String(call.summaryApprovalDraftText || ""),
      summaryStatus: String(call.summaryStatus || "pending_review"),
      summaryText,
      textView: "summary",
      transcriptStatus: String(call.transcriptStatus || ""),
      transcriptText: String(call.transcriptText || ""),
      type: "incomingCall",
    });
  }

  function openAttentionItem(item: ReceiverAttentionItem | null) {
    if (!item) return;
    if (item.kind === "call_summary_review") {
      openPendingCallSummaryReview(item.call);
      return;
    }
    if (item.kind === "new_message") {
      openMessage(item.message);
    }
  }

  function advanceAfterCallSummaryApproval(callId: string | undefined) {
    if (summaryApprovalAdvanceTimerRef.current) {
      window.clearTimeout(summaryApprovalAdvanceTimerRef.current);
    }

    const remainingReviews = pendingCallSummaryReviewsRef.current.filter(
      (call) => String(call.callId || "") !== String(callId || "")
    );
    pendingCallSummaryReviewsRef.current = remainingReviews;
    setPendingCallSummaryReviews(remainingReviews);

    summaryApprovalAdvanceTimerRef.current = window.setTimeout(() => {
      summaryApprovalAdvanceTimerRef.current = null;
      const nextReview = pendingCallSummaryReviewsRef.current[0];
      if (nextReview?.callId) {
        openPendingCallSummaryReview(nextReview);
        return;
      }
      setModal((current) =>
        current?.type === "incomingCall" &&
        current.callId === callId &&
        current.summaryApproval === "approved"
          ? null
          : current
      );
    }, 1800);
  }

  useEffect(() => {
    modalRef.current = modal;
  }, [modal]);

  useEffect(() => {
    pendingCallSummaryReviewsRef.current = pendingCallSummaryReviews;
  }, [pendingCallSummaryReviews]);

  useEffect(() => {
    return () => {
      if (summaryApprovalAdvanceTimerRef.current) {
        window.clearTimeout(summaryApprovalAdvanceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!started && readInitialStarted()) {
      setStarted(true);
    }
  }, [started]);

  useEffect(() => {
    function updateApplianceScale() {
      setApplianceStyle(receiverApplianceStyle(initialDevicePixelRatioRef.current, deskPhoneMode));
    }

    updateApplianceScale();
    window.addEventListener("resize", updateApplianceScale);
    window.addEventListener("orientationchange", updateApplianceScale);
    window.visualViewport?.addEventListener("resize", updateApplianceScale);

    return () => {
      window.removeEventListener("resize", updateApplianceScale);
      window.removeEventListener("orientationchange", updateApplianceScale);
      window.visualViewport?.removeEventListener("resize", updateApplianceScale);
    };
  }, [deskPhoneMode]);

  useEffect(() => {
    function stopBrowserZoomShortcuts(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (["+", "=", "-", "_", "0"].includes(event.key)) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", stopBrowserZoomShortcuts, { capture: true });
    return () => window.removeEventListener("keydown", stopBrowserZoomShortcuts, { capture: true });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (screenCleaningSecondsRemaining === null) return undefined;

    const timer = window.setInterval(() => {
      setScreenCleaningSecondsRemaining((remaining) => {
        if (remaining === null) return null;
        if (remaining <= 1) {
          completeScreenCleaningSession();
          setModal(null);
          setStatus("Ready.");
          return null;
        }

        return remaining - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [screenCleaningSecondsRemaining]);

  useEffect(() => {
    function syncFullscreenState() {
      const fullscreenDocument = document as FullscreenDocument;
      setFullscreenActive(
        Boolean(document.fullscreenElement || fullscreenDocument.webkitFullscreenElement)
      );
    }

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(receiverAutoHearStorageKey, autoHearPreference);
  }, [autoHearPreference]);

  useEffect(() => {
    let cancelled = false;

    async function refreshAudioPreference() {
      if (!selectedReceiverUserId) {
        setAudioPreference(defaultConnectAudioPreference());
        return;
      }

      try {
        const profileUrl = `${connectAudioProfileEndpoint}?personId=${encodeURIComponent(selectedReceiverUserId)}`;
        const response = await fetch(profileUrl, {
          cache: "no-store",
          headers: await connectReceiverRequestHeaders(),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          localPlaybackEvents?: Array<Record<string, unknown>>;
          profile?: { enhancementEvents?: Array<Record<string, unknown>> };
        };
        const events = payload.localPlaybackEvents?.length
          ? payload.localPlaybackEvents
          : payload.profile?.enhancementEvents ?? [];

        if (!cancelled) setAudioPreference(connectAudioPreferenceFromEvents(events));
      } catch {
        // Audio preference should improve playback when available, never block it.
      }
    }

    void refreshAudioPreference();

    return () => {
      cancelled = true;
    };
  }, [selectedReceiverUserId]);

  useEffect(() => {
    return () => {
      receiverRecordingControllerRef.current?.cancel();
      contactRecordingControllerRef.current?.cancel();
      liveCallAudioRef.current?.stop();
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      cueAudioRef.current?.pause();
      if (cueTimeoutRef.current) window.clearTimeout(cueTimeoutRef.current);
      if (pendingContactRecording?.recording.localUrl) {
        URL.revokeObjectURL(pendingContactRecording.recording.localUrl);
      }
      clearTodayFocusCompletionTimers();
    };
  }, [pendingContactRecording]);

  function applyBoundReceiverActivePerson(personId?: string) {
    const normalizedPersonId = personId?.trim() || "";
    if (!normalizedPersonId) return;
    setActiveReceiverUsers((current) =>
      current.some((user) => user.id === normalizedPersonId)
        ? current
        : [
            {
              displayName: "Receiver Active Person",
              id: normalizedPersonId,
              statusLabel: "Receiver ready",
            },
            ...current,
          ]
    );
    setSelectedReceiverUserId(normalizedPersonId);
  }

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      if (readInitialStarted()) {
        setStarted(true);
      }
      setReceiverSessionRestored(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!receiverSessionRestored) return;

    const session: StoredReceiverSession = {
      askDraft,
      contactDraft,
      mainConnectUserPersonId: selectedReceiverUserId || undefined,
      messageTextSize,
      modal: storableReceiverModal(modal),
      selectedContactId,
      soundSettings,
      started,
    };

    window.localStorage.setItem(receiverSessionStorageKey, JSON.stringify(session));
  }, [
    askDraft,
    contactDraft,
    messageTextSize,
    modal,
    receiverSessionRestored,
    selectedContactId,
    selectedReceiverUserId,
    soundSettings,
    started,
  ]);

  useEffect(() => {
    if (readLocalTestReceiverProvisioning()) {
      clearReceiverBinding();
      window.localStorage.setItem(receiverRegistrationStorageKey, testReceiverUser.id);
      setReceiverRegistered(true);
      setActiveReceiverUsers([testReceiverUser]);
      setSelectedReceiverUserId(testReceiverUser.id);
    }
  }, []);

  useEffect(() => {
    if (readLocalTestReceiverProvisioning()) return;
    const receiverDeviceId = readReceiverDeviceId();
    const receiverInstallId = readReceiverInstallId();
    if (!receiverDeviceId || !receiverInstallId) return;
    let cancelled = false;
    let hasConfirmedBinding = false;

    async function verifyBinding() {
      try {
        const payload = await verifyReceiverBindingHeartbeat();
        if (!payload) return;
        if (cancelled) return;

        saveReceiverBinding(payload);
        hasConfirmedBinding = true;
        setReceiverRegistered(true);
        applyBoundReceiverActivePerson(payload.mainConnectUserPersonId);
        setRegistrationError("");
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Receiver setup could not be confirmed.";
        if (isReceiverSetupRequiredMessage(message)) {
          clearReceiverBinding();
          setReceiverRegistered(false);
          setActiveReceiverUsers(receiverUsers);
          setSelectedReceiverUserId("");
          setRegistrationError(message);
          return;
        }
        if (!hasConfirmedBinding) {
          setStatus("Receiver setup check is pending.");
        }
      }
    }

    void verifyBinding();
    const heartbeatId = window.setInterval(() => {
      void verifyBinding();
    }, RECEIVER_BINDING_HEARTBEAT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatId);
    };
  }, []);

  useEffect(() => {
    const claim = readReceiverShellClaim();
    if (!claim || receiverRegistered) return;
    let cancelled = false;

    async function redeemClaim() {
      try {
        const response = await fetch("/api/connect/receiver-shell/claims/redeem", {
          body: JSON.stringify({
            claim,
            receiverInstallId: readReceiverInstallId(),
          }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json().catch(() => ({}))) as {
          bindingStatus?: string;
          deviceProfile?: string;
          error?: string;
          hardwareProfile?: string;
          mainConnectUserPersonId?: string;
          receiverDeviceId?: string;
          receiverInstallId?: string;
          receiverUrl?: string;
          storageSource?: string;
          uiLayout?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Receiver setup link could not be verified.");
        }
        if (cancelled) return;

        saveReceiverBinding({
          bindingStatus: payload.bindingStatus || "bound",
          deviceProfile: payload.deviceProfile,
          hardwareProfile: payload.hardwareProfile,
          mainConnectUserPersonId: payload.mainConnectUserPersonId,
          receiverDeviceId: payload.receiverDeviceId,
          receiverInstallId: payload.receiverInstallId || readReceiverInstallId(),
          receiverUrl: payload.receiverUrl,
          storageSource: payload.storageSource,
          uiLayout: payload.uiLayout,
        });
        window.localStorage.setItem(receiverRegistrationStorageKey, testReceiverUser.id);
        setReceiverRegistered(true);
        applyBoundReceiverActivePerson(payload.mainConnectUserPersonId);
        setRegistrationCode("");
        setRegistrationError("");
        setStatus(
          payload.receiverDeviceId
            ? `Receiver linked: ${payload.receiverDeviceId}.`
            : "Receiver linked."
        );
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Receiver setup link could not be verified.";
        if (isReceiverSetupRequiredMessage(message)) {
          clearReceiverBinding();
          setReceiverRegistered(false);
        }
        setRegistrationError(message);
      }
    }

    void redeemClaim();

    return () => {
      cancelled = true;
    };
  }, [receiverRegistered]);

  useEffect(() => {
    if (!receiverSessionRestored || !started || receiverRegistered || selectedReceiverUserId) {
      return undefined;
    }
    if (readLocalTestReceiverProvisioning() || readReceiverShellClaim()) return undefined;

    let cancelled = false;
    let pollTimer: number | undefined;

    async function redeemPairedClaim(claim: string) {
      const response = await fetch("/api/connect/receiver-shell/claims/redeem", {
        body: JSON.stringify({
          claim,
          receiverInstallId: readReceiverInstallId(),
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as StoredReceiverBinding & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Receiver setup could not be completed.");
      }
      saveReceiverBinding(payload);
      setReceiverRegistered(true);
      applyBoundReceiverActivePerson(payload.mainConnectUserPersonId);
      setRegistrationError("");
      setBrowserPairingStatus("Receiver ready.");
    }

    async function pollPairing(code: string, receiverDeviceId: string) {
      try {
        const params = new URLSearchParams({ code });
        if (receiverDeviceId) params.set("receiverDeviceId", receiverDeviceId);
        const response = await fetch(
          `/api/connect/receiver-shell/pairing-sessions?${params.toString()}`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          claim?: string;
          error?: string;
          status?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Receiver pairing could not be checked.");
        }
        if (cancelled) return;
        if (payload.status === "paired" && payload.claim) {
          setBrowserPairingStatus("Receiver detected. Finishing setup...");
          await redeemPairedClaim(payload.claim);
          return;
        }
        if (payload.status === "expired") {
          setBrowserPairingStatus("This code expired. Refresh the Receiver for a new code.");
          return;
        }
        pollTimer = window.setTimeout(() => void pollPairing(code, receiverDeviceId), 2500);
      } catch (error) {
        if (cancelled) return;
        setBrowserPairingStatus(
          error instanceof Error ? error.message : "Receiver pairing could not be checked."
        );
        pollTimer = window.setTimeout(() => void pollPairing(code, receiverDeviceId), 5000);
      }
    }

    async function startBrowserPairing() {
      try {
        setBrowserPairingStatus("Preparing Receiver setup...");
        const profile = readReceiverProfileSelection();
        const response = await fetch("/api/connect/receiver-shell/pairing-sessions", {
          body: JSON.stringify({
            deviceProfile: "web_receiver",
            hardwareProfile: profile.hardwareProfile || "web",
            receiverInstallId: readReceiverInstallId(),
            receiverUrl: window.location.origin
              ? new URL("/connect/receiver", window.location.origin).toString()
              : "/connect/receiver",
            uiLayout: profile.uiLayout || "default_receiver",
          }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          expiresAt?: string;
          pairingCode?: string;
          receiverDeviceId?: string;
        };
        if (!response.ok || !payload.pairingCode) {
          throw new Error(payload.error || "Receiver setup could not start.");
        }
        if (cancelled) return;
        setBrowserPairingCode(payload.pairingCode);
        setBrowserPairingExpiresAt(payload.expiresAt || "");
        setBrowserPairingStatus("Enter this code in Connect to pair this Receiver.");
        void pollPairing(payload.pairingCode, payload.receiverDeviceId || "");
      } catch (error) {
        if (cancelled) return;
        setBrowserPairingStatus(
          error instanceof Error ? error.message : "Receiver setup could not start."
        );
      }
    }

    void startBrowserPairing();

    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [receiverRegistered, receiverSessionRestored, selectedReceiverUserId, started]);

  useEffect(() => {
    let ignore = false;

    async function refreshReceiverUsers() {
      if (!receiverRegistered) return;
      try {
        const context = await fetchConnectMainUserContext();
        const users = context.people.slice(0, 4).map((person) => ({
          displayName: person.displayName,
          id: person.id,
          statusLabel:
            person.id === context.mainConnectUserPersonId
              ? "Main Connect User"
              : "CarePland person",
        }));

        if (ignore) return;
        setActiveReceiverUsers(users.length ? users : receiverUsers);
        setSelectedReceiverUserId(context.mainConnectUserPersonId || "");
      } catch {
        if (!ignore && receiverRegistered) {
          setActiveReceiverUsers([testReceiverUser]);
          setSelectedReceiverUserId(testReceiverUser.id);
        }
      }
    }

    void refreshReceiverUsers();

    return () => {
      ignore = true;
    };
  }, [receiverRegistered]);

  useEffect(() => {
    if (!started) return undefined;

    const firstRefresh = window.setTimeout(() => {
      void refreshMessages();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshMessages();
    }, 5000);

    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
    };
  }, [refreshMessages, started]);

  useEffect(() => {
    if (!started || !deskPhoneMode || gxvHomeLayout !== "focus_v1") return undefined;

    const firstRefresh = window.setTimeout(() => {
      void refreshTodayFocus();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshTodayFocus();
    }, 60000);

    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
    };
  }, [deskPhoneMode, gxvHomeLayout, refreshTodayFocus, started]);

  useEffect(() => {
    if (!started) return undefined;

    const firstRefresh = window.setTimeout(() => {
      void refreshCalls();
    }, 0);
    const timer = window.setInterval(() => {
      void refreshCalls();
    }, 2500);

    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
    };
  }, [refreshCalls, started]);

  useEffect(() => {
    const modalIncoming =
      modal?.type === "incomingCall" && modal.callState === "incoming";
    const interruptedIncoming = Boolean(interruptedReviewIncomingCall?.callId);
    if (!started || (!modalIncoming && !interruptedIncoming)) {
      stopReceiverCue();
      return undefined;
    }

    stopReceiverCue();
    cueAudioRef.current = playReceiverIncomingRing(soundSettings, false, true) || null;

    return () => {
      stopReceiverCue();
    };
  }, [interruptedReviewIncomingCall, modal, soundSettings, started]);

  useEffect(() => {
    function applyGuideTarget(value: string | null) {
      setGuideTarget(parseGuideTarget(value));
    }
    function applyGuideRect(value: string | null) {
      setGuideRect(parseGuideRect(value));
    }

    applyGuideTarget(window.localStorage.getItem(receiverGuideTargetStorageKey));
    applyGuideRect(window.localStorage.getItem(receiverGuideRectStorageKey));

    function handleStorage(event: StorageEvent) {
      if (event.key === receiverGuideTargetStorageKey) {
        applyGuideTarget(event.newValue);
      }
      if (event.key === receiverGuideRectStorageKey) {
        applyGuideRect(event.newValue);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!started) return undefined;
    let cancelled = false;
    const receiverId = readReceiverGuideId();
    const receiverSessionId = readReceiverGuideSessionId();

    async function syncReceiverGuideState() {
      try {
        await fetch(receiverGuideEndpoint, {
          body: JSON.stringify({
            action: "presence",
            deviceProfile: deskPhoneMode ? "gxv3370" : "default",
            pageUrl: window.location.pathname + window.location.search,
            receiverId,
            receiverSessionId,
            uiLayout: gxvFocusHomeEnabled ? "desk_phone_focus_v1" : "default_receiver",
          }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });

        const response = await fetch(
          `${receiverGuideEndpoint}?receiverId=${encodeURIComponent(receiverId)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          guide?: {
            identifyRequests?: Array<{
              code?: string;
              expiresAt?: number;
              receiverSessionId?: string;
            }>;
            rect?: GuideRect | null;
            target?: string | null;
            targetReceiverSessionId?: string;
          };
        };
        const guide = payload.guide;
        const targetSessionId = guide?.targetReceiverSessionId || "";

        if (cancelled) return;
        if (targetSessionId && targetSessionId !== receiverSessionId) {
          setGuideTarget(null);
          setGuideRect(null);
          setGuideIdentifyCode("");
          return;
        }

        const identifyRequest = guide?.identifyRequests?.find(
          (request) =>
            request.receiverSessionId === receiverSessionId &&
            Number(request.expiresAt || 0) > Date.now()
        );
        setGuideTarget(parseGuideTarget(guide?.target ?? null));
        setGuideRect(guide?.rect ?? null);
        setGuideIdentifyCode(String(identifyRequest?.code || ""));
      } catch {
        // Remote guide sync is best-effort; same-browser storage remains available.
      }
    }

    void syncReceiverGuideState();
    const timer = window.setInterval(() => {
      void syncReceiverGuideState();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [started]);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? contacts[0],
    [selectedContactId]
  );
  const visibleReceiverUsers = activeReceiverUsers.slice(0, 4);
  const selectedReceiverUser =
    visibleReceiverUsers.find((user) => user.id === selectedReceiverUserId) ??
    noMainConnectUser;
  const displayedAppointment =
    appointmentDisplay.appointments[0] ?? fallbackNextReceiverAppointment();
  const displayedAppointmentTimeLabel = appointmentDateTimeLabel(displayedAppointment);
  const cachedAppointmentTimestamp =
    appointmentDisplay.source === "cache" && appointmentDisplay.cachedAt
      ? formatReceiverCacheTimestamp(appointmentDisplay.cachedAt)
      : "";
  const connectivityStatusLabel = receiverConnectivityStatusLabel({
    cachedAppointmentCount:
      appointmentDisplay.source === "cache" ? appointmentDisplay.appointments.length : 0,
    online: receiverOnline,
  });
  const focusedMessage = messages[focusedMessageIndex] ?? messages[0] ?? null;
  const hasMessagePaging = messages.length > 1;
  const visibleTodayFocusItems = todayFocusItems
    .filter((item) => !isAppointmentReminderFocusItem(item))
    .filter((item) => !todayFocusCompletedIds.includes(item.id))
    .slice(0, 3);
  const attentionItem = resolveReceiverAttentionItem({
    messages,
    pendingCallSummaryReviews,
  });
  const todayFocusDisplayMode =
    visibleTodayFocusItems.length > 0
      ? "items"
      : todayFocusLoadState === "idle" || todayFocusLoadState === "loading"
        ? "loading"
        : "receiver_fallback";

  function clearGuideBecauseReceiverActed() {
    if (guideTarget || guideRect) {
      const pressedLabel = guideRect?.label;
      const receiverId = readReceiverGuideId();
      const receiverSessionId = readReceiverGuideSessionId();
      window.localStorage.removeItem(receiverGuideTargetStorageKey);
      window.localStorage.removeItem(receiverGuideRectStorageKey);
      window.localStorage.setItem(
        receiverLastPressStorageKey,
        JSON.stringify({ label: pressedLabel, pressedAt: currentEpochMs(), target: guideTarget })
      );
      void fetch(receiverGuideEndpoint, {
        body: JSON.stringify({
          action: "press",
          label: pressedLabel,
          pressedAt: currentEpochMs(),
          receiverId,
          receiverSessionId,
          target: guideTarget,
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).catch(() => undefined);
      setGuideTarget(null);
      setGuideRect(null);
      setStatus("Guide cleared. You chose what to do.");
    }
  }

  function toggleGxvHomeLayout() {
    const nextLayout = gxvHomeLayout === "focus_v1" ? "classic" : "focus_v1";
    setGxvHomeLayout(nextLayout);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (nextLayout === "focus_v1") {
        url.searchParams.set("homeLayout", "focus_v1");
      } else {
        url.searchParams.delete("homeLayout");
      }
      window.history.replaceState(null, "", url.toString());
    }
    if (nextLayout === "focus_v1") {
      resetTodayFocusList(todayFocusItems);
      void refreshTodayFocus();
    }
  }

  function completeTodayFocusItem(item: ReceiverTodayFocusHomeItem) {
    clearGuideBecauseReceiverActed();
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    if (
      todayFocusCompletingId ||
      todayFocusCompletedIds.includes(item.id) ||
      todayFocusPendingCompletions[item.id]
    ) {
      return;
    }
    if (item.completionType === "measured_value" || item.kind === "weight") {
      setModal({ type: "todayFocusWeight", item });
      return;
    }

    markTodayFocusComplete(item);
  }

  async function markTodayFocusComplete(
    item: ReceiverTodayFocusHomeItem,
    completion: ReceiverTodayFocusCompletionInput = {}
  ) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    if (
      todayFocusCompletingId ||
      todayFocusCompletedIds.includes(item.id) ||
      todayFocusPendingCompletions[item.id]
    ) {
      return;
    }

    if (!selectedReceiverUserId) {
      setStatus("Choose a Main Connect User before saving Today’s Focus.");
      return;
    }

    setTodayFocusCompletingId(item.id);
    setStatus(`Saving ${item.title}.`);

    try {
      const response = await fetch(connectTodayFocusEndpoint, {
        body: JSON.stringify({
          focusItemId: item.id,
          occurredAt: new Date().toISOString(),
          personId: selectedReceiverUserId,
          unit: completion.unit ?? null,
          value: completion.value ?? null,
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(await connectReceiverRequestHeaders()),
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        trackEvent?: {
          id?: string;
        };
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Today’s Focus could not be saved.");
      }

      const trackEventId = String(payload.trackEvent?.id || "");
      if (!trackEventId) {
        throw new Error("Today’s Focus was saved, but Undo is not available.");
      }

      setTodayFocusPendingCompletions((current) => ({
        ...current,
        [item.id]: { trackEventId },
      }));
      clearTodayFocusCompletionTimer(item.id);
      todayFocusCompletionTimersRef.current[item.id] = window.setTimeout(() => {
        setTodayFocusPendingCompletions((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
        setTodayFocusCompletedIds((current) =>
          current.includes(item.id) ? current : [...current, item.id]
        );
        delete todayFocusCompletionTimersRef.current[item.id];
      }, todayFocusUndoWindowMs);
      setStatus(`${item.title} saved.`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Today’s Focus could not be saved."
      );
    } finally {
      setTodayFocusCompletingId("");
    }
  }

  async function undoTodayFocusCompletion(item: ReceiverTodayFocusHomeItem) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    const pendingCompletion = todayFocusPendingCompletions[item.id];

    if (!pendingCompletion || !selectedReceiverUserId) {
      return;
    }

    clearTodayFocusCompletionTimer(item.id);
    setTodayFocusPendingCompletions((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    setStatus(`Undoing ${item.title}.`);

    try {
      const response = await fetch(connectTodayFocusEndpoint, {
        body: JSON.stringify({
          focusItemId: item.id,
          personId: selectedReceiverUserId,
          trackEventId: pendingCompletion.trackEventId,
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(await connectReceiverRequestHeaders()),
        },
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Today’s Focus could not be undone.");
      }

      setTodayFocusCompletedIds((current) =>
        current.filter((completedId) => completedId !== item.id)
      );
      setStatus(`${item.title} unchecked.`);
    } catch (error) {
      setTodayFocusPendingCompletions((current) => ({
        ...current,
        [item.id]: pendingCompletion,
      }));
      todayFocusCompletionTimersRef.current[item.id] = window.setTimeout(() => {
        setTodayFocusPendingCompletions((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
        setTodayFocusCompletedIds((current) =>
          current.includes(item.id) ? current : [...current, item.id]
        );
        delete todayFocusCompletionTimersRef.current[item.id];
      }, todayFocusUndoWindowMs);
      setStatus(
        error instanceof Error
          ? error.message
          : "Today’s Focus could not be undone."
      );
    }
  }

  async function chooseTodayFocusPreference(
    action: TodayFocusCadencePreferenceAction,
    cadence?: TodayFocusCadencePreferenceCadence
  ) {
    const item = todayFocusPreferenceItem;

    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }

    if (!item || !selectedReceiverUserId) {
      return;
    }

    if (action === "show_less_often" && !cadence) {
      setTodayFocusPreferenceStep("cadence");
      return;
    }

    setTodayFocusStatus("Saving Today’s Focus preference.");

    try {
      const response = await fetch(connectTodayFocusPreferencesEndpoint, {
        body: JSON.stringify({
          action,
          cadence: cadence ?? null,
          focusItemId: item.id,
          personId: selectedReceiverUserId,
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(await connectReceiverRequestHeaders()),
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Today’s Focus preference could not be saved.");
      }

      setTodayFocusCompletedIds((current) =>
        current.includes(item.id) ? current : [...current, item.id]
      );
      setTodayFocusPreferenceItem(null);
      setTodayFocusPreferenceStep("main");
      setTodayFocusStatus("CarePland will adjust how often this appears.");
      void refreshTodayFocus();
    } catch (error) {
      setTodayFocusStatus(
        error instanceof Error
          ? error.message
          : "Today’s Focus preference could not be saved."
      );
    }
  }

  function registerReceiverWithCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = registrationCode.trim();

    if (normalizedCode !== testReceiverRegistrationCode) {
      setRegistrationError("Code not recognized.");
      return;
    }

    clearReceiverBinding();
    window.localStorage.setItem(receiverRegistrationStorageKey, testReceiverUser.id);
    setReceiverRegistered(true);
    setActiveReceiverUsers([testReceiverUser]);
    setSelectedReceiverUserId(testReceiverUser.id);
    setRegistrationCode("");
    setRegistrationError("");
    setStatus(`Receiver registered for ${testReceiverUser.displayName}.`);
  }

  async function chooseReceiverUser(user: ReceiverUser) {
    clearGuideBecauseReceiverActed();
    if (!user.id) return;
    try {
      const context = await updateConnectMainUserContext({
        mainConnectUserPersonId: user.id,
      });
      setSelectedReceiverUserId(context.mainConnectUserPersonId || "");
      setStatus(`Main Connect User: ${user.displayName}`);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to update Main Connect User."
      );
    }
  }

  function openContact(contact = selectedContact) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    clearGuideBecauseReceiverActed();
    setContactDraft("");
    setPendingContactRecording(null);
    setModal({ type: "contact", contactId: contact.id });
  }

  async function sendMessage(contact: Contact, body: string, recording = pendingContactRecording) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    const trimmed = body.trim();
    if (!trimmed && !recording) {
      setStatus("Type or record your message first.");
      return;
    }
    if (!selectedReceiverUser.id) {
      setStatus("Choose a Main Connect User before sending a message.");
      return;
    }

    const optimisticMessage = normalizeServerMessage(
      {},
      {
        audioDurationMs: recording?.recording.durationMs,
        audioArtifactId: recording?.artifactId,
        audioMimeType: recording?.recording.mimeType,
        audioUrl: recording?.audioUrl,
        body: trimmed || recording?.transcript || "Voice message",
        createdAt: currentIsoTimestamp(),
        from: "receiver_user",
        id: `message-contact-${currentEpochMs()}`,
        messageType: recording ? "audio" : "text",
        transcript: recording?.transcript || "",
        transcriptStatus: recording?.transcriptStatus || "",
        to: contact.displayName,
      }
    );

    setMessages((current) => [
      optimisticMessage,
      ...current,
    ]);
    setFocusedMessageIndex(0);

    try {
      const response = await fetch(connectMessagesEndpoint, {
        body: JSON.stringify(
          recording
            ? {
                artifactKind: "receiver_message",
                audioArtifactId: recording.artifactId,
                audioBase64: await blobToBase64(recording.recording.blob),
                audioDirection: "receiver_to_coordinator",
                audioDurationMs: recording.recording.durationMs,
                audioMimeType: recording.recording.mimeType,
                audioUrl: recording.audioUrl,
                body: trimmed || recording.transcript || "Voice message",
                captureContext: createConnectAudioCaptureContext(recording.recording, {
                  artifactKind: "receiver_message",
                  audioDirection: "receiver_to_coordinator",
                  clientAudioCaptureId: recording.clientAudioCaptureId,
                  role: "receiver_user",
                  surface: "receiver_contact_message",
                }),
                clientAudioCaptureId: recording.clientAudioCaptureId,
                clientMessageId: `contact-audio-${currentEpochMs()}`,
                from: "receiver_user",
                mainConnectUserPersonId: selectedReceiverUser.id,
                messageType: "audio",
                receiverId: connectPrototypeReceiverId,
                source: "receiver_contact_message",
                to: contact.displayName,
              }
            : {
                body: trimmed,
                clientMessageId: `receiver-text-${currentEpochMs()}`,
                from: "receiver_user",
                mainConnectUserPersonId: selectedReceiverUser.id,
                messageType: "text",
                receiverId: connectPrototypeReceiverId,
                source: "receiver_contact_message",
                to: contact.displayName,
              }
        ),
        headers: {
          ...(await connectReceiverRequestHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: Partial<Message> & { id?: string };
      };

      if (response.ok && payload.message) {
        const serverMessage = normalizeServerMessage(payload.message, optimisticMessage);
        setMessages((current) =>
          current.map((message) =>
            message.id === optimisticMessage.id ? serverMessage : message
          )
        );
      }
      setStatus(`Message sent to ${contact.displayName}.`);
      setPendingContactRecording(null);
    } catch {
      setStatus(`Message saved here. ${contact.displayName} may see it when Connect is online.`);
    }

    setModal({ type: "sent", recipientName: contact.displayName });
    void refreshMessages();
  }

  function openAsk() {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    clearGuideBecauseReceiverActed();
    setAskDraft("");
    setPendingAskAudio(null);
    setModal({ type: "ask" });
  }

  async function loadUpcomingAppointments(): Promise<ReceiverAppointmentDisplayState> {
    if (!selectedReceiverUser.id) {
      return { appointments: [], source: "online" };
    }

    if (!receiverOnline) {
      const cached = readCachedAppointmentDisplay(selectedReceiverUser.id);
      return cached || { appointments: [], source: "cache" };
    }

    try {
      const response = await fetch(
        `/api/connect/appointments?personId=${encodeURIComponent(selectedReceiverUser.id)}`,
        {
          cache: "no-store",
          headers: await connectReceiverRequestHeaders(),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        appointments?: Array<Partial<ReceiverAppointment> & { id?: string }>;
      };

      if (!response.ok || !Array.isArray(payload.appointments) || !payload.appointments.length) {
        markReceiverOnline();
        setAppointmentDisplay({
          appointments: [fallbackNextReceiverAppointment()],
          source: "fallback",
        });
        return { appointments: [], source: "online" };
      }

      markReceiverOnline();
      const appointments = payload.appointments.map((appointment, index) =>
        normalizeAppointment(appointment, index)
      );
      const cached = updateStoredAppointmentCache(selectedReceiverUser.id, appointments);
      const nextDisplay: ReceiverAppointmentDisplayState = {
        appointments,
        cachedAt: cached?.cachedAt,
        source: "online",
      };
      setAppointmentDisplay(nextDisplay);
      return nextDisplay;
    } catch {
      markReceiverOffline();
      const cached = readCachedAppointmentDisplay(selectedReceiverUser.id);
      if (cached) {
        setAppointmentDisplay(cached);
        return cached;
      }
      return { appointments: [], source: "cache" };
    }
  }

  useEffect(() => {
    if (!selectedReceiverUser.id) return;

    const cached = readCachedAppointmentDisplay(selectedReceiverUser.id);
    if (cached && !receiverOnline) {
      setAppointmentDisplay(cached);
      return;
    }

    if (cached && appointmentDisplay.source !== "online") {
      setAppointmentDisplay(cached);
    }

    if (receiverOnline) {
      void loadUpcomingAppointments();
    }
  }, [receiverOnline, selectedReceiverUser.id]);

  function askAppointmentQuestion() {
    clearGuideBecauseReceiverActed();
    setModal({ type: "appointmentsLoading" });
    setStatus("Looking for upcoming appointments.");

    window.setTimeout(() => {
      void loadUpcomingAppointments().then((display) => {
        const appointments = display.appointments;
        const visibleAppointments =
          appointments.length || !deskPhoneMode
            ? appointments
            : [fallbackNextReceiverAppointment()];

        if (!visibleAppointments.length) {
          setModal({ type: "appointmentsEmpty" });
          setStatus("No upcoming appointments found.");
          return;
        }

        setModal({
          type: "appointmentsList",
          appointments: visibleAppointments,
          cachedAt: display.source === "cache" ? display.cachedAt : undefined,
          page: 0,
        });
        setStatus(`${visibleAppointments.length} upcoming appointments loaded.`);
      });
    }, 350);
  }

  function openHeaderAppointment() {
    clearGuideBecauseReceiverActed();
    setModal({ type: "appointmentsLoading" });
    setStatus("Opening appointment.");

    window.setTimeout(() => {
      void loadUpcomingAppointments().then((display) => {
        const appointments = display.appointments.length
          ? display.appointments
          : [fallbackNextReceiverAppointment()];
        const appointment = appointments[0];

        setModal({
          type: "appointmentDetail",
          appointment,
          appointments,
          cachedAt: display.source === "cache" ? display.cachedAt : undefined,
          page: 0,
        });
        setStatus(`${appointment.title || "Appointment"} opened.`);
      });
    }, 150);
  }

  async function startReceiverRecording() {
    clearGuideBecauseReceiverActed();

    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }

    if (receiverRecording) {
      await stopReceiverRecording();
      return;
    }

    if (!browserConnectAudioRecordingAvailable()) {
      setStatus("Recording is not available on this browser. Typing still works.");
      setModal({ type: "ask" });
      return;
    }

    if (!selectedReceiverUser.id) {
      setStatus("Choose a Main Connect User before recording.");
      setModal({ type: "ask" });
      return;
    }

    try {
      const captureId = createConnectAudioCaptureId("receiver-ask-input");
      receiverCaptureIdRef.current = captureId;
      setAskDraft("");
      setPendingAskAudio(null);
      setModal({ type: "askRecordReview", transcript: "" });
      setReceiverRecording(true);
      setReceiverRecordingProcessing(false);
      setStatus("Recording. Press the mic again to stop.");
      receiverRecordingControllerRef.current = await startConnectAudioRecording({
        maxDurationMs: 30000,
        onAutoStop: (reason) => {
          void stopReceiverRecording(reason);
        },
        silenceGraceMs: 1200,
        silenceThreshold: 0.018,
        stopAfterSilenceMs: 2600,
      });
    } catch {
      receiverCaptureIdRef.current = "";
      receiverRecordingControllerRef.current = null;
      setReceiverRecording(false);
      setStatus("Recording could not start. Typing still works.");
      setModal({ type: "ask" });
    }
  }

  async function stopReceiverRecording(reason?: "max_duration" | "silence") {
    const controller = receiverRecordingControllerRef.current;
    if (!controller) {
      setReceiverRecording(false);
      return;
    }

    receiverRecordingControllerRef.current = null;
    setReceiverRecording(false);
    setReceiverRecordingProcessing(true);
    setAskDraft("Transcribing recording...");
    setModal({ type: "askRecordReview", transcript: "" });
    setStatus(
      reason === "max_duration"
        ? "Time is up. Turning recording into text..."
        : "Turning recording into text..."
    );

    try {
      const recording = await controller.stop();
      if (!recording.size) {
        setStatus("Recording was empty. Try again or type your request.");
        setModal({ type: "ask" });
        return;
      }

      if (!selectedReceiverUser.id) {
        setStatus("Choose a Main Connect User before transcribing this recording.");
        setModal({ type: "ask" });
        return;
      }

      const clientAudioCaptureId =
        receiverCaptureIdRef.current || createConnectAudioCaptureId("receiver-ask-input");
      const transcription = await requestConnectAudioTranscription({
        artifactKind: "ask_input",
        audioDirection: "receiver_local_input",
        captureContext: createConnectAudioCaptureContext(recording, {
          artifactKind: "ask_input",
          audioDirection: "receiver_local_input",
          clientAudioCaptureId,
          role: "receiver_user",
          surface: "receiver_home_mic",
        }),
        clientAudioCaptureId,
        durationMs: recording.durationMs,
        mainConnectUserPersonId: selectedReceiverUser.id,
        mimeType: recording.mimeType,
        receiverId: connectPrototypeReceiverId,
        recording: recording.blob,
        source: "ask-input",
      });
      const transcript = String(transcription.transcript || "").trim();
      const artifact = transcription.artifact;
      setPendingAskAudio(
        artifact?.audioUrl || artifact?.artifactId || artifact?.id
          ? {
              artifactId: String(artifact.artifactId || artifact.id || ""),
              audioByteSize: artifact.audioByteSize,
              audioMimeType: artifact.audioMimeType,
              audioSha256: artifact.audioSha256,
              audioUrl: String(artifact.audioUrl || ""),
              clientAudioCaptureId,
              transcript,
              transcriptStatus: String(
                transcription.transcriptStatus ||
                  artifact.transcriptStatus ||
                  "not_requested"
              ),
            }
          : null
      );
      setAskDraft(transcript);
      setModal(transcript ? { type: "askRecordReview", transcript } : { type: "ask" });
      setStatus(
        transcript
          ? "Recording saved and transcribed. Review or press Ask."
          : "Recording saved, but no transcript came back. You can type your request."
      );
    } catch (error) {
      setModal({ type: "askRecordReview", transcript: "" });
      setStatus(error instanceof Error ? error.message : "Recording could not be transcribed.");
    } finally {
      receiverCaptureIdRef.current = "";
      setReceiverRecordingProcessing(false);
    }
  }

  async function toggleContactRecording(contact: Contact) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    if (contactRecording) {
      await stopContactRecording(contact);
      return;
    }

    if (!browserConnectAudioRecordingAvailable()) {
      setStatus("Recording is not available on this browser. Typing still works.");
      return;
    }

    if (!selectedReceiverUser.id) {
      setStatus("Choose a Main Connect User before recording.");
      return;
    }

    try {
      const captureId = createConnectAudioCaptureId("receiver-contact-message");
      contactCaptureIdRef.current = captureId;
      setPendingContactRecording(null);
      setContactRecording(true);
      setContactRecordingProcessing(false);
      setStatus("Recording message. Press Record again to stop.");
      contactRecordingControllerRef.current = await startConnectAudioRecording({
        maxDurationMs: 30000,
        onAutoStop: (reason) => {
          void stopContactRecording(contact, reason);
        },
        silenceGraceMs: 1200,
        silenceThreshold: 0.018,
        stopAfterSilenceMs: 2600,
      });
    } catch {
      contactCaptureIdRef.current = "";
      contactRecordingControllerRef.current = null;
      setContactRecording(false);
      setStatus("Recording could not start. Typing still works.");
    }
  }

  async function stopContactRecording(contact: Contact, reason?: "max_duration" | "silence") {
    const controller = contactRecordingControllerRef.current;
    if (!controller) {
      setContactRecording(false);
      return;
    }

    contactRecordingControllerRef.current = null;
    setContactRecording(false);
    setContactRecordingProcessing(true);
    setStatus(
      reason === "max_duration"
        ? "Time is up. Turning message into text..."
        : "Turning message into text..."
    );

    try {
      const recording = await controller.stop();
      if (!recording.size) {
        setStatus("Recording was empty. Try again or type your message.");
        return;
      }

      if (!selectedReceiverUser.id) {
        setStatus("Choose a Main Connect User before transcribing this recording.");
        return;
      }

      const clientAudioCaptureId =
        contactCaptureIdRef.current || createConnectAudioCaptureId("receiver-contact-message");
      let transcript = "";
      let transcriptStatus = "not_requested";
      let artifactId = "";
      let audioUrl = "";

      try {
        const transcription = await requestConnectAudioTranscription({
          artifactKind: "receiver_message",
          audioDirection: "receiver_to_coordinator",
          captureContext: createConnectAudioCaptureContext(recording, {
            artifactKind: "receiver_message",
            audioDirection: "receiver_to_coordinator",
            clientAudioCaptureId,
            role: "receiver_user",
            surface: "receiver_contact_message",
          }),
          clientAudioCaptureId,
          durationMs: recording.durationMs,
          mainConnectUserPersonId: selectedReceiverUser.id,
          mimeType: recording.mimeType,
          receiverId: connectPrototypeReceiverId,
          recording: recording.blob,
          source: "contact-message-draft",
        });
        const artifact = transcription.artifact;
        artifactId = String(artifact?.artifactId || artifact?.id || "");
        audioUrl = String(artifact?.audioUrl || transcription.audioUrl || "");
        transcript = String(transcription.transcript || "").trim();
        transcriptStatus = String(transcription.transcriptStatus || "not_requested");
      } catch {
        transcriptStatus = "not_configured";
      }

      setPendingContactRecording({
        artifactId,
        audioUrl,
        clientAudioCaptureId,
        recording,
        transcript,
        transcriptStatus,
      });
      setContactDraft(transcript || "Recorded voice message");
      setStatus(
        transcript
          ? `Recording transcribed. Send it to ${contact.displayName} when ready.`
          : `Recording ready. Send it to ${contact.displayName} when ready.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recording could not be processed.");
    } finally {
      contactCaptureIdRef.current = "";
      setContactRecordingProcessing(false);
    }
  }

  function openOptionalSounds() {
    clearGuideBecauseReceiverActed();
    resetSoundTestState();
    setModal({ type: "soundSettings", view: "settings" });
    setStatus("Optional sounds settings are open.");
  }

  function resetSoundTestState() {
    setSoundDiagnostic("");
    setSoundHelp(null);
    setSelectedSoundProblem(null);
  }

  function updateSoundSetting(key: keyof SoundSettings, value: boolean | SoundSettings["comfortVolume"]) {
    const previewSettings = { ...soundSettings, [key]: value } as SoundSettings;
    if (key === "retroSounds" && value === false) {
      previewSettings.buttonBeeps = false;
      previewSettings.retroRingers = false;
    }
    if ((key === "buttonBeeps" || key === "retroRingers") && value === true) {
      previewSettings.retroSounds = true;
    }

    setSoundSettings((current) => {
      const next = { ...current, [key]: value };
      if (key === "retroSounds" && value === false) {
        next.buttonBeeps = false;
        next.retroRingers = false;
      }
      if ((key === "buttonBeeps" || key === "retroRingers") && value === true) {
        next.retroSounds = true;
      }
      return next;
    });
    setStatus(
      key === "comfortVolume"
        ? `Volume set to ${value}.`
        : `${soundSettingLabel(key)} ${value ? "on" : "off"}.`
    );
    setSoundDiagnostic("");
    setSoundHelp(null);
    setSelectedSoundProblem(null);

    if ((key === "retroSounds" || key === "retroRingers") && value === false) {
      stopReceiverCue();
    }

    if (key === "retroRingers" && value === true) {
      playOneRingPreview(previewSettings);
    } else if (
      (key === "retroSounds" && value === true) ||
      (key === "buttonBeeps" && value === true) ||
      key === "comfortVolume"
    ) {
      playReceiverBeep(previewSettings, previewSettings.comfortVolume);
    }
  }

  function testOptionalSound() {
    setSoundPrimed(true);
    setSoundHelp(null);
    setSelectedSoundProblem(null);
    setLastSoundTestResult("Test running");
    setSoundDiagnostic(
      `Testing sound. Media audio is ${audioStateLabel()}. You should hear a microwave beep, an old phone ring, then "Sound test."`
    );
    setStatus("Testing optional sounds.");
    playReceiverBeep(soundSettings, "high", true);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        playOneRingPreview(soundSettings);
      }, 320);
      window.setTimeout(() => {
        const speechStarted = speakSoundTest();
        setLastSoundTestResult(speechStarted ? "Test finished" : "Audio test finished; speech unavailable");
        setSoundDiagnostic(
          `Sound test finished. Media audio is ${audioStateLabel()}. If speech works but beeps are faint, this device may reduce regular browser audio.`
        );
        setStatus("Sound test finished.");
      }, 850);
    }
  }

  function enableReceiverSound() {
    setSoundPrimed(true);
    const nextSettings: SoundSettings = {
      ...soundSettings,
      buttonBeeps: true,
      retroRingers: true,
      retroSounds: true,
    };
    setSoundSettings(nextSettings);
    setStatus(
      window.isSecureContext
        ? "Sound is enabled. Microphone permission will be requested when you answer."
        : "Sound is enabled. Live microphone audio still needs HTTPS or localhost."
    );
    playReceiverBeep(nextSettings, "high", true);
  }

  async function toggleReceiverFullscreen() {
    const fullscreenDocument = document as FullscreenDocument;

    try {
      if (document.fullscreenElement || fullscreenDocument.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else {
          await fullscreenDocument.webkitExitFullscreen?.();
        }
        setStatus("Full screen closed.");
        return;
      }

      await requestReceiverFullscreen();
    } catch {
      setStatus("Chrome did not allow full screen. Tap the browser menu and choose full screen if available.");
    }
  }

  async function requestReceiverFullscreen() {
    const fullscreenDocument = document as FullscreenDocument;
    if (document.fullscreenElement || fullscreenDocument.webkitFullscreenElement) return;

    try {
      const element = document.documentElement as FullscreenElement;
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else {
        await element.webkitRequestFullscreen?.();
      }
      setStatus("Full screen is on.");
    } catch {
      setStatus("Chrome did not allow full screen. Tap the browser menu and choose full screen if available.");
    }
  }

  function startReceiverFromAction() {
    setStarted(true);
    if (deskPhoneMode && !kioskManagedFullscreen) {
      void requestReceiverFullscreen();
    }
  }

  function reportSoundProblem(problem: SoundProblem) {
    const nextHelp = generateSoundHelp(problem);
    const nextLabel =
      problem === "speech_only"
        ? "No beeps"
        : problem === "faint_beep"
          ? "Faint beeps"
          : problem === "no_ringers"
            ? "No ring sounds"
            : "No optional sounds";
    setSoundHelp(nextHelp);
    setSelectedSoundProblem(problem);
    setLastSoundTestResult(nextLabel);
    setSoundDiagnostic("");
    setStatus(nextHelp.title);
  }

  function applySoundHelpAction(action: NonNullable<SoundHelp["actions"]>[number]) {
    if (action === "enable_sounds") {
      const nextSettings: SoundSettings = {
        buttonBeeps: true,
        comfortVolume: soundSettings.comfortVolume,
        retroRingers: true,
        retroSounds: true,
      };
      setSoundSettings(nextSettings);
      setSoundDiagnostic("Optional sounds are on. Run the test again while this page is open.");
      setStatus("Optional sounds turned on.");
      playReceiverBeep(nextSettings, nextSettings.comfortVolume, true);
      return;
    }

    const nextSettings: SoundSettings = {
      ...soundSettings,
      buttonBeeps: true,
      comfortVolume: "high",
      retroSounds: true,
    };
    setSoundSettings(nextSettings);
    setSoundDiagnostic("Receiver volume is set to High. Use the device volume buttons, then test again.");
    setStatus("Receiver volume set to High.");
    playReceiverBeep(nextSettings, "high", true);
  }

  function markSoundHelpResolved() {
    setSoundHelp(null);
    setSelectedSoundProblem(null);
    setSoundDiagnostic("Sound Help marked resolved on this device.");
    setStatus("Optional sound help resolved.");
  }

  async function markMessageState(message: Message, state: { heard?: boolean; read?: boolean }) {
    if (!receiverOnline) return;
    if (!message.id) return;
    const mainConnectUserPersonId =
      message.mainConnectUserPersonId || selectedReceiverUser.id;
    if (!mainConnectUserPersonId) return;

    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? {
              ...item,
              heardAt: state.heard ? item.heardAt || currentIsoTimestamp() : item.heardAt,
              readAt: state.read ? item.readAt || currentIsoTimestamp() : item.readAt,
            }
          : item
      )
    );

    try {
      await fetch(messageStateUrl(message.id), {
        body: JSON.stringify({
          heard: Boolean(state.heard),
          mainConnectUserPersonId,
          read: Boolean(state.read),
          receiverId: connectPrototypeReceiverId,
        }),
        headers: {
          ...(await connectReceiverRequestHeaders()),
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
    } catch {
      // State updates are telemetry; a transient online failure should not interrupt reading.
    }
  }

  function stopMessagePlayback() {
    const playingMessage = playingMessageRef.current;
    const playingProfile = playingEnhancementProfileRef.current;
    audioRef.current?.pause();
    audioRef.current = null;
    playingMessageRef.current = null;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (playingMessage) {
      void reportMessagePlaybackEvent(playingMessage, "stopped", "", playingProfile);
    }
    playingEnhancementProfileRef.current = null;
    setPlayingMessageId(null);
    setStatus("Message stopped.");
  }

  async function reportMessagePlaybackEvent(
    message: Message,
    playbackState: "ended" | "error" | "fallback" | "feedback" | "started" | "stopped",
    feedbackChoice = "",
    enhancementProfile = playingEnhancementProfileRef.current
  ) {
    if (!receiverOnline) return;
    if (!selectedReceiverUser.id) return;

    try {
      await fetch(connectAudioPlaybackEventsEndpoint, {
        body: JSON.stringify({
          artifactId: message.audioArtifactId,
          audioEnhancementProfile: enhancementProfile ?? undefined,
          audioUrl: message.audioUrl,
          mainConnectUserPersonId: selectedReceiverUser.id,
          messageFrom: message.from,
          messageId: message.id,
          playbackState,
          receiverId: connectPrototypeReceiverId,
          source: feedbackChoice
            ? `receiver_audio_feedback_${feedbackChoice}`
            : "receiver_message_playback",
          surface: "web_receiver",
        }),
        headers: {
          ...(await connectReceiverRequestHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    } catch {
      // Playback telemetry should never interrupt the Receiver PLAY button.
    }
  }

  function speakMessage(message: Message) {
    if (typeof window === "undefined" || !window.speechSynthesis) return false;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(messageText(message));
    utterance.rate = 0.9;
    utterance.onend = () => {
      setPlayingMessageId((current) => (current === message.id ? null : current));
      playingMessageRef.current = null;
      setStatus(`Finished message from ${message.from}.`);
    };
    utterance.onerror = () => {
      setPlayingMessageId((current) => (current === message.id ? null : current));
      playingMessageRef.current = null;
    };
    setPlayingMessageId(message.id);
    playingMessageRef.current = message;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  async function hearMessage(
    message: Message,
    variant: PlaybackVariant = "default",
    forceRestart = false
  ) {
    clearGuideBecauseReceiverActed();
    if (playingMessageId === message.id && !forceRestart) {
      stopMessagePlayback();
      return;
    }

    void markMessageState(message, { heard: true });

    const audioUrl = receiverAudioUrl(message.audioUrl);
    if (audioUrl) {
      const enhancementProfile = connectAudioEnhancementProfileForVariant(variant, audioPreference);
      try {
        audioRef.current?.pause();
        playingEnhancementProfileRef.current = enhancementProfile;
        setPlayingMessageId(message.id);
        const audio = await playConnectMessageAudio(audioUrl, soundSettings.comfortVolume, {
          enhancementProfile,
          onEnded: () => {
            setPlayingMessageId((current) => (current === message.id ? null : current));
            playingMessageRef.current = null;
            playingEnhancementProfileRef.current = null;
            void reportMessagePlaybackEvent(message, "ended", "", enhancementProfile);
            setStatus(`Finished message from ${message.from}.`);
          },
          onError: () => {
            setPlayingMessageId((current) => (current === message.id ? null : current));
            playingMessageRef.current = null;
            playingEnhancementProfileRef.current = null;
            void reportMessagePlaybackEvent(message, "error", "", enhancementProfile);
          },
        });
        audioRef.current = audio;
        playingMessageRef.current = message;
        void reportMessagePlaybackEvent(message, "started", "", enhancementProfile);
        setStatus(`Playing clearer audio from ${message.from}.`);
        return;
      } catch {
        setPlayingMessageId((current) => (current === message.id ? null : current));
        playingMessageRef.current = null;
        playingEnhancementProfileRef.current = null;
        void reportMessagePlaybackEvent(message, "error", "", enhancementProfile);
        // Fall through to spoken transcript/text.
      }
    }

    if (speakMessage(message)) {
      void reportMessagePlaybackEvent(message, "fallback");
      setStatus(`Speaking message text from ${message.from}.`);
      return;
    }

    setModal({ type: "reader", message, returnTo: "home" });
    setStatus("Audio playback is not available. Message is open to read.");
  }

  function openMessage(message: Message) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    clearGuideBecauseReceiverActed();
    void markMessageState(message, { read: true });
    setModal({ type: "reader", message, returnTo: "home" });
  }

  function openMessageFromAllMessages(message: Message, page: number) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    clearGuideBecauseReceiverActed();
    void markMessageState(message, { read: true });
    setModal({
      type: "reader",
      message,
      returnPage: page,
      returnTo: "allMessages",
    });
  }

  function toggleAutoHearPreference() {
    if (autoHearPreference === "on" && (playingMessageId || audioRef.current)) {
      stopMessagePlayback();
    }
    setAutoHearPreference((current) => (current === "on" ? "off" : "on"));
  }

  function recordHearingFeedback(message: Message, choice: string) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    const feedbackProfile =
      choice === "original"
        ? null
        : choice === "version_1"
        ? connectAudioEnhancementProfileForVariant("version1", audioPreference)
        : choice === "version_2"
          ? connectAudioEnhancementProfileForVariant("version2", audioPreference)
          : playingEnhancementProfileRef.current;
    setAudioPreference((current) => connectAudioPreferenceWithFeedback(current, choice));
    void reportMessagePlaybackEvent(message, "feedback", choice, feedbackProfile);
    setStatus("Thank you. Connect will use this to help make future messages easier to hear.");
  }

  function callBackForMessage(message: Message) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    clearGuideBecauseReceiverActed();
    const senderName = message.from === "receiver_user" ? message.to : message.from;
    const contact = contacts.find((item) => item.displayName === senderName) ?? selectedContact;
    callContact(contact);
  }

  function showAllMessages() {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    clearGuideBecauseReceiverActed();
    setModal({ type: "allMessages", page: 0 });
    setStatus("Showing all messages.");
  }

  async function submitAsk() {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    const question = askDraft.trim();
    if (!question) {
      setStatus("Type what you want to ask first.");
      return;
    }

    if (modal?.type === "askRecordReview" || pendingAskAudio) {
      const handled = await submitTalkInterpretation(question);
      if (handled) {
        return;
      }
    }

    if (isLowConfidenceAsk(question)) {
      setModal({ type: "askRecovery", question });
      setStatus("Ask needs a little more help.");
      return;
    }

    setModal({ type: "askAnswer", answer: answerForAsk(question, selectedContact) });
    setStatus("Ask found an answer.");
  }

  async function submitTalkInterpretation(question: string) {
    if (!receiverOnline) {
      explainOfflineAction();
      return false;
    }
    if (!selectedReceiverUser.id) {
      setStatus("Choose a Main Connect User before using Talk.");
      return false;
    }

    try {
      const response = await fetch(connectTalkEndpoint, {
        body: JSON.stringify({
          contacts: contacts.map((contact) => ({
            displayName: contact.displayName,
            id: contact.id,
          })),
          inputText: question,
          personId: selectedReceiverUser.id,
          receiverDeviceId: readReceiverDeviceId(),
          receiverInstallId: readReceiverInstallId(),
          source: "receiver_talk",
        }),
        headers: {
          ...(await connectReceiverRequestHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: TalkApiResult;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "Talk could not understand that yet.");
      }

      return handleTalkResult(question, payload.result);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Talk could not understand that yet."
      );
      return false;
    }
  }

  function handleTalkResult(question: string, result: TalkApiResult) {
    const displayResponse =
      String(result.display_response || result.spoken_response || "").trim() ||
      "I heard that.";
    const proposedAction = String(result.proposed_action || "");

    if (result.intent === "connect_call_request") {
      const contactId = String(result.structured_payload?.contactId || "");
      const contact = contacts.find((item) => item.id === contactId);
      if (contact) {
        callContact(contact);
        return true;
      }
    }

    if (proposedAction === "clarify" || result.intent === "unknown") {
      setModal({ type: "askRecovery", question });
      setStatus(displayResponse);
      return true;
    }

    setPendingAskAudio(null);
    setModal({
      type: "askAnswer",
      answer: {
        actionLabel: "That answered my question",
        answer: displayResponse,
        messageBody: "",
        question,
        recipientId: "",
        type: "answer",
      },
    });
    setStatus(displayResponse);
    void refreshTodayFocus();
    return true;
  }

  function escalateAskRecovery(question: string) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    const audioContext = pendingAskAudio
      ? `\n\nAudio artifact: ${pendingAskAudio.artifactId || "saved"}\nTranscript status: ${pendingAskAudio.transcriptStatus}`
      : "";
    const receiverName =
      selectedReceiverUser.id ? selectedReceiverUser.displayName : "The Main Connect User";
    const body = `${receiverName} asked:\n"${question}"\n\nAsk could not determine an answer.${audioContext}\n\nPlease review.`;
    const andrew = contacts[0];
    setMessages((current) => [
      {
        audioArtifactId: pendingAskAudio?.artifactId,
        audioMimeType: pendingAskAudio?.audioMimeType,
        audioUrl: pendingAskAudio?.audioUrl,
        id: `ask-recovery-${currentEpochMs()}`,
        from: "receiver_user",
        to: andrew.displayName,
        body,
        createdAt: currentIsoTimestamp(),
        transcript: pendingAskAudio?.transcript,
        transcriptStatus: pendingAskAudio?.transcriptStatus,
      },
      ...current,
    ]);
    setFocusedMessageIndex(0);
    setStatus("This was sent to Andrew.");
    setModal({ type: "sent", recipientName: andrew.displayName });
  }

  function stopReceiverCue() {
    if (cueTimeoutRef.current) {
      window.clearTimeout(cueTimeoutRef.current);
      cueTimeoutRef.current = null;
    }
    cueAudioRef.current?.pause();
    cueAudioRef.current = null;
  }

  function logReceiverCallEvent(
    callId: string | undefined,
    eventType: string,
    details: Record<string, unknown> = {}
  ) {
    if (!callId || !selectedReceiverUser.id) return;
    recordConnectCallLifecycleEvent({
      actorRole: "receiver",
      callId,
      connectAuthHeaders,
      details,
      eventType,
      mainConnectUserPersonId: selectedReceiverUser.id,
    });
  }

  function stopLiveCallAudio() {
    const currentCallId =
      modal?.type === "incomingCall" ? modal.callId : undefined;
    logReceiverCallEvent(currentCallId, "call_receiver_audio_cleanup_requested", {
      callAudioStatus,
      source: "receiver_stop_live_call_audio",
    });
    liveCallAudioRef.current?.stop();
    liveCallAudioRef.current = null;
    setCallAudioStatus("idle");
    setCallMuted(false);
  }

  function playOneRingPreview(settings: SoundSettings) {
    stopReceiverCue();
    const ring = playReceiverIncomingRing(settings);
    if (!ring) return;
    cueAudioRef.current = ring;
    cueTimeoutRef.current = window.setTimeout(() => {
      stopReceiverCue();
    }, 3600);
  }

  function playOutgoingRingback() {
    stopReceiverCue();
    cueAudioRef.current = playReceiverRingback(soundSettings, false, true) || null;
    cueTimeoutRef.current = window.setTimeout(() => {
      stopReceiverCue();
      setStatus("Call request sent.");
    }, 7000);
  }

  function playCallFailedAudio() {
    stopReceiverCue();
    cueAudioRef.current = playReceiverUnavailableSequence(soundSettings) || null;
  }

  async function reportCallState(callId: string | undefined, state: string) {
    if (!receiverOnline) return;
    if (!callId) return;
    if (!selectedReceiverUser.id) return;

    try {
      logReceiverCallEvent(callId, "call_receiver_state_update_requested", {
        source: "reportCallState",
        state,
      });
      await fetch(`${connectCallsEndpoint}/${encodeURIComponent(callId)}/state`, {
        body: JSON.stringify({
          mainConnectUserPersonId: selectedReceiverUser.id,
          source: "receiver",
          state,
        }),
        headers: {
          ...(await connectReceiverRequestHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    } catch {
      setStatus("Could not update the call on the local server.");
    }
  }

  async function saveCallSummaryDraft(callId: string | undefined, draftText: string) {
    if (!receiverOnline) return;
    if (!callId || !selectedReceiverUser.id) return;

    try {
      const response = await fetch(`${connectCallsEndpoint}/${encodeURIComponent(callId)}/summary`, {
        body: JSON.stringify({
          action: "save_draft",
          approvedBy: "receiver",
          draftText,
          mainConnectUserPersonId: selectedReceiverUser.id,
        }),
        headers: {
          ...(await connectReceiverRequestHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) return;
      setModal((current) =>
        current?.type === "incomingCall" && current.callId === callId
          ? { ...current, summaryDraftSavedText: draftText }
          : current
      );
    } catch {
      // Draft save is retried by the next edit/close path.
    }
  }

  useEffect(() => {
    if (modal?.type !== "incomingCall") return undefined;
    if (modal.summaryApproval === "approved") return undefined;
    if (modal.textView !== "summary") return undefined;
    if (!modal.callId) return undefined;
    const draftText = String(modal.summaryDraft ?? "");
    if (draftText === String(modal.summaryDraftSavedText ?? "")) return undefined;

    const timer = window.setTimeout(() => {
      void saveCallSummaryDraft(modal.callId, draftText);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [modal, selectedReceiverUser.id]);

  async function approveCallSummary(
    callId: string | undefined,
    approvedSummaryOverride?: string
  ) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    const approvalTextExplicitlyProvided = approvedSummaryOverride !== undefined;
    const approvedSummaryText =
      stripCareSummaryHeading(
        approvalTextExplicitlyProvided
          ? approvedSummaryOverride.trim()
          : modal?.type === "incomingCall"
            ? String(modal.summaryDraft || modal.summaryText || "").trim()
            : ""
      );
    if (!callId || !selectedReceiverUser.id) {
      setModal((current) =>
        current?.type === "incomingCall"
          ? {
              ...current,
              approvedSummaryText,
              summaryApproval: "approved",
            }
          : current
      );
      return;
    }

    try {
      const response = await fetch(`${connectCallsEndpoint}/${encodeURIComponent(callId)}/summary`, {
        body: JSON.stringify({
          action: "approve",
          approvedBy: "receiver",
          approvedSummaryText,
          mainConnectUserPersonId: selectedReceiverUser.id,
        }),
        headers: {
          ...(await connectReceiverRequestHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        call?: ReceiverCall;
        error?: string;
      };

      if (!response.ok) throw new Error(payload.error || "Summary approval failed.");

      setModal((current) =>
        current?.type === "incomingCall"
          ? (() => {
              const acceptedSummaryText =
                approvalTextExplicitlyProvided
                  ? approvedSummaryText
                  : approvedSummaryText ||
                    String(payload.call?.approvedSummaryText || "").trim() ||
                    String(payload.call?.summaryText || "").trim() ||
                    String(current.summaryText || "").trim() ||
                    String(current.summaryDraft || "").trim();

              return {
                ...current,
                approvedSummaryText: acceptedSummaryText,
                summaryApproval: "approved",
                summaryDraft: acceptedSummaryText,
                summaryText: acceptedSummaryText || current.summaryText,
                transcriptCleanupStatus: String(
                  payload.call?.transcriptCleanupStatus ||
                    current.transcriptCleanupStatus ||
                    ""
                ),
              };
            })()
          : current
      );
      setStatus(
        payload.call?.transcriptCleanupStatus === "pending"
          ? "Call summary approved. Transcript cleanup is pending."
          : "Call summary approved."
      );
      advanceAfterCallSummaryApproval(callId);
    } catch {
      setStatus("Could not approve the call summary on the local server.");
    }
  }

  function callContact(contact: Contact) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    closeModal();
    if (!contactCanCallNow(contact)) {
      playCallFailedAudio();
      setStatus(`${contact.displayName} is unavailable right now.`);
      return;
    }
    playOutgoingRingback();
    setModal({
      callerName: contact.displayName,
      callStartedAt: new Date().toISOString(),
      callState: "connecting",
      type: "incomingCall",
    });
    window.setTimeout(() => {
      setModal((current) =>
        current?.type === "incomingCall" &&
        current.callerName === contact.displayName &&
        current.callState === "connecting"
          ? {
              ...current,
              callStartedAt: current.callStartedAt || new Date().toISOString(),
              callState: "connected",
            }
          : current
      );
    }, 650);
    setStatus(`Calling ${contact.displayName}.`);
  }

  function answerIncomingCall(callerName: string, callId?: string) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    stopReceiverCue();
    if (
      modal?.type === "incomingCall" &&
      modal.textView === "summary" &&
      modal.summaryApproval !== "approved" &&
      modal.callId &&
      modal.callId !== callId
    ) {
      const draftText = String(modal.summaryDraft ?? "");
      if (draftText !== String(modal.summaryDraftSavedText ?? "")) {
        void saveCallSummaryDraft(modal.callId, draftText);
      }
    }
    setInterruptedReviewIncomingCall(null);
    if (callId) {
      locallyEndedCallIdsRef.current.delete(callId);
      callStartedAtByCallIdRef.current[callId] =
        callStartedAtByCallIdRef.current[callId] || new Date().toISOString();
    }
    logReceiverCallEvent(callId, "call_receiver_answer_clicked", {
      source: "answerIncomingCall",
    });
    void reportCallState(callId, "answered");
    if (callId && selectedReceiverUser.id) {
      stopLiveCallAudio();
      const controller = createConnectCallAudioController({
        callId,
        connectAuthHeaders,
        mainConnectUserPersonId: selectedReceiverUser.id,
        onConnected: () => setStatus(`Connected to ${callerName}.`),
        onError: (message) => setStatus(message),
        onPeerEnded: () => {
          logReceiverCallEvent(callId, "call_receiver_peer_ended_received", {
            source: "audio_controller_onPeerEnded",
          });
          locallyEndedCallIdsRef.current.add(callId);
          liveCallAudioRef.current = null;
          setCallAudioStatus("ended");
          setCallMuted(false);
          setModal((current) =>
            current?.type === "incomingCall"
              ? {
                  ...current,
                  callEndedAt: current.callEndedAt || new Date().toISOString(),
                  callState: "ended",
                  textView: undefined,
                }
              : current
          );
          void reportCallState(callId, "hung_up");
          setStatus(`Call with ${callerName} ended.`);
        },
        onRemoteMutedChange: (muted) => {
          setStatus(
            muted
              ? `${callerName}'s microphone is muted.`
              : `${callerName}'s microphone is on.`
          );
        },
        onStatusChange: (nextStatus) => setCallAudioStatus(nextStatus),
        role: "receiver",
      });
      controller.setMuted(callMuted);
      liveCallAudioRef.current = controller;
      void controller.start();
    }
    window.setTimeout(() => {
      logReceiverCallEvent(callId, "call_receiver_connected_timer_fired", {
        delayMs: 250,
        source: "answerIncomingCall",
      });
      void reportCallState(callId, "connected");
      setModal((current) =>
        current?.type === "incomingCall" && current.callId === callId
          ? {
              ...current,
              callStartedAt: current.callStartedAt || new Date().toISOString(),
              callState: "connected",
            }
          : current
      );
    }, 250);
    setModal({
      callId,
      callerName,
      callStartedAt: callId
        ? callStartedAtByCallIdRef.current[callId] || new Date().toISOString()
        : new Date().toISOString(),
      callState: "connecting",
      type: "incomingCall",
    });
    setStatus(`Connecting to ${callerName}. If Chrome asks, allow microphone access.`);
  }

  function declineIncomingCall(callerName: string, callId?: string) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    stopReceiverCue();
    if (callId) locallyEndedCallIdsRef.current.add(callId);
    setInterruptedReviewIncomingCall((current) =>
      current?.callId === callId ? null : current
    );
    logReceiverCallEvent(callId, "call_receiver_decline_clicked", {
      source: "declineIncomingCall",
    });
    stopLiveCallAudio();
    void reportCallState(callId, "declined");
    setModal((current) =>
      current?.type === "incomingCall" && current.callId === callId ? null : current
    );
    playCallFailedAudio();
    setStatus(`Call from ${callerName} was not answered.`);
  }

  function hangUpIncomingCall(callerName: string, callId?: string) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    stopReceiverCue();
    logReceiverCallEvent(callId, "call_receiver_hangup_clicked", {
      source: "hangUpIncomingCall",
    });
    if (callId) locallyEndedCallIdsRef.current.add(callId);
    stopLiveCallAudio();
    void reportCallState(callId, "hung_up");
    setModal((current) =>
      current?.type === "incomingCall"
        ? {
            ...current,
            callEndedAt: current.callEndedAt || new Date().toISOString(),
            callState: "ended",
            textView: undefined,
          }
        : {
            callEndedAt: new Date().toISOString(),
            callerName,
            callId,
            callState: "ended",
            type: "incomingCall",
          }
    );
    setStatus(`Call with ${callerName} ended.`);
  }

  function toggleCallMuted() {
    const nextMuted = !callMuted;
    setCallMuted(nextMuted);
    liveCallAudioRef.current?.setMuted(nextMuted);
    setStatus(nextMuted ? "Microphone muted." : "Microphone on.");
  }

  function closeModal() {
    stopReceiverCue();
    if (playingMessageId || audioRef.current || playingMessageRef.current) {
      stopMessagePlayback();
    }
    if (modal?.type === "soundSettings") {
      resetSoundTestState();
    }
    setModal(null);
  }

  function openScreenCleaningConfirm() {
    clearGuideBecauseReceiverActed();
    setModal({ type: "screenCleaningConfirm" });
    setStatus("Screen cleaning confirmation opened.");
  }

  function buildScreenCleaningSession(): ScreenCleaningSession {
    const cleaningCount = nextScreenCleaningCount();
    const receiverDeviceId = readReceiverDeviceId();
    const receiverInstallId = readReceiverInstallId();
    const receiverId = receiverDeviceId || receiverInstallId || connectPrototypeReceiverId;
    return {
      cleaningCount,
      message: chooseScreenCleaningMessage(cleaningCount),
      receiverDeviceId,
      receiverId,
      receiverInstallId,
      receiverMode: readReceiverModeLabel(),
      sessionId: `screen-cleaning-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      startedAt: new Date().toISOString(),
    };
  }

  async function recordScreenCleaningSession(
    session: ScreenCleaningSession,
    completedAt?: string
  ) {
    const startedMs = Date.parse(session.startedAt);
    const completedMs = completedAt ? Date.parse(completedAt) : Number.NaN;
    const duration = Number.isFinite(startedMs) && Number.isFinite(completedMs)
      ? Math.max(0, Math.round((completedMs - startedMs) / 1000))
      : undefined;

    try {
      await fetch(connectReceiverCleaningSessionsEndpoint, {
        body: JSON.stringify({
          cleaningCount: session.cleaningCount,
          cleaningCompletedAt: completedAt,
          cleaningStartedAt: session.startedAt,
          deviceIdentifier: session.receiverId,
          duration,
          mainConnectUserPersonId: selectedReceiverUserId || undefined,
          message: session.message,
          receiverDeviceId: session.receiverDeviceId,
          receiverId: session.receiverId,
          receiverInstallId: session.receiverInstallId,
          receiverMode: session.receiverMode,
          sessionId: session.sessionId,
        }),
        cache: "no-store",
        headers: {
          ...(await connectReceiverRequestHeaders()),
          "Content-Type": "application/json",
        },
        keepalive: true,
        method: "POST",
      });
    } catch {
      // Cleaning should never fail because analytics could not be recorded.
    }
  }

  function completeScreenCleaningSession() {
    const session = screenCleaningSessionRef.current;
    if (!session) return;

    const completedAt = new Date().toISOString();
    screenCleaningSessionRef.current = null;
    setScreenCleaningSession(null);
    void recordScreenCleaningSession(session, completedAt);
  }

  function startScreenCleaning() {
    stopReceiverCue();
    stopMessagePlayback();
    const session = buildScreenCleaningSession();
    screenCleaningSessionRef.current = session;
    setScreenCleaningSession(session);
    setModal(null);
    setScreenCleaningSecondsRemaining(SCREEN_CLEANING_DURATION_SECONDS);
    setStatus("Screen cleaning mode started.");
    void recordScreenCleaningSession(session);
  }

  function handleReceiverButtonClickCapture(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    const button = target?.closest("button");
    if (!button || !event.currentTarget.contains(button)) return;
    if (button.disabled || button.dataset.receiverNoBeep === "true") return;
    if (playingMessageId || audioRef.current || playingMessageRef.current) {
      stopMessagePlayback();
    }
    playReceiverBeep(soundSettings);
  }

  if (!receiverSessionRestored || !started) {
    return (
      <main className={styles.activationScreen}>
        <section className={styles.activationPanel} aria-label="Start receiver">
          <p>CarePland Connect</p>
          <h1>Receiver</h1>
          <span>Living Room Receiver</span>
          <button type="button" onClick={startReceiverFromAction}>
            Start Receiver
          </button>
        </section>
      </main>
    );
  }

  if (!selectedReceiverUser.id) {
    return (
      <main className={styles.registrationScreen}>
        <section className={styles.registrationPanel} aria-live="polite">
          <p>CarePland Connect</p>
          <h1>Set Up Receiver</h1>
          <span>Pair this Receiver from Connect</span>
          {browserPairingCode ? (
            <strong className={styles.receiverPairingCode}>
              {formatBrowserReceiverPairingCode(browserPairingCode)}
            </strong>
          ) : (
            <strong className={styles.receiverPairingCode}>---</strong>
          )}
          <small>
            Open CarePland Connect in a browser, go to Receiver, choose Pair Receiver, and enter
            this code.
          </small>
          {browserPairingExpiresAt ? (
            <small>Code expires {formatPairingExpiryTime(browserPairingExpiresAt)}.</small>
          ) : null}
          <strong>{browserPairingStatus}</strong>
          <button type="button" onClick={() => window.location.reload()}>
            New Code
          </button>
          <details className={styles.receiverAdvancedSetup}>
            <summary>Advanced setup</summary>
            <form onSubmit={registerReceiverWithCode}>
              <label>
                Setup code
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={12}
                  value={registrationCode}
                  onChange={(event) => {
                    setRegistrationCode(event.target.value);
                    setRegistrationError("");
                  }}
                  onFocus={(event) => {
                    event.currentTarget.select();
                  }}
                  aria-label="Receiver setup code"
                />
              </label>
              {registrationError ? <strong>{registrationError}</strong> : null}
              <button type="submit">Finish Setup</button>
            </form>
          </details>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`${styles.receiverPage} ${deskPhoneMode ? styles.deskPhoneMode : ""} ${
        gxvFocusHomeEnabled ? styles.gxvFocusHomeMode : ""
      } ${guideTarget || guideRect ? styles.guideActive : ""}`}
      onClick={clearGuideBecauseReceiverActed}
    >
      {guideIdentifyCode ? (
        <div className={styles.guideIdentifyOverlay} aria-live="assertive">
          <span>Guide ID</span>
          <strong>{guideIdentifyCode}</strong>
        </div>
      ) : null}
      <div className={styles.applianceFrame} style={applianceStyle}>
        <section
          className={styles.receiverShell}
          aria-label="CarePland Connect Receiver"
          data-receiver-shell="true"
          onClickCapture={handleReceiverButtonClickCapture}
        >
          {gxvFocusHomeEnabled && modal?.type !== "incomingCall" ? null : (
            <header
              className={`${styles.statusZone} ${
                modal?.type === "incomingCall" ? styles.callStatusZone : ""
              }`}
            >
            {modal?.type === "incomingCall" ? (
              <ReceiverCallStatusPanel
                applianceMode={deskPhoneMode}
                callAudioStatus={callAudioStatus}
                callMuted={callMuted}
                modal={modal}
                now={now}
                onAnswerIncomingCall={answerIncomingCall}
                onDeclineIncomingCall={declineIncomingCall}
                onHangUpIncomingCall={hangUpIncomingCall}
                onSetModal={setModal}
                onToggleCallMuted={toggleCallMuted}
              />
            ) : (
              <>
                <div className={styles.timeBlock}>
                  <strong>{formatTime(now)}</strong>
                  <div className={styles.dateControlRow}>
                    <span>{formatDate(now)}</span>
                    {deskPhoneMode && !kioskManagedFullscreen ? (
                      <button
                        className={styles.fullscreenTinyButton}
                        type="button"
                        aria-label={fullscreenActive ? "Exit full screen" : "Enter full screen"}
                        onClick={(event) => {
                          event.stopPropagation();
                          void toggleReceiverFullscreen();
                        }}
                      >
                        {fullscreenActive ? "MIN" : "MAX"}
                      </button>
                    ) : null}
                    {deskPhoneMode ? (
                      <button
                        className={`${styles.fullscreenTinyButton} ${styles.layoutTinyButton}`}
                        type="button"
                        aria-label={gxvHomeLayout === "focus_v1" ? "Use classic GXV home layout" : "Try GXV focus home layout"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleGxvHomeLayout();
                        }}
                      >
                        {gxvHomeLayout === "focus_v1" ? "OLD" : "V1"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {deskPhoneMode ? (
	                  <button
	                    className={`${styles.appointmentPanel} ${styles.applianceAppointmentPanel}`}
	                    type="button"
	                    aria-label={`Open appointment details for ${displayedAppointment.title}`}
	                    onClick={(event) => {
	                      event.stopPropagation();
	                      openHeaderAppointment();
	                    }}
	                  >
	                    <span className={styles.focusHomeAppointmentMeta}>
	                      <span>Next up</span>
	                      <span>{displayedAppointmentTimeLabel}</span>
	                    </span>
	                    <strong>{displayedAppointment.title}</strong>
	                    {cachedAppointmentTimestamp ? (
	                      <span className={styles.cachedAppointmentInline}>
	                        Last updated {cachedAppointmentTimestamp}
	                      </span>
	                    ) : null}
	                  </button>
                ) : null}
	                <div className={styles.greetingBlock}>
                  <strong>
                    {deskPhoneMode ? (
                      <>
                        <span className={styles.greetingLine}>{greetingFor(now)}</span>
                        <span className={styles.greetingName}>{selectedReceiverUser.displayName}</span>
                      </>
                    ) : (
                      `${greetingFor(now)}, ${selectedReceiverUser.displayName}`
                    )}
	                  </strong>
	                  <span>{receiver.locationLabel}</span>
	                  <span className={receiverOnline ? styles.onlineStatus : styles.offlineStatus}>
	                    {connectivityStatusLabel}
	                  </span>
	                </div>
	                {!deskPhoneMode ? (
	                  <div className={styles.appointmentPanel}>
	                    <div>
	                      <span>{nextAppointment.label}</span>
	                      <strong>{displayedAppointment.title}</strong>
	                      {cachedAppointmentTimestamp ? (
	                        <span className={styles.cachedAppointmentInline}>
	                          Last updated {cachedAppointmentTimestamp}
	                        </span>
	                      ) : null}
	                    </div>
	                    <div>
	                      <span>Next up</span>
	                      <strong>{displayedAppointmentTimeLabel}</strong>
	                    </div>
	                  </div>
                ) : null}
              </>
            )}
            </header>
          )}

          {!deskPhoneMode ? (
            <section className={styles.contactZone} aria-label="Main Connect User selector">
              <div
                className={styles.peopleStrip}
                style={
                  {
                    "--receiver-user-count": String(Math.max(1, visibleReceiverUsers.length)),
                  } as CSSProperties
                }
              >
                {visibleReceiverUsers.map((user) => (
                  <button
                    className={`${styles.personButton} ${
                      user.id === selectedReceiverUser.id ? styles.selected : ""
                    } ${
                      guideTarget === "contact" && user.id === selectedReceiverUser.id
                        ? styles.guideTarget
                        : guideTarget
                          ? styles.guideDim
                          : ""
                    }`}
                    key={user.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void chooseReceiverUser(user);
                    }}
                  >
                    <strong>{user.displayName}</strong>
                    <span>{user.statusLabel}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {pendingCallSummaryReviews.length > 0 && modal?.type !== "incomingCall" && !deskPhoneMode ? (
            <section className={styles.pendingCallReviewStrip} aria-live="polite">
              <div>
                <span>Call note needs review</span>
                <strong>
                  {pendingCallSummaryReviews.length === 1
                    ? "1 pending summary"
                    : `${pendingCallSummaryReviews.length} pending summaries`}
                </strong>
              </div>
              <button
                className={onlineRequiredActionClass}
                type="button"
                aria-disabled={!receiverOnline}
                onClick={(event) => {
                  event.stopPropagation();
                  openPendingCallSummaryReview(pendingCallSummaryReviews[0] ?? {});
                }}
              >
                Review
              </button>
            </section>
          ) : null}

          <section className={styles.actionZone} aria-label="Primary actions">
            {deskPhoneMode ? (
              gxvFocusHomeEnabled ? (
                <>
                  <div className={styles.focusHomeLayoutControls} aria-label="Layout controls">
                    {!kioskManagedFullscreen ? (
                      <button
                        className={styles.fullscreenTinyButton}
                        type="button"
                        aria-label={fullscreenActive ? "Exit full screen" : "Enter full screen"}
                        onClick={(event) => {
                          event.stopPropagation();
                          void toggleReceiverFullscreen();
                        }}
                      >
                        {fullscreenActive ? "MIN" : "MAX"}
                      </button>
                    ) : null}
                    <button
                      className={`${styles.fullscreenTinyButton} ${styles.layoutTinyButton}`}
                      type="button"
                      aria-label="Use classic GXV home layout"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleGxvHomeLayout();
                      }}
                    >
                      OLD
                    </button>
                  </div>
                  <section className={styles.focusHomeGreetingPanel} aria-label="Receiver">
                    <a
                      className={styles.focusHomeLogo}
                      download
                      href={receiverApkDownloadEndpoint}
                      onClick={(event) => event.stopPropagation()}
                      title="Download Receiver APK"
                    >
                      <img src="/carepland-loop-mark.png" alt="" />
                    </a>
                    <span>{greetingFor(now)}</span>
                    <strong>{firstDisplayName(selectedReceiverUser.displayName)}</strong>
                  </section>
	                  <button
	                    className={`${styles.talkFooterAction} ${styles.focusHomeTalkAction} ${onlineRequiredActionClass}`}
	                    type="button"
	                    aria-label="Talk"
	                    aria-disabled={!receiverOnline}
	                    disabled={receiverRecordingProcessing}
                    onClick={(event) => {
                      event.stopPropagation();
                      void startReceiverRecording();
                    }}
                  >
                    <span className={styles.talkFooterIcon} aria-hidden="true" />
                    <span>Talk</span>
                  </button>
                  <section className={styles.focusHomeTimePanel} aria-label="Current time">
                    <div className={styles.dateControlRow}>
                      <span>{formatDate(now)}</span>
                    </div>
	                    <strong>{formatTime(now)}</strong>
	                    <span>{receiver.locationLabel}</span>
	                    <span className={receiverOnline ? styles.onlineStatus : styles.offlineStatus}>
	                      {connectivityStatusLabel}
	                    </span>
	                  </section>
	                  <section className={`${styles.todayFocusPanel} ${!receiverOnline ? styles.offlineActionArea : ""}`} aria-label="Today's Focus">
                    {todayFocusDisplayMode === "items" ? (
                      <>
                        <h2>Today&apos;s Focus</h2>
                        <TodayFocusList
                          completedItemIds={Object.keys(todayFocusPendingCompletions)}
                          completingId={todayFocusCompletingId}
                          items={visibleTodayFocusItems}
                          onCancelPreference={() => {
                            setTodayFocusPreferenceItem(null);
                            setTodayFocusPreferenceStep("main");
                          }}
                          onChoosePreference={chooseTodayFocusPreference}
                          onComplete={completeTodayFocusItem}
                          onOpenPreference={(item) => {
                            setTodayFocusPreferenceItem(item);
                            setTodayFocusPreferenceStep("main");
                          }}
                          onUndoComplete={undoTodayFocusCompletion}
                          preferenceOpenForId={todayFocusPreferenceItem?.id ?? null}
                          preferenceStep={todayFocusPreferenceStep}
                          variant="receiver"
                        />
                      </>
                    ) : todayFocusDisplayMode === "loading" ? (
                      <div className={styles.todayFocusLoadingState}>
                        <h2>Today&apos;s Focus</h2>
                        <p>Loading...</p>
                      </div>
                    ) : (
                      <div className={styles.brainStretchPrompt}>
                        <h2>Brain Stretch</h2>
                        {todayFocusStatus ? <p>{todayFocusStatus}</p> : null}
                        <p>{brainStretchPrompt}</p>
                      </div>
                    )}
                  </section>
	                  <button
	                    className={`${styles.appointmentPanel} ${styles.applianceAppointmentPanel} ${styles.focusHomeAppointmentPanel}`}
	                    type="button"
	                    aria-label={`Open appointment details for ${displayedAppointment.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openHeaderAppointment();
                    }}
	                  >
	                    <span className={styles.focusHomeAppointmentMeta}>
	                      {displayedAppointmentTimeLabel}
	                    </span>
	                    <strong>{displayedAppointment.title}</strong>
	                    {cachedAppointmentTimestamp ? (
	                      <span className={styles.cachedAppointmentInline}>
	                        Last updated {cachedAppointmentTimestamp}
	                      </span>
	                    ) : null}
	                  </button>
                  <div className={styles.focusHomeActionStack}>
                    <button
	                      className={`${styles.secondaryAction} ${styles.blue} ${styles.focusHomeMessagesAction} ${onlineRequiredActionClass}`}
	                      type="button"
	                      aria-disabled={!receiverOnline}
                      onClick={(event) => {
                        event.stopPropagation();
                        showAllMessages();
                      }}
                    >
                      Messages
                    </button>
                    <button
                      className={`${styles.secondaryAction} ${styles.blue} ${styles.focusHomeAppointmentAction}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        askAppointmentQuestion();
                      }}
                    >
                      Appointment
                    </button>
                    <button
	                      className={`${styles.primaryAction} ${styles.focusHomeAskAction} ${
	                        guideTarget === "ask"
	                          ? styles.guideTarget
	                          : guideTarget
	                            ? styles.guideDim
	                            : ""
	                      } ${onlineRequiredActionClass}`}
	                      type="button"
	                      aria-disabled={!receiverOnline}
                      onClick={(event) => {
                        event.stopPropagation();
                        openAsk();
                      }}
                    >
                      Ask a Question
                    </button>
                    <button
	                      className={`${styles.primaryAction} ${styles.focusHomeCallAction} ${
	                        guideTarget === "primary"
	                          ? styles.guideTarget
	                          : guideTarget
	                            ? styles.guideDim
	                            : ""
	                      } ${onlineRequiredActionClass}`}
	                      type="button"
	                      aria-disabled={!receiverOnline}
                      onClick={(event) => {
                        event.stopPropagation();
                        callContact(selectedContact);
                      }}
                    >
                      Call {selectedContact.displayName}
                    </button>
                  </div>
                  <div className={styles.focusHomeUtilityStack}>
                    {attentionItem ? (
                      <button
	                        className={`${styles.footerUtilityAction} ${styles.focusHomeUtilityAction} ${styles.reviewFooterAction} ${onlineRequiredActionClass}`}
	                        type="button"
	                        aria-label={attentionItem.label}
	                        aria-disabled={!receiverOnline}
                        onClick={(event) => {
                          event.stopPropagation();
                          openAttentionItem(attentionItem);
                        }}
                      >
                        {attentionItem.label}
                      </button>
                    ) : null}
                    <button
                      className={`${styles.footerUtilityAction} ${styles.focusHomeUtilityAction}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openOptionalSounds();
                      }}
                    >
                      Sounds
                    </button>
                    <button
                      className={`${styles.footerUtilityAction} ${styles.focusHomeUtilityAction}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openScreenCleaningConfirm();
                      }}
                    >
                      Clean
                    </button>
                  </div>
                </>
              ) : (
                <>
	                <button
	                  className={`${styles.primaryAction} ${styles.receiverHomeAction} ${
	                    guideTarget === "ask"
	                      ? styles.guideTarget
	                      : guideTarget
	                        ? styles.guideDim
	                        : ""
	                  } ${onlineRequiredActionClass}`}
	                  type="button"
	                  aria-disabled={!receiverOnline}
                  onClick={(event) => {
                    event.stopPropagation();
                    openAsk();
                  }}
                >
                  Ask a Question
                </button>
	                <button
	                  className={`${styles.primaryAction} ${styles.receiverHomeAction} ${
	                    guideTarget === "primary"
	                      ? styles.guideTarget
	                      : guideTarget
	                        ? styles.guideDim
	                        : ""
	                  } ${onlineRequiredActionClass}`}
	                  type="button"
	                  aria-disabled={!receiverOnline}
                  onClick={(event) => {
                    event.stopPropagation();
                    callContact(selectedContact);
                  }}
                >
                  Call {selectedContact.displayName}
                </button>
                <button
                  className={`${styles.secondaryAction} ${styles.blue} ${styles.wideAction} ${
                    guideTarget === "ask"
                      ? styles.guideTarget
                      : guideTarget
                        ? styles.guideDim
                        : ""
                  }`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    askAppointmentQuestion();
                  }}
                >
                  Appointment
                </button>
	                <button
	                  className={`${styles.secondaryAction} ${styles.blue} ${styles.wideAction} ${styles.messagesHomeAction} ${onlineRequiredActionClass}`}
	                  type="button"
	                  aria-disabled={!receiverOnline}
                  onClick={(event) => {
                    event.stopPropagation();
                    showAllMessages();
                  }}
                >
                  Messages
                </button>
                <div className={styles.cleaningFooterRow}>
	                  <button
	                    className={`${styles.talkFooterAction} ${onlineRequiredActionClass}`}
	                    type="button"
	                    aria-label="Talk"
	                    aria-disabled={!receiverOnline}
	                    disabled={receiverRecordingProcessing}
                    onClick={(event) => {
                      event.stopPropagation();
                      void startReceiverRecording();
                    }}
                  >
                    <span className={styles.talkFooterIcon} aria-hidden="true" />
                    <span>Talk</span>
                  </button>
                  {attentionItem ? (
	                    <button
	                      className={`${styles.footerUtilityAction} ${styles.reviewFooterAction} ${onlineRequiredActionClass}`}
	                      type="button"
	                      aria-label={attentionItem.label}
	                      aria-disabled={!receiverOnline}
                      onClick={(event) => {
                        event.stopPropagation();
                        openAttentionItem(attentionItem);
                      }}
                    >
                      {attentionItem.label}
                    </button>
                  ) : null}
                  <button
                    className={`${styles.footerUtilityAction} ${styles.soundsFooterAction}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openOptionalSounds();
                    }}
                  >
                    Sounds
                  </button>
                  <button
                    className={`${styles.footerUtilityAction} ${styles.cleanFooterAction}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openScreenCleaningConfirm();
                    }}
                  >
                    Clean
                  </button>
                </div>
              </>
              )
            ) : (
              <>
	                <button
	                  className={`${styles.primaryAction} ${
	                    guideTarget === "primary"
	                      ? styles.guideTarget
	                      : guideTarget
	                        ? styles.guideDim
	                        : ""
	                  } ${onlineRequiredActionClass}`}
	                  type="button"
	                  aria-disabled={!receiverOnline}
                  onClick={(event) => {
                    event.stopPropagation();
                    openContact();
                  }}
                >
                  Contact Andrew
                </button>
                <div className={styles.receiverActionRow}>
	                  <button
	                    className={`${styles.secondaryAction} ${styles.green} ${
	                      guideTarget === "ask"
	                        ? styles.guideTarget
	                        : guideTarget
	                          ? styles.guideDim
	                          : ""
	                    } ${onlineRequiredActionClass}`}
	                    type="button"
	                    aria-disabled={!receiverOnline}
                    onClick={(event) => {
                      event.stopPropagation();
                      openAsk();
                    }}
                  >
                    Ask a question
                  </button>
	                  <button
	                    className={`${styles.iconAction} ${styles.recordAction} ${
	                      receiverRecording ? styles.recordingActive : ""
	                    } ${guideTarget ? styles.guideDim : ""} ${onlineRequiredActionClass}`}
	                    type="button"
	                    aria-label={receiverRecording ? "Stop recording" : "Record a request"}
	                    aria-disabled={!receiverOnline}
                    disabled={receiverRecordingProcessing}
                    onClick={(event) => {
                      event.stopPropagation();
                      void startReceiverRecording();
                    }}
                  >
                    <span className={styles.micIcon} aria-hidden="true">
                      <span />
                    </span>
                  </button>
                  <button
                    className={`${styles.iconAction} ${styles.soundAction} ${guideTarget ? styles.guideDim : ""}`}
                    type="button"
                    aria-label="Set optional sounds"
                    onClick={(event) => {
                      event.stopPropagation();
                      openOptionalSounds();
                    }}
                  >
                    <span className={styles.soundIcon} aria-hidden="true">
                      <span />
                    </span>
                  </button>
                </div>
                <button
                  className={`${styles.secondaryAction} ${styles.blue} ${styles.wideAction} ${
                    guideTarget === "ask"
                      ? styles.guideTarget
                      : guideTarget
                        ? styles.guideDim
                        : ""
                  }`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    askAppointmentQuestion();
                  }}
                >
                  Appointment
                </button>
              </>
            )}
          </section>

          {!deskPhoneMode ? (
            <section className={styles.workspaceZone} aria-label="Messages">
            <>
            <div className={styles.workspaceNav}>
              <strong>Messages</strong>
	              <button
	                className={`${styles.messageAction} ${styles.messageNavButton} ${styles.workspaceShowAllButton} ${onlineRequiredActionClass}`}
	                type="button"
	                aria-disabled={!receiverOnline}
                onClick={(event) => {
                  event.stopPropagation();
                  showAllMessages();
                }}
              >
                Show All
              </button>
              <span className={styles.workspaceNavSpacer} aria-hidden="true" />
              {hasMessagePaging ? (
                <button
                  className={`${styles.messageAction} ${styles.messageNavButton}`}
                  disabled={focusedMessageIndex === 0}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    clearGuideBecauseReceiverActed();
                    setFocusedMessageIndex((value) => Math.max(0, value - 1));
                  }}
                >
                  Previous
                </button>
              ) : null}
              {hasMessagePaging ? (
                <button
                  className={`${styles.messageAction} ${styles.messageNavButton}`}
                  disabled={focusedMessageIndex >= messages.length - 1}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    clearGuideBecauseReceiverActed();
                    setFocusedMessageIndex((value) => Math.min(messages.length - 1, value + 1));
                  }}
                >
                  Next
                </button>
              ) : null}
            </div>
            {focusedMessage ? (
              <article className={styles.messageCard}>
                <strong>
                  {messageHeader(focusedMessage)}
                </strong>
                <p>{messageText(focusedMessage)}</p>
                <div className={styles.messageButtonRow}>
                  <button
	                    className={`${styles.messageAction} ${styles.blue} ${onlineRequiredActionClass}`}
	                    type="button"
	                    aria-disabled={!receiverOnline}
                    onClick={(event) => {
                      event.stopPropagation();
                      openMessage(focusedMessage);
                    }}
                  >
                    OPEN MESSAGE
                  </button>
                  <button
	                    className={`${styles.messageAction} ${styles.callBackAction} ${onlineRequiredActionClass}`}
	                    type="button"
	                    aria-disabled={!receiverOnline}
                    onClick={(event) => {
                      event.stopPropagation();
                      callBackForMessage(focusedMessage);
                    }}
                  >
                    CALL BACK
                  </button>
                </div>
              </article>
            ) : (
              <article className={styles.messageCard}>
                <p>No messages yet.</p>
              </article>
            )}
            </>
            </section>
          ) : null}
          {modal && (modal.type !== "incomingCall" || modal.textView) ? (
            <ReceiverModal
              applianceMode={deskPhoneMode}
              askDraft={askDraft}
              autoHearPreference={autoHearPreference}
              contactRecording={contactRecording}
              contactRecordingProcessing={contactRecordingProcessing}
              contactDraft={contactDraft}
              messageTextSize={messageTextSize}
              modal={modal}
              messages={messages}
              pendingContactRecording={pendingContactRecording}
              playingMessageId={playingMessageId}
              receiverRecording={receiverRecording}
              receiverRecordingProcessing={receiverRecordingProcessing}
              lastSoundTestResult={lastSoundTestResult}
              soundDiagnostic={soundDiagnostic}
              soundHelp={soundHelp}
              soundSettings={soundSettings}
              selectedSoundProblem={selectedSoundProblem}
              key={modal.type === "reader" ? `reader-${modal.message.id}` : modal.type}
              onApproveCallSummary={approveCallSummary}
              onAskDraftChange={setAskDraft}
              onCallBackForMessage={callBackForMessage}
              onCallContact={callContact}
              onClose={closeModal}
              onContactDraftChange={setContactDraft}
              onCompleteTodayFocusItem={markTodayFocusComplete}
              onEscalateAskRecovery={escalateAskRecovery}
              onMessageTextSizeChange={setMessageTextSize}
              onOpenMessageFromAllMessages={openMessageFromAllMessages}
              onPlayMessage={hearMessage}
              onRetryAsk={(question) => {
                setAskDraft(question);
                setModal({ type: "ask" });
              }}
              onApplySoundHelpAction={applySoundHelpAction}
              onRecordContact={toggleContactRecording}
              onRecordRequest={startReceiverRecording}
              onReportSoundProblem={reportSoundProblem}
              onRecordHearingFeedback={recordHearingFeedback}
              onResolveSoundHelp={markSoundHelpResolved}
              onResetSoundTestState={resetSoundTestState}
              onSendContact={sendMessage}
              onSaveCallSummaryDraft={saveCallSummaryDraft}
              onSetModal={setModal}
              onStartScreenCleaning={startScreenCleaning}
              onSubmitAsk={submitAsk}
              onTestSound={testOptionalSound}
              onToggleAutoHearPreference={toggleAutoHearPreference}
              onUpdateSoundSetting={updateSoundSetting}
            />
          ) : null}
          {interruptedReviewIncomingCall?.callId ? (
            <IncomingCallPrompt
              callerName={String(interruptedReviewIncomingCall.callerName || "Andrew")}
              callId={String(interruptedReviewIncomingCall.callId)}
              onAnswerIncomingCall={answerIncomingCall}
              onDeclineIncomingCall={declineIncomingCall}
            />
          ) : modal?.type === "incomingCall" && modal.callState === "incoming" && !modal.textView ? (
            <IncomingCallPrompt
              callerName={modal.callerName}
              callId={modal.callId}
              onAnswerIncomingCall={answerIncomingCall}
              onDeclineIncomingCall={declineIncomingCall}
            />
          ) : null}
          {guideRect ? (
            <div
              aria-hidden="true"
              className={styles.guideRectTarget}
              style={
                {
                  "--guide-height": `${guideRect.height}px`,
                  "--guide-width": `${guideRect.width}px`,
                  "--guide-x": `${guideRect.x}px`,
                  "--guide-y": `${guideRect.y}px`,
                } as CSSProperties
              }
            />
          ) : null}
          {screenCleaningSecondsRemaining !== null ? (
            <ScreenCleaningView
              message={screenCleaningSession?.message || screenCleaningMessages[0]}
              secondsRemaining={screenCleaningSecondsRemaining}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function ScreenCleaningView({
  message,
  secondsRemaining,
}: {
  message: string;
  secondsRemaining: number;
}) {
  return (
    <div
      className={styles.screenCleaningView}
      role="status"
      aria-live="polite"
      onClickCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerDownCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerUpCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onTouchStartCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onTouchEndCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <h1>CarePland Receiver Screen Cleaning</h1>
      <div className={styles.screenCleaningCenter}>
        <p>{message}</p>
        <strong>{formatCountdownSeconds(secondsRemaining)}</strong>
      </div>
    </div>
  );
}

function SoundToggleRow({
  label,
  onToggle,
  value,
}: {
  label: string;
  onToggle: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <div className={styles.soundSettingGroup}>
      <strong>{label}</strong>
      <div className={styles.soundChoiceRow}>
        <button
          className={`${styles.soundChoice} ${value ? styles.soundChoiceSelected : ""}`}
          type="button"
          onClick={() => onToggle(true)}
        >
          On
        </button>
        <button
          className={`${styles.soundChoice} ${!value ? styles.soundChoiceSelected : ""}`}
          data-receiver-no-beep="true"
          type="button"
          onClick={() => onToggle(false)}
        >
          Off
        </button>
      </div>
    </div>
  );
}

function CallTextView({
  actions,
  closeLabel = "Close Text View",
  editableLabel,
  editablePlaceholder,
  editableStatusText,
  editableText,
  messageTextSize,
  onClose,
  onEditableTextChange,
  onMessageTextSizeChange,
  policyNotice,
  text,
  title,
}: {
  actions?: ReactNode;
  closeLabel?: string;
  editableLabel?: string;
  editablePlaceholder?: string;
  editableStatusText?: string;
  editableText?: string;
  messageTextSize: ReaderTextSize;
  onClose: () => void;
  onEditableTextChange?: (value: string) => void;
  onMessageTextSizeChange: (value: ReaderTextSize) => void;
  policyNotice?: string;
  text: string;
  title: string;
}) {
  const textSizeClass =
    messageTextSize === "standard"
      ? styles.readerTextStandard
      : messageTextSize === "extra"
        ? styles.readerTextExtra
        : styles.readerTextLarge;

  return (
    <section className={styles.callTextView}>
      <div className={styles.callTextToolbar}>
        <div>
          <h3>{title}</h3>
        </div>
        <div className={styles.callTextToolbarActions}>
          <div className={styles.readerSizeRow} aria-label="Text size">
            {[
              ["standard", "Standard"],
              ["large", "Large"],
              ["extra", "Extra Large"],
            ].map(([value, label]) => {
              const selected = messageTextSize === value;
              return (
                <button
                  className={`${styles.readerSizeButton} ${selected ? styles.readerSizeButtonSelected : ""}`}
                  key={value}
                  type="button"
                  onClick={() => onMessageTextSizeChange(value as ReaderTextSize)}
                >
                  {selected ? label.toUpperCase() : label}
                </button>
              );
            })}
          </div>
          <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
      {policyNotice ? <p className={styles.callSummaryPolicyNotice}>{policyNotice}</p> : null}
      {onEditableTextChange ? (
        <>
          {editableStatusText ? (
            <p className={styles.callSummaryStatusNotice}>{editableStatusText}</p>
          ) : null}
          <label className={`${styles.callSummaryEditBox} ${textSizeClass}`}>
            <span>{editableLabel || "Review summary"}</span>
            <textarea
              placeholder={editablePlaceholder}
              value={editableText ?? text}
              onChange={(event) => onEditableTextChange(event.target.value)}
            />
          </label>
        </>
      ) : (
        <p className={`${styles.readerText} ${textSizeClass}`}>{text}</p>
      )}
      {actions ? <div className={styles.callSummaryActions}>{actions}</div> : null}
    </section>
  );
}

function ReceiverCallStatusPanel({
  applianceMode,
  callAudioStatus,
  callMuted,
  modal,
  now,
  onAnswerIncomingCall,
  onDeclineIncomingCall,
  onHangUpIncomingCall,
  onSetModal,
  onToggleCallMuted,
}: {
  applianceMode: boolean;
  callAudioStatus: ConnectCallAudioStatus;
  callMuted: boolean;
  modal: Extract<NonNullable<ModalState>, { type: "incomingCall" }>;
  now: Date;
  onAnswerIncomingCall: (callerName: string, callId?: string) => void;
  onDeclineIncomingCall: (callerName: string, callId?: string) => void;
  onHangUpIncomingCall: (callerName: string, callId?: string) => void;
  onSetModal: (modal: ModalState) => void;
  onToggleCallMuted: () => void;
}) {
  const connected = modal.callState === "connected";
  const connecting = modal.callState === "connecting";
  const ended = modal.callState === "ended";
  const captionsOpen = modal.textView === "captions";
  const transcriptReady = Boolean(modal.transcriptText?.trim());
  const callDuration = formatReceiverCallDuration(
    modal.callStartedAt,
    modal.callEndedAt,
    now
  );
  const callAudioLabel =
    callAudioStatus === "remote_audio" || callAudioStatus === "connected"
      ? "Live audio is on"
      : callAudioStatus === "microphone_ready" || callAudioStatus === "connecting" || connecting
        ? "Audio is connecting"
        : callAudioStatus === "interrupted"
          ? "Audio was interrupted"
          : callAudioStatus === "starting"
            ? "Starting audio"
            : "Audio will start after answer";
  const endedSummaryStatus = callEndedSummaryStatusLabel(modal);
  const endedSummaryActionLabel = modal.summaryText?.trim()
    ? "Review Call Summary"
    : modal.summaryStatus === "failed" || modal.summaryStatus === "summary_failed"
      ? "Review Call Notes"
      : modal.summaryStatus === "not_needed"
        ? "Review Call Notes"
        : "Open Call Notes";

  return (
    <div className={styles.callPhonePanel}>
      <div className={styles.callPhoneTopRow}>
        <div className={styles.callPhoneClock}>
          <strong>{formatTime(now)}</strong>
          <span>{formatDate(now)}</span>
        </div>
        <h2 id="call-title">
          {ended
            ? "Call Ended"
            : connected
              ? `Connected to ${modal.callerName}`
              : connecting
                ? "Connecting"
                : `${modal.callerName} is calling`}
        </h2>
        <div className={styles.callDuration}>{callDuration}</div>
      </div>
      {!ended ? (
        <div className={styles.callPhoneStatus}>
          {transcriptReady
            ? "Closed captioning text is ready."
            : connected
              ? "Use the handset or speaker."
              : connecting
                ? callAudioLabel
                : "Pick up the handset or press ANSWER."}
        </div>
      ) : null}
      {transcriptReady && !ended ? (
        <p className={styles.liveCaptionNotice}>
          Temporary transcript captured for call notes.
        </p>
      ) : null}
      {callMuted && connected ? (
        <div className={styles.mutedNotice}>YOU ARE MUTED</div>
      ) : null}
      {ended ? (
        <div className={styles.endedCallActions}>
          {endedSummaryStatus ? (
            <p className={styles.endedCallSummaryStatus}>{endedSummaryStatus}</p>
          ) : null}
          <button
            className={styles.modalButton}
            type="button"
            onClick={() => onSetModal({ ...modal, textView: "summary" })}
          >
            {endedSummaryActionLabel}
          </button>
          <button
            className={`${styles.modalButton} ${styles.secondary}`}
            type="button"
            onClick={() => onSetModal(null)}
          >
            Close Call
          </button>
        </div>
      ) : connected || connecting ? (
        <div className={`${styles.callPhoneActions} ${applianceMode ? styles.applianceCallActions : ""}`}>
          {!applianceMode ? (
            <button
              className={`${styles.callControlButton} ${callMuted ? styles.callControlActive : ""}`}
              type="button"
              onClick={onToggleCallMuted}
            >
              <span aria-hidden="true">Mic</span>
              {callMuted ? "Unmute" : "Mute"}
            </button>
          ) : null}
          <button
            className={`${styles.callControlButton} ${styles.callEndButton}`}
            type="button"
            onClick={() => onHangUpIncomingCall(modal.callerName, modal.callId)}
          >
            END CALL
          </button>
          {!applianceMode ? (
            <button
              className={`${styles.callControlButton} ${captionsOpen ? styles.callControlActive : ""}`}
              type="button"
              onClick={() =>
                onSetModal({
                  ...modal,
                  textView: captionsOpen ? undefined : "captions",
                })
              }
            >
              {captionsOpen
                ? "Hide Closed Captioning"
                : transcriptReady
                  ? "Show Captions"
                  : "Show Closed Captioning"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className={styles.incomingCallActions}>
          <button
            className={styles.modalButton}
            type="button"
            onClick={() => onAnswerIncomingCall(modal.callerName, modal.callId)}
          >
            ANSWER
          </button>
          <button
            className={`${styles.modalButton} ${styles.secondary}`}
            type="button"
            onClick={() => onDeclineIncomingCall(modal.callerName, modal.callId)}
          >
            NOT NOW
          </button>
        </div>
      )}
    </div>
  );
}

function callEndedSummaryStatusLabel(
  modal: Extract<NonNullable<ModalState>, { type: "incomingCall" }>
) {
  const summaryText = modal.summaryText?.trim() || "";
  const summaryStatus = modal.summaryStatus || "";
  if (modal.summaryApproval === "approved" || summaryStatus === "approved") {
    return "Care summary approved.";
  }
  if (summaryText) {
    return "Care summary is ready to review.";
  }
  if (summaryStatus === "pending" || summaryStatus === "pending_review") {
    return "Care summary is being prepared.";
  }
  if (summaryStatus === "failed" || summaryStatus === "summary_failed") {
    return "Care summary needs review.";
  }
  if (summaryStatus === "expired_unreviewed") {
    return "Care summary expired before approval.";
  }
  if (summaryStatus === "not_needed") {
    return "No care details were captured for a summary.";
  }
  return "Care summary will appear if enough care details were captured.";
}

function IncomingCallPrompt({
  callerName,
  callId,
  onAnswerIncomingCall,
  onDeclineIncomingCall,
}: {
  callerName: string;
  callId?: string;
  onAnswerIncomingCall: (callerName: string, callId?: string) => void;
  onDeclineIncomingCall: (callerName: string, callId?: string) => void;
}) {
  return (
    <div
      className={styles.modal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
    >
      <section className={`${styles.modalPanel} ${styles.incomingCallPrompt}`}>
        <div>
          <p className={styles.incomingCallEyebrow}>Incoming call</p>
          <h2 id="incoming-call-title">{callerName} is calling</h2>
        </div>
        <button
          className={`${styles.modalButton} ${styles.answerCallButton}`}
          type="button"
          autoFocus
          onClick={() => onAnswerIncomingCall(callerName, callId)}
        >
          ANSWER
        </button>
        <button
          className={`${styles.modalButton} ${styles.secondary} ${styles.notNowCallButton}`}
          type="button"
          onClick={() => onDeclineIncomingCall(callerName, callId)}
        >
          NOT NOW
        </button>
      </section>
    </div>
  );
}

function ReceiverModal({
  applianceMode,
  askDraft,
  autoHearPreference,
  contactRecording,
  contactRecordingProcessing,
  contactDraft,
  messageTextSize,
  messages,
  modal,
  pendingContactRecording,
  playingMessageId,
  receiverRecording,
  receiverRecordingProcessing,
  lastSoundTestResult,
  soundDiagnostic,
  soundHelp,
  soundSettings,
  selectedSoundProblem,
  onApplySoundHelpAction,
  onApproveCallSummary,
  onAskDraftChange,
  onCallBackForMessage,
  onCallContact,
  onClose,
  onCompleteTodayFocusItem,
  onContactDraftChange,
  onEscalateAskRecovery,
  onMessageTextSizeChange,
  onOpenMessageFromAllMessages,
  onPlayMessage,
  onRecordContact,
  onRecordRequest,
  onRecordHearingFeedback,
  onReportSoundProblem,
  onResolveSoundHelp,
  onResetSoundTestState,
  onRetryAsk,
  onSendContact,
  onSaveCallSummaryDraft,
  onSetModal,
  onStartScreenCleaning,
  onSubmitAsk,
  onTestSound,
  onToggleAutoHearPreference,
  onUpdateSoundSetting,
}: {
  applianceMode: boolean;
  askDraft: string;
  autoHearPreference: AutoHearPreference;
  contactRecording: boolean;
  contactRecordingProcessing: boolean;
  contactDraft: string;
  messageTextSize: ReaderTextSize;
  messages: Message[];
  modal: NonNullable<ModalState>;
  pendingContactRecording: PendingContactRecording | null;
  playingMessageId: string | null;
  receiverRecording: boolean;
  receiverRecordingProcessing: boolean;
  lastSoundTestResult: string;
  soundDiagnostic: string;
  soundHelp: SoundHelp | null;
  soundSettings: SoundSettings;
  selectedSoundProblem: SoundProblem | null;
  onApplySoundHelpAction: (action: NonNullable<SoundHelp["actions"]>[number]) => void;
  onApproveCallSummary: (callId?: string, approvedSummaryOverride?: string) => Promise<void>;
  onAskDraftChange: (value: string) => void;
  onCallBackForMessage: (message: Message) => void;
  onCallContact: (contact: Contact) => void;
  onClose: () => void;
  onCompleteTodayFocusItem: (
    item: ReceiverTodayFocusHomeItem,
    completion?: ReceiverTodayFocusCompletionInput
  ) => void | Promise<void>;
  onContactDraftChange: (value: string) => void;
  onEscalateAskRecovery: (question: string) => void;
  onMessageTextSizeChange: (value: ReaderTextSize) => void;
  onOpenMessageFromAllMessages: (message: Message, page: number) => void;
  onPlayMessage: (message: Message, variant?: PlaybackVariant, forceRestart?: boolean) => Promise<void>;
  onRecordContact: (contact: Contact) => Promise<void>;
  onRecordRequest: () => Promise<void>;
  onRecordHearingFeedback: (message: Message, choice: string) => void;
  onReportSoundProblem: (problem: SoundProblem) => void;
  onResolveSoundHelp: () => void;
  onResetSoundTestState: () => void;
  onRetryAsk: (question: string) => void;
  onSendContact: (contact: Contact, body: string, recording?: PendingContactRecording | null) => void;
  onSaveCallSummaryDraft: (callId: string | undefined, draftText: string) => Promise<void>;
  onSetModal: (modal: ModalState) => void;
  onStartScreenCleaning: () => void;
  onSubmitAsk: () => void | Promise<void>;
  onTestSound: () => void;
  onToggleAutoHearPreference: () => void;
  onUpdateSoundSetting: (key: keyof SoundSettings, value: boolean | SoundSettings["comfortVolume"]) => void;
}) {
  const readerFullText = modal.type === "reader" ? messageText(modal.message) : "";
  const readerPages = useMemo(
    () => paginateReaderText(readerFullText, messageTextSize),
    [messageTextSize, readerFullText]
  );
  const readerPageKey = `${messageTextSize}:${readerFullText}`;
  const [readerPageState, setReaderPageState] = useState({ index: 0, key: "" });
  const [hearingFeedbackStep, setHearingFeedbackStep] =
    useState<HearingFeedbackStep>(null);
  const [playedMessageIds, setPlayedMessageIds] = useState<Record<string, boolean>>({});
  const [playedComparisonVariants, setPlayedComparisonVariants] =
    useState<Record<string, boolean>>({});
  const [comparisonVersions] = useState(randomizedConnectComparisonVersions);
  const [todayFocusWeightDraft, setTodayFocusWeightDraft] = useState("");
  const [todayFocusWeightUnit, setTodayFocusWeightUnit] = useState<"lbs" | "kg">("lbs");
  const autoPlayedMessageIdRef = useRef("");
  const readerPageIndex = readerPageState.key === readerPageKey ? readerPageState.index : 0;

  useEffect(() => {
    if (modal.type !== "reader") {
      autoPlayedMessageIdRef.current = "";
      return;
    }

    const messageJustOpened = autoPlayedMessageIdRef.current !== modal.message.id;
    if (!messageJustOpened) return;

    autoPlayedMessageIdRef.current = modal.message.id;

    if (autoHearPreference === "on" && modal.message.audioUrl) {
      void onPlayMessage(modal.message, "default", true);
    }
  }, [autoHearPreference, modal, onPlayMessage]);

  if (modal.type === "offlineNotice") {
    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="offline-notice-title">
        <section className={`${styles.modalPanel} ${styles.offlineNoticePanel}`}>
          <h2 id="offline-notice-title">CarePland is offline</h2>
          <p>{receiverOfflineActionMessage()}</p>
          <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
            Go Home
          </button>
        </section>
      </div>
    );
  }

  if (modal.type === "todayFocusWeight") {
    const measurementDigitLimit = measurementDigitLimitForFocusItem(modal.item);
    const weightUnitLabel = todayFocusWeightUnit === "kg" ? "kgs" : "lbs";
    const measurementPrompt =
      modal.item.completionConfig?.valuePromptText || "What was your weight?";
    const canSaveWeight = /\d/.test(todayFocusWeightDraft);
    const appendWeightDigit = (digit: string) => {
      setTodayFocusWeightDraft((current) => {
        if (digit === "backspace") return current.slice(0, -1);
        if (digit === "." && current.includes(".")) return current;
        if (digit !== "." && current.replace(/\D/g, "").length >= measurementDigitLimit) return current;
        if (digit === "." && !current) return "0.";
        return `${current}${digit}`;
      });
    };

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="today-focus-weight-title">
        <section className={`${styles.modalPanel} ${styles.todayFocusWeightPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="today-focus-weight-title">{measurementPrompt}</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Back
            </button>
          </div>
          <div className={styles.weightEntryGrid}>
            <div className={styles.weightEntryControls}>
              <label className={styles.weightEntryField}>
                <span className={styles.srOnly}>Weight</span>
                <span className={styles.weightEntryInputWrap}>
                  <input
                    inputMode="decimal"
                    type="text"
                    aria-label={`Weight in ${weightUnitLabel}`}
                    value={todayFocusWeightDraft}
                    onChange={(event) => {
                      setTodayFocusWeightDraft(
                        normalizeDecimalMeasurementInput(event.target.value, measurementDigitLimit)
                      );
                    }}
                    autoFocus
                  />
                  <span aria-hidden="true">{weightUnitLabel}</span>
                </span>
              </label>
              <div className={styles.weightUnitChoices} aria-label="Weight unit">
                <button
                  className={`${styles.modalButton} ${todayFocusWeightUnit === "lbs" ? "" : styles.secondary}`}
                  type="button"
                  onClick={() => setTodayFocusWeightUnit("lbs")}
                >
                  lbs
                </button>
                <button
                  className={`${styles.modalButton} ${todayFocusWeightUnit === "kg" ? "" : styles.secondary}`}
                  type="button"
                  onClick={() => setTodayFocusWeightUnit("kg")}
                >
                  kg
                </button>
              </div>
              <button
                className={styles.modalButton}
                type="button"
                disabled={!canSaveWeight}
                onClick={() => {
                  void onCompleteTodayFocusItem(modal.item, {
                    unit: todayFocusWeightUnit === "kg" ? "kg" : "lb",
                    value: Number(todayFocusWeightDraft),
                  });
                  setTodayFocusWeightDraft("");
                  setTodayFocusWeightUnit("lbs");
                  onClose();
                }}
              >
                Done
              </button>
            </div>
            <div className={styles.weightKeypad} aria-label="Weight keypad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"].map((key) => (
                <button
                  className={styles.weightKey}
                  key={key}
                  type="button"
                  onClick={() => appendWeightDigit(key)}
                >
                  {key === "backspace" ? "⌫" : key}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (modal.type === "screenCleaningConfirm") {
    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="screen-cleaning-title">
        <section className={`${styles.modalPanel} ${styles.screenCleaningConfirmPanel}`}>
          <h2 id="screen-cleaning-title">Screen Cleaning</h2>
          <p>Clean the screen now?</p>
          <div className={styles.screenCleaningConfirmActions}>
            <button className={styles.modalButton} type="button" onClick={onStartScreenCleaning}>
              Start Cleaning
            </button>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (modal.type === "contact") {
    const contact = contacts.find((item) => item.id === modal.contactId) ?? contacts[0];
    const canCall = contactCanCallNow(contact);

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="contact-title">
        <section className={`${styles.modalPanel} ${styles.contactPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="contact-title">
              {canCall ? `Tell ${contact.displayName} something` : `Send a message to ${contact.displayName}`}
            </h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          {!canCall ? (
            <p className={styles.availabilityNotice}>{contact.displayName} is unavailable right now.</p>
          ) : null}
          <textarea
            className={styles.requestInput}
            onChange={(event) => onContactDraftChange(event.target.value)}
            placeholder={`What would you like to tell ${contact.displayName}?`}
            value={contactDraft}
          />
          <button
            className={`${styles.modalButton} ${contactRecording ? styles.danger : styles.secondary}`}
            disabled={contactRecordingProcessing}
            type="button"
            onClick={() => {
              void onRecordContact(contact);
            }}
          >
            {contactRecording ? "Stop Recording" : contactRecordingProcessing ? "Transcribing" : "Record Message"}
          </button>
          {pendingContactRecording ? (
            <p className={styles.recordingNotice}>
              {pendingContactRecording.transcriptStatus === "completed"
                ? "Recording transcribed. Original audio will be sent."
                : "Recording ready. Original audio will be sent."}
            </p>
          ) : null}
          <button
            className={`${styles.modalButton} ${contactDraft.trim() || pendingContactRecording ? "" : styles.inactive}`}
            type="button"
            onClick={() => onSendContact(contact, contactDraft, pendingContactRecording)}
          >
            {contactDraft.trim() || pendingContactRecording ? "Send Message" : "Type or record first"}
          </button>
          {canCall ? (
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => onCallContact(contact)}>
              Call {contact.displayName}
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  if (modal.type === "ask") {
    return (
      <div
        className={`${styles.modal} ${applianceMode ? styles.applianceFullscreenModal : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-title"
      >
        <section className={`${styles.modalPanel} ${applianceMode ? styles.applianceAskPanel : ""}`}>
          <div className={`${styles.modalTitleRow} ${applianceMode ? styles.applianceAskTitleRow : ""}`}>
            <h2 id="ask-title">Ask a question</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <p className={`${styles.askPrompt} ${applianceMode ? styles.applianceAskPrompt : ""}`}>
            Type anything, or click a button.
          </p>
          <textarea
            className={`${styles.requestInput} ${applianceMode ? styles.applianceAskInput : ""}`}
            onChange={(event) => onAskDraftChange(event.target.value)}
            placeholder="Example: I need milk"
            value={askDraft}
          />
          <div className={`${styles.requestExamples} ${applianceMode ? styles.applianceRequestExamples : ""}`}>
            {["What time am I leaving?", "What should I bring?", "I need milk", "I feel dizzy"].map((example) => (
              <button
                className={styles.requestExample}
                key={example}
                type="button"
                onClick={() => onAskDraftChange(example)}
              >
                {example}
              </button>
            ))}
          </div>
          <button
            className={`${styles.modalButton} ${styles.secondary} ${styles.recordRequestButton} ${
              receiverRecording ? styles.recordingActive : ""
            }`}
            disabled={receiverRecordingProcessing}
            type="button"
            onClick={() => {
              void onRecordRequest();
            }}
          >
            <span className={styles.micIcon} aria-hidden="true" />
            <span>
              {receiverRecording
                ? "Stop Recording"
                : receiverRecordingProcessing
                  ? "Transcribing"
                  : "Record Request"}
            </span>
          </button>
          <button
            className={`${styles.modalButton} ${styles.askSubmitButton} ${askDraft.trim() ? "" : styles.inactive}`}
            type="button"
            onClick={onSubmitAsk}
          >
            {askDraft.trim() ? "Ask" : "Type your request"}
          </button>
        </section>
      </div>
    );
  }

  if (modal.type === "askRecordReview") {
    const reviewDraft = askDraft.trim();
    const reviewText = receiverRecording
      ? "Recording..."
      : receiverRecordingProcessing
        ? "Transcribing recording..."
        : reviewDraft || modal.transcript || "Voice recording";
    const canSubmitReview =
      !receiverRecording && !receiverRecordingProcessing && Boolean(reviewDraft) && reviewDraft !== "Transcribing recording...";

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="record-review-title">
        <section className={styles.modalPanel}>
          <div className={styles.modalTitleRow}>
            <h2 id="record-review-title">Recording your voice</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <p className={styles.recordReviewText}>{reviewText}</p>
          <button
            className={`${styles.modalButton} ${styles.secondary} ${styles.recordRequestButton} ${
              receiverRecording ? styles.recordReviewStopButton : ""
            }`}
            disabled={receiverRecordingProcessing}
            type="button"
            onClick={() => {
              if (!receiverRecording) {
                onAskDraftChange("");
              }
              void onRecordRequest();
            }}
          >
            <span className={styles.micIcon} aria-hidden="true" />
            <span>
              {receiverRecording
                ? "Stop Recording"
                : receiverRecordingProcessing
                  ? "Transcribing"
                  : "Record Again"}
            </span>
          </button>
          <button
            className={`${styles.modalButton} ${styles.askSubmitButton} ${canSubmitReview ? "" : styles.inactive}`}
            type="button"
            onClick={onSubmitAsk}
          >
            This text is what I want to send
          </button>
        </section>
      </div>
    );
  }

  if (modal.type === "askAnswer") {
    const recipient = contacts.find((contact) => contact.id === modal.answer.recipientId) ?? contacts[0];
    const canSend = modal.answer.type === "message" && Boolean(modal.answer.messageBody.trim());
    const askedPages = paginateReaderText(modal.answer.question, messageTextSize);
    const askedPageCount = askedPages.length;
    const currentAskedPage = Math.min(
      Math.max(modal.page ?? 0, 0),
      Math.max(askedPageCount - 1, 0)
    );
    const textSizeClass =
      messageTextSize === "standard"
        ? styles.readerTextStandard
        : messageTextSize === "extra"
          ? styles.readerTextExtra
          : styles.readerTextLarge;

    if (applianceMode) {
      return (
        <div className={`${styles.modal} ${styles.applianceFullscreenModal}`} role="dialog" aria-modal="true" aria-labelledby="ask-answer-title">
          <section className={`${styles.modalPanel} ${styles.applianceListPanel} ${styles.applianceAskAnswerPanel}`}>
            <div className={styles.applianceListToolbar}>
              <h2 id="ask-answer-title">You Asked</h2>
              <div className={styles.applianceReaderSizeRow} aria-label="Asked text size">
                {[
                  ["standard", "Standard"],
                  ["large", "Large"],
                  ["extra", "X-Large"],
                ].map(([value, label]) => {
                  const selected = messageTextSize === value;
                  return (
                    <button
                      className={`${styles.readerSizeButton} ${selected ? styles.readerSizeButtonSelected : ""}`}
                      key={value}
                      type="button"
                      onClick={() => {
                        onMessageTextSizeChange(value as ReaderTextSize);
                        onSetModal({ ...modal, page: 0 });
                      }}
                    >
                      {selected ? label.toUpperCase() : label}
                    </button>
                  );
                })}
              </div>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
                Go Home
              </button>
            </div>
            <p className={`${styles.askedText} ${styles.askAnswerText} ${styles.applianceAskAnswerText} ${textSizeClass}`}>
              {askedPages[currentAskedPage] || modal.answer.question}
            </p>
            {!canSend ? <p className={styles.interpreterMessage}>{modal.answer.answer}</p> : null}
            <div className={styles.appliancePageControls} aria-label="Asked text page controls">
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                disabled={currentAskedPage === 0}
                type="button"
                onClick={() =>
                  onSetModal({
                    ...modal,
                    page: Math.max(0, currentAskedPage - 1),
                  })
                }
              >
                ◀
              </button>
              <span>
                {currentAskedPage + 1} / {askedPageCount}
              </span>
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                disabled={currentAskedPage >= askedPageCount - 1}
                type="button"
                onClick={() =>
                  onSetModal({
                    ...modal,
                    page: Math.min(askedPageCount - 1, currentAskedPage + 1),
                  })
                }
              >
                ▶
              </button>
            </div>
            <div className={`${styles.universalAskActions} ${styles.askAnswerActions} ${styles.applianceAskAnswerActions}`}>
              <button
                className={styles.modalButton}
                type="button"
                onClick={() => {
                  if (canSend) {
                    onSendContact(recipient, modal.answer.messageBody);
                    return;
                  }
                  onClose();
                }}
              >
                {modal.answer.actionLabel}
              </button>
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                type="button"
                onClick={() => onSetModal({ type: "askRecovery", question: modal.answer.question })}
              >
                This wasn&apos;t helpful
              </button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ask-answer-title">
        <section className={`${styles.modalPanel} ${styles.askAnswerPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="ask-answer-title">You Asked</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <p className={`${styles.askedText} ${styles.askAnswerText} ${textSizeClass}`}>
            {askedPages[currentAskedPage] || modal.answer.question}
          </p>
          {!canSend ? <p className={styles.interpreterMessage}>{modal.answer.answer}</p> : null}
          <div className={`${styles.universalAskActions} ${styles.askAnswerActions}`}>
            <button
              className={styles.modalButton}
              type="button"
              onClick={() => {
                if (canSend) {
                  onSendContact(recipient, modal.answer.messageBody);
                  return;
                }
                onClose();
              }}
            >
              {modal.answer.actionLabel}
            </button>
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              type="button"
              onClick={() => onSetModal({ type: "askRecovery", question: modal.answer.question })}
            >
              This wasn&apos;t helpful
            </button>
          </div>
          <div className={styles.askAnswerReaderControls}>
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              disabled={currentAskedPage === 0}
              type="button"
              onClick={() =>
                onSetModal({
                  ...modal,
                  page: Math.max(0, currentAskedPage - 1),
                })
              }
            >
              ◀
            </button>
            <div className={styles.askAnswerSizeRow} aria-label="Text size">
              {[
                ["standard", "standard"],
                ["large", "large"],
                ["extra", "x-large"],
              ].map(([value, label]) => {
                const selected = messageTextSize === value;
                return (
                  <button
                    className={`${styles.readerSizeButton} ${selected ? styles.readerSizeButtonSelected : ""}`}
                    key={value}
                    type="button"
                    onClick={() => {
                      onMessageTextSizeChange(value as ReaderTextSize);
                      onSetModal({ ...modal, page: 0 });
                    }}
                  >
                    {selected ? label.toUpperCase() : label}
                  </button>
                );
              })}
            </div>
            <span className={styles.askAnswerPageIndicator}>
              {currentAskedPage + 1} / {askedPageCount}
            </span>
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              disabled={currentAskedPage >= askedPageCount - 1}
              type="button"
              onClick={() =>
                onSetModal({
                  ...modal,
                  page: Math.min(askedPageCount - 1, currentAskedPage + 1),
                })
              }
            >
              ▶
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (modal.type === "askRecovery") {
    const recoveryPages = paginateReaderText(modal.question, messageTextSize);
    const recoveryPageCount = recoveryPages.length;
    const currentRecoveryPage = Math.min(
      Math.max(modal.page ?? 0, 0),
      Math.max(recoveryPageCount - 1, 0)
    );
    const textSizeClass =
      messageTextSize === "standard"
        ? styles.readerTextStandard
        : messageTextSize === "extra"
          ? styles.readerTextExtra
          : styles.readerTextLarge;

    if (applianceMode) {
      return (
        <div className={`${styles.modal} ${styles.applianceFullscreenModal}`} role="dialog" aria-modal="true" aria-labelledby="recovery-title">
          <section className={`${styles.modalPanel} ${styles.applianceListPanel} ${styles.applianceAskRecoveryPanel}`}>
            <div className={styles.applianceListToolbar}>
              <h2 id="recovery-title">You Asked</h2>
              <div className={styles.applianceReaderSizeRow} aria-label="Asked text size">
                {[
                  ["standard", "Standard"],
                  ["large", "Large"],
                  ["extra", "X-Large"],
                ].map(([value, label]) => {
                  const selected = messageTextSize === value;
                  return (
                    <button
                      className={`${styles.readerSizeButton} ${selected ? styles.readerSizeButtonSelected : ""}`}
                      key={value}
                      type="button"
                      onClick={() => {
                        onMessageTextSizeChange(value as ReaderTextSize);
                        onSetModal({ ...modal, page: 0 });
                      }}
                    >
                      {selected ? label.toUpperCase() : label}
                    </button>
                  );
                })}
              </div>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
                Go Home
              </button>
            </div>
            <p className={`${styles.askedText} ${styles.askAnswerText} ${styles.applianceAskAnswerText} ${textSizeClass}`}>
              {recoveryPages[currentRecoveryPage] || modal.question}
            </p>
            <div className={styles.appliancePageControls} aria-label="Asked text page controls">
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                disabled={currentRecoveryPage === 0}
                type="button"
                onClick={() =>
                  onSetModal({
                    ...modal,
                    page: Math.max(0, currentRecoveryPage - 1),
                  })
                }
              >
                ◀
              </button>
              <span>
                {currentRecoveryPage + 1} / {recoveryPageCount}
              </span>
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                disabled={currentRecoveryPage >= recoveryPageCount - 1}
                type="button"
                onClick={() =>
                  onSetModal({
                    ...modal,
                    page: Math.min(recoveryPageCount - 1, currentRecoveryPage + 1),
                  })
                }
              >
                ▶
              </button>
            </div>
            <p className={`${styles.interpreterMessage} ${styles.applianceRecoveryPrompt}`}>
              I didn&apos;t quite understand. What would you like to do?
            </p>
            <div className={`${styles.universalAskActions} ${styles.askAnswerActions} ${styles.applianceAskAnswerActions}`}>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => onRetryAsk(modal.question)}>
                I&apos;ll try rephrasing it
              </button>
              <button className={styles.modalButton} type="button" onClick={() => onEscalateAskRecovery(modal.question)}>
                Send this to Andrew
              </button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        <section className={`${styles.modalPanel} ${styles.askAnswerPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="recovery-title">You Asked</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <p className={`${styles.askedText} ${styles.askAnswerText} ${textSizeClass}`}>
            {recoveryPages[currentRecoveryPage] || modal.question}
          </p>
          <div className={styles.askAnswerReaderControls}>
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              disabled={currentRecoveryPage === 0}
              type="button"
              onClick={() =>
                onSetModal({
                  ...modal,
                  page: Math.max(0, currentRecoveryPage - 1),
                })
              }
            >
              ◀
            </button>
            <div className={styles.askAnswerSizeRow} aria-label="Text size">
              {[
                ["standard", "standard"],
                ["large", "large"],
                ["extra", "x-large"],
              ].map(([value, label]) => {
                const selected = messageTextSize === value;
                return (
                  <button
                    className={`${styles.readerSizeButton} ${selected ? styles.readerSizeButtonSelected : ""}`}
                    key={value}
                    type="button"
                    onClick={() => {
                      onMessageTextSizeChange(value as ReaderTextSize);
                      onSetModal({ ...modal, page: 0 });
                    }}
                  >
                    {selected ? label.toUpperCase() : label}
                  </button>
                );
              })}
            </div>
            <span className={styles.askAnswerPageIndicator}>
              {currentRecoveryPage + 1} / {recoveryPageCount}
            </span>
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              disabled={currentRecoveryPage >= recoveryPageCount - 1}
              type="button"
              onClick={() =>
                onSetModal({
                  ...modal,
                  page: Math.min(recoveryPageCount - 1, currentRecoveryPage + 1),
                })
              }
            >
              ▶
            </button>
          </div>
          <p className={styles.interpreterMessage}>I didn&apos;t quite understand. What would you like to do?</p>
          <div className={`${styles.universalAskActions} ${styles.askAnswerActions}`}>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => onRetryAsk(modal.question)}>
              I&apos;ll try rephrasing it
            </button>
            <button className={styles.modalButton} type="button" onClick={() => onEscalateAskRecovery(modal.question)}>
              Send this to Andrew
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (modal.type === "incomingCall") {
    const captionsOpen = modal.textView === "captions";
    const summaryOpen = modal.textView === "summary";
    const callTranscriptText =
      modal.transcriptText?.trim() ||
      receiverTranscriptStatusLabel(modal.transcriptStatus || "");
    const generatedSummaryText =
      modal.generatedSummaryText?.trim() || modal.summaryText?.trim() || "";
    const noCareSummaryNeeded = modal.summaryStatus === "not_needed";
    const callSummaryText =
      modal.summaryApproval === "approved"
        ? "Thank you - update submitted."
        : noCareSummaryNeeded
          ? "Nothing was transcribed that appears related to health, caregiving, appointments, or follow-up. If something important was missed, type only the care-relevant details below."
          : generatedSummaryText
            ? generatedSummaryText
            : modal.summaryStatus === "pending" || modal.summaryStatus === "pending_review"
            ? "CarePland is preparing the call summary. Keep this open for a moment, or close it and check again after the call record refreshes."
            : modal.summaryStatus === "expired_unreviewed"
              ? "This generated summary was not formally approved before the temporary transcript expired."
            : modal.summaryStatus === "failed" || modal.summaryStatus === "summary_failed"
              ? "A care summary could not be created yet. You can write one here if needed, or use Try Again when a temporary transcript is available."
              : "No care summary has been created yet. You can write one here if needed, using only care-relevant details from the call.";
    const summaryDraftText = noCareSummaryNeeded
      ? modal.summaryDraft || ""
      : stripCareSummaryHeading(modal.summaryDraft || generatedSummaryText);
    const summaryDraftPages = paginateReaderText(summaryDraftText, messageTextSize);
    const currentSummaryPage = Math.min(
      Math.max(0, modal.summaryPage ?? 0),
      Math.max(0, summaryDraftPages.length - 1)
    );
    const visibleSummaryDraftText =
      summaryDraftPages[currentSummaryPage] ?? summaryDraftText;
    const summaryStatusNotice =
      summaryOpen &&
      modal.summaryApproval !== "approved" &&
      (noCareSummaryNeeded || !generatedSummaryText)
        ? callSummaryText
        : undefined;
    const approvedDraftReady = summaryDraftText.trim().length > 0;
    if (!captionsOpen && !summaryOpen) {
      return null;
    }

    return (
      <div
        className={`${styles.modal} ${summaryOpen ? styles.callTextModal : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={summaryOpen ? "call-summary-title" : "call-captions-title"}
      >
        <section className={`${styles.modalPanel} ${styles.incomingCallModal}`}>
          <CallTextView
            actions={
              summaryOpen ? (
                <>
                  <p className={styles.callSummaryInstruction}>
                    Please make any optional changes and approve the Call Summary.
                  </p>
                  <div className={styles.callSummaryPageControls} aria-label="Care summary page navigation">
                    <button
                      className={`${styles.modalButton} ${styles.secondary}`}
                      disabled={currentSummaryPage <= 0}
                      type="button"
                      onClick={() =>
                        onSetModal({
                          ...modal,
                          summaryPage: Math.max(0, currentSummaryPage - 1),
                        })
                      }
                    >
                      &lt;
                    </button>
                    <span>{currentSummaryPage + 1} / {summaryDraftPages.length}</span>
                    <button
                      className={`${styles.modalButton} ${styles.secondary}`}
                      disabled={currentSummaryPage >= summaryDraftPages.length - 1}
                      type="button"
                      onClick={() =>
                        onSetModal({
                          ...modal,
                          summaryPage: Math.min(
                            summaryDraftPages.length - 1,
                            currentSummaryPage + 1
                          ),
                        })
                      }
                    >
                      &gt;
                    </button>
                  </div>
                  <button
                    className={styles.modalButton}
                    disabled={
                      modal.summaryApproval === "approved" ||
                      (!approvedDraftReady && !noCareSummaryNeeded)
                    }
                    type="button"
                    onClick={() => {
                      void onApproveCallSummary(modal.callId);
                    }}
                  >
                    {modal.summaryApproval === "approved"
                      ? "Approved"
                      : "Approve this version"}
                  </button>
                </>
              ) : null
            }
            closeLabel="Close Call"
            editableLabel={summaryOpen ? "Care Summary" : undefined}
            editablePlaceholder={
              summaryOpen && noCareSummaryNeeded ? "Add details about this call" : undefined
            }
            editableStatusText={summaryStatusNotice}
            editableText={
              summaryOpen && modal.summaryApproval !== "approved"
                ? visibleSummaryDraftText
                : undefined
            }
            messageTextSize={messageTextSize}
            onClose={() => {
              if (
                summaryOpen &&
                modal.summaryApproval !== "approved" &&
                modal.callId &&
                summaryDraftText !== String(modal.summaryDraftSavedText || "")
              ) {
                void onSaveCallSummaryDraft(modal.callId, summaryDraftText);
              }
              onSetModal(summaryOpen ? null : { ...modal, textView: undefined });
            }}
            onEditableTextChange={
              summaryOpen && modal.summaryApproval !== "approved"
                ? (value) =>
                    onSetModal({
                      ...modal,
                      summaryDraft: replacePaginatedTextPage(
                        summaryDraftPages,
                        currentSummaryPage,
                        value
                      ),
                    })
                : undefined
            }
            onMessageTextSizeChange={onMessageTextSizeChange}
            policyNotice={undefined}
            text={summaryOpen ? callSummaryText : callTranscriptText}
            title={summaryOpen ? "Call Summary" : "Closed Captioning"}
          />
        </section>
      </div>
    );
  }

  if (modal.type === "appointmentsLoading") {
    if (applianceMode) {
      return (
        <div className={`${styles.modal} ${styles.applianceFullscreenModal}`} role="dialog" aria-modal="true" aria-labelledby="appointments-loading-title">
          <section className={`${styles.modalPanel} ${styles.applianceListPanel}`}>
            <div className={styles.applianceListToolbar}>
              <h2 id="appointments-loading-title">Appointments</h2>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
                Go Home
              </button>
            </div>
            <p className={styles.applianceEmptyText}>Looking for appointments.</p>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="appointments-loading-title">
        <section className={styles.modalPanel}>
          <div className={styles.modalTitleRow}>
            <h2 id="appointments-loading-title">Appointments</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <p className={styles.readerText}>Looking for your appointments.</p>
        </section>
      </div>
    );
  }

  if (modal.type === "appointmentsEmpty") {
    if (applianceMode) {
      return (
        <div className={`${styles.modal} ${styles.applianceFullscreenModal}`} role="dialog" aria-modal="true" aria-labelledby="appointments-empty-title">
          <section className={`${styles.modalPanel} ${styles.applianceListPanel}`}>
            <div className={styles.applianceListToolbar}>
              <h2 id="appointments-empty-title">Appointments</h2>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
                Go Home
              </button>
            </div>
            <p className={styles.applianceEmptyText}>No upcoming appointments were found.</p>
            <div className={styles.appliancePageControls} aria-label="Appointments page controls">
              <button className={`${styles.modalButton} ${styles.secondary}`} disabled type="button">
                ◀
              </button>
              <span>1 / 1</span>
              <button className={`${styles.modalButton} ${styles.secondary}`} disabled type="button">
                ▶
              </button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="appointments-empty-title">
        <section className={styles.modalPanel}>
          <div className={styles.modalTitleRow}>
            <h2 id="appointments-empty-title">Appointments</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <p className={styles.readerText}>No upcoming appointments were found.</p>
        </section>
      </div>
    );
  }

  if (modal.type === "appointmentsList") {
    const appointmentPages = paginateAppointments(modal.appointments);
    const pageCount = appointmentPages.length;
    const currentPage = Math.min(Math.max(modal.page, 0), Math.max(pageCount - 1, 0));
    const pageAppointments = appointmentPages[currentPage] ?? [];
    const hasAppointmentPaging = pageCount > 1;
    const currentPageCost = pageAppointments.reduce(
      (total, appointment) => total + appointmentChoiceLineCost(appointment),
      0
    );
    const shouldStretchAppointments = pageAppointments.length >= 4 && currentPageCost <= 5;
    const cacheNotice = modal.cachedAt
      ? `Last updated ${formatReceiverCacheTimestamp(modal.cachedAt)}`
      : "";

    if (applianceMode) {
      return (
        <div className={`${styles.modal} ${styles.applianceFullscreenModal}`} role="dialog" aria-modal="true" aria-labelledby="appointments-list-title">
          <section className={`${styles.modalPanel} ${styles.applianceListPanel}`}>
            <div className={styles.applianceListToolbar}>
              <h2 id="appointments-list-title">Appointments</h2>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
                Go Home
              </button>
            </div>
            {cacheNotice ? <p className={styles.cachedAppointmentNotice}>{cacheNotice}</p> : null}
            <div className={`${styles.appointmentList} ${styles.applianceAppointmentList}`}>
              {pageAppointments.map((appointment) => (
                <button
                  className={styles.appointmentChoice}
                  key={appointment.id}
                  type="button"
                  onClick={() =>
                    onSetModal({
                      type: "appointmentDetail",
                      appointment,
                      appointments: modal.appointments,
                      cachedAt: modal.cachedAt,
                      page: currentPage,
                    })
                  }
                >
                  <strong>{appointment.title || "Appointment"}</strong>
                  <span>{appointmentDateTimeLabel(appointment)}</span>
                </button>
              ))}
            </div>
            <div className={styles.appliancePageControls} aria-label="Appointments page controls">
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                disabled={currentPage === 0}
                type="button"
                onClick={() =>
                  onSetModal({
                    type: "appointmentsList",
                    appointments: modal.appointments,
                    cachedAt: modal.cachedAt,
                    page: Math.max(0, currentPage - 1),
                  })
                }
              >
                ◀
              </button>
              <span>
                {currentPage + 1} / {pageCount}
              </span>
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                disabled={currentPage >= pageCount - 1}
                type="button"
                onClick={() =>
                  onSetModal({
                    type: "appointmentsList",
                    appointments: modal.appointments,
                    cachedAt: modal.cachedAt,
                    page: Math.min(pageCount - 1, currentPage + 1),
                  })
                }
              >
                ▶
              </button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="appointments-list-title">
        <section className={`${styles.modalPanel} ${styles.appointmentChooserPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="appointments-list-title">Which appointment?</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          {cacheNotice ? <p className={styles.cachedAppointmentNotice}>{cacheNotice}</p> : null}
          <div
            className={`${styles.appointmentList} ${
              shouldStretchAppointments ? styles.appointmentListStretch : ""
            }`}
          >
            {pageAppointments.map((appointment) => (
              <button
                className={styles.appointmentChoice}
                key={appointment.id}
                type="button"
                onClick={() =>
                  onSetModal({
                    type: "appointmentDetail",
                    appointment,
                    appointments: modal.appointments,
                    cachedAt: modal.cachedAt,
                    page: currentPage,
                  })
                }
              >
                <strong>{appointment.title || "Appointment"}</strong>
              </button>
            ))}
          </div>
          {hasAppointmentPaging ? (
            <div className={styles.appointmentPager}>
              <button
                className={`${styles.messageAction} ${styles.messageNavButton}`}
                disabled={currentPage === 0}
                type="button"
                onClick={() =>
                  onSetModal({
                    type: "appointmentsList",
                    appointments: modal.appointments,
                    cachedAt: modal.cachedAt,
                    page: Math.max(0, currentPage - 1),
                  })
                }
              >
                Previous
              </button>
              <button
                className={`${styles.messageAction} ${styles.messageNavButton}`}
                disabled={currentPage >= pageCount - 1}
                type="button"
                onClick={() =>
                  onSetModal({
                    type: "appointmentsList",
                    appointments: modal.appointments,
                    cachedAt: modal.cachedAt,
                    page: Math.min(pageCount - 1, currentPage + 1),
                  })
                }
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  if (modal.type === "appointmentDetail") {
    const hasAddress = Boolean(modal.appointment.locationAddress);
    const cacheNotice = modal.cachedAt
      ? `Last updated ${formatReceiverCacheTimestamp(modal.cachedAt)}`
      : "";

    if (applianceMode) {
      return (
        <div className={`${styles.modal} ${styles.applianceFullscreenModal}`} role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title">
          <section className={`${styles.modalPanel} ${styles.applianceAppointmentDetailPanel}`}>
            <div className={styles.applianceListToolbar}>
              <h2 id="appointment-detail-title">Appointment</h2>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
                Done
              </button>
            </div>
            <section className={`${styles.appointmentDetail} ${styles.applianceAppointmentDetail}`}>
              <h3>{modal.appointment.title || "Appointment"}</h3>
              {cacheNotice ? <p className={styles.cachedAppointmentNotice}>{cacheNotice}</p> : null}
              <p className={styles.appointmentTime}>{appointmentDateTimeLabel(modal.appointment)}</p>
              {appointmentSubtitle(modal.appointment) ? <p>{appointmentSubtitle(modal.appointment)}</p> : null}
              {modal.appointment.locationName ? <p>{modal.appointment.locationName}</p> : null}
              {modal.appointment.reason ? <p>{modal.appointment.reason}</p> : null}
            </section>
            <div className={styles.applianceAppointmentActions}>
              {hasAddress ? (
                <button
                  className={`${styles.modalButton} ${styles.blue}`}
                  type="button"
                  onClick={() =>
                    onSetModal({
                      type: "appointmentAddress",
                      appointment: modal.appointment,
                      appointments: modal.appointments,
                      cachedAt: modal.cachedAt,
                      page: modal.page,
                    })
                  }
                >
                  Where is it?
                </button>
              ) : null}
              <button
                className={`${styles.modalButton} ${styles.secondary} ${styles.appointmentDoneAction}`}
                type="button"
                onClick={() =>
                  onSetModal({
                    type: "appointmentsList",
                    appointments: modal.appointments,
                    cachedAt: modal.cachedAt,
                    page: modal.page,
                  })
                }
              >
                More Appointments
              </button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title">
        <section className={styles.modalPanel}>
          <div className={styles.modalTitleRow}>
            <h2 id="appointment-detail-title">Appointment</h2>
          </div>
          <section className={styles.appointmentDetail}>
            <h3>{modal.appointment.title || "Appointment"}</h3>
            {cacheNotice ? <p className={styles.cachedAppointmentNotice}>{cacheNotice}</p> : null}
            <p className={styles.appointmentTime}>{appointmentDateTimeLabel(modal.appointment)}</p>
            {appointmentSubtitle(modal.appointment) ? <p>{appointmentSubtitle(modal.appointment)}</p> : null}
            {modal.appointment.locationName ? <p>{modal.appointment.locationName}</p> : null}
            {modal.appointment.reason ? <p>{modal.appointment.reason}</p> : null}
          </section>
          {hasAddress ? (
            <button
              className={`${styles.modalButton} ${styles.blue}`}
              type="button"
              onClick={() =>
                onSetModal({
                  type: "appointmentAddress",
                  appointment: modal.appointment,
                  appointments: modal.appointments,
                  cachedAt: modal.cachedAt,
                  page: modal.page,
                })
              }
            >
              Where is it?
            </button>
          ) : null}
          <button className={`${styles.modalButton} ${styles.secondary} ${styles.appointmentDoneAction}`} type="button" onClick={onClose}>
            Done
          </button>
        </section>
      </div>
    );
  }

  if (modal.type === "appointmentAddress") {
    const cacheNotice = modal.cachedAt
      ? `Last updated ${formatReceiverCacheTimestamp(modal.cachedAt)}`
      : "";

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="appointment-address-title">
        <section className={styles.modalPanel}>
          <div className={styles.modalTitleRow}>
            <h2 id="appointment-address-title">Where is it?</h2>
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              type="button"
              onClick={() =>
                onSetModal({
                  type: "appointmentDetail",
                  appointment: modal.appointment,
                  appointments: modal.appointments,
                  cachedAt: modal.cachedAt,
                  page: modal.page,
                })
              }
            >
              Go Back
            </button>
          </div>
          {cacheNotice ? <p className={styles.cachedAppointmentNotice}>{cacheNotice}</p> : null}
          <p className={styles.readerText}>
            {modal.appointment.locationAddress || "No address is saved for this appointment."}
          </p>
          {modal.appointment.locationPhone ? (
            <p className={styles.appointmentPhone}>{modal.appointment.locationPhone}</p>
          ) : null}
        </section>
      </div>
    );
  }

  if (modal.type === "soundSettings") {
    const showVolumeControls = soundSettings.retroSounds && soundSettings.buttonBeeps;
    const soundProblemOptions = [
      { label: "No Beeps", problem: "speech_only" },
      { label: "Faint Beeps", problem: "faint_beep" },
      { label: "No Ring Sounds", problem: "no_ringers" },
      { label: "No Optional Sounds", problem: "none" },
    ] as const;
    const soundActionLabels = {
      enable_sounds: "Turn Optional Sounds On",
      set_volume_high: "Set Volume High",
    };

    return (
      <div
        className={`${styles.modal} ${applianceMode ? styles.applianceFullscreenModal : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sound-title"
      >
        <section
          className={`${styles.modalPanel} ${styles.soundPanel} ${
            applianceMode ? styles.applianceSoundPanel : ""
          }`}
        >
          <div
            className={`${styles.modalTitleRow} ${
              modal.view === "help" ? styles.soundTestTitleRow : styles.soundSettingsTitleRow
            }`}
          >
            <h2 id="sound-title">
              {modal.view === "help" ? "Test Sounds" : "Optional Sounds"}
            </h2>
            {modal.view === "help" ? (
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                type="button"
                onClick={() => {
                  onResetSoundTestState();
                  onSetModal({ type: "soundSettings", view: "settings" });
                }}
              >
                Go Back
              </button>
            ) : null}
            <button
              className={`${styles.modalButton} ${styles.secondary} ${styles.soundHomeButton}`}
              type="button"
              onClick={onClose}
            >
              Go Home
            </button>
            {modal.view === "help" ? (
              <button
                className={`${styles.modalButton} ${styles.soundHeaderRunButton}`}
                data-receiver-no-beep="true"
                type="button"
                onClick={onTestSound}
              >
                Run Test
              </button>
            ) : null}
          </div>
          {modal.view === "settings" ? (
            <>
              <p className={styles.settingsCopy}>
                These sounds give helpful feedback but are not required.
              </p>
              <div className={styles.soundToggleGrid}>
                <SoundToggleRow
                  label="Retro Sounds"
                  onToggle={(value) => onUpdateSoundSetting("retroSounds", value)}
                  value={soundSettings.retroSounds}
                />
                <SoundToggleRow
                  label="Retro Ringers"
                  onToggle={(value) => onUpdateSoundSetting("retroRingers", value)}
                  value={soundSettings.retroRingers}
                />
                <SoundToggleRow
                  label="Button Beeps"
                  onToggle={(value) => onUpdateSoundSetting("buttonBeeps", value)}
                  value={soundSettings.buttonBeeps}
                />
              </div>
              {showVolumeControls ? (
                <div className={styles.soundSettingGroup}>
                  <strong>Volume</strong>
                  <div className={`${styles.soundChoiceRow} ${styles.soundVolumeRow}`}>
                    {(["low", "med", "high"] as const).map((value) => (
                      <button
                        className={`${styles.soundChoice} ${
                          soundSettings.comfortVolume === value ? styles.soundChoiceSelected : ""
                        }`}
                        key={value}
                        type="button"
                        onClick={() => onUpdateSoundSetting("comfortVolume", value)}
                      >
                        {soundSettings.comfortVolume === value ? value.toUpperCase() : value}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className={styles.soundFixRow}>
                <p>Having problems with optional sounds?</p>
                <button
                  className={`${styles.modalButton} ${styles.gold}`}
                  type="button"
                  onClick={() => onSetModal({ type: "soundSettings", view: "help" })}
                >
                  Fix Sounds
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.soundTestIntro}>
                <ul className={styles.soundHelpPanel}>
                  <li>Button beeps and retro sounds are optional.</li>
                  <li>Speech can work even if these sounds are quiet.</li>
                  <li>Use device volume buttons while this screen is open.</li>
                </ul>
              </div>
              {soundDiagnostic ? <p className={styles.diagnosticText}>{soundDiagnostic}</p> : null}
              <div className={styles.soundProblemGrid}>
                <p>Problem:</p>
                <div className={styles.soundProblemChoices}>
                  {soundProblemOptions.map(({ label, problem }) => (
                    <button
                      className={`${styles.soundChoice} ${styles.soundProblemChoice} ${
                        selectedSoundProblem === problem ? styles.soundProblemChoiceSelected : ""
                      }`}
                      key={label}
                      type="button"
                      onClick={() => onReportSoundProblem(problem)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <section
                className={`${styles.soundHelpRecipe} ${
                  soundHelp ? "" : styles.soundHelpRecipePlaceholder
                }`}
                aria-hidden={soundHelp ? undefined : "true"}
                aria-live={soundHelp ? "polite" : undefined}
              >
                {soundHelp ? (
                  <>
                  <h3>{soundHelp.title}</h3>
                  <ol>
                    {soundHelp.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {soundHelp.actions?.length ? (
                    <div className={styles.soundHelpActions}>
                      {soundHelp.actions.map((action) => (
                        <button
                          className={`${styles.soundChoice} ${styles.soundChoiceSelected}`}
                          key={action}
                          type="button"
                          onClick={() => onApplySoundHelpAction(action)}
                        >
                          {soundActionLabels[action]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className={styles.soundHelpActions}>
                    <button
                      className={styles.soundChoice}
                      data-receiver-no-beep="true"
                      type="button"
                      onClick={onTestSound}
                    >
                      Run Test
                    </button>
                    <button className={styles.soundChoice} type="button" onClick={onResolveSoundHelp}>
                      This Fixed It
                    </button>
                  </div>
                  </>
                ) : null}
              </section>
              <dl className={styles.soundContext}>
                <div>
                  <dt>Device</dt>
                  <dd>{detectedDeviceType()}</dd>
                </div>
                <div>
                  <dt>Browser</dt>
                  <dd>{detectedBrowserLabel()}</dd>
                </div>
                <div>
                  <dt>App mode</dt>
                  <dd>{detectedAppMode()}</dd>
                </div>
                <div>
                  <dt>Last test</dt>
                  <dd>{lastSoundTestResult}</dd>
                </div>
                <div>
                  <dt>Sound permission</dt>
                  <dd>No browser sound permission is exposed</dd>
                </div>
              </dl>
            </>
          )}
        </section>
      </div>
    );
  }

  if (modal.type === "reader") {
    const textSizeClass =
      messageTextSize === "standard"
        ? styles.readerTextStandard
        : messageTextSize === "extra"
          ? styles.readerTextExtra
          : styles.readerTextLarge;
    const readerPage = Math.min(readerPageIndex, readerPages.length - 1);
    const hasReaderPaging = readerPages.length > 1;
    const isPlayingMessage = playingMessageId === modal.message.id;
    const hasAudio = Boolean(modal.message.audioUrl);
    const hasPlayedMessage = Boolean(playedMessageIds[modal.message.id]);
    const hasPlayedAllComparisonVersions =
      Boolean(playedComparisonVariants.original) &&
      Boolean(playedComparisonVariants.version1) &&
      Boolean(playedComparisonVariants.version2);
    const playLabel = isPlayingMessage
      ? "■ Stop"
      : hasPlayedMessage
        ? "▶ Play Again"
        : "▶ Play";
    const autoHearAction =
      autoHearPreference === "on"
        ? "When opened, messages will play sound automatically."
        : "When opened, messages will not play sound automatically.";
    const readerReturnsToAllMessages = modal.returnTo === "allMessages";

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="reader-title">
        <section className={`${styles.modalPanel} ${styles.readerPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 className={styles.readerTitle} id="reader-title">
              {messageHeader(modal.message)}
            </h2>
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              type="button"
              onClick={() => {
                if (readerReturnsToAllMessages) {
                  onSetModal({ type: "allMessages", page: modal.returnPage ?? 0 });
                  return;
                }
                onClose();
              }}
            >
              {readerReturnsToAllMessages ? "Go Back" : "Go Home"}
            </button>
          </div>
          <div className={styles.messageBodySlot}>
            <div className={styles.readerSizeRow} aria-label="Message text size">
              {[
                ["standard", "Standard"],
                ["large", "Large"],
                ["extra", "Extra Large"],
              ].map(([value, label]) => {
                const selected = messageTextSize === value;
                return (
                  <button
                    className={`${styles.readerSizeButton} ${selected ? styles.readerSizeButtonSelected : ""}`}
                    key={value}
                    type="button"
                    onClick={() => onMessageTextSizeChange(value as ReaderTextSize)}
                  >
                    {selected ? label.toUpperCase() : label}
                  </button>
                );
              })}
            </div>
            <p className={`${styles.readerText} ${textSizeClass}`}>{readerPages[readerPage]}</p>
            {hasReaderPaging ? (
              <div className={styles.readerPageControls} aria-label="Message page controls">
                <button
                  className={`${styles.modalButton} ${styles.secondary}`}
                  disabled={readerPage === 0}
                  type="button"
                  onClick={() =>
                    setReaderPageState({
                      index: Math.max(0, readerPage - 1),
                      key: readerPageKey,
                    })
                  }
                >
                  ◀
                </button>
                <span>
                  {readerPage + 1} / {readerPages.length}
                </span>
                <button
                  className={`${styles.modalButton} ${styles.secondary}`}
                  disabled={readerPage >= readerPages.length - 1}
                  type="button"
                  onClick={() =>
                    setReaderPageState({
                      index: Math.min(readerPages.length - 1, readerPage + 1),
                      key: readerPageKey,
                    })
                  }
                >
                  ▶
                </button>
              </div>
            ) : null}
            {hearingFeedbackStep ? (
              <div className={styles.messageFeedbackOverlay}>
                {hearingFeedbackStep === "choice" ? (
                  <section className={styles.messageFeedbackPanel}>
                    <p>We can try making it easier to hear.</p>
                    <p>This will also help make future messages easier to hear.</p>
                    <p>Would you mind listening to three versions?</p>
                    <div className={styles.messageDetailActions}>
                      <button
                        className={`${styles.modalButton} ${styles.blue}`}
                        type="button"
                        onClick={() => setHearingFeedbackStep("compare")}
                      >
                        Yes
                      </button>
                      <button
                        className={`${styles.modalButton} ${styles.secondary}`}
                        type="button"
                        onClick={() => setHearingFeedbackStep(null)}
                      >
                        Not now
                      </button>
                    </div>
                  </section>
                ) : null}
                {hearingFeedbackStep === "compare" ? (
                  <section className={styles.messageFeedbackPanel}>
                    <div className={styles.messageVersionCompare}>
                      {comparisonVersions.map(({ choice, variant }, index) => (
                        <div className={styles.messageVersionColumn} key={choice}>
                          <button
                            className={`${styles.modalButton} ${styles.blue}`}
                            type="button"
                            onClick={() => {
                              setPlayedMessageIds((current) => ({ ...current, [modal.message.id]: true }));
                              setPlayedComparisonVariants((current) => ({ ...current, [variant]: true }));
                              void onPlayMessage(modal.message, variant as PlaybackVariant, true);
                            }}
                          >
                            ▶ Play Version {index + 1}
                          </button>
                          <button
                            className={`${styles.modalButton} ${styles.secondary}`}
                            disabled={!playedComparisonVariants[variant]}
                            type="button"
                            onClick={() => {
                              onRecordHearingFeedback(modal.message, choice);
                              setHearingFeedbackStep("thanks");
                            }}
                          >
                            I prefer this
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className={styles.messageFeedbackChoices}>
                      {[
                        ["same", "They sounded the same."],
                      ].map(([choice, label]) => (
                        <button
                          className={`${styles.modalButton} ${styles.secondary}`}
                          disabled={!hasPlayedAllComparisonVersions}
                          key={choice}
                          type="button"
                          onClick={() => {
                            onRecordHearingFeedback(modal.message, choice);
                            setHearingFeedbackStep("thanks");
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
                {hearingFeedbackStep === "thanks" ? (
                  <section className={styles.messageFeedbackPanel}>
                    <p>Thank you.</p>
                    <p>We&apos;ll use this to help make future messages easier to hear.</p>
                    <button
                      className={`${styles.modalButton} ${styles.secondary} ${styles.messageFeedbackOkay}`}
                      type="button"
                      onClick={() => setHearingFeedbackStep(null)}
                    >
                      Okay
                    </button>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className={styles.messageDetailActions}>
            {hasAudio ? (
              <button
                className={`${styles.modalButton} ${isPlayingMessage ? styles.stopPlaybackAction : styles.blue}`}
                type="button"
                onClick={() => {
                  setPlayedMessageIds((current) => ({ ...current, [modal.message.id]: true }));
                  void onPlayMessage(modal.message, "default", !isPlayingMessage);
                }}
              >
                {playLabel}
              </button>
            ) : null}
            <button
              className={`${styles.modalButton} ${styles.callBackAction}`}
              type="button"
              onClick={() => onCallBackForMessage(modal.message)}
            >
              Call Back
            </button>
          </div>
          {hasAudio ? (
            <button
              className={styles.messagePreferenceAction}
              type="button"
              onClick={onToggleAutoHearPreference}
            >
              {autoHearAction}
            </button>
          ) : null}
          {hasAudio && !hearingFeedbackStep ? (
            <button
              className={styles.messagePreferenceAction}
              type="button"
              onClick={() => setHearingFeedbackStep("choice")}
            >
              The words were hard to hear.
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  if (modal.type === "allMessages") {
    const listSizeClass =
      messageTextSize === "standard"
        ? styles.allMessagesStandard
        : messageTextSize === "extra"
          ? styles.allMessagesExtra
          : styles.allMessagesLarge;
    const emptyTextSizeClass =
      messageTextSize === "standard"
        ? styles.readerTextStandard
        : messageTextSize === "extra"
          ? styles.readerTextExtra
          : styles.readerTextLarge;
    const allMessagesPageSize = messageTextSize === "standard" ? 4 : messageTextSize === "extra" ? 2 : 3;
    const allMessagesPageCount = Math.max(1, Math.ceil(messages.length / allMessagesPageSize));
    const currentAllMessagesPage = Math.min(Math.max(modal.page, 0), allMessagesPageCount - 1);
    const visibleMessages = messages.slice(
      currentAllMessagesPage * allMessagesPageSize,
      currentAllMessagesPage * allMessagesPageSize + allMessagesPageSize
    );

    if (applianceMode) {
      return (
        <div className={`${styles.modal} ${styles.applianceFullscreenModal}`} role="dialog" aria-modal="true" aria-labelledby="all-messages-title">
          <section className={`${styles.modalPanel} ${styles.applianceListPanel}`}>
            <div className={styles.applianceListToolbar}>
              <h2 id="all-messages-title">Messages</h2>
              <div className={styles.applianceReaderSizeRow} aria-label="Message text size">
                {[
                  ["standard", "Standard"],
                  ["large", "Large"],
                  ["extra", "X-Large"],
                ].map(([value, label]) => {
                  const selected = messageTextSize === value;
                  return (
                    <button
                      className={`${styles.readerSizeButton} ${selected ? styles.readerSizeButtonSelected : ""}`}
                      key={value}
                      type="button"
                      onClick={() => onMessageTextSizeChange(value as ReaderTextSize)}
                    >
                      {selected ? label.toUpperCase() : label}
                    </button>
                  );
                })}
              </div>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
                Go Home
              </button>
            </div>
            <div className={`${styles.allMessagesList} ${styles.applianceMessageList} ${listSizeClass}`}>
              {visibleMessages.length ? (
                visibleMessages.map((message) => (
                  <button
                    className={styles.allMessageRow}
                    key={message.id}
                    type="button"
                    onClick={() => {
                      onOpenMessageFromAllMessages(message, currentAllMessagesPage);
                    }}
                  >
                    <strong>{messageHeader(message)}</strong>
                    <span>{messageText(message)}</span>
                  </button>
                ))
              ) : (
                <p className={`${styles.applianceEmptyText} ${emptyTextSizeClass}`}>No messages yet.</p>
              )}
            </div>
            <div className={styles.appliancePageControls} aria-label="All messages page controls">
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                disabled={currentAllMessagesPage === 0}
                type="button"
                onClick={() =>
                  onSetModal({
                    type: "allMessages",
                    page: Math.max(0, currentAllMessagesPage - 1),
                  })
                }
              >
                ◀
              </button>
              <span>
                {currentAllMessagesPage + 1} / {allMessagesPageCount}
              </span>
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                disabled={currentAllMessagesPage >= allMessagesPageCount - 1}
                type="button"
                onClick={() =>
                  onSetModal({
                    type: "allMessages",
                    page: Math.min(allMessagesPageCount - 1, currentAllMessagesPage + 1),
                  })
                }
              >
                ▶
              </button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="all-messages-title">
        <section className={`${styles.modalPanel} ${styles.allMessagesPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="all-messages-title">All Messages</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <div className={styles.readerSizeRow} aria-label="Message text size">
            {[
              ["standard", "Standard"],
              ["large", "Large"],
              ["extra", "Extra Large"],
            ].map(([value, label]) => {
              const selected = messageTextSize === value;
              return (
                <button
                  className={`${styles.readerSizeButton} ${selected ? styles.readerSizeButtonSelected : ""}`}
                  key={value}
                  type="button"
                  onClick={() => onMessageTextSizeChange(value as ReaderTextSize)}
                >
                  {selected ? label.toUpperCase() : label}
                </button>
              );
            })}
          </div>
          <div className={`${styles.allMessagesList} ${listSizeClass}`}>
            {visibleMessages.length ? (
              visibleMessages.map((message) => (
                <button
                  className={styles.allMessageRow}
                  key={message.id}
                  type="button"
                  onClick={() => {
                    onOpenMessageFromAllMessages(message, currentAllMessagesPage);
                  }}
                >
                  <strong>{messageHeader(message)}</strong>
                  <span>{messageText(message)}</span>
                </button>
              ))
            ) : (
              <p className={`${styles.readerText} ${emptyTextSizeClass}`}>No messages yet.</p>
            )}
          </div>
          <div className={styles.readerPageControls} aria-label="All messages page controls">
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              disabled={currentAllMessagesPage === 0}
              type="button"
              onClick={() =>
                onSetModal({
                  type: "allMessages",
                  page: Math.max(0, currentAllMessagesPage - 1),
                })
              }
            >
              ◀
            </button>
            <span>
              {currentAllMessagesPage + 1} / {allMessagesPageCount}
            </span>
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              disabled={currentAllMessagesPage >= allMessagesPageCount - 1}
              type="button"
              onClick={() =>
                onSetModal({
                  type: "allMessages",
                  page: Math.min(allMessagesPageCount - 1, currentAllMessagesPage + 1),
                })
              }
            >
              ▶
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (applianceMode) {
    return (
      <div className={`${styles.modal} ${styles.applianceFullscreenModal}`} role="dialog" aria-modal="true" aria-labelledby="sent-title">
        <section className={`${styles.modalPanel} ${styles.applianceListPanel} ${styles.applianceSentPanel}`}>
          <div className={styles.applianceListToolbar}>
            <h2 id="sent-title">Message Sent</h2>
            <span aria-hidden="true" />
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <p className={styles.applianceSentText}>Your message was sent to {modal.recipientName}.</p>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="sent-title">
      <section className={styles.modalPanel}>
        <div className={styles.modalTitleRow}>
          <h2 id="sent-title">Message Sent</h2>
          <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
            Go Home
          </button>
        </div>
        <p className={styles.readerText}>Your message was sent to {modal.recipientName}.</p>
      </section>
    </div>
  );
}
