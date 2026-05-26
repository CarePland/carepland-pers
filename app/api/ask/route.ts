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

type AskModuleRunResult = {
  costEstimate: ReturnType<typeof estimateOpenAiResponseCost>;
  instructionVersion: AskInstructionVersion | null;
  model: string;
  openAiJson: JsonObject;
  openAiRequestId: string | null;
  parsed: JsonObject;
  promptVersion: string;
};

type AskRouterAction =
  | "answer_now"
  | "ask_clarifying_question"
  | "needs_human_review"
  | "off_topic"
  | "route_now";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

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
        additionalProperties: false,
        properties: {
          action: {
            enum: [
              "create_wishlist_item",
              "create_workflow_item",
              "needs_human_review",
            ],
            type: "string",
          },
          app_area: { type: "string" },
          category: {
            enum: ["feature_request", "workflow_feedback"],
            type: "string",
          },
          confidence: { type: "number" },
          desired_outcome: { type: "string" },
          pain_point: { type: "string" },
          priority: { enum: ["low", "medium", "high"], type: "string" },
          rationale: { type: "string" },
          suggested_feature: { type: "string" },
          title: { type: "string" },
          urgency: { type: "string" },
        },
        required: [
          "action",
          "app_area",
          "category",
          "confidence",
          "desired_outcome",
          "pain_point",
          "priority",
          "rationale",
          "suggested_feature",
          "title",
          "urgency",
        ],
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
        additionalProperties: false,
        properties: {
          action: {
            enum: [
              "create_bug_item",
              "create_workflow_item",
              "needs_human_review",
            ],
            type: "string",
          },
          actual_behavior: { type: "string" },
          app_area: { type: "string" },
          category: {
            enum: ["bug_report", "workflow_feedback"],
            type: "string",
          },
          confidence: { type: "number" },
          expected_behavior: { type: "string" },
          possible_usability_confusion: { type: "boolean" },
          priority: { enum: ["low", "medium", "high"], type: "string" },
          rationale: { type: "string" },
          reproducibility_clues: { type: "string" },
          title: { type: "string" },
          tried_to_do: { type: "string" },
        },
        required: [
          "action",
          "actual_behavior",
          "app_area",
          "category",
          "confidence",
          "expected_behavior",
          "possible_usability_confusion",
          "priority",
          "rationale",
          "reproducibility_clues",
          "title",
          "tried_to_do",
        ],
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

const askOnboardingHelperSchema = {
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    confidence: { type: "number" },
    escalation_reason: { type: "string" },
    escalation_recommended: { type: "boolean" },
    recommended_actions: {
      items: {
        additionalProperties: true,
        properties: {
          action: { type: "string" },
          confidence: { type: "number" },
          priority: { type: "string" },
          rationale: { type: "string" },
          title: { type: "string" },
        },
        required: ["action", "confidence", "rationale", "title"],
        type: "object",
      },
      type: "array",
    },
    summary: { type: "string" },
  },
  required: [
    "answer",
    "confidence",
    "escalation_reason",
    "escalation_recommended",
    "recommended_actions",
    "summary",
  ],
  type: "object",
};

const askUserFacingResponseRubric =
  "Global user-facing response rubric: Ask should sound like a CarePland routing surface, not a human agent. Avoid first-person assistant phrasing such as I, me, my, we, we're, we've, and we'll whenever practical. Prefer neutral constructions such as \"This will be raised for review,\" \"This may need a closer look,\" \"A little more detail would help route this correctly,\" or \"Thanks for adding this.\" Do not deny that Ask is AI or pretend to be human. If AI identity is directly relevant, explain it plainly without overemphasizing it. Keep responses brief, calm, respectful, and non-corporate.";

const fallbackAskRouterPrompt =
  `You are the CarePland Personal Ask router. Your job is triage and recommendation, not doing every downstream task yourself. Review the current Ask conversation and decide whether to answer a safe app-use question, ask one useful clarifying question, route the intake for review, or mark it off-topic. Keep CarePland patient-facing language calm and plain. ${askUserFacingResponseRubric} If a user asks what you are, you may say: "This is an AI assistant designed to help route questions, feedback, and ideas throughout CarePland. It is not a replacement for real people; its purpose is to help the CarePland team better understand and respond to what users need, almost like CarePrep for support and product feedback." Do not provide medical, legal, privacy, account-security, billing, or emergency advice. Do not perform destructive actions or claim that data has been changed. Prefer human review for account/access, privacy/security, possible data loss, medical/emergency, abusive/spam, or unclear cases. If asking a clarifying question, ask only when the answer would materially improve routing, troubleshooting, or admin usefulness. Clarifying questions should sound conversational, brief, and a little forgiving, not formal or interrogative. For likely typos or near-matches, prefer simple language such as "Just to confirm — did you mean 'prep'?" or "The word 'perp' may have been a typo. Did you mean 'prep'?" Return valid JSON exactly matching the schema.`;

