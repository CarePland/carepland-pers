import { NextResponse } from "next/server";

import {
  createReceiverShellPairingSession,
  getReceiverShellPairingSession,
  ReceiverShellClaimError,
} from "@/app/lib/connect/receiverShell/claimStore";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const session = await createReceiverShellPairingSession({
      deviceProfile: stringValue(body.deviceProfile),
      hardwareProfile: stringValue(body.hardwareProfile),
      locationLabel: stringValue(body.locationLabel),
      receiverDeviceId: stringValue(body.receiverDeviceId),
      receiverInstallId: stringValue(body.receiverInstallId),
      receiverUrl: stringValue(body.receiverUrl),
      uiLayout: stringValue(body.uiLayout),
    });

    return NextResponse.json({
      expiresAt: session.expiresAt,
      ok: true,
      pairingCode: session.pairingCode,
      receiverDeviceId: session.receiverDeviceId,
      status: session.status,
      storageSource: session.storageSource,
    });
  } catch (error) {
    const status = error instanceof ReceiverShellClaimError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to start Receiver pairing.",
        ok: false,
      },
      { status }
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const session = await getReceiverShellPairingSession({
      pairingCode: url.searchParams.get("code") || "",
      receiverDeviceId: url.searchParams.get("receiverDeviceId") || "",
    });

    return NextResponse.json({
      claim: session.claim,
      expiresAt: session.expiresAt,
      ok: true,
      pairingCode: session.pairingCode,
      receiverDeviceId: session.receiverDeviceId,
      receiverUrl: session.receiverUrl,
      status: session.status,
      storageSource: session.storageSource,
    });
  } catch (error) {
    const status = error instanceof ReceiverShellClaimError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to check Receiver pairing.",
        ok: false,
      },
      { status }
    );
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
