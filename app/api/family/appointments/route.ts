import { NextResponse } from "next/server";

import { createSupabaseServiceClient } from "../../../lib/platform/server/supabase";

type AppointmentRow = {
  id: string;
  title: string | null;
  reason: string | null;
  starts_at: string | null;
  status: string | null;
  provider_name: string | null;
  provider_organization: string | null;
  care_subject_id: string | null;
};

type CareSubjectRow = {
  id: string;
  display_name: string;
};

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const searchText = requestUrl.searchParams.get("q")?.trim() ?? "";
    const supabase = createSupabaseServiceClient();
    const { data: appointmentRows, error: appointmentsError } = await supabase
      .from("appointments")
      .select(
        "id,care_subject_id,title,reason,starts_at,status,provider_name,provider_organization,deleted_at",
      )
      .is("deleted_at", null)
      .neq("status", "archived")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(searchText ? 100 : 20);

    if (appointmentsError) {
      throw appointmentsError;
    }

    const appointments = filterAppointments(
      (appointmentRows ?? []) as AppointmentRow[],
      searchText,
    ).slice(0, 20);
    const careSubjectIds = Array.from(
      new Set(
        appointments
          .map((appointment) => appointment.care_subject_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const { data: careSubjectRows, error: careSubjectsError } =
      careSubjectIds.length > 0
        ? await supabase
            .from("care_subjects")
            .select("id,display_name")
            .in("id", careSubjectIds)
        : { data: [], error: null };

    if (careSubjectsError) {
      throw careSubjectsError;
    }

    const careSubjectsById = new Map(
      ((careSubjectRows ?? []) as CareSubjectRow[]).map((careSubject) => [
        careSubject.id,
        careSubject.display_name,
      ]),
    );

    return NextResponse.json({
      appointments: appointments.map((appointment) => {
        const title =
          appointment.title?.trim() ||
          appointment.reason?.trim() ||
          "Untitled appointment";
        const provider =
          appointment.provider_name?.trim() ||
          appointment.provider_organization?.trim() ||
          null;
        const careSubjectName = appointment.care_subject_id
          ? careSubjectsById.get(appointment.care_subject_id)
          : null;

        return {
          id: appointment.id,
          title,
          startsAt: appointment.starts_at,
          label: formatAppointmentLabel(title, appointment.starts_at, provider),
          careSubjectName,
          providerName: appointment.provider_name,
          providerOrganization: appointment.provider_organization,
        };
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load appointments.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function filterAppointments(appointments: AppointmentRow[], searchText: string) {
  if (!searchText || searchText.toLowerCase() === "appointment") {
    return appointments;
  }

  const searchWords = meaningfulSearchWords(searchText);

  if (searchWords.length === 0) {
    return appointments;
  }

  return appointments.filter((appointment) => {
    const searchableText = normalizeSearchText(
      [
        appointment.title,
        appointment.reason,
        appointment.provider_name,
        appointment.provider_organization,
      ]
        .filter(Boolean)
        .join(" "),
    );

    return searchWords.every((word) => searchableText.includes(word));
  });
}

function meaningfulSearchWords(value: string) {
  const ignoredWords = new Set([
    "a",
    "an",
    "and",
    "appointment",
    "appointments",
    "appt",
    "appts",
    "doctor",
    "dr",
    "for",
    "her",
    "his",
    "mom",
    "moms",
    "my",
    "of",
    "the",
    "to",
    "visit",
    "with",
  ]);

  return normalizeSearchText(value)
    .split(" ")
    .filter((word) => word.length >= 2 && !ignoredWords.has(word));
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/\bdr\.?\b/g, "doctor")
    .replace(/\bappt\b/g, "appointment")
    .replace(/['’]s\b/g, "s")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAppointmentLabel(
  title: string,
  startsAt: string | null,
  provider: string | null,
) {
  const pieces = [title];

  if (startsAt) {
    pieces.push(
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(startsAt)),
    );
  }

  if (provider) {
    pieces.push(provider);
  }

  return pieces.join(" · ");
}
