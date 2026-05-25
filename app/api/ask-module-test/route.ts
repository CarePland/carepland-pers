import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { estimateOpenAiResponseCost } from "@/app/lib/aiUsageCosts";

type JsonObject = Record<string, unknown>;

type AskInstructionVersion = {
  content_hash: string | null;
  id: string;
  model: string | null;
  output_schema: JsonObject | null;
  system_prompt: string | null;
  temperature: number | null;
  user_prompt_template: string | null;
  version_number: number;
};

type AskModuleKey =
  | "ask_bug_interpreter"
  | "ask_clarifier"
  | "ask_feature_interpreter"
  | "ask_off_topic_handler"
  | "ask_router";

type AskModuleConfig = {
  fallbackPrompt: string;
  fallbackSchema: JsonObject;
  formatName: string;
  label: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const openAiApiKey = process.env.OPENAI_API_KEY ?? "";
const fallbackAskUserFacingResponseRubric =
  "Ask should sound like a CarePland routing surface, not a human agent. Avoid first-person assistant phrasing such as I, me, my, we, we're, we've, and we'll whenever practical. Prefer neutral constructions such as \"This will be raised for review,\" \"This may need a closer look,\" \"A little more detail would help route this correctly,\" or \"Thanks for adding this.\" Do not deny that Ask is AI or pretend to be human. If AI identity is directly relevant, explain it plainly without overemphasizing it. Keep responses brief, calm, respectful, and non-corporate.";

const askRouterSchema = {
  additionalProperties: false,
  properties: {
    action: {
      enum: [
        "answer_now",
        "ask_clarifying_question",
        "route_now",
        "needs_human_review",
        "off_topic",
      ],
      type: "string",
    },
    assistant_response: { type: "string" },
    brief_summary: { type: "string" },
    clarifying_question: { type: "string" },
    confidence: { type: "number" },
    primary_category: {
      enum: [
        "support_question",
        "bug_report",
        "feature_request",
        "workflow_feedback",
        "account_or_access_issue",
        "unclear_or_needs_human_review",
        "off_topic",
      ],
      type: "string",
    },
    rationale: { type: "string" },
    recommended_actions: {
      items: {
        additionalProperties: true,
        properties: {
          action: { type: "string" },
          app_area: { type: "string" },
          category: { type: "string" },
          confidence: { type: "number" },
          priority: { type: "string" },
          rationale: { type: "string" },
          title: { type: "string" },
        },
        required: ["action", "confidence", "rationale"],
        type: "object",
      },
      type: "array",
    },
    risk_flags: {
      additionalProperties: false,
      properties: {
        account_or_access: { type: "boolean" },
        data_loss: { type: "boolean" },
        medical_or_emergency: { type: "boolean" },
        privacy_or_security: { type: "boolean" },
        spam_or_abuse: { type: "boolean" },
      },
      required: [
        "account_or_access",
        "data_loss",
        "medical_or_emergency",
        "privacy_or_security",
        "spam_or_abuse",
      ],
      type: "object",
    },
  },
  required: [
    "action",
    "assistant_response",
    "brief_summary",
    "clarifying_question",
    "confidence",
    "primary_category",
    "rationale",
    "recommended_actions",
    "risk_flags",
  ],
  type: "object",
};

const askClarifierSchema = {
  additionalProperties: false,
  properties: {
    clarifying_question: { type: "string" },
    confidence: { type: "number" },
    should_ask_question: { type: "boolean" },
    stop_reason: {
      enum: [
        "ask_one_question",
        "already_clear_enough",
        "low_value_to_continue",
        "limit_reached",
        "needs_human_review",
      ],
      type: "string",
    },
    understanding_summary: { type: "string" },
  },
  required: [
    "clarifying_question",
    "confidence",
    "should_ask_question",
    "stop_reason",
    "understanding_summary",
  ],
  type: "object",
};

const askFeatureInterpreterSchema = {
  additionalProperties: false,
  properties: {
    interpretation: {
      additionalProperties: false,
      properties: {
        affected_app_area: { type: "string" },
        desired_outcome: { type: "string" },
        pain_point: { type: "string" },
        suggested_feature_or_workflow: { type: "string" },
        urgency_clues: { type: "string" },
      },
      required: [
        "affected_app_area",
        "desired_outcome",
        "pain_point",
        "suggested_feature_or_workflow",
        "urgency_clues",
      ],
      type: "object",
    },
    recommended_actions: {
      items: {
        additionalProperties: true,
        properties: {
          action: { type: "string" },
          app_area: { type: "string" },
          category: { type: "string" },
          confidence: { type: "number" },
          desired_outcome: { type: "string" },
          pain_point: { type: "string" },
          priority: { type: "string" },
          rationale: { type: "string" },
          suggested_feature: { type: "string" },
          title: { type: "string" },
          urgency: { type: "string" },
        },
        required: ["action", "confidence", "rationale", "title"],
        type: "object",
      },
      type: "array",
    },
  },
  required: ["interpretation", "recommended_actions"],
  type: "object",
};

const askBugInterpreterSchema = {
  additionalProperties: false,
  properties: {
    interpretation: {
      additionalProperties: false,
      properties: {
        actual_behavior: { type: "string" },
        affected_app_area: { type: "string" },
        expected_behavior: { type: "string" },
        possible_usability_confusion: { type: "boolean" },
        reproducibility_clues: { type: "string" },
        tried_to_do: { type: "string" },
      },
      required: [
        "actual_behavior",
        "affected_app_area",
        "expected_behavior",
        "possible_usability_confusion",
        "reproducibility_clues",
        "tried_to_do",
      ],
      type: "object",
    },
    recommended_actions: {
      items: {
        additionalProperties: true,
        properties: {
          action: { type: "string" },
          actual_behavior: { type: "string" },
          app_area: { type: "string" },
          category: { type: "string" },
          confidence: { type: "number" },
          expected_behavior: { type: "string" },
          possible_usability_confusion: { type: "boolean" },
          priority: { type: "string" },
          rationale: { type: "string" },
          reproducibility_clues: { type: "string" },
          title: { type: "string" },
          tried_to_do: { type: "string" },
        },
        required: ["action", "confidence", "rationale", "title"],
        type: "object",
      },
      type: "array",
    },
  },
  required: ["interpretation", "recommended_actions"],
  type: "object",
};

const askOffTopicHandlerSchema = {
  additionalProperties: false,
  properties: {
    confidence: { type: "number" },
    review_reason: { type: "string" },
    should_close: { type: "boolean" },
    user_response: { type: "string" },
  },
  required: ["confidence", "review_reason", "should_close", "user_response"],
  type: "object",
};

const moduleConfigs: Record<AskModuleKey, AskModuleConfig> = {
  ask_bug_interpreter: {
    fallbackPrompt:
      "You are the CarePland Personal Ask bug/friction interpreter. Convert the routed Ask conversation into structured review candidates for Admin. Capture what the user tried to do, what they expected, what happened instead, affected app area, reproducibility clues, and whether this may be usability confusion rather than a product defect. Do not overstate certainty. Return valid JSON exactly matching the schema.",
    fallbackSchema: askBugInterpreterSchema,
    formatName: "ask_bug_interpreter_result",
    label: "Bug / Friction Interpreter",
  },
  ask_clarifier: {
    fallbackPrompt:
      "You are The Clarifier for CarePland Personal Ask. Your job is not to route everything; your job is to decide whether one more user question would materially improve routing, troubleshooting, or Admin review. Ask at most one concise follow-up question at a time. Sound conversational, brief, and forgiving, especially for likely typos. User-facing questions should avoid first-person assistant phrasing such as I, me, my, we, we're, we've, and we'll whenever practical, because Ask should sound like a CarePland routing surface, not a human agent. If another question is low value, say not to ask and provide a brief understanding summary so the item can be routed for review. Do not interrogate the user. Do not ask questions just to be exhaustive. Return valid JSON exactly matching the schema.",
    fallbackSchema: askClarifierSchema,
    formatName: "ask_clarifier_result",
    label: "The Clarifier",
  },
  ask_feature_interpreter: {
    fallbackPrompt:
      "You are the CarePland Personal Ask feature/workflow interpreter. Convert the routed Ask conversation into structured review candidates for Admin. Preserve the user's original wording and intent. Extract the suggested feature or workflow, pain point, desired outcome, affected app area, urgency clues, and a concise recommended action. Do not make roadmap commitments. Return valid JSON exactly matching the schema.",
    fallbackSchema: askFeatureInterpreterSchema,
    formatName: "ask_feature_interpreter_result",
    label: "Feature / Workflow Interpreter",
  },
  ask_off_topic_handler: {
    fallbackPrompt:
      "You are the CarePland Personal Ask off-topic handler. Your job is narrow: briefly and kindly redirect clearly out-of-scope messages back to CarePland questions, appointment organization, bugs, ideas, workflow feedback, or support review. User-facing responses should avoid first-person assistant phrasing such as I, me, my, we, we're, we've, and we'll whenever practical, because Ask should sound like a CarePland routing surface, not a human agent. If the message includes possible medical, emergency, legal, privacy, security, account-access, abuse, or data-loss risk, do not close it as harmless off-topic; mark it for human review. Do not shame the user. Do not continue the conversation unnecessarily. Return valid JSON exactly matching the schema.",
    fallbackSchema: askOffTopicHandlerSchema,
    formatName: "ask_off_topic_handler_result",
    label: "Off-topic Handler",
  },
  ask_router: {
    fallbackPrompt:
      "You are the CarePland Personal Ask router. Your job is triage and recommendation, not doing every downstream task yourself. Review the current Ask conversation and decide whether to answer a safe app-use question, ask one useful clarifying question, route the intake for review, or mark it off-topic. Keep CarePland patient-facing language calm and plain. User-facing responses should avoid first-person assistant phrasing such as I, me, my, we, we're, we've, and we'll whenever practical, because Ask should sound like a CarePland routing surface, not a human agent. Do not deny that you are AI and do not pretend to be human, but keep that fact in the background unless the user asks or it matters for consent, review, or trust. Do not provide medical, legal, privacy, account-security, billing, or emergency advice. Do not perform destructive actions or claim that data has been changed. Prefer human review for account/access, privacy/security, possible data loss, medical/emergency, abusive/spam, or unclear cases. Return valid JSON exactly matching the schema.",
    fallbackSchema: askRouterSchema,
    formatName: "ask_router_result",
    label: "Ask Router",
  },
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Something went wrong.");
}

function responseText(response: JsonObject): string {
  if (typeof response.output_text === "string") {
    return response.output_text;
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

function cleanConfidence(value: unknown) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue)
    ? Math.max(0, Math.min(1, numericValue))
    : 0;
}

function safeObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstAction(raw: JsonObject) {
  return safeObject(safeArray(raw.recommended_actions)[0]);
}

function resultConfidence(raw: JsonObject) {
  return cleanConfidence(raw.confidence ?? firstAction(raw).confidence);
}

function resultClassification(moduleKey: AskModuleKey, raw: JsonObject) {
  if (moduleKey === "ask_router") {
    return [
      textValue(raw.primary_category),
      textValue(raw.action),
    ].filter(Boolean).join(" / ");
  }

  if (moduleKey === "ask_clarifier") {
    return [
      textValue(raw.stop_reason),
      raw.should_ask_question === true ? "asks" : "does not ask",
    ].filter(Boolean).join(" / ");
  }

  if (moduleKey === "ask_off_topic_handler") {
    return raw.should_close === true ? "close as off-topic" : "send to review";
  }

  return [
    textValue(firstAction(raw).category),
    textValue(firstAction(raw).action),
  ].filter(Boolean).join(" / ");
}

function resultSummary(moduleKey: AskModuleKey, raw: JsonObject) {
  if (moduleKey === "ask_router") {
    return textValue(raw.brief_summary) || textValue(raw.assistant_response);
  }

  if (moduleKey === "ask_clarifier") {
    return textValue(raw.clarifying_question) || textValue(raw.understanding_summary);
  }

  if (moduleKey === "ask_off_topic_handler") {
    return textValue(raw.user_response) || textValue(raw.review_reason);
  }

  return (
    textValue(firstAction(raw).title) ||
    textValue(firstAction(raw).rationale) ||
    textValue(safeObject(raw.interpretation).suggested_feature_or_workflow) ||
    textValue(safeObject(raw.interpretation).tried_to_do)
  );
}

function resultQualityNotes(raw: JsonObject) {
  return (
    textValue(raw.rationale) ||
    textValue(raw.review_reason) ||
    textValue(firstAction(raw).rationale) ||
    textValue(safeObject(raw.interpretation).pain_point) ||
    textValue(safeObject(raw.interpretation).reproducibility_clues)
  );
}

function splitQuestions(value: string) {
  return value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 25);
}

