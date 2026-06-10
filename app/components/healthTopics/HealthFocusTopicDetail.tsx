"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { TopicContextLabelOverrides } from "@/app/lib/healthTopics/contextSignatureLabels";
import {
  cleanDate,
  cleanSourceSnippet,
  monthYear,
  seasonYear,
  type TopicContextSignature,
} from "@/app/lib/healthTopics/topicSummary";

import { TopicContextPills } from "./TopicContextPills";

export type HealthFocusTopicMention = {
  appointmentId: string | null;
  appointmentStartsAt: string | null;
  appointmentTitle: string;
  careSubjectId: string;
  confidence: number | null;
  createdAt: string;
  id: string;
  providerLabel: string;
  relatedTopicSlugs: string[];
  sourceSnippet: string | null;
  status: "follow_up" | "new" | "ongoing" | "resolved" | "unknown";
};

export type HealthFocusRelatedTopic = {
  displayName: string;
  mentionCount: number;
  relationshipState?: "unreviewed" | "related" | "separate";
  topicSlug: string;
};

export type HealthFocusTopicDetailData = {
  contextSignature: TopicContextSignature;
  displayName: string;
  isSampleData?: boolean;
  latestMentionAt: string | null;
  mentionCount: number;
  mentions: HealthFocusTopicMention[];
  narrativeSummary: string;
  providerNames: string[];
  relatedTopics: HealthFocusRelatedTopic[];
  separateRelatedTopics: HealthFocusRelatedTopic[];
  topicSlug: string;
};

export type HealthStoryFeedbackInput = {
  feedbackMode: "binary" | "clarification";
  feedbackValue?:
    | "looks_right"
    | "not_accurate"
    | "related"
    | "unrelated"
    | null;
  relatedTopicSlug?: string | null;
  targetType?: "health_story" | "topic_relationship";
  userComment?: string;
};

export type HealthStoryFeedbackResult = {
  contextId: string | null;
  feedbackId: string;
};

type HealthFocusTopicDetailProps = {
  contextLabelOverrides?: TopicContextLabelOverrides;
  detail: HealthFocusTopicDetailData | null;
  isLoading: boolean;
  onClose: () => void;
  onSubmitFeedback?: (
    feedback: HealthStoryFeedbackInput
  ) => Promise<HealthStoryFeedbackResult>;
  onUndoFeedback?: (feedback: HealthStoryFeedbackResult) => Promise<void>;
  contextPanel?: ReactNode;
  variant?: "inline" | "standalone";
};

type FeedbackAcknowledgement = HealthStoryFeedbackResult & {
  feedbackValue?: HealthStoryFeedbackInput["feedbackValue"];
  phrase: string;
  relatedTopicSlug?: string | null;
  summary: string;
  targetType?: HealthStoryFeedbackInput["targetType"];
  topicSlug: string;
};

const acknowledgementPhrases = [
  "Thank you — your context will improve future stories.",
  "Thank you — your context improves future stories.",
  "Thank you — your context helps build better stories.",
  "Thank you — your feedback helps improve your stories.",
  "Thank you — your care history improves with this feedback.",
  "Thank you — your context helps connect future visits.",
];

function DemoPill() {
  return (
    <span className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
      Demo
    </span>
  );
}

function savedVisitPhrase(mentionCount: number) {
  if (mentionCount <= 1) {
    return "Seen once";
  }

  if (mentionCount <= 3) {
    return "Seen a few times";
  }

  return "Seen several times";
}

function statusVisitPhrase(statuses: HealthFocusTopicMention["status"][]) {
  const labels: Record<HealthFocusTopicMention["status"], string> = {
    follow_up: "Follow-up",
    new: "New",
    ongoing: "Ongoing",
    resolved: "Resolved",
    unknown: "",
  };
  const uniqueStatuses = Array.from(
    new Set(statuses.filter((status) => status !== "unknown"))
  );
  const statusLabels = uniqueStatuses
    .map((status) => labels[status])
    .filter(Boolean);

  if (statusLabels.length === 0) {
    return "";
  }

  if (statusLabels.length === 1) {
    return `${statusLabels[0]} visits`;
  }

  if (statusLabels.length === 2) {
    return `${statusLabels[0]} and ${statusLabels[1].toLowerCase()} visits`;
  }

  return `${statusLabels
    .slice(0, -1)
    .map((label) => label.toLowerCase())
    .join(", ")}, and ${statusLabels.at(-1)?.toLowerCase()} visits`.replace(
    /^./,
    (letter) => letter.toUpperCase()
  );
}

