"use client";

import { CarePlandPers } from "../CarePlandPers";
import { useAdminRoot } from "./AdminRootContext";

// Transitional bridge: AdminRoot owns the product entry, while the legacy
// shared runtime still owns auth/session/admin state until those services move.
export function LegacyAdminRuntimeBridge() {
  const { productSurfaces } = useAdminRoot();

  return (
    <div
      data-admin-products={productSurfaces.map((surface) => surface.key).join(",")}
    >
      <CarePlandPers
        adminRoute
        preferredInitialMainTab="admin"
        preferAdminAfterLogin={false}
      />
    </div>
  );
}
