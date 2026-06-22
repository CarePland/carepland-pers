import {
  connectAudioPrototypeProxyEndpoints,
  postConnectAudioMaintenance,
} from "@/app/lib/connect/audio/server/prototypeAudioProxy";

export async function POST() {
  return postConnectAudioMaintenance(
    connectAudioPrototypeProxyEndpoints.backfillTimeline,
    { limit: 200 }
  );
}
