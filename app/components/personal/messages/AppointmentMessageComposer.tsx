"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import {
  blobToBase64,
  browserConnectAudioRecordingAvailable,
  createConnectAudioCaptureContext,
  createConnectAudioCaptureId,
  requestConnectAudioTranscription,
  startConnectAudioRecording,
  type ConnectAudioRecording,
  type ConnectAudioRecordingController,
} from "../../../lib/connect/audio";
import { connectAuthHeaders } from "../../../lib/connect/context/client";
import { connectPrototypeReceiverId } from "../../../lib/connect/prototypeClient";
import { MicrophoneIcon } from "../../shared/icons";

type PendingMessageRecording = {
  artifactId: string;
  audioUrl: string;
  clientAudioCaptureId: string;
  recording: ConnectAudioRecording;
  transcript: string;
  transcriptStatus: string;
};

export type AppointmentMessageComposerDraft = {
  allowsCallbackRequest?: boolean;
  appointmentId: string;
  hasRecording?: boolean;
  requiresAcknowledgement?: boolean;
  text: string;
};

type AppointmentMessageComposerProps = {
  appointmentId?: string;
  initialDraft?: AppointmentMessageComposerDraft | null;
  onCancel?: () => void;
  onDraftChange?: (draft: AppointmentMessageComposerDraft | null) => void;
  onSent?: () => void | Promise<void>;
  personId: string;
  recipientName?: string;
};

const connectMessagesEndpoint = "/api/connect/messages";

