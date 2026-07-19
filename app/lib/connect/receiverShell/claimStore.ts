import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { isMissingServerEnvError } from "../../platform/server/env";
import { createSupabaseServiceClient } from "../../platform/server/supabase";
import { careplandRuntimeTempPath } from "../../platform/server/runtimeTemp";
import { readPrimaryCoordinatorForCareCircle } from "../context/server/primaryCoordinator";

export type ReceiverShellClaimStatus = "available" | "expired" | "revoked" | "used";
export type ReceiverShellPairingStatus = "pending" | "paired" | "expired" | "revoked" | "used";

export type ReceiverShellClaimRecord = {
  capabilityStatuses?: ReceiverShellCapabilityStatuses;
  careCircleId?: string;
  claim: string;
  createdAt: string;
  createdByUserId?: string;
  deviceOwner?: boolean;
  deviceProfile: string;
  expiresAt: string;
  hardwareProfile: string;
  lastRecoveryAction?: string;
  lastRecoveryAt?: string;
  lockTaskActive?: boolean;
  lockTaskPermitted?: boolean;
  locationLabel?: string;
  mainConnectUserPersonId?: string;
  mainConnectUserDisplayName?: string;
  primaryCoordinatorDisplayName?: string;
  receiverContactDisplayName?: string;
  receiverContactIsReceiverUser?: boolean;
  receiverContactUserId?: string;
  nativeManufacturer?: string;
  nativeModel?: string;
  nativeSdk?: number;
  nativeVersionCode?: number;
  nativeVersionName?: string;
  provisioningCompletedAt?: string;
  receiverDeviceId: string;
  lastSeenAt?: string;
  receiverUrl: string;
  redeemedAt?: string;
  receiverInstallId?: string;
  receiverMode?: string;
  setupCode: string;
  shellVersion?: string;
  storageSource?: "local_file" | "supabase";
  status: ReceiverShellClaimStatus;
  uiLayout: string;
};

export type ReceiverShellBindingRecord = {
  bindingStatus: "bound";
  capabilityStatuses?: ReceiverShellCapabilityStatuses;
  careCircleId?: string;
  deviceOwner?: boolean;
  deviceProfile: string;
  hardwareProfile: string;
  lastSeenAt: string;
  lastRecoveryAction?: string;
  lastRecoveryAt?: string;
  lockTaskActive?: boolean;
  lockTaskPermitted?: boolean;
  locationLabel?: string;
  mainConnectUserPersonId?: string;
  mainConnectUserDisplayName?: string;
  primaryCoordinatorDisplayName?: string;
  receiverContactDisplayName?: string;
  receiverContactIsReceiverUser?: boolean;
  receiverContactUserId?: string;
  nativeManufacturer?: string;
  nativeModel?: string;
  nativeSdk?: number;
  nativeVersionCode?: number;
  nativeVersionName?: string;
  provisioningCompletedAt?: string;
  receiverDeviceId: string;
  receiverInstallId: string;
  receiverMode?: string;
  receiverUrl: string;
  shellVersion?: string;
  storageSource?: "local_file" | "supabase";
  uiLayout: string;
};

export type ReceiverShellCapabilityStatuses = {
  batteryOptimization?: string;
  bootStart?: string;
  fullscreen?: string;
  keepAwake?: string;
  kiosk?: string;
  microphone?: string;
  updateChecks?: string;
};

export type ReceiverShellDeviceProfile = {
  capabilityStatuses?: ReceiverShellCapabilityStatuses;
  careCircleId?: string;
  createdAt?: string;
  deviceProfile?: string;
  deviceOwner?: boolean;
  hardwareProfile?: string;
  lastRecoveryAction?: string;
  lastRecoveryAt?: string;
  lastSeenAt?: string;
  lockTaskActive?: boolean;
  lockTaskPermitted?: boolean;
  locationLabel?: string;
  mainConnectUserPersonId?: string;
  mainConnectUserDisplayName?: string;
  primaryCoordinatorDisplayName?: string;
  receiverContactDisplayName?: string;
  receiverContactIsReceiverUser?: boolean;
  receiverContactUserId?: string;
  nativeManufacturer?: string;
  nativeModel?: string;
  nativeSdk?: number;
  nativeVersionCode?: number;
  nativeVersionName?: string;
  pairedAt?: string;
  receiverInstallId?: string;
  provisioningCompletedAt?: string;
  receiverDeviceId: string;
  receiverMode?: string;
  receiverUrl?: string;
  shellVersion?: string;
  status?: string;
  uiLayout?: string;
};

type ReceiverShellClaimIndex = {
  claims: ReceiverShellClaimRecord[];
  updatedAt: string;
  version: 1;
};

const defaultIndexPath = careplandRuntimeTempPath(
  "connect-receiver-shell",
  "claims.json"
);
const defaultClaimTtlMs = 15 * 60 * 1000;
const unpairedReceiverPlaceholderTtlMs = 30 * 60 * 1000;
const prototypeSetupCode = "12345";
const prototypeReceiverDeviceId = "local-dev-rob-gxv3370";

const setupCodeWords = {
  adjectives: ["calm", "kind", "bright", "steady", "sunny", "gentle", "clear", "ready"],
  nouns: ["maple", "porch", "harbor", "garden", "pillow", "lamp", "cedar", "window"],
  closers: ["home", "care", "hello", "anchor", "signal", "button", "morning", "circle"],
} as const;

export async function issueReceiverShellClaim(
  input: {
    careCircleId?: string;
    createdByUserId?: string;
    deviceProfile?: string;
    hardwareProfile?: string;
    mainConnectUserPersonId?: string;
    receiverUrl?: string;
    setupCode?: string;
    uiLayout?: string;
  },
  options: { indexPath?: string; now?: Date; ttlMs?: number } = {}
) {
  const setupCode = input.setupCode?.trim() || "";

  if (!setupCode) {
    throw new ReceiverShellClaimError("Missing receiver setup code.", 400);
  }

  if (!options.indexPath) {
    const supabaseClaim = await tryIssueSupabaseReceiverShellClaim(input, options);
    if (supabaseClaim) return supabaseClaim;
  }

  const localSetupClaim = await tryIssueLocalReceiverShellClaim(input, options);
  if (localSetupClaim) return localSetupClaim;

  if (setupCode !== prototypeSetupCode || !prototypeSetupCodeAllowed()) {
    throw new ReceiverShellClaimError("Setup code not recognized.", 404);
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (options.ttlMs ?? defaultClaimTtlMs));
  const claim: ReceiverShellClaimRecord = {
    claim: `cpclaim_${randomUUID().replace(/-/g, "")}`,
    careCircleId: input.careCircleId?.trim() || undefined,
    createdAt: now.toISOString(),
    createdByUserId: input.createdByUserId?.trim() || undefined,
    deviceProfile: input.deviceProfile?.trim() || "gxv3370",
    expiresAt: expiresAt.toISOString(),
    hardwareProfile: input.hardwareProfile?.trim() || "studio_gxv3370_1024x600",
    mainConnectUserPersonId: input.mainConnectUserPersonId?.trim() || undefined,
    receiverDeviceId: prototypeReceiverDeviceId,
    receiverUrl: input.receiverUrl?.trim() || "",
    setupCode,
    storageSource: "local_file",
    status: "available",
    uiLayout: input.uiLayout?.trim() || "desk_phone_1024x600",
  };

  index.claims = [claim, ...compactClaims(index.claims, now)];
  await writeReceiverShellClaimIndex(index, indexPath);
  return claim;
}

async function tryIssueLocalReceiverShellClaim(
  input: {
    deviceProfile?: string;
    hardwareProfile?: string;
    receiverUrl?: string;
    setupCode?: string;
    uiLayout?: string;
  },
  options: { indexPath?: string; now?: Date }
) {
  const setupCode = normalizeSetupCode(input.setupCode || "");
  if (!setupCode) return null;

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const now = options.now ?? new Date();
  index.claims = index.claims.map((record) => expireClaimIfNeeded(record, now));
  const claimIndex = index.claims.findIndex(
    (record) =>
      record.status === "available" && normalizeSetupCode(record.setupCode) === setupCode
  );
  if (claimIndex < 0) {
    await writeReceiverShellClaimIndex(index, indexPath);
    return null;
  }

  const current = index.claims[claimIndex];
  if (Date.parse(current.expiresAt) <= now.getTime()) {
    index.claims[claimIndex] = { ...current, status: "expired" };
    await writeReceiverShellClaimIndex(index, indexPath);
    throw new ReceiverShellClaimError("Receiver setup code expired.", 410);
  }

  const updated: ReceiverShellClaimRecord = {
    ...current,
    deviceProfile: input.deviceProfile?.trim() || current.deviceProfile,
    hardwareProfile: input.hardwareProfile?.trim() || current.hardwareProfile,
    receiverUrl: input.receiverUrl?.trim() || current.receiverUrl,
    uiLayout: input.uiLayout?.trim() || current.uiLayout,
  };
  index.claims[claimIndex] = updated;
  await writeReceiverShellClaimIndex(index, indexPath);
  return updated;
}

