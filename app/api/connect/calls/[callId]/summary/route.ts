import { NextResponse } from "next/server";

import { readConnectCallPersonAccessForRequest } from "@/app/lib/connect/calls/server/callAccess";
import { generateConnectCallCareSummary } from "@/app/lib/connect/calls/server/callSummaryGeneration";
import {
  approveLocalConnectCallSummary,
  readLocalConnectCalls,
  saveLocalConnectCallSummaryDraft,
  updateLocalConnectCallSummary,
} from "@/app/lib/connect/calls/server/localCalls";
import {
  approveSupabaseConnectCallSummary,
  readSupabaseConnectCalls,
  recordSupabaseConnectCallGeneratedSummary,
  recordSupabaseConnectCallEvent,
  retrySupabaseApprovedCallTranscriptCleanup,
  saveSupabaseConnectCallSummaryDraft,
} from "@/app/lib/connect/calls/server/supabaseCallStore";

type RouteContext = {
  params: Promise<{ callId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { callId } = await context.params;
    const payload = (await request.json().catch(() => ({}))) as {
      action?: string;
      approvedBy?: string;
      approvedSummaryText?: string;
      draftText?: string;
      mainConnectUserPersonId?: string;
    };
    const personId = payload.mainConnectUserPersonId?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        {
          error: "Select a Main Connect User before approving a Connect call summary.",
          ok: false,
        },
        { status: 400 }
      );
    }

    if (
      payload.action !== "approve" &&
      payload.action !== "cleanup_transcript" &&
      payload.action !== "regenerate" &&
      payload.action !== "save_draft"
    ) {
      return NextResponse.json(
        { error: "Unsupported call summary action.", ok: false },
        { status: 400 }
      );
    }

    const access = await readConnectCallPersonAccessForRequest(request, personId);
    const approvedSummaryText = payload.approvedSummaryText?.trim() || "";

    if (payload.action === "save_draft") {
      const call =
        (await saveSupabaseConnectCallSummaryDraft(callId, access, {
          draftText: String(payload.draftText ?? ""),
          updatedBy: payload.approvedBy || "receiver",
        })) ??
        (await saveLocalConnectCallSummaryDraft(callId, {
          draftText: String(payload.draftText ?? ""),
          mainConnectUserPersonId: personId,
          updatedBy: payload.approvedBy || "receiver",
        }));

      if (!call) {
        return NextResponse.json(
          {
            error: "Call summary draft could not be saved.",
            mainConnectUserPersonId: personId,
            ok: false,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        call,
        mainConnectUserPersonId: personId,
        ok: true,
      });
    }

    if (payload.action === "cleanup_transcript") {
      const call =
        (await retrySupabaseApprovedCallTranscriptCleanup(callId, access)) ??
        (await findScopedCall(callId, personId, access));

      if (!call) {
        return NextResponse.json(
          {
            error: "Call transcript cleanup could not be retried.",
            mainConnectUserPersonId: personId,
            ok: false,
          },
          { status: 404 }
        );
      }

      void recordSupabaseConnectCallEvent(
        {
          actorRole: payload.approvedBy || "receiver",
          callId,
          details: {
            source: "connect_call_summary_cleanup_retry",
            transcriptCleanupStatus: call.transcriptCleanupStatus || "completed",
          },
          eventType: "call_transcript_cleanup_retried",
        },
        access
      );

      return NextResponse.json({
        call,
        mainConnectUserPersonId: personId,
        ok: true,
      });
    }

    if (payload.action === "regenerate") {
      const call = await findScopedCall(callId, personId, access);
      const transcriptText = call?.transcriptText?.trim() || "";

      if (!call || !transcriptText) {
        return NextResponse.json(
          {
            error: "A temporary transcript is required before regenerating a call summary.",
            mainConnectUserPersonId: personId,
            ok: false,
          },
          { status: 409 }
        );
      }

      const generatedSummary = await generateConnectCallCareSummary({ transcriptText });
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

      void recordSupabaseConnectCallEvent(
        {
          actorRole: payload.approvedBy || "receiver",
          callId,
          details: {
            source: "connect_call_summary_regenerate",
            summaryStatus: generatedSummary.summaryStatus,
          },
          eventType: "call_summary_regenerated",
        },
        access
      );

      return NextResponse.json({
        call: summaryCall ?? {
          ...call,
          summaryStatus: generatedSummary.summaryStatus,
          summaryText: generatedSummary.summaryText,
        },
        mainConnectUserPersonId: personId,
        ok: true,
      });
    }

    if (!approvedSummaryText) {
      return NextResponse.json(
        {
          error: "Review and enter a care summary before approving.",
          mainConnectUserPersonId: personId,
          ok: false,
        },
        { status: 400 }
      );
    }

    const call =
      (await approveSupabaseConnectCallSummary(callId, access, {
        approvedBy: payload.approvedBy || "receiver",
        approvedSummaryText,
      })) ??
      (await approveLocalConnectCallSummary(callId, {
        approvedBy: payload.approvedBy || "receiver",
        approvedSummaryText,
        mainConnectUserPersonId: personId,
      }));

    if (!call) {
      return NextResponse.json(
        {
          error: "Call summary could not be approved.",
          mainConnectUserPersonId: personId,
          ok: false,
        },
        { status: 404 }
      );
    }
    void recordSupabaseConnectCallEvent(
      {
        actorRole: payload.approvedBy || "receiver",
        callId,
        details: {
          approvedBy: payload.approvedBy || "receiver",
          approvedSummaryLength: approvedSummaryText.length,
          editedSummary: Boolean(approvedSummaryText),
          source: "connect_call_summary_approval",
          transcriptCleanupStatus: call.transcriptCleanupStatus || "completed",
        },
        eventType: "call_summary_approved",
      },
      access
    );

    return NextResponse.json({
      call,
      mainConnectUserPersonId: personId,
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to approve Connect call summary.",
        ok: false,
      },
      { status: 401 }
    );
  }
}

async function findScopedCall(
  callId: string,
  personId: string,
  access: Awaited<ReturnType<typeof readConnectCallPersonAccessForRequest>>
) {
  const supabaseCalls = await readSupabaseConnectCalls(access);
  const localIndex = await readLocalConnectCalls();
  return [...(supabaseCalls ?? []), ...localIndex.calls].find(
    (call) =>
      call.callId === callId &&
      (call.mainConnectUserPersonId === personId || call.recipientPersonId === personId)
  );
}
