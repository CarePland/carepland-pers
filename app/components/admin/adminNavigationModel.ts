import type { AdminNavItem } from "./AdminAttention";
import type { AdminAttentionSummary, AdminViewScopeType } from "./adminViewState";
import type {
  AdminWorkspaceTab,
  AdminWorkspaceTopTab,
} from "./AdminWorkspace";

type AdminAttentionSummaryLike = Omit<
  AdminAttentionSummary,
  "followup_count" | "new_count"
> & {
  followup_count?: number | null;
  new_count?: number | null;
};

type IntegrationErrorLike = {
  latest_occurred_at: string | null;
};

type AdminAskThreadLike = {
  created_at: string | null;
  id: string;
  updated_at: string | null;
};

type AdminNavigationModelParams = {
  actionableAdminAttentionSummaries: AdminAttentionSummaryLike[];
  adminAskNeedsResponseThreads: AdminAskThreadLike[];
  adminAttentionFor: (
    scopeType: AdminViewScopeType,
    scopeKey: string
  ) => AdminAttentionSummaryLike | null | undefined;
  adminIntegrationErrors: IntegrationErrorLike[];
  adminLastViewedAt: (
    scopeType: AdminViewScopeType,
    scopeKey: string
  ) => string | null;
  adminTab: AdminWorkspaceTab;
  earlyAccessIntakeFollowupCount: number;
  earlyAccessIntakeNewCount: number;
  isNewForAdmin: (value: string | null, lastViewedAt: string | null) => boolean;
};

export const systemAdminTabs: AdminWorkspaceTab[] = [
  "errors",
  "content",
  "ai",
  "product",
];

export const supportAdminTabs: AdminWorkspaceTab[] = [
  "askConsole",
  "helpReports",
];

export const usersAdminTabs: AdminWorkspaceTab[] = [
  "users",
  "intake",
  "userAudit",
];

