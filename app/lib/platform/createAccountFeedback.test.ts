import assert from "node:assert/strict";
import test from "node:test";

import {
  beginCreateAccountFeedback,
  canSubmitCreateAccount,
  completeCreateAccountFeedback,
  createAccountProcessingText,
  createInitialAccountFeedbackState,
  failCreateAccountFeedback,
} from "./createAccountFeedback";

test("starts account creation with immediate processing feedback", () => {
  const result = beginCreateAccountFeedback(
    createInitialAccountFeedbackState(),
    " user@example.com "
  );

  assert.equal(result.accepted, true);
  assert.deepEqual(result.state, {
    email: "user@example.com",
    status: "processing",
  });
  assert.equal(canSubmitCreateAccount(result.state), false);
  assert.equal(createAccountProcessingText, "Creating your account...");
});

test("prevents duplicate account creation submissions while processing", () => {
  const first = beginCreateAccountFeedback(
    createInitialAccountFeedbackState(),
    "user@example.com"
  );
  const second = beginCreateAccountFeedback(
    first.state,
    "other@example.com"
  );

  assert.equal(second.accepted, false);
  assert.equal(second.state, first.state);
});

test("moves directly from processing to success confirmation", () => {
  const started = beginCreateAccountFeedback(
    createInitialAccountFeedbackState(),
    "user@example.com"
  );
  const finished = completeCreateAccountFeedback(started.state);

  assert.deepEqual(finished, {
    email: "user@example.com",
    status: "success",
  });
});

test("keeps submitted email available after account creation failure", () => {
  const started = beginCreateAccountFeedback(
    createInitialAccountFeedbackState(),
    "user@example.com"
  );
  const failed = failCreateAccountFeedback(
    started.state,
    "CarePland could not create the account. Please try again."
  );

  assert.deepEqual(failed, {
    email: "user@example.com",
    errorMessage: "CarePland could not create the account. Please try again.",
    status: "error",
  });
  assert.equal(canSubmitCreateAccount(failed), true);
});
