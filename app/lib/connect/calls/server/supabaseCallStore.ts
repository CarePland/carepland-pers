import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConnectCallRecord } from "@/app/lib/connect/calls/callScoping";
import {
  assembleConnectCallTranscript,
  type ConnectCallTranscriptSegment,
} from "@/app/lib/connect/calls/transcriptChunking";
import { createSupabaseUserClient } from "@/app/lib/platform/server/supabase";

import type {
  ConnectCallSignal,
  ConnectCallSignalSender,
  ConnectCallSignalType,
} from "./localCallSignals";
import { isConnectCallState, type ConnectCallState } from "./localCalls";

type ConnectCallAccess = {
  accessToken: string;
  careCircleId: string;
  mainConnectUserPersonId: string;
};

type ConnectCallRow = {
  approved_summary_text?: string | null;
  connected_at?: string | null;
  ended_at?: string | null;
  id: string;
  main_connect_user_person_id: string;
  caller_display_name: string | null;
  receiver_display_name: string | null;
  state: string;
  summary_status?: string | null;
  transcript_deleted_at?: string | null;
  transcript_status?: string | null;
  transcript_text?: string | null;
  updated_at: string;
};

type ConnectCallSignalRow = {
  call_id: string;
  created_at: string;
  id: string;
  main_connect_user_person_id: string;
  payload: Record<string, unknown> | null;
  sender: ConnectCallSignalSender;
  signal_type: ConnectCallSignalType;
};

type ConnectCallTranscriptSegmentRow = {
  chunk_ended_ms: number;
  chunk_index: number;
  chunk_started_ms: number;
  overlap_started_ms: number;
  transcript_status: string;
  transcript_text: string;
};

type ConnectCallSummaryRow = {
  call_id: string;
  summary_text: string | null;
};

export async function readSupabaseConnectCalls(access: ConnectCallAccess) {
  return trySupabaseCallStore(async (supabase) => {
    const { data, error } = await supabase
      .from("connect_calls")
      .select(
        "id,main_connect_user_person_id,caller_display_name,receiver_display_name,state,summary_status,transcript_deleted_at,transcript_status,transcript_text,updated_at"
      )
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .order("updated_at", { ascending: false })
      .limit(300);

    if (error) throw error;
    const calls = ((data ?? []) as ConnectCallRow[]).map(connectCallRecordFromRow);
    const callIds = calls.map((call) => call.callId).filter((id): id is string => Boolean(id));

    if (callIds.length === 0) return calls;

    const { data: summaries } = await supabase
      .from("connect_call_summaries")
      .select("call_id,summary_text")
      .in("call_id", callIds)
      .in("summary_status", ["approved", "completed"])
      .order("created_at", { ascending: false });
    const summaryByCallId = new Map<string, string>();

    for (const row of (summaries ?? []) as ConnectCallSummaryRow[]) {
      if (!row.call_id || summaryByCallId.has(row.call_id)) continue;
      summaryByCallId.set(row.call_id, row.summary_text || "");
    }

    return calls.map((call) => ({
      ...call,
      summaryText: call.callId ? summaryByCallId.get(call.callId) || call.summaryText : call.summaryText,
    }));
  }, access);
}

export async function markStaleSupabaseConnectCallsMissed(
  access: ConnectCallAccess,
  options: { now?: Date; ringingTimeoutMs?: number } = {}
) {
  return trySupabaseCallStore(async (supabase) => {
    const now = options.now ?? new Date();
    const timeoutMs = options.ringingTimeoutMs ?? 45_000;
    const cutoff = new Date(now.getTime() - timeoutMs).toISOString();
    const { data: staleCalls, error: readError } = await supabase
      .from("connect_calls")
      .select("id")
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .eq("state", "ringing")
      .lte("updated_at", cutoff);

    if (readError) throw readError;

    const staleCallIds = ((staleCalls ?? []) as Array<{ id?: string }>)
      .map((call) => call.id)
      .filter((id): id is string => Boolean(id));

    if (staleCallIds.length === 0) return 0;

    const { error: updateError } = await supabase
      .from("connect_calls")
      .update({
        ended_at: now.toISOString(),
        state: "missed",
        updated_at: now.toISOString(),
      })
      .in("id", staleCallIds)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId);

    if (updateError) throw updateError;
    return staleCallIds.length;
  }, access);
}

