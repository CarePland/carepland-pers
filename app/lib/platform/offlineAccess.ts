export const STANDARD_OFFLINE_HOURS = 24;
export const EXTENDED_OFFLINE_DAYS = 14;
export const EXTENDED_OFFLINE_COOLDOWN_DAYS = 30;

export const offlineAuthorizationStorageKey =
  "carepland-offline-authorization:v1";
export const offlineDeviceIdStorageKey = "carepland-offline-device-id:v1";
export const offlineLastOnlineValidationStorageKey =
  "carepland-offline-last-online-validation-at:v1";

export const extendedOfflineFeatureKey = "extended_offline_access";

export const offlineAccessReasonCodes = [
  "travel",
  "hospital_or_care_facility",
  "limited_internet_access",
  "emergency_preparation",
  "other",
  "prefer_not_to_say",
] as const;

export type OfflineAccessReasonCode = (typeof offlineAccessReasonCodes)[number];

export type OfflineAuthorizationStatus = "active" | "expired" | "revoked";

export type OfflinePolicy = {
  cooldownDays: number;
  extendedDays: number;
  standardHours: number;
};

export type OfflineAuthorizationRecord = {
  authorization: string;
  deviceId: string;
  expiresAt: string;
  id: string;
  issuedAt: string;
  startsAt: string;
  status: OfflineAuthorizationStatus;
};

export type OfflineAccessState = {
  activePass: OfflineAuthorizationRecord | null;
  eligible: boolean;
  message?: string;
  nextEligibleAt: string | null;
  planId: string | null;
  planName: string | null;
  policy: OfflinePolicy;
};

export const offlinePolicy: OfflinePolicy = {
  cooldownDays: EXTENDED_OFFLINE_COOLDOWN_DAYS,
  extendedDays: EXTENDED_OFFLINE_DAYS,
  standardHours: STANDARD_OFFLINE_HOURS,
};

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function canRequestExtendedOfflineAccess(state: OfflineAccessState) {
  if (!state.eligible) return false;
  if (state.activePass) return false;
  if (!state.nextEligibleAt) return true;

  return new Date(state.nextEligibleAt).getTime() <= Date.now();
}

export function getOfflinePolicy() {
  return offlinePolicy;
}

export function isOfflineAccessReasonCode(
  value: unknown
): value is OfflineAccessReasonCode {
  return (
    typeof value === "string" &&
    offlineAccessReasonCodes.includes(value as OfflineAccessReasonCode)
  );
}
