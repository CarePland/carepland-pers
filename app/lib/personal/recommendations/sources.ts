import type {
  RecommendationInputSource,
  RecommendationSourceType,
} from ".";

export type RecommendationAppointmentRow = {
  care_circle_id: string;
  care_subject_id: string;
  id: string;
  provider_name?: string | null;
  starts_at?: string | null;
  title?: string | null;
};

export type RecommendationAppointmentNoteRow = {
  appointment_id: string;
  created_at?: string | null;
  followups?: unknown;
  id: string;
  input_text?: string | null;
  source?: string | null;
  summary_short?: string | null;
  takeaways?: unknown;
};

export type RecommendationCarePrepRow = {
  appointment_id: string;
  bring_list?: unknown;
  generated_at?: string | null;
  id: string;
  key_questions?: unknown;
  med_review?: unknown;
  next_steps?: unknown;
  since_last_visit?: unknown;
  summary?: string | null;
  watchouts?: unknown;
};

export type RecommendationTopicMentionRow = {
  appointment_starts_at?: string | null;
  confidence?: number | null;
  created_at?: string | null;
  id: string;
  normalized_topic_slug?: string | null;
  source_id?: string | null;
  source_snippet?: string | null;
  source_table?: string | null;
};

export type RecommendationTrackEventRow = {
  confidence?: number | null;
  event_type?: string | null;
  id: string;
  note?: string | null;
  occurred_at?: string | null;
  source?: string | null;
  title?: string | null;
};

export type RecommendationSourceRows = {
  appointmentNotes?: RecommendationAppointmentNoteRow[];
  appointments?: RecommendationAppointmentRow[];
  carePrepGuidance?: RecommendationCarePrepRow[];
  topicMentions?: RecommendationTopicMentionRow[];
  trackEvents?: RecommendationTrackEventRow[];
};

export function buildRecommendationInputSources({
  appointmentNotes = [],
  appointments = [],
  carePrepGuidance = [],
  topicMentions = [],
  trackEvents = [],
}: RecommendationSourceRows): RecommendationInputSource[] {
  const appointmentsById = new Map(
    appointments.map((appointment) => [appointment.id, appointment])
  );

  return [
    ...appointmentNotes.flatMap((row) =>
      sourceFromTextParts({
        confidence: 0.85,
        evidenceText: firstText(row.summary_short, row.input_text, row.takeaways, row.followups),
        occurredAt: row.created_at ?? appointmentsById.get(row.appointment_id)?.starts_at ?? null,
        sourceId: row.id,
        sourceLabel: appointmentLabel(appointmentsById.get(row.appointment_id), "Visit note"),
        sourceTable: "appointment_notes",
        sourceType: "appointment_note",
        textParts: [row.summary_short, row.input_text, row.takeaways, row.followups],
      })
    ),
    ...carePrepGuidance.flatMap((row) =>
      sourceFromTextParts({
        confidence: 0.8,
        evidenceText: firstText(
          row.summary,
          row.next_steps,
          row.watchouts,
          row.med_review,
          row.key_questions,
          row.bring_list
        ),
        occurredAt: row.generated_at ?? appointmentsById.get(row.appointment_id)?.starts_at ?? null,
        sourceId: row.id,
        sourceLabel: appointmentLabel(appointmentsById.get(row.appointment_id), "CarePrep"),
        sourceTable: "careprep_guidance",
        sourceType: "careprep_guidance",
        textParts: [
          row.summary,
          row.key_questions,
          row.bring_list,
          row.watchouts,
          row.med_review,
          row.since_last_visit,
          row.next_steps,
        ],
      })
    ),
    ...topicMentions.flatMap((row) =>
      sourceFromTextParts({
        confidence: row.confidence ?? 0.65,
        evidenceText: firstText(row.source_snippet, row.normalized_topic_slug),
        occurredAt: row.appointment_starts_at ?? row.created_at ?? null,
        sourceId: row.id,
        sourceLabel: "Health Focus",
        sourceTable: "topic_mentions",
        sourceType: "health_focus",
        textParts: [row.normalized_topic_slug, row.source_snippet],
      })
    ),
    ...trackEvents.flatMap((row) =>
      sourceFromTextParts({
        confidence: row.confidence ?? 0.6,
        evidenceText: firstText(row.title, row.note, row.event_type),
        occurredAt: row.occurred_at ?? null,
        sourceId: row.id,
        sourceLabel: "Track history",
        sourceTable: "track_events",
        sourceType: "track_history",
        textParts: [row.event_type, row.title, row.note],
      })
    ),
  ];
}

function sourceFromTextParts({
  confidence,
  evidenceText,
  occurredAt,
  sourceId,
  sourceLabel,
  sourceTable,
  sourceType,
  textParts,
}: {
  confidence: number;
  evidenceText: string;
  occurredAt: string | null;
  sourceId: string;
  sourceLabel: string;
  sourceTable: string;
  sourceType: RecommendationSourceType;
  textParts: unknown[];
}): RecommendationInputSource[] {
  const text = compactText(...textParts);

  if (!text) {
    return [];
  }

  return [
    {
      confidence,
      evidenceText: evidenceText || text,
      occurredAt,
      sourceId,
      sourceLabel,
      sourceTable,
      sourceType,
      text,
    },
  ];
}

function appointmentLabel(
  appointment: RecommendationAppointmentRow | undefined,
  fallback: string
) {
  const title = appointment?.title?.trim();
  const provider = appointment?.provider_name?.trim();

  return [title, provider].filter(Boolean).join(" - ") || fallback;
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = compactText(value);

    if (text) {
      return text.slice(0, 500);
    }
  }

  return "";
}

function compactText(...values: unknown[]): string {
  return values
    .flatMap((value) => textFragments(value))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function textFragments(value: unknown): string[] {
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap(textFragments);
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(textFragments);
  }

  return [];
}
