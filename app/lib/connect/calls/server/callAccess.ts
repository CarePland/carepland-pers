import { NextResponse } from "next/server";

import {
  ConnectPersonAccessDeniedError,
} from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  readConnectPersonScopedAccess,
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";

export async function readConnectCallPersonAccessForRequest(
  request: Request,
  personId: string,
  body?: Record<string, unknown>
) {
  return readConnectPersonScopedAccess(request, personId, { body });
}

export async function verifyConnectCallPersonAccess(
  request: Request,
  personId: string,
  responseBody: Record<string, unknown> = {}
) {
  try {
    await readConnectPersonScopedAccess(request, personId);
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
