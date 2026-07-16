import { FormEvent, useRef, useState } from "react";
import { type ProfileDraft } from "../../../lib/personal/profile/profileDraft";
import { type PlaceAddressResult } from "../../../lib/platform/integrations/places";
import {
  ManagedByHouseholdHeart,
  PersonAvatar,
} from "../../shared/PersonAvatar";
import { ManagedCareVipHelp } from "../../shared/ManagedCareVipHelp";
import { gentleSmallSecondaryButtonClass } from "../../shared/uiStyles";
import { AddressAutocompleteField } from "./AddressAutocompleteField";

type TimeZoneOption = {
  label: string;
  value: string;
};

type ProfileContactPerson = {
  avatarAltText?: string | null;
  avatarEmoji?: string | null;
  avatarIsDefault?: boolean;
  avatarPersonId?: string | null;
  avatarType?: string | null;
  avatarUrl?: string | null;
  displayName: string;
  id: string;
  label?: string;
  managedByHousehold?: boolean | null;
  subjectType?: string | null;
};

type ProfileContactDetailsFormProps = {
  accountPersonId?: string;
  disableWhenUnchanged?: boolean;
  hasUnsavedProfileChanges: boolean;
  getPlacesAuthHeaders: () => Promise<Record<string, string>>;
  onApplyProfileAddress: (address: PlaceAddressResult) => void;
  onChangeField: (field: keyof ProfileDraft, value: string) => void;
  onChangePhone: (value: string) => void;
  onChangeZip: (value: string) => void;
  onChangeSelectedPersonId?: (personId: string) => void;
  onRenamePerson?: (subjectId: string, displayName: string) => Promise<void>;
  onRemoveAvatar?: (subjectId: string) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateManagedByHousehold?: (
    subjectId: string,
    managedByHousehold: boolean
  ) => Promise<void>;
  onUpdatePetType?: (subjectId: string, subjectType: string) => Promise<void>;
  onUploadAvatar?: (subjectId: string, file: File) => Promise<void>;
  primaryButtonClassName: string;
  profileContactPeople?: ProfileContactPerson[];
  profileDetailsRequired: boolean;
  profileDraft: ProfileDraft;
  requiresEmailUpdate: boolean;
  selectedPersonId?: string;
  savingProfile: boolean;
  secondaryButtonClassName: string;
  formId?: string;
  showSubmitButton?: boolean;
  submitLabel?: string;
  timezoneDetectionMessage?: string;
  timeZoneOptions: TimeZoneOption[];
  variant?: "card" | "inline";
  verifiedAccountEmail: string;
};

