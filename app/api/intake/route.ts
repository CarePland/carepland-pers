import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type JsonObject = Record<string, unknown>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

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
    const requestedCareSubjectId =
      typeof body.careSubjectId === "string" ? body.careSubjectId : "";

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

    const schema = {
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
    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content:
              "You interpret pasted appointment-related text for CarePland Personal. Use only supplied text. Extract a reviewable draft for an appointment and optional notes. Extract provider_name, provider_organization, location_name, location_address, and location_phone only when directly supported by the text. If a value is unknown, return an empty string or empty array. starts_at_local must be suitable for an HTML datetime-local input as YYYY-MM-DDTHH:mm when a date/time is explicit; otherwise return an empty string. Do not invent dates, providers, locations, or outcomes.",
            role: "system",
          },
          {
            content: `Care VIP: ${careSubject.display_name}\nCurrent date: ${new Date().toISOString()}\n\nPasted text:\n${rawText}`,
            role: "user",
          },
        ],
        model: "gpt-4.1-mini",
        temperature: 0.1,
        text: {
          format: {
            name: "carepland_text_intake",
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

    const { error: updateError } = await supabase
      .from("intake_items")
      .update({
        ai_interpretation: draft,
        interpretation: draft,
        processed_at: new Date().toISOString(),
        status: "processed",
      })
      .eq("id", intakeItem.id);

    if (updateError) {
      throw updateError;
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
