"use client";

import { FormEvent, useState } from "react";

import {
  AdminAskMessage,
  AdminAskProductArea,
  AdminAskProductItemInput,
  AdminAskReviewInput,
  AdminAskSendInput,
  AdminAskSubmission,
  AdminAskSubmissionReview,
  AdminAskThread,
  AdminAskWorkspace,
  AskCaseStatus,
} from "./AdminAskWorkspace";
import { aiWorkflows } from "./aiWorkflows";

// The lab only tests the modules the router can actually call mid-request
// (not ask_user_response_rubric, which is a shared text fragment rather
// than a standalone module). aiWorkflows is the source of truth for each
// key's label -- see aiWorkflows.ts -- so a label edited there does not
// also need to be edited here.
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

export type AskAnalysisRun = {
  admin_note: string;
  admin_status: "new" | "reviewed" | "accepted" | "rejected" | "needs_more_data";
  analysis_summary: string;
  ask_submission_ids: string[];
  created_at: string;
  failure_patterns: string[];
  id: string;
  prompt_recommendations: string[];
  recommendations: string[];
  strengths: string[];
  submission_count: number;
  ui_recommendations: string[];
};

export type AdminAskQualityItem = AdminAskSubmission & {
  reviewed_count: number;
  user_label: string;
};

type AdminAskQueue = "needsResponse" | "qualityReview";

const moduleLabKeys: AskModuleLabKey[] = [
  "ask_router",
  "ask_clarifier",
  "ask_bug_interpreter",
  "ask_feature_interpreter",
  "ask_onboarding_helper",
  "ask_off_topic_handler",
];

const moduleLabOptions: Array<{ label: string; value: AskModuleLabKey }> =
  moduleLabKeys.map((value) => ({ label: aiWorkflows[value].label, value }));

function confidencePercent(value: number | string): string {
  const numeric = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : "—";
}

function readableValue(value: string): string {
  return value.replace(/_/g, " ");
}

function isNewForAdmin(activityAt: string | null, lastViewedAt: string | null) {
  if (!activityAt) {
    return false;
  }

  if (!lastViewedAt) {
    return true;
  }

  return new Date(activityAt).getTime() > new Date(lastViewedAt).getTime();
}

type AdminAskConsoleProps = {
  analysisRuns: AskAnalysisRun[];
  analyzingSubmissions: boolean;
  formatDate: (value: string) => string;
  lastViewedAt: string | null;
  loadingQueues: boolean;
  loadingSettings: boolean;
  loadingThread: boolean;
  moduleLabInput: string;
  moduleLabKey: AskModuleLabKey;
  moduleLabResults: AskModuleLabResult[];
  moduleLabRunning: boolean;
  needsResponseThreads: AdminAskThread[];
  onCreateProductItem: (input: AdminAskProductItemInput) => void;
  onQuickSetStatus: (status: AskCaseStatus) => void;
  onRefresh: () => void;
  onRunAnalysis: () => void;
  onRunModuleLab: (event: FormEvent<HTMLFormElement>) => void;
  onSelectSubmission: (submission: AdminAskQualityItem) => void;
  onSelectThread: (thread: AdminAskThread) => void;
  onSend: (input: AdminAskSendInput, review: AdminAskReviewInput | null) => void;
  onSetModuleLabInput: (value: string) => void;
  onSetModuleLabKey: (value: AskModuleLabKey) => void;
  onSetSettingsDraft: (value: AskRoutingSettings) => void;
  onUpdateAnalysisRun: (
    runId: string,
    status: AskAnalysisRun["admin_status"],
    note: string
  ) => void;
  onUpdateSettings: (event: FormEvent<HTMLFormElement>) => void;
  productAreas: AdminAskProductArea[];
  qualitySubmissions: AdminAskQualityItem[];
  reviewHistory: AdminAskSubmissionReview[];
  saving: boolean;
  savingProductItem: boolean;
  savingQuickStatus: boolean;
  savingSettings: boolean;
  selectedSubmission: AdminAskSubmission | null;
  selectedSubmissionIdsForAnalysis: string[];
  selectedThread: AdminAskThread | null;
  selectedThreadId: string | null;
  settingsDraft: AskRoutingSettings;
  threadMessages: AdminAskMessage[];
  toggleSubmissionForAnalysis: (submissionId: string) => void;
};

