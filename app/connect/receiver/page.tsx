import type { Metadata } from "next";

import { ConnectReceiver } from "../../components/connect/receiver/ConnectReceiver";

export const metadata: Metadata = {
  title: "Receiver | CarePland Connect",
  description: "Low-choice receiver experience for CarePland Connect.",
};

export default function ConnectReceiverPage() {
  return <ConnectReceiver />;
}
