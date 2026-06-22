const MemberRole = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  RECEIVER_USER: "receiver_user",
  RECEIVER_PERSON: "receiver_person",
  COORDINATOR: "coordinator",
  PARTICIPANT: "participant",
});

const AdminAccessLevel = Object.freeze({
  OWNER_PRIMARY_ADMIN: "owner_primary_admin",
  ADDITIONAL_ADMIN: "additional_admin",
  NONE: "none",
});

const EscalationLevel = Object.freeze({
  NONE: "none",
  REQUEST_ATTENTION: "request_attention",
  PERSISTENT_RING: "persistent_ring",
  URGENT_BYPASS_QUIET_HOURS: "urgent_bypass_quiet_hours",
  DIRECT_AUDIO_VIDEO_OVERRIDE: "direct_audio_video_override",
});

const ParticipantVisibility = Object.freeze({
  PRIVATE: "private",
  DISCOVERABLE: "discoverable",
});

const ParticipantConnectionStatus = Object.freeze({
  NONE: "none",
  REQUESTED: "requested",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  BLOCKED: "blocked",
  REVOKED: "revoked",
});

const now = "2026-06-14T00:00:00.000Z";

const careCircle = {
  id: "care-circle-mom",
  name: "Mom's Care Circle",
  displayName: "Mom's Care Circle",
  ownerUserId: "user-andrew",
  primaryAdminUserId: "user-andrew",
  additionalAdminUserId: "user-susan",
  receiverHouseholdId: "receiver-household-elizabeth-robert",
  primaryReceiverDeviceId: "receiver-device-kitchen",
  active: true,
  createdAt: now,
  updatedAt: now,
};

const receiverHouseholds = [
  {
    id: "receiver-household-elizabeth-robert",
    careCircleId: careCircle.id,
    displayName: "Elizabeth and Robert",
    defaultTarget: "household",
    active: true,
    createdAt: now,
    updatedAt: now,
  },
];

const receiverPeople = [
  {
    id: "receiver-person-elizabeth",
    careCircleId: careCircle.id,
    receiverHouseholdId: "receiver-household-elizabeth-robert",
    displayName: "Elizabeth",
    linkedCareVipId: "care-vip-elizabeth",
    active: true,
  },
  {
    id: "receiver-person-robert",
    careCircleId: careCircle.id,
    receiverHouseholdId: "receiver-household-elizabeth-robert",
    displayName: "Robert",
    linkedCareVipId: null,
    active: true,
  },
];

const receiverDevices = [
  {
    id: "receiver-device-kitchen",
    careCircleId: careCircle.id,
    receiverHouseholdId: "receiver-household-elizabeth-robert",
    receiverId: "living-room-receiver",
    name: "Kitchen Receiver",
    locationLabel: "Kitchen",
    status: "available",
    lastSeenAt: "",
    active: true,
  },
];

const escalationPolicies = [
  {
    id: "escalation-policy-household-default",
    careCircleId: careCircle.id,
    receiverHouseholdId: "receiver-household-elizabeth-robert",
    enabled: false,
    allowedUserIds: ["user-andrew"],
    escalationLevel: EscalationLevel.NONE,
    quietHoursBehavior: "respect_quiet_hours",
    consentStatus: "not_configured",
    createdAt: now,
    updatedAt: now,
  },
];

const receiverAdminSettings = {
  careCircleId: careCircle.id,
  receiverDeviceId: "receiver-device-kitchen",
  hideOperationalSettingsOnReceiver: true,
  allowReceiverComfortSettings: true,
  requireAdminApprovalForContactChanges: true,
  updatedAt: now,
};