function storyTimelineItems(mentions: HealthFocusTopicMention[]) {
  return mentions
    .filter((mention) => mention.appointmentStartsAt)
    .sort((left, right) => {
      return (
        new Date(left.appointmentStartsAt ?? 0).getTime() -
        new Date(right.appointmentStartsAt ?? 0).getTime()
      );
    })
    .map((mention) => ({
      id: mention.id,
      appointmentStartsAt: mention.appointmentStartsAt,
      providerLabel: mention.providerLabel,
      sourceSnippet:
        mention.sourceSnippet && !/^matched term:/i.test(mention.sourceSnippet)
          ? cleanSourceSnippet(mention.sourceSnippet)
          : null,
      title: mention.appointmentTitle || mention.providerLabel || "Saved visit",
      value: mention.appointmentStartsAt,
    }));
}

type TimelineItem = ReturnType<typeof storyTimelineItems>[number];

function timelineGroups(items: TimelineItem[]) {
  return items.reduce<Array<{ label: string; items: TimelineItem[] }>>(
    (groups, item) => {
      const label = seasonYear(item.value);
      const existingGroup = groups.find((group) => group.label === label);

      if (existingGroup) {
        existingGroup.items.push(item);
      } else {
        groups.push({ label, items: [item] });
      }

      return groups;
    },
    []
  );
}

