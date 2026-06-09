import { normalizeTopicSlug } from ".";

export type HealthTopicRelationshipState = "unreviewed" | "related" | "separate";

export type RelationshipFeedbackLike = {
  createdAt?: string | null;
  created_at?: string | null;
  relatedTopicSlug?: string | null;
  related_topic_slug?: string | null;
  relationshipFeedback?: "related" | "unrelated" | "unclear" | null;
  relationship_feedback?: "related" | "unrelated" | "unclear" | null;
};

export function relationshipStateFromFeedback(
  feedback: RelationshipFeedbackLike["relationshipFeedback"]
): HealthTopicRelationshipState {
  if (feedback === "related") {
    return "related";
  }

  if (feedback === "unrelated") {
    return "separate";
  }

  return "unreviewed";
}

export function relationshipStateFromContextText(
  contextText: string
): HealthTopicRelationshipState | null {
  if (/were marked related\.?$/i.test(contextText.trim())) {
    return "related";
  }

  if (/were marked (separate|unrelated)\.?$/i.test(contextText.trim())) {
    return "separate";
  }

  return null;
}

export function latestRelationshipStateMap(rows: RelationshipFeedbackLike[]) {
  const states = new Map<string, HealthTopicRelationshipState>();
  const sortedRows = [...rows].sort((left, right) => {
    const leftDate = left.createdAt ?? left.created_at ?? "";
    const rightDate = right.createdAt ?? right.created_at ?? "";

    return new Date(rightDate).getTime() - new Date(leftDate).getTime();
  });

  sortedRows.forEach((row) => {
    const relatedTopicSlug = normalizeTopicSlug(
      row.relatedTopicSlug ?? row.related_topic_slug ?? ""
    );

    if (!relatedTopicSlug || states.has(relatedTopicSlug)) {
      return;
    }

    states.set(
      relatedTopicSlug,
      relationshipStateFromFeedback(
        row.relationshipFeedback ?? row.relationship_feedback ?? null
      )
    );
  });

  return states;
}

export function relationshipContextSentence({
  relatedDisplayNames,
  relationshipState,
}: {
  relatedDisplayNames: string[];
  relationshipState: HealthTopicRelationshipState;
}) {
  const uniqueNames = Array.from(
    new Set(relatedDisplayNames.map((name) => name.trim()).filter(Boolean))
  );

  if (uniqueNames.length === 0 || relationshipState === "unreviewed") {
    return "";
  }

  if (relationshipState === "related") {
    if (uniqueNames.length === 1) {
      return `You noted ${uniqueNames[0]} is a Related Topic.`;
    }

    if (uniqueNames.length === 2) {
      return `You noted ${uniqueNames[0]} and ${uniqueNames[1]} are Related Topics.`;
    }

    return "You confirmed several proposed Related Topics.";
  }

  if (uniqueNames.length === 1) {
    return `You marked ${uniqueNames[0]} as a separate topic.`;
  }

  if (uniqueNames.length === 2) {
    return `You marked ${uniqueNames[0]} and ${uniqueNames[1]} as separate topics.`;
  }

  return "You marked several proposed Related Topics as separate.";
}
