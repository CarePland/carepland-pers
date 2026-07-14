import { NextResponse, type NextRequest } from "next/server";

import {
  ConnectPersonAccessDeniedError,
} from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import { readConnectMessagePersonAccessForRequest } from "@/app/lib/connect/messaging/server/messageAccess";

type AppointmentRow = {
  care_circle_id: string | null;
  care_subject_id: string | null;
  id: string;
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
  read_at?: string | null;
  recipient_display_name?: string | null;
  requires_acknowledgement?: boolean | null;
  sender_display_name?: string | null;
  sender_role?: string | null;
  transcript?: string | null;
  transcript_status?: string | null;
  updated_at?: string | null;
};

const messageSelectColumns = [
  "id",
  "main_connect_user_person_id",
  "appointment_id",
  "sender_role",
  "sender_display_name",
  "recipient_display_name",
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
  "client_message_id",
  "created_at",
  "updated_at",
].join(",");

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const personId = requestUrl.searchParams.get("personId")?.trim() ?? "";
    const appointmentId = requestUrl.searchParams.get("appointmentId")?.trim() ?? "";
    const limit = boundedLimit(requestUrl.searchParams.get("limit"));

    if (!personId) {
      return NextResponse.json(
        { error: "Choose a Care VIP before loading messages.", messages: [], ok: false },
        { status: 400 }
      );
    }

    const access = await readConnectMessagePersonAccessForRequest(request, personId);

    if (appointmentId) {
      const appointment = await readAccessibleAppointment(
        access.supabase,
        appointmentId,
        access.mainConnectUserPersonId,
        access.careCircleId
      );

      if (!appointment) {
        return NextResponse.json(
          {
            error: "That appointment is not available for this Care VIP.",
            messages: [],
            ok: false,
          },
          { status: 403 }
        );
      }
    }

    let query = access.supabase
      .from("connect_messages")
      .select(messageSelectColumns)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .eq("care_circle_id", access.careCircleId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (appointmentId) {
      query = query.eq("appointment_id", appointmentId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      messages: ((data ?? []) as unknown as ConnectMessageRow[]).map(messageFromRow),
      ok: true,
      person: {
        displayName: "Care VIP",
        id: access.mainConnectUserPersonId,
      },
    });
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(
        { messages: [], ...receiverDeviceSetupRequiredBody(error) },
        { status: error.status }
      );
    }
    if (error instanceof ConnectPersonAccessDeniedError) {
      return NextResponse.json(
        {
          error: "Choose a Care VIP from your CarePland collection.",
          messages: [],
          ok: false,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: errorMessage(error, "Unable to load messages."),
        messages: [],
        ok: false,
      },
      { status: 503 }
    );
  }
}

async function readAccessibleAppointment(
  supabase: Awaited<ReturnType<typeof readConnectMessagePersonAccessForRequest>>["supabase"],
  appointmentId: string,
  personId: string,
  careCircleId: string
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id,care_circle_id,care_subject_id")
    .eq("id", appointmentId)
    .eq("care_circle_id", careCircleId)
    .eq("care_subject_id", personId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AppointmentRow | null;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const payload = error as Record<string, unknown>;
    const parts = [
      payload.message,
      payload.details,
      payload.hint,
      payload.code ? `Code: ${payload.code}` : "",
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  const normalized = String(error || "").trim();
  return normalized || fallback;
}

function messageFromRow(row: ConnectMessageRow) {
  const inferredAppointmentId =
    row.appointment_id || appointmentIdFromClientMessageId(row.client_message_id);

  return {
    acknowledgedAt: row.acknowledged_at || "",
    allowsCallbackRequest: Boolean(row.allows_callback_request),
    appointmentId: inferredAppointmentId,
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
    readAt: row.read_at || "",
    requiresAcknowledgement: Boolean(row.requires_acknowledgement),
    senderRole: row.sender_role || "",
    to: row.recipient_display_name || "",
    transcript: row.transcript || "",
    transcriptStatus: row.transcript_status || "",
    updatedAt: row.updated_at || row.created_at,
  };
}

function appointmentIdFromClientMessageId(value: string | null | undefined) {
  const match = String(value || "").match(
    /^appointment-(?:text|audio)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})-\d+$/
  );

  return match?.[1] ?? "";
}

function senderFallbackName(role: string | null | undefined) {
  return role === "receiver" ? "Receiver" : "Care coordinator";
}

function boundedLimit(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.max(1, Math.min(50, Math.round(parsed)));
}
