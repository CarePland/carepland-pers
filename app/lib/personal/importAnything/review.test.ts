import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildImportAnythingCarePrepDrafts,
  maxImportAnythingCarePrepSourceExcerptChars,
} from "./review";

describe("Import Anything review mapping", () => {
  it("groups approved matched questions, medication changes, tasks, and CarePrep details into draft CarePrep", () => {
    const drafts = buildImportAnythingCarePrepDrafts({
      appointmentsById: new Map([
        [
          "appt-1",
          {
            id: "appt-1",
            reason: "Blood pressure follow-up",
            title: "Primary care follow-up",
          },
        ],
      ]),
      careCircleId: "circle-1",
      generatedAt: "2026-06-22T17:00:00.000Z",
      intakeItemId: "intake-1",
      items: [
        {
          fields: { question: "Should we change the medication timing?" },
          kind: "question",
          matchedAppointmentId: "appt-1",
          sourceExcerpt: "Ask about medication timing.",
          status: "approved",
        },
        {
          fields: { detail: "Bring home blood pressure readings." },
          kind: "careprep",
          matchedAppointmentId: "appt-1",
          sourceExcerpt: "Bring BP log.",
          status: "approved",
        },
        {
          fields: {
            details: "Before visit",
            dueAt: "2026-06-24T09:00",
            title: "Schedule labs",
          },
          kind: "task",
          matchedAppointmentId: "appt-1",
          sourceExcerpt: "Schedule labs before visit.",
          status: "approved",
        },
        {
          fields: {
            changeSummary: "Dose was increased",
            instructions: "Take with breakfast",
            medicationName: "Lisinopril",
          },
          kind: "medication_change",
          matchedAppointmentId: "appt-1",
          sourceExcerpt: "Lisinopril dose increased.",
          status: "approved",
        },
      ],
      userId: "user-1",
    });

    assert.equal(drafts.length, 1);
    assert.equal(drafts[0]?.itemCount, 4);
    assert.deepEqual(drafts[0]?.payload.key_questions, [
      "Should we change the medication timing?",
    ]);
    assert.deepEqual(drafts[0]?.payload.med_review, [
      "Lisinopril: Dose was increased: Take with breakfast",
    ]);
    assert.deepEqual(drafts[0]?.payload.next_steps, [
      "Bring home blood pressure readings.",
      "Schedule labs - 2026-06-24T09:00 - Before visit",
    ]);
    assert.equal(drafts[0]?.payload.review_status, "draft");
    assert.equal(drafts[0]?.payload.is_current, false);
    assert.equal(drafts[0]?.payload.source, "import_anything");
    assert.equal(
      drafts[0]?.payload.input_context_snapshot.source_excerpt,
      "Ask about medication timing.\n\nBring BP log.\n\nSchedule labs before visit.\n\nLisinopril dose increased."
    );
    assert.match(
      drafts[0]?.payload.summary ?? "",
      /Primary care follow-up/
    );
  });

  it("leaves unmatched and rejected preparation items out of durable drafts", () => {
    const drafts = buildImportAnythingCarePrepDrafts({
      appointmentsById: new Map(),
      careCircleId: "circle-1",
      generatedAt: "2026-06-22T17:00:00.000Z",
      intakeItemId: null,
      items: [
        {
          fields: { question: "What should I ask?" },
          kind: "question",
          matchedAppointmentId: "",
          sourceExcerpt: "Question without match.",
          status: "approved",
        },
        {
          fields: { medicationName: "Metformin" },
          kind: "medication_change",
          matchedAppointmentId: "",
          sourceExcerpt: "Medication without match.",
          status: "approved",
        },
        {
          fields: { title: "Schedule labs" },
          kind: "task",
          matchedAppointmentId: "",
          sourceExcerpt: "Task without match.",
          status: "approved",
        },
        {
          fields: { detail: "Bring medication list." },
          kind: "careprep",
          matchedAppointmentId: "appt-2",
          sourceExcerpt: "Rejected detail.",
          status: "rejected",
        },
      ],
      userId: "user-1",
    });

    assert.deepEqual(drafts, []);
  });

  it("skips blank matched preparation fields so empty drafts are not created", () => {
    const drafts = buildImportAnythingCarePrepDrafts({
      appointmentsById: new Map([
        ["appt-1", { id: "appt-1", reason: null, title: null }],
      ]),
      careCircleId: "circle-1",
      generatedAt: "2026-06-22T17:00:00.000Z",
      intakeItemId: "intake-1",
      items: [
        {
          fields: { question: "   " },
          kind: "question",
          matchedAppointmentId: "appt-1",
          sourceExcerpt: "Blank question.",
          status: "approved",
        },
      ],
      userId: "user-1",
    });

    assert.deepEqual(drafts, []);
  });

  it("deduplicates repeated CarePrep draft lines case-insensitively", () => {
    const drafts = buildImportAnythingCarePrepDrafts({
      appointmentsById: new Map([
        ["appt-1", { id: "appt-1", reason: null, title: "Follow-up" }],
      ]),
      careCircleId: "circle-1",
      generatedAt: "2026-06-22T17:00:00.000Z",
      intakeItemId: "intake-1",
      items: [
        {
          fields: { question: "What should I monitor?" },
          kind: "question",
          matchedAppointmentId: "appt-1",
          sourceExcerpt: "Ask what to monitor.",
          status: "approved",
        },
        {
          fields: { question: " what should i monitor? " },
          kind: "question",
          matchedAppointmentId: "appt-1",
          sourceExcerpt: "Ask what to monitor again.",
          status: "approved",
        },
        {
          fields: { detail: "Bring blood pressure readings." },
          kind: "careprep",
          matchedAppointmentId: "appt-1",
          sourceExcerpt: "Bring readings.",
          status: "approved",
        },
        {
          fields: { detail: " bring blood pressure readings. " },
          kind: "careprep",
          matchedAppointmentId: "appt-1",
          sourceExcerpt: "Bring readings again.",
          status: "approved",
        },
      ],
      userId: "user-1",
    });

    assert.equal(drafts.length, 1);
    assert.deepEqual(drafts[0]?.payload.key_questions, [
      "What should I monitor?",
    ]);
    assert.deepEqual(drafts[0]?.payload.next_steps, [
      "Bring blood pressure readings.",
    ]);
  });

  it("bounds source excerpts saved into CarePrep draft context", () => {
    const drafts = buildImportAnythingCarePrepDrafts({
      appointmentsById: new Map([
        ["appt-1", { id: "appt-1", reason: null, title: null }],
      ]),
      careCircleId: "circle-1",
      generatedAt: "2026-06-22T17:00:00.000Z",
      intakeItemId: "intake-1",
      items: [
        {
          fields: { question: "What should I monitor?" },
          kind: "question",
          matchedAppointmentId: "appt-1",
          sourceExcerpt: "x".repeat(
            maxImportAnythingCarePrepSourceExcerptChars + 100
          ),
          status: "approved",
        },
      ],
      userId: "user-1",
    });

    const sourceExcerpt =
      drafts[0]?.payload.input_context_snapshot.source_excerpt ?? "";

    assert.equal(drafts.length, 1);
    assert.match(sourceExcerpt, /Source excerpt truncated/);
    assert.equal(
      sourceExcerpt.includes(
        "x".repeat(maxImportAnythingCarePrepSourceExcerptChars + 1)
      ),
      false
    );
  });
});
