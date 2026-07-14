import type { SupabaseClient } from "@supabase/supabase-js";

import {
  markAppointmentCommunicationSummaryFailed,
  updateAppointmentCommunicationSummaryForMessage,
} from "../../../personal/appointments/communicationSummary";
import type { ConnectPersonScopedAccess } from "../../context/server/personScopedAccess";
import type { ConnectMessageRecord } from "../types";

import type { ConnectMessageState } from "./messageState";

type ConnectMessageAccess = Pick<
  ConnectPersonScopedAccess,
  | "accessType"
  | "careCircleId"
  | "createdByUserId"
  | "mainConnectUserPersonId"
  | "supabase"
> & {
  receiverDeviceId?: string;
};

type ConnectMessageRow = {
  acknowledged_at?: string | null;
  allows_callback_request?: boolean | null;
  appointment_id?: string | null;
  audio_artifact_id?: string | null;
  audio_duration_ms?: number | null;
  audio_mime_type?: string | null;
  audio_url?: string | null;
  body?: string | null;
  callback_requested_at?: string | null;
  client_message_id?: string | null;
  created_at: string;
  delivered_at?: string | null;
  heard_at?: string | null;
  id: string;
  main_connect_user_person_id: string;
  message_type?: string | null;
  metadata?: Record<string, unknown> | null;
  read_at?: string | null;
  receiver_device_id?: string | null;
  recipient_display_name?: string | null;
  requires_acknowledgement?: boolean | null;
  sender_display_name?: string | null;
  sender_role?: string | null;
  sender_user_id?: string | null;
  source?: string | null;
  transcript?: string | null;
  transcript_status?: string | null;
  updated_at?: string | null;
};

type ConnectMessageAppointmentRow = {
  id: string;
  starts_at?: string | null;
  title?: string | null;
  reason?: string | null;
};

const connectMessageSelectColumns = [
  "id",
  "main_connect_user_person_id",
  "receiver_device_id",
  "recipient_display_name",
  "sender_role",
  "sender_user_id",
  "sender_display_name",
  "body",
  "message_type",
  "audio_artifact_id",
  "audio_url",
  "audio_mime_type",
  "audio_duration_ms",
  "transcript",
  "transcript_status",
  "requires_acknowledgement",
  "allows_callback_request",
  "delivered_at",
  "read_at",
  "heard_at",
  "acknowledged_at",
  "callback_requested_at",
  "appointment_id",
  "client_message_id",
  "source",
  "metadata",
  "created_at",
  "updated_at",
].join(",");

export async function readSupabaseConnectMessages(access: ConnectMessageAccess) {
  return trySupabaseMessageStore(async (supabase) => {
    const { data, error } = await supabase
      .from("connect_messages")
      .select(connectMessageSelectColumns)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;
    const messages = ((data ?? []) as unknown as ConnectMessageRow[]).map(
      connectMessageRecordFromRow
    );
    return enrichConnectMessagesWithAppointments(messages, access);
  }, access);
}

export async function recordSupabaseConnectMessage(
  input: Partial<ConnectMessageRecord>,
  access: ConnectMessageAccess
) {
  return trySupabaseMessageStore(async (supabase) => {
    return insertSupabaseConnectMessage(input, access, supabase);
  }, access);
}

export async function recordSupabaseConnectMessageStrict(
  input: Partial<ConnectMessageRecord>,
  access: ConnectMessageAccess
) {
  return insertSupabaseConnectMessage(input, access, access.supabase);
}

