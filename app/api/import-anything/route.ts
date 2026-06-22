import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { logOpenAiOperationCost } from "@/app/lib/platform/ai/operationLogs";

type JsonObject = Record<string, unknown>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

const importAnythingOutputSchema = {
  additionalProperties: false,
  properties: {
    appointments: {
      items: {
        additionalProperties: false,
        properties: {
          appointment_reason: { type: "string" },
          appointment_title: { type: "string" },
          confidence: { type: "number" },
          location_address: { type: "string" },
          location_name: { type: "string" },
          location_phone: { type: "string" },
          matched_appointment_id: { type: "string" },
          needs_review: { type: "boolean" },
          provider_name: { type: "string" },
          provider_organization: { type: "string" },
          source_excerpt: { type: "string" },
          starts_at_local: { type: "string" },
          suggested_action: { type: "string" },
        },
        required: [
          "appointment_title",
          "appointment_reason",
          "starts_at_local",
          "provider_name",
          "provider_organization",
          "location_name",
          "location_address",
          "location_phone",
          "matched_appointment_id",
          "suggested_action",
          "confidence",
          "needs_review",
          "source_excerpt",
        ],
        type: "object",
      },
      maxItems: 12,
      type: "array",
    },
    careprep_items: {
      items: {
        additionalProperties: false,
        properties: {
          appointment_title: { type: "string" },
          confidence: { type: "number" },
          detail: { type: "string" },
          matched_appointment_id: { type: "string" },
          needs_review: { type: "boolean" },
          source_excerpt: { type: "string" },
        },
        required: [
          "appointment_title",
          "matched_appointment_id",
          "detail",
          "confidence",
          "needs_review",
          "source_excerpt",
        ],
        type: "object",
      },
      maxItems: 12,
      type: "array",
    },
    import_summary: { type: "string" },
    medication_changes: {
      items: {
        additionalProperties: false,
        properties: {
          change_summary: { type: "string" },
          confidence: { type: "number" },
          instructions: { type: "string" },
          medication_name: { type: "string" },
          needs_review: { type: "boolean" },
          source_excerpt: { type: "string" },
        },
        required: [
          "medication_name",
          "change_summary",
          "instructions",
          "confidence",
          "needs_review",
          "source_excerpt",
        ],
        type: "object",
      },
      maxItems: 12,
      type: "array",
    },
    notes: {
      items: {
        additionalProperties: false,
        properties: {
          appointment_title: { type: "string" },
          confidence: { type: "number" },
          followups: { items: { type: "string" }, type: "array" },
          matched_appointment_id: { type: "string" },
          needs_review: { type: "boolean" },
          source_excerpt: { type: "string" },
          summary: { type: "string" },
          takeaways: { items: { type: "string" }, type: "array" },
        },
        required: [
          "appointment_title",
          "matched_appointment_id",
          "summary",
          "takeaways",
          "followups",
          "confidence",
          "needs_review",
          "source_excerpt",
        ],
        type: "object",
      },
      maxItems: 12,
      type: "array",
    },
    providers: {
      items: {
        additionalProperties: false,
        properties: {
          confidence: { type: "number" },
          location_name: { type: "string" },
          needs_review: { type: "boolean" },
          phone: { type: "string" },
          provider_name: { type: "string" },
          provider_organization: { type: "string" },
          source_excerpt: { type: "string" },
        },
        required: [
          "provider_name",
          "provider_organization",
          "location_name",
          "phone",
          "confidence",
          "needs_review",
          "source_excerpt",
        ],
        type: "object",
      },
      maxItems: 12,
      type: "array",
    },
    questions_to_ask: {
      items: {
        additionalProperties: false,
        properties: {
          confidence: { type: "number" },
          matched_appointment_id: { type: "string" },
          needs_review: { type: "boolean" },
          question: { type: "string" },
          source_excerpt: { type: "string" },
          topic: { type: "string" },
        },
        required: [
          "question",
          "topic",
          "matched_appointment_id",
          "confidence",
          "needs_review",
          "source_excerpt",
        ],
        type: "object",
      },
      maxItems: 12,
      type: "array",
    },
    tasks: {
      items: {
        additionalProperties: false,
        properties: {
          confidence: { type: "number" },
          details: { type: "string" },
          due_at_local: { type: "string" },
          needs_review: { type: "boolean" },
          source_excerpt: { type: "string" },
          title: { type: "string" },
        },
        required: [
          "title",
          "details",
          "due_at_local",
          "confidence",
          "needs_review",
          "source_excerpt",
        ],
        type: "object",
      },
      maxItems: 12,
      type: "array",
    },
  },
  required: [
    "import_summary",
    "appointments",
    "providers",
    "notes",
    "tasks",
    "medication_changes",
    "questions_to_ask",
    "careprep_items",
  ],
  type: "object",
};

const importAnythingSystemPrompt =
  "You analyze healthcare-related import content for CarePland Personal. The user may provide screenshots, OCR text, PDFs represented by source notes, copied portal text, reminders, instructions, or visit documents. Use only the supplied text. Identify appointments, providers, locations, medications or medication changes, visit notes, follow-up instructions, questions to ask, tasks/reminders, and CarePrep-relevant information. Do not invent facts. When existing appointment candidates are supplied, set matched_appointment_id only if the match is high confidence and directly supported by the text. If uncertain, leave matched_appointment_id empty and set needs_review true. Existing manually entered records must not be changed by this workflow. Every item should be safe for user review before commit.";

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

