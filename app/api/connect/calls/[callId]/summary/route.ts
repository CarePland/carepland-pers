import { NextResponse } from "next/server";

import { readConnectCallPersonAccessForRequest } from "@/app/lib/connect/calls/server/callAccess";
import { approveLocalConnectCallSummary } from "@/app/lib/connect/calls/server/localCalls";
import {
  approveSupabaseConnectCallSummary,
  recordSupabaseConnectCallEvent,
} from "@/app/lib/connect/calls/server/supabaseCallStore";

type RouteContext = {
  params: Promise<{ callId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { callId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      action?: string;
      approvedBy?: string;
      mainConnectUserPersonId?: string;
    };
    const personId = payload.mainConnectUserPersonId?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        {
          error: "Select a Main Connect User before approving a Connect call summary.",
          ok: false,
        },
        { status: 400 }
      );
    }

    if (payload.action !== "approve") {
      return NextResponse.json(
        { error: "Unsupported call summary action.", ok: false },
        { status: 400 }
      );
    }

    const access = await readConnectCallPersonAccessForRequest(request, personId);

    const call =
      (await approveSupabaseConnectCallSummary(callId, access)) ??
      (await approveLocalConnectCallSummary(callId, {
        approvedBy: payload.approvedBy || "receiver",
        mainConnectUserPersonId: personId,
      }));

    if (!call) {
      return NextResponse.json(
        {
          error: "Call summary could not be approved.",
          mainConnectUserPersonId: personId,
          ok: false,
        },
        { status: 404 }
      );
    }
    void recordSupabaseConnectCallEvent(
      {
        actorRole: payload.approvedBy || "receiver",
        callId,
        details: {
          approvedBy: payload.approvedBy || "receiver",
          source: "connect_call_summary_approval",
        },
        eventType: "call_summary_approved",
      },
      access
    );

    return NextResponse.json({
      call,
      mainConnectUserPersonId: personId,
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to approve Connect call summary.",
        ok: false,
      },
      { status: 401 }
    );
  }
}
