import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingServerEnvError } from "../../../platform/server/env";
import { createSupabaseServiceClient } from "../../../platform/server/supabase";

export type ConnectPrimaryCoordinator = {
  displayName: string;
  source: "care_circle_owner" | "fallback";
  userId?: string;
};

type CareCircleMembershipRow = {
  care_circle_id?: string | null;
  created_at?: string | null;
  role?: string | null;
  status?: string | null;
  user_id?: string | null;
};

type ProfileRow = {
  display_name?: string | null;
  email?: string | null;
  family_name?: string | null;
  given_name?: string | null;
  id?: string | null;
};

export const fallbackPrimaryCoordinatorName = "Care coordinator";

export async function readPrimaryCoordinatorForCareCircle(
  careCircleId?: string | null,
  options: { supabase?: SupabaseClient } = {}
): Promise<ConnectPrimaryCoordinator> {
  const normalizedCareCircleId = careCircleId?.trim() || "";
  if (!normalizedCareCircleId) return fallbackPrimaryCoordinator();

  try {
    const supabase = options.supabase ?? createSupabaseServiceClient();
    const { data: memberships, error: membershipError } = await supabase
      .from("care_circle_memberships")
      .select("user_id,role,status,created_at")
      .eq("care_circle_id", normalizedCareCircleId)
      .eq("status", "active");

    if (membershipError) throw membershipError;

    const ownerMembership = ((memberships ?? []) as CareCircleMembershipRow[])
      .filter((membership) => membership.user_id)
      .sort((left, right) => {
        const leftRoleRank = left.role === "owner" ? 0 : 1;
        const rightRoleRank = right.role === "owner" ? 0 : 1;
        if (leftRoleRank !== rightRoleRank) return leftRoleRank - rightRoleRank;
        return String(left.created_at || "").localeCompare(String(right.created_at || ""));
      })[0];
    const userId = ownerMembership?.user_id?.trim() || "";
    if (!userId) return fallbackPrimaryCoordinator();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,display_name,given_name,family_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;

    const displayName = profileDisplayName((profile ?? {}) as ProfileRow);
    if (!displayName) return fallbackPrimaryCoordinator();

    return {
      displayName,
      source: "care_circle_owner",
      userId,
    };
  } catch (error) {
    if (isMissingServerEnvError(error) || isOptionalCoordinatorLookupUnavailable(error)) {
      return fallbackPrimaryCoordinator();
    }
    throw error;
  }
}

function fallbackPrimaryCoordinator(): ConnectPrimaryCoordinator {
  return {
    displayName: fallbackPrimaryCoordinatorName,
    source: "fallback",
  };
}

function profileDisplayName(profile: ProfileRow) {
  const profileName = profile.display_name?.trim();
  if (profileName) return profileName;

  const fullName = [profile.given_name, profile.family_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;

  return profile.email?.trim() || "";
}

function isOptionalCoordinatorLookupUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  return (
    ["42P01", "42703", "PGRST116", "PGRST200", "PGRST205"].includes(code) ||
    message.includes("care_circle_memberships") ||
    message.includes("column") ||
    message.includes("schema cache")
  );
}
