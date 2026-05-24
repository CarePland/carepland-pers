"use client";

import { FormEvent } from "react";

import {
  AppSessionSettings,
  normalizeIdleTimeoutHours,
} from "../../lib/sessionSettings";

type AdminSessionSettingsPanelProps = {
  onChange: (settings: AppSessionSettings) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  settings: AppSessionSettings;
};

export function AdminSessionSettingsPanel({
  onChange,
  onSave,
  saving,
  settings,
}: AdminSessionSettingsPanelProps) {
  const userHasNoLimit = settings.user_idle_timeout_hours === null;
  const adminHasNoLimit = settings.admin_idle_timeout_hours === null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Session timeout
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Control automatic sign-out after no browser activity. Blank means no
            limit.
          </p>
        </div>
        {settings.updated_at ? (
          <p className="text-xs text-slate-500">
            Updated {new Date(settings.updated_at).toLocaleString()}
          </p>
        ) : null}
      </div>

      <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={onSave}>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <label className="block text-sm font-medium text-slate-700">
            User idle timeout
            <span className="mt-2 flex items-center gap-2">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base disabled:bg-slate-100 disabled:text-slate-500"
                disabled={userHasNoLimit}
                min={1}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    user_idle_timeout_hours: normalizeIdleTimeoutHours(
                      event.target.value
                    ),
                  })
                }
                placeholder="24"
                type="number"
                value={settings.user_idle_timeout_hours ?? ""}
              />
              <span className="shrink-0 text-sm font-normal text-slate-500">
                hours
              </span>
            </span>
          </label>
          <label className="mt-3 flex gap-3 text-sm text-slate-700">
            <input
              checked={userHasNoLimit}
              className="mt-1"
              onChange={(event) =>
                onChange({
                  ...settings,
                  user_idle_timeout_hours: event.target.checked ? null : 24,
                })
              }
              type="checkbox"
            />
            <span>No timeout for normal users</span>
          </label>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <label className="block text-sm font-medium text-slate-700">
            Admin idle timeout
            <span className="mt-2 flex items-center gap-2">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base disabled:bg-slate-100 disabled:text-slate-500"
                disabled={adminHasNoLimit}
                min={1}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    admin_idle_timeout_hours: normalizeIdleTimeoutHours(
                      event.target.value
                    ),
                  })
                }
                placeholder="No limit"
                type="number"
                value={settings.admin_idle_timeout_hours ?? ""}
              />
              <span className="shrink-0 text-sm font-normal text-slate-500">
                hours
              </span>
            </span>
          </label>
          <label className="mt-3 flex gap-3 text-sm text-slate-700">
            <input
              checked={adminHasNoLimit}
              className="mt-1"
              onChange={(event) =>
                onChange({
                  ...settings,
                  admin_idle_timeout_hours: event.target.checked ? null : 24,
                })
              }
              type="checkbox"
            />
            <span>No timeout for admins</span>
          </label>
        </div>

        <div className="lg:col-span-2">
          <button
            className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
            disabled={saving}
            type="submit"
          >
            {saving ? "Saving..." : "Save session settings"}
          </button>
        </div>
      </form>
    </section>
  );
}
