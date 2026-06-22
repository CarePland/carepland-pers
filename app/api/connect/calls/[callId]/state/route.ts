import { NextResponse } from "next/server";

import { verifyConnectCallPersonAccess } from "@/app/lib/connect/calls/server/callAccess";
import { connectPrototypeEndpoints } from "@/app/lib/connect/prototypeClient";

type RouteContext = {
  params: Promise<{ callId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { callId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      mainConnectUserPersonId?: string;
      source?: string;
      state?: string;
    };
    const personId = payload.mainConnectUserPersonId?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        { error: "Select a Main Connect User before updating Connect call state.", ok: false },
        { status: 400 }
      );
    }

    const deniedResponse = await verifyConnectCallPersonAccess(request, personId);
    if (deniedResponse) return deniedResponse;

    const response = await fetch(connectPrototypeEndpoints.callState(callId), {
      body: JSON.stringify({
        ...payload,
        mainConnectUserPersonId: personId,
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
        error:
          error instanceof Error ? error.message : "Unable to update Connect call state.",
        ok: false,
      },
      { status: 401 }
    );
  }
}
