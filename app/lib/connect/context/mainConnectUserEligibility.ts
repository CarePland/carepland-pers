import type { ConnectPersPerson } from "./types";

export function isConnectPetSubjectType(subjectType?: string | null) {
  const normalizedType = String(subjectType || "").trim().toLowerCase();

  return (
    normalizedType === "cat" ||
    normalizedType === "dog" ||
    normalizedType === "pet" ||
    normalizedType.startsWith("pet:")
  );
}

export function isEligibleMainConnectUserPerson(person?: Pick<ConnectPersPerson, "id" | "isActive" | "subjectType"> | null) {
  return Boolean(
    person?.id &&
      person.isActive !== false &&
      !isConnectPetSubjectType(person.subjectType)
  );
}
