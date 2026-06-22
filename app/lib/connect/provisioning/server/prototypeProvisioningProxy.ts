import { NextResponse } from "next/server";

import { connectPrototypeEndpoints } from "../../prototypeClient";

type ProxyJsonOptions = {
  body?: Record<string, unknown>;
  method?: "GET" | "POST" | "PATCH";
};

class ConnectProvisioningWriteError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ConnectProvisioningWriteError";
    this.status = status;
  }
}

export const connectProvisioningPrototypeProxyEndpoints = {
  auditEvents: (params?: URLSearchParams) =>
    prototypeUrl("/connect/provisioning/audit-events", params),
  deviceDetail: (receiverDeviceId: string) =>
    prototypeUrl(
      `/connect/provisioning/receiver-devices/${encodeURIComponent(receiverDeviceId)}`
    ),
  deviceSetupToken: (receiverDeviceId: string) =>
    prototypeUrl(
      `/connect/provisioning/receiver-devices/${encodeURIComponent(receiverDeviceId)}/setup-token`
    ),
  devices: prototypeUrl("/connect/provisioning/receiver-devices"),
  householdDetail: (receiverHouseholdId: string, params?: URLSearchParams) =>
    prototypeUrl(
      `/connect/provisioning/households/${encodeURIComponent(receiverHouseholdId)}`,
      params
    ),
  householdReceiverPeople: (receiverHouseholdId: string) =>
    prototypeUrl(
      `/connect/provisioning/households/${encodeURIComponent(receiverHouseholdId)}/receiver-people`
    ),
  households: (params?: URLSearchParams) =>
    prototypeUrl("/connect/provisioning/households", params),
  metadata: prototypeUrl("/connect/provisioning/metadata"),
  snapshot: (params?: URLSearchParams) =>
    params?.toString()
      ? prototypeUrl("/connect/provisioning", params)
      : connectPrototypeEndpoints.provisioning,
  summary: (params?: URLSearchParams) =>
    params?.toString()
      ? prototypeUrl("/connect/provisioning/summary", params)
      : connectPrototypeEndpoints.provisioningSummary,
} as const;

export async function proxyConnectProvisioningJson(
  url: string,
  options: ProxyJsonOptions = {}
) {
  try {
    const method = options.method ?? "GET";
    const response = await fetch(url, {
      body: method === "GET" ? undefined : JSON.stringify(options.body ?? {}),
      cache: "no-store",
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      method,
    });
    const payload = await response.json().catch(() => ({}));

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Connect provisioning prototype proxy failed.",
        ok: false,
      },
      { status: 502 }
    );
  }
}

export async function proxyConfirmedConnectProvisioningWrite(
  request: Request,
  url: string,
  actionLabel: string
) {
  try {
    const body = await confirmedPrototypeWriteBody(request, actionLabel);

    return proxyConnectProvisioningJson(url, { body, method: "POST" });
  } catch (error) {
    if (error instanceof ConnectProvisioningWriteError) {
      return NextResponse.json(
        {
          error: error.message,
          ok: false,
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Connect provisioning write confirmation failed.",
        ok: false,
      },
      { status: 500 }
    );
  }
}

export function provisioningSearchParams(request: Request) {
  return new URL(request.url).searchParams;
}

async function confirmedPrototypeWriteBody(request: Request, actionLabel: string) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const confirmed = body.confirmedPrototypeWrite === true;
  const operationReason =
    typeof body.operationReason === "string" ? body.operationReason.trim() : "";

  if (!confirmed) {
    throw new ConnectProvisioningWriteError(
      "Confirm this prototype provisioning write before continuing."
    );
  }

  if (operationReason.length < 8) {
    throw new ConnectProvisioningWriteError(
      "Add a brief reason for this provisioning write."
    );
  }

  const prototypeBody = { ...body };
  delete prototypeBody.confirmedPrototypeWrite;
  delete prototypeBody.operationReason;

  return {
    ...prototypeBody,
    operationReason,
    prototypeWriteAction: actionLabel,
  };
}

function prototypeUrl(path: string, params?: URLSearchParams) {
  const url = new URL(path, "http://localhost:8790");

  for (const [key, value] of params ?? []) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}
