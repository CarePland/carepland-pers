import { NextResponse } from "next/server";

import {
  readConnectCallPersonAccessForRequest,
} from "@/app/lib/connect/calls/server/callAccess";
import {
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import {
  filterCallsForMainConnectUser,
  mergeConnectCalls,
  type ConnectCallRecord,
} from "@/app/lib/connect/calls/callScoping";
import {
  cleanupExpiredLocalConnectCallTranscripts,
  markStaleLocalConnectCallsMissed,
  readLocalConnectCalls,
  recordLocalConnectCall,
} from "@/app/lib/connect/calls/server/localCalls";
import {
  cleanupExpiredSupabaseConnectCallTranscripts,
  markStaleSupabaseConnectCallsMissed,
  readSupabaseConnectCalls,
  recordSupabaseConnectCallEvent,
  recordSupabaseConnectCall,
} from "@/app/lib/connect/calls/server/supabaseCallStore";
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
    const persistedCalls = mergeConnectCalls(
      supabaseCalls ?? [],
      localCallIndex.calls
    );
    const calls = filterCallsForMainConnectUser(
      mergeConnectCalls(persistedCalls, prototypeCalls),
      personId
    );

    return NextResponse.json({
      calls,
      mainConnectUserPersonId: personId,
      ok: true,
    });
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(
        { calls: [], ...receiverDeviceSetupRequiredBody(error) },
        { status: error.status }
      );
    }

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

    const access = await readConnectCallPersonAccessForRequest(request, personId, payload);

    await Promise.all([
      markStaleLocalConnectCallsMissed({
        mainConnectUserPersonId: personId,
        ringingTimeoutMs: 0,
      }),
      markStaleSupabaseConnectCallsMissed(access, { ringingTimeoutMs: 0 }),
    ]);

    const call =
      (await recordSupabaseConnectCall(
        {
          ...payload,
          mainConnectUserPersonId: personId,
          recipientPersonId: personId,
        },
        access
      )) ??
      (await recordLocalConnectCall({
        ...payload,
        mainConnectUserPersonId: personId,
        recipientPersonId: personId,
      }));
    const prototypeBody = await postPrototypeCall({
      ...payload,
      callId: call.callId,
      mainConnectUserPersonId: personId,
      recipientPersonId: personId,
    });
    if (call.callId) {
      void recordSupabaseConnectCallEvent(
        {
          actorRole: "dashboard",
          callId: call.callId,
          details: {
            callerName: payload.callerName || "",
            receiverId: payload.receiverId || "",
            recipientName: payload.recipientName || "",
            source: "connect_call_post",
          },
          eventType: "call_created",
        },
        access
      );
    }

    return NextResponse.json({
      ...prototypeBody,
      call,
      mainConnectUserPersonId: personId,
      ok: true,
      source: prototypeBody.ok === true ? "local_and_prototype" : "local",
    });
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(receiverDeviceSetupRequiredBody(error), {
        status: error.status,
      });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to start Connect call.",
        ok: false,
      },
      { status: 401 }
    );
  }
}

async function postPrototypeCall(payload: Partial<ConnectCallRecord> & { receiverId?: string }) {
  try {
    const response = await fetch(connectPrototypeEndpoints.call, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    return response.ok ? body : {};
  } catch {
    return {};
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
