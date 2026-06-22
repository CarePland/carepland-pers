import { NextResponse } from "next/server";

import {
  createConnectUserContext,
  listPersFocusPeopleForConnect,
} from "@/app/lib/connect/context/server/mainConnectUserContext";

export async function GET(request: Request) {
  try {
    const userContext = await createConnectUserContext(accessTokenFromRequest(request));

    return NextResponse.json({
      people: await listPersFocusPeopleForConnect(userContext),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load CarePland focus people.",
        people: [],
      },
      { status: 401 }
    );
  }
}

function accessTokenFromRequest(request: Request) {
  return (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}
