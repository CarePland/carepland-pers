export type AIReviewLevel = "high" | "low" | "medium" | "needs_review";

type AIReviewBadgeProps = {
  confidence?: number | null;
  labelOverride?: string;
};

const aiReviewSignalConfig: Record<
  AIReviewLevel,
  {
    className: string;
    label: string;
  }
> = {
  high: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    label: "High confidence",
  },
  low: {
    className: "border-rose-200 bg-rose-50 text-rose-800",
    label: "Low confidence",
  },
  medium: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    label: "Medium confidence",
  },
  needs_review: {
    className: "border-slate-900 bg-slate-900 text-white",
    label: "Needs review",
  },
};

export function aiReviewLevel(confidence?: number | null): AIReviewLevel {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return "needs_review";
  }

  if (confidence >= 0.8) {
    return "high";
  }

  if (confidence >= 0.5) {
    return "medium";
  }

  if (confidence > 0) {
    return "low";
  }

  return "needs_review";
}

export function AIReviewBadge({
  confidence,
  labelOverride,
}: AIReviewBadgeProps) {
  const level = aiReviewLevel(confidence);
  const signal = aiReviewSignalConfig[level];

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${signal.className}`}
    >
      {labelOverride ?? signal.label}
    </span>
  );
}
