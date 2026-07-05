import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConnectReceiver } from "../../components/connect/receiver/ConnectReceiver";

export const metadata: Metadata = {
  title: "Receiver | CarePland Connect",
  description: "Low-choice receiver experience for CarePland Connect.",
};

type ConnectReceiverPageProps = {
  searchParams: Promise<{
    detectedHardwareProfile?: string;
    device?: string;
    nativeSdk?: string;
  }>;
};

export default async function ConnectReceiverPage({
  searchParams,
}: ConnectReceiverPageProps) {
  const params = await searchParams;
  if (shouldUseLegacyReceiver(params)) {
    const nextParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (typeof value === "string" && value) {
        nextParams.set(key, value);
      }
    });
    redirect(`/connect/receiver/legacy?${nextParams.toString()}`);
  }

  return <ConnectReceiver />;
}

function shouldUseLegacyReceiver(params: {
  detectedHardwareProfile?: string;
  device?: string;
  nativeSdk?: string;
}) {
  const nativeSdk = Number.parseInt(params.nativeSdk || "", 10);
  const profile = `${params.device || ""} ${params.detectedHardwareProfile || ""}`.toLowerCase();
  return (Number.isFinite(nativeSdk) && nativeSdk <= 25) || profile.includes("gxv3370");
}
