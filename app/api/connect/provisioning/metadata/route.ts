import {
  connectProvisioningPrototypeProxyEndpoints,
  proxyConnectProvisioningJson,
} from "@/app/lib/connect/provisioning/server/prototypeProvisioningProxy";

export async function GET() {
  return proxyConnectProvisioningJson(
    connectProvisioningPrototypeProxyEndpoints.metadata
  );
}
