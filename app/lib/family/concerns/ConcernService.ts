import { newId } from "../audit/FamilyEventService";
import type { ConcernCandidate } from "../sms/types";
import type { FamilyMember } from "../types";

type CreateConcernInput = {
  householdId: string;
  member: FamilyMember;
  body: string;
  nowIso: string;
};

export function createConcernCandidate({
  householdId,
  member,
  body,
  nowIso,
}: CreateConcernInput): ConcernCandidate {
  return {
    id: newId("concern"),
    householdId,
    memberId: member.id,
    submittedByName: member.displayName,
    body,
    status: "needs_coordinator_review",
    createdAt: nowIso,
  };
}
