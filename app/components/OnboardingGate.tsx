import { FormEvent } from "react";

import { type ProfileDraft } from "../lib/profile/profileDraft";
import { ProfileContactDetailsForm } from "./profile/ProfileContactDetailsForm";

type TimeZoneOption = {
  label: string;
  value: string;
};

type OnboardingGateProps = {
  acceptBetaDisclaimer: boolean;
  acceptBetaPrivacy: boolean;
  acceptBetaTerms: boolean;
  appContentText: (key: string) => string;
  gentleSmallSecondaryButtonClass: string;
  hasUnsavedProfileChanges: boolean;
  loading: boolean;
  message: string;
  needsBetaAgreement: boolean;
  needsOnboarding: boolean;
  onAcceptBetaAgreement: (event: FormEvent<HTMLFormElement>) => void;
  onChangeProfileField: (field: keyof ProfileDraft, value: string) => void;
  onChangeProfilePhone: (value: string) => void;
  onNeedHelp: () => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => void;
  onSetAcceptBetaDisclaimer: (value: boolean) => void;
  onSetAcceptBetaPrivacy: (value: boolean) => void;
  onSetAcceptBetaTerms: (value: boolean) => void;
  onSignOut: () => void;
  primaryButtonClassName: string;
  profileDetailsRequired: boolean;
  profileDraft: ProfileDraft;
  requiresEmailUpdate: boolean;
  savingProfile: boolean;
  secondaryButtonClassName: string;
  timeZoneOptions: TimeZoneOption[];
  verifiedAccountEmail: string;
};

export function OnboardingGate({
  acceptBetaDisclaimer,
  acceptBetaPrivacy,
  acceptBetaTerms,
  appContentText,
  gentleSmallSecondaryButtonClass,
  hasUnsavedProfileChanges,
  loading,
  message,
  needsBetaAgreement,
  needsOnboarding,
  onAcceptBetaAgreement,
  onChangeProfileField,
  onChangeProfilePhone,
  onNeedHelp,
  onSaveProfile,
  onSetAcceptBetaDisclaimer,
  onSetAcceptBetaPrivacy,
  onSetAcceptBetaTerms,
  onSignOut,
  primaryButtonClassName,
  profileDetailsRequired,
  profileDraft,
  requiresEmailUpdate,
  savingProfile,
  secondaryButtonClassName,
  timeZoneOptions,
  verifiedAccountEmail,
}: OnboardingGateProps) {
  if (needsBetaAgreement) {
    return (
      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Early Access notice</h2>
            <p className="mt-1 max-w-3xl text-slate-600">
              {appContentText("beta_notice_intro")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={gentleSmallSecondaryButtonClass}
              onClick={onNeedHelp}
              type="button"
            >
              Need help?
            </button>
            <button
              className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
              onClick={onSignOut}
              type="button"
            >
              Sign out
            </button>
          </div>
        </div>

        <form className="mt-5 space-y-4" onSubmit={onAcceptBetaAgreement}>
          <label className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <input
              checked={acceptBetaTerms}
              className="mt-1"
              onChange={(event) => onSetAcceptBetaTerms(event.target.checked)}
              type="checkbox"
            />
            <span>{appContentText("beta_terms_ack")}</span>
          </label>
          <label className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <input
              checked={acceptBetaPrivacy}
              className="mt-1"
              onChange={(event) => onSetAcceptBetaPrivacy(event.target.checked)}
              type="checkbox"
            />
            <span>{appContentText("beta_privacy_ack")}</span>
          </label>
          <label className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <input
              checked={acceptBetaDisclaimer}
              className="mt-1"
              onChange={(event) =>
                onSetAcceptBetaDisclaimer(event.target.checked)
              }
              type="checkbox"
            />
            <span>{appContentText("beta_disclaimer_ack")}</span>
          </label>
          <button
            className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
            disabled={
              loading ||
              !acceptBetaTerms ||
              !acceptBetaPrivacy ||
              !acceptBetaDisclaimer
            }
            type="submit"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>

        {message ? (
          <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
            {message}
          </p>
        ) : null}
      </section>
    );
  }

  if (needsOnboarding) {
    return (
      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Set up your profile</h2>
            <p className="mt-1 text-slate-600">
              {requiresEmailUpdate
                ? "Start by adding an email you can access, then confirm the basics CarePland needs for dates and contact."
                : profileDetailsRequired
                  ? "Confirm the basics CarePland needs for dates, contact, and support follow-up."
                  : "Add anything helpful now, or continue with your verified account."}
            </p>
          </div>
          <button
            className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
            onClick={onSignOut}
            type="button"
          >
            Sign out
          </button>
        </div>

        <ProfileContactDetailsForm
          disableWhenUnchanged={false}
          hasUnsavedProfileChanges={hasUnsavedProfileChanges}
          onChangeField={onChangeProfileField}
          onChangePhone={onChangeProfilePhone}
          onSubmit={onSaveProfile}
          primaryButtonClassName={primaryButtonClassName}
          profileDetailsRequired={profileDetailsRequired}
          profileDraft={profileDraft}
          requiresEmailUpdate={requiresEmailUpdate}
          savingProfile={savingProfile}
          secondaryButtonClassName={secondaryButtonClassName}
          submitLabel="Continue"
          timeZoneOptions={timeZoneOptions}
          variant="inline"
          verifiedAccountEmail={verifiedAccountEmail}
        />

        {message ? (
          <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
            {message}
          </p>
        ) : null}
      </section>
    );
  }

  return null;
}
