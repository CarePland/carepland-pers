"use client";

import { Dispatch, FormEvent, SetStateAction } from "react";
import { AdminNavGroup, AdminNavItem } from "./AdminAttention";

export type EarlyAccessIntakeStatus =
  | "closed"
  | "contacted"
  | "converted"
  | "interested"
  | "invited"
  | "new"
  | "not_a_fit"
  | "reviewing";

export type EarlyAccessIntakeRow = {
  id: string;
  admin_notes: string;
  care_role: string;
  communication_consent: boolean;
  communication_preference: "either" | "email" | "phone";
  converted_user_id: string | null;
  created_at: string;
  email: string;
  first_name: string;
  interest_context: string;
  invited_at: string | null;
  last_contacted_at: string | null;
  last_name: string;
  phone: string | null;
  source: string;
  status: EarlyAccessIntakeStatus;
  updated_at: string;
};

export type EarlyAccessIntakeDraft = {
  adminNotes: string;
  careRole: string;
  communicationPreference: "either" | "email" | "phone";
  email: string;
  firstName: string;
  interestContext: string;
  lastName: string;
  phone: string;
  source: string;
};

type EarlyAccessIntakeStats = {
  active: number;
  contacted: number;
  interested: number;
  total: number;
};

type AdminEarlyAccessIntakePanelProps<TabKey extends string> = {
  activeKey: TabKey;
  adminNotes: Record<string, string>;
  draft: EarlyAccessIntakeDraft;
  filter: "active" | "all" | EarlyAccessIntakeStatus;
  filteredRows: EarlyAccessIntakeRow[];
  formatAdminDate: (value: string | null) => string;
  loading: boolean;
  navItems: AdminNavItem<TabKey>[];
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
  onSelectTab: (tab: TabKey) => void;
  onUpdateDraft: (field: keyof EarlyAccessIntakeDraft, value: string) => void;
  onUpdateRow: (
    row: EarlyAccessIntakeRow,
    updates: Partial<EarlyAccessIntakeRow>
  ) => void;
  rows: EarlyAccessIntakeRow[];
  saving: boolean;
  setAdminNotes: Dispatch<SetStateAction<Record<string, string>>>;
  setFilter: (filter: "active" | "all" | EarlyAccessIntakeStatus) => void;
  stats: EarlyAccessIntakeStats;
  updatingId: string | null;
};

