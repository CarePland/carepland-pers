import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { openAiResponseText, runOpenAiResponse } from "./responses";

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

  it("runs a Responses API request through the shared platform boundary", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ headers: HeadersInit | undefined; request: unknown }> = [];

    globalThis.fetch = (async (_url, init) => {
      calls.push({
        headers: init?.headers,
        request: JSON.parse(String(init?.body)),
      });

      return new Response(JSON.stringify({ output_text: " Done. " }), {
        headers: { "x-request-id": "req_123" },
        status: 200,
      });
    }) as typeof fetch;

    try {
      const result = await runOpenAiResponse({
        apiKey: "test-key",
        input: [{ content: "Hello", role: "user" }],
        model: "gpt-4.1-mini",
        temperature: 0.2,
        text: { format: { type: "json_schema" } },
      });

      assert.equal(result.ok, true);
      assert.equal(result.requestId, "req_123");
      assert.equal(result.status, 200);
      assert.equal(result.text, "Done.");
      assert.deepEqual(calls[0]?.request, {
        input: [{ content: "Hello", role: "user" }],
        model: "gpt-4.1-mini",
        temperature: 0.2,
        text: { format: { type: "json_schema" } },
      });
      assert.equal(
        (calls[0]?.headers as Record<string, string>).Authorization,
        "Bearer test-key"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("requires an API key before calling the provider", async () => {
    await assert.rejects(
      runOpenAiResponse({
        apiKey: "",
        input: [{ content: "Hello", role: "user" }],
        model: "gpt-4.1-mini",
      }),
      /Missing OPENAI_API_KEY/
    );
  });
});
