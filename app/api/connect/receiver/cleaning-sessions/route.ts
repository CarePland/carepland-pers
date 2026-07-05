import { NextResponse } from "next/server";

import {
  readReceiverDeviceScopedAccess,
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import {
  recordLocalReceiverCleaningSession,
  recordSupabaseReceiverCleaningSession,
  type ReceiverCleaningSessionInput,
} from "@/app/lib/connect/receiverShell/localReceiverCleaningSessions";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as ReceiverCleaningSessionInput;

    if (!payload.cleaningStartedAt && !payload.sessionId) {
      return NextResponse.json(
        { error: "Screen cleaning session requires a start time or session id.", ok: false },
        { status: 400 }
      );
    }

    const binding = await readReceiverDeviceScopedAccess(request, {
      body: payload as unknown as Record<string, unknown>,
    });
    const sessionPayload: ReceiverCleaningSessionInput = {
      ...payload,
      mainConnectUserPersonId:
        payload.mainConnectUserPersonId || binding.mainConnectUserPersonId || "",
      receiverDeviceId: payload.receiverDeviceId || binding.receiverDeviceId,
      receiverInstallId: payload.receiverInstallId || binding.receiverInstallId,
    };

    const supabaseSession = await recordSupabaseReceiverCleaningSession(sessionPayload).catch(
      () => null
    );
    const localSession = supabaseSession
      ? null
      : await recordLocalReceiverCleaningSession(sessionPayload);

    return NextResponse.json({
      ok: true,
      sessionId: supabaseSession?.sessionId || localSession?.sessionId,
      source: supabaseSession ? "supabase" : "local",
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
            : "Unable to record Receiver screen cleaning session.",
        ok: false,
      },
      { status: 400 }
    );
  }
}
