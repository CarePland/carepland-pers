import { NextResponse } from "next/server";

import {
  ConnectPersonAccessDeniedError,
  verifyConnectPersonAccessForRequest,
} from "@/app/lib/connect/context/server/mainConnectUserContext";

export async function verifyConnectAudioPersonAccess(
  personId: string,
  request: Request,
  responseBody: Record<string, unknown> = {}
) {
  try {
    await verifyConnectPersonAccessForRequest(personId, request);
    return null;
  } catch (error) {
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