export function AdminEarlyAccessIntakePanel<TabKey extends string>({
  activeKey,
  adminNotes,
  draft,
  filter,
  filteredRows,
  formatAdminDate,
  loading,
  navItems,
  onCreate,
  onRefresh,
  onSelectTab,
  onUpdateDraft,
  onUpdateRow,
  rows,
  saving,
  setAdminNotes,
  setFilter,
  stats,
  updatingId,
}: AdminEarlyAccessIntakePanelProps<TabKey>) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <AdminNavGroup
        activeKey={activeKey}
        items={navItems}
        onSelect={onSelectTab}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Early Access intake</h2>
          <p className="mt-1 max-w-3xl text-slate-600">
            Capture interested people before creating accounts. This keeps
            prospect follow-up separate from auth users and gives us a clean
            place for individual or group communication later.
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

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total", stats.total],
          ["Active", stats.active],
          ["Interested", stats.interested],
          ["Contacted", stats.contacted],
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

      <form
        className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4"
        onSubmit={onCreate}
      >
        <h3 className="text-lg font-semibold text-blue-950">
          Add interested person
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            First name
            <input
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              disabled={saving}
              onChange={(event) => onUpdateDraft("firstName", event.target.value)}
              required
              value={draft.firstName}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Last name
            <input
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              disabled={saving}
              onChange={(event) => onUpdateDraft("lastName", event.target.value)}
              required
              value={draft.lastName}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              disabled={saving}
              onChange={(event) => onUpdateDraft("email", event.target.value)}
              required
              type="email"
              value={draft.email}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Phone
            <input
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              disabled={saving}
              onChange={(event) => onUpdateDraft("phone", event.target.value)}
              placeholder="Optional"
              value={draft.phone}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Relationship to care
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              disabled={saving}
              onChange={(event) => onUpdateDraft("careRole", event.target.value)}
              value={draft.careRole}
            >
              <option value="unspecified">Not specified</option>
              <option value="patient">Patient/self</option>
              <option value="caregiver">Caregiver/family</option>
              <option value="clinician_partner">Clinician/partner</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Communication preference
            <select
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              disabled={saving}
              onChange={(event) =>
                onUpdateDraft("communicationPreference", event.target.value)
              }
              value={draft.communicationPreference}
            >
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="either">Either</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
            What interests you about CarePland?
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              disabled={saving}
              onChange={(event) =>
                onUpdateDraft("interestContext", event.target.value)
              }
              placeholder="What did they say they wanted help with?"
              value={draft.interestContext}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Source
            <input
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              disabled={saving}
              onChange={(event) => onUpdateDraft("source", event.target.value)}
              placeholder="admin, website, referral"
              value={draft.source}
            />
          </label>
          <div className="self-end rounded-md border border-blue-100 bg-white p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Consent is read-only</p>
            <p className="mt-1">
              Admin intake does not set communication consent. Signup forms or
              explicit future communication flows should capture that directly
              from the person.
            </p>
          </div>
          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
            Admin notes
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
              disabled={saving}
              onChange={(event) => onUpdateDraft("adminNotes", event.target.value)}
              placeholder="Internal follow-up notes"
              value={draft.adminNotes}
            />
          </label>
        </div>
        <button
          className="mt-3 rounded-md bg-slate-950 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
          disabled={saving}
          type="submit"
        >
          {saving ? "Saving..." : "Save intake"}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <label className="block text-sm font-medium text-slate-700">
          View
          <select
            className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
            onChange={(event) =>
              setFilter(
                event.target.value as
                  | "active"
                  | "all"
                  | EarlyAccessIntakeStatus
              )
            }
            value={filter}
          >
            <option value="active">Active follow-up</option>
            <option value="all">All intake</option>
            <option value="new">New</option>
            <option value="reviewing">Reviewing</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="invited">Invited</option>
            <option value="converted">Converted</option>
            <option value="not_a_fit">Not a fit</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <p className="text-sm text-slate-500">
          Showing {filteredRows.length} of {rows.length}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
          No intake records loaded yet.
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {filteredRows.map((row) => (
            <article
              className="rounded-md border border-slate-200 bg-white p-4"
              key={row.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    {row.first_name} {row.last_name}
                  </h3>
                  <p className="break-all text-sm text-slate-600">
                    {row.email}
                    {row.phone ? ` · ${row.phone}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">
                      {row.status.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                      {row.communication_preference}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                      {row.care_role.replaceAll("_", " ")}
                    </span>
                    {row.communication_consent ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                        follow-up ok
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                        confirm follow-up
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-slate-500">
                  <p>Source: {row.source || "unknown"}</p>
                  <p>Added: {formatAdminDate(row.created_at)}</p>
                  <p>Updated: {formatAdminDate(row.updated_at)}</p>
                  <p>Last contacted: {formatAdminDate(row.last_contacted_at)}</p>
                </div>
              </div>

              {row.interest_context ? (
                <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    What interests them
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {row.interest_context}
                  </p>
                </div>
              ) : null}

              <div className="mt-3 grid gap-3 lg:grid-cols-[12rem_minmax(0,1fr)_auto]">
                <label className="block text-sm font-medium text-slate-700">
                  Status
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
                    disabled={updatingId === row.id}
                    onChange={(event) =>
                      onUpdateRow(row, {
                        status: event.target.value as EarlyAccessIntakeStatus,
                      })
                    }
                    value={row.status}
                  >
                    <option value="new">New</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="contacted">Contacted</option>
                    <option value="interested">Interested</option>
                    <option value="invited">Invited</option>
                    <option value="converted">Converted</option>
                    <option value="not_a_fit">Not a fit</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Admin notes
                  <textarea
                    className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2"
                    disabled={updatingId === row.id}
                    onChange={(event) =>
                      setAdminNotes((currentNotes) => ({
                        ...currentNotes,
                        [row.id]: event.target.value,
                      }))
                    }
                    value={adminNotes[row.id] ?? row.admin_notes ?? ""}
                  />
                </label>
                <div className="flex flex-col justify-end gap-2">
                  <button
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                    disabled={updatingId === row.id}
                    onClick={() =>
                      onUpdateRow(row, {
                        admin_notes: adminNotes[row.id] ?? "",
                      })
                    }
                    type="button"
                  >
                    {updatingId === row.id ? "Saving..." : "Save notes"}
                  </button>
                  <button
                    className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 disabled:text-slate-400"
                    disabled={updatingId === row.id}
                    onClick={() =>
                      onUpdateRow(row, {
                        last_contacted_at: new Date().toISOString(),
                        status: row.status === "new" ? "contacted" : row.status,
                      })
                    }
                    type="button"
                  >
                    Mark contacted
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
