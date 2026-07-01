import { NextResponse } from "next/server";

import {
  issueReceiverShellClaim,
  ReceiverShellClaimError,
} from "@/app/lib/connect/receiverShell/claimStore";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const claim = await issueReceiverShellClaim({
      deviceProfile: stringValue(body.deviceProfile),
      hardwareProfile: stringValue(body.hardwareProfile),
      receiverUrl: stringValue(body.receiverUrl),
      setupCode: stringValue(body.setupCode),
      uiLayout: stringValue(body.uiLayout),
    });

    return NextResponse.json({
      claim: claim.claim,
      expiresAt: claim.expiresAt,
      ok: true,
      receiverDeviceId: claim.receiverDeviceId,
      storageSource: claim.storageSource || "local_file",
    });
  } catch (error) {
    const status = error instanceof ReceiverShellClaimError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to issue receiver claim.",
        ok: false,
      },
      { status }
    );
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
