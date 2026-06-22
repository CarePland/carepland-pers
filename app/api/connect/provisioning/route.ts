import {
  connectProvisioningPrototypeProxyEndpoints,
  provisioningSearchParams,
  proxyConnectProvisioningJson,
} from "@/app/lib/connect/provisioning/server/prototypeProvisioningProxy";

export async function GET(request: Request) {
  return proxyConnectProvisioningJson(
    connectProvisioningPrototypeProxyEndpoints.snapshot(
      provisioningSearchParams(request)
    )
  );
}
