import { NextResponse } from "next/server";

import {
  emptyConnectCallSummary,
  filterCallsForMainConnectUser,
  mergeConnectCalls,
  summarizeConnectCalls,
  type ConnectCallRecord,
} from "@/app/lib/connect/calls/callScoping";
import { readConnectCallPersonAccessForRequest } from "@/app/lib/connect/calls/server/callAccess";
import {
  cleanupExpiredLocalConnectCallTranscripts,
  markStaleLocalConnectCallsMissed,
  readLocalConnectCalls,
} from "@/app/lib/connect/calls/server/localCalls";
import {
  cleanupExpiredSupabaseConnectCallTranscripts,
  markStaleSupabaseConnectCallsMissed,
  readSupabaseConnectCalls,
} from "@/app/lib/connect/calls/server/supabaseCallStore";
import { connectPrototypeEndpoints } from "@/app/lib/connect/prototypeClient";

export async function GET(request: Request) {
  try {
    const personId = new URL(request.url).searchParams.get("personId")?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        {
          error: "Select a Main Connect User before loading Connect call summary.",
          mainConnectUserPersonId: null,
          ok: false,
          summary: emptyConnectCallSummary(),
        },
        { status: 400 }
      );
    }

    const access = await readConnectCallPersonAccessForRequest(request, personId);

    await Promise.all([
      cleanupExpiredLocalConnectCallTranscripts({ mainConnectUserPersonId: personId }),
      cleanupExpiredSupabaseConnectCallTranscripts(access),
      markStaleLocalConnectCallsMissed(),
      markStaleSupabaseConnectCallsMissed(access),
    ]);
    const [prototypeCalls, localCallIndex, supabaseCalls] = await Promise.all([
      fetchPrototypeCalls(),
      readLocalConnectCalls(),
      readSupabaseConnectCalls(access),
    ]);
    const calls = filterCallsForMainConnectUser(
      mergeConnectCalls(supabaseCalls ?? localCallIndex.calls, prototypeCalls),
      personId
    );

    return NextResponse.json({
      mainConnectUserPersonId: personId,
      ok: true,
      summary: summarizeConnectCalls(calls),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load Connect call summary.",
        mainConnectUserPersonId: null,
        ok: false,
        summary: emptyConnectCallSummary(),
      },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      action?: string;
      personId?: string;
    };
    const personId = payload.personId?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        {
          error: "Select a Main Connect User before cleaning up call transcripts.",
          ok: false,
        },
        { status: 400 }
      );
    }
    if (payload.action !== "cleanup_expired_transcripts") {
      return NextResponse.json(
        { error: "Unsupported call summary cleanup action.", ok: false },
        { status: 400 }
      );
    }

    const access = await readConnectCallPersonAccessForRequest(request, personId);
    const [localCount, supabaseCount] = await Promise.all([
      cleanupExpiredLocalConnectCallTranscripts({ mainConnectUserPersonId: personId }),
      cleanupExpiredSupabaseConnectCallTranscripts(access),
    ]);

    return NextResponse.json({
      cleanedCount: (localCount ?? 0) + (supabaseCount ?? 0),
      mainConnectUserPersonId: personId,
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to clean up expired Connect transcripts.",
        ok: false,
      },
      { status: 401 }
    );
  }
}

async function fetchPrototypeCalls() {
  try {
    const response = await fetch(connectPrototypeEndpoints.calls, { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as {
      calls?: ConnectCallRecord[];
    };

    return response.ok ? payload.calls ?? [] : [];
  } catch {
    return [];
  }
}
