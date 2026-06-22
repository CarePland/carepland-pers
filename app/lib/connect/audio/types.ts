import type {
  ConnectAudioArtifactKind,
  ConnectAudioDirection,
  ConnectAudioReadinessStatus,
} from "./domain";
import type { ConnectMessageRecord } from "../messaging";

export type ConnectAudioTranscriptStatus =
  | "completed"
  | "failed"
  | "not_configured"
  | "not_requested"
  | "pending";

export type ConnectSenderVoiceSampleStatus =
  | "needs_update"
  | "not_set_up"
  | "ready";

export type ConnectMessageSpeechSource =
  | "direct_sender_recording"
  | "generic_system_speech"
  | "sender_approved_generated_voice";

export type ConnectSenderVoiceConfig = {
  consentedAt?: string;
  disabledAt?: string;
  enabled: boolean;
  previewAudioArtifactId?: string;
  sampleStatus: ConnectSenderVoiceSampleStatus;
  senderDisplayName: string;
  senderId: string;
};

export type ConnectGeneratedVoiceDisclosure = {
  approvedBySenderId?: string;
  messageSpeechSource: ConnectMessageSpeechSource;
  receiverDisclosureText?: string;
  senderVoiceConfigId?: string;
};

export type ConnectAudioCaptureContext = {
  artifactKind?: ConnectAudioArtifactKind | string;
  askInteractionId?: string;
  audioDirection?: ConnectAudioDirection | string;
  capturedAt?: string;
  captureRole?: string;
  captureSurface?: string;
  clientAudioCaptureId?: string;
  clientLanguage?: string;
  clientLanguages?: string[];
  clientPlatform?: string;
  clientTimeZone?: string;
  clientUserAgent?: string;
  recordingDurationMs?: number;
  recordingMimeType?: string;
};

export type ConnectAudioArtifact = {
  artifactId?: string;
  artifactKind?: ConnectAudioArtifactKind | string;
  audioByteSize?: number;
  audioDurationMs?: number;
  audioDirection?: ConnectAudioDirection | string;
  audioMimeType?: string;
  audioSha256?: string;
  audioUrl?: string;
  captureContext?: ConnectAudioCaptureContext | Record<string, unknown>;
  createdAt?: string;
  id?: string;
  linkedEvents?: Array<Record<string, unknown>>;
  mainConnectUserPersonId?: string;
  relatedMessage?: ConnectMessageRecord | null;
  receiverId?: string;
  source?: string;
  transcript?: string;
  transcriptStatus?: ConnectAudioTranscriptStatus | string;
};

export type ConnectAudioReview = {
  audioDomainModel?: {
    domain?: string;
    features?: string[];
    generatedBy?: string;
    version?: number;
  };
  artifacts?: ConnectAudioArtifact[];
  maintenancePreview?: ConnectAudioMaintenancePreview;
  profile?: ConnectAudioHearingProfile;
  reviewReadiness?: {
    blockers?: string[];
    items?: Array<{
      code?: string;
      description?: string;
      label?: string;
      severity?: string;
    }>;
    maintenance?: string[];
    notes?: string[];
    status?: ConnectAudioReadinessStatus | string;
  };
  readiness?: {
    items?: Array<{
      code?: string;
      description?: string;
      label?: string;
      severity?: string;
    }>;
    status?: ConnectAudioReadinessStatus | string;
  };
  summary?: {
    artifacts?: number;
    missingOriginals?: number;
    pendingTranscripts?: number;
    total?: number;
  };
};

export type ConnectAudioHearingProfile = {
  enhancementEvents?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
  receiverId?: string;
  summary?: {
    averageProfile?: Record<string, number | null | undefined>;
    commonReasons?: Array<{ count?: number; reason?: string }>;
    didNotHelp?: number;
    enhancementEvents?: number;
    feedbackEvents?: number;
    helped?: number;
    helpedRate?: number;
    lastUpdatedAt?: string;
    learningSummary?: Record<string, unknown>;
    playbackEnded?: number;
    playbackErrors?: number;
    playbackFallbacks?: number;
    playbackStarted?: number;
    playbackStopped?: number;
    sourceSummaries?: Array<Record<string, unknown> & { count?: number; label?: string; source?: string }>;
    total?: number;
  };
};

export type ConnectAudioManifest = {
  artifacts?: ConnectAudioArtifact[];
  generatedAt?: string;
  receiverId?: string;
  totals?: Record<string, number>;
};

export type ConnectAudioMaintenancePreview = {
  actions?: Array<{
    action?: string;
    count?: number;
    label?: string;
    stateChanging?: boolean;
  }>;
};

export type ConnectAudioArtifactDetail = {
  artifact?: ConnectAudioArtifact;
  auditTrail?: Array<Record<string, unknown>>;
  enhancementEvents?: Array<Record<string, unknown>>;
  feedbackEvents?: Array<Record<string, unknown>>;
  relatedMessage?: ConnectMessageRecord | null;
  storage?: {
    audioPath?: string;
    audioUrl?: string;
    currentByteSize?: number;
    currentSha256?: string;
    exists?: boolean;
    indexedByteSize?: number;
    indexedSha256?: string;
    integrityMatches?: boolean;
    originalPreserved?: boolean;
  };
  timelineEvents?: Array<Record<string, unknown>>;
};

export type ConnectAudioDashboardSnapshot = {
  artifacts: ConnectAudioArtifact[];
  hearingProfile: ConnectAudioHearingProfile | null;
  manifest: ConnectAudioManifest | null;
  review: ConnectAudioReview | null;
};
