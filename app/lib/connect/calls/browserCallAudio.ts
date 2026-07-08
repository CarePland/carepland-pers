import type {
  ConnectCallSignal,
  ConnectCallSignalSender,
} from "./server/localCallSignals";
import {
  blobToBase64,
  preferredConnectAudioMimeType,
} from "../audio/browserRecording";
import {
  connectCallTranscriptChunkStepMs,
  connectCallTranscriptChunkWindowMs,
} from "./transcriptChunking";
import { recordConnectCallLifecycleEvent } from "./browserCallDiagnostics";

type ConnectCallAudioRole = ConnectCallSignalSender;
export type ConnectCallAudioStatus =
  | "connected"
  | "connecting"
  | "ended"
  | "idle"
  | "interrupted"
  | "microphone_ready"
  | "remote_audio"
  | "starting";

export type ConnectCallAudioController = {
  isMuted: () => boolean;
  setMuted: (muted: boolean) => void;
  start: () => Promise<void>;
  stop: () => void;
};

type ConnectCallAudioOptions = {
  callId: string;
  connectAuthHeaders: () => Promise<Record<string, string>>;
  mainConnectUserPersonId: string;
  onConnected?: () => void;
  onError?: (message: string) => void;
  onPeerEnded?: () => void;
  onRemoteMutedChange?: (muted: boolean) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onStatusChange?: (status: ConnectCallAudioStatus) => void;
  onTranscriptChunk?: (
    status: "completed" | "failed" | "not_configured" | "started",
    detail?: string
  ) => void;
  role: ConnectCallAudioRole;
  transcriptChunks?: boolean;
};

const defaultIceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const connectionTimeoutMs = 25000;

