"use client";

import { FormEvent } from "react";

import { AIReviewBadge } from "../shared/ai/AIReviewBadge";

type SupportAssistantOutcome =
  | "answered"
  | "escalated"
  | "helpful"
  | "not_helpful";
type SupportAssistantReviewStatus =
  | "good_answer"
  | "needs_prompt_work"
  | "needs_review"
  | "needs_ui_work"
  | "not_actionable"
  | "should_escalate";
type SupportAssistantAnalysisStatus =
  | "accepted"
  | "needs_more_data"
  | "new"
  | "rejected"
  | "reviewed";
type AssistantReviewConfidenceFilter =
  | "all"
  | "high"
  | "medium"
  | "low"
  | "needs_review";
type SupportTicketPriority = "high" | "low" | "medium" | "urgent";

type AssistantReviewInteraction = {
  assistant_answer: string;
  category: string;
  confidence: number;
  context: Record<string, unknown> | null;
  created_at: string;
  current_page: string | null;
  escalation_reason: string;
  escalation_recommended: boolean;
  id: string;
  instruction_version_id: string | null;
  model: string | null;
  outcome: SupportAssistantOutcome;
  priority: SupportTicketPriority;
  profiles?: {
    display_name: string | null;
    email: string | null;
    family_name: string | null;
    given_name: string | null;
  } | null;
  prompt_version: string | null;
  question_body: string;
  question_subject: string;
  raw_response: Record<string, unknown> | null;
  suggested_next_step: string;
  ticket_id: string | null;
  updated_at: string;
  user_feedback: string | null;
  user_id: string;
};

type AssistantAdminReview = {
  admin_note: string;
  created_at: string;
  id: string;
  interaction_id: string;
  recommended_action: string | null;
  review_status: SupportAssistantReviewStatus;
};

type AssistantAnalysisResult = {
  analysisSummary: string;
  failurePatterns: string[];
  id: string;
  promptRecommendations: string[];
  strengths: string[];
  uiRecommendations: string[];
};

type AssistantAnalysisRun = {
  admin_note: string | null;
  admin_status: SupportAssistantAnalysisStatus;
  analysis_summary: string;
  created_at: string;
  criteria: Record<string, unknown> | null;
  failure_patterns: string[];
  id: string;
  interaction_count: number;
  interaction_ids: string[];
  model: string;
  prompt_recommendations: string[];
  prompt_versions: string[];
  recommendations: string[];
  requested_by_user_id: string;
  strengths: string[];
  ui_recommendations: string[];
  updated_at: string;
};

type AdminSupportAssistantReviewPanelProps = {
  adminLastViewedAt: (scopeType: "admin_tab", scopeKey: string) => string | null;
  analyzingAssistantReviews: boolean;
  assistantAnalysisResult: AssistantAnalysisResult | null;
  assistantAnalysisRunNote: string;
  assistantAnalysisRuns: AssistantAnalysisRun[];
  assistantAnalysisRunStatus: SupportAssistantAnalysisStatus;
  assistantInteractionUserLabel: (interaction: AssistantReviewInteraction) => string;
  assistantReviewAdminReviews: AssistantAdminReview[];
  assistantReviewConfidenceFilter: AssistantReviewConfidenceFilter;
  assistantReviewHasFeedbackOnly: boolean;
  assistantReviewInteractions: AssistantReviewInteraction[];
  assistantReviewNote: string;
  assistantReviewOutcomeFilter: "all" | SupportAssistantOutcome;
  assistantReviewPromptFilter: string;
  assistantReviewPromptVersions: string[];
  assistantReviewRecommendedAction: string;
  assistantReviewStatus: SupportAssistantReviewStatus;
  filteredAssistantReviewInteractions: AssistantReviewInteraction[];
  formatDate: (value: string | null) => string;
  handleAnalyzeFilteredAssistantReviews: () => void;
  handleCreateAssistantAdminReview: (event: FormEvent<HTMLFormElement>) => void;
  handleUpdateAssistantAnalysisRun: (event: FormEvent<HTMLFormElement>) => void;
  isNewForAdmin: (value: string | null, lastViewedAt: string | null) => boolean;
  loadAssistantReviewInteractions: () => void;
  loadingAssistantReviews: boolean;
  savingAssistantAdminReview: boolean;
  savingAssistantAnalysisRunReview: boolean;
  selectAssistantAnalysisRun: (run: AssistantAnalysisRun) => void;
  selectedAssistantAdminReviews: AssistantAdminReview[];
  selectedAssistantAnalysisRun: AssistantAnalysisRun | null;
  selectedAssistantReviewInteraction: AssistantReviewInteraction | null;
  setAssistantAnalysisRunNote: (value: string) => void;
  setAssistantAnalysisRunStatus: (value: SupportAssistantAnalysisStatus) => void;
  setAssistantReviewConfidenceFilter: (value: AssistantReviewConfidenceFilter) => void;
  setAssistantReviewHasFeedbackOnly: (value: boolean) => void;
  setAssistantReviewNote: (value: string) => void;
  setAssistantReviewOutcomeFilter: (value: "all" | SupportAssistantOutcome) => void;
  setAssistantReviewPromptFilter: (value: string) => void;
  setAssistantReviewRecommendedAction: (value: string) => void;
  setAssistantReviewStatus: (value: SupportAssistantReviewStatus) => void;
  setSelectedAssistantReviewId: (value: string) => void;
  supportAnalysisStatusLabel: (status: SupportAssistantAnalysisStatus) => string;
};

