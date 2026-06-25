import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  maxImportAnythingRawTextChars,
  maxImportAnythingSourceSummaries,
  maxImportAnythingSourceSummaryChars,
  normalizeImportAnythingRequest,
} from "./request";

describe("Import Anything request normalization", () => {
  it("trims text and care subject id", () => {
    const request = normalizeImportAnythingRequest({
      careSubjectId: " subject-1 ",
      rawText: "  Portal message text  ",
      sourceSummaries: [" portal.txt "],
    });

    assert.equal(request.rawText, "Portal message text");
    assert.equal(request.requestedCareSubjectId, "subject-1");
    assert.deepEqual(request.sourceSummaries, ["portal.txt"]);
  });

  it("rejects empty import text", () => {
    assert.throws(
      () => normalizeImportAnythingRequest({ rawText: "   " }),
      /Add text or extracted file content/
    );
  });

  it("rejects oversized import text before model review", () => {
    assert.throws(
      () =>
        normalizeImportAnythingRequest({
          rawText: "x".repeat(maxImportAnythingRawTextChars + 1),
        }),
      /smaller batch/
    );
  });

  it("bounds source summaries before storing them in audit text", () => {
    const request = normalizeImportAnythingRequest({
      rawText: "Appointment reminder",
      sourceSummaries: Array.from(
        { length: maxImportAnythingSourceSummaries + 5 },
        (_, index) => `source-${index}-${"x".repeat(500)}`
      ),
    });

    assert.equal(
      request.sourceSummaries.length,
      maxImportAnythingSourceSummaries
    );
    assert.equal(
      request.sourceSummaries[0]?.length,
      maxImportAnythingSourceSummaryChars
    );
  });

  it("normalizes and deduplicates source summaries before storing them", () => {
    const request = normalizeImportAnythingRequest({
      rawText: "Appointment reminder",
      sourceSummaries: [
        " portal\n message.pdf  (application/pdf, 1 KB) ",
        "portal message.pdf (application/pdf, 1 KB)",
        "",
        123,
      ],
    });

    assert.deepEqual(request.sourceSummaries, [
      "portal message.pdf (application/pdf, 1 KB)",
    ]);
  });
});
