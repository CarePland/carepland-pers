"use client";

import type { ReactNode } from "react";

import type { TopicContextLabelOverrides } from "@/app/lib/healthTopics/contextSignatureLabels";
import type { TopicContextSignature } from "@/app/lib/healthTopics/topicSummary";

import { TopicContextPills } from "./TopicContextPills";

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
  onOpenAppointments: () => void;
  onCloseTopic?: () => void;
  onSelectTopic: (topic: HealthFocusTopicSummary) => void;
  selectedTopicKey?: string | null;
  selectedTopicStory?: ReactNode;
  topics: HealthFocusTopicSummary[];
};

function DemoPill() {
  return (
    <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
      Demo
    </span>
  );
}

export function HealthFocusCard({
  contextLabelOverrides,
  isLoading,
  onCloseTopic,
  onOpenAppointments,
  onSelectTopic,
  selectedTopicKey = null,
  selectedTopicStory = null,
  topics,
}: HealthFocusCardProps) {
  if (isLoading && topics.length === 0) {
    return (
      <section
        aria-busy="true"
        aria-live="polite"
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div>
          <p className="text-sm font-semibold text-blue-700">
            Past visit context
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

  return (
    <section
      aria-busy={isLoading}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-700">
            Past visit context
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Your Health Focus
          </h2>
        </div>
        <button
          className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50"
          onClick={onOpenAppointments}
          type="button"
        >
          View sources
        </button>
      </div>

      <div className="mt-4 divide-y divide-slate-200">
        {topics.map((topic) => {
          const topicKey = `${topic.careSubjectId}:${topic.topicSlug}`;
          const isSelected = selectedTopicKey === topicKey;

          return (
            <div
              className={isSelected ? "bg-blue-50 px-1 pb-3 sm:px-2" : ""}
              key={topicKey}
            >
              <button
                aria-pressed={isSelected}
                className={`block w-full px-1 text-left transition sm:px-2 ${
                  isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                } ${isSelected ? "pb-3 pt-3" : "py-4"}`}
                onClick={() => {
                  if (isSelected) {
                    onCloseTopic?.();
                    return;
                  }

                  onSelectTopic(topic);
                }}
                type="button"
              >
                <div className="relative min-w-0">
                  <span
                    className={`absolute right-0 top-0 text-xs font-semibold ${
                      isSelected
                        ? "text-slate-500 underline-offset-2"
                        : "rounded-full bg-white px-3 py-1 text-blue-800 ring-1 ring-blue-100"
                    }`}
                  >
                    {isSelected ? "Close Story" : "View Story"}
                  </span>

                  <div className="flex min-w-0 flex-col gap-2 pr-28 md:flex-row md:items-center md:gap-3">
                    <h3 className="max-w-[13rem] truncate text-base font-semibold text-slate-950 sm:max-w-[18rem] md:max-w-[22rem]">
                      {topic.displayName}
                    </h3>
                    <TopicContextPills
                      labelOverrides={contextLabelOverrides}
                      signature={topic.contextSignature}
                    />
                    {topic.isSampleData ? <DemoPill /> : null}
                  </div>

                  <div className="mt-2 min-w-0">
                    <p className="mt-2 max-w-none text-sm leading-6 text-slate-700 md:max-w-4xl">
                      {topic.narrativeSummary}
                    </p>
                  </div>
                </div>
              </button>
              {isSelected ? selectedTopicStory : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
