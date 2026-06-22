const connectPrototypeBaseUrl = "http://localhost:8790";
const connectPrototypeWebBaseUrl = "http://localhost:4174";

export const connectPrototypeReceiverId = "living-room-receiver";

function prototypeUrl(path: string, params?: Record<string, string | number | boolean>) {
  const url = new URL(path, connectPrototypeBaseUrl);

  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

function receiverUrl(path: string, params?: Record<string, string | number | boolean>) {
  return prototypeUrl(path, {
    receiverId: connectPrototypeReceiverId,
    ...params,
  });
}

export const connectPrototypeEndpoints = {
  audioArtifactDetail: (artifactId: string) =>
    receiverUrl(`/audio/artifacts/${encodeURIComponent(artifactId)}/detail`),
  audioArtifactMedia: (audioUrl: string) => `${connectPrototypeBaseUrl}${audioUrl}`,
  audioArtifactTranscribe: (artifactId: string) =>
    prototypeUrl(`/audio/artifacts/${encodeURIComponent(artifactId)}/transcribe`),
  audioArtifacts: receiverUrl("/audio/artifacts"),
  audioArtifactsBackfillIntegrity: prototypeUrl("/audio/artifacts/backfill-integrity"),
  audioArtifactsReconcile: prototypeUrl("/audio/artifacts/reconcile"),
  audioCapabilities: prototypeUrl("/audio/capabilities"),
  audioDomainModel: prototypeUrl("/audio/domain-model"),
  audioEventsBackfillArtifactLinks: prototypeUrl("/audio/events/backfill-artifact-links"),
  audioMaintenancePreview: receiverUrl("/audio/maintenance-preview"),
  audioManifest: receiverUrl("/audio/manifest"),
  audioProfile: receiverUrl("/audio/hearing-profile"),
  audioReadinessCatalog: prototypeUrl("/audio/readiness-catalog"),
  audioReview: receiverUrl("/audio/review"),
  audioReviewBundle: (download = false) =>
    receiverUrl("/audio/review-bundle", download ? { download: 1 } : undefined),
  audioTimeline: receiverUrl("/audio/timeline"),
  audioTimelineBackfill: prototypeUrl("/audio/timeline/backfill"),
  audioTranscribePending: prototypeUrl("/audio/artifacts/transcribe-pending"),
  appointments: prototypeUrl("/personal/appointments/upcoming", { limit: 8 }),
  call: prototypeUrl("/call"),
  calls: receiverUrl("/calls", { includeEnded: false }),
  callState: (callId: string) => prototypeUrl(`/calls/${encodeURIComponent(callId)}/state`),
  callsSummary: receiverUrl("/calls/summary"),
  dashboard: `${connectPrototypeWebBaseUrl}/index.html`,
  messages: receiverUrl("/messages"),
  provisioning: prototypeUrl("/connect/provisioning"),
  provisioningSummary: prototypeUrl("/connect/provisioning/summary"),
  receivers: prototypeUrl("/receivers"),
  provisioningWithInactive: prototypeUrl("/connect/provisioning", {
    includeInactiveHouseholds: 1,
    includeInactivePeople: 1,
  }),
  theme: receiverUrl("/connect/theme"),
  themeBase: prototypeUrl("/connect/theme"),
} as const;
