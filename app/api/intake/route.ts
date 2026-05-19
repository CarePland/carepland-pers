import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type JsonObject = Record<string, unknown>;
type IntakeMode = "bulk_appointments" | "single";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

const defaultTextIntakeOutputSchema = {
  additionalProperties: false,
  properties: {
    appointment_reason: { type: "string" },
    appointment_title: { type: "string" },
    confidence: { type: "number" },
    followups: { items: { type: "string" }, type: "array" },
    location_address: { type: "string" },
    location_name: { type: "string" },
    location_phone: { type: "string" },
    notes_summary: { type: "string" },
    provider_name: { type: "string" },
    provider_organization: { type: "string" },
    starts_at_local: { type: "string" },
    suggested_action: { type: "string" },
    takeaways: { items: { type: "string" }, type: "array" },
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
    "notes_summary",
    "takeaways",
    "followups",
    "confidence",
    "suggested_action",
  ],
  type: "object",
};

const fallbackTextIntakeSystemPrompt =
  "You interpret pasted appointment-related text for CarePland Personal. Use only supplied text. Extract a reviewable draft for an appointment and optional notes. Extract provider_name, provider_organization, location_name, location_address, and location_phone only when directly supported by the text. If existing appointment context is supplied, use it as the target appointment context and focus on extracting visit notes, takeaways, and follow-ups from the pasted text. If a value is unknown, return an empty string or empty array. starts_at_local must be suitable for an HTML datetime-local input as YYYY-MM-DDTHH:mm when a date/time is explicit; otherwise return an empty string. Do not invent dates, providers, locations, or outcomes.";

const defaultBulkAppointmentOutputSchema = {
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
          provider_name: { type: "string" },
          provider_organization: { type: "string" },
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
          "confidence",
          "suggested_action",
        ],
        type: "object",
      },
      maxItems: 10,
      type: "array",
    },
    import_summary: { type: "string" },
  },
  required: ["appointments", "import_summary"],
  type: "object",
};

const fallbackBulkAppointmentSystemPrompt =
  "You extract appointment drafts from pasted text for CarePland Personal. Use only supplied text. Return up to 10 appointments. Each appointment must be a real appointment-like item with a title and any supported date/time, provider, practice, location, address, phone, and reason. starts_at_local must be suitable for an HTML datetime-local input as YYYY-MM-DDTHH:mm when a date/time is explicit; otherwise return an empty string. Do not create visit notes, takeaways, follow-ups, diagnoses, outcomes, or CarePrep. Do not invent dates, providers, locations, addresses, or phone numbers. Confidence must be a number from 0 to 1 for each appointment: 0.8-1.0 when title plus explicit date/time and at least one supporting detail are clear; 0.5-0.79 when the appointment is likely but one important detail is missing or inferred; 0.01-0.49 when the item may be an appointment but needs careful review; use 0 only when confidence cannot be assessed. If text contains more than 10 appointments, return the first 10 in chronological or source order and mention the limit in import_summary.";

function instructionKeyForMode(mode: IntakeMode): string {
  return mode === "bulk_appointments"
    ? "bulk_appointment_intake"
    : "note_intake_interpretation";
}

function defaultSchemaForMode(mode: IntakeMode) {
  return mode === "bulk_appointments"
    ? defaultBulkAppointmentOutputSchema
    : defaultTextIntakeOutputSchema;
}

function fallbackPromptForMode(mode: IntakeMode): string {
  return mode === "bulk_appointments"
    ? fallbackBulkAppointmentSystemPrompt
    : fallbackTextIntakeSystemPrompt;
}

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
      throw new Error("Please sign in before using intake.");
    }

    const body = await request.json();
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";
    const mode: IntakeMode =
      body.mode === "bulk_appointments" ? "bulk_appointments" : "single";
    const requestedCareSubjectId =
      typeof body.careSubjectId === "string" ? body.careSubjectId : "";
    const appointmentContext =
      body.appointmentContext &&
      typeof body.appointmentContext === "object" &&
      !Array.isArray(body.appointmentContext)
        ? (body.appointmentContext as JsonObject)
        : null;

    if (!rawText) {
      throw new Error("Paste some text before running intake.");
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
      throw new Error("Please sign in before using intake.");
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
      throw new Error("Choose an active Care VIP before using intake.");
    }

    const { data: intakeItem, error: intakeError } = await supabase
      .from("intake_items")
      .insert({
        care_circle_id: careCircleId,
        care_subject_id: careSubject.id,
        created_by_user_id: userId,
        raw_text: rawText,
        source_type: "paste_text",
        status: "processing",
      })
      .select("id")
      .single();

    if (intakeError) {
      throw intakeError;
    }

    intakeItemId = intakeItem.id;

    const { data: instructionSets, error: instructionSetError } = await supabase
      .from("ai_instruction_sets")
      .select("id,instruction_key,name,description")
      .eq("care_circle_id", careCircleId)
      .eq("instruction_key", instructionKeyForMode(mode))
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
        : defaultSchemaForMode(mode);
    const systemPrompt = instructionVersion?.system_prompt ?? fallbackPromptForMode(mode);
    const userPrompt = [
      instructionVersion?.user_prompt_template
        ? `Instruction template:\n${instructionVersion.user_prompt_template}`
        : "",
      `Care VIP: ${careSubject.display_name}`,
      `Current date: ${new Date().toISOString()}`,
      appointmentContext
        ? `Existing appointment context:\n${JSON.stringify(
            appointmentContext,
            null,
            2
          )}`
        : "",
      `Pasted text:\n${rawText}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const model = instructionVersion?.model ?? "gpt-4.1-mini";
    const promptVersion = instructionVersion
      ? `${instructionKeyForMode(mode)}:v${instructionVersion.version_number}`
      : `${instructionKeyForMode(mode)}:fallback`;

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: systemPrompt,
            role: "system",
          },
          {
            content: userPrompt,
            role: "user",
          },
        ],
        model,
        temperature: instructionVersion?.temperature ?? 0.1,
        text: {
          format: {
            name:
              mode === "bulk_appointments"
                ? "carepland_bulk_appointments"
                : "carepland_text_intake",
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
      throw new Error(String(apiError ?? "Text intake interpretation failed."));
    }

    const text = responseText(openAiJson);

    if (!text) {
      throw new Error("OpenAI returned an empty intake response.");
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
      instruction_content_hash: instructionVersion?.content_hash ?? null,
      instruction_set_id: instructionSet?.id ?? null,
      instruction_version_id: instructionVersion?.id ?? null,
      model,
      prompt_version: promptVersion,
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
