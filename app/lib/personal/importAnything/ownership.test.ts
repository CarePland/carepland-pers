import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  importAnythingOwnerFromFocus,
  importAnythingOwnerMismatch,
  importAnythingOwnerMismatchNotice,
} from "./ownership";

const everyone = "all";

describe("Import Anything ownership", () => {
  it("seeds the import owner from a specific global focus", () => {
    assert.equal(
      importAnythingOwnerFromFocus({
        allSubjectsValue: everyone,
        focusPersonId: "rob",
      }),
      "rob"
    );
  });

  it("keeps the import owner stable when global focus changes", () => {
    const ownerPersonId = importAnythingOwnerFromFocus({
      allSubjectsValue: everyone,
      focusPersonId: "rob",
    });

    assert.equal(ownerPersonId, "rob");
    assert.equal(
      importAnythingOwnerMismatch({
        allSubjectsValue: everyone,
        focusPersonId: "ellie",
        ownerPersonId,
      }),
      true
    );
  });

  it("builds a mismatch notice when global focus and import owner differ", () => {
    const notice = importAnythingOwnerMismatchNotice({
      allSubjectsValue: everyone,
      focusPerson: { displayName: "Ellie", id: "ellie" },
      focusPersonId: "ellie",
      ownerPerson: { displayName: "Rob Robson", id: "rob" },
      ownerPersonId: "rob",
    });

    assert.deepEqual(notice, {
      actionLabel: "Change import to Ellie",
      focusName: "Ellie",
      message: "Global focus is now Ellie. Import is for Rob Robson.",
      ownerName: "Rob Robson",
    });
  });

  it("supports explicitly changing the import owner to the focused person", () => {
    const ownerPersonId = importAnythingOwnerFromFocus({
      allSubjectsValue: everyone,
      currentOwnerPersonId: "rob",
      focusPersonId: "ellie",
    });

    assert.equal(ownerPersonId, "ellie");
  });

  it("does not create an invalid owner from Everyone focus", () => {
    assert.equal(
      importAnythingOwnerFromFocus({
        allSubjectsValue: everyone,
        focusPersonId: everyone,
      }),
      ""
    );
    assert.equal(
      importAnythingOwnerFromFocus({
        allSubjectsValue: everyone,
        currentOwnerPersonId: "rob",
        focusPersonId: everyone,
      }),
      "rob"
    );
  });
});
