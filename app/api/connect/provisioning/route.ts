import { NextResponse } from "next/server";

import type {
  ConnectProvisioningSnapshot,
  ConnectReceiverDevice,
} from "@/app/lib/connect/provisioning/types";
import {
  listReceiverShellDeviceProfiles,
  type ReceiverShellDeviceProfile,
} from "@/app/lib/connect/receiverShell/claimStore";
import { receiverShellUpdatePolicy } from "@/app/lib/connect/receiverShell/updatePolicy";
import {
  connectProvisioningPrototypeProxyEndpoints,
  provisioningSearchParams,
} from "@/app/lib/connect/provisioning/server/prototypeProvisioningProxy";

export async function GET(request: Request) {
  try {
    const payload = await fetchPrototypeProvisioningSnapshot(request);
    const receiverShellProfiles = await listReceiverShellDeviceProfiles();
    return NextResponse.json(overlayReceiverShellProfiles(payload, receiverShellProfiles), {
      status: 200,
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

async function fetchPrototypeProvisioningSnapshot(
  request: Request
): Promise<ConnectProvisioningSnapshot> {
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
      return emptyProvisioningSnapshot();
    }

    return payload;
  } catch {
    return emptyProvisioningSnapshot();
  }
}

function emptyProvisioningSnapshot(): ConnectProvisioningSnapshot {
  return {
    auditEvents: [],
    ok: true,
    receiverDevices: [],
    receiverHouseholds: [],
    setupTokens: [],
    summary: {
      generatedAt: new Date().toISOString(),
      totals: {
        activeReceiverDevices: 0,
        activeSetupTokens: 0,
        households: 0,
        receiverDevices: 0,
        receiverHouseholds: 0,
        receiverPeople: 0,
        revokedReceiverDevices: 0,
        setupTokens: 0,
      },
    },
    totals: {
      receiverDevices: 0,
      receiverHouseholds: 0,
      receiverPeople: 0,
    },
  };
}

function overlayReceiverShellProfiles(
  snapshot: ConnectProvisioningSnapshot,
  receiverShellProfiles: Awaited<ReturnType<typeof listReceiverShellDeviceProfiles>>
): ConnectProvisioningSnapshot {
  if (!receiverShellProfiles.length) return snapshot;

  const receiverDevices = snapshot.receiverDevices ?? [];
  const knownDeviceIds = new Set(
    receiverDevices
      .flatMap((device) => [device.id, device.receiverId])
      .filter((value): value is string => Boolean(value))
  );
  const shellOnlyDevices = receiverShellProfiles
    .filter((profile) => profile.receiverDeviceId && !knownDeviceIds.has(profile.receiverDeviceId))
    .map(shellProfileToReceiverDevice);

  return {
    ...snapshot,
    receiverDevices: [
      ...receiverDevices.map((device) => {
      const profile = receiverShellProfiles.find(
        (item) =>
          item.receiverDeviceId &&
          (item.receiverDeviceId === device.id || item.receiverDeviceId === device.receiverId)
      );
      if (!profile) return device;
      const updatePolicy = receiverUpdatePolicy(profile);

      return {
        ...device,
        capabilityStatuses: profile.capabilityStatuses,
        deviceOwner: profile.deviceOwner,
        hardwareProfile: profile.hardwareProfile || device.hardwareProfile,
        lastRecoveryAction: profile.lastRecoveryAction,
        lastRecoveryAt: profile.lastRecoveryAt,
        lockTaskActive: profile.lockTaskActive,
        lockTaskPermitted: profile.lockTaskPermitted,
        locationLabel: profile.locationLabel || device.locationLabel,
        name: profile.locationLabel || device.name,
        nativeManufacturer: profile.nativeManufacturer,
        nativeModel: profile.nativeModel,
        nativeSdk: profile.nativeSdk,
        nativeVersionCode: profile.nativeVersionCode,
        nativeVersionName: profile.nativeVersionName,
        mainConnectUserPersonId: profile.mainConnectUserPersonId,
        provisioningCompletedAt: profile.provisioningCompletedAt,
        receiverContactDisplayName: profile.receiverContactDisplayName,
        receiverContactIsReceiverUser: profile.receiverContactIsReceiverUser,
        receiverContactUserId: profile.receiverContactUserId,
        receiverMode: profile.receiverMode,
        shellVersion: profile.shellVersion,
        updateAction: updatePolicy.updateAction,
        updateAvailable: updatePolicy.updateAvailable,
        updateRequired: updatePolicy.updateRequired,
      };
      }),
      ...shellOnlyDevices,
    ],
  };
}

function shellProfileToReceiverDevice(profile: ReceiverShellDeviceProfile): ConnectReceiverDevice {
  const updatePolicy = receiverUpdatePolicy(profile);
  const status = profile.status || (profile.receiverInstallId ? "bound" : "setup_pending");
  const displayName = profile.mainConnectUserDisplayName?.trim() || "";
  const locationLabel = profile.locationLabel?.trim() || "";
  const defaultLabel = defaultReceiverLocationLabel(profile.receiverDeviceId, displayName);
  const presence = receiverPresence(profile.lastSeenAt, status);

  return {
    active: status !== "revoked",
    capabilityStatuses: profile.capabilityStatuses,
    careCircleId: profile.careCircleId,
    deviceOwner: profile.deviceOwner,
    hardwareProfile: profile.hardwareProfile,
    id: profile.receiverDeviceId,
    lastRecoveryAction: profile.lastRecoveryAction,
    lastRecoveryAt: profile.lastRecoveryAt,
    lastSeenAt: profile.lastSeenAt,
    lockTaskActive: profile.lockTaskActive,
    lockTaskPermitted: profile.lockTaskPermitted,
    locationLabel: locationLabel || defaultLabel,
    name: locationLabel || defaultLabel,
    nativeManufacturer: profile.nativeManufacturer,
    nativeModel: profile.nativeModel,
    nativeSdk: profile.nativeSdk,
    nativeVersionCode: profile.nativeVersionCode,
    nativeVersionName: profile.nativeVersionName,
    mainConnectUserPersonId: profile.mainConnectUserPersonId,
    pairedAt: profile.pairedAt || profile.provisioningCompletedAt,
    presence,
    provisioningCompletedAt: profile.provisioningCompletedAt,
    receiverContactDisplayName: profile.receiverContactDisplayName,
    receiverContactIsReceiverUser: profile.receiverContactIsReceiverUser,
    receiverContactUserId: profile.receiverContactUserId,
    receiverId: profile.receiverDeviceId,
    receiverMode: profile.receiverMode,
    shellVersion: profile.shellVersion,
    status,
    updateAction: updatePolicy.updateAction,
    updateAvailable: updatePolicy.updateAvailable,
    updateRequired: updatePolicy.updateRequired,
  };
}

function defaultReceiverLocationLabel(receiverDeviceId: string, displayName?: string) {
  const suffix = receiverShortNameSuffix(receiverDeviceId);
  const base = displayName?.trim() ? `${displayName.trim()}'s Receiver` : "Receiver";
  return suffix ? `${base} ${suffix}` : base;
}

function receiverShortNameSuffix(receiverDeviceId: string) {
  const normalized = receiverDeviceId.trim().replace(/^receiver-/, "");
  if (!normalized) return "";
  return normalized.length > 6 ? normalized.slice(-6).toUpperCase() : normalized.toUpperCase();
}

function receiverUpdatePolicy(profile: ReceiverShellDeviceProfile) {
  return receiverShellUpdatePolicy(
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
}

function receiverPresence(lastSeenAt: string | undefined, status: string) {
  if (status === "revoked") {
    return { label: "Revoked", online: false, state: "revoked" };
  }
  if (!lastSeenAt) {
    return { label: "No heartbeat yet", online: false, state: "offline" };
  }

  const lastSeenMs = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(lastSeenMs)) {
    return { label: "Heartbeat time unreadable", online: false, state: "stale" };
  }

  const ageMs = Date.now() - lastSeenMs;
  if (ageMs <= 2 * 60 * 1000) {
    return { label: "Online", lastSeenAgeMs: ageMs, online: true, state: "online" };
  }
  if (ageMs <= 10 * 60 * 1000) {
    return {
      label: "Recently online",
      lastSeenAgeMs: ageMs,
      online: false,
      state: "stale",
    };
  }
  return { label: "Offline", lastSeenAgeMs: ageMs, online: false, state: "offline" };
}

function numberFromEnv(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
