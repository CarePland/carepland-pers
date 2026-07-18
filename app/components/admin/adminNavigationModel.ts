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

type AssistantReviewInteractionLike = {
  created_at: string | null;
  id: string;
  updated_at: string | null;
};

type AssistantAdminReviewLike = {
  interaction_id: string;
};

type AdminNavigationModelParams = {
  actionableAdminAttentionSummaries: AdminAttentionSummaryLike[];
  adminAttentionFor: (
    scopeType: AdminViewScopeType,
    scopeKey: string
  ) => AdminAttentionSummaryLike | null | undefined;
  adminIntegrationErrors: IntegrationErrorLike[];
  adminLastViewedAt: (
    scopeType: AdminViewScopeType,
    scopeKey: string
  ) => string | null;
  adminNewTicketsLength: number;
  adminTab: AdminWorkspaceTab;
  adminTicketsNeedingFollowupLength: number;
  assistantReviewAdminReviews: AssistantAdminReviewLike[];
  assistantReviewInteractions: AssistantReviewInteractionLike[];
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
  "assistantReview",
  "tickets",
  "helpReports",
];

export const usersAdminTabs: AdminWorkspaceTab[] = [
  "users",
  "intake",
  "userAudit",
];

export function createAdminNavigationModel({
  actionableAdminAttentionSummaries,
  adminAttentionFor,
  adminIntegrationErrors,
  adminLastViewedAt,
  adminNewTicketsLength,
  adminTab,
  adminTicketsNeedingFollowupLength,
  assistantReviewAdminReviews,
  assistantReviewInteractions,
  earlyAccessIntakeFollowupCount,
  earlyAccessIntakeNewCount,
  isNewForAdmin,
}: AdminNavigationModelParams) {
  const adminAttentionCountsForTab = (tabKey: AdminWorkspaceTab) => {
    const attention = adminAttentionFor("admin_tab", tabKey);
    let fallbackNewCount = 0;
    let fallbackFollowupCount = 0;

    if (tabKey === "tickets") {
      fallbackNewCount = adminNewTicketsLength;
      fallbackFollowupCount = adminTicketsNeedingFollowupLength;
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
    } else if (tabKey === "assistantReview") {
      fallbackNewCount = assistantReviewInteractions.filter((interaction) =>
        isNewForAdmin(
          interaction.updated_at || interaction.created_at,
          adminLastViewedAt("admin_tab", "assistantReview")
        )
      ).length;
      fallbackFollowupCount = assistantReviewInteractions.filter(
        (interaction) =>
          !assistantReviewAdminReviews.some(
            (review) => review.interaction_id === interaction.id
          )
      ).length;
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
    {
      ...adminAttentionCountsForTab("assistantReview"),
      key: "assistantReview",
      label: "Ask - Review",
    },
    { ...adminAttentionCountsForTab("tickets"), key: "tickets", label: "Tickets" },
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
      return supportAdminTabs.includes(adminTab) ? adminTab : "assistantReview";
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
