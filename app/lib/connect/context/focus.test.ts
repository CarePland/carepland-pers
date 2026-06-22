import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allCarePlandFocusValue } from "../../platform/focus";
import { resolveActiveConnectPersonId } from "./focus";

describe("Connect focus resolution", () => {
  it("uses a specific global focus as the active Main Connect User", () => {
    assert.equal(
      resolveActiveConnectPersonId({
        connectTargetPersonId: "person-local",
        globalFocusId: "person-global",
        savedMainConnectUserPersonId: "person-saved",
      }),
      "person-global"
    );
  });

  it("keeps Everyone global while using a temporary Connect-local person", () => {
    assert.equal(
      resolveActiveConnectPersonId({
        connectTargetPersonId: "person-local",
        globalFocusId: allCarePlandFocusValue,
        savedMainConnectUserPersonId: "person-saved",
      }),
      "person-local"
    );
  });

  it("falls back to the durable Main Connect User when Everyone has no local target", () => {
    assert.equal(
      resolveActiveConnectPersonId({
        connectTargetPersonId: "",
        globalFocusId: allCarePlandFocusValue,
        savedMainConnectUserPersonId: "person-saved",
      }),
      "person-saved"
    );
  });

  it("returns no active person when no Connect context exists", () => {
    assert.equal(
      resolveActiveConnectPersonId({
        connectTargetPersonId: "",
        globalFocusId: allCarePlandFocusValue,
        savedMainConnectUserPersonId: "",
      }),
      ""
    );
  });

  it("falls back to a default Pers person when Everyone has no Connect context", () => {
    assert.equal(
      resolveActiveConnectPersonId({
        connectTargetPersonId: "",
        fallbackPersonId: "person-default",
        globalFocusId: allCarePlandFocusValue,
        savedMainConnectUserPersonId: "",
      }),
      "person-default"
    );
  });
});
