import { NextResponse } from "next/server";

import { verifyConnectCallPersonAccess } from "@/app/lib/connect/calls/server/callAccess";
import {
  filterCallsForMainConnectUser,
  type ConnectCallRecord,
} from "@/app/lib/connect/calls/callScoping";
import { connectPrototypeEndpoints } from "@/app/lib/connect/prototypeClient";

export async function GET(request: Request) {
  try {
    const personId = new URL(request.url).searchParams.get("personId")?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        { calls: [], error: "Select a Main Connect User before loading Connect calls.", ok: false },
        { status: 400 }
      );
    }

    const deniedResponse = await verifyConnectCallPersonAccess(request, personId, {
      calls: [],
    });
    if (deniedResponse) return deniedResponse;

    const calls = filterCallsForMainConnectUser(await fetchPrototypeCalls(), personId);

    return NextResponse.json({
      calls,
      mainConnectUserPersonId: personId,
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        calls: [],
        error: error instanceof Error ? error.message : "Unable to load Connect calls.",
        ok: false,
      },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as Partial<ConnectCallRecord> & {
      receiverId?: string;
    };
    const personId =
      payload.mainConnectUserPersonId?.trim() ||
      payload.recipientPersonId?.trim() ||
      "";

    if (!personId) {
      return NextResponse.json(
        { error: "Select a Main Connect User before starting a Connect call.", ok: false },
        { status: 400 }
      );
    }

    const deniedResponse = await verifyConnectCallPersonAccess(request, personId);
    if (deniedResponse) return deniedResponse;

    const response = await fetch(connectPrototypeEndpoints.call, {
      body: JSON.stringify({
        ...payload,
        mainConnectUserPersonId: personId,
        recipientPersonId: personId,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    return NextResponse.json(
      {
        ...body,
        mainConnectUserPersonId: personId,
        ok: response.ok && body.ok !== false,
      },
      { status: response.ok ? 200 : response.status }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to start Connect call.",
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
