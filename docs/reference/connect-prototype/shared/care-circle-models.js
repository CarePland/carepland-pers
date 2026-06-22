export const MemberRole = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  RECEIVER_USER: "receiver_user",
  RECEIVER_PERSON: "receiver_person",
  COORDINATOR: "coordinator",
  PARTICIPANT: "participant",
});

export const AdminAccessLevel = Object.freeze({
  OWNER_PRIMARY_ADMIN: "owner_primary_admin",
  ADDITIONAL_ADMIN: "additional_admin",
  NONE: "none",
});

export const EscalationLevel = Object.freeze({
  NONE: "none",
  REQUEST_ATTENTION: "request_attention",
  PERSISTENT_RING: "persistent_ring",
  URGENT_BYPASS_QUIET_HOURS: "urgent_bypass_quiet_hours",
  DIRECT_AUDIO_VIDEO_OVERRIDE: "direct_audio_video_override",
});

export const ParticipantVisibility = Object.freeze({
  PRIVATE: "private",
  DISCOVERABLE: "discoverable",
});

export const ParticipantConnectionStatus = Object.freeze({
  NONE: "none",
  REQUESTED: "requested",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  BLOCKED: "blocked",
  REVOKED: "revoked",
});

export const ParticipantInterfaceMode = Object.freeze({
  SMS_FIRST: "sms_first",
  SECURE_LINK: "secure_link",
  APP_OPTIONAL: "app_optional",
});

export const SmsParticipantMessageStatus = Object.freeze({
  PENDING_CONFIRMATION: "pending_confirmation",
  SENT: "sent",
  CANCELED: "canceled",
  NEEDS_RECIPIENT: "needs_recipient",
  REJECTED: "rejected",
});

export const careCircleSeed = {
  careCircle: {
    id: "care-circle-mom",
    name: "Mom's Care Circle",
    displayName: "Mom's Care Circle",
    ownerUserId: "user-andrew",
    primaryAdminUserId: "user-andrew",
    additionalAdminUserId: "user-susan",
    receiverHouseholdId: "receiver-household-elizabeth-robert",
    primaryReceiverDeviceId: "receiver-device-kitchen",
    active: true,
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
  },
  receiverDevices: [
    {
      id: "receiver-device-kitchen",
      careCircleId: "care-circle-mom",
      receiverHouseholdId: "receiver-household-elizabeth-robert",
      receiverId: "living-room-receiver",
      name: "Kitchen Receiver",
      locationLabel: "Kitchen",
      status: "available",
      lastSeenAt: "",
      active: true,
    },
  ],
  receiverHouseholds: [
    {
      id: "receiver-household-elizabeth-robert",
      careCircleId: "care-circle-mom",
      displayName: "Elizabeth and Robert",
      defaultTarget: "household",
      active: true,
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    },
  ],
  receiverPeople: [
    {
      id: "receiver-person-elizabeth",
      careCircleId: "care-circle-mom",
      receiverHouseholdId: "receiver-household-elizabeth-robert",
      displayName: "Elizabeth",
      linkedCareVipId: "care-vip-elizabeth",
      active: true,
    },
    {
      id: "receiver-person-robert",
      careCircleId: "care-circle-mom",
      receiverHouseholdId: "receiver-household-elizabeth-robert",
      displayName: "Robert",
      linkedCareVipId: null,
      active: true,
    },
  ],
  escalationPolicies: [
    {
      id: "escalation-policy-household-default",
      careCircleId: "care-circle-mom",
      receiverHouseholdId: "receiver-household-elizabeth-robert",
      enabled: false,
      allowedUserIds: ["user-andrew"],
      escalationLevel: EscalationLevel.NONE,
      quietHoursBehavior: "respect_quiet_hours",
      consentStatus: "not_configured",
      createdAt: "2026-06-14T00:00:00.000Z",
      updatedAt: "2026-06-14T00:00:00.000Z",
    },
  ],
  members: [
    {
      id: "member-mom",
      careCircleId: "care-circle-mom",
      userId: "user-mom",
      displayName: "Mom",
      relationshipLabel: "Care VIP",
      role: MemberRole.RECEIVER_PERSON,
      legacyRole: "receiver_user",
      receiverPersonId: "receiver-person-elizabeth",
      adminAccessLevel: AdminAccessLevel.NONE,
      visibility: ParticipantVisibility.PRIVATE,
      canContactReceiver: false,
      canContactCoordinator: true,
      active: true,
    },
    {
      id: "member-andrew",
      careCircleId: "care-circle-mom",
      userId: "user-andrew",
      displayName: "Andrew",
      relationshipLabel: "Coordinator",
      role: MemberRole.OWNER,
      adminAccessLevel: AdminAccessLevel.OWNER_PRIMARY_ADMIN,
      isPrimaryAdmin: true,
      visibility: ParticipantVisibility.DISCOVERABLE,
      canContactReceiver: true,
      canContactCoordinator: true,
      active: true,
    },
    {
      id: "member-ann",
      careCircleId: "care-circle-mom",
      userId: "user-ann",
      displayName: "Cousin Ann",
      relationshipLabel: "Family",
      phoneNumber: "+15550104",
      role: MemberRole.PARTICIPANT,
      adminAccessLevel: AdminAccessLevel.NONE,
      participantInterfaceMode: ParticipantInterfaceMode.SMS_FIRST,
      visibility: ParticipantVisibility.DISCOVERABLE,
      canContactReceiver: true,
      canContactCoordinator: true,
      visibleToReceiver: true,
      active: true,
    },
    {
      id: "member-susan",
      careCircleId: "care-circle-mom",
      userId: "user-susan",
      displayName: "Susan",
      relationshipLabel: "Family",
      phoneNumber: "+15550106",
      role: MemberRole.ADMIN,
      adminAccessLevel: AdminAccessLevel.ADDITIONAL_ADMIN,
      isAdditionalAdmin: true,
      participantInterfaceMode: ParticipantInterfaceMode.SMS_FIRST,
      visibility: ParticipantVisibility.PRIVATE,
      canContactReceiver: true,
      canContactCoordinator: true,
      visibleToReceiver: true,
      active: true,
    },
    {
      id: "member-blaine",
      careCircleId: "care-circle-mom",
      userId: "user-blaine",
      displayName: "Blaine",
      relationshipLabel: "Neighbor",
      phoneNumber: "+15550108",
      role: MemberRole.PARTICIPANT,
      adminAccessLevel: AdminAccessLevel.NONE,
      participantInterfaceMode: ParticipantInterfaceMode.SMS_FIRST,
      visibility: ParticipantVisibility.DISCOVERABLE,
      canContactReceiver: true,
      canContactCoordinator: true,
      visibleToReceiver: false,
      active: true,
    },
  ],
  participantConnections: [],
};

