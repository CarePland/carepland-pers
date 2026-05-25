"use client";

import { FormEvent } from "react";

export type SupportTicketStatus =
  | "closed"
  | "in_progress"
  | "open"
  | "resolved"
  | "waiting_on_user";

export type SupportTicketPriority = "high" | "low" | "medium" | "urgent";

export type SupportTicket = {
  ask_submission_id: string | null;
  id: string;
  category: string;
  created_at: string;
  current_page: string | null;
  needs_admin_followup: boolean;
  priority: SupportTicketPriority;
  profiles?: {
    display_name: string | null;
    email: string | null;
    family_name: string | null;
    given_name: string | null;
  } | null;
  status: SupportTicketStatus;
  subject: string;
  updated_at: string;
  user_has_unread_update: boolean;
  user_id: string;
};

export type SupportTicketMessage = {
  id: string;
  author_role: "admin" | "system" | "user";
  created_at: string;
  is_internal: boolean;
  message_body: string;
  ticket_id: string;
};

type AdminSupportTicketsPanelProps = {
  adminTicketCategory: string;
  adminTicketChangeNote: string;
  adminTicketInternalNote: string;
  adminTicketNeedsFollowup: boolean;
  adminTicketPriority: SupportTicketPriority;
  adminTicketReplyBody: string;
  adminTicketStatus: SupportTicketStatus;
  formatDate: (value: string | null) => string;
  lastViewedAt: string | null;
  loading: boolean;
  messages: SupportTicketMessage[];
  onAddInternalNote: (event: FormEvent<HTMLFormElement>) => void;
  onAddReply: (event: FormEvent<HTMLFormElement>) => void;
  onOpenAskSubmission: (askSubmissionId: string) => void;
  onRefresh: () => void;
  onSelectTicket: (ticket: SupportTicket) => void;
  onSetCategory: (value: string) => void;
  onSetChangeNote: (value: string) => void;
  onSetInternalNote: (value: string) => void;
  onSetNeedsFollowup: (value: boolean) => void;
  onSetPriority: (value: SupportTicketPriority) => void;
  onSetReplyBody: (value: string) => void;
  onSetStatus: (value: SupportTicketStatus) => void;
  onUpdateStatus: (event: FormEvent<HTMLFormElement>) => void;
  savingReply: boolean;
  savingStatus: boolean;
  selectedTicket: SupportTicket | null;
  tickets: SupportTicket[];
};

function isNewForAdmin(
  activityAt: string | null,
  lastViewedAt: string | null
) {
  if (!activityAt) {
    return false;
  }

  if (!lastViewedAt) {
    return true;
  }

  return new Date(activityAt).getTime() > new Date(lastViewedAt).getTime();
}

