import { NextResponse, type NextRequest } from "next/server";

import {
  normalizeHomeMessageSummaryFeedbackDraft,
  type HomeMessageSummaryFeedbackDraft,
} from "@/app/lib/personal/messages/homeMessageSummaryFeedback";
import {
  ConnectPersonAccessDeniedError,
} from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import { readConnectMessagePersonAccessForRequest } from "@/app/lib/connect/messaging/server/messageAccess";

type FeedbackInsertResult = {
  id: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const personId = stringValue(body.personId);

    if (!personId) {
      throw new Error("Choose a Care VIP before sending summary feedback.");
    }

    const access = await readConnectMessagePersonAccessForRequest(request, personId);
    const { data: userData, error: userError } = await access.supabase.auth.getUser();
    if (userError) throw userError;

    const userId = userData.user?.id;
    if (!userId) {
      throw new Error("Please sign in before sending summary feedback.");
    }

    const draft: HomeMessageSummaryFeedbackDraft = {
      decisionTrace: objectValue(body.decisionTrace),
      keyPoints: objectArrayValue(body.keyPoints),
      personId: access.mainConnectUserPersonId,
      sourceMessageIds: stringArrayValue(body.sourceMessageIds),
      summary: stringValue(body.summary),
      summaryModelVersion: stringValue(body.summaryModelVersion),
      userComment: stringValue(body.userComment),
    };
    const feedbackInsert = normalizeHomeMessageSummaryFeedbackDraft(draft, {
      careCircleId: access.careCircleId,
      userId,
    });

    const { data, error } = await access.supabase
      .from("home_message_summary_feedback")
      .insert(feedbackInsert)
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({
      feedbackId: (data as FeedbackInsertResult | null)?.id ?? null,
      ok: true,
    });
  } catch (error) {
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(
        { ...receiverDeviceSetupRequiredBody(error), ok: false },
        { status: error.status }
      );
    }
    if (error instanceof ConnectPersonAccessDeniedError) {
      return NextResponse.json(
        {
          error: "Choose a Care VIP from your CarePland collection.",
          ok: false,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: errorMessage(error), ok: false },
      { status: 400 }
    );
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function objectArrayValue(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const payload = error as Record<string, unknown>;
    const parts = [
      payload.message,
      payload.details,
      payload.hint,
      payload.code ? `Code: ${payload.code}` : "",
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    if (parts.length > 0) return parts.join(" ");
  }

  return String(error || "Unable to send summary feedback.");
}
