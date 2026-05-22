import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type JsonObject = Record<string, unknown>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

const supportAssistantSchema = {
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    category: { type: "string" },
    confidence: { type: "number" },
    escalation_recommended: { type: "boolean" },
    escalation_reason: { type: "string" },
    priority: { enum: ["low", "medium", "high", "urgent"], type: "string" },
    suggested_next_step: { type: "string" },
  },
  required: [
    "answer",
    "suggested_next_step",
    "confidence",
    "escalation_recommended",
    "escalation_reason",
    "category",
    "priority",
  ],
  type: "object",
};

const fallbackSupportAssistantPrompt =
  "You are the CarePland Personal support assistant for a beta web app. Answer only low-risk app-use questions using the supplied product context. Be concise, warm, and practical. Explain CarePland in plain product language: it helps people remember appointment details, prepare for future visits, and bring useful context forward from what they have saved. Do not describe features as AI-generated or talk about internal models. Do not give medical, legal, billing, privacy, account-security, or emergency advice. Do not claim to change data or perform actions. If the question is unclear, account-specific, bug-like, billing/privacy/security-related, data-changing, or the user sounds frustrated, recommend escalation to support. Return valid JSON matching the schema.";
const defaultAgentKnowledge = {
  support_agent_escalation_guidance:
    "Escalate bugs, account access issues, data loss, billing/privacy/security concerns, emergency or medical advice requests, data-changing requests, unclear issues, and frustrated users.",
  support_agent_known_limitations:
    "Calendar sync is not live yet. SMS/text notifications are not live yet. Favorite location management is basic. Google Places autocomplete can be temporarily unavailable if quota or key restrictions block requests.",
  support_agent_product_facts:
    "CarePland Personal helps people remember appointment details, prepare for future visits, and bring saved context forward. Users can add appointments manually, import appointments from pasted text, images, and .ics calendar files, search Google Places for clinics/businesses/addresses, save favorite locations with nicknames, generate CarePrep for upcoming appointments, add notes to logged appointments, and ask support questions in the app.",
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

function cleanPriority(value: unknown) {
  return value === "low" || value === "medium" || value === "high" || value === "urgent"
    ? value
    : "medium";
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
      throw new Error("Please sign in before asking for help.");
    }

    const body = await request.json();
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const currentPage = typeof body.currentPage === "string" ? body.currentPage.trim() : "";
    const context =
      body.context && typeof body.context === "object" && !Array.isArray(body.context)
        ? (body.context as JsonObject)
        : {};

    if (!subject || !message) {
      throw new Error("Add a short subject and a few details before asking the assistant.");
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
      throw new Error("Please sign in before asking for help.");
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("care_circle_memberships")
      .select("care_circle_id")
      .limit(1);

    if (membershipsError) {
      throw membershipsError;
    }

    const careCircleId = memberships?.[0]?.care_circle_id ?? null;

    const { data: instructionSets, error: instructionSetError } = await supabase
      .from("ai_instruction_sets")
      .select("id,instruction_key,name,description")
      .eq("care_circle_id", careCircleId)
      .eq("instruction_key", "support_assistant")
      .eq("is_active", true)
      .limit(1);

    if (instructionSetError) {
      throw instructionSetError;
    }

    const instructionSet = instructionSets?.[0] ?? null;
    const { data: instructionVersions, error: instructionVersionError } =
      instructionSet
        ? await supabase
            .from("ai_instruction_versions")
            .select(
              "id,version_number,system_prompt,user_prompt_template,output_schema,model,temperature,content_hash"
            )
            .eq("instruction_set_id", instructionSet.id)
            .eq("is_current", true)
            .limit(1)
        : { data: [], error: null };

    if (instructionVersionError) {
      throw instructionVersionError;
    }

    const instructionVersion = instructionVersions?.[0] ?? null;
    const schema =
      instructionVersion?.output_schema &&
      typeof instructionVersion.output_schema === "object"
        ? instructionVersion.output_schema
        : supportAssistantSchema;
    const systemPrompt =
      instructionVersion?.system_prompt ?? fallbackSupportAssistantPrompt;
    const model = instructionVersion?.model ?? "gpt-4.1-mini";
    const promptVersion = instructionVersion
      ? `support_assistant:v${instructionVersion.version_number}`
      : "support_assistant:fallback";

    const agentKnowledgeKeys = Object.keys(defaultAgentKnowledge);
    const { data: agentKnowledgeRows, error: agentKnowledgeError } =
      await supabase
        .from("app_content_versions")
        .select("content_key,body")
        .in("content_key", agentKnowledgeKeys)
        .eq("is_current", true);

    if (agentKnowledgeError) {
      throw agentKnowledgeError;
    }

    const agentKnowledgeByKey = new Map(
      (agentKnowledgeRows ?? []).map((row) => [row.content_key, row.body])
    );

    const productContext = [
      "CarePland Personal is a beta appointment memory app.",
      `Current product facts: ${
        agentKnowledgeByKey.get("support_agent_product_facts") ??
        defaultAgentKnowledge.support_agent_product_facts
      }`,
      `Known limitations: ${
        agentKnowledgeByKey.get("support_agent_known_limitations") ??
        defaultAgentKnowledge.support_agent_known_limitations
      }`,
      `Escalation guidance: ${
        agentKnowledgeByKey.get("support_agent_escalation_guidance") ??
        defaultAgentKnowledge.support_agent_escalation_guidance
      }`,
      "Core areas: Home, Appointments, Upcoming, Logged, Archived, Import, appointment notes, CarePrep, Profile, demo data, support questions.",
      "Demo data can be removed from Profile with the Remove demo data control.",
      "Archived appointments are read-only and can be restored from the Archived tab.",
      "Import can interpret pasted text, images, or reviewed calendar file events into appointment drafts, but users should review before saving.",
      "Google Places lookup can help autocomplete addresses and save favorite locations with nicknames.",
      "The product goal is to close the loop between appointments: capture what happened, remember what matters, and bring the right context forward next time.",
      "Do not describe CarePland features as AI-generated or mention internal models to users.",
      "If the user reports a bug, data loss, account access issue, billing/privacy concern, or asks for a data-changing action, recommend escalation.",
    ].join("\n");

    const userPrompt = [
      instructionVersion?.user_prompt_template
        ? `Instruction template:\n${instructionVersion.user_prompt_template}`
        : "",
      `Current page: ${currentPage || "unknown"}`,
      `Product context:\n${productContext}`,
      `App context:\n${JSON.stringify(context, null, 2)}`,
      `User subject:\n${subject}`,
      `User details:\n${message}`,
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
            name: "carepland_support_assistant",
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

    if (!openAiResponse.ok) {
      const apiError =
        openAiJson.error && typeof openAiJson.error === "object"
          ? (openAiJson.error as JsonObject).message
          : null;
      throw new Error(String(apiError ?? "Support assistant failed."));
    }

    const text = responseText(openAiJson);

    if (!text) {
      throw new Error("The support assistant returned an empty response.");
    }

    const parsed = JSON.parse(text) as JsonObject;
    const answer = String(parsed.answer ?? "").trim();
    const suggestedNextStep = String(parsed.suggested_next_step ?? "").trim();
    const confidence = Math.max(
      0,
      Math.min(1, Number(parsed.confidence ?? 0))
    );
    const escalationRecommended = Boolean(parsed.escalation_recommended);
    const escalationReason = String(parsed.escalation_reason ?? "").trim();
    const category = String(parsed.category ?? "general").trim() || "general";
    const priority = cleanPriority(parsed.priority);

    if (!answer) {
      throw new Error("The support assistant did not provide an answer.");
    }

    const { data: interaction, error: interactionError } = await supabase
      .from("support_assistant_interactions")
      .insert({
        assistant_answer: answer,
        care_circle_id: careCircleId,
        category,
        confidence,
        context,
        current_page: currentPage || null,
        escalation_reason: escalationReason,
        escalation_recommended: escalationRecommended,
        instruction_version_id: instructionVersion?.id ?? null,
        model,
        priority,
        prompt_version: promptVersion,
        question_body: message,
        question_subject: subject,
        raw_response: parsed,
        suggested_next_step: suggestedNextStep,
        user_id: userId,
      })
      .select("id")
      .single();

    if (interactionError) {
      throw interactionError;
    }

    return NextResponse.json({
      answer,
      category,
      confidence,
      escalationRecommended,
      escalationReason,
      interactionId: interaction.id,
      priority,
      suggestedNextStep,
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
