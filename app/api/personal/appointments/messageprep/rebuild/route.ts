import { NextResponse, type NextRequest } from "next/server";

import {
  ConnectPersonAccessDeniedError,
} from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import { readConnectMessagePersonAccessForRequest } from "@/app/lib/connect/messaging/server/messageAccess";
import { rebuildAppointmentCommunicationSummary } from "@/app/lib/personal/appointments/communicationSummary";

type AppointmentRow = {
  id: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      appointmentId?: string;
      personId?: string;
    };
    const appointmentId = String(body.appointmentId || "").trim();
    const personId = String(body.personId || "").trim();

    if (!appointmentId || !personId) {
      return NextResponse.json(
        {
          error: "Choose an appointment and Care VIP before rebuilding MessagePrep.",
          ok: false,
          summary: null,
        },
        { status: 400 }
      );
    }

    const access = await readConnectMessagePersonAccessForRequest(request, personId);
    const appointment = await readAccessibleAppointment(
      access.supabase,
      appointmentId,
      access.mainConnectUserPersonId,
      access.careCircleId
    );

    if (!appointment) {
      return NextResponse.json(
        {
          error: "That appointment is not available for this Care VIP.",
          ok: false,
          summary: null,
        },
        { status: 403 }
      );
    }

    const summary = await rebuildAppointmentCommunicationSummary(
      access.supabase,
      access,
      appointmentId
    );

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(
        { summary: null, ...receiverDeviceSetupRequiredBody(error) },
        { status: error.status }
      );
    }
    if (error instanceof ConnectPersonAccessDeniedError) {
      return NextResponse.json(
        {
          error: "Choose a Care VIP from your CarePland collection.",
          ok: false,
          summary: null,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to rebuild MessagePrep.",
        ok: false,
        summary: null,
      },
      { status: 503 }
    );
  }
}

async function readAccessibleAppointment(
  supabase: Awaited<ReturnType<typeof readConnectMessagePersonAccessForRequest>>["supabase"],
  appointmentId: string,
  personId: string,
  careCircleId: string
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("id", appointmentId)
    .eq("care_circle_id", careCircleId)
    .eq("care_subject_id", personId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AppointmentRow | null;
}
