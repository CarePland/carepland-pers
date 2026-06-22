import type { SupabaseClient } from "@supabase/supabase-js";

import {
  estimateOpenAiResponseCost,
  type JsonObject,
} from "./usageCosts";

type LogOpenAiOperationCostInput = {
  careCircleId?: string | null;
  metadata?: JsonObject;
  model: string;
  openAiJson: JsonObject;
  operationKey: string;
  operationLabel?: string;
  promptVersion?: string | null;
  providerRequestId?: string | null;
  sourceId?: string | null;
  sourceTable?: string | null;
  supabase: SupabaseClient;
  userId?: string | null;
};

export async function logOpenAiOperationCost({
  careCircleId = null,
  metadata = {},
  model,
  openAiJson,
  operationKey,
  operationLabel,
  promptVersion = null,
  providerRequestId = null,
  sourceId = null,
  sourceTable = null,
  supabase,
  userId = null,
}: LogOpenAiOperationCostInput) {
  const costEstimate = estimateOpenAiResponseCost(model, openAiJson);
  const { error } = await supabase.from("ai_operation_logs").insert({
    cached_input_tokens: costEstimate.usage.cachedInputTokens,
    care_circle_id: careCircleId,
    currency: costEstimate.currency,
    estimated_cost_usd: costEstimate.estimatedCostUsd,
    input_tokens: costEstimate.usage.inputTokens,
    metadata,
    model,
    operation_key: operationKey,
    operation_label: operationLabel ?? operationKey,
    output_tokens: costEstimate.usage.outputTokens,
    pricing_snapshot: costEstimate.pricingSnapshot,
    prompt_version: promptVersion,
    provider: "openai",
    provider_request_id: providerRequestId,
    provider_response_id:
      typeof openAiJson.id === "string" ? openAiJson.id : null,
    source_id: sourceId,
    source_table: sourceTable,
    total_tokens: costEstimate.usage.totalTokens,
    usage_snapshot: openAiJson.usage ?? {},
    user_id: userId,
  });

  if (error) {
    console.error(`Failed to log ${operationKey} AI operation cost`, error);
  }
}
