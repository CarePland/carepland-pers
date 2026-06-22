export const connectAudioDomainModel = {
  domain: "carepland.audio",
  version: 2,
  generatedBy: "carepland-all",
  features: [
    "preserved_originals",
    "artifact_classification",
    "capture_context",
    "transcript_retry",
    "event_link_health",
    "hearing_profile_source_summaries",
    "review_bundle",
    "ask_audio_trace_links",
    "capability_catalog",
    "event_catalog",
    "artifact_catalog",
    "maintenance_action_catalog",
    "sender_voice_future_placeholder",
  ],
} as const;

export const connectAudioCapabilityCatalog = {
  recording_capture: {
    label: "Recording capture",
    description:
      "Browser clients can capture microphone audio and include capture context for review.",
    surfaces: ["web_receiver"],
  },
  original_artifact_storage: {
    label: "Original artifact storage",
    description:
      "Uploaded audio is preserved as an original artifact with integrity metadata when available.",
    surfaces: ["local_server", "platform_storage"],
  },
  transcription: {
    label: "Transcription",
    description:
      "Preserved audio can be converted to text when transcription credentials are configured.",
    surfaces: ["local_server", "platform_service"],
  },
  transcript_retry: {
    label: "Transcript retry",
    description:
      "Retryable preserved recordings can be transcribed again from the original media file.",
    surfaces: ["local_server", "admin"],
  },
  enhanced_playback: {
    label: "Enhanced playback",
    description:
      "Receiver playback can apply clarity-oriented EQ, gain, compression, and limiting.",
    surfaces: ["web_receiver"],
  },
  hearing_feedback: {
    label: "Hearing feedback",
    description:
      "Receiver feedback can record whether an enhanced playback profile helped.",
    surfaces: ["web_receiver", "local_server", "admin"],
  },
  user_audio_profile_review: {
    label: "User audio profile review",
    description:
      "Admin can review summarized hearing feedback, enhancement settings, and source groupings.",
    surfaces: ["admin"],
  },
  sender_voice_future_placeholder: {
    label: "Sender voice setup",
    description:
      "Future consent-gated setup for reading sender-authored messages in a sender-like generated voice.",
    surfaces: ["admin", "web_receiver"],
    status: "future_concept",
  },
  maintenance_review: {
    label: "Maintenance review",
    description:
      "Admin and tooling can preview and run audio index, integrity, timeline, and link backfills.",
    surfaces: ["local_server", "admin"],
  },
  review_bundle: {
    label: "Review bundle",
    description:
      "Audio review data can be exported as a JSON bundle for migration and analysis.",
    surfaces: ["local_server", "admin"],
  },
} as const;

export const connectAudioEventCatalog = {
  "audio.artifact_preserved": {
    label: "Artifact preserved",
    description: "An original audio file was saved and indexed as a durable artifact.",
    source: "local_server",
  },
  "audio.artifact_indexed": {
    label: "Artifact indexed",
    description: "An existing upload file was represented in the audio artifact index.",
    source: "maintenance",
  },
  "audio.transcription_retried": {
    label: "Transcription retried",
    description: "A preserved audio artifact was sent through transcription again.",
    source: "local_server",
  },
  "audio.enhancement_event": {
    label: "Enhancement event",
    description: "A playback enhancement profile was recorded for review.",
    source: "web_receiver",
  },
  "audio.hearing_feedback": {
    label: "Hearing feedback",
    description:
      "The receiver recorded whether adjusted playback was easier to hear.",
    source: "web_receiver",
  },
} as const;

