import { NextResponse } from "next/server";

import { receiverShellUpdatePolicy } from "@/app/lib/connect/receiverShell/updatePolicy";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const versionCodeParam =
    params.get("nativeVersionCode") || params.get("versionCode") || "";
  const nativeVersionCode = Number.parseInt(versionCodeParam, 10);

  return NextResponse.json(
    receiverShellUpdatePolicy(
      {
        hardwareProfile: params.get("hardwareProfile") || undefined,
        nativeVersionCode,
        nativeVersionName: params.get("nativeVersionName") || undefined,
        shellVersion: params.get("shellVersion") || undefined,
      },
      {
        installUrl: process.env.CONNECT_RECEIVER_APK_URL,
        latestVersionCode: numberFromEnv(process.env.CONNECT_RECEIVER_LATEST_VERSION_CODE),
        latestVersionName: process.env.CONNECT_RECEIVER_LATEST_VERSION_NAME,
        minSupportedVersionCode: numberFromEnv(
          process.env.CONNECT_RECEIVER_MIN_SUPPORTED_VERSION_CODE
        ),
        releaseChannel: process.env.CONNECT_RECEIVER_RELEASE_CHANNEL,
        releaseNotesUrl: process.env.CONNECT_RECEIVER_RELEASE_NOTES_URL,
      }
    ),
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function numberFromEnv(value: string | undefined) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
