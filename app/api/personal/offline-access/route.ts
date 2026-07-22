import { createHash } from "crypto";
import { NextResponse } from "next/server";

import { buildOfflineAuthorizationRecord } from "@/app/lib/platform/offlineAuthorization";
import {
  extendedOfflineFeatureKey,
  getOfflinePolicy,
  isOfflineAccessReasonCode,
  type OfflineAccessState,
} from "@/app/lib/platform/offlineAccess";
import {
  createSupabaseServiceClient,
  createSupabaseUserClient,
  getActiveSupabaseUser,
} from "@/app/lib/platform/server/supabase";

type FeatureAccessResult = {
  allowed?: boolean;
  message?: string;
  plan_id?: string;
  plan_name?: string;
};

type OfflineAuthorizationRow = {
  account_id: string;
  device_id: string;
  expires_at: string;
  id: string;
  requested_at: string;
  starts_at: string;
  status: "active" | "expired" | "revoked";
  subscription_tier_at_issue: string | null;
  user_id: string;
};

export async function GET(request: Request) {
  try {
    const context = await requestContext(request);
    if (context instanceof NextResponse) return context;

    const state = await loadOfflineAccessState(context);
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load offline access.",
        ok: false,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await requestContext(request);
    if (context instanceof NextResponse) return context;

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const reasonCode = isOfflineAccessReasonCode(body.reasonCode)
      ? body.reasonCode
      : null;

    const { data, error } = await context.userSupabase.rpc(
      "issue_offline_authorization",
      {
        p_account_id: context.accountId,
        p_device_id: context.deviceId,
        p_reason_code: reasonCode,
      }
    );

    if (error) {
      return NextResponse.json(
        {
          error:
            error.message ||
            "CarePland could not prepare extended offline access.",
          ok: false,
        },
        { status: error.code === "42501" ? 403 : 409 }
      );
    }

    const issuedRow = Array.isArray(data)
      ? (data[0] as OfflineAuthorizationRow | undefined)
      : null;

    if (!issuedRow) {
      throw new Error("CarePland could not prepare extended offline access.");
    }

    const activePass = buildOfflineAuthorizationRecord({
      accountId: issuedRow.account_id,
      deviceId: issuedRow.device_id,
      expiresAt: issuedRow.expires_at,
      id: issuedRow.id,
      issuedAt: issuedRow.requested_at,
      planId: issuedRow.subscription_tier_at_issue,
      startsAt: issuedRow.starts_at,
      userId: issuedRow.user_id,
    });

    await saveAuthorizationFingerprint(activePass.authorization, issuedRow.id);

    return NextResponse.json({
      activePass,
      ok: true,
      policy: getOfflinePolicy(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "CarePland could not prepare extended offline access.",
        ok: false,
      },
      { status: 500 }
    );
  }
}

async function requestContext(request: Request) {
  const requestUrl = new URL(request.url);
  const accountId = requestUrl.searchParams.get("accountId")?.trim();
  const deviceId = requestUrl.searchParams.get("deviceId")?.trim();
  const accessToken = (request.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!accountId) {
    return NextResponse.json(
      { error: "CarePland account is required.", ok: false },
      { status: 400 }
    );
  }

  if (!deviceId) {
    return NextResponse.json(
      { error: "Device is required.", ok: false },
      { status: 400 }
    );
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: "Please sign in before preparing offline access.", ok: false },
      { status: 401 }
    );
  }

  const userSupabase = createSupabaseUserClient(accessToken);
  const user = await getActiveSupabaseUser(
    userSupabase,
    "Please sign in before preparing offline access."
  );
  const userId = user.id;

  return {
    accountId,
    deviceId,
    userId,
    userSupabase,
  };
}

async function loadOfflineAccessState(context: Exclude<
  Awaited<ReturnType<typeof requestContext>>,
  NextResponse
>): Promise<OfflineAccessState> {
  const [accessResult, activePassRow, latestIssueRow] = await Promise.all([
    context.userSupabase.rpc("check_feature_access", {
      p_care_circle_id: context.accountId,
      p_feature_key: extendedOfflineFeatureKey,
      p_quantity: 1,
    }),
    context.userSupabase
      .from("offline_authorizations")
      .select(
        "id,account_id,user_id,device_id,requested_at,starts_at,expires_at,status,subscription_tier_at_issue"
      )
      .eq("account_id", context.accountId)
      .eq("device_id", context.deviceId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.userSupabase
      .from("offline_authorizations")
      .select("requested_at")
      .eq("account_id", context.accountId)
      .in("status", ["active", "expired", "revoked"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (accessResult.error) throw accessResult.error;
  if (activePassRow.error) throw activePassRow.error;
  if (latestIssueRow.error) throw latestIssueRow.error;

  const featureAccess = (accessResult.data ?? {}) as FeatureAccessResult;
  const activePassSource = activePassRow.data as OfflineAuthorizationRow | null;
  const activePass = activePassSource
    ? buildOfflineAuthorizationRecord({
        accountId: activePassSource.account_id,
        deviceId: activePassSource.device_id,
        expiresAt: activePassSource.expires_at,
        id: activePassSource.id,
        issuedAt: activePassSource.requested_at,
        planId: activePassSource.subscription_tier_at_issue,
        startsAt: activePassSource.starts_at,
        userId: activePassSource.user_id,
      })
    : null;
  const latestRequestedAt =
    typeof latestIssueRow.data?.requested_at === "string"
      ? latestIssueRow.data.requested_at
      : null;
  const nextEligibleAt = latestRequestedAt
    ? new Date(
        new Date(latestRequestedAt).getTime() +
          getOfflinePolicy().cooldownDays * 24 * 60 * 60 * 1000
      ).toISOString()
    : null;

  return {
    activePass,
    eligible: featureAccess.allowed === true,
    message: featureAccess.message,
    nextEligibleAt,
    planId: featureAccess.plan_id ?? null,
    planName: featureAccess.plan_name ?? null,
    policy: getOfflinePolicy(),
  };
}

async function saveAuthorizationFingerprint(
  authorization: string,
  authorizationId: string
) {
  try {
    const fingerprint = createHash("sha256").update(authorization).digest("hex");
    const serviceSupabase = createSupabaseServiceClient();

    await serviceSupabase
      .from("offline_authorizations")
      .update({ authorization_fingerprint: fingerprint })
      .eq("id", authorizationId);
  } catch {
    // The durable authorization record is authoritative; the fingerprint is audit metadata.
  }
}
