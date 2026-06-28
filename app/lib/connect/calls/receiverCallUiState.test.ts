import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  receiverCallRecordStateIsActive,
  receiverCallUiStateFromRecordState,
} from "./receiverCallUiState";

describe("receiver call UI state", () => {
  it("maps app call records to receiver-friendly call states", () => {
    assert.equal(receiverCallUiStateFromRecordState(undefined), "idle");
    assert.equal(receiverCallUiStateFromRecordState("ringing"), "incoming");
    assert.equal(receiverCallUiStateFromRecordState("answered"), "connecting");
    assert.equal(receiverCallUiStateFromRecordState("connected"), "connected");
    assert.equal(receiverCallUiStateFromRecordState("hung_up"), "ended");
    assert.equal(receiverCallUiStateFromRecordState("receiver_unavailable"), "failed");
  });

  it("treats only incoming through connected records as active", () => {
    assert.equal(receiverCallRecordStateIsActive("ringing"), true);
    assert.equal(receiverCallRecordStateIsActive("answered"), true);
    assert.equal(receiverCallRecordStateIsActive("connected"), true);
    assert.equal(receiverCallRecordStateIsActive("declined"), false);
    assert.equal(receiverCallRecordStateIsActive("failed"), false);
    assert.equal(receiverCallRecordStateIsActive(""), false);
  });
});
