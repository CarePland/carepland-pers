import { NextRequest, NextResponse } from "next/server";

import { normalizeTopicSlug } from "@/app/lib/personal/healthTopics";
import {
  relationshipContextSentence,
  relationshipStateFromContextText,
  relationshipStateFromFeedback,
  type HealthTopicRelationshipState,
} from "@/app/lib/personal/healthTopics/relationshipFeedback";
import {
  buildTopicContextSignature,
  healthFocusCardSummary,
  isPrimaryHealthFocusTopic,
  meaningfulRelatedTopics,
  type HealthStoryStatus,
} from "@/app/lib/personal/healthTopics/topicSummary";
import {
  createSupabaseUserClient,
  getActiveSupabaseUser,
} from "@/app/lib/platform/server/supabase";

const allCareSubjectsKey = "all";

type TopicMentionRow = {
  appointment_id: string | null;
  appointment_starts_at: string | null;
  care_subject_id: string;
  confidence: number | null;
  metadata: {
    is_sample_data?: boolean | string | null;
  } | null;
  normalized_topic_slug: string;
  provider_name: string | null;
  provider_organization: string | null;
  related_topic_slugs: string[] | null;
  status: "follow_up" | "new" | "ongoing" | "resolved" | "unknown";
};

type HealthTopicRow = {
  category: string;
  display_name: string;
  domain: string;
  slug: string;
};

type HealthTopicUserContextRow = {
  care_subject_id: string;
  context_text: string;
  context_type: string | null;
  related_topic_slug: string | null;
  structured_context: {
    relationship_feedback?: "related" | "unrelated" | "unclear" | null;
  } | null;
  topic_slug: string;
};

type RelationshipFeedbackRow = {
  care_subject_id: string;
  created_at: string;
  related_topic_slug: string | null;
  relationship_feedback: "related" | "unrelated" | "unclear" | null;
  topic_slug: string;
};

