import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type JsonObject = Record<string, unknown>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

const analysisSchema = {
  additionalProperties: false,
  properties: {
    analysis_summary: { type: "string" },
    failure_patterns: { items: { type: "string" }, type: "array" },
    prompt_recommendations: { items: { type: "string" }, type: "array" },
    recommendations: { items: { type: "string" }, type: "array" },
    strengths: { items: { type: "string" }, type: "array" },
    ui_recommendations: { items: { type: "string" }, type: "array" },
  },
  required: [
    "analysis_summary",
    "failure_patterns",
    "strengths",
    "recommendations",
    "prompt_recommendations",
    "ui_recommendations",
  ],
  type: "object",
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

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
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
      throw new Error("Please sign in before analyzing assistant answers.");
    }

    const body = await request.json();
    const interactionIds = Array.isArray(body.interactionIds)
      ? body.interactionIds.map(String).filter(Boolean)
      : [];
    const criteria =
      body.criteria && typeof body.criteria === "object" && !Array.isArray(body.criteria)
        ? (body.criteria as JsonObject)
        : {};

    if (interactionIds.length === 0) {
      throw new Error("Choose at least one assistant answer before analyzing.");
    }

    if (interactionIds.length > 50) {
      throw new Error("Analyze 50 or fewer assistant answers at a time.");
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
      throw new Error("Please sign in before analyzing assistant answers.");
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
      throw new Error("Admin access is required to analyze assistant answers.");
    }

    const { data: interactions, error: interactionsError } = await supabase
      .from("support_assistant_interactions")
      .select(
        "id,question_subject,question_body,assistant_answer,suggested_next_step,confidence,escalation_recommended,escalation_reason,category,priority,outcome,user_feedback,current_page,context,instruction_version_id,prompt_version,model,created_at,ticket_id"
      )
      .in("id", interactionIds);

    if (interactionsError) {
      throw interactionsError;
    }

    if (!interactions || interactions.length === 0) {
      throw new Error("No matching assistant answers were found.");
    }

    const promptVersionIds = Array.from(
      new Set(
        interactions
          .map((interaction) => interaction.instruction_version_id)
          .filter(Boolean)
      )
    );

    const { data: instructionVersions, error: instructionVersionsError } =
      promptVersionIds.length > 0
        ? await supabase
            .from("ai_instruction_versions")
            .select(
              "id,version_number,system_prompt,user_prompt_template,model,temperature,content_hash,created_at"
            )
            .in("id", promptVersionIds)
        : { data: [], error: null };

    if (instructionVersionsError) {
      throw instructionVersionsError;
    }

    const promptVersions = Array.from(
      new Set(
        interactions.map(
          (interaction) => interaction.prompt_version || "Unknown prompt"
        )
      )
    );

    const systemPrompt = [
      "You are an admin QA analyst for CarePland Personal support assistant outputs.",
      "Analyze whether the assistant answers were useful, accurate for app usage, appropriately escalated, and aligned with CarePland's product philosophy.",
      "CarePland should be described as helping people remember appointment details, prepare for future visits, and bring saved context forward. Avoid recommending user-facing language that exposes internal AI machinery.",
      "Use the prompt versions supplied with the rows. If multiple prompt versions are included, call out that conclusions may differ by prompt version.",
      "Do not invent facts. Base recommendations only on supplied interactions, user feedback, tickets, and prompt data.",
      "Return valid JSON exactly matching the schema.",
    ].join("\n");

    const userPrompt = [
      `Selected criteria:\n${JSON.stringify(criteria, null, 2)}`,
      `Prompt versions represented:\n${JSON.stringify(promptVersions, null, 2)}`,
      `Instruction prompt details:\n${JSON.stringify(instructionVersions ?? [], null, 2)}`,
      `Assistant interactions:\n${JSON.stringify(interactions, null, 2)}`,
    ].join("\n\n");

    const model = "gpt-4.1-mini";
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          { content: systemPrompt, role: "system" },
          { content: userPrompt, role: "user" },
        ],
        model,
        temperature: 0.2,
        text: {
          format: {
            name: "carepland_support_assistant_qa_analysis",
            schema: analysisSchema,
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
      throw new Error(String(apiError ?? "Assistant QA analysis failed."));
    }

    const text = responseText(openAiJson);

    if (!text) {
      throw new Error("Assistant QA analysis returned an empty response.");
    }

    const parsed = JSON.parse(text) as JsonObject;
    const analysisSummary = String(parsed.analysis_summary ?? "").trim();

    if (!analysisSummary) {
      throw new Error("Assistant QA analysis did not provide a summary.");
    }

    const { data: run, error: runError } = await supabase
      .from("support_assistant_analysis_runs")
      .insert({
        analysis_summary: analysisSummary,
        criteria,
        failure_patterns: stringArray(parsed.failure_patterns),
        interaction_count: interactions.length,
        interaction_ids: interactions.map((interaction) => interaction.id),
        model,
        prompt_recommendations: stringArray(parsed.prompt_recommendations),
        prompt_versions: promptVersions,
        raw_output: parsed,
        recommendations: stringArray(parsed.recommendations),
        requested_by_user_id: userId,
        strengths: stringArray(parsed.strengths),
        ui_recommendations: stringArray(parsed.ui_recommendations),
      })
      .select("id")
      .single();

    if (runError) {
      throw runError;
    }

    return NextResponse.json({
      id: run.id,
      analysisSummary,
      failurePatterns: stringArray(parsed.failure_patterns),
      promptRecommendations: stringArray(parsed.prompt_recommendations),
      recommendations: stringArray(parsed.recommendations),
      strengths: stringArray(parsed.strengths),
      uiRecommendations: stringArray(parsed.ui_recommendations),
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
