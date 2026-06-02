import { FormEvent } from "react";

import {
  gentleCautionButtonClass,
  gentlePrimaryButtonClass,
  gentleSecondaryButtonClass,
  gentleSmallSecondaryButtonClass,
  gentleSoftBlueButtonClass,
} from "../../lib/uiStyles";

type CareSubject = {
  care_circle_id: string;
  id: string;
  display_name: string;
  is_default: boolean;
  is_active: boolean;
  subject_type: string;
};

type PricingTierOption = {
  id: string;
  name: string;
};

type CurrentPricingTier = PricingTierOption & {
  profileSummary?: string;
};

type PendingReactivateCareVip = {
  displayName: string;
  id: string;
};

type ProfileAccountSummaryProps = {
  actualPricingTier: PricingTierOption;
  canAddCareVip: boolean;
  canUseMultipleCareVips: boolean;
  careSubjects: CareSubject[];
  careVipFormMessage: string;
  careVipLimit: number;
  creatingCareVip: boolean;
  currentPlanFeatureRows: string[][];
  currentPlanSummary: string;
  currentPricingTier: CurrentPricingTier;
  deactivatingCareVipId: string | null;
  entitlementPlanName: string;
  isAdmin: boolean;
  isPreviewingPlan: boolean;
  newCareVipName: string;
  onAddDemoData: () => void;
  onChangeNewCareVipName: (value: string) => void;
  onChangePlanPreview: (tierId: string) => void;
  onClearPendingReactivateCareVip: () => void;
  onCreateCareVip: (event: FormEvent<HTMLFormElement>) => void;
  onDeactivateCareVip: (subject: CareSubject) => void;
  onReactivateCareVip: () => void;
  onRemoveDemoData: () => void;
  onRequestDeactivateCareVip: (subjectId: string | null) => void;
  onSendPasswordReset: () => void;
  onSignOut: () => void;
  pendingDeactivateCareVipId: string | null;
  pendingReactivateCareVip: PendingReactivateCareVip | null;
  planHelpExpanded: boolean;
  pricingTiers: PricingTierOption[];
  removingSampleData: boolean;
  sampleDataSeededAt: string | null;
  seedingSampleData: boolean;
  sendingPasswordReset: boolean;
  setPlanHelpExpanded: (updater: (isExpanded: boolean) => boolean) => void;
};

