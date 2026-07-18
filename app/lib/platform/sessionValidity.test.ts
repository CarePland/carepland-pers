import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifySessionLoss,
  createSessionValidityStore,
  reportSessionLossFromResponse,
  sessionValidityStore,
} from "./sessionValidity";

describe("session validity", () => {
  it("classifies explicit authentication rejection as session loss", () => {
    assert.equal(classifySessionLoss({ status: 401 }), true);
    assert.equal(
      classifySessionLoss({ message: "expired refresh token" }),
      true
    );
    assert.equal(
      classifySessionLoss({ message: "revoked session" }),
      true
    );
  });

  it("keeps temporary network failures distinct from session loss", () => {
    assert.equal(classifySessionLoss({ message: "Failed to fetch" }), false);
    assert.equal(classifySessionLoss({ message: "DNS lookup failed" }), false);
    assert.equal(classifySessionLoss({ message: "request timeout" }), false);
    assert.equal(classifySessionLoss({ status: 503 }), false);
  });

  it("keeps offline access expiration distinct from session loss", () => {
    const store = createSessionValidityStore();

    store.markOfflineAccessExpired("main", "Offline access expired.");

    assert.equal(store.getSnapshot().state, "offline_access_expired");
    assert.equal(store.getSnapshot().surface, "main");
    assert.equal(store.getSnapshot().reason, "Offline access expired.");
  });

  it("suppresses duplicate session-lost recovery flows", () => {
    const store = createSessionValidityStore();

    assert.equal(store.reportSessionLost("main", "first"), true);
    assert.equal(store.reportSessionLost("receiver", "second"), false);

    const snapshot = store.getSnapshot();
    assert.equal(snapshot.state, "session_lost");
    assert.equal(snapshot.surface, "main");
    assert.equal(snapshot.reason, "first");
    assert.equal(snapshot.duplicateLossCount, 1);
  });

  it("restores authenticated state after successful reauthentication", () => {
    const store = createSessionValidityStore();

    store.reportSessionLost("main", "expired", "/appointments");
    store.markReauthenticating("main");
    store.markAuthenticated();

    assert.deepEqual(store.getSnapshot(), {
      duplicateLossCount: 0,
      reason: "",
      returnTo: "",
      state: "authenticated",
      surface: "shared",
    });
  });

  it("does not downgrade terminal session loss to temporary offline", () => {
    const store = createSessionValidityStore();

    store.reportSessionLost("receiver", "expired");
    store.markTemporarilyOffline("receiver", "network unavailable");

    assert.equal(store.getSnapshot().state, "session_lost");
    assert.equal(store.getSnapshot().reason, "expired");
  });

  it("reports only one global session loss from concurrent 401 responses", () => {
    sessionValidityStore.markAuthenticated();

    const response = { status: 401 } as Response;

    assert.equal(
      reportSessionLossFromResponse(response, {
        reason: "first",
        surface: "main",
      }),
      true
    );
    assert.equal(
      reportSessionLossFromResponse(response, {
        reason: "second",
        surface: "receiver",
      }),
      false
    );

    const snapshot = sessionValidityStore.getSnapshot();
    assert.equal(snapshot.state, "session_lost");
    assert.equal(snapshot.surface, "main");
    assert.equal(snapshot.reason, "first");
    assert.equal(snapshot.duplicateLossCount, 1);

    sessionValidityStore.markAuthenticated();
  });
});
