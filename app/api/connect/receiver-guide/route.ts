import { NextResponse } from "next/server";

import {
  clearConnectReceiverGuideState,
  recordConnectReceiverGuidePresence,
  readAllConnectReceiverGuideStates,
  readConnectReceiverGuideState,
  setConnectReceiverGuideRect,
  setConnectReceiverGuideIdentifyRequests,
  type ConnectReceiverGuideRect,
} from "@/app/lib/connect/receiverGuide/localReceiverGuide";

export async function GET(request: Request) {
  const receiverId = receiverIdFromRequest(request);

  if (!receiverId) {
    return NextResponse.json({
      guides: readAllConnectReceiverGuideStates(),
      ok: true,
    });
  }

  return NextResponse.json({
    guide: readConnectReceiverGuideState(receiverId),
    ok: true,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const receiverId = stringValue(body.receiverId);

  if (!receiverId) {
    return NextResponse.json(
      { error: "Receiver id is required.", ok: false },
      { status: 400 }
    );
  }

  if (body.action === "clear") {
    return NextResponse.json({
      guide: clearConnectReceiverGuideState(receiverId),
      ok: true,
    });
  }

  if (body.action === "press") {
    return NextResponse.json({
      guide: clearConnectReceiverGuideState(receiverId, {
        label: stringValue(body.label) || undefined,
        pressedAt: numberValue(body.pressedAt) || Date.now(),
        receiverSessionId: stringValue(body.receiverSessionId) || undefined,
        target: stringValue(body.target) || null,
      }),
      ok: true,
    });
  }

  if (body.action === "presence") {
    const receiverSessionId = stringValue(body.receiverSessionId);
    if (!receiverSessionId) {
      return NextResponse.json(
        { error: "Receiver session id is required.", ok: false },
        { status: 400 }
      );
    }

    return NextResponse.json({
      guide: recordConnectReceiverGuidePresence(receiverId, receiverSessionId, {
        deviceProfile: stringValue(body.deviceProfile) || undefined,
        pageUrl: stringValue(body.pageUrl) || undefined,
        uiLayout: stringValue(body.uiLayout) || undefined,
      }),
      ok: true,
    });
  }

  if (body.action === "identify") {
    const requests = Array.isArray(body.requests)
      ? body.requests
          .map((request) =>
            request && typeof request === "object"
              ? {
                  code: stringValue((request as { code?: unknown }).code),
                  receiverSessionId: stringValue(
                    (request as { receiverSessionId?: unknown }).receiverSessionId
                  ),
                }
              : null
          )
          .filter(
            (request): request is { code: string; receiverSessionId: string } =>
              Boolean(request?.code && request.receiverSessionId)
          )
      : [];

    if (!requests.length) {
      return NextResponse.json(
        { error: "At least one Receiver session code is required.", ok: false },
        { status: 400 }
      );
    }

    return NextResponse.json({
      guide: setConnectReceiverGuideIdentifyRequests(receiverId, requests),
      ok: true,
    });
  }

  const rect = guideRectValue(body.rect);
  if (!rect) {
    return NextResponse.json(
      { error: "Guide highlight is required.", ok: false },
      { status: 400 }
    );
  }

  return NextResponse.json({
    guide: setConnectReceiverGuideRect(
      receiverId,
      rect,
      stringValue(body.targetReceiverSessionId) || undefined
    ),
    ok: true,
  });
}

function receiverIdFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("receiverId")?.trim() ?? "";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function guideRectValue(value: unknown): ConnectReceiverGuideRect | null {
  if (!value || typeof value !== "object") return null;
  const rect = value as Partial<ConnectReceiverGuideRect>;

  if (
    typeof rect.x !== "number" ||
    typeof rect.y !== "number" ||
    typeof rect.width !== "number" ||
    typeof rect.height !== "number"
  ) {
    return null;
  }

  return {
    height: Math.max(16, rect.height),
    label: typeof rect.label === "string" ? rect.label : "a receiver control",
    width: Math.max(16, rect.width),
    x: rect.x,
    y: rect.y,
  };
}