async function loadAskInstructionVersion(
  supabase: SupabaseClient,
  careCircleId: string | null,
  instructionKey: AskModuleKey | "ask_user_response_rubric"
) {
  if (!careCircleId) {
    return null;
  }

  const { data: instructionSets, error: instructionSetError } = await supabase
    .from("ai_instruction_sets")
    .select("id")
    .eq("care_circle_id", careCircleId)
    .eq("instruction_key", instructionKey)
    .eq("is_active", true)
    .limit(1);

  if (instructionSetError) {
    throw instructionSetError;
  }

  const instructionSet = instructionSets?.[0] ?? null;

  if (!instructionSet) {
    return null;
  }

  const { data: instructionVersions, error: instructionVersionError } =
    await supabase
      .from("ai_instruction_versions")
      .select(
        "id,version_number,system_prompt,user_prompt_template,output_schema,model,temperature,content_hash"
      )
      .eq("instruction_set_id", instructionSet.id)
      .eq("is_current", true)
      .limit(1);

  if (instructionVersionError) {
    throw instructionVersionError;
  }

  return (instructionVersions?.[0] ?? null) as AskInstructionVersion | null;
}

async function loadAskResponseRubric(
  supabase: SupabaseClient,
  careCircleId: string | null
) {
  const rubricVersion = await loadAskInstructionVersion(
    supabase,
    careCircleId,
    "ask_user_response_rubric"
  );

  return (
    rubricVersion?.system_prompt?.trim() || fallbackAskUserFacingResponseRubric
  );
}

