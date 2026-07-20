import {
  FormEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Image from "next/image";

import { AskSpeechBubbleIcon } from "../../shared/CarePlandTopNav";
import { AddressAutocompleteField } from "../profile/AddressAutocompleteField";
import {
  isProfileAddressComplete,
  type ProfileDraft,
} from "../../../lib/personal/profile/profileDraft";
import { type PlaceAddressResult } from "../../../lib/platform/integrations/places";

type TimeZoneOption = {
  label: string;
  value: string;
};

type OnboardingGateProps = {
  acceptBetaDisclaimer: boolean;
  acceptBetaPrivacy: boolean;
  acceptBetaTerms: boolean;
  appContentText: (key: string) => string;
  loading: boolean;
  message: string;
  needsBetaAgreement: boolean;
  needsOnboarding: boolean;
  onAcceptBetaAgreement: (event: FormEvent<HTMLFormElement>) => void;
  onChangeProfileField: (field: keyof ProfileDraft, value: string) => void;
  onChangeProfilePhone: (value: string) => void;
  onChangeProfileZip: (value: string) => void;
  getPlacesAuthHeaders: () => Promise<Record<string, string>>;
  onApplyProfileAddress: (address: PlaceAddressResult) => void;
  onImportAnything: () => void;
  onOpenCarePland: () => void;
  onOpenReceiver: () => void;
  onReviewStep: () => void;
  onSaveProfile: (event: FormEvent<HTMLFormElement>) => void;
  onSetAcceptBetaDisclaimer: (value: boolean) => void;
  onSetAcceptBetaPrivacy: (value: boolean) => void;
  onSetAcceptBetaTerms: (value: boolean) => void;
  onSignOut: () => void;
  receiverConfigured: boolean;
  profileDetailsRequired: boolean;
  profileDraft: ProfileDraft;
  requiresEmailUpdate: boolean;
  savingProfile: boolean;
  showReady: boolean;
  timezoneDetectionMessage?: string;
  timeZoneOptions: TimeZoneOption[];
  verifiedAccountEmail: string;
};

const betaFormId = "carepland-onboarding-beta-form";
const profileBasicsFormId = "carepland-onboarding-profile-basics-form";
const profileAddressFormId = "carepland-onboarding-profile-address-form";
const personalSetupCanvasWidth = 1024;
const personalSetupCanvasHeight = 640;
const personalSetupViewportMargin = 24;
type PersonalOnboardingStep =
  | "earlyAccess"
  | "profileBasics"
  | "profileAddress"
  | "ready";

export function OnboardingGate({
  acceptBetaDisclaimer,
  acceptBetaPrivacy,
  acceptBetaTerms,
  appContentText,
  loading,
  message,
  needsBetaAgreement,
  needsOnboarding,
  onAcceptBetaAgreement,
  onChangeProfileField,
  onChangeProfilePhone,
  onChangeProfileZip,
  getPlacesAuthHeaders,
  onApplyProfileAddress,
  onImportAnything,
  onOpenCarePland,
  onOpenReceiver,
  onReviewStep,
  onSaveProfile,
  onSetAcceptBetaDisclaimer,
  onSetAcceptBetaPrivacy,
  onSetAcceptBetaTerms,
  onSignOut,
  receiverConfigured,
  profileDetailsRequired,
  profileDraft,
  requiresEmailUpdate,
  savingProfile,
  showReady,
  timezoneDetectionMessage,
  timeZoneOptions,
  verifiedAccountEmail,
}: OnboardingGateProps) {
  const betaComplete =
    !needsBetaAgreement ||
    (acceptBetaTerms && acceptBetaPrivacy && acceptBetaDisclaimer);
  const profileBasicsComplete =
    !profileDetailsRequired ||
    (profileDraft.givenName.trim() &&
      profileDraft.familyName.trim() &&
      profileDraft.phone.trim() &&
      profileDraft.timezone.trim() &&
      (!requiresEmailUpdate || profileDraft.email.trim()));
  const profileAddressComplete =
    !profileDetailsRequired || isProfileAddressComplete(profileDraft);
  const setupRequirementsComplete =
    betaComplete && Boolean(profileBasicsComplete) && profileAddressComplete;
  const readyActionsDisabled = loading || savingProfile || !setupRequirementsComplete;
  const firstStep: PersonalOnboardingStep = needsBetaAgreement
    ? "earlyAccess"
    : "profileBasics";
  const [activeStep, setActiveStep] =
    useState<PersonalOnboardingStep>(firstStep);
  const [stepValidationMessage, setStepValidationMessage] = useState("");
  const visibleStep =
    showReady
      ? "ready"
      : !needsBetaAgreement && activeStep === "earlyAccess"
      ? "profileBasics"
      : activeStep;
  const viewingBlockedProfile = visibleStep !== "earlyAccess" && !betaComplete;
  const primaryFormId =
    visibleStep === "earlyAccess"
      ? betaFormId
      : visibleStep === "profileBasics"
        ? profileBasicsFormId
        : visibleStep === "profileAddress"
          ? profileAddressFormId
          : undefined;
  const primaryDisabled =
    visibleStep === "ready"
      ? readyActionsDisabled
      : visibleStep === "earlyAccess"
      ? loading || !betaComplete
      : visibleStep === "profileAddress"
      ? savingProfile
      : savingProfile || viewingBlockedProfile;
  const primaryLabel =
    visibleStep === "ready"
      ? "Open CarePland"
      : visibleStep === "earlyAccess"
      ? loading
        ? "Saving..."
        : "Next"
      : visibleStep === "profileBasics"
        ? "Next"
        : visibleStep === "profileAddress"
        ? "Next"
        : savingProfile
        ? "Saving..."
        : "Continue";

  function goToProfileBasics() {
    onReviewStep();
    setStepValidationMessage("");
    setActiveStep("profileBasics");
  }

  function handleProfileBasicsNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveStep("profileAddress");
  }

  function submitProfileBasicsForm() {
    const form = document.getElementById(
      profileBasicsFormId
    ) as HTMLFormElement | null;

    form?.requestSubmit();
  }

  function handleProfileBasicsNextClick() {
    if (profileDetailsRequired && !profileBasicsComplete) {
      setStepValidationMessage(
        "Please fill in your first name, last name, phone, and time zone to continue."
      );
      return;
    }

    setStepValidationMessage("");
    submitProfileBasicsForm();
  }

  function goToProfileAddress() {
    onReviewStep();
    setStepValidationMessage("");
    setActiveStep("profileAddress");
  }

  function handleSelectStep(step: PersonalOnboardingStep) {
    if (step !== "ready") {
      onReviewStep();
    }

    setStepValidationMessage("");
    setActiveStep(step);
  }

  function submitProfileAddressForm() {
    const form = document.getElementById(
      profileAddressFormId
    ) as HTMLFormElement | null;

    form?.requestSubmit();
  }

  function handleProfileAddressNextClick() {
    if (profileDetailsRequired && !profileAddressComplete) {
      setStepValidationMessage(
        "Please fill in your street address, city, state, and a valid ZIP code to continue."
      );
      return;
    }

    setStepValidationMessage("");
    submitProfileAddressForm();
  }

  if (needsBetaAgreement) {
    return visibleStep === "earlyAccess" ? (
      <PersonalOnboardingShell
        currentStep={visibleStep}
        message={message}
        onSelectStep={handleSelectStep}
        onSignOut={onSignOut}
        primaryDisabled={primaryDisabled}
        primaryFormId={primaryFormId}
        primaryLabel={primaryLabel}
        betaComplete={betaComplete}
        profileAddressComplete={profileAddressComplete}
        profileBasicsComplete={Boolean(profileBasicsComplete)}
      >
        <div className="max-w-3xl">
          <h2 className="text-3xl font-black leading-tight text-[#172f49]">
            Early Access Agreement
          </h2>
        </div>

        <form
          className="mt-6 space-y-4"
          id={betaFormId}
          onSubmit={onAcceptBetaAgreement}
        >
          <label className="flex gap-4 py-3 text-base font-semibold leading-snug text-[#173150]">
            <input
              checked={acceptBetaTerms}
              className="mt-1 h-5 w-5"
              onChange={(event) => onSetAcceptBetaTerms(event.target.checked)}
              type="checkbox"
            />
            <span>{appContentText("beta_terms_ack")}</span>
          </label>
          <label className="flex gap-4 py-3 text-base font-semibold leading-snug text-[#173150]">
            <input
              checked={acceptBetaPrivacy}
              className="mt-1 h-5 w-5"
              onChange={(event) => onSetAcceptBetaPrivacy(event.target.checked)}
              type="checkbox"
            />
            <span>{appContentText("beta_privacy_ack")}</span>
          </label>
          <label className="flex gap-4 py-3 text-base font-semibold leading-snug text-[#173150]">
            <input
              checked={acceptBetaDisclaimer}
              className="mt-1 h-5 w-5"
              onChange={(event) =>
                onSetAcceptBetaDisclaimer(event.target.checked)
              }
              type="checkbox"
            />
            <span>{appContentText("beta_disclaimer_ack")}</span>
          </label>
        </form>
      </PersonalOnboardingShell>
    ) : (
      <PersonalOnboardingShell
        currentStep={visibleStep}
        message=""
        stepValidationMessage={stepValidationMessage}
        onBack={
          visibleStep === "profileAddress"
            ? goToProfileBasics
            : visibleStep === "ready"
              ? goToProfileAddress
              : undefined
        }
        onSelectStep={handleSelectStep}
        onSignOut={onSignOut}
        primaryDisabled={primaryDisabled}
        primaryFormId={
          visibleStep === "profileBasics" || visibleStep === "profileAddress"
            ? undefined
            : primaryFormId
        }
        primaryLabel={primaryLabel}
        primaryOnClick={
          visibleStep === "ready"
            ? onOpenCarePland
            : visibleStep === "profileBasics"
              ? handleProfileBasicsNextClick
            : visibleStep === "profileAddress"
              ? handleProfileAddressNextClick
              : undefined
        }
        secondaryDisabled={visibleStep === "ready" ? false : undefined}
        secondaryLabel={
          visibleStep === "ready"
            ? receiverConfigured
              ? "Manage Receivers"
              : "Set Up Receiver"
            : undefined
        }
        secondaryOnClick={visibleStep === "ready" ? onOpenReceiver : undefined}
        betaComplete={betaComplete}
        profileAddressComplete={profileAddressComplete}
        profileBasicsComplete={Boolean(profileBasicsComplete)}
      >
        {visibleStep === "profileBasics" ? (
          <ProfileBasicsPage
            formId={profileBasicsFormId}
            onChangeField={onChangeProfileField}
            onChangePhone={onChangeProfilePhone}
            onSubmit={handleProfileBasicsNext}
            profileDetailsRequired={profileDetailsRequired}
            profileDraft={profileDraft}
            requiresEmailUpdate={requiresEmailUpdate}
            timezoneDetectionMessage={timezoneDetectionMessage}
            timeZoneOptions={timeZoneOptions}
            verifiedAccountEmail={verifiedAccountEmail}
          />
        ) : visibleStep === "profileAddress" ? (
          <ProfileAddressPage
            formId={profileAddressFormId}
            getPlacesAuthHeaders={getPlacesAuthHeaders}
            onApplyProfileAddress={onApplyProfileAddress}
            onChangeField={onChangeProfileField}
            onChangeZip={onChangeProfileZip}
            onSubmit={onSaveProfile}
            profileDetailsRequired={profileDetailsRequired}
            profileDraft={profileDraft}
          />
        ) : (
          <ReadyPage
            actionsDisabled={readyActionsDisabled}
            onImportAnything={onImportAnything}
            onOpenCarePland={onOpenCarePland}
            onOpenReceiver={onOpenReceiver}
          />
        )}
      </PersonalOnboardingShell>
    );
  }

  if (needsOnboarding || showReady) {
    return (
      <PersonalOnboardingShell
        currentStep={visibleStep}
        message={message}
        stepValidationMessage={stepValidationMessage}
        onBack={
          visibleStep === "profileAddress"
            ? goToProfileBasics
            : visibleStep === "ready"
              ? goToProfileAddress
              : undefined
        }
        onSelectStep={handleSelectStep}
        onSignOut={onSignOut}
        primaryDisabled={primaryDisabled}
        primaryFormId={
          visibleStep === "profileBasics" || visibleStep === "profileAddress"
            ? undefined
            : primaryFormId
        }
        primaryLabel={primaryLabel}
        primaryOnClick={
          visibleStep === "ready"
            ? onOpenCarePland
            : visibleStep === "profileBasics"
              ? handleProfileBasicsNextClick
            : visibleStep === "profileAddress"
              ? handleProfileAddressNextClick
              : undefined
        }
        secondaryDisabled={visibleStep === "ready" ? false : undefined}
        secondaryLabel={
          visibleStep === "ready"
            ? receiverConfigured
              ? "Manage Receivers"
              : "Set Up Receiver"
            : undefined
        }
        secondaryOnClick={visibleStep === "ready" ? onOpenReceiver : undefined}
        betaComplete={betaComplete}
        profileAddressComplete={profileAddressComplete}
        profileBasicsComplete={Boolean(profileBasicsComplete)}
      >
        {visibleStep === "profileBasics" ? (
          <ProfileBasicsPage
            formId={profileBasicsFormId}
            onChangeField={onChangeProfileField}
            onChangePhone={onChangeProfilePhone}
            onSubmit={handleProfileBasicsNext}
            profileDetailsRequired={profileDetailsRequired}
            profileDraft={profileDraft}
            requiresEmailUpdate={requiresEmailUpdate}
            timezoneDetectionMessage={timezoneDetectionMessage}
            timeZoneOptions={timeZoneOptions}
            verifiedAccountEmail={verifiedAccountEmail}
          />
        ) : visibleStep === "profileAddress" ? (
          <ProfileAddressPage
            formId={profileAddressFormId}
            getPlacesAuthHeaders={getPlacesAuthHeaders}
            onApplyProfileAddress={onApplyProfileAddress}
            onChangeField={onChangeProfileField}
            onChangeZip={onChangeProfileZip}
            onSubmit={onSaveProfile}
            profileDetailsRequired={profileDetailsRequired}
            profileDraft={profileDraft}
          />
        ) : (
          <ReadyPage
            actionsDisabled={readyActionsDisabled}
            onImportAnything={onImportAnything}
            onOpenCarePland={onOpenCarePland}
            onOpenReceiver={onOpenReceiver}
          />
        )}
      </PersonalOnboardingShell>
    );
  }

  return null;
}