export function ProfileContactDetailsForm({
  accountPersonId = "account",
  disableWhenUnchanged = true,
  hasUnsavedProfileChanges,
  getPlacesAuthHeaders,
  onApplyProfileAddress,
  onChangeField,
  onChangePhone,
  onChangeZip,
  onChangeSelectedPersonId,
  onRenamePerson,
  onRemoveAvatar,
  onSubmit,
  onUpdateManagedByHousehold,
  onUpdatePetType,
  onUploadAvatar,
  primaryButtonClassName,
  profileContactPeople = [],
  profileDetailsRequired,
  profileDraft,
  requiresEmailUpdate,
  selectedPersonId = accountPersonId,
  savingProfile,
  secondaryButtonClassName,
  formId,
  showSubmitButton = true,
  submitLabel = "Save profile",
  timezoneDetectionMessage,
  timeZoneOptions,
  variant = "card",
  verifiedAccountEmail,
}: ProfileContactDetailsFormProps) {
  const [avatarPending, setAvatarPending] = useState(false);
  const requirementLabel = profileDetailsRequired ? "required" : "optional";
  const isInline = variant === "inline";
  const buttonDisabled =
    savingProfile || (disableWhenUnchanged && !hasUnsavedProfileChanges);
  const formClassName = isInline
    ? "mt-5 grid gap-4 md:grid-cols-2"
    : "rounded-lg border border-slate-200 bg-white p-5 shadow-sm";
  const fieldsClassName = isInline ? "contents" : "mt-3 grid gap-4 md:grid-cols-2";
  const visibleSelectedPersonId = profileContactPeople.some(
    (person) => person.id === selectedPersonId
  )
    ? selectedPersonId
    : accountPersonId;
  const selectedPerson = profileContactPeople.find(
    (person) => person.id === visibleSelectedPersonId
  );
  const showingAccountPerson = visibleSelectedPersonId === accountPersonId;
  const selectedAvatarPersonId =
    selectedPerson?.avatarPersonId ??
    (!showingAccountPerson ? visibleSelectedPersonId : null);
  const avatarControls =
    selectedPerson && selectedAvatarPersonId && onRemoveAvatar && onUploadAvatar ? (
      <SelectedPersonAvatarControls
        avatarPending={avatarPending}
        key={selectedPerson.id}
        onRemoveAvatar={async () => {
          setAvatarPending(true);
          try {
            await onRemoveAvatar(selectedAvatarPersonId);
          } finally {
            setAvatarPending(false);
          }
        }}
        onUploadAvatar={async (file) => {
          setAvatarPending(true);
          try {
            await onUploadAvatar(selectedAvatarPersonId, file);
          } finally {
            setAvatarPending(false);
          }
        }}
        onRenamePerson={
          onRenamePerson
            ? async (displayName) => {
                await onRenamePerson(selectedAvatarPersonId, displayName);
              }
            : undefined
        }
        onUpdatePetType={
          onUpdatePetType
            ? async (subjectType) => {
                await onUpdatePetType(selectedAvatarPersonId, subjectType);
              }
            : undefined
        }
        onUpdateManagedByHousehold={
          onUpdateManagedByHousehold
            ? async (managedByHousehold) => {
                await onUpdateManagedByHousehold(
                  selectedAvatarPersonId,
                  managedByHousehold
                );
              }
            : undefined
        }
        person={selectedPerson}
      />
    ) : null;
  const header = isInline ? null : (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Contact details
        </h3>
      </div>
      {profileContactPeople.length > 1 && onChangeSelectedPersonId ? (
        <div
          aria-label="Choose whose details to view"
          className="flex flex-wrap items-center gap-2"
        >
          {profileContactPeople.map((person) => {
            const selected = person.id === visibleSelectedPersonId;
            const firstName =
              person.label ?? firstNameForProfilePerson(person.displayName);

            return (
              <button
                aria-pressed={selected}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-semibold transition ${
                  selected
                    ? "bg-blue-100 text-blue-950 ring-1 ring-blue-200"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-950"
                }`}
                key={person.id}
                onClick={() => onChangeSelectedPersonId(person.id)}
                type="button"
              >
                <PersonAvatar person={person} size="sm" />
                <span>
                  {firstName}
                  {person.managedByHousehold ? (
                    <ManagedByHouseholdHeart className="ml-1" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );

  if (!showingAccountPerson) {
    return (
      <section className={formClassName}>
        {header}
        {avatarControls}
      </section>
    );
  }

  return (
    <form className={formClassName} id={formId} onSubmit={onSubmit}>
      {header}
      <div className={fieldsClassName}>
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
                inputMode="email"
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
            <span>First name</span>
            <span className="text-xs font-normal text-slate-400">
              {requirementLabel}
            </span>
          </span>
          <input
            autoComplete="given-name"
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
            autoComplete="family-name"
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
            autoComplete="nickname"
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
          {timezoneDetectionMessage ? (
            <p className="mt-2 text-xs font-normal text-slate-500">
              {timezoneDetectionMessage}
            </p>
          ) : null}
        </label>
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
            autoComplete="address-level2"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
            onChange={(event) => onChangeField("city", event.target.value)}
            value={profileDraft.city}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          State / region
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
            autoComplete="country"
            className="mt-2 w-full rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-base text-slate-500"
            disabled
            value="United States"
          />
        </label>
        {showSubmitButton ? (
          <div className="md:col-span-2">
            <button
              className={
                hasUnsavedProfileChanges
                  ? primaryButtonClassName
                  : secondaryButtonClassName
              }
              disabled={buttonDisabled}
              type="submit"
            >
              {savingProfile ? "Saving..." : submitLabel}
            </button>
          </div>
        ) : null}
      </div>
      {avatarControls}
    </form>
  );
}

function SelectedPersonAvatarControls({
  avatarPending,
  onRemoveAvatar,
  onUpdateManagedByHousehold,
  onRenamePerson,
  onUpdatePetType,
  onUploadAvatar,
  person,
}: {
  avatarPending: boolean;
  onRemoveAvatar: () => Promise<void>;
  onRenamePerson?: (displayName: string) => Promise<void>;
  onUpdateManagedByHousehold?: (managedByHousehold: boolean) => Promise<void>;
  onUpdatePetType?: (subjectType: string) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  person: ProfileContactPerson;
}) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initialPetState = petStateFromSubjectType(person.subjectType);
  const [editingName, setEditingName] = useState(false);
  const [editingSpecies, setEditingSpecies] = useState(false);
  const [nameDraft, setNameDraft] = useState(person.displayName);
  const [otherPetDraft, setOtherPetDraft] = useState(initialPetState.otherValue);
  const [petEnabled, setPetEnabled] = useState(initialPetState.isPet);
  const [petKind, setPetKind] = useState<PetKind | null>(initialPetState.kind);
  const [managedByHousehold, setManagedByHousehold] = useState(
    Boolean(person.managedByHousehold)
  );
  const [managedByHouseholdPending, setManagedByHouseholdPending] =
    useState(false);
  const [petPending, setPetPending] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const managedByHouseholdLocked = petEnabled;
  const managedByHouseholdChecked =
    managedByHouseholdLocked || managedByHousehold;
  const petDefaultAvatarEmoji =
    petEnabled && petKind ? defaultPetAvatarEmojiForKind(petKind) : "";
  const realAvatarUrl =
    person.avatarUrl &&
    !person.avatarIsDefault &&
    !isDefaultPetAvatarUrl(person.avatarUrl)
      ? person.avatarUrl
      : "";
  const visibleAvatarPerson = {
    ...person,
    avatarEmoji: realAvatarUrl ? null : petDefaultAvatarEmoji || person.avatarEmoji,
    avatarUrl: realAvatarUrl,
  };
  const hasRemovableAvatar = Boolean(realAvatarUrl);

  async function handleUpload(file?: File) {
    if (!file || avatarPending) {
      return;
    }

    await onUploadAvatar(file);

    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemoveAvatar() {
    if (avatarPending || !hasRemovableAvatar) {
      return;
    }

    const confirmed = window.confirm(`Remove ${person.displayName}'s avatar?`);

    if (!confirmed) {
      return;
    }

    await onRemoveAvatar();
  }

  function savePetType(
    nextSubjectType: string,
    nextKind: PetKind | null,
    options: { keepEditing?: boolean } = {}
  ) {
    if (!onUpdatePetType || petPending) {
      return;
    }

    const previousEditingSpecies = editingSpecies;

    setPetPending(true);

    void onUpdatePetType(nextSubjectType)
      .then(() => {
        setPetEnabled(nextSubjectType !== "other");
        setPetKind(nextKind);
        setEditingSpecies(Boolean(options.keepEditing));
      })
      .catch(() => {
        setEditingSpecies(previousEditingSpecies);
      })
      .finally(() => {
        setPetPending(false);
      });
  }

  function startPetSpeciesEdit() {
    setPetEnabled(true);
    setPetKind(null);
    setEditingSpecies(true);
  }

  function saveManagedByHousehold(nextManagedByHousehold: boolean) {
    if (
      !onUpdateManagedByHousehold ||
      managedByHouseholdPending ||
      managedByHouseholdLocked
    ) {
      return;
    }

    const previousManagedByHousehold = managedByHousehold;

    setManagedByHousehold(nextManagedByHousehold);
    setManagedByHouseholdPending(true);

    void onUpdateManagedByHousehold(nextManagedByHousehold)
      .catch(() => {
        setManagedByHousehold(previousManagedByHousehold);
      })
      .finally(() => {
        setManagedByHouseholdPending(false);
      });
  }

  async function handleRename() {
    const trimmedName = nameDraft.trim();

    if (!onRenamePerson || !trimmedName || trimmedName === person.displayName) {
      setEditingName(false);
      setNameDraft(person.displayName);
      return;
    }

    setRenaming(true);
    try {
      await onRenamePerson(trimmedName);
      setEditingName(false);
    } finally {
      setRenaming(false);
    }
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
      <span className="relative shrink-0">
        <PersonAvatar
          person={visibleAvatarPerson}
          className="h-14 w-14 text-lg"
          size="md"
        />
        {hasRemovableAvatar ? (
          <button
            aria-label={`Remove ${person.displayName}'s avatar`}
            className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-white bg-slate-800 text-sm font-bold leading-none text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
            disabled={avatarPending}
            onClick={() => void handleRemoveAvatar()}
            type="button"
          >
            ×
          </button>
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        {editingName ? (
          <div className="flex max-w-md flex-wrap items-center gap-2">
            <input
              className="min-h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900"
              onChange={(event) => setNameDraft(event.target.value)}
              value={nameDraft}
            />
            <button
              className={gentleSmallSecondaryButtonClass}
              disabled={renaming || !nameDraft.trim()}
              onClick={() => void handleRename()}
              type="button"
            >
              Save
            </button>
            <button
              className="text-sm font-semibold text-slate-500 hover:text-slate-800"
              disabled={renaming}
              onClick={() => {
                setEditingName(false);
                setNameDraft(person.displayName);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
              <p className="shrink-0 truncate text-sm font-semibold text-slate-900">
                {person.displayName}
              </p>
              {managedByHouseholdChecked ? (
                <ManagedByHouseholdHeart className="shrink-0" />
              ) : null}
              {onRenamePerson ? (
                <button
                  aria-label={`Edit ${person.displayName}`}
                  className="grid h-7 w-7 place-items-center rounded-full text-slate-400 transition hover:bg-blue-50 hover:text-blue-800"
                  onClick={() => {
                    setNameDraft(person.displayName);
                    setEditingName(true);
                  }}
                  type="button"
                >
                  ✎
                </button>
              ) : null}
              {onUpdatePetType ? (
                <>
                  {petEnabled && !editingSpecies ? (
                    <>
                      {petKind ? (
                        <span className="shrink-0 text-sm font-semibold text-slate-600">
                          {petLabelForKind(petKind, otherPetDraft)}
                        </span>
                      ) : null}
                      <button
                        className="ml-2 shrink-0 px-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
                        disabled={petPending}
                        onClick={() => setEditingSpecies(true)}
                        type="button"
                      >
                        Change Species
                      </button>
                      <button
                        className="ml-1 shrink-0 px-1 text-xs font-semibold text-slate-500 hover:text-rose-700"
                        disabled={petPending}
                        onClick={() => savePetType("other", null)}
                        type="button"
                      >
                        Not a Pet
                      </button>
                    </>
                  ) : null}
                  {!petEnabled ? (
                    <label className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-600">
                      <input
                        checked={petEnabled}
                        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                        disabled={petPending}
                        onChange={(event) => {
                          if (event.target.checked) {
                            startPetSpeciesEdit();
                          }
                        }}
                        type="checkbox"
                      />
                      <span>Pet</span>
                    </label>
                  ) : null}
                  {editingSpecies ? (
                    <>
                      <PetKindButton
                        disabled={petPending}
                        label="Cat"
                        onClick={() => savePetType("cat", "cat")}
                        selected={petKind === "cat"}
                      />
                      <PetKindButton
                        disabled={petPending}
                        label="Dog"
                        onClick={() => savePetType("dog", "dog")}
                        selected={petKind === "dog"}
                      />
                      <PetKindButton
                        disabled={petPending}
                        label="Other"
                        onClick={() => setPetKind("other")}
                        selected={petKind === "other"}
                      />
                      {petKind === "other" ? (
                        <div className="inline-flex shrink-0 items-center gap-2">
                          <input
                            className="min-h-9 w-32 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                            disabled={petPending}
                            onChange={(event) =>
                              setOtherPetDraft(event.target.value)
                            }
                            placeholder="Type"
                            value={otherPetDraft}
                          />
                        </div>
                      ) : null}
                      <button
                        className="shrink-0 text-sm font-semibold text-slate-500 hover:text-slate-800"
                        disabled={petPending}
                        onClick={() => {
                          if (!petKind) {
                            setPetEnabled(false);
                          } else if (petKind === "other") {
                            const customType = otherPetDraft.trim();
                            savePetType(
                              customType ? `pet:${customType}` : "pet",
                              "other"
                            );
                            return;
                          }

                          setEditingSpecies(false);
                        }}
                        type="button"
                      >
                        Save type
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}
              {onUpdateManagedByHousehold ? (
                <span className="inline-flex shrink-0 items-center gap-1.5">
                  <label
                    className={`inline-flex items-center gap-2 text-sm font-semibold ${
                      managedByHouseholdLocked
                        ? "cursor-not-allowed text-slate-400"
                        : "text-slate-600"
                    }`}
                    title={
                      managedByHouseholdLocked
                        ? "Pets are Managed Care VIPs."
                        : "Managed Care VIP"
                    }
                  >
                    <input
                      checked={managedByHouseholdChecked}
                      className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300"
                      disabled={
                        managedByHouseholdLocked || managedByHouseholdPending
                      }
                      onChange={(event) =>
                        saveManagedByHousehold(event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span>Managed Care VIP</span>
                  </label>
                  <ManagedCareVipHelp
                    tooltipId={`profile-managed-care-vip-help-${person.id}`}
                  />
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
      <input
        accept="image/*"
        capture="user"
        className="sr-only"
        onChange={(event) => void handleUpload(event.target.files?.[0])}
        ref={cameraInputRef}
        type="file"
      />
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => void handleUpload(event.target.files?.[0])}
        ref={fileInputRef}
        type="file"
      />
      <button
        className={gentleSmallSecondaryButtonClass}
        disabled={avatarPending}
        onClick={() => cameraInputRef.current?.click()}
        type="button"
      >
        Take Photo
      </button>
      <button
        className={gentleSmallSecondaryButtonClass}
        disabled={avatarPending}
        onClick={() => fileInputRef.current?.click()}
        type="button"
      >
        Choose Photo
      </button>
    </div>
  );
}

type PetKind = "cat" | "dog" | "other";

function defaultPetAvatarEmojiForKind(kind: PetKind) {
  if (kind === "cat") {
    return "🐱";
  }

  if (kind === "dog") {
    return "🐶";
  }

  return "🐾";
}

function isDefaultPetAvatarUrl(avatarUrl?: string | null) {
  return ["/avatar-cat.svg", "/avatar-dog.svg", "/avatar-pet.svg"].includes(
    avatarUrl ?? ""
  );
}

function petLabelForKind(kind: PetKind, otherValue: string) {
  if (kind === "cat") {
    return "Cat";
  }

  if (kind === "dog") {
    return "Dog";
  }

  const trimmedOtherValue = otherValue.trim();

  return trimmedOtherValue || "Pet";
}

function PetKindButton({
  disabled,
  label,
  onClick,
  selected,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-pressed={selected}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
        selected
          ? "bg-blue-100 text-blue-950 ring-1 ring-blue-200"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-900"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function petStateFromSubjectType(subjectType?: string | null): {
  isPet: boolean;
  kind: PetKind;
  otherValue: string;
} {
  const rawSubjectType = subjectType?.trim() ?? "";
  const normalizedSubjectType = rawSubjectType.toLowerCase();

  if (normalizedSubjectType === "cat") {
    return { isPet: true, kind: "cat", otherValue: "" };
  }

  if (normalizedSubjectType === "dog") {
    return { isPet: true, kind: "dog", otherValue: "" };
  }

  if (normalizedSubjectType === "pet") {
    return { isPet: true, kind: "other", otherValue: "" };
  }

  if (normalizedSubjectType.startsWith("pet:")) {
    return {
      isPet: true,
      kind: "other",
      otherValue: rawSubjectType.slice(4).trim(),
    };
  }

  return { isPet: false, kind: "cat", otherValue: "" };
}

function firstNameForProfilePerson(displayName: string) {
  const trimmed = displayName.trim();

  if (!trimmed) {
    return "You";
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}
