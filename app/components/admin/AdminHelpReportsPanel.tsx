"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type HelpReportSummary = {
  adminNotes: string;
  assignedAdminUserId: string | null;
  browserSummary: string;
  buildIdentifier: string;
  currentRoute: string;
  derivedSummary: {
    errorCount?: number;
    failedRequestCount?: number;
    firstDetectedFailureAt?: string | null;
    hasFailedApiCalls?: boolean;
    hasFrontendErrors?: boolean;
    lastFailedEndpoint?: string | null;
    lastMeaningfulUserAction?: string | null;
    likelyCategory?: string;
    mostRecentExceptionMessage?: string | null;
    slowRequestCount?: number;
    warningCount?: number;
  };
  deviceSummary: string;
  eventsTimeline: Array<{
    at: string;
    detail: string;
    kind: "api" | "error" | "navigation" | "system" | "user" | "warning";
    title: string;
  }>;
  featureArea: string;
  firstReviewedAt: string | null;
  groupedLogs: Array<{
    count: number;
    firstAt: string;
    lastAt: string;
    level: string;
    message: string;
  }>;
  id: string;
  likelyCategory: string;
  packet: Record<string, unknown> | null;
  referenceId: string;
  resolutionCategory: string | null;
  resolvedAt: string | null;
  severity: string;
  status: string;
  submittedAt: string;
  submittedByUserId: string | null;
  updatedAt: string;
  user: string;
  userHappenedInstead: string;
  userTryingToDo: string;
};

const statusOptions = [
  "all",
  "new",
  "reviewing",
  "needs_follow_up",
  "resolved",
  "dismissed",
];

const resolutionOptions = [
  "",
  "code_defect",
  "deployment_configuration",
  "network_device",
  "session_authentication",
  "permission_access",
  "user_confusion",
  "expected_behavior",
  "duplicate",
  "insufficient_information",
  "other",
];

