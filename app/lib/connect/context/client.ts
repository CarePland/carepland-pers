import { createClient } from "@supabase/supabase-js";

import type {
  ConnectMainUserContext,
  ConnectPersPerson,
  UpdateConnectMainUserContextInput,
} from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchConnectMainUserContext(): Promise<ConnectMainUserContext> {
  return fetchJson<ConnectMainUserContext>("/api/connect/context", {
    headers: await connectAuthHeaders(),
  });
}

export async function fetchConnectFocusPeople(): Promise<ConnectPersPerson[]> {
  const body = await fetchJson<{ people?: ConnectPersPerson[] }>(
    "/api/connect/focus-people",
    {
      headers: await connectAuthHeaders(),
    }
  );

  return body.people ?? [];
}

export async function updateConnectMainUserContext(
  input: UpdateConnectMainUserContextInput
): Promise<ConnectMainUserContext> {
  return fetchJson<ConnectMainUserContext>("/api/connect/context", {
    body: JSON.stringify(input),
    headers: {
      ...(await connectAuthHeaders()),
      "Content-Type": "application/json",
    },
    method: "PUT",
  });
}

export async function connectAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || `Connect context request failed: ${response.status}`);
  }

  return body;
}
