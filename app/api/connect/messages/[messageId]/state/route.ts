import { NextResponse } from "next/server";

import { verifyConnectMessagePersonAccess } from "@/app/lib/connect/messaging/server/messageAccess";
import { updateLocalConnectMessageState } from "@/app/lib/connect/messaging/server/localMessages";
import { resolveConnectMessageState } from "@/app/lib/connect/messaging/server/messageState";
import { connectPrototypeEndpoints } from "@/app/lib/connect/prototypeClient";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { messageId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      heard?: boolean;
      mainConnectUserPersonId?: string;
      read?: boolean;
      state?: string;
    };
    const personId = payload.mainConnectUserPersonId?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        { error: "Select a Main Connect User before updating Connect messages.", ok: false },
        { status: 400 }
      );
    }

    const deniedResponse = await verifyConnectMessagePersonAccess(personId, request);
    if (deniedResponse) return deniedResponse;

    const state = resolveConnectMessageState(payload);
    const message = await updateLocalConnectMessageState(messageId, state, {
      mainConnectUserPersonId: personId,
    });

    void forwardPrototypeMessageState(messageId, state);

    return NextResponse.json({
      mainConnectUserPersonId: personId,
      message,
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update Connect message state.",
        ok: false,
      },
      { status: 401 }
    );
  }
}

async function forwardPrototypeMessageState(messageId: string, state: "heard" | "read") {
  try {
    const url = new URL(
      `/messages/${encodeURIComponent(messageId)}/state`,
      connectPrototypeEndpoints.messages
    ).toString();
    await fetch(url, {
      body: JSON.stringify({ state }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
  } catch {
    // Local state update remains available even if prototype forwarding fails.
  }
}
