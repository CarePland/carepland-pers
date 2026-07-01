import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { isMissingServerEnvError } from "../../platform/server/env";
import { createSupabaseServiceClient } from "../../platform/server/supabase";

export type ReceiverShellClaimStatus = "available" | "expired" | "revoked" | "used";

export type ReceiverShellClaimRecord = {
  capabilityStatuses?: ReceiverShellCapabilityStatuses;
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
  deviceOwner?: boolean;
  deviceProfile: string;
  hardwareProfile: string;
  lastSeenAt: string;
  lastRecoveryAction?: string;
  lastRecoveryAt?: string;
  lockTaskActive?: boolean;
  lockTaskPermitted?: boolean;
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
  deviceOwner?: boolean;
  hardwareProfile?: string;
  lastRecoveryAction?: string;
  lastRecoveryAt?: string;
  lockTaskActive?: boolean;
  lockTaskPermitted?: boolean;
  nativeManufacturer?: string;
  nativeModel?: string;
  nativeSdk?: number;
  nativeVersionCode?: number;
  nativeVersionName?: string;
  provisioningCompletedAt?: string;
  receiverDeviceId: string;
  receiverMode?: string;
  shellVersion?: string;
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

export async function issueReceiverShellClaim(
  input: {
    deviceProfile?: string;
    hardwareProfile?: string;
    receiverUrl?: string;
    setupCode?: string;
    uiLayout?: string;
  },
  options: { indexPath?: string; now?: Date; ttlMs?: number } = {}
) {
  const setupCode = input.setupCode?.trim() || "";
  if (setupCode !== prototypeSetupCode) {
    throw new ReceiverShellClaimError("Setup code not recognized.", 404);
  }

  if (!options.indexPath) {
    const supabaseClaim = await tryIssueSupabaseReceiverShellClaim(input, options);
    if (supabaseClaim) return supabaseClaim;
  }

  const indexPath = options.indexPath ?? defaultIndexPath;
  const index = await readReceiverShellClaimIndex(indexPath);
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (options.ttlMs ?? defaultClaimTtlMs));
  const claim: ReceiverShellClaimRecord = {
    claim: `cpclaim_${randomUUID().replace(/-/g, "")}`,
    createdAt: now.toISOString(),
    deviceProfile: input.deviceProfile?.trim() || "gxv3370",
    expiresAt: expiresAt.toISOString(),
    hardwareProfile: input.hardwareProfile?.trim() || "studio_gxv3370_1024x600",
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
    deviceOwner: claim.deviceOwner,
    deviceProfile: claim.deviceProfile,
    hardwareProfile: claim.hardwareProfile,
    lastSeenAt: now.toISOString(),
    lastRecoveryAction: claim.lastRecoveryAction,
    lastRecoveryAt: claim.lastRecoveryAt,
    lockTaskActive: claim.lockTaskActive,
    lockTaskPermitted: claim.lockTaskPermitted,
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
    deviceProfile?: string;
    hardwareProfile?: string;
    receiverUrl?: string;
    setupCode?: string;
    uiLayout?: string;
  },
  options: { now?: Date; ttlMs?: number }
) {
  try {
    const supabase = createSupabaseServiceClient();
    const now = options.now ?? new Date();
    const expiresAt = new Date(now.getTime() + (options.ttlMs ?? defaultClaimTtlMs));
    const receiverDeviceId = prototypeReceiverDeviceId;
    const claim = `cpclaim_${randomUUID().replace(/-/g, "")}`;
    const deviceProfile = input.deviceProfile?.trim() || "gxv3370";
    const hardwareProfile = input.hardwareProfile?.trim() || "studio_gxv3370_1024x600";
    const receiverUrl = input.receiverUrl?.trim() || "";
    const setupCode = input.setupCode?.trim() || "";
    const uiLayout = input.uiLayout?.trim() || "desk_phone_1024x600";

    const { error: deviceError } = await supabase
      .from("connect_receiver_devices")
      .upsert(
        {
          device_profile: deviceProfile,
          hardware_profile: hardwareProfile,
          id: receiverDeviceId,
          receiver_url: receiverUrl,
          status: "claim_pending",
          ui_layout: uiLayout,
          updated_at: now.toISOString(),
        },
        { onConflict: "id" }
      );
    if (deviceError) throw deviceError;

    const { data, error } = await supabase
      .from("connect_receiver_claims")
      .insert({
        claim,
        created_at: now.toISOString(),
        device_profile: deviceProfile,
        expires_at: expiresAt.toISOString(),
        hardware_profile: hardwareProfile,
        receiver_device_id: receiverDeviceId,
        receiver_url: receiverUrl,
        setup_code: setupCode,
        status: "available",
        ui_layout: uiLayout,
      })
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
      .select("*")
      .eq("claim", claim)
      .single();
    if (error) throw error;

    const current = supabaseClaimRecord(data);
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

    return supabaseClaimRecord(updated);
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

    return {
      bindingStatus: "bound",
      capabilityStatuses:
        normalizeCapabilityStatuses(input.capabilityStatuses) ||
        capabilityStatusesFromRow(data.capability_statuses),
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
      .select(
        [
          "id",
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
          "hardware_profile",
        ].join(",")
      );
    if (error) throw error;

    return (Array.isArray(data) ? data : []).map((rawRow) => {
      const row = rawRow as unknown as Record<string, unknown>;
      return {
      capabilityStatuses: capabilityStatusesFromRow(row.capability_statuses),
      deviceOwner: booleanOrUndefined(row.device_owner),
      hardwareProfile: stringFromRow(row.hardware_profile),
      lastRecoveryAction: stringFromRow(row.last_recovery_action),
      lastRecoveryAt: stringFromRow(row.last_recovery_at),
      lockTaskActive: booleanOrUndefined(row.lock_task_active),
      lockTaskPermitted: booleanOrUndefined(row.lock_task_permitted),
      nativeManufacturer: stringFromRow(row.native_manufacturer),
      nativeModel: stringFromRow(row.native_model),
      nativeSdk: finiteNumberOrUndefined(row.native_sdk),
      nativeVersionCode: finiteNumberOrUndefined(row.native_version_code),
      nativeVersionName: stringFromRow(row.native_version_name),
      provisioningCompletedAt: stringFromRow(row.provisioning_completed_at),
      receiverDeviceId: stringFromRow(row.id),
      receiverMode: stringFromRow(row.receiver_mode),
      shellVersion: stringFromRow(row.shell_version),
      };
    }) satisfies ReceiverShellDeviceProfile[];
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

async function listLocalReceiverShellDeviceProfiles() {
  const index = await readReceiverShellClaimIndex(defaultIndexPath);
  const profiles = new Map<string, ReceiverShellDeviceProfile>();
  for (const claim of index.claims) {
    if (claim.status !== "used" || !claim.receiverDeviceId) continue;
    profiles.set(claim.receiverDeviceId, {
      capabilityStatuses: claim.capabilityStatuses,
      deviceOwner: claim.deviceOwner,
      hardwareProfile: claim.hardwareProfile,
      lastRecoveryAction: claim.lastRecoveryAction,
      lastRecoveryAt: claim.lastRecoveryAt,
      lockTaskActive: claim.lockTaskActive,
      lockTaskPermitted: claim.lockTaskPermitted,
      nativeManufacturer: claim.nativeManufacturer,
      nativeModel: claim.nativeModel,
      nativeSdk: claim.nativeSdk,
      nativeVersionCode: claim.nativeVersionCode,
      nativeVersionName: claim.nativeVersionName,
      provisioningCompletedAt: claim.provisioningCompletedAt,
      receiverDeviceId: claim.receiverDeviceId,
      receiverMode: claim.receiverMode,
      shellVersion: claim.shellVersion,
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
    claim: stringFromRow(row.claim),
    createdAt: stringFromRow(row.created_at),
    deviceProfile: stringFromRow(row.device_profile),
    expiresAt: stringFromRow(row.expires_at),
    hardwareProfile: stringFromRow(row.hardware_profile),
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