export function HealthFocusTopicDetail({
  contextLabelOverrides,
  detail,
  isLoading,
  onClose,
  onSubmitFeedback,
  onUndoFeedback,
  contextPanel = null,
  variant = "standalone",
}: HealthFocusTopicDetailProps) {
  const [acknowledgement, setAcknowledgement] =
    useState<FeedbackAcknowledgement | null>(null);
  const [clarificationText, setClarificationText] = useState("");
  const [connectionClarificationText, setConnectionClarificationText] =
    useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [openTimelineItemId, setOpenTimelineItemId] = useState<string | null>(
    null
  );
  const [pendingFeedbackKey, setPendingFeedbackKey] = useState<string | null>(
    null
  );
  const [selectedRelatedTopicSlug, setSelectedRelatedTopicSlug] = useState<
    string | null
  >(null);
  const [separateTopicsOpen, setSeparateTopicsOpen] = useState(false);
  const [storyClarificationTopicSlug, setStoryClarificationTopicSlug] =
    useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const timelineItems = detail ? storyTimelineItems(detail.mentions) : [];
  const showTimeline = timelineItems.length >= 2;
  const groupedTimelineItems = timelineGroups(timelineItems);
  const relationshipTopics = detail
    ? [...detail.relatedTopics, ...detail.separateRelatedTopics]
    : [];
  const relationshipTopic =
    relationshipTopics.find(
      (relatedTopic) => relatedTopic.topicSlug === selectedRelatedTopicSlug
    ) ?? null;
  const relationshipTopicWasSeparate =
    relationshipTopic?.relationshipState === "separate";
  const relationshipAcknowledgement =
    acknowledgement?.targetType === "topic_relationship" &&
    acknowledgement.topicSlug === detail?.topicSlug &&
    relationshipTopic &&
    acknowledgement.relatedTopicSlug === relationshipTopic.topicSlug
      ? acknowledgement
      : null;
  const generalAcknowledgement =
    acknowledgement &&
    acknowledgement.topicSlug === detail?.topicSlug &&
    acknowledgement !== relationshipAcknowledgement
      ? acknowledgement
      : null;
  const canSubmitFeedback = Boolean(detail && onSubmitFeedback);
  const isInline = variant === "inline";
  const storyClarificationOpen =
    Boolean(detail?.topicSlug) && storyClarificationTopicSlug === detail?.topicSlug;
  const statusNarrative = detail
    ? statusVisitPhrase(detail.mentions.map((mention) => mention.status))
    : "";

  useEffect(() => {
    if (!acknowledgement) {
      return;
    }

    if (acknowledgement.targetType === "topic_relationship") {
      if (acknowledgement.feedbackValue === "related") {
        const timeoutId = window.setTimeout(() => {
          setAcknowledgement(null);
          setSelectedRelatedTopicSlug(null);
        }, 5000);

        return () => window.clearTimeout(timeoutId);
      }

      if (acknowledgement.feedbackValue === "unrelated") {
        if (connectionClarificationText.trim()) {
          return;
        }

        const timeoutId = window.setTimeout(() => {
          setAcknowledgement(null);
          setSelectedRelatedTopicSlug(null);
        }, 15000);

        return () => window.clearTimeout(timeoutId);
      }
    }

    const timeoutId = window.setTimeout(() => {
      setAcknowledgement(null);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [acknowledgement, connectionClarificationText]);

  if (!isLoading && !detail) {
    return null;
  }

  async function submitFeedback(
    key: string,
    feedback: HealthStoryFeedbackInput
  ) {
    if (!onSubmitFeedback) {
      return;
    }

    setFeedbackError("");
    setAcknowledgement(null);
    setPendingFeedbackKey(key);

    try {
      const result = await onSubmitFeedback(feedback);
      const isSimpleRelationshipConfirmation =
        feedback.targetType === "topic_relationship" &&
        (feedback.feedbackValue === "related" ||
          feedback.feedbackValue === "unrelated");
      setAcknowledgement({
        ...result,
        feedbackValue: feedback.feedbackValue,
        phrase: isSimpleRelationshipConfirmation
          ? "Thanks."
          : acknowledgementPhrase(),
        relatedTopicSlug: feedback.relatedTopicSlug ?? null,
        summary: acknowledgementSummary(feedback),
        targetType: feedback.targetType,
        topicSlug: detail?.topicSlug ?? "",
      });
      if (feedback.feedbackMode === "clarification") {
        setClarificationText("");
        setConnectionClarificationText("");
        if (feedback.targetType === "topic_relationship") {
          setSelectedRelatedTopicSlug(null);
        } else {
          setStoryClarificationTopicSlug(null);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Health Story feedback could not be saved.";
      setFeedbackError(message);
    } finally {
      setPendingFeedbackKey(null);
    }
  }

  async function undoFeedback() {
    if (!acknowledgement || !onUndoFeedback) {
      return;
    }

    setFeedbackError("");
    setPendingFeedbackKey("undo");

    try {
      await onUndoFeedback({
        contextId: acknowledgement.contextId,
        feedbackId: acknowledgement.feedbackId,
      });
      setAcknowledgement(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Health Story feedback could not be undone.";
      setFeedbackError(message);
    } finally {
      setPendingFeedbackKey(null);
    }
  }

  function acknowledgementPhrase() {
    return acknowledgementPhrases[
      Math.floor(Math.random() * acknowledgementPhrases.length)
    ];
  }

  function acknowledgementSummary(feedback: HealthStoryFeedbackInput) {
    if (feedback.feedbackMode === "clarification") {
      return "Additional context was added to this story.";
    }

    if (
      feedback.targetType === "topic_relationship" &&
      relationshipTopic &&
      detail
    ) {
      if (feedback.feedbackValue === "related") {
        return `${detail.displayName} is related to ${relationshipTopic.displayName}.`;
      }

      if (feedback.feedbackValue === "unrelated") {
        return `${detail.displayName} is separate from ${relationshipTopic.displayName}.`;
      }
    }

    if (feedback.feedbackValue === "looks_right") {
      return "This story was marked looks right.";
    }

    if (feedback.feedbackValue === "not_accurate") {
      return "This story was marked not quite.";
    }

    return "Your feedback was added to this story.";
  }

  return (
    <section
      className={
        isInline
          ? "mt-2 border-t border-blue-100 px-2 pt-2 sm:px-4"
          : "rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      }
    >
      {!isInline ? (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {detail?.displayName ?? "Loading topic"}
          </h2>
          {detail ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TopicContextPills
                labelOverrides={contextLabelOverrides}
                signature={detail.contextSignature}
              />
              {detail.isSampleData ? <DemoPill /> : null}
            </div>
          ) : null}
        </div>
        <button
          className="text-sm font-semibold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>
      ) : null}

      {isLoading ? (
        <p className="mt-2 text-sm text-slate-500">Loading...</p>
      ) : detail && detail.mentions.length > 0 ? (
        <>
          {detail.narrativeSummary.trim() ? (
            <div className="mt-2">
              <p className="text-sm leading-6 text-slate-700">
                {detail.narrativeSummary}
              </p>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              {savedVisitPhrase(detail.mentionCount)}
            </span>
            {statusNarrative ? (
              <span>{statusNarrative}</span>
            ) : null}
            {statusNarrative && detail.latestMentionAt ? (
              <span aria-hidden="true">·</span>
            ) : null}
            {detail.latestMentionAt ? (
              <span>{monthYear(detail.latestMentionAt)}</span>
            ) : null}
          </div>
          {detail.relatedTopics.length > 0 ||
          detail.separateRelatedTopics.length > 0 ? (
            <div className="mt-3 rounded-md bg-blue-50 py-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-6 text-blue-900">
                  <span className="font-semibold">Related topics:</span>
                  {detail.relatedTopics.map((relatedTopic, index) => {
                    const isSelected =
                      selectedRelatedTopicSlug === relatedTopic.topicSlug;

                    return (
                      <span
                        className="inline-flex items-baseline gap-x-2"
                        key={relatedTopic.topicSlug}
                      >
                        {index > 0 ? (
                          <span aria-hidden="true" className="text-blue-700">
                            •
                          </span>
                        ) : null}
                        <button
                          aria-expanded={isSelected}
                          className={`rounded-sm text-left font-semibold underline-offset-4 hover:underline ${
                            isSelected
                              ? "text-blue-950 underline"
                              : "text-blue-900"
                          }`}
                          onClick={() => {
                            setAcknowledgement(null);
                            setConnectionClarificationText("");
                            setFeedbackError("");
                            setStoryClarificationTopicSlug(null);
                            setSeparateTopicsOpen(false);
                            setSelectedRelatedTopicSlug(
                              isSelected ? null : relatedTopic.topicSlug
                            );
                          }}
                          type="button"
                        >
                          {relatedTopic.displayName}
                        </button>
                      </span>
                    );
                  })}
                  {detail.separateRelatedTopics.length > 0 ? (
                    <button
                      aria-expanded={separateTopicsOpen}
                      className="ml-1 rounded-sm text-left text-xs font-semibold text-blue-700 underline-offset-4 hover:text-blue-950 hover:underline"
                      onClick={() => {
                        setAcknowledgement(null);
                        setConnectionClarificationText("");
                        setFeedbackError("");
                        setStoryClarificationTopicSlug(null);
                        setSelectedRelatedTopicSlug(null);
                        setSeparateTopicsOpen((isOpen) => !isOpen);
                      }}
                      type="button"
                    >
                      Separate ({detail.separateRelatedTopics.length})
                    </button>
                  ) : null}
                </div>
              </div>
              {separateTopicsOpen ? (
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-6 text-blue-900">
                  <span className="font-semibold">Separate topics:</span>
                  {detail.separateRelatedTopics.map((relatedTopic, index) => {
                    const isSelected =
                      selectedRelatedTopicSlug === relatedTopic.topicSlug;

                    return (
                      <span
                        className="inline-flex items-baseline gap-x-2"
                        key={relatedTopic.topicSlug}
                      >
                        {index > 0 ? (
                          <span aria-hidden="true" className="text-blue-700">
                            •
                          </span>
                        ) : null}
                        <button
                          aria-expanded={isSelected}
                          className={`rounded-sm text-left font-semibold underline-offset-4 hover:underline ${
                            isSelected
                              ? "text-blue-950 underline"
                              : "text-blue-900"
                          }`}
                          onClick={() => {
                            setAcknowledgement(null);
                            setConnectionClarificationText("");
                            setFeedbackError("");
                            setStoryClarificationTopicSlug(null);
                            setSelectedRelatedTopicSlug(
                              isSelected ? null : relatedTopic.topicSlug
                            );
                          }}
                          type="button"
                        >
                          {relatedTopic.displayName}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null}
              {relationshipTopic ? (
                <div className="mt-3 rounded-md bg-white/80 p-3">
                  {relationshipAcknowledgement ? (
                    <>
                      <FeedbackAcknowledgementMessage
                        acknowledgement={relationshipAcknowledgement}
                        isUndoing={pendingFeedbackKey === "undo"}
                        onUndo={
                          relationshipAcknowledgement.feedbackValue ===
                          "unrelated"
                            ? undefined
                            : onUndoFeedback
                              ? undoFeedback
                              : undefined
                        }
                      />
                      {relationshipAcknowledgement.feedbackValue ===
                      "unrelated" ? (
                        <div className="mt-3">
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <label
                              className="sr-only"
                              htmlFor="health-story-connection-detail"
                            >
                              Add optional connection detail
                            </label>
                            <input
                              className="min-h-[40px] flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                              id="health-story-connection-detail"
                              onChange={(event) =>
                                setConnectionClarificationText(
                                  event.target.value
                                )
                              }
                              placeholder="Why are these separate?"
                              value={connectionClarificationText}
                            />
                            <button
                              className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50 disabled:opacity-60"
                              disabled={
                                Boolean(pendingFeedbackKey) ||
                                !connectionClarificationText.trim()
                              }
                              onClick={() =>
                                submitFeedback(
                                  `relationship-detail:${relationshipTopic.topicSlug}`,
                                  {
                                    feedbackMode: "clarification",
                                    feedbackValue: null,
                                    relatedTopicSlug:
                                      relationshipTopic.topicSlug,
                                    targetType: "topic_relationship",
                                    userComment: connectionClarificationText,
                                  }
                                )
                              }
                              type="button"
                            >
                              {pendingFeedbackKey ===
                              `relationship-detail:${relationshipTopic.topicSlug}`
                                ? "Saving..."
                                : "Add your detail"}
                            </button>
                          </div>
                          {onUndoFeedback ? (
                            <button
                              className="mt-2 text-sm font-semibold text-blue-800 underline-offset-2 hover:underline disabled:opacity-60"
                              disabled={pendingFeedbackKey === "undo"}
                              onClick={undoFeedback}
                              type="button"
                            >
                              {pendingFeedbackKey === "undo"
                                ? "Undoing..."
                                : "Undo"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  ) : relationshipTopicWasSeparate ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <p className="text-sm leading-6 text-slate-900">
                        {detail.displayName} was previously marked separate
                        from {relationshipTopic.displayName}.
                      </p>
                      <button
                        className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
                        disabled={Boolean(pendingFeedbackKey)}
                        onClick={() =>
                          submitFeedback(
                            `related:${relationshipTopic.topicSlug}`,
                            {
                              feedbackMode: "binary",
                              feedbackValue: "related",
                              relatedTopicSlug: relationshipTopic.topicSlug,
                              targetType: "topic_relationship",
                            }
                          )
                        }
                        type="button"
                      >
                        {pendingFeedbackKey ===
                        `related:${relationshipTopic.topicSlug}`
                          ? "Saving..."
                          : "Change to Related"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <p className="text-sm font-semibold leading-6 text-slate-900">
                        Is {detail.displayName} related to{" "}
                        {relationshipTopic.displayName}?
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                        <button
                          className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
                          disabled={Boolean(pendingFeedbackKey)}
                          onClick={() =>
                            submitFeedback(
                              `related:${relationshipTopic.topicSlug}`,
                              {
                                feedbackMode: "binary",
                                feedbackValue: "related",
                                relatedTopicSlug: relationshipTopic.topicSlug,
                                targetType: "topic_relationship",
                              }
                            )
                          }
                          type="button"
                        >
                          Related
                        </button>
                        <button
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          disabled={Boolean(pendingFeedbackKey)}
                          onClick={() =>
                            submitFeedback(
                              `unrelated:${relationshipTopic.topicSlug}`,
                              {
                                feedbackMode: "binary",
                                feedbackValue: "unrelated",
                                relatedTopicSlug: relationshipTopic.topicSlug,
                                targetType: "topic_relationship",
                              }
                            )
                          }
                          type="button"
                        >
                          Separate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
          {showTimeline ? (
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-semibold text-slate-900">Timeline</p>
                <button
                  className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                  onClick={() => {
                    setTimelineOpen((isOpen) => !isOpen);
                    setOpenTimelineItemId(null);
                  }}
                  type="button"
                >
                  {timelineOpen ? "Collapse" : "Expand"}
                </button>
              </div>
              {timelineOpen ? (
                <div className="mt-3 space-y-4">
                  {groupedTimelineItems.map((group) => (
                    <div key={group.label}>
                      <p className="text-sm font-semibold text-slate-900">
                        {group.label}
                      </p>
                      <div className="mt-2 space-y-2">
                        {group.items.map((item) => {
                          const isOpen = openTimelineItemId === item.id;

                          return (
                            <button
                              className="block w-full rounded-md px-2 py-2 text-left hover:bg-white"
                              key={item.id}
                              onClick={() =>
                                setOpenTimelineItemId(isOpen ? null : item.id)
                              }
                              type="button"
                            >
                              <span className="block text-sm font-semibold text-blue-900">
                                {item.title}
                              </span>
                              {isOpen ? (
                                <span className="mt-2 block rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
                                  {cleanDate(item.appointmentStartsAt)}
                                  {item.providerLabel ? (
                                    <>
                                      <br />
                                      {item.providerLabel}
                                    </>
                                  ) : null}
                                  {item.sourceSnippet ? (
                                    <>
                                      <br />
                                      <br />
                                      {item.sourceSnippet}
                                    </>
                                  ) : null}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {contextPanel ? <div className="mt-4">{contextPanel}</div> : null}
          {canSubmitFeedback ? (
            <div className="mt-4">
              {generalAcknowledgement ? (
                <div className="flex justify-center text-center">
                  <FeedbackAcknowledgementMessage
                    acknowledgement={generalAcknowledgement}
                    isUndoing={pendingFeedbackKey === "undo"}
                    onUndo={onUndoFeedback ? undoFeedback : undefined}
                  />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      This story
                    </p>
                    <button
                      className="rounded-full border border-blue-100 bg-white px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
                      disabled={Boolean(pendingFeedbackKey)}
                      onClick={() => {
                        setClarificationText("");
                        setStoryClarificationTopicSlug(null);
                        void submitFeedback("looks_right", {
                          feedbackMode: "binary",
                          feedbackValue: "looks_right",
                          targetType: "health_story",
                        });
                      }}
                      type="button"
                    >
                      {pendingFeedbackKey === "looks_right"
                        ? "Saving..."
                        : "Looks right"}
                    </button>
                    <button
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${
                        storyClarificationOpen
                          ? "border-blue-200 bg-blue-50 text-blue-900 ring-2 ring-blue-200"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                      aria-pressed={storyClarificationOpen}
                      disabled={Boolean(pendingFeedbackKey)}
                      onClick={() => {
                        setAcknowledgement(null);
                        setFeedbackError("");
                        setStoryClarificationTopicSlug(detail.topicSlug);
                      }}
                      type="button"
                    >
                      Not quite
                    </button>
                  </div>
                  {storyClarificationOpen ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <label
                        className="sr-only"
                        htmlFor="health-story-clarification"
                      >
                        Add a Health Story clarification
                      </label>
                      <input
                        className="min-h-[40px] flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-inner outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        id="health-story-clarification"
                        onChange={(event) =>
                          setClarificationText(event.target.value)
                        }
                        placeholder="Share anything you'd like different"
                        value={clarificationText}
                      />
                      <button
                        className="rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-50 disabled:opacity-60"
                        disabled={
                          Boolean(pendingFeedbackKey) ||
                          !clarificationText.trim()
                        }
                        onClick={() =>
                          submitFeedback("clarification", {
                            feedbackMode: "clarification",
                            feedbackValue: "not_accurate",
                            targetType: "health_story",
                            userComment: clarificationText,
                          })
                        }
                        type="button"
                      >
                        {pendingFeedbackKey === "clarification"
                          ? "Saving..."
                          : "Add your detail"}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
              {feedbackError ? (
                <p className="mt-2 text-sm font-semibold text-rose-700">
                  {feedbackError}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          No source mentions are available for this topic yet.
        </p>
      )}
    </section>
  );
}
function FeedbackAcknowledgementMessage({
  acknowledgement,
  isUndoing,
  onUndo,
}: {
  acknowledgement: FeedbackAcknowledgement;
  isUndoing: boolean;
  onUndo?: () => void;
}) {
  return (
    <div className="text-sm text-blue-900">
      <p>
        {acknowledgement.phrase} {acknowledgement.summary}
      </p>
      <div className="mt-2 flex flex-wrap gap-3">
        {onUndo ? (
          <button
            className="text-sm font-semibold text-blue-800 underline-offset-2 hover:underline disabled:opacity-60"
            disabled={isUndoing}
            onClick={onUndo}
            type="button"
          >
            {isUndoing ? "Undoing..." : "Undo"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
