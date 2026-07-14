import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ConnectPersonAccessDeniedError,
} from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  readConnectPersonScopedAccess,
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import {
  talkResultShouldWrite,
  type TalkAppointment,
  type TalkContact,
  type TalkFocusItem,
} from "@/app/lib/personal/track/talkIntent";
import {
  createObservation,
  type ObservationModality,
} from "@/app/lib/platform/ai/observationPipeline";
import {
  interpretReceiverTalkObservation,
  serializeReceiverTalkResult,
} from "@/app/lib/platform/ai/receiverTalkInterpreter";
import {
  type FocusCompletionType,
  focusCompletionTypes,
} from "@/app/lib/personal/track";

type FocusItemRow = {
  care_circle_id: string;
  care_subject_id: string;
  completion_config?: Record<string, unknown> | null;
  completion_event_type?: string | null;
  completion_type: string;
  id: string;
  prompt_text?: string | null;
  title: string;
};

type AppointmentRow = {
  id: string;
  provider_name?: string | null;
  provider_organization?: string | null;
  reason?: string | null;
  starts_at: string;
  title: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const personId = stringValue(body.personId);
    const inputText = stringValue(body.inputText);
    const receiverDeviceId = stringValue(body.receiverDeviceId) || null;
    const shouldCreateRecords = body.createRecords !== false;

    if (!personId || !inputText) {
      return NextResponse.json(
        {
          error: "Talk interpretation requires a person and something to interpret.",
          ok: false,
        },
        { status: 400 }
      );
    }

    const access = await readConnectPersonScopedAccess(request, personId, { body });
    const { careCircleId } = access;
    const supabase = access.supabase;
    const now = new Date();
    const [focusItems, appointments] = await Promise.all([
      loadTalkFocusItems(supabase, personId, now),
      loadUpcomingAppointments(supabase, personId, now),
    ]);
    const observation = createObservation({
      activeWorkflow: "ask_tell",
      deviceId: receiverDeviceId,
      metadata: {
        receiverInstallId: stringValue(body.receiverInstallId) || undefined,
        source: stringValue(body.source) || "receiver_talk",
      },
      modality: observationModalityFromBody(body.modality),
      personId,
      source: "receiver",
      surface: stringValue(body.surface) || "receiver_talk",
      text: inputText,
    });
    const { result } = interpretReceiverTalkObservation({
      appointments,
      careCircleId,
      contacts: contactsFromBody(body.contacts),
      focusItems,
      now,
      observation,
      receiverDeviceId,
    });

    if (!shouldCreateRecords || !talkResultShouldWrite(result)) {
      return NextResponse.json({
        ok: true,
        result: serializeReceiverTalkResult(result),
      });
    }

    const eventDraft = result.trackEventDraft;
    if (!eventDraft) {
      return NextResponse.json({
        ok: true,
        result: serializeReceiverTalkResult(result),
      });
    }

    const { data: eventRow, error: eventError } = await supabase
      .from("track_events")
      .insert({
        care_circle_id: eventDraft.careCircleId,
        care_subject_id: eventDraft.careSubjectId,
        confidence: eventDraft.confidence ?? result.confidence,
        created_by_user_id: access.createdByUserId,
        event_type: eventDraft.eventType,
        focus_item_id: eventDraft.focusItemId ?? null,
        needs_review: eventDraft.needsReview ?? false,
        note: eventDraft.note ?? null,
        occurred_at: eventDraft.occurredAt,
        source: eventDraft.source,
        structured_payload: eventDraft.structuredPayload ?? {},
        title: eventDraft.title,
        unit: eventDraft.unit ?? null,
        value: eventDraft.value ?? null,
      })
      .select("id,event_type,focus_item_id,title,occurred_at,value,unit,source")
      .single();

    if (eventError) {
      if (isTrackStorageUnavailable(eventError)) {
        return NextResponse.json(
          {
            error: "Talk Track storage is not available yet.",
            ok: false,
            result: serializeReceiverTalkResult(result),
          },
          { status: 503 }
        );
      }

      throw eventError;
    }

    return NextResponse.json({
      ok: true,
      result: {
        ...serializeReceiverTalkResult(result),
        completed_focus_item_id:
          result.completedFocusItemId || String(eventRow?.focus_item_id || "") || undefined,
        created_track_event_id: String(eventRow?.id || ""),
      },
      trackEvent: eventRow,
    });
  } catch (error) {
    if (error instanceof ConnectPersonAccessDeniedError) {
      return NextResponse.json(
        {
          error: "Choose a Main Connect User from your CarePland collection.",
          ok: false,
        },
        { status: 403 }
      );
    }
    if (error instanceof ReceiverDeviceAccessError) {
      return NextResponse.json(receiverDeviceSetupRequiredBody(error), {
        status: error.status,
      });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to interpret Talk input.",
        ok: false,
      },
      { status: 500 }
    );
  }
}

