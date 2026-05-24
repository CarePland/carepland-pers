"use client";

import { FormEvent, useState } from "react";

import {
  AdminContactDetails,
  adminContactDetailFields,
  contactDetailsChangedFields,
  emptyAdminContactDetails,
} from "../../lib/adminContactDetails";

type AdminContactDetailsPanelProps = {
  contactDetails: AdminContactDetails | null;
  hasContactDetails: boolean;
  maskedEmail: string | null;
  onReveal: (reason: string) => Promise<void>;
  onSave: (details: AdminContactDetails, reason: string) => Promise<void>;
  revealing: boolean;
  saving: boolean;
};

type ContactDetailsMode = "redacted" | "override";

export function AdminContactDetailsPanel({
  contactDetails,
  hasContactDetails,
  maskedEmail,
  onReveal,
  onSave,
  revealing,
  saving,
}: AdminContactDetailsPanelProps) {
  const [draft, setDraft] = useState<AdminContactDetails>(
    contactDetails ?? emptyAdminContactDetails
  );
  const [mode, setMode] = useState<ContactDetailsMode>(
    contactDetails ? "override" : "redacted"
  );
  const [revealReason, setRevealReason] = useState("");
  const [revealAcknowledged, setRevealAcknowledged] = useState(false);
  const [saveReason, setSaveReason] = useState("");
  const [saveAcknowledged, setSaveAcknowledged] = useState(false);

  if (!hasContactDetails) {
    return null;
  }

  const changedFields = contactDetails
    ? contactDetailsChangedFields(contactDetails, draft)
    : [];

  async function handleReveal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onReveal(revealReason);
    setRevealReason("");
    setRevealAcknowledged(false);
    setMode("override");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const confirmed = window.confirm(
      "Save contact detail changes? This creates a separate audit event with your justification."
    );

    if (!confirmed) {
      return;
    }

    await onSave(draft, saveReason);
    setSaveReason("");
    setSaveAcknowledged(false);
  }

  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">
          Contact details
        </p>
        <label className="w-36">
          <span className="sr-only">Contact details mode</span>
          <select
            className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-600"
            onChange={(event) =>
              setMode(event.target.value as ContactDetailsMode)
            }
            value={contactDetails ? "override" : mode}
          >
            <option value="redacted">Redacted</option>
            <option value="override">Override</option>
          </select>
        </label>
      </div>

      {contactDetails ? (
        <form onSubmit={handleSave}>
          <div className="grid gap-3 sm:grid-cols-2">
            {adminContactDetailFields.map(({ key, label }) => (
              <label
                className={
                  key === "address_line1" || key === "address_line2"
                    ? "block text-sm font-medium text-slate-700 sm:col-span-2"
                    : "block text-sm font-medium text-slate-700"
                }
                key={key}
              >
                {label}
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  onChange={(event) =>
                    setDraft((currentDraft) => ({
                      ...currentDraft,
                      [key]: event.target.value,
                    }))
                  }
                  type={key === "email" ? "email" : "text"}
                  value={draft[key]}
                />
              </label>
            ))}
          </div>

          <label className="mt-3 block text-sm font-medium text-slate-700">
            Save justification
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              onChange={(event) => setSaveReason(event.target.value)}
              placeholder="Required before updating contact details."
              value={saveReason}
            />
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
            <input
              checked={saveAcknowledged}
              className="mt-1"
              onChange={(event) => setSaveAcknowledged(event.target.checked)}
              type="checkbox"
            />
            <span>
              I understand this save will be logged as a separate contact
              update audit event.
            </span>
          </label>

          <button
            className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
            disabled={
              saving || changedFields.length === 0 || saveReason.trim().length < 8
              || !saveAcknowledged
            }
            type="submit"
          >
            {saving ? "Saving..." : "Save contact details"}
          </button>
          {changedFields.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Changes pending: {changedFields.join(", ")}
            </p>
          ) : null}
        </form>
      ) : mode === "override" ? (
        <form onSubmit={handleReveal}>
          <p className="text-sm text-slate-600">
            Contact and address details are hidden.
          </p>
          {maskedEmail ? (
            <p className="mt-1 text-sm text-slate-700">
              Email: {maskedEmail}
            </p>
          ) : null}
          <label className="mt-3 block text-sm font-medium text-slate-700">
            View justification
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              onChange={(event) => setRevealReason(event.target.value)}
              placeholder="Required before viewing contact details."
              value={revealReason}
            />
          </label>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
            <input
              checked={revealAcknowledged}
              className="mt-1"
              onChange={(event) => setRevealAcknowledged(event.target.checked)}
              type="checkbox"
            />
            <span>
              I understand this reveal will be logged before full contact
              details are shown.
            </span>
          </label>
          <button
            className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
            disabled={
              revealing || revealReason.trim().length < 8 || !revealAcknowledged
            }
            type="submit"
          >
            {revealing ? "Revealing..." : "Reveal contact details"}
          </button>
        </form>
      ) : (
        <div className="mt-3 text-sm text-slate-600">
          <p>Contact and address details are hidden.</p>
          {maskedEmail ? (
            <p className="mt-1 text-slate-700">Email: {maskedEmail}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
