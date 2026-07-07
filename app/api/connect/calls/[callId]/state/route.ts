import { NextResponse } from "next/server";

import { readConnectCallPersonAccessForRequest } from "@/app/lib/connect/calls/server/callAccess";
import {
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import { generateConnectCallCareSummary } from "@/app/lib/connect/calls/server/callSummaryGeneration";
import {
  updateLocalConnectCallState,
  updateLocalConnectCallSummary,
} from "@/app/lib/connect/calls/server/localCalls";
import {
  recordSupabaseConnectCallGeneratedSummary,
  recordSupabaseConnectCallEvent,
  updateSupabaseConnectCallState,
} from "@/app/lib/connect/calls/server/supabaseCallStore";
import { connectPrototypeEndpoints } from "@/app/lib/connect/prototypeClient";

type RouteContext = {
  params: Promise<{ callId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { callId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      mainConnectUserPersonId?: string;
      source?: string;
      state?: string;
    };
    const personId = payload.mainConnectUserPersonId?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        { error: "Select a Main Connect User before updating Connect call state.", ok: false },
        { status: 400 }
      );
    }

    const access = await readConnectCallPersonAccessForRequest(request, personId, payload);

    const call =
      (await updateSupabaseConnectCallState(callId, payload.state || "", access)) ??
      (await updateLocalConnectCallState(callId, payload.state || "", {
        mainConnectUserPersonId: personId,
      }));
    const prototypeBody =
      access.accessType === "receiver_device"
        ? {}
        : await postPrototypeCallState(callId, {
            ...payload,
            mainConnectUserPersonId: personId,
          });
    if (call) {
      void recordSupabaseConnectCallEvent(
        {
          actorRole: payload.source,
          callId,
          details: {
            resultState: call.state || "",
            source: payload.source || "",
            state: payload.state || "",
          },
          eventType: "call_state_updated",
        },
        access
      );
      if (
        ["declined", "failed", "hung_up", "missed", "receiver_unavailable"].includes(
          String(call.state || "")
        ) &&
        call.transcriptText?.trim() &&
        !["approved", "pending_review"].includes(String(call.summaryStatus || ""))
      ) {
        const generatedSummary = await generateConnectCallCareSummary({
          transcriptText: call.transcriptText,
        });
        const summaryCall =
          (await recordSupabaseConnectCallGeneratedSummary(
            callId,
            {
              summaryStatus: generatedSummary.summaryStatus,
              summaryText: generatedSummary.summaryText,
            },
            access
          )) ??
          (await updateLocalConnectCallSummary(callId, {
            mainConnectUserPersonId: personId,
            summaryStatus: generatedSummary.summaryStatus,
            summaryText: generatedSummary.summaryText,
          }));

        if (summaryCall) {
          call.summaryStatus = summaryCall.summaryStatus;
          call.summaryText = summaryCall.summaryText;
        }
        void recordSupabaseConnectCallEvent(
          {
            actorRole: "system",
            callId,
            details: {
              source: "call_state_terminal_summary_generation",
              summaryStatus: generatedSummary.summaryStatus,
            },
            eventType: "call_summary_generated",
          },
          access
        );
      }
    }

    if (!call && prototypeBody.ok !== true) {
      void recordSupabaseConnectCallEvent(
        {
          actorRole: payload.source,
          callId,
          details: {
            source: payload.source || "",
            state: payload.state || "",
          },
          eventType: "call_state_update_not_applied",
        },
        access
      );
      return NextResponse.json(
        {
          error: "Call state could not be updated.",
          mainConnectUserPersonId: personId,
          ok: false,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...prototypeBody,
      call: prototypeBody.call ?? call,
      mainConnectUserPersonId: personId,
      ok: true,
      source: prototypeBody.ok === true ? "local_and_prototype" : "local",
    });
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(receiverDeviceSetupRequiredBody(error), {
        status: error.status,
      });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update Connect call state.",
        ok: false,
      },
      { status: 401 }
    );
  }
}

async function postPrototypeCallState(
  callId: string,
  payload: { mainConnectUserPersonId?: string; source?: string; state?: string }
) {
  try {
    const response = await fetch(connectPrototypeEndpoints.callState(callId), {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    return response.ok ? body : {};
  } catch {
    return {};
  }
}
