import { NextResponse } from "next/server";

import {
  accessTokenFromConnectRequest,
  connectUserCanAccessPerson,
  createConnectUserContext,
} from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  createNumericReceiverSetupCode,
  createReceiverShellSetupClaim,
} from "@/app/lib/connect/receiverShell/claimStore";

type RouteContext = {
  params: Promise<{ receiverDeviceId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { receiverDeviceId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const accessToken = accessTokenFromConnectRequest(request);

  let userContext: Awaited<ReturnType<typeof createConnectUserContext>>;
  try {
    userContext = await createConnectUserContext(accessToken);
  } catch {
    return NextResponse.json(
      {
        error: "Please sign in before creating a Receiver setup code.",
        ok: false,
      },
      { status: 401 }
    );
  }

  if (body.confirmedPrototypeWrite !== true) {
    return NextResponse.json(
      {
        error: "Confirm this receiver setup write before continuing.",
        ok: false,
      },
      { status: 400 }
    );
  }

  const operationReason = stringValue(body.operationReason);
  if (operationReason.length < 8) {
    return NextResponse.json(
      {
        error: "Add a brief reason for this provisioning write.",
        ok: false,
      },
      { status: 400 }
    );
  }

  const mainConnectUserPersonId = stringValue(body.mainConnectUserPersonId);
  if (
    mainConnectUserPersonId &&
    !(await connectUserCanAccessPerson(mainConnectUserPersonId, userContext))
  ) {
    return NextResponse.json(
      {
        error: "Choose a Main Connect User from your CarePland collection.",
        ok: false,
      },
      { status: 403 }
    );
  }

  try {
    const claim = await createReceiverShellSetupClaim({
      careCircleId: stringValue(body.careCircleId),
      createdByUserId: userContext.userId,
      deviceProfile: stringValue(body.deviceProfile) || "gxv3370",
      expiresInMinutes: numberValue(body.expiresInMinutes) ?? 30,
      hardwareProfile: stringValue(body.hardwareProfile) || "studio_gxv3370_1024x600",
      locationLabel: stringValue(body.locationLabel),
      mainConnectUserPersonId,
      receiverDeviceId,
      receiverUrl: stringValue(body.receiverUrl),
      setupCode: createNumericReceiverSetupCode(),
      uiLayout: stringValue(body.uiLayout) || "desk_phone_1024x600",
    });

    const setupPath = `/r/${encodeURIComponent(claim.setupCode)}`;

    return NextResponse.json({
      ok: true,
      setupPath,
      setupToken: {
        createdAt: claim.createdAt,
        expiresAt: claim.expiresAt,
        receiverDeviceId: claim.receiverDeviceId,
        setupCode: claim.setupCode,
        status: claim.status,
        token: claim.claim,
      },
      storageSource: claim.storageSource || "local_file",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Receiver setup code could not be created.",
        ok: false,
      },
      { status: 500 }
    );
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
