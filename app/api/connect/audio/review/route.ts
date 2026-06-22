import { NextResponse } from "next/server";

import { verifyConnectAudioPersonAccess } from "@/app/lib/connect/audio/server/audioAccess";
import { buildConnectAudioReviewResponse } from "@/app/lib/connect/audio/server/audioArtifactScoping";
import { attachLocalAudioArtifactMessageLinks } from "@/app/lib/connect/audio/server/localAudioMessageLinks";
import { readLocalConnectAudioArtifacts } from "@/app/lib/connect/audio/server/localAudioArtifacts";
import {
  connectAudioPrototypeProxyEndpoints,
} from "@/app/lib/connect/audio/server/prototypeAudioProxy";
import type { ConnectAudioReview } from "@/app/lib/connect/audio/types";
import { readLocalConnectMessages } from "@/app/lib/connect/messaging/server/localMessages";

export async function GET(request: Request) {
  const personId = new URL(request.url).searchParams.get("personId")?.trim() ?? "";

  if (personId) {
    const deniedResponse = await verifyConnectAudioPersonAccess(personId, request, {
      review: null,
    });
    if (deniedResponse) return deniedResponse;
  }

  const localIndex = await readLocalConnectAudioArtifacts();
  const messageIndex = await readLocalConnectMessages();
  const localArtifacts = attachLocalAudioArtifactMessageLinks(
    localIndex.artifacts,
    messageIndex.messages,
    { mainConnectUserPersonId: personId }
  );
  const prototypeReview = personId ? null : await fetchPrototypeReview();

  return NextResponse.json(
    buildConnectAudioReviewResponse({
      localArtifacts,
      mainConnectUserPersonId: personId,
      prototypeReview,
    })
  );
}

async function fetchPrototypeReview() {
  try {
    const response = await fetch(connectAudioPrototypeProxyEndpoints.review, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      review?: ConnectAudioReview;
    };

    return response.ok ? payload.review ?? null : null;
  } catch {
    return null;
  }
}
