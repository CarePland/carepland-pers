import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { verifyConnectAudioPersonAccess } from "@/app/lib/connect/audio/server/audioAccess";
import { buildLocalAudioArtifactDetailResponse } from "@/app/lib/connect/audio/server/audioArtifactScoping";
import { findLocalAudioArtifactMessageLinks } from "@/app/lib/connect/audio/server/localAudioMessageLinks";
import {
  localConnectAudioUploadsDir,
  readLocalConnectAudioArtifacts,
} from "@/app/lib/connect/audio/server/localAudioArtifacts";
import {
  connectAudioPrototypeProxyEndpoints,
  proxyConnectAudioJson,
} from "@/app/lib/connect/audio/server/prototypeAudioProxy";
import { readLocalConnectMessages } from "@/app/lib/connect/messaging/server/localMessages";

type RouteContext = {
  params: Promise<{ artifactId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { artifactId } = await context.params;
  const personId = new URL(request.url).searchParams.get("personId")?.trim() ?? "";

  if (personId) {
    const deniedResponse = await verifyConnectAudioPersonAccess(personId, request);
    if (deniedResponse) return deniedResponse;
  }

  const localIndex = await readLocalConnectAudioArtifacts();
  const localArtifact = localIndex.artifacts.find(
    (artifact) => artifact.id === artifactId || artifact.artifactId === artifactId
  );

  if (localArtifact) {
    const storage = await localArtifactStorageDetail(localArtifact.audioUrl);
    const messageIndex = await readLocalConnectMessages();
    const messageLinks = findLocalAudioArtifactMessageLinks(
      localArtifact,
      messageIndex.messages,
      { mainConnectUserPersonId: personId }
    );

    if (personId && !messageLinks.length) {
      return Response.json(
        { error: "Audio artifact was not found for this Main Connect User.", ok: false },
        { status: 404 }
      );
    }

    return Response.json(
      buildLocalAudioArtifactDetailResponse({
        localArtifact,
        mainConnectUserPersonId: personId,
        messageLinks,
        storage,
      })
    );
  }

  if (personId) {
    return Response.json(
      { error: "Audio artifact was not found for this Main Connect User.", ok: false },
      { status: 404 }
    );
  }

  return proxyConnectAudioJson(
    connectAudioPrototypeProxyEndpoints.artifactDetail(artifactId)
  );
}

async function localArtifactStorageDetail(audioUrl?: string) {
  const storageKeyPrefix = "/api/connect/audio/media/";
  const value = String(audioUrl || "");

  if (!value.startsWith(storageKeyPrefix)) {
    return {
      audioUrl: value,
      exists: false,
      originalPreserved: false,
    };
  }

  const storageKey = value.slice(storageKeyPrefix.length);
  const uploadsDir = localConnectAudioUploadsDir();
  const filePath = path.resolve(uploadsDir, storageKey);
  const safeRoot = path.resolve(uploadsDir);

  if (!filePath.startsWith(`${safeRoot}${path.sep}`)) {
    return {
      audioUrl: value,
      exists: false,
      originalPreserved: false,
    };
  }

  try {
    const bytes = await readFile(filePath);

    return {
      audioPath: filePath,
      audioUrl: value,
      currentByteSize: bytes.length,
      currentSha256: createHash("sha256").update(bytes).digest("hex"),
      exists: true,
      originalPreserved: true,
    };
  } catch {
    return {
      audioUrl: value,
      exists: false,
      originalPreserved: false,
    };
  }
}
