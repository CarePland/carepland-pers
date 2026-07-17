import type { Metadata } from "next";

import { AdminWorkflowPreviewClient } from "../../../../components/admin/AdminWorkflowPreviewClient";

export const metadata: Metadata = {
  title: "Receiver Setup Preview | CarePland Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ReceiverSetupWorkflowPreviewPage() {
  return <AdminWorkflowPreviewClient workflow="receiver" />;
}
