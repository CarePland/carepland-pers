import { NextResponse } from "next/server";

import { receiverSetupMetadata } from "@/app/lib/connect/receiverSetup/metadata";

export async function GET() {
  return NextResponse.json({
    ok: true,
    ...receiverSetupMetadata(),
  });
}
