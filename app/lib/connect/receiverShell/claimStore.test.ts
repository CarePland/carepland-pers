import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  issueReceiverShellClaim,
  ReceiverShellClaimError,
  redeemReceiverShellClaim,
  ReceiverShellBindingError,
  revokeReceiverShellDevice,
  verifyReceiverShellBinding,
} from "./claimStore";

async function withClaimIndex<T>(run: (indexPath: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(tmpdir(), "receiver-claims-"));
  try {
    return await run(path.join(dir, "claims.json"));
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

describe("receiver shell claim store", () => {
  it("issues and redeems a short-lived receiver claim", async () => {
    await withClaimIndex(async (indexPath) => {
      const claim = await issueReceiverShellClaim(
        {
          receiverUrl: "http://10.0.2.2:3002/connect/receiver",
          setupCode: "12345",
        },
        { indexPath, now: new Date("2026-06-27T12:00:00.000Z") }
      );

      assert.equal(claim.status, "available");
      assert.equal(claim.receiverDeviceId, "local-dev-rob-gxv3370");

      const redeemed = await redeemReceiverShellClaim(
        {
          claim: claim.claim,
          receiverInstallId: "install-1",
        },
        { indexPath, now: new Date("2026-06-27T12:01:00.000Z") }
      );

      assert.equal(redeemed.status, "used");
      assert.equal(redeemed.receiverInstallId, "install-1");

      const binding = await verifyReceiverShellBinding(
        {
          receiverDeviceId: redeemed.receiverDeviceId,
          receiverInstallId: "install-1",
        },
        { indexPath, now: new Date("2026-06-27T12:02:00.000Z") }
      );

      assert.equal(binding.bindingStatus, "bound");
      assert.equal(binding.receiverDeviceId, "local-dev-rob-gxv3370");
      assert.equal(binding.receiverInstallId, "install-1");
      assert.equal(binding.storageSource, "local_file");
    });
  });

  it("rejects unknown setup codes", async () => {
    await withClaimIndex(async (indexPath) => {
      await assert.rejects(
        () => issueReceiverShellClaim({ setupCode: "nope" }, { indexPath }),
        (error) =>
          error instanceof ReceiverShellClaimError &&
          error.status === 404 &&
          error.message === "Setup code not recognized."
      );
    });
  });

  it("rejects expired claims", async () => {
    await withClaimIndex(async (indexPath) => {
      const claim = await issueReceiverShellClaim(
        { setupCode: "12345" },
        { indexPath, now: new Date("2026-06-27T12:00:00.000Z"), ttlMs: 1_000 }
      );

      await assert.rejects(
        () =>
          redeemReceiverShellClaim(
            { claim: claim.claim, receiverInstallId: "install-1" },
            { indexPath, now: new Date("2026-06-27T12:02:00.000Z") }
          ),
        (error) =>
          error instanceof ReceiverShellClaimError &&
          error.status === 410 &&
          error.message === "Receiver claim expired."
      );
    });
  });

  it("rejects receiver binding checks from another install", async () => {
    await withClaimIndex(async (indexPath) => {
      const claim = await issueReceiverShellClaim(
        { setupCode: "12345" },
        { indexPath, now: new Date("2026-06-27T12:00:00.000Z") }
      );

      await redeemReceiverShellClaim(
        { claim: claim.claim, receiverInstallId: "install-1" },
        { indexPath, now: new Date("2026-06-27T12:01:00.000Z") }
      );

      await assert.rejects(
        () =>
          verifyReceiverShellBinding(
            {
              receiverDeviceId: claim.receiverDeviceId,
              receiverInstallId: "install-2",
            },
            { indexPath, now: new Date("2026-06-27T12:02:00.000Z") }
          ),
        (error) =>
          error instanceof ReceiverShellBindingError &&
          error.status === 404 &&
          error.message === "Receiver binding not found."
      );
    });
  });

  it("blocks binding checks after the receiver device is revoked", async () => {
    await withClaimIndex(async (indexPath) => {
      const claim = await issueReceiverShellClaim(
        { setupCode: "12345" },
        { indexPath, now: new Date("2026-06-27T12:00:00.000Z") }
      );

      await redeemReceiverShellClaim(
        { claim: claim.claim, receiverInstallId: "install-1" },
        { indexPath, now: new Date("2026-06-27T12:01:00.000Z") }
      );

      const revoked = await revokeReceiverShellDevice(
        { receiverDeviceId: claim.receiverDeviceId },
        { indexPath, now: new Date("2026-06-27T12:02:00.000Z") }
      );
      assert.equal(revoked.receiverDeviceId, "local-dev-rob-gxv3370");
      assert.equal(revoked.storageSource, "local_file");

      await assert.rejects(
        () =>
          verifyReceiverShellBinding(
            {
              receiverDeviceId: claim.receiverDeviceId,
              receiverInstallId: "install-1",
            },
            { indexPath, now: new Date("2026-06-27T12:03:00.000Z") }
          ),
        (error) =>
          error instanceof ReceiverShellBindingError &&
          error.status === 404 &&
          error.message === "Receiver binding not found."
      );
    });
  });

  it("stores receiver mode and capability status reports on binding checks", async () => {
    await withClaimIndex(async (indexPath) => {
      const claim = await issueReceiverShellClaim(
        { setupCode: "12345" },
        { indexPath, now: new Date("2026-06-27T12:00:00.000Z") }
      );

      await redeemReceiverShellClaim(
        { claim: claim.claim, receiverInstallId: "install-1" },
        { indexPath, now: new Date("2026-06-27T12:01:00.000Z") }
      );

      const binding = await verifyReceiverShellBinding(
        {
          capabilityStatuses: {
            batteryOptimization: "supported",
            bootStart: "unknown",
            fullscreen: "enabled",
            keepAwake: "enabled",
            kiosk: "unavailable",
            microphone: "supported",
            updateChecks: "supported",
          },
          deviceOwner: false,
          lockTaskActive: false,
          lockTaskPermitted: false,
          nativeManufacturer: "Generic",
          nativeModel: "Resizable",
          nativeSdk: 35,
          nativeVersionCode: 1,
          nativeVersionName: "0.1.0",
          provisioningCompletedAtMs: Date.parse("2026-06-27T12:00:30.000Z"),
          receiverDeviceId: claim.receiverDeviceId,
          receiverInstallId: "install-1",
          receiverMode: "dedicated",
          shellVersion: "0.1.0",
        },
        { indexPath, now: new Date("2026-06-27T12:02:00.000Z") }
      );

      assert.equal(binding.receiverMode, "dedicated");
      assert.equal(binding.capabilityStatuses?.fullscreen, "enabled");
      assert.equal(binding.nativeModel, "Resizable");
      assert.equal(binding.provisioningCompletedAt, "2026-06-27T12:00:30.000Z");

      const nextBinding = await verifyReceiverShellBinding(
        {
          receiverDeviceId: claim.receiverDeviceId,
          receiverInstallId: "install-1",
        },
        { indexPath, now: new Date("2026-06-27T12:03:00.000Z") }
      );

      assert.equal(nextBinding.receiverMode, "dedicated");
      assert.equal(nextBinding.capabilityStatuses?.kiosk, "unavailable");
      assert.equal(nextBinding.nativeVersionName, "0.1.0");
    });
  });
});