const members = [
  {
    id: "member-mom",
    careCircleId: careCircle.id,
    userId: "user-mom",
    displayName: "Mom",
    relationshipLabel: "Care VIP",
    phoneNumber: "+15550119",
    role: MemberRole.RECEIVER_PERSON,
    legacyRole: "receiver_user",
    receiverPersonId: "receiver-person-elizabeth",
    adminAccessLevel: AdminAccessLevel.NONE,
    visibility: ParticipantVisibility.PRIVATE,
    canContactReceiver: false,
    canCallReceiver: false,
    canMessageReceiver: false,
    canRequestAttention: false,
    canContactCoordinator: true,
    active: true,
  },
  {
    id: "member-andrew",
    careCircleId: careCircle.id,
    userId: "user-andrew",
    displayName: "Andrew",
    relationshipLabel: "Coordinator",
    phoneNumber: "+15550100",
    role: MemberRole.OWNER,
    adminAccessLevel: AdminAccessLevel.OWNER_PRIMARY_ADMIN,
    isPrimaryAdmin: true,
    visibility: ParticipantVisibility.DISCOVERABLE,
    canContactReceiver: true,
    canCallReceiver: true,
    canMessageReceiver: true,
    canRequestAttention: true,
    canContactCoordinator: true,
    active: true,
  },
  {
    id: "member-ann",
    careCircleId: careCircle.id,
    userId: "user-ann",
    displayName: "Cousin Ann",
    relationshipLabel: "Family",
    phoneNumber: "+15550104",
    role: MemberRole.PARTICIPANT,
    adminAccessLevel: AdminAccessLevel.NONE,
    visibility: ParticipantVisibility.DISCOVERABLE,
    canContactReceiver: true,
    canCallReceiver: true,
    canMessageReceiver: true,
    canRequestAttention: false,
    canContactCoordinator: true,
    visibleToReceiver: true,
    active: true,
  },
  {
    id: "member-susan",
    careCircleId: careCircle.id,
    userId: "user-susan",
    displayName: "Susan",
    relationshipLabel: "Family",
    phoneNumber: "+15550106",
    role: MemberRole.ADMIN,
    adminAccessLevel: AdminAccessLevel.ADDITIONAL_ADMIN,
    isAdditionalAdmin: true,
    visibility: ParticipantVisibility.PRIVATE,
    canContactReceiver: true,
    canCallReceiver: true,
    canMessageReceiver: true,
    canRequestAttention: false,
    canContactCoordinator: true,
    visibleToReceiver: true,
    active: true,
  },
  {
    id: "member-blaine",
    careCircleId: careCircle.id,
    userId: "user-blaine",
    displayName: "Blaine",
    relationshipLabel: "Neighbor",
    phoneNumber: "+15550108",
    role: MemberRole.PARTICIPANT,
    adminAccessLevel: AdminAccessLevel.NONE,
    visibility: ParticipantVisibility.DISCOVERABLE,
    canContactReceiver: true,
    canCallReceiver: false,
    canMessageReceiver: true,
    canRequestAttention: false,
    canContactCoordinator: true,
    visibleToReceiver: false,
    active: true,
  },
];

const participantConnections = [];

function allCareCircles() {
  return [{ ...careCircle }];
}

function getCareCircle(careCircleId = careCircle.id) {
  if (careCircleId !== careCircle.id) return null;
  return { ...careCircle };
}

function getMembers(careCircleId = careCircle.id) {
  if (careCircleId !== careCircle.id) return [];
  return members.map(member => ({ ...member }));
}

function getReceiverDevices(careCircleId = careCircle.id) {
  if (careCircleId !== careCircle.id) return [];
  return receiverDevices.map(device => ({ ...device }));
}

function getReceiverHouseholds(careCircleId = careCircle.id) {
  if (careCircleId !== careCircle.id) return [];
  return receiverHouseholds.map(household => ({ ...household }));
}

function getReceiverPeople(careCircleId = careCircle.id) {
  if (careCircleId !== careCircle.id) return [];
  return receiverPeople.map(person => ({ ...person }));
}

function getEscalationPolicies(careCircleId = careCircle.id) {
  if (careCircleId !== careCircle.id) return [];
  return escalationPolicies.map(policy => ({ ...policy }));
}

