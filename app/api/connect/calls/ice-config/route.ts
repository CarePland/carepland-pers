import { NextResponse } from "next/server";

import { resolveConnectIceConfig } from "@/app/lib/connect/calls/server/iceConfig";

export async function GET() {
  const config = await resolveConnectIceConfig();
  console.info("[connect:calls:ice-config] selected ICE config", {
    hasTurnServer: config.hasTurnServer,
    iceServerCount: config.iceServerCount,
    source: config.source,
  });

  return NextResponse.json(
    {
      iceServers: config.iceServers,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
