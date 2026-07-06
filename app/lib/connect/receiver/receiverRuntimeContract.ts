import { resolveReceiverUiSchema } from "./receiverUiSchemas";

export type ReceiverRuntimeName = "classic_webview" | "modern_web";

export type ReceiverScreenClass =
  | "landscape_1024x600"
  | "landscape_hd"
  | "landscape_wide"
  | "portrait_phone"
  | "unknown";

export type ReceiverLayoutScaleMode = "native" | "scale_to_fit" | "responsive";

export type ReceiverCapabilityStatus =
  | "supported"
  | "enabled"
  | "unavailable"
  | "unknown"
  | string;

export type ReceiverRuntimeInput = {
  bindingStatus?: string;
  brand?: string;
  capabilities?: ReceiverRuntimeCapabilities;
  detectedHardwareProfile?: string;
  device?: string;
  deviceOwner?: boolean;
  deviceProfile?: string;
  displayDensity?: number;
  displayDensityDpi?: number;
  displayHeightDp?: number;
  displayHeightPx?: number;
  displayWidthDp?: number;
  displayWidthPx?: number;
  hardware?: string;
  hardwareProfile?: string;
  lockTaskActive?: boolean;
  lockTaskPermitted?: boolean;
  mainConnectUserPersonId?: string;
  manufacturer?: string;
  model?: string;
  nativeOrientation?: string;
  nativeSdk?: number;
  product?: string;
  provisioningCompletedAtMs?: number;
  receiverDeviceId?: string;
  receiverInstallId?: string;
  receiverMode?: string;
  receiverRuntime?: string;
  receiverUrl?: string;
  sdkVersion?: number;
  shellVersion?: string;
  uiLayout?: string;
  versionCode?: number;
  versionName?: string;
};

export type ReceiverRuntimeCapabilities = {
  batteryOptimization?: ReceiverCapabilityStatus;
  bootStart?: ReceiverCapabilityStatus;
  fullscreen?: ReceiverCapabilityStatus;
  keepAwake?: ReceiverCapabilityStatus;
  kiosk?: ReceiverCapabilityStatus;
  microphone?: ReceiverCapabilityStatus;
  updateChecks?: ReceiverCapabilityStatus;
};

export type ReceiverRuntimeContract = {
  activePerson: {
    mainConnectUserPersonId: string;
  };
  binding: {
    bindingStatus: string;
    receiverDeviceId: string;
    receiverInstallId: string;
  };
  capabilities: ReceiverRuntimeCapabilities;
  hardware: {
    brand: string;
    detectedHardwareProfile: string;
    device: string;
    displayDensity: number | null;
    displayDensityDpi: number | null;
    displayHeightDp: number | null;
    displayHeightPx: number | null;
    displayWidthDp: number | null;
    displayWidthPx: number | null;
    hardware: string;
    hardwareProfile: string;
    manufacturer: string;
    model: string;
    orientation: "landscape" | "portrait" | "unknown";
    product: string;
    screenClass: ReceiverScreenClass;
    sdkVersion: number | null;
  };
  layout: {
    scaleMode: ReceiverLayoutScaleMode;
    uiSchemaId: string;
    uiSchemaVersion: number;
    uiLayout: string;
  };
  mode: {
    provisioningCompletedAtMs: number | null;
    receiverMode: "dedicated" | "personal" | "unknown";
  };
  runtime: {
    name: ReceiverRuntimeName;
    shellVersion: string;
    versionCode: number | null;
    versionName: string;
  };
  url: {
    receiverUrl: string;
  };
};

export function createReceiverRuntimeContract(
  input: ReceiverRuntimeInput
): ReceiverRuntimeContract {
  const screenClass = receiverScreenClass(input);
  const hardwareProfile = normalizedToken(
    input.hardwareProfile ||
      input.detectedHardwareProfile ||
      recommendedHardwareProfile(input, screenClass)
  );
  const uiLayout = normalizedToken(input.uiLayout || recommendedUiLayout(hardwareProfile, screenClass));
  const runtime = receiverRuntimeName(input, screenClass);
  const uiSchema = resolveReceiverUiSchema({ hardwareProfile, runtime, uiLayout });

  return {
    activePerson: {
      mainConnectUserPersonId: text(input.mainConnectUserPersonId),
    },
    binding: {
      bindingStatus: normalizedToken(input.bindingStatus) || "unprovisioned",
      receiverDeviceId: text(input.receiverDeviceId),
      receiverInstallId: text(input.receiverInstallId),
    },
    capabilities: input.capabilities || {},
    hardware: {
      brand: text(input.brand),
      detectedHardwareProfile: normalizedToken(input.detectedHardwareProfile),
      device: text(input.device),
      displayDensity: finiteNumber(input.displayDensity),
      displayDensityDpi: finiteNumber(input.displayDensityDpi),
      displayHeightDp: finiteNumber(input.displayHeightDp),
      displayHeightPx: finiteNumber(input.displayHeightPx),
      displayWidthDp: finiteNumber(input.displayWidthDp),
      displayWidthPx: finiteNumber(input.displayWidthPx),
      hardware: text(input.hardware),
      hardwareProfile,
      manufacturer: text(input.manufacturer),
      model: text(input.model),
      orientation: receiverOrientation(input),
      product: text(input.product),
      screenClass,
      sdkVersion: finiteNumber(input.nativeSdk ?? input.sdkVersion),
    },
    layout: {
      scaleMode: receiverLayoutScaleMode(uiLayout, screenClass),
      uiSchemaId: uiSchema.id,
      uiSchemaVersion: uiSchema.version,
      uiLayout,
    },
    mode: {
      provisioningCompletedAtMs: finiteNumber(input.provisioningCompletedAtMs),
      receiverMode: receiverMode(input.receiverMode),
    },
    runtime: {
      name: runtime,
      shellVersion: text(input.shellVersion),
      versionCode: finiteNumber(input.versionCode),
      versionName: text(input.versionName),
    },
    url: {
      receiverUrl: text(input.receiverUrl),
    },
  };
}

