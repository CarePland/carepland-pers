import {
  connectProvisioningPrototypeProxyEndpoints,
  provisioningSearchParams,
  proxyConfirmedConnectProvisioningWrite,
  proxyConnectProvisioningJson,
} from "@/app/lib/connect/provisioning/server/prototypeProvisioningProxy";

export async function GET(request: Request) {
  return proxyConnectProvisioningJson(
    connectProvisioningPrototypeProxyEndpoints.households(
      provisioningSearchParams(request)
    )
  );
}

export async function POST(request: Request) {
  return proxyConfirmedConnectProvisioningWrite(
    request,
    connectProvisioningPrototypeProxyEndpoints.households(),
    "connect.provisioning.household.create"
  );
}
