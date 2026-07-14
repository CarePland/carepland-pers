import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  createAdvisoryPlatformReviewAnalysis,
  deriveInteractionReviewQueue,
  readLocalInteractionAttempts,
  recordLocalInteractionAttemptEvent,
  recordLocalInteractionAttemptObservation,
  recordLocalPlatformReview,
  recordLocalPlatformReviewAnalysis,
  startLocalInteractionAttempt,
} from "./interactionAttempts";
import { createObservation } from "./observationPipeline";

async function withAttemptStore<T>(run: (indexPath: string) => Promise<T>) {
  const directory = await mkdtemp(path.join(tmpdir(), "carepland-attempts-"));
  const indexPath = path.join(directory, "attempts.json");
  try {
    return await run(indexPath);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

function observation(id: string, text: string, observedAt: string) {
  const value = createObservation({
    modality: "typed",
    observedAt,
    personId: "person-1",
    source: "receiver",
    surface: "ask_tell",
    text,
  });
  return {
    ...value,
    observationId: id,
  };
}

describe("Interaction Attempts", () => {
  it("starts an append-only diagnostic parent for a user effort", async () => {
    await withAttemptStore(async (indexPath) => {
      const attempt = await startLocalInteractionAttempt(
        {
          activeWorkflow: "ask_tell",
          careCircleId: "care-circle-1",
          careSubjectId: "person-1",
          receiverDeviceId: "receiver-1",
          surface: "receiver_ask_tell",
        },
        { indexPath, now: new Date("2026-07-10T21:14:22.000Z") }
      );

      const store = await readLocalInteractionAttempts({ indexPath });

      assert.equal(attempt.status, "in_progress");
      assert.equal(store.attempts.length, 1);
      assert.equal(store.events.length, 1);
      assert.equal(store.events[0].eventType, "attempt_started");
      assert.equal(store.events[0].attemptId, attempt.id);
    });
  });

  it("keeps each rephrase as a new immutable Observation in one Attempt", async () => {
    await withAttemptStore(async (indexPath) => {
      const attempt = await startLocalInteractionAttempt(
        {
          activeWorkflow: "ask_tell",
          careCircleId: "care-circle-1",
          careSubjectId: "person-1",
          surface: "receiver_ask_tell",
        },
        { indexPath }
      );
      const first = observation(
        "observation-1",
        "What did the doctor say about my leg?",
        "2026-07-10T21:14:22.000Z"
      );
      const second = observation(
        "observation-2",
        "What did Dr. Smith say about my knee?",
        "2026-07-10T21:14:41.000Z"
      );
      const third = observation(
        "observation-3",
        "What did the visit note say about my knee?",
        "2026-07-10T21:14:58.000Z"
      );

      await recordLocalInteractionAttemptObservation(
        {
          attemptId: attempt.id,
          observation: first,
          revisionIndex: 0,
          revisionReason: "initial",
        },
        { indexPath }
      );
      await recordLocalInteractionAttemptObservation(
        {
          attemptId: attempt.id,
          observation: second,
          parentObservationId: first.observationId,
          revisionIndex: 1,
          revisionReason: "rephrase",
        },
        { indexPath }
      );
      await recordLocalInteractionAttemptObservation(
        {
          attemptId: attempt.id,
          observation: third,
          parentObservationId: second.observationId,
          revisionIndex: 2,
          revisionReason: "rephrase",
        },
        { indexPath }
      );

      const store = await readLocalInteractionAttempts({ indexPath });
      const attemptAfterRevisions = store.attempts.find((item) => item.id === attempt.id);

      assert.equal(attemptAfterRevisions?.revisionCount, 3);
      assert.equal(attemptAfterRevisions?.latestObservationId, "observation-3");
      assert.deepEqual(
        store.observations.map((item) => item.observationId),
        ["observation-1", "observation-2", "observation-3"]
      );
      assert.deepEqual(
        store.observations.map((item) => item.parentObservationId),
        ["", "observation-1", "observation-2"]
      );
      assert.deepEqual(
        store.observations.map((item) => item.revisionReason),
        ["initial", "rephrase", "rephrase"]
      );
    });
  });

  it("does not overwrite the original Observation snapshot when a revision arrives", async () => {
    await withAttemptStore(async (indexPath) => {
      const attempt = await startLocalInteractionAttempt(
        { careCircleId: "care-circle-1", careSubjectId: "person-1" },
        { indexPath }
      );
      const first = observation("observation-1", "I need milk.", "2026-07-10T21:14:22.000Z");
      const revised = observation(
        "observation-2",
        "I need lactose-free milk.",
        "2026-07-10T21:14:35.000Z"
      );

      await recordLocalInteractionAttemptObservation(
        {
          attemptId: attempt.id,
          observation: first,
          revisionIndex: 0,
          revisionReason: "initial",
        },
        { indexPath }
      );
      first.rawText = "mutated after write";
      await recordLocalInteractionAttemptObservation(
        {
          attemptId: attempt.id,
          observation: revised,
          parentObservationId: "observation-1",
          revisionIndex: 1,
          revisionReason: "rephrase",
        },
        { indexPath }
      );

      const store = await readLocalInteractionAttempts({ indexPath });

      assert.equal(store.observations[0].observationSnapshot.rawText, "I need milk.");
      assert.equal(
        store.observations[1].observationSnapshot.rawText,
        "I need lactose-free milk."
      );
    });
  });

  it("captures response, recovery, and completion events in order", async () => {
    await withAttemptStore(async (indexPath) => {
      const attempt = await startLocalInteractionAttempt(
        { careCircleId: "care-circle-1", careSubjectId: "person-1" },
        { indexPath, now: new Date("2026-07-10T21:14:22.000Z") }
      );

      await recordLocalInteractionAttemptEvent(
        {
          actorRole: "system",
          attemptId: attempt.id,
          eventType: "response_presented",
          observationId: "observation-1",
          payload: { family: "ask", interpreter: "ReceiverAskInterpreter" },
        },
        { indexPath, now: new Date("2026-07-10T21:14:24.000Z") }
      );
      await recordLocalInteractionAttemptEvent(
        {
          actorRole: "receiver_user",
          attemptId: attempt.id,
          eventType: "not_helpful_selected",
          observationId: "observation-1",
        },
        { indexPath, now: new Date("2026-07-10T21:14:31.000Z") }
      );
      await recordLocalInteractionAttemptEvent(
        {
          actorRole: "receiver_user",
          attemptId: attempt.id,
          eventType: "rephrase_selected",
          observationId: "observation-1",
        },
        { indexPath, now: new Date("2026-07-10T21:14:33.000Z") }
      );
      await recordLocalInteractionAttemptEvent(
        {
          actorRole: "receiver_user",
          attemptId: attempt.id,
          eventType: "workflow_completed",
          observationId: "observation-2",
          payload: { outcome: "communicated", recipient: "Andrew" },
        },
        { indexPath, now: new Date("2026-07-10T21:15:00.000Z") }
      );

      const store = await readLocalInteractionAttempts({ indexPath });
      const attemptAfterCompletion = store.attempts.find((item) => item.id === attempt.id);

      assert.deepEqual(
        store.events.map((event) => event.eventType),
        [
          "attempt_started",
          "response_presented",
          "not_helpful_selected",
          "rephrase_selected",
          "workflow_completed",
        ]
      );
      assert.equal(attemptAfterCompletion?.status, "completed");
      assert.equal(attemptAfterCompletion?.outcome, "communicated");
      assert.equal(attemptAfterCompletion?.completedAt, "2026-07-10T21:15:00.000Z");
    });
  });

  it("records cancellation as a terminal diagnostic outcome", async () => {
    await withAttemptStore(async (indexPath) => {
      const attempt = await startLocalInteractionAttempt(
        { careCircleId: "care-circle-1", careSubjectId: "person-1" },
        { indexPath }
      );

      await recordLocalInteractionAttemptEvent(
        {
          actorRole: "receiver_user",
          attemptId: attempt.id,
          eventType: "cancelled",
        },
        { indexPath, now: new Date("2026-07-10T21:15:00.000Z") }
      );

      const store = await readLocalInteractionAttempts({ indexPath });
      const cancelled = store.attempts.find((item) => item.id === attempt.id);

      assert.equal(cancelled?.status, "cancelled");
      assert.equal(cancelled?.outcome, "cancelled");
      assert.equal(cancelled?.completedAt, "2026-07-10T21:15:00.000Z");
    });
  });

  it("keeps a human Platform Review separate from the Attempt event log", async () => {
    await withAttemptStore(async (indexPath) => {
      const attempt = await startLocalInteractionAttempt(
        { careCircleId: "care-circle-1", careSubjectId: "person-1" },
        { indexPath, now: new Date("2026-07-10T21:14:22.000Z") }
      );

      const review = await recordLocalPlatformReview(
        {
          attemptId: attempt.id,
          comment: "This probably should have classified as Communicate instead of Ask.",
          reviewerUserId: "admin-1",
        },
        { indexPath, now: new Date("2026-07-10T21:16:00.000Z") }
      );

      const store = await readLocalInteractionAttempts({ indexPath });

      assert.equal(review.attemptId, attempt.id);
      assert.equal(review.reviewerUserId, "admin-1");
      assert.equal(store.reviews.length, 1);
      assert.equal(store.reviews[0].comment, "This probably should have classified as Communicate instead of Ask.");
      assert.deepEqual(
        store.events.map((event) => event.eventType),
        ["attempt_started"]
      );
    });
  });

  it("stores advisory Platform Review analysis without rewriting the human review", async () => {
    await withAttemptStore(async (indexPath) => {
      const attempt = await startLocalInteractionAttempt(
        { careCircleId: "care-circle-1", careSubjectId: "person-1" },
        { indexPath }
      );
      const review = await recordLocalPlatformReview(
        {
          attemptId: attempt.id,
          comment: "The typo should not have forced recovery.",
          reviewerUserId: "admin-1",
        },
        { indexPath, now: new Date("2026-07-10T21:16:00.000Z") }
      );
      const advisory = createAdvisoryPlatformReviewAnalysis(review);

      await recordLocalPlatformReviewAnalysis(advisory, {
        indexPath,
        now: new Date("2026-07-10T21:16:30.000Z"),
      });

      const store = await readLocalInteractionAttempts({ indexPath });

      assert.equal(store.reviews[0].comment, "The typo should not have forced recovery.");
      assert.equal(store.reviewAnalyses.length, 1);
      assert.equal(store.reviewAnalyses[0].reviewId, review.id);
      assert.equal(store.reviewAnalyses[0].attemptId, attempt.id);
      assert.equal(store.reviewAnalyses[0].metadata.productionBehaviorUnaffected, true);
      assert.ok(
        store.reviewAnalyses[0].affectedPlatformLayers.includes(
          "MeaningFrame normalization"
        )
      );
    });
  });

  it("derives the read-only Interaction Review Queue from attempt history", async () => {
    await withAttemptStore(async (indexPath) => {
      const cleanAttempt = await startLocalInteractionAttempt(
        {
          careCircleId: "care-circle-1",
          careSubjectId: "person-clean",
          surface: "receiver_ask_tell",
        },
        { indexPath, now: new Date("2026-07-10T21:10:00.000Z") }
      );
      await recordLocalInteractionAttemptObservation(
        {
          attemptId: cleanAttempt.id,
          observation: observation(
            "observation-clean",
            "When is my appointment?",
            "2026-07-10T21:10:01.000Z"
          ),
          revisionIndex: 0,
          revisionReason: "initial",
        },
        { indexPath }
      );
      await recordLocalInteractionAttemptEvent(
        {
          attemptId: cleanAttempt.id,
          eventType: "response_presented",
          observationId: "observation-clean",
          payload: { family: "ask", result: "answer" },
        },
        { indexPath }
      );

      const revisionAttempt = await startLocalInteractionAttempt(
        {
          careCircleId: "care-circle-1",
          careSubjectId: "person-1",
          surface: "receiver_ask_tell",
        },
        { indexPath, now: new Date("2026-07-10T21:14:22.000Z") }
      );
      await recordLocalInteractionAttemptObservation(
        {
          attemptId: revisionAttempt.id,
          observation: observation(
            "observation-1",
            "talk to andrew about my kee",
            "2026-07-10T21:14:22.000Z"
          ),
          revisionIndex: 0,
          revisionReason: "initial",
        },
        { indexPath }
      );
      await recordLocalInteractionAttemptEvent(
        {
          attemptId: revisionAttempt.id,
          eventType: "response_presented",
          observationId: "observation-1",
          payload: { family: "ask", result: "answer" },
        },
        { indexPath }
      );
      await recordLocalInteractionAttemptEvent(
        {
          attemptId: revisionAttempt.id,
          eventType: "not_helpful_selected",
          observationId: "observation-1",
        },
        { indexPath }
      );
      await recordLocalInteractionAttemptObservation(
        {
          attemptId: revisionAttempt.id,
          observation: observation(
            "observation-2",
            "tell Andrew my knee hurts",
            "2026-07-10T21:14:42.000Z"
          ),
          parentObservationId: "observation-1",
          revisionIndex: 1,
          revisionReason: "rephrase",
        },
        { indexPath }
      );
      await recordLocalInteractionAttemptEvent(
        {
          attemptId: revisionAttempt.id,
          eventType: "response_presented",
          observationId: "observation-2",
          payload: { family: "communicate", result: "message" },
        },
        { indexPath }
      );

      const capabilityAttempt = await startLocalInteractionAttempt(
        {
          careCircleId: "care-circle-1",
          careSubjectId: "person-2",
          surface: "receiver_ask_tell",
        },
        { indexPath, now: new Date("2026-07-10T21:20:00.000Z") }
      );
      await recordLocalInteractionAttemptObservation(
        {
          attemptId: capabilityAttempt.id,
          observation: observation(
            "observation-capability",
            "I went for a walk.",
            "2026-07-10T21:20:01.000Z"
          ),
          revisionIndex: 0,
          revisionReason: "initial",
        },
        { indexPath }
      );
      await recordLocalInteractionAttemptEvent(
        {
          attemptId: capabilityAttempt.id,
          eventType: "response_presented",
          observationId: "observation-capability",
          payload: {
            answer: "Saving exercise entries is not available in this preview yet.",
            family: "observe",
            result: "capability_missing",
          },
        },
        { indexPath }
      );
      await recordLocalInteractionAttemptEvent(
        {
          attemptId: capabilityAttempt.id,
          eventType: "timed_out",
          observationId: "observation-capability",
        },
        { indexPath, now: new Date("2026-07-10T21:21:00.000Z") }
      );
      const review = await recordLocalPlatformReview(
        {
          attemptId: capabilityAttempt.id,
          comment: "Missing capability rather than incorrect interpretation.",
          reviewerUserId: "admin-1",
        },
        { indexPath }
      );
      await recordLocalPlatformReviewAnalysis(
        createAdvisoryPlatformReviewAnalysis(review),
        { indexPath }
      );

      const store = await readLocalInteractionAttempts({ indexPath });
      const queue = deriveInteractionReviewQueue(store, {
        careSubjectNamesById: {
          "person-1": "Rob",
          "person-2": "Andrew",
        },
      });

      assert.equal(
        queue.some((item) => item.attemptId === cleanAttempt.id),
        false
      );

      const revisionRow = queue.find((item) => item.attemptId === revisionAttempt.id);
      assert.ok(revisionRow);
      assert.equal(revisionRow.careSubjectDisplayName, "Rob");
      assert.equal(revisionRow.originalUserWording, "talk to andrew about my kee");
      assert.equal(revisionRow.finalUserWording, "tell Andrew my knee hurts");
      assert.equal(revisionRow.revisionCount, 2);
      assert.deepEqual(revisionRow.familyEvolution, ["ask", "communicate"]);
      assert.equal(revisionRow.familyChanged, true);
      assert.equal(revisionRow.reviewState, "unreviewed");
      assert.ok(revisionRow.includeReasons.includes("not_helpful_selected"));
      assert.ok(revisionRow.includeReasons.includes("revised_observation"));

      const capabilityRow = queue.find(
        (item) => item.attemptId === capabilityAttempt.id
      );
      assert.ok(capabilityRow);
      assert.equal(capabilityRow.careSubjectDisplayName, "Andrew");
      assert.equal(capabilityRow.capabilityMissing, true);
      assert.equal(capabilityRow.status, "timed_out");
      assert.equal(capabilityRow.reviewState, "analyzed");
      assert.equal(capabilityRow.reviewCount, 1);
      assert.equal(capabilityRow.reviewAnalysisCount, 1);
      assert.ok(capabilityRow.includeReasons.includes("capability_missing"));
      assert.ok(capabilityRow.includeReasons.includes("abandoned_or_timed_out"));
      assert.ok(capabilityRow.includeReasons.includes("platform_review"));
    });
  });
});
