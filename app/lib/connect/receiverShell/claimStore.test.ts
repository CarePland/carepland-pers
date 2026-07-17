import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  createReceiverShellPairingSession,
  createReceiverShellSetupClaim,
  deleteExpiredUnpairedReceiverShellDevices,
  deleteUnpairedReceiverShellDevice,
  formatReceiverPairingCode,
  getReceiverShellPairingSession,
  issueReceiverShellClaim,
  normalizeReceiverPairingCode,
  pairReceiverShellPairingCode,
  ReceiverShellClaimError,
  redeemReceiverShellClaim,
  ReceiverShellBindingError,
  revokeReceiverShellDevice,
  updateReceiverShellDeviceLabel,
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
  it("formats and parses receiver pairing codes", () => {
    assert.equal(normalizeReceiverPairingCode("123456"), "123456");
    assert.equal(normalizeReceiverPairingCode("123 456"), "123456");
    assert.equal(normalizeReceiverPairingCode("123-456"), "123456");
    assert.equal(formatReceiverPairingCode("123456"), "123 456");
  });

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

  it("updates a receiver label without changing its binding", async () => {
    await withClaimIndex(async (indexPath) => {
      const claim = await issueReceiverShellClaim(
        {
          receiverUrl: "http://10.0.2.2:3002/connect/receiver",
          setupCode: "12345",
        },
        { indexPath, now: new Date("2026-06-27T12:00:00.000Z") }
      );
      const redeemed = await redeemReceiverShellClaim(
        {
          claim: claim.claim,
          receiverInstallId: "install-1",
        },
        { indexPath, now: new Date("2026-06-27T12:01:00.000Z") }
      );

      const updated = await updateReceiverShellDeviceLabel(
        {
          locationLabel: "Living Rm",
          receiverDeviceId: redeemed.receiverDeviceId,
        },
        { indexPath, now: new Date("2026-06-27T12:02:00.000Z") }
      );

      assert.equal(updated.locationLabel, "Living Rm");
      assert.equal(updated.receiverDeviceId, "local-dev-rob-gxv3370");

      const binding = await verifyReceiverShellBinding(
        {
          receiverDeviceId: redeemed.receiverDeviceId,
          receiverInstallId: "install-1",
        },
        { indexPath, now: new Date("2026-06-27T12:03:00.000Z") }
      );

      assert.equal(binding.locationLabel, "Living Rm");
      assert.equal(binding.receiverInstallId, "install-1");
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

  it("exchanges a generated setup code for the native app claim", async () => {
    await withClaimIndex(async (indexPath) => {
      const setupClaim = await createReceiverShellSetupClaim(
        {
          careCircleId: "care-circle-1",
          mainConnectUserPersonId: "person-rob",
          receiverDeviceId: "receiver-living-room",
          setupCode: "kind-maple-home",
        },
        { indexPath, now: new Date("2026-06-27T12:00:00.000Z") }
      );

      assert.equal(setupClaim.setupCode, "kind-maple-home");
      assert.equal(setupClaim.receiverDeviceId, "receiver-living-room");

      const claim = await issueReceiverShellClaim(
        {
          receiverUrl: "https://example.com/connect/receiver",
          setupCode: "Kind Maple Home",
        },
        { indexPath, now: new Date("2026-06-27T12:01:00.000Z") }
      );

      assert.equal(claim.claim, setupClaim.claim);
      assert.equal(claim.receiverUrl, "https://example.com/connect/receiver");
      assert.equal(claim.mainConnectUserPersonId, "person-rob");
    });
  });

  it("pairs a pending receiver code for the selected person", async () => {
    await withClaimIndex(async (indexPath) => {
      const session = await createReceiverShellPairingSession(
        {
          receiverDeviceId: "receiver-demo",
          receiverUrl: "https://receiver.carepland.com/connect/receiver",
        },
        { indexPath, now: new Date("2026-06-27T12:00:00.000Z") }
      );

      assert.match(session.pairingCode, /^\d{3} \d{3}$/);

      const pending = await getReceiverShellPairingSession(
        {
          pairingCode: session.pairingCode,
          receiverDeviceId: "receiver-demo",
        },
        { indexPath, now: new Date("2026-06-27T12:01:00.000Z") }
      );
      assert.equal(pending.status, "pending");
      assert.equal(pending.claim, undefined);

      const paired = await pairReceiverShellPairingCode(
        {
          careCircleId: "care-circle-1",
          mainConnectUserDisplayName: "Rob",
          mainConnectUserPersonId: "person-rob",
          pairingCode: session.pairingCode.replace(" ", "-"),
          receiverUrl: "https://receiver.carepland.com/connect/receiver",
        },
        { indexPath, now: new Date("2026-06-27T12:02:00.000Z") }
      );

      assert.equal(paired.receiverDeviceId, "receiver-demo");
      assert.equal(paired.mainConnectUserPersonId, "person-rob");
      assert.equal(paired.careCircleId, "care-circle-1");
      assert.equal(paired.locationLabel, "Rob's Receiver DEMO");

      const ready = await getReceiverShellPairingSession(
        {
          pairingCode: session.pairingCode,
          receiverDeviceId: "receiver-demo",
        },
        { indexPath, now: new Date("2026-06-27T12:03:00.000Z") }
      );
      assert.equal(ready.status, "paired");
      assert.equal(ready.claim, paired.claim);

      const redeemed = await redeemReceiverShellClaim(
        { claim: paired.claim, receiverInstallId: "install-demo" },
        { indexPath, now: new Date("2026-06-27T12:04:00.000Z") }
      );

      assert.equal(redeemed.mainConnectUserPersonId, "person-rob");
      assert.equal(redeemed.careCircleId, "care-circle-1");
    });
  });

  it("rejects expired receiver pairing codes", async () => {
    await withClaimIndex(async (indexPath) => {
      const session = await createReceiverShellPairingSession(
        { receiverDeviceId: "receiver-expired" },
        {
          indexPath,
          now: new Date("2026-06-27T12:00:00.000Z"),
          ttlMs: 60_000,
        }
      );

      await assert.rejects(
        () =>
          pairReceiverShellPairingCode(
            {
              mainConnectUserPersonId: "person-rob",
              pairingCode: session.pairingCode,
            },
            { indexPath, now: new Date("2026-06-27T12:02:00.000Z") }
          ),
        (error) =>
          error instanceof ReceiverShellClaimError &&
          error.status === 410 &&
          error.message === "Receiver pairing code expired."
      );
    });
  });

  it("rejects already-used receiver pairing codes", async () => {
    await withClaimIndex(async (indexPath) => {
      const session = await createReceiverShellPairingSession(
        { receiverDeviceId: "receiver-used" },
        { indexPath, now: new Date("2026-06-27T12:00:00.000Z") }
      );
      const paired = await pairReceiverShellPairingCode(
        {
          mainConnectUserPersonId: "person-rob",
          pairingCode: session.pairingCode,
        },
        { indexPath, now: new Date("2026-06-27T12:01:00.000Z") }
      );
      await redeemReceiverShellClaim(
        { claim: paired.claim, receiverInstallId: "install-1" },
        { indexPath, now: new Date("2026-06-27T12:02:00.000Z") }
      );

      await assert.rejects(
        () =>
          pairReceiverShellPairingCode(
            {
              mainConnectUserPersonId: "person-rob",
              pairingCode: session.pairingCode,
            },
            { indexPath, now: new Date("2026-06-27T12:03:00.000Z") }
          ),
        (error) =>
          error instanceof ReceiverShellClaimError &&
          error.status === 409 &&
          error.message === "Receiver has already been paired."
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

  it("deletes only unpaired receiver setup placeholders", async () => {
    await withClaimIndex(async (indexPath) => {
      const placeholder = await createReceiverShellSetupClaim(
        { receiverDeviceId: "receiver-placeholder" },
        { indexPath, now: new Date("2026-06-27T12:00:00.000Z") }
      );

      const deleted = await deleteUnpairedReceiverShellDevice(
        { receiverDeviceId: placeholder.receiverDeviceId },
        { indexPath, now: new Date("2026-06-27T12:01:00.000Z") }
      );
      assert.equal(deleted.receiverDeviceId, "receiver-placeholder");
      assert.equal(deleted.storageSource, "local_file");

      await assert.rejects(
        () =>
          deleteUnpairedReceiverShellDevice(
            { receiverDeviceId: placeholder.receiverDeviceId },
            { indexPath, now: new Date("2026-06-27T12:02:00.000Z") }
          ),
        (error) =>
          error instanceof ReceiverShellBindingError &&
          error.status === 404 &&
          error.message === "Receiver device not found."
      );

      const paired = await createReceiverShellSetupClaim(
        { receiverDeviceId: "receiver-paired" },
        { indexPath, now: new Date("2026-06-27T12:03:00.000Z") }
      );
      await pairReceiverShellPairingCode(
        {
          careCircleId: "care-circle-1",
          mainConnectUserPersonId: "person-1",
          pairingCode: paired.setupCode,
        },
        { indexPath, now: new Date("2026-06-27T12:04:00.000Z") }
      );

      await assert.rejects(
        () =>
          deleteUnpairedReceiverShellDevice(
            { receiverDeviceId: paired.receiverDeviceId },
            { indexPath, now: new Date("2026-06-27T12:05:00.000Z") }
          ),
        (error) =>
          error instanceof ReceiverShellBindingError &&
          error.status === 409 &&
          error.message === "Only unpaired setup Receivers can be deleted."
      );
    });
  });

  it("expires unpaired receiver setup placeholders after thirty minutes", async () => {
    await withClaimIndex(async (indexPath) => {
      const expired = await createReceiverShellSetupClaim(
        { receiverDeviceId: "receiver-expired-placeholder" },
        { indexPath, now: new Date("2026-06-27T12:00:00.000Z") }
      );
      const fresh = await createReceiverShellSetupClaim(
        { receiverDeviceId: "receiver-fresh-placeholder" },
        { indexPath, now: new Date("2026-06-27T12:20:00.000Z") }
      );

      await deleteExpiredUnpairedReceiverShellDevices({
        indexPath,
        now: new Date("2026-06-27T12:31:00.000Z"),
      });

      await assert.rejects(
        () =>
          deleteUnpairedReceiverShellDevice(
            { receiverDeviceId: expired.receiverDeviceId },
            { indexPath, now: new Date("2026-06-27T12:32:00.000Z") }
          ),
        (error) =>
          error instanceof ReceiverShellBindingError &&
          error.status === 404 &&
          error.message === "Receiver device not found."
      );

      const deletedFresh = await deleteUnpairedReceiverShellDevice(
        { receiverDeviceId: fresh.receiverDeviceId },
        { indexPath, now: new Date("2026-06-27T12:33:00.000Z") }
      );
      assert.equal(deletedFresh.receiverDeviceId, "receiver-fresh-placeholder");
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
