"use client";

import { useState } from "react";
import { browserSupabase as supabase } from "../../lib/platform/browserSupabase";

type DataHealthFinding = {
  checkKey: string;
  description: string;
  email?: string | null;
  id: string;
  repairable: boolean;
  severity: "info" | "warn" | "error";
  title: string;
};

type DataHealthResult = {
  checkedAt: string;
  error?: string;
  findings: DataHealthFinding[];
  repairedCount?: number;
  summary: {
    errorCount: number;
    repairableCount: number;
    totalFindings: number;
    warnCount: number;
  };
};

export function AdminDataHealthPanel() {
  const [result, setResult] = useState<DataHealthResult | null>(null);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const [repairing, setRepairing] = useState(false);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new Error("Sign in as an Admin before running Data Health.");
    }

    return { Authorization: `Bearer ${accessToken}` };
  }

  async function runDataHealth() {
    setRunning(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/data-health", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const payload = (await response.json()) as DataHealthResult;

      if (!response.ok) {
        throw new Error(payload.error || "Data Health could not run.");
      }

      setResult(payload);
      setStatus(
        payload.summary.totalFindings
          ? `Found ${payload.summary.totalFindings} data health issue(s).`
          : "No data health issues found."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Data Health could not run.");
    } finally {
      setRunning(false);
    }
  }

  async function repairOnboardingAgreementState() {
    setRepairing(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/data-health", {
        body: JSON.stringify({ action: "repair_onboarding_beta_ack" }),
        cache: "no-store",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as DataHealthResult;

      if (!response.ok) {
        throw new Error(payload.error || "Data Health repair could not run.");
      }

      setResult(payload);
      setStatus(`Repaired ${payload.repairedCount ?? 0} profile(s).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Data Health repair could not run.");
    } finally {
      setRepairing(false);
    }
  }

  const repairableOnboardingFindings =
    result?.findings.filter(
      (finding) =>
        finding.checkKey === "profile_onboarding_complete_missing_beta_ack" &&
        finding.repairable
    ) ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Data Health</h3>
          <p className="mt-1 text-sm text-slate-600">
            Check for account and setup state mismatches that can block normal app use.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
            disabled={running || repairing}
            onClick={runDataHealth}
            type="button"
          >
            {running ? "Checking..." : "Run checks"}
          </button>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:text-slate-400"
            disabled={repairing || repairableOnboardingFindings.length === 0}
            onClick={repairOnboardingAgreementState}
            type="button"
          >
            {repairing ? "Repairing..." : "Repair safe issues"}
          </button>
        </div>
      </div>

      {status ? (
        <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
          {status}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <DataHealthMetric label="Total" value={result.summary.totalFindings} />
            <DataHealthMetric label="Errors" value={result.summary.errorCount} />
            <DataHealthMetric label="Warnings" value={result.summary.warnCount} />
            <DataHealthMetric label="Repairable" value={result.summary.repairableCount} />
          </div>
          {result.findings.length ? (
            <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
              {result.findings.map((finding) => (
                <div className="p-3" key={`${finding.checkKey}-${finding.id}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                        finding.severity === "error"
                          ? "bg-red-100 text-red-700"
                          : finding.severity === "warn"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {finding.severity}
                    </span>
                    {finding.repairable ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold uppercase text-emerald-700">
                        safe repair
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 font-semibold text-slate-900">{finding.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{finding.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {finding.email || "No email"} · {finding.checkKey}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DataHealthMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
