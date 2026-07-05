import { NextResponse } from "next/server";

import {
  accessTokenFromConnectRequest,
  connectUserCanAccessPerson,
  createConnectUserContext,
  readConnectMainUserContext,
} from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  pairReceiverShellPairingCode,
  ReceiverShellClaimError,
} from "@/app/lib/connect/receiverShell/claimStore";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const accessToken = accessTokenFromConnectRequest(request);

  let userContext: Awaited<ReturnType<typeof createConnectUserContext>>;
  try {
    userContext = await createConnectUserContext(accessToken);
  } catch {
    return NextResponse.json(
      {
        error: "Please sign in before pairing a Receiver.",
        ok: false,
      },
      { status: 401 }
    );
  }

  const connectContext = await readConnectMainUserContext(userContext);
  const requestedPersonId = stringValue(body.mainConnectUserPersonId);
  const mainConnectUserPersonId =
    requestedPersonId || connectContext.mainConnectUserPersonId || "";
  const mainConnectUserPerson = connectContext.people.find(
    (person) => person.id === mainConnectUserPersonId
  );

  if (!mainConnectUserPersonId || !mainConnectUserPerson) {
    return NextResponse.json(
      {
        error: "Choose a Main Connect User before pairing this Receiver.",
        ok: false,
      },
      { status: 400 }
    );
  }

  if (!(await connectUserCanAccessPerson(mainConnectUserPersonId, userContext))) {
    return NextResponse.json(
      {
        error: "Choose a Main Connect User from your CarePland collection.",
        ok: false,
      },
      { status: 403 }
    );
  }

  try {
    const claim = await pairReceiverShellPairingCode({
      careCircleId: mainConnectUserPerson.careCircleId,
      createdByUserId: userContext.userId,
      deviceProfile: stringValue(body.deviceProfile) || "android_receiver",
      hardwareProfile: stringValue(body.hardwareProfile) || "generic_landscape_android",
      mainConnectUserPersonId,
      pairingCode: stringValue(body.pairingCode),
      receiverUrl: stringValue(body.receiverUrl),
      uiLayout: stringValue(body.uiLayout) || "default_receiver",
    });

    return NextResponse.json({
      claim: claim.claim,
      expiresAt: claim.expiresAt,
      ok: true,
      pairingCode: claim.setupCode,
      receiverDeviceId: claim.receiverDeviceId,
      receiverName: mainConnectUserPerson.displayName,
      status: "paired",
      storageSource: claim.storageSource || "local_file",
    });
  } catch (error) {
    const status = error instanceof ReceiverShellClaimError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to pair Receiver.",
        ok: false,
      },
      { status }
    );
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
