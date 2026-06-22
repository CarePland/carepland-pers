import { NextResponse } from "next/server";

import {
  emptyConnectCallSummary,
  filterCallsForMainConnectUser,
  summarizeConnectCalls,
  type ConnectCallRecord,
} from "@/app/lib/connect/calls/callScoping";
import { verifyConnectCallPersonAccess } from "@/app/lib/connect/calls/server/callAccess";
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

    const deniedResponse = await verifyConnectCallPersonAccess(request, personId, {
      mainConnectUserPersonId: null,
      summary: emptyConnectCallSummary(),
    });
    if (deniedResponse) return deniedResponse;

    const calls = filterCallsForMainConnectUser(await fetchPrototypeCalls(), personId);

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
