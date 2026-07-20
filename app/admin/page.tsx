import type { Metadata } from "next";

import { AdminApp } from "./AdminApp";

export const metadata: Metadata = {
  title: "CarePland Admin",
  description: "CarePland Admin operations workspace.",
};

export const dynamic = "force-dynamic";

export default function CarePlandAdminPage() {
  return <AdminApp />;
}
