"use client";

import { FormEvent } from "react";

import { AppSessionSettings } from "../../lib/platform/sessionSettings";
import { AdminSessionSettingsPanel } from "./AdminSessionSettingsPanel";

type AdminSampleDataStatus = {
  status: string;
};

type AdminToolsPanelProps = {
  adminEmailUpdateCurrentEmail: string;
  adminEmailUpdateNewEmail: string;
  adminEmailUpdateReason: string;
  adminEmailUpdateResult: string;
  adminSampleEmail: string;
  adminSampleForceDeclined: boolean;
  adminSampleStatus: AdminSampleDataStatus | null;
  appSessionSettings: AppSessionSettings;
  loadingAdminSampleStatus: boolean;
  onChangeAdminEmailUpdateCurrentEmail: (value: string) => void;
  onChangeAdminEmailUpdateNewEmail: (value: string) => void;
  onChangeAdminEmailUpdateReason: (value: string) => void;
  onChangeAdminSampleEmail: (value: string) => void;
  onChangeAdminSampleForceDeclined: (value: boolean) => void;
  onChangeAppSessionSettings: (settings: AppSessionSettings) => void;
  onClearAdminEmailUpdateResult: () => void;
  onClearAdminSampleStatus: () => void;
  onLoadAdminSampleStatus: (event: FormEvent<HTMLFormElement>) => void;
  onSaveAppSessionSettings: (event: FormEvent<HTMLFormElement>) => void;
  onSeedAdminSampleData: () => void;
  onSubmitAdminUpdateUserEmail: (event: FormEvent<HTMLFormElement>) => void;
  sampleDataStatusText: (status: AdminSampleDataStatus | null) => string;
  savingAppSessionSettings: boolean;
  seedingAdminSampleData: boolean;
  updatingAdminUserEmail: boolean;
};

export function AdminToolsPanel({
  adminEmailUpdateCurrentEmail,
  adminEmailUpdateNewEmail,
  adminEmailUpdateReason,
  adminEmailUpdateResult,
  adminSampleEmail,
  adminSampleForceDeclined,
  adminSampleStatus,
  appSessionSettings,
  loadingAdminSampleStatus,
  onChangeAdminEmailUpdateCurrentEmail,
  onChangeAdminEmailUpdateNewEmail,
  onChangeAdminEmailUpdateReason,
  onChangeAdminSampleEmail,
  onChangeAdminSampleForceDeclined,
  onChangeAppSessionSettings,
  onClearAdminEmailUpdateResult,
  onClearAdminSampleStatus,
  onLoadAdminSampleStatus,
  onSaveAppSessionSettings,
  onSeedAdminSampleData,
  onSubmitAdminUpdateUserEmail,
  sampleDataStatusText,
  savingAppSessionSettings,
  seedingAdminSampleData,
  updatingAdminUserEmail,
}: AdminToolsPanelProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Admin tools</h2>
            <p className="mt-1 text-slate-600">
              Add sample data for Early Access users, update account emails, and
              review account setup state.
            </p>
          </div>
        </div>

        <form
          className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]"
          onSubmit={onSubmitAdminUpdateUserEmail}
        >
          <label className="block text-sm font-medium text-slate-700">
            Current email
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              onChange={(event) => {
                onChangeAdminEmailUpdateCurrentEmail(event.target.value);
                onClearAdminEmailUpdateResult();
              }}
              placeholder="alias@example.com"
              type="email"
              value={adminEmailUpdateCurrentEmail}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Replacement email
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              onChange={(event) => {
                onChangeAdminEmailUpdateNewEmail(event.target.value);
                onClearAdminEmailUpdateResult();
              }}
              placeholder="user@example.com"
              type="email"
              value={adminEmailUpdateNewEmail}
            />
          </label>
          <button
            className="self-end rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
            disabled={updatingAdminUserEmail}
            type="submit"
          >
            {updatingAdminUserEmail ? "Updating..." : "Update email"}
          </button>
          <label className="block text-sm font-medium text-slate-700 lg:col-span-3">
            Update justification
            <textarea
              className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              onChange={(event) => {
                onChangeAdminEmailUpdateReason(event.target.value);
                onClearAdminEmailUpdateResult();
              }}
              placeholder="Required before changing a login email."
              value={adminEmailUpdateReason}
            />
          </label>
        </form>

        {adminEmailUpdateResult ? (
          <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
            {adminEmailUpdateResult}
          </div>
        ) : null}
      </section>

      <AdminSessionSettingsPanel
        onChange={onChangeAppSessionSettings}
        onSave={onSaveAppSessionSettings}
        saving={savingAppSessionSettings}
        settings={appSessionSettings}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Sample data</h3>
        <p className="mt-1 text-sm text-slate-600">
          Check whether an Early Access user can receive demo examples.
        </p>

        <form
          className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]"
          onSubmit={onLoadAdminSampleStatus}
        >
          <label className="block text-sm font-medium text-slate-700">
            User email
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              onChange={(event) => {
                onChangeAdminSampleEmail(event.target.value);
                onClearAdminSampleStatus();
                onChangeAdminSampleForceDeclined(false);
              }}
              placeholder="tester@example.com"
              type="email"
              value={adminSampleEmail}
            />
          </label>
          <button
            className="self-end rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:text-slate-400"
            disabled={loadingAdminSampleStatus}
            type="submit"
          >
            {loadingAdminSampleStatus ? "Checking..." : "Check status"}
          </button>
        </form>

        <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
          {sampleDataStatusText(adminSampleStatus)}
        </div>

        {adminSampleStatus?.status === "declined" ? (
          <label className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <input
              checked={adminSampleForceDeclined}
              className="mt-1"
              onChange={(event) =>
                onChangeAdminSampleForceDeclined(event.target.checked)
              }
              type="checkbox"
            />
            <span>This user previously declined sample data. Add it anyway.</span>
          </label>
        ) : null}

        <button
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
          disabled={
            seedingAdminSampleData ||
            !adminSampleStatus ||
            adminSampleStatus.status === "already_seeded" ||
            adminSampleStatus.status === "no_profile" ||
            adminSampleStatus.status === "missing_care_circle" ||
            (adminSampleStatus.status === "declined" &&
              !adminSampleForceDeclined)
          }
          onClick={onSeedAdminSampleData}
          type="button"
        >
          {seedingAdminSampleData ? "Adding..." : "Add sample data"}
        </button>
      </section>
    </div>
  );
}
