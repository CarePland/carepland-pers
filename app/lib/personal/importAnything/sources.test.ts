import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatImportAnythingPlaceholderSection,
  formatImportAnythingSourceSummary,
  formatImportAnythingTextSection,
  maxImportAnythingSourceTextChars,
} from "./sources";

describe("Import Anything source formatting", () => {
  it("formats source summaries with type and readable size", () => {
    assert.equal(
      formatImportAnythingSourceSummary({
        name: " portal-message.txt ",
        size: 12_400,
        type: "text/plain",
      }),
      "portal-message.txt (text/plain, 12.4 KB)"
    );
  });

  it("uses stable fallbacks for incomplete file metadata", () => {
    assert.equal(
      formatImportAnythingSourceSummary({ name: "   " }),
      "Untitled source (file)"
    );
  });

  it("normalizes source names before placing them in review text", () => {
    assert.equal(
      formatImportAnythingSourceSummary({
        name: " portal\n message\t scan.pdf ",
        size: 1_200,
        type: "application/pdf",
      }),
      "portal message scan.pdf (application/pdf, 1.2 KB)"
    );
    assert.match(
      formatImportAnythingTextSection({
        name: " notes\r\nfrom portal.txt ",
        text: "Appointment details",
      }),
      /^--- notes from portal\.txt ---\n/
    );
  });

  it("bounds long text sections and marks truncation", () => {
    const section = formatImportAnythingTextSection({
      name: "large.txt",
      text: `  ${"x".repeat(maxImportAnythingSourceTextChars + 10)}  `,
    });

    assert.match(section, /^--- large\.txt ---\n/);
    assert.match(section, /Text truncated/);
    assert.equal(
      section.includes("x".repeat(maxImportAnythingSourceTextChars + 1)),
      false
    );
  });

  it("labels empty text files clearly", () => {
    assert.equal(
      formatImportAnythingTextSection({ name: "empty.txt", text: "   " }),
      "--- empty.txt ---\n[Text file was empty.]"
    );
  });

  it("formats placeholder source sections", () => {
    assert.equal(
      formatImportAnythingPlaceholderSection({
        message: "Source attached but not extracted in this local build.",
        name: "scan.bin",
      }),
      "--- scan.bin ---\n[Source attached but not extracted in this local build.]"
    );
  });
});
