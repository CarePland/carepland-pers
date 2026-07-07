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
  accessToken?: string;
  careCircleId: string;
  mainConnectUserPersonId: string;
  supabase?: SupabaseClient;
};

type ConnectCallRow = {
  approved_summary_text?: string | null;
  connected_at?: string | null;
  ended_at?: string | null;
  generated_summary_text?: string | null;
  id: string;
  main_connect_user_person_id: string;
  caller_display_name: string | null;
  receiver_device_id?: string | null;
  receiver_display_name: string | null;
  summary_approval_draft_text?: string | null;
  summary_approval_draft_updated_at?: string | null;
  summary_approval_draft_updated_by?: string | null;
  summary_approved_at?: string | null;
  summary_approved_by?: string | null;
  summary_review_note?: string | null;
  summary_review_status?: string | null;
  state: string;
  summary_status?: string | null;
  transcript_cleanup_status?: string | null;
  transcript_deleted_at?: string | null;
  transcript_expires_at?: string | null;
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

const connectCallSelectColumns =
  "id,main_connect_user_person_id,caller_display_name,receiver_device_id,receiver_display_name,state,summary_status,summary_review_status,summary_review_note,generated_summary_text,approved_summary_text,summary_approved_at,summary_approved_by,summary_approval_draft_text,summary_approval_draft_updated_at,summary_approval_draft_updated_by,transcript_cleanup_status,transcript_deleted_at,transcript_expires_at,transcript_status,transcript_text,updated_at";
const connectCallCoreSelectColumns =
  "id,main_connect_user_person_id,caller_display_name,receiver_device_id,receiver_display_name,state,summary_status,transcript_status,transcript_text,updated_at";
const connectCallLegacyCoreSelectColumns =
  "id,main_connect_user_person_id,caller_display_name,receiver_display_name,state,summary_status,transcript_status,transcript_text,updated_at";
const defaultTranscriptRetentionMs = 7 * 24 * 60 * 60 * 1000;
const expiredUnreviewedNote =
  "Transcript expired before formal approval. Generated summary retained as unapproved.";

export async function readSupabaseConnectCalls(access: ConnectCallAccess) {
  return trySupabaseCallStore(async (supabase) => {
    const richResult = await supabase
      .from("connect_calls")
      .select(connectCallSelectColumns)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .order("updated_at", { ascending: false })
      .limit(300);
    let data: unknown = richResult.data;
    let error = richResult.error;

    if (error && supabaseConnectCallOptionalColumnsUnavailable(error)) {
      const fallback = await supabase
        .from("connect_calls")
        .select(connectCallCoreSelectColumns)
        .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
        .order("updated_at", { ascending: false })
        .limit(300);
      data = fallback.data;
      error = fallback.error;
      if (error && supabaseConnectCallReceiverDeviceColumnUnavailable(error)) {
        const legacyFallback = await supabase
          .from("connect_calls")
          .select(connectCallLegacyCoreSelectColumns)
          .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
          .order("updated_at", { ascending: false })
          .limit(300);
        data = legacyFallback.data;
        error = legacyFallback.error;
      }
    }

    if (error) throw error;
    const calls = ((data ?? []) as ConnectCallRow[]).map(connectCallRecordFromRow);
    const callIds = calls.map((call) => call.callId).filter((id): id is string => Boolean(id));

    if (callIds.length === 0) return calls;

    const { data: summaries } = await supabase
      .from("connect_call_summaries")
      .select("call_id,summary_text")
      .in("call_id", callIds)
      .in("summary_status", ["approved", "completed", "pending_review", "expired_unreviewed"])
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
        receiver_device_id: input.receiverId || null,
        receiver_display_name: input.recipientName || "",
        started_at: isConnectCallState(input.state) && input.state !== "ringing" ? now : null,
        state: isConnectCallState(input.state) ? input.state : "ringing",
        summary_status: input.summaryStatus || "not_requested",
        transcript_status: input.transcriptStatus || "not_started",
        transcript_text: input.transcriptText || "",
      })
      .select(connectCallCoreSelectColumns)
      .single();

    if (error && supabaseConnectCallReceiverDeviceColumnUnavailable(error)) {
      const fallback = await supabase
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
        .select(connectCallLegacyCoreSelectColumns)
        .single();
      if (fallback.error) throw fallback.error;
      return connectCallRecordFromRow(fallback.data as ConnectCallRow);
    }

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
      .select(connectCallCoreSelectColumns)
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
    const { data: existingCall, error: readError } = await supabase
      .from("connect_calls")
      .select(connectCallSelectColumns)
      .eq("id", callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .maybeSingle();
    if (readError) throw readError;
    const existing = existingCall as ConnectCallRow | null;
    const approvedSummaryText =
      input.approvedSummaryText?.trim() ||
      existing?.summary_approval_draft_text?.trim() ||
      existing?.generated_summary_text ||
      "";
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

    const cleanupCall = await cleanupSupabaseApprovedCallTranscript(
      callId,
      access,
      now,
      approvedSummaryText
    );
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
  now: string,
  approvedSummaryText?: string
) {
  const supabase = access.supabase ?? createSupabaseUserClient(access.accessToken ?? "");
    const { data, error } = await supabase
      .from("connect_calls")
      .update({
        approved_summary_text: approvedSummaryText,
        summary_approved_at: now,
        summary_approved_by: access.mainConnectUserPersonId,
        summary_review_status: "approved",
        summary_status: "approved",
        transcript_cleanup_status: "completed",
        transcript_deleted_at: now,
        transcript_status: "deleted",
        transcript_text: "",
        updated_at: now,
      })
      .eq("id", callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .select(connectCallSelectColumns)
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
      .select(connectCallSelectColumns)
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
        generated_summary_text: input.summaryText,
        summary_approval_draft_text: input.summaryText,
        summary_approval_draft_updated_at: now,
        summary_approval_draft_updated_by: "system",
        summary_review_status: summaryStatus === "pending_review" ? "pending_review" : summaryStatus,
        summary_status: summaryStatus,
        transcript_expires_at: new Date(Date.parse(now) + defaultTranscriptRetentionMs).toISOString(),
        updated_at: now,
      })
      .eq("id", callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .select(connectCallSelectColumns)
      .maybeSingle();

    if (updateError) throw updateError;
    return data ? connectCallRecordFromRow(data as ConnectCallRow) : null;
  }, access);
}

