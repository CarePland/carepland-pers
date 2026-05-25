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
  onReveal: (reason: string) => Promise<boolean>;
  onSave: (details: AdminContactDetails, reason: string) => Promise<boolean>;
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
  const [revealError, setRevealError] = useState("");
  const [saveReason, setSaveReason] = useState("");
  const [saveAcknowledged, setSaveAcknowledged] = useState(false);
  const [saveError, setSaveError] = useState("");

  const changedFields = contactDetails
    ? contactDetailsChangedFields(contactDetails, draft)
    : [];

  async function handleReveal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRevealError("");
    const revealed = await onReveal(revealReason);

    if (!revealed) {
      setRevealError(
        "Contact details were not revealed. Check the message above, then try again."
      );
      return;
    }

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

    setSaveError("");
    const saved = await onSave(draft, saveReason);

    if (!saved) {
      setSaveError(
        "Contact details were not saved. Check the message above, then try again."
      );
      return;
    }

    setSaveReason("");
    setSaveAcknowledged(false);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Contact details
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Admin view of the user&apos;s Profile contact details. Full values
            require a logged reveal before editing.
          </p>
        </div>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          Admin audited
        </span>
      </div>

      {contactDetails ? (
        <form className="mt-5" onSubmit={handleSave}>
          <div className="grid gap-4 md:grid-cols-2">
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
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-800"
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

          <label className="mt-5 block text-sm font-medium text-slate-700">
            Save justification
            <textarea
              className="mt-2 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
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
          {saveError ? (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {saveError}
            </p>
          ) : null}
        </form>
      ) : mode === "override" ? (
        <form className="mt-5" onSubmit={handleReveal}>
          <div className="grid gap-4 md:grid-cols-2">
            {adminContactDetailFields.map(({ key, label }) => (
              <label
                className={
                  key === "address_line1" || key === "address_line2"
                    ? "block text-sm font-medium text-slate-700 md:col-span-2"
                    : "block text-sm font-medium text-slate-700"
                }
                key={key}
              >
                {label}
                <div className="mt-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-base text-slate-500">
                  {key === "email" && maskedEmail
                    ? maskedEmail
                    : hasContactDetails
                      ? "Hidden until reveal"
                      : "Not set or hidden"}
                </div>
              </label>
            ))}
          </div>
          <label className="mt-5 block text-sm font-medium text-slate-700">
            View justification
            <textarea
              className="mt-2 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
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
          {revealError ? (
            <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {revealError}
            </p>
          ) : null}
        </form>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          <p>Contact and address details are hidden.</p>
          {maskedEmail ? <p className="mt-1">Email: {maskedEmail}</p> : null}
          <button
            className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={() => setMode("override")}
            type="button"
          >
            Prepare reveal
          </button>
        </div>
      )}
    </section>
  );
}
