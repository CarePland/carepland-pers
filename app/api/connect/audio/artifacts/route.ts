import { NextResponse } from "next/server";

import { verifyConnectAudioPersonAccess } from "@/app/lib/connect/audio/server/audioAccess";
import { buildConnectAudioArtifactsResponse } from "@/app/lib/connect/audio/server/audioArtifactScoping";
import { attachLocalAudioArtifactMessageLinks } from "@/app/lib/connect/audio/server/localAudioMessageLinks";
import { readLocalConnectAudioArtifacts } from "@/app/lib/connect/audio/server/localAudioArtifacts";
import {
  connectAudioPrototypeProxyEndpoints,
} from "@/app/lib/connect/audio/server/prototypeAudioProxy";
import type { ConnectAudioArtifact } from "@/app/lib/connect/audio/types";
import { readLocalConnectMessages } from "@/app/lib/connect/messaging/server/localMessages";

export async function GET(request: Request) {
  const personId = new URL(request.url).searchParams.get("personId")?.trim() ?? "";

  if (personId) {
    const deniedResponse = await verifyConnectAudioPersonAccess(personId, request, {
      artifacts: [],
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
  const prototypeArtifacts = personId ? [] : await fetchPrototypeArtifacts();

  return NextResponse.json(
    buildConnectAudioArtifactsResponse({
      localArtifacts,
      mainConnectUserPersonId: personId,
      prototypeArtifacts,
    })
  );
}

async function fetchPrototypeArtifacts() {
  try {
    const response = await fetch(connectAudioPrototypeProxyEndpoints.artifacts, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as {
      artifacts?: ConnectAudioArtifact[];
    };

    return response.ok ? payload.artifacts ?? [] : [];
  } catch {
    return [];
  }
}
