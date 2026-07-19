import type { ConnectMainUserContext } from "@/app/lib/connect/context";
import { isConnectPetSubjectType } from "@/app/lib/connect/context/mainConnectUserEligibility";
import type { ConnectReceiverDevice } from "@/app/lib/connect/provisioning";

import type {
  ReceiverContactOption,
  ReceiverSetupDraft,
  ReceiverSetupSection,
} from "./types";

export const receiverSetupDraftStorageKey = "carepland-receiver-setup-overlay-draft";
export const currentAccountReceiverUserDraftId = "__current_account_person__";

export const receiverSetupSectionOrder: ReceiverSetupSection[] = [
  "install",
  "receiverUser",
  "pair",
  "finish",
];

export const defaultReceiverSetupDraft: ReceiverSetupDraft = {
  installMode: undefined,
  installViewed: false,
  pairingCode: "",
  pairingError: "",
  pairingStatus: "idle",
  receiverContactUserId: "",
  receiverUserPersonId: "",
  section: "home",
};

export function sanitizeReceiverSetupSection(value: string | null): ReceiverSetupSection {
  if (value === "receiverContact") return "receiverUser";
  if (value === "test") return "finish";
  if (
    value === "home" ||
    value === "start" ||
    value === "receiverUser" ||
    value === "install" ||
    value === "pair" ||
    value === "finish" ||
    value === "advancedAndroid" ||
    value === "settings"
  ) {
    return value;
  }
  if (value === "advanced") return "advancedAndroid";
  return "home";
}

export function receiverSetupSectionLabel(section: ReceiverSetupSection) {
  switch (section) {
    case "start":
      return "Start";
    case "receiverUser":
      return "Receiver User";
    case "receiverContact":
      return "Receiver User";
    case "install":
      return "Install";
    case "pair":
      return "Pair";
    case "finish":
      return "Finish";
    case "advancedAndroid":
      return "Advanced Android";
    case "settings":
      return "Receiver Settings";
    case "home":
    default:
      return "Receiver Setup";
  }
}

export function receiverEligiblePeople(connectContext: ConnectMainUserContext | null) {
  return (connectContext?.people ?? [])
    .filter((person) => person.isActive !== false)
    .filter((person) => !isConnectPetSubjectType(person.subjectType));
}

export function receiverDisplayName(device?: ConnectReceiverDevice | null) {
  return device?.locationLabel || device?.name || device?.receiverId || device?.id || "Receiver";
}

export function receiverDeviceKey(device?: ConnectReceiverDevice | null) {
  return device?.id || device?.receiverId || "";
}

export function contactOptionsFromContext(
  connectContext: ConnectMainUserContext | null,
  activeDevices: ConnectReceiverDevice[]
): ReceiverContactOption[] {
  const options = new Map<string, ReceiverContactOption>();

  for (const device of activeDevices) {
    const userId = device.receiverContactUserId?.trim();
    if (!userId) continue;
    options.set(userId, {
      displayName: device.receiverContactDisplayName?.trim() || "Receiver Contact",
      source: "existing_receiver",
      userId,
    });
  }

  const coordinator = connectContext?.primaryCoordinator;
  if (coordinator?.userId) {
    options.set(coordinator.userId, {
      displayName: coordinator.displayName || "Receiver Contact",
      source: "primary_coordinator",
      userId: coordinator.userId,
    });
  }

  return [...options.values()];
}

export function readReceiverSetupDraft(): Partial<ReceiverSetupDraft> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(receiverSetupDraftStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReceiverSetupDraft>;
    return {
      installMode: parsed.installMode === "android" || parsed.installMode === "web" ? parsed.installMode : undefined,
      installViewed: Boolean(parsed.installViewed),
      lastCompletedSection: parsed.lastCompletedSection
        ? sanitizeReceiverSetupSection(parsed.lastCompletedSection)
        : undefined,
      receiverContactUserId: String(parsed.receiverContactUserId || ""),
      receiverUserPersonId: String(parsed.receiverUserPersonId || ""),
      section: sanitizeReceiverSetupSection(String(parsed.section || "")),
      selectedReceiverDeviceId: String(parsed.selectedReceiverDeviceId || ""),
    };
  } catch {
    return null;
  }
}

