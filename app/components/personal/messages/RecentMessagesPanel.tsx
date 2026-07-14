"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { EnvelopeIcon } from "../../shared/icons";

export type PersonalMessage = {
  acknowledgedAt?: string;
  allowsCallbackRequest?: boolean;
  appointmentId?: string;
  audioUrl?: string;
  body: string;
  callbackRequestedAt?: string;
  createdAt: string;
  deliveredAt?: string;
  from?: string;
  heardAt?: string;
  id: string;
  messageType?: string;
  readAt?: string;
  requiresAcknowledgement?: boolean;
  senderRole?: string;
  to?: string;
  transcript?: string;
};

type RecentMessagesPanelProps = {
  action?: ReactNode;
  emptyLabel?: string;
  firstMessageAction?: ReactNode;
  formatDate: (value: string | null) => string;
  loading?: boolean;
  messages: PersonalMessage[];
  onOpenAppointmentMessage?: (message: PersonalMessage) => void;
  onOpenMessage?: (message: PersonalMessage) => void;
  onSummaryFeedback?: (input: { userComment: string }) => Promise<void>;
  summary?: string;
  title?: string;
};

export function RecentMessagesPanel({
  action,
  emptyLabel = "No messages yet.",
  firstMessageAction,
  formatDate,
  loading = false,
  messages,
  onOpenAppointmentMessage,
  onOpenMessage,
  onSummaryFeedback,
  summary,
  title = "Messages",
}: RecentMessagesPanelProps) {
  const showHeader = Boolean(title || action);
  const [feedbackConcern, setFeedbackConcern] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  const closeFeedback = () => {
    if (feedbackSaving) return;
    setFeedbackConcern("");
    setFeedbackError("");
    setFeedbackOpen(false);
  };

  const submitFeedback = async () => {
    const userComment = feedbackConcern.trim();
    if (!userComment) {
      setFeedbackError("Please describe what was not quite right.");
      return;
    }

    setFeedbackError("");
    setFeedbackSaving(true);
    try {
      await onSummaryFeedback?.({ userComment });
      setFeedbackConcern("");
      setFeedbackOpen(false);
      setFeedbackSaved(true);
    } catch (error) {
      setFeedbackError(
        error instanceof Error ? error.message : "Unable to send feedback."
      );
    } finally {
      setFeedbackSaving(false);
    }
  };

  return (
    <section className="px-1 py-2">
      {showHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {title ? (
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            </div>
          ) : null}
          {action}
        </div>
      ) : null}

      {!loading && summary ? (
        <div
          className={
            showHeader
              ? "mt-3 flex items-start justify-between gap-3"
              : "flex items-start justify-between gap-3"
          }
        >
          <p className="min-w-0 text-sm leading-6 text-slate-700">{summary}</p>
          {onSummaryFeedback ? (
            <button
              className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              onClick={() => {
                setFeedbackError("");
                setFeedbackSaved(false);
                setFeedbackOpen(true);
              }}
              type="button"
            >
              Not quite
            </button>
          ) : null}
        </div>
      ) : null}
      {feedbackSaved ? (
        <p className="mt-2 text-xs font-medium text-emerald-700">
          Thanks. Your feedback was saved.
        </p>
      ) : null}

      {loading ? (
        <p className={showHeader ? "mt-4 text-sm font-medium text-slate-500" : "text-sm font-medium text-slate-500"}>Loading messages...</p>
      ) : messages.length === 0 ? (
        <p className={showHeader ? "mt-4 text-sm text-slate-500" : "text-sm text-slate-500"}>
          {emptyLabel}
        </p>
      ) : (
        <div className={showHeader ? "mt-3 divide-y divide-slate-100" : "divide-y divide-slate-100"}>
          {messages.map((message, index) => {
            const canOpen = Boolean(
              message.appointmentId ? onOpenAppointmentMessage : onOpenMessage
            );
            const seenLabel = messageSeenLabel(message);
            const rowAction = index === 0 ? firstMessageAction : null;
            const openMessage = () => {
              if (message.appointmentId) {
                onOpenAppointmentMessage?.(message);
                return;
              }

              onOpenMessage?.(message);
            };

            return (
              <div
                className="grid w-full gap-2 px-1 py-3 text-left transition hover:bg-blue-50/40"
                key={message.id}
              >
                <span className="grid gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <span className="flex min-w-0 items-start gap-2">
                    <MessageRowContent canOpen={canOpen} onOpen={openMessage}>
                      <EnvelopeIcon className="mt-1 h-4 w-4 shrink-0 text-blue-500" />
                      <span className="line-clamp-2 min-w-0">
                        {message.body || message.transcript || "Voice message"}
                      </span>
                    </MessageRowContent>
                    {rowAction ? <span className="-mt-0.5 shrink-0">{rowAction}</span> : null}
                  </span>
                  <span className="pt-1 text-left text-xs font-medium text-slate-500 sm:text-right">
                    <span>
                      <span className="inline-flex flex-wrap justify-start gap-x-3 gap-y-0.5 sm:justify-end">
                        <span>{messageDirectionLabel(message)}</span>
                        <span>{formatDate(message.createdAt)}</span>
                      </span>
                      {seenLabel ? <span className="mt-0.5 block">{seenLabel}</span> : null}
                    </span>
                  </span>
                </span>
                {message.messageType === "audio" || message.audioUrl ? (
                  <span className="flex flex-wrap gap-1.5">
                    <MessagePill>Voice</MessagePill>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {feedbackOpen && summary ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-6">
          <div
            aria-modal="true"
            className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
            role="dialog"
          >
            <p className="text-sm font-semibold text-slate-950">
              CarePland&apos;s message summary:
            </p>
            <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
              {summary}
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Please describe the concerns you have about this summary:
              <textarea
                autoFocus
                className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => {
                  setFeedbackConcern(event.target.value);
                  setFeedbackError("");
                }}
                value={feedbackConcern}
              />
            </label>
            {feedbackError ? (
              <p className="mt-2 text-sm font-medium text-rose-700">
                {feedbackError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition hover:border-blue-200 hover:bg-blue-100 disabled:opacity-60"
                disabled={feedbackSaving}
                onClick={() => {
                  void submitFeedback();
                }}
                type="button"
              >
                {feedbackSaving ? "Sending..." : "Send"}
              </button>
              <button
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                disabled={feedbackSaving}
                onClick={closeFeedback}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function AppointmentMessagesSection({
  firstMessageAction,
  formatDate,
  loading,
  messages,
}: {
  firstMessageAction?: ReactNode;
  formatDate: (value: string | null) => string;
  loading?: boolean;
  messages: PersonalMessage[];
}) {
  return (
    <RecentMessagesPanel
      emptyLabel="No messages are linked to this appointment yet."
      firstMessageAction={firstMessageAction}
      formatDate={formatDate}
      loading={loading}
      messages={messages}
      title=""
    />
  );
}

function MessageRowContent({
  canOpen,
  children,
  onOpen,
}: {
  canOpen: boolean;
  children: ReactNode;
  onOpen: () => void;
}) {
  const className =
    "flex min-w-0 items-start gap-2 text-base leading-6 text-slate-700";

  if (!canOpen) {
    return <span className={className}>{children}</span>;
  }

  return (
    <button className={`${className} text-left`} onClick={onOpen} type="button">
      {children}
    </button>
  );
}

function MessagePill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
      {children}
    </span>
  );
}

function messageDirectionLabel(message: PersonalMessage) {
  const sender = message.from?.trim();
  const recipient = message.to?.trim();

  if (message.senderRole === "receiver") {
    return sender && recipient ? `${sender} to ${recipient}` : "From Receiver";
  }

  return sender && recipient ? `${sender} to ${recipient}` : "To Receiver";
}

function messageSeenLabel(message: PersonalMessage) {
  if (!message.readAt && !message.heardAt && !message.acknowledgedAt) {
    return "";
  }

  const recipientName = firstName(message.to) || "recipient";
  return `Seen by ${recipientName}`;
}

function firstName(value: string | undefined) {
  const cleaned = value?.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  return cleaned?.split(" ")[0] ?? "";
}
