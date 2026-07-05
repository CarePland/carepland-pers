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
import { appContentDefaults } from "@/app/lib/platform/content/appContentConfig";
import {
  buildReceiverTodayFocusCompletionEvent,
  normalizeReceiverTodayFocusRows,
  type ReceiverTodayFocusRow,
} from "@/app/lib/personal/track/receiverTodayFocus";
import {
  focusCadenceSuppressionForRows,
  focusCadenceTargetFromMetadata,
  type FocusCadencePreferenceRow,
} from "@/app/lib/personal/track/focusCadencePreferences";
import { todayFocusCompletionWindow } from "@/app/lib/personal/track/todayFocusDay";
import {
  createSupabaseServiceClient,
} from "@/app/lib/platform/server/supabase";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const personId = requestUrl.searchParams.get("personId")?.trim();

    if (!personId) {
      return NextResponse.json(
        {
          error: "Select a Main Connect User before loading Today’s Focus.",
          focusItems: [],
          ok: false,
        },
        { status: 400 }
      );
    }

    const access = await readConnectPersonScopedAccess(request, personId);
    const supabase = access.supabase;
    const timeZone = access.createdByUserId
      ? await loadUserTimeZone(supabase, access.createdByUserId)
      : null;
    const completionWindow = todayFocusCompletionWindow(new Date(), timeZone);
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("focus_items")
      .select(
        [
          "id",
          "care_circle_id",
          "care_subject_id",
          "title",
          "focus_type",
          "prompt_text",
          "recurrence_rule",
          "schedule",
          "active_start_date",
          "active_end_date",
          "completion_type",
          "completion_event_type",
          "completion_prompt_text",
          "completion_config",
          "importance_score",
          "metadata",
          "status",
          "sort_order",
          "created_at",
        ].join(",")
      )
      .eq("care_subject_id", personId)
      .eq("status", "active")
      .or(`active_start_date.is.null,active_start_date.lte.${today}`)
      .or(`active_end_date.is.null,active_end_date.gte.${today}`)
      .order("importance_score", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      if (isTrackStorageUnavailable(error)) {
        return NextResponse.json(
          {
            error: "Today’s Focus storage is not available yet.",
            focusItems: [],
            ok: false,
          },
          { status: 503 }
        );
      }

      throw error;
    }

    const { completedFocusItemIds, skippedFocusItemIds } =
      await loadTodayFocusTrackContext(
        supabase,
        personId,
        completionWindow.startUtc,
        completionWindow.endUtc
      );

    const preferences = await loadTodayFocusCadencePreferences(
      supabase,
      personId
    );
    const receiverConfig = await loadReceiverTodayFocusConfig(supabase);
    const preferenceFilteredRows = (data ?? []).filter((row) => {
      const focusRow = row as unknown as ReceiverTodayFocusRow;
      const target = focusCadenceTargetFromMetadata({
        focusItemId: focusRow.id,
        metadata: focusRow.metadata ?? null,
      });

      return !focusCadenceSuppressionForRows(
        preferences,
        target,
        new Date()
      );
    });

    return NextResponse.json({
      focusItems: normalizeReceiverTodayFocusRows(
        preferenceFilteredRows as unknown as ReceiverTodayFocusRow[],
        new Date(),
        {
          completedFocusItemIds,
          skippedFocusItemIds,
        }
      ),
      mainConnectUserPersonId: personId,
      ok: true,
      receiverConfig,
    });
  } catch (error) {
    return focusRouteError(error, "Unable to load Today’s Focus.");
  }
}

async function loadTodayFocusCadencePreferences(
  supabase: SupabaseClient,
  personId: string
) {
  const { data, error } = await supabase
    .from("focus_cadence_preferences")
    .select(
      "focus_item_id,recommendation_id,target_type,target_key,preference_action,cadence,snoozed_until,evidence_signature"
    )
    .eq("care_subject_id", personId)
    .limit(200);

  if (error) {
    if (isFocusCadencePreferenceUnavailable(error)) {
      return [];
    }

    throw error;
  }

  return (data ?? []) as FocusCadencePreferenceRow[];
}

