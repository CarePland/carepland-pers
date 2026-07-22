import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "./env";
import { assertAccountActive } from "./accountStatus";

export function createSupabasePublicClient() {
  const supabaseConfig = getSupabaseAnonConfig();

  return createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: { persistSession: false },
  });
}

export function createSupabaseUserClient(accessToken: string) {
  const supabaseConfig = getSupabaseAnonConfig();

  return createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function createSupabaseServiceClient() {
  const supabaseConfig = getSupabaseServiceConfig();

  return createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getActiveSupabaseUser(
  userClient: ReturnType<typeof createSupabaseUserClient>,
  message?: string
) {
  const { data, error } = await userClient.auth.getUser();

  if (error) {
    throw error;
  }

  const user = data.user;

  if (!user?.id) {
    throw new Error(message ?? "Please sign in before continuing.");
  }

  await assertAccountActive(userClient, user.id, message);

  return user;
}