export function createConnectCallAudioController(
  options: ConnectCallAudioOptions
): ConnectCallAudioController {
  let peerConnection: RTCPeerConnection | null = null;
  let localStream: MediaStream | null = null;
  let remoteAudio: HTMLAudioElement | null = null;
  let pollTimer: number | null = null;
  let connectionTimer: number | null = null;
  let transcriptChunkTimer: number | null = null;
  let transcriptChunkIndex = 0;
  let transcriptStartedAtMs = 0;
  let transcriptCapture: TranscriptChunkCapture | null = null;
  let lastSignalId = "";
  let muted = false;
  let stopped = false;
  let pollInFlight = false;
  const pendingCandidates: RTCIceCandidateInit[] = [];
  const processedSignalIds = new Set<string>();

  function logLifecycle(eventType: string, details: Record<string, unknown> = {}) {
    recordConnectCallLifecycleEvent({
      actorRole: options.role,
      callId: options.callId,
      connectAuthHeaders: options.connectAuthHeaders,
      details: {
        ...details,
        role: options.role,
        stopped,
      },
      eventType,
      mainConnectUserPersonId: options.mainConnectUserPersonId,
    });
  }

  function signalUrl() {
    return `/api/connect/calls/${encodeURIComponent(options.callId)}/signals`;
  }

  async function postSignal(type: ConnectCallSignal["type"], payload: Record<string, unknown>) {
    logLifecycle("call_signal_send_started", {
      mediaState: type === "media_state" ? String(payload.state || "") : "",
      signalType: type,
    });
    const response = await fetch(signalUrl(), {
      body: JSON.stringify({
        mainConnectUserPersonId: options.mainConnectUserPersonId,
        payload,
        sender: options.role,
        type,
      }),
      headers: {
        ...(await options.connectAuthHeaders()),
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `Call signal failed with ${response.status}.`);
    }
    logLifecycle("call_signal_send_completed", {
      mediaState: type === "media_state" ? String(payload.state || "") : "",
      signalType: type,
    });
  }

  function setAudioStatus(status: ConnectCallAudioStatus) {
    if (["connected", "ended", "interrupted", "remote_audio"].includes(status)) {
      clearConnectionTimer();
    }
    logLifecycle("call_audio_status_changed", { status });
    options.onStatusChange?.(status);
  }

  function clearConnectionTimer() {
    if (connectionTimer === null) return;
    window.clearTimeout(connectionTimer);
    connectionTimer = null;
    logLifecycle("call_connection_timer_cleared");
  }

  function startConnectionTimer() {
    clearConnectionTimer();
    logLifecycle("call_connection_timer_started", { timeoutMs: connectionTimeoutMs });
    connectionTimer = window.setTimeout(() => {
      if (stopped) return;
      logLifecycle("call_connection_timer_fired", { timeoutMs: connectionTimeoutMs });
      setAudioStatus("interrupted");
      options.onError?.("Call audio did not connect. Hang up and try again.");
    }, connectionTimeoutMs);
  }

  async function fetchSignals() {
    const url = new URL(signalUrl(), window.location.origin);
    url.searchParams.set("personId", options.mainConnectUserPersonId);
    url.searchParams.set("notSender", options.role);
    if (lastSignalId) url.searchParams.set("after", lastSignalId);

    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: await options.connectAuthHeaders(),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `Call signal poll failed with ${response.status}.`);
    }
    const payload = (await response.json().catch(() => ({}))) as {
      signals?: ConnectCallSignal[];
    };

    return Array.isArray(payload.signals) ? payload.signals : [];
  }

  async function ensurePeerConnection() {
    if (stopped) throw new Error("Call audio has already stopped.");
    if (peerConnection) return peerConnection;

    logLifecycle("call_peer_connection_creating");
    const connection = new RTCPeerConnection({ iceServers: configuredIceServers() });
    peerConnection = connection;
    logLifecycle("call_peer_connection_created", {
      iceConnectionState: connection.iceConnectionState,
      iceGatheringState: connection.iceGatheringState,
      signalingState: connection.signalingState,
    });
    logLifecycle("call_get_user_media_started");
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
    if (stopped) {
      for (const track of localStream.getTracks()) track.stop();
      localStream = null;
      connection.close();
      peerConnection = null;
      throw new Error("Call audio stopped before microphone setup completed.");
    }
    logLifecycle("call_get_user_media_completed", {
      audioTrackCount: localStream.getAudioTracks().length,
    });

    for (const track of localStream.getTracks()) {
      track.enabled = !muted;
      connection.addTrack(track, localStream);
      attachTrackDiagnostics(track, "local");
      logLifecycle("call_local_track_added", {
        enabled: track.enabled,
        kind: track.kind,
        muted: track.muted,
        readyState: track.readyState,
      });
    }
    setAudioStatus("microphone_ready");

    connection.onicecandidate = (event) => {
      if (!event.candidate) return;
      logLifecycle("call_ice_candidate_created", {
        candidateType: event.candidate.type || "",
        protocol: event.candidate.protocol || "",
        sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
        sdpMid: event.candidate.sdpMid || "",
      });
      void postSignal("ice_candidate", candidatePayload(event.candidate)).catch(
        () => logLifecycle("call_ice_candidate_send_failed")
      );
    };
    connection.onconnectionstatechange = () => {
      logLifecycle("call_peer_connection_state_changed", {
        connectionState: connection.connectionState,
        iceConnectionState: connection.iceConnectionState,
        signalingState: connection.signalingState,
      });
      if (["connected", "completed"].includes(connection.connectionState)) {
        setAudioStatus("connected");
        options.onConnected?.();
      }
      if (["failed", "disconnected"].includes(connection.connectionState)) {
        setAudioStatus("interrupted");
        options.onError?.("Call audio connection was interrupted.");
      }
    };
    connection.oniceconnectionstatechange = () => {
      logLifecycle("call_ice_connection_state_changed", {
        connectionState: connection.connectionState,
        iceConnectionState: connection.iceConnectionState,
        signalingState: connection.signalingState,
      });
    };
    connection.onicegatheringstatechange = () => {
      logLifecycle("call_ice_gathering_state_changed", {
        iceGatheringState: connection.iceGatheringState,
      });
    };
    connection.onsignalingstatechange = () => {
      logLifecycle("call_signaling_state_changed", {
        signalingState: connection.signalingState,
      });
    };
    connection.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      for (const track of stream.getTracks()) {
        attachTrackDiagnostics(track, "remote");
      }
      logLifecycle("call_remote_track_received", {
        audioTrackCount: stream.getAudioTracks().length,
        streamTrackCount: stream.getTracks().length,
      });
      options.onRemoteStream?.(stream);
      setAudioStatus("remote_audio");
      playRemoteStream(stream);
      startTranscriptChunking(stream);
    };

    return connection;
  }

  async function applyRemoteCandidate(payload: Record<string, unknown>) {
    const connection = await ensurePeerConnection();
    const candidate = payload as RTCIceCandidateInit;
    if (!connection.remoteDescription) {
      pendingCandidates.push(candidate);
      logLifecycle("call_remote_candidate_queued", {
        pendingCandidateCount: pendingCandidates.length,
      });
      return;
    }
    await connection.addIceCandidate(candidate);
    logLifecycle("call_remote_candidate_applied", {
      pendingCandidateCount: pendingCandidates.length,
    });
  }

  async function flushPendingCandidates() {
    const connection = await ensurePeerConnection();
    if (!connection.remoteDescription) return;
    while (pendingCandidates.length) {
      const candidate = pendingCandidates.shift();
      if (candidate) await connection.addIceCandidate(candidate);
      logLifecycle("call_remote_candidate_flushed", {
        pendingCandidateCount: pendingCandidates.length,
      });
    }
  }

  async function handleSignal(signal: ConnectCallSignal) {
    if (stopped) return;
    if (processedSignalIds.has(signal.signalId)) {
      logLifecycle("call_signal_duplicate_ignored", {
        signalId: signal.signalId,
        signalType: signal.type,
      });
      return;
    }
    processedSignalIds.add(signal.signalId);
    lastSignalId = signal.signalId;
    logLifecycle("call_signal_received", {
      sender: signal.sender,
      signalType: signal.type,
    });
    if (signal.type === "media_state") {
      handleMediaState(signal.payload);
      return;
    }

    const connection = await ensurePeerConnection();
    if (stopped) return;

    if (signal.type === "offer" && options.role === "receiver") {
      await connection.setRemoteDescription(sessionDescriptionPayload(signal.payload));
      if (stopped) return;
      logLifecycle("call_remote_description_set", { signalType: "offer" });
      await flushPendingCandidates();
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      if (stopped) return;
      logLifecycle("call_local_description_set", { signalType: "answer" });
      await postSignal("answer", sessionDescriptionPayload(answer));
      return;
    }

    if (signal.type === "answer" && options.role === "dashboard") {
      await connection.setRemoteDescription(sessionDescriptionPayload(signal.payload));
      if (stopped) return;
      logLifecycle("call_remote_description_set", { signalType: "answer" });
      await flushPendingCandidates();
      return;
    }

    if (signal.type === "ice_candidate") {
      await applyRemoteCandidate(signal.payload);
    }
  }

  function handleMediaState(payload: Record<string, unknown>) {
    const state = String(payload.state || "");
    logLifecycle("call_media_state_received", { state });
    if (state === "ended") {
      options.onPeerEnded?.();
      finish(false);
    }
    if (state === "muted") {
      options.onRemoteMutedChange?.(true);
    }
    if (state === "unmuted") {
      options.onRemoteMutedChange?.(false);
    }
  }

  async function pollSignals() {
    if (stopped) return;
    if (pollInFlight) {
      logLifecycle("call_signal_poll_skipped_in_flight");
      return;
    }
    pollInFlight = true;
    try {
      const signals = await fetchSignals();
      if (stopped) return;
      if (signals.length > 0) {
        logLifecycle("call_signal_poll_received", { signalCount: signals.length });
      }
      for (const signal of signals) {
        if (stopped) break;
        await handleSignal(signal);
      }
    } catch {
      logLifecycle("call_signal_poll_failed");
      // Polling should keep retrying while the call is active.
    } finally {
      pollInFlight = false;
    }
  }

  function startPolling() {
    if (pollTimer !== null) return;
    logLifecycle("call_signal_poll_started", { intervalMs: 900 });
    pollTimer = window.setInterval(() => {
      void pollSignals();
    }, 900);
    void pollSignals();
  }

  async function startCaller() {
    logLifecycle("call_caller_starting");
    const connection = await ensurePeerConnection();
    const offer = await connection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await connection.setLocalDescription(offer);
    logLifecycle("call_local_description_set", { signalType: "offer" });
    await postSignal("offer", sessionDescriptionPayload(offer));
    setAudioStatus("connecting");
    startConnectionTimer();
    startPolling();
  }

  async function startReceiver() {
    logLifecycle("call_receiver_starting");
    await ensurePeerConnection();
    setAudioStatus("connecting");
    startConnectionTimer();
    startPolling();
  }

  function playRemoteStream(stream: MediaStream) {
    if (typeof Audio === "undefined") return;
    if (!remoteAudio) {
      remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute("playsinline", "true");
    }
    remoteAudio.srcObject = stream;
    void remoteAudio
      .play()
      .then(() => logLifecycle("call_remote_audio_play_started"))
      .catch(() => logLifecycle("call_remote_audio_play_failed"));
  }

  return {
    isMuted() {
      return muted;
    },
    setMuted(nextMuted: boolean) {
      muted = nextMuted;
      for (const track of localStream?.getAudioTracks() ?? []) {
        track.enabled = !muted;
      }
      logLifecycle("call_local_mute_changed", { muted });
      if (peerConnection || localStream) {
        void postSignal("media_state", {
          state: muted ? "muted" : "unmuted",
        }).catch(() => undefined);
      }
    },
    async start() {
      if (typeof window === "undefined") return;
      logLifecycle("call_audio_start_called", {
        secureContext: window.isSecureContext,
        transcriptChunks: Boolean(options.transcriptChunks),
      });
      if (!window.isSecureContext) {
        logLifecycle("call_audio_start_blocked_insecure_context");
        options.onError?.(
          "Live call audio needs HTTPS or localhost. Call state can connect, but this browser is blocking microphone audio."
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
        logLifecycle("call_audio_start_blocked_unsupported_browser");
        options.onError?.("This browser cannot start live call audio.");
        return;
      }
      stopped = false;
      setAudioStatus("starting");
      try {
        if (options.role === "dashboard") await startCaller();
        else await startReceiver();
      } catch (error) {
        logLifecycle("call_audio_start_failed", {
          message: error instanceof Error ? error.message : "Unable to start live call audio.",
        });
        setAudioStatus("interrupted");
        options.onError?.(
          error instanceof Error ? error.message : "Unable to start live call audio."
        );
      }
    },
    stop() {
      logLifecycle("call_audio_stop_called");
      finish(true);
    },
  };

  function finish(notifyPeer: boolean) {
    if (stopped) return;
    logLifecycle("call_audio_finish_started", { notifyPeer });
    if (notifyPeer) {
      void postSignal("media_state", { state: "ended" }).catch(() => undefined);
    }
    stopped = true;
    clearConnectionTimer();
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
      logLifecycle("call_signal_poll_stopped");
    }
    peerConnection?.close();
    logLifecycle("call_peer_connection_closed");
    peerConnection = null;
    for (const track of localStream?.getTracks() ?? []) {
      logLifecycle("call_local_track_stop_requested", {
        kind: track.kind,
        readyState: track.readyState,
      });
      track.stop();
    }
    localStream = null;
    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
      remoteAudio = null;
    }
    pendingCandidates.length = 0;
    stopTranscriptChunking();
    setAudioStatus("ended");
    logLifecycle("call_audio_finish_completed", { notifyPeer });
  }

  function startTranscriptChunking(remoteStream: MediaStream) {
    if (!options.transcriptChunks || transcriptCapture || !localStream) return;
    if (typeof MediaRecorder === "undefined") return;

    transcriptCapture = createTranscriptChunkCapture(localStream, remoteStream);
    if (!transcriptCapture) return;

    transcriptStartedAtMs = Date.now();
    transcriptChunkIndex = 0;
    logLifecycle("call_transcript_chunking_started", {
      stepMs: connectCallTranscriptChunkStepMs,
      windowMs: connectCallTranscriptChunkWindowMs,
    });
    options.onTranscriptChunk?.("started");
    recordTranscriptWindow();
    transcriptChunkTimer = window.setInterval(() => {
      recordTranscriptWindow();
    }, connectCallTranscriptChunkStepMs);
  }

  function stopTranscriptChunking() {
    if (transcriptChunkTimer !== null) {
      window.clearInterval(transcriptChunkTimer);
      transcriptChunkTimer = null;
      logLifecycle("call_transcript_chunk_timer_stopped");
    }
    transcriptCapture?.stop();
    transcriptCapture = null;
    logLifecycle("call_transcript_chunking_stopped");
  }

  function recordTranscriptWindow() {
    const capture = transcriptCapture;
    if (!capture || stopped) return;

    const chunkIndex = transcriptChunkIndex;
    const chunkStartedMs = Math.max(0, Date.now() - transcriptStartedAtMs);
    transcriptChunkIndex += 1;
    logLifecycle("call_transcript_window_started", {
      chunkIndex,
      chunkStartedMs,
      windowMs: connectCallTranscriptChunkWindowMs,
    });

    void capture.recordWindow(connectCallTranscriptChunkWindowMs).then((recording) => {
      if (!recording) return;
      logLifecycle("call_transcript_window_recorded", {
        chunkIndex,
        durationMs: recording.durationMs,
        recordedAfterStop: stopped,
        size: recording.blob.size,
      });
      void uploadTranscriptChunk({
        blob: recording.blob,
        chunkIndex,
        chunkStartedMs,
        durationMs: recording.durationMs,
        mimeType: recording.mimeType,
      });
    });
  }

  async function uploadTranscriptChunk(input: {
    blob: Blob;
    chunkIndex: number;
    chunkStartedMs: number;
    durationMs: number;
    mimeType: string;
  }) {
    try {
      logLifecycle("call_transcript_chunk_upload_started", {
        chunkIndex: input.chunkIndex,
        durationMs: input.durationMs,
        uploadAfterStop: stopped,
      });
      const response = await fetch(
        `/api/connect/calls/${encodeURIComponent(options.callId)}/transcript-chunks`,
        {
          body: JSON.stringify({
            audioBase64: await blobToBase64(input.blob),
            audioDurationMs: input.durationMs,
            audioMimeType: input.mimeType,
            chunkEndedMs: input.chunkStartedMs + input.durationMs,
            chunkIndex: input.chunkIndex,
            chunkStartedMs: input.chunkStartedMs,
            mainConnectUserPersonId: options.mainConnectUserPersonId,
            source: `${options.role}_live_call_chunk`,
          }),
          headers: {
            ...(await options.connectAuthHeaders()),
            "Content-Type": "application/json",
          },
          method: "POST",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        assembledTranscriptText?: string;
        error?: string;
        segment?: { chunkIndex?: number };
        transcriptStatus?: string;
      };
      if (!response.ok) {
        logLifecycle("call_transcript_chunk_upload_failed", {
          chunkIndex: input.chunkIndex,
          status: response.status,
        });
        options.onTranscriptChunk?.("failed", payload.error || "Chunk upload failed.");
        return;
      }
      if (payload.transcriptStatus === "not_configured") {
        logLifecycle("call_transcript_chunk_not_configured", {
          chunkIndex: input.chunkIndex,
        });
        options.onTranscriptChunk?.("not_configured");
        return;
      }
      if (payload.transcriptStatus === "failed") {
        logLifecycle("call_transcript_chunk_transcription_failed", {
          chunkIndex: input.chunkIndex,
        });
        options.onTranscriptChunk?.("failed", "Transcription failed for this chunk.");
        return;
      }
      logLifecycle("call_transcript_chunk_upload_completed", {
        assembledTranscriptLength: String(payload.assembledTranscriptText || "").length,
        chunkIndex: input.chunkIndex,
        transcriptStatus: payload.transcriptStatus || "",
      });
      options.onTranscriptChunk?.(
        "completed",
        `chunk:${input.chunkIndex};assembled:${String(payload.assembledTranscriptText || "").length}`
      );
    } catch {
      logLifecycle("call_transcript_chunk_upload_unreachable", {
        chunkIndex: input.chunkIndex,
      });
      options.onTranscriptChunk?.("failed", "Chunk upload could not reach the server.");
    }
  }

  function attachTrackDiagnostics(track: MediaStreamTrack, direction: "local" | "remote") {
    track.addEventListener("ended", () => {
      logLifecycle("call_media_track_ended", {
        direction,
        kind: track.kind,
        muted: track.muted,
        readyState: track.readyState,
      });
    });
    track.addEventListener("mute", () => {
      logLifecycle("call_media_track_muted", {
        direction,
        kind: track.kind,
        readyState: track.readyState,
      });
    });
    track.addEventListener("unmute", () => {
      logLifecycle("call_media_track_unmuted", {
        direction,
        kind: track.kind,
        readyState: track.readyState,
      });
    });
  }
}

