"use client";

import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
  type ConnectAudioRecordingChunk,
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
import { LongOperationStatus } from "../../shared/LongOperationStatus";
import {
  createConnectCallAudioController,
  type ConnectCallAudioStatus,
  type ConnectCallAudioController,
} from "../../../lib/connect/calls/browserCallAudio";
import { recordConnectCallLifecycleEvent } from "../../../lib/connect/calls/browserCallDiagnostics";
import {
  receiverCallRecordStateIsActive,
  receiverCallRecordStateIsTerminal,
  receiverCallUiStateFromRecordState,
  type ReceiverCallUiState,
} from "../../../lib/connect/calls/receiverCallUiState";
import {
  connectPrototypeEndpoints,
  connectPrototypeReceiverId,
} from "../../../lib/connect/prototypeClient";
import {
  createObservation,
  submitObservation,
  type ObservationModality,
} from "../../../lib/platform/ai/observationPipeline";
import {
  interpretReceiverAskObservation,
  type ReceiverAskAnswer,
} from "../../../lib/platform/ai/receiverAskInterpreter";
import {
  interpretReceiverTalkObservation,
  receiverTalkShouldHandleText,
  serializeReceiverTalkResult,
} from "../../../lib/platform/ai/receiverTalkInterpreter";
import { condenseReceiverSpeechMessage } from "../../../lib/platform/ai/messageCondensation";
import {
  browserReceiverShouldRequestPairing,
  formatBrowserReceiverPairingCode,
} from "../../../lib/connect/receiverShell/browserPairing";
import { adminItemsVisibilityStorageKey } from "../../../lib/platform/adminItemsVisibility";
import { carePlandSignInPath } from "../../../lib/platform/authRedirect";
import {
  reportSessionLossFromResponse,
  sessionValidityStore,
  type SessionValiditySnapshot,
} from "../../../lib/platform/sessionValidity";
import {
  recordHelpDiagnosticsEvent,
  submitHelpDiagnostics,
} from "../../../lib/platform/helpDiagnostics";
import {
  formatReceiverCacheTimestamp,
  readReceiverAppointmentCache,
  receiverConnectivityStatusLabel,
  receiverOfflineActionMessage,
  writeReceiverAppointmentCache,
  type ReceiverAppointmentCacheEntry,
} from "../../../lib/connect/receiver/offlineAppointmentCache";
import {
  connectCallsDeprecated,
  connectReceiverGuideDeprecated,
  connectPollingIntervals,
  connectPollingIntervalMs,
  recordConnectPollingRequest,
} from "../../../lib/connect/receiver/pollingPolicy";
import styles from "./ConnectReceiver.module.css";

const receiverSessionValidityServerSnapshot: SessionValiditySnapshot = {
  duplicateLossCount: 0,
  reason: "",
  returnTo: "",
  state: "authenticated",
  surface: "shared",
};

type Contact = {
  id: string;
  displayName: string;
  availability: "free" | "busy" | "away";
  availabilityLabel: string;
  canCall: boolean;
  disabledReason?: string;
  userId?: string;
};

type ReceiverUser = {
  id: string;
  displayName: string;
  statusLabel: string;
};

type ReceiverTalkOperation = {
  draftLength: number;
  id: string;
  modality: ObservationModality;
  requestLifecycle: string;
  stage: "transcribing" | "processing" | "condensing";
  surface: "ask" | "ask_tell";
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
  trackEventId?: string | null;
};

type Message = {
  acknowledgedAt?: string;
  allowsCallbackRequest?: boolean;
  audioArtifactId?: string;
  audioDurationMs?: number;
  audioMimeType?: string;
  audioUrl?: string;
  id: string;
  from: string;
  to: string;
  body: string;
  callbackRequestedAt?: string;
  createdAt: string;
  heardAt?: string;
  mainConnectUserPersonId?: string;
  messageType?: string;
  readAt?: string;
  requiresAcknowledgement?: boolean;
  transcript?: string;
  transcriptStatus?: string;
};

type ReceiverCall = {
  approvedSummaryText?: string;
  callId: string;
  callerName: string;
  generatedSummaryText?: string;
  receiverId?: string;
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
      kind: "new_message";
      label: "Message";
      priority: number;
      message: Message;
    };

type ReceiverAttemptDiagnosticEntry = {
  at: string;
  detail: string;
  id: string;
  label: string;
};

type ReceiverAttemptDiagnosticSummary = {
  attemptId: string;
  completedAt: string;
  latestObservationId: string;
  outcome: string;
  revisionCount: number;
  startedAt: string;
  status: "idle" | "in_progress" | "completed";
  surface: string;
};

type ReceiverAttemptTraceRevision = {
  askCapabilityStatus: string;
  askEntities: string;
  askIntent: string;
  askIntentConfidence: string;
  askTemporalReferences: string;
  family: string;
  familyConfidence: string;
  interpreter: string;
  normalizedText: string;
  observationId: string;
  parentObservationId: string;
  platformEntries: ReceiverAttemptDiagnosticEntry[];
  reason: string;
  response: string;
  result: string;
  revisionNumber: number;
  route: string;
  rawEntries: ReceiverAttemptDiagnosticEntry[];
  userActions: ReceiverAttemptDiagnosticEntry[];
  userText: string;
};

type ReceiverAttemptTraceStory = {
  familyEvolution: string[];
  finalOutcome: string;
  finalResponse: string;
  finalRevision: ReceiverAttemptTraceRevision | null;
  revisions: ReceiverAttemptTraceRevision[];
  systemEntries: ReceiverAttemptDiagnosticEntry[];
};

type ReceiverPlatformReview = {
  attemptId: string;
  comment: string;
  createdAt: string;
  id: string;
  metadata?: Record<string, unknown>;
  reviewerUserId: string;
};

type ReceiverPlatformReviewAnalysis = {
  affectedPlatformLayers: string[];
  analysisText: string;
  attemptId: string;
  createdAt: string;
  id: string;
  identifiedConcerns: string[];
  metadata?: Record<string, unknown>;
  model: string;
  modelVersion: string;
  reviewId: string;
  suggestedRefinementAreas: string[];
};

const RECEIVER_CANVAS_WIDTH = 900;
const RECEIVER_CANVAS_HEIGHT = 1047;
const DESK_PHONE_CANVAS_WIDTH = 1024;
const DESK_PHONE_CANVAS_HEIGHT = 600;
const SCREEN_CLEANING_DURATION_SECONDS = 120;
const DEFAULT_TODAY_FOCUS_UNDO_WINDOW_MS = 5_000;
const interactionAttemptEndpoint = "/api/connect/interaction-attempts";
const receiverDiagnosticsEndpoint = "/api/connect/receiver/diagnostics";
const receiverAudioPack = {
  button: "/connect/receiver/audio/microwave-beep.mp3",
  incoming: "/connect/receiver/audio/old-phone-ringing.mp3",
  ringback: "/connect/receiver/audio/in-call-ring.wav",
  sit: "/connect/receiver/audio/sit.wav",
  unavailable: "/connect/receiver/audio/number-not-available.mp3",
};

function receiverCallStateUpdateReachedRequestedState(
  requestedState: string,
  returnedState: string
) {
  if (returnedState === requestedState) return true;
  if (requestedState === "answered") return returnedState === "connected";
  if (["declined", "hung_up"].includes(requestedState)) {
    return receiverCallRecordStateIsTerminal(returnedState);
  }
  return false;
}

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

type ReceiverMessageCondensationModal = {
  contactId: string;
  draft: string;
  initialDraft: string;
  limit: number;
  originalLength: number;
  originalTranscript: string;
  type: "messageCondensation";
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

const RECEIVER_TEXT_INPUT_MAX_LENGTH = 100;
const RECEIVER_HELP_REPORT_MAX_LENGTH = 700;
const RECEIVER_SPEECH_TRANSCRIPT_MAX_LENGTH = 4000;
const RECEIVER_ASK_TELL_RECORDING_MAX_DURATION_MS = 60000;
const RECEIVER_SPEECH_CONDENSATION_LIMIT = RECEIVER_TEXT_INPUT_MAX_LENGTH;
const RECEIVER_SPEECH_CONDENSATION_DRAFT_MAX_LENGTH = 90;
const RECEIVER_CONDENSED_MESSAGE_EDIT_MAX_LENGTH = 150;
const RECEIVER_TRANSCRIBING_IN_PROGRESS_TEXT = "Transcribing in progress";

function limitReceiverTextInput(value: string) {
  return value.slice(0, RECEIVER_TEXT_INPUT_MAX_LENGTH);
}

function limitReceiverCondensedMessageEdit(value: string) {
  return value.slice(0, RECEIVER_CONDENSED_MESSAGE_EDIT_MAX_LENGTH);
}

function limitReceiverSpeechTranscript(value: string) {
  return value.slice(0, RECEIVER_SPEECH_TRANSCRIPT_MAX_LENGTH);
}

function stripReceiverTranscribingDisplayText(value: string) {
  return value.replace(RECEIVER_TRANSCRIBING_IN_PROGRESS_TEXT, "").trimStart();
}

type AskAnswer = ReceiverAskAnswer;

function isReceiverClarificationAnswer(answer: AskAnswer) {
  if (answer.type !== "answer") return false;
  const text = answer.answer.trim().toLowerCase();
  return (
    /^who\b/.test(text) ||
    /^what do you need\b/.test(text) ||
    /^which available person\b/.test(text) ||
    /^more context is needed\b/.test(text)
  );
}

function isReceiverRecipientClarificationAnswer(answer: AskAnswer) {
  return /^who should receive this\??$/i.test(answer.answer.trim());
}

function normalizeReceiverContactInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveReceiverContactClarification(value: string, availableContacts: Contact[]) {
  const normalized = normalizeReceiverContactInput(value);
  if (!normalized) return null;
  return (
    availableContacts.find((contact) => {
      const contactName = normalizeReceiverContactInput(contact.displayName);
      return normalized === contactName || normalized.includes(contactName);
    }) ?? null
  );
}

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

type ReceiverDiagnosticsSettings = {
  enabled?: boolean;
};

type ReceiverAttemptEventType =
  | "abandoned"
  | "cancelled"
  | "helpful_selected"
  | "message_condensation_approved"
  | "message_condensation_draft_edited"
  | "message_condensation_triggered"
  | "not_helpful_selected"
  | "rephrase_selected"
  | "response_presented"
  | "send_selected"
  | "timed_out"
  | "workflow_completed";

type ReceiverAttemptRevisionReason =
  | "clarification"
  | "correction"
  | "initial"
  | "modality_switch"
  | "rephrase"
  | "retry";

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
  locationLabel?: string;
  nativeManufacturer?: string;
  nativeModel?: string;
  nativeSdk?: number;
  nativeVersionCode?: number;
  nativeVersionName?: string;
  mainConnectUserDisplayName?: string;
  mainConnectUserPersonId?: string;
  primaryCoordinatorDisplayName?: string;
  receiverContactDisplayName?: string;
  receiverContactIsReceiverUser?: boolean;
  receiverContactUserId?: string;
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
  | { type: "ask"; confirmExit?: boolean; surface?: "ask_tell" }
  | { type: "receiverHelp" }
  | { type: "receiverSettings"; view?: "home" | "style" | "cleanScreenTheme" }
  | { type: "screenCleaningConfirm" }
  | { type: "askRecordReview"; surface?: "ask_tell"; transcript: string }
  | { type: "askAnswer"; answer: AskAnswer; page?: number }
  | { type: "askRecovery"; page?: number; question: string; recoveryPrompt?: string; surface?: "ask_tell" }
  | ReceiverMessageCondensationModal
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

const fallbackPrimaryCoordinatorDisplayName = "Care coordinator";
const primaryCoordinatorContactId = "primary-coordinator";
const fallbackContacts: Contact[] = [
  {
    id: primaryCoordinatorContactId,
    displayName: fallbackPrimaryCoordinatorDisplayName,
    availability: "free",
    availabilityLabel: "Free",
    canCall: true,
  },
];

function receiverAskTellExamples(primaryCoordinatorName: string) {
  return [
    "When is my next appointment?",
    "I went for a walk.",
    `Tell ${primaryCoordinatorName} my knee hurts.`,
    "I need milk.",
    "What should I bring tomorrow?",
  ];
}

const askRecoveryPrompts = [
  "Could you add a bit more detail and try saying it another way?",
  "Could you tell a bit more about what you mean?",
  "Could you provide a bit more detail?",
  "Could you say a bit more about that?",
  "Could you explain that in a bit more detail?",
  "Could you be a bit more specific?",
  "Could you include a bit more context?",
  "Could you add a few more details?",
  "Could you expand on that a bit?",
];

const receiverUsers: ReceiverUser[] = [];
const testReceiverRegistrationCode = "12345";
const noMainConnectUser: ReceiverUser = {
  id: "",
  displayName: "Receiver setup required",
  statusLabel: "configuration required",
};
const selfContactMessage = "You can't send a message to yourself.";

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

function receiverLayoutPreviewMessages(binding: StoredReceiverBinding): Message[] {
  const personId = binding.mainConnectUserPersonId || "layout-preview-receiver-user";
  const coordinator = binding.primaryCoordinatorDisplayName || fallbackPrimaryCoordinatorDisplayName;
  const receiverName = binding.mainConnectUserDisplayName || "Receiver Preview";

  return [
    {
      allowsCallbackRequest: true,
      body: `${receiverName}, remember your cardiology follow-up is tomorrow at 2 PM.`,
      createdAt: appointmentAt(0, 9, 20),
      from: coordinator,
      id: "layout-preview-message-appointment",
      mainConnectUserPersonId: personId,
      messageType: "text",
      requiresAcknowledgement: true,
      to: receiverName,
    },
    {
      allowsCallbackRequest: true,
      body: "I added milk to the list. Press Call Back if you want to talk.",
      createdAt: appointmentAt(0, 8, 45),
      from: coordinator,
      heardAt: appointmentAt(0, 8, 50),
      id: "layout-preview-message-grocery",
      mainConnectUserPersonId: personId,
      messageType: "text",
      readAt: appointmentAt(0, 8, 50),
      to: receiverName,
    },
  ];
}

function receiverLayoutPreviewAppointment(): ReceiverAppointment {
  return {
    ...fallbackNextReceiverAppointment(),
    id: "layout-preview-cardiology-follow-up",
  };
}

function receiverLayoutPreviewTodayFocusItems(): ReceiverTodayFocusHomeItem[] {
  return [
    {
      completionConfig: null,
      completionType: null,
      id: "layout-preview-focus-walk",
      kind: "checkoff",
      promptText: "Take a short walk after breakfast.",
      title: "Morning walk",
    },
    {
      completionConfig: null,
      completionType: null,
      id: "layout-preview-focus-water",
      kind: "checkoff",
      promptText: "Drink a glass of water.",
      title: "Drink water",
    },
  ];
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

type ScreenCleaningTheme = "classic" | "flyingHero" | "microwave";

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
  screenCleaningTheme?: ScreenCleaningTheme;
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
      uiLayout: "desk_phone_1024x600",
    };
  }
  const params = new URLSearchParams(window.location.search);
  const nativeConfig = readNativeReceiverProvisioningConfig();
  const presentationLayout = normalizedProfileValue(
    params.get("receiverLayout") || params.get("receiver_layout") || params.get("ui")
  );
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
    presentationLayout === "modern" ||
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
    hardwareProfile: storedDeskPhone ? "stored_gxv3370" : hardwareProfile || "desk_phone_1024x600",
    uiLayout: "desk_phone_1024x600",
  };
}

function readInitialDeskPhoneMode() {
  return readReceiverProfileSelection().uiLayout === "desk_phone_1024x600";
}

function readInitialGxvHomeLayout(): GxvHomeLayout {
  if (typeof window === "undefined") return "ask_tell_2";
  const params = new URLSearchParams(window.location.search);
  const value = normalizedProfileValue(
    params.get("homeLayout") ||
      params.get("home_layout") ||
      params.get("gxvHome") ||
      params.get("gxv_home")
  );
  const canUseTrialLayouts = readReceiverAdminLayoutAccess();

  if (["ask_tell_2", "asktell2", "ask-tell-2", "ask_tell_v2", "asktellv2"].includes(value)) {
    return "ask_tell_2";
  }

  if (canUseTrialLayouts && ["ask_tell", "asktell", "ask-tell"].includes(value)) {
    return "ask_tell";
  }

  return canUseTrialLayouts && ["focus", "focus_v1", "today_focus", "v1"].includes(value)
    ? "focus_v1"
    : "ask_tell_2";
}

type GxvHomeLayout = "ask_tell" | "ask_tell_2" | "classic" | "focus_v1";
type ReceiverPresentationLayout = "classic" | "modern";
type ReceiverApprovedStyleLayout = "appliance" | "modern";

function readInitialReceiverPresentationLayout(): ReceiverPresentationLayout {
  if (typeof window === "undefined") return "classic";
  const params = new URLSearchParams(window.location.search);
  const value = normalizedProfileValue(
    params.get("receiverLayout") ||
      params.get("receiver_layout") ||
      params.get("ui") ||
      params.get("homeLayout")
  );

  return ["modern", "modern_web"].includes(value) ? "modern" : "classic";
}

function readReceiverAdminLayoutAccess() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(adminItemsVisibilityStorageKey) === "true";
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

function readInitialNativeReceiverShell() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const nativeConfig = readNativeReceiverProvisioningConfig();

  return (
    params.get("nativeShell") === "android" ||
    Boolean(nativeConfig.receiverUrl) ||
    Boolean(window.CarePlandReceiver?.getProvisioningJson) ||
    Boolean(window.CarePlandReceiver?.saveBinding) ||
    Boolean(window.CarePlandReceiver?.receiverReady)
  );
}

function readInitialSelectedContactId() {
  const storedContactId = readStoredReceiverSession().selectedContactId;
  return fallbackContacts.some((contact) => contact.id === storedContactId)
    ? storedContactId
    : primaryCoordinatorContactId;
}

function readInitialSelectedReceiverUserId() {
  if (readInitialReceiverRegistration()) {
    return readInitialReceiverBinding().mainConnectUserPersonId || "";
  }
  // Receiver identity comes from /api/connect/context after real registration.
  return "";
}

function readInitialReceiverUsers() {
  if (!readInitialReceiverRegistration()) return receiverUsers;
  const initialBinding = readInitialReceiverBinding();
  const mainConnectUserPersonId = initialBinding.mainConnectUserPersonId;
  if (!mainConnectUserPersonId) return [noMainConnectUser];
  return [
    {
      displayName:
        initialBinding.mainConnectUserDisplayName || "Receiver setup required",
      id: mainConnectUserPersonId,
      statusLabel: initialBinding.mainConnectUserDisplayName
        ? "Receiver ready"
        : "configuration required",
    },
  ];
}

function readInitialReceiverRegistration() {
  if (typeof window === "undefined") return false;
  return Boolean(readStoredReceiverBinding().receiverDeviceId) || readLocalTestReceiverProvisioning();
}

