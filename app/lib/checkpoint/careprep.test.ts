import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCarePrepDecisionTrace,
  buildCarePrepDecisionQualityReviews,
  buildCarePrepStructuredInterpretation,
  normalizeCarePrepProposedOutput,
} from "./careprep";

describe("CarePrep Checkpoint contract", () => {
  it("preserves proposed output sections from CarePrep guidance", () => {
    const output = normalizeCarePrepProposedOutput({
      beforeVisit: ["BP log"],
      duringVisit: ["Ask about dizziness"],
      intro: "Prepare for cardiology follow-up.",
    });

    assert.equal(output.intro, "Prepare for cardiology follow-up.");
    assert.deepEqual(output.beforeVisit, ["BP log"]);
    assert.deepEqual(output.duringVisit, ["Ask about dizziness"]);
  });

  it("builds structured observations tied to selected evidence only", () => {
    const interpretation = buildCarePrepStructuredInterpretation(
      {
        duringVisit: ["Ask whether medication timing should change."],
        intro: "Dizziness came up after a medication change.",
      },
      {
        future_appointment: {
          id: "appt-next",
          care_vip_name: "Rob",
          current_note: { summary_short: "Follow-up" },
        },
        past_appointments: [
          {
            id: "appt-prior",
            note: { summary_short: "Dizziness after medication change" },
          },
        ],
      }
    );

    assert.equal(
      interpretation.evaluationQuestion,
      "If I were attending this appointment tomorrow, would this preparation genuinely reduce my cognitive workload?"
    );
    assert.ok(
      interpretation.observations.some((observation) =>
        observation.supportingEvidenceRefs.includes("appointment:appt-next")
      )
    );
    assert.ok(
      interpretation.observations.some((observation) =>
        observation.supportingEvidenceRefs.includes("appointment:appt-prior")
      )
    );
  });

  it("flags preparation that asks users to rediscover known information", () => {
    const reviews = buildCarePrepDecisionQualityReviews(
      normalizeCarePrepProposedOutput({
        beforeVisit: ["Bring information about Dixie's dental cleaning."],
        intro: "Prepare for the dental follow-up.",
      }),
      {
        future_appointment: {
          id: "appt-next",
          title: "Dental follow-up",
        },
        past_appointments: [
          {
            id: "appt-prior",
            title: "Dental cleaning",
            starts_at: "2026-07-14T15:00:00.000Z",
            note: {
              summary_short: "Dixie completed a dental cleaning.",
              takeaways: ["Dental cleaning completed without complications."],
            },
          },
        ],
      }
    );

    assert.equal(reviews[0]?.userWorkOutcome, "requested_information_already_known");
    assert.match(
      reviews[0]?.checkpointReview ?? "",
      /already possess the information/i
    );
    assert.match(
      reviews[0]?.suggestedBetterDecision ?? "",
      /Use the known information directly/i
    );
  });

  it("emits a review-required Decision Trace for preserved runs", () => {
    const trace = buildCarePrepDecisionTrace(
      "run-1",
      {
        beforeVisit: ["Medication list"],
        intro: "Bring medication history to the appointment.",
      },
      {
        future_appointment: { id: "appt-1", title: "Primary care" },
        past_appointment_total_count: 2,
        past_appointments: [],
      },
      "2026-07-17T00:00:00.000Z"
    );

    assert.equal(trace.layer, "workflow_selection");
    assert.equal(trace.execution?.policy, "review_required");
    assert.equal(trace.humanReview?.required, true);
    assert.equal(trace.context?.appointmentId, "appt-1");
    assert.match(trace.outputSummary, /intro/);
  });
});