async function logModuleLabCost({
  careCircleId,
  input,
  moduleConfig,
  moduleKey,
  openAiJson,
  openAiRequestId,
  promptVersion,
  supabase,
  userId,
  model,
}: {
  careCircleId: string | null;
  input: string;
  moduleConfig: AskModuleConfig;
  moduleKey: AskModuleKey;
  openAiJson: JsonObject;
  openAiRequestId: string | null;
  promptVersion: string;
  supabase: SupabaseClient;
  userId: string;
  model: string;
}) {
  const costEstimate = estimateOpenAiResponseCost(model, openAiJson);
  const { error } = await supabase.from("ai_operation_logs").insert({
    cached_input_tokens: costEstimate.usage.cachedInputTokens,
    care_circle_id: careCircleId,
    currency: costEstimate.currency,
    estimated_cost_usd: costEstimate.estimatedCostUsd,
    input_tokens: costEstimate.usage.inputTokens,
    metadata: {
      input_preview: input.slice(0, 160),
      module_label: moduleConfig.label,
      prompt_version: promptVersion,
    },
    model,
    operation_key: `ask_module_lab_${moduleKey}`,
    operation_label: `Ask module lab: ${moduleConfig.label}`,
    output_tokens: costEstimate.usage.outputTokens,
    pricing_snapshot: costEstimate.pricingSnapshot,
    prompt_version: promptVersion,
    provider: "openai",
    provider_request_id: openAiRequestId,
    provider_response_id:
      typeof openAiJson.id === "string" ? openAiJson.id : null,
    source_id: null,
    source_table: "ask_module_lab",
    total_tokens: costEstimate.usage.totalTokens,
    usage_snapshot: openAiJson.usage ?? {},
    user_id: userId,
  });

  if (error) {
    console.error("Failed to log Ask module lab cost", error);
  }
}

