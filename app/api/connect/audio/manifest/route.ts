import {
  connectAudioPrototypeProxyEndpoints,
  proxyConnectAudioJson,
} from "@/app/lib/connect/audio/server/prototypeAudioProxy";

export async function GET() {
  return proxyConnectAudioJson(connectAudioPrototypeProxyEndpoints.manifest);
}
