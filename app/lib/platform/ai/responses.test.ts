import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { openAiResponseText } from "./responses";

describe("OpenAI Responses helpers", () => {
  it("uses output_text when supplied", () => {
    assert.equal(openAiResponseText({ output_text: " Extracted text. " }), "Extracted text.");
  });

  it("falls back to nested response content text", () => {
    assert.equal(
      openAiResponseText({
        output: [
          {
            content: [
              { text: "First page\n" },
              { text: "Second page" },
              { type: "annotation" },
            ],
          },
          {
            content: [{ text: "\nThird page" }],
          },
        ],
      }),
      "First page\nSecond page\nThird page"
    );
  });

  it("returns an empty string for malformed responses", () => {
    assert.equal(openAiResponseText({ output: [{ content: "not-array" }] }), "");
    assert.equal(openAiResponseText({}), "");
  });
});
