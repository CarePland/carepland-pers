"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  recordHelpDiagnosticsEvent,
  submitHelpDiagnostics,
} from "../../lib/platform/helpDiagnostics";

type LongOperationStatusProps = {
  allowDiagnostics?: boolean;
  assistanceDetail?: string;
  assistanceTitle?: string;
  className?: string;
  continueLabel?: string;
  context?: Record<string, unknown>;
  delayMs?: number;
  diagnosticsLabel?: string;
  diagnosticsSendingLabel?: string;
  diagnosticsSentLabel?: string;
  escalationMs?: number;
  longerThanUsualMs?: number;
  messages?: string[];
  onContinueWaiting?: () => void;
  onRetry?: () => void;
  operation?: string;
  retryLabel?: string;
  stage?: string;
  verySlowMs?: number;
  verySlowTitle?: string;
  title: string;
};

const elapsedTickMs = 1000;
const defaultLongerThanUsualMs = 10000;
const defaultVerySlowMs = 30000;
const defaultEscalationMs = 45000;
const defaultMessages = [
  "Still working...",
  "A few careful moments later...",
  "Keeping this moving. Thanks for hanging in there.",
];
const feedbackOptions = [
  "It feels frozen",
  "It is too slow",
  "It never finished",
  "Wrong result",
  "Something else",
];

