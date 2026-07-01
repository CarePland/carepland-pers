import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const debugApkPath = path.join(
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

export async function GET() {
  if (!debugApkDownloadEnabled()) {
    return NextResponse.json(
      {
        error:
          "Debug APK download is disabled. Configure CONNECT_RECEIVER_APK_URL for release installs.",
        ok: false,
      },
      { status: 404 }
    );
  }

  try {
    const [apk, info] = await Promise.all([readFile(debugApkPath), stat(debugApkPath)]);
    return new Response(apk, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": 'attachment; filename="carepland-receiver-debug.apk"',
        "Content-Length": String(info.size),
        "Content-Type": "application/vnd.android.package-archive",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Debug APK has not been built yet.",
        ok: false,
      },
      { status: 404 }
    );
  }
}

function debugApkDownloadEnabled() {
  return (
    process.env.CONNECT_RECEIVER_DEBUG_APK_ENABLED === "1" ||
    process.env.NODE_ENV !== "production"
  );
}
