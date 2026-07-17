import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ConnectMainUserContext, ConnectPersPerson } from "../context";
import {
  browserReceiverPairingCodeReady,
  browserReceiverShouldRequestPairing,
  formatBrowserReceiverPairingCode,
  normalizeBrowserReceiverPairingCode,
  resolveBrowserReceiverPairingPerson,
} from "./browserPairing";

const rob = {
  careCircleId: "care-circle-1",
  displayName: "Rob",
  id: "person-rob",
  isActive: true,
  isDefault: false,
  subjectType: "person",
} satisfies ConnectPersPerson;

function context(mainConnectUserPersonId: string | null): ConnectMainUserContext {
  return {
    mainConnectUserPerson: mainConnectUserPersonId ? rob : null,
    mainConnectUserPersonId,
    people: [rob],
    source: mainConnectUserPersonId ? "supabase" : "unset",
  };
}

describe("browser Receiver pairing helpers", () => {
  it("formats and parses six-digit Receiver pairing codes for browser entry", () => {
    assert.equal(normalizeBrowserReceiverPairingCode("123456"), "123456");
    assert.equal(normalizeBrowserReceiverPairingCode("123 456"), "123456");
    assert.equal(normalizeBrowserReceiverPairingCode("123-456"), "123456");
    assert.equal(normalizeBrowserReceiverPairingCode("123 456 789"), "123456");
    assert.equal(formatBrowserReceiverPairingCode("123456"), "123 456");
    assert.equal(browserReceiverPairingCodeReady("12345"), false);
    assert.equal(browserReceiverPairingCodeReady("123 456"), true);
  });

  it("pairs through the current browser Connect active person when no explicit person is sent", () => {
    const resolved = resolveBrowserReceiverPairingPerson(context("person-rob"));

    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.equal(resolved.personId, "person-rob");
      assert.equal(resolved.person.displayName, "Rob");
    }
  });

  it("reports missing active-person context before browser Receiver pairing", () => {
    const resolved = resolveBrowserReceiverPairingPerson(context(null));

    assert.deepEqual(resolved, {
      error: "Choose a Main Connect User before pairing this Receiver.",
      ok: false,
      status: 400,
    });
  });

  it("does not request a pairing code while a stored Receiver identity is being checked", () => {
    assert.equal(
      browserReceiverShouldRequestPairing({
        hasReceiverIdentity: true,
        receiverRegistered: false,
        receiverSessionRestored: true,
        selectedReceiverUserId: "",
        started: true,
      }),
      false
    );
    assert.equal(
      browserReceiverShouldRequestPairing({
        bindingCheckPending: true,
        receiverRegistered: false,
        receiverSessionRestored: true,
        selectedReceiverUserId: "",
        started: true,
      }),
      false
    );
  });

  it("requests pairing only for an active unpaired Receiver session", () => {
    assert.equal(
      browserReceiverShouldRequestPairing({
        receiverRegistered: false,
        receiverSessionRestored: true,
        selectedReceiverUserId: "",
        started: true,
      }),
      true
    );
    assert.equal(
      browserReceiverShouldRequestPairing({
        receiverRegistered: true,
        receiverSessionRestored: true,
        selectedReceiverUserId: "",
        started: true,
      }),
      false
    );
  });
});