export async function createReceiverShellSetupClaim(
  input: {
    careCircleId?: string;
    createdByUserId?: string;
    deviceProfile?: string;
    expiresInMinutes?: number;
    hardwareProfile?: string;
    locationLabel?: string;
    mainConnectUserPersonId?: string;
    receiverDeviceId?: string;
    receiverInstallId?: string;
    receiverUrl?: string;
    setupCode?: string;
    uiLayout?: string;
  },
  options: { indexPath?: string; now?: Date } = {}
) {
  const now = options.now ?? new Date();
  const ttlMs = Math.max(1, Math.min(input.expiresInMinutes ?? 30, 240)) * 60 * 1000;
  const setupCode = normalizeSetupCode(input.setupCode || createTypeableSetupCode());

  if (!options.indexPath) {
    const supabaseClaim = await tryCreateSupabaseReceiverShellSetupClaim(
      { ...input, setupCode },
      { now, ttlMs }
    );
    if (supabaseClaim) return supabaseClaim;
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const receiverInstallId = input.receiverInstallId?.trim() || "";
  const receiverDeviceId =
    input.receiverDeviceId?.trim() ||
    receiverDeviceIdForUnpairedInstall(index, receiverInstallId) ||
    `receiver-${randomUUID().replace(/-/g, "")}`;
  const locationLabel =
    input.locationLabel?.trim() || defaultReceiverLocationLabel(receiverDeviceId);
  const expiresAt = new Date(now.getTime() + ttlMs);
  const claim: ReceiverShellClaimRecord = {
    careCircleId: input.careCircleId?.trim() || undefined,
    claim: `cpclaim_${randomUUID().replace(/-/g, "")}`,
    createdAt: now.toISOString(),
    createdByUserId: input.createdByUserId?.trim() || undefined,
    deviceProfile: input.deviceProfile?.trim() || "gxv3370",
    expiresAt: expiresAt.toISOString(),
    hardwareProfile: input.hardwareProfile?.trim() || "studio_gxv3370_1024x600",
    locationLabel,
    mainConnectUserPersonId: input.mainConnectUserPersonId?.trim() || undefined,
    receiverDeviceId,
    receiverInstallId: receiverInstallId || undefined,
    receiverUrl: input.receiverUrl?.trim() || "",
    setupCode,
    storageSource: "local_file",
    status: "available",
    uiLayout: input.uiLayout?.trim() || "desk_phone_1024x600",
  };

  index.claims = [
    claim,
    ...compactClaims(index.claims, now).map((record) =>
      record.receiverDeviceId === receiverDeviceId && record.status === "available"
        ? { ...record, status: "expired" as const }
        : record
    ),
  ];
  await writeReceiverShellClaimIndex(index, indexPath);
  return claim;
}

export async function createReceiverShellPairingSession(
  input: {
    deviceProfile?: string;
    hardwareProfile?: string;
    locationLabel?: string;
    receiverDeviceId?: string;
    receiverInstallId?: string;
    receiverUrl?: string;
    uiLayout?: string;
  },
  options: { indexPath?: string; now?: Date; ttlMs?: number } = {}
) {
  const pairingCode = createNumericPairingCode();
  const claim = await createReceiverShellSetupClaim(
    {
      deviceProfile: input.deviceProfile || "android_receiver",
      expiresInMinutes: Math.ceil((options.ttlMs ?? 10 * 60 * 1000) / 60_000),
      hardwareProfile: input.hardwareProfile || "generic_landscape_android",
      locationLabel: input.locationLabel,
      receiverDeviceId: input.receiverDeviceId,
      receiverInstallId: input.receiverInstallId,
      receiverUrl: input.receiverUrl,
      setupCode: pairingCode,
      uiLayout: input.uiLayout || "default_receiver",
    },
    { indexPath: options.indexPath, now: options.now }
  );

  return {
    claim: claim.claim,
    expiresAt: claim.expiresAt,
    pairingCode: formatReceiverPairingCode(claim.setupCode),
    receiverDeviceId: claim.receiverDeviceId,
    status: receiverPairingStatusFromClaim(claim),
    storageSource: claim.storageSource || "local_file",
  };
}

export async function getReceiverShellPairingSession(
  input: {
    pairingCode?: string;
    receiverDeviceId?: string;
  },
  options: { indexPath?: string; now?: Date } = {}
) {
  const setupCode = normalizeReceiverPairingCode(input.pairingCode || "");
  if (!setupCode) {
    throw new ReceiverShellClaimError("Missing receiver pairing code.", 400);
  }

  if (!options.indexPath) {
    const supabaseSession = await tryGetSupabaseReceiverShellPairingSession(
      { ...input, pairingCode: setupCode },
      options
    );
    if (supabaseSession) return supabaseSession;
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const now = options.now ?? new Date();
  index.claims = index.claims.map((record) => expireClaimIfNeeded(record, now));
  const claim = findClaimBySetupCode(index, setupCode, input.receiverDeviceId);
  await writeReceiverShellClaimIndex(index, indexPath);

  if (!claim) {
    throw new ReceiverShellClaimError("Pairing code not found.", 404);
  }

  return receiverPairingSessionFromClaim(claim);
}

export async function pairReceiverShellPairingCode(
  input: {
    careCircleId?: string;
    createdByUserId?: string;
    deviceProfile?: string;
    hardwareProfile?: string;
    locationLabel?: string;
    mainConnectUserDisplayName?: string;
    mainConnectUserPersonId?: string;
    pairingCode?: string;
    receiverUrl?: string;
    targetReceiverDeviceId?: string;
    uiLayout?: string;
  },
  options: { indexPath?: string; now?: Date } = {}
) {
  const setupCode = normalizeReceiverPairingCode(input.pairingCode || "");
  if (!setupCode) {
    throw new ReceiverShellClaimError("Enter the Receiver pairing code.", 400);
  }

  if (!options.indexPath) {
    const supabaseClaim = await tryPairSupabaseReceiverShellPairingCode(
      { ...input, pairingCode: setupCode },
      options
    );
    if (supabaseClaim) return supabaseClaim;
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const now = options.now ?? new Date();
  index.claims = index.claims.map((record) => expireClaimIfNeeded(record, now));
  const claimIndex = index.claims.findIndex((record) => {
    return normalizeReceiverPairingCode(record.setupCode) === setupCode;
  });

  if (claimIndex < 0) {
    throw new ReceiverShellClaimError("Pairing code not found.", 404);
  }

  const current = index.claims[claimIndex];
  assertPairableClaim(current, now);
  const receiverDeviceId = input.targetReceiverDeviceId?.trim() || current.receiverDeviceId;

  const paired: ReceiverShellClaimRecord = {
    ...current,
    careCircleId: input.careCircleId?.trim() || current.careCircleId,
    createdByUserId: input.createdByUserId?.trim() || current.createdByUserId,
    deviceProfile: input.deviceProfile?.trim() || current.deviceProfile,
    hardwareProfile: input.hardwareProfile?.trim() || current.hardwareProfile,
    locationLabel:
      input.locationLabel?.trim() ||
      receiverLocationLabelForPairing(
        receiverDeviceId,
        current.locationLabel,
        input.mainConnectUserDisplayName
      ),
    mainConnectUserPersonId:
      input.mainConnectUserPersonId?.trim() || current.mainConnectUserPersonId,
    mainConnectUserDisplayName:
      input.mainConnectUserDisplayName?.trim() || current.mainConnectUserDisplayName,
    receiverDeviceId,
    receiverUrl: input.receiverUrl?.trim() || current.receiverUrl,
    uiLayout: input.uiLayout?.trim() || current.uiLayout,
  };
  index.claims = index.claims
    .map((record, indexValue) =>
      indexValue === claimIndex
        ? paired
        : record.receiverDeviceId === receiverDeviceId && record.status === "available"
          ? { ...record, status: "expired" as const }
          : record
    )
    .filter(
      (record) =>
        current.receiverDeviceId === receiverDeviceId ||
        record.receiverDeviceId !== current.receiverDeviceId ||
        !receiverShellClaimIsUnpairedPlaceholder(record)
    );
  await writeReceiverShellClaimIndex(index, indexPath);
  return paired;
}

export async function redeemReceiverShellClaim(
  input: {
    claim?: string;
    receiverInstallId?: string;
  },
  options: { indexPath?: string; now?: Date } = {}
) {
  const claimValue = input.claim?.trim() || "";
  if (!claimValue) {
    throw new ReceiverShellClaimError("Missing receiver claim.", 400);
  }

  if (!options.indexPath) {
    const supabaseClaim = await tryRedeemSupabaseReceiverShellClaim(input, options);
    if (supabaseClaim) return supabaseClaim;
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const now = options.now ?? new Date();
  index.claims = index.claims.map((record) => expireClaimIfNeeded(record, now));
  const claimIndex = index.claims.findIndex((record) => record.claim === claimValue);

  if (claimIndex < 0) {
    throw new ReceiverShellClaimError("Receiver claim not found.", 404);
  }

  const current = index.claims[claimIndex];
  if (current.status === "expired") {
    throw new ReceiverShellClaimError("Receiver claim expired.", 410);
  }
  if (current.status === "revoked") {
    throw new ReceiverShellClaimError("Receiver claim was revoked.", 410);
  }
  if (current.status === "used") {
    if (current.receiverInstallId && current.receiverInstallId === input.receiverInstallId) {
      return current;
    }
    throw new ReceiverShellClaimError("Receiver claim has already been used.", 409);
  }

  const redeemed: ReceiverShellClaimRecord = {
    ...current,
    lastSeenAt: now.toISOString(),
    receiverInstallId: input.receiverInstallId?.trim() || current.receiverInstallId,
    redeemedAt: now.toISOString(),
    status: "used",
  };
  index.claims = index.claims.map((record, indexValue) => {
    if (indexValue === claimIndex) return redeemed;
    if (
      record.receiverDeviceId === redeemed.receiverDeviceId &&
      record.status === "used" &&
      record.receiverInstallId !== redeemed.receiverInstallId
    ) {
      return { ...record, status: "revoked" as const };
    }
    return record;
  });
  await writeReceiverShellClaimIndex(index, indexPath);
  return redeemed;
}

export async function verifyReceiverShellBinding(
  input: {
    capabilityStatuses?: ReceiverShellCapabilityStatuses;
    deviceOwner?: boolean;
    lastRecoveryAction?: string;
    lastRecoveryAtMs?: number;
    lockTaskActive?: boolean;
    lockTaskPermitted?: boolean;
    nativeManufacturer?: string;
    nativeModel?: string;
    nativeSdk?: number;
    nativeVersionCode?: number;
    nativeVersionName?: string;
    provisioningCompletedAtMs?: number;
    receiverDeviceId?: string;
    receiverInstallId?: string;
    receiverMode?: string;
    shellVersion?: string;
  },
  options: { indexPath?: string; now?: Date } = {}
): Promise<ReceiverShellBindingRecord> {
  const receiverDeviceId = input.receiverDeviceId?.trim() || "";
  const receiverInstallId = input.receiverInstallId?.trim() || "";
  if (!receiverDeviceId || !receiverInstallId) {
    throw new ReceiverShellBindingError("Missing receiver binding.", 400);
  }

  if (!options.indexPath) {
    const supabaseBinding = await tryVerifySupabaseReceiverShellBinding(input, options);
    if (supabaseBinding) return supabaseBinding;
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const now = options.now ?? new Date();
  const claimIndex = index.claims.findIndex(
    (record) =>
      record.status === "used" &&
      record.receiverDeviceId === receiverDeviceId &&
      record.receiverInstallId === receiverInstallId
  );

  if (claimIndex < 0) {
    throw new ReceiverShellBindingError("Receiver binding not found.", 404);
  }

  const currentClaim = index.claims[claimIndex];
  const claim = {
    ...currentClaim,
    lastSeenAt: now.toISOString(),
    ...definedFields(receiverShellReportFields(input)),
  };
  index.claims[claimIndex] = claim;
  await writeReceiverShellClaimIndex(index, indexPath);

  return {
    bindingStatus: "bound",
    capabilityStatuses: claim.capabilityStatuses,
    careCircleId: claim.careCircleId,
    deviceOwner: claim.deviceOwner,
    deviceProfile: claim.deviceProfile,
    hardwareProfile: claim.hardwareProfile,
    lastSeenAt: now.toISOString(),
    lastRecoveryAction: claim.lastRecoveryAction,
    lastRecoveryAt: claim.lastRecoveryAt,
    lockTaskActive: claim.lockTaskActive,
    lockTaskPermitted: claim.lockTaskPermitted,
    locationLabel: claim.locationLabel,
    mainConnectUserPersonId: claim.mainConnectUserPersonId,
    mainConnectUserDisplayName: claim.mainConnectUserDisplayName,
    primaryCoordinatorDisplayName: claim.primaryCoordinatorDisplayName,
    receiverContactDisplayName: claim.receiverContactDisplayName,
    receiverContactIsReceiverUser: claim.receiverContactIsReceiverUser,
    receiverContactUserId: claim.receiverContactUserId || claim.createdByUserId,
    nativeManufacturer: claim.nativeManufacturer,
    nativeModel: claim.nativeModel,
    nativeSdk: claim.nativeSdk,
    nativeVersionCode: claim.nativeVersionCode,
    nativeVersionName: claim.nativeVersionName,
    provisioningCompletedAt: claim.provisioningCompletedAt,
    receiverDeviceId: claim.receiverDeviceId,
    receiverInstallId,
    receiverMode: claim.receiverMode,
    receiverUrl: claim.receiverUrl,
    shellVersion: claim.shellVersion,
    storageSource: "local_file",
    uiLayout: claim.uiLayout,
  } satisfies ReceiverShellBindingRecord;
}

export async function listReceiverShellDeviceProfiles() {
  await deleteExpiredUnpairedReceiverShellDevices();
  const supabaseProfiles = await tryListSupabaseReceiverShellDeviceProfiles();
  return supabaseProfiles ?? listLocalReceiverShellDeviceProfiles();
}

export async function deleteUnpairedReceiverShellDevice(
  input: {
    receiverDeviceId?: string;
  },
  options: { indexPath?: string; now?: Date } = {}
) {
  const receiverDeviceId = input.receiverDeviceId?.trim() || "";
  if (!receiverDeviceId) {
    throw new ReceiverShellBindingError("Missing receiver device.", 400);
  }

  if (!options.indexPath) {
    const supabaseDelete = await tryDeleteSupabaseUnpairedReceiverShellDevice(input);
    if (supabaseDelete) return supabaseDelete;
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const matchingClaims = index.claims.filter((record) => record.receiverDeviceId === receiverDeviceId);
  if (!matchingClaims.length) {
    throw new ReceiverShellBindingError("Receiver device not found.", 404);
  }
  if (matchingClaims.some((record) => !receiverShellClaimIsUnpairedPlaceholder(record))) {
    throw new ReceiverShellBindingError("Only unpaired setup Receivers can be deleted.", 409);
  }

  index.claims = index.claims.filter((record) => record.receiverDeviceId !== receiverDeviceId);
  await writeReceiverShellClaimIndex(index, indexPath);
  return {
    deletedAt: (options.now ?? new Date()).toISOString(),
    ok: true,
    receiverDeviceId,
    storageSource: "local_file" as const,
  };
}

export async function deleteExpiredUnpairedReceiverShellDevices(
  options: { indexPath?: string; now?: Date } = {}
) {
  const now = options.now ?? new Date();
  const cutoffMs = now.getTime() - unpairedReceiverPlaceholderTtlMs;

  if (!options.indexPath) {
    await tryDeleteExpiredSupabaseUnpairedReceiverShellDevices({ cutoffMs });
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const nextClaims = index.claims.filter((record) => {
    if (!receiverShellClaimIsUnpairedPlaceholder(record)) return true;
    const createdMs = Date.parse(record.createdAt);
    return !Number.isFinite(createdMs) || createdMs > cutoffMs;
  });
  if (nextClaims.length !== index.claims.length) {
    index.claims = nextClaims;
    await writeReceiverShellClaimIndex(index, indexPath);
  }
}

export async function updateReceiverShellDeviceLabel(
  input: {
    locationLabel?: string;
    receiverDeviceId?: string;
  },
  options: { indexPath?: string; now?: Date } = {}
) {
  const receiverDeviceId = input.receiverDeviceId?.trim() || "";
  const locationLabel = input.locationLabel?.trim() || "";
  if (!receiverDeviceId) {
    throw new ReceiverShellBindingError("Missing receiver device.", 400);
  }
  if (!locationLabel) {
    throw new ReceiverShellBindingError("Enter a Receiver name.", 400);
  }
  if (locationLabel.length > 80) {
    throw new ReceiverShellBindingError("Receiver name is too long.", 400);
  }

  if (!options.indexPath) {
    const supabaseUpdate = await tryUpdateSupabaseReceiverShellDeviceLabel(
      { locationLabel, receiverDeviceId },
      options
    );
    if (supabaseUpdate) return supabaseUpdate;
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const now = options.now ?? new Date();
  let found = false;
  index.claims = index.claims.map((record) => {
    if (record.receiverDeviceId !== receiverDeviceId) return record;
    found = true;
    return { ...record, locationLabel };
  });
  if (!found) {
    throw new ReceiverShellBindingError("Receiver device not found.", 404);
  }

  await writeReceiverShellClaimIndex(index, indexPath);
  return {
    locationLabel,
    ok: true,
    receiverDeviceId,
    storageSource: "local_file" as const,
    updatedAt: now.toISOString(),
  };
}

export async function revokeReceiverShellDevice(
  input: {
    receiverDeviceId?: string;
  },
  options: { indexPath?: string; now?: Date } = {}
) {
  const receiverDeviceId = input.receiverDeviceId?.trim() || "";
  if (!receiverDeviceId) {
    throw new ReceiverShellBindingError("Missing receiver device.", 400);
  }

  if (!options.indexPath) {
    const supabaseRevocation = await tryRevokeSupabaseReceiverShellDevice(input, options);
    if (supabaseRevocation) return supabaseRevocation;
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const now = options.now ?? new Date();
  let found = false;
  index.claims = index.claims.map((record) => {
    if (record.receiverDeviceId !== receiverDeviceId) return record;
    found = true;
    return { ...record, status: "revoked" as const };
  });
  if (!found) {
    throw new ReceiverShellBindingError("Receiver device not found.", 404);
  }

  await writeReceiverShellClaimIndex(index, indexPath);
  return {
    ok: true,
    receiverDeviceId,
    revokedAt: now.toISOString(),
    storageSource: "local_file" as const,
  };
}

export class ReceiverShellClaimError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ReceiverShellClaimError";
    this.status = status;
  }
}

export class ReceiverShellBindingError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ReceiverShellBindingError";
    this.status = status;
  }
}

function compactClaims(claims: ReceiverShellClaimRecord[], now: Date) {
  return claims.map((claim) => expireClaimIfNeeded(claim, now)).slice(0, 100);
}

function expireClaimIfNeeded(record: ReceiverShellClaimRecord, now: Date) {
  if (record.status !== "available") return record;
  if (Date.parse(record.expiresAt) > now.getTime()) return record;
  return { ...record, status: "expired" as const };
}

function assertPairableClaim(record: ReceiverShellClaimRecord, now: Date) {
  if (record.status === "used") {
    throw new ReceiverShellClaimError("Receiver has already been paired.", 409);
  }
  if (record.status === "revoked") {
    throw new ReceiverShellClaimError("Receiver pairing code was revoked.", 410);
  }
  if (record.status === "expired" || Date.parse(record.expiresAt) <= now.getTime()) {
    throw new ReceiverShellClaimError("Receiver pairing code expired.", 410);
  }
}

function findClaimBySetupCode(
  index: ReceiverShellClaimIndex,
  setupCode: string,
  receiverDeviceId?: string
) {
  return index.claims.find((record) => {
    if (normalizeReceiverPairingCode(record.setupCode) !== setupCode) return false;
    if (receiverDeviceId?.trim() && record.receiverDeviceId !== receiverDeviceId.trim()) {
      return false;
    }
    return true;
  });
}

function receiverPairingSessionFromClaim(claim: ReceiverShellClaimRecord) {
  return {
    claim: receiverPairingStatusFromClaim(claim) === "paired" ? claim.claim : undefined,
    expiresAt: claim.expiresAt,
    pairingCode: formatReceiverPairingCode(claim.setupCode),
    receiverDeviceId: claim.receiverDeviceId,
    receiverUrl: claim.receiverUrl,
    status: receiverPairingStatusFromClaim(claim),
    storageSource: claim.storageSource || "local_file",
  };
}

function receiverPairingStatusFromClaim(
  claim: ReceiverShellClaimRecord
): ReceiverShellPairingStatus {
  if (claim.status === "used") return "used";
  if (claim.status === "expired") return "expired";
  if (claim.status === "revoked") return "revoked";
  if (claim.mainConnectUserPersonId || claim.careCircleId) return "paired";
  return "pending";
}

function defaultReceiverLocationLabel(receiverDeviceId: string, displayName?: string) {
  const suffix = receiverShortNameSuffix(receiverDeviceId);
  const base = displayName?.trim() ? `${displayName.trim()}'s Receiver` : "Receiver";
  return trimReceiverLocationLabel(suffix ? `${base} ${suffix}` : base);
}

function receiverLocationLabelForPairing(
  receiverDeviceId: string,
  currentLocationLabel?: string,
  displayName?: string
) {
  const current = currentLocationLabel?.trim() || "";
  const genericDefault = defaultReceiverLocationLabel(receiverDeviceId);
  if (current && current !== genericDefault) return current;
  return defaultReceiverLocationLabel(receiverDeviceId, displayName);
}

function receiverShortNameSuffix(receiverDeviceId: string) {
  const normalized = receiverDeviceId.trim().replace(/^receiver-/, "");
  if (!normalized) return "";
  return normalized.length > 6 ? normalized.slice(-6).toUpperCase() : normalized.toUpperCase();
}

function trimReceiverLocationLabel(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 80 ? trimmed.slice(0, 80).trim() : trimmed;
}

function receiverShellClaimIsUnpairedPlaceholder(record: ReceiverShellClaimRecord) {
  return (
    ["available", "expired"].includes(record.status) &&
    !record.careCircleId?.trim() &&
    !record.mainConnectUserPersonId?.trim() &&
    !record.redeemedAt?.trim() &&
    !record.provisioningCompletedAt?.trim()
  );
}

function receiverDeviceIdForUnpairedInstall(
  index: ReceiverShellClaimIndex,
  receiverInstallId: string
) {
  if (!receiverInstallId.trim()) return "";
  const reusable = index.claims
    .filter(
      (record) =>
        receiverShellClaimIsUnpairedPlaceholder(record) &&
        record.receiverInstallId === receiverInstallId
    )
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))[0];
  return reusable?.receiverDeviceId || "";
}

async function readReceiverShellClaimIndex(indexPath: string) {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8")) as Partial<
      ReceiverShellClaimIndex
    >;
    if (Array.isArray(parsed.claims)) {
      return {
        claims: parsed.claims,
        updatedAt: parsed.updatedAt || "",
        version: 1,
      } satisfies ReceiverShellClaimIndex;
    }
  } catch {
    // Start a local claim index on first write.
  }

  return {
    claims: [],
    updatedAt: "",
    version: 1,
  } satisfies ReceiverShellClaimIndex;
}

async function writeReceiverShellClaimIndex(
  index: ReceiverShellClaimIndex,
  indexPath: string
) {
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(
    indexPath,
    `${JSON.stringify({ ...index, updatedAt: new Date().toISOString() }, null, 2)}\n`
  );
}

async function tryIssueSupabaseReceiverShellClaim(
  input: {
    careCircleId?: string;
    deviceProfile?: string;
    hardwareProfile?: string;
    mainConnectUserPersonId?: string;
    receiverUrl?: string;
    setupCode?: string;
    uiLayout?: string;
  },
  options: { now?: Date; ttlMs?: number }
) {
  try {
    const supabase = createSupabaseServiceClient();
    const now = options.now ?? new Date();
    const deviceProfile = input.deviceProfile?.trim() || "gxv3370";
    const hardwareProfile = input.hardwareProfile?.trim() || "studio_gxv3370_1024x600";
    const receiverUrl = input.receiverUrl?.trim() || "";
    const setupCode = normalizeSetupCode(input.setupCode || "");
    const uiLayout = input.uiLayout?.trim() || "desk_phone_1024x600";

    if (!setupCode) {
      throw new ReceiverShellClaimError("Missing receiver setup code.", 400);
    }

    const { data, error } = await supabase
      .from("connect_receiver_claims")
      .select("*")
      .eq("setup_code", setupCode)
      .eq("status", "available")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new ReceiverShellClaimError("Setup code not recognized.", 404);
    }

    const current = supabaseClaimRecord(data);
    if (Date.parse(current.expiresAt) <= now.getTime()) {
      await supabase
        .from("connect_receiver_claims")
        .update({ status: "expired" })
        .eq("claim", current.claim)
        .eq("status", "available");
      throw new ReceiverShellClaimError("Receiver setup code expired.", 410);
    }

    const { error: deviceError } = await supabase
      .from("connect_receiver_devices")
      .update(
        definedFields({
          device_profile: deviceProfile,
          hardware_profile: hardwareProfile,
          receiver_url: receiverUrl,
          status: "claim_pending",
          ui_layout: uiLayout,
          updated_at: now.toISOString(),
        })
      )
      .eq("id", current.receiverDeviceId);
    if (deviceError) throw deviceError;

    const { data: updated, error: updateError } = await supabase
      .from("connect_receiver_claims")
      .update(
        definedFields({
          device_profile: deviceProfile,
          hardware_profile: hardwareProfile,
          receiver_url: receiverUrl,
          ui_layout: uiLayout,
        })
      )
      .eq("claim", current.claim)
      .eq("status", "available")
      .select("*")
      .single();
    if (updateError) throw updateError;

    return supabaseClaimRecord(updated);
  } catch (error) {
    if (error instanceof ReceiverShellClaimError) throw error;
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

async function tryCreateSupabaseReceiverShellSetupClaim(
  input: {
    careCircleId?: string;
    createdByUserId?: string;
    deviceProfile?: string;
    hardwareProfile?: string;
    locationLabel?: string;
    mainConnectUserPersonId?: string;
    receiverDeviceId?: string;
    receiverInstallId?: string;
    receiverUrl?: string;
    setupCode?: string;
    uiLayout?: string;
  },
  options: { now: Date; ttlMs: number }
) {
  try {
    const supabase = createSupabaseServiceClient();
    const now = options.now;
    const expiresAt = new Date(now.getTime() + options.ttlMs);
    const receiverInstallId = input.receiverInstallId?.trim() || "";
    const reusableReceiverDeviceId = receiverInstallId
      ? await tryFindSupabaseUnpairedReceiverDeviceForInstall(receiverInstallId)
      : "";
    const receiverDeviceId =
      input.receiverDeviceId?.trim() ||
      reusableReceiverDeviceId ||
      `receiver-${randomUUID().replace(/-/g, "")}`;
    const claim = `cpclaim_${randomUUID().replace(/-/g, "")}`;
    const { data: existingDevice, error: existingDeviceError } = await supabase
      .from("connect_receiver_devices")
      .select(
        "care_circle_id, device_profile, hardware_profile, location_label, main_connect_user_person_id, receiver_url, status, ui_layout"
      )
      .eq("id", receiverDeviceId)
      .maybeSingle();
    if (existingDeviceError) throw existingDeviceError;

    const deviceProfile =
      input.deviceProfile?.trim() || stringFromRow(existingDevice?.device_profile) || "gxv3370";
    const hardwareProfile =
      input.hardwareProfile?.trim() ||
      stringFromRow(existingDevice?.hardware_profile) ||
      "studio_gxv3370_1024x600";
    const receiverUrl = input.receiverUrl?.trim() || stringFromRow(existingDevice?.receiver_url);
    const setupCode = normalizeSetupCode(input.setupCode || createTypeableSetupCode());
    const uiLayout =
      input.uiLayout?.trim() || stringFromRow(existingDevice?.ui_layout) || "desk_phone_1024x600";
    const careCircleId =
      input.careCircleId?.trim() || stringFromRow(existingDevice?.care_circle_id) || undefined;
    const mainConnectUserPersonId =
      input.mainConnectUserPersonId?.trim() ||
      stringFromRow(existingDevice?.main_connect_user_person_id) ||
      undefined;
    const createdByUserId = uuidOrUndefined(input.createdByUserId);
    const locationLabel =
      input.locationLabel?.trim() ||
      stringFromRow(existingDevice?.location_label) ||
      defaultReceiverLocationLabel(receiverDeviceId);
    const existingStatus = stringFromRow(existingDevice?.status);
    const receiverStatus =
      existingStatus && existingStatus !== "revoked" ? existingStatus : "setup_pending";

    const { error: deviceError } = await supabase
      .from("connect_receiver_devices")
      .upsert(
        definedFields({
          care_circle_id: careCircleId,
          device_profile: deviceProfile,
          hardware_profile: hardwareProfile,
          id: receiverDeviceId,
          location_label: locationLabel,
          main_connect_user_person_id: mainConnectUserPersonId,
          receiver_install_id: receiverInstallId,
          receiver_url: receiverUrl,
          status: receiverStatus,
          ui_layout: uiLayout,
          updated_at: now.toISOString(),
        }),
        { onConflict: "id" }
      );
    if (deviceError) throw deviceError;

    const { data, error } = await supabase
      .from("connect_receiver_claims")
      .insert(
        definedFields({
          claim,
          created_at: now.toISOString(),
          created_by_user_id: createdByUserId,
          device_profile: deviceProfile,
          expires_at: expiresAt.toISOString(),
          hardware_profile: hardwareProfile,
          receiver_device_id: receiverDeviceId,
          receiver_install_id: receiverInstallId,
          receiver_url: receiverUrl,
          setup_code: setupCode,
          status: "available",
          ui_layout: uiLayout,
        })
      )
      .select("*")
      .single();
    if (error) throw error;

    await supabase
      .from("connect_receiver_claims")
      .update({ status: "expired" })
      .eq("receiver_device_id", receiverDeviceId)
      .eq("status", "available")
      .neq("claim", claim);

    return supabaseClaimRecord(data);
  } catch (error) {
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

async function tryFindSupabaseUnpairedReceiverDeviceForInstall(receiverInstallId: string) {
  if (!receiverInstallId.trim()) return "";
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("connect_receiver_devices")
    .select(
      "id, bound_at, care_circle_id, last_seen_at, main_connect_user_person_id, provisioning_completed_at, receiver_install_id, status"
    )
    .eq("receiver_install_id", receiverInstallId)
    .in("status", ["setup_pending", "claim_pending"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return supabaseReceiverDeviceIsUnpairedPlaceholder(data) ? stringFromRow(data?.id) : "";
}

async function tryGetSupabaseReceiverShellPairingSession(
  input: {
    pairingCode?: string;
    receiverDeviceId?: string;
  },
  options: { now?: Date }
) {
  try {
    const supabase = createSupabaseServiceClient();
    const now = options.now ?? new Date();
    const setupCode = normalizeReceiverPairingCode(input.pairingCode || "");

    const { data, error } = await supabase
      .from("connect_receiver_claims")
      .select("*, connect_receiver_devices(*)")
      .eq("setup_code", setupCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new ReceiverShellClaimError("Pairing code not found.", 404);
    }

    const claim = supabaseClaimRecordWithDevice(data);
    if (
      input.receiverDeviceId?.trim() &&
      claim.receiverDeviceId !== input.receiverDeviceId.trim()
    ) {
      throw new ReceiverShellClaimError("Pairing code not found.", 404);
    }
    if (claim.status === "available" && Date.parse(claim.expiresAt) <= now.getTime()) {
      await supabase
        .from("connect_receiver_claims")
        .update({ status: "expired" })
        .eq("claim", claim.claim)
        .eq("status", "available");
      return receiverPairingSessionFromClaim({ ...claim, status: "expired" });
    }

    return receiverPairingSessionFromClaim(claim);
  } catch (error) {
    if (error instanceof ReceiverShellClaimError) throw error;
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

async function tryPairSupabaseReceiverShellPairingCode(
  input: {
    careCircleId?: string;
    createdByUserId?: string;
    deviceProfile?: string;
    hardwareProfile?: string;
    locationLabel?: string;
    mainConnectUserDisplayName?: string;
    mainConnectUserPersonId?: string;
    pairingCode?: string;
    receiverUrl?: string;
    targetReceiverDeviceId?: string;
    uiLayout?: string;
  },
  options: { now?: Date }
) {
  try {
    const supabase = createSupabaseServiceClient();
    const now = options.now ?? new Date();
    const setupCode = normalizeReceiverPairingCode(input.pairingCode || "");
    const { data, error } = await supabase
      .from("connect_receiver_claims")
      .select("*, connect_receiver_devices(*)")
      .eq("setup_code", setupCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new ReceiverShellClaimError("Pairing code not found.", 404);
    }

    const current = supabaseClaimRecordWithDevice(data);
    assertPairableClaim(current, now);

    const deviceProfile = input.deviceProfile?.trim() || current.deviceProfile;
    const hardwareProfile = input.hardwareProfile?.trim() || current.hardwareProfile;
    const receiverUrl = input.receiverUrl?.trim() || current.receiverUrl;
    const uiLayout = input.uiLayout?.trim() || current.uiLayout;
    const careCircleId = input.careCircleId?.trim() || current.careCircleId;
    const mainConnectUserPersonId =
      input.mainConnectUserPersonId?.trim() || current.mainConnectUserPersonId;
    const receiverDeviceId = input.targetReceiverDeviceId?.trim() || current.receiverDeviceId;
    const locationLabel =
      input.locationLabel?.trim() ||
      receiverLocationLabelForPairing(
        receiverDeviceId,
        current.locationLabel,
        input.mainConnectUserDisplayName
      );

    const { data: updatedDevice, error: deviceError } = await supabase
      .from("connect_receiver_devices")
      .update(
        definedFields({
          care_circle_id: careCircleId,
          device_profile: deviceProfile,
          hardware_profile: hardwareProfile,
          location_label: locationLabel,
          main_connect_user_person_id: mainConnectUserPersonId,
          receiver_url: receiverUrl,
          status: "claim_pending",
          ui_layout: uiLayout,
          updated_at: now.toISOString(),
        })
      )
      .eq("id", receiverDeviceId)
      .neq("status", "revoked")
      .select("id")
      .single();
    if (deviceError) {
      if (supabaseRecordNotFound(deviceError)) {
        throw new ReceiverShellClaimError("Receiver device is unavailable for pairing.", 410);
      }
      throw deviceError;
    }
    if (!updatedDevice) {
      throw new ReceiverShellClaimError("Receiver device is unavailable for pairing.", 410);
    }

    const { data: updated, error: updateError } = await supabase
      .from("connect_receiver_claims")
      .update(
        definedFields({
          created_by_user_id: uuidOrUndefined(input.createdByUserId),
          device_profile: deviceProfile,
          hardware_profile: hardwareProfile,
          receiver_device_id: receiverDeviceId,
          receiver_url: receiverUrl,
          ui_layout: uiLayout,
        })
      )
      .eq("claim", current.claim)
      .eq("status", "available")
      .select("*, connect_receiver_devices(*)")
      .single();
    if (updateError) throw updateError;

    if (receiverDeviceId !== current.receiverDeviceId) {
      await tryDeleteSupabaseUnpairedReceiverShellDevice({
        receiverDeviceId: current.receiverDeviceId,
      });
    }

    return supabaseClaimRecordWithDevice(updated);
  } catch (error) {
    if (error instanceof ReceiverShellClaimError) throw error;
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

async function tryRedeemSupabaseReceiverShellClaim(
  input: {
    claim?: string;
    receiverInstallId?: string;
  },
  options: { now?: Date }
) {
  try {
    const supabase = createSupabaseServiceClient();
    const now = options.now ?? new Date();
    const claim = input.claim?.trim() || "";
    const { data, error } = await supabase
      .from("connect_receiver_claims")
      .select("*, connect_receiver_devices(*)")
      .eq("claim", claim)
      .single();
    if (error) throw error;

    const current = supabaseClaimRecordWithDevice(data);
    if (current.status === "available" && Date.parse(current.expiresAt) <= now.getTime()) {
      await supabase
        .from("connect_receiver_claims")
        .update({ status: "expired" })
        .eq("claim", claim);
      throw new ReceiverShellClaimError("Receiver claim expired.", 410);
    }
    if (current.status === "expired") {
      throw new ReceiverShellClaimError("Receiver claim expired.", 410);
    }
    if (current.status === "revoked") {
      throw new ReceiverShellClaimError("Receiver claim was revoked.", 410);
    }
    if (current.status === "used") {
      if (current.receiverInstallId && current.receiverInstallId === input.receiverInstallId) {
        return current;
      }
      throw new ReceiverShellClaimError("Receiver claim has already been used.", 409);
    }

    const receiverInstallId = input.receiverInstallId?.trim() || "";
    const { data: updated, error: updateError } = await supabase
      .from("connect_receiver_claims")
      .update({
        receiver_install_id: receiverInstallId,
        redeemed_at: now.toISOString(),
        status: "used",
      })
      .eq("claim", claim)
      .eq("status", "available")
      .select("*")
      .single();
    if (updateError) throw updateError;

    const { error: deviceError } = await supabase
      .from("connect_receiver_devices")
      .update({
        bound_at: now.toISOString(),
        receiver_install_id: receiverInstallId,
        status: "bound",
        updated_at: now.toISOString(),
      })
      .eq("id", current.receiverDeviceId);
    if (deviceError) throw deviceError;

    const displayNames = await tryGetSupabaseCareSubjectDisplayNames([
      current.mainConnectUserPersonId,
    ]);
    const receiverContactUserId = current.createdByUserId || stringFromRow(updated.created_by_user_id);
    const receiverContactDisplayNames = await tryGetSupabaseProfileDisplayNames([
      receiverContactUserId,
    ]);
    const receiverContactSelfFlags = await tryGetSupabaseReceiverContactSelfFlags([
      {
        careCircleId: current.careCircleId,
        receiverContactUserId,
        receiverDeviceId: current.receiverDeviceId,
        receiverUserPersonId: current.mainConnectUserPersonId,
      },
    ]);
    const primaryCoordinator = await readPrimaryCoordinatorForCareCircle(
      current.careCircleId
    );

    return {
      ...supabaseClaimRecord(updated),
      careCircleId: current.careCircleId,
      mainConnectUserDisplayName: displayNames.get(current.mainConnectUserPersonId || ""),
      mainConnectUserPersonId: current.mainConnectUserPersonId,
      primaryCoordinatorDisplayName: primaryCoordinator.displayName,
      receiverContactDisplayName: receiverContactDisplayNames.get(receiverContactUserId),
      receiverContactIsReceiverUser:
        receiverContactSelfFlags.get(current.receiverDeviceId) ?? false,
      receiverContactUserId,
    };
  } catch (error) {
    if (error instanceof ReceiverShellClaimError) throw error;
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

async function tryVerifySupabaseReceiverShellBinding(
  input: {
    capabilityStatuses?: ReceiverShellCapabilityStatuses;
    deviceOwner?: boolean;
    lastRecoveryAction?: string;
    lastRecoveryAtMs?: number;
    lockTaskActive?: boolean;
    lockTaskPermitted?: boolean;
    nativeManufacturer?: string;
    nativeModel?: string;
    nativeSdk?: number;
    nativeVersionCode?: number;
    nativeVersionName?: string;
    provisioningCompletedAtMs?: number;
    receiverDeviceId?: string;
    receiverInstallId?: string;
    receiverMode?: string;
    shellVersion?: string;
  },
  options: { now?: Date }
): Promise<ReceiverShellBindingRecord | null> {
  try {
    const supabase = createSupabaseServiceClient();
    const now = options.now ?? new Date();
    const receiverDeviceId = input.receiverDeviceId?.trim() || "";
    const receiverInstallId = input.receiverInstallId?.trim() || "";
    const { data, error } = await supabase
      .from("connect_receiver_devices")
      .select("*")
      .eq("id", receiverDeviceId)
      .single();
    if (error) {
      if (supabaseRecordNotFound(error)) {
        throw new ReceiverShellBindingError("Receiver binding not found.", 404);
      }
      throw error;
    }

    const status = stringFromRow(data.status);
    if (status === "revoked") {
      throw new ReceiverShellBindingError("Receiver binding was revoked.", 403);
    }
    if (status !== "bound") {
      throw new ReceiverShellBindingError("Receiver binding is not complete.", 409);
    }
    if (stringFromRow(data.receiver_install_id) !== receiverInstallId) {
      throw new ReceiverShellBindingError("Receiver binding does not match this install.", 409);
    }

    const lastSeenAt = now.toISOString();
    const shellReportFields = receiverShellReportDatabaseFields(input);
    const { error: updateError } = await supabase
      .from("connect_receiver_devices")
      .update({
        last_seen_at: lastSeenAt,
        ...shellReportFields,
        updated_at: lastSeenAt,
      })
      .eq("id", receiverDeviceId)
      .eq("receiver_install_id", receiverInstallId)
      .eq("status", "bound");
    if (updateError) {
      if (!supabaseReceiverProfileColumnsUnavailable(updateError)) throw updateError;
      const { error: fallbackUpdateError } = await supabase
        .from("connect_receiver_devices")
        .update({
          last_seen_at: lastSeenAt,
          updated_at: lastSeenAt,
        })
        .eq("id", receiverDeviceId)
        .eq("receiver_install_id", receiverInstallId)
        .eq("status", "bound");
      if (fallbackUpdateError) throw fallbackUpdateError;
    }

    const mainConnectUserPersonId = stringFromRow(data.main_connect_user_person_id);
    const displayNames = await tryGetSupabaseCareSubjectDisplayNames([
      mainConnectUserPersonId,
    ]);
    const careCircleId = stringFromRow(data.care_circle_id);
    const { data: contactClaimRows, error: contactClaimError } = await supabase
      .from("connect_receiver_claims")
      .select("created_by_user_id")
      .eq("receiver_device_id", receiverDeviceId)
      .in("status", ["used", "available"])
      .order("redeemed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);
    if (contactClaimError) throw contactClaimError;
    const receiverContactUserId = stringFromRow(
      Array.isArray(contactClaimRows) ? contactClaimRows[0]?.created_by_user_id : ""
    );
    const receiverContactDisplayNames = await tryGetSupabaseProfileDisplayNames([
      receiverContactUserId,
    ]);
    const receiverContactSelfFlags = await tryGetSupabaseReceiverContactSelfFlags([
      {
        careCircleId,
        receiverContactUserId,
        receiverDeviceId,
        receiverUserPersonId: mainConnectUserPersonId,
      },
    ]);
    const primaryCoordinator = await readPrimaryCoordinatorForCareCircle(careCircleId);

    return {
      bindingStatus: "bound",
      capabilityStatuses:
        normalizeCapabilityStatuses(input.capabilityStatuses) ||
        capabilityStatusesFromRow(data.capability_statuses),
      careCircleId,
      deviceOwner: booleanOrUndefined(input.deviceOwner ?? data.device_owner),
      deviceProfile: stringFromRow(data.device_profile),
      hardwareProfile: stringFromRow(data.hardware_profile),
      lastSeenAt,
      lastRecoveryAction:
        input.lastRecoveryAction?.trim() || stringFromRow(data.last_recovery_action),
      lastRecoveryAt:
        timestampFromMs(input.lastRecoveryAtMs) || stringFromRow(data.last_recovery_at),
      lockTaskActive: booleanOrUndefined(input.lockTaskActive ?? data.lock_task_active),
      lockTaskPermitted: booleanOrUndefined(input.lockTaskPermitted ?? data.lock_task_permitted),
      locationLabel: stringFromRow(data.location_label),
      mainConnectUserPersonId,
      mainConnectUserDisplayName: displayNames.get(mainConnectUserPersonId),
      primaryCoordinatorDisplayName: primaryCoordinator.displayName,
      receiverContactDisplayName: receiverContactDisplayNames.get(receiverContactUserId),
      receiverContactIsReceiverUser: receiverContactSelfFlags.get(receiverDeviceId) ?? false,
      receiverContactUserId,
      nativeManufacturer:
        input.nativeManufacturer?.trim() || stringFromRow(data.native_manufacturer),
      nativeModel: input.nativeModel?.trim() || stringFromRow(data.native_model),
      nativeSdk: finiteNumberOrUndefined(input.nativeSdk ?? data.native_sdk),
      nativeVersionCode: finiteNumberOrUndefined(
        input.nativeVersionCode ?? data.native_version_code
      ),
      nativeVersionName:
        input.nativeVersionName?.trim() || stringFromRow(data.native_version_name),
      provisioningCompletedAt:
        timestampFromMs(input.provisioningCompletedAtMs) ||
        stringFromRow(data.provisioning_completed_at),
      receiverDeviceId: stringFromRow(data.id),
      receiverInstallId,
      receiverMode: normalizeReceiverMode(input.receiverMode) || stringFromRow(data.receiver_mode),
      receiverUrl: stringFromRow(data.receiver_url),
      shellVersion: input.shellVersion?.trim() || stringFromRow(data.shell_version),
      storageSource: "supabase",
      uiLayout: stringFromRow(data.ui_layout),
    } satisfies ReceiverShellBindingRecord;
  } catch (error) {
    if (error instanceof ReceiverShellBindingError) throw error;
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

async function tryListSupabaseReceiverShellDeviceProfiles() {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("connect_receiver_devices")
      .select(receiverShellProfileColumns.join(","));
    if (error) {
      if (!supabaseReceiverProfileColumnsUnavailable(error)) throw error;
      const fallback = await supabase
        .from("connect_receiver_devices")
        .select(receiverShellCoreProfileColumns.join(","));
      if (fallback.error) throw fallback.error;
      return receiverShellDeviceProfilesFromRows(fallback.data ?? []);
    }

    return receiverShellDeviceProfilesFromRows(data ?? []);
  } catch (error) {
    if (
      isMissingServerEnvError(error) ||
      supabaseProvisioningUnavailable(error) ||
      supabaseReceiverProfileColumnsUnavailable(error)
    ) {
      return null;
    }
    throw error;
  }
}

const receiverShellCoreProfileColumns = [
  "id",
  "created_at",
  "care_circle_id",
  "device_profile",
  "main_connect_user_person_id",
  "receiver_install_id",
  "receiver_url",
  "status",
  "ui_layout",
  "last_seen_at",
  "location_label",
  "hardware_profile",
  "bound_at",
];

const receiverShellProfileColumns = [
  ...receiverShellCoreProfileColumns,
  "receiver_mode",
  "provisioning_completed_at",
  "capability_statuses",
  "native_version_code",
  "native_version_name",
  "shell_version",
  "native_manufacturer",
  "native_model",
  "native_sdk",
  "device_owner",
  "lock_task_permitted",
  "lock_task_active",
  "last_recovery_action",
  "last_recovery_at",
];

async function receiverShellDeviceProfilesFromRows(
  rowsInput: unknown
): Promise<ReceiverShellDeviceProfile[]> {
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  const displayNames = await tryGetSupabaseCareSubjectDisplayNames(
    rows.map((rawRow) =>
      stringFromRow((rawRow as unknown as Record<string, unknown>).main_connect_user_person_id)
    )
  );
  const receiverContactUserIdsByDevice = await tryGetSupabaseReceiverContactUserIds(
    rows.map((rawRow) => stringFromRow((rawRow as unknown as Record<string, unknown>).id))
  );
  const receiverContactDisplayNames = await tryGetSupabaseProfileDisplayNames([
    ...receiverContactUserIdsByDevice.values(),
  ]);
  const receiverContactSelfFlags = await tryGetSupabaseReceiverContactSelfFlags(
    rows.map((rawRow) => {
      const row = rawRow as unknown as Record<string, unknown>;
      const receiverDeviceId = stringFromRow(row.id);
      return {
        careCircleId: stringFromRow(row.care_circle_id),
        receiverContactUserId: receiverContactUserIdsByDevice.get(receiverDeviceId),
        receiverDeviceId,
        receiverUserPersonId: stringFromRow(row.main_connect_user_person_id),
      };
    })
  );
  const coordinatorNames = new Map<string, string>();
  await Promise.all(
    rows.map(async (rawRow) => {
      const row = rawRow as unknown as Record<string, unknown>;
      const careCircleId = stringFromRow(row.care_circle_id);
      if (!careCircleId || coordinatorNames.has(careCircleId)) return;
      const coordinator = await readPrimaryCoordinatorForCareCircle(careCircleId);
      coordinatorNames.set(careCircleId, coordinator.displayName);
    })
  );

  return rows.map((rawRow) => {
    const row = rawRow as unknown as Record<string, unknown>;
    const mainConnectUserPersonId = stringFromRow(row.main_connect_user_person_id);
    const careCircleId = stringFromRow(row.care_circle_id);
    return {
      capabilityStatuses: capabilityStatusesFromRow(row.capability_statuses),
      careCircleId,
      createdAt: stringFromRow(row.created_at),
      deviceProfile: stringFromRow(row.device_profile),
      deviceOwner: booleanOrUndefined(row.device_owner),
      hardwareProfile: stringFromRow(row.hardware_profile),
      lastRecoveryAction: stringFromRow(row.last_recovery_action),
      lastRecoveryAt: stringFromRow(row.last_recovery_at),
      lastSeenAt: stringFromRow(row.last_seen_at),
      lockTaskActive: booleanOrUndefined(row.lock_task_active),
      lockTaskPermitted: booleanOrUndefined(row.lock_task_permitted),
      locationLabel: stringFromRow(row.location_label),
      mainConnectUserPersonId,
      mainConnectUserDisplayName: displayNames.get(mainConnectUserPersonId),
      primaryCoordinatorDisplayName: coordinatorNames.get(careCircleId),
      receiverContactDisplayName: receiverContactDisplayNames.get(
        receiverContactUserIdsByDevice.get(stringFromRow(row.id)) || ""
      ),
      receiverContactIsReceiverUser: receiverContactSelfFlags.get(stringFromRow(row.id)) ?? false,
      receiverContactUserId: receiverContactUserIdsByDevice.get(stringFromRow(row.id)),
      nativeManufacturer: stringFromRow(row.native_manufacturer),
      nativeModel: stringFromRow(row.native_model),
      nativeSdk: finiteNumberOrUndefined(row.native_sdk),
      nativeVersionCode: finiteNumberOrUndefined(row.native_version_code),
      nativeVersionName: stringFromRow(row.native_version_name),
      pairedAt: stringFromRow(row.bound_at),
      provisioningCompletedAt: stringFromRow(row.provisioning_completed_at),
      receiverInstallId: stringFromRow(row.receiver_install_id),
      receiverDeviceId: stringFromRow(row.id),
      receiverMode: stringFromRow(row.receiver_mode),
      receiverUrl: stringFromRow(row.receiver_url),
      shellVersion: stringFromRow(row.shell_version),
      status: stringFromRow(row.status),
      uiLayout: stringFromRow(row.ui_layout),
    };
  }) satisfies ReceiverShellDeviceProfile[];
}

async function tryUpdateSupabaseReceiverShellDeviceLabel(
  input: {
    locationLabel: string;
    receiverDeviceId: string;
  },
  options: { now?: Date }
) {
  try {
    const supabase = createSupabaseServiceClient();
    const now = options.now ?? new Date();
    const { data, error } = await supabase
      .from("connect_receiver_devices")
      .update({
        location_label: input.locationLabel,
        updated_at: now.toISOString(),
      })
      .eq("id", input.receiverDeviceId)
      .neq("status", "revoked")
      .select("id, location_label")
      .single();
    if (error) {
      if (supabaseRecordNotFound(error)) {
        throw new ReceiverShellBindingError("Receiver device not found.", 404);
      }
      throw error;
    }

    return {
      locationLabel: stringFromRow(data.location_label),
      ok: true,
      receiverDeviceId: stringFromRow(data.id),
      storageSource: "supabase" as const,
      updatedAt: now.toISOString(),
    };
  } catch (error) {
    if (error instanceof ReceiverShellBindingError) throw error;
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

async function listLocalReceiverShellDeviceProfiles() {
  const index = await readReceiverShellClaimIndex(defaultIndexPath);
  const profiles = new Map<string, ReceiverShellDeviceProfile>();
  for (const claim of index.claims) {
    if (claim.status !== "used" || !claim.receiverDeviceId) continue;
    profiles.set(claim.receiverDeviceId, {
      capabilityStatuses: claim.capabilityStatuses,
      careCircleId: claim.careCircleId,
      createdAt: claim.createdAt,
      deviceProfile: claim.deviceProfile,
      deviceOwner: claim.deviceOwner,
      hardwareProfile: claim.hardwareProfile,
      lastRecoveryAction: claim.lastRecoveryAction,
      lastRecoveryAt: claim.lastRecoveryAt,
      lastSeenAt: claim.lastSeenAt,
      lockTaskActive: claim.lockTaskActive,
      lockTaskPermitted: claim.lockTaskPermitted,
      locationLabel: claim.locationLabel,
      mainConnectUserPersonId: claim.mainConnectUserPersonId,
      mainConnectUserDisplayName: claim.mainConnectUserDisplayName,
      primaryCoordinatorDisplayName: claim.primaryCoordinatorDisplayName,
      receiverContactDisplayName: claim.receiverContactDisplayName,
      receiverContactIsReceiverUser: claim.receiverContactIsReceiverUser,
      receiverContactUserId: claim.receiverContactUserId || claim.createdByUserId,
      nativeManufacturer: claim.nativeManufacturer,
      nativeModel: claim.nativeModel,
      nativeSdk: claim.nativeSdk,
      nativeVersionCode: claim.nativeVersionCode,
      nativeVersionName: claim.nativeVersionName,
      pairedAt: claim.redeemedAt,
      provisioningCompletedAt: claim.provisioningCompletedAt,
      receiverInstallId: claim.receiverInstallId,
      receiverDeviceId: claim.receiverDeviceId,
      receiverMode: claim.receiverMode,
      receiverUrl: claim.receiverUrl,
      shellVersion: claim.shellVersion,
      status: claim.status === "used" ? "bound" : claim.status,
      uiLayout: claim.uiLayout,
    });
  }
  return [...profiles.values()];
}

async function tryDeleteSupabaseUnpairedReceiverShellDevice(input: {
  receiverDeviceId?: string;
}) {
  try {
    const supabase = createSupabaseServiceClient();
    const receiverDeviceId = input.receiverDeviceId?.trim() || "";
    const { data, error } = await supabase
      .from("connect_receiver_devices")
      .select(
        "id, bound_at, care_circle_id, last_seen_at, main_connect_user_person_id, provisioning_completed_at, receiver_install_id, status"
      )
      .eq("id", receiverDeviceId)
      .single();
    if (error) {
      if (supabaseRecordNotFound(error)) {
        throw new ReceiverShellBindingError("Receiver device not found.", 404);
      }
      throw error;
    }

    if (!supabaseReceiverDeviceIsUnpairedPlaceholder(data)) {
      throw new ReceiverShellBindingError("Only unpaired setup Receivers can be deleted.", 409);
    }

    const { error: claimsError } = await supabase
      .from("connect_receiver_claims")
      .delete()
      .eq("receiver_device_id", receiverDeviceId);
    if (claimsError) throw claimsError;

    const { error: deleteError } = await supabase
      .from("connect_receiver_devices")
      .delete()
      .eq("id", receiverDeviceId);
    if (deleteError) throw deleteError;

    return {
      deletedAt: new Date().toISOString(),
      ok: true,
      receiverDeviceId: stringFromRow(data.id),
      storageSource: "supabase" as const,
    };
  } catch (error) {
    if (error instanceof ReceiverShellBindingError) throw error;
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

async function tryDeleteExpiredSupabaseUnpairedReceiverShellDevices(input: { cutoffMs: number }) {
  try {
    const supabase = createSupabaseServiceClient();
    const cutoff = new Date(input.cutoffMs).toISOString();
    const { data, error } = await supabase
      .from("connect_receiver_devices")
      .select(
        "id, bound_at, care_circle_id, created_at, last_seen_at, main_connect_user_person_id, provisioning_completed_at, receiver_install_id, status"
      )
      .in("status", ["setup_pending"])
      .is("bound_at", null)
      .is("care_circle_id", null)
      .is("last_seen_at", null)
      .is("main_connect_user_person_id", null)
      .is("provisioning_completed_at", null)
      .lte("created_at", cutoff);
    if (error) throw error;

    const receiverDeviceIds = (Array.isArray(data) ? data : [])
      .filter((row) => supabaseReceiverDeviceIsUnpairedPlaceholder(row))
      .map((row) => stringFromRow(row.id))
      .filter(Boolean);
    if (!receiverDeviceIds.length) return { deleted: 0, storageSource: "supabase" as const };

    const { error: claimsError } = await supabase
      .from("connect_receiver_claims")
      .delete()
      .in("receiver_device_id", receiverDeviceIds);
    if (claimsError) throw claimsError;

    const { error: deleteError } = await supabase
      .from("connect_receiver_devices")
      .delete()
      .in("id", receiverDeviceIds);
    if (deleteError) throw deleteError;

    return { deleted: receiverDeviceIds.length, storageSource: "supabase" as const };
  } catch (error) {
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

function supabaseReceiverDeviceIsUnpairedPlaceholder(row: unknown) {
  const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  const status = stringFromRow(record.status);
  return (
    ["setup_pending"].includes(status) &&
    !stringFromRow(record.bound_at) &&
    !stringFromRow(record.care_circle_id) &&
    !stringFromRow(record.last_seen_at) &&
    !stringFromRow(record.main_connect_user_person_id) &&
    !stringFromRow(record.provisioning_completed_at)
  );
}

async function tryRevokeSupabaseReceiverShellDevice(
  input: {
    receiverDeviceId?: string;
  },
  options: { now?: Date }
) {
  try {
    const supabase = createSupabaseServiceClient();
    const now = options.now ?? new Date();
    const revokedAt = now.toISOString();
    const receiverDeviceId = input.receiverDeviceId?.trim() || "";
    const { data, error } = await supabase
      .from("connect_receiver_devices")
      .update({
        revoked_at: revokedAt,
        status: "revoked",
        updated_at: revokedAt,
      })
      .eq("id", receiverDeviceId)
      .select("id")
      .single();
    if (error) {
      if (supabaseRecordNotFound(error)) {
        throw new ReceiverShellBindingError("Receiver device not found.", 404);
      }
      throw error;
    }

    const { error: claimsError } = await supabase
      .from("connect_receiver_claims")
      .update({
        revoked_at: revokedAt,
        status: "revoked",
      })
      .eq("receiver_device_id", receiverDeviceId)
      .in("status", ["available", "used"]);
    if (claimsError) throw claimsError;

    return {
      ok: true,
      receiverDeviceId: stringFromRow(data.id),
      revokedAt,
      storageSource: "supabase" as const,
    };
  } catch (error) {
    if (error instanceof ReceiverShellBindingError) throw error;
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

function supabaseClaimRecord(row: Record<string, unknown>): ReceiverShellClaimRecord {
  return {
    careCircleId: stringFromRow(row.care_circle_id) || undefined,
    claim: stringFromRow(row.claim),
    createdAt: stringFromRow(row.created_at),
    createdByUserId: stringFromRow(row.created_by_user_id) || undefined,
    deviceProfile: stringFromRow(row.device_profile),
    expiresAt: stringFromRow(row.expires_at),
    hardwareProfile: stringFromRow(row.hardware_profile),
    mainConnectUserPersonId: stringFromRow(row.main_connect_user_person_id) || undefined,
    receiverDeviceId: stringFromRow(row.receiver_device_id),
    receiverInstallId: stringFromRow(row.receiver_install_id),
    receiverUrl: stringFromRow(row.receiver_url),
    redeemedAt: stringFromRow(row.redeemed_at) || undefined,
    setupCode: stringFromRow(row.setup_code),
    storageSource: "supabase",
    status: receiverClaimStatusFromRow(row.status),
    uiLayout: stringFromRow(row.ui_layout),
  };
}

function supabaseClaimRecordWithDevice(row: Record<string, unknown>): ReceiverShellClaimRecord {
  const claim = supabaseClaimRecord(row);
  const device =
    row.connect_receiver_devices &&
    typeof row.connect_receiver_devices === "object" &&
    !Array.isArray(row.connect_receiver_devices)
      ? (row.connect_receiver_devices as Record<string, unknown>)
      : {};
  return {
    ...claim,
    careCircleId: claim.careCircleId || stringFromRow(device.care_circle_id) || undefined,
    mainConnectUserPersonId:
      claim.mainConnectUserPersonId ||
      stringFromRow(device.main_connect_user_person_id) ||
      undefined,
    receiverUrl: claim.receiverUrl || stringFromRow(device.receiver_url),
  };
}

async function tryGetSupabaseCareSubjectDisplayNames(personIds: Array<string | undefined>) {
  const ids = [...new Set(personIds.map((id) => id?.trim()).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (!ids.length) return names;

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("care_subjects")
      .select("id, display_name")
      .in("id", ids);
    if (error) throw error;

    for (const row of Array.isArray(data) ? data : []) {
      const record = row as Record<string, unknown>;
      const id = stringFromRow(record.id);
      const displayName = stringFromRow(record.display_name);
      if (id && displayName) names.set(id, displayName);
    }
  } catch (error) {
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return names;
    }
    throw error;
  }

  return names;
}

async function tryGetSupabaseProfileDisplayNames(userIds: Array<string | undefined>) {
  const ids = [...new Set(userIds.map((id) => id?.trim()).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (!ids.length) return names;

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, given_name, family_name")
      .in("id", ids);
    if (error) throw error;

    for (const row of Array.isArray(data) ? data : []) {
      const record = row as Record<string, unknown>;
      const id = stringFromRow(record.id);
      const displayName = profileDisplayNameFromRow(record);
      if (id && displayName) names.set(id, displayName);
    }
  } catch (error) {
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return names;
    }
    throw error;
  }

  return names;
}

async function tryGetSupabaseReceiverContactUserIds(receiverDeviceIds: string[]) {
  const ids = [...new Set(receiverDeviceIds.map((id) => id.trim()).filter(Boolean))];
  const contactsByDevice = new Map<string, string>();
  if (!ids.length) return contactsByDevice;

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("connect_receiver_claims")
      .select("receiver_device_id, created_by_user_id, redeemed_at, created_at")
      .in("receiver_device_id", ids)
      .not("created_by_user_id", "is", null)
      .order("redeemed_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;

    for (const row of Array.isArray(data) ? data : []) {
      const record = row as Record<string, unknown>;
      const receiverDeviceId = stringFromRow(record.receiver_device_id);
      const userId = stringFromRow(record.created_by_user_id);
      if (receiverDeviceId && userId && !contactsByDevice.has(receiverDeviceId)) {
        contactsByDevice.set(receiverDeviceId, userId);
      }
    }
  } catch (error) {
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return contactsByDevice;
    }
    throw error;
  }

  return contactsByDevice;
}

async function tryGetSupabaseReceiverContactSelfFlags(
  inputs: Array<{
    careCircleId?: string;
    receiverContactUserId?: string;
    receiverDeviceId?: string;
    receiverUserPersonId?: string;
  }>
) {
  const flagsByDevice = new Map<string, boolean>();
  const completeInputs = inputs
    .map((input) => ({
      careCircleId: input.careCircleId?.trim() || "",
      receiverContactUserId: input.receiverContactUserId?.trim() || "",
      receiverDeviceId: input.receiverDeviceId?.trim() || "",
      receiverUserPersonId: input.receiverUserPersonId?.trim() || "",
    }))
    .filter(
      (input) =>
        input.careCircleId &&
        input.receiverContactUserId &&
        input.receiverDeviceId &&
        input.receiverUserPersonId
    );
  if (!completeInputs.length) return flagsByDevice;

  try {
    const supabase = createSupabaseServiceClient();
    const receiverUserPersonIds = [
      ...new Set(completeInputs.map((input) => input.receiverUserPersonId)),
    ];
    const contactUserIds = [
      ...new Set(completeInputs.map((input) => input.receiverContactUserId)),
    ];
    const { data: subjects, error: subjectError } = await supabase
      .from("care_subjects")
      .select("id, care_circle_id, is_default")
      .in("id", receiverUserPersonIds);
    if (subjectError) throw subjectError;

    const { data: memberships, error: membershipError } = await supabase
      .from("care_circle_memberships")
      .select("care_circle_id, user_id, status")
      .in("user_id", contactUserIds)
      .eq("status", "active");
    if (membershipError) throw membershipError;

    const defaultSubjectKeys = new Set(
      (Array.isArray(subjects) ? subjects : [])
        .map((row) => row as Record<string, unknown>)
        .filter((row) => row.is_default === true)
        .map((row) => `${stringFromRow(row.care_circle_id)}:${stringFromRow(row.id)}`)
    );
    const membershipKeys = new Set(
      (Array.isArray(memberships) ? memberships : [])
        .map((row) => row as Record<string, unknown>)
        .map((row) => `${stringFromRow(row.care_circle_id)}:${stringFromRow(row.user_id)}`)
    );

    for (const input of completeInputs) {
      flagsByDevice.set(
        input.receiverDeviceId,
        defaultSubjectKeys.has(`${input.careCircleId}:${input.receiverUserPersonId}`) &&
          membershipKeys.has(`${input.careCircleId}:${input.receiverContactUserId}`)
      );
    }
  } catch (error) {
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return flagsByDevice;
    }
    throw error;
  }

  return flagsByDevice;
}

function profileDisplayNameFromRow(row: Record<string, unknown>) {
  const displayName = stringFromRow(row.display_name);
  if (displayName) return displayName;

  const fullName = [stringFromRow(row.given_name), stringFromRow(row.family_name)]
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;

  return stringFromRow(row.email);
}

function supabaseRecordNotFound(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string };
  return maybeError.code === "PGRST116";
}

function receiverClaimStatusFromRow(value: unknown): ReceiverShellClaimStatus {
  return value === "used" || value === "expired" || value === "revoked"
    ? value
    : "available";
}

function prototypeSetupCodeAllowed() {
  return (
    process.env.CONNECT_RECEIVER_ALLOW_PROTOTYPE_SETUP_CODE === "1" ||
    process.env.NODE_ENV !== "production"
  );
}

function createTypeableSetupCode() {
  return [
    randomSetupWord(setupCodeWords.adjectives),
    randomSetupWord(setupCodeWords.nouns),
    randomSetupWord(setupCodeWords.closers),
  ].join("-");
}

function createNumericPairingCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createNumericReceiverSetupCode() {
  return createNumericPairingCode();
}

export function normalizeReceiverPairingCode(value: string) {
  const compactDigits = value.replace(/\D/g, "");
  if (compactDigits.length >= 5) return compactDigits;
  return normalizeSetupCode(value);
}

export function formatReceiverPairingCode(value: string) {
  const normalized = normalizeReceiverPairingCode(value);
  if (/^\d{6}$/.test(normalized)) {
    return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
  }
  return normalized;
}

function randomSetupWord(words: readonly string[]) {
  return words[Math.floor(Math.random() * words.length)] || "ready";
}

function normalizeSetupCode(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function uuidOrUndefined(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    trimmed
  )
    ? trimmed
    : undefined;
}

function stringFromRow(value: unknown) {
  return typeof value === "string" ? value : "";
}

function receiverShellReportFields(
  input: {
    capabilityStatuses?: ReceiverShellCapabilityStatuses;
    deviceOwner?: boolean;
    lastRecoveryAction?: string;
    lastRecoveryAtMs?: number;
    lockTaskActive?: boolean;
    lockTaskPermitted?: boolean;
    nativeManufacturer?: string;
    nativeModel?: string;
    nativeSdk?: number;
    nativeVersionCode?: number;
    nativeVersionName?: string;
    provisioningCompletedAtMs?: number;
    receiverMode?: string;
    shellVersion?: string;
  }
) {
  return {
    capabilityStatuses: normalizeCapabilityStatuses(input.capabilityStatuses),
    deviceOwner: booleanOrUndefined(input.deviceOwner),
    lastRecoveryAction: input.lastRecoveryAction?.trim() || undefined,
    lastRecoveryAt: timestampFromMs(input.lastRecoveryAtMs),
    lockTaskActive: booleanOrUndefined(input.lockTaskActive),
    lockTaskPermitted: booleanOrUndefined(input.lockTaskPermitted),
    nativeManufacturer: input.nativeManufacturer?.trim() || undefined,
    nativeModel: input.nativeModel?.trim() || undefined,
    nativeSdk: finiteNumberOrUndefined(input.nativeSdk),
    nativeVersionCode: finiteNumberOrUndefined(input.nativeVersionCode),
    nativeVersionName: input.nativeVersionName?.trim() || undefined,
    provisioningCompletedAt: timestampFromMs(input.provisioningCompletedAtMs),
    receiverMode: normalizeReceiverMode(input.receiverMode),
    shellVersion: input.shellVersion?.trim() || undefined,
  };
}

function definedFields<T extends Record<string, unknown>>(fields: T) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

function receiverShellReportDatabaseFields(
  input: Parameters<typeof receiverShellReportFields>[0]
) {
  const fields = receiverShellReportFields(input);
  const databaseFields: Record<string, unknown> = {};
  if (fields.capabilityStatuses) databaseFields.capability_statuses = fields.capabilityStatuses;
  if (fields.deviceOwner !== undefined) databaseFields.device_owner = fields.deviceOwner;
  if (fields.lastRecoveryAction !== undefined) {
    databaseFields.last_recovery_action = fields.lastRecoveryAction;
  }
  if (fields.lastRecoveryAt !== undefined) databaseFields.last_recovery_at = fields.lastRecoveryAt;
  if (fields.lockTaskActive !== undefined) databaseFields.lock_task_active = fields.lockTaskActive;
  if (fields.lockTaskPermitted !== undefined) {
    databaseFields.lock_task_permitted = fields.lockTaskPermitted;
  }
  if (fields.nativeManufacturer !== undefined) {
    databaseFields.native_manufacturer = fields.nativeManufacturer;
  }
  if (fields.nativeModel !== undefined) databaseFields.native_model = fields.nativeModel;
  if (fields.nativeSdk !== undefined) databaseFields.native_sdk = fields.nativeSdk;
  if (fields.nativeVersionCode !== undefined) {
    databaseFields.native_version_code = fields.nativeVersionCode;
  }
  if (fields.nativeVersionName !== undefined) {
    databaseFields.native_version_name = fields.nativeVersionName;
  }
  if (fields.provisioningCompletedAt !== undefined) {
    databaseFields.provisioning_completed_at = fields.provisioningCompletedAt;
  }
  if (fields.receiverMode !== undefined) databaseFields.receiver_mode = fields.receiverMode;
  if (fields.shellVersion !== undefined) databaseFields.shell_version = fields.shellVersion;
  return databaseFields;
}

function normalizeReceiverMode(value: unknown) {
  if (value === "dedicated" || value === "personal") return value;
  return undefined;
}

function normalizeCapabilityStatuses(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const statuses: ReceiverShellCapabilityStatuses = {};
  for (const key of [
    "batteryOptimization",
    "bootStart",
    "fullscreen",
    "keepAwake",
    "kiosk",
    "microphone",
    "updateChecks",
  ] as const) {
    const status = normalizeCapabilityStatus(source[key]);
    if (status) statuses[key] = status;
  }
  return Object.keys(statuses).length ? statuses : undefined;
}

function normalizeCapabilityStatus(value: unknown) {
  return value === "supported" ||
    value === "enabled" ||
    value === "unavailable" ||
    value === "unknown"
    ? value
    : undefined;
}

function capabilityStatusesFromRow(value: unknown) {
  if (typeof value === "string") {
    try {
      return normalizeCapabilityStatuses(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  return normalizeCapabilityStatuses(value);
}

function booleanOrUndefined(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function finiteNumberOrUndefined(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function timestampFromMs(value: unknown) {
  const timestamp = finiteNumberOrUndefined(value);
  if (!timestamp || timestamp <= 0) return undefined;
  return new Date(timestamp).toISOString();
}

function supabaseReceiverProfileColumnsUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message || "";
  return (
    maybeError.code === "42703" ||
    maybeError.code === "PGRST204" ||
    message.includes("receiver_mode") ||
    message.includes("capability_statuses") ||
    message.includes("provisioning_completed_at")
  );
}

function supabaseProvisioningUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message || "";
  return (
    maybeError.code === "42P01" ||
    maybeError.code === "PGRST205" ||
    message.includes("connect_receiver_claims") ||
    message.includes("connect_receiver_devices")
  );
}