export function LongOperationStatus({
  allowDiagnostics = false,
  assistanceDetail = "This is not typical, although it can happen occasionally.",
  assistanceTitle = "This is taking longer than expected.",
  className = "",
  continueLabel = "Continue Waiting",
  context = {},
  delayMs = 4500,
  diagnosticsLabel = "Send Diagnostics",
  diagnosticsSendingLabel = "Sending Diagnostics",
  diagnosticsSentLabel = "Diagnostics Sent",
  escalationMs = defaultEscalationMs,
  longerThanUsualMs = defaultLongerThanUsualMs,
  messages = defaultMessages,
  onContinueWaiting,
  onRetry,
  operation,
  retryLabel = "Try Again",
  stage = "",
  verySlowTitle = "Still working.",
  title,
  verySlowMs = defaultVerySlowMs,
}: LongOperationStatusProps) {
  const [messageIndex, setMessageIndex] = useState(-1);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [assistanceDismissed, setAssistanceDismissed] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [diagnosticsStatus, setDiagnosticsStatus] = useState<
    "idle" | "sending" | "sent" | "failed"
  >("idle");
  const [diagnosticsReference, setDiagnosticsReference] = useState("");
  const elapsedRef = useRef(0);
  const slowRecordedRef = useRef(false);
  const longerThanUsualRecordedRef = useRef(false);
  const verySlowRecordedRef = useRef(false);
  const assistanceRecordedRef = useRef(false);
  const abandonmentRecordedRef = useRef(false);
  const safeMessages = useMemo(
    () => messages.map((message) => message.trim()).filter(Boolean),
    [messages]
  );
  const operationKey = operation?.trim() ?? "";
  const effectiveStage = stage.trim();
  const shouldUseOperationFlow = Boolean(operationKey);

  useEffect(() => {
    setMessageIndex(-1);

    if (shouldUseOperationFlow || safeMessages.length === 0) {
      return;
    }

    const firstTimer = window.setTimeout(() => setMessageIndex(0), delayMs);
    const interval = window.setInterval(() => {
      setMessageIndex((currentIndex) =>
        currentIndex < 0
          ? 0
          : Math.min(currentIndex + 1, safeMessages.length - 1)
      );
    }, delayMs);

    return () => {
      window.clearTimeout(firstTimer);
      window.clearInterval(interval);
    };
  }, [delayMs, safeMessages, shouldUseOperationFlow]);

  useEffect(() => {
    if (!shouldUseOperationFlow) {
      return;
    }

    const startedAt = performance.now();
    elapsedRef.current = 0;
    slowRecordedRef.current = false;
    longerThanUsualRecordedRef.current = false;
    verySlowRecordedRef.current = false;
    assistanceRecordedRef.current = false;
    abandonmentRecordedRef.current = false;
    setElapsedMs(0);
    setAssistanceDismissed(false);
    setFeedbackOpen(false);
    setDiagnosticsStatus("idle");
    setDiagnosticsReference("");
    recordOperationEvent("operation_started", 0);

    const interval = window.setInterval(() => {
      const nextElapsedMs = Math.round(performance.now() - startedAt);
      elapsedRef.current = nextElapsedMs;
      setElapsedMs(nextElapsedMs);
    }, elapsedTickMs);
    const recordHiddenAbandonment = () => {
      if (document.visibilityState !== "hidden" || abandonmentRecordedRef.current) {
        return;
      }

      abandonmentRecordedRef.current = true;
      recordOperationEvent("operation_abandoned", elapsedRef.current);
    };

    document.addEventListener("visibilitychange", recordHiddenAbandonment);

    return () => {
      const finalElapsed = Math.round(performance.now() - startedAt);
      if (finalElapsed >= longerThanUsualMs && !abandonmentRecordedRef.current) {
        recordOperationEvent("operation_completed_after_delay", finalElapsed);
      }
      document.removeEventListener("visibilitychange", recordHiddenAbandonment);
      window.clearInterval(interval);
    };
  }, [longerThanUsualMs, operationKey, effectiveStage, shouldUseOperationFlow]);

  useEffect(() => {
    if (!shouldUseOperationFlow) return;
    if (elapsedMs >= delayMs && !slowRecordedRef.current) {
      slowRecordedRef.current = true;
      recordOperationEvent("operation_slow", elapsedMs);
    }
    if (elapsedMs >= longerThanUsualMs && !longerThanUsualRecordedRef.current) {
      longerThanUsualRecordedRef.current = true;
      recordOperationEvent("operation_longer_than_usual", elapsedMs);
    }
    if (elapsedMs >= verySlowMs && !verySlowRecordedRef.current) {
      verySlowRecordedRef.current = true;
      recordOperationEvent("operation_very_slow", elapsedMs);
    }
    if (elapsedMs >= escalationMs && !assistanceRecordedRef.current) {
      assistanceRecordedRef.current = true;
      recordOperationEvent("operation_assistance_shown", elapsedMs);
    }
  }, [
    delayMs,
    elapsedMs,
    escalationMs,
    longerThanUsualMs,
    shouldUseOperationFlow,
    verySlowMs,
  ]);

  const detail = messageIndex >= 0 ? safeMessages[messageIndex] : "";

  function recordOperationEvent(eventName: string, elapsed: number) {
    recordHelpDiagnosticsEvent(eventName, operationDetail(elapsed));
  }

  function operationDetail(elapsed: number, extra: Record<string, unknown> = {}) {
    return {
      elapsedMs: elapsed,
      operation: operationKey,
      stage: effectiveStage,
      ...context,
      ...extra,
    };
  }

  function handleContinueWaiting() {
    setAssistanceDismissed(true);
    onContinueWaiting?.();
    recordOperationEvent("user_continued_waiting", elapsedMs);
  }

  function handleRetry() {
    setAssistanceDismissed(true);
    onRetry?.();
    recordOperationEvent("user_retried", elapsedMs);
  }

  async function handleSendDiagnostics(feedbackReason = "") {
    if (diagnosticsStatus === "sending") return;

    setDiagnosticsStatus("sending");
    recordHelpDiagnosticsEvent(
      "user_sent_diagnostics",
      operationDetail(elapsedMs, { feedbackReason })
    );

    try {
      const result = await submitHelpDiagnostics({
        happenedInstead: [
          feedbackReason,
          `${title} ${currentDetail()}`.trim(),
          `Operation: ${operationKey}`,
          effectiveStage ? `Stage: ${effectiveStage}` : "",
          `Elapsed: ${formatElapsed(elapsedMs)}`,
        ]
          .filter(Boolean)
          .join("\n"),
        tryingToDo: `Waiting for ${operationKey || title} to finish.`,
      });
      setDiagnosticsReference(result.referenceId);
      setDiagnosticsStatus("sent");
      setFeedbackOpen(false);
    } catch {
      setDiagnosticsStatus("failed");
    }
  }

  function currentDetail() {
    if (!shouldUseOperationFlow) return detail;
    if (elapsedMs >= escalationMs) {
      return assistanceTitle;
    }
    if (elapsedMs >= verySlowMs) {
      return safeMessages[2] || safeMessages[1] || safeMessages[0] || "";
    }
    if (elapsedMs >= longerThanUsualMs) {
      return safeMessages[1] || safeMessages[0] || "";
    }
    if (elapsedMs >= delayMs) {
      return safeMessages[0] || "";
    }
    return "";
  }

  if (shouldUseOperationFlow) {
    const showLongerThanUsual = elapsedMs >= longerThanUsualMs;
    const showVerySlow = elapsedMs >= verySlowMs;
    const showAssistance = elapsedMs >= escalationMs && !assistanceDismissed;
    const statusTitle = showAssistance
      ? assistanceTitle
      : showVerySlow
        ? verySlowTitle
        : showLongerThanUsual
        ? "This is taking a little longer than usual."
        : title;
    const statusDetail = showAssistance
      ? assistanceDetail
      : currentDetail();

    return (
      <div
        aria-live="polite"
        className={`rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 ${className}`}
        role="status"
      >
        <span className="font-semibold">{statusTitle}</span>
        {statusDetail ? <span className="ml-2 opacity-90">{statusDetail}</span> : null}
        {showAssistance ? (
          <div className="mt-3 grid gap-3">
            <p className="text-sm opacity-90">
              We&apos;ll let you know when this finishes. Diagnostics can help us
              investigate if this keeps happening.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm font-semibold text-blue-900 shadow-sm hover:bg-blue-50"
                onClick={handleContinueWaiting}
                type="button"
              >
                {continueLabel}
              </button>
              <button
                className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-sm font-semibold text-blue-900 shadow-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!onRetry}
                onClick={handleRetry}
                type="button"
              >
                {retryLabel}
              </button>
              {allowDiagnostics ? (
                <button
                  className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-70"
                  disabled={diagnosticsStatus === "sending"}
                  onClick={() => setFeedbackOpen(true)}
                  type="button"
                >
                  {diagnosticsStatus === "sending"
                    ? diagnosticsSendingLabel
                    : diagnosticsStatus === "sent"
                      ? diagnosticsSentLabel
                      : diagnosticsLabel}
                </button>
              ) : null}
            </div>
            {feedbackOpen ? (
              <div className="grid gap-2 rounded-md border border-blue-100 bg-white p-3 text-blue-950">
                <p className="font-semibold">What happened?</p>
                <div className="flex flex-wrap gap-2">
                  {feedbackOptions.map((option) => (
                    <button
                      className="rounded-md border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-70"
                      disabled={diagnosticsStatus === "sending"}
                      key={option}
                      onClick={() => void handleSendDiagnostics(option)}
                      type="button"
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <button
                  className="w-fit rounded-md px-2 py-1 text-sm font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-70"
                  disabled={diagnosticsStatus === "sending"}
                  onClick={() => void handleSendDiagnostics()}
                  type="button"
                >
                  Send without a note
                </button>
              </div>
            ) : null}
            {diagnosticsStatus === "sent" ? (
              <p className="text-sm font-semibold">
                Diagnostics sent. Reference {diagnosticsReference}.
              </p>
            ) : diagnosticsStatus === "failed" ? (
              <p className="text-sm font-semibold">
                CarePland could not send diagnostics right now.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      className={`rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 ${className}`}
      role="status"
    >
      <span className="font-semibold">{title}</span>
      {detail ? <span className="ml-2 opacity-90">{detail}</span> : null}
    </div>
  );
}

export const CarePlandProgressStatus = LongOperationStatus;

function formatElapsed(elapsedMs: number) {
  if (elapsedMs < 1000) return `${elapsedMs}ms`;
  return `${Math.round(elapsedMs / 1000)}s`;
}
