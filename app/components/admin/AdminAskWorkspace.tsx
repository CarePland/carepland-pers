"use client";

import { FormEvent, useState } from "react";

export type AskCaseStatus =
  | "open"
  | "waiting_on_user"
  | "waiting_on_admin"
  | "resolved"
  | "closed";

export type AskAnswerQuality =
  | "good"
  | "incomplete"
  | "misleading"
  | "poorly_routed"
  | "unnecessary";

export type AskImprovementCategory =
  | "prompt_issue"
  | "missing_knowledge"
  | "ui_confusion"
  | "product_bug"
  | "routing_error"
  | "non_actionable";

export type AdminAskThread = {
  case_status: AskCaseStatus;
  created_at: string;
  id: string;
  needs_admin_followup: boolean;
  resolved_at: string | null;
  updated_at: string;
  user_has_unread_update: boolean;
  user_id: string;
  user_label: string;
};

export type AdminAskMessage = {
  author_role: "user" | "assistant" | "admin" | "system";
  created_at: string;
  id: string;
  is_internal: boolean;
  message_body: string;
  thread_id: string;
};

export type AdminAskSubmission = {
  ai_summary: string;
  created_at: string;
  id: string;
  original_user_wording: string;
  outcome: string;
  recommended_actions: Array<Record<string, unknown>> | null;
  router_category: string;
  router_confidence: number | string;
  router_rationale: string;
  routing_state: string;
  safety_flags: Record<string, unknown> | null;
  thread_id: string;
  transcript: string;
  user_feedback: string | null;
};

export type AdminAskSubmissionReview = {
  admin_note: string;
  answer_quality: AskAnswerQuality | null;
  ask_submission_id: string;
  created_at: string;
  id: string;
  improvement_category: AskImprovementCategory | null;
  recommended_action: string | null;
  reviewer_label: string;
};

export type AdminAskProductArea = {
  area_key: string;
  label: string;
};

const answerQualityLabels: Record<AskAnswerQuality, string> = {
  good: "Good",
  incomplete: "Incomplete",
  misleading: "Misleading",
  poorly_routed: "Poorly routed",
  unnecessary: "Unnecessary",
};

const improvementCategoryLabels: Record<AskImprovementCategory, string> = {
  missing_knowledge: "Missing knowledge",
  non_actionable: "Non-actionable",
  product_bug: "Product bug",
  prompt_issue: "Prompt issue",
  routing_error: "Routing error",
  ui_confusion: "UI confusion",
};

function confidencePercent(value: number | string): string {
  const numeric = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(numeric) ? `${Math.round(numeric * 100)}%` : "—";
}

function readableValue(value: string): string {
  return value.replace(/_/g, " ");
}

export type AdminAskSendInput = {
  caseStatusOverride: AskCaseStatus | null;
  isInternal: boolean;
  messageBody: string;
};

export type AdminAskReviewInput = {
  adminNote: string;
  answerQuality: AskAnswerQuality | null;
  improvementCategory: AskImprovementCategory | null;
  recommendedAction: string;
};

export type AdminAskProductItemInput = {
  areaKey: string;
  body: string;
  title: string;
};

type AdminAskWorkspaceProps = {
  formatDate: (value: string) => string;
  loadingThread: boolean;
  onCreateProductItem: (input: AdminAskProductItemInput) => void;
  onQuickSetStatus: (status: AskCaseStatus) => void;
  onSend: (input: AdminAskSendInput, review: AdminAskReviewInput | null) => void;
  productAreas: AdminAskProductArea[];
  reviewHistory: AdminAskSubmissionReview[];
  saving: boolean;
  savingProductItem: boolean;
  savingQuickStatus: boolean;
  submission: AdminAskSubmission | null;
  thread: AdminAskThread | null;
  threadMessages: AdminAskMessage[];
};

