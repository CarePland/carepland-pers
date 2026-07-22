import { NextRequest, NextResponse } from "next/server";

import { extractTopicMentionsForNote } from "@/app/lib/personal/healthTopics/server";
import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
  getActiveSupabaseUser,
} from "@/app/lib/platform/server/supabase";

type BackfillNoteRow = {
  id: string;
};

type BackfillAppointmentRow = {
  current_note_id: string | null;
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

function numberFromBody(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(100, Math.floor(value)));
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before rebuilding Health Focus.");
    }

    const body = await request.json().catch(() => ({}));
    const limit = numberFromBody(body.limit, 50);
    const userClient = createSupabaseUserClient(accessToken);
    await getActiveSupabaseUser(
      userClient,
      "Please sign in before rebuilding Health Focus."
    );

    const careSubjectId =
      typeof body.careSubjectId === "string" ? body.careSubjectId.trim() : "";
    let appointmentsQuery = userClient
      .from("appointments")
      .select("current_note_id")
      .not("current_note_id", "is", null)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (careSubjectId) {
      appointmentsQuery = appointmentsQuery.eq("care_subject_id", careSubjectId);
    }

    const { data: appointmentRows, error: appointmentsError } =
      await appointmentsQuery;

    if (appointmentsError) {
      throw appointmentsError;
    }

    const noteIds = ((appointmentRows ?? []) as BackfillAppointmentRow[])
      .map((appointment) => appointment.current_note_id)
      .filter((noteId): noteId is string => typeof noteId === "string");

    if (noteIds.length === 0) {
      return NextResponse.json({
        errors: [],
        failedCount: 0,
        noteCount: 0,
        ok: true,
        processedCount: 0,
        topicSlugs: [],
      });
    }

    const notesQuery = userClient
      .from("appointment_notes")
      .select("id")
      .in("id", noteIds)
      .limit(limit);
    const { data: noteRows, error: notesError } = await notesQuery;

    if (notesError) {
      throw notesError;
    }

    const serviceClient = createSupabaseServiceClient();
    const results = [];
    const errors = [];

    for (const note of (noteRows ?? []) as BackfillNoteRow[]) {
      try {
        results.push(
          await extractTopicMentionsForNote({
            noteId: note.id,
            serviceClient,
            userClient,
          })
        );
      } catch (error) {
        errors.push({
          error: errorMessage(error),
          noteId: note.id,
        });
      }
    }

    const topicSlugs = Array.from(
      new Set(results.flatMap((result) => result.topicSlugs))
    ).sort();

    return NextResponse.json({
      errors,
      failedCount: errors.length,
      noteCount: noteRows?.length ?? 0,
      ok: errors.length === 0,
      processedCount: results.length,
      topicSlugs,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), ok: false },
      { status: 400 }
    );
  }
}
