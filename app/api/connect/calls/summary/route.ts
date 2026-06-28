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
  markStaleLocalConnectCallsMissed,
  readLocalConnectCalls,
} from "@/app/lib/connect/calls/server/localCalls";
import {
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