export function createSmsParticipantMessageDraft({
  careCircleId,
  fromParticipantId,
  fromPhone,
  toType,
  toId,
  body,
}) {
  const createdAt = new Date().toISOString();
  return {
    careCircleId,
    fromParticipantId,
    fromPhone,
    toType,
    toId,
    body,
    source: "sms_participant",
    status: SmsParticipantMessageStatus.PENDING_CONFIRMATION,
    createdAt,
    updatedAt: createdAt,
    sentAt: "",
    heardAt: null,
    readAt: null,
  };
}

export function acceptedParticipantConnectionBetween(connections, firstMemberId, secondMemberId) {
  return connections.some((connection) => {
    const samePair =
      (connection.requesterParticipantId === firstMemberId && connection.recipientParticipantId === secondMemberId) ||
      (connection.requesterParticipantId === secondMemberId && connection.recipientParticipantId === firstMemberId);
    return samePair && connection.status === ParticipantConnectionStatus.ACCEPTED;
  });
}

export function canMemberContactTarget(viewer, target, connections = []) {
  if (!viewer || !target || !viewer.active || !target.active || viewer.id === target.id) return false;
  if (hasAdminAccess(viewer)) return true;
  if (target.role === MemberRole.RECEIVER_PERSON || target.role === MemberRole.RECEIVER_USER) return Boolean(viewer.canContactReceiver);
  if (hasAdminAccess(target) || target.role === MemberRole.COORDINATOR) return Boolean(viewer.canContactCoordinator);
  if (viewer.role === MemberRole.RECEIVER_PERSON || viewer.role === MemberRole.RECEIVER_USER) return Boolean(target.visibleToReceiver);
  if (viewer.role === MemberRole.PARTICIPANT && target.role === MemberRole.PARTICIPANT) {
    return acceptedParticipantConnectionBetween(connections, viewer.id, target.id);
  }
  return false;
}

export function canMemberSeeTarget(viewer, target, connections = [], options = {}) {
  if (!viewer || !target || !viewer.active || !target.active || viewer.id === target.id) return false;
  if (hasAdminAccess(viewer)) return true;
  if (target.role === MemberRole.RECEIVER_PERSON || target.role === MemberRole.RECEIVER_USER || hasAdminAccess(target) || target.role === MemberRole.COORDINATOR) return true;
  if (viewer.role === MemberRole.RECEIVER_PERSON || viewer.role === MemberRole.RECEIVER_USER) return Boolean(target.visibleToReceiver);
  if (acceptedParticipantConnectionBetween(connections, viewer.id, target.id)) return true;
  return Boolean(options.includeDiscoverable) && target.visibility === ParticipantVisibility.DISCOVERABLE;
}

export function hasAdminAccess(member) {
  return Boolean(member) && (
    member.role === MemberRole.OWNER ||
    member.role === MemberRole.ADMIN ||
    member.role === MemberRole.COORDINATOR ||
    member.adminAccessLevel === AdminAccessLevel.OWNER_PRIMARY_ADMIN ||
    member.adminAccessLevel === AdminAccessLevel.ADDITIONAL_ADMIN
  );
}

export function hasOwnerAccess(member) {
  return Boolean(member) && (
    member.role === MemberRole.OWNER ||
    member.adminAccessLevel === AdminAccessLevel.OWNER_PRIMARY_ADMIN
  );
}
