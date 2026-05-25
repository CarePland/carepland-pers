export type JsonObject = Record<string, unknown>;

export type AiTokenUsage = {
  cachedInputTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AiCostEstimate = {
  currency: "USD";
  estimatedCostUsd: number | null;
  pricingSnapshot: JsonObject;
  usage: AiTokenUsage;
};

type ModelPricing = {
  cachedInputUsdPerMillionTokens: number;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  pricingAsOf: string;
  sourceUrl: string;
};

const openAiModelPricing: Record<string, ModelPricing> = {
  "gpt-4.1": {
    cachedInputUsdPerMillionTokens: 0.5,
    inputUsdPerMillionTokens: 2,
    outputUsdPerMillionTokens: 8,
    pricingAsOf: "2026-05-25",
    sourceUrl: "https://openai.com/api/pricing/",
  },
  "gpt-4.1-mini": {
    cachedInputUsdPerMillionTokens: 0.1,
    inputUsdPerMillionTokens: 0.4,
    outputUsdPerMillionTokens: 1.6,
    pricingAsOf: "2026-05-25",
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-4.1-mini",
  },
  "gpt-4.1-nano": {
    cachedInputUsdPerMillionTokens: 0.025,
    inputUsdPerMillionTokens: 0.1,
    outputUsdPerMillionTokens: 0.4,
    pricingAsOf: "2026-05-25",
    sourceUrl: "https://openai.com/api/pricing/",
  },
  "gpt-4o-mini": {
    cachedInputUsdPerMillionTokens: 0.075,
    inputUsdPerMillionTokens: 0.15,
    outputUsdPerMillionTokens: 0.6,
    pricingAsOf: "2026-05-25",
    sourceUrl: "https://openai.com/api/pricing/",
  },
};

function numberValue(value: unknown) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

export function extractOpenAiTokenUsage(response: JsonObject): AiTokenUsage {
  const usage = objectValue(response.usage);
  const inputDetails = objectValue(usage.input_tokens_details);
  const outputDetails = objectValue(usage.output_tokens_details);
  const inputTokens = numberValue(
    usage.input_tokens ?? usage.prompt_tokens
  );
  const outputTokens = numberValue(
    usage.output_tokens ?? usage.completion_tokens
  );
  const totalTokens = numberValue(usage.total_tokens) || inputTokens + outputTokens;

  return {
    cachedInputTokens: numberValue(
      inputDetails.cached_tokens ?? inputDetails.cached_input_tokens
    ),
    inputTokens,
    outputTokens:
      outputTokens ||
      numberValue(outputDetails.reasoning_tokens) +
        numberValue(outputDetails.accepted_prediction_tokens),
    totalTokens,
  };
}

export function estimateOpenAiResponseCost(
  model: string,
  response: JsonObject
): AiCostEstimate {
  const usage = extractOpenAiTokenUsage(response);
  const pricing = openAiModelPricing[model] ?? null;

  if (!pricing) {
    return {
      currency: "USD",
      estimatedCostUsd: null,
      pricingSnapshot: {
        model,
        pricing_found: false,
        source_note:
          "No local pricing snapshot is configured for this model yet.",
      },
      usage,
    };
  }

  const billableInputTokens = Math.max(
    0,
    usage.inputTokens - usage.cachedInputTokens
  );
  const estimatedCostUsd =
    (billableInputTokens * pricing.inputUsdPerMillionTokens +
      usage.cachedInputTokens * pricing.cachedInputUsdPerMillionTokens +
      usage.outputTokens * pricing.outputUsdPerMillionTokens) /
    1_000_000;

  return {
    currency: "USD",
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(8)),
    pricingSnapshot: {
      ...pricing,
      model,
      pricing_found: true,
    },
    usage,
  };
}
