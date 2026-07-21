"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browserSupabase as supabase } from "../../../lib/platform/browserSupabase";

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
  groupMessagesByAppointment,
  type MessageGroup,
} from "../../../lib/connect/messaging/messageGrouping";
import { personHasAttachedReceiver } from "../../../lib/connect/messaging/receiverAttachment";
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
  browserReceiverPairingCodeReady,
  formatBrowserReceiverPairingCode,
} from "../../../lib/connect/receiverShell/browserPairing";
import { ReceiverSetupOverlay } from "../receiverSetupOverlay/ReceiverSetupOverlay";
import type { ReceiverSetupSection } from "../receiverSetupOverlay/types";
import { AppointmentMessageComposer } from "../../personal/messages/AppointmentMessageComposer";
import {
  connectCallsDeprecated,
  connectPollingIntervals,
  connectReceiverGuideDeprecated,
  recordConnectPollingRequest,
} from "../../../lib/connect/receiver/pollingPolicy";
import {
  allCarePlandFocusValue,
  readCarePlandFocusId,
  writeCarePlandFocusId,
} from "../../../lib/platform/focus";
import {
  adminItemsVisibilityChangedEvent,
  readShowAdminItemsPreference,
} from "../../../lib/platform/adminItemsVisibility";
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
  acknowledgedAt?: string;
  allowsCallbackRequest?: boolean;
  appointmentId?: string;
  appointmentStartsAt?: string;
  appointmentTitle?: string;
  audioArtifactId?: string;
  audioDurationMs?: number;
  audioMimeType?: string;
  audioUrl?: string;
  id?: string;
  body?: string;
  callbackRequestedAt?: string;
  createdAt?: string;
  from?: string;
  heardAt?: string;
  mainConnectUserPersonId?: string;
  messageType?: string;
  readAt?: string;
  receiverId?: string;
  requiresAcknowledgement?: boolean;
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
    receiverId?: string;
    state?: string;
    summaryStatus?: string;
    summaryText?: string;
    generatedSummaryText?: string;
    summaryApprovalDraftText?: string;
    transcriptStatus?: string;
    transcriptText?: string;
    updatedAt?: string;
  } | null;
  pendingSummaryReviewCount?: number;
  pendingSummaryReviews?: Array<{
    callId?: string;
    summaryStatus?: string;
    summaryText?: string;
    updatedAt?: string;
  }>;
  total?: number;
};

