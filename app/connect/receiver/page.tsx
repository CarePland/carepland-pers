import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConnectReceiver } from "../../components/connect/receiver/ConnectReceiver";
import { receiverRouteHints } from "../../lib/connect/receiver/receiverRouteHints";

export const metadata: Metadata = {
  title: "Receiver | CarePland Connect",
  description: "Low-choice receiver experience for CarePland Connect.",
};

type ConnectReceiverPageProps = {
  searchParams: Promise<{
    code?: string;
    detectedHardwareProfile?: string;
    device?: string;
    hardwareProfile?: string;
    nativeSdk?: string;
    receiverBindingStatus?: string;
    receiverInstallId?: string;
    setupClaim?: string;
    setupCode?: string;
    uiLayout?: string;
  }>;
};

export default async function ConnectReceiverPage({
  searchParams,
}: ConnectReceiverPageProps) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const hints = receiverRouteHints({
    host: requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"),
    searchParams: params,
    userAgent: requestHeaders.get("user-agent"),
  });

  if (shouldUseClassicWebViewReceiver(params) || hints.useClassic) {
    const nextParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string" && value) {
        nextParams.set(key, value);
      }
    });
    if (hints.device && !nextParams.has("device")) nextParams.set("device", hints.device);
    if (hints.hardwareProfile && !nextParams.has("hardwareProfile")) {
      nextParams.set("hardwareProfile", hints.hardwareProfile);
    }
    if (hints.uiLayout && !nextParams.has("uiLayout")) {
      nextParams.set("uiLayout", hints.uiLayout);
    }
    nextParams.set("receiver_runtime", "classic_webview");
    redirect(`/connect/receiver/legacy?${nextParams.toString()}`);
  }

  return <ConnectReceiver />;
}

function shouldUseClassicWebViewReceiver(params: {
  code?: string;
  detectedHardwareProfile?: string;
  device?: string;
  hardwareProfile?: string;
  nativeSdk?: string;
  receiverBindingStatus?: string;
  receiverInstallId?: string;
  setupClaim?: string;
  setupCode?: string;
  uiLayout?: string;
}) {
  const nativeSdk = Number.parseInt(params.nativeSdk || "", 10);
  const profile = `${params.device || ""} ${params.detectedHardwareProfile || ""} ${
    params.hardwareProfile || ""
  }`.toLowerCase();
  const classicWebViewAndroidVersion = Number.isFinite(nativeSdk) && nativeSdk <= 25;
  const knownClassicWebViewHardware = profile.includes("gxv3370");
  const nativeShellClaimUrl =
    !params.nativeSdk &&
    (Boolean(params.setupClaim) ||
      Boolean(params.receiverInstallId) ||
      Boolean(params.setupCode) ||
      Boolean(params.code) ||
      params.receiverBindingStatus === "claim_pending");

  return classicWebViewAndroidVersion || knownClassicWebViewHardware || nativeShellClaimUrl;
}
