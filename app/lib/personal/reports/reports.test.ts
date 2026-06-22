import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTopicReportTitle,
  normalizeReportTitle,
  normalizeSavedReportDraft,
} from ".";

describe("reports", () => {
  it("builds calm default topic report titles", () => {
    assert.equal(buildTopicReportTitle("Blood Pressure"), "Blood Pressure Summary");
    assert.equal(buildTopicReportTitle("  "), "Topic Summary");
  });

  it("normalizes report drafts before saving", () => {
    const draft = normalizeSavedReportDraft({
      careCircleId: "circle-1",
      careSubjectId: "subject-1",
      generatedSummary: "  Blood pressure came up often.  ",
      reportType: "topic_summary",
      sourceAppointmentIds: [" appt-1 ", "appt-2", "appt-1"],
      sourceTopicMentionIds: ["mention-1", "mention-1"],
      sourceTopicSummaryIds: [],
      title: "  Blood   Pressure Summary ",
      topicSlug: "Blood Pressure",
    });

    assert.equal(draft.generatedSummary, "Blood pressure came up often.");
    assert.equal(draft.title, "Blood Pressure Summary");
    assert.equal(draft.topicSlug, "blood_pressure");
    assert.deepEqual(draft.sourceAppointmentIds, ["appt-1", "appt-2"]);
    assert.deepEqual(draft.sourceTopicMentionIds, ["mention-1"]);
  });

  it("collapses title whitespace", () => {
    assert.equal(normalizeReportTitle(" Last   Six Months  "), "Last Six Months");
  });
});
