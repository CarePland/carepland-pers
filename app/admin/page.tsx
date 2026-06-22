import type { Metadata } from "next";

import { AdminApp } from "./AdminApp";

export const metadata: Metadata = {
  title: "CarePland Admin",
  description: "CarePland Admin operations workspace.",
};

export default function CarePlandAdminPage() {
  return <AdminApp />;
}
