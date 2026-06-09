import { normalizeTopicSlug } from "../healthTopics";

export type ReportType =
  | "care_timeline"
  | "custom"
  | "date_range_overview"
  | "medication_changes"
  | "topic_summary";

export type ReportDateRange = {
  end?: string | null;
  start?: string | null;
};

export type SavedReportDraft = {
  careCircleId: string;
  careSubjectId?: string | null;
  dateRange?: ReportDateRange;
  generatedSummary: string;
  reportType: ReportType;
  sourceAppointmentIds: string[];
  sourceTopicMentionIds?: string[];
  sourceTopicSummaryIds?: string[];
  title: string;
  topicSlug?: string | null;
};

export function normalizeReportTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function buildTopicReportTitle(topicDisplayName: string): string {
  const normalizedTopicName = normalizeReportTitle(topicDisplayName);

  if (!normalizedTopicName) {
    return "Topic Summary";
  }

  return `${normalizedTopicName} Summary`;
}

export function normalizeSavedReportDraft(
  draft: SavedReportDraft
): SavedReportDraft {
  return {
    ...draft,
    generatedSummary: draft.generatedSummary.trim(),
    sourceAppointmentIds: uniqueIds(draft.sourceAppointmentIds),
    sourceTopicMentionIds: uniqueIds(draft.sourceTopicMentionIds ?? []),
    sourceTopicSummaryIds: uniqueIds(draft.sourceTopicSummaryIds ?? []),
    title: normalizeReportTitle(draft.title),
    topicSlug: draft.topicSlug ? normalizeTopicSlug(draft.topicSlug) : null,
  };
}

function uniqueIds(ids: string[]): string[] {
  return ids
    .map((id) => id.trim())
    .filter(Boolean)
    .filter((id, index, allIds) => allIds.indexOf(id) === index);
}
