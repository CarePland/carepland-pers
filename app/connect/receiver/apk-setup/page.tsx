import type { Metadata } from "next";

import { ReceiverApkSetupPageClient } from "./ReceiverApkSetupPageClient";

export const metadata: Metadata = {
  title: "Receiver Setup | CarePland Connect",
  description: "Standalone setup path for CarePland Receiver.",
};

type ReceiverApkSetupPageProps = {
  searchParams: Promise<{
    new?: string;
    receiverKey?: string;
  }>;
};

export default async function ReceiverApkSetupPage({
  searchParams,
}: ReceiverApkSetupPageProps) {
  const params = await searchParams;
  return (
    <ReceiverApkSetupPageClient
      selectedReceiverKey={params.new === "1" ? "" : params.receiverKey ?? ""}
    />
  );
}
