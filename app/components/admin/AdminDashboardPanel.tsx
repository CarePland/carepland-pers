"use client";

import { useEffect, useState } from "react";

import {
  platformModuleVisibilityOverrideChangedEvent,
  readShowAllPlatformModulesOverride,
  writeShowAllPlatformModulesOverride,
} from "../../lib/platform/moduleAccess";

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

export type AiOperationCostUserSummaryRow = {
  call_count: number;
  estimated_cost_usd: number;
  total_tokens: number;
  user_id: string | null;
  user_label: string;
};

export type AiOperationCostViewMode = "user" | "workflow";

type AdminDashboardPanelProps = {
  aiOperationCostRows: AiOperationCostSummaryRow[];
  aiOperationCostError: string;
  aiOperationCostRangeDays: number;
  aiOperationCostUserRows: AiOperationCostUserSummaryRow[];
  aiOperationCostViewMode: AiOperationCostViewMode;
  followupCount: number;
  loadingAiOperationCosts: boolean;
  newCount: number;
  onChangeAiOperationCostRange: (rangeDays: number) => void;
  onChangeAiOperationCostViewMode: (viewMode: AiOperationCostViewMode) => void;
  onOpenPrioritizationPrompt: () => void;
  onRefreshSignals: () => void;
};

const aiOperationCostRangeOptions = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "1 year", value: 365 },
];

const aiOperationCostViewOptions: Array<{
  label: string;
  value: AiOperationCostViewMode;
}> = [
  { label: "By workflow", value: "workflow" },
  { label: "By user", value: "user" },
];

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
  aiOperationCostRangeDays,
  aiOperationCostRows,
  aiOperationCostUserRows,
  aiOperationCostViewMode,
  followupCount,
  loadingAiOperationCosts,
  newCount,
  onChangeAiOperationCostRange,
  onChangeAiOperationCostViewMode,
  onOpenPrioritizationPrompt,
  onRefreshSignals,
}: AdminDashboardPanelProps) {
  const [showAllPlatformModules, setShowAllPlatformModules] = useState(false);
  const visibleAiCostRows =
    aiOperationCostViewMode === "user"
      ? aiOperationCostUserRows
      : aiOperationCostRows;
  const totalAiCalls = visibleAiCostRows.reduce(
    (total, row) => total + Number(row.call_count ?? 0),
    0
  );
  const totalAiCost = visibleAiCostRows.reduce(
    (total, row) => total + Number(row.estimated_cost_usd ?? 0),
    0
  );
  const topAiCostRows = aiOperationCostRows.slice(0, 5);
  const topAiCostUserRows = aiOperationCostUserRows.slice(0, 5);

  useEffect(() => {
    function syncShowAllPlatformModules() {
      setShowAllPlatformModules(readShowAllPlatformModulesOverride());
    }

    syncShowAllPlatformModules();
    window.addEventListener(
      platformModuleVisibilityOverrideChangedEvent,
      syncShowAllPlatformModules
    );
    window.addEventListener("storage", syncShowAllPlatformModules);

    return () => {
      window.removeEventListener(
        platformModuleVisibilityOverrideChangedEvent,
        syncShowAllPlatformModules
      );
      window.removeEventListener("storage", syncShowAllPlatformModules);
    };
  }, []);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(13rem,1fr)_auto]">
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
        <div className="flex flex-wrap items-center justify-end gap-3 lg:flex-nowrap">
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={onRefreshSignals}
            type="button"
          >
            Refresh signals
          </button>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              Show All Top Nav
            </p>
            <button
              aria-pressed={showAllPlatformModules}
              className={`inline-flex min-w-14 items-center justify-center rounded-full border px-3 py-1 text-xs font-bold transition ${
                showAllPlatformModules
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
              onClick={() =>
                writeShowAllPlatformModulesOverride(!showAllPlatformModules)
              }
              type="button"
            >
              {showAllPlatformModules ? "ON" : "OFF"}
            </button>
          </div>
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
              Estimated OpenAI usage cost by selected date range.
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

        <fieldset className="mt-4 flex flex-wrap items-center gap-3">
          <legend className="sr-only">AI operation cost date range</legend>
          {aiOperationCostRangeOptions.map((option) => (
            <label
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              key={option.value}
            >
              <input
                checked={aiOperationCostRangeDays === option.value}
                className="h-4 w-4 border-slate-300 text-blue-700 focus:ring-blue-500"
                name="ai-operation-cost-range"
                onChange={() => onChangeAiOperationCostRange(option.value)}
                type="radio"
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        <fieldset className="mt-3 flex flex-wrap items-center gap-3">
          <legend className="sr-only">AI operation cost grouping</legend>
          {aiOperationCostViewOptions.map((option) => (
            <label
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              key={option.value}
            >
              <input
                checked={aiOperationCostViewMode === option.value}
                className="h-4 w-4 border-slate-300 text-blue-700 focus:ring-blue-500"
                name="ai-operation-cost-view"
                onChange={() => onChangeAiOperationCostViewMode(option.value)}
                type="radio"
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        {aiOperationCostError ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
            {aiOperationCostError}
          </p>
        ) : aiOperationCostViewMode === "user" && topAiCostUserRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">User</th>
                  <th className="py-2 pr-4 font-semibold">Calls</th>
                  <th className="py-2 pr-4 font-semibold">Tokens</th>
                  <th className="py-2 text-right font-semibold">Est. cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {topAiCostUserRows.map((row) => (
                  <tr key={row.user_id ?? "unknown-user"}>
                    <td className="py-2 pr-4 font-medium text-slate-900">
                      {row.user_label}
                    </td>
                    <td className="py-2 pr-4">
                      {Number(row.call_count ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      {Number(row.total_tokens ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      {formatCost(Number(row.estimated_cost_usd ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : aiOperationCostViewMode === "workflow" && topAiCostRows.length > 0 ? (
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
