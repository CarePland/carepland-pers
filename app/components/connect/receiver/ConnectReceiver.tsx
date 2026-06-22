"use client";

import {
  type CSSProperties,
  type MouseEvent,
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
  connectPrototypeEndpoints,
  connectPrototypeReceiverId,
} from "../../../lib/connect/prototypeClient";
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
  callId: string;
  callerName: string;
  state: string;
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

const RECEIVER_CANVAS_WIDTH = 900;
const RECEIVER_CANVAS_HEIGHT = 1047;
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

type AskAnswer = {
  question: string;
  answer: string;
  actionLabel: string;
  messageBody: string;
  recipientId: string;
  type: "answer" | "message";
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

type GuideTarget = "contact" | "primary" | "ask";

type GuideRect = {
  height: number;
  label: string;
  width: number;
  x: number;
  y: number;
};

type ModalState =
  | { type: "contact"; contactId: string }
  | { type: "ask" }
  | { type: "askRecordReview"; transcript: string }
  | { type: "askAnswer"; answer: AskAnswer }
  | { type: "askRecovery"; question: string }
  | { type: "appointmentsLoading" }
  | { type: "appointmentsList"; appointments: ReceiverAppointment[]; page: number }
  | { type: "appointmentDetail"; appointment: ReceiverAppointment; appointments: ReceiverAppointment[]; page: number }
  | { type: "appointmentAddress"; appointment: ReceiverAppointment; appointments: ReceiverAppointment[]; page: number }
  | { type: "sent"; recipientName: string }
  | { type: "reader"; message: Message; returnPage?: number; returnTo?: "allMessages" | "home" }
  | { type: "allMessages"; page: number }
  | { type: "soundSettings"; view: "settings" | "help" }
  | { type: "incomingCall"; callId?: string; callerName: string; callState: "ringing" | "connected" }
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

const receiverGuideTargetStorageKey = "carepland-connect-guide-target";
const receiverGuideRectStorageKey = "carepland-connect-guide-rect";
const receiverLastPressStorageKey = "carepland-connect-last-press";
const receiverSessionStorageKey = "carepland-connect-receiver-session";
const receiverAutoHearStorageKey = "carepland-connect-auto-hear-messages";
const connectMessagesEndpoint = "/api/connect/messages";
const connectCallsEndpoint = "/api/connect/calls";
const connectAudioPlaybackEventsEndpoint = "/api/connect/audio/playback-events";
const connectAudioProfileEndpoint = "/api/connect/audio/profile";

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

function readInitialPreviewMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
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
  return readInitialPreviewMode() || readStoredReceiverSession().started === true;
}

function readInitialSelectedContactId() {
  const storedContactId = readStoredReceiverSession().selectedContactId;
  return contacts.some((contact) => contact.id === storedContactId) ? storedContactId : contacts[0].id;
}

function readInitialSelectedReceiverUserId() {
  // Receiver identity comes from /api/connect/context, not local storage.
  return "";
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
    modal?.type === "askRecordReview" ||
    modal?.type === "soundSettings"
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
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 22) return "Good Evening";
  return "Good Night";
}