export function receiverScreenClass(input: ReceiverRuntimeInput): ReceiverScreenClass {
  const orientation = receiverOrientation(input);
  const widthPx = finiteNumber(input.displayWidthPx) || 0;
  const heightPx = finiteNumber(input.displayHeightPx) || 0;
  const widthDp = finiteNumber(input.displayWidthDp) || 0;
  const heightDp = finiteNumber(input.displayHeightDp) || 0;
  const shortPx = Math.min(nonZero(widthPx), nonZero(heightPx));
  const longPx = Math.max(nonZero(widthPx), nonZero(heightPx));
  const shortDp = Math.min(nonZero(widthDp), nonZero(heightDp));
  const longDp = Math.max(nonZero(widthDp), nonZero(heightDp));

  if (nearSize(shortDp, longDp, 600, 1024) || nearSize(shortPx, longPx, 600, 1024)) {
    return "landscape_1024x600";
  }

  if (orientation === "landscape" && (nearSize(shortPx, longPx, 1080, 1920) || longPx >= 1600)) {
    return "landscape_hd";
  }

  if (orientation === "landscape") {
    return longPx || longDp ? "landscape_wide" : "unknown";
  }

  if (orientation === "portrait") {
    return "portrait_phone";
  }

  return "unknown";
}

function receiverRuntimeName(
  input: ReceiverRuntimeInput,
  screenClass: ReceiverScreenClass
): ReceiverRuntimeName {
  const explicit = normalizedToken(input.receiverRuntime);
  if (explicit === "classic_webview" || explicit === "modern_web") return explicit;

  const sdk = finiteNumber(input.nativeSdk ?? input.sdkVersion);
  const profile = normalizedToken(
    `${input.deviceProfile || ""} ${input.hardwareProfile || ""} ${
      input.detectedHardwareProfile || ""
    } ${input.manufacturer || ""} ${input.model || ""}`
  );

  if (sdk !== null && sdk <= 25) return "classic_webview";
  if (profile.includes("gxv3370")) return "classic_webview";
  if (screenClass === "landscape_1024x600") return "classic_webview";

  return "modern_web";
}

function recommendedHardwareProfile(
  input: ReceiverRuntimeInput,
  screenClass: ReceiverScreenClass
) {
  const deviceText = normalizedToken(
    `${input.manufacturer || ""} ${input.model || ""} ${input.deviceProfile || ""}`
  );

  if (deviceText.includes("gxv3370")) return "grandstream_gxv3370";
  if (screenClass === "landscape_1024x600") return "studio_gxv3370_1024x600";
  if (screenClass === "landscape_hd") return "generic_hd_landscape_android";
  if (screenClass === "landscape_wide") return "generic_landscape_android";
  if (screenClass === "portrait_phone") return "generic_android_phone";
  return "unknown";
}

function recommendedUiLayout(hardwareProfile: string, screenClass: ReceiverScreenClass) {
  if (
    hardwareProfile.includes("gxv3370") ||
    hardwareProfile === "studio_gxv3370_1024x600" ||
    screenClass === "landscape_1024x600" ||
    screenClass === "landscape_hd"
  ) {
    return "desk_phone_1024x600";
  }

  return "default_receiver";
}

function receiverLayoutScaleMode(
  uiLayout: string,
  screenClass: ReceiverScreenClass
): ReceiverLayoutScaleMode {
  if (uiLayout === "desk_phone_1024x600" && screenClass === "landscape_hd") {
    return "scale_to_fit";
  }
  if (uiLayout === "desk_phone_1024x600") {
    return "native";
  }
  return "responsive";
}

function receiverOrientation(input: ReceiverRuntimeInput) {
  const explicit = normalizedToken(input.nativeOrientation);
  if (explicit === "landscape" || explicit === "portrait") return explicit;

  const width = finiteNumber(input.displayWidthPx ?? input.displayWidthDp) || 0;
  const height = finiteNumber(input.displayHeightPx ?? input.displayHeightDp) || 0;
  if (width > height) return "landscape";
  if (height > width) return "portrait";
  return "unknown";
}

function receiverMode(value?: string) {
  const normalized = normalizedToken(value);
  if (normalized === "dedicated" || normalized === "personal") return normalized;
  return "unknown";
}

function nearSize(shortSide: number, longSide: number, expectedShort: number, expectedLong: number) {
  if (!shortSide || !longSide) return false;
  return (
    Math.abs(shortSide - expectedShort) <= 80 &&
    Math.abs(longSide - expectedLong) <= 120
  );
}

function normalizedToken(value?: string | null) {
  return text(value).toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_");
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function nonZero(value: number) {
  return value > 0 ? value : Number.POSITIVE_INFINITY;
}
