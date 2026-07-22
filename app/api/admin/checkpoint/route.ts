import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import {
  buildCarePrepDecisionTrace,
  buildCarePrepStructuredInterpretation,
  normalizeCarePrepProposedOutput,
  type CarePrepCheckpointEvidencePacket,
  type CarePrepCheckpointGuidance,
  type CheckpointDecision,
  type CheckpointEvaluationTag,
} from "@/app/lib/checkpoint/careprep";
import { normalizeTopicSlug } from "@/app/lib/personal/healthTopics";
import { logOpenAiOperationCost } from "@/app/lib/platform/ai/operationLogs";
import {
  buildTopicContextSignature,
  healthFocusCardSummary,
  healthStoryNarrative,
  isPrimaryHealthFocusTopic,
  meaningfulRelatedTopics,
  type HealthStoryStatus,
} from "@/app/lib/personal/healthTopics/topicSummary";
import { requireAdminCaller } from "@/app/lib/platform/server/adminAuth";
import { isMissingServerEnvError } from "@/app/lib/platform/server/env";
import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "@/app/lib/platform/server/supabase";

type JsonObject = Record<string, unknown>;

type AdminUserActivityCareSubject = {
  care_circle_id?: string | null;
  display_name?: string | null;
  id: string;
  is_active?: boolean | null;
  subject_type?: string | null;
};

type AdminUserActivityRow = {
  care_subjects?: AdminUserActivityCareSubject[] | null;
  display_name?: string | null;
  email?: string | null;
  user_id: string;
};

type AppointmentRow = {
  care_circle_id: string;
  care_subject_id: string | null;
  id: string;
  provider_name?: string | null;
  provider_organization?: string | null;
  reason?: string | null;
  starts_at?: string | null;
  status?: string | null;
  title?: string | null;
};

type InstructionVersionRow = {
  content_hash?: string | null;
  id: string;
  model?: string | null;
  output_schema?: unknown;
  system_prompt: string;
  temperature?: number | null;
  user_prompt_template?: string | null;
  version_number: number;
};

type CheckpointRunRow = {
  account_user_id: string;
  appointment_id: string | null;
  care_subject_id: string | null;
  checkpoint_decision: CheckpointDecision | null;
  checkpoint_use_key: string;
  created_at: string;
  decision_trace: JsonObject;
  effective_evidence_range: JsonObject;
  evaluated_at: string | null;
  evaluation_tags: CheckpointEvaluationTag[] | null;
  evaluator_notes: string | null;
  evidence_packet: CarePrepCheckpointEvidencePacket;
  generation_status: string;
  generated_at: string;
  id: string;
  model_metadata: JsonObject;
  prompt_key: string | null;
  prompt_version: string | null;
  proposed_output: JsonObject;
  requested_range: JsonObject;
  structured_interpretation: JsonObject;
};

type TopicMentionRow = {
  appointment_id: string | null;
  appointment_starts_at: string | null;
  care_subject_id: string;
  confidence: number | null;
  created_at?: string | null;
  id?: string;
  metadata?: {
    is_sample_data?: boolean | string | null;
  } | null;
  normalized_topic_slug: string;
  provider_name: string | null;
  provider_organization: string | null;
  related_topic_slugs: string[] | null;
  source_snippet?: string | null;
  status: HealthStoryStatus;
};

type HealthTopicRow = {
  category: string;
  display_name: string;
  domain: string;
  slug: string;
};

type AppointmentTitleRow = {
  id: string;
  is_sample_data?: boolean | null;
  title: string | null;
};