function contactCanCallNow(contact: Contact) {
  return contact.canCall && contact.availability === "free";
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
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

function receiverApplianceStyle(initialDevicePixelRatio: number): CSSProperties {
  if (typeof window === "undefined") {
    return {
      "--receiver-canvas-height": `${RECEIVER_CANVAS_HEIGHT}px`,
      "--receiver-canvas-width": `${RECEIVER_CANVAS_WIDTH}px`,
      "--receiver-scale": "1",
    } as CSSProperties;
  }

  const currentDevicePixelRatio = window.devicePixelRatio || initialDevicePixelRatio || 1;
  const zoomRatio = Math.max(0.1, currentDevicePixelRatio / initialDevicePixelRatio);
  const baseViewportWidth = window.innerWidth * zoomRatio;
  const baseViewportHeight = window.innerHeight * zoomRatio;
  const baseScale = Math.min(
    baseViewportWidth / RECEIVER_CANVAS_WIDTH,
    baseViewportHeight / RECEIVER_CANVAS_HEIGHT
  );
  const cssScale = Math.max(0.1, baseScale / zoomRatio);

  return {
    "--receiver-canvas-height": `${RECEIVER_CANVAS_HEIGHT}px`,
    "--receiver-canvas-width": `${RECEIVER_CANVAS_WIDTH}px`,
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
        "Run Test Optional Sounds again.",
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
      "Tap Test Optional Sounds again after changing settings.",
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
  const [applianceStyle, setApplianceStyle] = useState<CSSProperties>(() =>
    receiverApplianceStyle(initialReceiverDevicePixelRatio())
  );
  const [now, setNow] = useState(() => new Date());
  const [started, setStarted] = useState(readInitialStarted);
  const [selectedContactId] = useState(readInitialSelectedContactId);
  const [activeReceiverUsers, setActiveReceiverUsers] = useState<ReceiverUser[]>(receiverUsers);
  const [selectedReceiverUserId, setSelectedReceiverUserId] = useState(readInitialSelectedReceiverUserId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [messageTextSize, setMessageTextSize] = useState<ReaderTextSize>(readInitialMessageTextSize);
  const [focusedMessageIndex, setFocusedMessageIndex] = useState(0);
  const [, setStatus] = useState("Ready.");
  const [modal, setModal] = useState<ModalState>(readInitialModal);
  const [contactDraft, setContactDraft] = useState(() => readStoredReceiverSession().contactDraft || "");
  const [askDraft, setAskDraft] = useState(() => readStoredReceiverSession().askDraft || "");
  const [guideTarget, setGuideTarget] = useState<GuideTarget | null>(null);
  const [guideRect, setGuideRect] = useState<GuideRect | null>(null);
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
  const audioRef = useRef<ReceiverPlaybackHandle | null>(null);
  const playingEnhancementProfileRef = useRef<ReceiverAudioEnhancementProfile | null>(null);
  const playingMessageRef = useRef<Message | null>(null);
  const cueAudioRef = useRef<HTMLAudioElement | null>(null);
  const cueTimeoutRef = useRef<number | null>(null);
  const receiverRecordingControllerRef = useRef<ConnectAudioRecordingController | null>(null);
  const receiverCaptureIdRef = useRef("");
  const contactRecordingControllerRef = useRef<ConnectAudioRecordingController | null>(null);
  const contactCaptureIdRef = useRef("");

  const refreshMessages = useCallback(async () => {
    if (!selectedReceiverUserId) return;

    try {
      const messagesUrl = `${connectMessagesEndpoint}?personId=${encodeURIComponent(selectedReceiverUserId)}`;
      const response = await fetch(messagesUrl, {
        cache: "no-store",
        headers: await connectAuthHeaders(),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        messages?: Array<Partial<Message> & { id?: string }>;
      };

      if (!response.ok || !Array.isArray(payload.messages)) return;

      const nextMessages = payload.messages
        .filter((message): message is Partial<Message> & { id: string } => Boolean(message.id))
        .map((message) => normalizeServerMessage(message));

      if (nextMessages.length) {
        setMessages(nextMessages);
        setFocusedMessageIndex((index) => Math.min(index, nextMessages.length - 1));
      }
    } catch {
      // Keep the local seed messages if the Connect local server is unavailable.
    }
  }, [selectedReceiverUserId]);

  const refreshCalls = useCallback(async () => {
    if (!selectedReceiverUserId) return;

    try {
      const response = await fetch(
        `${connectCallsEndpoint}?personId=${encodeURIComponent(selectedReceiverUserId)}`,
        {
          cache: "no-store",
          headers: await connectAuthHeaders(),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        calls?: Array<Partial<ReceiverCall>>;
      };

      if (!response.ok || !Array.isArray(payload.calls)) return;

      const activeCall = payload.calls.find((call) =>
        ["ringing", "answered", "connected"].includes(String(call.state || ""))
      );
      if (!activeCall?.callId) return;

      const callState = String(activeCall.state || "ringing");
      const callerName = String(activeCall.callerName || "Andrew");
      setModal((current) => {
        if (
          current?.type === "incomingCall" &&
          current.callId === activeCall.callId &&
          current.callState === (callState === "ringing" ? "ringing" : "connected")
        ) {
          return current;
        }

        return {
          callId: String(activeCall.callId),
          callerName,
          callState: callState === "ringing" ? "ringing" : "connected",
          type: "incomingCall",
        };
      });
      setStatus(
        callState === "ringing"
          ? `${callerName} is calling.`
          : `Connected to ${callerName}.`
      );
    } catch {
      // Keep the receiver usable if the Connect local server is unavailable.
    }
  }, [selectedReceiverUserId]);

  useEffect(() => {
    function updateApplianceScale() {
      setApplianceStyle(receiverApplianceStyle(initialDevicePixelRatioRef.current));
    }

    updateApplianceScale();
    window.addEventListener("resize", updateApplianceScale);
    window.visualViewport?.addEventListener("resize", updateApplianceScale);

    return () => {
      window.removeEventListener("resize", updateApplianceScale);
      window.visualViewport?.removeEventListener("resize", updateApplianceScale);
    };
  }, []);

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
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
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
          headers: await connectAuthHeaders(),
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
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      cueAudioRef.current?.pause();
      if (cueTimeoutRef.current) window.clearTimeout(cueTimeoutRef.current);
      if (pendingContactRecording?.recording.localUrl) {
        URL.revokeObjectURL(pendingContactRecording.recording.localUrl);
      }
    };
  }, [pendingContactRecording]);

  useEffect(() => {
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
    selectedContactId,
    selectedReceiverUserId,
    soundSettings,
    started,
  ]);

  useEffect(() => {
    let ignore = false;

    async function refreshReceiverUsers() {
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
        setActiveReceiverUsers(users);
        setSelectedReceiverUserId(context.mainConnectUserPersonId || "");
      } catch {
        // Keep the current receiver context when Pers context is temporarily unavailable.
      }
    }

    void refreshReceiverUsers();

    return () => {
      ignore = true;
    };
  }, []);

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

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) ?? contacts[0],
    [selectedContactId]
  );
  const visibleReceiverUsers = activeReceiverUsers.slice(0, 4);
  const selectedReceiverUser =
    visibleReceiverUsers.find((user) => user.id === selectedReceiverUserId) ??
    noMainConnectUser;
  const focusedMessage = messages[focusedMessageIndex] ?? messages[0] ?? null;
  const hasMessagePaging = messages.length > 1;

  function clearGuideBecauseReceiverActed() {
    if (guideTarget || guideRect) {
      const pressedLabel = guideRect?.label;
      window.localStorage.removeItem(receiverGuideTargetStorageKey);
      window.localStorage.removeItem(receiverGuideRectStorageKey);
      window.localStorage.setItem(
        receiverLastPressStorageKey,
        JSON.stringify({ label: pressedLabel, pressedAt: currentEpochMs(), target: guideTarget })
      );
      setGuideTarget(null);
      setGuideRect(null);
      setStatus("Guide cleared. You chose what to do.");
    }
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
    clearGuideBecauseReceiverActed();
    setContactDraft("");
    setPendingContactRecording(null);
    setModal({ type: "contact", contactId: contact.id });
  }

  async function sendMessage(contact: Contact, body: string, recording = pendingContactRecording) {
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
          ...(await connectAuthHeaders()),
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
    clearGuideBecauseReceiverActed();
    setAskDraft("");
    setPendingAskAudio(null);
    setModal({ type: "ask" });
  }

  async function loadUpcomingAppointments() {
    if (!selectedReceiverUser.id) {
      return [];
    }

    try {
      const response = await fetch(
        `/api/connect/appointments?personId=${encodeURIComponent(selectedReceiverUser.id)}`,
        {
          cache: "no-store",
          headers: await connectAuthHeaders(),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        appointments?: Array<Partial<ReceiverAppointment> & { id?: string }>;
      };

      if (!response.ok || !Array.isArray(payload.appointments) || !payload.appointments.length) {
        return [];
      }

      return payload.appointments.map((appointment, index) =>
        normalizeAppointment(appointment, index)
      );
    } catch {
      return [];
    }
  }

  function askAppointmentQuestion() {
    clearGuideBecauseReceiverActed();
    setModal({ type: "appointmentsLoading" });
    setStatus("Looking for upcoming appointments.");

    window.setTimeout(() => {
      void loadUpcomingAppointments().then((appointments) => {
        if (!appointments.length) {
          setModal({
            type: "reader",
            message: {
              id: `appointment-empty-${currentEpochMs()}`,
              body: "No upcoming appointments were found.",
              createdAt: currentIsoTimestamp(),
              from: "CarePland",
              to: selectedReceiverUser.displayName,
            },
          });
          setStatus("No upcoming appointments found.");
          return;
        }

        setModal({ type: "appointmentsList", appointments, page: 0 });
        setStatus(`${appointments.length} upcoming appointments loaded.`);
      });
    }, 350);
  }

  async function startReceiverRecording() {
    clearGuideBecauseReceiverActed();

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
    setModal({ type: "soundSettings", view: "settings" });
    setStatus("Optional sounds settings are open.");
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
          ...(await connectAuthHeaders()),
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
    } catch {
      // State updates are telemetry; HEAR and READ should keep working offline.
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
          ...(await connectAuthHeaders()),
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
    clearGuideBecauseReceiverActed();
    void markMessageState(message, { read: true });
    setModal({ type: "reader", message, returnTo: "home" });
  }

  function openMessageFromAllMessages(message: Message, page: number) {
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
    clearGuideBecauseReceiverActed();
    const senderName = message.from === "receiver_user" ? message.to : message.from;
    const contact = contacts.find((item) => item.displayName === senderName) ?? selectedContact;
    callContact(contact);
  }

  function showAllMessages() {
    clearGuideBecauseReceiverActed();
    setModal({ type: "allMessages", page: 0 });
    setStatus("Showing all messages.");
  }

  function submitAsk() {
    const question = askDraft.trim();
    if (!question) {
      setStatus("Type what you want to ask first.");
      return;
    }

    if (isLowConfidenceAsk(question)) {
      setModal({ type: "askRecovery", question });
      setStatus("Ask needs a little more help.");
      return;
    }

    setModal({ type: "askAnswer", answer: answerForAsk(question, selectedContact) });
    setStatus("Ask found an answer.");
  }

  function escalateAskRecovery(question: string) {
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
    if (!callId) return;
    if (!selectedReceiverUser.id) return;

    try {
      await fetch(`${connectCallsEndpoint}/${encodeURIComponent(callId)}/state`, {
        body: JSON.stringify({
          mainConnectUserPersonId: selectedReceiverUser.id,
          source: "receiver",
          state,
        }),
        headers: {
          ...(await connectAuthHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
    } catch {
      setStatus("Could not update the call on the local server.");
    }
  }

  function callContact(contact: Contact) {
    closeModal();
    if (!contactCanCallNow(contact)) {
      playCallFailedAudio();
      setStatus(`${contact.displayName} is unavailable right now.`);
      return;
    }
    playOutgoingRingback();
    setStatus(`Calling ${contact.displayName}.`);
  }

  function answerIncomingCall(callerName: string, callId?: string) {
    stopReceiverCue();
    void reportCallState(callId, "answered");
    window.setTimeout(() => {
      void reportCallState(callId, "connected");
    }, 250);
    setModal({ type: "incomingCall", callId, callerName, callState: "connected" });
    setStatus(`Connected to ${callerName}.`);
  }

  function declineIncomingCall(callerName: string, callId?: string) {
    stopReceiverCue();
    void reportCallState(callId, "declined");
    closeModal();
    playCallFailedAudio();
    setStatus(`Call from ${callerName} was not answered.`);
  }

  function hangUpIncomingCall(callerName: string, callId?: string) {
    stopReceiverCue();
    void reportCallState(callId, "hung_up");
    closeModal();
    setStatus(`Call with ${callerName} ended.`);
  }

  function closeModal() {
    stopReceiverCue();
    if (playingMessageId || audioRef.current || playingMessageRef.current) {
      stopMessagePlayback();
    }
    setModal(null);
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

  if (!started) {
    return (
      <main className={styles.activationScreen}>
        <section className={styles.activationPanel} aria-label="Start receiver">
          <p>CarePland Connect</p>
          <h1>Receiver</h1>
          <span>Living Room Receiver</span>
          <button type="button" onClick={() => setStarted(true)}>
            Start Receiver
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`${styles.receiverPage} ${guideTarget || guideRect ? styles.guideActive : ""}`}
      onClick={clearGuideBecauseReceiverActed}
    >
      <div className={styles.applianceFrame} style={applianceStyle}>
        <section
          className={styles.receiverShell}
          aria-label="CarePland Connect Receiver"
          data-receiver-shell="true"
          onClickCapture={handleReceiverButtonClickCapture}
        >
          <header className={styles.statusZone}>
            <div className={styles.timeBlock}>
              <strong>{formatTime(now)}</strong>
              <span>{formatDate(now)}</span>
            </div>
            <div className={styles.greetingBlock}>
              <strong>
                {greetingFor(now)}, {selectedReceiverUser.displayName}
              </strong>
              <span>{receiver.locationLabel}</span>
            </div>
            <div className={styles.appointmentPanel}>
              <div>
                <span>{nextAppointment.label}</span>
                <strong>{nextAppointment.title}</strong>
              </div>
              <div>
                <span>{nextAppointment.dayLabel}</span>
                <strong>{nextAppointment.timeLabel}</strong>
              </div>
            </div>
          </header>

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

          <section className={styles.actionZone} aria-label="Primary actions">
            <button
              className={`${styles.primaryAction} ${
                guideTarget === "primary"
                  ? styles.guideTarget
                  : guideTarget
                    ? styles.guideDim
                    : ""
              }`}
              type="button"
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
                }`}
                type="button"
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
                } ${guideTarget ? styles.guideDim : ""}`}
                type="button"
                aria-label={receiverRecording ? "Stop recording" : "Record a request"}
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
              When is my appointment?
            </button>
          </section>

          <section className={styles.workspaceZone} aria-label="Messages">
            <div className={styles.workspaceNav}>
              <strong>Messages</strong>
              <button
                className={`${styles.messageAction} ${styles.messageNavButton} ${styles.workspaceShowAllButton}`}
                type="button"
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
                    className={`${styles.messageAction} ${styles.blue}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      openMessage(focusedMessage);
                    }}
                  >
                    OPEN MESSAGE
                  </button>
                  <button
                    className={`${styles.messageAction} ${styles.callBackAction}`}
                    type="button"
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
          </section>
          {modal ? (
            <ReceiverModal
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
              onAskDraftChange={setAskDraft}
              onCallBackForMessage={callBackForMessage}
              onCallContact={callContact}
              onClose={closeModal}
              onContactDraftChange={setContactDraft}
              onAnswerIncomingCall={answerIncomingCall}
              onDeclineIncomingCall={declineIncomingCall}
              onEscalateAskRecovery={escalateAskRecovery}
              onHangUpIncomingCall={hangUpIncomingCall}
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
              onSendContact={sendMessage}
              onSetModal={setModal}
              onSubmitAsk={submitAsk}
              onTestSound={testOptionalSound}
              onToggleAutoHearPreference={toggleAutoHearPreference}
              onUpdateSoundSetting={updateSoundSetting}
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
        </section>
      </div>
    </main>
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

function ReceiverModal({
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
  onAskDraftChange,
  onAnswerIncomingCall,
  onCallBackForMessage,
  onCallContact,
  onClose,
  onContactDraftChange,
  onDeclineIncomingCall,
  onEscalateAskRecovery,
  onHangUpIncomingCall,
  onMessageTextSizeChange,
  onOpenMessageFromAllMessages,
  onPlayMessage,
  onRecordContact,
  onRecordRequest,
  onRecordHearingFeedback,
  onReportSoundProblem,
  onResolveSoundHelp,
  onRetryAsk,
  onSendContact,
  onSetModal,
  onSubmitAsk,
  onTestSound,
  onToggleAutoHearPreference,
  onUpdateSoundSetting,
}: {
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
  onAskDraftChange: (value: string) => void;
  onAnswerIncomingCall: (callerName: string, callId?: string) => void;
  onCallBackForMessage: (message: Message) => void;
  onCallContact: (contact: Contact) => void;
  onClose: () => void;
  onContactDraftChange: (value: string) => void;
  onDeclineIncomingCall: (callerName: string, callId?: string) => void;
  onEscalateAskRecovery: (question: string) => void;
  onHangUpIncomingCall: (callerName: string, callId?: string) => void;
  onMessageTextSizeChange: (value: ReaderTextSize) => void;
  onOpenMessageFromAllMessages: (message: Message, page: number) => void;
  onPlayMessage: (message: Message, variant?: PlaybackVariant, forceRestart?: boolean) => Promise<void>;
  onRecordContact: (contact: Contact) => Promise<void>;
  onRecordRequest: () => Promise<void>;
  onRecordHearingFeedback: (message: Message, choice: string) => void;
  onReportSoundProblem: (problem: SoundProblem) => void;
  onResolveSoundHelp: () => void;
  onRetryAsk: (question: string) => void;
  onSendContact: (contact: Contact, body: string, recording?: PendingContactRecording | null) => void;
  onSetModal: (modal: ModalState) => void;
  onSubmitAsk: () => void;
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
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ask-title">
        <section className={styles.modalPanel}>
          <div className={styles.modalTitleRow}>
            <h2 id="ask-title">What would you like?</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <p className={styles.askPrompt}>Type anything, or click a button.</p>
          <textarea
            className={styles.requestInput}
            onChange={(event) => onAskDraftChange(event.target.value)}
            placeholder="Example: I need milk"
            value={askDraft}
          />
          <div className={styles.requestExamples}>
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

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ask-answer-title">
        <section className={styles.modalPanel}>
          <div className={styles.modalTitleRow}>
            <div>
              <span className={styles.askedLabel}>You asked</span>
              <h2 id="ask-answer-title">{modal.answer.question}</h2>
            </div>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <p className={styles.interpreterMessage}>{modal.answer.answer}</p>
          {canSend ? (
            <p className={styles.askedText}>
              <span>Message:</span> {modal.answer.messageBody}
            </p>
          ) : null}
          <div className={styles.universalAskActions}>
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
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => onSetModal({ type: "ask" })}>
              Ask Andrew
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (modal.type === "askRecovery") {
    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        <section className={styles.modalPanel}>
          <div className={styles.modalTitleRow}>
            <div>
              <span className={styles.askedLabel}>You asked</span>
              <h2 id="recovery-title">{modal.question}</h2>
            </div>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
          <p className={styles.interpreterMessage}>I didn&apos;t quite understand. What would you like to do?</p>
          <div className={styles.universalAskActions}>
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
    const connected = modal.callState === "connected";

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="call-title">
        <section className={`${styles.modalPanel} ${styles.incomingCallModal}`}>
          <div className={`${styles.incomingCallPanel} ${connected ? styles.connected : styles.ringing}`}>
            <p>{connected ? "Call Connected" : "Call Coming In"}</p>
            <h2 id="call-title">{modal.callerName}</h2>
            <span>{connected ? "You are connected now." : "Press Answer to talk now."}</span>
          </div>
          {connected ? (
            <button className={`${styles.modalButton} ${styles.danger}`} type="button" onClick={() => onHangUpIncomingCall(modal.callerName, modal.callId)}>
              Hang Up
            </button>
          ) : (
            <div className={styles.incomingCallActions}>
              <button
                className={styles.modalButton}
                type="button"
                onClick={() => onAnswerIncomingCall(modal.callerName, modal.callId)}
              >
                Answer
              </button>
              <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={() => onDeclineIncomingCall(modal.callerName, modal.callId)}>
                Not Now
              </button>
            </div>
          )}
        </section>
      </div>
    );
  }

  if (modal.type === "appointmentsLoading") {
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

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="appointments-list-title">
        <section className={`${styles.modalPanel} ${styles.appointmentChooserPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="appointments-list-title">Which appointment?</h2>
            <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
              Go Home
            </button>
          </div>
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

    return (
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title">
        <section className={styles.modalPanel}>
          <div className={styles.modalTitleRow}>
            <h2 id="appointment-detail-title">Appointment</h2>
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              type="button"
              onClick={() => onSetModal({ type: "appointmentsList", appointments: modal.appointments, page: modal.page })}
            >
              Go Back
            </button>
          </div>
          <section className={styles.appointmentDetail}>
            <h3>{modal.appointment.title || "Appointment"}</h3>
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
                  page: modal.page,
                })
              }
            >
              Where is it?
            </button>
          ) : null}
          <button className={`${styles.modalButton} ${styles.secondary}`} type="button" onClick={onClose}>
            Done
          </button>
        </section>
      </div>
    );
  }

  if (modal.type === "appointmentAddress") {
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
                  page: modal.page,
                })
              }
            >
              Go Back
            </button>
          </div>
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
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="sound-title">
        <section className={`${styles.modalPanel} ${styles.soundPanel}`}>
          <div className={styles.modalTitleRow}>
            <h2 id="sound-title">
              {modal.view === "help" ? "Optional Sounds Help" : "Optional Sounds"}
            </h2>
            <button
              className={`${styles.modalButton} ${styles.secondary}`}
              type="button"
              onClick={onClose}
            >
              Go Home
            </button>
          </div>
          {modal.view === "settings" ? (
            <>
              <p className={styles.settingsCopy}>
                These sounds are helpful feedback, but Connect can still work without them.
              </p>
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
              <button
                className={`${styles.modalButton} ${styles.gold}`}
                type="button"
                onClick={() => onSetModal({ type: "soundSettings", view: "help" })}
              >
                Fix Optional Sounds
              </button>
            </>
          ) : (
            <>
              <button
                className={`${styles.modalButton} ${styles.soundTestButton}`}
                data-receiver-no-beep="true"
                type="button"
                onClick={onTestSound}
              >
                Test Optional Sounds
              </button>
              {soundDiagnostic ? <p className={styles.diagnosticText}>{soundDiagnostic}</p> : null}
              <div className={styles.soundHelpPanel}>
                <p>Optional sounds include button beeps and retro sounds.</p>
                <p>Speech may work even when other sounds are quiet.</p>
                <p>Adjust volume while this screen is open.</p>
                <p>Check audio output settings if available.</p>
              </div>
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
              {soundHelp ? (
                <section className={styles.soundHelpRecipe} aria-live="polite">
                  <h3>{soundHelp.title}</h3>
                  <p>{soundHelp.summary}</p>
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
                      Test Again
                    </button>
                    <button className={styles.soundChoice} type="button" onClick={onResolveSoundHelp}>
                      This Fixed It
                    </button>
                  </div>
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
    const allMessagesPageSize = messageTextSize === "standard" ? 4 : messageTextSize === "extra" ? 2 : 3;
    const allMessagesPageCount = Math.max(1, Math.ceil(messages.length / allMessagesPageSize));
    const currentAllMessagesPage = Math.min(Math.max(modal.page, 0), allMessagesPageCount - 1);
    const visibleMessages = messages.slice(
      currentAllMessagesPage * allMessagesPageSize,
      currentAllMessagesPage * allMessagesPageSize + allMessagesPageSize
    );

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
              <p className={styles.readerText}>No messages yet.</p>
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