type TranscriptChunkCapture = {
  recordWindow: (durationMs: number) => Promise<{
    blob: Blob;
    durationMs: number;
    mimeType: string;
  } | null>;
  stop: () => void;
};

function createTranscriptChunkCapture(
  localStream: MediaStream,
  remoteStream: MediaStream
): TranscriptChunkCapture | null {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  const audioContext = new AudioContextConstructor();
  const destination = audioContext.createMediaStreamDestination();
  const activeRecorders = new Set<MediaRecorder>();
  const nodes: MediaStreamAudioSourceNode[] = [];

  for (const stream of [localStream, remoteStream]) {
    if (stream.getAudioTracks().length === 0) continue;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(destination);
    nodes.push(source);
  }

  if (destination.stream.getAudioTracks().length === 0) {
    void audioContext.close();
    return null;
  }

  return {
    recordWindow(durationMs: number) {
      return recordTranscriptWindowAudio(destination.stream, durationMs, activeRecorders);
    },
    stop() {
      for (const recorder of activeRecorders) {
        if (recorder.state === "recording") {
          try {
            recorder.stop();
          } catch {
            activeRecorders.delete(recorder);
          }
        }
      }
      nodes.forEach((node) => node.disconnect());
      void audioContext.close();
    },
  };
}

function recordTranscriptWindowAudio(
  stream: MediaStream,
  durationMs: number,
  activeRecorders: Set<MediaRecorder>
) {
  return new Promise<{
    blob: Blob;
    durationMs: number;
    mimeType: string;
  } | null>((resolve) => {
    try {
      const mimeType = preferredConnectAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      const startedAtMs = Date.now();
      let resolved = false;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        if (resolved) return;
        resolved = true;
        activeRecorders.delete(recorder);
        const blob = new Blob(chunks, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        resolve(
          blob.size
            ? {
                blob,
                durationMs: Math.max(0, Date.now() - startedAtMs),
                mimeType: blob.type || recorder.mimeType || mimeType || "audio/webm",
              }
            : null
        );
      });

      activeRecorders.add(recorder);
      recorder.start();
      window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, durationMs);
    } catch {
      resolve(null);
    }
  });
}

