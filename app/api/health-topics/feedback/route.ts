import { NextRequest, NextResponse } from "next/server";

import {
  buildUserContextFromFeedback,
  normalizeFeedbackDraft,
  type HealthTopicFeedbackDraft,
} from "@/app/lib/healthTopics/feedback";
import { createSupabaseUserClient } from "@/app/lib/server/supabase";

type FeedbackInsertResult = {
  id: string;
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

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function feedbackDraftFromBody(body: Record<string, unknown>): HealthTopicFeedbackDraft {
  const feedbackMode = stringValue(body.feedbackMode);
  const targetType = stringValue(body.targetType) || "health_story";

  if (feedbackMode !== "binary" && feedbackMode !== "clarification") {
    throw new Error("Choose a Health Story feedback mode.");
  }

  if (
    ![
      "health_focus_card",
      "health_story",
      "report",
      "source_snippet",
      "timeline",
      "topic_relationship",
      "topic_summary",
    ].includes(targetType)
  ) {
    throw new Error("Choose a valid Health Story feedback target.");
  }

  return {
    careCircleId: stringValue(body.careCircleId),
    careSubjectId: stringValue(body.careSubjectId),
    feedbackMode,
    feedbackValue:
      (stringValue(body.feedbackValue) as HealthTopicFeedbackDraft["feedbackValue"]) ||
      null,
    relatedTopicSlug: stringValue(body.relatedTopicSlug) || null,
    reportId: stringValue(body.reportId) || null,
    shouldInfluenceFutureGeneration:
      typeof body.shouldInfluenceFutureGeneration === "boolean"
        ? body.shouldInfluenceFutureGeneration
        : true,
    sourceAppointmentIds: stringArrayValue(body.sourceAppointmentIds),
    sourceTopicMentionIds: stringArrayValue(body.sourceTopicMentionIds),
    systemSnapshot: objectValue(body.systemSnapshot),
    systemSummaryText: stringValue(body.systemSummaryText) || null,
    targetType: targetType as HealthTopicFeedbackDraft["targetType"],
    topicSlug: stringValue(body.topicSlug),
    topicSummaryId: stringValue(body.topicSummaryId) || null,
    userComment: stringValue(body.userComment) || null,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before saving Health Story feedback.");
    }

    const userClient = createSupabaseUserClient(accessToken);
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("Please sign in before saving Health Story feedback.");
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const draft = feedbackDraftFromBody(body);

    if (!draft.careCircleId || !draft.careSubjectId || !draft.topicSlug) {
      throw new Error("Health Story feedback needs a Care VIP and topic.");
    }

    if (draft.feedbackMode === "clarification" && !draft.userComment) {
      throw new Error("Add a short clarification before saving feedback.");
    }

    const feedbackInsert = normalizeFeedbackDraft(draft, userId);
    const { data: feedbackRows, error: feedbackError } = await userClient
      .from("health_topic_feedback")
      .insert(feedbackInsert)
      .select("id")
      .single();

    if (feedbackError) {
      throw feedbackError;
    }

    const feedbackId = (feedbackRows as FeedbackInsertResult | null)?.id;
    const contextInsert = buildUserContextFromFeedback(
      feedbackInsert,
      feedbackId
    );
    let contextId: string | null = null;

    if (contextInsert) {
      const { data: contextRows, error: contextError } = await userClient
        .from("health_topic_user_context")
        .insert(contextInsert)
        .select("id")
        .single();

      if (contextError) {
        throw contextError;
      }

      contextId = (contextRows as FeedbackInsertResult | null)?.id ?? null;
    }

    return NextResponse.json({
      contextId,
      feedbackId,
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), ok: false },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before undoing Health Story feedback.");
    }

    const userClient = createSupabaseUserClient(accessToken);
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("Please sign in before undoing Health Story feedback.");
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const feedbackId = stringValue(body.feedbackId);
    const contextId = stringValue(body.contextId);

    if (!feedbackId) {
      throw new Error("Health Story feedback could not be found.");
    }

    const { error: feedbackError } = await userClient
      .from("health_topic_feedback")
      .update({
        incorporation_status: "ignored",
        should_influence_future_generation: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", feedbackId)
      .eq("user_id", userId);

    if (feedbackError) {
      throw feedbackError;
    }

    if (contextId) {
      const { error: contextError } = await userClient
        .from("health_topic_user_context")
        .update({
          incorporation_status: "ignored",
          should_influence_careprep: false,
          should_influence_health_focus: false,
          should_influence_reports: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", contextId)
        .eq("user_id", userId);

      if (contextError) {
        throw contextError;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), ok: false },
      { status: 400 }
    );
  }
}
