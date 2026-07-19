import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminPriorities,
  buildAdminPrioritySummary,
  checkpointBacklogPriorityCandidate,
  filterAdminPriorities,
  groupedRepeatedFailures,
  helpReportPriorityCandidate,
  sortAdminPriorities,
  type AdminPriorityCandidate,
} from "./priorities";

const now = new Date("2026-07-18T12:00:00.000Z");

test("groups repeated Receiver Talk failures into one priority", () => {
  const priorities = groupedRepeatedFailures({
    destination: "/admin?tab=connect",
    failures: [
      { id: "a", occurredAt: "2026-07-18T11:00:00.000Z", receiverId: "receiver-1" },
      { id: "b", occurredAt: "2026-07-18T11:06:00.000Z", receiverId: "receiver-1" },
      { id: "c", occurredAt: "2026-07-18T11:18:00.000Z", receiverId: "receiver-1" },
      { id: "d", occurredAt: "2026-07-18T11:19:00.000Z", receiverId: "receiver-2" },
    ],
    groupKey: (failure) => failure.receiverId ?? "unknown",
    sourceType: "interaction_failure",
    title: "Receiver Talk failed repeatedly",
  });

  assert.equal(priorities.length, 1);
  assert.equal(priorities[0].occurrenceCount, 3);
  assert.deepEqual(priorities[0].sourceRecordIds, ["a", "b", "c"]);
  assert.match(priorities[0].reason, /3 failed attempts/);
});

test("does not keep isolated or recovered failures as active priorities", () => {
  const priorities = groupedRepeatedFailures({
    destination: "/admin?tab=connect",
    failures: [
      { id: "a", occurredAt: "2026-07-18T11:00:00.000Z", receiverId: "receiver-1" },
      { id: "b", occurredAt: "2026-07-18T11:06:00.000Z", receiverId: "receiver-1" },
      { id: "c", occurredAt: "2026-07-18T11:18:00.000Z", receiverId: "receiver-1" },
      {
        id: "d",
        occurredAt: "2026-07-18T11:20:00.000Z",
        receiverId: "receiver-1",
        succeeded: true,
      },
    ],
    groupKey: (failure) => failure.receiverId ?? "unknown",
    sourceType: "interaction_failure",
    title: "Receiver Talk failed repeatedly",
  });

  assert.equal(priorities.length, 0);
});

test("keeps a submitted Help report open until an administrator reviews it", () => {
  const candidate = helpReportPriorityCandidate({
    featureArea: "Appointments",
    id: "help-1",
    referenceId: "HELP-20260718-A4K9",
    severity: "low",
    status: "new",
    submittedAt: "2026-07-18T10:30:00.000Z",
    submittedByUserId: "user-1",
    userLabel: "Jane D.",
  });

  assert.ok(candidate);
  const priorities = buildAdminPriorities({ candidates: [candidate], now });
  assert.equal(priorities[0].status, "open");
  assert.equal(priorities[0].category, "needs_attention");
  assert.equal(priorities[0].recommendedAction?.label, "Open report");
});

test("turns a Checkpoint backlog into one review priority", () => {
  const candidate = checkpointBacklogPriorityCandidate([
    { createdAt: "2026-07-15T09:00:00.000Z", id: "run-1" },
    { createdAt: "2026-07-16T09:00:00.000Z", id: "run-2" },
    { createdAt: "2026-07-17T09:00:00.000Z", id: "run-3" },
  ]);

  assert.ok(candidate);
  assert.equal(candidate.category, "review");
  assert.equal(candidate.occurrenceCount, 3);
  assert.deepEqual(candidate.sourceRecordIds, ["run-1", "run-2", "run-3"]);
});

test("defers active priorities and returns them after defer-until time", () => {
  const candidate = baseCandidate();

  const deferred = buildAdminPriorities({
    candidates: [candidate],
    now,
    states: [
      {
        deferredUntil: "2026-07-18T13:00:00.000Z",
        incidentKey: candidate.incidentKey,
        status: "deferred",
      },
    ],
  });

  assert.equal(deferred[0].status, "deferred");
  assert.equal(filterAdminPriorities(deferred, "active").length, 0);

  const returned = buildAdminPriorities({
    candidates: [candidate],
    now: new Date("2026-07-18T13:01:00.000Z"),
    states: [
      {
        deferredUntil: "2026-07-18T13:00:00.000Z",
        incidentKey: candidate.incidentKey,
        status: "deferred",
      },
    ],
  });

  assert.equal(returned[0].status, "open");
});

test("dismissed incidents stay hidden until a new incident key is produced", () => {
  const candidate = baseCandidate();
  const priorities = buildAdminPriorities({
    candidates: [candidate],
    now,
    states: [{ incidentKey: candidate.incidentKey, status: "dismissed" }],
  });

  assert.equal(priorities.length, 0);

  const newIncident = { ...candidate, incidentKey: "interaction_failure:receiver-1:later" };
  const reopened = buildAdminPriorities({
    candidates: [newIncident],
    now,
    states: [{ incidentKey: candidate.incidentKey, status: "dismissed" }],
  });

  assert.equal(reopened.length, 1);
});

test("summary, filtering, and sorting favor active severe work", () => {
  const low = baseCandidate({ incidentKey: "low", severity: "low" });
  const high = baseCandidate({ incidentKey: "high", severity: "high" });
  const review = baseCandidate({
    category: "review",
    incidentKey: "review",
    severity: "medium",
  });
  const priorities = buildAdminPriorities({
    candidates: [low, high, review],
    now,
    states: [{ incidentKey: low.incidentKey, status: "resolved" }],
  });

  const summary = buildAdminPrioritySummary(priorities);
  assert.equal(summary.needsAttentionCount, 1);
  assert.equal(summary.reviewCount, 1);
  assert.equal(summary.recoveredCount, 1);
  assert.equal(filterAdminPriorities(priorities, "review").length, 1);
  assert.equal(sortAdminPriorities(priorities, "severity")[0].severity, "high");
});

function baseCandidate(
  patch: Partial<AdminPriorityCandidate> = {}
): AdminPriorityCandidate {
  return {
    category: "needs_attention",
    explanation: "Three attempts failed and no later attempt succeeded.",
    firstObservedAt: "2026-07-18T11:00:00.000Z",
    incidentKey: "interaction_failure:receiver-1",
    lastObservedAt: "2026-07-18T11:18:00.000Z",
    occurrenceCount: 3,
    reason: "3 failed attempts in 18 minutes.",
    severity: "medium",
    sourceRecordIds: ["a", "b", "c"],
    sourceType: "interaction_failure",
    summary: "Receiver 1 · 3 failed attempts in 18 minutes",
    title: "Receiver Talk failed repeatedly",
    ...patch,
  };
}
