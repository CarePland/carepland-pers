export type ImportAnythingOwnerPerson = {
  displayName: string;
  id: string;
};

export function importAnythingOwnerFromFocus({
  allSubjectsValue,
  currentOwnerPersonId = "",
  focusPersonId,
}: {
  allSubjectsValue: string;
  currentOwnerPersonId?: string;
  focusPersonId: string;
}) {
  const normalizedFocusPersonId = focusPersonId.trim();

  if (
    normalizedFocusPersonId &&
    normalizedFocusPersonId !== allSubjectsValue
  ) {
    return normalizedFocusPersonId;
  }

  return currentOwnerPersonId.trim();
}

export function importAnythingOwnerMismatch({
  allSubjectsValue,
  focusPersonId,
  ownerPersonId,
}: {
  allSubjectsValue: string;
  focusPersonId: string;
  ownerPersonId: string;
}) {
  const normalizedFocusPersonId = focusPersonId.trim();
  const normalizedOwnerPersonId = ownerPersonId.trim();

  return Boolean(
    normalizedFocusPersonId &&
      normalizedFocusPersonId !== allSubjectsValue &&
      normalizedOwnerPersonId &&
      normalizedOwnerPersonId !== normalizedFocusPersonId
  );
}

export function importAnythingOwnerMismatchNotice({
  allSubjectsValue,
  focusPerson,
  focusPersonId,
  ownerPerson,
  ownerPersonId,
}: {
  allSubjectsValue: string;
  focusPerson?: ImportAnythingOwnerPerson | null;
  focusPersonId: string;
  ownerPerson?: ImportAnythingOwnerPerson | null;
  ownerPersonId: string;
}) {
  if (
    !importAnythingOwnerMismatch({
      allSubjectsValue,
      focusPersonId,
      ownerPersonId,
    })
  ) {
    return null;
  }

  const focusName = focusPerson?.displayName?.trim() || "this person";
  const ownerName = ownerPerson?.displayName?.trim() || "the selected person";

  return {
    actionLabel: `Change import to ${focusName}`,
    focusName,
    message: `Global focus is now ${focusName}. Import is for ${ownerName}.`,
    ownerName,
  };
}
