"use client";

type AdminDashboardPanelProps = {
  followupCount: number;
  newCount: number;
  onOpenPrioritizationPrompt: () => void;
  onRefreshSignals: () => void;
};

export function AdminDashboardPanel({
  followupCount,
  newCount,
  onOpenPrioritizationPrompt,
  onRefreshSignals,
}: AdminDashboardPanelProps) {
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
    </section>
  );
}
