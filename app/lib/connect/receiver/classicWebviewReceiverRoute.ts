import type { ReceiverRuntimeInput } from "./receiverRuntimeContract";

export function classicReceiverRuntimeInput(
  searchParams: URLSearchParams
): ReceiverRuntimeInput {
  return {
    bindingStatus: searchParams.get("receiverBindingStatus") || undefined,
    brand: searchParams.get("nativeBrand") || undefined,
    detectedHardwareProfile: searchParams.get("detectedHardwareProfile") || undefined,
    device: searchParams.get("device") || undefined,
    deviceProfile: searchParams.get("deviceProfile") || searchParams.get("device") || undefined,
    displayDensity: numberParam(searchParams, "displayDensity"),
    displayDensityDpi: numberParam(searchParams, "displayDensityDpi"),
    displayHeightDp: numberParam(searchParams, "displayHeightDp"),
    displayHeightPx: numberParam(searchParams, "displayHeightPx"),
    displayWidthDp: numberParam(searchParams, "displayWidthDp"),
    displayWidthPx: numberParam(searchParams, "displayWidthPx"),
    hardware: searchParams.get("nativeHardware") || undefined,
    hardwareProfile: searchParams.get("hardwareProfile") || undefined,
    mainConnectUserPersonId: searchParams.get("mainConnectUserPersonId") || undefined,
    manufacturer: searchParams.get("nativeManufacturer") || undefined,
    model: searchParams.get("nativeModel") || undefined,
    nativeOrientation: searchParams.get("nativeOrientation") || undefined,
    nativeSdk: numberParam(searchParams, "nativeSdk"),
    product: searchParams.get("nativeProduct") || undefined,
    provisioningCompletedAtMs: numberParam(searchParams, "provisioningCompletedAtMs"),
    receiverDeviceId: searchParams.get("receiverDeviceId") || undefined,
    receiverInstallId: searchParams.get("receiverInstallId") || undefined,
    receiverMode: searchParams.get("receiverMode") || undefined,
    receiverRuntime: searchParams.get("receiver_runtime") || "classic_webview",
    receiverUrl: searchParams.get("receiverUrl") || undefined,
    shellVersion: searchParams.get("shellVersion") || undefined,
    uiLayout: searchParams.get("uiLayout") || searchParams.get("layout") || undefined,
    versionCode: numberParam(searchParams, "nativeVersionCode"),
    versionName: searchParams.get("nativeVersionName") || undefined,
  };
}

function numberParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
