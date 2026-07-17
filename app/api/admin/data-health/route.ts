import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { isMissingServerEnvError } from "@/app/lib/platform/server/env";
import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
} from "@/app/lib/platform/server/supabase";

const betaAgreementVersion = "beta-2026-05-19";

type DataHealthFinding = {
  checkKey: string;
  description: string;
  email?: string | null;
  id: string;
  repairable: boolean;
  severity: "info" | "warn" | "error";
  title: string;
};

type ProfileHealthRow = {
  beta_agreement_version: string | null;
  beta_disclaimer_acknowledged_at: string | null;
  beta_privacy_acknowledged_at: string | null;
  beta_terms_acknowledged_at: string | null;
  display_name: string | null;
  email: string | null;
  id: string;
  onboarding_completed_at: string | null;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error || "Something went wrong.");
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!accessToken) {
    throw new Error("Please sign in before running Data Health.");
  }

  const userClient = createSupabaseUserClient(accessToken);
  const { data: userData, error: userError } = await userClient.auth.getUser();

  if (userError) throw userError;

  const adminUserId = userData.user?.id;

  if (!adminUserId) {
    throw new Error("Please sign in before running Data Health.");
  }

  const { data: adminProfile, error: adminProfileError } = await userClient
    .from("profiles")
    .select("is_admin")
    .eq("id", adminUserId)
    .single();

  if (adminProfileError) throw adminProfileError;

  if (adminProfile?.is_admin !== true) {
    throw new Error("Admin access is required to run Data Health.");
  }

  return adminUserId;
}

async function listAllAuthUsers(adminClient: SupabaseClient) {
  const users: User[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    users.push(...data.users);

    if (data.users.length < perPage) return users;
    page += 1;
  }
}

async function buildDataHealthFindings(adminClient: SupabaseClient) {
  const findings: DataHealthFinding[] = [];
  const { data: profileRows, error: profilesError } = await adminClient
    .from("profiles")
    .select(
      "id,email,display_name,onboarding_completed_at,beta_agreement_version,beta_terms_acknowledged_at,beta_privacy_acknowledged_at,beta_disclaimer_acknowledged_at"
    )
    .order("created_at", { ascending: false });

  if (profilesError) throw profilesError;

  const profiles = (profileRows ?? []) as ProfileHealthRow[];
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const authUsers = await listAllAuthUsers(adminClient);
  const authUsersById = new Map(authUsers.map((user) => [user.id, user]));

  profiles.forEach((profile) => {
    if (
      profile.onboarding_completed_at &&
      (!profile.beta_terms_acknowledged_at ||
        !profile.beta_privacy_acknowledged_at ||
        !profile.beta_disclaimer_acknowledged_at)
    ) {
      findings.push({
        checkKey: "profile_onboarding_complete_missing_beta_ack",
        description:
          "Profile setup is marked complete, but one or more Early Access acknowledgement timestamps are missing.",
        email: profile.email,
        id: profile.id,
        repairable: true,
        severity: "error",
        title: "Setup complete without agreement timestamps",
      });
    }

    const authUser = authUsersById.get(profile.id);
    const profileEmail = profile.email?.trim().toLowerCase() || "";
    const authEmail = authUser?.email?.trim().toLowerCase() || "";

    if (authUser && profileEmail && authEmail && profileEmail !== authEmail) {
      findings.push({
        checkKey: "profile_auth_email_mismatch",
        description: `Profile email is ${profile.email}, but auth email is ${authUser.email}.`,
        email: profile.email,
        id: profile.id,
        repairable: false,
        severity: "warn",
        title: "Profile email differs from auth email",
      });
    }
  });

  authUsers.forEach((user) => {
    if (profilesById.has(user.id)) return;
    findings.push({
      checkKey: "auth_user_missing_profile",
      description:
        "An auth login exists without a matching profile row. This can block Admin checks and setup state reads.",
      email: user.email ?? null,
      id: user.id,
      repairable: false,
      severity: "warn",
      title: "Auth user is missing a profile",
    });
  });

  return {
    checkedAt: new Date().toISOString(),
    findings,
    summary: {
      errorCount: findings.filter((finding) => finding.severity === "error").length,
      repairableCount: findings.filter((finding) => finding.repairable).length,
      totalFindings: findings.length,
      warnCount: findings.filter((finding) => finding.severity === "warn").length,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const adminClient = createSupabaseServiceClient();
    const result = await buildDataHealthFindings(adminClient);

    return NextResponse.json(result);
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

export async function POST(request: NextRequest) {
  try {
    const adminUserId = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
    };

    if (body.action !== "repair_onboarding_beta_ack") {
      throw new Error("Unsupported Data Health repair.");
    }

    const adminClient = createSupabaseServiceClient();
    const { data: profileRows, error: profilesError } = await adminClient
      .from("profiles")
      .select(
        "id,email,onboarding_completed_at,beta_agreement_version,beta_terms_acknowledged_at,beta_privacy_acknowledged_at,beta_disclaimer_acknowledged_at"
      )
      .not("onboarding_completed_at", "is", null);

    if (profilesError) throw profilesError;

    const repairTargets = ((profileRows ?? []) as ProfileHealthRow[]).filter(
      (profile) =>
        profile.onboarding_completed_at &&
        (!profile.beta_terms_acknowledged_at ||
          !profile.beta_privacy_acknowledged_at ||
          !profile.beta_disclaimer_acknowledged_at)
    );

    for (const profile of repairTargets) {
      const acknowledgedAt = profile.onboarding_completed_at || new Date().toISOString();
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({
          beta_agreement_version:
            profile.beta_agreement_version || betaAgreementVersion,
          beta_disclaimer_acknowledged_at:
            profile.beta_disclaimer_acknowledged_at || acknowledgedAt,
          beta_privacy_acknowledged_at:
            profile.beta_privacy_acknowledged_at || acknowledgedAt,
          beta_terms_acknowledged_at:
            profile.beta_terms_acknowledged_at || acknowledgedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (updateError) throw updateError;
    }

    const { error: auditError } = await adminClient
      .from("admin_access_events")
      .insert({
        actor_user_id: adminUserId,
        event_type: "admin_data_health_repair",
        metadata: {
          action: body.action,
          repaired_count: repairTargets.length,
          repaired_profile_ids: repairTargets.map((profile) => profile.id),
        },
        permission_scope: "admin_data_health",
        reason: "Admin Data Health repair",
        resource_type: "profile_integrity",
      });

    if (auditError) throw auditError;

    const result = await buildDataHealthFindings(adminClient);

    return NextResponse.json({
      ...result,
      repairedCount: repairTargets.length,
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
