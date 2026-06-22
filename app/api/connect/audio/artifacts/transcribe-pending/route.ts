import {
  connectAudioPrototypeProxyEndpoints,
  postConnectAudioMaintenance,
} from "@/app/lib/connect/audio/server/prototypeAudioProxy";

export async function POST() {
  return postConnectAudioMaintenance(
    connectAudioPrototypeProxyEndpoints.transcribePending,
    { limit: 10 }
  );
}
