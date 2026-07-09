import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveConnectMessageState } from "./messageState";

describe("Connect message state resolution", () => {
  it("accepts explicit state payloads", () => {
    assert.equal(resolveConnectMessageState({ state: "acknowledged" }), "acknowledged");
    assert.equal(
      resolveConnectMessageState({ state: "callback_requested" }),
      "callback_requested"
    );
    assert.equal(resolveConnectMessageState({ state: "heard" }), "heard");
    assert.equal(resolveConnectMessageState({ state: "read" }), "read");
  });

  it("accepts receiver boolean state payloads", () => {
    assert.equal(
      resolveConnectMessageState({ acknowledged: true }),
      "acknowledged"
    );
    assert.equal(
      resolveConnectMessageState({ callbackRequested: true }),
      "callback_requested"
    );
    assert.equal(resolveConnectMessageState({ heard: true }), "heard");
    assert.equal(resolveConnectMessageState({ read: true }), "read");
  });
});
