import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingServerEnvError } from "../server/env";
import { createSupabaseServiceClient } from "../server/supabase";
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
    await recordCostLogFailure(operationKey, error, {
      careCircleId,
      sourceId,
      sourceTable,
      userId,
    });
  }
}

// Best-effort, admin-visible record of a failed cost-log insert. Previously
// this class of failure only ever reached a server console -- there was no
// way for Admin to notice that usage was quietly not being counted. Uses the
// service-role client deliberately so this write can never itself fail due
// to the same RLS/auth conditions that may have caused the original insert
// to fail, and is wrapped defensively so a missing service-role
// configuration (e.g. a local/dev environment) can't turn a logging problem
// into a request failure.
async function recordCostLogFailure(
  operationKey: string,
  originalError: unknown,
  metadata: JsonObject
) {
  try {
    const serviceClient = createSupabaseServiceClient();
    await serviceClient.from("ai_operation_cost_log_failures").insert({
      error_message: errorMessage(originalError),
      metadata,
      operation_key: operationKey,
    });
  } catch (recordingError) {
    if (isMissingServerEnvError(recordingError)) {
      return;
    }

    console.error(
      `Failed to record cost-log failure for ${operationKey}`,
      recordingError
    );
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return String(error || "Unknown error");
}
