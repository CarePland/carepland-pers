import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasAnyBoundReceiverDevice,
  normalizeReceiverDevices,
} from "./receiverProvisioningStatus";

describe("Connect provisioning Receiver status derivation", () => {
  it("reads receiverDevices off a snapshot", () => {
    assert.deepEqual(
      normalizeReceiverDevices({ receiverDevices: [{ status: "bound" }] }),
      [{ status: "bound" }]
    );
  });

  it("defaults to an empty array for a missing or malformed snapshot", () => {
    assert.deepEqual(normalizeReceiverDevices({}), []);
    assert.deepEqual(normalizeReceiverDevices(null), []);
    assert.deepEqual(normalizeReceiverDevices(undefined), []);
    assert.deepEqual(
      normalizeReceiverDevices({
        receiverDevices: "not-an-array" as unknown as undefined,
      }),
      []
    );
  });

  it("reports true only when at least one device is bound", () => {
    assert.equal(hasAnyBoundReceiverDevice([{ status: "bound" }]), true);
    assert.equal(
      hasAnyBoundReceiverDevice([
        { status: "setup_pending" },
        { status: "revoked" },
      ]),
      false
    );
    assert.equal(hasAnyBoundReceiverDevice([]), false);
  });
});
