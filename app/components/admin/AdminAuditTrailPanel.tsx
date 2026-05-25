"use client";

import { useCallback, useMemo, useState } from "react";
import { AdminNavGroup, AdminNavItem } from "./AdminAttention";

export type AdminAccessEventRow = {
  id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  permission_scope: string | null;
  reason: string | null;
  metadata: unknown;
  created_at: string;
};

type AdminAccessEventSortKey =
  | "actor"
  | "created"
  | "event"
  | "reason"
  | "target";

type AuditUserRow = {
  display_name: string | null;
  email: string | null;
  user_id: string;
};

type AdminAuditTrailPanelProps<TabKey extends string> = {
  activeKey: TabKey;
  formatAdminDate: (value: string | null) => string;
  loading: boolean;
  navItems: AdminNavItem<TabKey>[];
  onRefresh: () => void;
  onSelectTab: (tab: TabKey) => void;
  rows: AdminAccessEventRow[];
  shortId: (value: string | null) => string;
  userRows: AuditUserRow[];
};

function adminAccessEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    admin_contact_details_updated: "Contact details updated",
    admin_contact_details_viewed: "Contact details revealed",
    admin_readonly_view_opened: "User view opened",
    admin_sensitive_data_revealed: "Sensitive details revealed",
  };

  return labels[eventType] ?? eventType.replaceAll("_", " ");
}

function adminAccessEventChangedFields(metadata: unknown): string {
  if (
    !metadata ||
    typeof metadata !== "object" ||
    !("changed_fields" in metadata)
  ) {
    return "";
  }

  const changedFields = (metadata as { changed_fields?: unknown }).changed_fields;

  return Array.isArray(changedFields)
    ? changedFields.filter((field) => typeof field === "string").join(", ")
    : "";
}

function defaultAdminAccessEventVisible(eventType: string): boolean {
  return eventType !== "admin_readonly_view_opened";
}

