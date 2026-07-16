import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

export type ReceiverSetupMetadata = {
  apkDownloadUrl: string;
  apkSha256Checksum: string;
  apkVersionName: string;
  setupBaseUrl: string;
};

export function receiverSetupMetadata(): ReceiverSetupMetadata {
  const apkDownloadUrl = receiverApkDownloadUrl();

  return {
    apkDownloadUrl,
    apkSha256Checksum: receiverApkChecksum(apkDownloadUrl),
    apkVersionName: receiverApkVersionName(),
    setupBaseUrl: process.env.CONNECT_RECEIVER_SETUP_BASE_URL || "",
  };
}

export function receiverApkVersionName() {
  if (process.env.CONNECT_RECEIVER_LATEST_VERSION_NAME) {
    return process.env.CONNECT_RECEIVER_LATEST_VERSION_NAME;
  }

  if (!existsSync(receiverAndroidBuildGradlePath)) {
    return "";
  }

  const buildGradle = readFileSync(receiverAndroidBuildGradlePath, "utf8");
  return buildGradle.match(/\bversionName\s+["']([^"']+)["']/)?.[1] || "";
}

export function receiverApkDownloadUrl() {
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

export function receiverApkChecksum(apkDownloadUrl: string) {
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
