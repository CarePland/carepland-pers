import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

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
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Missing required Supabase server configuration.");
    }

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

    if (!isLikelyEmail(currentEmail) || !isLikelyEmail(newEmail)) {
      throw new Error("Enter a valid current email and replacement email.");
    }

    if (currentEmail.toLowerCase() === newEmail.toLowerCase()) {
      throw new Error("The replacement email must be different.");
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data: userData, error: userError } =
      await userClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    const adminUserId = userData.user?.id;

    if (!adminUserId) {
      throw new Error("Please sign in before updating user email.");
    }

    const { data: adminProfile, error: adminProfileError } = await userClient
      .from("profiles")
      .select("is_admin")
      .eq("id", adminUserId)
      .single();

    if (adminProfileError) {
      throw adminProfileError;
    }

    if (adminProfile?.is_admin !== true) {
      throw new Error("Admin access is required to update user email.");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

    return NextResponse.json({
      email: updatedUserData.user?.email ?? newEmail,
      message: "User email updated.",
      userId: targetUser.id,
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