export async function recordSupabaseConnectCall(
  input: Partial<ConnectCallRecord>,
  access: ConnectCallAccess
) {
  return trySupabaseCallStore(async (supabase) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("connect_calls")
      .insert({
        care_circle_id: access.careCircleId,
        caller_display_name: input.callerName || "Andrew",
        main_connect_user_person_id: access.mainConnectUserPersonId,
        receiver_display_name: input.recipientName || "",
        started_at: isConnectCallState(input.state) && input.state !== "ringing" ? now : null,
        state: isConnectCallState(input.state) ? input.state : "ringing",
        summary_status: input.summaryStatus || "not_requested",
        transcript_status: input.transcriptStatus || "not_started",
        transcript_text: input.transcriptText || "",
      })
      .select(
        "id,main_connect_user_person_id,caller_display_name,receiver_display_name,state,summary_status,transcript_deleted_at,transcript_status,transcript_text,updated_at"
      )
      .single();

    if (error) throw error;
    return connectCallRecordFromRow(data as ConnectCallRow);
  }, access);
}

export async function updateSupabaseConnectCallState(
  callId: string,
  state: string,
  access: ConnectCallAccess
) {
  if (!isConnectCallState(state)) return null;

  return trySupabaseCallStore(async (supabase) => {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      state,
      updated_at: now,
    };

    if (state === "answered") update.answered_at = now;
    if (state === "connected") update.connected_at = now;
    if (isTerminalCallState(state)) update.ended_at = now;

    const { data, error } = await supabase
      .from("connect_calls")
      .update(update)
      .eq("id", callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .select(
        "id,main_connect_user_person_id,caller_display_name,receiver_display_name,state,summary_status,transcript_deleted_at,transcript_status,transcript_text,updated_at"
      )
      .maybeSingle();

    if (error) throw error;
    return data ? connectCallRecordFromRow(data as ConnectCallRow) : null;
  }, access);
}

export async function recordSupabaseConnectCallEvent(
  input: {
    actorRole?: string;
    callId: string;
    details?: Record<string, unknown>;
    eventType: string;
  },
  access: ConnectCallAccess
) {
  return trySupabaseCallStore(async (supabase) => {
    const { error } = await supabase.from("connect_call_events").insert({
      actor_role: normalizeActorRole(input.actorRole),
      call_id: input.callId,
      care_circle_id: access.careCircleId,
      details: sanitizeSignalPayload(input.details),
      event_type: input.eventType,
      main_connect_user_person_id: access.mainConnectUserPersonId,
    });

    if (error) throw error;
    return true;
  }, access);
}

export async function approveSupabaseConnectCallSummary(
  callId: string,
  access: ConnectCallAccess,
  input: {
    approvedBy?: string;
    approvedSummaryText?: string;
  } = {}
) {
  return trySupabaseCallStore(async (supabase) => {
    const now = new Date().toISOString();
    const approvedSummaryText = input.approvedSummaryText?.trim() || "";
    if (approvedSummaryText) {
      const { error: summaryError } = await supabase.from("connect_call_summaries").insert({
        approved_at: now,
        approved_by_role: normalizeActorRole(input.approvedBy || "receiver"),
        call_id: callId,
        care_circle_id: access.careCircleId,
        generated_at: now,
        main_connect_user_person_id: access.mainConnectUserPersonId,
        model: "",
        prompt_version: "receiver_approved_edit",
        summary_policy: "care_record_only_when_uncertain_omit",
        summary_status: "approved",
        summary_text: approvedSummaryText,
        updated_at: now,
      });

      if (summaryError) throw summaryError;
    }

    const cleanupCall = await cleanupSupabaseApprovedCallTranscript(callId, access, now);
    return cleanupCall
      ? {
          ...cleanupCall,
          approvedSummaryText: approvedSummaryText || undefined,
          summaryText: approvedSummaryText || undefined,
        }
      : null;
  }, access);
}

export async function retrySupabaseApprovedCallTranscriptCleanup(
  callId: string,
  access: ConnectCallAccess
) {
  return trySupabaseCallStore(async () => {
    return cleanupSupabaseApprovedCallTranscript(callId, access, new Date().toISOString());
  }, access);
}

