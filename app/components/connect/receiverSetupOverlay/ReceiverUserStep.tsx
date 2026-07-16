import { useState } from "react";

import { ReceiverPersonChoice } from "./ReceiverPersonChoice";
import { ReceiverSetupStatus } from "./ReceiverSetupStatus";
import type { ReceiverSetupStepProps } from "./types";
import { currentAccountReceiverUserDraftId } from "./utils";

export function ReceiverUserStep({
  contactOptions,
  connectContext,
  currentReceiverUser,
  draft,
  eligiblePeople,
  isReturningReceiverSetup,
  isSelfContact,
  onCancelReceiverUserChange,
  receiverUserPreparationStatus,
  selectedContact,
  selectedUser,
  setDraft,
}: ReceiverSetupStepProps) {
  const [changingReceiverUser, setChangingReceiverUser] = useState(false);
  const currentAccountPersonId = connectContext?.currentAccountPersonId || "";
  const showAccountProfileChoice = Boolean(
    connectContext?.currentAccountProfile?.displayName && !currentAccountPersonId
  );
  const selectedUserIsCurrentUser = Boolean(
    draft.receiverUserPersonId === currentAccountReceiverUserDraftId ||
      (selectedUser?.id && selectedUser.id === currentAccountPersonId)
  );
  const accountProfileChoice = {
    avatarType: "initials" as const,
    careCircleId: "",
    displayName: connectContext?.currentAccountProfile?.displayName || "You",
    id: currentAccountReceiverUserDraftId,
    isActive: true,
    subjectType: "other",
  };
  const visibleEligiblePeople = showAccountProfileChoice
    ? eligiblePeople.filter(
        (person) =>
          normalizedReceiverPersonName(person.displayName) !==
          normalizedReceiverPersonName(accountProfileChoice.displayName)
      )
    : eligiblePeople;
  const currentReceiverUserSelected = Boolean(
    isReturningReceiverSetup &&
      currentReceiverUser?.id &&
      draft.receiverUserPersonId === currentReceiverUser.id
  );
  const receiverMessageLine = receiverUserPreparationStatus
    ? {
        text: receiverUserPreparationStatus,
        tone: "warn" as const,
      }
    : isSelfContact
      ? {
          text: "You can't message yourself, so certain communication features will not work.",
          tone: "warn" as const,
        }
      : contactOptions.length
        ? {
            text: `Receiver messages will go to ${
              selectedContact?.displayName || contactOptions[0]?.displayName
            }`,
            tone: "default" as const,
          }
        : !selectedUserIsCurrentUser
          ? {
              text: "Receiver Contact is not resolved yet. CarePland will not invent or silently reroute a contact for this Receiver.",
              tone: "warn" as const,
            }
          : null;

  function cancelReceiverUserChange() {
    onCancelReceiverUserChange();
    setChangingReceiverUser(false);
  }

  function selectReceiverUser(personId: string) {
    setDraft((current) => ({
      ...current,
      receiverContactUserId: personId === currentAccountPersonId
        ? ""
        : current.receiverContactUserId,
      receiverUserPersonId: personId,
      section: "receiverUser",
    }));
  }

  const messageLine = receiverMessageLine ? (
    <p
      className={`flex min-h-14 items-center overflow-hidden px-1 text-xl font-bold leading-snug sm:text-2xl ${
        receiverMessageLine.tone === "warn" ? "text-[#6f4d00]" : "text-[#172f49]"
      }`}
      title={receiverMessageLine.text}
    >
      <span className="truncate">{receiverMessageLine.text}</span>
    </p>
  ) : null;

  if (
    isReturningReceiverSetup &&
    currentReceiverUser &&
    currentReceiverUserSelected &&
    !changingReceiverUser
  ) {
    return (
      <section className="grid gap-8 py-8 sm:gap-10 sm:py-10">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,22rem)] sm:items-center">
            <h2 className="text-3xl font-black text-[#172f49] sm:text-4xl">
              Current User:
            </h2>
            <ReceiverPersonChoice
              isCurrentUser={currentReceiverUser.id === currentAccountPersonId}
              onSelect={() => setChangingReceiverUser(true)}
              person={currentReceiverUser}
              selected
            />
          </div>
          <button
            className="min-h-12 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
            onClick={() => setChangingReceiverUser(true)}
            type="button"
          >
            Change
          </button>
        </div>
        {messageLine}
      </section>
    );
  }

  return (
    <section className="grid gap-8 py-8 sm:gap-10 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-3xl font-black text-[#172f49] sm:text-4xl">
          Who will use this Receiver?
        </h2>
        {isReturningReceiverSetup ? (
          <button
            className="min-h-12 rounded-lg border border-[#cbd9e7] bg-white px-5 text-base font-black text-[#173150] hover:bg-[#edf5fc] focus:outline-none focus:ring-2 focus:ring-[#4e84b2]"
            onClick={cancelReceiverUserChange}
            type="button"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {visibleEligiblePeople.length || showAccountProfileChoice ? (
        <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
          {showAccountProfileChoice ? (
            <ReceiverPersonChoice
              isCurrentUser
              onSelect={() =>
                setDraft((current) => ({
                  ...current,
                  receiverContactUserId: "",
                  receiverUserPersonId: currentAccountReceiverUserDraftId,
                  section: "receiverUser",
                }))
              }
              person={accountProfileChoice}
              selected={draft.receiverUserPersonId === currentAccountReceiverUserDraftId}
            />
          ) : null}
          {visibleEligiblePeople.map((person) => (
            <ReceiverPersonChoice
              isCurrentUser={person.id === currentAccountPersonId}
              key={person.id}
              onSelect={() => selectReceiverUser(person.id)}
              person={person}
              selected={draft.receiverUserPersonId === person.id}
            />
          ))}
        </div>
      ) : (
        <ReceiverSetupStatus tone="warn">
          Add an eligible CarePland person before setting up a Receiver. No placeholder Receiver
          User will be used.
        </ReceiverSetupStatus>
      )}

      {messageLine}
    </section>
  );
}

function normalizedReceiverPersonName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
