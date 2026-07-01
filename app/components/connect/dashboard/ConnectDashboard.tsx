"use client";

import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CarePlandTopNav } from "../../shared/CarePlandTopNav";
import { UserFacingFooter } from "../../public/UserFacingFooter";
import {
  connectAuthHeaders,
  fetchConnectFocusPeople,
  fetchConnectMainUserContext,
  updateConnectMainUserContext,
} from "../../../lib/connect/context/client";
import { resolveActiveConnectPersonId } from "../../../lib/connect/context/focus";
import type {
  ConnectMainUserContext,
  ConnectPersPerson,
} from "../../../lib/connect/context";
import { isConnectPetSubjectType } from "../../../lib/connect/context/mainConnectUserEligibility";
import {
  connectAvatarAltText,
  connectAvatarInitials,
  type ConnectAvatarPerson,
} from "../../../lib/connect/avatar";
import {
  blobToBase64,
  browserConnectAudioRecordingAvailable,
  createConnectAudioCaptureContext,
  createConnectAudioCaptureId,
  requestConnectAudioTranscription,
  startConnectAudioRecording,
  type ConnectAudioRecording,
  type ConnectAudioRecordingController,
} from "../../../lib/connect/audio";
import {
  connectPrototypeEndpoints,
  connectPrototypeReceiverId,
} from "../../../lib/connect/prototypeClient";
import {
  createConnectCallAudioController,
  type ConnectCallAudioStatus,
  type ConnectCallAudioController,
} from "../../../lib/connect/calls/browserCallAudio";
import { recordConnectCallLifecycleEvent } from "../../../lib/connect/calls/browserCallDiagnostics";
import {
  fetchConnectProvisioningSnapshot,
  type ConnectProvisioningSnapshot,
  type ConnectReceiverDevice,
  type ConnectReceiverHousehold,
  type ConnectReceiverPerson,
} from "../../../lib/connect/provisioning";
import {
  allCarePlandFocusValue,
  readCarePlandFocusId,
  writeCarePlandFocusId,
} from "../../../lib/platform/focus";
import {
  clearAllPageViewState,
  restorePageViewState,
  savePageViewState,
} from "../../../lib/navigation/pageViewState";
import {
  redirectToCarePlandSignIn,
  redirectToCarePlandSignInFromCurrentLocation,
} from "../../../lib/platform/authRedirect";

type ConnectMessage = {
  audioArtifactId?: string;
  audioDurationMs?: number;
  audioMimeType?: string;
  audioUrl?: string;
  id?: string;
  body?: string;
  createdAt?: string;
  from?: string;
  heardAt?: string;
  mainConnectUserPersonId?: string;
  messageType?: string;
  readAt?: string;
  receiverId?: string;
  to?: string;
  transcript?: string;
  transcriptStatus?: string;
};

type ConnectCallSummary = {
  active?: number;
  byState?: Record<string, number>;
  latestCall?: {
    callId?: string;
    callerName?: string;
    recipientName?: string;
    state?: string;
    summaryStatus?: string;
    summaryText?: string;
    transcriptStatus?: string;
    transcriptText?: string;
    updatedAt?: string;
  } | null;
  total?: number;
};

type ConnectAudioProfile = {
  events?: Array<Record<string, unknown>>;
  summary?: {
    sourceSummaries?: Array<{ count?: number; label?: string; source?: string }>;
    total?: number;
  };
};

type DashboardState = {
  audioProfile: ConnectAudioProfile | null;
  callSummary: ConnectCallSummary | null;
  connectContext: ConnectMainUserContext | null;
  focusPeople: ConnectPersPerson[];
  messages: ConnectMessage[];
  provisioning: ConnectProvisioningSnapshot | null;
  receiversOnline: number | null;
};

type DashboardView = "connect" | "receiver" | "settings";
type SetupView = "people" | "guide" | "receivers" | "appearance";
type ConnectPageViewState = {
  activeView?: DashboardView;
  scrollY?: number;
  setupView?: SetupView;
};
type RecipientCallState = "waiting" | "ringing" | "connected" | "ended" | "declined";
type ConnectAskMessage = {
  body: string;
  role: "assistant" | "user";
};

const dashboardAudioPack = {
  ringback: "/connect/receiver/audio/in-call-ring.wav",
  sit: "/connect/receiver/audio/sit.wav",
  unavailable: "/connect/receiver/audio/number-not-available.mp3",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type PendingMessageRecording = {
  artifactId?: string;
  audioUrl?: string;
  clientAudioCaptureId: string;
  recording: ConnectAudioRecording;
  transcript: string;
  transcriptStatus: string;
};

type ReceiverSetupLink = {
  expiresAt?: string;
  setupCode?: string;
  setupUrl: string;
};

type ReceiverGuideRect = {
  height: number;
  label: string;
  width: number;
  x: number;
  y: number;
};

const receiverGuideTargetStorageKey = "carepland-connect-guide-target";
const receiverGuideRectStorageKey = "carepland-connect-guide-rect";
const receiverLastPressStorageKey = "carepland-connect-last-press";
const connectMessagesEndpoint = "/api/connect/messages";
const connectAvatarsEndpoint = "/api/connect/avatars";
const connectCallsEndpoint = "/api/connect/calls";
const connectCallsSummaryEndpoint = "/api/connect/calls/summary";
const connectAudioProfileEndpoint = "/api/connect/audio/profile";
const receiverHealthyHeartbeatMs = 2 * 60 * 1000;
const receiverStaleHeartbeatMs = 5 * 60 * 1000;

function connectMessageStateEndpoint(messageId: string) {
  return `${connectMessagesEndpoint}/${encodeURIComponent(messageId)}/state`;
}

const emptyDashboardState: DashboardState = {
  audioProfile: null,
  callSummary: null,
  connectContext: null,
  focusPeople: [],
  messages: [],
  provisioning: null,
  receiversOnline: null,
};

function setupViewLabel(view: SetupView) {
  if (view === "people") return "People";
  if (view === "guide") return "Guide";
  if (view === "receivers") return "Receiver";
  return "Appearance";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || `Connect service returned ${response.status}`);
  }

  return body;
}