export function AdminHelpReportsPanel() {
  const [reports, setReports] = useState<HelpReportSummary[]>([]);
  const [selectedReport, setSelectedReport] = useState<HelpReportSummary | null>(
    null
  );
  const [status, setStatus] = useState("all");
  const [feature, setFeature] = useState("all");
  const [search, setSearch] = useState("");
  const [hasFrontendErrors, setHasFrontendErrors] = useState(false);
  const [hasFailedApiCalls, setHasFailedApiCalls] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [resolutionCategory, setResolutionCategory] = useState("");

  const featureOptions = useMemo(
    () => ["all", ...Array.from(new Set(reports.map((report) => report.featureArea))).sort()],
    [reports]
  );

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error("Sign in as an Admin before opening Help Reports.");
    }

    return { Authorization: `Bearer ${accessToken}` };
  }

  async function loadReports() {
    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams();
      params.set("status", status);
      params.set("feature", feature);
      if (search.trim()) params.set("search", search.trim());
      if (hasFrontendErrors) params.set("hasFrontendErrors", "true");
      if (hasFailedApiCalls) params.set("hasFailedApiCalls", "true");

      const response = await fetch(`/api/admin/help-reports?${params}`, {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const payload = (await response.json()) as {
        error?: string;
        reports?: HelpReportSummary[];
      };

      if (!response.ok) throw new Error(payload.error || "Help Reports could not load.");

      const nextReports = payload.reports ?? [];
      setReports(nextReports);

      if (selectedReport) {
        const stillSelected = nextReports.find((report) => report.id === selectedReport.id);
        setSelectedReport(stillSelected ?? nextReports[0] ?? null);
        if (stillSelected) await loadReportDetail(stillSelected.id);
      } else if (nextReports[0]) {
        await loadReportDetail(nextReports[0].id);
      } else {
        setSelectedReport(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Help Reports could not load.");
    } finally {
      setLoading(false);
    }
  }

  async function loadReportDetail(reportId: string) {
    const response = await fetch(`/api/admin/help-reports?id=${encodeURIComponent(reportId)}`, {
      cache: "no-store",
      headers: await authHeaders(),
    });
    const payload = (await response.json()) as {
      error?: string;
      report?: HelpReportSummary;
    };

    if (!response.ok || !payload.report) {
      throw new Error(payload.error || "Help report detail could not load.");
    }

    setSelectedReport(payload.report);
    setAdminNotes(payload.report.adminNotes);
    setResolutionCategory(payload.report.resolutionCategory ?? "");
  }

  async function updateReport(patch: {
    assignToMe?: boolean;
    status?: string;
  }) {
    if (!selectedReport) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/help-reports", {
        body: JSON.stringify({
          adminNotes,
          id: selectedReport.id,
          resolutionCategory: resolutionCategory || null,
          ...patch,
        }),
        cache: "no-store",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const payload = (await response.json()) as {
        error?: string;
        report?: HelpReportSummary;
      };

      if (!response.ok || !payload.report) {
        throw new Error(payload.error || "Help report could not update.");
      }

      setSelectedReport(payload.report);
      setAdminNotes(payload.report.adminNotes);
      setResolutionCategory(payload.report.resolutionCategory ?? "");
      setReports((current) =>
        current.map((report) =>
          report.id === payload.report?.id ? { ...report, ...payload.report } : report
        )
      );
      setMessage("Help report updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Help report could not update.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReports();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apiCalls = Array.isArray(selectedReport?.packet?.apiCalls)
    ? (selectedReport?.packet?.apiCalls as Array<Record<string, unknown>>)
    : [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Help Reports</h2>
          <p className="mt-1 text-slate-600">
            Review user-submitted diagnostics, triage likely failure signals, and track resolution.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          disabled={loading}
          onClick={() => void loadReports()}
          type="button"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-5">
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {humanize(option)}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2"
          onChange={(event) => setFeature(event.target.value)}
          value={feature}
        >
          {featureOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <input
          className="rounded-md border border-slate-300 bg-white px-3 py-2"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search reference or description"
          value={search}
        />
        <label className="flex items-center gap-2 rounded-md bg-white px-3 py-2">
          <input
            checked={hasFrontendErrors}
            onChange={(event) => setHasFrontendErrors(event.target.checked)}
            type="checkbox"
          />
          Frontend errors
        </label>
        <label className="flex items-center gap-2 rounded-md bg-white px-3 py-2">
          <input
            checked={hasFailedApiCalls}
            onChange={(event) => setHasFailedApiCalls(event.target.checked)}
            type="checkbox"
          />
          Failed API
        </label>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
          disabled={loading}
          onClick={() => void loadReports()}
          type="button"
        >
          Apply filters
        </button>
      </div>

      {message ? (
        <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="space-y-2">
          {reports.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
              No help reports match these filters.
            </div>
          ) : (
            reports.map((report) => (
              <button
                className={`w-full rounded-md border p-3 text-left transition ${
                  selectedReport?.id === report.id
                    ? "border-blue-300 bg-blue-50"
                    : report.status === "new"
                      ? "border-red-200 bg-red-50/60 hover:border-red-300"
                      : "border-slate-200 bg-white hover:border-blue-200"
                }`}
                key={report.id}
                onClick={() => void loadReportDetail(report.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-900">
                    {report.referenceId}
                  </span>
                  <StatusPill status={report.status} />
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {report.userTryingToDo || report.userHappenedInstead || "No user note"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {report.user} · {formatDate(report.submittedAt)}
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  {report.featureArea} · {report.likelyCategory}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {report.derivedSummary.errorCount ?? 0} errors ·{" "}
                  {report.derivedSummary.failedRequestCount ?? 0} failed API ·{" "}
                  {report.buildIdentifier || "unknown build"}
                </p>
              </button>
            ))
          )}
        </aside>

        {selectedReport ? (
          <article className="space-y-4 rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-mono text-xl font-semibold text-slate-900">
                  {selectedReport.referenceId}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedReport.user} · {formatDate(selectedReport.submittedAt)}
                </p>
              </div>
              <StatusPill status={selectedReport.status} />
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-4">
              <Metric label="Likely category" value={selectedReport.likelyCategory} />
              <Metric label="Route" value={selectedReport.currentRoute || "Unknown"} />
              <Metric label="Build" value={selectedReport.buildIdentifier || "Unknown"} />
              <Metric label="Device" value={selectedReport.deviceSummary || "Unknown"} />
            </div>

            <section className="grid gap-3 md:grid-cols-2">
              <SummaryBlock
                label="What the user was trying to do"
                value={selectedReport.userTryingToDo || "Not provided"}
              />
              <SummaryBlock
                label="What happened instead"
                value={selectedReport.userHappenedInstead || "Not provided"}
              />
            </section>

            <section className="rounded-md border border-slate-200 p-3">
              <h4 className="font-semibold text-slate-900">Overview</h4>
              <ul className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                <li>{selectedReport.derivedSummary.failedRequestCount ?? 0} failed API request(s)</li>
                <li>{selectedReport.derivedSummary.errorCount ?? 0} frontend error(s)</li>
                <li>{selectedReport.derivedSummary.warningCount ?? 0} warning(s)</li>
                <li>{selectedReport.derivedSummary.slowRequestCount ?? 0} slow request(s)</li>
                <li>Last action: {selectedReport.derivedSummary.lastMeaningfulUserAction || "Unknown"}</li>
                <li>Last failed endpoint: {selectedReport.derivedSummary.lastFailedEndpoint || "None"}</li>
              </ul>
            </section>

            <section className="rounded-md border border-slate-200 p-3">
              <h4 className="font-semibold text-slate-900">Admin workflow</h4>
              <div className="mt-3 flex flex-wrap gap-2">
                {["reviewing", "needs_follow_up", "resolved", "dismissed"].map(
                  (nextStatus) => (
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                      disabled={saving}
                      key={nextStatus}
                      onClick={() => void updateReport({ status: nextStatus })}
                      type="button"
                    >
                      Mark {humanize(nextStatus)}
                    </button>
                  )
                )}
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                  disabled={saving}
                  onClick={() => void updateReport({ assignToMe: true })}
                  type="button"
                >
                  Assign to me
                </button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_12rem]">
                <textarea
                  className="min-h-24 rounded-md border border-slate-300 p-3 text-sm"
                  onChange={(event) => setAdminNotes(event.target.value)}
                  placeholder="Internal notes"
                  value={adminNotes}
                />
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                  onChange={(event) => setResolutionCategory(event.target.value)}
                  value={resolutionCategory}
                >
                  {resolutionOptions.map((option) => (
                    <option key={option || "none"} value={option}>
                      {option ? humanize(option) : "No resolution"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                  disabled={saving}
                  onClick={() => void updateReport({})}
                  type="button"
                >
                  {saving ? "Saving..." : "Save notes"}
                </button>
              </div>
            </section>

            <section className="rounded-md border border-slate-200 p-3">
              <h4 className="font-semibold text-slate-900">Event timeline</h4>
              <div className="mt-3 space-y-2">
                {selectedReport.eventsTimeline.length === 0 ? (
                  <p className="text-sm text-slate-600">No timeline events were captured.</p>
                ) : (
                  selectedReport.eventsTimeline.map((item, index) => (
                    <div
                      className={`rounded-md border p-3 text-sm ${timelineClass(item.kind)}`}
                      key={`${item.at}-${item.title}-${index}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{item.title}</span>
                        <span className="text-xs opacity-75">{formatDate(item.at)}</span>
                      </div>
                      {item.detail ? <p className="mt-1 break-words">{item.detail}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-md border border-slate-200 p-3">
              <h4 className="font-semibold text-slate-900">API activity</h4>
              <div className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-100">
                {apiCalls.length === 0 ? (
                  <p className="p-3 text-sm text-slate-600">No API calls captured.</p>
                ) : (
                  apiCalls.map((call, index) => (
                    <div className="p-3 text-sm" key={`${call.url}-${index}`}>
                      <p className="font-semibold text-slate-800">
                        {String(call.method || "GET")} {String(call.url || "")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        status {String(call.status || call.error || "unknown")} ·{" "}
                        {String(call.durationMs || "?")}ms · {formatDate(String(call.at || ""))}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-md border border-slate-200 p-3">
              <h4 className="font-semibold text-slate-900">Errors and console activity</h4>
              <div className="mt-3 space-y-2">
                {selectedReport.groupedLogs.length === 0 ? (
                  <p className="text-sm text-slate-600">No console activity captured.</p>
                ) : (
                  selectedReport.groupedLogs.map((log) => (
                    <div className="rounded-md bg-slate-50 p-3 text-sm" key={`${log.level}-${log.message}`}>
                      <p className="font-semibold text-slate-800">
                        {log.level} {log.count > 1 ? `x${log.count}` : ""}
                      </p>
                      <p className="mt-1 break-words text-slate-600">{log.message}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-md border border-slate-200 p-3">
              <h4 className="font-semibold text-slate-900">Current screen snapshot</h4>
              <p className="mt-2 max-h-48 overflow-auto rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                {String((selectedReport.packet?.screen as Record<string, unknown> | undefined)?.visibleText || "No screen text captured.")}
              </p>
            </section>

            <section className="rounded-md border border-slate-200 p-3">
              <h4 className="font-semibold text-slate-900">Environment</h4>
              <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <Metric label="Browser" value={selectedReport.browserSummary || "Unknown"} />
                <Metric label="Device" value={selectedReport.deviceSummary || "Unknown"} />
                <Metric label="Packet version" value={String(selectedReport.packet?.version || "Unknown")} />
                <Metric label="Session" value={String((selectedReport.packet?.session as Record<string, unknown> | undefined)?.visibilityState || "Unknown")} />
              </dl>
            </section>

            <details className="rounded-md border border-slate-200 p-3">
              <summary className="cursor-pointer font-semibold text-slate-900">
                Raw packet
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-50">
                {JSON.stringify(selectedReport.packet, null, 2)}
              </pre>
            </details>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold uppercase text-slate-700">
      {humanize(status)}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-slate-700">{value}</dd>
    </div>
  );
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm text-slate-700">{value}</p>
    </div>
  );
}

function timelineClass(kind: string) {
  if (kind === "error") return "border-red-200 bg-red-50 text-red-900";
  if (kind === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  if (kind === "user") return "border-blue-200 bg-blue-50 text-blue-950";
  if (kind === "navigation") return "border-slate-200 bg-slate-50 text-slate-800";
  return "border-emerald-100 bg-emerald-50 text-emerald-950";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function humanize(value: string) {
  return value.replace(/_/g, " ");
}
