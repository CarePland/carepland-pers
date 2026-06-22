import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  shouldListConnectPeopleFromParticipants,
  uniqueConnectParticipantPersonIds,
} from "./connectParticipantFiltering";

describe("Connect participant filtering", () => {
  it("deduplicates explicit participant person ids", () => {
    assert.deepEqual(
      uniqueConnectParticipantPersonIds([
        { person_id: "person-bob" },
        { person_id: " person-bob " },
        { person_id: "person-alice" },
        { person_id: "" },
        { person_id: null },
      ]),
      ["person-bob", "person-alice"]
    );
  });

  it("does not list Connect people without explicit participant ids", () => {
    assert.equal(shouldListConnectPeopleFromParticipants([]), false);
  });

  it("lists Connect people only when participant ids are present", () => {
    assert.equal(
      shouldListConnectPeopleFromParticipants(["person-bob"]),
      true
    );
  });
});
