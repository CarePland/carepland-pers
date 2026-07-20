import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { logOpenAiOperationCost } from "@/app/lib/platform/ai/operationLogs";

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

// Ask's native bulk QA analysis -- mirrors /api/support-assistant-analysis's
// shape (same model, same schema, same cost-logging call) but reads
// ask_submissions plus their ask_submission_reviews (the human quality
// verdicts from the unified admin workspace) instead of the legacy
// interactions table, and writes to ask_analysis_runs. Reviews are
// included in the prompt so a run can surface patterns the admins have
// already flagged, not just what the model infers cold from transcripts.
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
      throw new Error("Please sign in before analyzing Ask answers.");
    }

    const body = await request.json();
    const submissionIds = Array.isArray(body.submissionIds)
      ? body.submissionIds.map(String).filter(Boolean)
      : [];
    const criteria =
      body.criteria && typeof body.criteria === "object" && !Array.isArray(body.criteria)
        ? (body.criteria as JsonObject)
        : {};

    if (submissionIds.length === 0) {
      throw new Error("Choose at least one Ask answer before analyzing.");
    }

    if (submissionIds.length > 50) {
      throw new Error("Analyze 50 or fewer Ask answers at a time.");
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
      throw new Error("Please sign in before analyzing Ask answers.");
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
      throw new Error("Admin access is required to analyze Ask answers.");
    }

    const { data: submissions, error: submissionsError } = await supabase
      .from("ask_submissions")
      .select(
        "id,thread_id,transcript,original_user_wording,ai_summary,router_category,router_confidence,router_rationale,recommended_actions,safety_flags,routing_state,current_page,context,instruction_version_id,prompt_version,model,created_at"
      )
      .in("id", submissionIds);

    if (submissionsError) {
      throw submissionsError;
    }

    if (!submissions || submissions.length === 0) {
      throw new Error("No matching Ask answers were found.");
    }

    const { data: reviewRows, error: reviewsError } = await supabase
      .from("ask_submission_reviews")
      .select("ask_submission_id,answer_quality,improvement_category,admin_note,recommended_action,created_at")
      .in("ask_submission_id", submissionIds)
      .order("created_at", { ascending: true });

    if (reviewsError) {
      throw reviewsError;
    }

    const promptVersionIds = Array.from(
      new Set(submissions.map((submission) => submission.instruction_version_id).filter(Boolean))
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
      new Set(submissions.map((submission) => submission.prompt_version || "Unknown prompt"))
    );

    const systemPrompt = [
      "You are an admin QA analyst for CarePland's Ask conversation system.",
      "Analyze whether the AI's routing/answers were useful, accurate for app usage, appropriately escalated to a human when needed, and aligned with CarePland's product philosophy of reducing caregiver cognitive load.",
      "CarePland should be described as helping people remember appointment details, prepare for future visits, and bring saved context forward. Avoid recommending user-facing language that exposes internal AI machinery.",
      "Admin review verdicts (answer_quality, improvement_category) are supplied where available -- treat these as ground truth human judgments, not something to second-guess, and use them to sharpen failure_patterns and recommendations rather than re-deriving quality from the transcript alone.",
      "Use the prompt versions supplied with the rows. If multiple prompt versions are included, call out that conclusions may differ by prompt version.",
      "Do not invent facts. Base recommendations only on the supplied submissions, reviews, and prompt data.",
      "Return valid JSON exactly matching the schema.",
    ].join("\n");

    const reviewsBySubmission = new Map<string, JsonObject[]>();
    (reviewRows ?? []).forEach((review) => {
      const list = reviewsBySubmission.get(review.ask_submission_id) ?? [];
      list.push(review);
      reviewsBySubmission.set(review.ask_submission_id, list);
    });

    const submissionsWithReviews = submissions.map((submission) => ({
      ...submission,
      admin_reviews: reviewsBySubmission.get(submission.id) ?? [],
    }));

    const userPrompt = [
      `Selected criteria:\n${JSON.stringify(criteria, null, 2)}`,
      `Prompt versions represented:\n${JSON.stringify(promptVersions, null, 2)}`,
      `Instruction prompt details:\n${JSON.stringify(instructionVersions ?? [], null, 2)}`,
      `Ask submissions with admin reviews:\n${JSON.stringify(submissionsWithReviews, null, 2)}`,
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
            name: "carepland_ask_qa_analysis",
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
      throw new Error(String(apiError ?? "Ask QA analysis failed."));
    }

    const text = responseText(openAiJson);

    if (!text) {
      throw new Error("Ask QA analysis returned an empty response.");
    }

    const parsed = JSON.parse(text) as JsonObject;
    const analysisSummary = String(parsed.analysis_summary ?? "").trim();

    if (!analysisSummary) {
      throw new Error("Ask QA analysis did not provide a summary.");
    }

    // ask_analysis_runs stores one representative prompt_version/
    // instruction_version_id, not an array (unlike the legacy table) --
    // only set them when every analyzed submission agrees, since a mixed
    // batch has no single "the" prompt version.
    const singlePromptVersion = promptVersions.length === 1 ? promptVersions[0] : null;
    const singleInstructionVersionId =
      promptVersionIds.length === 1 ? String(promptVersionIds[0]) : null;

    const { data: run, error: runError } = await supabase
      .from("ask_analysis_runs")
      .insert({
        admin_status: "new",
        analysis_summary: analysisSummary,
        ask_submission_ids: submissions.map((submission) => submission.id),
        completed_at: new Date().toISOString(),
        criteria,
        failure_patterns: stringArray(parsed.failure_patterns),
        instruction_version_id: singleInstructionVersionId,
        model,
        prompt_recommendations: stringArray(parsed.prompt_recommendations),
        prompt_version: singlePromptVersion,
        raw_output: parsed,
        recommendations: stringArray(parsed.recommendations),
        requested_by_user_id: userId,
        strengths: stringArray(parsed.strengths),
        submission_count: submissions.length,
        ui_recommendations: stringArray(parsed.ui_recommendations),
      })
      .select("id")
      .single();

    if (runError) {
      throw runError;
    }

    await logOpenAiOperationCost({
      metadata: { submission_count: submissions.length },
      model,
      openAiJson,
      operationKey: "ask_analysis",
      operationLabel: "Ask QA analysis",
      promptVersion: "ask_analysis:v1",
      providerRequestId:
        openAiResponse.headers.get("x-request-id") ??
        openAiResponse.headers.get("openai-request-id"),
      sourceId: run.id,
      sourceTable: "ask_analysis_runs",
      supabase,
      userId,
    });

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
