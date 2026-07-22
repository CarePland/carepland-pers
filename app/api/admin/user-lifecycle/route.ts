import { NextRequest, NextResponse } from "next/server";

import { requireAdminCaller } from "@/app/lib/platform/server/adminAuth";
import { isMissingServerEnvError } from "@/app/lib/platform/server/env";
import { createSupabaseServiceClient } from "@/app/lib/platform/server/supabase";

type LifecycleAction = "deactivate" | "restore";

const inactiveBanDuration = "876000h";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error || "Something went wrong.");
}

async function requireActiveAdmin(request: NextRequest) {
  const { userId } = await requireAdminCaller(request, {
    adminRequiredMessage: "Admin access is required to change account status.",
    signInMessage: "Please sign in before changing account status.",
  });

  return userId;
}

export async function POST(request: NextRequest) {
  try {
    const adminUserId = await requireActiveAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      reason?: string;
      userId?: string;
    };
    const action: LifecycleAction =
      body.action === "restore" ? "restore" : "deactivate";
    const targetUserId = typeof body.userId === "string" ? body.userId.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!targetUserId) {
      throw new Error("Choose a user before changing account status.");
    }

    if (reason.length < 8) {
      throw new Error("Enter a brief reason before changing account status.");
    }

    const adminClient = createSupabaseServiceClient();
    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from("profiles")
      .select("id,email,display_name,is_admin,account_status")
      .eq("id", targetUserId)
      .single();

    if (targetProfileError) throw targetProfileError;
    if (!targetProfile) throw new Error("User profile was not found.");

    const previousStatus =
      (targetProfile as { account_status?: string | null }).account_status ===
      "inactive"
        ? "inactive"
        : "active";
    const nextStatus = action === "restore" ? "active" : "inactive";

    if (previousStatus === nextStatus) {
      return NextResponse.json({
        accountStatus: nextStatus,
        message:
          nextStatus === "active"
            ? "Account is already active."
            : "Account is already inactive.",
        userId: targetUserId,
      });
    }

    if (nextStatus === "inactive" && targetProfile.is_admin === true) {
      const { count, error: countError } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_admin", true)
        .eq("account_status", "active");

      if (countError) throw countError;

      if ((count ?? 0) <= 1) {
        throw new Error("CarePland must keep at least one active Admin.");
      }
    }

    const now = new Date().toISOString();
    const updatePayload =
      nextStatus === "inactive"
        ? {
            account_inactivated_at: now,
            account_inactivated_by_user_id: adminUserId,
            account_lifecycle_reason: reason,
            account_restored_at: null,
            account_restored_by_user_id: null,
            account_status: "inactive",
            updated_at: now,
          }
        : {
            account_lifecycle_reason: reason,
            account_restored_at: now,
            account_restored_by_user_id: adminUserId,
            account_status: "active",
            updated_at: now,
          };

    const { error: updateError } = await adminClient
      .from("profiles")
      .update(updatePayload)
      .eq("id", targetUserId);

    if (updateError) throw updateError;

    if (nextStatus === "inactive") {
      const { error: offlineError } = await adminClient
        .from("offline_authorizations")
        .update({ status: "revoked" })
        .eq("user_id", targetUserId)
        .eq("status", "active");

      if (offlineError) throw offlineError;
    }

    const { error: authError } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      {
        ban_duration: nextStatus === "inactive" ? inactiveBanDuration : "none",
      }
    );

    if (authError) throw authError;

    const { error: auditError } = await adminClient
      .from("admin_access_events")
      .insert({
        actor_user_id: adminUserId,
        event_type:
          nextStatus === "inactive"
            ? "admin_user_account_deactivated"
            : "admin_user_account_restored",
        metadata: {
          after_preview: { account_status: nextStatus },
          before_preview: { account_status: previousStatus },
          changed_fields: ["account_status"],
          source: "admin_user_activity_panel",
          supabase_auth_ban:
            nextStatus === "inactive" ? inactiveBanDuration : "none",
        },
        permission_scope: "update_user_lifecycle",
        reason,
        resource_type: "profile_account_lifecycle",
        target_user_id: targetUserId,
      });

    if (auditError) throw auditError;

    return NextResponse.json({
      accountStatus: nextStatus,
      message:
        nextStatus === "inactive"
          ? "Account deactivated."
          : "Account restored.",
      userId: targetUserId,
    });
  } catch (error) {
    if (isMissingServerEnvError(error)) {
      return NextResponse.json(
        { error: "CarePland is missing required server configuration." },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
