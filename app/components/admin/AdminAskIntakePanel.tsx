"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";

export type AskRoutingState =
  | "admin_overridden"
  | "auto_routed"
  | "closed"
  | "needs_review"
  | "new";

export type AdminAskSubmission = {
  ai_summary: string;
  context: Record<string, unknown> | null;
  created_at: string;
  current_page: string | null;
  id: string;
  model: string | null;
  original_user_wording: string;
  prompt_version: string | null;
  recommended_actions: Array<Record<string, unknown>> | null;
  review_note: string | null;
  reviewed_at: string | null;
  router_category: string;
  router_confidence: number | string;
  router_rationale: string;
  routing_state: AskRoutingState;
  safety_flags: Record<string, unknown> | null;
  source: string;
  thread_id: string;
  transcript: string;
  updated_at: string;
  user_id: string;
  user_label: string;
};

export type AskRecommendationDecision = {
  ask_submission_id: string;
  created_at: string;
  created_target_id: string | null;
  created_target_table: string | null;
  decision: "accepted" | "overridden" | "rejected";
  decision_note: string | null;
  id: string;
  override_action: string | null;
  recommended_action: Record<string, unknown>;
  recommended_action_index: number | null;
};

export type AskSubmissionLink = {
  ask_submission_id: string;
  created_at: string;
  id: string;
  is_active: boolean;
  label: string | null;
  relationship_type: string;
  target_id: string | null;
  target_table: string;
};

export type AskRecommendationDecisionSummaryRow = {
  avg_router_confidence: number | string | null;
  decision: "accepted" | "overridden" | "rejected";
  decision_count: number | string;
  recommended_action: string | null;
  router_category: string | null;
};

export type AskReviewProductTarget = "admin_ops" | "bug" | "wishlist";

export type AskModuleLabKey =
  | "ask_bug_interpreter"
  | "ask_clarifier"
  | "ask_feature_interpreter"
  | "ask_onboarding_helper"
  | "ask_off_topic_handler"
  | "ask_router";

export type AskModuleLabResult = {
  classification: string;
  confidence: number | string;
  error?: string;
  input: string;
  model: string;
  moduleKey: AskModuleLabKey;
  promptVersion: string;
  qualityNotes: string;
  raw: Record<string, unknown>;
  summary: string;
};

export type AskRoutingSettings = {
  auto_create_min_confidence: number | string;
  auto_route_enabled: boolean;
  clarify_absolute_max_turns: number | string;
  clarify_default_max_turns: number | string;
  updated_at?: string | null;
};

type AdminAskIntakePanelProps = {
  decisions: AskRecommendationDecision[];
  decisionSummaryRows: AskRecommendationDecisionSummaryRow[];
  formatDate: (value: string | null) => string;
  loadingSettings: boolean;
  loading: boolean;
  links: AskSubmissionLink[];
  moduleLabInput: string;
  moduleLabKey: AskModuleLabKey;
  moduleLabResults: AskModuleLabResult[];
  moduleLabRunning: boolean;
  onCreateProductItem: (
    target: AskReviewProductTarget,
    actionIndex: number | null,
    action: Record<string, unknown>
  ) => void;
  onCreateSupportTicket: (
    actionIndex: number | null,
    action: Record<string, unknown>
  ) => void;
  onRecordDecision: (
    decision: "overridden" | "rejected",
    actionIndex: number | null,
    action: Record<string, unknown>,
    overrideAction?: string
  ) => void;
  onOpenRelatedItem: (link: AskSubmissionLink) => void;
  onRefresh: () => void;
  onResolveAnswer: (
    actionIndex: number | null,
    action: Record<string, unknown>
  ) => void;
  onRunModuleLab: (event: FormEvent<HTMLFormElement>) => void;
  onSelectSubmission: (submission: AdminAskSubmission) => void;
  onSetModuleLabInput: (value: string) => void;
  onSetModuleLabKey: (value: AskModuleLabKey) => void;
  onSetReviewNote: (value: string) => void;
  onSetSettingsDraft: (value: AskRoutingSettings) => void;
  onSetRoutingState: (value: AskRoutingState) => void;
  onUpdateSettings: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateReview: (event: FormEvent<HTMLFormElement>) => void;
  reviewNote: string;
  routingState: AskRoutingState;
  savingAction: boolean;
  savingSettings: boolean;
  savingReview: boolean;
  selectedSubmission: AdminAskSubmission | null;
  settingsDraft: AskRoutingSettings;
  submissions: AdminAskSubmission[];
};