type HealthStorySummaryAccumulator = {
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

const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

export async function GET(request: NextRequest) {
  try {
    const adminUserId = await requireAdmin(request);
    const adminClient = createSupabaseServiceClient();
    const mode = request.nextUrl.searchParams.get("mode") ?? "context";

    if (mode === "context") {
      return NextResponse.json(await loadContext(request, adminClient));
    }

    if (mode === "appointments") {
      const accountUserId = requiredParam(request, "accountUserId");
      const careSubjectId = requiredParam(request, "careSubjectId");
      const scope = await assertAccountCareSubjectScope(
        adminClient,
        accountUserId,
        careSubjectId
      );

      return NextResponse.json({
        appointments: await loadAppointments(adminClient, scope.careCircleId, careSubjectId),
        ok: true,
      });
    }

    if (mode === "health_stories") {
      const accountUserId = requiredParam(request, "accountUserId");
      const careSubjectId = requiredParam(request, "careSubjectId");
      await assertAccountCareSubjectScope(adminClient, accountUserId, careSubjectId);

      return NextResponse.json({
        ok: true,
        stories: await loadHealthStorySummaries(adminClient, careSubjectId),
      });
    }

    if (mode === "health_story_detail") {
      const accountUserId = requiredParam(request, "accountUserId");
      const careSubjectId = requiredParam(request, "careSubjectId");
      const topicSlug = requiredParam(request, "topicSlug");
      await assertAccountCareSubjectScope(adminClient, accountUserId, careSubjectId);
      const detail = await loadHealthStoryDetail(
        adminClient,
        careSubjectId,
        topicSlug
      );
      await auditCheckpointAccess(adminClient, adminUserId, "checkpoint_health_story_opened", {
        care_subject_id: careSubjectId,
        topic_slug: topicSlug,
      });

      return NextResponse.json({ detail, ok: true });
    }

    if (mode === "history") {
      return NextResponse.json({
        ok: true,
        runs: await loadHistory(adminClient, request),
      });
    }

    if (mode === "run") {
      const runId = requiredParam(request, "runId");
      const run = await loadRun(adminClient, runId);
      await auditCheckpointAccess(adminClient, adminUserId, "checkpoint_run_opened", {
        run_id: runId,
      });

      return NextResponse.json({ ok: true, run: presentRun(run) });
    }

    throw new Error("Unsupported Checkpoint request.");
  } catch (error) {
    return routeError(error, "Checkpoint data could not be loaded.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUserId = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as JsonObject;
    const action = typeof body.action === "string" ? body.action : "";
    const adminClient = createSupabaseServiceClient();

    if (action === "generate_careprep") {
      if (!openAiApiKey) {
        throw new Error("Missing OPENAI_API_KEY in environment variables.");
      }

      const accountUserId = stringBody(body, "accountUserId");
      const careSubjectId = stringBody(body, "careSubjectId");
      const appointmentId = stringBody(body, "appointmentId");
      const scope = await assertAccountCareSubjectScope(
        adminClient,
        accountUserId,
        careSubjectId
      );
      const run = await generateCarePrepCheckpointRun({
        accountUserId,
        adminClient,
        adminUserId,
        appointmentId,
        careCircleId: scope.careCircleId,
        careSubjectId,
      });

      return NextResponse.json({ ok: true, run: presentRun(run) });
    }

    if (action === "save_decision") {
      const runId = stringBody(body, "runId");
      const decision = checkpointDecision(body.decision);
      const tags = checkpointTags(body.tags);
      const notes =
        typeof body.notes === "string" ? body.notes.trim().slice(0, 4000) : "";
      const evaluatedAt = new Date().toISOString();
      const { data, error } = await adminClient
        .from("checkpoint_runs")
        .update({
          checkpoint_decision: decision,
          evaluated_at: evaluatedAt,
          evaluation_tags: tags,
          evaluator_id: adminUserId,
          evaluator_notes: notes || null,
        })
        .eq("id", runId)
        .select("*")
        .single();

      if (error) throw error;

      await auditCheckpointAccess(adminClient, adminUserId, "checkpoint_decision_saved", {
        decision,
        run_id: runId,
        tags,
      });

      return NextResponse.json({
        ok: true,
        run: presentRun(data as CheckpointRunRow),
      });
    }

    throw new Error("Unsupported Checkpoint action.");
  } catch (error) {
    return routeError(error, "Checkpoint action failed.");
  }
}

async function requireAdmin(request: NextRequest) {
  const { userId } = await requireAdminCaller(request, {
    adminRequiredMessage: "Admin access is required to use Checkpoint.",
    signInMessage: "Please sign in before using Checkpoint.",
  });

  return userId;
}

async function loadContext(request: NextRequest, adminClient: SupabaseClient) {
  const accessToken = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const userClient = createSupabaseUserClient(accessToken);
  const { data, error } = await userClient.rpc("get_admin_user_activity_summary");

  if (error) throw error;

  const rows = (data ?? []) as AdminUserActivityRow[];
  const accounts = rows
    .map((row) => {
      const careSubjects = (row.care_subjects ?? [])
        .filter((subject) => subject.id && subject.is_active !== false)
        .map((subject) => ({
          careCircleId: subject.care_circle_id ?? "",
          displayName: subject.display_name?.trim() || "Unnamed Care VIP",
          id: subject.id,
          subjectType: subject.subject_type ?? "person",
        }));

      return {
        careSubjects,
        email: row.email ?? null,
        id: row.user_id,
        label:
          row.display_name?.trim() ||
          row.email?.trim() ||
          `User ${row.user_id.slice(0, 8)}`,
      };
    })
    .filter((account) => account.careSubjects.length > 0);

  const { data: recentRuns, error: runsError } = await adminClient
    .from("checkpoint_runs")
    .select("*")
    .eq("checkpoint_use_key", "careprep")
    .order("created_at", { ascending: false })
    .limit(12);

  if (runsError) throw runsError;

  return {
    accounts,
    ok: true,
    recentRuns: ((recentRuns ?? []) as CheckpointRunRow[]).map(presentRun),
  };
}

async function loadHealthStorySummaries(
  adminClient: SupabaseClient,
  careSubjectId: string
) {
  const [
    { data: mentionRows, error: mentionsError },
    { data: topicRows, error: topicsError },
  ] = await Promise.all([
    adminClient
      .from("topic_mentions")
      .select(
        "appointment_id,care_subject_id,normalized_topic_slug,appointment_starts_at,provider_name,provider_organization,related_topic_slugs,status,confidence,metadata"
      )
      .eq("is_active", true)
      .eq("care_subject_id", careSubjectId)
      .order("appointment_starts_at", { ascending: false, nullsFirst: false })
      .limit(500),
    adminClient
      .from("health_topics")
      .select("slug,display_name,domain,category")
      .eq("is_active", true),
  ]);

  if (mentionsError) throw mentionsError;
  if (topicsError) throw topicsError;

  const topicsBySlug = new Map(
    ((topicRows ?? []) as HealthTopicRow[]).map((topic) => [topic.slug, topic])
  );
  const totalVisitIds = new Set<string>();
  const summariesByKey = new Map<string, HealthStorySummaryAccumulator>();

  ((mentionRows ?? []) as TopicMentionRow[]).forEach((mention) => {
    const topicSlug = mention.normalized_topic_slug;
    const topic = topicsBySlug.get(topicSlug);
    const sourceKey = sourceVisitKey(mention);
    const current =
      summariesByKey.get(topicSlug) ??
      ({
        category: topic?.category ?? "general",
        careSubjectId,
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
      } satisfies HealthStorySummaryAccumulator);

    current.mentionCount += 1;
    current.isSampleData =
      current.isSampleData || metadataMarksSampleData(mention.metadata ?? null);
    current.firstMentionAt = earlierDate(
      current.firstMentionAt,
      mention.appointment_starts_at
    );
    current.latestMentionAt = laterDate(
      current.latestMentionAt,
      mention.appointment_starts_at
    );
    current.sourceVisitIds.add(sourceKey);
    totalVisitIds.add(sourceKey);

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
      const normalizedRelatedTopicSlug = normalizeTopicSlug(relatedTopicSlug);
      if (normalizedRelatedTopicSlug && normalizedRelatedTopicSlug !== topicSlug) {
        current.relatedTopicSlugs.add(normalizedRelatedTopicSlug);
      }
    });

    summariesByKey.set(topicSlug, current);
  });

  const stories = Array.from(summariesByKey.values()).map((summary) => {
    const providerNames = Array.from(summary.providerNames).slice(0, 3);
    const relatedTopicNames = Array.from(summary.relatedTopicSlugs)
      .map((topicSlug) => ({
        displayName: topicsBySlug.get(topicSlug)?.display_name ?? "",
        topicSlug,
      }))
      .filter((topic) => Boolean(topic.displayName));
    const meaningfulRelatedTopicNames = meaningfulRelatedTopics(
      relatedTopicNames,
      { maxCount: 4 }
    ).map((topic) => topic.displayName);
    const statuses = [
      ...Array(summary.followUpCount).fill("follow_up"),
      ...Array(Math.max(0, summary.openCount - summary.followUpCount)).fill(
        "ongoing"
      ),
    ] as HealthStoryStatus[];

    return {
      careSubjectId,
      category: summary.category,
      contextSignature: buildTopicContextSignature({
        firstMentionAt: summary.firstMentionAt,
        latestMentionAt: summary.latestMentionAt,
        mentionCount: summary.sourceVisitIds.size || summary.mentionCount,
        totalVisitCount: totalVisitIds.size,
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
        relatedTopics: relatedTopicNames.slice(0, 8),
        statuses,
        topicSlug: summary.topicSlug,
        userContextTexts: [],
      }),
      openCount: summary.openCount,
      providerNames,
      relatedTopicNames: meaningfulRelatedTopicNames,
      topicSlug: summary.topicSlug,
    };
  });

  const primaryStories = stories.filter((story) => story.isPrimaryHealthFocus);

  return (primaryStories.length > 0 ? primaryStories : stories)
    .sort((left, right) => {
      if (Number(right.isPrimaryHealthFocus) !== Number(left.isPrimaryHealthFocus)) {
        return Number(right.isPrimaryHealthFocus) - Number(left.isPrimaryHealthFocus);
      }

      if (right.mentionCount !== left.mentionCount) {
        return right.mentionCount - left.mentionCount;
      }

      return (
        new Date(right.latestMentionAt ?? 0).getTime() -
        new Date(left.latestMentionAt ?? 0).getTime()
      );
    })
    .slice(0, 24);
}