export const connectAudioArtifactKindCatalog = {
  ask_input: {
    label: "Ask input",
    description: "Voice captured on the receiver as the user's Ask request.",
  },
  ask_recovery: {
    label: "Ask recovery",
    description:
      "Voice captured when the receiver user says an answer was not helpful.",
  },
  coordinator_message: {
    label: "Coordinator message",
    description: "Audio sent from a coordinator or caregiver to the receiver.",
  },
  receiver_message: {
    label: "Receiver message",
    description:
      "Audio sent from the receiver user back to a coordinator or caregiver.",
  },
  audio_message: {
    label: "Audio message",
    description:
      "Generic audio message when sender/receiver classification is not yet specific.",
  },
  recovered_upload: {
    label: "Recovered upload",
    description:
      "Audio recovered from local uploads before a durable artifact record existed.",
  },
  unknown: {
    label: "Unknown",
    description: "Audio with insufficient source information for classification.",
  },
} as const;

export const connectAudioDirectionCatalog = {
  receiver_local_input: {
    label: "Receiver local input",
    description:
      "Audio captured locally on the receiver for interpretation or recovery.",
  },
  receiver_to_coordinator: {
    label: "Receiver to coordinator",
    description:
      "Audio sent from the receiver user to a coordinator or caregiver.",
  },
  coordinator_to_receiver: {
    label: "Coordinator to receiver",
    description:
      "Audio sent from a coordinator or caregiver to the receiver user.",
  },
  unknown: {
    label: "Unknown",
    description:
      "Audio direction could not be inferred from the available source metadata.",
  },
} as const;

export const connectAudioMaintenanceActionCatalog = {
  recover_upload_index: {
    label: "Recover upload index",
    description:
      "Index local upload files that are not yet represented as audio artifacts.",
    stateChanging: true,
  },
  backfill_integrity: {
    label: "Backfill hashes",
    description:
      "Populate byte-size and SHA-256 integrity metadata for preserved audio artifacts.",
    stateChanging: true,
  },
  backfill_timeline: {
    label: "Backfill timeline",
    description:
      "Create missing audio timeline events for preserved artifacts and transcript retries.",
    stateChanging: true,
  },
  backfill_event_artifact_links: {
    label: "Backfill event links",
    description:
      "Attach enhancement and hearing-feedback events to their preserved audio artifacts when resolvable.",
    stateChanging: true,
  },
  retry_pending_transcripts: {
    label: "Retry pending transcripts",
    description:
      "Retry transcription for preserved artifacts that still need text.",
    stateChanging: true,
  },
  inspect_missing_originals: {
    label: "Inspect missing originals",
    description:
      "Review artifact records whose original audio files are no longer available.",
    stateChanging: false,
  },
} as const;

export const connectAudioReadinessStatusCatalog = [
  "ready",
  "reviewable_with_legacy_notes",
  "needs_maintenance",
  "blocked",
] as const;

export const connectAudioReadinessCatalog = {
  backfillable_event_links: {
    label: "Backfillable event links",
    description:
      "Older enhancement or hearing-feedback events can be linked to preserved audio artifacts.",
  },
  legacy_capture_context: {
    label: "Legacy capture context",
    description:
      "Some preserved artifacts predate browser/device capture context metadata.",
  },
  missing_originals: {
    label: "Missing originals",
    description:
      "One or more indexed audio artifacts no longer have their original media file.",
  },
  recoverable_uploads: {
    label: "Recoverable uploads",
    description:
      "Local upload files exist that are not yet represented in the audio artifact index.",
  },
  retryable_transcripts: {
    label: "Retryable transcripts",
    description:
      "Some preserved recordings still need text and can be retried from the original audio.",
  },
  timeline_not_backfilled: {
    label: "Timeline not backfilled",
    description:
      "Indexed artifacts do not yet have corresponding audio timeline events.",
  },
  transcription_not_configured: {
    label: "Transcription not configured",
    description:
      "The audio service does not have transcription credentials available.",
  },
  unhashed_artifacts: {
    label: "Unhashed artifacts",
    description:
      "Some preserved audio artifacts need byte size or SHA-256 integrity metadata.",
  },
  unresolved_event_links: {
    label: "Unresolved event links",
    description:
      "Some enhancement or hearing-feedback events cannot be matched to a preserved artifact.",
  },
} as const;

