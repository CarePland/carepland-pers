import { FormEvent } from "react";

import { ManagedByHouseholdHeart } from "../../shared/PersonAvatar";
import {
  gentleCautionButtonClass,
  gentlePrimaryButtonClass,
  gentleSmallSecondaryButtonClass,
  gentleSoftBlueButtonClass,
} from "../../shared/uiStyles";

export type CareVipManagerSubject = {
  display_name: string;
  id: string;
  is_default: boolean;
  managed_by_household?: boolean | null;
  subject_type: string;
};

type PendingReactivateCareVip = {
  displayName: string;
  id: string;
};

type CareVipManagerProps<TSubject extends CareVipManagerSubject> = {
  canAddCareVip: boolean;
  careSubjects: TSubject[];
  careVipFormMessage: string;
  careVipLimit: number;
  creatingCareVip: boolean;
  deactivateConfirmDescription?: string;
  deactivatingCareVipId: string | null;
  entitlementPlanName: string;
  inputPlaceholder?: string;
  newCareVipName: string;
  onChangeNewCareVipName: (value: string) => void;
  onClearPendingReactivateCareVip: () => void;
  onCreateCareVip: (event: FormEvent<HTMLFormElement>) => void;
  onDeactivateCareVip: (subject: TSubject) => void;
  onReactivateCareVip: () => void;
  onRequestDeactivateCareVip: (subjectId: string | null) => void;
  pendingDeactivateCareVipId: string | null;
  pendingReactivateCareVip: PendingReactivateCareVip | null;
  showManagedByHouseholdLegend?: boolean;
};

/**
 * Shared Care VIP pill list + add form. Behavior-preserving extraction of the
 * Care VIPs panel that originally lived only in ProfileAccountSummary, so
 * Profile and the Personal Setup wizard's Care VIPs step render and behave
 * identically instead of maintaining two copies of add/reactivate/deactivate
 * markup for the same underlying `app/lib/personal/profile/careVipActions.ts`
 * workflow.
 */
export function CareVipManager<TSubject extends CareVipManagerSubject>({
  canAddCareVip,
  careSubjects,
  careVipFormMessage,
  careVipLimit,
  creatingCareVip,
  deactivateConfirmDescription = "Their saved appointments stay in CarePland and can be restored later.",
  deactivatingCareVipId,
  entitlementPlanName,
  inputPlaceholder = "Name or email",
  newCareVipName,
  onChangeNewCareVipName,
  onClearPendingReactivateCareVip,
  onCreateCareVip,
  onDeactivateCareVip,
  onReactivateCareVip,
  onRequestDeactivateCareVip,
  pendingDeactivateCareVipId,
  pendingReactivateCareVip,
  showManagedByHouseholdLegend = true,
}: CareVipManagerProps<TSubject>) {
  const pendingDeactivateSubject = pendingDeactivateCareVipId
    ? careSubjects.find((subject) => subject.id === pendingDeactivateCareVipId)
    : null;

  return (
    <>
      {careSubjects.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {careSubjects.map((subject) => (
            <span
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm text-slate-700"
              key={subject.id}
            >
              <span className="min-w-0 truncate">{subject.display_name}</span>
              {isManagedByHouseholdSubject(subject) ? (
                <ManagedByHouseholdHeart className="shrink-0" />
              ) : null}
              {!subject.is_default ? (
                <button
                  aria-label={`Deactivate ${subject.display_name}`}
                  className="text-slate-400 transition hover:text-slate-700"
                  disabled={deactivatingCareVipId === subject.id}
                  onClick={() => onRequestDeactivateCareVip(subject.id)}
                  type="button"
                >
                  ×
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
            {deactivateConfirmDescription}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={gentleCautionButtonClass}
              disabled={deactivatingCareVipId === pendingDeactivateCareVipId}
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
      <form className="mt-7 lg:mt-auto" onSubmit={onCreateCareVip}>
        {showManagedByHouseholdLegend && careSubjects.length > 0 ? (
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-slate-500">
            <ManagedByHouseholdHeart />
            <span>= Managed by household</span>
          </p>
        ) : null}
        <label className="sr-only" htmlFor="new-care-vip-name">
          Care VIP name or email
        </label>
        <div className="flex items-center gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-base"
            disabled={!canAddCareVip}
            id="new-care-vip-name"
            onChange={(event) => onChangeNewCareVipName(event.target.value)}
            placeholder={inputPlaceholder}
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
            {entitlementPlanName} includes {careVipLimit} active Care VIPs.
          </p>
        ) : null}
      </form>
    </>
  );
}

function isManagedByHouseholdSubject(
  subject: Pick<CareVipManagerSubject, "managed_by_household" | "subject_type">
) {
  return (
    Boolean(subject.managed_by_household) ||
    isPetSubjectType(subject.subject_type)
  );
}

function isPetSubjectType(subjectType?: string | null) {
  const normalizedSubjectType = subjectType?.trim().toLowerCase() ?? "";

  return (
    normalizedSubjectType === "cat" ||
    normalizedSubjectType === "dog" ||
    normalizedSubjectType === "pet" ||
    normalizedSubjectType.startsWith("pet:")
  );
}