export function AppointmentMessageComposer({
  appointmentId,
  initialDraft,
  onCancel,
  onDraftChange,
  onSent,
  personId,
  recipientName = "Receiver",
}: AppointmentMessageComposerProps) {
  const [messageText, setMessageText] = useState(initialDraft?.text ?? "");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processingRecording, setProcessingRecording] = useState(false);
  const [pendingRecording, setPendingRecording] =
    useState<PendingMessageRecording | null>(null);
  const [status, setStatus] = useState("");
  const recordingControllerRef = useRef<ConnectAudioRecordingController | null>(null);
  const activeCaptureIdRef = useRef("");
  const clientMessageCounterRef = useRef(0);
  const messageContextId = appointmentId || "general";
  const composerSurface = appointmentId
    ? "appointment_message_composer"
    : "message_history_composer";
  const messageSourcePrefix = appointmentId ? "appointment" : "message_history";

  useEffect(() => {
    return () => {
      recordingControllerRef.current?.cancel();
      if (pendingRecording?.recording.localUrl) {
        URL.revokeObjectURL(pendingRecording.recording.localUrl);
      }
    };
  }, [pendingRecording]);

  const canSend = Boolean(personId && (messageText.trim() || pendingRecording));
  const hasDraft = Boolean(messageText.trim() || pendingRecording);

  useEffect(() => {
    if (!hasDraft) {
      onDraftChange?.(null);
      return;
    }

    onDraftChange?.({
      allowsCallbackRequest: false,
      appointmentId: appointmentId ?? "",
      hasRecording: Boolean(pendingRecording),
      requiresAcknowledgement: false,
      text: messageText,
    });
  }, [
    appointmentId,
    hasDraft,
    messageText,
    onDraftChange,
    pendingRecording,
  ]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = messageText.trim();
    if (!canSend || sending || recording || processingRecording) return;

    setSending(true);
    setStatus(pendingRecording ? "Sending audio message..." : "Sending message...");

    try {
      clientMessageCounterRef.current += 1;
      const clientMessageSequence = clientMessageCounterRef.current;
      const clientMessageId = pendingRecording
        ? `${messageSourcePrefix}-audio-${messageContextId}-${clientMessageSequence}`
        : `${messageSourcePrefix}-text-${messageContextId}-${clientMessageSequence}`;
      const messagePayload = pendingRecording
        ? {
            allowsCallbackRequest: false,
            appointmentId,
            artifactKind: "coordinator_message",
            audioArtifactId: pendingRecording.artifactId,
            audioBase64: await blobToBase64(pendingRecording.recording.blob),
            audioDirection: "coordinator_to_receiver",
            audioDurationMs: pendingRecording.recording.durationMs,
            audioMimeType: pendingRecording.recording.mimeType,
            audioUrl: pendingRecording.audioUrl,
            body: body || pendingRecording.transcript || "Voice message",
            captureContext: createConnectAudioCaptureContext(
              pendingRecording.recording,
              {
                artifactKind: "coordinator_message",
                audioDirection: "coordinator_to_receiver",
                clientAudioCaptureId: pendingRecording.clientAudioCaptureId,
                role: "Andrew",
                surface: composerSurface,
              }
            ),
            clientAudioCaptureId: pendingRecording.clientAudioCaptureId,
            clientMessageId,
            from: "Andrew",
            mainConnectUserPersonId: personId,
            messageType: "audio",
            requiresAcknowledgement: false,
            source: `${messageSourcePrefix}_audio_message`,
            to: recipientName,
          }
        : {
            allowsCallbackRequest: false,
            appointmentId,
            body,
            clientMessageId,
            from: "Andrew",
            mainConnectUserPersonId: personId,
            messageType: "text",
            requiresAcknowledgement: false,
            source: `${messageSourcePrefix}_text_message`,
            to: recipientName,
          };

      const response = await fetch(connectMessagesEndpoint, {
        body: JSON.stringify(messagePayload),
        headers: {
          ...(await connectAuthHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "Unable to send message.");
      }

      if (pendingRecording?.recording.localUrl) {
        URL.revokeObjectURL(pendingRecording.recording.localUrl);
      }
      setMessageText("");
      setPendingRecording(null);
      onDraftChange?.(null);
      setStatus(pendingRecording ? "Audio message sent." : "Message sent.");
      await onSent?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      await stopMessageRecording();
      return;
    }

    if (!browserConnectAudioRecordingAvailable()) {
      setStatus("Recording is not available in this browser.");
      return;
    }

    if (!personId) {
      setStatus("Choose a message-enabled Care VIP first.");
      return;
    }

    if (
      hasDraft &&
      !window.confirm("Starting a recording will replace this message draft. Continue?")
    ) {
      return;
    }

    try {
      const captureId = createConnectAudioCaptureId(`${messageSourcePrefix}-message-draft`);
      activeCaptureIdRef.current = captureId;
      clearPendingRecording();
      setProcessingRecording(false);
      setRecording(true);
      setMessageText("");
      setStatus("Recording. Press Stop when done.");
      recordingControllerRef.current = await startConnectAudioRecording({
        maxDurationMs: 30000,
        onAutoStop: (reason) => {
          void stopMessageRecording(reason);
        },
        silenceGraceMs: 1200,
        silenceThreshold: 0.018,
        stopAfterSilenceMs: 2600,
      });
    } catch {
      activeCaptureIdRef.current = "";
      recordingControllerRef.current = null;
      setRecording(false);
      setStatus("Recording could not start. Microphone permission may be blocked.");
    }
  }

  async function stopMessageRecording(reason?: "max_duration" | "silence") {
    const controller = recordingControllerRef.current;
    if (!controller) {
      setRecording(false);
      return;
    }

    recordingControllerRef.current = null;
    setRecording(false);
    setProcessingRecording(true);
    setStatus(
      reason === "max_duration"
        ? "Recording stopped at the time limit. Transcribing now..."
        : "Transcribing recording..."
    );

    try {
      const recordingResult = await controller.stop();
      if (!recordingResult.size) {
        setStatus("No audio captured. Try recording again.");
        return;
      }

      let transcript = "";
      let transcriptStatus = "not_requested";
      let artifactId = "";
      let audioUrl = "";
      const clientAudioCaptureId =
        activeCaptureIdRef.current ||
        createConnectAudioCaptureId(`${messageSourcePrefix}-message-draft`);

      try {
        const transcription = await requestConnectAudioTranscription({
          artifactKind: "coordinator_message",
          audioDirection: "coordinator_to_receiver",
          captureContext: createConnectAudioCaptureContext(recordingResult, {
            artifactKind: "coordinator_message",
            audioDirection: "coordinator_to_receiver",
            clientAudioCaptureId,
            role: "Andrew",
            surface: composerSurface,
          }),
          clientAudioCaptureId,
          durationMs: recordingResult.durationMs,
          mainConnectUserPersonId: personId,
          mimeType: recordingResult.mimeType,
          receiverId: connectPrototypeReceiverId,
          recording: recordingResult.blob,
          source: `${messageSourcePrefix}_message_draft`,
        });
        const artifact = transcription.artifact;
        artifactId = String(artifact?.artifactId || artifact?.id || "");
        transcript = String(transcription.transcript || "").trim();
        transcriptStatus = String(transcription.transcriptStatus || "not_requested");
        audioUrl = String(artifact?.audioUrl || transcription.audioUrl || "");
      } catch {
        transcriptStatus = "not_configured";
      }

      setPendingRecording({
        artifactId,
        audioUrl,
        clientAudioCaptureId,
        recording: recordingResult,
        transcript,
        transcriptStatus,
      });
      setMessageText(transcript || "Recorded voice message");
      setStatus(
        transcript
          ? "Recording transcribed. Original audio and transcript will be sent."
          : "Recording ready. Original audio will be sent."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Recording could not be processed.");
    } finally {
      activeCaptureIdRef.current = "";
      setProcessingRecording(false);
    }
  }

  function clearPendingRecording() {
    if (pendingRecording?.recording.localUrl) {
      URL.revokeObjectURL(pendingRecording.recording.localUrl);
    }
    setPendingRecording(null);
  }

  function clearComposer() {
    if (hasDraft && !window.confirm("Clear this message draft?")) {
      return;
    }

    recordingControllerRef.current?.cancel();
    recordingControllerRef.current = null;
    setRecording(false);
    setProcessingRecording(false);
    setMessageText("");
    clearPendingRecording();
    setStatus("Message cleared.");
  }

  function cancelComposer() {
    if (
      hasDraft &&
      !window.confirm("Close this message draft? Your typed text will be kept.")
    ) {
      return;
    }

    recordingControllerRef.current?.cancel();
    recordingControllerRef.current = null;
    setRecording(false);
    setProcessingRecording(false);
    onCancel?.();
  }

  return (
    <form
      className="grid gap-3 px-1 py-2"
      onSubmit={sendMessage}
    >
      <textarea
        className="min-h-28 min-w-0 resize-y rounded-lg border border-[#b6cfe8] bg-white px-4 py-4 text-base leading-relaxed shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        onChange={(event) => setMessageText(event.target.value)}
        placeholder="Type a message, or record one"
        value={messageText}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold shadow-sm ${
              recording
                ? "border-[#111111] bg-[#111111] text-white"
                : "border-[#d6e3f2] bg-white text-[#0f172a] hover:bg-[#f8fafc]"
            }`}
            disabled={processingRecording || sending}
            onClick={() => void toggleRecording()}
            type="button"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#ef3f43] text-white">
              <MicrophoneIcon className="h-4 w-4" />
            </span>
            {recording ? "Stop" : processingRecording ? "Transcribing" : "Record"}
          </button>
          <button
            className={`min-h-10 rounded-md px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-80 ${
              canSend
                ? "bg-[#244d73] hover:bg-[#173150]"
                : "bg-[#9fb2c6] hover:bg-[#345d83]"
            }`}
            disabled={!canSend || sending || recording || processingRecording}
            type="submit"
          >
            {sending
              ? "Sending"
              : pendingRecording
                ? "Send Audio Message"
                : "Send Message"}
          </button>
          <button
            className="min-h-10 rounded-md border border-[#d6e3f2] bg-white px-5 text-sm font-semibold text-[#0f172a] shadow-sm hover:bg-[#f8fafc]"
            onClick={clearComposer}
            type="button"
          >
            Clear
          </button>
          <button
            className="min-h-10 rounded-md px-3 text-sm font-medium text-[#767676] transition hover:bg-blue-50 hover:text-slate-700"
            onClick={cancelComposer}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
      {pendingRecording ? (
        <div className="rounded-md border border-[#d6e3f2] bg-white p-3 text-sm text-[#334155]">
          <strong className="block text-[#172f49]">Recording ready</strong>
          <span className="mt-1 block">
            {pendingRecording.transcriptStatus === "completed"
              ? "Transcript is ready."
              : "Transcript is not available yet."}{" "}
            Duration {Math.max(1, Math.round(pendingRecording.recording.durationMs / 1000))}s.
          </span>
          {pendingRecording.recording.localUrl ? (
            <audio className="mt-2 w-full" controls src={pendingRecording.recording.localUrl}>
              <track kind="captions" />
            </audio>
          ) : null}
        </div>
      ) : null}
      {status ? (
        <p aria-live="polite" className="text-sm font-semibold text-[#5f6e84]">
          {status}
        </p>
      ) : null}
    </form>
  );
}