async function cleanupSupabaseApprovedCallTranscript(
  callId: string,
  access: ConnectCallAccess,
  now: string
) {
  const supabase = createSupabaseUserClient(access.accessToken);
    const { data, error } = await supabase
      .from("connect_calls")
      .update({
        transcript_deleted_at: now,
        transcript_status: "deleted",
        transcript_text: "",
        updated_at: now,
      })
      .eq("id", callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .select(
        "id,main_connect_user_person_id,caller_display_name,receiver_display_name,state,summary_status,transcript_deleted_at,transcript_status,transcript_text,updated_at"
      )
      .maybeSingle();

    if (error) throw error;
    const { error: transcriptSegmentDeleteError } = await supabase
      .from("connect_call_transcript_segments")
      .delete()
      .eq("call_id", callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId);
    return data
      ? {
          ...connectCallRecordFromRow(data as ConnectCallRow),
          transcriptCleanupStatus: transcriptSegmentDeleteError ? "pending" : "completed",
        }
      : null;
}

export async function recordSupabaseConnectCallTranscriptSegment(
  input: {
    audioDurationMs?: number;
    audioMimeType?: string;
    chunkEndedMs: number;
    chunkIndex: number;
    chunkStartedMs: number;
    callId: string;
    errorMessage?: string;
    overlapStartedMs: number;
    transcriptStatus: string;
    transcriptText: string;
  },
  access: ConnectCallAccess
) {
  return trySupabaseCallStore(async (supabase) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("connect_call_transcript_segments")
      .upsert(
        {
          audio_duration_ms: Number(input.audioDurationMs || 0),
          audio_mime_type: input.audioMimeType || "",
          call_id: input.callId,
          care_circle_id: access.careCircleId,
          chunk_ended_ms: input.chunkEndedMs,
          chunk_index: input.chunkIndex,
          chunk_started_ms: input.chunkStartedMs,
          error_message: input.errorMessage || "",
          main_connect_user_person_id: access.mainConnectUserPersonId,
          overlap_started_ms: input.overlapStartedMs,
          transcript_status: normalizeTranscriptSegmentStatus(input.transcriptStatus),
          transcript_text: input.transcriptText,
          updated_at: now,
        },
        { onConflict: "call_id,chunk_index" }
      );

    if (error) throw error;

    const { data: rows, error: readError } = await supabase
      .from("connect_call_transcript_segments")
      .select(
        "chunk_ended_ms,chunk_index,chunk_started_ms,overlap_started_ms,transcript_status,transcript_text"
      )
      .eq("call_id", input.callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .order("chunk_index", { ascending: true });

    if (readError) throw readError;

    const segments = ((rows ?? []) as ConnectCallTranscriptSegmentRow[]).map(
      transcriptSegmentFromRow
    );
    const transcriptText = assembleConnectCallTranscript(segments);
    const segmentStatus = normalizeTranscriptSegmentStatus(input.transcriptStatus);
    const transcriptStatus = transcriptText
      ? "capturing"
      : segmentStatus === "failed" || segmentStatus === "not_configured"
        ? "failed"
        : "not_started";

    const { data: updatedCall } = await supabase
      .from("connect_calls")
      .update({
        transcript_status: transcriptStatus,
        transcript_text: transcriptText,
        updated_at: now,
      })
      .eq("id", input.callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .select(
        "id,main_connect_user_person_id,caller_display_name,receiver_display_name,state,summary_status,transcript_deleted_at,transcript_status,transcript_text,updated_at"
      )
      .maybeSingle();

    return {
      assembledTranscriptText: transcriptText,
      call: updatedCall ? connectCallRecordFromRow(updatedCall as ConnectCallRow) : undefined,
      segment: transcriptSegmentFromRow({
        chunk_ended_ms: input.chunkEndedMs,
        chunk_index: input.chunkIndex,
        chunk_started_ms: input.chunkStartedMs,
        overlap_started_ms: input.overlapStartedMs,
        transcript_status: normalizeTranscriptSegmentStatus(input.transcriptStatus),
        transcript_text: input.transcriptText,
      }),
    };
  }, access);
}

export async function recordSupabaseConnectCallGeneratedSummary(
  callId: string,
  input: {
    model?: string;
    promptVersion?: string;
    summaryStatus: string;
    summaryText: string;
  },
  access: ConnectCallAccess
) {
  return trySupabaseCallStore(async (supabase) => {
    const now = new Date().toISOString();
    const summaryStatus = normalizeSummaryStatus(input.summaryStatus);
    const { error } = await supabase.from("connect_call_summaries").insert({
      call_id: callId,
      care_circle_id: access.careCircleId,
      generated_at: now,
      main_connect_user_person_id: access.mainConnectUserPersonId,
      model: input.model || process.env.OPENAI_CALL_SUMMARY_MODEL || "gpt-4.1-mini",
      prompt_version: input.promptVersion || "connect_call_care_summary:fallback",
      summary_status: summaryStatus,
      summary_text: input.summaryText,
    });

    if (error) throw error;

    const { data, error: updateError } = await supabase
      .from("connect_calls")
      .update({
        summary_status: summaryStatus,
        updated_at: now,
      })
      .eq("id", callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .select(
        "id,main_connect_user_person_id,caller_display_name,receiver_display_name,state,summary_status,transcript_deleted_at,transcript_status,transcript_text,updated_at"
      )
      .maybeSingle();

    if (updateError) throw updateError;
    return data ? connectCallRecordFromRow(data as ConnectCallRow) : null;
  }, access);
}

export async function readSupabaseConnectCallSignals(
  options: {
    afterSignalId?: string;
    callId: string;
    notSender?: string;
  },
  access: ConnectCallAccess
) {
  return trySupabaseCallStore(async (supabase) => {
    let query = supabase
      .from("connect_call_signals")
      .select("id,call_id,main_connect_user_person_id,sender,signal_type,payload,created_at")
      .eq("call_id", options.callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(200);

    if (options.notSender) {
      query = query.neq("sender", options.notSender);
    }

    const { data, error } = await query;
    if (error) throw error;

    const signals = ((data ?? []) as ConnectCallSignalRow[]).map(
      connectCallSignalFromRow
    );

    if (!options.afterSignalId) return signals;
    const afterIndex = signals.findIndex(
      (signal) => signal.signalId === options.afterSignalId
    );
    return afterIndex >= 0 ? signals.slice(afterIndex + 1) : signals;
  }, access);
}

export async function recordSupabaseConnectCallSignal(
  input: {
    callId: string;
    payload?: Record<string, unknown>;
    sender?: string;
    type?: string;
  },
  access: ConnectCallAccess
) {
  const sender = normalizeSignalSender(input.sender);
  const type = normalizeSignalType(input.type);
  if (!input.callId || !sender || !type) return null;

  return trySupabaseCallStore(async (supabase) => {
    const { data, error } = await supabase
      .from("connect_call_signals")
      .insert({
        call_id: input.callId,
        care_circle_id: access.careCircleId,
        main_connect_user_person_id: access.mainConnectUserPersonId,
        payload: sanitizeSignalPayload(input.payload),
        sender,
        signal_type: type,
      })
      .select("id,call_id,main_connect_user_person_id,sender,signal_type,payload,created_at")
      .single();

    if (error) throw error;
    return connectCallSignalFromRow(data as ConnectCallSignalRow);
  }, access);
}

async function trySupabaseCallStore<T>(
  callback: (supabase: SupabaseClient) => Promise<T>,
  access: ConnectCallAccess
): Promise<T | null> {
  try {
    return await callback(createSupabaseUserClient(access.accessToken));
  } catch {
    return null;
  }
}

function connectCallRecordFromRow(row: ConnectCallRow): ConnectCallRecord {
  return {
    callId: row.id,
    callerName: row.caller_display_name || "Andrew",
    mainConnectUserPersonId: row.main_connect_user_person_id,
    recipientName: row.receiver_display_name || "",
    recipientPersonId: row.main_connect_user_person_id,
    state: row.state,
    summaryStatus: row.summary_status || undefined,
    transcriptDeletedAt: row.transcript_deleted_at || undefined,
    transcriptStatus: row.transcript_status || undefined,
    transcriptText: row.transcript_text || undefined,
    updatedAt: row.updated_at,
  };
}

function connectCallSignalFromRow(row: ConnectCallSignalRow): ConnectCallSignal {
  return {
    callId: row.call_id,
    createdAt: row.created_at,
    mainConnectUserPersonId: row.main_connect_user_person_id,
    payload: row.payload || {},
    sender: row.sender,
    signalId: row.id,
    type: row.signal_type,
  };
}

function transcriptSegmentFromRow(
  row: ConnectCallTranscriptSegmentRow
): ConnectCallTranscriptSegment {
  return {
    chunkEndedMs: row.chunk_ended_ms,
    chunkIndex: row.chunk_index,
    chunkStartedMs: row.chunk_started_ms,
    overlapStartedMs: row.overlap_started_ms,
    transcriptStatus: row.transcript_status,
    transcriptText: row.transcript_text,
  };
}

function isTerminalCallState(state: ConnectCallState) {
  return ["declined", "failed", "hung_up", "missed", "receiver_unavailable"].includes(
    state
  );
}

function normalizeSignalSender(value: unknown): ConnectCallSignalSender | null {
  const sender = String(value || "");
  return ["dashboard", "receiver"].includes(sender)
    ? (sender as ConnectCallSignalSender)
    : null;
}

function normalizeSignalType(value: unknown): ConnectCallSignalType | null {
  const type = String(value || "");
  return ["answer", "ice_candidate", "media_state", "offer"].includes(type)
    ? (type as ConnectCallSignalType)
    : null;
}

function normalizeActorRole(value: unknown) {
  const actorRole = String(value || "");
  return ["dashboard", "receiver", "system"].includes(actorRole) ? actorRole : "";
}

function normalizeTranscriptSegmentStatus(value: unknown) {
  const status = String(value || "");
  return ["completed", "failed", "not_configured", "pending"].includes(status)
    ? status
    : "failed";
}

function normalizeSummaryStatus(value: unknown) {
  const status = String(value || "");
  return ["approved", "completed", "failed", "not_needed", "pending"].includes(status)
    ? status
    : "failed";
}

function sanitizeSignalPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}