function PersonalOnboardingShell({
  children,
  currentStep,
  message,
  stepValidationMessage,
  onBack,
  onSelectStep,
  onSignOut,
  primaryDisabled,
  primaryFormId,
  primaryLabel,
  primaryOnClick,
  secondaryDisabled,
  secondaryLabel,
  secondaryOnClick,
  betaComplete,
  profileAddressComplete,
  profileBasicsComplete,
}: {
  children: ReactNode;
  currentStep: PersonalOnboardingStep;
  message: string;
  stepValidationMessage?: string;
  onBack?: () => void;
  onSelectStep: (step: PersonalOnboardingStep) => void;
  onSignOut: () => void;
  primaryDisabled: boolean;
  primaryFormId?: string;
  primaryLabel: string;
  primaryOnClick?: () => void;
  secondaryDisabled?: boolean;
  secondaryLabel?: string;
  secondaryOnClick?: () => void;
  betaComplete: boolean;
  profileAddressComplete: boolean;
  profileBasicsComplete: boolean;
}) {
  const viewportSize = useViewportSize();
  const availableViewportWidth = Math.max(
    320,
    viewportSize.width - personalSetupViewportMargin * 2
  );
  const availableViewportHeight = Math.max(
    320,
    viewportSize.height - personalSetupViewportMargin * 2
  );
  const canvasScale = Math.min(
    1,
    availableViewportWidth / personalSetupCanvasWidth,
    availableViewportHeight / personalSetupCanvasHeight
  );
  const scaledCanvasWidth = personalSetupCanvasWidth * canvasScale;
  const scaledCanvasHeight = personalSetupCanvasHeight * canvasScale;
  const progressItems = [
    {
      complete: betaComplete,
      id: "earlyAccess",
      label: "Early Access",
      ready: betaComplete,
    },
    {
      complete: profileBasicsComplete,
      id: "profileBasics",
      label: "Basic Info",
      ready: profileBasicsComplete,
    },
    {
      complete: profileAddressComplete,
      id: "profileAddress",
      label: "Address",
      ready: profileAddressComplete,
    },
    {
      complete: betaComplete && profileBasicsComplete && profileAddressComplete,
      id: "ready",
      label: "You’re Ready",
      ready: betaComplete && profileBasicsComplete && profileAddressComplete,
    },
  ] as const;

  return (
    <section className="grid min-h-screen place-items-center py-4">
      <div
        style={{
          height: `${scaledCanvasHeight}px`,
          width: `${scaledCanvasWidth}px`,
        }}
      >
        <div
          className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-[#d6e3f2]"
          style={{
            height: `${personalSetupCanvasHeight}px`,
            transform: `scale(${canvasScale})`,
            transformOrigin: "top left",
            width: `${personalSetupCanvasWidth}px`,
          }}
        >
          <header className="bg-[#f8fbff] px-8 pb-0 pt-5 sm:px-12 sm:pt-6 lg:px-14">
            <div className="relative border-b border-[#d6e3f2] pb-4">
              <button
                aria-label="Sign out"
                className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-lg bg-transparent text-xl font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                onClick={onSignOut}
                type="button"
              >
                ×
              </button>
              <nav aria-label="Personal setup progress">
                <ol className="grid grid-cols-4 gap-3">
                  {progressItems.map((item, index) => {
                    const active = item.id === currentStep;
                    const itemClassName = active
                        ? "bg-[#2f6f9f] text-white"
                      : item.complete
                        ? "bg-[#e5f7ee] text-[#176342]"
                        : "bg-[#edf1f4] text-[#5f6e84]";

                    return (
                      <li className="min-w-0" key={item.id}>
                        {index === 0 ? (
                          <div className="mb-3 flex min-h-12 items-center gap-3 pr-2">
                            <Image
                              alt=""
                              aria-hidden="true"
                              className="h-11 w-11 shrink-0 rounded-full"
                              height={44}
                              priority
                              src="/carepland-loop-mark.png"
                              width={44}
                            />
                            <p className="text-[11px] font-black uppercase leading-tight tracking-normal text-[#5f6e84]">
                              CarePland Personal Setup
                            </p>
                          </div>
                        ) : (
                          <div className="mb-3 min-h-12" />
                        )}
                        <button
                          aria-current={active ? "step" : undefined}
                          className={`block w-full rounded-full px-4 py-3 text-center text-base font-black hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#4e84b2] ${itemClassName}`}
                          onClick={() => onSelectStep(item.id)}
                          type="button"
                        >
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            </div>
          </header>

        <div className="flex-1 overflow-y-auto px-8 py-6 sm:px-12 lg:px-14">
          {children}
          {stepValidationMessage ? (
            <p
              className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold leading-snug text-amber-900"
              role="alert"
            >
              {stepValidationMessage}
            </p>
          ) : null}
          {message ? (
            <p className="mt-5 rounded-lg border border-[#d6e3f2] bg-[#f8fbff] px-4 py-3 text-sm font-bold leading-snug text-[#345d83]">
              {message}
            </p>
          ) : null}
        </div>

        <footer className="sticky bottom-0 bg-white/95 px-8 backdrop-blur sm:px-12 lg:px-14">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d6e3f2] py-4">
            <button
              className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-sm font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
              onClick={onBack ?? onSignOut}
              type="button"
            >
              {onBack ? "Back" : "Sign out"}
            </button>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {secondaryLabel ? (
                <button
                  className="min-h-11 rounded-lg border border-[#cbd9e7] bg-white px-4 text-sm font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2] disabled:cursor-not-allowed disabled:opacity-55"
                  disabled={secondaryDisabled}
                  onClick={secondaryOnClick}
                  type="button"
                >
                  {secondaryLabel}
                </button>
              ) : null}
              <button
                className="min-h-11 rounded-lg bg-[#2f6f9f] px-5 text-sm font-black text-white hover:bg-[#285f89] focus:outline-none focus:ring-2 focus:ring-[#4e84b2] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={primaryDisabled}
                form={primaryFormId}
                onClick={primaryOnClick}
                type={primaryFormId ? "submit" : "button"}
              >
                {primaryLabel}
              </button>
            </div>
          </div>
        </footer>
        </div>
      </div>
    </section>
  );
}

function ReadyPage({
  actionsDisabled,
  onImportAnything,
  onOpenCarePland,
  onOpenReceiver,
}: {
  actionsDisabled: boolean;
  onImportAnything: () => void;
  onOpenCarePland: () => void;
  onOpenReceiver: () => void;
}) {
  return (
    <section className="flex h-full items-center">
      <div className="max-w-2xl">
        <h2 className="text-5xl font-black leading-tight text-[#172f49]">
          You&apos;re Ready.
        </h2>
        <p className="mt-5 max-w-xl text-xl font-semibold leading-relaxed text-[#4d6074]">
          Your CarePland account is ready to use.
        </p>

        <div className="mt-8">
          <div className="grid gap-4">
            <ReadyActionRow
              description="Import appointments, visit notes, and other health details."
              disabled={actionsDisabled}
              icon="📥"
              onClick={onImportAnything}
              title="Import Anything"
            />
            <ReadyActionRow
              description="Set up Receiver for yourself or someone you care about."
              disabled={actionsDisabled}
              info={
                <InfoPopover
                  primaryActionLabel="Set Up Receiver"
                  triggerLabel="Learn more"
                  title="What is Receiver?"
                  onPrimaryAction={onOpenReceiver}
                >
                  <p>
                    Receiver is a simplified CarePland experience designed for
                    another device, such as an Android tablet, iPad, or
                    computer.
                  </p>
                  <p>
                    It provides an uncluttered interface for people who benefit
                    from a simpler experience.
                  </p>
                  <p>Examples include:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Reading messages</li>
                    <li>Requesting help</li>
                    <li>Receiving reminders</li>
                    <li>Joining calls (when available)</li>
                  </ul>
                  <p>Receiver is optional and can always be installed later.</p>
                </InfoPopover>
              }
              icon="📺"
              onClick={onOpenReceiver}
              title="Set Up Receiver"
            />
            <ReadyActionRow
              description={
                <>
                  Ask questions or get help anywhere in CarePland using the{" "}
                  <strong>Ask</strong> button.
                </>
              }
              disabled={actionsDisabled}
              icon={<AskButtonPreview />}
              onClick={onOpenCarePland}
              title="Ask"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ReadyActionRow({
  description,
  disabled,
  info,
  icon,
  onClick,
  title,
}: {
  description: ReactNode;
  disabled: boolean;
  info?: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <div className="flex items-start gap-4 py-2">
      <span aria-hidden="true" className="mt-0.5 w-20 shrink-0 text-2xl leading-none">
        {icon}
      </span>
      <span>
        <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <button
            className="text-left text-lg font-black leading-tight text-[#2B6198] focus:outline-none focus:ring-2 focus:ring-[#4e84b2] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={disabled}
            onClick={onClick}
            type="button"
          >
            {title}
          </button>
          {info}
        </span>
        <span className="mt-1 block text-sm font-semibold leading-snug text-[#5f6e84]">
          {description}
        </span>
      </span>
    </div>
  );
}

function AskButtonPreview() {
  return (
    <span className="block h-12 w-20">
      <AskSpeechBubbleIcon />
    </span>
  );
}

function InfoPopover({
  children,
  onPrimaryAction,
  primaryActionLabel,
  title,
  triggerLabel = "What's this?",
}: {
  children: ReactNode;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
  title: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  function closePopover() {
    setOpen(false);
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePopover();
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="text-sm font-black text-[#2f6f9f] underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        type="button"
      >
        {triggerLabel}
      </button>
      {open ? (
        <div
          aria-labelledby={titleId}
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-[#173150]/25 px-4"
          role="dialog"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2
              className="text-2xl font-black leading-tight text-[#172f49]"
              id={titleId}
            >
              {title}
            </h2>
            <div className="mt-4 space-y-3 text-sm font-semibold leading-relaxed text-[#4d6074]">
              {children}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                autoFocus
                className="min-h-10 rounded-lg border border-[#cbd9e7] bg-white px-4 text-sm font-black text-[#173150] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closePopover();
                }}
                type="button"
              >
                Close
              </button>
              <button
                className="min-h-10 rounded-lg bg-[#2f6f9f] px-4 text-sm font-black text-white focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpen(false);
                  onPrimaryAction();
                }}
                type="button"
              >
                {primaryActionLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function useViewportSize() {
  const viewportSnapshotValue = useSyncExternalStore(
    subscribeToViewportResize,
    viewportSnapshot,
    defaultViewportSnapshot
  );
  const [width, height] = viewportSnapshotValue.split("x").map(Number);

  return {
    height,
    width,
  };
}

function subscribeToViewportResize(onStoreChange: () => void) {
  window.addEventListener("resize", onStoreChange);

  return () => {
    window.removeEventListener("resize", onStoreChange);
  };
}

function viewportSnapshot() {
  return `${window.innerWidth}x${window.innerHeight}`;
}

function defaultViewportSnapshot() {
  return `${personalSetupCanvasWidth}x${personalSetupCanvasHeight}`;
}

function ProfileBasicsPage({
  formId,
  onChangeField,
  onChangePhone,
  onSubmit,
  profileDetailsRequired,
  profileDraft,
  requiresEmailUpdate,
  timezoneDetectionMessage,
  timeZoneOptions,
  verifiedAccountEmail,
}: {
  formId: string;
  onChangeField: (field: keyof ProfileDraft, value: string) => void;
  onChangePhone: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  profileDetailsRequired: boolean;
  profileDraft: ProfileDraft;
  requiresEmailUpdate: boolean;
  timezoneDetectionMessage?: string;
  timeZoneOptions: TimeZoneOption[];
  verifiedAccountEmail: string;
}) {
  const requirementLabel = profileDetailsRequired ? "required" : "optional";

  return (
    <>
      <form className="grid gap-4 md:grid-cols-2" id={formId} onSubmit={onSubmit}>
        <label className="block text-sm font-medium text-slate-700">
          <span className="flex items-center justify-between gap-3">
            <span>First name</span>
            <span className="text-xs font-normal text-slate-400">
              {requirementLabel}
            </span>
          </span>
          <input
            autoComplete="given-name"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => onChangeField("givenName", event.target.value)}
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
            autoComplete="family-name"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => onChangeField("familyName", event.target.value)}
            required={profileDetailsRequired}
            type="text"
            value={profileDraft.familyName}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Display name
          <input
            autoComplete="nickname"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => onChangeField("displayName", event.target.value)}
            placeholder="Optional, if different"
            type="text"
            value={profileDraft.displayName}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          <span className="flex items-center justify-between gap-3">
            <span>Phone</span>
            <span className="text-xs font-normal text-slate-400">
              {requirementLabel}
            </span>
          </span>
          <input
            autoComplete="tel"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            inputMode="tel"
            onChange={(event) => onChangePhone(event.target.value)}
            placeholder="(___) ___-____"
            required={profileDetailsRequired}
            type="tel"
            value={profileDraft.phone}
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
            onChange={(event) => onChangeField("timezone", event.target.value)}
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
          {timezoneDetectionMessage ? (
            <p className="mt-2 text-xs font-normal text-slate-500">
              {timezoneDetectionMessage}
            </p>
          ) : null}
        </label>
        <label className="block text-sm font-medium text-slate-700">
          <span>Email</span>
          {requiresEmailUpdate ? (
            <input
              autoComplete="email"
              className="mt-2 w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-base"
              inputMode="email"
              onChange={(event) => onChangeField("email", event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={profileDraft.email}
            />
          ) : (
            <p className="mt-2 min-h-10 py-2 text-base font-semibold text-[#173150]">
              {verifiedAccountEmail || "Verified account email"}
            </p>
          )}
        </label>
      </form>
    </>
  );
}

function ProfileAddressPage({
  formId,
  getPlacesAuthHeaders,
  onApplyProfileAddress,
  onChangeField,
  onChangeZip,
  onSubmit,
  profileDetailsRequired,
  profileDraft,
}: {
  formId: string;
  getPlacesAuthHeaders: () => Promise<Record<string, string>>;
  onApplyProfileAddress: (address: PlaceAddressResult) => void;
  onChangeField: (field: keyof ProfileDraft, value: string) => void;
  onChangeZip: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  profileDetailsRequired: boolean;
  profileDraft: ProfileDraft;
}) {
  const requirementLabel = profileDetailsRequired ? "required" : "optional";

  return (
    <>
      <form className="grid gap-4 md:grid-cols-2" id={formId} onSubmit={onSubmit}>
        <AddressAutocompleteField
          className="md:col-span-2"
          getAuthHeaders={getPlacesAuthHeaders}
          onApplyAddress={onApplyProfileAddress}
          onChange={(value) => onChangeField("addressLine1", value)}
          placeholder="Start typing your address"
          value={profileDraft.addressLine1}
        />
        <label className="block text-sm font-medium text-slate-700 md:col-span-2">
          Address line 2
          <input
            autoComplete="address-line2"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => onChangeField("addressLine2", event.target.value)}
            placeholder="Optional"
            value={profileDraft.addressLine2}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          City
          <input
            autoComplete="address-level2"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => onChangeField("city", event.target.value)}
            value={profileDraft.city}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          State
          <input
            autoComplete="address-level1"
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
            autoComplete="postal-code"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            inputMode="numeric"
            maxLength={10}
            onChange={(event) => onChangeZip(event.target.value)}
            placeholder="12345"
            title="Use 12345 or 12345-6789."
            value={profileDraft.postalCode}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Country
          <input
            autoComplete="country-name"
            className="mt-2 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-base text-slate-500"
            disabled
            value="United States"
          />
        </label>
      </form>
    </>
  );
}
