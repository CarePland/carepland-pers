import { NextResponse } from "next/server";

import {
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
  createSupabaseUserClient,
  getActiveSupabaseUser,
} from "@/app/lib/platform/server/supabase";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const personId = requestUrl.searchParams.get("personId")?.trim();
    const accessToken = (request.headers.get("authorization") ?? "")
      .replace(/^Bearer\s+/i, "")
      .trim();

    if (!personId) {
      return NextResponse.json(
        { error: "Choose a Care VIP before loading Today's Focus.", focusItems: [], ok: false },
        { status: 400 }
      );
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: "Please sign in before loading Today's Focus.", focusItems: [], ok: false },
        { status: 401 }
      );
    }

    const supabase = createSupabaseUserClient(accessToken);
    const user = await getActiveSupabaseUser(
      supabase,
      "Please sign in before loading Today's Focus."
    );
    const userId = user.id;

    const timeZone = await loadUserTimeZone(supabase, userId);
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

    if (error) throw error;

    const [{ completedFocusItemIds, skippedFocusItemIds }, preferences] =
      await Promise.all([
        loadTodayFocusTrackContext(
          supabase,
          personId,
          completionWindow.startUtc,
          completionWindow.endUtc
        ),
        loadTodayFocusCadencePreferences(supabase, personId),
      ]);
    const rows = ((data ?? []) as unknown as ReceiverTodayFocusRow[]).filter(
      (row) => {
        const target = focusCadenceTargetFromMetadata({
          focusItemId: row.id,
          metadata: row.metadata ?? null,
        });

        return !focusCadenceSuppressionForRows(preferences, target, new Date());
      }
    );

    return NextResponse.json({
      focusItems: normalizeReceiverTodayFocusRows(rows, new Date(), {
        completedFocusItemIds,
        skippedFocusItemIds,
      }),
      ok: true,
      personId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Today's Focus.",
        focusItems: [],
        ok: false,
      },
      { status: 500 }
    );
  }
}

async function loadTodayFocusCadencePreferences(
  supabase: ReturnType<typeof createSupabaseUserClient>,
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
    return [];
  }

  return (data ?? []) as FocusCadencePreferenceRow[];
}

async function loadTodayFocusTrackContext(
  supabase: ReturnType<typeof createSupabaseUserClient>,
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

  if (completedResult.error) throw completedResult.error;
  if (skippedResult.error) throw skippedResult.error;

  return {
    completedFocusItemIds: uniqueFocusItemIds(completedResult.data),
    skippedFocusItemIds: repeatedFocusItemIds(skippedResult.data),
  };
}

function uniqueFocusItemIds(rows: unknown) {
  return Array.from(new Set(focusItemIds(rows)));
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
  supabase: ReturnType<typeof createSupabaseUserClient>,
  userId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;

  return typeof data?.timezone === "string" ? data.timezone : null;
}
