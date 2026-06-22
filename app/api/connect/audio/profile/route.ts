import {
  buildConnectAudioProfile,
  filterAudioPlaybackEventsForMainConnectUser,
} from "@/app/lib/connect/audio/server/audioProfileScoping";
import {
  readLocalAudioPlaybackEvents,
} from "@/app/lib/connect/audio/server/localAudioPlaybackEvents";
import { connectAudioPrototypeProxyEndpoints } from "@/app/lib/connect/audio/server/prototypeAudioProxy";
import { verifyConnectAudioPersonAccess } from "@/app/lib/connect/audio/server/audioAccess";
import type { ConnectAudioHearingProfile } from "@/app/lib/connect/audio/types";

export async function GET(request: Request) {
  try {
    const personId = new URL(request.url).searchParams.get("personId")?.trim() ?? "";

    if (personId) {
      const deniedResponse = await verifyConnectAudioPersonAccess(personId, request, {
        localPlaybackEvents: [],
        mainConnectUserPersonId: personId,
        profile: null,
      });
      if (deniedResponse) return deniedResponse;
    }

    const [prototypeProfile, localPlaybackIndex] = await Promise.all([
      personId ? Promise.resolve(null) : fetchPrototypeProfile(),
      readLocalAudioPlaybackEvents(),
    ]);
    const localPlaybackEvents = filterAudioPlaybackEventsForMainConnectUser(
      localPlaybackIndex.events,
      personId
    );
    const profile = buildConnectAudioProfile({
      localPlaybackEvents,
      prototypeProfile,
    });

    return Response.json({
      localPlaybackEvents,
      mainConnectUserPersonId: personId || null,
      ok: true,
      profile,
      scope: personId ? "main_connect_user" : "admin_broad",
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load Connect audio profile.",
        localPlaybackEvents: [],
        mainConnectUserPersonId: null,
        ok: false,
        profile: null,
      },
      { status: 401 }
    );
  }
}

async function fetchPrototypeProfile() {
  try {
    const response = await fetch(connectAudioPrototypeProxyEndpoints.profile, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      profile?: ConnectAudioHearingProfile;
    };

    return response.ok ? payload.profile ?? null : null;
  } catch {
    return null;
  }
}
