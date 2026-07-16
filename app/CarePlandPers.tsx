"use client";

import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import {
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AgentKnowledgeAutomationSettings,
  AgentKnowledgeCheckRun,
  AgentKnowledgeProposal,
  AgentKnowledgeProposalItem,
  AgentKnowledgeProposalItemReviewStatus,
} from "./components/admin/AgentKnowledgeProposalsPanel";
import { createAdminNavigationModel } from "./components/admin/adminNavigationModel";
import {
  clearAdminRecommendationsReviewDraftStorage,
  type AdminRecommendationsReviewDraftSummary,
} from "./components/admin/AdminRecommendationsReviewPanel";
import {
  aiWorkflows,
  defaultCarePrepOutputSchema,
  type AiWorkflowKey,
} from "./components/admin/aiWorkflows";
import { type AdminAccessEventRow } from "./components/admin/AdminAuditTrailPanel";
import { type AiInstructionVersion } from "./components/admin/AdminAiInstructionPanel";
import {
  type CarePrepHistoryRow,
  type IntakeHistoryRow,
} from "./components/admin/AdminAiHistoryPanel";
import { type AppContentVersion } from "./components/admin/AdminContentPanel";
import {
  type AskModuleLabKey,
  type AskModuleLabResult,
  type AdminAskSubmission,
  type AskRecommendationDecision,
  type AskRecommendationDecisionSummaryRow,
  type AskReviewProductTarget,
  type AskRoutingSettings,
  type AskRoutingState,
  type AskSubmissionLink,
} from "./components/admin/AdminAskIntakePanel";
import {
  type AiOperationCostSummaryRow,
  type AiOperationCostUserSummaryRow,
  type AiOperationCostViewMode,
} from "./components/admin/AdminDashboardPanel";
import {
  type EarlyAccessIntakeDraft,
  type EarlyAccessIntakeRow,
  type EarlyAccessIntakeStatus,
} from "./components/admin/AdminEarlyAccessIntakePanel";
import { type AdminIntegrationErrorSummaryRow } from "./components/admin/AdminIntegrationErrorsPanel";
import {
  type ProductMgmtArea,
  type ProductMgmtItem,
  type ProductMgmtItemDraft,
  type ProductMgmtPriority,
  type ProductMgmtSection,
  type ProductMgmtStatus,
} from "./components/admin/AdminProductManagementPanel";
import {
  type SupportTicket,
  type SupportTicketMessage,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from "./components/admin/AdminSupportTicketsPanel";
import {
  type AdminUserActivityFilter,
  type AdminUserActivityRow,
  type AdminUserActivitySortKey,
} from "./components/admin/AdminUserActivityPanel";
import { createAdminWorkspaceProps } from "./components/admin/createAdminWorkspaceProps";
import { AdminWorkspace } from "./components/admin/AdminWorkspace";
import {
  adminSensitiveKey,
  type AdminReadonlySnapshot,
  type AdminRevealedSensitiveData,
  type AdminSensitiveResourceType,
} from "./components/admin/adminReadonlyUserTypes";
import {
  adminUserActivityStats as buildAdminUserActivityStats,
  filterAdminUserActivity,
} from "./components/admin/adminUserActivityModel";
import { productMgmtSections } from "./components/admin/productMgmtConfig";
import {
  adminViewStateKey,
  isActionableAdminAttentionScope,
  isNewForAdmin,
  type AdminAttentionSummary,
  type AdminViewScopeType,
  type AdminViewState,
} from "./components/admin/adminViewState";
import { AIReviewBadge, aiReviewLevel } from "./components/shared/ai/AIReviewBadge";
import { AppointmentViewToolbar } from "./components/personal/appointments/AppointmentViewToolbar";
import { AuthGatewayPanel } from "./components/shared/auth/AuthGatewayPanel";
import {
  buildActiveAskContext,
  buildHealthFocusAskContext,
} from "./lib/personal/ask/activeAskContext";
import { shouldRouteTopAskToCareContext } from "./lib/personal/ask/contextualAskRouting";
import { parseTopicContextLabelOverrides } from "./lib/personal/healthTopics/contextSignatureLabels";
import {
  HealthFocusCard,
  type HealthFocusTopicSummary,
} from "./components/personal/healthTopics/HealthFocusCard";
import {
  HealthFocusTopicDetail,
  type HealthFocusTopicDetailData,
  type HealthStoryFeedbackInput,
  type HealthStoryFeedbackResult,
} from "./components/personal/healthTopics/HealthFocusTopicDetail";
import {
  HomeContextPanel,
  type HomeContextAskContext,
} from "./components/personal/home/HomeContextPanel";
import { HomeNextAppointmentPanel } from "./components/personal/home/HomeNextAppointmentPanel";
import {
  AppointmentMessageComposer,
  type AppointmentMessageComposerDraft,
} from "./components/personal/messages/AppointmentMessageComposer";
import {
  AppointmentMessagesSection,
  RecentMessagesPanel,
  type PersonalMessage,
} from "./components/personal/messages/RecentMessagesPanel";
import {
  CarePlandTopNav,
  type CarePlandFocusOption,
} from "./components/shared/CarePlandTopNav";
import { InlineConfirmation } from "./components/shared/InlineConfirmation";
import { ManagedCareVipHelp } from "./components/shared/ManagedCareVipHelp";
import {
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  EnvelopeIcon,
  MapPinIcon,
  MessageCircleIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  RefreshCircleIcon,
} from "./components/shared/icons";
import {
  clearAllPageViewState,
  restorePageViewState,
  savePageViewState,
} from "./lib/navigation/pageViewState";
import { carePlandReturnToFromCurrentLocation } from "./lib/platform/authRedirect";
import { OnboardingGate } from "./components/personal/onboarding/OnboardingGate";
import { PersonalOverlays } from "./components/personal/PersonalOverlays";
import { PasswordUpdatePanel } from "./components/shared/auth/PasswordUpdatePanel";
import {
  ManagedByHouseholdHeart,
  PersonAvatar,
  PersonChip,
} from "./components/shared/PersonAvatar";
import { ProfilePage } from "./components/personal/profile/ProfilePage";
import { PublicWebsite } from "./components/public/PublicWebsite";
import { UserFacingFooter } from "./components/public/UserFacingFooter";
import {
  WelcomeGuide,
  welcomeGuidePanelCount,
} from "./components/personal/onboarding/WelcomeGuide";
import {
  asTextList,
  carePrepGuidanceFormValues,
  carePrepGuidanceHasDraftChanges,
  emptyAppointmentDraft,
  emptyCarePrepDraft,
  emptyNoteDraft,
  intakeDraftHasSaveableNotes,
  linesToList,
  type AppointmentDetailsDraft,
  type IntakeReviewDraftContent,
} from "./lib/personal/editor/editorState";
import {
  normalizeAppointmentCommunicationInventory,
} from "./lib/personal/appointments/communicationSummary";
import {
  buildHomeMessageSummary,
  homeMessageSummaryModelVersion,
} from "./lib/personal/messages/homeMessageSummary";
import {
  buildWhatToKnowDisplayModel,
  type WhatToKnowDisplayItem,
  type WhatToKnowSourceType,
} from "./lib/personal/appointments/whatToKnow";
import {
  appointmentModifierHasUnsavedChanges,
  buildUnsavedSignOutChanges,
  hasAnyUnsavedWork,
  newAppointmentDraftHasContent,
  textIntakePanelHasUnsavedChanges,
  type AppointmentModifier,
} from "./lib/personal/editor/unsavedChanges";
import {
  gentleCautionButtonClass,
  gentlePrimaryButtonClass,
  gentleSecondaryButtonClass,
  gentleSmallBlueButtonClass,
  gentleSmallSecondaryButtonClass,
  gentleSoftBlueButtonClass,
  gentleWarmButtonClass,
} from "./components/shared/uiStyles";
import {
  favoriteLocationLabel,
  FavoriteLocation,
  PlaceAddressResult,
  PlaceAutocompleteSuggestion,
  PlaceDetailsResult,
  placesUnavailableMessage,
} from "./lib/platform/integrations/places";
import {
  AdminContactDetails,
  adminContactDetailsFromValue,
} from "./lib/admin/contactDetails";
import {
  appContentCategories,
  appContentDefaults,
  appContentOptions,
} from "./lib/platform/content/appContentConfig";
import {
  bulkAppointmentDraftsFromResult,
  type BulkAppointmentDraft,
} from "./lib/personal/appointments/calendarImport";
import { buildImportAnythingProviderUpserts } from "./lib/personal/importAnything/providers";
import {
  applyImportAnythingIdentityResolutions,
  importAnythingUnresolvedDetectedIdentities,
  type ImportAnythingIdentityResolutionDecision,
} from "./lib/personal/importAnything/identityResolution";
import {
  importAnythingOwnerMismatchNotice,
} from "./lib/personal/importAnything/ownership";
import { maxImportAnythingSourceSummaries } from "./lib/personal/importAnything/request";
import { buildImportAnythingCarePrepDrafts } from "./lib/personal/importAnything/review";
import {
  formatImportAnythingPlaceholderSection,
  formatImportAnythingSourceSummary,
  formatImportAnythingTextSection,
} from "./lib/personal/importAnything/sources";
import {
  planProfilePanelContentKey,
  pricingTierForEntitlement,
  pricingTiers,
} from "./lib/platform/entitlements/pricingTiers";
import { createCareVipActions } from "./lib/personal/profile/careVipActions";
import {
  emptyProfileDraft,
  formatUsPhoneFromDigits,
  formatUsZipFromDigits,
  phoneDigits,
  zipDigits,
  profileDisplayName,
  profileDraftFromRow,
  profileDraftKey,
  trimProfileDraft,
  type ProfileDraft,
  validateProfileDraft,
} from "./lib/personal/profile/profileDraft";
import { generatedBuildDttm, generatedBuildNumber } from "./build-info";
import {
  allCarePlandFocusValue,
  carePlandUiStateStorageKey,
} from "./lib/platform/focus";
import {
  AppSessionSettings,
  defaultAppSessionSettings,
  normalizeAppSessionSettings,
  sessionIdleTimeoutHours,
} from "./lib/platform/sessionSettings";
import {
  adminItemsVisibilityChangedEvent,
  readShowAdminItemsPreference,
} from "./lib/platform/adminItemsVisibility";
import type { AvatarPerson } from "./lib/platform/avatar";

type Appointment = {
  id: string;
  care_circle_id?: string | null;
  care_subject_id: string | null;
  current_note_id: string | null;
  location_address: string | null;
  location_name: string | null;
  location_phone: string | null;
  provider_name: string | null;
  provider_organization: string | null;
  is_sample_data?: boolean | null;
  title: string | null;
  reason: string | null;
  starts_at: string | null;
  status: string;
  archived_at?: string | null;
  deleted_at?: string | null;
};

type NotesReminderAppointment = Appointment & {
  care_circle_id: string;
};

type CarePrepGenerationMode =
  | "auto_after_notes"
  | "auto_appointments_page"
  | "auto_home"
  | "manual";

type CareSubject = {
  avatarAltText?: string | null;
  avatarEmoji?: string | null;
  avatarIsDefault?: boolean;
  avatarType?: "generated" | "initials" | "uploaded" | string | null;
  avatarUrl?: string | null;
  id: string;
  care_circle_id: string;
  display_name: string;
  managed_by_household?: boolean | null;
  subject_type: string;
  is_default: boolean;
  is_active: boolean;
};

type CareSubjectAvatarMap = Record<
  string,
  {
    avatarAltText?: string | null;
    avatarType?: string | null;
    avatarUrl?: string | null;
  }
>;

type CareSubjectRow = CareSubject & {
  avatar_alt_text?: string | null;
  avatar_type?: "generated" | "initials" | "uploaded" | string | null;
  avatar_url?: string | null;
};

type HomeTodayFocusItem = {
  id: string;
  title: string;
};

type HomeTodayFocusGroup = {
  items: HomeTodayFocusItem[];
  subjectAvatar: AvatarPerson | null;
  subjectId: string;
  subjectLabel: string;
  subjectName: string;
};

type HomeMessageGroup = {
  messages: PersonalMessage[];
  subjectId: string;
};

type HomeAtAGlanceSummary = {
  historySections: Array<{
    estimates?: string[];
    items: string[];
    title: string;
  }>;
  items: string[];
  subtitle: string;
  title: string;
};

type HealthFocusSummaryCache = {
  localDay: string;
  subjectId: string;
  topics: HealthFocusTopicSummary[];
};

const ellieTestingTodayFocusItems: HomeTodayFocusItem[] = [
  {
    id: "ellie-testing-food-requests",
    title: "5 random requests for food",
  },
  {
    id: "ellie-testing-chase-mouse",
    title: "Chase mouse but do not dispatch",
  },
  {
    id: "ellie-testing-feign-enthusiasm",
    title: "Feign lack of enthusiasm",
  },
];

type CareCircleEntitlement = {
  max_active_subjects: number;
  plan_id: string;
  plan_name: string;
};

type CareCircleMembership = {
  care_circle_id: string;
  created_at?: string | null;
  role?: string | null;
};

type AppointmentNote = {
  id: string;
  appointment_id: string;
  summary_short: string | null;
  takeaways: unknown;
  followups: unknown;
  is_current: boolean;
  version_number: number;
  superseded_at: string | null;
  superseded_by_note_id: string | null;
};

type CarePrepGuidance = {
  id: string;
  appointment_id: string;
  generated_at: string | null;
  summary: string | null;
  key_questions: unknown;
  bring_list: unknown;
  watchouts: unknown;
  med_review?: unknown;
  since_last_visit?: unknown;
  next_steps?: unknown;
  is_current: boolean;
  version_number: number;
  review_status: string | null;
  source: string | null;
  superseded_at: string | null;
  superseded_by_guidance_id: string | null;
  edited_from_guidance_id: string | null;
  ai_generated_guidance_id: string | null;
};

type AppointmentCommunicationSummaryRow = {
  appointment_id: string;
  generation_status: string | null;
  summary_items: unknown;
  summary_version: number | null;
};

type DetailListItem =
  | string
  | (WhatToKnowDisplayItem & {
      sourceTypes?: WhatToKnowSourceType[];
    });

function mergeLoadedAppointmentCommunicationSummaries({
  appointmentIds,
  currentSummaries,
  loadedSummaries,
}: {
  appointmentIds: string[];
  currentSummaries: AppointmentCommunicationSummaryRow[];
  loadedSummaries: AppointmentCommunicationSummaryRow[];
}) {
  const loadedByAppointmentId = new Map(
    loadedSummaries.map((summary) => [summary.appointment_id, summary])
  );
  const appointmentIdSet = new Set(appointmentIds);
  const merged = currentSummaries.filter((summary) => {
    if (!appointmentIdSet.has(summary.appointment_id)) {
      return true;
    }

    if (loadedByAppointmentId.has(summary.appointment_id)) {
      return false;
    }

    return normalizeAppointmentCommunicationInventory(summary.summary_items).items.some(
      (item) => item.status === "active"
    );
  });

  for (const summary of loadedSummaries) {
    merged.push(summary);
  }

  return merged;
}

type AiInstructionSet = {
  id: string;
  instruction_key: string;
  name: string;
  description: string | null;
};

const getEntryHostMode = () =>
  typeof window !== "undefined" &&
  window.location.hostname.toLowerCase() === "app.carepland.com"
    ? "app"
    : "public";

const subscribeEntryHostMode = () => () => {};

type SupportAssistantResult = {
  answer: string;
  category: string;
  confidence: number;
  escalationRecommended: boolean;
  escalationReason: string;
  interactionId: string;
  priority: SupportTicketPriority;
  suggestedNextStep: string;
};

type AskConversationMessage = {
  body: string;
  role: "assistant" | "user";
};

const defaultAskRoutingSettings: AskRoutingSettings = {
  auto_create_min_confidence: 0.9,
  auto_route_enabled: false,
  clarify_absolute_max_turns: 5,
  clarify_default_max_turns: 3,
};

type SupportAssistantInteraction = {
  id: string;
  assistant_answer: string;
  category: string;
  confidence: number;
  context: Record<string, unknown> | null;
  created_at: string;
  current_page: string | null;
  escalation_reason: string;
  escalation_recommended: boolean;
  instruction_version_id: string | null;
  model: string | null;
  outcome: SupportAssistantOutcome;
  priority: SupportTicketPriority;
  profiles?: {
    display_name: string | null;
    email: string | null;
    family_name: string | null;
    given_name: string | null;
  } | null;
  prompt_version: string | null;
  question_body: string;
  question_subject: string;
  raw_response: Record<string, unknown> | null;
  suggested_next_step: string;
  ticket_id: string | null;
  updated_at: string;
  user_feedback: string | null;
  user_id: string;
};

type SupportAssistantAdminReview = {
  id: string;
  admin_note: string;
  created_at: string;
  interaction_id: string;
  recommended_action: string | null;
  review_status: SupportAssistantReviewStatus;
  reviewer_user_id: string;
  updated_at: string;
};

type SupportAssistantAnalysisResult = {
  id: string;
  analysisSummary: string;
  failurePatterns: string[];
  promptRecommendations: string[];
  recommendations: string[];
  strengths: string[];
  uiRecommendations: string[];
};

type SupportAssistantAnalysisRun = {
  id: string;
  admin_note: string | null;
  admin_status: SupportAssistantAnalysisStatus;
  analysis_summary: string;
  created_at: string;
  criteria: Record<string, unknown> | null;
  failure_patterns: string[];
  interaction_count: number;
  interaction_ids: string[];
  model: string;
  prompt_recommendations: string[];
  prompt_versions: string[];
  recommendations: string[];
  requested_by_user_id: string;
  strengths: string[];
  ui_recommendations: string[];
  updated_at: string;
};

type AppointmentView = "archived" | "logged" | "upcoming";
type AiAdminTab =
  | "audioProfile"
  | "agentKnowledge"
  | "appearance"
  | "history"
  | "instructions"
  | "inventory"
  | "proposals";
type AdminTab =
  | "connect"
  | "dashboard"
  | "ai"
  | "assistantReview"
  | "content"
  | "errors"
  | "intake"
  | "product"
  | "recommendations"
  | "tickets"
  | "tools"
  | "userAudit"
  | "users";
type StoredAdminTab = AdminTab | "messages";
type AuthMode = "reset" | "signIn" | "signUp" | "updatePassword";
type AppointmentPanel = "add" | "quickAdd";
type MainTab = "admin" | "appointments" | "home" | "profile";
type PendingImportLeaveAction =
  | { kind: "appointmentPanel"; panel: AppointmentPanel }
  | { kind: "appointmentView"; view: AppointmentView }
  | { kind: "ask" };
type SupportAssistantOutcome =
  | "answered"
  | "escalated"
  | "helpful"
  | "not_helpful";
type SupportAssistantReviewStatus =
  | "good_answer"
  | "needs_prompt_work"
  | "needs_review"
  | "needs_ui_work"
  | "not_actionable"
  | "should_escalate";
type SupportAssistantAnalysisStatus =
  | "accepted"
  | "needs_more_data"
  | "new"
  | "rejected"
  | "reviewed";
type PendingModifierSwitch = {
  appointmentId: string;
  target: AppointmentModifier | "careprep" | null;
  targetAppointmentId?: string | null;
};
type ToastState = {
  actionLabel?: string;
  durationMs?: number;
  id: number;
  message: string;
  onAction?: () => void;
  type?: "error" | "info" | "success" | "warning";
};

type TextIntakeMatch = {
  appointment: Appointment;
  currentNote: AppointmentNote | null;
  reasons: string[];
  score: number;
};

type ImportAnythingItemKind =
  | "appointment"
  | "careprep"
  | "medication_change"
  | "note"
  | "provider"
  | "question"
  | "task";
type ImportAnythingReviewStatus = "approved" | "needs_review" | "rejected";
type ImportAnythingReviewItem = {
  createsNewAppointment: boolean;
  confidence: number;
  fields: Record<string, string>;
  id: string;
  ownerClusterId: string;
  ownerCareSubjectId: string;
  ownerConfidence: number;
  ownerDetectedName: string;
  ownerNeedsReview: boolean;
  ownerNewPersonName: string;
  ownerRationale: string;
  kind: ImportAnythingItemKind;
  matchedAppointmentId: string;
  matchedProviderId: string;
  needsReview: boolean;
  providerMatchNote: string;
  sourceExcerpt: string;
  status: ImportAnythingReviewStatus;
  summary: string;
  title: string;
  userReviewed?: boolean;
};

type ImportAnythingPersonAssignment = {
  clusterId: string;
  confidence: number;
  detectedName: string;
  matchedCareSubjectId: string;
  needsReview: boolean;
  rationale: string;
  suggestedNewPersonName: string;
};

type ImportAnythingOwnershipCluster = {
  clusterId: string;
  confidence: number;
  displayName: string;
  entityType: string;
  matchedCareSubjectId: string;
  rationale: string;
  suggestedNewPersonName: string;
};

type ImportAnythingIdentityResolutionChoice = {
  action: "" | "create" | "leave_unresolved" | "match";
  clusterId: string;
  createName: string;
  detectedName: string;
  editingPetSpecies: boolean;
  managedByHousehold: boolean;
  matchedCareSubjectId: string;
  otherPetType: string;
  petKind: ImportAnythingPetKind;
  subjectType: string;
};

type ImportAnythingPetKind = "cat" | "dog" | "other";

type ImageTextExtractionResult = {
  errorMessage?: string;
  extractedCount: number;
};

type AppointmentDetailChange = {
  currentValue: string;
  field:
    | "location_address"
    | "location_name"
    | "location_phone"
    | "provider_name"
    | "provider_organization";
  label: string;
  newValue: string;
};

type SampleDataStatus = {
  appointments_created?: number;
  declined_at?: string | null;
  email?: string | null;
  seed_version?: string | null;
  seeded_at?: string | null;
  status: string;
  user_id?: string | null;
};

type StoredUiState = {
  adminTab?: StoredAdminTab;
  aiAdminTab?: AiAdminTab;
  mainTab?: MainTab;
  selectedAiWorkflow?: AiWorkflowKey;
  selectedAppContentCategory?: string;
  selectedAppContentKey?: string;
  selectedProductMgmtSection?: string;
};

type AppointmentsPageViewState = {
  activeAppointmentPanel?: AppointmentPanel | null;
  appointmentView?: AppointmentView;
  expandedCarePrepIds?: Record<string, boolean>;
  expandedMessagesAppointmentId?: string | null;
  expandedVisitNotesAppointmentId?: string | null;
  scrollY?: number;
  selectedSubjectId?: string;
};

type AppointmentsSessionSnapshot = {
  appointmentPool: Appointment[];
  careSubjects: CareSubject[];
  entitlement: CareCircleEntitlement;
  savedAt: string;
};

type StoredDraftState = {
  appointmentMessageDraft?: AppointmentMessageComposerDraft | null;
  appointmentDrafts?: Record<string, typeof emptyAppointmentDraft>;
  bulkAppointmentDrafts?: BulkAppointmentDraft[];
  bulkAppointmentSummary?: string;
  carePrepDrafts?: Record<string, typeof emptyCarePrepDraft>;
  contextualTextIntakeValue?: string;
  editingAppointmentIds?: Record<string, boolean>;
  editingCarePrepIds?: Record<string, boolean>;
  editingNoteIds?: Record<string, boolean>;
  importAnythingIntakeItemId?: string | null;
  confirmingImportAnythingSaveAll?: boolean;
  importAnythingReviewOpen?: boolean;
  importAnythingItems?: ImportAnythingReviewItem[];
  importAnythingIdentityResolutionChoices?: ImportAnythingIdentityResolutionChoice[];
  importAnythingIdentityResolutionOpen?: boolean;
  importAnythingOwnershipClusters?: ImportAnythingOwnershipCluster[];
  importAnythingOwnerPersonId?: string;
  importAnythingPersonAssignment?: ImportAnythingPersonAssignment | null;
  importAnythingNewPersonName?: string;
  importAnythingSources?: string[];
  importAnythingSummary?: string;
  newAppointmentDraft?: {
    locationAddress: string;
    locationName: string;
    locationPhone: string;
    providerName: string;
    providerOrganization: string;
    reason: string;
    startsAt: string;
    subjectId: string;
    title: string;
  };
  noteDrafts?: Record<string, typeof emptyNoteDraft>;
  textIntakeAiDraft?: IntakeReviewDraftContent | null;
  textIntakeDraft?: IntakeReviewDraftContent | null;
  textIntakeItemId?: string | null;
  textIntakeMatches?: TextIntakeMatch[];
  selectedTextIntakeMatchId?: string;
  textIntakeSubjectId?: string;
  textIntakeTargetAppointmentId?: string | null;
  textIntakeValue?: string;
};

const ALL_SUBJECTS = allCarePlandFocusValue;
const ACCOUNT_PROFILE_PERSON_ID = "account";
const appUiStateStorageKey = carePlandUiStateStorageKey;
const appDraftStateStorageKey = "carepland-draft-state:v1";
const appointmentsSessionSnapshotStorageKey =
  "carepland-appointments-session-snapshot:v1";
const healthFocusSummaryCacheStoragePrefix =
  "carepland-health-focus-summary-cache:v1";
const appLastActivityStorageKey = "carepland-last-activity-at:v1";
const homeAutoCarePrepAttemptStoragePrefix =
  "carepland-home-auto-careprep-attempted:v1";

const defaultEntitlement: CareCircleEntitlement = {
  max_active_subjects: 1,
  plan_id: "personal",
  plan_name: "Free",
};

function primaryCareCircleIdFromMemberships(
  memberships: CareCircleMembership[] | null | undefined
) {
  return [...(memberships ?? [])]
    .filter((membership) => Boolean(membership.care_circle_id))
    .sort((left, right) => {
      const leftRoleRank = left.role === "owner" ? 0 : 1;
      const rightRoleRank = right.role === "owner" ? 0 : 1;

      if (leftRoleRank !== rightRoleRank) {
        return leftRoleRank - rightRoleRank;
      }

      return String(left.created_at ?? "").localeCompare(
        String(right.created_at ?? "")
      );
    })[0]?.care_circle_id ?? null;
}

function careSubjectAvatarPerson(
  subject?: CareSubject | null
): AvatarPerson | null {
  if (!subject) {
    return null;
  }

  return {
    avatarAltText: subject.avatarAltText,
    avatarEmoji: subject.avatarEmoji,
    avatarType: subject.avatarType,
    avatarUrl: subject.avatarUrl,
    displayName: subject.display_name,
    managedByHousehold: isManagedByHouseholdSubject(subject),
  };
}

function defaultPetAvatarEmoji(subject?: Pick<CareSubject, "display_name" | "subject_type"> | null) {
  const subjectType = subject?.subject_type?.trim().toLowerCase() ?? "";

  if (subjectType === "cat") {
    return "🐱";
  }

  if (subjectType === "dog") {
    return "🐶";
  }

  if (subjectType === "pet" || subjectType.startsWith("pet:")) {
    return "🐾";
  }

  return null;
}

function isPetSubjectType(subjectType?: string | null) {
  const normalizedSubjectType = subjectType?.trim().toLowerCase() ?? "";

  return (
    normalizedSubjectType === "cat" ||
    normalizedSubjectType === "dog" ||
    normalizedSubjectType === "pet" ||
    normalizedSubjectType.startsWith("pet:")
  );
}

function isManagedByHouseholdSubject(
  subject?: Pick<CareSubject, "managed_by_household" | "subject_type"> | null
) {
  return Boolean(subject?.managed_by_household) || isPetSubjectType(subject?.subject_type);
}

function importAnythingPetKindFromSubjectType(
  subjectType?: string | null
): ImportAnythingPetKind {
  const normalizedSubjectType = subjectType?.trim().toLowerCase() ?? "";

  if (normalizedSubjectType === "dog") {
    return "dog";
  }

  if (normalizedSubjectType === "pet" || normalizedSubjectType.startsWith("pet:")) {
    return "other";
  }

  return "cat";
}

function importAnythingPetLabel(kind: ImportAnythingPetKind, otherValue: string) {
  if (kind === "cat") {
    return "Cat";
  }

  if (kind === "dog") {
    return "Dog";
  }

  return otherValue.trim() || "Pet";
}

function importAnythingPetSubjectType(
  kind: ImportAnythingPetKind,
  otherValue: string
) {
  if (kind === "cat" || kind === "dog") {
    return kind;
  }

  const customType = otherValue.trim();

  return customType ? `pet:${customType}` : "pet";
}

function careSubjectDisplayLabel(subject: CareSubject) {
  return `${subject.display_name}${isManagedByHouseholdSubject(subject) ? " ♥" : ""}`;
}

function homeTestingTodayFocusItemsForSubject(subject: CareSubject) {
  return subject.display_name.trim().toLowerCase() === "ellie"
    ? ellieTestingTodayFocusItems
    : [];
}

function possessiveName(name: string) {
  const trimmedName = name.trim() || "Care VIP";
  return /s$/i.test(trimmedName) ? `${trimmedName}'` : `${trimmedName}'s`;
}

function nextAppointmentTitleForSubject(subject?: CareSubject | null) {
  if (!subject) {
    return "Next appointment";
  }

  return subject.is_default
    ? "Next appointment for you"
    : `Next appointment for ${subject.display_name}`;
}

function buildHomeAtAGlanceSummary({
  appointments,
  careSubjects,
  carePrepHistory,
  hasAnySavedAppointments,
  healthFocusTopics,
  homeNextAppointment,
  homeNextAppointmentsBySubjectId,
  homeNextGuidance,
  homeTodayFocusGroups,
  notesReminderAppointment,
  selectedSubjectId,
}: {
  appointments: Appointment[];
  careSubjects: CareSubject[];
  carePrepHistory: CarePrepHistoryRow[];
  hasAnySavedAppointments: boolean;
  healthFocusTopics: HealthFocusTopicSummary[];
  homeNextAppointment: Appointment | null;
  homeNextAppointmentsBySubjectId: Record<string, Appointment | null>;
  homeNextGuidance: CarePrepGuidance | null;
  homeTodayFocusGroups: HomeTodayFocusGroup[];
  notesReminderAppointment: NotesReminderAppointment | null;
  selectedSubjectId: string;
}): HomeAtAGlanceSummary {
  const isEveryone = selectedSubjectId === ALL_SUBJECTS;
  const now = new Date();
  const startOfPast30Days = new Date(now);
  startOfPast30Days.setDate(startOfPast30Days.getDate() - 30);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const focusItemCount = homeTodayFocusGroups.reduce(
    (total, group) => total + group.items.length,
    0
  );
  const nextAppointmentCount = isEveryone
    ? careSubjects.filter((subject) => homeNextAppointmentsBySubjectId[subject.id])
        .length
    : homeNextAppointment
      ? 1
      : 0;
  const appointmentDate = (appointment: Appointment) =>
    appointment.starts_at ? new Date(appointment.starts_at) : null;
  const appointmentsSince = (startDate: Date) =>
    appointments.filter((appointment) => {
      const startsAt = appointmentDate(appointment);

      return (
        startsAt &&
        Number.isFinite(startsAt.getTime()) &&
        startsAt >= startDate &&
        !appointment.archived_at &&
        !appointment.deleted_at
      );
    });
  const past30DayAppointments = appointmentsSince(startOfPast30Days);
  const yearAppointments = appointmentsSince(startOfYear);
  const currentCarePrepCount = carePrepHistory.filter(
    (item) => item.is_current !== false
  ).length;
  const estimatedCoordinationAvoided = Math.max(
    0,
    Math.min(12, currentCarePrepCount + healthFocusTopics.length + focusItemCount)
  );
  const testOnlyPrefix = (count: number) => (count > 0 ? "" : "(test) ");
  const items: string[] = [];

  if (nextAppointmentCount > 1) {
    items.push(
      `CarePland organized the next appointment context for ${nextAppointmentCount} Care VIPs.`
    );
  } else if (nextAppointmentCount === 1) {
    items.push("CarePland organized the next appointment before it was needed.");
  }

  if (homeNextGuidance) {
    items.push("CarePrep identified visit context before the next appointment.");
  }

  if (healthFocusTopics.length > 0) {
    items.push(
      `Health Stories made ${healthFocusTopics.length} recurring care ${
        healthFocusTopics.length === 1 ? "theme" : "themes"
      } easier to recognize.`
    );
  }

  if (focusItemCount > 0) {
    items.push(
      `Today's Focus kept ${focusItemCount} care ${
        focusItemCount === 1 ? "prompt" : "prompts"
      } in view without extra searching.`
    );
  }

  if (hasAnySavedAppointments && !notesReminderAppointment) {
    items.push("No visit-note follow-up is waiting for the current appointment history.");
  }

  if (items.length === 0) {
    items.push(
      "Add appointments, notes, Focus items, or Health Stories to give CarePland real outcomes to summarize."
    );
  }
  const monthItems = [
    `${testOnlyPrefix(past30DayAppointments.length)}CarePland kept appointment context organized for ${past30DayAppointments.length} appointment${
      past30DayAppointments.length === 1 ? "" : "s"
    } in the past 30 days.`,
    `${testOnlyPrefix(currentCarePrepCount)}CarePrep prepared context for ${currentCarePrepCount} appointment${
      currentCarePrepCount === 1 ? "" : "s"
    } without rebuilding the visit history by hand.`,
    `${testOnlyPrefix(healthFocusTopics.length)}Health Stories helped connect ${healthFocusTopics.length} recurring care ${
      healthFocusTopics.length === 1 ? "theme" : "themes"
    } for the current Care VIP.`,
    `${testOnlyPrefix(focusItemCount)}Today's Focus kept ${focusItemCount} care ${
      focusItemCount === 1 ? "prompt" : "prompts"
    } surfaced for the current Home view.`,
  ];
  const yearItems = [
    `${testOnlyPrefix(yearAppointments.length)}CarePland organized appointment information for ${yearAppointments.length} appointment${
      yearAppointments.length === 1 ? "" : "s"
    } this year.`,
    "(test) Connect, Family, Errands, reminders, and completed Focus history will contribute here as those summary signals mature.",
  ];

  return {
    historySections: [
      {
        estimates:
          estimatedCoordinationAvoided > 0
            ? [
                `Estimated coordination avoided: roughly ${estimatedCoordinationAvoided} call${
                  estimatedCoordinationAvoided === 1 ? "" : "s"
                }, text${
                  estimatedCoordinationAvoided === 1 ? "" : "s"
                }, or follow-up conversation${
                  estimatedCoordinationAvoided === 1 ? "" : "s"
                }.`,
              ]
            : [],
        items: monthItems,
        title: "Past 30 Days",
      },
      {
        estimates:
          yearAppointments.length > 0
            ? [
                `Estimated information lookup avoided: appointment context is organized for ${yearAppointments.length} appointment${
                  yearAppointments.length === 1 ? "" : "s"
                } loaded in this view.`,
              ]
            : [],
        items: yearItems,
        title: "This Year",
      },
    ],
    items: items.slice(0, 4),
    subtitle:
      "Admin test preview. Future versions should appear occasionally and be dismissed after reading.",
    title: "CarePland at a Glance",
  };
}

function isDefaultPetAvatarUrl(avatarUrl?: string | null) {
  return ["/avatar-cat.svg", "/avatar-dog.svg", "/avatar-pet.svg"].includes(
    avatarUrl ?? ""
  );
}

function isMissingCareSubjectOptionalColumn(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown };
  const message = String(maybeError.message || "").toLowerCase();

  return (
    maybeError.code === "42703" ||
    message.includes("avatar_") ||
    message.includes("managed_by_household")
  );
}

function authProviderFromUser(
  user: { app_metadata?: { provider?: unknown; providers?: unknown } } | null
) {
  const provider = user?.app_metadata?.provider;

  if (typeof provider === "string" && provider.trim()) {
    return provider.trim().toLowerCase();
  }

  const providers = user?.app_metadata?.providers;

  if (Array.isArray(providers)) {
    const firstProvider = providers.find(
      (item): item is string => typeof item === "string" && Boolean(item.trim())
    );

    if (firstProvider) {
      return firstProvider.trim().toLowerCase();
    }
  }

  return "email";
}

function homeAutoCarePrepAttemptStorageKey(appointmentId: string) {
  return `${homeAutoCarePrepAttemptStoragePrefix}:${appointmentId}`;
}

function appointmentProviderHeaderLabel(appointment: Appointment) {
  const structuredProvider =
    appointment.provider_name?.trim() ||
    appointment.provider_organization?.trim() ||
    "";

  if (structuredProvider) {
    return structuredProvider;
  }

  const reason = appointment.reason?.trim() ?? "";
  const providerMatch = reason.match(
    /^provider:\s*(.+?)(?:\s+(?:bring|arrive|complete|call|check|upload|wear|fast|take)\b|[\n.]|$)/i
  );

  return providerMatch?.[1]?.trim() ?? "";
}

function isEligibleForHomeAutoCarePrep(appointment: Appointment) {
  const text = [
    appointment.title,
    appointment.reason,
    appointment.provider_name,
    appointment.provider_organization,
    appointment.location_name,
    appointment.location_address,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!text.trim()) {
    return false;
  }

  const ineligiblePattern =
    /\b(tax|accountant|accounting|cpa|irs|legal|lawyer|attorney|financial|finance|bank|banking|investment|haircut|hair cut|salon|barber|car service|auto service|oil change|mechanic)\b/;
  const genericOtherPattern = /^(other|generic other)$/;

  if (ineligiblePattern.test(text)) {
    return false;
  }

  if (
    genericOtherPattern.test(String(appointment.title ?? "").trim().toLowerCase()) ||
    genericOtherPattern.test(String(appointment.reason ?? "").trim().toLowerCase())
  ) {
    return false;
  }

  return /\b(primary care|pcp|family medicine|internal medicine|doctor|physician|medical|specialist|cardiology|cardiologist|orthopedic|orthopedics|ortho|physical therapy|physio|occupational therapy|speech therapy|therapy|therapist|pt|dental|dentist|orthodont|vision|optom|ophthalm|eye exam|hearing|audiology|audiologist|imaging|radiology|x-?ray|mri|ct scan|ultrasound|mammogram|lab|labs|blood work|bloodwork|veterinary|veterinarian|vet|animal hospital|hospital|clinic)\b/.test(
    text
  );
}

const defaultAgentKnowledgeAutomationSettings: AgentKnowledgeAutomationSettings = {
  auto_generation_enabled: false,
  background_generation_period_days: 7,
  feedback_clustering_enabled: true,
  feedback_min_admin_flags: 1,
  feedback_min_not_helpful_count: 3,
  feedback_push_to_proposal_enabled: true,
  feedback_window_days: 14,
  scheduled_checks_enabled: false,
  settings_key: "default",
  severity_threshold: "medium",
  software_update_checks_enabled: true,
  updated_at: "",
};

const betaAgreementVersion = "beta-2026-05-19";
const currentWelcomeGuideVersion = "welcome-2026-05-23";
const fallbackTimeZone = "America/Los_Angeles";

const timeZoneOptions = [
  { label: "Eastern", value: "America/New_York" },
  { label: "Central", value: "America/Chicago" },
  { label: "Mountain", value: "America/Denver" },
  { label: "Arizona", value: "America/Phoenix" },
  { label: "Pacific", value: "America/Los_Angeles" },
  { label: "Alaska", value: "America/Anchorage" },
  { label: "Hawaii", value: "Pacific/Honolulu" },
  { label: "UTC", value: "UTC" },
];

const emptyTextIntakeDraft: IntakeReviewDraftContent = {
  appointmentReason: "",
  appointmentTitle: "",
  confidence: 0,
  followups: "",
  locationAddress: "",
  locationName: "",
  locationPhone: "",
  notesSummary: "",
  providerName: "",
  providerOrganization: "",
  startsAt: "",
  suggestedAction: "",
  takeaways: "",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const productionAppUrl = "https://app.carepland.com";
const generatedBuildNumberFallback = generatedBuildNumber || "Unknown";
const careplandBuildNumber =
  process.env.NEXT_PUBLIC_CAREPLAND_BUILD_NUMBER ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
  generatedBuildNumberFallback;
const careplandBuildDttm =
  process.env.NEXT_PUBLIC_CAREPLAND_BUILD_DTTM ?? generatedBuildDttm;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const possibleMessage = "message" in error ? String(error.message) : "";
    const possibleCode = "code" in error ? String(error.code) : "";

    if (possibleMessage || possibleCode) {
      return [possibleCode, possibleMessage].filter(Boolean).join(": ");
    }

    return JSON.stringify(error);
  }

  return String(error || "Something went wrong.");
}

function importAnythingAppointmentChoiceLabel(appointment: Appointment) {
  const dateLabel = appointment.starts_at
    ? formatDate(appointment.starts_at)
    : "Date not saved";
  const title = appointment.title?.trim() || "Appointment";
  const context = [
    appointment.provider_name,
    appointment.provider_organization,
    appointment.location_name,
  ]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" • ");

  return [dateLabel, title, context].filter(Boolean).join(" · ");
}

async function parseApiResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  const responseText = await response.text();
  let parsedBody: unknown = {};

  if (responseText.trim()) {
    try {
      parsedBody = JSON.parse(responseText);
    } catch {
      if (!response.ok) {
        throw new Error(responseText.trim() || fallbackMessage);
      }

      throw new Error(fallbackMessage);
    }
  }

  if (!response.ok) {
    const errorMessage =
      parsedBody &&
      typeof parsedBody === "object" &&
      "error" in parsedBody &&
      typeof parsedBody.error === "string"
        ? parsedBody.error
        : responseText.trim() || fallbackMessage;

    throw new Error(errorMessage);
  }

  return parsedBody as T;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function getAuthErrorMessage(error: unknown): string {
  const rawMessage = getErrorMessage(error).toLowerCase();

  if (
    rawMessage.includes("auth session missing") ||
    rawMessage.includes("missing an active recovery session")
  ) {
    return "This reset link is missing an active recovery session. Please request a fresh password reset email and use the newest link.";
  }

  if (rawMessage.includes("invalid login credentials")) {
    return "Incorrect email or password. Please try again or reset your password.";
  }

  if (rawMessage.includes("email not confirmed")) {
    return "This account exists, but the email address still needs to be confirmed. Check your inbox and junk folder for the confirmation email.";
  }

  if (
    rawMessage.includes("user already registered") ||
    rawMessage.includes("already been registered") ||
    rawMessage.includes("already exists")
  ) {
    return "An account already exists for this email. Sign in instead, or reset the password.";
  }

  if (
    rawMessage.includes("same password") ||
    rawMessage.includes("different from the old") ||
    rawMessage.includes("different from your old") ||
    rawMessage.includes("should be different")
  ) {
    return "Choose a new password that is different from your current password.";
  }

  if (
    rawMessage.includes("weak password") ||
    rawMessage.includes("at least") ||
    rawMessage.includes("minimum") ||
    rawMessage.includes("characters")
  ) {
    return "Use a password with at least 8 characters and try again.";
  }

  if (rawMessage.includes("password")) {
    return "The password was not accepted. Try a different password.";
  }

  if (rawMessage.includes("rate limit") || rawMessage.includes("too many")) {
    return "Too many attempts. Please wait a little while before trying again.";
  }

  return getErrorMessage(error);
}

function logAuthError(action: string, error: unknown) {
  console.error("Supabase auth error", {
    action,
    error,
  });
}

function isImportAnythingProviderStoreUnavailable(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  const message = maybeError?.message?.toLowerCase() ?? "";

  return (
    maybeError?.code === "42P01" ||
    maybeError?.code === "42703" ||
    message.includes("care_providers")
  );
}

function hasImportAnythingProviderIdentity(item: ImportAnythingReviewItem) {
  return Boolean(
    item.fields.providerName?.trim() || item.fields.providerOrganization?.trim()
  );
}

const matchStopWords = new Set([
  "about",
  "after",
  "assessment",
  "appointment",
  "associated",
  "clinic",
  "continue",
  "current",
  "discussed",
  "followed",
  "follow",
  "followup",
  "history",
  "improved",
  "intermittent",
  "medication",
  "notes",
  "orders",
  "patient",
  "physical",
  "placed",
  "plan",
  "prior",
  "review",
  "reviewed",
  "scheduled",
  "symptoms",
  "today",
  "treatment",
  "visit",
  "with",
]);

function textTokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 3 && !matchStopWords.has(token))
  );
}

function sharedTokenCount(left: Set<string>, right: Set<string>): number {
  let count = 0;

  left.forEach((token) => {
    if (right.has(token)) {
      count += 1;
    }
  });

  return count;
}

function fieldTokenOverlap(
  left: string | null | undefined,
  right: string | null | undefined
): number {
  return sharedTokenCount(textTokens(left ?? ""), textTokens(right ?? ""));
}

function appointmentDetailChanges(
  appointment: Appointment,
  draft: IntakeReviewDraftContent
): AppointmentDetailChange[] {
  const fields: Array<{
    currentValue: string | null;
    field: AppointmentDetailChange["field"];
    label: string;
    newValue: string;
  }> = [
    {
      currentValue: appointment.provider_name,
      field: "provider_name",
      label: "Provider",
      newValue: draft.providerName,
    },
    {
      currentValue: appointment.provider_organization,
      field: "provider_organization",
      label: "Practice",
      newValue: draft.providerOrganization,
    },
    {
      currentValue: appointment.location_name,
      field: "location_name",
      label: "Location name",
      newValue: draft.locationName,
    },
    {
      currentValue: appointment.location_address,
      field: "location_address",
      label: "Address",
      newValue: draft.locationAddress,
    },
    {
      currentValue: appointment.location_phone,
      field: "location_phone",
      label: "Phone",
      newValue: draft.locationPhone,
    },
  ];

  return fields
    .map((item) => ({
      ...item,
      currentValue: item.currentValue?.trim() ?? "",
      newValue: item.newValue.trim(),
    }))
    .filter(
      (item) =>
        item.newValue &&
        item.currentValue.toLowerCase() !== item.newValue.toLowerCase()
    );
}

function dayDifference(left: string | null, right: string): number | null {
  if (!left || !right) {
    return null;
  }

  const leftDate = new Date(left);
  const rightDate = new Date(right);

  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) {
    return null;
  }

  return Math.abs(
    Math.round(
      (leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60 * 24)
    )
  );
}

function googleMapsUrl(address: string | null): string | null {
  if (!address?.trim()) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address.trim()
  )}`;
}

function isLikelyPlaceholderAddress(address: string | null) {
  const normalizedAddress = address?.trim().toLowerCase() ?? "";

  if (!normalizedAddress) {
    return true;
  }

  return (
    normalizedAddress === "123 main st" ||
    normalizedAddress === "123 main street" ||
    normalizedAddress === "test" ||
    normalizedAddress === "demo" ||
    normalizedAddress === "sample" ||
    normalizedAddress.includes("placeholder")
  );
}

function canShowAppointmentAddress(
  appointment?: Pick<Appointment, "is_sample_data" | "location_address"> | null
) {
  return Boolean(
    appointment?.location_address?.trim() &&
      !appointment.is_sample_data &&
      !isLikelyPlaceholderAddress(appointment.location_address)
  );
}

function appointmentGoogleMapsUrl(
  appointment?: Pick<Appointment, "is_sample_data" | "location_address"> | null
) {
  return canShowAppointmentAddress(appointment)
    ? googleMapsUrl(appointment?.location_address ?? null)
    : null;
}

function agicalUrl(appointment: Appointment): string | null {
  if (!appointment.starts_at || !appointment.title?.trim()) {
    return null;
  }

  const startsAt = new Date(appointment.starts_at);

  if (Number.isNaN(startsAt.getTime())) {
    return null;
  }

  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const description = [
    appointment.provider_name ? `Provider: ${appointment.provider_name}` : "",
    appointment.provider_organization
      ? `Practice: ${appointment.provider_organization}`
      : "",
    appointment.reason ? `Reason: ${appointment.reason}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const params = new URLSearchParams({
    dtend: endsAt.toISOString(),
    dtstart: startsAt.toISOString(),
    reminder: "30",
    subject: appointment.title.trim(),
  });

  if (appointment.location_address?.trim()) {
    params.set("location", appointment.location_address.trim());
  }

  if (description) {
    params.set("description", description);
  }

  return `https://ics.agical.io/?${params.toString()}`;
}

async function hashInstructionContent({
  model,
  outputSchema,
  systemPrompt,
  temperature,
  userPrompt,
}: {
  model: string;
  outputSchema: unknown;
  systemPrompt: string;
  temperature: number;
  userPrompt: string;
}): Promise<string> {
  const payload = JSON.stringify({
    model: model.trim(),
    outputSchema,
    systemPrompt,
    temperature,
    userPrompt,
  });
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Date not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateOnly(value: string | null): string {
  if (!value) {
    return "Date not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(`${value}T12:00:00`));
}

function toDatetimeLocalValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function stringArrayFromJson(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function supportAnalysisStatusLabel(status: SupportAssistantAnalysisStatus) {
  return status.replaceAll("_", " ");
}

function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function isTodayOrFutureDate(value: string): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date >= startOfToday();
}

type BrowserTimezoneDetection = {
  detectedTimezone: string;
  fallbackUsed: boolean;
  timezone: string;
};

function browserTimezone(): BrowserTimezoneDetection {
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (
    detectedTimezone &&
    timeZoneOptions.some((option) => option.value === detectedTimezone)
  ) {
    return {
      detectedTimezone,
      fallbackUsed: false,
      timezone: detectedTimezone,
    };
  }

  const fallbackTimezone = timeZoneOptions.some((option) => option.value === fallbackTimeZone)
    ? fallbackTimeZone
    : timeZoneOptions[0]?.value ?? "";

  return {
    detectedTimezone: detectedTimezone || "",
    fallbackUsed: Boolean(detectedTimezone),
    timezone: fallbackTimezone,
  };
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function sampleDataStatusFromValue(value: unknown): SampleDataStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "unknown" };
  }

  const row = value as Record<string, unknown>;

  return {
    appointments_created:
      typeof row.appointments_created === "number"
        ? row.appointments_created
        : undefined,
    declined_at:
      typeof row.declined_at === "string" ? row.declined_at : null,
    email: typeof row.email === "string" ? row.email : null,
    seed_version:
      typeof row.seed_version === "string" ? row.seed_version : null,
    seeded_at: typeof row.seeded_at === "string" ? row.seeded_at : null,
    status: typeof row.status === "string" ? row.status : "unknown",
    user_id: typeof row.user_id === "string" ? row.user_id : null,
  };
}

function sampleDataStatusText(status: SampleDataStatus | null): string {
  if (!status) {
    return "Enter a user email to check sample data status.";
  }

  if (status.status === "already_seeded") {
    return `Sample data was already added${
      status.seeded_at ? ` on ${formatDate(status.seeded_at)}` : ""
    }.`;
  }

  if (status.status === "declined") {
    return `This user declined sample data${
      status.declined_at ? ` on ${formatDate(status.declined_at)}` : ""
    }.`;
  }

  if (status.status === "available") {
    return "Sample data can be added for this user.";
  }

  if (status.status === "seeded") {
    return `Sample data added${
      status.appointments_created
        ? `: ${status.appointments_created} appointments created`
        : ""
    }.`;
  }

  if (status.status === "missing_care_circle") {
    return "This user needs to finish account setup before sample data can be added.";
  }

  if (status.status === "no_profile") {
    return "No profile was found for that email.";
  }

  return `Sample data status: ${status.status}`;
}

function authRedirectUrl(): string | undefined {
  const normalizeCarePlandAuthUrl = (value: string) => {
    try {
      const parsedUrl = new URL(value);
      const hostname = parsedUrl.hostname.toLowerCase();

      if (
        hostname === "carepland.com" ||
        hostname === "www.carepland.com" ||
        hostname === "app.carepland.com" ||
        hostname === "carepland-pers.vercel.app"
      ) {
        return productionAppUrl;
      }

      return parsedUrl.origin;
    } catch {
      return value;
    }
  };

  if (appUrl) {
    return normalizeCarePlandAuthUrl(appUrl);
  }

  if (typeof window === "undefined") {
    return productionAppUrl;
  }

  if (window.location.hostname === "localhost") {
    return undefined;
  }

  return normalizeCarePlandAuthUrl(window.location.origin);
}

function passwordResetRedirectUrl(): string | undefined {
  const baseUrl = authRedirectUrl();

  if (!baseUrl) {
    return undefined;
  }

  try {
    const resetUrl = new URL(baseUrl);
    resetUrl.searchParams.set("auth_action", "password_recovery");
    return resetUrl.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}auth_action=password_recovery`;
  }
}

function emailConfirmationRedirectUrl(): string | undefined {
  const baseUrl = authRedirectUrl();

  if (!baseUrl) {
    return undefined;
  }

  try {
    const confirmationUrl = new URL(baseUrl);
    confirmationUrl.searchParams.set("auth_action", "email_confirmation");
    return confirmationUrl.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}auth_action=email_confirmation`;
  }
}

function googleAuthRedirectUrl(): string | undefined {
  const baseUrl = authRedirectUrl();

  if (!baseUrl) {
    return undefined;
  }

  try {
    const googleUrl = new URL(baseUrl);
    googleUrl.searchParams.set("auth_action", "google_sign_in");
    return googleUrl.toString();
  } catch {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}auth_action=google_sign_in`;
  }
}

function isPasswordRecoveryRedirect(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    searchParams.get("auth_action") === "password_recovery" ||
    searchParams.get("type") === "recovery" ||
    hashParams.get("auth_action") === "password_recovery" ||
    hashParams.get("type") === "recovery"
  );
}

function isGoogleAuthRedirect(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    searchParams.get("auth_action") === "google_sign_in" ||
    hashParams.get("auth_action") === "google_sign_in"
  );
}

function isEmailConfirmationRedirect(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const authType =
    searchParams.get("type") ??
    hashParams.get("type") ??
    searchParams.get("auth_action") ??
    hashParams.get("auth_action");
  const hasConfirmationCode =
    Boolean(searchParams.get("code")) && !isPasswordRecoveryRedirect();

  return (
    hasConfirmationCode ||
    ["email", "email_confirmation", "signup"].includes(
      authType?.toLowerCase() ?? ""
    )
  );
}

function clearAuthRedirectUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const cleanedUrl = new URL(window.location.href);
  cleanedUrl.searchParams.delete("code");
  cleanedUrl.searchParams.delete("email");
  cleanedUrl.searchParams.delete("error");
  cleanedUrl.searchParams.delete("error_code");
  cleanedUrl.searchParams.delete("error_description");
  cleanedUrl.searchParams.delete("auth_action");
  cleanedUrl.searchParams.delete("token_hash");
  cleanedUrl.searchParams.delete("type");
  cleanedUrl.hash = "";

  window.history.replaceState({}, document.title, cleanedUrl.toString());
}

function DetailList({
  emptyLabel,
  items,
  showBullets = true,
}: {
  emptyLabel: string;
  items: DetailListItem[];
  showBullets?: boolean;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-2 space-y-2 text-slate-700">
      {items.map((item) => {
        const detail =
          typeof item === "string"
            ? { key: item, sourceLabel: "", sourceTypes: [] as string[], text: item }
            : item;
        const fromMessages = detail.sourceTypes?.includes("communication");
        const visibleText =
          fromMessages && detail.sourceLabel
            ? `${detail.sourceLabel}: ${detail.text}`
            : detail.text;

        return (
          <li className="flex gap-2" key={detail.key}>
            <span
              className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                showBullets ? "bg-blue-500" : "invisible"
              }`}
            />
            <span className="inline-flex min-w-0 items-baseline gap-1.5">
              {fromMessages ? (
                <MessageCircleIcon
                  className="relative top-0.5 h-3.5 w-3.5 shrink-0 text-blue-500"
                />
              ) : null}
              {fromMessages ? (
                <span className="sr-only">From messages: </span>
              ) : null}
              <span>{visibleText}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AppointmentDetailUpdateOption({
  checked,
  changes,
  onChange,
}: {
  checked: boolean;
  changes: AppointmentDetailChange[];
  onChange: (checked: boolean) => void;
}) {
  if (changes.length === 0) {
    return null;
  }

  return (
    <section className="mt-4 rounded-md border border-blue-100 bg-[#f4faff] p-3">
      <h4 className="font-semibold text-blue-950">
        Appointment details found
      </h4>
      <div className="mt-2 space-y-2 text-sm text-blue-950">
        {changes.map((change) => (
          <p key={change.field}>
            <span className="font-semibold">{change.label}:</span>{" "}
            {change.currentValue || "Blank"} -&gt; {change.newValue}
          </p>
        ))}
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-blue-950">
        <input
          checked={checked}
          className="mt-1"
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
        <span>Update appointment details when saving notes</span>
      </label>
    </section>
  );
}

function resetInstructionDraft(
  version: AiInstructionVersion | null,
  workflowKey: AiWorkflowKey
) {
  return {
    model: version?.model ?? "gpt-4.1-mini",
    outputSchema: JSON.stringify(
      version?.output_schema ?? aiWorkflows[workflowKey].defaultSchema,
      null,
      2
    ),
    systemPrompt:
      version?.system_prompt ?? aiWorkflows[workflowKey].defaultSystemPrompt ?? "",
    userPrompt:
      version?.user_prompt_template ??
      aiWorkflows[workflowKey].defaultUserPrompt ??
      "",
  };
}

function nonProductionEnvironmentLabel(hostname: string, configuredEnv = "") {
  const normalizedEnv = configuredEnv.trim().toLowerCase();

  if (normalizedEnv && !["prd", "prod", "production"].includes(normalizedEnv)) {
    return normalizedEnv.toUpperCase();
  }

  const normalizedHost = hostname.toLowerCase();

  if (
    ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(normalizedHost) ||
    normalizedHost.endsWith(".local")
  ) {
    return "DEV";
  }

  if (
    normalizedHost.includes("stg") ||
    normalizedHost.includes("stage") ||
    normalizedHost.includes("test")
  ) {
    return "STG";
  }

  if (normalizedHost.endsWith(".vercel.app")) {
    return "PREVIEW";
  }

  return "";
}

function readStoredJson<T>(storage: Storage, key: string): T | null {
  try {
    const rawValue = storage.getItem(key);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function writeStoredJson(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private or locked-down browser contexts.
  }
}

function removeStoredValue(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Storage can be unavailable in private or locked-down browser contexts.
  }
}

function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function healthFocusSummaryCacheStorageKey(
  signedInAccount: string,
  subjectId: string
) {
  return `${healthFocusSummaryCacheStoragePrefix}:${encodeURIComponent(
    signedInAccount
  )}:${encodeURIComponent(subjectId || ALL_SUBJECTS)}`;
}

function readHealthFocusSummaryCache(
  signedInAccount: string | null,
  subjectId: string
) {
  if (typeof window === "undefined" || !signedInAccount) {
    return null;
  }

  const cached = readStoredJson<HealthFocusSummaryCache>(
    window.localStorage,
    healthFocusSummaryCacheStorageKey(signedInAccount, subjectId)
  );

  if (!cached || cached.localDay !== localDayKey()) {
    return null;
  }

  return cached;
}

function writeHealthFocusSummaryCache(
  signedInAccount: string | null,
  subjectId: string,
  topics: HealthFocusTopicSummary[]
) {
  if (typeof window === "undefined" || !signedInAccount) {
    return;
  }

  writeStoredJson(
    window.localStorage,
    healthFocusSummaryCacheStorageKey(signedInAccount, subjectId),
    {
      localDay: localDayKey(),
      subjectId,
      topics,
    } satisfies HealthFocusSummaryCache
  );
}

function intakeDraftFromResult(value: unknown): IntakeReviewDraftContent {
  const draft =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    appointmentReason: String(draft.appointment_reason ?? ""),
    appointmentTitle: String(draft.appointment_title ?? ""),
    confidence:
      typeof draft.confidence === "number" ? draft.confidence : Number(draft.confidence) || 0,
    followups: asTextList(draft.followups).join("\n"),
    locationAddress: String(draft.location_address ?? ""),
    locationName: String(draft.location_name ?? ""),
    locationPhone: String(draft.location_phone ?? ""),
    notesSummary: String(draft.notes_summary ?? ""),
    providerName: String(draft.provider_name ?? ""),
    providerOrganization: String(draft.provider_organization ?? ""),
    startsAt: String(draft.starts_at_local ?? ""),
    suggestedAction: String(draft.suggested_action ?? ""),
    takeaways: asTextList(draft.takeaways).join("\n"),
  };
}

function stringFromUnknown(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(stringFromUnknown).filter(Boolean).join("\n");
  }

  return String(value);
}

function numberFromUnknown(value: unknown): number {
  return typeof value === "number" ? value : Number(value) || 0;
}

function arrayFromUnknown(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : [];
}

function importAnythingKindLabel(kind: ImportAnythingItemKind): string {
  switch (kind) {
    case "appointment":
      return "Appointment";
    case "provider":
      return "Provider";
    case "note":
      return "Note";
    case "task":
      return "Task";
    case "medication_change":
      return "Medication Change";
    case "question":
      return "Question";
    case "careprep":
      return "CarePrep";
  }
}

function importAnythingFieldLabel(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
}

function importAnythingReviewItem(
  kind: ImportAnythingItemKind,
  index: number,
  item: Record<string, unknown>,
  fields: Record<string, string>,
  titleFallback: string,
  summaryParts: string[]
): ImportAnythingReviewItem {
  const confidence = numberFromUnknown(item.confidence);
  const needsReview = item.needs_review === true || confidence < 0.86;
  const title = titleFallback.trim() || importAnythingKindLabel(kind);
  const summary =
    summaryParts.map((part) => part.trim()).filter(Boolean).join(" · ") ||
    title;
  const itemPersonAssignment = importAnythingPersonAssignmentFromUnknown(
    item.person_assignment
  );
  const matchedAppointmentId = stringFromUnknown(item.matched_appointment_id);
  const hasConfidentOwner =
    Boolean(itemPersonAssignment?.clusterId) &&
    (itemPersonAssignment?.confidence ?? 0) >= 0.85 &&
    itemPersonAssignment?.needsReview !== true;
  const itemNeedsReview = needsReview || !hasConfidentOwner;

  return {
    confidence,
    createsNewAppointment: false,
    fields,
    id: `${kind}-${index}-${title}`,
    kind,
    matchedAppointmentId,
    matchedProviderId: stringFromUnknown(item.matched_provider_id),
    needsReview: itemNeedsReview,
    ownerClusterId: hasConfidentOwner
      ? itemPersonAssignment?.clusterId ?? ""
      : "",
    ownerCareSubjectId:
      hasConfidentOwner &&
      itemPersonAssignment &&
      itemPersonAssignment.matchedCareSubjectId
        ? itemPersonAssignment.matchedCareSubjectId
        : "",
    ownerConfidence: itemPersonAssignment?.confidence ?? 0,
    ownerDetectedName: itemPersonAssignment?.detectedName ?? "",
    ownerNeedsReview: itemPersonAssignment?.needsReview ?? true,
    ownerNewPersonName:
      !itemPersonAssignment?.matchedCareSubjectId &&
      itemPersonAssignment?.suggestedNewPersonName
        ? itemPersonAssignment.suggestedNewPersonName
        : "",
    ownerRationale: itemPersonAssignment?.rationale ?? "",
    providerMatchNote: stringFromUnknown(item.provider_match_note),
    sourceExcerpt: stringFromUnknown(item.source_excerpt),
    status: itemNeedsReview ? "needs_review" : "approved",
    summary,
    title,
  };
}

function importAnythingItemsFromDraft(
  draftValue: unknown
): ImportAnythingReviewItem[] {
  const draft =
    draftValue && typeof draftValue === "object" && !Array.isArray(draftValue)
      ? (draftValue as Record<string, unknown>)
      : {};
  const items: ImportAnythingReviewItem[] = [];

  arrayFromUnknown(draft.appointments).forEach((item, index) => {
    const fields = {
      appointmentReason: stringFromUnknown(item.appointment_reason),
      appointmentTitle: stringFromUnknown(item.appointment_title),
      locationAddress: stringFromUnknown(item.location_address),
      locationName: stringFromUnknown(item.location_name),
      locationPhone: stringFromUnknown(item.location_phone),
      providerName: stringFromUnknown(item.provider_name),
      providerOrganization: stringFromUnknown(item.provider_organization),
      startsAt: stringFromUnknown(item.starts_at_local),
      suggestedAction: stringFromUnknown(item.suggested_action),
    };
    items.push(
      importAnythingReviewItem(
        "appointment",
        index,
        item,
        fields,
        fields.appointmentTitle || fields.appointmentReason,
        [
          fields.startsAt,
          fields.providerName || fields.providerOrganization,
          fields.locationName,
          fields.suggestedAction,
        ]
      )
    );
  });

  arrayFromUnknown(draft.providers).forEach((item, index) => {
    const fields = {
      locationAddress: stringFromUnknown(item.location_address),
      locationName: stringFromUnknown(item.location_name),
      phone: stringFromUnknown(item.phone),
      providerName: stringFromUnknown(item.provider_name),
      providerOrganization: stringFromUnknown(item.provider_organization),
    };
    items.push(
      importAnythingReviewItem(
        "provider",
        index,
        item,
        fields,
        fields.providerName || fields.providerOrganization,
        [fields.providerOrganization, fields.locationName, fields.phone]
      )
    );
  });

  arrayFromUnknown(draft.notes).forEach((item, index) => {
    const fields = {
      appointmentReason: stringFromUnknown(item.appointment_reason),
      appointmentTitle: stringFromUnknown(item.appointment_title),
      followups: asTextList(item.followups).join("\n"),
      locationAddress: stringFromUnknown(item.location_address),
      locationName: stringFromUnknown(item.location_name),
      locationPhone: stringFromUnknown(item.location_phone),
      providerName: stringFromUnknown(item.provider_name),
      providerOrganization: stringFromUnknown(item.provider_organization),
      startsAt: stringFromUnknown(item.starts_at_local),
      summary: stringFromUnknown(item.summary),
      takeaways: asTextList(item.takeaways).join("\n"),
    };
    items.push(
      importAnythingReviewItem(
        "note",
        index,
        item,
        fields,
        fields.appointmentTitle || "Visit note",
        [fields.summary]
      )
    );
  });

  arrayFromUnknown(draft.tasks).forEach((item, index) => {
    const fields = {
      details: stringFromUnknown(item.details),
      dueAt: stringFromUnknown(item.due_at_local),
      title: stringFromUnknown(item.title),
    };
    items.push(
      importAnythingReviewItem("task", index, item, fields, fields.title, [
        fields.dueAt,
        fields.details,
      ])
    );
  });

  arrayFromUnknown(draft.medication_changes).forEach((item, index) => {
    const fields = {
      changeSummary: stringFromUnknown(item.change_summary),
      instructions: stringFromUnknown(item.instructions),
      medicationName: stringFromUnknown(item.medication_name),
    };
    items.push(
      importAnythingReviewItem(
        "medication_change",
        index,
        item,
        fields,
        fields.medicationName || "Medication change",
        [fields.changeSummary, fields.instructions]
      )
    );
  });

  arrayFromUnknown(draft.questions_to_ask).forEach((item, index) => {
    const fields = {
      question: stringFromUnknown(item.question),
      topic: stringFromUnknown(item.topic),
    };
    items.push(
      importAnythingReviewItem(
        "question",
        index,
        item,
        fields,
        fields.question,
        [fields.topic]
      )
    );
  });

  arrayFromUnknown(draft.careprep_items).forEach((item, index) => {
    const fields = {
      appointmentTitle: stringFromUnknown(item.appointment_title),
      detail: stringFromUnknown(item.detail),
    };
    items.push(
      importAnythingReviewItem(
        "careprep",
        index,
        item,
        fields,
        fields.appointmentTitle || "CarePrep item",
        [fields.detail]
      )
    );
  });

  return items.map((item) => {
    if (item.kind !== "note" || item.matchedAppointmentId) {
      return item;
    }

    const supportsExtractedAppointment = items.some(
      (candidate) =>
        candidate.kind === "appointment" &&
        importAnythingFindSupportingNotes(candidate, items).some(
          (supportItem) => supportItem.id === item.id
        )
    );

    if (supportsExtractedAppointment) {
      return item;
    }

    return {
      ...item,
      createsNewAppointment: true,
      needsReview: true,
      status: "needs_review",
    };
  });
}

function importAnythingSummaryCounts(items: ImportAnythingReviewItem[]) {
  return {
    appointments: items.filter((item) => item.kind === "appointment").length,
    careprep: items.filter((item) => item.kind === "careprep").length,
    medicationChanges: items.filter(
      (item) => item.kind === "medication_change"
    ).length,
    notes: items.filter((item) => item.kind === "note").length,
    providers: items.filter((item) => item.kind === "provider").length,
    questions: items.filter((item) => item.kind === "question").length,
    tasks: items.filter((item) => item.kind === "task").length,
  };
}

function importAnythingNewAppointmentNoteCount(
  items: ImportAnythingReviewItem[]
) {
  return items.filter(
    (item) =>
      item.kind === "note" &&
      item.createsNewAppointment &&
      item.status !== "rejected"
  ).length;
}

function normalizedImportAnythingText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function importAnythingOwnerKey(item: ImportAnythingReviewItem) {
  return (
    item.ownerCareSubjectId ||
    normalizedImportAnythingText(item.ownerNewPersonName) ||
    normalizedImportAnythingText(item.ownerDetectedName)
  );
}

function importAnythingFindSupportingNotes(
  appointment: ImportAnythingReviewItem,
  items: ImportAnythingReviewItem[]
) {
  if (appointment.kind !== "appointment") {
    return [];
  }

  const appointmentTitle = normalizedImportAnythingText(
    appointment.fields.appointmentTitle || appointment.title
  );
  const appointmentOwner = importAnythingOwnerKey(appointment);

  if (!appointmentTitle) {
    return [];
  }

  return items.filter((item) => {
    if (item.kind !== "note" && item.kind !== "careprep") {
      return false;
    }

    const itemTitle = normalizedImportAnythingText(
      item.fields.appointmentTitle || item.title
    );

    return (
      itemTitle === appointmentTitle &&
      (!appointmentOwner || importAnythingOwnerKey(item) === appointmentOwner)
    );
  });
}

function importAnythingStagingItems(items: ImportAnythingReviewItem[]) {
  const supportedItemIds = new Set(
    items
      .filter((item) => item.kind === "appointment")
      .flatMap((item) =>
        importAnythingFindSupportingNotes(item, items)
          .filter(
            (supportItem) =>
              !supportItem.needsReview && supportItem.status !== "needs_review"
          )
          .map((supportItem) => supportItem.id)
      )
  );

  return items.filter(
    (item) => item.kind !== "provider" && !supportedItemIds.has(item.id)
  );
}

function importAnythingPracticeOfficeValue(item: ImportAnythingReviewItem) {
  return (
    item.fields.providerOrganization?.trim() ||
    item.fields.locationName?.trim() ||
    ""
  );
}

function importAnythingSimpleFieldEntries(item: ImportAnythingReviewItem) {
  return Object.entries(item.fields).filter(
    ([field]) => field !== "providerOrganization" && field !== "locationName"
  );
}

function pluralizeCount(count: number, singularLabel: string) {
  return `${count} ${singularLabel}${count === 1 ? "" : "s"}`;
}

function importAnythingDeterministicSummary(
  items: ImportAnythingReviewItem[],
  clusters: ImportAnythingOwnershipCluster[]
) {
  const counts = importAnythingSummaryCounts(items);
  const itemParts = [
    counts.appointments
      ? pluralizeCount(counts.appointments, "appointment")
      : "",
    importAnythingNewAppointmentNoteCount(items)
      ? pluralizeCount(
          importAnythingNewAppointmentNoteCount(items),
          "appointment from Visit Notes"
        )
      : "",
    counts.tasks ? pluralizeCount(counts.tasks, "task") : "",
    counts.medicationChanges
      ? pluralizeCount(counts.medicationChanges, "medication change")
      : "",
    counts.questions ? pluralizeCount(counts.questions, "question") : "",
    counts.careprep ? pluralizeCount(counts.careprep, "CarePrep item") : "",
  ].filter(Boolean);
  const clusterRows = importAnythingOwnershipClusterCounts(items, clusters);
  const clusterLabels = clusterRows
    .filter((row) => row.count > 0)
    .map((row) => row.label);

  return `Found ${itemParts.join(", ") || "review items"}${
    clusterLabels.length > 0
      ? ` across ${clusterLabels.join(", ")}`
      : ""
  }.${counts.notes ? " Supporting notes were attached automatically." : ""}`;
}

function importAnythingPersonAssignmentFromUnknown(
  value: unknown
): ImportAnythingPersonAssignment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const assignment = value as Record<string, unknown>;
  const confidence =
    typeof assignment.confidence === "number" &&
    Number.isFinite(assignment.confidence)
      ? Math.min(1, Math.max(0, assignment.confidence))
      : 0;

  return {
    clusterId: stringFromUnknown(assignment.cluster_id),
    confidence,
    detectedName: stringFromUnknown(assignment.detected_name),
    matchedCareSubjectId: stringFromUnknown(
      assignment.matched_care_subject_id
    ),
    needsReview: assignment.needs_review === true,
    rationale: stringFromUnknown(assignment.rationale),
    suggestedNewPersonName: stringFromUnknown(
      assignment.suggested_new_person_name
    ),
  };
}

function importAnythingOwnershipClustersFromDraft(
  draftValue: unknown
): ImportAnythingOwnershipCluster[] {
  const draft =
    draftValue && typeof draftValue === "object" && !Array.isArray(draftValue)
      ? (draftValue as Record<string, unknown>)
      : {};

  return arrayFromUnknown(draft.ownership_clusters).map((cluster) => ({
    clusterId: stringFromUnknown(cluster.cluster_id),
    confidence: numberFromUnknown(cluster.confidence),
    displayName: stringFromUnknown(cluster.display_name),
    entityType: stringFromUnknown(cluster.entity_type),
    matchedCareSubjectId: stringFromUnknown(cluster.matched_care_subject_id),
    rationale: stringFromUnknown(cluster.rationale),
    suggestedNewPersonName: stringFromUnknown(
      cluster.suggested_new_person_name
    ),
  }));
}

function importAnythingOwnershipClusterCounts(
  items: ImportAnythingReviewItem[],
  clusters: ImportAnythingOwnershipCluster[]
) {
  const counts = new Map<string, number>();
  const clusterLabelById = new Map(
    clusters.map((cluster) => [
      cluster.clusterId,
      cluster.displayName || cluster.suggestedNewPersonName || "Unnamed",
    ])
  );

  for (const item of items) {
    const key =
      item.ownerClusterId && item.ownerConfidence >= 0.85
        ? item.ownerClusterId
        : "unassigned";

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const clusterRows = clusters.map((cluster) => ({
    count: counts.get(cluster.clusterId) ?? 0,
    label:
      cluster.displayName ||
      cluster.suggestedNewPersonName ||
      cluster.clusterId ||
      "Unnamed",
  }));
  const assignedClusterIds = new Set(clusters.map((cluster) => cluster.clusterId));
  const orphanRows = Array.from(counts.entries())
    .filter(([clusterId]) => clusterId !== "unassigned" && !assignedClusterIds.has(clusterId))
    .map(([clusterId, count]) => ({
      count,
      label: clusterLabelById.get(clusterId) ?? clusterId,
    }));
  const unassignedCount = counts.get("unassigned") ?? 0;

  return [
    ...clusterRows,
    ...orphanRows,
    ...(unassignedCount > 0 ? [{ count: unassignedCount, label: "Unassigned" }] : []),
  ].filter((row) => row.count > 0 || row.label !== "Unassigned");
}

function importAnythingMatchedAppointmentLabel(
  appointmentId: string,
  appointments: Appointment[]
): string {
  const appointment = appointments.find((item) => item.id === appointmentId);

  if (!appointment) {
    return appointmentId;
  }

  return [
    appointment.title?.trim() || appointment.reason?.trim() || "Appointment",
    appointment.starts_at ? formatDate(appointment.starts_at) : "",
    appointment.provider_name?.trim() || appointment.provider_organization?.trim() || "",
  ]
    .filter(Boolean)
    .join(" · ");
}

type CarePlandPersProps = {
  adminRoute?: boolean;
  preferAdminAfterLogin?: boolean;
  preferredInitialMainTab?: MainTab;
};

function shouldStayOnPersonalRoute() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("personal") === "1";
}

function preferredTabFromRoute(): MainTab | null {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("profile") === "1") return "profile";
  if (params.get("appointments") === "1") return "appointments";
  return null;
}

function shouldShowAppointmentsMainFromRoute() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return (
    params.get("appointments") === "1" &&
    (params.get("view") === "upcoming" || params.get("main") === "1")
  );
}

function shouldOpenAskFromRoute() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("ask") === "1";
}

function updatePersonalRoute(route: "appointments" | "ask" | "home" | "profile") {
  if (typeof window === "undefined") {
    return;
  }

  const path =
    route === "appointments"
      ? "/?personal=1&appointments=1"
      : route === "profile"
        ? "/?personal=1&profile=1"
        : route === "ask"
          ? "/?personal=1&ask=1"
          : "/?personal=1";

  if (`${window.location.pathname}${window.location.search}` !== path) {
    window.history.pushState({}, "", path);
  }
}

export function CarePlandPers({
  adminRoute = false,
  preferAdminAfterLogin = true,
  preferredInitialMainTab,
}: CarePlandPersProps = {}) {
  const mainHeaderRef = useRef<HTMLElement | null>(null);
  const adminReadonlyPanelRef = useRef<HTMLElement | null>(null);
  const restoredAppointmentsScrollRef = useRef(false);
  const importAnythingDragDepthRef = useRef(0);
  const appointmentNotesDragDepthRef = useRef(0);
  const shouldShowAppointmentsMain = shouldShowAppointmentsMainFromRoute();
  const [stickySecondaryOffset, setStickySecondaryOffset] = useState(0);
  const [runtimeEnvironmentLabel, setRuntimeEnvironmentLabel] = useState("");
  const [showVersionInfo, setShowVersionInfo] = useState(false);
  const [
    adminRecommendationsReviewDraftSummary,
    setAdminRecommendationsReviewDraftSummary,
  ] = useState<AdminRecommendationsReviewDraftSummary | null>(null);
  const entryHostMode = useSyncExternalStore(
    subscribeEntryHostMode,
    getEntryHostMode,
    getEntryHostMode
  );
  const [initialUiState] = useState<StoredUiState | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return readStoredJson<StoredUiState>(
      window.localStorage,
      appUiStateStorageKey
    );
  });
  const [initialDraftState] = useState<StoredDraftState | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return readStoredJson<StoredDraftState>(
      window.sessionStorage,
      appDraftStateStorageKey
    );
  });
  const [initialAppointmentsPageViewState] =
    useState<AppointmentsPageViewState | null>(() => {
      const restoredState =
        restorePageViewState<AppointmentsPageViewState>("appointments");

      if (!restoredState?.engaged) {
        return null;
      }

      return shouldShowAppointmentsMain
        ? {
            ...restoredState,
            activeAppointmentPanel: null,
            appointmentView: "upcoming",
          }
        : restoredState;
    });
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [showAuthGateway, setShowAuthGateway] = useState(
    adminRoute || shouldStayOnPersonalRoute()
  );
  const [planHelpExpanded, setPlanHelpExpanded] = useState(false);
  const [adminPlanPreviewId, setAdminPlanPreviewId] = useState("");
  const [activeAppointmentPanel, setActiveAppointmentPanel] =
    useState<AppointmentPanel | null>(
      shouldShowAppointmentsMain
        ? null
        : initialAppointmentsPageViewState?.activeAppointmentPanel ?? null
    );
  const [mainTab, setMainTab] = useState<MainTab>(
    preferredInitialMainTab ??
      preferredTabFromRoute() ??
      (shouldStayOnPersonalRoute() && initialUiState?.mainTab === "admin"
        ? "home"
        : initialUiState?.mainTab ?? "home")
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newAppointmentDraft, setNewAppointmentDraft] =
    useState<AppointmentDetailsDraft>({
      ...emptyAppointmentDraft,
      locationAddress:
        initialDraftState?.newAppointmentDraft?.locationAddress ?? "",
      locationName: initialDraftState?.newAppointmentDraft?.locationName ?? "",
      locationPhone:
        initialDraftState?.newAppointmentDraft?.locationPhone ?? "",
      providerName:
        initialDraftState?.newAppointmentDraft?.providerName ?? "",
      providerOrganization:
        initialDraftState?.newAppointmentDraft?.providerOrganization ?? "",
      reason: initialDraftState?.newAppointmentDraft?.reason ?? "",
      startsAt: initialDraftState?.newAppointmentDraft?.startsAt ?? "",
      title: initialDraftState?.newAppointmentDraft?.title ?? "",
    });
  const newAppointmentTitle = newAppointmentDraft.title;
  const newAppointmentReason = newAppointmentDraft.reason;
  const newAppointmentStartsAt = newAppointmentDraft.startsAt;
  const newAppointmentProviderName = newAppointmentDraft.providerName;
  const newAppointmentProviderOrganization =
    newAppointmentDraft.providerOrganization;
  const newAppointmentLocationName = newAppointmentDraft.locationName;
  const newAppointmentLocationAddress = newAppointmentDraft.locationAddress;
  const newAppointmentLocationPhone = newAppointmentDraft.locationPhone;

  function updateNewAppointmentDraft(
    field: keyof AppointmentDetailsDraft,
    value: string
  ) {
    setNewAppointmentDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  const setNewAppointmentTitle = (value: string) =>
    updateNewAppointmentDraft("title", value);
  const setNewAppointmentReason = (value: string) =>
    updateNewAppointmentDraft("reason", value);
  const setNewAppointmentStartsAt = (value: string) =>
    updateNewAppointmentDraft("startsAt", value);
  const setNewAppointmentProviderName = (value: string) =>
    updateNewAppointmentDraft("providerName", value);
  const setNewAppointmentProviderOrganization = (value: string) =>
    updateNewAppointmentDraft("providerOrganization", value);
  const setNewAppointmentLocationName = (value: string) =>
    updateNewAppointmentDraft("locationName", value);
  const setNewAppointmentLocationAddress = (value: string) =>
    updateNewAppointmentDraft("locationAddress", value);
  const setNewAppointmentLocationPhone = (value: string) =>
    updateNewAppointmentDraft("locationPhone", value);
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>(
    []
  );
  const [loadingFavoriteLocations, setLoadingFavoriteLocations] =
    useState(false);
  const [placeLookupQuery, setPlaceLookupQuery] = useState("");
  const [placeLookupSuggestions, setPlaceLookupSuggestions] = useState<
    PlaceAutocompleteSuggestion[]
  >([]);
  const [placeLookupSessionToken, setPlaceLookupSessionToken] = useState("");
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [placesStatusMessage, setPlacesStatusMessage] = useState("");
  const [selectedGooglePlace, setSelectedGooglePlace] =
    useState<PlaceDetailsResult | null>(null);
  const [addFavoriteLocation, setAddFavoriteLocation] = useState(false);
  const [favoriteLocationNickname, setFavoriteLocationNickname] = useState("");
  const [newAppointmentSubjectId, setNewAppointmentSubjectId] = useState(
    initialDraftState?.newAppointmentDraft?.subjectId ?? ""
  );
  const [textIntakeSubjectId, setTextIntakeSubjectId] = useState(
    initialDraftState?.textIntakeSubjectId ?? ""
  );
  const [textIntakeValue, setTextIntakeValue] = useState(
    initialDraftState?.textIntakeValue ?? ""
  );
  const [textIntakeDraft, setTextIntakeDraft] =
    useState<IntakeReviewDraftContent | null>(
      initialDraftState?.textIntakeDraft ?? null
    );
  const [textIntakeAiDraft, setTextIntakeAiDraft] =
    useState<IntakeReviewDraftContent | null>(
      initialDraftState?.textIntakeAiDraft ?? null
    );
  const [textIntakeItemId, setTextIntakeItemId] = useState<string | null>(
    initialDraftState?.textIntakeItemId ?? null
  );
  const [textIntakeMatches, setTextIntakeMatches] = useState<TextIntakeMatch[]>(
    initialDraftState?.textIntakeMatches ?? []
  );
  const [selectedTextIntakeMatchId, setSelectedTextIntakeMatchId] =
    useState(initialDraftState?.selectedTextIntakeMatchId ?? "new");
  const [textIntakeTargetAppointmentId, setTextIntakeTargetAppointmentId] =
    useState<string | null>(
      initialDraftState?.textIntakeTargetAppointmentId ?? null
    );
  const [contextualTextIntakeValue, setContextualTextIntakeValue] =
    useState(initialDraftState?.contextualTextIntakeValue ?? "");
  const [
    applyTextIntakeAppointmentDetails,
    setApplyTextIntakeAppointmentDetails,
  ] = useState(false);
  const [bulkAppointmentDrafts, setBulkAppointmentDrafts] = useState<
    BulkAppointmentDraft[]
  >(initialDraftState?.bulkAppointmentDrafts ?? []);
  const [bulkAppointmentSummary, setBulkAppointmentSummary] = useState(
    initialDraftState?.bulkAppointmentSummary ?? ""
  );
  const [importAnythingIntakeItemId, setImportAnythingIntakeItemId] = useState<
    string | null
  >(initialDraftState?.importAnythingIntakeItemId ?? null);
  const [importAnythingReviewOpen, setImportAnythingReviewOpen] = useState(
    initialDraftState?.importAnythingReviewOpen ?? false
  );
  const [importAnythingItems, setImportAnythingItems] = useState<
    ImportAnythingReviewItem[]
  >(initialDraftState?.importAnythingItems ?? []);
  const [
    importAnythingIdentityResolutionOpen,
    setImportAnythingIdentityResolutionOpen,
  ] = useState(initialDraftState?.importAnythingIdentityResolutionOpen ?? false);
  const [
    importAnythingIdentityResolutionChoices,
    setImportAnythingIdentityResolutionChoices,
  ] = useState<ImportAnythingIdentityResolutionChoice[]>(
    initialDraftState?.importAnythingIdentityResolutionChoices ?? []
  );
  const [
    importAnythingOwnershipClusters,
    setImportAnythingOwnershipClusters,
  ] = useState<ImportAnythingOwnershipCluster[]>(
    initialDraftState?.importAnythingOwnershipClusters ?? []
  );
  const [importAnythingOwnerPersonId, setImportAnythingOwnerPersonId] =
    useState(initialDraftState?.importAnythingOwnerPersonId ?? "");
  const [importAnythingPersonAssignment, setImportAnythingPersonAssignment] =
    useState<ImportAnythingPersonAssignment | null>(
      initialDraftState?.importAnythingPersonAssignment ?? null
    );
  const [importAnythingNewPersonName, setImportAnythingNewPersonName] =
    useState(initialDraftState?.importAnythingNewPersonName ?? "");
  const [importAnythingSummary, setImportAnythingSummary] = useState(
    initialDraftState?.importAnythingSummary ?? ""
  );
  const [importAnythingSources, setImportAnythingSources] = useState<string[]>(
    initialDraftState?.importAnythingSources ?? []
  );
  const [importAnythingDragActive, setImportAnythingDragActive] =
    useState(false);
  const [importAnythingExpertView, setImportAnythingExpertView] =
    useState(false);
  const [
    confirmingImportAnythingSaveAll,
    setConfirmingImportAnythingSaveAll,
  ] = useState(initialDraftState?.confirmingImportAnythingSaveAll ?? false);
  const [editingImportAnythingItemIds, setEditingImportAnythingItemIds] =
    useState<Record<string, boolean>>({});
  const [
    expandedImportAnythingItemIds,
    setExpandedImportAnythingItemIds,
  ] = useState<Record<string, boolean>>({});
  const [confirmingDiscardImportAnythingReview, setConfirmingDiscardImportAnythingReview] =
    useState(false);
  const [viewingImportAnythingSourceItemId, setViewingImportAnythingSourceItemId] =
    useState<string | null>(null);
  const [processingImportAnything, setProcessingImportAnything] =
    useState(false);
  const [savingImportAnything, setSavingImportAnything] = useState(false);
  const [newCareVipName, setNewCareVipName] = useState("");
  const [managingCareVips, setManagingCareVips] = useState(false);
  const [selectedAiWorkflow, setSelectedAiWorkflow] =
    useState<AiWorkflowKey>(
      initialUiState?.selectedAiWorkflow ?? "careprep_generation"
    );
  const [aiAdminTab, setAiAdminTab] = useState<AiAdminTab>(
    initialUiState?.aiAdminTab ?? "instructions"
  );
  const [adminTab, setAdminTab] = useState<AdminTab>(
    initialUiState?.adminTab === "messages"
      ? "content"
      : initialUiState?.adminTab ?? "tools"
  );
  const [adminViewStates, setAdminViewStates] = useState<
    Record<string, AdminViewState>
  >({});
  const [adminAttentionSummaries, setAdminAttentionSummaries] = useState<
    Record<string, AdminAttentionSummary>
  >({});
  const [aiOperationCostSummary, setAiOperationCostSummary] = useState<
    AiOperationCostSummaryRow[]
  >([]);
  const [aiOperationCostUserSummary, setAiOperationCostUserSummary] = useState<
    AiOperationCostUserSummaryRow[]
  >([]);
  const [aiOperationCostError, setAiOperationCostError] = useState("");
  const [loadingAiOperationCosts, setLoadingAiOperationCosts] = useState(false);
  const [aiOperationCostRangeDays, setAiOperationCostRangeDays] = useState(30);
  const [aiOperationCostViewMode, setAiOperationCostViewMode] =
    useState<AiOperationCostViewMode>("workflow");
  const [loadingInstructions, setLoadingInstructions] = useState(false);
  const [loadingCarePrepHistory, setLoadingCarePrepHistory] = useState(false);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [aiInstructionSet, setAiInstructionSet] =
    useState<AiInstructionSet | null>(null);
  const [aiInstructionVersion, setAiInstructionVersion] =
    useState<AiInstructionVersion | null>(null);
  const [aiInstructionVersions, setAiInstructionVersions] = useState<
    AiInstructionVersion[]
  >([]);
  const [draftSourceVersion, setDraftSourceVersion] =
    useState<AiInstructionVersion | null>(null);
  const [instructionSystemPrompt, setInstructionSystemPrompt] = useState("");
  const [instructionUserPrompt, setInstructionUserPrompt] = useState("");
  const [instructionOutputSchema, setInstructionOutputSchema] = useState(
    JSON.stringify(defaultCarePrepOutputSchema, null, 2)
  );
  const [instructionModel, setInstructionModel] = useState("gpt-4.1-mini");
  const [instructionChangeNote, setInstructionChangeNote] = useState("");
  const [agentProductFacts, setAgentProductFacts] = useState(
    appContentDefaults.support_agent_product_facts
  );
  const [agentKnownLimitations, setAgentKnownLimitations] = useState(
    appContentDefaults.support_agent_known_limitations
  );
  const [agentEscalationGuidance, setAgentEscalationGuidance] = useState(
    appContentDefaults.support_agent_escalation_guidance
  );
  const [agentVoiceGuidance, setAgentVoiceGuidance] = useState(
    appContentDefaults.support_agent_voice_guidance
  );
  const [agentKnowledgeChangeNote, setAgentKnowledgeChangeNote] = useState("");
  const [savingAgentKnowledge, setSavingAgentKnowledge] = useState(false);
  const [agentKnowledgeProposals, setAgentKnowledgeProposals] = useState<
    AgentKnowledgeProposal[]
  >([]);
  const [agentKnowledgeProposalItems, setAgentKnowledgeProposalItems] =
    useState<AgentKnowledgeProposalItem[]>([]);
  const [agentKnowledgeProposalDrafts, setAgentKnowledgeProposalDrafts] =
    useState<Record<string, string>>({});
  const [agentKnowledgeProposalNotes, setAgentKnowledgeProposalNotes] =
    useState<Record<string, string>>({});
  const [agentKnowledgeProposalPublishNote, setAgentKnowledgeProposalPublishNote] =
    useState("");
  const [
    agentKnowledgeAutomationSettings,
    setAgentKnowledgeAutomationSettings,
  ] = useState<AgentKnowledgeAutomationSettings>(
    defaultAgentKnowledgeAutomationSettings
  );
  const [agentKnowledgeCheckRuns, setAgentKnowledgeCheckRuns] = useState<
    AgentKnowledgeCheckRun[]
  >([]);
  const [loadingAgentKnowledgeProposals, setLoadingAgentKnowledgeProposals] =
    useState(false);
  const [savingAgentKnowledgeAutomationSettings, setSavingAgentKnowledgeAutomationSettings] =
    useState(false);
  const [queueingAgentKnowledgeRun, setQueueingAgentKnowledgeRun] =
    useState(false);
  const [selectedAgentKnowledgeProposalId, setSelectedAgentKnowledgeProposalId] =
    useState("");
  const [savingAgentKnowledgeProposalItemId, setSavingAgentKnowledgeProposalItemId] =
    useState<string | null>(null);
  const [publishingAgentKnowledgeProposalId, setPublishingAgentKnowledgeProposalId] =
    useState<string | null>(null);
  const [revertingInstructionForId, setRevertingInstructionForId] = useState<
    string | null
  >(null);
  const [appContentVersions, setAppContentVersions] = useState<
    AppContentVersion[]
  >([]);
  const [selectedAppContentKey, setSelectedAppContentKey] = useState(
    initialUiState?.selectedAppContentKey ?? appContentOptions[0].contentKey
  );
  const [selectedAppContentCategory, setSelectedAppContentCategory] = useState(
    initialUiState?.selectedAppContentCategory ?? appContentOptions[0].category
  );
  const [selectedProductMgmtSection, setSelectedProductMgmtSection] =
    useState<ProductMgmtSection>(
      (initialUiState?.selectedProductMgmtSection as ProductMgmtSection) ??
        "bug"
    );
  const [productMgmtAreas, setProductMgmtAreas] = useState<ProductMgmtArea[]>([]);
  const [productMgmtItems, setProductMgmtItems] = useState<ProductMgmtItem[]>([]);
  const [loadingProductMgmt, setLoadingProductMgmt] = useState(false);
  const [savingProductMgmtItem, setSavingProductMgmtItem] = useState(false);
  const [resolvingProductMgmtItemId, setResolvingProductMgmtItemId] = useState<
    string | null
  >(null);
  const [editingProductMgmtItemId, setEditingProductMgmtItemId] = useState<
    string | null
  >(null);
  const [savingProductMgmtEditItemId, setSavingProductMgmtEditItemId] =
    useState<string | null>(null);
  const [productMgmtItemDraft, setProductMgmtItemDraft] =
    useState<ProductMgmtItemDraft | null>(null);
  const [newProductMgmtTitle, setNewProductMgmtTitle] = useState("");
  const [newProductMgmtBody, setNewProductMgmtBody] = useState("");
  const [newProductMgmtPriority, setNewProductMgmtPriority] =
    useState<ProductMgmtPriority>("medium");
  const [newProductMgmtStatus, setNewProductMgmtStatus] =
    useState<ProductMgmtStatus>("open");
  const [newProductMgmtChangeNote, setNewProductMgmtChangeNote] =
    useState("Initial entry");
  const [showProductMgmtAreaForm, setShowProductMgmtAreaForm] = useState(false);
  const [newProductMgmtAreaLabel, setNewProductMgmtAreaLabel] = useState("");
  const [newProductMgmtAreaDescription, setNewProductMgmtAreaDescription] =
    useState("");
  const [savingProductMgmtArea, setSavingProductMgmtArea] = useState(false);
  const [retiringProductMgmtAreaId, setRetiringProductMgmtAreaId] = useState<
    string | null
  >(null);
  const [adminUserActivity, setAdminUserActivity] = useState<
    AdminUserActivityRow[]
  >([]);
  const [loadingAdminUserActivity, setLoadingAdminUserActivity] =
    useState(false);
  const [adminUserActivityFilter, setAdminUserActivityFilter] =
    useState<AdminUserActivityFilter>("all");
  const [adminUserActivitySort, setAdminUserActivitySort] = useState<{
    direction: "asc" | "desc";
    key: AdminUserActivitySortKey;
  }>({
    direction: "desc",
    key: "last_activity",
  });
  const [adminAccessEvents, setAdminAccessEvents] = useState<
    AdminAccessEventRow[]
  >([]);
  const [loadingAdminAccessEvents, setLoadingAdminAccessEvents] =
    useState(false);
  const [earlyAccessIntakeRows, setEarlyAccessIntakeRows] = useState<
    EarlyAccessIntakeRow[]
  >([]);
  const [loadingEarlyAccessIntake, setLoadingEarlyAccessIntake] =
    useState(false);
  const [savingEarlyAccessIntake, setSavingEarlyAccessIntake] = useState(false);
  const [updatingEarlyAccessIntakeId, setUpdatingEarlyAccessIntakeId] =
    useState<string | null>(null);
  const [earlyAccessIntakeFilter, setEarlyAccessIntakeFilter] =
    useState<"active" | "all" | EarlyAccessIntakeStatus>("active");
  const [earlyAccessIntakeDraft, setEarlyAccessIntakeDraft] =
    useState<EarlyAccessIntakeDraft>({
      adminNotes: "",
      careRole: "unspecified",
      communicationPreference: "email",
      email: "",
      firstName: "",
      interestContext: "",
      lastName: "",
      phone: "",
      source: "admin",
    });
  const [earlyAccessIntakeAdminNotes, setEarlyAccessIntakeAdminNotes] =
    useState<Record<string, string>>({});
  const [adminReadonlySnapshot, setAdminReadonlySnapshot] =
    useState<AdminReadonlySnapshot | null>(null);
  const [loadingAdminReadonlyUserId, setLoadingAdminReadonlyUserId] =
    useState<string | null>(null);
  const [revealingAdminSensitiveKey, setRevealingAdminSensitiveKey] =
    useState<string | null>(null);
  const [savingAdminContactDetails, setSavingAdminContactDetails] =
    useState(false);
  const [adminRevealedSensitiveData, setAdminRevealedSensitiveData] = useState<
    Record<string, AdminRevealedSensitiveData>
  >({});
  const [expandedAdminUserCareVipRows, setExpandedAdminUserCareVipRows] =
    useState<Record<string, boolean>>({});
  const [adminIntegrationErrors, setAdminIntegrationErrors] = useState<
    AdminIntegrationErrorSummaryRow[]
  >([]);
  const [loadingAdminIntegrationErrors, setLoadingAdminIntegrationErrors] =
    useState(false);
  const [
    selectedAdminIntegrationErrorKeys,
    setSelectedAdminIntegrationErrorKeys,
  ] = useState<string[]>([]);
  const [deletingAdminIntegrationErrors, setDeletingAdminIntegrationErrors] =
    useState(false);
  const [userSupportTickets, setUserSupportTickets] = useState<SupportTicket[]>([]);
  const [userSupportTicketMessages, setUserSupportTicketMessages] = useState<
    SupportTicketMessage[]
  >([]);
  const [adminSupportTickets, setAdminSupportTickets] = useState<SupportTicket[]>([]);
  const [adminSupportTicketMessages, setAdminSupportTicketMessages] = useState<
    SupportTicketMessage[]
  >([]);
  const [supportQuestionExpanded, setSupportQuestionExpanded] = useState(false);
  const [askingSupportQuestion, setAskingSupportQuestion] = useState(false);
  const [savingSupportQuestion, setSavingSupportQuestion] = useState(false);
  const [savingSupportReply, setSavingSupportReply] = useState(false);
  const [askPanelOpen, setAskPanelOpen] = useState(shouldOpenAskFromRoute);
  const [askThreadId, setAskThreadId] = useState<string | null>(null);
  const [askInput, setAskInput] = useState("");
  const [askMessages, setAskMessages] = useState<AskConversationMessage[]>([]);
  const [askConversationComplete, setAskConversationComplete] = useState(false);
  const [askCompletionMessageKey, setAskCompletionMessageKey] = useState(
    "ask_acknowledgement_message"
  );
  const [askPanelError, setAskPanelError] = useState("");
  const [askCloseConfirmOpen, setAskCloseConfirmOpen] = useState(false);
  const [askSubmittedFingerprints, setAskSubmittedFingerprints] = useState<
    string[]
  >([]);
  const [sendingAskMessage, setSendingAskMessage] = useState(false);
  const [supportQuestionSubject, setSupportQuestionSubject] = useState("");
  const [supportQuestionBody, setSupportQuestionBody] = useState("");
  const [supportReplyBody, setSupportReplyBody] = useState("");
  const [supportAssistantResult, setSupportAssistantResult] =
    useState<SupportAssistantResult | null>(null);
  const [supportAssistantFeedback, setSupportAssistantFeedback] = useState("");
  const [supportAssistantFeedbackMode, setSupportAssistantFeedbackMode] =
    useState<"helpful" | "not_helpful" | null>(null);
  const [supportAssistantResolution, setSupportAssistantResolution] = useState<
    "helpful" | "not_helpful_saved" | "escalated" | null
  >(null);
  const [askingSupportAssistant, setAskingSupportAssistant] = useState(false);
  const [savingSupportAssistantFeedback, setSavingSupportAssistantFeedback] =
    useState(false);
  const [loadingAdminTickets, setLoadingAdminTickets] = useState(false);
  const [selectedAdminTicketId, setSelectedAdminTicketId] = useState("");
  const [adminTicketReplyBody, setAdminTicketReplyBody] = useState("");
  const [adminTicketInternalNote, setAdminTicketInternalNote] = useState("");
  const [adminTicketStatus, setAdminTicketStatus] =
    useState<SupportTicketStatus>("open");
  const [adminTicketPriority, setAdminTicketPriority] =
    useState<SupportTicketPriority>("medium");
  const [adminTicketCategory, setAdminTicketCategory] = useState("general");
  const [adminTicketNeedsFollowup, setAdminTicketNeedsFollowup] =
    useState(true);
  const [adminTicketChangeNote, setAdminTicketChangeNote] = useState("");
  const [savingAdminTicketReply, setSavingAdminTicketReply] = useState(false);
  const [savingAdminTicketStatus, setSavingAdminTicketStatus] = useState(false);
  const [assistantReviewInteractions, setAssistantReviewInteractions] =
    useState<SupportAssistantInteraction[]>([]);
  const [assistantReviewAdminReviews, setAssistantReviewAdminReviews] =
    useState<SupportAssistantAdminReview[]>([]);
  const [askReviewSubmissions, setAskReviewSubmissions] = useState<
    AdminAskSubmission[]
  >([]);
  const [askRecommendationDecisions, setAskRecommendationDecisions] = useState<
    AskRecommendationDecision[]
  >([]);
  const [askSubmissionLinks, setAskSubmissionLinks] = useState<
    AskSubmissionLink[]
  >([]);
  const [
    askRecommendationDecisionSummary,
    setAskRecommendationDecisionSummary,
  ] = useState<AskRecommendationDecisionSummaryRow[]>([]);
  const [loadingAskReviews, setLoadingAskReviews] = useState(false);
  const [loadingAskRoutingSettings, setLoadingAskRoutingSettings] =
    useState(false);
  const [selectedAskReviewId, setSelectedAskReviewId] = useState("");
  const [askReviewRoutingState, setAskReviewRoutingState] =
    useState<AskRoutingState>("needs_review");
  const [askReviewNote, setAskReviewNote] = useState("");
  const [askRoutingSettingsDraft, setAskRoutingSettingsDraft] =
    useState<AskRoutingSettings>(defaultAskRoutingSettings);
  const [askModuleLabInput, setAskModuleLabInput] = useState("");
  const [askModuleLabKey, setAskModuleLabKey] =
    useState<AskModuleLabKey>("ask_router");
  const [askModuleLabResults, setAskModuleLabResults] = useState<
    AskModuleLabResult[]
  >([]);
  const [runningAskModuleLab, setRunningAskModuleLab] = useState(false);
  const [savingAskReviewAction, setSavingAskReviewAction] = useState(false);
  const [savingAskRoutingSettings, setSavingAskRoutingSettings] =
    useState(false);
  const [savingAskReview, setSavingAskReview] = useState(false);
  const [loadingAssistantReviews, setLoadingAssistantReviews] = useState(false);
  const [selectedAssistantReviewId, setSelectedAssistantReviewId] = useState("");
  const [assistantReviewOutcomeFilter, setAssistantReviewOutcomeFilter] =
    useState<"all" | SupportAssistantOutcome>("all");
  const [assistantReviewPromptFilter, setAssistantReviewPromptFilter] =
    useState("all");
  const [assistantReviewConfidenceFilter, setAssistantReviewConfidenceFilter] =
    useState<"all" | "high" | "low" | "medium" | "needs_review">("all");
  const [assistantReviewHasFeedbackOnly, setAssistantReviewHasFeedbackOnly] =
    useState(false);
  const [assistantReviewStatus, setAssistantReviewStatus] =
    useState<SupportAssistantReviewStatus>("needs_review");
  const [assistantReviewNote, setAssistantReviewNote] = useState("");
  const [assistantReviewRecommendedAction, setAssistantReviewRecommendedAction] =
    useState("");
  const [savingAssistantAdminReview, setSavingAssistantAdminReview] =
    useState(false);
  const [analyzingAssistantReviews, setAnalyzingAssistantReviews] = useState(false);
  const [assistantAnalysisResult, setAssistantAnalysisResult] =
    useState<SupportAssistantAnalysisResult | null>(null);
  const [assistantAnalysisRuns, setAssistantAnalysisRuns] = useState<
    SupportAssistantAnalysisRun[]
  >([]);
  const [selectedAssistantAnalysisRunId, setSelectedAssistantAnalysisRunId] =
    useState("");
  const [assistantAnalysisRunStatus, setAssistantAnalysisRunStatus] =
    useState<SupportAssistantAnalysisStatus>("reviewed");
  const [assistantAnalysisRunNote, setAssistantAnalysisRunNote] = useState("");
  const [savingAssistantAnalysisRunReview, setSavingAssistantAnalysisRunReview] =
    useState(false);
  const [loadingAppContent, setLoadingAppContent] = useState(false);
  const [savingAppContent, setSavingAppContent] = useState(false);
  const [revertingAppContentForId, setRevertingAppContentForId] = useState<
    string | null
  >(null);
  const [appContentLabel, setAppContentLabel] = useState(
    appContentOptions[0].label
  );
  const [appContentDescription, setAppContentDescription] = useState(
    appContentOptions[0].description
  );
  const [appContentBody, setAppContentBody] = useState(
    appContentDefaults.beta_notice_intro
  );
  const [appContentChangeNote, setAppContentChangeNote] = useState("");
  const [appContentSaveMessage, setAppContentSaveMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<
    Record<
      string,
      {
        followups: string;
        summary: string;
        takeaways: string;
      }
    >
  >(initialDraftState?.noteDrafts ?? {});
  const [appointmentDrafts, setAppointmentDrafts] = useState<
    Record<string, typeof emptyAppointmentDraft>
  >(initialDraftState?.appointmentDrafts ?? {});
  const [carePrepDrafts, setCarePrepDrafts] = useState<
    Record<string, typeof emptyCarePrepDraft>
  >(initialDraftState?.carePrepDrafts ?? {});
  const [editingCarePrepIds, setEditingCarePrepIds] = useState<
    Record<string, boolean>
  >(initialDraftState?.editingCarePrepIds ?? {});
  const [pendingCarePrepCloseId, setPendingCarePrepCloseId] = useState<
    string | null
  >(null);
  const [expandedCarePrepIds, setExpandedCarePrepIds] = useState<
    Record<string, boolean>
  >(initialAppointmentsPageViewState?.expandedCarePrepIds ?? {});
  const [editingAppointmentIds, setEditingAppointmentIds] = useState<
    Record<string, boolean>
  >(initialDraftState?.editingAppointmentIds ?? {});
  const [editingNoteIds, setEditingNoteIds] = useState<Record<string, boolean>>(
    initialDraftState?.editingNoteIds ?? {}
  );
  const [expandedVisitNotesAppointmentId, setExpandedVisitNotesAppointmentId] =
    useState<string | null>(
      initialAppointmentsPageViewState?.expandedVisitNotesAppointmentId ?? null
    );
  const [expandedMessagesAppointmentId, setExpandedMessagesAppointmentId] =
    useState<string | null>(
      initialAppointmentsPageViewState?.expandedMessagesAppointmentId ??
        initialDraftState?.appointmentMessageDraft?.appointmentId ??
        null
    );
  const [activeMessageComposerAppointmentId, setActiveMessageComposerAppointmentId] =
    useState<string | null>(
      initialDraftState?.appointmentMessageDraft?.appointmentId ?? null
    );
  const [appointmentMessageDraft, setAppointmentMessageDraft] =
    useState<AppointmentMessageComposerDraft | null>(
      initialDraftState?.appointmentMessageDraft ?? null
    );
	  const [pendingModifierSwitch, setPendingModifierSwitch] =
	    useState<PendingModifierSwitch | null>(null);
	  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [pendingMainTab, setPendingMainTab] = useState<MainTab | null>(null);
  const [pendingImportLeaveAction, setPendingImportLeaveAction] =
    useState<PendingImportLeaveAction | null>(null);
	  const [loading, setLoading] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [welcomePanelIndex, setWelcomePanelIndex] = useState(0);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [processingTextIntake, setProcessingTextIntake] = useState(false);
  const [extractingImageText, setExtractingImageText] = useState(false);
  const [fileImportStatus, setFileImportStatus] = useState("");
  const [appointmentNotesDragActive, setAppointmentNotesDragActive] =
    useState(false);
  const [pendingTextIntakePanelAction, setPendingTextIntakePanelAction] =
    useState<AppointmentPanel | "close" | null>(null);
  const [pendingAppointmentPanelView, setPendingAppointmentPanelView] =
    useState<AppointmentView | null>(null);
  const [savingTextIntake, setSavingTextIntake] = useState(false);
  const [creatingCareVip, setCreatingCareVip] = useState(false);
  const [deactivatingCareVipId, setDeactivatingCareVipId] = useState<
    string | null
  >(null);
  const [pendingDeactivateCareVipId, setPendingDeactivateCareVipId] = useState<
    string | null
  >(null);
  const [pendingReactivateCareVip, setPendingReactivateCareVip] = useState<{
    displayName: string;
    id: string;
  } | null>(null);
  const [careVipFormMessage, setCareVipFormMessage] = useState("");
  const [appointmentView, setAppointmentView] = useState<AppointmentView>(
    shouldShowAppointmentsMain
      ? "upcoming"
      : initialAppointmentsPageViewState?.appointmentView ?? "upcoming"
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    initialAppointmentsPageViewState?.selectedSubjectId ?? ALL_SUBJECTS
  );
  const [selectedHealthStorySubjectId, setSelectedHealthStorySubjectId] =
    useState(
      initialAppointmentsPageViewState?.selectedSubjectId &&
        initialAppointmentsPageViewState.selectedSubjectId !== ALL_SUBJECTS
        ? initialAppointmentsPageViewState.selectedSubjectId
        : ""
    );
  const [
    healthStorySubjectChooserOpen,
    setHealthStorySubjectChooserOpen,
  ] = useState(false);
  const newAppointmentTargetSubjectId =
    newAppointmentSubjectId ||
    (selectedSubjectId !== ALL_SUBJECTS ? selectedSubjectId : "");
  const canCreateNewAppointment =
    Boolean(newAppointmentTargetSubjectId) &&
    Boolean(newAppointmentTitle.trim()) &&
    Boolean(newAppointmentStartsAt.trim()) &&
    Boolean(newAppointmentLocationAddress.trim()) &&
    Boolean(newAppointmentProviderName.trim()) &&
    Boolean(newAppointmentReason.trim());
  const saveAppointmentsViewState = useCallback((
    overrides: Partial<AppointmentsPageViewState> = {}
  ) => {
    savePageViewState<AppointmentsPageViewState>("appointments", {
      activeAppointmentPanel,
      appointmentView,
      expandedCarePrepIds,
      expandedMessagesAppointmentId,
      expandedVisitNotesAppointmentId,
      scrollY: typeof window === "undefined" ? 0 : window.scrollY,
      selectedSubjectId,
      ...overrides,
      engaged: true,
    });
  }, [
    activeAppointmentPanel,
    appointmentView,
    expandedCarePrepIds,
    expandedMessagesAppointmentId,
    expandedVisitNotesAppointmentId,
    selectedSubjectId,
  ]);
  useEffect(() => {
    if (!shouldShowAppointmentsMain || typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("appointments") !== "1") {
      return;
    }

    if (!params.has("view") && !params.has("main")) {
      return;
    }

    window.history.replaceState({}, "", "/?personal=1&appointments=1");
  }, [shouldShowAppointmentsMain]);
  const [profileContactPersonId, setProfileContactPersonId] = useState(
    ACCOUNT_PROFILE_PERSON_ID
  );
  const [savingAppointmentForId, setSavingAppointmentForId] = useState<
    string | null
  >(null);
  const [archivingAppointmentForId, setArchivingAppointmentForId] = useState<
    string | null
  >(null);
  const [openAppointmentMenuId, setOpenAppointmentMenuId] = useState<
    string | null
  >(null);
  const [locationSheetAppointmentId, setLocationSheetAppointmentId] = useState<
    string | null
  >(null);
  const [pendingDeleteAppointmentId, setPendingDeleteAppointmentId] = useState<
    string | null
  >(null);
  const [deletingAppointmentForId, setDeletingAppointmentForId] = useState<
    string | null
  >(null);
  const [savingNoteForId, setSavingNoteForId] = useState<string | null>(null);
  const [generatingCarePrepForId, setGeneratingCarePrepForId] = useState<
    string | null
  >(null);
  const [carePrepGenerationErrors, setCarePrepGenerationErrors] = useState<
    Record<string, string>
  >({});
  const [savingCarePrepForId, setSavingCarePrepForId] = useState<string | null>(
    null
  );
  const [profileDraft, setProfileDraft] =
    useState<ProfileDraft>(emptyProfileDraft);
  const [savedProfileDraft, setSavedProfileDraft] =
    useState<ProfileDraft>(emptyProfileDraft);
  const [timezoneDetectionMessage, setTimezoneDetectionMessage] = useState("");
  const [savedProfileLabel, setSavedProfileLabel] = useState("");
  const [sampleDataSeededAt, setSampleDataSeededAt] = useState<string | null>(
    null
  );
  const [, setSampleDataDeclinedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!openAppointmentMenuId) {
      return;
    }

    function closeAppointmentMenuOnOutsideClick(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest("[data-appointment-menu]")
      ) {
        return;
      }

      setOpenAppointmentMenuId(null);
    }

    document.addEventListener("pointerdown", closeAppointmentMenuOnOutsideClick);

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeAppointmentMenuOnOutsideClick
      );
    };
  }, [openAppointmentMenuId]);
  const [seedingSampleData, setSeedingSampleData] = useState(false);
  const [removingSampleData, setRemovingSampleData] = useState(false);
  const [adminSampleEmail, setAdminSampleEmail] = useState("");
  const [adminSampleStatus, setAdminSampleStatus] =
    useState<SampleDataStatus | null>(null);
  const [adminSampleForceDeclined, setAdminSampleForceDeclined] =
    useState(false);
  const [loadingAdminSampleStatus, setLoadingAdminSampleStatus] =
    useState(false);
  const [seedingAdminSampleData, setSeedingAdminSampleData] = useState(false);
  const [adminEmailUpdateCurrentEmail, setAdminEmailUpdateCurrentEmail] =
    useState("");
  const [adminEmailUpdateNewEmail, setAdminEmailUpdateNewEmail] = useState("");
  const [adminEmailUpdateReason, setAdminEmailUpdateReason] = useState("");
  const [adminEmailUpdateResult, setAdminEmailUpdateResult] = useState("");
  const [updatingAdminUserEmail, setUpdatingAdminUserEmail] = useState(false);
  const [appSessionSettings, setAppSessionSettings] =
    useState<AppSessionSettings>(defaultAppSessionSettings);
  const [savingAppSessionSettings, setSavingAppSessionSettings] =
    useState(false);
  const [acceptBetaDisclaimer, setAcceptBetaDisclaimer] = useState(false);
  const [acceptBetaPrivacy, setAcceptBetaPrivacy] = useState(false);
  const [acceptBetaTerms, setAcceptBetaTerms] = useState(false);
  const [
    betaDisclaimerAcknowledgedAt,
    setBetaDisclaimerAcknowledgedAt,
  ] = useState<string | null>(null);
  const [betaPrivacyAcknowledgedAt, setBetaPrivacyAcknowledgedAt] = useState<
    string | null
  >(null);
  const [betaTermsAcknowledgedAt, setBetaTermsAcknowledgedAt] = useState<
    string | null
  >(null);
  const [onboardingCompletedAt, setOnboardingCompletedAt] = useState<
    string | null
  >(null);
  const [showOnboardingReady, setShowOnboardingReady] = useState(false);
  const [hasConfiguredReceiver, setHasConfiguredReceiver] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionProfileLoaded, setSessionProfileLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [welcomeGuideDismissed, setWelcomeGuideDismissed] = useState(false);
  const [restoringAppointmentForId, setRestoringAppointmentForId] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return new URLSearchParams(window.location.search).get(
      "adminAccessDenied"
    ) === "1"
      ? "Admin access is not enabled for this account."
      : "";
  });
  const [autoCarePrepStatus, setAutoCarePrepStatus] = useState<{
    appointmentId: string;
    id: number;
    message: string;
  } | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState("email");
  const [requiresEmailUpdate, setRequiresEmailUpdate] = useState(false);
  const signedInEmailRef = useRef<string | null>(null);
  const isAdminRef = useRef(false);
  const sessionProfileLoadedRef = useRef(false);
  const appSessionSettingsRef = useRef(defaultAppSessionSettings);
  const idleSigningOutRef = useRef(false);
  const homeAutoCarePrepInFlightRef = useRef<Set<string>>(new Set());
  const appointmentsPageAutoCarePrepInFlightRef = useRef(false);
  const appointmentsPageAutoCarePrepAttemptedRef = useRef<Set<string>>(
    new Set()
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const [appointmentPool, setAppointmentPool] = useState<Appointment[]>([]);
  const appointmentPoolRef = useRef<Appointment[]>([]);
  const appointmentViewRef = useRef<AppointmentView>(appointmentView);
  const selectedSubjectIdRef = useRef(selectedSubjectId);
  appointmentPoolRef.current = appointmentPool;
  appointmentViewRef.current = appointmentView;
  selectedSubjectIdRef.current = selectedSubjectId;
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hasAnySavedAppointments, setHasAnySavedAppointments] = useState(false);
  const [
    welcomeExistingAppointmentsVariant,
    setWelcomeExistingAppointmentsVariant,
  ] = useState<"firstActions" | "returnHome">("returnHome");
  const [homeNextAppointment, setHomeNextAppointment] =
    useState<Appointment | null>(null);
  const [homeNextAppointmentsBySubjectId, setHomeNextAppointmentsBySubjectId] =
    useState<Record<string, Appointment | null>>({});
  const [homeNextGuidance, setHomeNextGuidance] =
    useState<CarePrepGuidance | null>(null);
  const [appointmentDetailsHydrated, setAppointmentDetailsHydrated] =
    useState(false);
  const [healthStoryContextAnswer, setHealthStoryContextAnswer] = useState("");
  const [healthStoryContextError, setHealthStoryContextError] = useState<
    string | null
  >(null);
  const [healthStoryContextLoading, setHealthStoryContextLoading] =
    useState(false);
  const [notesReminderAppointment, setNotesReminderAppointment] =
    useState<NotesReminderAppointment | null>(null);
  const [healthFocusTopics, setHealthFocusTopics] = useState<
    HealthFocusTopicSummary[]
  >([]);
  const [healthFocusLoading, setHealthFocusLoading] = useState(false);
  const [homeTodayFocusGroups, setHomeTodayFocusGroups] = useState<
    HomeTodayFocusGroup[]
  >([]);
  const [homeTodayFocusLoading, setHomeTodayFocusLoading] = useState(false);
  const [homeMessageGroups, setHomeMessageGroups] = useState<HomeMessageGroup[]>(
    []
  );
  const [homeMessagesLoading, setHomeMessagesLoading] = useState(false);
  const [showHomeAtAGlanceTest, setShowHomeAtAGlanceTest] = useState(false);
  const [homeAtAGlanceExpanded, setHomeAtAGlanceExpanded] = useState(false);
  const [showAdminItems, setShowAdminItems] = useState(true);
  const canShowAdminItems = isAdmin && showAdminItems;
  const [selectedHealthFocusTopic, setSelectedHealthFocusTopic] =
    useState<HealthFocusTopicSummary | null>(null);
  const [healthFocusTopicDetail, setHealthFocusTopicDetail] =
    useState<HealthFocusTopicDetailData | null>(null);
  const [healthFocusDetailLoading, setHealthFocusDetailLoading] =
    useState(false);
  const healthFocusDetailCacheRef = useRef<
    Map<string, HealthFocusTopicDetailData>
  >(new Map());

  useEffect(() => {
    function syncShowAdminItems() {
      const enabled = readShowAdminItemsPreference();
      setShowAdminItems(enabled);

      if (!enabled) {
        setShowHomeAtAGlanceTest(false);
        setHomeAtAGlanceExpanded(false);
      }
    }

    syncShowAdminItems();
    window.addEventListener(adminItemsVisibilityChangedEvent, syncShowAdminItems);
    window.addEventListener("storage", syncShowAdminItems);

    return () => {
      window.removeEventListener(adminItemsVisibilityChangedEvent, syncShowAdminItems);
      window.removeEventListener("storage", syncShowAdminItems);
    };
  }, []);

  const healthFocusDetailPrefetchingRef = useRef<Set<string>>(new Set());
  const healthFocusBackfillAttemptedRef = useRef(new Set<string>());
  const appointmentMessagePrepBackfillAttemptedRef = useRef(new Set<string>());
  const [careSubjects, setCareSubjects] = useState<CareSubject[]>([]);
  const [entitlement, setEntitlement] =
    useState<CareCircleEntitlement>(defaultEntitlement);
  const [notes, setNotes] = useState<AppointmentNote[]>([]);
  const [guidance, setGuidance] = useState<CarePrepGuidance[]>([]);
  const [appointmentCommunicationSummaries, setAppointmentCommunicationSummaries] =
    useState<AppointmentCommunicationSummaryRow[]>([]);
  const [carePrepHistory, setCarePrepHistory] = useState<CarePrepHistoryRow[]>(
    []
  );
  const [intakeHistory, setIntakeHistory] = useState<IntakeHistoryRow[]>([]);
  const [historyAppointmentId, setHistoryAppointmentId] = useState("");

  const selectedAiWorkflowConfig = aiWorkflows[selectedAiWorkflow];
  const currentAppContentByKey = useMemo(() => {
    return new Map(
      appContentVersions
        .filter((version) => version.is_current)
        .map((version) => [version.content_key, version])
    );
  }, [appContentVersions]);
  const healthFocusContextLabelOverrides = useMemo(
    () => ({
      frequency: parseTopicContextLabelOverrides(
        currentAppContentByKey.get("health_focus_context_frequency_labels")
          ?.body ?? appContentDefaults.health_focus_context_frequency_labels
      ),
      recency: parseTopicContextLabelOverrides(
        currentAppContentByKey.get("health_focus_context_recency_labels")
          ?.body ?? appContentDefaults.health_focus_context_recency_labels
      ),
      span: parseTopicContextLabelOverrides(
        currentAppContentByKey.get("health_focus_context_span_labels")?.body ??
          appContentDefaults.health_focus_context_span_labels
      ),
    }),
    [currentAppContentByKey]
  );
  const selectedAppContentOption = appContentOptions.find(
    (item) => item.contentKey === selectedAppContentKey
  );
  const selectedAppContent =
    selectedAppContentOption?.category === selectedAppContentCategory
      ? currentAppContentByKey.get(selectedAppContentKey) ?? null
      : null;
  const selectedAppContentCategoryConfig =
    appContentCategories.find(
      (category) => category.key === selectedAppContentCategory
    ) ?? appContentCategories[0];
  const filteredAppContentOptions = appContentOptions.filter(
    (item) => item.category === selectedAppContentCategory
  );
  const agentKnowledgeVersions = useMemo(() => {
    const keys = [
      "support_agent_product_facts",
      "support_agent_known_limitations",
      "support_agent_escalation_guidance",
      "support_agent_voice_guidance",
    ];

    return appContentVersions.filter((version) =>
      keys.includes(version.content_key)
    );
  }, [appContentVersions]);
  const selectedAgentKnowledgeProposal =
    agentKnowledgeProposals.find(
      (proposal) => proposal.id === selectedAgentKnowledgeProposalId
    ) ??
    agentKnowledgeProposals[0] ??
    null;
  const selectedAgentKnowledgeProposalItems = selectedAgentKnowledgeProposal
    ? agentKnowledgeProposalItems.filter(
        (item) => item.proposal_id === selectedAgentKnowledgeProposal.id
      )
    : [];
  const selectedAgentKnowledgeProposalPublishableCount =
    selectedAgentKnowledgeProposalItems.filter((item) =>
      ["accepted", "edited"].includes(item.review_status)
    ).length;
  const adminAttentionFor = (
    scopeType: AdminViewScopeType,
    scopeKey: string
  ) => {
    if (scopeType === "admin_tab" && scopeKey === "ai") {
      return (
        adminAttentionSummaries[
          adminViewStateKey("ai_admin_tab", "proposals")
        ] ?? null
      );
    }

    if (!isActionableAdminAttentionScope(scopeType, scopeKey)) {
      return null;
    }

    return adminAttentionSummaries[adminViewStateKey(scopeType, scopeKey)] ?? null;
  };
  const adminLastViewedAt = (
    scopeType: AdminViewScopeType,
    scopeKey: string
  ) =>
    adminViewStates[adminViewStateKey(scopeType, scopeKey)]?.last_viewed_at ??
    null;
  const actionableAdminAttentionSummaries = Object.values(
    adminAttentionSummaries
  ).filter(
    (summary) =>
      isActionableAdminAttentionScope(summary.scope_type, summary.scope_key) &&
      !(summary.scope_type === "admin_tab" && summary.scope_key === "ai")
  );
  const selectedProductMgmtSectionConfig =
    productMgmtAreas.find(
      (section) => section.area_key === selectedProductMgmtSection
    ) ??
    productMgmtSections.find(
      (section) => section.key === selectedProductMgmtSection
    ) ??
    productMgmtSections[0];
  const visibleProductMgmtSections =
    productMgmtAreas.length > 0
      ? productMgmtAreas.map((area) => ({
          description: area.description ?? "Product management lane.",
          key: area.area_key,
          label: area.label,
        }))
      : [...productMgmtSections];
  const selectedProductMgmtArea =
    productMgmtAreas.find(
      (area) => area.area_key === selectedProductMgmtSection
    ) ?? productMgmtAreas[0] ?? null;
  const selectedProductMgmtItems = productMgmtItems.filter(
    (item) => item.area_id === selectedProductMgmtArea?.id
  );
  const openSupportTickets = userSupportTickets.filter(
    (ticket) => !["closed", "resolved"].includes(ticket.status)
  );
  const currentSupportTicket =
    openSupportTickets[0] ??
    userSupportTickets.find((ticket) => ticket.status === "resolved") ??
    null;
  const currentSupportMessages = currentSupportTicket
    ? userSupportTicketMessages.filter(
        (messageRow) => messageRow.ticket_id === currentSupportTicket.id
      )
    : [];
  const latestVisibleSupportMessage = [...currentSupportMessages]
    .reverse()
    .find((messageRow) => !messageRow.is_internal);
  const hasUpdatedSupportQuestion = Boolean(
    currentSupportTicket?.user_has_unread_update
  );
  const adminOpenTickets = adminSupportTickets.filter(
    (ticket) => !["closed", "resolved"].includes(ticket.status)
  );
  const adminTicketsNeedingFollowup = adminOpenTickets.filter(
    (ticket) => ticket.needs_admin_followup
  );
  const adminNewTickets = adminOpenTickets.filter(
    (ticket) => !ticket.needs_admin_followup
  );
  const selectedAdminTicket =
    adminSupportTickets.find((ticket) => ticket.id === selectedAdminTicketId) ??
    adminTicketsNeedingFollowup[0] ??
    adminOpenTickets[0] ??
    adminSupportTickets[0] ??
    null;
  const selectedAdminTicketMessages = selectedAdminTicket
    ? adminSupportTicketMessages.filter(
        (messageRow) => messageRow.ticket_id === selectedAdminTicket.id
      )
    : [];
  const assistantReviewPromptVersions = Array.from(
    new Set(
      assistantReviewInteractions
        .map((interaction) => interaction.prompt_version || "Unknown prompt")
        .filter(Boolean)
    )
  ).sort();
  const filteredAssistantReviewInteractions = assistantReviewInteractions.filter(
    (interaction) => {
      const promptVersion = interaction.prompt_version || "Unknown prompt";
      const confidenceLevel = aiReviewLevel(Number(interaction.confidence));

      return (
        (assistantReviewOutcomeFilter === "all" ||
          interaction.outcome === assistantReviewOutcomeFilter) &&
        (assistantReviewPromptFilter === "all" ||
          promptVersion === assistantReviewPromptFilter) &&
        (assistantReviewConfidenceFilter === "all" ||
          confidenceLevel === assistantReviewConfidenceFilter) &&
        (!assistantReviewHasFeedbackOnly ||
          Boolean(interaction.user_feedback?.trim()))
      );
    }
  );
  const selectedAssistantReviewInteraction =
    filteredAssistantReviewInteractions.find(
      (interaction) => interaction.id === selectedAssistantReviewId
    ) ??
    filteredAssistantReviewInteractions[0] ??
    null;
  const selectedAssistantAdminReviews = selectedAssistantReviewInteraction
    ? assistantReviewAdminReviews.filter(
        (review) => review.interaction_id === selectedAssistantReviewInteraction.id
      )
    : [];
  const selectedAskReviewSubmission =
    askReviewSubmissions.find(
      (submission) => submission.id === selectedAskReviewId
    ) ??
    askReviewSubmissions.find((submission) => submission.routing_state !== "closed") ??
    askReviewSubmissions[0] ??
    null;
  const selectedAssistantAnalysisRun =
    assistantAnalysisRuns.find((run) => run.id === selectedAssistantAnalysisRunId) ??
    assistantAnalysisRuns[0] ??
    null;
  const adminUserActivityStats = useMemo(
    () => buildAdminUserActivityStats(adminUserActivity),
    [adminUserActivity]
  );
  const earlyAccessIntakeStats = useMemo(() => {
    const activeRows = earlyAccessIntakeRows.filter(
      (row) => !["closed", "converted", "not_a_fit"].includes(row.status)
    );

    return {
      active: activeRows.length,
      contacted: earlyAccessIntakeRows.filter((row) => row.status === "contacted")
        .length,
      interested: earlyAccessIntakeRows.filter(
        (row) => row.status === "interested"
      ).length,
      total: earlyAccessIntakeRows.length,
    };
  }, [earlyAccessIntakeRows]);
  const earlyAccessIntakeNewCount = earlyAccessIntakeRows.filter(
    (row) => row.status === "new"
  ).length;
  const earlyAccessIntakeFollowupCount = earlyAccessIntakeRows.filter((row) =>
    ["new", "reviewing", "contacted", "interested"].includes(row.status)
  ).length;
  const {
    activeAdminTopTab,
    adminDashboardFollowupCount,
    adminDashboardNewCount,
    adminTabForTopTab,
    supportAdminNavItems,
    supportAdminTabs,
    systemAdminNavItems,
    systemAdminTabs,
    topAdminNavItems,
    usersAdminNavItems,
  } = createAdminNavigationModel({
    actionableAdminAttentionSummaries,
    adminAttentionFor,
    adminIntegrationErrors,
    adminLastViewedAt,
    adminNewTicketsLength: adminNewTickets.length,
    adminTab,
    adminTicketsNeedingFollowupLength: adminTicketsNeedingFollowup.length,
    assistantReviewAdminReviews,
    assistantReviewInteractions,
    earlyAccessIntakeFollowupCount,
    earlyAccessIntakeNewCount,
    isNewForAdmin,
  });
  const filteredEarlyAccessIntakeRows = useMemo(() => {
    if (earlyAccessIntakeFilter === "all") {
      return earlyAccessIntakeRows;
    }

    if (earlyAccessIntakeFilter === "active") {
      return earlyAccessIntakeRows.filter(
        (row) => !["closed", "converted", "not_a_fit"].includes(row.status)
      );
    }

    return earlyAccessIntakeRows.filter(
      (row) => row.status === earlyAccessIntakeFilter
    );
  }, [earlyAccessIntakeFilter, earlyAccessIntakeRows]);
  const filteredAdminUserActivity = useMemo(
    () =>
      filterAdminUserActivity({
        filter: adminUserActivityFilter,
        rows: adminUserActivity,
        sort: adminUserActivitySort,
      }),
    [adminUserActivity, adminUserActivityFilter, adminUserActivitySort]
  );
  const adminIntegrationErrorKeys = useMemo(
    () => adminIntegrationErrors.map((row) => adminIntegrationErrorRowKey(row)),
    [adminIntegrationErrors]
  );
  const selectedVisibleAdminIntegrationErrorKeys = useMemo(
    () =>
      adminIntegrationErrorKeys.filter((key) =>
        selectedAdminIntegrationErrorKeys.includes(key)
      ),
    [adminIntegrationErrorKeys, selectedAdminIntegrationErrorKeys]
  );
  const allAdminIntegrationErrorsSelected =
    adminIntegrationErrorKeys.length > 0 &&
    selectedVisibleAdminIntegrationErrorKeys.length ===
      adminIntegrationErrorKeys.length;
  const filteredFavoriteLocations = useMemo(() => {
    const query = placeLookupQuery.trim().toLowerCase();

    if (!query) {
      return favoriteLocations.slice(0, 5);
    }

    return favoriteLocations
      .filter((location) =>
        [
          location.nickname,
          location.place_name,
          location.address,
          location.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 5);
  }, [favoriteLocations, placeLookupQuery]);
  const adminIntegrationErrorStats = useMemo(() => {
    const dayRows = adminIntegrationErrors.filter(
      (row) => row.window_grain === "day"
    );
    const minuteRows = adminIntegrationErrors.filter(
      (row) => row.window_grain === "minute"
    );

    return {
      affectedUsers: dayRows.reduce(
        (total, row) => total + Number(row.affected_user_count ?? 0),
        0
      ),
      dayWindows: dayRows.length,
      latestErrorAt: adminIntegrationErrors[0]?.latest_occurred_at ?? null,
      minuteWindows: minuteRows.length,
    };
  }, [adminIntegrationErrors]);

  function appContentText(key: string) {
    return (
      currentAppContentByKey.get(key)?.body ??
      (appContentDefaults as Record<string, string>)[key] ??
      ""
    );
  }

  function autoCarePrepSuccessText(appointment: Appointment) {
    return appContentText("careprep_auto_success_message").replaceAll(
      "{appointmentTitle}",
      appointment.title?.trim() || "the next appointment"
    );
  }

	  const notesByAppointment = useMemo(() => {
	    return new Map(notes.map((note) => [note.appointment_id, note]));
	  }, [notes]);

	  const appointmentsById = useMemo(() => {
    return new Map(
      [...appointmentPool, ...appointments].map((appointment) => [
        appointment.id,
        appointment,
      ])
    );
	  }, [appointmentPool, appointments]);

  const communicationItemsByAppointment = useMemo(() => {
    return new Map(
      appointmentCommunicationSummaries.map((summary) => [
        summary.appointment_id,
        normalizeAppointmentCommunicationInventory(summary.summary_items).items,
      ])
    );
  }, [appointmentCommunicationSummaries]);

  const guidanceByAppointment = useMemo(() => {
    return new Map(
      guidance
        .filter((item) => item.is_current)
        .map((item) => [item.appointment_id, item])
    );
  }, [guidance]);

  const draftGuidanceByAppointment = useMemo(() => {
    return new Map(
      guidance
        .filter((item) => item.review_status === "draft")
        .map((item) => [item.appointment_id, item])
    );
  }, [guidance]);

  const subjectsById = useMemo(() => {
    return new Map(careSubjects.map((subject) => [subject.id, subject]));
  }, [careSubjects]);

  const actualPricingTier = pricingTierForEntitlement(entitlement);
  const previewPricingTier =
    isAdmin && adminPlanPreviewId
      ? pricingTiers.find((tier) => tier.id === adminPlanPreviewId)
      : null;
  const currentPricingTier = previewPricingTier ?? actualPricingTier;
  const careVipLimit = Math.max(
    entitlement.max_active_subjects || 1,
    currentPricingTier.id === "early_access" ? 5 : 1
  );
  const isPreviewingPlan = Boolean(
    previewPricingTier && previewPricingTier.id !== actualPricingTier.id
  );
  const currentPlanPanelLines = appContentText(
    planProfilePanelContentKey(currentPricingTier.id)
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const currentPlanSummary =
    currentPlanPanelLines[0] || currentPricingTier.profileSummary;
  const currentPlanFeatureRows = currentPlanPanelLines
    .slice(1)
    .map((line) => {
      const [label, ...valueParts] = line.split(":");
      const value = valueParts.join(":").trim();

      return value
        ? [label.trim(), value]
        : ["", line];
    });
  const canUseMultipleCareVips = careVipLimit > 1;
  const canFilterCareVips = careSubjects.length > 1;
  const canAddCareVip = careSubjects.length < careVipLimit;
  const importAnythingIdentityResolutionReady =
    importAnythingIdentityResolutionChoices.length > 0 &&
    importAnythingIdentityResolutionChoices.every((choice) => {
      if (choice.action === "match") {
        return Boolean(choice.matchedCareSubjectId);
      }

      if (choice.action === "create") {
        return Boolean(choice.createName.trim());
      }

      return choice.action === "leave_unresolved";
    });
  const carePlandFocusOptions = useMemo<CarePlandFocusOption[]>(() => {
    return [
      {
        id: ALL_SUBJECTS,
        label: "Everyone",
        type: "everyone",
      },
      ...careSubjects.map((subject) => ({
        avatar: careSubjectAvatarPerson(subject),
        id: subject.id,
        label: subject.display_name,
        type: "person" as const,
      })),
    ];
  }, [careSubjects]);
  const activeHealthStorySubjectId = useMemo(() => {
    const onlySubject = careSubjects[0] ?? null;

    if (
      careSubjects.length === 1 &&
      onlySubject &&
      !onlySubject.is_default &&
      selectedSubjectId === ALL_SUBJECTS
    ) {
      return "";
    }

    if (
      selectedHealthStorySubjectId &&
      careSubjects.some((subject) => subject.id === selectedHealthStorySubjectId)
    ) {
      return selectedHealthStorySubjectId;
    }

    if (
      selectedSubjectId &&
      selectedSubjectId !== ALL_SUBJECTS &&
      careSubjects.some((subject) => subject.id === selectedSubjectId)
    ) {
      return selectedSubjectId;
    }

    return careSubjects[0]?.id ?? "";
  }, [careSubjects, selectedHealthStorySubjectId, selectedSubjectId]);
  const activeHealthStorySubject =
    activeHealthStorySubjectId
      ? subjectsById.get(activeHealthStorySubjectId) ?? null
      : null;
  const healthStoryTitle =
    !activeHealthStorySubject || activeHealthStorySubject.is_default
      ? "Your Health Stories"
      : `${possessiveName(activeHealthStorySubject.display_name)} Health Stories`;
  const healthStoryFocusOptions = useMemo(
    () =>
      careSubjects.map((subject) => ({
        avatar: careSubjectAvatarPerson(subject),
        id: subject.id,
        label: subject.display_name,
      })),
    [careSubjects]
  );
  useEffect(() => {
    if (careSubjects.length === 0) {
      if (selectedHealthStorySubjectId) {
        setSelectedHealthStorySubjectId("");
      }
      return;
    }

    if (
      selectedSubjectId !== ALL_SUBJECTS &&
      careSubjects.some((subject) => subject.id === selectedSubjectId)
    ) {
      if (selectedHealthStorySubjectId !== selectedSubjectId) {
        setSelectedHealthStorySubjectId(selectedSubjectId);
      }
      return;
    }

    if (careSubjects.length === 1 && !careSubjects[0].is_default) {
      if (selectedHealthStorySubjectId) {
        setSelectedHealthStorySubjectId("");
      }
      return;
    }

    if (
      !selectedHealthStorySubjectId ||
      !careSubjects.some((subject) => subject.id === selectedHealthStorySubjectId)
    ) {
      setSelectedHealthStorySubjectId(careSubjects[0].id);
    }
  }, [careSubjects, selectedHealthStorySubjectId, selectedSubjectId]);
	  const hasUnsavedProfileChanges =
	    profileDraftKey(profileDraft) !== profileDraftKey(savedProfileDraft);
	  const hasUnaddedCareVipName = newCareVipName.trim().length > 0;
  const unsavedSignOutChanges = useMemo(() => {
    return buildUnsavedSignOutChanges({
      adminRecommendationsReviewDraft: adminRecommendationsReviewDraftSummary,
      appointmentMessageDraft,
      appointmentDrafts,
      appointmentsById,
      askConversationComplete,
      askInput,
      askMessagesLength: askMessages.length,
      bulkAppointmentDraftsLength: bulkAppointmentDrafts.length,
      carePrepDrafts,
      contextualTextIntakeValue,
      editingAppointmentIds,
      editingNoteIds,
      emptyAppointmentDraft,
      emptyNoteDraft,
      getCarePrepSavedDraft: (appointmentId) => {
        const savedCarePrep =
          guidanceByAppointment.get(appointmentId) ??
          draftGuidanceByAppointment.get(appointmentId);

        return savedCarePrep ? carePrepGuidanceFormValues(savedCarePrep) : null;
      },
      getSavedAppointmentDetails: (appointment) => ({
        ...appointment,
        startsAt: toDatetimeLocalValue(appointment.starts_at),
      }),
      hasUnaddedCareVipName,
      hasUnsavedProfileChanges,
      importAnythingItemsLength: importAnythingItems.length,
      importAnythingSourcesLength: importAnythingSources.length,
      newAppointmentDraft,
      newCareVipName,
      noteDrafts,
      notesByAppointment,
      textIntakeDraft,
      textIntakeTargetAppointmentId,
      textIntakeValue,
    });
  }, [
	    adminRecommendationsReviewDraftSummary,
    appointmentMessageDraft,
	    appointmentDrafts,
	    appointmentsById,
	    askConversationComplete,
	    askInput,
	    askMessages.length,
	    bulkAppointmentDrafts.length,
	    carePrepDrafts,
	    contextualTextIntakeValue,
	    draftGuidanceByAppointment,
	    editingAppointmentIds,
	    editingNoteIds,
	    guidanceByAppointment,
	    hasUnaddedCareVipName,
	    hasUnsavedProfileChanges,
	    importAnythingItems.length,
	    importAnythingSources.length,
	    newAppointmentDraft,
	    newCareVipName,
	    noteDrafts,
	    notesByAppointment,
	    textIntakeDraft,
	    textIntakeTargetAppointmentId,
	    textIntakeValue,
	  ]);
  const hasUnsavedWorkForLeave = hasAnyUnsavedWork(unsavedSignOutChanges);
  const importAnythingPanelHasUnfinishedWork =
    activeAppointmentPanel === "quickAdd" &&
    textIntakePanelHasUnsavedChanges({
      bulkAppointmentDraftsLength: bulkAppointmentDrafts.length,
      importAnythingItemsLength: importAnythingItems.length,
      importAnythingSourcesLength: importAnythingSources.length,
      textIntakeDraft,
      textIntakeValue,
    });
	  const hasAcceptedBetaAgreement =
	    Boolean(betaDisclaimerAcknowledgedAt) &&
    Boolean(betaPrivacyAcknowledgedAt) &&
    Boolean(betaTermsAcknowledgedAt);
  const isSignedInProfileLoading =
    Boolean(signedInEmail) &&
    authMode !== "updatePassword" &&
    !sessionProfileLoaded;
  const needsBetaAgreement =
    Boolean(signedInEmail) &&
    sessionProfileLoaded &&
    !hasAcceptedBetaAgreement;
  const needsOnboarding =
    Boolean(signedInEmail) &&
    sessionProfileLoaded &&
    hasAcceptedBetaAgreement &&
    (!onboardingCompletedAt || requiresEmailUpdate);
  const profileDetailsRequired = requiresEmailUpdate || authProvider === "email";
  const verifiedAccountEmail = signedInEmail ?? profileDraft.email;
  const passwordsMismatch =
    (authMode === "signUp" || authMode === "updatePassword") &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;
  const canSubmitAuth = !loading && !passwordsMismatch;
  const showWelcomeGuide =
    Boolean(signedInEmail) &&
    !needsBetaAgreement &&
    !needsOnboarding &&
    mainTab === "home" &&
    !welcomeGuideDismissed;

  useEffect(() => {
    if (!signedInEmail || needsBetaAgreement) {
      setHasConfiguredReceiver(false);
      return;
    }

    let cancelled = false;

    async function loadReceiverStatus() {
      try {
        const response = await fetch("/api/connect/provisioning/summary", {
          cache: "no-store",
        });
        const payload: unknown = await response.json().catch(() => null);

        if (cancelled || !response.ok) {
          return;
        }

        const payloadRecord = payload as {
          provisioning?: { receiverDevices?: unknown };
          receiverDevices?: unknown;
        } | null;
        const receiverDeviceValue =
          payloadRecord?.receiverDevices ??
          payloadRecord?.provisioning?.receiverDevices;
        const receiverDevices = Array.isArray(receiverDeviceValue)
          ? (receiverDeviceValue as Array<{ status?: unknown }>)
          : [];

        setHasConfiguredReceiver(
          receiverDevices.some((device) => device.status === "bound")
        );
      } catch {
        if (!cancelled) {
          setHasConfiguredReceiver(false);
        }
      }
    }

    void loadReceiverStatus();

    return () => {
      cancelled = true;
    };
  }, [needsBetaAgreement, signedInEmail]);

  function discardUnsavedWorkState() {
    setProfileDraft(savedProfileDraft);
    setNewCareVipName("");
    setManagingCareVips(false);
    setNewAppointmentDraft({ ...emptyAppointmentDraft });
    setNewAppointmentSubjectId("");
    setAppointmentDrafts({});
    setEditingAppointmentIds({});
    setNoteDrafts({});
    setEditingNoteIds({});
    setCarePrepDrafts({});
    setEditingCarePrepIds({});
    setPendingCarePrepCloseId(null);
    setActiveMessageComposerAppointmentId(null);
    setAppointmentMessageDraft(null);
    setBulkAppointmentDrafts([]);
    setBulkAppointmentSummary("");
    setImportAnythingOwnerPersonId("");
    setTextIntakeSubjectId("");
    setTextIntakeValue("");
    setTextIntakeDraft(null);
    setTextIntakeAiDraft(null);
    setTextIntakeItemId(null);
    setTextIntakeMatches([]);
    setSelectedTextIntakeMatchId("new");
    setTextIntakeTargetAppointmentId(null);
    setContextualTextIntakeValue("");
    setApplyTextIntakeAppointmentDetails(false);
    setPendingTextIntakePanelAction(null);
    setPendingImportLeaveAction(null);
    setPendingModifierSwitch(null);
    setAskThreadId(null);
    setAskInput("");
    setAskMessages([]);
    setAskConversationComplete(false);
    setAskPanelError("");
    setAskCloseConfirmOpen(false);
    setAdminRecommendationsReviewDraftSummary(null);
    clearAdminRecommendationsReviewDraftStorage();
    resetPlaceLookup();

    if (typeof window !== "undefined") {
      removeStoredValue(window.sessionStorage, appDraftStateStorageKey);
    }
  }

  useEffect(() => {
    signedInEmailRef.current = signedInEmail;
  }, [signedInEmail]);

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  useEffect(() => {
    sessionProfileLoadedRef.current = sessionProfileLoaded;
  }, [sessionProfileLoaded]);

  useEffect(() => {
    appSessionSettingsRef.current = appSessionSettings;
  }, [appSessionSettings]);

  const homeCarePrepHighlights = useMemo(() => {
    if (!homeNextGuidance) {
      return [];
    }

    return [
      { items: asTextList(homeNextGuidance.key_questions), label: "Ask" },
      { items: asTextList(homeNextGuidance.bring_list), label: "Bring" },
      { items: asTextList(homeNextGuidance.watchouts), label: "Watch" },
    ]
      .map((section) => ({
        ...section,
        items: section.items.filter(Boolean).slice(0, 2),
      }))
      .filter((section) => section.items.length > 0);
  }, [homeNextGuidance]);

  function readLastSessionActivityAt() {
    if (typeof window === "undefined") {
      return null;
    }

    const rawValue = window.localStorage.getItem(appLastActivityStorageKey);
    const timestamp = rawValue ? Number(rawValue) : NaN;

    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function recordSessionActivity() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        appLastActivityStorageKey,
        String(Date.now())
      );
    } catch {
      // Storage can be unavailable in private or locked-down browser contexts.
    }
  }

  async function signOutIfIdleExpired() {
    if (
      idleSigningOutRef.current ||
      !signedInEmailRef.current ||
      !sessionProfileLoadedRef.current
    ) {
      return false;
    }

    const timeoutHours = sessionIdleTimeoutHours(
      appSessionSettingsRef.current,
      isAdminRef.current
    );

    if (timeoutHours === null) {
      return false;
    }

    const lastActivityAt = readLastSessionActivityAt();

    if (!lastActivityAt) {
      recordSessionActivity();
      return false;
    }

    const idleForMs = Date.now() - lastActivityAt;
    const timeoutMs = timeoutHours * 60 * 60 * 1000;

    if (idleForMs < timeoutMs) {
      return false;
    }

    idleSigningOutRef.current = true;
    await handleSignOut({
      bypassUnsavedChangesWarning: true,
      message: `For your privacy, CarePland signed you out after ${timeoutHours} hours without activity.`,
    });
    idleSigningOutRef.current = false;

    return true;
  }

  async function establishAuthRedirectSession(): Promise<string | null> {
    if (typeof window === "undefined") {
      return null;
    }

    const currentUrl = new URL(window.location.href);
    const hashParams = new URLSearchParams(
      currentUrl.hash.replace(/^#/, "")
    );
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        throw error;
      }

      return data.session?.user.email ?? null;
    }

    const code = currentUrl.searchParams.get("code");

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        throw error;
      }

      return data.session?.user.email ?? null;
    }

    return null;
  }

  useEffect(() => {
    const hydrationFlagTimeoutId = window.setTimeout(() => {
      setRuntimeEnvironmentLabel(
        nonProductionEnvironmentLabel(
          window.location.hostname,
          process.env.NEXT_PUBLIC_CAREPLAND_ENV
        )
      );
    }, 0);

    async function restoreSession() {
      try {
        const isRecoveryRedirect = isPasswordRecoveryRedirect();
        const isGoogleRedirect = isGoogleAuthRedirect();
        const isConfirmationRedirect = isEmailConfirmationRedirect();

        if (isRecoveryRedirect) {
          setLoading(true);

          try {
            const recoveryEmail = await establishAuthRedirectSession();

            if (recoveryEmail) {
              setSignedInEmail(recoveryEmail);
              setWelcomeGuideDismissed(false);
              setEmail(recoveryEmail);
            }

            setAuthMode("updatePassword");
            setPassword("");
            setConfirmPassword("");
            setMessage("Enter a new password to finish resetting your password.");
          } catch (error) {
            logAuthError("passwordRecoverySession", error);
            setAuthMode("reset");
            setMessage(
              "This password reset link could not be opened. Please request a fresh reset email and use the newest link."
            );
          } finally {
            setLoading(false);
            setSessionRestored(true);
          }

          return;
        }

        if (isGoogleRedirect) {
          setLoading(true);

          try {
            const redirectError =
              new URLSearchParams(window.location.search).get(
                "error_description"
              ) ??
              new URLSearchParams(window.location.hash.replace(/^#/, "")).get(
                "error_description"
              );

            if (redirectError) {
              throw new Error(redirectError);
            }

            const googleEmail = await establishAuthRedirectSession();

            if (!googleEmail) {
              throw new Error("Google sign-in did not return an active session.");
            }

            setSessionProfileLoaded(false);
            setSignedInEmail(googleEmail);
            setWelcomeGuideDismissed(false);
            setEmail(googleEmail);
            recordSessionActivity();
            clearAuthRedirectUrl();
            void loadAppContent();
            void loadAppSessionSettings();
            await loadAppointments();
          } catch (error) {
            logAuthError("googleOAuthSession", error);
            setAuthMode("signIn");
            setSignedInEmail(null);
            setMessage(
              "Google sign-in could not be completed. Please try again, or use email and password."
            );
            clearAuthRedirectUrl();
          } finally {
            setLoading(false);
            setSessionRestored(true);
          }

          return;
        }

        if (isConfirmationRedirect) {
          setLoading(true);

          try {
            const confirmationEmail = await establishAuthRedirectSession();
            await supabase.auth.signOut();
            setSignedInEmail(null);
            setWelcomeGuideDismissed(false);
            if (confirmationEmail) {
              setEmail(confirmationEmail);
            }
            setAuthMode("signIn");
            setPassword("");
            setConfirmPassword("");
            setMessage("Account verified. Sign in to continue.");
            clearAuthRedirectUrl();
          } catch (error) {
            logAuthError("emailConfirmationSession", error);
            setAuthMode("signIn");
            setMessage("Account verified. Sign in to continue.");
            clearAuthRedirectUrl();
          } finally {
            setLoading(false);
            setSessionRestored(true);
          }

          return;
        }

        const { data } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          "CarePland could not restore your previous session."
        );
        const sessionEmail = data.session?.user.email ?? null;

        if (sessionEmail) {
          setSessionProfileLoaded(false);
          setSignedInEmail(sessionEmail);
          setWelcomeGuideDismissed(false);
          setEmail(sessionEmail);

          setLoading(true);

          try {
            void loadAppContent();
            void loadAppSessionSettings();
            await loadAppointments(
              initialAppointmentsPageViewState?.appointmentView,
              initialAppointmentsPageViewState?.selectedSubjectId
            );
            void loadCurrentUserSupportTickets();

            if (initialUiState?.mainTab === "admin") {
              if (initialUiState.adminTab === "ai") {
                void Promise.all([
                  loadAiInstructions(initialUiState.selectedAiWorkflow),
                  loadAppContent(),
                  loadAgentKnowledgeProposals(),
                ]);
              } else if (initialUiState.adminTab === "product") {
                void loadProductMgmt();
              } else if (initialUiState.adminTab === "tickets") {
                void loadAdminSupportTickets();
              } else if (initialUiState.adminTab === "assistantReview") {
                void Promise.all([
                  loadAskReviewSubmissions(),
                  loadAssistantReviewInteractions(),
                ]);
              } else if (initialUiState.adminTab === "users") {
                void loadAdminUserActivity();
              } else if (initialUiState.adminTab === "intake") {
                void loadEarlyAccessIntake();
              } else if (initialUiState.adminTab === "userAudit") {
                void loadAdminAccessEvents();
              } else if (initialUiState.adminTab === "errors") {
                void loadAdminIntegrationErrors();
              } else if (initialUiState.adminTab === "content") {
                void loadAppContent(initialUiState.selectedAppContentKey);
              } else if (initialUiState.adminTab === "dashboard") {
                void loadAdminAttentionOverview();
              }
            }
          } catch (error) {
            setMessage(getErrorMessage(error));
          } finally {
            setLoading(false);
            setSessionRestored(true);
          }
        } else {
          setSessionRestored(true);
        }
      } catch (error) {
        logAuthError("restoreSession", error);
        setLoading(false);
        setSignedInEmail(null);
        setSessionProfileLoaded(false);
        setSessionRestored(true);
        setMessage(
          "CarePland could not restore your previous session. Please sign in again."
        );
      }
    }

    restoreSession();
    return () => window.clearTimeout(hydrationFlagTimeoutId);
    // This runs once on page load to restore Supabase session state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "PASSWORD_RECOVERY") {
        return;
      }

      const recoveryEmail = session?.user.email ?? "";

      setAuthMode("updatePassword");
      setSignedInEmail(recoveryEmail || null);
      setEmail(recoveryEmail);
      setPassword("");
      setConfirmPassword("");
      setMessage("Enter a new password to finish resetting your password.");
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const updateStickyOffset = () => {
      setStickySecondaryOffset(
        Math.ceil(mainHeaderRef.current?.getBoundingClientRect().height ?? 0)
      );
    };

    updateStickyOffset();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateStickyOffset);

    if (mainHeaderRef.current) {
      resizeObserver?.observe(mainHeaderRef.current);
    }

    window.addEventListener("resize", updateStickyOffset);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateStickyOffset);
    };
  }, [
    adminOpenTickets.length,
    adminTicketsNeedingFollowup.length,
    authMode,
    isAdmin,
    needsBetaAgreement,
    needsOnboarding,
    savedProfileLabel,
    signedInEmail,
  ]);

  useEffect(() => {
    const handleVersionInfoKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowVersionInfo(false);
      }
    };

    window.addEventListener("keydown", handleVersionInfoKeydown);

    return () => window.removeEventListener("keydown", handleVersionInfoKeydown);
  }, []);

  useEffect(() => {
    if (!toast?.durationMs) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setToast((currentToast) =>
        currentToast?.id === toast.id ? null : currentToast
      );
    }, toast.durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (!autoCarePrepStatus) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAutoCarePrepStatus((currentStatus) =>
        currentStatus?.id === autoCarePrepStatus.id ? null : currentStatus
      );
    }, 9000);

    return () => window.clearTimeout(timeoutId);
  }, [autoCarePrepStatus]);

  useEffect(() => {
    if (!adminReadonlySnapshot) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      adminReadonlyPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [adminReadonlySnapshot]);

  useEffect(() => {
    if (!signedInEmail || needsBetaAgreement || needsOnboarding) {
      return;
    }

    const touchActivity = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void (async () => {
        try {
          const { error } = await supabase.rpc("touch_profile_activity");

          if (error) {
            console.warn("Could not update profile activity", error);
          }
        } catch (error) {
          console.warn("Could not update profile activity", error);
        }
      })();
    };

    touchActivity();

    const intervalId = window.setInterval(touchActivity, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", touchActivity);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", touchActivity);
    };
  }, [needsBetaAgreement, needsOnboarding, signedInEmail]);

  useEffect(() => {
    if (
      !signedInEmail ||
      authMode === "updatePassword" ||
      needsBetaAgreement ||
      needsOnboarding ||
      activeAppointmentPanel !== "add"
    ) {
      return;
    }

    void loadFavoriteLocations();
    // Load favorite locations only when the add-appointment panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeAppointmentPanel,
    authMode,
    needsBetaAgreement,
    needsOnboarding,
    signedInEmail,
  ]);

  useEffect(() => {
    if (
      !signedInEmail ||
      authMode === "updatePassword" ||
      needsBetaAgreement ||
      needsOnboarding ||
      activeAppointmentPanel !== "add"
    ) {
      return;
    }

    const query = placeLookupQuery.trim();

    if (query.length < 3) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void searchGooglePlaces(query);
    }, 450);

    return () => window.clearTimeout(timeoutId);
    // Search is intentionally debounced from the current query only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeAppointmentPanel,
    authMode,
    needsBetaAgreement,
    needsOnboarding,
    placeLookupQuery,
    signedInEmail,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!signedInEmail || !sessionProfileLoaded) {
      return;
    }

    let cancelled = false;

    const handleActivity = () => {
      void signOutIfIdleExpired().then((signedOut) => {
        if (!signedOut && !cancelled) {
          recordSessionActivity();
        }
      });
    };

    const checkIdle = () => {
      void signOutIfIdleExpired();
    };

    checkIdle();

    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    window.addEventListener("focus", checkIdle);
    document.addEventListener("visibilitychange", checkIdle);
    const intervalId = window.setInterval(checkIdle, 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("focus", checkIdle);
      document.removeEventListener("visibilitychange", checkIdle);
    };
    // Idle enforcement reads current values from refs so the interval/listeners
    // do not need to be recreated for every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appSessionSettings, isAdmin, sessionProfileLoaded, signedInEmail]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    writeStoredJson(window.localStorage, appUiStateStorageKey, {
      adminTab,
      aiAdminTab,
      mainTab,
      selectedAiWorkflow,
      selectedAppContentCategory,
      selectedAppContentKey,
      selectedProductMgmtSection,
    } satisfies StoredUiState);
  }, [
    adminTab,
    aiAdminTab,
    mainTab,
    selectedAiWorkflow,
    selectedAppContentCategory,
    selectedAppContentKey,
    selectedProductMgmtSection,
  ]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      mainTab !== "appointments" ||
      restoredAppointmentsScrollRef.current
    ) {
      return;
    }

    const restoredState =
      restorePageViewState<AppointmentsPageViewState>("appointments");

    if (!restoredState?.engaged || !restoredState.scrollY) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: restoredState.scrollY });
      restoredAppointmentsScrollRef.current = true;
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [appointments.length, mainTab, sessionRestored]);

  useEffect(() => {
    if (typeof window === "undefined" || mainTab !== "appointments") {
      return;
    }

    let frameId = 0;

    const saveScrollPosition = () => {
      const restoredState =
        restorePageViewState<AppointmentsPageViewState>("appointments");

      if (!restoredState?.engaged) {
        return;
      }

      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        saveAppointmentsViewState({ scrollY: window.scrollY });
      });
    };

    window.addEventListener("scroll", saveScrollPosition, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", saveScrollPosition);
    };
  }, [
    activeAppointmentPanel,
    appointmentView,
    expandedCarePrepIds,
    expandedVisitNotesAppointmentId,
    mainTab,
    saveAppointmentsViewState,
    selectedSubjectId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    writeStoredJson(window.sessionStorage, appDraftStateStorageKey, {
      appointmentMessageDraft,
      appointmentDrafts,
      bulkAppointmentDrafts,
      bulkAppointmentSummary,
      carePrepDrafts,
      contextualTextIntakeValue,
      editingAppointmentIds,
      editingCarePrepIds,
      editingNoteIds,
      confirmingImportAnythingSaveAll,
      importAnythingIntakeItemId,
      importAnythingItems,
      importAnythingIdentityResolutionChoices,
      importAnythingIdentityResolutionOpen,
      importAnythingNewPersonName,
      importAnythingOwnerPersonId,
      importAnythingOwnershipClusters,
      importAnythingPersonAssignment,
      importAnythingReviewOpen,
      importAnythingSources,
      importAnythingSummary,
      newAppointmentDraft: {
        ...newAppointmentDraft,
        subjectId: newAppointmentSubjectId,
      },
      noteDrafts,
      selectedTextIntakeMatchId,
      textIntakeAiDraft,
      textIntakeDraft,
      textIntakeItemId,
      textIntakeMatches,
      textIntakeSubjectId,
      textIntakeTargetAppointmentId,
      textIntakeValue,
    } satisfies StoredDraftState);
  }, [
    appointmentMessageDraft,
    appointmentDrafts,
    bulkAppointmentDrafts,
    bulkAppointmentSummary,
    carePrepDrafts,
    contextualTextIntakeValue,
    editingAppointmentIds,
    editingCarePrepIds,
    editingNoteIds,
    confirmingImportAnythingSaveAll,
    importAnythingIntakeItemId,
    importAnythingItems,
    importAnythingIdentityResolutionChoices,
    importAnythingIdentityResolutionOpen,
    importAnythingNewPersonName,
    importAnythingOwnerPersonId,
    importAnythingOwnershipClusters,
    importAnythingPersonAssignment,
    importAnythingReviewOpen,
    importAnythingSources,
    importAnythingSummary,
    newAppointmentDraft,
    newAppointmentSubjectId,
    noteDrafts,
    selectedTextIntakeMatchId,
    textIntakeAiDraft,
    textIntakeDraft,
    textIntakeItemId,
    textIntakeMatches,
    textIntakeSubjectId,
    textIntakeTargetAppointmentId,
    textIntakeValue,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || !signedInEmail || !hasUnsavedWorkForLeave) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedWorkForLeave, signedInEmail]);

  function showToast(
    messageText: string,
    options: Omit<ToastState, "id" | "message"> = {}
  ) {
    setToast({
      durationMs: options.type === "error" ? undefined : 5000,
      id: Date.now(),
      message: messageText,
      type: "info",
      ...options,
    });
  }

  function focusAppointmentCarePrep(appointmentId: string) {
    setAppointmentView("upcoming");
    setCarePrepExpandedForAppointment(appointmentId, true);
    window.setTimeout(() => {
      document
        .getElementById(`appointment-${appointmentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function markWelcomeGuideRead() {
    setWelcomeGuideDismissed(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const userId = userData.user?.id;

      if (!userId) {
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          welcome_guide_dismissed_at: new Date().toISOString(),
          welcome_guide_dismissed_version: currentWelcomeGuideVersion,
        })
        .eq("id", userId);

      if (error) {
        throw error;
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function getPrimaryCareContext(preferredSubjectId?: string) {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    const userId = userData.user?.id;

    if (!userId) {
      throw new Error("Please sign in before adding an appointment.");
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("care_circle_memberships")
      .select("care_circle_id,role,created_at")
      .eq("user_id", userId)
      .eq("status", "active");

    if (membershipsError) {
      throw membershipsError;
    }

    const careCircleId = primaryCareCircleIdFromMemberships(
      memberships as CareCircleMembership[] | null
    );

    if (!careCircleId) {
      throw new Error("No care circle membership found for this user.");
    }

    const { data: subjects, error: subjectsError } = await supabase
      .from("care_subjects")
      .select("id,is_default")
      .eq("care_circle_id", careCircleId)
      .eq("is_active", true)
      .order("is_default", { ascending: false });

    if (subjectsError) {
      throw subjectsError;
    }

    const careSubjectId =
      preferredSubjectId && preferredSubjectId !== ALL_SUBJECTS
        ? preferredSubjectId
        : subjects?.find((subject) => subject.is_default)?.id ??
          subjects?.[0]?.id ??
          null;

    return {
      careCircleId,
      careSubjectId,
      userId,
    };
  }

  async function assignCurrentUserEarlyAccessPlan() {
    const { data, error } = await supabase.rpc(
      "assign_current_user_primary_plan",
      { p_plan_id: "early_access" }
    );

    if (error) {
      throw error;
    }

    const status =
      data && typeof data === "object" && "status" in data
        ? String(data.status)
        : "";

    if (status && status !== "updated") {
      throw new Error("Early Access plan assignment was not completed.");
    }
  }

  async function loadAppSessionSettings() {
    try {
      const { data, error } = await supabase
        .from("app_session_settings")
        .select(
          "settings_key,user_idle_timeout_hours,admin_idle_timeout_hours,updated_at"
        )
        .eq("settings_key", "default")
        .limit(1);

      if (error) {
        throw error;
      }

      setAppSessionSettings(normalizeAppSessionSettings(data?.[0]));
    } catch (error) {
      console.warn("Could not load app session settings", error);
      setAppSessionSettings(defaultAppSessionSettings);
    }
  }

  async function handleSaveAppSessionSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAppSessionSettings(true);
    setMessage("");

    try {
      const normalizedSettings =
        normalizeAppSessionSettings(appSessionSettings);
      const { data, error } = await supabase.rpc(
        "update_app_session_settings",
        {
          p_admin_idle_timeout_hours:
            normalizedSettings.admin_idle_timeout_hours,
          p_user_idle_timeout_hours:
            normalizedSettings.user_idle_timeout_hours,
        }
      );

      if (error) {
        throw error;
      }

      setAppSessionSettings(normalizeAppSessionSettings(data));
      showToast("Session settings saved.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAppSessionSettings(false);
    }
  }

  function updateProfileDraft(field: keyof ProfileDraft, value: string) {
    if (field === "timezone") {
      setTimezoneDetectionMessage("");
    }

    setProfileDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  function applyProfileAddress(address: PlaceAddressResult) {
    setProfileDraft((currentDraft) => ({
      ...currentDraft,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      country: "US",
      postalCode: formatUsZipFromDigits(zipDigits(address.postalCode)),
      region: address.region,
    }));
  }

  function appointmentMatchesSubject(
    appointment: Appointment,
    subjectId: string
  ) {
    return (
      subjectId === ALL_SUBJECTS || appointment.care_subject_id === subjectId
    );
  }

  function sortAppointmentsForView(
    appointmentsToSort: Appointment[],
    view: AppointmentView
  ) {
    appointmentsToSort.sort((firstAppointment, secondAppointment) => {
      if (!firstAppointment.starts_at && !secondAppointment.starts_at) {
        return 0;
      }

      if (!firstAppointment.starts_at) {
        return 1;
      }

      if (!secondAppointment.starts_at) {
        return -1;
      }

      const firstTime = new Date(firstAppointment.starts_at).getTime();
      const secondTime = new Date(secondAppointment.starts_at).getTime();

      if (view === "upcoming") {
        return firstTime - secondTime;
      }

      return secondTime - firstTime;
    });
  }

  function applyAppointmentSelection(
    loadedAppointments: Appointment[],
    view: AppointmentView,
    subjectId: string,
    loadedGuidance: CarePrepGuidance[] = guidance,
    loadedCareSubjects: CareSubject[] = careSubjects
  ) {
    const upcomingStart = startOfToday();
    const subjectAppointments = loadedAppointments.filter((appointment) =>
      appointmentMatchesSubject(appointment, subjectId)
    );
    const nextAppointmentFor = (appointmentsForSubject: Appointment[]) =>
      appointmentsForSubject
        .filter((appointment) => {
          if (appointment.status === "archived") {
            return false;
          }

          if (!appointment.starts_at) {
            return true;
          }

          return new Date(appointment.starts_at) >= upcomingStart;
        })
        .sort((firstAppointment, secondAppointment) => {
          if (!firstAppointment.starts_at && !secondAppointment.starts_at) {
            return 0;
          }

          if (!firstAppointment.starts_at) {
            return 1;
          }

          if (!secondAppointment.starts_at) {
            return -1;
          }

          return (
            new Date(firstAppointment.starts_at).getTime() -
            new Date(secondAppointment.starts_at).getTime()
          );
        })[0] ?? null;
    const reminderAppointment =
      subjectAppointments
        .filter(
          (appointment) =>
            appointment.care_circle_id &&
            appointment.status !== "archived" &&
            !appointment.current_note_id &&
            appointment.starts_at &&
            new Date(appointment.starts_at) < upcomingStart
        )
        .sort((firstAppointment, secondAppointment) => {
          if (!firstAppointment.starts_at || !secondAppointment.starts_at) {
            return 0;
          }

          return (
            new Date(secondAppointment.starts_at).getTime() -
            new Date(firstAppointment.starts_at).getTime()
          );
        })[0] ?? null;
    const nextHomeAppointment = nextAppointmentFor(subjectAppointments);
    const nextAppointmentsBySubjectId = loadedCareSubjects.reduce<
      Record<string, Appointment | null>
    >((nextBySubject, subject) => {
      nextBySubject[subject.id] = nextAppointmentFor(
        loadedAppointments.filter((appointment) =>
          appointmentMatchesSubject(appointment, subject.id)
        )
      );
      return nextBySubject;
    }, {});
    const visibleAppointments = subjectAppointments.filter((appointment) =>
      view === "archived"
        ? appointment.status === "archived"
        : view === "logged"
          ? appointment.status !== "archived" &&
            Boolean(appointment.current_note_id)
          : appointment.status !== "archived" &&
            !appointment.current_note_id &&
            (!appointment.starts_at ||
              new Date(appointment.starts_at) >= upcomingStart)
    );

    sortAppointmentsForView(visibleAppointments, view);
    setHasAnySavedAppointments(loadedAppointments.length > 0);
    setNotesReminderAppointment(
      reminderAppointment && reminderAppointment.care_circle_id
        ? {
            ...reminderAppointment,
            care_circle_id: reminderAppointment.care_circle_id,
          }
        : null
    );
    setHomeNextAppointment(nextHomeAppointment);
    setHomeNextAppointmentsBySubjectId(nextAppointmentsBySubjectId);
    setAppointments(visibleAppointments);
    setHomeNextGuidance(
      nextHomeAppointment
        ? loadedGuidance.find(
            (row) =>
              row.appointment_id === nextHomeAppointment.id &&
              row.review_status === "draft"
          ) ??
            loadedGuidance.find(
              (row) =>
                row.appointment_id === nextHomeAppointment.id && row.is_current
            ) ??
            null
        : null
    );
  }

  function hydrateAppointmentsFromSessionSnapshot(
    view: AppointmentView,
    subjectId: string
  ) {
    if (typeof window === "undefined") {
      return false;
    }

    const snapshot = readStoredJson<AppointmentsSessionSnapshot>(
      window.sessionStorage,
      appointmentsSessionSnapshotStorageKey
    );

    if (!snapshot?.appointmentPool || !snapshot.careSubjects) {
      return false;
    }

    const snapshotAgeMs = Date.now() - new Date(snapshot.savedAt).getTime();

    if (!Number.isFinite(snapshotAgeMs) || snapshotAgeMs > 10 * 60 * 1000) {
      removeStoredValue(
        window.sessionStorage,
        appointmentsSessionSnapshotStorageKey
      );
      return false;
    }

    const effectiveSubjectId =
      subjectId === ALL_SUBJECTS ||
      snapshot.careSubjects.some((subject) => subject.id === subjectId)
        ? subjectId
        : ALL_SUBJECTS;

    setEntitlement(snapshot.entitlement);
    setCareSubjects(snapshot.careSubjects);
    setSelectedSubjectId(effectiveSubjectId);
    setAppointmentPool(snapshot.appointmentPool);
    setAppointmentDetailsHydrated(false);
    applyAppointmentSelection(
      snapshot.appointmentPool,
      view,
      effectiveSubjectId,
      guidance,
      snapshot.careSubjects
    );

    return true;
  }

  async function hydrateAppointmentDetails(
    loadedAppointments: Appointment[]
  ) {
    const appointmentIds = loadedAppointments.map((item) => item.id);

    if (appointmentIds.length === 0) {
      setNotes([]);
      setGuidance([]);
      setAppointmentCommunicationSummaries([]);
      applyAppointmentSelection([], appointmentViewRef.current, selectedSubjectIdRef.current, []);
      setAppointmentDetailsHydrated(true);
      return;
    }

    try {
      const [
        { data: noteRows, error: notesError },
        { data: guidanceRows, error: guidanceError },
        { data: communicationSummaryRows, error: communicationSummaryError },
      ] = await Promise.all([
        supabase
          .from("appointment_notes")
          .select(
            "id,appointment_id,summary_short,takeaways,followups,is_current,version_number,superseded_at,superseded_by_note_id"
          )
          .in("appointment_id", appointmentIds)
          .eq("is_current", true),
        supabase
          .from("careprep_guidance")
          .select(
            "id,appointment_id,generated_at,summary,key_questions,bring_list,watchouts,med_review,since_last_visit,next_steps,is_current,version_number,review_status,source,superseded_at,superseded_by_guidance_id,edited_from_guidance_id,ai_generated_guidance_id"
          )
          .in("appointment_id", appointmentIds)
          .or("is_current.eq.true,review_status.eq.draft")
          .order("generated_at", { ascending: true }),
        supabase
          .from("appointment_communication_summaries")
          .select("appointment_id,summary_items,summary_version,generation_status")
          .in("appointment_id", appointmentIds),
      ]);

      if (notesError) {
        throw notesError;
      }

      if (guidanceError) {
        throw guidanceError;
      }

      if (communicationSummaryError) {
        console.warn(
          "Unable to load appointment communication summaries.",
          communicationSummaryError
        );
      }

      const loadedGuidanceRows = guidanceRows ?? [];
      const currentPool = appointmentPoolRef.current.length
        ? appointmentPoolRef.current
        : loadedAppointments;
      const loadedCommunicationSummaryRows = communicationSummaryError
        ? []
        : ((communicationSummaryRows ?? []) as AppointmentCommunicationSummaryRow[]);
      setNotes(noteRows ?? []);
      setGuidance(loadedGuidanceRows);
      setAppointmentCommunicationSummaries((currentSummaries) =>
        mergeLoadedAppointmentCommunicationSummaries({
          appointmentIds,
          currentSummaries,
          loadedSummaries: loadedCommunicationSummaryRows,
        })
      );
      applyAppointmentSelection(
        currentPool,
        appointmentViewRef.current,
        selectedSubjectIdRef.current,
        loadedGuidanceRows
      );
      setAppointmentDetailsHydrated(true);
    } catch (error) {
      console.warn("Unable to hydrate appointment details", error);
      setAppointmentDetailsHydrated(false);
    }
  }

  async function loadHealthFocusSummary(
    subjectId: string = selectedSubjectId,
    options: { forceRefresh?: boolean } = {}
  ) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setHealthFocusTopics([]);
      setSelectedHealthFocusTopic(null);
      setHealthFocusTopicDetail(null);
      return;
    }

    if (!options.forceRefresh) {
      const cachedSummary = readHealthFocusSummaryCache(
        signedInEmail,
        subjectId
      );

      if (cachedSummary) {
        const nextTopics = cachedSummary.topics;

        setHealthFocusTopics(nextTopics);

        if (selectedHealthFocusTopic) {
          const refreshedSelectedTopic = nextTopics.find(
            (topic) =>
              topic.topicSlug === selectedHealthFocusTopic.topicSlug &&
              topic.careSubjectId === selectedHealthFocusTopic.careSubjectId
          );

          if (refreshedSelectedTopic) {
            setSelectedHealthFocusTopic(refreshedSelectedTopic);
          } else {
            setSelectedHealthFocusTopic(null);
            setHealthFocusTopicDetail(null);
          }
        }

        return;
      }
    }

    setHealthFocusLoading(true);

    try {
      const params = new URLSearchParams();

      if (subjectId && subjectId !== ALL_SUBJECTS) {
        params.set("careSubjectId", subjectId);
      }

      const response = await fetch(
        `/api/health-topics/summary${params.size ? `?${params}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const result = (await response.json()) as {
        error?: string;
        ok?: boolean;
        topics?: HealthFocusTopicSummary[];
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Health Focus could not be loaded.");
      }

      let nextTopics = result.topics ?? [];
      const backfillKey = subjectId || ALL_SUBJECTS;

      if (!healthFocusBackfillAttemptedRef.current.has(backfillKey)) {
        healthFocusBackfillAttemptedRef.current.add(backfillKey);

        try {
          const backfillBody: Record<string, unknown> = { limit: 50 };

          if (subjectId && subjectId !== ALL_SUBJECTS) {
            backfillBody.careSubjectId = subjectId;
          }

          const backfillResponse = await fetch("/api/health-topics/backfill", {
            body: JSON.stringify(backfillBody),
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            method: "POST",
          });
          const backfillResult = (await backfillResponse.json().catch(() => null)) as
            | {
                error?: string;
                errors?: Array<{ error: string; noteId: string }>;
                failedCount?: number;
                noteCount?: number;
                ok?: boolean;
                processedCount?: number;
                topicSlugs?: string[];
              }
            | null;

          if (!backfillResponse.ok || backfillResult?.ok === false) {
            console.warn("Health Focus backfill did not complete.", backfillResult);
          }

          if (backfillResponse.ok) {
            const retryResponse = await fetch(
              `/api/health-topics/summary${params.size ? `?${params}` : ""}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );
            const retryResult = (await retryResponse.json()) as {
              error?: string;
              ok?: boolean;
              topics?: HealthFocusTopicSummary[];
            };

            if (retryResponse.ok && retryResult.ok) {
              nextTopics = retryResult.topics ?? [];
            }
          }
        } catch (error) {
          console.warn("Unable to backfill Health Focus summary", error);
        }
      }

      writeHealthFocusSummaryCache(signedInEmail, subjectId, nextTopics);
      setHealthFocusTopics(nextTopics);

      if (selectedHealthFocusTopic) {
        const refreshedSelectedTopic = nextTopics.find(
          (topic) =>
            topic.topicSlug === selectedHealthFocusTopic.topicSlug &&
            topic.careSubjectId === selectedHealthFocusTopic.careSubjectId
        );

        if (refreshedSelectedTopic) {
          setSelectedHealthFocusTopic(refreshedSelectedTopic);
        } else {
          setSelectedHealthFocusTopic(null);
          setHealthFocusTopicDetail(null);
        }
      }
    } catch (error) {
      console.warn("Unable to load Health Focus summary", error);
      setHealthFocusTopics([]);
      setSelectedHealthFocusTopic(null);
      setHealthFocusTopicDetail(null);
    } finally {
      setHealthFocusLoading(false);
    }
  }

  useEffect(() => {
    if (!signedInEmail || mainTab !== "home") {
      return;
    }

    if (!activeHealthStorySubjectId) {
      setHealthFocusTopics([]);
      setSelectedHealthFocusTopic(null);
      setHealthFocusTopicDetail(null);
      return;
    }

    void loadHealthFocusSummary(activeHealthStorySubjectId);
    // loadHealthFocusSummary intentionally uses current auth/session state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHealthStorySubjectId, mainTab, signedInEmail]);

  async function loadHomeTodayFocus() {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const accessToken = sessionData.session?.access_token;

    if (!accessToken || careSubjects.length === 0) {
      setHomeTodayFocusGroups([]);
      return;
    }

    const subjectsToLoad =
      selectedSubjectId === ALL_SUBJECTS
        ? careSubjects
        : careSubjects.filter((subject) => subject.id === selectedSubjectId);

    if (subjectsToLoad.length === 0) {
      setHomeTodayFocusGroups([]);
      return;
    }

    setHomeTodayFocusLoading(true);

    try {
      const results = await Promise.allSettled(
        subjectsToLoad.map(async (subject) => {
          const testingItems = homeTestingTodayFocusItemsForSubject(subject);
          const response = await fetch(
            `/api/personal/today-focus?personId=${encodeURIComponent(subject.id)}`,
            {
              cache: "no-store",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
          const result = (await response.json().catch(() => ({}))) as {
            focusItems?: HomeTodayFocusItem[];
            ok?: boolean;
          };

          if (!response.ok || result.ok === false) {
            return testingItems.length > 0
              ? ({
                  items: testingItems,
                  subjectAvatar: careSubjectAvatarPerson(subject),
                  subjectId: subject.id,
                  subjectLabel: subject.is_default ? "You" : subject.display_name,
                  subjectName: subject.is_default ? "you" : subject.display_name,
                } satisfies HomeTodayFocusGroup)
              : null;
          }

          const storedItems = (result.focusItems ?? [])
            .filter((item) => item.id && item.title)
            .slice(0, 3);
          const items = storedItems.length > 0 ? storedItems : testingItems;

          if (items.length === 0) {
            return null;
          }

          return {
            items,
            subjectAvatar: careSubjectAvatarPerson(subject),
            subjectId: subject.id,
            subjectLabel: subject.is_default ? "You" : subject.display_name,
            subjectName: subject.is_default ? "you" : subject.display_name,
          } satisfies HomeTodayFocusGroup;
        })
      );

      setHomeTodayFocusGroups(
        results
          .map((result) =>
            result.status === "fulfilled" ? result.value : null
          )
          .filter((group): group is HomeTodayFocusGroup => Boolean(group))
      );
    } catch (error) {
      console.warn("Unable to load Home Today's Focus", error);
      setHomeTodayFocusGroups([]);
    } finally {
      setHomeTodayFocusLoading(false);
    }
  }

  useEffect(() => {
    if (!signedInEmail || mainTab !== "home") {
      return;
    }

    void loadHomeTodayFocus();
    // loadHomeTodayFocus intentionally uses current auth/session and subject state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careSubjects, mainTab, selectedSubjectId, signedInEmail]);

  async function loadHomeMessages() {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setHomeMessageGroups([]);
      return;
    }

    const subjectsToLoad =
      selectedSubjectId === ALL_SUBJECTS
        ? mainTab === "appointments"
          ? careSubjects
          : []
        : careSubjects.filter((item) => item.id === selectedSubjectId);

    if (subjectsToLoad.length === 0) {
      setHomeMessageGroups([]);
      return;
    }

    setHomeMessagesLoading(true);

    try {
      const results = await Promise.allSettled(
        subjectsToLoad.map(async (subject) => {
          const response = await fetch(
            `/api/personal/messages?personId=${encodeURIComponent(subject.id)}&limit=30`,
            {
              cache: "no-store",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
          const result = (await response.json().catch(() => ({}))) as {
            error?: string;
            messages?: PersonalMessage[];
            ok?: boolean;
          };

          if (!response.ok || result.ok === false) {
            console.warn("Unable to load Home messages", {
              error: result.error || response.statusText,
              personId: subject.id,
              status: response.status,
            });
            return null;
          }

          return {
            messages: result.messages ?? [],
            subjectId: subject.id,
          } satisfies HomeMessageGroup;
        })
      );

      setHomeMessageGroups(
        results
          .map((result) =>
            result.status === "fulfilled" ? result.value : null
          )
          .filter((group): group is HomeMessageGroup => Boolean(group))
      );
    } catch (error) {
      console.warn("Unable to load Home messages", error);
      setHomeMessageGroups([]);
    } finally {
      setHomeMessagesLoading(false);
    }
  }

  async function submitHomeMessageSummaryFeedback({
    decisionTrace,
    keyPoints,
    personId,
    sourceMessageIds,
    summary,
    userComment,
  }: {
    decisionTrace: Record<string, unknown>;
    keyPoints: Array<Record<string, unknown>>;
    personId: string;
    sourceMessageIds: string[];
    summary: string;
    userComment: string;
  }) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error("Please sign in before sending summary feedback.");
    }

    const response = await fetch("/api/personal/messages/summary-feedback", {
      body: JSON.stringify({
        decisionTrace,
        keyPoints,
        personId,
        sourceMessageIds,
        summary,
        summaryModelVersion: homeMessageSummaryModelVersion,
        userComment,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      ok?: boolean;
    };

    if (!response.ok || result.ok === false) {
      throw new Error(result.error || "Unable to send summary feedback.");
    }
  }

  useEffect(() => {
    if (!signedInEmail || (mainTab !== "home" && mainTab !== "appointments")) {
      return;
    }

    void loadHomeMessages();
    // loadHomeMessages intentionally uses current auth/session and subject state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careSubjects, mainTab, selectedSubjectId, signedInEmail]);

  useEffect(() => {
    if (!signedInEmail || mainTab !== "appointments" || appointments.length === 0) {
      return;
    }

    void rebuildMissingAppointmentMessagePrepSummaries();
    // rebuildMissingAppointmentMessagePrepSummaries intentionally uses current
    // appointment, message, and summary state to backfill only visible gaps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appointmentCommunicationSummaries,
    appointments,
    homeMessageGroups,
    mainTab,
    signedInEmail,
  ]);

  async function rebuildMissingAppointmentMessagePrepSummaries() {
    const candidates = appointments
      .map((appointment) => {
        if (!appointment.care_subject_id) return null;
        const messages =
          homeMessageGroups
            .find((group) => group.subjectId === appointment.care_subject_id)
            ?.messages.filter((message) => message.appointmentId === appointment.id) ?? [];
        if (messages.length === 0) return null;
        const existingSummary = appointmentCommunicationSummaries.find(
          (summary) => summary.appointment_id === appointment.id
        );
        const hasActiveMessagePrepItems = normalizeAppointmentCommunicationInventory(
          existingSummary?.summary_items
        ).items.some((item) => item.status === "active");
        if (hasActiveMessagePrepItems) return null;
        const messageFingerprint = messages
          .map((message) => message.id)
          .filter(Boolean)
          .sort()
          .join(",");
        const attemptKey = `${appointment.id}:${messageFingerprint}`;
        if (appointmentMessagePrepBackfillAttemptedRef.current.has(attemptKey)) {
          return null;
        }

        return {
          appointmentId: appointment.id,
          attemptKey,
          personId: appointment.care_subject_id,
        };
      })
      .filter(
        (
          candidate
        ): candidate is {
          appointmentId: string;
          attemptKey: string;
          personId: string;
        } => Boolean(candidate)
      )
      .slice(0, 3);

    if (candidates.length === 0) return;

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      console.warn("Unable to rebuild MessagePrep summaries.", sessionError);
      return;
    }

    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return;

    for (const candidate of candidates) {
      appointmentMessagePrepBackfillAttemptedRef.current.add(candidate.attemptKey);
      try {
        const summary = await requestAppointmentMessagePrepRebuild({
          accessToken,
          appointmentId: candidate.appointmentId,
          personId: candidate.personId,
        });
        if (!summary) {
          continue;
        }

        setAppointmentCommunicationSummaries((currentSummaries) => {
          const others = currentSummaries.filter(
            (currentSummary) => currentSummary.appointment_id !== summary.appointment_id
          );
          return [...others, summary];
        });
      } catch (error) {
        console.warn("Unable to rebuild MessagePrep summary.", error);
      }
    }
  }

  function appointmentViewForAppointment(appointment: Appointment): AppointmentView {
    if (appointment.status === "archived") {
      return "archived";
    }

    if (appointment.current_note_id) {
      return "logged";
    }

    return "upcoming";
  }

  function openMessageAppointment(message: PersonalMessage) {
    const appointmentId = message.appointmentId;

    if (!appointmentId) {
      openMessagesPage();
      return;
    }

    const appointment = appointmentPool.find((item) => item.id === appointmentId);

    if (!appointment) {
      openMessagesPage();
      return;
    }

    const nextView = appointmentViewForAppointment(appointment);

    const nextSubjectId = appointment.care_subject_id || selectedSubjectId;

    setSelectedSubjectId(nextSubjectId);
    updatePersonalRoute("appointments");
    setMainTab("appointments");
    setAppointmentView(nextView);
    setPendingModifierSwitch(null);
    setPendingAppointmentPanelView(null);
    setActiveAppointmentPanel(null);
    setMessage("");
    applyAppointmentSelection(appointmentPool, nextView, nextSubjectId);
    setExpandedVisitNotesAppointmentId(appointment.id);
    saveAppointmentsViewState({
      appointmentView: nextView,
      expandedVisitNotesAppointmentId: appointment.id,
      selectedSubjectId: nextSubjectId,
    });

    window.setTimeout(() => {
      document
        .getElementById(`appointment-${appointment.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function openMessagesPage(appointment?: Pick<Appointment, "care_subject_id" | "id">) {
    if (!appointment?.id) {
      window.location.assign("/connect/dashboard");
      return;
    }

    const params = new URLSearchParams({
      appointmentId: appointment.id,
    });

    if (appointment.care_subject_id) {
      params.set("personId", appointment.care_subject_id);
    }

    window.location.assign(`/connect/dashboard?${params}`);
  }

  function openReceiverSetup() {
    window.location.assign("/connect/dashboard?receiverSetup=home");
  }

  async function handleHomeContextQuestion(
    question: string,
    askContext: HomeContextAskContext = { level: "global" }
  ) {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      return;
    }

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      setHealthStoryContextError(getErrorMessage(sessionError));
      return;
    }

    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setHealthStoryContextError("Please sign in before asking for more context.");
      return;
    }

    setHealthStoryContextLoading(true);
    setHealthStoryContextError(null);

    try {
      const body: {
        askContext: HomeContextAskContext;
        careSubjectId?: string;
        question: string;
      } = {
        askContext,
        question: trimmedQuestion,
      };

      if (askContext.careSubjectId) {
        body.careSubjectId = askContext.careSubjectId;
      } else if (selectedSubjectId && selectedSubjectId !== ALL_SUBJECTS) {
        body.careSubjectId = selectedSubjectId;
      }

      const response = await fetch("/api/home-context", {
        body: JSON.stringify(body),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as {
        answer?: string;
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "CarePland could not answer that yet.");
      }

      const nextAnswer = result.answer ?? "";
      setHealthStoryContextAnswer(nextAnswer);
      return nextAnswer;
    } catch (error) {
      setHealthStoryContextError(getErrorMessage(error));
    } finally {
      setHealthStoryContextLoading(false);
    }
  }

  function currentActiveAskContext() {
    return buildActiveAskContext({
      allSubjectsValue: ALL_SUBJECTS,
      formatDate,
      homeNextAppointment,
      mainTab,
      selectedSubjectId,
    });
  }

  function topAskConversationTurns(): HomeContextAskContext["conversationTurns"] {
    const turns: NonNullable<HomeContextAskContext["conversationTurns"]> = [];
    let pendingQuestion = "";

    askMessages.forEach((message) => {
      if (message.role === "user") {
        pendingQuestion = message.body;
        return;
      }

      if (pendingQuestion && message.role === "assistant") {
        turns.push({
          answer: message.body,
          question: pendingQuestion,
        });
        pendingQuestion = "";
      }
    });

    return turns.slice(-4);
  }

  function healthFocusTopicCacheKey(topic: HealthFocusTopicSummary) {
    return `${topic.careSubjectId || ALL_SUBJECTS}:${topic.topicSlug}`;
  }

  function rememberHealthFocusTopicDetail(
    topic: HealthFocusTopicSummary,
    detail: HealthFocusTopicDetailData
  ) {
    const cache = healthFocusDetailCacheRef.current;
    const key = healthFocusTopicCacheKey(topic);

    if (cache.has(key)) {
      cache.delete(key);
    }

    cache.set(key, detail);

    while (cache.size > 12) {
      const oldestKey = cache.keys().next().value;

      if (!oldestKey) {
        break;
      }

      cache.delete(oldestKey);
    }
  }

  async function fetchHealthFocusTopicDetail(
    topic: HealthFocusTopicSummary
  ): Promise<HealthFocusTopicDetailData | null> {
    const cacheKey = healthFocusTopicCacheKey(topic);
    const cachedDetail = healthFocusDetailCacheRef.current.get(cacheKey);

    if (cachedDetail) {
      return cachedDetail;
    }

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      return null;
    }

    const params = new URLSearchParams({
      topicSlug: topic.topicSlug,
    });

    if (topic.careSubjectId && topic.careSubjectId !== ALL_SUBJECTS) {
      params.set("careSubjectId", topic.careSubjectId);
    }

    const response = await fetch(`/api/health-topics/detail?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const result = (await response.json()) as {
      contextSignature?: HealthFocusTopicDetailData["contextSignature"];
      displayName?: string;
      error?: string;
      isSampleData?: boolean;
      latestMentionAt?: string | null;
      mentionCount?: number;
      mentions?: HealthFocusTopicDetailData["mentions"];
      narrativeSummary?: string;
      ok?: boolean;
      providerNames?: string[];
      relatedTopics?: HealthFocusTopicDetailData["relatedTopics"];
      separateRelatedTopics?: HealthFocusTopicDetailData["separateRelatedTopics"];
      topicSlug?: string;
    };

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error ?? "Health Focus topic detail could not be loaded."
      );
    }

    const detail = {
      contextSignature: result.contextSignature ?? topic.contextSignature,
      displayName: result.displayName ?? topic.displayName,
      isSampleData: result.isSampleData ?? topic.isSampleData,
      latestMentionAt: result.latestMentionAt ?? topic.latestMentionAt,
      mentionCount: result.mentionCount ?? topic.mentionCount,
      mentions: result.mentions ?? [],
      narrativeSummary: result.narrativeSummary ?? topic.narrativeSummary,
      providerNames: result.providerNames ?? topic.providerNames,
      relatedTopics: result.relatedTopics ?? [],
      separateRelatedTopics: result.separateRelatedTopics ?? [],
      topicSlug: result.topicSlug ?? topic.topicSlug,
    };

    rememberHealthFocusTopicDetail(topic, detail);
    return detail;
  }

  async function loadHealthFocusTopicDetail(topic: HealthFocusTopicSummary) {
    const cacheKey = healthFocusTopicCacheKey(topic);
    const cachedDetail = healthFocusDetailCacheRef.current.get(cacheKey);

    setSelectedHealthFocusTopic(topic);
    setHealthFocusTopicDetail(cachedDetail ?? null);
    setHealthFocusDetailLoading(!cachedDetail);
    setHealthStoryContextAnswer("");
    setHealthStoryContextError(null);

    if (cachedDetail) {
      return;
    }

    try {
      const detail = await fetchHealthFocusTopicDetail(topic);

      setHealthFocusTopicDetail(detail);
    } catch (error) {
      console.warn("Unable to load Health Focus topic detail", error);
      setHealthFocusTopicDetail(null);
    } finally {
      setHealthFocusDetailLoading(false);
    }
  }

  async function prefetchHealthFocusTopicDetails(
    topicsToPrefetch: HealthFocusTopicSummary[]
  ) {
    const uncachedTopics = topicsToPrefetch.filter((topic) => {
      const key = healthFocusTopicCacheKey(topic);

      return (
        !healthFocusDetailCacheRef.current.has(key) &&
        !healthFocusDetailPrefetchingRef.current.has(key)
      );
    });

    for (let index = 0; index < uncachedTopics.length; index += 2) {
      const batch = uncachedTopics.slice(index, index + 2);

      batch.forEach((topic) => {
        healthFocusDetailPrefetchingRef.current.add(
          healthFocusTopicCacheKey(topic)
        );
      });

      await Promise.all(
        batch.map(async (topic) => {
          const key = healthFocusTopicCacheKey(topic);

          try {
            await fetchHealthFocusTopicDetail(topic);
          } catch (error) {
            console.warn("Unable to prefetch Health Focus topic detail", error);
          } finally {
            healthFocusDetailPrefetchingRef.current.delete(key);
          }
        })
      );
    }
  }

  useEffect(() => {
    if (healthFocusTopics.length === 0) {
      return;
    }

    void prefetchHealthFocusTopicDetails(healthFocusTopics.slice(0, 3));
    // Prefetch should run when the summary set changes; the helper uses refs
    // for cache state and does not need to be a reactive dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthFocusTopics]);

  async function handleHealthStoryFeedback(
    feedback: HealthStoryFeedbackInput
  ): Promise<HealthStoryFeedbackResult> {
    if (!selectedHealthFocusTopic || !healthFocusTopicDetail) {
      throw new Error("Open a Health Story before saving feedback.");
    }

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error("Please sign in before saving Health Story feedback.");
    }

    const selectedCareSubjectId =
      selectedHealthFocusTopic.careSubjectId &&
      selectedHealthFocusTopic.careSubjectId !== ALL_SUBJECTS
        ? selectedHealthFocusTopic.careSubjectId
        : healthFocusTopicDetail.mentions[0]?.careSubjectId ?? null;
    const { careCircleId, careSubjectId } = await getPrimaryCareContext(
      selectedCareSubjectId ?? undefined
    );
    const resolvedCareSubjectId = selectedCareSubjectId ?? careSubjectId;

    if (!resolvedCareSubjectId) {
      throw new Error("Choose a Care VIP before saving Health Story feedback.");
    }

    const sourceAppointmentIds = Array.from(
      new Set(
        healthFocusTopicDetail.mentions
          .map((mention) => mention.appointmentId)
          .filter((id): id is string => Boolean(id))
      )
    );
    const sourceTopicMentionIds = healthFocusTopicDetail.mentions.map(
      (mention) => mention.id
    );
    const response = await fetch("/api/health-topics/feedback", {
      body: JSON.stringify({
        careCircleId,
        careSubjectId: resolvedCareSubjectId,
        feedbackMode: feedback.feedbackMode,
        feedbackValue: feedback.feedbackValue ?? null,
        relatedTopicSlug: feedback.relatedTopicSlug ?? null,
        shouldInfluenceFutureGeneration: true,
        sourceAppointmentIds,
        sourceTopicMentionIds,
        systemSnapshot: {
          contextSignature: healthFocusTopicDetail.contextSignature,
          displayName: healthFocusTopicDetail.displayName,
          latestMentionAt: healthFocusTopicDetail.latestMentionAt,
          mentionCount: healthFocusTopicDetail.mentionCount,
          providerNames: healthFocusTopicDetail.providerNames,
          relatedTopics: healthFocusTopicDetail.relatedTopics,
          separateRelatedTopics: healthFocusTopicDetail.separateRelatedTopics,
        },
        systemSummaryText: healthFocusTopicDetail.narrativeSummary,
        targetType: feedback.targetType ?? "health_story",
        topicSlug: healthFocusTopicDetail.topicSlug,
        userComment: feedback.userComment ?? null,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const result = (await response.json().catch(() => ({}))) as {
      contextId?: string | null;
      error?: string;
      feedbackId?: string;
      ok?: boolean;
    };

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error ?? "Health Story feedback could not be saved."
      );
    }

    if (!result.feedbackId) {
      throw new Error("Health Story feedback was saved without an undo token.");
    }

    if (
      feedback.feedbackMode === "clarification" ||
      feedback.targetType === "topic_relationship"
    ) {
      await loadHealthFocusSummary(activeHealthStorySubjectId, {
        forceRefresh: true,
      });
      await loadHealthFocusTopicDetail(selectedHealthFocusTopic);
    }

    return {
      contextId: result.contextId ?? null,
      feedbackId: result.feedbackId,
    };
  }

  async function handleUndoHealthStoryFeedback({
    contextId,
    feedbackId,
  }: HealthStoryFeedbackResult) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error("Please sign in before undoing Health Story feedback.");
    }

    const response = await fetch("/api/health-topics/feedback", {
      body: JSON.stringify({
        contextId,
        feedbackId,
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "DELETE",
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      ok?: boolean;
    };

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error ?? "Health Story feedback could not be undone."
      );
    }

    if (selectedHealthFocusTopic) {
      await loadHealthFocusSummary(activeHealthStorySubjectId, {
        forceRefresh: true,
      });
      await loadHealthFocusTopicDetail(selectedHealthFocusTopic);
    }
  }

  async function loadCareSubjectAvatars(): Promise<CareSubjectAvatarMap> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      return {};
    }

    const response = await fetch("/api/personal/avatars", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = (await response.json().catch(() => ({}))) as {
      avatars?: CareSubjectAvatarMap;
      ok?: boolean;
    };

    if (!response.ok || body.ok === false) {
      return {};
    }

    return body.avatars ?? {};
  }

  async function profileAvatarAuthHeaders() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    const accessToken = session?.access_token;

    if (!accessToken) {
      throw new Error("Please sign in before changing an avatar.");
    }

    return { Authorization: `Bearer ${accessToken}` };
  }

  async function handleUploadProfileAvatar(subjectId: string, file: File) {
    setMessage("");

    try {
      const headers = await profileAvatarAuthHeaders();
      const formData = new FormData();
      formData.append("personId", subjectId);
      formData.append("avatar", file);

      const response = await fetch("/api/personal/avatars", {
        body: formData,
        headers,
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Avatar could not be saved.");
      }

      await loadAppointments(appointmentView, selectedSubjectId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Avatar could not be saved.");
    }
  }

  async function handleRemoveProfileAvatar(subjectId: string) {
    setMessage("");

    try {
      const headers = await profileAvatarAuthHeaders();
      const response = await fetch(
        `/api/personal/avatars?personId=${encodeURIComponent(subjectId)}`,
        {
          headers,
          method: "DELETE",
        }
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };

      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Avatar could not be removed.");
      }

      await loadAppointments(appointmentView, selectedSubjectId);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Avatar could not be removed."
      );
    }
  }

  async function handleRenameProfilePerson(subjectId: string, displayName: string) {
    const trimmedName = displayName.trim();

    if (!trimmedName) {
      setMessage("Enter a name before saving.");
      return;
    }

    setMessage("");

    try {
      const { error } = await supabase
        .from("care_subjects")
        .update({ display_name: trimmedName })
        .eq("id", subjectId);

      if (error) {
        throw error;
      }

      await loadAppointments(appointmentView, selectedSubjectId);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Name could not be saved."
      );
    }
  }

  async function handleUpdateProfilePersonType(
    subjectId: string,
    subjectType: string
  ) {
    const normalizedSubjectType = subjectType.trim() || "other";

    setMessage("");

    try {
      const headers = await profileAvatarAuthHeaders();
      const response = await fetch("/api/personal/pet-type", {
        body: JSON.stringify({
          personId: subjectId,
          subjectType: normalizedSubjectType,
        }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        subjectType?: string;
      };

      if (!response.ok || body.ok === false) {
        throw new Error(body.error ?? "Pet details could not be saved.");
      }

      const savedSubjectType = body.subjectType || normalizedSubjectType;

      setCareSubjects((currentSubjects) =>
        currentSubjects.map((subject) => {
          if (subject.id !== subjectId) {
            return subject;
          }

          const updatedSubject = {
            ...subject,
            subject_type: savedSubjectType,
          };
          const defaultAvatarEmoji = defaultPetAvatarEmoji(updatedSubject);
          const shouldUseDefaultAvatar =
            subject.avatarIsDefault ||
            !subject.avatarUrl ||
            isDefaultPetAvatarUrl(subject.avatarUrl);

          return {
            ...updatedSubject,
            avatarEmoji: shouldUseDefaultAvatar ? defaultAvatarEmoji : subject.avatarEmoji,
            avatarIsDefault: shouldUseDefaultAvatar && Boolean(defaultAvatarEmoji),
            avatarUrl: shouldUseDefaultAvatar
              ? ""
              : subject.avatarUrl,
          };
        })
      );

      await loadAppointments(appointmentView, selectedSubjectId);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Pet details could not be saved."
      );
      throw error;
    }
  }

  async function handleUpdateProfilePersonManagedByHousehold(
    subjectId: string,
    managedByHousehold: boolean
  ) {
    const subject = careSubjects.find((careSubject) => careSubject.id === subjectId);

    if (!subject) {
      setMessage("Choose a Care VIP before changing managed status.");
      return;
    }

    if (isPetSubjectType(subject.subject_type)) {
      return;
    }

    setMessage("");

    try {
      const { error } = await supabase
        .from("care_subjects")
        .update({ managed_by_household: managedByHousehold })
        .eq("id", subjectId);

      if (error) {
        throw error;
      }

      setCareSubjects((currentSubjects) =>
        currentSubjects.map((currentSubject) =>
          currentSubject.id === subjectId
            ? {
                ...currentSubject,
                managed_by_household: managedByHousehold,
              }
            : currentSubject
        )
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Managed by household could not be saved."
      );
      throw error;
    }
  }

  async function loadAppointments(
    view: AppointmentView = appointmentView,
    subjectId: string = selectedSubjectId
  ) {
    hydrateAppointmentsFromSessionSnapshot(view, subjectId);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    const user = userData.user;

    if (!user) {
      throw new Error("Please sign in before loading appointments.");
    }

    const userRequiresEmailUpdate =
      user.user_metadata?.requires_email_update === true;
    setAuthProvider(authProviderFromUser(user));
    const profileEmail = user.email ?? signedInEmail ?? "";
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id,email,display_name,given_name,family_name,phone,phone_e164,timezone,address_line1,address_line2,city,region,postal_code,country,beta_terms_acknowledged_at,beta_privacy_acknowledged_at,beta_disclaimer_acknowledged_at,beta_agreement_version,onboarding_completed_at,is_admin,sample_data_seeded_at,sample_data_declined_at,sample_data_seed_version,welcome_guide_dismissed_at,welcome_guide_dismissed_version"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const timezoneDetection = browserTimezone();
    const savedTimezone =
      typeof profileRow?.timezone === "string" ? profileRow.timezone : "";
    const fallbackTimezoneLabel =
      timeZoneOptions.find(
        (option) => option.value === timezoneDetection.timezone
      )?.label ?? timezoneDetection.timezone;
    setTimezoneDetectionMessage(
      !savedTimezone && timezoneDetection.fallbackUsed && timezoneDetection.timezone
        ? `We couldn't match your browser time zone (${timezoneDetection.detectedTimezone}), so we selected ${fallbackTimezoneLabel}. Please review this selection.`
        : !savedTimezone && timezoneDetection.fallbackUsed
          ? `We couldn't match your browser time zone (${timezoneDetection.detectedTimezone}). Please select one.`
        : !savedTimezone && !timezoneDetection.detectedTimezone
          ? "We couldn't detect your browser time zone. Please select one."
          : ""
    );

    const loadedProfileDraft = {
      ...profileDraftFromRow({
        fallbackEmail: profileEmail,
        fallbackTimezone: timezoneDetection.timezone,
        row: profileRow,
      }),
      email: userRequiresEmailUpdate ? "" : profileRow?.email ?? profileEmail,
    };
    setProfileDraft(loadedProfileDraft);
    setSavedProfileDraft(loadedProfileDraft);
    setSavedProfileLabel(profileDisplayName(loadedProfileDraft));
    setRequiresEmailUpdate(userRequiresEmailUpdate);
    setWelcomeGuideDismissed(
      profileRow?.welcome_guide_dismissed_version === currentWelcomeGuideVersion
    );
    const userIsAdmin = profileRow?.is_admin === true;
    setIsAdmin(userIsAdmin);
    setSessionProfileLoaded(true);
    const routePreferredTab = preferredTabFromRoute();

    if (routePreferredTab) {
      setMainTab(routePreferredTab);
    }

    if (userIsAdmin && preferAdminAfterLogin && !adminRoute && !routePreferredTab) {
      if (!shouldStayOnPersonalRoute()) {
        window.location.assign("/admin");
        return;
      }
    }

    if (!userIsAdmin && adminRoute) {
      window.location.assign("/?adminAccessDenied=1");
      return;
    }

    if (!userIsAdmin && !routePreferredTab) {
      setMainTab((currentTab) =>
        currentTab === "admin" ? "home" : currentTab
      );
    }
    setOnboardingCompletedAt(
      typeof profileRow?.onboarding_completed_at === "string"
        ? profileRow.onboarding_completed_at
        : null
    );
    setSampleDataSeededAt(
      typeof profileRow?.sample_data_seeded_at === "string"
        ? profileRow.sample_data_seeded_at
        : null
    );
    setSampleDataDeclinedAt(
      typeof profileRow?.sample_data_declined_at === "string"
        ? profileRow.sample_data_declined_at
        : null
    );
    setBetaDisclaimerAcknowledgedAt(
      typeof profileRow?.beta_disclaimer_acknowledged_at === "string"
        ? profileRow.beta_disclaimer_acknowledged_at
        : null
    );
    setBetaPrivacyAcknowledgedAt(
      typeof profileRow?.beta_privacy_acknowledged_at === "string"
        ? profileRow.beta_privacy_acknowledged_at
        : null
    );
    setBetaTermsAcknowledgedAt(
      typeof profileRow?.beta_terms_acknowledged_at === "string"
        ? profileRow.beta_terms_acknowledged_at
        : null
    );

    if (
      !profileRow?.beta_disclaimer_acknowledged_at ||
      !profileRow?.beta_privacy_acknowledged_at ||
      !profileRow?.beta_terms_acknowledged_at
    ) {
      setAppointments([]);
      setAppointmentPool([]);
      setHasAnySavedAppointments(false);
      setHomeNextAppointment(null);
      setHomeNextGuidance(null);
      setNotesReminderAppointment(null);
      setCareSubjects([]);
      setEntitlement(defaultEntitlement);
      setNotes([]);
      setGuidance([]);
      setCarePrepHistory([]);
      setHistoryAppointmentId("");
      setMessage("Review the Early Access Agreement to continue.");
      return;
    }

    if (userRequiresEmailUpdate || !profileRow?.onboarding_completed_at) {
      setAppointments([]);
      setAppointmentPool([]);
      setHasAnySavedAppointments(false);
      setHomeNextAppointment(null);
      setHomeNextGuidance(null);
      setNotesReminderAppointment(null);
      setCareSubjects([]);
      setEntitlement(defaultEntitlement);
      setNotes([]);
      setGuidance([]);
      setCarePrepHistory([]);
      setHistoryAppointmentId("");
      setMessage(
        userRequiresEmailUpdate
          ? "Enter an email you can access to continue."
          : "Finish profile setup to continue."
      );
      return;
    }

    const { data: memberships, error: membershipsError } = await supabase
      .from("care_circle_memberships")
      .select("care_circle_id,role,created_at")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (membershipsError) {
      throw membershipsError;
    }

    const primaryCareCircleId = primaryCareCircleIdFromMemberships(
      memberships as CareCircleMembership[] | null
    );
    const circleIds = primaryCareCircleId ? [primaryCareCircleId] : [];

    if (circleIds.length === 0) {
      setAppointments([]);
      setAppointmentPool([]);
      setHasAnySavedAppointments(false);
      setHomeNextAppointment(null);
      setHomeNextGuidance(null);
      setNotesReminderAppointment(null);
      setCareSubjects([]);
      setEntitlement(defaultEntitlement);
      setNotes([]);
      setGuidance([]);
      setCarePrepHistory([]);
      setHistoryAppointmentId("");
      setMessage("Signed in, but no care circle membership was found.");
      return;
    }

    const [
      { data: entitlementRows, error: entitlementError },
      subjectRowsResult,
      { data: appointmentRows, error: appointmentsError },
    ] = await Promise.all([
      supabase
        .from("care_circle_entitlements")
        .select("care_circle_id,plan_id,status")
        .in("care_circle_id", circleIds)
        .eq("status", "active"),
      supabase
        .from("care_subjects")
        .select(
          "id,care_circle_id,display_name,subject_type,is_default,is_active,managed_by_household,avatar_url,avatar_type,avatar_alt_text"
        )
        .in("care_circle_id", circleIds)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("display_name", { ascending: true }),
      supabase
        .from("appointments")
        .select(
          "id,care_circle_id,care_subject_id,current_note_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone,is_sample_data,deleted_at"
        )
        .in("care_circle_id", circleIds)
        .is("deleted_at", null)
        .order("starts_at", { ascending: true }),
    ]);
    let subjectRows = subjectRowsResult.data as CareSubjectRow[] | null;
    let subjectsError = subjectRowsResult.error;

    if (subjectsError && isMissingCareSubjectOptionalColumn(subjectsError)) {
      const fallbackSubjectsResult = await supabase
        .from("care_subjects")
        .select("id,care_circle_id,display_name,subject_type,is_default,is_active")
        .in("care_circle_id", circleIds)
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("display_name", { ascending: true });

      subjectRows = (fallbackSubjectsResult.data ?? []).map((subject) => ({
        ...subject,
        avatar_alt_text: null,
        avatar_type: "initials",
        avatar_url: null,
        managed_by_household: false,
      })) as CareSubjectRow[];
      subjectsError = fallbackSubjectsResult.error;
    }

    if (entitlementError) {
      throw entitlementError;
    }

    if (subjectsError) {
      throw subjectsError;
    }

    if (appointmentsError) {
      throw appointmentsError;
    }

    const planId = entitlementRows?.[0]?.plan_id ?? defaultEntitlement.plan_id;

    const { data: planRows, error: planError } = await supabase
      .from("plans")
      .select("id,name,max_active_subjects")
      .eq("id", planId)
      .limit(1);

    if (planError) {
      throw planError;
    }

    const plan = planRows?.[0];
    const currentEntitlement = plan
      ? {
          max_active_subjects: plan.max_active_subjects,
          plan_id: plan.id,
          plan_name: plan.name,
        }
      : defaultEntitlement;

    setEntitlement(currentEntitlement);

    const avatarMap = await loadCareSubjectAvatars();
    const subjects = (subjectRows ?? []).map((subject) => {
      const rawStoredAvatarUrl =
        avatarMap[subject.id]?.avatarUrl ?? subject.avatar_url ?? "";
      const storedAvatarUrl = isDefaultPetAvatarUrl(rawStoredAvatarUrl)
        ? ""
        : rawStoredAvatarUrl;
      const defaultAvatarEmoji = defaultPetAvatarEmoji(subject);

      return {
        ...subject,
        avatarEmoji: storedAvatarUrl ? null : defaultAvatarEmoji,
        avatarAltText:
          avatarMap[subject.id]?.avatarAltText ??
          subject.avatar_alt_text ??
          null,
        avatarType:
          avatarMap[subject.id]?.avatarType ??
          subject.avatar_type ??
          "initials",
        avatarIsDefault: !storedAvatarUrl && Boolean(defaultAvatarEmoji),
        avatarUrl: storedAvatarUrl,
      };
    });
    const canUseMultipleSubjects = currentEntitlement.max_active_subjects > 1;
    const defaultSubjectId =
      subjects.find((subject) => subject.is_default)?.id ?? subjects[0]?.id ?? "";
    let effectiveSubjectId = defaultSubjectId || ALL_SUBJECTS;

    if (canUseMultipleSubjects) {
      effectiveSubjectId =
        subjectId === ALL_SUBJECTS ||
        subjects.some((subject) => subject.id === subjectId)
          ? subjectId
          : ALL_SUBJECTS;
    }

    setCareSubjects(subjects);
    setSelectedSubjectId(effectiveSubjectId);
    const onlyNonDefaultSubject =
      subjects.length === 1 && !subjects[0].is_default ? subjects[0] : null;
    const nextHealthStorySubjectId =
      effectiveSubjectId !== ALL_SUBJECTS
        ? effectiveSubjectId
        : onlyNonDefaultSubject
          ? ""
          : selectedHealthStorySubjectId &&
              subjects.some((subject) => subject.id === selectedHealthStorySubjectId)
            ? selectedHealthStorySubjectId
            : defaultSubjectId;
    setSelectedHealthStorySubjectId(nextHealthStorySubjectId);
    setNewAppointmentSubjectId((currentSubjectId) => {
      if (currentSubjectId && subjects.some((subject) => subject.id === currentSubjectId)) {
        return currentSubjectId;
      }

      return effectiveSubjectId !== ALL_SUBJECTS
        ? effectiveSubjectId
        : defaultSubjectId;
    });
    setTextIntakeSubjectId((currentSubjectId) => {
      if (currentSubjectId && subjects.some((subject) => subject.id === currentSubjectId)) {
        return currentSubjectId;
      }

      return effectiveSubjectId !== ALL_SUBJECTS
        ? effectiveSubjectId
        : defaultSubjectId;
    });
    setImportAnythingOwnerPersonId((currentOwnerPersonId) => {
      if (
        currentOwnerPersonId &&
        subjects.some((subject) => subject.id === currentOwnerPersonId)
      ) {
        return currentOwnerPersonId;
      }

      return "";
    });

    const activeSubjectIds = new Set(subjects.map((subject) => subject.id));
    const activeAppointmentRows =
      appointmentRows?.filter(
        (item) =>
          !item.care_subject_id || activeSubjectIds.has(item.care_subject_id)
      ) ?? [];
    setAppointmentDetailsHydrated(false);
    setAppointmentPool(activeAppointmentRows);
    applyAppointmentSelection(
      activeAppointmentRows,
      view,
      effectiveSubjectId,
      guidance,
      subjects
    );
    if (typeof window !== "undefined") {
      writeStoredJson(window.sessionStorage, appointmentsSessionSnapshotStorageKey, {
        appointmentPool: activeAppointmentRows,
        careSubjects: subjects,
        entitlement: currentEntitlement,
        savedAt: new Date().toISOString(),
      } satisfies AppointmentsSessionSnapshot);
    }
    if (nextHealthStorySubjectId) {
      void loadHealthFocusSummary(nextHealthStorySubjectId);
    }

    void hydrateAppointmentDetails(activeAppointmentRows);
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
        );
      }

      if (!isLikelyEmail(email)) {
        throw new Error("Enter a valid email address.");
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      const trimmedEmail = email.trim();
      setSessionProfileLoaded(false);
      setSignedInEmail(trimmedEmail);
      setWelcomeGuideDismissed(false);
      recordSessionActivity();

      const returnTo = carePlandReturnToFromCurrentLocation();
      if (returnTo) {
        setLoading(false);
        window.location.assign(returnTo);
        return;
      }

      setLoading(false);
      void loadAppContent();
      void loadAppSessionSettings();
      void loadAppointments().catch((loadError) => {
        setMessage(getErrorMessage(loadError));
      });
    } catch (error) {
      logAuthError("signIn", error);
      setMessage(getAuthErrorMessage(error));
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setMessage("");

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
        );
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: googleAuthRedirectUrl(),
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      logAuthError("googleSignIn", error);
      setMessage(
        "Google sign-in could not be started. Please try again, or use email and password."
      );
      setLoading(false);
    }
  }

  async function loadAdminViewStates() {
    try {
      const { data, error } = await supabase
        .from("admin_view_states")
        .select("admin_user_id,scope_type,scope_key,last_viewed_at,updated_at");

      if (error) {
        throw error;
      }

      const states = (data ?? []) as AdminViewState[];
      setAdminViewStates(
        Object.fromEntries(
          states.map((state) => [
            adminViewStateKey(state.scope_type, state.scope_key),
            state,
          ])
        )
      );
    } catch (error) {
      console.warn("Unable to load admin view states", error);
    }
  }

  async function loadAdminAttentionSummary() {
    try {
      const { data, error } = await supabase.rpc(
        "get_admin_attention_summary"
      );

      if (error) {
        throw error;
      }

      const summaries = (data ?? []) as AdminAttentionSummary[];
      setAdminAttentionSummaries(
        Object.fromEntries(
          summaries.map((summary) => [
            adminViewStateKey(summary.scope_type, summary.scope_key),
            summary,
          ])
        )
      );
    } catch (error) {
      console.warn("Unable to load admin attention summary", error);
    }
  }

  async function loadAiOperationCostSummary(rangeDays = aiOperationCostRangeDays) {
    setLoadingAiOperationCosts(true);
    setAiOperationCostError("");

    try {
      const since = new Date(
        Date.now() - rangeDays * 24 * 60 * 60 * 1000
      ).toISOString();
      const { data, error } = await supabase.rpc("ai_operation_cost_summary", {
        p_since: since,
      });

      if (error) {
        throw error;
      }

      setAiOperationCostSummary((data ?? []) as AiOperationCostSummaryRow[]);
      const { data: logRows, error: logError } = await supabase
        .from("ai_operation_logs")
        .select("user_id,estimated_cost_usd,total_tokens")
        .gte("created_at", since);

      if (logError) {
        throw logError;
      }

      const rowsByUser = new Map<string, AiOperationCostUserSummaryRow>();

      (logRows ?? []).forEach((row) => {
        const userId =
          typeof row.user_id === "string" && row.user_id.trim()
            ? row.user_id
            : null;
        const userKey = userId ?? "unknown";
        const current = rowsByUser.get(userKey) ?? {
          call_count: 0,
          estimated_cost_usd: 0,
          total_tokens: 0,
          user_id: userId,
          user_label: userId ? `User ${userId.slice(0, 8)}` : "Unknown user",
        };

        current.call_count += 1;
        current.estimated_cost_usd += Number(row.estimated_cost_usd ?? 0);
        current.total_tokens += Number(row.total_tokens ?? 0);
        rowsByUser.set(userKey, current);
      });

      const userIds = Array.from(rowsByUser.values())
        .map((row) => row.user_id)
        .filter((userId): userId is string => Boolean(userId));

      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id,email,display_name,given_name,family_name")
          .in("id", userIds);

        if (!profileError) {
          (profileRows ?? []).forEach((profile) => {
            const summary = rowsByUser.get(profile.id);

            if (summary) {
              summary.user_label =
                profileLabel({
                  display_name: profile.display_name,
                  email: profile.email,
                  family_name: profile.family_name,
                  given_name: profile.given_name,
                }) || summary.user_label;
            }
          });
        }
      }

      setAiOperationCostUserSummary(
        Array.from(rowsByUser.values()).sort(
          (left, right) => right.estimated_cost_usd - left.estimated_cost_usd
        )
      );
    } catch (error) {
      console.warn("Unable to load AI operation cost summary", error);
      setAiOperationCostSummary([]);
      setAiOperationCostUserSummary([]);
      setAiOperationCostError(
        "AI operation cost tracking is ready in the app, but the database migration has not been applied yet."
      );
    } finally {
      setLoadingAiOperationCosts(false);
    }
  }

  function handleChangeAiOperationCostRange(rangeDays: number) {
    setAiOperationCostRangeDays(rangeDays);
    void loadAiOperationCostSummary(rangeDays);
  }

  async function loadAdminAttentionOverview() {
    await Promise.allSettled([
      loadAdminViewStates(),
      loadAdminAttentionSummary(),
      loadAdminSupportTickets(),
      loadAdminIntegrationErrors(),
      loadProductMgmt(),
      loadAgentKnowledgeProposals(),
      loadAssistantReviewInteractions(),
      loadAskReviewSubmissions(),
      loadAiOperationCostSummary(),
    ]);
  }

  async function markAdminScopeViewed(
    scopeType: AdminViewScopeType,
    scopeKey: string
  ) {
    try {
      const { data, error } = await supabase.rpc("mark_admin_view_state", {
        p_scope_key: scopeKey,
        p_scope_type: scopeType,
      });

      if (error) {
        throw error;
      }

      const updatedState = data as AdminViewState;
      setAdminViewStates((currentStates) => ({
        ...currentStates,
        [adminViewStateKey(scopeType, scopeKey)]: updatedState,
      }));
      await loadAdminAttentionSummary();
    } catch (error) {
      console.warn("Unable to mark admin scope viewed", error);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
        );
      }

      const trimmedEmail = email.trim();

      if (!isLikelyEmail(trimmedEmail)) {
        throw new Error("Enter a valid email address.");
      }

      if (password.length < 8) {
        throw new Error("Use a password with at least 8 characters.");
      }

      if (password !== confirmPassword) {
        throw new Error("The passwords do not match.");
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: emailConfirmationRedirectUrl(),
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setSessionProfileLoaded(false);
        setSignedInEmail(trimmedEmail);
        setWelcomeGuideDismissed(false);
        setMessage("Account created and signed in. Finish profile setup to continue.");
        recordSessionActivity();
        await Promise.all([loadAppContent(), loadAppSessionSettings()]);
        await loadAppointments();
        return;
      }

      setAuthMode("signIn");
      setPassword("");
      setConfirmPassword("");
      setMessage(
        "If this email can be used to create an account, CarePland will send a confirmation link. If you already have an account, sign in or reset your password."
      );
    } catch (error) {
      logAuthError("signUp", error);
      setMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
        );
      }

      const trimmedEmail = email.trim();

      if (!isLikelyEmail(trimmedEmail)) {
        throw new Error("Enter a valid email address.");
      }

      const { error } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          redirectTo: passwordResetRedirectUrl(),
        }
      );

      if (error) {
        throw error;
      }

      setAuthMode("signIn");
      setPassword("");
      setConfirmPassword("");
      showToast(
        "If this email has an account, a password reset link has been sent. Check your inbox and junk folder.",
        { type: "success", durationMs: 8000 }
      );
    } catch (error) {
      logAuthError("passwordReset", error);
      setMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
        );
      }

      if (password.length < 8) {
        throw new Error("Use a password with at least 8 characters.");
      }

      if (password !== confirmPassword) {
        throw new Error("The passwords do not match.");
      }

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session && isPasswordRecoveryRedirect()) {
        await establishAuthRedirectSession();
      }

      const { data: refreshedSessionData } = await supabase.auth.getSession();

      if (!refreshedSessionData.session) {
        throw new Error(
          "This reset link is missing an active recovery session. Please request a fresh password reset email and use the newest link."
        );
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setAuthMode("signIn");
      setPassword("");
      setConfirmPassword("");
      clearAuthRedirectUrl();
      showToast("Password updated.", { type: "success" });
      setMessage("Password updated. You can continue using CarePland.");

      if (signedInEmail) {
        await loadAppointments();
      }
    } catch (error) {
      logAuthError("updatePassword", error);
      setMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendProfilePasswordReset() {
    setSendingPasswordReset(true);
    setMessage("");

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
          "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
        );
      }

      const resetEmail = (signedInEmail ?? profileDraft.email).trim();

      if (!isLikelyEmail(resetEmail)) {
        throw new Error("Your profile needs a valid email before resetting a password.");
      }

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: passwordResetRedirectUrl(),
      });

      if (error) {
        throw error;
      }

      showToast(
        "If this email has an account, a password reset link has been sent. Check your inbox and junk folder.",
        { type: "success", durationMs: 8000 }
      );
    } catch (error) {
      logAuthError("profilePasswordReset", error);
      setMessage(getAuthErrorMessage(error));
    } finally {
      setSendingPasswordReset(false);
    }
  }

  function applyAppointmentViewChange(view: AppointmentView) {
    setAppointmentView(view);
    setPendingModifierSwitch(null);
    setPendingAppointmentPanelView(null);
    setActiveAppointmentPanel(null);
    setMessage("");
    saveAppointmentsViewState({
      activeAppointmentPanel: null,
      appointmentView: view,
    });
    applyAppointmentSelection(appointmentPool, view, selectedSubjectId);
  }

	  function handleChangeAppointmentView(view: AppointmentView) {
    if (importAnythingPanelHasUnfinishedWork) {
      setPendingImportLeaveAction({ kind: "appointmentView", view });
      return;
    }

    if (
      activeAppointmentPanel === "add" &&
      newAppointmentDraftHasContent(newAppointmentDraft)
    ) {
      setMessage("Save or cancel this appointment before changing views.");
      return;
    }

    applyAppointmentViewChange(view);
  }

	  function handleChangeSubject(subjectId: string) {
	    setSelectedSubjectId(subjectId);
	    setPendingModifierSwitch(null);

	    if (subjectId !== ALL_SUBJECTS) {
      setNewAppointmentSubjectId(subjectId);
      setSelectedHealthStorySubjectId(subjectId);
    }

    setMessage("");
    saveAppointmentsViewState({ selectedSubjectId: subjectId });
    applyAppointmentSelection(appointmentPool, appointmentView, subjectId);
  }

  function handleChangeHealthStorySubject(subjectId: string) {
    if (!subjectId || !careSubjects.some((subject) => subject.id === subjectId)) {
      return;
    }

    setSelectedHealthStorySubjectId(subjectId);
    setHealthStorySubjectChooserOpen(false);
    setSelectedSubjectId(subjectId);
    setNewAppointmentSubjectId(subjectId);
    setPendingModifierSwitch(null);
    setMessage("");
    saveAppointmentsViewState({ selectedSubjectId: subjectId });
    applyAppointmentSelection(appointmentPool, appointmentView, subjectId);
  }

  function handleChangeCarePlandFocus(focusId: string) {
    setProfileContactPersonId("");
    handleChangeSubject(focusId);
    // TODO(global-focus-connect): decide whether this global focus should
    // influence Connect's Main Connect User or stay separate by design.
  }

  async function loadAiInstructions(workflowKey = selectedAiWorkflow) {
    setLoadingInstructions(true);
    setMessage("");

    try {
      const workflow = aiWorkflows[workflowKey];
      const { careCircleId } = await getPrimaryCareContext();

      const { data: instructionSets, error: instructionSetError } =
        await supabase
          .from("ai_instruction_sets")
          .select("id,instruction_key,name,description")
          .eq("care_circle_id", careCircleId)
          .eq("instruction_key", workflowKey)
          .limit(1);

      if (instructionSetError) {
        throw instructionSetError;
      }

      const instructionSet = instructionSets?.[0] ?? null;
      setAiInstructionSet(instructionSet);

      if (!instructionSet) {
        setAiInstructionVersion(null);
        setAiInstructionVersions([]);
        setDraftSourceVersion(null);
        const draft = resetInstructionDraft(null, workflowKey);
        setInstructionSystemPrompt(draft.systemPrompt);
        setInstructionUserPrompt(draft.userPrompt);
        setInstructionOutputSchema(draft.outputSchema);
        setInstructionModel(draft.model);
        setInstructionChangeNote(workflow.defaultChangeNote);
        setMessage(
          `No ${workflow.label} instruction set exists yet. Paste instructions and save version 1.`
        );
        return;
      }

      const { data: versions, error: versionError } = await supabase
        .from("ai_instruction_versions")
        .select(
          "id,version_number,system_prompt,user_prompt_template,output_schema,model,temperature,is_current,change_note,content_hash,copied_from_version_id,created_at"
        )
        .eq("instruction_set_id", instructionSet.id)
        .order("version_number", { ascending: false });

      if (versionError) {
        throw versionError;
      }

      const allVersions = versions ?? [];
      const version =
        allVersions.find((instructionVersion) => instructionVersion.is_current) ??
        null;
      setAiInstructionVersions(allVersions);
      setAiInstructionVersion(version);
      setDraftSourceVersion(version);
      const draft = resetInstructionDraft(version, workflowKey);
      setInstructionSystemPrompt(draft.systemPrompt);
      setInstructionUserPrompt(draft.userPrompt);
      setInstructionOutputSchema(draft.outputSchema);
      setInstructionModel(draft.model);
      setInstructionChangeNote("");
      setMessage(
        version
          ? `Loaded ${workflow.label} instructions v${version.version_number}.`
          : `No current ${workflow.label} instruction version exists yet.`
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingInstructions(false);
    }
  }

  function resetAppContentEditor(
    version: AppContentVersion | null,
    fallbackContentKey = selectedAppContentKey
  ) {
    const option =
      appContentOptions.find(
        (item) => item.contentKey === (version?.content_key ?? fallbackContentKey)
      ) ?? appContentOptions[0];

    setAppContentLabel(version?.label ?? option.label);
    setAppContentDescription(version?.description ?? option.description);
    setAppContentBody(
      version?.body ??
        appContentDefaults[
          option.contentKey as keyof typeof appContentDefaults
        ] ??
        ""
    );
    setAppContentChangeNote("");
  }

  async function loadAppContent(contentKey = selectedAppContentKey) {
    setLoadingAppContent(true);

    try {
      const { data, error } = await supabase
        .from("app_content_versions")
        .select(
          "id,content_key,label,description,body,version_number,is_current,change_note,content_hash,created_at,superseded_at,superseded_by_version_id,copied_from_version_id"
        )
        .order("content_key", { ascending: true })
        .order("version_number", { ascending: false });

      if (error) {
        throw error;
      }

      const versions = data ?? [];
      setAppContentVersions(versions);
      setAgentProductFacts(
        versions.find(
          (version) =>
            version.content_key === "support_agent_product_facts" &&
            version.is_current
        )?.body ?? appContentDefaults.support_agent_product_facts
      );
      setAgentKnownLimitations(
        versions.find(
          (version) =>
            version.content_key === "support_agent_known_limitations" &&
            version.is_current
        )?.body ?? appContentDefaults.support_agent_known_limitations
      );
      setAgentEscalationGuidance(
        versions.find(
          (version) =>
            version.content_key === "support_agent_escalation_guidance" &&
            version.is_current
        )?.body ?? appContentDefaults.support_agent_escalation_guidance
      );
      setAgentVoiceGuidance(
        versions.find(
          (version) =>
            version.content_key === "support_agent_voice_guidance" &&
            version.is_current
        )?.body ?? appContentDefaults.support_agent_voice_guidance
      );

      const currentVersion =
        versions.find(
          (version) => version.content_key === contentKey && version.is_current
        ) ?? null;
      resetAppContentEditor(currentVersion, contentKey);
    } catch (error) {
      if (isAdmin) {
        setMessage(getErrorMessage(error));
      }
    } finally {
      setLoadingAppContent(false);
    }
  }

  async function handleChangeAppContentKey(contentKey: string) {
    setAppContentSaveMessage(null);
    setSelectedAppContentKey(contentKey);
    const optionForCategory = appContentOptions.find(
      (item) => item.contentKey === contentKey
    );
    if (optionForCategory) {
      setSelectedAppContentCategory(optionForCategory.category);
    }
    const currentVersion =
      appContentVersions.find(
        (version) => version.content_key === contentKey && version.is_current
      ) ?? null;

    if (currentVersion) {
      resetAppContentEditor(currentVersion, contentKey);
      return;
    }

    const option =
      appContentOptions.find((item) => item.contentKey === contentKey) ??
      appContentOptions[0];
    setAppContentLabel(option.label);
    setAppContentDescription(option.description);
    setAppContentBody(
      appContentDefaults[contentKey as keyof typeof appContentDefaults] ?? ""
    );
    setAppContentChangeNote("");
    await loadAppContent(contentKey);
  }

  async function handleChangeAppContentCategory(categoryKey: string) {
    setAppContentSaveMessage(null);
    setSelectedAppContentCategory(categoryKey);
    const firstOption = appContentOptions.find(
      (item) => item.category === categoryKey
    );

    if (firstOption) {
      await handleChangeAppContentKey(firstOption.contentKey);
    }
  }

  async function handleSaveAppContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAppContent(true);
    setMessage("");
    setAppContentSaveMessage(null);

    try {
      const { data, error } = await supabase.rpc("save_app_content_version", {
        p_body: appContentBody,
        p_change_note: appContentChangeNote.trim(),
        p_content_key: selectedAppContentKey,
        p_description: appContentDescription,
        p_label: appContentLabel,
      });

      if (error) {
        throw error;
      }

      const newVersion = data as AppContentVersion;
      await loadAppContent(newVersion.content_key);
      resetAppContentEditor(newVersion);
      setAppContentSaveMessage({
        tone: "success",
        text: "Content saved as a new version.",
      });
      showToast("Content saved as a new version.", { type: "success" });
    } catch (error) {
      const errorText = getErrorMessage(error);
      setAppContentSaveMessage({
        tone: "error",
        text: errorText,
      });
      setMessage(errorText);
    } finally {
      setSavingAppContent(false);
    }
  }

  async function saveAppContentBlock({
    body,
    changeNote,
    contentKey,
  }: {
    body: string;
    changeNote: string;
    contentKey: keyof typeof appContentDefaults;
  }) {
    const option = appContentOptions.find(
      (item) => item.contentKey === contentKey
    );

    if (!option) {
      throw new Error(`Unknown content key: ${contentKey}`);
    }

    const { error } = await supabase.rpc("save_app_content_version", {
      p_body: body,
      p_change_note: changeNote,
      p_content_key: contentKey,
      p_description: option.description,
      p_label: option.label,
    });

    if (error) {
      throw error;
    }
  }

  async function handleSaveAgentKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAgentKnowledge(true);
    setMessage("");

    try {
      const changeNote =
        agentKnowledgeChangeNote.trim() || "Updated AI agent knowledge";

      await saveAppContentBlock({
        body: agentProductFacts,
        changeNote,
        contentKey: "support_agent_product_facts",
      });
      await saveAppContentBlock({
        body: agentKnownLimitations,
        changeNote,
        contentKey: "support_agent_known_limitations",
      });
      await saveAppContentBlock({
        body: agentEscalationGuidance,
        changeNote,
        contentKey: "support_agent_escalation_guidance",
      });
      await saveAppContentBlock({
        body: agentVoiceGuidance,
        changeNote,
        contentKey: "support_agent_voice_guidance",
      });

      setAgentKnowledgeChangeNote("");
      await loadAppContent("support_agent_product_facts");
      showToast("Agent knowledge saved.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAgentKnowledge(false);
    }
  }

  async function loadAgentKnowledgeProposals() {
    setLoadingAgentKnowledgeProposals(true);

    try {
      const { data: proposalRows, error: proposalError } = await supabase
        .from("agent_knowledge_proposals")
        .select(
          "id,title,summary,source_type,status,review_note,created_at,updated_at,reviewed_at,published_at"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (proposalError) {
        throw proposalError;
      }

      const proposals = (proposalRows ?? []) as AgentKnowledgeProposal[];
      setAgentKnowledgeProposals(proposals);
      void loadAdminAttentionSummary();

      const { data: settingsRows, error: settingsError } = await supabase
        .from("agent_knowledge_automation_settings")
        .select(
          "settings_key,auto_generation_enabled,software_update_checks_enabled,scheduled_checks_enabled,background_generation_period_days,feedback_clustering_enabled,feedback_push_to_proposal_enabled,feedback_min_not_helpful_count,feedback_min_admin_flags,feedback_window_days,severity_threshold,updated_at"
        )
        .eq("settings_key", "default")
        .limit(1);

      if (!settingsError && settingsRows?.[0]) {
        setAgentKnowledgeAutomationSettings(
          settingsRows[0] as AgentKnowledgeAutomationSettings
        );
      }

      const { data: runRows, error: runError } = await supabase
        .from("agent_knowledge_check_runs")
        .select(
          "id,run_type,status,proposal_id,error_message,created_at,completed_at"
        )
        .order("created_at", { ascending: false })
        .limit(12);

      if (!runError) {
        setAgentKnowledgeCheckRuns((runRows ?? []) as AgentKnowledgeCheckRun[]);
      }

      if (proposals.length === 0) {
        setSelectedAgentKnowledgeProposalId("");
        setAgentKnowledgeProposalItems([]);
        setAgentKnowledgeProposalDrafts({});
        setAgentKnowledgeProposalNotes({});
        return;
      }

      const selectedProposalId = proposals.some(
        (proposal) => proposal.id === selectedAgentKnowledgeProposalId
      )
        ? selectedAgentKnowledgeProposalId
        : proposals[0].id;
      setSelectedAgentKnowledgeProposalId(selectedProposalId);

      const { data: itemRows, error: itemError } = await supabase
        .from("agent_knowledge_proposal_items")
        .select(
          "id,proposal_id,content_key,content_label,source_version_id,source_version_number,original_body,ai_proposed_body,admin_final_body,justification,evidence,risk_category,confidence,review_status,admin_note,created_at,updated_at"
        )
        .in(
          "proposal_id",
          proposals.map((proposal) => proposal.id)
        )
        .order("created_at", { ascending: true });

      if (itemError) {
        throw itemError;
      }

      const items = (itemRows ?? []) as AgentKnowledgeProposalItem[];
      setAgentKnowledgeProposalItems(items);
      setAgentKnowledgeProposalDrafts(
        Object.fromEntries(
          items.map((item) => [
            item.id,
            item.admin_final_body ?? item.ai_proposed_body,
          ])
        )
      );
      setAgentKnowledgeProposalNotes(
        Object.fromEntries(
          items.map((item) => [item.id, item.admin_note ?? ""])
        )
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingAgentKnowledgeProposals(false);
    }
  }

  async function handleReviewAgentKnowledgeProposalItem(
    item: AgentKnowledgeProposalItem,
    reviewStatus: AgentKnowledgeProposalItemReviewStatus
  ) {
    setSavingAgentKnowledgeProposalItemId(item.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "review_agent_knowledge_proposal_item",
        {
          p_admin_final_body:
            reviewStatus === "edited"
              ? agentKnowledgeProposalDrafts[item.id] ?? item.ai_proposed_body
              : null,
          p_admin_note: agentKnowledgeProposalNotes[item.id] ?? "",
          p_item_id: item.id,
          p_review_status: reviewStatus,
        }
      );

      if (error) {
        throw error;
      }

      showToast("Proposal item reviewed.", { type: "success" });
      await loadAgentKnowledgeProposals();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAgentKnowledgeProposalItemId(null);
    }
  }

  async function handlePublishAgentKnowledgeProposal(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedAgentKnowledgeProposal) {
      return;
    }

    setPublishingAgentKnowledgeProposalId(selectedAgentKnowledgeProposal.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("publish_agent_knowledge_proposal", {
        p_change_note:
          agentKnowledgeProposalPublishNote.trim() ||
          `Published Agent Knowledge proposal: ${selectedAgentKnowledgeProposal.title}`,
        p_proposal_id: selectedAgentKnowledgeProposal.id,
      });

      if (error) {
        throw error;
      }

      setAgentKnowledgeProposalPublishNote("");
      await Promise.all([
        loadAgentKnowledgeProposals(),
        loadAppContent("support_agent_product_facts"),
      ]);
      showToast("Agent Knowledge proposal published.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setPublishingAgentKnowledgeProposalId(null);
    }
  }

  async function handleSaveAgentKnowledgeAutomationSettings(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setSavingAgentKnowledgeAutomationSettings(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "update_agent_knowledge_automation_settings",
        {
          p_auto_generation_enabled:
            agentKnowledgeAutomationSettings.auto_generation_enabled,
          p_background_generation_period_days:
            agentKnowledgeAutomationSettings.background_generation_period_days,
          p_feedback_clustering_enabled:
            agentKnowledgeAutomationSettings.feedback_clustering_enabled,
          p_feedback_min_admin_flags:
            agentKnowledgeAutomationSettings.feedback_min_admin_flags,
          p_feedback_min_not_helpful_count:
            agentKnowledgeAutomationSettings.feedback_min_not_helpful_count,
          p_feedback_push_to_proposal_enabled:
            agentKnowledgeAutomationSettings.feedback_push_to_proposal_enabled,
          p_feedback_window_days:
            agentKnowledgeAutomationSettings.feedback_window_days,
          p_scheduled_checks_enabled:
            agentKnowledgeAutomationSettings.scheduled_checks_enabled,
          p_severity_threshold:
            agentKnowledgeAutomationSettings.severity_threshold,
          p_software_update_checks_enabled:
            agentKnowledgeAutomationSettings.software_update_checks_enabled,
        }
      );

      if (error) {
        throw error;
      }

      showToast("Agent Knowledge automation settings saved.", {
        type: "success",
      });
      await loadAgentKnowledgeProposals();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAgentKnowledgeAutomationSettings(false);
    }
  }

  async function handleQueueAgentKnowledgeManualCheck() {
    setQueueingAgentKnowledgeRun(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc("queue_agent_knowledge_check_run", {
        p_run_type: "manual",
        p_source_context: {
          requested_from: "admin_ai_proposals",
          requested_at: new Date().toISOString(),
        },
      });

      if (error) {
        throw error;
      }

      showToast("Manual Agent Knowledge check queued.", { type: "success" });
      await loadAgentKnowledgeProposals();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setQueueingAgentKnowledgeRun(false);
    }
  }

  async function handleRevertAppContent(version: AppContentVersion) {
    setRevertingAppContentForId(version.id);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc("revert_app_content_version", {
        p_change_note: `Reverted from v${version.version_number}`,
        p_version_id: version.id,
      });

      if (error) {
        throw error;
      }

      const newVersion = data as AppContentVersion;
      await loadAppContent(newVersion.content_key);
      resetAppContentEditor(newVersion);
      showToast("Content reverted as a new version.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setRevertingAppContentForId(null);
    }
  }

  async function loadProductMgmt() {
    setLoadingProductMgmt(true);

    try {
      const { data: areas, error: areaError } = await supabase
        .from("product_mgmt_areas")
        .select("id,area_key,label,description,display_order,is_active")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("label", { ascending: true });

      if (areaError) {
        throw areaError;
      }

      const loadedAreas = (areas ?? []) as ProductMgmtArea[];
      setProductMgmtAreas(loadedAreas);

      const effectiveAreaKey =
        loadedAreas.find(
          (area) => area.area_key === selectedProductMgmtSection
        )?.area_key ??
        loadedAreas[0]?.area_key ??
        selectedProductMgmtSection;

      if (effectiveAreaKey !== selectedProductMgmtSection) {
        setSelectedProductMgmtSection(effectiveAreaKey);
      }

      const { data: items, error: itemError } = await supabase
        .from("product_mgmt_items")
        .select(
          "id,area_id,title,body,status,priority,current_version_number,created_at,updated_at,resolved_at,ask_submission_id"
        )
        .order("status", { ascending: true })
        .order("updated_at", { ascending: false });

      if (itemError) {
        throw itemError;
      }

      setProductMgmtItems((items ?? []) as ProductMgmtItem[]);
      void loadAdminAttentionSummary();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingProductMgmt(false);
    }
  }

  function startEditingProductMgmtItem(item: ProductMgmtItem) {
    setEditingProductMgmtItemId(item.id);
    setProductMgmtItemDraft({
      areaId: item.area_id,
      body: item.body,
      changeNote: "Updated product management item",
      priority: item.priority,
      status: item.status,
      title: item.title,
    });
    setMessage("");
  }

  function cancelEditingProductMgmtItem() {
    setEditingProductMgmtItemId(null);
    setProductMgmtItemDraft(null);
  }

  function updateProductMgmtItemDraft(
    field: keyof ProductMgmtItemDraft,
    value: string
  ) {
    setProductMgmtItemDraft((currentDraft) =>
      currentDraft ? { ...currentDraft, [field]: value } : currentDraft
    );
  }

  async function handleChangeProductMgmtSection(sectionKey: ProductMgmtSection) {
    setSelectedProductMgmtSection(sectionKey);
    await markAdminScopeViewed("product_area", sectionKey);
  }

  async function handleUpdateProductMgmtItem(
    event: FormEvent<HTMLFormElement>,
    item: ProductMgmtItem
  ) {
    event.preventDefault();

    if (!productMgmtItemDraft) {
      return;
    }

    if (!productMgmtItemDraft.title.trim()) {
      setMessage("Title is required.");
      return;
    }

    if (!productMgmtItemDraft.changeNote.trim()) {
      setMessage("Version note is required when editing a product item.");
      return;
    }

    setSavingProductMgmtEditItemId(item.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("update_product_mgmt_item", {
        p_area_id: productMgmtItemDraft.areaId,
        p_body: productMgmtItemDraft.body,
        p_change_note: productMgmtItemDraft.changeNote,
        p_item_id: item.id,
        p_priority: productMgmtItemDraft.priority,
        p_status: productMgmtItemDraft.status,
        p_title: productMgmtItemDraft.title,
      });

      if (error) {
        throw error;
      }

      setEditingProductMgmtItemId(null);
      setProductMgmtItemDraft(null);
      await loadProductMgmt();
      showToast("Product item updated as a new version.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingProductMgmtEditItemId(null);
    }
  }

  async function handleCreateProductMgmtItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProductMgmtArea) {
      setMessage("Run the product management SQL first, then reload this tab.");
      return;
    }

    setSavingProductMgmtItem(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc("create_product_mgmt_item", {
        p_area_id: selectedProductMgmtArea.id,
        p_body: newProductMgmtBody,
        p_change_note: newProductMgmtChangeNote.trim() || "Initial entry",
        p_priority: newProductMgmtPriority,
        p_status: newProductMgmtStatus,
        p_title: newProductMgmtTitle,
      });

      if (error) {
        throw error;
      }

      setNewProductMgmtTitle("");
      setNewProductMgmtBody("");
      setNewProductMgmtPriority("medium");
      setNewProductMgmtStatus("open");
      setNewProductMgmtChangeNote("Initial entry");
      await loadProductMgmt();
      showToast("Product item added as version 1.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingProductMgmtItem(false);
    }
  }

  async function handleCreateProductMgmtArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProductMgmtArea(true);
    setMessage("");

    try {
      const areaKey = newProductMgmtAreaLabel
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      const { data, error } = await supabase.rpc("create_product_mgmt_area", {
        p_area_key: areaKey,
        p_description: newProductMgmtAreaDescription,
        p_display_order: 100,
        p_label: newProductMgmtAreaLabel,
      });

      if (error) {
        throw error;
      }

      const newArea = data as ProductMgmtArea;
      setNewProductMgmtAreaLabel("");
      setNewProductMgmtAreaDescription("");
      setShowProductMgmtAreaForm(false);
      await loadProductMgmt();
      setSelectedProductMgmtSection(newArea.area_key);
      showToast("Product lane added.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingProductMgmtArea(false);
    }
  }

  async function handleRetireProductMgmtArea(area: ProductMgmtArea) {
    const hasItems = productMgmtItems.some((item) => item.area_id === area.id);

    if (hasItems) {
      setMessage("Only empty lanes can be retired for now.");
      return;
    }

    setRetiringProductMgmtAreaId(area.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("retire_product_mgmt_area", {
        p_area_id: area.id,
      });

      if (error) {
        throw error;
      }

      await loadProductMgmt();
      showToast("Product lane retired.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setRetiringProductMgmtAreaId(null);
    }
  }

  async function handleResolveProductMgmtItem(item: ProductMgmtItem) {
    setResolvingProductMgmtItemId(item.id);
    setMessage("");

    try {
      const { error } = await supabase.rpc("resolve_product_mgmt_item", {
        p_change_note: "Marked resolved from Product Mgmt admin",
        p_item_id: item.id,
      });

      if (error) {
        throw error;
      }

      await loadProductMgmt();
      showToast("Product item marked resolved as a new version.", {
        type: "success",
      });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setResolvingProductMgmtItemId(null);
    }
  }

  async function loadCarePrepHistory(appointmentId = historyAppointmentId) {
    setLoadingCarePrepHistory(true);
    setMessage("");

    try {
      const effectiveAppointmentId = appointmentId || appointments[0]?.id || "";

      if (!effectiveAppointmentId) {
        setCarePrepHistory([]);
        setMessage("No appointment is available for CarePrep history yet.");
        return;
      }

      setHistoryAppointmentId(effectiveAppointmentId);

      const { data: historyRows, error: historyError } = await supabase
        .from("careprep_guidance")
        .select(
          "id,appointment_id,generated_at,summary,is_current,version_number,review_status,source,model,prompt_version,instruction_content_hash,instruction_version_id,edited_from_guidance_id,ai_generated_guidance_id,superseded_at,superseded_by_guidance_id"
        )
        .eq("appointment_id", effectiveAppointmentId)
        .order("generated_at", { ascending: false });

      if (historyError) {
        throw historyError;
      }

      setCarePrepHistory(historyRows ?? []);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingCarePrepHistory(false);
    }
  }

  async function loadIntakeHistory() {
    setLoadingCarePrepHistory(true);
    setMessage("");

    try {
      const { careCircleId } = await getPrimaryCareContext();
      const coreColumns =
        "id,created_at,source_type,raw_text,status,error_message,ai_interpretation,interpretation,accepted_interpretation,accepted_at,match_status";
      const auditColumns = `${coreColumns},model,prompt_version,instruction_content_hash`;
      let historyRows: IntakeHistoryRow[] | null = null;

      const { data, error } = await supabase
        .from("intake_items")
        .select(auditColumns)
        .eq("care_circle_id", careCircleId)
        .order("created_at", { ascending: false })
        .limit(25);

      if (error) {
        const missingAuditColumn =
          "code" in error && error.code === "42703";

        if (!missingAuditColumn) {
          throw error;
        }

        const { data: fallbackData, error: fallbackError } = await supabase
          .from("intake_items")
          .select(coreColumns)
          .eq("care_circle_id", careCircleId)
          .order("created_at", { ascending: false })
          .limit(25);

        if (fallbackError) {
          throw fallbackError;
        }

        historyRows = fallbackData ?? [];
      } else {
        historyRows = data ?? [];
      }

      setIntakeHistory(historyRows);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingCarePrepHistory(false);
    }
  }

  async function applyMainTabChange(tab: MainTab) {
    if (tab === "admin" && !isAdmin) {
      setMessage("Admin access is not enabled for this account.");
      return;
    }

    setMainTab(tab);
    setProfileContactPersonId("");

    if (tab !== "appointments") {
      resetPlaceLookup();
      setActiveAppointmentPanel(null);
    }

    if (tab === "admin") {
      await Promise.all([
        loadAiInstructions(),
        loadAppContent(),
        loadAdminAttentionOverview(),
      ]);
    }
  }

  async function handleChangeMainTab(tab: MainTab) {
    if (tab === mainTab) {
      return;
    }

    if (tab === "admin" && !isAdmin) {
      setMessage("Admin access is not enabled for this account.");
      return;
    }

    if (hasUnsavedWorkForLeave) {
      setPendingMainTab(tab);
      return;
    }

    await applyMainTabChange(tab);
  }

  function cancelPendingMainTabChange() {
    setPendingMainTab(null);
    setPendingImportLeaveAction(null);
  }

  function confirmPendingMainTabChange() {
    const tab = pendingMainTab;
    const importLeaveAction = pendingImportLeaveAction;

    setPendingMainTab(null);
    setPendingImportLeaveAction(null);

    if (!tab && !importLeaveAction) {
      return;
    }

    discardUnsavedWorkState();

    if (importLeaveAction?.kind === "appointmentView") {
      setMainTab("appointments");
      applyAppointmentViewChange(importLeaveAction.view);
      return;
    }

    if (importLeaveAction?.kind === "appointmentPanel") {
      applyAppointmentPanel(importLeaveAction.panel);
      return;
    }

    if (importLeaveAction?.kind === "ask") {
      updatePersonalRoute("ask");
      setAskPanelOpen(true);
      setAskCloseConfirmOpen(false);
      return;
    }

    if (tab) {
      void applyMainTabChange(tab);
    }
  }

  function applyAppointmentPanel(panel: AppointmentPanel) {
    setMessage("");
    setAppointmentView("upcoming");
    setSelectedSubjectId(ALL_SUBJECTS);
    setPendingTextIntakePanelAction(null);
    setPendingModifierSwitch(null);
    setFileImportStatus("");
    resetPlaceLookup();
    setActiveAppointmentPanel(panel);
    setMainTab("appointments");
    saveAppointmentsViewState({
      activeAppointmentPanel: panel,
      appointmentView: "upcoming",
      selectedSubjectId: ALL_SUBJECTS,
    });
  }

  function startAppointmentPanel(panel: AppointmentPanel) {
    const onlyImportSourceNamesRemain =
      activeAppointmentPanel === "quickAdd" &&
      panel !== "quickAdd" &&
      importAnythingSources.length > 0 &&
      importAnythingItems.length === 0 &&
      bulkAppointmentDrafts.length === 0 &&
      !textIntakeDraft &&
      !textIntakeValue.trim();

    if (
      activeAppointmentPanel === "quickAdd" &&
      panel !== "quickAdd" &&
      importAnythingPanelHasUnfinishedWork &&
      !onlyImportSourceNamesRemain
    ) {
      setPendingImportLeaveAction({ kind: "appointmentPanel", panel });
      return;
    }

    if (onlyImportSourceNamesRemain) {
      resetImportAnythingReview();
    }

    applyAppointmentPanel(panel);
  }

  async function loadCurrentUserSupportTickets() {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!userData.user) {
        setUserSupportTickets([]);
        setUserSupportTicketMessages([]);
        return;
      }

      const { data: ticketRows, error: ticketError } = await supabase
        .from("support_tickets")
        .select(
          "id,user_id,subject,status,priority,category,current_page,needs_admin_followup,user_has_unread_update,created_at,updated_at,ask_submission_id"
        )
        .eq("user_id", userData.user.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (ticketError) {
        throw ticketError;
      }

      const loadedTickets = (ticketRows ?? []) as SupportTicket[];
      setUserSupportTickets(loadedTickets);

      if (loadedTickets.length === 0) {
        setUserSupportTicketMessages([]);
        return;
      }

      const { data: messageRows, error: messageError } = await supabase
        .from("support_ticket_messages")
        .select(
          "id,ticket_id,author_role,message_body,is_internal,created_at"
        )
        .in(
          "ticket_id",
          loadedTickets.map((ticket) => ticket.id)
        )
        .eq("is_internal", false)
        .order("created_at", { ascending: true });

      if (messageError) {
        throw messageError;
      }

      setUserSupportTicketMessages((messageRows ?? []) as SupportTicketMessage[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function loadAdminUserActivity() {
    setLoadingAdminUserActivity(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "get_admin_user_activity_summary"
      );

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as AdminUserActivityRow[];
      setAdminUserActivity(rows);
      setMessage(`Loaded ${rows.length} user activity row(s).`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingAdminUserActivity(false);
    }
  }

  function toggleAdminUserActivitySort(key: AdminUserActivitySortKey) {
    setAdminUserActivitySort((currentSort) =>
      currentSort.key === key
        ? {
            direction: currentSort.direction === "asc" ? "desc" : "asc",
            key,
          }
        : {
            direction: key === "user" || key === "group" ? "asc" : "desc",
            key,
        }
    );
  }

  async function loadAdminAccessEvents() {
    setLoadingAdminAccessEvents(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("admin_access_events")
        .select(
          "id,actor_user_id,target_user_id,event_type,resource_type,resource_id,permission_scope,reason,metadata,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as AdminAccessEventRow[];
      setAdminAccessEvents(rows);

      if (adminUserActivity.length === 0) {
        const { data: userData, error: userError } = await supabase.rpc(
          "get_admin_user_activity_summary"
        );

        if (userError) {
          throw userError;
        }

        setAdminUserActivity((userData ?? []) as AdminUserActivityRow[]);
      }

      setMessage(`Loaded ${rows.length} audit event(s).`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingAdminAccessEvents(false);
    }
  }

  async function loadEarlyAccessIntake() {
    setLoadingEarlyAccessIntake(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("early_access_intake")
        .select(
          "id,first_name,last_name,email,phone,care_role,interest_context,communication_preference,communication_consent,status,source,admin_notes,last_contacted_at,invited_at,converted_user_id,created_at,updated_at"
        )
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as EarlyAccessIntakeRow[];
      setEarlyAccessIntakeRows(rows);
      setEarlyAccessIntakeAdminNotes(
        Object.fromEntries(rows.map((row) => [row.id, row.admin_notes ?? ""]))
      );
      setMessage(`Loaded ${rows.length} Early Access intake row(s).`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingEarlyAccessIntake(false);
    }
  }

  function updateEarlyAccessIntakeDraft(
    field: keyof EarlyAccessIntakeDraft,
    value: string | boolean
  ) {
    setEarlyAccessIntakeDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  async function handleCreateEarlyAccessIntake(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setSavingEarlyAccessIntake(true);
    setMessage("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const emailValue = earlyAccessIntakeDraft.email.trim();

      if (!isLikelyEmail(emailValue)) {
        throw new Error("Enter a valid email address for this intake record.");
      }

      const firstName = earlyAccessIntakeDraft.firstName.trim();
      const lastName = earlyAccessIntakeDraft.lastName.trim();

      if (!firstName || !lastName) {
        throw new Error("First and last name are required.");
      }

      const { error } = await supabase.from("early_access_intake").insert({
        admin_notes: earlyAccessIntakeDraft.adminNotes.trim(),
        care_role: earlyAccessIntakeDraft.careRole,
        communication_consent: false,
        communication_preference:
          earlyAccessIntakeDraft.communicationPreference,
        created_by_user_id: userData.user?.id ?? null,
        email: emailValue,
        first_name: firstName,
        interest_context: earlyAccessIntakeDraft.interestContext.trim(),
        last_name: lastName,
        phone: earlyAccessIntakeDraft.phone.trim() || null,
        source: earlyAccessIntakeDraft.source.trim() || "admin",
        status: "new",
        updated_by_user_id: userData.user?.id ?? null,
      });

      if (error) {
        throw error;
      }

      setEarlyAccessIntakeDraft({
        adminNotes: "",
        careRole: "unspecified",
        communicationPreference: "email",
        email: "",
        firstName: "",
        interestContext: "",
        lastName: "",
        phone: "",
        source: "admin",
      });
      await loadEarlyAccessIntake();
      showToast("Early Access intake saved.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingEarlyAccessIntake(false);
    }
  }

  async function handleUpdateEarlyAccessIntake(
    row: EarlyAccessIntakeRow,
    updates: Partial<Pick<
      EarlyAccessIntakeRow,
      "admin_notes" | "last_contacted_at" | "status"
    >>
  ) {
    setUpdatingEarlyAccessIntakeId(row.id);
    setMessage("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const { error } = await supabase
        .from("early_access_intake")
        .update({
          ...updates,
          updated_by_user_id: userData.user?.id ?? null,
        })
        .eq("id", row.id);

      if (error) {
        throw error;
      }

      await loadEarlyAccessIntake();
      showToast("Intake updated.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setUpdatingEarlyAccessIntakeId(null);
    }
  }

  async function openAdminReadonlyUserView(userId: string) {
    setLoadingAdminReadonlyUserId(userId);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "get_admin_user_readonly_snapshot",
        {
          p_reason: "Adalo/test account pre-flight or admin troubleshooting",
          p_target_user_id: userId,
        }
      );

      if (error) {
        throw error;
      }

      setAdminReadonlySnapshot(data as AdminReadonlySnapshot);
      setAdminRevealedSensitiveData({});
      setMessage("Loaded read-only user view. Sensitive details are hidden.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingAdminReadonlyUserId(null);
    }
  }

  function closeAdminReadonlyUserView() {
    setAdminReadonlySnapshot(null);
    setAdminRevealedSensitiveData({});
    setRevealingAdminSensitiveKey(null);
    setMessage("");
  }

  async function revealAdminSensitiveData({
    reason,
    resourceId = null,
    resourceType,
    targetUserId,
  }: {
    reason?: string;
    resourceId?: string | null;
    resourceType: AdminSensitiveResourceType;
    targetUserId: string;
  }) {
    const revealKey = adminSensitiveKey(resourceType, resourceId);
    setRevealingAdminSensitiveKey(revealKey);
    setMessage("");

    try {
      if (resourceType === "profile_contact") {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error("Please sign in before viewing contact details.");
        }

        const response = await fetch("/api/admin/contact-details", {
          body: JSON.stringify({
            action: "reveal",
            reason,
            targetUserId,
          }),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? "Contact reveal failed.");
        }

        setAdminRevealedSensitiveData((currentData) => ({
          ...currentData,
          [revealKey]: adminContactDetailsFromValue(result.contactDetails),
        }));
        setMessage("Contact details revealed and logged.");
        return true;
      }

      const { data, error } = await supabase.rpc(
        "reveal_admin_user_sensitive_data",
        {
          p_reason: "Admin read-only user view troubleshooting",
          p_resource_id: resourceId,
          p_resource_type: resourceType,
          p_target_user_id: targetUserId,
        }
      );

      if (error) {
        throw error;
      }

      setAdminRevealedSensitiveData((currentData) => ({
        ...currentData,
        [revealKey]: (data ?? {}) as AdminRevealedSensitiveData,
      }));
      setMessage("Sensitive details revealed and logged.");
      return true;
    } catch (error) {
      setMessage(getErrorMessage(error));
      return false;
    } finally {
      setRevealingAdminSensitiveKey(null);
    }
  }

  async function saveAdminContactDetails(
    contactDetails: AdminContactDetails,
    reason: string
  ) {
    if (!adminReadonlySnapshot) {
      return false;
    }

    setSavingAdminContactDetails(true);
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before saving contact details.");
      }

      const response = await fetch("/api/admin/contact-details", {
        body: JSON.stringify({
          action: "update",
          contactDetails,
          reason,
          targetUserId: adminReadonlySnapshot.profile.id,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Contact update failed.");
      }

      const contactKey = adminSensitiveKey("profile_contact");
      const updatedContactDetails = adminContactDetailsFromValue(
        result.contactDetails
      );
      setAdminRevealedSensitiveData((currentData) => ({
        ...currentData,
        [contactKey]: updatedContactDetails,
      }));
      setAdminReadonlySnapshot((currentSnapshot) =>
        currentSnapshot
          ? {
              ...currentSnapshot,
              profile: {
                ...currentSnapshot.profile,
                masked_email:
                  updatedContactDetails.email.replace(
                    /(^.).*(@.*$)/,
                    "$1***$2"
                  ) || currentSnapshot.profile.masked_email,
              },
            }
          : currentSnapshot
      );
      showToast("Contact details updated and logged.", { type: "success" });
      return true;
    } catch (error) {
      setMessage(getErrorMessage(error));
      return false;
    } finally {
      setSavingAdminContactDetails(false);
    }
  }

  async function loadAdminIntegrationErrors({ announce = false } = {}) {
    setLoadingAdminIntegrationErrors(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "get_admin_integration_error_summary"
      );

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as AdminIntegrationErrorSummaryRow[];
      setAdminIntegrationErrors(rows);
      setSelectedAdminIntegrationErrorKeys([]);
      void loadAdminAttentionSummary();
      if (announce) {
        setMessage(`Loaded ${rows.length} integration error summary row(s).`);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingAdminIntegrationErrors(false);
    }
  }

  function adminIntegrationErrorRowKey(row: AdminIntegrationErrorSummaryRow) {
    return [
      row.window_grain,
      row.window_start,
      row.integration_key,
      row.error_key,
    ].join("|");
  }

  function toggleAdminIntegrationErrorSelection(
    row: AdminIntegrationErrorSummaryRow
  ) {
    const rowKey = adminIntegrationErrorRowKey(row);

    setSelectedAdminIntegrationErrorKeys((currentKeys) =>
      currentKeys.includes(rowKey)
        ? currentKeys.filter((key) => key !== rowKey)
        : [...currentKeys, rowKey]
    );
  }

  function toggleAllAdminIntegrationErrors() {
    setSelectedAdminIntegrationErrorKeys((currentKeys) => {
      if (allAdminIntegrationErrorsSelected) {
        return currentKeys.filter(
          (key) => !adminIntegrationErrorKeys.includes(key)
        );
      }

      return Array.from(
        new Set([...currentKeys, ...adminIntegrationErrorKeys])
      );
    });
  }

  async function deleteSelectedAdminIntegrationErrors() {
    const rowsToDelete = adminIntegrationErrors.filter((row) =>
      selectedAdminIntegrationErrorKeys.includes(
        adminIntegrationErrorRowKey(row)
      )
    );

    if (rowsToDelete.length === 0) {
      setMessage("Select at least one integration error row to delete.");
      return;
    }

    setDeletingAdminIntegrationErrors(true);
    setMessage("");

    try {
      let deletedEventCount = 0;

      for (const row of rowsToDelete) {
        const { data, error } = await supabase.rpc(
          "delete_admin_integration_error_window",
          {
            p_error_key: row.error_key,
            p_integration_key: row.integration_key,
            p_window_grain: row.window_grain,
            p_window_start: row.window_start,
          }
        );

        if (error) {
          throw error;
        }

        deletedEventCount += typeof data === "number" ? data : 0;
      }

      setSelectedAdminIntegrationErrorKeys([]);
      await loadAdminIntegrationErrors();
      setMessage(
        `Deleted ${rowsToDelete.length} integration error row(s), covering ${deletedEventCount} event(s).`
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setDeletingAdminIntegrationErrors(false);
    }
  }

  async function loadAdminSupportTickets() {
    setLoadingAdminTickets(true);

    try {
      const { data: ticketRows, error: ticketError } = await supabase
        .from("support_tickets")
        .select(
          "id,user_id,subject,status,priority,category,current_page,needs_admin_followup,user_has_unread_update,created_at,updated_at"
        )
        .order("needs_admin_followup", { ascending: false })
        .order("updated_at", { ascending: false });

      if (ticketError) {
        throw ticketError;
      }

      const userIds = Array.from(
        new Set((ticketRows ?? []).map((ticket) => ticket.user_id).filter(Boolean))
      );
      const profileById = new Map<
        string,
        NonNullable<SupportTicket["profiles"]>
      >();

      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id,email,display_name,given_name,family_name")
          .in("id", userIds);

        if (!profileError) {
          (profileRows ?? []).forEach((profile) => {
            profileById.set(profile.id, {
              display_name: profile.display_name,
              email: profile.email,
              family_name: profile.family_name,
              given_name: profile.given_name,
            });
          });
        }
      }

      const loadedTickets = (ticketRows ?? []).map((ticket) => ({
        ...ticket,
        profiles: profileById.get(ticket.user_id) ?? null,
      })) as SupportTicket[];
      setAdminSupportTickets(loadedTickets);

      if (loadedTickets.length === 0) {
        setAdminSupportTicketMessages([]);
        setSelectedAdminTicketId("");
        return;
      }

      const effectiveTicketId =
        loadedTickets.find((ticket) => ticket.id === selectedAdminTicketId)?.id ??
        loadedTickets.find((ticket) => ticket.needs_admin_followup)?.id ??
        loadedTickets[0].id;

      setSelectedAdminTicketId(effectiveTicketId);
      const effectiveTicket = loadedTickets.find(
        (ticket) => ticket.id === effectiveTicketId
      );

      if (effectiveTicket) {
        setAdminTicketStatus(effectiveTicket.status);
        setAdminTicketPriority(effectiveTicket.priority);
        setAdminTicketCategory(effectiveTicket.category);
        setAdminTicketNeedsFollowup(effectiveTicket.needs_admin_followup);
      }

      const { data: messageRows, error: messageError } = await supabase
        .from("support_ticket_messages")
        .select(
          "id,ticket_id,author_role,message_body,is_internal,created_at"
        )
        .in(
          "ticket_id",
          loadedTickets.map((ticket) => ticket.id)
        )
        .order("created_at", { ascending: true });

      if (messageError) {
        throw messageError;
      }

      setAdminSupportTicketMessages((messageRows ?? []) as SupportTicketMessage[]);
      void loadAdminAttentionSummary();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingAdminTickets(false);
    }
  }

  function selectAdminTicket(ticket: SupportTicket) {
    setSelectedAdminTicketId(ticket.id);
    setAdminTicketStatus(ticket.status);
    setAdminTicketPriority(ticket.priority);
    setAdminTicketCategory(ticket.category);
    setAdminTicketNeedsFollowup(ticket.needs_admin_followup);
    setAdminTicketChangeNote("");
    setAdminTicketReplyBody("");
    setAdminTicketInternalNote("");
  }

  function assistantInteractionUserLabel(interaction: SupportAssistantInteraction) {
    const profile = interaction.profiles;
    const displayName = profile?.display_name?.trim();
    const fullName = [profile?.given_name, profile?.family_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    return displayName || fullName || profile?.email || interaction.user_id;
  }

  function profileLabel(profile: {
    display_name: string | null;
    email: string | null;
    family_name: string | null;
    given_name: string | null;
  } | null | undefined) {
    const displayName = profile?.display_name?.trim();
    const fullName = [profile?.given_name, profile?.family_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    return displayName || fullName || profile?.email || "";
  }

  function askActionText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }

  function askRecommendationTitle(
    submission: AdminAskSubmission,
    action: Record<string, unknown>,
    target: AskReviewProductTarget
  ) {
    const actionTitle =
      askActionText(action.title) ||
      askActionText(action.action) ||
      submission.ai_summary ||
      submission.original_user_wording;
    const prefix =
      target === "bug"
        ? "Ask bug"
        : target === "wishlist"
          ? "Ask wishlist"
          : "Ask workflow";

    return `${prefix}: ${actionTitle}`.slice(0, 180);
  }

  function askRecommendationBody(
    submission: AdminAskSubmission,
    action: Record<string, unknown>
  ) {
    return [
      askActionText(action.rationale)
        ? `AI recommendation rationale: ${askActionText(action.rationale)}`
        : "",
      askActionText(action.app_area)
        ? `Affected app area: ${askActionText(action.app_area)}`
        : "",
      askActionText(action.category)
        ? `Recommended category: ${askActionText(action.category)}`
        : "",
      askActionText(action.priority)
        ? `Priority clue: ${askActionText(action.priority)}`
        : "",
      askActionText(action.suggested_feature)
        ? `Suggested feature/workflow: ${askActionText(action.suggested_feature)}`
        : "",
      submission.router_rationale
        ? `Router rationale: ${submission.router_rationale}`
        : "",
      askActionText(action.tried_to_do)
        ? `Tried to do: ${askActionText(action.tried_to_do)}`
        : "",
      askActionText(action.expected_behavior)
        ? `Expected behavior: ${askActionText(action.expected_behavior)}`
        : "",
      askActionText(action.actual_behavior)
        ? `Actual behavior: ${askActionText(action.actual_behavior)}`
        : "",
      askActionText(action.reproducibility_clues)
        ? `Reproducibility clues: ${askActionText(action.reproducibility_clues)}`
        : "",
      submission.original_user_wording
        ? `Original user wording: ${submission.original_user_wording}`
        : "",
      submission.transcript ? `Ask transcript:\n${submission.transcript}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function askSupportTicketSubject(
    submission: AdminAskSubmission,
    action: Record<string, unknown>
  ) {
    return (
      askActionText(action.title) ||
      submission.ai_summary ||
      submission.original_user_wording ||
      "Ask support follow-up"
    ).slice(0, 180);
  }

  function askSupportTicketMessage(
    submission: AdminAskSubmission,
    action: Record<string, unknown>
  ) {
    return [
      submission.original_user_wording
        ? `Original user wording: ${submission.original_user_wording}`
        : "",
      submission.ai_summary ? `Ask summary: ${submission.ai_summary}` : "",
      askActionText(action.rationale)
        ? `AI recommendation rationale: ${askActionText(action.rationale)}`
        : "",
      submission.router_rationale
        ? `Router rationale: ${submission.router_rationale}`
        : "",
      submission.transcript ? `Ask transcript:\n${submission.transcript}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function normalizeAskRoutingSettings(
    value: Partial<AskRoutingSettings> | null | undefined
  ): AskRoutingSettings {
    const defaultTurns = Math.max(
      0,
      Number(
        value?.clarify_default_max_turns ??
          defaultAskRoutingSettings.clarify_default_max_turns
      )
    );
    const absoluteTurns = Math.max(
      defaultTurns,
      Number(
        value?.clarify_absolute_max_turns ??
          defaultAskRoutingSettings.clarify_absolute_max_turns
      )
    );
    const confidence = Math.max(
      0,
      Math.min(
        1,
        Number(
          value?.auto_create_min_confidence ??
            defaultAskRoutingSettings.auto_create_min_confidence
        )
      )
    );

    return {
      auto_create_min_confidence: Number.isNaN(confidence) ? 0.9 : confidence,
      auto_route_enabled: Boolean(value?.auto_route_enabled),
      clarify_absolute_max_turns: Number.isNaN(absoluteTurns)
        ? 5
        : absoluteTurns,
      clarify_default_max_turns: Number.isNaN(defaultTurns) ? 3 : defaultTurns,
      updated_at: value?.updated_at ?? null,
    };
  }

  async function loadAskRoutingSettings() {
    setLoadingAskRoutingSettings(true);

    try {
      const { data, error } = await supabase
        .from("ask_routing_settings")
        .select(
          "auto_route_enabled,auto_create_min_confidence,clarify_default_max_turns,clarify_absolute_max_turns,updated_at"
        )
        .eq("settings_key", "default")
        .maybeSingle();

      if (error) {
        throw error;
      }

      setAskRoutingSettingsDraft(normalizeAskRoutingSettings(data));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingAskRoutingSettings(false);
    }
  }

  async function loadAskReviewSubmissions() {
    setLoadingAskReviews(true);

    try {
      void loadAskRoutingSettings();

      const { data: submissionRows, error: submissionError } = await supabase
        .from("ask_submissions")
        .select(
          "id,thread_id,user_id,source,current_page,context,transcript,original_user_wording,ai_summary,router_category,router_confidence,router_rationale,recommended_actions,safety_flags,routing_state,reviewed_at,review_note,prompt_version,model,created_at,updated_at"
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (submissionError) {
        throw submissionError;
      }

      const loadedSubmissions = (submissionRows ?? []) as Array<
        Omit<AdminAskSubmission, "user_label">
      >;
      const userIds = Array.from(
        new Set(
          loadedSubmissions
            .map((submission) => submission.user_id)
            .filter(Boolean)
        )
      );
      const profileById = new Map<
        string,
        {
          display_name: string | null;
          email: string | null;
          family_name: string | null;
          given_name: string | null;
        }
      >();

      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id,email,display_name,given_name,family_name")
          .in("id", userIds);

        if (!profileError) {
          (profileRows ?? []).forEach((profile) => {
            profileById.set(profile.id, {
              display_name: profile.display_name,
              email: profile.email,
              family_name: profile.family_name,
              given_name: profile.given_name,
            });
          });
        }
      }

      const hydratedSubmissions = loadedSubmissions.map((submission) => ({
        ...submission,
        user_label:
          profileLabel(profileById.get(submission.user_id)) ||
          submission.user_id,
      }));

      setAskReviewSubmissions(hydratedSubmissions);

      if (hydratedSubmissions.length > 0) {
        const submissionIds = hydratedSubmissions.map(
          (submission) => submission.id
        );
        const [
          { data: decisionRows, error: decisionError },
          { data: linkRows, error: linkError },
        ] = await Promise.all([
          supabase
            .from("ask_recommendation_decisions")
            .select(
              "id,ask_submission_id,recommended_action_index,recommended_action,decision,created_target_table,created_target_id,override_action,decision_note,created_at"
            )
            .in("ask_submission_id", submissionIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("ask_submission_links")
            .select(
              "id,ask_submission_id,target_table,target_id,relationship_type,label,is_active,created_at"
            )
            .in("ask_submission_id", submissionIds)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
        ]);

        if (decisionError) {
          throw decisionError;
        }

        if (linkError) {
          throw linkError;
        }

        setAskRecommendationDecisions(
          (decisionRows ?? []) as AskRecommendationDecision[]
        );
        setAskSubmissionLinks((linkRows ?? []) as AskSubmissionLink[]);
      } else {
        setAskRecommendationDecisions([]);
        setAskSubmissionLinks([]);
      }

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: decisionSummaryRows, error: decisionSummaryError } =
        await supabase.rpc("ask_recommendation_decision_summary", {
          p_since: since,
        });

      if (decisionSummaryError) {
        throw decisionSummaryError;
      }

      setAskRecommendationDecisionSummary(
        (decisionSummaryRows ?? []) as AskRecommendationDecisionSummaryRow[]
      );

      const currentSelectionStillExists = hydratedSubmissions.some(
        (submission) => submission.id === selectedAskReviewId
      );
      const nextSelection = currentSelectionStillExists
        ? hydratedSubmissions.find(
            (submission) => submission.id === selectedAskReviewId
          ) ?? null
        : hydratedSubmissions.find(
            (submission) => submission.routing_state !== "closed"
          ) ??
          hydratedSubmissions[0] ??
          null;

      if (nextSelection) {
        setSelectedAskReviewId(nextSelection.id);
        setAskReviewRoutingState(nextSelection.routing_state);
        setAskReviewNote(nextSelection.review_note ?? "");
      } else {
        setSelectedAskReviewId("");
        setAskReviewRoutingState("needs_review");
        setAskReviewNote("");
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingAskReviews(false);
    }
  }

  function selectAskReviewSubmission(submission: AdminAskSubmission) {
    setSelectedAskReviewId(submission.id);
    setAskReviewRoutingState(submission.routing_state);
    setAskReviewNote(submission.review_note ?? "");
  }

  async function openAskSubmissionReview(askSubmissionId: string) {
    if (!askSubmissionId) {
      return;
    }

    setSelectedAskReviewId(askSubmissionId);
    await handleChangeAdminTab("assistantReview");
    setSelectedAskReviewId(askSubmissionId);
    showToast("Opened Ask review item.", { type: "success" });
  }

  async function openAskRelatedItem(link: AskSubmissionLink) {
    if (!link.target_id) {
      return;
    }

    try {
      if (link.target_table === "support_tickets") {
        await handleChangeAdminTab("tickets");
        setSelectedAdminTicketId(link.target_id);
        showToast("Opened linked support ticket.", { type: "success" });
        return;
      }

      if (link.target_table === "product_mgmt_items") {
        const { data: linkedItem, error: linkedItemError } = await supabase
          .from("product_mgmt_items")
          .select("area_id")
          .eq("id", link.target_id)
          .maybeSingle();

        if (linkedItemError) {
          throw linkedItemError;
        }

        const { data: linkedArea, error: linkedAreaError } = linkedItem?.area_id
          ? await supabase
              .from("product_mgmt_areas")
              .select("area_key")
              .eq("id", linkedItem.area_id)
              .maybeSingle()
          : { data: null, error: null };

        if (linkedAreaError) {
          throw linkedAreaError;
        }

        if (linkedArea) {
          setSelectedProductMgmtSection(linkedArea.area_key);
        }

        await handleChangeAdminTab("product");
        showToast("Opened Product Management.", { type: "success" });
        return;
      }

      showToast("Related item link saved.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleUpdateAskRoutingSettings(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setSavingAskRoutingSettings(true);
    setMessage("");

    try {
      const normalizedSettings = normalizeAskRoutingSettings(
        askRoutingSettingsDraft
      );
      const { data, error } = await supabase.rpc(
        "update_ask_routing_settings",
        {
          p_auto_create_min_confidence:
            normalizedSettings.auto_create_min_confidence,
          p_auto_route_enabled: normalizedSettings.auto_route_enabled,
          p_clarify_absolute_max_turns:
            normalizedSettings.clarify_absolute_max_turns,
          p_clarify_default_max_turns:
            normalizedSettings.clarify_default_max_turns,
        }
      );

      if (error) {
        throw error;
      }

      setAskRoutingSettingsDraft(normalizeAskRoutingSettings(data));
      showToast("Ask routing settings saved.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAskRoutingSettings(false);
    }
  }

  async function handleRunAskModuleLab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!askModuleLabInput.trim()) {
      setMessage("Paste at least one question to test.");
      return;
    }

    setRunningAskModuleLab(true);
    setAskModuleLabResults([]);
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before testing Ask modules.");
      }

      const response = await fetch("/api/ask-module-test", {
        body: JSON.stringify({
          moduleKey: askModuleLabKey,
          questions: askModuleLabInput,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Ask module test failed.");
      }

      setAskModuleLabResults((result.results ?? []) as AskModuleLabResult[]);
      showToast("Ask module test complete.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setRunningAskModuleLab(false);
    }
  }

  async function recordAskRecommendationDecision(
    decision: "overridden" | "rejected",
    actionIndex: number | null,
    action: Record<string, unknown>,
    overrideAction?: string
  ) {
    if (!selectedAskReviewSubmission) {
      return;
    }

    setSavingAskReviewAction(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "record_ask_recommendation_decision",
        {
          p_ask_submission_id: selectedAskReviewSubmission.id,
          p_created_target_id: null,
          p_created_target_table: null,
          p_decision: decision,
          p_decision_note: askReviewNote.trim() || null,
          p_override_action: overrideAction ?? null,
          p_recommended_action: action,
          p_recommended_action_index: actionIndex,
        }
      );

      if (error) {
        throw error;
      }

      await loadAskReviewSubmissions();
      showToast("Ask recommendation decision saved.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAskReviewAction(false);
    }
  }

  async function createProductItemFromAskRecommendation(
    target: AskReviewProductTarget,
    actionIndex: number | null,
    action: Record<string, unknown>
  ) {
    if (!selectedAskReviewSubmission) {
      return;
    }

    setSavingAskReviewAction(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "create_product_mgmt_item_from_ask",
        {
          p_area_key: target,
          p_ask_submission_id: selectedAskReviewSubmission.id,
          p_body: askRecommendationBody(selectedAskReviewSubmission, action),
          p_decision_note: askReviewNote.trim() || null,
          p_priority:
            askActionText(action.priority) === "high" ||
            askActionText(action.priority) === "low" ||
            askActionText(action.priority) === "medium"
              ? askActionText(action.priority)
              : "medium",
          p_recommended_action: action,
          p_recommended_action_index: actionIndex,
          p_status: "open",
          p_title: askRecommendationTitle(
            selectedAskReviewSubmission,
            action,
            target
          ),
        }
      );

      if (error) {
        throw error;
      }

      await Promise.all([loadAskReviewSubmissions(), loadProductMgmt()]);
      showToast("Linked Product Mgmt item created from Ask.", {
        type: "success",
      });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAskReviewAction(false);
    }
  }

  async function resolveAskAnswerRecommendation(
    actionIndex: number | null,
    action: Record<string, unknown>
  ) {
    if (!selectedAskReviewSubmission) {
      return;
    }

    setSavingAskReviewAction(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc("resolve_ask_answer_from_review", {
        p_ask_submission_id: selectedAskReviewSubmission.id,
        p_decision_note: askReviewNote.trim() || null,
        p_recommended_action: action,
        p_recommended_action_index: actionIndex,
      });

      if (error) {
        throw error;
      }

      await loadAskReviewSubmissions();
      showToast("Ask answer accepted and closed.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAskReviewAction(false);
    }
  }

  async function createSupportTicketFromAskRecommendation(
    actionIndex: number | null,
    action: Record<string, unknown>
  ) {
    if (!selectedAskReviewSubmission) {
      return;
    }

    setSavingAskReviewAction(true);
    setMessage("");

    try {
      const priority = askActionText(action.priority);
      const { error } = await supabase.rpc("create_support_ticket_from_ask", {
        p_ask_submission_id: selectedAskReviewSubmission.id,
        p_category: selectedAskReviewSubmission.router_category,
        p_decision_note: askReviewNote.trim() || null,
        p_message: askSupportTicketMessage(selectedAskReviewSubmission, action),
        p_priority:
          priority === "high" ||
          priority === "low" ||
          priority === "medium" ||
          priority === "urgent"
            ? priority
            : "medium",
        p_recommended_action: action,
        p_recommended_action_index: actionIndex,
        p_subject: askSupportTicketSubject(selectedAskReviewSubmission, action),
      });

      if (error) {
        throw error;
      }

      await Promise.all([loadAskReviewSubmissions(), loadAdminSupportTickets()]);
      showToast("Linked support ticket created from Ask.", {
        type: "success",
      });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAskReviewAction(false);
    }
  }

  async function handleUpdateAskReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAskReviewSubmission) {
      return;
    }

    setSavingAskReview(true);

    try {
      const { error } = await supabase
        .from("ask_submissions")
        .update({
          review_note: askReviewNote.trim() || null,
          reviewed_at: new Date().toISOString(),
          routing_state: askReviewRoutingState,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedAskReviewSubmission.id);

      if (error) {
        throw error;
      }

      await loadAskReviewSubmissions();
      setMessage("Ask review saved.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAskReview(false);
    }
  }

  async function loadAssistantReviewInteractions() {
    setLoadingAssistantReviews(true);

    try {
      const { data: interactionRows, error: interactionError } = await supabase
        .from("support_assistant_interactions")
        .select(
          "id,user_id,care_circle_id,ticket_id,question_subject,question_body,assistant_answer,suggested_next_step,confidence,escalation_recommended,escalation_reason,category,priority,outcome,user_feedback,current_page,context,instruction_version_id,prompt_version,model,raw_response,created_at,updated_at"
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (interactionError) {
        throw interactionError;
      }

      const loadedInteractions =
        (interactionRows ?? []) as SupportAssistantInteraction[];
      const userIds = Array.from(
        new Set(
          loadedInteractions
            .map((interaction) => interaction.user_id)
            .filter(Boolean)
        )
      );
      const profileById = new Map<
        string,
        NonNullable<SupportAssistantInteraction["profiles"]>
      >();

      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("id,email,display_name,given_name,family_name")
          .in("id", userIds);

        if (!profileError) {
          (profileRows ?? []).forEach((profile) => {
            profileById.set(profile.id, {
              display_name: profile.display_name,
              email: profile.email,
              family_name: profile.family_name,
              given_name: profile.given_name,
            });
          });
        }
      }

      const hydratedInteractions = loadedInteractions.map((interaction) => ({
        ...interaction,
        profiles: profileById.get(interaction.user_id) ?? null,
      }));

      setAssistantReviewInteractions(hydratedInteractions);

      if (hydratedInteractions.length === 0) {
        setAssistantReviewAdminReviews([]);
        setSelectedAssistantReviewId("");
        await loadAssistantAnalysisRuns();
        return;
      }

      if (
        !hydratedInteractions.some(
          (interaction) => interaction.id === selectedAssistantReviewId
        )
      ) {
        setSelectedAssistantReviewId(hydratedInteractions[0].id);
      }

      const { data: reviewRows, error: reviewError } = await supabase
        .from("support_assistant_admin_reviews")
        .select(
          "id,interaction_id,reviewer_user_id,review_status,admin_note,recommended_action,created_at,updated_at"
        )
        .in(
          "interaction_id",
          hydratedInteractions.map((interaction) => interaction.id)
        )
        .order("created_at", { ascending: false });

      if (reviewError) {
        throw reviewError;
      }

      setAssistantReviewAdminReviews(
        (reviewRows ?? []) as SupportAssistantAdminReview[]
      );
      await loadAssistantAnalysisRuns();
      void loadAdminAttentionSummary();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingAssistantReviews(false);
    }
  }

  async function loadAssistantAnalysisRuns() {
    try {
      const { data: runRows, error: runError } = await supabase
        .from("support_assistant_analysis_runs")
        .select(
          "id,requested_by_user_id,criteria,interaction_ids,prompt_versions,interaction_count,model,analysis_summary,failure_patterns,strengths,recommendations,prompt_recommendations,ui_recommendations,admin_status,admin_note,created_at,updated_at"
        )
        .order("created_at", { ascending: false })
        .limit(25);

      if (runError) {
        const runErrorCode =
          runError && typeof runError === "object" && "code" in runError
            ? String(runError.code)
            : "";

        if (runErrorCode === "PGRST205") {
          setAssistantAnalysisRuns([]);
          return;
        }

        throw runError;
      }

      const loadedRuns = (runRows ?? []).map((run) => ({
        ...run,
        failure_patterns: stringArrayFromJson(run.failure_patterns),
        interaction_ids: stringArrayFromJson(run.interaction_ids),
        prompt_recommendations: stringArrayFromJson(run.prompt_recommendations),
        prompt_versions: stringArrayFromJson(run.prompt_versions),
        recommendations: stringArrayFromJson(run.recommendations),
        strengths: stringArrayFromJson(run.strengths),
        ui_recommendations: stringArrayFromJson(run.ui_recommendations),
      })) as SupportAssistantAnalysisRun[];

      setAssistantAnalysisRuns(loadedRuns);

      if (
        loadedRuns.length > 0 &&
        !loadedRuns.some((run) => run.id === selectedAssistantAnalysisRunId)
      ) {
        setSelectedAssistantAnalysisRunId(loadedRuns[0].id);
        setAssistantAnalysisRunStatus(loadedRuns[0].admin_status);
        setAssistantAnalysisRunNote(loadedRuns[0].admin_note ?? "");
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function selectAssistantAnalysisRun(run: SupportAssistantAnalysisRun) {
    setSelectedAssistantAnalysisRunId(run.id);
    setAssistantAnalysisRunStatus(run.admin_status);
    setAssistantAnalysisRunNote(run.admin_note ?? "");
  }

  async function handleUpdateAssistantAnalysisRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAssistantAnalysisRun) {
      return;
    }

    setSavingAssistantAnalysisRunReview(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "update_support_assistant_analysis_run",
        {
          p_admin_note: assistantAnalysisRunNote,
          p_admin_status: assistantAnalysisRunStatus,
          p_run_id: selectedAssistantAnalysisRun.id,
        }
      );

      if (error) {
        throw error;
      }

      showToast("Analysis run review saved.", { type: "success" });
      await loadAssistantAnalysisRuns();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAssistantAnalysisRunReview(false);
    }
  }

  async function handleCreateAssistantAdminReview(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedAssistantReviewInteraction) {
      return;
    }

    setSavingAssistantAdminReview(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "create_support_assistant_admin_review",
        {
          p_admin_note: assistantReviewNote,
          p_interaction_id: selectedAssistantReviewInteraction.id,
          p_recommended_action: assistantReviewRecommendedAction,
          p_review_status: assistantReviewStatus,
        }
      );

      if (error) {
        throw error;
      }

      setAssistantReviewNote("");
      setAssistantReviewRecommendedAction("");
      setAssistantReviewStatus("needs_review");
      showToast("Assistant review saved.", { type: "success" });
      await loadAssistantReviewInteractions();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAssistantAdminReview(false);
    }
  }

  async function handleAnalyzeFilteredAssistantReviews() {
    if (filteredAssistantReviewInteractions.length === 0) {
      setMessage("No assistant answers match these filters.");
      return;
    }

    setAnalyzingAssistantReviews(true);
    setAssistantAnalysisResult(null);
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before analyzing assistant answers.");
      }

      const selectedInteractions = filteredAssistantReviewInteractions.slice(0, 50);
      const response = await fetch("/api/support-assistant-analysis", {
        body: JSON.stringify({
          criteria: {
            confidence: assistantReviewConfidenceFilter,
            has_user_feedback: assistantReviewHasFeedbackOnly,
            outcome: assistantReviewOutcomeFilter,
            prompt_version: assistantReviewPromptFilter,
          },
          interactionIds: selectedInteractions.map((interaction) => interaction.id),
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Assistant QA analysis failed.");
      }

      setAssistantAnalysisResult(result as SupportAssistantAnalysisResult);
      showToast("Assistant analysis saved.", { type: "success" });
      await loadAssistantAnalysisRuns();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setAnalyzingAssistantReviews(false);
    }
  }

  async function handleAskSupportAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supportQuestionSubject.trim() || !supportQuestionBody.trim()) {
      setMessage("Add a short subject and a few details before asking.");
      return;
    }

    setAskingSupportAssistant(true);
    setSupportAssistantResult(null);
    setSupportAssistantFeedback("");
    setSupportAssistantFeedbackMode(null);
    setSupportAssistantResolution(null);
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before asking for help.");
      }

      const response = await fetch("/api/support-assistant", {
        body: JSON.stringify({
          context: {
            email: signedInEmail,
            has_open_support_ticket: Boolean(currentSupportTicket),
            profile_label: savedProfileLabel,
          },
          currentPage: mainTab,
          message: supportQuestionBody,
          subject: supportQuestionSubject,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "The support assistant could not answer.");
      }

      setSupportAssistantResult(result as SupportAssistantResult);
      setSupportAssistantFeedbackMode(null);
      setSupportAssistantResolution(null);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setAskingSupportAssistant(false);
    }
  }

  async function handleSendAskMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const outgoingMessage = askInput.trim();

    if (!outgoingMessage) {
      return;
    }

    const outgoingFingerprint = outgoingMessage
      .toLowerCase()
      .replace(/\s+/g, " ");
    const activeAskContext = currentActiveAskContext();
    const shouldUseCareContext = shouldRouteTopAskToCareContext({
      askContext: activeAskContext,
      message: outgoingMessage,
    });

    if (
      !shouldUseCareContext &&
      askSubmittedFingerprints.includes(outgoingFingerprint)
    ) {
      setAskCompletionMessageKey("ask_duplicate_message");
      setAskConversationComplete(true);
      setAskInput("");
      setAskPanelError("");
      return;
    }

    setSendingAskMessage(true);
    setAskInput("");
    setAskPanelError("");
    setAskCloseConfirmOpen(false);
    setAskMessages((currentMessages) => [
      ...currentMessages,
      { body: outgoingMessage, role: "user" },
    ]);
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before using Ask.");
      }

      if (shouldUseCareContext) {
        const contextualAskContext: HomeContextAskContext = {
          ...activeAskContext,
          conversationTurns: topAskConversationTurns(),
        };
        const body: {
          askContext: HomeContextAskContext;
          careSubjectId?: string;
          question: string;
        } = {
          askContext: contextualAskContext,
          question: outgoingMessage,
        };

        if (contextualAskContext.careSubjectId) {
          body.careSubjectId = contextualAskContext.careSubjectId;
        } else if (selectedSubjectId && selectedSubjectId !== ALL_SUBJECTS) {
          body.careSubjectId = selectedSubjectId;
        }

        const response = await fetch("/api/home-context", {
          body: JSON.stringify(body),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const result = (await response.json()) as {
          answer?: string;
          error?: string;
          ok?: boolean;
        };

        if (!response.ok || !result.ok) {
          throw new Error(
            result.error ?? "CarePland could not answer that yet."
          );
        }

        setAskMessages((currentMessages) => [
          ...currentMessages,
          {
            body: result.answer?.trim() || "I couldn't find an answer in your saved CarePland context yet.",
            role: "assistant",
          },
        ]);
        return;
      }

      const response = await fetch("/api/ask", {
        body: JSON.stringify({
          context: {
            email: signedInEmail,
            has_open_support_ticket: Boolean(currentSupportTicket),
            active_ask_context: activeAskContext,
            is_profile_setup: needsOnboarding,
            profile_label: savedProfileLabel,
            profile_setup: needsOnboarding
              ? {
                  required_fields: [
                    "email",
                    "first name",
                    "last name",
                    "phone",
                    "time zone",
                    "ZIP code",
                  ],
                  requires_email_update: requiresEmailUpdate,
                  optional_fields: [
                    "display name",
                    "address line 1",
                    "address line 2",
                    "city",
                    "state / region",
                    "country",
                  ],
                }
              : null,
          },
          currentPage: needsOnboarding
            ? "profile_setup"
            : showWelcomeGuide
              ? "welcome_guide"
              : mainTab,
          message: outgoingMessage,
          threadId: askThreadId,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Ask is temporarily unavailable.");
      }

      if (typeof result.threadId === "string") {
        setAskThreadId(result.threadId);
      }

      const isTerminalAskAction = result.action !== "ask_clarifying_question";

      if (isTerminalAskAction) {
        setAskCompletionMessageKey(
          result.duplicate
            ? "ask_duplicate_message"
            : "ask_acknowledgement_message"
        );
        setAskSubmittedFingerprints((currentFingerprints) =>
          currentFingerprints.includes(outgoingFingerprint)
            ? currentFingerprints
            : [...currentFingerprints, outgoingFingerprint]
        );
        setAskConversationComplete(true);
      }

      const assistantMessage =
        typeof result.assistantMessage === "string"
          ? result.assistantMessage.trim()
          : "";
      const shouldShowAssistantMessage =
        Boolean(assistantMessage) &&
        (!isTerminalAskAction ||
          (!result.duplicate &&
            assistantMessage !== "Thanks. I saved this for review."));

      if (shouldShowAssistantMessage) {
        setAskMessages((currentMessages) => [
          ...currentMessages,
          { body: assistantMessage, role: "assistant" },
        ]);
      }
    } catch (error) {
      setAskInput(outgoingMessage);
      setAskMessages((currentMessages) => currentMessages.slice(0, -1));
      setAskPanelError(getErrorMessage(error));
    } finally {
      setSendingAskMessage(false);
    }
  }

  function resetAskPanelState() {
    setAskPanelOpen(false);
    setAskThreadId(null);
    setAskInput("");
    setAskMessages([]);
    setAskConversationComplete(false);
    setAskCompletionMessageKey("ask_acknowledgement_message");
    setAskPanelError("");
    setAskCloseConfirmOpen(false);
    setSendingAskMessage(false);
  }

  function requestCloseAskPanel() {
    const hasTypedAskText = Boolean(askInput.trim());
    const hasUnresolvedAskConversation =
      (askMessages.length > 0 || sendingAskMessage) && !askConversationComplete;

    if (hasTypedAskText || hasUnresolvedAskConversation) {
      setAskCloseConfirmOpen(true);
      return;
    }

    resetAskPanelState();
  }

  async function handleSupportAssistantFeedback(
    outcome: "helpful" | "not_helpful" | "escalated",
    ticketId?: string
  ) {
    if (!supportAssistantResult) {
      return;
    }

    setSavingSupportAssistantFeedback(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc(
        "update_support_assistant_interaction",
        {
          p_interaction_id: supportAssistantResult.interactionId,
          p_outcome: outcome,
          p_ticket_id: ticketId ?? null,
          p_user_feedback: supportAssistantFeedback,
        }
      );

      if (error) {
        throw error;
      }

      setSupportAssistantFeedbackMode(null);
      setSupportAssistantResolution(
        outcome === "helpful"
          ? "helpful"
          : outcome === "escalated"
            ? "escalated"
            : "not_helpful_saved"
      );
      showToast(
        outcome === "helpful"
          ? "Thanks. Your feedback was saved."
          : outcome === "escalated"
            ? "This was sent for review."
            : "Thanks. We will use this to improve CarePland answers.",
        { type: "success" }
      );

      if (outcome === "helpful") {
        window.setTimeout(() => {
          setSupportQuestionSubject("");
          setSupportQuestionBody("");
          setSupportAssistantResult(null);
          setSupportAssistantFeedback("");
          setSupportAssistantFeedbackMode(null);
          setSupportAssistantResolution(null);
          setAskingSupportQuestion(false);
          setSupportQuestionExpanded(false);
        }, 1400);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingSupportAssistantFeedback(false);
    }
  }

  async function handleEscalateSupportAssistant() {
    if (!supportAssistantResult) {
      return;
    }

    setSavingSupportQuestion(true);
    setMessage("");

    try {
      const escalationDetails = [
        supportQuestionBody,
        "",
        "--- CarePland support assistant ---",
        `Answer: ${supportAssistantResult.answer}`,
        supportAssistantResult.suggestedNextStep
          ? `Suggested next step: ${supportAssistantResult.suggestedNextStep}`
          : "",
        `Confidence: ${Math.round(supportAssistantResult.confidence * 100)}%`,
        supportAssistantResult.escalationReason
          ? `Escalation reason: ${supportAssistantResult.escalationReason}`
          : "",
        supportAssistantFeedback
          ? `${appContentText("support_missing_feedback_prompt")} ${supportAssistantFeedback}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const { data: ticket, error } = await supabase.rpc(
        "create_support_question",
        {
          p_context: {
            assistant_category: supportAssistantResult.category,
            assistant_confidence: supportAssistantResult.confidence,
            assistant_interaction_id: supportAssistantResult.interactionId,
            assistant_priority: supportAssistantResult.priority,
            browser_timezone: browserTimezone().timezone,
            signed_in_email: signedInEmail,
            tab: mainTab,
          },
          p_current_page: mainTab,
          p_message: escalationDetails,
          p_subject: supportQuestionSubject,
        }
      );

      if (error) {
        throw error;
      }

      const ticketId =
        ticket && typeof ticket === "object" && "id" in ticket
          ? String(ticket.id)
          : undefined;
      await handleSupportAssistantFeedback("escalated", ticketId);

      setSupportQuestionSubject("");
      setSupportQuestionBody("");
      setSupportAssistantResult(null);
      setSupportAssistantFeedback("");
      setSupportAssistantFeedbackMode(null);
      setSupportAssistantResolution(null);
      setAskingSupportQuestion(false);
      setSupportQuestionExpanded(true);
      await loadCurrentUserSupportTickets();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingSupportQuestion(false);
    }
  }

  async function handleAddSupportReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentSupportTicket || !supportReplyBody.trim()) {
      return;
    }

    setSavingSupportReply(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc("add_support_ticket_message", {
        p_is_internal: false,
        p_message: supportReplyBody,
        p_ticket_id: currentSupportTicket.id,
      });

      if (error) {
        throw error;
      }

      setSupportReplyBody("");
      await loadCurrentUserSupportTickets();
      showToast("Your reply was added.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingSupportReply(false);
    }
  }

  async function handleAddAdminTicketReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAdminTicket || !adminTicketReplyBody.trim()) {
      return;
    }

    setSavingAdminTicketReply(true);
    setMessage("");

    try {
      const { data: replyMessage, error } = await supabase.rpc(
        "add_support_ticket_message",
        {
          p_is_internal: false,
          p_message: adminTicketReplyBody,
          p_ticket_id: selectedAdminTicket.id,
        }
      );

      if (error) {
        throw error;
      }

      const replyMessageId =
        replyMessage && typeof replyMessage === "object" && "id" in replyMessage
          ? String(replyMessage.id)
          : "";

      if (replyMessageId) {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (accessToken) {
          fetch("/api/support-ticket-notifications", {
            body: JSON.stringify({ messageId: replyMessageId }),
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            method: "POST",
          }).catch((notificationError) => {
            console.error("Support reply notification failed", notificationError);
          });
        }
      }

      setAdminTicketReplyBody("");
      await loadAdminSupportTickets();
      showToast("Reply added to the question.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAdminTicketReply(false);
    }
  }

  async function handleAddAdminInternalNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAdminTicket || !adminTicketInternalNote.trim()) {
      return;
    }

    setSavingAdminTicketReply(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc("add_support_ticket_message", {
        p_is_internal: true,
        p_message: adminTicketInternalNote,
        p_ticket_id: selectedAdminTicket.id,
      });

      if (error) {
        throw error;
      }

      setAdminTicketInternalNote("");
      await loadAdminSupportTickets();
      showToast("Internal note added.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAdminTicketReply(false);
    }
  }

  async function handleUpdateAdminTicketStatus(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedAdminTicket) {
      return;
    }

    setSavingAdminTicketStatus(true);
    setMessage("");

    try {
      const { error } = await supabase.rpc("update_support_ticket_status", {
        p_category: adminTicketCategory,
        p_needs_admin_followup: adminTicketNeedsFollowup,
        p_note: adminTicketChangeNote,
        p_priority: adminTicketPriority,
        p_status: adminTicketStatus,
        p_ticket_id: selectedAdminTicket.id,
      });

      if (error) {
        throw error;
      }

      setAdminTicketChangeNote("");
      await loadAdminSupportTickets();
      showToast("Ticket updated.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAdminTicketStatus(false);
    }
  }

  async function handleMarkSupportQuestionSeen(ticket: SupportTicket) {
    if (!ticket.user_has_unread_update) {
      return;
    }

    try {
      const { error } = await supabase.rpc("mark_support_ticket_seen", {
        p_ticket_id: ticket.id,
      });

      if (error) {
        throw error;
      }

      await loadCurrentUserSupportTickets();
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleChangeAdminTab(tab: AdminTab) {
    const adminTabsWithRecommendationsReview = new Set<AdminTab>([
      "recommendations",
      "tools",
    ]);
    const leavingRecommendationsReview =
      adminTabsWithRecommendationsReview.has(adminTab) &&
      !adminTabsWithRecommendationsReview.has(tab);

    if (leavingRecommendationsReview && adminRecommendationsReviewDraftSummary) {
      const confirmed = window.confirm(
        "You have unapplied Today's Focus Review work. Discard it and switch Admin areas?"
      );

      if (!confirmed) {
        return;
      }

      setAdminRecommendationsReviewDraftSummary(null);
      clearAdminRecommendationsReviewDraftStorage();
    }

    setAdminTab(tab);
    setMessage("");

    if (tab === "dashboard") {
      await loadAdminAttentionOverview();
    }

    if (tab === "tools") {
      await loadAppSessionSettings();
    }

    if (tab === "connect") {
      setSelectedAiWorkflow("connect_receiver_request_interpreter");
      setAiAdminTab("instructions");
      await loadAiInstructions("connect_receiver_request_interpreter");
    }

    if (tab === "ai") {
      await Promise.all([
        loadAiInstructions(),
        loadAppContent(),
        loadAgentKnowledgeProposals(),
      ]);
    }

    if (tab === "content") {
      await loadAppContent();
    }

    if (tab === "product") {
      await loadProductMgmt();
    }

    if (tab === "tickets") {
      await loadAdminSupportTickets();
    }

    if (tab === "users") {
      await loadAdminUserActivity();
    }

    if (tab === "intake") {
      await loadEarlyAccessIntake();
    }

    if (tab === "userAudit") {
      await loadAdminAccessEvents();
    }

    if (tab === "errors") {
      await loadAdminIntegrationErrors();
    }

    if (tab === "assistantReview") {
      await Promise.all([
        loadAskReviewSubmissions(),
        loadAssistantReviewInteractions(),
      ]);
    }

    await markAdminScopeViewed("admin_tab", tab);
  }

  async function handleChangeAiAdminTab(tab: AiAdminTab) {
    setAiAdminTab(tab);

    if (tab === "audioProfile" || tab === "appearance") {
      await markAdminScopeViewed("ai_admin_tab", tab);
      return;
    }

    if (tab === "instructions") {
      await loadAiInstructions();
    } else if (tab === "agentKnowledge") {
      await loadAppContent("support_agent_product_facts");
    } else if (tab === "proposals") {
      await loadAgentKnowledgeProposals();
    } else if (selectedAiWorkflow === "careprep_generation") {
      await loadCarePrepHistory();
    } else {
      await loadIntakeHistory();
    }

    await markAdminScopeViewed("ai_admin_tab", tab);
  }

  async function handleChangeHistoryAppointment(appointmentId: string) {
    setHistoryAppointmentId(appointmentId);
    await loadCarePrepHistory(appointmentId);
  }

  async function handleChangeAiWorkflow(workflowKey: AiWorkflowKey) {
    setSelectedAiWorkflow(workflowKey);
    setCarePrepHistory([]);
    setIntakeHistory([]);

    if (aiAdminTab === "instructions") {
      await loadAiInstructions(workflowKey);
    } else if (workflowKey === "careprep_generation") {
      await loadCarePrepHistory();
    } else {
      await loadIntakeHistory();
    }
  }

  function loadInstructionVersionIntoEditor(version: AiInstructionVersion) {
    setDraftSourceVersion(version);
    const draft = resetInstructionDraft(version, selectedAiWorkflow);
    setInstructionSystemPrompt(draft.systemPrompt);
    setInstructionUserPrompt(draft.userPrompt);
    setInstructionOutputSchema(draft.outputSchema);
    setInstructionModel(draft.model);
    setInstructionChangeNote(
      version.is_current ? "" : `Based on v${version.version_number}`
    );
    setMessage(`Loaded v${version.version_number} into the editor.`);
  }

  async function handleSaveAiInstructions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingInstructions(true);
    setMessage("");

    try {
      const { careCircleId, userId } = await getPrimaryCareContext();
      const workflow = selectedAiWorkflowConfig;
      const parsedSchema = JSON.parse(instructionOutputSchema);
      const temperature = 0.2;
      const contentHash = await hashInstructionContent({
        model: instructionModel,
        outputSchema: parsedSchema,
        systemPrompt: instructionSystemPrompt,
        temperature,
        userPrompt: instructionUserPrompt,
      });
      let instructionSet = aiInstructionSet;

      if (!instructionSet) {
        const { data: newSet, error: setError } = await supabase
          .from("ai_instruction_sets")
          .insert({
            care_circle_id: careCircleId,
            description: workflow.description,
            instruction_key: selectedAiWorkflow,
            is_active: true,
            name: workflow.label,
          })
          .select("id,instruction_key,name,description")
          .single();

        if (setError) {
          throw setError;
        }

        instructionSet = newSet;
        setAiInstructionSet(newSet);
      }

      const { data: latestVersions, error: latestVersionError } = await supabase
        .from("ai_instruction_versions")
        .select("version_number")
        .eq("instruction_set_id", instructionSet.id)
        .order("version_number", { ascending: false })
        .limit(1);

      if (latestVersionError) {
        throw latestVersionError;
      }

      const nextVersionNumber = (latestVersions?.[0]?.version_number ?? 0) + 1;

      if (aiInstructionVersion) {
        const { error: supersedeError } = await supabase
          .from("ai_instruction_versions")
          .update({
            is_current: false,
            superseded_at: new Date().toISOString(),
          })
          .eq("id", aiInstructionVersion.id);

        if (supersedeError) {
          throw supersedeError;
        }
      }

      const { data: newVersion, error: versionError } = await supabase
        .from("ai_instruction_versions")
        .insert({
          change_note: instructionChangeNote.trim() || null,
          content_hash: contentHash,
          copied_from_version_id: draftSourceVersion?.id ?? aiInstructionVersion?.id ?? null,
          created_by_user_id: userId,
          instruction_set_id: instructionSet.id,
          is_current: true,
          model: instructionModel.trim() || null,
          output_schema: parsedSchema,
          system_prompt: instructionSystemPrompt,
          temperature,
          user_prompt_template: instructionUserPrompt,
          version_number: nextVersionNumber,
        })
        .select(
          "id,version_number,system_prompt,user_prompt_template,output_schema,model,temperature,is_current,change_note,content_hash,copied_from_version_id,created_at"
        )
        .single();

      if (versionError) {
        throw versionError;
      }

      setAiInstructionVersion(newVersion);
      setDraftSourceVersion(newVersion);
      setAiInstructionVersions((currentVersions) => [
        newVersion,
        ...currentVersions.map((version) => ({
          ...version,
          is_current: false,
        })),
      ]);
      const draft = resetInstructionDraft(newVersion, selectedAiWorkflow);
      setInstructionSystemPrompt(draft.systemPrompt);
      setInstructionUserPrompt(draft.userPrompt);
      setInstructionOutputSchema(draft.outputSchema);
      setInstructionModel(draft.model);
      setInstructionChangeNote("");
      setMessage(`Saved ${workflow.label} instructions v${newVersion.version_number}.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingInstructions(false);
    }
  }

  async function handleRevertInstructionVersion(version: AiInstructionVersion) {
    setRevertingInstructionForId(version.id);
    setMessage("");

    try {
      const { userId } = await getPrimaryCareContext();

      if (!aiInstructionSet) {
        throw new Error("No instruction set is loaded.");
      }

      const { data: latestVersions, error: latestVersionError } = await supabase
        .from("ai_instruction_versions")
        .select("version_number")
        .eq("instruction_set_id", aiInstructionSet.id)
        .order("version_number", { ascending: false })
        .limit(1);

      if (latestVersionError) {
        throw latestVersionError;
      }

      const nextVersionNumber = (latestVersions?.[0]?.version_number ?? 0) + 1;

      if (aiInstructionVersion) {
        const { error: supersedeError } = await supabase
          .from("ai_instruction_versions")
          .update({
            is_current: false,
            superseded_at: new Date().toISOString(),
          })
          .eq("id", aiInstructionVersion.id);

        if (supersedeError) {
          throw supersedeError;
        }
      }

      const { data: revertedVersion, error: revertError } = await supabase
        .from("ai_instruction_versions")
        .insert({
          change_note: `Reverted from v${version.version_number}`,
          content_hash: version.content_hash,
          copied_from_version_id: version.id,
          created_by_user_id: userId,
          instruction_set_id: aiInstructionSet.id,
          is_current: true,
          model: version.model,
          output_schema: version.output_schema,
          system_prompt: version.system_prompt,
          temperature: version.temperature ?? 0.2,
          user_prompt_template: version.user_prompt_template,
          version_number: nextVersionNumber,
        })
        .select(
          "id,version_number,system_prompt,user_prompt_template,output_schema,model,temperature,is_current,change_note,content_hash,copied_from_version_id,created_at"
        )
        .single();

      if (revertError) {
        throw revertError;
      }

      setAiInstructionVersion(revertedVersion);
      setDraftSourceVersion(revertedVersion);
      setAiInstructionVersions((currentVersions) => [
        revertedVersion,
        ...currentVersions.map((currentVersion) => ({
          ...currentVersion,
          is_current: false,
        })),
      ]);

      const draft = resetInstructionDraft(revertedVersion, selectedAiWorkflow);
      setInstructionSystemPrompt(draft.systemPrompt);
      setInstructionUserPrompt(draft.userPrompt);
      setInstructionOutputSchema(draft.outputSchema);
      setInstructionModel(draft.model);
      setInstructionChangeNote("");
      setMessage(
        `Reverted ${selectedAiWorkflowConfig.label} v${version.version_number} into new current v${revertedVersion.version_number}.`
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setRevertingInstructionForId(null);
    }
  }

	  async function handleSignOut({
	    bypassUnsavedChangesWarning = false,
	    message: signOutMessage = "Signed out.",
  }: {
    bypassUnsavedChangesWarning?: boolean;
    message?: string;
	  } = {}) {
	    if (!bypassUnsavedChangesWarning) {
	      setSignOutConfirmOpen(true);
	      return;
	    }

    discardUnsavedWorkState();
    setSignOutConfirmOpen(false);
	    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      removeStoredValue(window.localStorage, appUiStateStorageKey);
      removeStoredValue(window.sessionStorage, appDraftStateStorageKey);
      removeStoredValue(
        window.sessionStorage,
        appointmentsSessionSnapshotStorageKey
      );
      clearAllPageViewState();
    }
    setSignedInEmail(null);
    setAcceptBetaDisclaimer(false);
    setAcceptBetaPrivacy(false);
    setAcceptBetaTerms(false);
    setBetaDisclaimerAcknowledgedAt(null);
    setBetaPrivacyAcknowledgedAt(null);
    setBetaTermsAcknowledgedAt(null);
    setSampleDataSeededAt(null);
    setSampleDataDeclinedAt(null);
    setAdminSampleEmail("");
    setAdminSampleStatus(null);
    setAdminSampleForceDeclined(false);
    setAdminEmailUpdateCurrentEmail("");
    setAdminEmailUpdateNewEmail("");
    setAdminEmailUpdateResult("");
    setUpdatingAdminUserEmail(false);
    setWelcomeGuideDismissed(false);
    setIsAdmin(false);
    setSessionProfileLoaded(false);
    setAuthProvider("email");
    setRequiresEmailUpdate(false);
    setOnboardingCompletedAt(null);
    setShowOnboardingReady(false);
    setHasConfiguredReceiver(false);
    setProfileDraft(emptyProfileDraft);
    setSavedProfileDraft(emptyProfileDraft);
    setSavedProfileLabel("");
    setAuthMode("signIn");
    setActiveAppointmentPanel(null);
    setMainTab("appointments");
    setPassword("");
    setConfirmPassword("");
    setAppointments([]);
    setHasAnySavedAppointments(false);
    setNotesReminderAppointment(null);
    setCareSubjects([]);
    setEntitlement(defaultEntitlement);
    setNotes([]);
    setGuidance([]);
    setCarePrepHistory([]);
    setHistoryAppointmentId("");
    setAppointmentView("upcoming");
    setSelectedSubjectId(ALL_SUBJECTS);
    setNewAppointmentDraft({ ...emptyAppointmentDraft });
    setNewAppointmentSubjectId("");
    setTextIntakeSubjectId("");
    setTextIntakeValue("");
    setTextIntakeDraft(null);
    setTextIntakeAiDraft(null);
    setTextIntakeItemId(null);
    setTextIntakeMatches([]);
    setSelectedTextIntakeMatchId("new");
    setTextIntakeTargetAppointmentId(null);
    setContextualTextIntakeValue("");
    setApplyTextIntakeAppointmentDetails(false);
    setNewCareVipName("");
    setManagingCareVips(false);
    setMessage(signOutMessage);
  }

  async function handleAcceptBetaAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const user = userData.user;

      if (!user) {
        throw new Error("Please sign in before continuing.");
      }

      if (!acceptBetaDisclaimer || !acceptBetaPrivacy || !acceptBetaTerms) {
        throw new Error("Please acknowledge each Early Access item to continue.");
      }

      const acknowledgedAt = new Date().toISOString();
      const profileEmail = requiresEmailUpdate
        ? profileDraft.email.trim()
        : user.email ?? profileDraft.email.trim();
      const { error } = await supabase.from("profiles").upsert({
        beta_agreement_version: betaAgreementVersion,
        beta_disclaimer_acknowledged_at: acknowledgedAt,
        beta_privacy_acknowledged_at: acknowledgedAt,
        beta_terms_acknowledged_at: acknowledgedAt,
        email: profileEmail,
        id: user.id,
      });

      if (error) {
        throw error;
      }

      setBetaDisclaimerAcknowledgedAt(acknowledgedAt);
      setBetaPrivacyAcknowledgedAt(acknowledgedAt);
      setBetaTermsAcknowledgedAt(acknowledgedAt);
      setAcceptBetaDisclaimer(false);
      setAcceptBetaPrivacy(false);
      setAcceptBetaTerms(false);
      await loadAppointments();
      showToast("Early Access acknowledgement saved.", {
        durationMs: 5000,
        type: "success",
      });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setMessage("");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      const user = userData.user;

      if (!user) {
        throw new Error("Please sign in before saving your profile.");
      }

      const profileEmail = user.email ?? profileDraft.email.trim();
      const { normalizedPhone } = validateProfileDraft({
        isLikelyEmail,
        profileDetailsRequired,
        profileDraft,
        profileEmail,
        requiresEmailUpdate,
        userEmail: user.email,
      });

      if (requiresEmailUpdate) {
        const { error: authUpdateError } = await supabase.auth.updateUser({
          data: {
            ...(user.user_metadata ?? {}),
            requires_email_update: false,
          },
          email: profileEmail,
        });

        if (authUpdateError) {
          throw authUpdateError;
        }
      }

      const completedAt = new Date().toISOString();
      const trimmedProfileDraft = trimProfileDraft(profileDraft);
      const storedDisplayName = trimmedProfileDraft.displayName || null;
      const visibleDisplayName = profileDisplayName({
        displayName: trimmedProfileDraft.displayName,
        email: profileEmail,
        familyName: trimmedProfileDraft.familyName,
        givenName: trimmedProfileDraft.givenName,
      });
      const savedDraft: ProfileDraft = {
        ...trimmedProfileDraft,
        email: profileEmail,
        phone: normalizedPhone?.display ?? "",
        postalCode: formatUsZipFromDigits(zipDigits(trimmedProfileDraft.postalCode)),
      };
      const { error } = await supabase.from("profiles").upsert({
        address_line1: trimmedProfileDraft.addressLine1 || null,
        address_line2: trimmedProfileDraft.addressLine2 || null,
        city: trimmedProfileDraft.city || null,
        country: trimmedProfileDraft.country || null,
        display_name: storedDisplayName,
        email: profileEmail,
        family_name: trimmedProfileDraft.familyName,
        given_name: trimmedProfileDraft.givenName,
        id: user.id,
        onboarding_completed_at: completedAt,
        phone: normalizedPhone?.display ?? null,
        phone_e164: normalizedPhone?.e164 ?? null,
        postal_code: savedDraft.postalCode || null,
        region: trimmedProfileDraft.region || null,
        timezone: trimmedProfileDraft.timezone,
      });

      if (error) {
        throw error;
      }

      const { error: setupError } = await supabase.rpc(
        "ensure_personal_account_setup"
      );

      if (setupError) {
        throw setupError;
      }

      await assignCurrentUserEarlyAccessPlan();

      const { careCircleId } = await getPrimaryCareContext();
      const { error: subjectSyncError } = await supabase
        .from("care_subjects")
        .update({ display_name: visibleDisplayName })
        .eq("care_circle_id", careCircleId)
        .eq("is_default", true);

      if (subjectSyncError) {
        throw subjectSyncError;
      }

      setOnboardingCompletedAt(completedAt);
      setRequiresEmailUpdate(false);
      setSignedInEmail(profileEmail);
      setProfileDraft(savedDraft);
      setSavedProfileDraft(savedDraft);
      setSavedProfileLabel(visibleDisplayName);
      await loadAppointments();
      setShowOnboardingReady(true);
      setMessage("");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSeedSampleDataForCurrentUser(forceIfDeclined = false) {
    setSeedingSampleData(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "seed_sample_data_for_current_user",
        {
          force_if_declined: forceIfDeclined,
        }
      );

      if (error) {
        throw error;
      }

      const status = sampleDataStatusFromValue(data);

      if (status.status === "seeded" || status.status === "already_seeded") {
        setSampleDataSeededAt(
          status.seeded_at ?? new Date().toISOString()
        );
        setSampleDataDeclinedAt(null);
        await loadAppointments("upcoming", ALL_SUBJECTS);
        showToast(sampleDataStatusText(status), {
          durationMs: 7000,
          type: "success",
        });
        return;
      }

      if (status.status === "declined") {
        setSampleDataDeclinedAt(status.declined_at ?? new Date().toISOString());
      }

      setMessage(sampleDataStatusText(status));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSeedingSampleData(false);
    }
  }

  async function handleRemoveSampleData() {
    const confirmed = window.confirm(
      "Remove demo data? This deletes only appointments, notes, and CarePrep marked as demo data. Your real information will stay."
    );

    if (!confirmed) {
      return;
    }

    setRemovingSampleData(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "remove_demo_data_for_current_user"
      );

      if (error) {
        throw error;
      }

      const result =
        data && typeof data === "object" && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : {};
      const removedCount =
        typeof result.appointments_removed === "number"
          ? result.appointments_removed
          : 0;
      const declinedAt =
        typeof result.declined_at === "string"
          ? result.declined_at
          : new Date().toISOString();

      setSampleDataSeededAt(null);
      setSampleDataDeclinedAt(declinedAt);
      await loadAppointments(appointmentView, selectedSubjectId);
      showToast(
        removedCount > 0
          ? `Demo data removed: ${removedCount} appointments deleted.`
          : "Demo data removed.",
        { durationMs: 7000, type: "success" }
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setRemovingSampleData(false);
    }
  }

  async function handleLoadAdminSampleStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingAdminSampleStatus(true);
    setMessage("");

    try {
      const emailForLookup = adminSampleEmail.trim();

      if (!isLikelyEmail(emailForLookup)) {
        throw new Error("Enter a valid user email.");
      }

      const { data, error } = await supabase.rpc("admin_sample_data_status", {
        target_email: emailForLookup,
      });

      if (error) {
        throw error;
      }

      const status = sampleDataStatusFromValue(data);
      setAdminSampleStatus(status);
      setAdminSampleForceDeclined(false);
      setMessage(sampleDataStatusText(status));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingAdminSampleStatus(false);
    }
  }

  async function handleSeedAdminSampleData() {
    setSeedingAdminSampleData(true);
    setMessage("");

    try {
      const emailForSeed = adminSampleEmail.trim();

      if (!isLikelyEmail(emailForSeed)) {
        throw new Error("Enter a valid user email.");
      }

      if (
        adminSampleStatus?.status === "declined" &&
        !adminSampleForceDeclined
      ) {
        throw new Error(
          "This user declined sample data. Check the override box before adding it."
        );
      }

      const { data, error } = await supabase.rpc("admin_seed_sample_data", {
        force_if_declined: adminSampleForceDeclined,
        target_email: emailForSeed,
      });

      if (error) {
        throw error;
      }

      const status = sampleDataStatusFromValue(data);
      setAdminSampleStatus(status);
      showToast(sampleDataStatusText(status), {
        durationMs: 7000,
        type: status.status === "seeded" ? "success" : "info",
      });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSeedingAdminSampleData(false);
    }
  }

  async function handleAdminUpdateUserEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdatingAdminUserEmail(true);
    setAdminEmailUpdateResult("");
    setMessage("");

    try {
      const currentEmail = adminEmailUpdateCurrentEmail.trim();
      const newEmail = adminEmailUpdateNewEmail.trim();
      const reason = adminEmailUpdateReason.trim();

      if (!isLikelyEmail(currentEmail) || !isLikelyEmail(newEmail)) {
        throw new Error("Enter a valid current email and replacement email.");
      }

      if (reason.length < 8) {
        throw new Error("Enter a brief reason before updating user email.");
      }

      if (currentEmail.toLowerCase() === newEmail.toLowerCase()) {
        throw new Error("The replacement email must be different.");
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before updating user email.");
      }

      const response = await fetch("/api/admin/update-user-email", {
        body: JSON.stringify({ currentEmail, newEmail, reason }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "User email update failed.");
      }

      const successMessage = `Updated ${currentEmail} to ${result.email ?? newEmail}.`;
      setAdminEmailUpdateCurrentEmail("");
      setAdminEmailUpdateNewEmail("");
      setAdminEmailUpdateReason("");
      setAdminEmailUpdateResult(successMessage);
      showToast(successMessage, { type: "success" });
    } catch (error) {
      setAdminEmailUpdateResult(getErrorMessage(error));
      setMessage(getErrorMessage(error));
    } finally {
      setUpdatingAdminUserEmail(false);
    }
  }

  const {
    createCareVip: handleCreateCareVip,
    deactivateCareVip: handleDeactivateCareVip,
    reactivateCareVip: handleReactivateCareVip,
  } = createCareVipActions({
    allSubjectsValue: ALL_SUBJECTS,
    appointmentView,
    canAddCareVip,
    careSubjects,
    entitlement,
    getErrorMessage,
    getPrimaryCareContext,
    isLikelyEmail,
    loadAppointments,
    newCareVipName,
    pendingReactivateCareVip,
    setCareVipFormMessage,
    setCreatingCareVip,
    setDeactivatingCareVipId,
    setManagingCareVips,
    setMessage,
    setNewAppointmentSubjectId,
    setNewCareVipName,
    setPendingDeactivateCareVipId,
    setPendingReactivateCareVip,
    setSelectedSubjectId,
    supabase,
  });

  async function handleInterpretTextIntake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProcessingTextIntake(true);
    setMessage("");

    try {
      const targetAppointment = textIntakeTargetAppointmentId
        ? (appointments.find(
            (appointment) => appointment.id === textIntakeTargetAppointmentId
          ) ??
          (notesReminderAppointment?.id === textIntakeTargetAppointmentId
            ? notesReminderAppointment
            : null))
        : null;
      const rawText = targetAppointment
        ? contextualTextIntakeValue.trim()
        : textIntakeValue.trim();
      const shouldUseBulkAppointmentIntake = !targetAppointment;

      if (!rawText) {
        throw new Error("Paste some text before running intake.");
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before using intake.");
      }

      const response = await fetch("/api/intake", {
        body: JSON.stringify({
          careSubjectId:
            targetAppointment?.care_subject_id ||
            textIntakeSubjectId ||
            (selectedSubjectId !== ALL_SUBJECTS ? selectedSubjectId : ""),
          appointmentContext: targetAppointment
            ? {
                location_address: targetAppointment.location_address,
                location_name: targetAppointment.location_name,
                location_phone: targetAppointment.location_phone,
                provider_name: targetAppointment.provider_name,
                provider_organization: targetAppointment.provider_organization,
                reason: targetAppointment.reason,
                starts_at: targetAppointment.starts_at,
                title: targetAppointment.title,
              }
            : null,
          mode: shouldUseBulkAppointmentIntake ? "bulk_appointments" : "single",
          rawText,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Text intake failed.");
      }

      if (shouldUseBulkAppointmentIntake) {
        const drafts = bulkAppointmentDraftsFromResult(result.draft);

        if (drafts.length === 0) {
          throw new Error("No appointments were found in that text.");
        }

        setBulkAppointmentDrafts(drafts);
        setBulkAppointmentSummary(String(result.draft?.import_summary ?? ""));
        setTextIntakeDraft(null);
        setTextIntakeAiDraft(null);
        setTextIntakeItemId(result.intakeItemId ?? null);
        setTextIntakeMatches([]);
        setSelectedTextIntakeMatchId("new");
        setMessage(`Found ${drafts.length} appointment draft(s). Review before saving.`);
        return;
      }

      const baseDraft = intakeDraftFromResult(result.draft);
      const isFutureStandaloneAppointment =
        !targetAppointment && isTodayOrFutureDate(baseDraft.startsAt);
      const interpretedDraft = targetAppointment
        ? {
            ...baseDraft,
            appointmentReason:
              baseDraft.appointmentReason || targetAppointment.reason || "",
            appointmentTitle:
              baseDraft.appointmentTitle || targetAppointment.title || "",
            locationAddress:
              baseDraft.locationAddress ||
              targetAppointment.location_address ||
              "",
            locationName:
              baseDraft.locationName || targetAppointment.location_name || "",
            locationPhone:
              baseDraft.locationPhone || targetAppointment.location_phone || "",
            providerName:
              baseDraft.providerName || targetAppointment.provider_name || "",
            providerOrganization:
              baseDraft.providerOrganization ||
              targetAppointment.provider_organization ||
              "",
            startsAt:
              baseDraft.startsAt ||
              toDatetimeLocalValue(targetAppointment.starts_at),
          }
        : isFutureStandaloneAppointment
          ? {
              ...baseDraft,
              appointmentReason:
                baseDraft.appointmentReason || baseDraft.notesSummary,
              followups: "",
              notesSummary: "",
              takeaways: "",
            }
        : baseDraft;
      const interpretedSubjectId =
        result.careSubjectId ??
        targetAppointment?.care_subject_id ??
        textIntakeSubjectId;
      const { careCircleId, careSubjectId } =
        await getPrimaryCareContext(interpretedSubjectId);
      const matches = careSubjectId && !targetAppointment
        ? await findTextIntakeMatches(
            interpretedDraft,
            careCircleId,
            careSubjectId
          )
        : [];
      setTextIntakeDraft(interpretedDraft);
      setTextIntakeAiDraft(interpretedDraft);
      setTextIntakeItemId(result.intakeItemId ?? null);
      setBulkAppointmentDrafts([]);
      setBulkAppointmentSummary("");
      setTextIntakeMatches(matches);
      setSelectedTextIntakeMatchId(targetAppointment?.id ?? "new");
      setTextIntakeSubjectId(interpretedSubjectId);
      setMessage(
        targetAppointment
          ? "Text interpreted for this appointment. Review before saving."
          : matches.length > 0
          ? "Text interpreted. Possible appointment match found."
          : "Text interpreted. Review before saving."
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setProcessingTextIntake(false);
    }
  }

  async function handleExtractImageText(
    files: FileList | File[] | null,
    target: "appointmentNotes" | "quickAdd" = "quickAdd",
    scope: "appointments" | "importAnything" = "appointments"
  ): Promise<ImageTextExtractionResult> {
    const images = Array.isArray(files) ? files : files ? Array.from(files) : [];

    if (images.length === 0) {
      return { extractedCount: 0 };
    }

    setExtractingImageText(true);
    setFileImportStatus("Importing image text...");
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before extracting text.");
      }

      const formData = new FormData();

      images.forEach((image) => {
        formData.append("images", image);
      });
      formData.append(
        "scope",
        scope === "importAnything" ? "import_anything" : "appointments"
      );

      const response = await fetch("/api/ocr", {
        body: formData,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
      });
      const result = await parseApiResponse<{ extractedText?: unknown }>(
        response,
        "Image text extraction failed."
      );

      const extractedText =
        typeof result.extractedText === "string"
          ? result.extractedText.trim()
          : "";

      if (!extractedText) {
        throw new Error("No text was found in that image.");
      }

      if (target === "appointmentNotes") {
        setContextualTextIntakeValue((currentValue) =>
          [currentValue.trim(), extractedText].filter(Boolean).join("\n\n")
        );
      } else {
        setTextIntakeValue((currentValue) =>
          [currentValue.trim(), extractedText].filter(Boolean).join("\n\n")
        );
      }
      setMessage(
        `Text extracted from ${images.length} image${
          images.length === 1 ? "" : "s"
        }. Review the text before ${
          scope === "importAnything"
            ? "reviewing everything found"
            : target === "appointmentNotes"
            ? "interpreting notes"
            : "reviewing appointments"
        }.`
      );
      return { extractedCount: images.length };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage(errorMessage);
      return { errorMessage, extractedCount: 0 };
    } finally {
      setExtractingImageText(false);
      setFileImportStatus("");
    }
  }

  function resetImportAnythingReview() {
    setImportAnythingIntakeItemId(null);
    setImportAnythingItems([]);
    setImportAnythingIdentityResolutionChoices([]);
    setImportAnythingIdentityResolutionOpen(false);
    setImportAnythingNewPersonName("");
    setImportAnythingOwnershipClusters([]);
    setImportAnythingPersonAssignment(null);
    setImportAnythingReviewOpen(false);
    setImportAnythingSummary("");
    setImportAnythingSources([]);
    setConfirmingImportAnythingSaveAll(false);
    setEditingImportAnythingItemIds({});
    setViewingImportAnythingSourceItemId(null);
  }

  function changeImportAnythingOwnerToCurrentFocus() {
    if (!selectedSubjectId || selectedSubjectId === ALL_SUBJECTS) {
      return;
    }

    const nextOwner = subjectsById.get(selectedSubjectId);

    if (!nextOwner) {
      return;
    }

    setImportAnythingOwnerPersonId(nextOwner.id);
    setTextIntakeSubjectId(nextOwner.id);

    if (importAnythingItems.length > 0) {
      setImportAnythingIntakeItemId(null);
      setImportAnythingItems((currentItems) =>
        currentItems.map((item) => ({
          ...item,
          matchedAppointmentId: "",
          matchedProviderId: "",
          needsReview: true,
          providerMatchNote: "",
          status: "needs_review",
        }))
      );
      setMessage("");
      return;
    }

    setMessage("");
  }

  async function handleImportAnythingFiles(files: FileList | null) {
    const selectedFiles = files ? Array.from(files) : [];

    if (selectedFiles.length === 0) {
      return;
    }

    setFileImportStatus("Importing files...");
    setMessage("");
    setImportAnythingIntakeItemId(null);
    setImportAnythingItems([]);
    setConfirmingImportAnythingSaveAll(false);
    setImportAnythingReviewOpen(false);
    setImportAnythingSummary("");

    try {
      const imageFiles = selectedFiles.filter((file) =>
        file.type.startsWith("image/")
      );
      const textFiles = selectedFiles.filter(
        (file) =>
          file.type.startsWith("text/") ||
          /\.(txt|md|csv|log)$/i.test(file.name)
      );
      const pdfFiles = selectedFiles.filter(
        (file) =>
          file.type === "application/pdf" || /\.pdf$/i.test(file.name)
      );
      const extractedSections: string[] = [];
      const importedSourceFiles = [...textFiles, ...pdfFiles];
      let imageExtractionError = "";

      for (const file of textFiles) {
        extractedSections.push(
          formatImportAnythingTextSection({
            name: file.name,
            text: await file.text(),
          })
        );
      }

      if (pdfFiles.length > 0) {
        setFileImportStatus("Importing PDF text...");
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error("Please sign in before extracting PDF text.");
        }

        const formData = new FormData();
        pdfFiles.forEach((file) => {
          formData.append("pdfs", file);
        });

        const response = await fetch("/api/import-anything/pdf", {
          body: formData,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          method: "POST",
        });
        const result = await parseApiResponse<{ extractedText?: unknown }>(
          response,
          "PDF text extraction failed."
        );

        const extractedText =
          typeof result.extractedText === "string"
            ? result.extractedText.trim()
            : "";

        if (!extractedText) {
          throw new Error("No text was found in that PDF.");
        }

        extractedSections.push(
          formatImportAnythingTextSection({
            name:
              pdfFiles.length === 1
                ? pdfFiles[0]?.name ?? "Extracted PDF text"
                : "Extracted PDF text",
            text: extractedText,
          })
        );
      }

      const unsupportedFiles = selectedFiles.filter(
        (file) =>
          !imageFiles.includes(file) &&
          !textFiles.includes(file) &&
          !pdfFiles.includes(file)
      );

      for (const file of unsupportedFiles) {
        extractedSections.push(
          formatImportAnythingPlaceholderSection({
            message:
              "Source selected but not extracted in this local build. Original file is not retained.",
            name: file.name,
          })
        );
      }

      if (extractedSections.length > 0) {
        setTextIntakeValue((currentValue) =>
          [currentValue.trim(), extractedSections.join("\n\n")]
            .filter(Boolean)
            .join("\n\n")
        );
      }

      if (imageFiles.length > 0) {
        const imageResult = await handleExtractImageText(
          imageFiles,
          "quickAdd",
          "importAnything"
        );

        if (imageResult.extractedCount > 0) {
          importedSourceFiles.push(...imageFiles);
        } else {
          imageExtractionError = imageResult.errorMessage ?? "";
        }
      }

      importedSourceFiles.push(...unsupportedFiles);

      if (importedSourceFiles.length > 0) {
        setImportAnythingSources((currentSources) =>
          Array.from(
            new Set([
              ...currentSources,
              ...importedSourceFiles.map((file) =>
                formatImportAnythingSourceSummary(file)
              ),
            ])
          ).slice(0, maxImportAnythingSourceSummaries)
        );
      }

      if (imageExtractionError) {
        setMessage(
          importedSourceFiles.length > 0
            ? `Added ${importedSourceFiles.length} source${
                importedSourceFiles.length === 1 ? "" : "s"
              }. ${imageExtractionError}`
            : imageExtractionError
        );
      } else {
        setMessage(
          `Added ${importedSourceFiles.length} source${
            importedSourceFiles.length === 1 ? "" : "s"
          }. Review the text before running Import Anything.`
        );
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setFileImportStatus("");
    }
  }

  function handleImportAnythingDrag(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (extractingImageText || fileImportStatus) {
      importAnythingDragDepthRef.current = 0;
      setImportAnythingDragActive(false);
      return;
    }

    if (event.type === "dragenter") {
      importAnythingDragDepthRef.current += 1;
    }

    if (event.type === "dragleave") {
      importAnythingDragDepthRef.current = Math.max(
        0,
        importAnythingDragDepthRef.current - 1
      );
    }

    setImportAnythingDragActive(importAnythingDragDepthRef.current > 0);
  }

  function handleImportAnythingDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    importAnythingDragDepthRef.current = 0;
    setImportAnythingDragActive(false);

    if (extractingImageText || fileImportStatus) {
      return;
    }

    void handleImportAnythingFiles(event.dataTransfer.files);
  }

  function handleAppointmentNotesDrag(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (extractingImageText || fileImportStatus) {
      appointmentNotesDragDepthRef.current = 0;
      setAppointmentNotesDragActive(false);
      return;
    }

    if (event.type === "dragenter") {
      appointmentNotesDragDepthRef.current += 1;
    }

    if (event.type === "dragleave") {
      appointmentNotesDragDepthRef.current = Math.max(
        0,
        appointmentNotesDragDepthRef.current - 1
      );
    }

    setAppointmentNotesDragActive(appointmentNotesDragDepthRef.current > 0);
  }

  function handleAppointmentNotesDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    appointmentNotesDragDepthRef.current = 0;
    setAppointmentNotesDragActive(false);

    if (extractingImageText || fileImportStatus) {
      return;
    }

    void handleAppointmentNotesFiles(event.dataTransfer.files);
  }

  async function handleAppointmentNotesFiles(files: FileList | null) {
    const selectedFiles = files ? Array.from(files) : [];

    if (selectedFiles.length === 0) {
      return;
    }

    setFileImportStatus("Importing files...");
    setMessage("");

    try {
      const imageFiles = selectedFiles.filter((file) =>
        file.type.startsWith("image/")
      );
      const textFiles = selectedFiles.filter(
        (file) =>
          file.type.startsWith("text/") ||
          /\.(txt|md|csv|log)$/i.test(file.name)
      );
      const pdfFiles = selectedFiles.filter(
        (file) =>
          file.type === "application/pdf" || /\.pdf$/i.test(file.name)
      );
      const extractedSections: string[] = [];
      let importedCount = textFiles.length + pdfFiles.length;
      let imageExtractionError = "";

      for (const file of textFiles) {
        extractedSections.push(
          formatImportAnythingTextSection({
            name: file.name,
            text: await file.text(),
          })
        );
      }

      if (pdfFiles.length > 0) {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error("Please sign in before extracting PDF text.");
        }

        const formData = new FormData();
        pdfFiles.forEach((file) => {
          formData.append("pdfs", file);
        });

        const response = await fetch("/api/import-anything/pdf", {
          body: formData,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          method: "POST",
        });
        const result = await parseApiResponse<{ extractedText?: unknown }>(
          response,
          "PDF text extraction failed."
        );

        const extractedText =
          typeof result.extractedText === "string"
            ? result.extractedText.trim()
            : "";

        if (!extractedText) {
          throw new Error("No text was found in that PDF.");
        }

        extractedSections.push(
          formatImportAnythingTextSection({
            name:
              pdfFiles.length === 1
                ? pdfFiles[0]?.name ?? "Extracted PDF text"
                : "Extracted PDF text",
            text: extractedText,
          })
        );
      }

      if (extractedSections.length > 0) {
        setContextualTextIntakeValue((currentValue) =>
          [currentValue.trim(), extractedSections.join("\n\n")]
            .filter(Boolean)
            .join("\n\n")
        );
      }

      if (imageFiles.length > 0) {
        const imageResult = await handleExtractImageText(
          imageFiles,
          "appointmentNotes"
        );

        if (imageResult.extractedCount > 0) {
          importedCount += imageResult.extractedCount;
        } else {
          imageExtractionError = imageResult.errorMessage ?? "";
        }
      }

      const unsupportedFiles = selectedFiles.filter(
        (file) =>
          !imageFiles.includes(file) &&
          !textFiles.includes(file) &&
          !pdfFiles.includes(file)
      );

      if (unsupportedFiles.length > 0) {
        setContextualTextIntakeValue((currentValue) =>
          [
            currentValue.trim(),
            unsupportedFiles
              .map((file) =>
                formatImportAnythingPlaceholderSection({
                  message:
                    "Source selected but not extracted in this local build. Original file is not retained.",
                  name: file.name,
                })
              )
              .join("\n\n"),
          ]
            .filter(Boolean)
            .join("\n\n")
        );
        importedCount += unsupportedFiles.length;
      }

      setMessage(
        imageExtractionError ||
          `Added ${importedCount} source${
            importedCount === 1 ? "" : "s"
          }. Review the text before creating the summary.`
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setFileImportStatus("");
    }
  }

  async function handleInterpretImportAnything() {
    if (!textIntakeValue.trim()) {
      setMessage("Add files or pasted text before reviewing.");
      return;
    }

    setProcessingImportAnything(true);
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before using Import Anything.");
      }

      const response = await fetch("/api/import-anything", {
        body: JSON.stringify({
          careSubjectId:
            selectedSubjectId && selectedSubjectId !== ALL_SUBJECTS
              ? selectedSubjectId
              : "",
          rawText: textIntakeValue,
          sourceSummaries: importAnythingSources,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await parseApiResponse<{
        careSubjectId?: string;
        draft?: unknown;
        error?: string;
        intakeItemId?: string;
        personAssignment?: unknown;
      }>(response, "Import Anything review failed.");

      const reviewItems = importAnythingItemsFromDraft(result.draft);
      const ownershipClusters =
        importAnythingOwnershipClustersFromDraft(result.draft);
      const unresolvedIdentities = importAnythingUnresolvedDetectedIdentities({
        clusters: ownershipClusters,
        items: reviewItems,
      });
      const personAssignment =
        importAnythingPersonAssignmentFromUnknown(result.personAssignment) ??
        importAnythingPersonAssignmentFromUnknown(
          result.draft &&
            typeof result.draft === "object" &&
            !Array.isArray(result.draft)
            ? (result.draft as Record<string, unknown>).person_assignment
            : null
        );
      const highConfidencePersonId =
        personAssignment &&
        personAssignment.matchedCareSubjectId &&
        personAssignment.confidence >= 0.85 &&
        !personAssignment.needsReview
          ? personAssignment.matchedCareSubjectId
          : "";

      if (reviewItems.length === 0) {
        throw new Error("No importable healthcare items were found.");
      }

      setImportAnythingItems(reviewItems);
      setConfirmingImportAnythingSaveAll(false);
      setEditingImportAnythingItemIds({});
      setViewingImportAnythingSourceItemId(null);
      setImportAnythingIdentityResolutionChoices(
        unresolvedIdentities.map((identity) => ({
          action: "",
          clusterId: identity.clusterId,
          createName: identity.suggestedNewPersonName || identity.displayName,
          detectedName: identity.displayName,
          editingPetSpecies: false,
          managedByHousehold: false,
          matchedCareSubjectId: "",
          otherPetType: "",
          petKind: "cat",
          subjectType: "other",
        }))
      );
      setImportAnythingIdentityResolutionOpen(
        unresolvedIdentities.length > 0
      );
      setImportAnythingOwnershipClusters(ownershipClusters);
      setImportAnythingReviewOpen(unresolvedIdentities.length === 0);
      setImportAnythingSummary(
        importAnythingDeterministicSummary(reviewItems, ownershipClusters)
      );
      setImportAnythingIntakeItemId(result.intakeItemId ?? null);
      setImportAnythingPersonAssignment(personAssignment);
      setImportAnythingOwnerPersonId(highConfidencePersonId);
      setImportAnythingNewPersonName(
        personAssignment?.suggestedNewPersonName ?? ""
      );
      setTextIntakeSubjectId(highConfidencePersonId);
      setTextIntakeDraft(null);
      setTextIntakeAiDraft(null);
      setTextIntakeItemId(null);
      setTextIntakeMatches([]);
      setBulkAppointmentDrafts([]);
      setBulkAppointmentSummary("");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setProcessingImportAnything(false);
    }
  }

  function updateImportAnythingIdentityResolutionChoice(
    clusterId: string,
    updates: Partial<ImportAnythingIdentityResolutionChoice>
  ) {
    setImportAnythingIdentityResolutionChoices((currentChoices) =>
      currentChoices.map((choice) =>
        choice.clusterId === clusterId ? { ...choice, ...updates } : choice
      )
    );
  }

  async function completeImportAnythingIdentityResolution() {
    if (importAnythingIdentityResolutionChoices.length === 0) {
      setImportAnythingIdentityResolutionOpen(false);
      setImportAnythingReviewOpen(true);
      return;
    }

    const incompleteChoice = importAnythingIdentityResolutionChoices.find(
      (choice) =>
        !choice.action ||
        (choice.action === "match" && !choice.matchedCareSubjectId) ||
        (choice.action === "create" && !choice.createName.trim())
    );

    if (incompleteChoice) {
      setMessage("Resolve each detected person before reviewing the import.");
      return;
    }

    const createChoices = importAnythingIdentityResolutionChoices.filter(
      (choice) => choice.action === "create"
    );

    if (careSubjects.length + createChoices.length > careVipLimit) {
      setMessage(
        "This household already has the maximum number of Care VIPs."
      );
      return;
    }

    setSavingImportAnything(true);
    setMessage("");

    try {
      const { careCircleId } = await getPrimaryCareContext();
      const decisions: ImportAnythingIdentityResolutionDecision[] = [];
      const createdSubjects: CareSubject[] = [];

      for (const choice of importAnythingIdentityResolutionChoices) {
        if (choice.action === "match") {
          decisions.push({
            action: "match",
            clusterId: choice.clusterId,
            matchedCareSubjectId: choice.matchedCareSubjectId,
          });
          continue;
        }

        if (choice.action === "leave_unresolved") {
          decisions.push({
            action: "leave_unresolved",
            clusterId: choice.clusterId,
          });
          continue;
        }

        const displayName = choice.createName.trim();
        const subjectType = choice.subjectType.trim() || "other";
        const isPet = isPetSubjectType(subjectType);
        const { data: newSubject, error } = await supabase
          .from("care_subjects")
          .insert({
            care_circle_id: careCircleId,
            display_name: displayName,
            is_active: true,
            is_default: careSubjects.length + createdSubjects.length === 0,
            managed_by_household: isPet ? true : choice.managedByHousehold,
            subject_type: subjectType,
          })
          .select(
            "id,care_circle_id,display_name,subject_type,is_default,is_active,managed_by_household"
          )
          .single();

        if (error) {
          throw error;
        }

        const createdSubjectBase = {
          avatarAltText: null,
          avatarEmoji: null,
          avatarIsDefault: false,
          avatarType: "initials",
          avatarUrl: null,
          care_circle_id: newSubject.care_circle_id,
          display_name: newSubject.display_name,
          id: newSubject.id,
          is_active: newSubject.is_active,
          is_default: newSubject.is_default,
          managed_by_household: newSubject.managed_by_household ?? false,
          subject_type: newSubject.subject_type,
        } satisfies CareSubject;
        const defaultAvatarEmoji = defaultPetAvatarEmoji(createdSubjectBase);
        const createdSubject = {
          ...createdSubjectBase,
          avatarEmoji: defaultAvatarEmoji,
          avatarIsDefault: Boolean(defaultAvatarEmoji),
        } satisfies CareSubject;

        createdSubjects.push(createdSubject);
        decisions.push({
          action: "create",
          clusterId: choice.clusterId,
          createdCareSubjectId: newSubject.id,
        });
      }

      if (createdSubjects.length > 0) {
        setCareSubjects((currentSubjects) =>
          [...currentSubjects, ...createdSubjects].sort((a, b) => {
            if (a.is_default !== b.is_default) {
              return a.is_default ? -1 : 1;
            }

            return a.display_name.localeCompare(b.display_name);
          })
        );
      }

      const resolvedItems = applyImportAnythingIdentityResolutions({
        decisions,
        items: importAnythingItems,
      });

      setImportAnythingItems(resolvedItems);
      const resolvedClusters = importAnythingOwnershipClusters.map((cluster) => {
          const decision = decisions.find(
            (item) => item.clusterId === cluster.clusterId
          );
          const matchedCareSubjectId =
            decision?.action === "match"
              ? decision.matchedCareSubjectId ?? ""
              : decision?.action === "create"
                ? decision.createdCareSubjectId ?? ""
                : "";

          return matchedCareSubjectId
            ? { ...cluster, matchedCareSubjectId }
            : cluster;
        });

      setImportAnythingOwnershipClusters(resolvedClusters);
      setImportAnythingSummary(
        importAnythingDeterministicSummary(resolvedItems, resolvedClusters)
      );
      setImportAnythingIdentityResolutionOpen(false);
      setImportAnythingReviewOpen(true);
      setMessage(
        createdSubjects.length > 0
          ? "Care VIP created and import ownership resolved."
          : "Import ownership resolved."
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingImportAnything(false);
    }
  }

  function setImportAnythingItemStatus(
    itemId: string,
    status: ImportAnythingReviewStatus
  ) {
    setImportAnythingItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status,
              userReviewed: status === "approved" ? true : item.userReviewed,
            }
          : item
      )
    );
  }

  function undoImportAnythingItemApproval(itemId: string) {
    setExpandedImportAnythingItemIds((currentIds) => ({
      ...currentIds,
      [itemId]: false,
    }));
    setImportAnythingItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: item.needsReview ? "needs_review" : "approved",
              userReviewed: false,
            }
          : item
      )
    );
  }

  function updateImportAnythingItemField(
    itemId: string,
    field: string,
    value: string
  ) {
    setImportAnythingItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              fields: {
                ...item.fields,
                [field]: value,
              },
              title:
                field === "appointmentTitle" ||
                field === "title" ||
                field === "providerName" ||
                field === "medicationName" ||
                field === "question"
                  ? value
                  : item.title,
              userReviewed: true,
            }
          : item
      )
    );
  }

  function updateImportAnythingItemOwner(
    itemId: string,
    updates: Partial<
      Pick<ImportAnythingReviewItem, "ownerCareSubjectId" | "ownerNewPersonName">
    >
  ) {
    setImportAnythingItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...updates,
              ownerCareSubjectId:
                updates.ownerNewPersonName?.trim()
                  ? ""
                  : updates.ownerCareSubjectId ?? item.ownerCareSubjectId,
              ownerNewPersonName:
                updates.ownerCareSubjectId
                  ? ""
                  : updates.ownerNewPersonName ?? item.ownerNewPersonName,
              userReviewed: true,
            }
          : item
      )
    );
  }

  function updateImportAnythingItemAppointment(
    itemId: string,
    appointmentId: string
  ) {
    const matchedAppointment = appointmentId
      ? appointmentsById.get(appointmentId)
      : null;

    setImportAnythingItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const shouldCreateNewAppointment =
          item.kind === "note" && !matchedAppointment;

        return {
          ...item,
          createsNewAppointment: shouldCreateNewAppointment,
          matchedAppointmentId: matchedAppointment?.id ?? "",
          ownerCareSubjectId:
            matchedAppointment?.care_subject_id ?? item.ownerCareSubjectId,
          ownerNewPersonName: matchedAppointment
            ? ""
            : item.ownerNewPersonName,
          userReviewed: true,
        };
      })
    );
  }

  async function handleCommitImportAnythingReview(
    reviewItems = importAnythingItems
  ) {
    const approvedItems = reviewItems.filter(
      (item) => item.status === "approved"
    );

    if (approvedItems.length === 0) {
      setMessage("Approve at least one item before saving.");
      return;
    }

    setSavingImportAnything(true);
    setMessage("");

    try {
      if (importAnythingIdentityResolutionOpen) {
        throw new Error("Resolve detected people before saving this import.");
      }

      const { careCircleId, userId } = await getPrimaryCareContext();
      const createdSubjectIdsByName = new Map<string, string>();

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before saving.");
      }

      let createdAppointments = 0;
      let createdCarePrepDrafts = 0;
      let savedNotes = 0;
      let trackedProviders = 0;
      let reviewedOnly = 0;
      const generatedAt = new Date().toISOString();
      const careSubjectIdForItem = (item: ImportAnythingReviewItem) =>
        subjectsById.has(item.ownerCareSubjectId.trim())
          ? item.ownerCareSubjectId.trim()
          : "";
      const approvedItemsWithOwners = approvedItems.map((item) => ({
        careSubjectId: careSubjectIdForItem(item),
        item,
      }));
      const itemsByCareSubjectId = new Map<string, ImportAnythingReviewItem[]>();

      for (const { careSubjectId, item } of approvedItemsWithOwners) {
        if (!careSubjectId) {
          continue;
        }

        itemsByCareSubjectId.set(careSubjectId, [
          ...(itemsByCareSubjectId.get(careSubjectId) ?? []),
          item,
        ]);
      }

      const carePrepDrafts = Array.from(itemsByCareSubjectId.entries()).flatMap(
        ([, items]) =>
          buildImportAnythingCarePrepDrafts({
            appointmentsById,
            careCircleId,
            generatedAt,
            intakeItemId: importAnythingIntakeItemId,
            items,
            userId,
          })
      );
      const providerUpserts = Array.from(itemsByCareSubjectId.entries()).flatMap(
        ([careSubjectId, items]) =>
          buildImportAnythingProviderUpserts({
            careCircleId,
            careSubjectId,
            generatedAt,
            intakeItemId: importAnythingIntakeItemId,
            items,
            userId,
          })
      );
      let providerStoreAvailable = true;
      const isCarePrepDraftCandidate = (item: ImportAnythingReviewItem) =>
        (item.kind === "careprep" ||
          item.kind === "medication_change" ||
          item.kind === "question" ||
          item.kind === "task") &&
        Boolean(item.matchedAppointmentId);
      const supportingNoteAppointmentIds = new Map<string, string>();
      const createAppointmentForImportItem = async (
        item: ImportAnythingReviewItem,
        careSubjectId: string
      ) => {
        const startsAtDate = item.fields.startsAt
          ? new Date(item.fields.startsAt)
          : null;
        const startsAt =
          startsAtDate && !Number.isNaN(startsAtDate.getTime())
            ? startsAtDate.toISOString()
            : null;
        const { data: appointment, error } = await supabase
          .from("appointments")
          .insert({
            care_circle_id: careCircleId,
            care_subject_id: careSubjectId,
            location_address: item.fields.locationAddress?.trim() || null,
            location_name: item.fields.locationName?.trim() || null,
            location_phone: item.fields.locationPhone?.trim() || null,
            owner_user_id: userId,
            provider_name: item.fields.providerName?.trim() || null,
            provider_organization:
              item.fields.providerOrganization?.trim() || null,
            reason:
              item.fields.appointmentReason?.trim() ||
              (item.kind === "note" ? "Imported Visit Notes" : null),
            source: "manual",
            starts_at: startsAt,
            status: item.kind === "note" ? "completed" : "scheduled",
            title:
              item.fields.appointmentTitle?.trim() ||
              item.fields.appointmentReason?.trim() ||
              (item.kind === "note"
                ? item.title?.trim() || "Imported visit notes"
                : "Imported appointment"),
          })
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        return appointment.id as string;
      };

      if (providerUpserts.length > 0) {
        const { error } = await supabase
          .from("care_providers")
          .upsert(providerUpserts, {
            ignoreDuplicates: true,
            onConflict:
              "care_subject_id,normalized_provider_name,normalized_provider_organization",
          });

        if (error) {
          if (isImportAnythingProviderStoreUnavailable(error)) {
            providerStoreAvailable = false;
          } else {
            throw error;
          }
        } else {
          trackedProviders = providerUpserts.length;
        }
      }

      for (const { careSubjectId, item } of approvedItemsWithOwners) {
        if (!careSubjectId) {
          reviewedOnly += 1;
          continue;
        }

        if (isCarePrepDraftCandidate(item)) {
          continue;
        }

        if (
          item.kind === "provider" &&
          providerStoreAvailable &&
          hasImportAnythingProviderIdentity(item)
        ) {
          if (item.matchedProviderId) {
            reviewedOnly += 1;
          }
          continue;
        }

        if (item.kind === "appointment") {
          if (item.matchedAppointmentId) {
            for (const supportItem of importAnythingFindSupportingNotes(
              item,
              approvedItems
            )) {
              supportingNoteAppointmentIds.set(
                supportItem.id,
                item.matchedAppointmentId
              );
            }
            reviewedOnly += 1;
            continue;
          }

          const appointmentId = await createAppointmentForImportItem(
            item,
            careSubjectId
          );

          for (const supportItem of importAnythingFindSupportingNotes(
            item,
            approvedItems
          )) {
            supportingNoteAppointmentIds.set(supportItem.id, appointmentId);
          }

          createdAppointments += 1;
          continue;
        }

        if (item.kind === "note") {
          let appointmentId =
            item.matchedAppointmentId ||
            supportingNoteAppointmentIds.get(item.id) ||
            "";

          if (!appointmentId && item.createsNewAppointment) {
            appointmentId = await createAppointmentForImportItem(
              item,
              careSubjectId
            );
            createdAppointments += 1;
          }

          if (!appointmentId) {
            reviewedOnly += 1;
            continue;
          }

          const response = await fetch("/api/appointment-notes", {
            body: JSON.stringify({
              appointmentId,
              followups: linesToList(item.fields.followups ?? ""),
              inputText: item.sourceExcerpt || textIntakeValue,
              restoreIfArchived: false,
              source: "intake_user_accepted",
              summary: item.fields.summary ?? "",
              takeaways: linesToList(item.fields.takeaways ?? ""),
            }),
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            method: "POST",
          });
          const result = (await response.json()) as {
            error?: string;
            ok?: boolean;
          };

          if (!response.ok || !result.ok) {
            throw new Error(result.error ?? "Visit Notes could not be saved.");
          }

          savedNotes += 1;
          continue;
        }

        reviewedOnly += 1;
      }

      const carePrepDraftItemCount = carePrepDrafts.reduce(
        (count, draft) => count + draft.itemCount,
        0
      );
      const approvedCarePrepItemCount = approvedItems.filter(
        (item) => isCarePrepDraftCandidate(item)
      ).length;
      reviewedOnly += approvedCarePrepItemCount - carePrepDraftItemCount;

      for (const draft of carePrepDrafts) {
        const { error } = await supabase
          .from("careprep_guidance")
          .insert(draft.payload);

        if (error) {
          throw error;
        }

        createdCarePrepDrafts += 1;
      }

      if (importAnythingIntakeItemId) {
        const { error } = await supabase
          .from("intake_items")
          .update({
            accepted_at: new Date().toISOString(),
            accepted_by_user_id: userId,
            accepted_interpretation: {
              import_summary: importAnythingSummary,
              items: importAnythingItems,
              person_assignment: {
                created_care_subject_ids_by_name: Object.fromEntries(
                  createdSubjectIdsByName
                ),
                source_assignment: importAnythingPersonAssignment,
              },
            },
            interpretation: {
              import_summary: importAnythingSummary,
              items: importAnythingItems,
              person_assignment: {
                created_care_subject_ids_by_name: Object.fromEntries(
                  createdSubjectIdsByName
                ),
                source_assignment: importAnythingPersonAssignment,
              },
            },
            status: "accepted",
          })
          .eq("id", importAnythingIntakeItemId);

        if (error) {
          throw error;
        }
      }

      setTextIntakeValue("");
      setTextIntakeDraft(null);
      setTextIntakeAiDraft(null);
      setTextIntakeItemId(null);
      setTextIntakeMatches([]);
      setBulkAppointmentDrafts([]);
      setBulkAppointmentSummary("");
      setSelectedTextIntakeMatchId("new");
      setTextIntakeTargetAppointmentId(null);
      setImportAnythingOwnerPersonId("");
      setContextualTextIntakeValue("");
      setApplyTextIntakeAppointmentDetails(false);
      resetImportAnythingReview();
      setActiveAppointmentPanel(null);
      await loadAppointments("upcoming");
      setMessage(
        `Import saved. ${createdAppointments} appointment${
          createdAppointments === 1 ? "" : "s"
        } created, ${savedNotes} note${savedNotes === 1 ? "" : "s"} saved, ${
          createdCarePrepDrafts
        } CarePrep draft${
          createdCarePrepDrafts === 1 ? "" : "s"
        } created, ${trackedProviders} provider${
          trackedProviders === 1 ? "" : "s"
        } tracked, ${
          reviewedOnly
        } item${reviewedOnly === 1 ? "" : "s"} kept for review/audit.`
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingImportAnything(false);
    }
  }

  function handleConfirmAllImportAnything() {
    const confirmedItems = importAnythingItems.map((item) => ({
      ...item,
      status: "approved" as const,
      userReviewed: true,
    }));

    setImportAnythingItems(confirmedItems);
    void handleCommitImportAnythingReview(confirmedItems);
    setConfirmingImportAnythingSaveAll(false);
  }

  function updateTextIntakeDraft(
    field: keyof IntakeReviewDraftContent,
    value: string | number
  ) {
    setTextIntakeDraft((currentDraft) => ({
      ...(currentDraft ?? emptyTextIntakeDraft),
      [field]: value,
    }));
  }

  function currentAppointmentModifier(
    appointmentId: string
  ): AppointmentModifier | null {
    if (editingAppointmentIds[appointmentId]) {
      return "edit";
    }

    if (textIntakeTargetAppointmentId === appointmentId) {
      return "import";
    }

    if (editingNoteIds[appointmentId]) {
      return "add";
    }

    return null;
  }

  function activeModifierAppointment(excludeAppointmentId?: string) {
    return (
      appointments.find(
        (appointment) =>
          appointment.id !== excludeAppointmentId &&
          currentAppointmentModifier(appointment.id)
      ) ?? null
    );
  }

	  function hasUnsavedAppointmentModifierChanges(
	    appointment: Appointment,
	    modifier: AppointmentModifier | null
	  ) {
    return appointmentModifierHasUnsavedChanges({
      appointmentDraft: appointmentDrafts[appointment.id] ?? emptyAppointmentDraft,
      contextualTextIntakeValue,
      existingNote: notesByAppointment.get(appointment.id),
      modifier,
      noteDraft: noteDrafts[appointment.id] ?? emptyNoteDraft,
      savedAppointmentDetails: {
        ...appointment,
        startsAt: toDatetimeLocalValue(appointment.starts_at),
      },
      textIntakeDraft,
    });
  }

  function discardAppointmentModifier(
    appointmentId: string,
    modifier: AppointmentModifier | null
  ) {
    if (modifier === "add") {
      cancelEditingNote(appointmentId);
    }

    if (modifier === "import") {
      cancelTextIntake();
    }

    if (modifier === "edit") {
      cancelEditingAppointment(appointmentId);
    }
  }

  function openAppointmentModifier(
    appointment: Appointment,
    modifier: AppointmentModifier
  ) {
    if (modifier === "add") {
      startTypingNote(appointment.id);
      return;
    }

    if (modifier === "import") {
      startContextualTextIntake(appointment);
      return;
    }

    startEditingAppointment(appointment);
  }

  function requestAppointmentModifier(
    appointment: Appointment,
    target: AppointmentModifier
  ) {
    const currentModifier = currentAppointmentModifier(appointment.id);
    const otherModifierAppointment = activeModifierAppointment(appointment.id);
    const otherModifier = otherModifierAppointment
      ? currentAppointmentModifier(otherModifierAppointment.id)
      : null;

    if (
      otherModifierAppointment &&
      otherModifier &&
      hasUnsavedAppointmentModifierChanges(
        otherModifierAppointment,
        otherModifier
      )
    ) {
      setPendingModifierSwitch({
        appointmentId: otherModifierAppointment.id,
        target,
        targetAppointmentId: appointment.id,
      });
      return;
    }

    if (otherModifierAppointment && otherModifier) {
      discardAppointmentModifier(otherModifierAppointment.id, otherModifier);
    }

    if (currentModifier === target) {
      if (hasUnsavedAppointmentModifierChanges(appointment, currentModifier)) {
        setPendingModifierSwitch({
          appointmentId: appointment.id,
          target: null,
        });
        return;
      }

      discardAppointmentModifier(appointment.id, currentModifier);
      setPendingModifierSwitch(null);
      return;
    }

    if (
      currentModifier &&
      hasUnsavedAppointmentModifierChanges(appointment, currentModifier)
    ) {
      setPendingModifierSwitch({
        appointmentId: appointment.id,
        target,
      });
      return;
    }

    discardAppointmentModifier(appointment.id, currentModifier);
    setPendingModifierSwitch(null);
    openAppointmentModifier(appointment, target);
  }

	  function requestCloseTextIntake(appointment: Appointment) {
	    if (hasUnsavedAppointmentModifierChanges(appointment, "import")) {
	      setPendingModifierSwitch({
        appointmentId: appointment.id,
        target: null,
      });
      return;
    }

	    cancelTextIntake();
	  }

  function requestCloseNoteEditing(appointment: Appointment) {
    if (hasUnsavedAppointmentModifierChanges(appointment, "add")) {
      setPendingModifierSwitch({
        appointmentId: appointment.id,
        target: null,
	      });
	      return;
	    }

    cancelEditingNote(appointment.id);
  }

  function discardAndApplyTextIntakePanelAction() {
    const action = pendingTextIntakePanelAction;
    const pendingView = pendingAppointmentPanelView;

    cancelTextIntake();
    setPendingAppointmentPanelView(null);

    if (pendingView) {
      setActiveAppointmentPanel(null);
      applyAppointmentViewChange(pendingView);
      return;
    }

    if (action === "close" || !action) {
      setActiveAppointmentPanel(null);
      return;
    }

    resetPlaceLookup();
    setActiveAppointmentPanel(action);
  }

  function discardAndSwitchAppointmentModifier(appointment: Appointment) {
    if (!pendingModifierSwitch) {
      return;
    }

    const currentModifier = currentAppointmentModifier(appointment.id);
    const targetAppointment =
      pendingModifierSwitch.targetAppointmentId &&
      pendingModifierSwitch.targetAppointmentId !== appointment.id
        ? appointments.find(
            (candidate) =>
              candidate.id === pendingModifierSwitch.targetAppointmentId
          ) ?? appointment
        : appointment;

    discardAppointmentModifier(appointment.id, currentModifier);
    if (pendingModifierSwitch.target === "careprep") {
      openCarePrepPanel(targetAppointment);
    } else if (pendingModifierSwitch.target) {
      openAppointmentModifier(targetAppointment, pendingModifierSwitch.target);
    }
    setPendingModifierSwitch(null);
  }

  function collapseCarePrepPanels() {
    setExpandedCarePrepIds({});
    saveAppointmentsViewState({
      expandedCarePrepIds: {},
    });
  }

  function setMessagesExpandedForAppointment(
    appointmentId: string,
    expanded: boolean
  ) {
    const nextAppointmentId = expanded ? appointmentId : null;

    setExpandedMessagesAppointmentId(nextAppointmentId);
    if (!expanded) {
      setActiveMessageComposerAppointmentId((currentAppointmentId) =>
        currentAppointmentId === appointmentId ? null : currentAppointmentId
      );
    }
    saveAppointmentsViewState({
      expandedMessagesAppointmentId: nextAppointmentId,
    });
  }

  function openAppointmentMessageComposer(appointment: Appointment) {
    setActiveMessageComposerAppointmentId((currentAppointmentId) =>
      currentAppointmentId === appointment.id ? null : appointment.id
    );
    setMessagesExpandedForAppointment(appointment.id, true);
  }

  function setCarePrepExpandedForAppointment(
    appointmentId: string,
    expanded: boolean
  ) {
    setExpandedCarePrepIds((currentIds) => {
      const nextIds = expanded
        ? { [appointmentId]: true }
        : {
            ...currentIds,
            [appointmentId]: false,
          };
      saveAppointmentsViewState({
        expandedCarePrepIds: nextIds,
      });
      return nextIds;
    });
  }

  function appointmentHasWhatToKnowAvailable(appointmentId: string) {
    const prep = guidanceByAppointment.get(appointmentId);
    const draft = draftGuidanceByAppointment.get(appointmentId);
    const whatToKnow = buildWhatToKnowDisplayModel({
      carePrep: {
        bring_list: asTextList(prep?.bring_list),
        key_questions: asTextList(prep?.key_questions),
        med_review: asTextList(prep?.med_review),
        next_steps: asTextList(prep?.next_steps),
        since_last_visit: asTextList(prep?.since_last_visit),
        watchouts: asTextList(prep?.watchouts),
      },
      communicationItems: communicationItemsByAppointment.get(appointmentId) ?? [],
    });

    return Boolean(prep?.summary || draft?.summary || whatToKnow.hasItems);
  }

  function openCarePrepPanel(appointment: Appointment) {
    if (appointmentHasWhatToKnowAvailable(appointment.id)) {
      setCarePrepExpandedForAppointment(appointment.id, true);
      return;
    }

    handleGenerateCarePrep(appointment);
  }

  function requestCarePrepPanel(appointment: Appointment) {
    if (expandedCarePrepIds[appointment.id]) {
      setCarePrepExpandedForAppointment(appointment.id, false);
      setMessagesExpandedForAppointment(appointment.id, false);
      return;
    }

    const modifierAppointment =
      activeModifierAppointment() ??
      (currentAppointmentModifier(appointment.id) ? appointment : null);
    const currentModifier = modifierAppointment
      ? currentAppointmentModifier(modifierAppointment.id)
      : null;

    if (
      modifierAppointment &&
      currentModifier &&
      hasUnsavedAppointmentModifierChanges(modifierAppointment, currentModifier)
    ) {
      setPendingModifierSwitch({
        appointmentId: modifierAppointment.id,
        target: "careprep",
        targetAppointmentId: appointment.id,
      });
      return;
    }

    if (modifierAppointment) {
      discardAppointmentModifier(modifierAppointment.id, currentModifier);
    }
    setPendingModifierSwitch(null);
    openCarePrepPanel(appointment);
  }

  function startContextualTextIntake(appointment: Appointment) {
    setPendingModifierSwitch(null);
    collapseCarePrepPanels();
    setEditingNoteIds((currentIds) => ({
      ...currentIds,
      [appointment.id]: false,
    }));
    setEditingAppointmentIds((currentIds) => ({
      ...currentIds,
      [appointment.id]: false,
    }));
    setTextIntakeTargetAppointmentId(appointment.id);
    setContextualTextIntakeValue("");
    setTextIntakeValue("");
    setTextIntakeDraft(null);
    setTextIntakeAiDraft(null);
    setTextIntakeItemId(null);
    setTextIntakeMatches([]);
    setBulkAppointmentDrafts([]);
    setBulkAppointmentSummary("");
    setSelectedTextIntakeMatchId(appointment.id);
    setTextIntakeSubjectId(appointment.care_subject_id ?? "");
    setApplyTextIntakeAppointmentDetails(false);
    resetImportAnythingReview();
    setMessage("");
  }

  function startTypingNote(appointmentId: string) {
    setPendingModifierSwitch(null);
    cancelTextIntake();
    setEditingAppointmentIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: false,
    }));
    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: emptyNoteDraft,
    }));
    setEditingNoteIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: true,
    }));
  }

  function cancelTextIntake() {
    setPendingTextIntakePanelAction(null);
    setPendingModifierSwitch(null);
    setTextIntakeValue("");
    setTextIntakeDraft(null);
    setTextIntakeAiDraft(null);
    setTextIntakeItemId(null);
    setTextIntakeMatches([]);
    setBulkAppointmentDrafts([]);
    setBulkAppointmentSummary("");
    setSelectedTextIntakeMatchId("new");
    setTextIntakeTargetAppointmentId(null);
    setImportAnythingOwnerPersonId("");
    setContextualTextIntakeValue("");
    setApplyTextIntakeAppointmentDetails(false);
    setFileImportStatus("");
    resetImportAnythingReview();
  }

  async function findTextIntakeMatches(
    draft: IntakeReviewDraftContent,
    careCircleId: string,
    careSubjectId: string
  ): Promise<TextIntakeMatch[]> {
    const { data: appointmentRows, error: appointmentError } = await supabase
      .from("appointments")
      .select(
            "id,care_subject_id,current_note_id,title,reason,starts_at,status,archived_at,deleted_at,provider_name,provider_organization,location_name,location_address,location_phone"
      )
      .eq("care_circle_id", careCircleId)
      .eq("care_subject_id", careSubjectId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(80);

    if (appointmentError) {
      throw appointmentError;
    }

    const candidates = appointmentRows ?? [];
    const noteIds = candidates
      .map((appointment) => appointment.current_note_id)
      .filter(Boolean) as string[];
    let noteMap = new Map<string, AppointmentNote>();

    if (noteIds.length > 0) {
      const { data: noteRows, error: notesError } = await supabase
        .from("appointment_notes")
        .select(
          "id,appointment_id,summary_short,takeaways,followups,is_current,version_number,superseded_at,superseded_by_note_id"
        )
        .in("id", noteIds);

      if (notesError) {
        throw notesError;
      }

      noteMap = new Map((noteRows ?? []).map((note) => [note.id, note]));
    }

    const draftText = [
      draft.appointmentTitle,
      draft.appointmentReason,
      draft.notesSummary,
      draft.takeaways,
      draft.followups,
    ].join(" ");
    const draftTokens = textTokens(draftText);

    return candidates
      .map((appointment) => {
        const appointmentText = [
          appointment.title ?? "",
          appointment.reason ?? "",
        ].join(" ");
        const appointmentTokens = textTokens(appointmentText);
        const genericTextMatches = sharedTokenCount(
          draftTokens,
          appointmentTokens
        );
        const daysApart = dayDifference(appointment.starts_at, draft.startsAt);
        const providerMatches = fieldTokenOverlap(
          draft.providerName,
          appointment.provider_name
        );
        const practiceMatches = fieldTokenOverlap(
          draft.providerOrganization,
          appointment.provider_organization
        );
        const locationNameMatches = fieldTokenOverlap(
          draft.locationName,
          appointment.location_name
        );
        const addressMatches = fieldTokenOverlap(
          draft.locationAddress,
          appointment.location_address
        );
        const titleReasonMatches = sharedTokenCount(
          textTokens(`${draft.appointmentTitle} ${draft.appointmentReason}`),
          appointmentTokens
        );
        const sameDate = daysApart === 0;
        const nearDate = daysApart !== null && daysApart <= 7;
        const hardSignalCount = [
          sameDate,
          providerMatches >= 2,
          practiceMatches >= 1,
          locationNameMatches >= 2,
          addressMatches >= 2,
        ].filter(Boolean).length;
        const reasons: string[] = [];
        let score = 0;

        if (daysApart !== null) {
          if (sameDate) {
            score += 10;
            reasons.push("same date");
          } else if (nearDate) {
            score += 4;
            reasons.push(`within ${daysApart} day${daysApart === 1 ? "" : "s"}`);
          } else if (daysApart <= 30) {
            score += 1;
            reasons.push("nearby date");
          }
        }

        if (providerMatches >= 2) {
          score += 8;
          reasons.push("provider match");
        }

        if (practiceMatches >= 1) {
          score += 5;
          reasons.push("practice match");
        }

        if (locationNameMatches >= 2) {
          score += 5;
          reasons.push("location match");
        }

        if (addressMatches >= 2) {
          score += 7;
          reasons.push("address match");
        }

        if (titleReasonMatches >= 2) {
          score += Math.min(titleReasonMatches, 4);
          reasons.push("title/reason match");
        }

        if (genericTextMatches >= 4) {
          score += 1;
          reasons.push("supporting text overlap");
        }

        if (!appointment.current_note_id) {
          score += 1;
          reasons.push("no notes yet");
        }

        if (appointment.status === "archived") {
          score -= 1;
          reasons.push("archived");
        }

        const hasGuardrailSignal =
          sameDate ||
          hardSignalCount >= 1 ||
          (nearDate && titleReasonMatches >= 2) ||
          titleReasonMatches >= 4;

        return {
          appointment,
          currentNote: appointment.current_note_id
            ? noteMap.get(appointment.current_note_id) ?? null
            : null,
          reasons,
          score: hasGuardrailSignal ? score : 0,
        };
      })
      .filter((match) => match.score >= 6 && match.reasons.length > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3);
  }

  async function handleSaveTextIntakeDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!textIntakeDraft) {
      return;
    }

    setSavingTextIntake(true);
    setMessage("");

    try {
      if (!textIntakeDraft.appointmentTitle.trim()) {
        throw new Error("Please enter an appointment title.");
      }

      const { careCircleId, careSubjectId, userId } =
        await getPrimaryCareContext(textIntakeSubjectId);

      if (!careSubjectId) {
        throw new Error("Please choose who this appointment is for.");
      }

      const startsAtDate = textIntakeDraft.startsAt
        ? new Date(textIntakeDraft.startsAt)
        : null;

      if (startsAtDate && Number.isNaN(startsAtDate.getTime())) {
        throw new Error("Check the intake appointment date and time.");
      }

      const startsAt = startsAtDate ? startsAtDate.toISOString() : null;
      const takeaways = linesToList(textIntakeDraft.takeaways);
      const followups = linesToList(textIntakeDraft.followups);
      const aiTakeaways = textIntakeAiDraft
        ? linesToList(textIntakeAiDraft.takeaways)
        : [];
      const aiFollowups = textIntakeAiDraft
        ? linesToList(textIntakeAiDraft.followups)
        : [];
      const acceptedInterpretation = {
        appointment_reason: textIntakeDraft.appointmentReason,
        appointment_title: textIntakeDraft.appointmentTitle,
        confidence: textIntakeDraft.confidence,
        followups,
        location_address: textIntakeDraft.locationAddress,
        location_name: textIntakeDraft.locationName,
        location_phone: textIntakeDraft.locationPhone,
        notes_summary: textIntakeDraft.notesSummary,
        provider_name: textIntakeDraft.providerName,
        provider_organization: textIntakeDraft.providerOrganization,
        starts_at_local: textIntakeDraft.startsAt,
        suggested_action: textIntakeDraft.suggestedAction,
        takeaways,
      };
      const hasNotes =
        Boolean(textIntakeDraft.notesSummary.trim()) ||
        takeaways.length > 0 ||
        followups.length > 0;
      const isStandaloneFutureAppointment =
        !textIntakeTargetAppointmentId &&
        Boolean(startsAtDate) &&
        isTodayOrFutureDate(textIntakeDraft.startsAt);
      const shouldSaveNotes = hasNotes && !isStandaloneFutureAppointment;
      const hasAiNoteDraft = Boolean(
        textIntakeAiDraft &&
          shouldSaveNotes &&
          (textIntakeAiDraft.notesSummary.trim() ||
            aiTakeaways.length > 0 ||
            aiFollowups.length > 0)
      );
      const targetAppointment = textIntakeTargetAppointmentId
        ? (appointments.find(
            (appointment) => appointment.id === textIntakeTargetAppointmentId
          ) ??
          (notesReminderAppointment?.id === textIntakeTargetAppointmentId
            ? notesReminderAppointment
            : null))
        : null;
      const selectedMatch =
        targetAppointment
          ? {
              appointment: targetAppointment,
              currentNote: notesByAppointment.get(targetAppointment.id) ?? null,
              reasons: ["selected appointment"],
              score: 100,
            }
          : selectedTextIntakeMatchId === "new"
            ? null
            : textIntakeMatches.find(
              (match) => match.appointment.id === selectedTextIntakeMatchId
              ) ?? null;

      if (selectedMatch && !shouldSaveNotes) {
        throw new Error("Add notes before updating an existing appointment.");
      }

      const detailChanges =
        targetAppointment && applyTextIntakeAppointmentDetails
          ? appointmentDetailChanges(targetAppointment, textIntakeDraft)
          : [];
      let appointmentId = selectedMatch?.appointment.id ?? "";

      if (!appointmentId) {
        const { data: appointment, error: appointmentError } = await supabase
          .from("appointments")
          .insert({
            care_circle_id: careCircleId,
            care_subject_id: careSubjectId,
            location_address: textIntakeDraft.locationAddress.trim() || null,
            location_name: textIntakeDraft.locationName.trim() || null,
            location_phone: textIntakeDraft.locationPhone.trim() || null,
            owner_user_id: userId,
            provider_name: textIntakeDraft.providerName.trim() || null,
            provider_organization:
              textIntakeDraft.providerOrganization.trim() || null,
            reason: textIntakeDraft.appointmentReason.trim() || null,
            source: "manual",
            starts_at: startsAt,
            status: "scheduled",
            title: textIntakeDraft.appointmentTitle.trim(),
          })
          .select("id")
          .single();

        if (appointmentError) {
          throw appointmentError;
        }

        appointmentId = appointment.id;
      }

      if (shouldSaveNotes) {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error("Please sign in before saving Visit Notes.");
        }

        const noteInputText = (
          targetAppointment ? contextualTextIntakeValue : textIntakeValue
        ).trim();
        const response = await fetch("/api/appointment-notes", {
          body: JSON.stringify({
            aiDraft:
              textIntakeAiDraft && hasAiNoteDraft
                ? {
                    followups: aiFollowups,
                    inputText: noteInputText,
                    source: "intake_ai_draft",
                    summary: textIntakeAiDraft.notesSummary,
                    takeaways: aiTakeaways,
                  }
                : null,
            appointmentId,
            appointmentUpdates: Object.fromEntries(
              detailChanges.map((change) => [change.field, change.newValue])
            ),
            followups,
            inputText: noteInputText,
            restoreIfArchived: selectedMatch?.appointment.status === "archived",
            source: textIntakeItemId ? "intake_user_accepted" : "manual",
            summary: textIntakeDraft.notesSummary,
            takeaways,
          }),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const result = (await response.json()) as {
          error?: string;
          ok?: boolean;
        };

        if (!response.ok || !result.ok) {
          throw new Error(result.error ?? "Visit Notes could not be saved.");
        }
      }

      if (textIntakeItemId) {
        const { error: intakeUpdateError } = await supabase
          .from("intake_items")
          .update({
            accepted_at: new Date().toISOString(),
            accepted_by_user_id: userId,
            accepted_interpretation: {
              ...acceptedInterpretation,
              appointment_detail_updates: detailChanges.map((change) => ({
                field: change.field,
                from: change.currentValue,
                to: change.newValue,
              })),
            },
            appointment_id: appointmentId,
            interpretation: {
              ...acceptedInterpretation,
              appointment_detail_updates: detailChanges.map((change) => ({
                field: change.field,
                from: change.currentValue,
                to: change.newValue,
              })),
            },
            match_candidates: textIntakeMatches.map((match) => ({
              appointment_id: match.appointment.id,
              reasons: match.reasons,
              score: match.score,
              status: match.appointment.status,
              title: match.appointment.title,
              provider_name: match.appointment.provider_name,
              provider_organization: match.appointment.provider_organization,
            })),
            match_status: selectedMatch
              ? targetAppointment
                ? "targeted_existing"
                : "user_selected_existing"
              : textIntakeMatches.length > 0
                ? "user_created_new_despite_matches"
                : "no_match",
            suggested_appointment_id: textIntakeMatches[0]?.appointment.id ?? null,
            user_match_decision: selectedMatch
              ? targetAppointment
                ? "targeted_attach"
                : "attach_existing"
              : "create_new",
            status: "accepted",
          })
          .eq("id", textIntakeItemId);

        if (intakeUpdateError) {
          throw intakeUpdateError;
        }
      }

      setTextIntakeValue("");
      setTextIntakeDraft(null);
      setTextIntakeAiDraft(null);
      setTextIntakeItemId(null);
      setTextIntakeMatches([]);
      setSelectedTextIntakeMatchId("new");
      setTextIntakeTargetAppointmentId(null);
      setContextualTextIntakeValue("");
      setApplyTextIntakeAppointmentDetails(false);
      setActiveAppointmentPanel(null);
      setAppointmentView(shouldSaveNotes ? "logged" : "upcoming");
      await loadAppointments(shouldSaveNotes ? "logged" : "upcoming");
      if (shouldSaveNotes) {
        void triggerAutoCarePrepAfterNotes({
          careCircleId,
          careSubjectId,
          sourceAppointmentId: appointmentId,
        });
      }
      setMessage("Intake saved.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingTextIntake(false);
    }
  }

  function resetPlaceLookup() {
    setPlaceLookupQuery("");
    setPlaceLookupSuggestions([]);
    setPlaceLookupSessionToken("");
    setSearchingPlaces(false);
    setPlacesStatusMessage("");
    setSelectedGooglePlace(null);
    setAddFavoriteLocation(false);
    setFavoriteLocationNickname("");
  }

  async function placesAuthHeader() {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error("Please sign in before searching locations.");
    }

    return { Authorization: `Bearer ${accessToken}` };
  }

  async function loadFavoriteLocations() {
    setLoadingFavoriteLocations(true);

    try {
      const { careCircleId } = await getPrimaryCareContext(
        newAppointmentSubjectId ||
          (selectedSubjectId !== ALL_SUBJECTS ? selectedSubjectId : "")
      );
      const { data, error } = await supabase
        .from("favorite_locations")
        .select(
          "id,care_circle_id,nickname,place_name,address,phone,google_place_id,google_maps_uri,source,usage_count,last_used_at"
        )
        .eq("care_circle_id", careCircleId)
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      setFavoriteLocations((data ?? []) as FavoriteLocation[]);
    } catch (error) {
      console.error("Could not load favorite locations", error);
    } finally {
      setLoadingFavoriteLocations(false);
    }
  }

  async function searchGooglePlaces(query: string) {
    setSearchingPlaces(true);
    setPlacesStatusMessage("");

    try {
      const sessionToken =
        placeLookupSessionToken ||
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`);

      if (!placeLookupSessionToken) {
        setPlaceLookupSessionToken(sessionToken);
      }

      const response = await fetch("/api/places/autocomplete", {
        body: JSON.stringify({ input: query, sessionToken }),
        headers: {
          ...(await placesAuthHeader()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? placesUnavailableMessage);
      }

      setPlaceLookupSuggestions(
        Array.isArray(result.suggestions) ? result.suggestions : []
      );
    } catch (error) {
      setPlaceLookupSuggestions([]);
      setPlacesStatusMessage(getErrorMessage(error) || placesUnavailableMessage);
    } finally {
      setSearchingPlaces(false);
    }
  }

  function applyFavoriteLocation(location: FavoriteLocation) {
    const label = favoriteLocationLabel(location);

    setNewAppointmentLocationName(label);
    setNewAppointmentLocationAddress(location.address ?? "");
    setNewAppointmentLocationPhone(location.phone ?? "");
    setNewAppointmentProviderOrganization(location.place_name ?? label);
    setPlaceLookupQuery(label);
    setSelectedGooglePlace(null);
    setAddFavoriteLocation(false);
    setFavoriteLocationNickname("");

    void supabase
      .from("favorite_locations")
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: location.usage_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", location.id);
  }

  async function applyGooglePlaceSuggestion(
    suggestion: PlaceAutocompleteSuggestion
  ) {
    setSearchingPlaces(true);
    setPlacesStatusMessage("");

    try {
      const response = await fetch("/api/places/details", {
        body: JSON.stringify({
          placeId: suggestion.placeId,
          sessionToken: placeLookupSessionToken,
        }),
        headers: {
          ...(await placesAuthHeader()),
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? placesUnavailableMessage);
      }

      const place = result.place as PlaceDetailsResult;
      const placeName = place.placeName || suggestion.text;

      setSelectedGooglePlace(place);
      setNewAppointmentProviderOrganization(placeName);
      setNewAppointmentLocationName(placeName);
      setNewAppointmentLocationAddress(place.formattedAddress);
      setNewAppointmentLocationPhone(place.nationalPhoneNumber);
      setPlaceLookupQuery(placeName);
      setPlaceLookupSuggestions([]);
      setAddFavoriteLocation(false);
      setFavoriteLocationNickname(placeName);
    } catch (error) {
      setPlacesStatusMessage(getErrorMessage(error) || placesUnavailableMessage);
    } finally {
      setSearchingPlaces(false);
    }
  }

  async function saveFavoriteLocationIfNeeded({
    careCircleId,
    userId,
  }: {
    careCircleId: string;
    userId: string;
  }) {
    if (!addFavoriteLocation) {
      return;
    }

    const nickname =
      favoriteLocationNickname.trim() ||
      newAppointmentLocationName.trim() ||
      newAppointmentProviderOrganization.trim();

    if (!nickname) {
      return;
    }

    const { error } = await supabase.from("favorite_locations").insert({
      address: newAppointmentLocationAddress.trim() || null,
      care_circle_id: careCircleId,
      created_by_user_id: userId,
      google_maps_uri: selectedGooglePlace?.googleMapsUri || null,
      google_place_id: selectedGooglePlace?.placeId || null,
      last_used_at: new Date().toISOString(),
      nickname,
      phone: newAppointmentLocationPhone.trim() || null,
      place_name:
        selectedGooglePlace?.placeName ||
        newAppointmentProviderOrganization.trim() ||
        null,
      source: selectedGooglePlace ? "google_places" : "manual",
      usage_count: 1,
    });

    if (error) {
      throw error;
    }
  }

  async function handleCreateAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingAppointment(true);
    setMessage("");

    try {
      if (!newAppointmentTitle.trim()) {
        throw new Error("Please enter an appointment title.");
      }

      if (!newAppointmentTargetSubjectId) {
        throw new Error("Please choose who this appointment is for.");
      }

      if (!newAppointmentStartsAt.trim()) {
        throw new Error("Please enter a date and time.");
      }

      if (!newAppointmentLocationAddress.trim()) {
        throw new Error("Please enter a location.");
      }

      if (!newAppointmentProviderName.trim()) {
        throw new Error("Please enter a provider.");
      }

      if (!newAppointmentReason.trim()) {
        throw new Error("Please enter a reason.");
      }

      const { careCircleId, careSubjectId, userId } =
        await getPrimaryCareContext(newAppointmentTargetSubjectId);

      if (!careSubjectId) {
        throw new Error("Please choose who this appointment is for.");
      }

      const startsAt = newAppointmentStartsAt
        ? new Date(newAppointmentStartsAt).toISOString()
        : null;
      const favoriteNickname =
        addFavoriteLocation && favoriteLocationNickname.trim()
          ? favoriteLocationNickname.trim()
          : "";
      const locationNameForSave =
        favoriteNickname || newAppointmentLocationName.trim() || null;

      const { error } = await supabase.from("appointments").insert({
        care_circle_id: careCircleId,
        care_subject_id: careSubjectId,
        location_address: newAppointmentLocationAddress.trim() || null,
        location_name: locationNameForSave,
        location_phone: newAppointmentLocationPhone.trim() || null,
        owner_user_id: userId,
        provider_name: newAppointmentProviderName.trim() || null,
        provider_organization:
          newAppointmentProviderOrganization.trim() || null,
        title: newAppointmentTitle.trim(),
        reason: newAppointmentReason.trim() || null,
        starts_at: startsAt,
        status: "scheduled",
        source: "manual",
      });

      if (error) {
        throw error;
      }

      await saveFavoriteLocationIfNeeded({ careCircleId, userId });

      setNewAppointmentDraft({ ...emptyAppointmentDraft });
      setNewAppointmentSubjectId(careSubjectId);
      resetPlaceLookup();
      setActiveAppointmentPanel(null);
      await loadAppointments();
      setMessage("Appointment added.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setCreatingAppointment(false);
    }
  }

  function startEditingAppointment(appointment: Appointment) {
    setPendingModifierSwitch(null);
    cancelTextIntake();
    setEditingNoteIds((currentIds) => ({
      ...currentIds,
      [appointment.id]: false,
    }));
    setAppointmentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointment.id]: {
        locationAddress: appointment.location_address ?? "",
        locationName: appointment.location_name ?? "",
        locationPhone: appointment.location_phone ?? "",
        providerName: appointment.provider_name ?? "",
        providerOrganization: appointment.provider_organization ?? "",
        reason: appointment.reason ?? "",
        startsAt: toDatetimeLocalValue(appointment.starts_at),
        status: appointment.status,
        title: appointment.title ?? "",
      },
    }));
    setEditingAppointmentIds((currentIds) => ({
      ...currentIds,
      [appointment.id]: true,
    }));
  }

  function cancelEditingAppointment(appointmentId: string) {
    setPendingModifierSwitch(null);
    setEditingAppointmentIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: false,
    }));
    setAppointmentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: emptyAppointmentDraft,
    }));
  }

  function updateAppointmentDraft(
    appointmentId: string,
    field: keyof typeof emptyAppointmentDraft,
    value: string
  ) {
    setAppointmentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: {
        ...emptyAppointmentDraft,
        ...currentDrafts[appointmentId],
        [field]: value,
      },
    }));
  }

  async function handleSaveAppointment(
    event: FormEvent<HTMLFormElement>,
    appointment: Appointment
  ) {
    event.preventDefault();
    setSavingAppointmentForId(appointment.id);
    setMessage("");

    try {
      const draft = appointmentDrafts[appointment.id] ?? emptyAppointmentDraft;

      if (!draft.title.trim()) {
        throw new Error("Please enter an appointment title.");
      }

      const startsAt = draft.startsAt
        ? new Date(draft.startsAt).toISOString()
        : null;

      const { error } = await supabase
        .from("appointments")
        .update({
          reason: draft.reason.trim() || null,
          location_address: draft.locationAddress.trim() || null,
          location_name: draft.locationName.trim() || null,
          location_phone: draft.locationPhone.trim() || null,
          provider_name: draft.providerName.trim() || null,
          provider_organization: draft.providerOrganization.trim() || null,
          starts_at: startsAt,
          status: draft.status,
          title: draft.title.trim(),
        })
        .eq("id", appointment.id);

      if (error) {
        throw error;
      }

      setAppointmentDrafts((currentDrafts) => ({
        ...currentDrafts,
        [appointment.id]: emptyAppointmentDraft,
      }));
      setEditingAppointmentIds((currentIds) => ({
        ...currentIds,
        [appointment.id]: false,
      }));
      await loadAppointments();
      setMessage("Appointment updated.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingAppointmentForId(null);
    }
  }

  async function handleArchiveAppointment(appointment: Appointment) {
    setArchivingAppointmentForId(appointment.id);
    setOpenAppointmentMenuId(null);
    setMessage("");

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          archived_at: new Date().toISOString(),
          status: "archived",
        })
        .eq("id", appointment.id);

      if (error) {
        throw error;
      }

      setEditingAppointmentIds((currentIds) => ({
        ...currentIds,
        [appointment.id]: false,
      }));
      setEditingNoteIds((currentIds) => ({
        ...currentIds,
        [appointment.id]: false,
      }));
      await loadAppointments();
      showToast("Appointment archived.", {
        durationMs: 8000,
        type: "success",
      });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setArchivingAppointmentForId(null);
    }
  }

  async function handleDeleteAppointment(appointment: Appointment) {
    setDeletingAppointmentForId(appointment.id);
    setOpenAppointmentMenuId(null);
    setMessage("");

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq("id", appointment.id);

      if (error) {
        throw error;
      }

      discardAppointmentModifier(
        appointment.id,
        currentAppointmentModifier(appointment.id)
      );
      setPendingDeleteAppointmentId(null);
      if (locationSheetAppointmentId === appointment.id) {
        setLocationSheetAppointmentId(null);
      }
      await loadAppointments();
      showToast("Appointment deleted.", {
        durationMs: 8000,
        type: "success",
      });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setDeletingAppointmentForId(null);
    }
  }

  async function restoreAppointment(appointmentId: string) {
    setRestoringAppointmentForId(appointmentId);
    setMessage("");

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          archived_at: null,
          status: "scheduled",
        })
        .eq("id", appointmentId);

      if (error) {
        throw error;
      }

      await loadAppointments();
      setMessage("Appointment restored.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setRestoringAppointmentForId(null);
    }
  }

  async function requestCarePrepGeneration(
    appointmentId: string,
    generationMode: CarePrepGenerationMode
  ) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      throw new Error("Please sign in before generating CarePrep.");
    }

    const response = await fetch("/api/careprep", {
      body: JSON.stringify({ appointmentId, generationMode }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "CarePrep generation failed.");
    }

    return result as {
      alreadyUpToDate?: boolean;
      appointmentId?: string;
      generationMode?: CarePrepGenerationMode;
      guidanceId?: string;
      message?: string;
    };
  }

  async function requestAppointmentMessagePrepRebuild({
    accessToken,
    appointmentId,
    personId,
  }: {
    accessToken: string;
    appointmentId: string;
    personId: string;
  }) {
    const response = await fetch("/api/personal/appointments/messageprep/rebuild", {
      body: JSON.stringify({
        appointmentId,
        personId,
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      ok?: boolean;
      summary?: AppointmentCommunicationSummaryRow | null;
    };

    if (!response.ok || !result.ok) {
      throw new Error(result.error ?? "MessagePrep refresh failed.");
    }

    return result.summary ?? null;
  }

  async function triggerAutoCarePrepAfterNotes({
    careCircleId,
    careSubjectId,
    sourceAppointmentId,
  }: {
    careCircleId: string;
    careSubjectId: string | null;
    sourceAppointmentId: string;
  }) {
    if (!careSubjectId) {
      return;
    }

    try {
      const { data: sourceAppointment, error: sourceAppointmentError } =
        await supabase
          .from("appointments")
          .select(
            "id,care_subject_id,current_note_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone,is_sample_data,deleted_at"
          )
          .eq("id", sourceAppointmentId)
          .single();

      if (sourceAppointmentError) {
        throw sourceAppointmentError;
      }

      const { data: futureAppointments, error: futureAppointmentsError } =
        await supabase
          .from("appointments")
          .select(
            "id,care_subject_id,current_note_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone,is_sample_data,deleted_at"
          )
          .eq("care_circle_id", careCircleId)
          .eq("care_subject_id", careSubjectId)
          .neq("id", sourceAppointmentId)
          .neq("status", "archived")
          .is("current_note_id", null)
          .is("deleted_at", null);

      if (futureAppointmentsError) {
        throw futureAppointmentsError;
      }

      const todayStart = startOfToday();
      const datedFutureAppointments = ((futureAppointments ?? []) as Appointment[])
        .filter(
          (appointment) =>
            !appointment.starts_at ||
            new Date(appointment.starts_at).getTime() >= todayStart.getTime()
        );
      const textTokens = (value: string | null | undefined) =>
        new Set(
          String(value ?? "")
            .toLowerCase()
            .replace(/sample:/g, "")
            .split(/[^a-z0-9]+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 4)
        );
      const sourceTokens = textTokens(
        [sourceAppointment.title, sourceAppointment.reason]
          .filter(Boolean)
          .join(" ")
      );
      const overlapCount = (appointment: Appointment) => {
        const appointmentTokens = textTokens(
          [appointment.title, appointment.reason].filter(Boolean).join(" ")
        );
        return Array.from(appointmentTokens).filter((token) =>
          sourceTokens.has(token)
        ).length;
      };
      const normalized = (value: string | null | undefined) =>
        String(value ?? "").trim().toLowerCase();
      const contextualScore = (appointment: Appointment) => {
        let score = overlapCount(appointment);

        if (
          normalized(sourceAppointment.provider_organization) &&
          normalized(sourceAppointment.provider_organization) ===
            normalized(appointment.provider_organization)
        ) {
          score += 4;
        }

        if (
          normalized(sourceAppointment.location_name) &&
          normalized(sourceAppointment.location_name) ===
            normalized(appointment.location_name)
        ) {
          score += 3;
        }

        if (
          normalized(sourceAppointment.provider_name) &&
          normalized(sourceAppointment.provider_name) ===
            normalized(appointment.provider_name)
        ) {
          score += 2;
        }

        return score;
      };
      const byDate = (firstAppointment: Appointment, secondAppointment: Appointment) => {
          if (!firstAppointment.starts_at && !secondAppointment.starts_at) {
            return 0;
          }

          if (!firstAppointment.starts_at) {
            return 1;
          }

          if (!secondAppointment.starts_at) {
            return -1;
          }

          return (
            new Date(firstAppointment.starts_at).getTime() -
            new Date(secondAppointment.starts_at).getTime()
          );
        };
      const contextualAppointment = datedFutureAppointments
        .map((appointment) => ({
          appointment,
          score: contextualScore(appointment),
        }))
        .filter(({ score }) => score > 0)
        .sort((first, second) => {
          if (second.score !== first.score) {
            return second.score - first.score;
          }

          return byDate(first.appointment, second.appointment);
        })[0]?.appointment;
      const nextAppointment =
        contextualAppointment ?? datedFutureAppointments.sort(byDate)[0];

      if (!nextAppointment) {
        return;
      }

      setGeneratingCarePrepForId(nextAppointment.id);
      setCarePrepGenerationErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors[nextAppointment.id];
        return nextErrors;
      });

      await requestCarePrepGeneration(
        nextAppointment.id,
        "auto_after_notes"
      );

      const { data: generatedGuidanceRows, error: generatedGuidanceError } =
        await supabase
          .from("careprep_guidance")
          .select("id,review_status,is_current")
          .eq("appointment_id", nextAppointment.id)
          .or("is_current.eq.true,review_status.eq.draft")
          .order("generated_at", { ascending: false })
          .limit(1);

      if (generatedGuidanceError) {
        throw generatedGuidanceError;
      }

      if (!generatedGuidanceRows || generatedGuidanceRows.length === 0) {
        throw new Error(
          `CarePrep finished, but no draft was found for ${
            nextAppointment.title || "the target appointment"
          }.`
        );
      }

      setAppointmentView("upcoming");
      await loadAppointments("upcoming");
      setCarePrepExpandedForAppointment(nextAppointment.id, true);
      setCarePrepGenerationErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors[nextAppointment.id];
        return nextErrors;
      });
      setMessage("");
      setAutoCarePrepStatus({
        appointmentId: nextAppointment.id,
        id: Date.now(),
        message: autoCarePrepSuccessText(nextAppointment),
      });
    } catch (error) {
      console.warn("Automatic CarePrep after notes did not run.", error);
    } finally {
      setGeneratingCarePrepForId(null);
    }
  }

  async function handleGenerateCarePrep(appointment: Appointment) {
    setGeneratingCarePrepForId(appointment.id);
    setCarePrepGenerationErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[appointment.id];
      return nextErrors;
    });
    setMessage("");

    try {
      if (!appointment.care_subject_id) {
        throw new Error("This appointment needs a Care VIP before CarePrep can run.");
      }

      const result = await requestCarePrepGeneration(appointment.id, "manual");

      await loadAppointments();
      setCarePrepExpandedForAppointment(appointment.id, true);
      setCarePrepGenerationErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors[appointment.id];
        return nextErrors;
      });
      setMessage(result.message ?? "CarePrep generated with AI.");
    } catch (error) {
      const message = getErrorMessage(error);
      setCarePrepGenerationErrors((currentErrors) => ({
        ...currentErrors,
        [appointment.id]: message,
      }));
      setMessage(message);
    } finally {
      setGeneratingCarePrepForId(null);
    }
  }

  function canRefreshCarePrepForAppointment(appointment: Appointment) {
    const isFutureOrUndated =
      !appointment.starts_at ||
      new Date(appointment.starts_at) >= startOfToday();

    return (
      appointment.status !== "archived" &&
      !appointment.current_note_id &&
      isFutureOrUndated
    );
  }

  async function handleRefreshWhatToKnow(appointment: Appointment) {
    setGeneratingCarePrepForId(appointment.id);
    setCarePrepGenerationErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[appointment.id];
      return nextErrors;
    });
    setMessage("");

    try {
      if (!appointment.care_subject_id) {
        throw new Error("This appointment needs a Care VIP before What to Know can refresh.");
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before refreshing What to Know.");
      }

      let refreshError = "";
      let messagePrepSummary: AppointmentCommunicationSummaryRow | null = null;

      if (canRefreshCarePrepForAppointment(appointment)) {
        try {
          await requestCarePrepGeneration(appointment.id, "manual");
        } catch (error) {
          refreshError = getErrorMessage(error);
        }
      }

      try {
        messagePrepSummary = await requestAppointmentMessagePrepRebuild({
          accessToken,
          appointmentId: appointment.id,
          personId: appointment.care_subject_id,
        });
      } catch (error) {
        const messagePrepError = getErrorMessage(error);
        refreshError = refreshError
          ? `${refreshError} ${messagePrepError}`
          : messagePrepError;
      }

      if (messagePrepSummary) {
        setAppointmentCommunicationSummaries((currentSummaries) => {
          const others = currentSummaries.filter(
            (summary) => summary.appointment_id !== messagePrepSummary?.appointment_id
          );
          return [...others, messagePrepSummary as AppointmentCommunicationSummaryRow];
        });
      }

      await loadHomeMessages();
      await loadAppointments();
      await hydrateAppointmentDetails([appointment]);
      setCarePrepExpandedForAppointment(appointment.id, true);

      if (refreshError) {
        setCarePrepGenerationErrors((currentErrors) => ({
          ...currentErrors,
          [appointment.id]: refreshError,
        }));
        setMessage(refreshError);
        return;
      }

      setCarePrepGenerationErrors((currentErrors) => {
        const nextErrors = { ...currentErrors };
        delete nextErrors[appointment.id];
        return nextErrors;
      });
      setMessage("What to Know refreshed.");
    } catch (error) {
      const message = getErrorMessage(error);
      setCarePrepGenerationErrors((currentErrors) => ({
        ...currentErrors,
        [appointment.id]: message,
      }));
      setMessage(message);
    } finally {
      setGeneratingCarePrepForId(null);
    }
  }

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !signedInEmail ||
      !sessionProfileLoaded ||
      mainTab !== "home" ||
      showWelcomeGuide ||
      !appointmentDetailsHydrated ||
      !homeNextAppointment ||
      homeNextGuidance ||
      generatingCarePrepForId
    ) {
      return;
    }

    if (
      !homeNextAppointment.care_subject_id ||
      !isEligibleForHomeAutoCarePrep(homeNextAppointment)
    ) {
      return;
    }

    const appointmentId = homeNextAppointment.id;
    const storageKey = homeAutoCarePrepAttemptStorageKey(appointmentId);

    if (
      homeAutoCarePrepInFlightRef.current.has(appointmentId) ||
      window.sessionStorage.getItem(storageKey)
    ) {
      return;
    }

    homeAutoCarePrepInFlightRef.current.add(appointmentId);

    try {
      window.sessionStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // Continue without storage if the browser blocks session storage.
    }

    setGeneratingCarePrepForId(appointmentId);
    setCarePrepGenerationErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[appointmentId];
      return nextErrors;
    });

    void (async () => {
      try {
        await requestCarePrepGeneration(appointmentId, "auto_home");
        await loadAppointments();
        setCarePrepGenerationErrors((currentErrors) => {
          const nextErrors = { ...currentErrors };
          delete nextErrors[appointmentId];
          return nextErrors;
        });
      } catch (error) {
        console.warn("Home automatic CarePrep did not run.", error);
      } finally {
        homeAutoCarePrepInFlightRef.current.delete(appointmentId);
        setGeneratingCarePrepForId((currentId) =>
          currentId === appointmentId ? null : currentId
        );
      }
    })();
    // requestCarePrepGeneration and loadAppointments intentionally use the
    // current component state; this effect is keyed to the visible Home target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    generatingCarePrepForId,
    appointmentDetailsHydrated,
    homeNextAppointment,
    homeNextGuidance,
    mainTab,
    sessionProfileLoaded,
    showWelcomeGuide,
    signedInEmail,
  ]);

  useEffect(() => {
    if (
      !signedInEmail ||
      !sessionProfileLoaded ||
      mainTab !== "appointments" ||
      appointmentView !== "upcoming" ||
      !appointmentDetailsHydrated ||
      appointmentsPageAutoCarePrepInFlightRef.current ||
      appointments.length === 0
    ) {
      return;
    }

    const missingCarePrepAppointments = appointments.filter((appointment) => {
      if (
        appointmentsPageAutoCarePrepAttemptedRef.current.has(appointment.id) ||
        !appointment.care_subject_id ||
        appointment.status === "archived" ||
        appointment.current_note_id ||
        guidanceByAppointment.has(appointment.id) ||
        draftGuidanceByAppointment.has(appointment.id) ||
        !isEligibleForHomeAutoCarePrep(appointment)
      ) {
        return false;
      }

      if (!appointment.starts_at) {
        return true;
      }

      return new Date(appointment.starts_at) >= startOfToday();
    });

    if (missingCarePrepAppointments.length === 0) {
      return;
    }

    appointmentsPageAutoCarePrepInFlightRef.current = true;

    void (async () => {
      try {
        for (const appointment of missingCarePrepAppointments) {
          if (
            appointmentsPageAutoCarePrepAttemptedRef.current.has(
              appointment.id
            ) ||
            guidanceByAppointment.has(appointment.id) ||
            draftGuidanceByAppointment.has(appointment.id)
          ) {
            continue;
          }

          appointmentsPageAutoCarePrepAttemptedRef.current.add(appointment.id);
          setGeneratingCarePrepForId(appointment.id);
          setCarePrepGenerationErrors((currentErrors) => {
            const nextErrors = { ...currentErrors };
            delete nextErrors[appointment.id];
            return nextErrors;
          });

          try {
            await requestCarePrepGeneration(
              appointment.id,
              "auto_appointments_page"
            );
          } catch (error) {
            console.warn(
              "Appointments page automatic CarePrep did not run.",
              error
            );
          } finally {
            setGeneratingCarePrepForId((currentId) =>
              currentId === appointment.id ? null : currentId
            );
          }
        }

        await loadAppointments(appointmentView, selectedSubjectId);
      } finally {
        appointmentsPageAutoCarePrepInFlightRef.current = false;
      }
    })();
    // requestCarePrepGeneration and loadAppointments intentionally use the
    // current component state; this effect is keyed to the visible page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appointmentDetailsHydrated,
    appointmentView,
    appointments,
    draftGuidanceByAppointment,
    guidanceByAppointment,
    mainTab,
    selectedSubjectId,
    sessionProfileLoaded,
    signedInEmail,
  ]);

  function carePrepFormValues(appointmentId: string, draft: CarePrepGuidance) {
    return carePrepGuidanceFormValues(draft, carePrepDrafts[appointmentId]);
  }

  function hasCarePrepDraftChanges(
    appointmentId: string,
    draft: CarePrepGuidance
  ) {
    return carePrepGuidanceHasDraftChanges(draft, carePrepDrafts[appointmentId]);
  }

  function updateCarePrepDraft(
    appointmentId: string,
    field: keyof typeof emptyCarePrepDraft,
    value: string,
    baseValues: typeof emptyCarePrepDraft
  ) {
    setCarePrepDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: {
        ...baseValues,
        ...currentDrafts[appointmentId],
        [field]: value,
      },
    }));
  }

  function startEditingCarePrep(appointmentId: string, prep: CarePrepGuidance) {
    setPendingCarePrepCloseId(null);
    setCarePrepDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: carePrepFormValues(appointmentId, prep),
    }));
    setEditingCarePrepIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: true,
    }));
  }

  function cancelEditingCarePrep(appointmentId: string) {
    setPendingCarePrepCloseId(null);
    setCarePrepDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      delete nextDrafts[appointmentId];
      return nextDrafts;
    });
    setEditingCarePrepIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: false,
    }));
  }

  function requestCloseCarePrepEdit(
    appointmentId: string,
    prep: CarePrepGuidance
  ) {
    if (hasCarePrepDraftChanges(appointmentId, prep)) {
      setPendingCarePrepCloseId(appointmentId);
      return;
    }

    cancelEditingCarePrep(appointmentId);
  }

  async function saveCurrentCarePrepEdit(
    appointmentId: string,
    prep: CarePrepGuidance
  ) {
    setSavingCarePrepForId(appointmentId);
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before editing CarePrep.");
      }

      const draftValues = carePrepFormValues(appointmentId, prep);
      const response = await fetch("/api/careprep", {
        body: JSON.stringify({
          action: "edit_current",
          appointmentId,
          currentGuidanceId: prep.id,
          editedGuidance: {
            bring_list: linesToList(draftValues.bringList),
            key_questions: linesToList(draftValues.keyQuestions),
            med_review: linesToList(draftValues.medReview),
            next_steps: linesToList(draftValues.nextSteps),
            since_last_visit: linesToList(draftValues.sinceLastVisit),
            summary: draftValues.summary.trim(),
            watchouts: linesToList(draftValues.watchouts),
          },
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "CarePrep edit failed.");
      }

      cancelEditingCarePrep(appointmentId);
      await loadAppointments();
      setMessage(result.message ?? "CarePrep edit saved.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingCarePrepForId(null);
    }
  }

  async function submitCarePrepReview({
    action,
    appointmentId,
    draft,
  }: {
    action: "accept" | "save_edit";
    appointmentId: string;
    draft: CarePrepGuidance;
  }) {
    setSavingCarePrepForId(appointmentId);
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before reviewing CarePrep.");
      }

      const draftValues = carePrepFormValues(appointmentId, draft);
      const response = await fetch("/api/careprep", {
        body: JSON.stringify({
          action,
          appointmentId,
          draftGuidanceId: draft.id,
          editedGuidance:
            action === "save_edit"
              ? {
                  bring_list: linesToList(draftValues.bringList),
                  key_questions: linesToList(draftValues.keyQuestions),
                  med_review: linesToList(draftValues.medReview),
                  next_steps: linesToList(draftValues.nextSteps),
                  since_last_visit: linesToList(draftValues.sinceLastVisit),
                  summary: draftValues.summary.trim(),
                  watchouts: linesToList(draftValues.watchouts),
                }
              : null,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "What to Know review failed.");
      }

      setCarePrepDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[appointmentId];
        return nextDrafts;
      });
      await loadAppointments();
      setCarePrepExpandedForAppointment(appointmentId, true);
      setMessage(result.message ?? "What to Know reviewed.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingCarePrepForId(null);
    }
  }

  function updateNoteDraft(
    appointmentId: string,
    field: "followups" | "summary" | "takeaways",
    value: string
  ) {
    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: {
        ...emptyNoteDraft,
        ...currentDrafts[appointmentId],
        [field]: value,
      },
    }));
  }

  function startEditingNote(appointmentId: string, note: AppointmentNote) {
    setPendingModifierSwitch(null);
    cancelTextIntake();
    setEditingAppointmentIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: false,
    }));
    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: {
        followups: asTextList(note.followups).join("\n"),
        summary: note.summary_short ?? "",
        takeaways: asTextList(note.takeaways).join("\n"),
      },
    }));
    setEditingNoteIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: true,
    }));
  }

  function cancelEditingNote(appointmentId: string) {
    setPendingModifierSwitch(null);
    setEditingNoteIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: false,
    }));
    setNoteDrafts((currentDrafts) => ({
      ...currentDrafts,
      [appointmentId]: emptyNoteDraft,
    }));
  }

  async function handleSaveNote(
    event: FormEvent<HTMLFormElement>,
    appointment: Appointment
  ) {
    event.preventDefault();
    setSavingNoteForId(appointment.id);
    setMessage("");

    try {
      const draft = noteDrafts[appointment.id];
      const summary = draft?.summary.trim() ?? "";
      const takeaways = linesToList(draft?.takeaways ?? "");
      const followups = linesToList(draft?.followups ?? "");

      if (!summary && takeaways.length === 0 && followups.length === 0) {
        throw new Error("Please add a summary, takeaway, or follow-up.");
      }

      const existingNote = notesByAppointment.get(appointment.id);
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Please sign in before saving Visit Notes.");
      }

      const response = await fetch("/api/appointment-notes", {
        body: JSON.stringify({
          appointmentId: appointment.id,
          followups,
          summary,
          takeaways,
        }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as {
        careCircleId?: string;
        careSubjectId?: string | null;
        error?: string;
        noteId?: string;
        ok?: boolean;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Visit Notes could not be saved.");
      }

      setNoteDrafts((currentDrafts) => ({
        ...currentDrafts,
        [appointment.id]: emptyNoteDraft,
      }));
      setEditingNoteIds((currentIds) => ({
        ...currentIds,
        [appointment.id]: false,
      }));
      await loadAppointments();
      setMessage(existingNote ? "Notes updated. Previous version archived." : "Notes added.");
      if (result.careCircleId && result.careSubjectId) {
        void triggerAutoCarePrepAfterNotes({
          careCircleId: result.careCircleId,
          careSubjectId: result.careSubjectId,
          sourceAppointmentId: appointment.id,
        });
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingNoteForId(null);
    }
  }

  function renderPlaceLookup(
    className = "",
    options: {
      helperText?: string;
      label?: string;
      placeholder?: string;
      plain?: boolean;
    } = {}
  ) {
    const canFavorite =
      Boolean(newAppointmentLocationName.trim()) ||
      Boolean(newAppointmentProviderOrganization.trim()) ||
      Boolean(newAppointmentLocationAddress.trim());
    const label = options.label ?? "Location lookup";
    const helperText =
      options.helperText ??
      "Search favorite locations first, or look up a place with Google.";
    const placeholder =
      options.placeholder ?? "Search by clinic, business, or address";

    return (
      <section
        className={`${
          options.plain
            ? ""
            : "rounded-md border border-blue-100 bg-white p-3"
        } ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3
              className={`text-slate-900 ${
                options.plain ? "font-medium" : "font-semibold"
              } ${options.plain ? "text-base" : "text-sm"}`}
            >
              {label}
            </h3>
            {helperText ? (
              <p className="mt-1 text-xs text-slate-500">{helperText}</p>
            ) : null}
          </div>
          {loadingFavoriteLocations ? (
            <span className="text-xs font-semibold text-slate-500">
              Loading favorites...
            </span>
          ) : null}
        </div>

	        <input
          className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
          onChange={(event) => {
            const nextQuery = event.target.value;
            setPlaceLookupQuery(nextQuery);
            if (options.plain) {
              setNewAppointmentLocationAddress(nextQuery);
            }
            setSelectedGooglePlace(null);
            setPlacesStatusMessage("");
            if (nextQuery.trim().length < 3) {
              setPlaceLookupSuggestions([]);
            }
          }}
          placeholder={placeholder}
          type="text"
          value={placeLookupQuery}
        />

        {placesStatusMessage ? (
          <p className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
            {placesStatusMessage}
          </p>
        ) : null}

        {filteredFavoriteLocations.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Favorite locations
            </p>
            <div className="mt-2 grid gap-2">
              {filteredFavoriteLocations.map((location) => (
                <button
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                  key={location.id}
                  onClick={() => applyFavoriteLocation(location)}
                  type="button"
                >
                  <span className="font-semibold text-slate-900">
                    {favoriteLocationLabel(location)}
                  </span>
                  {location.place_name || location.address ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      {[location.place_name, location.address]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {placeLookupSuggestions.length > 0 ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Google suggestions
              </p>
              <p className="text-xs font-semibold text-slate-500">
                Powered by Google
              </p>
            </div>
            <div className="mt-2 grid gap-2">
              {placeLookupSuggestions.map((suggestion) => (
                <button
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                  key={suggestion.placeId}
                  onClick={() => applyGooglePlaceSuggestion(suggestion)}
                  type="button"
                >
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {searchingPlaces ? (
          <p className="mt-2 text-sm font-semibold text-blue-700">
            Searching locations...
          </p>
        ) : null}

        {canFavorite ? (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <input
                checked={addFavoriteLocation}
                onChange={(event) =>
                  setAddFavoriteLocation(event.target.checked)
                }
                type="checkbox"
              />
              Add as a favorite location
            </label>
            {addFavoriteLocation ? (
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Nickname
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                  onChange={(event) =>
                    setFavoriteLocationNickname(event.target.value)
                  }
                  placeholder="e.g. Mom's cardiologist"
	                  type="text"
	                  value={favoriteLocationNickname}
	                />
	              </label>
	            ) : null}
	          </div>
	        ) : null}
      </section>
    );
  }

  function renderHomeView() {
    const nextSubjectRecord = homeNextAppointment?.care_subject_id
      ? subjectsById.get(homeNextAppointment.care_subject_id) ?? null
      : null;
    const homeMapsLink = appointmentGoogleMapsUrl(homeNextAppointment);
    const homePracticeLabel =
      homeNextAppointment?.provider_organization ||
      homeNextAppointment?.location_name ||
      "";
    const activeNextAppointmentSubject =
      selectedSubjectId !== ALL_SUBJECTS
        ? subjectsById.get(selectedSubjectId) ?? null
        : nextSubjectRecord;
    const everyoneNextAppointmentRows = careSubjects
      .map((subject) => ({
        appointment: homeNextAppointmentsBySubjectId[subject.id] ?? null,
        subject,
      }))
      .filter(
        (row): row is { appointment: Appointment; subject: CareSubject } =>
          Boolean(row.appointment)
      );
    const homeCarePrepGenerationError = homeNextAppointment
      ? carePrepGenerationErrors[homeNextAppointment.id]
      : null;
    const isHomeCarePrepEligible = homeNextAppointment
      ? isEligibleForHomeAutoCarePrep(homeNextAppointment)
      : false;
    const notesEntryAppointment =
      homeNextAppointment?.id === textIntakeTargetAppointmentId
        ? homeNextAppointment
        : notesReminderAppointment;
    const showNotesReminderTrigger = Boolean(
      notesReminderAppointment &&
        notesReminderAppointment.id !== homeNextAppointment?.id
    );
    const showNotesEntrySection = Boolean(
      notesEntryAppointment &&
        (showNotesReminderTrigger ||
          textIntakeTargetAppointmentId === notesEntryAppointment.id ||
          pendingModifierSwitch?.appointmentId === notesEntryAppointment.id)
    );
    const healthFocusAskContext = buildHealthFocusAskContext({
      allSubjectsValue: ALL_SUBJECTS,
      selectedTopic: selectedHealthFocusTopic,
      topicDetail: healthFocusTopicDetail,
    });
    const hasExistingWelcomeAppointments =
      hasAnySavedAppointments ||
      Boolean(homeNextAppointment) ||
      Boolean(notesReminderAppointment);
    const welcomeActionsMode =
      hasExistingWelcomeAppointments &&
      welcomeExistingAppointmentsVariant === "returnHome"
        ? "returnHome"
        : "firstActions";
    const showPreviousWelcomePanel = () =>
      setWelcomePanelIndex((currentIndex) =>
        currentIndex === 0 ? currentIndex : currentIndex - 1
      );
    const showNextWelcomePanel = () =>
      setWelcomePanelIndex((currentIndex) =>
        currentIndex === welcomeGuidePanelCount - 1
          ? currentIndex
          : currentIndex + 1
      );
    const homeAtAGlanceSummary = buildHomeAtAGlanceSummary({
      appointments,
      careSubjects,
      carePrepHistory,
      hasAnySavedAppointments,
      healthFocusTopics,
      homeNextAppointment,
      homeNextAppointmentsBySubjectId,
      homeNextGuidance,
      homeTodayFocusGroups,
      notesReminderAppointment,
      selectedSubjectId,
    });
    const activeHomeMessages =
      selectedSubjectId === ALL_SUBJECTS
        ? []
        : homeMessageGroups.find((group) => group.subjectId === selectedSubjectId)
            ?.messages ?? [];
    const activeHomeMessageSummaryResult =
      selectedSubjectId === ALL_SUBJECTS
        ? null
        : buildHomeMessageSummary([
            {
              messages: activeHomeMessages,
              personId: selectedSubjectId,
              personName:
                careSubjects.find((subject) => subject.id === selectedSubjectId)
                  ?.display_name || "this Care VIP",
            },
          ]);
    const activeHomeMessageSummary =
      activeHomeMessageSummaryResult?.individualSummaries[0]?.summary ?? "";
    const activeHomeMessageIndividualSummary =
      activeHomeMessageSummaryResult?.individualSummaries[0] ?? null;

    return (
      <div className="mt-1 space-y-2">
        {showWelcomeGuide ? (
          <WelcomeGuide
            actionsMode={welcomeActionsMode}
            gentlePrimaryButtonClass={gentlePrimaryButtonClass}
            gentleSecondaryButtonClass={gentleSecondaryButtonClass}
            hasExistingWelcomeAppointments={hasExistingWelcomeAppointments}
            isAdmin={isAdmin}
            onAddExamples={() => {
              void (async () => {
                await markWelcomeGuideRead();
                await handleSeedSampleDataForCurrentUser(true);
              })();
            }}
            onAddFirstAppointment={() => {
              void (async () => {
                await markWelcomeGuideRead();
                startAppointmentPanel("add");
              })();
            }}
            onChangeExistingAppointmentsVariant={
              setWelcomeExistingAppointmentsVariant
            }
            onImportAppointments={() => {
              void (async () => {
                await markWelcomeGuideRead();
                startAppointmentPanel("quickAdd");
              })();
            }}
            onNeedHelp={() => {
              setAskPanelOpen(true);
              setAskCloseConfirmOpen(false);
            }}
            onNextPanel={showNextWelcomePanel}
            onPreviousPanel={showPreviousWelcomePanel}
            onReturnHome={() => {
              void markWelcomeGuideRead();
            }}
            panelIndex={welcomePanelIndex}
            sampleDataSeededAt={sampleDataSeededAt}
            seedingSampleData={seedingSampleData}
            welcomeExistingAppointmentsVariant={
              welcomeExistingAppointmentsVariant
            }
          />
        ) : (
          <>
            {canShowAdminItems ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2 text-sm text-slate-700">
                <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-blue-900">
                  <input
                    checked={showHomeAtAGlanceTest}
                    className="h-4 w-4 rounded border-blue-200 text-blue-700 focus:ring-blue-300"
                    onChange={(event) =>
                      setShowHomeAtAGlanceTest(event.target.checked)
                    }
                    type="checkbox"
                  />
                  Show CarePland at a Glance test
                </label>
                <span className="text-xs font-medium text-slate-500">
                  Admin only
                </span>
              </div>
            ) : null}

            <section className="rounded-lg border border-blue-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    Receiver Setup
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Install, pair, and configure a CarePland Receiver.
                  </p>
                </div>
                <button
                  className="min-h-10 rounded-full border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-100"
                  onClick={openReceiverSetup}
                  type="button"
                >
                  Set Up Receiver
                </button>
              </div>
            </section>

            {isEveryoneFocus ? (
              everyoneNextAppointmentRows.length > 0 ? (
                <div className="space-y-2">
                  {everyoneNextAppointmentRows.map(({ appointment, subject }) => {
                    const rowPracticeLabel =
                      appointment.provider_organization ||
                      appointment.location_name ||
                      "";

                    return (
                      <HomeNextAppointmentPanel
                        appointment={appointment}
                        formatDate={formatDate}
                        generationError={null}
                        guidance={null}
                        highlights={[]}
                        isGenerating={false}
                        isCarePrepEligible={false}
                        key={subject.id}
                        mapsLink={appointmentGoogleMapsUrl(appointment)}
                        nextSubject=""
                        onAddAppointment={() => startAppointmentPanel("add")}
                        practiceLabel={rowPracticeLabel}
                        title={nextAppointmentTitleForSubject(subject)}
                      />
                    );
                  })}
                </div>
              ) : (
                <HomeNextAppointmentPanel
                  appointment={null}
                  formatDate={formatDate}
                  generationError={null}
                  guidance={null}
                  highlights={[]}
                  isGenerating={false}
                  isCarePrepEligible={false}
                  mapsLink={null}
                  nextSubject=""
                  onAddAppointment={() => startAppointmentPanel("add")}
                  practiceLabel=""
                  title="Next appointments"
                />
              )
            ) : (
              <HomeNextAppointmentPanel
                addNotesOpen={
                  Boolean(homeNextAppointment) &&
                  textIntakeTargetAppointmentId === homeNextAppointment?.id
                }
                appointment={homeNextAppointment}
                formatDate={formatDate}
                generationError={homeCarePrepGenerationError}
                guidance={homeNextGuidance}
                highlights={homeCarePrepHighlights}
                isGenerating={
                  generatingCarePrepForId === homeNextAppointment?.id
                }
                isCarePrepEligible={isHomeCarePrepEligible}
                mapsLink={homeMapsLink}
                nextSubject=""
                onAddAppointment={() => startAppointmentPanel("add")}
                onAddNotes={
                  homeNextAppointment
                    ? () => {
                        if (
                          textIntakeTargetAppointmentId === homeNextAppointment.id
                        ) {
                          requestCloseTextIntake(homeNextAppointment);
                          return;
                        }

                        startContextualTextIntake(homeNextAppointment);
                      }
                    : undefined
                }
                practiceLabel={homePracticeLabel}
                title={nextAppointmentTitleForSubject(
                  activeNextAppointmentSubject
                )}
              >
                {showNotesEntrySection &&
                notesEntryAppointment &&
                notesEntryAppointment.id === homeNextAppointment?.id ? (
                  <section>
                    {pendingModifierSwitch?.appointmentId ===
                    notesEntryAppointment.id ? (
                      <InlineConfirmation
                        cancelLabel="Return to editing"
                        className="mt-3"
                        confirmLabel="Discard and close"
                        message="Closing will discard your unsaved changes. Proceed?"
                        onCancel={() => setPendingModifierSwitch(null)}
                        onConfirm={() =>
                          discardAndSwitchAppointmentModifier(notesEntryAppointment)
                        }
                      />
                    ) : null}
                    {textIntakeTargetAppointmentId === notesEntryAppointment.id ? (
                      <form
                        className="mt-2"
                        onSubmit={
                          textIntakeDraft
                            ? handleSaveTextIntakeDraft
                            : handleInterpretTextIntake
                        }
                      >
                        {!textIntakeDraft ? (
                          <>
                            <div
                              className={`mt-2 rounded-lg border transition ${
                                appointmentNotesDragActive
                                  ? "border-blue-300 bg-blue-50"
                                  : "border-slate-300 bg-white"
                              }`}
                              onDragEnter={handleAppointmentNotesDrag}
                              onDragLeave={handleAppointmentNotesDrag}
                              onDragOver={handleAppointmentNotesDrag}
                              onDrop={handleAppointmentNotesDrop}
                            >
                              <label className="block text-sm font-medium text-slate-700">
                                <span className="flex flex-wrap items-center justify-between gap-3">
                                  <span>Visit notes</span>
                                  <span className="inline-flex cursor-pointer items-center rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50">
                                    Add Files
                                    <input
                                      accept=".pdf,.txt,.md,.csv,.log,text/plain,text/csv,text/markdown,application/pdf,image/gif,image/jpeg,image/png,image/webp"
                                      className="sr-only"
                                      disabled={extractingImageText}
                                      multiple
                                      onChange={(event) => {
                                        void handleAppointmentNotesFiles(
                                          event.target.files
                                        );
                                        event.target.value = "";
                                      }}
                                      type="file"
                                    />
                                  </span>
                                </span>
                                <textarea
                                  className="mt-2 min-h-32 w-full rounded-lg bg-transparent px-3 py-2 text-base outline-none"
                                  onChange={(event) =>
                                    setContextualTextIntakeValue(
                                      event.target.value
                                    )
                                  }
                                  placeholder="Type, paste, add or drag anything related to this visit"
                                  value={contextualTextIntakeValue}
                                />
                              </label>
                            </div>
                            {fileImportStatus ? (
                              <p className="mt-2 text-xs text-slate-500">
                                {fileImportStatus}
                              </p>
                            ) : null}
                            <button
                              className="mt-4 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:border-blue-200 hover:bg-[#eef7ff] disabled:text-slate-400"
                              disabled={processingTextIntake}
                              type="submit"
                            >
                              {processingTextIntake
                                ? "Interpreting..."
                                : "Review notes"}
                            </button>
                          </>
                        ) : (
                          <>
                            <AppointmentDetailUpdateOption
                              checked={applyTextIntakeAppointmentDetails}
                              changes={appointmentDetailChanges(
                                notesEntryAppointment,
                                textIntakeDraft
                              )}
                              onChange={setApplyTextIntakeAppointmentDetails}
                            />
                            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                              <label className="block text-sm font-medium text-slate-700 lg:col-span-3">
                                Visit summary
                                <textarea
                                  className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateTextIntakeDraft(
                                      "notesSummary",
                                      event.target.value
                                    )
                                  }
                                  value={textIntakeDraft.notesSummary}
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                Takeaways
                                <textarea
                                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateTextIntakeDraft(
                                      "takeaways",
                                      event.target.value
                                    )
                                  }
                                  value={textIntakeDraft.takeaways}
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                Follow-ups
                                <textarea
                                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateTextIntakeDraft(
                                      "followups",
                                      event.target.value
                                    )
                                  }
                                  value={textIntakeDraft.followups}
                                />
                              </label>
                              <div className="flex items-end">
                                <button
                                  className={
                                    intakeDraftHasSaveableNotes(textIntakeDraft)
                                      ? gentlePrimaryButtonClass
                                      : gentleSecondaryButtonClass
                                  }
                                  disabled={
                                    savingTextIntake ||
                                    !intakeDraftHasSaveableNotes(textIntakeDraft)
                                  }
                                  type="submit"
                                >
                                  {savingTextIntake ? "Saving..." : "Save notes"}
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </form>
                    ) : null}
                  </section>
                ) : null}
              </HomeNextAppointmentPanel>
            )}

            <RecentMessagesPanel
              action={
                selectedSubjectId === ALL_SUBJECTS ? null : (
                  <button
                    className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:border-blue-200 hover:bg-blue-100"
                    onClick={() => openMessagesPage()}
                    type="button"
                  >
                    View all messages
                  </button>
                )
              }
              emptyLabel={
                selectedSubjectId === ALL_SUBJECTS
                  ? "Choose a Care VIP to see recent messages."
                  : "No recent messages for this Care VIP yet."
              }
              formatDate={formatDate}
              loading={homeMessagesLoading}
              messages={activeHomeMessages}
              onOpenAppointmentMessage={openMessageAppointment}
              onOpenMessage={() => openMessagesPage()}
              onSummaryFeedback={
                selectedSubjectId !== ALL_SUBJECTS &&
                activeHomeMessageSummaryResult &&
                activeHomeMessageIndividualSummary
                  ? ({ userComment }) =>
                      submitHomeMessageSummaryFeedback({
                        decisionTrace:
                          activeHomeMessageSummaryResult.decisionTrace,
                        keyPoints: activeHomeMessageIndividualSummary.keyPoints,
                        personId: selectedSubjectId,
                        sourceMessageIds:
                          activeHomeMessageIndividualSummary.sourceMessageIds,
                        summary: activeHomeMessageIndividualSummary.summary,
                        userComment,
                      })
                  : undefined
              }
              summary={activeHomeMessageSummary}
              title="Messages"
            />

            {canShowAdminItems && showHomeAtAGlanceTest ? (
              <section className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                      {homeAtAGlanceSummary.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {homeAtAGlanceSummary.subtitle}
                    </p>
                  </div>
                  <button
                    className="text-xs font-semibold text-blue-700 underline-offset-2 hover:text-blue-900 hover:underline"
                    onClick={() => {
                      setShowHomeAtAGlanceTest(false);
                      setHomeAtAGlanceExpanded(false);
                    }}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
                <ul className="mt-3 space-y-2">
                  {homeAtAGlanceSummary.items.map((item) => (
                    <li
                      className="flex gap-2 text-sm font-medium text-slate-800"
                      key={item}
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className="text-sm font-semibold text-blue-700 underline-offset-2 hover:text-blue-900 hover:underline"
                  onClick={() =>
                    setHomeAtAGlanceExpanded((currentValue) => !currentValue)
                  }
                  type="button"
                >
                  {homeAtAGlanceExpanded ? "Show less" : "More..."}
                </button>
                {homeAtAGlanceExpanded ? (
                  <div className="grid gap-5 border-t border-blue-100 pt-3 md:grid-cols-2">
                    {homeAtAGlanceSummary.historySections.map((section) => (
                      <div
                        className="space-y-2"
                        key={section.title}
                      >
                        <h3 className="text-sm font-semibold text-slate-900">
                          {section.title}
                        </h3>
                        <ul className="mt-2 space-y-1.5">
                          {section.items.map((item) => (
                            <li
                              className="text-sm text-slate-700"
                              key={item}
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                        {section.estimates?.length ? (
                          <div className="space-y-1 pt-1">
                            {section.estimates.map((estimate) => (
                              <p
                                className="text-xs font-medium text-slate-500"
                                key={estimate}
                              >
                                {estimate}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {homeTodayFocusGroups.length > 0 ? (
              <section className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                    {isEveryoneFocus
                      ? "Today's Focus"
                      : homeTodayFocusGroups[0]?.subjectName === "you"
                        ? "Today's Focus for you"
                        : `Today's Focus for ${homeTodayFocusGroups[0]?.subjectName ?? "this Care VIP"}`}
                  </h2>
                  {homeTodayFocusLoading ? (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      Refreshing
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {homeTodayFocusGroups.map((group) => (
                    <div
                      className="space-y-2"
                      key={group.subjectId}
                    >
                      {isEveryoneFocus ? (
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <PersonAvatar person={group.subjectAvatar} size="xs" />
                          <span>
                            {group.subjectLabel}
                            {group.subjectAvatar?.managedByHousehold ? (
                              <ManagedByHouseholdHeart className="ml-1" />
                            ) : null}
                          </span>
                        </h3>
                      ) : null}
                      <ul className="space-y-2">
                        {group.items.map((item) => (
                          <li
                            className="flex items-start gap-2 text-sm font-medium text-slate-800"
                            key={item.id}
                          >
                            <span
                              className="mt-0.5 text-base leading-none text-blue-700"
                              aria-hidden="true"
                            >
                              ✓
                            </span>
                            <span>{item.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <HealthFocusCard
              changeControl={
                healthFocusTopics.length > 0 && healthStoryFocusOptions.length > 1 ? (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <button
                      className="text-xs font-semibold text-blue-700 underline-offset-2 hover:text-blue-900 hover:underline"
                      onClick={() =>
                        setHealthStorySubjectChooserOpen(
                          (currentValue) => !currentValue
                        )
                      }
                      type="button"
                    >
                      Change
                    </button>
                    {healthStorySubjectChooserOpen ? (
                      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1">
                        {healthStoryFocusOptions.map((option) => {
                          const selected =
                            option.id === activeHealthStorySubjectId;

                          return (
                            <button
                              aria-pressed={selected}
                              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold transition ${
                                selected
                                  ? "border-blue-300 bg-blue-50 text-blue-900"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                              }`}
                              key={option.id}
                              onClick={() =>
                                handleChangeHealthStorySubject(option.id)
                              }
                              type="button"
                            >
                              <PersonAvatar person={option.avatar} size="xs" />
                              <span>
                                {option.label}
                                {option.avatar?.managedByHousehold ? (
                                  <ManagedByHouseholdHeart className="ml-1" />
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null
              }
              contextLabelOverrides={healthFocusContextLabelOverrides}
              isLoading={healthFocusLoading}
              onExpandTopics={(hiddenTopics) => {
                void prefetchHealthFocusTopicDetails(hiddenTopics);
              }}
              onCloseTopic={() => {
                setSelectedHealthFocusTopic(null);
                setHealthFocusTopicDetail(null);
                setHealthStoryContextAnswer("");
                setHealthStoryContextError(null);
              }}
              onSelectTopic={(topic) => {
                void loadHealthFocusTopicDetail(topic);
              }}
              selectedTopicKey={
                selectedHealthFocusTopic
                  ? `${selectedHealthFocusTopic.careSubjectId}:${selectedHealthFocusTopic.topicSlug}`
                  : null
              }
              selectedTopicStory={
                <HealthFocusTopicDetail
                  contextLabelOverrides={healthFocusContextLabelOverrides}
                  detail={healthFocusTopicDetail}
                  isLoading={healthFocusDetailLoading}
                  onClose={() => {
                    setSelectedHealthFocusTopic(null);
                    setHealthFocusTopicDetail(null);
                    setHealthStoryContextAnswer("");
                    setHealthStoryContextError(null);
                  }}
                  onSubmitFeedback={handleHealthStoryFeedback}
                  onUndoFeedback={handleUndoHealthStoryFeedback}
                  contextPanel={
                    selectedHealthFocusTopic ? (
                      <HomeContextPanel
                        answer={healthStoryContextAnswer}
                        askContext={
                          healthFocusAskContext ?? { level: "health_focus" }
                        }
                        error={healthStoryContextError}
                        isLoading={healthStoryContextLoading}
                        onAsk={handleHomeContextQuestion}
                        variant="compact"
                      />
                    ) : null
                  }
                  variant="inline"
                />
              }
              title={healthFocusTopics.length > 0 ? healthStoryTitle : "Your Health Stories"}
              topics={healthFocusTopics}
            />

            {showNotesReminderTrigger && notesReminderAppointment ? (
              <section className="mb-24">
                <button
                  className={`inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border px-4 py-2 text-left text-sm font-semibold text-blue-800 ${
                    textIntakeTargetAppointmentId === notesReminderAppointment.id
                      ? "border-blue-300 bg-white shadow-sm"
                      : "border-blue-200 bg-[#f4faff] hover:bg-[#eef7ff]"
                  }`}
                  onClick={() => {
                    if (
                      textIntakeTargetAppointmentId === notesReminderAppointment.id
                    ) {
                      requestCloseTextIntake(notesReminderAppointment);
                      return;
                    }

                    startContextualTextIntake(notesReminderAppointment);
                  }}
                  type="button"
                >
                  <span>Add notes to:</span>
                  <span className="truncate text-blue-950">
                    {notesReminderAppointment.title || "Untitled appointment"}
                  </span>
                  <span className="font-medium text-blue-700">
                    {formatDate(notesReminderAppointment.starts_at)}
                  </span>
                  {notesReminderAppointment.is_sample_data ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                      Demo
                    </span>
                  ) : null}
                </button>
                {pendingModifierSwitch?.appointmentId ===
                notesReminderAppointment.id ? (
                  <InlineConfirmation
                    cancelLabel="Return to editing"
                    className="mt-3"
                    confirmLabel="Discard and close"
                    message="Closing will discard your unsaved changes. Proceed?"
                    onCancel={() => setPendingModifierSwitch(null)}
                    onConfirm={() =>
                      discardAndSwitchAppointmentModifier(notesReminderAppointment)
                    }
                  />
                ) : null}
                {textIntakeTargetAppointmentId === notesReminderAppointment.id ? (
                  <form
                    className={`mt-3 transition-colors ${
                      appointmentNotesDragActive
                        ? "rounded-md bg-blue-50/70 p-4"
                        : ""
                    }`}
                    onDragEnter={handleAppointmentNotesDrag}
                    onDragLeave={handleAppointmentNotesDrag}
                    onDragOver={handleAppointmentNotesDrag}
                    onDrop={handleAppointmentNotesDrop}
                    onSubmit={
                      textIntakeDraft
                        ? handleSaveTextIntakeDraft
                        : handleInterpretTextIntake
                    }
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <h2 className="text-xl font-semibold text-slate-950">
                          Import Anything for{" "}
                          {notesReminderAppointment.title ||
                            "this appointment"}
                        </h2>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                          CarePland will figure it out.
                        </p>
                      </div>
                      <button
                        className="justify-self-end rounded-md px-2 py-1 text-xs font-normal text-[#767676] transition hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => requestCloseTextIntake(notesReminderAppointment)}
                        type="button"
                      >
                        Close
                      </button>
                    </div>

                    {!textIntakeDraft ? (
                      <>
                        <div className="mt-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div
                              className={`inline-flex rounded-md border border-dashed px-4 py-3 text-base font-semibold transition-colors ${
                                appointmentNotesDragActive
                                  ? "border-blue-300 bg-white text-blue-900"
                                  : "border-blue-100 bg-blue-50/40 text-blue-800"
                              }`}
                            >
                              {extractingImageText
                                ? "Reviewing files..."
                                : appointmentNotesDragActive
                                  ? "Drop files here."
                                  : "Drag files here"}
                            </div>
                            <label
                              className={`rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-100 ${
                                extractingImageText
                                  ? "cursor-not-allowed opacity-60"
                                  : "cursor-pointer"
                              }`}
                            >
                              Add Files
                              <input
                                accept=".pdf,.txt,.md,.csv,.log,text/plain,text/csv,text/markdown,application/pdf,image/gif,image/jpeg,image/png,image/webp"
                                className="sr-only"
                                disabled={extractingImageText}
                                multiple
                                onChange={(event) => {
                                  void handleAppointmentNotesFiles(
                                    event.target.files
                                  );
                                  event.target.value = "";
                                }}
                                type="file"
                              />
                            </label>
                          </div>
                          {fileImportStatus ? (
                            <p className="mt-3 text-sm font-medium text-slate-600">
                              {fileImportStatus}
                            </p>
                          ) : null}
                        </div>
                        <label className="mt-5 block text-sm font-medium text-slate-700">
                          Add any text you have
                          <textarea
                            className="mt-2 min-h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                            onChange={(event) =>
                              setContextualTextIntakeValue(event.target.value)
                            }
                            placeholder="Type, paste, insert appointment text here"
                            value={contextualTextIntakeValue}
                          />
                        </label>
                        <button
                          className="mt-4 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:border-blue-200 hover:bg-[#eef7ff] disabled:text-slate-400"
                          disabled={processingTextIntake}
                          type="submit"
                        >
                          {processingTextIntake
                            ? "Reviewing..."
                            : "Review before Saving"}
                        </button>
                      </>
                    ) : (
                      <>
                        <AppointmentDetailUpdateOption
                          checked={applyTextIntakeAppointmentDetails}
                          changes={appointmentDetailChanges(
                            notesReminderAppointment,
                            textIntakeDraft
                          )}
                          onChange={setApplyTextIntakeAppointmentDetails}
                        />
                        <div className="mt-4 grid gap-4 lg:grid-cols-3">
                          <label className="block text-sm font-medium text-slate-700 lg:col-span-3">
                            Visit summary
                            <textarea
                              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateTextIntakeDraft(
                                  "notesSummary",
                                  event.target.value
                                )
                              }
                              value={textIntakeDraft.notesSummary}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Takeaways
                            <textarea
                              className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateTextIntakeDraft(
                                  "takeaways",
                                  event.target.value
                                )
                              }
                              value={textIntakeDraft.takeaways}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Follow-ups
                            <textarea
                              className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateTextIntakeDraft(
                                  "followups",
                                  event.target.value
                                )
                              }
                              value={textIntakeDraft.followups}
                            />
                          </label>
                          <div className="flex items-end">
                            <button
                              className={
                                intakeDraftHasSaveableNotes(textIntakeDraft)
                                  ? gentlePrimaryButtonClass
                                  : gentleSecondaryButtonClass
                              }
                              disabled={
                                savingTextIntake ||
                                !intakeDraftHasSaveableNotes(textIntakeDraft)
                              }
                              type="submit"
                            >
                              {savingTextIntake ? "Saving..." : "Save notes"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </form>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </div>
    );
  }

  const isSignedInAppShell =
    Boolean(signedInEmail) &&
    sessionProfileLoaded &&
    authMode !== "updatePassword" &&
    !needsBetaAgreement &&
    !needsOnboarding;
  const showingPersonalSetup =
    Boolean(signedInEmail) &&
    sessionProfileLoaded &&
    authMode !== "updatePassword" &&
    (needsBetaAgreement || needsOnboarding || showOnboardingReady);
  const canUseAskPanel =
    isSignedInAppShell ||
    (Boolean(signedInEmail) &&
      authMode !== "updatePassword" &&
      !needsBetaAgreement &&
      needsOnboarding);
  const canShowAskEntry =
    canUseAskPanel && !showWelcomeGuide && !needsOnboarding;
  const isEveryoneFocus = selectedSubjectId === ALL_SUBJECTS;
  const importAnythingOwnerPerson =
    importAnythingOwnerPersonId && importAnythingOwnerPersonId !== ALL_SUBJECTS
      ? subjectsById.get(importAnythingOwnerPersonId) ?? null
      : null;
  const importAnythingFocusPerson =
    selectedSubjectId && selectedSubjectId !== ALL_SUBJECTS
      ? subjectsById.get(selectedSubjectId) ?? null
      : null;
  const importAnythingOwnerNotice = importAnythingOwnerMismatchNotice({
    allSubjectsValue: ALL_SUBJECTS,
    focusPerson: importAnythingFocusPerson
      ? {
          displayName: importAnythingFocusPerson.display_name,
          id: importAnythingFocusPerson.id,
        }
      : null,
    focusPersonId: selectedSubjectId,
    ownerPerson: importAnythingOwnerPerson
      ? {
          displayName: importAnythingOwnerPerson.display_name,
          id: importAnythingOwnerPerson.id,
        }
      : null,
    ownerPersonId: importAnythingOwnerPersonId,
  });
  const importAnythingReviewerFirstName =
    profileDraft.givenName.trim() ||
    profileDraft.displayName.trim().split(/\s+/)[0] ||
    savedProfileLabel.trim().split(/\s+/)[0] ||
    "You";
  const selectedProfileContactPersonId =
    profileContactPersonId ||
    (selectedSubjectId && selectedSubjectId !== ALL_SUBJECTS
      ? selectedSubjectId
      : ACCOUNT_PROFILE_PERSON_ID);
  const locationSheetAppointment =
    locationSheetAppointmentId
      ? appointments.find(
          (appointment) => appointment.id === locationSheetAppointmentId
        ) ??
        (notesReminderAppointment?.id === locationSheetAppointmentId
          ? notesReminderAppointment
          : null)
      : null;
  const locationSheetPracticeLabel = locationSheetAppointment
    ? locationSheetAppointment.provider_organization ||
      locationSheetAppointment.location_name ||
      ""
    : "";
  const locationSheetMapsLink = appointmentGoogleMapsUrl(
    locationSheetAppointment
  );
  const locationSheetDisplayAppointment =
    locationSheetAppointment && !canShowAppointmentAddress(locationSheetAppointment)
      ? { ...locationSheetAppointment, location_address: null }
      : locationSheetAppointment;
  const locationSheetPhoneHref = locationSheetAppointment?.location_phone
    ? `tel:${locationSheetAppointment.location_phone.replace(/[^\d+]/g, "")}`
    : null;
  const isUserFacingTab =
    mainTab === "home" ||
    mainTab === "appointments" ||
    mainTab === "profile";
  const showUserFacingFooter =
    isSignedInAppShell &&
    isUserFacingTab &&
    !(mainTab === "home" && showWelcomeGuide);
  const userFacingFooterBuildInfo = isAdmin
    ? `Build Number ${careplandBuildNumber} * Build dttm: ${careplandBuildDttm}`
    : null;

  if (!sessionRestored || isSignedInProfileLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
        <section className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <Image
              alt="CarePland"
              className="h-auto w-20 sm:w-24"
              height={100}
              priority
              src="/carepland-logo.png"
              width={160}
            />
            <p className="text-sm font-medium text-slate-500">
              Opening CarePland...
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (
    !signedInEmail &&
    authMode !== "updatePassword" &&
    !showAuthGateway &&
    entryHostMode === "public"
  ) {
    return <PublicWebsite onOpenApp={() => setShowAuthGateway(true)} />;
  }

  const adminWorkspaceProps = createAdminWorkspaceProps({
    activeAdminTopTab, adminAccessEvents, adminAttentionFor, adminDashboardFollowupCount,
    adminDashboardNewCount, adminEmailUpdateCurrentEmail, adminEmailUpdateNewEmail, adminEmailUpdateReason,
    adminEmailUpdateResult, adminIntegrationErrorRowKey, adminIntegrationErrorStats, adminIntegrationErrors,
    adminLastViewedAt, adminReadonlyPanelRef, adminReadonlySnapshot, adminRevealedSensitiveData,
    setAdminRecommendationsReviewDraftSummary,
    adminSampleEmail, adminSampleForceDeclined, adminSampleStatus, adminSupportTickets,
    adminTab, adminTabForTopTab, adminTicketCategory, adminTicketChangeNote,
    adminTicketInternalNote, adminTicketNeedsFollowup, adminTicketPriority, adminTicketReplyBody,
    adminTicketStatus, adminUserActivity, adminUserActivityFilter, adminUserActivitySort,
    adminUserActivityStats, agentEscalationGuidance, agentKnowledgeAutomationSettings, agentKnowledgeChangeNote,
    agentKnowledgeCheckRuns, agentKnowledgeProposalDrafts, agentKnowledgeProposalNotes, agentKnowledgeProposalPublishNote,
    agentKnowledgeProposals, agentKnowledgeVersions, agentKnownLimitations, agentProductFacts,
    agentVoiceGuidance, aiAdminTab, aiInstructionVersion, aiInstructionVersions,
    aiOperationCostError, aiOperationCostRangeDays, aiOperationCostSummary, aiOperationCostUserSummary,
    aiOperationCostViewMode, aiWorkflows, allAdminIntegrationErrorsSelected,
    analyzingAssistantReviews, appContentBody, appContentCategories, appContentChangeNote,
    appContentDescription, appContentLabel, appContentOptions, appContentSaveMessage,
    appContentVersions, appSessionSettings, appointments, askModuleLabInput,
    askModuleLabKey, askModuleLabResults, askRecommendationDecisionSummary, askRecommendationDecisions,
    askReviewNote, askReviewRoutingState, askReviewSubmissions, askRoutingSettingsDraft,
    askSubmissionLinks, assistantAnalysisResult, assistantAnalysisRunNote, assistantAnalysisRunStatus,
    assistantAnalysisRuns, assistantInteractionUserLabel, assistantReviewAdminReviews, assistantReviewConfidenceFilter,
    assistantReviewHasFeedbackOnly, assistantReviewInteractions, assistantReviewNote, assistantReviewOutcomeFilter,
    assistantReviewPromptFilter, assistantReviewPromptVersions, assistantReviewRecommendedAction, assistantReviewStatus,
    cancelEditingProductMgmtItem, careSubjects, carePrepHistory, closeAdminReadonlyUserView, createProductItemFromAskRecommendation,
    createSupportTicketFromAskRecommendation, deleteSelectedAdminIntegrationErrors, deletingAdminIntegrationErrors, draftSourceVersion,
    earlyAccessIntakeAdminNotes, earlyAccessIntakeDraft, earlyAccessIntakeFilter, earlyAccessIntakeRows,
    earlyAccessIntakeStats, editingProductMgmtItemId, expandedAdminUserCareVipRows, filteredAdminUserActivity,
    filteredAppContentOptions, filteredAssistantReviewInteractions, filteredEarlyAccessIntakeRows,
    formatDate, formatDateOnly, handleAddAdminInternalNote, handleAddAdminTicketReply,
    handleAdminUpdateUserEmail, handleAnalyzeFilteredAssistantReviews, handleChangeAdminTab, handleChangeAiOperationCostRange, handleChangeAiAdminTab,
    handleChangeAiWorkflow, handleChangeAppContentCategory, handleChangeAppContentKey, handleChangeHistoryAppointment,
    handleChangeProductMgmtSection, handleCreateAssistantAdminReview, handleCreateEarlyAccessIntake, handleCreateProductMgmtArea,
    handleCreateProductMgmtItem, handleLoadAdminSampleStatus, handlePublishAgentKnowledgeProposal, handleQueueAgentKnowledgeManualCheck,
    handleResolveProductMgmtItem, handleRetireProductMgmtArea, handleRevertAppContent, handleRevertInstructionVersion,
    handleReviewAgentKnowledgeProposalItem, handleRunAskModuleLab, handleSaveAgentKnowledge, handleSaveAgentKnowledgeAutomationSettings,
    handleSaveAiInstructions, handleSaveAppContent, handleSaveAppSessionSettings, handleSeedAdminSampleData,
    handleUpdateAdminTicketStatus, handleUpdateAskReview, handleUpdateAskRoutingSettings, handleUpdateAssistantAnalysisRun,
    handleUpdateEarlyAccessIntake, handleUpdateProductMgmtItem, historyAppointmentId, instructionChangeNote,
    instructionModel, instructionOutputSchema, instructionSystemPrompt, instructionUserPrompt,
    intakeHistory, isNewForAdmin, loadAdminAccessEvents, loadAdminAttentionOverview,
    loadAdminIntegrationErrors, loadAdminSupportTickets, loadAdminUserActivity, loadAgentKnowledgeProposals,
    loadAiInstructions, loadAppContent, loadAskReviewSubmissions, loadAssistantReviewInteractions,
    loadCarePrepHistory, loadEarlyAccessIntake, loadInstructionVersionIntoEditor, loadIntakeHistory,
    loadingAdminAccessEvents, loadingAdminIntegrationErrors, loadingAdminReadonlyUserId, loadingAdminSampleStatus,
    loadingAdminTickets, loadingAdminUserActivity, loadingAgentKnowledgeProposals, loadingAiOperationCosts,
    loadingAppContent, loadingAskReviews, loadingAskRoutingSettings, loadingAssistantReviews,
    loadingCarePrepHistory, loadingEarlyAccessIntake, loadingInstructions, loadingProductMgmt,
    newProductMgmtAreaDescription, newProductMgmtAreaLabel, newProductMgmtBody, newProductMgmtChangeNote,
    newProductMgmtPriority, newProductMgmtStatus, newProductMgmtTitle, openAdminReadonlyUserView,
    openAskRelatedItem, openAskSubmissionReview, productMgmtAreas, productMgmtItemDraft,
    productMgmtItems, publishingAgentKnowledgeProposalId, queueingAgentKnowledgeRun, recordAskRecommendationDecision,
    resetAppContentEditor, resolveAskAnswerRecommendation, resolvingProductMgmtItemId, retiringProductMgmtAreaId,
    revealAdminSensitiveData, revealingAdminSensitiveKey, revertingAppContentForId, revertingInstructionForId,
    runningAskModuleLab, sampleDataStatusText, saveAdminContactDetails, savingAdminContactDetails,
    savingAdminTicketReply, savingAdminTicketStatus, savingAgentKnowledge, savingAgentKnowledgeAutomationSettings,
    savingAgentKnowledgeProposalItemId, savingAppContent, savingAppSessionSettings, savingAskReview,
    savingAskReviewAction, savingAskRoutingSettings, savingAssistantAdminReview, savingAssistantAnalysisRunReview,
    savingEarlyAccessIntake, savingInstructions, savingProductMgmtArea, savingProductMgmtEditItemId,
    savingProductMgmtItem, seedingAdminSampleData, selectAdminTicket, selectAskReviewSubmission,
    selectAssistantAnalysisRun, selectedAdminIntegrationErrorKeys, selectedAdminTicket, selectedAdminTicketMessages,
    selectedAgentKnowledgeProposal, selectedAgentKnowledgeProposalItems, selectedAgentKnowledgeProposalPublishableCount, selectedAiWorkflow,
    selectedAiWorkflowConfig, selectedAppContent, selectedAppContentCategory, selectedAppContentCategoryConfig,
    selectedAppContentKey, selectedAskReviewSubmission, selectedAssistantAdminReviews, selectedAssistantAnalysisRun,
    selectedAssistantReviewInteraction, selectedProductMgmtArea, selectedProductMgmtItems, selectedProductMgmtSection,
    selectedProductMgmtSectionConfig, selectedVisibleAdminIntegrationErrorKeys, setAdminEmailUpdateCurrentEmail, setAdminEmailUpdateNewEmail,
    setAdminEmailUpdateReason, setAdminEmailUpdateResult, setAdminSampleEmail, setAdminSampleForceDeclined,
    setAdminSampleStatus, setAdminTicketCategory, setAdminTicketChangeNote, setAdminTicketInternalNote,
    setAdminTicketNeedsFollowup, setAdminTicketPriority, setAdminTicketReplyBody, setAdminTicketStatus,
    setAdminUserActivityFilter, setAgentEscalationGuidance, setAgentKnowledgeAutomationSettings, setAgentKnowledgeChangeNote,
    setAgentKnowledgeProposalDrafts, setAgentKnowledgeProposalNotes, setAgentKnowledgeProposalPublishNote, setAgentKnownLimitations,
    setAgentProductFacts, setAgentVoiceGuidance, setAppContentBody, setAppContentChangeNote,
    setAppContentDescription, setAppContentLabel, setAppSessionSettings, setAskModuleLabInput,
    setAskModuleLabKey, setAskReviewNote, setAskReviewRoutingState, setAskRoutingSettingsDraft,
    setAssistantAnalysisRunNote, setAssistantAnalysisRunStatus, setAssistantReviewConfidenceFilter, setAssistantReviewHasFeedbackOnly,
    setAssistantReviewNote, setAssistantReviewOutcomeFilter, setAssistantReviewPromptFilter, setAssistantReviewRecommendedAction,
    setAssistantReviewStatus, setEarlyAccessIntakeAdminNotes, setEarlyAccessIntakeFilter, setExpandedAdminUserCareVipRows,
    setAiOperationCostViewMode, setInstructionChangeNote, setInstructionModel, setInstructionOutputSchema, setInstructionSystemPrompt,
    setInstructionUserPrompt, setNewProductMgmtAreaDescription, setNewProductMgmtAreaLabel, setNewProductMgmtBody,
    setNewProductMgmtChangeNote, setNewProductMgmtPriority, setNewProductMgmtStatus, setNewProductMgmtTitle,
    setSelectedAgentKnowledgeProposalId, setSelectedAiWorkflow, setSelectedAssistantReviewId, setShowProductMgmtAreaForm,
    showProductMgmtAreaForm, startEditingProductMgmtItem, stickySecondaryOffset,
    supportAdminNavItems, supportAdminTabs, supportAnalysisStatusLabel, systemAdminNavItems,
    systemAdminTabs, toggleAdminIntegrationErrorSelection, toggleAdminUserActivitySort, toggleAllAdminIntegrationErrors,
    topAdminNavItems, updateEarlyAccessIntakeDraft, updateProductMgmtItemDraft, updatingAdminUserEmail,
    updatingEarlyAccessIntakeId, usersAdminNavItems, visibleProductMgmtSections,
  });

  return (
    <main
      className={`min-h-screen overflow-x-clip bg-slate-50 px-3 text-slate-900 sm:px-4 lg:px-6 lg:py-8 ${
        isSignedInAppShell
          ? showUserFacingFooter
            ? "pb-20 pt-2 sm:pt-4"
            : "pb-6 pt-2 sm:pt-4"
          : "py-6"
      }`}
    >
      <section
        className={`mx-auto w-full ${
          isSignedInAppShell
            ? isAdmin
              ? "max-w-5xl 2xl:max-w-6xl"
              : "max-w-[900px]"
            : "max-w-3xl"
        }`}
      >
        <header
          className="sticky top-0 z-50 grid gap-2 bg-slate-50 py-1.5 sm:gap-3 sm:py-3"
          ref={mainHeaderRef}
        >
          {isSignedInAppShell && !showWelcomeGuide ? (
            <CarePlandTopNav
              activeModule={
                mainTab === "admin"
                  ? "admin"
                  : mainTab === "profile"
                    ? "profile"
                    : "appointments"
              }
              accountEmail={signedInEmail}
              askActive={askPanelOpen}
              canShowAdmin={isAdmin}
              canShowAsk={canShowAskEntry}
              earlyAccessLabel={
                signedInEmail && currentPricingTier.id === "early_access"
                  ? currentPricingTier.name
                  : undefined
              }
              environmentLabel={runtimeEnvironmentLabel}
              focusOptions={carePlandFocusOptions}
              focusValue={selectedSubjectId}
              onAdminClick={async () => {
                if (!adminRoute) {
                  window.location.assign("/admin");
                  return;
                }

                await handleChangeMainTab("admin");
              }}
              onAppointmentsClick={async () => {
                if (adminRoute) {
                  window.location.assign("/?personal=1&appointments=1&view=upcoming");
                  return;
                }

                updatePersonalRoute("appointments");
                if (mainTab === "appointments") {
                  handleChangeAppointmentView("upcoming");
                  return;
                }

                if (hasUnsavedWorkForLeave) {
                  await handleChangeMainTab("appointments");
                  return;
                }

                await handleChangeMainTab("appointments");
                applyAppointmentViewChange("upcoming");
              }}
              onAskClick={() => {
                if (askPanelOpen) {
                  requestCloseAskPanel();
                  return;
                }

                if (importAnythingPanelHasUnfinishedWork) {
                  setPendingImportLeaveAction({ kind: "ask" });
                  return;
                }

                updatePersonalRoute("ask");
                setAskPanelOpen(true);
                setAskCloseConfirmOpen(false);
              }}
              onHomeClick={async () => {
                if (adminRoute) {
                  window.location.assign("/?personal=1");
                  return;
                }

                updatePersonalRoute("home");
                await handleChangeMainTab("home");
              }}
              onProfileClick={async () => {
                if (adminRoute) {
                  window.location.assign("/?personal=1&profile=1");
                  return;
                }

                updatePersonalRoute("profile");
                await handleChangeMainTab("profile");
              }}
              onChangeFocus={handleChangeCarePlandFocus}
              onSignOut={() => void handleSignOut()}
              planTierId={currentPricingTier.id}
              primaryAction={
                mainTab === "appointments" || mainTab === "home" ? (
                  <button
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50/80 px-3 text-sm font-semibold leading-none text-blue-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-100 disabled:opacity-60 sm:h-11 sm:px-4"
                    disabled={loading}
                    onClick={() => startAppointmentPanel("quickAdd")}
                    type="button"
                  >
                    + Add
                  </button>
                ) : null
              }
              supportMetrics={
                isAdmin
                  ? [
                      {
                        count: adminNewTickets.length,
                        label: "New",
                        tone: adminNewTickets.length > 0 ? "urgent" : "neutral",
                      },
                      {
                        count: adminTicketsNeedingFollowup.length,
                        label: "f/u",
                        tone:
                          adminTicketsNeedingFollowup.length > 0
                            ? "attention"
                            : "neutral",
                      },
                    ]
                  : []
              }
            />
          ) : (
            <div className="flex min-w-0 items-center gap-2">
              <button
                aria-label="Go to the CarePland website"
                className="shrink-0 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
                onClick={() => {
                  window.location.assign("https://www.carepland.com");
                }}
                type="button"
              >
                <Image
                  alt="CarePland"
                  className="h-auto w-20 sm:w-24"
                  height={100}
                  priority
                  src="/carepland-logo.png"
                  width={160}
                />
              </button>
              {showWelcomeGuide ? (
                <div className="min-w-0 text-[#2B6198]">
                  <h1 className="text-xl font-semibold leading-tight sm:text-2xl">
                    Welcome to CarePland
                  </h1>
                  <p className="mt-1 text-sm font-medium leading-tight sm:text-base">
                    Appointment context, simply.
                  </p>
                </div>
              ) : null}
            </div>
          )}
          {signedInEmail &&
          mainTab === "appointments" &&
          !showWelcomeGuide &&
          !needsBetaAgreement &&
          !needsOnboarding ? (
            <AppointmentViewToolbar
              allSubjectsValue={ALL_SUBJECTS}
              canFilterCareVips={canFilterCareVips}
              careSubjects={careSubjects.map((subject) => ({
                ...subject,
                avatarEmoji:
                  subject.avatarEmoji ?? defaultPetAvatarEmoji(subject),
                managed_by_household: isManagedByHouseholdSubject(subject),
              }))}
              disabled={loading}
              hideOlder={Boolean(activeAppointmentPanel)}
              key={`${appointmentView}-${selectedSubjectId}`}
              onChangeSubject={handleChangeSubject}
              onChangeView={handleChangeAppointmentView}
              selectedSubjectId={selectedSubjectId}
              sticky={false}
              stickyTop={stickySecondaryOffset}
              view={appointmentView}
            />
          ) : null}
	          {adminReadonlySnapshot ? (
	            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-950">
	              <p className="font-semibold">
	                Admin read-only view: you&apos;re viewing{" "}
	                {adminReadonlySnapshot.profile.display_name || "this user"},
	                not your own account.
	              </p>
	              <button
	                className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-900"
	                onClick={closeAdminReadonlyUserView}
	                type="button"
	              >
	                Exit view
	              </button>
	            </div>
	          ) : null}
	        </header>

        {authMode === "updatePassword" ? (
          <PasswordUpdatePanel
            canSubmitAuth={canSubmitAuth}
            confirmPassword={confirmPassword}
            loading={loading}
            message={message}
            onBackToSignIn={() => {
              setAuthMode("signIn");
              setPassword("");
              setConfirmPassword("");
              clearAuthRedirectUrl();
              setMessage("");
            }}
            onChangeConfirmPassword={setConfirmPassword}
            onChangePassword={setPassword}
            onClearMessage={() => setMessage("")}
            onSubmit={handleUpdatePassword}
            password={password}
            passwordsMismatch={passwordsMismatch}
          />
        ) : needsBetaAgreement || needsOnboarding || showOnboardingReady ? (
          <OnboardingGate
            acceptBetaDisclaimer={acceptBetaDisclaimer}
            acceptBetaPrivacy={acceptBetaPrivacy}
            acceptBetaTerms={acceptBetaTerms}
            appContentText={appContentText}
            loading={loading}
            message={message}
            needsBetaAgreement={needsBetaAgreement}
            needsOnboarding={needsOnboarding}
            onAcceptBetaAgreement={handleAcceptBetaAgreement}
            onImportAnything={() => {
              setShowOnboardingReady(false);
              startAppointmentPanel("quickAdd");
            }}
            onChangeProfileField={updateProfileDraft}
            onChangeProfilePhone={(value) =>
              updateProfileDraft(
                "phone",
                formatUsPhoneFromDigits(phoneDigits(value))
              )
            }
            onChangeProfileZip={(value) =>
              updateProfileDraft(
                "postalCode",
                formatUsZipFromDigits(zipDigits(value))
              )
            }
            getPlacesAuthHeaders={placesAuthHeader}
            onApplyProfileAddress={applyProfileAddress}
            onSaveProfile={handleSaveProfile}
            onSetAcceptBetaDisclaimer={setAcceptBetaDisclaimer}
            onSetAcceptBetaPrivacy={setAcceptBetaPrivacy}
            onSetAcceptBetaTerms={setAcceptBetaTerms}
            onOpenCarePland={() => {
              setShowOnboardingReady(false);
              setMainTab("home");
            }}
            onOpenReceiver={() => {
              window.open(
                "/connect/receiver/setup?new=1",
                "_blank",
                "noopener,noreferrer"
              );
            }}
            onReviewStep={() => {
              setShowOnboardingReady(false);
            }}
            onSignOut={() => void handleSignOut()}
            profileDetailsRequired={profileDetailsRequired}
            profileDraft={profileDraft}
            receiverConfigured={hasConfiguredReceiver}
            requiresEmailUpdate={requiresEmailUpdate}
            savingProfile={savingProfile}
            showReady={showOnboardingReady}
            timezoneDetectionMessage={timezoneDetectionMessage}
            timeZoneOptions={timeZoneOptions}
            verifiedAccountEmail={verifiedAccountEmail}
          />
        ) : signedInEmail && mainTab === "home" ? (
          renderHomeView()
        ) : signedInEmail && mainTab === "profile" ? (
          <ProfilePage
            accountSummaryProps={{
              actualPricingTier,
              canAddCareVip,
              careSubjects,
              careVipFormMessage,
              careVipLimit,
              creatingCareVip,
              currentPlanFeatureRows,
              currentPlanSummary,
              currentPricingTier,
              deactivatingCareVipId,
              entitlementPlanName: entitlement.plan_name,
              isAdmin,
              isPreviewingPlan,
              newCareVipName,
              onAddDemoData: () => handleSeedSampleDataForCurrentUser(true),
              onChangeNewCareVipName: (value) => {
                setNewCareVipName(value);
                setCareVipFormMessage("");
                setPendingReactivateCareVip(null);
              },
              onChangePlanPreview: (selectedTierId) => {
                setAdminPlanPreviewId(
                  selectedTierId === actualPricingTier.id
                    ? ""
                    : selectedTierId
                );
                setPlanHelpExpanded(true);
              },
              onClearPendingReactivateCareVip: () => {
                setPendingReactivateCareVip(null);
                setNewCareVipName("");
              },
              onCreateCareVip: handleCreateCareVip,
              onDeactivateCareVip: (subject) => {
                void handleDeactivateCareVip(subject);
              },
              onReactivateCareVip: () => void handleReactivateCareVip(),
              onRemoveDemoData: handleRemoveSampleData,
              onRequestDeactivateCareVip: setPendingDeactivateCareVipId,
              onSendPasswordReset: handleSendProfilePasswordReset,
              pendingDeactivateCareVipId,
              pendingReactivateCareVip,
              planHelpExpanded,
              pricingTiers,
              removingSampleData,
              sampleDataSeededAt,
              seedingSampleData,
              sendingPasswordReset,
              setPlanHelpExpanded,
            }}
            canShowAdminItems={canShowAdminItems}
            contactDetailsProps={{
              accountPersonId: ACCOUNT_PROFILE_PERSON_ID,
              getPlacesAuthHeaders: placesAuthHeader,
              onApplyProfileAddress: applyProfileAddress,
              hasUnsavedProfileChanges,
              onChangeField: updateProfileDraft,
              onChangePhone: (value) =>
                updateProfileDraft(
                  "phone",
                  formatUsPhoneFromDigits(phoneDigits(value))
                ),
              onChangeZip: (value) =>
                updateProfileDraft(
                  "postalCode",
                  formatUsZipFromDigits(zipDigits(value))
                ),
              onChangeSelectedPersonId: setProfileContactPersonId,
              onRenamePerson: handleRenameProfilePerson,
              onRemoveAvatar: handleRemoveProfileAvatar,
              onSubmit: handleSaveProfile,
              onUpdateManagedByHousehold: handleUpdateProfilePersonManagedByHousehold,
              onUpdatePetType: handleUpdateProfilePersonType,
              onUploadAvatar: handleUploadProfileAvatar,
              primaryButtonClassName: gentlePrimaryButtonClass,
              profileContactPeople: [
                {
                  displayName:
                    profileDraft.displayName.trim() ||
                    [profileDraft.givenName, profileDraft.familyName]
                      .filter(Boolean)
                      .join(" ")
                      .trim() ||
                    savedProfileLabel ||
                    signedInEmail ||
                    "You",
                  id: ACCOUNT_PROFILE_PERSON_ID,
                  label: "You",
                },
                ...careSubjects.map((subject) => {
                  const defaultAvatarEmoji = defaultPetAvatarEmoji(subject);

                  return {
                    avatarAltText: subject.avatarAltText,
                    avatarEmoji: subject.avatarEmoji ?? defaultAvatarEmoji,
                    avatarIsDefault:
                      subject.avatarIsDefault ??
                      Boolean(defaultAvatarEmoji && !subject.avatarUrl),
                    avatarPersonId: subject.id,
                    avatarType: subject.avatarType,
                    avatarUrl: subject.avatarUrl,
                    displayName: subject.display_name,
                    id: subject.id,
                    managedByHousehold: isManagedByHouseholdSubject(subject),
                    subjectType: subject.subject_type,
                  };
                }),
              ],
              profileDetailsRequired,
              profileDraft,
              requiresEmailUpdate,
              selectedPersonId: selectedProfileContactPersonId,
              savingProfile,
              secondaryButtonClassName: gentleSecondaryButtonClass,
              timezoneDetectionMessage,
              timeZoneOptions,
              verifiedAccountEmail,
            }}
            message={message}
          />
        ) : signedInEmail && mainTab === "admin" && isAdmin ? (
          <AdminWorkspace {...adminWorkspaceProps} />
        ) : (
        <div className="mt-8 space-y-4">
          <aside
            className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${
              signedInEmail ? "hidden" : "mx-auto max-w-xl"
            }`}
          >
            <AuthGatewayPanel
              authMode={authMode}
              canSubmitAuth={canSubmitAuth}
              confirmPassword={confirmPassword}
              email={email}
              gentlePrimaryButtonClass={gentlePrimaryButtonClass}
              gentleSecondaryButtonClass={gentleSecondaryButtonClass}
              loading={loading}
              message={message}
              onChangeAuthMode={setAuthMode}
              onChangeConfirmPassword={setConfirmPassword}
              onChangeEmail={setEmail}
              onChangePassword={setPassword}
              onClearMessage={() => setMessage("")}
              onGoogleSignIn={handleGoogleSignIn}
              onPasswordReset={handlePasswordReset}
              onSignIn={handleSignIn}
              onSignUp={handleSignUp}
              password={password}
              passwordsMismatch={passwordsMismatch}
              signedInEmail={signedInEmail}
            />

            {signedInEmail && canUseMultipleCareVips ? (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">View Care VIP</h2>
                  <button
                    className="text-sm font-semibold italic text-amber-800"
                    onClick={() =>
                      setManagingCareVips((isManaging) => !isManaging)
                    }
                    type="button"
                  >
                    {managingCareVips ? "Done" : "Manage"}
                  </button>
                </div>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Showing
                  <select
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                    disabled={loading || careSubjects.length === 0}
                    onChange={(event) => handleChangeSubject(event.target.value)}
                    value={selectedSubjectId}
                  >
                    <option value={ALL_SUBJECTS}>All Care VIPs</option>
                    {careSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {careSubjectDisplayLabel(subject)}
                      </option>
                    ))}
                  </select>
                </label>

                {managingCareVips ? (
                  <form
                    className="mt-5 rounded-md bg-slate-50 p-4"
                    onSubmit={handleCreateCareVip}
                  >
                    <h3 className="font-semibold text-slate-900">Add Care VIP</h3>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Name
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        disabled={!canAddCareVip}
                        onChange={(event) => setNewCareVipName(event.target.value)}
                        placeholder="e.g. Dixie"
                        type="text"
                        value={newCareVipName}
                      />
                    </label>
                    <button
                      className={`mt-4 w-full ${gentleSoftBlueButtonClass}`}
                      disabled={creatingCareVip || !canAddCareVip}
                      type="submit"
                    >
                      {creatingCareVip ? "Adding..." : "+ Add Care VIP"}
                    </button>
                    {!canAddCareVip ? (
                      <p className="mt-3 text-sm text-slate-500">
                        {entitlement.plan_name} includes {careVipLimit} active
                        Care VIPs.
                      </p>
                    ) : null}
                  </form>
                ) : null}
              </div>
            ) : null}

            {signedInEmail ? (
              <section className="mt-6 border-t border-slate-200 pt-6">
                <form onSubmit={handleInterpretTextIntake}>
                  <h2 className="text-xl font-semibold">Paste intake</h2>
                  {canUseMultipleCareVips ? (
                    <label className="mt-4 block text-sm font-medium text-slate-700">
                      Who is this for?
                      <select
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                        disabled={careSubjects.length === 0}
                        onChange={(event) =>
                          setTextIntakeSubjectId(event.target.value)
                        }
                        value={textIntakeSubjectId}
                      >
                        {careSubjects.length === 0 ? (
                          <option value="">No Care VIPs found</option>
                        ) : null}
                        {careSubjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {careSubjectDisplayLabel(subject)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Text
                    <textarea
                      className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                      onChange={(event) => setTextIntakeValue(event.target.value)}
                      placeholder="Paste appointment details, portal text, or visit notes."
                      value={textIntakeValue}
                    />
                  </label>
                  <button
                    className="mt-4 w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                    disabled={processingTextIntake}
                    type="submit"
                  >
                    {processingTextIntake ? "Interpreting..." : "Interpret text"}
                  </button>
                </form>

                {textIntakeDraft && !textIntakeTargetAppointmentId ? (
                  <form
                    className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4"
                    onSubmit={handleSaveTextIntakeDraft}
                  >
                    <h3 className="font-semibold text-blue-950">
                      Review intake draft
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <AIReviewBadge confidence={textIntakeDraft.confidence} />
                      {textIntakeDraft.suggestedAction ? (
                        <p className="text-xs text-blue-800">
                          {textIntakeDraft.suggestedAction}
                        </p>
                      ) : null}
                    </div>
                    {textIntakeMatches.length > 0 ? (
                      <div className="mt-4 rounded-md border border-blue-200 bg-white p-3">
                        <h4 className="font-semibold text-slate-900">
                          This may belong to an existing appointment
                        </h4>
                        <p className="mt-1 text-sm text-slate-600">
                          Choose a match to update its notes, or create a new
                          logged appointment.
                        </p>
                        <div className="mt-3 space-y-3">
                          {textIntakeMatches.map((match) => (
                            <label
                              className="block rounded-md border border-slate-200 bg-slate-50 p-3"
                              key={match.appointment.id}
                            >
                              <span className="flex items-start gap-3">
                                <input
                                  checked={
                                    selectedTextIntakeMatchId ===
                                    match.appointment.id
                                  }
                                  className="mt-1"
                                  name="text-intake-match"
                                  onChange={() =>
                                    setSelectedTextIntakeMatchId(
                                      match.appointment.id
                                    )
                                  }
                                  type="radio"
                                  value={match.appointment.id}
                                />
                                <span>
                                  <span className="block font-semibold text-slate-900">
                                    {match.appointment.title ?? "Untitled appointment"}
                                  </span>
                                  <span className="mt-1 block text-sm text-slate-600">
                                    {formatDate(match.appointment.starts_at)} ·{" "}
                                    {match.appointment.status}
                                    {match.currentNote ? " · already has notes" : ""}
                                  </span>
                                  <span className="mt-1 block text-xs text-slate-500">
                                    Why: {match.reasons.join(", ")}
                                  </span>
                                  {match.currentNote?.summary_short ? (
                                    <span className="mt-2 block text-sm text-slate-700">
                                      Current notes:{" "}
                                      {match.currentNote.summary_short.slice(0, 140)}
                                      {match.currentNote.summary_short.length > 140
                                        ? "..."
                                        : ""}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                            </label>
                          ))}
                          <label className="block rounded-md border border-slate-200 bg-white p-3">
                            <span className="flex items-start gap-3">
                              <input
                                checked={selectedTextIntakeMatchId === "new"}
                                className="mt-1"
                                name="text-intake-match"
                                onChange={() => setSelectedTextIntakeMatchId("new")}
                                type="radio"
                                value="new"
                              />
                              <span>
                                <span className="block font-semibold text-slate-900">
                                  Create a new appointment
                                </span>
                                <span className="mt-1 block text-sm text-slate-600">
                                  Use the reviewed draft below as a new logged
                                  appointment.
                                </span>
                              </span>
                            </span>
                          </label>
                        </div>
                      </div>
                    ) : null}
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Title
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          updateTextIntakeDraft(
                            "appointmentTitle",
                            event.target.value
                          )
                        }
                        value={textIntakeDraft.appointmentTitle}
                      />
                    </label>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Date & time
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          updateTextIntakeDraft("startsAt", event.target.value)
                        }
                        type="datetime-local"
                        value={textIntakeDraft.startsAt}
                      />
                    </label>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Provider
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          updateTextIntakeDraft("providerName", event.target.value)
                        }
                        value={textIntakeDraft.providerName}
                      />
                    </label>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Practice
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          updateTextIntakeDraft(
                            "providerOrganization",
                            event.target.value
                          )
                        }
                        value={textIntakeDraft.providerOrganization}
                      />
                    </label>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Location name
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          updateTextIntakeDraft("locationName", event.target.value)
                        }
                        value={textIntakeDraft.locationName}
                      />
                    </label>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Address
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          updateTextIntakeDraft(
                            "locationAddress",
                            event.target.value
                          )
                        }
                        value={textIntakeDraft.locationAddress}
                      />
                    </label>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Phone
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          updateTextIntakeDraft("locationPhone", event.target.value)
                        }
                        value={textIntakeDraft.locationPhone}
                      />
                    </label>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Reason
                      <textarea
                        className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          updateTextIntakeDraft(
                            "appointmentReason",
                            event.target.value
                          )
                        }
                        value={textIntakeDraft.appointmentReason}
                      />
                    </label>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Notes summary
                      <textarea
                        className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          updateTextIntakeDraft("notesSummary", event.target.value)
                        }
                        value={textIntakeDraft.notesSummary}
                      />
                    </label>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Takeaways
                      <textarea
                        className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          updateTextIntakeDraft("takeaways", event.target.value)
                        }
                        value={textIntakeDraft.takeaways}
                      />
                    </label>
                    <label className="mt-3 block text-sm font-medium text-slate-700">
                      Follow-ups
                      <textarea
                        className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          updateTextIntakeDraft("followups", event.target.value)
                        }
                        value={textIntakeDraft.followups}
                      />
                    </label>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        className={gentlePrimaryButtonClass}
                        disabled={savingTextIntake}
                        type="submit"
                      >
                        {savingTextIntake ? "Saving..." : "Save intake"}
                      </button>
                      <button
                        className={gentleSecondaryButtonClass}
                        onClick={() => {
                          cancelTextIntake();
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </section>
            ) : null}

            {signedInEmail ? (
              <form
                className="mt-6 border-t border-slate-200 pt-6"
                onSubmit={handleCreateAppointment}
              >
                <h2 className="text-xl font-semibold">Add appointment</h2>
                {canUseMultipleCareVips ? (
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Who is this for?
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                      disabled={careSubjects.length === 0}
                      onChange={(event) =>
                        setNewAppointmentSubjectId(event.target.value)
                      }
                      value={newAppointmentSubjectId}
                    >
                      {careSubjects.length === 0 ? (
                        <option value="">No Care VIPs found</option>
                      ) : null}
                      {careSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {careSubjectDisplayLabel(subject)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {renderPlaceLookup("mt-4")}
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Title
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                    onChange={(event) => setNewAppointmentTitle(event.target.value)}
                    placeholder="e.g. Follow-up with Dr. Smith"
                    type="text"
                    value={newAppointmentTitle}
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Date & time
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                    onChange={(event) =>
                      setNewAppointmentStartsAt(event.target.value)
                    }
                    type="datetime-local"
                    value={newAppointmentStartsAt}
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Provider
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                    onChange={(event) =>
                      setNewAppointmentProviderName(event.target.value)
                    }
                    placeholder="e.g. Dr. Smith"
                    type="text"
                    value={newAppointmentProviderName}
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Practice
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                    onChange={(event) =>
                      setNewAppointmentProviderOrganization(event.target.value)
                    }
                    placeholder="e.g. Main Street Clinic"
                    type="text"
                    value={newAppointmentProviderOrganization}
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Address
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                    onChange={(event) =>
                      setNewAppointmentLocationAddress(event.target.value)
                    }
                    placeholder="Street, city, state"
                    type="text"
                    value={newAppointmentLocationAddress}
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Reason
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                    onChange={(event) => setNewAppointmentReason(event.target.value)}
                    placeholder="What is this appointment for?"
                    value={newAppointmentReason}
                  />
                </label>
                <button
                  className={`mt-4 w-full ${gentlePrimaryButtonClass}`}
                  disabled={creatingAppointment}
                  type="submit"
                >
                  {creatingAppointment ? "Adding..." : "Add appointment"}
                </button>
              </form>
            ) : null}

            {signedInEmail && message ? (
              <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            ) : null}

          </aside>

          <div className="space-y-4">
            {toast ? (
              <div
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm shadow-sm ${
	                  toast.type === "success"
	                    ? "border-blue-200 bg-[#f4faff] text-blue-950"
                    : toast.type === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-950"
                      : toast.type === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-950"
	                        : "border-blue-200 bg-[#f4faff] text-blue-950"
                }`}
              >
                <span className="font-medium">{toast.message}</span>
                <span className="flex flex-wrap gap-2">
                  {toast.actionLabel && toast.onAction ? (
                    <button
                      className="rounded-md bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200"
                      onClick={() => {
                        toast.onAction?.();
                        setToast(null);
                      }}
                      type="button"
                    >
                      {toast.actionLabel}
                    </button>
                  ) : null}
                  <button
                    aria-label="Dismiss message"
                    className="rounded-md bg-white px-3 py-1 font-semibold text-slate-500 ring-1 ring-slate-200"
                    onClick={() => setToast(null)}
                    type="button"
                  >
                    Dismiss
                  </button>
                </span>
              </div>
            ) : null}

            {signedInEmail && autoCarePrepStatus ? (
	              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-200 bg-[#f4faff] p-3 text-sm font-medium text-blue-950 shadow-sm">
                <span>{autoCarePrepStatus.message}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <button
	                    className="rounded-md bg-white px-3 py-1 font-semibold text-blue-800 ring-1 ring-blue-200 hover:bg-blue-50"
                    onClick={() =>
                      focusAppointmentCarePrep(autoCarePrepStatus.appointmentId)
                    }
                    type="button"
                  >
                    View appointment
                  </button>
                  <button
                    aria-label="Dismiss automatic CarePrep status"
	                    className="rounded-md bg-white px-3 py-1 font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50"
                    onClick={() => setAutoCarePrepStatus(null)}
                    type="button"
                  >
                    Dismiss
                  </button>
                </span>
              </div>
            ) : null}

            {signedInEmail && message ? (
              <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            ) : null}

            {signedInEmail &&
            !needsBetaAgreement &&
            !needsOnboarding &&
            (hasUpdatedSupportQuestion ||
              askingSupportQuestion ||
              supportQuestionExpanded) ? (
              <section
                className={`rounded-lg border p-3 shadow-sm ${
                  hasUpdatedSupportQuestion
                    ? "border-amber-200 bg-amber-50 text-amber-950"
                    : currentSupportTicket
                      ? "border-slate-200 bg-slate-100 text-slate-800"
                      : askingSupportQuestion
                        ? "border-blue-200 bg-blue-50 text-blue-950"
                        : "border-slate-200 bg-white text-slate-800"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {hasUpdatedSupportQuestion
                          ? "We have more info about your question."
                        : currentSupportTicket
                          ? "You have an open question."
                          : "Need a hand? Ask a question"}
                    </p>
                    {currentSupportTicket ? (
                      <p className="mt-1 text-sm opacity-80">
                        {currentSupportTicket.subject}
                      </p>
                    ) : askingSupportQuestion ? (
                      <p className="mt-1 text-sm opacity-80">
                        Tell us what happened or what you were trying to do.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={gentleSmallSecondaryButtonClass}
                      onClick={() => {
                        setSupportQuestionExpanded((isExpanded) => !isExpanded);
                        if (currentSupportTicket?.user_has_unread_update) {
                          void handleMarkSupportQuestionSeen(currentSupportTicket);
                        }
                      }}
                      type="button"
                    >
                      {supportQuestionExpanded ? "Hide" : currentSupportTicket ? "More" : "Ask a question"}
                    </button>
                    {currentSupportTicket ? (
                      <button
                        className={gentleSmallSecondaryButtonClass}
                        onClick={() => {
                          setAskingSupportQuestion(true);
                          setSupportQuestionExpanded(true);
                          setSupportAssistantResult(null);
                          setSupportAssistantFeedback("");
                          setSupportAssistantFeedbackMode(null);
                          setSupportAssistantResolution(null);
                        }}
                        type="button"
                      >
                        Ask another
                      </button>
                    ) : null}
                  </div>
                </div>

                {supportQuestionExpanded ? (
                  <div className="mt-3 rounded-md border border-white/70 bg-white p-3 text-slate-800">
                    {currentSupportTicket && !askingSupportQuestion ? (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-950">
                              {currentSupportTicket.subject}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                              {currentSupportTicket.status.replace("_", " ")} · updated {formatDate(currentSupportTicket.updated_at)}
                            </p>
                          </div>
                          <button
                            className={gentleSmallSecondaryButtonClass}
                            onClick={() => {
                              setAskingSupportQuestion(true);
                              setSupportAssistantResult(null);
                              setSupportAssistantFeedback("");
                              setSupportAssistantFeedbackMode(null);
                              setSupportAssistantResolution(null);
                            }}
                            type="button"
                          >
                            New question
                          </button>
                        </div>
                        {latestVisibleSupportMessage ? (
                          <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                            <p className="font-semibold text-slate-900">
                              {latestVisibleSupportMessage.author_role === "admin"
                                ? "CarePland replied"
                                : "You wrote"}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">
                              {latestVisibleSupportMessage.message_body}
                            </p>
                          </div>
                        ) : null}
                        <form className="mt-3" onSubmit={handleAddSupportReply}>
                          <label className="block text-sm font-medium text-slate-700">
                            Add a comment
                            <textarea
                              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              disabled={savingSupportReply}
                              onChange={(event) =>
                                setSupportReplyBody(event.target.value)
                              }
                              placeholder="Add a quick follow-up or let us know whether this helped."
                              value={supportReplyBody}
                            />
                          </label>
                          <button
                            className={`mt-2 ${gentlePrimaryButtonClass} text-sm`}
                            disabled={savingSupportReply || !supportReplyBody.trim()}
                            type="submit"
                          >
                            {savingSupportReply ? "Sending..." : "Send comment"}
                          </button>
                        </form>
                      </div>
                    ) : (
                      <form onSubmit={handleAskSupportAssistant}>
                        <h2 className="text-lg font-semibold text-slate-950">
                          Ask a question
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          Tell us what happened or what you were trying to do.
                        </p>
                        {!supportAssistantResult ? (
                          <>
                            <label className="mt-3 block text-sm font-medium text-slate-700">
                              Short subject
                              <input
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                disabled={savingSupportQuestion || askingSupportAssistant}
                                onChange={(event) =>
                                  setSupportQuestionSubject(event.target.value)
                                }
                                placeholder="e.g. I cannot save an appointment"
                                required
                                value={supportQuestionSubject}
                              />
                            </label>
                            <label className="mt-3 block text-sm font-medium text-slate-700">
                              Details
                              <textarea
                                className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                disabled={savingSupportQuestion || askingSupportAssistant}
                                onChange={(event) =>
                                  setSupportQuestionBody(event.target.value)
                                }
                                placeholder="What did you expect? What happened instead?"
                                required
                                value={supportQuestionBody}
                              />
                            </label>
                          </>
                        ) : (
                          <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                            <p className="font-semibold text-slate-900">
                              {supportQuestionSubject}
                            </p>
                            <p className="mt-1 line-clamp-2 whitespace-pre-wrap">
                              {supportQuestionBody}
                            </p>
                          </div>
                        )}

                        {supportAssistantResult ? (
                          <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-slate-800">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-slate-950">
                                  CarePland assistant
                                </p>
                                <div className="mt-2">
                                  <AIReviewBadge confidence={supportAssistantResult.confidence} />
                                </div>
                              </div>
                              {supportAssistantResult.escalationRecommended ? (
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                                  May need review
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-3 whitespace-pre-wrap">
                              {supportAssistantResult.answer}
                            </p>
                            {supportAssistantResult.suggestedNextStep ? (
                              <p className="mt-3 font-semibold text-slate-900">
                                {supportAssistantResult.suggestedNextStep}
                              </p>
                            ) : null}
                            {supportAssistantResult.escalationReason ? (
                              <p className="mt-2 text-xs text-slate-600">
                                Review note: {supportAssistantResult.escalationReason}
                              </p>
                            ) : null}

                            {supportAssistantResolution === "not_helpful_saved" ? (
                              <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                                <p className="font-semibold text-slate-950">
                                  Thank you for submitting this.
                                </p>
                                <p className="mt-1">
                                  We use this information to improve the quality of CarePland answers. If this still needs attention, send it for review.
                                </p>
                              </div>
                            ) : null}

                            {supportAssistantFeedbackMode === "not_helpful" ? (
                              <label className="mt-3 block font-medium text-slate-700">
                                {appContentText("support_missing_feedback_prompt")}
                                <textarea
                                  className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                  disabled={savingSupportAssistantFeedback || savingSupportQuestion}
                                  onChange={(event) =>
                                    setSupportAssistantFeedback(event.target.value)
                                  }
                                  placeholder="Optional"
                                  value={supportAssistantFeedback}
                                />
                              </label>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-2">
                              {!supportAssistantFeedbackMode && !supportAssistantResolution ? (
                                <>
                                  <button
                                    className={gentleSmallSecondaryButtonClass}
                                    disabled={savingSupportAssistantFeedback}
                                    onClick={() => handleSupportAssistantFeedback("helpful")}
                                    type="button"
                                  >
                                    Helpful
                                  </button>
                                  <button
                                    className={gentleSmallSecondaryButtonClass}
                                    disabled={savingSupportAssistantFeedback}
                                    onClick={() => {
                                      setSupportAssistantFeedbackMode("not_helpful");
                                      setSupportAssistantResolution(null);
                                    }}
                                    type="button"
                                  >
                                    Not helpful
                                  </button>
                                </>
                              ) : null}
                              {supportAssistantFeedbackMode === "not_helpful" ? (
                                <button
                                  className={gentleSmallBlueButtonClass}
                                  disabled={savingSupportAssistantFeedback}
                                  onClick={() => handleSupportAssistantFeedback("not_helpful")}
                                  type="button"
                                >
                                  {savingSupportAssistantFeedback ? "Saving..." : "Save feedback"}
                                </button>
                              ) : null}
                              {supportAssistantFeedbackMode === "not_helpful" ? (
                                <button
                                  className={gentleSmallSecondaryButtonClass}
                                  disabled={savingSupportAssistantFeedback || savingSupportQuestion}
                                  onClick={() => {
                                    setSupportAssistantFeedbackMode(null);
                                    setSupportAssistantFeedback("");
                                  }}
                                  type="button"
                                >
                                  Back
                                </button>
                              ) : null}
                              {supportAssistantResolution === "not_helpful_saved" ? (
                                <button
                                  className={gentleSmallSecondaryButtonClass}
                                  disabled={savingSupportQuestion}
                                  onClick={() => {
                                    setSupportQuestionSubject("");
                                    setSupportQuestionBody("");
                                    setSupportAssistantResult(null);
                                    setSupportAssistantFeedback("");
                                    setSupportAssistantFeedbackMode(null);
                                    setSupportAssistantResolution(null);
                                    setAskingSupportQuestion(false);
                                    setSupportQuestionExpanded(false);
                                  }}
                                  type="button"
                                >
                                  Done
                                </button>
                              ) : null}
                              {supportAssistantResolution !== "helpful" ? (
                                <button
                                className={gentleSmallBlueButtonClass}
                                disabled={savingSupportQuestion}
                                onClick={handleEscalateSupportAssistant}
                                type="button"
                              >
                                {savingSupportQuestion ? "Sending..." : "Send for review"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {!supportAssistantResult ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            className={`${gentlePrimaryButtonClass} text-sm`}
                            disabled={
                              askingSupportAssistant ||
                              !supportQuestionSubject.trim() ||
                              !supportQuestionBody.trim()
                            }
                            type="submit"
                          >
                            {askingSupportAssistant ? "Checking..." : "Ask the CarePland Assistant"}
                          </button>
                          {currentSupportTicket ? (
                            <button
                              className={`${gentleSecondaryButtonClass} text-sm`}
                              disabled={savingSupportQuestion}
                              onClick={() => setAskingSupportQuestion(false)}
                              type="button"
                            >
                              Back to open question
                            </button>
                          ) : null}
                          </div>
                        ) : null}
                      </form>
                    )}
                  </div>
                ) : null}
              </section>
            ) : null}

            {signedInEmail &&
            mainTab === "appointments" &&
            activeAppointmentPanel ? (
              <section
                className={
                  activeAppointmentPanel === "add" ||
                  activeAppointmentPanel === "quickAdd"
                    ? "-mt-4"
                    : "rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                }
              >
                {activeAppointmentPanel === "add" ? (
                  <form
                    className="grid gap-4 md:grid-cols-2"
                    onSubmit={handleCreateAppointment}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                      <h2 className="text-xl font-semibold text-slate-950">
                        Add Appointment
                      </h2>
                      <button
                        className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 hover:text-blue-900"
                        onClick={() => startAppointmentPanel("quickAdd")}
                        type="button"
                      >
                        Import
                      </button>
                    </div>
                    {canUseMultipleCareVips ? (
                      <label className="block text-base font-medium text-slate-700">
                        Who is this for?
                        <select
                          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                          disabled={careSubjects.length === 0}
                          onChange={(event) =>
                            setNewAppointmentSubjectId(event.target.value)
                          }
                          value={newAppointmentSubjectId}
                        >
                          {careSubjects.length === 0 ? (
                            <option value="">No Care VIPs found</option>
                          ) : null}
                          {careSubjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {careSubjectDisplayLabel(subject)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="block text-base font-medium text-slate-700">
                      Appointment Title
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                        onChange={(event) =>
                          setNewAppointmentTitle(event.target.value)
                        }
                        placeholder="e.g. Follow-up with Dr. Smith"
                        type="text"
                        value={newAppointmentTitle}
                      />
                    </label>
                    <label className="block text-base font-medium text-slate-700">
                      Date & Time
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                        onChange={(event) =>
                          setNewAppointmentStartsAt(event.target.value)
                        }
                        type="datetime-local"
                        value={newAppointmentStartsAt}
                      />
                    </label>
                    {renderPlaceLookup("", {
                      helperText: "",
                      label: "Location",
                      placeholder: "Type your address here",
                      plain: true,
                    })}
                    <label className="block text-base font-medium text-slate-700">
                      Provider
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                        onChange={(event) =>
                          setNewAppointmentProviderName(event.target.value)
                        }
                        placeholder="e.g. Dr. Smith"
                        type="text"
                        value={newAppointmentProviderName}
                      />
                    </label>
                    <label className="block text-base font-medium text-slate-700">
                      Practice
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                        onChange={(event) =>
                          setNewAppointmentProviderOrganization(
                            event.target.value
                          )
                        }
                        placeholder="e.g. Main Street Clinic"
                        type="text"
                        value={newAppointmentProviderOrganization}
                      />
                    </label>
                    <label className="block text-base font-medium text-slate-700 md:col-span-2">
                      Reason
                      <textarea
                        className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                        onChange={(event) =>
                          setNewAppointmentReason(event.target.value)
                        }
                        placeholder="What is this appointment for?"
                        value={newAppointmentReason}
                      />
                    </label>
                    <div className="flex flex-wrap gap-3 md:col-span-2">
                      <button
                        className={gentlePrimaryButtonClass}
                        disabled={creatingAppointment || !canCreateNewAppointment}
                        type="submit"
                      >
                        {creatingAppointment ? "Adding..." : "Add appointment"}
                      </button>
                      <button
                        className={gentleSecondaryButtonClass}
                        onClick={() => {
                          resetPlaceLookup();
                          setActiveAppointmentPanel(null);
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}

                {activeAppointmentPanel === "quickAdd" ? (
                  <section
                    className={`transition-colors ${
                      importAnythingDragActive || fileImportStatus
                        ? "rounded-md bg-blue-50/70 p-4"
                        : ""
                    }`}
                    onDragEnter={handleImportAnythingDrag}
                    onDragLeave={handleImportAnythingDrag}
                    onDragOver={handleImportAnythingDrag}
                    onDrop={handleImportAnythingDrop}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-semibold text-slate-950">
                          {importAnythingItems.length > 0
                            ? "Import complete."
                            : "Import Anything"}
                        </h2>
                        {importAnythingItems.length === 0 ? (
                          <span className="text-sm font-medium text-slate-500">
                            CarePland will figure it out.
                          </span>
                        ) : null}
                      </div>
                      {importAnythingItems.length === 0 ? (
                        <button
                          className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 hover:text-blue-900 disabled:cursor-not-allowed disabled:text-slate-400"
                          disabled={Boolean(fileImportStatus)}
                          onClick={() => startAppointmentPanel("add")}
                          type="button"
                        >
                          Manual entry
                        </button>
                      ) : null}
                    </div>

                    {importAnythingOwnerNotice ? (
                      <div className="mt-3 rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                        <p>{importAnythingOwnerNotice.message}</p>
                        <button
                          className="mt-2 rounded-md px-2 py-1 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 hover:text-amber-950"
                          onClick={changeImportAnythingOwnerToCurrentFocus}
                          type="button"
                        >
                          {importAnythingOwnerNotice.actionLabel}
                        </button>
                      </div>
                    ) : null}

                    {importAnythingItems.length > 0 ? (
                      <section className="mt-5 text-sm text-slate-700">
                        <p className="font-semibold text-slate-800">
                          Source:
                        </p>
                        <ul className="mt-1 space-y-1">
                          <li>
                            • {textIntakeValue.trim() ? 1 : 0} pasted note
                            {textIntakeValue.trim() ? "" : "s"}
                          </li>
                          <li>
                            • {importAnythingSources.length} file
                            {importAnythingSources.length === 1 ? "" : "s"}
                          </li>
                        </ul>
                      </section>
                    ) : (
                      <>
                        <div className="mt-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div
                              className={`inline-flex rounded-md border border-dashed px-4 py-3 text-base font-semibold transition-colors ${
                                fileImportStatus
                                  ? "border-blue-300 bg-white text-blue-900"
                                  : importAnythingDragActive
                                  ? "border-blue-300 bg-white text-blue-900"
                                  : "border-blue-100 bg-blue-50/40 text-blue-800"
                              }`}
                            >
                              {fileImportStatus
                                ? "Importing files..."
                                : extractingImageText
                                ? "Importing files..."
                                : importAnythingDragActive
                                  ? "Drop files here."
                                  : "Drag files here"}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <label
                                className={`rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-100 ${
                                  extractingImageText || fileImportStatus
                                    ? "cursor-not-allowed opacity-60"
                                    : "cursor-pointer"
                                }`}
                                htmlFor="import-anything-files"
                              >
                                Add Files
                              </label>
                            </div>
                            <input
                              accept=".pdf,.txt,.md,.csv,.log,text/plain,text/csv,text/markdown,application/pdf,image/gif,image/jpeg,image/png,image/webp"
                              className="sr-only"
                              disabled={extractingImageText || Boolean(fileImportStatus)}
                              id="import-anything-files"
                              multiple
                              onChange={(event) => {
                                void handleImportAnythingFiles(event.target.files);
                                event.target.value = "";
                              }}
                              type="file"
                            />
                          </div>
                          {fileImportStatus ||
                          extractingImageText ||
                          processingImportAnything ? (
                            <div
                              aria-live="polite"
                              className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900"
                              role="status"
                            >
                              {fileImportStatus
                                ? fileImportStatus
                                : extractingImageText
                                ? "Importing files..."
                                : "Reviewing everything found..."}
                            </div>
                          ) : null}
                          {importAnythingSources.length > 0 ? (
                            <p className="mt-3 text-sm font-medium text-slate-600">
                              {importAnythingSources.length} source
                              {importAnythingSources.length === 1 ? "" : "s"} added
                            </p>
                          ) : null}
                        </div>

                        <label className="mt-5 block text-sm font-medium text-slate-700">
                          Add any text you have
                          <textarea
                            className="mt-2 min-h-36 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                            onChange={(event) =>
                              setTextIntakeValue(event.target.value)
                            }
                            placeholder="Type, paste, insert appointment text here"
                            value={textIntakeValue}
                          />
                        </label>
                      </>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        className={gentlePrimaryButtonClass}
                        disabled={
                          Boolean(fileImportStatus) ||
                          processingImportAnything ||
                          (importAnythingItems.length === 0 &&
                            !textIntakeValue.trim())
                        }
                        onClick={() => {
                          if (importAnythingItems.length > 0) {
                            if (importAnythingIdentityResolutionOpen) {
                              setImportAnythingReviewOpen(false);
                            } else {
                              setImportAnythingReviewOpen(true);
                            }
                            return;
                          }

                          void handleInterpretImportAnything();
                        }}
                        type="button"
                      >
                        {processingImportAnything
                          ? "Reviewing..."
                          : "Review before Saving"}
                      </button>
                      {importAnythingItems.length > 0 ? (
                        <button
                          className={gentleSecondaryButtonClass}
                          disabled={
                            processingImportAnything ||
                            savingImportAnything ||
                            importAnythingIdentityResolutionOpen
                          }
                          onClick={() =>
                            setConfirmingImportAnythingSaveAll(true)
                          }
                          type="button"
                        >
                          Save All
                        </button>
                      ) : null}
                    </div>

                    {confirmingImportAnythingSaveAll ? (
                      <section className="mt-4 rounded-md border border-blue-100 bg-white p-4 shadow-sm">
                        <h3 className="text-base font-semibold text-slate-950">
                          Confirm Import
                        </h3>
                        <p className="mt-3 text-sm text-slate-700">
                          CarePland will create:
                        </p>
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {importAnythingSummaryCounts(importAnythingItems)
                            .appointments > 0 ? (
                            <li>
                              •{" "}
                              {
                                importAnythingSummaryCounts(importAnythingItems)
                                  .appointments
                              }{" "}
                              appointment
                              {importAnythingSummaryCounts(importAnythingItems)
                                .appointments === 1
                                ? ""
                                : "s"}
                            </li>
                          ) : null}
                          {importAnythingNewAppointmentNoteCount(
                            importAnythingItems
                          ) > 0 ? (
                            <li>
                              •{" "}
                              {importAnythingNewAppointmentNoteCount(
                                importAnythingItems
                              )}{" "}
                              appointment
                              {importAnythingNewAppointmentNoteCount(
                                importAnythingItems
                              ) === 1
                                ? ""
                                : "s"}{" "}
                              from Visit Notes
                            </li>
                          ) : null}
                          {importAnythingSummaryCounts(importAnythingItems)
                            .tasks > 0 ? (
                            <li>
                              •{" "}
                              {
                                importAnythingSummaryCounts(importAnythingItems)
                                  .tasks
                              }{" "}
                              task
                              {importAnythingSummaryCounts(importAnythingItems)
                                .tasks === 1
                                ? ""
                                : "s"}
                            </li>
                          ) : null}
                        </ul>
                        <p className="mt-3 text-sm text-slate-600">
                          Supporting notes will be attached automatically.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            className={gentlePrimaryButtonClass}
                            disabled={savingImportAnything}
                            onClick={handleConfirmAllImportAnything}
                            type="button"
                          >
                            {savingImportAnything
                              ? "Saving..."
                              : "Confirm Import"}
                          </button>
                          <button
                            className={gentleSecondaryButtonClass}
                            disabled={savingImportAnything}
                            onClick={() =>
                              setConfirmingImportAnythingSaveAll(false)
                            }
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </section>
                    ) : null}

                    {importAnythingItems.length > 0 &&
                    importAnythingIdentityResolutionOpen ? (
                      <section className="mt-5 rounded-md border border-amber-100 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          {!canAddCareVip ? (
                            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                              This household already has the maximum number of
                              Care VIPs.
                            </p>
                          ) : null}
                        </div>

                        <div className="mt-4 space-y-4">
                          {importAnythingIdentityResolutionChoices.map(
                            (choice) => (
                              <section
                                className="py-2"
                                key={choice.clusterId}
                              >
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Potential Care VIP
                                  </p>
                                  <h4 className="mt-1 text-lg font-semibold text-slate-950">
                                    {choice.detectedName}
                                  </h4>
                                  <p className="mt-1 text-sm text-slate-600">
                                    Choose how to handle this unrecognized name.
                                  </p>
                                </div>

                                <div className="mt-4 grid gap-3">
                                  <label className="flex items-start gap-3 py-1 text-sm text-slate-700">
                                    <input
                                      checked={choice.action === "match"}
                                      className="mt-1"
                                      onChange={() =>
                                        updateImportAnythingIdentityResolutionChoice(
                                          choice.clusterId,
                                          { action: "match" }
                                        )
                                      }
                                      type="radio"
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="font-semibold text-slate-900">
                                        Match to an existing Care VIP
                                      </span>
                                      {choice.action === "match" ? (
                                        <select
                                          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                          onChange={(event) =>
                                            updateImportAnythingIdentityResolutionChoice(
                                              choice.clusterId,
                                              {
                                                matchedCareSubjectId:
                                                  event.target.value,
                                              }
                                            )
                                          }
                                          value={choice.matchedCareSubjectId}
                                        >
                                          <option value="">
                                            Choose a Care VIP
                                          </option>
                                          {careSubjects.map((subject) => (
                                            <option
                                              key={subject.id}
                                              value={subject.id}
                                            >
                                              {careSubjectDisplayLabel(subject)}
                                            </option>
                                          ))}
                                        </select>
                                      ) : null}
                                    </span>
                                  </label>

                                  {canAddCareVip ? (
                                    <div className="py-1 text-sm text-slate-700">
                                      <label className="flex items-start gap-3">
                                        <input
                                          checked={choice.action === "create"}
                                          className="mt-1"
                                          onChange={() =>
                                            updateImportAnythingIdentityResolutionChoice(
                                              choice.clusterId,
                                              { action: "create" }
                                            )
                                          }
                                          type="radio"
                                        />
                                        <span className="font-semibold text-slate-900">
                                          Create new Care VIP
                                        </span>
                                      </label>
                                      {choice.action === "create" ? (
                                        <div className="ml-7 mt-3 space-y-3">
                                          <label className="block w-full max-w-[44rem] text-sm font-medium text-slate-700">
                                            Name
                                            <input
                                              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                              onChange={(event) =>
                                                updateImportAnythingIdentityResolutionChoice(
                                                  choice.clusterId,
                                                  {
                                                    createName:
                                                      event.target.value,
                                                  }
                                                )
                                              }
                                              value={choice.createName}
                                            />
                                          </label>
                                          <div className="ml-1 flex flex-wrap items-center gap-x-5 gap-y-3">
                                            <span className="inline-flex items-center gap-1.5">
                                              <label
                                                className={`inline-flex items-center gap-2 text-sm font-semibold ${
                                                  isPetSubjectType(choice.subjectType)
                                                    ? "cursor-not-allowed text-slate-400"
                                                    : "text-slate-600"
                                                }`}
                                                title={
                                                  isPetSubjectType(choice.subjectType)
                                                    ? "Pets are Managed Care VIPs."
                                                    : "Managed Care VIP"
                                                }
                                              >
                                                <input
                                                  checked={
                                                    isPetSubjectType(
                                                      choice.subjectType
                                                    ) ||
                                                    choice.managedByHousehold
                                                  }
                                                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300"
                                                  disabled={isPetSubjectType(
                                                    choice.subjectType
                                                  )}
                                                  onChange={(event) =>
                                                    updateImportAnythingIdentityResolutionChoice(
                                                      choice.clusterId,
                                                      {
                                                        managedByHousehold:
                                                          event.target.checked,
                                                      }
                                                    )
                                                  }
                                                  type="checkbox"
                                                />
                                                <span>Managed Care VIP</span>
                                              </label>
                                              <ManagedCareVipHelp
                                                tooltipId={`import-anything-managed-care-vip-help-${choice.clusterId}`}
                                              />
                                            </span>
                                            {isPetSubjectType(choice.subjectType) ? (
                                              <>
                                                {!choice.editingPetSpecies ? (
                                                  <>
                                                    <span className="text-sm font-semibold text-slate-600">
                                                      {importAnythingPetLabel(
                                                        choice.petKind,
                                                        choice.otherPetType
                                                      )}
                                                    </span>
                                                    <button
                                                      className="text-sm font-semibold text-slate-500 hover:text-slate-800"
                                                      onClick={() =>
                                                        updateImportAnythingIdentityResolutionChoice(
                                                          choice.clusterId,
                                                          {
                                                            editingPetSpecies:
                                                              true,
                                                          }
                                                        )
                                                      }
                                                      type="button"
                                                    >
                                                      Change Species
                                                    </button>
                                                    <button
                                                      className="text-sm font-semibold text-slate-500 hover:text-rose-700"
                                                      onClick={() =>
                                                        updateImportAnythingIdentityResolutionChoice(
                                                          choice.clusterId,
                                                          {
                                                            editingPetSpecies:
                                                              false,
                                                            managedByHousehold:
                                                              false,
                                                            subjectType: "other",
                                                          }
                                                        )
                                                      }
                                                      type="button"
                                                    >
                                                      Not a Pet
                                                    </button>
                                                  </>
                                                ) : (
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    {[
                                                      ["cat", "Cat"],
                                                      ["dog", "Dog"],
                                                      ["other", "Other"],
                                                    ].map(([kind, label]) => (
                                                      <button
                                                        aria-pressed={
                                                          choice.petKind === kind
                                                        }
                                                        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                                                          choice.petKind === kind
                                                            ? "bg-blue-100 text-blue-950 ring-1 ring-blue-200"
                                                            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-900"
                                                        }`}
                                                        key={kind}
                                                        onClick={() => {
                                                          const petKind =
                                                            kind as ImportAnythingPetKind;

                                                          updateImportAnythingIdentityResolutionChoice(
                                                            choice.clusterId,
                                                            {
                                                              editingPetSpecies:
                                                                petKind ===
                                                                "other",
                                                              managedByHousehold:
                                                                true,
                                                              petKind,
                                                              subjectType:
                                                                importAnythingPetSubjectType(
                                                                  petKind,
                                                                  choice.otherPetType
                                                                ),
                                                            }
                                                          );
                                                        }}
                                                        type="button"
                                                      >
                                                        {label}
                                                      </button>
                                                    ))}
                                                    {choice.petKind === "other" ? (
                                                      <input
                                                        className="min-h-9 w-32 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                                                        onChange={(event) =>
                                                          updateImportAnythingIdentityResolutionChoice(
                                                            choice.clusterId,
                                                            {
                                                              otherPetType:
                                                                event.target.value,
                                                              subjectType:
                                                                importAnythingPetSubjectType(
                                                                  "other",
                                                                  event.target
                                                                    .value
                                                                ),
                                                            }
                                                          )
                                                        }
                                                        placeholder="Type"
                                                        value={choice.otherPetType}
                                                      />
                                                    ) : null}
                                                    <button
                                                      className="text-sm font-semibold text-slate-500 hover:text-slate-800"
                                                      onClick={() =>
                                                        updateImportAnythingIdentityResolutionChoice(
                                                          choice.clusterId,
                                                          {
                                                            editingPetSpecies:
                                                              false,
                                                          }
                                                        )
                                                      }
                                                      type="button"
                                                    >
                                                      Save type
                                                    </button>
                                                  </div>
                                                )}
                                              </>
                                            ) : (
                                              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                                                <input
                                                  checked={false}
                                                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                                                  onChange={(event) => {
                                                    if (event.target.checked) {
                                                      updateImportAnythingIdentityResolutionChoice(
                                                        choice.clusterId,
                                                        {
                                                          managedByHousehold:
                                                            true,
                                                          petKind:
                                                            importAnythingPetKindFromSubjectType(
                                                              choice.subjectType
                                                            ),
                                                          subjectType:
                                                            importAnythingPetSubjectType(
                                                              importAnythingPetKindFromSubjectType(
                                                                choice.subjectType
                                                              ),
                                                              choice.otherPetType
                                                            ),
                                                        }
                                                      );
                                                    }
                                                  }}
                                                  type="checkbox"
                                                />
                                                <span>This is a pet</span>
                                              </label>
                                            )}
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  <label className="flex items-start gap-3 py-1 text-sm text-slate-700">
                                    <input
                                      checked={
                                        choice.action === "leave_unresolved"
                                      }
                                      className="mt-1"
                                      onChange={() =>
                                        updateImportAnythingIdentityResolutionChoice(
                                          choice.clusterId,
                                          { action: "leave_unresolved" }
                                        )
                                      }
                                      type="radio"
                                    />
                                    <span>
                                      <span className="font-semibold text-slate-900">
                                        Leave unresolved for now
                                      </span>
                                      <span className="mt-1 block text-slate-600">
                                        Imported objects will remain unresolved
                                        in Review and cannot be saved to another
                                        person automatically.
                                      </span>
                                    </span>
                                  </label>
                                </div>
                              </section>
                            )
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            className={gentlePrimaryButtonClass}
                            disabled={
                              savingImportAnything ||
                              !importAnythingIdentityResolutionReady
                            }
                            onClick={() =>
                              void completeImportAnythingIdentityResolution()
                            }
                            type="button"
                          >
                            {savingImportAnything
                              ? "Resolving..."
                              : "Continue to Review"}
                          </button>
                          <button
                            className={gentleSecondaryButtonClass}
                            disabled={savingImportAnything}
                            onClick={() =>
                              setConfirmingDiscardImportAnythingReview(true)
                            }
                            type="button"
                          >
                            Discard import
                          </button>
                          {confirmingDiscardImportAnythingReview ? (
                            <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                              <span>Are you sure?</span>
                              <button
                                className="font-semibold text-rose-700 transition hover:text-rose-900"
                                onClick={() => {
                                  resetImportAnythingReview();
                                  setConfirmingDiscardImportAnythingReview(
                                    false
                                  );
                                  setMessage(
                                    "Import Anything review discarded."
                                  );
                                }}
                                type="button"
                              >
                                Yes
                              </button>
                              <button
                                className="font-semibold text-blue-700 transition hover:text-blue-900"
                                onClick={() =>
                                  setConfirmingDiscardImportAnythingReview(
                                    false
                                  )
                                }
                                type="button"
                              >
                                No
                              </button>
                            </span>
                          ) : null}
                        </div>
                      </section>
                    ) : null}

                    {importAnythingItems.length > 0 && importAnythingReviewOpen ? (
                      <section className="mt-5 rounded-md border border-emerald-100 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-slate-900">
                              Review Import Anything
                            </h3>
                            <p className="mt-1 text-sm text-slate-600">
                              Nothing is saved until you approve it.
                              {importAnythingSummary
                                ? ` ${importAnythingSummary}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                              <input
                                checked={importAnythingExpertView}
                                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-200"
                                onChange={(event) =>
                                  setImportAnythingExpertView(
                                    event.target.checked
                                  )
                                }
                                type="checkbox"
                              />
                              Expert view
                            </label>
                            <button
                              className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                              onClick={() =>
                                setConfirmingDiscardImportAnythingReview(true)
                              }
                              type="button"
                            >
                              Discard review
                            </button>
                            {confirmingDiscardImportAnythingReview ? (
                              <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                                <span>Are you sure?</span>
                                <button
                                  className="font-semibold text-rose-700 transition hover:text-rose-900"
                                  onClick={() => {
                                    resetImportAnythingReview();
                                    setConfirmingDiscardImportAnythingReview(
                                      false
                                    );
                                    setMessage(
                                      "Import Anything review discarded."
                                    );
                                  }}
                                  type="button"
                                >
                                  Yes
                                </button>
                                <button
                                  className="font-semibold text-blue-700 transition hover:text-blue-900"
                                  onClick={() =>
                                    setConfirmingDiscardImportAnythingReview(
                                      false
                                    )
                                  }
                                  type="button"
                                >
                                  No
                                </button>
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {importAnythingExpertView ? (
                        <section className="mt-4 rounded-md border border-blue-100 bg-blue-50/40 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-900">
                                Overall person clue
                              </h4>
                              {importAnythingPersonAssignment ? (
                                <p className="mt-1 text-sm text-slate-600">
                                  {importAnythingPersonAssignment.detectedName
                                    ? `Detected: ${importAnythingPersonAssignment.detectedName}. `
                                    : ""}
                                  {importAnythingPersonAssignment.matchedCareSubjectId
                                    ? `Suggested match: ${
                                        subjectsById.get(
                                          importAnythingPersonAssignment.matchedCareSubjectId
                                        )?.display_name ?? "existing Care VIP"
                                      }. `
                                    : importAnythingPersonAssignment.suggestedNewPersonName
                                      ? `Possible new person: ${importAnythingPersonAssignment.suggestedNewPersonName}. `
                                      : "CarePland could not confidently assign this to a person. "}
                                  Confidence:{" "}
                                  {Math.round(
                                    importAnythingPersonAssignment.confidence * 100
                                  )}
                                  %.
                                </p>
                              ) : (
                                <p className="mt-1 text-sm text-slate-600">
                                  CarePland could not confidently assign this to
                                  a person.
                                </p>
                              )}
                              {importAnythingPersonAssignment?.rationale ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  {importAnythingPersonAssignment.rationale}
                                </p>
                              ) : null}
                            </div>
                            <button
                              className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-slate-700"
                              onClick={() =>
                                setConfirmingDiscardImportAnythingReview(true)
                              }
                              type="button"
                            >
                              Discard review
                            </button>
                            {confirmingDiscardImportAnythingReview ? (
                              <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                                <span>Are you sure?</span>
                                <button
                                  className="font-semibold text-rose-700 transition hover:text-rose-900"
                                  onClick={() => {
                                    resetImportAnythingReview();
                                    setConfirmingDiscardImportAnythingReview(
                                      false
                                    );
                                    setMessage(
                                      "Import Anything review discarded."
                                    );
                                  }}
                                  type="button"
                                >
                                  Yes
                                </button>
                                <button
                                  className="font-semibold text-blue-700 transition hover:text-blue-900"
                                  onClick={() =>
                                    setConfirmingDiscardImportAnythingReview(
                                      false
                                    )
                                  }
                                  type="button"
                                >
                                  No
                                </button>
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            Each finding below can be assigned separately.
                            Unassigned findings stay in the import audit only.
                          </p>
                        </section>
                        ) : null}
                        {importAnythingOwnershipClusters.length > 0 ||
                        importAnythingItems.length > 0 ? (
                          importAnythingExpertView ? (
                          <section className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                            <h4 className="text-sm font-semibold text-slate-900">
                              Ownership Clusters Detected
                            </h4>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                              {importAnythingOwnershipClusterCounts(
                                importAnythingItems,
                                importAnythingOwnershipClusters
                              ).map((row) => (
                                <div
                                  className="rounded-md bg-white px-3 py-2 text-sm"
                                  key={row.label}
                                >
                                  <div className="font-semibold text-slate-900">
                                    {row.label}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    Findings: {row.count}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                          ) : null
                        ) : null}
                        {savingImportAnything ? (
                          <div
                            aria-live="polite"
                            className="mt-3 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
                            role="status"
                          >
                            Saving approved items...
                          </div>
                        ) : null}
                        {!importAnythingExpertView ? (
                          <div className="mt-6">
                            {importAnythingStagingItems(importAnythingItems).map((item) => {
                              const isEditingImportItem =
                                editingImportAnythingItemIds[item.id] ?? false;
                              const needsOwnerChoice =
                                !item.ownerCareSubjectId;
                              const likelyOwnerLabel =
                                item.ownerDetectedName ||
                                item.ownerNewPersonName ||
                                "Unknown";
                              const needsOwnerConfirmation =
                                needsOwnerChoice && item.ownerDetectedName;
                              const likelyOwnerCareSubjectId = "";
                              const itemOwnerLabel = item.ownerCareSubjectId
                                ? subjectsById.get(item.ownerCareSubjectId)
                                    ?.display_name ?? "Existing Care VIP"
                                : item.ownerDetectedName ||
                                  "Unassigned";
                              const appointmentOwnerCandidateId =
                                item.ownerCareSubjectId || likelyOwnerCareSubjectId;
                              const importAnythingAppointmentChoices =
                                appointmentPool.filter((appointment) => {
                                  if (appointment.deleted_at) {
                                    return false;
                                  }

                                  if (!appointmentOwnerCandidateId) {
                                    return true;
                                  }

                                  return (
                                    appointment.care_subject_id ===
                                    appointmentOwnerCandidateId
                                  );
                                });
                              const providerLabel =
                                item.fields.providerName ||
                                (item.kind === "provider" ? item.title : "");
                              const practiceOfficeLabel =
                                importAnythingPracticeOfficeValue(item);
                              const dateLabel = item.fields.startsAt
                                ? formatDate(item.fields.startsAt)
                                : item.fields.dueAt || "";
                              const supportingNotes =
                                importAnythingFindSupportingNotes(
                                  item,
                                  importAnythingItems
                                );
                              const sourceItems = [item, ...supportingNotes].filter(
                                (sourceItem) => sourceItem.sourceExcerpt
                              );
                              const isViewingSource =
                                viewingImportAnythingSourceItemId === item.id;
                              const shouldShowItemSummary =
                                item.kind !== "appointment" && item.summary;
                              const createsNewAppointmentFromNote =
                                item.kind === "note" &&
                                item.createsNewAppointment &&
                                !item.matchedAppointmentId;
                              const isHumanApproved =
                                item.status === "approved" &&
                                item.userReviewed === true;
                              const isAiApprovedUntouched =
                                item.status === "approved" &&
                                item.userReviewed !== true;
                              const isAiApprovedCollapsed =
                                isAiApprovedUntouched &&
                                !expandedImportAnythingItemIds[item.id];
                              const isLikelyOwnerReviewCollapsed =
                                item.status === "needs_review" &&
                                needsOwnerConfirmation &&
                                !expandedImportAnythingItemIds[item.id] &&
                                !isEditingImportItem;
                              const isCollapsedImportItem =
                                (isHumanApproved && !isEditingImportItem) ||
                                isAiApprovedCollapsed ||
                                isLikelyOwnerReviewCollapsed;
                              const showImportItemDetails =
                                !isCollapsedImportItem;

                              return (
                                <article
                                  className="relative flex flex-col px-5 py-8 before:absolute before:left-5 before:right-5 before:top-0 before:h-px before:bg-slate-200 first:pt-0 first:before:hidden sm:px-6 sm:before:left-6 sm:before:right-6"
                                  key={item.id}
                                >
                                  {isCollapsedImportItem ? (
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <h4 className="text-2xl font-semibold text-slate-950">
                                          {item.title}
                                        </h4>
                                        {isLikelyOwnerReviewCollapsed ? (
                                          <>
                                            <button
                                              className="rounded-md px-2 py-1 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 hover:text-amber-950"
                                              onClick={() =>
                                                setExpandedImportAnythingItemIds(
                                                  (currentIds) => ({
                                                    ...currentIds,
                                                    [item.id]: true,
                                                  })
                                                )
                                              }
                                              type="button"
                                            >
                                              Confirm: this belongs to
                                            </button>
                                            <label className="inline-flex max-w-full items-center gap-2 rounded-md border border-amber-100 bg-amber-50/70 px-3 py-2 text-sm font-semibold text-amber-950">
                                              <select
                                                className="max-w-48 rounded-md border border-amber-200 bg-white/85 px-2 py-1 text-sm font-semibold text-amber-950 shadow-sm"
                                                onChange={(event) =>
                                                  updateImportAnythingItemOwner(
                                                    item.id,
                                                    {
                                                      ownerCareSubjectId:
                                                        event.target.value,
                                                      ownerNewPersonName: "",
                                                    }
                                                  )
                                                }
                                                value={
                                                  item.ownerCareSubjectId ||
                                                  likelyOwnerCareSubjectId
                                                }
                                              >
                                                <option value="">
                                                  {likelyOwnerLabel}
                                                </option>
                                                {careSubjects.map((subject) => (
                                                  <option
                                                    key={subject.id}
                                                    value={subject.id}
                                                  >
                                                    {careSubjectDisplayLabel(subject)}
                                                  </option>
                                                ))}
                                              </select>
                                            </label>
                                            <button
                                              className={gentleSecondaryButtonClass}
                                              onClick={() =>
                                                setImportAnythingItemStatus(
                                                  item.id,
                                                  "approved"
                                                )
                                              }
                                              type="button"
                                            >
                                              Confirm
                                            </button>
                                          </>
                                        ) : isHumanApproved ? (
                                          <>
                                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                              Approved
                                            </span>
                                            <button
                                              className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 hover:text-blue-900"
                                              onClick={() =>
                                                undoImportAnythingItemApproval(
                                                  item.id
                                                )
                                              }
                                              type="button"
                                            >
                                              Undo
                                            </button>
                                          </>
                                        ) : (
                                          <button
                                            className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 hover:text-blue-900"
                                            onClick={() =>
                                              setExpandedImportAnythingItemIds(
                                                (currentIds) => ({
                                                  ...currentIds,
                                                  [item.id]: true,
                                                })
                                              )
                                            }
                                            type="button"
                                          >
                                            Open
                                          </button>
                                        )}
                                      </div>
                                      {dateLabel ? (
                                        <p className="text-lg font-medium text-slate-700">
                                          {dateLabel}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : (
                                  <>
                                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-2xl font-semibold text-slate-950">
                                          {item.title}
                                        </h4>
                                        {item.status === "needs_review" ? (
                                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                                            Needs review
                                          </span>
                                        ) : null}
                                        {isAiApprovedUntouched ? (
                                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                                            {importAnythingReviewerFirstName} Reviewing
                                          </span>
                                        ) : null}
                                      </div>
                                      {providerLabel ? (
                                        <p className="mt-2 text-base font-medium text-[#767676]">
                                          {providerLabel}
                                        </p>
                                      ) : null}
                                      {practiceOfficeLabel ? (
                                        <p className="mt-1 text-base font-medium text-[#767676]">
                                          {practiceOfficeLabel}
                                        </p>
                                      ) : null}
                                      {item.kind !== "appointment" ? (
                                        <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                                          {importAnythingKindLabel(item.kind)}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="text-left md:min-w-64 md:text-right">
                                      {dateLabel ? (
                                        <p className="text-lg font-medium text-slate-700">
                                          {dateLabel}
                                        </p>
                                      ) : null}
                                      {!needsOwnerChoice ? (
                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#767676] md:justify-end">
                                          <span>for {itemOwnerLabel}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  </>
                                  )}

                                  {showImportItemDetails &&
                                  createsNewAppointmentFromNote ? (
                                    <section className="mt-5 rounded-md border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
                                      <p className="font-semibold">
                                        This looks like a new appointment.
                                      </p>
                                      <p className="mt-1">
                                        If you approve it, CarePland will create
                                        an appointment and save these Visit Notes
                                        to it.
                                      </p>
                                    </section>
                                  ) : null}

                                  {showImportItemDetails &&
                                  item.kind === "note" ? (
                                    <section className="mt-4 rounded-md border border-blue-100 bg-blue-50/40 px-4 py-3">
                                      <label className="block text-sm font-semibold text-slate-900">
                                        Attach these Visit Notes to
                                        <select
                                          className="mt-2 w-full rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm"
                                          onChange={(event) =>
                                            updateImportAnythingItemAppointment(
                                              item.id,
                                              event.target.value
                                            )
                                          }
                                          value={item.matchedAppointmentId}
                                        >
                                          <option value="">
                                            Create a new appointment from these
                                            notes
                                          </option>
                                          {importAnythingAppointmentChoices.map(
                                            (appointment) => (
                                              <option
                                                key={appointment.id}
                                                value={appointment.id}
                                              >
                                                {importAnythingAppointmentChoiceLabel(
                                                  appointment
                                                )}
                                              </option>
                                            )
                                          )}
                                        </select>
                                      </label>
                                      {item.matchedAppointmentId ? (
                                        <p className="mt-2 text-sm text-slate-600">
                                          These notes will be saved to the
                                          selected appointment.
                                        </p>
                                      ) : (
                                        <p className="mt-2 text-sm text-slate-600">
                                          Keep this selected when the visit is
                                          missing from CarePland.
                                        </p>
                                      )}
                                    </section>
                                  ) : null}

                                  {showImportItemDetails &&
                                  shouldShowItemSummary ? (
                                    <p className="mt-5 text-base text-slate-700">
                                      {item.summary}
                                    </p>
                                  ) : null}

                                  {showImportItemDetails &&
                                  supportingNotes.length > 0 ? (
                                    <section className="mt-5">
                                      <h5 className="text-sm font-semibold text-slate-900">
                                        What to Know
                                      </h5>
                                      <div className="mt-2 space-y-3 text-base text-slate-700">
                                        {supportingNotes.map((supportItem) => (
                                          <div key={supportItem.id}>
                                            {(() => {
                                              const takeaways = asTextList(
                                                supportItem.fields.takeaways
                                              );
                                              const followups = asTextList(
                                                supportItem.fields.followups
                                              );

                                              return (
                                                <>
                                            {supportItem.fields.summary ? (
                                              <p>{supportItem.fields.summary}</p>
                                            ) : null}
                                            {takeaways.length > 0 ? (
                                              <div className="mt-2">
                                                <p className="font-semibold text-slate-900">
                                                  Takeaways
                                                </p>
                                                <DetailList
                                                  emptyLabel=""
                                                  items={takeaways}
                                                  showBullets={false}
                                                />
                                              </div>
                                            ) : null}
                                            {followups.length > 0 ? (
                                              <div className="mt-2">
                                                <p className="font-semibold text-slate-900">
                                                  Follow-ups
                                                </p>
                                                <DetailList
                                                  emptyLabel=""
                                                  items={followups}
                                                  showBullets={false}
                                                />
                                              </div>
                                            ) : null}
                                            {supportItem.fields.detail ? (
                                              <p>{supportItem.fields.detail}</p>
                                            ) : null}
                                                </>
                                              );
                                            })()}
                                          </div>
                                        ))}
                                      </div>
                                    </section>
                                  ) : null}

                                  {showImportItemDetails &&
                                  sourceItems.length > 0 &&
                                  isViewingSource ? (
                                    <section className="mt-5 rounded-md border border-blue-100 bg-blue-50/30 p-4">
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                          <h5 className="text-base font-semibold text-slate-900">
                                            Source
                                          </h5>
                                          <p className="mt-1 text-sm text-slate-600">
                                            CarePland used this text. This helps
                                            you verify what was found.
                                          </p>
                                        </div>
                                        <button
                                          className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-slate-700"
                                          onClick={() =>
                                            setViewingImportAnythingSourceItemId(
                                              null
                                            )
                                          }
                                          type="button"
                                        >
                                          Close
                                        </button>
                                      </div>
                                      <div className="mt-3 space-y-3">
                                        {sourceItems.map((sourceItem) => (
                                          <div
                                            className="whitespace-pre-wrap rounded-md bg-white p-3 text-sm text-slate-700"
                                            key={sourceItem.id}
                                          >
                                            {sourceItem.sourceExcerpt}
                                          </div>
                                        ))}
                                      </div>
                                      {/* TODO: When OCR bounding boxes or document coordinates are available, replace this text-only source view with a richer PDF/image region preview. */}
                                    </section>
                                  ) : null}

                                  {showImportItemDetails &&
                                  needsOwnerChoice &&
                                  !isEditingImportItem ? (
                                    <section className="mt-5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-md border border-amber-100 bg-amber-50/70 px-3 py-2 text-sm font-semibold text-amber-950">
                                      <span>
                                        {needsOwnerConfirmation
                                          ? "Likely owner:"
                                          : "Owner:"}
                                      </span>
                                      <select
                                        className="max-w-full rounded-md border border-amber-200 bg-white/85 px-2 py-1 text-sm font-semibold text-amber-950 shadow-sm"
                                        onChange={(event) =>
                                          updateImportAnythingItemOwner(
                                            item.id,
                                            {
                                              ownerCareSubjectId:
                                                event.target.value,
                                              ownerNewPersonName: "",
                                            }
                                          )
                                        }
                                        value={
                                          item.ownerCareSubjectId ||
                                          likelyOwnerCareSubjectId
                                        }
                                      >
                                        <option value="">
                                          {needsOwnerConfirmation
                                            ? likelyOwnerLabel
                                            : "Unassigned"}
                                        </option>
                                        {careSubjects.map((subject) => (
                                          <option
                                            key={subject.id}
                                            value={subject.id}
                                          >
                                            {careSubjectDisplayLabel(subject)}
                                          </option>
                                        ))}
                                      </select>
                                    </section>
                                  ) : null}

                                  {showImportItemDetails &&
                                  isEditingImportItem ? (
                                    <section className="mt-5 rounded-md border border-blue-100 bg-blue-50/30 p-4">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h5 className="text-base font-semibold text-slate-900">
                                          Edit {importAnythingKindLabel(item.kind)}
                                        </h5>
                                        <button
                                          className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-slate-700"
                                          onClick={() =>
                                            setEditingImportAnythingItemIds(
                                              (currentIds) => ({
                                                ...currentIds,
                                                [item.id]: false,
                                              })
                                            )
                                          }
                                          type="button"
                                        >
                                          Done
                                        </button>
                                      </div>
                                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <label className="block text-sm font-medium text-slate-700">
                                          Assign to existing person
                                          <select
                                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                            onChange={(event) =>
                                              updateImportAnythingItemOwner(
                                                item.id,
                                                {
                                                  ownerCareSubjectId:
                                                    event.target.value,
                                                  ownerNewPersonName: "",
                                                }
                                              )
                                            }
                                            value={item.ownerCareSubjectId}
                                          >
                                            <option value="">
                                              Save as unassigned
                                            </option>
                                            {careSubjects.map((subject) => (
                                              <option
                                                key={subject.id}
                                                value={subject.id}
                                              >
                                                {careSubjectDisplayLabel(subject)}
                                              </option>
                                            ))}
                                          </select>
                                        </label>
                                        <p className="rounded-md border border-amber-100 bg-white px-3 py-2 text-sm font-medium text-amber-950">
                                          Leave unassigned if this should not be
                                          attached to an existing Care VIP.
                                        </p>
                                      </div>

                                      {(item.fields.providerOrganization !== undefined ||
                                        item.fields.locationName !== undefined) ? (
                                        <label className="mt-4 block text-sm font-medium text-slate-700">
                                          Practice / Office
                                          <input
                                            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                            onChange={(event) => {
                                              updateImportAnythingItemField(
                                                item.id,
                                                "providerOrganization",
                                                event.target.value
                                              );
                                              updateImportAnythingItemField(
                                                item.id,
                                                "locationName",
                                                event.target.value
                                              );
                                            }}
                                            value={practiceOfficeLabel}
                                          />
                                        </label>
                                      ) : null}

                                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        {importAnythingSimpleFieldEntries(item).map(
                                          ([field, value]) => (
                                            <label
                                              className="block text-sm font-medium text-slate-700"
                                              key={field}
                                            >
                                              {importAnythingFieldLabel(field)}
                                              <textarea
                                                className="mt-1 min-h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                onChange={(event) =>
                                                  updateImportAnythingItemField(
                                                    item.id,
                                                    field,
                                                    event.target.value
                                                  )
                                                }
                                                value={value}
                                              />
                                            </label>
                                          )
                                        )}
                                      </div>
                                    </section>
                                  ) : null}

                                  {showImportItemDetails ? (
                                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        className={gentleSecondaryButtonClass}
                                        onClick={() =>
                                          setImportAnythingItemStatus(
                                            item.id,
                                            "approved"
                                          )
                                        }
                                        type="button"
                                      >
                                        ✓ Looks good
                                      </button>
                                      <button
                                        className={
                                          item.status === "rejected"
                                            ? "rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 shadow-sm"
                                            : gentleSecondaryButtonClass
                                        }
                                        onClick={() =>
                                          setImportAnythingItemStatus(
                                            item.id,
                                            "rejected"
                                          )
                                        }
                                        type="button"
                                      >
                                        Reject
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        className={gentleSecondaryButtonClass}
                                        onClick={() =>
                                          setEditingImportAnythingItemIds(
                                            (currentIds) => ({
                                              ...currentIds,
                                              [item.id]: !isEditingImportItem,
                                            })
                                          )
                                        }
                                        type="button"
                                      >
                                        {isEditingImportItem ? "Close edit" : "Edit"}
                                      </button>
                                      {sourceItems.length > 0 ? (
                                        <button
                                          className={gentleSecondaryButtonClass}
                                          onClick={() =>
                                            setViewingImportAnythingSourceItemId(
                                              isViewingSource ? null : item.id
                                            )
                                          }
                                          type="button"
                                        >
                                          View source
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                  ) : null}
                                </article>
                              );
                            })}
                          </div>
                        ) : null}
                        {importAnythingExpertView ? (
                        <>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7">
                          {[
                            [
                              "Appointments Found",
                              importAnythingSummaryCounts(importAnythingItems)
                                .appointments,
                            ],
                            [
                              "Providers Found",
                              importAnythingSummaryCounts(importAnythingItems)
                                .providers,
                            ],
                            [
                              "Notes Found",
                              importAnythingSummaryCounts(importAnythingItems)
                                .notes,
                            ],
                            [
                              "Tasks Found",
                              importAnythingSummaryCounts(importAnythingItems)
                                .tasks,
                            ],
                            [
                              "Medication Changes Found",
                              importAnythingSummaryCounts(importAnythingItems)
                                .medicationChanges,
                            ],
                            [
                              "Questions Found",
                              importAnythingSummaryCounts(importAnythingItems)
                                .questions,
                            ],
                            [
                              "CarePrep Found",
                              importAnythingSummaryCounts(importAnythingItems)
                                .careprep,
                            ],
                          ].map(([label, count]) => (
                            <div
                              className="rounded-md border border-slate-200 bg-slate-50 p-3"
                              key={label}
                            >
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {label}
                              </div>
                              <div className="mt-1 text-2xl font-semibold text-slate-900">
                                {count}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 space-y-3">
                          {importAnythingItems.map((item) => (
                            <article
                              className="rounded-md border border-slate-200 p-4"
                              key={item.id}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {importAnythingKindLabel(item.kind)}
                                    {item.needsReview ? " · Needs review" : ""}
                                  </div>
                                  <h4 className="mt-1 text-base font-semibold text-slate-900">
                                    {item.title}
                                  </h4>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {item.summary}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    className={
                                      item.status === "approved"
                                        ? gentlePrimaryButtonClass
                                        : gentleSecondaryButtonClass
                                    }
                                    onClick={() =>
                                      setImportAnythingItemStatus(
                                        item.id,
                                        "approved"
                                      )
                                    }
                                    type="button"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className={
                                      item.status === "rejected"
                                        ? "rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-800 shadow-sm"
                                        : gentleSecondaryButtonClass
                                    }
                                    onClick={() =>
                                      setImportAnythingItemStatus(
                                        item.id,
                                        "rejected"
                                      )
                                    }
                                    type="button"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                              <div className="mt-3 rounded-md border border-blue-100 bg-blue-50/30 p-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Belongs to
                                    </div>
                                    <p className="mt-1 text-sm text-slate-600">
                                      {item.ownerDetectedName
                                        ? `Detected: ${item.ownerDetectedName}. `
                                        : "No clear person detected. "}
                                      {item.ownerCareSubjectId
                                        ? `Suggested: ${
                                            subjectsById.get(
                                              item.ownerCareSubjectId
                                            )?.display_name ?? "existing Care VIP"
                                          }. `
                                        : "Unresolved until you choose someone. "}
                                      Confidence:{" "}
                                      {Math.round(item.ownerConfidence * 100)}%.
                                    </p>
                                    {item.ownerRationale ? (
                                      <p className="mt-1 text-xs text-slate-500">
                                        {item.ownerRationale}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <label className="block text-sm font-medium text-slate-700">
                                    Assign to existing person
                                    <select
                                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                                      onChange={(event) =>
                                        updateImportAnythingItemOwner(item.id, {
                                          ownerCareSubjectId:
                                            event.target.value,
                                          ownerNewPersonName: "",
                                        })
                                      }
                                      value={item.ownerCareSubjectId}
                                    >
                                      <option value="">Save as unassigned</option>
                                      {careSubjects.map((subject) => (
                                        <option
                                          key={subject.id}
                                          value={subject.id}
                                        >
                                          {careSubjectDisplayLabel(subject)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <p className="rounded-md border border-amber-100 bg-white px-3 py-2 text-sm font-medium text-amber-950">
                                    Leave unassigned if this should not be
                                    attached to an existing Care VIP.
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {Object.entries(item.fields).map(
                                  ([field, value]) => (
                                    <label
                                      className="block text-sm font-medium text-slate-700"
                                      key={field}
                                    >
                                      {importAnythingFieldLabel(field)}
                                      <textarea
                                        className="mt-1 min-h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                        onChange={(event) =>
                                          updateImportAnythingItemField(
                                            item.id,
                                            field,
                                            event.target.value
                                          )
                                        }
                                        value={value}
                                      />
                                    </label>
                                  )
                                )}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                                <span>
                                  Confidence: {Math.round(item.confidence * 100)}%
                                </span>
                                {item.matchedAppointmentId ? (
                                  <span>
                                    Matched existing appointment:
                                    {" "}
                                    {importAnythingMatchedAppointmentLabel(
                                      item.matchedAppointmentId,
                                      appointments
                                    )}
                                  </span>
                                ) : null}
                              </div>
                              {item.sourceExcerpt ? (
                                <details className="mt-3 text-sm text-slate-600">
                                  <summary className="cursor-pointer font-semibold text-slate-700">
                                    Source excerpt
                                  </summary>
                                  <p className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3">
                                    {item.sourceExcerpt}
                                  </p>
                                </details>
                              ) : null}
                            </article>
                          ))}
                        </div>
                        </>
                        ) : null}
                      </section>
                    ) : null}

                    {pendingTextIntakePanelAction ? (
                      <InlineConfirmation
                        cancelLabel="Return to editing"
                        className="mt-4"
                        confirmLabel={
                          pendingTextIntakePanelAction === "close"
                            ? "Discard and close"
                            : "Discard and switch"
                        }
                        message={
                          pendingTextIntakePanelAction === "close"
                            ? "Closing will discard your unsaved changes. Proceed?"
                            : "Switching will discard your unsaved changes. Proceed?"
                        }
                        onCancel={() => {
                          setPendingTextIntakePanelAction(null);
                          setPendingAppointmentPanelView(null);
                        }}
                        onConfirm={discardAndApplyTextIntakePanelAction}
                      />
                    ) : null}
                  </section>
                ) : null}
              </section>
            ) : null}

            {signedInEmail &&
            mainTab === "appointments" &&
            !activeAppointmentPanel ? (
              appointments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-600">
                {appointmentView === "archived"
                  ? "No archived appointments found."
                  : appointmentView === "logged"
                    ? "No logged appointments found yet."
                    : "No upcoming appointments found yet."}
              </div>
            ) : (
              <div className="-mt-4">
              {appointments.map((appointment) => {
                const note = notesByAppointment.get(appointment.id);
                const prep = guidanceByAppointment.get(appointment.id);
                const carePrepDraft = draftGuidanceByAppointment.get(
                  appointment.id
                );
                const appointmentCommunicationItems =
                  communicationItemsByAppointment.get(appointment.id) ?? [];
                const whatToKnow = buildWhatToKnowDisplayModel({
                  carePrep: {
                    bring_list: asTextList(prep?.bring_list),
                    key_questions: asTextList(prep?.key_questions),
                    med_review: asTextList(prep?.med_review),
                    next_steps: asTextList(prep?.next_steps),
                    since_last_visit: asTextList(prep?.since_last_visit),
                    watchouts: asTextList(prep?.watchouts),
                  },
                  communicationItems: appointmentCommunicationItems,
                });
                const hasCarePrepAvailable = Boolean(
                  prep?.summary || carePrepDraft?.summary || whatToKnow.hasItems
                );
                const carePrepGenerationError =
                  carePrepGenerationErrors[appointment.id];
                const appointmentDraft =
                  appointmentDrafts[appointment.id] ?? emptyAppointmentDraft;
                const isEditingAppointment =
                  editingAppointmentIds[appointment.id] ?? false;
                const noteDraft = noteDrafts[appointment.id] ?? emptyNoteDraft;
                const isEditingNote = editingNoteIds[appointment.id] ?? false;
                const isEditingCarePrep =
                  editingCarePrepIds[appointment.id] ?? false;
                const isCarePrepExpanded =
                  expandedCarePrepIds[appointment.id] ||
                  isEditingCarePrep ||
                  Boolean(carePrepDraft);
                const takeaways = asTextList(note?.takeaways);
                const followups = asTextList(note?.followups);
                const bringList = whatToKnow.categories.bring_list;
                const questions = whatToKnow.categories.key_questions;
                const watchouts = whatToKnow.categories.watchouts;
                const medReview = whatToKnow.categories.med_review;
                const sinceLastVisit = whatToKnow.categories.since_last_visit;
                const nextSteps = whatToKnow.categories.next_steps;
                const whatToKnowTopSections = [
                  { icon: "👜", items: bringList, label: "Bring" },
                  { icon: "❓", items: questions, label: "Ask" },
                ].filter((section) => section.items.length > 0);
                const whatToKnowWatchForSection =
                  watchouts.length > 0
                    ? { icon: "👁", items: watchouts, label: "Watch for" }
                    : null;
                const whatToKnowTopGridClassName =
                  whatToKnowTopSections.length === 1
                    ? "flex flex-col gap-4"
                    : "grid gap-4 md:grid-cols-[max-content_minmax(0,1fr)] md:gap-x-12";
                const draftValues = carePrepDraft
                  ? carePrepFormValues(appointment.id, carePrepDraft)
                  : emptyCarePrepDraft;
                const hasReviewCarePrepEdits = carePrepDraft
                  ? hasCarePrepDraftChanges(appointment.id, carePrepDraft)
                  : false;
                const prepEditValues = prep
                  ? carePrepFormValues(appointment.id, prep)
                  : emptyCarePrepDraft;
                const shouldWarnBeforeClosingCarePrepEdit =
                  prep && pendingCarePrepCloseId === appointment.id
                    ? hasCarePrepDraftChanges(appointment.id, prep)
                    : false;
                const isArchived = appointment.status === "archived";
                const isLogged = Boolean(appointment.current_note_id);
                const isVisitNotesExpandableView =
                  appointmentView === "logged" || appointmentView === "archived";
                const isVisitNotesExpanded =
                  expandedVisitNotesAppointmentId === appointment.id;
                const shouldShowVisitNotesHeaderControl =
                  Boolean(note) &&
                  isVisitNotesExpandableView &&
                  !isArchived &&
                  !isEditingNote;
                const toggleVisitNotesExpansion = () => {
                  const nextExpanded = !isVisitNotesExpanded;
                  setExpandedVisitNotesAppointmentId(
                    nextExpanded ? appointment.id : null
                  );
                  saveAppointmentsViewState({
                    expandedVisitNotesAppointmentId: nextExpanded
                      ? appointment.id
                      : null,
                  });
                };
                const shouldShowCarePrep = appointmentView === "upcoming";
                const shouldShowPostVisitSections =
                  appointmentView !== "upcoming" && !isVisitNotesExpandableView;
                const isFutureOrUndated =
                  !appointment.starts_at ||
                  new Date(appointment.starts_at) >= startOfToday();
                const canGenerateCarePrep =
                  !isArchived && !isLogged && isFutureOrUndated;
                const canPasteContextualNotes = !isArchived && !isLogged;
                const isContextualTextIntake =
                  textIntakeTargetAppointmentId === appointment.id;
                const activeModifier = isEditingAppointment
                  ? "edit"
                  : isContextualTextIntake
                    ? "import"
                    : isEditingNote
                      ? "add"
                      : null;
                const shouldShowCarePrepControl =
                  hasCarePrepAvailable ||
                  (shouldShowCarePrep &&
                    (canGenerateCarePrep ||
                      generatingCarePrepForId === appointment.id ||
                      carePrepGenerationError));
                const shouldShowAddNotesControl =
                  !isArchived && canPasteContextualNotes;
                const shouldShowAppointmentFocusControls =
                  shouldShowCarePrepControl &&
                  (isCarePrepExpanded ||
                    generatingCarePrepForId === appointment.id ||
                    carePrepGenerationError);
                const calendarLink = agicalUrl(appointment);
                const providerHeaderLabel =
                  appointmentProviderHeaderLabel(appointment);
	                const practiceLabel =
	                  appointment.provider_organization ||
	                  appointment.location_name ||
	                  "";
                const canOpenAppointmentLocation =
                  canShowAppointmentAddress(appointment);
                const appointmentLocationLabel =
                  practiceLabel ||
                  (canOpenAppointmentLocation
                    ? appointment.location_address?.trim() ?? ""
                    : "");
                const appointmentSubjectRecord = appointment.care_subject_id
                  ? subjectsById.get(appointment.care_subject_id) ?? null
                  : null;
                const appointmentSubject =
                  appointmentSubjectRecord?.display_name ?? "";
                const appointmentMessages = appointment.care_subject_id
                  ? homeMessageGroups
                      .find((group) => group.subjectId === appointment.care_subject_id)
                      ?.messages.filter(
                        (message) => message.appointmentId === appointment.id
                      ) ?? []
                  : [];
                const appointmentMessageCount = appointmentMessages.length;
                const appointmentMessageLabel = `${appointmentMessageCount} ${
                  appointmentMessageCount === 1 ? "Message" : "Messages"
                }`;
                const isMessagesExpanded =
                  expandedMessagesAppointmentId === appointment.id;
                const isMessageComposerOpen =
                  activeMessageComposerAppointmentId === appointment.id;
                const toggleMessagesExpansion = () => {
                  setMessagesExpandedForAppointment(
                    appointment.id,
                    !isMessagesExpanded
                  );
                };
                const pendingModifierHasUnsavedChanges =
                  pendingModifierSwitch?.appointmentId === appointment.id &&
                  hasUnsavedAppointmentModifierChanges(
		                    appointment,
		                    activeModifier
		                  );
		                const pendingModifierWarning =
		                  pendingModifierHasUnsavedChanges ? (
		                    <InlineConfirmation
		                      cancelLabel="Return to editing"
		                      className="mt-3"
		                      confirmLabel={
		                        pendingModifierSwitch.target
		                          ? "Discard and switch"
		                          : "Discard and close"
		                      }
		                      message={
		                        pendingModifierSwitch.target
		                          ? "Switching will discard your unsaved changes. Proceed?"
		                          : "Closing will discard your unsaved changes. Proceed?"
		                      }
		                      onCancel={() => setPendingModifierSwitch(null)}
		                      onConfirm={() =>
		                        discardAndSwitchAppointmentModifier(appointment)
		                      }
		                    />
		                  ) : null;
		                return (
                  <article
                    id={`appointment-${appointment.id}`}
                    className={`relative flex flex-col py-8 before:absolute before:top-0 before:h-px before:bg-slate-200 first:pt-0 first:before:hidden ${
                      isVisitNotesExpandableView
                        ? "px-3 pb-4 before:left-3 before:right-3 sm:px-4 sm:before:left-4 sm:before:right-4"
                        : "px-5 before:left-5 before:right-5 sm:px-6"
                    }`}
                    key={appointment.id}
                  >
                    <div
                      className="absolute right-4 top-6 z-10"
                      data-appointment-menu
                    >
                      <button
                        aria-expanded={openAppointmentMenuId === appointment.id}
                        aria-label="Appointment options"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-blue-50 hover:text-blue-800"
                        onClick={() =>
                          setOpenAppointmentMenuId((currentId) =>
                            currentId === appointment.id ? null : appointment.id
                          )
                        }
                        type="button"
                      >
                        <EllipsisVerticalIcon className="h-5 w-5" />
                      </button>
                      {openAppointmentMenuId === appointment.id ? (
                        <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-lg">
                          {!isArchived ? (
                            <>
                              <button
                                className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-50/70 hover:text-blue-800"
                                onClick={() => {
                                  setOpenAppointmentMenuId(null);
                                  requestAppointmentModifier(
                                    appointment,
                                    "edit"
                                  );
                                }}
                                type="button"
                              >
                                Edit
                              </button>
                              <button
                                className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-50/70 hover:text-blue-800 disabled:text-slate-400"
                                disabled={
                                  archivingAppointmentForId === appointment.id
                                }
                                onClick={() =>
                                  handleArchiveAppointment(appointment)
                                }
                                type="button"
                              >
                                {archivingAppointmentForId === appointment.id
                                  ? "Archiving..."
                                  : "Archive"}
                              </button>
                            </>
	                          ) : null}
	                          {isArchived ? (
	                            <button
	                              className="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-50/70 hover:text-blue-800 disabled:text-slate-400"
	                              disabled={
	                                restoringAppointmentForId === appointment.id
	                              }
	                              onClick={() => {
	                                setOpenAppointmentMenuId(null);
	                                restoreAppointment(appointment.id);
	                              }}
	                              type="button"
	                            >
	                              {restoringAppointmentForId === appointment.id
	                                ? "Restoring..."
	                                : "Restore"}
	                            </button>
	                          ) : null}
	                          <button
	                            className="block w-full px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
                            onClick={() => {
                              setOpenAppointmentMenuId(null);
                              setPendingDeleteAppointmentId(appointment.id);
                            }}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            className={`text-2xl font-semibold ${
                              appointment.is_sample_data
                                ? "text-slate-500"
                                : "text-slate-950"
                            }`}
                          >
                            {appointment.title || "Untitled appointment"}
                          </h2>
                          {shouldShowCarePrepControl ? (
                            <button
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-1 py-1 text-lg font-semibold leading-none text-blue-900 transition hover:text-blue-700 disabled:opacity-60"
                              disabled={
                                generatingCarePrepForId === appointment.id
                              }
                              onClick={() => requestCarePrepPanel(appointment)}
                              title={
                                isCarePrepExpanded
                                  ? "Close What to Know"
                                  : "Open What to Know"
                              }
                              type="button"
                            >
                              <span>
                                {hasCarePrepAvailable
                                  ? "✓ What to Know"
                                  : "What to Know"}
                              </span>
                              {isCarePrepExpanded ? (
                                <ChevronDownIcon className="h-5 w-5" />
                              ) : (
                                <ChevronRightIcon className="h-5 w-5" />
                              )}
                            </button>
                          ) : null}
                          {isCarePrepExpanded ? (
                            <div className="flex shrink-0 items-center gap-1">
                              {prep?.summary &&
                              !isArchived &&
                              !isEditingCarePrep ? (
                                <>
                                  <button
                                    aria-label="Edit What to Know"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:text-slate-400"
                                    onClick={() =>
                                      startEditingCarePrep(appointment.id, prep)
                                    }
                                    title="Edit What to Know"
                                    type="button"
                                  >
                                    <PencilSquareIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    aria-label="Refresh What to Know"
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:text-slate-400"
                                    disabled={
                                      generatingCarePrepForId ===
                                      appointment.id
                                    }
                                    onClick={() =>
                                      handleRefreshWhatToKnow(appointment)
                                    }
                                    title="Refresh What to Know"
                                    type="button"
                                  >
                                    <RefreshCircleIcon className="h-4 w-4" />
                                  </button>
                                </>
                              ) : null}
                              {appointmentMessageCount > 0 ? (
                                <button
                                  aria-expanded={isMessagesExpanded}
                                  aria-label={`${appointmentMessageLabel} for ${
                                    appointment.title?.trim() ||
                                    "this appointment"
                                  }`}
                                  className="inline-flex h-7 items-center justify-center gap-1 rounded-full px-1.5 text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:text-slate-400"
                                  disabled={homeMessagesLoading}
                                  onClick={toggleMessagesExpansion}
                                  title={
                                    isMessagesExpanded
                                      ? "Close related messages"
                                      : "Open related messages"
                                  }
                                  type="button"
                                >
                                  <EnvelopeIcon className="h-4 w-4" />
                                  <span className="text-xs font-semibold leading-none">
                                    {appointmentMessageCount}
                                  </span>
                                </button>
                              ) : null}
                              {appointmentMessageCount === 0 ? (
                                <button
                                  aria-label={`Send message about ${
                                    appointment.title?.trim() ||
                                    "this appointment"
                                  }`}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                  onClick={() =>
                                    openAppointmentMessageComposer(appointment)
                                  }
                                  title={
                                    isMessageComposerOpen
                                      ? "Close message composer"
                                      : "Send message"
                                  }
                                  type="button"
                                >
                                  <PaperAirplaneIcon className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          {shouldShowVisitNotesHeaderControl ? (
                            <button
                              className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-lg font-semibold leading-none text-blue-900 transition hover:text-blue-700 disabled:opacity-60"
                              onClick={toggleVisitNotesExpansion}
                              title={
                                isVisitNotesExpanded
                                  ? "Close notes"
                                  : "Open notes"
                              }
                              type="button"
                            >
                              <span>Notes</span>
                              {isVisitNotesExpanded ? (
                                <ChevronDownIcon className="h-5 w-5" />
                              ) : (
                                <ChevronRightIcon className="h-5 w-5" />
                              )}
                            </button>
                          ) : null}
                          {note &&
                          shouldShowVisitNotesHeaderControl &&
                          isVisitNotesExpanded ? (
                            <button
                              aria-label="Edit visit notes"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:text-slate-400"
                              onClick={() =>
                                startEditingNote(appointment.id, note)
                              }
                              title="Edit visit notes"
                              type="button"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                          ) : null}
                          {appointment.is_sample_data ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                              Demo
                            </span>
                          ) : null}
	                          {!isArchived && appointment.status !== "scheduled" ? (
	                            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
	                              {appointment.status}
	                            </span>
                          ) : null}
                        </div>
                        {appointment.is_sample_data ? (
                          <p className="mt-1 text-sm italic text-slate-500">
                            Note: This is not an actual appointment.
                          </p>
                        ) : null}
                        {providerHeaderLabel ? (
                          <p className="mt-2 text-base font-medium text-[#767676]">
                            {providerHeaderLabel}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-left md:min-w-64 md:text-right">
                        <div className="flex flex-wrap items-center gap-3 text-lg font-medium text-slate-700 md:justify-end md:pr-12">
                          {shouldShowAddNotesControl ? (
                            <button
                              className="inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-semibold text-blue-800 transition hover:bg-blue-50 hover:text-blue-950"
                              onClick={() =>
                                requestAppointmentModifier(
                                  appointment,
                                  "import"
                                )
                              }
                              title={
                                isContextualTextIntake
                                  ? "Close visit notes"
                                  : "Add visit notes"
                              }
                              type="button"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                              <span>Add Visit Notes</span>
                            </button>
                          ) : null}
                          <span className="inline-flex items-center gap-2">
                          {formatDate(appointment.starts_at)}
                          {calendarLink && !isArchived ? (
                            <a
                              aria-label="Add to Calendar"
                              className="inline-flex text-[#767676] hover:text-blue-700"
                              href={calendarLink}
                              rel="noreferrer"
                              target="_blank"
                              title="Add to Calendar"
                            >
                              <CalendarIcon className="h-5 w-5" />
                            </a>
                          ) : null}
                          </span>
                        </div>
                        {appointmentLocationLabel ||
                        (isEveryoneFocus && appointmentSubject) ? (
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#767676] md:justify-end md:pr-12">
                            {appointmentLocationLabel &&
                            canOpenAppointmentLocation ? (
                              <button
                                className="inline-flex items-center gap-1 text-left font-medium text-[#767676] hover:text-blue-800 md:justify-end md:text-right"
                                onClick={() =>
                                  setLocationSheetAppointmentId(appointment.id)
                                }
                                type="button"
                              >
                                <MapPinIcon className="h-4 w-4 shrink-0" />
                                <span>{appointmentLocationLabel}</span>
                              </button>
                            ) : null}
                            {appointmentLocationLabel &&
                            !canOpenAppointmentLocation ? (
                              <span className="font-medium">
                                {appointmentLocationLabel}
                              </span>
                            ) : null}
                            {isEveryoneFocus && appointmentSubject ? (
                              <PersonChip
                                person={
                                  careSubjectAvatarPerson(
                                    appointmentSubjectRecord
                                  ) ?? { displayName: appointmentSubject }
                                }
                                size="xs"
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>

		                    {!activeModifier
		                      ? pendingModifierWarning
		                      : null}

                    {pendingDeleteAppointmentId === appointment.id ? (
                      <section className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium text-rose-950">
                            Delete this appointment? It will be hidden from your
                            appointment views.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className={gentleCautionButtonClass}
                              disabled={
                                deletingAppointmentForId === appointment.id
                              }
                              onClick={() => handleDeleteAppointment(appointment)}
                              type="button"
                            >
                              {deletingAppointmentForId === appointment.id
                                ? "Deleting..."
                                : "Delete appointment"}
                            </button>
                            <button
                              className="rounded-full border border-rose-100 bg-white/85 px-3 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
                              onClick={() => setPendingDeleteAppointmentId(null)}
                              type="button"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </section>
                    ) : null}

                    {isMessageComposerOpen ? (
                      <div className="order-20 mt-4">
                        {appointment.care_subject_id ? (
                          <AppointmentMessageComposer
                            appointmentId={appointment.id}
                            initialDraft={
                              appointmentMessageDraft?.appointmentId === appointment.id
                                ? appointmentMessageDraft
                                : null
                            }
                            onDraftChange={(draft) =>
                              setAppointmentMessageDraft((currentDraft) =>
                                draft ??
                                (currentDraft?.appointmentId === appointment.id
                                  ? null
                                  : currentDraft)
                              )
                            }
                            onCancel={() =>
                              setActiveMessageComposerAppointmentId(null)
                            }
                            onSent={async () => {
                              setAppointmentMessageDraft(null);
                              setMessagesExpandedForAppointment(appointment.id, true);
                              await loadHomeMessages();
                              await hydrateAppointmentDetails([appointment]);
                            }}
                            personId={appointment.care_subject_id}
                            recipientName={appointmentSubject || "Receiver"}
                            senderName={savedProfileLabel || signedInEmail || "CarePland coordinator"}
                          />
                        ) : (
                          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-medium text-amber-800">
                            Choose a Care VIP for this appointment before sending a message.
                          </p>
                        )}
                      </div>
                    ) : null}

                    {isMessagesExpanded ? (
                      <div className="order-20 mt-4">
                        <AppointmentMessagesSection
                          firstMessageAction={
                            appointmentMessageCount > 0 ? (
                              <button
                                aria-label={`Send message about ${
                                  appointment.title?.trim() ||
                                  "this appointment"
                                }`}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                onClick={() =>
                                  openAppointmentMessageComposer(appointment)
                                }
                                title={
                                  isMessageComposerOpen
                                    ? "Close message composer"
                                    : "Send message"
                                }
                                type="button"
                              >
                                <PaperAirplaneIcon className="h-4 w-4" />
                              </button>
                            ) : null
                          }
                          formatDate={formatDate}
                          loading={homeMessagesLoading}
                          messages={appointmentMessages}
                        />
                      </div>
                    ) : null}

                    {isContextualTextIntake && canPasteContextualNotes ? (
                      <form
                        className="order-30 mt-4"
                        onSubmit={
                          textIntakeDraft
                            ? handleSaveTextIntakeDraft
                            : handleInterpretTextIntake
                        }
                      >
                        {!textIntakeDraft ? (
                          <>
                            {pendingModifierWarning}
                            <div
                              className={`mt-4 rounded-lg border transition ${
                                appointmentNotesDragActive
                                  ? "border-blue-300 bg-blue-50"
                                  : "border-slate-300 bg-white"
                              }`}
                              onDragEnter={handleAppointmentNotesDrag}
                              onDragLeave={handleAppointmentNotesDrag}
                              onDragOver={handleAppointmentNotesDrag}
                              onDrop={handleAppointmentNotesDrop}
                            >
                              <textarea
                                className="min-h-56 w-full rounded-lg bg-transparent px-4 py-3 text-base leading-7 outline-none"
                                onChange={(event) =>
                                  setContextualTextIntakeValue(
                                    event.target.value
                                  )
                                }
                                placeholder="Type, paste, add or drag anything related to this visit"
                                value={contextualTextIntakeValue}
                              />
                            </div>
                            {fileImportStatus ? (
                              <p className="mt-2 text-xs text-slate-500">
                                {fileImportStatus}
                              </p>
                            ) : null}
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                              <div className="flex flex-wrap items-center gap-4">
                                <button
                                  className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:border-blue-200 hover:bg-[#eef7ff] disabled:text-slate-400"
                                  disabled={processingTextIntake}
                                  type="submit"
                                >
                                  {processingTextIntake
                                    ? "Creating..."
                                    : "Create summary"}
                                </button>
                                <button
                                  className="rounded-md px-2 py-1 text-sm font-normal text-[#767676] transition hover:bg-blue-50 hover:text-slate-700"
                                  onClick={() =>
                                    requestCloseTextIntake(appointment)
                                  }
                                  type="button"
                                >
                                  Cancel
                                </button>
                              </div>
                              <label className="inline-flex cursor-pointer items-center rounded-full border border-blue-100 bg-white/85 px-3 py-1.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50">
                                Add screenshots (max 10)
                                <input
                                  accept="image/gif,image/jpeg,image/png,image/webp"
                                  className="sr-only"
                                  disabled={extractingImageText}
                                  multiple
                                  onChange={(event) => {
                                    void handleExtractImageText(
                                      event.target.files,
                                      "appointmentNotes"
                                    );
                                    event.target.value = "";
                                  }}
                                  type="file"
                                />
                              </label>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <AIReviewBadge
                                confidence={textIntakeDraft.confidence}
                              />
                              {textIntakeDraft.suggestedAction ? (
                                <p className="text-xs text-blue-800">
                                  {textIntakeDraft.suggestedAction}
                                </p>
                              ) : null}
                            </div>
                            <AppointmentDetailUpdateOption
                              checked={applyTextIntakeAppointmentDetails}
                              changes={appointmentDetailChanges(
                                appointment,
                                textIntakeDraft
                              )}
                              onChange={setApplyTextIntakeAppointmentDetails}
                            />
                            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                              <label className="block text-sm font-medium text-slate-700 lg:col-span-3">
                                Visit summary
                                <textarea
                                  className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateTextIntakeDraft(
                                      "notesSummary",
                                      event.target.value
                                    )
                                  }
                                  value={textIntakeDraft.notesSummary}
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                Takeaways
                                <textarea
                                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateTextIntakeDraft(
                                      "takeaways",
                                      event.target.value
                                    )
                                  }
                                  value={textIntakeDraft.takeaways}
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                Follow-ups
                                <textarea
                                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateTextIntakeDraft(
                                      "followups",
                                      event.target.value
                                    )
                                  }
                                  value={textIntakeDraft.followups}
                                />
                              </label>
                              <div className="flex items-end gap-3">
                                <button
                                  className={gentlePrimaryButtonClass}
                                  disabled={savingTextIntake}
                                  type="submit"
                                >
                                  {savingTextIntake ? "Saving..." : "Save notes"}
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </form>
                    ) : null}

                    {!isArchived &&
                    !isContextualTextIntake &&
                    isEditingNote ? (
                      <form
                        className="order-30 mt-5 rounded-md border border-blue-100 bg-blue-50 p-4"
                        onSubmit={(event) => handleSaveNote(event, appointment)}
                      >
	                        <div className="flex flex-wrap items-center justify-between gap-3">
	                          <div>
		                            <h3 className="text-lg font-semibold text-slate-900">
		                              {note ? "Edit notes" : "Add notes"}
		                            </h3>
		                          </div>
	                          <button
	                            className="rounded-md px-2 py-1 text-sm font-normal text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
		                            onClick={() => requestCloseNoteEditing(appointment)}
	                            type="button"
	                          >
		                            Close
		                          </button>
	                        </div>
		                        {pendingModifierWarning}
	                        <div className="mt-4 grid gap-4 lg:grid-cols-3">
                          <label className="block text-sm font-medium text-slate-700 lg:col-span-3">
                            Visit summary
                            <textarea
                              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateNoteDraft(
                                  appointment.id,
                                  "summary",
                                  event.target.value
                                )
                              }
                              placeholder="What happened in the visit?"
                              value={noteDraft.summary}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Takeaways
                            <textarea
                              className="mt-2 min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateNoteDraft(
                                  appointment.id,
                                  "takeaways",
                                  event.target.value
                                )
                              }
                              placeholder={
                                "One per line\nExample: Medication changed"
                              }
                              value={noteDraft.takeaways}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Follow-ups
                            <textarea
                              className="mt-2 min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateNoteDraft(
                                  appointment.id,
                                  "followups",
                                  event.target.value
                                )
                              }
                              placeholder={"One per line\nExample: Schedule labs"}
                              value={noteDraft.followups}
                            />
                          </label>
                          <div className="flex items-end">
                            <button
                              className={`w-full ${gentlePrimaryButtonClass}`}
                              disabled={savingNoteForId === appointment.id}
                              type="submit"
                            >
                              {savingNoteForId === appointment.id
                                ? "Saving..."
                                : note
                                  ? "Save edited notes"
                                  : "Save notes"}
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : null}

                    {isEditingAppointment && !isArchived ? (
                      <form
                        className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4"
                        onSubmit={(event) =>
                          handleSaveAppointment(event, appointment)
                        }
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                              Edit appointment
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Update the appointment details saved on this record.
                            </p>
	                          </div>
	                          <button
	                            className="rounded-md px-2 py-1 text-sm font-normal text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
	                            onClick={() =>
	                              requestAppointmentModifier(appointment, "edit")
	                            }
	                            type="button"
	                          >
	                            Close
	                          </button>
	                        </div>
	                        {pendingModifierWarning}

	                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Title
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "title",
                                  event.target.value
                                )
                              }
                              type="text"
                              value={appointmentDraft.title}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Date & time
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "startsAt",
                                  event.target.value
                                )
                              }
                              type="datetime-local"
                              value={appointmentDraft.startsAt}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Status
                            <select
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "status",
                                  event.target.value
                                )
                              }
                              value={appointmentDraft.status}
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                              <option value="draft">Draft</option>
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Provider
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "providerName",
                                  event.target.value
                                )
                              }
                              type="text"
                              value={appointmentDraft.providerName}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Practice
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "providerOrganization",
                                  event.target.value
                                )
                              }
                              type="text"
                              value={appointmentDraft.providerOrganization}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Location name
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "locationName",
                                  event.target.value
                                )
                              }
                              type="text"
                              value={appointmentDraft.locationName}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Address
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "locationAddress",
                                  event.target.value
                                )
                              }
                              type="text"
                              value={appointmentDraft.locationAddress}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Phone
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "locationPhone",
                                  event.target.value
                                )
                              }
                              type="text"
                              value={appointmentDraft.locationPhone}
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                            Reason
                            <textarea
                              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateAppointmentDraft(
                                  appointment.id,
                                  "reason",
                                  event.target.value
                                )
                              }
                              value={appointmentDraft.reason}
                            />
                          </label>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            className={gentlePrimaryButtonClass}
                            disabled={savingAppointmentForId === appointment.id}
                            type="submit"
                          >
                            {savingAppointmentForId === appointment.id
                              ? "Saving..."
                              : "Save appointment"}
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {shouldShowCarePrep && carePrepDraft && !isArchived ? (
                      <section className="order-20 mt-6 border border-blue-100 bg-[#f4faff] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-blue-900">
                              Review What to Know
                            </h3>
                            <p className="mt-1 text-sm text-blue-800">
                              You can make changes or accept as-is.
                            </p>
                          </div>
                          <button
                            className={gentleSmallBlueButtonClass}
                            disabled={generatingCarePrepForId === appointment.id}
                            onClick={() => handleRefreshWhatToKnow(appointment)}
                            type="button"
                          >
                            {generatingCarePrepForId === appointment.id
                              ? "Refreshing..."
                              : "Refresh"}
                          </button>
                        </div>
                        {generatingCarePrepForId === appointment.id ? (
                          <span className="mt-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
                            Generating...
                          </span>
                        ) : null}

                        <div className="mt-4 grid gap-4">
                          <label className="block text-sm font-medium text-slate-700">
                            Summary
                            <textarea
                              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                              onChange={(event) =>
                                updateCarePrepDraft(
                                  appointment.id,
                                  "summary",
                                  event.target.value,
                                  draftValues
                                )
                              }
                              value={draftValues.summary}
                            />
                          </label>

                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="block text-sm font-medium text-slate-700">
                              Bring
                              <textarea
                                className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                onChange={(event) =>
                                  updateCarePrepDraft(
                                    appointment.id,
                                    "bringList",
                                    event.target.value,
                                    draftValues
                                  )
                                }
                                value={draftValues.bringList}
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              Ask
                              <textarea
                                className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                onChange={(event) =>
                                  updateCarePrepDraft(
                                    appointment.id,
                                    "keyQuestions",
                                    event.target.value,
                                    draftValues
                                  )
                                }
                                value={draftValues.keyQuestions}
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              Watch for
                              <textarea
                                className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                onChange={(event) =>
                                  updateCarePrepDraft(
                                    appointment.id,
                                    "watchouts",
                                    event.target.value,
                                    draftValues
                                  )
                                }
                                value={draftValues.watchouts}
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              Medication review
                              <textarea
                                className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                onChange={(event) =>
                                  updateCarePrepDraft(
                                    appointment.id,
                                    "medReview",
                                    event.target.value,
                                    draftValues
                                  )
                                }
                                value={draftValues.medReview}
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              Since last visit
                              <textarea
                                className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                onChange={(event) =>
                                  updateCarePrepDraft(
                                    appointment.id,
                                    "sinceLastVisit",
                                    event.target.value,
                                    draftValues
                                  )
                                }
                                value={draftValues.sinceLastVisit}
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              Next steps
                              <textarea
                                className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                onChange={(event) =>
                                  updateCarePrepDraft(
                                    appointment.id,
                                    "nextSteps",
                                    event.target.value,
                                    draftValues
                                  )
                                }
                                value={draftValues.nextSteps}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            className={`${gentlePrimaryButtonClass} text-sm`}
                            disabled={
                              savingCarePrepForId === appointment.id ||
                              hasReviewCarePrepEdits
                            }
                            onClick={() =>
                              submitCarePrepReview({
                                action: "accept",
                                appointmentId: appointment.id,
                                draft: carePrepDraft,
                              })
                            }
                            type="button"
                            title={
                              hasReviewCarePrepEdits
                                ? "Save edited version to keep your changes."
                                : "Accept the generated version without edits."
                            }
                          >
                            {savingCarePrepForId === appointment.id
                              ? "Accepting..."
                              : "Accept What to Know"}
                          </button>
                          <button
                            className={`${gentleSoftBlueButtonClass} text-sm`}
                            disabled={
                              savingCarePrepForId === appointment.id ||
                              !hasReviewCarePrepEdits
                            }
                            onClick={() =>
                              submitCarePrepReview({
                                action: "save_edit",
                                appointmentId: appointment.id,
                                draft: carePrepDraft,
                              })
                            }
                            type="button"
                            title={
                              hasReviewCarePrepEdits
                                ? "Save your edited What to Know version."
                                : "Make an edit before saving an edited version."
                            }
                          >
                            {savingCarePrepForId === appointment.id
                              ? "Saving..."
                              : "Save edited version"}
                          </button>
                        </div>
                      </section>
                    ) : null}

                    {note &&
                    shouldShowVisitNotesHeaderControl &&
                    isVisitNotesExpanded ? (
	                        <section className="order-30 mt-3 overflow-hidden">
	                          <div className="pb-4 pt-2">
	                            <div className="grid gap-4">
	                              {note.summary_short ? (
	                                <section className="py-1">
	                                  <h4 className="font-semibold text-slate-900">
	                                    Visit summary
                                  </h4>
                                  <p className="mt-1 text-slate-700">
                                    {note.summary_short}
                                  </p>
                                </section>
                              ) : null}
	                              <div className="grid gap-4 md:grid-cols-2">
	                                <section className="py-1">
	                                  <h4 className="font-semibold text-slate-900">
	                                    Takeaways
                                  </h4>
                                  <DetailList
                                    emptyLabel="No takeaways saved yet."
                                    items={takeaways}
                                  />
                                </section>
	                                <section className="py-1">
	                                  <h4 className="font-semibold text-slate-900">
	                                    Follow-ups
                                  </h4>
                                  <DetailList
                                    emptyLabel="No follow-ups saved yet."
                                    items={followups}
                                  />
                                </section>
                              </div>
                            </div>
                          </div>
                        </section>
                    ) : null}

                    {note && !isVisitNotesExpandableView ? (
                      <div className="order-30 mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            Visit notes
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Current version {note.version_number}
                          </p>
                        </div>
                        {!isEditingNote && !isArchived ? (
                          <button
                            className={gentleSmallSecondaryButtonClass}
                            onClick={() => startEditingNote(appointment.id, note)}
                            type="button"
                          >
                            Edit notes
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {note?.summary_short && !isVisitNotesExpandableView ? (
                      <section className="order-30 mt-5">
                        <h3 className="font-semibold text-slate-900">Visit summary</h3>
                        <p className="mt-1 text-slate-700">{note.summary_short}</p>
                      </section>
                    ) : null}

                    {shouldShowPostVisitSections ? (
                      <div className="order-30 mt-5 grid gap-4 md:grid-cols-2">
                        <section className="rounded-md border border-slate-200 p-4">
                          <h3 className="font-semibold text-slate-900">
                            Takeaways
                          </h3>
                          <DetailList
                            emptyLabel="No takeaways saved yet."
                            items={takeaways}
                          />
                        </section>

                        <section className="rounded-md border border-slate-200 p-4">
                          <h3 className="font-semibold text-slate-900">
                            Follow-ups
                          </h3>
                          <DetailList
                            emptyLabel="No follow-ups saved yet."
                            items={followups}
                          />
                        </section>
                      </div>
                    ) : null}

                    {shouldShowAppointmentFocusControls ? (
                      <section className="order-20 mt-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 py-0.5">
                          <div className="flex flex-wrap items-center gap-3">
                            {shouldShowCarePrepControl &&
                            isCarePrepExpanded ? (
                              <>
                                {generatingCarePrepForId === appointment.id ? (
                                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
                                    Generating...
                                  </span>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </div>
                        {shouldShowCarePrepControl && carePrepGenerationError ? (
                          <p className="mt-3 rounded-md border border-blue-200 bg-[#f4faff] px-3 py-2 text-sm font-medium text-blue-950">
                            {carePrepGenerationError}
                          </p>
                        ) : null}
                        {shouldShowCarePrepControl &&
                        isCarePrepExpanded &&
                        hasCarePrepAvailable ? (
                          <div className="mt-1 overflow-hidden">
                            {isEditingCarePrep ? (
                              <div className="grid gap-4 border-t border-blue-100/70 p-4">
                            {shouldWarnBeforeClosingCarePrepEdit && prep ? (
                              <InlineConfirmation
                                cancelLabel="Return to editing"
                                confirmLabel="Discard and close"
                                message="Closing will discard your unsaved changes. Proceed?"
                                onCancel={() => setPendingCarePrepCloseId(null)}
                                onConfirm={() =>
                                  cancelEditingCarePrep(appointment.id)
                                }
                              />
                            ) : null}
                            <label className="block text-sm font-medium text-slate-700">
                              Summary
                              <textarea
                                className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                onChange={(event) =>
                                  updateCarePrepDraft(
                                    appointment.id,
                                    "summary",
                                    event.target.value,
                                    prepEditValues
                                  )
                                }
                                value={prepEditValues.summary}
                              />
                            </label>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="block text-sm font-medium text-slate-700">
                                Bring
                                <textarea
                                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateCarePrepDraft(
                                      appointment.id,
                                      "bringList",
                                      event.target.value,
                                      prepEditValues
                                    )
                                  }
                                  value={prepEditValues.bringList}
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                Ask
                                <textarea
                                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateCarePrepDraft(
                                      appointment.id,
                                      "keyQuestions",
                                      event.target.value,
                                      prepEditValues
                                    )
                                  }
                                  value={prepEditValues.keyQuestions}
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                Watch for
                                <textarea
                                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateCarePrepDraft(
                                      appointment.id,
                                      "watchouts",
                                      event.target.value,
                                      prepEditValues
                                    )
                                  }
                                  value={prepEditValues.watchouts}
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                Medication review
                                <textarea
                                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateCarePrepDraft(
                                      appointment.id,
                                      "medReview",
                                      event.target.value,
                                      prepEditValues
                                    )
                                  }
                                  value={prepEditValues.medReview}
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                Since last visit
                                <textarea
                                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateCarePrepDraft(
                                      appointment.id,
                                      "sinceLastVisit",
                                      event.target.value,
                                      prepEditValues
                                    )
                                  }
                                  value={prepEditValues.sinceLastVisit}
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                Next steps
                                <textarea
                                  className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                  onChange={(event) =>
                                    updateCarePrepDraft(
                                      appointment.id,
                                      "nextSteps",
                                      event.target.value,
                                      prepEditValues
                                    )
                                  }
                                  value={prepEditValues.nextSteps}
                                />
                              </label>
                            </div>

                            <div className="flex flex-wrap gap-3">
                              <button
                                className={`${gentlePrimaryButtonClass} text-sm`}
                                disabled={savingCarePrepForId === appointment.id || !prep}
                                onClick={() => {
                                  if (prep) {
                                    void saveCurrentCarePrepEdit(appointment.id, prep);
                                  }
                                }}
                                type="button"
                              >
                                {savingCarePrepForId === appointment.id
                                  ? "Saving..."
                                  : "Save What to Know edit"}
                              </button>
                              <button
                                className={`${gentleSecondaryButtonClass} text-sm`}
                                disabled={!prep}
                                onClick={() => {
                                  if (prep) {
                                    requestCloseCarePrepEdit(appointment.id, prep);
                                  }
                                }}
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pb-4 pt-0">
                            <div className="grid gap-4">
                              {prep?.summary ? (
                                <section className="py-1">
                                  <p className="text-slate-700">
                                    {prep.summary}
                                  </p>
                                </section>
                              ) : null}

                              {whatToKnowTopSections.length > 0 ? (
                                <div className={whatToKnowTopGridClassName}>
                                  {whatToKnowTopSections.map((section) => (
                                    <section
                                      className="min-w-0 px-2 py-1 sm:px-3"
                                      key={section.label}
                                    >
                                      <h4 className="font-semibold text-slate-900">
                                        <span aria-hidden="true">
                                          {section.icon}
                                        </span>{" "}
                                        {section.label}
                                      </h4>
                                      <DetailList
                                        emptyLabel=""
                                        items={section.items}
                                        showBullets={false}
                                      />
                                    </section>
                                  ))}
                                </div>
                              ) : null}
                              {whatToKnowWatchForSection ? (
                                <section className="min-w-0 px-2 py-1 sm:px-3">
                                  <h4 className="font-semibold text-slate-900">
                                    <span aria-hidden="true">
                                      {whatToKnowWatchForSection.icon}
                                    </span>{" "}
                                    {whatToKnowWatchForSection.label}
                                  </h4>
                                  <DetailList
                                    emptyLabel=""
                                    items={whatToKnowWatchForSection.items}
                                    showBullets={false}
                                  />
                                </section>
                              ) : null}

                            {(medReview.length > 0 ||
                              sinceLastVisit.length > 0 ||
                              nextSteps.length > 0) && (
                              <div className="grid gap-4 md:grid-cols-2">
                                <section className="px-2 py-1 sm:px-3">
                                  <h4 className="font-semibold text-slate-900">
                                    <span aria-hidden="true">💊</span>{" "}
                                    Medications
                                  </h4>
                                  <DetailList
                                    emptyLabel="No medication review items saved yet."
                                    items={medReview}
                                    showBullets={false}
                                  />
                                </section>

                                <section className="px-2 py-1 sm:px-3">
                                  <h4 className="font-semibold text-slate-900">
                                    <span aria-hidden="true">💡</span>{" "}
                                    Last visit highlights
                                  </h4>
                                  <DetailList
                                    emptyLabel="No prior-visit context saved yet."
                                    items={sinceLastVisit}
                                    showBullets={false}
                                  />
                                </section>
                                {nextSteps.length > 0 ? (
                                  <section className="px-2 py-1 sm:px-3">
                                    <h4 className="font-semibold text-slate-900">
                                      <span aria-hidden="true">✓</span>{" "}
                                      Next steps
                                    </h4>
                                    <DetailList
                                      emptyLabel=""
                                      items={nextSteps}
                                      showBullets={false}
                                    />
                                  </section>
                                ) : null}
                              </div>
                            )}
                            </div>
                          </div>
                        )}
                      </div>
                        ) : null}
                      </section>
                    ) : null}

	                  </article>
	                );
	              })
              }
              </div>
              )
            ) : null}
          </div>
        </div>
        )}
        {showUserFacingFooter ? (
          <UserFacingFooter
            buildInfo={userFacingFooterBuildInfo}
            onWhyCarePland={() => {
              setWelcomeGuideDismissed(false);
              void handleChangeMainTab("home");
            }}
          />
        ) : null}
        {isAdmin && isSignedInAppShell && mainTab === "admin" ? (
          <footer className="mt-8 pb-2 text-center text-xs text-slate-400">
            <button
              className="rounded px-2 py-1 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
              onClick={() => setShowVersionInfo(true)}
              type="button"
            >
              Build Number {careplandBuildNumber} * Build dttm:{" "}
              {careplandBuildDttm}
            </button>
          </footer>
        ) : null}
      </section>
      <PersonalOverlays
        askCloseConfirmOpen={askCloseConfirmOpen}
        askConversationComplete={askConversationComplete}
        askGuidanceText={
          askConversationComplete
            ? appContentText(askCompletionMessageKey)
            : appContentText("ask_guidance_message")
        }
        askInput={askInput}
        askInputPlaceholder={appContentText("ask_input_placeholder")}
        askMessages={askMessages}
        askPanelError={askPanelError}
        askPanelOpen={askPanelOpen}
        canUseAskPanel={canUseAskPanel}
        careplandBuildDttm={careplandBuildDttm}
        careplandBuildNumber={careplandBuildNumber}
        gentlePrimaryButtonClass={gentlePrimaryButtonClass}
        gentleWarmButtonClass={gentleWarmButtonClass}
        locationSheetAppointment={locationSheetDisplayAppointment}
        locationSheetMapsLink={locationSheetMapsLink}
        locationSheetPhoneHref={locationSheetPhoneHref}
        locationSheetPracticeLabel={locationSheetPracticeLabel ?? ""}
        onCancelPendingMainTabChange={cancelPendingMainTabChange}
        onCloseAskPanel={requestCloseAskPanel}
        onCloseLocationSheet={() => setLocationSheetAppointmentId(null)}
        onConfirmPendingMainTabChange={confirmPendingMainTabChange}
        onConfirmSignOut={() =>
          void handleSignOut({ bypassUnsavedChangesWarning: true })
        }
        onResetAskPanelState={resetAskPanelState}
        onSetAskCloseConfirmOpen={setAskCloseConfirmOpen}
        onSetAskInput={setAskInput}
        onSetShowVersionInfo={setShowVersionInfo}
        onSetSignOutConfirmOpen={setSignOutConfirmOpen}
        onSubmitAskMessage={handleSendAskMessage}
        runtimeEnvironmentLabel={runtimeEnvironmentLabel}
        sendingAskMessage={sendingAskMessage}
        showPendingMainTabConfirm={Boolean(
          pendingMainTab || pendingImportLeaveAction
        )}
        showPersonalSetupSignOutCopy={showingPersonalSetup}
        showVersionInfo={showVersionInfo}
        signOutConfirmOpen={signOutConfirmOpen}
        unsavedSignOutChanges={unsavedSignOutChanges}
      />
    </main>
  );
}