export function writeReceiverSetupDraft(draft: ReceiverSetupDraft) {
  if (typeof window === "undefined") return;
  const safeDraft: Partial<ReceiverSetupDraft> = {
    installMode: draft.installMode,
    installViewed: draft.installViewed,
    lastCompletedSection: draft.lastCompletedSection,
    receiverContactUserId: draft.receiverContactUserId,
    receiverUserPersonId: draft.receiverUserPersonId,
    section: draft.section,
    selectedReceiverDeviceId: draft.selectedReceiverDeviceId,
  };
  window.sessionStorage.setItem(receiverSetupDraftStorageKey, JSON.stringify(safeDraft));
}

export function nextMeaningfulSection(draft: ReceiverSetupDraft): ReceiverSetupSection {
  if (draft.section && draft.section !== "home" && draft.section !== "settings") {
    if (draft.section === "receiverContact") return "receiverUser";
    return draft.section;
  }
  if (!draft.installMode) return "start";
  if (!draft.receiverUserPersonId || !draft.receiverContactUserId) return "receiverUser";
  if (draft.pairingStatus !== "paired") return "pair";
  return "finish";
}

export function absoluteUrl(pathOrUrl: string, browserOrigin: string) {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (!browserOrigin) return pathOrUrl;
  return new URL(pathOrUrl, browserOrigin).toString();
}

export function safeApkFilename(versionName: string) {
  return versionName
    ? `carepland-receiver-${versionName.trim().replace(/[^0-9A-Za-z._-]+/g, "-").replace(/^-+|-+$/g, "")}.apk`
    : "carepland-receiver.apk";
}

export function wifiQrPayload(ssidValue: string, passwordValue: string, securityValue: string) {
  const ssid = wifiEscape(ssidValue.trim());
  if (!ssid) return "";
  const type = securityValue === "nopass" ? "nopass" : securityValue;
  const password = type === "nopass" ? "" : wifiEscape(passwordValue);
  return `WIFI:T:${type};S:${ssid};P:${password};;`;
}

export function ownerProvisioningPayload({
  apkSha256Checksum,
  apkUrl,
  hardwareProfile,
  provisioningUrl,
  receiverUrl,
  uiLayout,
  wifiPassword,
  wifiSecurity,
  wifiSsid,
}: {
  apkSha256Checksum: string;
  apkUrl: string;
  hardwareProfile: string;
  provisioningUrl: string;
  receiverUrl: string;
  uiLayout: string;
  wifiPassword: string;
  wifiSecurity: string;
  wifiSsid: string;
}) {
  if (!apkUrl || !apkSha256Checksum) return "";
  const payload: Record<string, unknown> = {
    "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
      careplandHardwareProfile: hardwareProfile,
      careplandProvisioningUrl: provisioningUrl,
      careplandReceiverUrl: receiverUrl,
      careplandUiLayout: uiLayout,
    },
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":
      "com.carepland.connectreceiver/.ReceiverDeviceAdminReceiver",
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM": apkSha256Checksum,
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": apkUrl,
    "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED": true,
  };

  if (wifiSsid.trim()) {
    payload["android.app.extra.PROVISIONING_WIFI_SSID"] = wifiSsid.trim();
    payload["android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE"] = wifiSecurity;
    if (wifiSecurity !== "nopass") {
      payload["android.app.extra.PROVISIONING_WIFI_PASSWORD"] = wifiPassword;
    }
  }

  return JSON.stringify(payload);
}

function wifiEscape(value: string) {
  return value.replace(/([\\;,:"])/g, "\\$1");
}
