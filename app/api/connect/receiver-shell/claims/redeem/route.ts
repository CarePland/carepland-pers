import { NextResponse } from "next/server";

import {
  redeemReceiverShellClaim,
  ReceiverShellClaimError,
} from "@/app/lib/connect/receiverShell/claimStore";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const claim = await redeemReceiverShellClaim({
      claim: stringValue(body.claim),
      receiverInstallId: stringValue(body.receiverInstallId),
    });

    return NextResponse.json({
      bindingStatus: "bound",
      deviceProfile: claim.deviceProfile,
      hardwareProfile: claim.hardwareProfile,
      mainConnectUserPersonId: claim.mainConnectUserPersonId,
      ok: true,
      receiverDeviceId: claim.receiverDeviceId,
      receiverInstallId: claim.receiverInstallId || stringValue(body.receiverInstallId),
      receiverUrl: claim.receiverUrl,
      storageSource: claim.storageSource || "local_file",
      uiLayout: claim.uiLayout,
    });
  } catch (error) {
    const status = error instanceof ReceiverShellClaimError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to redeem receiver claim.",
        ok: false,
      },
      { status }
    );
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
