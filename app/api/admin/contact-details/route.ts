import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import {
  AdminContactDetails,
  adminContactDetailsFromValue,
  contactDetailsChangedFields,
  emptyAdminContactDetails,
  isLikelyContactEmail,
  normalizeAdminPhone,
  redactedContactDetails,
} from "../../../lib/admin/contactDetails";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

type AdminContactAction = "reveal" | "update";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Something went wrong.");
}

function requiredReason(value: unknown, action: AdminContactAction) {
  const reason = typeof value === "string" ? value.trim() : "";

  if (reason.length < 8) {
    throw new Error(
      action === "reveal"
        ? "Enter a brief reason before viewing contact details."
        : "Enter a brief reason before saving contact changes."
    );
  }

  return reason;
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

async function assertAdmin(accessToken: string) {
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError) {
    throw userError;
  }

  const adminUserId = userData.user?.id;

  if (!adminUserId) {
    throw new Error("Please sign in before managing contact details.");
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
    throw new Error("Admin access is required to manage contact details.");
  }

  return adminUserId;
}

async function getTargetContactDetails(
  adminClient: SupabaseClient,
  targetUserId: string
) {
  const [
    { data: authUserData, error: authUserError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    adminClient.auth.admin.getUserById(targetUserId),
    adminClient
      .from("profiles")
      .select(
        "email,phone,phone_e164,timezone,address_line1,address_line2,city,region,postal_code,country"
      )
      .eq("id", targetUserId)
      .single(),
  ]);

  if (authUserError) {
    throw authUserError;
  }

  if (profileError) {
    throw profileError;
  }

  return adminContactDetailsFromValue({
    ...(profile ?? {}),
    email: profile?.email || authUserData.user?.email || "",
  });
}

async function insertAuditEvent(
  adminClient: SupabaseClient,
  {
    adminUserId,
    eventType,
    metadata,
    reason,
    targetUserId,
  }: {
    adminUserId: string;
    eventType: string;
    metadata: Record<string, unknown>;
    reason: string;
    targetUserId: string;
  }
) {
  const { error } = await adminClient.from("admin_access_events").insert({
    actor_user_id: adminUserId,
    event_type: eventType,
    metadata,
    permission_scope:
      eventType === "admin_contact_details_updated"
        ? "update_user_contact"
        : "reveal_user_contact",
    reason,
    resource_type: "profile_contact",
    target_user_id: targetUserId,
  });

  if (error) {
    throw error;
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
      throw new Error("Please sign in before managing contact details.");
    }

    const body = await request.json();
    const action = body.action === "update" ? "update" : "reveal";
    const targetUserId =
      typeof body.targetUserId === "string" ? body.targetUserId.trim() : "";
    const reason = requiredReason(body.reason, action);

    if (!targetUserId) {
      throw new Error("Target user is required.");
    }

    const adminUserId = await assertAdmin(accessToken);
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const beforeDetails = await getTargetContactDetails(
      adminClient,
      targetUserId
    );

    if (action === "reveal") {
      await insertAuditEvent(adminClient, {
        adminUserId,
        eventType: "admin_contact_details_viewed",
        metadata: {
          fields_viewed: Object.keys(beforeDetails).filter(
            (key) => beforeDetails[key as keyof AdminContactDetails]
          ),
        },
        reason,
        targetUserId,
      });

      return NextResponse.json({ contactDetails: beforeDetails });
    }

    const requestedDetails = adminContactDetailsFromValue(
      body.contactDetails ?? emptyAdminContactDetails
    );
    const normalizedPhone = normalizeAdminPhone(requestedDetails.phone);
    const nextDetails: AdminContactDetails = {
      ...requestedDetails,
      email: requestedDetails.email.trim().toLowerCase(),
      phone: normalizedPhone.display,
      phone_e164: normalizedPhone.e164,
    };

    if (nextDetails.email && !isLikelyContactEmail(nextDetails.email)) {
      throw new Error("Enter a valid email before saving contact details.");
    }

    const changedFields = contactDetailsChangedFields(
      beforeDetails,
      nextDetails
    );

    if (changedFields.length === 0) {
      throw new Error("No contact detail changes were found.");
    }

    if (
      changedFields.includes("email") &&
      nextDetails.email.toLowerCase() !== beforeDetails.email.toLowerCase()
    ) {
      const existingNewEmailUser = nextDetails.email
        ? await findAuthUserByEmail(adminClient, nextDetails.email)
        : null;

      if (existingNewEmailUser && existingNewEmailUser.id !== targetUserId) {
        throw new Error("Another auth user already uses that email.");
      }

      if (nextDetails.email) {
        const { data: targetAuthUser, error: authLookupError } =
          await adminClient.auth.admin.getUserById(targetUserId);

        if (authLookupError) {
          throw authLookupError;
        }

        const { error: authUpdateError } =
          await adminClient.auth.admin.updateUserById(targetUserId, {
            email: nextDetails.email,
            email_confirm: true,
            user_metadata: {
              ...(targetAuthUser.user?.user_metadata ?? {}),
              requires_email_update: false,
            },
          });

        if (authUpdateError) {
          throw authUpdateError;
        }
      }
    }

    const { error: profileUpdateError } = await adminClient
      .from("profiles")
      .update({
        address_line1: nextDetails.address_line1 || null,
        address_line2: nextDetails.address_line2 || null,
        city: nextDetails.city || null,
        country: nextDetails.country || null,
        email: nextDetails.email || null,
        phone: nextDetails.phone || null,
        phone_e164: nextDetails.phone_e164 || null,
        postal_code: nextDetails.postal_code || null,
        region: nextDetails.region || null,
        timezone: nextDetails.timezone || null,
      })
      .eq("id", targetUserId);

    if (profileUpdateError) {
      throw profileUpdateError;
    }

    await insertAuditEvent(adminClient, {
      adminUserId,
      eventType: "admin_contact_details_updated",
      metadata: {
        after_preview: redactedContactDetails(nextDetails),
        before_preview: redactedContactDetails(beforeDetails),
        changed_fields: changedFields,
      },
      reason,
      targetUserId,
    });

    return NextResponse.json({
      changedFields,
      contactDetails: nextDetails,
      message: "Contact details updated.",
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}
