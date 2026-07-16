import { NextResponse } from "next/server";

import {
  ReceiverShellBindingError,
  verifyReceiverShellBinding,
} from "@/app/lib/connect/receiverShell/claimStore";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const binding = await verifyReceiverShellBinding({
      capabilityStatuses: capabilityStatusesValue(body.capabilities),
      deviceOwner: booleanValue(body.deviceOwner),
      lastRecoveryAction: stringValue(body.lastRecoveryAction),
      lastRecoveryAtMs: numberValue(body.lastRecoveryAtMs),
      lockTaskActive: booleanValue(body.lockTaskActive),
      lockTaskPermitted: booleanValue(body.lockTaskPermitted),
      nativeManufacturer: stringValue(body.nativeManufacturer),
      nativeModel: stringValue(body.nativeModel),
      nativeSdk: numberValue(body.nativeSdk),
      nativeVersionCode: numberValue(body.nativeVersionCode),
      nativeVersionName: stringValue(body.nativeVersionName),
      provisioningCompletedAtMs: numberValue(body.provisioningCompletedAtMs),
      receiverDeviceId: stringValue(body.receiverDeviceId),
      receiverInstallId: stringValue(body.receiverInstallId),
      receiverMode: stringValue(body.receiverMode),
      shellVersion: stringValue(body.shellVersion),
    });

    return NextResponse.json({
      bindingStatus: binding.bindingStatus,
      capabilityStatuses: binding.capabilityStatuses,
      deviceOwner: binding.deviceOwner,
      deviceProfile: binding.deviceProfile,
      hardwareProfile: binding.hardwareProfile,
      lastSeenAt: binding.lastSeenAt,
      lastRecoveryAction: binding.lastRecoveryAction,
      lastRecoveryAt: binding.lastRecoveryAt,
      lockTaskActive: binding.lockTaskActive,
      lockTaskPermitted: binding.lockTaskPermitted,
      locationLabel: binding.locationLabel,
      nativeManufacturer: binding.nativeManufacturer,
      nativeModel: binding.nativeModel,
      nativeSdk: binding.nativeSdk,
      nativeVersionCode: binding.nativeVersionCode,
      nativeVersionName: binding.nativeVersionName,
      ok: true,
      provisioningCompletedAt: binding.provisioningCompletedAt,
      mainConnectUserDisplayName: binding.mainConnectUserDisplayName,
      mainConnectUserPersonId: binding.mainConnectUserPersonId,
      primaryCoordinatorDisplayName: binding.primaryCoordinatorDisplayName,
      receiverContactDisplayName: binding.receiverContactDisplayName,
      receiverContactIsReceiverUser: binding.receiverContactIsReceiverUser,
      receiverContactUserId: binding.receiverContactUserId,
      receiverDeviceId: binding.receiverDeviceId,
      receiverMode: binding.receiverMode,
      receiverUrl: binding.receiverUrl,
      shellVersion: binding.shellVersion,
      storageSource: binding.storageSource || "local_file",
      uiLayout: binding.uiLayout,
    });
  } catch (error) {
    const status = error instanceof ReceiverShellBindingError ? error.status : 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to verify receiver binding.",
        ok: false,
      },
      { status }
    );
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function capabilityStatusesValue(value: unknown) {
  return value && typeof value === "object"
    ? (value as {
        batteryOptimization?: string;
        bootStart?: string;
        fullscreen?: string;
        keepAwake?: string;
        kiosk?: string;
        microphone?: string;
        updateChecks?: string;
      })
    : undefined;
}