async function loadHealthStoryDetail(
  adminClient: SupabaseClient,
  careSubjectId: string,
  requestedTopicSlug: string
) {
  const topicSlug = normalizeTopicSlug(requestedTopicSlug);
  if (!topicSlug) throw new Error("Choose a Health Story.");

  const [
    { data: topicRows, error: topicError },
    { data: mentionRows, error: mentionsError },
  ] = await Promise.all([
    adminClient
      .from("health_topics")
      .select("slug,display_name,domain,category")
      .eq("is_active", true),
    adminClient
      .from("topic_mentions")
      .select(
        "id,care_subject_id,appointment_id,appointment_starts_at,provider_name,provider_organization,related_topic_slugs,source_snippet,status,confidence,created_at,metadata,normalized_topic_slug"
      )
      .eq("is_active", true)
      .eq("care_subject_id", careSubjectId)
      .eq("normalized_topic_slug", topicSlug)
      .order("appointment_starts_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  if (topicError) throw topicError;
  if (mentionsError) throw mentionsError;

  const topicRowsList = (topicRows ?? []) as HealthTopicRow[];
  const topic =
    topicRowsList.find((topicRow) => topicRow.slug === topicSlug) ?? null;
  const topicDisplayNames = new Map(
    topicRowsList.map((topicRow) => [topicRow.slug, topicRow.display_name])
  );
  const mentionRowsList = (mentionRows ?? []) as TopicMentionRow[];
  const appointmentIds = Array.from(
    new Set(
      mentionRowsList
        .map((mention) => mention.appointment_id)
        .filter((appointmentId): appointmentId is string => Boolean(appointmentId))
    )
  );
  const { data: appointmentRows, error: appointmentsError } =
    appointmentIds.length > 0
      ? await adminClient
          .from("appointments")
          .select("id,title,is_sample_data")
          .in("id", appointmentIds)
      : { data: [], error: null };

  if (appointmentsError) throw appointmentsError;

  const appointmentsById = new Map(
    ((appointmentRows ?? []) as AppointmentTitleRow[]).map((appointment) => [
      appointment.id,
      appointment,
    ])
  );
  const relatedTopicCounts = new Map<string, number>();
  const mentions = mentionRowsList.map((mention) => {
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

    const appointment = mention.appointment_id
      ? appointmentsById.get(mention.appointment_id)
      : null;

    return {
      appointmentId: mention.appointment_id,
      appointmentStartsAt: mention.appointment_starts_at,
      appointmentTitle: appointment?.title ?? "",
      careSubjectId: mention.care_subject_id,
      confidence: mention.confidence,
      createdAt: mention.created_at ?? "",
      id: mention.id ?? crypto.randomUUID(),
      providerLabel:
        mention.provider_organization?.trim() ||
        mention.provider_name?.trim() ||
        "",
      relatedTopicSlugs: mention.related_topic_slugs ?? [],
      sourceSnippet: mention.source_snippet ?? null,
      status: mention.status,
    };
  });
  const allRelatedTopics = Array.from(relatedTopicCounts.entries())
    .map(([relatedTopicSlug, mentionCount]) => ({
      displayName:
        topicDisplayNames.get(relatedTopicSlug) ??
        displayNameFromSlug(relatedTopicSlug),
      mentionCount,
      relationshipState: "unreviewed" as const,
      topicSlug: relatedTopicSlug,
    }))
    .sort((left, right) => {
      if (right.mentionCount !== left.mentionCount) {
        return right.mentionCount - left.mentionCount;
      }

      return left.displayName.localeCompare(right.displayName);
    });
  const relatedTopics = meaningfulRelatedTopics(allRelatedTopics, {
    maxCount: 6,
  }).map((relatedTopic) => ({
    ...relatedTopic,
    mentionCount:
      allRelatedTopics.find(
        (topicItem) => topicItem.topicSlug === relatedTopic.topicSlug
      )?.mentionCount ?? 1,
    relationshipState: "unreviewed" as const,
  }));
  const providerNames = Array.from(
    new Set(mentions.map((mention) => mention.providerLabel).filter(Boolean))
  ).slice(0, 4);
  const allTopicMentions = await loadCareSubjectTopicMentionVisitKeys(
    adminClient,
    careSubjectId
  );
  const sortedMentionDates = mentions
    .map((mention) => mention.appointmentStartsAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
  const latestMentionAt = sortedMentionDates[sortedMentionDates.length - 1] ?? null;

  return {
    contextSignature: buildTopicContextSignature({
      firstMentionAt: sortedMentionDates[0] ?? null,
      latestMentionAt,
      mentionCount: new Set(mentions.map((mention) => sourceVisitKey(mention))).size,
      totalVisitCount: allTopicMentions.size,
    }),
    displayName: topic?.display_name ?? displayNameFromSlug(topicSlug),
    isSampleData: mentionRowsList.some(
      (mention) =>
        metadataMarksSampleData(mention.metadata ?? null) ||
        Boolean(
          mention.appointment_id &&
            appointmentsById.get(mention.appointment_id)?.is_sample_data
        )
    ),
    latestMentionAt,
    mentionCount: mentions.length,
    mentions,
    narrativeSummary: healthStoryNarrative({
      displayName: topic?.display_name ?? displayNameFromSlug(topicSlug),
      latestMentionAt,
      mentionCount: mentions.length,
      providerNames,
      relatedTopics: allRelatedTopics.slice(0, 10),
      statuses: mentions.map((mention) => mention.status),
      topicSlug,
      userContextTexts: [],
    }),
    providerNames,
    relatedTopics,
    separateRelatedTopics: [],
    topicSlug,
  };
}

async function loadCareSubjectTopicMentionVisitKeys(
  adminClient: SupabaseClient,
  careSubjectId: string
) {
  const { data, error } = await adminClient
    .from("topic_mentions")
    .select("appointment_id,appointment_starts_at,care_subject_id,normalized_topic_slug")
    .eq("is_active", true)
    .eq("care_subject_id", careSubjectId)
    .limit(500);

  if (error) throw error;

  return new Set(((data ?? []) as TopicMentionRow[]).map(sourceVisitKey));
}

async function assertAccountCareSubjectScope(
  adminClient: SupabaseClient,
  accountUserId: string,
  careSubjectId: string
) {
  const { data: subject, error: subjectError } = await adminClient
    .from("care_subjects")
    .select("id,care_circle_id,display_name,is_active")
    .eq("id", careSubjectId)
    .single();

  if (subjectError) throw subjectError;

  if (!subject || subject.is_active === false) {
    throw new Error("Selected Care VIP is not available.");
  }

  const { data: membership, error: membershipError } = await adminClient
    .from("care_circle_memberships")
    .select("care_circle_id")
    .eq("care_circle_id", subject.care_circle_id)
    .eq("user_id", accountUserId)
    .limit(1);

  if (membershipError) throw membershipError;

  if (!membership || membership.length === 0) {
    throw new Error("Selected Care VIP does not belong to the selected account.");
  }

  return {
    careCircleId: subject.care_circle_id as string,
    careSubjectName: subject.display_name as string | null,
  };
}

async function loadAppointments(
  adminClient: SupabaseClient,
  careCircleId: string,
  careSubjectId: string
) {
  const { data, error } = await adminClient
    .from("appointments")
    .select(
      "id,title,reason,starts_at,status,provider_name,provider_organization,care_circle_id,care_subject_id"
    )
    .eq("care_circle_id", careCircleId)
    .eq("care_subject_id", careSubjectId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .order("starts_at", { ascending: false })
    .limit(40);

  if (error) throw error;

  return ((data ?? []) as AppointmentRow[]).map((appointment) => ({
    id: appointment.id,
    label: appointmentLabel(appointment),
    providerName: appointment.provider_name ?? appointment.provider_organization ?? null,
    startsAt: appointment.starts_at ?? null,
    status: appointment.status ?? null,
    title: appointment.title ?? appointment.reason ?? "Untitled appointment",
  }));
}

async function generateCarePrepCheckpointRun({
  accountUserId,
  adminClient,
  adminUserId,
  appointmentId,
  careCircleId,
  careSubjectId,
}: {
  accountUserId: string;
  adminClient: SupabaseClient;
  adminUserId: string;
  appointmentId: string;
  careCircleId: string;
  careSubjectId: string;
}) {
  const { data: appointment, error: appointmentError } = await adminClient
    .from("appointments")
    .select("id,care_circle_id,care_subject_id,title,reason,starts_at,status")
    .eq("id", appointmentId)
    .eq("care_circle_id", careCircleId)
    .eq("care_subject_id", careSubjectId)
    .single();

  if (appointmentError) throw appointmentError;

  const appointmentRow = appointment as AppointmentRow;
  const { data: instructionSets, error: instructionSetError } = await adminClient
    .from("ai_instruction_sets")
    .select("id,instruction_key")
    .eq("care_circle_id", careCircleId)
    .eq("instruction_key", "careprep_generation")
    .eq("is_active", true)
    .limit(1);

  if (instructionSetError) throw instructionSetError;

  const instructionSet = instructionSets?.[0];

  if (!instructionSet) {
    throw new Error("Create a current CarePrep instruction set before generating.");
  }

  const { data: instructionVersions, error: instructionVersionError } =
    await adminClient
      .from("ai_instruction_versions")
      .select(
        "id,version_number,system_prompt,user_prompt_template,output_schema,model,temperature,content_hash"
      )
      .eq("instruction_set_id", instructionSet.id)
      .eq("is_current", true)
      .limit(1);

  if (instructionVersionError) throw instructionVersionError;

  const instructionVersion = instructionVersions?.[0] as
    | InstructionVersionRow
    | undefined;

  if (!instructionVersion) {
    throw new Error("Create a current CarePrep instruction version before generating.");
  }

  const evidencePacket = await buildEvidencePacket(
    adminClient,
    appointmentRow,
    careSubjectId
  );
  const { guidance, model, openAiJson } = await runCarePrepGeneration(
    instructionVersion,
    evidencePacket
  );
  const generatedAt = new Date().toISOString();
  const runId = crypto.randomUUID();
  const structuredInterpretation = buildCarePrepStructuredInterpretation(
    guidance,
    evidencePacket
  );
  const proposedOutput = normalizeCarePrepProposedOutput(guidance);
  const decisionTrace = buildCarePrepDecisionTrace(
    runId,
    guidance,
    evidencePacket,
    generatedAt
  );
  const promptVersion = `careprep_generation:v${instructionVersion.version_number}`;

  const { data: insertedRun, error: insertError } = await adminClient
    .from("checkpoint_runs")
    .insert({
      account_user_id: accountUserId,
      appointment_id: appointmentId,
      care_circle_id: careCircleId,
      care_subject_id: careSubjectId,
      checkpoint_use_key: "careprep",
      decision_trace: decisionTrace,
      effective_evidence_range: effectiveEvidenceRange(evidencePacket),
      evidence_packet: evidencePacket,
      generation_status: "succeeded",
      generated_at: generatedAt,
      generated_by_user_id: adminUserId,
      id: runId,
      model_metadata: {
        model: instructionVersion.model ?? "gpt-4.1-mini",
        temperature: instructionVersion.temperature ?? 0.2,
      },
      prompt_key: "careprep_generation",
      prompt_version: promptVersion,
      proposed_output: proposedOutput,
      requested_range: {
        appointmentId,
        type: "selected_appointment_with_prior_same_care_vip_context",
      },
      structured_interpretation: structuredInterpretation,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;

  // Checkpoint's own CarePrep generation calls OpenAI directly and was the
  // one AI workflow in the app that never fed the shared cost-log table --
  // every other generation path (personal CarePrep, Import Anything, Ask,
  // Home context) does. Logging here closes that specific gap rather than
  // leaving Admin cost totals silently undercounting Checkpoint usage.
  await logOpenAiOperationCost({
    careCircleId,
    metadata: {
      admin_user_id: adminUserId,
      appointment_id: appointmentId,
      care_subject_id: careSubjectId,
    },
    model,
    openAiJson,
    operationKey: "checkpoint_careprep_generation",
    operationLabel: "Checkpoint CarePrep generation",
    promptVersion,
    sourceId: runId,
    sourceTable: "checkpoint_runs",
    supabase: adminClient,
    userId: accountUserId,
  });

  await auditCheckpointAccess(adminClient, adminUserId, "checkpoint_run_generated", {
    appointment_id: appointmentId,
    care_subject_id: careSubjectId,
    checkpoint_use_key: "careprep",
    run_id: runId,
  });

  return insertedRun as CheckpointRunRow;
}

async function buildEvidencePacket(
  adminClient: SupabaseClient,
  appointment: AppointmentRow,
  careSubjectId: string
): Promise<CarePrepCheckpointEvidencePacket> {
  const { data: careSubject, error: careSubjectError } = await adminClient
    .from("care_subjects")
    .select("id,display_name")
    .eq("id", careSubjectId)
    .single();

  if (careSubjectError) throw careSubjectError;

  const { data: currentNotes, error: currentNotesError } = await adminClient
    .from("appointment_notes")
    .select("appointment_id,summary_short,takeaways,followups,created_at")
    .eq("appointment_id", appointment.id)
    .eq("is_current", true)
    .limit(1);

  if (currentNotesError) throw currentNotesError;

  let priorAppointmentsQuery = adminClient
    .from("appointments")
    .select("id,title,reason,starts_at,status,care_subject_id")
    .eq("care_circle_id", appointment.care_circle_id)
    .eq("care_subject_id", careSubjectId)
    .neq("id", appointment.id)
    .neq("status", "archived")
    .is("deleted_at", null)
    .order("starts_at", { ascending: false })
    .limit(8);

  if (appointment.starts_at) {
    priorAppointmentsQuery = priorAppointmentsQuery.lt(
      "starts_at",
      appointment.starts_at
    );
  }

  const { data: priorAppointments, error: priorAppointmentsError } =
    await priorAppointmentsQuery;

  if (priorAppointmentsError) throw priorAppointmentsError;

  const priorAppointmentRows = (priorAppointments ?? []) as AppointmentRow[];
  const priorAppointmentIds = priorAppointmentRows.map((row) => row.id);
  const { data: priorNotes, error: priorNotesError } =
    priorAppointmentIds.length > 0
      ? await adminClient
          .from("appointment_notes")
          .select("appointment_id,created_at,summary_short,takeaways,followups")
          .in("appointment_id", priorAppointmentIds)
          .eq("is_current", true)
      : { data: [], error: null };

  if (priorNotesError) throw priorNotesError;

  const priorNoteRows = (priorNotes ?? []) as Array<
    Record<string, unknown> & { appointment_id?: string | null }
  >;

  return {
    future_appointment: {
      care_vip_name: String(careSubject?.display_name ?? "Care VIP"),
      current_note: (currentNotes?.[0] as Record<string, unknown>) ?? null,
      id: appointment.id,
      reason: appointment.reason ?? null,
      starts_at: appointment.starts_at ?? null,
      status: appointment.status ?? null,
      title: appointment.title ?? null,
    },
    generation_mode: "admin_checkpoint",
    past_appointment_total_count: priorAppointmentRows.length,
    past_appointments: priorAppointmentRows.map((priorAppointment) => ({
      id: priorAppointment.id,
      note:
        priorNoteRows.find(
          (note) => note.appointment_id === priorAppointment.id
        ) ?? null,
      reason: priorAppointment.reason ?? null,
      starts_at: priorAppointment.starts_at ?? null,
      status: priorAppointment.status ?? null,
      title: priorAppointment.title ?? null,
    })),
  };
}

async function runCarePrepGeneration(
  instructionVersion: InstructionVersionRow,
  evidencePacket: CarePrepCheckpointEvidencePacket
): Promise<{
  guidance: CarePrepCheckpointGuidance;
  model: string;
  openAiJson: JsonObject;
}> {
  const schema =
    instructionVersion.output_schema &&
    typeof instructionVersion.output_schema === "object"
      ? instructionVersion.output_schema
      : {
          additionalProperties: false,
          properties: {
            beforeVisit: { items: { type: "string" }, type: "array" },
            duringVisit: { items: { type: "string" }, type: "array" },
            intro: { type: "string" },
          },
          required: ["beforeVisit", "duringVisit"],
          type: "object",
        };
  const userPrompt = [
    instructionVersion.user_prompt_template
      ? `Instruction template:\n${instructionVersion.user_prompt_template}`
      : "",
    `Future appointment:\n${JSON.stringify(evidencePacket.future_appointment, null, 2)}`,
    `Past appointments:\n${JSON.stringify(evidencePacket.past_appointments ?? [], null, 2)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const model = instructionVersion.model ?? "gpt-4.1-mini";
  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        { content: instructionVersion.system_prompt, role: "system" },
        { content: userPrompt, role: "user" },
      ],
      model,
      temperature: instructionVersion.temperature ?? 0.2,
      text: {
        format: {
          name: "careprep_checkpoint_generation",
          schema,
          strict: false,
          type: "json_schema",
        },
      },
    }),
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const openAiJson = (await openAiResponse.json()) as JsonObject;

  if (!openAiResponse.ok) {
    const apiError =
      openAiJson.error && typeof openAiJson.error === "object"
        ? (openAiJson.error as JsonObject).message
        : null;
    throw new Error(String(apiError ?? "OpenAI CarePrep generation failed."));
  }

  const parsed = JSON.parse(responseText(openAiJson)) as JsonObject;

  return {
    guidance: {
      beforeVisit: textList(parsed.beforeVisit ?? parsed.before_visit ?? parsed.bring_list).slice(0, 3),
      duringVisit: textList(parsed.duringVisit ?? parsed.during_visit ?? parsed.key_questions).slice(0, 4),
      intro:
        typeof (parsed.intro ?? parsed.summary) === "string"
          ? String(parsed.intro ?? parsed.summary).trim().slice(0, 180)
          : "",
    },
    model,
    openAiJson,
  };
}

async function loadHistory(adminClient: SupabaseClient, request: NextRequest) {
  let query = adminClient
    .from("checkpoint_runs")
    .select("*")
    .eq("checkpoint_use_key", "careprep")
    .order("created_at", { ascending: false })
    .limit(50);
  const accountUserId = request.nextUrl.searchParams.get("accountUserId");
  const careSubjectId = request.nextUrl.searchParams.get("careSubjectId");
  const decision = request.nextUrl.searchParams.get("decision");

  if (accountUserId) query = query.eq("account_user_id", accountUserId);
  if (careSubjectId) query = query.eq("care_subject_id", careSubjectId);
  if (decision) query = query.eq("checkpoint_decision", decision);

  const { data, error } = await query;

  if (error) throw error;

  return ((data ?? []) as CheckpointRunRow[]).map(presentRun);
}

async function loadRun(adminClient: SupabaseClient, runId: string) {
  const { data, error } = await adminClient
    .from("checkpoint_runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (error) throw error;

  return data as CheckpointRunRow;
}

function presentRun(run: CheckpointRunRow) {
  const output = run.proposed_output as CarePrepCheckpointGuidance &
    Record<string, unknown>;
  const appointment = run.evidence_packet?.future_appointment;

  return {
    accountUserId: run.account_user_id,
    appointmentId: run.appointment_id,
    appointmentLabel:
      appointment?.title || appointment?.reason || run.appointment_id || "Appointment",
    careSubjectId: run.care_subject_id,
    checkpointDecision: run.checkpoint_decision,
    checkpointUseKey: run.checkpoint_use_key,
    createdAt: run.created_at,
    decisionTrace: run.decision_trace,
    effectiveEvidenceRange: run.effective_evidence_range,
    evaluatedAt: run.evaluated_at,
    evaluationTags: run.evaluation_tags ?? [],
    evaluatorNotes: run.evaluator_notes ?? "",
    evidencePacket: run.evidence_packet,
    generationStatus: run.generation_status,
    generatedAt: run.generated_at,
    id: run.id,
    modelMetadata: run.model_metadata,
    promptKey: run.prompt_key,
    promptVersion: run.prompt_version,
    proposedOutput: output,
    scope: {
      careVipName: appointment?.care_vip_name ?? "Care VIP",
      startsAt: appointment?.starts_at ?? null,
      status: appointment?.status ?? null,
    },
    structuredInterpretation: run.structured_interpretation,
  };
}

function responseText(response: JsonObject): string {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];

  return output
    .flatMap((item) => {
      if (!item || typeof item !== "object" || !("content" in item)) return [];
      const content = Array.isArray(item.content) ? item.content : [];
      return content.map((contentItem: unknown) => {
        if (
          contentItem &&
          typeof contentItem === "object" &&
          "text" in contentItem
        ) {
          return String(contentItem.text);
        }

        return "";
      });
    })
    .join("")
    .trim();
}

function effectiveEvidenceRange(evidencePacket: CarePrepCheckpointEvidencePacket) {
  const dates = [
    evidencePacket.future_appointment?.starts_at,
    ...(evidencePacket.past_appointments ?? []).map((appointment) => appointment.starts_at),
  ].filter((value): value is string => Boolean(value));
  const sorted = [...dates].sort();

  return {
    end: sorted[sorted.length - 1] ?? null,
    start: sorted[0] ?? null,
  };
}

function appointmentLabel(appointment: AppointmentRow) {
  const title = appointment.title?.trim() || appointment.reason?.trim() || "Appointment";
  const date = appointment.starts_at
    ? new Date(appointment.starts_at).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return [title, date].filter(Boolean).join(" · ");
}

function displayNameFromSlug(slug: string): string {
  return slug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function metadataMarksSampleData(metadata: TopicMentionRow["metadata"]) {
  const value = metadata?.is_sample_data;

  return value === true || value === "true";
}

function sourceVisitKey(mention: {
  appointmentId?: string | null;
  appointment_id?: string | null;
  appointmentStartsAt?: string | null;
  appointment_starts_at?: string | null;
  careSubjectId?: string;
  care_subject_id?: string;
  normalized_topic_slug?: string;
  topicSlug?: string;
}) {
  return (
    mention.appointment_id ??
    mention.appointmentId ??
    [
      mention.careSubjectId ?? mention.care_subject_id ?? "unknown",
      mention.normalized_topic_slug ?? mention.topicSlug ?? "topic",
      mention.appointmentStartsAt ?? mention.appointment_starts_at ?? "unknown",
    ].join(":")
  );
}

function laterDate(
  currentDate: string | null,
  candidateDate: string | null
): string | null {
  if (!candidateDate) return currentDate;
  if (!currentDate) return candidateDate;

  return new Date(candidateDate).getTime() > new Date(currentDate).getTime()
    ? candidateDate
    : currentDate;
}

function earlierDate(
  currentDate: string | null,
  candidateDate: string | null
): string | null {
  if (!candidateDate) return currentDate;
  if (!currentDate) return candidateDate;

  return new Date(candidateDate).getTime() < new Date(currentDate).getTime()
    ? candidateDate
    : currentDate;
}

function checkpointDecision(value: unknown): CheckpointDecision {
  if (
    value === "hold" ||
    value === "needs_more_evidence" ||
    value === "needs_work" ||
    value === "proceed" ||
    value === "suppress"
  ) {
    return value;
  }

  throw new Error("Select a Checkpoint Decision.");
}

function checkpointTags(value: unknown): CheckpointEvaluationTag[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((tag): tag is CheckpointEvaluationTag => typeof tag === "string")
    .slice(0, 30);
}

function textList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "text" in item) {
        return String(item.text).trim();
      }

      return "";
    })
    .filter(Boolean);
}

function requiredParam(request: NextRequest, name: string) {
  const value = request.nextUrl.searchParams.get(name)?.trim() ?? "";
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function stringBody(body: JsonObject, key: string) {
  const value = typeof body[key] === "string" ? String(body[key]).trim() : "";
  if (!value) throw new Error(`Missing ${key}.`);
  return value;
}

async function auditCheckpointAccess(
  adminClient: SupabaseClient,
  adminUserId: string,
  eventType: string,
  metadata: JsonObject
) {
  try {
    await adminClient.from("admin_access_events").insert({
      actor_user_id: adminUserId,
      event_type: eventType,
      metadata,
      permission_scope: "admin_checkpoint",
      reason: "CarePland Checkpoint Admin evaluation",
      resource_type: "checkpoint_run",
    });
  } catch {
    // Checkpoint should remain usable if audit logging has a transient issue.
  }
}

function routeError(error: unknown, fallback: string) {
  if (isMissingServerEnvError(error)) {
    return NextResponse.json(
      { error: "CarePland is missing required server configuration.", ok: false },
      { status: 500 }
    );
  }

  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error || fallback);

  return NextResponse.json({ error: message || fallback, ok: false }, { status: 400 });
}
