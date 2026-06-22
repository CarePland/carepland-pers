"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { TopicContextLabelOverrides } from "@/app/lib/personal/healthTopics/contextSignatureLabels";
import type { TopicContextSignature } from "@/app/lib/personal/healthTopics/topicSummary";

const desktopVisibleTopicCount = 3;
const mobileVisibleTopicCount = 2;

export type HealthFocusTopicSummary = {
  category: string;
  careSubjectId: string;
  contextSignature: TopicContextSignature;
  displayName: string;
  domain: string;
  followUpCount: number;
  isPrimaryHealthFocus: boolean;
  isSampleData?: boolean;
  latestMentionAt: string | null;
  mentionCount: number;
  narrativeSummary: string;
  openCount: number;
  providerNames: string[];
  relatedTopicNames: string[];
  topicSlug: string;
};

type HealthFocusCardProps = {
  isLoading: boolean;
  contextLabelOverrides?: TopicContextLabelOverrides;
  onCloseTopic?: () => void;
  onExpandTopics?: (hiddenTopics: HealthFocusTopicSummary[]) => void;
  onSelectTopic: (topic: HealthFocusTopicSummary) => void;
  selectedTopicKey?: string | null;
  selectedTopicStory?: ReactNode;
  topics: HealthFocusTopicSummary[];
};

function topicKey(topic: HealthFocusTopicSummary) {
  return `${topic.careSubjectId}:${topic.topicSlug}`;
}

function getInitialVisibleTopicCount(isMobileViewport: boolean) {
  return isMobileViewport ? mobileVisibleTopicCount : desktopVisibleTopicCount;
}

function healthFocusIllustrationKind(topicName: string) {
  const normalizedName = topicName.toLowerCase();

  if (/\b(blood pressure|hypertension|heart|cardio|pulse)\b/.test(normalizedName)) {
    return "heart";
  }

  if (/\b(therapy|physical therapy|mobility|exercise|strength|rehab)\b/.test(normalizedName)) {
    return "movement";
  }

  if (/\b(nutrition|weight|diet|food|cholesterol|diabetes|glucose)\b/.test(normalizedName)) {
    return "nutrition";
  }

  if (/\b(medication|medicine|prescription|dose|pharmacy)\b/.test(normalizedName)) {
    return "medication";
  }

  if (/\b(sleep|fatigue|energy|tired)\b/.test(normalizedName)) {
    return "rest";
  }

  if (/\b(pain|ache|joint|knee|back|neck|shoulder)\b/.test(normalizedName)) {
    return "comfort";
  }

  if (/\b(breath|asthma|lung|cough|oxygen)\b/.test(normalizedName)) {
    return "breathing";
  }

  return "context";
}

