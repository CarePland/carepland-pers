import { NextResponse } from "next/server";

import { verifyConnectAudioPersonAccess } from "@/app/lib/connect/audio/server/audioAccess";
import { recordLocalAudioPlaybackEvent } from "@/app/lib/connect/audio/server/localAudioPlaybackEvents";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      artifactId?: string;
      audioEnhancementProfile?: Parameters<typeof recordLocalAudioPlaybackEvent>[0]["audioEnhancementProfile"];
      audioUrl?: string;
      mainConnectUserPersonId?: string;
      messageFrom?: string;
      messageId?: string;
      playbackState?: "ended" | "error" | "fallback" | "feedback" | "started" | "stopped";
      receiverId?: string;
      source?: string;
      surface?: string;
    };
    const personId = payload.mainConnectUserPersonId?.trim() ?? "";

    if (!personId) {
      return NextResponse.json(
        { error: "Select a Main Connect User before recording playback events.", ok: false },
        { status: 400 }
      );
    }

    const deniedResponse = await verifyConnectAudioPersonAccess(
      personId,
      request,
      {},
      { body: payload as unknown as Record<string, unknown> }
    );
    if (deniedResponse) return deniedResponse;

    const event = await recordLocalAudioPlaybackEvent({
      artifactId: payload.artifactId,
      audioEnhancementProfile: payload.audioEnhancementProfile,
      audioUrl: payload.audioUrl,
      mainConnectUserPersonId: personId,
      messageFrom: payload.messageFrom,
      messageId: payload.messageId,
      playbackState: payload.playbackState,
      receiverId: payload.receiverId,
      source: payload.source,
      surface: payload.surface,
    });

    return NextResponse.json({
      event,
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to record Connect audio playback event.",
        ok: false,
      },
      { status: 401 }
    );
  }
}
