import { NextResponse } from "next/server";

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

    const supabaseSession = await recordSupabaseReceiverCleaningSession(payload).catch(
      () => null
    );
    const localSession = supabaseSession
      ? null
      : await recordLocalReceiverCleaningSession(payload);

    return NextResponse.json({
      ok: true,
      sessionId: supabaseSession?.sessionId || localSession?.sessionId,
      source: supabaseSession ? "supabase" : "local",
    });
  } catch (error) {
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
