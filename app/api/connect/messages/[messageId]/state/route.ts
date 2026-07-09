import { NextResponse } from "next/server";

import {
  ConnectPersonAccessDeniedError,
} from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import { readConnectMessagePersonAccessForRequest } from "@/app/lib/connect/messaging/server/messageAccess";
import { updateLocalConnectMessageState } from "@/app/lib/connect/messaging/server/localMessages";
import {
  resolveConnectMessageState,
  type ConnectMessageState,
} from "@/app/lib/connect/messaging/server/messageState";
import { updateSupabaseConnectMessageState } from "@/app/lib/connect/messaging/server/supabaseMessages";
import { connectPrototypeEndpoints } from "@/app/lib/connect/prototypeClient";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { messageId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      acknowledged?: boolean;
      callbackRequested?: boolean;
      heard?: boolean;
      mainConnectUserPersonId?: string;
      read?: boolean;
      receiverId?: string;
      state?: string;
    };
    const personId = payload.mainConnectUserPersonId?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        { error: "Select a Main Connect User before updating Connect messages.", ok: false },
        { status: 400 }
      );
    }

    const access = await readConnectMessagePersonAccessForRequest(
      request,
      personId,
      payload as unknown as Record<string, unknown>
    );

    const state = resolveConnectMessageState(payload);
    const message =
      (await updateSupabaseConnectMessageState(messageId, state, access, {
        receiverDeviceId: payload.receiverId,
      })) ??
      (await updateLocalConnectMessageState(messageId, state, {
        mainConnectUserPersonId: personId,
      }));

    void forwardPrototypeMessageState(messageId, state);

    return NextResponse.json({
      mainConnectUserPersonId: personId,
      message,
      ok: true,
    });
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(receiverDeviceSetupRequiredBody(error), {
        status: error.status,
      });
    }
    if (error instanceof ConnectPersonAccessDeniedError) {
      return NextResponse.json(
        {
          error: "Choose a Main Connect User from your CarePland collection.",
          ok: false,
        },
        { status: 403 }
      );
    }

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

async function forwardPrototypeMessageState(messageId: string, state: ConnectMessageState) {
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
