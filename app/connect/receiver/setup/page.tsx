import type { Metadata } from "next";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { ReceiverSetupClient } from "./ReceiverSetupClient";

const staticReceiverApkPublicPath = "/downloads/carepland-receiver-debug.apk";
const staticReceiverApkPath = path.join(
  process.cwd(),
  "public",
  "downloads",
  "carepland-receiver-debug.apk"
);
const debugReceiverApkPath = path.join(
  process.cwd(),
  "android",
  "connect-receiver",
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);
const receiverAndroidBuildGradlePath = path.join(
  process.cwd(),
  "android",
  "connect-receiver",
  "app",
  "build.gradle"
);

export const metadata: Metadata = {
  title: "Receiver Setup | CarePland Connect",
  description: "Approve and open a CarePland Connect Receiver install.",
};

type ReceiverSetupPageProps = {
  searchParams: Promise<{
    code?: string;
    device?: string;
    embedded?: string;
    hardwareProfile?: string;
    layout?: string;
    mainConnectUserPersonId?: string;
    receiverUrl?: string;
    uiLayout?: string;
  }>;
};

export default async function ReceiverSetupPage({
  searchParams,
}: ReceiverSetupPageProps) {
  const params = await searchParams;
  const apkDownloadUrl = receiverApkDownloadUrl();

  return (
    <ReceiverSetupClient
      apkDownloadUrl={apkDownloadUrl}
      apkSha256Checksum={receiverApkChecksum(apkDownloadUrl)}
      apkVersionName={receiverApkVersionName()}
      embedded={params.embedded === "1" || params.embedded === "true"}
      initialCode={params.code || ""}
      initialDevice={params.device || "gxv3370"}
      initialHardwareProfile={params.hardwareProfile || "studio_gxv3370_1024x600"}
      initialMainConnectUserPersonId={params.mainConnectUserPersonId || ""}
      initialReceiverUrl={params.receiverUrl || ""}
      initialUiLayout={params.uiLayout || params.layout || "desk_phone_1024x600"}
      setupBaseUrl={process.env.CONNECT_RECEIVER_SETUP_BASE_URL || ""}
    />
  );
}

function receiverApkVersionName() {
  if (process.env.CONNECT_RECEIVER_LATEST_VERSION_NAME) {
    return process.env.CONNECT_RECEIVER_LATEST_VERSION_NAME;
  }

  if (!existsSync(receiverAndroidBuildGradlePath)) {
    return "";
  }

  const buildGradle = readFileSync(receiverAndroidBuildGradlePath, "utf8");
  return buildGradle.match(/\bversionName\s+["']([^"']+)["']/)?.[1] || "";
}

function receiverApkDownloadUrl() {
  if (process.env.CONNECT_RECEIVER_APK_URL) {
    return process.env.CONNECT_RECEIVER_APK_URL;
  }

  if (existsSync(staticReceiverApkPath)) {
    return staticReceiverApkPublicPath;
  }

  if (
    process.env.CONNECT_RECEIVER_DEBUG_APK_ENABLED === "1" ||
    process.env.NODE_ENV !== "production"
  ) {
    return "/api/connect/receiver-shell/apk/debug";
  }

  return "";
}

function receiverApkChecksum(apkDownloadUrl: string) {
  if (process.env.CONNECT_RECEIVER_APK_SHA256_CHECKSUM) {
    return process.env.CONNECT_RECEIVER_APK_SHA256_CHECKSUM;
  }

  if (apkDownloadUrl === staticReceiverApkPublicPath && existsSync(staticReceiverApkPath)) {
    return createHash("sha256")
      .update(readFileSync(staticReceiverApkPath))
      .digest("base64url");
  }

  if (process.env.NODE_ENV === "production" || apkDownloadUrl !== "/api/connect/receiver-shell/apk/debug") {
    return "";
  }

  if (!existsSync(debugReceiverApkPath)) {
    return "";
  }

  return createHash("sha256")
    .update(readFileSync(debugReceiverApkPath))
    .digest("base64url");
}
