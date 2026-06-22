import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "./env";

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