function formatDateTime(value?: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatClockTime(value?: string) {
  if (!value) return "time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "time unavailable";

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusLabel(value?: string) {
  return value ? value.replaceAll("_", " ") : "unknown";
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

function countOnlineProvisionedReceivers(provisioning: ConnectProvisioningSnapshot | null) {
  const devices = provisioning?.receiverDevices;

  if (!devices) return null;

  return devices.filter((device) => {
    if (device.presence?.online === true) return true;
    return device.presence?.state === "online";
  }).length;
}

function receiverKey(device: ConnectReceiverDevice) {
  return device.id ?? device.receiverId ?? device.name ?? connectPrototypeReceiverId;
}

function personName(person?: ConnectReceiverPerson) {
  return person?.displayName || "Main Connect User";
}

function firstNameLabel(value?: string | null) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  const firstToken = normalizedValue.split(/\s+/)[0] || "";
  const emailLocalPart = firstToken.includes("@")
    ? firstToken.split("@")[0]
    : firstToken;
  const firstNameishPart = emailLocalPart.split(/[._-]/)[0] || emailLocalPart;

  return firstNameishPart
    ? firstNameishPart[0].toUpperCase() + firstNameishPart.slice(1)
    : "";
}

function personAvatarProps(person?: ConnectAvatarPerson | null) {
  return {
    avatarAltText: person?.avatarAltText ?? undefined,
    avatarEmoji: person?.avatarEmoji ?? undefined,
    avatarType: person?.avatarType ?? undefined,
    avatarUrl: person?.avatarUrl ?? undefined,
    displayName: person?.displayName ?? undefined,
  };
}

function focusPersonAsReceiverPerson(
  person?: ConnectPersPerson | null
): ConnectReceiverPerson | undefined {
  if (!person?.id) {
    return undefined;
  }

  return {
    active: person.isActive !== false,
    avatarAltText: person.avatarAltText,
    avatarType: person.avatarType,
    avatarUrl: person.avatarUrl,
    careCircleId: person.careCircleId,
    displayName: person.displayName,
    id: person.id,
    linkedCareVipId: person.id,
    linkedPlatformPersonId: person.id,
    source: "carepland_pers",
    status: person.isDefault ? "main_care_vip" : "care_vip",
  };
}

function connectAudioUrl(audioUrl?: string) {
  if (!audioUrl) return "";
  if (/^https?:\/\//i.test(audioUrl)) return audioUrl;
  if (audioUrl.startsWith("/api/")) return audioUrl;
  return connectPrototypeEndpoints.audioArtifactMedia(audioUrl);
}

function playDashboardAudio(url: string, options: { loop?: boolean; onEnded?: () => void } = {}) {
  if (typeof window === "undefined") return false;
  const audio = new Audio(url);
  audio.loop = Boolean(options.loop);
  audio.volume = 0.75;
  if (options.onEnded) audio.addEventListener("ended", options.onEnded, { once: true });
  void audio.play().catch(() => undefined);
  return audio;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ask is unavailable right now.";
}

function compactMessageBody(message: ConnectMessage) {
  return String(message.transcript || message.body || "No message body").slice(0, 240);
}

function buildConnectAskContext({
  activeDevices,
  activeView,
  guideMode,
  households,
  receiverPeople,
  recipientCallState,
  selectedPerson,
  selectedReceiver,
  selectedReceiverId,
  selectedReceiverLabel,
  setupView,
  state,
}: {
  activeDevices: ConnectReceiverDevice[];
  activeView: DashboardView;
  guideMode: boolean;
  households: ConnectReceiverHousehold[];
  receiverPeople: ConnectReceiverPerson[];
  recipientCallState: RecipientCallState;
  selectedPerson?: ConnectReceiverPerson;
  selectedReceiver?: ConnectReceiverDevice;
  selectedReceiverId: string;
  selectedReceiverLabel: string;
  setupView: SetupView;
  state: DashboardState;
}) {
  const latestCall = state.callSummary?.latestCall ?? null;

  return {
    module: "connect",
    current_surface: activeView,
    setup_section: activeView === "settings" ? setupView : null,
    selected_person: selectedPerson
      ? {
          id: selectedPerson.id ?? null,
          name: personName(selectedPerson),
          status: statusLabel(selectedPerson.status),
        }
      : null,
    receiver_people: receiverPeople.slice(0, 4).map((person) => ({
      id: person.id ?? null,
      name: personName(person),
      status: statusLabel(person.status),
    })),
    selected_receiver: {
      id: selectedReceiverId,
      key: selectedReceiver ? receiverKey(selectedReceiver) : selectedReceiverId,
      label: selectedReceiverLabel,
      location: selectedReceiver?.locationLabel ?? null,
      status: statusLabel(selectedReceiver?.status),
    },
    receiver_status: {
      active_device_count: activeDevices.length,
      online_count: state.receiversOnline,
      recipient_call_state: recipientCallState,
    },
    recent_call: latestCall
      ? {
          caller: latestCall.callerName ?? null,
          recipient: latestCall.recipientName ?? null,
          state: statusLabel(latestCall.state),
          updated_at: latestCall.updatedAt ?? null,
        }
      : null,
    recent_messages: state.messages.slice(0, 5).map((message) => ({
      body: compactMessageBody(message),
      created_at: message.createdAt ?? null,
      from: message.from ?? null,
      heard_at: message.heardAt ?? null,
      read_at: message.readAt ?? null,
      receiver_id: message.receiverId ?? null,
      to: message.to ?? null,
      transcript_status: statusLabel(message.transcriptStatus || "not_requested"),
      type: statusLabel(message.messageType || "text"),
    })),
    guide_mode: {
      active: guideMode,
      purpose:
        "Coordinator points at the real receiver UI; the receiver sees the same highlight and remains in control.",
    },
    provisioning: {
      household_count: households.length,
      receiver_people_count: receiverPeople.length,
      setup_pending_count:
        state.provisioning?.receiverDevices?.filter(
          (device) => device.status === "setup_pending"
        ).length ?? null,
    },
    trust_boundary:
      "No hidden listening. No recording by default. Every request is named, authorized, and logged.",
  };
}

export function ConnectDashboard() {
  const [initialConnectPageViewState] = useState<ConnectPageViewState | null>(() => {
    const restoredState = restorePageViewState<ConnectPageViewState>("connect");

    return restoredState?.engaged ? restoredState : null;
  });
  const restoredConnectScrollRef = useRef(false);
  const [state, setState] = useState<DashboardState>(emptyDashboardState);
  const [status, setStatus] = useState("Loading Connect state...");
  const [loading, setLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [actionPending, setActionPending] = useState<"call" | "message" | null>(null);
  const [connectTool, setConnectTool] = useState<"message" | "history">("message");
  const [activeView, setActiveView] = useState<DashboardView>(
    initialConnectPageViewState?.activeView ?? "connect"
  );
  const [setupView, setSetupView] = useState<SetupView>(
    initialConnectPageViewState?.setupView ?? "people"
  );
  const [globalFocusId, setGlobalFocusId] = useState(() => {
    if (typeof window === "undefined") {
      return allCarePlandFocusValue;
    }

    return readCarePlandFocusId(window.localStorage);
  });
  const [connectTargetPersonId, setConnectTargetPersonId] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedReceiverKey, setSelectedReceiverKey] = useState(connectPrototypeReceiverId);
  const [messageIndex, setMessageIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [processingRecording, setProcessingRecording] = useState(false);
  const [pendingRecording, setPendingRecording] =
    useState<PendingMessageRecording | null>(null);
  const [detailView, setDetailView] = useState(true);
  const [recipientCallState, setRecipientCallState] =
    useState<RecipientCallState>("waiting");
  const [callAudioStatus, setCallAudioStatus] =
    useState<ConnectCallAudioStatus>("idle");
  const [callMuted, setCallMuted] = useState(false);
  const [callTranscriptRuntimeStatus, setCallTranscriptRuntimeStatus] = useState("");
  const savedMainConnectUserPersonId =
    state.connectContext?.mainConnectUserPersonId ?? "";
  const [guideMode, setGuideMode] = useState(false);
  const [connectAskOpen, setConnectAskOpen] = useState(false);
  const [connectAskInput, setConnectAskInput] = useState("");
  const [connectAskMessages, setConnectAskMessages] = useState<ConnectAskMessage[]>([]);
  const [connectAskThreadId, setConnectAskThreadId] = useState<string | null>(null);
  const [connectAskSending, setConnectAskSending] = useState(false);
  const [connectAskError, setConnectAskError] = useState("");
  const recordingControllerRef = useRef<ConnectAudioRecordingController | null>(null);
  const activeCaptureIdRef = useRef("");
  const clientMessageCounterRef = useRef(0);
  const callCueRef = useRef<HTMLAudioElement | null>(null);
  const callTimeoutRef = useRef<number | null>(null);
  const liveCallAudioRef = useRef<ConnectCallAudioController | null>(null);
  const activeCallIdRef = useRef("");
  const callAudioStatusRef = useRef<ConnectCallAudioStatus>("idle");
  const mainConnectUserPersonIdRef = useRef("");
  const latestCallAudioStateRef = useRef("");
  callAudioStatusRef.current = callAudioStatus;
  mainConnectUserPersonIdRef.current = savedMainConnectUserPersonId;

  const saveConnectViewState = useCallback((overrides: Partial<ConnectPageViewState> = {}) => {
    savePageViewState<ConnectPageViewState>("connect", {
      activeView,
      scrollY: typeof window === "undefined" ? 0 : window.scrollY,
      setupView,
      ...overrides,
      engaged: true,
    });
  }, [activeView, setupView]);

  const stopCallCue = useCallback(() => {
    if (callTimeoutRef.current) {
      window.clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    callCueRef.current?.pause();
    callCueRef.current = null;
  }, []);

  const stopLiveCallAudio = useCallback(() => {
    if (activeCallIdRef.current && mainConnectUserPersonIdRef.current) {
      recordConnectCallLifecycleEvent({
        actorRole: "dashboard",
        callId: activeCallIdRef.current,
        connectAuthHeaders,
        details: {
          callAudioStatus: callAudioStatusRef.current,
          source: "dashboard_stop_live_call_audio",
        },
        eventType: "call_ui_audio_cleanup_requested",
        mainConnectUserPersonId: mainConnectUserPersonIdRef.current,
      });
    }
    liveCallAudioRef.current?.stop();
    liveCallAudioRef.current = null;
    setCallAudioStatus("idle");
    setCallMuted(false);
  }, []);

  const playCallFailureSound = useCallback(() => {
    if (latestCallAudioStateRef.current === "failed") return;
    latestCallAudioStateRef.current = "failed";
    stopCallCue();
    callCueRef.current =
      playDashboardAudio(dashboardAudioPack.sit, {
        onEnded: () => {
          playDashboardAudio(dashboardAudioPack.unavailable);
        },
      }) || null;
  }, [stopCallCue]);

  const playCallRingback = useCallback(() => {
    latestCallAudioStateRef.current = "ringing";
    stopCallCue();
    callCueRef.current = playDashboardAudio(dashboardAudioPack.ringback, { loop: true }) || null;
    callTimeoutRef.current = window.setTimeout(() => {
      const activeCallId = activeCallIdRef.current;
      if (["connected", "remote_audio"].includes(callAudioStatusRef.current)) {
        if (activeCallId) {
          logDashboardCallEvent(activeCallId, "call_dashboard_ring_timeout_suppressed", {
            callAudioStatus: callAudioStatusRef.current,
            source: "playCallRingback",
          });
        }
        stopCallCue();
        return;
      }
      if (activeCallId) {
        logDashboardCallEvent(activeCallId, "call_dashboard_ring_timeout_fired", {
          callAudioStatus: callAudioStatusRef.current,
          source: "playCallRingback",
        });
      }
      playCallFailureSound();
      setRecipientCallState("ended");
      setStatus("No approved receiver answered before timeout.");
    }, 15000);
  }, [playCallFailureSound, stopCallCue]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setStatus("Refreshing Connect dashboard...");
    try {
      const authHeaders = await connectAuthHeaders();
      const [
        contextResult,
        focusPeopleResult,
        provisioningResult,
      ] = await Promise.allSettled([
        fetchConnectMainUserContext(),
        fetchConnectFocusPeople(),
        fetchConnectProvisioningSnapshot({
          includeInactiveHouseholds: true,
        }),
      ]);
      const connectContext = settledValue(contextResult);
      const focusPeople = (settledValue(focusPeopleResult) ?? []).filter(
        (person) => !isConnectPetSubjectType(person.subjectType)
      );
      const provisioning = settledValue(provisioningResult);
      const focusedPersonId = resolveActiveConnectPersonId({
        connectTargetPersonId,
        fallbackPersonId: focusPeople[0]?.id,
        globalFocusId,
        savedMainConnectUserPersonId:
          connectContext?.mainConnectUserPersonId ?? savedMainConnectUserPersonId,
      });
      const scopedParticipantId = (connectContext?.people ?? []).some(
        (person) => person.id === focusedPersonId
      )
        ? focusedPersonId
        : "";
      const [messagesResult, callSummaryResult, audioProfileResult] =
        await Promise.allSettled([
          scopedParticipantId
          ? fetchJson<{ messages?: ConnectMessage[] }>(
              `${connectMessagesEndpoint}?personId=${encodeURIComponent(scopedParticipantId)}`,
              { headers: authHeaders }
            )
          : Promise.resolve({ messages: [] }),
          scopedParticipantId
          ? fetchJson<{ summary?: ConnectCallSummary }>(
              `${connectCallsSummaryEndpoint}?personId=${encodeURIComponent(scopedParticipantId)}`,
              { headers: authHeaders }
            )
          : Promise.resolve({ summary: null }),
          scopedParticipantId
          ? fetchJson<{ profile?: ConnectAudioProfile }>(
              `${connectAudioProfileEndpoint}?personId=${encodeURIComponent(scopedParticipantId)}`,
              { headers: authHeaders }
            )
          : Promise.resolve({ profile: null }),
        ]);
      const messagesBody = settledValue(messagesResult);
      const callSummaryBody = settledValue(callSummaryResult);
      const audioProfileBody = settledValue(audioProfileResult);
      const failedCount = [
        contextResult,
        focusPeopleResult,
        provisioningResult,
        messagesResult,
        callSummaryResult,
        audioProfileResult,
      ].filter((result) => result.status === "rejected").length;

      setState({
        audioProfile: audioProfileBody?.profile ?? null,
        callSummary: callSummaryBody?.summary ?? null,
        connectContext,
        focusPeople,
        messages: messagesBody?.messages ?? [],
        provisioning: provisioning ?? null,
        receiversOnline: countOnlineProvisionedReceivers(provisioning),
      });
      setStatus(
        contextResult.status === "rejected"
          ? "Sign in to CarePland Personal to load your Connect people."
          : failedCount
          ? "Ready. Some Connect data is still loading."
          : "Ready."
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `${error.message}. Start the Connect local server to use this dashboard.`
          : "Connect state is unavailable."
      );
    } finally {
      setLoading(false);
    }
  }, [connectTargetPersonId, globalFocusId, savedMainConnectUserPersonId]);

  const refreshCallState = useCallback(async () => {
    try {
      const focusedPersonId = resolveActiveConnectPersonId({
        connectTargetPersonId,
        globalFocusId,
        savedMainConnectUserPersonId,
      });
      if (!focusedPersonId) return;
      const callSummaryBody = await fetchJson<{ summary?: ConnectCallSummary }>(
        `${connectCallsSummaryEndpoint}?personId=${encodeURIComponent(focusedPersonId)}`,
        { headers: await connectAuthHeaders() }
      );
      const latestState = callSummaryBody.summary?.latestCall?.state || "";
      const latestCallId = callSummaryBody.summary?.latestCall?.callId || "";

      setState((current) => ({
        ...current,
        callSummary: callSummaryBody.summary ?? current.callSummary,
      }));

      if (latestCallId && ["answered", "connected", "ringing"].includes(latestState)) {
        activeCallIdRef.current = latestCallId;
      }

      if (latestState === "ringing") setRecipientCallState("ringing");
      if (latestState === "answered" || latestState === "connected") {
        latestCallAudioStateRef.current = latestState;
        stopCallCue();
        setRecipientCallState("connected");
      }
      if (latestState === "declined" || latestState === "receiver_unavailable") {
        if (latestCallId) {
          logDashboardCallEvent(latestCallId, "call_dashboard_poll_terminal_state_seen", {
            latestState,
            source: "refreshCallState",
          });
        }
        stopLiveCallAudio();
        if (latestState === "receiver_unavailable") playCallFailureSound();
        else {
          latestCallAudioStateRef.current = latestState;
          stopCallCue();
        }
        activeCallIdRef.current = "";
        setRecipientCallState("declined");
      }
      if (latestState === "hung_up" || latestState === "missed" || latestState === "failed") {
        if (latestCallId) {
          logDashboardCallEvent(latestCallId, "call_dashboard_poll_terminal_state_seen", {
            latestState,
            source: "refreshCallState",
          });
        }
        stopLiveCallAudio();
        if (latestState === "missed" || latestState === "failed") playCallFailureSound();
        else {
          latestCallAudioStateRef.current = latestState;
          stopCallCue();
        }
        activeCallIdRef.current = "";
        setRecipientCallState("ended");
      }
    } catch {
      // Call polling is best-effort; the full dashboard refresh reports service issues.
    }
  }, [
    connectTargetPersonId,
    globalFocusId,
    playCallFailureSound,
    savedMainConnectUserPersonId,
    stopCallCue,
    stopLiveCallAudio,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const latestCall = state.callSummary?.latestCall;
    const latestCallState = String(latestCall?.state || "");
    const callNeedsSummaryRefresh =
      recipientCallState === "ended" &&
      ["declined", "failed", "hung_up", "missed", "receiver_unavailable"].includes(
        latestCallState
      ) &&
      !String(latestCall?.summaryText || "").trim() &&
      String(latestCall?.transcriptStatus || "") !== "deleted";

    if (!callNeedsSummaryRefresh) return undefined;

    let attempts = 0;
    const refreshTimer = window.setInterval(() => {
      attempts += 1;
      void refreshCallState();
      if (attempts >= 4) {
        window.clearInterval(refreshTimer);
      }
    }, 2500);

    return () => window.clearInterval(refreshTimer);
  }, [
    recipientCallState,
    refreshCallState,
    state.callSummary?.latestCall?.callId,
    state.callSummary?.latestCall?.state,
    state.callSummary?.latestCall?.summaryText,
    state.callSummary?.latestCall?.transcriptStatus,
  ]);

  useEffect(() => {
    function syncGlobalFocus(event?: StorageEvent) {
      if (event && event.key !== "carepland-ui-state:v1") {
        return;
      }

      setGlobalFocusId(readCarePlandFocusId(window.localStorage));
    }

    window.addEventListener("storage", syncGlobalFocus);

    return () => window.removeEventListener("storage", syncGlobalFocus);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) {
        return;
      }

      const user = data.user;

      if (!user?.id) {
        setAccountEmail("");
        setIsAdmin(false);
        redirectToCarePlandSignInFromCurrentLocation();
        return;
      }

      setAccountEmail(user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setIsAdmin(profile?.is_admin === true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_OUT" && event !== "TOKEN_REFRESHED") return;
      if (session?.user?.id) return;
      setAccountEmail("");
      setIsAdmin(false);
      redirectToCarePlandSignInFromCurrentLocation();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      stopCallCue();
      stopLiveCallAudio();
    };
  }, [stopCallCue, stopLiveCallAudio]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      restoredConnectScrollRef.current ||
      !initialConnectPageViewState?.scrollY
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: initialConnectPageViewState.scrollY });
      restoredConnectScrollRef.current = true;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialConnectPageViewState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let frameId = 0;

    const saveScrollPosition = () => {
      const restoredState = restorePageViewState<ConnectPageViewState>("connect");

      if (!restoredState?.engaged) {
        return;
      }

      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        saveConnectViewState({ scrollY: window.scrollY });
      });
    };

    window.addEventListener("scroll", saveScrollPosition, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", saveScrollPosition);
    };
  }, [activeView, saveConnectViewState, setupView]);

  useEffect(() => {
    return () => setConnectTargetPersonId("");
  }, []);

  useEffect(() => {
    if (activeView !== "connect") return undefined;

    const timer = window.setInterval(() => {
      void refreshCallState();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [activeView, refreshCallState]);

  useEffect(() => {
    return () => {
      recordingControllerRef.current?.cancel();
      if (pendingRecording?.recording.localUrl) {
        URL.revokeObjectURL(pendingRecording.recording.localUrl);
      }
    };
  }, [pendingRecording]);

  const activeDevices = useMemo(
    () =>
      state.provisioning?.receiverDevices?.filter(
        (device) => device.status !== "revoked"
      ) ?? [],
    [state.provisioning?.receiverDevices]
  );

  const households = useMemo(
    () => state.provisioning?.receiverHouseholds ?? [],
    [state.provisioning?.receiverHouseholds]
  );

  const receiverPeople = useMemo(() => {
    return (state.connectContext?.people ?? []).map((person) => ({
      active: person.isActive !== false,
      avatarAltText: person.avatarAltText,
      avatarType: person.avatarType,
      avatarUrl: person.avatarUrl,
      careCircleId: person.careCircleId,
      displayName: person.displayName,
      id: person.id,
      linkedCareVipId: person.id,
      linkedPlatformPersonId: person.id,
      source: "carepland_pers",
      status: person.isDefault ? "main_care_vip" : "care_vip",
    }));
  }, [state.connectContext?.people]);
  const focusOptions = useMemo(
    () => [
      {
        id: allCarePlandFocusValue,
        label: "Everyone",
        type: "everyone" as const,
      },
      ...state.focusPeople.map((person) => ({
        avatar: personAvatarProps(person),
        id: person.id,
        label: person.displayName,
        type: "person" as const,
      })),
    ],
    [state.focusPeople]
  );
  const activeConnectPersonId = resolveActiveConnectPersonId({
    connectTargetPersonId,
    fallbackPersonId: state.focusPeople[0]?.id,
    globalFocusId,
    savedMainConnectUserPersonId,
  });
  const isEveryoneFocus = globalFocusId === allCarePlandFocusValue;

  const selectedReceiver =
    activeDevices.find((device) => receiverKey(device) === selectedReceiverKey) ??
    activeDevices[0];

  const selectedReceiverLabel =
    selectedReceiver?.name || selectedReceiver?.receiverId || "Kitchen Receiver";
  const selectedReceiverId = selectedReceiver?.receiverId || connectPrototypeReceiverId;
  const focusedPersPerson = activeConnectPersonId
    ? state.focusPeople.find((person) => person.id === activeConnectPersonId) ??
      state.connectContext?.people.find((person) => person.id === activeConnectPersonId)
    : state.focusPeople[0];
  const connectEnabledPerson = activeConnectPersonId
    ? receiverPeople.find((person) => person.id === activeConnectPersonId)
    : undefined;
  const selectedPerson =
    connectEnabledPerson ?? focusPersonAsReceiverPerson(focusedPersPerson);
  const selectedMainConnectUserPersonId = connectEnabledPerson?.id ?? "";
  const selectedPersonName = selectedPerson
    ? personName(selectedPerson)
    : accountEmail
      ? firstNameLabel(accountEmail) || accountEmail
      : "Connect User";
  const selectedPersonFirstName =
    firstNameLabel(selectedPersonName) || selectedPersonName;
  const safeMessageIndex = Math.min(messageIndex, Math.max(0, state.messages.length - 1));
  const messagePageStart = Math.min(safeMessageIndex, Math.max(0, state.messages.length - 2));
  const visibleMessages = state.messages.slice(messagePageStart, messagePageStart + 2);
  const canPagePreviousMessages = messagePageStart > 0;
  const canPageNextMessages = messagePageStart + 2 < state.messages.length;
  const connectAskContext = buildConnectAskContext({
    activeDevices,
    activeView,
    guideMode,
    households,
    receiverPeople,
    recipientCallState,
    selectedPerson,
    selectedReceiver,
    selectedReceiverId,
    selectedReceiverLabel,
    setupView,
    state,
  });

  function handleChangeGlobalFocus(focusId: string) {
    const nextFocusId = focusId || allCarePlandFocusValue;

    setGlobalFocusId(nextFocusId);
    setConnectTargetPersonId("");

    if (typeof window !== "undefined") {
      writeCarePlandFocusId(window.localStorage, nextFocusId);
    }

    setMessageIndex(0);
    setStatus(
      nextFocusId === allCarePlandFocusValue
        ? "Showing Connect for everyone."
        : `Showing Connect for ${
            firstNameLabel(
              state.focusPeople.find((person) => person.id === nextFocusId)
                ?.displayName
            ) || "this person"
          }.`
    );
  }

  function handleChooseConnectTarget(person: ConnectPersPerson) {
    if (!person.id || isConnectPetSubjectType(person.subjectType)) {
      return;
    }

    setConnectTargetPersonId(person.id);
    setMessageIndex(0);
    setStatus(
      `Ready for ${firstNameLabel(person.displayName) || person.displayName}.`
    );
  }

  function openProfileSettings() {
    window.location.assign("/?personal=1&profile=1");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    clearAllPageViewState();
    redirectToCarePlandSignIn();
  }

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== receiverLastPressStorageKey || !event.newValue) return;

      let parsed: { label?: string; target?: string };
      try {
        parsed = JSON.parse(event.newValue) as { target?: string };
      } catch {
        parsed = {};
      }
      const targetLabel =
        "label" in parsed && typeof parsed.label === "string"
          ? parsed.label
          : parsed.target === "primary"
            ? "Contact Andrew"
            : parsed.target === "ask"
              ? "Ask a question"
              : parsed.target === "contact"
                ? "People"
                : "a receiver control";
      setStatus(`${selectedPersonName} pressed ${targetLabel}.`);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [selectedPersonName]);

  function logDashboardCallEvent(
    callId: string,
    eventType: string,
    details: Record<string, unknown> = {}
  ) {
    if (!callId || !selectedMainConnectUserPersonId) return;
    recordConnectCallLifecycleEvent({
      actorRole: "dashboard",
      callId,
      connectAuthHeaders,
      details,
      eventType,
      mainConnectUserPersonId: selectedMainConnectUserPersonId,
    });
  }

  function startDashboardCallAudio(callId: string) {
    if (!selectedMainConnectUserPersonId) {
      setStatus(`${selectedPersonName} is not enabled for Connect calls yet.`);
      return;
    }

    logDashboardCallEvent(callId, "call_dashboard_audio_start_requested", {
      callMuted,
      source: "startDashboardCallAudio",
    });
    stopLiveCallAudio();
    activeCallIdRef.current = callId;
    const controller = createConnectCallAudioController({
      callId,
      connectAuthHeaders,
      mainConnectUserPersonId: selectedMainConnectUserPersonId,
      onConnected: () => {
        stopCallCue();
        setStatus(`Connected with ${selectedPersonName}.`);
      },
      onError: (message) => setStatus(message),
      onPeerEnded: () => {
        logDashboardCallEvent(callId, "call_dashboard_peer_ended_received", {
          source: "audio_controller_onPeerEnded",
        });
        setStatus(`${selectedPersonName} ended the call.`);
        setRecipientCallState("ended");
        stopCallCue();
        liveCallAudioRef.current = null;
        void reportDashboardCallState("hung_up");
      },
      onRemoteMutedChange: (muted) => {
        setStatus(
          muted
            ? `${selectedPersonName}'s microphone is muted.`
            : `${selectedPersonName}'s microphone is on.`
        );
      },
      onTranscriptChunk: (chunkStatus, detail) => {
        if (chunkStatus === "started") {
          setCallTranscriptRuntimeStatus("capture_started");
          setStatus("Connected. Preparing call notes in the background.");
        }
        if (chunkStatus === "completed") {
          setCallTranscriptRuntimeStatus(detail ? `chunk_uploaded:${detail}` : "chunk_uploaded");
        }
        if (chunkStatus === "not_configured") {
          setCallTranscriptRuntimeStatus("not_configured");
        }
        if (chunkStatus === "failed") {
          setCallTranscriptRuntimeStatus(
            detail ? `chunk_failed:${detail}` : "chunk_failed"
          );
          setStatus("Call is live. A transcript chunk could not be saved.");
        }
      },
      onStatusChange: (nextStatus) => {
        if (nextStatus === "connected" || nextStatus === "remote_audio") {
          stopCallCue();
        }
        setCallAudioStatus(nextStatus);
      },
      role: "dashboard",
      transcriptChunks: true,
    });
    controller.setMuted(callMuted);
    liveCallAudioRef.current = controller;
    void controller.start();
  }

  async function startCall() {
    if (!selectedMainConnectUserPersonId) {
      setStatus(`${selectedPersonName} is not enabled for Connect calls yet.`);
      return;
    }

    setActionPending("call");
    setStatus(`Calling ${selectedPersonName}...`);
    setRecipientCallState("ringing");
    setCallTranscriptRuntimeStatus("");
    playCallRingback();
    try {
      const callResponse = await fetchJson<{
        call?: { callId?: string };
        ok?: boolean;
      }>(connectCallsEndpoint, {
        body: JSON.stringify({
          callerName: "Andrew",
          mainConnectUserPersonId: selectedMainConnectUserPersonId,
          receiverId: selectedReceiverId,
          recipientPersonId: selectedMainConnectUserPersonId,
          recipientName: selectedPersonName,
        }),
        headers: {
          ...(await connectAuthHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      } as RequestInit);
      if (callResponse.call?.callId) {
        logDashboardCallEvent(callResponse.call.callId, "call_dashboard_call_created", {
          source: "startCall",
        });
        startDashboardCallAudio(callResponse.call.callId);
      }
      setStatus(`Call sent to ${selectedPersonName}.`);
      await refresh();
    } catch (error) {
      stopLiveCallAudio();
      playCallFailureSound();
      setRecipientCallState("waiting");
      setCallTranscriptRuntimeStatus("");
      setStatus(error instanceof Error ? error.message : "Unable to start call.");
    } finally {
      setActionPending(null);
    }
  }

  function restartDashboardCallAudio() {
    const callId = activeCallIdRef.current || state.callSummary?.latestCall?.callId;
    if (!callId) {
      setStatus("No active call was found to restart.");
      return;
    }
    setCallTranscriptRuntimeStatus("");
    setStatus("Restarting call audio.");
    logDashboardCallEvent(callId, "call_dashboard_audio_restart_requested", {
      callAudioStatus,
      source: "restartDashboardCallAudio",
    });
    startDashboardCallAudio(callId);
  }

  async function reportDashboardCallState(
    stateValue: string,
    options: { callId?: string; refreshAfter?: boolean; source?: string } = {}
  ) {
    const callId = options.callId || activeCallIdRef.current || state.callSummary?.latestCall?.callId;
    if (!callId || !selectedMainConnectUserPersonId) return;

    try {
      logDashboardCallEvent(callId, "call_dashboard_state_update_requested", {
        source: options.source || "reportDashboardCallState",
        state: stateValue,
      });
      await fetchJson<{ ok?: boolean }>(
        `${connectCallsEndpoint}/${encodeURIComponent(callId)}/state`,
        {
          body: JSON.stringify({
            mainConnectUserPersonId: selectedMainConnectUserPersonId,
            source: "dashboard",
            state: stateValue,
          }),
          headers: {
            ...(await connectAuthHeaders()),
            "Content-Type": "application/json",
          },
          method: "POST",
        } as RequestInit
      );
      if (options.refreshAfter !== false) {
        await refreshCallState();
      }
      if (
        ["declined", "failed", "hung_up", "missed", "receiver_unavailable"].includes(
          stateValue
        )
      ) {
        stopLiveCallAudio();
        activeCallIdRef.current = "";
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update call.");
    }
  }

  async function endDashboardCall() {
    const callId = activeCallIdRef.current || state.callSummary?.latestCall?.callId;
    if (!callId) {
      stopCallCue();
      stopLiveCallAudio();
      setRecipientCallState("ended");
      setStatus("Call ended.");
      return;
    }

    logDashboardCallEvent(callId, "call_dashboard_hangup_clicked", {
      callAudioStatus,
      source: "endDashboardCall",
    });
    stopCallCue();
    setRecipientCallState("ended");
    setStatus("Ending call.");
    stopLiveCallAudio();

    await reportDashboardCallState("hung_up", {
      callId,
      refreshAfter: false,
      source: "endDashboardCall",
    });
    activeCallIdRef.current = "";
    await refreshCallState();
    setStatus("Call ended.");
  }

  function toggleCallMuted() {
    const nextMuted = !callMuted;
    setCallMuted(nextMuted);
    liveCallAudioRef.current?.setMuted(nextMuted);
    setStatus(nextMuted ? "Your microphone is muted." : "Your microphone is on.");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = messageText.trim();
    if (!body && !pendingRecording) return;
    if (!selectedMainConnectUserPersonId) {
      setStatus(`${selectedPersonName} is not enabled for Connect messages yet.`);
      return;
    }

    setActionPending("message");
    setStatus(
      pendingRecording
        ? `Sending audio message to ${selectedPersonName}...`
        : `Sending message to ${selectedPersonName}...`
    );
    try {
      clientMessageCounterRef.current += 1;
      const clientMessageSequence = clientMessageCounterRef.current;
      const clientMessageId = pendingRecording
        ? `coordinator-audio-${clientMessageSequence}`
        : `coordinator-text-${clientMessageSequence}`;
      const messagePayload = pendingRecording
        ? {
            artifactKind: "coordinator_message",
            audioArtifactId: pendingRecording.artifactId,
            audioBase64: await blobToBase64(pendingRecording.recording.blob),
            audioDirection: "coordinator_to_receiver",
            audioDurationMs: pendingRecording.recording.durationMs,
            audioMimeType: pendingRecording.recording.mimeType,
            audioUrl: pendingRecording.audioUrl,
            body: body || pendingRecording.transcript || "Voice message",
            captureContext: createConnectAudioCaptureContext(
              pendingRecording.recording,
              {
                artifactKind: "coordinator_message",
                audioDirection: "coordinator_to_receiver",
                clientAudioCaptureId: pendingRecording.clientAudioCaptureId,
                role: "Andrew",
                surface: "coordinator_message_composer",
              }
            ),
            clientAudioCaptureId: pendingRecording.clientAudioCaptureId,
            clientMessageId,
            from: "Andrew",
            mainConnectUserPersonId: selectedMainConnectUserPersonId,
            messageType: "audio",
            receiverId: selectedReceiverId,
            source: "coordinator_audio_message",
            to: selectedPersonName,
          }
        : {
            body,
            clientMessageId,
            from: "Andrew",
            mainConnectUserPersonId: selectedMainConnectUserPersonId,
            messageType: "text",
            receiverId: selectedReceiverId,
            source: "coordinator_text_message",
            to: selectedPersonName,
          };
      await fetchJson<{ ok?: boolean; message?: ConnectMessage }>(
        connectMessagesEndpoint,
        {
          body: JSON.stringify(messagePayload),
          headers: {
            ...(await connectAuthHeaders()),
            "Content-Type": "application/json",
          },
          method: "POST",
        } as RequestInit
      );
      setMessageText("");
      setPendingRecording(null);
      setMessageIndex(0);
      setStatus(
        pendingRecording
          ? "Audio message sent with original recording preserved."
          : `Message sent to ${selectedPersonName}.`
      );
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setActionPending(null);
    }
  }

  async function markMessageHeard(message: ConnectMessage) {
    if (!message.id || message.heardAt) return;
    if (!selectedMainConnectUserPersonId) return;
    const heardAt = new Date().toISOString();

    setState((current) => ({
      ...current,
      messages: current.messages.map((item) =>
        item.id === message.id ? { ...item, heardAt } : item
      ),
    }));

    try {
      await fetch(connectMessageStateEndpoint(message.id), {
        body: JSON.stringify({
          heard: true,
          mainConnectUserPersonId: selectedMainConnectUserPersonId,
          receiverId: selectedReceiverId,
        }),
        headers: {
          ...(await connectAuthHeaders()),
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
    } catch {
      // Playback should keep working if telemetry cannot be saved.
    }
  }

  async function toggleRecording() {
    if (recording) {
      await stopMessageRecording();
      return;
    }

    if (!browserConnectAudioRecordingAvailable()) {
      setStatus("Recording is not available in this browser.");
      return;
    }

    if (!selectedMainConnectUserPersonId) {
      setStatus(`${selectedPersonName} is not enabled for Connect audio yet.`);
      return;
    }

    try {
      const captureId = createConnectAudioCaptureId("coordinator-message-draft");
      activeCaptureIdRef.current = captureId;
      setPendingRecording(null);
      setProcessingRecording(false);
      setRecording(true);
      setMessageText("");
      setStatus("Recording. Press Stop when done.");
      recordingControllerRef.current = await startConnectAudioRecording({
        maxDurationMs: 30000,
        onAutoStop: (reason) => {
          void stopMessageRecording(reason);
        },
        silenceGraceMs: 1200,
        silenceThreshold: 0.018,
        stopAfterSilenceMs: 2600,
      });
    } catch {
      activeCaptureIdRef.current = "";
      recordingControllerRef.current = null;
      setRecording(false);
      setStatus("Recording could not start. Microphone permission may be blocked.");
    }
  }

  async function stopMessageRecording(reason?: "max_duration" | "silence") {
    const controller = recordingControllerRef.current;
    if (!controller) {
      setRecording(false);
      return;
    }

    recordingControllerRef.current = null;
    setRecording(false);
    setProcessingRecording(true);
    setStatus(
      reason === "max_duration"
        ? "Recording stopped at the time limit. Transcribing now..."
        : "Transcribing recording..."
    );

    try {
      const recordingResult = await controller.stop();
      if (!recordingResult.size) {
        setStatus("No audio captured. Try recording again.");
        return;
      }

      if (!selectedMainConnectUserPersonId) {
        setStatus(`${selectedPersonName} is not enabled for Connect audio yet.`);
        return;
      }

      let transcript = "";
      let transcriptStatus = "not_requested";
      let artifactId = "";
      let audioUrl = "";
      const clientAudioCaptureId =
        activeCaptureIdRef.current || createConnectAudioCaptureId("coordinator-message-draft");

      try {
        const transcription = await requestConnectAudioTranscription({
          artifactKind: "coordinator_message",
          audioDirection: "coordinator_to_receiver",
          captureContext: createConnectAudioCaptureContext(recordingResult, {
            artifactKind: "coordinator_message",
            audioDirection: "coordinator_to_receiver",
            clientAudioCaptureId,
            role: "Andrew",
            surface: "coordinator_message_composer",
          }),
          clientAudioCaptureId,
          durationMs: recordingResult.durationMs,
          mainConnectUserPersonId: selectedMainConnectUserPersonId,
          mimeType: recordingResult.mimeType,
          receiverId: selectedReceiverId,
          recording: recordingResult.blob,
          source: "coordinator_message_draft",
        });
        const artifact = transcription.artifact;
        artifactId = String(artifact?.artifactId || artifact?.id || "");
        transcript = String(transcription.transcript || "").trim();
        transcriptStatus = String(transcription.transcriptStatus || "not_requested");
        audioUrl = String(artifact?.audioUrl || transcription.audioUrl || "");
      } catch {
        transcriptStatus = "not_configured";
      }

      setPendingRecording({
        artifactId,
        audioUrl,
        clientAudioCaptureId,
        recording: recordingResult,
        transcript,
        transcriptStatus,
      });
      setMessageText(transcript || "Recorded voice message");
      setStatus(
        transcript
          ? "Recording transcribed. Original audio and transcript will be sent."
          : "Recording ready. Original audio will be sent."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recording could not be processed.");
    } finally {
      activeCaptureIdRef.current = "";
      setProcessingRecording(false);
    }
  }

  function clearComposer() {
    recordingControllerRef.current?.cancel();
    recordingControllerRef.current = null;
    setRecording(false);
    setProcessingRecording(false);
    setMessageText("");
    setPendingRecording(null);
    setStatus("Message cleared.");
  }

  function chooseGuidePreviewTarget(highlight: ReceiverGuideRect) {
    if (!guideMode) return;
    window.localStorage.removeItem(receiverGuideTargetStorageKey);
    window.localStorage.setItem(receiverGuideRectStorageKey, JSON.stringify(highlight));
    setStatus(`Pointing to ${highlight.label} on ${selectedReceiverLabel}.`);
  }

  async function submitConnectAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const outgoingMessage = connectAskInput.trim();
    if (!outgoingMessage || connectAskSending) return;

    setConnectAskSending(true);
    setConnectAskError("");
    setConnectAskInput("");
    setConnectAskMessages((messages) => [
      ...messages,
      { body: outgoingMessage, role: "user" },
    ]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before using Ask.");
      }

      const response = await fetch("/api/ask", {
        body: JSON.stringify({
          context: connectAskContext,
          currentPage:
            activeView === "settings"
              ? `Connect / Settings / ${setupView}`
              : activeView === "receiver"
                ? "Connect / Receiver"
                : "Connect Home",
          message: outgoingMessage,
          threadId: connectAskThreadId,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json().catch(() => ({}))) as {
        assistantResponse?: string;
        error?: string;
        threadId?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Ask could not answer right now.");
      }

      if (result.threadId) {
        setConnectAskThreadId(result.threadId);
      }
      setConnectAskMessages((messages) => [
        ...messages,
        {
          body:
            result.assistantResponse ||
            "Thanks. I saved that with the current Connect context.",
          role: "assistant",
        },
      ]);
    } catch (error) {
      setConnectAskInput(outgoingMessage);
      setConnectAskError(getErrorMessage(error));
      setConnectAskMessages((messages) => messages.slice(0, -1));
    } finally {
      setConnectAskSending(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-slate-50 px-3 pb-20 pt-2 text-slate-900 sm:px-4 sm:pt-4 lg:px-6 lg:py-8">
      <section className="mx-auto w-full max-w-5xl 2xl:max-w-6xl">
        <header className="sticky top-0 z-50 grid gap-2 bg-slate-50 py-1.5 sm:gap-3 sm:py-3 relative">
          <CarePlandTopNav
            accountEmail={accountEmail}
            activeModule="connect"
            askActive={connectAskOpen}
            canShowAdmin={isAdmin}
            canShowAsk
            earlyAccessLabel="EARLY ACCESS"
            focusOptions={focusOptions}
            focusValue={globalFocusId}
            onAdminClick={() => {
              window.location.assign("/admin");
            }}
            onChangeFocus={handleChangeGlobalFocus}
            onAskClick={() => {
              setConnectAskOpen((open) => !open);
                setConnectAskError("");
              }}
            onProfileClick={openProfileSettings}
            onSignOut={() => void handleSignOut()}
            supportMetrics={
              isAdmin
                ? [
                    {
                      count: 0,
                      label: "New",
                      tone: "neutral",
                    },
                  ]
                : []
            }
          />
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {activeView === "settings" ? (
              <div className="flex flex-wrap items-center gap-2">
                <nav
                  aria-label="Settings sections"
                  className="flex flex-wrap items-center gap-1.5 rounded-full border border-blue-100 bg-white/55 p-0.5 shadow-sm"
                >
                  {(["people", "guide", "receivers", "appearance"] as SetupView[]).map((view) => (
                    <button
                      aria-pressed={setupView === view}
                      className={`relative rounded-full px-3 py-1 text-sm font-semibold capitalize transition-colors ${
                        setupView === view
                          ? "bg-blue-50 text-blue-800 ring-1 ring-blue-100"
                          : "text-slate-500 hover:bg-blue-50/70 hover:text-blue-800"
                      }`}
                      key={view}
                      onClick={() => {
                        setSetupView(view);
                        saveConnectViewState({
                          activeView: "settings",
                          setupView: view,
                        });
                      }}
                      type="button"
                    >
                      {setupViewLabel(view)}
                    </button>
                  ))}
                </nav>
                <button
                  className="min-h-9 rounded-md px-2 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-800"
                  onClick={() => {
                    setActiveView("connect");
                    saveConnectViewState({ activeView: "connect" });
                  }}
                  type="button"
                >
                  Exit
                </button>
              </div>
            ) : activeView === "connect" ? (
              <>
                {isEveryoneFocus && state.focusPeople.length > 1 ? (
                  <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto">
                    {state.focusPeople.map((person) => {
                      const selected = person.id === activeConnectPersonId;

                      return (
                        <button
                          aria-pressed={selected}
                          className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-2.5 text-sm font-black transition ${
                            selected
                              ? "bg-[#edf5fc] text-[#244d73] ring-1 ring-[#b6d8f2]"
                              : "text-[#345d83] hover:bg-blue-50"
                          }`}
                          key={person.id ?? person.displayName}
                          onClick={() => handleChooseConnectTarget(person)}
                          type="button"
                        >
                          <ConnectPersonAvatar
                            person={focusPersonAsReceiverPerson(person)}
                            selected={selected}
                            size="xs"
                          />
                          {firstNameLabel(person.displayName)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span aria-hidden="true" />
                )}
                <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                  <button
                    aria-pressed={connectTool === "message"}
                    className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition ${
                      connectTool === "message"
                        ? "border border-blue-200 bg-blue-50 text-blue-900 shadow-sm"
                        : "text-slate-500 hover:bg-blue-50 hover:text-blue-800"
                    }`}
                    onClick={() => setConnectTool("message")}
                    type="button"
                  >
                    {selectedPerson
                      ? `Send a Message to ${selectedPersonFirstName}`
                      : "Send a Message"}
                  </button>
                  <button
                    aria-pressed={connectTool === "history"}
                    className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold transition ${
                      connectTool === "history"
                        ? "border border-blue-200 bg-blue-50 text-blue-900 shadow-sm"
                        : "text-slate-500 hover:bg-blue-50 hover:text-blue-800"
                    }`}
                    onClick={() => setConnectTool("history")}
                    type="button"
                  >
                    Message History
                  </button>
                  <button
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 text-sm font-semibold text-blue-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-100 disabled:opacity-55"
                    disabled={actionPending === "call" || !selectedMainConnectUserPersonId}
                    onClick={() => void startCall()}
                    type="button"
                  >
                    <PhoneIcon />
                    {actionPending === "call"
                      ? "Calling"
                      : selectedPerson
                        ? `Call ${selectedPersonFirstName}`
                        : "Call"}
                  </button>
                </div>
              </>
            ) : (
              <span aria-hidden="true" />
            )}
            <button
              aria-current={activeView === "settings" ? "page" : undefined}
              className={`ml-auto min-h-9 rounded-md px-2 text-sm font-semibold transition-colors ${
                activeView === "settings"
                  ? "text-blue-800"
                  : "text-slate-500 hover:text-blue-800"
              }`}
              onClick={() => {
                setSetupView("people");
                setActiveView("settings");
                saveConnectViewState({
                  activeView: "settings",
                  setupView: "people",
                });
              }}
              type="button"
            >
              Settings
            </button>
          </div>
        </header>

      {activeView === "connect" ? (
        <section className="grid w-full gap-5 px-2 py-5 sm:px-4 lg:px-6">
          {connectTool === "message" ? (
          <section className="grid max-w-[940px] items-start gap-5">
            <section className="grid max-w-[940px] gap-4">
              <div>
                <p className="text-lg font-bold text-[#5f6e84]">
                    {recording
                      ? "Recording. Press Stop when done."
                      : processingRecording
                        ? "Transcribing recording..."
                        : pendingRecording
                          ? "Original audio and transcript will be sent together."
                        : ""}
                  </p>
              </div>
              <form
              className="grid gap-4"
                onSubmit={sendMessage}
              >
                <textarea
                className="min-h-32 min-w-0 resize-y rounded-lg border border-[#b6cfe8] bg-white px-5 py-5 text-lg leading-relaxed shadow-sm"
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Type a message, or record one"
                  value={messageText}
                />
              <div className="flex flex-wrap items-center gap-3">
                  <button
                  className={`inline-flex min-h-14 items-center justify-center gap-3 rounded-lg border px-8 text-xl font-black shadow-sm ${
                      recording
                        ? "border-[#111111] bg-[#111111] text-white"
                        : "border-[#d6e3f2] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
                    }`}
                    disabled={processingRecording || actionPending === "message"}
                    onClick={() => void toggleRecording()}
                    type="button"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ef3f43] text-white">
                      <MicIcon />
                    </span>
                    {recording ? "Stop" : processingRecording ? "Transcribing" : "Record"}
                  </button>
                  <button
                  className="min-h-14 rounded-lg bg-[#9fb2c6] px-8 text-xl font-black text-white shadow-sm hover:bg-[#345d83] disabled:opacity-80"
                    disabled={
                      (!messageText.trim() && !pendingRecording) ||
                      !selectedMainConnectUserPersonId ||
                      actionPending === "message" ||
                      recording ||
                      processingRecording
                    }
                    type="submit"
                  >
                    {actionPending === "message"
                      ? "Sending"
                      : pendingRecording
                        ? "Send Audio Message"
                        : "Send Message"}
                  </button>
                  <button
                  className="min-h-14 rounded-lg border border-[#d6e3f2] bg-white px-8 text-xl font-black text-[#0f172a] shadow-sm hover:bg-[#f8fafc]"
                    onClick={clearComposer}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
                {pendingRecording ? (
                <div className="rounded-md border border-[#d6e3f2] bg-[#f8fafc] p-3 text-sm text-[#334155]">
                    <strong className="block text-[#172f49]">Recording ready</strong>
                    <span className="mt-1 block">
                      {pendingRecording.transcriptStatus === "completed"
                        ? "Transcript is ready."
                        : "Transcript is not available yet."}{" "}
                      Duration {Math.max(1, Math.round(pendingRecording.recording.durationMs / 1000))}s.
                    </span>
                    {pendingRecording.recording.localUrl ? (
                      <audio className="mt-2 w-full" controls src={pendingRecording.recording.localUrl}>
                        <track kind="captions" />
                      </audio>
                    ) : null}
                  </div>
                ) : null}
              <p className="text-lg font-black text-[#5f6e84]">
                Recordings keep original audio and transcript.
              </p>
              </form>
              </section>
            </section>
          ) : null}

            {connectTool === "history" ? (
            <div className="mt-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-4xl font-black leading-none text-[#173150]">
                  Message<br className="sm:hidden" /> History
                </h3>
                <div className="flex flex-wrap items-center justify-end gap-3 pt-3">
                    <button
                    className="min-h-10 rounded-md bg-transparent px-2 text-lg font-black text-[#5f6e84] hover:text-[#345d83] disabled:opacity-55"
                      disabled={loading}
                      onClick={() => void refresh()}
                      type="button"
                    >
                      Refresh
                    </button>
                  <label className="flex min-h-10 items-center gap-2 rounded-md bg-transparent px-1 text-lg font-black text-[#5f6e84]">
                      <input
                        checked={detailView}
                        onChange={(event) => setDetailView(event.target.checked)}
                        type="checkbox"
                      />
                      Detail View
                    </label>
                    <button
                      aria-label="Previous messages"
                      className="grid h-9 w-9 place-items-center rounded-md border border-[#cbd9e7] bg-white text-[#345d83] shadow-sm hover:bg-[#edf5fc] disabled:bg-[#d0d6d2] disabled:text-[#7a827d] disabled:shadow-none"
                      disabled={!canPagePreviousMessages}
                      onClick={() => setMessageIndex(Math.max(0, messagePageStart - 2))}
                      type="button"
                    >
                      <ChevronLeftIcon />
                    </button>
                    <button
                      aria-label="Next messages"
                      className="grid h-9 w-9 place-items-center rounded-md border border-[#cbd9e7] bg-white text-[#345d83] shadow-sm hover:bg-[#edf5fc] disabled:bg-[#d0d6d2] disabled:text-[#7a827d] disabled:shadow-none"
                      disabled={!canPageNextMessages}
                      onClick={() => setMessageIndex(messagePageStart + 2)}
                      type="button"
                    >
                      <ChevronRightIcon />
                    </button>
                </div>
                </div>
                {visibleMessages.length ? (
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  {visibleMessages.map((message) => {
                    const sender =
                      !message.from || message.from === "receiver_user"
                        ? selectedPersonName
                        : message.from;
                    const body = message.transcript || message.body || "No message body";
                    const sentTime = formatClockTime(message.createdAt);
                    const deliveryLabel = message.readAt
                      ? `Read ${formatClockTime(message.readAt)}`
                      : message.heardAt
                        ? `Heard ${formatClockTime(message.heardAt)}`
                      : `Sent ${sentTime}`;

                    return (
                      <article
                        className="min-h-[220px] rounded-2xl border border-[#d6e3f2] bg-white p-6 shadow-sm"
                        key={message.id ?? `${sender}-${message.createdAt ?? body}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <ConnectPersonAvatar
                              person={
                                sender === selectedPersonName
                                  ? selectedPerson
                                  : { displayName: sender }
                              }
                              size="sm"
                            />
                            <h4 className="text-2xl font-black leading-tight text-[#0f172a]">
                              Message from {sender}
                            </h4>
                          </div>
                          {detailView ? (
                            <span className="text-lg font-black uppercase tracking-wide text-[#5f6e84]">
                              Transcript:{" "}
                              {statusLabel(message.transcriptStatus || "not_requested")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-4 text-xl font-black leading-relaxed text-[#5f6e84]">
                          To {message.to || selectedPersonName} - {sentTime} * {deliveryLabel}
                        </p>
                        <p className="mt-5 text-2xl leading-relaxed text-[#0f172a]">
                          {body}
                        </p>
                        {detailView ? (
                          <div className="mt-5 grid gap-3 rounded-lg border border-[#d6e3f2] bg-white p-4 text-base sm:grid-cols-2">
                            <div>
                              <strong className="block text-xs font-black uppercase text-[#5f6e84]">
                                Receiver
                              </strong>
                              <span className="font-bold text-[#334155]">
                                {message.receiverId || selectedReceiverId}
                              </span>
                            </div>
                            <div>
                              <strong className="block text-xs font-black uppercase text-[#5f6e84]">
                                Type
                              </strong>
                              <span className="font-bold text-[#334155]">
                                {statusLabel(message.messageType || "text")}
                              </span>
                            </div>
                          </div>
                        ) : null}
                        {message.audioUrl ? (
                          <div className="mt-5 rounded-md border border-[#d6e3f2] bg-white p-3">
                            <strong className="block text-xs uppercase text-[#5f6e84]">
                              Original audio
                            </strong>
                            <audio
                              className="mt-2 w-full"
                              controls
                              onPlay={() => {
                                void markMessageHeard(message);
                              }}
                              src={connectAudioUrl(message.audioUrl)}
                            >
                              <track kind="captions" />
                            </audio>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                ) : (
                <p className="mt-5 text-xl font-black text-[#5f6e84]">
                  {selectedMainConnectUserPersonId
                    ? "No receiver messages yet."
                    : `${selectedPersonName} is not enabled for Connect messages yet.`}
                  </p>
                )}
              </div>
            ) : null}

          <RecipientCallPanel
            activeCallState={state.callSummary?.latestCall?.state || ""}
            canShowDiagnostics={isAdmin}
            callAudioStatus={callAudioStatus}
            callMuted={callMuted}
            onCallStateChange={(stateValue) => {
              void reportDashboardCallState(stateValue);
            }}
            onCallAnswered={stopCallCue}
            onCallEnded={stopCallCue}
            onCallFailed={playCallFailureSound}
            onHangUpCall={() => {
              void endDashboardCall();
            }}
            onRefreshCallNotes={() => {
              void refreshCallState();
            }}
            onRestartAudio={restartDashboardCallAudio}
            onToggleMuted={toggleCallMuted}
            recipientCallState={recipientCallState}
            selectedPerson={selectedPerson}
            selectedPersonName={selectedPersonName}
            setRecipientCallState={setRecipientCallState}
            setStatus={setStatus}
            summaryStatus={state.callSummary?.latestCall?.summaryStatus || ""}
            summaryText={state.callSummary?.latestCall?.summaryText || ""}
            transcriptRuntimeStatus={callTranscriptRuntimeStatus}
            transcriptStatus={state.callSummary?.latestCall?.transcriptStatus || ""}
            transcriptText={state.callSummary?.latestCall?.transcriptText || ""}
          />

        </section>
      ) : activeView === "receiver" ? (
        <ReceiverTroubleshootingView
          activeDevices={activeDevices}
          chooseGuidePreviewTarget={chooseGuidePreviewTarget}
          guideMode={guideMode}
          selectedReceiverKey={selectedReceiverKey}
          selectedReceiverLabel={selectedReceiverLabel}
          setGuideMode={setGuideMode}
          setSelectedReceiverKey={setSelectedReceiverKey}
          status={status}
        />
      ) : (
        <ConnectSettingsView
          activeDevices={activeDevices}
          activeMainConnectUserPersonId={selectedMainConnectUserPersonId}
          households={households}
          onRefresh={refresh}
          selectedReceiverKey={selectedReceiverKey}
          chooseGuidePreviewTarget={chooseGuidePreviewTarget}
          guideMode={guideMode}
          setSelectedReceiverKey={setSelectedReceiverKey}
          setGuideMode={setGuideMode}
          setupView={setupView}
          setSetupView={setSetupView}
          state={state}
          status={status}
        />
      )}
      </section>
      <ConnectAskPanel
        error={connectAskError}
        input={connectAskInput}
        messages={connectAskMessages}
        onChangeInput={setConnectAskInput}
        onClose={() => setConnectAskOpen(false)}
        onSubmit={submitConnectAsk}
        open={connectAskOpen}
        sending={connectAskSending}
      />
      <UserFacingFooter
        onWhyCarePland={() => {
          window.location.assign("/?personal=1");
        }}
      />
    </main>
  );
}

function ConnectPersonAvatar({
  person,
  selected = false,
  size = "md",
}: {
  person?: ConnectAvatarPerson | null;
  selected?: boolean;
  size?: "lg" | "md" | "sm" | "xs";
}) {
  const sizeClass =
    size === "lg"
      ? "h-20 w-20 text-3xl"
      : size === "sm"
        ? "h-12 w-12 text-base"
        : size === "xs"
          ? "h-7 w-7 text-[10px]"
          : "h-14 w-14 text-lg";
  const emojiClass =
    size === "lg"
      ? "text-5xl leading-none"
      : size === "sm"
        ? "text-3xl leading-none"
        : size === "xs"
          ? "text-lg leading-none"
          : "text-4xl leading-none";
  const avatarUrl = person?.avatarUrl?.trim();
  const avatarEmoji = person?.avatarEmoji?.trim();
  const displayName = person?.displayName ?? "";
  const altText = connectAvatarAltText(personAvatarProps(person));

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border font-black shadow-sm ${
        selected
          ? "border-[#4e84b2] bg-[#4e84b2] text-white"
          : "border-[#cbd9e7] bg-[#edf5fc] text-[#244d73]"
      } ${sizeClass}`}
      title={displayName || altText}
    >
      {avatarUrl ? (
        <Image
          alt={altText}
          className="h-full w-full object-cover"
          fill
          sizes={
            size === "lg"
              ? "80px"
              : size === "sm"
                ? "48px"
                : size === "xs"
                  ? "28px"
                  : "56px"
          }
          src={avatarUrl}
          unoptimized
        />
      ) : avatarEmoji ? (
        <span aria-hidden="true" className={emojiClass}>
          {avatarEmoji}
        </span>
      ) : (
        <span aria-hidden="true">{connectAvatarInitials(displayName)}</span>
      )}
    </span>
  );
}

function AvatarControls({
  onChanged,
  person,
  setStatus,
}: {
  onChanged: () => Promise<void>;
  person: ConnectAvatarPerson & { id: string };
  setStatus: (value: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasAvatar = Boolean(person.avatarUrl);

  async function uploadAvatar(file?: File) {
    if (!file || pending) return;

    setPending(true);
    setStatus("Updating avatar...");

    try {
      const formData = new FormData();
      formData.set("personId", person.id);
      formData.set("avatar", file);

      const response = await fetch(connectAvatarsEndpoint, {
        body: formData,
        headers: await connectAuthHeaders(),
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Avatar could not be updated.");
      }

      setStatus("Avatar updated.");
      await onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Avatar could not be updated.");
    } finally {
      setPending(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeAvatar() {
    if (pending || !hasAvatar) return;

    setPending(true);
    setStatus("Removing avatar...");

    try {
      const response = await fetch(
        `${connectAvatarsEndpoint}?personId=${encodeURIComponent(person.id)}`,
        {
          headers: await connectAuthHeaders(),
          method: "DELETE",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Avatar could not be removed.");
      }

      setStatus("Avatar removed.");
      await onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Avatar could not be removed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
      <input
        accept="image/*"
        capture="user"
        className="sr-only"
        onChange={(event) => void uploadAvatar(event.target.files?.[0])}
        ref={cameraInputRef}
        type="file"
      />
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => void uploadAvatar(event.target.files?.[0])}
        ref={fileInputRef}
        type="file"
      />
      <button
        className="min-h-9 rounded-md border border-[#cbd9e7] bg-white px-3 text-xs font-black text-[#345d83] hover:bg-[#edf5fc] disabled:opacity-55"
        disabled={pending}
        onClick={() => cameraInputRef.current?.click()}
        type="button"
      >
        Take Photo
      </button>
      <button
        className="min-h-9 rounded-md border border-[#cbd9e7] bg-white px-3 text-xs font-black text-[#345d83] hover:bg-[#edf5fc] disabled:opacity-55"
        disabled={pending}
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        Choose Photo
      </button>
      <button
        className="min-h-9 rounded-md border border-[#e4b9b5] bg-white px-3 text-xs font-black text-[#a52b25] hover:bg-[#fff8f7] disabled:opacity-55"
        disabled={pending || !hasAvatar}
        onClick={() => void removeAvatar()}
        type="button"
      >
        Remove Avatar
      </button>
      {/* TODO(ai-avatar-options): add the approved illustrated-avatar flow here:
          photo input -> generate 5 warm non-photorealistic options -> user chooses
          one -> keep only the selected avatar when privacy policy allows. */}
    </div>
  );
}

function ConnectAskPanel({
  error,
  input,
  messages,
  onChangeInput,
  onClose,
  onSubmit,
  open,
  sending,
}: {
  error: string;
  input: string;
  messages: ConnectAskMessage[];
  onChangeInput: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  sending: boolean;
}) {
  if (!open) return null;

  return (
    <>
      <button
        aria-label="Close Ask panel"
        className="fixed inset-0 z-[65] cursor-default bg-transparent"
        onClick={onClose}
        type="button"
      />
      <section
        aria-label="Ask panel"
        className="fixed inset-x-3 top-16 z-[70] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-blue-100 bg-white p-5 shadow-xl sm:left-auto sm:right-5 sm:top-20 sm:w-[min(32rem,calc(100vw-2.5rem))]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950">Ask</h2>
          <button
            className="rounded px-1 py-0.5 text-sm font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Questions, ideas, help, feedback, or help with Connect -- ask away.
        </p>

        {messages.length > 0 ? (
          <div className="mt-6 space-y-2">
            {messages.map((message, index) => (
              <div
                className={`max-w-[min(100%,42rem)] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto border border-blue-100 bg-blue-50 text-slate-950"
                    : "border border-blue-100 bg-white/85 text-slate-700"
                }`}
                key={`${message.role}-${index}`}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
            {error}
          </p>
        ) : null}

        <form className="mt-4" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="connect-ask-message">
            What&apos;s on your mind?
          </label>
          <textarea
            className="min-h-36 w-full rounded-xl border border-[#d8e0dc] bg-white px-4 py-4 text-base leading-relaxed text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            disabled={sending}
            id="connect-ask-message"
            onChange={(event) => onChangeInput(event.target.value)}
            placeholder="What's on your mind?"
            value={input}
          />
          <div className="mt-3 flex items-center justify-end">
            <button
              className="rounded-md bg-[#2d6cdf] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2457b5] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={sending || !input.trim()}
              type="submit"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function ConnectSettingsView({
  activeDevices,
  activeMainConnectUserPersonId,
  chooseGuidePreviewTarget,
  guideMode,
  households,
  onRefresh,
  selectedReceiverKey,
  setGuideMode,
  setSelectedReceiverKey,
  setupView,
  setSetupView,
  state,
  status,
}: {
  activeDevices: ConnectReceiverDevice[];
  activeMainConnectUserPersonId: string;
  chooseGuidePreviewTarget: (highlight: ReceiverGuideRect) => void;
  guideMode: boolean;
  households: ConnectReceiverHousehold[];
  onRefresh: () => Promise<void>;
  selectedReceiverKey: string;
  setGuideMode: (value: boolean) => void;
  setSelectedReceiverKey: (value: string) => void;
  setupView: SetupView;
  setSetupView: (value: SetupView) => void;
  state: DashboardState;
  status: string;
}) {
  const [primaryReceiverStatus, setPrimaryReceiverStatus] = useState("Ready.");
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [householdStatus, setHouseholdStatus] = useState("");
  const [householdPending, setHouseholdPending] = useState(false);
  const selectedHousehold = households[0] ?? null;
  const householdLabel =
    selectedHousehold?.displayName || selectedHousehold?.name || "Elizabeth and Robert";
  const householdPeopleLabel =
    selectedHousehold?.receiverPeople
      ?.map((person) => personName(person))
      .filter(Boolean)
      .join(", ") || "No Connect participants assigned";
  const receiverLabel =
    activeDevices[0]?.name || activeDevices[0]?.receiverId || "No receiver selected";

  async function createHousehold() {
    const displayName = newHouseholdName.trim();

    if (!displayName) {
      setHouseholdStatus("Enter a household name first.");
      return;
    }

    setHouseholdPending(true);
    setHouseholdStatus("Adding household...");
    try {
      const response = await fetch("/api/connect/provisioning/households", {
        body: JSON.stringify({
          confirmedPrototypeWrite: true,
          displayName,
          operationReason: "Coordinator confirmed Connect household setup.",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Household setup returned ${response.status}`);
      }

      setNewHouseholdName("");
      setHouseholdStatus("Household added.");
      await onRefresh();
    } catch (error) {
      setHouseholdStatus(
        error instanceof Error ? error.message : "Household could not be added."
      );
    } finally {
      setHouseholdPending(false);
    }
  }

  return (
    <section className="min-h-[calc(100vh-86px)] border-t border-[#d6e3f2] bg-[#f4f8fc]">
      <main className="px-2 py-5 sm:px-4 lg:px-6">
        <p className="mb-4 px-1 text-sm font-bold leading-snug text-[#5f6e84]">
          Trust boundary: No hidden listening. No recording by default. Every request is named,
          authorized, and logged.
        </p>
        {setupView === "people" ? (
          <section className="max-w-[940px] rounded-lg border border-[#d6e3f2] bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
              <PrimaryReceiverUserPanel
                currentPersonId={state.connectContext?.mainConnectUserPersonId ?? ""}
                onRefresh={onRefresh}
                primaryHouseholdLabel={householdLabel}
                people={state.connectContext?.people ?? []}
                setStatus={setPrimaryReceiverStatus}
                status={primaryReceiverStatus}
              />
              <section>
                <h3 className="text-sm font-black text-[#172f49]">Household</h3>
                <p className="mt-1 text-sm font-semibold text-[#5f6e84]">
                  {households.length
                    ? households
                        .map((household) => household.displayName || household.name || "Household")
                        .join(" · ")
                    : "No households yet."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="new-connect-household">
                    New household
                  </label>
                  <input
                    className="min-h-11 min-w-0 flex-1 rounded-full border border-[#cbd9e7] bg-white px-4 text-sm font-semibold text-[#0f172a]"
                    id="new-connect-household"
                    onChange={(event) => setNewHouseholdName(event.target.value)}
                    placeholder="Add household"
                    value={newHouseholdName}
                  />
                  <button
                    className="min-h-11 rounded-full border border-[#cbd9e7] bg-white px-5 text-sm font-black text-[#345d83] shadow-sm hover:bg-[#edf5fc] disabled:opacity-55"
                    disabled={householdPending || !newHouseholdName.trim()}
                    onClick={() => void createHousehold()}
                    type="button"
                  >
                    {householdPending ? "Adding" : "Add"}
                  </button>
                </div>
                {householdStatus ? (
                  <p className="mt-3 text-sm font-semibold text-[#5f6e84]">
                    {householdStatus}
                  </p>
                ) : null}
              </section>
            </div>
            <details className="mt-6 rounded-md border border-[#d6e3f2] bg-[#f8fafc] p-3">
              <summary className="cursor-pointer text-sm font-black">
                Advanced people diagnostics
              </summary>
              <p className="mt-2 text-sm text-[#5f6e84]">
                Household, receiver, care-circle, and Main Connect User audio records are
                summarized here for setup review.
              </p>
              <div className="mt-4 grid gap-4">
                <CareCircleContext
                  activeDevices={activeDevices}
                  householdLabel={householdLabel}
                  householdPeopleLabel={householdPeopleLabel}
                  receiverLabel={receiverLabel}
                />
                <SettingsAudioSummary
                  currentPersonId={activeMainConnectUserPersonId}
                  state={state}
                />
                <AudioDiagnostics currentPersonId={activeMainConnectUserPersonId} />
              </div>
            </details>
          </section>
        ) : setupView === "guide" ? (
          <ReceiverTroubleshootingView
            activeDevices={activeDevices}
            chooseGuidePreviewTarget={chooseGuidePreviewTarget}
            guideMode={guideMode}
            selectedReceiverKey={selectedReceiverKey}
            selectedReceiverLabel={receiverLabel}
            setGuideMode={setGuideMode}
            setSelectedReceiverKey={setSelectedReceiverKey}
            status={status}
          />
        ) : (
          <section className="max-w-[1040px]">
            <SetupPanel
              activeDevices={activeDevices}
              activeMainConnectUserPersonId={activeMainConnectUserPersonId}
              households={households}
              onRefresh={onRefresh}
              selectedReceiverKey={selectedReceiverKey}
              setSelectedReceiverKey={setSelectedReceiverKey}
              showTabs={false}
              setupView={setupView}
              setSetupView={setSetupView}
              state={state}
            />
          </section>
        )}
      </main>
    </section>
  );
}

function PrimaryReceiverUserPanel({
  currentPersonId,
  onRefresh,
  people,
  primaryHouseholdLabel,
  setStatus,
  status,
}: {
  currentPersonId: string;
  onRefresh: () => Promise<void>;
  people: ConnectPersPerson[];
  primaryHouseholdLabel: string;
  setStatus: (value: string) => void;
  status: string;
}) {
  const [savingPersonId, setSavingPersonId] = useState("");
  const activePeople = people.filter((person) => person.isActive !== false);
  const receiverEligiblePeople = activePeople.filter(
    (person) => !isConnectPetSubjectType(person.subjectType)
  );

  async function selectPrimaryReceiverUser(personId: string) {
    if (!personId || personId === currentPersonId || savingPersonId) {
      return;
    }

    const person = receiverEligiblePeople.find((item) => item.id === personId);

    if (!person) {
      return;
    }

    setSavingPersonId(personId);
    setStatus(
      `Saving ${
        person ? firstNameLabel(person.displayName) || "Main Connect User" : "Main Connect User"
      }...`
    );

    try {
      await updateConnectMainUserContext({ mainConnectUserPersonId: personId });
      await onRefresh();
      setStatus(
        person
          ? `Ready. ${firstNameLabel(person.displayName) || "Main Connect User"} is primary.`
          : "Ready."
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Main Connect User could not be saved."
      );
    } finally {
      setSavingPersonId("");
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-black text-[#172f49]">Main Connect User</h3>
        {!status.startsWith("Ready") ? (
          <span className="text-xs font-black text-[#5f6e84]">{status}</span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {receiverEligiblePeople.length ? (
          receiverEligiblePeople.map((person) => {
            const selected = person.id === currentPersonId;
            const pending = person.id === savingPersonId;

            return (
              <button
                aria-pressed={selected}
                className={`inline-flex min-h-12 items-center gap-3 whitespace-nowrap rounded-full border px-4 text-sm font-black transition ${
                  selected
                    ? "border-[#9fc6e8] bg-[#edf5fc] text-[#172f49]"
                    : "border-[#d6e3f2] bg-white text-[#345d83] hover:bg-[#f4f8fc]"
                }`}
                disabled={Boolean(savingPersonId)}
                key={person.id}
                onClick={() => void selectPrimaryReceiverUser(person.id)}
                type="button"
              >
                <ConnectPersonAvatar person={person} selected={selected} size="xs" />
                <span>
                  {firstNameLabel(person.displayName) || person.displayName}
                </span>
                {pending ? (
                  <span className="text-xs font-black text-[#5f6e84]">Saving</span>
                ) : null}
              </button>
            );
          })
        ) : (
          <span className="px-1 py-3 text-sm font-semibold text-[#5f6e84]">
            Add a Care VIP to choose a person.
          </span>
        )}

        <span
          aria-disabled="true"
          className="inline-flex min-h-12 cursor-not-allowed items-center gap-3 rounded-full border border-[#d6e3f2] bg-white/40 px-4 text-sm font-black text-[#8a9aad]"
          title="Household receiver mode is planned for future multi-user Receiver support."
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#edf5fc]/60 text-xs text-[#8a9aad]">
            HH
          </span>
          <span className="min-w-0 truncate">
            Household{primaryHouseholdLabel ? `: ${primaryHouseholdLabel}` : ""}
          </span>
          <span className="rounded-full bg-[#edf5fc]/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#7f8fa3]">
            planned
          </span>
        </span>
      </div>
    </section>
  );
}

function SettingsAudioSummary({
  currentPersonId,
  state,
}: {
  currentPersonId: string;
  state: DashboardState;
}) {
  const [detailPage, setDetailPage] = useState(0);
  const [profileStatus, setProfileStatus] = useState("Ready.");
  const total = state.audioProfile?.summary?.total ?? 0;
  const pageSize = 3;
  const hasScopedPerson = Boolean(currentPersonId);
  const selectedPersonLabel = currentPersonId
    ? "Main Connect User"
    : "Choose a Main Connect User";
  const detailItems = hasScopedPerson
    ? audioProfileDetailItems(state.audioProfile, null, selectedPersonLabel)
    : [];
  const pageCount = Math.max(1, Math.ceil(detailItems.length / pageSize));
  const visibleDetails = detailItems.slice(
    detailPage * pageSize,
    detailPage * pageSize + pageSize,
  );
  const canPageBack = detailPage > 0;
  const canPageForward = detailPage < pageCount - 1;
  const selectedTotal = total;
  const hasAudioData = hasScopedPerson && selectedTotal > 0;
  const metricItems = [
    { detail: selectedPersonLabel, label: "Feedback", value: `${selectedTotal} loaded` },
    {
      detail: "automatic EQ/leveling",
      label: "Enhancement",
      value: hasAudioData ? `${selectedTotal} playbacks` : "No data",
    },
    { detail: "average gain", label: "Playback", value: hasAudioData ? "Loaded" : "No data" },
    { detail: "scoped audio tuning", label: "EQ", value: hasAudioData ? "Loaded" : "No data" },
    { detail: "scoped audio dynamics", label: "Dynamics", value: hasAudioData ? "Loaded" : "No data" },
  ];

  async function runProfileAction(label: string, url: string) {
    if (!currentPersonId) {
      setProfileStatus("Choose a Main Connect User before running person diagnostics.");
      return;
    }

    setProfileStatus(`${label} running...`);
    try {
      const scopedUrl = `${url}?personId=${encodeURIComponent(currentPersonId)}`;
      const response = await fetch(scopedUrl, {
        headers: await connectAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }
      setProfileStatus(`${label} complete.`);
    } catch {
      setProfileStatus(`${label} could not run. Check the local Connect server.`);
    }
  }

  return (
    <details className="rounded-lg border border-[#d6e3f2] bg-white p-5 shadow-sm" open>
      <summary className="cursor-pointer list-none text-sm font-black text-[#172f49]">
        User Audio Profile
      </summary>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm font-black text-[#5f6e84]">
          {hasScopedPerson
            ? `${selectedPersonLabel}: ${hasAudioData ? "Scoped audio tuning loaded." : "No scoped audio tuning loaded yet."}`
            : "Choose a Main Connect User to load scoped audio tuning."}
        </p>
        <p className="rounded-lg border border-[#cbd9e7] bg-white px-3 py-2 text-sm font-black text-[#172f49]">
          {selectedPersonLabel}
        </p>
      </div>
      {!hasScopedPerson ? (
        <p className="mt-4 rounded-lg border border-[#d6e3f2] bg-[#f8fbff] px-4 py-3 text-sm font-black text-[#5f6e84]">
          Choose a Main Connect User to view scoped audio profile diagnostics.
        </p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metricItems.map((item) => (
          <div className="min-w-0 border-l border-[#d6e3f2] pl-3" key={item.label}>
            <p className="text-[10px] font-black uppercase tracking-normal text-[#5f6e84]">
              {item.label}
            </p>
            <p className="mt-1 break-words text-xl font-black leading-tight text-[#172f49]">
              {item.value}
            </p>
            <p className="mt-1 truncate text-xs font-semibold leading-snug text-[#5f6e84]">
              {item.detail}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3">
        <details className="rounded-lg border border-[#d6e3f2] bg-[#f8fbff] p-3">
          <summary className="cursor-pointer text-base font-black text-[#172f49]">Detail view</summary>
          <div className="mt-3 grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-[#5f6e84]">
                {detailItems.length} playback review items · {selectedPersonLabel}
              </p>
              <div className="flex gap-2">
                <button
                  className="h-9 w-10 rounded-md border border-[#cbd9e7] bg-white text-lg font-black text-[#172f49] disabled:bg-[#edf1f4] disabled:text-[#a3adb8]"
                  disabled={!canPageBack}
                  onClick={() => setDetailPage((page) => Math.max(0, page - 1))}
                  type="button"
                >
                  ‹
                </button>
                <button
                  className="h-9 w-10 rounded-md border border-[#cbd9e7] bg-white text-lg font-black text-[#172f49] disabled:bg-[#edf1f4] disabled:text-[#a3adb8]"
                  disabled={!canPageForward}
                  onClick={() => setDetailPage((page) => Math.min(pageCount - 1, page + 1))}
                  type="button"
                >
                  ›
                </button>
              </div>
            </div>
            {visibleDetails.map((item) => (
              <article className="rounded-lg border border-[#d6e3f2] bg-white p-4" key={item.id}>
                <h4 className="text-base font-black text-[#172f49]">{item.title}</h4>
                <p className="mt-1 text-sm font-bold text-[#5f6e84]">{item.time}</p>
                <p className="mt-2 text-base font-semibold leading-relaxed text-[#43546b]">
                  {item.settings}
                </p>
                <p className="mt-2 text-base font-semibold leading-relaxed text-[#43546b]">
                  {item.metrics}
                </p>
              </article>
            ))}
            {!visibleDetails.length ? (
              <p className="rounded-lg border border-[#d6e3f2] bg-white px-4 py-3 text-sm font-black text-[#5f6e84]">
                No scoped playback review items loaded for the Main Connect User.
              </p>
            ) : null}
          </div>
        </details>
        <details className="rounded-lg border border-[#d6e3f2] bg-[#f8fbff] p-3">
          <summary className="cursor-pointer text-base font-black text-[#172f49]">
            Audio profile diagnostics
          </summary>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#0f172a] shadow-sm hover:bg-[#edf5fc]"
              onClick={() => void runProfileAction("Refresh profile", "/api/connect/audio/profile")}
              type="button"
            >
              Refresh profile
            </button>
            <button
              className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#0f172a] shadow-sm hover:bg-[#edf5fc]"
              onClick={() =>
                void runProfileAction("Refresh audio review", "/api/connect/audio/review")
              }
              type="button"
            >
              Refresh audio review
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SettingsContextCard
              title="Profile status"
              items={[
                `${total} review events loaded`,
                "Enhanced playback summaries available",
                "Hearing feedback is reviewable",
              ]}
            />
            <SettingsContextCard
              title="Current tuning"
              items={
                hasAudioData
                  ? ["Scoped playback data loaded", "Review details above", "Broad tools stay separate"]
                  : ["No scoped gain data", "No scoped EQ data", "No scoped compression data"]
              }
            />
          </div>
          <p className="mt-4 rounded-lg border border-[#d6e3f2] bg-white px-4 py-3 text-sm font-black text-[#5f6e84]">
            {profileStatus}
          </p>
        </details>
      </div>
    </details>
  );
}

function audioProfileDetailItems(
  profile: ConnectAudioProfile | null,
  selectedPersonId: string | null,
  selectedPersonLabel: string,
) {
  const events = profile?.events?.length ? profile.events : [];
  const normalizedPersonId = selectedPersonId?.toLowerCase() ?? "";
  const normalizedPersonLabel = selectedPersonLabel.toLowerCase();
  const filteredEvents =
    normalizedPersonId && normalizedPersonLabel
      ? events.filter((event) => {
          const personValues = [
            event.personId,
            event.receiverPersonId,
            event.userId,
            event.personName,
            event.receiverPersonName,
            event.subject,
          ]
            .map(readableValue)
            .join(" ")
            .toLowerCase();
          return (
            personValues.includes(normalizedPersonId) ||
            personValues.includes(normalizedPersonLabel)
          );
        })
      : events;
  const visibleEvents = filteredEvents.length || !normalizedPersonId ? filteredEvents : events;
  if (!visibleEvents.length) {
    return [];
  }

  return visibleEvents.slice(0, 24).map((event, index) => {
    const title =
      readableValue(event.type) ||
      readableValue(event.eventType) ||
      readableValue(event.label) ||
      "Enhanced playback · web_receiver";
    const time = formatDateTime(readableValue(event.createdAt) || readableValue(event.timestamp) || "");
    const gain = readableValue(event.gain) || "1.6x";
    const highPass = readableValue(event.highPassHz) || readableValue(event.highPass) || "85 Hz";
    const compression = readableValue(event.compression) || "1.8:1";
    const reason = readableValue(event.reason) || readableValue(event.reasons);

    return {
      id: `${title}-${time}-${index}`,
      title,
      time,
      settings: `Gain ${gain}; high-pass ${highPass}; low-mid 0 dB; presence 0 dB; compression ${compression}.`,
      metrics:
        reason ||
        "Playback metrics were not included with this scoped audio event.",
    };
  });
}

function readableValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(readableValue).filter(Boolean).join(", ");
  return "";
}

function CareCircleContext({
  activeDevices,
  householdLabel,
  householdPeopleLabel,
  receiverLabel,
}: {
  activeDevices: ConnectReceiverDevice[];
  householdLabel: string;
  householdPeopleLabel: string;
  receiverLabel: string;
}) {
  const groups = [
    {
      items: ["Main Connect User Care Circle", "Membership verified by CarePland access"],
      title: "Care circle",
    },
    {
      items: [householdLabel, `People: ${householdPeopleLabel}`],
      title: "Household",
    },
    {
      items: [
        activeDevices.length
          ? `${receiverLabel} · available`
          : "No active receiver devices loaded",
      ],
      title: "Receiver devices",
    },
    {
      items: ["No additional Connect contacts loaded in this diagnostic panel"],
      title: "Participants",
    },
    {
      items: ["Enabled: no", "Level: None", "Consent: Not Configured"],
      title: "Escalation policy",
    },
  ];

  return (
    <details className="rounded-lg border border-[#d6e3f2] bg-white p-5 shadow-sm" open>
      <summary className="cursor-pointer list-none text-sm font-black text-[#172f49]">
        Care Circle Context
      </summary>
      <div className="mt-4 flex justify-end">
        <button
          className="min-h-10 rounded-lg border border-[#d6e3f2] bg-white px-4 text-sm font-black text-[#172f49] shadow-sm hover:bg-[#edf5fc]"
          type="button"
        >
          Refresh context
        </button>
      </div>
      <div className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2">
        {groups.map((group) => (
          <div className="min-w-0" key={group.title}>
            <p className="text-sm font-black text-[#172f49]">{group.title}</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#5f6e84]">
              {group.items.join(" · ")}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

function AudioDiagnostics({ currentPersonId }: { currentPersonId: string }) {
  const [diagnosticStatus, setDiagnosticStatus] = useState("Ready.");
  const personActions = [
    { label: "Review selected person's artifacts", method: "GET", url: "/api/connect/audio/artifacts" },
    { label: "Review selected person's audio", method: "GET", url: "/api/connect/audio/review" },
  ];
  const maintenanceActions = [
    {
      label: "Retry pending transcripts",
      method: "POST",
      url: "/api/connect/audio/artifacts/transcribe-pending",
    },
    {
      label: "Recover upload index",
      method: "POST",
      url: "/api/connect/audio/maintenance/reconcile",
    },
    {
      label: "Backfill hashes",
      method: "POST",
      url: "/api/connect/audio/maintenance/backfill-integrity",
    },
    { label: "Preview maintenance", method: "GET", url: "/api/connect/audio/maintenance-preview" },
    {
      label: "Backfill timeline",
      method: "POST",
      url: "/api/connect/audio/maintenance/backfill-timeline",
    },
    {
      label: "Backfill event links",
      method: "POST",
      url: "/api/connect/audio/maintenance/backfill-event-links",
    },
    { label: "Open manifest", method: "OPEN", url: "/api/connect/audio/manifest" },
  ];

  async function runPersonDiagnostic(action: (typeof personActions)[number]) {
    if (!currentPersonId) {
      setDiagnosticStatus("Choose a Main Connect User before running person diagnostics.");
      return;
    }

    const url = `${action.url}?personId=${encodeURIComponent(currentPersonId)}`;
    setDiagnosticStatus(`${action.label} running...`);
    try {
      const response = await fetch(url, {
        headers: await connectAuthHeaders(),
        method: action.method,
      });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }
      setDiagnosticStatus(`${action.label} complete.`);
    } catch {
      setDiagnosticStatus(`${action.label} could not run. Check the local Connect server.`);
    }
  }

  async function runMaintenanceDiagnostic(action: (typeof maintenanceActions)[number]) {
    if (action.method === "OPEN") {
      window.open(action.url, "_blank", "noopener,noreferrer");
      setDiagnosticStatus(`${action.label} opened.`);
      return;
    }

    setDiagnosticStatus(`${action.label} running...`);
    try {
      const response = await fetch(action.url, { method: action.method });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }
      setDiagnosticStatus(`${action.label} complete.`);
    } catch {
      setDiagnosticStatus(`${action.label} could not run. Check the local Connect server.`);
    }
  }

  return (
    <section className="rounded-lg border border-[#d6e3f2] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-px flex-1 bg-[#d6e3f2]" />
        <h3 className="text-sm font-black text-[#5f6e84]">Audio Diagnostics</h3>
        <span className="h-px flex-1 bg-[#d6e3f2]" />
      </div>
      <details className="rounded-lg border border-[#d6e3f2] bg-[#f8fbff] p-3" open>
        <summary className="cursor-pointer text-base font-black leading-tight text-[#172f49]">
          Main Connect User audio checks
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {personActions.map((action) => (
            <button
              className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-left text-base font-black text-[#0f172a] shadow-sm hover:bg-[#edf5fc]"
              key={action.label}
              onClick={() => void runPersonDiagnostic(action)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      </details>
      <details className="rounded-lg border border-[#d6e3f2] bg-[#f8fbff] p-3">
        <summary className="cursor-pointer text-base font-black leading-tight text-[#172f49]">
          Broad audio maintenance tools
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {maintenanceActions.map((action) => (
            <button
              className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-left text-base font-black text-[#0f172a] shadow-sm hover:bg-[#edf5fc]"
              key={action.label}
              onClick={() => void runMaintenanceDiagnostic(action)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
        <p className="mt-5 text-sm font-black text-[#5f6e84]">
          These controls are broad local maintenance tools, not Receiver-person checks.
        </p>
        <p className="mt-4 rounded-lg border border-[#d6e3f2] bg-white px-4 py-3 text-sm font-black text-[#5f6e84]">
          {diagnosticStatus}
        </p>
      </details>
    </section>
  );
}

function SettingsContextCard({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="rounded-lg border border-[#d6e3f2] bg-white p-4">
      <p className="text-base font-black text-[#172f49]">{title}</p>
      <ul className="mt-3 list-inside list-disc space-y-1 text-sm font-semibold text-[#5f6e84]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function SetupPanel({
  activeDevices,
  activeMainConnectUserPersonId,
  households,
  onRefresh,
  selectedReceiverKey,
  setSelectedReceiverKey,
  showTabs = true,
  setupView,
  setSetupView,
  state,
}: {
  activeDevices: ConnectReceiverDevice[];
  activeMainConnectUserPersonId: string;
  households: ConnectReceiverHousehold[];
  onRefresh: () => Promise<void>;
  selectedReceiverKey: string;
  setSelectedReceiverKey: (value: string) => void;
  showTabs?: boolean;
  setupView: SetupView;
  setSetupView: (value: SetupView) => void;
  state: DashboardState;
}) {
  const [setupActionPending, setSetupActionPending] = useState<"pair" | "recover" | null>(null);
  const [setupLink, setSetupLink] = useState<ReceiverSetupLink | null>(null);
  const [setupStatus, setSetupStatus] = useState("Setup links expire after 30 minutes.");
  const [receiverActionPending, setReceiverActionPending] = useState<string | null>(null);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [peopleActionPending, setPeopleActionPending] = useState<"household" | null>(null);
  const [appearanceTheme, setAppearanceTheme] = useState("Mid-Century");
  const [visualSkin, setVisualSkin] = useState("Modern");
  const [showRevokedDevices, setShowRevokedDevices] = useState(false);
  const [expandedReceiverDeviceId, setExpandedReceiverDeviceId] = useState("");
  const selectedDevice =
    activeDevices.find((device) => receiverKey(device) === selectedReceiverKey) ??
    activeDevices[0] ??
    null;
  const allDevices = state.provisioning?.receiverDevices ?? activeDevices;
  const setupTokens = state.provisioning?.setupTokens ?? [];
  const revokedDeviceCount = allDevices.filter((device) => device.status === "revoked").length;
  const visibleDevices = showRevokedDevices
    ? allDevices
    : allDevices.filter((device) => device.status !== "revoked");
  const householdOrder = households.map((household) => household.id);
  const sortedVisibleDevices = [...visibleDevices].sort((first, second) => {
    const firstHouseholdRank = householdOrder.indexOf(first.receiverHouseholdId);
    const secondHouseholdRank = householdOrder.indexOf(second.receiverHouseholdId);
    const firstRank = firstHouseholdRank === -1 ? Number.MAX_SAFE_INTEGER : firstHouseholdRank;
    const secondRank =
      secondHouseholdRank === -1 ? Number.MAX_SAFE_INTEGER : secondHouseholdRank;
    if (firstRank !== secondRank) return firstRank - secondRank;
    return (
      new Date(second.lastSeenAt || second.pairedAt || 0).getTime() -
      new Date(first.lastSeenAt || first.pairedAt || 0).getTime()
    );
  });
  const setupPendingDevice =
    allDevices.find((device) => device.status === "setup_pending") ?? selectedDevice;
  const appearanceThemes: Record<
    string,
    {
      accent: string;
      accentBorder: string;
      blue: string;
      blueBorder: string;
      buttonText: string;
      cream: string;
      frame: string;
      panel: string;
      surface: string;
      text: string;
    }
  > = {
    "Art Deco": {
      accent: "#0f6f62",
      accentBorder: "#07483f",
      blue: "#244f70",
      blueBorder: "#14354f",
      buttonText: "#ffffff",
      cream: "#f8ecd2",
      frame: "#141c24",
      panel: "#f5e0b4",
      surface: "#fff8e8",
      text: "#10201c",
    },
    "Classic Green": {
      accent: "#1d6816",
      accentBorder: "#0e3d0b",
      blue: "#32699a",
      blueBorder: "#1e4b75",
      buttonText: "#ffffff",
      cream: "#fbfaf2",
      frame: "#20281f",
      panel: "#edf5e6",
      surface: "#fffdf5",
      text: "#122018",
    },
    Custom: {
      accent: "#1f6f1a",
      accentBorder: "#0d4910",
      blue: "#346a96",
      blueBorder: "#1f4d73",
      buttonText: "#ffffff",
      cream: "#fffaf0",
      frame: "#202424",
      panel: "#eef5f2",
      surface: "#ffffff",
      text: "#122018",
    },
    "High Contrast": {
      accent: "#005b00",
      accentBorder: "#001f00",
      blue: "#003f7d",
      blueBorder: "#001f42",
      buttonText: "#ffffff",
      cream: "#ffffff",
      frame: "#000000",
      panel: "#ffffff",
      surface: "#ffffff",
      text: "#000000",
    },
    Library: {
      accent: "#34512d",
      accentBorder: "#24391f",
      blue: "#3f6271",
      blueBorder: "#2a4450",
      buttonText: "#ffffff",
      cream: "#fbf2dc",
      frame: "#2b2620",
      panel: "#efe3c7",
      surface: "#fff9ed",
      text: "#17231e",
    },
    "Mid-Century": {
      accent: "#687847",
      accentBorder: "#40552b",
      blue: "#32697e",
      blueBorder: "#23485f",
      buttonText: "#ffffff",
      cream: "#fff8ea",
      frame: "#1f211f",
      panel: "#f4e9ce",
      surface: "#f9efd8",
      text: "#17231e",
    },
    "Mission Control": {
      accent: "#275f35",
      accentBorder: "#133a1f",
      blue: "#1e5f8d",
      blueBorder: "#153f5d",
      buttonText: "#ffffff",
      cream: "#f4f7f5",
      frame: "#111827",
      panel: "#e9eef0",
      surface: "#fbfbf8",
      text: "#0f172a",
    },
    "Soft Cream": {
      accent: "#5c6f40",
      accentBorder: "#3d4d29",
      blue: "#4c7891",
      blueBorder: "#31566d",
      buttonText: "#ffffff",
      cream: "#fffaf0",
      frame: "#756f62",
      panel: "#fbf1dd",
      surface: "#fffdf7",
      text: "#17231e",
    },
    "Vintage Radio": {
      accent: "#6f542e",
      accentBorder: "#4a351b",
      blue: "#2e6075",
      blueBorder: "#1f4351",
      buttonText: "#ffffff",
      cream: "#fff1d1",
      frame: "#2a2218",
      panel: "#ead7ad",
      surface: "#fff4da",
      text: "#191f18",
    },
  };
  const appearanceThemeNames = Object.keys(appearanceThemes);
  const selectedAppearanceTheme =
    appearanceThemes[appearanceTheme] ?? appearanceThemes["Mid-Century"];
  const selectedHousehold = households[0] ?? null;
  const householdLabel =
    selectedHousehold?.displayName || selectedHousehold?.name || "No household selected";
  const householdPeopleLabel =
    selectedHousehold?.receiverPeople
      ?.map((person) => personName(person))
      .filter(Boolean)
      .join(", ") || "No Connect participants assigned";
  const receiverLabel =
    selectedDevice?.name || selectedDevice?.receiverId || "No receiver selected";

  async function createHousehold() {
    const displayName = newHouseholdName.trim();
    if (!displayName) {
      setSetupStatus("Enter a household name first.");
      return;
    }

    setPeopleActionPending("household");
    setSetupStatus("Adding household...");
    try {
      const response = await fetch("/api/connect/provisioning/households", {
        body: JSON.stringify({
          confirmedPrototypeWrite: true,
          displayName,
          operationReason: "Coordinator confirmed Connect household setup.",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Household setup returned ${response.status}`);
      }
      setNewHouseholdName("");
      setSetupStatus("Household added.");
      await onRefresh();
    } catch (error) {
      setSetupStatus(error instanceof Error ? error.message : "Household could not be added.");
    } finally {
      setPeopleActionPending(null);
    }
  }

  function receiverHouseholdName(receiverHouseholdId?: string) {
    return (
      households.find((household) => household.id === receiverHouseholdId)?.displayName ||
      households.find((household) => household.id === receiverHouseholdId)?.name ||
      selectedHousehold?.displayName ||
      selectedHousehold?.name ||
      "Unassigned household"
    );
  }

  function receiverHouseholdPeopleLabel(receiverHouseholdId?: string) {
    const household = households.find((item) => item.id === receiverHouseholdId);
    const people = household?.receiverPeople?.map(personName).filter(Boolean) ?? [];
    return people.length ? people.join(", ") : "No Connect participants assigned";
  }

  function receiverSetupStatus(device: ConnectReceiverDevice) {
    const token = setupTokens.find(
      (item) => item.receiverDeviceId === device.id && item.status === "active"
    );
    if (token) return "setup link active";
    return statusLabel(device.status);
  }

  function receiverConnectionLine(device: ConnectReceiverDevice) {
    const pairedLabel = device.pairedAt
      ? `Paired ${formatDateTime(device.pairedAt)}`
      : device.status === "setup_pending"
        ? "Waiting for pairing"
        : "Not paired";
    const lastSeen = device.lastSeenAt
      ? `Last seen ${formatDateTime(device.lastSeenAt)}`
      : "No heartbeat yet";
    const mode = receiverModeLabel(device.receiverMode);
    return `${pairedLabel} · ${lastSeen}${mode ? ` · ${mode}` : ""}`;
  }

  function receiverHeartbeatState(device: ConnectReceiverDevice) {
    if (!device.lastSeenAt) {
      return {
        isStale: device.status === "bound",
        label: "No heartbeat yet",
      };
    }

    const lastSeenMs = new Date(device.lastSeenAt).getTime();
    if (!Number.isFinite(lastSeenMs)) {
      return {
        isStale: true,
        label: "Heartbeat time unreadable",
      };
    }

    const ageMs = Date.now() - lastSeenMs;
    if (ageMs <= receiverHealthyHeartbeatMs) {
      return {
        isStale: false,
        label: "Checked in recently",
      };
    }
    if (ageMs <= receiverStaleHeartbeatMs) {
      return {
        isStale: false,
        label: "Last check-in a few minutes ago",
      };
    }

    return {
      isStale: true,
      label: `Needs check-in · last seen ${formatDateTime(device.lastSeenAt)}`,
    };
  }

  function receiverModeLabel(receiverMode?: string) {
    if (receiverMode === "dedicated") return "Dedicated mode";
    if (receiverMode === "personal") return "Regular app mode";
    return "";
  }

  function receiverDeviceModelLine(device: ConnectReceiverDevice) {
    const model = [device.nativeManufacturer, device.nativeModel].filter(Boolean).join(" ");
    const api = device.nativeSdk ? `Android API ${device.nativeSdk}` : "";
    return [model, api].filter(Boolean).join(" · ") || "Not reported";
  }

  function receiverAppVersionLine(device: ConnectReceiverDevice) {
    const version = device.nativeVersionName
      ? `${device.nativeVersionName}${device.nativeVersionCode ? ` (${device.nativeVersionCode})` : ""}`
      : device.nativeVersionCode
        ? String(device.nativeVersionCode)
        : "";
    return [version, device.shellVersion ? `Shell ${device.shellVersion}` : ""]
      .filter(Boolean)
      .join(" · ") || "Not reported";
  }

  function receiverKioskLine(device: ConnectReceiverDevice) {
    if (device.lockTaskActive) return "Kiosk active";
    if (device.lockTaskPermitted) return "Kiosk available";
    if (device.deviceOwner) return "Device owner";
    return "Not enabled";
  }

  function receiverUpdateLine(device: ConnectReceiverDevice) {
    if (device.updateAction === "required") return "Update required";
    if (device.updateAction === "recommended") return "Update available";
    if (device.updateAction === "none") return "Current";
    return "Not reported";
  }

  function receiverRecoveryLine(device: ConnectReceiverDevice) {
    if (!device.lastRecoveryAction) return "No restart recovery reported yet";
    const actionLabel =
      device.lastRecoveryAction === "android.intent.action.BOOT_COMPLETED"
        ? "Started after reboot"
        : device.lastRecoveryAction === "android.intent.action.MY_PACKAGE_REPLACED"
          ? "Restarted after app update"
          : device.lastRecoveryAction === "dedicated_soft_reopen"
            ? "Reopened after leaving app"
            : device.lastRecoveryAction === "receiver_load_timeout"
              ? "Receiver page timed out"
              : device.lastRecoveryAction === "receiver_network_error"
                ? "Receiver page connection failed"
                : device.lastRecoveryAction === "receiver_ssl_error"
                  ? "Receiver page security check failed"
                  : device.lastRecoveryAction.startsWith("receiver_http_error")
                    ? "Receiver page returned an error"
                    : statusLabel(device.lastRecoveryAction);
    return device.lastRecoveryAt
      ? `${actionLabel} · ${formatDateTime(device.lastRecoveryAt)}`
      : actionLabel;
  }

  function receiverApplianceLine(device: ConnectReceiverDevice) {
    const mode = receiverModeLabel(device.receiverMode) || "Mode not reported";
    const bootStart = capabilityStatusLabel(device.capabilityStatuses?.bootStart);
    const kiosk = receiverKioskLine(device);
    return `${mode} · Auto-start ${bootStart.toLowerCase()} · ${kiosk}`;
  }

  function capabilityStatusLabel(status?: string) {
    if (status === "enabled") return "On";
    if (status === "supported") return "Available";
    if (status === "unavailable") return "Not available";
    if (status === "unknown") return "Unknown";
    return "Not reported";
  }

  function receiverAuditEvents(receiverDeviceId?: string, receiverHouseholdId?: string) {
    const events = state.provisioning?.auditEvents ?? [];
    return events.filter((event) => {
      if (receiverDeviceId && event.receiverDeviceId === receiverDeviceId) return true;
      if (receiverHouseholdId && event.receiverHouseholdId === receiverHouseholdId) return true;
      return !receiverDeviceId && !receiverHouseholdId;
    });
  }

  function receiverSetupTokens(receiverDeviceId?: string) {
    return setupTokens.filter((token) => token.receiverDeviceId === receiverDeviceId);
  }

  function auditEventLabel(type?: string) {
    if (!type) return "Provisioning event";
    return type
      .split(".")
      .map((part) => part.replace(/_/g, " "))
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(".");
  }

  function shortAuditEvent(event: NonNullable<ConnectProvisioningSnapshot["auditEvents"]>[number]) {
    const name = event.name || event.receiverId || event.setupCode || event.receiverDeviceId || "";
    const suffix = name ? ` · ${name}` : "";
    return `${auditEventLabel(event.type)}${suffix}`;
  }

  async function createSetupLink(
    mode: "pair" | "recover",
    targetDevice: ConnectReceiverDevice | null = selectedDevice
  ) {
    if (!targetDevice?.id) {
      setSetupStatus("Select a receiver first.");
      return;
    }

    setSelectedReceiverKey(receiverKey(targetDevice));
    setSetupActionPending(mode);
    setSetupStatus(mode === "recover" ? "Creating recovery link..." : "Creating setup link...");

    try {
      const response = await fetch(
        `/api/connect/provisioning/receiver-devices/${encodeURIComponent(targetDevice.id)}/setup-token`,
        {
          body: JSON.stringify({
            confirmedPrototypeWrite: true,
            createdByUserId: "andrew",
            expiresInMinutes: 30,
            locationLabel: targetDevice.locationLabel,
            name: targetDevice.name,
            operationReason:
              mode === "recover"
                ? "Coordinator confirmed Connect receiver recovery link."
                : "Coordinator confirmed Connect receiver setup link.",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        setupPath?: string;
        setupToken?: { expiresAt?: string; setupCode?: string };
      };

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Setup returned ${response.status}`);
      }

      const setupUrl = payload.setupPath
        ? new URL(payload.setupPath, connectPrototypeEndpoints.dashboard).toString()
        : "";
      setSetupLink({
        expiresAt: payload.setupToken?.expiresAt,
        setupCode: payload.setupToken?.setupCode,
        setupUrl,
      });
      setSetupStatus(
        mode === "recover"
          ? "Recovery setup link is ready."
          : "Receiver setup link is ready."
      );
      await onRefresh();
    } catch (error) {
      setSetupStatus(error instanceof Error ? error.message : "Setup link could not be created.");
    } finally {
      setSetupActionPending(null);
    }
  }

  async function copySetupLink() {
    if (!setupLink?.setupUrl) return;

    try {
      await navigator.clipboard.writeText(setupLink.setupUrl);
      setSetupStatus("Setup link copied.");
    } catch {
      setSetupStatus("Copy failed. Open the setup link and copy it from the browser.");
    }
  }

  async function revokeReceiverDevice(device: ConnectReceiverDevice) {
    if (!device.id) {
      setSetupStatus("Select a receiver first.");
      return;
    }

    const label = device.name || device.receiverId || "this receiver";
    const confirmed = window.confirm(
      `Revoke ${label}? This will not delete the Android app. It only removes this receiver's server approval, so it will need setup again.`
    );
    if (!confirmed) return;

    setReceiverActionPending(device.id);
    setSetupStatus("Revoking receiver...");
    try {
      const response = await fetch(
        `/api/connect/provisioning/receiver-devices/${encodeURIComponent(device.id)}/revoke`,
        {
          body: JSON.stringify({
            confirmedPrototypeWrite: true,
            operationReason: `Admin revoked receiver ${label}.`,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Revoke returned ${response.status}`);
      }

      setSetupStatus("Receiver revoked. The Android app remains installed and will need setup again.");
      await onRefresh();
    } catch (error) {
      setSetupStatus(error instanceof Error ? error.message : "Receiver could not be revoked.");
    } finally {
      setReceiverActionPending(null);
    }
  }

  return (
    <section className="rounded-lg border border-[#d6e3f2] bg-white p-4 shadow-sm">
      {showTabs ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">Setup</h2>
            <span className="text-xs font-black uppercase tracking-normal text-[#5f6e84]">
              Coordinator
            </span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1 rounded-md bg-[#edf5fc] p-1">
            {(["people", "guide", "receivers", "appearance"] as SetupView[]).map((view) => (
              <button
                className={`min-h-9 rounded-md px-2 text-xs font-black capitalize ${
                  setupView === view ? "bg-white text-[#172f49] shadow-sm" : "text-[#345d83]"
                }`}
                key={view}
                onClick={() => setSetupView(view)}
                type="button"
              >
                {setupViewLabel(view)}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <p className="mt-3 rounded-md border border-[#d6e3f2] bg-[#f8fafc] px-3 py-2 text-sm font-black text-[#5f6e84]">
        {setupStatus}
      </p>

      {setupView === "people" ? (
        <div className="mt-4 space-y-3">
          <Metric
            detail="receiver households"
            label="Households"
            value={String(
              state.provisioning?.totals?.receiverHouseholds ?? households.length
            )}
          />
          <Metric
            detail="existing Pers people"
            label="Connect people"
            value={String(state.connectContext?.people.length ?? 0)}
          />
          <Metric
            detail="loaded through provisioning"
            label="Approved callers"
            value="Not loaded here"
          />
          <Metric
            detail="audio feedback summary"
            label="Audio profile"
            value={String(state.audioProfile?.summary?.total ?? 0)}
          />
          <div className="rounded-md border border-[#d6e3f2] bg-[#f8fafc] p-3">
            <p className="text-sm font-black text-[#172f49]">Household setup</p>
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1 text-xs font-black uppercase tracking-normal text-[#5f6e84]">
                New household
                <input
                  className="min-h-10 rounded-md border border-[#cbd9e7] bg-white px-3 text-sm font-semibold normal-case text-[#0f172a]"
                  onChange={(event) => setNewHouseholdName(event.target.value)}
                  placeholder="Bedroom suite"
                  value={newHouseholdName}
                />
              </label>
              <button
                className="min-h-10 rounded-md border border-[#cbd9e7] bg-white px-3 text-sm font-bold text-[#345d83] hover:bg-[#edf5fc] disabled:opacity-55"
                disabled={peopleActionPending !== null}
                onClick={() => void createHousehold()}
                type="button"
              >
                {peopleActionPending === "household" ? "Adding" : "Add household"}
              </button>
            </div>
          </div>
          <div className="rounded-md border border-[#d6e3f2] bg-[#f8fafc] p-3">
            <p className="text-sm font-black text-[#172f49]">Connect People</p>
            <p className="mt-1 text-xs font-semibold text-[#5f6e84]">
              Connect uses existing CarePland Pers people. Add or edit people in Pers; Connect
              Home follows the global focus when one person is selected, and uses a Connect-local
              person when global focus is Everyone.
            </p>
            <div className="mt-3 grid gap-2">
              {(state.connectContext?.people ?? []).slice(0, 6).map((person) => (
                <div
                  className="grid gap-3 rounded-md border border-[#cbd9e7] bg-white p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
                  key={person.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ConnectPersonAvatar person={person} size="md" />
                    <span className="min-w-0">
                      <span className="block truncate font-black text-[#172f49]">
                        {person.displayName}
                      </span>
                      <span className="text-xs font-black uppercase tracking-normal text-[#5f6e84]">
                        {person.id === state.connectContext?.mainConnectUserPersonId
                          ? "Main Connect User"
                          : "CarePland person"}
                      </span>
                    </span>
                  </div>
                  <AvatarControls
                    onChanged={onRefresh}
                    person={person}
                    setStatus={setSetupStatus}
                  />
                </div>
              ))}
              {state.connectContext?.people.length ? null : (
                <p className="rounded-md border border-[#cbd9e7] bg-white px-3 py-3 text-sm font-semibold text-[#5f6e84]">
                  No active Pers people loaded yet.
                </p>
              )}
            </div>
          </div>
          <details className="rounded-md border border-[#d6e3f2] bg-[#f8fafc] p-3">
            <summary className="cursor-pointer text-sm font-black">
              Advanced people diagnostics
            </summary>
            <p className="mt-2 text-sm text-[#5f6e84]">
              Household, receiver, and care-circle records are summarized here
              for setup review.
            </p>
            <div className="mt-4 grid gap-4">
              <CareCircleContext
                activeDevices={activeDevices}
                householdLabel={householdLabel}
                householdPeopleLabel={householdPeopleLabel}
                receiverLabel={receiverLabel}
              />
              <SettingsAudioSummary
                currentPersonId={activeMainConnectUserPersonId}
                state={state}
              />
              <AudioDiagnostics
                currentPersonId={activeMainConnectUserPersonId}
              />
            </div>
          </details>
        </div>
      ) : null}

      {setupView === "receivers" ? (
        <div className="mt-4 space-y-4">
          <fieldset className="rounded-xl border border-[#d6e3f2] bg-white p-5">
            <legend className="px-2 text-lg font-black text-[#5f6e84]">Receivers</legend>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["What exists", "Receiver list, household assignment, and current status."],
                ["What is working", "Online, last seen, and setup progress are shown here."],
                ["What needs attention", "Create setup links, re-pair, or revoke receivers."],
              ].map(([title, detail]) => (
                <div className="rounded-xl border border-[#cbd9e7] bg-[#f8fbff] p-4" key={title}>
                  <p className="text-lg font-black text-[#172f49]">{title}</p>
                  <p className="mt-2 text-sm font-black text-[#5f6e84]">{detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <label className="grid gap-2 text-sm font-black text-[#5f6e84]">
                Device name
                <input
                  className="min-h-12 rounded-lg border border-[#cbd9e7] bg-white px-4 text-base font-black text-[#0f172a]"
                  readOnly
                  value={selectedDevice?.name || "Kitchen Receiver"}
                />
              </label>
              <label className="grid gap-2 text-sm font-black text-[#5f6e84]">
                Location
                <input
                  className="min-h-12 rounded-lg border border-[#cbd9e7] bg-white px-4 text-base font-black text-[#0f172a]"
                  readOnly
                  value={selectedDevice?.locationLabel || "Kitchen"}
                />
              </label>
              <button
                className="self-end min-h-12 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#0f172a] hover:bg-[#edf5fc] disabled:opacity-55"
                disabled={!selectedDevice || setupActionPending !== null}
                onClick={() => void createSetupLink("pair")}
                type="button"
              >
                {setupActionPending === "pair" ? "Creating" : "Create setup link"}
              </button>
              <button
                className="self-end min-h-12 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#0f172a] hover:bg-[#edf5fc]"
                onClick={() => void onRefresh()}
                type="button"
              >
                Refresh devices
              </button>
            </div>

            {selectedDevice ? (
              <div className="mt-4 rounded-xl border border-[#b9d5ee] bg-[#f8fbff] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase text-[#5f6e84]">
                      Selected Receiver
                    </p>
                    <h3 className="mt-1 text-2xl font-black text-[#172f49]">
                      {selectedDevice.name || selectedDevice.receiverId || "Receiver"}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-[#5f6e84]">
                      {receiverConnectionLine(selectedDevice)}
                    </p>
                  </div>
                  <button
                    className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#0f172a] hover:bg-[#edf5fc]"
                    onClick={() => void onRefresh()}
                    type="button"
                  >
                    Check status
                  </button>
                </div>
                {receiverHeartbeatState(selectedDevice).isStale ? (
                  <p className="mt-4 rounded-lg border border-[#d9a441] bg-[#fff8df] px-4 py-3 text-sm font-black text-[#6f4d00]">
                    {receiverHeartbeatState(selectedDevice).label}. Open the app on the device or tap
                    Check status after it is online.
                  </p>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  <MiniStatus
                    label="Heartbeat"
                    value={receiverHeartbeatState(selectedDevice).label}
                  />
                  <MiniStatus
                    label="APK"
                    value={receiverAppVersionLine(selectedDevice)}
                  />
                  <MiniStatus
                    label="Update"
                    value={receiverUpdateLine(selectedDevice)}
                  />
                  <MiniStatus
                    label="Appliance"
                    value={receiverApplianceLine(selectedDevice)}
                  />
                  <MiniStatus
                    label="Restart recovery"
                    value={receiverRecoveryLine(selectedDevice)}
                  />
                </div>
              </div>
            ) : null}

            {revokedDeviceCount ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d6e3f2] bg-white p-3">
                <span className="text-sm font-black text-[#5f6e84]">
                  {showRevokedDevices
                    ? "Revoked devices shown"
                    : `${revokedDeviceCount} revoked device${revokedDeviceCount === 1 ? "" : "s"} hidden`}
                </span>
                <button
                  className="min-h-10 rounded-lg border border-[#cbd9e7] bg-white px-5 text-sm font-black text-[#0f172a] hover:bg-[#edf5fc]"
                  onClick={() => setShowRevokedDevices((value) => !value)}
                  type="button"
                >
                  {showRevokedDevices ? "Hide revoked" : "Show revoked"}
                </button>
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {!sortedVisibleDevices.length ? (
                <p className="rounded-lg border border-[#d6e3f2] bg-[#f8fafc] p-4 text-sm font-semibold text-[#5f6e84]">
                  No receiver devices created yet.
                </p>
              ) : null}
              {sortedVisibleDevices.map((device, index) => {
                const deviceKey = receiverKey(device);
                const previousDevice = sortedVisibleDevices[index - 1];
                const showHouseholdHeader =
                  index === 0 ||
                  previousDevice?.receiverHouseholdId !== device.receiverHouseholdId;
                const isExpanded = expandedReceiverDeviceId === device.id;
                const presenceState = device.presence?.state || "offline";
                const deviceTokens = receiverSetupTokens(device.id);
                const deviceEvents = receiverAuditEvents(device.id, device.receiverHouseholdId);

                return (
                  <div className="space-y-2" key={deviceKey}>
                    {showHouseholdHeader ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d6e3f2] bg-white px-4 py-3">
                        <strong className="text-base font-black text-[#172f49]">
                          {receiverHouseholdName(device.receiverHouseholdId)}
                        </strong>
                        <span className="text-sm font-black text-[#5f6e84]">
                          {receiverHouseholdPeopleLabel(device.receiverHouseholdId)}
                        </span>
                      </div>
                    ) : null}
                    <article
                      className={`rounded-xl border p-4 ${
                        deviceKey === selectedReceiverKey
                          ? "border-[#9bc5ef] bg-[#f8fbff]"
                          : "border-[#d6e3f2] bg-white"
                      }`}
                    >
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <button
                          className="min-w-0 text-left"
                          onClick={() => setSelectedReceiverKey(deviceKey)}
                          type="button"
                        >
                          <strong className="block text-lg font-black text-[#0f172a]">
                            {device.name || device.receiverId || "Receiver"}
                          </strong>
                          <span className="block text-sm font-semibold text-[#5f6e84]">
                            {device.locationLabel || "No location"} ·{" "}
                            {receiverHouseholdName(device.receiverHouseholdId)} ·{" "}
                            {receiverSetupStatus(device)} ·{" "}
                            {device.presence?.label || statusLabel(presenceState)}
                          </span>
                          <span className="block text-sm font-semibold text-[#5f6e84]">
                            {receiverConnectionLine(device)}
                          </span>
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`h-3 w-3 rounded-full ${
                              presenceState === "online"
                                ? "bg-[#2e9a67]"
                                : presenceState === "stale"
                                  ? "bg-[#d6a629]"
                                  : presenceState === "revoked"
                                    ? "bg-[#b43a32]"
                                    : "bg-[#5f6e84]"
                            }`}
                            aria-label={statusLabel(presenceState)}
                          />
                          <button
                            className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#0f172a] hover:bg-[#edf5fc]"
                            onClick={() =>
                              setExpandedReceiverDeviceId(isExpanded || !device.id ? "" : device.id)
                            }
                            type="button"
                          >
                            {isExpanded ? "Hide details" : "Details"}
                          </button>
                          <button
                            className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#0f172a] hover:bg-[#edf5fc] disabled:opacity-55"
                            disabled={setupActionPending !== null}
                            onClick={() => void createSetupLink("pair", device)}
                            type="button"
                          >
                            {device.status === "revoked" ? "Re-pair" : "New link"}
                          </button>
                          <button
                            className="min-h-11 rounded-lg border border-[#e4b9b5] bg-white px-5 text-base font-black text-[#a52b25] hover:bg-[#fff5f3] disabled:opacity-55"
                            disabled={
                              !device.id ||
                              device.status === "revoked" ||
                              receiverActionPending === device.id
                            }
                            onClick={() => void revokeReceiverDevice(device)}
                            title={
                              device.status === "revoked"
                                ? "Receiver already revoked."
                                : "Revoke server approval for this receiver."
                            }
                            type="button"
                          >
                            {receiverActionPending === device.id ? "Revoking" : "Revoke"}
                          </button>
                        </div>
                      </div>
                      {isExpanded ? (
                        <div className="mt-4 rounded-lg border border-[#d6e3f2] bg-white p-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <MiniStatus
                              label="Household"
                              value={receiverHouseholdName(device.receiverHouseholdId)}
                            />
                            <MiniStatus label="Setup tokens" value={String(deviceTokens.length)} />
                            <MiniStatus label="Audit events" value={String(deviceEvents.length)} />
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <MiniStatus
                              label="Receiver mode"
                              value={receiverModeLabel(device.receiverMode) || "Not reported"}
                            />
                            <MiniStatus
                              label="Provisioned"
                              value={
                                device.provisioningCompletedAt
                                  ? formatDateTime(device.provisioningCompletedAt)
                                  : "Not reported"
                              }
                            />
                            <MiniStatus
                              label="Android device"
                              value={receiverDeviceModelLine(device)}
                            />
                            <MiniStatus
                              label="App version"
                              value={receiverAppVersionLine(device)}
                            />
                            <MiniStatus label="Update" value={receiverUpdateLine(device)} />
                            <MiniStatus label="Kiosk" value={receiverKioskLine(device)} />
                            <MiniStatus
                              label="Hardware profile"
                              value={device.hardwareProfile || "Not reported"}
                            />
                            <MiniStatus
                              label="Recovery"
                              value={
                                device.lastRecoveryAction
                                  ? `${device.lastRecoveryAction}${
                                      device.lastRecoveryAt
                                        ? ` · ${formatDateTime(device.lastRecoveryAt)}`
                                        : ""
                                    }`
                                  : "None reported"
                              }
                            />
                          </div>
                          <div className="mt-4 rounded-lg border border-[#d6e3f2] bg-[#f8fafc] p-3">
                            <p className="text-sm font-black uppercase text-[#5f6e84]">
                              Receiver setup checks
                            </p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              <MiniStatus
                                label="Full screen"
                                value={capabilityStatusLabel(device.capabilityStatuses?.fullscreen)}
                              />
                              <MiniStatus
                                label="Keep awake"
                                value={capabilityStatusLabel(device.capabilityStatuses?.keepAwake)}
                              />
                              <MiniStatus
                                label="Microphone"
                                value={capabilityStatusLabel(device.capabilityStatuses?.microphone)}
                              />
                              <MiniStatus
                                label="Kiosk"
                                value={capabilityStatusLabel(device.capabilityStatuses?.kiosk)}
                              />
                              <MiniStatus
                                label="Battery"
                                value={capabilityStatusLabel(
                                  device.capabilityStatuses?.batteryOptimization
                                )}
                              />
                              <MiniStatus
                                label="Auto-start"
                                value={capabilityStatusLabel(device.capabilityStatuses?.bootStart)}
                              />
                              <MiniStatus
                                label="Update checks"
                                value={capabilityStatusLabel(
                                  device.capabilityStatuses?.updateChecks
                                )}
                              />
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                            <label className="grid gap-2 text-sm font-black uppercase text-[#5f6e84]">
                              Name
                              <input
                                className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-base font-black normal-case text-[#0f172a]"
                                readOnly
                                value={device.name || "Receiver"}
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-black uppercase text-[#5f6e84]">
                              Location
                              <input
                                className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-base font-black normal-case text-[#0f172a]"
                                readOnly
                                value={device.locationLabel || ""}
                              />
                            </label>
                            <button
                              className="self-end min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#0f172a] opacity-60"
                              disabled
                              type="button"
                            >
                              Save
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <label className="grid gap-2 text-sm font-black uppercase text-[#5f6e84]">
                              Receiver household
                              <select
                                className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-base font-semibold normal-case text-[#0f172a]"
                                disabled
                                value={device.receiverHouseholdId || ""}
                              >
                                {households.map((household) => (
                                  <option key={household.id} value={household.id}>
                                    {household.displayName || household.name || "Household"}
                                  </option>
                                ))}
                                {!households.length ? <option>No household loaded</option> : null}
                              </select>
                            </label>
                            <button
                              className="self-end min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#0f172a] opacity-60"
                              disabled
                              type="button"
                            >
                              Move
                            </button>
                          </div>
                          <p className="mt-3 text-sm font-black text-[#5f6e84]">
                            Moving a receiver keeps its device token but revokes active setup links for that device.
                          </p>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-sm font-black text-[#0f172a]">Setup history</p>
                              <ul className="mt-2 space-y-1 text-sm font-semibold text-[#5f6e84]">
                                {deviceTokens.slice(0, 4).map((token) => (
                                  <li key={token.token || token.setupCode || token.createdAt}>
                                    {statusLabel(token.status)} · {token.setupCode || "setup link"} ·{" "}
                                    {formatDateTime(token.createdAt)}
                                  </li>
                                ))}
                                {!deviceTokens.length ? <li>No setup token history loaded.</li> : null}
                              </ul>
                            </div>
                            <div>
                              <p className="text-sm font-black text-[#0f172a]">Recent events</p>
                              <ul className="mt-2 space-y-1 text-sm font-semibold text-[#5f6e84]">
                                {deviceEvents.slice(0, 6).map((event) => (
                                  <li key={event.id || `${event.type}-${event.createdAt}`}>
                                    {shortAuditEvent(event)} · {formatDateTime(event.createdAt)}
                                  </li>
                                ))}
                                {!deviceEvents.length ? <li>No recent events loaded.</li> : null}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-[#d6e3f2] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-lg font-black text-[#172f49]">
                  {setupPendingDevice?.name || selectedDevice?.name || "Kitchen Receiver"}
                </strong>
                <span className="text-sm font-black text-[#5f6e84]">
                  {setupPendingDevice?.status === "setup_pending" ? "Setup Pending" : "Setup progress"}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniStatus
                  label="Receiver device record"
                  value={setupPendingDevice?.name || "Not created"}
                />
                <MiniStatus
                  label="Single-use setup link"
                  value={setupLink?.setupCode ? setupLink.setupCode : "Not created"}
                />
                <MiniStatus
                  label="Device token paired"
                  value={setupPendingDevice?.pairedAt ? "Paired" : "Waiting for receiver"}
                />
                <MiniStatus
                  label="Receiver heartbeat"
                  value={setupPendingDevice?.lastSeenAt ? formatDateTime(setupPendingDevice.lastSeenAt) : "Not paired"}
                />
              </div>
            </div>

            {setupLink ? (
              <div className="mt-4 rounded-md border border-[#d6e3f2] bg-[#f8fafc] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-normal text-[#5f6e84]">
                      Receiver setup code
                    </p>
                    <strong className="mt-1 block text-2xl text-[#172f49]">
                      {setupLink.setupCode || "---"}
                    </strong>
                  </div>
                  <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#5f6e84]">
                    {setupLink.expiresAt ? `Expires ${formatDateTime(setupLink.expiresAt)}` : "Expires soon"}
                  </span>
                </div>
                {setupLink.setupUrl ? (
                  <div className="mt-3 grid gap-2">
                    <a
                      className="truncate rounded-md border border-[#cbd9e7] bg-white px-3 py-2 text-xs font-semibold text-[#345d83] hover:bg-[#edf5fc]"
                      href={setupLink.setupUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {setupLink.setupUrl}
                    </a>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        className="min-h-9 rounded-md border border-[#cbd9e7] bg-white px-3 text-xs font-black text-[#345d83] hover:bg-[#edf5fc]"
                        onClick={() => void copySetupLink()}
                        type="button"
                      >
                        Copy link
                      </button>
                      <a
                        className="grid min-h-9 place-items-center rounded-md bg-[#345d83] px-3 text-xs font-black text-white hover:bg-[#254a6d]"
                        href={setupLink.setupUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <details className="mt-4 rounded-lg border border-[#d6e3f2] bg-[#f8fafc] p-3">
              <summary className="cursor-pointer text-lg font-black text-[#173150]">
                Provisioning diagnostics
              </summary>
              <div className="mt-3 rounded-lg border border-[#d6e3f2] bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-black text-[#0f172a]">Provisioning events</p>
                  <span className="text-sm font-black text-[#5f6e84]">
                    {(state.provisioning?.auditEvents ?? []).length} recent
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {(state.provisioning?.auditEvents ?? []).slice(0, 6).map((event) => (
                    <div
                      className="rounded-lg border border-[#d6e3f2] bg-white px-3 py-2"
                      key={event.id || `${event.type}-${event.createdAt}`}
                    >
                      <p className="text-sm font-black text-[#172f49]">{shortAuditEvent(event)}</p>
                      <p className="text-sm font-black text-[#5f6e84]">
                        {formatDateTime(event.createdAt)}
                      </p>
                    </div>
                  ))}
                  {!(state.provisioning?.auditEvents ?? []).length ? (
                    <p className="text-sm font-semibold text-[#5f6e84]">
                      No provisioning events loaded.
                    </p>
                  ) : null}
                </div>
              </div>
            </details>
            <p className="mt-3 text-sm font-black text-[#5f6e84]">
              Setup links are single-use and expire after 30 minutes.
            </p>
          </fieldset>

          <fieldset className="rounded-xl border border-[#d6e3f2] bg-white p-5">
            <legend className="px-2 text-lg font-black text-[#5f6e84]">Diagnostics</legend>
            <details className="rounded-lg border border-[#d6e3f2] bg-[#f8fafc] p-3">
              <summary className="cursor-pointer text-lg font-black text-[#173150]">
                Local receiver server
              </summary>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-2 text-sm font-black text-[#5f6e84]">
                  Server URL
                  <input
                    className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-base font-semibold text-[#0f172a]"
                    readOnly
                    value="http://localhost:8790"
                  />
                </label>
                <button
                  className="min-h-11 justify-self-start rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#0f172a] hover:bg-[#edf5fc]"
                  onClick={() => void onRefresh()}
                  type="button"
                >
                  Refresh receiver server
                </button>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[#9bc5ef] bg-white px-4 py-3">
                  <span>
                    <strong className="block text-base font-black text-[#0f172a]">
                      {selectedDevice?.name || "Living Room Receiver"} (Web)
                    </strong>
                    <span className="text-sm font-semibold text-[#5f6e84]">
                      {selectedDevice?.presence?.label || statusLabel(selectedDevice?.presence?.state || "ringing")} ·{" "}
                      {selectedDevice?.receiverId || connectPrototypeReceiverId}
                    </span>
                  </span>
                  <span
                    className={`h-4 w-4 rounded-full ${
                      selectedDevice?.presence?.state === "online" ? "bg-[#2e9a67]" : "bg-[#bf7d1a]"
                    }`}
                  />
                </div>
                <p className="text-sm font-black text-[#5f6e84]">
                  {activeDevices.length || (selectedDevice ? 1 : 0)} receiver found.
                </p>
              </div>
            </details>
          </fieldset>

          <fieldset className="rounded-xl border border-[#d6e3f2] bg-white p-5">
            <legend className="px-2 text-lg font-black text-[#5f6e84]">
              Advanced Receiver Routing
            </legend>
            <details className="rounded-lg border border-[#d6e3f2] bg-[#f8fafc] p-3">
              <summary className="cursor-pointer text-lg font-black text-[#173150]">
                Local receiver routing
              </summary>
              <div className="mt-3 grid gap-3">
                {[
                  ["Living Room Echo", true],
                  ["Kitchen Nest", true],
                  ["Tablet", true],
                  ["Phone bridge", false],
                ].map(([label, checked]) => (
                  <label
                    className="flex items-center gap-3 text-base font-black text-[#0f172a]"
                    key={String(label)}
                  >
                    <input
                      className="h-5 w-5 accent-[#6c9ac4]"
                      defaultChecked={Boolean(checked)}
                      type="checkbox"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </details>
          </fieldset>
        </div>
      ) : null}

      {setupView === "appearance" ? (
        <div className={showTabs ? "mt-4" : ""}>
          <div className="grid gap-6">
            <label className="grid gap-3 text-2xl font-black text-[#5f6e84]">
              Preset Theme
              <select
                className="min-h-14 rounded-xl border border-[#cbd9e7] bg-white px-5 text-xl font-normal text-[#0f172a]"
                onChange={(event) => setAppearanceTheme(event.target.value)}
                value={appearanceTheme}
              >
                {appearanceThemeNames.map((themeName) => (
                  <option key={themeName}>{themeName}</option>
                ))}
              </select>
            </label>

            <section
              className="rounded-xl border-[16px] p-4 shadow-sm"
              style={{
                backgroundColor: selectedAppearanceTheme.panel,
                borderColor: selectedAppearanceTheme.frame,
              }}
            >
              <div
                className="rounded-xl border-4 p-5"
                style={{
                  backgroundColor: selectedAppearanceTheme.surface,
                  borderColor: selectedAppearanceTheme.cream,
                  color: selectedAppearanceTheme.text,
                }}
              >
                <p className="text-lg font-black uppercase text-[#5f6e84]">Receiver</p>
                <h3 className="text-3xl font-black">Call Andrew</h3>
                <button
                  className="mt-4 min-h-16 w-full rounded-xl border-4 text-2xl font-black shadow-sm"
                  style={{
                    backgroundColor: selectedAppearanceTheme.accent,
                    borderColor: selectedAppearanceTheme.accentBorder,
                    color: selectedAppearanceTheme.buttonText,
                  }}
                  type="button"
                >
                  Ask a question
                </button>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
                  <button
                    className="min-h-16 rounded-xl border-4 text-2xl font-black shadow-sm"
                    style={{
                      backgroundColor: selectedAppearanceTheme.blue,
                      borderColor: selectedAppearanceTheme.blueBorder,
                      color: selectedAppearanceTheme.buttonText,
                    }}
                    type="button"
                  >
                    Message
                  </button>
                  <button
                    className="min-h-16 rounded-xl border-4 text-2xl font-black shadow-sm"
                    style={{
                      backgroundColor: selectedAppearanceTheme.cream,
                      borderColor: "#b9a77d",
                      color: "#5f6e84",
                    }}
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    className="min-h-16 rounded-xl border-4 text-2xl font-black shadow-sm"
                    style={{
                      backgroundColor: selectedAppearanceTheme.frame,
                      borderColor: "#111111",
                      color: "#ffffff",
                    }}
                    type="button"
                  >
                    Mic
                  </button>
                </div>
              </div>
            </section>

            <label className="grid gap-3 text-2xl font-black text-[#5f6e84]">
              Visual Skin
              <select
                className="min-h-14 rounded-xl border border-[#cbd9e7] bg-white px-5 text-xl font-normal text-[#0f172a]"
                onChange={(event) => setVisualSkin(event.target.value)}
                value={visualSkin}
              >
                <option>Modern</option>
                <option>Classic appliance</option>
                <option>High contrast</option>
              </select>
            </label>

            <div className="flex flex-wrap gap-4">
              <button
                className="min-h-16 rounded-xl bg-[#6c9ac4] px-7 text-2xl font-black text-white shadow-sm hover:bg-[#4779a8]"
                type="button"
              >
                Save appearance
              </button>
              <button
                className="min-h-16 rounded-xl border border-[#d6e3f2] bg-white px-7 text-2xl font-black text-[#0f172a] shadow-sm hover:bg-[#edf5fc]"
                type="button"
              >
                Reset to default
              </button>
            </div>
            <p className="text-xl font-black text-[#5f6e84]">
              Previewing {appearanceTheme} receiver appearance.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReceiverTroubleshootingView({
  activeDevices,
  chooseGuidePreviewTarget,
  guideMode,
  selectedReceiverKey,
  selectedReceiverLabel,
  setGuideMode,
  setSelectedReceiverKey,
  status,
}: {
  activeDevices: ConnectReceiverDevice[];
  chooseGuidePreviewTarget: (highlight: ReceiverGuideRect) => void;
  guideMode: boolean;
  selectedReceiverKey: string;
  selectedReceiverLabel: string;
  setGuideMode: (value: boolean) => void;
  setSelectedReceiverKey: (value: string) => void;
  status: string;
}) {
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const receiverOptions =
    activeDevices.length > 0
      ? activeDevices
      : [
          {
            id: connectPrototypeReceiverId,
            name: "Kitchen Receiver",
            receiverId: connectPrototypeReceiverId,
            status: "online",
          },
          {
            id: "persistence-test-receiver",
            name: "Persistence Test Receiver",
            receiverId: "persistence-test-receiver",
            status: "online",
          },
        ];
  const guideText = guideMode
    ? "Guide Mode: What you see is what they see. Click a button to highlight it on the receiver. They still have full control and can press any button."
    : `This does not reflect what is actually seen on ${selectedReceiverLabel} but is a reference for discussion.`;

  useEffect(() => {
    const frame = previewFrameRef.current;
    if (!frame) return undefined;
    const previewFrame = frame;

    let cleanup: (() => void) | undefined;

    function readableControlLabel(element: HTMLElement) {
      const ariaLabel = element.getAttribute("aria-label")?.trim();
      if (ariaLabel) return ariaLabel;
      const text = element.textContent?.replace(/\s+/g, " ").trim();
      return text || "this area";
    }

    function attachGuideClickListener() {
      cleanup?.();
      cleanup = undefined;
      const doc = previewFrame.contentDocument;
      if (!doc) return;
      const frameDocument = doc;

      function handlePreviewClick(event: globalThis.MouseEvent) {
        if (!guideMode) return;

        const target = event.target as HTMLElement | null;
        const control = target?.closest("button, input, textarea, [role='button']");

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const shell =
          frameDocument.querySelector("[data-receiver-shell='true']") ?? frameDocument.body;
        const shellRect = shell.getBoundingClientRect();
        const controlRect =
          control instanceof HTMLElement
            ? control.getBoundingClientRect()
            : new DOMRect(event.clientX - 40, event.clientY - 40, 80, 80);
        chooseGuidePreviewTarget({
          height: Math.max(16, Math.round(controlRect.height)),
          label: control instanceof HTMLElement ? readableControlLabel(control) : "that area",
          width: Math.max(16, Math.round(controlRect.width)),
          x: Math.round(controlRect.left - shellRect.left),
          y: Math.round(controlRect.top - shellRect.top),
        });
      }

      frameDocument.addEventListener("click", handlePreviewClick, true);
      cleanup = () => frameDocument.removeEventListener("click", handlePreviewClick, true);
    }

    attachGuideClickListener();
    previewFrame.addEventListener("load", attachGuideClickListener);

    return () => {
      previewFrame.removeEventListener("load", attachGuideClickListener);
      cleanup?.();
    };
  }, [chooseGuidePreviewTarget, guideMode]);

  return (
    <section className="mx-auto w-full max-w-[1360px] px-6 py-5 sm:px-8">
      <div className="rounded-lg border border-[#d6e3f2] bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-start">
          <h1 className="text-4xl font-black tracking-normal text-[#081225] sm:text-5xl">
            {selectedReceiverLabel}
          </h1>
          <button
            className={`min-h-14 rounded-lg border px-7 text-lg font-black shadow-sm ${
              guideMode
                ? "border-[#b89a38] bg-[#f4dfa2] text-[#172f49]"
                : "border-[#cbd9e7] bg-white text-[#081225] hover:bg-[#f8fafc]"
            }`}
            onClick={() => {
              setGuideMode(!guideMode);
              if (guideMode) {
                window.localStorage.removeItem(receiverGuideTargetStorageKey);
                window.localStorage.removeItem(receiverGuideRectStorageKey);
              }
            }}
            type="button"
          >
            {guideMode ? "Stop guiding" : "Guide mode"}
          </button>
          <fieldset className="min-w-[320px]">
            <legend className="text-sm font-black text-[#5f6e84]">Select Receiver</legend>
            <div className="mt-2 space-y-1">
              {receiverOptions.map((device) => (
                <label
                  className="flex cursor-pointer items-center gap-3 text-base font-black text-[#081225]"
                  key={receiverKey(device)}
                >
                  <input
                    checked={receiverKey(device) === selectedReceiverKey}
                    className="h-5 w-5 accent-[#6aa0d8]"
                    name="receiver-preview"
                    onChange={() => setSelectedReceiverKey(receiverKey(device))}
                    type="radio"
                  />
                  <span>
                    {device.name || device.receiverId || "Receiver"}
                    {device.status ? (
                      <span className="font-black text-[#081225]">
                        {" "}
                        · {statusLabel(device.status).toLowerCase()}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-5 rounded-lg border border-[#c7dff5] bg-[#edf7ff] px-4 py-3 text-lg font-black leading-snug text-[#244d73]">
          {guideText}
        </div>

        <p className="sr-only" aria-live="polite">
          {status}
        </p>

        <div className="mt-5 overflow-hidden rounded-lg border-[14px] border-[#202423] bg-[#202423] shadow-2xl">
          <iframe
            ref={previewFrameRef}
            className="block h-[760px] w-full bg-[#202423] sm:h-[820px] xl:h-[900px]"
            src="/connect/receiver?preview=1"
            title="CarePland Connect receiver preview"
          />
        </div>
      </div>
    </section>
  );
}

function RecipientCallPanel({
  activeCallState,
  canShowDiagnostics,
  callAudioStatus,
  callMuted,
  onCallStateChange,
  onCallAnswered,
  onCallEnded,
  onCallFailed,
  onHangUpCall,
  onRefreshCallNotes,
  onRestartAudio,
  onToggleMuted,
  recipientCallState,
  selectedPerson,
  selectedPersonName,
  setRecipientCallState,
  setStatus,
  summaryStatus,
  summaryText,
  transcriptRuntimeStatus,
  transcriptStatus,
  transcriptText,
}: {
  activeCallState: string;
  canShowDiagnostics: boolean;
  callAudioStatus: ConnectCallAudioStatus;
  callMuted: boolean;
  onCallStateChange: (state: string) => void;
  onCallAnswered: () => void;
  onCallEnded: () => void;
  onCallFailed: () => void;
  onHangUpCall: () => void;
  onRefreshCallNotes: () => void;
  onRestartAudio: () => void;
  onToggleMuted: () => void;
  recipientCallState: RecipientCallState;
  selectedPerson?: ConnectReceiverPerson;
  selectedPersonName: string;
  setRecipientCallState: (value: RecipientCallState) => void;
  setStatus: (value: string) => void;
  summaryStatus: string;
  summaryText: string;
  transcriptRuntimeStatus: string;
  transcriptStatus: string;
  transcriptText: string;
}) {
  const isRinging = recipientCallState === "ringing";
  const isConnected = recipientCallState === "connected";
  const hasServerActiveCall = ["answered", "connected", "ringing"].includes(activeCallState);
  const canEndCall = isConnected || isRinging || hasServerActiveCall;
  const headline = isConnected
    ? `Connected with ${selectedPersonName}.`
    : isRinging
      ? "Incoming call"
      : recipientCallState === "ended"
        ? "Conversation ended."
        : recipientCallState === "declined"
          ? "Conversation was not established."
          : "Waiting for a Connect Request.";
  const subline = isConnected
    ? "Live conversation in progress."
    : isRinging
      ? "Andrew would like to talk now."
      : "A live conversation starts only if the recipient accepts.";
  const audioLabel =
    callAudioStatus === "remote_audio" || callAudioStatus === "connected"
      ? "Live audio"
      : callAudioStatus === "microphone_ready" || callAudioStatus === "connecting"
        ? "Audio connecting"
        : callAudioStatus === "interrupted"
          ? "Audio interrupted"
          : callAudioStatus === "starting"
            ? "Starting audio"
            : isConnected
              ? "Waiting for audio"
              : "Audio idle";
  const audioDetail =
    callAudioStatus === "remote_audio"
      ? "Remote sound is arriving."
      : callAudioStatus === "connected"
        ? "Peer connection is live."
        : callAudioStatus === "microphone_ready"
          ? "Microphone is ready."
          : callAudioStatus === "connecting"
            ? "Linking both sides."
            : callAudioStatus === "interrupted"
              ? "Try hanging up and calling again."
              : isConnected
                ? "The call is connected; audio has not arrived yet."
                : "Audio starts after the call is answered.";
  const canRestartAudio =
    isConnected && callAudioStatus !== "remote_audio" && callAudioStatus !== "connected";
  const transcriptLabel = transcriptStatusLabel({
    audioStatus: callAudioStatus,
    callState: recipientCallState,
    runtimeStatus: transcriptRuntimeStatus,
    transcriptStatus,
    transcriptText,
  });
  const callNotesLabel = callNotesStatusLabel({
    callState: recipientCallState,
    summaryStatus,
    summaryText,
    transcriptStatus,
    transcriptText,
  });
  const hasTranscriptDiagnostics =
    Boolean(transcriptText.trim()) || Boolean(transcriptLabel) || Boolean(transcriptRuntimeStatus);
  const canRefreshCallNotes =
    recipientCallState === "ended" && !summaryText.trim() && transcriptStatus !== "deleted";

  function updateCall(value: RecipientCallState, message: string) {
    if (value === "connected") onCallAnswered();
    if (value === "ended") {
      onHangUpCall();
      setRecipientCallState(value);
      setStatus(message);
      return;
    }
    if (value === "declined") onCallEnded();
    if (value === "waiting") onCallFailed();
    if (value === "connected") onCallStateChange("connected");
    if (value === "declined") onCallStateChange("declined");
    if (value === "waiting") onCallStateChange("receiver_unavailable");
    setRecipientCallState(value);
    setStatus(message);
  }

  return (
    <section className="pt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black uppercase tracking-normal text-[#5f6e84]">
            Recipient side
          </p>
          <h2 className="text-2xl font-black text-[#173150]">Incoming call</h2>
        </div>
        <span className="rounded-full bg-[#edf5fc] px-4 py-2 text-sm font-black uppercase tracking-normal text-[#345d83]">
          {isConnected ? "Active" : isRinging ? "Ringing" : "No active receiver"}
        </span>
      </div>
      {isRinging ? (
        <div className="mb-4 rounded-lg border border-[#d6e3f2] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-2xl font-black text-[#173150]">Andrew is calling</h3>
              <p className="mt-1 text-lg font-semibold text-[#5f6e84]">
                Press Answer to talk.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                className="min-h-12 rounded-md bg-[#345d83] px-6 text-lg font-black text-white hover:bg-[#254a6d]"
                onClick={() => updateCall("connected", `${selectedPersonName} answered the call.`)}
                type="button"
              >
                Answer
              </button>
              <button
                className="min-h-12 rounded-md border border-[#d6e3f2] bg-white px-6 text-lg font-black text-[#5f6e84] hover:bg-[#f8fafc]"
                onClick={() => updateCall("declined", `${selectedPersonName} declined the call.`)}
                type="button"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-6 rounded-lg border border-[#d6e3f2] bg-white p-5 shadow-sm">
        <div className="relative shrink-0">
          <ConnectPersonAvatar person={selectedPerson} size="lg" />
          <span
            className={`absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-white ${
              isRinging ? "bg-[#a43f34] text-white" : "bg-[#edf5fc] text-[#345d83]"
            }`}
          >
            <PhoneIcon />
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-black">{headline}</h3>
          <p className="mt-1 text-lg text-[#5f6e84]">{subline}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[#d6e3f2] bg-[#f8fbff] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-normal text-[#5f6e84]">
            {audioLabel}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#345d83]">
            {callMuted ? "Your microphone is muted." : audioDetail}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRestartAudio ? (
            <button
              className="min-h-11 rounded-md bg-[#345d83] px-4 text-sm font-black text-white hover:bg-[#254a6d]"
              onClick={onRestartAudio}
              type="button"
            >
              Restart Audio
            </button>
          ) : null}
          <button
            className="min-h-11 rounded-md border border-[#d6e3f2] bg-white px-4 text-sm font-black text-[#345d83] hover:bg-[#edf5fc] disabled:opacity-45"
            disabled={!isConnected}
            onClick={onToggleMuted}
            type="button"
          >
            {callMuted ? "Unmute" : "Mute"}
          </button>
        </div>
      </div>
      {isRinging || isConnected || callNotesLabel ? (
        <div className="mt-3 rounded-lg border border-[#d6e3f2] bg-white p-4">
          <p className="text-sm font-black uppercase tracking-normal text-[#5f6e84]">
            Call notes
          </p>
          <p className="mt-2 text-base font-semibold leading-relaxed text-[#345d83]">
            {callNotesLabel}
          </p>
          {canRefreshCallNotes ? (
            <button
              className="mt-3 min-h-10 rounded-md border border-[#d6e3f2] bg-white px-4 text-sm font-black text-[#345d83] hover:bg-[#edf5fc]"
              onClick={onRefreshCallNotes}
              type="button"
            >
              Check Again
            </button>
          ) : null}
          {canShowDiagnostics && hasTranscriptDiagnostics ? (
            <details className="mt-3 rounded-md border border-[#d6e3f2] bg-[#f8fafc] p-3">
              <summary className="cursor-pointer text-sm font-black text-[#173150]">
                Diagnostics
              </summary>
              {transcriptLabel ? (
                <p className="mt-2 text-sm font-semibold leading-relaxed text-[#5f6e84]">
                  {transcriptLabel}
                </p>
              ) : null}
              {transcriptRuntimeStatus ? (
                <p className="mt-2 text-xs font-bold uppercase tracking-normal text-[#7f8794]">
                  Runtime: {transcriptRuntimeStatus}
                </p>
              ) : null}
              {transcriptText.trim() ? (
                <p className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded border border-[#d6e3f2] bg-white p-3 text-sm font-semibold leading-relaxed text-[#173150]">
                  {transcriptText}
                </p>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}
      {summaryText.trim() ? (
        <div className="mt-3 rounded-lg border border-[#b9d4ba] bg-[#f7fcf5] p-4">
          <p className="text-sm font-black uppercase tracking-normal text-[#52695a]">
            Care summary
          </p>
          <p className="mt-2 whitespace-pre-wrap text-base font-semibold leading-relaxed text-[#173b22]">
            {summaryText.trim()}
          </p>
          {summaryStatus === "approved" ? (
            <p className="mt-2 text-sm font-black text-[#2e6f36]">
              Approved summary saved.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          className="min-h-12 rounded-md bg-[#b6cfe8] px-4 text-base font-black text-white hover:bg-[#345d83] disabled:opacity-45"
          disabled={!isRinging}
          onClick={() => updateCall("connected", `${selectedPersonName} answered the call.`)}
          type="button"
        >
          Answer
        </button>
        <button
          className="min-h-12 rounded-md bg-[#a7adb6] px-4 text-base font-black text-white hover:bg-[#626b78] disabled:opacity-45"
          disabled={!canEndCall}
          onClick={() =>
            updateCall(
              "ended",
              isRinging ? "The call was canceled." : "The call ended."
            )
          }
          type="button"
        >
          {isRinging ? "Cancel Call" : "Hang Up"}
        </button>
        <button
          className="min-h-12 rounded-md bg-[#f8eeee] px-4 text-base font-black text-[#a43f34] hover:bg-[#f3dfdc] disabled:opacity-45"
          disabled={!isRinging}
          onClick={() => updateCall("declined", `${selectedPersonName} declined the call.`)}
          type="button"
        >
          Decline
        </button>
        <button
          className="min-h-12 rounded-md border border-[#d6e3f2] bg-white px-4 text-base font-black text-[#7f8794] hover:bg-[#f8fafc]"
          onClick={() => updateCall("waiting", "Receiver unavailable.")}
          type="button"
        >
          Receiver unavailable
        </button>
      </div>
    </section>
  );
}

function transcriptStatusLabel({
  audioStatus,
  callState,
  runtimeStatus,
  transcriptStatus,
  transcriptText,
}: {
  audioStatus: ConnectCallAudioStatus;
  callState: RecipientCallState;
  runtimeStatus: string;
  transcriptStatus: string;
  transcriptText: string;
}) {
  if (transcriptText.trim()) return "";
  if (transcriptStatus === "capturing") return "Transcript chunks are processing.";
  if (transcriptStatus === "not_configured") return "Transcription is not configured in this environment.";
  if (transcriptStatus === "failed") return "Transcription failed for this call.";
  if (transcriptStatus === "deleted") return "Transcript was deleted after summary approval.";
  if (runtimeStatus.startsWith("chunk_uploaded:")) {
    const chunkMatch = runtimeStatus.match(/chunk:(\d+)/);
    const assembledMatch = runtimeStatus.match(/assembled:(\d+)/);
    const chunkLabel = chunkMatch ? `Chunk ${Number(chunkMatch[1]) + 1}` : "A transcript chunk";
    const assembledLength = assembledMatch ? Number(assembledMatch[1]) : 0;
    return assembledLength > 0
      ? `${chunkLabel} uploaded and stitched into the temporary transcript.`
      : `${chunkLabel} uploaded. Waiting for transcript text.`;
  }
  if (runtimeStatus === "chunk_uploaded") {
    return "A transcript chunk was uploaded. Waiting for transcript text.";
  }
  if (runtimeStatus === "not_configured") {
    return "Transcription is not configured in this environment.";
  }
  if (runtimeStatus.startsWith("chunk_failed:")) {
    return runtimeStatus.replace(/^chunk_failed:/, "");
  }
  if (runtimeStatus === "chunk_failed") return "A transcript chunk could not be saved.";
  if (runtimeStatus === "capture_started") {
    return "Transcript capture started. First text usually appears after about 35-45 seconds.";
  }
  if (callState === "connected" && audioStatus === "remote_audio") {
    return "Remote audio is arriving. Transcript capture should start now.";
  }
  if (callState === "connected") {
    return "Waiting for remote audio before transcript capture starts.";
  }
  if (callState === "ringing") return "Transcript capture starts after the call is answered and remote audio arrives.";
  return "";
}

function callNotesStatusLabel({
  callState,
  summaryStatus,
  summaryText,
  transcriptStatus,
  transcriptText,
}: {
  callState: RecipientCallState;
  summaryStatus: string;
  summaryText: string;
  transcriptStatus: string;
  transcriptText: string;
}) {
  if (summaryStatus === "approved" && summaryText.trim()) {
    return "The approved care summary is saved below.";
  }
  if (summaryText.trim()) {
    return "A draft care summary is ready for review.";
  }
  if (transcriptStatus === "deleted") {
    return "The temporary transcript was deleted after the care summary was approved.";
  }
  if (transcriptStatus === "failed" || transcriptStatus === "not_configured") {
    return "Call notes are not available yet. The call can still continue.";
  }
  if (transcriptText.trim()) {
    if (callState === "connected") {
      return "Temporary transcript text has been captured. A care summary will be prepared after the call ends.";
    }
    return "Care notes are being prepared from the temporary call transcript.";
  }
  if (callState === "ended") {
    return "Care summary is being prepared if enough care-relevant conversation was captured.";
  }
  if (callState === "connected") {
    return "Care notes will begin after enough call audio is captured.";
  }
  if (callState === "ringing") {
    return "Care notes start only after the call is answered.";
  }
  return "";
}

function Metric({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-[#d6e3f2] bg-[#f8fafc] p-3">
      <p className="text-xs font-black uppercase tracking-normal text-[#5f6e84]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-[#172f49]">{value}</p>
      <p className="mt-1 text-xs text-[#5f6e84]">{detail}</p>
    </div>
  );
}

function MiniStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d6e3f2] bg-[#f8fbff] px-4 py-3">
      <p className="text-sm font-black text-[#5f6e84]">{label}</p>
      <p className="mt-1 text-sm font-black text-[#172f49]">{value}</p>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" className="h-10 w-10" fill="none" viewBox="0 0 24 24">
      <path
        d="M6.6 3.8 8.9 3c.7-.2 1.4.1 1.7.8l1 2.4c.2.6.1 1.2-.4 1.7L10 9c.9 1.8 2.3 3.2 4 4l1.1-1.1c.5-.5 1.1-.6 1.7-.4l2.4 1c.7.3 1 1 .8 1.7l-.8 2.3c-.3.8-1 1.3-1.9 1.3C10.7 17.8 6 13.1 6 6.7c0-.9.5-1.7 1.3-1.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0m6 6v4m-4 0h8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m15 18-6-6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
