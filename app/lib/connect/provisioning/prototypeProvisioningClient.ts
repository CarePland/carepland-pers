import type { ConnectProvisioningSnapshot } from "./types";

export type FetchConnectProvisioningSnapshotOptions = {
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

  return fetchJson<ConnectProvisioningSnapshot>(url.toString());
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
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
