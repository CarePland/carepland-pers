import {
  connectProvisioningPrototypeProxyEndpoints,
  proxyConnectProvisioningJson,
} from "@/app/lib/connect/provisioning/server/prototypeProvisioningProxy";
import {
  deleteUnpairedReceiverShellDevice,
  ReceiverShellBindingError,
  updateReceiverShellDeviceLabel,
} from "@/app/lib/connect/receiverShell/claimStore";

type RouteContext = {
  params: Promise<{ receiverDeviceId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { receiverDeviceId } = await context.params;

  return proxyConnectProvisioningJson(
    connectProvisioningPrototypeProxyEndpoints.deviceDetail(receiverDeviceId)
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const { receiverDeviceId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const confirmed = body.confirmedPrototypeWrite === true;
  const operationReason =
    typeof body.operationReason === "string" ? body.operationReason.trim() : "";

  if (!confirmed) {
    return Response.json(
      { error: "Confirm this receiver update before continuing.", ok: false },
      { status: 400 }
    );
  }

  if (operationReason.length < 8) {
    return Response.json(
      { error: "Add a brief reason for this receiver update.", ok: false },
      { status: 400 }
    );
  }

  try {
    const updated = await updateReceiverShellDeviceLabel({
      locationLabel: typeof body.locationLabel === "string" ? body.locationLabel : "",
      receiverDeviceId,
    });

    return Response.json({
      locationLabel: updated.locationLabel,
      ok: true,
      receiverDeviceId: updated.receiverDeviceId,
      storageSource: updated.storageSource,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    const status = error instanceof ReceiverShellBindingError ? error.status : 500;
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to update Receiver.",
        ok: false,
      },
      { status }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { receiverDeviceId } = await context.params;

  try {
    const deleted = await deleteUnpairedReceiverShellDevice({ receiverDeviceId });

    return Response.json({
      deletedAt: deleted.deletedAt,
      ok: true,
      receiverDeviceId: deleted.receiverDeviceId,
      storageSource: deleted.storageSource,
    });
  } catch (error) {
    const status = error instanceof ReceiverShellBindingError ? error.status : 500;
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete Receiver.",
        ok: false,
      },
      { status }
    );
  }
}
