import { NextResponse } from "next/server";

import {
  ConnectPersonAccessDeniedError,
  verifyConnectPersonAccessForRequest,
} from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  normalizeConnectAppointments,
  type ConnectAppointmentRow,
} from "@/app/lib/connect/appointments/appointmentScoping";
import { createSupabaseUserClient } from "@/app/lib/platform/server/supabase";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const personId = requestUrl.searchParams.get("personId")?.trim();

    if (!personId) {
      return NextResponse.json(
        {
          appointments: [],
          error: "Select a Main Connect User before loading Connect appointments.",
        },
        { status: 400 }
      );
    }

    let accessToken = "";
    try {
      ({ accessToken } = await verifyConnectPersonAccessForRequest(personId, request));
    } catch (error) {
      if (!(error instanceof ConnectPersonAccessDeniedError)) {
        throw error;
      }

      return NextResponse.json(
        {
          appointments: [],
          error: "Choose a Main Connect User from your CarePland collection.",
        },
        { status: 403 }
      );
    }

    const supabase = createSupabaseUserClient(accessToken);

    const { data: appointmentRows, error } = await supabase
      .from("appointments")
      .select(
        "id,care_subject_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone,deleted_at"
      )
      .eq("care_subject_id", personId)
      .is("deleted_at", null)
      .neq("status", "archived")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(8);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      appointments: normalizeConnectAppointments(
        (appointmentRows ?? []) as ConnectAppointmentRow[]
      ),
      mainConnectUserPersonId: personId,
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        appointments: [],
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Connect appointments.",
      },
      { status: 500 }
    );
  }
}
