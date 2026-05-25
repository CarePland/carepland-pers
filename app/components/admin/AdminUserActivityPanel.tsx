"use client";

type AdminUserActivityCareSubject = {
  display_name: string;
  id: string;
};

export type AdminUserActivityRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  care_subjects?: AdminUserActivityCareSubject[];
  user_group?: string | null;
  account_created_at: string | null;
  last_seen_at: string | null;
  appointment_count: number;
  upcoming_appointment_count: number;
  logged_appointment_count: number;
  note_count: number;
  careprep_count: number;
  support_ticket_count: number;
  open_support_ticket_count: number;
  last_appointment_created_at: string | null;
  last_appointment_starts_at: string | null;
  last_note_created_at: string | null;
  last_careprep_generated_at: string | null;
  last_support_ticket_at: string | null;
  is_admin: boolean;
  is_test_user: boolean;
};

export type AdminUserActivityFilter =
  | "active"
  | "all"
  | "inactive"
  | "needs_followup"
  | "real"
  | "test";

export type AdminUserActivitySortKey =
  | "appointments"
  | "careprep"
  | "created"
  | "flags"
  | "group"
  | "last_activity"
  | "last_seen"
  | "notes"
  | "tickets"
  | "user";

type AdminUserActivityStats = {
  activeRecently: number;
  needsFollowup: number;
  realUsers: number;
  totalUsers: number;
};

type AdminUserActivitySort = {
  direction: "asc" | "desc";
  key: AdminUserActivitySortKey;
};

type AdminUserActivityPanelProps = {
  activeReadonlyUserId: string | null;
  expandedCareVipRows: Record<string, boolean>;
  filter: AdminUserActivityFilter;
  filteredRows: AdminUserActivityRow[];
  formatAdminDate: (value: string | null) => string;
  loadingReadonlyUserId: string | null;
  onChangeFilter: (filter: AdminUserActivityFilter) => void;
  onOpenReadonlyUserView: (userId: string) => void;
  onToggleCareVips: (userId: string) => void;
  onToggleSort: (key: AdminUserActivitySortKey) => void;
  rows: AdminUserActivityRow[];
  sort: AdminUserActivitySort;
  stats: AdminUserActivityStats;
};

function adminUserActivityLastActivity(row: AdminUserActivityRow) {
  return (
    row.last_support_ticket_at ??
    row.last_careprep_generated_at ??
    row.last_note_created_at ??
    row.last_appointment_created_at ??
    row.last_seen_at
  );
}