type TopicSummaryAccumulator = {
  category: string;
  careSubjectId: string;
  displayName: string;
  domain: string;
  firstMentionAt: string | null;
  followUpCount: number;
  isSampleData: boolean;
  latestMentionAt: string | null;
  mentionCount: number;
  openCount: number;
  providerNames: Set<string>;
  relatedTopicSlugs: Set<string>;
  sourceVisitIds: Set<string>;
  topicSlug: string;
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

function relationshipKey(
  careSubjectId: string,
  topicSlug: string,
  relatedTopicSlug: string
) {
  return `${careSubjectId}:${topicSlug}:${relatedTopicSlug}`;
}

function laterDate(
  currentDate: string | null,
  candidateDate: string | null
): string | null {
  if (!candidateDate) {
    return currentDate;
  }

  if (!currentDate) {
    return candidateDate;
  }

  return new Date(candidateDate).getTime() > new Date(currentDate).getTime()
    ? candidateDate
    : currentDate;
}

function earlierDate(
  currentDate: string | null,
  candidateDate: string | null
): string | null {
  if (!candidateDate) {
    return currentDate;
  }

  if (!currentDate) {
    return candidateDate;
  }

  return new Date(candidateDate).getTime() < new Date(currentDate).getTime()
    ? candidateDate
    : currentDate;
}

function metadataMarksSampleData(metadata: TopicMentionRow["metadata"]) {
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

    const careSubjectId =
      request.nextUrl.searchParams.get("careSubjectId")?.trim() ?? "";
    const userClient = createSupabaseUserClient(accessToken);
    await getActiveSupabaseUser(
      userClient,
      "Please sign in before loading Health Focus."
    );

    let mentionsQuery = userClient
      .from("topic_mentions")
      .select(
        "appointment_id,care_subject_id,normalized_topic_slug,appointment_starts_at,provider_name,provider_organization,related_topic_slugs,status,confidence,metadata"
      )
      .eq("is_active", true)
      .order("appointment_starts_at", { ascending: false, nullsFirst: false })
      .limit(500);

    if (careSubjectId) {
      mentionsQuery = mentionsQuery.eq("care_subject_id", careSubjectId);
    }

    const [
      { data: mentionRows, error: mentionsError },
      { data: topicRows, error: topicsError },
    ] = await Promise.all([
      mentionsQuery,
      userClient
        .from("health_topics")
        .select("slug,display_name,domain,category")
        .eq("is_active", true),
    ]);

    if (mentionsError) {
      throw mentionsError;
    }

    if (topicsError) {
      throw topicsError;
    }

    const topicsBySlug = new Map(
      ((topicRows ?? []) as HealthTopicRow[]).map((topic) => [topic.slug, topic])
    );
    const { data: contextRows, error: contextsError } = await userClient
      .from("health_topic_user_context")
      .select(
        "care_subject_id,topic_slug,context_text,context_type,related_topic_slug,structured_context"
      )
      .eq("incorporation_status", "active")
      .eq("should_influence_health_focus", true)
      .limit(500);
    const { data: relationshipFeedbackRows, error: relationshipFeedbackError } =
      await userClient
        .from("health_topic_feedback")
        .select(
          "care_subject_id,topic_slug,related_topic_slug,relationship_feedback,created_at"
        )
        .eq("target_type", "topic_relationship")
        .neq("incorporation_status", "ignored")
        .eq("should_influence_future_generation", true)
        .in("relationship_feedback", ["related", "unrelated"])
        .order("created_at", { ascending: false })
        .limit(500);
    const relationshipStatesByKey = new Map<string, HealthTopicRelationshipState>();

    if (!relationshipFeedbackError) {
      ((relationshipFeedbackRows ?? []) as RelationshipFeedbackRow[])
        .filter((row) => !careSubjectId || row.care_subject_id === careSubjectId)
        .forEach((row) => {
          const topicSlug = normalizeTopicSlug(row.topic_slug);
          const relatedTopicSlug = normalizeTopicSlug(
            row.related_topic_slug ?? ""
          );

          if (!topicSlug || !relatedTopicSlug) {
            return;
          }

          const key = relationshipKey(
            row.care_subject_id,
            topicSlug,
            relatedTopicSlug
          );

          if (relationshipStatesByKey.has(key)) {
            return;
          }

          relationshipStatesByKey.set(
            key,
            relationshipStateFromFeedback(row.relationship_feedback)
          );
        });
    }
    const contextTextsByKey = new Map<string, string[]>();
    const relationshipContextByKey = new Map<
      string,
      {
        freeformTexts: string[];
        related: string[];
        separate: string[];
      }
    >();

    if (!contextsError) {
      ((contextRows ?? []) as HealthTopicUserContextRow[])
        .filter((row) => !careSubjectId || row.care_subject_id === careSubjectId)
        .forEach((row) => {
          const topicSlug = normalizeTopicSlug(row.topic_slug);
          const relatedTopicSlug = normalizeTopicSlug(
            row.related_topic_slug ?? ""
          );
          const key = `${row.care_subject_id}:${topicSlug}`;
          const current = relationshipContextByKey.get(key) ?? {
            freeformTexts: [],
            related: [],
            separate: [],
          };

          if (row.context_type === "topic_relationship" && relatedTopicSlug) {
            const relationshipState = relationshipStatesByKey.get(
              relationshipKey(row.care_subject_id, topicSlug, relatedTopicSlug)
            );
            const contextRelationship =
              row.structured_context?.relationship_feedback ?? null;
            const contextState = contextRelationship
              ? relationshipStateFromFeedback(contextRelationship)
              : relationshipStateFromContextText(row.context_text);

            if (!contextState) {
              current.freeformTexts.push(row.context_text);
              relationshipContextByKey.set(key, current);
              return;
            }

            if (
              (relationshipState === "related" &&
                contextState !== "related") ||
              (relationshipState === "separate" &&
                contextState !== "separate")
            ) {
              relationshipContextByKey.set(key, current);
              return;
            }

            const effectiveState = relationshipState ?? contextState;

            if (effectiveState === "related" || effectiveState === "separate") {
              current[effectiveState].push(
                topicsBySlug.get(relatedTopicSlug)?.display_name ??
                  displayNameFromSlug(relatedTopicSlug)
              );
            }
          } else {
            current.freeformTexts.push(row.context_text);
          }

          relationshipContextByKey.set(key, current);
        });
    }

    relationshipContextByKey.forEach((context, key) => {
      contextTextsByKey.set(
        key,
        [
          ...context.freeformTexts,
          relationshipContextSentence({
            relatedDisplayNames: context.separate,
            relationshipState: "separate",
          }),
          relationshipContextSentence({
            relatedDisplayNames: context.related,
            relationshipState: "related",
          }),
        ].filter(Boolean)
      );
    });

    const mentionRowsForSummary = (mentionRows ?? []) as TopicMentionRow[];
    const totalVisitIdsByCareSubject = new Map<string, Set<string>>();
    const totalVisitIdsForAllSubjects = new Set<string>();

    mentionRowsForSummary.forEach((mention) => {
      const sourceVisitKey =
        mention.appointment_id ??
        `${mention.normalized_topic_slug}:${mention.appointment_starts_at ?? "unknown"}`;
      const visitIds =
        totalVisitIdsByCareSubject.get(mention.care_subject_id) ??
        new Set<string>();

      visitIds.add(sourceVisitKey);
      totalVisitIdsByCareSubject.set(mention.care_subject_id, visitIds);
      totalVisitIdsForAllSubjects.add(sourceVisitKey);
    });

    const summariesByKey = new Map<string, TopicSummaryAccumulator>();

    mentionRowsForSummary.forEach((mention) => {
      const topicSlug = mention.normalized_topic_slug;
      const topic = topicsBySlug.get(topicSlug);
      const summaryCareSubjectId = careSubjectId || allCareSubjectsKey;
      const key = `${summaryCareSubjectId}:${topicSlug}`;
      const current =
        summariesByKey.get(key) ??
        ({
          category: topic?.category ?? "general",
          careSubjectId: summaryCareSubjectId,
          displayName: topic?.display_name ?? displayNameFromSlug(topicSlug),
          domain: topic?.domain ?? "health",
          firstMentionAt: null,
          followUpCount: 0,
          isSampleData: false,
          latestMentionAt: null,
          mentionCount: 0,
          openCount: 0,
          providerNames: new Set<string>(),
          relatedTopicSlugs: new Set<string>(),
          sourceVisitIds: new Set<string>(),
          topicSlug,
        } satisfies TopicSummaryAccumulator);

      current.mentionCount += 1;
      current.isSampleData =
        current.isSampleData || metadataMarksSampleData(mention.metadata);
      current.firstMentionAt = earlierDate(
        current.firstMentionAt,
        mention.appointment_starts_at
      );
      current.latestMentionAt = laterDate(
        current.latestMentionAt,
        mention.appointment_starts_at
      );
      current.sourceVisitIds.add(
        mention.appointment_id ??
          `${mention.normalized_topic_slug}:${mention.appointment_starts_at ?? "unknown"}`
      );

      if (["follow_up", "new", "ongoing"].includes(mention.status)) {
        current.openCount += 1;
      }

      if (mention.status === "follow_up") {
        current.followUpCount += 1;
      }

      const providerLabel =
        mention.provider_organization?.trim() ||
        mention.provider_name?.trim() ||
        "";

      if (providerLabel) {
        current.providerNames.add(providerLabel);
      }

      (mention.related_topic_slugs ?? []).forEach((relatedTopicSlug) => {
        if (relatedTopicSlug && relatedTopicSlug !== topicSlug) {
          current.relatedTopicSlugs.add(relatedTopicSlug);
        }
      });

      summariesByKey.set(key, current);
    });

    const allTopics = Array.from(summariesByKey.values()).map((summary) => {
      const providerNames = Array.from(summary.providerNames).slice(0, 3);
      const relatedTopicSlugs = Array.from(summary.relatedTopicSlugs);
      const relatedTopicNames = relatedTopicSlugs
        .map((topicSlug) => ({
          displayName: topicsBySlug.get(topicSlug)?.display_name ?? "",
          topicSlug,
        }))
        .filter((topic) => Boolean(topic.displayName));
      const narrativeRelatedTopics = relatedTopicNames.slice(0, 8);
      const meaningfulTopics = meaningfulRelatedTopics(
        relatedTopicNames,
        { maxCount: 4 }
      );
      const meaningfulRelatedTopicNames = meaningfulTopics.map(
        (topic) => topic.displayName
      );
      const statuses = [
        ...Array(summary.followUpCount).fill("follow_up"),
        ...Array(Math.max(0, summary.openCount - summary.followUpCount)).fill(
          "ongoing"
        ),
      ] as HealthStoryStatus[];
      const totalVisitCount =
        summary.careSubjectId === allCareSubjectsKey
          ? totalVisitIdsForAllSubjects.size
          : totalVisitIdsByCareSubject.get(summary.careSubjectId)?.size ??
            summary.sourceVisitIds.size;
      const userContextTexts =
        summary.careSubjectId === allCareSubjectsKey
          ? Array.from(contextTextsByKey.entries())
              .filter(([key]) => key.endsWith(`:${summary.topicSlug}`))
              .flatMap(([, texts]) => texts)
          : contextTextsByKey.get(
              `${summary.careSubjectId}:${summary.topicSlug}`
            ) ?? [];

      return {
        careSubjectId: summary.careSubjectId,
        category: summary.category,
        contextSignature: buildTopicContextSignature({
          firstMentionAt: summary.firstMentionAt,
          latestMentionAt: summary.latestMentionAt,
          mentionCount: summary.sourceVisitIds.size || summary.mentionCount,
          totalVisitCount,
        }),
        displayName: summary.displayName,
        domain: summary.domain,
        followUpCount: summary.followUpCount,
        isPrimaryHealthFocus: isPrimaryHealthFocusTopic(
          summary.topicSlug,
          summary.category
        ),
        isSampleData: summary.isSampleData,
        latestMentionAt: summary.latestMentionAt,
        mentionCount: summary.mentionCount,
        narrativeSummary: healthFocusCardSummary({
          displayName: summary.displayName,
          mentionCount: summary.mentionCount,
          providerNames,
          relatedTopics: narrativeRelatedTopics,
          statuses,
          topicSlug: summary.topicSlug,
          userContextTexts,
        }),
        openCount: summary.openCount,
        providerNames,
        relatedTopicNames: meaningfulRelatedTopicNames,
        topicSlug: summary.topicSlug,
      };
    });
    const primaryTopics = allTopics.filter((topic) => topic.isPrimaryHealthFocus);
    const topics = (primaryTopics.length > 0 ? primaryTopics : allTopics)
      .sort((left, right) => {
        if (
          Number(right.isPrimaryHealthFocus) !==
          Number(left.isPrimaryHealthFocus)
        ) {
          return (
            Number(right.isPrimaryHealthFocus) -
            Number(left.isPrimaryHealthFocus)
          );
        }

        if (right.mentionCount !== left.mentionCount) {
          return right.mentionCount - left.mentionCount;
        }

        return new Date(right.latestMentionAt ?? 0).getTime() -
          new Date(left.latestMentionAt ?? 0).getTime();
      })
      .slice(0, 8);

    return NextResponse.json({
      ok: true,
      topics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), ok: false, topics: [] },
      { status: 400 }
    );
  }
}