const categoryOptions = [
  "support_question",
  "bug_report",
  "feature_request",
  "workflow_feedback",
  "account_or_access_issue",
  "unclear_or_needs_human_review",
  "off_topic",
];

const routingStateOptions: AskRoutingState[] = [
  "needs_review",
  "new",
  "auto_routed",
  "admin_overridden",
  "closed",
];

const moduleLabOptions: Array<{ label: string; value: AskModuleLabKey }> = [
  { label: "Ask Router", value: "ask_router" },
  { label: "The Clarifier", value: "ask_clarifier" },
  { label: "Onboarding Helper", value: "ask_onboarding_helper" },
  { label: "Feature / Workflow Interpreter", value: "ask_feature_interpreter" },
  { label: "Bug / Friction Interpreter", value: "ask_bug_interpreter" },
  { label: "Off-topic Handler", value: "ask_off_topic_handler" },
];

function readableValue(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function confidencePercent(value: number | string) {
  const numericValue = Number(value ?? 0);

  if (Number.isNaN(numericValue)) {
    return "0%";
  }

  return `${Math.round(numericValue * 100)}%`;
}

function compactJson(value: unknown) {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return "";
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  ) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function recommendedActionTitle(action: Record<string, unknown>, index: number) {
  return (
    textValue(action.title) ||
    textValue(action.action) ||
    `Recommendation ${index + 1}`
  );
}

function recommendedActionSummary(
  submission: AdminAskSubmission,
  action: Record<string, unknown> | null
) {
  const actionType = textValue(action?.action);

  if (actionType === "answer_now") {
    return "Question answered. Nothing further required.";
  }

  if (actionType.includes("bug") || submission.router_category === "bug_report") {
    return "Create or review a bug item from this Ask conversation.";
  }

  if (
    actionType.includes("feature") ||
    actionType.includes("wishlist") ||
    submission.router_category === "feature_request"
  ) {
    return "Create or review a wishlist item from this Ask conversation.";
  }

  if (submission.router_category === "workflow_feedback") {
    return "Review as workflow feedback and decide whether to create a product item.";
  }

  if (submission.router_category === "account_or_access_issue") {
    return "Review for account or access support before taking action.";
  }

  if (submission.router_category === "off_topic") {
    return "No product action recommended unless this pattern repeats.";
  }

  if (submission.routing_state === "closed") {
    return "Closed. Nothing further required unless you disagree with the route.";
  }

  return "Review the recommendation and decide whether to route, reject, or override it.";
}

function decisionKey(
  decision: AskRecommendationDecision,
  actionIndex: number | null
) {
  return `${decision.decision}:${decision.recommended_action_index ?? "none"}:${actionIndex ?? "none"}`;
}

function CollapsibleSection({
  children,
  expanded,
  onToggle,
  title,
}: {
  children: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <button
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        onClick={onToggle}
        type="button"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </span>
        <span className="text-sm font-semibold text-slate-600">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>
      {expanded ? <div className="border-t border-slate-200 p-3">{children}</div> : null}
    </section>
  );
}

export function AdminAskIntakePanel({
  decisions,
  decisionSummaryRows,
  formatDate,
  loading,
  loadingSettings,
  links,
  moduleLabInput,
  moduleLabKey,
  moduleLabResults,
  moduleLabRunning,
  onCreateProductItem,
  onCreateSupportTicket,
  onRecordDecision,
  onOpenRelatedItem,
  onRefresh,
  onResolveAnswer,
  onRunModuleLab,
  onSelectSubmission,
  onSetModuleLabInput,
  onSetModuleLabKey,
  onSetReviewNote,
  onSetSettingsDraft,
  onSetRoutingState,
  onUpdateSettings,
  onUpdateReview,
  reviewNote,
  routingState,
  savingAction,
  savingSettings,
  savingReview,
  selectedSubmission,
  settingsDraft,
  submissions,
}: AdminAskIntakePanelProps) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    {}
  );
  const [stateFilter, setStateFilter] = useState<"active" | "all" | AskRoutingState>(
    "active"
  );

  const filteredSubmissions = useMemo(
    () =>
      submissions.filter((submission) => {
        const matchesState =
          stateFilter === "all"
            ? true
            : stateFilter === "active"
              ? submission.routing_state !== "closed"
              : submission.routing_state === stateFilter;
        const matchesCategory =
          categoryFilter === "all"
            ? true
            : submission.router_category === categoryFilter;

        return matchesState && matchesCategory;
      }),
    [categoryFilter, stateFilter, submissions]
  );

  const recommendationJson = compactJson(
    selectedSubmission?.recommended_actions ?? []
  );
  const safetyJson = compactJson(selectedSubmission?.safety_flags ?? {});
  const selectedRecommendationActions =
    selectedSubmission?.recommended_actions ?? [];
  const primaryRecommendationAction = selectedRecommendationActions[0] ?? null;
  const selectedSectionPrefix = selectedSubmission?.id ?? "none";
  const sectionKey = (section: string) => `${selectedSectionPrefix}:${section}`;
  const selectedSectionKeys = [
    sectionKey("original"),
    sectionKey("recommendations"),
    sectionKey("safety"),
    sectionKey("transcript"),
    sectionKey("review"),
  ];
  const allSelectedSectionsExpanded = selectedSectionKeys.every(
    (section) => expandedSections[section]
  );
  const selectedDecisions = selectedSubmission
    ? decisions.filter(
        (decision) => decision.ask_submission_id === selectedSubmission.id
      )
    : [];
  const selectedLinks = selectedSubmission
    ? links.filter((link) => link.ask_submission_id === selectedSubmission.id)
    : [];
  const acceptedCount = decisionSummaryRows
    .filter((row) => row.decision === "accepted")
    .reduce((total, row) => total + Number(row.decision_count ?? 0), 0);
  const rejectedCount = decisionSummaryRows
    .filter((row) => row.decision === "rejected")
    .reduce((total, row) => total + Number(row.decision_count ?? 0), 0);
  const overriddenCount = decisionSummaryRows
    .filter((row) => row.decision === "overridden")
    .reduce((total, row) => total + Number(row.decision_count ?? 0), 0);
  const totalDecisionCount = acceptedCount + rejectedCount + overriddenCount;
  const agreementRate =
    totalDecisionCount > 0
      ? Math.round((acceptedCount / totalDecisionCount) * 100)
      : null;

  function toggleSection(section: string) {
    const key = sectionKey(section);

    setExpandedSections((currentSections) => ({
      ...currentSections,
      [key]: !currentSections[key],
    }));
  }

  function setAllSections(expanded: boolean) {
    setExpandedSections((currentSections) => ({
      ...currentSections,
      [sectionKey("original")]: expanded,
      [sectionKey("recommendations")]: expanded,
      [sectionKey("review")]: expanded,
      [sectionKey("safety")]: expanded,
      [sectionKey("transcript")]: expanded,
    }));
  }

  function isSupportResolutionAction(action: Record<string, unknown>) {
    const actionType = textValue(action.action);

    return (
      actionType === "answer_now" ||
      actionType === "support_answered" ||
      selectedSubmission?.router_category === "support_question"
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Ask intake</h2>
          <p className="mt-1 text-slate-600">
            Review Ask conversations, routing recommendations, and the full
            transcript before deciding what should happen next.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          disabled={loading}
          onClick={onRefresh}
          type="button"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <form
        className="mt-5 rounded-md border border-slate-200 bg-white p-4"
        onSubmit={onUpdateSettings}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Ask routing settings
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Tune clarification limits and future auto-routing thresholds without
              changing prompts.
            </p>
          </div>
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
            disabled={loadingSettings || savingSettings}
            type="submit"
          >
            {savingSettings ? "Saving..." : "Save settings"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            <input
              checked={settingsDraft.auto_route_enabled}
              className="h-4 w-4"
              disabled={loadingSettings || savingSettings}
              onChange={(event) =>
                onSetSettingsDraft({
                  ...settingsDraft,
                  auto_route_enabled: event.target.checked,
                })
              }
              type="checkbox"
            />
            Auto-route eligible items
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Auto-create confidence
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              disabled={loadingSettings || savingSettings}
              max="1"
              min="0"
              onChange={(event) =>
                onSetSettingsDraft({
                  ...settingsDraft,
                  auto_create_min_confidence: event.target.value,
                })
              }
              step="0.01"
              type="number"
              value={settingsDraft.auto_create_min_confidence}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Default questions
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              disabled={loadingSettings || savingSettings}
              min="0"
              onChange={(event) =>
                onSetSettingsDraft({
                  ...settingsDraft,
                  clarify_default_max_turns: event.target.value,
                })
              }
              step="1"
              type="number"
              value={settingsDraft.clarify_default_max_turns}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Absolute max questions
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
              disabled={loadingSettings || savingSettings}
              min="0"
              onChange={(event) =>
                onSetSettingsDraft({
                  ...settingsDraft,
                  clarify_absolute_max_turns: event.target.value,
                })
              }
              step="1"
              type="number"
              value={settingsDraft.clarify_absolute_max_turns}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Auto-routing remains conservative; user-submitted ideas should still
          stay reviewable before becoming public or committed work.
        </p>
      </form>

      <form
        className="mt-5 rounded-md border border-sky-200 bg-sky-50/60 p-4"
        onSubmit={onRunModuleLab}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Ask module lab
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Paste test questions, choose one Ask module, and compare brief
              responses without creating intake items.
            </p>
          </div>
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
            disabled={moduleLabRunning}
            type="submit"
          >
            {moduleLabRunning ? "Testing..." : "Run test"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <label className="block text-sm font-medium text-slate-700">
            Module
            <select
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              disabled={moduleLabRunning}
              onChange={(event) =>
                onSetModuleLabKey(event.target.value as AskModuleLabKey)
              }
              value={moduleLabKey}
            >
              {moduleLabOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Test questions
            <textarea
              className="mt-2 min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={moduleLabRunning}
              onChange={(event) => onSetModuleLabInput(event.target.value)}
              placeholder="Paste one test question per line."
              value={moduleLabInput}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          This is non-destructive. It uses the current module prompt/schema and
          logs estimated AI cost, but it does not create Ask submissions, tickets,
          bugs, or wishlist items.
        </p>

        {moduleLabResults.length > 0 ? (
          <div className="mt-4 space-y-3">
            {moduleLabResults.map((result, index) => {
              const rawJson = compactJson(result.raw);

              return (
                <details
                  className="rounded-md border border-slate-200 bg-white p-3"
                  key={`${result.input}-${index}`}
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {result.input}
                        </p>
                        {result.error ? (
                          <p className="mt-2 text-sm font-semibold text-red-700">
                            {result.error}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-slate-700">
                            {result.summary || "No summary returned."}
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {confidencePercent(result.confidence)}
                      </span>
                    </div>
                    {!result.error ? (
                      <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                        <p>
                          <span className="font-semibold text-slate-800">
                            Result:
                          </span>{" "}
                          {result.classification || "Unspecified"}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-800">
                            Prompt:
                          </span>{" "}
                          {result.promptVersion || "Unknown"}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-800">
                            Model:
                          </span>{" "}
                          {result.model || "Unknown"}
                        </p>
                      </div>
                    ) : null}
                  </summary>
                  {!result.error ? (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      {result.qualityNotes ? (
                        <p className="text-sm text-slate-700">
                          {result.qualityNotes}
                        </p>
                      ) : null}
                      {rawJson ? (
                        <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                          {rawJson}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}
                </details>
              );
            })}
          </div>
        ) : null}
      </form>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          State
          <select
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) =>
              setStateFilter(event.target.value as typeof stateFilter)
            }
            value={stateFilter}
          >
            <option value="active">Active</option>
            <option value="all">All states</option>
            {routingStateOptions.map((state) => (
              <option key={state} value={state}>
                {readableValue(state)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Category
          <select
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) => setCategoryFilter(event.target.value)}
            value={categoryFilter}
          >
            <option value="all">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {readableValue(category)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Recommendation agreement
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Last 30 days of Admin decisions on Ask recommendations.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-4">
            <div>
              <p className="text-2xl font-semibold text-slate-950">
                {agreementRate === null ? "--" : `${agreementRate}%`}
              </p>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                accepted
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-emerald-700">
                {acceptedCount}
              </p>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                yes
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-red-700">
                {rejectedCount}
              </p>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                no
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-amber-700">
                {overriddenCount}
              </p>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                override
              </p>
            </div>
          </div>
        </div>

        {decisionSummaryRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Decision</th>
                  <th className="py-2 pr-4 font-semibold">Category</th>
                  <th className="py-2 pr-4 font-semibold">Recommendation</th>
                  <th className="py-2 text-right font-semibold">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {decisionSummaryRows.slice(0, 6).map((row) => (
                  <tr
                    key={`${row.decision}-${row.router_category ?? "unknown"}-${row.recommended_action ?? "action"}`}
                  >
                    <td className="py-2 pr-4 font-medium text-slate-900">
                      {readableValue(row.decision)}
                    </td>
                    <td className="py-2 pr-4">
                      {readableValue(row.router_category ?? "unknown")}
                    </td>
                    <td className="py-2 pr-4">
                      {readableValue(row.recommended_action ?? "unspecified")}
                    </td>
                    <td className="py-2 text-right">
                      {Number(row.decision_count ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            No recommendation decisions yet.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-2">
          {filteredSubmissions.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
              No Ask intake items match these filters.
            </div>
          ) : (
            filteredSubmissions.map((submission) => {
              const selected = selectedSubmission?.id === submission.id;

              return (
                <button
                  className={`w-full rounded-md border p-3 text-left transition ${
                    selected
                      ? "border-sky-300 bg-sky-50"
                      : submission.routing_state === "closed"
                        ? "border-slate-200 bg-slate-50 hover:border-slate-300"
                        : "border-amber-200 bg-amber-50/70 hover:border-amber-300"
                  }`}
                  key={submission.id}
                  onClick={() => onSelectSubmission(submission)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 font-semibold text-slate-900">
                      {submission.ai_summary || submission.original_user_wording}
                    </span>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                      {confidencePercent(submission.router_confidence)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {submission.user_label}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                    {readableValue(submission.router_category)} ·{" "}
                    {readableValue(submission.routing_state)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(submission.created_at)}
                  </p>
                </button>
              );
            })
          )}
        </aside>

        {selectedSubmission ? (
          <div className="rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {selectedSubmission.ai_summary ||
                    selectedSubmission.original_user_wording}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedSubmission.user_label} ·{" "}
                  {readableValue(selectedSubmission.router_category)} ·{" "}
                  {confidencePercent(selectedSubmission.router_confidence)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Submitted {formatDate(selectedSubmission.created_at)}
                  {selectedSubmission.current_page
                    ? ` from ${selectedSubmission.current_page}`
                    : ""}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {readableValue(selectedSubmission.routing_state)}
              </span>
            </div>

            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Recommended action
              </p>
              <p className="mt-2 text-lg font-semibold text-emerald-950">
                {recommendedActionSummary(
                  selectedSubmission,
                  primaryRecommendationAction
                )}
              </p>
              {primaryRecommendationAction?.rationale ? (
                <p className="mt-2 text-sm text-emerald-900">
                  {textValue(primaryRecommendationAction.rationale)}
                </p>
              ) : null}
            </div>

            {selectedLinks.length > 0 ? (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Related items
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedLinks.map((link) => (
                    <button
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:text-slate-400"
                      disabled={!link.target_id}
                      key={link.id}
                      onClick={() => onOpenRelatedItem(link)}
                      type="button"
                    >
                      {link.label || readableValue(link.target_table)} ·{" "}
                      {readableValue(link.relationship_type)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                onClick={() => setAllSections(!allSelectedSectionsExpanded)}
                type="button"
              >
                {allSelectedSectionsExpanded ? "Collapse all" : "Expand all"}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <CollapsibleSection
                expanded={Boolean(expandedSections[sectionKey("original")])}
                onToggle={() => toggleSection("original")}
                title="Original wording and router rationale"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Original wording
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                      {selectedSubmission.original_user_wording}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Router rationale
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                      {selectedSubmission.router_rationale || "No rationale saved."}
                    </p>
                  </div>
                </div>
              </CollapsibleSection>

              {recommendationJson ? (
                <CollapsibleSection
                  expanded={Boolean(expandedSections[sectionKey("recommendations")])}
                  onToggle={() => toggleSection("recommendations")}
                  title="Raw recommendation data"
                >
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                    {recommendationJson}
                  </pre>
                </CollapsibleSection>
              ) : null}
            </div>

            <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Decision actions
              </p>
              {selectedRecommendationActions.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {selectedRecommendationActions.map((action, index) => {
                    const priorDecisions = selectedDecisions.filter(
                      (decision) => decision.recommended_action_index === index
                    );
                    const hasAcceptedDecision = priorDecisions.some(
                      (decision) => decision.decision === "accepted"
                    );

                    return (
                      <div
                        className="rounded-md border border-slate-200 bg-slate-50 p-3"
                        key={`${index}-${recommendedActionTitle(action, index)}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {recommendedActionTitle(action, index)}
                            </p>
                            {textValue(action.rationale) ? (
                              <p className="mt-1 text-sm text-slate-600">
                                {textValue(action.rationale)}
                              </p>
                            ) : null}
                            <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                              {[
                                ["Action", textValue(action.action)],
                                ["App area", textValue(action.app_area)],
                                ["Priority", textValue(action.priority)],
                                ["Pain point", textValue(action.pain_point)],
                                [
                                  "Desired outcome",
                                  textValue(action.desired_outcome),
                                ],
                                ["Tried", textValue(action.tried_to_do)],
                                [
                                  "Expected",
                                  textValue(action.expected_behavior),
                                ],
                                ["Actual", textValue(action.actual_behavior)],
                              ]
                                .filter(([, value]) => value)
                                .map(([label, value]) => (
                                  <p key={`${label}-${value}`}>
                                    <span className="font-semibold text-slate-700">
                                      {label}:
                                    </span>{" "}
                                    {value}
                                  </p>
                                ))}
                            </div>
                          </div>
                          {priorDecisions.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {priorDecisions.map((decision) => (
                                <span
                                  className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600"
                                  key={decisionKey(decision, index)}
                                >
                                  {readableValue(decision.decision)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {isSupportResolutionAction(action) ? (
                            <>
                              <button
                                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                                disabled={savingAction || hasAcceptedDecision}
                                onClick={() => onResolveAnswer(index, action)}
                                type="button"
                              >
                                Accept answer
                              </button>
                              <button
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                                disabled={savingAction || hasAcceptedDecision}
                                onClick={() => onCreateSupportTicket(index, action)}
                                type="button"
                              >
                                Create support ticket
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                                disabled={savingAction || hasAcceptedDecision}
                                onClick={() =>
                                  onCreateProductItem("bug", index, action)
                                }
                                type="button"
                              >
                                Create bug
                              </button>
                              <button
                                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                                disabled={savingAction || hasAcceptedDecision}
                                onClick={() =>
                                  onCreateProductItem("wishlist", index, action)
                                }
                                type="button"
                              >
                                Create wishlist
                              </button>
                              <button
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                                disabled={savingAction || hasAcceptedDecision}
                                onClick={() =>
                                  onCreateProductItem("admin_ops", index, action)
                                }
                                type="button"
                              >
                                Create workflow item
                              </button>
                            </>
                          )}
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                            disabled={savingAction}
                            onClick={() =>
                              onRecordDecision("rejected", index, action)
                            }
                            type="button"
                          >
                            Reject rec
                          </button>
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                            disabled={savingAction}
                            onClick={() =>
                              onRecordDecision(
                                "overridden",
                                index,
                                action,
                                "manual_admin_route"
                              )
                            }
                            type="button"
                          >
                            Mark override
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-600">
                  No structured recommendations were saved. You can still mark
                  this as an override so the model-quality trail stays honest.
                  <div className="mt-3">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                      disabled={savingAction}
                      onClick={() =>
                        onRecordDecision(
                          "overridden",
                          null,
                          {},
                          "manual_admin_route"
                        )
                      }
                      type="button"
                    >
                      Mark manual override
                    </button>
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">
                These decisions become model-quality feedback for routing,
                confidence thresholds, and future prompt work.
              </p>
            </div>

            {safetyJson ? (
              <div className="mt-4">
                <CollapsibleSection
                  expanded={Boolean(expandedSections[sectionKey("safety")])}
                  onToggle={() => toggleSection("safety")}
                  title="Safety flags"
                >
                <pre className="max-h-36 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                  {safetyJson}
                </pre>
                </CollapsibleSection>
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <CollapsibleSection
                expanded={Boolean(expandedSections[sectionKey("transcript")])}
                onToggle={() => toggleSection("transcript")}
                title="Transcript"
              >
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {selectedSubmission.transcript || "No transcript saved."}
                </pre>
              </CollapsibleSection>

              <CollapsibleSection
                expanded={Boolean(expandedSections[sectionKey("review")])}
                onToggle={() => toggleSection("review")}
                title="Manual review note"
              >
                <form className="space-y-3" onSubmit={onUpdateReview}>
                  <label className="block text-sm font-medium text-slate-700">
                    Routing state
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      onChange={(event) =>
                        onSetRoutingState(event.target.value as AskRoutingState)
                      }
                      value={routingState}
                    >
                      {routingStateOptions.map((state) => (
                        <option key={state} value={state}>
                          {readableValue(state)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Review note
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
                      onChange={(event) => onSetReviewNote(event.target.value)}
                      placeholder="Add a short note about what should happen next"
                      value={reviewNote}
                    />
                  </label>
                  <button
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                    disabled={savingReview}
                    type="submit"
                  >
                    {savingReview ? "Saving..." : "Save review"}
                  </button>
                </form>
              </CollapsibleSection>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
            Select an Ask intake item to review its transcript and routing
            recommendation.
          </div>
        )}
      </div>
    </section>
  );
}