export async function updateSupabaseConnectMessageState(
  messageId: string,
  state: ConnectMessageState,
  access: ConnectMessageAccess,
  options: { receiverDeviceId?: string } = {}
) {
  return trySupabaseMessageStore(async (supabase) => {
    const now = new Date().toISOString();
    const update = connectMessageStateUpdate(state, now);
    const { data, error } = await supabase
      .from("connect_messages")
      .update(update)
      .eq("id", messageId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .select(connectMessageSelectColumns)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    await recordSupabaseConnectMessageEvent(
      supabase,
      messageId,
      state,
      {
        ...access,
        receiverDeviceId: options.receiverDeviceId || access.receiverDeviceId,
      },
      {}
    );
    return connectMessageRecordFromRow(data as unknown as ConnectMessageRow);
  }, access);
}

export function connectMessageInsertFromInput(
  input: Partial<ConnectMessageRecord>,
  access: ConnectMessageAccess
) {
  const senderRole = normalizeSenderRole(input.senderRole || input.from, access);

  return {
    allows_callback_request: Boolean(input.allowsCallbackRequest),
    appointment_id: input.appointmentId || null,
    audio_artifact_id: input.audioArtifactId || "",
    audio_duration_ms:
      typeof input.audioDurationMs === "number" && Number.isFinite(input.audioDurationMs)
        ? Math.max(0, Math.round(input.audioDurationMs))
        : null,
    audio_mime_type: input.audioMimeType || "",
    audio_url: input.audioUrl || "",
    body: input.body || input.transcript || "Voice message",
    care_circle_id: access.careCircleId,
    client_message_id: input.clientMessageId || "",
    main_connect_user_person_id: access.mainConnectUserPersonId,
    message_type: input.messageType || (input.audioUrl ? "audio" : "text"),
    metadata: input.metadata ?? {},
    receiver_device_id: access.receiverDeviceId || null,
    recipient_display_name: input.to || "",
    requires_acknowledgement: Boolean(input.requiresAcknowledgement),
    sender_display_name:
      input.from || (senderRole === "receiver" ? "Receiver" : "Care coordinator"),
    sender_role: senderRole,
    sender_user_id: senderRole === "dashboard" ? access.createdByUserId : null,
    source: input.source || "connect_message",
    transcript: input.transcript || "",
    transcript_status: input.transcriptStatus || "",
  };
}

export function connectMessageStateUpdate(
  state: ConnectMessageState,
  timestamp: string
) {
  return {
    acknowledged_at: state === "acknowledged" ? timestamp : undefined,
    callback_requested_at:
      state === "callback_requested" ? timestamp : undefined,
    heard_at: state === "heard" ? timestamp : undefined,
    read_at: state === "read" ? timestamp : undefined,
    updated_at: timestamp,
  };
}

export function connectMessageRecordFromRow(
  row: ConnectMessageRow
): ConnectMessageRecord {
  const inferredAppointmentId =
    row.appointment_id || appointmentIdFromClientMessageId(row.client_message_id);

  return {
    acknowledgedAt: row.acknowledged_at || "",
    allowsCallbackRequest: Boolean(row.allows_callback_request),
    appointmentId: inferredAppointmentId,
    appointmentStartsAt: "",
    appointmentTitle: "",
    audioArtifactId: row.audio_artifact_id || "",
    audioDurationMs: row.audio_duration_ms ?? undefined,
    audioMimeType: row.audio_mime_type || "",
    audioUrl: row.audio_url || "",
    body: row.body || row.transcript || "Voice message",
    callbackRequestedAt: row.callback_requested_at || "",
    clientMessageId: row.client_message_id || "",
    createdAt: row.created_at,
    deliveredAt: row.delivered_at || "",
    from: row.sender_display_name || senderFallbackName(row.sender_role),
    heardAt: row.heard_at || "",
    id: row.id,
    mainConnectUserPersonId: row.main_connect_user_person_id,
    messageType: row.message_type || "text",
    metadata: row.metadata ?? {},
    readAt: row.read_at || "",
    receiverDeviceId: row.receiver_device_id || "",
    receiverId: row.receiver_device_id || "",
    requiresAcknowledgement: Boolean(row.requires_acknowledgement),
    senderRole: row.sender_role || "",
    senderUserId: row.sender_user_id || "",
    source: row.source || "connect_message",
    to: row.recipient_display_name || "",
    transcript: row.transcript || "",
    transcriptStatus: row.transcript_status || "",
    updatedAt: row.updated_at || row.created_at,
  };
}

export async function enrichConnectMessagesWithAppointments(
  messages: ConnectMessageRecord[],
  access: ConnectMessageAccess
) {
  const appointmentIds = Array.from(
    new Set(
      messages
        .map((message) => String(message.appointmentId || "").trim())
        .filter(Boolean)
    )
  );

  if (!appointmentIds.length) {
    return messages;
  }

  const { data, error } = await access.supabase
    .from("appointments")
    .select("id,title,reason,starts_at")
    .in("id", appointmentIds)
    .eq("care_circle_id", access.careCircleId)
    .eq("care_subject_id", access.mainConnectUserPersonId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  const appointmentsById = new Map(
    ((data ?? []) as unknown as ConnectMessageAppointmentRow[]).map((appointment) => [
      appointment.id,
      appointment,
    ])
  );

  return messages.map((message) => {
    const appointment = appointmentsById.get(String(message.appointmentId || ""));
    if (!appointment) return message;

    return {
      ...message,
      appointmentStartsAt: appointment.starts_at || "",
      appointmentTitle:
        appointment.title?.trim() ||
        appointment.reason?.trim() ||
        "Untitled appointment",
    };
  });
}

function appointmentIdFromClientMessageId(value: string | null | undefined) {
  const match = String(value || "").match(
    /^appointment-(?:text|audio)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})-\d+$/
  );

  return match?.[1] ?? "";
}

