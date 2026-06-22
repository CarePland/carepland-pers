import {
  connectPrototypeEndpoints,
  connectPrototypeReceiverId,
} from "../prototypeClient";
import type { ConnectTheme, ConnectThemeResponse } from "./types";

export async function fetchConnectTheme(): Promise<ConnectThemeResponse> {
  return fetchJson<ConnectThemeResponse>(connectPrototypeEndpoints.theme);
}

export async function saveConnectTheme(theme: ConnectTheme) {
  return fetchJson<{ ok?: boolean; theme?: ConnectTheme }>(
    connectPrototypeEndpoints.themeBase,
    {
      body: JSON.stringify({
        receiverId: connectPrototypeReceiverId,
        theme,
      }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    }
  );
}

export async function resetConnectTheme() {
  return fetchJson<{ ok?: boolean }>(connectPrototypeEndpoints.theme, {
    method: "DELETE",
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    ok?: boolean;
  };

  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Connect theme request failed: ${response.status}`);
  }

  return body;
}
