import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { normalizeImportAnythingAppointmentCandidates } from "@/app/lib/personal/importAnything/appointments";
import { normalizeImportAnythingDraft } from "@/app/lib/personal/importAnything/draft";
import { normalizeImportAnythingProviderCandidates } from "@/app/lib/personal/importAnything/providers";
import { normalizeImportAnythingRequest } from "@/app/lib/personal/importAnything/request";
import { logOpenAiOperationCost } from "@/app/lib/platform/ai/operationLogs";
import { openAiResponseText } from "@/app/lib/platform/ai/responses";

type JsonObject = Record<string, unknown>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

const importAnythingPersonAssignmentSchema = {
  additionalProperties: false,
  properties: {
    cluster_id: { type: "string" },
    confidence: { type: "number" },
    detected_name: { type: "string" },
    matched_care_subject_id: { type: "string" },
    needs_review: { type: "boolean" },
    rationale: { type: "string" },
    suggested_new_person_name: { type: "string" },
  },
  required: [
    "cluster_id",
    "detected_name",
    "matched_care_subject_id",
    "suggested_new_person_name",
    "confidence",
    "needs_review",
    "rationale",
  ],
  type: "object",
};

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
          matched_provider_id: { type: "string" },
          needs_review: { type: "boolean" },
          person_assignment: importAnythingPersonAssignmentSchema,
          provider_match_note: { type: "string" },
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
          "matched_provider_id",
          "person_assignment",
          "provider_match_note",
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
          person_assignment: importAnythingPersonAssignmentSchema,
          source_excerpt: { type: "string" },
        },
        required: [
          "appointment_title",
          "matched_appointment_id",
          "person_assignment",
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
    ownership_clusters: {
      items: {
        additionalProperties: false,
        properties: {
          cluster_id: { type: "string" },
          confidence: { type: "number" },
          display_name: { type: "string" },
          entity_type: { type: "string" },
          matched_care_subject_id: { type: "string" },
          rationale: { type: "string" },
          suggested_new_person_name: { type: "string" },
        },
        required: [
          "cluster_id",
          "display_name",
          "entity_type",
          "matched_care_subject_id",
          "suggested_new_person_name",
          "confidence",
          "rationale",
        ],
        type: "object",
      },
      maxItems: 12,
      type: "array",
    },
    medication_changes: {
      items: {
        additionalProperties: false,
        properties: {
          change_summary: { type: "string" },
          confidence: { type: "number" },
          instructions: { type: "string" },
          matched_appointment_id: { type: "string" },
          medication_name: { type: "string" },
          needs_review: { type: "boolean" },
          person_assignment: importAnythingPersonAssignmentSchema,
          source_excerpt: { type: "string" },
        },
        required: [
          "medication_name",
          "change_summary",
          "instructions",
          "matched_appointment_id",
          "person_assignment",
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
          appointment_reason: { type: "string" },
          appointment_title: { type: "string" },
          confidence: { type: "number" },
          followups: { items: { type: "string" }, type: "array" },
          location_address: { type: "string" },
          location_name: { type: "string" },
          location_phone: { type: "string" },
          matched_appointment_id: { type: "string" },
          needs_review: { type: "boolean" },
          person_assignment: importAnythingPersonAssignmentSchema,
          provider_name: { type: "string" },
          provider_organization: { type: "string" },
          source_excerpt: { type: "string" },
          starts_at_local: { type: "string" },
          summary: { type: "string" },
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
          "matched_appointment_id",
          "person_assignment",
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
          location_address: { type: "string" },
          location_name: { type: "string" },
          matched_provider_id: { type: "string" },
          needs_review: { type: "boolean" },
          person_assignment: importAnythingPersonAssignmentSchema,
          phone: { type: "string" },
          provider_match_note: { type: "string" },
          provider_name: { type: "string" },
          provider_organization: { type: "string" },
          source_excerpt: { type: "string" },
        },
        required: [
          "provider_name",
          "provider_organization",
          "location_address",
          "location_name",
          "phone",
          "matched_provider_id",
          "person_assignment",
          "provider_match_note",
          "confidence",
          "needs_review",
          "source_excerpt",
        ],
        type: "object",
      },
      maxItems: 12,
      type: "array",
    },
    person_assignment: importAnythingPersonAssignmentSchema,
    questions_to_ask: {
      items: {
        additionalProperties: false,
        properties: {
          confidence: { type: "number" },
          matched_appointment_id: { type: "string" },
          needs_review: { type: "boolean" },
          person_assignment: importAnythingPersonAssignmentSchema,
          question: { type: "string" },
          source_excerpt: { type: "string" },
          topic: { type: "string" },
        },
        required: [
          "question",
          "topic",
          "matched_appointment_id",
          "person_assignment",
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
          matched_appointment_id: { type: "string" },
          needs_review: { type: "boolean" },
          person_assignment: importAnythingPersonAssignmentSchema,
          source_excerpt: { type: "string" },
          title: { type: "string" },
        },
        required: [
          "title",
          "details",
          "due_at_local",
          "matched_appointment_id",
          "person_assignment",
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
    "ownership_clusters",
    "appointments",
    "providers",
    "person_assignment",
    "notes",
    "tasks",
    "medication_changes",
    "questions_to_ask",
    "careprep_items",
  ],
  type: "object",
};

const importAnythingSystemPrompt =
  "You analyze healthcare-related import content for CarePland Personal. The user may provide screenshots, OCR text, PDFs represented by source notes, copied portal text, reminders, instructions, or visit documents. Use only the supplied text. Do not invent facts. Before assigning ownership to individual findings, first identify all distinct people/entities referenced in ownership_clusters. The source may contain multiple people or pets. Each cluster needs a stable cluster_id such as cluster_rob_robson, display_name, entity_type such as person or cat, and matching details if it maps to an existing Care VIP. Do not create ownership clusters from sender signatures, message authors, reminder senders, or sign-offs such as '-Emily' unless the text also says that person is the patient or visit owner. Then identify appointments, providers, locations, medications or medication changes, visit notes, follow-up instructions, questions to ask, tasks/reminders, and CarePrep-relevant information. A currently focused Care VIP may be supplied as context only; do not treat it as mandatory ownership. Set the top-level person_assignment to the best overall batch clue, but every extracted item must include its own person_assignment that refers to one ownership cluster by cluster_id. Do not use the highest-confidence overall person as a fallback owner for unrelated findings. For each item person_assignment, set matched_care_subject_id only when that specific item is supported by the text or strong local context. If an item names a person who is not an existing candidate, put that name in suggested_new_person_name. If an item's ownership confidence is below 0.85 or ambiguous, leave cluster_id and matched_care_subject_id empty, set needs_review true, and prefer Unassigned over assigning to the wrong person. For Practice and Location lines, put the clinic/practice/business name in location_name and put street/city/state text in location_address. If only Practice is named, use it as provider_organization and location_name; do not copy a street address into location_name. Import summary should be qualitative and must not include numeric counts; the UI calculates counts separately. When existing appointment candidates are supplied, set matched_appointment_id only if the match is high confidence and directly supported by the text. If visit notes describe a real visit but do not match an existing appointment, keep the note item, leave matched_appointment_id empty, set needs_review true, and include any directly supported appointment_title, appointment_reason, starts_at_local, provider, practice, and location fields so the user can approve creating the missing appointment. When saved provider candidates are supplied, set matched_provider_id only if the import text clearly appears to refer to that saved provider for the same inferred or matched Care VIP; add a short provider_match_note explaining the clue. If uncertain, leave matched ids empty and set needs_review true. Existing manually entered records must not be changed by this workflow. Every item should be safe for user review before commit.";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Something went wrong.");
}

function isProviderStoreUnavailable(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  const message = maybeError?.message?.toLowerCase() ?? "";

  return (
    maybeError?.code === "42P01" ||
    maybeError?.code === "42703" ||
    message.includes("care_providers")
  );
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

    const { rawText, requestedCareSubjectId, sourceSummaries } =
      normalizeImportAnythingRequest(await request.json());

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

    const { data: careSubjects, error: careSubjectsError } = await supabase
      .from("care_subjects")
      .select("id,display_name,is_default")
      .eq("care_circle_id", careCircleId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("display_name", { ascending: true });

    if (careSubjectsError) {
      throw careSubjectsError;
    }

    const requestedCareSubject =
      careSubjects?.find((subject) => subject.id === requestedCareSubjectId) ??
      null;

    const { data: appointments, error: appointmentsError } = await supabase
      .from("appointments")
      .select(
        "id,care_subject_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone,current_note_id"
      )
      .eq("care_circle_id", careCircleId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(60);

    if (appointmentsError) {
      throw appointmentsError;
    }

    const appointmentCandidates =
      normalizeImportAnythingAppointmentCandidates(appointments);
    const { data: savedProviders, error: savedProvidersError } = await supabase
      .from("care_providers")
      .select(
        "id,care_subject_id,provider_name,provider_organization,nickname,location_name,location_address,phone"
      )
      .eq("care_circle_id", careCircleId)
      .order("updated_at", { ascending: false })
      .limit(30);

    if (savedProvidersError && !isProviderStoreUnavailable(savedProvidersError)) {
      throw savedProvidersError;
    }

    const providerCandidates = savedProvidersError
      ? []
      : normalizeImportAnythingProviderCandidates(savedProviders);

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
        care_subject_id: requestedCareSubject?.id ?? null,
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
      careSubjects && careSubjects.length > 0
        ? `Existing Care VIP candidates:\n${JSON.stringify(
            careSubjects.map((subject) => ({
              id: subject.id,
              display_name: subject.display_name,
              is_default: Boolean(subject.is_default),
            })),
            null,
            2
          )}`
        : "Existing Care VIP candidates: none",
      requestedCareSubject
        ? `Current focus hint: ${requestedCareSubject.display_name} (${requestedCareSubject.id}). Use only as a hint, not as mandatory ownership.`
        : "Current focus hint: Everyone or no person selected.",
      `Current date: ${new Date().toISOString()}`,
      appointmentCandidates.length > 0
        ? `Existing appointment candidates:\n${JSON.stringify(
            appointmentCandidates,
            null,
            2
          )}`
        : "Existing appointment candidates: none",
      providerCandidates.length > 0
        ? `Saved provider candidates across Care VIPs:\n${JSON.stringify(
            providerCandidates,
            null,
            2
          )}\nUse these only as matching/refinement context. Do not invent a saved provider match. Do not merge providers across Care VIPs.`
        : "Saved provider candidates: none",
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

    const text = openAiResponseText(openAiJson);

    if (!text) {
      throw new Error("OpenAI returned an empty Import Anything response.");
    }

    const draft = normalizeImportAnythingDraft(JSON.parse(text), {
      allowedMatchedAppointmentIds: appointmentCandidates.map(
        (appointment) => appointment.id
      ),
      allowedMatchedCareSubjectIds:
        careSubjects?.map((subject) => subject.id) ?? [],
      allowedMatchedProviderIds: providerCandidates.map(
        (provider) => provider.id
      ),
    });
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
        care_subject_id: requestedCareSubject?.id ?? null,
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
      careSubjectId: requestedCareSubject?.id ?? null,
      draft,
      intakeItemId: intakeItem.id,
      personAssignment:
        draft.person_assignment &&
        typeof draft.person_assignment === "object" &&
        !Array.isArray(draft.person_assignment)
          ? draft.person_assignment
          : null,
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
