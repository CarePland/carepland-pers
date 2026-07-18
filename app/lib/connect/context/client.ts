import { createClient } from "@supabase/supabase-js";

import type {
  ConnectMainUserContext,
  ConnectPersPerson,
  UpdateConnectMainUserContextInput,
} from "./types";
import {
  reportSessionLossFromResponse,
  sessionValidityStore,
  type SessionValiditySurface,
} from "../../platform/sessionValidity";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchConnectMainUserContext(): Promise<ConnectMainUserContext> {
  return fetchJson<ConnectMainUserContext>("/api/connect/context", {
    headers: await connectAuthHeaders(),
    sessionSurface: "main",
  });
}

export async function fetchConnectFocusPeople(): Promise<ConnectPersPerson[]> {
  const body = await fetchJson<{ people?: ConnectPersPerson[] }>(
    "/api/connect/focus-people",
    {
      headers: await connectAuthHeaders(),
      sessionSurface: "main",
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
    sessionSurface: "main",
  });
}

export async function ensureConnectCurrentAccountPerson(): Promise<ConnectMainUserContext> {
  return fetchJson<ConnectMainUserContext>("/api/connect/context", {
    body: JSON.stringify({ action: "ensureCurrentAccountPerson" }),
    headers: {
      ...(await connectAuthHeaders()),
      "Content-Type": "application/json",
    },
    method: "POST",
    sessionSurface: "main",
  });
}

export async function connectAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

type SessionAwareRequestInit = RequestInit & {
  sessionSurface?: SessionValiditySurface;
};

async function fetchJson<T>(url: string, init?: SessionAwareRequestInit): Promise<T> {
  if (sessionValidityStore.getSnapshot().state === "session_lost") {
    throw new Error("CarePland needs you to sign in again.");
  }

  const { sessionSurface, ...fetchInit } = init ?? {};
  const response = await fetch(url, fetchInit);
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    if (sessionSurface) {
      reportSessionLossFromResponse(response, {
        reason: body.error || `Connect request rejected: ${response.status}`,
        surface: sessionSurface,
      });
    }
    throw new Error(body.error || `Connect context request failed: ${response.status}`);
  }

  return body;
}
