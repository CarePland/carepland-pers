import { NextResponse } from "next/server";

import { readConnectCallPersonAccessForRequest } from "@/app/lib/connect/calls/server/callAccess";
import {
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import {
  compactLocalConnectCallSignals,
  filterLocalConnectCallSignals,
  recordLocalConnectCallSignal,
} from "@/app/lib/connect/calls/server/localCallSignals";
import {
  recordSupabaseConnectCallEvent,
  readSupabaseConnectCallSignals,
  recordSupabaseConnectCallSignal,
} from "@/app/lib/connect/calls/server/supabaseCallStore";

type RouteContext = {
  params: Promise<{ callId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { callId } = await context.params;
    const url = new URL(request.url);
    const personId = url.searchParams.get("personId")?.trim() ?? "";
    const afterSignalId = url.searchParams.get("after")?.trim() ?? "";
    const notSender = url.searchParams.get("notSender")?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        {
          error: "Select a Main Connect User before loading Connect call audio signals.",
          ok: false,
          signals: [],
        },
        { status: 400 }
      );
    }

    const access = await readConnectCallPersonAccessForRequest(request, personId);

    const supabaseSignals = await readSupabaseConnectCallSignals(
      {
        afterSignalId,
        callId,
        notSender,
      },
      access
    );

    if (supabaseSignals) {
      return NextResponse.json({
        mainConnectUserPersonId: personId,
        ok: true,
        signals: supabaseSignals,
      });
    }

    const index = await compactLocalConnectCallSignals();
    return NextResponse.json({
      mainConnectUserPersonId: personId,
      ok: true,
      signals: filterLocalConnectCallSignals(index.signals, {
        afterSignalId,
        callId,
        mainConnectUserPersonId: personId,
        notSender,
      }),
    });
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(
        { signals: [], ...receiverDeviceSetupRequiredBody(error) },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Connect call audio signals.",
        ok: false,
        signals: [],
      },
      { status: 401 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { callId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      mainConnectUserPersonId?: string;
      payload?: Record<string, unknown>;
      sender?: string;
      type?: string;
    };
    const personId = payload.mainConnectUserPersonId?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        {
          error: "Select a Main Connect User before saving Connect call audio signals.",
          ok: false,
        },
        { status: 400 }
      );
    }

    const access = await readConnectCallPersonAccessForRequest(request, personId, payload);

    const signal =
      (await recordSupabaseConnectCallSignal(
        {
          callId,
          payload: payload.payload,
          sender: payload.sender,
          type: payload.type,
        },
        access
      )) ??
      (await recordLocalConnectCallSignal({
        callId,
        mainConnectUserPersonId: personId,
        payload: payload.payload,
        sender: payload.sender,
        type: payload.type,
      }));

    if (!signal) {
      return NextResponse.json(
        { error: "Connect call audio signal is invalid.", ok: false },
        { status: 400 }
      );
    }
    void recordSupabaseConnectCallEvent(
      {
        actorRole: payload.sender,
        callId,
        details: {
          mediaState:
            payload.type === "media_state"
              ? String(payload.payload?.state || "")
              : "",
          sender: payload.sender || "",
          signalType: payload.type || "",
          source: "connect_call_signal_post",
        },
        eventType: "call_signal_posted",
      },
      access
    );

    return NextResponse.json({
      mainConnectUserPersonId: personId,
      ok: true,
      signal,
    });
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(receiverDeviceSetupRequiredBody(error), {
        status: error.status,
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save Connect call audio signal.",
        ok: false,
      },
      { status: 401 }
    );
  }
}
