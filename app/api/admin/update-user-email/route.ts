import { SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { requireAdminCaller } from "@/app/lib/platform/server/adminAuth";
import { isMissingServerEnvError } from "@/app/lib/platform/server/env";
import { createSupabaseServiceClient } from "@/app/lib/platform/server/supabase";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Something went wrong.");
}

function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function redactEmail(value: string) {
  return value.trim().replace(/(^.).*(@.*$)/, "$1***$2");
}

async function findAuthUserByEmail(
  adminClient: SupabaseClient,
  email: string
): Promise<User | null> {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const foundUser =
      data.users.find(
        (user) => user.email?.trim().toLowerCase() === normalizedEmail
      ) ?? null;

    if (foundUser) {
      return foundUser;
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before updating user email.");
    }

    const body = await request.json();
    const currentEmail =
      typeof body.currentEmail === "string" ? body.currentEmail.trim() : "";
    const newEmail =
      typeof body.newEmail === "string" ? body.newEmail.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!isLikelyEmail(currentEmail) || !isLikelyEmail(newEmail)) {
      throw new Error("Enter a valid current email and replacement email.");
    }

    if (reason.length < 8) {
      throw new Error("Enter a brief reason before updating user email.");
    }

    if (currentEmail.toLowerCase() === newEmail.toLowerCase()) {
      throw new Error("The replacement email must be different.");
    }

    const { userId: adminUserId } = await requireAdminCaller(request, {
      adminRequiredMessage: "Admin access is required to update user email.",
      signInMessage: "Please sign in before updating user email.",
    });

    const adminClient = createSupabaseServiceClient();

    const [targetUser, existingNewEmailUser] = await Promise.all([
      findAuthUserByEmail(adminClient, currentEmail),
      findAuthUserByEmail(adminClient, newEmail),
    ]);

    if (!targetUser) {
      throw new Error("No auth user was found for the current email.");
    }

    if (
      existingNewEmailUser &&
      existingNewEmailUser.id !== targetUser.id
    ) {
      throw new Error("Another auth user already uses the replacement email.");
    }

    const updatedMetadata = {
      ...(targetUser.user_metadata ?? {}),
      requires_email_update: false,
    };

    const { data: updatedUserData, error: updateUserError } =
      await adminClient.auth.admin.updateUserById(targetUser.id, {
        email: newEmail,
        email_confirm: true,
        user_metadata: updatedMetadata,
      });

    if (updateUserError) {
      throw updateUserError;
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ email: newEmail })
      .eq("id", targetUser.id);

    if (profileError) {
      throw profileError;
    }

    const { error: auditError } = await adminClient
      .from("admin_access_events")
      .insert({
        actor_user_id: adminUserId,
        event_type: "admin_contact_details_updated",
        metadata: {
          after_preview: { email: redactEmail(newEmail) },
          before_preview: { email: redactEmail(currentEmail) },
          changed_fields: ["email"],
          source: "admin_email_update_tool",
        },
        permission_scope: "update_user_contact",
        reason,
        resource_type: "profile_contact",
        target_user_id: targetUser.id,
      });

    if (auditError) {
      throw auditError;
    }

    return NextResponse.json({
      email: updatedUserData.user?.email ?? newEmail,
      message: "User email updated.",
      userId: targetUser.id,
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
