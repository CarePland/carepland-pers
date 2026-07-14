import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { careplandRuntimeTempPath } from "@/app/lib/platform/server/runtimeTemp";

export const dynamic = "force-dynamic";

type ReceiverDiagnosticsSettings = {
  enabled: boolean;
  updatedAt: string;
  version: 1;
};

const settingsPath = careplandRuntimeTempPath(
  "connect-receiver",
  "diagnostics-settings.json"
);

const defaultSettings: ReceiverDiagnosticsSettings = {
  enabled: false,
  updatedAt: "",
  version: 1,
};

export async function GET() {
  return NextResponse.json(await readSettings());
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    enabled?: boolean;
  };
  const settings: ReceiverDiagnosticsSettings = {
    enabled: body.enabled === true,
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  await writeSettings(settings);
  return NextResponse.json(settings);
}

async function readSettings(): Promise<ReceiverDiagnosticsSettings> {
  try {
    const parsed = JSON.parse(await readFile(settingsPath, "utf8")) as Partial<
      ReceiverDiagnosticsSettings
    >;
    return {
      enabled: parsed.enabled === true,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      version: 1,
    };
  } catch {
    return defaultSettings;
  }
}

async function writeSettings(settings: ReceiverDiagnosticsSettings) {
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}
