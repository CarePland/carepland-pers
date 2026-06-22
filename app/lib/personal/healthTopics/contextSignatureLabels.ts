import type { TopicContextSignature } from "./topicSummary";

export type TopicContextResponsiveLabel = {
  full: string;
  short: string;
};

export type TopicContextLabelOverrides = {
  frequency?: Record<string, TopicContextResponsiveLabel>;
  recency?: Record<string, TopicContextResponsiveLabel>;
  span?: Record<string, TopicContextResponsiveLabel>;
};

export type TopicContextDisplaySignature = {
  frequencyLabel: TopicContextResponsiveLabel;
  recencyLabel: TopicContextResponsiveLabel;
  spanLabel: TopicContextResponsiveLabel;
};

export function parseTopicContextLabelOverrides(body: string) {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .reduce<Record<string, TopicContextResponsiveLabel>>((labels, line) => {
      const equalsIndex = line.indexOf("=");
      const colonIndex = line.indexOf(":");
      const separatorIndex =
        equalsIndex >= 0 && colonIndex >= 0
          ? Math.min(equalsIndex, colonIndex)
          : Math.max(equalsIndex, colonIndex);

      if (separatorIndex < 0) {
        return labels;
      }

      const source = line.slice(0, separatorIndex).trim();
      const displayParts = line
        .slice(separatorIndex + 1)
        .split(";")
        .map((part) => part.trim());
      const full = displayParts[0] ?? "";
      const short = displayParts[1] || full;

      if (source && full) {
        labels[source] = { full, short };
      }

      return labels;
    }, {});
}

export function applyTopicContextLabelOverrides(
  signature: TopicContextSignature,
  overrides: TopicContextLabelOverrides = {}
): TopicContextDisplaySignature {
  return {
    frequencyLabel: responsiveLabel(
      signature.frequencyLabel,
      overrides.frequency
    ),
    recencyLabel: responsiveLabel(signature.recencyLabel, overrides.recency),
    spanLabel: responsiveLabel(signature.spanLabel, overrides.span),
  };
}

function responsiveLabel(
  sourceLabel: string,
  overrides?: Record<string, TopicContextResponsiveLabel>
) {
  return overrides?.[sourceLabel] ?? { full: sourceLabel, short: sourceLabel };
}
