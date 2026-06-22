import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ receiverHouseholdId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  await context.params;

  return NextResponse.json(
    {
      error:
        "Connect participants must reference existing CarePland Pers people in this iteration.",
      ok: false,
      todo:
        "Future Connect participant setup should link an eligible Pers person to a Connect household instead of creating a Connect-only person.",
    },
    { status: 409 }
  );
}
