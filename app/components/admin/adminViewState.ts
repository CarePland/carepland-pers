export type AdminViewScopeType = "admin_tab" | "ai_admin_tab" | "product_area";

export type AdminViewState = {
  admin_user_id: string;
  last_viewed_at: string;
  scope_key: string;
  scope_type: AdminViewScopeType;
  updated_at: string;
};

export type AdminAttentionSummary = {
  followup_count: number;
  latest_activity_at: string | null;
  new_count: number;
  scope_key: string;
  scope_type: AdminViewScopeType;
};

export function adminViewStateKey(
  scopeType: AdminViewScopeType,
  scopeKey: string
) {
  return `${scopeType}:${scopeKey}`;
}

export function isNewForAdmin(
  latestActivityAt: string | null,
  lastViewedAt: string | null
) {
  if (!latestActivityAt) {
    return false;
  }

  if (!lastViewedAt) {
    return true;
  }

  return new Date(latestActivityAt).getTime() > new Date(lastViewedAt).getTime();
}

export function isActionableAdminAttentionScope(
  scopeType: AdminViewScopeType,
  scopeKey: string
) {
  if (scopeType === "product_area") {
    return false;
  }

  if (scopeType === "ai_admin_tab") {
    return scopeKey === "proposals";
  }

  if (scopeType === "admin_tab") {
    return !["dashboard", "tools", "users", "content", "product"].includes(
      scopeKey
    );
  }

  return true;
}
