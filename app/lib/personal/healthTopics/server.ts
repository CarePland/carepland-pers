import { createHash } from "node:crypto";
import { type SupabaseClient } from "@supabase/supabase-js";

import {
  extractTopicMentionsFromText,
  noteContentToText,
} from "./extraction";
import {
  normalizeTopicSlug,
  relatedTopicSlugsForMention,
  type HealthTopic,
} from ".";

type SupabaseClientLike = SupabaseClient;

type AppointmentNoteRow = {
  appointment_id: string;
  care_circle_id: string;
  followups: unknown;
  id: string;
  summary_short: string | null;
  takeaways: unknown;
};

type AppointmentRow = {
  care_circle_id: string;
  care_subject_id: string;
  id: string;
  provider_name: string | null;
  provider_organization: string | null;
  starts_at: string | null;
};

type HealthTopicRow = {
  aliases: string[];
  category: string;
  display_name: string;
  domain: "care_logistics" | "general" | "health";
  id: string;
  parent_topic_id?: string | null;
  slug: string;
};

type ExistingTopicMentionRow = {
  id: string;
  normalized_topic_slug: string;
  status: "follow_up" | "new" | "ongoing" | "resolved" | "unknown";
  status_source: "ai" | "system" | "user";
  status_updated_at: string | null;
  status_updated_by_user_id: string | null;
};

export type ExtractTopicMentionsForNoteResult = {
  appointmentId: string;
  extractedCount: number;
  insertedCount: number;
  noteId: string;
  topicSlugs: string[];
};

export async function extractTopicMentionsForNote({
  noteId,
  serviceClient,
  userClient,
}: {
  noteId: string;
  serviceClient: SupabaseClientLike;
  userClient: SupabaseClientLike;
}): Promise<ExtractTopicMentionsForNoteResult> {
  const { data: note, error: noteError } = await userClient
    .from("appointment_notes")
    .select("id,appointment_id,care_circle_id,summary_short,takeaways,followups")
    .eq("id", noteId)
    .single();

  if (noteError) {
    throw noteError;
  }

  const noteRow = note as AppointmentNoteRow | null;

  if (!noteRow) {
    throw new Error("Visit Notes were not found.");
  }

  const { data: appointment, error: appointmentError } = await userClient
    .from("appointments")
    .select("id,care_circle_id,care_subject_id,starts_at,provider_name,provider_organization")
    .eq("id", noteRow.appointment_id)
    .eq("care_circle_id", noteRow.care_circle_id)
    .single();

  if (appointmentError) {
    throw appointmentError;
  }

  const appointmentRow = appointment as AppointmentRow | null;

  if (!appointmentRow) {
    throw new Error("Appointment was not found for Visit Notes.");
  }

  const { data: topicRows, error: topicsError } = await serviceClient
    .from("health_topics")
    .select("id,slug,display_name,domain,category,aliases,parent_topic_id")
    .eq("is_active", true);

  if (topicsError) {
    throw topicsError;
  }

  const topics = ((topicRows ?? []) as HealthTopicRow[]).map(
    (topic): HealthTopic => ({
      aliases: topic.aliases ?? [],
      category: topic.category,
      displayName: topic.display_name,
      domain: topic.domain,
      parentSlug: topic.parent_topic_id ?? undefined,
      slug: topic.slug,
    })
  );
  const noteText = noteContentToText({
    followups: noteRow.followups,
    summaryShort: noteRow.summary_short,
    takeaways: noteRow.takeaways,
  });
  const extractedMentions = extractTopicMentionsFromText(noteText, topics);
  const noteTextHash = noteText
    ? createHash("sha256").update(noteText).digest("hex")
    : null;

  const { data: existingRows, error: existingError } = await serviceClient
    .from("topic_mentions")
    .select("id,normalized_topic_slug,status,status_source,status_updated_by_user_id,status_updated_at")
    .eq("appointment_id", appointmentRow.id)
    .eq("source_table", "appointment_notes")
    .eq("is_active", true);

  if (existingError) {
    throw existingError;
  }

  const existingMentions = (existingRows ?? []) as ExistingTopicMentionRow[];
  const existingByTopicSlug = new Map(
    existingMentions.map((mention) => [
      normalizeTopicSlug(mention.normalized_topic_slug),
      mention,
    ])
  );

  if (existingMentions.length > 0) {
    const { error: deactivateError } = await serviceClient
      .from("topic_mentions")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("appointment_id", appointmentRow.id)
      .eq("source_table", "appointment_notes")
      .eq("is_active", true);

    if (deactivateError) {
      throw deactivateError;
    }
  }

  if (extractedMentions.length === 0) {
    return {
      appointmentId: appointmentRow.id,
      extractedCount: 0,
      insertedCount: 0,
      noteId: noteRow.id,
      topicSlugs: [],
    };
  }

  const topicIdBySlug = new Map(
    ((topicRows ?? []) as HealthTopicRow[]).map((topic) => [topic.slug, topic])
  );
  const extractedTopicSlugs = extractedMentions.map((mention) => mention.topicSlug);
  const now = new Date().toISOString();
  const insertRows = extractedMentions.map((mention) => {
    const existingMention = existingByTopicSlug.get(mention.topicSlug);
    const preservedUserStatus =
      existingMention?.status_source === "user" ? existingMention : null;

    return {
      ai_suggested_status: mention.aiSuggestedStatus,
      appointment_id: appointmentRow.id,
      appointment_starts_at: appointmentRow.starts_at,
      care_circle_id: appointmentRow.care_circle_id,
      care_subject_id: appointmentRow.care_subject_id,
      confidence: mention.confidence,
      extraction_method: "catalog_match_v1",
      metadata: {
        matched_text: mention.matchedText,
      },
      model: null,
      normalized_topic_slug: mention.topicSlug,
      provider_name: appointmentRow.provider_name,
      provider_organization: appointmentRow.provider_organization,
      related_topic_slugs: relatedTopicSlugsForMention(
        mention.topicSlug,
        extractedTopicSlugs
      ),
      source_anchor: {
        fields: ["summary_short", "takeaways", "followups"],
        note_id: noteRow.id,
      },
      source_id: noteRow.id,
      source_snippet: mention.sourceSnippet || null,
      source_table: "appointment_notes",
      source_text_hash: noteTextHash,
      status: preservedUserStatus?.status ?? mention.status,
      status_source: preservedUserStatus ? "user" : "ai",
      status_updated_at: preservedUserStatus?.status_updated_at ?? now,
      status_updated_by_user_id:
        preservedUserStatus?.status_updated_by_user_id ?? null,
      topic_id: topicIdBySlug.get(mention.topicSlug)?.id ?? null,
      updated_at: now,
    };
  });

  const { error: insertError } = await serviceClient
    .from("topic_mentions")
    .insert(insertRows);

  if (insertError) {
    throw insertError;
  }

  return {
    appointmentId: appointmentRow.id,
    extractedCount: extractedMentions.length,
    insertedCount: insertRows.length,
    noteId: noteRow.id,
    topicSlugs: extractedMentions.map((mention) => mention.topicSlug),
  };
}
