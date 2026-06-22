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
  if (
    /(is|are) (a )?(related topic|related)\.?$/i.test(contextText.trim()) ||
    /were marked related\.?$/i.test(contextText.trim()) ||
    /topics as related\.?$/i.test(contextText.trim())
  ) {
    return "related";
  }

  if (
    /(is|are) (a )?separate( topic| topics)?\.?$/i.test(contextText.trim()) ||
    /were marked (separate|unrelated)\.?$/i.test(contextText.trim()) ||
    /topics as separate\.?$/i.test(contextText.trim())
  ) {
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
      return `You noted ${uniqueNames[0]} is related.`;
    }

    if (uniqueNames.length === 2) {
      return `You noted ${uniqueNames[0]} and ${uniqueNames[1]} are related.`;
    }

    return "You marked several topics as related.";
  }

  if (uniqueNames.length === 1) {
    return `You noted ${uniqueNames[0]} is separate.`;
  }

  if (uniqueNames.length === 2) {
    return `You noted ${uniqueNames[0]} and ${uniqueNames[1]} are separate.`;
  }

  return "You marked several topics as separate.";
}
