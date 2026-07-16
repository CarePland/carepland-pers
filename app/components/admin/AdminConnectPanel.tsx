"use client";

import {
  ComponentProps,
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { createClient } from "@supabase/supabase-js";

import {
  adminPanelsForArea,
  adminProductSurfaceFor,
  type ConnectAdminAreaKey,
} from "../../admin/adminProductSurfaces";
import { connectPrototypeEndpoints } from "../../lib/connect/prototypeClient";
import {
  adminBackfillConnectAudioEventLinks,
  adminBackfillConnectAudioIntegrity,
  adminBackfillConnectAudioTimeline,
  adminReconcileConnectAudioArtifacts,
  adminTranscribeConnectAudioArtifact,
  adminTranscribePendingConnectAudioArtifacts,
  fetchAdminConnectAudioArtifactDetail,
  fetchAdminConnectAudioArtifacts,
  fetchAdminConnectAudioMaintenancePreview,
  fetchAdminConnectAudioProfile,
  fetchAdminConnectAudioReview,
} from "../../lib/connect/audio";
import {
  fetchConnectProvisioningSnapshot,
  type ConnectProvisioningSnapshot,
  type ConnectReceiverHousehold,
  type ConnectReceiverPerson,
} from "../../lib/connect/provisioning";
import {
  fetchConnectTheme,
  resetConnectTheme,
  saveConnectTheme,
  type ConnectTheme,
} from "../../lib/connect/theme";
import { createObservation } from "../../lib/platform/ai/observationPipeline";
import { interpretReceiverAskObservation } from "../../lib/platform/ai/receiverAskInterpreter";
import { AdminAiPanel } from "./AdminAiPanel";

type ConnectAudioProfileEvent = {
  artifactId?: string;
  artifactKind?: string;
  audioDirection?: string;
  audioEnhancementProfile?: {
    adjustments?: {
      bassReduction?: string;
      compression?: string;
      speed?: string;
      timbre?: string;
    } | null;
    compressor?: {
      ratio?: number;
      thresholdDb?: number;
    } | null;
    gainMultiplier?: number;
    highPassHz?: number;
    lowMidGainDb?: number;
    playbackGain?: number;
    playbackRate?: number;
    presenceGainDb?: number;
    profileId?: string;
    reasons?: string[];
  } | null;
  audioUrl?: string;
  createdAt?: string;
  improved?: boolean;
  messageFrom?: string;
  playbackState?: "ended" | "error" | "fallback" | "started" | "stopped";
  source?: string;
  surface?: string;
};

type ConnectAudioProfile = {
  enhancementEvents?: ConnectAudioProfileEvent[];
  events?: ConnectAudioProfileEvent[];
  summary?: {
    averageProfile?: {
      compressorRatio?: number | null;
      compressorThresholdDb?: number | null;
      gainMultiplier?: number | null;
      highPassHz?: number | null;
      lowMidGainDb?: number | null;
      playbackGain?: number | null;
      presenceGainDb?: number | null;
    };
    compressorRatio?: number | null;
    compressorThresholdDb?: number | null;
    didNotHelp?: number;
    enhancementEvents?: number;
    helped?: number;
    helpedRate?: number | null;
    learningSummary?: {
      adjustments?: Record<string, Record<string, number>>;
      preferenceCounts?: {
        original?: number;
        same?: number;
        version1?: number;
        version2?: number;
      };
      preferredChoice?: string;
      profileCounts?: Record<string, number>;
      total?: number;
    };
    playbackEnded?: number;
    playbackErrors?: number;
    playbackFallbacks?: number;
    playbackStarted?: number;
    playbackStopped?: number;
    total?: number;
    sourceSummaries?: Array<{
      artifactIds?: string[];
      commonReasons?: Array<{ count?: number; reason?: string }>;
      didNotHelp?: number;
      enhancementEvents?: number;
      feedbackEvents?: number;
      helped?: number;
      helpedRate?: number | null;
      key?: string;
      label?: string;
      lastUpdatedAt?: string;
      sourceType?: string;
    }>;
  };
};

type ConnectAudioReview = {
  audioDomainModel?: {
    domain?: string;
    features?: string[];
    generatedBy?: string;
    version?: number;
  };
  artifacts?: ConnectAudioArtifact[];
  captureHealth?: {
    artifactCount?: number;
    missingCaptureContext?: number;
    status?: string;
    withCaptureContext?: number;
  };
  eventLinkHealth?: {
    eventCount?: number;
    linkedCount?: number;
    resolvableUnlinkedCount?: number;
    status?: string;
    unresolvedCount?: number;
  };
  maintenancePreview?: ConnectAudioMaintenancePreview;
  profile?: ConnectAudioProfile;
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
    status?: string;
  };
  storageHealth?: {
    duplicateArtifacts?: number;
    duplicateGroups?: number;
    recoverableUploads?: number;
    missingOriginals?: number;
    status?: string;
    totalBytes?: number;
    unhashedArtifacts?: number;
  };
  transcriptionHealth?: {
    artifactCount?: number;
    needsTranscript?: number;
    retryable?: number;
    status?: string;
    transcribed?: number;
    transcriptionConfigured?: boolean;
    transcriptionModel?: string;
  };
  timelineSummary?: {
    eventCount?: number;
    firstArtifactAt?: string;
    lastArtifactAt?: string;
    latestEventAt?: string;
    latestEventType?: string;
    typeCounts?: Record<string, number>;
  };
  summary?: {
    artifactCount?: number;
    automaticEnhancementEvents?: number;
    enhancedPlaybacks?: number;
    feedbackEvents?: number;
    heard?: number;
    duplicateArtifacts?: number;
    linkedLocalArtifacts?: number;
    needsTranscript?: number;
    originalsPreserved?: number;
    profileEvents?: number;
    read?: number;
    transcribed?: number;
  };
};

type ConnectAudioArtifactDetail = {
  artifact?: ConnectAudioArtifact;
  auditTrail?: ConnectAudioAuditEvent[];
  enhancementEvents?: ConnectAudioProfileEvent[];
  feedbackEvents?: ConnectAudioProfileEvent[];
  relatedMessage?: ConnectAudioArtifact["relatedMessage"];
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
  timelineEvents?: ConnectAudioAuditEvent[];
};

type ConnectAudioAuditEvent = {
  createdAt?: string;
  detail?: Record<string, unknown>;
  summary?: string;
  type?: string;
};

type ConnectAudioArtifact = {
  artifactId?: string;
  audioByteSize?: number;
  audioDirection?: string;
  audioDurationMs?: number;
  audioMimeType?: string;
  audioSha256?: string;
  audioUrl?: string;
  artifactKind?: string;
  clientMessageId?: string;
  captureContext?: {
    captureRole?: string;
    captureSurface?: string;
    clientPlatform?: string;
    clientTimeZone?: string;
  };
  createdAt?: string;
  duplicateInfo?: {
    duplicateArtifactIds?: string[];
    duplicateCount?: number;
    duplicateGroupHash?: string;
  } | null;
  from?: string;
  id?: string;
  messageId?: string;
  originalPreserved?: boolean;
  relatedMessage?: {
    audioArtifactId?: string;
    audioUrl?: string;
    body?: string;
    clientMessageId?: string;
    createdAt?: string;
    from?: string;
    heardAt?: string;
    id?: string;
    messageType?: string;
    readAt?: string;
    source?: string;
    to?: string;
    transcript?: string;
    transcriptStatus?: string;
  } | null;
  source?: string;
  to?: string;
  transcript?: string;
  transcriptionRetriedAt?: string;
  transcriptStatus?: string;
};

type ConnectAudioMessageLink = {
  audioArtifactId?: string;
  audioDurationMs?: number;
  audioMimeType?: string;
  audioUrl?: string;
  body?: string;
  createdAt?: string;
  from?: string;
  heardAt?: string;
  id?: string;
  messageType?: string;
  readAt?: string;
  receiverId?: string;
  source?: string;
  to?: string;
  transcript?: string;
  transcriptStatus?: string;
};

type ConnectAudioMaintenancePreview = {
  actions?: Array<{
    action?: string;
    count?: number;
    label?: string;
    stateChanging?: boolean;
  }>;
};

type AudioArtifactFilter =
  | "all"
  | "receiver_voice"
  | "coordinator_messages"
  | "linked_messages"
  | "unlinked"
  | "transcribed"
  | "needs_text"
  | "enhanced";

type ConnectRecordsFocus = "overview" | "users" | "households" | "devices";
type ConnectLifecycleFilter = "all" | "active" | "inactive";
type ConnectProvisioningLoadState = "idle" | "loading" | "ready" | "error";
type ConnectRecordNavigationArea =
  | "devices"
  | "households"
  | "provisioning"
  | "users";
type ConnectRecordNavigation = (
  area: ConnectRecordNavigationArea,
  searchText: string
) => void;
type ConnectReviewQueueItem = {
  action: string;
  detail: string;
  label: string;
  priority: string;
  recordType: string;
  searchText: string;
};

type InteractionReviewQueueItem = {
  attemptId: string;
  careSubjectDisplayName: string;
  familyEvolution: string[];
  finalUserWording: string;
  includeReasons: string[];
  originalUserWording: string;
  outcome: string;
  reviewState: "analyzed" | "reviewed" | "unreviewed";
  revisionCount: number;
  startedAt: string;
  status: string;
  surface: string;
};

type InteractionAttemptDetail = {
  events: Array<{
    actorRole?: string;
    createdAt?: string;
    eventType?: string;
    id?: string;
    observationId?: string;
    payload?: Record<string, unknown>;
  }>;
  observations: Array<{
    createdAt?: string;
    observationId?: string;
    observationSnapshot?: {
      rawText?: string;
      transcriptText?: string;
      modality?: string;
      source?: string;
    };
    parentObservationId?: string;
    revisionIndex?: number;
    revisionReason?: string;
  }>;
  queueItem: InteractionReviewQueueItem | null;
  reviewAnalyses: Array<{
    affectedPlatformLayers?: string[];
    analysisText?: string;
    createdAt?: string;
    identifiedConcerns?: string[];
    reviewId?: string;
    suggestedRefinementAreas?: string[];
  }>;
  reviews: Array<{
    comment?: string;
    createdAt?: string;
    id?: string;
  }>;
};

type BulkReceiverQuestionResult = {
  actionLabel: string;
  answer: string;
  askCapabilityStatus: string;
  askEntities: string;
  askIntent: string;
  family: string;
  lineNumber: number;
  needsRecovery: boolean;
  question: string;
  responseType: string;
  secondaryFamilies: string;
};

const ConnectActionDraftContext = createContext<{
  draftResetVersion: number;
  setDraftActive: (draftId: string, active: boolean) => void;
}>({
  draftResetVersion: 0,
  setDraftActive: () => undefined,
});

const connectAdminAreaKeys = [
  "audio",
  "devices",
  "households",
  "interaction_traces",
  "provisioning",
  "request_interpretation",
  "users",
] as const satisfies readonly ConnectAdminAreaKey[];

const connectProvisioningCacheFreshMs = 5 * 60 * 1000;
let connectProvisioningSnapshotCache:
  | { lastLoadedAt: string; snapshot: ConnectProvisioningSnapshot }
  | null = null;
const connectAudioDomainModelEndpoint = connectPrototypeEndpoints.audioDomainModel;
const connectAudioCapabilitiesEndpoint = connectPrototypeEndpoints.audioCapabilities;
const connectAudioReadinessCatalogEndpoint =
  connectPrototypeEndpoints.audioReadinessCatalog;
const connectAudioManifestEndpoint = connectPrototypeEndpoints.audioManifest;
const connectAudioReviewBundleEndpoint =
  connectPrototypeEndpoints.audioReviewBundle();
const connectAudioReviewBundleDownloadEndpoint =
  connectPrototypeEndpoints.audioReviewBundle(true);
const connectAudioTimelineEndpoint = connectPrototypeEndpoints.audioTimeline;
const connectAdminAreaStorageKey = "carepland.admin.connect.activeArea.v1";
const connectThemeStorageKey = "carepland.connect.receiver.theme.v2";
const adminSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const adminSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const adminSupabase =
  adminSupabaseUrl && adminSupabaseAnonKey
    ? createClient(adminSupabaseUrl, adminSupabaseAnonKey)
    : null;

const defaultConnectTheme: ConnectTheme = {
  name: "Classic Green",
  primaryActionColor: "#26661A",
  secondaryActionColor: "#fffdf7",
  informationActionColor: "#2d5c87",
  recordActionColor: "#111111",
  secondaryUtilityColor: "#5f665f",
  panelBackgroundColor: "#f4f5f3",
  outerFrameColor: "#202423",
  textColor: "#17231d",
  borderColor: "#b9beb8",
};

const connectThemePresets: ConnectTheme[] = [
  defaultConnectTheme,
  {
    name: "Vintage Radio",
    primaryActionColor: "#7a4b20",
    secondaryActionColor: "#fff5dd",
    informationActionColor: "#b88422",
    recordActionColor: "#23170f",
    secondaryUtilityColor: "#6d5945",
    panelBackgroundColor: "#fff0d1",
    outerFrameColor: "#4c2d18",
    textColor: "#211711",
    borderColor: "#b08b5e",
  },
  {
    name: "Mid-Century",
    primaryActionColor: "#667447",
    secondaryActionColor: "#fff4dd",
    informationActionColor: "#315f77",
    recordActionColor: "#202322",
    secondaryUtilityColor: "#6b6a5e",
    panelBackgroundColor: "#f5ead1",
    outerFrameColor: "#202423",
    textColor: "#18201a",
    borderColor: "#b9aa84",
  },
  {
    name: "Art Deco",
    primaryActionColor: "#b99338",
    secondaryActionColor: "#fff9e8",
    informationActionColor: "#2f5b7c",
    recordActionColor: "#050505",
    secondaryUtilityColor: "#5b5548",
    panelBackgroundColor: "#fff8e7",
    outerFrameColor: "#050505",
    textColor: "#111111",
    borderColor: "#b99338",
  },
  {
    name: "Mission Control",
    primaryActionColor: "#4f7155",
    secondaryActionColor: "#f5f7f4",
    informationActionColor: "#3d657c",
    recordActionColor: "#111615",
    secondaryUtilityColor: "#5b6562",
    panelBackgroundColor: "#f2f4f1",
    outerFrameColor: "#222827",
    textColor: "#121918",
    borderColor: "#a7b0aa",
  },
  {
    name: "Library",
    primaryActionColor: "#17452d",
    secondaryActionColor: "#fff4dc",
    informationActionColor: "#284f75",
    recordActionColor: "#1c120b",
    secondaryUtilityColor: "#5e4a35",
    panelBackgroundColor: "#fff1d4",
    outerFrameColor: "#3b2517",
    textColor: "#151c16",
    borderColor: "#9d7f55",
  },
  {
    name: "High Contrast",
    primaryActionColor: "#0b6f24",
    secondaryActionColor: "#ffffff",
    informationActionColor: "#005fcc",
    recordActionColor: "#000000",
    secondaryUtilityColor: "#333333",
    panelBackgroundColor: "#ffffff",
    outerFrameColor: "#000000",
    textColor: "#000000",
    borderColor: "#111111",
  },
  {
    name: "Soft Cream",
    primaryActionColor: "#6c7d57",
    secondaryActionColor: "#fffaf0",
    informationActionColor: "#6f879b",
    recordActionColor: "#4d4a43",
    secondaryUtilityColor: "#7a7468",
    panelBackgroundColor: "#fff8e9",
    outerFrameColor: "#d8c8ad",
    textColor: "#283027",
    borderColor: "#d5c8ae",
  },
];

const connectThemeFields: Array<keyof ConnectTheme> = [
  "primaryActionColor",
  "secondaryActionColor",
  "informationActionColor",
  "recordActionColor",
  "secondaryUtilityColor",
  "panelBackgroundColor",
  "outerFrameColor",
  "textColor",
  "borderColor",
];

const connectThemeFieldLabels: Record<keyof ConnectTheme, string> = {
  name: "Name",
  primaryActionColor: "Primary action",
  secondaryActionColor: "Secondary action",
  informationActionColor: "Information action",
  recordActionColor: "Record action",
  secondaryUtilityColor: "Secondary utility",
  panelBackgroundColor: "Panel background",
  outerFrameColor: "Outer frame",
  textColor: "Text",
  borderColor: "Border",
};

type AdminConnectPanelProps = {
  ai: Omit<ComponentProps<typeof AdminAiPanel>, "adminArea">;
};

