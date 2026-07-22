import type { SupabaseClient } from "@supabase/supabase-js";

export const activeAccountStatus = "active";
export const inactiveAccountStatus = "inactive";

export type AccountStatus = typeof activeAccountStatus | typeof inactiveAccountStatus;

export class InactiveAccountError extends Error {
  status = 403;

  constructor(message = "This CarePland account is inactive.") {
    super(message);
    this.name = "InactiveAccountError";
  }
}

export function normalizeAccountStatus(value: unknown): AccountStatus {
  return value === inactiveAccountStatus ? inactiveAccountStatus : activeAccountStatus;
}

export function isAccountActive(value: unknown) {
  return normalizeAccountStatus(value) === activeAccountStatus;
}

export async function assertAccountActive(
  supabase: SupabaseClient,
  userId: string,
  message?: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  if (!isAccountActive((data as { account_status?: string | null } | null)?.account_status)) {
    throw new InactiveAccountError(message);
  }
}