async function verifyMessageAppointmentAccess(
  appointmentId: string | undefined,
  access: ConnectMessageAccess
) {
  const normalizedAppointmentId = String(appointmentId || "").trim();

  if (!normalizedAppointmentId) {
    return;
  }

  const { data, error } = await access.supabase
    .from("appointments")
    .select("id,care_circle_id,care_subject_id,deleted_at")
    .eq("id", normalizedAppointmentId)
    .eq("care_circle_id", access.careCircleId)
    .eq("care_subject_id", access.mainConnectUserPersonId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Message appointment must belong to the selected Care VIP.");
  }
}

async function insertSupabaseConnectMessage(
  input: Partial<ConnectMessageRecord>,
  access: ConnectMessageAccess,
  supabase: SupabaseClient
) {
  await verifyMessageAppointmentAccess(input.appointmentId, access);
  const insert = connectMessageInsertFromInput(input, access);
  const { data, error } = await supabase
    .from("connect_messages")
    .insert(insert)
    .select(connectMessageSelectColumns)
    .single();

  if (error) throw error;
  const message = connectMessageRecordFromRow(data as unknown as ConnectMessageRow);
  await recordSupabaseConnectMessageEvent(
    supabase,
    message.id,
    "created",
    access,
    {
      clientMessageId: input.clientMessageId || "",
      messageType: message.messageType || "",
      source: input.source || "",
    }
  );
  if (message.appointmentId) {
    try {
      await updateAppointmentCommunicationSummaryForMessage(supabase, access, message);
    } catch (error) {
      await markAppointmentCommunicationSummaryFailed(supabase, access, message, error);
    }
  }
  return message;
}

async function recordSupabaseConnectMessageEvent(
  supabase: SupabaseClient,
  messageId: string,
  eventType: string,
  access: ConnectMessageAccess,
  details: Record<string, unknown>
) {
  const { error } = await supabase.from("connect_message_events").insert({
    actor_role: access.accessType === "receiver_device" ? "receiver" : "dashboard",
    actor_user_id:
      access.accessType === "receiver_device" ? null : access.createdByUserId,
    care_circle_id: access.careCircleId,
    details,
    event_type: eventType,
    main_connect_user_person_id: access.mainConnectUserPersonId,
    message_id: messageId,
    receiver_device_id: access.receiverDeviceId || null,
  });
  if (error) {
    // Message rows carry the authoritative lifecycle state. Event rows are
    // audit breadcrumbs and should not break local/dev fallback behavior.
  }
}

async function trySupabaseMessageStore<T>(
  callback: (supabase: SupabaseClient) => Promise<T>,
  access: ConnectMessageAccess
): Promise<T | null> {
  try {
    return await callback(access.supabase);
  } catch {
    return null;
  }
}

function normalizeSenderRole(
  value: string | undefined,
  access: ConnectMessageAccess
) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "receiver" || normalized === "receiver_user") return "receiver";
  if (normalized === "system") return "system";
  if (access.accessType === "receiver_device") return "receiver";
  return "dashboard";
}

function senderFallbackName(role: string | null | undefined) {
  return role === "receiver" ? "Receiver" : "Care coordinator";
}