export function createAdminNavigationModel({
  actionableAdminAttentionSummaries,
  adminAskNeedsResponseThreads,
  adminAttentionFor,
  adminIntegrationErrors,
  adminLastViewedAt,
  adminTab,
  earlyAccessIntakeFollowupCount,
  earlyAccessIntakeNewCount,
  isNewForAdmin,
}: AdminNavigationModelParams) {
  const adminAttentionCountsForTab = (tabKey: AdminWorkspaceTab) => {
    const attention = adminAttentionFor("admin_tab", tabKey);
    let fallbackNewCount = 0;
    let fallbackFollowupCount = 0;

    if (tabKey === "askConsole") {
      // Every thread in this queue already needs an admin response --
      // followupCount is just its size. "New to me" is whichever of those
      // threads updated since this admin last opened the console.
      fallbackFollowupCount = adminAskNeedsResponseThreads.length;
      fallbackNewCount = adminAskNeedsResponseThreads.filter((thread) =>
        isNewForAdmin(
          thread.updated_at || thread.created_at,
          adminLastViewedAt("admin_tab", "askConsole")
        )
      ).length;
    } else if (tabKey === "users" || tabKey === "intake") {
      fallbackNewCount = earlyAccessIntakeNewCount;
      fallbackFollowupCount = earlyAccessIntakeFollowupCount;
    } else if (tabKey === "errors") {
      fallbackNewCount = adminIntegrationErrors.filter((row) =>
        isNewForAdmin(
          row.latest_occurred_at,
          adminLastViewedAt("admin_tab", "errors")
        )
      ).length;
      fallbackFollowupCount = adminIntegrationErrors.length;
    }

    return {
      followupCount: Math.max(
        attention?.followup_count ?? 0,
        fallbackFollowupCount
      ),
      newCount: Math.max(attention?.new_count ?? 0, fallbackNewCount),
    };
  };

  const adminAttentionCountsForTabs = (tabKeys: AdminWorkspaceTab[]) =>
    tabKeys.reduce(
      (totals, tabKey) => {
        const counts = adminAttentionCountsForTab(tabKey);
        return {
          followupCount: totals.followupCount + counts.followupCount,
          newCount: totals.newCount + counts.newCount,
        };
      },
      { followupCount: 0, newCount: 0 }
    );

  const usersAdminNavItems: AdminNavItem<AdminWorkspaceTab>[] = [
    { key: "users", label: "User Activity" },
    {
      followupCount: earlyAccessIntakeFollowupCount,
      key: "intake",
      label: "Early Access Intake",
      newCount: earlyAccessIntakeNewCount,
    },
    { key: "userAudit", label: "Audit Trail" },
  ];
  const systemAdminNavItems: AdminNavItem<AdminWorkspaceTab>[] = [
    { ...adminAttentionCountsForTab("errors"), key: "errors", label: "Errors" },
    { key: "content", label: "Dynamic Text" },
    { ...adminAttentionCountsForTab("ai"), key: "ai", label: "AI Prompts" },
    { key: "product", label: "Prod Mgmt" },
  ];
  const supportAdminNavItems: AdminNavItem<AdminWorkspaceTab>[] = [
    { ...adminAttentionCountsForTab("askConsole"), key: "askConsole", label: "Ask" },
    { ...adminAttentionCountsForTab("helpReports"), key: "helpReports", label: "Help Reports" },
  ];
  const systemAdminAttentionCounts = adminAttentionCountsForTabs(systemAdminTabs);
  const supportAdminAttentionCounts =
    adminAttentionCountsForTabs(supportAdminTabs);
  const usersAdminAttentionCounts = adminAttentionCountsForTabs(usersAdminTabs);
  const adminDashboardNewCount = actionableAdminAttentionSummaries.reduce(
    (total, item) => total + (item.new_count ?? 0),
    0
  );
  const adminDashboardFollowupCount = actionableAdminAttentionSummaries.reduce(
    (total, item) => total + (item.followup_count ?? 0),
    0
  );
  const topAdminNavItems: AdminNavItem<AdminWorkspaceTopTab>[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "checkpoint", label: "Checkpoint" },
    { key: "connect", label: "Connect" },
    { key: "layout", label: "Layout" },
    { key: "workflows", label: "Workflow View" },
    { key: "recommendations", label: "Today's Focus" },
    { key: "tools", label: "Tools" },
    { ...usersAdminAttentionCounts, key: "users", label: "Users" },
    { ...systemAdminAttentionCounts, key: "system", label: "System" },
    { ...supportAdminAttentionCounts, key: "support", label: "Support" },
  ];
  const activeAdminTopTab: AdminWorkspaceTopTab = usersAdminTabs.includes(
    adminTab
  )
    ? "users"
    : systemAdminTabs.includes(adminTab)
      ? "system"
      : supportAdminTabs.includes(adminTab)
        ? "support"
        : adminTab === "workflows"
        ? "workflows"
        : adminTab === "checkpoint"
          ? "checkpoint"
        : adminTab === "recommendations"
          ? "recommendations"
          : adminTab === "connect"
          ? "connect"
          : adminTab === "layout"
            ? "layout"
            : adminTab === "dashboard"
              ? "dashboard"
              : "tools";
  const adminTabForTopTab = (
    topTab: AdminWorkspaceTopTab
  ): AdminWorkspaceTab => {
    if (topTab === "users") {
      return usersAdminTabs.includes(adminTab) ? adminTab : "users";
    }

    if (topTab === "system") {
      return systemAdminTabs.includes(adminTab) ? adminTab : "errors";
    }

    if (topTab === "support") {
      return supportAdminTabs.includes(adminTab) ? adminTab : "askConsole";
    }

    return topTab;
  };

  return {
    activeAdminTopTab,
    adminDashboardFollowupCount,
    adminDashboardNewCount,
    adminTabForTopTab,
    supportAdminNavItems,
    supportAdminTabs,
    systemAdminNavItems,
    systemAdminTabs,
    topAdminNavItems,
    usersAdminNavItems,
  };
}