function getReceiverSettings(careCircleId = careCircle.id) {
  const circle = getCareCircle(careCircleId);
  if (!circle) return null;
  return {
    careCircle: circle,
    receiverDevices: getReceiverDevices(circle.id),
    receiverHouseholds: getReceiverHouseholds(circle.id),
    receiverPeople: getReceiverPeople(circle.id),
    members: getMembers(circle.id),
    escalationPolicies: getEscalationPolicies(circle.id),
    receiverAdminSettings: { ...receiverAdminSettings },
  };
}

function updateReceiverIdentity(receiverDeviceId, updates = {}) {
  const device = receiverDevices.find(item => item.id === receiverDeviceId);
  if (!device) return { ok: false, status: 404, error: "Receiver device not found." };
  const name = String(updates.name || "").trim();
  const locationLabel = String(updates.locationLabel || "").trim();
  if (name) device.name = name;
  if (locationLabel) device.locationLabel = locationLabel;
  device.updatedAt = new Date().toISOString();
  return { ok: true, receiverDevice: { ...device } };
}

function updateReceiverLockdown(updates = {}) {
  const allowed = [
    "hideOperationalSettingsOnReceiver",
    "allowReceiverComfortSettings",
    "requireAdminApprovalForContactChanges",
  ];
  for (const key of allowed) {
    if (typeof updates[key] === "boolean") {
      receiverAdminSettings[key] = updates[key];
    }
  }
  receiverAdminSettings.updatedAt = new Date().toISOString();
  return { ok: true, receiverAdminSettings: { ...receiverAdminSettings } };
}

function getConnections(careCircleId = careCircle.id) {
  if (careCircleId !== careCircle.id) return [];
  return participantConnections.map(connection => ({ ...connection }));
}

function findMember(memberId) {
  return members.find(member => member.id === memberId) || null;
}

function findMemberByDisplayName(displayName) {
  const normalized = String(displayName || "").trim().toLowerCase();
  return members.find(member => member.displayName.toLowerCase() === normalized) || null;
}

function normalizePhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

function findMemberByPhone(phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);
  return members.find(member => normalizePhoneNumber(member.phoneNumber) === normalized) || null;
}

function hasAdminAccess(member) {
  return Boolean(member) && (
    member.role === MemberRole.OWNER ||
    member.role === MemberRole.ADMIN ||
    member.role === MemberRole.COORDINATOR ||
    member.adminAccessLevel === AdminAccessLevel.OWNER_PRIMARY_ADMIN ||
    member.adminAccessLevel === AdminAccessLevel.ADDITIONAL_ADMIN
  );
}

function hasOwnerAccess(member) {
  return Boolean(member) && (
    member.role === MemberRole.OWNER ||
    member.adminAccessLevel === AdminAccessLevel.OWNER_PRIMARY_ADMIN
  );
}

function acceptedParticipantConnectionBetween(firstMemberId, secondMemberId) {
  return participantConnections.some(connection => {
    const samePair =
      (connection.requesterParticipantId === firstMemberId && connection.recipientParticipantId === secondMemberId) ||
      (connection.requesterParticipantId === secondMemberId && connection.recipientParticipantId === firstMemberId);
    return samePair && connection.status === ParticipantConnectionStatus.ACCEPTED;
  });
}

function connectionBetween(firstMemberId, secondMemberId) {
  return participantConnections.find(connection => {
    return (
      (connection.requesterParticipantId === firstMemberId && connection.recipientParticipantId === secondMemberId) ||
      (connection.requesterParticipantId === secondMemberId && connection.recipientParticipantId === firstMemberId)
    );
  }) || null;
}

function canMemberContactTarget(viewer, target) {
  if (!viewer || !target || !viewer.active || !target.active || viewer.id === target.id) return false;
  if (hasAdminAccess(viewer)) return true;
  if (target.role === MemberRole.RECEIVER_PERSON || target.role === MemberRole.RECEIVER_USER) return Boolean(viewer.canContactReceiver);
  if (hasAdminAccess(target) || target.role === MemberRole.COORDINATOR) return Boolean(viewer.canContactCoordinator);
  if (viewer.role === MemberRole.RECEIVER_PERSON || viewer.role === MemberRole.RECEIVER_USER) return Boolean(target.visibleToReceiver);
  if (viewer.role === MemberRole.PARTICIPANT && target.role === MemberRole.PARTICIPANT) {
    return acceptedParticipantConnectionBetween(viewer.id, target.id);
  }
  return false;
}