export function ProfileAccountSummary({
  actualPricingTier,
  canAddCareVip,
  canUseMultipleCareVips,
  careSubjects,
  careVipFormMessage,
  careVipLimit,
  creatingCareVip,
  currentPlanFeatureRows,
  currentPlanSummary,
  currentPricingTier,
  deactivatingCareVipId,
  entitlementPlanName,
  isAdmin,
  isPreviewingPlan,
  newCareVipName,
  onAddDemoData,
  onChangeNewCareVipName,
  onChangePlanPreview,
  onClearPendingReactivateCareVip,
  onCreateCareVip,
  onDeactivateCareVip,
  onReactivateCareVip,
  onRemoveDemoData,
  onRequestDeactivateCareVip,
  onSendPasswordReset,
  onSignOut,
  pendingDeactivateCareVipId,
  pendingReactivateCareVip,
  planHelpExpanded,
  pricingTiers,
  removingSampleData,
  sampleDataSeededAt,
  seedingSampleData,
  sendingPasswordReset,
  setPlanHelpExpanded,
}: ProfileAccountSummaryProps) {
  const pendingDeactivateSubject = pendingDeactivateCareVipId
    ? careSubjects.find((subject) => subject.id === pendingDeactivateCareVipId)
    : null;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="break-words pt-1 text-xl font-semibold text-slate-950">
            Your CarePland Account
          </h2>
        </div>
        <button
          className={`${gentleSecondaryButtonClass} self-center text-sm`}
          onClick={onSignOut}
          type="button"
        >
          Sign out
        </button>
      </div>

      <div className="mt-3 grid overflow-hidden rounded-md bg-white ring-1 ring-slate-200 sm:grid-cols-[minmax(0,1fr)_18rem] xl:min-h-[14rem] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_18rem]">
        <section className="relative p-4 after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-slate-200 sm:order-1 xl:after:hidden">
          <div className="flex h-7 items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Plan
            </div>
            {isAdmin ? (
              <label className="w-[7.5rem]">
                <span className="sr-only">Preview plan</span>
                <select
                  aria-label="Preview plan"
                  className="h-7 w-full rounded-md border border-blue-100 bg-white px-2 text-xs font-semibold leading-none text-slate-500"
                  onChange={(event) => onChangePlanPreview(event.target.value)}
                  title="Admin-only local plan preview. Does not change the real account plan."
                  value={currentPricingTier.id}
                >
                  {pricingTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.id === "premium_individual"
                        ? "Premium"
                        : tier.id === "early_access"
                          ? "Early"
                          : tier.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <button
                className="h-7 whitespace-nowrap text-xs font-semibold text-slate-300"
                disabled
                title="Plan changes are not wired up yet."
                type="button"
              >
                Change Plan
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 font-semibold text-slate-950">
              <span>{currentPricingTier.name}</span>
              {isAdmin ? (
                <span
                  className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-amber-800"
                  title="Admin access is managed separately from plan billing."
                >
                  Admin
                </span>
              ) : null}
              {isPreviewingPlan ? (
                <span
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-slate-600"
                  title={`Previewing ${currentPricingTier.name}; actual plan is ${actualPricingTier.name}.`}
                >
                  Preview
                </span>
              ) : null}
              <button
                aria-expanded={planHelpExpanded}
                aria-label="Explain CarePland plan tiers"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-600"
                onClick={() =>
                  setPlanHelpExpanded((isExpanded) => !isExpanded)
                }
                type="button"
              >
                ?
              </button>
            </span>
          </div>
          <div
            aria-hidden={!planHelpExpanded}
            className={`mt-3 text-sm text-slate-700 ${
              planHelpExpanded ? "" : "hidden"
            }`}
          >
            <p className="mb-3 leading-5 text-slate-800">
              {currentPlanSummary}
            </p>
            <dl className="space-y-3">
              {currentPlanFeatureRows.map(([label, value]) => (
                <div
                  className="grid gap-1 sm:grid-cols-[6rem_minmax(0,1fr)]"
                  key={label}
                >
                  {label ? (
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </dt>
                  ) : null}
                  <dd className="leading-5 text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {canUseMultipleCareVips ? (
          <section className="relative flex flex-col p-4 after:absolute after:inset-x-4 after:bottom-0 after:h-px after:bg-slate-200 xl:before:absolute xl:before:inset-y-4 xl:before:left-0 xl:before:w-px xl:before:bg-slate-200 xl:after:inset-y-4 xl:after:bottom-auto xl:after:left-auto xl:after:right-0 xl:after:h-auto xl:after:w-px sm:order-3 sm:col-span-2 xl:order-2 xl:col-span-1">
            <div className="flex h-7 items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                CARE VIPs
              </h3>
              <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">
                {careSubjects.length}/{careVipLimit}
              </p>
            </div>
            {careSubjects.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {careSubjects.map((subject) => (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
                    key={subject.id}
                  >
                    {subject.display_name}
                    {!subject.is_default ? (
                      <button
                        aria-label={`Deactivate ${subject.display_name}`}
                        className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        disabled={deactivatingCareVipId === subject.id}
                        onClick={() => onRequestDeactivateCareVip(subject.id)}
                        type="button"
                      >
                        x
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : null}
            {pendingDeactivateCareVipId ? (
              <section className="mt-3 rounded-md border border-rose-100 bg-rose-50 p-3">
                <p className="text-sm font-medium text-rose-950">
                  Deactivate {pendingDeactivateSubject?.display_name}?
                </p>
                <p className="mt-1 text-sm text-rose-900">
                  Their saved appointments stay in CarePland and can be restored
                  later.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className={gentleCautionButtonClass}
                    disabled={
                      deactivatingCareVipId === pendingDeactivateCareVipId
                    }
                    onClick={() => {
                      if (pendingDeactivateSubject) {
                        onDeactivateCareVip(pendingDeactivateSubject);
                      }
                    }}
                    type="button"
                  >
                    {deactivatingCareVipId === pendingDeactivateCareVipId
                      ? "Deactivating..."
                      : "Deactivate"}
                  </button>
                  <button
                    className={gentleSmallSecondaryButtonClass}
                    onClick={() => onRequestDeactivateCareVip(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            ) : null}
            <form className="mt-7 xl:mt-auto" onSubmit={onCreateCareVip}>
              <label className="sr-only" htmlFor="new-care-vip-name">
                Care VIP name or email
              </label>
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-base"
                  disabled={!canAddCareVip}
                  id="new-care-vip-name"
                  onChange={(event) => onChangeNewCareVipName(event.target.value)}
                  placeholder="Name or email"
                  type="text"
                  value={newCareVipName}
                />
                <button
                  className={gentleSoftBlueButtonClass}
                  disabled={
                    creatingCareVip || !canAddCareVip || !newCareVipName.trim()
                  }
                  type="submit"
                >
                  {creatingCareVip ? "Adding..." : "Add"}
                </button>
              </div>
              {careVipFormMessage ? (
                <p className="mt-2 text-sm font-medium text-rose-700">
                  {careVipFormMessage}
                </p>
              ) : null}
              {pendingReactivateCareVip ? (
                <section className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3">
                  <p className="text-sm font-medium text-blue-950">
                    Reactivate {pendingReactivateCareVip.displayName}?
                  </p>
                  <p className="mt-1 text-sm text-blue-900">
                    This email belongs to an inactive Care VIP.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={gentlePrimaryButtonClass}
                      disabled={creatingCareVip}
                      onClick={onReactivateCareVip}
                      type="button"
                    >
                      Reactivate
                    </button>
                    <button
                      className={gentleSmallSecondaryButtonClass}
                      onClick={onClearPendingReactivateCareVip}
                      type="button"
                    >
                      Enter a different email
                    </button>
                  </div>
                </section>
              ) : null}
              {!canAddCareVip ? (
                <p className="mt-3 text-sm text-slate-500">
                  {entitlementPlanName} includes {careVipLimit} active Care
                  VIPs.
                </p>
              ) : null}
            </form>
          </section>
        ) : null}

        <section className="p-4 sm:order-2 xl:order-3">
          <div className="flex h-7 items-center">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Account tools
            </h3>
          </div>
          <div
            className={`mt-3 ${isAdmin ? "" : "border-b border-slate-200 pb-4"}`}
          >
            <p className="text-sm text-slate-600">
              Send reset link to your verified email.
            </p>
            <button
              className={`mt-3 w-full ${gentleSecondaryButtonClass} text-sm`}
              disabled={sendingPasswordReset}
              onClick={onSendPasswordReset}
              type="button"
            >
              {sendingPasswordReset ? "Sending..." : "Reset password"}
            </button>
          </div>
          {!isAdmin ? (
            <div className="mt-4">
              {sampleDataSeededAt ? (
                <p className="text-sm text-slate-600">
                  Remove sample data only.
                  <br />
                  Your own appointments are safe.
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  Add sample appointments and data to quickly try out CarePland
                  features.
                </p>
              )}
              {sampleDataSeededAt ? (
                <button
                  className={`mt-3 w-full ${gentleSecondaryButtonClass} text-sm`}
                  disabled={removingSampleData}
                  onClick={onRemoveDemoData}
                  type="button"
                >
                  {removingSampleData ? "Removing..." : "Remove demo data"}
                </button>
              ) : (
                <button
                  className={`mt-3 w-full ${gentleSecondaryButtonClass} text-sm`}
                  disabled={seedingSampleData}
                  onClick={onAddDemoData}
                  type="button"
                >
                  {seedingSampleData ? "Adding..." : "Add demo data"}
                </button>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
