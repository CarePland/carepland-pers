import {
  connectPrototypeEndpoints,
  connectPrototypeReceiverId,
} from "../prototypeClient";
import type {
  ConnectAudioArtifact,
  ConnectAudioArtifactDetail,
  ConnectAudioDashboardSnapshot,
  ConnectAudioHearingProfile,
  ConnectAudioManifest,
  ConnectAudioMaintenancePreview,
  ConnectAudioReview,
} from "./types";

type JsonObject = Record<string, unknown>;

const connectAudioApiEndpoints = {
  artifactDetail: (artifactId: string) =>
    `/api/connect/audio/artifacts/${encodeURIComponent(artifactId)}/detail`,
  artifactTranscribe: (artifactId: string) =>
    `/api/connect/audio/artifacts/${encodeURIComponent(artifactId)}/transcribe`,
  artifacts: "/api/connect/audio/artifacts",
  backfillEventLinks: "/api/connect/audio/maintenance/backfill-event-links",
  backfillIntegrity: "/api/connect/audio/maintenance/backfill-integrity",
  backfillTimeline: "/api/connect/audio/maintenance/backfill-timeline",
  maintenancePreview: "/api/connect/audio/maintenance-preview",
  manifest: "/api/connect/audio/manifest",
  profile: "/api/connect/audio/profile",
  reconcile: "/api/connect/audio/maintenance/reconcile",
  review: "/api/connect/audio/review",
  transcribePending: "/api/connect/audio/artifacts/transcribe-pending",
} as const;

// Broad audio helpers are for Admin/maintenance surfaces. Receiver and Dashboard
// person-facing flows should use selected Main Connect User routes directly.
export async function fetchAdminConnectAudioDashboardSnapshot(): Promise<ConnectAudioDashboardSnapshot> {
  const [artifactsResult, hearingProfileResult, manifestResult, reviewResult] =
    await Promise.allSettled([
      fetchJson<{ artifacts?: ConnectAudioArtifact[] }>(connectAudioApiEndpoints.artifacts),
      fetchJson<{ profile?: ConnectAudioHearingProfile }>(
        connectAudioApiEndpoints.profile
      ),
      fetchJson<{ manifest?: ConnectAudioManifest }>(
        connectAudioApiEndpoints.manifest
      ),
      fetchJson<{ review?: ConnectAudioReview }>(connectAudioApiEndpoints.review),
    ]);

  return {
    artifacts: settledValue(artifactsResult)?.artifacts ?? [],
    hearingProfile: settledValue(hearingProfileResult)?.profile ?? null,
    manifest: settledValue(manifestResult)?.manifest ?? null,
    review: settledValue(reviewResult)?.review ?? null,
  };
}

export async function fetchAdminConnectAudioProfile() {
  return fetchJson<{ profile?: ConnectAudioHearingProfile }>(
    connectAudioApiEndpoints.profile
  );
}

export async function fetchAdminConnectAudioArtifacts() {
  return fetchJson<{ artifacts?: ConnectAudioArtifact[] }>(
    connectAudioApiEndpoints.artifacts
  );
}

export async function fetchAdminConnectAudioReview() {
  return fetchJson<{ review?: ConnectAudioReview }>(
    connectAudioApiEndpoints.review
  );
}

export async function fetchAdminConnectAudioArtifactDetail(artifactId: string) {
  return fetchJson<{ detail?: ConnectAudioArtifactDetail }>(
    connectAudioApiEndpoints.artifactDetail(artifactId)
  );
}

export async function fetchAdminConnectAudioMaintenancePreview() {
  return fetchJson<{ preview?: ConnectAudioMaintenancePreview }>(
    connectAudioApiEndpoints.maintenancePreview
  );
}

export async function adminTranscribeConnectAudioArtifact(artifactId: string) {
  return fetchJson<{ artifact?: ConnectAudioArtifact }>(
    connectAudioApiEndpoints.artifactTranscribe(artifactId),
    postJson()
  );
}

export async function adminTranscribePendingConnectAudioArtifacts() {
  return fetchJson<{ review?: ConnectAudioReview }>(
    connectAudioApiEndpoints.transcribePending,
    postJson()
  );
}

export async function adminReconcileConnectAudioArtifacts() {
  return fetchJson<{ review?: ConnectAudioReview }>(
    connectAudioApiEndpoints.reconcile,
    postJson()
  );
}

export async function adminBackfillConnectAudioIntegrity() {
  return fetchJson<{ review?: ConnectAudioReview }>(
    connectAudioApiEndpoints.backfillIntegrity,
    postJson()
  );
}

export async function adminBackfillConnectAudioTimeline() {
  return fetchJson<{ review?: ConnectAudioReview }>(
    connectAudioApiEndpoints.backfillTimeline,
    postJson()
  );
}

export async function adminBackfillConnectAudioEventLinks() {
  return fetchJson<{ review?: ConnectAudioReview }>(
    connectAudioApiEndpoints.backfillEventLinks,
    postJson()
  );
}

export function connectAudioArtifactMediaUrl(audioUrl: string) {
  return connectPrototypeEndpoints.audioArtifactMedia(audioUrl);
}

export { connectPrototypeReceiverId as connectAudioPrototypeReceiverId };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
    ok?: boolean;
  };

  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Connect audio request failed: ${response.status}`);
  }

  return body;
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

function postJson(body: JsonObject = {}): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  };
}