const fallbackAskClarifierPrompt =
  `You are The Clarifier for CarePland Personal Ask. Your job is not to route everything; your job is to decide whether one more user question would materially improve routing, troubleshooting, or Admin review. Ask at most one concise follow-up question at a time. Sound conversational, brief, and forgiving, especially for likely typos. ${askUserFacingResponseRubric} If another question is low value, say not to ask and provide a brief understanding summary so the item can be routed for review. Do not interrogate the user. Do not ask questions just to be exhaustive. Return valid JSON exactly matching the schema.`;

const fallbackAskFeatureInterpreterPrompt =
  "You are the CarePland Personal Ask feature/workflow interpreter. Convert the routed Ask conversation into structured review candidates for Admin. Preserve the user's original wording and intent. Extract the suggested feature or workflow, pain point, desired outcome, affected app area, urgency clues, and a concise recommended action. Do not make roadmap commitments. Return valid JSON exactly matching the schema.";

const fallbackAskBugInterpreterPrompt =
  "You are the CarePland Personal Ask bug/friction interpreter. Convert the routed Ask conversation into structured review candidates for Admin. Capture what the user tried to do, what they expected, what happened instead, affected app area, reproducibility clues, and whether this may be usability confusion rather than a product defect. Do not overstate certainty. Return valid JSON exactly matching the schema.";

const fallbackAskOffTopicHandlerPrompt =
  `You are the CarePland Personal Ask off-topic handler. Your job is narrow: briefly and kindly redirect clearly out-of-scope messages back to CarePland questions, appointment organization, bugs, ideas, workflow feedback, or support review. ${askUserFacingResponseRubric} If the message includes possible medical, emergency, legal, privacy, security, account-access, abuse, or data-loss risk, do not close it as harmless off-topic; mark it for human review. Do not shame the user. Do not continue the conversation unnecessarily. Return valid JSON exactly matching the schema.`;

const fallbackAskOnboardingHelperPrompt =
  `You are the CarePland Personal Ask onboarding helper. Answer low-risk getting-started questions about profile setup, Early Access acknowledgements, Care Circle setup, the first-run Home welcome guide, adding a first appointment, importing appointment details, and demo examples. For profile setup, explain that CarePland asks for basic account/contact details so dates, reminders, time zones, and support follow-up work correctly: first and last name, phone, time zone, and ZIP are required; display name and street address details are optional unless the app marks them otherwise. Keep this from sounding like a medical intake form. If the user says they are confused, lost, unsure what the welcome screen means, or asks what to do next, respond with gentle orientation: reassure them briefly, explain that CarePland helps carry important appointment context forward from one visit to the next, name a few examples such as what changed, what mattered, and what to ask next, then suggest the easiest next step: adding or importing a first appointment. Keep answers brief, calm, and practical. ${askUserFacingResponseRubric} Do not give medical, legal, privacy, account-security, billing, or emergency advice. Do not claim to change data. Escalate if the user appears blocked by account state, email update, authentication, profile saving, missing Care Circle setup, data loss, or frustration. Return valid JSON exactly matching the schema.`;

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

function cleanAction(value: unknown): AskRouterAction {
  return value === "answer_now" ||
    value === "ask_clarifying_question" ||
    value === "needs_human_review" ||
    value === "off_topic" ||
    value === "route_now"
    ? value
    : "needs_human_review";
}

function cleanCategory(value: unknown) {
  return value === "support_question" ||
    value === "bug_report" ||
    value === "feature_request" ||
    value === "workflow_feedback" ||
    value === "account_or_access_issue" ||
    value === "unclear_or_needs_human_review" ||
    value === "off_topic"
    ? value
    : "unclear_or_needs_human_review";
}

function cleanConfidence(value: unknown) {
  return Math.max(0, Math.min(1, Number(value ?? 0)));
}

function safeObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeActionObjects(value: unknown): JsonObject[] {
  return safeArray(value).filter(
    (item): item is JsonObject =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
}

function normalizeAskMessage(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isLikelyOnboardingAsk({
  context,
  currentPage,
  message,
  transcript,
}: {
  context: JsonObject;
  currentPage: string;
  message: string;
  transcript: string;
}) {
  const haystack = normalizeAskMessage(
    [currentPage, message, transcript, JSON.stringify(context)].join(" ")
  );

  return [
    "welcome",
    "onboarding",
    "getting started",
    "get started",
    "first appointment",
    "first-run",
    "first run",
    "demo data",
    "examples",
    "early access acknowledgement",
    "early access acknowledgements",
    "profile setup",
    "phone",
    "zip",
    "zip code",
    "address",
    "time zone",
    "timezone",
    "care circle setup",
    "add appointment",
    "import appointment",
    "confused",
    "lost",
    "what do i do",
    "what is this",
    "what is this screen",
    "what should i do",
  ].some((keyword) => haystack.includes(keyword));
}

function transcriptFromMessages(
  messages: Array<{ author_role: string; message_body: string }>
) {
  return messages
    .map((message) => `${message.author_role}: ${message.message_body}`)
    .join("\n\n");
}

async function loadAskInstructionVersion(
  supabase: SupabaseClient,
  careCircleId: string | null,
  instructionKey: string
) {
  if (!careCircleId) {
    return null;
  }

  const { data: instructionSets, error: instructionSetError } = await supabase
    .from("ai_instruction_sets")
    .select("id,instruction_key,name,description")
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

  return rubricVersion?.system_prompt?.trim() || askUserFacingResponseRubric;
}

async function runAskJsonModule({
  careCircleId,
  fallbackPrompt,
  fallbackSchema,
  formatName,
  instructionKey,
  openAiApiKey,
  supabase,
  userPrompt,
}: {
  careCircleId: string | null;
  fallbackPrompt: string;
  fallbackSchema: JsonObject;
  formatName: string;
  instructionKey: string;
  openAiApiKey: string;
  supabase: SupabaseClient;
  userPrompt: string;
}): Promise<AskModuleRunResult> {
  const instructionVersion = await loadAskInstructionVersion(
    supabase,
    careCircleId,
    instructionKey
  );
  const schema =
    instructionVersion?.output_schema &&
    typeof instructionVersion.output_schema === "object" &&
    Object.keys(instructionVersion.output_schema).length > 0
      ? instructionVersion.output_schema
      : fallbackSchema;
  const systemPrompt = instructionVersion?.system_prompt ?? fallbackPrompt;
  const model = instructionVersion?.model ?? "gpt-4.1-mini";
  const promptVersion = instructionVersion
    ? `${instructionKey}:v${instructionVersion.version_number}`
    : `${instructionKey}:fallback`;
  const prompt = [
    instructionVersion?.user_prompt_template
      ? `Instruction template:\n${instructionVersion.user_prompt_template}`
      : "",
    userPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        { content: systemPrompt, role: "system" },
        { content: prompt, role: "user" },
      ],
      model,
      temperature: instructionVersion?.temperature ?? 0.2,
      text: {
        format: {
          name: formatName,
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
    throw new Error(String(apiError ?? `${instructionKey} failed.`));
  }

  const text = responseText(openAiJson);

  if (!text) {
    throw new Error(`${instructionKey} returned an empty response.`);
  }

  return {
    costEstimate: estimateOpenAiResponseCost(model, openAiJson),
    instructionVersion,
    model,
    openAiJson,
    openAiRequestId,
    parsed: JSON.parse(text) as JsonObject,
    promptVersion,
  };
}

async function logAskOperationCost({
  action,
  careCircleId,
  category,
  operationKey,
  operationLabel,
  run,
  sourceId,
  sourceTable,
  supabase,
  userId,
}: {
  action: string;
  careCircleId: string | null;
  category: string;
  operationKey: string;
  operationLabel: string;
  run: AskModuleRunResult;
  sourceId: string;
  sourceTable: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const { error } = await supabase.from("ai_operation_logs").insert({
    cached_input_tokens: run.costEstimate.usage.cachedInputTokens,
    care_circle_id: careCircleId,
    currency: run.costEstimate.currency,
    estimated_cost_usd: run.costEstimate.estimatedCostUsd,
    input_tokens: run.costEstimate.usage.inputTokens,
    metadata: {
      ask_action: action,
      ask_category: category,
      prompt_version: run.promptVersion,
    },
    model: run.model,
    operation_key: operationKey,
    operation_label: operationLabel,
    output_tokens: run.costEstimate.usage.outputTokens,
    pricing_snapshot: run.costEstimate.pricingSnapshot,
    prompt_version: run.promptVersion,
    provider: "openai",
    provider_request_id: run.openAiRequestId,
    provider_response_id:
      typeof run.openAiJson.id === "string" ? run.openAiJson.id : null,
    source_id: sourceId,
    source_table: sourceTable,
    total_tokens: run.costEstimate.usage.totalTokens,
    usage_snapshot: run.openAiJson.usage ?? {},
    user_id: userId,
  });

  if (error) {
    console.error(`Failed to log ${operationKey} AI operation cost`, error);
  }
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
      throw new Error("Please sign in before using Ask.");
    }

    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const threadId =
      typeof body.threadId === "string" ? body.threadId.trim() : "";
    const currentPage =
      typeof body.currentPage === "string" ? body.currentPage.trim() : "";
    const context = safeObject(body.context);

    if (!message) {
      throw new Error("Add a question, idea, or detail before using Ask.");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("Please sign in before using Ask.");
    }

    const normalizedMessage = normalizeAskMessage(message);
    const recentDuplicateCutoff = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: recentSubmissions, error: duplicateCheckError } =
      await supabase
        .from("ask_submissions")
        .select("id,original_user_wording,created_at")
        .eq("user_id", userId)
        .gte("created_at", recentDuplicateCutoff)
        .order("created_at", { ascending: false })
        .limit(50);

    if (duplicateCheckError) {
      throw duplicateCheckError;
    }

    const duplicateSubmission = recentSubmissions?.find(
      (submission) =>
        normalizeAskMessage(String(submission.original_user_wording ?? "")) ===
        normalizedMessage
    );

    if (duplicateSubmission) {
      return NextResponse.json({
        action: "duplicate_submission",
        assistantMessage: "Thanks — we got your question!",
        category: "unclear_or_needs_human_review",
        confidence: 1,
        duplicate: true,
        recommendedActions: [],
        riskFlags: {},
        submissionId: duplicateSubmission.id,
        threadId: threadId || null,
      });
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

    const { data: settingsRows, error: settingsError } = await supabase
      .from("ask_routing_settings")
      .select(
        "auto_route_enabled,auto_create_min_confidence,clarify_default_max_turns,clarify_absolute_max_turns"
      )
      .eq("settings_key", "default")
      .limit(1);

    if (settingsError) {
      throw settingsError;
    }

    const settings = settingsRows?.[0] ?? {
      auto_create_min_confidence: 0.9,
      auto_route_enabled: false,
      clarify_absolute_max_turns: 5,
      clarify_default_max_turns: 3,
    };

    let askThread:
      | {
          clarifying_turn_count: number;
          clarifying_turn_limit: number;
          id: string;
          status: string;
        }
      | null = null;

    if (threadId) {
      const { data: existingThread, error: threadError } = await supabase
        .from("ask_threads")
        .select("id,status,clarifying_turn_count,clarifying_turn_limit")
        .eq("id", threadId)
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (threadError) {
        throw threadError;
      }

      if (!existingThread) {
        throw new Error("Ask conversation not found.");
      }

      askThread = existingThread;
    } else {
      const { data: newThread, error: createThreadError } = await supabase
        .from("ask_threads")
        .insert({
          care_circle_id: careCircleId,
          clarifying_turn_limit: settings.clarify_default_max_turns,
          context,
          current_page: currentPage || null,
          source: "in_app_ask",
          user_id: userId,
        })
        .select("id,status,clarifying_turn_count,clarifying_turn_limit")
        .single();

      if (createThreadError) {
        throw createThreadError;
      }

      askThread = newThread;
    }

    const { error: messageError } = await supabase.from("ask_messages").insert({
      author_role: "user",
      author_user_id: userId,
      message_body: message,
      metadata: { current_page: currentPage || null },
      thread_id: askThread.id,
    });

    if (messageError) {
      throw messageError;
    }

    const { data: messages, error: messagesError } = await supabase
      .from("ask_messages")
      .select("author_role,message_body,created_at")
      .eq("thread_id", askThread.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    const conversation = (messages ?? []) as Array<{
      author_role: string;
      message_body: string;
    }>;
    const transcript = transcriptFromMessages(conversation);

    const userPrompt = [
      `Current page: ${currentPage || "unknown"}`,
      `Routing settings:\n${JSON.stringify(settings, null, 2)}`,
      `Thread state:\n${JSON.stringify(
        {
          clarifying_turn_count: askThread.clarifying_turn_count,
          clarifying_turn_limit: askThread.clarifying_turn_limit,
          status: askThread.status,
        },
        null,
        2
      )}`,
      `App context:\n${JSON.stringify(context, null, 2)}`,
      "Product context:\nCarePland Personal helps people remember appointment details, prepare for future visits, and bring saved context forward. New users complete profile basics, Early Access acknowledgements, Care Circle setup, and a Home welcome guide before regular app use. Ask has a separate onboarding helper module for low-risk getting-started questions. Ask is intended for questions, ideas, workflow feedback, bugs, confusing moments, and things that may need review. Do not deny being AI or pretend to be human, but keep AI framing in the background unless the user asks or it matters for trust/review. If a user asks what you are, it is okay to say you are an AI assistant designed to help route questions, feedback, and ideas throughout CarePland, and that you are not a replacement for real people.",
      `Response rubric:\n${responseRubric}`,
      `Ask transcript:\n${transcript}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const routerRun = await runAskJsonModule({
      careCircleId,
      fallbackPrompt: fallbackAskRouterPrompt,
      fallbackSchema: askRouterSchema,
      formatName: "carepland_ask_router",
      instructionKey: "ask_router",
      openAiApiKey,
      supabase,
      userPrompt,
    });
    const parsed = routerRun.parsed;
    let action = cleanAction(parsed.action);
    const category = cleanCategory(parsed.primary_category);
    const confidence = cleanConfidence(parsed.confidence);
    let recommendedActions = safeActionObjects(parsed.recommended_actions);
    const riskFlags = safeObject(parsed.risk_flags);
    const rationale = String(parsed.rationale ?? "").trim();
    const aiSummary = String(parsed.brief_summary ?? "").trim();
    const clarifyingQuestion = String(parsed.clarifying_question ?? "").trim();
    let assistantResponse = String(parsed.assistant_response ?? "").trim();
    const clarifyingLimit = Math.min(
      askThread.clarifying_turn_limit,
      settings.clarify_absolute_max_turns
    );
    const clarifyingLimitReached =
      askThread.clarifying_turn_count >= clarifyingLimit;
    let clarifierRun: AskModuleRunResult | null = null;
    let offTopicRun: AskModuleRunResult | null = null;
    let onboardingRun: AskModuleRunResult | null = null;
    let interpreterRun: AskModuleRunResult | null = null;

    if (action === "ask_clarifying_question" && clarifyingLimitReached) {
      action = "needs_human_review";
      assistantResponse =
        aiSummary.length > 0
          ? `Current understanding: ${aiSummary}. If that does not capture it right, feel free to add a bit more before this is sent for review.`
          : "There is enough here to send for review. If that does not capture it right, feel free to add a bit more.";
    }

    if (action === "ask_clarifying_question" && !clarifyingLimitReached) {
      try {
        clarifierRun = await runAskJsonModule({
          careCircleId,
          fallbackPrompt: fallbackAskClarifierPrompt,
          fallbackSchema: askClarifierSchema,
          formatName: "carepland_ask_clarifier",
          instructionKey: "ask_clarifier",
          openAiApiKey,
          supabase,
          userPrompt: [
            `Current page: ${currentPage || "unknown"}`,
            `Clarifying settings:\n${JSON.stringify(
              {
                clarifying_turn_count: askThread.clarifying_turn_count,
                clarifying_turn_limit: askThread.clarifying_turn_limit,
                effective_limit: clarifyingLimit,
              },
              null,
              2
            )}`,
            `Router decision:\n${JSON.stringify(
              {
                action,
                ai_summary: aiSummary,
                category,
                confidence,
                proposed_clarifying_question: clarifyingQuestion,
                rationale,
                risk_flags: riskFlags,
              },
              null,
              2
            )}`,
            `App context:\n${JSON.stringify(context, null, 2)}`,
            "Product context:\nCarePland Personal helps people remember appointment details, prepare for future visits, and bring saved context forward. New users complete profile basics, Early Access acknowledgements, Care Circle setup, and then see a first-run welcome guide on Home. Ask should feel like open dialogue, not a ticketing system.",
            `Response rubric:\n${responseRubric}`,
            `Ask transcript:\n${transcript}`,
          ].join("\n\n"),
        });

        const clarifierShouldAsk = Boolean(
          clarifierRun.parsed.should_ask_question
        );
        const clarifierSummary = String(
          clarifierRun.parsed.understanding_summary ?? ""
        ).trim();

        if (!clarifierShouldAsk) {
          action = "needs_human_review";
          assistantResponse =
            clarifierSummary.length > 0
              ? `Current understanding: ${clarifierSummary}. If that does not capture it right, feel free to add a bit more before this is sent for review.`
              : "There is enough here to send for review. If that does not capture it right, feel free to add a bit more.";
        }
      } catch (error) {
        console.error("Ask clarifier failed; falling back to router question", error);
      }
    }

    if (action === "ask_clarifying_question") {
      const outgoingQuestion =
        String(clarifierRun?.parsed.clarifying_question ?? "").trim() ||
        clarifyingQuestion ||
        assistantResponse ||
        "Can you add one more detail so this can be routed correctly?";
      const clarifierConfidence = cleanConfidence(
        clarifierRun?.parsed.confidence ?? confidence
      );
      const clarifierRationale =
        String(clarifierRun?.parsed.stop_reason ?? "").trim() || rationale;

      const { error: assistantMessageError } = await supabase
        .from("ask_messages")
        .insert({
          author_role: "assistant",
          message_body: outgoingQuestion,
          metadata: {
            action,
            category,
            confidence: clarifierConfidence,
            prompt_version: clarifierRun?.promptVersion ?? routerRun.promptVersion,
            rationale: clarifierRationale,
            router_prompt_version: routerRun.promptVersion,
          },
          thread_id: askThread.id,
        });

      if (assistantMessageError) {
        throw assistantMessageError;
      }

      const { error: updateThreadError } = await supabase
        .from("ask_threads")
        .update({
          clarifying_turn_count: askThread.clarifying_turn_count + 1,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", askThread.id);

      if (updateThreadError) {
        throw updateThreadError;
      }

      await logAskOperationCost({
        action,
        careCircleId,
        category,
        operationKey: "ask_router",
        operationLabel: "Ask router",
        run: routerRun,
        sourceId: askThread.id,
        sourceTable: "ask_threads",
        supabase,
        userId,
      });

      if (clarifierRun) {
        await logAskOperationCost({
          action,
          careCircleId,
          category,
          operationKey: "ask_clarifier",
          operationLabel: "Ask clarifier",
          run: clarifierRun,
          sourceId: askThread.id,
          sourceTable: "ask_threads",
          supabase,
          userId,
        });
      }

      return NextResponse.json({
        action,
        assistantMessage: outgoingQuestion,
        category,
        confidence: clarifierConfidence,
        recommendedActions,
        riskFlags,
        submissionId: null,
        threadId: askThread.id,
      });
    }

    if (action === "off_topic" || category === "off_topic") {
      try {
        offTopicRun = await runAskJsonModule({
          careCircleId,
          fallbackPrompt: fallbackAskOffTopicHandlerPrompt,
          fallbackSchema: askOffTopicHandlerSchema,
          formatName: "carepland_ask_off_topic_handler",
          instructionKey: "ask_off_topic_handler",
          openAiApiKey,
          supabase,
          userPrompt: [
            `Current page: ${currentPage || "unknown"}`,
            `Router decision:\n${JSON.stringify(
              {
                action,
                ai_summary: aiSummary,
                category,
                confidence,
                rationale,
                risk_flags: riskFlags,
              },
              null,
              2
            )}`,
            `App context:\n${JSON.stringify(context, null, 2)}`,
            "Product context:\nCarePland Ask is for questions, ideas, workflow feedback, bugs, confusing moments, and things that may need support/admin review.",
            `Ask transcript:\n${transcript}`,
          ].join("\n\n"),
        });

        const offTopicShouldClose = Boolean(offTopicRun.parsed.should_close);
        const offTopicResponse = String(
          offTopicRun.parsed.user_response ?? ""
        ).trim();
        const offTopicReviewReason = String(
          offTopicRun.parsed.review_reason ?? ""
        ).trim();

        if (offTopicResponse) {
          assistantResponse = offTopicResponse;
        }

        if (!offTopicShouldClose) {
          action = "needs_human_review";
          recommendedActions = [
            {
              action: "needs_human_review",
              category: "unclear_or_needs_human_review",
              confidence: cleanConfidence(offTopicRun.parsed.confidence),
              priority: "medium",
              rationale:
                offTopicReviewReason ||
                "Off-topic handler found this should be reviewed rather than closed.",
              title: "Review off-topic or risky Ask message",
            },
          ];
        }
      } catch (error) {
        console.error(
          "Ask off-topic handler failed; falling back to router output",
          error
        );
      }
    }

    const shouldRunOnboardingHelper =
      action !== "off_topic" &&
      (category === "support_question" ||
        category === "unclear_or_needs_human_review") &&
      isLikelyOnboardingAsk({ context, currentPage, message, transcript });

    if (shouldRunOnboardingHelper) {
      try {
        onboardingRun = await runAskJsonModule({
          careCircleId,
          fallbackPrompt: fallbackAskOnboardingHelperPrompt,
          fallbackSchema: askOnboardingHelperSchema,
          formatName: "carepland_ask_onboarding_helper",
          instructionKey: "ask_onboarding_helper",
          openAiApiKey,
          supabase,
          userPrompt: [
            `Current page: ${currentPage || "unknown"}`,
            `Router decision:\n${JSON.stringify(
              {
                action,
                ai_summary: aiSummary,
                category,
                confidence,
                rationale,
                risk_flags: riskFlags,
              },
              null,
              2
            )}`,
            `App context:\n${JSON.stringify(context, null, 2)}`,
            "Onboarding facts:\nNew users complete profile basics, Early Access acknowledgements, Care Circle setup, and then land on Home with the first-run welcome guide. Profile setup asks for basic account/contact details so dates, reminders, time zones, and support follow-up work correctly. First and last name, phone, time zone, and ZIP are required; display name and street address details are optional unless the app marks them otherwise. The welcome guide explains the appointment loop, keeps first actions focused, and may hide normal header navigation while still offering a Need help link that opens Ask. First useful actions are adding a real appointment, importing appointment details the user already has, or adding clearly labeled fictional demo examples. Demo examples can be removed later from Profile. Account-specific onboarding blockers should be reviewed by support/admin.",
            `Response rubric:\n${responseRubric}`,
            `Ask transcript:\n${transcript}`,
          ].join("\n\n"),
        });

        const onboardingAnswer = String(
          onboardingRun.parsed.answer ?? ""
        ).trim();
        const onboardingEscalates = Boolean(
          onboardingRun.parsed.escalation_recommended
        );
        const onboardingActions = safeActionObjects(
          onboardingRun.parsed.recommended_actions
        );

        if (onboardingAnswer) {
          assistantResponse = onboardingAnswer;
        }

        if (onboardingEscalates) {
          action = "needs_human_review";
          recommendedActions =
            onboardingActions.length > 0
              ? onboardingActions
              : [
                  {
                    action: "create_support_ticket",
                    category: "support_question",
                    confidence: cleanConfidence(
                      onboardingRun.parsed.confidence
                    ),
                    priority: "medium",
                    rationale:
                      String(
                        onboardingRun.parsed.escalation_reason ?? ""
                      ).trim() || "Onboarding helper recommended review.",
                    title: "Review onboarding help request",
                  },
                ];
        } else {
          action = "answer_now";
          recommendedActions = [];
        }
      } catch (error) {
        console.error(
          "Ask onboarding helper failed; falling back to router output",
          error
        );
      }
    }

    let interpreterError = "";
    const shouldInterpretForReview =
      action === "route_now" || action === "needs_human_review";
    const interpreterConfig =
      category === "feature_request" || category === "workflow_feedback"
        ? {
            fallbackPrompt: fallbackAskFeatureInterpreterPrompt,
            fallbackSchema: askFeatureInterpreterSchema,
            formatName: "carepland_ask_feature_interpreter",
            instructionKey: "ask_feature_interpreter",
          }
        : category === "bug_report"
          ? {
              fallbackPrompt: fallbackAskBugInterpreterPrompt,
              fallbackSchema: askBugInterpreterSchema,
              formatName: "carepland_ask_bug_interpreter",
              instructionKey: "ask_bug_interpreter",
            }
          : null;

    if (shouldInterpretForReview && interpreterConfig) {
      try {
        interpreterRun = await runAskJsonModule({
          careCircleId,
          fallbackPrompt: interpreterConfig.fallbackPrompt,
          fallbackSchema: interpreterConfig.fallbackSchema,
          formatName: interpreterConfig.formatName,
          instructionKey: interpreterConfig.instructionKey,
          openAiApiKey,
          supabase,
          userPrompt: [
            `Current page: ${currentPage || "unknown"}`,
            `Router decision:\n${JSON.stringify(
              {
                action,
                ai_summary: aiSummary,
                category,
                confidence,
                rationale,
                recommended_actions: recommendedActions,
                risk_flags: riskFlags,
              },
              null,
              2
            )}`,
            `App context:\n${JSON.stringify(context, null, 2)}`,
            "Product context:\nCarePland Personal helps people remember appointment details, prepare for future visits, and bring saved context forward. Ask intake should preserve original user language while creating structured Admin review data.",
            `Ask transcript:\n${transcript}`,
          ].join("\n\n"),
        });

        const interpretedActions = safeActionObjects(
          interpreterRun.parsed.recommended_actions
        );

        if (interpretedActions.length > 0) {
          recommendedActions = interpretedActions;
        }
      } catch (error) {
        interpreterError = errorMessage(error);
        console.error("Ask interpreter failed; falling back to router output", error);
      }
    }

    const terminalMessage =
      assistantResponse ||
      (action === "answer_now"
        ? "This can be answered here."
        : "Thanks. I saved this for review.");

    const { error: terminalMessageError } = await supabase
      .from("ask_messages")
      .insert({
        author_role: "assistant",
        message_body: terminalMessage,
        metadata: {
            action,
            category,
            confidence,
            prompt_version: routerRun.promptVersion,
            rationale,
          },
          thread_id: askThread.id,
      });

    if (terminalMessageError) {
      throw terminalMessageError;
    }

    const finalTranscript = transcriptFromMessages([
      ...conversation,
      { author_role: "assistant", message_body: terminalMessage },
    ]);
    const routingState = action === "answer_now" || action === "off_topic"
      ? "closed"
      : "needs_review";

    const { data: submission, error: submissionError } = await supabase
      .from("ask_submissions")
      .insert({
        care_circle_id: careCircleId,
        context,
        current_page: currentPage || null,
        instruction_version_id: routerRun.instructionVersion?.id ?? null,
        model: routerRun.model,
        original_user_wording: message,
        prompt_version: routerRun.promptVersion,
        raw_response: {
          clarifier: clarifierRun?.parsed ?? null,
          interpreter: interpreterRun?.parsed ?? null,
          interpreter_error: interpreterError || null,
          onboarding_helper: onboardingRun?.parsed ?? null,
          off_topic_handler: offTopicRun?.parsed ?? null,
          router: parsed,
        },
        recommended_actions: recommendedActions,
        router_category: category,
        router_confidence: confidence,
        router_rationale: rationale,
        routing_state: routingState,
        safety_flags: riskFlags,
        source: "in_app_ask",
        thread_id: askThread.id,
        transcript: finalTranscript,
        ai_summary: aiSummary,
        user_id: userId,
      })
      .select("id")
      .single();

    if (submissionError) {
      throw submissionError;
    }

    const { error: costLogError } = await supabase
      .from("ai_operation_logs")
      .insert({
        cached_input_tokens: routerRun.costEstimate.usage.cachedInputTokens,
        care_circle_id: careCircleId,
        currency: routerRun.costEstimate.currency,
        estimated_cost_usd: routerRun.costEstimate.estimatedCostUsd,
        input_tokens: routerRun.costEstimate.usage.inputTokens,
        metadata: {
          ask_action: action,
          ask_category: category,
          prompt_version: routerRun.promptVersion,
        },
        model: routerRun.model,
        operation_key: "ask_router",
        operation_label: "Ask router",
        output_tokens: routerRun.costEstimate.usage.outputTokens,
        pricing_snapshot: routerRun.costEstimate.pricingSnapshot,
        prompt_version: routerRun.promptVersion,
        provider: "openai",
        provider_request_id: routerRun.openAiRequestId,
        provider_response_id:
          typeof routerRun.openAiJson.id === "string"
            ? routerRun.openAiJson.id
            : null,
        source_id: submission.id,
        source_table: "ask_submissions",
        total_tokens: routerRun.costEstimate.usage.totalTokens,
        usage_snapshot: routerRun.openAiJson.usage ?? {},
        user_id: userId,
      });

    if (costLogError) {
      console.error("Failed to log Ask AI operation cost", costLogError);
    }

    if (clarifierRun) {
      await logAskOperationCost({
        action,
        careCircleId,
        category,
        operationKey: "ask_clarifier",
        operationLabel: "Ask clarifier",
        run: clarifierRun,
        sourceId: submission.id,
        sourceTable: "ask_submissions",
        supabase,
        userId,
      });
    }

    if (offTopicRun) {
      await logAskOperationCost({
        action,
        careCircleId,
        category,
        operationKey: "ask_off_topic_handler",
        operationLabel: "Ask off-topic handler",
        run: offTopicRun,
        sourceId: submission.id,
        sourceTable: "ask_submissions",
        supabase,
        userId,
      });
    }

    if (onboardingRun) {
      await logAskOperationCost({
        action,
        careCircleId,
        category,
        operationKey: "ask_onboarding_helper",
        operationLabel: "Ask onboarding helper",
        run: onboardingRun,
        sourceId: submission.id,
        sourceTable: "ask_submissions",
        supabase,
        userId,
      });
    }

    if (interpreterRun) {
      const { error: interpreterCostLogError } = await supabase
        .from("ai_operation_logs")
        .insert({
          cached_input_tokens:
            interpreterRun.costEstimate.usage.cachedInputTokens,
          care_circle_id: careCircleId,
          currency: interpreterRun.costEstimate.currency,
          estimated_cost_usd: interpreterRun.costEstimate.estimatedCostUsd,
          input_tokens: interpreterRun.costEstimate.usage.inputTokens,
          metadata: {
            ask_action: action,
            ask_category: category,
            prompt_version: interpreterRun.promptVersion,
          },
          model: interpreterRun.model,
          operation_key:
            category === "bug_report"
              ? "ask_bug_interpreter"
              : "ask_feature_interpreter",
          operation_label:
            category === "bug_report"
              ? "Ask bug interpreter"
              : "Ask feature interpreter",
          output_tokens: interpreterRun.costEstimate.usage.outputTokens,
          pricing_snapshot: interpreterRun.costEstimate.pricingSnapshot,
          prompt_version: interpreterRun.promptVersion,
          provider: "openai",
          provider_request_id: interpreterRun.openAiRequestId,
          provider_response_id:
            typeof interpreterRun.openAiJson.id === "string"
              ? interpreterRun.openAiJson.id
              : null,
          source_id: submission.id,
          source_table: "ask_submissions",
          total_tokens: interpreterRun.costEstimate.usage.totalTokens,
          usage_snapshot: interpreterRun.openAiJson.usage ?? {},
          user_id: userId,
        });

      if (interpreterCostLogError) {
        console.error(
          "Failed to log Ask interpreter AI operation cost",
          interpreterCostLogError
        );
      }
    }

    const { error: updateThreadError } = await supabase
      .from("ask_threads")
      .update({
        clarifying_stop_reason:
          action === "answer_now"
            ? "resolved"
            : action === "off_topic"
              ? "off_topic"
              : "ready_to_route",
        status: action === "answer_now" || action === "off_topic"
          ? "closed"
          : "needs_review",
        updated_at: new Date().toISOString(),
      })
      .eq("id", askThread.id);

    if (updateThreadError) {
      throw updateThreadError;
    }

    return NextResponse.json({
      action,
      assistantMessage: terminalMessage,
      category,
      confidence,
      recommendedActions,
      riskFlags,
      submissionId: submission.id,
      threadId: askThread.id,
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
