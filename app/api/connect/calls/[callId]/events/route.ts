import { NextResponse } from "next/server";

import { readConnectCallPersonAccessForRequest } from "@/app/lib/connect/calls/server/callAccess";
import {
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import { recordLocalConnectCallEvent } from "@/app/lib/connect/calls/server/localCallEvents";
import { recordSupabaseConnectCallEvent } from "@/app/lib/connect/calls/server/supabaseCallStore";

type RouteContext = {
  params: Promise<{ callId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { callId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      actorRole?: string;
      details?: Record<string, unknown>;
      eventType?: string;
      mainConnectUserPersonId?: string;
    };
    const personId = payload.mainConnectUserPersonId?.trim() ?? "";
    const eventType = payload.eventType?.trim() ?? "";

    if (!personId || !eventType) {
      return NextResponse.json(
        {
          error: "Connect call event requires a Main Connect User and event type.",
          ok: false,
        },
        { status: 400 }
      );
    }

    const access = await readConnectCallPersonAccessForRequest(request, personId, payload);
    const loggedInSupabase = await recordSupabaseConnectCallEvent(
      {
        actorRole: payload.actorRole,
        callId,
        details: payload.details,
        eventType,
      },
      access
    );
    const localEvent = loggedInSupabase
      ? null
      : await recordLocalConnectCallEvent({
          actorRole: payload.actorRole,
          callId,
          details: payload.details,
          eventType,
          mainConnectUserPersonId: personId,
        });

    return NextResponse.json({
      localEventId: localEvent?.eventId,
      mainConnectUserPersonId: personId,
      ok: true,
      source: loggedInSupabase ? "supabase" : "local",
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
            : "Unable to record Connect call event.",
        ok: false,
      },
      { status: 401 }
    );
  }
}