function configuredIceServers() {
  const jsonServers = parseIceServersJson(
    process.env.NEXT_PUBLIC_CONNECT_ICE_SERVERS_JSON
  );
  if (jsonServers.length > 0) return jsonServers;

  const stunUrls = splitIceUrls(process.env.NEXT_PUBLIC_CONNECT_STUN_URLS);
  const turnUrls = splitIceUrls(process.env.NEXT_PUBLIC_CONNECT_TURN_URLS);
  const turnUsername = process.env.NEXT_PUBLIC_CONNECT_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_CONNECT_TURN_CREDENTIAL;
  const servers: RTCIceServer[] = [];

  servers.push({ urls: stunUrls.length > 0 ? stunUrls : defaultIceServers[0].urls });
  if (turnUrls.length > 0) {
    servers.push({
      credential: turnCredential,
      urls: turnUrls,
      username: turnUsername,
    });
  }

  return servers;
}

function parseIceServersJson(value: string | undefined) {
  if (!value?.trim()) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isIceServer);
  } catch {
    return [];
  }
}

function isIceServer(value: unknown): value is RTCIceServer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const urls = (value as { urls?: unknown }).urls;
  if (typeof urls === "string") return Boolean(urls.trim());
  if (Array.isArray(urls)) {
    return urls.some((url) => typeof url === "string" && Boolean(url.trim()));
  }
  return false;
}

function splitIceUrls(value: string | undefined) {
  return String(value || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

function candidatePayload(candidate: RTCIceCandidate) {
  return JSON.parse(JSON.stringify(candidate.toJSON())) as Record<string, unknown>;
}

function sessionDescriptionPayload(
  description: RTCSessionDescriptionInit | Record<string, unknown>
) {
  const type = String(description.type || "");
  const sdp = String(description.sdp || "");
  return { sdp, type } as RTCSessionDescriptionInit & Record<string, unknown>;
}
