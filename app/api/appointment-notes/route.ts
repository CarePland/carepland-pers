import { NextRequest, NextResponse } from "next/server";

import { extractTopicMentionsForNote } from "@/app/lib/healthTopics/server";
import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "@/app/lib/server/supabase";

type AppointmentRow = {
  care_circle_id: string;
  care_subject_id: string;
  current_note_id: string | null;
  id: string;
};

type AppointmentNoteRow = {
  id: string;
  version_number: number;
};

type AppointmentNoteDraftPayload = {
  followups: string[];
  inputText: string | null;
  source: string;
  summary: string;
  takeaways: string[];
};

const allowedAppointmentUpdateFields = new Set([
  "location_address",
  "location_name",
  "location_phone",
  "provider_name",
  "provider_organization",
  "reason",
  "starts_at",
  "status",
  "title",
]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Something went wrong.");
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before saving Visit Notes.");
    }

    const body = await request.json().catch(() => ({}));
    const appointmentId =
      typeof body.appointmentId === "string" ? body.appointmentId.trim() : "";
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const takeaways = asStringArray(body.takeaways);
    const followups = asStringArray(body.followups);
    const inputText =
      typeof body.inputText === "string" ? body.inputText.trim() : summary;
    const requestedSource =
      typeof body.source === "string" && body.source.trim()
        ? body.source.trim()
        : "";
    const aiDraft = parseAiDraftPayload(body.aiDraft);
    const appointmentUpdates = safeAppointmentUpdates(body.appointmentUpdates);
    const restoreIfArchived = body.restoreIfArchived === true;

    if (!appointmentId) {
      throw new Error("Choose an appointment before saving Visit Notes.");
    }

    if (!summary && takeaways.length === 0 && followups.length === 0) {
      throw new Error("Please add a summary, takeaway, or follow-up.");
    }

    const userClient = createSupabaseUserClient(accessToken);
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("Please sign in before saving Visit Notes.");
    }

    const { data: appointment, error: appointmentError } = await userClient
      .from("appointments")
      .select("id,care_circle_id,care_subject_id,current_note_id")
      .eq("id", appointmentId)
      .single();

    if (appointmentError) {
      throw appointmentError;
    }

    const appointmentRow = appointment as AppointmentRow | null;

    if (!appointmentRow) {
      throw new Error("Appointment was not found.");
    }

    const existingNote = appointmentRow.current_note_id
      ? await loadExistingNote(userClient, appointmentRow.current_note_id)
      : null;
    const nextVersionNumber = existingNote ? existingNote.version_number + 1 : 1;
    const source = requestedSource || (existingNote ? "manual_edit" : "manual");
    let aiNote: AppointmentNoteRow | null = null;

    if (aiDraft) {
      const { data: aiNoteRow, error: aiNoteError } = await userClient
        .from("appointment_notes")
        .insert({
          accepted_by_user: false,
          appointment_id: appointmentRow.id,
          care_circle_id: appointmentRow.care_circle_id,
          followups: aiDraft.followups,
          generated_by_ai: true,
          input_text: aiDraft.inputText,
          is_current: false,
          source: aiDraft.source,
          summary_short: aiDraft.summary || null,
          takeaways: aiDraft.takeaways,
          user_id: userId,
          version_number: nextVersionNumber,
        })
        .select("id,version_number")
        .single();

      if (aiNoteError) {
        throw aiNoteError;
      }

      aiNote = aiNoteRow as AppointmentNoteRow;
    }

    const acceptedVersionNumber = aiNote
      ? nextVersionNumber + 1
      : nextVersionNumber;
    const { data: newNote, error: insertError } = await userClient
      .from("appointment_notes")
      .insert({
        accepted_by_user: true,
        appointment_id: appointmentRow.id,
        care_circle_id: appointmentRow.care_circle_id,
        followups,
        generated_by_ai: false,
        input_text: inputText || null,
        is_current: true,
        source,
        summary_short: summary || null,
        takeaways,
        user_id: userId,
        version_number: acceptedVersionNumber,
      })
      .select("id,version_number")
      .single();

    if (insertError) {
      throw insertError;
    }

    const newNoteRow = newNote as AppointmentNoteRow;

    if (aiNote) {
      const { error: aiArchiveError } = await userClient
        .from("appointment_notes")
        .update({
          superseded_at: new Date().toISOString(),
          superseded_by_note_id: newNoteRow.id,
        })
        .eq("id", aiNote.id);

      if (aiArchiveError) {
        throw aiArchiveError;
      }
    }

    if (existingNote) {
      const { error: archiveError } = await userClient
        .from("appointment_notes")
        .update({
          is_current: false,
          superseded_at: new Date().toISOString(),
          superseded_by_note_id: newNoteRow.id,
        })
        .eq("id", existingNote.id);

      if (archiveError) {
        throw archiveError;
      }
    }

    const appointmentUpdatePayload = Object.fromEntries(
      Object.entries({
        ...appointmentUpdates,
        archived_at: restoreIfArchived ? null : undefined,
        current_note_id: newNoteRow.id,
        status: restoreIfArchived ? "scheduled" : appointmentUpdates.status,
      }).filter(([, value]) => value !== undefined)
    );
    const { error: appointmentUpdateError } = await userClient
      .from("appointments")
      .update(appointmentUpdatePayload)
      .eq("id", appointmentRow.id);

    if (appointmentUpdateError) {
      throw appointmentUpdateError;
    }

    let extraction:
      | Awaited<ReturnType<typeof extractTopicMentionsForNote>>
      | null = null;
    let extractionError: string | null = null;

    try {
      extraction = await extractTopicMentionsForNote({
        noteId: newNoteRow.id,
        serviceClient: createSupabaseServiceClient(),
        userClient,
      });
    } catch (error) {
      extractionError = errorMessage(error);
    }

    return NextResponse.json({
      appointmentId: appointmentRow.id,
      careCircleId: appointmentRow.care_circle_id,
      careSubjectId: appointmentRow.care_subject_id,
      extraction,
      extractionError,
      aiNoteId: aiNote?.id ?? null,
      noteId: newNoteRow.id,
      ok: true,
      versionNumber: newNoteRow.version_number,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), ok: false },
      { status: 400 }
    );
  }
}

function parseAiDraftPayload(value: unknown): AppointmentNoteDraftPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const summary =
    typeof payload.summary === "string" ? payload.summary.trim() : "";
  const takeaways = asStringArray(payload.takeaways);
  const followups = asStringArray(payload.followups);

  if (!summary && takeaways.length === 0 && followups.length === 0) {
    return null;
  }

  return {
    followups,
    inputText:
      typeof payload.inputText === "string" && payload.inputText.trim()
        ? payload.inputText.trim()
        : null,
    source:
      typeof payload.source === "string" && payload.source.trim()
        ? payload.source.trim()
        : "intake_ai_draft",
    summary,
    takeaways,
  };
}

function safeAppointmentUpdates(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([field]) =>
      allowedAppointmentUpdateFields.has(field)
    )
  );
}

async function loadExistingNote(
  userClient: ReturnType<typeof createSupabaseUserClient>,
  noteId: string
): Promise<AppointmentNoteRow | null> {
  const { data, error } = await userClient
    .from("appointment_notes")
    .select("id,version_number")
    .eq("id", noteId)
    .single();

  if (error) {
    throw error;
  }

  return (data as AppointmentNoteRow | null) ?? null;
}
