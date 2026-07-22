"use client";

import { ComponentProps } from "react";

import { AdminAiPanel } from "./AdminAiPanel";
import { AdminCheckpointPanel } from "./AdminCheckpointPanel";
import { AdminConnectPanel } from "./AdminConnectPanel";
import { AdminAskConsole } from "./AdminAskConsole";
import { AdminAuditTrailPanel } from "./AdminAuditTrailPanel";
import { AdminContentPanel } from "./AdminContentPanel";
import { AdminDashboardPanel } from "./AdminDashboardPanel";
import { AdminEarlyAccessIntakePanel } from "./AdminEarlyAccessIntakePanel";
import { AdminIntegrationErrorsPanel } from "./AdminIntegrationErrorsPanel";
import { AdminHelpReportsPanel } from "./AdminHelpReportsPanel";
import { AdminProductManagementPanel } from "./AdminProductManagementPanel";
import { AdminReceiverLayoutPanel } from "./AdminReceiverLayoutPanel";
import { AdminRecommendationsReviewPanel } from "./AdminRecommendationsReviewPanel";
import { AdminToolsPanel } from "./AdminToolsPanel";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { AdminWorkflowViewPanel } from "./AdminWorkflowViewPanel";
import { AdminWorkspaceShell } from "./AdminWorkspaceShell";
import type { AdminNavItem } from "./AdminAttention";

export type AdminWorkspaceTab =
  | "checkpoint"
  | "connect"
  | "dashboard"
  | "ai"
  | "askConsole"
  | "content"
  | "errors"
  | "helpReports"
  | "intake"
  | "layout"
  | "product"
  | "recommendations"
  | "tools"
  | "userAudit"
  | "users"
  | "workflows";

export type AdminWorkspaceTopTab =
  | "connect"
  | "dashboard"
  | "evaluate"
  | "support"
  | "system"
  | "tools"
  | "users";

export type AdminWorkspaceProps = {
  activeSecondaryKey: AdminWorkspaceTab;
  activeTopKey: AdminWorkspaceTopTab;
  ai: Omit<ComponentProps<typeof AdminAiPanel>, "adminArea">;
  askConsole: ComponentProps<typeof AdminAskConsole>;
  audit: ComponentProps<typeof AdminAuditTrailPanel<AdminWorkspaceTab>>;
  content: ComponentProps<typeof AdminContentPanel>;
  checkpoint: ComponentProps<typeof AdminCheckpointPanel>;
  dashboard: ComponentProps<typeof AdminDashboardPanel>;
  errors: ComponentProps<typeof AdminIntegrationErrorsPanel>;
  intake: ComponentProps<typeof AdminEarlyAccessIntakePanel<AdminWorkspaceTab>>;
  onSelectSecondary: (tab: AdminWorkspaceTab) => void;
  onSelectTop: (tab: AdminWorkspaceTopTab) => void;
  product: ComponentProps<typeof AdminProductManagementPanel>;
  recommendations: ComponentProps<typeof AdminRecommendationsReviewPanel>;
  secondaryItems?: AdminNavItem<AdminWorkspaceTab>[];
  stickyTop: number;
  tools: ComponentProps<typeof AdminToolsPanel>;
  topItems: AdminNavItem<AdminWorkspaceTopTab>[];
  users: ComponentProps<typeof AdminUsersPanel<AdminWorkspaceTab>>;
};

export function AdminWorkspace({
  activeSecondaryKey,
  activeTopKey,
  ai,
  askConsole,
  audit,
  content,
  checkpoint,
  dashboard,
  errors,
  intake,
  onSelectSecondary,
  onSelectTop,
  product,
  recommendations,
  secondaryItems,
  stickyTop,
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

      {activeSecondaryKey === "checkpoint" ? (
        <AdminCheckpointPanel {...checkpoint} />
      ) : null}

      {activeSecondaryKey === "workflows" ? (
        <AdminWorkflowViewPanel />
      ) : null}

      {activeSecondaryKey === "recommendations" ? (
        <AdminRecommendationsReviewPanel {...recommendations} />
      ) : null}

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

      {activeSecondaryKey === "helpReports" ? (
        <AdminHelpReportsPanel />
      ) : null}

      {activeSecondaryKey === "askConsole" ? (
        <AdminAskConsole {...askConsole} />
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

      {activeSecondaryKey === "layout" ? (
        <AdminReceiverLayoutPanel />
      ) : null}

      {activeSecondaryKey === "product" ? (
        <AdminProductManagementPanel {...product} />
      ) : null}
    </AdminWorkspaceShell>
  );
}
