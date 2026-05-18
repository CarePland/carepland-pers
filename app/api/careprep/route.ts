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

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && "text" in item) {
        return String(item.text);
      }

      return "";
    })
    .map((item) => item.trim())
    .filter(Boolean);
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

function normalizeCarePrepOutput(output: JsonObject) {
  return {
    bring_list: asTextList(output.bring_list),
    key_questions: asTextList(output.key_questions),
    med_review: asTextList(output.med_review),
    next_steps: asTextList(output.next_steps ?? output.next_steps_suggested),
    since_last_visit: asTextList(output.since_last_visit),
    summary: String(
      output.summary ?? output.summary_320 ?? output.pre_visit_summary ?? ""
    ).trim(),
    watchouts: asTextList(output.watchouts),
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
      throw new Error("Please sign in before generating CarePrep.");
    }

    const body = await request.json();
    const appointmentId =
      typeof body.appointmentId === "string" ? body.appointmentId : "";

    if (!appointmentId) {
      throw new Error("Missing appointment id.");
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
      throw new Error("Please sign in before generating CarePrep.");
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id,care_circle_id,care_subject_id,title,reason,starts_at,status")
      .eq("id", appointmentId)
      .single();

    if (appointmentError) {
      throw appointmentError;
    }

    if (!appointment.care_subject_id) {
      throw new Error("This appointment needs a Care VIP before CarePrep can run.");
    }

    const { data: membership, error: membershipError } = await supabase
      .from("care_circle_memberships")
      .select("care_circle_id")
      .eq("care_circle_id", appointment.care_circle_id)
      .limit(1);

    if (membershipError) {
      throw membershipError;
    }

    if (!membership || membership.length === 0) {
      throw new Error("You do not have access to this appointment.");
    }

    const { data: instructionSets, error: instructionSetError } = await supabase
      .from("ai_instruction_sets")
      .select("id,instruction_key,name,description")
      .eq("care_circle_id", appointment.care_circle_id)
      .eq("instruction_key", "careprep_generation")
      .eq("is_active", true)
      .limit(1);

    if (instructionSetError) {
      throw instructionSetError;
    }

    const instructionSet = instructionSets?.[0];

    if (!instructionSet) {
      throw new Error("Create a current CarePrep instruction set before generating.");
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

    const instructionVersion = instructionVersions?.[0];

    if (!instructionVersion) {
      throw new Error("Create a current CarePrep instruction version before generating.");
    }

    const { data: careSubject, error: careSubjectError } = await supabase
      .from("care_subjects")
      .select("id,display_name")
      .eq("id", appointment.care_subject_id)
      .single();

    if (careSubjectError) {
      throw careSubjectError;
    }

    const { data: currentNotes, error: currentNotesError } = await supabase
      .from("appointment_notes")
      .select("appointment_id,summary_short,takeaways,followups")
      .eq("appointment_id", appointment.id)
      .eq("is_current", true)
      .limit(1);

    if (currentNotesError) {
      throw currentNotesError;
    }

    let priorAppointmentsQuery = supabase
      .from("appointments")
      .select("id,title,reason,starts_at,status,care_subject_id")
      .eq("care_circle_id", appointment.care_circle_id)
      .eq("care_subject_id", appointment.care_subject_id)
      .neq("id", appointment.id)
      .neq("status", "archived")
      .order("starts_at", { ascending: false })
      .limit(8);

    if (appointment.starts_at) {
      priorAppointmentsQuery = priorAppointmentsQuery.lt(
        "starts_at",
        appointment.starts_at
      );
    }

    const { data: priorAppointments, error: priorAppointmentsError } =
      await priorAppointmentsQuery;

    if (priorAppointmentsError) {
      throw priorAppointmentsError;
    }

    const priorAppointmentRows = priorAppointments ?? [];
    const priorAppointmentIds = priorAppointmentRows.map(
      (priorAppointment) => priorAppointment.id
    );
    const { data: priorNotes, error: priorNotesError } =
      priorAppointmentIds.length > 0
        ? await supabase
            .from("appointment_notes")
            .select("appointment_id,summary_short,takeaways,followups")
            .in("appointment_id", priorAppointmentIds)
            .eq("is_current", true)
        : { data: [], error: null };

    if (priorNotesError) {
      throw priorNotesError;
    }

    const priorNoteRows = priorNotes ?? [];
    const futureAppointment = {
      ...appointment,
      care_vip_name: careSubject.display_name,
      current_note: currentNotes?.[0] ?? null,
    };
    const pastAppointments = priorAppointmentRows.map((priorAppointment) => ({
      ...priorAppointment,
      care_vip_name: careSubject.display_name,
      note:
        priorNoteRows.find(
          (note) => note.appointment_id === priorAppointment.id
        ) ?? null,
    }));
    const inputContextSnapshot = {
      future_appointment: futureAppointment,
      generator: "openai-responses",
      past_appointments: pastAppointments,
    };
    const schema =
      instructionVersion.output_schema &&
      typeof instructionVersion.output_schema === "object"
        ? instructionVersion.output_schema
        : {
            additionalProperties: false,
            properties: {
              bring_list: { items: { type: "string" }, type: "array" },
              key_questions: { items: { type: "string" }, type: "array" },
              summary: { type: "string" },
            },
            required: ["summary", "key_questions", "bring_list"],
            type: "object",
          };
    const userPrompt = [
      instructionVersion.user_prompt_template
        ? `Instruction template:\n${instructionVersion.user_prompt_template}`
        : "",
      `Future appointment:\n${JSON.stringify(futureAppointment, null, 2)}`,
      `Past appointments:\n${JSON.stringify(pastAppointments, null, 2)}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: instructionVersion.system_prompt,
            role: "system",
          },
          {
            content: userPrompt,
            role: "user",
          },
        ],
        model: instructionVersion.model ?? "gpt-4.1-mini",
        temperature: instructionVersion.temperature ?? 0.2,
        text: {
          format: {
            name: "careprep_generation",
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
      throw new Error(String(apiError ?? "OpenAI CarePrep generation failed."));
    }

    const text = responseText(openAiJson);

    if (!text) {
      throw new Error("OpenAI returned an empty CarePrep response.");
    }

    const parsedOutput = JSON.parse(text) as JsonObject;
    const guidance = normalizeCarePrepOutput(parsedOutput);

    if (!guidance.summary) {
      throw new Error("OpenAI returned CarePrep without a summary.");
    }

    const { data: existingGuidanceRows, error: existingGuidanceError } =
      await supabase
        .from("careprep_guidance")
        .select("id,version_number")
        .eq("appointment_id", appointment.id)
        .eq("is_current", true)
        .limit(1);

    if (existingGuidanceError) {
      throw existingGuidanceError;
    }

    const existingGuidance = existingGuidanceRows?.[0] ?? null;
    const promptVersion = `careprep_generation:v${instructionVersion.version_number}`;

    const { data: newGuidance, error: guidanceError } = await supabase
      .from("careprep_guidance")
      .insert({
        appointment_id: appointment.id,
        bring_list: guidance.bring_list,
        care_circle_id: appointment.care_circle_id,
        generated_at: new Date().toISOString(),
        input_context_snapshot: inputContextSnapshot,
        instruction_content_hash: instructionVersion.content_hash ?? null,
        instruction_set_id: instructionSet.id,
        instruction_version_id: instructionVersion.id,
        is_current: true,
        key_questions: guidance.key_questions,
        med_review: guidance.med_review,
        model: instructionVersion.model ?? "gpt-4.1-mini",
        next_steps: guidance.next_steps,
        prompt_version: promptVersion,
        since_last_visit: guidance.since_last_visit,
        status: "succeeded",
        summary: guidance.summary,
        user_id: userId,
        version_number: existingGuidance
          ? existingGuidance.version_number + 1
          : 1,
        watchouts: guidance.watchouts,
      })
      .select("id")
      .single();

    if (guidanceError) {
      throw guidanceError;
    }

    if (existingGuidance) {
      const { error: archiveError } = await supabase
        .from("careprep_guidance")
        .update({
          is_current: false,
          superseded_at: new Date().toISOString(),
          superseded_by_guidance_id: newGuidance.id,
        })
        .eq("id", existingGuidance.id);

      if (archiveError) {
        throw archiveError;
      }
    }

    return NextResponse.json({
      message: existingGuidance
        ? "CarePrep refreshed with AI. Previous version archived."
        : "CarePrep generated with AI.",
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
