"use client";

import { createContext, ReactNode, useContext } from "react";
import type {
  AdministeredProductKey,
  AdminProductArea,
  AdminProductSurface,
} from "./adminProductSurfaces";

type AdminRootContextValue = {
  productSurfaces: readonly AdminProductSurface[];
};

const AdminRootContext = createContext<AdminRootContextValue | null>(null);

type AdminRootProviderProps = AdminRootContextValue & {
  children: ReactNode;
};

export function AdminRootProvider({
  children,
  productSurfaces,
}: AdminRootProviderProps) {
  return (
    <AdminRootContext.Provider value={{ productSurfaces }}>
      {children}
    </AdminRootContext.Provider>
  );
}

export function useAdminRoot() {
  const value = useContext(AdminRootContext);

  if (!value) {
    throw new Error("useAdminRoot must be used within AdminRootProvider.");
  }

  return value;
}

export function useAdminProductSurface(productKey: AdministeredProductKey) {
  const { productSurfaces } = useAdminRoot();

  return (
    productSurfaces.find((surface) => surface.key === productKey) ?? null
  );
}

export function useAdminProductArea(
  productKey: AdministeredProductKey,
  areaKey: string
): AdminProductArea | null {
  const surface = useAdminProductSurface(productKey);

  return surface?.areas.find((area) => area.key === areaKey) ?? null;
}