export function AdminConnectPanel({ ai }: AdminConnectPanelProps) {
  const surface = adminProductSurfaceFor("connect");
  const [activeArea, setActiveArea] = useState<ConnectAdminAreaKey>(() => {
    if (typeof window === "undefined") return "provisioning";
    const storedArea = window.localStorage.getItem(connectAdminAreaStorageKey);
    return isConnectAdminAreaKey(storedArea) ? storedArea : "provisioning";
  });
  const [pendingRecordSearch, setPendingRecordSearch] = useState<{
    area: ConnectRecordNavigationArea;
    searchText: string;
  } | null>(null);

  const navigateToConnectRecord: ConnectRecordNavigation = (area, searchText) => {
    setPendingRecordSearch({ area, searchText });
    setActiveArea(area);
  };

  useEffect(() => {
    window.localStorage.setItem(connectAdminAreaStorageKey, activeArea);
  }, [activeArea]);

  useEffect(() => {
    if (
      activeArea === "request_interpretation" &&
      ai.aiAdminTab !== "instructions"
    ) {
      ai.handleChangeAiAdminTab("instructions");
    }
  }, [activeArea, ai]);

  const activeAreaRecord = surface?.areas.find((area) => area.key === activeArea);
  const registrations = adminPanelsForArea("connect", activeArea);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">Connect admin</h2>
        <p className="mt-1 text-sm text-slate-600">
          {surface?.description ??
            "Receiver, provisioning, audio, and interaction operations."}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {surface?.areas.map((area) => (
          <button
            className={`rounded-md border px-4 py-3 text-left ${
              activeArea === area.key
                ? "border-blue-300 bg-blue-50 text-blue-950"
                : "border-slate-200 bg-white text-slate-700"
            }`}
            key={area.key}
            onClick={() => setActiveArea(area.key as ConnectAdminAreaKey)}
            type="button"
          >
            <span className="block text-sm font-semibold">{area.label}</span>
            <span className="mt-1 block text-xs leading-5 opacity-75">
              {area.description}
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Connect area
          </p>
          <h3 className="text-lg font-semibold text-slate-900">
            {activeAreaRecord?.label ?? "Connect"}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {registrations.map((registration) => (
              <span
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                key={registration.key}
              >
                {registration.label}
              </span>
            ))}
          </div>
        </div>

        {activeArea === "audio" ? <ConnectAudioArea /> : null}
        {activeArea === "provisioning" ? (
          <ConnectProvisioningArea
            onNavigateRecord={navigateToConnectRecord}
            pendingSearchText={
              pendingRecordSearch?.area === "provisioning"
                ? pendingRecordSearch.searchText
                : ""
            }
          />
        ) : null}
        {activeArea === "users" ? (
          <ConnectUsersArea
            onNavigateRecord={navigateToConnectRecord}
            pendingSearchText={
              pendingRecordSearch?.area === "users"
                ? pendingRecordSearch.searchText
                : ""
            }
          />
        ) : null}
        {activeArea === "households" ? (
          <ConnectHouseholdsArea
            onNavigateRecord={navigateToConnectRecord}
            pendingSearchText={
              pendingRecordSearch?.area === "households"
                ? pendingRecordSearch.searchText
                : ""
            }
          />
        ) : null}
        {activeArea === "devices" ? (
          <ConnectDevicesArea
            onNavigateRecord={navigateToConnectRecord}
            pendingSearchText={
              pendingRecordSearch?.area === "devices"
                ? pendingRecordSearch.searchText
                : ""
            }
          />
        ) : null}
        {activeArea === "request_interpretation" ? (
          <AdminAiPanel {...ai} adminArea="connect" />
        ) : null}
        {activeArea === "interaction_traces" ? <ConnectTraceArea /> : null}
      </div>
    </section>
  );
}

function ConnectAudioArea() {
  const [artifacts, setArtifacts] = useState<ConnectAudioArtifact[]>([]);
  const [artifactFilter, setArtifactFilter] = useState<AudioArtifactFilter>("all");
  const [artifactStatus, setArtifactStatus] = useState("");
  const [artifactDetail, setArtifactDetail] =
    useState<ConnectAudioArtifactDetail | null>(null);
  const [artifactDetailStatus, setArtifactDetailStatus] = useState("");
  const [selectedArtifactId, setSelectedArtifactId] = useState("");
  const [loadingArtifactDetail, setLoadingArtifactDetail] = useState(false);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [maintenancePreview, setMaintenancePreview] =
    useState<ConnectAudioMaintenancePreview | null>(null);
  const [messageLinks, setMessageLinks] = useState<ConnectAudioMessageLink[]>([]);
  const [profile, setProfile] = useState<ConnectAudioProfile | null>(null);
  const [review, setReview] = useState<ConnectAudioReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const artifactSummary = useMemo(
    () => audioArtifactStats(artifacts, profile),
    [artifacts, profile]
  );
  const artifactFilters = useMemo(
    () => audioArtifactFilterOptions(artifacts, profile),
    [artifacts, profile]
  );
  const filteredArtifacts = useMemo(
    () =>
      artifacts.filter((artifact) =>
        audioArtifactMatchesFilter(artifact, artifactFilter, profile)
      ),
    [artifacts, artifactFilter, profile]
  );
  const maintenanceCount = (actionId: string) => {
    const action = maintenancePreview?.actions?.find((item) => item.action === actionId);
    return action ? Number(action.count || 0) : null;
  };
  const maintenanceDisabled = (actionId: string) => {
    const count = maintenanceCount(actionId);
    return loadingArtifacts || count === 0;
  };

  async function loadProfile() {
    setLoading(true);
    setStatus("Loading Connect audio profile...");
    try {
      const payload = (await fetchAdminConnectAudioProfile()) as {
        profile?: ConnectAudioProfile;
      };
      setProfile(payload.profile ?? null);
      setReview((current) => ({
        ...(current ?? {}),
        ...(payload.profile ? { profile: payload.profile } : {}),
      }));
      setStatus(
        payload.profile?.summary?.total
          ? "Loaded from local Connect receiver feedback."
          : "No receiver hearing feedback yet."
      );
    } catch (error) {
      setProfile(null);
      setStatus(
        error instanceof Error ? error.message : "Connect audio profile unavailable."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadArtifacts() {
    setLoadingArtifacts(true);
    setArtifactStatus("Loading saved audio artifacts...");
    try {
      const payload = (await fetchAdminConnectAudioArtifacts()) as {
        artifacts?: ConnectAudioArtifact[];
      };
      setArtifacts(payload.artifacts ?? []);
      setReview((current) => ({ ...(current ?? {}), artifacts: payload.artifacts ?? [] }));
      setArtifactStatus(
        payload.artifacts?.length
          ? "Loaded original audio artifact index."
          : "No saved audio artifacts for this receiver yet."
      );
    } catch (error) {
      setArtifacts([]);
      setArtifactStatus(
        error instanceof Error ? error.message : "Audio artifact index unavailable."
      );
    } finally {
      setLoadingArtifacts(false);
    }
  }

  async function loadAudioReview() {
    setLoading(true);
    setLoadingArtifacts(true);
    setStatus("Loading Connect audio review...");
    setArtifactStatus("Loading audio review...");
    try {
      const payload = (await fetchAdminConnectAudioReview()) as {
        review?: ConnectAudioReview;
      };
      setReview(payload.review ?? null);
      setProfile(payload.review?.profile ?? null);
      setArtifacts(payload.review?.artifacts ?? []);
      setMaintenancePreview(payload.review?.maintenancePreview ?? null);
      await loadAudioMessageLinks();
      setStatus("Loaded from audio review endpoint.");
      setArtifactStatus("Loaded artifacts, profile, and related audio activity.");
    } catch {
      await Promise.all([loadProfile(), loadArtifacts()]);
    } finally {
      setLoading(false);
      setLoadingArtifacts(false);
    }
  }

  async function retryArtifactTranscription(artifactId?: string) {
    if (!artifactId) return;
    setArtifacts((current) =>
      current.map((artifact) =>
        artifact.id === artifactId
          ? { ...artifact, transcriptStatus: "retrying" }
          : artifact
      )
    );
    setArtifactStatus("Retrying transcript from preserved original audio...");
    try {
      const payload = (await adminTranscribeConnectAudioArtifact(artifactId)) as {
        artifact?: ConnectAudioArtifact;
      };
      setArtifacts((current) =>
        current.map((artifact) =>
          artifact.id === artifactId && payload.artifact
            ? payload.artifact
            : artifact
        )
      );
      setArtifactStatus("Transcript retry finished.");
    } catch (error) {
      setArtifacts((current) =>
        current.map((artifact) =>
          artifact.id === artifactId
            ? { ...artifact, transcriptStatus: "retry_failed" }
            : artifact
        )
      );
      setArtifactStatus(
        error instanceof Error ? error.message : "Transcript retry failed."
      );
    }
  }

  async function loadArtifactDetail(artifactId?: string) {
    if (!artifactId) return;
    setSelectedArtifactId(artifactId);
    setArtifactDetail(null);
    setLoadingArtifactDetail(true);
    setArtifactDetailStatus("Loading audio artifact detail...");
    try {
      const payload = (await fetchAdminConnectAudioArtifactDetail(artifactId)) as {
        detail?: ConnectAudioArtifactDetail;
      };
      setArtifactDetail(payload.detail ?? null);
      setArtifactDetailStatus(
        payload.detail
          ? "Loaded audio artifact detail."
          : "No detail was returned for this artifact."
      );
    } catch (error) {
      setArtifactDetail(null);
      setArtifactDetailStatus(
        error instanceof Error ? error.message : "Audio artifact detail unavailable."
      );
    } finally {
      setLoadingArtifactDetail(false);
    }
  }

  async function retryPendingTranscripts() {
    setLoadingArtifacts(true);
    setArtifactStatus("Retrying pending transcripts from preserved originals...");
    try {
      const payload = (await adminTranscribePendingConnectAudioArtifacts()) as {
        review?: ConnectAudioReview;
      };
      setReview(payload.review ?? null);
      setProfile(payload.review?.profile ?? null);
      setArtifacts(payload.review?.artifacts ?? []);
      setMaintenancePreview(payload.review?.maintenancePreview ?? null);
      setArtifactStatus("Pending transcript retry finished.");
    } catch (error) {
      setArtifactStatus(
        error instanceof Error
          ? error.message
          : "Pending transcript retry failed."
      );
    } finally {
      setLoadingArtifacts(false);
    }
  }

  async function recoverAudioUploadIndex() {
    setLoadingArtifacts(true);
    setArtifactStatus("Recovering preserved uploads into the audio index...");
    try {
      const payload = (await adminReconcileConnectAudioArtifacts()) as {
        review?: ConnectAudioReview;
      };
      setReview(payload.review ?? null);
      setProfile(payload.review?.profile ?? null);
      setArtifacts(payload.review?.artifacts ?? []);
      setMaintenancePreview(payload.review?.maintenancePreview ?? null);
      setArtifactStatus("Recovered preserved uploads into the audio index.");
    } catch (error) {
      setArtifactStatus(
        error instanceof Error ? error.message : "Upload index recovery failed."
      );
    } finally {
      setLoadingArtifacts(false);
    }
  }

  async function backfillAudioIntegrity() {
    setLoadingArtifacts(true);
    setArtifactStatus("Backfilling audio file hashes from preserved originals...");
    try {
      const payload = (await adminBackfillConnectAudioIntegrity()) as {
        review?: ConnectAudioReview;
      };
      setReview(payload.review ?? null);
      setProfile(payload.review?.profile ?? null);
      setArtifacts(payload.review?.artifacts ?? []);
      setMaintenancePreview(payload.review?.maintenancePreview ?? null);
      setArtifactStatus("Audio hash backfill finished.");
    } catch (error) {
      setArtifactStatus(
        error instanceof Error ? error.message : "Audio hash backfill failed."
      );
    } finally {
      setLoadingArtifacts(false);
    }
  }

  async function backfillAudioTimeline() {
    setLoadingArtifacts(true);
    setArtifactStatus("Backfilling audio timeline from indexed artifacts...");
    try {
      const payload = (await adminBackfillConnectAudioTimeline()) as {
        review?: ConnectAudioReview;
      };
      setReview(payload.review ?? null);
      setProfile(payload.review?.profile ?? null);
      setArtifacts(payload.review?.artifacts ?? []);
      setMaintenancePreview(payload.review?.maintenancePreview ?? null);
      setArtifactStatus("Audio timeline backfill finished.");
    } catch (error) {
      setArtifactStatus(
        error instanceof Error ? error.message : "Audio timeline backfill failed."
      );
    } finally {
      setLoadingArtifacts(false);
    }
  }

  async function backfillAudioEventLinks() {
    setLoadingArtifacts(true);
    setArtifactStatus("Backfilling audio event artifact links...");
    try {
      const payload = (await adminBackfillConnectAudioEventLinks()) as {
        review?: ConnectAudioReview;
      };
      setReview(payload.review ?? null);
      setProfile(payload.review?.profile ?? null);
      setArtifacts(payload.review?.artifacts ?? []);
      setMaintenancePreview(payload.review?.maintenancePreview ?? null);
      setArtifactStatus("Audio event artifact link backfill finished.");
    } catch (error) {
      setArtifactStatus(
        error instanceof Error
          ? error.message
          : "Audio event artifact link backfill failed."
      );
    } finally {
      setLoadingArtifacts(false);
    }
  }

  async function loadMaintenancePreview() {
    setArtifactStatus("Loading audio maintenance preview...");
    try {
      const payload = (await fetchAdminConnectAudioMaintenancePreview()) as {
        preview?: ConnectAudioMaintenancePreview;
      };
      setMaintenancePreview(payload.preview ?? null);
      setArtifactStatus("Loaded audio maintenance preview.");
    } catch (error) {
      setArtifactStatus(
        error instanceof Error
          ? error.message
          : "Audio maintenance preview unavailable."
      );
    }
  }

  async function loadAudioMessageLinks() {
    try {
      const response = await fetch("/api/connect/messages", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as {
        messages?: ConnectAudioMessageLink[];
      };

      setMessageLinks(
        (payload.messages ?? []).filter(
          (message) => message.audioArtifactId || message.audioUrl
        )
      );
    } catch {
      setMessageLinks([]);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Audio users
          </p>
          <h4 className="font-semibold text-slate-900">User Audio Profiles</h4>
          <p className="text-sm text-slate-600">
            Admin-only review of preserved receiver audio, hearing feedback,
            EQ, normalization, and clarity summaries. This is intentionally not
            exposed as a general user-facing recording history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            disabled={loading || loadingArtifacts}
            onClick={loadAudioReview}
            type="button"
          >
            {loading || loadingArtifacts ? "Loading..." : "Refresh audio review"}
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            disabled={loading}
            onClick={loadProfile}
            type="button"
          >
            {loading ? "Loading..." : "Refresh profile"}
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-600">{status}</p>
      <AudioProfileSummary profile={profile} />
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold text-slate-900">Original Audio Artifacts</h4>
            <p className="text-sm text-slate-600">
              Saved recordings, transcript status, source, and message links for
              operational review, migration, and support diagnostics.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              disabled={loadingArtifacts}
              onClick={loadArtifacts}
              type="button"
            >
              {loadingArtifacts ? "Loading..." : "Load artifacts"}
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              onClick={loadAudioMessageLinks}
              type="button"
            >
              Load message links
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              disabled={maintenanceDisabled("retry_pending_transcripts")}
              onClick={retryPendingTranscripts}
              type="button"
            >
              Retry pending transcripts
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              disabled={maintenanceDisabled("recover_upload_index")}
              onClick={recoverAudioUploadIndex}
              type="button"
            >
              Recover upload index
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              disabled={maintenanceDisabled("backfill_integrity")}
              onClick={backfillAudioIntegrity}
              type="button"
            >
              Backfill hashes
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              disabled={loadingArtifacts}
              onClick={loadMaintenancePreview}
              type="button"
            >
              Preview maintenance
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              disabled={maintenanceDisabled("backfill_timeline")}
              onClick={backfillAudioTimeline}
              type="button"
            >
              Backfill timeline
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              disabled={maintenanceDisabled("backfill_event_artifact_links")}
              onClick={backfillAudioEventLinks}
              type="button"
            >
              Backfill event links
            </button>
            <a
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              href={connectAudioManifestEndpoint}
              rel="noreferrer"
              target="_blank"
            >
              Open manifest
            </a>
            <a
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              href={connectAudioReviewBundleEndpoint}
              rel="noreferrer"
              target="_blank"
            >
              Open bundle
            </a>
            <a
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              href={connectAudioReviewBundleDownloadEndpoint}
              rel="noreferrer"
              target="_blank"
            >
              Download bundle
            </a>
            <a
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              href={connectAudioDomainModelEndpoint}
              rel="noreferrer"
              target="_blank"
            >
              Open model
            </a>
            <a
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              href={connectAudioCapabilitiesEndpoint}
              rel="noreferrer"
              target="_blank"
            >
              Open capabilities
            </a>
            <a
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              href={connectAudioReadinessCatalogEndpoint}
              rel="noreferrer"
              target="_blank"
            >
              Open readiness catalog
            </a>
            <a
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              href={connectAudioTimelineEndpoint}
              rel="noreferrer"
              target="_blank"
            >
              Open timeline
            </a>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {artifactStatus || "Artifacts load from the local Connect audio index."}
        </p>
        <AudioMaintenancePreview preview={maintenancePreview} />
        <AudioArtifactSummary review={review} summary={artifactSummary} />
        <AudioMessageLinkSummary messages={messageLinks} />
        <AudioArtifactFilters
          activeFilter={artifactFilter}
          filters={artifactFilters}
          onChange={setArtifactFilter}
        />
        <AudioArtifactDetailPanel
          detail={artifactDetail}
          loading={loadingArtifactDetail}
          onClose={() => {
            setArtifactDetail(null);
            setArtifactDetailStatus("");
            setSelectedArtifactId("");
          }}
          status={artifactDetailStatus}
        />
        <AudioArtifactList
          artifacts={filteredArtifacts}
          emptyMessage={
            artifacts.length
              ? "No audio artifacts match this filter."
              : "No audio artifacts loaded."
          }
          loadingDetailArtifactId={loadingArtifactDetail ? selectedArtifactId : ""}
          onInspectDetail={loadArtifactDetail}
          onRetryTranscript={retryArtifactTranscription}
          profile={profile}
        />
      </div>
    </div>
  );
}

function AudioArtifactSummary({
  review,
  summary,
}: {
  review: ConnectAudioReview | null;
  summary: ReturnType<typeof audioArtifactStats>;
}) {
  if (!summary.total) return null;
  const reviewSummary = review?.summary;
  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        <AudioMetric
          detail={audioReviewReadinessDetail(review?.reviewReadiness)}
          label="Readiness"
          value={readableAudioSource(review?.reviewReadiness?.status || "unknown")}
        />
        <AudioMetric
          detail={`${reviewSummary?.originalsPreserved ?? summary.originalsPreserved}/${reviewSummary?.artifactCount ?? summary.total} originals preserved`}
          label="Artifacts"
          value={String(reviewSummary?.artifactCount ?? summary.total)}
        />
        <AudioMetric
          detail={`${reviewSummary?.needsTranscript ?? summary.needsTranscript} need text`}
          label="Transcripts"
          value={String(reviewSummary?.transcribed ?? summary.transcribed)}
        />
        <AudioMetric
          detail={`${reviewSummary?.read ?? 0} read`}
          label="Delivery"
          value={`${reviewSummary?.heard ?? 0} heard`}
        />
        <AudioMetric
          detail={`${summary.unlinked} unlinked recordings`}
          label="Messages"
          value={`${reviewSummary?.linkedLocalArtifacts ?? summary.linkedMessages} linked`}
        />
        <AudioMetric
          detail={`${reviewSummary?.feedbackEvents ?? summary.feedback} feedback events`}
          label="Enhanced"
          value={`${reviewSummary?.enhancedPlaybacks ?? summary.enhanced} enhanced`}
        />
        <AudioMetric
          detail="matching SHA-256 originals"
          label="Duplicates"
          value={String(reviewSummary?.duplicateArtifacts ?? summary.duplicates)}
        />
        <AudioMetric
          detail={audioStorageHealthDetail(review?.storageHealth)}
          label="Storage"
          value={readableAudioSource(review?.storageHealth?.status || "unknown")}
        />
        <AudioMetric
          detail={audioTranscriptionHealthDetail(review?.transcriptionHealth)}
          label="Transcription"
          value={readableAudioSource(review?.transcriptionHealth?.status || "unknown")}
        />
        <AudioMetric
          detail={audioEventLinkHealthDetail(review?.eventLinkHealth)}
          label="Event links"
          value={readableAudioSource(review?.eventLinkHealth?.status || "unknown")}
        />
        <AudioMetric
          detail={audioCaptureHealthDetail(review?.captureHealth)}
          label="Capture"
          value={readableAudioSource(review?.captureHealth?.status || "unknown")}
        />
        <AudioMetric
          detail={audioTimelineSummaryDetail(review?.timelineSummary)}
          label="Timeline"
          value={`${review?.timelineSummary?.eventCount ?? 0} events`}
        />
        <AudioMetric
          detail={review?.audioDomainModel?.domain || "Refresh audio review"}
          label="Model"
          value={`v${review?.audioDomainModel?.version ?? "?"}`}
        />
        <AudioMetric
          detail={`${formatBytes(summary.totalBytes)} indexed`}
          label="Data source"
          value={`${summary.localArtifacts} local · ${summary.prototypeArtifacts} prototype`}
        />
      </div>
      <AudioReviewReadinessDetails readiness={review?.reviewReadiness} />
    </div>
  );
}

function AudioMaintenancePreview({
  preview,
}: {
  preview: ConnectAudioMaintenancePreview | null;
}) {
  const actions = preview?.actions ?? [];
  if (!actions.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <span
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
          key={action.action || action.label}
        >
          <span className="text-slate-900">{action.label || action.action}</span>{" "}
          {action.count ?? 0}
        </span>
      ))}
    </div>
  );
}

function AudioMessageLinkSummary({
  messages,
}: {
  messages: ConnectAudioMessageLink[];
}) {
  if (!messages.length) return null;

  const heardCount = messages.filter((message) => message.heardAt).length;
  const readCount = messages.filter((message) => message.readAt).length;

  return (
    <section className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Message links
          </p>
          <h5 className="font-semibold text-slate-900">
            {messages.length} messages reference preserved audio
          </h5>
          <p className="text-slate-600">
            {heardCount} heard · {readCount} read
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {messages.slice(0, 6).map((message) => (
          <article
            className="rounded-md border border-slate-100 bg-slate-50 p-2"
            key={message.id || `${message.createdAt}-${message.audioUrl}`}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold text-slate-800">
                {message.from || "Unknown"} to {message.to || "Unknown"}
              </p>
              <p className="text-xs text-slate-500">
                {formatConnectDate(message.createdAt)}
              </p>
            </div>
            <p className="mt-1 text-slate-600">
              {message.transcript || message.body || "Voice message"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {message.audioArtifactId ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                  artifact {shortHash(message.audioArtifactId)}
                </span>
              ) : null}
              {message.audioUrl ? (
                <a
                  className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                  href={connectAudioMediaUrl(message.audioUrl)}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open audio
                </a>
              ) : null}
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                {message.transcriptStatus || "not_requested"}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AudioReviewReadinessDetails({
  readiness,
}: {
  readiness?: ConnectAudioReview["reviewReadiness"];
}) {
  if (!readiness) return null;
  const fallbackItems: NonNullable<ConnectAudioReview["reviewReadiness"]>["items"] = [
    ...(readiness.blockers ?? []).map((code) => ({ code, severity: "blocker" })),
    ...(readiness.maintenance ?? []).map((code) => ({ code, severity: "maintenance" })),
    ...(readiness.notes ?? []).map((code) => ({ code, severity: "note" })),
  ];
  const items = readiness.items?.length
    ? readiness.items
    : fallbackItems;
  const groups = [
    { items: items.filter((item) => item.severity === "blocker"), label: "Blockers", tone: "rose" },
    { items: items.filter((item) => item.severity === "maintenance"), label: "Maintenance", tone: "amber" },
    { items: items.filter((item) => item.severity === "note"), label: "Notes", tone: "slate" },
  ].filter((group) => group.items.length);
  if (!groups.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
      <p className="font-semibold text-slate-900">Readiness Detail</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {groups.flatMap((group) =>
          group.items.map((item) => (
            <span
              className={`rounded-full border px-2 py-1 text-xs font-semibold ${readinessChipClass(group.tone)}`}
              key={`${group.label}-${item.code || item.label}`}
              title={item.description || undefined}
            >
              {group.label}: {item.label || readableAudioSource(item.code)}
            </span>
          ))
        )}
      </div>
      <div className="mt-3 grid gap-2">
        {groups.flatMap((group) =>
          group.items
            .filter((item) => item.description)
            .map((item) => (
              <div
                className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                key={`${group.label}-detail-${item.code || item.label}`}
              >
                <p className="font-semibold text-slate-800">
                  {item.label || readableAudioSource(item.code)}
                </p>
                <p className="mt-1 text-xs text-slate-600">{item.description}</p>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

function audioStorageHealthDetail(health?: ConnectAudioReview["storageHealth"]) {
  if (!health) return "Refresh audio review";
  return [
    `${health.missingOriginals ?? 0} missing`,
    `${health.unhashedArtifacts ?? 0} unhashed`,
    `${health.recoverableUploads ?? 0} recoverable`,
    health.totalBytes ? formatBytes(health.totalBytes) : "",
  ].filter(Boolean).join(" · ");
}

function audioReviewReadinessDetail(
  readiness?: ConnectAudioReview["reviewReadiness"]
) {
  if (!readiness) return "Refresh audio review";
  return [
    readiness.blockers?.length ? `${readiness.blockers.length} blockers` : "",
    readiness.maintenance?.length ? `${readiness.maintenance.length} maintenance` : "",
    readiness.notes?.length ? `${readiness.notes.length} notes` : "",
  ].filter(Boolean).join(" · ") || "No issues found";
}

function readinessChipClass(tone: string) {
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-800";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function audioTranscriptionHealthDetail(
  health?: ConnectAudioReview["transcriptionHealth"]
) {
  if (!health) return "Refresh audio review";
  return [
    `${health.transcribed ?? 0}/${health.artifactCount ?? 0} transcribed`,
    `${health.retryable ?? 0} retryable`,
    health.transcriptionConfigured
      ? health.transcriptionModel || "configured"
      : "not configured",
  ].join(" · ");
}

function audioEventLinkHealthDetail(
  health?: ConnectAudioReview["eventLinkHealth"]
) {
  if (!health) return "Refresh audio review";
  return [
    `${health.linkedCount ?? 0}/${health.eventCount ?? 0} linked`,
    `${health.resolvableUnlinkedCount ?? 0} backfillable`,
    `${health.unresolvedCount ?? 0} unresolved`,
  ].join(" · ");
}

function audioCaptureHealthDetail(health?: ConnectAudioReview["captureHealth"]) {
  if (!health) return "Refresh audio review";
  return [
    `${health.withCaptureContext ?? 0}/${health.artifactCount ?? 0} contextual`,
    `${health.missingCaptureContext ?? 0} legacy`,
  ].join(" · ");
}

function audioTimelineSummaryDetail(summary?: ConnectAudioReview["timelineSummary"]) {
  if (!summary) return "Refresh audio review";
  const lastArtifact = summary.lastArtifactAt
    ? `last artifact ${new Date(summary.lastArtifactAt).toLocaleString([], {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
      })}`
    : "";
  return [
    summary.latestEventType ? readableAudioSource(summary.latestEventType) : "",
    lastArtifact,
  ].filter(Boolean).join(" · ") || "No timeline events yet";
}

function AudioArtifactFilters({
  activeFilter,
  filters,
  onChange,
}: {
  activeFilter: AudioArtifactFilter;
  filters: Array<{ count: number; id: AudioArtifactFilter; label: string }>;
  onChange: (filter: AudioArtifactFilter) => void;
}) {
  if (!filters.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {filters.map((filter) => (
        <button
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            activeFilter === filter.id
              ? "border-blue-300 bg-blue-50 text-blue-900"
              : "border-slate-200 bg-white text-slate-600"
          }`}
          key={filter.id}
          onClick={() => onChange(filter.id)}
          type="button"
        >
          {filter.label}
          <span className="ml-1 opacity-70">{filter.count}</span>
        </button>
      ))}
    </div>
  );
}

function AudioArtifactList({
  artifacts,
  emptyMessage,
  loadingDetailArtifactId,
  onInspectDetail,
  onRetryTranscript,
  profile,
}: {
  artifacts: ConnectAudioArtifact[];
  emptyMessage: string;
  loadingDetailArtifactId: string;
  onInspectDetail: (artifactId?: string) => void;
  onRetryTranscript: (artifactId?: string) => void;
  profile: ConnectAudioProfile | null;
}) {
  if (!artifacts.length) {
    return (
      <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {artifacts.map((artifact) => {
        const related = relatedAudioActivity(artifact, profile);
        const artifactId = artifact.id || artifact.artifactId || "";
        const isLoadingDetail = Boolean(
          artifactId && loadingDetailArtifactId === artifactId
        );
        return (
          <article
            className="rounded-md border border-slate-200 bg-white p-3 text-sm"
            key={artifact.id || artifact.audioUrl}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {readableAudioKind(artifact)}
                </p>
                <p className="text-slate-600">
                  {artifact.createdAt || "No timestamp"}
                  {artifact.audioDurationMs ? ` · ${formatDuration(artifact.audioDurationMs)}` : ""}
                  {artifact.audioMimeType ? ` · ${artifact.audioMimeType}` : ""}
                  {artifact.audioByteSize ? ` · ${formatBytes(artifact.audioByteSize)}` : ""}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                {artifact.transcriptStatus || "not_requested"}
              </span>
            </div>
            <p className="mt-2 text-slate-600">
              {readableAudioDirection(artifact)}
              {readableAudioCapture(artifact) ? ` · ${readableAudioCapture(artifact)}` : ""}
              {artifact.source ? ` · source ${readableAudioSource(artifact.source)}` : ""}
              {artifact.relatedMessage?.id
                ? ` · message ${artifact.relatedMessage.id}`
                : artifact.messageId
                  ? ` · message ${artifact.messageId}`
                  : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                {audioOriginalPreservationLabel(artifact)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                {audioArtifactDeliveryLabel(artifact)}
              </span>
              {artifact.audioSha256 ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                  sha {shortHash(artifact.audioSha256)}
                </span>
              ) : null}
              {artifact.duplicateInfo ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                  {artifact.duplicateInfo.duplicateCount} duplicates
                </span>
              ) : null}
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                {related.enhancements} enhanced playbacks
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
                {related.feedback} hearing feedback
              </span>
              {artifactId ? (
                <button
                  className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                  disabled={isLoadingDetail}
                  onClick={() => onInspectDetail(artifactId)}
                  type="button"
                >
                  {isLoadingDetail ? "Loading details" : "View details"}
                </button>
              ) : null}
            </div>
            {canRetryArtifactTranscription(artifact) ? (
              <button
                className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                onClick={() => onRetryTranscript(artifact.id)}
                type="button"
              >
                Retry transcript
              </button>
            ) : null}
            {artifact.transcript ? (
              <p className="mt-2 rounded-md bg-slate-50 p-2 text-slate-700">
                {artifact.transcript}
              </p>
            ) : null}
            {artifact.audioUrl ? (
              <div className="mt-2 space-y-2">
                <audio
                  className="w-full"
                  controls
                  src={connectAudioMediaUrl(artifact.audioUrl)}
                />
                <a
                  className="inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900"
                  href={connectAudioMediaUrl(artifact.audioUrl)}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open original audio
                </a>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function AudioArtifactDetailPanel({
  detail,
  loading,
  onClose,
  status,
}: {
  detail: ConnectAudioArtifactDetail | null;
  loading: boolean;
  onClose: () => void;
  status: string;
}) {
  if (!detail && !status && !loading) return null;

  const artifact = detail?.artifact;
  const storage = detail?.storage;
  const auditTrail = detail?.auditTrail ?? [];
  const relatedMessage = detail?.relatedMessage ?? artifact?.relatedMessage ?? null;

  return (
    <section className="mt-4 rounded-md border border-blue-100 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Artifact Detail
          </p>
          <h5 className="font-semibold text-slate-900">
            {artifact ? readableAudioKind(artifact) : "Audio artifact"}
          </h5>
          <p className="text-slate-600">
            {status || "Read-only audio artifact inspection."}
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-slate-600">Loading detail...</p>
      ) : null}

      {artifact ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <AudioDetailBlock
            rows={[
              ["Kind", readableAudioKind(artifact)],
              ["Direction", readableAudioDirection(artifact)],
              ["Source", readableAudioSource(artifact.source)],
              ["Transcript", artifact.transcriptStatus ?? "not_requested"],
              ["Message", relatedMessage?.id || artifact.messageId || "None linked"],
            ]}
            title="Classification"
          />
          <AudioDetailBlock
            rows={[
              ["Original", storage?.exists ? "File present" : "Missing or not checked"],
              ["Integrity", storage?.integrityMatches ? "Hash matches" : "Not matched"],
              ["Indexed size", formatBytes(storage?.indexedByteSize ?? artifact.audioByteSize ?? 0)],
              ["Current size", formatBytes(storage?.currentByteSize ?? 0)],
              ["SHA", shortHash(storage?.indexedSha256 ?? artifact.audioSha256 ?? "") || "None"],
            ]}
            title="Storage"
          />
          <AudioDetailBlock
            rows={[
              ["Surface", readableAudioSource(artifact.captureContext?.captureSurface)],
              ["Role", artifact.captureContext?.captureRole || "Not recorded"],
              ["Platform", artifact.captureContext?.clientPlatform || "Not recorded"],
              ["Time zone", artifact.captureContext?.clientTimeZone || "Not recorded"],
            ]}
            title="Capture"
          />
        </div>
      ) : null}

      {relatedMessage ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Linked Message
              </p>
              <h6 className="font-semibold text-slate-900">
                {relatedMessage.from || "Unknown"} to {relatedMessage.to || "Unknown"}
              </h6>
              <p className="text-xs text-slate-500">
                {formatConnectDate(relatedMessage.createdAt)}
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
              {audioMessageDeliveryLabel(relatedMessage)}
            </span>
          </div>
          <p className="mt-2 text-slate-700">
            {relatedMessage.transcript || relatedMessage.body || "Voice message"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {relatedMessage.audioArtifactId ? (
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                artifact {shortHash(relatedMessage.audioArtifactId)}
              </span>
            ) : null}
            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
              {relatedMessage.transcriptStatus || "not_requested"}
            </span>
            {relatedMessage.audioUrl ? (
              <a
                className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                href={connectAudioMediaUrl(relatedMessage.audioUrl)}
                rel="noreferrer"
                target="_blank"
              >
                Open linked audio
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {artifact?.transcript ? (
        <p className="mt-3 rounded-md bg-slate-50 p-3 text-slate-700">
          {artifact.transcript}
        </p>
      ) : null}

      {artifact?.audioUrl ? (
        <div className="mt-3 space-y-2">
          <audio
            className="w-full"
            controls
            src={connectAudioMediaUrl(artifact.audioUrl)}
          />
          <a
            className="inline-flex text-sm font-semibold text-blue-700 hover:text-blue-900"
            href={connectAudioMediaUrl(artifact.audioUrl)}
            rel="noreferrer"
            target="_blank"
          >
            Open original audio
          </a>
        </div>
      ) : null}

      {auditTrail.length ? (
        <div className="mt-4">
          <h6 className="font-semibold text-slate-900">Audit Trail</h6>
          <div className="mt-2 space-y-2">
            {auditTrail.slice(0, 12).map((event, index) => (
              <article
                className="rounded-md border border-slate-100 bg-slate-50 p-2"
                key={`${event.type}-${event.createdAt}-${index}`}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-semibold text-slate-800">
                    {readableAudioSource(event.type)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatConnectDate(event.createdAt)}
                  </p>
                </div>
                <p className="mt-1 text-slate-600">{event.summary}</p>
                {event.detail ? (
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {audioEventDetailSummary(event.detail)}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AudioDetailBlock({
  rows,
  title,
}: {
  rows: Array<[string, string]>;
  title: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <h6 className="font-semibold text-slate-900">{title}</h6>
      <dl className="mt-2 space-y-1">
        {rows.map(([label, value]) => (
          <div className="flex justify-between gap-3" key={label}>
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AudioProfileSummary({ profile }: { profile: ConnectAudioProfile | null }) {
  const summary = profile?.summary;
  const average = summary?.averageProfile ?? {};

  if (!summary?.total && !summary?.enhancementEvents) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        No audio profile yet. Enhanced playback and receiver feedback will
        appear here.
      </div>
    );
  }

  const events = profile?.events ?? [];
  const enhancementEvents = profile?.enhancementEvents ?? [];
  const reasons = Array.from(
    new Set(
      [...events, ...enhancementEvents].flatMap(
        (event) => event.audioEnhancementProfile?.reasons ?? []
      )
    )
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <AudioMetric
          detail={
            summary.helpedRate === null || summary.helpedRate === undefined
              ? "No rate yet"
              : `${Math.round(summary.helpedRate * 100)}% helpful`
          }
          label="Feedback"
          value={`${summary.helped ?? 0}/${summary.total ?? 0} helped`}
        />
        <AudioMetric
          detail={`${summary.playbackEnded ?? 0} finished · ${summary.playbackErrors ?? 0} errors · ${summary.playbackFallbacks ?? 0} fallbacks`}
          label="Playback"
          value={`${summary.playbackStarted ?? summary.enhancementEvents ?? 0} started`}
        />
        <AudioMetric
          detail="average requested gain"
          label="Gain"
          value={formatAudioValue(average.playbackGain, "x")}
        />
        <AudioMetric
          detail={`${formatAudioDb(average.lowMidGainDb)} low-mid · ${formatAudioDb(
            average.presenceGainDb
          )} presence`}
          label="EQ"
          value={`${formatAudioValue(average.highPassHz, " Hz")} high-pass`}
        />
        <AudioMetric
          detail={
            average.compressorThresholdDb
              ? `${average.compressorThresholdDb} dB threshold`
              : "conservative"
          }
          label="Dynamics"
          value={
            average.compressorRatio
              ? `${average.compressorRatio}:1 compression`
              : "light limiter"
          }
        />
      </div>

      {reasons.length ? (
        <p className="text-sm text-slate-600">
          Common signals: {reasons.map(formatAudioReason).join(", ")}
        </p>
      ) : null}

      <AudioLearningSummary summary={summary.learningSummary} />

      <AudioProfileSourceSummaries summaries={summary.sourceSummaries ?? []} />

      <details className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer font-semibold text-slate-900">
          Detail view
        </summary>
        <div className="mt-3 space-y-3">
          {events.map((event, index) => {
            const eventProfile = event.audioEnhancementProfile ?? {};
            return (
              <article
                className="rounded-md border border-slate-200 bg-white p-3 text-sm"
                key={`${event.createdAt ?? "event"}-${index}`}
              >
                <p className="font-semibold text-slate-900">
                  {event.improved ? "Sounded better" : "Did not help"} ·{" "}
                  {event.messageFrom || "Unknown speaker"}
                </p>
                <p className="text-slate-600">{event.createdAt || "No timestamp"}</p>
                <p className="mt-1 text-slate-600">
                  {formatAudioValue(eventProfile.highPassHz, " Hz")} high-pass ·{" "}
                  {formatAudioDb(eventProfile.lowMidGainDb)} low-mid ·{" "}
                  {formatAudioDb(eventProfile.presenceGainDb)} presence · gain{" "}
                  {formatAudioValue(eventProfile.gainMultiplier, "x")}
                </p>
                <p className="mt-1 text-slate-600">
                  {formatAudioProfileName(eventProfile.profileId)} · speed{" "}
                  {formatAudioValue(eventProfile.playbackRate, "x")} ·{" "}
                  {formatAudioAdjustmentSummary(eventProfile.adjustments)}
                </p>
                <AudioProfileEventArtifactLink event={event} />
              </article>
            );
          })}
          {enhancementEvents.map((event, index) => {
            const eventProfile = event.audioEnhancementProfile ?? {};
            return (
              <article
                className="rounded-md border border-slate-200 bg-white p-3 text-sm"
                key={`${event.createdAt ?? "enhancement"}-${index}`}
              >
                <p className="font-semibold text-slate-900">
                  {audioProfileEventTitle(event)} · {event.surface || event.source || "unknown"}
                </p>
                <p className="text-slate-600">{event.createdAt || "No timestamp"}</p>
                <p className="mt-1 text-slate-600">
                  {formatAudioValue(eventProfile.highPassHz, " Hz")} high-pass ·{" "}
                  {formatAudioDb(eventProfile.lowMidGainDb)} low-mid ·{" "}
                  {formatAudioDb(eventProfile.presenceGainDb)} presence · gain{" "}
                  {formatAudioValue(eventProfile.gainMultiplier, "x")}
                </p>
                <p className="mt-1 text-slate-600">
                  {formatAudioProfileName(eventProfile.profileId)} · speed{" "}
                  {formatAudioValue(eventProfile.playbackRate, "x")} ·{" "}
                  {formatAudioAdjustmentSummary(eventProfile.adjustments)}
                </p>
                <AudioProfileEventArtifactLink event={event} />
              </article>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function AudioProfileEventArtifactLink({
  event,
}: {
  event: ConnectAudioProfileEvent;
}) {
  if (!event.artifactId) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
        {readableAudioSource(event.artifactKind || "audio artifact")}
      </span>
      {event.audioDirection ? (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
          {readableAudioSource(event.audioDirection)}
        </span>
      ) : null}
      <a
        className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
        href={audioArtifactDetailEndpoint(event.artifactId)}
        rel="noreferrer"
        target="_blank"
      >
        Open artifact detail
      </a>
    </div>
  );
}

function AudioLearningSummary({
  summary,
}: {
  summary: NonNullable<ConnectAudioProfile["summary"]>["learningSummary"];
}) {
  if (!summary?.total) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        No receiver comparison choices yet.
      </div>
    );
  }

  const counts = summary.preferenceCounts ?? {};
  const adjustmentRows = [
    ["Speed", topAudioAdjustment(summary.adjustments?.speed)],
    ["Timbre", topAudioAdjustment(summary.adjustments?.timbre)],
    ["Bass", topAudioAdjustment(summary.adjustments?.bassReduction)],
    ["Compression", topAudioAdjustment(summary.adjustments?.compression)],
  ];

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="text-sm font-semibold text-slate-900">Receiver learning</h5>
          <p className="mt-1 text-sm text-slate-600">
            Blind comparison choices from the receiver message flow.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Default: {formatAudioLearningChoice(summary.preferredChoice)}
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <AudioMetric detail="unmodified audio" label="Original" value={String(counts.original ?? 0)} />
        <AudioMetric detail="bright clarity" label="Option 1" value={String(counts.version1 ?? 0)} />
        <AudioMetric detail="slower steady" label="Option 2" value={String(counts.version2 ?? 0)} />
        <AudioMetric detail="no clear winner" label="Same" value={String(counts.same ?? 0)} />
      </div>
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-4">
        {adjustmentRows.map(([label, value]) => (
          <div className="rounded-md bg-slate-50 p-3" key={label}>
            <dt className="text-slate-500">{label}</dt>
            <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function topAudioAdjustment(values?: Record<string, number>) {
  const entries = Object.entries(values ?? {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "Not enough data";
  return `${formatAudioReason(entries[0][0])} (${entries[0][1]})`;
}

function formatAudioLearningChoice(choice?: string) {
  switch (choice) {
    case "original":
      return "Original";
    case "version_1":
      return "Option 1";
    case "version_2":
      return "Option 2";
    case "same":
      return "No clear winner";
    default:
      return "Learning";
  }
}

function formatAudioProfileName(profileId?: string) {
  switch (profileId) {
    case "bright_speech_clarity":
      return "Bright clarity";
    case "steady_slow_speech":
      return "Slower steady";
    case "standard":
      return "Original";
    default:
      return "Profile pending";
  }
}

function formatAudioAdjustmentSummary(
  adjustments?: NonNullable<ConnectAudioProfileEvent["audioEnhancementProfile"]>["adjustments"]
) {
  if (!adjustments) return "no adjustment detail";
  return [
    adjustments.speed ? `speed ${formatAudioReason(adjustments.speed)}` : "",
    adjustments.timbre ? `timbre ${formatAudioReason(adjustments.timbre)}` : "",
    adjustments.bassReduction ? `bass ${formatAudioReason(adjustments.bassReduction)}` : "",
    adjustments.compression ? `compression ${formatAudioReason(adjustments.compression)}` : "",
  ]
    .filter(Boolean)
    .join(" · ") || "no adjustment detail";
}

function AudioProfileSourceSummaries({
  summaries,
}: {
  summaries: NonNullable<ConnectAudioProfile["summary"]>["sourceSummaries"];
}) {
  if (!summaries?.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {summaries.slice(0, 4).map((summary) => (
        <article
          className="rounded-md border border-slate-200 bg-white p-3 text-sm"
          key={summary.key || summary.label}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">
                {summary.label || "Audio source"}
              </p>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {readableAudioSource(summary.sourceType)}
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">
              {(summary.feedbackEvents ?? 0) + (summary.enhancementEvents ?? 0)} events
            </span>
          </div>
          <p className="mt-2 text-slate-600">
            {summary.feedbackEvents ?? 0} feedback · {summary.enhancementEvents ?? 0} playbacks
            {summary.helpedRate === null || summary.helpedRate === undefined
              ? ""
              : ` · ${Math.round(summary.helpedRate * 100)}% helpful`}
          </p>
          {summary.commonReasons?.length ? (
            <p className="mt-1 text-slate-600">
              {summary.commonReasons
                .map((reason) => `${formatAudioReason(reason.reason || "")} (${reason.count ?? 0})`)
                .join(", ")}
            </p>
          ) : null}
          {summary.artifactIds?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {summary.artifactIds.slice(0, 3).map((artifactId) => (
                <a
                  className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:text-blue-900"
                  href={audioArtifactDetailEndpoint(artifactId)}
                  key={artifactId}
                  rel="noreferrer"
                  target="_blank"
                >
                  Artifact detail
                </a>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ConnectProvisioningArea({
  onNavigateRecord,
  pendingSearchText,
}: {
  onNavigateRecord: ConnectRecordNavigation;
  pendingSearchText: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h4 className="font-semibold text-slate-900">Provisioning Operations</h4>
        <p className="text-sm text-slate-600">
          Setup links, activation, identity-link review, and provisioning events
          for the Connect platform. Users, households, and devices are separated
          into their own Connect Admin areas.
        </p>
      </div>
      <ConnectPlatformRecordsPanel
        focus="overview"
        onNavigateRecord={onNavigateRecord}
        pendingSearchText={pendingSearchText}
      />
      <ConnectAppearancePanel />
    </div>
  );
}

function ConnectUsersArea({
  onNavigateRecord,
  pendingSearchText,
}: {
  onNavigateRecord: ConnectRecordNavigation;
  pendingSearchText: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h4 className="font-semibold text-slate-900">Connect Users</h4>
        <p className="text-sm text-slate-600">
          Connect participant lifecycle, active/inactive state, and CP Pers
          identity-link hints. For this pass, active Connect participants should
          reference existing CarePland people.
        </p>
      </div>
      <ConnectPlatformRecordsPanel
        focus="users"
        onNavigateRecord={onNavigateRecord}
        pendingSearchText={pendingSearchText}
      />
    </div>
  );
}

function ConnectHouseholdsArea({
  onNavigateRecord,
  pendingSearchText,
}: {
  onNavigateRecord: ConnectRecordNavigation;
  pendingSearchText: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h4 className="font-semibold text-slate-900">Connect Households</h4>
        <p className="text-sm text-slate-600">
          Household records, membership, active/inactive state, and plan-aware
          identity context for Connect receiver deployments.
        </p>
      </div>
      <ConnectPlatformRecordsPanel
        focus="households"
        onNavigateRecord={onNavigateRecord}
        pendingSearchText={pendingSearchText}
      />
    </div>
  );
}

function ConnectDevicesArea({
  onNavigateRecord,
  pendingSearchText,
}: {
  onNavigateRecord: ConnectRecordNavigation;
  pendingSearchText: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h4 className="font-semibold text-slate-900">Connect Devices</h4>
        <p className="text-sm text-slate-600">
          Receiver devices, household assignment, setup state, activity signals,
          and provisioning health from an Admin operations view.
        </p>
      </div>
      <ConnectPlatformRecordsPanel
        focus="devices"
        onNavigateRecord={onNavigateRecord}
        pendingSearchText={pendingSearchText}
      />
    </div>
  );
}

function ConnectPlatformRecordsPanel({
  focus,
  onNavigateRecord,
  pendingSearchText,
}: {
  focus: ConnectRecordsFocus;
  onNavigateRecord: ConnectRecordNavigation;
  pendingSearchText: string;
}) {
  const [snapshot, setSnapshot] = useState<ConnectProvisioningSnapshot | null>(
    () => connectProvisioningSnapshotCache?.snapshot ?? null
  );
  const [status, setStatus] = useState(() =>
    connectProvisioningSnapshotCache
      ? "Loaded from cached Connect provisioning state."
      : "Load local Connect provisioning state to review Connect platform records."
  );
  const [loadState, setLoadState] = useState<ConnectProvisioningLoadState>(
    () => (connectProvisioningSnapshotCache ? "ready" : "idle")
  );
  const [lastLoadedAt, setLastLoadedAt] = useState(
    () => connectProvisioningSnapshotCache?.lastLoadedAt ?? ""
  );
  const [cacheCheckedAt, setCacheCheckedAt] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [lifecycleFilter, setLifecycleFilter] =
    useState<ConnectLifecycleFilter>("all");
  const [focusedSearchText, setFocusedSearchText] = useState("");
  const [activeDraftIds, setActiveDraftIds] = useState<Set<string>>(
    () => new Set()
  );
  const [draftResetVersion, setDraftResetVersion] = useState(0);
  const [reviewedQueueKeys, setReviewedQueueKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");

  const setDraftActive = useCallback((draftId: string, active: boolean) => {
    setActiveDraftIds((currentDraftIds) => {
      const nextDraftIds = new Set(currentDraftIds);
      if (active) {
        nextDraftIds.add(draftId);
      } else {
        nextDraftIds.delete(draftId);
      }
      return nextDraftIds;
    });
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLifecycleFilter("all");
      setFocusedSearchText("");
      setReviewedQueueKeys(new Set());
      setSearchQuery("");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [focus]);

  useEffect(() => {
    if (!pendingSearchText) return;
    const timeoutId = window.setTimeout(() => {
      setLifecycleFilter("all");
      setFocusedSearchText(pendingSearchText);
      setSearchQuery(pendingSearchText);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [pendingSearchText]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCacheCheckedAt(new Date());
    }, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const loadProvisioning = useCallback(async () => {
    setLoading(true);
    setLoadState("loading");
    setStatus("Loading Connect platform records...");
    try {
      const payload = await fetchConnectProvisioningSnapshot({
        includeInactiveHouseholds: true,
        includeInactivePeople: true,
      });
      const loadedDate = new Date();
      const loadedAt = loadedDate.toISOString();
      connectProvisioningSnapshotCache = {
        lastLoadedAt: loadedAt,
        snapshot: payload,
      };
      setSnapshot(payload);
      setLoadState("ready");
      setCacheCheckedAt(loadedDate);
      setLastLoadedAt(loadedAt);
      setStatus("Loaded from local Connect provisioning state.");
    } catch (error) {
      setSnapshot(null);
      setLoadState("error");
      setStatus(
        error instanceof Error
          ? error.message
          : "Connect provisioning state unavailable."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connectProvisioningSnapshotCache) {
      const timeoutId = window.setTimeout(() => {
        if (!connectProvisioningSnapshotCache) return;
        setSnapshot(connectProvisioningSnapshotCache.snapshot);
        setLastLoadedAt(connectProvisioningSnapshotCache.lastLoadedAt);
        setCacheCheckedAt(new Date());
        setLoadState("ready");
        setStatus("Loaded from cached Connect provisioning state.");
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    const timeoutId = window.setTimeout(() => {
      void loadProvisioning();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [focus, loadProvisioning]);

  const households = snapshot?.receiverHouseholds ?? [];
  const devices = snapshot?.receiverDevices ?? [];
  const setupTokens = snapshot?.setupTokens ?? [];
  const auditEvents = snapshot?.auditEvents ?? [];
  const totals = snapshot?.summary?.totals;
  const activeHouseholds = households.filter((household) => household.active !== false);
  const inactiveHouseholds = households.filter((household) => household.active === false);
  const sortedHouseholds = sortConnectLifecycleRecords(households);
  const people = sortedHouseholds.flatMap((household) =>
    (household.receiverPeople ?? []).map((person) => ({
      ...person,
      householdName: household.displayName,
    }))
  );
  const sortedPeople = sortConnectLifecycleRecords(people);
  const sortedDevices = sortConnectLifecycleRecords(devices);
  const sortedSetupTokens = sortConnectSetupTokens(setupTokens);
  const normalizedSearch = normalizeConnectSearch(searchQuery);
  const visiblePeople = sortedPeople.filter(
    (person) =>
      matchesConnectSearch(person, normalizedSearch) &&
      matchesConnectLifecycleFilter(person, lifecycleFilter)
  );
  const visibleHouseholds = sortedHouseholds.filter(
    (household) =>
      matchesConnectSearch(household, normalizedSearch) &&
      matchesConnectLifecycleFilter(household, lifecycleFilter)
  );
  const visibleDevices = sortedDevices.filter(
    (device) =>
      matchesConnectSearch(device, normalizedSearch) &&
      matchesConnectLifecycleFilter(device, lifecycleFilter)
  );
  const visibleSetupTokens = sortedSetupTokens.filter(
    (setupToken) =>
      matchesConnectSearch(setupToken, normalizedSearch) &&
      (lifecycleFilter === "all" ||
        (lifecycleFilter === "active" && isConnectSetupTokenActive(setupToken)) ||
        (lifecycleFilter === "inactive" && !isConnectSetupTokenActive(setupToken)))
  );
  const visibleAuditEvents = auditEvents.filter((event) =>
    matchesConnectSearch(event, normalizedSearch)
  );
  const activeSortedPeople = visiblePeople.filter((person) =>
    isConnectRecordActive(person)
  );
  const inactiveSortedPeople = visiblePeople.filter(
    (person) => !isConnectRecordActive(person)
  );
  const activeSortedHouseholds = visibleHouseholds.filter((household) =>
    isConnectRecordActive(household)
  );
  const inactiveSortedHouseholds = visibleHouseholds.filter(
    (household) => !isConnectRecordActive(household)
  );
  const activeSortedDevices = visibleDevices.filter((device) =>
    isConnectRecordActive(device)
  );
  const inactiveSortedDevices = visibleDevices.filter(
    (device) => !isConnectRecordActive(device)
  );
  const activePeople = people.filter((person) => person.active !== false);
  const inactivePeople = people.filter((person) => person.active === false);
  const activeDevices = devices.filter((device) => isConnectRecordActive(device));
  const unassignedDevices = devices.filter((device) => !device.receiverHouseholdId);
  const pendingSetupTokens = setupTokens.filter((token) => token.status === "active");
  const cacheAgeMs = lastLoadedAt
    ? cacheCheckedAt.getTime() - new Date(lastLoadedAt).getTime()
    : 0;
  const cacheIsStale = cacheAgeMs > connectProvisioningCacheFreshMs;
  const filterResultCount = countVisibleConnectRecords({
    auditEvents: visibleAuditEvents,
    devices: visibleDevices,
    focus,
    households: visibleHouseholds,
    people: visiblePeople,
    setupTokens: visibleSetupTokens,
  });
  const filterTotalCount = countVisibleConnectRecords({
    auditEvents,
    devices,
    focus,
    households,
    people,
    setupTokens,
  });
  const filtersActive = Boolean(searchQuery.trim()) || lifecycleFilter !== "all";
  const reviewQueueItems = buildConnectReviewQueue({
    devices: visibleDevices,
    focus,
    households: visibleHouseholds,
    people: visiblePeople,
    setupTokens: visibleSetupTokens,
  });

  const panelCopy = {
    devices: {
      description:
        "Device assignment, activation, setup links, and presence signals for Connect receiver hardware.",
      eyebrow: "Connect devices",
      title: "Device Registry",
    },
    households: {
      description:
        "Household records, receiver membership, lifecycle state, and plan-aware identity context.",
      eyebrow: "Connect households",
      title: "Household Registry",
    },
    overview: {
      description:
        "Setup links, identity boundaries, provisioning events, and a compact summary of Connect platform records.",
      eyebrow: "Connect provisioning",
      title: "Provisioning Overview",
    },
    users: {
      description:
        "Connect participants by household, lifecycle state, and CP Pers identity-link status.",
      eyebrow: "Connect users",
      title: "User Registry",
    },
  } satisfies Record<ConnectRecordsFocus, { description: string; eyebrow: string; title: string }>;
  const copy = panelCopy[focus];

  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {copy.eyebrow}
          </p>
          <h4 className="font-semibold text-slate-900">{copy.title}</h4>
          <p className="text-sm text-slate-600">
            {copy.description} Cross-product user administration can be promoted
            later when the account relationships are settled.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          disabled={loading}
          onClick={loadProvisioning}
          type="button"
        >
          {loading ? "Loading..." : "Refresh Connect records"}
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <AudioMetric
          detail={`${inactiveHouseholds.length} inactive`}
          label="Households"
          value={String(activeHouseholds.length + inactiveHouseholds.length)}
        />
        <AudioMetric
          detail={`${inactivePeople.length} inactive`}
          label="Receiver users"
          value={String(activePeople.length + inactivePeople.length)}
        />
        <AudioMetric
          detail={`${pendingSetupTokens.length} active setup links`}
          label="Setup tokens"
          value={String(setupTokens.length)}
        />
        <AudioMetric
          detail={`${auditEvents.length} recent provisioning events`}
          label="Events"
          value={String(auditEvents.length)}
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <AudioMetric
          detail={`${unassignedDevices.length} unassigned`}
          label="Devices"
          value={String(totals?.receiverDevices ?? devices.length)}
        />
        <AudioMetric
          detail="not revoked or inactive"
          label="Active devices"
          value={String(totals?.activeReceiverDevices ?? activeDevices.length)}
        />
      </div>

      <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
        <strong className="block">Identity boundary</strong>
        <span className="mt-1 block">
          CP Pers links are shown when a Connect participant is linked to a Care
          VIP. Early Access currently allows both Personal and Connect access;
          other tier rules for Connect are not determined yet. Unlinked
          prototype records are review items, not a separate Connect person
          model for this pass.
        </span>
      </div>

      <ConnectProvisioningStatusBanner
        cacheAgeMs={cacheAgeMs}
        cacheIsStale={cacheIsStale}
        lastLoadedAt={lastLoadedAt}
        loadState={loadState}
        onRetry={loadProvisioning}
        status={status}
      />

      <ConnectActionDraftContext.Provider
        value={{ draftResetVersion, setDraftActive }}
      >
        <ConnectLocalDraftBanner
          draftCount={activeDraftIds.size}
          onClearDrafts={() => {
            setActiveDraftIds(new Set());
            setDraftResetVersion((version) => version + 1);
          }}
        />

      <ConnectOperationsChecklist
        cacheIsStale={cacheIsStale}
        draftCount={activeDraftIds.size}
        filtersActive={filtersActive}
        focus={focus}
        onClearReviewed={() => setReviewedQueueKeys(new Set())}
        onMarkReviewed={(itemsToMark) => {
          const nextKeys = new Set(reviewedQueueKeys);
          for (const item of itemsToMark) {
            nextKeys.add(connectReviewQueueItemKey(item));
          }
          setReviewedQueueKeys(nextKeys);
        }}
        reviewedKeys={reviewedQueueKeys}
        resultCount={filterResultCount}
        reviewItems={reviewQueueItems}
        totalCount={filterTotalCount}
      />

      <ConnectRecordFilters
        filtersActive={filtersActive}
        lifecycleFilter={lifecycleFilter}
        onClearFocusedSearch={() => {
          setFocusedSearchText("");
          setSearchQuery("");
        }}
        onResetFilters={() => {
          setFocusedSearchText("");
          setSearchQuery("");
          setLifecycleFilter("all");
        }}
        resultCount={filterResultCount}
        focusedSearchText={focusedSearchText}
        searchQuery={searchQuery}
        setLifecycleFilter={setLifecycleFilter}
        setSearchQuery={(value) => {
          setFocusedSearchText("");
          setSearchQuery(value);
        }}
        totalCount={filterTotalCount}
      />

      <ConnectReviewQueue
        items={reviewQueueItems}
        onFocusItem={(item) => {
          setFocusedSearchText(item.searchText);
          setSearchQuery(item.searchText);
          setLifecycleFilter("all");
        }}
        reviewedKeys={reviewedQueueKeys}
        setReviewedKeys={setReviewedQueueKeys}
      />

      {focus === "users" ? (
        <ConnectUsersRegistry
          activePeople={activeSortedPeople}
          filtersActive={filtersActive}
          inactivePeople={inactiveSortedPeople}
          onNavigateRecord={onNavigateRecord}
        />
      ) : null}

      {focus === "devices" ? (
        <ConnectDevicesRegistry
          activeDevices={activeSortedDevices}
          filtersActive={filtersActive}
          households={households}
          inactiveDevices={inactiveSortedDevices}
          onNavigateRecord={onNavigateRecord}
        />
      ) : null}

      {focus === "overview" ? (
        <ConnectProvisioningOverviewRecords
          auditEvents={visibleAuditEvents}
          devices={devices}
          filtersActive={filtersActive}
          households={households}
          onNavigateRecord={onNavigateRecord}
          setupTokens={visibleSetupTokens}
        />
      ) : null}

      {focus === "households" ? (
        <ConnectHouseholdsRegistry
          activeHouseholds={activeSortedHouseholds}
          devices={devices}
          filtersActive={filtersActive}
          inactiveHouseholds={inactiveSortedHouseholds}
          onNavigateRecord={onNavigateRecord}
        />
      ) : null}
      </ConnectActionDraftContext.Provider>
    </section>
  );
}

function ConnectUsersRegistry({
  activePeople,
  filtersActive,
  inactivePeople,
  onNavigateRecord,
}: {
  activePeople: Array<ConnectReceiverPerson & { householdName?: string }>;
  filtersActive: boolean;
  inactivePeople: Array<ConnectReceiverPerson & { householdName?: string }>;
  onNavigateRecord: ConnectRecordNavigation;
}) {
  const people = [...activePeople, ...inactivePeople];
  return (
    <div className="mt-4 space-y-4">
      {people.length ? (
        <>
          <ConnectLifecycleSection
            count={activePeople.length}
            label="Active Connect Users"
          >
            {activePeople.map((person) => (
              <ConnectUserAdminCard
                key={person.id ?? `${person.displayName}-${person.householdName}`}
                onNavigateRecord={onNavigateRecord}
                person={person}
              />
            ))}
          </ConnectLifecycleSection>
          <ConnectLifecycleSection
            count={inactivePeople.length}
            defaultOpen={false}
            label="Inactive Connect Users"
          >
            {inactivePeople.map((person) => (
              <ConnectUserAdminCard
                key={person.id ?? `${person.displayName}-${person.householdName}`}
                onNavigateRecord={onNavigateRecord}
                person={person}
              />
            ))}
          </ConnectLifecycleSection>
        </>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          {filtersActive
            ? "No Connect participants match the current filters."
            : "No Connect participants loaded yet."}
        </p>
      )}
    </div>
  );
}

function ConnectRecordFilters({
  filtersActive,
  focusedSearchText,
  lifecycleFilter,
  onClearFocusedSearch,
  onResetFilters,
  resultCount,
  searchQuery,
  setLifecycleFilter,
  setSearchQuery,
  totalCount,
}: {
  filtersActive: boolean;
  focusedSearchText: string;
  lifecycleFilter: ConnectLifecycleFilter;
  onClearFocusedSearch: () => void;
  onResetFilters: () => void;
  resultCount: number;
  searchQuery: string;
  setLifecycleFilter: (value: ConnectLifecycleFilter) => void;
  setSearchQuery: (value: string) => void;
  totalCount: number;
}) {
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">
          Showing {resultCount} of {totalCount} record
          {totalCount === 1 ? "" : "s"}
        </p>
        <button
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!filtersActive}
          onClick={onResetFilters}
          type="button"
        >
          Reset filters
        </button>
      </div>
      {focusedSearchText ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-950">
          <span>
            Focused from related record:{" "}
            <span className="font-semibold">{focusedSearchText}</span>
          </span>
          <button
            className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-semibold text-blue-800"
            onClick={onClearFocusedSearch}
            type="button"
          >
            Clear focus
          </button>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search
          </span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Name, ID, setup code, status, source"
            type="search"
            value={searchQuery}
          />
        </label>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Lifecycle
          </span>
          <div className="mt-1 flex rounded-md border border-slate-300 bg-slate-50 p-1">
            {(["all", "active", "inactive"] as const).map((filter) => (
              <button
                className={`rounded px-3 py-1.5 text-sm font-semibold capitalize ${
                  lifecycleFilter === filter
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600"
                }`}
                key={filter}
                onClick={() => setLifecycleFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectLocalDraftBanner({
  draftCount,
  onClearDrafts,
}: {
  draftCount: number;
  onClearDrafts: () => void;
}) {
  if (!draftCount) return null;
  return (
    <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">
          {draftCount} local action draft{draftCount === 1 ? "" : "s"} in this
          Connect area
        </p>
        <button
          className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800"
          onClick={onClearDrafts}
          type="button"
        >
          Clear all drafts
        </button>
      </div>
      <p className="mt-1 text-xs">
        Drafts are local review notes only. They are not saved, audited, or
        executable yet.
      </p>
    </div>
  );
}

function ConnectOperationsChecklist({
  cacheIsStale,
  draftCount,
  filtersActive,
  focus,
  onClearReviewed,
  onMarkReviewed,
  reviewedKeys,
  resultCount,
  reviewItems,
  totalCount,
}: {
  cacheIsStale: boolean;
  draftCount: number;
  filtersActive: boolean;
  focus: ConnectRecordsFocus;
  onClearReviewed: () => void;
  onMarkReviewed: (items: ConnectReviewQueueItem[]) => void;
  reviewedKeys: Set<string>;
  resultCount: number;
  reviewItems: ConnectReviewQueueItem[];
  totalCount: number;
}) {
  const [copiedChecklist, setCopiedChecklist] = useState(false);
  const [copiedNextTarget, setCopiedNextTarget] = useState(false);
  const [copiedPacket, setCopiedPacket] = useState(false);
  const attentionCount = reviewItems.filter(
    (item) => connectReviewQueueGroup(item) === "attention"
  ).length;
  const attentionItems = reviewItems.filter(
    (item) => connectReviewQueueGroup(item) === "attention"
  );
  const routineItems = reviewItems.filter(
    (item) => connectReviewQueueGroup(item) === "routine"
  );
  const nextAttentionItem = attentionItems.find(
    (item) => !reviewedKeys.has(connectReviewQueueItemKey(item))
  );
  const visibleReviewItems = [
    ...attentionItems.slice(0, 6),
    ...routineItems.slice(0, 6),
  ];
  const reviewedVisibleCount = visibleReviewItems.filter((item) =>
    reviewedKeys.has(connectReviewQueueItemKey(item))
  ).length;
  const routineCount = reviewItems.length - attentionCount;
  const checklistItems = [
    {
      detail: cacheIsStale
        ? "Refresh Connect records before operational review."
        : "Cache is inside the freshness window.",
      label: "Provisioning data",
      state: cacheIsStale ? "Refresh recommended" : "Ready",
    },
    {
      detail: `${attentionCount} attention, ${routineCount} routine`,
      label: "Visible review queue",
      state: reviewItems.length ? "Review needed" : "Clear",
    },
    {
      detail: `${reviewedVisibleCount}/${visibleReviewItems.length} visible items reviewed locally`,
      label: "Local review progress",
      state: reviewedVisibleCount ? "In progress" : "Not started",
    },
    {
      detail: connectReviewQueueRankDescription(),
      label: "Priority model",
      state: "Ranked",
    },
    {
      detail: nextAttentionItem
        ? `${nextAttentionItem.action} · ${nextAttentionItem.detail}`
        : "No attention item under the current filters.",
      label: "Next target",
      state: nextAttentionItem?.label ?? "None",
    },
    {
      detail: filtersActive
        ? `${resultCount} of ${totalCount} records visible`
        : "No search or lifecycle filters applied.",
      label: "Current filter",
      state: filtersActive ? "Scoped" : "All visible",
    },
    {
      detail: "Actions are staged locally; execution remains blocked.",
      label: "Execution posture",
      state: draftCount ? `${draftCount} local draft${draftCount === 1 ? "" : "s"}` : "Read-only",
    },
  ];

  async function copyChecklist() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(
      [
        `Connect Admin operations checklist: ${formatConnectSource(focus)}`,
        ...checklistItems.map(
          (item) => `- ${item.label}: ${item.state} | ${item.detail}`
        ),
      ].join("\n")
    );
    setCopiedChecklist(true);
    window.setTimeout(() => setCopiedChecklist(false), 1200);
  }

  async function copyReviewPacket() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(
      [
        `Connect Admin review packet: ${formatConnectSource(focus)}`,
        "Checklist",
        ...checklistItems.map(
          (item) => `- ${item.label}: ${item.state} | ${item.detail}`
        ),
        "Needs attention",
        ...(attentionItems.length
          ? attentionItems.map((item) =>
              formatConnectReviewQueueCopyLine(
                item,
                reviewedKeys.has(connectReviewQueueItemKey(item))
              )
            )
          : ["- none"]),
        "Routine review",
        ...(routineItems.length
          ? routineItems.map((item) =>
              formatConnectReviewQueueCopyLine(
                item,
                reviewedKeys.has(connectReviewQueueItemKey(item))
              )
            )
          : ["- none"]),
        "Execution: read-only Admin review; mutations require confirmation, permissions, durable audit, and recovery behavior.",
      ].join("\n")
    );
    setCopiedPacket(true);
    window.setTimeout(() => setCopiedPacket(false), 1200);
  }

  async function copyNextTarget() {
    if (!nextAttentionItem || !navigator.clipboard) return;
    await navigator.clipboard.writeText(
      [
        `Connect Admin next target: ${formatConnectSource(focus)}`,
        formatConnectReviewQueueCopyLine(nextAttentionItem),
        "Execution: read-only Admin review; mutations require confirmation, permissions, durable audit, and recovery behavior.",
      ].join("\n")
    );
    setCopiedNextTarget(true);
    window.setTimeout(() => setCopiedNextTarget(false), 1200);
  }

  return (
    <section className="mt-4 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Operations Checklist
          </p>
          <h5 className="font-semibold text-slate-900">
            {formatConnectSource(focus)} review posture
          </h5>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
            onClick={() => void copyChecklist()}
            type="button"
          >
            {copiedChecklist ? "Copied checklist" : "Copy checklist"}
          </button>
          <button
            className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              !visibleReviewItems.length ||
              reviewedVisibleCount === visibleReviewItems.length
            }
            onClick={() => onMarkReviewed(visibleReviewItems)}
            type="button"
          >
            Mark visible reviewed
          </button>
          <button
            className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!reviewedVisibleCount}
            onClick={onClearReviewed}
            type="button"
          >
            Clear local reviews
          </button>
          <button
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!nextAttentionItem}
            onClick={() => void copyNextTarget()}
            type="button"
          >
            {copiedNextTarget ? "Copied target" : "Copy next target"}
          </button>
          <button
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"
            onClick={() => void copyReviewPacket()}
            type="button"
          >
            {copiedPacket ? "Copied packet" : "Copy review packet"}
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {checklistItems.map((item) => (
          <div
            className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm"
            key={item.label}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">{item.label}</p>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
                {item.state}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConnectProvisioningStatusBanner({
  cacheAgeMs,
  cacheIsStale,
  lastLoadedAt,
  loadState,
  onRetry,
  status,
}: {
  cacheAgeMs: number;
  cacheIsStale: boolean;
  lastLoadedAt: string;
  loadState: ConnectProvisioningLoadState;
  onRetry: () => void;
  status: string;
}) {
  const isError = loadState === "error";
  const isLoading = loadState === "loading";
  const isReady = loadState === "ready";
  return (
    <div
      className={`mt-3 rounded-md border p-3 text-sm ${
        isError
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {isError
              ? "Connect provisioning server unavailable"
              : isLoading
                ? "Loading Connect records"
                : isReady
                  ? "Connect records loaded"
                  : "Connect records not loaded"}
          </p>
          <p className="mt-1">{status}</p>
          {lastLoadedAt ? (
            <p className="mt-1 text-xs">
              Source: local Connect server on 8790 · Last loaded{" "}
              {formatConnectDate(lastLoadedAt)} ·{" "}
              {cacheIsStale ? "Stale cache" : "Fresh cache"} (
              {formatConnectDuration(cacheAgeMs)})
            </p>
          ) : null}
        </div>
        {isError || cacheIsStale ? (
          <button
            className={`rounded-md border bg-white px-3 py-1.5 text-xs font-semibold ${
              isError
                ? "border-amber-300 text-amber-900"
                : "border-slate-300 text-slate-700"
            }`}
            onClick={onRetry}
            type="button"
          >
            {isError ? "Retry" : "Refresh"}
          </button>
        ) : null}
      </div>
      {isError ? (
        <p className="mt-2 text-xs">
          Start or restart the local Connect server on 8790, then retry from
          this panel.
        </p>
      ) : null}
      {!isError && cacheIsStale ? (
        <p className="mt-2 text-xs">
          Cached data is older than five minutes. Refresh before making
          operational decisions.
        </p>
      ) : null}
    </div>
  );
}

function ConnectReviewQueue({
  items,
  onFocusItem,
  reviewedKeys,
  setReviewedKeys,
}: {
  items: ConnectReviewQueueItem[];
  onFocusItem: (item: ConnectReviewQueueItem) => void;
  reviewedKeys: Set<string>;
  setReviewedKeys: (keys: Set<string>) => void;
}) {
  const [copiedQueue, setCopiedQueue] = useState(false);
  const attentionItems = items.filter(
    (item) => connectReviewQueueGroup(item) === "attention"
  );
  const routineItems = items.filter(
    (item) => connectReviewQueueGroup(item) === "routine"
  );
  const visibleQueueItems = [
    ...attentionItems.slice(0, 6),
    ...routineItems.slice(0, 6),
  ];
  const reviewedVisibleCount = visibleQueueItems.filter((item) =>
    reviewedKeys.has(connectReviewQueueItemKey(item))
  ).length;
  const nextUnreviewedAttentionItem = attentionItems.find(
    (item) => !reviewedKeys.has(connectReviewQueueItemKey(item))
  );

  function toggleReviewed(item: ConnectReviewQueueItem) {
    const key = connectReviewQueueItemKey(item);
    const nextKeys = new Set(reviewedKeys);
    if (nextKeys.has(key)) {
      nextKeys.delete(key);
    } else {
      nextKeys.add(key);
    }
    setReviewedKeys(nextKeys);
  }

  async function copyReviewQueue() {
    if (!items.length || !navigator.clipboard) return;
    await navigator.clipboard.writeText(
      [
        "Connect Admin review queue",
        `${reviewedVisibleCount}/${visibleQueueItems.length} visible items reviewed locally`,
        `Needs attention: ${attentionItems.length}`,
        ...attentionItems.map((item) =>
          formatConnectReviewQueueCopyLine(
            item,
            reviewedKeys.has(connectReviewQueueItemKey(item))
          )
        ),
        `Routine review: ${routineItems.length}`,
        ...routineItems.map((item) =>
          formatConnectReviewQueueCopyLine(
            item,
            reviewedKeys.has(connectReviewQueueItemKey(item))
          )
        ),
        "Persistence: local reviewed state is not saved or audited.",
      ].join("\n")
    );
    setCopiedQueue(true);
    window.setTimeout(() => setCopiedQueue(false), 1200);
  }

  return (
    <section className="mt-4 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Admin Review Queue
          </p>
          <h5 className="font-semibold text-slate-900">
            {items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : "No visible review items"}
          </h5>
          {items.length ? (
            <p className="text-xs text-slate-600">
              {reviewedVisibleCount}/{visibleQueueItems.length} visible items
              reviewed locally
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {nextUnreviewedAttentionItem ? (
            <button
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800"
              onClick={() => onFocusItem(nextUnreviewedAttentionItem)}
              type="button"
            >
              Focus next attention
            </button>
          ) : null}
          <button
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!items.length}
            onClick={() => void copyReviewQueue()}
            type="button"
          >
            {copiedQueue ? "Copied queue" : "Copy queue"}
          </button>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            Read-only
          </span>
        </div>
      </div>
      {items.length ? (
        <div className="mt-3 space-y-3">
          <ConnectReviewQueueGroup
            items={attentionItems}
            label="Needs attention"
            onFocusItem={onFocusItem}
            onToggleReviewed={toggleReviewed}
            reviewedKeys={reviewedKeys}
            setReviewedKeys={setReviewedKeys}
          />
          <ConnectReviewQueueGroup
            defaultOpen={false}
            items={routineItems}
            label="Routine review"
            onFocusItem={onFocusItem}
            onToggleReviewed={toggleReviewed}
            reviewedKeys={reviewedKeys}
            setReviewedKeys={setReviewedKeys}
          />
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          No visible records need review under the current filters.
        </p>
      )}
    </section>
  );
}

function ConnectReviewQueueGroup({
  defaultOpen = true,
  items,
  label,
  onFocusItem,
  onToggleReviewed,
  reviewedKeys,
  setReviewedKeys,
}: {
  defaultOpen?: boolean;
  items: ConnectReviewQueueItem[];
  label: string;
  onFocusItem: (item: ConnectReviewQueueItem) => void;
  onToggleReviewed: (item: ConnectReviewQueueItem) => void;
  reviewedKeys: Set<string>;
  setReviewedKeys: (keys: Set<string>) => void;
}) {
  const [copiedProgress, setCopiedProgress] = useState(false);
  const [copiedSearchText, setCopiedSearchText] = useState("");

  async function copyQueueItemSearchText(item: ConnectReviewQueueItem) {
    if (!item.searchText || !navigator.clipboard) return;
    await navigator.clipboard.writeText(item.searchText);
    setCopiedSearchText(item.searchText);
    window.setTimeout(() => setCopiedSearchText(""), 1200);
  }

  if (!items.length) return null;
  const visibleItems = items.slice(0, 6);
  const reviewedVisibleCount = visibleItems.filter((item) =>
    reviewedKeys.has(connectReviewQueueItemKey(item))
  ).length;

  async function copyLocalProgress() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(
      [
        `Connect Admin local review progress: ${label}`,
        `${reviewedVisibleCount}/${visibleItems.length} visible reviewed locally`,
        ...visibleItems.map((item) =>
          [
            formatConnectReviewQueueCopyLine(item),
            `reviewed=${reviewedKeys.has(connectReviewQueueItemKey(item))}`,
          ].join(" | ")
        ),
        "Persistence: local UI state only; not saved or audited.",
      ].join("\n")
    );
    setCopiedProgress(true);
    window.setTimeout(() => setCopiedProgress(false), 1200);
  }

  return (
    <details className="rounded-md border border-slate-100 bg-slate-50 p-2" open={defaultOpen}>
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label} · {items.length} · {reviewedVisibleCount} reviewed locally
      </summary>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button
          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-600"
          onClick={() => void copyLocalProgress()}
          type="button"
        >
          {copiedProgress ? "Copied progress" : "Copy local progress"}
        </button>
        {reviewedVisibleCount ? (
          <button
            className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700"
            onClick={() => setReviewedKeys(new Set())}
            type="button"
          >
            Clear local review marks
          </button>
        ) : null}
      </div>
      <div className="mt-2 grid gap-2">
        {visibleItems.map((item) => {
          const itemKey = connectReviewQueueItemKey(item);
          const reviewed = reviewedKeys.has(itemKey);
          return (
            <article
              className={`rounded-md border px-3 py-2 ${
                reviewed
                  ? "border-emerald-100 bg-emerald-50"
                  : "border-slate-100 bg-white"
              }`}
              key={itemKey}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.label}
                  </p>
                  <p className="text-xs text-slate-600">{item.detail}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {reviewed ? (
                    <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Reviewed locally
                    </span>
                  ) : null}
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {item.recordType}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {item.priority}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {item.action}
                  </span>
                  <button
                    className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800"
                    onClick={() => onFocusItem(item)}
                    type="button"
                  >
                    Focus
                  </button>
                  <button
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!item.searchText}
                    onClick={() => void copyQueueItemSearchText(item)}
                    type="button"
                  >
                    {copiedSearchText === item.searchText
                      ? "Copied key"
                      : "Copy key"}
                  </button>
                  <button
                    className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700"
                    onClick={() => onToggleReviewed(item)}
                    type="button"
                  >
                    {reviewed ? "Unmark reviewed" : "Mark reviewed"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {items.length > 6 ? (
          <p className="text-xs font-semibold text-slate-500">
            {items.length - 6} more visible item
            {items.length - 6 === 1 ? "" : "s"} in the list below.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function ConnectProvisioningOverviewRecords({
  auditEvents,
  devices,
  filtersActive,
  households,
  onNavigateRecord,
  setupTokens,
}: {
  auditEvents: NonNullable<ConnectProvisioningSnapshot["auditEvents"]>;
  devices: NonNullable<ConnectProvisioningSnapshot["receiverDevices"]>;
  filtersActive: boolean;
  households: ConnectReceiverHousehold[];
  onNavigateRecord: ConnectRecordNavigation;
  setupTokens: NonNullable<ConnectProvisioningSnapshot["setupTokens"]>;
}) {
  const activeSetupTokens = setupTokens.filter((token) =>
    isConnectSetupTokenActive(token)
  );
  const inactiveSetupTokens = setupTokens.filter(
    (token) => !isConnectSetupTokenActive(token)
  );
  const deviceNames = new Map(devices.map((device) => [device.id, device.name]));
  const householdNames = new Map(
    households.map((household) => [household.id, household.displayName])
  );

  return (
    <div className="mt-4 space-y-5">
      <div className="space-y-4">
        <ConnectLifecycleSection
          count={activeSetupTokens.length}
          label="Active Setup Links"
        >
          {activeSetupTokens.map((token) => (
            <ConnectSetupTokenAdminCard
              deviceName={
                token.receiverDeviceId
                  ? deviceNames.get(token.receiverDeviceId)
                  : undefined
              }
              householdName={
                token.receiverHouseholdId
                  ? householdNames.get(token.receiverHouseholdId)
                  : undefined
              }
              key={token.token ?? token.setupCode ?? token.receiverDeviceId}
              onNavigateRecord={onNavigateRecord}
              setupToken={token}
            />
          ))}
        </ConnectLifecycleSection>
        <ConnectLifecycleSection
          count={inactiveSetupTokens.length}
          defaultOpen={false}
          label="Inactive Setup Links"
        >
          {inactiveSetupTokens.map((token) => (
            <ConnectSetupTokenAdminCard
              deviceName={
                token.receiverDeviceId
                  ? deviceNames.get(token.receiverDeviceId)
                  : undefined
              }
              householdName={
                token.receiverHouseholdId
                  ? householdNames.get(token.receiverHouseholdId)
                  : undefined
              }
              key={token.token ?? token.setupCode ?? token.receiverDeviceId}
              onNavigateRecord={onNavigateRecord}
              setupToken={token}
            />
          ))}
        </ConnectLifecycleSection>
        {setupTokens.length ? null : (
          <p className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            {filtersActive
              ? "No Connect setup links match the current filters."
              : "No Connect setup links loaded yet."}
          </p>
        )}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h5 className="text-sm font-semibold text-slate-800">
            Recent Provisioning Events
          </h5>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
            {auditEvents.length}
          </span>
        </div>
        {auditEvents.length ? (
          <div className="grid gap-3">
            {auditEvents.map((event) => (
              <ConnectProvisioningEventCard
                deviceName={
                  event.receiverDeviceId
                    ? deviceNames.get(event.receiverDeviceId)
                    : undefined
                }
              event={event}
              householdName={
                event.receiverHouseholdId
                  ? householdNames.get(event.receiverHouseholdId)
                  : undefined
              }
              key={event.id ?? `${event.type}-${event.createdAt}`}
              onNavigateRecord={onNavigateRecord}
            />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            {filtersActive
              ? "No provisioning events match the current search."
              : "No recent provisioning events loaded yet."}
          </p>
        )}
      </section>
    </div>
  );
}

function ConnectSetupTokenAdminCard({
  deviceName,
  householdName,
  onNavigateRecord,
  setupToken,
}: {
  deviceName?: string;
  householdName?: string;
  onNavigateRecord: ConnectRecordNavigation;
  setupToken: NonNullable<ConnectProvisioningSnapshot["setupTokens"]>[number];
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold text-slate-950">
            {setupToken.setupCode ?? "Setup link"}
          </h5>
          <p className="text-sm text-slate-600">
            {deviceName ??
              setupToken.receiverDeviceId ??
              "No receiver device assigned"}
          </p>
        </div>
        <ConnectStatusBadge status={setupToken.status ?? "unknown"} />
      </div>
      <ConnectAdminDetailGrid
        details={[
          ["Device ID", setupToken.receiverDeviceId ?? "not recorded"],
          [
            "Household",
            householdName ?? setupToken.receiverHouseholdId ?? "not assigned",
          ],
          ["Expires", formatConnectDate(setupToken.expiresAt)],
          ["Created", formatConnectDate(setupToken.createdAt)],
          ["Created by", setupToken.createdByUserId ?? "not recorded"],
          ["Used", formatConnectDate(setupToken.usedAt)],
        ]}
      />
      <ConnectRelatedRecordLinks
        links={[
          setupToken.receiverDeviceId
            ? {
                area: "devices",
                label: "Open device",
                searchText: setupToken.receiverDeviceId,
              }
            : null,
          setupToken.receiverHouseholdId
            ? {
                area: "households",
                label: "Open household",
                searchText: setupToken.receiverHouseholdId,
              }
            : null,
        ]}
        onNavigateRecord={onNavigateRecord}
      />
      <ConnectRecordSummaryActions
        lines={[
          `Status: ${setupToken.status ?? "unknown"}`,
          `Device: ${deviceName ?? setupToken.receiverDeviceId ?? "not assigned"}`,
          `Household: ${householdName ?? setupToken.receiverHouseholdId ?? "not assigned"}`,
          `Expires: ${formatConnectDate(setupToken.expiresAt)}`,
        ]}
        title={setupToken.setupCode ?? "Setup link"}
      />
      <ConnectAdminActionNote
        actions={recommendedSetupTokenActions(setupToken)}
        note="Setup-link actions should require confirmation and audit logging before they mutate state."
        subjectId={setupToken.setupCode ?? setupToken.token ?? ""}
        subjectLabel={setupToken.setupCode ?? "Setup link"}
      />
    </article>
  );
}

function ConnectProvisioningEventCard({
  deviceName,
  event,
  householdName,
  onNavigateRecord,
}: {
  deviceName?: string;
  event: NonNullable<ConnectProvisioningSnapshot["auditEvents"]>[number];
  householdName?: string;
  onNavigateRecord: ConnectRecordNavigation;
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold text-slate-950">
            {formatConnectEventType(event.type)}
          </h5>
          <p className="text-sm text-slate-600">
            {formatConnectDate(event.createdAt)}
          </p>
        </div>
        {event.setupTokenStatus ? (
          <ConnectStatusBadge status={event.setupTokenStatus} />
        ) : null}
      </div>
      <ConnectAdminDetailGrid
        details={[
          ["Event ID", event.id ?? "not recorded"],
          ["Device", deviceName ?? event.receiverDeviceId ?? "not recorded"],
          [
            "Household",
            householdName ?? event.receiverHouseholdId ?? "not recorded",
          ],
          ["Setup code", event.setupCode ?? "not recorded"],
          ["Expires", formatConnectDate(event.expiresAt)],
          ["Actor", event.createdByUserId ?? "system"],
        ]}
      />
      <ConnectRelatedRecordLinks
        links={[
          event.receiverDeviceId
            ? {
                area: "devices",
                label: "Open device",
                searchText: event.receiverDeviceId,
              }
            : null,
          event.receiverHouseholdId
            ? {
                area: "households",
                label: "Open household",
                searchText: event.receiverHouseholdId,
              }
            : null,
        ]}
        onNavigateRecord={onNavigateRecord}
      />
      <ConnectRecordSummaryActions
        lines={[
          `Created: ${formatConnectDate(event.createdAt)}`,
          `Device: ${deviceName ?? event.receiverDeviceId ?? "not recorded"}`,
          `Household: ${householdName ?? event.receiverHouseholdId ?? "not recorded"}`,
          `Setup code: ${event.setupCode ?? "not recorded"}`,
        ]}
        title={formatConnectEventType(event.type)}
      />
      <ConnectAdminActionNote
        actions={["Open related record"]}
        note="Provisioning events are audit context; edits should happen on the related user, household, device, or setup link."
        subjectId={event.id ?? ""}
        subjectLabel={formatConnectEventType(event.type)}
      />
    </article>
  );
}

function ConnectUserAdminCard({
  onNavigateRecord,
  person,
}: {
  onNavigateRecord: ConnectRecordNavigation;
  person: ConnectReceiverPerson & { householdName?: string };
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold text-slate-950">
            {person.displayName ?? person.id ?? "Receiver user"}
          </h5>
          <p className="text-sm text-slate-600">
            {person.householdName ?? "No household assigned"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ConnectLifecycleBadge active={person.active} />
          <ConnectIdentityBadge person={person} />
        </div>
      </div>
      <ConnectAdminDetailGrid
        details={[
          ["Connect user ID", person.id ?? "not recorded"],
          ["Household ID", person.receiverHouseholdId ?? "not assigned"],
          ["Source", formatConnectSource(person.source)],
          [
            "CP Pers link",
            person.linkedCareVipId ? person.linkedCareVipId : "none",
          ],
        ]}
      />
      <ConnectRelatedRecordLinks
        links={[
          person.receiverHouseholdId
            ? {
                area: "households",
                label: "Open household",
                searchText: person.receiverHouseholdId,
              }
            : null,
        ]}
        onNavigateRecord={onNavigateRecord}
      />
      <ConnectRecordSummaryActions
        lines={[
          `Lifecycle: ${person.active === false ? "Inactive" : "Active"}`,
          `Household: ${person.householdName ?? person.receiverHouseholdId ?? "not assigned"}`,
          `Source: ${formatConnectSource(person.source)}`,
          `CP Pers link: ${person.linkedCareVipId ?? "none"}`,
        ]}
        title={person.displayName ?? person.id ?? "Receiver user"}
      />
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
        <span>Lifecycle: active, inactive, restore</span>
        <span>Global user: not assumed</span>
        <span>Family membership: planned by tier</span>
      </div>
      <ConnectAdminActionNote
        actions={recommendedUserActions(person)}
        note="User lifecycle changes remain Connect-scoped and should not imply Global Users account operations."
        subjectId={person.id ?? ""}
        subjectLabel={person.displayName ?? person.id ?? "Receiver user"}
      />
    </article>
  );
}

function ConnectDevicesRegistry({
  activeDevices,
  filtersActive,
  households,
  inactiveDevices,
  onNavigateRecord,
}: {
  activeDevices: NonNullable<ConnectProvisioningSnapshot["receiverDevices"]>;
  filtersActive: boolean;
  households: ConnectReceiverHousehold[];
  inactiveDevices: NonNullable<ConnectProvisioningSnapshot["receiverDevices"]>;
  onNavigateRecord: ConnectRecordNavigation;
}) {
  const devices = [...activeDevices, ...inactiveDevices];
  const householdNames = new Map(
    households.map((household) => [household.id, household.displayName])
  );
  return (
    <div className="mt-4 space-y-4">
      {devices.length ? (
        <>
          <ConnectLifecycleSection
            count={activeDevices.length}
            label="Active Connect Devices"
          >
            {activeDevices.map((device) => (
              <ConnectDeviceAdminCard
                device={device}
                householdName={
                  device.receiverHouseholdId
                    ? householdNames.get(device.receiverHouseholdId)
                    : undefined
                }
                key={device.id ?? device.name}
                onNavigateRecord={onNavigateRecord}
              />
            ))}
          </ConnectLifecycleSection>
          <ConnectLifecycleSection
            count={inactiveDevices.length}
            defaultOpen={false}
            label="Inactive / Revoked Connect Devices"
          >
            {inactiveDevices.map((device) => (
              <ConnectDeviceAdminCard
                device={device}
                householdName={
                  device.receiverHouseholdId
                    ? householdNames.get(device.receiverHouseholdId)
                    : undefined
                }
                key={device.id ?? device.name}
                onNavigateRecord={onNavigateRecord}
              />
            ))}
          </ConnectLifecycleSection>
        </>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          {filtersActive
            ? "No Connect devices match the current filters."
            : "No Connect devices loaded yet."}
        </p>
      )}
    </div>
  );
}

function ConnectDeviceAdminCard({
  device,
  householdName,
  onNavigateRecord,
}: {
  device: NonNullable<ConnectProvisioningSnapshot["receiverDevices"]>[number];
  householdName?: string;
  onNavigateRecord: ConnectRecordNavigation;
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold text-slate-950">
            {device.name ?? device.id ?? "Receiver device"}
          </h5>
          <p className="text-sm text-slate-600">
            {device.receiverHouseholdId
              ? householdName ?? device.receiverHouseholdId
              : "Unassigned"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ConnectLifecycleBadge active={isConnectRecordActive(device)} />
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {device.status ?? "status unknown"}
          </span>
          {formatConnectPresence(device.presence) ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {formatConnectPresence(device.presence)}
            </span>
          ) : null}
        </div>
      </div>
      <ConnectAdminDetailGrid
        details={[
          ["Device ID", device.id ?? "not recorded"],
          ["Household ID", device.receiverHouseholdId ?? "not assigned"],
          ["Last seen", formatConnectDate(device.lastSeenAt)],
        ]}
      />
      <ConnectRelatedRecordLinks
        links={[
          device.receiverHouseholdId
            ? {
                area: "households",
                label: "Open household",
                searchText: device.receiverHouseholdId,
              }
            : null,
          device.id
            ? {
                area: "provisioning",
                label: "Open provisioning",
                searchText: device.id,
              }
            : null,
        ]}
        onNavigateRecord={onNavigateRecord}
      />
      <ConnectRecordSummaryActions
        lines={[
          `Lifecycle: ${isConnectRecordActive(device) ? "Active" : "Inactive"}`,
          `Status: ${device.status ?? "unknown"}`,
          `Household: ${householdName ?? device.receiverHouseholdId ?? "not assigned"}`,
          `Last seen: ${formatConnectDate(device.lastSeenAt)}`,
        ]}
        title={device.name ?? device.id ?? "Receiver device"}
      />
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
        <span>Setup and assignment belong in Connect Admin</span>
      </div>
      <ConnectAdminActionNote
        actions={recommendedDeviceActions(device)}
        note="Device actions should preserve setup-link history and household assignment audit trails."
        subjectId={device.id ?? ""}
        subjectLabel={device.name ?? device.id ?? "Receiver device"}
      />
    </article>
  );
}

function ConnectHouseholdsRegistry({
  activeHouseholds,
  devices,
  filtersActive,
  inactiveHouseholds,
  onNavigateRecord,
}: {
  activeHouseholds: ConnectReceiverHousehold[];
  devices: NonNullable<ConnectProvisioningSnapshot["receiverDevices"]>;
  filtersActive: boolean;
  inactiveHouseholds: ConnectReceiverHousehold[];
  onNavigateRecord: ConnectRecordNavigation;
}) {
  const households = [...activeHouseholds, ...inactiveHouseholds];
  return (
    <div className="mt-4 space-y-4">
      {households.length ? (
        <>
          <ConnectLifecycleSection
            count={activeHouseholds.length}
            label="Active Connect Households"
          >
            {activeHouseholds.map((household) => (
              <ConnectHouseholdAdminCard
                devices={devices.filter(
                  (device) => device.receiverHouseholdId === household.id
                )}
                household={household}
                key={household.id ?? household.displayName}
                onNavigateRecord={onNavigateRecord}
              />
            ))}
          </ConnectLifecycleSection>
          <ConnectLifecycleSection
            count={inactiveHouseholds.length}
            defaultOpen={false}
            label="Inactive Connect Households"
          >
            {inactiveHouseholds.map((household) => (
              <ConnectHouseholdAdminCard
                devices={devices.filter(
                  (device) => device.receiverHouseholdId === household.id
                )}
                household={household}
                key={household.id ?? household.displayName}
                onNavigateRecord={onNavigateRecord}
              />
            ))}
          </ConnectLifecycleSection>
        </>
      ) : (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          {filtersActive
            ? "No Connect households match the current filters."
            : "No Connect households loaded yet."}
        </p>
      )}
    </div>
  );
}

function ConnectHouseholdAdminCard({
  devices,
  household,
  onNavigateRecord,
}: {
  devices: NonNullable<ConnectProvisioningSnapshot["receiverDevices"]>;
  household: ConnectReceiverHousehold;
  onNavigateRecord: ConnectRecordNavigation;
}) {
  const people = household.receiverPeople ?? [];
  const isConnectManaged = household.source === "connect_provisioning";
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold text-slate-950">
            {household.displayName ?? household.id ?? "Receiver household"}
          </h5>
          <p className="text-sm text-slate-600">
            {people.length} Connect participant{people.length === 1 ? "" : "s"} ·{" "}
            {devices.length} receiver device{devices.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ConnectLifecycleBadge active={household.active} />
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {isConnectManaged ? "Connect-managed" : "Modeled from CP Pers"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {people.length ? (
          people.map((person) => (
            <span
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
              key={person.id ?? person.displayName}
            >
              {person.displayName ?? person.id ?? "Receiver user"}
              <ConnectLifecycleBadge active={person.active} compact />
              <ConnectIdentityBadge person={person} />
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-500">No Connect participants.</span>
        )}
      </div>

      <ConnectAdminDetailGrid
        details={[
          ["Household ID", household.id ?? "not recorded"],
          ["Default target", household.defaultTarget ?? "not set"],
          ["Source", formatConnectSource(household.source)],
        ]}
      />
      <ConnectRelatedRecordLinks
        links={[
          household.id
            ? {
                area: "users",
                label: "Open users",
                searchText: household.id,
              }
            : null,
          household.id
            ? {
                area: "devices",
                label: "Open devices",
                searchText: household.id,
              }
            : null,
          household.id
            ? {
                area: "provisioning",
                label: "Open provisioning",
                searchText: household.id,
              }
            : null,
        ]}
        onNavigateRecord={onNavigateRecord}
      />
      <ConnectRecordSummaryActions
        lines={[
          `Lifecycle: ${household.active === false ? "Inactive" : "Active"}`,
          `Receiver users: ${people.length}`,
          `Receiver devices: ${devices.length}`,
          `Source: ${formatConnectSource(household.source)}`,
        ]}
        title={household.displayName ?? household.id ?? "Receiver household"}
      />

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
        <span>Lifecycle tracked: create, deactivate, restore</span>
        <span>CP Family identity: planned by tier</span>
      </div>
      <ConnectAdminActionNote
        actions={recommendedHouseholdActions(household)}
        note="Household actions should be reviewed against active users, devices, and setup links before mutation."
        subjectId={household.id ?? ""}
        subjectLabel={household.displayName ?? household.id ?? "Receiver household"}
      />
    </article>
  );
}

function ConnectLifecycleBadge({
  active,
  compact = false,
}: {
  active?: boolean;
  compact?: boolean;
}) {
  const isInactive = active === false;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        isInactive
          ? "bg-amber-100 text-amber-900"
          : "bg-emerald-100 text-emerald-800"
      } ${compact ? "" : "border border-transparent"}`}
    >
      {isInactive ? "Inactive" : "Active"}
    </span>
  );
}

function ConnectAdminActionNote({
  actions,
  note,
  subjectId,
  subjectLabel,
}: {
  actions: string[];
  note: string;
  subjectId: string;
  subjectLabel: string;
}) {
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const draftId = useId();
  const { draftResetVersion, setDraftActive } = useContext(
    ConnectActionDraftContext
  );
  const [stagedAction, setStagedAction] = useState("");

  useEffect(() => {
    return () => setDraftActive(draftId, false);
  }, [draftId, setDraftActive]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCopiedDraft(false);
      setDraftNote("");
      setStagedAction("");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [draftResetVersion]);

  async function copyActionDraft() {
    if (!stagedAction || !navigator.clipboard) return;
    await navigator.clipboard.writeText(
      [
        `Connect Admin action draft: ${stagedAction}`,
        `Subject: ${subjectLabel}`,
        `Subject ID: ${subjectId || "(not recorded)"}`,
        `Review note: ${draftNote.trim() || "(not captured)"}`,
        "Execution: Not executable",
        `Guardrails: ${note}`,
      ].join("\n")
    );
    setCopiedDraft(true);
    window.setTimeout(() => setCopiedDraft(false), 1200);
  }

  if (!actions.length) return null;
  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Recommended Admin Action
          </p>
          <p className="mt-1 text-sm text-slate-700">{actions.join(" / ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                stagedAction === action
                  ? "border-blue-300 bg-blue-50 text-blue-900"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
              key={action}
              onClick={() => {
                setDraftNote("");
                setDraftActive(draftId, true);
                setStagedAction(action);
              }}
              type="button"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">{note}</p>
      {stagedAction ? (
        <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
          <p className="font-semibold">Action draft staged: {stagedAction}</p>
          <p className="mt-1 text-xs">
            This is a local Admin review draft only. Execution should wait for
            confirmation language, permission checks, durable audit events, and
            recovery behavior.
          </p>
          <p className="mt-2 text-xs">
            Subject: <span className="font-semibold">{subjectLabel}</span>
            {subjectId ? ` (${subjectId})` : ""}
          </p>
          <label className="mt-3 block">
            <span className="text-xs font-semibold uppercase tracking-wide text-blue-900">
              Review note
            </span>
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm text-slate-900"
              onChange={(event) => setDraftNote(event.target.value)}
              placeholder="Why is this action being considered?"
              value={draftNote}
            />
          </label>
          <dl className="mt-3 grid gap-2 rounded-md border border-blue-100 bg-white p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">
                Draft action
              </dt>
              <dd className="mt-1 text-slate-800">{stagedAction}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">
                Subject
              </dt>
              <dd className="mt-1 text-slate-800">{subjectLabel}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">
                Review note
              </dt>
              <dd className="mt-1 text-slate-800">
                {draftNote.trim() ? "Captured" : "Needed"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-slate-500">
                Execution
              </dt>
              <dd className="mt-1 text-slate-800">Not executable</dd>
            </div>
          </dl>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800"
              onClick={() => void copyActionDraft()}
              type="button"
            >
              {copiedDraft ? "Copied draft" : "Copy draft"}
            </button>
            <button
              className="rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800"
              onClick={() => {
                setCopiedDraft(false);
                setDraftNote("");
                setDraftActive(draftId, false);
                setStagedAction("");
              }}
              type="button"
            >
              Clear draft
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConnectRecordSummaryActions({
  lines,
  title,
}: {
  lines: string[];
  title: string;
}) {
  const [copiedSummary, setCopiedSummary] = useState(false);

  async function copyRecordSummary() {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(
      [`Connect Admin record: ${title}`, ...lines].join("\n")
    );
    setCopiedSummary(true);
    window.setTimeout(() => setCopiedSummary(false), 1200);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        onClick={() => void copyRecordSummary()}
        type="button"
      >
        {copiedSummary ? "Copied summary" : "Copy record summary"}
      </button>
      <span className="text-xs font-semibold text-slate-500">
        Local handoff only
      </span>
    </div>
  );
}

function recommendedUserActions(person: ConnectReceiverPerson) {
  return person.active === false
    ? ["Review restore"]
    : ["Review deactivate", "Review identity link"];
}

function recommendedHouseholdActions(household: ConnectReceiverHousehold) {
  return household.active === false
    ? ["Review restore"]
    : ["Review membership", "Review archive"];
}

function recommendedDeviceActions(
  device: NonNullable<ConnectProvisioningSnapshot["receiverDevices"]>[number]
) {
  if (!device.receiverHouseholdId) return ["Assign household"];
  if (!isConnectRecordActive(device)) return ["Review replacement"];
  return ["Review setup link", "Review reassignment"];
}

function recommendedSetupTokenActions(
  setupToken: NonNullable<ConnectProvisioningSnapshot["setupTokens"]>[number]
) {
  if (isConnectSetupTokenActive(setupToken)) return ["Review revoke"];
  return ["Review reissue"];
}

function buildConnectReviewQueue({
  devices,
  focus,
  households,
  people,
  setupTokens,
}: {
  devices: NonNullable<ConnectProvisioningSnapshot["receiverDevices"]>;
  focus: ConnectRecordsFocus;
  households: ConnectReceiverHousehold[];
  people: Array<ConnectReceiverPerson & { householdName?: string }>;
  setupTokens: NonNullable<ConnectProvisioningSnapshot["setupTokens"]>;
}) {
  const items: ConnectReviewQueueItem[] = [];

  if (focus === "users") {
    for (const person of people) {
      if (person.active === false) {
        items.push({
          action: "Review restore",
          detail: person.householdName ?? "No household assigned",
          label: person.displayName ?? person.id ?? "Receiver user",
          priority: "Lifecycle",
          recordType: "User",
          searchText: person.id ?? person.displayName ?? "",
        });
      } else if (!person.linkedCareVipId) {
        items.push({
          action: "Review identity link",
          detail: "No CP Pers link recorded",
          label: person.displayName ?? person.id ?? "Receiver user",
          priority: "Identity",
          recordType: "User",
          searchText: person.id ?? person.displayName ?? "",
        });
      }
    }
  }

  if (focus === "households") {
    for (const household of households) {
      const peopleCount = household.receiverPeople?.length ?? 0;
      const deviceCount = devices.filter(
        (device) => device.receiverHouseholdId === household.id
      ).length;
      if (household.active === false) {
        items.push({
          action: "Review restore",
          detail: `${peopleCount} users, ${deviceCount} devices`,
          label: household.displayName ?? household.id ?? "Receiver household",
          priority: "Lifecycle",
          recordType: "Household",
          searchText: household.id ?? household.displayName ?? "",
        });
      } else if (peopleCount === 0 || deviceCount === 0) {
        items.push({
          action: peopleCount === 0 ? "Review membership" : "Review devices",
          detail: `${peopleCount} users, ${deviceCount} devices`,
          label: household.displayName ?? household.id ?? "Receiver household",
          priority: "Completeness",
          recordType: "Household",
          searchText: household.id ?? household.displayName ?? "",
        });
      }
    }
  }

  if (focus === "devices") {
    for (const device of devices) {
      if (!device.receiverHouseholdId) {
        items.push({
          action: "Assign household",
          detail: device.status ?? "status unknown",
          label: device.name ?? device.id ?? "Receiver device",
          priority: "Assignment",
          recordType: "Device",
          searchText: device.id ?? device.name ?? "",
        });
      } else if (!isConnectRecordActive(device)) {
        items.push({
          action: "Review replacement",
          detail: device.status ?? "status unknown",
          label: device.name ?? device.id ?? "Receiver device",
          priority: "Lifecycle",
          recordType: "Device",
          searchText: device.id ?? device.name ?? "",
        });
      }
    }
  }

  if (focus === "overview") {
    for (const setupToken of setupTokens) {
      items.push({
        action: isConnectSetupTokenActive(setupToken)
          ? "Review revoke"
          : "Review reissue",
        detail: setupToken.receiverDeviceId ?? "No receiver device assigned",
        label: setupToken.setupCode ?? "Setup link",
        priority: isConnectSetupTokenActive(setupToken) ? "Active link" : "Inactive link",
        recordType: "Setup link",
        searchText:
          setupToken.setupCode ??
          setupToken.receiverDeviceId ??
          setupToken.token ??
          "",
      });
    }
  }

  return items.sort(compareConnectReviewQueueItems);
}

function compareConnectReviewQueueItems(
  first: ConnectReviewQueueItem,
  second: ConnectReviewQueueItem
) {
  const rankDifference =
    connectReviewQueueRank(first) - connectReviewQueueRank(second);
  if (rankDifference !== 0) return rankDifference;
  return first.label.localeCompare(second.label);
}

function connectReviewQueueGroup(item: ConnectReviewQueueItem) {
  if (item.priority === "Inactive link") return "routine";
  return "attention";
}

function connectReviewQueueRank(item: ConnectReviewQueueItem) {
  if (item.priority === "Assignment") return 10;
  if (item.priority === "Lifecycle") return 20;
  if (item.priority === "Identity") return 30;
  if (item.priority === "Completeness") return 40;
  if (item.priority === "Active link") return 50;
  return 90;
}

function connectReviewQueueRankDescription() {
  return "Assignment, lifecycle, identity, completeness, active links, routine";
}

function connectReviewQueueItemKey(item: ConnectReviewQueueItem) {
  return [
    item.recordType,
    item.priority,
    item.action,
    item.label,
    item.searchText,
  ].join(":");
}

function formatConnectReviewQueueCopyLine(
  item: ConnectReviewQueueItem,
  reviewed?: boolean
) {
  return [
    `- ${item.label}`,
    `group=${connectReviewQueueGroup(item)}`,
    `type=${item.recordType}`,
    `priority=${item.priority}`,
    `rank=${connectReviewQueueRank(item)}`,
    `action=${item.action}`,
    `detail=${item.detail}`,
    reviewed === undefined ? null : `reviewed=${reviewed}`,
    item.searchText ? `search=${item.searchText}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function countVisibleConnectRecords({
  auditEvents,
  devices,
  focus,
  households,
  people,
  setupTokens,
}: {
  auditEvents: NonNullable<ConnectProvisioningSnapshot["auditEvents"]>;
  devices: NonNullable<ConnectProvisioningSnapshot["receiverDevices"]>;
  focus: ConnectRecordsFocus;
  households: ConnectReceiverHousehold[];
  people: Array<ConnectReceiverPerson & { householdName?: string }>;
  setupTokens: NonNullable<ConnectProvisioningSnapshot["setupTokens"]>;
}) {
  switch (focus) {
    case "devices":
      return devices.length;
    case "households":
      return households.length;
    case "overview":
      return setupTokens.length + auditEvents.length;
    case "users":
      return people.length;
  }
}

function ConnectStatusBadge({ status }: { status: string }) {
  const normalizedStatus = status.toLowerCase();
  const isActive = normalizedStatus === "active";
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {formatConnectSource(status)}
    </span>
  );
}

function ConnectLifecycleSection({
  children,
  count,
  defaultOpen = true,
  label,
}: {
  children: ReactNode;
  count: number;
  defaultOpen?: boolean;
  label: string;
}) {
  if (count === 0) return null;
  return (
    <details className="space-y-2" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
        <h5 className="text-sm font-semibold text-slate-800">{label}</h5>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
          {count}
        </span>
      </summary>
      <div className="grid gap-3 pt-2">{children}</div>
    </details>
  );
}

function ConnectAdminDetailGrid({
  details,
}: {
  details: Array<[string, string]>;
}) {
  const [copiedLabel, setCopiedLabel] = useState("");

  async function copyDetail(label: string, value: string) {
    if (!isConnectDetailCopyable(value) || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopiedLabel(label);
    window.setTimeout(() => setCopiedLabel(""), 1200);
  }

  return (
    <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {details.map(([label, value]) => (
        <div
          className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
          key={label}
        >
          <dt className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>{label}</span>
            {isConnectDetailCopyable(value) ? (
              <button
                className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-slate-600"
                onClick={() => void copyDetail(label, value)}
                type="button"
              >
                {copiedLabel === label ? "Copied" : "Copy"}
              </button>
            ) : null}
          </dt>
          <dd className="mt-1 break-words text-sm text-slate-700">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function isConnectDetailCopyable(value: string) {
  const normalized = value.trim().toLowerCase();
  return Boolean(
    normalized &&
      ![
        "none",
        "not assigned",
        "not recorded",
        "not set",
        "system",
      ].includes(normalized)
  );
}

function ConnectRelatedRecordLinks({
  links,
  onNavigateRecord,
}: {
  links: Array<{
    area: ConnectRecordNavigationArea;
    label: string;
    searchText: string;
  } | null>;
  onNavigateRecord: ConnectRecordNavigation;
}) {
  const visibleLinks = links.filter(
    (
      link
    ): link is {
      area: ConnectRecordNavigationArea;
      label: string;
      searchText: string;
    } => Boolean(link?.searchText)
  );
  if (!visibleLinks.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {visibleLinks.map((link) => (
        <button
          className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800"
          key={`${link.area}-${link.searchText}-${link.label}`}
          onClick={() => onNavigateRecord(link.area, link.searchText)}
          type="button"
        >
          {link.label}
        </button>
      ))}
    </div>
  );
}

function isConnectRecordActive(record: { active?: boolean; status?: string }) {
  if (record.active === false) return false;
  if (record.status === "revoked" || record.status === "inactive") return false;
  return true;
}

function isConnectAdminAreaKey(value: string | null): value is ConnectAdminAreaKey {
  return connectAdminAreaKeys.some((key) => key === value);
}

function sortConnectLifecycleRecords<
  T extends {
    active?: boolean;
    displayName?: string;
    id?: string;
    name?: string;
    status?: string;
  },
>(records: T[]) {
  return [...records].sort((first, second) => {
    const firstActive = isConnectRecordActive(first);
    const secondActive = isConnectRecordActive(second);
    if (firstActive !== secondActive) return firstActive ? -1 : 1;
    const firstLabel = first.displayName ?? first.name ?? first.id ?? "";
    const secondLabel = second.displayName ?? second.name ?? second.id ?? "";
    return firstLabel.localeCompare(secondLabel);
  });
}

function isConnectSetupTokenActive(
  setupToken: NonNullable<ConnectProvisioningSnapshot["setupTokens"]>[number]
) {
  return setupToken.status === "active";
}

function sortConnectSetupTokens(
  setupTokens: NonNullable<ConnectProvisioningSnapshot["setupTokens"]>
) {
  return [...setupTokens].sort((first, second) => {
    const firstActive = isConnectSetupTokenActive(first);
    const secondActive = isConnectSetupTokenActive(second);
    if (firstActive !== secondActive) return firstActive ? -1 : 1;
    return (
      new Date(second.createdAt || 0).getTime() -
      new Date(first.createdAt || 0).getTime()
    );
  });
}

function normalizeConnectSearch(value: string) {
  return value.trim().toLowerCase();
}

function matchesConnectSearch(record: unknown, normalizedSearch: string) {
  if (!normalizedSearch) return true;
  return collectConnectSearchValues(record).some((value) =>
    value.toLowerCase().includes(normalizedSearch)
  );
}

function collectConnectSearchValues(record: unknown): string[] {
  if (record === null || record === undefined) return [];
  if (typeof record === "string" || typeof record === "number") {
    return [String(record)];
  }
  if (typeof record === "boolean") {
    return [record ? "active" : "inactive"];
  }
  if (Array.isArray(record)) {
    return record.flatMap(collectConnectSearchValues);
  }
  if (typeof record === "object") {
    return Object.values(record).flatMap(collectConnectSearchValues);
  }
  return [];
}

function matchesConnectLifecycleFilter(
  record: { active?: boolean; status?: string },
  lifecycleFilter: ConnectLifecycleFilter
) {
  if (lifecycleFilter === "all") return true;
  const isActive = isConnectRecordActive(record);
  return lifecycleFilter === "active" ? isActive : !isActive;
}

function formatConnectEventType(value?: string) {
  if (!value) return "Provisioning event";
  return value
    .split(".")
    .map(formatConnectSource)
    .join(" ");
}

function formatConnectSource(value?: string) {
  if (!value) return "not recorded";
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatConnectPresence(
  presence?: NonNullable<
    NonNullable<ConnectProvisioningSnapshot["receiverDevices"]>[number]["presence"]
  >
) {
  if (!presence) return "";
  return presence.label ?? presence.state ?? "";
}

function ConnectIdentityBadge({ person }: { person: ConnectReceiverPerson }) {
  if (person.linkedCareVipId) {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">
        CP Pers
      </span>
    );
  }
  if (person.source === "connect_provisioning") {
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">
        Unlinked prototype
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">
      CP Family later
    </span>
  );
}

function formatConnectDate(value?: string) {
  if (!value) return "not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatConnectDuration(valueMs: number) {
  if (!Number.isFinite(valueMs) || valueMs < 0) return "just now";
  const seconds = Math.floor(valueMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min old`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr old`;
}

function ConnectAppearancePanel() {
  const [theme, setTheme] = useState<ConnectTheme>(() => {
    if (typeof window === "undefined") return defaultConnectTheme;
    try {
      const storedTheme = window.localStorage.getItem(connectThemeStorageKey);
      return storedTheme ? normalizeConnectTheme(JSON.parse(storedTheme)) : defaultConnectTheme;
    } catch {
      return defaultConnectTheme;
    }
  });
  const [status, setStatus] = useState("Receiver appearance defaults to Classic Green.");

  const selectedPreset = useMemo(
    () =>
      connectThemePresets.find((preset) =>
        connectThemeFields.every(
          (field) => preset[field].toLowerCase() === theme[field].toLowerCase()
        )
      )?.name ?? "",
    [theme]
  );

  async function loadTheme() {
    setStatus("Loading receiver appearance...");
    try {
      const payload = await fetchConnectTheme();
      const nextTheme = normalizeConnectTheme(payload.theme);
      setTheme(nextTheme);
      window.localStorage.setItem(connectThemeStorageKey, JSON.stringify(nextTheme));
      setStatus(
        payload.source === "default"
          ? "Receiver is using the default Classic Green appearance."
          : `${nextTheme.name || "Custom"} loaded from local Connect server.`
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `${error.message}. Showing this Admin browser's saved appearance.`
          : "Showing this Admin browser's saved appearance."
      );
    }
  }

  async function saveTheme() {
    const normalizedTheme = normalizeConnectTheme(theme);
    setTheme(normalizedTheme);
    try {
      window.localStorage.setItem(connectThemeStorageKey, JSON.stringify(normalizedTheme));
      await saveConnectTheme(normalizedTheme);
      setStatus(`${normalizedTheme.name || "Custom"} saved for the web receiver.`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `${error.message}. Saved in this Admin browser only.`
          : "Saved in this Admin browser only."
      );
    }
  }

  async function resetTheme() {
    setTheme(defaultConnectTheme);
    try {
      window.localStorage.removeItem(connectThemeStorageKey);
      await resetConnectTheme();
      setStatus("Receiver appearance reset to Classic Green.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `${error.message}. This Admin browser was reset to Classic Green.`
          : "This Admin browser was reset to Classic Green."
      );
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-md border p-3"
        style={{ background: theme.outerFrameColor, borderColor: theme.borderColor }}
      >
        <div
          className="grid gap-2 rounded-md border p-3"
          style={{
            background: theme.panelBackgroundColor,
            borderColor: theme.borderColor,
            color: theme.textColor,
          }}
        >
          <span className="text-xs font-bold uppercase opacity-75">Receiver</span>
          <strong>Contact caregiver</strong>
          <button
            className="rounded-md border px-3 py-2 text-sm font-bold text-white"
            style={{
              background: theme.primaryActionColor,
              borderColor: theme.primaryActionColor,
            }}
            type="button"
          >
            Ask a question
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              className="rounded-md border px-3 py-2 text-sm font-bold text-white"
              style={{
                background: theme.informationActionColor,
                borderColor: theme.informationActionColor,
              }}
              type="button"
            >
              Message
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm font-bold"
              style={{
                background: theme.secondaryActionColor,
                borderColor: theme.borderColor,
                color: theme.textColor,
              }}
              type="button"
            >
              Back
            </button>
            <button
              className="rounded-md border px-3 py-2 text-sm font-bold text-white"
              style={{
                background: theme.recordActionColor,
                borderColor: theme.recordActionColor,
              }}
              type="button"
            >
              Mic
            </button>
          </div>
        </div>
      </div>

      <label className="block max-w-xl text-sm font-medium text-slate-700">
        Preset theme
        <select
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
          onChange={(event) => {
            const preset =
              connectThemePresets.find((item) => item.name === event.target.value) ??
              defaultConnectTheme;
            setTheme({ ...preset });
            setStatus("Previewing changes in Admin. Save to apply on the web receiver.");
          }}
          value={selectedPreset}
        >
          <option value="">Custom</option>
          {connectThemePresets.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>

      <details className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer font-semibold text-slate-900">
          Advanced colors
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {connectThemeFields.map((field) => (
            <label className="text-sm font-medium text-slate-700" key={field}>
              {connectThemeFieldLabels[field]}
              <input
                className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white p-1"
                onChange={(event) => {
                  setTheme({ ...theme, [field]: event.target.value, name: "Custom" });
                  setStatus("Previewing changes in Admin. Save to apply on the web receiver.");
                }}
                type="color"
                value={theme[field]}
              />
            </label>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          onClick={loadTheme}
          type="button"
        >
          Load current appearance
        </button>
        <button
          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
          onClick={saveTheme}
          type="button"
        >
          Save appearance
        </button>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
          onClick={resetTheme}
          type="button"
        >
          Reset to Classic Green
        </button>
      </div>
      <p className="text-sm text-slate-600">{status}</p>
    </div>
  );
}

function ConnectTraceArea() {
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(false);
  const [bulkQuestionInput, setBulkQuestionInput] = useState("");
  const [bulkQuestionResults, setBulkQuestionResults] = useState<
    BulkReceiverQuestionResult[]
  >([]);
  const [bulkQuestionStatus, setBulkQuestionStatus] = useState(
    "Paste one Receiver Ask/Tell question per line."
  );
  const [queueItems, setQueueItems] = useState<InteractionReviewQueueItem[]>([]);
  const [queueStatus, setQueueStatus] = useState("Loading Interaction Review Queue...");
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [selectedAttemptDetail, setSelectedAttemptDetail] =
    useState<InteractionAttemptDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState("");
  const [status, setStatus] = useState("Loading receiver diagnostic mode...");

  useEffect(() => {
    let cancelled = false;
    async function loadDiagnosticsSetting() {
      try {
        const response = await fetch("/api/connect/receiver/diagnostics", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as {
          enabled?: boolean;
        };
        if (cancelled) return;
        setDiagnosticsEnabled(payload.enabled === true);
        setStatus("Receiver diagnostic mode setting loaded.");
      } catch {
        if (!cancelled) setStatus("Receiver diagnostic mode setting unavailable.");
      }
    }

    void loadDiagnosticsSetting();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadInteractionReviewQueue();
  }, []);

  async function adminAuthHeaders() {
    if (!adminSupabase) {
      throw new Error("Supabase browser config is unavailable.");
    }
    const { data, error } = await adminSupabase.auth.getSession();
    if (error) throw error;
    const accessToken = data.session?.access_token ?? "";
    if (!accessToken) {
      throw new Error("Sign in as an admin to load Interaction Reviews.");
    }
    return { Authorization: `Bearer ${accessToken}` };
  }

  async function loadInteractionReviewQueue() {
    setLoadingQueue(true);
    setQueueStatus("Loading Interaction Review Queue...");
    try {
      const response = await fetch("/api/admin/connect/interaction-review-queue", {
        cache: "no-store",
        headers: await adminAuthHeaders(),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        items?: InteractionReviewQueueItem[];
      };
      if (!response.ok) {
        throw new Error(payload.error || "Interaction Review Queue unavailable.");
      }
      setQueueItems(Array.isArray(payload.items) ? payload.items : []);
      setQueueStatus(
        payload.items?.length
          ? `${payload.items.length} attempts may merit review.`
          : "No Interaction Attempts currently match the review queue."
      );
    } catch (error) {
      setQueueStatus(
        error instanceof Error
          ? error.message
          : "Interaction Review Queue unavailable."
      );
    } finally {
      setLoadingQueue(false);
    }
  }

  async function openInteractionAttemptDetail(attemptId: string) {
    setDetailStatus("Loading attempt...");
    try {
      const response = await fetch(
        `/api/admin/connect/interaction-review-queue?attemptId=${encodeURIComponent(attemptId)}`,
        {
          cache: "no-store",
          headers: await adminAuthHeaders(),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        detail?: InteractionAttemptDetail;
        error?: string;
      };
      if (!response.ok || !payload.detail) {
        throw new Error(payload.error || "Interaction Attempt detail unavailable.");
      }
      setSelectedAttemptDetail(payload.detail);
      setDetailStatus("");
    } catch (error) {
      setDetailStatus(
        error instanceof Error
          ? error.message
          : "Interaction Attempt detail unavailable."
      );
    }
  }

  async function updateDiagnosticsSetting(enabled: boolean) {
    setDiagnosticsEnabled(enabled);
    setStatus(enabled ? "Enabling receiver diagnostic mode..." : "Disabling receiver diagnostic mode...");
    try {
      const response = await fetch("/api/connect/receiver/diagnostics", {
        body: JSON.stringify({ enabled }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        enabled?: boolean;
      };
      if (!response.ok) {
        throw new Error("Receiver diagnostic mode could not be saved.");
      }
      setDiagnosticsEnabled(payload.enabled === true);
      setStatus(
        payload.enabled
          ? "Receiver diagnostic mode enabled for Receiver result screens."
          : "Receiver diagnostic mode disabled."
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Receiver diagnostic mode could not be saved."
      );
    }
  }

  function runBulkQuestionInterpretation() {
    const lines = bulkQuestionInput
      .split(/\r?\n/)
      .map((line, index) => ({ lineNumber: index + 1, question: line.trim() }))
      .filter((item) => item.question);
    const fallbackContact = { displayName: "Caregiver", id: "contact-caregiver" };
    const contacts = [fallbackContact];
    const results = lines.map(({ lineNumber, question }) => {
      const interpretation = interpretReceiverAskObservation({
        contacts,
        fallbackContact,
        observation: createObservation({
          modality: "typed",
          source: "receiver",
          surface: "admin_bulk_receiver_question_test",
          text: question,
        }),
      });
      return {
        actionLabel: interpretation.answer?.actionLabel || "",
        answer: interpretation.answer?.answer || "",
        askCapabilityStatus:
          interpretation.askInterpretation?.capabilityStatus || "",
        askEntities: interpretation.askInterpretation
          ? JSON.stringify(interpretation.askInterpretation.entities)
          : "",
        askIntent: interpretation.askInterpretation?.intent || "",
        family: interpretation.familyClassification.family,
        lineNumber,
        needsRecovery: interpretation.needsRecovery,
        question,
        responseType: interpretation.answer?.type || "recovery",
        secondaryFamilies:
          interpretation.familyClassification.secondaryFamilies?.join(", ") || "",
      };
    });
    setBulkQuestionResults(results);
    setBulkQuestionStatus(
      results.length
        ? `Interpreted ${results.length} question${results.length === 1 ? "" : "s"}.`
        : "Paste one question per line before running."
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            checked={diagnosticsEnabled}
            className="mt-1 h-4 w-4 accent-blue-700"
            onChange={(event) => void updateDiagnosticsSetting(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block font-semibold text-slate-900">
              Enable Receiver diagnostic mode
            </span>
            <span className="mt-1 block text-slate-600">
              Shows temporary Observation, MeaningFrame, family, interpreter, and
              response-path text on Receiver Ask/Tell result screens.
            </span>
          </span>
        </label>
        <p className="mt-3 text-xs font-semibold text-slate-500">{status}</p>
      </div>
      <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
        <div>
          <h4 className="font-semibold text-slate-900">
            Bulk Receiver Question Test
          </h4>
          <p className="mt-1 text-sm text-slate-600">
            Paste one question per line to run the current Receiver Ask/Tell
            family and deterministic interpretation path without creating
            Interaction Attempts.
          </p>
        </div>
        <textarea
          className="min-h-36 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900"
          onChange={(event) => setBulkQuestionInput(event.target.value)}
          placeholder={"When is my next appointment?\nWhere are my glasses?\nShould I message my caregiver?"}
          value={bulkQuestionInput}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
            onClick={runBulkQuestionInterpretation}
            type="button"
          >
            Run interpretation
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={() => {
              setBulkQuestionInput("");
              setBulkQuestionResults([]);
              setBulkQuestionStatus("Paste one Receiver Ask/Tell question per line.");
            }}
            type="button"
          >
            Clear
          </button>
          <p className="text-xs font-semibold text-slate-500">
            {bulkQuestionStatus}
          </p>
        </div>
        {bulkQuestionResults.length ? (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Line</th>
                  <th className="px-3 py-2">Question</th>
                  <th className="px-3 py-2">Family</th>
                  <th className="px-3 py-2">Secondary</th>
                  <th className="px-3 py-2">Ask intent</th>
                  <th className="px-3 py-2">Capability</th>
                  <th className="px-3 py-2">Entities</th>
                  <th className="px-3 py-2">Route</th>
                  <th className="px-3 py-2">Response</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bulkQuestionResults.map((result) => (
                  <tr key={`${result.lineNumber}-${result.question}`}>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {result.lineNumber}
                    </td>
                    <td className="max-w-[240px] px-3 py-2 font-medium text-slate-900">
                      <span className="line-clamp-2">{result.question}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{result.family}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {result.secondaryFamilies || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {result.askIntent || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {result.askCapabilityStatus || "—"}
                    </td>
                    <td className="max-w-[220px] px-3 py-2 font-mono text-xs text-slate-600">
                      <span className="line-clamp-2">{result.askEntities || "—"}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {result.needsRecovery ? "recovery" : result.responseType}
                    </td>
                    <td className="max-w-[280px] px-3 py-2 text-slate-700">
                      <span className="line-clamp-2">{result.answer || "Needs clarification"}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {result.actionLabel || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold text-slate-900">
              Interaction Review Queue
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              Read-only list derived from Interaction Attempts, Events, Observations,
              Platform Reviews, and Review Analyses.
            </p>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            disabled={loadingQueue}
            onClick={() => void loadInteractionReviewQueue()}
            type="button"
          >
            {loadingQueue ? "Loading..." : "Refresh"}
          </button>
        </div>
        <p className="text-xs font-semibold text-slate-500">{queueStatus}</p>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Care subject</th>
                <th className="px-3 py-2">Surface</th>
                <th className="px-3 py-2">Original</th>
                <th className="px-3 py-2">Final</th>
                <th className="px-3 py-2">Revisions</th>
                <th className="px-3 py-2">Family</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Review</th>
                <th className="px-3 py-2">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {queueItems.map((item) => (
                <tr key={item.attemptId}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {formatConnectDate(item.startedAt)}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {item.careSubjectDisplayName}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{item.surface || "Receiver"}</td>
                  <td className="max-w-[220px] px-3 py-2 text-slate-700">
                    <span className="line-clamp-2">{item.originalUserWording || "—"}</span>
                  </td>
                  <td className="max-w-[220px] px-3 py-2 text-slate-700">
                    <span className="line-clamp-2">{item.finalUserWording || "—"}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{item.revisionCount}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {item.familyEvolution.length ? item.familyEvolution.join(" → ") : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {[item.status, item.outcome].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        item.reviewState === "unreviewed"
                          ? "bg-amber-50 text-amber-800"
                          : item.reviewState === "analyzed"
                            ? "bg-blue-50 text-blue-800"
                            : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {item.reviewState}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                      onClick={() => void openInteractionAttemptDetail(item.attemptId)}
                      type="button"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {queueItems.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={10}>
                    No attempts to review.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {detailStatus ? <p className="text-xs font-semibold text-slate-500">{detailStatus}</p> : null}
      </div>
      {selectedAttemptDetail ? (
        <InteractionAttemptDetailDialog
          detail={selectedAttemptDetail}
          onClose={() => setSelectedAttemptDetail(null)}
        />
      ) : null}
    </div>
  );
}

function InteractionAttemptDetailDialog({
  detail,
  onClose,
}: {
  detail: InteractionAttemptDetail;
  onClose: () => void;
}) {
  const item = detail.queueItem;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="grid max-h-[calc(100vh-2rem)] w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Interaction Attempt
            </p>
            <h4 className="text-xl font-semibold text-slate-950">
              {item?.originalUserWording || "Attempt detail"}
            </h4>
            <p className="mt-1 text-sm text-slate-600">
              {item
                ? `${item.status || "unknown"} / ${item.outcome || "pending"} · ${item.reviewState}`
                : "Attempt did not match the derived review queue."}
            </p>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="space-y-4 overflow-auto p-4">
          {item ? (
            <dl className="grid gap-3 md:grid-cols-4">
              <AdminTraceMetric label="Started" value={formatConnectDate(item.startedAt)} />
              <AdminTraceMetric label="Surface" value={item.surface || "Receiver"} />
              <AdminTraceMetric label="Revisions" value={String(item.revisionCount)} />
              <AdminTraceMetric label="Family" value={item.familyEvolution.join(" → ") || "—"} />
            </dl>
          ) : null}
          <section className="rounded-md border border-slate-200 p-3">
            <h5 className="font-semibold text-slate-900">Revision timeline</h5>
            <div className="mt-3 space-y-3">
              {detail.observations.map((observation, index) => {
                const observationId = observation.observationId || "";
                const events = detail.events.filter(
                  (event) => event.observationId === observationId
                );
                return (
                  <article
                    className="rounded-md border border-slate-200 bg-slate-50 p-3"
                    key={observationId || index}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-slate-900">
                        Revision {(observation.revisionIndex ?? index) + 1}
                      </strong>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                        {observation.revisionReason || "initial"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {observation.observationSnapshot?.rawText ||
                        observation.observationSnapshot?.transcriptText ||
                        "No captured wording."}
                    </p>
                    {events.length ? (
                      <ol className="mt-3 space-y-2 text-xs text-slate-600">
                        {events.map((event) => (
                          <li className="rounded bg-white p-2" key={event.id}>
                            <strong className="text-slate-800">{event.eventType}</strong>
                            <span className="ml-2">{formatConnectDate(event.createdAt || "")}</span>
                            {event.payload ? (
                              <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-slate-600">
                                {JSON.stringify(event.payload, null, 2)}
                              </pre>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
          <section className="rounded-md border border-slate-200 p-3">
            <h5 className="font-semibold text-slate-900">Platform reviews</h5>
            {detail.reviews.length ? (
              <div className="mt-3 space-y-3">
                {detail.reviews.map((review) => {
                  const analyses = detail.reviewAnalyses.filter(
                    (analysis) => analysis.reviewId === review.id
                  );
                  return (
                    <article className="rounded-md bg-slate-50 p-3" key={review.id}>
                      <p className="text-sm font-semibold text-slate-800">{review.comment}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatConnectDate(review.createdAt || "")}
                      </p>
                      {analyses.map((analysis, index) => (
                        <div className="mt-2 rounded bg-white p-2 text-xs text-slate-600" key={index}>
                          <strong className="text-slate-800">Advisory analysis</strong>
                          <p className="mt-1 whitespace-pre-wrap">{analysis.analysisText}</p>
                        </div>
                      ))}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No Platform Reviews yet.</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

function AdminTraceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function AudioMetric({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <strong className="mt-1 block text-lg text-slate-950">{value}</strong>
      <small className="mt-1 block text-slate-600">{detail}</small>
    </section>
  );
}

function normalizeConnectTheme(theme?: Partial<ConnectTheme> | null): ConnectTheme {
  const normalized = { ...defaultConnectTheme };
  connectThemeFields.forEach((field) => {
    const value = String(theme?.[field] ?? "");
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      normalized[field] = value;
    }
  });
  normalized.name = String(theme?.name || normalized.name || "Custom").trim() || "Custom";
  return normalized;
}

function formatAudioValue(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "None";
  return `${Number(value.toFixed ? value.toFixed(2) : value)}${suffix}`;
}

function formatAudioDb(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "0 dB";
  return `${value > 0 ? "+" : ""}${Number(value.toFixed(1))} dB`;
}

function formatAudioReason(reason: string) {
  return reason.replace(/_/g, " ");
}

function audioProfileEventTitle(event: ConnectAudioProfileEvent) {
  switch (event.playbackState) {
    case "ended":
      return "Playback finished";
    case "error":
      return "Playback error";
    case "fallback":
      return "Speech fallback";
    case "started":
      return "Playback started";
    case "stopped":
      return "Playback stopped";
    default:
      return "Enhanced playback";
  }
}

function audioEventDetailSummary(detail: Record<string, unknown>) {
  const entries = Object.entries(detail)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 5)
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}: ${value.join(", ") || "none"}`;
      if (typeof value === "object") return `${key}: recorded`;
      return `${key}: ${String(value)}`;
    });
  return entries.join(" · ") || "No detail";
}

function formatDuration(durationMs: number) {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function formatBytes(value: number) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortHash(value: string) {
  return value.length > 12 ? value.slice(0, 12) : value;
}

function readableAudioSource(source?: string) {
  return String(source || "audio")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readableAudioKind(artifact: ConnectAudioArtifact) {
  return readableAudioSource(artifact.artifactKind || artifact.source);
}

function readableAudioDirection(artifact: ConnectAudioArtifact) {
  if (artifact.audioDirection && artifact.audioDirection !== "unknown") {
    return readableAudioSource(artifact.audioDirection);
  }
  return `${artifact.from || "Unknown"} -> ${artifact.to || "Unknown"}`;
}

function readableAudioCapture(artifact: ConnectAudioArtifact) {
  const surface = artifact.captureContext?.captureSurface
    ? readableAudioSource(artifact.captureContext.captureSurface)
    : "";
  const platform = artifact.captureContext?.clientPlatform || "";
  return [surface, platform].filter(Boolean).join(" on ");
}

function audioArtifactDetailEndpoint(artifactId?: string) {
  return connectPrototypeEndpoints.audioArtifactDetail(artifactId || "");
}

function connectAudioMediaUrl(audioUrl?: string) {
  const value = String(audioUrl || "");

  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:")) {
    return value;
  }
  if (value.startsWith("/api/")) {
    return value;
  }

  return connectPrototypeEndpoints.audioArtifactMedia(value);
}

function audioOriginalIsPreserved(artifact: ConnectAudioArtifact) {
  return artifact.originalPreserved !== false && Boolean(artifact.audioUrl);
}

function audioArtifactIsLocalNextStored(artifact: ConnectAudioArtifact) {
  return String(artifact.audioUrl || "").startsWith("/api/connect/audio/media/");
}

function audioOriginalPreservationLabel(artifact: ConnectAudioArtifact) {
  if (audioOriginalIsPreserved(artifact)) return "Original preserved";
  if (artifact.audioUrl) return "Original needs review";
  return "Original missing";
}

function audioArtifactFilterOptions(
  artifacts: ConnectAudioArtifact[],
  profile: ConnectAudioProfile | null
) {
  if (!artifacts.length) return [];
  const filters: Array<{ id: AudioArtifactFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "receiver_voice", label: "Receiver voice" },
    { id: "coordinator_messages", label: "Coordinator" },
    { id: "linked_messages", label: "Linked" },
    { id: "unlinked", label: "Unlinked" },
    { id: "transcribed", label: "Transcribed" },
    { id: "needs_text", label: "Needs text" },
    { id: "enhanced", label: "Enhanced" },
  ];
  return filters.map((filter) => ({
    ...filter,
    count: artifacts.filter((artifact) =>
      audioArtifactMatchesFilter(artifact, filter.id, profile)
    ).length,
  }));
}

function audioArtifactMatchesFilter(
  artifact: ConnectAudioArtifact,
  filter: AudioArtifactFilter,
  profile: ConnectAudioProfile | null
) {
  const source = String(artifact.source || "").toLowerCase();
  const artifactKind = String(artifact.artifactKind || "").toLowerCase();
  const audioDirection = String(artifact.audioDirection || "").toLowerCase();
  const transcriptStatus = String(artifact.transcriptStatus || "").toLowerCase();
  const hasTranscript =
    Boolean(String(artifact.transcript || "").trim()) ||
    transcriptStatus === "completed";
  const related = relatedAudioActivity(artifact, profile);
  switch (filter) {
    case "receiver_voice":
      return (
        artifactKind.includes("ask") ||
        artifactKind === "receiver_message" ||
        audioDirection === "receiver_to_coordinator" ||
        artifact.from === "receiver_user" ||
        source.includes("ask") ||
        source.includes("recovery")
      );
    case "coordinator_messages":
      return (
        artifactKind === "coordinator_message" ||
        audioDirection === "coordinator_to_receiver" ||
        artifact.from === "coordinator_user" ||
        artifact.to === "receiver_user" ||
        source.includes("coordinator") ||
        source.includes("message")
      );
    case "linked_messages":
      return Boolean(artifact.relatedMessage);
    case "unlinked":
      return !artifact.relatedMessage;
    case "transcribed":
      return hasTranscript;
    case "needs_text":
      return (
        !hasTranscript &&
        ["failed", "not_configured", "not_requested", "missing_audio", ""].includes(
          transcriptStatus
        )
      );
    case "enhanced":
      return related.enhancements > 0 || related.feedback > 0;
    case "all":
    default:
      return true;
  }
}

function canRetryArtifactTranscription(artifact: ConnectAudioArtifact) {
  return Boolean(artifact.id && artifact.audioUrl) && artifact.transcriptStatus !== "completed";
}

function audioArtifactDeliveryLabel(artifact: ConnectAudioArtifact) {
  if (!artifact.relatedMessage) return "No linked message";
  const states = [];
  if (artifact.relatedMessage?.heardAt) {
    states.push(`Heard ${formatMessageStateTime(artifact.relatedMessage.heardAt)}`);
  }
  if (artifact.relatedMessage?.readAt) {
    states.push(`Read ${formatMessageStateTime(artifact.relatedMessage.readAt)}`);
  }
  return states.join(" · ") || "Not heard/read yet";
}

function audioMessageDeliveryLabel(message: ConnectAudioArtifact["relatedMessage"]) {
  const states = [];
  if (message?.heardAt) {
    states.push(`Heard ${formatMessageStateTime(message.heardAt)}`);
  }
  if (message?.readAt) {
    states.push(`Read ${formatMessageStateTime(message.readAt)}`);
  }
  return states.join(" · ") || "Not heard/read yet";
}

function formatMessageStateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function audioArtifactStats(
  artifacts: ConnectAudioArtifact[],
  profile: ConnectAudioProfile | null
) {
  const kindCounts = new Map<string, number>();
  const stats = artifacts.reduce(
    (acc, artifact) => {
      const artifactKind = readableAudioKind(artifact);
      const transcriptStatus = String(artifact.transcriptStatus || "").toLowerCase();
      const hasTranscript =
        Boolean(String(artifact.transcript || "").trim()) ||
        transcriptStatus === "completed";
      const related = relatedAudioActivity(artifact, profile);
      kindCounts.set(artifactKind, (kindCounts.get(artifactKind) || 0) + 1);
      acc.total += 1;
      acc.originalsPreserved += audioOriginalIsPreserved(artifact) ? 1 : 0;
      acc.transcribed += hasTranscript ? 1 : 0;
      acc.needsTranscript += hasTranscript ? 0 : 1;
      acc.duplicates += artifact.duplicateInfo ? 1 : 0;
      acc.enhanced += related.enhancements;
      acc.feedback += related.feedback;
      acc.linkedMessages += artifact.relatedMessage ? 1 : 0;
      acc.localArtifacts += audioArtifactIsLocalNextStored(artifact) ? 1 : 0;
      acc.prototypeArtifacts += audioArtifactIsLocalNextStored(artifact) ? 0 : 1;
      acc.totalBytes += artifact.audioByteSize ?? 0;
      return acc;
    },
    {
      duplicates: 0,
      enhanced: 0,
      feedback: 0,
      kindCount: 0,
      linkedMessages: 0,
      localArtifacts: 0,
      needsTranscript: 0,
      originalsPreserved: 0,
      prototypeArtifacts: 0,
      topKinds: [] as string[],
      total: 0,
      totalBytes: 0,
      transcribed: 0,
      unlinked: 0,
    }
  );
  stats.unlinked = Math.max(0, stats.total - stats.linkedMessages);
  stats.kindCount = kindCounts.size;
  stats.topKinds = [...kindCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([artifactKind, count]) => `${artifactKind} (${count})`);
  return stats;
}

function relatedAudioActivity(
  artifact: ConnectAudioArtifact,
  profile: ConnectAudioProfile | null
) {
  const audioUrl = normalizeAudioUrl(artifact.audioUrl);
  if (!audioUrl) {
    return { enhancements: 0, feedback: 0 };
  }
  return {
    enhancements: (profile?.enhancementEvents ?? []).filter(
      (event) => normalizeAudioUrl(event.audioUrl) === audioUrl
    ).length,
    feedback: (profile?.events ?? []).filter(
      (event) => normalizeAudioUrl(event.audioUrl) === audioUrl
    ).length,
  };
}

function normalizeAudioUrl(value?: string) {
  return String(value || "").replace(/^https?:\/\/[^/]+/i, "");
}
