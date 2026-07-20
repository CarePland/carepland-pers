import type { ConnectProvisioningSnapshot } from "./types";

export type FetchConnectProvisioningSnapshotOptions = {
  headers?: Record<string, string>;
  includeInactiveHouseholds?: boolean;
  includeInactivePeople?: boolean;
};

export async function fetchConnectProvisioningSnapshot(
  options: FetchConnectProvisioningSnapshotOptions = {}
): Promise<ConnectProvisioningSnapshot> {
  const url = new URL("/api/connect/provisioning", window.location.origin);

  if (options.includeInactiveHouseholds) {
    url.searchParams.set("includeInactiveHouseholds", "1");
  }

  if (options.includeInactivePeople) {
    url.searchParams.set("includeInactivePeople", "1");
  }

  return fetchJson<ConnectProvisioningSnapshot>(url.toString(), options.headers);
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const response = await fetch(url, headers ? { headers } : undefined);
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    ok?: boolean;
  };

  if (!response.ok || body.ok === false) {
    throw new Error(
      body.error || `Connect provisioning request failed: ${response.status}`
    );
  }

  return body;
}
