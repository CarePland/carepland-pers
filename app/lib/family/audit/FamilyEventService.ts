import type {
  FamilyAuditEvent,
  SmsRelatedObjectType,
} from "../sms/types";

type CreateFamilyEventInput = {
  type: string;
  actorName: string;
  detail: string;
  householdId: string;
  memberId?: string;
  relatedObjectType?: SmsRelatedObjectType;
  relatedObjectId?: string;
  nowIso: string;
};

export function createFamilyEvent(input: CreateFamilyEventInput): FamilyAuditEvent {
  return {
    id: newId("family-event"),
    type: input.type,
    actorName: input.actorName,
    detail: input.detail,
    householdId: input.householdId,
    memberId: input.memberId,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    createdAt: input.nowIso,
  };
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