export function HealthFocusIllustration({ topicName }: { topicName: string }) {
  const kind = healthFocusIllustrationKind(topicName);
  const palette: Record<
    ReturnType<typeof healthFocusIllustrationKind>,
    { bg: string; color: string; ring: string }
  > = {
    breathing: {
      bg: "bg-cyan-50",
      color: "text-cyan-700",
      ring: "ring-cyan-100",
    },
    comfort: {
      bg: "bg-violet-50",
      color: "text-violet-700",
      ring: "ring-violet-100",
    },
    context: {
      bg: "bg-slate-50",
      color: "text-slate-600",
      ring: "ring-slate-200",
    },
    heart: {
      bg: "bg-blue-50",
      color: "text-blue-700",
      ring: "ring-blue-100",
    },
    medication: {
      bg: "bg-emerald-50",
      color: "text-emerald-700",
      ring: "ring-emerald-100",
    },
    movement: {
      bg: "bg-green-50",
      color: "text-green-700",
      ring: "ring-green-100",
    },
    nutrition: {
      bg: "bg-orange-50",
      color: "text-orange-700",
      ring: "ring-orange-100",
    },
    rest: {
      bg: "bg-indigo-50",
      color: "text-indigo-700",
      ring: "ring-indigo-100",
    },
  };
  const colors = palette[kind];

  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full sm:h-7 sm:w-7 ${colors.bg} ${colors.color} ring-1 ${colors.ring}`}
    >
      <svg
        className="h-3.5 w-3.5 sm:h-4 sm:w-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 32 32"
      >
        {kind === "heart" ? (
          <>
            <path d="M9 16.5h3l2-5 4 10 2-5h3" />
            <path d="M16 25s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 24 14c0 6.2-8 11-8 11Z" />
          </>
        ) : null}
        {kind === "movement" ? (
          <>
            <circle cx="17" cy="7" r="2.2" />
            <path d="m14 14 4-2 3 4" />
            <path d="m18 12-2 7-5 4" />
            <path d="m16 19 5 4" />
            <path d="M8 20c1.5-5.5 4.5-9 9-10" />
          </>
        ) : null}
        {kind === "nutrition" ? (
          <>
            <path d="M12 24c-4-3-4-10 1-13 2 2 4 2 6 0 5 3 5 10 1 13-2-1-6-1-8 0Z" />
            <path d="M18 11c0-3 2-5 5-5" />
            <path d="M12 8c-1.5 0-3-.8-4-2" />
          </>
        ) : null}
        {kind === "medication" ? (
          <>
            <path d="m10 21 11-11a4 4 0 0 1 6 6L16 27a4 4 0 0 1-6-6Z" />
            <path d="m16 15 5 5" />
            <path d="M7 9h8" />
            <path d="M11 5v8" />
          </>
        ) : null}
        {kind === "rest" ? (
          <>
            <path d="M22 23a9 9 0 0 1-9-13 8 8 0 1 0 9 13Z" />
            <path d="M22 8h5l-5 6h5" />
          </>
        ) : null}
        {kind === "comfort" ? (
          <>
            <path d="M8 18c2-4 4.5-6 8-6s6 2 8 6" />
            <path d="M10 22h12" />
            <path d="M16 7v7" />
            <path d="M12 9h8" />
          </>
        ) : null}
        {kind === "breathing" ? (
          <>
            <path d="M15 8v17" />
            <path d="M15 14c-4-4-8-3-8 3v4c0 3 4 4 6 1 1-2 2-5 2-8Z" />
            <path d="M17 14c4-4 8-3 8 3v4c0 3-4 4-6 1-1-2-2-5-2-8Z" />
          </>
        ) : null}
        {kind === "context" ? (
          <>
            <circle cx="16" cy="16" r="7" />
            <path d="M16 9v7l4 3" />
            <path d="M7 24c2-2 4-3 7-3" />
            <path d="M18 11c2 1 4 3 5 6" />
          </>
        ) : null}
      </svg>
    </span>
  );
}

function mobileTopicLabel(topicName: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bphysical therapy\b/i, "Phys Therapy"],
    [/\bnutrition\s*\/\s*weight\b/i, "Nutrition"],
    [/\bdental\s*\/\s*oral health\b/i, "Dental"],
    [/\basthma\s*\/\s*breathing\b/i, "Asthma"],
    [/\bblood pressure\b/i, "Blood Pressure"],
  ];
  const replacement = replacements.find(([pattern]) =>
    pattern.test(topicName)
  )?.[1];

  if (replacement) {
    return replacement;
  }

  if (topicName.includes("/")) {
    return topicName.split(/\s*\/\s*/)[0]?.trim() || topicName;
  }

  return topicName;
}

function mobileTopicLabelSizeClass(label: string) {
  if (label.length > 14) {
    return "text-[0.68rem]";
  }

  if (label.length > 11) {
    return "text-[0.72rem]";
  }

  return "text-xs";
}

type HealthFocusTopicTileProps = {
  isSelected: boolean;
  onSelect: () => void;
  topic: HealthFocusTopicSummary;
};

function HealthFocusTopicTile({
  isSelected,
  onSelect,
  topic,
}: HealthFocusTopicTileProps) {
  const mobileLabel = mobileTopicLabel(topic.displayName);

  return (
    <button
      aria-pressed={isSelected}
      className={`group flex min-h-10 w-full max-w-full items-center rounded-full border px-2 py-1 text-left shadow-sm transition sm:min-h-12 sm:px-2.5 sm:py-1.5 ${
        isSelected
          ? "border-blue-200 bg-blue-50 text-blue-950 ring-2 ring-blue-100"
          : "border-slate-200 bg-white/85 text-slate-800 hover:border-blue-100 hover:bg-blue-50/50 hover:text-blue-950"
      }`}
      onClick={onSelect}
      onPointerDown={(event) => {
        event.preventDefault();
      }}
      type="button"
    >
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <HealthFocusIllustration topicName={topic.displayName} />
        <div className="min-w-0">
          <h3 className="truncate whitespace-nowrap font-semibold leading-tight sm:text-[0.95rem]">
            <span className={`sm:hidden ${mobileTopicLabelSizeClass(mobileLabel)}`}>
              {mobileLabel}
            </span>
            <span className="hidden sm:inline">{topic.displayName}</span>
          </h3>
        </div>
      </div>
    </button>
  );
}

export function HealthFocusCard({
  isLoading,
  onExpandTopics,
  onSelectTopic,
  selectedTopicKey = null,
  selectedTopicStory = null,
  topics,
}: HealthFocusCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const updateViewportState = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    updateViewportState();
    mediaQuery.addEventListener("change", updateViewportState);

    return () => {
      mediaQuery.removeEventListener("change", updateViewportState);
    };
  }, []);

  useEffect(() => {
    if (selectedTopicKey || topics.length === 0) {
      return;
    }

    onSelectTopic(topics[0]);
  }, [onSelectTopic, selectedTopicKey, topics]);

  if (isLoading && topics.length === 0) {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div>
          <p className="text-sm font-semibold text-blue-700">
            Your Health Focus
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Creating Your Health Focus
          </h2>
        </div>
        <div className="mt-5 space-y-3" role="status">
          <div className="h-3 w-40 rounded-full bg-slate-100" />
          <div className="h-3 w-full max-w-2xl rounded-full bg-slate-100" />
          <div className="h-3 w-3/4 max-w-xl rounded-full bg-slate-100" />
        </div>
      </section>
    );
  }

  if (topics.length === 0) {
    return null;
  }

  const visibleTopicCount = getInitialVisibleTopicCount(isMobileViewport);
  const hasHiddenTopics = topics.length > visibleTopicCount;
  const visibleTopics = isExpanded
    ? topics
    : topics.slice(0, visibleTopicCount);
  const selectedTopicIsVisible = visibleTopics.some(
    (topic) => topicKey(topic) === selectedTopicKey
  );
  const canShowSelectedStory = Boolean(
    selectedTopicKey && selectedTopicIsVisible && selectedTopicStory
  );
  const selectTopic = (topic: HealthFocusTopicSummary) => {
    onSelectTopic(topic);
  };

  return (
    <section
      aria-busy={isLoading}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      style={{ overflowAnchor: "none" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-blue-700">
            Your Health Focus
          </p>
        </div>
        {hasHiddenTopics ? (
          <button
            className="shrink-0 text-xs font-medium text-blue-700/80 underline-offset-2 hover:text-blue-900 hover:underline"
            onClick={() => {
              if (isExpanded) {
                const selectedTopicWillBeHidden =
                  selectedTopicKey &&
                  !topics
                    .slice(0, visibleTopicCount)
                    .some((topic) => topicKey(topic) === selectedTopicKey);

                if (selectedTopicWillBeHidden) {
                  selectTopic(topics[0]);
                }
              }

              setIsExpanded((currentValue) => {
                const nextValue = !currentValue;

                if (nextValue) {
                  onExpandTopics?.(topics.slice(visibleTopicCount));
                }

                return nextValue;
              });
            }}
            type="button"
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visibleTopics.map((topic) => {
          const key = topicKey(topic);
          const isSelected = selectedTopicKey === key;

          return (
            <HealthFocusTopicTile
              isSelected={isSelected}
              key={key}
              onSelect={() => selectTopic(topic)}
              topic={topic}
            />
          );
        })}
      </div>

      {canShowSelectedStory ? (
        <div
          className="mt-5 rounded-2xl border border-blue-100 bg-white p-3 sm:p-4"
          style={{ overflowAnchor: "none" }}
        >
          {selectedTopicStory}
        </div>
      ) : null}
    </section>
  );
}
