import { NextResponse } from "next/server";

import {
  createConnectUserContext,
  ensureConnectCurrentAccountPerson,
  readConnectMainUserContext,
  updateConnectMainUserContextForUser,
} from "@/app/lib/connect/context/server/mainConnectUserContext";

export async function GET(request: Request) {
  try {
    const userContext = await createConnectUserContext(accessTokenFromRequest(request));
    return NextResponse.json(await readConnectMainUserContext(userContext));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load Connect context.",
      },
      { status: 401 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      mainConnectUserPersonId?: string;
    };
    const personId = body.mainConnectUserPersonId?.trim();

    if (!personId) {
      return NextResponse.json(
        { error: "Choose a Main Connect User first." },
        { status: 400 }
      );
    }

    const userContext = await createConnectUserContext(accessTokenFromRequest(request));
    return NextResponse.json(
      await updateConnectMainUserContextForUser(personId, userContext)
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update Main Connect User.",
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
    };

    if (body.action !== "ensureCurrentAccountPerson") {
      return NextResponse.json(
        { error: "Unsupported Connect context action." },
        { status: 400 }
      );
    }

    const userContext = await createConnectUserContext(accessTokenFromRequest(request));
    return NextResponse.json(await ensureConnectCurrentAccountPerson(userContext));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare your Receiver User.",
      },
      { status: 400 }
    );
  }
}

function accessTokenFromRequest(request: Request) {
  return (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}
