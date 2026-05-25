"use client";

export type AiOperationCostSummaryRow = {
  cached_input_tokens: number | string | null;
  call_count: number | string | null;
  estimated_cost_usd: number | string | null;
  input_tokens: number | string | null;
  model: string | null;
  operation_key: string | null;
  output_tokens: number | string | null;
  total_tokens: number | string | null;
};

type AdminDashboardPanelProps = {
  aiOperationCostRows: AiOperationCostSummaryRow[];
  aiOperationCostError: string;
  followupCount: number;
  loadingAiOperationCosts: boolean;
  newCount: number;
  onOpenPrioritizationPrompt: () => void;
  onRefreshSignals: () => void;
};

function formatCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 4,
    minimumFractionDigits: 4,
    style: "currency",
  }).format(value);
}

function readableOperationKey(value: string | null): string {
  if (!value) {
    return "Unknown operation";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AdminDashboardPanel({
  aiOperationCostError,
  aiOperationCostRows,
  followupCount,
  loadingAiOperationCosts,
  newCount,
  onOpenPrioritizationPrompt,
  onRefreshSignals,
}: AdminDashboardPanelProps) {
  const totalAiCalls = aiOperationCostRows.reduce(
    (total, row) => total + Number(row.call_count ?? 0),
    0
  );
  const totalAiCost = aiOperationCostRows.reduce(
    (total, row) => total + Number(row.estimated_cost_usd ?? 0),
    0
  );
  const topAiCostRows = aiOperationCostRows.slice(0, 5);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Admin dashboard</h2>
          <p className="mt-1 text-slate-600">
            Read-only home for prioritized Admin HQ signals. The first version
            will summarize what deserves attention first and link back into the
            existing Admin tabs.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          onClick={onRefreshSignals}
          type="button"
        >
          Refresh signals
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-950">New / unseen</p>
          <p className="mt-2 text-3xl font-semibold text-red-700">{newCount}</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">Follow-up</p>
          <p className="mt-2 text-3xl font-semibold text-amber-800">
            {followupCount}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            Prompt workflow
          </p>
          <button
            className="mt-2 text-left text-sm font-semibold text-blue-700 hover:text-blue-900"
            onClick={onOpenPrioritizationPrompt}
            type="button"
          >
            Open Admin HQ prioritization prompt
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        Admin HQ is currently a read-only placeholder. Next step is to feed
        Admin-safe signals into the prioritization prompt and show a ranked brief
        here.
      </div>

      <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              AI operation cost
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Estimated OpenAI usage cost from the last 30 days, grouped by
              workflow and model.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-950">
              {formatCost(totalAiCost)}
            </p>
            <p className="text-sm text-slate-600">
              {loadingAiOperationCosts ? "Refreshing..." : `${totalAiCalls} calls`}
            </p>
          </div>
        </div>

        {aiOperationCostError ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
            {aiOperationCostError}
          </p>
        ) : topAiCostRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Workflow</th>
                  <th className="py-2 pr-4 font-semibold">Model</th>
                  <th className="py-2 pr-4 font-semibold">Calls</th>
                  <th className="py-2 text-right font-semibold">Est. cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {topAiCostRows.map((row) => (
                  <tr key={`${row.operation_key ?? "unknown"}-${row.model ?? "model"}`}>
                    <td className="py-2 pr-4 font-medium text-slate-900">
                      {readableOperationKey(row.operation_key)}
                    </td>
                    <td className="py-2 pr-4">{row.model ?? "Unknown"}</td>
                    <td className="py-2 pr-4">
                      {Number(row.call_count ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      {formatCost(Number(row.estimated_cost_usd ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            No AI operation cost logs yet.
          </p>
        )}
      </div>
    </section>
  );
}
