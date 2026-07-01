import { NextResponse } from "next/server";

import type { ConnectProvisioningSnapshot } from "@/app/lib/connect/provisioning/types";
import { listReceiverShellDeviceProfiles } from "@/app/lib/connect/receiverShell/claimStore";
import { receiverShellUpdatePolicy } from "@/app/lib/connect/receiverShell/updatePolicy";
import {
  connectProvisioningPrototypeProxyEndpoints,
  provisioningSearchParams,
} from "@/app/lib/connect/provisioning/server/prototypeProvisioningProxy";

export async function GET(request: Request) {
  try {
    const response = await fetch(
      connectProvisioningPrototypeProxyEndpoints.snapshot(provisioningSearchParams(request)),
      {
        cache: "no-store",
      }
    );
    const payload = (await response.json().catch(() => ({}))) as ConnectProvisioningSnapshot & {
      error?: string;
      ok?: boolean;
    };

    if (!response.ok || payload.ok === false) {
      return NextResponse.json(payload, { status: response.status });
    }

    const receiverShellProfiles = await listReceiverShellDeviceProfiles();
    return NextResponse.json(overlayReceiverShellProfiles(payload, receiverShellProfiles), {
      status: response.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Connect provisioning snapshot failed.",
        ok: false,
      },
      { status: 502 }
    );
  }
}

function overlayReceiverShellProfiles(
  snapshot: ConnectProvisioningSnapshot,
  receiverShellProfiles: Awaited<ReturnType<typeof listReceiverShellDeviceProfiles>>
): ConnectProvisioningSnapshot {
  if (!snapshot.receiverDevices?.length || !receiverShellProfiles.length) return snapshot;

  return {
    ...snapshot,
    receiverDevices: snapshot.receiverDevices.map((device) => {
      const profile = receiverShellProfiles.find(
        (item) =>
          item.receiverDeviceId &&
          (item.receiverDeviceId === device.id || item.receiverDeviceId === device.receiverId)
      );
      if (!profile) return device;
      const updatePolicy = receiverShellUpdatePolicy(
        {
          hardwareProfile: profile.hardwareProfile,
          nativeVersionCode: profile.nativeVersionCode,
          nativeVersionName: profile.nativeVersionName,
          shellVersion: profile.shellVersion,
        },
        {
          installUrl: process.env.CONNECT_RECEIVER_APK_URL,
          latestVersionCode: numberFromEnv(process.env.CONNECT_RECEIVER_LATEST_VERSION_CODE),
          latestVersionName: process.env.CONNECT_RECEIVER_LATEST_VERSION_NAME,
          minSupportedVersionCode: numberFromEnv(
            process.env.CONNECT_RECEIVER_MIN_SUPPORTED_VERSION_CODE
          ),
          releaseChannel: process.env.CONNECT_RECEIVER_RELEASE_CHANNEL,
          releaseNotesUrl: process.env.CONNECT_RECEIVER_RELEASE_NOTES_URL,
        }
      );

      return {
        ...device,
        capabilityStatuses: profile.capabilityStatuses,
        deviceOwner: profile.deviceOwner,
        hardwareProfile: profile.hardwareProfile || device.hardwareProfile,
        lastRecoveryAction: profile.lastRecoveryAction,
        lastRecoveryAt: profile.lastRecoveryAt,
        lockTaskActive: profile.lockTaskActive,
        lockTaskPermitted: profile.lockTaskPermitted,
        nativeManufacturer: profile.nativeManufacturer,
        nativeModel: profile.nativeModel,
        nativeSdk: profile.nativeSdk,
        nativeVersionCode: profile.nativeVersionCode,
        nativeVersionName: profile.nativeVersionName,
        provisioningCompletedAt: profile.provisioningCompletedAt,
        receiverMode: profile.receiverMode,
        shellVersion: profile.shellVersion,
        updateAction: updatePolicy.updateAction,
        updateAvailable: updatePolicy.updateAvailable,
        updateRequired: updatePolicy.updateRequired,
      };
    }),
  };
}

function numberFromEnv(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