function canMemberCallReceiver(member) {
  return Boolean(member?.active && (member.canCallReceiver ?? member.canContactReceiver));
}

function canMemberMessageReceiver(member) {
  return Boolean(member?.active && (member.canMessageReceiver ?? member.canContactReceiver));
}

function canMemberRequestAttention(member) {
  return Boolean(member?.active && member.canRequestAttention);
}

function updateMemberReceiverPermissions(memberId, updates = {}) {
  const member = findMember(memberId);
  if (!member) return { ok: false, status: 404, error: "Care circle member not found." };
  if (member.role === MemberRole.RECEIVER_PERSON || member.role === MemberRole.RECEIVER_USER) {
    return { ok: false, status: 400, error: "Receiver person permissions are not managed here." };
  }
  if (typeof updates.canCallReceiver === "boolean") member.canCallReceiver = updates.canCallReceiver;
  if (typeof updates.canMessageReceiver === "boolean") member.canMessageReceiver = updates.canMessageReceiver;
  if (typeof updates.canRequestAttention === "boolean") member.canRequestAttention = updates.canRequestAttention;
  member.canContactReceiver = Boolean(member.canCallReceiver || member.canMessageReceiver || member.canRequestAttention);
  member.updatedAt = new Date().toISOString();
  return { ok: true, member: { ...member } };
}

function hasParticipantConnectionBetween(firstMemberId, secondMemberId) {
  return participantConnections.some(connection => {
    return (
      (connection.requesterParticipantId === firstMemberId && connection.recipientParticipantId === secondMemberId) ||
      (connection.requesterParticipantId === secondMemberId && connection.recipientParticipantId === firstMemberId)
    );
  });
}

function canMemberSeeTarget(viewer, target, options = {}) {
  if (!viewer || !target || !viewer.active || !target.active || viewer.id === target.id) return false;
  if (hasAdminAccess(viewer)) return true;
  if (target.role === MemberRole.RECEIVER_PERSON || target.role === MemberRole.RECEIVER_USER || hasAdminAccess(target) || target.role === MemberRole.COORDINATOR) return true;
  if (viewer.role === MemberRole.RECEIVER_PERSON || viewer.role === MemberRole.RECEIVER_USER) return Boolean(target.visibleToReceiver);
  if (acceptedParticipantConnectionBetween(viewer.id, target.id)) return true;
  if (hasParticipantConnectionBetween(viewer.id, target.id)) return true;
  return Boolean(options.includeDiscoverable) && target.visibility === ParticipantVisibility.DISCOVERABLE;
}

function canRequestParticipantConnection(viewer, target) {
  if (!viewer || !target) return false;
  if (viewer.role !== MemberRole.PARTICIPANT || target.role !== MemberRole.PARTICIPANT) return false;
  if (viewer.id === target.id) return false;
  if (target.visibility !== ParticipantVisibility.DISCOVERABLE) return false;
  const existing = connectionBetween(viewer.id, target.id);
  return !existing || existing.status === ParticipantConnectionStatus.NONE || existing.status === ParticipantConnectionStatus.REVOKED;
}

function memberSummaryForViewer(viewer, target) {
  const connection = connectionBetween(viewer.id, target.id);
  const canContact = canMemberContactTarget(viewer, target);
  return {
    id: target.id,
    careCircleId: target.careCircleId,
    displayName: target.displayName,
    relationshipLabel: target.relationshipLabel,
    role: target.role,
    legacyRole: target.legacyRole || "",
    adminAccessLevel: target.adminAccessLevel || AdminAccessLevel.NONE,
    isOwner: hasOwnerAccess(target),
    isAdmin: hasAdminAccess(target),
    receiverPersonId: target.receiverPersonId || "",
    visibility: target.visibility,
    active: target.active,
    canCall: canContact,
    canMessage: canContact,
    canCallReceiver: Boolean(target.canCallReceiver ?? target.canContactReceiver),
    canMessageReceiver: Boolean(target.canMessageReceiver ?? target.canContactReceiver),
    canRequestAttention: Boolean(target.canRequestAttention),
    canRequestConnection: canRequestParticipantConnection(viewer, target),
    connectionStatus: connection ? connection.status : ParticipantConnectionStatus.NONE,
    directChannelExposed: canContact,
    escalationLevel: EscalationLevel.NONE,
  };
}

