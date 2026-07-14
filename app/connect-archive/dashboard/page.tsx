import type { Metadata } from "next";

import { ConnectArchiveDashboard } from "../../components/connect/archive/ConnectArchiveDashboard";

export const metadata: Metadata = {
  title: "CarePland Connect Archive",
  description:
    "Admin-only archive copy of the CarePland Connect dashboard.",
};

export default function CarePlandConnectArchiveDashboardPage() {
  return <ConnectArchiveDashboard />;
}
