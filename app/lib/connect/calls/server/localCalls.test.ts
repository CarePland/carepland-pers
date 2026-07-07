import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  approveLocalConnectCallSummary,
  cleanupExpiredLocalConnectCallTranscripts,
  markStaleLocalConnectCallsMissed,
  readLocalConnectCalls,
  recordLocalConnectCall,
  recordLocalConnectCallTranscriptSegment,
  saveLocalConnectCallSummaryDraft,
  updateLocalConnectCallSummary,
  updateLocalConnectCallState,
} from "./localCalls";

async function withTempCallIndex<T>(callback: (indexPath: string) => Promise<T>) {
  const dir = await mkdtemp(path.join(tmpdir(), "connect-local-calls-"));
  try {
    return await callback(path.join(dir, "calls.json"));
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

describe("local Connect calls", () => {
  it("records app-native calls for the selected Main Connect User", async () => {
    await withTempCallIndex(async (indexPath) => {
      const call = await recordLocalConnectCall(
        {
          callerName: "Andrew",
          mainConnectUserPersonId: "person-bob",
          recipientName: "Bob",
          receiverId: "living-room-receiver",
        },
        { indexPath }
      );
      const index = await readLocalConnectCalls({ indexPath });

      assert.ok(call.callId?.startsWith("connect-call-"));
      assert.equal(call.state, "ringing");
      assert.equal(call.mainConnectUserPersonId, "person-bob");
      assert.equal(call.recipientPersonId, "person-bob");
      assert.equal(index.calls.length, 1);
    });
  });

  it("can retire only one person's still-ringing calls before a new call starts", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "bob-ringing",
          mainConnectUserPersonId: "person-bob",
          state: "ringing",
          updatedAt: "2026-06-21T12:01:00.000Z",
        },
        { indexPath }
      );
      await recordLocalConnectCall(
        {
          callId: "alice-ringing",
          mainConnectUserPersonId: "person-alice",
          state: "ringing",
          updatedAt: "2026-06-21T12:01:00.000Z",
        },
        { indexPath }
      );

      const changed = await markStaleLocalConnectCallsMissed({
        indexPath,
        mainConnectUserPersonId: "person-bob",
        now: new Date("2026-06-21T12:01:00.000Z"),
        ringingTimeoutMs: 0,
      });
      const index = await readLocalConnectCalls({ indexPath });

      assert.equal(changed, 1);
      assert.equal(
        index.calls.find((call) => call.callId === "bob-ringing")?.state,
        "missed"
      );
      assert.equal(
        index.calls.find((call) => call.callId === "alice-ringing")?.state,
        "ringing"
      );
    });
  });

  it("updates allowed call state transitions", async () => {
    await withTempCallIndex(async (indexPath) => {
      const call = await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "ringing",
        },
        { indexPath }
      );
      const answered = await updateLocalConnectCallState(call.callId ?? "", "answered", {
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });
      const connected = await updateLocalConnectCallState(call.callId ?? "", "connected", {
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });

      assert.equal(answered?.state, "answered");
      assert.equal(connected?.state, "connected");
    });
  });

  it("does not update another person's call", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "ringing",
        },
        { indexPath }
      );
      const updated = await updateLocalConnectCallState("call-1", "answered", {
        indexPath,
        mainConnectUserPersonId: "person-alice",
      });
      const index = await readLocalConnectCalls({ indexPath });

      assert.equal(updated, null);
      assert.equal(index.calls[0]?.state, "ringing");
    });
  });

  it("leaves terminal calls unchanged", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "declined",
        },
        { indexPath }
      );
      const updated = await updateLocalConnectCallState("call-1", "connected", {
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });
      const index = await readLocalConnectCalls({ indexPath });

      assert.equal(updated?.state, "declined");
      assert.equal(index.calls[0]?.state, "declined");
    });
  });

  it("marks stale ringing calls missed", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "old-ringing",
          mainConnectUserPersonId: "person-bob",
          state: "ringing",
          updatedAt: "2026-06-21T12:00:00.000Z",
        },
        { indexPath }
      );
      await recordLocalConnectCall(
        {
          callId: "fresh-ringing",
          mainConnectUserPersonId: "person-bob",
          state: "ringing",
          updatedAt: "2026-06-21T12:00:55.000Z",
        },
        { indexPath }
      );
      await recordLocalConnectCall(
        {
          callId: "connected",
          mainConnectUserPersonId: "person-bob",
          state: "connected",
          updatedAt: "2026-06-21T12:00:00.000Z",
        },
        { indexPath }
      );

      const changed = await markStaleLocalConnectCallsMissed({
        indexPath,
        now: new Date("2026-06-21T12:01:00.000Z"),
        ringingTimeoutMs: 45_000,
      });
      const index = await readLocalConnectCalls({ indexPath });

      assert.equal(changed, 1);
      assert.equal(
        index.calls.find((call) => call.callId === "old-ringing")?.state,
        "missed"
      );
      assert.equal(
        index.calls.find((call) => call.callId === "fresh-ringing")?.state,
        "ringing"
      );
      assert.equal(
        index.calls.find((call) => call.callId === "connected")?.state,
        "connected"
      );
    });
  });

  it("approves summaries by deleting temporary transcript text", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "hung_up",
          summaryStatus: "pending_review",
          summaryText: "Medication was discussed.",
          transcriptSegments: [
            {
              chunkEndedMs: 35_000,
              chunkIndex: 0,
              chunkStartedMs: 0,
              overlapStartedMs: 30_000,
              transcriptStatus: "completed",
              transcriptText: "Long raw transcript that should not remain after approval.",
            },
          ],
          transcriptStatus: "ready_for_summary",
          transcriptText: "Long raw transcript that should not remain after approval.",
        },
        { indexPath }
      );

      const approved = await approveLocalConnectCallSummary("call-1", {
        approvedBy: "receiver",
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });
      const index = await readLocalConnectCalls({ indexPath });
      const storedCall = index.calls[0];

      assert.equal(approved?.summaryStatus, "approved");
      assert.equal(approved?.summaryText, "Medication was discussed.");
      assert.equal(approved?.modelSummaryText, "Medication was discussed.");
      assert.equal(approved?.approvedSummaryText, "Medication was discussed.");
      assert.equal(approved?.transcriptText, undefined);
      assert.equal(approved?.transcriptSegments, undefined);
      assert.equal(approved?.transcriptCleanupStatus, "completed");
      assert.equal(approved?.transcriptStatus, "deleted");
      assert.equal(storedCall?.summaryStatus, "approved");
      assert.equal(storedCall?.summaryText, "Medication was discussed.");
      assert.equal(storedCall?.modelSummaryText, "Medication was discussed.");
      assert.equal(storedCall?.approvedSummaryText, "Medication was discussed.");
      assert.equal(storedCall?.transcriptText, undefined);
      assert.equal(storedCall?.transcriptSegments, undefined);
      assert.equal(storedCall?.transcriptCleanupStatus, "completed");
      assert.equal(storedCall?.transcriptStatus, "deleted");
      assert.ok(storedCall?.transcriptDeletedAt);
    });
  });

  it("keeps generated and user-approved local summaries separate", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "hung_up",
          summaryStatus: "pending_review",
          summaryText: "Model summary.",
          transcriptStatus: "ready_for_summary",
          transcriptText: "Temporary transcript.",
        },
        { indexPath }
      );

      const approved = await approveLocalConnectCallSummary("call-1", {
        approvedBy: "receiver",
        approvedSummaryText: "Edited approved summary.",
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });

      assert.equal(approved?.summaryText, "Edited approved summary.");
      assert.equal(approved?.approvedSummaryText, "Edited approved summary.");
      assert.equal(approved?.modelSummaryText, "Model summary.");
      assert.equal(approved?.generatedSummaryText, "Model summary.");
      assert.equal(approved?.transcriptText, undefined);
    });
  });

  it("approves no-care-summary calls while deleting temporary transcript text", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "hung_up",
          summaryStatus: "not_needed",
          summaryText: "",
          transcriptStatus: "ready_for_summary",
          transcriptText: "TV dialogue and general conversation.",
        },
        { indexPath }
      );

      const approved = await approveLocalConnectCallSummary("call-1", {
        approvedBy: "receiver",
        approvedSummaryText: "",
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });
      const index = await readLocalConnectCalls({ indexPath });
      const storedCall = index.calls[0];

      assert.equal(approved?.summaryStatus, "approved");
      assert.equal(approved?.summaryText, "");
      assert.equal(approved?.approvedSummaryText, "");
      assert.equal(approved?.modelSummaryText, "");
      assert.equal(approved?.transcriptText, undefined);
      assert.equal(approved?.transcriptCleanupStatus, "completed");
      assert.equal(approved?.transcriptStatus, "deleted");
      assert.equal(storedCall?.summaryStatus, "approved");
      assert.equal(storedCall?.summaryText, "");
      assert.equal(storedCall?.approvedSummaryText, "");
      assert.equal(storedCall?.transcriptText, undefined);
      assert.ok(storedCall?.transcriptDeletedAt);
    });
  });

  it("stores generated summaries as pending review with a transcript expiration", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          modelSummaryText: "Older model summary.",
          state: "hung_up",
          summaryStatus: "failed",
          summaryText: "",
        },
        { indexPath }
      );

      const updated = await updateLocalConnectCallSummary(
        "call-1",
        {
          mainConnectUserPersonId: "person-bob",
          summaryStatus: "completed",
          summaryText: "Updated model summary.",
        },
        { indexPath }
      );

      assert.equal(updated?.summaryStatus, "pending_review");
      assert.equal(updated?.summaryText, "Updated model summary.");
      assert.equal(updated?.modelSummaryText, "Updated model summary.");
      assert.equal(updated?.generatedSummaryText, "Updated model summary.");
      assert.equal(updated?.summaryApprovalDraftText, "Updated model summary.");
      assert.ok(updated?.transcriptExpiresAt);
    });
  });

  it("persists approval drafts and uses the draft on approval", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          generatedSummaryText: "Generated summary.",
          mainConnectUserPersonId: "person-bob",
          modelSummaryText: "Generated summary.",
          state: "hung_up",
          summaryStatus: "pending_review",
          summaryText: "Generated summary.",
          transcriptText: "Temporary transcript.",
        },
        { indexPath }
      );

      const draft = await saveLocalConnectCallSummaryDraft(
        "call-1",
        {
          draftText: "Reviewer edited summary.",
          mainConnectUserPersonId: "person-bob",
          updatedBy: "receiver",
        },
        { indexPath }
      );
      const approved = await approveLocalConnectCallSummary("call-1", {
        approvedBy: "receiver",
        indexPath,
        mainConnectUserPersonId: "person-bob",
      });

      assert.equal(draft?.summaryApprovalDraftText, "Reviewer edited summary.");
      assert.equal(approved?.approvedSummaryText, "Reviewer edited summary.");
      assert.equal(approved?.summaryText, "Reviewer edited summary.");
      assert.equal(approved?.generatedSummaryText, "Generated summary.");
      assert.equal(approved?.transcriptText, undefined);
    });
  });

  it("returns updated call context after storing a transcript segment", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "hung_up",
          summaryStatus: "pending_review",
          summaryText: "Earlier summary.",
        },
        { indexPath }
      );

      const stored = await recordLocalConnectCallTranscriptSegment(
        {
          callId: "call-1",
          chunkEndedMs: 35_000,
          chunkIndex: 0,
          chunkStartedMs: 0,
          mainConnectUserPersonId: "person-bob",
          overlapStartedMs: 30_000,
          transcriptStatus: "completed",
          transcriptText: "Medication list is on the PillPack box.",
        },
        { indexPath }
      );

      assert.equal(
        stored?.assembledTranscriptText,
        "Medication list is on the PillPack box."
      );
      assert.equal(stored?.call?.state, "hung_up");
      assert.equal(stored?.call?.summaryStatus, "pending_review");
      assert.equal(
        stored?.call?.transcriptText,
        "Medication list is on the PillPack box."
      );
      assert.equal(stored?.call?.transcriptSegments?.length, 1);
      assert.equal(stored?.call?.transcriptSegments?.[0]?.chunkIndex, 0);
    });
  });

  it("assembles local transcript chunks from stored segment history", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          state: "hung_up",
          summaryStatus: "pending_review",
          summaryText: "Earlier summary.",
        },
        { indexPath }
      );

      await recordLocalConnectCallTranscriptSegment(
        {
          callId: "call-1",
          chunkEndedMs: 65_000,
          chunkIndex: 1,
          chunkStartedMs: 30_000,
          mainConnectUserPersonId: "person-bob",
          overlapStartedMs: 60_000,
          transcriptStatus: "completed",
          transcriptText: "Bring the medication list to cardiology.",
        },
        { indexPath }
      );

      const stored = await recordLocalConnectCallTranscriptSegment(
        {
          callId: "call-1",
          chunkEndedMs: 35_000,
          chunkIndex: 0,
          chunkStartedMs: 0,
          mainConnectUserPersonId: "person-bob",
          overlapStartedMs: 30_000,
          transcriptStatus: "completed",
          transcriptText: "The pill pack box has the medication list.",
        },
        { indexPath }
      );

      assert.equal(
        stored?.assembledTranscriptText,
        "The pill pack box has the medication list. Bring the medication list to cardiology."
      );
      assert.equal(stored?.call?.transcriptSegments?.length, 2);
      assert.deepEqual(
        stored?.call?.transcriptSegments?.map((segment) => segment.chunkIndex),
        [0, 1]
      );
    });
  });

  it("does not replace the local model summary baseline when regeneration fails", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          mainConnectUserPersonId: "person-bob",
          modelSummaryText: "Last successful model summary.",
          state: "hung_up",
          summaryStatus: "pending_review",
          summaryText: "Last successful model summary.",
        },
        { indexPath }
      );

      const updated = await updateLocalConnectCallSummary(
        "call-1",
        {
          mainConnectUserPersonId: "person-bob",
          summaryStatus: "failed",
          summaryText: "",
        },
        { indexPath }
      );

      assert.equal(updated?.summaryStatus, "summary_failed");
      assert.equal(updated?.summaryText, "");
      assert.equal(updated?.modelSummaryText, "Last successful model summary.");
    });
  });

  it("expires unreviewed summaries by deleting transcript text but retaining generated summary", async () => {
    await withTempCallIndex(async (indexPath) => {
      await recordLocalConnectCall(
        {
          callId: "call-1",
          generatedSummaryText: "Generated but not approved.",
          mainConnectUserPersonId: "person-bob",
          modelSummaryText: "Generated but not approved.",
          state: "hung_up",
          summaryStatus: "pending_review",
          summaryText: "Generated but not approved.",
          transcriptExpiresAt: "2026-07-02T12:00:00.000Z",
          transcriptSegments: [
            {
              chunkEndedMs: 35_000,
              chunkIndex: 0,
              chunkStartedMs: 0,
              overlapStartedMs: 30_000,
              transcriptStatus: "completed",
              transcriptText: "Temporary transcript.",
            },
          ],
          transcriptText: "Temporary transcript.",
        },
        { indexPath }
      );

      const changed = await cleanupExpiredLocalConnectCallTranscripts({
        indexPath,
        mainConnectUserPersonId: "person-bob",
        now: new Date("2026-07-03T12:00:00.000Z"),
      });
      const index = await readLocalConnectCalls({ indexPath });
      const storedCall = index.calls[0];

      assert.equal(changed, 1);
      assert.equal(storedCall?.summaryStatus, "expired_unreviewed");
      assert.equal(storedCall?.generatedSummaryText, "Generated but not approved.");
      assert.equal(
        storedCall?.summaryReviewNote,
        "Transcript expired before formal approval. Generated summary retained as unapproved."
      );
      assert.equal(storedCall?.transcriptText, undefined);
      assert.equal(storedCall?.transcriptSegments, undefined);
      assert.equal(storedCall?.transcriptStatus, "deleted");
      assert.equal(storedCall?.transcriptCleanupStatus, "completed");
    });
  });
});
