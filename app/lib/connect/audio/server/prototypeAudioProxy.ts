import { NextResponse } from "next/server";

import {
  connectPrototypeEndpoints,
  connectPrototypeReceiverId,
} from "../../prototypeClient";

type ProxyJsonOptions = {
  body?: Record<string, unknown>;
  method?: "GET" | "POST";
};

export const connectAudioPrototypeProxyEndpoints = {
  artifactDetail: connectPrototypeEndpoints.audioArtifactDetail,
  artifactTranscribe: connectPrototypeEndpoints.audioArtifactTranscribe,
  artifacts: connectPrototypeEndpoints.audioArtifacts,
  backfillEventLinks: connectPrototypeEndpoints.audioEventsBackfillArtifactLinks,
  backfillIntegrity: connectPrototypeEndpoints.audioArtifactsBackfillIntegrity,
  backfillTimeline: connectPrototypeEndpoints.audioTimelineBackfill,
  maintenancePreview: connectPrototypeEndpoints.audioMaintenancePreview,
  manifest: connectPrototypeEndpoints.audioManifest,
  profile: connectPrototypeEndpoints.audioProfile,
  reconcile: connectPrototypeEndpoints.audioArtifactsReconcile,
  review: connectPrototypeEndpoints.audioReview,
  transcribePending: connectPrototypeEndpoints.audioTranscribePending,
} as const;

export async function proxyConnectAudioJson(
  url: string,
  options: ProxyJsonOptions = {}
) {
  try {
    const method = options.method ?? "GET";
    const response = await fetch(url, {
      body:
        method === "POST"
          ? JSON.stringify({
              receiverId: connectPrototypeReceiverId,
              ...(options.body ?? {}),
            })
          : undefined,
      cache: "no-store",
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      method,
    });
    const payload = await response.json().catch(() => ({}));

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Connect audio prototype proxy failed.",
        ok: false,
      },
      { status: 502 }
    );
  }
}

export function postConnectAudioMaintenance(
  url: string,
  options: { limit: number }
) {
  return proxyConnectAudioJson(url, {
    body: options,
    method: "POST",
  });
}