export type ConnectAudioArtifactKind = keyof typeof connectAudioArtifactKindCatalog;
export type ConnectAudioDirection = keyof typeof connectAudioDirectionCatalog;
export type ConnectAudioReadinessStatus =
  (typeof connectAudioReadinessStatusCatalog)[number];

export type ConnectAudioClassificationInput = {
  artifactKind?: string;
  audioDirection?: string;
  audioUrl?: string;
  from?: string;
  source?: string;
  to?: string;
};

export function classifyConnectAudioArtifact(
  input: ConnectAudioClassificationInput = {}
) {
  const source = String(input.source || "").toLowerCase();
  const from = String(input.from || "").toLowerCase();
  const to = String(input.to || "").toLowerCase();
  const audioUrl = String(input.audioUrl || "").toLowerCase();
  const combined = [source, from, to, audioUrl].join(" ");
  let artifactKind = String(input.artifactKind || "").trim();
  let audioDirection = String(input.audioDirection || "").trim();

  if (!artifactKind) {
    if (
      combined.includes("ask-recovery") ||
      combined.includes("ask_recovery") ||
      combined.includes("recovery")
    ) {
      artifactKind = "ask_recovery";
    } else if (
      combined.includes("ask-input") ||
      combined.includes("ask_input") ||
      source.includes("ask")
    ) {
      artifactKind = "ask_input";
    } else if (
      from === "coordinator_user" ||
      to === "receiver_user" ||
      source.includes("coordinator")
    ) {
      artifactKind = "coordinator_message";
    } else if (from === "receiver_user" || source.includes("receiver")) {
      artifactKind = "receiver_message";
    } else if (source.includes("message")) {
      artifactKind = "audio_message";
    } else if (source.includes("recovered") || audioUrl.includes("/uploads/")) {
      artifactKind = "recovered_upload";
    } else {
      artifactKind = "unknown";
    }
  }

  if (!audioDirection) {
    if (artifactKind === "ask_input" || artifactKind === "ask_recovery") {
      audioDirection = "receiver_local_input";
    } else if (
      from === "coordinator_user" ||
      to === "receiver_user" ||
      artifactKind === "coordinator_message"
    ) {
      audioDirection = "coordinator_to_receiver";
    } else if (from === "receiver_user" || artifactKind === "receiver_message") {
      audioDirection = "receiver_to_coordinator";
    } else {
      audioDirection = "unknown";
    }
  }

  const safeArtifactKind = isConnectAudioArtifactKind(artifactKind)
    ? artifactKind
    : "unknown";
  const safeAudioDirection = isConnectAudioDirection(audioDirection)
    ? audioDirection
    : "unknown";

  return {
    artifactKind: safeArtifactKind,
    audioDirection: safeAudioDirection,
  };
}

export function connectAudioDomainCatalogSnapshot() {
  return {
    audioDomainModel: connectAudioDomainModel,
    capabilities: catalogItems(connectAudioCapabilityCatalog, "id"),
    readiness: {
      statuses: connectAudioReadinessStatusCatalog,
      items: catalogItems(connectAudioReadinessCatalog, "code"),
    },
    events: catalogItems(connectAudioEventCatalog, "type"),
    artifacts: {
      artifactKinds: catalogItems(connectAudioArtifactKindCatalog, "kind"),
      audioDirections: catalogItems(connectAudioDirectionCatalog, "direction"),
    },
    maintenanceActions: catalogItems(connectAudioMaintenanceActionCatalog, "action"),
  };
}

function isConnectAudioArtifactKind(value: string): value is ConnectAudioArtifactKind {
  return value in connectAudioArtifactKindCatalog;
}

function isConnectAudioDirection(value: string): value is ConnectAudioDirection {
  return value in connectAudioDirectionCatalog;
}

function catalogItems<TCatalog extends Record<string, object>, TId extends string>(
  catalog: TCatalog,
  idField: TId
) {
  return Object.entries(catalog).map(([id, item]) => ({
    [idField]: id,
    ...item,
  })) as Array<{ [key in TId]: string } & TCatalog[keyof TCatalog]>;
}
