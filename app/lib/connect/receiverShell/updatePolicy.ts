export type ConnectReceiverShellUpdatePolicyInput = {
  nativeVersionName?: string;
  hardwareProfile?: string;
  nativeVersionCode?: number;
  shellVersion?: string;
};

export type ConnectReceiverShellUpdatePolicy = {
  canSelfUpdate: false;
  hardwareProfile: string;
  installUrl?: string;
  installedVersionCode: number;
  installedVersionName: string;
  latestVersionCode: number;
  latestVersionName: string;
  managedUpdateRecommended: boolean;
  minSupportedVersionCode: number;
  ok: true;
  releaseChannel: string;
  releaseNotesUrl?: string;
  updateAction: "none" | "recommended" | "required";
  updateAvailable: boolean;
  updateRequired: boolean;
};

export type ConnectReceiverShellReleasePolicy = {
  installUrl?: string;
  latestVersionCode?: number;
  latestVersionName?: string;
  minSupportedVersionCode?: number;
  releaseChannel?: string;
  releaseNotesUrl?: string;
};

const CURRENT_RECEIVER_SHELL_VERSION_CODE = 10;
const CURRENT_RECEIVER_SHELL_VERSION_NAME = "0.1.9";
const MIN_SUPPORTED_RECEIVER_SHELL_VERSION_CODE = 1;

export function receiverShellUpdatePolicy(
  input: ConnectReceiverShellUpdatePolicyInput,
  releasePolicy: ConnectReceiverShellReleasePolicy = {}
): ConnectReceiverShellUpdatePolicy {
  const nativeVersionCode = normalizedVersionCode(input.nativeVersionCode);
  const latestVersionCode = normalizedVersionCode(releasePolicy.latestVersionCode)
    || CURRENT_RECEIVER_SHELL_VERSION_CODE;
  const minSupportedVersionCode = normalizedVersionCode(releasePolicy.minSupportedVersionCode)
    || MIN_SUPPORTED_RECEIVER_SHELL_VERSION_CODE;
  const updateAvailable =
    nativeVersionCode > 0 && nativeVersionCode < latestVersionCode;
  const updateRequired =
    nativeVersionCode > 0 && nativeVersionCode < minSupportedVersionCode;
  const updateAction = updateRequired
    ? "required"
    : updateAvailable
      ? "recommended"
      : "none";

  return {
    canSelfUpdate: false,
    hardwareProfile: input.hardwareProfile?.trim() || "",
    ...(updateAvailable && releasePolicy.installUrl
      ? { installUrl: releasePolicy.installUrl }
      : {}),
    installedVersionCode: nativeVersionCode,
    installedVersionName: input.nativeVersionName?.trim() || "",
    latestVersionCode,
    latestVersionName:
      releasePolicy.latestVersionName?.trim() || CURRENT_RECEIVER_SHELL_VERSION_NAME,
    managedUpdateRecommended: updateAvailable || updateRequired,
    minSupportedVersionCode,
    ok: true,
    releaseChannel: releasePolicy.releaseChannel?.trim() || "local",
    ...(releasePolicy.releaseNotesUrl?.trim()
      ? { releaseNotesUrl: releasePolicy.releaseNotesUrl.trim() }
      : {}),
    updateAction,
    updateAvailable,
    updateRequired,
  };
}

function normalizedVersionCode(value?: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(Number(value)));
}
