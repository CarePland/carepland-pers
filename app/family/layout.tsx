import type { ReactNode } from "react";

import { FamilyAdminGate } from "../components/family/shell/FamilyAdminGate";

type FamilyLayoutProps = {
  children: ReactNode;
};

export default function FamilyLayout({ children }: FamilyLayoutProps) {
  return <FamilyAdminGate>{children}</FamilyAdminGate>;
}
