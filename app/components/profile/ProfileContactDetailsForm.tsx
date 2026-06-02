import { FormEvent } from "react";

type ProfileDraft = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  displayName: string;
  email: string;
  familyName: string;
  givenName: string;
  phone: string;
  postalCode: string;
  region: string;
  timezone: string;
};

type TimeZoneOption = {
  label: string;
  value: string;
};

type ProfileContactDetailsFormProps = {
  hasUnsavedProfileChanges: boolean;
  onChangeField: (field: keyof ProfileDraft, value: string) => void;
  onChangePhone: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  primaryButtonClassName: string;
  profileDetailsRequired: boolean;
  profileDraft: ProfileDraft;
  requiresEmailUpdate: boolean;
  savingProfile: boolean;
  secondaryButtonClassName: string;
  timeZoneOptions: TimeZoneOption[];
  verifiedAccountEmail: string;
};

export function ProfileContactDetailsForm({
  hasUnsavedProfileChanges,
  onChangeField,
  onChangePhone,
  onSubmit,
  primaryButtonClassName,
  profileDetailsRequired,
  profileDraft,
  requiresEmailUpdate,
  savingProfile,
  secondaryButtonClassName,
  timeZoneOptions,
  verifiedAccountEmail,
}: ProfileContactDetailsFormProps) {
  const requirementLabel = profileDetailsRequired ? "required" : "optional";

  return (
    <form
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={onSubmit}
    >
      <div className="flex h-7 flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Contact details
          </h3>
        </div>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          <span className="flex items-center justify-between gap-3">
            <span>Email</span>
            <span className="text-xs font-normal text-slate-400">required</span>
          </span>
          {requiresEmailUpdate ? (
            <>
              <input
                autoComplete="email"
                className="mt-2 w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-base"
                onChange={(event) =>
                  onChangeField("email", event.target.value)
                }
                placeholder="you@example.com"
                required
                type="email"
                value={profileDraft.email}
              />
              <span className="mt-2 block text-xs font-normal text-amber-800">
                Enter an email you can access for account recovery.
              </span>
            </>
          ) : (
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-base text-slate-700">
              {verifiedAccountEmail || "Verified account email"}
            </div>
          )}
        </label>
        <label className="block text-sm font-medium text-slate-700">
          <span className="flex items-center justify-between gap-3">
            <span>Phone</span>
            <span className="text-xs font-normal text-slate-400">
              {requirementLabel}
            </span>
          </span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            inputMode="numeric"
            onChange={(event) => onChangePhone(event.target.value)}
            placeholder="(___) ___-____"
            required={profileDetailsRequired}
            type="tel"
            value={profileDraft.phone}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          <span className="flex items-center justify-between gap-3">
            <span>First name</span>
            <span className="text-xs font-normal text-slate-400">
              {requirementLabel}
            </span>
          </span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) =>
              onChangeField("givenName", event.target.value)
            }
            required={profileDetailsRequired}
            type="text"
            value={profileDraft.givenName}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          <span className="flex items-center justify-between gap-3">
            <span>Last name</span>
            <span className="text-xs font-normal text-slate-400">
              {requirementLabel}
            </span>
          </span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) =>
              onChangeField("familyName", event.target.value)
            }
            required={profileDetailsRequired}
            type="text"
            value={profileDraft.familyName}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Display name
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) =>
              onChangeField("displayName", event.target.value)
            }
            placeholder="Optional, if different"
            type="text"
            value={profileDraft.displayName}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          <span className="flex items-center justify-between gap-3">
            <span>Time zone</span>
            <span className="text-xs font-normal text-slate-400">
              {requirementLabel}
            </span>
          </span>
          <select
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
            onChange={(event) =>
              onChangeField("timezone", event.target.value)
            }
            required={profileDetailsRequired}
            value={profileDraft.timezone}
          >
            <option value="">Select time zone</option>
            {!timeZoneOptions.some(
              (option) => option.value === profileDraft.timezone
            ) && profileDraft.timezone ? (
              <option value={profileDraft.timezone}>
                {profileDraft.timezone}
              </option>
            ) : null}
            {timeZoneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} · {option.value}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700 md:col-span-2">
          Address line 1
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) =>
              onChangeField("addressLine1", event.target.value)
            }
            placeholder="Optional"
            value={profileDraft.addressLine1}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 md:col-span-2">
          Address line 2
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) =>
              onChangeField("addressLine2", event.target.value)
            }
            placeholder="Optional"
            value={profileDraft.addressLine2}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          City
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => onChangeField("city", event.target.value)}
            value={profileDraft.city}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          State / region
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => onChangeField("region", event.target.value)}
            value={profileDraft.region}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          <span className="flex items-center justify-between gap-3">
            <span>ZIP code</span>
            <span className="text-xs font-normal text-slate-400">
              {requirementLabel}
            </span>
          </span>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            inputMode="numeric"
            onChange={(event) =>
              onChangeField("postalCode", event.target.value)
            }
            placeholder="12345 or 12345-6789"
            required={profileDetailsRequired}
            value={profileDraft.postalCode}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Country
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => onChangeField("country", event.target.value)}
            value={profileDraft.country}
          />
        </label>
        <div className="md:col-span-2">
          <button
            className={
              hasUnsavedProfileChanges
                ? primaryButtonClassName
                : secondaryButtonClassName
            }
            disabled={savingProfile || !hasUnsavedProfileChanges}
            type="submit"
          >
            {savingProfile ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>
    </form>
  );
}
