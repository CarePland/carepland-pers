import {
  buildTopicAliasMap,
  normalizeTopicSlug,
  resolveTopicSlug,
  truncateSourceSnippet,
  type HealthTopic,
  type TopicMentionStatus,
} from ".";

export type ExtractableNoteContent = {
  followups?: unknown;
  summaryShort?: string | null;
  takeaways?: unknown;
};

export type ExtractedTopicMention = {
  aiSuggestedStatus: TopicMentionStatus;
  confidence: number;
  matchedText: string;
  sourceSnippet: string;
  status: TopicMentionStatus;
  topicSlug: string;
};

export function noteContentToText(note: ExtractableNoteContent): string {
  return [
    note.summaryShort ?? "",
    ...unknownListToStrings(note.takeaways),
    ...unknownListToStrings(note.followups),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
}

export function extractTopicMentionsFromText(
  text: string,
  topics: HealthTopic[],
  options: {
    confidenceThreshold?: number;
    snippetMaxLength?: number;
  } = {}
): ExtractedTopicMention[] {
  const normalizedText = normalizeSearchText(text);

  if (!normalizedText) {
    return [];
  }

  const confidenceThreshold = options.confidenceThreshold ?? 0.58;
  const snippetMaxLength = options.snippetMaxLength ?? 160;
  const aliasMap = buildTopicAliasMap(topics);
  const mentionsBySlug = new Map<string, ExtractedTopicMention>();

  topics.forEach((topic) => {
    const searchableTerms = [topic.displayName, topic.slug, ...topic.aliases]
      .map((term) => term.trim())
      .filter(Boolean);

    searchableTerms.forEach((term) => {
      const normalizedTerm = normalizeSearchText(term.replaceAll("_", " "));

      if (!normalizedTerm || !containsSearchTerm(normalizedText, normalizedTerm)) {
        return;
      }

      const topicSlug = resolveTopicSlug(topic.slug, aliasMap);
      const confidence = confidenceForMatch(term, topic);

      if (confidence < confidenceThreshold) {
        return;
      }

      const currentMention = mentionsBySlug.get(topicSlug);

      if (currentMention && currentMention.confidence >= confidence) {
        return;
      }

      const status = statusForMatchedText(normalizedText);

      mentionsBySlug.set(topicSlug, {
        aiSuggestedStatus: status,
        confidence,
        matchedText: term,
        sourceSnippet: sourceSnippetForTerm(text, term, snippetMaxLength),
        status,
        topicSlug,
      });
    });
  });

  return Array.from(mentionsBySlug.values()).sort((left, right) => {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }

    return left.topicSlug.localeCompare(right.topicSlug);
  });
}

function unknownListToStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && "text" in item) {
        return String(item.text);
      }

      return "";
    })
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function containsSearchTerm(text: string, term: string): boolean {
  return new RegExp(`(^|\\s)${escapeRegExp(term)}(\\s|$)`).test(text);
}

function confidenceForMatch(term: string, topic: HealthTopic): number {
  const normalizedTermSlug = normalizeTopicSlug(term);

  if (normalizedTermSlug === topic.slug) {
    return 0.92;
  }

  if (normalizeTopicSlug(topic.displayName) === normalizedTermSlug) {
    return 0.9;
  }

  if (normalizedTermSlug.length <= 3) {
    return 0.68;
  }

  return 0.78;
}

function statusForMatchedText(normalizedText: string): TopicMentionStatus {
  if (/\b(resolved|improved|better|cleared|no longer)\b/.test(normalizedText)) {
    return "resolved";
  }

  if (/\b(follow up|followup|recheck|referral|monitor|next visit)\b/.test(normalizedText)) {
    return "follow_up";
  }

  if (/\b(new|started|first noticed|began)\b/.test(normalizedText)) {
    return "new";
  }

  return "ongoing";
}

function sourceSnippetForTerm(
  sourceText: string,
  matchedTerm: string,
  maxLength: number
): string {
  const normalizedSource = sourceText.replace(/\s+/g, " ").trim();
  const sourceLower = normalizedSource.toLowerCase();
  const termLower = matchedTerm.replaceAll("_", " ").toLowerCase();
  const index = sourceLower.indexOf(termLower);

  if (index < 0) {
    return truncateSourceSnippet(normalizedSource, maxLength);
  }

  const contextRadius = Math.max(20, Math.floor(maxLength / 2));
  const start = Math.max(0, index - contextRadius);
  const end = Math.min(
    normalizedSource.length,
    index + matchedTerm.length + contextRadius
  );

  return truncateSourceSnippet(normalizedSource.slice(start, end), maxLength);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