export function AdminAuditTrailPanel<TabKey extends string>({
  activeKey,
  formatAdminDate,
  loading,
  navItems,
  onRefresh,
  onSelectTab,
  rows,
  shortId,
  userRows,
}: AdminAuditTrailPanelProps<TabKey>) {
  const [userFilter, setUserFilter] = useState("all");
  const [eventTypeFilters, setEventTypeFilters] = useState<
    Record<string, boolean>
  >({});
  const [sort, setSort] = useState<{
    direction: "asc" | "desc";
    key: AdminAccessEventSortKey;
  }>({
    direction: "desc",
    key: "created",
  });

  const userDisplayById = useMemo(() => {
    return new Map(
      userRows.map((row) => [
        row.user_id,
        row.display_name || row.email || `User ${shortId(row.user_id)}`,
      ])
    );
  }, [shortId, userRows]);
  const userLabel = useCallback((userId: string | null) => {
    if (!userId) {
      return "System";
    }

    return userDisplayById.get(userId) ?? `User ${shortId(userId)}`;
  }, [shortId, userDisplayById]);
  const userOptions = useMemo(() => {
    const userIds = new Set<string>();

    rows.forEach((eventRow) => {
      if (eventRow.actor_user_id) {
        userIds.add(eventRow.actor_user_id);
      }

      if (eventRow.target_user_id) {
        userIds.add(eventRow.target_user_id);
      }
    });

    return Array.from(userIds)
      .map((userId) => ({
        id: userId,
        label: userDisplayById.get(userId) ?? `User ${shortId(userId)}`,
      }))
      .sort((first, second) => first.label.localeCompare(second.label));
  }, [rows, shortId, userDisplayById]);
  const eventTypeOptions = useMemo(() => {
    const eventCounts = new Map<string, number>();

    rows.forEach((eventRow) => {
      eventCounts.set(
        eventRow.event_type,
        (eventCounts.get(eventRow.event_type) ?? 0) + 1
      );
    });

    return Array.from(eventCounts.entries())
      .map(([eventType, count]) => ({
        count,
        eventType,
        label: adminAccessEventLabel(eventType),
      }))
      .sort((first, second) => first.label.localeCompare(second.label));
  }, [rows]);
  const filteredRows = useMemo(() => {
    const visibleRows = rows.filter((eventRow) => {
      const isEventTypeVisible =
        eventTypeFilters[eventRow.event_type] ??
        defaultAdminAccessEventVisible(eventRow.event_type);
      const matchesUser =
        userFilter === "all" ||
        eventRow.actor_user_id === userFilter ||
        eventRow.target_user_id === userFilter;

      return isEventTypeVisible && matchesUser;
    });

    return [...visibleRows].sort((firstRow, secondRow) => {
      const direction = sort.direction === "asc" ? 1 : -1;
      const valueForSort = (row: AdminAccessEventRow) => {
        switch (sort.key) {
          case "actor":
            return userLabel(row.actor_user_id);
          case "event":
            return adminAccessEventLabel(row.event_type);
          case "reason":
            return row.reason ?? "";
          case "target":
            return userLabel(row.target_user_id);
          case "created":
          default:
            return row.created_at ?? "";
        }
      };

      return (
        String(valueForSort(firstRow)).localeCompare(
          String(valueForSort(secondRow))
        ) * direction
      );
    });
  }, [eventTypeFilters, rows, sort, userFilter, userLabel]);

  function toggleSort(key: AdminAccessEventSortKey) {
    setSort((currentSort) =>
      currentSort.key === key
        ? {
            direction: currentSort.direction === "asc" ? "desc" : "asc",
            key,
          }
        : {
            direction: key === "created" ? "desc" : "asc",
            key,
          }
    );
  }

  function sortIndicator(key: AdminAccessEventSortKey) {
    if (sort.key !== key) {
      return "";
    }

    return sort.direction === "asc" ? " ↑" : " ↓";
  }

  function toggleEventTypeFilter(eventType: string) {
    setEventTypeFilters((currentFilters) => ({
      ...currentFilters,
      [eventType]: !(
        currentFilters[eventType] ?? defaultAdminAccessEventVisible(eventType)
      ),
    }));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <AdminNavGroup
        activeKey={activeKey}
        items={navItems}
        onSelect={onSelectTab}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">User audit trail</h2>
          <p className="mt-1 max-w-3xl text-slate-600">
            Review audited admin user views, contact reveals, and contact detail
            updates.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:text-slate-400"
          disabled={loading}
          onClick={onRefresh}
          type="button"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm font-medium text-slate-700">
          User
          <select
            className="mt-2 min-w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
            onChange={(event) => setUserFilter(event.target.value)}
            value={userFilter}
          >
            <option value="all">All users</option>
            {userOptions.map((userOption) => (
              <option key={userOption.id} value={userOption.id}>
                {userOption.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-slate-500">
          Showing {filteredRows.length} of {rows.length}
        </p>
      </div>

      {eventTypeOptions.length > 0 ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Event type</p>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
              onClick={() => setEventTypeFilters({})}
              type="button"
            >
              Show all
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {eventTypeOptions.map((eventOption) => {
              const checked =
                eventTypeFilters[eventOption.eventType] ??
                defaultAdminAccessEventVisible(eventOption.eventType);

              return (
                <label
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                    checked
                      ? "border-blue-200 bg-blue-50 text-blue-800"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                  key={eventOption.eventType}
                >
                  <input
                    checked={checked}
                    className="h-4 w-4"
                    onChange={() =>
                      toggleEventTypeFilter(eventOption.eventType)
                    }
                    type="checkbox"
                  />
                  <span>{eventOption.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">
                    {eventOption.count}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
          No audit events loaded yet.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                {[
                  ["created", "When"],
                  ["event", "Event"],
                  ["target", "User"],
                  ["actor", "Admin"],
                  ["reason", "Reason"],
                ].map(([key, label]) => (
                  <th
                    className="border-b border-slate-200 px-3 py-2"
                    key={key}
                  >
                    <button
                      className="font-semibold uppercase tracking-wide"
                      onClick={() => toggleSort(key as AdminAccessEventSortKey)}
                      type="button"
                    >
                      {label}
                      {sortIndicator(key as AdminAccessEventSortKey)}
                    </button>
                  </th>
                ))}
                <th className="border-b border-slate-200 px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((eventRow) => {
                const changedFields = adminAccessEventChangedFields(
                  eventRow.metadata
                );

                return (
                  <tr key={eventRow.id}>
                    <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                      {formatAdminDate(eventRow.created_at)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top">
                      <p className="font-semibold text-slate-900">
                        {adminAccessEventLabel(eventRow.event_type)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {eventRow.resource_type || "admin event"}
                      </p>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top">
                      <p className="font-semibold text-slate-900">
                        {userLabel(eventRow.target_user_id)}
                      </p>
                      <p className="break-all text-xs text-slate-500">
                        {eventRow.target_user_id
                          ? shortId(eventRow.target_user_id)
                          : "No target"}
                      </p>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top">
                      <p className="font-semibold text-slate-900">
                        {userLabel(eventRow.actor_user_id)}
                      </p>
                      <p className="break-all text-xs text-slate-500">
                        {eventRow.actor_user_id
                          ? shortId(eventRow.actor_user_id)
                          : "System"}
                      </p>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                      {eventRow.reason || (
                        <span className="text-slate-400">
                          No reason recorded
                        </span>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                      <div className="flex flex-wrap gap-1">
                        {eventRow.permission_scope ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                            {eventRow.permission_scope}
                          </span>
                        ) : null}
                        {changedFields ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                            Changed: {changedFields}
                          </span>
                        ) : null}
                        {eventRow.resource_id ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                            ID {shortId(eventRow.resource_id)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