export function AdminUserActivityPanel({
  activeReadonlyUserId,
  expandedCareVipRows,
  filter,
  filteredRows,
  formatAdminDate,
  loadingReadonlyUserId,
  onChangeFilter,
  onOpenReadonlyUserView,
  onToggleCareVips,
  onToggleSort,
  rows,
  sort,
  stats,
}: AdminUserActivityPanelProps) {
  const sortIndicator = (key: AdminUserActivitySortKey) => {
    if (sort.key !== key) {
      return "";
    }

    return sort.direction === "asc" ? " ↑" : " ↓";
  };

  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total users", stats.totalUsers],
          ["Real users", stats.realUsers],
          ["Active 14d", stats.activeRecently],
          ["Needs follow-up", stats.needsFollowup],
        ].map(([label, value]) => (
          <div
            className="rounded-md border border-slate-200 bg-slate-50 p-3"
            key={label}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm font-medium text-slate-700">
          View
          <select
            className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
            onChange={(event) =>
              onChangeFilter(event.target.value as AdminUserActivityFilter)
            }
            value={filter}
          >
            <option value="all">All users</option>
            <option value="real">Real users</option>
            <option value="test">Test/admin users</option>
            <option value="active">Active last 14 days</option>
            <option value="inactive">Inactive 14+ days</option>
            <option value="needs_followup">Needs follow-up</option>
          </select>
        </label>
        <p className="text-sm text-slate-500">
          Showing {filteredRows.length} of {rows.length}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
          No user activity loaded yet.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                {[
                  ["user", "User"],
                  ["group", "User Group"],
                  ["last_seen", "Last seen"],
                  ["created", "Created"],
                  ["appointments", "Appts"],
                  ["notes", "Notes"],
                  ["careprep", "CarePrep"],
                  ["tickets", "Tix"],
                  ["last_activity", "Last activity"],
                  ["flags", "Flags"],
                ].map(([key, label]) => {
                  const alignRight = [
                    "appointments",
                    "notes",
                    "careprep",
                    "tickets",
                  ].includes(key);

                  return (
                    <th
                      className={`border-b border-slate-200 px-3 py-2 ${
                        alignRight ? "text-right" : ""
                      }`}
                      key={key}
                    >
                      <button
                        className="font-semibold uppercase tracking-wide"
                        onClick={() =>
                          onToggleSort(key as AdminUserActivitySortKey)
                        }
                        type="button"
                      >
                        {label}
                        {sortIndicator(key as AdminUserActivitySortKey)}
                      </button>
                    </th>
                  );
                })}
                <th className="border-b border-slate-200 px-3 py-2">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const lastActivity = adminUserActivityLastActivity(row);
                const isReadonlyViewTarget = activeReadonlyUserId === row.user_id;
                const rowCareSubjects = row.care_subjects ?? [];
                const areCareVipsExpanded =
                  expandedCareVipRows[row.user_id] ?? false;

                return (
                  <tr
                    className={isReadonlyViewTarget ? "bg-blue-50" : undefined}
                    key={row.user_id}
                  >
                    <td className="border-b border-slate-100 px-3 py-3 align-top">
                      <p className="font-semibold text-slate-900">
                        {row.display_name || row.email || "Unknown user"}
                      </p>
                      <p className="break-all text-xs text-slate-500">
                        {row.email || row.user_id}
                      </p>
                      <button
                        className="mt-2 rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                        onClick={() => onToggleCareVips(row.user_id)}
                        type="button"
                      >
                        {areCareVipsExpanded ? "Hide VIPs" : "View VIPs"}
                      </button>
                      {areCareVipsExpanded ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {rowCareSubjects.length > 0 ? (
                            rowCareSubjects.map((subject) => (
                              <span
                                className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                                key={subject.id}
                              >
                                {subject.display_name}
                              </span>
                            ))
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                              No Care VIPs
                            </span>
                          )}
                        </div>
                      ) : null}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                      {row.user_group || "Unassigned"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                      {formatAdminDate(row.last_seen_at)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                      {formatAdminDate(row.account_created_at)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right align-top">
                      <span className="font-semibold text-slate-900">
                        {row.appointment_count}
                      </span>
                      <p className="text-xs text-slate-500">
                        {row.upcoming_appointment_count} upcoming /{" "}
                        {row.logged_appointment_count} logged
                      </p>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right align-top font-semibold text-slate-900">
                      {row.note_count}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right align-top font-semibold text-slate-900">
                      {row.careprep_count}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right align-top">
                      <span className="font-semibold text-slate-900">
                        {row.open_support_ticket_count}
                      </span>
                      <p className="text-xs text-slate-500">
                        {row.support_ticket_count} total
                      </p>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                      {formatAdminDate(lastActivity)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-1">
                        {row.is_admin ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                            Admin
                          </span>
                        ) : null}
                        {row.is_test_user ? (
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                            Test
                          </span>
                        ) : null}
                        {!row.is_test_user && row.appointment_count === 0 ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                            No appts
                          </span>
                        ) : null}
                        {!row.is_test_user &&
                        row.appointment_count > 0 &&
                        row.note_count === 0 ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                            No notes
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top">
                      <button
                        className={`rounded-md border px-3 py-1.5 text-xs font-semibold disabled:text-slate-400 ${
                          isReadonlyViewTarget
                            ? "border-blue-300 bg-blue-100 text-blue-800"
                            : "border-slate-300 text-slate-700"
                        }`}
                        disabled={loadingReadonlyUserId === row.user_id}
                        onClick={() => onOpenReadonlyUserView(row.user_id)}
                        type="button"
                      >
                        {loadingReadonlyUserId === row.user_id
                          ? "Loading..."
                          : isReadonlyViewTarget
                            ? "Viewing"
                            : "View as user"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
