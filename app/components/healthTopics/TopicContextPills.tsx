"use client";

import {
  applyTopicContextLabelOverrides,
  type TopicContextLabelOverrides,
} from "@/app/lib/healthTopics/contextSignatureLabels";
import type { TopicContextSignature } from "@/app/lib/healthTopics/topicSummary";

type TopicContextPillsProps = {
  labelOverrides?: TopicContextLabelOverrides;
  signature: TopicContextSignature;
  variant?: "default" | "compact";
};

const pillStyles = {
  frequency:
    "border-emerald-200 bg-emerald-50 text-emerald-900 ring-emerald-100",
  recency: "border-blue-200 bg-blue-50 text-blue-900 ring-blue-100",
  span: "border-violet-200 bg-violet-50 text-violet-900 ring-violet-100",
};

export function TopicContextPills({
  labelOverrides,
  signature,
  variant = "default",
}: TopicContextPillsProps) {
  const displaySignature = applyTopicContextLabelOverrides(
    signature,
    labelOverrides
  );
  const pills = [
    {
      label: displaySignature.recencyLabel.full,
      shortLabel: displaySignature.recencyLabel.short,
      style: pillStyles.recency,
      title: "Recency",
    },
    {
      label: displaySignature.frequencyLabel.full,
      shortLabel: displaySignature.frequencyLabel.short,
      style: pillStyles.frequency,
      title: "Frequency",
    },
    {
      label: displaySignature.spanLabel.full,
      shortLabel: displaySignature.spanLabel.short,
      style: pillStyles.span,
      title: "Span",
    },
  ];

  return (
    <div
      aria-label="Topic context signature"
      className={`flex max-w-full flex-nowrap ${
        variant === "compact" ? "gap-1" : "gap-2"
      }`}
    >
      {pills.map((pill) => (
        <span
          className={
            variant === "compact"
              ? "whitespace-nowrap rounded px-1 py-0.5 text-[0.72rem] font-medium text-slate-500"
              : `whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ring-1 ${pill.style}`
          }
          key={pill.title}
          title={pill.title}
        >
          {variant === "compact" ? (
            pill.shortLabel
          ) : (
            <>
              <span className="sm:hidden">{pill.shortLabel}</span>
              <span className="hidden sm:inline">{pill.label}</span>
            </>
          )}
        </span>
      ))}
    </div>
  );
}