function viewForMember(careCircleId, viewerMemberId, options = {}) {
  const circle = getCareCircle(careCircleId);
  const viewer = findMember(viewerMemberId);
  if (!circle || !viewer || viewer.careCircleId !== circle.id) return null;

  return {
    careCircle: circle,
    receiverDevices: getReceiverDevices(circle.id),
    receiverHouseholds: getReceiverHouseholds(circle.id),
    receiverPeople: getReceiverPeople(circle.id),
    escalationPolicies: hasOwnerAccess(viewer) ? getEscalationPolicies(circle.id) : [],
    viewer: memberSummaryForViewer(viewer, viewer),
    visibleMembers: members
      .filter(target => target.id !== viewer.id && target.careCircleId === circle.id && canMemberSeeTarget(viewer, target, options))
      .map(target => memberSummaryForViewer(viewer, target)),
    participantConnections: hasAdminAccess(viewer)
      ? getConnections(circle.id)
      : getConnections(circle.id).filter(connection =>
          connection.requesterParticipantId === viewer.id || connection.recipientParticipantId === viewer.id
        ),
  };
}

function requestConnection(careCircleId, requesterParticipantId, recipientParticipantId) {
  const circle = getCareCircle(careCircleId);
  const requester = findMember(requesterParticipantId);
  const recipient = findMember(recipientParticipantId);
  if (!circle || !requester || !recipient) {
    return { ok: false, status: 404, error: "Care circle member not found." };
  }
  if (!canRequestParticipantConnection(requester, recipient)) {
    return { ok: false, status: 400, error: "Connection cannot be requested for these members." };
  }
  const timestamp = new Date().toISOString();
  const connection = {
    id: `connection-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    careCircleId: circle.id,
    requesterParticipantId: requester.id,
    recipientParticipantId: recipient.id,
    status: ParticipantConnectionStatus.REQUESTED,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  participantConnections.push(connection);
  return { ok: true, connection: { ...connection } };
}

function updateConnectionStatus(connectionId, status) {
  const allowed = new Set([
    ParticipantConnectionStatus.ACCEPTED,
    ParticipantConnectionStatus.DECLINED,
    ParticipantConnectionStatus.BLOCKED,
    ParticipantConnectionStatus.REVOKED,
  ]);
  if (!allowed.has(status)) {
    return { ok: false, status: 400, error: "Invalid participant connection status." };
  }
  const connection = participantConnections.find(item => item.id === connectionId);
  if (!connection) {
    return { ok: false, status: 404, error: "Participant connection not found." };
  }
  connection.status = status;
  connection.updatedAt = new Date().toISOString();
  return { ok: true, connection: { ...connection } };
}

module.exports = {
  MemberRole,
  AdminAccessLevel,
  ParticipantVisibility,
  ParticipantConnectionStatus,
  EscalationLevel,
  allCareCircles,
  getCareCircle,
  getMembers,
  getReceiverDevices,
  getReceiverHouseholds,
  getReceiverPeople,
  getEscalationPolicies,
  getReceiverSettings,
  updateReceiverIdentity,
  updateReceiverLockdown,
  getConnections,
  findMember,
  findMemberByDisplayName,
  findMemberByPhone,
  normalizePhoneNumber,
  canMemberContactTarget,
  canMemberCallReceiver,
  canMemberMessageReceiver,
  canMemberRequestAttention,
  updateMemberReceiverPermissions,
  hasAdminAccess,
  hasOwnerAccess,
  viewForMember,
  requestConnection,
  updateConnectionStatus,
};
