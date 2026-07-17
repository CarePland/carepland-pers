import type { Metadata } from "next";

import { AdminWorkflowPreviewClient } from "../../../../components/admin/AdminWorkflowPreviewClient";

export const metadata: Metadata = {
  title: "Personal Setup Preview | CarePland Admin",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PersonalSetupWorkflowPreviewPage() {
  return <AdminWorkflowPreviewClient workflow="personal" />;
}