type CallPathDiagnostics = {
  checkedAt: string;
  endpointStatus: "checking" | "not_checked" | "ready" | "unavailable";
  error: string;
  hasTurnServer: boolean;
  iceServerCount: number;
  isSecureContext: boolean;
  microphoneApiAvailable: boolean;
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

type DashboardView = "connect" | "settings";
type MessageHistoryView = "timeline" | "appointment";
type SetupView = "people" | "receivers";
type ReceiverSetupLaunchOptions = {
  newReceiver?: boolean;
};
type ConnectPageViewState = {
  activeView?: DashboardView;
  scrollY?: number;
  setupView?: SetupView;
};
type RecipientCallState =
  | "waiting"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "declined";
type ConnectAskMessage = {
  body: string;
  role: "assistant" | "user";
};

const dashboardAudioPack = {
  ringback: "/connect/receiver/audio/in-call-ring.wav",
  sit: "/connect/receiver/audio/sit.wav",
  unavailable: "/connect/receiver/audio/number-not-available.mp3",
};

type PendingMessageRecording = {
  artifactId?: string;
  audioUrl?: string;
  clientAudioCaptureId: string;
  recording: ConnectAudioRecording;
  transcript: string;
  transcriptStatus: string;
};

type ReceiverSetupLink = {
  createdAt?: string;
  expiresAt?: string;
  setupCode?: string;
  setupUrl: string;
};

type CachedReceiverSetupLink = ReceiverSetupLink & {
  createdAt: string;
  receiverDeviceId: string;
};

type ReceiverGuideRect = {
  height: number;
  label: string;
  width: number;
  x: number;
  y: number;
};

type ReceiverGuideSession = {
  deviceProfile?: string;
  lastSeenAt: number;
  pageUrl?: string;
  receiverId: string;
  receiverSessionId: string;
  uiLayout?: string;
};

type ReceiverGuideState = {
  activeSessions?: ReceiverGuideSession[];
  receiverId: string;
};

const receiverGuideTargetStorageKey = "carepland-connect-guide-target";
const receiverGuideRectStorageKey = "carepland-connect-guide-rect";
const receiverLastPressStorageKey = "carepland-connect-last-press";
const selectedReceiverStorageKeyPrefix = "carepland-connect-selected-receiver";
const receiverSetupLinkCacheKeyPrefix = "carepland-connect-receiver-setup-link";
const receiverSetupLinkReuseMs = 10 * 60 * 1000;
const receiverGuideEndpoint = "/api/connect/receiver-guide";
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
  if (view === "people") return "Receiver User";
  return "Receiver Settings";
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

function connectMessageDeliveryLabel(message: ConnectMessage) {
  if (message.callbackRequestedAt) {
    return `Callback requested ${formatClockTime(message.callbackRequestedAt)}`;
  }
  if (message.acknowledgedAt) {
    return `Acknowledged ${formatClockTime(message.acknowledgedAt)}`;
  }
  if (message.readAt) return `Read ${formatClockTime(message.readAt)}`;
  if (message.heardAt) return `Heard ${formatClockTime(message.heardAt)}`;
  if (message.createdAt) return `Sent ${formatClockTime(message.createdAt)}`;
  return "Sent";
}

function messageBody(message: ConnectMessage) {
  return message.transcript || message.body || "No message body";
}

function messageSender(message: ConnectMessage, selectedPersonName: string) {
  return !message.from || message.from === "receiver_user"
    ? selectedPersonName
    : message.from;
}

function messageAppointmentLabel(message: ConnectMessage) {
  return (
    String(message.appointmentTitle || "").trim() ||
    (message.appointmentId ? "Appointment" : "General")
  );
}

function messageDirectionLabel(message: ConnectMessage, selectedPersonName: string) {
  const sender = messageSender(message, selectedPersonName);
  return `${sender} -> ${message.to || selectedPersonName}`;
}

function formatTimelineDayLabel(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

function formatTimelineDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(",", "");
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

function receiverUsesClassicCallBridge(receiver?: ConnectReceiverDevice | null) {
  const deviceProfile = String(
    (receiver as { deviceProfile?: string } | null | undefined)?.deviceProfile || ""
  ).toLowerCase();
  const receiverMode = String(receiver?.receiverMode || "").toLowerCase();

  return deviceProfile.includes("classic") || receiverMode === "classic_webview";
}

function receiverKey(device: ConnectReceiverDevice) {
  return device.id ?? device.receiverId ?? device.name ?? connectPrototypeReceiverId;
}

function receiverDisplayName(device?: ConnectReceiverDevice | null) {
  const explicitName = device?.locationLabel || device?.name;
  return explicitName || defaultReceiverDisplayName(device);
}

function receiverShortDisplayId(device?: ConnectReceiverDevice | null) {
  const id = (device?.receiverId || device?.id || "").trim();
  if (!id) return "";
  const compact = id.replace(/^receiver-/, "");
  return compact.length > 10 ? compact.slice(-10) : compact;
}

function defaultReceiverDisplayName(device?: ConnectReceiverDevice | null) {
  const shortId = receiverShortDisplayId(device);
  return shortId ? `Receiver ${shortId}` : "Receiver";
}

function selectedReceiverStorageKey(personId: string) {
  return `${selectedReceiverStorageKeyPrefix}:${personId || "default"}`;
}

function receiverSetupLinkCacheKey(receiverDeviceId: string) {
  return `${receiverSetupLinkCacheKeyPrefix}:${receiverDeviceId}`;
}

function readCachedReceiverSetupLink(receiverDeviceId: string) {
  if (typeof window === "undefined" || !receiverDeviceId) return null;

  try {
    const raw = window.sessionStorage.getItem(receiverSetupLinkCacheKey(receiverDeviceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedReceiverSetupLink>;
    if (
      parsed.receiverDeviceId !== receiverDeviceId ||
      !parsed.createdAt ||
      !parsed.setupUrl
    ) {
      return null;
    }

    const createdAtMs = Date.parse(parsed.createdAt);
    if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > receiverSetupLinkReuseMs) {
      window.sessionStorage.removeItem(receiverSetupLinkCacheKey(receiverDeviceId));
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      setupCode: parsed.setupCode,
      setupUrl: parsed.setupUrl,
    } satisfies ReceiverSetupLink;
  } catch {
    return null;
  }
}

function writeCachedReceiverSetupLink(receiverDeviceId: string, setupLink: ReceiverSetupLink) {
  if (typeof window === "undefined" || !receiverDeviceId || !setupLink.setupUrl) return;

  const cached = {
    ...setupLink,
    createdAt: setupLink.createdAt || new Date().toISOString(),
    receiverDeviceId,
  } satisfies CachedReceiverSetupLink;

  try {
    window.sessionStorage.setItem(
      receiverSetupLinkCacheKey(receiverDeviceId),
      JSON.stringify(cached)
    );
  } catch {
    // Cache failure should never block setup link creation.
  }
}

function readStickySelectedReceiverKey(personId: string) {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(selectedReceiverStorageKey(personId)) || "";
}

function writeStickySelectedReceiverKey(personId: string, receiverKeyValue: string) {
  if (typeof window === "undefined" || !receiverKeyValue) return;
  window.localStorage.setItem(selectedReceiverStorageKey(personId), receiverKeyValue);
}

function personName(person?: ConnectReceiverPerson) {
  return person?.displayName || "Main Receiver User";
}

function profileDisplayName(profile?: {
  display_name?: string | null;
  email?: string | null;
  family_name?: string | null;
  given_name?: string | null;
} | null) {
  const displayName = profile?.display_name?.trim();
  const fullName = [profile?.given_name, profile?.family_name]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");

  return displayName || fullName || profile?.email?.trim() || "";
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
    managedByHousehold: person?.managedByHousehold ?? undefined,
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

function MessageDevDetails({
  detailView,
  message,
  selectedReceiverId,
}: {
  detailView: boolean;
  message: ConnectMessage;
  selectedReceiverId: string;
}) {
  if (!detailView) return null;

  return (
    <div className="mt-5 grid gap-4 rounded-lg border border-dashed border-[#cbd9e7] bg-[#f8fafc] p-4 text-sm sm:grid-cols-3">
      <div>
        <strong className="block text-xs font-black uppercase text-[#5f6e84]">
          Transcript
        </strong>
        <span className="font-bold text-[#334155]">
          {statusLabel(message.transcriptStatus || "not_requested")}
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
      <div>
        <strong className="block text-xs font-black uppercase text-[#5f6e84]">
          Deliver
        </strong>
        <span className="font-bold text-[#334155]">
          {connectMessageDeliveryLabel(message)}
        </span>
      </div>
      <div className="sm:col-span-3">
        <strong className="block text-xs font-black uppercase text-[#5f6e84]">
          Receiver
        </strong>
        <span className="break-all font-bold text-[#334155]">
          {message.receiverId || selectedReceiverId}
        </span>
      </div>
      <div className="sm:col-span-3">
        <strong className="block text-xs font-black uppercase text-[#5f6e84]">
          Message ID
        </strong>
        <span className="break-all font-bold text-[#334155]">
          {message.id || "local"}
        </span>
      </div>
    </div>
  );
}

function CompactHistoryMessageRow({
  detailView,
  markMessageHeard,
  message,
  selectedPersonName,
  selectedReceiverId,
  showAppointment = true,
  showDate = true,
}: {
  detailView: boolean;
  markMessageHeard: (message: ConnectMessage) => Promise<void>;
  message: ConnectMessage;
  selectedPersonName: string;
  selectedReceiverId: string;
  showAppointment?: boolean;
  showDate?: boolean;
}) {
  return (
    <article className="border-t border-[#d6e3f2] py-3">
      <div className="grid gap-x-7 gap-y-1 sm:grid-cols-[88px_minmax(0,1fr)]">
        <time className="text-sm font-semibold text-[#5f6e84]">
          {formatClockTime(message.createdAt)}
        </time>
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-semibold text-[#5f6e84]">
            {showAppointment ? (
              <span className="text-base font-semibold text-[#173150]">
                {messageAppointmentLabel(message)}
              </span>
            ) : null}
            <span>{messageDirectionLabel(message, selectedPersonName)}</span>
          </p>
        </div>
        {showDate ? (
          <time className="text-sm font-semibold text-[#5f6e84]">
            {formatTimelineDate(message.createdAt)}
          </time>
        ) : (
          <span aria-hidden="true" className="hidden sm:block" />
        )}
        <div className="min-w-0">
          <p className="text-base leading-6 text-[#0f172a]">
            {messageBody(message)}
          </p>
          {message.audioUrl ? (
            <div className="mt-3 rounded-lg border border-[#d6e3f2] bg-[#f8fafc] p-3">
              <strong className="block text-xs font-semibold uppercase text-[#5f6e84]">
                Voice message
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
          <MessageDevDetails
            detailView={detailView}
            message={message}
            selectedReceiverId={selectedReceiverId}
          />
        </div>
      </div>
    </article>
  );
}

function TimelineMessageEvent({
  detailView,
  isFirstInDay,
  markMessageHeard,
  message,
  selectedPersonName,
  selectedReceiverId,
}: {
  detailView: boolean;
  isFirstInDay: boolean;
  markMessageHeard: (message: ConnectMessage) => Promise<void>;
  message: ConnectMessage;
  selectedPersonName: string;
  selectedReceiverId: string;
}) {
  return (
    <>
      {isFirstInDay ? (
        <h4 className="border-t border-[#d6e3f2] pt-4 text-lg font-semibold leading-tight text-[#173150]">
          {formatTimelineDayLabel(message.createdAt)}
        </h4>
      ) : null}
      <CompactHistoryMessageRow
        detailView={detailView}
        markMessageHeard={markMessageHeard}
        message={message}
        selectedPersonName={selectedPersonName}
        selectedReceiverId={selectedReceiverId}
      />
    </>
  );
}

function AppointmentCommunicationSummary({
  detailView,
  group,
  markMessageHeard,
  selectedPersonName,
  selectedReceiverId,
}: {
  detailView: boolean;
  group: MessageGroup<ConnectMessage>;
  markMessageHeard: (message: ConnectMessage) => Promise<void>;
  selectedPersonName: string;
  selectedReceiverId: string;
}) {
  const firstMessage = group.messages[0];
  const messageCount = group.messages.length;

  return (
    <section className="border-t border-[#d6e3f2] py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-2xl font-semibold leading-tight text-[#0f172a]">
            {group.label}
          </h4>
          {group.id !== "general" && group.sortDate ? (
            <p className="mt-1 text-sm font-semibold text-[#5f6e84]">
              {formatDateTime(group.sortDate)}
            </p>
          ) : null}
        </div>
        <p className="pt-1 text-base font-semibold text-[#345d83]">
          {messageCount} {messageCount === 1 ? "message" : "messages"}
        </p>
      </div>

      <div className="mt-3">
        {group.messages.map((message) => (
          <CompactHistoryMessageRow
            detailView={detailView}
            key={message.id ?? `${group.id}-${message.createdAt ?? message.body}`}
            markMessageHeard={markMessageHeard}
            message={message}
            selectedPersonName={selectedPersonName}
            selectedReceiverId={selectedReceiverId}
            showAppointment={false}
            showDate
          />
        ))}
      </div>
    </section>
  );
}

function readInitialReceiverSetupSection(): ReceiverSetupSection | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get("receiverSetup")?.trim();
  if (
    value === "start" ||
    value === "receiverUser" ||
    value === "install" ||
    value === "pair" ||
    value === "finish" ||
    value === "advancedAndroid" ||
    value === "settings"
  ) {
    return value;
  }
  if (value === "test") return "finish";
  if (value === "receiverContact") return "receiverUser";
  if (value === "advanced") return "advancedAndroid";
  if (value === "home") return "start";
  return value ? "start" : null;
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
  const [messageAppointmentId] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return new URLSearchParams(window.location.search).get("appointmentId")?.trim() ?? "";
  });
  const [messageContextPersonId] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return new URLSearchParams(window.location.search).get("personId")?.trim() ?? "";
  });
  const [messageAllowsCallbackRequest, setMessageAllowsCallbackRequest] =
    useState(true);
  const [messageRequiresAcknowledgement, setMessageRequiresAcknowledgement] =
    useState(true);
  const [actionPending, setActionPending] = useState<"call" | "message" | null>(null);
  const [connectTool, setConnectTool] = useState<"message" | "history">("message");
  const [activeView] = useState<DashboardView>("connect");
  const [setupView, setSetupView] = useState<SetupView>(
    initialConnectPageViewState?.setupView === "receivers" ? "receivers" : "people"
  );
  const [globalFocusId, setGlobalFocusId] = useState(() => {
    if (typeof window === "undefined") {
      return allCarePlandFocusValue;
    }

    return readCarePlandFocusId(window.localStorage);
  });
  const [connectTargetPersonId, setConnectTargetPersonId] = useState(messageContextPersonId);
  const [accountEmail, setAccountEmail] = useState("");
  const [authenticatedSenderName, setAuthenticatedSenderName] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedReceiverKey, setSelectedReceiverKey] = useState(connectPrototypeReceiverId);
  const [initialReceiverSetupSection] = useState<ReceiverSetupSection | null>(
    readInitialReceiverSetupSection
  );
  const [receiverSetupOpen, setReceiverSetupOpen] = useState(Boolean(initialReceiverSetupSection));
  const [receiverSetupSection, setReceiverSetupSection] = useState<ReceiverSetupSection>(
    initialReceiverSetupSection ?? "start"
  );
  const [receiverSetupSelectedReceiverKey, setReceiverSetupSelectedReceiverKey] =
    useState(selectedReceiverKey);
  const [receiverRenameOpen, setReceiverRenameOpen] = useState(false);
  const [receiverLabelDraft, setReceiverLabelDraft] = useState("");
  const [receiverLabelPending, setReceiverLabelPending] = useState(false);
  const [messageHistoryView, setMessageHistoryView] =
    useState<MessageHistoryView>("timeline");
  const [messageHistoryComposerOpen, setMessageHistoryComposerOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processingRecording, setProcessingRecording] = useState(false);
  const [pendingRecording, setPendingRecording] =
    useState<PendingMessageRecording | null>(null);
  const [detailView, setDetailView] = useState(true);
  const [showAdminItems, setShowAdminItems] = useState(true);
  const [recipientCallState, setRecipientCallState] =
    useState<RecipientCallState>("waiting");
  const [callAudioStatus, setCallAudioStatus] =
    useState<ConnectCallAudioStatus>("idle");
  const [callPathDiagnostics, setCallPathDiagnostics] = useState<CallPathDiagnostics>({
    checkedAt: "",
    endpointStatus: "not_checked",
    error: "",
    hasTurnServer: false,
    iceServerCount: 0,
    isSecureContext: false,
    microphoneApiAvailable: false,
  });
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
  const latestGuidePressRef = useRef(0);
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

  const refreshCallPathDiagnostics = useCallback(async () => {
    if (connectCallsDeprecated) return;
    const browserBasics = readBrowserCallPathBasics();
    setCallPathDiagnostics((current) => ({
      ...current,
      ...browserBasics,
      endpointStatus: "checking",
      error: "",
    }));

    try {
      const response = await fetch("/api/connect/calls/ice-config", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`ICE endpoint returned ${response.status}`);
      }

      const payload = (await response.json().catch(() => ({}))) as {
        iceServers?: RTCIceServer[];
      };
      const iceServers = Array.isArray(payload.iceServers)
        ? payload.iceServers.filter(isCallPathIceServer)
        : [];
      setCallPathDiagnostics({
        ...browserBasics,
        checkedAt: new Date().toISOString(),
        endpointStatus: iceServers.length > 0 ? "ready" : "unavailable",
        error: iceServers.length > 0 ? "" : "ICE endpoint returned no usable servers.",
        hasTurnServer: iceServers.some(callPathIceServerUsesTurn),
        iceServerCount: iceServers.length,
      });
    } catch (error) {
      setCallPathDiagnostics({
        ...browserBasics,
        checkedAt: new Date().toISOString(),
        endpointStatus: "unavailable",
        error: error instanceof Error ? error.message : "ICE endpoint could not be reached.",
        hasTurnServer: false,
        iceServerCount: 0,
      });
    }
  }, []);

  const stopCallCue = useCallback(() => {
    if (callTimeoutRef.current) {
      window.clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    callCueRef.current?.pause();
    callCueRef.current = null;
  }, []);

  const stopLiveCallAudio = useCallback((options: { notifyPeer?: boolean } = {}) => {
    const notifyPeer = options.notifyPeer ?? true;
    if (activeCallIdRef.current && mainConnectUserPersonIdRef.current) {
      recordConnectCallLifecycleEvent({
        actorRole: "dashboard",
        callId: activeCallIdRef.current,
        connectAuthHeaders,
        details: {
          callAudioStatus: callAudioStatusRef.current,
          notifyPeer,
          source: "dashboard_stop_live_call_audio",
        },
        eventType: "call_ui_audio_cleanup_requested",
        mainConnectUserPersonId: mainConnectUserPersonIdRef.current,
      });
    }
    liveCallAudioRef.current?.stop({ notifyPeer });
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
        logDashboardCallEvent(activeCallId, "call_dashboard_ring_timeout_observed", {
          callAudioStatus: callAudioStatusRef.current,
          latestCallAudioState: latestCallAudioStateRef.current,
          source: "playCallRingback",
        });
      }
      setStatus("Still waiting for the receiver to answer.");
    }, 15000);
  }, [stopCallCue]);

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
          headers: authHeaders,
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
      const [messagesResult, audioProfileResult] =
        await Promise.allSettled([
          scopedParticipantId
          ? fetchJson<{ messages?: ConnectMessage[] }>(
              `${connectMessagesEndpoint}?personId=${encodeURIComponent(scopedParticipantId)}`,
              { headers: authHeaders }
            )
          : Promise.resolve({ messages: [] }),
          scopedParticipantId
          ? fetchJson<{ profile?: ConnectAudioProfile }>(
              `${connectAudioProfileEndpoint}?personId=${encodeURIComponent(scopedParticipantId)}`,
              { headers: authHeaders }
            )
          : Promise.resolve({ profile: null }),
        ]);
      const messagesBody = settledValue(messagesResult);
      const audioProfileBody = settledValue(audioProfileResult);
      const failedCount = [
        contextResult,
        focusPeopleResult,
        provisioningResult,
        messagesResult,
        audioProfileResult,
      ].filter((result) => result.status === "rejected").length;

      setState({
        audioProfile: audioProfileBody?.profile ?? null,
        callSummary: null,
        connectContext,
        focusPeople,
        messages: messagesBody?.messages ?? [],
        provisioning: provisioning ?? null,
        receiversOnline: countOnlineProvisionedReceivers(provisioning),
      });
      setStatus(
        contextResult.status === "rejected"
          ? "Sign in to CarePland Personal to load your Receiver users."
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
    if (connectCallsDeprecated) return;
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
      if (latestState === "answered") {
        latestCallAudioStateRef.current = latestState;
        stopCallCue();
        setRecipientCallState("connecting");
      }
      if (latestState === "connected") {
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
        stopLiveCallAudio({ notifyPeer: false });
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
        stopLiveCallAudio({ notifyPeer: false });
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
    if (activeView !== "connect") return;
    const timer = window.setTimeout(() => {
      void refreshCallPathDiagnostics();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeView, refreshCallPathDiagnostics]);

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
    if (connectCallsDeprecated) return undefined;

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
        .select("display_name,email,family_name,given_name,is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setIsAdmin(profile?.is_admin === true);
        setAuthenticatedSenderName(profileDisplayName(profile) || user.email || "");
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
      stopLiveCallAudio({ notifyPeer: false });
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

  useEffect(() => {
    if (!activeConnectPersonId || activeDevices.length === 0) return;
    if (activeDevices.some((device) => receiverKey(device) === selectedReceiverKey)) return;

    const stickyKey = readStickySelectedReceiverKey(activeConnectPersonId);
    const nextReceiverKey =
      stickyKey && activeDevices.some((device) => receiverKey(device) === stickyKey)
        ? stickyKey
        : receiverKey(activeDevices[0]);

    const timer = window.setTimeout(() => {
      setSelectedReceiverKey(nextReceiverKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeConnectPersonId, activeDevices, selectedReceiverKey]);

  useEffect(() => {
    if (!activeConnectPersonId) return;
    if (!activeDevices.some((device) => receiverKey(device) === selectedReceiverKey)) return;
    writeStickySelectedReceiverKey(activeConnectPersonId, selectedReceiverKey);
  }, [activeConnectPersonId, activeDevices, selectedReceiverKey]);

  const selectedReceiverMatch = activeDevices.find(
    (device) => receiverKey(device) === selectedReceiverKey
  );
  const selectedReceiver = selectedReceiverMatch ?? activeDevices[0];

  const selectedReceiverLabel =
    selectedReceiverMatch || selectedReceiver
      ? receiverDisplayName(selectedReceiverMatch ?? selectedReceiver)
      : selectedReceiverKey && selectedReceiverKey !== connectPrototypeReceiverId
        ? selectedReceiverKey
        : "Receiver";
  const selectedReceiverId =
    selectedReceiver?.id || selectedReceiver?.receiverId || connectPrototypeReceiverId;
  const selectedReceiverContactName =
    selectedReceiver?.receiverContactDisplayName?.trim() || "Receiver contact";
  const selectedReceiverUsesClassicCallBridge =
    receiverUsesClassicCallBridge(selectedReceiver);
  const selectedReceiverGuideId = selectedReceiverMatch
    ? receiverKey(selectedReceiverMatch)
    : selectedReceiverKey || selectedReceiverId;
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
  const selectedPersonHasReceiver = personHasAttachedReceiver(
    activeDevices,
    selectedMainConnectUserPersonId
  );
  const visibleMessages = state.messages;
  const appointmentMessageGroups = useMemo(
    () => groupMessagesByAppointment(state.messages),
    [state.messages]
  );
  const canShowAdminItems = isAdmin && showAdminItems;
  const devViewEnabled = canShowAdminItems && detailView;
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

  useEffect(() => {
    function syncShowAdminItems() {
      setShowAdminItems(readShowAdminItemsPreference());
    }

    const timer = window.setTimeout(syncShowAdminItems, 0);
    window.addEventListener(adminItemsVisibilityChangedEvent, syncShowAdminItems);
    window.addEventListener("storage", syncShowAdminItems);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(adminItemsVisibilityChangedEvent, syncShowAdminItems);
      window.removeEventListener("storage", syncShowAdminItems);
    };
  }, []);

  useEffect(() => {
    if (!receiverRenameOpen) {
      const timer = window.setTimeout(() => {
        setReceiverLabelDraft(selectedReceiverLabel);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [receiverRenameOpen, selectedReceiverLabel, selectedReceiverId]);

  function handleChangeGlobalFocus(focusId: string) {
    const nextFocusId = focusId || allCarePlandFocusValue;

    setGlobalFocusId(nextFocusId);
    setConnectTargetPersonId("");

    if (typeof window !== "undefined") {
      writeCarePlandFocusId(window.localStorage, nextFocusId);
    }

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
    setStatus(
      `Ready for ${firstNameLabel(person.displayName) || person.displayName}.`
    );
  }

  function openProfileSettings() {
    window.location.assign("/?personal=1&profile=1");
  }

  function openReceiverSetup(
    section: ReceiverSetupSection = "start",
    options?: ReceiverSetupLaunchOptions
  ) {
    setReceiverSetupSelectedReceiverKey(options?.newReceiver ? "" : selectedReceiverKey);
    setReceiverSetupSection(section);
    setReceiverSetupOpen(true);
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
            ? `Contact ${selectedReceiverContactName}`
            : parsed.target === "ask"
              ? "Ask a question"
              : parsed.target === "contact"
                ? "People"
                : "a receiver control";
      setStatus(`${selectedPersonName} pressed ${targetLabel}.`);
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [selectedPersonName, selectedReceiverContactName]);

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
    stopLiveCallAudio({ notifyPeer: false });
    activeCallIdRef.current = callId;
    const controller = createConnectCallAudioController({
      callId,
      connectAuthHeaders,
      mainConnectUserPersonId: selectedMainConnectUserPersonId,
      onConnected: () => {
        stopCallCue();
        setRecipientCallState("connected");
        setStatus(`Connected with ${selectedPersonName}.`);
        void reportDashboardCallState("connected", {
          callId,
          refreshAfter: false,
          source: "dashboard_audio_connected",
        });
      },
      onError: (message) => setStatus(message),
      onPeerEnded: () => {
        logDashboardCallEvent(callId, "call_dashboard_peer_ended_received", {
          callAudioStatus: callAudioStatusRef.current,
          source: "audio_controller_onPeerEnded",
        });
        setStatus(`${selectedPersonName} ended the call.`);
        setRecipientCallState("ended");
        stopCallCue();
        liveCallAudioRef.current = null;
        setCallMuted(false);
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

  async function saveSelectedReceiverLabel() {
    if (!selectedReceiver?.id) {
      setStatus("Select a paired Receiver before renaming it.");
      return;
    }

    const nextLabel = receiverLabelDraft.trim();
    if (!nextLabel) {
      setStatus("Enter a Receiver name.");
      return;
    }

    setReceiverLabelPending(true);
    setStatus(`Saving ${nextLabel}...`);
    try {
      const response = await fetch(
        `/api/connect/provisioning/receiver-devices/${encodeURIComponent(selectedReceiver.id)}`,
        {
          body: JSON.stringify({
            confirmedPrototypeWrite: true,
            locationLabel: nextLabel,
            operationReason: `Updated receiver label to ${nextLabel}.`,
          }),
          headers: {
            ...(await connectAuthHeaders()),
            "Content-Type": "application/json",
          },
          method: "PATCH",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Receiver update returned ${response.status}`);
      }

      setState((current) => ({
        ...current,
        provisioning: current.provisioning
          ? {
              ...current.provisioning,
              receiverDevices: current.provisioning.receiverDevices?.map((device) =>
                device.id === selectedReceiver.id
                  ? { ...device, locationLabel: nextLabel, name: nextLabel }
                  : device
              ),
            }
          : current.provisioning,
      }));
      setReceiverRenameOpen(false);
      setStatus(`${nextLabel} saved.`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Receiver could not be renamed.");
    } finally {
      setReceiverLabelPending(false);
    }
  }

  async function startCall() {
    if (connectCallsDeprecated) {
      setStatus("Connect calls are currently paused while this feature is refined.");
      return;
    }
    if (!selectedMainConnectUserPersonId) {
      setStatus(`${selectedPersonName} is not enabled for Connect calls yet.`);
      return;
    }

    setActionPending("call");
    setStatus(`Calling ${selectedPersonName} on ${selectedReceiverLabel}...`);
    setRecipientCallState("ringing");
    setCallTranscriptRuntimeStatus("");
    playCallRingback();
    try {
      const callResponse = await fetchJson<{
        call?: { callId?: string };
        ok?: boolean;
      }>(connectCallsEndpoint, {
        body: JSON.stringify({
          callerName: authenticatedSenderName || "CarePland coordinator",
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
        const optimisticCall = {
          callId: callResponse.call.callId,
          callerName: authenticatedSenderName || "CarePland coordinator",
          recipientName: selectedPersonName,
          receiverId: selectedReceiverId,
          state: "ringing",
          updatedAt: new Date().toISOString(),
        };
        setState((current) => ({
          ...current,
          callSummary: {
            ...(current.callSummary ?? {}),
            active: Math.max(1, current.callSummary?.active ?? 0),
            byState: {
              ...(current.callSummary?.byState ?? {}),
              ringing: Math.max(1, current.callSummary?.byState?.ringing ?? 0),
            },
            latestCall: optimisticCall,
            total: Math.max(1, current.callSummary?.total ?? 0),
          },
        }));
        logDashboardCallEvent(callResponse.call.callId, "call_dashboard_call_created", {
          source: "startCall",
        });
        if (selectedReceiverUsesClassicCallBridge) {
          setCallAudioStatus("idle");
          setCallTranscriptRuntimeStatus("classic_receiver_bridge");
          logDashboardCallEvent(
            callResponse.call.callId,
            "call_dashboard_classic_receiver_bridge_selected",
            {
              receiverId: selectedReceiverId,
              source: "startCall",
            }
          );
        } else {
          startDashboardCallAudio(callResponse.call.callId);
        }
      }
      setStatus(
        selectedReceiverUsesClassicCallBridge
          ? `Call sent to ${selectedPersonName} on ${selectedReceiverLabel}. Tap Answer on that Receiver.`
          : `Call sent to ${selectedPersonName} on ${selectedReceiverLabel}.`
      );
      await refreshCallState();
    } catch (error) {
      stopLiveCallAudio({ notifyPeer: false });
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
        stopLiveCallAudio({ notifyPeer: false });
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
      stopLiveCallAudio({ notifyPeer: false });
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
            appointmentId: messageAppointmentId,
            audioArtifactId: pendingRecording.artifactId,
            audioBase64: await blobToBase64(pendingRecording.recording.blob),
            audioDirection: "coordinator_to_receiver",
            audioDurationMs: pendingRecording.recording.durationMs,
            audioMimeType: pendingRecording.recording.mimeType,
            audioUrl: pendingRecording.audioUrl,
            body: body || pendingRecording.transcript || "Voice message",
            allowsCallbackRequest: messageAllowsCallbackRequest,
            captureContext: createConnectAudioCaptureContext(
              pendingRecording.recording,
              {
                artifactKind: "coordinator_message",
                audioDirection: "coordinator_to_receiver",
                clientAudioCaptureId: pendingRecording.clientAudioCaptureId,
                role: authenticatedSenderName || "CarePland coordinator",
                surface: "coordinator_message_composer",
              }
            ),
            clientAudioCaptureId: pendingRecording.clientAudioCaptureId,
            clientMessageId,
            from: authenticatedSenderName || "CarePland coordinator",
            mainConnectUserPersonId: selectedMainConnectUserPersonId,
            messageType: "audio",
            receiverId: selectedReceiverId,
            requiresAcknowledgement: messageRequiresAcknowledgement,
            source: "coordinator_audio_message",
            to: selectedPersonName,
          }
        : {
            allowsCallbackRequest: messageAllowsCallbackRequest,
            appointmentId: messageAppointmentId,
            body,
            clientMessageId,
            from: authenticatedSenderName || "CarePland coordinator",
            mainConnectUserPersonId: selectedMainConnectUserPersonId,
            messageType: "text",
            receiverId: selectedReceiverId,
            requiresAcknowledgement: messageRequiresAcknowledgement,
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
            role: authenticatedSenderName || "CarePland coordinator",
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

  function chooseGuidePreviewTarget(
    highlight: ReceiverGuideRect,
    targetReceiverSessionId?: string
  ) {
    if (!guideMode) return;
    window.localStorage.removeItem(receiverGuideTargetStorageKey);
    window.localStorage.setItem(receiverGuideRectStorageKey, JSON.stringify(highlight));
    void publishReceiverGuideHighlight(
      selectedReceiverGuideId,
      highlight,
      targetReceiverSessionId
    );
    setStatus(`Pointing to ${highlight.label} on ${selectedReceiverLabel}.`);
  }

  async function publishReceiverGuideHighlight(
    receiverId: string,
    highlight: ReceiverGuideRect,
    targetReceiverSessionId?: string
  ) {
    await fetch(receiverGuideEndpoint, {
      body: JSON.stringify({ receiverId, rect: highlight, targetReceiverSessionId }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  }

  useEffect(() => {
    // Receiver Guide is deprecated. Leave state-writing helpers intact for a
    // future opt-in implementation, but do not poll while the feature is parked.
    if (connectReceiverGuideDeprecated) return undefined;
    if (!guideMode) return undefined;
    let cancelled = false;

    async function pollReceiverGuideState() {
      try {
        recordConnectPollingRequest({
          caller: "connect_dashboard_guide_feedback",
          endpoint: receiverGuideEndpoint,
          reason: "poll",
        });
        const response = await fetch(
          `${receiverGuideEndpoint}?receiverId=${encodeURIComponent(selectedReceiverGuideId)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          guide?: { lastPress?: { label?: string; pressedAt?: number } };
        };
        const lastPress = payload.guide?.lastPress;
        const pressedAt = Number(lastPress?.pressedAt || 0);

        if (!cancelled && pressedAt && pressedAt > latestGuidePressRef.current) {
          latestGuidePressRef.current = pressedAt;
          setStatus(
            `${selectedPersonName} pressed ${lastPress?.label || "a receiver control"}.`
          );
        }
      } catch {
        // Guide feedback is best-effort and should never interrupt the dashboard.
      }
    }

    void pollReceiverGuideState();
    const timer = window.setInterval(() => {
      void pollReceiverGuideState();
    }, connectPollingIntervals.dashboardGuideFeedbackMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [guideMode, selectedPersonName, selectedReceiverGuideId]);

  async function clearPublishedReceiverGuide(receiverId: string) {
    await fetch(receiverGuideEndpoint, {
      body: JSON.stringify({ action: "clear", receiverId }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
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
        assistantMessage?: string;
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
            // SECURITY/CORRECTNESS: the API returns `assistantMessage`, not
            // `assistantResponse` -- this field name mismatch previously
            // meant this fallback text ran on every single reply, even when
            // the AI had produced a real answer.
            result.assistantMessage ||
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
        </header>

      {activeView === "connect" ? (
        <section className="grid w-full gap-5 px-2 pt-2 pb-5 sm:px-4 sm:pt-3 lg:px-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
	                <button
	                  aria-expanded={messageHistoryComposerOpen}
                  className={`min-h-10 rounded-full border px-4 text-sm font-black shadow-sm transition ${
                    messageHistoryComposerOpen
                      ? "border-blue-200 bg-blue-50 text-blue-900"
                      : "border-[#d6e3f2] bg-white text-[#173150] hover:bg-[#f8fafc]"
                  }`}
	                  disabled={!selectedPersonHasReceiver}
	                  onClick={() => {
	                    if (!selectedPersonHasReceiver) return;
	                    setMessageHistoryComposerOpen((isOpen) => !isOpen);
	                  }}
	                  title={
	                    selectedPersonHasReceiver
	                      ? "New Message"
	                      : "Set up Receiver before sending messages"
	                  }
	                  type="button"
	                >
	                  New Message
	                </button>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div
                    aria-label="Message history view"
                    className="inline-flex min-h-10 overflow-hidden rounded-full border border-[#d6e3f2] bg-white p-1 shadow-sm"
                    role="group"
                  >
                    {([
                      ["timeline", "Timeline"],
                      ["appointment", "By Appointment"],
                    ] as const).map(([view, label]) => (
                      <button
                        aria-pressed={messageHistoryView === view}
                        className={`rounded-full px-4 py-1.5 text-sm font-black transition ${
                          messageHistoryView === view
                            ? "bg-[#edf5fc] text-[#173150]"
                            : "text-[#5f6e84] hover:bg-[#f8fafc] hover:text-[#345d83]"
                        }`}
                        key={view}
                        onClick={() => {
                          setMessageHistoryView(view);
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="min-h-10 rounded-md bg-transparent px-2 text-lg font-black text-[#5f6e84] hover:text-[#345d83] disabled:opacity-55"
                    disabled={loading}
                    onClick={() => void refresh()}
                    type="button"
                  >
                    Refresh
                  </button>
                  {canShowAdminItems ? (
                    <label className="flex min-h-10 items-center gap-2 rounded-md bg-transparent px-1 text-lg font-black text-[#5f6e84]">
                      <input
                        checked={detailView}
                        onChange={(event) => setDetailView(event.target.checked)}
                        type="checkbox"
                      />
                      Dev View
                    </label>
                  ) : null}
                </div>
              </div>
	              {messageHistoryComposerOpen && selectedPersonHasReceiver ? (
	                <div className="mt-4">
	                  <AppointmentMessageComposer
                    onCancel={() => setMessageHistoryComposerOpen(false)}
                    onSent={async () => {
                      setMessageHistoryComposerOpen(false);
                      await refresh();
                    }}
                    personId={selectedMainConnectUserPersonId}
                    recipientName={selectedPersonName}
                    senderName={authenticatedSenderName || "CarePland coordinator"}
                  />
	                </div>
	              ) : null}
	              {!selectedPersonHasReceiver ? (
	                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-800">
	                  Set up Receiver for {selectedPersonName} before sending messages.
	                </p>
	              ) : null}
              {messageHistoryView === "timeline" && visibleMessages.length ? (
                <div className="mt-5">
                  {visibleMessages.map((message, index) => (
                    <TimelineMessageEvent
                      detailView={devViewEnabled}
                      isFirstInDay={
                        index === 0 ||
                        formatTimelineDayLabel(message.createdAt) !==
                          formatTimelineDayLabel(visibleMessages[index - 1]?.createdAt)
                      }
                      key={message.id ?? `${message.from}-${message.createdAt ?? message.body}`}
                      markMessageHeard={markMessageHeard}
                      message={message}
                      selectedPersonName={selectedPersonName}
                      selectedReceiverId={selectedReceiverId}
                    />
                  ))}
                </div>
              ) : messageHistoryView === "appointment" && appointmentMessageGroups.length ? (
                <div className="mt-5">
                  {appointmentMessageGroups.map((group) => (
                    <AppointmentCommunicationSummary
                      detailView={devViewEnabled}
                      group={group}
                      key={group.id}
                      markMessageHeard={markMessageHeard}
                      selectedPersonName={selectedPersonName}
                      selectedReceiverId={selectedReceiverId}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-xl font-black text-[#5f6e84]">
                  {selectedMainConnectUserPersonId
                    ? "No receiver messages yet."
                    : `${selectedPersonName} is not enabled for Connect messages yet.`}
                </p>
              )}
            </div>
        </section>
      ) : (
        <ConnectSettingsView
          activeDevices={activeDevices}
          activeMainConnectUserPersonId={selectedMainConnectUserPersonId}
          canShowAdminItems={canShowAdminItems}
          households={households}
          onOpenReceiverSetup={openReceiverSetup}
          onRefresh={refresh}
          selectedReceiverKey={selectedReceiverKey}
          setSelectedReceiverKey={setSelectedReceiverKey}
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
      <ReceiverSetupOverlay
        activeDevices={activeDevices}
        connectContext={state.connectContext}
        initialSection={receiverSetupSection}
        onClose={() => setReceiverSetupOpen(false)}
        onRefresh={refresh}
        open={receiverSetupOpen}
        selectedReceiverKey={receiverSetupSelectedReceiverKey}
      />
      <UserFacingFooter
        onWhyCarePland={() => {
          window.location.assign("/?personal=1");
        }}
      />
    </main>
  );
}

export function ConnectProfileSettingsPanel({
  canShowAdminItems = false,
  setupView,
}: {
  canShowAdminItems?: boolean;
  setupView: "people" | "receivers";
}) {
  const [state, setState] = useState<DashboardState>(emptyDashboardState);
  const [status, setStatus] = useState("Loading receiver settings...");
  const [selectedReceiverKey, setSelectedReceiverKey] = useState(connectPrototypeReceiverId);
  const [receiverSetupOpen, setReceiverSetupOpen] = useState(false);
  const [receiverSetupSection, setReceiverSetupSection] =
    useState<ReceiverSetupSection>("start");
  const [receiverSetupSelectedReceiverKey, setReceiverSetupSelectedReceiverKey] =
    useState(selectedReceiverKey);

  const refresh = useCallback(async () => {
    setStatus("Refreshing receiver settings...");
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
          headers: authHeaders,
          includeInactiveHouseholds: true,
        }),
      ]);
      const connectContext = settledValue(contextResult);
      const focusPeople = (settledValue(focusPeopleResult) ?? []).filter(
        (person) => !isConnectPetSubjectType(person.subjectType)
      );
      const provisioning = settledValue(provisioningResult);
      const activeMainConnectUserPersonId =
        connectContext?.mainConnectUserPersonId || focusPeople[0]?.id || "";
      const audioProfileResult = activeMainConnectUserPersonId
        ? await fetchJson<{ profile?: ConnectAudioProfile }>(
            `${connectAudioProfileEndpoint}?personId=${encodeURIComponent(
              activeMainConnectUserPersonId
            )}`,
            { headers: await connectAuthHeaders() }
          ).catch(() => null)
        : null;
      const failedCount = [
        contextResult,
        focusPeopleResult,
        provisioningResult,
      ].filter((result) => result.status === "rejected").length;

      setState({
        audioProfile: audioProfileResult?.profile ?? null,
        callSummary: null,
        connectContext,
        focusPeople,
        messages: [],
        provisioning: provisioning ?? null,
        receiversOnline: countOnlineProvisionedReceivers(provisioning),
      });
      setStatus(
        contextResult.status === "rejected"
          ? "Sign in to CarePland Personal to load receiver settings."
          : failedCount
            ? "Ready. Some receiver settings data is still loading."
            : "Ready."
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Receiver settings are unavailable."
      );
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

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
  const activeMainConnectUserPersonId =
    state.connectContext?.mainConnectUserPersonId ||
    state.focusPeople[0]?.id ||
    "";

  useEffect(() => {
    if (!activeMainConnectUserPersonId || activeDevices.length === 0) return;
    if (activeDevices.some((device) => receiverKey(device) === selectedReceiverKey)) return;

    const stickyKey = readStickySelectedReceiverKey(activeMainConnectUserPersonId);
    const nextReceiverKey =
      stickyKey && activeDevices.some((device) => receiverKey(device) === stickyKey)
        ? stickyKey
        : receiverKey(activeDevices[0]);

    const timer = window.setTimeout(() => {
      setSelectedReceiverKey(nextReceiverKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeDevices, activeMainConnectUserPersonId, selectedReceiverKey]);

  useEffect(() => {
    if (!activeMainConnectUserPersonId) return;
    if (!activeDevices.some((device) => receiverKey(device) === selectedReceiverKey)) return;
    writeStickySelectedReceiverKey(activeMainConnectUserPersonId, selectedReceiverKey);
  }, [activeDevices, activeMainConnectUserPersonId, selectedReceiverKey]);

  return (
    <>
      <ConnectSettingsView
        activeDevices={activeDevices}
        activeMainConnectUserPersonId={activeMainConnectUserPersonId}
        canShowAdminItems={canShowAdminItems}
        households={households}
        onOpenReceiverSetup={(section = "start", options?: ReceiverSetupLaunchOptions) => {
          setReceiverSetupSelectedReceiverKey(options?.newReceiver ? "" : selectedReceiverKey);
          setReceiverSetupSection(section);
          setReceiverSetupOpen(true);
        }}
        onRefresh={refresh}
        selectedReceiverKey={selectedReceiverKey}
        setSelectedReceiverKey={setSelectedReceiverKey}
        setupView={setupView}
        setSetupView={() => undefined}
        state={state}
        status={status}
      />
      <ReceiverSetupOverlay
        activeDevices={activeDevices}
        connectContext={state.connectContext}
        initialSection={receiverSetupSection}
        onClose={() => setReceiverSetupOpen(false)}
        onRefresh={refresh}
        open={receiverSetupOpen}
        selectedReceiverKey={receiverSetupSelectedReceiverKey}
      />
    </>
  );
}

function ConnectPersonAvatar({
  person,
  selected = false,
  size = "md",
}: {
  person?: ConnectAvatarPerson | null;
  selected?: boolean;
  size?: "2xs" | "lg" | "md" | "sm" | "xs";
}) {
  const sizeClass =
    size === "lg"
      ? "h-20 w-20 text-3xl"
      : size === "sm"
        ? "h-12 w-12 text-base"
        : size === "2xs"
          ? "h-[22px] w-[22px] text-[10px]"
        : size === "xs"
          ? "h-7 w-7 text-[10px]"
          : "h-14 w-14 text-lg";
  const emojiClass =
    size === "lg"
      ? "text-5xl leading-none"
      : size === "sm"
        ? "text-3xl leading-none"
        : size === "2xs"
          ? "text-sm leading-none"
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
                : size === "2xs"
                  ? "22px"
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
  canShowAdminItems,
  households,
  onOpenReceiverSetup,
  onRefresh,
  selectedReceiverKey,
  setSelectedReceiverKey,
  setupView,
  setSetupView,
  state,
  status,
}: {
  activeDevices: ConnectReceiverDevice[];
  activeMainConnectUserPersonId: string;
  canShowAdminItems: boolean;
  households: ConnectReceiverHousehold[];
  onOpenReceiverSetup: (
    section?: ReceiverSetupSection,
    options?: ReceiverSetupLaunchOptions
  ) => void;
  onRefresh: () => Promise<void>;
  selectedReceiverKey: string;
  setSelectedReceiverKey: (value: string) => void;
  setupView: SetupView;
  setSetupView: (value: SetupView) => void;
  state: DashboardState;
  status: string;
}) {
  const [primaryReceiverStatus, setPrimaryReceiverStatus] = useState("Ready.");
  return (
    <section className="min-h-[calc(100vh-86px)] bg-[#f4f8fc]">
      <main className="px-2 py-5 sm:px-4 lg:px-6">
        {setupView === "people" ? (
          <section className="max-w-[940px] rounded-lg border border-[#d6e3f2] bg-white p-6 shadow-sm">
            <PrimaryReceiverUserPanel
              currentPersonId={state.connectContext?.mainConnectUserPersonId ?? ""}
              onRefresh={onRefresh}
              people={state.connectContext?.people ?? []}
              setStatus={setPrimaryReceiverStatus}
              status={primaryReceiverStatus}
            />
          </section>
        ) : (
          <section className="max-w-[1040px] space-y-4">
            <SetupPanel
              activeDevices={activeDevices}
              activeMainConnectUserPersonId={activeMainConnectUserPersonId}
              canShowAdminItems={canShowAdminItems}
              households={households}
              onOpenReceiverSetup={onOpenReceiverSetup}
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
        <p className="mx-auto mt-6 max-w-[1040px] px-1 text-center text-sm font-bold leading-snug text-[#5f6e84]">
          Trust boundary: No hidden listening. No recording by default. Every request is named,
          authorized, and logged.
        </p>
      </main>
    </section>
  );
}

function PrimaryReceiverUserPanel({
  currentPersonId,
  onRefresh,
  people,
  setStatus,
  status,
}: {
  currentPersonId: string;
  onRefresh: () => Promise<void>;
  people: ConnectPersPerson[];
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
        person ? firstNameLabel(person.displayName) || "Main Receiver User" : "Main Receiver User"
      }...`
    );

    try {
      await updateConnectMainUserContext({ mainConnectUserPersonId: personId });
      await onRefresh();
      setStatus(
        person
          ? `Ready. ${firstNameLabel(person.displayName) || "Main Receiver User"} is primary.`
          : "Ready."
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Main Receiver User could not be saved."
      );
    } finally {
      setSavingPersonId("");
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-2xl font-black text-[#172f49]">Main Receiver User</h3>
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
    ? "Main Receiver User"
    : "Choose a Main Receiver User";
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
      setProfileStatus("Choose a Main Receiver User before running person diagnostics.");
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
            : "Choose a Main Receiver User to load scoped audio tuning."}
        </p>
        <p className="rounded-lg border border-[#cbd9e7] bg-white px-3 py-2 text-sm font-black text-[#172f49]">
          {selectedPersonLabel}
        </p>
      </div>
      {!hasScopedPerson ? (
        <p className="mt-4 rounded-lg border border-[#d6e3f2] bg-[#f8fbff] px-4 py-3 text-sm font-black text-[#5f6e84]">
          Choose a Main Receiver User to view scoped audio profile diagnostics.
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
                No scoped playback review items loaded for the Main Receiver User.
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
  receiverLabel,
}: {
  activeDevices: ConnectReceiverDevice[];
  receiverLabel: string;
}) {
  const groups = [
    {
      items: ["Main Receiver User Care Circle", "Membership verified by CarePland access"],
      title: "Care circle",
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
      setDiagnosticStatus("Choose a Main Receiver User before running person diagnostics.");
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
          Main Receiver User audio checks
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
  canShowAdminItems,
  households,
  onOpenReceiverSetup,
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
  canShowAdminItems: boolean;
  households: ConnectReceiverHousehold[];
  onOpenReceiverSetup: (
    section?: ReceiverSetupSection,
    options?: ReceiverSetupLaunchOptions
  ) => void;
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
  const [setupStatus, setSetupStatus] = useState("Ready.");
  const [receiverActionPending, setReceiverActionPending] = useState<string | null>(null);
  const [receiverPairingCode, setReceiverPairingCode] = useState("");
  const [receiverPairingPending, setReceiverPairingPending] = useState(false);
  const [savingReceiverUserId, setSavingReceiverUserId] = useState("");
  const [currentReceiverAction, setCurrentReceiverAction] = useState<
    "rename" | "pair" | null
  >(null);
  const [currentReceiverAdvancedOpen, setCurrentReceiverAdvancedOpen] = useState(false);
  const [receiverHeartbeatNowMs, setReceiverHeartbeatNowMs] = useState<number | null>(
    null
  );
  const setupPerson = state.connectContext?.people.find(
    (person) => person.id === activeMainConnectUserPersonId
  );
  const [receiverLabelDrafts, setReceiverLabelDrafts] = useState<Record<string, string>>({});
  const selectedDevice =
    activeDevices.find((device) => receiverKey(device) === selectedReceiverKey) ??
    activeDevices[0] ??
    null;
  const allDevices = state.provisioning?.receiverDevices ?? activeDevices;
  const setupTokens = state.provisioning?.setupTokens ?? [];
  const activeReceiverListDevices = allDevices.filter((device) => device.status !== "revoked");
  const householdOrder = households.map((household) => household.id);
  const sortReceiverListDevices = (devices: ConnectReceiverDevice[]) =>
    [...devices].sort((first, second) => {
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

  useEffect(() => {
    const updateHeartbeatNow = () => setReceiverHeartbeatNowMs(Date.now());
    const initialTimer = window.setTimeout(updateHeartbeatNow, 0);
    const interval = window.setInterval(updateHeartbeatNow, 60_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);
  const sortedActiveReceiverListDevices = sortReceiverListDevices(activeReceiverListDevices);
  const receiverLabel =
    selectedDevice ? receiverDisplayName(selectedDevice) : "No receiver selected";
  const receiverPairingCodeReady = browserReceiverPairingCodeReady(receiverPairingCode);
  const receiverEligiblePeople = (state.connectContext?.people ?? [])
    .filter((person) => person.isActive !== false)
    .filter((person) => !isConnectPetSubjectType(person.subjectType));
  const selectedPresenceState = selectedDevice?.presence?.state || "offline";
  const selectedPresenceLabel =
    selectedDevice?.presence?.label || statusLabel(selectedPresenceState);
  const selectedReceiverPaired = Boolean(selectedDevice?.pairedAt);
  const selectedPairingLabel = selectedReceiverPaired ? "Paired" : "Not Paired";

  function receiverDisplayName(device: ConnectReceiverDevice) {
    return device.locationLabel || device.name || defaultReceiverDisplayName(device);
  }

  function receiverDraftLabel(device: ConnectReceiverDevice) {
    return receiverLabelDrafts[receiverKey(device)] ?? receiverDisplayName(device);
  }

  async function selectInlineReceiverUser(personId: string) {
    if (!personId || personId === activeMainConnectUserPersonId || savingReceiverUserId) {
      return;
    }

    const person = receiverEligiblePeople.find((item) => item.id === personId);
    if (!person) return;

    setSavingReceiverUserId(personId);
    try {
      await updateConnectMainUserContext({ mainConnectUserPersonId: personId });
      await onRefresh();
    } catch (error) {
      setSetupStatus(
        error instanceof Error ? error.message : "Main Receiver User could not be saved."
      );
    } finally {
      setSavingReceiverUserId("");
    }
  }

  function openReceiverSetupModal() {
    if (!activeMainConnectUserPersonId) {
      setSetupStatus("Choose a Main Receiver User before adding a Receiver.");
      return;
    }
    setSetupLink(null);
    setCurrentReceiverAction("pair");
  }

  function closeReceiverSetupModal() {
    setCurrentReceiverAction(null);
    setReceiverPairingCode("");
    void onRefresh();
  }

  async function pairReceiverFromBrowser() {
    if (!activeMainConnectUserPersonId) {
      setSetupStatus("Choose a Main Receiver User before pairing this Receiver.");
      return;
    }
    if (!receiverPairingCodeReady) {
      setSetupStatus("Enter the 6-digit code shown on the Receiver.");
      return;
    }

    setReceiverPairingPending(true);
    setSetupStatus("Pairing Receiver...");
    try {
      const response = await fetch("/api/connect/receiver-shell/pairing-sessions/pair", {
        body: JSON.stringify({
          deviceProfile: "web_receiver",
          hardwareProfile: "web",
          mainConnectUserPersonId: activeMainConnectUserPersonId,
          pairingCode: receiverPairingCode,
          receiverUrl:
            typeof window === "undefined"
              ? "/connect/receiver"
              : new URL("/connect/receiver", window.location.origin).toString(),
          uiLayout: "default_receiver",
        }),
        cache: "no-store",
        headers: {
          ...(await connectAuthHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        receiverName?: string;
      };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Unable to pair Receiver.");
      }
      setSetupStatus(
        payload.receiverName
          ? `Receiver ready for ${payload.receiverName}.`
          : "Receiver ready."
      );
      setCurrentReceiverAction(null);
      setReceiverPairingCode("");
      await onRefresh();
    } catch (error) {
      setSetupStatus(error instanceof Error ? error.message : "Unable to pair Receiver.");
    } finally {
      setReceiverPairingPending(false);
    }
  }

  function receiverSetupStatus(device: ConnectReceiverDevice) {
    const token = setupTokens.find(
      (item) => item.receiverDeviceId === device.id && item.status === "active"
    );
    if (token) return "setup link active";
    return statusLabel(device.status);
  }

  function receiverConnectionLine(device: ConnectReceiverDevice) {
    const mode = receiverModeLabel(device.receiverMode);
    if (!device.pairedAt) return "Setup needed";
    return mode || statusLabel(device.status);
  }

  function receiverFirstPairedLine(device: ConnectReceiverDevice) {
    return device.pairedAt ? formatDateTime(device.pairedAt) : "Not paired";
  }

  function receiverLastSeenLine(device: ConnectReceiverDevice) {
    return device.lastSeenAt ? formatDateTime(device.lastSeenAt) : "No heartbeat yet";
  }

  function receiverLastSeenButtonLine(device: ConnectReceiverDevice) {
    return device.lastSeenAt ? `Last seen ${formatDateTime(device.lastSeenAt)}` : "No heartbeat yet";
  }

  function receiverCanBeDeleted(device: ConnectReceiverDevice) {
    return (
      device.status === "setup_pending" &&
      !device.pairedAt &&
      !device.lastSeenAt &&
      !device.provisioningCompletedAt &&
      !device.careCircleId &&
      !device.mainConnectUserPersonId
    );
  }

  function receiverShortId(device: ConnectReceiverDevice) {
    const id = (device.receiverId || device.id || "").trim();
    if (!id) return "No ID";
    const compact = id.replace(/^receiver-/, "");
    return compact.length > 10 ? compact.slice(-10) : compact;
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

    const ageMs = (receiverHeartbeatNowMs ?? lastSeenMs) - lastSeenMs;
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

  function receiverApplianceModeLine(device: ConnectReceiverDevice) {
    return receiverModeLabel(device.receiverMode) || "Mode not reported";
  }

  function receiverAutoStartLine(device: ConnectReceiverDevice) {
    return capabilityStatusLabel(device.capabilityStatuses?.bootStart);
  }

  function capabilityStatusLabel(status?: string) {
    if (status === "enabled") return "On";
    if (status === "supported") return "Available";
    if (status === "unavailable") return "Not available";
    if (status === "unknown") return "Unknown";
    return "Not reported";
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
  ): Promise<ReceiverSetupLink | null> {
    if (!targetDevice?.id) {
      setSetupStatus("Select a receiver first.");
      return null;
    }
    if (!activeMainConnectUserPersonId) {
      setSetupStatus("Choose a Main Receiver User before creating a receiver setup link.");
      return null;
    }

    setSelectedReceiverKey(receiverKey(targetDevice));
    if (mode === "pair") {
      const cachedSetupLink = readCachedReceiverSetupLink(targetDevice.id);
      if (cachedSetupLink) {
        setSetupLink(cachedSetupLink);
        setSetupStatus("Receiver setup link is ready.");
        return cachedSetupLink;
      }
    }

    setSetupActionPending(mode);
    setSetupStatus(mode === "recover" ? "Creating recovery link..." : "Creating setup link...");

    try {
      const response = await fetch(
        `/api/connect/provisioning/receiver-devices/${encodeURIComponent(targetDevice.id)}/setup-token`,
        {
          body: JSON.stringify({
            careCircleId: setupPerson?.careCircleId,
            confirmedPrototypeWrite: true,
            expiresInMinutes: 30,
            locationLabel: targetDevice.locationLabel,
            mainConnectUserPersonId: activeMainConnectUserPersonId,
            name: targetDevice.name,
            operationReason:
              mode === "recover"
                ? "Coordinator confirmed Connect receiver recovery link."
                : "Coordinator confirmed Connect receiver setup link.",
          }),
          headers: {
            ...(await connectAuthHeaders()),
            "Content-Type": "application/json",
          },
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
        ? new URL(
            payload.setupPath,
            typeof window === "undefined" ? "https://app.carepland.com" : window.location.origin
          ).toString()
        : "";
      const nextSetupLink = {
        createdAt: new Date().toISOString(),
        expiresAt: payload.setupToken?.expiresAt,
        setupCode: payload.setupToken?.setupCode,
        setupUrl,
      };
      setSetupLink(nextSetupLink);
      if (mode === "pair") {
        writeCachedReceiverSetupLink(targetDevice.id, nextSetupLink);
      }
      setSetupStatus(
        mode === "recover"
          ? "Recovery setup link is ready."
          : "Receiver setup link is ready."
      );
      await onRefresh();
      return nextSetupLink;
    } catch (error) {
      setSetupStatus(error instanceof Error ? error.message : "Setup link could not be created.");
      return null;
    } finally {
      setSetupActionPending(null);
    }
  }

  async function copySetupLink(link = setupLink) {
    if (!link?.setupUrl) return;

    try {
      await navigator.clipboard.writeText(link.setupUrl);
      setSetupStatus("Setup link copied.");
    } catch {
      setSetupStatus("Copy failed. Open the setup link and copy it from the browser.");
    }
  }

  async function copyCurrentReceiverSetupLink() {
    const link = await createSetupLink("pair");
    await copySetupLink(link);
  }

  function currentReceiverLink(device: ConnectReceiverDevice) {
    const savedReceiverUrl = device.receiverUrl?.trim();
    const origin =
      typeof window === "undefined" ? "https://app.carepland.com" : window.location.origin;
    const receiverUrl = savedReceiverUrl || "/connect/receiver";

    try {
      return new URL(receiverUrl, origin).toString();
    } catch {
      return new URL("/connect/receiver", origin).toString();
    }
  }

  async function copyCurrentReceiverLink(device: ConnectReceiverDevice) {
    try {
      await navigator.clipboard.writeText(currentReceiverLink(device));
      setSetupStatus("Receiver link copied.");
    } catch {
      setSetupStatus("Copy failed. Open the Receiver and copy the link from the browser.");
    }
  }

  async function revokeReceiverDevice(device: ConnectReceiverDevice) {
    if (!device.id) {
      setSetupStatus("Select a receiver first.");
      return;
    }

    const label = receiverDisplayName(device);
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
          headers: {
            ...(await connectAuthHeaders()),
            "Content-Type": "application/json",
          },
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

      const nextDevice = activeReceiverListDevices.find((item) => item.id !== device.id);
      setSelectedReceiverKey(nextDevice ? receiverKey(nextDevice) : "");
      setCurrentReceiverAction(null);
      setCurrentReceiverAdvancedOpen(false);
      setSetupStatus("Receiver revoked. Pair or set up the physical Receiver again to use it.");
      await onRefresh();
    } catch (error) {
      setSetupStatus(error instanceof Error ? error.message : "Receiver could not be revoked.");
    } finally {
      setReceiverActionPending(null);
    }
  }

  async function deleteReceiverDevice(device: ConnectReceiverDevice) {
    if (!device.id) {
      setSetupStatus("Select a receiver first.");
      return;
    }

    setReceiverActionPending(device.id);
    setSetupStatus("Deleting receiver...");
    try {
      const response = await fetch(
        `/api/connect/provisioning/receiver-devices/${encodeURIComponent(device.id)}`,
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
        throw new Error(payload.error || `Delete returned ${response.status}`);
      }

      const nextDevice = activeReceiverListDevices.find((item) => item.id !== device.id);
      setSelectedReceiverKey(nextDevice ? receiverKey(nextDevice) : "");
      setCurrentReceiverAction(null);
      setCurrentReceiverAdvancedOpen(false);
      setSetupStatus("Receiver deleted.");
      await onRefresh();
    } catch (error) {
      setSetupStatus(error instanceof Error ? error.message : "Receiver could not be deleted.");
    } finally {
      setReceiverActionPending(null);
    }
  }

  async function saveReceiverLabel(device: ConnectReceiverDevice) {
    if (!device.id) {
      setSetupStatus("Select a receiver first.");
      return;
    }

    const nextLabel = receiverDraftLabel(device).trim();
    if (!nextLabel) {
      setSetupStatus("Enter a Receiver name.");
      return;
    }

    setReceiverActionPending(device.id);
    setSetupStatus(`Saving ${nextLabel}...`);
    try {
      const response = await fetch(
        `/api/connect/provisioning/receiver-devices/${encodeURIComponent(device.id)}`,
        {
          body: JSON.stringify({
            confirmedPrototypeWrite: true,
            locationLabel: nextLabel,
            operationReason: `Updated receiver label to ${nextLabel}.`,
          }),
          headers: {
            ...(await connectAuthHeaders()),
            "Content-Type": "application/json",
          },
          method: "PATCH",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `Receiver update returned ${response.status}`);
      }

      setReceiverLabelDrafts((current) => {
        const next = { ...current };
        delete next[receiverKey(device)];
        return next;
      });
      setSetupStatus(`${nextLabel} saved.`);
      await onRefresh();
    } catch (error) {
      setSetupStatus(error instanceof Error ? error.message : "Receiver could not be updated.");
    } finally {
      setReceiverActionPending(null);
    }
  }

  return (
    <section className={showTabs ? "rounded-lg border border-[#d6e3f2] bg-white p-4 shadow-sm" : ""}>
      {showTabs ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black">Setup</h2>
            <span className="text-xs font-black uppercase tracking-normal text-[#5f6e84]">
              Coordinator
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-[#edf5fc] p-1">
            {(["people", "receivers"] as SetupView[]).map((view) => (
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

      {setupView === "people" ? (
        <div className="mt-4 space-y-3">
          <Metric
            detail="existing Pers people"
            label="Receiver users"
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
            <p className="text-sm font-black text-[#172f49]">Receiver Users</p>
            <p className="mt-1 text-xs font-semibold text-[#5f6e84]">
              Receiver uses existing CarePland people. Add or edit people in Pers; Receiver
              follows the global focus when one person is selected, and uses a receiver-local
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
                          ? "Main Receiver User"
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
          {canShowAdminItems ? (
            <details className="rounded-md border border-[#d6e3f2] bg-[#f8fafc] p-3">
              <summary className="cursor-pointer text-sm font-black">
                Advanced receiver-user diagnostics
              </summary>
              <p className="mt-2 text-sm text-[#5f6e84]">
                Receiver and care-circle records are summarized here for setup review.
              </p>
              <div className="mt-4 grid gap-4">
                <CareCircleContext
                  activeDevices={activeDevices}
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
          ) : null}
        </div>
      ) : null}

      {setupView === "receivers" ? (
        <div className="-mt-3 space-y-4">
          <section>
            <div className="mb-7 space-y-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="text-xs font-semibold text-blue-700">
                  Current Receiver
                </h2>
                {selectedDevice ? (
                  <span className="inline-flex min-h-5 items-center rounded-full bg-[#edf1f4] px-1.5 text-[10px] font-black text-[#5f6e84]">
                    {selectedPairingLabel}
                  </span>
                ) : null}
                {selectedDevice && selectedReceiverPaired ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#5f6e84]">
                    <span
                      aria-hidden="true"
                      className={`h-2 w-2 rounded-full ${
                        selectedPresenceState === "online"
                          ? "bg-[#2e9a67]"
                          : selectedPresenceState === "stale"
                            ? "bg-[#d6a629]"
                            : selectedPresenceState === "revoked"
                              ? "bg-[#b43a32]"
                              : "bg-[#5f6e84]"
                      }`}
                    />
                    {selectedPresenceLabel}
                  </span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-wrap items-start gap-x-5 gap-y-3">
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-3.5 gap-y-2">
                    <span className="min-w-0 truncate text-xl font-black text-[#172f49]">
                      {selectedDevice ? receiverDisplayName(selectedDevice) : "No active Receiver"}
                    </span>
                    {selectedDevice && currentReceiverAction !== "rename" ? (
                      <button
                        aria-label="Rename Receiver"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#5f6e84] hover:text-[#173150] disabled:opacity-55"
                        disabled={!selectedDevice}
                        onClick={() => {
                          setReceiverLabelDrafts((current) => ({
                            ...current,
                            [receiverKey(selectedDevice)]: receiverDisplayName(selectedDevice),
                          }));
                          setSetupLink(null);
                          setCurrentReceiverAction("rename");
                        }}
                        title="Rename Receiver"
                        type="button"
                      >
                        <svg
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                    ) : null}
                    {selectedDevice && currentReceiverAction !== "rename" ? (
                      <button
                        className="inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-black text-blue-700 hover:bg-[#edf5fc] hover:text-blue-900 disabled:opacity-55"
                        disabled={!selectedDevice}
                        onClick={() => void copyCurrentReceiverLink(selectedDevice)}
                        title="Copy Receiver link"
                        type="button"
                      >
                        <svg
                          aria-hidden="true"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <rect height="14" rx="2" width="14" x="8" y="8" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                        <span>Copy Receiver link</span>
                      </button>
                    ) : null}
                    {selectedDevice && currentReceiverAction === "rename" ? (
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <input
                          className="min-h-9 w-56 max-w-full rounded-lg border border-[#cbd9e7] bg-white px-3 text-sm font-black text-[#0f172a]"
                          maxLength={80}
                          onChange={(event) =>
                            setReceiverLabelDrafts((current) => ({
                              ...current,
                              [receiverKey(selectedDevice)]: event.target.value,
                            }))
                          }
                          value={receiverDraftLabel(selectedDevice)}
                        />
                        <button
                          className="min-h-9 rounded-lg border border-[#1c5686] bg-[#2f6f9f] px-4 text-sm font-black text-white hover:bg-[#285f89] disabled:opacity-55"
                          disabled={
                            receiverActionPending === selectedDevice.id ||
                            receiverDraftLabel(selectedDevice).trim() === receiverDisplayName(selectedDevice)
                          }
                          onClick={async () => {
                            await saveReceiverLabel(selectedDevice);
                            setCurrentReceiverAction(null);
                          }}
                          type="button"
                        >
                          {receiverActionPending === selectedDevice.id ? "Saving" : "Save"}
                        </button>
                        <button
                          className="min-h-9 rounded-lg border border-[#cbd9e7] bg-white px-4 text-sm font-black text-[#0f172a] hover:bg-[#edf5fc]"
                          onClick={() => {
                            setCurrentReceiverAction(null);
                            setReceiverLabelDrafts((current) => {
                              const next = { ...current };
                              delete next[receiverKey(selectedDevice)];
                              return next;
                            });
                          }}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {!selectedDevice ? (
                    <span className="text-xs font-black text-[#5f6e84]">
                      Select a Receiver from the list below.
                    </span>
                  ) : null}
                </div>
                <div className="ml-auto inline-flex items-center gap-3">
                  <button
                    className={
                      selectedReceiverPaired
                        ? "rounded-md px-4 py-2 text-xs font-black text-blue-700 hover:text-blue-900 disabled:opacity-55"
                        : "rounded-md bg-[#2f6f9f] px-4 py-2 text-xs font-black text-white hover:bg-[#285f89] disabled:opacity-55"
                    }
                    disabled={!selectedDevice}
                    onClick={() => onOpenReceiverSetup("receiverUser")}
                    type="button"
                  >
                    Setup
                  </button>
                  <button
                    aria-label="Copy setup link"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[#5f6e84] hover:text-[#173150] disabled:opacity-55"
                    disabled={!selectedDevice || setupActionPending !== null}
                    onClick={() => void copyCurrentReceiverSetupLink()}
                    title="Copy setup link"
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <rect height="14" rx="2" width="14" x="8" y="8" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                  </button>
                  <button
                    className="px-1.5 py-1 text-[11px] font-black text-[#a52b25] hover:text-[#7f1d1d] disabled:opacity-55"
                    disabled={
                      !selectedDevice?.id ||
                      selectedDevice.status === "revoked" ||
                      receiverActionPending === selectedDevice.id
                    }
                    onClick={() => selectedDevice && void revokeReceiverDevice(selectedDevice)}
                    title={
                      selectedDevice?.status === "revoked"
                        ? "Receiver already revoked."
                        : "Revoke server approval for this receiver."
                    }
                    type="button"
                  >
                    {selectedDevice && receiverActionPending === selectedDevice.id ? "Revoking" : "Revoke"}
                  </button>
                </div>
              </div>

              {selectedDevice ? (
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  {receiverEligiblePeople.length ? (
                    receiverEligiblePeople.map((person) => {
                      const selected = person.id === activeMainConnectUserPersonId;
                      const pending = person.id === savingReceiverUserId;
                      return (
                        <button
                          aria-pressed={selected}
                          className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-2.5 pr-3.5 text-xs font-black ${
                            selected
                              ? "border-[#9fc6e8] bg-[#edf5fc] text-[#172f49]"
                              : "border-[#d6e3f2] bg-white text-[#345d83] hover:bg-[#f4f8fc]"
                          }`}
                          disabled={Boolean(savingReceiverUserId)}
                          key={person.id}
                          onClick={() => void selectInlineReceiverUser(person.id)}
                          type="button"
                        >
                          <ConnectPersonAvatar person={person} selected={selected} size="2xs" />
                          {firstNameLabel(person.displayName) || person.displayName}
                          {pending ? <span className="text-[10px] text-[#5f6e84]">Saving</span> : null}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-xs font-semibold text-[#5f6e84]">
                      Add a Care VIP to choose a person.
                    </span>
                  )}
                </div>
              ) : null}

            </div>

              {canShowAdminItems && setupStatus !== "Ready." ? (
                <p className="mt-3 rounded-lg bg-[#edf1f4] px-4 py-3 text-sm font-black text-[#5f6e84]">
                  {setupStatus}
                </p>
              ) : null}

              {selectedDevice ? (
                <details
                  className="mt-4"
                  onToggle={(event) => setCurrentReceiverAdvancedOpen(event.currentTarget.open)}
                  open={currentReceiverAdvancedOpen}
                >
                  <summary className="cursor-pointer text-sm font-black text-[#173150]">
                    Device Details
                  </summary>
                  <dl className="mt-4 grid gap-x-10 gap-y-3 md:grid-cols-2">
                    {[
                      ["Receiver ID", receiverShortId(selectedDevice)],
                      ["Setup status", receiverSetupStatus(selectedDevice)],
                      ["Heartbeat", receiverHeartbeatState(selectedDevice).label],
                      ["First paired", receiverFirstPairedLine(selectedDevice)],
                      ["Last seen", receiverLastSeenLine(selectedDevice)],
                      ["Software update", receiverUpdateLine(selectedDevice)],
                      ["Appliance mode", receiverApplianceModeLine(selectedDevice)],
                      ["Auto-start", receiverAutoStartLine(selectedDevice)],
                      ["Kiosk", receiverKioskLine(selectedDevice)],
                      ["APK version", receiverAppVersionLine(selectedDevice)],
                    ].map(([label, value]) => (
                      <div
                        className="grid min-w-0 gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)]"
                        key={label}
                      >
                        <dt className="text-sm font-black text-[#5f6e84]">{label}</dt>
                        <dd className="min-w-0 break-words text-sm font-black text-[#172f49]">
                          {value}
                        </dd>
                      </div>
                    ))}
                    {receiverHeartbeatState(selectedDevice).isStale ? (
                      <div className="md:col-span-2">
                        <p className="text-sm font-black text-[#6f4d00]">
                          {receiverHeartbeatState(selectedDevice).label}. Open the app on the device or refresh after it is online.
                        </p>
                      </div>
                    ) : null}
                  </dl>
                </details>
              ) : null}

              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-black text-[#5f6e84]">Receivers</p>
                    <button
                      className={`ml-5 min-h-10 rounded-lg px-2 text-sm font-black ${
                        currentReceiverAction === "pair"
                          ? "text-[#1c5686]"
                          : "text-[#173150] hover:text-[#1c5686]"
                      }`}
                      onClick={openReceiverSetupModal}
                      type="button"
                    >
                      Pair Receiver
                    </button>
                    <button
                      className="min-h-10 rounded-lg px-2 text-sm font-black text-[#173150] hover:text-[#1c5686] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                      onClick={() => onOpenReceiverSetup("start", { newReceiver: true })}
                      type="button"
                    >
                      + Add Receiver
                    </button>
                    {currentReceiverAction === "pair" ? (
                      <span className="grid min-w-0 gap-1.5 sm:grid-cols-[104px_auto_auto]">
                        <input
                          autoComplete="one-time-code"
                          className="min-h-10 rounded-lg border border-[#cbd9e7] bg-white px-3 text-sm font-black tracking-normal text-[#0f172a]"
                          inputMode="numeric"
                          onChange={(event) =>
                            setReceiverPairingCode(formatBrowserReceiverPairingCode(event.target.value))
                          }
                          placeholder="6 digit code"
                          value={receiverPairingCode}
                        />
                        <button
                          className="min-h-10 rounded-lg border border-[#1c5686] bg-[#2f6f9f] px-4 text-sm font-black text-white hover:bg-[#285f89] disabled:opacity-55"
                          disabled={!receiverPairingCodeReady || receiverPairingPending}
                          onClick={() => void pairReceiverFromBrowser()}
                          type="button"
                        >
                          {receiverPairingPending ? "Confirming" : "Confirm"}
                        </button>
                        <button
                          className="min-h-10 rounded-lg border border-[#cbd9e7] bg-white px-4 text-sm font-black text-[#0f172a] hover:bg-[#edf5fc]"
                          onClick={closeReceiverSetupModal}
                          type="button"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : null}
                  </div>
                  <button
                    className="text-sm font-black text-[#173150] hover:text-[#2f6f9f]"
                    onClick={() => void onRefresh()}
                    type="button"
                  >
                    Refresh devices
                  </button>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {sortedActiveReceiverListDevices.map((device) => {
                    const key = receiverKey(device);
                    const isSelected = selectedDevice ? key === receiverKey(selectedDevice) : false;
                    const canDelete = receiverCanBeDeleted(device);
                    const presenceState = device.presence?.state || "offline";
                    return (
                      <div
                        aria-pressed={isSelected}
                        role="button"
                        tabIndex={0}
                        className={`grid min-h-16 gap-3 rounded-lg border px-4 py-3 text-left sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start ${
                          isSelected
                            ? "border-[#9fc6e8] bg-[#edf5fc]"
                            : "border-[#d6e3f2] bg-[#edf1f4] hover:bg-[#e6eef6]"
                        }`}
                        key={key}
                        onClick={() => {
                          setSelectedReceiverKey(key);
                          setCurrentReceiverAction(null);
                          setCurrentReceiverAdvancedOpen(false);
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          setSelectedReceiverKey(key);
                          setCurrentReceiverAction(null);
                          setCurrentReceiverAdvancedOpen(false);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-base font-black text-[#172f49]">
                            {receiverDisplayName(device)}
                          </span>
                          <span className="mt-1 block truncate text-sm font-semibold text-[#5f6e84]">
                            {receiverConnectionLine(device)}
                          </span>
                          <span className="mt-1 block truncate text-[11px] font-semibold text-[#718094]">
                            {receiverLastSeenButtonLine(device)}
                          </span>
                        </span>
                        <span className="flex flex-col items-start gap-1 sm:items-end sm:pt-7">
                          <span className="inline-flex items-center gap-2">
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
                              aria-hidden="true"
                            />
                            <span className="text-sm font-black text-[#5f6e84]">
                              ID {receiverShortId(device)}
                            </span>
                          </span>
                          {canDelete ? (
                            <button
                              className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-black text-[#9f2f2a] hover:text-[#7f1d1d] disabled:opacity-55"
                              disabled={receiverActionPending === device.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteReceiverDevice(device);
                              }}
                              onKeyDown={(event) => event.stopPropagation()}
                              title="Delete unpaired Receiver"
                              type="button"
                            >
                              <svg
                                aria-hidden="true"
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="m19 6-1 14H6L5 6" />
                                <path d="M10 11v5" />
                                <path d="M14 11v5" />
                              </svg>
                              {receiverActionPending === device.id ? "Deleting" : "Delete"}
                            </button>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                  {!sortedActiveReceiverListDevices.length ? (
                    <p className="rounded-lg border border-[#d6e3f2] bg-white px-4 py-3 text-sm font-semibold text-[#5f6e84] lg:col-span-2">
                      No active Receiver devices found.
                    </p>
                  ) : null}
                </div>
              </div>
          </section>

          {canShowAdminItems ? (
            <fieldset className="rounded-xl border border-[#bfd3e8] bg-[#f8fbff] p-5">
              <legend className="px-2 text-lg font-black text-[#5f6e84]">
                Administrator / Diagnostics
              </legend>
              <div className="space-y-3">
                <details className="rounded-lg border border-[#d6e3f2] bg-white p-3">
                  <summary className="cursor-pointer text-lg font-black text-[#173150]">
                    Provisioning diagnostics
                  </summary>
                  <div className="mt-3 rounded-lg border border-[#d6e3f2] bg-[#f8fafc] p-3">
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
                          <p className="text-sm font-black text-[#172f49]">
                            {shortAuditEvent(event)}
                          </p>
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

                <details className="rounded-lg border border-[#d6e3f2] bg-white p-3">
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
                          {selectedDevice ? receiverDisplayName(selectedDevice) : "Receiver"} (Web)
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

                <details className="rounded-lg border border-[#d6e3f2] bg-white p-3">
                  <summary className="cursor-pointer text-lg font-black text-[#173150]">
                    Advanced Receiver Routing
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
              </div>
            </fieldset>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ReceiverTroubleshootingView({
  activeDevices,
  clearReceiverGuide,
  chooseGuidePreviewTarget,
  guideMode,
  receiverGuideId,
  selectedReceiverKey,
  selectedReceiverLabel,
  setGuideMode,
  setSelectedReceiverKey,
  status,
}: {
  activeDevices: ConnectReceiverDevice[];
  clearReceiverGuide: () => void;
  chooseGuidePreviewTarget: (
    highlight: ReceiverGuideRect,
    targetReceiverSessionId?: string
  ) => void;
  guideMode: boolean;
  receiverGuideId: string;
  selectedReceiverKey: string;
  selectedReceiverLabel: string;
  setGuideMode: (value: boolean) => void;
  setSelectedReceiverKey: (value: string) => void;
  status: string;
}) {
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [receiverGuideSessions, setReceiverGuideSessions] = useState<ReceiverGuideSession[]>([]);
  const [allReceiverGuideSessions, setAllReceiverGuideSessions] = useState<
    ReceiverGuideSession[]
  >([]);
  const [targetReceiverSessionId, setTargetReceiverSessionId] = useState("");
  const [identifyCodeInput, setIdentifyCodeInput] = useState("");
  const [identifyCodeStatus, setIdentifyCodeStatus] = useState("");
  const [identifyCodesBySession, setIdentifyCodesBySession] = useState<
    Record<string, { code: string; receiverId: string }>
  >({});
  const liveReceiverOptions = allReceiverGuideSessions
    .filter(
      (session, index, sessions) =>
        sessions.findIndex((item) => item.receiverId === session.receiverId) === index
    )
    .filter(
      (session) =>
        !activeDevices.some((device) => receiverKey(device) === session.receiverId)
    )
    .map((session) => ({
      id: session.receiverId,
      name:
        session.deviceProfile === "gxv3370"
          ? "Live GXV browser window"
          : "Live Receiver browser window",
      receiverId: session.receiverId,
      status: "browser_open",
    }));
  const receiverOptions =
    activeDevices.length > 0
      ? [...activeDevices, ...liveReceiverOptions]
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
          ...liveReceiverOptions,
        ];
  const guideText = guideMode
    ? "Guide Mode: What you see is what they see. Click a button to highlight it on the receiver. They still have full control and can press any button."
    : `This does not reflect what is actually seen on ${selectedReceiverLabel} but is a reference for discussion.`;
  const activeGuideSessions = guideMode ? receiverGuideSessions : [];
  const selectedIdentifySession = targetReceiverSessionId
    ? allReceiverGuideSessions.find(
        (session) => session.receiverSessionId === targetReceiverSessionId
      )
    : null;

  async function showReceiverIdentifyCodes() {
    const liveSessions = allReceiverGuideSessions;

    if (!liveSessions.length) {
      setIdentifyCodeStatus("No live Receiver windows have checked in yet.");
      return;
    }

    const usedCodes = new Set<string>();
    const nextCodesBySession: Record<string, { code: string; receiverId: string }> = {};

    for (const session of liveSessions) {
      let code = "";
      for (let attempt = 0; attempt < 90 && !code; attempt += 1) {
        const candidate = String(10 + Math.floor(Math.random() * 90));
        if (!usedCodes.has(candidate)) {
          usedCodes.add(candidate);
          code = candidate;
        }
      }

      nextCodesBySession[session.receiverSessionId] = {
        code: code || "99",
        receiverId: session.receiverId,
      };
    }

    const requestsByReceiver = liveSessions.reduce<
      Record<string, Array<{ code: string; receiverSessionId: string }>>
    >((groups, session) => {
      const assigned = nextCodesBySession[session.receiverSessionId];
      if (!assigned) return groups;
      return {
        ...groups,
        [session.receiverId]: [
          ...(groups[session.receiverId] ?? []),
          {
            code: assigned.code,
            receiverSessionId: session.receiverSessionId,
          },
        ],
      };
    }, {});

    await Promise.all(
      Object.entries(requestsByReceiver).map(([receiverId, requests]) =>
        fetch(receiverGuideEndpoint, {
          body: JSON.stringify({ action: "identify", receiverId, requests }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        })
      )
    );

    setIdentifyCodesBySession(nextCodesBySession);
    setIdentifyCodeStatus("Codes are showing on live Receiver windows.");
  }

  function chooseReceiverByIdentifyCode(code: string) {
    const normalizedCode = code.replace(/\D/g, "").slice(0, 2);
    setIdentifyCodeInput(normalizedCode);

    if (normalizedCode.length < 2) {
      setIdentifyCodeStatus("");
      return;
    }

    const matchedEntry = Object.entries(identifyCodesBySession).find(
      ([, value]) => value.code === normalizedCode
    );

    if (!matchedEntry) {
      setIdentifyCodeStatus("No live Receiver is showing that code.");
      return;
    }

    const [receiverSessionId, value] = matchedEntry;
    setSelectedReceiverKey(value.receiverId);
    setTargetReceiverSessionId(receiverSessionId);
    setIdentifyCodeStatus(`Selected Receiver window ${normalizedCode}.`);
  }

  useEffect(() => {
    // Receiver Guide is deprecated. Avoid recurring session discovery requests
    // until the future guide experience is reintroduced intentionally.
    if (connectReceiverGuideDeprecated) return undefined;
    if (!guideMode) return undefined;

    let cancelled = false;

    async function refreshGuideSessions() {
      try {
        recordConnectPollingRequest({
          caller: "connect_dashboard_guide_sessions",
          endpoint: receiverGuideEndpoint,
          reason: "poll",
        });
        const [selectedResponse, allResponse] = await Promise.all([
          fetch(`${receiverGuideEndpoint}?receiverId=${encodeURIComponent(receiverGuideId)}`, {
            cache: "no-store",
          }),
          fetch(receiverGuideEndpoint, { cache: "no-store" }),
        ]);
        const selectedPayload = (await selectedResponse.json().catch(() => ({}))) as {
          guide?: { activeSessions?: Omit<ReceiverGuideSession, "receiverId">[] };
        };
        const allPayload = (await allResponse.json().catch(() => ({}))) as {
          guides?: ReceiverGuideState[];
        };
        const sessions = (selectedPayload.guide?.activeSessions ?? []).map((session) => ({
          ...session,
          receiverId: receiverGuideId,
        }));
        const allSessions =
          allPayload.guides?.flatMap((guide) =>
            (guide.activeSessions ?? []).map((session) => ({
              ...session,
              receiverId: guide.receiverId,
            }))
          ) ?? [];

        if (cancelled) return;
        setReceiverGuideSessions(sessions);
        setAllReceiverGuideSessions(allSessions);
        setTargetReceiverSessionId((current) =>
          current && sessions.some((session) => session.receiverSessionId === current)
            ? current
            : sessions.length === 1
              ? sessions[0]?.receiverSessionId ?? ""
              : ""
        );
      } catch {
        if (!cancelled) {
          setReceiverGuideSessions([]);
          setAllReceiverGuideSessions([]);
        }
      }
    }

    void refreshGuideSessions();
    const timer = window.setInterval(() => {
      void refreshGuideSessions();
    }, connectPollingIntervals.dashboardGuideSessionsMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [guideMode, receiverGuideId]);

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
        chooseGuidePreviewTarget(
          {
            height: Math.max(16, Math.round(controlRect.height)),
            label: control instanceof HTMLElement ? readableControlLabel(control) : "that area",
            width: Math.max(16, Math.round(controlRect.width)),
            x: Math.round(controlRect.left - shellRect.left),
            y: Math.round(controlRect.top - shellRect.top),
          },
          targetReceiverSessionId || undefined
        );
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
  }, [chooseGuidePreviewTarget, guideMode, targetReceiverSessionId]);

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
                clearReceiverGuide();
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

        {guideMode ? (
          <div className="mt-4 rounded-lg border border-[#cbd9e7] bg-white px-4 py-3">
            <div className="grid gap-3 lg:grid-cols-[auto_minmax(160px,220px)_minmax(0,1fr)] lg:items-center">
              <button
                className="min-h-11 rounded-lg border border-[#cbd9e7] bg-[#f8fafc] px-4 text-sm font-black text-[#244d73] shadow-sm hover:bg-[#edf5fc]"
                onClick={() => {
                  void showReceiverIdentifyCodes();
                }}
                type="button"
              >
                Show ID codes
              </button>
              <label className="grid gap-1 text-xs font-black uppercase text-[#5f6e84]">
                Enter code
                <input
                  className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-2xl font-black tracking-normal text-[#081225]"
                  inputMode="numeric"
                  maxLength={2}
                  onChange={(event) => chooseReceiverByIdentifyCode(event.target.value)}
                  placeholder="--"
                  value={identifyCodeInput}
                />
              </label>
              <p className="text-sm font-bold leading-snug text-[#44546a]">
                {selectedIdentifySession
                  ? `Targeting ${selectedIdentifySession.deviceProfile === "gxv3370" ? "GXV" : "Receiver"} window ${identifyCodesBySession[selectedIdentifySession.receiverSessionId]?.code || ""}.`
                  : identifyCodeStatus ||
                    "Use this when several Receiver windows are open or the selected Receiver is unclear."}
              </p>
            </div>
          </div>
        ) : null}

        {guideMode && activeGuideSessions.length > 1 ? (
          <div className="mt-4 rounded-lg border border-[#e5bd63] bg-[#fff8df] px-4 py-3">
            <p className="text-sm font-black text-[#6a4b00]">
              More than one live window is using this Receiver. Choose the one you mean before
              pointing at the screen.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeGuideSessions.map((session, index) => (
                <button
                  className={`rounded-lg border px-4 py-2 text-sm font-black ${
                    targetReceiverSessionId === session.receiverSessionId
                      ? "border-[#b89a38] bg-[#f4dfa2] text-[#172f49]"
                      : "border-[#e5bd63] bg-white text-[#6a4b00]"
                  }`}
                  key={session.receiverSessionId}
                  onClick={() => setTargetReceiverSessionId(session.receiverSessionId)}
                  type="button"
                >
                  Window {index + 1}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {guideMode && activeGuideSessions.length === 0 ? (
          <div className="mt-4 rounded-lg border border-[#d8dfe8] bg-white px-4 py-3">
            <p className="text-sm font-black text-[#44546a]">
              No live browser window is currently reporting as {selectedReceiverLabel}. The preview
              below is only a clickable map until a live Receiver window checks in.
            </p>
            {allReceiverGuideSessions.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {liveReceiverOptions.map((device) => (
                  <button
                    className="rounded-lg border border-[#cbd9e7] bg-[#f8fafc] px-4 py-2 text-sm font-black text-[#244d73]"
                    key={device.id}
                    onClick={() => setSelectedReceiverKey(receiverKey(device))}
                    type="button"
                  >
                    Use {device.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {status}
        </p>

        <div className="mt-5 overflow-hidden rounded-lg border-[14px] border-[#202423] bg-[#202423] shadow-2xl">
          <iframe
            ref={previewFrameRef}
            className="block h-[760px] w-full bg-[#202423] sm:h-[820px] xl:h-[900px]"
            src={receiverPreviewUrl(
              activeGuideSessions[0] ??
                allReceiverGuideSessions.find((session) => session.receiverId === receiverGuideId)
            )}
            title="CarePland Connect receiver preview"
          />
        </div>
      </div>
    </section>
  );
}

function receiverPreviewUrl(session?: ReceiverGuideSession) {
  const params = new URLSearchParams({ preview: "1" });
  const sessionUrl = session?.pageUrl ?? "";

  if (
    session?.deviceProfile === "gxv3370" ||
    sessionUrl.includes("device=gxv3370")
  ) {
    params.set("device", "gxv3370");
  }

  if (
    session?.uiLayout === "desk_phone_focus_v1" ||
    sessionUrl.includes("homeLayout=focus_v1")
  ) {
    params.set("homeLayout", "focus_v1");
  }

  return `/connect/receiver?${params.toString()}`;
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
  onRefreshCallPathDiagnostics,
  onRestartAudio,
  onToggleMuted,
  recipientCallState,
  receiverUsesClassicCallBridge,
  selectedReceiverId,
  selectedReceiverLabel,
  selectedPerson,
  selectedPersonName,
  setRecipientCallState,
  setStatus,
  summaryStatus,
  summaryText,
  pendingSummaryReviewCount,
  transcriptRuntimeStatus,
  transcriptStatus,
  transcriptText,
  callPathDiagnostics,
}: {
  activeCallState: string;
  canShowDiagnostics: boolean;
  callAudioStatus: ConnectCallAudioStatus;
  callMuted: boolean;
  callPathDiagnostics: CallPathDiagnostics;
  onCallStateChange: (state: string) => void;
  onCallAnswered: () => void;
  onCallEnded: () => void;
  onCallFailed: () => void;
  onHangUpCall: () => void;
  onRefreshCallNotes: () => void;
  onRefreshCallPathDiagnostics: () => void;
  onRestartAudio: () => void;
  onToggleMuted: () => void;
  recipientCallState: RecipientCallState;
  receiverUsesClassicCallBridge: boolean;
  selectedReceiverId: string;
  selectedReceiverLabel: string;
  selectedPerson?: ConnectReceiverPerson;
  selectedPersonName: string;
  setRecipientCallState: (value: RecipientCallState) => void;
  setStatus: (value: string) => void;
  summaryStatus: string;
  summaryText: string;
  pendingSummaryReviewCount: number;
  transcriptRuntimeStatus: string;
  transcriptStatus: string;
  transcriptText: string;
}) {
  const hasServerActiveCall = ["answered", "connected", "ringing"].includes(activeCallState);
  const isRinging = recipientCallState === "ringing" || activeCallState === "ringing";
  const isConnecting =
    recipientCallState === "connecting" ||
    (activeCallState === "answered" && recipientCallState !== "connected");
  const isConnected =
    recipientCallState === "connected" ||
    activeCallState === "connected";
  const isClassicReceiverCall = receiverUsesClassicCallBridge && (isRinging || isConnecting || isConnected);
  const isClassicReceiverRinging = receiverUsesClassicCallBridge && isRinging && !isConnecting && !isConnected;
  const canEndCall = isConnected || isConnecting || isRinging || hasServerActiveCall;
  const headline = isClassicReceiverCall && (isConnected || isConnecting)
    ? "Connected on Receiver."
    : isConnected
      ? `Connected with ${selectedPersonName}.`
    : isConnecting
      ? `Connecting with ${selectedPersonName}.`
    : isRinging
      ? isClassicReceiverCall
        ? "Call sent to Receiver"
        : "Incoming call"
      : recipientCallState === "ended"
        ? "Conversation ended."
        : recipientCallState === "declined"
          ? "Conversation was not established."
          : "Waiting for a Connect Request.";
  const subline = isClassicReceiverCall && (isConnected || isConnecting)
    ? "Use the Receiver handset or speaker."
    : isConnected
      ? "Live conversation in progress."
    : isConnecting
      ? "Receiver answered. Connecting live audio."
    : isRinging
      ? isClassicReceiverCall
        ? "Tap Answer on the Receiver."
        : "Your contact would like to talk now."
      : "A live conversation starts only if the recipient accepts.";
  const audioLabel =
    isClassicReceiverCall
      ? "Receiver handset"
      : callAudioStatus === "remote_audio" || callAudioStatus === "connected"
      ? "Live audio"
      : callAudioStatus === "microphone_ready" || callAudioStatus === "connecting"
        ? "Audio connecting"
        : callAudioStatus === "interrupted"
          ? "Audio interrupted"
          : callAudioStatus === "starting"
            ? "Starting audio"
            : isConnected || isConnecting
              ? "Waiting for audio"
              : "Audio idle";
  const audioDetail =
    isClassicReceiverCall
      ? isConnected
        ? "Audio is handled by the Receiver device."
        : "Audio will be handled by the Receiver after it is answered."
      : callAudioStatus === "remote_audio"
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
                : isConnecting
                  ? "Receiver answered. Waiting for the browser audio link."
                : "Audio starts after the call is answered.";
  const canRestartAudio =
    !isClassicReceiverCall &&
    (isConnected || isConnecting) &&
    callAudioStatus !== "remote_audio" &&
    callAudioStatus !== "connected";
  const canControlBrowserAudio = !isClassicReceiverCall;
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full bg-[#edf5fc] px-4 py-2 text-sm font-black uppercase tracking-normal text-[#345d83]">
            {isConnected ? "Active call" : isConnecting ? "Connecting" : isRinging ? "Ringing" : "No active call"}
          </span>
          {canEndCall ? (
            <button
              className="min-h-10 rounded-md bg-[#a43f34] px-4 text-sm font-black text-white hover:bg-[#8d342b]"
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
          ) : null}
        </div>
      </div>
      {isRinging ? (
        <div className="mb-4 rounded-lg border border-[#d6e3f2] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-2xl font-black text-[#173150]">
                {isClassicReceiverRinging ? "Call sent to Receiver" : "Your contact is calling"}
              </h3>
              <p className="mt-1 text-lg font-semibold text-[#5f6e84]">
                {isClassicReceiverRinging ? "Answer on the Receiver." : "Press Answer to talk."}
              </p>
            </div>
            {isClassicReceiverRinging ? (
              <button
                className="min-h-12 rounded-md bg-[#a43f34] px-6 text-lg font-black text-white hover:bg-[#8d342b]"
                onClick={() => updateCall("ended", "The call was canceled.")}
                type="button"
              >
                Cancel Call
              </button>
            ) : (
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
            )}
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
            {canControlBrowserAudio && callMuted ? "Your microphone is muted." : audioDetail}
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
          {canControlBrowserAudio ? (
            <button
              className="min-h-11 rounded-md border border-[#d6e3f2] bg-white px-4 text-sm font-black text-[#345d83] hover:bg-[#edf5fc] disabled:opacity-45"
              disabled={!isConnected}
              onClick={onToggleMuted}
              type="button"
            >
              {callMuted ? "Unmute" : "Mute"}
            </button>
          ) : null}
        </div>
      </div>
      {canShowDiagnostics ? (
        <CallPathDiagnosticsPanel
          callAudioStatus={callAudioStatus}
          diagnostics={callPathDiagnostics}
          onRefresh={onRefreshCallPathDiagnostics}
          receiverId={selectedReceiverId}
          receiverLabel={selectedReceiverLabel}
        />
      ) : null}
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
                <div className="mt-3">
                  <p className="text-xs font-black uppercase tracking-normal text-[#5f6e84]">
                    Raw temporary transcript
                  </p>
                  <p className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded border border-[#d6e3f2] bg-white p-3 text-sm font-semibold leading-relaxed text-[#173150]">
                    {transcriptText}
                  </p>
                </div>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}
      {pendingSummaryReviewCount > 0 ? (
        <div className="mt-3 rounded-lg border border-[#d8c48b] bg-[#fff9e8] p-4">
          <p className="text-sm font-black uppercase tracking-normal text-[#5a4b1e]">
            Call note needs review
          </p>
          <p className="mt-2 text-base font-semibold leading-relaxed text-[#173150]">
            {pendingSummaryReviewCount === 1
              ? "1 call summary is waiting for review on the Receiver."
              : `${pendingSummaryReviewCount} call summaries are waiting for review on the Receiver.`}
          </p>
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
      <div className={`mt-3 grid gap-2 ${receiverUsesClassicCallBridge ? "" : "sm:grid-cols-2"}`}>
        {!receiverUsesClassicCallBridge ? (
          <button
            className="min-h-12 rounded-md bg-[#b6cfe8] px-4 text-base font-black text-white hover:bg-[#345d83] disabled:opacity-45"
            disabled={!isRinging}
            onClick={() => updateCall("connected", `${selectedPersonName} answered the call.`)}
            type="button"
          >
            Answer
          </button>
        ) : null}
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
        {!receiverUsesClassicCallBridge ? (
          <>
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
          </>
        ) : null}
      </div>
    </section>
  );
}

function CallPathDiagnosticsPanel({
  callAudioStatus,
  diagnostics,
  onRefresh,
  receiverId,
  receiverLabel,
}: {
  callAudioStatus: ConnectCallAudioStatus;
  diagnostics: CallPathDiagnostics;
  onRefresh: () => void;
  receiverId: string;
  receiverLabel: string;
}) {
  const endpointReady = diagnostics.endpointStatus === "ready";
  const endpointChecking = diagnostics.endpointStatus === "checking";
  const endpointLabel =
    diagnostics.endpointStatus === "ready"
      ? "Ready"
      : diagnostics.endpointStatus === "checking"
        ? "Checking"
        : diagnostics.endpointStatus === "unavailable"
          ? "Unavailable"
          : "Not checked";
  const items = [
    {
      detail: diagnostics.isSecureContext ? "HTTPS or localhost" : "Browser blocks microphone",
      label: "Secure browser",
      tone: diagnostics.isSecureContext ? "good" : "bad",
      value: diagnostics.isSecureContext ? "Yes" : "No",
    },
    {
      detail: diagnostics.microphoneApiAvailable ? "mediaDevices available" : "No mediaDevices API",
      label: "Microphone API",
      tone: diagnostics.microphoneApiAvailable ? "good" : "bad",
      value: diagnostics.microphoneApiAvailable ? "Ready" : "Missing",
    },
    {
      detail: diagnostics.error || `${diagnostics.iceServerCount} ICE server${diagnostics.iceServerCount === 1 ? "" : "s"}`,
      label: "ICE endpoint",
      tone: endpointReady ? "good" : endpointChecking ? "warn" : "bad",
      value: endpointLabel,
    },
    {
      detail: diagnostics.hasTurnServer ? "Relay server included" : "STUN only",
      label: "TURN relay",
      tone: diagnostics.hasTurnServer ? "good" : "warn",
      value: diagnostics.hasTurnServer ? "Available" : "Missing",
    },
    {
      detail: shortDiagnosticId(receiverId),
      label: "Receiver",
      tone: receiverId ? "good" : "warn",
      value: receiverLabel || "None",
    },
    {
      detail: callAudioStatus === "idle" ? "No active browser audio" : "Live controller status",
      label: "Audio status",
      tone:
        callAudioStatus === "connected" || callAudioStatus === "remote_audio"
          ? "good"
          : callAudioStatus === "interrupted"
            ? "bad"
            : "warn",
      value: readableDiagnosticStatus(callAudioStatus),
    },
  ] as const;

  return (
    <details className="mt-3 rounded-lg border border-[#d6e3f2] bg-white p-4 shadow-sm" open>
      <summary className="cursor-pointer list-none text-sm font-black uppercase tracking-normal text-[#5f6e84]">
        Call path diagnostics
      </summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            className={`rounded-md border px-3 py-2 ${diagnosticToneClass(item.tone)}`}
            key={item.label}
          >
            <p className="text-xs font-black uppercase tracking-normal opacity-75">
              {item.label}
            </p>
            <p className="mt-1 truncate text-sm font-black">{item.value}</p>
            <p className="mt-1 truncate text-xs font-bold opacity-75">{item.detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-[#5f6e84]">
          {diagnostics.checkedAt
            ? `Checked ${formatCallPathCheckedAt(diagnostics.checkedAt)}`
            : "Not checked yet"}
        </p>
        <button
          className="min-h-9 rounded-md border border-[#d6e3f2] bg-white px-3 text-xs font-black text-[#345d83] hover:bg-[#edf5fc] disabled:opacity-55"
          disabled={endpointChecking}
          onClick={onRefresh}
          type="button"
        >
          {endpointChecking ? "Checking" : "Refresh"}
        </button>
      </div>
    </details>
  );
}

function readBrowserCallPathBasics() {
  return {
    isSecureContext: typeof window !== "undefined" && window.isSecureContext,
    microphoneApiAvailable:
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
  };
}

function isCallPathIceServer(value: unknown): value is RTCIceServer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const urls = (value as { urls?: unknown }).urls;
  if (typeof urls === "string") return Boolean(urls.trim());
  if (Array.isArray(urls)) {
    return urls.some((url) => typeof url === "string" && Boolean(url.trim()));
  }
  return false;
}

function callPathIceServerUsesTurn(server: RTCIceServer) {
  const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
  return urls.some((url) => String(url || "").startsWith("turn:"));
}

function diagnosticToneClass(tone: "bad" | "good" | "warn") {
  if (tone === "good") return "border-[#b9d4ba] bg-[#f7fcf5] text-[#173b22]";
  if (tone === "bad") return "border-[#e7c3bf] bg-[#fff6f5] text-[#7f1d1d]";
  return "border-[#d8c48b] bg-[#fff9e8] text-[#5a4b1e]";
}

function shortDiagnosticId(value: string) {
  const normalized = value.trim();
  if (!normalized) return "No Receiver id";
  if (normalized.length <= 18) return normalized;
  return `${normalized.slice(0, 8)}...${normalized.slice(-6)}`;
}

function formatCallPathCheckedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function readableDiagnosticStatus(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ") || "Idle";
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
