"use client";

import { ComponentProps } from "react";

import { AdminNavGroup, type AdminNavItem } from "./AdminAttention";
import { AdminReadonlyUserPanel } from "./AdminReadonlyUserPanel";
import {
  AdminUserActivityPanel,
  type AdminUserActivityFilter,
  type AdminUserActivityRow,
  type AdminUserActivitySortKey,
} from "./AdminUserActivityPanel";

type AdminReadonlyUserPanelProps = ComponentProps<typeof AdminReadonlyUserPanel>;
type AdminUserActivityPanelProps = ComponentProps<typeof AdminUserActivityPanel>;

type AdminUsersPanelProps<TabKey extends string> = {
  activeKey: TabKey;
  adminReadonlySnapshot: AdminReadonlyUserPanelProps["snapshot"] | null;
  adminRevealedSensitiveData: AdminReadonlyUserPanelProps["revealedData"];
  adminReadonlyPanelRef: AdminReadonlyUserPanelProps["panelRef"];
  adminUserActivity: AdminUserActivityRow[];
  adminUserActivityFilter: AdminUserActivityFilter;
  adminUserActivitySort: AdminUserActivityPanelProps["sort"];
  adminUserActivityStats: AdminUserActivityPanelProps["stats"];
  closeAdminReadonlyUserView: () => void;
  expandedAdminUserCareVipRows: Record<string, boolean>;
  filteredAdminUserActivity: AdminUserActivityRow[];
  formatAdminDate: (value: string | null) => string;
  formatDate: (value: string | null) => string;
  formatDateOnly: (value: string | null) => string;
  loadingAdminUserActivity: boolean;
  loadingAdminReadonlyUserId: string | null;
  navItems: AdminNavItem<TabKey>[];
  onRefresh: () => void;
  onSelectTab: (tab: TabKey) => void;
  onSetUserAdmin: AdminUserActivityPanelProps["onSetUserAdmin"];
  openAdminReadonlyUserView: (userId: string) => void;
  revealAdminSensitiveData: AdminReadonlyUserPanelProps["onReveal"];
  revealingAdminSensitiveKey: string | null;
  saveAdminContactDetails: AdminReadonlyUserPanelProps["onSaveContactDetails"];
  savingAdminContactDetails: boolean;
  setAdminUserActivityFilter: (filter: AdminUserActivityFilter) => void;
  setExpandedAdminUserCareVipRows: (
    updater: (currentRows: Record<string, boolean>) => Record<string, boolean>
  ) => void;
  shortId: (value: string | null) => string;
  toggleAdminUserActivitySort: (key: AdminUserActivitySortKey) => void;
};

export function AdminUsersPanel<TabKey extends string>({
  activeKey,
  adminReadonlyPanelRef,
  adminReadonlySnapshot,
  adminRevealedSensitiveData,
  adminUserActivity,
  adminUserActivityFilter,
  adminUserActivitySort,
  adminUserActivityStats,
  closeAdminReadonlyUserView,
  expandedAdminUserCareVipRows,
  filteredAdminUserActivity,
  formatAdminDate,
  formatDate,
  formatDateOnly,
  loadingAdminReadonlyUserId,
  loadingAdminUserActivity,
  navItems,
  onRefresh,
  onSelectTab,
  onSetUserAdmin,
  openAdminReadonlyUserView,
  revealAdminSensitiveData,
  revealingAdminSensitiveKey,
  saveAdminContactDetails,
  savingAdminContactDetails,
  setAdminUserActivityFilter,
  setExpandedAdminUserCareVipRows,
  shortId,
  toggleAdminUserActivitySort,
}: AdminUsersPanelProps<TabKey>) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <AdminNavGroup activeKey={activeKey} items={navItems} onSelect={onSelectTab} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Users / activity</h2>
          <p className="mt-1 text-slate-600">
            Review account presence, product usage, and follow-up signals for
            beta operations.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:text-slate-400"
          disabled={loadingAdminUserActivity}
          onClick={onRefresh}
          type="button"
        >
          {loadingAdminUserActivity ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {adminReadonlySnapshot ? (
        <AdminReadonlyUserPanel
          formatAdminDate={formatAdminDate}
          formatDate={formatDate}
          formatDateOnly={formatDateOnly}
          onClose={closeAdminReadonlyUserView}
          onReveal={revealAdminSensitiveData}
          onSaveContactDetails={saveAdminContactDetails}
          panelRef={adminReadonlyPanelRef}
          revealedData={adminRevealedSensitiveData}
          revealingKey={revealingAdminSensitiveKey}
          savingContactDetails={savingAdminContactDetails}
          shortId={shortId}
          snapshot={adminReadonlySnapshot}
        />
      ) : null}

      <AdminUserActivityPanel
        activeReadonlyUserId={adminReadonlySnapshot?.profile.id ?? null}
        expandedCareVipRows={expandedAdminUserCareVipRows}
        filter={adminUserActivityFilter}
        filteredRows={filteredAdminUserActivity}
        formatAdminDate={formatAdminDate}
        loadingReadonlyUserId={loadingAdminReadonlyUserId}
        onChangeFilter={setAdminUserActivityFilter}
        onOpenReadonlyUserView={openAdminReadonlyUserView}
        onSetUserAdmin={onSetUserAdmin}
        onToggleCareVips={(userId) =>
          setExpandedAdminUserCareVipRows((currentRows) => ({
            ...currentRows,
            [userId]: !currentRows[userId],
          }))
        }
        onToggleSort={toggleAdminUserActivitySort}
        rows={adminUserActivity}
        sort={adminUserActivitySort}
        stats={adminUserActivityStats}
      />
    </section>
  );
}
