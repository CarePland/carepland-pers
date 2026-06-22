"use client";

import { ComponentProps } from "react";

import { AdminAiPanel } from "./AdminAiPanel";
import { AdminConnectPanel } from "./AdminConnectPanel";
import { AdminAssistantReviewPanel } from "./AdminAssistantReviewPanel";
import { AdminAuditTrailPanel } from "./AdminAuditTrailPanel";
import { AdminContentPanel } from "./AdminContentPanel";
import { AdminDashboardPanel } from "./AdminDashboardPanel";
import { AdminEarlyAccessIntakePanel } from "./AdminEarlyAccessIntakePanel";
import { AdminIntegrationErrorsPanel } from "./AdminIntegrationErrorsPanel";
import { AdminProductManagementPanel } from "./AdminProductManagementPanel";
import { AdminSupportTicketsPanel } from "./AdminSupportTicketsPanel";
import { AdminToolsPanel } from "./AdminToolsPanel";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { AdminWorkspaceShell } from "./AdminWorkspaceShell";
import type { AdminNavItem } from "./AdminAttention";

export type AdminWorkspaceTab =
  | "connect"
  | "dashboard"
  | "ai"
  | "assistantReview"
  | "content"
  | "errors"
  | "intake"
  | "product"
  | "tickets"
  | "tools"
  | "userAudit"
  | "users";

export type AdminWorkspaceTopTab =
  | "connect"
  | "dashboard"
  | "support"
  | "system"
  | "tools"
  | "users";

export type AdminWorkspaceProps = {
  activeSecondaryKey: AdminWorkspaceTab;
  activeTopKey: AdminWorkspaceTopTab;
  ai: Omit<ComponentProps<typeof AdminAiPanel>, "adminArea">;
  assistantReview: ComponentProps<typeof AdminAssistantReviewPanel>;
  audit: ComponentProps<typeof AdminAuditTrailPanel<AdminWorkspaceTab>>;
  content: ComponentProps<typeof AdminContentPanel>;
  dashboard: ComponentProps<typeof AdminDashboardPanel>;
  errors: ComponentProps<typeof AdminIntegrationErrorsPanel>;
  intake: ComponentProps<typeof AdminEarlyAccessIntakePanel<AdminWorkspaceTab>>;
  onSelectSecondary: (tab: AdminWorkspaceTab) => void;
  onSelectTop: (tab: AdminWorkspaceTopTab) => void;
  product: ComponentProps<typeof AdminProductManagementPanel>;
  secondaryItems?: AdminNavItem<AdminWorkspaceTab>[];
  stickyTop: number;
  tickets: ComponentProps<typeof AdminSupportTicketsPanel>;
  tools: ComponentProps<typeof AdminToolsPanel>;
  topItems: AdminNavItem<AdminWorkspaceTopTab>[];
  users: ComponentProps<typeof AdminUsersPanel<AdminWorkspaceTab>>;
};

export function AdminWorkspace({
  activeSecondaryKey,
  activeTopKey,
  ai,
  assistantReview,
  audit,
  content,
  dashboard,
  errors,
  intake,
  onSelectSecondary,
  onSelectTop,
  product,
  secondaryItems,
  stickyTop,
  tickets,
  tools,
  topItems,
  users,
}: AdminWorkspaceProps) {
  return (
    <AdminWorkspaceShell
      activeSecondaryKey={activeSecondaryKey}
      activeTopKey={activeTopKey}
      onSelectSecondary={onSelectSecondary}
      onSelectTop={onSelectTop}
      secondaryItems={secondaryItems}
      stickyTop={stickyTop}
      topItems={topItems}
    >
      {activeSecondaryKey === "dashboard" ? (
        <AdminDashboardPanel {...dashboard} />
      ) : null}

      {activeSecondaryKey === "tools" ? <AdminToolsPanel {...tools} /> : null}

      {activeSecondaryKey === "users" ? <AdminUsersPanel {...users} /> : null}

      {activeSecondaryKey === "userAudit" ? (
        <AdminAuditTrailPanel {...audit} />
      ) : null}

      {activeSecondaryKey === "intake" ? (
        <AdminEarlyAccessIntakePanel {...intake} />
      ) : null}

      {activeSecondaryKey === "errors" ? (
        <AdminIntegrationErrorsPanel {...errors} />
      ) : null}

      {activeSecondaryKey === "tickets" ? (
        <AdminSupportTicketsPanel {...tickets} />
      ) : null}

      {activeSecondaryKey === "assistantReview" ? (
        <AdminAssistantReviewPanel {...assistantReview} />
      ) : null}

      {activeSecondaryKey === "content" ? (
        <AdminContentPanel {...content} />
      ) : null}

      {activeSecondaryKey === "ai" ? (
        <AdminAiPanel {...ai} adminArea="ai" />
      ) : null}

      {activeSecondaryKey === "connect" ? (
        <AdminConnectPanel ai={ai} />
      ) : null}

      {activeSecondaryKey === "product" ? (
        <AdminProductManagementPanel {...product} />
      ) : null}
    </AdminWorkspaceShell>
  );
}
