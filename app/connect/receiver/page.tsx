import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConnectReceiver } from "../../components/connect/receiver/ConnectReceiver";

export const metadata: Metadata = {
  title: "Receiver | CarePland Connect",
  description: "Low-choice receiver experience for CarePland Connect.",
};

type ConnectReceiverPageProps = {
  searchParams: Promise<{
    code?: string;
    detectedHardwareProfile?: string;
    device?: string;
    nativeSdk?: string;
    receiverBindingStatus?: string;
    receiverInstallId?: string;
    setupClaim?: string;
    setupCode?: string;
  }>;
};

export default async function ConnectReceiverPage({
  searchParams,
}: ConnectReceiverPageProps) {
  const params = await searchParams;
  if (shouldUseClassicWebViewReceiver(params)) {
    const nextParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string" && value) {
        nextParams.set(key, value);
      }
    });
    nextParams.set("receiver_runtime", "classic_webview");
    redirect(`/connect/receiver/legacy?${nextParams.toString()}`);
  }

  return <ConnectReceiver />;
}

function shouldUseClassicWebViewReceiver(params: {
  code?: string;
  detectedHardwareProfile?: string;
  device?: string;
  nativeSdk?: string;
  receiverBindingStatus?: string;
  receiverInstallId?: string;
  setupClaim?: string;
  setupCode?: string;
}) {
  const nativeSdk = Number.parseInt(params.nativeSdk || "", 10);
  const profile = `${params.device || ""} ${params.detectedHardwareProfile || ""}`.toLowerCase();
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
