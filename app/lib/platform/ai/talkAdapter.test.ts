import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { interpretTalkInput } from "../../personal/track/talkIntent";
import {
  talkDecisionTraceToPlatformTrace,
  talkIntentResultToPlatformIntent,
} from "./talkAdapter";

describe("Talk platform adapter", () => {
  it("maps a high-confidence Talk activity to platform IntentResult", () => {
    const talk = interpretTalkInput({
      careCircleId: "care-circle-1",
      careSubjectId: "person-1",
      inputText: "I walked to the mailbox.",
      now: new Date("2026-07-04T12:00:00.000Z"),
      receiverDeviceId: "receiver-1",
    });
    const platformIntent = talkIntentResultToPlatformIntent(talk);

    assert.equal(talk.decisionTrace.primary_intent, "track_event_activity");
    assert.equal(platformIntent.intent, "track_event_activity");
    assert.equal(platformIntent.proposedAction, "create_track_event");
    assert.equal(platformIntent.needsReview, false);
    assert.equal(platformIntent.decisionTrace.layer, "intent_router");
    assert.equal(platformIntent.decisionTrace.execution?.policy, "write_allowed");
    assert.equal(platformIntent.decisionTrace.execution?.status, "queued");
    assert.deepEqual(platformIntent.decisionTrace.matchedRules, [
      "talk.activity.walking.v1",
    ]);
    assert.equal(platformIntent.decisionTrace.context?.activePersonId, "person-1");
    assert.equal(platformIntent.decisionTrace.context?.receiverDeviceId, "receiver-1");
    assert.ok(
      platformIntent.candidateIntents?.some(
        (candidate) => candidate.kind === "unknown"
      )
    );
    assert.equal(platformIntent.structuredPayload?.title, "Walked to mailbox");
  });

  it("maps review-required Talk output without changing persisted trace shape", () => {
    const talk = interpretTalkInput({
      careCircleId: "care-circle-1",
      careSubjectId: "person-1",
      inputText: "I feel dizzy today.",
      now: new Date("2026-07-04T12:00:00.000Z"),
    });
    const platformIntent = talkIntentResultToPlatformIntent(talk);

    assert.equal(talk.decisionTrace.requires_review, true);
    assert.equal(talk.decisionTrace.write_policy, "review_required");
    assert.ok("primary_intent" in talk.decisionTrace);
    assert.ok("matched_rules" in talk.decisionTrace);
    assert.equal(platformIntent.needsReview, true);
    assert.equal(platformIntent.decisionTrace.humanReview?.required, true);
    assert.equal(platformIntent.decisionTrace.execution?.policy, "review_required");
    assert.equal(platformIntent.decisionTrace.execution?.status, "not_started");
    assert.equal(platformIntent.decisionTrace.outputSummary, "create_track_event");
  });

  it("can map the existing Talk Decision Trace directly", () => {
    const talk = interpretTalkInput({
      careCircleId: "care-circle-1",
      careSubjectId: "person-1",
      inputText: "Call Andrew.",
      contacts: [{ displayName: "Andrew", id: "contact-andrew" }],
      now: new Date("2026-07-04T12:00:00.000Z"),
    });
    const trace = talkDecisionTraceToPlatformTrace(talk.decisionTrace);

    assert.equal(trace.confidence, talk.decisionTrace.confidence);
    assert.equal(trace.layer, "intent_router");
    assert.equal(trace.outputSummary, "request_call");
    assert.deepEqual(trace.context?.availableContactIds, ["contact-andrew"]);
    assert.equal(trace.entitiesDetected?.contact_id, "contact-andrew");
  });
});
