import { NextResponse } from "next/server";

import {
  ReceiverShellBindingError,
  revokeReceiverShellDevice,
} from "@/app/lib/connect/receiverShell/claimStore";

type RouteContext = {
  params: Promise<{ receiverDeviceId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { receiverDeviceId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const confirmed = body.confirmedPrototypeWrite === true;
  const operationReason =
    typeof body.operationReason === "string" ? body.operationReason.trim() : "";

  if (!confirmed) {
    return NextResponse.json(
      { error: "Confirm this receiver revoke before continuing.", ok: false },
      { status: 400 }
    );
  }

  if (operationReason.length < 8) {
    return NextResponse.json(
      { error: "Add a brief reason for this receiver revoke.", ok: false },
      { status: 400 }
    );
  }

  try {
    const revoked = await revokeReceiverShellDevice({ receiverDeviceId });

    return NextResponse.json({
      ok: true,
      receiverDeviceId: revoked.receiverDeviceId,
      revokedAt: revoked.revokedAt,
      storageSource: revoked.storageSource,
    });
  } catch (error) {
    const status = error instanceof ReceiverShellBindingError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to revoke receiver.",
        ok: false,
      },
      { status }
    );
  }
}
