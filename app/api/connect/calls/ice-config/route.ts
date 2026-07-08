import { NextResponse } from "next/server";

import { connectIceConfigFromEnv } from "@/app/lib/connect/calls/server/iceConfig";

export async function GET() {
  return NextResponse.json(
    {
      ...connectIceConfigFromEnv(),
      ok: true,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
