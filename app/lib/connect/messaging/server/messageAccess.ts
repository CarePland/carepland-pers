import { NextResponse } from "next/server";

import {
  ConnectPersonAccessDeniedError,
} from "../../context/server/mainConnectUserContext";
import {
  readConnectPersonScopedAccess,
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "../../context/server/personScopedAccess";
import { createSupabaseServiceClient } from "../../../platform/server/supabase";

export async function verifyConnectMessagePersonAccess(
  personId: string,
  request: Request,
  responseBody: Record<string, unknown> = {},
  options: Parameters<typeof readConnectPersonScopedAccess>[2] = {}
) {
  try {
    await readConnectPersonScopedAccess(request, personId, options);
    return null;
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(
        {
          ...receiverDeviceSetupRequiredBody(error),
          ...responseBody,
          ok: false,
        },
        { status: error.status }
      );
    }
    if (!(error instanceof ConnectPersonAccessDeniedError)) {
      throw error;
    }

    return NextResponse.json(
      {
        error: "Choose a Main Connect User from your CarePland collection.",
        ...responseBody,
        ok: false,
      },
      { status: 403 }
    );
  }
}

export async function readConnectMessagePersonAccessForRequest(
  request: Request,
  personId: string,
  body?: Record<string, unknown>
) {
  return readConnectPersonScopedAccess(request, personId, {
    body,
    createUserClient: createSupabaseServiceClient,
  });
}
