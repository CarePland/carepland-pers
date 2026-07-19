import type { Metadata } from "next";

import { ReceiverApkSetupPageClient } from "../apk-setup/ReceiverApkSetupPageClient";

export const metadata: Metadata = {
  title: "Receiver Setup | CarePland Connect",
  description: "Approve and open a CarePland Connect Receiver install.",
};

type ReceiverSetupPageProps = {
  searchParams: Promise<{
    code?: string;
    new?: string;
    receiverUrl?: string;
    receiverKey?: string;
  }>;
};

export default async function ReceiverSetupPage({
  searchParams,
}: ReceiverSetupPageProps) {
  const params = await searchParams;

  return (
    <ReceiverApkSetupPageClient
      initialPairingCode={params.code || ""}
      initialReceiverUrl={params.receiverUrl || ""}
      selectedReceiverKey={params.new === "1" ? "" : params.receiverKey ?? ""}
    />
  );
}