// Replaces AdminSupportTicketsPanel + AdminAssistantReviewPanel (which
// wrapped AdminAskIntakePanel + AdminSupportAssistantReviewPanel). Two
// queues, one canonical workspace: "Needs response" (ask_threads waiting
// on an admin) and "AI quality review" (ask_submissions, independent of
// whether a human ever had to get involved -- a cleanly auto-resolved
// thread still needs to be sample-able for quality). Selecting an item
// from either queue opens the same AdminAskWorkspace by thread id.
export function AdminAskConsole({
  analysisRuns,
  analyzingSubmissions,
  formatDate,
  lastViewedAt,
  loadingQueues,
  loadingSettings,
  loadingThread,
  moduleLabInput,
  moduleLabKey,
  moduleLabResults,
  moduleLabRunning,
  needsResponseThreads,
  onCreateProductItem,
  onQuickSetStatus,
  onRefresh,
  onRunAnalysis,
  onRunModuleLab,
  onSelectSubmission,
  onSelectThread,
  onSend,
  onSetModuleLabInput,
  onSetModuleLabKey,
  onSetSettingsDraft,
  onUpdateAnalysisRun,
  onUpdateSettings,
  productAreas,
  qualitySubmissions,
  reviewHistory,
  saving,
  savingProductItem,
  savingQuickStatus,
  savingSettings,
  selectedSubmission,
  selectedSubmissionIdsForAnalysis,
  selectedThread,
  selectedThreadId,
  settingsDraft,
  threadMessages,
  toggleSubmissionForAnalysis,
}: AdminAskConsoleProps) {
  const [activeQueue, setActiveQueue] = useState<AdminAskQueue>("needsResponse");
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [reviewedFilter, setReviewedFilter] = useState<
    "all" | "reviewed" | "unreviewed"
  >("all");

  const categoryOptions = Array.from(
    new Set(qualitySubmissions.map((submission) => submission.router_category))
  ).sort();

  const filteredQualitySubmissions = qualitySubmissions.filter((submission) => {
    if (categoryFilter !== "all" && submission.router_category !== categoryFilter) {
      return false;
    }

    if (reviewedFilter === "reviewed" && submission.reviewed_count === 0) {
      return false;
    }

    if (reviewedFilter === "unreviewed" && submission.reviewed_count > 0) {
      return false;
    }

    return true;
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Ask</h2>
          <p className="mt-1 text-slate-600">
            Every user conversation and its AI interpretation live in one place --
            reply, note, resolve, and record how the AI did, all from the same
            conversation.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          disabled={loadingQueues}
          onClick={onRefresh}
          type="button"
        >
          {loadingQueues ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <details
        className="mt-4 rounded-md border border-slate-200"
        open={toolsExpanded}
        onToggle={(event) => setToolsExpanded((event.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer select-none rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-700">
          Ask tools (routing settings, prompt module lab)
        </summary>
        <div className="p-4">
          <form className="rounded-md border border-slate-200 p-4" onSubmit={onUpdateSettings}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Ask routing settings
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Tune clarification limits and auto-routing thresholds.
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
          </form>

          <form
            className="mt-4 rounded-md border border-sky-200 bg-sky-50/60 p-4"
            onSubmit={onRunModuleLab}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Ask module lab
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Paste test questions, choose one Ask module, and compare brief
                  responses. Non-destructive -- creates no threads or submissions.
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
            {moduleLabResults.length > 0 ? (
              <div className="mt-4 space-y-2">
                {moduleLabResults.map((result, index) => (
                  <details
                    className="rounded-md border border-slate-200 bg-white p-3"
                    key={`${result.input}-${index}`}
                  >
                    <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                      {result.input} · {confidencePercent(result.confidence)}
                    </summary>
                    {result.error ? (
                      <p className="mt-2 text-sm font-semibold text-red-700">
                        {result.error}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-slate-700">{result.summary}</p>
                    )}
                  </details>
                ))}
              </div>
            ) : null}
          </form>
        </div>
      </details>

      <div className="mt-4 flex gap-2">
        <button
          className={`rounded-md border px-4 py-2 text-sm font-semibold ${
            activeQueue === "needsResponse"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 text-slate-700"
          }`}
          onClick={() => setActiveQueue("needsResponse")}
          type="button"
        >
          Needs response ({needsResponseThreads.length})
        </button>
        <button
          className={`rounded-md border px-4 py-2 text-sm font-semibold ${
            activeQueue === "qualityReview"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 text-slate-700"
          }`}
          onClick={() => setActiveQueue("qualityReview")}
          type="button"
        >
          AI quality review ({qualitySubmissions.length})
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {activeQueue === "needsResponse" ? (
          <aside className="space-y-2">
            {needsResponseThreads.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
                Nothing needs a response.
              </div>
            ) : (
              needsResponseThreads.map((thread) => {
                const selected = selectedThread?.id === thread.id;
                const isNewToAdmin = isNewForAdmin(thread.updated_at, lastViewedAt);

                return (
                  <button
                    className={`w-full rounded-md border p-3 text-left transition ${
                      selected
                        ? isNewToAdmin
                          ? "border-red-300 bg-red-50"
                          : "border-amber-300 bg-amber-50"
                        : isNewToAdmin
                          ? "border-red-200 bg-red-50/70"
                          : "border-amber-200 bg-amber-50/70"
                    }`}
                    key={thread.id}
                    onClick={() => onSelectThread(thread)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        {thread.user_label}
                      </span>
                      {isNewToAdmin ? (
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                          New to me
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                      {readableValue(thread.case_status)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Updated {formatDate(thread.updated_at)}
                    </p>
                  </button>
                );
              })
            )}
          </aside>
        ) : (
          <aside className="space-y-2">
            <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <label className="block text-xs font-medium text-slate-700">
                Category
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
              <label className="block text-xs font-medium text-slate-700">
                Review status
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  onChange={(event) =>
                    setReviewedFilter(
                      event.target.value as "all" | "reviewed" | "unreviewed"
                    )
                  }
                  value={reviewedFilter}
                >
                  <option value="all">All</option>
                  <option value="unreviewed">Not yet reviewed</option>
                  <option value="reviewed">Reviewed</option>
                </select>
              </label>
              <button
                className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 disabled:opacity-60"
                disabled={analyzingSubmissions || selectedSubmissionIdsForAnalysis.length === 0}
                onClick={onRunAnalysis}
                type="button"
              >
                {analyzingSubmissions
                  ? "Analyzing..."
                  : `Analyze selected (${selectedSubmissionIdsForAnalysis.length})`}
              </button>
            </div>

            {filteredQualitySubmissions.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
                No Ask answers match these filters.
              </div>
            ) : (
              filteredQualitySubmissions.map((submission) => {
                const selected = selectedSubmission?.id === submission.id;

                return (
                  <div
                    className={`w-full rounded-md border p-3 transition ${
                      selected ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"
                    }`}
                    key={submission.id}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        checked={selectedSubmissionIdsForAnalysis.includes(submission.id)}
                        className="mt-1"
                        onChange={() => toggleSubmissionForAnalysis(submission.id)}
                        type="checkbox"
                      />
                      <button
                        className="flex-1 text-left"
                        onClick={() => onSelectSubmission(submission)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-slate-900">
                            {submission.ai_summary || submission.original_user_wording}
                          </span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            {confidencePercent(submission.router_confidence)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {submission.user_label}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                          {readableValue(submission.router_category)}
                          {submission.reviewed_count > 0
                            ? ` · reviewed (${submission.reviewed_count})`
                            : " · not reviewed"}
                        </p>
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            <details
              className="rounded-md border border-slate-200"
              open={analysisExpanded}
              onToggle={(event) =>
                setAnalysisExpanded((event.target as HTMLDetailsElement).open)
              }
            >
              <summary className="cursor-pointer select-none rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                Analysis runs ({analysisRuns.length})
              </summary>
              <div className="space-y-2 p-3">
                {analysisRuns.length === 0 ? (
                  <p className="text-sm text-slate-600">No analysis runs yet.</p>
                ) : (
                  analysisRuns.map((run) => (
                    <div
                      className="rounded-md border border-slate-200 p-2 text-xs text-slate-700"
                      key={run.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          {run.submission_count} answers · {formatDate(run.created_at)}
                        </span>
                        <select
                          className="rounded-md border border-slate-300 px-1.5 py-1 text-xs"
                          onChange={(event) =>
                            onUpdateAnalysisRun(
                              run.id,
                              event.target.value as AskAnalysisRun["admin_status"],
                              run.admin_note
                            )
                          }
                          value={run.admin_status}
                        >
                          <option value="new">New</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                          <option value="needs_more_data">Needs more data</option>
                        </select>
                      </div>
                      <p className="mt-1">{run.analysis_summary}</p>
                      {run.failure_patterns.length > 0 ? (
                        <p className="mt-1 text-slate-500">
                          Patterns: {run.failure_patterns.join("; ")}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </details>
          </aside>
        )}

        <AdminAskWorkspace
          // Keyed on the target thread id (set synchronously the instant an
          // admin clicks a queue row), not on selectedThread?.id (which only
          // updates once its fetch resolves). Remounting immediately on
          // click -- before the network round trip even starts -- is what
          // guarantees an in-progress draft can never be sent to whatever
          // thread happens to load next; see loadAdminAskWorkspaceForThreadId.
          key={selectedThreadId ?? "none"}
          formatDate={formatDate}
          loadingThread={loadingThread}
          onCreateProductItem={onCreateProductItem}
          onQuickSetStatus={onQuickSetStatus}
          onSend={onSend}
          productAreas={productAreas}
          reviewHistory={reviewHistory}
          saving={saving}
          savingProductItem={savingProductItem}
          savingQuickStatus={savingQuickStatus}
          submission={selectedSubmission}
          thread={selectedThread}
          threadMessages={threadMessages}
        />
      </div>
    </section>
  );
}
