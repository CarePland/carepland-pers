import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { personHasAttachedReceiver } from "../receiverAttachment";

describe("Connect message Receiver attachment eligibility", () => {
  it("allows messaging when a person has an attached Receiver", () => {
    assert.equal(
      personHasAttachedReceiver(
        [
          {
            mainConnectUserPersonId: "person-bob",
            status: "bound",
          },
        ],
        "person-bob"
      ),
      true
    );
  });

  it("does not count revoked or differently focused Receivers", () => {
    assert.equal(
      personHasAttachedReceiver(
        [
          {
            mainConnectUserPersonId: "person-bob",
            status: "revoked",
          },
          {
            mainConnectUserPersonId: "person-alice",
            status: "bound",
          },
        ],
        "person-bob"
      ),
      false
    );
  });

  it("treats a paired pending Receiver as attached for inbox continuity", () => {
    assert.equal(
      personHasAttachedReceiver(
        [
          {
            mainConnectUserPersonId: "person-bob",
            pairedAt: "2026-07-17T12:00:00.000Z",
            status: "setup_pending",
          },
        ],
        "person-bob"
      ),
      true
    );
  });
});