export async function saveSupabaseConnectCallSummaryDraft(
  callId: string,
  access: ConnectCallAccess,
  input: {
    draftText: string;
    updatedBy?: string;
  }
) {
  return trySupabaseCallStore(async (supabase) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("connect_calls")
      .update({
        summary_approval_draft_text: input.draftText,
        summary_approval_draft_updated_at: now,
        summary_approval_draft_updated_by: normalizeActorRole(input.updatedBy || "receiver"),
        updated_at: now,
      })
      .eq("id", callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .select(connectCallSelectColumns)
      .maybeSingle();

    if (error) throw error;
    return data ? connectCallRecordFromRow(data as ConnectCallRow) : null;
  }, access);
}

export async function cleanupExpiredSupabaseConnectCallTranscripts(
  access: ConnectCallAccess,
  options: { now?: Date } = {}
) {
  return trySupabaseCallStore(async (supabase) => {
    const now = options.now ?? new Date();
    const nowIso = now.toISOString();
    const { data: expiredRows, error: readError } = await supabase
      .from("connect_calls")
      .select("id")
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .neq("summary_status", "approved")
      .lte("transcript_expires_at", nowIso)
      .neq("transcript_status", "deleted");
    if (readError) throw readError;

    const callIds = ((expiredRows ?? []) as Array<{ id?: string }>)
      .map((row) => row.id)
      .filter((id): id is string => Boolean(id));
    if (callIds.length === 0) return 0;

    const { error: updateError } = await supabase
      .from("connect_calls")
      .update({
        summary_review_note: expiredUnreviewedNote,
        summary_review_status: "expired_unreviewed",
        summary_status: "expired_unreviewed",
        transcript_cleanup_status: "completed",
        transcript_deleted_at: nowIso,
        transcript_status: "deleted",
        transcript_text: "",
        updated_at: nowIso,
      })
      .in("id", callIds)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId);
    if (updateError) throw updateError;

    const { error: segmentError } = await supabase
      .from("connect_call_transcript_segments")
      .delete()
      .in("call_id", callIds)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId);

    if (segmentError) {
      await supabase
        .from("connect_calls")
        .update({ transcript_cleanup_status: "pending", updated_at: nowIso })
        .in("id", callIds)
        .eq("main_connect_user_person_id", access.mainConnectUserPersonId);
    }

    return callIds.length;
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
    const query = supabase
      .from("connect_call_signals")
      .select("id,call_id,main_connect_user_person_id,sender,signal_type,payload,created_at")
      .eq("call_id", options.callId)
      .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(200);

    const { data, error } = await query;
    if (error) throw error;

    let signals = ((data ?? []) as ConnectCallSignalRow[]).map(
      connectCallSignalFromRow
    );

    if (options.afterSignalId) {
      const afterIndex = signals.findIndex(
        (signal) => signal.signalId === options.afterSignalId
      );
      signals = afterIndex >= 0 ? signals.slice(afterIndex + 1) : signals;
    }

    return signals.filter(
      (signal) => !options.notSender || signal.sender !== options.notSender
    );
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
    return await callback(access.supabase ?? createSupabaseUserClient(access.accessToken ?? ""));
  } catch {
    return null;
  }
}