export async function POST(request: NextRequest) {
  let intakeItemId: string | null = null;

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
      throw new Error("Please sign in before using Import Anything.");
    }

    const body = await request.json();
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
    const requestedCareSubjectId =
      typeof body.careSubjectId === "string" ? body.careSubjectId : "";
    const sourceSummaries: string[] = Array.isArray(body.sourceSummaries)
      ? body.sourceSummaries
          .map((item: unknown) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : [];

    if (!rawText) {
      throw new Error("Add text or extracted file content before reviewing.");
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
      throw new Error("Please sign in before using Import Anything.");
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("care_circle_memberships")
      .select("care_circle_id")
      .limit(1);

    if (membershipsError) {
      throw membershipsError;
    }

    const careCircleId = memberships?.[0]?.care_circle_id;

    if (!careCircleId) {
      throw new Error("No care circle membership found for this user.");
    }

    let subjectQuery = supabase
      .from("care_subjects")
      .select("id,display_name,is_default")
      .eq("care_circle_id", careCircleId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("display_name", { ascending: true })
      .limit(1);

    if (requestedCareSubjectId) {
      subjectQuery = supabase
        .from("care_subjects")
        .select("id,display_name,is_default")
        .eq("care_circle_id", careCircleId)
        .eq("id", requestedCareSubjectId)
        .eq("is_active", true)
        .limit(1);
    }

    const { data: subjects, error: subjectsError } = await subjectQuery;

    if (subjectsError) {
      throw subjectsError;
    }

    const careSubject = subjects?.[0];

    if (!careSubject) {
      throw new Error("Choose an active Care VIP before using Import Anything.");
    }

    const { data: appointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select(
        "id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone,current_note_id"
      )
      .eq("care_circle_id", careCircleId)
      .eq("care_subject_id", careSubject.id)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(60);

    if (appointmentsError) {
      throw appointmentsError;
    }

    const rawTextWithSources = [
      sourceSummaries.length > 0
        ? `Source files:\n${sourceSummaries.map((source) => `- ${source}`).join("\n")}`
        : "",
      "[Import Anything]",
      rawText,
    ]
      .filter(Boolean)
      .join("\n\n");
    const { data: intakeItem, error: intakeError } = await supabase
      .from("intake_items")
      .insert({
        care_circle_id: careCircleId,
        care_subject_id: careSubject.id,
        created_by_user_id: userId,
        raw_text: rawTextWithSources,
        source_type: "paste_text",
        status: "processing",
      })
      .select("id")
      .single();

    if (intakeError) {
      throw intakeError;
    }

    intakeItemId = intakeItem.id;

    const userPrompt = [
      `Care VIP: ${careSubject.display_name}`,
      `Current date: ${new Date().toISOString()}`,
      appointments && appointments.length > 0
        ? `Existing appointment candidates:\n${JSON.stringify(
            appointments,
            null,
            2
          )}`
        : "Existing appointment candidates: none",
      `Import content:\n${rawTextWithSources}`,
    ].join("\n\n");
    const model = "gpt-4.1-mini";

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: importAnythingSystemPrompt,
            role: "system",
          },
          {
            content: userPrompt,
            role: "user",
          },
        ],
        model,
        temperature: 0.1,
        text: {
          format: {
            name: "carepland_import_anything",
            schema: importAnythingOutputSchema,
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
      throw new Error(String(apiError ?? "Import Anything review failed."));
    }

    const text = responseText(openAiJson);

    if (!text) {
      throw new Error("OpenAI returned an empty Import Anything response.");
    }

    const draft = JSON.parse(text) as JsonObject;
    const processedPayload = {
      ai_interpretation: draft,
      interpretation: draft,
      processed_at: new Date().toISOString(),
      status: "processed",
    };
    const processedPayloadWithAudit = {
      ...processedPayload,
      model,
      prompt_version: "import_anything:fallback",
    };

    const { error: updateError } = await supabase
      .from("intake_items")
      .update(processedPayloadWithAudit)
      .eq("id", intakeItem.id);

    if (updateError) {
      const missingAuditColumn =
        "code" in updateError && updateError.code === "42703";

      if (!missingAuditColumn) {
        throw updateError;
      }

      const { error: fallbackUpdateError } = await supabase
        .from("intake_items")
        .update(processedPayload)
        .eq("id", intakeItem.id);

      if (fallbackUpdateError) {
        throw fallbackUpdateError;
      }
    }

    await logOpenAiOperationCost({
      careCircleId,
      metadata: {
        care_subject_id: careSubject.id,
        source_count: sourceSummaries.length,
      },
      model,
      openAiJson,
      operationKey: "import_anything_intake",
      operationLabel: "Import Anything intake",
      promptVersion: "import_anything:fallback",
      providerRequestId:
        openAiResponse.headers.get("x-request-id") ??
        openAiResponse.headers.get("openai-request-id"),
      sourceId: intakeItem.id,
      sourceTable: "intake_items",
      supabase,
      userId,
    });

    return NextResponse.json({
      careSubjectId: careSubject.id,
      draft,
      intakeItemId: intakeItem.id,
    });
  } catch (error) {
    if (intakeItemId && supabaseUrl && supabaseAnonKey) {
      const authorization = request.headers.get("authorization") ?? "";
      const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      });

      await supabase
        .from("intake_items")
        .update({
          error_message: errorMessage(error),
          status: "failed",
        })
        .eq("id", intakeItemId);
    }

    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
