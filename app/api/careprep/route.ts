import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { recordCarePlandWorkEventBestEffort } from "@/app/lib/personal/workEvents";
import { logOpenAiOperationCost } from "@/app/lib/platform/ai/operationLogs";
import { assertAccountActive } from "@/app/lib/platform/server/accountStatus";

type JsonObject = Record<string, unknown>;
type AppContentFilter = {
  eq: (column: string, value: unknown) => AppContentFilter;
  limit: (
    count: number
  ) => Promise<{ data: Array<{ body: unknown }> | null; error: unknown }>;
};
type AppContentReader = {
  from: (table: string) => {
    select: (columns: string) => AppContentFilter;
  };
};
type ReviewAction =
  | "accept"
  | "discard"
  | "edit_current"
  | "generate"
  | "save_edit";
type GenerationMode =
  | "auto_after_notes"
  | "auto_appointments_page"
  | "auto_home"
  | "manual";

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

function jsonBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function jsonString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function appointmentLabel(appointment: { starts_at?: string | null; title?: string | null }) {
  const title = appointment.title?.trim() || "this appointment";

  if (!appointment.starts_at) {
    return title;
  }

  const date = new Date(appointment.starts_at);

  if (Number.isNaN(date.getTime())) {
    return title;
  }

  return `${title} on ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

async function currentAppContentText(
  supabase: AppContentReader,
  contentKey: string
) {
  const { data, error } = await supabase
    .from("app_content_versions")
    .select("body")
    .eq("content_key", contentKey)
    .eq("is_current", true)
    .limit(1);

  if (error) {
    return "";
  }

  return typeof data?.[0]?.body === "string" ? data[0].body.trim() : "";
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

function truncateIntro(value: unknown): string {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();

  return normalized.length > 180
    ? normalized.slice(0, 180).trimEnd()
    : normalized;
}

function limitedList(value: unknown, limit: number): string[] {
  return asTextList(value).slice(0, limit);
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
  const beforeVisit =
    output.beforeVisit ?? output.before_visit ?? output.bring_list;
  const duringVisit =
    output.duringVisit ?? output.during_visit ?? output.key_questions;

  return {
    bring_list: limitedList(beforeVisit, 3),
    key_questions: limitedList(duringVisit, 4),
    med_review: [],
    next_steps: [],
    since_last_visit: [],
    summary: truncateIntro(
      output.intro ??
        output.summary ??
        output.summary_320 ??
        output.pre_visit_summary
    ),
    watchouts: [],
  };
}

function carePrepPayload(output: JsonObject) {
  const guidance = normalizeCarePrepOutput(output);

  return {
    bring_list: guidance.bring_list,
    key_questions: guidance.key_questions,
    med_review: guidance.med_review,
    next_steps: guidance.next_steps,
    since_last_visit: guidance.since_last_visit,
    summary: guidance.summary,
    watchouts: guidance.watchouts,
  };
}

function hasUsefulCarePrep(
  guidance: ReturnType<typeof normalizeCarePrepOutput>
) {
  return Boolean(
    guidance.summary ||
      guidance.bring_list.length > 0 ||
      guidance.key_questions.length > 0
  );
}

function snapshotPastAppointmentCount(snapshot: unknown): number | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const pastAppointments = (snapshot as JsonObject).past_appointments;

  if (typeof (snapshot as JsonObject).past_appointment_total_count === "number") {
    return (snapshot as JsonObject).past_appointment_total_count as number;
  }

  return Array.isArray(pastAppointments) ? pastAppointments.length : null;
}

function latestSnapshotPriorNoteTime(snapshot: unknown): number | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const pastAppointments = (snapshot as JsonObject).past_appointments;

  if (!Array.isArray(pastAppointments)) {
    return null;
  }

  return pastAppointments.reduce<number | null>((latestTime, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return latestTime;
    }

    const note = (item as JsonObject).note;

    if (!note || typeof note !== "object" || Array.isArray(note)) {
      return latestTime;
    }

    const createdAt = (note as JsonObject).created_at;

    if (typeof createdAt !== "string") {
      return latestTime;
    }

    const time = new Date(createdAt).getTime();

    if (!Number.isFinite(time)) {
      return latestTime;
    }

    return latestTime === null || time > latestTime ? time : latestTime;
  }, null);
}

export async function POST(request: NextRequest) {
  let reservedMeteredFeature:
    | { careCircleId: string; featureKey: string; quantity: number }
    | null = null;
  let meteredFeatureFinalized = false;
  let meteringAccessToken = "";

  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase server configuration.");
    }

    if (!openAiApiKey) {
      throw new Error("Missing OPENAI_API_KEY in environment variables.");
    }

    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
    meteringAccessToken = accessToken;

    if (!accessToken) {
      throw new Error("Please sign in before generating CarePrep.");
    }

    const body = await request.json();
    const appointmentId =
      typeof body.appointmentId === "string" ? body.appointmentId : "";
    const action: ReviewAction =
      body.action === "accept" ||
      body.action === "discard" ||
      body.action === "edit_current" ||
      body.action === "save_edit"
        ? body.action
        : "generate";
    const generationMode: GenerationMode =
      body.generationMode === "auto_after_notes"
        ? "auto_after_notes"
        : body.generationMode === "auto_appointments_page"
          ? "auto_appointments_page"
        : body.generationMode === "auto_home"
          ? "auto_home"
          : "manual";

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

    await assertAccountActive(
      supabase,
      userId,
      "Please sign in before generating CarePrep."
    );

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

    if (action === "edit_current") {
      const currentGuidanceId =
        typeof body.currentGuidanceId === "string" ? body.currentGuidanceId : "";
      const editedGuidance =
        body.editedGuidance &&
        typeof body.editedGuidance === "object" &&
        !Array.isArray(body.editedGuidance)
          ? (body.editedGuidance as JsonObject)
          : null;

      if (!currentGuidanceId) {
        throw new Error("Missing current CarePrep id.");
      }

      if (!editedGuidance) {
        throw new Error("Missing edited CarePrep content.");
      }

      const { data: currentGuidance, error: currentGuidanceError } =
        await supabase
          .from("careprep_guidance")
          .select("*")
          .eq("id", currentGuidanceId)
          .eq("appointment_id", appointment.id)
          .eq("is_current", true)
          .single();

      if (currentGuidanceError) {
        throw currentGuidanceError;
      }

      const editedPayload = carePrepPayload(editedGuidance);

      if (!hasUsefulCarePrep(editedPayload)) {
        throw new Error("Edited CarePrep needs at least one useful preparation item.");
      }

      const { data: editedVersion, error: editedError } = await supabase
        .from("careprep_guidance")
        .insert({
          ...editedPayload,
          accepted_at: new Date().toISOString(),
          accepted_by_user_id: userId,
          ai_generated_guidance_id:
            currentGuidance.ai_generated_guidance_id ??
            (currentGuidance.source === "ai_generated" ? currentGuidance.id : null),
          appointment_id: appointment.id,
          care_circle_id: appointment.care_circle_id,
          edited_from_guidance_id: currentGuidance.id,
          generated_at: new Date().toISOString(),
          input_context_snapshot: currentGuidance.input_context_snapshot ?? {},
          instruction_content_hash:
            currentGuidance.instruction_content_hash ?? null,
          instruction_set_id: currentGuidance.instruction_set_id ?? null,
          instruction_version_id: currentGuidance.instruction_version_id ?? null,
          is_current: true,
          model: currentGuidance.model ?? null,
          prompt_version: currentGuidance.prompt_version ?? null,
          review_status: "accepted",
          reviewed_at: new Date().toISOString(),
          reviewed_by_user_id: userId,
          source: "user_edited",
          status: "succeeded",
          user_id: userId,
          version_number: currentGuidance.version_number + 1,
        })
        .select("id")
        .single();

      if (editedError) {
        throw editedError;
      }

      const { error: archiveError } = await supabase
        .from("careprep_guidance")
        .update({
          is_current: false,
          review_status: "superseded",
          superseded_at: new Date().toISOString(),
          superseded_by_guidance_id: editedVersion.id,
        })
        .eq("id", currentGuidance.id);

      if (archiveError) {
        throw archiveError;
      }

      return NextResponse.json({
        message: "CarePrep edit saved. Previous version archived.",
      });
    }

    if (action === "accept" || action === "discard" || action === "save_edit") {
      const draftGuidanceId =
        typeof body.draftGuidanceId === "string" ? body.draftGuidanceId : "";

      if (!draftGuidanceId) {
        throw new Error("Missing CarePrep draft id.");
      }

      const { data: draftGuidance, error: draftError } = await supabase
        .from("careprep_guidance")
        .select("*")
        .eq("id", draftGuidanceId)
        .eq("appointment_id", appointment.id)
        .eq("review_status", "draft")
        .single();

      if (draftError) {
        throw draftError;
      }

      if (action === "discard") {
        const { error: discardError } = await supabase
          .from("careprep_guidance")
          .update({
            review_status: "discarded",
            reviewed_at: new Date().toISOString(),
            reviewed_by_user_id: userId,
          })
          .eq("id", draftGuidance.id);

        if (discardError) {
          throw discardError;
        }

        return NextResponse.json({ message: "CarePrep draft discarded." });
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

      if (action === "accept") {
        const { error: acceptError } = await supabase
          .from("careprep_guidance")
          .update({
            is_current: true,
            review_status: "accepted",
            reviewed_at: new Date().toISOString(),
            reviewed_by_user_id: userId,
            version_number: existingGuidance
              ? existingGuidance.version_number + 1
              : 1,
          })
          .eq("id", draftGuidance.id);

        if (acceptError) {
          throw acceptError;
        }

        if (existingGuidance) {
          const { error: archiveError } = await supabase
            .from("careprep_guidance")
            .update({
              is_current: false,
              review_status: "superseded",
              superseded_at: new Date().toISOString(),
              superseded_by_guidance_id: draftGuidance.id,
            })
            .eq("id", existingGuidance.id);

          if (archiveError) {
            throw archiveError;
          }
        }

        return NextResponse.json({ message: "AI CarePrep accepted." });
      }

      const editedGuidance =
        body.editedGuidance &&
        typeof body.editedGuidance === "object" &&
        !Array.isArray(body.editedGuidance)
          ? (body.editedGuidance as JsonObject)
          : null;

      if (!editedGuidance) {
        throw new Error("Missing edited CarePrep content.");
      }

      const editedPayload = carePrepPayload(editedGuidance);

      if (!hasUsefulCarePrep(editedPayload)) {
        throw new Error("Edited CarePrep needs at least one useful preparation item.");
      }

      const { data: editedVersion, error: editedError } = await supabase
        .from("careprep_guidance")
        .insert({
          ...editedPayload,
          accepted_at: new Date().toISOString(),
          accepted_by_user_id: userId,
          ai_generated_guidance_id: draftGuidance.id,
          appointment_id: appointment.id,
          care_circle_id: appointment.care_circle_id,
          edited_from_guidance_id: draftGuidance.id,
          generated_at: new Date().toISOString(),
          input_context_snapshot: draftGuidance.input_context_snapshot ?? {},
          instruction_content_hash: draftGuidance.instruction_content_hash ?? null,
          instruction_set_id: draftGuidance.instruction_set_id ?? null,
          instruction_version_id: draftGuidance.instruction_version_id ?? null,
          is_current: true,
          model: draftGuidance.model ?? null,
          prompt_version: draftGuidance.prompt_version ?? null,
          review_status: "accepted",
          reviewed_at: new Date().toISOString(),
          reviewed_by_user_id: userId,
          source: "user_edited",
          status: "succeeded",
          user_id: userId,
          version_number: existingGuidance
            ? existingGuidance.version_number + 1
            : 1,
        })
        .select("id")
        .single();

      if (editedError) {
        throw editedError;
      }

      const { error: draftArchiveError } = await supabase
        .from("careprep_guidance")
        .update({
          review_status: "accepted_with_edits",
          reviewed_at: new Date().toISOString(),
          reviewed_by_user_id: userId,
          superseded_at: new Date().toISOString(),
          superseded_by_guidance_id: editedVersion.id,
        })
        .eq("id", draftGuidance.id);

      if (draftArchiveError) {
        throw draftArchiveError;
      }

      if (existingGuidance) {
        const { error: archiveError } = await supabase
          .from("careprep_guidance")
          .update({
            is_current: false,
            review_status: "superseded",
            superseded_at: new Date().toISOString(),
            superseded_by_guidance_id: editedVersion.id,
          })
          .eq("id", existingGuidance.id);

        if (archiveError) {
          throw archiveError;
        }
      }

      return NextResponse.json({
        message: "Edited CarePrep saved. AI draft preserved.",
      });
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

    let priorAppointmentsCountQuery = supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("care_circle_id", appointment.care_circle_id)
      .eq("care_subject_id", appointment.care_subject_id)
      .neq("id", appointment.id)
      .neq("status", "archived");

    if (appointment.starts_at) {
      priorAppointmentsCountQuery = priorAppointmentsCountQuery.lt(
        "starts_at",
        appointment.starts_at
      );
    }

    const {
      count: priorAppointmentTotalCount,
      error: priorAppointmentCountError,
    } = await priorAppointmentsCountQuery;

    if (priorAppointmentCountError) {
      throw priorAppointmentCountError;
    }

    const priorAppointmentRows = priorAppointments ?? [];
    const priorAppointmentIds = priorAppointmentRows.map(
      (priorAppointment) => priorAppointment.id
    );
    const { data: priorNotes, error: priorNotesError } =
      priorAppointmentIds.length > 0
        ? await supabase
            .from("appointment_notes")
            .select("appointment_id,created_at,summary_short,takeaways,followups")
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
      generation_mode: generationMode,
      past_appointment_total_count:
        priorAppointmentTotalCount ?? pastAppointments.length,
      past_appointments: pastAppointments,
    };

    const { data: latestGuidanceRows, error: latestGuidanceError } =
      await supabase
        .from("careprep_guidance")
        .select("id,generated_at,input_context_snapshot")
        .eq("appointment_id", appointment.id)
        .in("review_status", ["accepted", "draft"])
        .order("generated_at", { ascending: false })
        .limit(1);

    if (latestGuidanceError) {
      throw latestGuidanceError;
    }

    const latestGuidance = latestGuidanceRows?.[0] ?? null;

    if (generationMode === "auto_appointments_page" && latestGuidance) {
      return NextResponse.json({
        appointmentId: appointment.id,
        generationMode,
        guidanceId: latestGuidance.id,
        message: "CarePrep already exists for this appointment.",
        status: "generated",
      });
    }

    const previousPastAppointmentCount = snapshotPastAppointmentCount(
      latestGuidance?.input_context_snapshot
    );
    const previousLatestPriorNoteTime = latestSnapshotPriorNoteTime(
      latestGuidance?.input_context_snapshot
    );
    const currentLatestPriorNoteTime = priorNoteRows.reduce<number | null>(
      (latestTime, note) => {
        const createdAt =
          note && typeof note === "object" && "created_at" in note
            ? String(note.created_at ?? "")
            : "";
        const time = new Date(createdAt).getTime();

        if (!Number.isFinite(time)) {
          return latestTime;
        }

        return latestTime === null || time > latestTime ? time : latestTime;
      },
      null
    );
    const currentPastAppointmentCount =
      priorAppointmentTotalCount ?? pastAppointments.length;
    const hasNewerPriorNotes =
      currentLatestPriorNoteTime !== null &&
      (previousLatestPriorNoteTime === null ||
        currentLatestPriorNoteTime > previousLatestPriorNoteTime);

    if (
      previousPastAppointmentCount !== null &&
      currentPastAppointmentCount <= previousPastAppointmentCount &&
      !hasNewerPriorNotes
    ) {
      const refreshNotReadyMessage = await currentAppContentText(
        supabase as unknown as AppContentReader,
        "careprep_refresh_not_ready_message"
      );
      return NextResponse.json({
        appointmentId: appointment.id,
        alreadyUpToDate: true,
        generationMode,
        guidanceId: latestGuidance?.id,
        message:
          refreshNotReadyMessage ||
          "CarePrep is already up to date for this appointment. Add or save new Visit Notes, then try again.",
        status: "generated",
      });
    }

    if (generationMode !== "auto_home") {
      const meteredFeatureKey =
        generationMode === "auto_after_notes" ||
        generationMode === "auto_appointments_page"
          ? "careprep_auto"
          : "careprep_manual";
      const { data: meteringResult, error: meteringError } = await supabase.rpc(
        "consume_feature_usage",
        {
          p_care_circle_id: appointment.care_circle_id,
          p_feature_key: meteredFeatureKey,
          p_quantity: 1,
        }
      );

      if (meteringError) {
        throw meteringError;
      }

      const metering = (meteringResult ?? {}) as JsonObject;

      if (!jsonBoolean(metering.allowed)) {
        const dynamicLimitMessage =
          generationMode === "manual"
            ? await currentAppContentText(
                supabase as unknown as AppContentReader,
                "careprep_manual_limit_message"
              )
            : "";

        throw new Error(
          dynamicLimitMessage ||
            jsonString(
              metering.message,
              generationMode === "auto_after_notes" ||
                generationMode === "auto_appointments_page"
                ? "Automatic appointment preparation is not available on your current plan."
                : "This CarePrep generation is not available on your current plan."
            )
        );
      }

      reservedMeteredFeature = {
        careCircleId: appointment.care_circle_id,
        featureKey: meteredFeatureKey,
        quantity: 1,
      };
    }

    const schema =
      instructionVersion.output_schema &&
      typeof instructionVersion.output_schema === "object"
        ? instructionVersion.output_schema
        : {
            additionalProperties: false,
            properties: {
              beforeVisit: { items: { type: "string" }, type: "array" },
              duringVisit: { items: { type: "string" }, type: "array" },
              intro: { type: "string" },
            },
            required: ["beforeVisit", "duringVisit"],
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

    if (!hasUsefulCarePrep(guidance)) {
      if (reservedMeteredFeature) {
        await supabase.rpc("refund_feature_usage", {
          p_care_circle_id: reservedMeteredFeature.careCircleId,
          p_feature_key: reservedMeteredFeature.featureKey,
          p_quantity: reservedMeteredFeature.quantity,
        });
        reservedMeteredFeature = null;
      }

      return NextResponse.json({
        appointmentId: appointment.id,
        generationMode,
        message: "No useful CarePrep was found for this appointment.",
        reason:
          "No materially useful appointment preparation was supported by the available CarePland evidence.",
        status: "not_useful",
      });
    }

    const { data: existingDraftRows, error: existingDraftError } =
      await supabase
        .from("careprep_guidance")
        .select("id")
        .eq("appointment_id", appointment.id)
        .eq("review_status", "draft");

    if (existingDraftError) {
      throw existingDraftError;
    }

    const existingDrafts = existingDraftRows ?? [];
    const promptVersion = `careprep_generation:v${instructionVersion.version_number}`;
    const preapproveGeneratedCarePrep =
      generationMode === "auto_appointments_page";
    const reviewedAt = new Date().toISOString();

    const { data: guidanceRow, error: guidanceError } = await supabase
      .from("careprep_guidance")
      .insert({
        ...(preapproveGeneratedCarePrep
          ? {
              accepted_at: reviewedAt,
              accepted_by_user_id: userId,
            }
          : {}),
        appointment_id: appointment.id,
        bring_list: guidance.bring_list,
        care_circle_id: appointment.care_circle_id,
        generated_at: reviewedAt,
        input_context_snapshot: inputContextSnapshot,
        instruction_content_hash: instructionVersion.content_hash ?? null,
        instruction_set_id: instructionSet.id,
        instruction_version_id: instructionVersion.id,
        is_current: preapproveGeneratedCarePrep,
        key_questions: guidance.key_questions,
        med_review: guidance.med_review,
        model: instructionVersion.model ?? "gpt-4.1-mini",
        next_steps: guidance.next_steps,
        prompt_version: promptVersion,
        review_status: preapproveGeneratedCarePrep ? "accepted" : "draft",
        ...(preapproveGeneratedCarePrep
          ? {
              reviewed_at: reviewedAt,
              reviewed_by_user_id: userId,
            }
          : {}),
        since_last_visit: guidance.since_last_visit,
        source: "ai_generated",
        status: "succeeded",
        summary: guidance.summary,
        user_id: userId,
        version_number: preapproveGeneratedCarePrep ? 1 : 0,
        watchouts: guidance.watchouts,
      })
      .select("id")
      .single();

    if (guidanceError) {
      throw guidanceError;
    }

    await recordCarePlandWorkEventBestEffort(supabase, {
      careCircleId: appointment.care_circle_id,
      careSubjectId: appointment.care_subject_id,
      confidence: 1,
      createdByUserId: userId,
      idempotencyKey: `careprep_prepared:${guidanceRow.id}`,
      outcomeCategory: "visit_prepared",
      relatedSources: [
        {
          label: appointmentLabel(appointment),
          role: "appointment_prepared",
          source_id: appointment.id,
          source_table: "appointments",
          source_type: "appointments",
        },
        {
          label: "CarePrep guidance",
          role: "prepared_context",
          source_id: guidanceRow.id,
          source_table: "careprep_guidance",
          source_type: "careprep",
        },
      ],
      sourceId: guidanceRow.id,
      sourceTable: "careprep_guidance",
      sourceType: "careprep",
      structuredPayload: {
        generationMode,
        priorAppointmentCount:
          priorAppointmentTotalCount ?? pastAppointments.length,
        reviewStatus: preapproveGeneratedCarePrep ? "accepted" : "draft",
      },
      summary: `CarePrep was prepared for ${appointmentLabel(appointment)}.`,
      title: "CarePrep prepared",
      workType: "careprep_prepared",
    });

    await logOpenAiOperationCost({
      careCircleId: appointment.care_circle_id,
      metadata: { generation_mode: generationMode },
      model: instructionVersion.model ?? "gpt-4.1-mini",
      openAiJson,
      operationKey: "careprep_generation",
      operationLabel: "CarePrep generation",
      promptVersion,
      providerRequestId:
        openAiResponse.headers.get("x-request-id") ??
        openAiResponse.headers.get("openai-request-id"),
      sourceId: guidanceRow.id,
      sourceTable: "careprep_guidance",
      supabase,
      userId,
    });

    meteredFeatureFinalized = true;

    if (existingDrafts.length > 0) {
      const { error: discardDraftError } = await supabase
        .from("careprep_guidance")
        .update({
          review_status: "discarded",
          reviewed_at: new Date().toISOString(),
          reviewed_by_user_id: userId,
        })
        .in(
          "id",
          existingDrafts.map((draft) => draft.id)
        );

      if (discardDraftError) {
        throw discardDraftError;
      }
    }

    return NextResponse.json({
      appointmentId: appointment.id,
      guidanceId: guidanceRow.id,
      generationMode,
      message: existingDrafts.length > 0
        ? generationMode === "auto_after_notes" ||
          generationMode === "auto_appointments_page"
          ? "CarePrep was refreshed for the next appointment."
          : generationMode === "auto_home"
            ? "CarePrep was refreshed for the next appointment."
          : "New AI CarePrep draft generated."
        : generationMode === "auto_after_notes" ||
          generationMode === "auto_appointments_page"
          ? "CarePrep was prepared for the next appointment."
          : generationMode === "auto_home"
            ? "CarePrep was prepared for the next appointment."
          : "AI CarePrep draft generated.",
      status: "generated",
    });
  } catch (error) {
    if (
      reservedMeteredFeature &&
      !meteredFeatureFinalized &&
      meteringAccessToken
    ) {
      try {
        const refundClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false },
          global: {
            headers: {
              Authorization: `Bearer ${meteringAccessToken}`,
            },
          },
        });

        await refundClient.rpc("refund_feature_usage", {
          p_care_circle_id: reservedMeteredFeature.careCircleId,
          p_feature_key: reservedMeteredFeature.featureKey,
          p_quantity: reservedMeteredFeature.quantity,
        });
      } catch {
        // Preserve the original generation error; failed refund can be reviewed in usage counters.
      }
    }

    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