export function AdminSupportAssistantReviewPanel({
  adminLastViewedAt,
  analyzingAssistantReviews,
  assistantAnalysisResult,
  assistantAnalysisRunNote,
  assistantAnalysisRuns,
  assistantAnalysisRunStatus,
  assistantInteractionUserLabel,
  assistantReviewAdminReviews,
  assistantReviewConfidenceFilter,
  assistantReviewHasFeedbackOnly,
  assistantReviewInteractions,
  assistantReviewNote,
  assistantReviewOutcomeFilter,
  assistantReviewPromptFilter,
  assistantReviewPromptVersions,
  assistantReviewRecommendedAction,
  assistantReviewStatus,
  filteredAssistantReviewInteractions,
  formatDate,
  handleAnalyzeFilteredAssistantReviews,
  handleCreateAssistantAdminReview,
  handleUpdateAssistantAnalysisRun,
  isNewForAdmin,
  loadAssistantReviewInteractions,
  loadingAssistantReviews,
  savingAssistantAdminReview,
  savingAssistantAnalysisRunReview,
  selectAssistantAnalysisRun,
  selectedAssistantAdminReviews,
  selectedAssistantAnalysisRun,
  selectedAssistantReviewInteraction,
  setAssistantAnalysisRunNote,
  setAssistantAnalysisRunStatus,
  setAssistantReviewConfidenceFilter,
  setAssistantReviewHasFeedbackOnly,
  setAssistantReviewNote,
  setAssistantReviewOutcomeFilter,
  setAssistantReviewPromptFilter,
  setAssistantReviewRecommendedAction,
  setAssistantReviewStatus,
  setSelectedAssistantReviewId,
  supportAnalysisStatusLabel,
}: AdminSupportAssistantReviewPanelProps) {
  return (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">Support assistant answer review</h2>
                    <p className="mt-1 text-slate-600">
                      Older support-assistant answers remain here while Ask becomes the primary review stream.
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                    disabled={loadingAssistantReviews}
                    onClick={() => loadAssistantReviewInteractions()}
                    type="button"
                  >
                    {loadingAssistantReviews ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Outcome
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      onChange={(event) =>
                        setAssistantReviewOutcomeFilter(
                          event.target.value as "all" | SupportAssistantOutcome
                        )
                      }
                      value={assistantReviewOutcomeFilter}
                    >
                      <option value="all">All outcomes</option>
                      <option value="answered">Answered only</option>
                      <option value="helpful">Helpful</option>
                      <option value="not_helpful">Not helpful</option>
                      <option value="escalated">Escalated</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Confidence
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      onChange={(event) =>
                        setAssistantReviewConfidenceFilter(
                          event.target.value as AssistantReviewConfidenceFilter
                        )
                      }
                      value={assistantReviewConfidenceFilter}
                    >
                      <option value="all">All confidence levels</option>
                      <option value="high">High confidence</option>
                      <option value="medium">Medium confidence</option>
                      <option value="low">Low confidence</option>
                      <option value="needs_review">Needs review</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Prompt version
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      onChange={(event) =>
                        setAssistantReviewPromptFilter(event.target.value)
                      }
                      value={assistantReviewPromptFilter}
                    >
                      <option value="all">All prompt versions</option>
                      {assistantReviewPromptVersions.map((promptVersion) => (
                        <option key={promptVersion} value={promptVersion}>
                          {promptVersion}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 lg:self-end">
                    <input
                      checked={assistantReviewHasFeedbackOnly}
                      onChange={(event) =>
                        setAssistantReviewHasFeedbackOnly(event.target.checked)
                      }
                      type="checkbox"
                    />
                    Has user feedback
                  </label>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
                  <aside className="space-y-2">
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-sm font-semibold text-slate-700">
                        Showing {filteredAssistantReviewInteractions.length} of {assistantReviewInteractions.length}
                      </p>
                      <button
                        className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                        disabled={
                          analyzingAssistantReviews ||
                          filteredAssistantReviewInteractions.length === 0
                        }
                        onClick={handleAnalyzeFilteredAssistantReviews}
                        type="button"
                      >
                        {analyzingAssistantReviews
                          ? "Analyzing..."
                          : `Analyze filtered${
                              filteredAssistantReviewInteractions.length > 50
                                ? " first 50"
                                : ""
                            }`}
                      </button>
                    </div>
                    {assistantAnalysisResult ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                        <p className="font-semibold">Latest analysis</p>
                        <p className="mt-2 whitespace-pre-wrap">
                          {assistantAnalysisResult.analysisSummary}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-wide">
                          Saved run {assistantAnalysisResult.id}
                        </p>
                      </div>
                    ) : null}
                    {assistantAnalysisRuns.length > 0 ? (
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <p className="text-sm font-semibold text-slate-900">
                          Analysis history
                        </p>
                        <div className="mt-3 space-y-2">
                          {assistantAnalysisRuns.slice(0, 5).map((run) => {
                            const selected =
                              selectedAssistantAnalysisRun?.id === run.id;

                            return (
                              <button
                                className={`w-full rounded-md border p-3 text-left text-sm transition ${
                                  selected
                                    ? "border-sky-300 bg-sky-50"
                                    : "border-slate-200 bg-white hover:border-sky-200"
                                }`}
                                key={run.id}
                                onClick={() => selectAssistantAnalysisRun(run)}
                                type="button"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {run.interaction_count} answer
                                    {run.interaction_count === 1 ? "" : "s"}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                    {supportAnalysisStatusLabel(run.admin_status)}
                                  </span>
                                </div>
                                <p className="mt-2 line-clamp-2 text-slate-600">
                                  {run.analysis_summary}
                                </p>
                                <p className="mt-2 text-xs text-slate-500">
                                  {formatDate(run.created_at)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {filteredAssistantReviewInteractions.length === 0 ? (
                      <div className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
                        No assistant answers match these filters.
                      </div>
                    ) : (
                      filteredAssistantReviewInteractions.map((interaction) => {
                        const selected =
                          selectedAssistantReviewInteraction?.id === interaction.id;
                        const hasAdminReview = assistantReviewAdminReviews.some(
                          (review) => review.interaction_id === interaction.id
                        );
                        const isNewToAdmin = isNewForAdmin(
                          interaction.updated_at || interaction.created_at,
                          adminLastViewedAt("admin_tab", "assistantReview")
                        );

                        return (
                          <button
                            className={`w-full rounded-md border p-3 text-left transition ${
                              selected
                                ? isNewToAdmin
                                  ? "border-red-300 bg-red-50"
                                  : !hasAdminReview
                                    ? "border-amber-300 bg-amber-50"
                                    : "border-sky-300 bg-sky-50"
                                : isNewToAdmin
                                  ? "border-red-200 bg-red-50/70"
                                  : !hasAdminReview
                                    ? "border-amber-200 bg-amber-50/70"
                                    : "border-slate-200 bg-white hover:border-sky-200"
                            }`}
                            key={interaction.id}
                            onClick={() => setSelectedAssistantReviewId(interaction.id)}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-slate-900">
                                {interaction.question_subject}
                              </span>
                              {hasAdminReview ? (
                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                  Reviewed
                                </span>
                              ) : null}
                              {isNewToAdmin ? (
                                <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                  New to me
                                </span>
                              ) : null}
                              {!isNewToAdmin && !hasAdminReview ? (
                                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                                  Follow up
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {assistantInteractionUserLabel(interaction)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <AIReviewBadge confidence={Number(interaction.confidence)} />
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                {interaction.outcome.replace("_", " ")}
                              </span>
                              {interaction.ticket_id ? (
                                <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                  Ticket linked
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {formatDate(interaction.created_at)}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </aside>

                  {selectedAssistantReviewInteraction ? (
                    <div className="rounded-md border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">
                            {selectedAssistantReviewInteraction.question_subject}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {assistantInteractionUserLabel(selectedAssistantReviewInteraction)} · {selectedAssistantReviewInteraction.category}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatDate(selectedAssistantReviewInteraction.created_at)} · {selectedAssistantReviewInteraction.prompt_version ?? "Unknown prompt"}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <AIReviewBadge confidence={Number(selectedAssistantReviewInteraction.confidence)} />
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                            {selectedAssistantReviewInteraction.outcome.replace("_", " ")}
                          </span>
                          {selectedAssistantReviewInteraction.ticket_id ? (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                              Ticket linked
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <h4 className="font-semibold text-slate-900">Question</h4>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                            {selectedAssistantReviewInteraction.question_body}
                          </p>
                        </div>
                        <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
                          <h4 className="font-semibold text-slate-900">Assistant answer</h4>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                            {selectedAssistantReviewInteraction.assistant_answer}
                          </p>
                          {selectedAssistantReviewInteraction.suggested_next_step ? (
                            <p className="mt-3 text-sm font-semibold text-slate-900">
                              {selectedAssistantReviewInteraction.suggested_next_step}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 xl:grid-cols-3">
                        <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">User feedback</p>
                          <p className="mt-2 whitespace-pre-wrap">
                            {selectedAssistantReviewInteraction.user_feedback || "No user comment saved."}
                          </p>
                        </div>
                        <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Escalation</p>
                          <p className="mt-2">
                            {selectedAssistantReviewInteraction.escalation_recommended
                              ? "Assistant recommended review."
                              : "No review recommended by assistant."}
                          </p>
                          {selectedAssistantReviewInteraction.escalation_reason ? (
                            <p className="mt-2 whitespace-pre-wrap">
                              {selectedAssistantReviewInteraction.escalation_reason}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Run metadata</p>
                          <p className="mt-2">Model: {selectedAssistantReviewInteraction.model ?? "Unknown"}</p>
                          <p>Page: {selectedAssistantReviewInteraction.current_page ?? "Unknown"}</p>
                          <p>Priority: {selectedAssistantReviewInteraction.priority}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-md border border-slate-200 p-3">
                        <h4 className="font-semibold text-slate-900">Admin review history</h4>
                        {selectedAssistantAdminReviews.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-600">
                            No admin review notes yet.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {selectedAssistantAdminReviews.map((review) => (
                              <div
                                className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                                key={review.id}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {review.review_status.replaceAll("_", " ")}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {formatDate(review.created_at)}
                                  </span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap">
                                  {review.admin_note || "No note entered."}
                                </p>
                                {review.recommended_action ? (
                                  <p className="mt-2 whitespace-pre-wrap font-semibold text-slate-900">
                                    {review.recommended_action}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {assistantAnalysisResult ? (
                        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                          <h4 className="font-semibold">Latest filtered analysis</h4>
                          <p className="mt-2 whitespace-pre-wrap">
                            {assistantAnalysisResult.analysisSummary}
                          </p>
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <div>
                              <p className="font-semibold">Patterns</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {assistantAnalysisResult.failurePatterns.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold">Strengths</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {assistantAnalysisResult.strengths.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold">Prompt ideas</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {assistantAnalysisResult.promptRecommendations.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold">UI/workflow ideas</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {assistantAnalysisResult.uiRecommendations.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {selectedAssistantAnalysisRun ? (
                        <div className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="font-semibold text-slate-900">
                                Saved analysis run
                              </h4>
                              <p className="mt-1 text-slate-500">
                                {formatDate(selectedAssistantAnalysisRun.created_at)} ·{" "}
                                {selectedAssistantAnalysisRun.interaction_count} answer
                                {selectedAssistantAnalysisRun.interaction_count === 1
                                  ? ""
                                  : "s"}{" "}
                                reviewed
                              </p>
                              {selectedAssistantAnalysisRun.prompt_versions.length > 0 ? (
                                <p className="mt-1 text-slate-500">
                                  Prompt versions:{" "}
                                  {selectedAssistantAnalysisRun.prompt_versions.join(", ")}
                                </p>
                              ) : null}
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                              {supportAnalysisStatusLabel(
                                selectedAssistantAnalysisRun.admin_status
                              )}
                            </span>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap">
                            {selectedAssistantAnalysisRun.analysis_summary}
                          </p>

                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <div>
                              <p className="font-semibold text-slate-900">Patterns</p>
                              {selectedAssistantAnalysisRun.failure_patterns.length > 0 ? (
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                  {selectedAssistantAnalysisRun.failure_patterns.map(
                                    (item) => (
                                      <li key={item}>{item}</li>
                                    )
                                  )}
                                </ul>
                              ) : (
                                <p className="mt-1 text-slate-500">No patterns saved.</p>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">Strengths</p>
                              {selectedAssistantAnalysisRun.strengths.length > 0 ? (
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                  {selectedAssistantAnalysisRun.strengths.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-slate-500">No strengths saved.</p>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">Prompt ideas</p>
                              {selectedAssistantAnalysisRun.prompt_recommendations.length >
                              0 ? (
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                  {selectedAssistantAnalysisRun.prompt_recommendations.map(
                                    (item) => (
                                      <li key={item}>{item}</li>
                                    )
                                  )}
                                </ul>
                              ) : (
                                <p className="mt-1 text-slate-500">No prompt ideas saved.</p>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">
                                UI/workflow ideas
                              </p>
                              {selectedAssistantAnalysisRun.ui_recommendations.length >
                              0 ? (
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                  {selectedAssistantAnalysisRun.ui_recommendations.map(
                                    (item) => (
                                      <li key={item}>{item}</li>
                                    )
                                  )}
                                </ul>
                              ) : (
                                <p className="mt-1 text-slate-500">No UI ideas saved.</p>
                              )}
                            </div>
                          </div>

                          <form
                            className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3"
                            onSubmit={handleUpdateAssistantAnalysisRun}
                          >
                            <h5 className="font-semibold text-slate-900">
                              Admin conclusion
                            </h5>
                            <label className="mt-3 block text-sm font-medium text-slate-700">
                              Status
                              <select
                                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                                onChange={(event) =>
                                  setAssistantAnalysisRunStatus(
                                    event.target.value as SupportAssistantAnalysisStatus
                                  )
                                }
                                value={assistantAnalysisRunStatus}
                              >
                                <option value="new">New</option>
                                <option value="reviewed">Reviewed</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                                <option value="needs_more_data">Needs more data</option>
                              </select>
                            </label>
                            <label className="mt-3 block text-sm font-medium text-slate-700">
                              Admin note
                              <textarea
                                className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
                                onChange={(event) =>
                                  setAssistantAnalysisRunNote(event.target.value)
                                }
                                placeholder="What should you do with this analysis?"
                                value={assistantAnalysisRunNote}
                              />
                            </label>
                            <button
                              className="mt-3 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                              disabled={savingAssistantAnalysisRunReview}
                              type="submit"
                            >
                              {savingAssistantAnalysisRunReview
                                ? "Saving..."
                                : "Save analysis review"}
                            </button>
                          </form>
                        </div>
                      ) : null}

                      <form
                        className="mt-4 rounded-md border border-slate-200 p-3"
                        onSubmit={handleCreateAssistantAdminReview}
                      >
                        <h4 className="font-semibold text-slate-900">Add admin interpretation</h4>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Review status
                            <select
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                              onChange={(event) =>
                                setAssistantReviewStatus(
                                  event.target.value as SupportAssistantReviewStatus
                                )
                              }
                              value={assistantReviewStatus}
                            >
                              <option value="needs_review">Needs review</option>
                              <option value="good_answer">Good answer</option>
                              <option value="needs_prompt_work">Needs prompt work</option>
                              <option value="needs_ui_work">Needs UI/workflow work</option>
                              <option value="should_escalate">Should escalate</option>
                              <option value="not_actionable">Not actionable</option>
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Recommended action
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                              onChange={(event) =>
                                setAssistantReviewRecommendedAction(event.target.value)
                              }
                              placeholder="Optional next step"
                              value={assistantReviewRecommendedAction}
                            />
                          </label>
                        </div>
                        <label className="mt-3 block text-sm font-medium text-slate-700">
                          Admin note
                          <textarea
                            className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
                            onChange={(event) =>
                              setAssistantReviewNote(event.target.value)
                            }
                            placeholder="What did this answer do well or poorly?"
                            value={assistantReviewNote}
                          />
                        </label>
                        <button
                          className="mt-3 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                          disabled={savingAssistantAdminReview || !assistantReviewNote.trim()}
                          type="submit"
                        >
                          {savingAssistantAdminReview ? "Saving..." : "Save admin review"}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </section>

  );
}
