import { NextResponse } from "next/server";

import {
  ConnectPersonAccessDeniedError,
} from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  ReceiverDeviceAccessError,
  receiverDeviceCredentialsFromRequest,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import { connectPrototypeEndpoints } from "@/app/lib/connect/prototypeClient";
import {
  ensureAudioMessageOriginalPreserved,
  type ConnectAudioMessagePayload,
} from "@/app/lib/connect/messaging/server/audioMessagePersistence";
import { readConnectMessagePersonAccessForRequest } from "@/app/lib/connect/messaging/server/messageAccess";
import {
  readLocalConnectMessages,
  recordLocalConnectMessage,
} from "@/app/lib/connect/messaging/server/localMessages";
import {
  emptyConnectMessagesSummary,
  filterMessagesForMainConnectUser,
  mergeConnectMessages,
  summarizeConnectMessages,
} from "@/app/lib/connect/messaging/server/messageScoping";
import {
  readSupabaseConnectMessages,
  recordSupabaseConnectMessage,
  recordSupabaseConnectMessageStrict,
} from "@/app/lib/connect/messaging/server/supabaseMessages";
import { personHasAttachedReceiver } from "@/app/lib/connect/messaging/receiverAttachment";
import type { ConnectMessageRecord } from "@/app/lib/connect/messaging";
import { listReceiverShellDeviceProfiles } from "@/app/lib/connect/receiverShell/claimStore";

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

export async function GET(request: Request) {
  try {
    const requestedPersonId =
      new URL(request.url).searchParams.get("personId")?.trim() ?? "";
    const receiverCredentials = receiverDeviceCredentialsFromRequest(request);

    if (!requestedPersonId && !receiverCredentials.hasAnyCredential) {
      return NextResponse.json(
        {
          error: "Select a person before loading Connect messages.",
          localMessages: [],
          mainConnectUserPersonId: null,
          messages: [],
          ok: false,
          prototypeMessages: [],
          summary: emptyConnectMessagesSummary(),
        },
        { status: 400 }
      );
    }

    const access = await readConnectMessagePersonAccessForRequest(
      request,
      requestedPersonId
    );
    const personId = access.mainConnectUserPersonId;

    const localIndex = await readLocalConnectMessages();
    const supabaseMessages = await readSupabaseConnectMessages(access);
    const prototypeMessages = await fetchPrototypeMessages();
    const localMessages = filterMessagesForMainConnectUser(localIndex.messages, personId);
    const scopedPrototypeMessages = filterMessagesForMainConnectUser(
      prototypeMessages,
      personId
    );
    const primaryMessages = supabaseMessages
      ? mergeConnectMessages(supabaseMessages, localIndex.messages)
      : localIndex.messages;
    const messages = filterMessagesForMainConnectUser(
      mergeConnectMessages(primaryMessages, prototypeMessages),
      personId
    );

    return NextResponse.json(
      {
        durableMessages: supabaseMessages ?? [],
        localMessages,
        mainConnectUserPersonId: personId,
        messages,
        ok: true,
        prototypeMessages: scopedPrototypeMessages,
        summary: summarizeConnectMessages({
          localMessages: supabaseMessages ?? localMessages,
          messages,
          prototypeMessages: scopedPrototypeMessages,
        }),
      }
    );
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(
        {
          localMessages: [],
          mainConnectUserPersonId: null,
          messages: [],
          prototypeMessages: [],
          summary: emptyConnectMessagesSummary(),
          ...receiverDeviceSetupRequiredBody(error),
        },
        { status: error.status }
      );
    }
    if (error instanceof ConnectPersonAccessDeniedError) {
      return NextResponse.json(
        {
          error: "Choose a Main Connect User from your CarePland collection.",
          localMessages: [],
          mainConnectUserPersonId: null,
          messages: [],
          ok: false,
          prototypeMessages: [],
          summary: emptyConnectMessagesSummary(),
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: errorMessage(error, "Unable to load Connect messages."),
        localMessages: [],
        mainConnectUserPersonId: null,
        messages: [],
        ok: false,
        prototypeMessages: [],
        summary: emptyConnectMessagesSummary(),
      },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as ConnectAudioMessagePayload;

    if (!payload.mainConnectUserPersonId) {
      return NextResponse.json(
        { error: "Select a Main Connect User before sending Connect messages.", ok: false },
        { status: 400 }
      );
    }

    const access = await readConnectMessagePersonAccessForRequest(
      request,
      payload.mainConnectUserPersonId,
      payload as unknown as Record<string, unknown>
    );
    if (access.accessType === "receiver_device" && access.receiverContactIsReceiverUser) {
      return NextResponse.json(
        { error: "You can't send a message to yourself.", ok: false },
        { status: 409 }
      );
    }
    if (access.accessType === "receiver_device" && !access.receiverContactUserId) {
      return NextResponse.json(
        { error: "Receiver contact setup is required.", ok: false },
        { status: 409 }
      );
    }
    if (
      access.accessType === "user" &&
      !(await personHasReceiverForMessaging(access.mainConnectUserPersonId))
    ) {
      return NextResponse.json(
        {
          error: "Messaging is available after this person is attached to a Receiver.",
          ok: false,
        },
        { status: 409 }
      );
    }

    const messagePayload = await ensureAudioMessageOriginalPreserved({
      ...payload,
      metadata: {
        ...(payload.metadata ?? {}),
        recipientDisplayNameSnapshot:
          stringValue(payload.metadata?.recipientDisplayNameSnapshot) ||
          payload.to ||
          "",
        recipientPersonId: access.mainConnectUserPersonId,
      },
      recipientPersonId: access.mainConnectUserPersonId,
    });
    const message = messagePayload.appointmentId
      ? await recordSupabaseConnectMessageStrict(messagePayload, access)
      : (await recordSupabaseConnectMessage(messagePayload, access)) ??
        (await recordLocalConnectMessage(messagePayload));

    void forwardPrototypeMessage(messagePayload);

    return NextResponse.json({
      message,
      ok: true,
    });
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(receiverDeviceSetupRequiredBody(error), {
        status: error.status,
      });
    }
    if (error instanceof ConnectPersonAccessDeniedError) {
      return NextResponse.json(
        {
          error: "Choose a Main Connect User from your CarePland collection.",
          ok: false,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: errorMessage(error, "Unable to save Connect message."),
        ok: false,
      },
      { status: 503 }
    );
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function personHasReceiverForMessaging(personId: string) {
  const devices = await listReceiverShellDeviceProfiles();
  return personHasAttachedReceiver(devices, personId);
}

async function fetchPrototypeMessages() {
  try {
    const response = await fetch(connectPrototypeEndpoints.messages, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      messages?: ConnectMessageRecord[];
    };

    return response.ok ? payload.messages ?? [] : [];
  } catch {
    return [];
  }
}

async function forwardPrototypeMessage(payload: Partial<ConnectMessageRecord>) {
  try {
    await fetch(connectPrototypeEndpoints.messages, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    // Next local message storage remains the source of truth for this dev path.
  }
}
