export type ReceiverRouteHintInput = {
  host?: string | null;
  searchParams?: Record<string, string | undefined>;
  userAgent?: string | null;
};

export type ReceiverRouteHints = {
  device?: string;
  hardwareProfile?: string;
  uiLayout?: string;
  useClassic: boolean;
};

export function receiverRouteHints({
  host,
  searchParams = {},
  userAgent,
}: ReceiverRouteHintInput): ReceiverRouteHints {
  const text = `${host || ""} ${userAgent || ""}`.toLowerCase();
  const explicitProfile = `${searchParams.device || ""} ${
    searchParams.detectedHardwareProfile || ""
  } ${searchParams.hardwareProfile || ""}`.toLowerCase();

  if (
    text.includes("receiver.carepland.com") ||
    text.includes("gxv3370") ||
    text.includes("grandstream") ||
    explicitProfile.includes("gxv3370")
  ) {
    return {
      device: searchParams.device || "gxv3370",
      hardwareProfile: searchParams.hardwareProfile || "grandstream_gxv3370",
      uiLayout: searchParams.uiLayout || "desk_phone_1024x600",
      useClassic: true,
    };
  }

  return { useClassic: false };
}
