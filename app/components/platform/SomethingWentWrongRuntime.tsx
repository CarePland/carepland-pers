"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  browserConnectAudioRecordingAvailable,
  createConnectAudioCaptureContext,
  createConnectAudioCaptureId,
  requestConnectAudioTranscription,
  startConnectAudioRecording,
  type ConnectAudioRecordingController,
} from "../../lib/connect/audio";
import {
  interpretSomethingWentWrong,
  type SomethingWentWrongDecisionTrace,
  type SomethingWentWrongInterpretation,
} from "../../lib/platform/somethingWentWrong";
import {
  recordHelpDiagnosticsEvent,
  submitHelpDiagnostics,
  type HelpDiagnosticsPacket,
} from "../../lib/platform/helpDiagnostics";

const recordingLimitMs = 60000;
const hiddenPathPrefixes = ["/privacy", "/terms", "/admin/workflows/preview"];
const hiddenExactPaths = ["/offline.html"];

type Stage = "idle" | "recording" | "transcribing" | "review" | "result" | "report_sent";

export function SomethingWentWrongRuntime() {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [interpretation, setInterpretation] =
    useState<SomethingWentWrongInterpretation | null>(null);
  const [pendingPacket, setPendingPacket] = useState<HelpDiagnosticsPacket | null>(null);
  const [reportReference, setReportReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const controllerRef = useRef<ConnectAudioRecordingController | null>(null);
  const startedAtRef = useRef(0);
  const autoStopTimerRef = useRef(0);

  useEffect(() => {
    function syncAvailability() {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const isPublicHomepage =
        document.body.dataset.careplandPublicHomepage === "true";
      const receiverLayout = String(
        params.get("receiverLayout") || params.get("layout") || ""
      ).toLowerCase();
      const isReceiverModern =
        path.startsWith("/connect/receiver") &&
        (receiverLayout === "modern" || receiverLayout === "modern2");
      const inappropriate =
        isPublicHomepage ||
        hiddenExactPaths.includes(path) ||
        hiddenPathPrefixes.some((prefix) => path.startsWith(prefix)) ||
        (path.startsWith("/connect/receiver") && !isReceiverModern) ||
        path.includes("/api/") ||
        path.includes("/auth") ||
        params.has("print") ||
        params.has("screenshot");
      setAvailable(!inappropriate);
    }

    syncAvailability();
    window.addEventListener("popstate", syncAvailability);
    window.addEventListener(
      "carepland:visibility-context-change",
      syncAvailability
    );
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    window.history.pushState = function pushState(...args) {
      const result = originalPushState.apply(this, args);
      syncAvailability();
      return result;
    };
    window.history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      syncAvailability();
      return result;
    };

    return () => {
      window.removeEventListener("popstate", syncAvailability);
      window.removeEventListener(
        "carepland:visibility-context-change",
        syncAvailability
      );
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  useEffect(() => {
    if (stage !== "recording") return undefined;

    const interval = window.setInterval(() => {
      const nextElapsedMs = Date.now() - startedAtRef.current;
      setElapsedMs(nextElapsedMs);
      const secondsRemaining = Math.ceil((recordingLimitMs - nextElapsedMs) / 1000);
      if (secondsRemaining === 10) {
        setAnnouncement("Recording limit is almost reached.");
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    return () => {
      window.clearTimeout(autoStopTimerRef.current);
      controllerRef.current?.cancel();
    };
  }, []);

  const canRecord = useMemo(() => {
    return typeof window !== "undefined" && browserConnectAudioRecordingAvailable();
  }, []);

  if (!available) return null;

  function openPanel() {
    const nextSessionId = createReportSessionId();
    setSessionId(nextSessionId);
    setText("");
    setStatus("");
    setInterpretation(null);
    setReportReference("");
    setStage("review");
    setOpen(true);
    setAnnouncement("Something Went Wrong is open.");
    recordHelpDiagnosticsEvent("something_went_wrong_opened", {
      entryPoint: "something_went_wrong",
      reportCorrelationId: nextSessionId,
      ...currentProblemContext(),
    });
    setPendingPacket(window.CarePlandHelpDiagnostics?.createPacket() ?? null);
  }

  function closePanel() {
    if (stage === "recording") {
      cancelRecording();
    }
    setOpen(false);
    setStage("idle");
    setStatus("");
    setAnnouncement("Something Went Wrong is closed.");
  }

  async function startRecording() {
    if (!canRecord) {
      setStatus("Recording is not available here. You can type what happened.");
      setAnnouncement("Recording is not available. Text input is available.");
      return;
    }

    try {
      const controller = await startConnectAudioRecording();
      controllerRef.current = controller;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setStage("recording");
      setStatus("Recording.");
      setAnnouncement("Recording started. 60 seconds max.");
      recordHelpDiagnosticsEvent("something_went_wrong_recording_started", {
        entryPoint: "something_went_wrong",
        reportCorrelationId: sessionId,
      });
      autoStopTimerRef.current = window.setTimeout(() => {
        setAnnouncement("Recording limit reached. Transcription is starting.");
        void stopRecording("max_duration");
      }, recordingLimitMs);
    } catch (error) {
      setStatus(recordingErrorMessage(error));
      setAnnouncement("Recording could not start. Text input is available.");
      recordHelpDiagnosticsEvent("something_went_wrong_recording_failed", {
        entryPoint: "something_went_wrong",
        error: recordingErrorMessage(error),
        reportCorrelationId: sessionId,
      });
    }
  }

  function cancelRecording() {
    window.clearTimeout(autoStopTimerRef.current);
    controllerRef.current?.cancel();
    controllerRef.current = null;
    setStage("review");
    setElapsedMs(0);
    setStatus("Recording canceled.");
    setAnnouncement("Recording canceled.");
    recordHelpDiagnosticsEvent("something_went_wrong_recording_canceled", {
      entryPoint: "something_went_wrong",
      reportCorrelationId: sessionId,
    });
  }

  async function stopRecording(reason: "manual" | "max_duration" = "manual") {
    const controller = controllerRef.current;
    if (!controller) return;

    window.clearTimeout(autoStopTimerRef.current);
    controllerRef.current = null;
    setStage("transcribing");
    setStatus(reason === "max_duration" ? "60 seconds reached. Turning recording into text." : "Turning recording into text.");

    try {
      const recording = await controller.stop();
      if (!recording.size) {
        setStage("review");
        setStatus("Recording was empty. Type what happened or try again.");
        return;
      }

      const receiverContext = readReceiverBindingContext();
      if (!receiverContext.mainConnectUserPersonId) {
        setStage("review");
        setStatus("Recording was captured, but transcription needs a selected Receiver person. Please type what happened.");
        recordHelpDiagnosticsEvent("something_went_wrong_audio_captured_without_transcription", {
          durationMs: recording.durationMs,
          entryPoint: "something_went_wrong",
          reportCorrelationId: sessionId,
        });
        return;
      }

      const clientAudioCaptureId = createConnectAudioCaptureId("something-went-wrong");
      const transcription = await requestConnectAudioTranscription({
        artifactKind: "receiver_message",
        audioDirection: "receiver_to_coordinator",
        captureContext: createConnectAudioCaptureContext(recording, {
          artifactKind: "receiver_message",
          audioDirection: "receiver_to_coordinator",
          clientAudioCaptureId,
          role: receiverContext.receiverDeviceId ? "receiver_user" : "carepland_user",
          surface: "something_went_wrong",
        }),
        clientAudioCaptureId,
        durationMs: recording.durationMs,
        mainConnectUserPersonId: receiverContext.mainConnectUserPersonId,
        mimeType: recording.mimeType,
        receiverId: receiverContext.receiverDeviceId,
        recording: recording.blob,
        source: "something-went-wrong",
      });
      const transcript = String(transcription.transcript || "").trim();
      setText((current) => [current.trim(), transcript].filter(Boolean).join("\n"));
      setStage("review");
      setStatus(transcript ? "Review the transcription before submitting." : "Recording processed. Type any missing details.");
      setAnnouncement("Recording stopped. Review the transcription before submitting.");
      recordHelpDiagnosticsEvent("something_went_wrong_transcription_ready", {
        entryPoint: "something_went_wrong",
        reportCorrelationId: sessionId,
        transcriptStatus: String(transcription.transcriptStatus || ""),
      });
    } catch (error) {
      setStage("review");
      setStatus(`Transcription did not finish. Your typed text is still here. ${recordingErrorMessage(error)}`);
      setAnnouncement("Transcription failed. Text input is available.");
    }
  }

  function handleInterpret() {
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus("Type or record a short description first.");
      return;
    }

    const packet = window.CarePlandHelpDiagnostics?.createPacket() ?? pendingPacket;
    const derived = {
      hasFailedApiCalls: Boolean(
        packet?.apiCalls.some((call) => call.error || Number(call.status || 0) >= 400)
      ),
      hasFrontendErrors: Boolean(packet?.logs.some((log) => log.level === "error")),
    };
    const nextInterpretation = interpretSomethingWentWrong({
      currentRoute: window.location.pathname + window.location.search,
      inputText: trimmed,
      networkOnline: navigator.onLine,
      ...derived,
    });
    setInterpretation(nextInterpretation);
    setStage("result");
    setStatus("");
    recordHelpDiagnosticsEvent("something_went_wrong_interpreted", {
      decisionTrace: nextInterpretation.decisionTrace as unknown as Record<string, unknown>,
      entryPoint: "something_went_wrong",
      reportCorrelationId: sessionId,
    });
    setPendingPacket(window.CarePlandHelpDiagnostics?.createPacket() ?? packet ?? null);
  }

  async function sendReport() {
    if (submitting || !interpretation) return;
    setSubmitting(true);
    setStatus("");
    recordHelpDiagnosticsEvent("something_went_wrong_report_confirmed", {
      decisionTrace: interpretation.decisionTrace as unknown as Record<string, unknown>,
      entryPoint: "something_went_wrong",
      reportCorrelationId: sessionId,
      userDescriptionPresent: Boolean(text.trim()),
    });
    const packet = window.CarePlandHelpDiagnostics?.createPacket() ?? pendingPacket ?? undefined;

    try {
      const result = await submitHelpDiagnostics(
        {
          happenedInstead: text.trim(),
          tryingToDo: interpretation.decisionTrace.interpretedQuestion,
        },
        packet
      );
      setReportReference(result.referenceId);
      setStage("report_sent");
      setAnnouncement(`Report sent. Reference ${result.referenceId}.`);
    } catch (error) {
      setStatus(recordingErrorMessage(error));
      setAnnouncement("Report could not be sent. Your description is still here.");
    } finally {
      setSubmitting(false);
    }
  }

  const elapsedSeconds = Math.min(60, Math.floor(elapsedMs / 1000));
  const outcome = interpretation?.outcome;

  return (
    <div className="something-went-wrong-root" data-diagnostic-exclude="true">
      <button
        aria-expanded={open}
        className="something-went-wrong-button"
        onClick={openPanel}
        type="button"
      >
        Something Went Wrong
      </button>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      {open ? (
        <section
          aria-labelledby="something-went-wrong-title"
          aria-modal="false"
          className="something-went-wrong-panel"
          role="dialog"
        >
          <div className="something-went-wrong-header">
            <div>
              <h2 id="something-went-wrong-title">Something went wrong?</h2>
              <p>Tell CarePland what happened.</p>
            </div>
            <button className="something-went-wrong-ghost" onClick={closePanel} type="button">
              Close
            </button>
          </div>

          {stage === "recording" ? (
            <div className="something-went-wrong-recording">
              <p className="something-went-wrong-recording-state">Recording</p>
              <p className="something-went-wrong-time">
                {elapsedSeconds}s elapsed · 60 seconds max
              </p>
              <div className="something-went-wrong-actions">
                <button onClick={() => void stopRecording()} type="button">
                  Stop
                </button>
                <button className="something-went-wrong-secondary" onClick={cancelRecording} type="button">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {stage === "transcribing" ? (
                <div className="something-went-wrong-note">Turning recording into text...</div>
              ) : null}
              {stage === "report_sent" ? (
                <div className="something-went-wrong-success">
                  Report sent. Reference <strong>{reportReference}</strong>.
                </div>
              ) : null}
              {stage !== "report_sent" ? (
                <label className="something-went-wrong-label">
                  Description
                  <textarea
                    maxLength={1200}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Example: I clicked Send and it stayed spinning."
                    value={text}
                  />
                </label>
              ) : null}
              {outcome && stage === "result" ? (
                <ResultView
                  decisionTrace={interpretation.decisionTrace}
                  onNotNow={closePanel}
                  onSendReport={sendReport}
                  outcome={outcome}
                  submitting={submitting}
                />
              ) : null}
              {status ? <p className="something-went-wrong-status">{status}</p> : null}
              {stage !== "report_sent" ? (
                <div className="something-went-wrong-actions">
                  <button disabled={stage === "transcribing"} onClick={startRecording} type="button">
                    Record
                  </button>
                  <button disabled={stage === "transcribing"} onClick={handleInterpret} type="button">
                    Submit
                  </button>
                  <button className="something-went-wrong-secondary" onClick={closePanel} type="button">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="something-went-wrong-actions">
                  <button onClick={closePanel} type="button">
                    Done
                  </button>
                </div>
              )}
              {!canRecord ? (
                <p className="something-went-wrong-footnote">
                  Recording is not available in this browser. Text still works.
                </p>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function ResultView({
  decisionTrace,
  onNotNow,
  onSendReport,
  outcome,
  submitting,
}: {
  decisionTrace: SomethingWentWrongDecisionTrace;
  onNotNow: () => void;
  onSendReport: () => Promise<void>;
  outcome: NonNullable<SomethingWentWrongInterpretation["outcome"]>;
  submitting: boolean;
}) {
  return (
    <div className="something-went-wrong-result">
      <h3>{outcome.title}</h3>
      <p>{outcome.body}</p>
      <p className="something-went-wrong-trace">
        {decisionTrace.selectedInteractionFamily} · {Math.round(decisionTrace.confidence * 100)}%
      </p>
      <div className="something-went-wrong-actions">
        {"actionUrl" in outcome && outcome.actionUrl ? (
          <button
            onClick={() => {
              window.location.assign(outcome.actionUrl || "/");
            }}
            type="button"
          >
            {outcome.actionLabel || "Open"}
          </button>
        ) : null}
        {outcome.kind === "diagnostic_report" ||
        outcome.kind === "troubleshooting" ||
        outcome.kind === "clarify" ? (
          <button disabled={submitting} onClick={() => void onSendReport()} type="button">
            {submitting ? "Sending..." : "Send Report"}
          </button>
        ) : null}
        {outcome.kind === "diagnostic_report" ? (
          <button className="something-went-wrong-secondary" onClick={onNotNow} type="button">
            Not Now
          </button>
        ) : null}
      </div>
    </div>
  );
}

function currentProblemContext() {
  const receiverContext = readReceiverBindingContext();
  return {
    currentRoute: window.location.pathname + window.location.search,
    deviceClass: deviceClass(),
    networkOnline: navigator.onLine,
    receiverId: receiverContext.receiverDeviceId,
    receiverName: receiverContext.receiverName,
    receiverUserAssignment: receiverContext.mainConnectUserDisplayName,
    surface: surfaceFromPath(window.location.pathname),
  };
}

function readReceiverBindingContext() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem("carepland-connect-receiver-binding") || "{}"
    ) as Record<string, unknown>;
    return {
      mainConnectUserDisplayName: String(parsed.mainConnectUserDisplayName || ""),
      mainConnectUserPersonId: String(parsed.mainConnectUserPersonId || ""),
      receiverDeviceId: String(parsed.receiverDeviceId || ""),
      receiverName: String(parsed.locationLabel || parsed.receiverDeviceId || ""),
    };
  } catch {
    return {
      mainConnectUserDisplayName: "",
      mainConnectUserPersonId: "",
      receiverDeviceId: "",
      receiverName: "",
    };
  }
}

function surfaceFromPath(path: string) {
  if (path.startsWith("/connect/receiver")) return "Receiver";
  if (path.startsWith("/connect")) return "Messages";
  if (path.startsWith("/family")) return "Family";
  if (path.startsWith("/admin")) return "Admin";
  return "Personal";
}

function deviceClass() {
  if (typeof window === "undefined") return "unknown";
  if (window.innerWidth >= 1024) return "desktop";
  if (window.innerWidth >= 700) return "tablet";
  return "phone";
}

function createReportSessionId() {
  return `SWW-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
}

function recordingErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone permission was denied. You can type what happened.";
  }
  if (error instanceof Error) return error.message;
  return "CarePland could not finish that step.";
}