// The single canonical handling surface -- opened by thread id from either
// admin queue (Needs Response or AI Quality Review). Everything an admin
// can do to a conversation lives here: read it, see the AI's read on it,
// reply or leave an internal note, resolve/reopen, and optionally record a
// quality verdict, all through one Send action. There is deliberately no
// separate "create a ticket" escalation -- the thread IS the case, so
// routing it to a human is just leaving it in case_status = waiting_on_admin,
// not spawning a second record.
export function AdminAskWorkspace({
  formatDate,
  loadingThread,
  onCreateProductItem,
  onQuickSetStatus,
  onSend,
  productAreas,
  reviewHistory,
  saving,
  savingProductItem,
  savingQuickStatus,
  submission,
  thread,
  threadMessages,
}: AdminAskWorkspaceProps) {
  const [messageBody, setMessageBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [caseStatusChoice, setCaseStatusChoice] = useState<AskCaseStatus | "">("");
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [answerQuality, setAnswerQuality] = useState<AskAnswerQuality | "">("");
  const [improvementCategory, setImprovementCategory] = useState<
    AskImprovementCategory | ""
  >("");
  const [reviewNote, setReviewNote] = useState("");
  const [recommendedAction, setRecommendedAction] = useState("");
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [productAreaKey, setProductAreaKey] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [productBody, setProductBody] = useState("");

  if (!thread) {
    // Also covers the brief window between clicking a queue row and its
    // fetch resolving -- the parent clears thread to null on every
    // selection (including switching between two already-loaded threads),
    // so there is never a moment where this renders a previous thread's
    // stale header, AI panel, or compose form.
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-slate-600">
        {loadingThread
          ? "Loading conversation..."
          : "Select a conversation to open it here."}
      </div>
    );
  }

  const hasReviewInput = Boolean(
    answerQuality || improvementCategory || reviewNote.trim()
  );

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedBody = messageBody.trim();

    if (!trimmedBody && !hasReviewInput) {
      return;
    }

    onSend(
      {
        caseStatusOverride: isInternal ? null : (caseStatusChoice || null),
        isInternal,
        messageBody: trimmedBody,
      },
      hasReviewInput
        ? {
            adminNote: reviewNote.trim(),
            answerQuality: answerQuality || null,
            improvementCategory: improvementCategory || null,
            recommendedAction: recommendedAction.trim(),
          }
        : null
    );

    setMessageBody("");
    setIsInternal(false);
    setCaseStatusChoice("");
    setAnswerQuality("");
    setImprovementCategory("");
    setReviewNote("");
    setRecommendedAction("");
  }

  function handleCreateProductItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!productAreaKey || !productTitle.trim()) {
      return;
    }

    onCreateProductItem({
      areaKey: productAreaKey,
      body: productBody.trim(),
      title: productTitle.trim(),
    });
    setProductFormOpen(false);
    setProductTitle("");
    setProductBody("");
  }

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">
            {thread.user_label}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Opened {formatDate(thread.created_at)} · updated{" "}
            {formatDate(thread.updated_at)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            {readableValue(thread.case_status)}
          </span>
          {thread.needs_admin_followup ? (
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
              Needs response
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              No admin follow-up
            </span>
          )}
        </div>
      </div>

      {/* Quick status actions -- for confirming/closing or reopening a
          thread with no new message to send. The primary way to change
          status is still picking it alongside a reply below, since most
          resolves/reopens come with something worth telling the user. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {thread.case_status !== "resolved" && thread.case_status !== "closed" ? (
          <button
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-60"
            disabled={savingQuickStatus}
            onClick={() => onQuickSetStatus("resolved")}
            type="button"
          >
            {savingQuickStatus ? "Saving..." : "Confirm & close (no reply)"}
          </button>
        ) : (
          <button
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-60"
            disabled={savingQuickStatus}
            onClick={() => onQuickSetStatus("waiting_on_admin")}
            type="button"
          >
            {savingQuickStatus ? "Saving..." : "Reopen"}
          </button>
        )}
      </div>

      {/* AI panel -- the AI's interpretation of this conversation, if any.
          Not every thread has a submission (a purely human-originated
          conversation, e.g. migrated from a legacy ticket, never went
          through the router), so this section is conditional rather than
          assuming one always exists. */}
      {submission ? (
        <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                AI interpretation
              </p>
              <p className="mt-1 text-sm text-slate-800">
                {submission.ai_summary || submission.original_user_wording}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-sky-800">
                {readableValue(submission.router_category)}
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-sky-800">
                {confidencePercent(submission.router_confidence)} confidence
              </span>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-sky-800">
                {readableValue(submission.routing_state)}
              </span>
            </div>
          </div>

          {submission.router_rationale ? (
            <p className="mt-2 text-xs text-slate-600">
              Rationale: {submission.router_rationale}
            </p>
          ) : null}

          {submission.user_feedback ? (
            <p className="mt-2 text-xs text-slate-600">
              User feedback: {submission.user_feedback}
            </p>
          ) : null}

          {submission.safety_flags &&
          Object.keys(submission.safety_flags).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(submission.safety_flags).map(([key, value]) => (
                <span
                  className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800"
                  key={key}
                >
                  {readableValue(key)}: {String(value)}
                </span>
              ))}
            </div>
          ) : null}

          {reviewHistory.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Review history
              </p>
              {reviewHistory.map((review) => (
                <div
                  className="rounded-md bg-white p-2 text-xs text-slate-700"
                  key={review.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {review.answer_quality ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                        {answerQualityLabels[review.answer_quality]}
                      </span>
                    ) : null}
                    {review.improvement_category ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                        {improvementCategoryLabels[review.improvement_category]}
                      </span>
                    ) : null}
                    <span className="text-slate-400">
                      {review.reviewer_label} · {formatDate(review.created_at)}
                    </span>
                  </div>
                  {review.admin_note ? (
                    <p className="mt-1 whitespace-pre-wrap">{review.admin_note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3">
            {productFormOpen ? (
              <form
                className="rounded-md border border-slate-200 bg-white p-3"
                onSubmit={handleCreateProductItem}
              >
                <div className="grid gap-2 md:grid-cols-3">
                  <label className="block text-xs font-medium text-slate-700">
                    Area
                    <select
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      onChange={(event) => setProductAreaKey(event.target.value)}
                      value={productAreaKey}
                    >
                      <option value="">Choose...</option>
                      {productAreas.map((area) => (
                        <option key={area.area_key} value={area.area_key}>
                          {area.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-700 md:col-span-2">
                    Title
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      onChange={(event) => setProductTitle(event.target.value)}
                      value={productTitle}
                    />
                  </label>
                </div>
                <label className="mt-2 block text-xs font-medium text-slate-700">
                  Details
                  <textarea
                    className="mt-1 min-h-16 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    onChange={(event) => setProductBody(event.target.value)}
                    value={productBody}
                  />
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-400"
                    disabled={
                      savingProductItem || !productAreaKey || !productTitle.trim()
                    }
                    type="submit"
                  >
                    {savingProductItem ? "Saving..." : "Save to backlog"}
                  </button>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    onClick={() => setProductFormOpen(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700"
                onClick={() => {
                  setProductTitle(submission.ai_summary || "");
                  setProductFormOpen(true);
                }}
                type="button"
              >
                Send to product backlog
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          No AI interpretation for this conversation.
        </p>
      )}

      {/* Conversation */}
      <div className="mt-4 max-h-[24rem] space-y-3 overflow-auto rounded-md bg-slate-50 p-3">
        {loadingThread ? (
          <p className="text-sm text-slate-600">Loading conversation...</p>
        ) : threadMessages.length === 0 ? (
          <p className="text-sm text-slate-600">No messages yet.</p>
        ) : (
          threadMessages.map((messageRow) => (
            <div
              className={`rounded-md border p-3 ${
                messageRow.is_internal
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : messageRow.author_role === "admin"
                    ? "border-sky-200 bg-sky-50 text-slate-800"
                    : messageRow.author_role === "assistant"
                      ? "border-violet-200 bg-violet-50 text-slate-800"
                      : "border-slate-200 bg-white text-slate-800"
              }`}
              key={messageRow.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>
                  {messageRow.is_internal
                    ? "Internal note"
                    : messageRow.author_role === "admin"
                      ? "Admin reply"
                      : messageRow.author_role === "assistant"
                        ? "CarePland assistant"
                        : "User"}
                </span>
                <span>{formatDate(messageRow.created_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {messageRow.message_body}
              </p>
            </div>
          ))
        )}
      </div>

      {/* The single normal action: reply/note, optionally a status change,
          optionally a review verdict -- one Send. */}
      <form className="mt-4 rounded-md border border-slate-200 p-3" onSubmit={handleSend}>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              checked={!isInternal}
              onChange={() => setIsInternal(false)}
              type="radio"
            />
            Reply to user
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              checked={isInternal}
              onChange={() => setIsInternal(true)}
              type="radio"
            />
            Internal note
          </label>
        </div>
        <textarea
          className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
          onChange={(event) => setMessageBody(event.target.value)}
          placeholder={
            isInternal
              ? "Private note, not visible to the user."
              : "Write a user-visible reply."
          }
          value={messageBody}
        />

        {!isInternal ? (
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Also set case status (optional)
            <select
              className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2"
              onChange={(event) =>
                setCaseStatusChoice(event.target.value as AskCaseStatus | "")
              }
              value={caseStatusChoice}
            >
              <option value="">Leave as is</option>
              <option value="resolved">Mark resolved</option>
              <option value="waiting_on_user">Waiting on user</option>
              <option value="waiting_on_admin">Keep needing follow-up</option>
            </select>
          </label>
        ) : null}

        <div className="mt-3">
          <button
            className="text-sm font-semibold text-sky-700"
            onClick={() => setReviewExpanded((expanded) => !expanded)}
            type="button"
          >
            {reviewExpanded ? "Hide review" : "Review this answer (optional)"}
          </button>
        </div>

        {reviewExpanded ? (
          <div className="mt-2 grid gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Answer quality
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                onChange={(event) =>
                  setAnswerQuality(event.target.value as AskAnswerQuality | "")
                }
                value={answerQuality}
              >
                <option value="">Not rated</option>
                {(Object.keys(answerQualityLabels) as AskAnswerQuality[]).map(
                  (value) => (
                    <option key={value} value={value}>
                      {answerQualityLabels[value]}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Improvement category
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                onChange={(event) =>
                  setImprovementCategory(
                    event.target.value as AskImprovementCategory | ""
                  )
                }
                value={improvementCategory}
              >
                <option value="">None</option>
                {(
                  Object.keys(improvementCategoryLabels) as AskImprovementCategory[]
                ).map((value) => (
                  <option key={value} value={value}>
                    {improvementCategoryLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Review note
              <textarea
                className="mt-1 min-h-16 w-full rounded-md border border-slate-300 px-3 py-2"
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Optional -- what should change, or why this was good."
                value={reviewNote}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Recommended action
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                onChange={(event) => setRecommendedAction(event.target.value)}
                placeholder="Optional -- e.g. 'add appointment-reschedule steps to the prompt'"
                value={recommendedAction}
              />
            </label>
          </div>
        ) : null}

        <button
          className="mt-3 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
          disabled={saving || (!messageBody.trim() && !hasReviewInput)}
          type="submit"
        >
          {saving ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