function connectCallRecordFromRow(row: ConnectCallRow): ConnectCallRecord {
  return {
    callId: row.id,
    callerName: row.caller_display_name || "Andrew",
    approvedSummaryText: row.approved_summary_text || undefined,
    generatedSummaryText: row.generated_summary_text || undefined,
    mainConnectUserPersonId: row.main_connect_user_person_id,
    recipientName: row.receiver_display_name || "",
    recipientPersonId: row.main_connect_user_person_id,
    receiverId: row.receiver_device_id || undefined,
    state: row.state,
    modelSummaryText: row.generated_summary_text || undefined,
    summaryApprovalDraftText: row.summary_approval_draft_text || undefined,
    summaryApprovalDraftUpdatedAt: row.summary_approval_draft_updated_at || undefined,
    summaryApprovalDraftUpdatedBy: row.summary_approval_draft_updated_by || undefined,
    summaryApprovedAt: row.summary_approved_at || undefined,
    summaryApprovedBy: row.summary_approved_by || undefined,
    summaryReviewNote: row.summary_review_note || undefined,
    summaryReviewStatus: row.summary_review_status || undefined,
    summaryStatus: row.summary_status || undefined,
    summaryText:
      row.summary_status === "approved"
        ? row.approved_summary_text || row.generated_summary_text || undefined
        : row.generated_summary_text || undefined,
    transcriptCleanupStatus:
      row.transcript_cleanup_status === "pending" ? "pending" : row.transcript_cleanup_status === "completed" ? "completed" : undefined,
    transcriptDeletedAt: row.transcript_deleted_at || undefined,
    transcriptExpiresAt: row.transcript_expires_at || undefined,
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

function supabaseConnectCallOptionalColumnsUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message || "";
  return (
    maybeError.code === "42703" ||
    maybeError.code === "PGRST204" ||
    [
      "approved_summary_text",
      "generated_summary_text",
      "summary_approval_draft_text",
      "summary_approval_draft_updated_at",
      "summary_approval_draft_updated_by",
      "summary_approved_at",
      "summary_approved_by",
      "summary_review_note",
      "summary_review_status",
      "transcript_cleanup_status",
      "transcript_deleted_at",
      "transcript_expires_at",
      "receiver_device_id",
    ].some((column) => message.includes(column))
  );
}

function supabaseConnectCallReceiverDeviceColumnUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message || "";
  return (
    maybeError.code === "42703" ||
    maybeError.code === "PGRST204" ||
    message.includes("receiver_device_id")
  );
}

function normalizeSummaryStatus(value: unknown) {
  const status = String(value || "");
  if (status === "completed" || status === "pending") return "pending_review";
  if (status === "failed") return "summary_failed";
  return [
    "approved",
    "cleanup_pending",
    "expired_unreviewed",
    "not_needed",
    "pending_review",
    "summary_failed",
  ].includes(status)
    ? status
    : "summary_failed";
}

function sanitizeSignalPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}