async function loadReceiverTodayFocusConfig(
  supabase: SupabaseClient
) {
  const fallbackUndoSeconds = receiverUndoSecondsFromText(
    appContentDefaults.connect_receiver_undo_seconds
  );
  const { data, error } = await supabase
    .from("app_content_versions")
    .select("body")
    .eq("content_key", "connect_receiver_undo_seconds")
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    return { undoWindowMs: fallbackUndoSeconds * 1000 };
  }

  return {
    undoWindowMs:
      receiverUndoSecondsFromText(
        typeof data?.body === "string" ? data.body : null,
        fallbackUndoSeconds
      ) * 1000,
  };
}

function receiverUndoSecondsFromText(
  value: string | null | undefined,
  fallback = 10
) {
  const seconds = Number.parseFloat(String(value ?? "").trim());

  if (!Number.isFinite(seconds)) {
    return fallback;
  }

  return Math.min(30, Math.max(3, seconds));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const personId = stringValue(body.personId);
    const focusItemId = stringValue(body.focusItemId);

    if (!personId || !focusItemId) {
      return NextResponse.json(
        {
          error: "Today’s Focus completion requires a person and focus item.",
          ok: false,
        },
        { status: 400 }
      );
    }

    const access = await readConnectPersonScopedAccess(request, personId, { body });
    const supabase = access.supabase;

    const { data: focusItemRow, error: focusItemError } = await supabase
      .from("focus_items")
      .select(
        [
          "id",
          "care_circle_id",
          "care_subject_id",
          "title",
          "focus_type",
          "prompt_text",
          "recurrence_rule",
          "schedule",
          "active_start_date",
          "active_end_date",
          "completion_type",
          "completion_event_type",
          "completion_prompt_text",
          "completion_config",
          "importance_score",
          "metadata",
          "status",
          "sort_order",
          "created_at",
        ].join(",")
      )
      .eq("id", focusItemId)
      .eq("care_subject_id", personId)
      .single();

    if (focusItemError) {
      if (isTrackStorageUnavailable(focusItemError)) {
        return NextResponse.json(
          {
            error: "Today’s Focus storage is not available yet.",
            ok: false,
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        {
          error: "Focus item not found for this person.",
          ok: false,
        },
        { status: 404 }
      );
    }

    const [focusItem] = normalizeReceiverTodayFocusRows(
      [focusItemRow as unknown as ReceiverTodayFocusRow],
      new Date()
    );

    if (!focusItem) {
      return NextResponse.json(
        {
          error: "Focus item is not active today.",
          ok: false,
        },
        { status: 409 }
      );
    }

    const eventDraft = buildReceiverTodayFocusCompletionEvent({
      focusItem,
      note: stringValue(body.note) || null,
      occurredAt: stringValue(body.occurredAt) || null,
      unit: stringValue(body.unit) || null,
      value: numberValue(body.value),
    });

    const { data: eventRow, error: eventError } = await supabase
      .from("track_events")
      .insert({
        care_circle_id: eventDraft.careCircleId,
        care_subject_id: eventDraft.careSubjectId,
        confidence: eventDraft.confidence ?? 1,
        created_by_user_id: access.createdByUserId,
        event_type: eventDraft.eventType,
        focus_item_id: eventDraft.focusItemId,
        needs_review: eventDraft.needsReview ?? false,
        note: eventDraft.note,
        occurred_at: eventDraft.occurredAt,
        source: eventDraft.source,
        structured_payload: eventDraft.structuredPayload ?? {},
        title: eventDraft.title,
        unit: eventDraft.unit,
        value: eventDraft.value,
      })
      .select("id,event_type,title,occurred_at,value,unit,source")
      .single();

    if (eventError) {
      if (isTrackStorageUnavailable(eventError)) {
        return NextResponse.json(
          {
            error: "Today’s Focus storage is not available yet.",
            ok: false,
          },
          { status: 503 }
        );
      }

      throw eventError;
    }

    return NextResponse.json({
      focusItemId: focusItem.id,
      ok: true,
      trackEvent: eventRow,
    });
  } catch (error) {
    return focusRouteError(error, "Unable to save Today’s Focus completion.");
  }
}

export async function DELETE(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const personId =
      stringValue(body.personId) || requestUrl.searchParams.get("personId")?.trim() || "";
    const focusItemId =
      stringValue(body.focusItemId) ||
      requestUrl.searchParams.get("focusItemId")?.trim() ||
      "";
    const trackEventId =
      stringValue(body.trackEventId) ||
      requestUrl.searchParams.get("trackEventId")?.trim() ||
      "";

    if (!personId || !focusItemId || !trackEventId) {
      return NextResponse.json(
        {
          error: "Undo requires a person, focus item, and completion event.",
          ok: false,
        },
        { status: 400 }
      );
    }

    const access = await readConnectPersonScopedAccess(request, personId, { body });
    const supabase = createSupabaseServiceClient();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    let deleteQuery = supabase
      .from("track_events")
      .delete()
      .eq("id", trackEventId)
      .eq("care_subject_id", personId)
      .eq("focus_item_id", focusItemId)
      .eq("source", "receiver_today_focus")
      .gte("created_at", tenMinutesAgo);

    deleteQuery = access.createdByUserId
      ? deleteQuery.eq("created_by_user_id", access.createdByUserId)
      : deleteQuery.is("created_by_user_id", null);

    const { data, error } = await deleteQuery
      .select("id")
      .maybeSingle();

    if (error) {
      if (isTrackStorageUnavailable(error)) {
        return NextResponse.json(
          {
            error: "Today’s Focus storage is not available yet.",
            ok: false,
          },
          { status: 503 }
        );
      }

      throw error;
    }

    if (!data?.id) {
      return NextResponse.json(
        {
          error: "This completion can no longer be undone.",
          ok: false,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      focusItemId,
      ok: true,
      undoneTrackEventId: data.id,
    });
  } catch (error) {
    return focusRouteError(error, "Unable to undo Today’s Focus completion.");
  }
}

async function loadTodayFocusTrackContext(
  supabase: SupabaseClient,
  personId: string,
  completedWindowStartUtc: Date,
  completedWindowEndUtc: Date
) {
  const twoWeeksAgo = new Date(completedWindowEndUtc);
  twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);

  const [completedResult, skippedResult] = await Promise.all([
    supabase
      .from("track_events")
      .select("focus_item_id")
      .eq("care_subject_id", personId)
      .eq("event_status", "active")
      .not("focus_item_id", "is", null)
      .neq("event_type", "medication.skipped")
      .gte("occurred_at", completedWindowStartUtc.toISOString())
      .lt("occurred_at", completedWindowEndUtc.toISOString())
      .limit(100),
    supabase
      .from("track_events")
      .select("focus_item_id")
      .eq("care_subject_id", personId)
      .eq("event_status", "active")
      .eq("event_type", "medication.skipped")
      .not("focus_item_id", "is", null)
      .gte("occurred_at", twoWeeksAgo.toISOString())
      .limit(100),
  ]);

  if (completedResult.error) {
    throw completedResult.error;
  }

  if (skippedResult.error) {
    throw skippedResult.error;
  }

  return {
    completedFocusItemIds: uniqueFocusItemIds(completedResult.data),
    skippedFocusItemIds: repeatedFocusItemIds(skippedResult.data),
  };
}

function uniqueFocusItemIds(rows: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(rows) ? rows : [])
        .map((row) =>
          row && typeof row === "object"
            ? (row as { focus_item_id?: unknown }).focus_item_id
            : null
        )
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )
  );
}

function repeatedFocusItemIds(rows: unknown) {
  const counts = new Map<string, number>();

  for (const id of focusItemIds(rows)) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([id]) => id);
}

function focusItemIds(rows: unknown) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) =>
      row && typeof row === "object"
        ? (row as { focus_item_id?: unknown }).focus_item_id
        : null
    )
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

async function loadUserTimeZone(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return typeof data?.timezone === "string" ? data.timezone : null;
}

function focusRouteError(error: unknown, fallbackMessage: string) {
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
      error: error instanceof Error ? error.message : fallbackMessage,
      ok: false,
    },
    { status: 500 }
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
    message.includes("track_events") ||
    message.includes("importance_score")
  );
}

function isFocusCadencePreferenceUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";

  return (
    maybeError.code === "42P01" ||
    maybeError.code === "42703" ||
    maybeError.code === "PGRST205" ||
    message.includes("focus_cadence_preferences")
  );
}
