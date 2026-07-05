import { NextResponse } from "next/server";

import { ConnectPersonAccessDeniedError } from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  readConnectPersonScopedAccess,
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import {
  normalizeConnectAppointments,
  type ConnectAppointmentRow,
} from "@/app/lib/connect/appointments/appointmentScoping";

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

    let access: Awaited<ReturnType<typeof readConnectPersonScopedAccess>>;
    try {
      access = await readConnectPersonScopedAccess(request, personId);
    } catch (error) {
      if (error instanceof ReceiverDeviceAccessError) {
        return NextResponse.json(
          { appointments: [], ...receiverDeviceSetupRequiredBody(error) },
          { status: error.status }
        );
      }
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

    const supabase = access.supabase;

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
