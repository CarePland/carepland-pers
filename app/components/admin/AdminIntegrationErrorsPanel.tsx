"use client";

export type AdminIntegrationErrorSummaryRow = {
  window_grain: "day" | "minute";
  window_start: string;
  integration_key: string;
  error_key: string;
  occurrence_count: number;
  affected_user_count: number;
  latest_occurred_at: string;
  max_attempted_call_count: number | null;
  latest_error_message: string | null;
};

type AdminIntegrationErrorStats = {
  affectedUsers: number;
  dayWindows: number;
  latestErrorAt: string | null;
  minuteWindows: number;
};

type AdminIntegrationErrorsPanelProps = {
  allSelected: boolean;
  deleting: boolean;
  formatAdminDate: (value: string | null) => string;
  lastViewedAt: string | null;
  loading: boolean;
  onDeleteSelected: () => void;
  onRefresh: () => void;
  onToggleAll: () => void;
  onToggleRow: (row: AdminIntegrationErrorSummaryRow) => void;
  rowKey: (row: AdminIntegrationErrorSummaryRow) => string;
  rows: AdminIntegrationErrorSummaryRow[];
  selectedKeys: string[];
  selectedVisibleCount: number;
  stats: AdminIntegrationErrorStats;
};

function isNewForAdmin(
  activityAt: string | null,
  lastViewedAt: string | null
) {
  if (!activityAt) {
    return false;
  }

  if (!lastViewedAt) {
    return true;
  }

  return new Date(activityAt).getTime() > new Date(lastViewedAt).getTime();
}

export function AdminIntegrationErrorsPanel({
  allSelected,
  deleting,
  formatAdminDate,
  lastViewedAt,
  loading,
  onDeleteSelected,
  onRefresh,
  onToggleAll,
  onToggleRow,
  rowKey,
  rows,
  selectedKeys,
  selectedVisibleCount,
  stats,
}: AdminIntegrationErrorsPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Integration errors</h2>
          <p className="mt-1 text-slate-600">
            Review rolled-up integration limit and availability events.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedVisibleCount > 0 ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              {selectedVisibleCount} selected
            </span>
          ) : null}
          <button
            className="rounded-md border border-red-200 bg-white px-4 py-2 font-semibold text-red-700 disabled:text-slate-400"
            disabled={deleting || selectedVisibleCount === 0}
            onClick={onDeleteSelected}
            type="button"
          >
            {deleting ? "Deleting..." : "Delete selected"}
          </button>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:text-slate-400"
            disabled={loading || deleting}
            onClick={onRefresh}
            type="button"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Minute windows", stats.minuteWindows],
          ["Day windows", stats.dayWindows],
          ["Affected users", stats.affectedUsers],
          [
            "Latest",
            stats.latestErrorAt ? formatAdminDate(stats.latestErrorAt) : "None",
          ],
        ].map(([label, value]) => (
          <div
            className="rounded-md border border-slate-200 bg-slate-50 p-3"
            key={label}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
        Google Places over-quota messages should be gentle for users: Looks like
        autocomplete for addresses isn&apos;t available right now. We&apos;ll
        look into it.
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
          No integration errors have been recorded yet.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="border-b border-slate-200 px-3 py-2">
                  <label className="flex items-center gap-2">
                    <input
                      checked={allSelected}
                      disabled={deleting}
                      onChange={onToggleAll}
                      type="checkbox"
                    />
                    Select
                  </label>
                </th>
                <th className="border-b border-slate-200 px-3 py-2">Window</th>
                <th className="border-b border-slate-200 px-3 py-2">
                  Integration
                </th>
                <th className="border-b border-slate-200 px-3 py-2">Error</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">
                  Hits
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">
                  Users
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">
                  Calls before error
                </th>
                <th className="border-b border-slate-200 px-3 py-2">Latest</th>
                <th className="border-b border-slate-200 px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = rowKey(row);
                const selected = selectedKeys.includes(key);
                const isNewToAdmin = isNewForAdmin(
                  row.latest_occurred_at,
                  lastViewedAt
                );

                return (
                  <tr key={key}>
                    <td className="border-b border-slate-100 px-3 py-3 align-top">
                      <input
                        aria-label={`Select ${row.integration_key} ${row.error_key} error row`}
                        checked={selected}
                        disabled={deleting}
                        onChange={() => onToggleRow(row)}
                        type="checkbox"
                      />
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        {row.window_grain}
                      </span>
                      <p className="mt-2 text-slate-700">
                        {formatAdminDate(row.window_start)}
                      </p>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top font-semibold text-slate-900">
                      <span>{row.integration_key.replaceAll("_", " ")}</span>
                      {isNewToAdmin ? (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          New to me
                        </span>
                      ) : (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Follow up
                        </span>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                      {row.error_key.replaceAll("_", " ")}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right align-top font-semibold text-slate-900">
                      {row.occurrence_count}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right align-top font-semibold text-slate-900">
                      {row.affected_user_count}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-right align-top text-slate-700">
                      {row.max_attempted_call_count ?? "Unknown"}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                      {formatAdminDate(row.latest_occurred_at)}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 align-top text-slate-700">
                      {row.latest_error_message || "No detail recorded"}
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