function supportTicketUserLabel(ticket: SupportTicket) {
  const profile = ticket.profiles;
  const displayName = profile?.display_name?.trim();
  const fullName = [profile?.given_name, profile?.family_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return displayName || fullName || profile?.email || ticket.user_id;
}

export function AdminSupportTicketsPanel({
  adminTicketCategory,
  adminTicketChangeNote,
  adminTicketInternalNote,
  adminTicketNeedsFollowup,
  adminTicketPriority,
  adminTicketReplyBody,
  adminTicketStatus,
  formatDate,
  lastViewedAt,
  loading,
  messages,
  onAddInternalNote,
  onAddReply,
  onOpenAskSubmission,
  onRefresh,
  onSelectTicket,
  onSetCategory,
  onSetChangeNote,
  onSetInternalNote,
  onSetNeedsFollowup,
  onSetPriority,
  onSetReplyBody,
  onSetStatus,
  onUpdateStatus,
  savingReply,
  savingStatus,
  selectedTicket,
  tickets,
}: AdminSupportTicketsPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Support questions</h2>
          <p className="mt-1 text-slate-600">
            Review user questions, reply, and track follow-up state.
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

      <div className="mt-5 grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="space-y-2">
          {tickets.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
              No support questions yet.
            </div>
          ) : (
            tickets.map((ticket) => {
              const selected = selectedTicket?.id === ticket.id;
              const isNewToAdmin = isNewForAdmin(ticket.updated_at, lastViewedAt);

              return (
                <button
                  className={`w-full rounded-md border p-3 text-left transition ${
                    selected
                      ? isNewToAdmin
                        ? "border-red-300 bg-red-50"
                        : ticket.needs_admin_followup
                          ? "border-amber-300 bg-amber-50"
                          : "border-sky-300 bg-sky-50"
                      : isNewToAdmin
                        ? "border-red-200 bg-red-50/70"
                        : ticket.needs_admin_followup
                          ? "border-amber-200 bg-amber-50/70"
                          : "border-slate-200 bg-white hover:border-sky-200"
                  }`}
                  key={ticket.id}
                  onClick={() => onSelectTicket(ticket)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      {ticket.subject}
                    </span>
                    {ticket.needs_admin_followup ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                        Follow up
                      </span>
                    ) : null}
                    {isNewToAdmin ? (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                        New to me
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {supportTicketUserLabel(ticket)}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                    {ticket.status.replace("_", " ")} · {ticket.priority}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Updated {formatDate(ticket.updated_at)}
                  </p>
                </button>
              );
            })
          )}
        </aside>

        {selectedTicket ? (
          <div className="rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {selectedTicket.subject}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {supportTicketUserLabel(selectedTicket)} ·{" "}
                  {selectedTicket.category}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Opened {formatDate(selectedTicket.created_at)} · updated{" "}
                  {formatDate(selectedTicket.updated_at)}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                  {selectedTicket.status.replace("_", " ")}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                  {selectedTicket.priority}
                </span>
                {selectedTicket.needs_admin_followup ? (
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

            {selectedTicket.ask_submission_id ? (
              <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                  Ask intake source
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-700">
                    This ticket was created from an Ask conversation.
                  </p>
                  <button
                    className="rounded-md border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-700"
                    onClick={() =>
                      onOpenAskSubmission(selectedTicket.ask_submission_id ?? "")
                    }
                    type="button"
                  >
                    Open Ask review
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-4 max-h-[28rem] space-y-3 overflow-auto rounded-md bg-slate-50 p-3">
              {messages.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No messages found for this question.
                </p>
              ) : (
                messages.map((messageRow) => (
                  <div
                    className={`rounded-md border p-3 ${
                      messageRow.is_internal
                        ? "border-amber-200 bg-amber-50 text-amber-950"
                        : messageRow.author_role === "admin"
                          ? "border-sky-200 bg-sky-50 text-slate-800"
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

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <form
                className="rounded-md border border-slate-200 p-3"
                onSubmit={onAddReply}
              >
                <h4 className="font-semibold text-slate-900">Reply to user</h4>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => onSetReplyBody(event.target.value)}
                  placeholder="Write a user-visible reply."
                  value={adminTicketReplyBody}
                />
                <button
                  className="mt-3 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                  disabled={savingReply || !adminTicketReplyBody.trim()}
                  type="submit"
                >
                  {savingReply ? "Sending..." : "Send reply"}
                </button>
              </form>

              <form
                className="rounded-md border border-slate-200 p-3"
                onSubmit={onAddInternalNote}
              >
                <h4 className="font-semibold text-slate-900">Internal note</h4>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => onSetInternalNote(event.target.value)}
                  placeholder="Private admin note."
                  value={adminTicketInternalNote}
                />
                <button
                  className="mt-3 rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:text-slate-400"
                  disabled={savingReply || !adminTicketInternalNote.trim()}
                  type="submit"
                >
                  {savingReply ? "Saving..." : "Add internal note"}
                </button>
              </form>
            </div>

            <form
              className="mt-4 rounded-md border border-slate-200 p-3"
              onSubmit={onUpdateStatus}
            >
              <h4 className="font-semibold text-slate-900">
                Status and routing
              </h4>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="block text-sm font-medium text-slate-700">
                  Status
                  <select
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                    onChange={(event) =>
                      onSetStatus(event.target.value as SupportTicketStatus)
                    }
                    value={adminTicketStatus}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="waiting_on_user">Waiting on user</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Priority
                  <select
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                    onChange={(event) =>
                      onSetPriority(event.target.value as SupportTicketPriority)
                    }
                    value={adminTicketPriority}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Category
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                    onChange={(event) => onSetCategory(event.target.value)}
                    value={adminTicketCategory}
                  />
                </label>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  checked={adminTicketNeedsFollowup}
                  onChange={(event) => onSetNeedsFollowup(event.target.checked)}
                  type="checkbox"
                />
                Needs admin follow-up
              </label>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Change note
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                  onChange={(event) => onSetChangeNote(event.target.value)}
                  placeholder="What changed and why?"
                  value={adminTicketChangeNote}
                />
              </label>
              <button
                className="mt-3 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                disabled={savingStatus}
                type="submit"
              >
                {savingStatus ? "Saving..." : "Save ticket status"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}
