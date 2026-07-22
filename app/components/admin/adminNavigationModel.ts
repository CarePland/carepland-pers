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

// Co-location, not a redesign: these five already existed as their own
// destinations (four top-level, one buried in System). This just groups
// them under one parent using the same list-plus-secondary-nav mechanism
// System/Support already use. No renaming, no reordering opinion, no new
// mechanism -- see CarePland_Admin_Redesign_SoloFounder.md on why this
// phase is deliberately about proving the grouping through real use
// before touching how the five relate to each other.
export const evaluateAdminTabs: AdminWorkspaceTab[] = [
  "checkpoint",
  "layout",
  "workflows",
  "recommendations",
  "ai",
];

export function createAdminNavigationModel({
  actionableAdminAttentionSummaries,
  adminTab,
}: AdminNavigationModelParams) {
  // Badges exist in exactly one place: Operate ("dashboard"). Everything
  // that used to badge System/Support/Users now has a real card on Operate
  // instead (see AdminDashboardPanel's "waiting on you" cards) -- Ask
  // threads, integration errors, Help Reports, and Early Access follow-ups
  // all moved there. The one exception was the "AI Prompts" badge, which
  // was never really about AI Prompts: it silently mirrored Agent Knowledge
  // Proposals awaiting review (see adminAttentionFor's admin_tab:"ai"
  // redirect in CarePlandPers.tsx). Reviewing an AI-drafted proposal isn't
  // something external is waiting on -- nobody's blocked if it sits for a
  // week -- so per the Operate/Evaluate split it doesn't belong badged at
  // all. It's still fully visible the moment you open AI Prompts; it just
  // doesn't compete for attention from outside that panel anymore.
  const usersAdminNavItems: AdminNavItem<AdminWorkspaceTab>[] = [
    { key: "users", label: "User Activity" },
    { key: "intake", label: "Early Access Intake" },
    { key: "userAudit", label: "Audit Trail" },
  ];
  const systemAdminNavItems: AdminNavItem<AdminWorkspaceTab>[] = [
    { key: "errors", label: "Errors" },
    { key: "content", label: "Dynamic Text" },
    { key: "product", label: "Prod Mgmt" },
  ];
  const supportAdminNavItems: AdminNavItem<AdminWorkspaceTab>[] = [
    { key: "askConsole", label: "Ask" },
    { key: "helpReports", label: "Help Reports" },
  ];
  const evaluateAdminNavItems: AdminNavItem<AdminWorkspaceTab>[] = [
    { key: "checkpoint", label: "Checkpoint" },
    { key: "layout", label: "Layout" },
    { key: "workflows", label: "Workflow View" },
    { key: "recommendations", label: "Today's Focus" },
    { key: "ai", label: "AI Prompts" },
  ];
  const adminDashboardNewCount = actionableAdminAttentionSummaries.reduce(
    (total, item) => total + (item.new_count ?? 0),
    0
  );
  const adminDashboardFollowupCount = actionableAdminAttentionSummaries.reduce(
    (total, item) => total + (item.followup_count ?? 0),
    0
  );
  const topAdminNavItems: AdminNavItem<AdminWorkspaceTopTab>[] = [
    // Label only, for now -- the internal key stays "dashboard" so this
    // stays a pure rename with no blast radius into adminTab routing,
    // isActionableAdminAttentionScope, or the workspace switch statement.
    { key: "dashboard", label: "Operate" },
    // Evaluate is now a real group, same mechanism as Users/System/Support
    // below -- five things that already existed, co-located under one
    // parent. See evaluateAdminTabs for what's in it and why this phase
    // stops at grouping rather than redesigning how they relate.
    { key: "evaluate", label: "Evaluate" },
    { key: "connect", label: "Connect" },
    { key: "tools", label: "Tools" },
    { key: "users", label: "Users" },
    { key: "system", label: "System" },
    { key: "support", label: "Support" },
  ];
  const activeAdminTopTab: AdminWorkspaceTopTab = usersAdminTabs.includes(
    adminTab
  )
    ? "users"
    : systemAdminTabs.includes(adminTab)
      ? "system"
      : supportAdminTabs.includes(adminTab)
        ? "support"
        : evaluateAdminTabs.includes(adminTab)
          ? "evaluate"
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
      return supportAdminTabs.includes(adminTab) ? adminTab : "askConsole";
    }

    if (topTab === "evaluate") {
      return evaluateAdminTabs.includes(adminTab) ? adminTab : "checkpoint";
    }

    return topTab;
  };

  return {
    activeAdminTopTab,
    adminDashboardFollowupCount,
    adminDashboardNewCount,
    adminTabForTopTab,
    evaluateAdminNavItems,
    evaluateAdminTabs,
    supportAdminNavItems,
    supportAdminTabs,
    systemAdminNavItems,
    systemAdminTabs,
    topAdminNavItems,
    usersAdminNavItems,
  };
}
