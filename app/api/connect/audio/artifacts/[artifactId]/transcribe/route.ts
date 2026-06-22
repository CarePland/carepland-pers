import {
  connectAudioPrototypeProxyEndpoints,
  proxyConnectAudioJson,
} from "@/app/lib/connect/audio/server/prototypeAudioProxy";

type RouteContext = {
  params: Promise<{ artifactId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { artifactId } = await context.params;

  // Admin maintenance only. Person-facing transcription uses
  // /api/connect/audio/transcriptions with an access-checked Main Connect User.
  return proxyConnectAudioJson(
    connectAudioPrototypeProxyEndpoints.artifactTranscribe(artifactId),
    { method: "POST" }
  );
}
