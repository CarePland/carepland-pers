import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  issueReceiverShellClaim,
  redeemReceiverShellClaim,
  revokeReceiverShellDevice,
} from "../receiverShell/claimStore";

import {
  readConnectPersonScopedAccess,
  readReceiverDeviceScopedAccess,
  receiverDeviceIdHeader,
  receiverInstallIdHeader,
  ReceiverDeviceAccessError,
} from "./server/personScopedAccess";
import { verifyConnectAudioPersonAccess } from "../audio/server/audioAccess";
import { verifyConnectMessagePersonAccess } from "../messaging/server/messageAccess";

async function withClaimIndex<T>(run: (indexPath: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(tmpdir(), "receiver-access-"));
  try {
    return await run(path.join(dir, "claims.json"));
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

async function createBoundReceiver(indexPath: string) {
  const claim = await issueReceiverShellClaim(
    {
      careCircleId: "care-circle-1",
      mainConnectUserPersonId: "person-rob",
      setupCode: "12345",
    },
    { indexPath, now: new Date("2026-07-04T12:00:00.000Z") }
  );
  const redeemed = await redeemReceiverShellClaim(
    {
      claim: claim.claim,
      receiverInstallId: "install-1",
    },
    { indexPath, now: new Date("2026-07-04T12:01:00.000Z") }
  );

  return {
    receiverDeviceId: redeemed.receiverDeviceId,
    receiverInstallId: "install-1",
  };
}

function receiverRequest(receiverDeviceId: string, receiverInstallId: string) {
  return new Request("http://localhost/api/test", {
    headers: {
      [receiverDeviceIdHeader]: receiverDeviceId,
      [receiverInstallIdHeader]: receiverInstallId,
    },
  });
}

describe("person-scoped receiver access", () => {
  it("allows a bound Receiver to access its bound person", async () => {
    await withClaimIndex(async (indexPath) => {
      const receiver = await createBoundReceiver(indexPath);

      const access = await readConnectPersonScopedAccess(
        receiverRequest(receiver.receiverDeviceId, receiver.receiverInstallId),
        "person-rob",
        {
          createReceiverClient: () => ({ kind: "receiver-client" }) as never,
          receiverIndexPath: indexPath,
        }
      );

      assert.equal(access.accessType, "receiver_device");
      assert.equal(access.careCircleId, "care-circle-1");
      assert.equal(access.mainConnectUserPersonId, "person-rob");
      assert.equal(access.receiverDeviceId, receiver.receiverDeviceId);
      assert.equal(access.receiverInstallId, receiver.receiverInstallId);
    });
  });

  it("rejects a bound Receiver that asks for another person", async () => {
    await withClaimIndex(async (indexPath) => {
      const receiver = await createBoundReceiver(indexPath);

      await assert.rejects(
        () =>
          readConnectPersonScopedAccess(
            receiverRequest(receiver.receiverDeviceId, receiver.receiverInstallId),
            "person-someone-else",
            {
              createReceiverClient: () => ({ kind: "receiver-client" }) as never,
              receiverIndexPath: indexPath,
            }
          ),
        (error) =>
          error instanceof ReceiverDeviceAccessError &&
          error.status === 403 &&
          error.code === "receiver_person_mismatch"
      );
    });
  });

  it("rejects a revoked Receiver binding as setup required", async () => {
    await withClaimIndex(async (indexPath) => {
      const receiver = await createBoundReceiver(indexPath);
      await revokeReceiverShellDevice(
        { receiverDeviceId: receiver.receiverDeviceId },
        { indexPath, now: new Date("2026-07-04T12:02:00.000Z") }
      );

      await assert.rejects(
        () =>
          readConnectPersonScopedAccess(
            receiverRequest(receiver.receiverDeviceId, receiver.receiverInstallId),
            "person-rob",
            {
              createReceiverClient: () => ({ kind: "receiver-client" }) as never,
              receiverIndexPath: indexPath,
            }
          ),
        (error) =>
          error instanceof ReceiverDeviceAccessError &&
          error.status === 401 &&
          error.code === "receiver_setup_required"
      );
    });
  });

  it("keeps the dashboard user auth path when no Receiver credentials are sent", async () => {
    let verifiedPersonId = "";
    const access = await readConnectPersonScopedAccess(
      new Request("http://localhost/api/test"),
      "person-rob",
      {
        createUserClient: () => ({ kind: "user-client" }) as never,
        verifyUserAccess: async (personId) => {
          verifiedPersonId = personId;
          return {
            accessToken: "user-token",
            careCircleId: "care-circle-1",
            mainConnectUserPersonId: "person-rob",
            userContext: {
              accessToken: "user-token",
              session: null,
              userId: "user-1",
            },
          };
        },
      }
    );

    assert.equal(verifiedPersonId, "person-rob");
    assert.equal(access.accessType, "user");
    assert.equal(access.accessToken, "user-token");
    assert.equal(access.createdByUserId, "user-1");
  });

  it("lets message access use the same bound Receiver proof", async () => {
    await withClaimIndex(async (indexPath) => {
      const receiver = await createBoundReceiver(indexPath);

      const denied = await verifyConnectMessagePersonAccess(
        "person-rob",
        receiverRequest(receiver.receiverDeviceId, receiver.receiverInstallId),
        {},
        {
          createReceiverClient: () => ({ kind: "receiver-client" }) as never,
          receiverIndexPath: indexPath,
        }
      );

      assert.equal(denied, null);
    });
  });

  it("rejects message access for another person from a bound Receiver", async () => {
    await withClaimIndex(async (indexPath) => {
      const receiver = await createBoundReceiver(indexPath);

      const denied = await verifyConnectMessagePersonAccess(
        "person-someone-else",
        receiverRequest(receiver.receiverDeviceId, receiver.receiverInstallId),
        {},
        {
          createReceiverClient: () => ({ kind: "receiver-client" }) as never,
          receiverIndexPath: indexPath,
        }
      );
      const payload = (await denied?.json()) as {
        error?: string;
        receiverSetupRequired?: boolean;
      };

      assert.equal(denied?.status, 403);
      assert.equal(payload.receiverSetupRequired, false);
      assert.equal(payload.error, "This Receiver is not approved for that person.");
    });
  });

  it("lets audio access use the same bound Receiver proof", async () => {
    await withClaimIndex(async (indexPath) => {
      const receiver = await createBoundReceiver(indexPath);

      const denied = await verifyConnectAudioPersonAccess(
        "person-rob",
        receiverRequest(receiver.receiverDeviceId, receiver.receiverInstallId),
        {},
        {
          createReceiverClient: () => ({ kind: "receiver-client" }) as never,
          receiverIndexPath: indexPath,
        }
      );

      assert.equal(denied, null);
    });
  });

  it("verifies device-scoped Receiver telemetry without a requested person", async () => {
    await withClaimIndex(async (indexPath) => {
      const receiver = await createBoundReceiver(indexPath);

      const binding = await readReceiverDeviceScopedAccess(
        receiverRequest(receiver.receiverDeviceId, receiver.receiverInstallId),
        { receiverIndexPath: indexPath }
      );

      assert.equal(binding.receiverDeviceId, receiver.receiverDeviceId);
      assert.equal(binding.receiverInstallId, receiver.receiverInstallId);
      assert.equal(binding.mainConnectUserPersonId, "person-rob");
    });
  });
});
