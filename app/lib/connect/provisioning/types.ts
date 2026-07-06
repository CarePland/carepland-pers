export type ConnectProvisioningLifecycleStatus =
  | "active"
  | "available"
  | "bound"
  | "connected"
  | "expired"
  | "inactive"
  | "revoked"
  | "ringing"
  | "setup_pending"
  | "used";

export type ConnectReceiverDevicePresenceState =
  | "not_paired"
  | "offline"
  | "online"
  | "revoked"
  | "stale";

export type ConnectProductEligibility = {
  entitlementPlanId?: string;
  entitlementStatus?: string;
  productKey?: "connect" | string;
  source?: "admin" | "early_access" | "prototype" | string;
};

export type ConnectReceiverPerson = {
  active?: boolean;
  avatarAltText?: string;
  avatarType?: "generated" | "initials" | "uploaded" | string;
  avatarUrl?: string;
  careCircleId?: string;
  displayName?: string;
  id?: string;
  identityLinkReviewStatus?: string;
  linkedCareVipId?: string | null;
  linkedPlatformPersonId?: string | null;
  productEligibility?: ConnectProductEligibility | null;
  receiverHouseholdId?: string;
  source?: string;
  status?: ConnectProvisioningLifecycleStatus | string;
};

export type ConnectReceiverHousehold = {
  active?: boolean;
  careCircleId?: string;
  defaultTarget?: string;
  displayName?: string;
  id?: string;
  identityLinkReviewStatus?: string;
  linkedCareCircleId?: string | null;
  name?: string;
  productEligibility?: ConnectProductEligibility | null;
  receiverPeople?: ConnectReceiverPerson[];
  receiverPersonCount?: number;
  source?: string;
  status?: ConnectProvisioningLifecycleStatus | string;
};

export type ConnectReceiverDevice = {
  active?: boolean;
  capabilityStatuses?: {
    batteryOptimization?: string;
    bootStart?: string;
    fullscreen?: string;
    keepAwake?: string;
    kiosk?: string;
    microphone?: string;
    updateChecks?: string;
  };
  careCircleId?: string;
  deviceOwner?: boolean;
  hardwareProfile?: string;
  id?: string;
  lastRecoveryAction?: string;
  lastRecoveryAt?: string;
  lastSeenAt?: string;
  linkedCareCircleId?: string | null;
  lockTaskActive?: boolean;
  lockTaskPermitted?: boolean;
  locationLabel?: string;
  name?: string;
  nativeManufacturer?: string;
  nativeModel?: string;
  nativeSdk?: number;
  nativeVersionCode?: number;
  nativeVersionName?: string;
  pairedAt?: string;
  presence?: {
    label?: string;
    lastSeenAgeMs?: number;
    online?: boolean;
    state?: ConnectReceiverDevicePresenceState | string;
  };
  productEligibility?: ConnectProductEligibility | null;
  provisioningCompletedAt?: string;
  receiverHouseholdId?: string;
  receiverId?: string;
  receiverMode?: "dedicated" | "personal" | string;
  revokedAt?: string;
  shellVersion?: string;
  status?: ConnectProvisioningLifecycleStatus | string;
  updateAction?: "none" | "recommended" | "required" | string;
  updateAvailable?: boolean;
  updateRequired?: boolean;
};

export type ConnectReceiverSetupToken = {
  careCircleId?: string;
  createdAt?: string;
  createdByUserId?: string;
  expiresAt?: string;
  receiverDeviceId?: string;
  receiverHouseholdId?: string;
  revokedAt?: string;
  setupCode?: string;
  status?: ConnectProvisioningLifecycleStatus | string;
  token?: string;
  usedAt?: string;
};

export type ConnectProvisioningAuditEvent = {
  careCircleId?: string;
  createdAt?: string;
  createdByUserId?: string;
  expiresAt?: string;
  id?: string;
  locationLabel?: string;
  name?: string;
  productKey?: "connect" | string;
  receiverDeviceId?: string;
  receiverHouseholdId?: string;
  receiverId?: string;
  setupCode?: string;
  setupTokenStatus?: ConnectProvisioningLifecycleStatus | string;
  type?: string;
};

export type ConnectProvisioningSnapshot = {
  auditEvents?: ConnectProvisioningAuditEvent[];
  ok?: boolean;
  receiverDevices?: ConnectReceiverDevice[];
  receiverHouseholds?: ConnectReceiverHousehold[];
  setupTokens?: ConnectReceiverSetupToken[];
  summary?: {
    generatedAt?: string;
    totals?: {
      activeReceiverDevices?: number;
      activeSetupTokens?: number;
      households?: number;
      receiverDevices?: number;
      receiverHouseholds?: number;
      receiverPeople?: number;
      revokedReceiverDevices?: number;
      setupTokens?: number;
    };
  };
  totals?: {
    receiverDevices?: number;
    receiverHouseholds?: number;
    receiverPeople?: number;
  };
};
