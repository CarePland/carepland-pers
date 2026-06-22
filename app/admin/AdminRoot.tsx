"use client";

import { LegacyAdminRuntimeBridge } from "./LegacyAdminRuntimeBridge";
import { AdminRootProvider } from "./AdminRootContext";
import { adminProductSurfaces } from "./adminProductSurfaces";

export function AdminRoot() {
  return (
    <AdminRootProvider productSurfaces={adminProductSurfaces}>
      <LegacyAdminRuntimeBridge />
    </AdminRootProvider>
  );
}
