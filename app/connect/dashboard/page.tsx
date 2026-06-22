import type { Metadata } from "next";

import { ConnectDashboard } from "../../components/connect/dashboard/ConnectDashboard";

export const metadata: Metadata = {
  title: "CarePland Connect Dashboard",
  description:
    "Operational CarePland Connect receiver dashboard backed by the current Connect prototype contracts.",
};

export default function CarePlandConnectDashboardPage() {
  return <ConnectDashboard />;
}
