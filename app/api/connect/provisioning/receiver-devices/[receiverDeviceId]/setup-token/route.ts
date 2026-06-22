import {
  connectProvisioningPrototypeProxyEndpoints,
  proxyConfirmedConnectProvisioningWrite,
} from "@/app/lib/connect/provisioning/server/prototypeProvisioningProxy";

type RouteContext = {
  params: Promise<{ receiverDeviceId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { receiverDeviceId } = await context.params;

  return proxyConfirmedConnectProvisioningWrite(
    request,
    connectProvisioningPrototypeProxyEndpoints.deviceSetupToken(receiverDeviceId),
    "connect.provisioning.receiver_device.setup_token"
  );
}
