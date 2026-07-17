import type { Metadata } from "next";

import { ConnectReceiver } from "../../components/connect/receiver/ConnectReceiver";

export const metadata: Metadata = {
  title: "Receiver | CarePland Connect",
  description: "Low-choice receiver experience for CarePland Connect.",
};

type ConnectReceiverPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConnectReceiverPage({
  searchParams,
}: ConnectReceiverPageProps) {
  await searchParams;

  return <ConnectReceiver />;
}