function readInitialReceiverBindingCheckPending() {
  if (typeof window === "undefined") return false;
  if (readInitialReceiverRegistration() || readLocalTestReceiverProvisioning()) return false;
  return Boolean(readReceiverDeviceId() && readReceiverInstallId());
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

function browserReceiverSetupLabel() {
  if (typeof window === "undefined") return "Browser Receiver";
  const userAgentData = (
    navigator as Navigator & {
      userAgentData?: { brands?: Array<{ brand?: string; version?: string }>; platform?: string };
    }
  ).userAgentData;
  const browser = browserNameFromUserAgentData(userAgentData?.brands) || browserNameFromUserAgent(navigator.userAgent);
  const os = userAgentData?.platform || osNameFromUserAgent(navigator.userAgent);
  const parts = [browser, os].map((part) => part.trim()).filter(Boolean);
  return parts.length ? `${parts.join(" on ")} Receiver` : "Browser Receiver";
}

function browserNameFromUserAgentData(brands?: Array<{ brand?: string; version?: string }>) {
  const brandNames = (brands ?? []).map((brand) => brand.brand || "").join(" ");
  if (/Microsoft Edge/i.test(brandNames)) return "Edge";
  if (/Google Chrome|Chromium/i.test(brandNames)) return "Chrome";
  return "";
}

function browserNameFromUserAgent(userAgent: string) {
  if (/Edg\//.test(userAgent)) return "Edge";
  if (/OPR\//.test(userAgent)) return "Opera";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/CriOS\//.test(userAgent)) return "Chrome";
  if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) return "Chrome";
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return "Safari";
  return "Browser";
}

function osNameFromUserAgent(userAgent: string) {
  if (/iPad|iPhone|iPod/.test(userAgent)) return "iOS";
  if (/Android/.test(userAgent)) return "Android";
  if (/Mac OS X|Macintosh/.test(userAgent)) return "macOS";
  if (/Windows NT/.test(userAgent)) return "Windows";
  if (/Linux/.test(userAgent)) return "Linux";
  return "";
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

function reportReceiverSessionLoss(response: Pick<Response, "status">, reason: string) {
  return reportSessionLossFromResponse(response, {
    reason,
    surface: "receiver",
  });
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

function compactReceiverIdentifier(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  if (normalized.length <= 18) return normalized;
  return `${normalized.slice(0, 8)}...${normalized.slice(-8)}`;
}

function receiverDisplayNameWithoutType(value: string) {
  return value.trim().replace(/\s+receiver\b.*$/i, "").trim();
}

function readReceiverIdentityDisplay(nameOverride = "") {
  const storedBinding = readStoredReceiverBinding();
  const receiverDeviceId = readReceiverDeviceId();
  const receiverInstallId = readReceiverInstallId();
  const identifier = receiverDeviceId || receiverInstallId || connectPrototypeReceiverId;
  const receiverName = receiverDisplayNameWithoutType(nameOverride.trim() || storedBinding.locationLabel?.trim() || "");
  return {
    full: identifier,
    label: compactReceiverIdentifier(identifier),
    name: receiverName,
    type: receiverDeviceId ? "Receiver ID" : "Local ID",
  };
}

function receiverCallMatchesThisDevice(call: Partial<ReceiverCall>) {
  const targetReceiverId = String(call.receiverId || "").trim();
  if (!targetReceiverId) return true;
  const receiverIds = new Set(
    [
      readReceiverDeviceId(),
      readReceiverGuideId(),
      readReceiverInstallId(),
      connectPrototypeReceiverId,
    ]
      .map((value) => value.trim())
      .filter(Boolean)
  );

  return receiverIds.has(targetReceiverId);
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

function readReceiverLayoutPreviewBinding(): StoredReceiverBinding | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("layoutPreview") !== "1") return null;
  if (!readLocalTestReceiverProvisioning()) return null;

  const mainConnectUserPersonId =
    params.get("mainConnectUserPersonId")?.trim() || "layout-preview-receiver-user";
  const receiverDeviceId =
    params.get("receiverDeviceId")?.trim() || "layout-preview-receiver";
  const receiverInstallId =
    params.get("receiverInstallId")?.trim() || "layout-preview-browser";

  return {
    bindingStatus: "local_test",
    deviceProfile: "layout_preview_receiver",
    hardwareProfile: params.get("hardwareProfile")?.trim() || "grandstream_gxv3370",
    locationLabel: params.get("locationLabel")?.trim() || "Layout Preview Receiver",
    mainConnectUserDisplayName:
      params.get("mainConnectUserDisplayName")?.trim() || "Receiver Preview",
    mainConnectUserPersonId,
    primaryCoordinatorDisplayName:
      params.get("primaryCoordinatorDisplayName")?.trim() || fallbackPrimaryCoordinatorDisplayName,
    receiverContactDisplayName:
      params.get("receiverContactDisplayName")?.trim() || fallbackPrimaryCoordinatorDisplayName,
    receiverContactIsReceiverUser: statusLooksEnabled(
      params.get("receiverContactIsReceiverUser")
    ),
    receiverContactUserId:
      params.get("receiverContactUserId")?.trim() || "layout-preview-contact",
    receiverDeviceId,
    receiverInstallId,
    receiverMode: "dedicated",
    receiverUrl: window.location.href,
    storageSource: params.get("sampleDataLayer")?.trim() || "layout_preview",
    uiLayout: params.get("uiLayout")?.trim() || "desk_phone_1024x600",
  };
}

function readReceiverLayoutPreviewMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("layoutPreview") === "1";
}

function readInitialReceiverBinding() {
  return readReceiverLayoutPreviewBinding() ?? readStoredReceiverBinding();
}

function readInitialReceiverMessages() {
  const previewBinding = readReceiverLayoutPreviewBinding();
  return previewBinding ? receiverLayoutPreviewMessages(previewBinding) : initialMessages;
}

function readInitialAppointmentDisplay(): ReceiverAppointmentDisplayState {
  return {
    appointments: [receiverLayoutPreviewAppointment()],
    source: "fallback",
  };
}

function readInitialTodayFocusItems() {
  return readReceiverLayoutPreviewMode() ? receiverLayoutPreviewTodayFocusItems() : [];
}

function readInitialTodayFocusLoadState(): "idle" | "loading" | "ready" | "empty" | "error" {
  return readReceiverLayoutPreviewMode() ? "ready" : "idle";
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
    locationLabel: binding.locationLabel?.trim() || "",
    nativeManufacturer: binding.nativeManufacturer?.trim() || "",
    nativeModel: binding.nativeModel?.trim() || "",
    nativeSdk: binding.nativeSdk,
    nativeVersionCode: binding.nativeVersionCode,
    nativeVersionName: binding.nativeVersionName?.trim() || "",
    mainConnectUserDisplayName: binding.mainConnectUserDisplayName?.trim() || "",
    mainConnectUserPersonId: binding.mainConnectUserPersonId?.trim() || "",
    primaryCoordinatorDisplayName: binding.primaryCoordinatorDisplayName?.trim() || "",
    receiverContactDisplayName: binding.receiverContactDisplayName?.trim() || "",
    receiverContactIsReceiverUser: binding.receiverContactIsReceiverUser === true,
    receiverContactUserId: binding.receiverContactUserId?.trim() || "",
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
  window.localStorage.setItem(receiverRegistrationStorageKey, storedBinding.mainConnectUserPersonId || "bound");
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

async function verifyReceiverBindingHeartbeat(
  reason: "initial" | "poll" | "retry" | "realtime" | "user" = "initial"
) {
  const receiverDeviceId = readReceiverDeviceId();
  const receiverInstallId = readReceiverInstallId();
  if (!receiverDeviceId || !receiverInstallId) return null;

  const nativeConfig = readNativeReceiverProvisioningConfig();
  recordConnectPollingRequest({
    caller: "connect_receiver_binding",
    endpoint: "/api/connect/receiver-shell/devices/binding",
    reason,
  });
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
    return fallbackContacts.some((contact) => contact.id === storedModal.contactId)
      ? storedModal
      : null;
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

function readInitialScreenCleaningTheme(): ScreenCleaningTheme {
  const storedTheme = readStoredReceiverSession().screenCleaningTheme;
  if (storedTheme === "flyingHero" || storedTheme === "microwave") return storedTheme;
  return "classic";
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

function pickAskRecoveryPrompt() {
  return askRecoveryPrompts[Math.floor(Math.random() * askRecoveryPrompts.length)] || askRecoveryPrompts[0];
}

function buildReceiverAttemptTraceStory(
  entries: ReceiverAttemptDiagnosticEntry[]
): ReceiverAttemptTraceStory {
  const revisions: ReceiverAttemptTraceRevision[] = [];
  const revisionsByObservationId = new Map<string, ReceiverAttemptTraceRevision>();
  const systemEntries: ReceiverAttemptDiagnosticEntry[] = [];
  let finalOutcome = "";

  function addRevision(entry: ReceiverAttemptDiagnosticEntry) {
    const fields = parseReceiverTraceDetail(entry.detail);
    const observationId = fields["Observation ID"] || fields.observationId || "";
    const revisionNumber = Number.parseInt(fields.Revision || "", 10) || revisions.length + 1;
    const revision: ReceiverAttemptTraceRevision = {
      family: "",
      familyConfidence: "",
      askCapabilityStatus: "",
      askEntities: "",
      askIntent: "",
      askIntentConfidence: "",
      askTemporalReferences: "",
      interpreter: "",
      normalizedText: "",
      observationId,
      parentObservationId: fields.Parent || fields.parentObservationId || "",
      platformEntries: [],
      reason: fields.Reason || "initial",
      response: "",
      result: "",
      revisionNumber,
      route: "",
      rawEntries: [entry],
      userActions: [],
      userText: fields.__text || "",
    };
    revisions.push(revision);
    if (observationId) revisionsByObservationId.set(observationId, revision);
    return revision;
  }

  function findRevision(fields: Record<string, string>) {
    const observationId = fields.observationId || fields["Observation ID"] || "";
    if (observationId && revisionsByObservationId.has(observationId)) {
      return revisionsByObservationId.get(observationId)!;
    }
    return revisions[revisions.length - 1] || null;
  }

  entries.forEach((entry) => {
    const fields = parseReceiverTraceDetail(entry.detail);
    if (entry.label === "Observation" || entry.label === "Revised Observation") {
      addRevision(entry);
      return;
    }

    if (entry.label === "Presented response") {
      const revision = findRevision(fields);
      if (!revision) {
        systemEntries.push(entry);
        return;
      }
      revision.platformEntries.push(entry);
      revision.rawEntries.push(entry);
      revision.family = fields.family || revision.family;
      revision.familyConfidence = fields.familyConfidence || revision.familyConfidence;
      revision.askCapabilityStatus =
        fields.askCapabilityStatus || revision.askCapabilityStatus;
      revision.askEntities = fields.askEntities || revision.askEntities;
      revision.askIntent = fields.askIntent || revision.askIntent;
      revision.askIntentConfidence =
        fields.askIntentConfidence || revision.askIntentConfidence;
      revision.askTemporalReferences =
        fields.askTemporalReferences || revision.askTemporalReferences;
      revision.interpreter = fields.interpreter || revision.interpreter;
      revision.normalizedText = fields.normalizedText || revision.normalizedText;
      revision.response = fields.answer || fields.response || revision.response;
      revision.result = fields.result || fields.responseType || revision.result;
      revision.route = fields.route || revision.route;
      return;
    }

    if (entry.label === "User action") {
      const revision = findRevision(fields);
      if (!revision) {
        systemEntries.push(entry);
        return;
      }
      revision.userActions.push(entry);
      revision.rawEntries.push(entry);
      return;
    }

    if (entry.label === "Final outcome") {
      finalOutcome = fields.outcome || fields.result || entry.detail || "";
      const revision = findRevision(fields);
      if (revision) revision.rawEntries.push(entry);
      else systemEntries.push(entry);
      return;
    }

    systemEntries.push(entry);
  });

  const familyEvolution = revisions
    .map((revision) => revision.family)
    .filter(Boolean)
    .filter((family, index, families) => family !== families[index - 1]);
  const finalRevision = [...revisions].reverse().find((revision) => revision.family || revision.result) || null;
  return {
    familyEvolution,
    finalOutcome,
    finalResponse: finalRevision?.response || "",
    finalRevision,
    revisions,
    systemEntries,
  };
}

function parseReceiverTraceDetail(detail: string) {
  const fields: Record<string, string> = {};
  detail
    .split(/\n| · /)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      if (part.startsWith('"') && part.endsWith('"')) {
        fields.__text = part.slice(1, -1);
        return;
      }
      const separator = part.indexOf(":");
      if (separator <= 0) return;
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      fields[key] = value;
    });
  return fields;
}

function formatReceiverTracePercent(confidence: string) {
  const value = Number(confidence);
  if (!Number.isFinite(value)) return "";
  return `${Math.round(value * 100)}%`;
}

function receiverTraceActionLabel(entry: ReceiverAttemptDiagnosticEntry) {
  const fields = parseReceiverTraceDetail(entry.detail);
  if (entry.detail.includes("question:")) return "This wasn't helpful";
  if (entry.detail.includes("recipient:")) return `Send to ${fields.recipient || "contact"}`;
  if (entry.detail.includes("source: recovery")) return "Send to contact";
  return entry.detail || entry.label;
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
  return displayName.trim().replace(/\s+/g, " ").split(/\s+/)[0] || displayName;
}

function receiverGreetingDisplayName(displayName: string, users: ReceiverUser[]) {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  if (!normalized) return displayName;
  const firstName = firstDisplayName(normalized);
  const matchingFirstNameCount = users.filter(
    (user) => firstDisplayName(user.displayName).toLocaleLowerCase() === firstName.toLocaleLowerCase()
  ).length;
  return matchingFirstNameCount > 1 ? normalized : firstName;
}

function compactReceiverDisplayName(displayName: string) {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  if (!normalized) return displayName;
  if (normalized.length <= 30) return normalized;
  return firstDisplayName(normalized);
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

function formatReceiverFooterDate(date: Date) {
  const weekday = date.toLocaleDateString([], { weekday: "long" });
  const monthDay = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${weekday} ${monthDay}`;
}

function formatReceiverFooterWeekday(date: Date) {
  return date.toLocaleDateString([], { weekday: "long" });
}

function formatReceiverFooterMonthDay(date: Date) {
  return date.toLocaleDateString([], { month: "long", day: "numeric" });
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

function isAppointmentRelatedMessage(message: Message) {
  const text = `${message.messageType || ""} ${message.body || ""} ${message.transcript || ""}`
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (
    /\b(?:appointment|appt|visit|doctor|dr\.?|clinic|provider|dentist|therapy|vet|veterinarian)\b/.test(
      text
    )
  ) {
    return true;
  }

  return /\b(?:bring|take|pack|remember|don'?t forget)\b/.test(text) &&
    /\b(?:meds?|medicine|medication|med list|blood sugar|blood pressure|sensor|exercise log|hearing aids?|insurance|paperwork|notes?)\b/.test(
      text
    );
}

function messageSenderDisplayName(
  message: Message,
  fallbackName: string,
  coordinatorName: string
) {
  if (message.from && message.from !== "receiver_user") return message.from;
  return fallbackName || coordinatorName;
}

function receiverMessageNotificationText(
  message: Message,
  input: {
    fallbackName: string;
    important: boolean;
    primaryCoordinatorName: string;
  }
) {
  if (isAppointmentRelatedMessage(message)) {
    return message.readAt
      ? "You have a message you've read about your upcoming appointment."
      : "You have an unread message about your upcoming appointment.";
  }

  const sender = messageSenderDisplayName(
    message,
    input.fallbackName,
    input.primaryCoordinatorName
  );

  return input.important
    ? `You have an important message from ${sender}.`
    : `You have a message you've read from ${sender}.`;
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
  return 55;
}

function askTellPageCharacterLimit(size: ReaderTextSize) {
  if (size === "standard") return 150;
  if (size === "large") return 55;
  return 18;
}

function receiverHelpPageCharacterLimit(size: ReaderTextSize) {
  if (size === "standard") return 520;
  if (size === "large") return 260;
  return 95;
}

function paginateTextByLimit(text: string, limit: number) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return [""];

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

function paginateReaderText(text: string, size: ReaderTextSize) {
  return paginateTextByLimit(text, readerPageCharacterLimit(size));
}

function paginateEditableTextByLimit(text: string, limit: number) {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized) return [""];

  const pages: string[] = [];
  let remaining = normalized;

  while (remaining.length > limit) {
    const slice = remaining.slice(0, limit + 1);
    const breakAt = Math.max(
      slice.lastIndexOf(". "),
      slice.lastIndexOf("? "),
      slice.lastIndexOf("! "),
      slice.lastIndexOf("\n"),
      slice.lastIndexOf(" ")
    );
    const pageEnd = breakAt > Math.floor(limit * 0.62) ? breakAt + 1 : limit;
    pages.push(remaining.slice(0, pageEnd));
    remaining = remaining.slice(pageEnd);
  }

  pages.push(remaining);
  return pages;
}

function paginateAskTellText(text: string, size: ReaderTextSize) {
  return paginateEditableTextByLimit(text, askTellPageCharacterLimit(size));
}

function paginateReceiverHelpText(text: string, size: ReaderTextSize) {
  return paginateEditableTextByLimit(text, receiverHelpPageCharacterLimit(size));
}

function replacePaginatedTextPage(
  pages: string[],
  pageIndex: number,
  nextPageText: string,
  options?: { preserveWhitespace?: boolean }
) {
  const nextPages = pages.length ? [...pages] : [""];
  nextPages[Math.max(0, Math.min(pageIndex, nextPages.length - 1))] = nextPageText;
  const joined = nextPages.join("\n\n");
  return options?.preserveWhitespace ? joined : joined.trim();
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
    acknowledgedAt: String(message.acknowledgedAt || fallback?.acknowledgedAt || ""),
    allowsCallbackRequest: Boolean(
      message.allowsCallbackRequest ?? fallback?.allowsCallbackRequest ?? false
    ),
    callbackRequestedAt: String(
      message.callbackRequestedAt || fallback?.callbackRequestedAt || ""
    ),
    createdAt: String(message.createdAt || fallback?.createdAt || currentIsoTimestamp()),
    from: String(message.from || fallback?.from || fallbackPrimaryCoordinatorDisplayName),
    heardAt: String(message.heardAt || fallback?.heardAt || ""),
    id: String(message.id || fallback?.id || `message-${currentEpochMs()}`),
    mainConnectUserPersonId: String(
      message.mainConnectUserPersonId || fallback?.mainConnectUserPersonId || ""
    ),
    messageType: String(message.messageType || fallback?.messageType || "text"),
    readAt: String(message.readAt || fallback?.readAt || ""),
    requiresAcknowledgement: Boolean(
      message.requiresAcknowledgement ?? fallback?.requiresAcknowledgement ?? false
    ),
    to: String(message.to || fallback?.to || receiver.careVipName),
    transcript: String(message.transcript || fallback?.transcript || ""),
    transcriptStatus: String(message.transcriptStatus || fallback?.transcriptStatus || ""),
  };
}

function resolveReceiverAttentionItem(input: {
  messages: Message[];
}): ReceiverAttentionItem | null {
  const items: ReceiverAttentionItem[] = [];
  const actionableMessage = input.messages.find(
    (message) =>
      !message.readAt ||
      (message.requiresAcknowledgement && !message.acknowledgedAt)
  );

  if (actionableMessage) {
    items.push({
      kind: "new_message",
      label: "Message",
      message: actionableMessage,
      priority: 100,
    });
  }

  // Future inputs should plug in here: reminder due -> "Reminder",
  // receiver update available -> "Update", and device/audio issue -> "Help".
  return items.sort((a, b) => b.priority - a.priority)[0] ?? null;
}

export function ConnectReceiver() {
  const sessionValidity = useSyncExternalStore(
    sessionValidityStore.subscribe,
    sessionValidityStore.getSnapshot,
    () => receiverSessionValidityServerSnapshot
  );
  const initialDevicePixelRatioRef = useRef(initialReceiverDevicePixelRatio());
  const [deskPhoneMode] = useState(readInitialDeskPhoneMode);
  const [receiverPresentationLayout, setReceiverPresentationLayout] =
    useState<ReceiverPresentationLayout>(readInitialReceiverPresentationLayout);
  const [gxvHomeLayout, setGxvHomeLayout] = useState<GxvHomeLayout>(readInitialGxvHomeLayout);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [nativeReceiverShell] = useState(readInitialNativeReceiverShell);
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
  const [primaryCoordinatorDisplayName, setPrimaryCoordinatorDisplayName] = useState(
    () =>
      readInitialReceiverBinding().primaryCoordinatorDisplayName?.trim() ||
      fallbackPrimaryCoordinatorDisplayName
  );
  const [receiverContactDisplayName, setReceiverContactDisplayName] = useState(
    () => readInitialReceiverBinding().receiverContactDisplayName?.trim() || ""
  );
  const [receiverContactUserId, setReceiverContactUserId] = useState(
    () => readInitialReceiverBinding().receiverContactUserId?.trim() || ""
  );
  const [receiverContactIsReceiverUser, setReceiverContactIsReceiverUser] = useState(
    () => readInitialReceiverBinding().receiverContactIsReceiverUser === true
  );
  const [receiverLocationLabel, setReceiverLocationLabel] = useState(
    () => readInitialReceiverBinding().locationLabel?.trim() || ""
  );
  const [activeReceiverUsers, setActiveReceiverUsers] =
    useState<ReceiverUser[]>(readInitialReceiverUsers);
  const [selectedReceiverUserId, setSelectedReceiverUserId] = useState(readInitialSelectedReceiverUserId);
  const [receiverRegistered, setReceiverRegistered] = useState(readInitialReceiverRegistration);
  const [receiverBindingCheckPending, setReceiverBindingCheckPending] = useState(
    readInitialReceiverBindingCheckPending
  );
  const [receiverSetupError, setReceiverSetupError] = useState("");
  const [browserPairingCode, setBrowserPairingCode] = useState("");
  const [browserPairingExpiresAt, setBrowserPairingExpiresAt] = useState("");
  const [browserPairingStatus, setBrowserPairingStatus] = useState("Preparing Receiver setup...");
  const [messages, setMessages] = useState<Message[]>(readInitialReceiverMessages);
  const [receiverOnline, setReceiverOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [appointmentDisplay, setAppointmentDisplay] =
    useState<ReceiverAppointmentDisplayState>(readInitialAppointmentDisplay);
  const [todayFocusItems, setTodayFocusItems] =
    useState<ReceiverTodayFocusHomeItem[]>(readInitialTodayFocusItems);
  const [todayFocusCompletingId, setTodayFocusCompletingId] = useState("");
  const [todayFocusCompletedIds, setTodayFocusCompletedIds] = useState<string[]>([]);
  const [todayFocusPendingCompletions, setTodayFocusPendingCompletions] =
    useState<Record<string, ReceiverTodayFocusPendingCompletion>>({});
  const [todayFocusRecentlyUndoneIds, setTodayFocusRecentlyUndoneIds] = useState<string[]>([]);
  const [todayFocusUndoWindowMs, setTodayFocusUndoWindowMs] = useState(
    DEFAULT_TODAY_FOCUS_UNDO_WINDOW_MS
  );
  const [todayFocusLoadState, setTodayFocusLoadState] = useState<
    "idle" | "loading" | "ready" | "empty" | "error"
  >(readInitialTodayFocusLoadState);
  const [todayFocusStatus, setTodayFocusStatus] = useState("");
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
  const interactionAttemptRef = useRef({
    attemptId: "",
    latestObservationId: "",
    nextRevisionIndex: 0,
    pendingRevisionReason: "initial" as ReceiverAttemptRevisionReason,
  });
  const [receiverDiagnosticMode, setReceiverDiagnosticMode] = useState(false);
  const [attemptDiagnosticOpen, setAttemptDiagnosticOpen] = useState(false);
  const [attemptDiagnosticSummary, setAttemptDiagnosticSummary] =
    useState<ReceiverAttemptDiagnosticSummary>({
      attemptId: "",
      completedAt: "",
      latestObservationId: "",
      outcome: "",
      revisionCount: 0,
      startedAt: "",
      status: "idle",
      surface: "",
    });
  const [attemptDiagnosticEntries, setAttemptDiagnosticEntries] = useState<
    ReceiverAttemptDiagnosticEntry[]
  >([]);
  const [platformReviews, setPlatformReviews] = useState<ReceiverPlatformReview[]>(
    []
  );
  const [platformReviewAnalyses, setPlatformReviewAnalyses] = useState<
    ReceiverPlatformReviewAnalysis[]
  >([]);
  const [platformReviewDraft, setPlatformReviewDraft] = useState("");
  const [platformReviewSaving, setPlatformReviewSaving] = useState(false);
  const [platformReviewAnalyzingId, setPlatformReviewAnalyzingId] = useState("");
  const [platformReviewStatus, setPlatformReviewStatus] = useState("");
  const [screenCleaningSecondsRemaining, setScreenCleaningSecondsRemaining] =
    useState<number | null>(null);
  const [screenCleaningSession, setScreenCleaningSession] =
    useState<ScreenCleaningSession | null>(null);
  const [screenCleaningTheme, setScreenCleaningTheme] =
    useState<ScreenCleaningTheme>(readInitialScreenCleaningTheme);
  const [contactDraft, setContactDraft] = useState(() =>
    limitReceiverTextInput(readStoredReceiverSession().contactDraft || "")
  );
  const [askDraft, setAskDraft] = useState(() =>
    limitReceiverTextInput(readStoredReceiverSession().askDraft || "")
  );
  const [askDraftObservationModality, setAskDraftObservationModality] =
    useState<ObservationModality>("typed");
  const [guideTarget, setGuideTarget] = useState<GuideTarget | null>(null);
  const [guideRect, setGuideRect] = useState<GuideRect | null>(null);
  const [guideIdentifyCode, setGuideIdentifyCode] = useState("");
  const [receiverRecording, setReceiverRecording] = useState(false);
  const [receiverRecordingProcessing, setReceiverRecordingProcessing] = useState(false);
  const [contactRecording, setContactRecording] = useState(false);
  const [contactRecordingProcessing, setContactRecordingProcessing] = useState(false);
  const [pendingContactRecording, setPendingContactRecording] =
    useState<PendingContactRecording | null>(null);
  const [receiverHelpDraft, setReceiverHelpDraft] = useState("");
  const [receiverHelpRecording, setReceiverHelpRecording] = useState(false);
  const [receiverHelpRecordingProcessing, setReceiverHelpRecordingProcessing] = useState(false);
  const [receiverHelpSubmitting, setReceiverHelpSubmitting] = useState(false);
  const [pendingAskAudio, setPendingAskAudio] = useState<PendingAskAudio | null>(
    null
  );
  const [receiverTalkOperation, setReceiverTalkOperation] =
    useState<ReceiverTalkOperation | null>(null);
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
  const callAudioStatusRef = useRef<ConnectCallAudioStatus>("idle");
  const callStartedAtByCallIdRef = useRef<Record<string, string>>({});
  const locallyAnsweredCallIdsRef = useRef<Set<string>>(new Set());
  const locallyEndedCallIdsRef = useRef<Set<string>>(new Set());
  const summaryApprovalAdvanceTimerRef = useRef<number | null>(null);
  const playingEnhancementProfileRef = useRef<ReceiverAudioEnhancementProfile | null>(null);
  const playingMessageRef = useRef<Message | null>(null);
  const cueAudioRef = useRef<HTMLAudioElement | null>(null);
  const cueTimeoutRef = useRef<number | null>(null);
  const todayFocusCompletionTimersRef = useRef<Record<string, number>>({});
  const todayFocusUndoneTimersRef = useRef<Record<string, number>>({});
  const receiverRecordingControllerRef = useRef<ConnectAudioRecordingController | null>(null);
  const receiverChunkTranscriptRef = useRef({
    active: false,
    assembledText: "",
    chunks: {} as Record<number, string>,
  });
  const updateAskDraft = useCallback(
    (value: string, modality: ObservationModality = "typed") => {
      setAskDraftObservationModality(modality);
      setAskDraft(limitReceiverTextInput(value));
    },
    []
  );
  const receiverAskExitRequestedRef = useRef(false);
  const receiverCaptureIdRef = useRef("");
  const receiverTalkOperationRef = useRef<ReceiverTalkOperation | null>(null);
  const receiverRecordingStartTokenRef = useRef(0);
  const receiverRecordingSurfaceRef = useRef<"ask_tell" | null>(null);
  const contactRecordingControllerRef = useRef<ConnectAudioRecordingController | null>(null);
  const contactCaptureIdRef = useRef("");
  const receiverHelpRecordingControllerRef = useRef<ConnectAudioRecordingController | null>(null);
  const receiverHelpCaptureIdRef = useRef("");
  const screenCleaningSessionRef = useRef<ScreenCleaningSession | null>(null);
  const gxvFocusHomeEnabled = deskPhoneMode && gxvHomeLayout === "focus_v1";
  const gxvAskTellHomeEnabled = deskPhoneMode && gxvHomeLayout === "ask_tell";
  const gxvAskTell2HomeEnabled = deskPhoneMode && gxvHomeLayout === "ask_tell_2";
  const receiverModernPresentationEnabled =
    !deskPhoneMode && receiverPresentationLayout === "modern";
  const onlineRequiredActionClass = receiverOnline ? "" : styles.offlineDisabledAction;
  const attemptDiagnosticStartedAt = attemptDiagnosticSummary.startedAt
    ? new Date(attemptDiagnosticSummary.startedAt)
    : null;
  const attemptDiagnosticCompletedAt = attemptDiagnosticSummary.completedAt
    ? new Date(attemptDiagnosticSummary.completedAt)
    : null;
  const attemptDiagnosticDurationSeconds =
    attemptDiagnosticStartedAt && attemptDiagnosticCompletedAt
      ? Math.max(
          0,
          Math.round(
            (attemptDiagnosticCompletedAt.getTime() - attemptDiagnosticStartedAt.getTime()) /
              1000
          )
        )
      : null;
  const attemptTraceStory = buildReceiverAttemptTraceStory(attemptDiagnosticEntries);

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

  const refreshMessages = useCallback(async (
    reason: "initial" | "poll" | "retry" | "realtime" | "user" = "user"
  ) => {
    if (!selectedReceiverUserId) return;
    const previewBinding = readReceiverLayoutPreviewBinding();
    if (previewBinding) {
      setMessages(receiverLayoutPreviewMessages(previewBinding));
      setFocusedMessageIndex(0);
      return;
    }

    try {
      const messagesUrl = `${connectMessagesEndpoint}?personId=${encodeURIComponent(selectedReceiverUserId)}`;
      recordConnectPollingRequest({
        caller: "connect_receiver_messages",
        endpoint: connectMessagesEndpoint,
        reason,
      });
      const response = await fetch(messagesUrl, {
        cache: "no-store",
        headers: await connectReceiverRequestHeaders(),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        messages?: Array<Partial<Message> & { id?: string }>;
      };

      if (!response.ok) {
        reportReceiverSessionLoss(response, "Receiver messages authentication was rejected.");
        return;
      }
      if (!Array.isArray(payload.messages)) return;
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
    setTodayFocusRecentlyUndoneIds([]);
    setTodayFocusCompletingId("");
    setTodayFocusStatus("");
    setTodayFocusLoadState(items.length ? "ready" : "empty");
    clearTodayFocusCompletionTimers();
    clearTodayFocusUndoneTimers();
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

  function clearTodayFocusUndoneTimers() {
    for (const timerId of Object.values(todayFocusUndoneTimersRef.current)) {
      window.clearTimeout(timerId);
    }
    todayFocusUndoneTimersRef.current = {};
  }

  function clearTodayFocusUndoneTimer(focusItemId: string) {
    const timerId = todayFocusUndoneTimersRef.current[focusItemId];
    if (timerId) {
      window.clearTimeout(timerId);
      delete todayFocusUndoneTimersRef.current[focusItemId];
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
    if (readReceiverLayoutPreviewMode()) {
      resetTodayFocusList(receiverLayoutPreviewTodayFocusItems());
      return;
    }
    setTodayFocusItems([]);
    setTodayFocusCompletedIds([]);
    setTodayFocusPendingCompletions({});
    setTodayFocusRecentlyUndoneIds([]);
    setTodayFocusCompletingId("");
    setTodayFocusStatus("");
    setTodayFocusLoadState(selectedReceiverUserId ? "loading" : "idle");
    clearTodayFocusCompletionTimers();
    clearTodayFocusUndoneTimers();
  }, [selectedReceiverUserId]);

  const refreshTodayFocus = useCallback(async (
    reason: "initial" | "poll" | "retry" | "realtime" | "user" = "user"
  ) => {
    if (!selectedReceiverUserId) {
      if (todayFocusItems.length === 0) {
        setTodayFocusLoadState("idle");
      }
      setTodayFocusStatus("Choose a Main Connect User to show Today’s Focus.");
      return;
    }

    if (readReceiverLayoutPreviewMode()) {
      resetTodayFocusList(receiverLayoutPreviewTodayFocusItems());
      return;
    }

    setTodayFocusLoadState((current) =>
      todayFocusItems.length > 0 && current === "ready" ? "ready" : "loading"
    );
    if (todayFocusItems.length === 0) {
      setTodayFocusStatus("");
    }

    try {
      recordConnectPollingRequest({
        caller: "connect_receiver_today_focus",
        endpoint: connectTodayFocusEndpoint,
        reason,
      });
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

      if (!response.ok) {
        reportReceiverSessionLoss(response, "Receiver Today’s Focus authentication was rejected.");
        setTodayFocusLoadState(todayFocusItems.length ? "ready" : "error");
        if (todayFocusItems.length === 0) {
          setTodayFocusStatus(
            "Today’s Focus could not load for this Receiver user."
          );
        }
        return;
      }
      if (!Array.isArray(payload.focusItems)) {
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
      setTodayFocusStatus("You have no Focus items today.");
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
    if (connectCallsDeprecated) return;
    if (!selectedReceiverUserId) return;

    try {
      recordConnectPollingRequest({
        caller: "connect_receiver_calls",
        endpoint: connectCallsEndpoint,
        reason: "poll",
      });
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

      if (!response.ok) {
        reportReceiverSessionLoss(response, "Receiver call authentication was rejected.");
        return;
      }
      if (!Array.isArray(payload.calls)) return;
      markReceiverOnline();

      const activeCalls = payload.calls.filter((call) =>
        receiverCallRecordStateIsActive(String(call.state || ""))
      );
      const matchedActiveCall = activeCalls.find(receiverCallMatchesThisDevice);
      const fallbackActiveCall =
        matchedActiveCall || activeCalls.length !== 1 ? undefined : activeCalls[0];
      const activeCall = matchedActiveCall ?? fallbackActiveCall;
      if (fallbackActiveCall?.callId) {
        logReceiverCallEvent(
          String(fallbackActiveCall.callId),
          "call_receiver_person_scoped_call_fallback_used",
          {
            receiverDeviceId: readReceiverDeviceId(),
            receiverInstallId: readReceiverInstallId(),
            source: "refreshCalls",
            targetReceiverId: String(fallbackActiveCall.receiverId || ""),
          }
        );
      }
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
            callAudioStatus: callAudioStatusRef.current,
            currentCallState: current.callState,
            source: "refreshCalls",
          });
          const currentServerCall = payload.calls?.find(
            (call) => call.callId === current.callId
          );
          const currentServerState = String(currentServerCall?.state || "");
          const currentServerCallActive = receiverCallRecordStateIsActive(currentServerState);
          const localAudioStillConnecting = [
            "starting",
            "microphone_ready",
            "connecting",
            "connected",
            "remote_audio",
          ].includes(callAudioStatusRef.current);
          if (
            (current.callState === "connecting" || current.callState === "connected") &&
            localAudioStillConnecting &&
            (!currentServerCall || currentServerCallActive)
          ) {
            logReceiverCallEvent(current.callId, "call_receiver_poll_no_active_call_preserved", {
              callAudioStatus: callAudioStatusRef.current,
              currentCallState: current.callState,
              serverState: currentServerState,
              source: "refreshCalls",
            });
            return current;
          }
          stopLiveCallAudio({ notifyPeer: false });
          if (current.callId) {
            locallyAnsweredCallIdsRef.current.delete(current.callId);
          }
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
      const activeCallId = String(activeCall.callId);
      const receiverCallState = receiverCallUiStateFromRecordState(callState);
      const locallyAnswered = locallyAnsweredCallIdsRef.current.has(activeCallId);
      const effectiveReceiverCallState =
        locallyAnswered &&
        (receiverCallState === "incoming" || receiverCallState === "connecting")
          ? "connecting"
          : receiverCallState;
      const callerName = String(
        activeCall.callerName ||
          primaryCoordinatorDisplayName ||
          fallbackPrimaryCoordinatorDisplayName
      );
      const summaryStatus = String(activeCall.summaryStatus || "");
      const summaryText = String(activeCall.summaryText || "");
      const generatedSummaryText = String(activeCall.generatedSummaryText || summaryText || "");
      const summaryDraftText = stripCareSummaryHeading(
        String(activeCall.summaryApprovalDraftText || summaryText || "")
      );
      const transcriptStatus = String(activeCall.transcriptStatus || "");
      const transcriptText = String(activeCall.transcriptText || "");
      const visibleModal = modalRef.current;
      const activeCallWouldInterruptSummaryReview =
        visibleModal?.type === "incomingCall" &&
        visibleModal.callId !== activeCall.callId &&
        visibleModal.textView === "summary" &&
        visibleModal.summaryApproval !== "approved";
      setInterruptedReviewIncomingCall(
        activeCallWouldInterruptSummaryReview && effectiveReceiverCallState === "incoming"
          ? activeCall
          : null
      );
      if (effectiveReceiverCallState !== "incoming" && !callStartedAtByCallIdRef.current[activeCallId]) {
        callStartedAtByCallIdRef.current[activeCallId] = new Date().toISOString();
      }
      setModal((current) => {
        const currentIsSameCall =
          current?.type === "incomingCall" && current.callId === activeCall.callId;
        const stableCallStartedAt =
          callStartedAtByCallIdRef.current[activeCallId] ||
          (currentIsSameCall ? current.callStartedAt : undefined) ||
          (effectiveReceiverCallState === "incoming" ? undefined : new Date().toISOString());
        if (stableCallStartedAt && !callStartedAtByCallIdRef.current[activeCallId]) {
          callStartedAtByCallIdRef.current[activeCallId] = stableCallStartedAt;
        }
        if (
          currentIsSameCall &&
          (current.callState === "ended" || current.callState === "failed")
        ) {
          locallyEndedCallIdsRef.current.add(String(activeCall.callId));
          locallyAnsweredCallIdsRef.current.delete(String(activeCall.callId));
          logReceiverCallEvent(String(activeCall.callId), "call_receiver_poll_ended_call_preserved", {
            nextCallState: callState,
            source: "refreshCalls",
          });
          return current;
        }
        const shouldPreserveLocalAnsweredState =
          currentIsSameCall &&
          (current.callState === "connecting" || current.callState === "connected") &&
          (effectiveReceiverCallState === "incoming" || effectiveReceiverCallState === "connecting");
        if (
          currentIsSameCall &&
          current.callState !== effectiveReceiverCallState
        ) {
          logReceiverCallEvent(String(activeCall.callId), "call_receiver_poll_state_changed", {
            nextCallState: callState,
            previousCallState: current.callState,
            locallyAnswered,
            source: "refreshCalls",
            preservedLocalAnsweredState: shouldPreserveLocalAnsweredState,
          });
        }
        if (
          currentIsSameCall &&
          (current.callState === effectiveReceiverCallState || shouldPreserveLocalAnsweredState)
        ) {
          if (!receiverCallRecordStateIsActive(String(activeCall.state || ""))) {
            locallyEndedCallIdsRef.current.delete(String(activeCall.callId));
            locallyAnsweredCallIdsRef.current.delete(String(activeCall.callId));
          }
          return {
            ...current,
            callState: shouldPreserveLocalAnsweredState
              ? current.callState
              : effectiveReceiverCallState,
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
          callState: effectiveReceiverCallState === "idle" ? "incoming" : effectiveReceiverCallState,
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
          ? locallyAnswered
            ? `Connecting to ${callerName}.`
            : `${callerName} is calling.`
          : effectiveReceiverCallState === "connecting"
            ? `Connecting to ${callerName}.`
            : `Connected to ${callerName}.`
      );
    } catch {
      markReceiverOffline();
      // Keep the receiver usable if the Connect local server is unavailable.
    }
  }, [primaryCoordinatorDisplayName, selectedReceiverUserId]);

  function openAttentionItem(item: ReceiverAttentionItem | null) {
    if (!item) return;
    if (item.kind === "new_message") {
      openMessage(item.message);
    }
  }

  function advanceAfterCallSummaryApproval(callId: string | undefined) {
    if (summaryApprovalAdvanceTimerRef.current) {
      window.clearTimeout(summaryApprovalAdvanceTimerRef.current);
    }

    summaryApprovalAdvanceTimerRef.current = window.setTimeout(() => {
      summaryApprovalAdvanceTimerRef.current = null;
      setModal((current) =>
        current?.type === "incomingCall" &&
        current.callId === callId &&
        current.summaryApproval === "approved"
          ? null
          : current
      );
    }, 500);
  }

  useEffect(() => {
    modalRef.current = modal;
    if (modal) {
      setLayoutMenuOpen(false);
    }
  }, [modal]);

  useEffect(() => {
    const askTellCaptureOpen =
      (modal?.type === "ask" && modal.surface === "ask_tell") ||
      (modal?.type === "askRecordReview" && modal.surface === "ask_tell");
    if (askTellCaptureOpen) return;
    receiverRecordingStartTokenRef.current += 1;
  }, [modal]);

  useEffect(() => {
    let cancelled = false;

    async function loadReceiverDiagnosticsSetting() {
      try {
        recordConnectPollingRequest({
          caller: "connect_receiver_diagnostics",
          endpoint: receiverDiagnosticsEndpoint,
          reason: "initial",
        });
        const response = await fetch(receiverDiagnosticsEndpoint, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as ReceiverDiagnosticsSettings;
        if (!cancelled) {
          setReceiverDiagnosticMode(payload.enabled === true);
        }
      } catch {
        if (!cancelled) {
          setReceiverDiagnosticMode(false);
        }
      }
    }

    void loadReceiverDiagnosticsSetting();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    callAudioStatusRef.current = callAudioStatus;
  }, [callAudioStatus]);

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
    if (modal?.type !== "sent") return undefined;

    const timer = window.setTimeout(() => {
      setModal((current) => (current?.type === "sent" ? null : current));
      setStatus("Ready.");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [modal?.type]);

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
      resetReceiverChunkTranscript();
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
      clearTodayFocusUndoneTimers();
    };
  }, [pendingContactRecording]);

  function applyBoundReceiverActivePerson(personId?: string, displayName?: string) {
    const normalizedPersonId = personId?.trim() || "";
    if (!normalizedPersonId) return;
    const normalizedDisplayName = displayName?.trim() || "Receiver Active Person";
    setActiveReceiverUsers((current) =>
      current.some((user) => user.id === normalizedPersonId)
        ? current
        : [
            {
              displayName: normalizedDisplayName,
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
      screenCleaningTheme,
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
    screenCleaningTheme,
    selectedContactId,
    selectedReceiverUserId,
    soundSettings,
    started,
  ]);

  useEffect(() => {
    if (readLocalTestReceiverProvisioning()) {
      const previewBinding = readReceiverLayoutPreviewBinding();
      if (previewBinding) {
        saveReceiverBinding(previewBinding);
        window.localStorage.setItem(
          receiverRegistrationStorageKey,
          previewBinding.mainConnectUserPersonId || "bound"
        );
        setReceiverRegistered(true);
        setReceiverLocationLabel(previewBinding.locationLabel || "");
        setPrimaryCoordinatorDisplayName(
          previewBinding.primaryCoordinatorDisplayName || fallbackPrimaryCoordinatorDisplayName
        );
        setReceiverContactDisplayName(previewBinding.receiverContactDisplayName || "");
        setReceiverContactUserId(previewBinding.receiverContactUserId || "");
        setReceiverContactIsReceiverUser(previewBinding.receiverContactIsReceiverUser === true);
        applyBoundReceiverActivePerson(
          previewBinding.mainConnectUserPersonId,
          previewBinding.mainConnectUserDisplayName
        );
        setReceiverSetupError("");
        return;
      }
      clearReceiverBinding();
      window.localStorage.setItem(receiverRegistrationStorageKey, "configuration-required");
      setReceiverRegistered(true);
      setActiveReceiverUsers([noMainConnectUser]);
      setSelectedReceiverUserId("");
    }
  }, []);

  useEffect(() => {
    if (readLocalTestReceiverProvisioning()) return;
    const receiverDeviceId = readReceiverDeviceId();
    const receiverInstallId = readReceiverInstallId();
    if (!receiverDeviceId || !receiverInstallId) {
      setReceiverBindingCheckPending(false);
      return;
    }
    let cancelled = false;
    let hasConfirmedBinding = false;
    setReceiverBindingCheckPending(true);

    async function verifyBinding() {
      try {
        const payload = await verifyReceiverBindingHeartbeat(hasConfirmedBinding ? "user" : "initial");
        if (!payload) return;
        if (cancelled) return;

        saveReceiverBinding(payload);
        setReceiverLocationLabel((current) => payload.locationLabel?.trim() || current);
        hasConfirmedBinding = true;
        setReceiverRegistered(true);
        setPrimaryCoordinatorDisplayName(
          payload.primaryCoordinatorDisplayName?.trim() || fallbackPrimaryCoordinatorDisplayName
        );
        setReceiverContactDisplayName(payload.receiverContactDisplayName?.trim() || "");
        setReceiverContactUserId(payload.receiverContactUserId?.trim() || "");
        setReceiverContactIsReceiverUser(payload.receiverContactIsReceiverUser === true);
        setReceiverBindingCheckPending(false);
        applyBoundReceiverActivePerson(
          payload.mainConnectUserPersonId,
          payload.mainConnectUserDisplayName
        );
        setReceiverSetupError("");
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Receiver setup could not be confirmed.";
        if (isReceiverSetupRequiredMessage(message)) {
          clearReceiverBinding();
          setReceiverRegistered(false);
          setActiveReceiverUsers(receiverUsers);
          setSelectedReceiverUserId("");
          setReceiverSetupError(message);
          setReceiverBindingCheckPending(false);
          return;
        }
        if (!hasConfirmedBinding) {
          setStatus("Receiver setup check is pending.");
        }
        setReceiverBindingCheckPending(false);
      }
    }

    void verifyBinding();

    function verifyBindingWhenActive() {
      if (document.hidden) return;
      void verifyBinding();
    }

    // Binding checks are startup/return-to-app safeguards, not idle polling.
    // They stop on unmount and run again only when the Receiver becomes active.
    window.addEventListener("focus", verifyBindingWhenActive);
    document.addEventListener("visibilitychange", verifyBindingWhenActive);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", verifyBindingWhenActive);
      document.removeEventListener("visibilitychange", verifyBindingWhenActive);
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
          locationLabel?: string;
          mainConnectUserPersonId?: string;
          mainConnectUserDisplayName?: string;
          primaryCoordinatorDisplayName?: string;
          receiverContactDisplayName?: string;
          receiverContactIsReceiverUser?: boolean;
          receiverContactUserId?: string;
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
          locationLabel: payload.locationLabel,
          mainConnectUserDisplayName: payload.mainConnectUserDisplayName,
          mainConnectUserPersonId: payload.mainConnectUserPersonId,
          primaryCoordinatorDisplayName: payload.primaryCoordinatorDisplayName,
          receiverContactDisplayName: payload.receiverContactDisplayName,
          receiverContactIsReceiverUser: payload.receiverContactIsReceiverUser,
          receiverContactUserId: payload.receiverContactUserId,
          receiverDeviceId: payload.receiverDeviceId,
          receiverInstallId: payload.receiverInstallId || readReceiverInstallId(),
          receiverUrl: payload.receiverUrl,
          storageSource: payload.storageSource,
          uiLayout: payload.uiLayout,
        });
        setReceiverLocationLabel((current) => payload.locationLabel?.trim() || current);
        window.localStorage.setItem(
          receiverRegistrationStorageKey,
          payload.mainConnectUserPersonId || "bound"
        );
        setReceiverRegistered(true);
        setPrimaryCoordinatorDisplayName(
          payload.primaryCoordinatorDisplayName?.trim() || fallbackPrimaryCoordinatorDisplayName
        );
        setReceiverContactDisplayName(payload.receiverContactDisplayName?.trim() || "");
        setReceiverContactUserId(payload.receiverContactUserId?.trim() || "");
        setReceiverContactIsReceiverUser(payload.receiverContactIsReceiverUser === true);
        setReceiverBindingCheckPending(false);
        applyBoundReceiverActivePerson(
          payload.mainConnectUserPersonId,
          payload.mainConnectUserDisplayName
        );
        setReceiverSetupError("");
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
          setReceiverBindingCheckPending(false);
        }
        setReceiverSetupError(message);
      }
    }

    void redeemClaim();

    return () => {
      cancelled = true;
    };
  }, [receiverRegistered]);

  useEffect(() => {
    if (
      !browserReceiverShouldRequestPairing({
        bindingCheckPending: receiverBindingCheckPending,
        hasReceiverIdentity:
          !receiverSetupError && Boolean(readReceiverDeviceId() && readReceiverInstallId()),
        hasSetupClaim: Boolean(readReceiverShellClaim()),
        localTestProvisioning: readLocalTestReceiverProvisioning(),
        receiverRegistered,
        receiverSessionRestored,
        selectedReceiverUserId,
        started,
      })
    ) {
      return undefined;
    }

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
      setReceiverLocationLabel((current) => payload.locationLabel?.trim() || current);
      setReceiverRegistered(true);
      setReceiverBindingCheckPending(false);
      applyBoundReceiverActivePerson(
        payload.mainConnectUserPersonId,
        payload.mainConnectUserDisplayName
      );
      setReceiverSetupError("");
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
            locationLabel: browserReceiverSetupLabel(),
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
  }, [
    receiverBindingCheckPending,
    receiverRegistered,
    receiverSetupError,
    receiverSessionRestored,
    selectedReceiverUserId,
    started,
  ]);

  useEffect(() => {
    let ignore = false;

    async function refreshReceiverUsers() {
      if (!receiverRegistered) return;
      const previewBinding = readReceiverLayoutPreviewBinding();
      if (previewBinding) {
        setPrimaryCoordinatorDisplayName(
          previewBinding.primaryCoordinatorDisplayName || fallbackPrimaryCoordinatorDisplayName
        );
        applyBoundReceiverActivePerson(
          previewBinding.mainConnectUserPersonId,
          previewBinding.mainConnectUserDisplayName
        );
        return;
      }
      try {
        const context = await fetchConnectMainUserContext();
        setPrimaryCoordinatorDisplayName(
          context.primaryCoordinator?.displayName?.trim() ||
            fallbackPrimaryCoordinatorDisplayName
        );
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
          const storedBinding = readStoredReceiverBinding();
          const boundPersonId = storedBinding.mainConnectUserPersonId?.trim() || "";
          if (boundPersonId) {
            applyBoundReceiverActivePerson(
              boundPersonId,
              storedBinding.mainConnectUserDisplayName
            );
          } else {
            setActiveReceiverUsers([noMainConnectUser]);
            setSelectedReceiverUserId("");
          }
        }
      }
    }

    void refreshReceiverUsers();

    return () => {
      ignore = true;
    };
  }, [receiverRegistered]);

  useEffect(() => {
    if (!started || !selectedReceiverUserId) return undefined;

    const firstRefresh = window.setTimeout(() => {
      void refreshMessages("initial");
    }, 0);

    return () => window.clearTimeout(firstRefresh);
  }, [refreshMessages, selectedReceiverUserId, started]);

  useEffect(() => {
    const readingMessages = modal?.type === "allMessages" || modal?.type === "reader";
    if (!started || !selectedReceiverUserId || !readingMessages) return undefined;

    let cancelled = false;
    let timer: number | undefined;
    let inFlight = false;

    async function pollMessages() {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        await refreshMessages("poll");
      } finally {
        inFlight = false;
        if (!cancelled) {
          const nextInterval = connectPollingIntervalMs({
            hidden: document.hidden,
            intervalMs: connectPollingIntervals.receiverMessagesMs,
            prerequisitesMet: Boolean(selectedReceiverUserId),
          });
          if (nextInterval !== null) {
            timer = window.setTimeout(pollMessages, nextInterval);
          }
        }
      }
    }

    function rescheduleForVisibility() {
      if (cancelled) return;
      if (timer) window.clearTimeout(timer);
      const nextInterval = connectPollingIntervalMs({
        hidden: document.hidden,
        intervalMs: connectPollingIntervals.receiverMessagesMs,
        prerequisitesMet: Boolean(selectedReceiverUserId),
      });
      if (nextInterval !== null) timer = window.setTimeout(pollMessages, nextInterval);
    }

    // Message polling is limited to active reading surfaces. The idle Receiver
    // home loads messages on entry/explicit actions but does not poll.
    timer = window.setTimeout(pollMessages, 0);
    document.addEventListener("visibilitychange", rescheduleForVisibility);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", rescheduleForVisibility);
    };
  }, [modal?.type, refreshMessages, selectedReceiverUserId, started]);

  useEffect(() => {
    if (!started || !deskPhoneMode || !["ask_tell", "ask_tell_2", "focus_v1"].includes(gxvHomeLayout)) {
      return undefined;
    }
    if (!selectedReceiverUserId) return undefined;

    // Today's Focus is durable daily context, not urgent state. It loads once
    // for the home surface and refreshes explicitly after Focus actions.
    const firstRefresh = window.setTimeout(() => {
      void refreshTodayFocus("initial");
    }, 0);

    return () => window.clearTimeout(firstRefresh);
  }, [deskPhoneMode, gxvHomeLayout, refreshTodayFocus, selectedReceiverUserId, started]);

  useEffect(() => {
    // Connect calls are deprecated for now. Keep the call UI code recoverable,
    // but do not poll /api/connect/calls from always-on Receiver devices.
    void connectCallsDeprecated;
    void started;
    void refreshCalls;
    return undefined;
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
    // Receiver Guide is intentionally disabled while the feature is deprecated.
    // Future work can restore this as an opt-in/debug-only realtime channel.
    if (connectReceiverGuideDeprecated) return undefined;
    if (!started) return undefined;
    let cancelled = false;
    let timer: number | undefined;
    let inFlight = false;
    const receiverId = readReceiverGuideId();
    const receiverSessionId = readReceiverGuideSessionId();

    async function syncReceiverGuideState() {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        recordConnectPollingRequest({
          caller: "connect_receiver_guide",
          endpoint: receiverGuideEndpoint,
          reason: "poll",
        });
        await fetch(receiverGuideEndpoint, {
          body: JSON.stringify({
            action: "presence",
            deviceProfile: deskPhoneMode ? "gxv3370" : "default",
            pageUrl: window.location.pathname + window.location.search,
            receiverId,
            receiverSessionId,
            uiLayout: gxvAskTell2HomeEnabled
              ? "desk_phone_ask_tell_2"
              : gxvAskTellHomeEnabled
              ? "desk_phone_ask_tell"
              : gxvFocusHomeEnabled
                ? "desk_phone_focus_v1"
                : "default_receiver",
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
      } finally {
        inFlight = false;
        if (!cancelled) {
          const nextInterval = connectPollingIntervalMs({
            hidden: document.hidden,
            intervalMs: connectPollingIntervals.receiverGuideMs,
          });
          if (nextInterval !== null) {
            timer = window.setTimeout(syncReceiverGuideState, nextInterval);
          }
        }
      }
    }

    timer = window.setTimeout(syncReceiverGuideState, 0);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [started]);

  const contacts = useMemo<Contact[]>(
    () => {
      const missingContact = !receiverContactUserId || !receiverContactDisplayName.trim();
      const disabledReason = receiverContactIsReceiverUser
        ? selfContactMessage
        : missingContact
          ? "Receiver contact setup is required."
          : "";

      return [
        {
          ...fallbackContacts[0],
          availability: disabledReason ? "away" : fallbackContacts[0].availability,
          availabilityLabel: disabledReason ? "Unavailable" : fallbackContacts[0].availabilityLabel,
          canCall: !disabledReason && fallbackContacts[0].canCall,
          disabledReason,
          displayName: receiverContactDisplayName.trim() || "Receiver contact",
          id: receiverContactUserId || primaryCoordinatorContactId,
          userId: receiverContactUserId,
        },
      ];
    },
    [receiverContactDisplayName, receiverContactIsReceiverUser, receiverContactUserId]
  );
  const askTellExamples = useMemo(
    () => receiverAskTellExamples(contacts[0].displayName),
    [contacts]
  );
  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? contacts[0],
    [contacts, selectedContactId]
  );
  const visibleReceiverUsers = activeReceiverUsers.slice(0, 4);
  const selectedReceiverUser =
    visibleReceiverUsers.find((user) => user.id === selectedReceiverUserId) ??
    noMainConnectUser;
  const selectedReceiverGreetingName = receiverGreetingDisplayName(
    selectedReceiverUser.displayName,
    activeReceiverUsers
  );
  const receiverCommunicationDisabledReason = selectedContact.disabledReason || "";
  useEffect(() => {
    if (
      !receiverDiagnosticMode ||
      !attemptDiagnosticOpen ||
      !attemptDiagnosticSummary.attemptId ||
      !selectedReceiverUser.id
    ) {
      return;
    }
    void loadPlatformReviews();
  }, [
    attemptDiagnosticOpen,
    attemptDiagnosticSummary.attemptId,
    receiverDiagnosticMode,
    selectedReceiverUser.id,
  ]);
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
  });
  const latestReadMessage = messages.find(
    (message) =>
      message.readAt &&
      !message.callbackRequestedAt &&
      (!message.requiresAcknowledgement || message.acknowledgedAt)
  );
  const receiverNotificationMessage =
    attentionItem?.kind === "new_message" ? attentionItem.message : latestReadMessage;
  const messageHomeCount = messages.length;
  const reviewHomeCount = attentionItem ? 1 : 0;
  const messageHomeLabel = messageHomeCount > 0 ? `Messages (${messageHomeCount})` : "Messages";
  const reviewHomeLabel = reviewHomeCount > 0 ? `Review (${reviewHomeCount})` : "Review";
  const receiverNotificationText = !receiverOnline
    ? "Internet connection lost. Some features are unavailable."
    : attentionItem?.kind === "new_message"
      ? receiverMessageNotificationText(attentionItem.message, {
          fallbackName: selectedContact.displayName,
          important: true,
          primaryCoordinatorName: fallbackPrimaryCoordinatorDisplayName,
        })
      : latestReadMessage
        ? receiverMessageNotificationText(latestReadMessage, {
            fallbackName: selectedContact.displayName,
            important: false,
            primaryCoordinatorName: fallbackPrimaryCoordinatorDisplayName,
          })
      : "";
  const receiverIdentityDisplay = readReceiverIdentityDisplay(receiverLocationLabel);
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

  function chooseGxvHomeLayout(nextLayout: GxvHomeLayout) {
    setGxvHomeLayout(nextLayout);
    setLayoutMenuOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("receiver_runtime", "modern_web");
      url.searchParams.set("device", "gxv3370");
      url.searchParams.set("hardwareProfile", "grandstream_gxv3370");
      url.searchParams.set("uiLayout", "desk_phone_1024x600");
      url.searchParams.delete("receiverLayout");
      if (nextLayout === "classic") {
        url.searchParams.delete("homeLayout");
      } else {
        url.searchParams.set("homeLayout", nextLayout);
      }
      if (!deskPhoneMode) {
        window.location.assign(url.toString());
        return;
      }
      window.history.replaceState(null, "", url.toString());
    }
    if (nextLayout === "focus_v1" || nextLayout === "ask_tell" || nextLayout === "ask_tell_2") {
      resetTodayFocusList(todayFocusItems);
      void refreshTodayFocus("initial");
    }
  }

  function chooseReceiverPresentationLayout(nextLayout: ReceiverPresentationLayout) {
    setLayoutMenuOpen(false);
    if (nativeReceiverShell) return;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("receiver_runtime", "modern_web");
    url.searchParams.set("device", "web");
    url.searchParams.set("hardwareProfile", "web");
    url.searchParams.set("uiLayout", "default_receiver");
    url.searchParams.set("receiverLayout", nextLayout);
    url.searchParams.delete("homeLayout");
    if (deskPhoneMode) {
      window.location.assign(url.toString());
      return;
    }
    setReceiverPresentationLayout(nextLayout);
    window.history.replaceState(null, "", url.toString());
  }

  function chooseApprovedReceiverStyle(nextLayout: ReceiverApprovedStyleLayout) {
    if (nextLayout === "appliance") {
      chooseGxvHomeLayout("ask_tell_2");
      return;
    }
    chooseReceiverPresentationLayout("modern");
  }

  function renderReceiverLayoutMenu() {
    if (nativeReceiverShell) return null;
    if (!layoutMenuOpen) return null;

    return (
      <div className={styles.receiverLayoutMenu} role="menu" aria-label="Receiver style">
        <button
          type="button"
          role="menuitemradio"
          aria-checked={deskPhoneMode && gxvHomeLayout === "ask_tell_2"}
          onClick={(event) => {
            event.stopPropagation();
            chooseGxvHomeLayout("ask_tell_2");
          }}
        >
          Appliance
        </button>
        <button
          type="button"
          role="menuitemradio"
          aria-checked={receiverModernPresentationEnabled}
          onClick={(event) => {
            event.stopPropagation();
            chooseApprovedReceiverStyle("modern");
          }}
        >
          Modern
        </button>
      </div>
    );
  }

  function renderTodayFocusHomeContent(title = "Today's Focus", headerAction?: ReactNode) {
    return todayFocusDisplayMode === "items" ? (
      <>
        <div className={styles.todayFocusHeader}>
          <h2>{title}</h2>
          {headerAction}
        </div>
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
          undoneItemIds={todayFocusRecentlyUndoneIds}
          variant="receiver"
        />
      </>
    ) : todayFocusDisplayMode === "loading" ? (
      <div className={styles.todayFocusLoadingState}>
        <div className={styles.todayFocusHeader}>
          <h2>{title}</h2>
          {headerAction}
        </div>
        <p>Loading...</p>
      </div>
    ) : (
      <div className={styles.brainStretchPrompt}>
        <h2>Brain Stretch</h2>
        {todayFocusStatus ? <p>{todayFocusStatus}</p> : null}
        <p>{brainStretchPrompt}</p>
      </div>
    );
  }

  function completeTodayFocusItem(item: ReceiverTodayFocusHomeItem) {
    clearGuideBecauseReceiverActed();
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    if (receiverCommunicationDisabledReason) {
      setStatus(receiverCommunicationDisabledReason);
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
    setTodayFocusPendingCompletions((current) => ({
      ...current,
      [item.id]: { trackEventId: null },
    }));
    scheduleTodayFocusCompletionExpiry(item.id);

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

      if (!response.ok) {
        reportReceiverSessionLoss(response, "Receiver Today’s Focus authentication was rejected.");
        throw new Error(payload.error || "Today’s Focus could not be saved.");
      }

      if (payload.ok === false) {
        throw new Error(payload.error || "Today’s Focus could not be saved.");
      }

      const trackEventId = String(payload.trackEvent?.id || "");
      if (!trackEventId) {
        throw new Error("Today’s Focus was saved, but Undo is not available.");
      }

      setTodayFocusPendingCompletions((current) =>
        current[item.id]
          ? {
              ...current,
              [item.id]: { trackEventId },
            }
          : current
      );
      setStatus(`${item.title} saved.`);
    } catch (error) {
      console.warn("Today’s Focus saved locally on Receiver only.", error);
      setStatus(`${item.title} marked done.`);
    } finally {
      setTodayFocusCompletingId("");
    }
  }

  function scheduleTodayFocusCompletionExpiry(focusItemId: string) {
    clearTodayFocusCompletionTimer(focusItemId);
    todayFocusCompletionTimersRef.current[focusItemId] = window.setTimeout(() => {
      setTodayFocusPendingCompletions((current) => {
        const next = { ...current };
        delete next[focusItemId];
        return next;
      });
      setTodayFocusCompletedIds((current) =>
        current.includes(focusItemId) ? current : [...current, focusItemId]
      );
      delete todayFocusCompletionTimersRef.current[focusItemId];
    }, todayFocusUndoWindowMs);
  }

  function showTodayFocusUndoCompleted(focusItemId: string) {
    clearTodayFocusUndoneTimer(focusItemId);
    setTodayFocusRecentlyUndoneIds((current) =>
      current.includes(focusItemId) ? current : [...current, focusItemId]
    );
    todayFocusUndoneTimersRef.current[focusItemId] = window.setTimeout(() => {
      setTodayFocusRecentlyUndoneIds((current) =>
        current.filter((undoneId) => undoneId !== focusItemId)
      );
      delete todayFocusUndoneTimersRef.current[focusItemId];
    }, 1500);
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
    showTodayFocusUndoCompleted(item.id);
    setStatus(`Undoing ${item.title}.`);

    if (!pendingCompletion.trackEventId) {
      setTodayFocusCompletedIds((current) =>
        current.filter((completedId) => completedId !== item.id)
      );
      setStatus(`${item.title} unchecked.`);
      return;
    }

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

      if (!response.ok) {
        reportReceiverSessionLoss(response, "Receiver Today’s Focus authentication was rejected.");
        throw new Error(payload.error || "Today’s Focus could not be undone.");
      }

      if (payload.ok === false) {
        throw new Error(payload.error || "Today’s Focus could not be undone.");
      }

      setTodayFocusCompletedIds((current) =>
        current.filter((completedId) => completedId !== item.id)
      );
      setStatus(`${item.title} unchecked.`);
    } catch (error) {
      clearTodayFocusUndoneTimer(item.id);
      setTodayFocusRecentlyUndoneIds((current) =>
        current.filter((undoneId) => undoneId !== item.id)
      );
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

      if (!response.ok) {
        reportReceiverSessionLoss(response, "Receiver Today’s Focus authentication was rejected.");
        throw new Error(payload.error || "Today’s Focus preference could not be saved.");
      }

      if (payload.ok === false) {
        throw new Error(payload.error || "Today’s Focus preference could not be saved.");
      }

      setTodayFocusCompletedIds((current) =>
        current.includes(item.id) ? current : [...current, item.id]
      );
      setTodayFocusPreferenceItem(null);
      setTodayFocusPreferenceStep("main");
      setTodayFocusStatus("CarePland will adjust how often this appears.");
      void refreshTodayFocus("user");
    } catch (error) {
      setTodayFocusStatus(
        error instanceof Error
          ? error.message
          : "Today’s Focus preference could not be saved."
      );
    }
  }

  async function chooseReceiverUser(user: ReceiverUser) {
    clearGuideBecauseReceiverActed();
    if (!user.id) return;
    try {
      const context = await updateConnectMainUserContext({
        mainConnectUserPersonId: user.id,
      });
      setPrimaryCoordinatorDisplayName(
        context.primaryCoordinator?.displayName?.trim() ||
          fallbackPrimaryCoordinatorDisplayName
      );
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
    if (contact.disabledReason) {
      setStatus(contact.disabledReason);
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
    if (contact.disabledReason) {
      setStatus(contact.disabledReason);
      return;
    }
    const trimmed = body.trim();
    if (!trimmed && !recording) {
      setStatus("Type or record your message first.");
      return;
    }
    if (!selectedReceiverUser.id) {
      setStatus("Receiver User setup is required before sending a message.");
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
                metadata: {
                  receiverContactUserId: contact.userId || "",
                },
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
                metadata: {
                  receiverContactUserId: contact.userId || "",
                },
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

      if (!response.ok) {
        reportReceiverSessionLoss(response, "Receiver message authentication was rejected.");
        throw new Error("CarePland needs to reconnect.");
      }

      if (payload.message) {
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
      setStatus(
        sessionValidityStore.getSnapshot().state === "session_lost"
          ? "CarePland needs to reconnect."
          : `Message saved here. ${contact.displayName} may see it when Connect is online.`
      );
    }

    setModal({ type: "sent", recipientName: contact.displayName });
    void refreshMessages("user");
  }

  function openAsk() {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    if (receiverCommunicationDisabledReason) {
      setStatus(receiverCommunicationDisabledReason);
      return;
    }
    clearGuideBecauseReceiverActed();
    setAskDraftObservationModality("typed");
    setAskDraft("");
    setPendingAskAudio(null);
    setModal({ type: "ask" });
  }

  function openAskTell() {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    clearGuideBecauseReceiverActed();
    setPendingAskAudio(null);
    if (askDraft.trim()) {
      setModal({ type: "ask", surface: "ask_tell" });
      setStatus("Ask/Tell message restored.");
      return;
    }
    setAskDraftObservationModality("typed");
    setAskDraft("");
    setModal({ type: "ask", surface: "ask_tell" });
    setPendingAskAudio(null);
    const autoStartToken = receiverRecordingStartTokenRef.current + 1;
    receiverRecordingStartTokenRef.current = autoStartToken;
    void startReceiverRecording("ask_tell", {
      autoStartToken,
      autoStartWindowMs: 2000,
    });
  }

  function resetReceiverChunkTranscript() {
    receiverChunkTranscriptRef.current = {
      active: false,
      assembledText: "",
      chunks: {},
    };
  }

  function applyReceiverChunkTranscript(chunkIndex: number, transcript: string) {
    const chunkState = receiverChunkTranscriptRef.current;
    if (!chunkState.active) return;
    const nextTranscript = transcript.trim();
    if (!nextTranscript) return;

    chunkState.chunks[chunkIndex] = nextTranscript;
    const assembledText = Object.keys(chunkState.chunks)
      .map(Number)
      .sort((left, right) => left - right)
      .map((index) => chunkState.chunks[index])
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, RECEIVER_SPEECH_TRANSCRIPT_MAX_LENGTH);
    chunkState.assembledText = assembledText;
  }

  async function transcribeReceiverRecordingChunk(chunk: ConnectAudioRecordingChunk) {
    if (!selectedReceiverUser.id) return;
    try {
      const clientAudioCaptureId =
        receiverCaptureIdRef.current || createConnectAudioCaptureId("receiver-ask-input");
      const transcription = await requestConnectAudioTranscription({
        artifactKind: "ask_input_chunk",
        audioDirection: "receiver_local_input",
        captureContext: createConnectAudioCaptureContext(chunk, {
          artifactKind: "ask_input_chunk",
          audioDirection: "receiver_local_input",
          clientAudioCaptureId,
          role: "receiver_user",
          surface: "receiver_ask_tell_chunk",
        }),
        clientAudioCaptureId,
        durationMs: chunk.durationMs,
        mainConnectUserPersonId: selectedReceiverUser.id,
        mimeType: chunk.mimeType,
        receiverId: connectPrototypeReceiverId,
        recording: chunk.blob,
        source: "ask-tell-chunk",
      });
      applyReceiverChunkTranscript(chunk.chunkIndex, String(transcription.transcript || ""));
    } catch {
      // Chunk transcription is opportunistic; final transcription still runs after stop.
    }
  }

  function sendCondensedSpeechMessage(
    condensation: ReceiverMessageCondensationModal,
    draft: string
  ) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    const finalMessage = limitReceiverCondensedMessageEdit(draft).trim();
    if (!finalMessage) {
      setStatus("Review the message before sending.");
      return;
    }
    const contact =
      contacts.find((item) => item.id === condensation.contactId) ?? contacts[0];
    const edited = finalMessage !== condensation.initialDraft.trim();
    if (edited) {
      recordInteractionAttemptEvent("message_condensation_draft_edited", {
        editedDraft: finalMessage,
        initialDraft: condensation.initialDraft,
        originalTranscriptLength: condensation.originalLength,
      });
    }
    recordInteractionAttemptEvent("message_condensation_approved", {
      edited,
      finalMessage,
      originalTranscriptLength: condensation.originalLength,
    });
    recordInteractionAttemptEvent("send_selected", {
      finalMessageLength: finalMessage.length,
      recipient: contact.displayName,
      source: "message_condensation",
    });
    recordInteractionAttemptEvent(
      "workflow_completed",
      {
        outcome: "communicated",
        recipient: contact.displayName,
        source: "message_condensation",
      },
      { terminal: true }
    );
    setPendingAskAudio(null);
    void sendMessage(contact, finalMessage);
  }

  function cancelCondensedSpeechMessage(condensation: ReceiverMessageCondensationModal) {
    recordInteractionAttemptEvent(
      "cancelled",
      {
        originalTranscriptLength: condensation.originalLength,
        reason: "message_condensation_cancelled",
      },
      { terminal: true }
    );
    setPendingAskAudio(null);
    setModal({ type: "ask", surface: "ask_tell" });
    setStatus("Message was not sent.");
  }

  async function prepareLongSpeechMessageCondensation(transcript: string) {
    const condensation = condenseReceiverSpeechMessage({
      maxLength: RECEIVER_SPEECH_CONDENSATION_DRAFT_MAX_LENGTH,
      transcript,
    });
    const contact = contacts[0];

    await submitObservation(
      {
        activeWorkflow: "ask_tell",
        deviceId: readReceiverDeviceId(),
        metadata: {
          condenser: condensation.method,
          messageCondensationTriggered: true,
          originalTranscriptLength: condensation.originalLength,
          receiverInstallId: readReceiverInstallId(),
          speechCondensationLimit: RECEIVER_SPEECH_CONDENSATION_LIMIT,
          speechCondensationDraftMaxLength: RECEIVER_SPEECH_CONDENSATION_DRAFT_MAX_LENGTH,
          condensedMessageEditMaxLength: RECEIVER_CONDENSED_MESSAGE_EDIT_MAX_LENGTH,
          surface: "ask_tell",
        },
        modality: "speech",
        personId: selectedReceiverUser.id || null,
        source: "receiver",
        surface: "receiver_ask_tell",
        text: transcript,
      },
      {
        handleSpeech: async (observation, meaningFrame) => {
          const attemptId = await recordInteractionAttemptObservation(observation);
          if (attemptId) {
            recordInteractionAttemptEvent("message_condensation_triggered", {
              condensedDraft: condensation.draft,
              condenser: condensation.method,
              draftMaxLength: RECEIVER_SPEECH_CONDENSATION_DRAFT_MAX_LENGTH,
              editMaxLength: RECEIVER_CONDENSED_MESSAGE_EDIT_MAX_LENGTH,
              limit: RECEIVER_SPEECH_CONDENSATION_LIMIT,
              normalizedText: meaningFrame.normalizedText,
              originalTranscriptLength: condensation.originalLength,
            });
            recordInteractionAttemptEvent("response_presented", {
              condensedDraft: condensation.draft,
              originalTranscriptLength: condensation.originalLength,
              responseType: "message_condensation",
              result: "message_condensation_draft",
              route: "receiver_speech_message_condensation",
            });
          }
          return { handled: true, result: "message_condensation_draft" };
        },
        handleText: () => "message_condensation_draft",
      }
    );

    setAskDraftObservationModality("speech");
    setAskDraft("");
    setModal({
      contactId: contact.id,
      draft: condensation.draft,
      initialDraft: condensation.draft,
      limit: RECEIVER_CONDENSED_MESSAGE_EDIT_MAX_LENGTH,
      originalLength: condensation.originalLength,
      originalTranscript: transcript,
      type: "messageCondensation",
    });
    setStatus("Long speech was condensed. Review before sending.");
  }

  async function loadUpcomingAppointments(): Promise<ReceiverAppointmentDisplayState> {
    if (!selectedReceiverUser.id) {
      return { appointments: [], source: "online" };
    }
    if (readReceiverLayoutPreviewMode()) {
      const previewDisplay: ReceiverAppointmentDisplayState = {
        appointments: [receiverLayoutPreviewAppointment()],
        source: "fallback",
      };
      setAppointmentDisplay(previewDisplay);
      return previewDisplay;
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

  async function startReceiverRecording(
    surface?: "ask_tell",
    options: { autoStartToken?: number; autoStartWindowMs?: number } = {}
  ) {
    clearGuideBecauseReceiverActed();
    const startedAtMs = Date.now();
    const startToken =
      options.autoStartToken ?? (receiverRecordingStartTokenRef.current += 1);
    const askTellSurface =
      surface === "ask_tell" ||
      (modal?.type === "ask" && modal.surface === "ask_tell") ||
      (modal?.type === "askRecordReview" && modal.surface === "ask_tell");

    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }

    if (receiverRecording) {
      await stopReceiverRecording();
      return;
    }

    if (receiverTalkOperationRef.current) {
      return;
    }

    if (!browserConnectAudioRecordingAvailable()) {
      setStatus("Recording is not available on this browser. Typing still works.");
      setModal({ type: "ask", surface: askTellSurface ? "ask_tell" : undefined });
      return;
    }

    if (!selectedReceiverUser.id) {
      setStatus("Choose a Main Connect User before recording.");
      setModal({ type: "ask", surface: askTellSurface ? "ask_tell" : undefined });
      return;
    }

    try {
      receiverAskExitRequestedRef.current = false;
      const deferVisibleRecordingState = options.autoStartToken !== undefined;
      const captureId = createConnectAudioCaptureId("receiver-ask-input");
      receiverCaptureIdRef.current = captureId;
      receiverRecordingSurfaceRef.current = askTellSurface ? "ask_tell" : null;
      if (!askTellSurface) {
        setAskDraftObservationModality("typed");
        setAskDraft("");
      }
      setPendingAskAudio(null);
      setModal(
        askTellSurface
          ? { type: "ask", surface: "ask_tell" }
          : { type: "askRecordReview", transcript: "" }
      );
      setReceiverRecording(!deferVisibleRecordingState);
      setReceiverRecordingProcessing(false);
      setStatus(
        deferVisibleRecordingState
          ? "Starting microphone."
          : askTellSurface
            ? "Listening. You can also type or choose an example."
            : "Recording. Press the mic again to stop."
      );
      if (askTellSurface && !deferVisibleRecordingState) {
        receiverChunkTranscriptRef.current = {
          active: true,
          assembledText: "",
          chunks: {},
        };
      }
      const controller = await startConnectAudioRecording({
        chunkIntervalMs: askTellSurface ? 5000 : undefined,
        maxDurationMs: askTellSurface ? RECEIVER_ASK_TELL_RECORDING_MAX_DURATION_MS : 30000,
        onChunk: askTellSurface
          ? (chunk) => {
              void transcribeReceiverRecordingChunk(chunk);
            }
          : undefined,
        onAutoStop: (reason) => {
          void stopReceiverRecording(reason);
        },
        silenceGraceMs: 1200,
        silenceThreshold: 0.018,
        stopAfterSilenceMs: 10000,
      });
      const autoStartExpired =
        options.autoStartToken !== undefined &&
        (receiverRecordingStartTokenRef.current !== startToken ||
          Date.now() - startedAtMs > (options.autoStartWindowMs ?? 2000) ||
          modalRef.current?.type !== "ask" ||
          modalRef.current.surface !== "ask_tell");
      const startInvalidated =
        options.autoStartToken === undefined &&
        receiverRecordingStartTokenRef.current !== startToken;
      if (startInvalidated) {
        controller.cancel();
        resetReceiverChunkTranscript();
        receiverCaptureIdRef.current = "";
        receiverRecordingSurfaceRef.current = null;
        setReceiverRecording(false);
        return;
      }
      if (autoStartExpired) {
        controller.cancel();
        resetReceiverChunkTranscript();
        receiverCaptureIdRef.current = "";
        receiverRecordingSurfaceRef.current = null;
        setReceiverRecording(false);
        return;
      }
      receiverRecordingControllerRef.current = controller;
      if (deferVisibleRecordingState) {
        setReceiverRecording(true);
        setStatus("Listening. You can also type or choose an example.");
        if (askTellSurface) {
          receiverChunkTranscriptRef.current = {
            active: true,
            assembledText: "",
            chunks: {},
          };
        }
      }
    } catch {
      resetReceiverChunkTranscript();
      receiverCaptureIdRef.current = "";
      receiverRecordingSurfaceRef.current = null;
      receiverRecordingControllerRef.current = null;
      setReceiverRecording(false);
      setStatus("Recording could not start. Typing still works.");
      setModal({ type: "ask", surface: askTellSurface ? "ask_tell" : undefined });
    }
  }

  async function stopReceiverRecording(reason?: "max_duration" | "silence") {
    const controller = receiverRecordingControllerRef.current;
    if (!controller) {
      setReceiverRecording(false);
      return;
    }
    const activeModal = modalRef.current;
    const askTellSurface =
      receiverRecordingSurfaceRef.current === "ask_tell" ||
      (activeModal?.type === "ask" && activeModal.surface === "ask_tell") ||
      (activeModal?.type === "askRecordReview" && activeModal.surface === "ask_tell");

    receiverRecordingControllerRef.current = null;
    receiverChunkTranscriptRef.current.active = false;
    setReceiverRecording(false);
    setReceiverRecordingProcessing(true);
    if (askTellSurface) {
      setModal({ type: "ask", surface: "ask_tell" });
    } else {
      setAskDraftObservationModality("speech");
      setAskDraft("Transcribing recording...");
      setModal({
        type: "askRecordReview",
        surface: activeModal?.type === "askRecordReview" ? activeModal.surface : undefined,
        transcript: "",
      });
    }
    setStatus(
      reason === "max_duration"
        ? "Time is up. Turning recording into text..."
        : askTellSurface
          ? "Turning speech into text..."
          : "Turning recording into text..."
    );
    const operation = startReceiverTalkOperation({
      draftLength: receiverChunkTranscriptRef.current.assembledText.trim().length,
      modality: "speech",
      requestLifecycle: "recording stopped; waiting on speech transcription",
      stage: "transcribing",
      surface: askTellSurface ? "ask_tell" : "ask",
    });

    try {
      const recording = await controller.stop();
      if (receiverAskExitRequestedRef.current) {
        return;
      }
      if (!recording.size) {
        setStatus("Recording was empty. Try again or type your request.");
        setModal({ type: "ask", surface: askTellSurface ? "ask_tell" : undefined });
        return;
      }

      if (!selectedReceiverUser.id) {
        setStatus("Choose a Main Connect User before transcribing this recording.");
        setModal({ type: "ask", surface: askTellSurface ? "ask_tell" : undefined });
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
      if (receiverAskExitRequestedRef.current) {
        return;
      }
      const transcript = limitReceiverSpeechTranscript(
        String(transcription.transcript || "").trim()
      );
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
      if (askTellSurface) {
        if (transcript.length > RECEIVER_SPEECH_CONDENSATION_LIMIT) {
          updateReceiverTalkOperation(operation, {
            draftLength: transcript.length,
            requestLifecycle:
              "recording transcribed; preparing long speech message review",
            stage: "condensing",
          });
          await prepareLongSpeechMessageCondensation(transcript);
          return;
        }
        if (transcript) {
          const chunkTranscript = receiverChunkTranscriptRef.current.assembledText.trim();
          setAskDraftObservationModality("speech");
          setAskDraft((current) => {
            const existing = current.trim();
            if (!existing || existing === "Transcribing recording...") return limitReceiverTextInput(transcript);
            if (chunkTranscript && existing === chunkTranscript) return limitReceiverTextInput(transcript);
            if (chunkTranscript && existing.endsWith(chunkTranscript)) {
              return limitReceiverTextInput(
                `${existing.slice(0, -chunkTranscript.length).trimEnd()}\n${transcript}`.trim()
              );
            }
            if (chunkTranscript && existing.includes(chunkTranscript)) {
              return limitReceiverTextInput(existing.replace(chunkTranscript, transcript));
            }
            if (existing.includes(transcript)) return limitReceiverTextInput(current);
            return limitReceiverTextInput(`${existing}\n${transcript}`);
          });
        }
        setModal({ type: "ask", surface: "ask_tell" });
      } else {
        setAskDraftObservationModality("speech");
        setAskDraft(limitReceiverTextInput(transcript));
        setModal(
          transcript
            ? {
                type: "askRecordReview",
                surface: activeModal?.type === "askRecordReview" ? activeModal.surface : undefined,
                transcript,
              }
            : { type: "ask", surface: activeModal?.type === "askRecordReview" ? activeModal.surface : undefined }
        );
      }
      setStatus(
        transcript
          ? askTellSurface
            ? "Speech added. You can edit, talk more, choose an example, or send."
            : "Recording saved and transcribed. Review or press Ask."
          : "Recording saved, but no transcript came back. You can type your request."
      );
    } catch (error) {
      setModal(
        askTellSurface
          ? { type: "ask", surface: "ask_tell" }
          : {
              type: "askRecordReview",
              surface: activeModal?.type === "askRecordReview" ? activeModal.surface : undefined,
              transcript: "",
            }
      );
      setStatus(error instanceof Error ? error.message : "Recording could not be transcribed.");
    } finally {
      receiverCaptureIdRef.current = "";
      receiverRecordingSurfaceRef.current = null;
      resetReceiverChunkTranscript();
      receiverAskExitRequestedRef.current = false;
      setReceiverRecordingProcessing(false);
      finishReceiverTalkOperation(operation);
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
        stopAfterSilenceMs: 10000,
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
      setContactDraft(limitReceiverTextInput(transcript || "Recorded voice message"));
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

  function openOptionalSoundsFromSettings() {
    resetSoundTestState();
    setModal({ type: "soundSettings", view: "settings" });
    setStatus("Optional sounds settings are open.");
  }

  function openReceiverSettings() {
    clearGuideBecauseReceiverActed();
    setLayoutMenuOpen(false);
    setModal({ type: "receiverSettings" });
    setStatus("Receiver settings are open.");
  }

  function openReceiverStyleSettings() {
    setModal({ type: "receiverSettings", view: "style" });
    setLayoutMenuOpen(false);
    setStatus("Receiver style settings are open.");
  }

  function openReceiverHelpReport() {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    clearGuideBecauseReceiverActed();
    setModal({ type: "receiverHelp" });
    setStatus("Something went wrong is open.");
  }

  async function toggleReceiverHelpRecording() {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    if (receiverHelpRecording) {
      await stopReceiverHelpRecording();
      return;
    }

    if (!browserConnectAudioRecordingAvailable()) {
      setStatus("Recording is not available on this browser. Typing still works.");
      return;
    }

    try {
      const captureId = createConnectAudioCaptureId("receiver-help-report");
      receiverHelpCaptureIdRef.current = captureId;
      setReceiverHelpRecording(true);
      setReceiverHelpRecordingProcessing(false);
      setStatus("Recording help note. Press Stop when done.");
      receiverHelpRecordingControllerRef.current = await startConnectAudioRecording({
        maxDurationMs: 60000,
        onAutoStop: () => {
          void stopReceiverHelpRecording("max_duration");
        },
        silenceGraceMs: 1200,
        silenceThreshold: 0.018,
        stopAfterSilenceMs: 12000,
      });
    } catch {
      receiverHelpCaptureIdRef.current = "";
      receiverHelpRecordingControllerRef.current = null;
      setReceiverHelpRecording(false);
      setStatus("Recording could not start. Typing still works.");
    }
  }

  async function stopReceiverHelpRecording(reason?: "max_duration" | "silence") {
    const controller = receiverHelpRecordingControllerRef.current;
    if (!controller) {
      setReceiverHelpRecording(false);
      return;
    }

    receiverHelpRecordingControllerRef.current = null;
    setReceiverHelpRecording(false);
    setReceiverHelpRecordingProcessing(true);
    setStatus(
      reason === "max_duration"
        ? "Time is up. Turning help note into text..."
        : "Turning help note into text..."
    );

    try {
      const recording = await controller.stop();
      if (!recording.size) {
        setStatus("Recording was empty. Try again or type a note.");
        return;
      }

      const clientAudioCaptureId =
        receiverHelpCaptureIdRef.current || createConnectAudioCaptureId("receiver-help-report");
      let transcript = "";
      let artifactId = "";

      try {
        const transcription = await requestConnectAudioTranscription({
          artifactKind: "receiver_message",
          audioDirection: "receiver_to_coordinator",
          captureContext: createConnectAudioCaptureContext(recording, {
            artifactKind: "receiver_message",
            audioDirection: "receiver_to_coordinator",
            clientAudioCaptureId,
            role: "receiver_user",
            surface: "receiver_help_report",
          }),
          clientAudioCaptureId,
          durationMs: recording.durationMs,
          mainConnectUserPersonId: selectedReceiverUser.id || undefined,
          mimeType: recording.mimeType,
          receiverId: connectPrototypeReceiverId,
          recording: recording.blob,
          source: "receiver-help-report",
        });
        const artifact = transcription.artifact;
        artifactId = String(artifact?.artifactId || artifact?.id || "");
        transcript = String(transcription.transcript || "").trim();
      } catch {
        transcript = artifactId
          ? `Voice help report recorded. Audio artifact: ${artifactId}.`
          : "Voice help report recorded, but CarePland could not turn it into text.";
      }

      setReceiverHelpDraft((current) => {
        const nextText = transcript || "Voice help report recorded.";
        return current.trim() ? `${current.trim()}\n${nextText}` : nextText;
      });
      setStatus(transcript ? "Help note added." : "Voice help note recorded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recording could not be processed.");
    } finally {
      receiverHelpCaptureIdRef.current = "";
      setReceiverHelpRecordingProcessing(false);
    }
  }

  async function submitReceiverHelpReport() {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    if (receiverHelpSubmitting) return;
    setReceiverHelpSubmitting(true);
    setStatus("Sending help report.");
    recordHelpDiagnosticsEvent("receiver_help_report_started");

    try {
      const packet = window.CarePlandHelpDiagnostics?.createPacket();
      const helpNote = receiverHelpDraft.trim();
      const result = await submitHelpDiagnostics(
        {
          happenedInstead: helpNote || "Receiver user requested help from the Receiver controls.",
          tryingToDo: "Use CarePland Receiver.",
        },
        packet
      );
      setStatus(`Help report sent. Reference ${result.referenceId}.`);
      setReceiverHelpDraft("");
      setModal(null);
      recordHelpDiagnosticsEvent("receiver_help_report_sent", {
        referenceId: result.referenceId,
      });
    } catch {
      setStatus("CarePland did not receive the help report.");
      recordHelpDiagnosticsEvent("receiver_help_report_failed");
    } finally {
      setReceiverHelpSubmitting(false);
    }
  }

  function openCleanScreenThemeSettings() {
    setModal({ type: "receiverSettings", view: "cleanScreenTheme" });
    setLayoutMenuOpen(false);
    setStatus("Clean Screen theme settings are open.");
  }

  function chooseGxvHomeLayoutFromSettings(nextLayout: GxvHomeLayout) {
    chooseGxvHomeLayout(nextLayout);
    setModal(null);
    setStatus("Receiver style updated.");
  }

  function chooseReceiverPresentationLayoutFromSettings(nextLayout: ReceiverPresentationLayout) {
    chooseReceiverPresentationLayout(nextLayout);
    setModal(null);
    setStatus("Receiver style updated.");
  }

  function chooseScreenCleaningThemeFromSettings(nextTheme: ScreenCleaningTheme) {
    setScreenCleaningTheme(nextTheme);
    setModal({ type: "receiverSettings" });
    setStatus("Clean Screen theme updated.");
  }

  function maximizeReceiverFromSettings() {
    setModal(null);
    void toggleReceiverFullscreen();
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
    if (deskPhoneMode && !kioskManagedFullscreen && !nativeReceiverShell) {
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

  async function markMessageState(
    message: Message,
    state: {
      acknowledged?: boolean;
      callbackRequested?: boolean;
      heard?: boolean;
      read?: boolean;
    }
  ) {
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
              acknowledgedAt:
                state.acknowledged ? item.acknowledgedAt || currentIsoTimestamp() : item.acknowledgedAt,
              callbackRequestedAt:
                state.callbackRequested
                  ? item.callbackRequestedAt || currentIsoTimestamp()
                  : item.callbackRequestedAt,
              heardAt: state.heard ? item.heardAt || currentIsoTimestamp() : item.heardAt,
              readAt: state.read ? currentIsoTimestamp() : item.readAt,
            }
          : item
      )
    );

    try {
      await fetch(messageStateUrl(message.id), {
        body: JSON.stringify({
          acknowledged: Boolean(state.acknowledged),
          callbackRequested: Boolean(state.callbackRequested),
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
    void markMessageState(message, { callbackRequested: true });
    setModal(null);
    setStatus(`Callback requested for ${message.from || "this message"}.`);
  }

  function acknowledgeMessage(message: Message) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    clearGuideBecauseReceiverActed();
    void markMessageState(message, { acknowledged: true });
    setModal(null);
    setStatus("Message acknowledged.");
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

  async function ensureInteractionAttempt() {
    if (interactionAttemptRef.current.attemptId) {
      return interactionAttemptRef.current.attemptId;
    }
    if (!selectedReceiverUser.id) return "";

    try {
      const response = await fetch(interactionAttemptEndpoint, {
        body: JSON.stringify({
          action: "start",
          activeWorkflow: "ask_tell",
          deviceId: readReceiverDeviceId(),
          metadata: {
            receiverInstallId: readReceiverInstallId(),
            receiverLayout: deskPhoneMode ? gxvHomeLayout : receiverPresentationLayout,
          },
          personId: selectedReceiverUser.id,
          receiverDeviceId: readReceiverDeviceId(),
          surface: "receiver_ask_tell",
        }),
        headers: {
          ...(await connectReceiverRequestHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        attemptId?: string;
      };
      const attemptId = payload.attemptId?.trim() || "";
      if (!response.ok || !attemptId) return "";
      interactionAttemptRef.current = {
        attemptId,
        latestObservationId: "",
        nextRevisionIndex: 0,
        pendingRevisionReason: "initial",
      };
      const startedAt = new Date().toISOString();
      setAttemptDiagnosticSummary({
        attemptId,
        completedAt: "",
        latestObservationId: "",
        outcome: "",
        revisionCount: 0,
        startedAt,
        status: "in_progress",
        surface: "Receiver / Ask-Tell",
      });
      setAttemptDiagnosticEntries([
        {
          at: startedAt,
          detail: `Surface: Receiver / ${deskPhoneMode ? gxvHomeLayout : receiverPresentationLayout}`,
          id: `${attemptId}:started`,
          label: "Interaction Attempt started",
        },
      ]);
      return attemptId;
    } catch {
      return "";
    }
  }

  function appendAttemptDiagnostic(label: string, detail: string) {
    setAttemptDiagnosticEntries((entries) => [
      ...entries,
      {
        at: new Date().toISOString(),
        detail,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        label,
      },
    ]);
  }

  function diagnosticPayloadSummary(payload: Record<string, unknown>) {
    const values = Object.entries(payload)
      .filter(([, value]) => value !== "" && value !== null && value !== undefined)
      .map(([key, value]) => `${key}: ${diagnosticPayloadValue(value)}`);
    return values.join(" · ");
  }

  function diagnosticPayloadValue(value: unknown) {
    if (Array.isArray(value) || (value && typeof value === "object")) {
      return JSON.stringify(value);
    }
    return String(value);
  }

  async function loadPlatformReviews() {
    const attemptId = attemptDiagnosticSummary.attemptId;
    if (!attemptId || !selectedReceiverUser.id) return;
    try {
      const response = await fetch(interactionAttemptEndpoint, {
        body: JSON.stringify({
          action: "list_reviews",
          attemptId,
          personId: selectedReceiverUser.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        analyses?: ReceiverPlatformReviewAnalysis[];
        error?: string;
        reviews?: ReceiverPlatformReview[];
      };
      if (!response.ok) {
        setPlatformReviewStatus(payload.error || "Sign in as an admin to view reviews.");
        return;
      }
      setPlatformReviews(Array.isArray(payload.reviews) ? payload.reviews : []);
      setPlatformReviewAnalyses(
        Array.isArray(payload.analyses) ? payload.analyses : []
      );
      setPlatformReviewStatus("");
    } catch {
      setPlatformReviewStatus("Unable to load Platform Reviews.");
    }
  }

  async function savePlatformReview() {
    const attemptId = attemptDiagnosticSummary.attemptId;
    const comment = platformReviewDraft.trim();
    if (!attemptId || !selectedReceiverUser.id || !comment) return;
    setPlatformReviewSaving(true);
    setPlatformReviewStatus("Saving review...");
    try {
      const response = await fetch(interactionAttemptEndpoint, {
        body: JSON.stringify({
          action: "record_review",
          attemptId,
          comment,
          metadata: {
            diagnosticSurface: "receiver_attempt_trace",
          },
          personId: selectedReceiverUser.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        analyses?: ReceiverPlatformReviewAnalysis[];
        error?: string;
        reviews?: ReceiverPlatformReview[];
      };
      if (!response.ok) {
        setPlatformReviewStatus(payload.error || "Unable to save Platform Review.");
        return;
      }
      setPlatformReviews(Array.isArray(payload.reviews) ? payload.reviews : []);
      setPlatformReviewAnalyses(
        Array.isArray(payload.analyses) ? payload.analyses : []
      );
      setPlatformReviewDraft("");
      setPlatformReviewStatus("Review saved.");
    } catch {
      setPlatformReviewStatus("Unable to save Platform Review.");
    } finally {
      setPlatformReviewSaving(false);
    }
  }

  async function analyzePlatformReview(reviewId: string) {
    const attemptId = attemptDiagnosticSummary.attemptId;
    if (!attemptId || !selectedReceiverUser.id || !reviewId) return;
    setPlatformReviewAnalyzingId(reviewId);
    setPlatformReviewStatus("Creating advisory analysis...");
    try {
      const response = await fetch(interactionAttemptEndpoint, {
        body: JSON.stringify({
          action: "analyze_review",
          attemptId,
          personId: selectedReceiverUser.id,
          reviewId,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        analyses?: ReceiverPlatformReviewAnalysis[];
        error?: string;
        reviews?: ReceiverPlatformReview[];
      };
      if (!response.ok) {
        setPlatformReviewStatus(payload.error || "Unable to create analysis.");
        return;
      }
      setPlatformReviews(Array.isArray(payload.reviews) ? payload.reviews : []);
      setPlatformReviewAnalyses(
        Array.isArray(payload.analyses) ? payload.analyses : []
      );
      setPlatformReviewStatus("Advisory analysis saved.");
    } catch {
      setPlatformReviewStatus("Unable to create analysis.");
    } finally {
      setPlatformReviewAnalyzingId("");
    }
  }

  async function recordInteractionAttemptObservation(
    observation: ReturnType<typeof createObservation>
  ) {
    const attemptId = await ensureInteractionAttempt();
    if (!attemptId || !selectedReceiverUser.id || !observation.observationId) return "";
    const observationId = observation.observationId;

    const revisionIndex = interactionAttemptRef.current.nextRevisionIndex;
    const parentObservationId = interactionAttemptRef.current.latestObservationId;
    const revisionReason =
      revisionIndex === 0
        ? "initial"
        : interactionAttemptRef.current.pendingRevisionReason;

    try {
      await fetch(interactionAttemptEndpoint, {
        body: JSON.stringify({
          action: "record_observation",
          attemptId,
          observation,
          parentObservationId,
          personId: selectedReceiverUser.id,
          receiverDeviceId: readReceiverDeviceId(),
          receiverInstallId: readReceiverInstallId(),
          revisionIndex,
          revisionReason,
        }),
        headers: {
          ...(await connectReceiverRequestHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      interactionAttemptRef.current = {
        attemptId,
        latestObservationId: observationId,
        nextRevisionIndex: revisionIndex + 1,
        pendingRevisionReason: "retry",
      };
      setAttemptDiagnosticSummary((summary) => ({
        ...summary,
        attemptId,
        latestObservationId: observationId,
        revisionCount: revisionIndex + 1,
        status: "in_progress",
      }));
      appendAttemptDiagnostic(
        revisionIndex === 0 ? "Observation" : "Revised Observation",
        [
          `"${observation.transcriptText || observation.rawText}"`,
          `Modality: ${observation.modality}`,
          `Revision: ${revisionIndex + 1}`,
          revisionIndex > 0 ? `Reason: ${revisionReason}` : "",
          parentObservationId ? `Parent: ${parentObservationId}` : "",
          `Observation ID: ${observationId}`,
        ]
          .filter(Boolean)
          .join("\n")
      );
      return attemptId;
    } catch {
      return "";
    }
  }

  function prepareInteractionAttemptRevision(reason: ReceiverAttemptRevisionReason) {
    interactionAttemptRef.current = {
      ...interactionAttemptRef.current,
      pendingRevisionReason: reason,
    };
  }

  function clearInteractionAttempt(attemptId: string) {
    if (interactionAttemptRef.current.attemptId !== attemptId) return;
    interactionAttemptRef.current = {
      attemptId: "",
      latestObservationId: "",
      nextRevisionIndex: 0,
      pendingRevisionReason: "initial",
    };
    setAttemptDiagnosticSummary((summary) => ({
      ...summary,
      completedAt: new Date().toISOString(),
      status: "completed",
    }));
  }

  function recordInteractionAttemptEvent(
    eventType: ReceiverAttemptEventType,
    payload: Record<string, unknown> = {},
    options: { terminal?: boolean } = {}
  ) {
    const attemptId = interactionAttemptRef.current.attemptId;
    if (!attemptId || !selectedReceiverUser.id) return;
    const observationId = interactionAttemptRef.current.latestObservationId;
    if (options.terminal) {
      setAttemptDiagnosticSummary((summary) => ({
        ...summary,
        completedAt: new Date().toISOString(),
        outcome:
          typeof payload.outcome === "string"
            ? payload.outcome
            : eventType === "workflow_completed"
              ? "completed"
              : eventType.replaceAll("_", " "),
        status: "completed",
      }));
    }
    appendAttemptDiagnostic(
      eventType === "response_presented"
        ? "Presented response"
        : eventType === "not_helpful_selected"
          ? "User action"
          : eventType === "rephrase_selected"
            ? "User action"
            : eventType === "send_selected"
              ? "User action"
              : eventType === "workflow_completed"
                ? "Final outcome"
                : eventType.replaceAll("_", " "),
      diagnosticPayloadSummary({
        ...payload,
        observationId,
      })
    );

    void (async () => {
      try {
        await fetch(interactionAttemptEndpoint, {
          body: JSON.stringify({
            action: "record_event",
            actorRole: "receiver_user",
            attemptId,
            eventType,
            observationId,
            payload,
            personId: selectedReceiverUser.id,
            receiverDeviceId: readReceiverDeviceId(),
            receiverInstallId: readReceiverInstallId(),
          }),
          headers: {
            ...(await connectReceiverRequestHeaders()),
            "Content-Type": "application/json",
          },
          method: "POST",
        });
      } catch {
        // Interaction Attempts are diagnostic only and must not affect Receiver behavior.
      } finally {
        if (options.terminal) {
          clearInteractionAttempt(attemptId);
        }
      }
    })();
  }

  function startReceiverTalkOperation(
    operation: Omit<ReceiverTalkOperation, "id">
  ) {
    const nextOperation: ReceiverTalkOperation = {
      ...operation,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    receiverTalkOperationRef.current = nextOperation;
    setReceiverTalkOperation(nextOperation);
    return nextOperation;
  }

  function finishReceiverTalkOperation(operation: ReceiverTalkOperation | null) {
    if (!operation || receiverTalkOperationRef.current?.id !== operation.id) return;
    receiverTalkOperationRef.current = null;
    setReceiverTalkOperation(null);
  }

  function updateReceiverTalkOperation(
    operation: ReceiverTalkOperation,
    updates: Partial<Omit<ReceiverTalkOperation, "id">>
  ) {
    if (receiverTalkOperationRef.current?.id !== operation.id) return;
    const nextOperation: ReceiverTalkOperation = {
      ...receiverTalkOperationRef.current,
      ...updates,
    };
    receiverTalkOperationRef.current = nextOperation;
    setReceiverTalkOperation(nextOperation);
  }

  function receiverTalkDiagnosticsContext(operation: ReceiverTalkOperation | null) {
    return {
      activeModalType: modalRef.current?.type || "home",
      breadcrumbHistory: attemptDiagnosticEntries.map((entry) => ({
        at: entry.at,
        detail: entry.detail,
        label: entry.label,
      })),
      connectivityState: receiverOnline ? "online" : "offline",
      currentReceiverState: {
        deviceId: readReceiverDeviceId(),
        installId: readReceiverInstallId(),
        mode: deskPhoneMode ? "appliance" : "web",
        presentationMode: receiverModernPresentationEnabled ? "modern" : "classic",
        selectedPersonId: selectedReceiverUser.id || null,
        selectedPersonName: selectedReceiverUser.displayName || "",
      },
      currentTalkOperation: operation,
      requestAttemptSummary: attemptDiagnosticSummary,
      recentConnectivityState: connectivityStatusLabel,
      requestLifecycle: operation?.requestLifecycle || "",
      requestTextLength: operation?.draftLength ?? askDraft.trim().length,
      receiverRecording,
      receiverRecordingProcessing,
      receiverStatusMessage: status,
    };
  }

  async function submitAsk(options: {
    modality?: ObservationModality;
    surface?: "ask_tell";
    text?: string;
  } = {}) {
    if (receiverTalkOperationRef.current) {
      return;
    }
    receiverRecordingStartTokenRef.current += 1;
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    const question = (options.text ?? askDraft).trim();
    if (!question) {
      setStatus("Type what you want to ask first.");
      return;
    }

    const currentModal = modal;
    const surface = options.surface ||
      ((currentModal?.type === "ask" && currentModal.surface === "ask_tell") ||
      (currentModal?.type === "askRecordReview" && currentModal.surface === "ask_tell")
        ? "ask_tell"
        : undefined);
    const modality: ObservationModality =
      options.modality ||
      (currentModal?.type === "askRecordReview" || pendingAskAudio
        ? "speech"
        : askDraftObservationModality);

    const operation = startReceiverTalkOperation({
      draftLength: question.length,
      modality,
      requestLifecycle: "submitAsk accepted; waiting on observation pipeline and Talk interpretation",
      stage: "processing",
      surface: surface === "ask_tell" ? "ask_tell" : "ask",
    });
    setStatus("CarePland heard you. Working on that...");

    try {
      await submitObservation(
        {
          activeWorkflow: "ask_tell",
          deviceId: readReceiverDeviceId(),
          metadata: {
            hasPendingAskAudio: Boolean(pendingAskAudio),
            receiverInstallId: readReceiverInstallId(),
            surface,
          },
          modality,
          personId: selectedReceiverUser.id || null,
          source: "receiver",
          surface: surface || "receiver_ask",
          text: question,
        },
        {
          handleSpeech: async (observation) => {
            const handled = await submitTalkInterpretation(question, {
              modality: observation.modality,
              surface: observation.context?.surface ?? null,
            });
            void recordInteractionAttemptObservation(observation).then((attemptId) => {
              if (!attemptId || !handled) return;
              recordInteractionAttemptEvent("response_presented", {
                interpreter: "ReceiverTalkInterpreter",
                result: "legacy_talk_handled",
                route: "legacy_speech_talk",
              });
            });
            return handled
              ? { handled: true, result: "legacy_talk_handled" }
              : { handled: false };
          },
          handleText: async (observation, meaningFrame) => {
            if (receiverTalkShouldHandleText(meaningFrame.normalizedText)) {
              const handled = await submitTalkInterpretation(meaningFrame.normalizedText, {
                modality: observation.modality,
                surface: observation.context?.surface ?? null,
              });
              if (handled) {
                void recordInteractionAttemptObservation(observation).then((attemptId) => {
                  if (!attemptId) return;
                  recordInteractionAttemptEvent("response_presented", {
                    interpreter: "ReceiverTalkInterpreter",
                    result: "legacy_talk_handled",
                    route: "legacy_text_talk",
                  });
                });
                return "legacy_talk_handled";
              }
            }

            const interpretation = interpretReceiverAskObservation({
              contacts,
              fallbackContact: selectedContact,
              meaningFrame,
              observation,
            });

            if (interpretation.needsRecovery || !interpretation.answer) {
              const family = interpretation.familyClassification.family;
              void recordInteractionAttemptObservation(observation).then((attemptId) => {
                if (!attemptId) return;
                recordInteractionAttemptEvent("response_presented", {
                  ...(interpretation.askInterpretation
                    ? {
                        askCapabilityStatus: interpretation.askInterpretation.capabilityStatus,
                        askDecisionTrace: interpretation.askInterpretation.decisionTrace,
                        askEntities: interpretation.askInterpretation.entities,
                        askIntent: interpretation.askInterpretation.intent,
                        askIntentConfidence: interpretation.askInterpretation.confidence,
                        askTemporalReferences: interpretation.askInterpretation.temporalReferences,
                      }
                    : {}),
                  family,
                  familyConfidence: interpretation.familyClassification.confidence,
                  interpreter: "ReceiverAskInterpreter",
                  normalizedText: meaningFrame.normalizedText,
                  result: family === "communicate" ? "message" : "recovery",
                  responseType: family === "communicate" ? "message" : "recovery",
                  route: family === "communicate" ? "legacy_ask_message_offer" : "legacy_ask_recovery",
                });
              });
              setPendingAskAudio(null);
              if (family === "communicate") {
                setAskDraftObservationModality("typed");
                setAskDraft("");
                setModal({
                  type: "askAnswer",
                  answer: {
                    actionLabel: `Send to ${selectedContact.displayName}`,
                    answer: `We can send this to ${selectedContact.displayName}.`,
                    diagnosticSummary: receiverDiagnosticMode
                      ? `Observation ${observation.source}/${observation.modality} -> MeaningFrame -> Family communicate ${Math.round(
                          interpretation.familyClassification.confidence * 100
                        )}% -> No family-specific interpretation yet -> ReceiverAskInterpreter -> Response message`
                      : undefined,
                    messageBody: question,
                    question,
                    recipientId: selectedContact.id,
                    type: "message",
                  },
                });
                setStatus(`Ready to send to ${selectedContact.displayName}.`);
                return "legacy_ask_message_offer";
              }
              setModal({
                type: "askRecovery",
                question,
                recoveryPrompt: pickAskRecoveryPrompt(),
                surface,
              });
              setStatus("Ask needs a little more help.");
              return "legacy_ask_recovery";
            }

            setPendingAskAudio(null);
            setAskDraftObservationModality("typed");
            setAskDraft("");
            void recordInteractionAttemptObservation(observation).then((attemptId) => {
              if (!attemptId) return;
              recordInteractionAttemptEvent("response_presented", {
                actionLabel: interpretation.answer?.actionLabel || "",
                answer: interpretation.answer?.answer || "",
                ...(interpretation.askInterpretation
                  ? {
                      askCapabilityStatus: interpretation.askInterpretation.capabilityStatus,
                      askDecisionTrace: interpretation.askInterpretation.decisionTrace,
                      askEntities: interpretation.askInterpretation.entities,
                      askIntent: interpretation.askInterpretation.intent,
                      askIntentConfidence: interpretation.askInterpretation.confidence,
                      askTemporalReferences: interpretation.askInterpretation.temporalReferences,
                    }
                  : {}),
                family: interpretation.familyClassification.family,
                familyConfidence: interpretation.familyClassification.confidence,
                interpreter: "ReceiverAskInterpreter",
                normalizedText: meaningFrame.normalizedText,
                result: interpretation.answer?.type || "answer",
                responseType: interpretation.answer?.type || "",
                route: "legacy_ask_answer",
              });
            });
            setModal({ type: "askAnswer", answer: interpretation.answer });
            setStatus("Ask found an answer.");
            return "legacy_ask_answer";
          },
        }
      );
    } finally {
      finishReceiverTalkOperation(operation);
    }
  }

  async function submitTalkInterpretation(
    question: string,
    context?: {
      modality?: ObservationModality;
      surface?: string | null;
    }
  ) {
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
          modality: context?.modality || "speech",
          personId: selectedReceiverUser.id,
          receiverDeviceId: readReceiverDeviceId(),
          receiverInstallId: readReceiverInstallId(),
          source: "receiver_talk",
          surface: context?.surface || "receiver_talk",
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

      if (!payload.result) {
        throw new Error(payload.error || "Talk could not understand that yet.");
      }

      return handleTalkResult(question, payload.result, response.ok ? undefined : payload.error);
    } catch (error) {
      const fallbackHandled = handleLocalTalkInterpretation(
        question,
        context,
        error instanceof Error ? error.message : "Talk could not save that yet."
      );
      if (fallbackHandled) {
        return true;
      }

      setStatus(
        error instanceof Error
          ? error.message
          : "Talk could not understand that yet."
      );
      return false;
    }
  }

  function handleLocalTalkInterpretation(
    question: string,
    context:
      | {
          modality?: ObservationModality;
          surface?: string | null;
        }
      | undefined,
    storageError: string
  ) {
    if (!receiverTalkShouldHandleText(question)) {
      return false;
    }

    const observation = createObservation({
      activeWorkflow: "ask_tell",
      deviceId: readReceiverDeviceId(),
      metadata: {
        fallbackReason: storageError,
        receiverInstallId: readReceiverInstallId(),
      },
      modality: context?.modality || "typed",
      personId: selectedReceiverUser.id || null,
      source: "receiver",
      surface: context?.surface || "receiver_ask",
      text: question,
    });
    const { result } = interpretReceiverTalkObservation({
      careCircleId: "local_receiver",
      contacts,
      observation,
      receiverDeviceId: readReceiverDeviceId(),
    });

    if (result.intent === "unknown") {
      return false;
    }

    return handleTalkResult(
      question,
      serializeReceiverTalkResult(result),
      storageError || "Talk could not save that yet."
    );
  }

  function handleTalkResult(question: string, result: TalkApiResult, storageError?: string) {
    const baseDisplayResponse =
      String(result.display_response || result.spoken_response || "").trim() ||
      "I heard that.";
    const displayResponse = storageError
      ? baseDisplayResponse
          .replace(
            /^This is an exercise entry\. I recorded:/,
            "This is an exercise entry. I could not save yet:"
          )
          .replace(/^I recorded:/, "I could not save yet:")
      : baseDisplayResponse;
    const proposedAction = String(result.proposed_action || "");

    if (result.intent === "connect_call_request") {
      const contactId = String(result.structured_payload?.contactId || "");
      const contact = contacts.find((item) => item.id === contactId);
      if (contact) {
        setAskDraftObservationModality("typed");
        setAskDraft("");
        callContact(contact);
        return true;
      }
    }

    if (proposedAction === "clarify" || result.intent === "unknown") {
      setPendingAskAudio(null);
      setModal({
        type: "askRecovery",
        question,
        recoveryPrompt: pickAskRecoveryPrompt(),
        surface:
          (modalRef.current?.type === "ask" && modalRef.current.surface === "ask_tell") ||
          (modalRef.current?.type === "askRecordReview" && modalRef.current.surface === "ask_tell")
            ? "ask_tell"
            : undefined,
      });
      setStatus(displayResponse);
      return true;
    }

    setPendingAskAudio(null);
    setAskDraftObservationModality("typed");
    setAskDraft("");
    setModal({
      type: "askAnswer",
      answer: {
        actionLabel: "That answered my question",
        answer: displayResponse,
        diagnosticSummary: receiverTalkDiagnosticSummary(result, storageError),
        messageBody: "",
        question,
        recipientId: "",
        type: "answer",
      },
    });
    setStatus(displayResponse);
    void refreshTodayFocus("user");
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
    const primaryContact = contacts[0];
    setMessages((current) => [
      {
        audioArtifactId: pendingAskAudio?.artifactId,
        audioMimeType: pendingAskAudio?.audioMimeType,
        audioUrl: pendingAskAudio?.audioUrl,
        id: `ask-recovery-${currentEpochMs()}`,
        from: "receiver_user",
        to: primaryContact.displayName,
        body,
        createdAt: currentIsoTimestamp(),
        transcript: pendingAskAudio?.transcript,
        transcriptStatus: pendingAskAudio?.transcriptStatus,
      },
      ...current,
    ]);
    setFocusedMessageIndex(0);
    setStatus(`This was sent to ${primaryContact.displayName}.`);
    setModal({ type: "sent", recipientName: primaryContact.displayName });
}

function receiverTalkDiagnosticSummary(result: TalkApiResult, storageError?: string) {
  const intent = String(result.intent || "unknown");
  const confidence =
    typeof result.confidence === "number" ? ` ${Math.round(result.confidence * 100)}%` : "";
  const storage = storageError ? " -> Storage fallback" : "";
  return `Observation receiver -> MeaningFrame -> TalkInterpreter -> Intent ${intent}${confidence} -> Response answer${storage}`;
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
      connectAuthHeaders: connectReceiverRequestHeaders,
      details,
      eventType,
      mainConnectUserPersonId: selectedReceiverUser.id,
    });
  }

  function stopLiveCallAudio(options: { notifyPeer?: boolean } = {}) {
    const notifyPeer = options.notifyPeer ?? true;
    const currentCallId =
      modal?.type === "incomingCall" ? modal.callId : undefined;
    logReceiverCallEvent(currentCallId, "call_receiver_audio_cleanup_requested", {
      callAudioStatus,
      notifyPeer,
      source: "receiver_stop_live_call_audio",
    });
    liveCallAudioRef.current?.stop({ notifyPeer });
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

  async function reportCallState(
    callId: string | undefined,
    state: string
  ): Promise<{ callState?: string; ok: boolean }> {
    if (!receiverOnline) {
      explainOfflineAction();
      return { ok: false };
    }
    if (!callId) {
      setStatus("Call details are not available yet.");
      return { ok: false };
    }
    if (!selectedReceiverUser.id) {
      setStatus("Choose a Main Connect User before answering calls.");
      return { ok: false };
    }

    try {
      logReceiverCallEvent(callId, "call_receiver_state_update_requested", {
        source: "reportCallState",
        state,
      });
      const response = await fetch(`${connectCallsEndpoint}/${encodeURIComponent(callId)}/state`, {
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
      const payload = (await response.json().catch(() => ({}))) as {
        call?: ReceiverCall;
        error?: string;
        ok?: boolean;
      };
      const returnedCallState = String(payload.call?.state || "").trim();

      if (!response.ok || payload.ok === false) {
        const message =
          payload.error ||
          (state === "answered"
            ? "Receiver could not answer this call."
            : "Receiver could not update this call.");
        if (!response.ok) {
          reportReceiverSessionLoss(response, "Receiver call authentication was rejected.");
        }
        logReceiverCallEvent(callId, "call_receiver_state_update_failed", {
          httpStatus: response.status,
          message,
          source: "reportCallState",
          state,
        });
        setStatus(message);
        return { callState: returnedCallState || undefined, ok: false };
      }

      if (
        returnedCallState &&
        returnedCallState !== state &&
        receiverCallRecordStateIsTerminal(returnedCallState)
      ) {
        logReceiverCallEvent(callId, "call_receiver_state_update_rejected_terminal", {
          requestedState: state,
          resultState: returnedCallState,
          source: "reportCallState",
        });
        setStatus("That call already ended.");
        return { callState: returnedCallState, ok: false };
      }

      if (
        returnedCallState &&
        !receiverCallStateUpdateReachedRequestedState(state, returnedCallState)
      ) {
        logReceiverCallEvent(callId, "call_receiver_state_update_not_applied", {
          requestedState: state,
          resultState: returnedCallState,
          source: "reportCallState",
        });
        setStatus(
          state === "answered"
            ? "Receiver could not answer this call yet."
            : "Receiver could not update this call yet."
        );
        return { callState: returnedCallState, ok: false };
      }

      return { callState: returnedCallState || state, ok: true };
    } catch {
      setStatus("Could not update the call on the CarePland server.");
      return { ok: false };
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
    if (contact.disabledReason) {
      setStatus(contact.disabledReason);
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

  async function answerIncomingCall(callerName: string, callId?: string) {
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
      locallyAnsweredCallIdsRef.current.add(callId);
      locallyEndedCallIdsRef.current.delete(callId);
      callStartedAtByCallIdRef.current[callId] =
        callStartedAtByCallIdRef.current[callId] || new Date().toISOString();
    }
    logReceiverCallEvent(callId, "call_receiver_answer_clicked", {
      source: "answerIncomingCall",
    });
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
    const answered = await reportCallState(callId, "answered");
    if (!answered.ok) {
      setCallAudioStatus("interrupted");
      if (callId && receiverCallRecordStateIsTerminal(answered.callState)) {
        locallyEndedCallIdsRef.current.add(callId);
        locallyAnsweredCallIdsRef.current.delete(callId);
      }
      setModal((current) =>
        current?.type === "incomingCall" && current.callId === callId
          ? receiverCallRecordStateIsTerminal(answered.callState)
            ? {
                ...current,
                callEndedAt: current.callEndedAt || new Date().toISOString(),
                callState: "ended",
                textView: undefined,
              }
            : {
                ...current,
                callState: "connecting",
              }
          : current
      );
      return;
    }
    if (callId && !selectedReceiverUser.id) {
      setCallAudioStatus("interrupted");
      setStatus("Receiver setup is missing the active person. Pair this Receiver again.");
      setModal((current) =>
        current?.type === "incomingCall" && current.callId === callId
          ? {
              ...current,
              callState: "incoming",
            }
          : current
      );
      return;
    }
    if (callId && selectedReceiverUser.id) {
      const connected = await reportCallState(callId, "connected");
      if (connected.ok) {
        setModal((current) =>
          current?.type === "incomingCall" && current.callId === callId
            ? {
                ...current,
                callStartedAt: current.callStartedAt || new Date().toISOString(),
                callState: "connected",
              }
            : current
        );
        setStatus(`Connected to ${callerName}.`);
      } else if (receiverCallRecordStateIsTerminal(connected.callState)) {
        locallyEndedCallIdsRef.current.add(callId);
        locallyAnsweredCallIdsRef.current.delete(callId);
        setModal((current) =>
          current?.type === "incomingCall" && current.callId === callId
            ? {
                ...current,
                callEndedAt: current.callEndedAt || new Date().toISOString(),
                callState: "ended",
                textView: undefined,
              }
            : current
        );
        return;
      }
      stopLiveCallAudio({ notifyPeer: false });
      const controller = createConnectCallAudioController({
        callId,
        connectAuthHeaders: connectReceiverRequestHeaders,
        mainConnectUserPersonId: selectedReceiverUser.id,
        onConnected: () => {
          setStatus(`Connected to ${callerName}.`);
          void reportCallState(callId, "connected").then((connected) => {
            if (!connected.ok) {
              if (receiverCallRecordStateIsTerminal(connected.callState)) {
                locallyEndedCallIdsRef.current.add(callId);
                locallyAnsweredCallIdsRef.current.delete(callId);
                stopLiveCallAudio({ notifyPeer: false });
                setModal((current) =>
                  current?.type === "incomingCall" && current.callId === callId
                    ? {
                        ...current,
                        callEndedAt: current.callEndedAt || new Date().toISOString(),
                        callState: "ended",
                        textView: undefined,
                      }
                    : current
                );
              }
              return;
            }
            setModal((current) =>
              current?.type === "incomingCall" && current.callId === callId
                ? {
                    ...current,
                    callStartedAt: current.callStartedAt || new Date().toISOString(),
                    callState: "connected",
                  }
                : current
            );
          });
        },
        onError: (message) => setStatus(message),
        onPeerEnded: () => {
          const audioWasLive = ["connected", "remote_audio"].includes(callAudioStatusRef.current);
          logReceiverCallEvent(callId, "call_receiver_peer_ended_received", {
            callAudioStatus: callAudioStatusRef.current,
            audioWasLive,
            source: "audio_controller_onPeerEnded",
          });
          if (!audioWasLive) {
            liveCallAudioRef.current = null;
            setCallAudioStatus("interrupted");
            setCallMuted(false);
            setModal((current) =>
              current?.type === "incomingCall" && current.callId === callId
                ? {
                    ...current,
                    callStartedAt: current.callStartedAt || new Date().toISOString(),
                    callState: "connected",
                  }
                : current
            );
            setStatus(
              `Connected to ${callerName}. Live audio did not fully connect on this device.`
            );
            return;
          }
          locallyEndedCallIdsRef.current.add(callId);
          locallyAnsweredCallIdsRef.current.delete(callId);
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
  }

  function declineIncomingCall(callerName: string, callId?: string) {
    if (!receiverOnline) {
      explainOfflineAction();
      return;
    }
    stopReceiverCue();
    if (callId) {
      locallyAnsweredCallIdsRef.current.delete(callId);
      locallyEndedCallIdsRef.current.add(callId);
    }
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
    if (callId) {
      locallyAnsweredCallIdsRef.current.delete(callId);
      locallyEndedCallIdsRef.current.add(callId);
    }
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

  function askTellDraftNeedsExitConfirmation() {
    const draft = askDraft.trim();
    if (!draft) return false;
    return !askTellExamples.some((example) => example === draft);
  }

  function cancelReceiverAskRecordingSession() {
    receiverRecordingStartTokenRef.current += 1;
    receiverRecordingControllerRef.current?.cancel();
    receiverRecordingControllerRef.current = null;
    resetReceiverChunkTranscript();
    receiverCaptureIdRef.current = "";
    receiverRecordingSurfaceRef.current = null;
    setReceiverRecording(false);
    setReceiverRecordingProcessing(false);
    setPendingAskAudio(null);
  }

  function closeModal() {
    stopReceiverCue();
    if (playingMessageId || audioRef.current || playingMessageRef.current) {
      stopMessagePlayback();
    }
    if (modal?.type === "soundSettings") {
      resetSoundTestState();
    }
    if (
      modal?.type === "ask" ||
      modal?.type === "askRecordReview" ||
      modal?.type === "askRecovery" ||
      modal?.type === "askAnswer"
    ) {
      cancelReceiverAskRecordingSession();
    }
    if (modal?.type === "ask" && modal.surface === "ask_tell" && !modal.confirmExit && askTellDraftNeedsExitConfirmation()) {
      setModal({ type: "ask", surface: "ask_tell", confirmExit: true });
      setStatus("Ask/Tell message is not sent.");
      return;
    }
    setModal(null);
  }

  function confirmAskTellExitWithoutSending() {
    receiverAskExitRequestedRef.current = true;
    cancelReceiverAskRecordingSession();
    setAskDraftObservationModality("typed");
    setAskDraft("");
    setModal(null);
    setStatus("Ask/Tell message deleted.");
  }

  function openScreenCleaningConfirm() {
    clearGuideBecauseReceiverActed();
    setModal({ type: "screenCleaningConfirm" });
    setStatus("Screen cleaning confirmation opened.");
  }

  function openScreenCleaningConfirmFromSettings() {
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

  if (sessionValidity.state === "session_lost" && !readReceiverLayoutPreviewMode()) {
    return (
      <main className={styles.registrationScreen}>
        <section className={styles.registrationPanel} aria-live="assertive">
          <p>CarePland Connect</p>
          <h1>CarePland needs to reconnect</h1>
          <span>Ask the person who set up this Receiver to sign in again.</span>
          <small>This Receiver can continue after the session is refreshed.</small>
          <button
            type="button"
            onClick={() => {
              window.location.assign(carePlandSignInPath("/connect/receiver"));
            }}
          >
            Sign in again
          </button>
        </section>
      </main>
    );
  }

  if (!selectedReceiverUser.id) {
    if (receiverBindingCheckPending) {
      return (
        <main className={styles.registrationScreen}>
          <section className={styles.registrationPanel} aria-live="polite">
            <p>CarePland Connect</p>
            <h1>Receiver</h1>
            <span>Checking Receiver setup</span>
            <strong>Confirming this Receiver is paired.</strong>
            <small>CarePland will continue automatically when setup is confirmed.</small>
          </section>
        </main>
      );
    }

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
          {receiverSetupError ? <strong>{receiverSetupError}</strong> : null}
          <button type="button" onClick={() => window.location.reload()}>
            New Code
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`${styles.receiverPage} ${deskPhoneMode ? styles.deskPhoneMode : ""} ${
        gxvFocusHomeEnabled ? styles.gxvFocusHomeMode : ""
      } ${
        gxvAskTellHomeEnabled ? styles.gxvAskTellHomeMode : ""
      } ${
        gxvAskTell2HomeEnabled ? styles.gxvAskTell2HomeMode : ""
      } ${receiverModernPresentationEnabled ? styles.modernReceiverMode : ""} ${
        guideTarget || guideRect ? styles.guideActive : ""
      }`}
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
          {(receiverModernPresentationEnabled || gxvFocusHomeEnabled || gxvAskTellHomeEnabled || gxvAskTell2HomeEnabled) && modal?.type !== "incomingCall" ? null : (
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
                modernPresentation={receiverModernPresentationEnabled}
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
                    {!modal && deskPhoneMode && !nativeReceiverShell ? (
                      <div className={styles.receiverLayoutControl}>
                        <button
                          className={`${styles.fullscreenTinyButton} ${styles.layoutTinyButton}`}
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={layoutMenuOpen}
                          aria-label="Choose Receiver style"
                          onClick={(event) => {
                            event.stopPropagation();
                            setLayoutMenuOpen((open) => !open);
                          }}
                        >
                          STYLE
                        </button>
                        {renderReceiverLayoutMenu()}
                      </div>
                    ) : null}
                    {!modal && !deskPhoneMode && !nativeReceiverShell ? (
                      <div className={styles.receiverLayoutControl}>
                        <button
                          className={`${styles.fullscreenTinyButton} ${styles.layoutTinyButton}`}
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={layoutMenuOpen}
                          aria-label="Choose Receiver style"
                          onClick={(event) => {
                            event.stopPropagation();
                            setLayoutMenuOpen((open) => !open);
                          }}
                        >
                          STYLE
                        </button>
                        {renderReceiverLayoutMenu()}
                      </div>
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
                        <span className={styles.greetingName}>{selectedReceiverGreetingName}</span>
                      </>
                    ) : (
                      `${greetingFor(now)}, ${selectedReceiverGreetingName}`
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

          {!deskPhoneMode && !receiverModernPresentationEnabled ? (
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

          <section className={styles.actionZone} aria-label="Primary actions">
            {deskPhoneMode ? (
              gxvAskTell2HomeEnabled ? (
                <>
                  <section
                    className={`${styles.todayFocusPanel} ${
                      todayFocusPreferenceItem ? styles.todayFocusPanelMenuOpen : ""
                    } ${!receiverOnline ? styles.offlineActionArea : ""}`}
                    aria-label="Today's Focus"
                  >
                    {renderTodayFocusHomeContent("Goals")}
                  </section>
                  <button
                    className={`${styles.appointmentPanel} ${styles.applianceAppointmentPanel} ${styles.focusHomeAppointmentPanel} ${styles.askTellAppointmentPanel}`}
                    type="button"
                    aria-label={`Open appointment details for ${displayedAppointment.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openHeaderAppointment();
                    }}
                  >
                    <span className={styles.focusHomeAppointmentMeta}>
                      Next Appointment
                    </span>
                    <strong>{displayedAppointment.title}</strong>
                    <span className={styles.focusHomeAppointmentMeta}>
                      {displayedAppointmentTimeLabel}
                    </span>
                  </button>
                  <button
                    className={`${styles.receiverNotificationPanel} ${
                      receiverNotificationMessage ? styles.receiverNotificationAction : ""
                    }`}
                    type="button"
                    aria-label={
                      receiverNotificationMessage
                        ? "Open highlighted message"
                        : "Receiver Notifications"
                    }
                    aria-hidden={!receiverNotificationText}
                    disabled={!receiverNotificationMessage}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (receiverNotificationMessage) openMessage(receiverNotificationMessage);
                    }}
                  >
                    <p>{receiverNotificationText}</p>
                  </button>
	                  <section className={`${styles.focusHomeTimePanel} ${styles.askTell2TimePanel}`} aria-label="Current time and connection">
	                    <strong>{formatTime(now)}</strong>
	                    <div className={styles.dateControlRow}>
	                      <span>{formatReceiverFooterWeekday(now)}</span>
	                      <span>{formatReceiverFooterMonthDay(now)}</span>
	                    </div>
	                  </section>
                  <section className={styles.focusHomeGreetingPanel} aria-label="Receiver">
                    <a
                      className={styles.focusHomeLogo}
                      download
                      href={receiverApkDownloadEndpoint}
                      onClick={(event) => event.stopPropagation()}
                      title="Download Receiver APK"
                    >
                      <img src="/carepland-loop-mark-footer.png" alt="" />
                    </a>
                    <span>{greetingFor(now)}</span>
                    <strong>{selectedReceiverGreetingName}</strong>
                  </section>
                  <button
                    className={`${styles.askTellPrimaryAction} ${styles.askTell2PrimaryAction} ${onlineRequiredActionClass}`}
                    type="button"
                    aria-disabled={!receiverOnline}
                    onClick={(event) => {
                      event.stopPropagation();
                      openAskTell();
                    }}
                  >
                    <span>Ask/Tell</span>
                  </button>
                  <div className={styles.askTellSecondaryGrid}>
                    <button
                      className={`${styles.secondaryAction} ${styles.blue} ${messageHomeCount > 0 && receiverOnline ? onlineRequiredActionClass : styles.receiverHomeDisabledAction}`}
                      type="button"
                      disabled={!receiverOnline || messageHomeCount === 0}
                      aria-disabled={!receiverOnline || messageHomeCount === 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        showAllMessages();
                      }}
                    >
                      {messageHomeLabel}
                    </button>
                  </div>
                  <button
                    className={`${styles.secondaryAction} ${styles.blue} ${styles.askTell2SendHelpAction} ${onlineRequiredActionClass}`}
                    type="button"
                    aria-disabled={!receiverOnline}
                    onClick={(event) => {
                      event.stopPropagation();
                      openReceiverHelpReport();
                    }}
                  >
                    Something went wrong
                  </button>
                  <div className={styles.focusHomeUtilityStack}>
                    <div className={styles.askTell2FooterTextSlot}>
                      <span className={styles.askTell2FooterReceiverName}>
                        {receiverIdentityDisplay.name || "This"}
                      </span>
                      <span className={styles.askTell2FooterReceiverType}>Receiver</span>
                    </div>
                    <section
                      className={`${styles.focusHomeUtilityAction} ${styles.askTell2ConnectionPanel}`}
                      aria-label="Connection status"
                    >
                      <span className={styles.askTell2ConnectionStatus}>
                        <span
                          className={`${styles.askTell2ConnectionLight} ${
                            receiverOnline ? styles.askTell2ConnectionLightOnline : styles.askTell2ConnectionLightOffline
                          }`}
                          aria-hidden="true"
                        />
                        <span className={receiverOnline ? styles.onlineStatus : styles.offlineStatus}>
                          {connectivityStatusLabel}
                        </span>
                      </span>
                    </section>
                    {!modal && screenCleaningSecondsRemaining === null ? (
                      <button
                        className={`${styles.footerUtilityAction} ${styles.focusHomeUtilityAction} ${styles.askTell2SettingsAction}`}
                        type="button"
                        aria-label="Settings"
                        aria-haspopup="dialog"
                        onClick={(event) => {
                          event.stopPropagation();
                          openReceiverSettings();
                        }}
                      >
                        <svg
                          className={styles.askTell2SettingsGear}
                          viewBox="0 0 64 64"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <g fill="currentColor">
                            <rect x="28" y="3" width="8" height="15" rx="3" />
                            <rect x="28" y="46" width="8" height="15" rx="3" />
                            <rect x="28" y="3" width="8" height="15" rx="3" transform="rotate(45 32 32)" />
                            <rect x="28" y="46" width="8" height="15" rx="3" transform="rotate(45 32 32)" />
                            <rect x="28" y="3" width="8" height="15" rx="3" transform="rotate(90 32 32)" />
                            <rect x="28" y="46" width="8" height="15" rx="3" transform="rotate(90 32 32)" />
                            <rect x="28" y="3" width="8" height="15" rx="3" transform="rotate(135 32 32)" />
                            <rect x="28" y="46" width="8" height="15" rx="3" transform="rotate(135 32 32)" />
                            <circle cx="32" cy="32" r="20" />
                          </g>
                          <circle className={styles.askTell2SettingsGearHole} cx="32" cy="32" r="8" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </>
              ) : gxvAskTellHomeEnabled ? (
                <>
                  <div className={styles.focusHomeLayoutControls} aria-label="Style controls">
                    {!modal && !nativeReceiverShell && screenCleaningSecondsRemaining === null ? (
                      <div className={styles.receiverLayoutControl}>
                        <button
                          className={`${styles.fullscreenTinyButton} ${styles.layoutTinyButton}`}
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={layoutMenuOpen}
                          aria-label="Choose Receiver style"
                          onClick={(event) => {
                            event.stopPropagation();
                            setLayoutMenuOpen((open) => !open);
                          }}
                        >
                          STYLE
                        </button>
                        {renderReceiverLayoutMenu()}
                      </div>
                    ) : null}
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
                    <strong>{selectedReceiverGreetingName}</strong>
                  </section>
                  <section className={`${styles.todayFocusPanel} ${styles.askTellFocusPanel} ${!receiverOnline ? styles.offlineActionArea : ""}`} aria-label="Today's Focus">
                    {renderTodayFocusHomeContent()}
                  </section>
                  <button
                    className={`${styles.appointmentPanel} ${styles.applianceAppointmentPanel} ${styles.focusHomeAppointmentPanel} ${styles.askTellAppointmentPanel}`}
                    type="button"
                    aria-label={`Open appointment details for ${displayedAppointment.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      openHeaderAppointment();
                    }}
                  >
                    <span className={styles.focusHomeAppointmentMeta}>
                      Next Appointment
                    </span>
                    <strong>{displayedAppointment.title}</strong>
                    <span className={styles.focusHomeAppointmentMeta}>
                      {displayedAppointmentTimeLabel}
                    </span>
                  </button>
                  <button
                    className={`${styles.askTellPrimaryAction} ${onlineRequiredActionClass}`}
                    type="button"
                    aria-disabled={!receiverOnline}
                    onClick={(event) => {
                      event.stopPropagation();
                      openAskTell();
                    }}
                  >
                    <span>Ask/Tell</span>
                  </button>
                  <div className={styles.askTellSecondaryGrid}>
                    <button
                      className={`${styles.secondaryAction} ${styles.blue} ${onlineRequiredActionClass}`}
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
                      className={`${styles.secondaryAction} ${styles.blue}`}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        askAppointmentQuestion();
                      }}
                    >
                      Appointments
                    </button>
                  </div>
                  <section className={styles.focusHomeTimePanel} aria-label="Current time">
                    <div className={styles.dateControlRow}>
                      <span>{formatDate(now)}</span>
                    </div>
                    <strong>{formatTime(now)}</strong>
                    <span className={receiverOnline ? styles.onlineStatus : styles.offlineStatus}>
                      {connectivityStatusLabel}
                    </span>
                  </section>
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
              ) : gxvFocusHomeEnabled ? (
                <>
                  <div className={styles.focusHomeLayoutControls} aria-label="Style controls">
                    {!modal && !nativeReceiverShell && screenCleaningSecondsRemaining === null ? (
                      <div className={styles.receiverLayoutControl}>
                        <button
                          className={`${styles.fullscreenTinyButton} ${styles.layoutTinyButton}`}
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={layoutMenuOpen}
                          aria-label="Choose Receiver style"
                          onClick={(event) => {
                            event.stopPropagation();
                            setLayoutMenuOpen((open) => !open);
                          }}
                        >
                          STYLE
                        </button>
                        {renderReceiverLayoutMenu()}
                      </div>
                    ) : null}
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
                    <strong>{selectedReceiverGreetingName}</strong>
                  </section>
	                  <button
	                    className={`${styles.talkFooterAction} ${styles.focusHomeTalkAction} ${onlineRequiredActionClass}`}
	                    type="button"
	                    aria-label="Talk"
	                    aria-disabled={!receiverOnline}
	                    disabled={receiverRecordingProcessing || Boolean(receiverTalkOperation)}
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
                    {renderTodayFocusHomeContent()}
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
	                      } ${onlineRequiredActionClass} ${
                        receiverCommunicationDisabledReason ? styles.inactive : ""
                      }`}
	                      type="button"
	                      aria-disabled={!receiverOnline || Boolean(receiverCommunicationDisabledReason)}
                      title={receiverCommunicationDisabledReason || undefined}
                      onClick={(event) => {
                        event.stopPropagation();
                        openAsk();
                      }}
                    >
                      Ask a Question
                    </button>
                    <button
	                      className={`${styles.secondaryAction} ${styles.blue} ${styles.focusHomeCallAction} ${
	                        guideTarget === "primary"
	                          ? styles.guideTarget
	                          : guideTarget
	                            ? styles.guideDim
	                            : ""
	                      } ${onlineRequiredActionClass} ${
                        receiverCommunicationDisabledReason ? styles.inactive : ""
                      }`}
	                      type="button"
	                      aria-disabled={!receiverOnline || Boolean(receiverCommunicationDisabledReason)}
                      title={receiverCommunicationDisabledReason || undefined}
                      onClick={(event) => {
                        event.stopPropagation();
                        callContact(selectedContact);
                      }}
                    >
                      Live Call
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
	                  className={`${styles.secondaryAction} ${styles.blue} ${styles.receiverHomeAction} ${
	                    guideTarget === "ask"
	                      ? styles.guideTarget
	                      : guideTarget
	                        ? styles.guideDim
	                        : ""
	                  } ${onlineRequiredActionClass} ${
                      receiverCommunicationDisabledReason ? styles.inactive : ""
                    }`}
	                  type="button"
	                  aria-disabled={!receiverOnline || Boolean(receiverCommunicationDisabledReason)}
                  title={receiverCommunicationDisabledReason || undefined}
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
	                  } ${onlineRequiredActionClass} ${
                      receiverCommunicationDisabledReason ? styles.inactive : ""
                    }`}
	                  type="button"
	                  aria-disabled={!receiverOnline || Boolean(receiverCommunicationDisabledReason)}
                  title={receiverCommunicationDisabledReason || undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    callContact(selectedContact);
                  }}
                >
                  Live Call {selectedContact.displayName}
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
	                    disabled={receiverRecordingProcessing || Boolean(receiverTalkOperation)}
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
	                  } ${onlineRequiredActionClass} ${
                      receiverCommunicationDisabledReason ? styles.inactive : ""
                    }`}
	                  type="button"
	                  aria-disabled={!receiverOnline || Boolean(receiverCommunicationDisabledReason)}
                  title={receiverCommunicationDisabledReason || undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    openContact();
                  }}
                >
                  Contact {selectedContact.displayName}
                </button>
                <div className={styles.receiverActionRow}>
	                  <button
	                    className={`${styles.secondaryAction} ${styles.green} ${
	                      guideTarget === "ask"
	                        ? styles.guideTarget
	                        : guideTarget
	                          ? styles.guideDim
	                          : ""
	                    } ${onlineRequiredActionClass} ${
                      receiverCommunicationDisabledReason ? styles.inactive : ""
                    }`}
	                    type="button"
	                    aria-disabled={!receiverOnline || Boolean(receiverCommunicationDisabledReason)}
                    title={receiverCommunicationDisabledReason || undefined}
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
                    disabled={receiverRecordingProcessing || Boolean(receiverTalkOperation)}
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

          {!deskPhoneMode && !receiverModernPresentationEnabled ? (
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
              askTellExamples={askTellExamples}
              autoHearPreference={autoHearPreference}
              contacts={contacts}
              contactRecording={contactRecording}
              contactRecordingProcessing={contactRecordingProcessing}
              contactDraft={contactDraft}
              messageTextSize={messageTextSize}
              modal={modal}
              messages={messages}
              pendingContactRecording={pendingContactRecording}
              playingMessageId={playingMessageId}
              presentationMode={receiverModernPresentationEnabled ? "modern" : "classic"}
              receiverDiagnosticMode={receiverDiagnosticMode}
              receiverHelpDraft={receiverHelpDraft}
              receiverHelpRecording={receiverHelpRecording}
              receiverHelpRecordingProcessing={receiverHelpRecordingProcessing}
              receiverHelpSubmitting={receiverHelpSubmitting}
              receiverRecording={receiverRecording}
              receiverRecordingProcessing={receiverRecordingProcessing}
              receiverTalkDiagnosticsContext={receiverTalkDiagnosticsContext(receiverTalkOperation)}
              receiverTalkOperation={receiverTalkOperation}
              lastSoundTestResult={lastSoundTestResult}
              soundDiagnostic={soundDiagnostic}
              soundHelp={soundHelp}
              soundSettings={soundSettings}
              selectedSoundProblem={selectedSoundProblem}
              receiverOnline={receiverOnline}
              key={modal.type === "reader" ? `reader-${modal.message.id}` : modal.type}
              onApproveCallSummary={approveCallSummary}
              onAcknowledgeMessage={acknowledgeMessage}
              onAskDraftChange={updateAskDraft}
              onCallBackForMessage={callBackForMessage}
              onCallContact={callContact}
              onCancelCondensedMessage={cancelCondensedSpeechMessage}
              onClose={closeModal}
              onConfirmAskTellExit={confirmAskTellExitWithoutSending}
              onContactDraftChange={(value) => setContactDraft(limitReceiverTextInput(value))}
              onCompleteTodayFocusItem={markTodayFocusComplete}
              onEscalateAskRecovery={escalateAskRecovery}
              onAttemptEvent={recordInteractionAttemptEvent}
              onMessageTextSizeChange={setMessageTextSize}
              onOpenMessageFromAllMessages={openMessageFromAllMessages}
              onPlayMessage={hearMessage}
              onPrepareAttemptRevision={prepareInteractionAttemptRevision}
              onRetryAsk={(question) => {
                setPendingAskAudio(null);
                updateAskDraft(question, "typed");
                setModal({
                  type: "ask",
                  surface: modal?.type === "askRecovery" && modal.surface === "ask_tell" ? "ask_tell" : undefined,
                });
              }}
              onApplySoundHelpAction={applySoundHelpAction}
              onRecordContact={toggleContactRecording}
              onReceiverHelpDraftChange={setReceiverHelpDraft}
              onRecordReceiverHelp={toggleReceiverHelpRecording}
              onRecordRequest={startReceiverRecording}
              onReportSoundProblem={reportSoundProblem}
              onRecordHearingFeedback={recordHearingFeedback}
              onResolveSoundHelp={markSoundHelpResolved}
              onResetSoundTestState={resetSoundTestState}
              onMaximizeReceiver={maximizeReceiverFromSettings}
              receiverFullscreenActive={fullscreenActive}
              onChooseGxvHomeLayout={chooseGxvHomeLayoutFromSettings}
              onChooseReceiverPresentationLayout={chooseReceiverPresentationLayoutFromSettings}
              onChooseScreenCleaningTheme={chooseScreenCleaningThemeFromSettings}
              onOpenCleanScreenThemeSettings={openCleanScreenThemeSettings}
              onOpenOptionalSounds={openOptionalSoundsFromSettings}
              onOpenReceiverStyleSettings={openReceiverStyleSettings}
              onOpenScreenCleaningConfirm={openScreenCleaningConfirmFromSettings}
              onSendContact={sendMessage}
              onSendCondensedMessage={sendCondensedSpeechMessage}
              onSaveCallSummaryDraft={saveCallSummaryDraft}
              onSetModal={setModal}
              onSubmitReceiverHelpReport={submitReceiverHelpReport}
              onStartScreenCleaning={startScreenCleaning}
              onSubmitAsk={submitAsk}
              onTestSound={testOptionalSound}
              onToggleAutoHearPreference={toggleAutoHearPreference}
              onUpdateSoundSetting={updateSoundSetting}
              screenCleaningTheme={screenCleaningTheme}
              showReceiverFullscreenSetting={!kioskManagedFullscreen && !nativeReceiverShell}
            />
          ) : null}
          {interruptedReviewIncomingCall?.callId ? (
            <IncomingCallPrompt
              callerName={String(
                interruptedReviewIncomingCall.callerName ||
                  selectedContact.displayName ||
                  fallbackPrimaryCoordinatorDisplayName
              )}
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
              theme={screenCleaningTheme}
            />
          ) : null}
          {receiverDiagnosticMode ? (
            <button
              className={styles.receiverTraceButton}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setAttemptDiagnosticOpen(true);
              }}
            >
              Trace
            </button>
          ) : null}
          <div
            className={styles.receiverIdentityBadge}
            title={receiverIdentityDisplay.full}
            aria-label={`Receiver identifier ${receiverIdentityDisplay.full}`}
          >
            <span>{receiverIdentityDisplay.label}</span>
          </div>
        </section>
      </div>
      {receiverDiagnosticMode && attemptDiagnosticOpen ? (
        <div
          className={styles.receiverTraceOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="receiver-trace-title"
          onClick={(event) => event.stopPropagation()}
        >
          <section className={styles.receiverTracePanel}>
            <div className={styles.receiverTraceHeader}>
              <div>
                <span>Diagnostic</span>
                <h2 id="receiver-trace-title">Interaction Attempt</h2>
              </div>
              <button
                className={styles.receiverTraceCloseButton}
                type="button"
                onClick={() => setAttemptDiagnosticOpen(false)}
              >
                Close
              </button>
            </div>
            <dl className={styles.receiverTraceSummary}>
              <div>
                <dt>Status</dt>
                <dd>{attemptDiagnosticSummary.status}</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd>{attemptTraceStory.finalOutcome || attemptDiagnosticSummary.outcome || "pending"}</dd>
              </div>
              <div>
                <dt>Surface</dt>
                <dd>{attemptDiagnosticSummary.surface || "Receiver"}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>
                  {attemptDiagnosticStartedAt
                    ? formatTime(attemptDiagnosticStartedAt)
                    : "not started"}
                </dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>
                  {attemptDiagnosticDurationSeconds === null
                    ? "in progress"
                    : `${attemptDiagnosticDurationSeconds} sec`}
                </dd>
              </div>
              <div>
                <dt>Revisions</dt>
                <dd>{Math.max(0, attemptDiagnosticSummary.revisionCount - 1)}</dd>
              </div>
              <div>
                <dt>Final family</dt>
                <dd>{attemptTraceStory.finalRevision?.family || "unknown"}</dd>
              </div>
            </dl>
            <div className={styles.receiverTraceChain}>
              {attemptTraceStory.familyEvolution.length ? (
                <section className={styles.receiverTraceStoryPanel}>
                  <h3>Family evolution</h3>
                  <p className={styles.receiverTraceFamilyFlow}>
                    {attemptTraceStory.familyEvolution.join(" -> ")}
                  </p>
                </section>
              ) : null}
              {attemptTraceStory.finalRevision || attemptTraceStory.finalOutcome ? (
                <section className={styles.receiverTraceStoryPanel}>
                  <h3>Final result</h3>
                  <dl className={styles.receiverTraceMiniGrid}>
                    <div>
                      <dt>Family</dt>
                      <dd>{attemptTraceStory.finalRevision?.family || "unknown"}</dd>
                    </div>
                    <div>
                      <dt>Interpreter</dt>
                      <dd>{attemptTraceStory.finalRevision?.interpreter || "unknown"}</dd>
                    </div>
                    <div>
                      <dt>Presented action</dt>
                      <dd>{attemptTraceStory.finalRevision?.result || "unknown"}</dd>
                    </div>
                    <div>
                      <dt>Outcome</dt>
                      <dd>{attemptTraceStory.finalOutcome || attemptDiagnosticSummary.outcome || "pending"}</dd>
                    </div>
                  </dl>
                  {attemptTraceStory.finalResponse ? (
                    <blockquote>{attemptTraceStory.finalResponse}</blockquote>
                  ) : null}
                </section>
              ) : null}
              <section className={styles.receiverTraceStoryPanel}>
                <h3>Platform reviews</h3>
                <p className={styles.receiverTraceReviewNote}>
                  Reviews are advisory platform notes. They do not change Receiver behavior.
                </p>
                {platformReviews.length ? (
                  <div className={styles.receiverTraceReviewList}>
                    {platformReviews.map((review) => {
                      const analyses = platformReviewAnalyses.filter(
                        (analysis) => analysis.reviewId === review.id
                      );
                      return (
                        <article className={styles.receiverTraceReviewCard} key={review.id}>
                          <div>
                            <strong>Admin review</strong>
                            <time>{formatTime(new Date(review.createdAt))}</time>
                          </div>
                          <p>{review.comment}</p>
                          {analyses.length ? (
                            <div className={styles.receiverTraceAnalysisList}>
                              {analyses.map((analysis) => (
                                <details className={styles.receiverTraceDetails} key={analysis.id}>
                                  <summary>Advisory analysis</summary>
                                  <div className={styles.receiverTraceAnalysisBody}>
                                    <p>{analysis.analysisText}</p>
                                    <dl className={styles.receiverTraceMiniGrid}>
                                      <div>
                                        <dt>Concerns</dt>
                                        <dd>
                                          {analysis.identifiedConcerns.join(", ") || "none"}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt>Layers</dt>
                                        <dd>
                                          {analysis.affectedPlatformLayers.join(", ") || "none"}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt>Refinement areas</dt>
                                        <dd>
                                          {analysis.suggestedRefinementAreas.join(", ") || "none"}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt>Model</dt>
                                        <dd>
                                          {[analysis.model, analysis.modelVersion]
                                            .filter(Boolean)
                                            .join(" / ") || "unknown"}
                                        </dd>
                                      </div>
                                    </dl>
                                  </div>
                                </details>
                              ))}
                            </div>
                          ) : null}
                          <button
                            className={styles.receiverTraceSecondaryButton}
                            disabled={platformReviewAnalyzingId === review.id}
                            onClick={() => analyzePlatformReview(review.id)}
                            type="button"
                          >
                            {platformReviewAnalyzingId === review.id
                              ? "Analyzing..."
                              : "Request advisory analysis"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.receiverTraceReviewNote}>
                    No Platform Reviews recorded for this attempt.
                  </p>
                )}
                <label className={styles.receiverTraceReviewEditor}>
                  <span>Add review comment</span>
                  <textarea
                    value={platformReviewDraft}
                    onChange={(event) => setPlatformReviewDraft(event.target.value)}
                    placeholder="What did this attempt teach us?"
                  />
                </label>
                <div className={styles.receiverTraceReviewActions}>
                  <button
                    className={styles.receiverTraceSecondaryButton}
                    disabled={platformReviewSaving || !platformReviewDraft.trim()}
                    onClick={savePlatformReview}
                    type="button"
                  >
                    {platformReviewSaving ? "Saving..." : "Save review"}
                  </button>
                  {platformReviewStatus ? <span>{platformReviewStatus}</span> : null}
                </div>
              </section>
              {attemptTraceStory.revisions.length ? (
                attemptTraceStory.revisions.map((revision) => (
                  <section className={styles.receiverTraceRevisionCard} key={revision.observationId || revision.revisionNumber}>
                    <div className={styles.receiverTraceRevisionHeader}>
                      <h3>Revision {revision.revisionNumber}</h3>
                      <span>{revision.reason}</span>
                    </div>
                    <div className={styles.receiverTraceActors}>
                      <article>
                        <span>User</span>
                        <p>{revision.userText || "No captured wording."}</p>
                      </article>
                      <article>
                        <span>Platform</span>
                        <p>
                          {revision.family
                            ? `${revision.family}${revision.familyConfidence ? ` (${formatReceiverTracePercent(revision.familyConfidence)})` : ""}`
                            : "No family recorded."}
                        </p>
                        <small>{revision.interpreter || "No interpreter recorded."}</small>
                        {revision.askIntent ? (
                          <small>
                            Ask: {revision.askIntent}
                            {revision.askCapabilityStatus
                              ? ` · ${revision.askCapabilityStatus}`
                              : ""}
                          </small>
                        ) : null}
                        {revision.response ? <p>{revision.response}</p> : null}
                      </article>
                      <article>
                        <span>User response</span>
                        {revision.userActions.length ? (
                          revision.userActions.map((action) => (
                            <p key={action.id}>{receiverTraceActionLabel(action)}</p>
                          ))
                        ) : (
                          <p>No response yet.</p>
                        )}
                      </article>
                    </div>
                    <details className={styles.receiverTraceDetails}>
                      <summary>Details</summary>
                      <dl className={styles.receiverTraceMiniGrid}>
                        <div>
                          <dt>Observation ID</dt>
                          <dd>{revision.observationId || "none"}</dd>
                        </div>
                        <div>
                          <dt>Parent</dt>
                          <dd>{revision.parentObservationId || "none"}</dd>
                        </div>
                        <div>
                          <dt>Normalized text</dt>
                          <dd>{revision.normalizedText || "none"}</dd>
                        </div>
                        <div>
                          <dt>Route</dt>
                          <dd>{revision.route || "none"}</dd>
                        </div>
                        <div>
                          <dt>Ask intent</dt>
                          <dd>{revision.askIntent || "none"}</dd>
                        </div>
                        <div>
                          <dt>Ask capability</dt>
                          <dd>{revision.askCapabilityStatus || "none"}</dd>
                        </div>
                        <div>
                          <dt>Ask entities</dt>
                          <dd>{revision.askEntities || "none"}</dd>
                        </div>
                        <div>
                          <dt>Ask time refs</dt>
                          <dd>{revision.askTemporalReferences || "none"}</dd>
                        </div>
                        <div>
                          <dt>Result</dt>
                          <dd>{revision.result || "none"}</dd>
                        </div>
                        <div>
                          <dt>Confidence</dt>
                          <dd>{revision.familyConfidence || "none"}</dd>
                        </div>
                      </dl>
                      <ol className={styles.receiverTraceRawList}>
                        {revision.rawEntries.map((entry, index) => (
                          <li key={entry.id}>
                            <div>
                              <strong>{index + 1}. {entry.label}</strong>
                              <time>{formatTime(new Date(entry.at))}</time>
                            </div>
                            <pre>{entry.detail || "No additional detail."}</pre>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </section>
                ))
              ) : (
                <section className={styles.receiverTraceStoryPanel}>
                  <h3>No interaction attempt yet</h3>
                  <p>Submit Ask/Tell input to start a diagnostic chain.</p>
                </section>
              )}
              {attemptTraceStory.systemEntries.length ? (
                <details className={styles.receiverTraceDetails}>
                  <summary>System events</summary>
                  <ol className={styles.receiverTraceRawList}>
                    {attemptTraceStory.systemEntries.map((entry, index) => (
                      <li key={entry.id}>
                        <div>
                          <strong>{index + 1}. {entry.label}</strong>
                          <time>{formatTime(new Date(entry.at))}</time>
                        </div>
                        <pre>{entry.detail || "No additional detail."}</pre>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ScreenCleaningView({
  message,
  secondsRemaining,
  theme,
}: {
  message: string;
  secondsRemaining: number;
  theme: ScreenCleaningTheme;
}) {
  const defaultCountdownLabel = formatCountdownSeconds(secondsRemaining);

  return (
    <div
      className={`${styles.screenCleaningView} ${
        theme === "microwave" ? styles.screenCleaningViewMicrowave : ""
      }`}
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
      {theme === "microwave" ? (
        <div className={styles.microwaveCleaningCenter}>
          <div className={styles.microwaveScene} aria-hidden="true">
            <div className={styles.microwaveMaskedLayer}>
              <img
                className={styles.microwaveBack}
                src="/connect/receiver/microwave-back.png"
                alt=""
              />
              <div className={styles.cavityClip}>
                <div className={styles.turntableStage}>
                  <div className={styles.rotation}>
                    <div className={styles.growth}>
                      <div className={styles.heatPulse}>
                        <svg
                          className={styles.microwaveWordmark}
                          viewBox="0 0 1638 960"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <defs>
                            <filter
                              id="microwave-wordmark-bulge"
                              x="-45%"
                              y="-45%"
                              width="190%"
                              height="190%"
                              colorInterpolationFilters="sRGB"
                            >
                              <feImage
                                href="/connect/receiver/wordmark-bulge-map.png"
                                result="bulgeMap"
                                preserveAspectRatio="none"
                                x="0"
                                y="0"
                                width="1638"
                                height="960"
                              />
                              <feDisplacementMap
                                in="SourceGraphic"
                                in2="bulgeMap"
                                xChannelSelector="R"
                                yChannelSelector="G"
                                scale="0"
                              >
                                <animate
                                  attributeName="scale"
                                  dur="120s"
                                  fill="freeze"
                                  keyTimes="0;0.25;0.28;0.35;0.53;0.7;0.88;1"
                                  values="0;0;115;175;235;300;360;430"
                                />
                              </feDisplacementMap>
                            </filter>
                          </defs>
                          <image
                            className={styles.wordmarkBulging}
                            href="/connect/receiver/carepland-wordmark.svg"
                            width="1638"
                            height="960"
                            preserveAspectRatio="xMidYMid meet"
                            filter="url(#microwave-wordmark-bulge)"
                          />
                          <image
                            className={styles.wordmarkPlain}
                            href="/connect/receiver/carepland-wordmark.svg"
                            width="1638"
                            height="960"
                            preserveAspectRatio="xMidYMid meet"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <img
              className={styles.microwaveFront}
              src="/connect/receiver/microwave-front.png"
              alt=""
            />
            <div className={styles.microwaveCountdownDisplay}>
              {formatCountdownSeconds(secondsRemaining)}
            </div>
          </div>
          <span className={styles.srOnly}>
            Screen cleaning. {formatCountdownSeconds(secondsRemaining)} remaining.
          </span>
        </div>
      ) : (
        <div className={styles.screenCleaningCenter}>
          <p>{message}</p>
          {theme === "flyingHero" ? (
            <>
              <FlyingHeroCountdown label={defaultCountdownLabel} />
              <span className={styles.srOnly}>
                Screen cleaning. {defaultCountdownLabel} remaining.
              </span>
            </>
          ) : (
            <strong>{defaultCountdownLabel}</strong>
          )}
        </div>
      )}
    </div>
  );
}

type DigitSpinParams = {
  isColon: boolean;
  direction: 1 | -1;
  amp: number; // degrees for digits, px for the colon
  periodMs: number;
  tauMs: number;
};

// A digit's reaction is a damped harmonic oscillator rather than a hand-authored
// keyframe list. Physically it's the same math a flicked spring settles with,
// which is exactly the "cardboard cutout spinning on a pole, then wobbling to
// a stop" feel we want — and it produces 1-3 decaying wobbles for free, with
// no keyframe/easing bookkeeping (a shared `easing` string re-applied at each
// keyframe boundary was making the old version's swing rush early and hang).
function spinParamsFor(influence: number, isColon: boolean): DigitSpinParams {
  const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  if (isColon) {
    return {
      isColon: true,
      direction,
      amp: 1.5 + influence * 7.5,
      periodMs: 260 - influence * 90,
      tauMs: 90 + influence * 90,
    };
  }
  return {
    isColon: false,
    direction,
    amp: 20 + Math.pow(influence, 1.3) * 280,
    periodMs: 420 - influence * 190,
    tauMs: 140 + influence * 120,
  };
}

function sampleSpin(params: DigitSpinParams, tMs: number): string {
  const omega = (2 * Math.PI) / params.periodMs;
  const decay = Math.exp(-tMs / params.tauMs);
  const wave = Math.sin(omega * tMs);
  if (params.isColon) {
    const x = params.amp * params.direction * wave * decay;
    const scale = 1 + 0.06 * decay * wave;
    return `translate3d(${x.toFixed(2)}px, 0, 0) scale(${scale.toFixed(3)})`;
  }
  const angle = params.amp * params.direction * wave * decay;
  return `perspective(900px) rotateY(${angle.toFixed(2)}deg)`;
}

function FlyingHeroCountdown({ label }: { label: string }) {
  const countdownRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLImageElement | null>(null);
  const digitRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotionQuery.matches) return;

    const countdown = countdownRef.current;
    const hero = heroRef.current;
    if (!countdown || !hero) return;

    const digits = digitRefs.current;
    let wakeTimer: number | null = null;
    let frameId: number | null = null;
    let disposed = false;

    const clearWakeTimer = () => {
      if (wakeTimer !== null) {
        window.clearTimeout(wakeTimer);
        wakeTimer = null;
      }
    };

    const resetHero = () => {
      hero.classList.remove(styles.flyingHeroVisible);
      hero.style.transform = "translate3d(-160px, -999px, 0)";
    };

    const scheduleFlyby = () => {
      clearWakeTimer();
      if (disposed) return;
      wakeTimer = window.setTimeout(
        startFlyby,
        20_000 + Math.random() * 25_000
      );
    };

    const startFlyby = () => {
      const stageRect = countdown.closest(`.${styles.screenCleaningView}`)?.getBoundingClientRect();
      const digitRects = digits
        .map((digit) => (digit ? { digit, rect: digit.getBoundingClientRect() } : null))
        .filter((entry): entry is { digit: HTMLSpanElement; rect: DOMRect } => Boolean(entry));

      if (!stageRect || !digitRects.length || disposed) {
        scheduleFlyby();
        return;
      }

      const cast = [
        {
          aspectRatio: 1024 / 1536,
          maxWidth: 220,
          minWidth: 116,
          src: "/connect/receiver/flying-burger.png",
          widthRatio: 0.16,
        },
        {
          aspectRatio: 1386 / 1135,
          maxWidth: 156,
          minWidth: 82,
          src: "/connect/receiver/banana-hero.png",
          widthRatio: 0.105,
        },
      ];
      const character = cast[Math.floor(Math.random() * cast.length)];
      const heroWidth = Math.min(
        Math.max(stageRect.width * character.widthRatio, character.minWidth),
        character.maxWidth
      );
      const heroHeight = heroWidth * character.aspectRatio;

      // Flight heights are derived from the ACTUAL measured digit row, not
      // arbitrary fractions of the whole stage. The old 31/50/68% split meant
      // the bottom band regularly landed 250px+ from the row — outside the
      // wake radius entirely, so roughly a third of flybys disturbed nothing
      // and looked like a bare glitch had occurred, not a chosen gag.
      const rowTop = Math.min(...digitRects.map(({ rect }) => rect.top));
      const rowBottom = Math.max(...digitRects.map(({ rect }) => rect.bottom));
      const rowCenterY = (rowTop + rowBottom) / 2 - stageRect.top;
      const rowHeight = rowBottom - rowTop;
      const heights = [
        rowCenterY - rowHeight * 0.32,
        rowCenterY,
        rowCenterY + rowHeight * 0.32,
      ];
      const heroCenterY = heights[Math.floor(Math.random() * heights.length)];
      const startX = -heroWidth - 40;
      const endX = stageRect.width + heroWidth + 40;
      const fromX = startX;
      const toX = endX;
      const distance = Math.abs(toX - fromX);
      const speed = stageRect.width * (0.72 + Math.random() * 0.16);
      const duration = Math.max(1250, Math.min(2150, (distance / speed) * 1000));
      const wakeRadius = 130 + Math.random() * 60;
      const triggered = new WeakSet<HTMLSpanElement>();
      const active = new Map<HTMLSpanElement, { params: DigitSpinParams; startedAt: number }>();
      const startedAt = performance.now();

      hero.src = character.src;
      hero.style.width = `${heroWidth}px`;
      hero.style.left = "0px";
      hero.style.top = "0px";
      hero.classList.add(styles.flyingHeroVisible);

      const tick = (now: number) => {
        if (disposed) return;
        const progress = Math.min(1, (now - startedAt) / duration);
        const x = fromX + (toX - fromX) * progress;
        const bobPhase = progress * Math.PI * 2.2;
        const y = heroCenterY - heroHeight / 2 + Math.sin(bobPhase) * 5;
        // Bank angle leads the vertical bob (its derivative), so the hero
        // visibly tilts into its own flight path instead of sliding flat —
        // a small, cheap touch that reads as "confident flight" rather than
        // "image translating across the screen."
        const bank = Math.cos(bobPhase) * 7;
        const heroNoseX = x + heroWidth * 0.78;
        const viewportX = stageRect.left + x;
        const viewportY = stageRect.top + y;

        hero.style.transform = `translate3d(${viewportX.toFixed(2)}px, ${viewportY.toFixed(2)}px, 0) rotate(${bank.toFixed(2)}deg)`;

        digitRects.forEach(({ digit, rect }) => {
          if (triggered.has(digit)) return;
          const digitCenterX = rect.left - stageRect.left + rect.width / 2;
          const reached = heroNoseX >= digitCenterX;
          if (!reached) return;
          triggered.add(digit);
          const digitCenterY = rect.top - stageRect.top + rect.height / 2;
          const influence = Math.max(0, 1 - Math.abs(heroCenterY - digitCenterY) / wakeRadius);
          if (influence <= 0) return;
          active.set(digit, {
            params: spinParamsFor(influence, digit.textContent === ":"),
            startedAt: now,
          });
        });

        active.forEach((entry, digit) => {
          const tMs = now - entry.startedAt;
          if (tMs > entry.params.tauMs * 4.5) {
            digit.style.transform = "";
            active.delete(digit);
            return;
          }
          digit.style.transform = sampleSpin(entry.params, tMs);
        });

        if (progress < 1 || active.size > 0) {
          frameId = window.requestAnimationFrame(tick);
          return;
        }

        resetHero();
        scheduleFlyby();
      };

      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(tick);
    };

    resetHero();
    scheduleFlyby();

    return () => {
      disposed = true;
      clearWakeTimer();
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      digits.forEach((digit) => {
        if (digit) digit.style.transform = "";
      });
      resetHero();
    };
  }, []);

  return (
    <div className={styles.flyingHeroCountdownWrap} aria-hidden="true">
      <strong ref={countdownRef} className={styles.flyingHeroCountdown}>
        {Array.from(label).map((character, index) => (
          <span
            className={`${styles.flyingHeroCountdownDigit} ${
              character === ":" ? styles.flyingHeroCountdownColon : ""
            }`}
            key={`${character}-${index}`}
            ref={(node) => {
              digitRefs.current[index] = node;
            }}
          >
            {character}
          </span>
        ))}
      </strong>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={heroRef}
        className={styles.flyingHero}
        src="/connect/receiver/flying-burger.png"
        alt=""
        draggable={false}
      />
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
  modernPresentation,
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
  modernPresentation?: boolean;
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
    <div className={`${styles.callPhonePanel} ${modernPresentation ? styles.modernCallPhonePanel : ""}`}>
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
            className={modernPresentation ? styles.modernPrimaryButton : styles.modalButton}
            type="button"
            onClick={() => onSetModal({ ...modal, textView: "summary" })}
          >
            {endedSummaryActionLabel}
          </button>
          <button
            className={modernPresentation ? styles.modernSecondaryButton : `${styles.modalButton} ${styles.secondary}`}
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
            className={modernPresentation ? styles.modernPrimaryButton : styles.modalButton}
            type="button"
            onClick={() => onAnswerIncomingCall(modal.callerName, modal.callId)}
          >
            ANSWER
          </button>
          <button
            className={modernPresentation ? styles.modernSecondaryButton : `${styles.modalButton} ${styles.secondary}`}
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
  askTellExamples,
  autoHearPreference,
  contacts,
  contactRecording,
  contactRecordingProcessing,
  contactDraft,
  messageTextSize,
  messages,
  modal,
  pendingContactRecording,
  playingMessageId,
  presentationMode = "classic",
  receiverDiagnosticMode,
  receiverHelpDraft,
  receiverHelpRecording,
  receiverHelpRecordingProcessing,
  receiverHelpSubmitting,
  receiverRecording,
  receiverRecordingProcessing,
  receiverTalkDiagnosticsContext,
  receiverTalkOperation,
  receiverOnline,
  lastSoundTestResult,
  soundDiagnostic,
  soundHelp,
  soundSettings,
  selectedSoundProblem,
  onApplySoundHelpAction,
  onAcknowledgeMessage,
  onApproveCallSummary,
  onAskDraftChange,
  onAttemptEvent,
  onCallBackForMessage,
  onCallContact,
  onCancelCondensedMessage,
  onClose,
  onConfirmAskTellExit,
  onCompleteTodayFocusItem,
  onContactDraftChange,
  onChooseScreenCleaningTheme,
  onEscalateAskRecovery,
  onMessageTextSizeChange,
  onOpenMessageFromAllMessages,
  onPlayMessage,
  onPrepareAttemptRevision,
  onRecordContact,
  onReceiverHelpDraftChange,
  onRecordReceiverHelp,
  onRecordRequest,
  onRecordHearingFeedback,
  onReportSoundProblem,
  onResolveSoundHelp,
  onResetSoundTestState,
  onMaximizeReceiver,
  onOpenCleanScreenThemeSettings,
  receiverFullscreenActive,
  onChooseGxvHomeLayout,
  onChooseReceiverPresentationLayout,
  onOpenOptionalSounds,
  onOpenReceiverStyleSettings,
  onOpenScreenCleaningConfirm,
  onRetryAsk,
  onSendContact,
  onSendCondensedMessage,
  onSaveCallSummaryDraft,
  onSetModal,
  onSubmitReceiverHelpReport,
  onStartScreenCleaning,
  onSubmitAsk,
  onTestSound,
  onToggleAutoHearPreference,
  onUpdateSoundSetting,
  screenCleaningTheme,
  showReceiverFullscreenSetting,
}: {
  applianceMode: boolean;
  askDraft: string;
  askTellExamples: string[];
  autoHearPreference: AutoHearPreference;
  contacts: Contact[];
  contactRecording: boolean;
  contactRecordingProcessing: boolean;
  contactDraft: string;
  messageTextSize: ReaderTextSize;
  messages: Message[];
  modal: NonNullable<ModalState>;
  pendingContactRecording: PendingContactRecording | null;
  playingMessageId: string | null;
  presentationMode?: ReceiverPresentationLayout;
  receiverDiagnosticMode: boolean;
  receiverHelpDraft: string;
  receiverHelpRecording: boolean;
  receiverHelpRecordingProcessing: boolean;
  receiverHelpSubmitting: boolean;
  receiverRecording: boolean;
  receiverRecordingProcessing: boolean;
  receiverTalkDiagnosticsContext: Record<string, unknown>;
  receiverTalkOperation: ReceiverTalkOperation | null;
  receiverOnline: boolean;
  lastSoundTestResult: string;
  soundDiagnostic: string;
  soundHelp: SoundHelp | null;
  soundSettings: SoundSettings;
  selectedSoundProblem: SoundProblem | null;
  onApplySoundHelpAction: (action: NonNullable<SoundHelp["actions"]>[number]) => void;
  onAcknowledgeMessage: (message: Message) => void;
  onApproveCallSummary: (callId?: string, approvedSummaryOverride?: string) => Promise<void>;
  onAskDraftChange: (value: string, modality?: ObservationModality) => void;
  onAttemptEvent: (
    eventType: ReceiverAttemptEventType,
    payload?: Record<string, unknown>,
    options?: { terminal?: boolean }
  ) => void;
  onCallBackForMessage: (message: Message) => void;
  onCallContact: (contact: Contact) => void;
  onCancelCondensedMessage: (condensation: ReceiverMessageCondensationModal) => void;
  onClose: () => void;
  onChooseScreenCleaningTheme: (nextTheme: ScreenCleaningTheme) => void;
  onConfirmAskTellExit: () => void;
  onCompleteTodayFocusItem: (
    item: ReceiverTodayFocusHomeItem,
    completion?: ReceiverTodayFocusCompletionInput
  ) => void | Promise<void>;
  onContactDraftChange: (value: string) => void;
  onEscalateAskRecovery: (question: string) => void;
  onMessageTextSizeChange: (value: ReaderTextSize) => void;
  onOpenMessageFromAllMessages: (message: Message, page: number) => void;
  onPlayMessage: (message: Message, variant?: PlaybackVariant, forceRestart?: boolean) => Promise<void>;
  onPrepareAttemptRevision: (reason: ReceiverAttemptRevisionReason) => void;
  onRecordContact: (contact: Contact) => Promise<void>;
  onReceiverHelpDraftChange: (value: string) => void;
  onRecordReceiverHelp: () => Promise<void>;
  onRecordRequest: () => Promise<void>;
  onRecordHearingFeedback: (message: Message, choice: string) => void;
  onReportSoundProblem: (problem: SoundProblem) => void;
  onResolveSoundHelp: () => void;
  onResetSoundTestState: () => void;
  onMaximizeReceiver: () => void;
  receiverFullscreenActive: boolean;
  onChooseGxvHomeLayout: (nextLayout: GxvHomeLayout) => void;
  onChooseReceiverPresentationLayout: (nextLayout: ReceiverPresentationLayout) => void;
  onOpenCleanScreenThemeSettings: () => void;
  onOpenOptionalSounds: () => void;
  onOpenReceiverStyleSettings: () => void;
  onOpenScreenCleaningConfirm: () => void;
  onRetryAsk: (question: string) => void;
  onSendContact: (contact: Contact, body: string, recording?: PendingContactRecording | null) => void;
  onSendCondensedMessage: (
    condensation: ReceiverMessageCondensationModal,
    draft: string
  ) => void;
  onSaveCallSummaryDraft: (callId: string | undefined, draftText: string) => Promise<void>;
  onSetModal: (modal: ModalState) => void;
  onSubmitReceiverHelpReport: () => Promise<void>;
  onStartScreenCleaning: () => void;
  onSubmitAsk: (options?: {
    modality?: ObservationModality;
    surface?: "ask_tell";
    text?: string;
  }) => void | Promise<void>;
  onTestSound: () => void;
  onToggleAutoHearPreference: () => void;
  onUpdateSoundSetting: (key: keyof SoundSettings, value: boolean | SoundSettings["comfortVolume"]) => void;
  screenCleaningTheme: ScreenCleaningTheme;
  showReceiverFullscreenSetting: boolean;
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
  const [askTellReplacementExample, setAskTellReplacementExample] = useState("");
  const [askTellPageIndex, setAskTellPageIndex] = useState(0);
  const [receiverHelpStep, setReceiverHelpStep] = useState<"start" | "compose">("start");
  const [receiverHelpPageIndex, setReceiverHelpPageIndex] = useState(0);
  const [receiverHelpExitConfirmOpen, setReceiverHelpExitConfirmOpen] = useState(false);
  const [clarificationDraft, setClarificationDraft] = useState("");
  const clarificationInputRef = useRef<HTMLInputElement | null>(null);
  const modernPresentation = presentationMode === "modern";
  const autoPlayedMessageIdRef = useRef("");
  const readerPageIndex = readerPageState.key === readerPageKey ? readerPageState.index : 0;
  const askTellFullText = modal.type === "ask" && modal.surface === "ask_tell" ? askDraft : "";
  const askTellTranscriptionInProgress =
    modal.type === "ask" &&
    modal.surface === "ask_tell" &&
    !askDraft.trim() &&
    (receiverRecording || receiverRecordingProcessing);
  const askTellPages = useMemo(
    () => paginateAskTellText(askTellFullText, messageTextSize),
    [askTellFullText, messageTextSize]
  );
  const askTellPage = Math.min(askTellPageIndex, askTellPages.length - 1);
  const askTellDisplayedPageText = askTellTranscriptionInProgress
    ? RECEIVER_TRANSCRIBING_IN_PROGRESS_TEXT
    : askTellPages[askTellPage];
  const receiverHelpPages = useMemo(
    () => paginateReceiverHelpText(receiverHelpDraft, messageTextSize),
    [messageTextSize, receiverHelpDraft]
  );
  const receiverHelpPage = Math.min(receiverHelpPageIndex, receiverHelpPages.length - 1);
  const receiverHelpDisplayedPageText = receiverHelpPages[receiverHelpPage] ?? "";
  const receiverTalkBusy = Boolean(receiverTalkOperation);
  const receiverTalkStatus = receiverTalkOperation ? (
    <LongOperationStatus
      allowDiagnostics
      assistanceDetail="CarePland is still trying. You can keep waiting or send help."
      assistanceTitle="This seems unusually slow."
      className={styles.receiverTalkOperationStatus}
      continueLabel="Keep Waiting"
      diagnosticsLabel="Something went wrong"
      diagnosticsSendingLabel="Sending report"
      diagnosticsSentLabel="Report sent"
      messages={[
        "Still thinking...",
        "This is taking a little longer than usual.",
        "Still working...",
      ]}
      operation="receiver_talk"
      stage={receiverTalkOperation.stage}
      title={
        receiverTalkOperation.stage === "transcribing"
          ? "Turning speech into text..."
          : "Working on that..."
      }
      context={receiverTalkDiagnosticsContext}
      verySlowTitle="Still working..."
    />
  ) : null;

  function closeAskAttempt(reason = "home") {
    onAttemptEvent("cancelled", { reason }, { terminal: true });
    onClose();
  }

  function markAskAnswerHelpful(answer: AskAnswer, sent = false) {
    onAttemptEvent(
      sent ? "workflow_completed" : "helpful_selected",
      {
        actionLabel: answer.actionLabel,
        outcome: sent ? "communicated" : "answered",
        responseType: answer.type,
      },
      { terminal: true }
    );
  }

  function openAskRecovery(question: string, surface?: "ask_tell") {
    onAttemptEvent("not_helpful_selected", { question });
    onSetModal({
      type: "askRecovery",
      question,
      recoveryPrompt: pickAskRecoveryPrompt(),
      surface,
    });
  }

  function rephraseAsk(question: string) {
    onAttemptEvent("rephrase_selected", { question });
    onPrepareAttemptRevision("rephrase");
    onRetryAsk(question);
  }

  function sendAskRecovery(question: string) {
    const recipient = contacts[0];
    onAttemptEvent("send_selected", { recipient: recipient.displayName, source: "recovery" });
    onAttemptEvent(
      "workflow_completed",
      { outcome: "communicated", recipient: recipient.displayName },
      { terminal: true }
    );
    onEscalateAskRecovery(question);
  }

  function submitInlineClarification(answer: AskAnswer) {
    const clarification = clarificationDraft.trim();
    if (!clarification) return;
    if (isReceiverRecipientClarificationAnswer(answer)) {
      const recipient = resolveReceiverContactClarification(clarification, contacts) ?? contacts[0];
      onAttemptEvent("send_selected", {
        clarificationPrompt: answer.answer,
        clarificationText: clarification,
        question: answer.question,
        recipient: recipient.displayName,
        source: "inline_clarification",
      });
      markAskAnswerHelpful(answer, true);
      setClarificationDraft("");
      onSendContact(recipient, answer.question);
      return;
    }
    onAttemptEvent("rephrase_selected", {
      clarificationPrompt: answer.answer,
      question: answer.question,
      source: "inline_clarification",
    });
    onPrepareAttemptRevision("clarification");
    setClarificationDraft("");
    void onSubmitAsk({
      modality: "typed",
      surface: "ask_tell",
      text: clarification,
    });
  }

  useEffect(() => {
    if (modal.type !== "ask" || modal.surface !== "ask_tell" || !askDraft.trim()) {
      setAskTellReplacementExample("");
    }
  }, [askDraft, modal]);

  useEffect(() => {
    setAskTellPageIndex((current) => Math.min(current, Math.max(0, askTellPages.length - 1)));
  }, [askTellPages.length]);

  useEffect(() => {
    if (modal.type !== "ask" || modal.surface !== "ask_tell") {
      setAskTellPageIndex(0);
    }
  }, [modal]);

  useEffect(() => {
    if (modal.type !== "receiverHelp") {
      setReceiverHelpStep("start");
      setReceiverHelpPageIndex(0);
      setReceiverHelpExitConfirmOpen(false);
    }
  }, [modal]);

  useEffect(() => {
    setReceiverHelpPageIndex((current) =>
      Math.min(current, Math.max(0, receiverHelpPages.length - 1))
    );
  }, [receiverHelpPages.length]);

  useEffect(() => {
    if (
      modal.type === "receiverHelp" &&
      receiverHelpStep === "start" &&
      receiverHelpDraft.trim() &&
      !receiverHelpRecording &&
      !receiverHelpRecordingProcessing
    ) {
      setReceiverHelpStep("compose");
    }
  }, [
    modal.type,
    receiverHelpDraft,
    receiverHelpRecording,
    receiverHelpRecordingProcessing,
    receiverHelpStep,
  ]);

  useEffect(() => {
    if (modal.type !== "askAnswer" || !isReceiverClarificationAnswer(modal.answer)) {
      setClarificationDraft("");
      return;
    }
    const focusTimer = window.setTimeout(() => {
      clarificationInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [modal]);

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
    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="offline-notice-title">
          <section className={`${styles.modernModalPanel} ${styles.modernCompactPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Status</span>
                <h2 id="offline-notice-title">CarePland is offline</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={() => closeAskAttempt()}>
                Home
              </button>
            </div>
            <p className={styles.modernReaderText}>{receiverOfflineActionMessage()}</p>
          </section>
        </div>
      );
    }

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

  if (modal.type === "receiverHelp") {
    const helpBusy =
      receiverHelpRecording || receiverHelpRecordingProcessing || receiverHelpSubmitting;
    const helpTextSizeClass =
      messageTextSize === "standard"
        ? styles.readerTextStandard
        : messageTextSize === "extra"
          ? styles.readerTextExtra
          : styles.readerTextLarge;
    const openReceiverHelpExitConfirm = () => setReceiverHelpExitConfirmOpen(true);
    const closeReceiverHelpExitConfirm = () => setReceiverHelpExitConfirmOpen(false);
    const confirmReceiverHelpExit = () => {
      setReceiverHelpExitConfirmOpen(false);
      onClose();
    };
    const receiverHelpTextSizeControls = (
      <div className={styles.receiverHelpSizeRow} aria-label="Text size">
        {[
          ["standard", "a", styles.askTellSizeStandard, "Standard text"],
          ["large", "A", styles.askTellSizeLarge, "Large text"],
          ["extra", "A", styles.askTellSizeExtra, "Extra large text"],
        ].map(([value, label, sizeClass, ariaLabel]) => {
          const selected = messageTextSize === value;
          return (
            <button
              aria-label={ariaLabel}
              aria-pressed={selected}
              className={`${styles.askTellSizeButton} ${sizeClass} ${
                selected ? styles.askTellSizeButtonSelected : ""
              }`}
              key={value}
              type="button"
              onClick={() => onMessageTextSizeChange(value as ReaderTextSize)}
            >
              {label}
            </button>
          );
        })}
      </div>
    );

    return (
      <div
        className={`${styles.modal} ${styles.applianceFullscreenModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receiver-help-title"
      >
        <section className={`${styles.modalPanel} ${styles.receiverHelpPanel}`}>
          <div className={styles.receiverHelpHeader}>
            <div>
              {receiverHelpStep === "start" ? <span>CAREPLAND SUPPORT</span> : null}
              <h2
                className={
                  receiverHelpStep === "start"
                    ? styles.receiverHelpStartTitle
                    : styles.receiverHelpReviewTitle
                }
                id="receiver-help-title"
              >
                Something went wrong
              </h2>
            </div>
            <div className={styles.receiverHelpHeaderActions}>
              {receiverHelpStep === "compose" ? receiverHelpTextSizeControls : null}
              <button
                className={`${styles.modalButton} ${styles.secondary} ${styles.receiverHelpCancelButton}`}
                type="button"
                disabled={helpBusy}
                onClick={openReceiverHelpExitConfirm}
              >
                Cancel
              </button>
            </div>
          </div>

          {receiverHelpStep === "start" ? (
            <>
              <p className={styles.receiverHelpStartPrompt}>
                Tell CarePland what went wrong
              </p>

              <section className={styles.receiverHelpChoiceGrid} aria-label="Help report choices">
                <button
                  className={`${styles.receiverHelpChoiceButton} ${
                    receiverHelpRecording ? styles.recordingActive : ""
                  }`}
                  type="button"
                  disabled={receiverHelpRecordingProcessing || receiverHelpSubmitting}
                  onClick={() => {
                    if (receiverHelpRecording) {
                      setReceiverHelpStep("compose");
                    }
                    void onRecordReceiverHelp();
                  }}
                >
                  {receiverHelpRecording
                    ? "Stop"
                    : receiverHelpRecordingProcessing
                      ? "Writing..."
                      : "Talk"}
                </button>
                <button
                  className={styles.receiverHelpChoiceButton}
                  type="button"
                  disabled={helpBusy}
                  onClick={() => setReceiverHelpStep("compose")}
                >
                  Type
                </button>
              </section>
            </>
          ) : (
            <>
              <p className={styles.receiverHelpComposePrompt}>
                What were you trying to do?
                <br />
                What happened instead?
              </p>

              <label className={styles.receiverHelpTextField}>
                <span className={styles.srOnly}>Help note</span>
                <textarea
                  className={helpTextSizeClass}
                  disabled={receiverHelpSubmitting}
                  maxLength={RECEIVER_HELP_REPORT_MAX_LENGTH}
                  onChange={(event) => {
                    const nextValue = replacePaginatedTextPage(
                      receiverHelpPages,
                      receiverHelpPage,
                      event.target.value,
                      { preserveWhitespace: true }
                    ).slice(0, RECEIVER_HELP_REPORT_MAX_LENGTH);
                    onReceiverHelpDraftChange(nextValue);
                  }}
                  placeholder="Type here"
                  value={receiverHelpDisplayedPageText}
                />
              </label>

              <div className={styles.receiverHelpFooterNav}>
                <button
                  className={styles.modalButton}
                  type="button"
                  disabled={helpBusy}
                  onClick={() => {
                    void onSubmitReceiverHelpReport();
                  }}
                >
                  {receiverHelpSubmitting ? "Sending..." : "Send Report"}
                </button>
                <button
                  className={`${styles.modalButton} ${styles.secondary}`}
                  type="button"
                  disabled={receiverHelpPage === 0 || helpBusy}
                  onClick={() => setReceiverHelpPageIndex((current) => Math.max(0, current - 1))}
                >
                  &lt;
                </button>
                <span>
                  {receiverHelpPage + 1} / {receiverHelpPages.length}
                </span>
                <button
                  className={`${styles.modalButton} ${styles.secondary}`}
                  type="button"
                  disabled={receiverHelpPage >= receiverHelpPages.length - 1 || helpBusy}
                  onClick={() =>
                    setReceiverHelpPageIndex((current) =>
                      Math.min(receiverHelpPages.length - 1, current + 1)
                    )
                  }
                >
                  &gt;
                </button>
              </div>
            </>
          )}
          {receiverHelpExitConfirmOpen ? (
            <div
              className={styles.receiverHelpExitOverlay}
              role="dialog"
              aria-modal="true"
              aria-labelledby="receiver-help-exit-title"
            >
              <section className={styles.receiverHelpExitPrompt}>
                <h3 id="receiver-help-exit-title">Your request will not be sent.</h3>
                <div>
                  <button
                    className={styles.modalButton}
                    type="button"
                    onClick={confirmReceiverHelpExit}
                  >
                    Ok, exit anyway
                  </button>
                  <button
                    className={`${styles.modalButton} ${styles.secondary}`}
                    type="button"
                    onClick={closeReceiverHelpExitConfirm}
                  >
                    Cancel
                  </button>
                </div>
              </section>
            </div>
          ) : null}
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

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="today-focus-weight-title">
          <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Goal</span>
                <h2 id="today-focus-weight-title">{measurementPrompt}</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                Back
              </button>
            </div>
            <div className={styles.modernWeightEntry}>
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
              <div className={styles.modernActionRow} aria-label="Weight unit">
                <button
                  className={todayFocusWeightUnit === "lbs" ? styles.modernPrimaryButton : styles.modernSecondaryButton}
                  type="button"
                  onClick={() => setTodayFocusWeightUnit("lbs")}
                >
                  lbs
                </button>
                <button
                  className={todayFocusWeightUnit === "kg" ? styles.modernPrimaryButton : styles.modernSecondaryButton}
                  type="button"
                  onClick={() => setTodayFocusWeightUnit("kg")}
                >
                  kg
                </button>
              </div>
            </div>
            <div className={styles.modernActionRow}>
              <button
                className={styles.modernPrimaryButton}
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
          </section>
        </div>
      );
    }

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

  if (modal.type === "receiverSettings") {
    const receiverStyleChoices: Array<{ label: string; layout: ReceiverApprovedStyleLayout }> = [
      { label: "Appliance", layout: "appliance" },
      { label: "Modern", layout: "modern" },
    ];
    const selectedReceiverStyle: ReceiverApprovedStyleLayout = modernPresentation
      ? "modern"
      : "appliance";
    function chooseReceiverStyle(layout: ReceiverApprovedStyleLayout) {
      if (layout === "appliance") {
        onChooseGxvHomeLayout("ask_tell_2");
        return;
      }
      onChooseReceiverPresentationLayout("modern");
    }
    const cleanScreenThemeChoices: Array<{ label: string; theme: ScreenCleaningTheme }> = [
      { label: "Classic", theme: "classic" },
      { label: "Flying Heroes", theme: "flyingHero" },
      { label: "Microwave", theme: "microwave" },
    ];

    if (modernPresentation) {
      if (modal.view === "style") {
        return (
          <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="receiver-style-title">
            <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel} ${styles.modernSettingsPanel}`}>
              <div className={styles.modernModalHeader}>
                <div>
                  <span>Profile</span>
                  <h2 id="receiver-style-title">Visual Style</h2>
                </div>
                <button className={styles.modernSecondaryButton} type="button" onClick={() => onSetModal({ type: "receiverSettings" })}>
                  Back
                </button>
              </div>
              <div className={`${styles.modernScrollableContent} ${styles.modernSettingsGrid}`}>
                {receiverStyleChoices.map((choice) => (
                  <button
                    className={`${styles.modernSettingButton} ${
                      selectedReceiverStyle === choice.layout ? styles.modernSettingButtonSelected : ""
                    }`}
                    key={choice.layout}
                    type="button"
                    aria-pressed={selectedReceiverStyle === choice.layout}
                    onClick={() => chooseReceiverStyle(choice.layout)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        );
      }

      if (modal.view === "cleanScreenTheme") {
        return (
          <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="clean-screen-theme-title">
            <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel} ${styles.modernSettingsPanel}`}>
              <div className={styles.modernModalHeader}>
                <div>
                  <span>Profile</span>
                  <h2 id="clean-screen-theme-title">Clean Screen Theme</h2>
                </div>
                <button className={styles.modernSecondaryButton} type="button" onClick={() => onSetModal({ type: "receiverSettings" })}>
                  Back
                </button>
              </div>
              <div className={`${styles.modernScrollableContent} ${styles.modernSettingsGrid}`}>
                {cleanScreenThemeChoices.map((choice) => (
                  <button
                    className={`${styles.modernSettingButton} ${
                      screenCleaningTheme === choice.theme ? styles.modernSettingButtonSelected : ""
                    }`}
                    key={choice.theme}
                    type="button"
                    aria-pressed={screenCleaningTheme === choice.theme}
                    onClick={() => onChooseScreenCleaningTheme(choice.theme)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            </section>
          </div>
        );
      }

      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="receiver-settings-title">
          <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel} ${styles.modernSettingsPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Receiver</span>
                <h2 id="receiver-settings-title">Profile</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                Home
              </button>
            </div>
            <div
              className={`${styles.modernScrollableContent} ${styles.modernSettingsGrid} ${
                showReceiverFullscreenSetting ? "" : styles.modernSettingsGridFour
              }`}
            >
              <button className={styles.modernSettingButton} type="button" onClick={onOpenReceiverStyleSettings}>
                Visual Style
              </button>
              <button className={styles.modernSettingButton} type="button" onClick={onOpenOptionalSounds}>
                Sound
              </button>
              <button className={styles.modernSettingButton} type="button" onClick={onOpenCleanScreenThemeSettings}>
                Clean Screen Theme
              </button>
              <button className={styles.modernSettingButton} type="button" onClick={onOpenScreenCleaningConfirm}>
                Clean the Screen
              </button>
              {showReceiverFullscreenSetting ? (
                <button className={styles.modernSettingButton} type="button" onClick={onMaximizeReceiver}>
                  {receiverFullscreenActive ? "Minimize Receiver Size" : "Maximize Receiver Size"}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      );
    }

    if (modal.view === "style") {
      return (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="receiver-style-title">
          <section className={`${styles.modalPanel} ${styles.receiverSettingsPanel}`}>
            <div className={styles.modalTitleRow}>
              <h2 id="receiver-style-title">Visual Style</h2>
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                type="button"
                onClick={() => onSetModal({ type: "receiverSettings" })}
              >
                Back
              </button>
            </div>
            <div className={styles.receiverStyleGrid}>
              {receiverStyleChoices.map((choice) => (
                <button
                  className={`${styles.receiverSettingsButton} ${
                    selectedReceiverStyle === choice.layout ? styles.receiverSettingsButtonSelected : ""
                  }`}
                  key={choice.layout}
                  type="button"
                  aria-pressed={selectedReceiverStyle === choice.layout}
                  onClick={() => chooseReceiverStyle(choice.layout)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      );
    }

    if (modal.view === "cleanScreenTheme") {
      return (
        <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="clean-screen-theme-title">
          <section className={`${styles.modalPanel} ${styles.receiverSettingsPanel}`}>
            <div className={styles.modalTitleRow}>
              <h2 id="clean-screen-theme-title">Clean Screen Theme</h2>
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                type="button"
                onClick={() => onSetModal({ type: "receiverSettings" })}
              >
                Back
              </button>
            </div>
            <div className={styles.receiverStyleGrid}>
              {cleanScreenThemeChoices.map((choice) => (
                <button
                  className={`${styles.receiverSettingsButton} ${
                    screenCleaningTheme === choice.theme ? styles.receiverSettingsButtonSelected : ""
                  }`}
                  key={choice.theme}
                  type="button"
                  aria-pressed={screenCleaningTheme === choice.theme}
                  onClick={() => onChooseScreenCleaningTheme(choice.theme)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="receiver-settings-title">
        <section className={`${styles.modalPanel} ${styles.receiverSettingsPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="receiver-settings-title">Settings</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <div
            className={`${styles.receiverSettingsGrid} ${
              showReceiverFullscreenSetting ? "" : styles.receiverSettingsGridThree
            }`}
          >
            <button className={styles.receiverSettingsButton} type="button" onClick={onOpenReceiverStyleSettings}>
              Visual Style
            </button>
            <button className={styles.receiverSettingsButton} type="button" onClick={onOpenOptionalSounds}>
              Sound
            </button>
            <button className={styles.receiverSettingsButton} type="button" onClick={onOpenCleanScreenThemeSettings}>
              Clean Screen Theme
            </button>
            <button className={styles.receiverSettingsButton} type="button" onClick={onOpenScreenCleaningConfirm}>
              Clean the Screen
            </button>
            {showReceiverFullscreenSetting ? (
              <button className={styles.receiverSettingsButton} type="button" onClick={onMaximizeReceiver}>
                {receiverFullscreenActive ? "Minimize Receiver Size" : "Maximize Receiver Size"}
              </button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  if (modal.type === "screenCleaningConfirm") {
    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="screen-cleaning-title">
          <section className={`${styles.modernModalPanel} ${styles.modernCompactPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Clean Screen</span>
                <h2 id="screen-cleaning-title">Clean the screen now?</h2>
              </div>
            </div>
            <p className={styles.modernReaderText}>Touch will be ignored for two minutes while the screen is cleaned.</p>
            <div className={styles.modernActionRow}>
              <button className={styles.modernPrimaryButton} type="button" onClick={onStartScreenCleaning}>
                Start Cleaning
              </button>
              <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      );
    }

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
    const disabledReason = contact.disabledReason || "";

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="contact-title">
          <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel} ${styles.modernContactPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Message</span>
                <h2 id="contact-title">
                  {disabledReason
                    ? "Message unavailable"
                    : canCall
                      ? `Tell ${contact.displayName} something`
                      : `Send a message to ${contact.displayName}`}
                </h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                Home
              </button>
            </div>
            <div className={`${styles.modernScrollableContent} ${styles.modernContactBody}`}>
              {disabledReason || !canCall ? (
                <p className={styles.modernHelperText}>
                  {disabledReason || `${contact.displayName} is unavailable right now.`}
                </p>
              ) : null}
              <textarea
                className={styles.modernRequestInput}
                disabled={Boolean(disabledReason)}
                maxLength={RECEIVER_TEXT_INPUT_MAX_LENGTH}
                onChange={(event) => onContactDraftChange(limitReceiverTextInput(event.target.value))}
                placeholder={`What would you like to tell ${contact.displayName}?`}
                value={contactDraft}
              />
              {pendingContactRecording ? (
                <p className={styles.modernHelperText}>
                  {pendingContactRecording.transcriptStatus === "completed"
                    ? "Recording transcribed. Original audio will be sent."
                    : "Recording ready. Original audio will be sent."}
                </p>
              ) : null}
            </div>
            <div className={styles.modernActionRow}>
              <button
                className={`${styles.modernSecondaryButton} ${contactRecording ? styles.recordingActive : ""}`}
                disabled={Boolean(disabledReason) || contactRecordingProcessing}
                type="button"
                onClick={() => {
                  void onRecordContact(contact);
                }}
              >
                {contactRecording ? "Stop Recording" : contactRecordingProcessing ? "Transcribing" : "Record Message"}
              </button>
              <button
                className={`${styles.modernPrimaryButton} ${
                  contactDraft.trim() || pendingContactRecording ? "" : styles.inactive
                }`}
                disabled={Boolean(disabledReason)}
                type="button"
                title={disabledReason || undefined}
                onClick={() => onSendContact(contact, contactDraft, pendingContactRecording)}
              >
                {contactDraft.trim() || pendingContactRecording ? "Send Message" : "Type or record first"}
              </button>
              {canCall ? (
                <button
                  className={styles.modernSecondaryButton}
                  disabled={Boolean(disabledReason)}
                  title={disabledReason || undefined}
                  type="button"
                  onClick={() => onCallContact(contact)}
                >
                  Call {contact.displayName}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="contact-title">
        <section className={`${styles.modalPanel} ${styles.contactPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="contact-title">
              {disabledReason
                ? "Message unavailable"
                : canCall
                  ? `Tell ${contact.displayName} something`
                  : `Send a message to ${contact.displayName}`}
            </h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          {disabledReason || !canCall ? (
            <p className={styles.availabilityNotice}>
              {disabledReason || `${contact.displayName} is unavailable right now.`}
            </p>
          ) : null}
          <textarea
            className={styles.requestInput}
            disabled={Boolean(disabledReason)}
            maxLength={RECEIVER_TEXT_INPUT_MAX_LENGTH}
            onChange={(event) => onContactDraftChange(limitReceiverTextInput(event.target.value))}
            placeholder={`What would you like to tell ${contact.displayName}?`}
            value={contactDraft}
          />
          <button
            className={`${styles.modalButton} ${contactRecording ? styles.danger : styles.secondary}`}
            disabled={Boolean(disabledReason) || contactRecordingProcessing}
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
            disabled={Boolean(disabledReason)}
            type="button"
            title={disabledReason || undefined}
            onClick={() => onSendContact(contact, contactDraft, pendingContactRecording)}
          >
            {contactDraft.trim() || pendingContactRecording ? "Send Message" : "Type or record first"}
          </button>
          {canCall ? (
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              disabled={Boolean(disabledReason)}
              title={disabledReason || undefined}
              type="button"
              onClick={() => onCallContact(contact)}
            >
              Call {contact.displayName}
            </button>
          ) : null}
        </section>
      </div>
    );
  }

  if (modal.type === "ask") {
    const isAskTellSurface = modal.surface === "ask_tell";
    const askExamples = isAskTellSurface
      ? askTellExamples
      : ["What time am I leaving?", "What should I bring?", "I need milk", "I feel dizzy"];
    const chooseAskExample = (example: string) => {
      const existing = askDraft.trim();
      const existingIsCannedExample = askExamples.some((item) => item === existing);
      if (isAskTellSurface && existing && existing !== example && !existingIsCannedExample) {
        setAskTellReplacementExample(example);
        return;
      }
      setAskTellReplacementExample("");
      onAskDraftChange(example, "example");
    };

    if (isAskTellSurface) {
      if (modernPresentation) {
        return (
          <div
            className={`${styles.modal} ${styles.modernModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ask-title"
          >
            <section className={`${styles.modernModalPanel} ${styles.modernAskTellPanel}`}>
              <div className={styles.modernModalHeader}>
                <div>
                  <span>Ask/Tell</span>
                  <h2 id="ask-title">Start talking, type, or choose an example</h2>
                </div>
                <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                  Go Home
                </button>
              </div>
              <div className={styles.modernAskTellBody}>
                <section className={styles.modernAskTellVoice} aria-label="Voice and examples">
                  <button
                    className={`${styles.modernPrimaryButton} ${
                      receiverRecording ? styles.recordingActive : ""
                    }`}
                    disabled={receiverRecordingProcessing || receiverTalkBusy}
                    type="button"
                    onClick={() => {
                      void onRecordRequest();
                    }}
                  >
                    {receiverRecording
                      ? "Stop talking"
                      : receiverRecordingProcessing
                        ? "Transcribing..."
                        : "Start talking"}
                  </button>
                  <div className={styles.modernExampleGrid}>
                    {askExamples.map((example) => (
                      <button
                        className={styles.modernExampleButton}
                        disabled={receiverTalkBusy}
                        key={example}
                        type="button"
                        onClick={() => chooseAskExample(example)}
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </section>
                <section className={styles.modernAskTellDraft} aria-label="Typed message">
                  <textarea
                    className={styles.modernRequestInput}
                    disabled={receiverTalkBusy}
                    maxLength={RECEIVER_TEXT_INPUT_MAX_LENGTH}
                    onChange={(event) =>
                      onAskDraftChange(
                        limitReceiverTextInput(
                          stripReceiverTranscribingDisplayText(event.target.value)
                        ),
                        "typed"
                      )
                    }
                    placeholder="Type here"
                    value={
                      askTellTranscriptionInProgress
                        ? RECEIVER_TRANSCRIBING_IN_PROGRESS_TEXT
                        : askDraft
                    }
                  />
                  {askTellReplacementExample ? (
                    <section className={styles.modernReplacePrompt} aria-live="polite">
                      <p>Remove what you have and use this instead?</p>
                      <strong>{askTellReplacementExample}</strong>
                      <div>
                        <button
                          className={styles.modernSecondaryButton}
                          type="button"
                          onClick={() => setAskTellReplacementExample("")}
                        >
                          Keep mine
                        </button>
                        <button
                          className={styles.modernPrimaryButton}
                          type="button"
                          onClick={() => {
                            onAskDraftChange(askTellReplacementExample, "example");
                            setAskTellReplacementExample("");
                          }}
                        >
                          Use example
                        </button>
                      </div>
                    </section>
                  ) : null}
                  {receiverTalkStatus}
                  <button
                    className={`${styles.modernPrimaryButton} ${askDraft.trim() ? "" : styles.inactive}`}
                    disabled={receiverTalkBusy || !askDraft.trim()}
                    type="button"
                    onClick={() => {
                      void onSubmitAsk();
                    }}
                  >
                    {askDraft.trim() ? "Send" : "Type your request"}
                  </button>
                </section>
              </div>
              {modal.confirmExit ? (
                <div className={styles.modernNestedOverlay} role="dialog" aria-modal="true" aria-labelledby="ask-exit-title">
                  <section className={styles.modernNestedPrompt}>
                    <h3 id="ask-exit-title">Your message has not been sent.</h3>
                    <p>Exit without sending message?</p>
                    <p>Your message will be deleted.</p>
                    <div>
                      <button
                        className={styles.modernSecondaryButton}
                        type="button"
                        onClick={() => onSetModal({ type: "ask", surface: "ask_tell" })}
                      >
                        No
                      </button>
                      <button className={styles.modernPrimaryButton} type="button" onClick={onConfirmAskTellExit}>
                        Yes
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}
            </section>
          </div>
        );
      }

      const textSizeClass =
        messageTextSize === "standard"
          ? styles.readerTextStandard
          : messageTextSize === "extra"
            ? styles.readerTextExtra
            : styles.readerTextLarge;

      return (
        <div
          className={`${styles.modal} ${styles.applianceFullscreenModal}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ask-title"
        >
          <section className={styles.askTellPanel}>
            <div className={styles.askTellHeaderRow}>
              <h2 id="ask-title">Start talking, type, or pick a question</h2>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
                Go Home
              </button>
            </div>
            <div className={styles.askTellSplitPane}>
              <section className={styles.askTellLeftPane} aria-label="Voice and examples">
                <button
                  className={`${styles.askTellSpeechAction} ${
                    receiverRecording ? styles.recordingActive : ""
                  }`}
                  disabled={receiverRecordingProcessing || receiverTalkBusy}
                  type="button"
                  onClick={() => {
                    void onRecordRequest();
                  }}
                >
                  <span className={styles.talkFooterIcon} aria-hidden="true" />
                  <span>
                    {receiverRecording
                      ? "Stop talking"
                      : receiverRecordingProcessing
                        ? "Transcribing..."
                    : "Start talking"}
                  </span>
                </button>
                <div className={styles.askTellExampleList}>
                  {askExamples.map((example) => (
                    <button
                      className={styles.askTellExampleButton}
                      disabled={receiverTalkBusy}
                      key={example}
                      type="button"
                      onClick={() => chooseAskExample(example)}
                    >
                      <span>{example}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className={styles.askTellRightPane} aria-label="Typed message">
                <textarea
                  className={`${styles.requestInput} ${styles.askTellInput} ${textSizeClass}`}
                  disabled={receiverTalkBusy}
                  maxLength={RECEIVER_TEXT_INPUT_MAX_LENGTH}
                  onChange={(event) => {
                    onAskDraftChange(
                      limitReceiverTextInput(
                        replacePaginatedTextPage(
                          askTellPages,
                          askTellPage,
                          stripReceiverTranscribingDisplayText(event.target.value),
                          { preserveWhitespace: true }
                        )
                      ),
                      "typed"
                    );
                  }}
                  placeholder="Type here"
                  value={askTellDisplayedPageText}
                />
                <div className={styles.askTellTextToolbar}>
                  <div className={styles.askTellSizeRow} aria-label="Text size">
                    {[
                      ["standard", "a", styles.askTellSizeStandard, "Standard text"],
                      ["large", "A", styles.askTellSizeLarge, "Large text"],
                      ["extra", "A", styles.askTellSizeExtra, "Extra large text"],
                    ].map(([value, label, sizeClass, ariaLabel]) => {
                      const selected = messageTextSize === value;
                      return (
                        <button
                          aria-label={ariaLabel}
                          aria-pressed={selected}
                          className={`${styles.askTellSizeButton} ${sizeClass} ${selected ? styles.askTellSizeButtonSelected : ""}`}
                          key={value}
                          type="button"
                          onClick={() => onMessageTextSizeChange(value as ReaderTextSize)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className={`${styles.readerPageControls} ${styles.askTellPageControls}`} aria-label="Text page controls">
                    <button
                      className={`${styles.modalButton} ${styles.secondary}`}
                      disabled={askTellPage === 0}
                      type="button"
                      onClick={() => setAskTellPageIndex((current) => Math.max(0, current - 1))}
                    >
                      &lt;
                    </button>
                    <span>
                      {askTellPage + 1} / {askTellPages.length}
                    </span>
                    <button
                      className={`${styles.modalButton} ${styles.secondary}`}
                      disabled={askTellPage >= askTellPages.length - 1}
                      type="button"
                      onClick={() =>
                        setAskTellPageIndex((current) =>
                          Math.min(askTellPages.length - 1, current + 1)
                        )
                      }
                    >
                      &gt;
                    </button>
                  </div>
                </div>
                {askTellReplacementExample ? (
                  <section className={styles.askTellReplacePrompt} aria-live="polite">
                    <p>Remove what you have and use this instead?</p>
                    <strong>{askTellReplacementExample}</strong>
                    <div>
                      <button
                        className={`${styles.modalButton} ${styles.secondary}`}
                        type="button"
                        onClick={() => setAskTellReplacementExample("")}
                      >
                        Keep mine
                      </button>
                      <button
                        className={styles.modalButton}
                        type="button"
                        onClick={() => {
                          onAskDraftChange(askTellReplacementExample, "example");
                          setAskTellReplacementExample("");
                        }}
                      >
                        Use example
                      </button>
                    </div>
                  </section>
                ) : null}
                {receiverTalkStatus}
                <button
                  className={`${styles.modalButton} ${styles.askSubmitButton} ${askDraft.trim() ? "" : styles.inactive}`}
                  disabled={receiverTalkBusy || !askDraft.trim()}
                  type="button"
                  onClick={() => {
                    void onSubmitAsk();
                  }}
                >
                  {askDraft.trim() ? "Send" : "Type your request"}
                </button>
              </section>
            </div>
            {modal.confirmExit ? (
              <div className={styles.askTellExitOverlay} role="dialog" aria-modal="true" aria-labelledby="ask-exit-title">
                <section className={styles.askTellExitPrompt}>
                  <h3 id="ask-exit-title">Your message has not been sent.</h3>
                  <p>Exit without sending message?</p>
                  <p>Your message will be deleted.</p>
                  <div>
                    <button
                      className={`${styles.modalButton} ${styles.secondary}`}
                      type="button"
                      onClick={() => onSetModal({ type: "ask", surface: "ask_tell" })}
                    >
                      No
                    </button>
                    <button className={styles.modalButton} type="button" onClick={onConfirmAskTellExit}>
                      Yes
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </section>
        </div>
      );
    }

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
            disabled={receiverTalkBusy}
            maxLength={RECEIVER_TEXT_INPUT_MAX_LENGTH}
            onChange={(event) => onAskDraftChange(limitReceiverTextInput(event.target.value), "typed")}
            placeholder="Example: I need milk"
            value={askDraft}
          />
          <div className={`${styles.requestExamples} ${applianceMode ? styles.applianceRequestExamples : ""}`}>
            {askExamples.map((example) => (
              <button
                className={styles.requestExample}
                disabled={receiverTalkBusy}
                key={example}
                type="button"
                onClick={() => chooseAskExample(example)}
              >
                {example}
              </button>
            ))}
          </div>
          <button
            className={`${styles.modalButton} ${styles.secondary} ${styles.recordRequestButton} ${
              receiverRecording ? styles.recordingActive : ""
            }`}
            disabled={receiverRecordingProcessing || receiverTalkBusy}
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
          {receiverTalkStatus}
          <button
            className={`${styles.modalButton} ${styles.askSubmitButton} ${askDraft.trim() ? "" : styles.inactive}`}
            disabled={receiverTalkBusy || !askDraft.trim()}
            type="button"
            onClick={() => {
              void onSubmitAsk();
            }}
          >
            {askDraft.trim() ? "Ask" : "Type your request"}
          </button>
        </section>
      </div>
    );
  }

  if (modal.type === "askRecordReview") {
    const isAskTellSurface = modal.surface === "ask_tell";
    const reviewDraft = askDraft.trim();
    const reviewText = receiverRecording
      ? isAskTellSurface
        ? "Listening..."
        : "Recording..."
      : receiverRecordingProcessing
        ? isAskTellSurface
          ? "Turning this into text..."
          : "Transcribing recording..."
        : reviewDraft || modal.transcript || "Voice recording";
    const canSubmitReview =
      !receiverRecording &&
      !receiverRecordingProcessing &&
      !receiverTalkBusy &&
      Boolean(reviewDraft) &&
      reviewDraft !== "Transcribing recording...";

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="record-review-title">
          <section className={`${styles.modernModalPanel} ${styles.modernCompactPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Voice</span>
                <h2 id="record-review-title">{isAskTellSurface ? "I heard this" : "Recording your voice"}</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={() => closeAskAttempt("recovery_home")}>
                Home
              </button>
            </div>
            <div className={styles.modernScrollableContent}>
              <p className={styles.modernReaderText}>{reviewText}</p>
            </div>
            {receiverTalkStatus}
            <div className={styles.modernActionRow}>
              <button
                className={styles.modernSecondaryButton}
                disabled={receiverRecordingProcessing || receiverTalkBusy}
                type="button"
                onClick={() => {
                  if (!receiverRecording) {
                    onAskDraftChange("");
                  }
                  void onRecordRequest();
                }}
              >
                {receiverRecording
                  ? "Stop Recording"
                  : receiverRecordingProcessing
                    ? "Transcribing"
                    : isAskTellSurface
                      ? "Try Again"
                      : "Record Again"}
              </button>
              <button
                className={`${styles.modernPrimaryButton} ${canSubmitReview ? "" : styles.inactive}`}
                disabled={!canSubmitReview}
                type="button"
                onClick={() => {
                  void onSubmitAsk();
                }}
              >
                {isAskTellSurface ? "Use this" : "Send this text"}
              </button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="record-review-title">
        <section className={`${styles.modalPanel} ${isAskTellSurface ? styles.askTellPanel : ""}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="record-review-title">{isAskTellSurface ? "I heard this" : "Recording your voice"}</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <p className={styles.recordReviewText}>{reviewText}</p>
          {receiverTalkStatus}
          <button
            className={`${styles.modalButton} ${styles.secondary} ${styles.recordRequestButton} ${
              receiverRecording ? styles.recordReviewStopButton : ""
            }`}
            disabled={receiverRecordingProcessing || receiverTalkBusy}
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
                  : isAskTellSurface
                    ? "Try Again"
                    : "Record Again"}
            </span>
          </button>
          <button
            className={`${styles.modalButton} ${styles.askSubmitButton} ${canSubmitReview ? "" : styles.inactive}`}
            disabled={!canSubmitReview}
            type="button"
            onClick={() => {
              void onSubmitAsk();
            }}
          >
            {isAskTellSurface ? "Use this" : "This text is what I want to send"}
          </button>
        </section>
      </div>
    );
	  }

  if (modal.type === "messageCondensation") {
    const contact = contacts.find((item) => item.id === modal.contactId) ?? contacts[0];
    const draft = limitReceiverCondensedMessageEdit(modal.draft);
    const canSendDraft = Boolean(draft.trim());
    const updateDraft = (value: string) =>
      onSetModal({ ...modal, draft: limitReceiverCondensedMessageEdit(value) });
    const title = "Here is the message that will be sent.";
    const body = (
      <>
        <p className={`${styles.interpreterMessage} ${styles.messageCondensationPrompt}`}>{title}</p>
        <textarea
          className={`${styles.requestInput} ${styles.messageCondensationInput}`}
          maxLength={modal.limit}
          onChange={(event) => updateDraft(event.target.value)}
          value={draft}
        />
        <p className={`${styles.recordingNotice} ${styles.messageCondensationCounter}`}>
          Message length: {draft.length} / {modal.limit}
        </p>
      </>
    );
    const actions = (
      <div className={`${styles.universalAskActions} ${styles.askAnswerActions}`}>
        <button
          className={styles.modalButton}
          disabled={!canSendDraft}
          type="button"
          onClick={() => onSendCondensedMessage(modal, draft)}
        >
          Send to {contact.displayName}
        </button>
        <button
          className={`${styles.modalButton} ${styles.secondary}`}
          type="button"
          onClick={() => onCancelCondensedMessage(modal)}
        >
          Cancel
        </button>
      </div>
    );

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="message-condensation-title">
          <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Message</span>
                <h2 id="message-condensation-title">Review before sending</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={() => onCancelCondensedMessage(modal)}>
                Cancel
              </button>
            </div>
            <div className={styles.modernScrollableContent}>
              {body}
            </div>
            <div className={styles.modernActionRow}>
              <button
                className={styles.modernPrimaryButton}
                disabled={!canSendDraft}
                type="button"
                onClick={() => onSendCondensedMessage(modal, draft)}
              >
                Send to {contact.displayName}
              </button>
            </div>
          </section>
        </div>
      );
    }

    if (applianceMode) {
      return (
        <div className={`${styles.modal} ${styles.applianceFullscreenModal}`} role="dialog" aria-modal="true" aria-labelledby="message-condensation-title">
          <section className={`${styles.modalPanel} ${styles.applianceListPanel} ${styles.applianceAskAnswerPanel} ${styles.applianceMessageCondensationPanel}`}>
            <div className={`${styles.applianceListToolbar} ${styles.messageCondensationToolbar}`}>
              <h2 id="message-condensation-title">Review Message</h2>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => onCancelCondensedMessage(modal)}>
                Cancel
              </button>
            </div>
            {body}
            {actions}
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="message-condensation-title">
        <section className={`${styles.modalPanel} ${styles.askAnswerPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="message-condensation-title">Review Message</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => onCancelCondensedMessage(modal)}>
              Cancel
            </button>
          </div>
          {body}
          {actions}
        </section>
      </div>
    );
  }

  if (modal.type === "askAnswer") {
    const recipient = contacts.find((contact) => contact.id === modal.answer.recipientId) ?? contacts[0];
    const canSend = modal.answer.type === "message" && Boolean(modal.answer.messageBody.trim());
    const answerText = modal.answer.answer.trim();
    const isGenericMessageOffer = canSend && /^We can send this to\b/i.test(answerText);
    const messageOfferGuidance = isGenericMessageOffer
      ? `This can be sent to ${recipient.displayName} now, or you can say something else instead.`
      : "";
    const exerciseMeaningMatch = answerText.match(
      /^This is an exercise entry\. (?:I recorded|I could not save yet):\s*(.+?)\.?$/
    );
    const exerciseMeaningTitle = exerciseMeaningMatch?.[1]?.replace(/\.$/, "") || "";
    const isExerciseMeaningConfirmation = !canSend && Boolean(exerciseMeaningTitle);
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
    const diagnosticLine =
      receiverDiagnosticMode && modal.answer.diagnosticSummary
        ? modal.answer.diagnosticSummary
        : "";
    const isClarificationAnswer = isReceiverClarificationAnswer(modal.answer);
    const isRecipientClarificationAnswer =
      isClarificationAnswer && isReceiverRecipientClarificationAnswer(modal.answer);
    const clarificationReady = isRecipientClarificationAnswer
      ? Boolean(clarificationDraft.trim())
      : Boolean(clarificationDraft.trim());
    const clarificationPrimaryLabel = isRecipientClarificationAnswer
      ? `Send to ${contacts[0]?.displayName || fallbackPrimaryCoordinatorDisplayName}`
      : "Continue";
    const clarificationInputPanel = (
      <div className={styles.askClarificationForm}>
        <label className={styles.srOnly} htmlFor="receiver-clarification-input">
          Answer the question
        </label>
        <span className={styles.askClarificationPrompt}>{modal.answer.answer}</span>
        <input
          id="receiver-clarification-input"
          ref={clarificationInputRef}
          maxLength={RECEIVER_TEXT_INPUT_MAX_LENGTH}
          type="text"
          value={clarificationDraft}
          onChange={(event) => setClarificationDraft(limitReceiverTextInput(event.target.value))}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            submitInlineClarification(modal.answer);
          }}
        />
      </div>
    );

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="ask-answer-title">
          <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>You Said</span>
                <h2 id="ask-answer-title">{modal.answer.question}</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                Home
              </button>
            </div>
            <div className={styles.modernScrollableContent}>
              {isExerciseMeaningConfirmation ? (
                <section className={styles.modernMeaningConfirmation}>
                  <p>This is an exercise entry.</p>
                  <small>Saving exercise entries is not available in this preview yet.</small>
                </section>
              ) : isGenericMessageOffer ? (
                <section className={styles.modernMeaningConfirmation}>
                  <p>{answerText}</p>
                  <small>{messageOfferGuidance}</small>
                </section>
              ) : !canSend && !isClarificationAnswer ? (
                <p className={styles.modernReaderText}>{modal.answer.answer}</p>
              ) : null}
              {isClarificationAnswer ? clarificationInputPanel : null}
              {diagnosticLine ? (
                <p className={styles.receiverTraceDiagnostic}>{diagnosticLine}</p>
              ) : null}
            </div>
            <div className={styles.modernActionRow}>
              {isClarificationAnswer ? (
                <button
                  className={styles.modernPrimaryButton}
                  disabled={!clarificationReady}
                  type="button"
                  onClick={() => submitInlineClarification(modal.answer)}
                >
                  {clarificationPrimaryLabel}
                </button>
              ) : (
                <button
                  className={styles.modernPrimaryButton}
                  type="button"
                  onClick={() => {
                    if (canSend) {
                      onAttemptEvent("send_selected", {
                        recipient: recipient.displayName,
                        responseType: modal.answer.type,
                      });
                      markAskAnswerHelpful(modal.answer, true);
                      onSendContact(recipient, modal.answer.messageBody);
                      return;
                    }
                    markAskAnswerHelpful(modal.answer);
                    onClose();
                  }}
                >
                  {isExerciseMeaningConfirmation ? "Yes, that's right" : modal.answer.actionLabel}
                </button>
              )}
              <button
                className={styles.modernSecondaryButton}
                type="button"
                onClick={() => openAskRecovery(modal.answer.question, "ask_tell")}
              >
                {isExerciseMeaningConfirmation ? "Not quite" : "This wasn&apos;t helpful"}
              </button>
            </div>
          </section>
        </div>
      );
    }

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
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => closeAskAttempt()}>
                Go Home
              </button>
            </div>
            <p className={`${styles.askedText} ${styles.askAnswerText} ${styles.applianceAskAnswerText} ${textSizeClass}`}>
              {askedPages[currentAskedPage] || modal.answer.question}
            </p>
            {isExerciseMeaningConfirmation ? (
              <div className={styles.interpreterMessage}>
                <p>This is an exercise entry.</p>
                <p>Saving exercise entries is not available in this preview yet.</p>
              </div>
            ) : isGenericMessageOffer ? (
              <div className={styles.interpreterMessage}>
                <p>{answerText}</p>
                <p>{messageOfferGuidance}</p>
              </div>
            ) : !canSend && !isClarificationAnswer ? (
              <p className={styles.interpreterMessage}>{modal.answer.answer}</p>
            ) : null}
            {diagnosticLine ? (
              <p className={styles.receiverTraceDiagnostic}>{diagnosticLine}</p>
            ) : null}
            {isClarificationAnswer ? (
              <>
                {clarificationInputPanel}
                <div className={`${styles.universalAskActions} ${styles.askAnswerActions} ${styles.applianceAskAnswerActions}`}>
                  <button
                    className={styles.modalButton}
                    disabled={!clarificationReady}
                    type="button"
                    onClick={() => submitInlineClarification(modal.answer)}
                  >
                    {clarificationPrimaryLabel}
                  </button>
                  <button
                    className={`${styles.modalButton} ${styles.secondary}`}
                    type="button"
                    onClick={() => openAskRecovery(modal.answer.question)}
                  >
                    This wasn&apos;t helpful
                  </button>
                </div>
              </>
            ) : (
              <>
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
                        onAttemptEvent("send_selected", {
                          recipient: recipient.displayName,
                          responseType: modal.answer.type,
                        });
                        markAskAnswerHelpful(modal.answer, true);
                        onSendContact(recipient, modal.answer.messageBody);
                        return;
                      }
                      markAskAnswerHelpful(modal.answer);
                      onClose();
                    }}
                  >
                    {modal.answer.actionLabel}
                  </button>
                  <button
                    className={`${styles.modalButton} ${styles.secondary}`}
                    type="button"
                    onClick={() => openAskRecovery(modal.answer.question)}
                  >
                    This wasn&apos;t helpful
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      );
    }

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ask-answer-title">
        <section className={`${styles.modalPanel} ${styles.askAnswerPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="ask-answer-title">You Asked</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => closeAskAttempt()}>
              Go Home
            </button>
          </div>
          <p className={`${styles.askedText} ${styles.askAnswerText} ${textSizeClass}`}>
            {askedPages[currentAskedPage] || modal.answer.question}
          </p>
          {isExerciseMeaningConfirmation ? (
            <div className={styles.interpreterMessage}>
              <p>This is an exercise entry.</p>
              <p>Saving exercise entries is not available in this preview yet.</p>
            </div>
          ) : isGenericMessageOffer ? (
            <div className={styles.interpreterMessage}>
              <p>{answerText}</p>
              <p>{messageOfferGuidance}</p>
            </div>
          ) : !canSend && !isClarificationAnswer ? (
            <p className={styles.interpreterMessage}>{modal.answer.answer}</p>
          ) : null}
          {diagnosticLine ? (
            <p className={styles.receiverTraceDiagnostic}>{diagnosticLine}</p>
          ) : null}
          {isClarificationAnswer ? (
            <>
              {clarificationInputPanel}
              <div className={`${styles.universalAskActions} ${styles.askAnswerActions}`}>
                <button
                  className={styles.modalButton}
                  disabled={!clarificationReady}
                  type="button"
                  onClick={() => submitInlineClarification(modal.answer)}
                  >
                  {clarificationPrimaryLabel}
                </button>
                <button
                  className={`${styles.modalButton} ${styles.secondary}`}
                  type="button"
                  onClick={() => openAskRecovery(modal.answer.question)}
                >
                  This wasn&apos;t helpful
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={`${styles.universalAskActions} ${styles.askAnswerActions}`}>
                <button
                  className={styles.modalButton}
                  type="button"
                  onClick={() => {
                    if (canSend) {
                      onAttemptEvent("send_selected", {
                        recipient: recipient.displayName,
                        responseType: modal.answer.type,
                      });
                      markAskAnswerHelpful(modal.answer, true);
                      onSendContact(recipient, modal.answer.messageBody);
                      return;
                    }
                    markAskAnswerHelpful(modal.answer);
                    onClose();
                  }}
                >
                  {modal.answer.actionLabel}
                </button>
                <button
                  className={`${styles.modalButton} ${styles.secondary}`}
                  type="button"
                  onClick={() => openAskRecovery(modal.answer.question)}
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
            </>
          )}
        </section>
      </div>
    );
  }

  if (modal.type === "askRecovery") {
    const recoveryPrompt = modal.recoveryPrompt || askRecoveryPrompts[0];
    const recoveryContactName =
      contacts[0]?.displayName || fallbackPrimaryCoordinatorDisplayName;
    const isGenericAwarenessRecovery = /\b(?:someone|somebody)\s+(?:ought\s+to|needs?|should)\s+(?:to\s+)?(?:hear|know|be told)\b/i.test(
      modal.question
    );
    const recoveryDisplayPrompt = isGenericAwarenessRecovery
      ? `This can be sent to ${recoveryContactName} now, or you can say something else instead.`
      : recoveryPrompt;
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
    const diagnosticLine = receiverDiagnosticMode
      ? "Observation receiver -> MeaningFrame -> ReceiverAskInterpreter -> Recovery"
      : "";

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="recovery-title">
          <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>You Asked</span>
                <h2 id="recovery-title">What would you like to do?</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                Home
              </button>
            </div>
            <div className={styles.modernScrollableContent}>
              <p className={styles.modernAskedText}>{modal.question}</p>
              <p className={styles.modernReaderText}>{recoveryDisplayPrompt}</p>
              {diagnosticLine ? (
                <p className={styles.receiverTraceDiagnostic}>{diagnosticLine}</p>
              ) : null}
            </div>
            <div className={styles.modernActionRow}>
              <button className={styles.modernSecondaryButton} type="button" onClick={() => rephraseAsk(modal.question)}>
                I&apos;ll rephrase it
              </button>
              <button className={styles.modernPrimaryButton} type="button" onClick={() => sendAskRecovery(modal.question)}>
                Send this to {recoveryContactName}
              </button>
            </div>
          </section>
        </div>
      );
    }

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
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => closeAskAttempt("recovery_home")}>
                Go Home
              </button>
            </div>
            <p className={`${styles.askedText} ${styles.askAnswerText} ${styles.applianceAskAnswerText} ${textSizeClass}`}>
              {recoveryPages[currentRecoveryPage] || modal.question}
            </p>
            {diagnosticLine ? (
              <p className={styles.receiverTraceDiagnostic}>{diagnosticLine}</p>
            ) : null}
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
              {recoveryDisplayPrompt}
            </p>
            <div className={`${styles.universalAskActions} ${styles.askAnswerActions} ${styles.applianceAskAnswerActions}`}>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => rephraseAsk(modal.question)}>
                I&apos;ll try rephrasing it
              </button>
              <button className={styles.modalButton} type="button" onClick={() => sendAskRecovery(modal.question)}>
                Send this to {recoveryContactName}
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
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => closeAskAttempt("recovery_home")}>
              Go Home
            </button>
          </div>
          <p className={`${styles.askedText} ${styles.askAnswerText} ${textSizeClass}`}>
            {recoveryPages[currentRecoveryPage] || modal.question}
          </p>
          {diagnosticLine ? (
            <p className={styles.receiverTraceDiagnostic}>{diagnosticLine}</p>
          ) : null}
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
          <p className={styles.interpreterMessage}>{recoveryDisplayPrompt}</p>
          <div className={`${styles.universalAskActions} ${styles.askAnswerActions}`}>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => rephraseAsk(modal.question)}>
              I&apos;ll try rephrasing it
            </button>
            <button className={styles.modalButton} type="button" onClick={() => sendAskRecovery(modal.question)}>
              Send this to {recoveryContactName}
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

    if (modernPresentation) {
      return (
        <div
          className={`${styles.modal} ${styles.modernModal}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={summaryOpen ? "call-summary-title" : "call-captions-title"}
        >
          <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel} ${summaryOpen ? styles.modernCallSummaryPanel : ""}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Call</span>
                <h2 id={summaryOpen ? "call-summary-title" : "call-captions-title"}>
                  {summaryOpen ? "Call Summary" : "Closed Captioning"}
                </h2>
              </div>
              <button
                className={styles.modernSecondaryButton}
                type="button"
                onClick={() => {
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
              >
                {summaryOpen ? "Home" : "Close"}
              </button>
            </div>
            <div className={`${styles.modernScrollableContent} ${summaryOpen ? styles.modernCallSummaryContent : ""}`}>
              {summaryOpen ? (
                <>
                  {summaryStatusNotice ? <p className={styles.modernHelperText}>{summaryStatusNotice}</p> : null}
                  {modal.summaryApproval !== "approved" ? (
                    <textarea
                      className={`${styles.modernRequestInput} ${styles.modernCallSummaryInput}`}
                      placeholder={noCareSummaryNeeded ? "Add details about this call" : undefined}
                      value={summaryDraftText}
                      onChange={(event) =>
                        onSetModal({
                          ...modal,
                          summaryDraft: event.target.value,
                        })
                      }
                    />
                  ) : (
                    <p className={styles.modernReaderText}>{callSummaryText}</p>
                  )}
                </>
              ) : (
                <p className={styles.modernReaderText}>{callTranscriptText}</p>
              )}
            </div>
            {summaryOpen ? (
              <div className={styles.modernActionRow}>
                <button
                  className={styles.modernPrimaryButton}
                  disabled={
                    modal.summaryApproval === "approved" ||
                    (!approvedDraftReady && !noCareSummaryNeeded)
                  }
                  type="button"
                  onClick={() => {
                    void onApproveCallSummary(modal.callId, summaryDraftText);
                  }}
                >
                  {modal.summaryApproval === "approved" ? "Approved" : "Approve this version"}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      );
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
    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="appointments-loading-title">
          <section className={`${styles.modernModalPanel} ${styles.modernCompactPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Appointments</span>
                <h2 id="appointments-loading-title">Looking for appointments</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                Home
              </button>
            </div>
            <p className={styles.modernReaderText}>Looking for your appointments.</p>
          </section>
        </div>
      );
    }

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
    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="appointments-empty-title">
          <section className={`${styles.modernModalPanel} ${styles.modernCompactPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Appointments</span>
                <h2 id="appointments-empty-title">No upcoming appointments</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                Home
              </button>
            </div>
            <p className={styles.modernReaderText}>No upcoming appointments were found.</p>
          </section>
        </div>
      );
    }

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

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="appointments-list-title">
          <section className={`${styles.modernModalPanel} ${styles.modernAllMessagesPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Appointments</span>
                <h2 id="appointments-list-title">Upcoming appointments</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                Home
              </button>
            </div>
            {cacheNotice ? <p className={styles.modernHelperText}>{cacheNotice}</p> : null}
            <div className={styles.modernScrollableContent}>
              <div className={styles.modernMessageList}>
                {modal.appointments.map((appointment) => (
                  <button
                    className={styles.modernMessageRow}
                    key={appointment.id}
                    type="button"
                    onClick={() =>
                      onSetModal({
                        type: "appointmentDetail",
                        appointment,
                        appointments: modal.appointments,
                        cachedAt: modal.cachedAt,
                        page: 0,
                      })
                    }
                  >
                    <strong>{appointment.title || "Appointment"}</strong>
                    <span>{appointmentDateTimeLabel(appointment)}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      );
    }

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

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title">
          <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel} ${styles.modernAppointmentDetailPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Appointment</span>
                <h2 id="appointment-detail-title">{modal.appointment.title || "Appointment"}</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                Home
              </button>
            </div>
            <div className={styles.modernScrollableContent}>
              {cacheNotice ? <p className={styles.modernHelperText}>{cacheNotice}</p> : null}
              <div className={styles.modernDetailStack}>
                <strong>{appointmentDateTimeLabel(modal.appointment)}</strong>
                {appointmentSubtitle(modal.appointment) ? <p>{appointmentSubtitle(modal.appointment)}</p> : null}
                {modal.appointment.locationName ? <p>{modal.appointment.locationName}</p> : null}
                {modal.appointment.reason ? <p>{modal.appointment.reason}</p> : null}
              </div>
            </div>
            <div className={styles.modernActionRow}>
              {hasAddress ? (
                <button
                  className={styles.modernPrimaryButton}
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
                className={styles.modernSecondaryButton}
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

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="appointment-address-title">
          <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Appointment</span>
                <h2 id="appointment-address-title">Where is it?</h2>
              </div>
              <button
                className={styles.modernSecondaryButton}
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
                Back
              </button>
            </div>
            <div className={styles.modernScrollableContent}>
              {cacheNotice ? <p className={styles.modernHelperText}>{cacheNotice}</p> : null}
              <p className={styles.modernReaderText}>
                {modal.appointment.locationAddress || "No address is saved for this appointment."}
              </p>
              {modal.appointment.locationPhone ? (
                <p className={styles.modernHelperText}>{modal.appointment.locationPhone}</p>
              ) : null}
            </div>
          </section>
        </div>
      );
    }

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

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="sound-title">
          <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Sound</span>
                <h2 id="sound-title">{modal.view === "help" ? "Test Sounds" : "Optional Sounds"}</h2>
              </div>
              <div className={styles.modernActionRow}>
                {modal.view === "help" ? (
                  <button
                    className={styles.modernSecondaryButton}
                    type="button"
                    onClick={() => {
                      onResetSoundTestState();
                      onSetModal({ type: "soundSettings", view: "settings" });
                    }}
                  >
                    Back
                  </button>
                ) : null}
                <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                  Home
                </button>
              </div>
            </div>
            <div className={styles.modernScrollableContent}>
              {modal.view === "settings" ? (
                <div className={styles.modernDetailStack}>
                  <p>These sounds give helpful feedback but are not required.</p>
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
                </div>
              ) : (
                <div className={styles.modernDetailStack}>
                  <ul className={styles.soundHelpPanel}>
                    <li>Button beeps and retro sounds are optional.</li>
                    <li>Speech can work even if these sounds are quiet.</li>
                    <li>Use device volume buttons while this screen is open.</li>
                  </ul>
                  {soundDiagnostic ? <p className={styles.diagnosticText}>{soundDiagnostic}</p> : null}
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
                  {soundHelp ? (
                    <section className={styles.soundHelpRecipe} aria-live="polite">
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
                    </section>
                  ) : null}
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
                  </dl>
                </div>
              )}
            </div>
            <div className={styles.modernActionRow}>
              {modal.view === "settings" ? (
                <button className={styles.modernPrimaryButton} type="button" onClick={() => onSetModal({ type: "soundSettings", view: "help" })}>
                  Fix Sounds
                </button>
              ) : (
                <>
                  <button className={styles.modernPrimaryButton} data-receiver-no-beep="true" type="button" onClick={onTestSound}>
                    Run Test
                  </button>
                  <button className={styles.modernSecondaryButton} type="button" onClick={onResolveSoundHelp}>
                    This Fixed It
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      );
    }

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
    const messageAcknowledged = Boolean(modal.message.acknowledgedAt);
    const callbackRequested = Boolean(modal.message.callbackRequestedAt);
    const showCallbackRequest =
      modal.message.allowsCallbackRequest !== false && !callbackRequested;
    const messageActionDisabled = !receiverOnline;
    const closeReader = () => {
      if (readerReturnsToAllMessages) {
        onSetModal({ type: "allMessages", page: modal.returnPage ?? 0 });
        return;
      }
      onClose();
    };

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="reader-title">
          <section className={`${styles.modernModalPanel} ${styles.modernReaderPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Message</span>
                <h2 id="reader-title">{messageHeader(modal.message)}</h2>
              </div>
              <button
                className={styles.modernSecondaryButton}
                type="button"
                onClick={onClose}
              >
                Home
              </button>
            </div>
            <div className={styles.modernScrollableContent}>
              <p className={styles.modernReaderText}>{messageText(modal.message)}</p>
            </div>
            <div className={styles.modernActionRow}>
              <button
                className={styles.modernPrimaryButton}
                disabled={!messageAcknowledged && messageActionDisabled}
                type="button"
                onClick={() => {
                  if (messageAcknowledged) {
                    closeReader();
                    return;
                  }
                  onAcknowledgeMessage(modal.message);
                }}
              >
                {messageAcknowledged ? (readerReturnsToAllMessages ? "Back" : "Done") : "OK"}
              </button>
              {hasAudio ? (
                <button
                  className={styles.modernSecondaryButton}
                  type="button"
                  onClick={() => {
                    setPlayedMessageIds((current) => ({ ...current, [modal.message.id]: true }));
                    void onPlayMessage(modal.message, "default", !isPlayingMessage);
                  }}
                >
                  {playLabel}
                </button>
              ) : null}
              {showCallbackRequest ? (
                <button
                  className={styles.modernSecondaryButton}
                  disabled={messageActionDisabled}
                  type="button"
                  onClick={() => onCallBackForMessage(modal.message)}
                >
                  Call Back
                </button>
              ) : null}
              {callbackRequested ? <span className={styles.modernStatusPill}>Callback requested</span> : null}
            </div>
            {messageActionDisabled ? (
              <p className={styles.modernHelperText}>Internet is needed to send OK or request a callback.</p>
            ) : null}
          </section>
        </div>
      );
    }

    return (
      <div
        className={`${styles.modal} ${applianceMode ? styles.applianceFullscreenModal : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reader-title"
      >
        <section className={`${styles.modalPanel} ${styles.readerPanel} ${applianceMode ? styles.applianceReaderPanel : ""}`}>
          <div className={styles.modalTitleRow}>
            <h2 className={styles.readerTitle} id="reader-title">
              {messageHeader(modal.message)}
            </h2>
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              type="button"
              onClick={onClose}
            >
              Go Home
            </button>
          </div>
          <div className={styles.messageBodySlot}>
            <p className={`${styles.readerText} ${textSizeClass}`}>{readerPages[readerPage]}</p>
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
          <div className={styles.messageDetailFooter}>
            <div className={styles.messageDetailActions}>
              <button
                className={`${styles.modalButton} ${styles.blue}`}
                disabled={!messageAcknowledged && messageActionDisabled}
                type="button"
                onClick={() => {
                  if (messageAcknowledged) {
                    closeReader();
                    return;
                  }
                  onAcknowledgeMessage(modal.message);
                }}
              >
                {messageAcknowledged ? (readerReturnsToAllMessages ? "Back" : "Done") : "OK"}
              </button>
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
              {showCallbackRequest ? (
                <button
                  className={`${styles.modalButton} ${styles.callBackAction}`}
                  disabled={messageActionDisabled}
                  type="button"
                  onClick={() => onCallBackForMessage(modal.message)}
                >
                  Call Back
                </button>
              ) : null}
              {callbackRequested ? (
                <span className={styles.messagePreferenceAction}>
                  Callback requested
                </span>
              ) : null}
            </div>
            <div className={styles.readerCompactPageControls} aria-label="Message page controls">
              <button
                className={`${styles.modalButton} ${styles.secondary}`}
                disabled={!hasReaderPaging || readerPage === 0}
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
                disabled={!hasReaderPaging || readerPage >= readerPages.length - 1}
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
            <div className={styles.readerCompactSizeRow} aria-label="Message text size">
              {[
                ["standard", "a", "Standard"],
                ["large", "A", "Large"],
                ["extra", "A", "Extra large"],
              ].map(([value, label, ariaLabel]) => {
                const selected = messageTextSize === value;
                const sizeClass =
                  value === "standard"
                    ? styles.readerCompactSizeStandard
                    : value === "extra"
                      ? styles.readerCompactSizeExtra
                      : styles.readerCompactSizeLarge;
                return (
                  <button
                    aria-label={ariaLabel}
                    aria-pressed={selected}
                    className={`${styles.readerCompactSizeButton} ${sizeClass} ${
                      selected ? styles.readerCompactSizeButtonSelected : ""
                    }`}
                    key={value}
                    type="button"
                    onClick={() => onMessageTextSizeChange(value as ReaderTextSize)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          {messageActionDisabled ? (
            <p className={styles.messagePreferenceAction}>
              Internet is needed to send OK or request a callback.
            </p>
          ) : null}
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
    const allMessagesPageSize = applianceMode
      ? messageTextSize === "standard"
        ? 2
        : messageTextSize === "extra"
          ? 1
          : 2
      : messageTextSize === "standard"
        ? 4
        : messageTextSize === "extra"
          ? 2
          : 3;
    const allMessagesPageCount = Math.max(1, Math.ceil(messages.length / allMessagesPageSize));
    const currentAllMessagesPage = Math.min(Math.max(modal.page, 0), allMessagesPageCount - 1);
    const visibleMessages = messages.slice(
      currentAllMessagesPage * allMessagesPageSize,
      currentAllMessagesPage * allMessagesPageSize + allMessagesPageSize
    );

    if (modernPresentation) {
      return (
        <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="all-messages-title">
          <section className={`${styles.modernModalPanel} ${styles.modernAllMessagesPanel}`}>
            <div className={styles.modernModalHeader}>
              <div>
                <span>Messages</span>
                <h2 id="all-messages-title">All Messages</h2>
              </div>
              <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
                Home
              </button>
            </div>
            <div className={styles.modernScrollableContent}>
              <div className={styles.modernMessageList}>
                {messages.length ? (
                  messages.map((message) => (
                    <button
                      className={styles.modernMessageRow}
                      key={message.id}
                      type="button"
                      onClick={() => {
                        onOpenMessageFromAllMessages(message, 0);
                      }}
                    >
                      <strong>{messageHeader(message)}</strong>
                      <span>{messageText(message)}</span>
                    </button>
                  ))
                ) : (
                  <p className={styles.modernReaderText}>No messages yet.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      );
    }

    if (applianceMode) {
      return (
        <div className={`${styles.modal} ${styles.applianceFullscreenModal}`} role="dialog" aria-modal="true" aria-labelledby="all-messages-title">
          <section className={`${styles.modalPanel} ${styles.applianceListPanel}`}>
            <div className={`${styles.applianceListToolbar} ${styles.applianceMessagesToolbar}`}>
              <h2 id="all-messages-title">Messages</h2>
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
            <div className={styles.applianceMessagesFooter}>
              <button className={`${styles.modalButton} ${styles.blue}`} type="button" onClick={onClose}>
                Go Home
              </button>
              <div className={styles.readerCompactPageControls} aria-label="All messages page controls">
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
              <div className={styles.readerCompactSizeRow} aria-label="Message text size">
                {[
                  ["standard", "a", "Standard"],
                  ["large", "A", "Large"],
                  ["extra", "A", "Extra large"],
                ].map(([value, label, ariaLabel]) => {
                  const selected = messageTextSize === value;
                  const sizeClass =
                    value === "standard"
                      ? styles.readerCompactSizeStandard
                      : value === "extra"
                        ? styles.readerCompactSizeExtra
                        : styles.readerCompactSizeLarge;
                  return (
                    <button
                      aria-label={ariaLabel}
                      aria-pressed={selected}
                      className={`${styles.readerCompactSizeButton} ${sizeClass} ${
                        selected ? styles.readerCompactSizeButtonSelected : ""
                      }`}
                      key={value}
                      type="button"
                      onClick={() => onMessageTextSizeChange(value as ReaderTextSize)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
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

  if (modernPresentation) {
    return (
      <div className={`${styles.modal} ${styles.modernModal}`} role="dialog" aria-modal="true" aria-labelledby="sent-title">
        <section className={`${styles.modernModalPanel} ${styles.modernCompactPanel}`}>
          <div className={styles.modernModalHeader}>
            <div>
              <span>Sent</span>
              <h2 id="sent-title">Message Sent</h2>
            </div>
            <button className={styles.modernSecondaryButton} type="button" onClick={onClose}>
              Home
            </button>
          </div>
          <p className={styles.modernReaderText}>Your message was sent to {modal.recipientName}.</p>
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
