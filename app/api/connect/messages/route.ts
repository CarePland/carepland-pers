import { NextResponse } from "next/server";

import { connectPrototypeEndpoints } from "@/app/lib/connect/prototypeClient";
import {
  ensureAudioMessageOriginalPreserved,
  type ConnectAudioMessagePayload,
} from "@/app/lib/connect/messaging/server/audioMessagePersistence";
import { verifyConnectMessagePersonAccess } from "@/app/lib/connect/messaging/server/messageAccess";
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
import type { ConnectMessageRecord } from "@/app/lib/connect/messaging";

export async function GET(request: Request) {
  try {
    const personId = new URL(request.url).searchParams.get("personId")?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        {
          error: "Select a Main Connect User before loading Connect messages.",
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

    const deniedResponse = await verifyConnectMessagePersonAccess(personId, request, {
      localMessages: [],
      mainConnectUserPersonId: personId,
      messages: [],
      prototypeMessages: [],
      summary: emptyConnectMessagesSummary(),
    });
    if (deniedResponse) return deniedResponse;

    const localIndex = await readLocalConnectMessages();
    const prototypeMessages = await fetchPrototypeMessages();
    const localMessages = filterMessagesForMainConnectUser(localIndex.messages, personId);
    const scopedPrototypeMessages = filterMessagesForMainConnectUser(
      prototypeMessages,
      personId
    );
    const messages = filterMessagesForMainConnectUser(
      mergeConnectMessages(localIndex.messages, prototypeMessages),
      personId
    );

    return NextResponse.json(
      {
        localMessages,
        mainConnectUserPersonId: personId,
        messages,
        ok: true,
        prototypeMessages: scopedPrototypeMessages,
        summary: summarizeConnectMessages({
          localMessages,
          messages,
          prototypeMessages: scopedPrototypeMessages,
        }),
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load Connect messages.",
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

    const deniedResponse = await verifyConnectMessagePersonAccess(
      payload.mainConnectUserPersonId,
      request
    );
    if (deniedResponse) return deniedResponse;

    const messagePayload = await ensureAudioMessageOriginalPreserved(payload);
    const message = await recordLocalConnectMessage(messagePayload);

    void forwardPrototypeMessage(messagePayload);

    return NextResponse.json({
      message,
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to save Connect message.",
        ok: false,
      },
      { status: 401 }
    );
  }
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
