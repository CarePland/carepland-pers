import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { isMissingServerEnvError } from "../../platform/server/env";
import { createSupabaseServiceClient } from "../../platform/server/supabase";

export type ReceiverShellClaimStatus = "available" | "expired" | "revoked" | "used";
export type ReceiverShellPairingStatus = "pending" | "paired" | "expired" | "revoked" | "used";

export type ReceiverShellClaimRecord = {
  capabilityStatuses?: ReceiverShellCapabilityStatuses;
  careCircleId?: string;
  claim: string;
  createdAt: string;
  deviceOwner?: boolean;
  deviceProfile: string;
  expiresAt: string;
  hardwareProfile: string;
  lastRecoveryAction?: string;
  lastRecoveryAt?: string;
  lockTaskActive?: boolean;
  lockTaskPermitted?: boolean;
  mainConnectUserPersonId?: string;
  mainConnectUserDisplayName?: string;
  nativeManufacturer?: string;
  nativeModel?: string;
  nativeSdk?: number;
  nativeVersionCode?: number;
  nativeVersionName?: string;
  provisioningCompletedAt?: string;
  receiverDeviceId: string;
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
  mainConnectUserPersonId?: string;
  mainConnectUserDisplayName?: string;
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
  deviceProfile?: string;
  deviceOwner?: boolean;
  hardwareProfile?: string;
  lastRecoveryAction?: string;
  lastRecoveryAt?: string;
  lastSeenAt?: string;
  lockTaskActive?: boolean;
  lockTaskPermitted?: boolean;
  mainConnectUserPersonId?: string;
  mainConnectUserDisplayName?: string;
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

const defaultIndexPath = path.join(
  process.cwd(),
  "tmp",
  "connect-receiver-shell",
  "claims.json"
);
const defaultClaimTtlMs = 15 * 60 * 1000;
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
    mainConnectUserPersonId?: string;
    receiverDeviceId?: string;
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

  const receiverDeviceId =
    input.receiverDeviceId?.trim() || `receiver-${randomUUID().replace(/-/g, "")}`;
  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const expiresAt = new Date(now.getTime() + ttlMs);
  const claim: ReceiverShellClaimRecord = {
    careCircleId: input.careCircleId?.trim() || undefined,
    claim: `cpclaim_${randomUUID().replace(/-/g, "")}`,
    createdAt: now.toISOString(),
    deviceProfile: input.deviceProfile?.trim() || "gxv3370",
    expiresAt: expiresAt.toISOString(),
    hardwareProfile: input.hardwareProfile?.trim() || "studio_gxv3370_1024x600",
    mainConnectUserPersonId: input.mainConnectUserPersonId?.trim() || undefined,
    receiverDeviceId,
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

export async function createReceiverShellPairingSession(
  input: {
    deviceProfile?: string;
    hardwareProfile?: string;
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
      receiverDeviceId: input.receiverDeviceId,
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
    mainConnectUserPersonId?: string;
    pairingCode?: string;
    receiverUrl?: string;
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

  const paired: ReceiverShellClaimRecord = {
    ...current,
    careCircleId: input.careCircleId?.trim() || current.careCircleId,
    deviceProfile: input.deviceProfile?.trim() || current.deviceProfile,
    hardwareProfile: input.hardwareProfile?.trim() || current.hardwareProfile,
    mainConnectUserPersonId:
      input.mainConnectUserPersonId?.trim() || current.mainConnectUserPersonId,
    receiverUrl: input.receiverUrl?.trim() || current.receiverUrl,
    uiLayout: input.uiLayout?.trim() || current.uiLayout,
  };
  index.claims[claimIndex] = paired;
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
    receiverInstallId: input.receiverInstallId?.trim() || current.receiverInstallId,
    redeemedAt: now.toISOString(),
    status: "used",
  };
  index.claims[claimIndex] = redeemed;
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
) {
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

  const claim = {
    ...index.claims[claimIndex],
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
    mainConnectUserPersonId: claim.mainConnectUserPersonId,
    mainConnectUserDisplayName: claim.mainConnectUserDisplayName,
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
  const supabaseProfiles = await tryListSupabaseReceiverShellDeviceProfiles();
  return supabaseProfiles ?? listLocalReceiverShellDeviceProfiles();
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
    mainConnectUserPersonId?: string;
    receiverDeviceId?: string;
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
    const receiverDeviceId =
      input.receiverDeviceId?.trim() || `receiver-${randomUUID().replace(/-/g, "")}`;
    const claim = `cpclaim_${randomUUID().replace(/-/g, "")}`;
    const deviceProfile = input.deviceProfile?.trim() || "gxv3370";
    const hardwareProfile = input.hardwareProfile?.trim() || "studio_gxv3370_1024x600";
    const receiverUrl = input.receiverUrl?.trim() || "";
    const setupCode = normalizeSetupCode(input.setupCode || createTypeableSetupCode());
    const uiLayout = input.uiLayout?.trim() || "desk_phone_1024x600";
    const careCircleId = input.careCircleId?.trim() || undefined;
    const mainConnectUserPersonId = input.mainConnectUserPersonId?.trim() || undefined;
    const createdByUserId = uuidOrUndefined(input.createdByUserId);

    const { error: deviceError } = await supabase
      .from("connect_receiver_devices")
      .upsert(
        definedFields({
          care_circle_id: careCircleId,
          device_profile: deviceProfile,
          hardware_profile: hardwareProfile,
          id: receiverDeviceId,
          main_connect_user_person_id: mainConnectUserPersonId,
          receiver_url: receiverUrl,
          status: "setup_pending",
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
          receiver_url: receiverUrl,
          setup_code: setupCode,
          status: "available",
          ui_layout: uiLayout,
        })
      )
      .select("*")
      .single();
    if (error) throw error;

    return supabaseClaimRecord(data);
  } catch (error) {
    if (isMissingServerEnvError(error) || supabaseProvisioningUnavailable(error)) {
      return null;
    }
    throw error;
  }
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
    mainConnectUserPersonId?: string;
    pairingCode?: string;
    receiverUrl?: string;
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

    const { error: deviceError } = await supabase
      .from("connect_receiver_devices")
      .update(
        definedFields({
          care_circle_id: careCircleId,
          device_profile: deviceProfile,
          hardware_profile: hardwareProfile,
          main_connect_user_person_id: mainConnectUserPersonId,
          receiver_url: receiverUrl,
          status: "claim_pending",
          ui_layout: uiLayout,
          updated_at: now.toISOString(),
        })
      )
      .eq("id", current.receiverDeviceId)
      .neq("status", "revoked");
    if (deviceError) throw deviceError;

    const { data: updated, error: updateError } = await supabase
      .from("connect_receiver_claims")
      .update(
        definedFields({
          created_by_user_id: uuidOrUndefined(input.createdByUserId),
          device_profile: deviceProfile,
          hardware_profile: hardwareProfile,
          receiver_url: receiverUrl,
          ui_layout: uiLayout,
        })
      )
      .eq("claim", current.claim)
      .eq("status", "available")
      .select("*, connect_receiver_devices(*)")
      .single();
    if (updateError) throw updateError;

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

    return {
      ...supabaseClaimRecord(updated),
      mainConnectUserDisplayName: displayNames.get(current.mainConnectUserPersonId || ""),
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
) {
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

    return {
      bindingStatus: "bound",
      capabilityStatuses:
        normalizeCapabilityStatuses(input.capabilityStatuses) ||
        capabilityStatusesFromRow(data.capability_statuses),
      careCircleId: stringFromRow(data.care_circle_id),
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
      mainConnectUserPersonId,
      mainConnectUserDisplayName: displayNames.get(mainConnectUserPersonId),
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
  "care_circle_id",
  "device_profile",
  "main_connect_user_person_id",
  "receiver_install_id",
  "receiver_url",
  "status",
  "ui_layout",
  "last_seen_at",
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

  return rows.map((rawRow) => {
    const row = rawRow as unknown as Record<string, unknown>;
    const mainConnectUserPersonId = stringFromRow(row.main_connect_user_person_id);
    return {
      capabilityStatuses: capabilityStatusesFromRow(row.capability_statuses),
      careCircleId: stringFromRow(row.care_circle_id),
      deviceProfile: stringFromRow(row.device_profile),
      deviceOwner: booleanOrUndefined(row.device_owner),
      hardwareProfile: stringFromRow(row.hardware_profile),
      lastRecoveryAction: stringFromRow(row.last_recovery_action),
      lastRecoveryAt: stringFromRow(row.last_recovery_at),
      lastSeenAt: stringFromRow(row.last_seen_at),
      lockTaskActive: booleanOrUndefined(row.lock_task_active),
      lockTaskPermitted: booleanOrUndefined(row.lock_task_permitted),
      mainConnectUserPersonId,
      mainConnectUserDisplayName: displayNames.get(mainConnectUserPersonId),
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

async function listLocalReceiverShellDeviceProfiles() {
  const index = await readReceiverShellClaimIndex(defaultIndexPath);
  const profiles = new Map<string, ReceiverShellDeviceProfile>();
  for (const claim of index.claims) {
    if (claim.status !== "used" || !claim.receiverDeviceId) continue;
    profiles.set(claim.receiverDeviceId, {
      capabilityStatuses: claim.capabilityStatuses,
      careCircleId: claim.careCircleId,
      deviceProfile: claim.deviceProfile,
      deviceOwner: claim.deviceOwner,
      hardwareProfile: claim.hardwareProfile,
      lastRecoveryAction: claim.lastRecoveryAction,
      lastRecoveryAt: claim.lastRecoveryAt,
      lockTaskActive: claim.lockTaskActive,
      lockTaskPermitted: claim.lockTaskPermitted,
      mainConnectUserPersonId: claim.mainConnectUserPersonId,
      mainConnectUserDisplayName: claim.mainConnectUserDisplayName,
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
