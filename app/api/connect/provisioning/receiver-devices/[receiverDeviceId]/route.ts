import {
  connectProvisioningPrototypeProxyEndpoints,
  proxyConnectProvisioningJson,
} from "@/app/lib/connect/provisioning/server/prototypeProvisioningProxy";

type RouteContext = {
  params: Promise<{ receiverDeviceId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { receiverDeviceId } = await context.params;

  return proxyConnectProvisioningJson(
    connectProvisioningPrototypeProxyEndpoints.deviceDetail(receiverDeviceId)
  );
}
