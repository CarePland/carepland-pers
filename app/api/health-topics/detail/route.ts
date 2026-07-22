import { NextRequest, NextResponse } from "next/server";

import { normalizeTopicSlug } from "@/app/lib/personal/healthTopics";
import {
  latestRelationshipStateMap,
  relationshipContextSentence,
  relationshipStateFromContextText,
  relationshipStateFromFeedback,
  type HealthTopicRelationshipState,
} from "@/app/lib/personal/healthTopics/relationshipFeedback";
import {
  buildTopicContextSignature,
  healthStoryNarrative,
  meaningfulRelatedTopics,
  type HealthStoryStatus,
} from "@/app/lib/personal/healthTopics/topicSummary";
import {
  createSupabaseUserClient,
  getActiveSupabaseUser,
} from "@/app/lib/platform/server/supabase";

type TopicMentionDetailRow = {
  appointment_id: string | null;
  appointment_starts_at: string | null;
  care_subject_id: string;
  confidence: number | null;
  created_at: string;
  id: string;
  metadata: {
    is_sample_data?: boolean | string | null;
  } | null;
  provider_name: string | null;
  provider_organization: string | null;
  related_topic_slugs: string[];
  source_snippet: string | null;
  status: "follow_up" | "new" | "ongoing" | "resolved" | "unknown";
};

type TopicMentionVisitRow = {
  appointment_id: string | null;
  appointment_starts_at: string | null;
  care_subject_id: string;
  normalized_topic_slug: string;
};

type AppointmentRow = {
  id: string;
  is_sample_data: boolean | null;
  title: string | null;
};

type HealthTopicRow = {
  display_name: string;
  slug: string;
};

type HealthTopicUserContextRow = {
  context_text: string;
  context_type: string | null;
  created_at: string;
  related_topic_slug: string | null;
  structured_context: {
    relationship_feedback?: "related" | "unrelated" | "unclear" | null;
  } | null;
};

type RelatedTopicSummary = {
  displayName: string;
  mentionCount: number;
  relationshipState?: HealthTopicRelationshipState;
  topicSlug: string;
};