async function loadTalkFocusItems(
  supabase: SupabaseClient,
  personId: string,
  now: Date
): Promise<TalkFocusItem[]> {
  const today = now.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("focus_items")
    .select(
      [
        "id",
        "care_circle_id",
        "care_subject_id",
        "title",
        "prompt_text",
        "completion_type",
        "completion_event_type",
        "completion_config",
      ].join(",")
    )
    .eq("care_subject_id", personId)
    .eq("status", "active")
    .or(`active_start_date.is.null,active_start_date.lte.${today}`)
    .or(`active_end_date.is.null,active_end_date.gte.${today}`)
    .order("importance_score", { ascending: false })
    .order("sort_order", { ascending: true })
    .limit(25);

  if (error) {
    if (isTrackStorageUnavailable(error)) {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as unknown as FocusItemRow[]).map((row) => ({
    careCircleId: row.care_circle_id,
    careSubjectId: row.care_subject_id,
    completionConfig: normalizeCompletionConfig(row.completion_config),
    completionEventType: row.completion_event_type ?? null,
    completionType: focusCompletionType(row.completion_type),
    id: row.id,
    promptText: row.prompt_text ?? null,
    title: row.title,
  }));
}

async function loadUpcomingAppointments(
  supabase: SupabaseClient,
  personId: string,
  now: Date
): Promise<TalkAppointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id,title,reason,starts_at,provider_name,provider_organization,deleted_at,status")
    .eq("care_subject_id", personId)
    .is("deleted_at", null)
    .neq("status", "archived")
    .gte("starts_at", now.toISOString())
    .order("starts_at", { ascending: true })
    .limit(5);

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as AppointmentRow[]).map((row) => ({
    id: row.id,
    providerName: row.provider_name ?? null,
    providerOrganization: row.provider_organization ?? null,
    reason: row.reason ?? null,
    startsAt: row.starts_at,
    title: row.title || row.reason || "Appointment",
  }));
}

function contactsFromBody(value: unknown): TalkContact[] {
  if (!Array.isArray(value)) {
    return [{ displayName: "Care coordinator", id: "primary-coordinator" }];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = stringValue(record.id);
      const displayName = stringValue(record.displayName);
      return id && displayName ? { displayName, id } : null;
    })
    .filter((item): item is TalkContact => Boolean(item));
}

function focusCompletionType(value: string): FocusCompletionType {
  return focusCompletionTypes.includes(value as FocusCompletionType)
    ? (value as FocusCompletionType)
    : "simple_done";
}

function normalizeCompletionConfig(value: Record<string, unknown> | null | undefined) {
  return {
    unit: stringValue(value?.unit) || null,
    unitOptions: Array.isArray(value?.unitOptions)
      ? value.unitOptions.map(stringValue).filter(Boolean)
      : [],
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function observationModalityFromBody(value: unknown): ObservationModality {
  const modality = stringValue(value);
  return [
    "document",
    "example",
    "message",
    "ocr",
    "speech",
    "structured",
    "typed",
  ].includes(modality)
    ? (modality as ObservationModality)
    : "speech";
}

function isTrackStorageUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";

  return (
    maybeError.code === "42P01" ||
    maybeError.code === "42703" ||
    maybeError.code === "PGRST205" ||
    message.includes("focus_items") ||
    message.includes("track_events")
  );
}
