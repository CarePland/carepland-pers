import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ConnectPersonAccessDeniedError } from "@/app/lib/connect/context/server/mainConnectUserContext";
import {
  readConnectPersonScopedAccess,
  ReceiverDeviceAccessError,
  receiverDeviceSetupRequiredBody,
} from "@/app/lib/connect/context/server/personScopedAccess";
import {
  focusCadenceTargetFromMetadata,
  normalizeFocusCadence,
  normalizeFocusCadenceAction,
  snoozedUntilForFocusCadenceAction,
} from "@/app/lib/personal/track/focusCadencePreferences";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const personId = stringValue(body.personId);
    const focusItemId = stringValue(body.focusItemId);
    const action = normalizeFocusCadenceAction(body.action);
    const cadence = normalizeFocusCadence(body.cadence);

    if (!personId || !focusItemId || !action) {
      return NextResponse.json(
        {
          error: "Today’s Focus preference requires a person, item, and choice.",
          ok: false,
        },
        { status: 400 }
      );
    }

    if (action === "show_less_often" && !cadence) {
      return NextResponse.json(
        {
          error: "Choose how often CarePland should show this.",
          ok: false,
        },
        { status: 400 }
      );
    }

    const access = await readConnectPersonScopedAccess(request, personId, { body });
    const supabase = access.supabase;

    const { data: focusItem, error: focusError } = await supabase
      .from("focus_items")
      .select("id,care_circle_id,care_subject_id,metadata")
      .eq("id", focusItemId)
      .eq("care_subject_id", personId)
      .single();

    if (focusError || !focusItem) {
      return NextResponse.json(
        {
          error: "Focus item not found for this person.",
          ok: false,
        },
        { status: 404 }
      );
    }

    const target = focusCadenceTargetFromMetadata({
      focusItemId,
      metadata: recordValue(focusItem.metadata),
    });
    const now = new Date().toISOString();
    const snoozedUntil =
      action === "hide_until_next_appointment"
        ? await nextAppointmentDate(supabase, personId)
        : snoozedUntilForFocusCadenceAction(action);

    const { data: preference, error: upsertError } = await supabase
      .from("focus_cadence_preferences")
      .upsert(
        {
          cadence,
          care_circle_id: access.careCircleId,
          care_subject_id: personId,
          created_by_user_id: access.createdByUserId,
          evidence_signature: target.evidenceSignature,
          focus_item_id: focusItemId,
          metadata: {
            source: "receiver_today_focus",
          },
          note: stringValue(body.note) || null,
          preference_action: action,
          recommendation_id: target.recommendationId,
          snoozed_until: snoozedUntil,
          target_key: target.targetKey,
          target_type: target.targetType,
          updated_at: now,
        },
        {
          onConflict:
            "care_subject_id,created_by_user_id,target_type,target_key",
        }
      )
      .select("id,preference_action,cadence,snoozed_until,target_type,target_key")
      .single();

    if (upsertError) {
      if (isFocusCadencePreferenceUnavailable(upsertError)) {
        return NextResponse.json(
          {
            error: "Today’s Focus preference storage is not available yet.",
            ok: false,
          },
          { status: 503 }
        );
      }

      throw upsertError;
    }

    return NextResponse.json({
      ok: true,
      preference,
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
        error:
          error instanceof Error
            ? error.message
            : "Today’s Focus preference could not be saved.",
        ok: false,
      },
      { status: 500 }
    );
  }
}

async function nextAppointmentDate(
  supabase: SupabaseClient,
  personId: string
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("starts_at")
    .eq("care_subject_id", personId)
    .neq("status", "archived")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1);

  if (error) {
    return null;
  }

  const startsAt =
    Array.isArray(data) && typeof data[0]?.starts_at === "string"
      ? data[0].starts_at
      : null;

  return startsAt ? startsAt.slice(0, 10) : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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