type RelationshipFeedbackRow = {
  created_at: string;
  related_topic_slug: string | null;
  relationship_feedback: "related" | "unrelated" | "unclear" | null;
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

function displayNameFromSlug(slug: string): string {
  return slug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sourceVisitKey(mention: {
  appointmentId?: string | null;
  appointment_id?: string | null;
  appointmentStartsAt?: string | null;
  appointment_starts_at?: string | null;
  careSubjectId?: string;
  care_subject_id?: string;
  normalized_topic_slug?: string;
}) {
  return (
    mention.appointment_id ??
    mention.appointmentId ??
    [
      mention.careSubjectId ?? mention.care_subject_id ?? "unknown",
      mention.normalized_topic_slug ?? "topic",
      mention.appointmentStartsAt ?? mention.appointment_starts_at ?? "unknown",
    ].join(":")
  );
}

function metadataMarksSampleData(metadata: TopicMentionDetailRow["metadata"]) {
  const value = metadata?.is_sample_data;

  return value === true || value === "true";
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before loading Health Focus.");
    }

    const topicSlug = normalizeTopicSlug(
      request.nextUrl.searchParams.get("topicSlug") ?? ""
    );
    const careSubjectId =
      request.nextUrl.searchParams.get("careSubjectId")?.trim() ?? "";

    if (!topicSlug) {
      throw new Error("Choose a Health Focus topic.");
    }

    const userClient = createSupabaseUserClient(accessToken);
    await getActiveSupabaseUser(
      userClient,
      "Please sign in before loading Health Focus."
    );

    let mentionsQuery = userClient
      .from("topic_mentions")
      .select(
        "id,care_subject_id,appointment_id,appointment_starts_at,provider_name,provider_organization,related_topic_slugs,source_snippet,status,confidence,created_at,metadata"
      )
      .eq("is_active", true)
      .eq("normalized_topic_slug", topicSlug)
      .order("appointment_starts_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(25);

    if (careSubjectId) {
      mentionsQuery = mentionsQuery.eq("care_subject_id", careSubjectId);
    }

    const [
      { data: topicRows, error: topicError },
      { data: mentionRows, error: mentionsError },
    ] = await Promise.all([
      userClient
        .from("health_topics")
        .select("slug,display_name")
        .eq("is_active", true),
      mentionsQuery,
    ]);

    if (topicError) {
      throw topicError;
    }

    if (mentionsError) {
      throw mentionsError;
    }

    const appointmentIds = Array.from(
      new Set(
        ((mentionRows ?? []) as TopicMentionDetailRow[])
          .map((mention) => mention.appointment_id)
          .filter((appointmentId): appointmentId is string =>
            Boolean(appointmentId)
          )
      )
    );
    const { data: appointmentRows, error: appointmentsError } =
      appointmentIds.length > 0
        ? await userClient
            .from("appointments")
            .select("id,title,is_sample_data")
            .in("id", appointmentIds)
        : { data: [], error: null };

    if (appointmentsError) {
      throw appointmentsError;
    }

    const appointmentTitlesById = new Map(
      ((appointmentRows ?? []) as AppointmentRow[]).map((appointment) => [
        appointment.id,
        appointment.title ?? "",
      ])
    );
    const sampleAppointmentIds = new Set(
      ((appointmentRows ?? []) as AppointmentRow[])
        .filter((appointment) => appointment.is_sample_data === true)
        .map((appointment) => appointment.id)
    );
    const topic =
      ((topicRows ?? []) as HealthTopicRow[]).find(
        (topicRow) => topicRow.slug === topicSlug
      ) ?? null;
    const topicDisplayNames = new Map(
      ((topicRows ?? []) as HealthTopicRow[]).map((topicRow) => [
        topicRow.slug,
        topicRow.display_name,
      ])
    );
    const relatedTopicCounts = new Map<string, number>();
    const mentions = ((mentionRows ?? []) as TopicMentionDetailRow[]).map(
      (mention) => {
        (mention.related_topic_slugs ?? []).forEach((relatedTopicSlug) => {
          const normalizedRelatedSlug = normalizeTopicSlug(relatedTopicSlug);

          if (!normalizedRelatedSlug || normalizedRelatedSlug === topicSlug) {
            return;
          }

          relatedTopicCounts.set(
            normalizedRelatedSlug,
            (relatedTopicCounts.get(normalizedRelatedSlug) ?? 0) + 1
          );
        });

        return {
          appointmentId: mention.appointment_id,
          appointmentStartsAt: mention.appointment_starts_at,
          appointmentTitle: mention.appointment_id
            ? appointmentTitlesById.get(mention.appointment_id) ?? ""
            : "",
          careSubjectId: mention.care_subject_id,
          confidence: mention.confidence,
          createdAt: mention.created_at,
          id: mention.id,
          providerLabel:
            mention.provider_organization?.trim() ||
            mention.provider_name?.trim() ||
            "",
          relatedTopicSlugs: mention.related_topic_slugs ?? [],
          sourceSnippet: mention.source_snippet,
          status: mention.status,
        };
      }
    );
    const isSampleData = ((mentionRows ?? []) as TopicMentionDetailRow[]).some(
      (mention) =>
        metadataMarksSampleData(mention.metadata) ||
        Boolean(
          mention.appointment_id && sampleAppointmentIds.has(mention.appointment_id)
        )
    );
    let relationshipFeedbackQuery = userClient
      .from("health_topic_feedback")
      .select("created_at,related_topic_slug,relationship_feedback")
      .eq("target_type", "topic_relationship")
      .eq("topic_slug", topicSlug)
      .neq("incorporation_status", "ignored")
      .eq("should_influence_future_generation", true)
      .in("relationship_feedback", ["related", "unrelated"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (careSubjectId) {
      relationshipFeedbackQuery = relationshipFeedbackQuery.eq(
        "care_subject_id",
        careSubjectId
      );
    } else if (mentions[0]?.careSubjectId) {
      relationshipFeedbackQuery = relationshipFeedbackQuery.eq(
        "care_subject_id",
        mentions[0].careSubjectId
      );
    }

    const { data: relationshipFeedbackRows, error: relationshipFeedbackError } =
      mentions.length > 0
        ? await relationshipFeedbackQuery
        : { data: [], error: null };

    if (relationshipFeedbackError) {
      throw relationshipFeedbackError;
    }

    const relationshipStates = latestRelationshipStateMap(
      (relationshipFeedbackRows ?? []) as RelationshipFeedbackRow[]
    );
    const allRelatedTopics = Array.from(
      relatedTopicCounts.entries()
    )
      .map(([relatedTopicSlug, mentionCount]) => ({
        displayName:
          topicDisplayNames.get(relatedTopicSlug) ??
          displayNameFromSlug(relatedTopicSlug),
        mentionCount,
        relationshipState:
          relationshipStates.get(relatedTopicSlug) ?? "unreviewed",
        topicSlug: relatedTopicSlug,
      }))
      .sort((left, right) => {
        if (right.mentionCount !== left.mentionCount) {
          return right.mentionCount - left.mentionCount;
        }

        return left.displayName.localeCompare(right.displayName);
      });
    const separateRelatedTopics = allRelatedTopics.filter(
      (relatedTopic) => relatedTopic.relationshipState === "separate"
    );
    const activeRelatedTopics = allRelatedTopics.filter(
      (relatedTopic) => relatedTopic.relationshipState !== "separate"
    );
    const relatedTopics = meaningfulRelatedTopics(activeRelatedTopics,
      { maxCount: 6 }
    ) as RelatedTopicSummary[];
    const narrativeRelatedTopics = allRelatedTopics.filter(
      (relatedTopic) => relatedTopic.relationshipState !== "separate"
    );
    const providerNames = Array.from(
      new Set(mentions.map((mention) => mention.providerLabel).filter(Boolean))
    ).slice(0, 4);
    const statuses = mentions.map((mention) => mention.status) as HealthStoryStatus[];
    let contextRowsQuery = userClient
      .from("health_topic_user_context")
      .select("context_text,context_type,created_at,related_topic_slug,structured_context")
      .eq("topic_slug", topicSlug)
      .eq("incorporation_status", "active")
      .eq("should_influence_health_focus", true)
      .limit(10);

    if (careSubjectId) {
      contextRowsQuery = contextRowsQuery.eq("care_subject_id", careSubjectId);
    } else if (mentions[0]?.careSubjectId) {
      contextRowsQuery = contextRowsQuery.eq(
        "care_subject_id",
        mentions[0].careSubjectId
      );
    }

    const { data: contextRows, error: contextsError } = await contextRowsQuery;
    const userContextTexts = (() => {
      if (contextsError) {
        return [];
      }

      const freeformTexts: string[] = [];
      const relationshipNamesByState: Record<
        Exclude<HealthTopicRelationshipState, "unreviewed">,
        string[]
      > = {
        related: [],
        separate: [],
      };

      ((contextRows ?? []) as HealthTopicUserContextRow[]).forEach((row) => {
        const relatedTopicSlug = normalizeTopicSlug(
          row.related_topic_slug ?? ""
        );

        if (row.context_type !== "topic_relationship" || !relatedTopicSlug) {
          freeformTexts.push(row.context_text);
          return;
        }

        const latestState = relationshipStates.get(relatedTopicSlug);
        const contextRelationship =
          row.structured_context?.relationship_feedback ?? null;
        const contextState = contextRelationship
          ? relationshipStateFromFeedback(contextRelationship)
          : relationshipStateFromContextText(row.context_text);

        if (!contextState) {
          freeformTexts.push(row.context_text);
          return;
        }

        if (
          (latestState === "related" && contextState !== "related") ||
          (latestState === "separate" && contextState !== "separate")
        ) {
          return;
        }

        const effectiveState = latestState ?? contextState;

        if (effectiveState === "related" || effectiveState === "separate") {
          relationshipNamesByState[effectiveState].push(
            topicDisplayNames.get(relatedTopicSlug) ??
              displayNameFromSlug(relatedTopicSlug)
          );
        }
      });

      return [
        ...freeformTexts,
        relationshipContextSentence({
          relatedDisplayNames: relationshipNamesByState.separate,
          relationshipState: "separate",
        }),
        relationshipContextSentence({
          relatedDisplayNames: relationshipNamesByState.related,
          relationshipState: "related",
        }),
      ].filter(Boolean);
    })();
    const mentionCareSubjectIds = Array.from(
      new Set(mentions.map((mention) => mention.careSubjectId))
    );
    let allVisitRowsQuery = userClient
      .from("topic_mentions")
      .select(
        "appointment_id,appointment_starts_at,care_subject_id,normalized_topic_slug"
      )
      .eq("is_active", true)
      .limit(500);

    if (careSubjectId) {
      allVisitRowsQuery = allVisitRowsQuery.eq("care_subject_id", careSubjectId);
    } else if (mentionCareSubjectIds.length > 0) {
      allVisitRowsQuery = allVisitRowsQuery.in(
        "care_subject_id",
        mentionCareSubjectIds
      );
    }

    const { data: allVisitRows, error: allVisitRowsError } =
      mentions.length > 0
        ? await allVisitRowsQuery
        : { data: [], error: null };

    if (allVisitRowsError) {
      throw allVisitRowsError;
    }

    const totalVisitCount = new Set(
      ((allVisitRows ?? []) as TopicMentionVisitRow[]).map((mention) =>
        sourceVisitKey(mention)
      )
    ).size;
    const sortedMentionDates = mentions
      .map((mention) => mention.appointmentStartsAt)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
    const topicVisitCount = new Set(
      mentions.map((mention) => sourceVisitKey(mention))
    ).size;

    return NextResponse.json({
      contextSignature: buildTopicContextSignature({
        firstMentionAt: sortedMentionDates[0] ?? null,
        latestMentionAt: mentions[0]?.appointmentStartsAt ?? null,
        mentionCount: topicVisitCount || mentions.length,
        totalVisitCount,
      }),
      displayName: topic?.display_name ?? displayNameFromSlug(topicSlug),
      latestMentionAt: mentions[0]?.appointmentStartsAt ?? null,
      mentionCount: mentions.length,
      mentions,
      isSampleData,
      narrativeSummary: healthStoryNarrative({
        displayName: topic?.display_name ?? displayNameFromSlug(topicSlug),
        latestMentionAt: mentions[0]?.appointmentStartsAt ?? null,
        mentionCount: mentions.length,
        providerNames,
        relatedTopics: narrativeRelatedTopics.slice(0, 10),
        statuses,
        topicSlug,
        userContextTexts,
      }),
      ok: true,
      providerNames,
      relatedTopics,
      separateRelatedTopics,
      topicSlug,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), mentions: [], ok: false },
      { status: 400 }
    );
  }
}
