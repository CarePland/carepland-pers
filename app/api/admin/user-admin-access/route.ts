import { NextRequest, NextResponse } from "next/server";

import { isMissingServerEnvError } from "@/app/lib/platform/server/env";
import {
  createSupabasePublicClient,
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "@/app/lib/platform/server/supabase";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Something went wrong.");
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    throw new Error("Please sign in before updating admin access.");
  }

  const userClient = createSupabaseUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError) {
    throw userError;
  }

  const adminUser = userData.user;

  if (!adminUser?.id || !adminUser.email) {
    throw new Error("Please sign in before updating admin access.");
  }

  const { data: adminProfile, error: adminProfileError } = await userClient
    .from("profiles")
    .select("is_admin")
    .eq("id", adminUser.id)
    .single();

  if (adminProfileError) {
    throw adminProfileError;
  }

  if (adminProfile?.is_admin !== true) {
    throw new Error("Admin access is required to update admin access.");
  }

  return { email: adminUser.email, userId: adminUser.id };
}

async function verifyAdminPassword(email: string, password: string) {
  const publicClient = createSupabasePublicClient();
  const { error } = await publicClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error("Password verification failed.");
  }

  await publicClient.auth.signOut();
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requireAdmin(request);
    const body = await request.json();
    const targetUserId =
      typeof body.userId === "string" ? body.userId.trim() : "";
    const isAdmin = body.isAdmin === true;
    const password = typeof body.password === "string" ? body.password : "";

    if (!targetUserId) {
      throw new Error("Choose a user before updating admin access.");
    }

    if (isAdmin && !password) {
      throw new Error("Enter your password before granting admin access.");
    }

    if (isAdmin) {
      await verifyAdminPassword(adminUser.email, password);
    }

    const serviceClient = createSupabaseServiceClient();
    const { data: targetProfile, error: targetProfileError } =
      await serviceClient
        .from("profiles")
        .select("id,email,display_name,is_admin")
        .eq("id", targetUserId)
        .single();

    if (targetProfileError) {
      throw targetProfileError;
    }

    if (!targetProfile) {
      throw new Error("User profile was not found.");
    }

    const previousAdminValue = targetProfile.is_admin === true;

    if (!isAdmin && previousAdminValue) {
      const { count, error: countError } = await serviceClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_admin", true);

      if (countError) {
        throw countError;
      }

      if ((count ?? 0) <= 1) {
        throw new Error("CarePland must keep at least one Admin.");
      }
    }

    const { error: updateError } = await serviceClient
      .from("profiles")
      .update({ is_admin: isAdmin })
      .eq("id", targetUserId);

    if (updateError) {
      throw updateError;
    }

    const { error: auditError } = await serviceClient
      .from("admin_access_events")
      .insert({
        actor_user_id: adminUser.userId,
        event_type: isAdmin
          ? "admin_access_granted"
          : "admin_access_removed",
        metadata: {
          after_preview: { is_admin: isAdmin },
          before_preview: { is_admin: previousAdminValue },
          changed_fields: ["is_admin"],
          source: "admin_user_activity_panel",
        },
        permission_scope: "update_admin_access",
        reason: isAdmin
          ? "Granted from Admin Users activity panel"
          : "Removed from Admin Users activity panel",
        resource_type: "profile_admin_access",
        target_user_id: targetUserId,
      });

    if (auditError) {
      throw auditError;
    }

    return NextResponse.json({
      isAdmin,
      message: isAdmin ? "Admin access granted." : "Admin access removed.",
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
