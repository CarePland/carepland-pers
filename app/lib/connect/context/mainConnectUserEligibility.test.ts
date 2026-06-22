import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isConnectPetSubjectType,
  isEligibleMainConnectUserPerson,
} from "./mainConnectUserEligibility";

describe("Main Connect User eligibility", () => {
  it("allows active non-pet Pers people", () => {
    assert.equal(
      isEligibleMainConnectUserPerson({
        id: "person-bob",
        isActive: true,
        subjectType: "other",
      }),
      true
    );
  });

  it("rejects inactive Pers people", () => {
    assert.equal(
      isEligibleMainConnectUserPerson({
        id: "person-bob",
        isActive: false,
        subjectType: "other",
      }),
      false
    );
  });

  it("rejects pet Care VIPs as Main Connect Users", () => {
    for (const subjectType of ["cat", "dog", "pet", "pet:rabbit"]) {
      assert.equal(
        isEligibleMainConnectUserPerson({
          id: "pet-vip",
          isActive: true,
          subjectType,
        }),
        false
      );
    }
  });

  it("detects pet subject types case-insensitively", () => {
    assert.equal(isConnectPetSubjectType(" Dog "), true);
    assert.equal(isConnectPetSubjectType("other"), false);
  });
});
