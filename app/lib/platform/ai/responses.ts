type JsonObject = Record<string, unknown>;

export type OpenAiResponseMessage = {
  content: string;
  role: "system" | "user" | "assistant";
};

export type RunOpenAiResponseInput = {
  apiKey?: string | null;
  input: OpenAiResponseMessage[];
  model: string;
  temperature?: number;
  text?: JsonObject;
};

export type RunOpenAiResponseResult = {
  json: JsonObject;
  ok: boolean;
  requestId: string | null;
  status: number;
  text: string;
};

export function openAiResponseText(response: JsonObject): string {
  if (typeof response.output_text === "string") {
    return response.output_text.trim();
  }

  const output = Array.isArray(response.output) ? response.output : [];

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item)) {
        return [];
      }

      const content = Array.isArray(item.content) ? item.content : [];
      return content.map((contentItem: unknown) => {
        if (
          contentItem &&
          typeof contentItem === "object" &&
          "text" in contentItem
        ) {
          return String(contentItem.text);
        }

        return "";
      });
    })
    .join("")
    .trim();
}

export async function runOpenAiResponse({
  apiKey = process.env.OPENAI_API_KEY,
  input,
  model,
  temperature,
  text,
}: RunOpenAiResponseInput): Promise<RunOpenAiResponseResult> {
  const trimmedApiKey = apiKey?.trim() ?? "";

  if (!trimmedApiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment variables.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input,
      model,
      ...(temperature === undefined ? {} : { temperature }),
      ...(text === undefined ? {} : { text }),
    }),
    headers: {
      Authorization: `Bearer ${trimmedApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const json = (await response.json().catch(() => ({}))) as JsonObject;

  return {
    json,
    ok: response.ok,
    requestId:
      response.headers.get("x-request-id") ??
      response.headers.get("openai-request-id"),
    status: response.status,
    text: openAiResponseText(json),
  };
}
