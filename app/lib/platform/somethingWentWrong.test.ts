import assert from "node:assert/strict";
import test from "node:test";

import { interpretSomethingWentWrong } from "./somethingWentWrong";

test("classifies how-to questions without treating them as defects", () => {
  const result = interpretSomethingWentWrong({
    currentRoute: "/connect/dashboard",
    inputText: "How do I send a message?",
    networkOnline: true,
  });

  assert.equal(result.decisionTrace.selectedInteractionFamily, "how_to");
  assert.equal(result.outcome.kind, "explain");
});

test("routes stuck message sending toward troubleshooting", () => {
  const result = interpretSomethingWentWrong({
    currentRoute: "/connect/dashboard",
    hasFailedApiCalls: true,
    inputText: "I clicked Send and it stayed spinning.",
    networkOnline: true,
  });

  assert.equal(result.decisionTrace.selectedInteractionFamily, "unexpected_behavior");
  assert.equal(result.decisionTrace.selectedWorkflow, "failed_message_delivery");
  assert.equal(result.outcome.kind, "troubleshooting");
});

test("offers confirmation for clear navigation requests", () => {
  const result = interpretSomethingWentWrong({
    currentRoute: "/",
    inputText: "Take me to appointments.",
    networkOnline: true,
  });

  assert.equal(result.decisionTrace.selectedInteractionFamily, "navigation");
  assert.equal(result.outcome.kind, "navigate");
  assert.equal("actionUrl" in result.outcome ? result.outcome.actionUrl : "", "/?personal=1&appointments=1&view=upcoming");
});
