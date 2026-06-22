import type { Errand, FamilyMember } from "../types";

export type ErrandWorkflowResult = {
  errands: Errand[];
  detail: string;
};

export function assignErrandToMember(
  errands: Errand[],
  errandId: string,
  member: FamilyMember,
): ErrandWorkflowResult {
  return {
    errands: errands.map((errand) =>
      errand.id === errandId
        ? {
            ...errand,
            assignedMemberName: member.displayName,
            status: "assigned",
          }
        : errand,
    ),
    detail: `Assigned to ${member.displayName}`,
  };
}

export function completeErrand(
  errands: Errand[],
  errandId: string,
  member: FamilyMember,
): ErrandWorkflowResult {
  return {
    errands: errands.map((errand) =>
      errand.id === errandId
        ? {
            ...errand,
            assignedMemberName: errand.assignedMemberName ?? member.displayName,
            status: "completed",
          }
        : errand,
    ),
    detail: `Completed by ${member.displayName}`,
  };
}

export function markErrandUnableToComplete(
  errands: Errand[],
  errandId: string,
  member: FamilyMember,
): ErrandWorkflowResult {
  return {
    errands: errands.map((errand) =>
      errand.id === errandId
        ? {
            ...errand,
            assignedMemberName: errand.assignedMemberName ?? member.displayName,
            status: "unable_to_complete",
          }
        : errand,
    ),
    detail: `${member.displayName} cannot complete this Errand`,
  };
}

export function findErrand(errands: Errand[], errandId: string) {
  return errands.find((errand) => errand.id === errandId);
}

export function memberCanUpdateErrand(errand: Errand, member: FamilyMember) {
  return (
    errand.status !== "completed" &&
    (!errand.assignedMemberName ||
      errand.assignedMemberName === member.displayName ||
      errand.status === "available")
  );
}