async function runModuleTest({
  careCircleId,
  input,
  moduleConfig,
  moduleKey,
  responseRubric,
  supabase,
  userId,
}: {
  careCircleId: string | null;
  input: string;
  moduleConfig: AskModuleConfig;
  moduleKey: AskModuleKey;
  responseRubric: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const instructionVersion = await loadAskInstructionVersion(
    supabase,
    careCircleId,
    moduleKey
  );
  const schema =
    instructionVersion?.output_schema &&
    typeof instructionVersion.output_schema === "object" &&
    Object.keys(instructionVersion.output_schema).length > 0
      ? instructionVersion.output_schema
      : moduleConfig.fallbackSchema;
  const systemPrompt =
    instructionVersion?.system_prompt ?? moduleConfig.fallbackPrompt;
  const model = instructionVersion?.model ?? "gpt-4.1-mini";
  const promptVersion = instructionVersion
    ? `${moduleKey}:v${instructionVersion.version_number}`
    : `${moduleKey}:fallback`;
  const userPrompt = [
    instructionVersion?.user_prompt_template
      ? `Instruction template:\n${instructionVersion.user_prompt_template}`
      : "",
    `Global Ask response rubric:\n${responseRubric}`,
    "Admin module-lab test input. Do not create records or claim that anything has been routed.",
    `User message:\n${input}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        { content: systemPrompt, role: "system" },
        { content: userPrompt, role: "user" },
      ],
      model,
      temperature: instructionVersion?.temperature ?? 0.2,
      text: {
        format: {
          name: moduleConfig.formatName,
          schema,
          strict: false,
          type: "json_schema",
        },
      },
    }),
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const openAiJson = (await openAiResponse.json()) as JsonObject;
  const openAiRequestId =
    openAiResponse.headers.get("x-request-id") ??
    openAiResponse.headers.get("openai-request-id");

  if (!openAiResponse.ok) {
    const apiError =
      openAiJson.error && typeof openAiJson.error === "object"
        ? (openAiJson.error as JsonObject).message
        : null;
    throw new Error(String(apiError ?? `${moduleKey} test failed.`));
  }

  const text = responseText(openAiJson);

  if (!text) {
    throw new Error(`${moduleKey} returned an empty response.`);
  }

  const raw = JSON.parse(text) as JsonObject;

  await logModuleLabCost({
    careCircleId,
    input,
    moduleConfig,
    moduleKey,
    model,
    openAiJson,
    openAiRequestId,
    promptVersion,
    supabase,
    userId,
  });

  return {
    classification: resultClassification(moduleKey, raw),
    confidence: resultConfidence(raw),
    input,
    model,
    moduleKey,
    promptVersion,
    qualityNotes: resultQualityNotes(raw),
    raw,
    summary: resultSummary(moduleKey, raw),
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase server configuration.");
    }

    if (!openAiApiKey) {
      throw new Error("Missing OPENAI_API_KEY in environment variables.");
    }

    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before testing Ask modules.");
    }

    const body = await request.json();
    const moduleKey = String(body.moduleKey ?? "") as AskModuleKey;
    const questions = splitQuestions(String(body.questions ?? ""));
    const moduleConfig = moduleConfigs[moduleKey];

    if (!moduleConfig) {
      throw new Error("Choose an Ask module to test.");
    }

    if (questions.length === 0) {
      throw new Error("Paste at least one question to test.");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("Please sign in before testing Ask modules.");
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userId)
      .limit(1);

    if (profileError) {
      throw profileError;
    }

    if (!profileRows?.[0]?.is_admin) {
      throw new Error("Admin access is required to test Ask modules.");
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("care_circle_memberships")
      .select("care_circle_id")
      .eq("status", "active")
      .limit(1);

    if (membershipsError) {
      throw membershipsError;
    }

    const careCircleId = memberships?.[0]?.care_circle_id ?? null;
    const responseRubric = await loadAskResponseRubric(supabase, careCircleId);
    const results = [];

    for (const input of questions) {
      try {
        results.push(
          await runModuleTest({
            careCircleId,
            input,
            moduleConfig,
            moduleKey,
            responseRubric,
            supabase,
            userId,
          })
        );
      } catch (error) {
        results.push({
          classification: "",
          confidence: 0,
          error: errorMessage(error),
          input,
          model: "",
          moduleKey,
          promptVersion: "",
          qualityNotes: "",
          raw: {},
          summary: "",
        });
      }
    }

    return NextResponse.json({
      moduleKey,
      moduleLabel: moduleConfig.label,
      results,
      testedCount: questions.length,
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
