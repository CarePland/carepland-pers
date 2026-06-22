import {
  connectProvisioningPrototypeProxyEndpoints,
  provisioningSearchParams,
  proxyConnectProvisioningJson,
} from "@/app/lib/connect/provisioning/server/prototypeProvisioningProxy";

type RouteContext = {
  params: Promise<{ receiverHouseholdId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { receiverHouseholdId } = await context.params;

  return proxyConnectProvisioningJson(
    connectProvisioningPrototypeProxyEndpoints.householdDetail(
      receiverHouseholdId,
      provisioningSearchParams(request)
    )
  );
}
