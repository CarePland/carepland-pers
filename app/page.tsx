"use client";

import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import {
  FormEvent,
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
  AgentKnowledgeProposalsPanel,
} from "./components/AgentKnowledgeProposalsPanel";
import {
  AdminNavButton,
  AdminNavGroup,
  AdminNavItem,
} from "./components/admin/AdminAttention";
import {
  AdminAuditTrailPanel,
  type AdminAccessEventRow,
} from "./components/admin/AdminAuditTrailPanel";
import {
  AdminAskIntakePanel,
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
  AdminDashboardPanel,
  type AiOperationCostSummaryRow,
} from "./components/admin/AdminDashboardPanel";
import {
  AdminEarlyAccessIntakePanel,
  type EarlyAccessIntakeDraft,
  type EarlyAccessIntakeRow,
  type EarlyAccessIntakeStatus,
} from "./components/admin/AdminEarlyAccessIntakePanel";
import {
  AdminIntegrationErrorsPanel,
  type AdminIntegrationErrorSummaryRow,
} from "./components/admin/AdminIntegrationErrorsPanel";
import { AdminReadonlyUserPanel } from "./components/admin/AdminReadonlyUserPanel";
import { AdminSessionSettingsPanel } from "./components/admin/AdminSessionSettingsPanel";
import {
  AdminSupportTicketsPanel,
  type SupportTicket,
  type SupportTicketMessage,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from "./components/admin/AdminSupportTicketsPanel";
import {
  AdminUserActivityPanel,
  type AdminUserActivityFilter,
  type AdminUserActivityRow,
  type AdminUserActivitySortKey,
} from "./components/admin/AdminUserActivityPanel";
import { AIReviewBadge, aiReviewLevel } from "./components/AIReviewBadge";
import { AppointmentViewToolbar } from "./components/AppointmentViewToolbar";
import { HomeNextAppointmentPanel } from "./components/HomeNextAppointmentPanel";
import { PublicWebsite } from "./components/PublicWebsite";
import { UserFacingFooter } from "./components/UserFacingFooter";
import {
  favoriteLocationLabel,
  FavoriteLocation,
  PlaceAutocompleteSuggestion,
  PlaceDetailsResult,
  placesUnavailableMessage,
} from "./lib/places";
import {
  AdminContactDetails,
  adminContactDetailsFromValue,
} from "./lib/adminContactDetails";
import {
  planFeatureContentDefaults,
  planProfilePanelContentKey,
  pricingTierForEntitlement,
  pricingTiers,
} from "./lib/pricingTiers";
import {
  AppSessionSettings,
  defaultAppSessionSettings,
  normalizeAppSessionSettings,
  sessionIdleTimeoutHours,
} from "./lib/sessionSettings";

type Appointment = {
  id: string;
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

type CarePrepGenerationMode = "auto_after_notes" | "manual";

type CareSubject = {
  id: string;
  care_circle_id: string;
  display_name: string;
  subject_type: string;
  is_default: boolean;
  is_active: boolean;
};

type CareCircleEntitlement = {
  max_active_subjects: number;
  plan_id: string;
  plan_name: string;
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

type AiInstructionVersion = {
  id: string;
  version_number: number;
  system_prompt: string;
  user_prompt_template: string;
  output_schema: unknown;
  model: string | null;
  temperature: number | null;
  is_current: boolean;
  change_note: string | null;
  content_hash: string | null;
  copied_from_version_id: string | null;
  created_at: string;
};

type AppContentVersion = {
  id: string;
  body: string;
  change_note: string | null;
  content_hash: string | null;
  content_key: string;
  copied_from_version_id: string | null;
  created_at: string;
  description: string | null;
  is_current: boolean;
  label: string;
  superseded_at: string | null;
  superseded_by_version_id: string | null;
  version_number: number;
};

type ProductMgmtArea = {
  id: string;
  area_key: string;
  label: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

type ProductMgmtItem = {
  ask_submission_id: string | null;
  id: string;
  area_id: string;
  title: string;
  body: string;
  status: ProductMgmtStatus;
  priority: ProductMgmtPriority;
  current_version_number: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type AdminReadonlyProfile = {
  id: string;
  display_name: string | null;
  masked_email: string | null;
  account_created_at: string | null;
  last_seen_at: string | null;
  onboarding_completed_at: string | null;
  beta_terms_acknowledged_at: string | null;
  beta_privacy_acknowledged_at: string | null;
  beta_disclaimer_acknowledged_at: string | null;
  requires_email_update: boolean;
  is_admin: boolean;
  is_test_user: boolean;
  has_contact_details: boolean;
};

type AdminReadonlyCounts = {
  appointment_count: number;
  upcoming_appointment_count: number;
  logged_appointment_count: number;
  note_count: number;
  careprep_count: number;
  support_ticket_count: number;
};

type AdminReadonlyEntitlement = {
  care_circle_id: string;
  max_active_subjects: number | null;
  plan_id: string | null;
  plan_name: string | null;
  status: string | null;
};

type AdminReadonlyAppointment = {
  id: string;
  care_subject_id: string | null;
  current_note_id: string | null;
  current_guidance_id: string | null;
  current_guidance_review_status: string | null;
  created_at: string | null;
  title_preview: string | null;
  starts_on: string | null;
  status: string;
  updated_at: string | null;
  is_sample_data: boolean;
  has_starts_at: boolean;
  has_provider_name: boolean;
  has_provider_organization: boolean;
  has_location_name: boolean;
  provider_name_preview: string | null;
  provider_organization_preview: string | null;
  location_name_preview: string | null;
  has_reason: boolean;
  has_location_address: boolean;
  has_location_phone: boolean;
  has_note: boolean;
  has_careprep: boolean;
};

type AdminReadonlySnapshot = {
  appointments: AdminReadonlyAppointment[];
  care_subjects: CareSubject[];
  counts: AdminReadonlyCounts;
  entitlements: AdminReadonlyEntitlement[];
  profile: AdminReadonlyProfile;
};

type AdminSensitiveResourceType =
  | "appointment_details"
  | "appointment_note"
  | "careprep_guidance"
  | "profile_contact";

type AdminRevealedSensitiveData = Record<string, unknown> & {
  resource_type?: AdminSensitiveResourceType;
};

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

function CalendarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect height="18" rx="2" width="18" x="3" y="4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function MapPinIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M20 10c0 4.5-8 11-8 11s-8-6.5-8-11a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PencilSquareIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L12 14l-4 1 1-4 7.5-7.5Z" />
    </svg>
  );
}

function RefreshCircleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M21 12a9 9 0 0 1-15.2 6.5" />
      <path d="M3 12A9 9 0 0 1 18.2 5.5" />
      <path d="M18 2v4h-4" />
      <path d="M6 22v-4h4" />
    </svg>
  );
}

function GearIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05a2.1 2.1 0 1 1-2.97 2.97l-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.08 1.65V21a2.1 2.1 0 1 1-4.2 0v-.07a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-2 .36l-.05.05a2.1 2.1 0 1 1-2.97-2.97l.05-.05a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.57 13H2.5a2.1 2.1 0 1 1 0-4.2h.07a1.8 1.8 0 0 0 1.65-1.08 1.8 1.8 0 0 0-.36-2l-.05-.05A2.1 2.1 0 0 1 6.78 2.7l.05.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.9 1.46V1.4a2.1 2.1 0 1 1 4.2 0v.06a1.8 1.8 0 0 0 1.08 1.65 1.8 1.8 0 0 0 2-.36l.05-.05a2.1 2.1 0 1 1 2.97 2.97l-.05.05a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.65 1.08h.06a2.1 2.1 0 1 1 0 4.2h-.06A1.8 1.8 0 0 0 19.4 15Z" />
    </svg>
  );
}

function UserIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <path d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
    </svg>
  );
}

function EllipsisVerticalIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

type AppointmentView = "archived" | "logged" | "upcoming";
type AiAdminTab =
  | "agentKnowledge"
  | "history"
  | "instructions"
  | "proposals";
type AdminTab =
  | "dashboard"
  | "ai"
  | "assistantReview"
  | "content"
  | "errors"
  | "intake"
  | "product"
  | "tickets"
  | "tools"
  | "userAudit"
  | "users";
type AdminTopTab = "dashboard" | "support" | "system" | "tools" | "users";
type StoredAdminTab = AdminTab | "messages";
type AdminViewScopeType = "admin_tab" | "ai_admin_tab" | "product_area";
type AdminViewState = {
  admin_user_id: string;
  last_viewed_at: string;
  scope_key: string;
  scope_type: AdminViewScopeType;
  updated_at: string;
};
type AdminAttentionSummary = {
  followup_count: number;
  latest_activity_at: string | null;
  new_count: number;
  scope_key: string;
  scope_type: AdminViewScopeType;
};
type AiWorkflowKey =
  | "admin_hq_prioritization"
  | "ask_onboarding_helper"
  | "ask_user_response_rubric"
  | "bulk_appointment_intake"
  | "careprep_generation"
  | "note_intake_interpretation"
  | "support_assistant";
type AuthMode = "reset" | "signIn" | "signUp" | "updatePassword";
type AppointmentPanel = "add" | "quickAdd";
type AppointmentModifier = "add" | "edit" | "import";
type MainTab = "admin" | "appointments" | "home" | "profile";
type ProductMgmtSection = string;
type ProductMgmtStatus = "deferred" | "in_progress" | "open" | "resolved";
type ProductMgmtPriority = "high" | "low" | "medium";
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
type ProductMgmtItemDraft = {
  areaId: string;
  body: string;
  changeNote: string;
  priority: ProductMgmtPriority;
  status: ProductMgmtStatus;
  title: string;
};
type PendingModifierSwitch = {
  appointmentId: string;
  target: AppointmentModifier | null;
};
type ToastState = {
  actionLabel?: string;
  durationMs?: number;
  id: number;
  message: string;
  onAction?: () => void;
  type?: "error" | "info" | "success" | "warning";
};

type CarePrepHistoryRow = {
  id: string;
  appointment_id: string;
  generated_at: string | null;
  summary: string | null;
  is_current: boolean;
  version_number: number;
  review_status: string | null;
  source: string | null;
  model: string | null;
  prompt_version: string | null;
  instruction_content_hash: string | null;
  instruction_version_id: string | null;
  edited_from_guidance_id: string | null;
  ai_generated_guidance_id: string | null;
  superseded_at: string | null;
  superseded_by_guidance_id: string | null;
};

type IntakeHistoryRow = {
  id: string;
  accepted_at?: string | null;
  accepted_interpretation?: unknown;
  ai_interpretation?: unknown;
  created_at: string | null;
  error_message?: string | null;
  instruction_content_hash?: string | null;
  interpretation?: unknown;
  match_status?: string | null;
  model?: string | null;
  prompt_version?: string | null;
  raw_text: string | null;
  source_type: string | null;
  status: string | null;
};

type TextIntakeDraft = {
  appointmentReason: string;
  appointmentTitle: string;
  confidence: number;
  followups: string;
  locationAddress: string;
  locationName: string;
  locationPhone: string;
  notesSummary: string;
  providerName: string;
  providerOrganization: string;
  startsAt: string;
  suggestedAction: string;
  takeaways: string;
};

type BulkAppointmentDraft = {
  appointmentReason: string;
  appointmentTitle: string;
  confidence: number;
  importId: string;
  isSelected: boolean;
  locationAddress: string;
  locationName: string;
  locationPhone: string;
  providerName: string;
  providerOrganization: string;
  startsAt: string;
  suggestedAction: string;
};

type TextIntakeMatch = {
  appointment: Appointment;
  currentNote: AppointmentNote | null;
  reasons: string[];
  score: number;
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

type ProfileDraft = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  displayName: string;
  email: string;
  familyName: string;
  givenName: string;
  phone: string;
  postalCode: string;
  region: string;
  timezone: string;
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
  activeAppointmentPanel?: AppointmentPanel | null;
  adminTab?: StoredAdminTab;
  aiAdminTab?: AiAdminTab;
  appointmentView?: AppointmentView;
  mainTab?: MainTab;
  selectedAiWorkflow?: AiWorkflowKey;
  selectedAppContentCategory?: string;
  selectedAppContentKey?: string;
  selectedProductMgmtSection?: string;
  selectedSubjectId?: string;
};

type StoredDraftState = {
  appointmentDrafts?: Record<string, typeof emptyAppointmentDraft>;
  bulkAppointmentDrafts?: BulkAppointmentDraft[];
  bulkAppointmentSummary?: string;
  carePrepDrafts?: Record<string, typeof emptyCarePrepDraft>;
  contextualTextIntakeValue?: string;
  editingAppointmentIds?: Record<string, boolean>;
  editingCarePrepIds?: Record<string, boolean>;
  editingNoteIds?: Record<string, boolean>;
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
  textIntakeAiDraft?: TextIntakeDraft | null;
  textIntakeDraft?: TextIntakeDraft | null;
  textIntakeItemId?: string | null;
  textIntakeMatches?: TextIntakeMatch[];
  selectedTextIntakeMatchId?: string;
  textIntakeSubjectId?: string;
  textIntakeTargetAppointmentId?: string | null;
  textIntakeValue?: string;
};

type UnsavedChangeSummary = {
  detail?: string;
  key: string;
  label: string;
};

const ALL_SUBJECTS = "all";
const appUiStateStorageKey = "carepland-ui-state:v1";
const appDraftStateStorageKey = "carepland-draft-state:v1";
const appLastActivityStorageKey = "carepland-last-activity-at:v1";

const defaultEntitlement: CareCircleEntitlement = {
  max_active_subjects: 1,
  plan_id: "personal",
  plan_name: "Free",
};

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

const appContentDefaults = {
  beta_disclaimer_ack:
    "I understand this Early Access version is not for emergencies or critical medical decisions.",
  beta_notice_intro:
    "CarePland Personal is currently available through Early Access. Formal Terms of Service and Privacy Policy pages are not enabled yet.",
  beta_privacy_ack:
    "I understand formal Privacy Policy review is not currently enabled for this Early Access version.",
  beta_terms_ack:
    "I understand formal Terms of Service are not currently enabled for this Early Access version.",
  demo_profile_add_body:
    "Add a few fictional appointments, notes, and CarePrep examples if you want a guided workspace to explore.",
  demo_profile_remove_body:
    "Demo appointments are not real appointments. Removing demo data deletes only items marked as demo data and keeps your real information.",
  demo_prompt_body:
    "CarePland can add a few fictional appointments, notes, and CarePrep examples so you can explore before entering your own information.",
  demo_prompt_title: "Want examples to explore?",
  ...planFeatureContentDefaults,
  careprep_manual_limit_message:
    "You have used this month's manual CarePrep generations. Plan changes are not wired up yet, but support can help while account changes are still handled manually.",
  careprep_refresh_not_ready_message:
    "CarePrep can't be run yet because you have no additional appointments to consider.",
  careprep_auto_success_message:
    "CarePrep generated for {appointmentTitle}.",
  ask_guidance_message:
    "Questions, ideas, workflow feedback, or things that felt confusing — tell us what’s on your mind.",
  ask_acknowledgement_message:
    "Thank you for taking the time to ask us. We do review every request!",
  ask_duplicate_message:
    "Thanks — we got your question!",
  support_contact_note:
    "Need help or want to report an issue? Contact support from the app and include what you were trying to do.",
  support_reply_email_body:
    "You've got a response to your CarePland question. Please log in to review it.\n\n{appUrl}",
  support_reply_email_subject:
    "You have a response to your CarePland question",
  support_missing_feedback_prompt: "What was missing?",
  support_agent_escalation_guidance:
    "Escalate bugs, account access issues, data loss, billing/privacy/security concerns, emergency or medical advice requests, data-changing requests, unclear issues, and frustrated users.",
  support_agent_known_limitations:
    "Calendar sync is not live yet. SMS/text notifications are not live yet. Favorite location management is basic. Google Places autocomplete can be temporarily unavailable if quota or key restrictions block requests. Self-service billing and plan changes are not wired up yet; plan questions or account-specific tier issues should be escalated to support.",
  support_agent_product_facts:
    "CarePland Personal helps people remember appointment details, prepare for future visits, and bring saved context forward. Users can add appointments manually, import appointments from pasted text, images, and .ics calendar files, search Google Places for clinics/businesses/addresses, save favorite locations with nicknames, generate CarePrep for upcoming appointments, add notes to logged appointments, and ask questions in the app. New users complete profile basics, Early Access acknowledgements, Care Circle setup, and a Home welcome guide before regular app use. Early Access currently gives early adopters full access, including multiple Care VIPs and automatic appointment preparation where available. Manual CarePrep generation can be metered by plan; automatic appointment preparation is intended for Premium Individual, Group, and Early Access tiers. After Visit Notes are saved, CarePland can automatically prepare the next upcoming appointment for the same Care VIP when the plan includes automatic CarePrep. CarePrep refresh is only available when there are additional appointments to consider.",
  support_agent_voice_guidance:
    "Use a warm, steady, and practical tone. Be empathetic without pretending intimacy, supportive without being syrupy, and clear about limits without sounding cold. Be confident on app guidance, humble on care-related questions, and never corporate-deflective or fake-cheerful when a user is frustrated.",
  welcome_guide_body:
    "Help is always available in the upper right [?].",
  welcome_guide_title: "Welcome to CarePland",
};

const appContentOptions = [
  {
    category: "beta",
    contentKey: "beta_notice_intro",
    description: "Introductory text shown before Early Access acknowledgement checkboxes.",
    label: "Early Access notice intro",
  },
  {
    category: "beta",
    contentKey: "beta_terms_ack",
    description: "Checkbox text confirming Terms of Service status during Early Access.",
    label: "Early Access terms acknowledgement",
  },
  {
    category: "beta",
    contentKey: "beta_privacy_ack",
    description: "Checkbox text confirming Privacy Policy status during Early Access.",
    label: "Early Access privacy acknowledgement",
  },
  {
    category: "beta",
    contentKey: "beta_disclaimer_ack",
    description: "Checkbox text confirming Early Access safety limitations.",
    label: "Early Access safety acknowledgement",
  },
  {
    category: "support",
    contentKey: "support_contact_note",
    description: "General support context for Early Access users.",
    label: "Support contact note",
  },
  {
    category: "support",
    contentKey: "support_missing_feedback_prompt",
    description:
      "Optional prompt shown after a support assistant answer is marked not helpful.",
    label: "Support assistant missing-feedback prompt",
  },
  {
    category: "ai",
    contentKey: "support_agent_product_facts",
    description:
      "Current product facts injected into the support assistant knowledge context.",
    label: "Agent product facts",
  },
  {
    category: "ai",
    contentKey: "support_agent_known_limitations",
    description:
      "Known limitations injected into the support assistant knowledge context.",
    label: "Agent known limitations",
  },
  {
    category: "ai",
    contentKey: "support_agent_escalation_guidance",
    description:
      "Escalation rules injected into the support assistant knowledge context.",
    label: "Agent escalation guidance",
  },
  {
    category: "ai",
    contentKey: "support_agent_voice_guidance",
    description:
      "Tone guidance injected into the support assistant knowledge context.",
    label: "Agent voice guidance",
  },
  {
    category: "communications",
    contentKey: "support_reply_email_subject",
    description:
      "Subject line for the generic email sent after an admin replies to a support question.",
    label: "Support reply email subject",
  },
  {
    category: "communications",
    contentKey: "support_reply_email_body",
    description:
      "Body text for the generic support reply notification. Supported placeholders: {appUrl}, {recipientName}.",
    label: "Support reply email body",
  },
  {
    category: "onboarding",
    contentKey: "welcome_guide_title",
    description: "Headline for the first-run welcome card on the appointments screen.",
    label: "Welcome guide title",
  },
  {
    category: "onboarding",
    contentKey: "welcome_guide_body",
    description: "Introductory guidance shown in the first-run welcome card.",
    label: "Welcome guide body",
  },
  {
    category: "onboarding",
    contentKey: "demo_prompt_title",
    description: "Headline for the first-run demo data offer.",
    label: "Demo data prompt title",
  },
  {
    category: "onboarding",
    contentKey: "demo_prompt_body",
    description: "Body text explaining the first-run demo data offer.",
    label: "Demo data prompt body",
  },
  {
    category: "onboarding",
    contentKey: "demo_profile_remove_body",
    description: "Profile page explanation shown before removing demo data.",
    label: "Demo data removal note",
  },
  {
    category: "onboarding",
    contentKey: "demo_profile_add_body",
    description: "Profile page explanation shown before adding demo data.",
    label: "Demo data add note",
  },
  ...pricingTiers.map((tier) => ({
    category: "plans",
    contentKey: planProfilePanelContentKey(tier.id),
    description:
      "Whole editable block shown in the Profile plan helper. First line is the brief summary; following lines may use Label: value.",
    label: `${tier.name}: Profile plan panel`,
  })),
  {
    category: "messages",
    contentKey: "ask_guidance_message",
    description:
      "Guidance text shown at the top of the Ask panel before a user sends a message.",
    label: "Ask guidance message",
  },
  {
    category: "messages",
    contentKey: "ask_acknowledgement_message",
    description:
      "Message shown after an Ask conversation has been accepted for review.",
    label: "Ask acknowledgement message",
  },
  {
    category: "messages",
    contentKey: "ask_duplicate_message",
    description:
      "Message shown when a user tries to submit the same Ask message more than once.",
    label: "Ask duplicate message",
  },
  {
    category: "messages",
    contentKey: "careprep_manual_limit_message",
    description:
      "Message shown when a user has used the current plan allowance for manual CarePrep generations.",
    label: "Manual CarePrep limit message",
  },
  {
    category: "messages",
    contentKey: "careprep_refresh_not_ready_message",
    description:
      "Message shown when a user tries to refresh CarePrep before new appointment history is available.",
    label: "CarePrep refresh not-ready message",
  },
  {
    category: "messages",
    contentKey: "careprep_auto_success_message",
    description:
      "Expiring blue status shown after automatic CarePrep prepares an appointment. Supported placeholder: {appointmentTitle}.",
    label: "Automatic CarePrep success message",
  },
];

const appContentCategories = [
  {
    description: "Testing notices, temporary legal acknowledgements, and safety language.",
    key: "beta",
    label: "Early Access and legal",
  },
  {
    description: "Support guidance and help text shown to users.",
    key: "support",
    label: "Support",
  },
  {
    description: "Product facts and guardrails injected into AI assistant context.",
    key: "ai",
    label: "AI Agent",
  },
  {
    description:
      "Email and notification wording that invites users back into the app.",
    key: "communications",
    label: "Communications",
  },
  {
    description: "First-run guidance, demo data prompts, and welcome copy.",
    key: "onboarding",
    label: "Onboarding",
  },
  {
    description: "Plan feature wording shown in Profile and future billing surfaces.",
    key: "plans",
    label: "Plans",
  },
  {
    description: "Short status, success, warning, and validation messages.",
    key: "messages",
    label: "Messages",
  },
] as const;

const productMgmtSections = [
  {
    description: "Regressions, confusing behavior, and things that should be verified as fixed.",
    key: "bug",
    label: "Bugs",
  },
  {
    description: "Must-have items before inviting Early Access users.",
    key: "beta",
    label: "Early Access Readiness",
  },
  {
    description: "A running note of visible changes, deployment notes, and known limitations.",
    key: "release",
    label: "Release Notes",
  },
  {
    description: "Useful ideas that should not interrupt the current beta path.",
    key: "wishlist",
    label: "Wishlist",
  },
  {
    description: "AI interpretation quality, prompt behavior, and review tooling.",
    key: "ai_qa",
    label: "AI / QA",
  },
  {
    description: "Maintenance tools, test data, error visibility, and support workflows.",
    key: "admin_ops",
    label: "Admin / Ops",
  },
] as const;

const betaAgreementVersion = "beta-2026-05-19";
const currentWelcomeGuideVersion = "welcome-2026-05-23";

const emptyProfileDraft: ProfileDraft = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  country: "US",
  displayName: "",
  email: "",
  familyName: "",
  givenName: "",
  phone: "",
  postalCode: "",
  region: "",
  timezone: "",
};

function profileDisplayName(
  profile: Pick<ProfileDraft, "displayName" | "email" | "familyName" | "givenName">
) {
  const fullName = [profile.givenName.trim(), profile.familyName.trim()]
    .filter(Boolean)
    .join(" ");

  return profile.displayName.trim() || fullName || profile.email.trim();
}

function profileDraftKey(profile: ProfileDraft) {
  return JSON.stringify({
    addressLine1: profile.addressLine1.trim(),
    addressLine2: profile.addressLine2.trim(),
    city: profile.city.trim(),
    country: profile.country.trim(),
    displayName: profile.displayName.trim(),
    email: profile.email.trim(),
    familyName: profile.familyName.trim(),
    givenName: profile.givenName.trim(),
    phone: profile.phone.trim(),
    postalCode: profile.postalCode.trim(),
    region: profile.region.trim(),
    timezone: profile.timezone.trim(),
  });
}

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

const defaultCarePrepOutputSchema = {
  additionalProperties: false,
  properties: {
    bring_list: { items: { type: "string" }, type: "array" },
    key_questions: { items: { type: "string" }, type: "array" },
    med_review: { items: { type: "string" }, type: "array" },
    next_steps: { items: { type: "string" }, type: "array" },
    since_last_visit: { items: { type: "string" }, type: "array" },
    summary: { type: "string" },
    watchouts: { items: { type: "string" }, type: "array" },
  },
  required: ["summary", "key_questions", "bring_list"],
  type: "object",
};

const defaultTextIntakeOutputSchema = {
  additionalProperties: false,
  properties: {
    appointment_reason: { type: "string" },
    appointment_title: { type: "string" },
    confidence: { type: "number" },
    followups: { items: { type: "string" }, type: "array" },
    location_address: { type: "string" },
    location_name: { type: "string" },
    location_phone: { type: "string" },
    notes_summary: { type: "string" },
    provider_name: { type: "string" },
    provider_organization: { type: "string" },
    starts_at_local: { type: "string" },
    suggested_action: { type: "string" },
    takeaways: { items: { type: "string" }, type: "array" },
  },
  required: [
    "appointment_title",
    "appointment_reason",
    "starts_at_local",
    "provider_name",
    "provider_organization",
    "location_name",
    "location_address",
    "location_phone",
    "notes_summary",
    "takeaways",
    "followups",
    "confidence",
    "suggested_action",
  ],
  type: "object",
};

const defaultBulkAppointmentOutputSchema = {
  additionalProperties: false,
  properties: {
    appointments: {
      items: {
        additionalProperties: false,
        properties: {
          appointment_reason: { type: "string" },
          appointment_title: { type: "string" },
          confidence: { type: "number" },
          location_address: { type: "string" },
          location_name: { type: "string" },
          location_phone: { type: "string" },
          provider_name: { type: "string" },
          provider_organization: { type: "string" },
          starts_at_local: { type: "string" },
          suggested_action: { type: "string" },
        },
        required: [
          "appointment_title",
          "appointment_reason",
          "starts_at_local",
          "provider_name",
          "provider_organization",
          "location_name",
          "location_address",
          "location_phone",
          "confidence",
          "suggested_action",
        ],
        type: "object",
      },
      maxItems: 10,
      type: "array",
    },
    import_summary: { type: "string" },
  },
  required: ["appointments", "import_summary"],
  type: "object",
};

const defaultSupportAssistantOutputSchema = {
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    category: { type: "string" },
    confidence: { type: "number" },
    escalation_recommended: { type: "boolean" },
    escalation_reason: { type: "string" },
    priority: { enum: ["low", "medium", "high", "urgent"], type: "string" },
    suggested_next_step: { type: "string" },
  },
  required: [
    "answer",
    "suggested_next_step",
    "confidence",
    "escalation_recommended",
    "escalation_reason",
    "category",
    "priority",
  ],
  type: "object",
};

const defaultAdminHqPrioritizationOutputSchema = {
  additionalProperties: false,
  properties: {
    engagementWatchlist: {
      items: {
        additionalProperties: false,
        properties: {
          sourceCount: { type: "number" },
          suggestedAction: { type: "string" },
          title: { type: "string" },
          whyItMatters: { type: "string" },
        },
        required: ["title", "whyItMatters", "suggestedAction", "sourceCount"],
        type: "object",
      },
      type: "array",
    },
    highestPriority: {
      items: {
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          rank: { type: "number" },
          severity: { enum: ["critical", "high", "medium", "low"], type: "string" },
          sourceCount: { type: "number" },
          sourceRefs: { items: { type: "string" }, type: "array" },
          suggestedAction: { type: "string" },
          title: { type: "string" },
          whyItMatters: { type: "string" },
        },
        required: [
          "rank",
          "category",
          "title",
          "whyItMatters",
          "suggestedAction",
          "severity",
          "sourceCount",
          "sourceRefs",
        ],
        type: "object",
      },
      type: "array",
    },
    lowerPrioritySignals: {
      items: {
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          sourceCount: { type: "number" },
          summary: { type: "string" },
          title: { type: "string" },
        },
        required: ["category", "title", "summary", "sourceCount"],
        type: "object",
      },
      type: "array",
    },
    openQuestions: { items: { type: "string" }, type: "array" },
    overallSummary: { type: "string" },
  },
  required: [
    "overallSummary",
    "highestPriority",
    "engagementWatchlist",
    "lowerPrioritySignals",
    "openQuestions",
  ],
  type: "object",
};

const defaultAdminHqPrioritizationSystemPrompt = `You are the CarePland Personal Admin HQ prioritization assistant.

Your job is to help the admin understand what deserves attention first across the Admin area. You are not a product strategist, medical advisor, support agent, or autonomous operator. You do not change data, close tickets, publish content, alter priorities, or make decisions on behalf of the admin.

Core philosophy:
CarePland Personal is a calm appointment memory and preparation system. Admin should help a solo operator see what matters without creating more noise. Your output should reduce cognitive load, not add another dashboard maze. Be concrete, concise, and operational.

Prioritization order:
1. Operational failure: system errors, integration failures, broken imports, failed CarePrep/OCR/AI workflows, email notification failures, or anything that may block normal app use.
2. User-reported problems: support tickets, reported bugs, user confusion that prevents task completion, urgent or repeated user complaints.
3. Early Access readiness blockers: open regressions, onboarding blockers, high-priority bugs, unresolved issues that reduce confidence in inviting or supporting Early Access users.
4. AI / quality review: assistant answers needing review, not-helpful feedback, Agent Knowledge proposals, OCR/import/CarePrep quality concerns, stale prompt or product-knowledge risks.
5. Stale follow-ups: old open product items, unresolved tickets, long-running review items, forgotten admin tasks.
6. User engagement / continuity health: users who have not logged in, have not completed onboarding, have appointments without Notes or CarePrep, imported but did not review/save, or are not using the system in a way that gives them continuity value.
7. Product direction / wishlist: feature ideas, UX improvements, wishlist clusters, non-urgent polish.

Rules:
- Prioritize user harm, app failure, and Early Access confidence over general product ideas.
- Prefer clear explanations over dramatic language.
- Do not overstate certainty. If a pattern is only suggested by the data, say so.
- Group related items when useful, but preserve the source categories.
- Always explain why an item is ranked high.
- Always include counts or source references when available.
- Do not invent records, user behavior, or error causes.
- Do not expose sensitive user details unless they are included in the provided Admin-safe input.
- Keep recommendations practical and short.

Output style:
Use calm, direct Admin language. The admin should be able to scan the result in under a minute.`;

const defaultAdminHqPrioritizationUserPrompt = `Review the following Admin-safe CarePland data and produce an Admin HQ prioritization brief.

Use the priority hierarchy from the system instructions. Focus on what deserves attention first.

Admin data:
{{admin_attention_payload}}

Current date:
{{current_date}}

Return concise JSON matching the schema.`;

const aiWorkflows: Record<
  AiWorkflowKey,
  {
    defaultChangeNote: string;
    defaultSchema: unknown;
    defaultSystemPrompt?: string;
    defaultUserPrompt?: string;
    description: string;
    historyLabel: string;
    label: string;
  }
> = {
  admin_hq_prioritization: {
    defaultChangeNote: "Initial Admin HQ prioritization instruction set",
    defaultSchema: defaultAdminHqPrioritizationOutputSchema,
    defaultSystemPrompt: defaultAdminHqPrioritizationSystemPrompt,
    defaultUserPrompt: defaultAdminHqPrioritizationUserPrompt,
    description:
      "Instructions used to summarize and prioritize Admin operational signals.",
    historyLabel: "Admin HQ History",
    label: "Admin HQ prioritization",
  },
  ask_user_response_rubric: {
    defaultChangeNote: "Initial Ask user-facing response rubric",
    defaultSchema: {},
    defaultSystemPrompt:
      "Ask should sound like a CarePland routing surface, not a human agent. Avoid first-person assistant phrasing such as I, me, my, we, we're, we've, and we'll whenever practical. Prefer neutral constructions such as \"This will be raised for review,\" \"This may need a closer look,\" \"A little more detail would help route this correctly,\" or \"Thanks for adding this.\" Do not deny that Ask is AI or pretend to be human. If AI identity is directly relevant, explain it plainly without overemphasizing it. Keep responses brief, calm, respectful, and non-corporate.",
    defaultUserPrompt:
      "Apply this rubric to user-facing Ask module responses unless a more specific approved instruction overrides it.",
    description:
      "Global response philosophy used by Ask modules when writing user-facing text.",
    historyLabel: "Ask Rubric History",
    label: "Ask user response rubric",
  },
  ask_onboarding_helper: {
    defaultChangeNote: "Initial Ask onboarding helper instruction set",
    defaultSchema: {
      additionalProperties: false,
      properties: {
        answer: { type: "string" },
        confidence: { type: "number" },
        escalation_reason: { type: "string" },
        escalation_recommended: { type: "boolean" },
        recommended_actions: {
          items: {
            additionalProperties: true,
            properties: {
              action: { type: "string" },
              confidence: { type: "number" },
              priority: { type: "string" },
              rationale: { type: "string" },
              title: { type: "string" },
            },
            required: ["action", "confidence", "rationale", "title"],
            type: "object",
          },
          type: "array",
        },
        summary: { type: "string" },
      },
      required: [
        "answer",
        "confidence",
        "escalation_reason",
        "escalation_recommended",
        "recommended_actions",
        "summary",
      ],
      type: "object",
    },
    defaultSystemPrompt:
      "You are the CarePland Personal Ask onboarding helper. Answer low-risk getting-started questions about profile setup, Early Access acknowledgements, Care Circle setup, the first-run Home welcome guide, adding a first appointment, importing appointment details, and demo examples. For profile setup, explain that CarePland asks for basic account/contact details so dates, reminders, time zones, and support follow-up work correctly: first and last name, phone, time zone, and ZIP are required; display name and street address details are optional unless the app marks them otherwise. Keep this from sounding like a medical intake form. If the user says they are confused, lost, unsure what the welcome screen means, or asks what to do next, respond with gentle orientation: reassure them briefly, explain that CarePland helps carry important appointment context forward from one visit to the next, name a few examples such as what changed, what mattered, and what to ask next, then suggest the easiest next step: adding or importing a first appointment. Keep answers brief, calm, and practical. Avoid first-person assistant phrasing such as I, me, my, we, we're, we've, and we'll whenever practical. Do not give medical, legal, privacy, account-security, billing, or emergency advice. Do not claim to change data. Escalate if the user appears blocked by account state, email update, authentication, profile saving, missing Care Circle setup, data loss, or frustration. Return valid JSON exactly matching the schema.",
    defaultUserPrompt:
      "Use the supplied Ask thread, current page, app context, and onboarding facts. Either answer the onboarding question or recommend review when account-specific help is needed.",
    description:
      "Instructions used by Ask to answer low-risk onboarding and getting-started questions.",
    historyLabel: "Ask Onboarding History",
    label: "Ask onboarding helper",
  },
  careprep_generation: {
    defaultChangeNote: "Initial CarePrep instruction set",
    defaultSchema: defaultCarePrepOutputSchema,
    description: "Instructions used to generate appointment preparation guidance.",
    historyLabel: "CarePrep History",
    label: "CarePrep generation",
  },
  bulk_appointment_intake: {
    defaultChangeNote: "Initial bulk appointment intake instruction set",
    defaultSchema: defaultBulkAppointmentOutputSchema,
    description:
      "Instructions used to extract multiple appointment drafts from pasted text.",
    historyLabel: "Intake History",
    label: "Bulk appointment intake",
  },
  note_intake_interpretation: {
    defaultChangeNote: "Initial note intake instruction set",
    defaultSchema: defaultTextIntakeOutputSchema,
    description:
      "Instructions used to interpret pasted appointment notes and appointment details.",
    historyLabel: "Intake History",
    label: "Note intake interpretation",
  },
  support_assistant: {
    defaultChangeNote: "Initial support assistant instruction set",
    defaultSchema: defaultSupportAssistantOutputSchema,
    description:
      "Instructions used to answer low-risk support questions before ticket escalation.",
    historyLabel: "Support Assistant History",
    label: "Support assistant",
  },
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const productionAppUrl = "https://app.carepland.com";
const careplandBuildNumber =
  process.env.NEXT_PUBLIC_CAREPLAND_BUILD_NUMBER ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
  "02345e9a";
const careplandBuildDttm =
  process.env.NEXT_PUBLIC_CAREPLAND_BUILD_DTTM ?? "05/21/26 12:51 PM";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const emptyNoteDraft = {
  followups: "",
  summary: "",
  takeaways: "",
};

const emptyAppointmentDraft = {
  locationAddress: "",
  locationName: "",
  locationPhone: "",
  providerName: "",
  providerOrganization: "",
  reason: "",
  startsAt: "",
  status: "scheduled",
  title: "",
};

const emptyTextIntakeDraft: TextIntakeDraft = {
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

const emptyCarePrepDraft = {
  bringList: "",
  keyQuestions: "",
  medReview: "",
  nextSteps: "",
  sinceLastVisit: "",
  summary: "",
  watchouts: "",
};

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

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && "text" in item) {
        return String(item.text);
      }

      return "";
    })
    .filter(Boolean);
}

function adminSensitiveKey(
  resourceType: AdminSensitiveResourceType,
  resourceId: string | null = null
) {
  return `${resourceType}:${resourceId ?? "profile"}`;
}

function shortId(value: string | null): string {
  return value ? value.slice(0, 8) : "—";
}

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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
  draft: TextIntakeDraft
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

function formatAdminDate(value: string | null): string {
  return value ? formatDate(value) : "—";
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

function browserTimezone(): string {
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (
    detectedTimezone &&
    timeZoneOptions.some((option) => option.value === detectedTimezone)
  ) {
    return detectedTimezone;
  }

  return "";
}

function formatUsPhoneFromDigits(digits: string): string {
  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const line = digits.slice(6, 10);

  if (digits.length <= 3) {
    return area ? `(${area}` : "";
  }

  if (digits.length <= 6) {
    return `(${area}) ${prefix}`;
  }

  return `(${area}) ${prefix}-${line}`;
}

function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

function normalizeUsPhone(value: string):
  | { display: string; e164: string }
  | null {
  const digits = phoneDigits(value);

  if (digits.length !== 10) {
    return null;
  }

  return {
    display: formatUsPhoneFromDigits(digits),
    e164: `+1${digits}`,
  };
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidUsZip(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value.trim());
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
}: {
  emptyLabel: string;
  items: string[];
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-2 space-y-2 text-slate-700">
      {items.map((item) => (
        <li className="flex gap-2" key={item}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
          <span>{item}</span>
        </li>
      ))}
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

function adminViewStateKey(scopeType: AdminViewScopeType, scopeKey: string) {
  return `${scopeType}:${scopeKey}`;
}

function isNewForAdmin(
  latestActivityAt: string | null,
  lastViewedAt: string | null
) {
  if (!latestActivityAt) {
    return false;
  }

  if (!lastViewedAt) {
    return true;
  }

  return new Date(latestActivityAt).getTime() > new Date(lastViewedAt).getTime();
}

function isActionableAdminAttentionScope(
  scopeType: AdminViewScopeType,
  scopeKey: string
) {
  if (scopeType === "product_area") {
    return false;
  }

  if (scopeType === "ai_admin_tab") {
    return scopeKey === "proposals";
  }

  if (scopeType === "admin_tab") {
    return !["dashboard", "tools", "users", "content", "product"].includes(
      scopeKey
    );
  }

  return true;
}

function intakeDraftFromResult(value: unknown): TextIntakeDraft {
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

function bulkAppointmentDraftsFromResult(value: unknown): BulkAppointmentDraft[] {
  const result =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const appointments = Array.isArray(result.appointments)
    ? result.appointments
    : [];

  return appointments.slice(0, 10).map((item, index) => {
    const draft =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};

    return {
      appointmentReason: String(draft.appointment_reason ?? ""),
      appointmentTitle: String(draft.appointment_title ?? ""),
      confidence:
        typeof draft.confidence === "number"
          ? draft.confidence
          : Number(draft.confidence) || 0,
      importId: `bulk-${index}`,
      isSelected: true,
      locationAddress: String(draft.location_address ?? ""),
      locationName: String(draft.location_name ?? ""),
      locationPhone: String(draft.location_phone ?? ""),
      providerName: String(draft.provider_name ?? ""),
      providerOrganization: String(draft.provider_organization ?? ""),
      startsAt: String(draft.starts_at_local ?? ""),
      suggestedAction: String(draft.suggested_action ?? ""),
    };
  });
}

function unescapeCalendarText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function formatLocalDateTimeInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseCalendarDateTime(value: string): string {
  const cleanValue = value.trim();
  const dateOnlyMatch = cleanValue.match(/^(\d{4})(\d{2})(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${year}-${month}-${day}T09:00`;
  }

  const dateTimeMatch = cleanValue.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/
  );

  if (!dateTimeMatch) {
    return "";
  }

  const [, year, month, day, hours, minutes, seconds = "00", utcMarker] =
    dateTimeMatch;

  if (utcMarker) {
    return formatLocalDateTimeInput(
      new Date(
        Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hours),
          Number(minutes),
          Number(seconds)
        )
      )
    );
  }

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseICalendarAppointments(
  calendarText: string,
  fileName: string
): { drafts: BulkAppointmentDraft[]; foundCount: number } {
  const unfoldedLines = calendarText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
  const events: Record<string, string>[] = [];
  let currentEvent: Record<string, string> | null = null;

  unfoldedLines.forEach((line) => {
    const trimmedLine = line.trim();

    if (trimmedLine === "BEGIN:VEVENT") {
      currentEvent = {};
      return;
    }

    if (trimmedLine === "END:VEVENT") {
      if (currentEvent) {
        events.push(currentEvent);
      }
      currentEvent = null;
      return;
    }

    if (!currentEvent) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf(":");

    if (separatorIndex < 0) {
      return;
    }

    const propertyName = trimmedLine
      .slice(0, separatorIndex)
      .split(";")[0]
      .toUpperCase();
    const propertyValue = trimmedLine.slice(separatorIndex + 1);

    if (!currentEvent[propertyName]) {
      currentEvent[propertyName] = propertyValue;
    }
  });

  const now = new Date();
  const futureEvents = events
    .map((event, index) => {
      const startsAt = parseCalendarDateTime(event.DTSTART ?? "");
      const startsAtDate = startsAt ? new Date(startsAt) : null;

      return {
        event,
        index,
        startsAt,
        startsAtDate,
      };
    })
    .filter(
      (event) =>
        event.startsAt &&
        event.startsAtDate &&
        !Number.isNaN(event.startsAtDate.getTime()) &&
        event.startsAtDate >= now
    )
    .sort(
      (firstEvent, secondEvent) =>
        (firstEvent.startsAtDate?.getTime() ?? 0) -
        (secondEvent.startsAtDate?.getTime() ?? 0)
    );

  const drafts = futureEvents.slice(0, 100).map(({ event, index, startsAt }) => {
    const summary = unescapeCalendarText(event.SUMMARY ?? "Calendar event");
    const location = unescapeCalendarText(event.LOCATION ?? "");
    const description = unescapeCalendarText(event.DESCRIPTION ?? "");

    return {
      appointmentReason: description,
      appointmentTitle: summary,
      confidence: 0,
      importId: `ics-${fileName}-${index}`,
      isSelected: false,
      locationAddress: location,
      locationName: "",
      locationPhone: "",
      providerName: "",
      providerOrganization: "",
      startsAt,
      suggestedAction: "Calendar import. Review and select before saving.",
    };
  });

  return {
    drafts,
    foundCount: futureEvents.length,
  };
}

export default function Home() {
  const mainHeaderRef = useRef<HTMLElement | null>(null);
  const adminReadonlyPanelRef = useRef<HTMLElement | null>(null);
  const [stickySecondaryOffset, setStickySecondaryOffset] = useState(0);
  const [runtimeEnvironmentLabel, setRuntimeEnvironmentLabel] = useState("");
  const [showVersionInfo, setShowVersionInfo] = useState(false);
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
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [showAuthGateway, setShowAuthGateway] = useState(false);
  const [planHelpExpanded, setPlanHelpExpanded] = useState(false);
  const [adminPlanPreviewId, setAdminPlanPreviewId] = useState("");
  const [activeAppointmentPanel, setActiveAppointmentPanel] =
    useState<AppointmentPanel | null>(
      initialUiState?.activeAppointmentPanel ?? null
    );
  const [mainTab, setMainTab] = useState<MainTab>(
    initialUiState?.mainTab ?? "home"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newAppointmentTitle, setNewAppointmentTitle] = useState(
    initialDraftState?.newAppointmentDraft?.title ?? ""
  );
  const [newAppointmentReason, setNewAppointmentReason] = useState(
    initialDraftState?.newAppointmentDraft?.reason ?? ""
  );
  const [newAppointmentStartsAt, setNewAppointmentStartsAt] = useState(
    initialDraftState?.newAppointmentDraft?.startsAt ?? ""
  );
  const [newAppointmentProviderName, setNewAppointmentProviderName] =
    useState(initialDraftState?.newAppointmentDraft?.providerName ?? "");
  const [
    newAppointmentProviderOrganization,
    setNewAppointmentProviderOrganization,
  ] = useState(
    initialDraftState?.newAppointmentDraft?.providerOrganization ?? ""
  );
  const [newAppointmentLocationName, setNewAppointmentLocationName] =
    useState(initialDraftState?.newAppointmentDraft?.locationName ?? "");
  const [newAppointmentLocationAddress, setNewAppointmentLocationAddress] =
    useState(initialDraftState?.newAppointmentDraft?.locationAddress ?? "");
  const [newAppointmentLocationPhone, setNewAppointmentLocationPhone] =
    useState(initialDraftState?.newAppointmentDraft?.locationPhone ?? "");
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
    useState<TextIntakeDraft | null>(initialDraftState?.textIntakeDraft ?? null);
  const [textIntakeAiDraft, setTextIntakeAiDraft] =
    useState<TextIntakeDraft | null>(initialDraftState?.textIntakeAiDraft ?? null);
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
  const [aiOperationCostError, setAiOperationCostError] = useState("");
  const [loadingAiOperationCosts, setLoadingAiOperationCosts] = useState(false);
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
  const [askPanelOpen, setAskPanelOpen] = useState(false);
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
  const [expandedCarePrepIds, setExpandedCarePrepIds] = useState<
    Record<string, boolean>
  >({});
  const [editingAppointmentIds, setEditingAppointmentIds] = useState<
    Record<string, boolean>
  >(initialDraftState?.editingAppointmentIds ?? {});
  const [editingNoteIds, setEditingNoteIds] = useState<Record<string, boolean>>(
    initialDraftState?.editingNoteIds ?? {}
  );
  const [expandedVisitNotesAppointmentId, setExpandedVisitNotesAppointmentId] =
    useState<string | null>(null);
	  const [pendingModifierSwitch, setPendingModifierSwitch] =
	    useState<PendingModifierSwitch | null>(null);
	  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
	  const [loading, setLoading] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [welcomePanelIndex, setWelcomePanelIndex] = useState(0);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [processingTextIntake, setProcessingTextIntake] = useState(false);
  const [extractingImageText, setExtractingImageText] = useState(false);
  const [fileImportStatus, setFileImportStatus] = useState("");
  const [savingTextIntake, setSavingTextIntake] = useState(false);
  const [creatingCareVip, setCreatingCareVip] = useState(false);
  const [appointmentView, setAppointmentView] = useState<AppointmentView>(
    initialUiState?.appointmentView ?? "upcoming"
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    initialUiState?.selectedSubjectId ?? ALL_SUBJECTS
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionProfileLoaded, setSessionProfileLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [welcomeGuideDismissed, setWelcomeGuideDismissed] = useState(false);
  const [restoringAppointmentForId, setRestoringAppointmentForId] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState("");
  const [autoCarePrepStatus, setAutoCarePrepStatus] = useState<{
    appointmentId: string;
    id: number;
    message: string;
  } | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [requiresEmailUpdate, setRequiresEmailUpdate] = useState(false);
  const signedInEmailRef = useRef<string | null>(null);
  const isAdminRef = useRef(false);
  const sessionProfileLoadedRef = useRef(false);
  const appSessionSettingsRef = useRef(defaultAppSessionSettings);
  const idleSigningOutRef = useRef(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hasAnySavedAppointments, setHasAnySavedAppointments] = useState(false);
  const [
    welcomeExistingAppointmentsVariant,
    setWelcomeExistingAppointmentsVariant,
  ] = useState<"firstActions" | "returnHome">("returnHome");
  const [homeNextAppointment, setHomeNextAppointment] =
    useState<Appointment | null>(null);
  const [homeNextGuidance, setHomeNextGuidance] =
    useState<CarePrepGuidance | null>(null);
  const [notesReminderAppointment, setNotesReminderAppointment] =
    useState<NotesReminderAppointment | null>(null);
  const [careSubjects, setCareSubjects] = useState<CareSubject[]>([]);
  const [entitlement, setEntitlement] =
    useState<CareCircleEntitlement>(defaultEntitlement);
  const [notes, setNotes] = useState<AppointmentNote[]>([]);
  const [guidance, setGuidance] = useState<CarePrepGuidance[]>([]);
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
  const systemAdminTabs: AdminTab[] = ["errors", "content", "ai", "product"];
  const supportAdminTabs: AdminTab[] = ["assistantReview", "tickets"];
  const usersAdminTabs: AdminTab[] = ["users", "intake", "userAudit"];
  const adminAttentionCountsForTab = (tabKey: AdminTab) => {
    const attention = adminAttentionFor("admin_tab", tabKey);
    let fallbackNewCount = 0;
    let fallbackFollowupCount = 0;

    if (tabKey === "tickets") {
      fallbackNewCount = adminNewTickets.length;
      fallbackFollowupCount = adminTicketsNeedingFollowup.length;
    } else if (tabKey === "users" || tabKey === "intake") {
      fallbackNewCount = earlyAccessIntakeNewCount;
      fallbackFollowupCount = earlyAccessIntakeFollowupCount;
    } else if (tabKey === "errors") {
      fallbackNewCount = adminIntegrationErrors.filter((row) =>
        isNewForAdmin(
          row.latest_occurred_at,
          adminLastViewedAt("admin_tab", "errors")
        )
      ).length;
      fallbackFollowupCount = adminIntegrationErrors.length;
    } else if (tabKey === "assistantReview") {
      fallbackNewCount = assistantReviewInteractions.filter((interaction) =>
        isNewForAdmin(
          interaction.updated_at || interaction.created_at,
          adminLastViewedAt("admin_tab", "assistantReview")
        )
      ).length;
      fallbackFollowupCount = assistantReviewInteractions.filter(
        (interaction) =>
          !assistantReviewAdminReviews.some(
            (review) => review.interaction_id === interaction.id
          )
      ).length;
    }

    return {
      followupCount: Math.max(
        attention?.followup_count ?? 0,
        fallbackFollowupCount
      ),
      newCount: Math.max(attention?.new_count ?? 0, fallbackNewCount),
    };
  };
  const adminAttentionCountsForTabs = (tabKeys: AdminTab[]) =>
    tabKeys.reduce(
      (totals, tabKey) => {
        const counts = adminAttentionCountsForTab(tabKey);
        return {
          followupCount: totals.followupCount + counts.followupCount,
          newCount: totals.newCount + counts.newCount,
        };
      },
      { followupCount: 0, newCount: 0 }
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
  const adminUserActivityStats = useMemo(() => {
    const realUsers = adminUserActivity.filter((row) => !row.is_test_user);
    const activeSince = Date.now() - 1000 * 60 * 60 * 24 * 14;
    const activeRecently = realUsers.filter(
      (row) =>
        row.last_seen_at && new Date(row.last_seen_at).getTime() >= activeSince
    );
    const needsFollowup = realUsers.filter(
      (row) =>
        row.appointment_count === 0 ||
        (row.appointment_count > 0 && row.note_count === 0) ||
        row.open_support_ticket_count > 0
    );

    return {
      activeRecently: activeRecently.length,
      needsFollowup: needsFollowup.length,
      realUsers: realUsers.length,
      totalUsers: adminUserActivity.length,
    };
  }, [adminUserActivity]);
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
  const usersAdminNavItems: AdminNavItem<AdminTab>[] = [
    { key: "users", label: "User Activity" },
    {
      followupCount: earlyAccessIntakeFollowupCount,
      key: "intake",
      label: "Early Access Intake",
      newCount: earlyAccessIntakeNewCount,
    },
    { key: "userAudit", label: "Audit Trail" },
  ];
  const systemAdminNavItems: AdminNavItem<AdminTab>[] = [
    { ...adminAttentionCountsForTab("errors"), key: "errors", label: "Errors" },
    { key: "content", label: "Dynamic Text" },
    { ...adminAttentionCountsForTab("ai"), key: "ai", label: "AI Prompts" },
    { key: "product", label: "Prod Mgmt" },
  ];
  const supportAdminNavItems: AdminNavItem<AdminTab>[] = [
    {
      ...adminAttentionCountsForTab("assistantReview"),
      key: "assistantReview",
      label: "Ask - Review",
    },
    { ...adminAttentionCountsForTab("tickets"), key: "tickets", label: "Tickets" },
  ];
  const systemAdminAttentionCounts = adminAttentionCountsForTabs(systemAdminTabs);
  const supportAdminAttentionCounts =
    adminAttentionCountsForTabs(supportAdminTabs);
  const usersAdminAttentionCounts = adminAttentionCountsForTabs(usersAdminTabs);
  const adminDashboardNewCount = actionableAdminAttentionSummaries.reduce(
    (total, item) => total + (item.new_count ?? 0),
    0
  );
  const adminDashboardFollowupCount = actionableAdminAttentionSummaries.reduce(
    (total, item) => total + (item.followup_count ?? 0),
    0
  );
  const topAdminNavItems: AdminNavItem<AdminTopTab>[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "tools", label: "Tools" },
    { ...usersAdminAttentionCounts, key: "users", label: "Users" },
    { ...systemAdminAttentionCounts, key: "system", label: "System" },
    { ...supportAdminAttentionCounts, key: "support", label: "Support" },
  ];
  const activeAdminTopTab: AdminTopTab = usersAdminTabs.includes(adminTab)
    ? "users"
    : systemAdminTabs.includes(adminTab)
      ? "system"
      : supportAdminTabs.includes(adminTab)
        ? "support"
        : adminTab === "dashboard"
          ? "dashboard"
          : "tools";
  const adminTabForTopTab = (topTab: AdminTopTab): AdminTab => {
    if (topTab === "users") {
      return usersAdminTabs.includes(adminTab) ? adminTab : "users";
    }

    if (topTab === "system") {
      return systemAdminTabs.includes(adminTab) ? adminTab : "errors";
    }

    if (topTab === "support") {
      return supportAdminTabs.includes(adminTab) ? adminTab : "assistantReview";
    }

    return topTab;
  };
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
  const filteredAdminUserActivity = useMemo(() => {
    const lastActivityForRow = (row: AdminUserActivityRow) =>
      row.last_support_ticket_at ??
      row.last_careprep_generated_at ??
      row.last_note_created_at ??
      row.last_appointment_created_at ??
      row.last_seen_at;
    const inactiveSince = Date.now() - 1000 * 60 * 60 * 24 * 14;

    const filteredRows = adminUserActivity.filter((row) => {
      if (adminUserActivityFilter === "real") {
        return !row.is_test_user;
      }

      if (adminUserActivityFilter === "test") {
        return row.is_test_user;
      }

      if (adminUserActivityFilter === "active") {
        return (
          !row.is_test_user &&
          Boolean(row.last_seen_at) &&
          new Date(row.last_seen_at as string).getTime() >= inactiveSince
        );
      }

      if (adminUserActivityFilter === "inactive") {
        return (
          !row.is_test_user &&
          (!row.last_seen_at ||
            new Date(row.last_seen_at).getTime() < inactiveSince)
        );
      }

      if (adminUserActivityFilter === "needs_followup") {
        return (
          !row.is_test_user &&
          (row.appointment_count === 0 ||
            (row.appointment_count > 0 && row.note_count === 0) ||
            row.open_support_ticket_count > 0)
        );
      }

      return true;
    });

    return [...filteredRows].sort((firstRow, secondRow) => {
      const direction = adminUserActivitySort.direction === "asc" ? 1 : -1;
      const valueForSort = (row: AdminUserActivityRow) => {
        switch (adminUserActivitySort.key) {
          case "appointments":
            return row.appointment_count;
          case "careprep":
            return row.careprep_count;
          case "created":
            return row.account_created_at ?? "";
          case "flags":
            return [row.is_admin ? "Admin" : "", row.is_test_user ? "Test" : ""]
              .filter(Boolean)
              .join(" ");
          case "group":
            return row.user_group ?? "";
          case "last_activity":
            return lastActivityForRow(row) ?? "";
          case "last_seen":
            return row.last_seen_at ?? "";
          case "notes":
            return row.note_count;
          case "tickets":
            return row.open_support_ticket_count;
          case "user":
            return row.display_name || row.email || row.user_id;
          default:
            return "";
        }
      };
      const firstValue = valueForSort(firstRow);
      const secondValue = valueForSort(secondRow);

      if (typeof firstValue === "number" && typeof secondValue === "number") {
        return (firstValue - secondValue) * direction;
      }

      return String(firstValue).localeCompare(String(secondValue)) * direction;
    });
  }, [adminUserActivity, adminUserActivityFilter, adminUserActivitySort]);
  const selectedBulkAppointmentCount = bulkAppointmentDrafts.filter(
    (draft) => draft.isSelected
  ).length;
  const allBulkAppointmentsSelected =
    bulkAppointmentDrafts.length > 0 &&
    selectedBulkAppointmentCount === bulkAppointmentDrafts.length;
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
	    return new Map(appointments.map((appointment) => [appointment.id, appointment]));
	  }, [appointments]);

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

  const careVipLimit = Math.max(entitlement.max_active_subjects || 1, 1);
  const actualPricingTier = pricingTierForEntitlement(entitlement);
  const previewPricingTier =
    isAdmin && adminPlanPreviewId
      ? pricingTiers.find((tier) => tier.id === adminPlanPreviewId)
      : null;
  const currentPricingTier = previewPricingTier ?? actualPricingTier;
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
	  const hasUnsavedProfileChanges =
	    profileDraftKey(profileDraft) !== profileDraftKey(savedProfileDraft);
	  const hasUnaddedCareVipName = newCareVipName.trim().length > 0;
	  const shouldWarnBeforeProfileSignOut =
	    mainTab === "profile" && (hasUnsavedProfileChanges || hasUnaddedCareVipName);
	  const unsavedSignOutChanges = useMemo(() => {
	    const changes = new Map<string, UnsavedChangeSummary>();
	    const addChange = (change: UnsavedChangeSummary) => {
	      changes.set(change.key, change);
	    };
	    const appointmentLabel = (appointmentId: string, fallback = "") => {
	      const appointment = appointmentsById.get(appointmentId);
	      const draft = appointmentDrafts[appointmentId];

	      return (
	        appointment?.title?.trim() ||
	        draft?.title?.trim() ||
	        fallback ||
	        "Appointment draft"
	      );
	    };

	    if (hasUnsavedProfileChanges) {
	      addChange({ key: "profile", label: "Profile" });
	    }

	    if (hasUnaddedCareVipName) {
	      addChange({
	        detail: newCareVipName.trim(),
	        key: "care-vip",
	        label: "New Care VIP",
	      });
	    }

	    if (
	      newAppointmentTitle.trim() ||
	      newAppointmentReason.trim() ||
	      newAppointmentStartsAt.trim() ||
	      newAppointmentProviderName.trim() ||
	      newAppointmentProviderOrganization.trim() ||
	      newAppointmentLocationName.trim() ||
	      newAppointmentLocationAddress.trim() ||
	      newAppointmentLocationPhone.trim()
	    ) {
	      addChange({
	        detail: newAppointmentTitle.trim() || "Untitled appointment",
	        key: "new-appointment",
	        label: "New appointment",
	      });
	    }

	    if (bulkAppointmentDrafts.length > 0) {
	      addChange({
	        detail: `${bulkAppointmentDrafts.length} draft${
	          bulkAppointmentDrafts.length === 1 ? "" : "s"
	        }`,
	        key: "bulk-appointments",
	        label: "Appointment import",
	      });
	    }

	    if (
	      textIntakeTargetAppointmentId &&
	      (contextualTextIntakeValue.trim() ||
	        textIntakeDraft ||
	        textIntakeAiDraft ||
	        textIntakeItemId)
	    ) {
	      addChange({
	        detail: appointmentLabel(textIntakeTargetAppointmentId, "Appointment"),
	        key: `visit-notes-intake-${textIntakeTargetAppointmentId}`,
	        label: "Visit notes intake",
	      });
	    } else if (
	      textIntakeValue.trim() ||
	      textIntakeDraft ||
	      textIntakeAiDraft ||
	      textIntakeItemId ||
	      textIntakeMatches.length > 0
	    ) {
	      addChange({
	        key: "text-intake",
	        label: "Appointment or notes intake",
	      });
	    }

	    Object.entries(editingAppointmentIds).forEach(([appointmentId, isEditing]) => {
	      if (!isEditing) {
	        return;
	      }

	      const appointment = appointmentsById.get(appointmentId);
	      if (appointment) {
	        const draft = appointmentDrafts[appointment.id] ?? emptyAppointmentDraft;
	        const hasChanges =
	          draft.locationAddress !== (appointment.location_address ?? "") ||
	          draft.locationName !== (appointment.location_name ?? "") ||
	          draft.locationPhone !== (appointment.location_phone ?? "") ||
	          draft.providerName !== (appointment.provider_name ?? "") ||
	          draft.providerOrganization !==
	            (appointment.provider_organization ?? "") ||
	          draft.reason !== (appointment.reason ?? "") ||
	          draft.startsAt !== toDatetimeLocalValue(appointment.starts_at) ||
	          draft.status !== appointment.status ||
	          draft.title !== (appointment.title ?? "");

	        if (!hasChanges) {
	          return;
	        }
	      }

	      addChange({
	        detail: appointmentLabel(appointmentId),
	        key: `appointment-edit-${appointmentId}`,
	        label: "Appointment details",
	      });
	    });

	    Object.entries(editingNoteIds).forEach(([appointmentId, isEditing]) => {
	      if (!isEditing) {
	        return;
	      }

	      const appointment = appointmentsById.get(appointmentId);
	      if (appointment) {
	        const draft = noteDrafts[appointment.id] ?? emptyNoteDraft;
	        const existingNote = notesByAppointment.get(appointment.id);
	        const hasChanges = existingNote
	          ? draft.summary !== (existingNote.summary_short ?? "") ||
	            draft.takeaways !== asTextList(existingNote.takeaways).join("\n") ||
	            draft.followups !== asTextList(existingNote.followups).join("\n")
	          : Boolean(
	              draft.summary.trim() ||
	                draft.takeaways.trim() ||
	                draft.followups.trim()
	            );

	        if (!hasChanges) {
	          return;
	        }
	      }

	      addChange({
	        detail: appointmentLabel(appointmentId),
	        key: `note-edit-${appointmentId}`,
	        label: "Visit notes",
	      });
	    });

	    Object.entries(carePrepDrafts).forEach(([appointmentId, draft]) => {
	      const hasDraftText = Object.values(draft).some((value) =>
	        String(value ?? "").trim()
	      );

	      if (!hasDraftText && !editingCarePrepIds[appointmentId]) {
	        return;
	      }

	      addChange({
	        detail: appointmentLabel(appointmentId),
	        key: `careprep-${appointmentId}`,
	        label: "CarePrep",
	      });
	    });

	    if (askInput.trim() || (askMessages.length > 0 && !askConversationComplete)) {
	      addChange({ key: "ask", label: "Ask conversation" });
	    }

	    return Array.from(changes.values());
	  }, [
	    appointmentDrafts,
	    appointmentsById,
	    askConversationComplete,
	    askInput,
	    askMessages.length,
	    bulkAppointmentDrafts.length,
	    carePrepDrafts,
	    contextualTextIntakeValue,
	    editingAppointmentIds,
	    editingCarePrepIds,
	    editingNoteIds,
	    hasUnaddedCareVipName,
	    hasUnsavedProfileChanges,
	    newAppointmentLocationAddress,
	    newAppointmentLocationName,
	    newAppointmentLocationPhone,
	    newAppointmentProviderName,
	    newAppointmentProviderOrganization,
	    newAppointmentReason,
	    newAppointmentStartsAt,
	    newAppointmentTitle,
	    newCareVipName,
	    noteDrafts,
	    notesByAppointment,
	    textIntakeAiDraft,
	    textIntakeDraft,
	    textIntakeItemId,
	    textIntakeMatches.length,
	    textIntakeTargetAppointmentId,
	    textIntakeValue,
	  ]);
	  const hasAcceptedBetaAgreement =
	    Boolean(betaDisclaimerAcknowledgedAt) &&
    Boolean(betaPrivacyAcknowledgedAt) &&
    Boolean(betaTermsAcknowledgedAt);
  const needsBetaAgreement =
    Boolean(signedInEmail) && !hasAcceptedBetaAgreement;
  const needsOnboarding =
    Boolean(signedInEmail) &&
    hasAcceptedBetaAgreement &&
    (!onboardingCompletedAt || requiresEmailUpdate);
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
          await Promise.all([loadAppContent(), loadAppSessionSettings()]);
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

      const { data } = await supabase.auth.getSession();
      const sessionEmail = data.session?.user.email ?? null;

      if (sessionEmail) {
        setSessionProfileLoaded(false);
        setSignedInEmail(sessionEmail);
        setWelcomeGuideDismissed(false);
        setEmail(sessionEmail);

        setLoading(true);

        try {
          await Promise.all([loadAppContent(), loadAppSessionSettings()]);
          await loadAppointments(
            initialUiState?.appointmentView,
            initialUiState?.selectedSubjectId
          );
          await loadCurrentUserSupportTickets();

          if (initialUiState?.mainTab === "admin") {
            if (initialUiState.adminTab === "ai") {
              await Promise.all([
                loadAiInstructions(initialUiState.selectedAiWorkflow),
                loadAppContent(),
                loadAgentKnowledgeProposals(),
              ]);
            } else if (initialUiState.adminTab === "product") {
              await loadProductMgmt();
            } else if (initialUiState.adminTab === "tickets") {
              await loadAdminSupportTickets();
            } else if (initialUiState.adminTab === "assistantReview") {
              await Promise.all([
                loadAskReviewSubmissions(),
                loadAssistantReviewInteractions(),
              ]);
            } else if (initialUiState.adminTab === "users") {
              await loadAdminUserActivity();
            } else if (initialUiState.adminTab === "intake") {
              await loadEarlyAccessIntake();
            } else if (initialUiState.adminTab === "userAudit") {
              await loadAdminAccessEvents();
            } else if (initialUiState.adminTab === "errors") {
              await loadAdminIntegrationErrors();
            } else if (initialUiState.adminTab === "content") {
              await loadAppContent(initialUiState.selectedAppContentKey);
            } else if (initialUiState.adminTab === "dashboard") {
              await loadAdminAttentionOverview();
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
    const handleVersionShortcut = (event: KeyboardEvent) => {
      const isVersionShortcut =
        (event.ctrlKey || event.metaKey) &&
        event.altKey &&
        event.key.toLowerCase() === "v";

      if (isVersionShortcut) {
        event.preventDefault();
        setShowVersionInfo((isVisible) => !isVisible);
        return;
      }

      if (event.key === "Escape") {
        setShowVersionInfo(false);
      }
    };

    window.addEventListener("keydown", handleVersionShortcut);

    return () => window.removeEventListener("keydown", handleVersionShortcut);
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

      supabase.rpc("touch_profile_activity").then(({ error }) => {
        if (error) {
          console.error("Could not update profile activity", error);
        }
      });
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
      activeAppointmentPanel,
      adminTab,
      aiAdminTab,
      appointmentView,
      mainTab,
      selectedAiWorkflow,
      selectedAppContentCategory,
      selectedAppContentKey,
      selectedProductMgmtSection,
      selectedSubjectId,
    } satisfies StoredUiState);
  }, [
    activeAppointmentPanel,
    adminTab,
    aiAdminTab,
    appointmentView,
    mainTab,
    selectedAiWorkflow,
    selectedAppContentCategory,
    selectedAppContentKey,
    selectedProductMgmtSection,
    selectedSubjectId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    writeStoredJson(window.sessionStorage, appDraftStateStorageKey, {
      appointmentDrafts,
      bulkAppointmentDrafts,
      bulkAppointmentSummary,
      carePrepDrafts,
      contextualTextIntakeValue,
      editingAppointmentIds,
      editingCarePrepIds,
      editingNoteIds,
      newAppointmentDraft: {
        locationAddress: newAppointmentLocationAddress,
        locationName: newAppointmentLocationName,
        locationPhone: newAppointmentLocationPhone,
        providerName: newAppointmentProviderName,
        providerOrganization: newAppointmentProviderOrganization,
        reason: newAppointmentReason,
        startsAt: newAppointmentStartsAt,
        subjectId: newAppointmentSubjectId,
        title: newAppointmentTitle,
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
    appointmentDrafts,
    bulkAppointmentDrafts,
    bulkAppointmentSummary,
    carePrepDrafts,
    contextualTextIntakeValue,
    editingAppointmentIds,
    editingCarePrepIds,
    editingNoteIds,
    newAppointmentLocationAddress,
    newAppointmentLocationName,
    newAppointmentLocationPhone,
    newAppointmentProviderName,
    newAppointmentProviderOrganization,
    newAppointmentReason,
    newAppointmentStartsAt,
    newAppointmentSubjectId,
    newAppointmentTitle,
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
    setExpandedCarePrepIds((currentIds) => ({
      ...currentIds,
      [appointmentId]: true,
    }));
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
      .select("care_circle_id")
      .limit(1);

    if (membershipsError) {
      throw membershipsError;
    }

    const careCircleId = memberships?.[0]?.care_circle_id;

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
      console.error("Could not load app session settings", error);
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

  function profileDraftFromRow(
    row: Record<string, unknown> | null | undefined,
    fallbackEmail: string
  ): ProfileDraft {
    return {
      addressLine1: String(row?.address_line1 ?? ""),
      addressLine2: String(row?.address_line2 ?? ""),
      city: String(row?.city ?? ""),
      country: String(row?.country ?? "US"),
      displayName: String(row?.display_name ?? ""),
      email: String(row?.email ?? fallbackEmail),
      familyName: String(row?.family_name ?? ""),
      givenName: String(row?.given_name ?? ""),
      phone: String(
        row?.phone ??
          (typeof row?.phone_e164 === "string"
            ? formatUsPhoneFromDigits(phoneDigits(row.phone_e164))
            : "")
      ),
      postalCode: String(row?.postal_code ?? ""),
      region: String(row?.region ?? ""),
      timezone:
        typeof row?.timezone === "string" && row.timezone
          ? row.timezone
          : browserTimezone(),
    };
  }

  function updateProfileDraft(field: keyof ProfileDraft, value: string) {
    setProfileDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value,
    }));
  }

  async function loadAppointments(
    view: AppointmentView = appointmentView,
    subjectId: string = selectedSubjectId
  ) {
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

    const loadedProfileDraft = {
      ...profileDraftFromRow(profileRow, profileEmail),
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
    if (userIsAdmin) {
      void loadAdminAttentionOverview();
    }
    if (!userIsAdmin) {
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
      setMessage("Review the Early Access notice to continue.");
      return;
    }

    if (userRequiresEmailUpdate || !profileRow?.onboarding_completed_at) {
      setAppointments([]);
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
      .select("care_circle_id");

    if (membershipsError) {
      throw membershipsError;
    }

    const circleIds = memberships?.map((row) => row.care_circle_id) ?? [];

    if (circleIds.length === 0) {
      setAppointments([]);
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

    const { data: entitlementRows, error: entitlementError } = await supabase
      .from("care_circle_entitlements")
      .select("care_circle_id,plan_id,status")
      .in("care_circle_id", circleIds)
      .eq("status", "active");

    if (entitlementError) {
      throw entitlementError;
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

    const { data: subjectRows, error: subjectsError } = await supabase
      .from("care_subjects")
      .select("id,care_circle_id,display_name,subject_type,is_default,is_active")
      .in("care_circle_id", circleIds)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .order("display_name", { ascending: true });

    if (subjectsError) {
      throw subjectsError;
    }

    const subjects = subjectRows ?? [];
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

    let appointmentQuery = supabase
      .from("appointments")
      .select("id,care_subject_id,current_note_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone,is_sample_data,deleted_at")
      .in("care_circle_id", circleIds)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true });

    if (effectiveSubjectId !== ALL_SUBJECTS) {
      appointmentQuery = appointmentQuery.eq("care_subject_id", effectiveSubjectId);
    }

    let notesReminderQuery = supabase
      .from("appointments")
      .select("id,care_circle_id,care_subject_id,current_note_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone,is_sample_data,deleted_at")
      .in("care_circle_id", circleIds)
      .is("deleted_at", null)
      .neq("status", "archived")
      .is("current_note_id", null)
      .lt("starts_at", startOfToday().toISOString())
      .order("starts_at", { ascending: false })
      .limit(1);

    if (effectiveSubjectId !== ALL_SUBJECTS) {
      notesReminderQuery = notesReminderQuery.eq(
        "care_subject_id",
        effectiveSubjectId
      );
    }

    const upcomingStart = startOfToday();
    const [
      { data: appointmentRows, error: appointmentsError },
      { data: reminderRows, error: reminderError },
    ] = await Promise.all([appointmentQuery, notesReminderQuery]);

    if (appointmentsError) {
      throw appointmentsError;
    }

    if (reminderError) {
      throw reminderError;
    }

    setHasAnySavedAppointments((appointmentRows?.length ?? 0) > 0);
    setNotesReminderAppointment(reminderRows?.[0] ?? null);
    const nextHomeAppointment =
      appointmentRows
        ?.filter((item) => {
          if (item.status === "archived" || item.current_note_id) {
            return false;
          }

          if (!item.starts_at) {
            return true;
          }

          return new Date(item.starts_at) >= upcomingStart;
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
    setHomeNextAppointment(nextHomeAppointment);

    const visibleAppointments =
      appointmentRows?.filter((item) =>
        view === "archived"
          ? item.status === "archived"
          : view === "logged"
            ? item.status !== "archived" && Boolean(item.current_note_id)
            : item.status !== "archived" &&
              !item.current_note_id &&
              (!item.starts_at ||
                new Date(item.starts_at) >= upcomingStart)
      ) ?? [];
    visibleAppointments.sort((firstAppointment, secondAppointment) => {
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
    const appointmentIds = visibleAppointments.map((item) => item.id);
    const appointmentIdsForDetails = Array.from(
      new Set([
        ...appointmentIds,
        ...(nextHomeAppointment ? [nextHomeAppointment.id] : []),
      ])
    );
    setAppointments(visibleAppointments);

    if (appointmentIdsForDetails.length === 0) {
      setNotes([]);
      setGuidance([]);
      setHomeNextGuidance(null);
      setMessage(
        view === "archived"
          ? "No archived appointments found."
          : view === "logged"
            ? "No logged appointments found yet."
            : "No upcoming appointments found yet."
      );
      return;
    }

    const [{ data: noteRows, error: notesError }, { data: guidanceRows, error: guidanceError }] =
      await Promise.all([
        supabase
          .from("appointment_notes")
          .select(
            "id,appointment_id,summary_short,takeaways,followups,is_current,version_number,superseded_at,superseded_by_note_id"
          )
          .in("appointment_id", appointmentIdsForDetails)
          .eq("is_current", true),
        supabase
          .from("careprep_guidance")
          .select(
            "id,appointment_id,generated_at,summary,key_questions,bring_list,watchouts,med_review,since_last_visit,next_steps,is_current,version_number,review_status,source,superseded_at,superseded_by_guidance_id,edited_from_guidance_id,ai_generated_guidance_id"
          )
          .in("appointment_id", appointmentIdsForDetails)
          .or("is_current.eq.true,review_status.eq.draft")
          .order("generated_at", { ascending: true }),
      ]);

    if (notesError) {
      throw notesError;
    }

    if (guidanceError) {
      throw guidanceError;
    }

    const loadedGuidanceRows = guidanceRows ?? [];
    setNotes(noteRows ?? []);
    setGuidance(loadedGuidanceRows);
    setHomeNextGuidance(
      nextHomeAppointment
        ? loadedGuidanceRows.find(
            (row) =>
              row.appointment_id === nextHomeAppointment.id &&
              row.review_status === "draft"
          ) ??
            loadedGuidanceRows.find(
              (row) =>
                row.appointment_id === nextHomeAppointment.id && row.is_current
            ) ??
            null
        : null
    );
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
      await Promise.all([loadAppContent(), loadAppSessionSettings()]);
      await loadAppointments();
    } catch (error) {
      logAuthError("signIn", error);
      setMessage(getAuthErrorMessage(error));
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

  async function loadAiOperationCostSummary() {
    setLoadingAiOperationCosts(true);
    setAiOperationCostError("");

    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.rpc("ai_operation_cost_summary", {
        p_since: since,
      });

      if (error) {
        throw error;
      }

      setAiOperationCostSummary((data ?? []) as AiOperationCostSummaryRow[]);
    } catch (error) {
      console.warn("Unable to load AI operation cost summary", error);
      setAiOperationCostSummary([]);
      setAiOperationCostError(
        "AI operation cost tracking is ready in the app, but the database migration has not been applied yet."
      );
    } finally {
      setLoadingAiOperationCosts(false);
    }
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
        "Account created. Check your email, including your junk folder, to confirm the account. Then sign in."
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

	  async function handleChangeAppointmentView(view: AppointmentView) {
	    setAppointmentView(view);
	    setPendingModifierSwitch(null);
	    setLoading(true);
	    setMessage("");

    try {
      await loadAppointments(view);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

	  async function handleChangeSubject(subjectId: string) {
	    setSelectedSubjectId(subjectId);
	    setPendingModifierSwitch(null);

	    if (subjectId !== ALL_SUBJECTS) {
      setNewAppointmentSubjectId(subjectId);
    }

    setLoading(true);
    setMessage("");

    try {
      await loadAppointments(appointmentView, subjectId);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
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

  function resetAppContentEditor(version: AppContentVersion | null) {
    const option =
      appContentOptions.find(
        (item) => item.contentKey === (version?.content_key ?? selectedAppContentKey)
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
      resetAppContentEditor(currentVersion);
    } catch (error) {
      if (isAdmin) {
        setMessage(getErrorMessage(error));
      }
    } finally {
      setLoadingAppContent(false);
    }
  }

  async function handleChangeAppContentKey(contentKey: string) {
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
      resetAppContentEditor(currentVersion);
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
      showToast("Content saved as a new version.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
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

  async function handleChangeMainTab(tab: MainTab) {
    if (tab === "admin" && !isAdmin) {
      setMessage("Admin access is not enabled for this account.");
      return;
    }

    setMainTab(tab);

    if (tab !== "appointments") {
      cancelTextIntake();
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

  function startAppointmentPanel(panel: AppointmentPanel) {
    setMessage("");
    setAppointmentView("upcoming");
    setSelectedSubjectId(ALL_SUBJECTS);
    cancelTextIntake();
    resetPlaceLookup();
    setActiveAppointmentPanel(panel);
    setMainTab("appointments");
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

  async function loadAdminIntegrationErrors() {
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
      setMessage(`Loaded ${rows.length} integration error summary row(s).`);
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

    if (askSubmittedFingerprints.includes(outgoingFingerprint)) {
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

      const response = await fetch("/api/ask", {
        body: JSON.stringify({
          context: {
            email: signedInEmail,
            has_open_support_ticket: Boolean(currentSupportTicket),
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
            browser_timezone: browserTimezone(),
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
    setAdminTab(tab);
    setMessage("");

    if (tab === "dashboard") {
      await loadAdminAttentionOverview();
    }

    if (tab === "tools") {
      await loadAppSessionSettings();
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
	    if (
	      !bypassUnsavedChangesWarning &&
	      (shouldWarnBeforeProfileSignOut || unsavedSignOutChanges.length > 0)
	    ) {
	      setSignOutConfirmOpen(true);
	      return;
	    }

	    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      removeStoredValue(window.localStorage, appUiStateStorageKey);
      removeStoredValue(window.sessionStorage, appDraftStateStorageKey);
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
    setRequiresEmailUpdate(false);
    setOnboardingCompletedAt(null);
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
    setNewAppointmentProviderName("");
    setNewAppointmentProviderOrganization("");
    setNewAppointmentLocationName("");
    setNewAppointmentLocationAddress("");
    setNewAppointmentLocationPhone("");
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

      if (!profileEmail) {
        throw new Error("Email is required.");
      }

      if (!isLikelyEmail(profileEmail)) {
        throw new Error("Enter a valid email address.");
      }

      if (
        requiresEmailUpdate &&
        user.email &&
        profileEmail.toLowerCase() === user.email.toLowerCase()
      ) {
        throw new Error("Enter an email you can access.");
      }

      if (!profileDraft.givenName.trim()) {
        throw new Error("First name is required.");
      }

      if (!profileDraft.familyName.trim()) {
        throw new Error("Last name is required.");
      }

      if (!profileDraft.timezone.trim()) {
        throw new Error("Time zone is required.");
      }

      if (!profileDraft.phone.trim()) {
        throw new Error("Phone number is required.");
      }

      if (!profileDraft.postalCode.trim()) {
        throw new Error("ZIP code is required.");
      }

      if (!isValidUsZip(profileDraft.postalCode)) {
        throw new Error("Enter a valid ZIP code, like 12345 or 12345-6789.");
      }

      const normalizedPhone = normalizeUsPhone(profileDraft.phone);

      if (!normalizedPhone) {
        throw new Error("Enter a valid 10-digit U.S. phone number.");
      }

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
      const storedDisplayName = profileDraft.displayName.trim() || null;
      const visibleDisplayName = profileDisplayName({
        displayName: profileDraft.displayName,
        email: profileEmail,
        familyName: profileDraft.familyName,
        givenName: profileDraft.givenName,
      });
      const savedDraft: ProfileDraft = {
        addressLine1: profileDraft.addressLine1.trim(),
        addressLine2: profileDraft.addressLine2.trim(),
        city: profileDraft.city.trim(),
        country: profileDraft.country.trim(),
        displayName: profileDraft.displayName.trim(),
        email: profileEmail,
        familyName: profileDraft.familyName.trim(),
        givenName: profileDraft.givenName.trim(),
        phone: normalizedPhone.display,
        postalCode: profileDraft.postalCode.trim(),
        region: profileDraft.region.trim(),
        timezone: profileDraft.timezone.trim(),
      };
      const { error } = await supabase.from("profiles").upsert({
        address_line1: profileDraft.addressLine1.trim() || null,
        address_line2: profileDraft.addressLine2.trim() || null,
        city: profileDraft.city.trim() || null,
        country: profileDraft.country.trim() || null,
        display_name: storedDisplayName,
        email: profileEmail,
        family_name: profileDraft.familyName.trim(),
        given_name: profileDraft.givenName.trim(),
        id: user.id,
        onboarding_completed_at: completedAt,
        phone: normalizedPhone?.display ?? null,
        phone_e164: normalizedPhone?.e164 ?? null,
        postal_code: profileDraft.postalCode.trim() || null,
        region: profileDraft.region.trim() || null,
        timezone: profileDraft.timezone.trim(),
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
      setMessage("Profile saved.");
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

  async function handleCreateCareVip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingCareVip(true);
    setMessage("");

    try {
      const displayName = newCareVipName.trim();

      if (!displayName) {
        throw new Error("Please enter a Care VIP name.");
      }

      if (!canAddCareVip) {
        throw new Error(
          `${entitlement.plan_name} allows ${entitlement.max_active_subjects} active Care VIP.`
        );
      }

      const { careCircleId } = await getPrimaryCareContext();
      const isFirstCareVip = careSubjects.length === 0;

      const { data: newSubject, error } = await supabase
        .from("care_subjects")
        .insert({
          care_circle_id: careCircleId,
          display_name: displayName,
          is_active: true,
          is_default: isFirstCareVip,
          subject_type: "other",
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      setNewCareVipName("");
      setSelectedSubjectId(newSubject.id);
      setNewAppointmentSubjectId(newSubject.id);
      setManagingCareVips(false);
      await loadAppointments(appointmentView, newSubject.id);
      setMessage("Care VIP added.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setCreatingCareVip(false);
    }
  }

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
    files: FileList | null,
    target: "appointmentNotes" | "quickAdd" = "quickAdd"
  ) {
    const images = files ? Array.from(files) : [];

    if (images.length === 0) {
      return;
    }

    setExtractingImageText(true);
    setFileImportStatus("Uploading and importing, please wait...");
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

      const response = await fetch("/api/ocr", {
        body: formData,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Image text extraction failed.");
      }

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
          target === "appointmentNotes"
            ? "interpreting notes"
            : "reviewing appointments"
        }.`
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setExtractingImageText(false);
      setFileImportStatus("");
    }
  }

  async function handleImportAppointmentFiles(files: FileList | null) {
    const selectedFiles = files ? Array.from(files) : [];

    if (selectedFiles.length === 0) {
      return;
    }

    setFileImportStatus("");
    setTextIntakeValue("");
    setTextIntakeDraft(null);
    setTextIntakeAiDraft(null);
    setTextIntakeItemId(null);
    setTextIntakeMatches([]);
    setBulkAppointmentDrafts([]);
    setBulkAppointmentSummary("");
    setSelectedTextIntakeMatchId("new");
    setTextIntakeTargetAppointmentId(null);
    setApplyTextIntakeAppointmentDetails(false);

    const calendarFiles = selectedFiles.filter((file) =>
      file.name.toLowerCase().endsWith(".ics")
    );
    const imageFiles = selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );

    if (calendarFiles.length > 1) {
      setMessage("Choose only one .iCal calendar file at a time.");
      return;
    }

    if (calendarFiles.length > 0 && imageFiles.length > 0) {
      setMessage("Choose either one .iCal file or up to 10 images, not both.");
      return;
    }

    if (calendarFiles.length === 1) {
      setExtractingImageText(true);
      setFileImportStatus("Uploading and importing, please wait...");
      setMessage("");

      try {
        const calendarFile = calendarFiles[0];
        const calendarText = await calendarFile.text();
        const { drafts, foundCount } = parseICalendarAppointments(
          calendarText,
          calendarFile.name
        );

        if (drafts.length === 0) {
          throw new Error("No future calendar events were found in that file.");
        }

        setTextIntakeValue("");
        setTextIntakeDraft(null);
        setTextIntakeAiDraft(null);
        setTextIntakeItemId(null);
        setTextIntakeMatches([]);
        setBulkAppointmentDrafts(drafts);
        setBulkAppointmentSummary(
          `Found ${foundCount} future calendar event${
            foundCount === 1 ? "" : "s"
          }. Showing ${drafts.length}; select up to 10 to import.`
        );
        setSelectedTextIntakeMatchId("new");
        setTextIntakeTargetAppointmentId(null);
        setApplyTextIntakeAppointmentDetails(false);
        setMessage("Calendar file imported. Review and select appointments to save.");
      } catch (error) {
        setMessage(getErrorMessage(error));
      } finally {
        setExtractingImageText(false);
        setFileImportStatus("");
      }
      return;
    }

    await handleExtractImageText(files, "quickAdd");
  }

  function updateTextIntakeDraft(
    field: keyof TextIntakeDraft,
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

	  function hasUnsavedAppointmentModifierChanges(
	    appointment: Appointment,
	    modifier: AppointmentModifier | null
	  ) {
	    if (modifier === "add") {
	      const draft = noteDrafts[appointment.id] ?? emptyNoteDraft;
	      const existingNote = notesByAppointment.get(appointment.id);

	      if (existingNote) {
	        return (
	          draft.summary !== (existingNote.summary_short ?? "") ||
	          draft.takeaways !== asTextList(existingNote.takeaways).join("\n") ||
	          draft.followups !== asTextList(existingNote.followups).join("\n")
	        );
	      }

	      return Boolean(
	        draft.summary.trim() ||
          draft.takeaways.trim() ||
          draft.followups.trim()
      );
    }

    if (modifier === "import") {
      return Boolean(
        contextualTextIntakeValue.trim() ||
          textIntakeDraft ||
          textIntakeAiDraft ||
          textIntakeItemId
      );
    }

    if (modifier === "edit") {
      const draft = appointmentDrafts[appointment.id] ?? emptyAppointmentDraft;

      return (
        draft.locationAddress !== (appointment.location_address ?? "") ||
        draft.locationName !== (appointment.location_name ?? "") ||
        draft.locationPhone !== (appointment.location_phone ?? "") ||
        draft.providerName !== (appointment.provider_name ?? "") ||
        draft.providerOrganization !==
          (appointment.provider_organization ?? "") ||
        draft.reason !== (appointment.reason ?? "") ||
        draft.startsAt !== toDatetimeLocalValue(appointment.starts_at) ||
        draft.status !== appointment.status ||
        draft.title !== (appointment.title ?? "")
      );
    }

    return false;
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

  function discardAndSwitchAppointmentModifier(appointment: Appointment) {
    if (!pendingModifierSwitch) {
      return;
    }

    const currentModifier = currentAppointmentModifier(appointment.id);

    discardAppointmentModifier(appointment.id, currentModifier);
    if (pendingModifierSwitch.target) {
      openAppointmentModifier(appointment, pendingModifierSwitch.target);
    }
    setPendingModifierSwitch(null);
  }

  function startContextualTextIntake(appointment: Appointment) {
    setPendingModifierSwitch(null);
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
    setContextualTextIntakeValue("");
    setApplyTextIntakeAppointmentDetails(false);
    setFileImportStatus("");
  }

  async function findTextIntakeMatches(
    draft: TextIntakeDraft,
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
        let aiNoteId: string | null = null;
        const existingNote = selectedMatch?.currentNote ?? null;
        const nextVersionNumber = existingNote
          ? existingNote.version_number + 1
          : 1;

        if (textIntakeAiDraft && hasAiNoteDraft) {
          const { data: aiNote, error: aiNoteError } = await supabase
            .from("appointment_notes")
            .insert({
              accepted_by_user: false,
              appointment_id: appointmentId,
              care_circle_id: careCircleId,
              followups: aiFollowups,
              generated_by_ai: true,
              input_text:
                (targetAppointment
                  ? contextualTextIntakeValue
                  : textIntakeValue
                ).trim() || null,
              is_current: false,
              source: "intake_ai_draft",
              summary_short: textIntakeAiDraft.notesSummary.trim() || null,
              takeaways: aiTakeaways,
              user_id: userId,
              version_number: nextVersionNumber,
            })
            .select("id")
            .single();

          if (aiNoteError) {
            throw aiNoteError;
          }

          aiNoteId = aiNote.id;
        }

        const { data: note, error: noteError } = await supabase
          .from("appointment_notes")
          .insert({
            accepted_by_user: true,
            appointment_id: appointmentId,
            care_circle_id: careCircleId,
            followups,
            generated_by_ai: false,
            input_text:
              (targetAppointment ? contextualTextIntakeValue : textIntakeValue)
                .trim() || null,
            is_current: true,
            source: textIntakeItemId ? "intake_user_accepted" : "manual",
            summary_short: textIntakeDraft.notesSummary.trim() || null,
            takeaways,
            user_id: userId,
            version_number: aiNoteId ? nextVersionNumber + 1 : nextVersionNumber,
          })
          .select("id")
          .single();

        if (noteError) {
          throw noteError;
        }

        if (aiNoteId) {
          const { error: aiArchiveError } = await supabase
            .from("appointment_notes")
            .update({
              superseded_at: new Date().toISOString(),
              superseded_by_note_id: note.id,
            })
            .eq("id", aiNoteId);

          if (aiArchiveError) {
            throw aiArchiveError;
          }
        }

        if (existingNote) {
          const { error: existingArchiveError } = await supabase
            .from("appointment_notes")
            .update({
              is_current: false,
              superseded_at: new Date().toISOString(),
              superseded_by_note_id: note.id,
            })
            .eq("id", existingNote.id);

          if (existingArchiveError) {
            throw existingArchiveError;
          }
        }

        const { error: appointmentNoteError } = await supabase
          .from("appointments")
          .update({
            archived_at:
              selectedMatch?.appointment.status === "archived" ? null : undefined,
            current_note_id: note.id,
            ...Object.fromEntries(
              detailChanges.map((change) => [change.field, change.newValue])
            ),
            status:
              selectedMatch?.appointment.status === "archived"
                ? "scheduled"
                : undefined,
          })
          .eq("id", appointmentId);

        if (appointmentNoteError) {
          throw appointmentNoteError;
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

  function updateBulkAppointmentDraft(
    importId: string,
    field: keyof Omit<BulkAppointmentDraft, "importId" | "isSelected">,
    value: string | number
  ) {
    setBulkAppointmentDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.importId === importId ? { ...draft, [field]: value } : draft
      )
    );
  }

  function toggleBulkAppointmentDraft(importId: string, isSelected: boolean) {
    setBulkAppointmentDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.importId === importId ? { ...draft, isSelected } : draft
      )
    );
  }

  function toggleAllBulkAppointmentDrafts(isSelected: boolean) {
    setBulkAppointmentDrafts((currentDrafts) =>
      currentDrafts.map((draft) => ({ ...draft, isSelected }))
    );
  }

  async function handleSaveBulkAppointments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingTextIntake(true);
    setMessage("");

    try {
      const selectedDrafts = bulkAppointmentDrafts.filter(
        (draft) => draft.isSelected
      );

      if (selectedDrafts.length === 0) {
        throw new Error("Choose at least one appointment to save.");
      }

      if (selectedDrafts.length > 10) {
        throw new Error("Save up to 10 appointments per import.");
      }

      const { careCircleId, careSubjectId, userId } =
        await getPrimaryCareContext(textIntakeSubjectId);

      if (!careSubjectId) {
        throw new Error("Please choose who these appointments are for.");
      }

      const appointmentRows = selectedDrafts.map((draft) => {
        if (!draft.appointmentTitle.trim()) {
          throw new Error("Each selected appointment needs a title.");
        }

        const startsAtDate = draft.startsAt ? new Date(draft.startsAt) : null;

        if (startsAtDate && Number.isNaN(startsAtDate.getTime())) {
          throw new Error(`Check the date and time for ${draft.appointmentTitle}.`);
        }

        return {
          care_circle_id: careCircleId,
          care_subject_id: careSubjectId,
          location_address: draft.locationAddress.trim() || null,
          location_name: draft.locationName.trim() || null,
          location_phone: draft.locationPhone.trim() || null,
          owner_user_id: userId,
          provider_name: draft.providerName.trim() || null,
          provider_organization: draft.providerOrganization.trim() || null,
          reason: draft.appointmentReason.trim() || null,
          source: "manual",
          starts_at: startsAtDate ? startsAtDate.toISOString() : null,
          status: "scheduled",
          title: draft.appointmentTitle.trim(),
        };
      });

      const { data: savedAppointments, error: appointmentError } = await supabase
        .from("appointments")
        .insert(appointmentRows)
        .select("id");

      if (appointmentError) {
        throw appointmentError;
      }

      const savedAppointmentIds =
        savedAppointments?.map((appointment) => appointment.id) ?? [];

      if (textIntakeItemId) {
        const acceptedAppointments = selectedDrafts.map((draft, index) => ({
          appointment_id: savedAppointmentIds[index] ?? null,
          appointment_reason: draft.appointmentReason,
          appointment_title: draft.appointmentTitle,
          confidence: draft.confidence,
          location_address: draft.locationAddress,
          location_name: draft.locationName,
          location_phone: draft.locationPhone,
          provider_name: draft.providerName,
          provider_organization: draft.providerOrganization,
          starts_at_local: draft.startsAt,
          suggested_action: draft.suggestedAction,
        }));

        const { error: intakeUpdateError } = await supabase
          .from("intake_items")
          .update({
            accepted_at: new Date().toISOString(),
            accepted_by_user_id: userId,
            accepted_interpretation: {
              appointments: acceptedAppointments,
              saved_appointment_ids: savedAppointmentIds,
            },
            appointment_id: savedAppointmentIds[0] ?? null,
            interpretation: {
              appointments: acceptedAppointments,
              saved_appointment_ids: savedAppointmentIds,
            },
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
      setBulkAppointmentDrafts([]);
      setBulkAppointmentSummary("");
      setSelectedTextIntakeMatchId("new");
      setActiveAppointmentPanel(null);
      setAppointmentView("upcoming");
      await loadAppointments("upcoming");
      setMessage(`Saved ${savedAppointmentIds.length} appointment(s).`);
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

      const targetSubjectId =
        newAppointmentSubjectId ||
        (selectedSubjectId !== ALL_SUBJECTS ? selectedSubjectId : "");

      const { careCircleId, careSubjectId, userId } =
        await getPrimaryCareContext(targetSubjectId);

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

      setNewAppointmentTitle("");
      setNewAppointmentReason("");
      setNewAppointmentStartsAt("");
      setNewAppointmentProviderName("");
      setNewAppointmentProviderOrganization("");
      setNewAppointmentLocationName("");
      setNewAppointmentLocationAddress("");
      setNewAppointmentLocationPhone("");
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
      appointmentId?: string;
      generationMode?: CarePrepGenerationMode;
      guidanceId?: string;
      message?: string;
    };
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
        setMessage("Notes saved. No upcoming appointment was available for automatic CarePrep.");
        return;
      }

      setMessage(
        `Notes saved. Preparing CarePrep for ${
          nextAppointment.title || "the next appointment"
        }...`
      );
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
      setExpandedCarePrepIds((currentIds) => ({
        ...currentIds,
        [nextAppointment.id]: true,
      }));
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
      const message = getErrorMessage(error);
      setMessage(`Auto-CarePrep did not run: ${message}`);
      showToast(message, { type: "error" });
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
      setExpandedCarePrepIds((currentIds) => ({
        ...currentIds,
        [appointment.id]: true,
      }));
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

  function carePrepBaseFormValues(draft: CarePrepGuidance) {
    return {
      bringList: asTextList(draft.bring_list).join("\n"),
      keyQuestions: asTextList(draft.key_questions).join("\n"),
      medReview: asTextList(draft.med_review).join("\n"),
      nextSteps: asTextList(draft.next_steps).join("\n"),
      sinceLastVisit: asTextList(draft.since_last_visit).join("\n"),
      summary: draft.summary ?? "",
      watchouts: asTextList(draft.watchouts).join("\n"),
    };
  }

  function carePrepFormValues(appointmentId: string, draft: CarePrepGuidance) {
    return {
      ...carePrepBaseFormValues(draft),
      ...carePrepDrafts[appointmentId],
    };
  }

  function hasCarePrepDraftChanges(
    appointmentId: string,
    draft: CarePrepGuidance
  ) {
    const baseValues = carePrepBaseFormValues(draft);
    const currentValues = carePrepFormValues(appointmentId, draft);

    return (
      currentValues.bringList !== baseValues.bringList ||
      currentValues.keyQuestions !== baseValues.keyQuestions ||
      currentValues.medReview !== baseValues.medReview ||
      currentValues.nextSteps !== baseValues.nextSteps ||
      currentValues.sinceLastVisit !== baseValues.sinceLastVisit ||
      currentValues.summary !== baseValues.summary ||
      currentValues.watchouts !== baseValues.watchouts
    );
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
        throw new Error(result.error ?? "CarePrep review failed.");
      }

      setCarePrepDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[appointmentId];
        return nextDrafts;
      });
      await loadAppointments();
      setExpandedCarePrepIds((currentIds) => ({
        ...currentIds,
        [appointmentId]: true,
      }));
      setMessage(result.message ?? "CarePrep reviewed.");
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

      const { careCircleId, userId } = await getPrimaryCareContext();
      const existingNote = notesByAppointment.get(appointment.id);

      const { data: newNote, error: insertError } = await supabase
        .from("appointment_notes")
        .insert({
        appointment_id: appointment.id,
        care_circle_id: careCircleId,
        user_id: userId,
        input_text: summary || null,
        summary_short: summary || null,
        takeaways,
        followups,
        is_current: true,
        version_number: existingNote ? existingNote.version_number + 1 : 1,
        source: existingNote ? "manual_edit" : "manual",
        generated_by_ai: false,
        accepted_by_user: true,
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      if (existingNote) {
        const { error: archiveError } = await supabase
          .from("appointment_notes")
          .update({
            is_current: false,
            superseded_at: new Date().toISOString(),
            superseded_by_note_id: newNote.id,
          })
          .eq("id", existingNote.id);

        if (archiveError) {
          throw archiveError;
        }
      }

      const { error: appointmentLogError } = await supabase
        .from("appointments")
        .update({
          current_note_id: newNote.id,
        })
        .eq("id", appointment.id);

      if (appointmentLogError) {
        throw appointmentLogError;
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
      void triggerAutoCarePrepAfterNotes({
        careCircleId,
        careSubjectId: appointment.care_subject_id,
        sourceAppointmentId: appointment.id,
      });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingNoteForId(null);
    }
  }

  const gentlePrimaryButtonClass =
    "rounded-full bg-[#2B6198] px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-[#24547f] disabled:bg-slate-300 disabled:text-white";
  const gentleSecondaryButtonClass =
    "rounded-full border border-blue-100 bg-white/85 px-4 py-2 font-semibold text-[#2B6198] shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 disabled:bg-slate-50 disabled:text-slate-400";
  const gentleSoftBlueButtonClass =
    "rounded-full border border-blue-100 bg-blue-50 px-4 py-2 font-semibold text-blue-800 shadow-sm transition hover:border-blue-200 hover:bg-blue-100 disabled:bg-slate-50 disabled:text-slate-400";
  const gentleSmallBlueButtonClass =
    "rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300";
  const gentleSmallSecondaryButtonClass =
    "rounded-full border border-slate-200 bg-white/85 px-3 py-2 text-sm font-semibold text-[#2B6198] shadow-sm transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700 disabled:bg-slate-50 disabled:text-slate-400";
	  const gentleCautionButtonClass =
	    "rounded-full border border-rose-100 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-100 disabled:bg-slate-50 disabled:text-slate-400";
	  const gentleWarmButtonClass =
	    "rounded-full border border-blue-200 bg-white/85 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-900 disabled:bg-slate-50 disabled:text-slate-400";
  const appointmentSectionButtonClass =
    "inline-flex items-center justify-center rounded-lg border border-blue-100 bg-[#f4faff] px-4 py-2.5 text-lg font-semibold text-blue-950 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:text-slate-400";
  const appointmentSectionTitleButtonClass =
    "-ml-3 inline-flex items-center justify-center rounded-lg px-3 py-2.5 text-lg font-semibold text-blue-950 transition hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-200";
  const appointmentToolIconButtonClass =
    "inline-flex h-10 w-10 items-center justify-center rounded-full text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:text-slate-400";

  function renderPlaceLookup(className = "") {
    const canFavorite =
      Boolean(newAppointmentLocationName.trim()) ||
      Boolean(newAppointmentProviderOrganization.trim()) ||
      Boolean(newAppointmentLocationAddress.trim());

    return (
      <section
        className={`rounded-md border border-blue-100 bg-white p-3 ${className}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Location lookup
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Search favorite locations first, or look up a place with Google.
            </p>
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
            setSelectedGooglePlace(null);
            setPlacesStatusMessage("");
            if (nextQuery.trim().length < 3) {
              setPlaceLookupSuggestions([]);
            }
          }}
          placeholder="Search by clinic, business, or address"
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
    const nextSubject = homeNextAppointment?.care_subject_id
      ? subjectsById.get(homeNextAppointment.care_subject_id)?.display_name
      : "";
    const homeMapsLink = googleMapsUrl(homeNextAppointment?.location_address ?? null);
    const homePracticeLabel =
      homeNextAppointment?.provider_organization ||
      homeNextAppointment?.location_name ||
      "";
    const homeCarePrepGenerationError = homeNextAppointment
      ? carePrepGenerationErrors[homeNextAppointment.id]
      : null;
    const hasExistingWelcomeAppointments =
      hasAnySavedAppointments ||
      Boolean(homeNextAppointment) ||
      Boolean(notesReminderAppointment);
    const welcomeActionsMode =
      hasExistingWelcomeAppointments &&
      welcomeExistingAppointmentsVariant === "returnHome"
        ? "returnHome"
        : "firstActions";
    const welcomePanels = [
      {
        alt: "Appointment notes feeding CarePrep and context",
        body: "Important context is often lost over time.",
        emphasis: "We all live in this gap.",
        src: "/welcome/panel1.png",
      },
      {
        alt: "CarePrep questions and missed appointment context",
        body: "Context is what connects one visit to the next.",
        src: "/welcome/panel2.png",
      },
      {
        alt: "CarePrep created from appointment notes",
        body:
          "Visit Notes help CarePland create CarePrep and carry forward context into future visits.",
        src: "/welcome/panel3.jpg",
      },
    ];
    const activeWelcomePanel =
      welcomePanels[welcomePanelIndex] ?? welcomePanels[0];
    const isFirstWelcomePanel = welcomePanelIndex === 0;
    const isLastWelcomePanel = welcomePanelIndex === welcomePanels.length - 1;
    const showPreviousWelcomePanel = () =>
      setWelcomePanelIndex((currentIndex) =>
        currentIndex === 0 ? currentIndex : currentIndex - 1
      );
    const showNextWelcomePanel = () =>
      setWelcomePanelIndex((currentIndex) =>
        currentIndex === welcomePanels.length - 1
          ? currentIndex
          : currentIndex + 1
      );

    return (
      <div className="mt-6 space-y-5">
        {showWelcomeGuide ? (
          <section className="py-6">
            <div className="mx-auto mt-5 w-full max-w-[720px] overflow-hidden rounded-lg border-4 border-black bg-black shadow-sm">
              <iframe
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
                className="aspect-video w-full border-0"
                src="https://player.mux.com/Ypm2KjtOwCsiE6Kb6vexjyJFm7jpSI005jadJyOHW4VU?autoplay=muted&muted=true&playsinline=true&loop=false&controls=false&poster=https%3A%2F%2Fimage.mux.com%2FYpm2KjtOwCsiE6Kb6vexjyJFm7jpSI005jadJyOHW4VU%2Fthumbnail.png%3Fwidth%3D214%26height%3D121%26time%3D0"
                title="CarePland - The Gap"
              />
            </div>

            <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-8 text-slate-700">
              CarePland helps carry forward important context between
              appointments, helping you remember what changed, what mattered,
              and what comes next.
            </p>

            <div className="mx-auto mt-8 max-w-4xl">
              <h2 className="mb-4 text-center text-xl font-semibold text-[#2B6198]">
                Continuity, shown through just three slides
              </h2>
              <article className="text-center">
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl">
                  <Image
                    alt={activeWelcomePanel.alt}
                    className="object-contain"
                    fill
                    sizes="(min-width: 768px) 672px, 100vw"
                    src={activeWelcomePanel.src}
                  />
                  <button
                    aria-label="Previous welcome panel"
                    className={`absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-4xl font-light leading-none text-[#2B6198]/60 hover:bg-white/40 hover:text-[#2B6198]/80 ${
                      isFirstWelcomePanel ? "opacity-25" : ""
                    }`}
                    disabled={isFirstWelcomePanel}
                    onClick={showPreviousWelcomePanel}
                    type="button"
                  >
                    ‹
                  </button>
                  <button
                    aria-label="Next welcome panel"
                    className={`absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-4xl font-light leading-none text-[#2B6198]/60 hover:bg-white/40 hover:text-[#2B6198]/80 ${
                      isLastWelcomePanel ? "opacity-25" : ""
                    }`}
                    disabled={isLastWelcomePanel}
                    onClick={showNextWelcomePanel}
                    type="button"
                  >
                    ›
                  </button>
                </div>
                <div className="mx-auto mt-4 flex min-h-28 max-w-4xl flex-col items-center justify-start sm:min-h-24">
                  <p className="text-lg leading-8 text-slate-700">
                    {activeWelcomePanel.body}
                  </p>
                  {activeWelcomePanel.emphasis ? (
                    <p className="mt-1 text-xl font-semibold text-[#2B6198]">
                      {activeWelcomePanel.emphasis}
                    </p>
                  ) : null}
                </div>
              </article>
            </div>

            <div className="mx-auto mt-1 h-0.5 w-40 max-w-[48%] rounded-full bg-blue-200 sm:w-52" />

            {welcomeActionsMode === "firstActions" ? (
              <p className="mt-7 text-center text-xl font-semibold text-[#2B6198]">
                Let&apos;s start building your context
              </p>
            ) : null}

            <div
              className={`relative mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3 md:min-h-12 ${
                welcomeActionsMode === "firstActions" ? "mt-4" : "mt-7"
              }`}
            >
              {welcomeActionsMode === "returnHome" ? (
                <button
                  className={`${gentlePrimaryButtonClass} px-5 py-2.5 text-sm`}
                  onClick={async () => {
                    await markWelcomeGuideRead();
                  }}
                  type="button"
                >
                  Return home
                </button>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      className={`${gentlePrimaryButtonClass} px-5 py-2.5 text-sm`}
                      onClick={async () => {
                        await markWelcomeGuideRead();
                        startAppointmentPanel("add");
                      }}
                      type="button"
                    >
                      Add your first appointment
                    </button>
                    <button
                      className={`${gentleSecondaryButtonClass} px-5 py-2.5 text-sm text-[#2B6198]`}
                      onClick={async () => {
                        await markWelcomeGuideRead();
                        startAppointmentPanel("quickAdd");
                      }}
                      type="button"
                    >
                      Import appointments
                    </button>
                  </div>
                  {sampleDataSeededAt ? (
                    <button
                      className="text-sm font-semibold text-[#2B6198] underline decoration-blue-200 underline-offset-4 transition hover:text-blue-800 hover:decoration-blue-400 md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2"
                      onClick={() => {
                        setAskPanelOpen(true);
                        setAskCloseConfirmOpen(false);
                      }}
                      type="button"
                    >
                      Need help?
                    </button>
                  ) : null}
                </>
              )}
            </div>

            {welcomeActionsMode === "firstActions" && !sampleDataSeededAt ? (
              <div className="relative mx-auto mt-3 flex max-w-4xl flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-600 md:min-h-11">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span>Not sure?</span>
                  <button
                    className="rounded-full border border-blue-100 bg-white/60 px-3.5 py-1.5 text-sm font-medium text-slate-500 shadow-sm transition hover:bg-blue-50 hover:text-[#2B6198] disabled:text-slate-400"
                    disabled={seedingSampleData}
                    onClick={async () => {
                      await markWelcomeGuideRead();
                      await handleSeedSampleDataForCurrentUser(true);
                    }}
                    type="button"
                  >
                    {seedingSampleData
                      ? "Adding..."
                      : "We'll add examples for you to explore"}
                  </button>
                </div>
                <button
                  className="text-sm font-semibold text-[#2B6198] underline decoration-blue-200 underline-offset-4 transition hover:text-blue-800 hover:decoration-blue-400 md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2"
                  onClick={() => {
                    setAskPanelOpen(true);
                    setAskCloseConfirmOpen(false);
                  }}
                  type="button"
                >
                  Need help?
                </button>
              </div>
            ) : null}

            {isAdmin && hasExistingWelcomeAppointments ? (
              <div className="mx-auto mt-5 flex max-w-4xl justify-start">
                <div className="flex items-center rounded-full border border-slate-200 bg-white/70 p-0.5 text-[11px] font-semibold text-slate-400 shadow-sm">
                  <button
                    aria-pressed={
                      welcomeExistingAppointmentsVariant === "firstActions"
                    }
                    className={`rounded-full px-2.5 py-1 transition ${
                      welcomeExistingAppointmentsVariant === "firstActions"
                        ? "bg-blue-50 text-blue-800"
                        : "hover:text-blue-700"
                    }`}
                    onClick={() => {
                      setWelcomeExistingAppointmentsVariant("firstActions");
                    }}
                    type="button"
                  >
                    First time
                  </button>
                  <button
                    aria-pressed={
                      welcomeExistingAppointmentsVariant === "returnHome"
                    }
                    className={`rounded-full px-2.5 py-1 transition ${
                      welcomeExistingAppointmentsVariant === "returnHome"
                        ? "bg-blue-50 text-blue-800"
                        : "hover:text-blue-700"
                    }`}
                    onClick={() => {
                      setWelcomeExistingAppointmentsVariant("returnHome");
                    }}
                    type="button"
                  >
                    Returning users
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <HomeNextAppointmentPanel
            appointment={homeNextAppointment}
            formatDate={formatDate}
            generationError={homeCarePrepGenerationError}
            guidance={homeNextGuidance}
            highlights={homeCarePrepHighlights}
            isGenerating={
              generatingCarePrepForId === homeNextAppointment?.id
            }
            mapsLink={homeMapsLink}
            nextSubject={nextSubject ?? ""}
            onAddAppointment={() => startAppointmentPanel("add")}
            onGenerateCarePrep={() => {
              if (homeNextAppointment) {
                void handleGenerateCarePrep(homeNextAppointment);
              }
            }}
            onOpenAppointment={() => {
              void handleChangeMainTab("appointments");
              void handleChangeAppointmentView("upcoming");
            }}
            practiceLabel={homePracticeLabel}
          />
        )}

        {!showWelcomeGuide && notesReminderAppointment ? (
          <section>
            <button
              className={`inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border px-4 py-2 text-left text-sm font-semibold text-blue-800 ${
                textIntakeTargetAppointmentId === notesReminderAppointment.id
                  ? "border-blue-300 bg-white shadow-sm"
                  : "border-blue-200 bg-[#f4faff] hover:bg-[#eef7ff]"
              }`}
              onClick={() => {
                if (textIntakeTargetAppointmentId === notesReminderAppointment.id) {
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
              <section className="mt-3 rounded-lg border border-blue-200 bg-[#f4faff] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium text-blue-950">
                    Closing will discard your unsaved changes. Proceed?
                  </p>
                  <div className="flex flex-wrap gap-2">
		              <button
		                className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:bg-slate-50 disabled:text-slate-400"
		                onClick={() =>
                        discardAndSwitchAppointmentModifier(
                          notesReminderAppointment
                        )
                      }
                      type="button"
                    >
                      Discard and close
                    </button>
                    <button
                      className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900"
                      onClick={() => setPendingModifierSwitch(null)}
                      type="button"
                    >
                      Return to editing
                    </button>
                  </div>
                </div>
              </section>
            ) : null}
            {textIntakeTargetAppointmentId === notesReminderAppointment.id ? (
              <form
                className="mt-3 rounded-lg border border-blue-100 bg-white p-4 shadow-sm"
                onSubmit={
                  textIntakeDraft
                    ? handleSaveTextIntakeDraft
                    : handleInterpretTextIntake
                }
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      <span className="font-semibold">
                        Type or paste what happened.
                      </span>{" "}
                      <span className="block sm:inline">
                        CarePland will organize it before saving.
                      </span>
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
                    <label className="mt-4 block text-sm font-medium text-slate-700">
                      Visit notes
                      <textarea
                        className="mt-2 min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                        onChange={(event) =>
                          setContextualTextIntakeValue(event.target.value)
                        }
                        placeholder="Type or paste portal notes, after-visit summaries, or anything you want to remember."
                        value={contextualTextIntakeValue}
                      />
                    </label>
                    <button
                      className="mt-4 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:border-blue-200 hover:bg-[#eef7ff] disabled:text-slate-400"
                      disabled={processingTextIntake}
                      type="submit"
                    >
                      {processingTextIntake ? "Interpreting..." : "Review notes"}
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
	                    className={gentleWarmButtonClass}
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
          </section>
        ) : null}
      </div>
    );
  }

  const isSignedInAppShell =
    Boolean(signedInEmail) &&
    authMode !== "updatePassword" &&
    !needsBetaAgreement &&
    !needsOnboarding;
  const canUseAskPanel =
    isSignedInAppShell ||
    (Boolean(signedInEmail) &&
      authMode !== "updatePassword" &&
      !needsBetaAgreement &&
      needsOnboarding);
  const canShowAskEntry = canUseAskPanel && !showWelcomeGuide && !needsOnboarding;
  const signedInDisplayName = savedProfileLabel || signedInEmail;
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
  const locationSheetMapsLink = locationSheetAppointment
    ? googleMapsUrl(locationSheetAppointment.location_address)
    : null;
  const locationSheetPhoneHref = locationSheetAppointment?.location_phone
    ? `tel:${locationSheetAppointment.location_phone.replace(/[^\d+]/g, "")}`
    : null;
  const isUserFacingTab =
    mainTab === "home" || mainTab === "appointments" || mainTab === "profile";
  const showUserFacingFooter =
    isSignedInAppShell &&
    isUserFacingTab &&
    !(mainTab === "home" && showWelcomeGuide);
  const userFacingFooterBuildInfo = isAdmin
    ? `Build Number ${careplandBuildNumber} * Build dttm: ${careplandBuildDttm}`
    : null;

  if (!sessionRestored) {
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

  return (
    <main
      className={`min-h-screen overflow-x-clip bg-slate-50 px-3 text-slate-900 sm:px-4 lg:px-6 lg:py-8 ${
        isSignedInAppShell ? "pb-6 pt-2 sm:pt-4" : "py-6"
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
          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2 lg:gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                aria-label={
                  isSignedInAppShell
                    ? "Home"
                    : "Go to the CarePland website"
                }
                className="shrink-0 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
                onClick={async () => {
                  if (isSignedInAppShell) {
                    if (showWelcomeGuide) {
                      await markWelcomeGuideRead();
                    }
                    void handleChangeMainTab("home");
                    return;
                  }

                  window.location.assign("https://www.carepland.com");
                }}
                type="button"
              >
                <Image
                  alt="CarePland"
                  className={
                    isSignedInAppShell
                      ? "h-auto w-9 min-[390px]:w-10 sm:w-12"
                      : "h-auto w-20 sm:w-24"
                  }
                  height={isSignedInAppShell ? 460 : 100}
                  priority
                  src={
                    isSignedInAppShell
                      ? "/carepland-loop-mark.png"
                      : "/carepland-logo.png"
                  }
                  width={isSignedInAppShell ? 460 : 160}
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
	              {signedInEmail ? (
	                <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 xl:inline-flex">
	                  {currentPricingTier.name}
	                </span>
	              ) : null}
              {runtimeEnvironmentLabel ? (
                <span
                  className="hidden rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900 xl:inline-flex"
                  title="Non-production environment"
                >
                  {runtimeEnvironmentLabel}
                </span>
              ) : null}
            </div>

            {isSignedInAppShell && !showWelcomeGuide ? (
              <nav
                className={`flex min-w-0 items-center gap-1 sm:gap-2 ${
                  isAdmin ? "justify-center" : "justify-start"
                }`}
                aria-label="Main navigation"
              >
              <button
                className={`h-10 shrink-0 rounded-full border px-3 text-sm font-semibold leading-none shadow-sm transition sm:h-11 sm:px-4 md:text-base ${
                  mainTab === "appointments"
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-white/80 text-slate-600 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700"
                }`}
                onClick={async () => {
                  if (showWelcomeGuide) {
                    await markWelcomeGuideRead();
                  }
                  await handleChangeMainTab("appointments");
                }}
                type="button"
              >
                Appointments
              </button>
              <button
                aria-label="Profile"
                className={`hidden h-11 min-w-11 shrink-0 items-center justify-center rounded-full border px-4 text-sm font-semibold shadow-sm transition md:flex md:text-base ${
                  mainTab === "profile"
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-white/80 text-slate-600 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700"
                }`}
                onClick={async () => {
                  if (showWelcomeGuide) {
                    await markWelcomeGuideRead();
                  }
                  await handleChangeMainTab("profile");
                }}
                type="button"
                title="Profile"
              >
                Profile
              </button>
              {isAdmin ? (
                <button
                  aria-label="Admin"
	                  className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border px-2.5 text-sm font-semibold shadow-sm transition sm:h-11 sm:min-w-11 sm:px-3 md:px-4 md:text-base ${
	                    mainTab === "admin"
	                      ? "border-blue-200 bg-blue-50 text-blue-800"
	                      : "border-slate-200 bg-white/80 text-slate-600 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700"
	                  }`}
                  onClick={async () => {
                    if (showWelcomeGuide) {
                      await markWelcomeGuideRead();
                    }
                    await handleChangeMainTab("admin");
                  }}
                  type="button"
                  title="Admin"
                >
                  <GearIcon className="h-5 w-5 md:hidden" />
                  <span className="hidden md:inline">Admin</span>
                </button>
              ) : null}
              </nav>
            ) : null}

            <div className="flex min-w-0 items-center justify-end gap-1 text-sm text-slate-600 sm:gap-2">
              {isSignedInAppShell && !showWelcomeGuide ? (
                <span className="hidden min-w-0 truncate font-semibold text-slate-900 md:inline xl:max-w-60 2xl:max-w-none">
                  {signedInDisplayName}
                </span>
              ) : null}
              {isSignedInAppShell && !showWelcomeGuide ? (
                <button
                  aria-label="Profile"
	                className={`inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border px-2.5 shadow-sm transition sm:h-11 sm:min-w-11 sm:px-3 md:hidden ${
	                  mainTab === "profile"
	                    ? "border-blue-200 bg-blue-50 text-blue-800"
	                    : "border-slate-200 bg-white/80 text-slate-600 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-700"
	                }`}
                  onClick={async () => {
                    if (showWelcomeGuide) {
                      await markWelcomeGuideRead();
                    }
                    await handleChangeMainTab("profile");
                  }}
                  title="Profile"
                  type="button"
                >
                  <UserIcon className="h-5 w-5" />
                </button>
              ) : null}
              {isSignedInAppShell && isAdmin && !showWelcomeGuide ? (
                <button
                  className="hidden items-center overflow-hidden rounded-full border border-slate-200 bg-white text-xs font-semibold shadow-sm min-[410px]:inline-flex"
                  onClick={async () => {
                    setMainTab("admin");
                    await handleChangeAdminTab("tickets");
                  }}
                  type="button"
                >
                  <span
                    className={`px-2.5 py-1 ${
                      adminNewTickets.length > 0
                        ? "bg-red-50 text-red-700"
                        : "bg-slate-50 text-slate-500"
                    }`}
                  >
                    {adminNewTickets.length} New
                  </span>
                  <span
                    className={`border-l border-slate-200 px-2.5 py-1 ${
                      adminTicketsNeedingFollowup.length > 0
                        ? "bg-amber-50 text-amber-800"
                        : "bg-slate-50 text-slate-500"
                    }`}
                  >
                    {adminTicketsNeedingFollowup.length} Followup
                  </span>
                </button>
              ) : null}
              {canShowAskEntry ? (
                <button
                  aria-label="Ask CarePland"
                  aria-expanded={askPanelOpen}
	                  className={`inline-flex h-10 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-semibold shadow-sm transition sm:h-11 sm:px-4 ${
	                    askPanelOpen
	                      ? "border-blue-200 bg-blue-100 text-[#2B6198]"
	                      : "border-blue-100 bg-blue-50 text-[#2B6198] hover:border-blue-200 hover:bg-blue-100"
	                  }`}
                  data-testid="ask-entry"
                  onClick={() => {
                    if (askPanelOpen) {
                      requestCloseAskPanel();
                      return;
                    }

                    setAskPanelOpen(true);
                    setAskCloseConfirmOpen(false);
                  }}
                  title="Ask CarePland"
                  type="button"
                >
                  Ask
                </button>
              ) : null}
            </div>
          </div>
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
          <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Set a new password</h2>
                <p className="mt-1 text-slate-600">
                  Enter and confirm a new password for your CarePland account.
                </p>
              </div>
              <button
                className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                onClick={() => {
                  setAuthMode("signIn");
                  setPassword("");
                  setConfirmPassword("");
                  clearAuthRedirectUrl();
                  setMessage("");
                }}
                type="button"
              >
                Back to sign in
              </button>
            </div>

            <form
              className="mt-5 max-w-xl space-y-4"
              onSubmit={handleUpdatePassword}
            >
              <label className="block text-sm font-medium text-slate-700">
                New password
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  minLength={8}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setMessage("");
                  }}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Confirm new password
                <input
                  aria-invalid={passwordsMismatch}
                  className={`mt-2 w-full rounded-md border px-3 py-2 text-base ${
                    passwordsMismatch ? "border-red-500" : "border-slate-300"
                  }`}
                  minLength={8}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setMessage("");
                  }}
                  required
                  type="password"
                  value={confirmPassword}
                />
                {passwordsMismatch ? (
                  <span className="mt-2 block text-sm font-semibold text-red-700">
                    Passwords do not match.
                  </span>
                ) : null}
              </label>
              <button
                className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                disabled={!canSubmitAuth}
                type="submit"
              >
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>

            {message ? (
              <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            ) : null}
          </section>
        ) : needsBetaAgreement ? (
          <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Early Access notice</h2>
                <p className="mt-1 max-w-3xl text-slate-600">
                  {appContentText("beta_notice_intro")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={gentleSmallSecondaryButtonClass}
                  onClick={() => {
                    setAskPanelOpen(true);
                    setAskCloseConfirmOpen(false);
                  }}
                  type="button"
                >
                  Need help?
                </button>
                <button
                  className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                  onClick={() => void handleSignOut()}
                  type="button"
                >
                  Sign out
                </button>
              </div>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleAcceptBetaAgreement}>
              <label className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <input
                  checked={acceptBetaTerms}
                  className="mt-1"
                  onChange={(event) => setAcceptBetaTerms(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  {appContentText("beta_terms_ack")}
                </span>
              </label>
              <label className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <input
                  checked={acceptBetaPrivacy}
                  className="mt-1"
                  onChange={(event) => setAcceptBetaPrivacy(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  {appContentText("beta_privacy_ack")}
                </span>
              </label>
              <label className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <input
                  checked={acceptBetaDisclaimer}
                  className="mt-1"
                  onChange={(event) =>
                    setAcceptBetaDisclaimer(event.target.checked)
                  }
                  type="checkbox"
                />
                <span>
                  {appContentText("beta_disclaimer_ack")}
                </span>
              </label>
              <button
                className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                disabled={
                  loading ||
                  !acceptBetaTerms ||
                  !acceptBetaPrivacy ||
                  !acceptBetaDisclaimer
                }
                type="submit"
              >
                {loading ? "Saving..." : "Continue"}
              </button>
            </form>

            {message ? (
              <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            ) : null}
          </section>
        ) : needsOnboarding ? (
          <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Set up your profile</h2>
                <p className="mt-1 text-slate-600">
                  {requiresEmailUpdate
                    ? "Start by adding an email you can access, then confirm the basics CarePland needs for dates and contact."
                    : "Confirm the basics CarePland needs for dates, contact, and support follow-up."}
                </p>
              </div>
              <button
                className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                onClick={() => void handleSignOut()}
                type="button"
              >
                Sign out
              </button>
            </div>

            <form
              className="mt-5 grid gap-4 md:grid-cols-2"
              onSubmit={handleSaveProfile}
            >
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>Email</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                {requiresEmailUpdate ? (
                  <>
                    <input
                      autoComplete="email"
                      className="mt-2 w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-base"
                      onChange={(event) =>
                        updateProfileDraft("email", event.target.value)
                      }
                      placeholder="you@example.com"
                      required
                      type="email"
                      value={profileDraft.email}
                    />
                    <span className="mt-2 block text-xs font-normal text-amber-800">
                      Enter an email you can access for account recovery.
                    </span>
                  </>
                ) : (
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-base text-slate-700">
                    {verifiedAccountEmail || "Verified account email"}
                  </div>
                )}
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>Phone</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft(
                      "phone",
                      formatUsPhoneFromDigits(phoneDigits(event.target.value))
                    )
                  }
                  inputMode="numeric"
                  placeholder="(___) ___-____"
                  required
                  type="tel"
                  value={profileDraft.phone}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>First name</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("givenName", event.target.value)
                  }
                  required
                  type="text"
                  value={profileDraft.givenName}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>Last name</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("familyName", event.target.value)
                  }
                  required
                  type="text"
                  value={profileDraft.familyName}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Display name
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("displayName", event.target.value)
                  }
                  placeholder="Optional, if different"
                  type="text"
                  value={profileDraft.displayName}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>Time zone</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                <select
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("timezone", event.target.value)
                  }
                  required
                  value={profileDraft.timezone}
                >
                  <option value="">Select time zone</option>
                  {!timeZoneOptions.some(
                    (option) => option.value === profileDraft.timezone
                  ) && profileDraft.timezone ? (
                    <option value={profileDraft.timezone}>
                      {profileDraft.timezone}
                    </option>
                  ) : null}
                  {timeZoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} · {option.value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Address line 1
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("addressLine1", event.target.value)
                  }
                  placeholder="Optional"
                  value={profileDraft.addressLine1}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Address line 2
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("addressLine2", event.target.value)
                  }
                  placeholder="Optional"
                  value={profileDraft.addressLine2}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                City
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("city", event.target.value)
                  }
                  value={profileDraft.city}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                State / region
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("region", event.target.value)
                  }
                  value={profileDraft.region}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>ZIP code</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  inputMode="numeric"
                  onChange={(event) =>
                    updateProfileDraft("postalCode", event.target.value)
                  }
                  placeholder="12345 or 12345-6789"
                  required
                  value={profileDraft.postalCode}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Country
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("country", event.target.value)
                  }
                  value={profileDraft.country}
                />
              </label>
              <div className="md:col-span-2">
                <button
                  className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                  disabled={savingProfile}
                  type="submit"
                >
                  {savingProfile ? "Saving..." : "Continue"}
                </button>
              </div>
            </form>

            {message ? (
              <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            ) : null}
          </section>
        ) : signedInEmail && mainTab === "home" ? (
          renderHomeView()
        ) : signedInEmail && mainTab === "profile" ? (
          <div className="mt-6 space-y-5">
            <section className="rounded-lg bg-blue-50 px-5 py-5 ring-1 ring-blue-100">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="break-words text-xl font-semibold text-slate-950">
                    {savedProfileLabel
                      ? `${savedProfileLabel}'s CarePland account`
                      : "Your CarePland account"}
                  </h2>
                </div>
                <button
                  className={`${gentleSecondaryButtonClass} text-sm`}
                  onClick={() => void handleSignOut()}
                  type="button"
                >
                  Sign out
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_18rem]">
                <section className="rounded-md bg-white/75 p-4 ring-1 ring-blue-100 sm:order-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Plan
                    </div>
                    {isAdmin ? (
                      <label className="w-[7.5rem]">
                        <span className="sr-only">Preview plan</span>
                        <select
                          aria-label="Preview plan"
                          className="h-7 w-full rounded-md border border-blue-100 bg-white px-2 text-xs font-semibold leading-none text-slate-500"
                          onChange={(event) => {
                            const selectedTierId = event.target.value;
                            setAdminPlanPreviewId(
                              selectedTierId === actualPricingTier.id
                                ? ""
                                : selectedTierId
                            );
                            setPlanHelpExpanded(true);
                          }}
                          title="Admin-only local plan preview. Does not change the real account plan."
                          value={currentPricingTier.id}
                        >
                          {pricingTiers.map((tier) => (
                            <option key={tier.id} value={tier.id}>
                              {tier.id === "premium_individual"
                                ? "Premium"
                                : tier.id === "early_access"
                                  ? "Early"
                                  : tier.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <button
                        className="h-7 whitespace-nowrap text-xs font-semibold text-slate-400"
                        disabled
                        title="Plan changes are not wired up yet."
                        type="button"
                      >
                        Change Plan
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 font-semibold text-slate-950">
                      <span>{currentPricingTier.name}</span>
                      {isAdmin ? (
                        <span
                          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-amber-800"
                          title="Admin access is managed separately from plan billing."
                        >
                          Admin
                        </span>
                      ) : null}
                      {isPreviewingPlan ? (
                        <span
                          className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-blue-700"
                          title={`Previewing ${currentPricingTier.name}; actual plan is ${actualPricingTier.name}.`}
                        >
                          Preview
                        </span>
                      ) : null}
                      <button
                        aria-expanded={planHelpExpanded}
                        aria-label="Explain CarePland plan tiers"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-200 bg-white text-xs font-bold text-blue-700"
                        onClick={() =>
                          setPlanHelpExpanded((isExpanded) => !isExpanded)
                        }
                        type="button"
                      >
                        ?
                      </button>
                    </span>
                  </div>
                  <div
                    aria-hidden={!planHelpExpanded}
                    className={`mt-3 rounded-md border border-blue-100 bg-white p-3 text-sm text-slate-700 ${
                      planHelpExpanded ? "" : "hidden"
                    }`}
                  >
                    <p className="mb-3 leading-5 text-slate-800">
                      {currentPlanSummary}
                    </p>
                    <dl className="space-y-3">
                      {currentPlanFeatureRows.map(([label, value]) => (
                        <div className="grid gap-1 sm:grid-cols-[6rem_minmax(0,1fr)]" key={label}>
                          {label ? (
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {label}
                            </dt>
                          ) : null}
                          <dd className="leading-5 text-slate-800">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-4 border-t border-blue-100 pt-3">
                      <button
                        className="text-sm font-semibold text-slate-400"
                        disabled
                        title="Plan changes are not wired up yet."
                        type="button"
                      >
                        Plan change options coming later
                      </button>
                    </div>
                  </div>
                </section>

                {canUseMultipleCareVips ? (
                  <section className="rounded-md bg-white/75 p-4 ring-1 ring-blue-100 sm:order-3 sm:col-span-2 xl:order-2 xl:col-span-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        CARE VIPs
                      </h3>
                      <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {careSubjects.length}/{careVipLimit}
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      Manage everyone whose appointments
                      <br />
                      are connected to your account.
                    </p>
                    {careSubjects.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {careSubjects.map((subject) => (
                          <span
                            className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
                            key={subject.id}
                          >
                            {subject.display_name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <form className="mt-4" onSubmit={handleCreateCareVip}>
                      <label className="block text-sm font-medium text-slate-700">
                        Add Care VIP
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                          disabled={!canAddCareVip}
                          onChange={(event) =>
                            setNewCareVipName(event.target.value)
                          }
                          placeholder="Name"
                          type="text"
                          value={newCareVipName}
                        />
                      </label>
                      <button
                        className={`mt-3 w-full ${gentleSoftBlueButtonClass}`}
                        disabled={creatingCareVip || !canAddCareVip}
                        type="submit"
                      >
                        {creatingCareVip ? "Adding..." : "Add Care VIP"}
                      </button>
                      {!canAddCareVip ? (
                        <p className="mt-3 text-sm text-slate-500">
                          {entitlement.plan_name} includes {careVipLimit}{" "}
                          active Care VIPs.
                        </p>
                      ) : null}
                    </form>
                  </section>
                ) : null}

                <section className="rounded-md bg-white/75 p-4 ring-1 ring-blue-100 sm:order-2 xl:order-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Account tools
                  </h3>
                  <div className="mt-3 border-b border-blue-100 pb-4">
                    <p className="text-sm text-slate-600">
                      Send reset link to your verified email.
                    </p>
                    <button
                      className={`mt-3 w-full ${gentleSecondaryButtonClass} text-sm`}
                      disabled={sendingPasswordReset}
                      onClick={handleSendProfilePasswordReset}
                      type="button"
                    >
                      {sendingPasswordReset ? "Sending..." : "Reset password"}
                    </button>
                  </div>
                  <div className="mt-4">
                    {sampleDataSeededAt ? (
                      <p className="text-sm text-slate-600">
                        Remove sample data only.
                        <br />
                        Your own appointments are safe.
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600">
                        Add sample appointments and data to quickly try out
                        CarePland features.
                      </p>
                    )}
                    {sampleDataSeededAt ? (
	                      <button
	                        className={`mt-3 w-full ${gentleSecondaryButtonClass} text-sm`}
	                        disabled={removingSampleData}
	                        onClick={handleRemoveSampleData}
                        type="button"
                      >
                        {removingSampleData
                          ? "Removing..."
                          : "Remove demo data"}
                      </button>
                    ) : (
                      <button
                        className={`mt-3 w-full ${gentleSecondaryButtonClass} text-sm`}
                        disabled={seedingSampleData}
                        onClick={() => handleSeedSampleDataForCurrentUser(true)}
                        type="button"
                      >
                        {seedingSampleData ? "Adding..." : "Add demo data"}
                      </button>
                    )}
                  </div>
                </section>
              </div>
            </section>

            <form
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              onSubmit={handleSaveProfile}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Contact details
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Required basics are used to keep appointment timing and
                    support follow-up accurate.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>Email</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                {requiresEmailUpdate ? (
                  <>
                    <input
                      autoComplete="email"
                      className="mt-2 w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-base"
                      onChange={(event) =>
                        updateProfileDraft("email", event.target.value)
                      }
                      placeholder="you@example.com"
                      required
                      type="email"
                      value={profileDraft.email}
                    />
                    <span className="mt-2 block text-xs font-normal text-amber-800">
                      Enter an email you can access for account recovery.
                    </span>
                  </>
                ) : (
                  <div className="mt-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-base text-slate-700">
                    {verifiedAccountEmail || "Verified account email"}
                  </div>
                )}
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>Phone</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  inputMode="numeric"
                  onChange={(event) =>
                    updateProfileDraft(
                      "phone",
                      formatUsPhoneFromDigits(phoneDigits(event.target.value))
                    )
                  }
                  placeholder="(___) ___-____"
                  required
                  type="tel"
                  value={profileDraft.phone}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>First name</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("givenName", event.target.value)
                  }
                  required
                  type="text"
                  value={profileDraft.givenName}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>Last name</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("familyName", event.target.value)
                  }
                  required
                  type="text"
                  value={profileDraft.familyName}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Display name
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("displayName", event.target.value)
                  }
                  placeholder="Optional, if different"
                  type="text"
                  value={profileDraft.displayName}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>Time zone</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                <select
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("timezone", event.target.value)
                  }
                  required
                  value={profileDraft.timezone}
                >
                  <option value="">Select time zone</option>
                  {!timeZoneOptions.some(
                    (option) => option.value === profileDraft.timezone
                  ) && profileDraft.timezone ? (
                    <option value={profileDraft.timezone}>
                      {profileDraft.timezone}
                    </option>
                  ) : null}
                  {timeZoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} · {option.value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Address line 1
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("addressLine1", event.target.value)
                  }
                  placeholder="Optional"
                  value={profileDraft.addressLine1}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                Address line 2
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("addressLine2", event.target.value)
                  }
                  placeholder="Optional"
                  value={profileDraft.addressLine2}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                City
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("city", event.target.value)
                  }
                  value={profileDraft.city}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                State / region
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("region", event.target.value)
                  }
                  value={profileDraft.region}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>ZIP code</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  inputMode="numeric"
                  onChange={(event) =>
                    updateProfileDraft("postalCode", event.target.value)
                  }
                  placeholder="12345 or 12345-6789"
                  required
                  value={profileDraft.postalCode}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Country
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("country", event.target.value)
                  }
                  value={profileDraft.country}
                />
              </label>
              <div className="md:col-span-2">
                <button
                  className={gentlePrimaryButtonClass}
                  disabled={savingProfile}
                  type="submit"
                >
                  {savingProfile ? "Saving..." : "Save profile"}
                </button>
              </div>
              </div>
            </form>

            {message ? (
              <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            ) : null}
          </div>
        ) : (
        <div className="mt-8 space-y-4">
          <aside
            className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${
              signedInEmail ? "hidden" : "mx-auto max-w-xl"
            }`}
          >
            {!signedInEmail && message ? (
              <p className="mb-5 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            ) : null}

            {signedInEmail ? (
              <div>
                <h2 className="text-xl font-semibold">Signed in</h2>
                <p className="mt-2 break-words text-slate-600">{signedInEmail}</p>
              </div>
            ) : (
              <form
                onSubmit={
                  authMode === "signUp"
                    ? handleSignUp
                    : authMode === "reset"
                      ? handlePasswordReset
                      : handleSignIn
                }
              >
                <h2 className="text-xl font-semibold text-slate-950">
                  {authMode === "signUp"
                    ? "Create your account"
                    : authMode === "reset"
                      ? "Reset password"
                      : "Welcome back"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {authMode === "signUp"
                    ? "Create an account with email, or continue directly with Google."
                    : authMode === "reset"
                      ? "Enter your email and CarePland will send a reset link."
                      : "Choose how you'd like to continue"}
                </p>
                {authMode !== "reset" ? (
                  <>
                    <button
                      className={`${gentleSecondaryButtonClass} mt-5 flex w-full items-center justify-center gap-3`}
                      disabled={loading}
                      onClick={handleGoogleSignIn}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-sm font-bold text-blue-700"
                      >
                        G
                      </span>
                      Continue with Google
                    </button>
                    <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      <span className="h-px flex-1 bg-slate-200" />
                      <span>Or use email</span>
                      <span className="h-px flex-1 bg-slate-200" />
                    </div>
                    <div
                      aria-label="Email account action"
                      className="grid grid-cols-2 rounded-full border border-blue-100 bg-blue-50/70 p-1 text-sm font-semibold"
                      role="group"
                    >
                      <button
                        aria-pressed={authMode === "signIn"}
                        className={`rounded-full px-3 py-2 transition ${
                          authMode === "signIn"
                            ? "bg-white text-blue-800 shadow-sm"
                            : "text-slate-500 hover:text-blue-800"
                        }`}
                        onClick={() => {
                          setAuthMode("signIn");
                          setMessage("");
                        }}
                        type="button"
                      >
                        Sign in
                      </button>
                      <button
                        aria-pressed={authMode === "signUp"}
                        className={`rounded-full px-3 py-2 transition ${
                          authMode === "signUp"
                            ? "bg-white text-blue-800 shadow-sm"
                            : "text-slate-500 hover:text-blue-800"
                        }`}
                        onClick={() => {
                          setAuthMode("signUp");
                          setMessage("");
                        }}
                        type="button"
                      >
                        Create account
                      </button>
                    </div>
                  </>
                ) : null}
                <label className="mt-5 block text-sm font-medium text-slate-700">
                  Email
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </label>

                {authMode !== "reset" ? (
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Password
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                      minLength={8}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setMessage("");
                      }}
                      required
                      type="password"
                      value={password}
                    />
                  </label>
                ) : null}

                {authMode === "signUp" ? (
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Confirm password
                    <input
                      aria-invalid={passwordsMismatch}
                      className={`mt-2 w-full rounded-md border px-3 py-2 text-base ${
                        passwordsMismatch
                          ? "border-red-500"
                          : "border-slate-300"
                      }`}
                      minLength={8}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setMessage("");
                      }}
                      required
                      type="password"
                      value={confirmPassword}
                    />
                    {passwordsMismatch ? (
                      <span className="mt-2 block text-sm font-semibold text-red-700">
                        Passwords do not match.
                      </span>
                    ) : null}
                  </label>
                ) : null}

                <button
                  className={`${gentlePrimaryButtonClass} mt-5 w-full`}
                  disabled={!canSubmitAuth}
                  type="submit"
                >
                  {loading
                    ? "Working..."
                    : authMode === "signUp"
                      ? "Create account"
                      : authMode === "reset"
                        ? "Send reset email"
                        : "Sign in"}
                </button>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                  {authMode === "reset" ? (
                    <button
                      className="font-semibold text-blue-700"
                      onClick={() => {
                        setAuthMode("signIn");
                        setMessage("");
                      }}
                      type="button"
                    >
                      Back to sign in
                    </button>
                  ) : (
                    <button
                      className="font-semibold text-blue-700"
                      onClick={() => {
                        setAuthMode("reset");
                        setMessage("");
                      }}
                      type="button"
                    >
                      Forgot your password?
                    </button>
                  )}
                </div>
              </form>
            )}

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
                        {subject.display_name}
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
                            {subject.display_name}
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
                          {subject.display_name}
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
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                {activeAppointmentPanel === "add" ? (
                  <form
                    className="mt-4 grid gap-4 rounded-md border border-blue-100 bg-blue-50 p-4 md:grid-cols-2"
                    onSubmit={handleCreateAppointment}
                  >
                    {canUseMultipleCareVips ? (
                      <label className="block text-sm font-medium text-slate-700">
                        For this appointment
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
                              {subject.display_name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {renderPlaceLookup("md:col-span-2")}
                    <label className="block text-sm font-medium text-slate-700">
                      Title
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
                    <label className="block text-sm font-medium text-slate-700">
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
                    <label className="block text-sm font-medium text-slate-700">
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
                    <label className="block text-sm font-medium text-slate-700">
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
                    <label className="block text-sm font-medium text-slate-700">
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
                    <label className="block text-sm font-medium text-slate-700 md:col-span-2">
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
                        disabled={creatingAppointment}
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
                  <section className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4">
                    <form onSubmit={handleInterpretTextIntake}>
                      {canUseMultipleCareVips ? (
                        <label className="block text-sm font-medium text-slate-700">
                          For this import
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
                                {subject.display_name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
                        <label
                          className="block text-sm font-medium text-slate-700"
                          htmlFor="appointment-import-files"
                        >
                          Choose files
                        </label>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-700">
                          <label
                            className={`rounded-full border border-blue-100 bg-white/85 px-3 py-2 font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 ${
                              extractingImageText
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer"
                            }`}
                            htmlFor="appointment-import-files"
                          >
                            Choose Files
                          </label>
                          <input
                            accept=".ics,text/calendar,image/gif,image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={extractingImageText}
                            id="appointment-import-files"
                            multiple
                            onChange={(event) => {
                              void handleImportAppointmentFiles(event.target.files);
                              event.target.value = "";
                            }}
                            type="file"
                          />
                          <span>No file chosen</span>
                          {fileImportStatus ? (
                            <span className="font-semibold text-amber-700">
                              {fileImportStatus}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Choose one .iCal calendar file or up to 10 images.
                          Imported items must be reviewed before saving.
                        </p>
                      </div>
                      <label className="mt-3 block text-sm font-medium text-slate-700">
                        Text
                        <textarea
                          className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                          onChange={(event) =>
                            setTextIntakeValue(event.target.value)
                          }
                          placeholder="Paste appointment details, portal text, or visit notes."
                          value={textIntakeValue}
                        />
                      </label>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          className={gentlePrimaryButtonClass}
                          disabled={processingTextIntake}
                          type="submit"
                        >
                          {processingTextIntake
                            ? "Interpreting..."
                            : "Review appointments"}
                        </button>
                        <button
                          className={gentleSecondaryButtonClass}
                          onClick={() => {
                            cancelTextIntake();
                            setActiveAppointmentPanel(null);
                          }}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>

                    {textIntakeDraft && !textIntakeTargetAppointmentId ? (
                      <form
                        className="mt-5 grid gap-4 rounded-md border border-blue-100 bg-blue-50 p-4 md:grid-cols-2"
                        onSubmit={handleSaveTextIntakeDraft}
                      >
                        <div className="md:col-span-2">
                          <h3 className="font-semibold text-blue-950">
                            Review intake draft
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <AIReviewBadge
                              confidence={textIntakeDraft.confidence}
                            />
                            {textIntakeDraft.suggestedAction ? (
                              <p className="text-xs text-blue-800">
                                {textIntakeDraft.suggestedAction}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <label className="block text-sm font-medium text-slate-700">
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
                        <label className="block text-sm font-medium text-slate-700">
                          Date & time
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                            onChange={(event) =>
                              updateTextIntakeDraft(
                                "startsAt",
                                event.target.value
                              )
                            }
                            type="datetime-local"
                            value={textIntakeDraft.startsAt}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          Provider
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                            onChange={(event) =>
                              updateTextIntakeDraft(
                                "providerName",
                                event.target.value
                              )
                            }
                            value={textIntakeDraft.providerName}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
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
                        <label className="block text-sm font-medium text-slate-700 md:col-span-2">
                          Notes summary
                          <textarea
                            className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                            className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                            className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                            onChange={(event) =>
                              updateTextIntakeDraft(
                                "followups",
                                event.target.value
                              )
                            }
                            value={textIntakeDraft.followups}
                          />
                        </label>
                        <div className="flex flex-wrap gap-3 md:col-span-2">
                          <button
                            className={gentlePrimaryButtonClass}
                            disabled={savingTextIntake}
                            type="submit"
                          >
                            {savingTextIntake ? "Saving..." : "Save intake"}
                          </button>
                          <button
                            className={gentleSecondaryButtonClass}
                            onClick={cancelTextIntake}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}

                    {bulkAppointmentDrafts.length > 0 ? (
                      <form
                        className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4"
                        onSubmit={handleSaveBulkAppointments}
                      >
                        <div>
                          <h3 className="font-semibold text-blue-950">
                            Review appointment drafts
                          </h3>
                          <p className="mt-1 text-sm text-blue-800">
                            {bulkAppointmentSummary ||
                              `Found ${bulkAppointmentDrafts.length} appointment draft(s).`}
                          </p>
                          <p className="mt-1 text-xs text-blue-700">
                            Up to 10 appointments can be imported at once.
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-100 bg-white p-3">
                          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <input
                              checked={allBulkAppointmentsSelected}
                              onChange={(event) =>
                                toggleAllBulkAppointmentDrafts(
                                  event.target.checked
                                )
                              }
                              type="checkbox"
                            />
                            Select all
                          </label>
                          <p className="text-sm text-slate-500">
                            {selectedBulkAppointmentCount} selected
                          </p>
                        </div>

                        <div className="mt-4 space-y-4">
                          {bulkAppointmentDrafts.map((draft, index) => (
                            <article
                              className="rounded-md border border-blue-100 bg-white p-4"
                              key={draft.importId}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <label className="flex items-center gap-2 font-semibold text-slate-900">
                                  <input
                                    checked={draft.isSelected}
                                    onChange={(event) =>
                                      toggleBulkAppointmentDraft(
                                        draft.importId,
                                        event.target.checked
                                      )
                                    }
                                    type="checkbox"
                                  />
                                  Appointment {index + 1}
                                </label>
                                <AIReviewBadge confidence={draft.confidence} />
                              </div>
                              {draft.suggestedAction ? (
                                <p className="mt-2 text-xs text-blue-800">
                                  {draft.suggestedAction}
                                </p>
                              ) : null}
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <label className="block text-sm font-medium text-slate-700">
                                  Title
                                  <input
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                                    onChange={(event) =>
                                      updateBulkAppointmentDraft(
                                        draft.importId,
                                        "appointmentTitle",
                                        event.target.value
                                      )
                                    }
                                    value={draft.appointmentTitle}
                                  />
                                </label>
                                <label className="block text-sm font-medium text-slate-700">
                                  Date & time
                                  <input
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                                    onChange={(event) =>
                                      updateBulkAppointmentDraft(
                                        draft.importId,
                                        "startsAt",
                                        event.target.value
                                      )
                                    }
                                    type="datetime-local"
                                    value={draft.startsAt}
                                  />
                                </label>
                                <label className="block text-sm font-medium text-slate-700">
                                  Provider
                                  <input
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                                    onChange={(event) =>
                                      updateBulkAppointmentDraft(
                                        draft.importId,
                                        "providerName",
                                        event.target.value
                                      )
                                    }
                                    value={draft.providerName}
                                  />
                                </label>
                                <label className="block text-sm font-medium text-slate-700">
                                  Practice
                                  <input
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                                    onChange={(event) =>
                                      updateBulkAppointmentDraft(
                                        draft.importId,
                                        "providerOrganization",
                                        event.target.value
                                      )
                                    }
                                    value={draft.providerOrganization}
                                  />
                                </label>
                                <label className="block text-sm font-medium text-slate-700">
                                  Location
                                  <input
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                                    onChange={(event) =>
                                      updateBulkAppointmentDraft(
                                        draft.importId,
                                        "locationName",
                                        event.target.value
                                      )
                                    }
                                    value={draft.locationName}
                                  />
                                </label>
                                <label className="block text-sm font-medium text-slate-700">
                                  Address
                                  <input
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                                    onChange={(event) =>
                                      updateBulkAppointmentDraft(
                                        draft.importId,
                                        "locationAddress",
                                        event.target.value
                                      )
                                    }
                                    value={draft.locationAddress}
                                  />
                                </label>
                                <label className="block text-sm font-medium text-slate-700">
                                  Phone
                                  <input
                                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                                    onChange={(event) =>
                                      updateBulkAppointmentDraft(
                                        draft.importId,
                                        "locationPhone",
                                        event.target.value
                                      )
                                    }
                                    value={draft.locationPhone}
                                  />
                                </label>
                                <label className="block text-sm font-medium text-slate-700">
                                  Reason
                                  <textarea
                                    className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                                    onChange={(event) =>
                                      updateBulkAppointmentDraft(
                                        draft.importId,
                                        "appointmentReason",
                                        event.target.value
                                      )
                                    }
                                    value={draft.appointmentReason}
                                  />
                                </label>
                              </div>
                            </article>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-100 bg-white p-3">
                          <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                            <input
                              checked={allBulkAppointmentsSelected}
                              onChange={(event) =>
                                toggleAllBulkAppointmentDrafts(
                                  event.target.checked
                                )
                              }
                              type="checkbox"
                            />
                            Select all
                          </label>
                          <p className="text-sm text-slate-500">
                            {selectedBulkAppointmentCount} selected
                          </p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            className={gentlePrimaryButtonClass}
                            disabled={savingTextIntake}
                            type="submit"
                          >
                            {savingTextIntake
                              ? "Saving..."
                              : "Save selected appointments"}
                          </button>
                          <button
                            className={gentleSecondaryButtonClass}
                            onClick={cancelTextIntake}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}
                  </section>
                ) : null}
              </section>
            ) : null}

            {mainTab === "admin" && isAdmin ? (
              <>
              <section
                className="sticky z-40 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                style={{ top: stickySecondaryOffset }}
              >
                <div className="flex flex-wrap gap-2">
                  {topAdminNavItems.map((item) => (
                    <AdminNavButton
                      followupCount={item.followupCount ?? 0}
                      isSelected={activeAdminTopTab === item.key}
                      key={item.key}
                      newCount={item.newCount ?? 0}
                      onClick={() => handleChangeAdminTab(adminTabForTopTab(item.key))}
                    >
                      {item.label}
                    </AdminNavButton>
                  ))}
                </div>
              </section>

              {systemAdminTabs.includes(adminTab) ? (
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <AdminNavGroup
                    activeKey={adminTab}
                    className="mb-0 border-b-0 pb-0"
                    items={systemAdminNavItems}
                    onSelect={(tab) => handleChangeAdminTab(tab)}
                  />
                </section>
              ) : null}

              {supportAdminTabs.includes(adminTab) ? (
                <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <AdminNavGroup
                    activeKey={adminTab}
                    className="mb-0 border-b-0 pb-0"
                    items={supportAdminNavItems}
                    onSelect={(tab) => handleChangeAdminTab(tab)}
                  />
                </section>
              ) : null}

              {adminTab === "dashboard" ? (
                <AdminDashboardPanel
                  aiOperationCostError={aiOperationCostError}
                  aiOperationCostRows={aiOperationCostSummary}
                  followupCount={adminDashboardFollowupCount}
                  loadingAiOperationCosts={loadingAiOperationCosts}
                  newCount={adminDashboardNewCount}
                  onOpenPrioritizationPrompt={() => {
                    setSelectedAiWorkflow("admin_hq_prioritization");
                    void handleChangeAdminTab("ai");
                  }}
                  onRefreshSignals={loadAdminAttentionOverview}
                />
              ) : null}

              {adminTab === "tools" ? (
              <div className="space-y-4">
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold">Admin tools</h2>
                      <p className="mt-1 text-slate-600">
                        Add sample data for Early Access users, update account emails,
                        and review account setup state.
                      </p>
                    </div>
                  </div>

                  <form
                    className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]"
                    onSubmit={handleAdminUpdateUserEmail}
                  >
                    <label className="block text-sm font-medium text-slate-700">
                      Current email
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) => {
                          setAdminEmailUpdateCurrentEmail(event.target.value);
                          setAdminEmailUpdateResult("");
                        }}
                        placeholder="alias@example.com"
                        type="email"
                        value={adminEmailUpdateCurrentEmail}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Replacement email
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) => {
                          setAdminEmailUpdateNewEmail(event.target.value);
                          setAdminEmailUpdateResult("");
                        }}
                        placeholder="user@example.com"
                        type="email"
                        value={adminEmailUpdateNewEmail}
                      />
                    </label>
                    <button
                      className="self-end rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                      disabled={updatingAdminUserEmail}
                      type="submit"
                    >
                      {updatingAdminUserEmail ? "Updating..." : "Update email"}
                    </button>
                    <label className="block text-sm font-medium text-slate-700 lg:col-span-3">
                      Update justification
                      <textarea
                        className="mt-2 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) => {
                          setAdminEmailUpdateReason(event.target.value);
                          setAdminEmailUpdateResult("");
                        }}
                        placeholder="Required before changing a login email."
                        value={adminEmailUpdateReason}
                      />
                    </label>
                  </form>

                  {adminEmailUpdateResult ? (
                    <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                      {adminEmailUpdateResult}
                    </div>
                  ) : null}
                </section>

                <AdminSessionSettingsPanel
                  onChange={setAppSessionSettings}
                  onSave={handleSaveAppSessionSettings}
                  saving={savingAppSessionSettings}
                  settings={appSessionSettings}
                />

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Sample data
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Check whether an Early Access user can receive demo examples.
                  </p>

                  <form
                    className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]"
                    onSubmit={handleLoadAdminSampleStatus}
                  >
                    <label className="block text-sm font-medium text-slate-700">
                      User email
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) => {
                          setAdminSampleEmail(event.target.value);
                          setAdminSampleStatus(null);
                          setAdminSampleForceDeclined(false);
                        }}
                        placeholder="tester@example.com"
                        type="email"
                        value={adminSampleEmail}
                      />
                    </label>
                    <button
                      className="self-end rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:text-slate-400"
                      disabled={loadingAdminSampleStatus}
                      type="submit"
                    >
                      {loadingAdminSampleStatus ? "Checking..." : "Check status"}
                    </button>
                  </form>

                  <div className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                    {sampleDataStatusText(adminSampleStatus)}
                  </div>

                  {adminSampleStatus?.status === "declined" ? (
                    <label className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <input
                        checked={adminSampleForceDeclined}
                        className="mt-1"
                        onChange={(event) =>
                          setAdminSampleForceDeclined(event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>
                        This user previously declined sample data. Add it anyway.
                      </span>
                    </label>
                  ) : null}

                  <button
                    className="mt-4 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                    disabled={
                      seedingAdminSampleData ||
                      !adminSampleStatus ||
                      adminSampleStatus.status === "already_seeded" ||
                      adminSampleStatus.status === "no_profile" ||
                      adminSampleStatus.status === "missing_care_circle" ||
                      (adminSampleStatus.status === "declined" &&
                        !adminSampleForceDeclined)
                    }
                    onClick={handleSeedAdminSampleData}
                    type="button"
                  >
                    {seedingAdminSampleData ? "Adding..." : "Add sample data"}
                  </button>
                </section>
              </div>
              ) : null}

              {adminTab === "users" ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <AdminNavGroup
                  activeKey={adminTab}
                  items={usersAdminNavItems}
                  onSelect={(tab) => handleChangeAdminTab(tab)}
                />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">Users / activity</h2>
                    <p className="mt-1 text-slate-600">
                      Review account presence, product usage, and follow-up
                      signals for beta operations.
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:text-slate-400"
                    disabled={loadingAdminUserActivity}
                    onClick={() => loadAdminUserActivity()}
                    type="button"
                  >
                    {loadingAdminUserActivity ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {adminReadonlySnapshot ? (
                  <AdminReadonlyUserPanel
                    formatAdminDate={formatAdminDate}
                    formatDate={formatDate}
                    formatDateOnly={formatDateOnly}
                    onClose={closeAdminReadonlyUserView}
                    onReveal={revealAdminSensitiveData}
                    onSaveContactDetails={saveAdminContactDetails}
                    panelRef={adminReadonlyPanelRef}
                    revealedData={adminRevealedSensitiveData}
                    revealingKey={revealingAdminSensitiveKey}
                    savingContactDetails={savingAdminContactDetails}
                    shortId={shortId}
                    snapshot={adminReadonlySnapshot}
                  />
                ) : null}

                <AdminUserActivityPanel
                  activeReadonlyUserId={adminReadonlySnapshot?.profile.id ?? null}
                  expandedCareVipRows={expandedAdminUserCareVipRows}
                  filter={adminUserActivityFilter}
                  filteredRows={filteredAdminUserActivity}
                  formatAdminDate={formatAdminDate}
                  loadingReadonlyUserId={loadingAdminReadonlyUserId}
                  onChangeFilter={setAdminUserActivityFilter}
                  onOpenReadonlyUserView={openAdminReadonlyUserView}
                  onToggleCareVips={(userId) =>
                    setExpandedAdminUserCareVipRows((currentRows) => ({
                      ...currentRows,
                      [userId]: !currentRows[userId],
                    }))
                  }
                  onToggleSort={toggleAdminUserActivitySort}
                  rows={adminUserActivity}
                  sort={adminUserActivitySort}
                  stats={adminUserActivityStats}
                />
              </section>
              ) : null}

              {adminTab === "userAudit" ? (
                <AdminAuditTrailPanel
                  activeKey={adminTab}
                  formatAdminDate={formatAdminDate}
                  loading={loadingAdminAccessEvents}
                  navItems={usersAdminNavItems}
                  onRefresh={loadAdminAccessEvents}
                  onSelectTab={handleChangeAdminTab}
                  rows={adminAccessEvents}
                  shortId={shortId}
                  userRows={adminUserActivity}
                />
              ) : null}

              {adminTab === "intake" ? (
                <AdminEarlyAccessIntakePanel
                  activeKey={adminTab}
                  adminNotes={earlyAccessIntakeAdminNotes}
                  draft={earlyAccessIntakeDraft}
                  filter={earlyAccessIntakeFilter}
                  filteredRows={filteredEarlyAccessIntakeRows}
                  formatAdminDate={formatAdminDate}
                  loading={loadingEarlyAccessIntake}
                  navItems={usersAdminNavItems}
                  onCreate={handleCreateEarlyAccessIntake}
                  onRefresh={loadEarlyAccessIntake}
                  onSelectTab={handleChangeAdminTab}
                  onUpdateDraft={updateEarlyAccessIntakeDraft}
                  onUpdateRow={handleUpdateEarlyAccessIntake}
                  rows={earlyAccessIntakeRows}
                  saving={savingEarlyAccessIntake}
                  setAdminNotes={setEarlyAccessIntakeAdminNotes}
                  setFilter={setEarlyAccessIntakeFilter}
                  stats={earlyAccessIntakeStats}
                  updatingId={updatingEarlyAccessIntakeId}
                />
              ) : null}

              {adminTab === "errors" ? (
                <AdminIntegrationErrorsPanel
                  allSelected={allAdminIntegrationErrorsSelected}
                  deleting={deletingAdminIntegrationErrors}
                  formatAdminDate={formatAdminDate}
                  lastViewedAt={adminLastViewedAt("admin_tab", "errors")}
                  loading={loadingAdminIntegrationErrors}
                  onDeleteSelected={deleteSelectedAdminIntegrationErrors}
                  onRefresh={loadAdminIntegrationErrors}
                  onToggleAll={toggleAllAdminIntegrationErrors}
                  onToggleRow={toggleAdminIntegrationErrorSelection}
                  rowKey={adminIntegrationErrorRowKey}
                  rows={adminIntegrationErrors}
                  selectedKeys={selectedAdminIntegrationErrorKeys}
                  selectedVisibleCount={selectedVisibleAdminIntegrationErrorKeys.length}
                  stats={adminIntegrationErrorStats}
                />
              ) : null}

              {adminTab === "tickets" ? (
                <AdminSupportTicketsPanel
                  adminTicketCategory={adminTicketCategory}
                  adminTicketChangeNote={adminTicketChangeNote}
                  adminTicketInternalNote={adminTicketInternalNote}
                  adminTicketNeedsFollowup={adminTicketNeedsFollowup}
                  adminTicketPriority={adminTicketPriority}
                  adminTicketReplyBody={adminTicketReplyBody}
                  adminTicketStatus={adminTicketStatus}
                  formatDate={formatDate}
                  lastViewedAt={adminLastViewedAt("admin_tab", "tickets")}
                  loading={loadingAdminTickets}
                  messages={selectedAdminTicketMessages}
                  onAddInternalNote={handleAddAdminInternalNote}
                  onAddReply={handleAddAdminTicketReply}
                  onOpenAskSubmission={openAskSubmissionReview}
                  onRefresh={loadAdminSupportTickets}
                  onSelectTicket={selectAdminTicket}
                  onSetCategory={setAdminTicketCategory}
                  onSetChangeNote={setAdminTicketChangeNote}
                  onSetInternalNote={setAdminTicketInternalNote}
                  onSetNeedsFollowup={setAdminTicketNeedsFollowup}
                  onSetPriority={setAdminTicketPriority}
                  onSetReplyBody={setAdminTicketReplyBody}
                  onSetStatus={setAdminTicketStatus}
                  onUpdateStatus={handleUpdateAdminTicketStatus}
                  savingReply={savingAdminTicketReply}
                  savingStatus={savingAdminTicketStatus}
                  selectedTicket={selectedAdminTicket}
                  tickets={adminSupportTickets}
                />
              ) : null}

              {adminTab === "assistantReview" ? (
              <div className="space-y-4">
              <AdminAskIntakePanel
                decisions={askRecommendationDecisions}
                decisionSummaryRows={askRecommendationDecisionSummary}
                formatDate={formatDate}
                links={askSubmissionLinks}
                loadingSettings={loadingAskRoutingSettings}
                loading={loadingAskReviews}
                moduleLabInput={askModuleLabInput}
                moduleLabKey={askModuleLabKey}
                moduleLabResults={askModuleLabResults}
                moduleLabRunning={runningAskModuleLab}
                onCreateProductItem={createProductItemFromAskRecommendation}
                onCreateSupportTicket={createSupportTicketFromAskRecommendation}
                onOpenRelatedItem={openAskRelatedItem}
                onRecordDecision={recordAskRecommendationDecision}
                onRefresh={loadAskReviewSubmissions}
                onResolveAnswer={resolveAskAnswerRecommendation}
                onRunModuleLab={handleRunAskModuleLab}
                onSelectSubmission={selectAskReviewSubmission}
                onSetModuleLabInput={setAskModuleLabInput}
                onSetModuleLabKey={setAskModuleLabKey}
                onSetReviewNote={setAskReviewNote}
                onSetSettingsDraft={setAskRoutingSettingsDraft}
                onSetRoutingState={setAskReviewRoutingState}
                onUpdateSettings={handleUpdateAskRoutingSettings}
                onUpdateReview={handleUpdateAskReview}
                reviewNote={askReviewNote}
                routingState={askReviewRoutingState}
                savingAction={savingAskReviewAction}
                savingSettings={savingAskRoutingSettings}
                savingReview={savingAskReview}
                selectedSubmission={selectedAskReviewSubmission}
                settingsDraft={askRoutingSettingsDraft}
                submissions={askReviewSubmissions}
              />
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">Support assistant answer review</h2>
                    <p className="mt-1 text-slate-600">
                      Older support-assistant answers remain here while Ask becomes the primary review stream.
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                    disabled={loadingAssistantReviews}
                    onClick={() => loadAssistantReviewInteractions()}
                    type="button"
                  >
                    {loadingAssistantReviews ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-4">
                  <label className="block text-sm font-medium text-slate-700">
                    Outcome
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      onChange={(event) =>
                        setAssistantReviewOutcomeFilter(
                          event.target.value as "all" | SupportAssistantOutcome
                        )
                      }
                      value={assistantReviewOutcomeFilter}
                    >
                      <option value="all">All outcomes</option>
                      <option value="answered">Answered only</option>
                      <option value="helpful">Helpful</option>
                      <option value="not_helpful">Not helpful</option>
                      <option value="escalated">Escalated</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Confidence
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      onChange={(event) =>
                        setAssistantReviewConfidenceFilter(
                          event.target.value as typeof assistantReviewConfidenceFilter
                        )
                      }
                      value={assistantReviewConfidenceFilter}
                    >
                      <option value="all">All confidence levels</option>
                      <option value="high">High confidence</option>
                      <option value="medium">Medium confidence</option>
                      <option value="low">Low confidence</option>
                      <option value="needs_review">Needs review</option>
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Prompt version
                    <select
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      onChange={(event) =>
                        setAssistantReviewPromptFilter(event.target.value)
                      }
                      value={assistantReviewPromptFilter}
                    >
                      <option value="all">All prompt versions</option>
                      {assistantReviewPromptVersions.map((promptVersion) => (
                        <option key={promptVersion} value={promptVersion}>
                          {promptVersion}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 lg:self-end">
                    <input
                      checked={assistantReviewHasFeedbackOnly}
                      onChange={(event) =>
                        setAssistantReviewHasFeedbackOnly(event.target.checked)
                      }
                      type="checkbox"
                    />
                    Has user feedback
                  </label>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
                  <aside className="space-y-2">
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-sm font-semibold text-slate-700">
                        Showing {filteredAssistantReviewInteractions.length} of {assistantReviewInteractions.length}
                      </p>
                      <button
                        className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                        disabled={
                          analyzingAssistantReviews ||
                          filteredAssistantReviewInteractions.length === 0
                        }
                        onClick={handleAnalyzeFilteredAssistantReviews}
                        type="button"
                      >
                        {analyzingAssistantReviews
                          ? "Analyzing..."
                          : `Analyze filtered${
                              filteredAssistantReviewInteractions.length > 50
                                ? " first 50"
                                : ""
                            }`}
                      </button>
                    </div>
                    {assistantAnalysisResult ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                        <p className="font-semibold">Latest analysis</p>
                        <p className="mt-2 whitespace-pre-wrap">
                          {assistantAnalysisResult.analysisSummary}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-wide">
                          Saved run {assistantAnalysisResult.id}
                        </p>
                      </div>
                    ) : null}
                    {assistantAnalysisRuns.length > 0 ? (
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <p className="text-sm font-semibold text-slate-900">
                          Analysis history
                        </p>
                        <div className="mt-3 space-y-2">
                          {assistantAnalysisRuns.slice(0, 5).map((run) => {
                            const selected =
                              selectedAssistantAnalysisRun?.id === run.id;

                            return (
                              <button
                                className={`w-full rounded-md border p-3 text-left text-sm transition ${
                                  selected
                                    ? "border-sky-300 bg-sky-50"
                                    : "border-slate-200 bg-white hover:border-sky-200"
                                }`}
                                key={run.id}
                                onClick={() => selectAssistantAnalysisRun(run)}
                                type="button"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {run.interaction_count} answer
                                    {run.interaction_count === 1 ? "" : "s"}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                    {supportAnalysisStatusLabel(run.admin_status)}
                                  </span>
                                </div>
                                <p className="mt-2 line-clamp-2 text-slate-600">
                                  {run.analysis_summary}
                                </p>
                                <p className="mt-2 text-xs text-slate-500">
                                  {formatDate(run.created_at)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {filteredAssistantReviewInteractions.length === 0 ? (
                      <div className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
                        No assistant answers match these filters.
                      </div>
                    ) : (
                      filteredAssistantReviewInteractions.map((interaction) => {
                        const selected =
                          selectedAssistantReviewInteraction?.id === interaction.id;
                        const hasAdminReview = assistantReviewAdminReviews.some(
                          (review) => review.interaction_id === interaction.id
                        );
                        const isNewToAdmin = isNewForAdmin(
                          interaction.updated_at || interaction.created_at,
                          adminLastViewedAt("admin_tab", "assistantReview")
                        );

                        return (
                          <button
                            className={`w-full rounded-md border p-3 text-left transition ${
                              selected
                                ? isNewToAdmin
                                  ? "border-red-300 bg-red-50"
                                  : !hasAdminReview
                                    ? "border-amber-300 bg-amber-50"
                                    : "border-sky-300 bg-sky-50"
                                : isNewToAdmin
                                  ? "border-red-200 bg-red-50/70"
                                  : !hasAdminReview
                                    ? "border-amber-200 bg-amber-50/70"
                                    : "border-slate-200 bg-white hover:border-sky-200"
                            }`}
                            key={interaction.id}
                            onClick={() => setSelectedAssistantReviewId(interaction.id)}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-slate-900">
                                {interaction.question_subject}
                              </span>
                              {hasAdminReview ? (
                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                  Reviewed
                                </span>
                              ) : null}
                              {isNewToAdmin ? (
                                <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                  New to me
                                </span>
                              ) : null}
                              {!isNewToAdmin && !hasAdminReview ? (
                                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                                  Follow up
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {assistantInteractionUserLabel(interaction)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <AIReviewBadge confidence={Number(interaction.confidence)} />
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                {interaction.outcome.replace("_", " ")}
                              </span>
                              {interaction.ticket_id ? (
                                <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                  Ticket linked
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {formatDate(interaction.created_at)}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </aside>

                  {selectedAssistantReviewInteraction ? (
                    <div className="rounded-md border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">
                            {selectedAssistantReviewInteraction.question_subject}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {assistantInteractionUserLabel(selectedAssistantReviewInteraction)} · {selectedAssistantReviewInteraction.category}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatDate(selectedAssistantReviewInteraction.created_at)} · {selectedAssistantReviewInteraction.prompt_version ?? "Unknown prompt"}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <AIReviewBadge confidence={Number(selectedAssistantReviewInteraction.confidence)} />
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                            {selectedAssistantReviewInteraction.outcome.replace("_", " ")}
                          </span>
                          {selectedAssistantReviewInteraction.ticket_id ? (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                              Ticket linked
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 xl:grid-cols-2">
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                          <h4 className="font-semibold text-slate-900">Question</h4>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                            {selectedAssistantReviewInteraction.question_body}
                          </p>
                        </div>
                        <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
                          <h4 className="font-semibold text-slate-900">Assistant answer</h4>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                            {selectedAssistantReviewInteraction.assistant_answer}
                          </p>
                          {selectedAssistantReviewInteraction.suggested_next_step ? (
                            <p className="mt-3 text-sm font-semibold text-slate-900">
                              {selectedAssistantReviewInteraction.suggested_next_step}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 xl:grid-cols-3">
                        <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">User feedback</p>
                          <p className="mt-2 whitespace-pre-wrap">
                            {selectedAssistantReviewInteraction.user_feedback || "No user comment saved."}
                          </p>
                        </div>
                        <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Escalation</p>
                          <p className="mt-2">
                            {selectedAssistantReviewInteraction.escalation_recommended
                              ? "Assistant recommended review."
                              : "No review recommended by assistant."}
                          </p>
                          {selectedAssistantReviewInteraction.escalation_reason ? (
                            <p className="mt-2 whitespace-pre-wrap">
                              {selectedAssistantReviewInteraction.escalation_reason}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Run metadata</p>
                          <p className="mt-2">Model: {selectedAssistantReviewInteraction.model ?? "Unknown"}</p>
                          <p>Page: {selectedAssistantReviewInteraction.current_page ?? "Unknown"}</p>
                          <p>Priority: {selectedAssistantReviewInteraction.priority}</p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-md border border-slate-200 p-3">
                        <h4 className="font-semibold text-slate-900">Admin review history</h4>
                        {selectedAssistantAdminReviews.length === 0 ? (
                          <p className="mt-2 text-sm text-slate-600">
                            No admin review notes yet.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {selectedAssistantAdminReviews.map((review) => (
                              <div
                                className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                                key={review.id}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {review.review_status.replaceAll("_", " ")}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {formatDate(review.created_at)}
                                  </span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap">
                                  {review.admin_note || "No note entered."}
                                </p>
                                {review.recommended_action ? (
                                  <p className="mt-2 whitespace-pre-wrap font-semibold text-slate-900">
                                    {review.recommended_action}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {assistantAnalysisResult ? (
                        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                          <h4 className="font-semibold">Latest filtered analysis</h4>
                          <p className="mt-2 whitespace-pre-wrap">
                            {assistantAnalysisResult.analysisSummary}
                          </p>
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <div>
                              <p className="font-semibold">Patterns</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {assistantAnalysisResult.failurePatterns.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold">Strengths</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {assistantAnalysisResult.strengths.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold">Prompt ideas</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {assistantAnalysisResult.promptRecommendations.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-semibold">UI/workflow ideas</p>
                              <ul className="mt-1 list-disc space-y-1 pl-5">
                                {assistantAnalysisResult.uiRecommendations.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {selectedAssistantAnalysisRun ? (
                        <div className="mt-4 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="font-semibold text-slate-900">
                                Saved analysis run
                              </h4>
                              <p className="mt-1 text-slate-500">
                                {formatDate(selectedAssistantAnalysisRun.created_at)} ·{" "}
                                {selectedAssistantAnalysisRun.interaction_count} answer
                                {selectedAssistantAnalysisRun.interaction_count === 1
                                  ? ""
                                  : "s"}{" "}
                                reviewed
                              </p>
                              {selectedAssistantAnalysisRun.prompt_versions.length > 0 ? (
                                <p className="mt-1 text-slate-500">
                                  Prompt versions:{" "}
                                  {selectedAssistantAnalysisRun.prompt_versions.join(", ")}
                                </p>
                              ) : null}
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                              {supportAnalysisStatusLabel(
                                selectedAssistantAnalysisRun.admin_status
                              )}
                            </span>
                          </div>
                          <p className="mt-3 whitespace-pre-wrap">
                            {selectedAssistantAnalysisRun.analysis_summary}
                          </p>

                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <div>
                              <p className="font-semibold text-slate-900">Patterns</p>
                              {selectedAssistantAnalysisRun.failure_patterns.length > 0 ? (
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                  {selectedAssistantAnalysisRun.failure_patterns.map(
                                    (item) => (
                                      <li key={item}>{item}</li>
                                    )
                                  )}
                                </ul>
                              ) : (
                                <p className="mt-1 text-slate-500">No patterns saved.</p>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">Strengths</p>
                              {selectedAssistantAnalysisRun.strengths.length > 0 ? (
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                  {selectedAssistantAnalysisRun.strengths.map((item) => (
                                    <li key={item}>{item}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-slate-500">No strengths saved.</p>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">Prompt ideas</p>
                              {selectedAssistantAnalysisRun.prompt_recommendations.length >
                              0 ? (
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                  {selectedAssistantAnalysisRun.prompt_recommendations.map(
                                    (item) => (
                                      <li key={item}>{item}</li>
                                    )
                                  )}
                                </ul>
                              ) : (
                                <p className="mt-1 text-slate-500">No prompt ideas saved.</p>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">
                                UI/workflow ideas
                              </p>
                              {selectedAssistantAnalysisRun.ui_recommendations.length >
                              0 ? (
                                <ul className="mt-1 list-disc space-y-1 pl-5">
                                  {selectedAssistantAnalysisRun.ui_recommendations.map(
                                    (item) => (
                                      <li key={item}>{item}</li>
                                    )
                                  )}
                                </ul>
                              ) : (
                                <p className="mt-1 text-slate-500">No UI ideas saved.</p>
                              )}
                            </div>
                          </div>

                          <form
                            className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3"
                            onSubmit={handleUpdateAssistantAnalysisRun}
                          >
                            <h5 className="font-semibold text-slate-900">
                              Admin conclusion
                            </h5>
                            <label className="mt-3 block text-sm font-medium text-slate-700">
                              Status
                              <select
                                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                                onChange={(event) =>
                                  setAssistantAnalysisRunStatus(
                                    event.target.value as SupportAssistantAnalysisStatus
                                  )
                                }
                                value={assistantAnalysisRunStatus}
                              >
                                <option value="new">New</option>
                                <option value="reviewed">Reviewed</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                                <option value="needs_more_data">Needs more data</option>
                              </select>
                            </label>
                            <label className="mt-3 block text-sm font-medium text-slate-700">
                              Admin note
                              <textarea
                                className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
                                onChange={(event) =>
                                  setAssistantAnalysisRunNote(event.target.value)
                                }
                                placeholder="What should you do with this analysis?"
                                value={assistantAnalysisRunNote}
                              />
                            </label>
                            <button
                              className="mt-3 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                              disabled={savingAssistantAnalysisRunReview}
                              type="submit"
                            >
                              {savingAssistantAnalysisRunReview
                                ? "Saving..."
                                : "Save analysis review"}
                            </button>
                          </form>
                        </div>
                      ) : null}

                      <form
                        className="mt-4 rounded-md border border-slate-200 p-3"
                        onSubmit={handleCreateAssistantAdminReview}
                      >
                        <h4 className="font-semibold text-slate-900">Add admin interpretation</h4>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Review status
                            <select
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                              onChange={(event) =>
                                setAssistantReviewStatus(
                                  event.target.value as SupportAssistantReviewStatus
                                )
                              }
                              value={assistantReviewStatus}
                            >
                              <option value="needs_review">Needs review</option>
                              <option value="good_answer">Good answer</option>
                              <option value="needs_prompt_work">Needs prompt work</option>
                              <option value="needs_ui_work">Needs UI/workflow work</option>
                              <option value="should_escalate">Should escalate</option>
                              <option value="not_actionable">Not actionable</option>
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Recommended action
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                              onChange={(event) =>
                                setAssistantReviewRecommendedAction(event.target.value)
                              }
                              placeholder="Optional next step"
                              value={assistantReviewRecommendedAction}
                            />
                          </label>
                        </div>
                        <label className="mt-3 block text-sm font-medium text-slate-700">
                          Admin note
                          <textarea
                            className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
                            onChange={(event) =>
                              setAssistantReviewNote(event.target.value)
                            }
                            placeholder="What did this answer do well or poorly?"
                            value={assistantReviewNote}
                          />
                        </label>
                        <button
                          className="mt-3 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                          disabled={savingAssistantAdminReview || !assistantReviewNote.trim()}
                          type="submit"
                        >
                          {savingAssistantAdminReview ? "Saving..." : "Save admin review"}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </section>
              </div>
              ) : null}

              {adminTab === "content" ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">Dynamic Text</h2>
                    <p className="mt-1 text-slate-600">
                      Edit beta, legal, support, and other app text without a
                      code change.
                      {selectedAppContent
                        ? ` · current v${selectedAppContent.version_number}`
                        : " · no current version"}
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                    disabled={loadingAppContent}
                    onClick={() => loadAppContent()}
                    type="button"
                  >
                    {loadingAppContent ? "Loading..." : "Reload"}
                  </button>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
                  <aside className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">
                      Text area
                    </p>
                    <div className="space-y-2">
                      {appContentCategories.map((category) => {
                        const count = appContentOptions.filter(
                          (item) => item.category === category.key
                        ).length;
                        const isSelected =
                          selectedAppContentCategory === category.key;

                        return (
                          <button
                            className={`w-full rounded-md border px-3 py-3 text-left transition ${
                              isSelected
                                ? "border-blue-300 bg-blue-50 text-blue-950"
                                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                            }`}
                            key={category.key}
                            onClick={() =>
                              void handleChangeAppContentCategory(category.key)
                            }
                            type="button"
                          >
                            <span className="block font-semibold">
                              {category.label}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500">
                              {count
                                ? `${count} editable item${count === 1 ? "" : "s"}`
                                : "Planned"}
                            </span>
                          </button>
                        );
                      })}
                        </div>
                    </aside>

                  <div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedAppContentCategoryConfig.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedAppContentCategoryConfig.description}
                      </p>
                    </div>

                    {filteredAppContentOptions.length ? (
                      <label className="mt-5 block max-w-xl text-sm font-medium text-slate-700">
                        Text block
                        <select
                          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                          disabled={loadingAppContent}
                          onChange={(event) =>
                            handleChangeAppContentKey(event.target.value)
                          }
                          value={selectedAppContentKey}
                        >
                          {filteredAppContentOptions.map((item) => (
                            <option key={item.contentKey} value={item.contentKey}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                        No managed content blocks are in this area yet. We can
                        promote these strings when the app text is ready to be
                        managed here.
                      </div>
                    )}

                    {filteredAppContentOptions.length ? (
                      <>
                <form className="mt-5 space-y-4" onSubmit={handleSaveAppContent}>
                  <label className="block text-sm font-medium text-slate-700">
                    Label
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                      onChange={(event) => setAppContentLabel(event.target.value)}
                      value={appContentLabel}
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Admin description
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                      onChange={(event) =>
                        setAppContentDescription(event.target.value)
                      }
                      value={appContentDescription}
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Text shown in the app
                    <textarea
                      className="mt-2 min-h-64 w-full rounded-md border border-slate-300 px-3 py-2 text-base leading-7"
                      onChange={(event) => setAppContentBody(event.target.value)}
                      value={appContentBody}
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Change note
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                      onChange={(event) =>
                        setAppContentChangeNote(event.target.value)
                      }
                      placeholder="What changed and why?"
                      value={appContentChangeNote}
                    />
                  </label>

                  <button
                    className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                    disabled={savingAppContent}
                    type="submit"
                  >
                    {savingAppContent ? "Saving..." : "Save new version"}
                  </button>
                </form>

                <section className="mt-6 border-t border-slate-200 pt-5">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Version history
                  </h3>
                  <div className="mt-3 space-y-3">
                    {appContentVersions
                      .filter(
                        (version) =>
                          version.content_key === selectedAppContentKey
                      )
                      .map((version) => (
                        <article
                          className="rounded-md border border-slate-200 p-4"
                          key={version.id}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                v{version.version_number}
                                {version.is_current ? " · current" : ""}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {formatDate(version.created_at)}
                              </p>
                              {version.content_hash ? (
                                <p className="mt-1 font-mono text-xs text-slate-500">
                                  {version.content_hash}
                                </p>
                              ) : null}
                              {version.change_note ? (
                                <p className="mt-2 text-sm text-slate-700">
                                  {version.change_note}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                                onClick={() => resetAppContentEditor(version)}
                                type="button"
                              >
                                View
                              </button>
                              {!version.is_current ? (
                                <button
                                  className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 disabled:text-slate-400"
                                  disabled={
                                    revertingAppContentForId === version.id
                                  }
                                  onClick={() => handleRevertAppContent(version)}
                                  type="button"
                                >
                                  {revertingAppContentForId === version.id
                                    ? "Reverting..."
                                    : "Revert"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      ))}
                    {appContentVersions.filter(
                      (version) => version.content_key === selectedAppContentKey
                    ).length === 0 ? (
                      <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
                        No saved versions found yet. Saving will create version 1.
                      </p>
                    ) : null}
                  </div>
                </section>
                      </>
                    ) : null}
                  </div>
                </div>
              </section>
              ) : null}

              {adminTab === "ai" ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">AI admin</h2>
                    <p className="mt-1 text-slate-600">
                      {selectedAiWorkflowConfig.label}
                      {aiAdminTab === "history" ? " audit trail" : ""}
                      {aiAdminTab === "instructions" && aiInstructionVersion
                        ? ` · current v${aiInstructionVersion.version_number}`
                        : ""}
                      {aiAdminTab === "instructions" && !aiInstructionVersion
                        ? " · no current version"
                        : ""}
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                    disabled={
                      loadingInstructions ||
                      loadingCarePrepHistory ||
                      loadingAgentKnowledgeProposals
                    }
                    onClick={() =>
                      aiAdminTab === "instructions"
                        ? loadAiInstructions()
                        : aiAdminTab === "agentKnowledge"
                          ? loadAppContent("support_agent_product_facts")
                          : aiAdminTab === "proposals"
                            ? loadAgentKnowledgeProposals()
                            : selectedAiWorkflow === "careprep_generation"
                              ? loadCarePrepHistory()
                              : loadIntakeHistory()
                    }
                    type="button"
                  >
                    {loadingInstructions ||
                    loadingCarePrepHistory ||
                    loadingAgentKnowledgeProposals
                      ? "Loading..."
                      : "Reload"}
                  </button>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
                  <aside className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">
                      AI area
                    </p>
                    {[
                      ["instructions", "Instructions", "Prompt versions"],
                      ["agentKnowledge", "Agent Knowledge", "Product truth"],
                      ["proposals", "Proposals", "Review updates"],
                      ["history", selectedAiWorkflowConfig.historyLabel, "Audit trail"],
                    ].map(([tabKey, label, description]) => {
                      const isSelected = aiAdminTab === tabKey;
                      const attention = adminAttentionFor(
                        "ai_admin_tab",
                        tabKey
                      );

                      return (
                        <AdminNavButton
                          className="w-full px-3 py-3 text-left"
                          disabled={
                            loadingInstructions ||
                            loadingCarePrepHistory ||
                            loadingAgentKnowledgeProposals
                          }
                          followupCount={attention?.followup_count ?? 0}
                          isSelected={isSelected}
                          key={tabKey}
                          newCount={attention?.new_count ?? 0}
                          onClick={() =>
                            handleChangeAiAdminTab(tabKey as AiAdminTab)
                          }
                        >
                          <span className="block font-semibold">{label}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {description}
                          </span>
                        </AdminNavButton>
                      );
                    })}
                  </aside>

                  <div>
                {aiAdminTab !== "agentKnowledge" && aiAdminTab !== "proposals" ? (
                  <label className="block max-w-xl text-sm font-medium text-slate-700">
                  AI workflow
                  <select
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                    disabled={loadingInstructions || loadingCarePrepHistory}
                    onChange={(event) =>
                      handleChangeAiWorkflow(event.target.value as AiWorkflowKey)
                    }
                    value={selectedAiWorkflow}
                  >
                    {Object.entries(aiWorkflows).map(([workflowKey, workflow]) => (
                      <option key={workflowKey} value={workflowKey}>
                        {workflow.label}
                      </option>
                    ))}
                  </select>
                </label>
                ) : null}

                {aiAdminTab === "instructions" ? (
                  <>
                <form className="mt-5 space-y-4" onSubmit={handleSaveAiInstructions}>
                  {draftSourceVersion ? (
                    <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
                      Editing from v{draftSourceVersion.version_number}
                      {draftSourceVersion.content_hash
                        ? ` · ${draftSourceVersion.content_hash.slice(0, 12)}`
                        : ""}
                    </p>
                  ) : null}

                  <label className="block text-sm font-medium text-slate-700">
                    Model
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                      onChange={(event) => setInstructionModel(event.target.value)}
                      value={instructionModel}
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    System prompt
                    <textarea
                      className="mt-2 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                      onChange={(event) =>
                        setInstructionSystemPrompt(event.target.value)
                      }
                      placeholder={`Paste the ${selectedAiWorkflowConfig.label} system instructions here.`}
                      value={instructionSystemPrompt}
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    User prompt template
                    <textarea
                      className="mt-2 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                      onChange={(event) =>
                        setInstructionUserPrompt(event.target.value)
                      }
                      placeholder="Optional context template for the user message."
                      value={instructionUserPrompt}
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Output schema JSON
                    <textarea
                      className="mt-2 min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                      onChange={(event) =>
                        setInstructionOutputSchema(event.target.value)
                      }
                      value={instructionOutputSchema}
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Change note
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                      onChange={(event) =>
                        setInstructionChangeNote(event.target.value)
                      }
                      placeholder="What changed in this version?"
                      value={instructionChangeNote}
                    />
                  </label>

                  <button
                    className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                    disabled={savingInstructions}
                    type="submit"
                  >
                    {savingInstructions ? "Saving..." : "Save new version"}
                  </button>
                </form>

                {aiInstructionVersions.length > 0 ? (
                  <section className="mt-6 border-t border-slate-200 pt-5">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Version history
                    </h3>
                    <div className="mt-3 space-y-3">
                      {aiInstructionVersions.map((version) => (
                        <article
                          className="rounded-md border border-slate-200 p-4"
                          key={version.id}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                v{version.version_number}
                                {version.is_current ? " · current" : ""}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {formatDate(version.created_at)}
                                {version.model ? ` · ${version.model}` : ""}
                              </p>
                              {version.content_hash ? (
                                <p className="mt-1 font-mono text-xs text-slate-500">
                                  {version.content_hash}
                                </p>
                              ) : null}
                              {version.change_note ? (
                                <p className="mt-2 text-sm text-slate-700">
                                  {version.change_note}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                                onClick={() =>
                                  loadInstructionVersionIntoEditor(version)
                                }
                                type="button"
                              >
                                View
                              </button>
                              {!version.is_current ? (
                                <button
                                  className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 disabled:text-slate-400"
                                  disabled={
                                    revertingInstructionForId === version.id
                                  }
                                  onClick={() =>
                                    handleRevertInstructionVersion(version)
                                  }
                                  type="button"
                                >
                                  {revertingInstructionForId === version.id
                                    ? "Reverting..."
                                    : "Revert"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
                  </>
                ) : aiAdminTab === "agentKnowledge" ? (
                  <section className="space-y-5">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Agent Knowledge
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        These facts are injected into the support assistant so it
                        can answer with current product context.
                      </p>
                    </div>

                    <form
                      className="space-y-4"
                      onSubmit={handleSaveAgentKnowledge}
                    >
                      <label className="block text-sm font-medium text-slate-700">
                        Product facts
                        <textarea
                          className="mt-2 min-h-36 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) =>
                            setAgentProductFacts(event.target.value)
                          }
                          value={agentProductFacts}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Known limitations
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) =>
                            setAgentKnownLimitations(event.target.value)
                          }
                          value={agentKnownLimitations}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Escalation guidance
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) =>
                            setAgentEscalationGuidance(event.target.value)
                          }
                          value={agentEscalationGuidance}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Voice guidance
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          onChange={(event) =>
                            setAgentVoiceGuidance(event.target.value)
                          }
                          value={agentVoiceGuidance}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Change note
                        <input
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                          onChange={(event) =>
                            setAgentKnowledgeChangeNote(event.target.value)
                          }
                          placeholder="What changed and why?"
                          value={agentKnowledgeChangeNote}
                        />
                      </label>
                      <button
                        className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                        disabled={savingAgentKnowledge}
                        type="submit"
                      >
                        {savingAgentKnowledge
                          ? "Saving..."
                          : "Save agent knowledge"}
                      </button>
                    </form>

                    <section className="border-t border-slate-200 pt-5">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Knowledge version history
                      </h3>
                      {agentKnowledgeVersions.length === 0 ? (
                        <p className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-600">
                          No saved agent knowledge versions yet. The assistant
                          will use the default knowledge text until this is
                          saved.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          {agentKnowledgeVersions.slice(0, 12).map((version) => (
                            <article
                              className="rounded-md border border-slate-200 p-4"
                              key={version.id}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {version.label} · v{version.version_number}
                                    {version.is_current ? " · current" : ""}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {formatDate(version.created_at)}
                                  </p>
                                  {version.change_note ? (
                                    <p className="mt-2 text-sm text-slate-700">
                                      {version.change_note}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </section>
                  </section>
                ) : aiAdminTab === "proposals" ? (
                  <AgentKnowledgeProposalsPanel
                    automationSettings={agentKnowledgeAutomationSettings}
                    checkRuns={agentKnowledgeCheckRuns}
                    drafts={agentKnowledgeProposalDrafts}
                    formatDate={formatDate}
                    loading={loadingAgentKnowledgeProposals}
                    notes={agentKnowledgeProposalNotes}
                    onDraftChange={(itemId, value) =>
                      setAgentKnowledgeProposalDrafts((current) => ({
                        ...current,
                        [itemId]: value,
                      }))
                    }
                    onNoteChange={(itemId, value) =>
                      setAgentKnowledgeProposalNotes((current) => ({
                        ...current,
                        [itemId]: value,
                      }))
                    }
                    onPublish={handlePublishAgentKnowledgeProposal}
                    onPublishNoteChange={setAgentKnowledgeProposalPublishNote}
                    onQueueManualCheck={handleQueueAgentKnowledgeManualCheck}
                    onReviewItem={handleReviewAgentKnowledgeProposalItem}
                    onSaveAutomationSettings={
                      handleSaveAgentKnowledgeAutomationSettings
                    }
                    onSelectProposal={setSelectedAgentKnowledgeProposalId}
                    onSettingsChange={(patch) =>
                      setAgentKnowledgeAutomationSettings((current) => ({
                        ...current,
                        ...patch,
                      }))
                    }
                    proposals={agentKnowledgeProposals}
                    publishableCount={
                      selectedAgentKnowledgeProposalPublishableCount
                    }
                    publishingProposalId={publishingAgentKnowledgeProposalId}
                    publishNote={agentKnowledgeProposalPublishNote}
                    queueingRun={queueingAgentKnowledgeRun}
                    savingAutomationSettings={
                      savingAgentKnowledgeAutomationSettings
                    }
                    savingItemId={savingAgentKnowledgeProposalItemId}
                    selectedItems={selectedAgentKnowledgeProposalItems}
                    selectedProposal={selectedAgentKnowledgeProposal}
                  />
                ) : selectedAiWorkflow === "careprep_generation" ? (
                  <section className="mt-5 space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="block min-w-64 text-sm font-medium text-slate-700">
                        Appointment
                        <select
                          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                          onChange={(event) =>
                            handleChangeHistoryAppointment(event.target.value)
                          }
                          value={historyAppointmentId || appointments[0]?.id || ""}
                        >
                          {appointments.length === 0 ? (
                            <option value="">No appointments loaded</option>
                          ) : null}
                          {appointments.map((appointment) => (
                            <option key={appointment.id} value={appointment.id}>
                              {appointment.title || "Untitled appointment"} ·{" "}
                              {formatDate(appointment.starts_at)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                        disabled={loadingCarePrepHistory}
                        onClick={() => loadCarePrepHistory()}
                        type="button"
                      >
                        {loadingCarePrepHistory ? "Loading..." : "Load history"}
                      </button>
                    </div>

                    {carePrepHistory.length === 0 ? (
                      <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
                        No CarePrep history loaded for this appointment yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {carePrepHistory.map((row) => (
                          <article
                            className="rounded-md border border-slate-200 p-4"
                            key={row.id}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {row.version_number > 0
                                    ? `v${row.version_number}`
                                    : "Unaccepted"}
                                  {row.is_current ? " · current" : ""}
                                  {row.review_status
                                    ? ` · ${row.review_status}`
                                    : ""}
                                  {row.source ? ` · ${row.source}` : ""}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                  {formatDate(row.generated_at)}
                                  {row.model ? ` · ${row.model}` : ""}
                                  {row.prompt_version
                                    ? ` · ${row.prompt_version}`
                                    : ""}
                                </p>
                                {row.instruction_content_hash ? (
                                  <p className="mt-1 font-mono text-xs text-slate-500">
                                    {row.instruction_content_hash}
                                  </p>
                                ) : null}
                                {row.summary ? (
                                  <p className="mt-2 text-sm text-slate-700">
                                    {row.summary}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                              {row.ai_generated_guidance_id ? (
                                <p>
                                  AI source: {row.ai_generated_guidance_id}
                                </p>
                              ) : null}
                              {row.edited_from_guidance_id ? (
                                <p>
                                  Edited from: {row.edited_from_guidance_id}
                                </p>
                              ) : null}
                              {row.superseded_by_guidance_id ? (
                                <p>
                                  Superseded by: {row.superseded_by_guidance_id}
                                </p>
                              ) : null}
                              {row.superseded_at ? (
                                <p>Superseded: {formatDate(row.superseded_at)}</p>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                ) : (
                  <section className="mt-5 space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                        disabled={loadingCarePrepHistory}
                        onClick={() => loadIntakeHistory()}
                        type="button"
                      >
                        {loadingCarePrepHistory ? "Loading..." : "Load history"}
                      </button>
                    </div>

                    {intakeHistory.length === 0 ? (
                      <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-600">
                        No note intake history loaded yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {intakeHistory.map((row) => {
                          const accepted =
                            row.accepted_interpretation &&
                            typeof row.accepted_interpretation === "object"
                              ? (row.accepted_interpretation as Record<
                                  string,
                                  unknown
                                >)
                              : null;
                          const aiDraft =
                            row.ai_interpretation &&
                            typeof row.ai_interpretation === "object"
                              ? (row.ai_interpretation as Record<string, unknown>)
                              : null;
                          const title = String(
                            accepted?.appointment_title ??
                              aiDraft?.appointment_title ??
                              "Untitled intake"
                          );
                          const summary = String(
                            accepted?.notes_summary ??
                              aiDraft?.notes_summary ??
                              row.raw_text ??
                              ""
                          );

                          return (
                            <article
                              className="rounded-md border border-slate-200 p-4"
                              key={row.id}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {title}
                                    {row.status ? ` · ${row.status}` : ""}
                                    {row.match_status
                                      ? ` · ${row.match_status}`
                                      : ""}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {formatDate(row.created_at)}
                                    {row.model ? ` · ${row.model}` : ""}
                                    {row.prompt_version
                                      ? ` · ${row.prompt_version}`
                                      : ""}
                                  </p>
                                  {row.instruction_content_hash ? (
                                    <p className="mt-1 font-mono text-xs text-slate-500">
                                      {row.instruction_content_hash}
                                    </p>
                                  ) : null}
                                  {summary ? (
                                    <p className="mt-2 max-h-20 overflow-hidden text-sm text-slate-700">
                                      {summary}
                                    </p>
                                  ) : null}
                                  {row.error_message ? (
                                    <p className="mt-2 text-sm text-red-700">
                                      {row.error_message}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}
                  </div>
                </div>
              </section>
              ) : null}

              {adminTab === "product" ? (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div>
                    <h2 className="text-2xl font-semibold">Product management</h2>
                    <p className="mt-1 max-w-3xl text-slate-600">
                      Track bugs, Early Access readiness, release notes, wishlist items,
                      and admin follow-ups without leaving the app. Each add or
                      status change is versioned.
                    </p>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
                    <aside className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">
                        Product area
                      </p>
                      <div className="space-y-2">
                        {visibleProductMgmtSections.map((section) => {
                          const isSelected =
                            selectedProductMgmtSection === section.key;
                          const area = productMgmtAreas.find(
                            (item) => item.area_key === section.key
                          );
                          const itemCount = productMgmtItems.filter(
                            (item) => item.area_id === area?.id
                          ).length;
                          return (
                            <AdminNavButton
                              className="w-full px-3 py-3 text-left"
                              followupCount={0}
                              isSelected={isSelected}
                              key={section.key}
                              newCount={0}
                              onClick={() =>
                                handleChangeProductMgmtSection(
                                  section.key as ProductMgmtSection
                                )
                              }
                            >
                              <span className="block font-semibold">
                                {section.label}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {productMgmtAreas.length > 0
                                  ? `${itemCount} item${itemCount === 1 ? "" : "s"}`
                                  : "Run SQL to enable entries"}
                              </span>
                            </AdminNavButton>
                          );
                        })}
                      </div>
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <button
                          className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                          onClick={() =>
                            setShowProductMgmtAreaForm(
                              (isVisible) => !isVisible
                            )
                          }
                          type="button"
                        >
                          {showProductMgmtAreaForm ? "Hide lane form" : "+ Add lane"}
                        </button>
                        {showProductMgmtAreaForm ? (
                          <form
                            className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3"
                            onSubmit={handleCreateProductMgmtArea}
                          >
                            <label className="block">
                              <span className="text-xs font-semibold text-slate-600">
                                Lane name
                              </span>
                              <input
                                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                                disabled={savingProductMgmtArea}
                                onChange={(event) =>
                                  setNewProductMgmtAreaLabel(event.target.value)
                                }
                                placeholder="e.g. Beta Program"
                                required
                                value={newProductMgmtAreaLabel}
                              />
                            </label>
                            <label className="block">
                              <span className="text-xs font-semibold text-slate-600">
                                Description
                              </span>
                              <textarea
                                className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                                disabled={savingProductMgmtArea}
                                onChange={(event) =>
                                  setNewProductMgmtAreaDescription(
                                    event.target.value
                                  )
                                }
                                placeholder="What belongs in this lane?"
                                value={newProductMgmtAreaDescription}
                              />
                            </label>
                            <button
                              className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                              disabled={
                                savingProductMgmtArea ||
                                !newProductMgmtAreaLabel.trim()
                              }
                              type="submit"
                            >
	                              {savingProductMgmtArea ? "Adding..." : "Add lane"}
	                            </button>
	                          </form>
	                        ) : null}
	                      </div>
                    </aside>

                    <div className="space-y-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {selectedProductMgmtSectionConfig.label}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {selectedProductMgmtSectionConfig.description}
                            </p>
                          </div>
                          {selectedProductMgmtArea &&
                          selectedProductMgmtItems.length === 0 ? (
                            <button
                              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 disabled:bg-slate-100"
                              disabled={
                                retiringProductMgmtAreaId ===
                                selectedProductMgmtArea.id
                              }
                              onClick={() =>
                                handleRetireProductMgmtArea(
                                  selectedProductMgmtArea
                                )
                              }
                              type="button"
                            >
                              {retiringProductMgmtAreaId ===
                              selectedProductMgmtArea.id
                                ? "Retiring..."
                                : "Retire lane"}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <form
                        className="rounded-lg border border-slate-200 bg-white p-4"
                        onSubmit={handleCreateProductMgmtItem}
                      >
                        <h3 className="text-lg font-semibold text-slate-900">
                          Add entry
                        </h3>
                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem_10rem]">
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">
                              Title
                            </span>
                            <input
                              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              disabled={!selectedProductMgmtArea || savingProductMgmtItem}
                              onChange={(event) =>
                                setNewProductMgmtTitle(event.target.value)
                              }
                              placeholder="e.g. Add onboarding support link"
                              required
                              value={newProductMgmtTitle}
                            />
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">
                              Priority
                            </span>
                            <select
                              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              disabled={!selectedProductMgmtArea || savingProductMgmtItem}
                              onChange={(event) =>
                                setNewProductMgmtPriority(
                                  event.target.value as ProductMgmtPriority
                                )
                              }
                              value={newProductMgmtPriority}
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </label>
                          <label className="block">
                            <span className="text-sm font-medium text-slate-700">
                              Status
                            </span>
                            <select
                              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                              disabled={!selectedProductMgmtArea || savingProductMgmtItem}
                              onChange={(event) =>
                                setNewProductMgmtStatus(
                                  event.target.value as ProductMgmtStatus
                                )
                              }
                              value={newProductMgmtStatus}
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In progress</option>
                              <option value="deferred">Deferred</option>
                            </select>
                          </label>
                        </div>
                        <label className="mt-3 block">
                          <span className="text-sm font-medium text-slate-700">
                            Notes
                          </span>
                          <textarea
                            className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            disabled={!selectedProductMgmtArea || savingProductMgmtItem}
                            onChange={(event) =>
                              setNewProductMgmtBody(event.target.value)
                            }
                            placeholder="What should future Andrew remember about this?"
                            value={newProductMgmtBody}
                          />
                        </label>
                        <label className="mt-3 block">
                          <span className="text-sm font-medium text-slate-700">
                            Version note
                          </span>
                          <input
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            disabled={!selectedProductMgmtArea || savingProductMgmtItem}
                            onChange={(event) =>
                              setNewProductMgmtChangeNote(event.target.value)
                            }
                            value={newProductMgmtChangeNote}
                          />
                        </label>
                        <button
                          className="mt-3 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                          disabled={
                            !selectedProductMgmtArea ||
                            savingProductMgmtItem ||
                            !newProductMgmtTitle.trim()
                          }
                          type="submit"
                        >
                          {savingProductMgmtItem ? "Adding..." : "Add entry"}
                        </button>
                        {!selectedProductMgmtArea ? (
                          <p className="mt-2 text-sm text-slate-500">
                            Run the product management SQL in Supabase to enable
                            entries for this tab.
                          </p>
                        ) : null}
                      </form>

                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            Current entries
                          </h3>
                          {loadingProductMgmt ? (
                            <span className="text-sm text-slate-500">Loading...</span>
                          ) : null}
                        </div>

                        {selectedProductMgmtItems.length === 0 ? (
                          <p className="mt-3 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                            No entries in this lane yet.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {selectedProductMgmtItems.map((item) => {
                              const isResolved = item.status === "resolved";
                              const isEditing =
                                editingProductMgmtItemId === item.id &&
                                productMgmtItemDraft !== null;
                              const isSavingEdit =
                                savingProductMgmtEditItemId === item.id;
                              const statusLabel = item.status
                                .replace("_", " ")
                                .replace(/^./, (letter) => letter.toUpperCase());

                              return (
                                <article
                                  className={`rounded-md border p-3 ${
                                    isResolved
                                      ? "border-slate-200 bg-slate-50"
                                      : "border-slate-200 bg-white"
                                  }`}
                                  key={item.id}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-slate-950">
                                        {item.title}
                                      </p>
                                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                                        v{item.current_version_number} · {item.priority} priority · updated {formatDate(item.updated_at)}
                                      </p>
                                    </div>
                                    <span
                                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                        isResolved
                                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                          : item.status === "in_progress"
                                            ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                                            : item.status === "deferred"
                                              ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                                              : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                      }`}
                                    >
                                      {statusLabel}
                                    </span>
                                  </div>
                                  {item.body ? (
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                      {item.body}
                                    </p>
                                  ) : null}

                                  {item.ask_submission_id ? (
                                    <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-slate-700">
                                          Created from Ask intake.
                                        </p>
                                        <button
                                          className="rounded-md border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-700"
                                          onClick={() =>
                                            openAskSubmissionReview(
                                              item.ask_submission_id ?? ""
                                            )
                                          }
                                          type="button"
                                        >
                                          Open Ask review
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}

                                  {isEditing ? (
                                    <form
                                      className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3"
                                      onSubmit={(event) =>
                                        handleUpdateProductMgmtItem(event, item)
                                      }
                                    >
                                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_10rem]">
                                        <label className="block">
                                          <span className="text-sm font-medium text-slate-700">
                                            Title
                                          </span>
                                          <input
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            disabled={isSavingEdit}
                                            onChange={(event) =>
                                              updateProductMgmtItemDraft(
                                                "title",
                                                event.target.value
                                              )
                                            }
                                            required
                                            value={productMgmtItemDraft.title}
                                          />
                                        </label>
                                        <label className="block">
                                          <span className="text-sm font-medium text-slate-700">
                                            Priority
                                          </span>
                                          <select
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            disabled={isSavingEdit}
                                            onChange={(event) =>
                                              updateProductMgmtItemDraft(
                                                "priority",
                                                event.target
                                                  .value as ProductMgmtPriority
                                              )
                                            }
                                            value={productMgmtItemDraft.priority}
                                          >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                          </select>
                                        </label>
                                        <label className="block">
                                          <span className="text-sm font-medium text-slate-700">
                                            Status
                                          </span>
                                          <select
                                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                            disabled={isSavingEdit}
                                            onChange={(event) =>
                                              updateProductMgmtItemDraft(
                                                "status",
                                                event.target
                                                  .value as ProductMgmtStatus
                                              )
                                            }
                                            value={productMgmtItemDraft.status}
                                          >
                                            <option value="open">Open</option>
                                            <option value="in_progress">
                                              In progress
                                            </option>
                                            <option value="deferred">
                                              Deferred
                                            </option>
                                            <option value="resolved">
                                              Resolved
                                            </option>
                                          </select>
                                        </label>
                                      </div>

                                      <label className="mt-3 block">
                                        <span className="text-sm font-medium text-slate-700">
                                          Lane
                                        </span>
                                        <select
                                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                          disabled={isSavingEdit}
                                          onChange={(event) =>
                                            updateProductMgmtItemDraft(
                                              "areaId",
                                              event.target.value
                                            )
                                          }
                                          value={productMgmtItemDraft.areaId}
                                        >
                                          {productMgmtAreas.map((area) => (
                                            <option key={area.id} value={area.id}>
                                              {area.label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>

                                      <label className="mt-3 block">
                                        <span className="text-sm font-medium text-slate-700">
                                          Notes
                                        </span>
                                        <textarea
                                          className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                          disabled={isSavingEdit}
                                          onChange={(event) =>
                                            updateProductMgmtItemDraft(
                                              "body",
                                              event.target.value
                                            )
                                          }
                                          value={productMgmtItemDraft.body}
                                        />
                                      </label>

                                      <label className="mt-3 block">
                                        <span className="text-sm font-medium text-slate-700">
                                          Version note
                                        </span>
                                        <input
                                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                          disabled={isSavingEdit}
                                          onChange={(event) =>
                                            updateProductMgmtItemDraft(
                                              "changeNote",
                                              event.target.value
                                            )
                                          }
                                          required
                                          value={productMgmtItemDraft.changeNote}
                                        />
                                      </label>

                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          className="rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                                          disabled={
                                            isSavingEdit ||
                                            !productMgmtItemDraft.title.trim() ||
                                            !productMgmtItemDraft.changeNote.trim()
                                          }
                                          type="submit"
                                        >
                                          {isSavingEdit ? "Saving..." : "Save edit"}
                                        </button>
                                        <button
                                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:bg-slate-100"
                                          disabled={isSavingEdit}
                                          onClick={cancelEditingProductMgmtItem}
                                          type="button"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </form>
                                  ) : null}

                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {!isEditing ? (
                                      <button
                                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                                        onClick={() =>
                                          startEditingProductMgmtItem(item)
                                        }
                                        type="button"
                                      >
                                        Edit
                                      </button>
                                    ) : null}
                                    {!isResolved ? (
                                      <button
                                        className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 disabled:bg-slate-100 disabled:text-slate-400"
                                        disabled={
                                          resolvingProductMgmtItemId === item.id ||
                                          isEditing
                                        }
                                        onClick={() =>
                                          handleResolveProductMgmtItem(item)
                                        }
                                        type="button"
                                      >
                                        {resolvingProductMgmtItemId === item.id
                                          ? "Resolving..."
                                          : "Mark resolved"}
                                      </button>
                                    ) : null}
                                    {isResolved && item.resolved_at ? (
                                      <span className="text-sm text-slate-500">
                                        Resolved {formatDate(item.resolved_at)}
                                      </span>
                                    ) : null}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}
              </>
            ) : null}

            {signedInEmail && mainTab === "appointments" ? (
              <AppointmentViewToolbar
                allSubjectsValue={ALL_SUBJECTS}
                canFilterCareVips={canFilterCareVips}
                careSubjects={careSubjects}
                disabled={loading}
                onChangeSubject={handleChangeSubject}
                onChangeView={handleChangeAppointmentView}
                selectedSubjectId={selectedSubjectId}
                stickyTop={stickySecondaryOffset}
                view={appointmentView}
              />
            ) : null}

            {signedInEmail && mainTab === "appointments" ? (
              appointments.length === 0 ? (
              <div className="-mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-600">
                {appointmentView === "archived"
                  ? "No archived appointments found."
                  : appointmentView === "logged"
                    ? "No logged appointments found yet."
                    : "No upcoming appointments found yet."}
              </div>
            ) : (
              <div className="-mt-4 overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm">
              {appointments.map((appointment) => {
                const note = notesByAppointment.get(appointment.id);
                const prep = guidanceByAppointment.get(appointment.id);
                const carePrepDraft = draftGuidanceByAppointment.get(
                  appointment.id
                );
                const hasCarePrepAvailable = Boolean(
                  prep?.summary || carePrepDraft?.summary
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
                const bringList = asTextList(prep?.bring_list);
                const questions = asTextList(prep?.key_questions);
                const watchouts = asTextList(prep?.watchouts);
                const medReview = asTextList(prep?.med_review);
                const sinceLastVisit = asTextList(prep?.since_last_visit);
                const draftValues = carePrepDraft
                  ? carePrepFormValues(appointment.id, carePrepDraft)
                  : emptyCarePrepDraft;
                const hasReviewCarePrepEdits = carePrepDraft
                  ? hasCarePrepDraftChanges(appointment.id, carePrepDraft)
                  : false;
                const prepEditValues = prep
                  ? carePrepFormValues(appointment.id, prep)
                  : emptyCarePrepDraft;
                const isArchived = appointment.status === "archived";
                const isLogged = Boolean(appointment.current_note_id);
                const isVisitNotesExpandableView =
                  appointmentView === "logged" || appointmentView === "archived";
                const isVisitNotesExpanded =
                  expandedVisitNotesAppointmentId === appointment.id;
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
                const calendarLink = agicalUrl(appointment);
	                const practiceLabel =
	                  appointment.provider_organization ||
	                  appointment.location_name ||
	                  "";
		                const appointmentSubject = appointment.care_subject_id
		                  ? subjectsById.get(appointment.care_subject_id)?.display_name
		                  : "";
		                const pendingModifierWarning =
		                  pendingModifierSwitch?.appointmentId === appointment.id ? (
		                    <section className="mt-3 rounded-lg border border-blue-200 bg-[#f4faff] p-4">
		                      <div className="flex flex-wrap items-center justify-between gap-3">
		                        <p className="text-sm font-medium text-blue-950">
		                          {pendingModifierSwitch.target
		                            ? "Switching will discard your unsaved changes. Proceed?"
		                            : "Closing will discard your unsaved changes. Proceed?"}
		                        </p>
		                        <div className="flex flex-wrap gap-2">
		                          <button
		                            className={gentleWarmButtonClass}
		                            onClick={() =>
		                              discardAndSwitchAppointmentModifier(appointment)
		                            }
		                            type="button"
		                          >
		                            {pendingModifierSwitch.target
		                              ? "Discard and switch"
		                              : "Discard and close"}
		                          </button>
		                          <button
		                            className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900"
		                            onClick={() => setPendingModifierSwitch(null)}
		                            type="button"
		                          >
		                            Return to editing
		                          </button>
		                        </div>
		                      </div>
		                    </section>
		                  ) : null;
		                return (
                  <article
                    id={`appointment-${appointment.id}`}
                    className="relative flex flex-col px-5 py-8 before:absolute before:left-5 before:right-5 before:top-0 before:h-px before:bg-slate-200 first:before:hidden sm:px-6"
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
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0 pr-12">
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
                      </div>
                      <div className="text-left md:min-w-64 md:text-right">
                        <p className="flex items-center gap-2 text-lg font-medium text-slate-700 md:justify-end md:pr-12">
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
                        </p>
                        {practiceLabel ||
                        appointment.location_address ||
                        appointment.location_phone ? (
                          <div className="mt-2 text-sm text-[#767676] md:pr-12">
                            {practiceLabel ? (
                              <button
                                className="inline-flex items-center gap-1 text-left font-medium text-[#767676] hover:text-blue-800 md:justify-end md:text-right"
                                onClick={() =>
                                  setLocationSheetAppointmentId(appointment.id)
                                }
                                type="button"
                              >
                                <MapPinIcon className="h-4 w-4 shrink-0" />
                                <span>{practiceLabel}</span>
                              </button>
                            ) : null}
                            {!practiceLabel &&
                            appointment.location_address ? (
                              <p>{appointment.location_address}</p>
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

                    {!isArchived &&
                    canPasteContextualNotes &&
                    activeModifier !== "import" ? (
                      <div className="order-30 mt-4 flex flex-wrap gap-3">
                        <button
                          className={`${appointmentSectionButtonClass} gap-1.5`}
                          onClick={() =>
                            requestAppointmentModifier(appointment, "import")
                          }
                          title="Add visit notes"
                          type="button"
                        >
                          Visit notes
                          {note ? (
                            <span
                              aria-hidden="true"
                              className="text-sm leading-none text-blue-950"
                            >
                              ✓
                            </span>
                          ) : null}
                        </button>
                      </div>
                    ) : null}

                    {isContextualTextIntake && canPasteContextualNotes ? (
                      <form
                        className="order-30 mt-5 border border-blue-100 bg-[#f4faff] p-4"
                        onSubmit={
                          textIntakeDraft
                            ? handleSaveTextIntakeDraft
                            : handleInterpretTextIntake
                        }
                      >
                        {!textIntakeDraft ? (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button
                                className={`${appointmentSectionTitleButtonClass} gap-1.5`}
                                onClick={() =>
                                  requestAppointmentModifier(
                                    appointment,
                                    "import"
                                  )
                                }
                                title="Close visit notes"
                                type="button"
                              >
                                Visit notes
                                {note ? (
                                  <span
                                    aria-hidden="true"
                                    className="text-sm leading-none text-blue-950"
                                  >
                                    ✓
                                  </span>
                                ) : null}
                              </button>
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
	                            {pendingModifierWarning}
	                            <textarea
                              className="mt-3 min-h-56 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base leading-7"
                              onChange={(event) =>
                                setContextualTextIntakeValue(event.target.value)
                              }
                              placeholder="Type or paste what happened, portal notes, after-visit summaries, or follow-up details."
                              value={contextualTextIntakeValue}
                            />
                            {fileImportStatus ? (
                              <p className="mt-2 text-xs text-slate-500">
                                {fileImportStatus}
                              </p>
                            ) : null}
                            <div className="mt-4 flex flex-wrap items-center gap-4">
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
                                onClick={cancelTextIntake}
                                type="button"
                              >
                                Cancel
                              </button>
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

                    {appointment.reason ? (
                      <section
                        className={`order-10 ${
                          appointment.is_sample_data ? "mt-5" : "mt-3"
                        }`}
                      >
                        <h3 className="font-semibold text-slate-900">Reason</h3>
                        <p className="mt-1 text-slate-700">{appointment.reason}</p>
                      </section>
                    ) : null}

                    {shouldShowCarePrep && carePrepDraft && !isArchived ? (
                      <section className="order-20 mt-6 border border-blue-100 bg-[#f4faff] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-blue-900">
                              Review new CarePrep
                            </h3>
                            <p className="mt-1 text-sm text-blue-800">
                              AI prepared this version. Accept it as-is, or edit
                              it and save your version.
                            </p>
                          </div>
                          <button
                            className={gentleSmallBlueButtonClass}
                            disabled={generatingCarePrepForId === appointment.id}
                            onClick={() => handleGenerateCarePrep(appointment)}
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
                              : "Accept CarePrep"}
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
                                ? "Save your edited CarePrep version."
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

                    {note && isVisitNotesExpandableView && !isEditingNote ? (
                      !isVisitNotesExpanded ? (
                        <div className="order-30 mt-5 flex flex-wrap gap-3">
                          <button
                            className={appointmentSectionButtonClass}
                            onClick={() =>
                              setExpandedVisitNotesAppointmentId(appointment.id)
                            }
                            title="Open Visit notes"
                            type="button"
                          >
                            Visit notes
                            <span
                              aria-hidden="true"
                              className="text-sm leading-none text-blue-950"
                            >
                              ✓
                            </span>
                          </button>
                        </div>
                      ) : (
	                        <section className="order-30 mt-6 overflow-hidden border border-blue-100 bg-[#f4faff]">
	                          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
	                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
	                              <button
	                                className={appointmentSectionTitleButtonClass}
	                                onClick={() =>
	                                  setExpandedVisitNotesAppointmentId(null)
	                                }
	                                title="Close Visit notes"
	                                type="button"
	                              >
	                                Visit notes
	                                <span
	                                  aria-hidden="true"
	                                  className="text-sm leading-none text-blue-950"
	                                >
	                                  ✓
	                                </span>
	                              </button>
	                            </div>
	                            {!isEditingNote && !isArchived ? (
	                              <button
	                                aria-label="Edit visit notes"
	                                className={appointmentToolIconButtonClass}
	                                onClick={() =>
	                                  startEditingNote(appointment.id, note)
	                                }
	                                title="Edit visit notes"
	                                type="button"
	                              >
	                                <PencilSquareIcon className="h-5 w-5" />
	                              </button>
	                            ) : null}
	                          </div>
	                          <div className="border-t border-blue-100/70 p-4">
	                            <div className="grid gap-4">
	                              {note.summary_short ? (
	                                <section className="px-2 py-1 sm:px-3">
	                                  <h4 className="font-semibold text-slate-900">
	                                    Visit summary
                                  </h4>
                                  <p className="mt-1 text-slate-700">
                                    {note.summary_short}
                                  </p>
                                </section>
                              ) : null}
	                              <div className="grid gap-4 md:grid-cols-2">
	                                <section className="px-2 py-1 sm:px-3">
	                                  <h4 className="font-semibold text-slate-900">
	                                    Takeaways
                                  </h4>
                                  <DetailList
                                    emptyLabel="No takeaways saved yet."
                                    items={takeaways}
                                  />
                                </section>
	                                <section className="px-2 py-1 sm:px-3">
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
                      )
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

                    {shouldShowCarePrep &&
                    (hasCarePrepAvailable ||
                      canGenerateCarePrep ||
                      generatingCarePrepForId === appointment.id ||
                      carePrepGenerationError) ? (
                      <>
                        {!isCarePrepExpanded ? (
                          <div className="order-20 mt-5 flex flex-wrap items-center gap-3">
                            <button
                              className={`${appointmentSectionButtonClass} gap-1.5`}
                              disabled={generatingCarePrepForId === appointment.id}
                              onClick={() => {
                                if (hasCarePrepAvailable) {
                                  setExpandedCarePrepIds((currentIds) => ({
                                    ...currentIds,
                                    [appointment.id]: true,
                                  }));
                                  return;
                                }

                                handleGenerateCarePrep(appointment);
                              }}
                              title="Open CarePrep"
                              type="button"
                            >
                              CarePrep
                              {hasCarePrepAvailable ? (
                                <span
                                  aria-hidden="true"
                                  className="text-sm leading-none text-blue-950"
                                >
                                  ✓
                                </span>
                              ) : null}
                            </button>
                            {generatingCarePrepForId === appointment.id ? (
                              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
                                Generating...
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {carePrepGenerationError && !isCarePrepExpanded ? (
                          <p className="order-20 mt-3 rounded-md border border-blue-200 bg-[#f4faff] px-3 py-2 text-sm font-medium text-blue-950">
                            {carePrepGenerationError}
                          </p>
                        ) : null}
                        {isCarePrepExpanded && prep?.summary ? (
                          <section className="order-20 mt-6 overflow-hidden border border-blue-100 bg-[#f4faff]">
                            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
	                              <div className="flex flex-wrap items-center gap-2">
	                                <button
	                                  className={`${appointmentSectionTitleButtonClass} gap-1.5`}
                                  onClick={() =>
                                    setExpandedCarePrepIds((currentIds) => ({
                                      ...currentIds,
                                      [appointment.id]: false,
                                    }))
                                  }
                                  title="Close CarePrep"
                                  type="button"
                                >
                                  CarePrep
                                  <span
                                    aria-hidden="true"
                                    className="text-sm leading-none text-blue-950"
                                  >
                                    ✓
	                                  </span>
	                                </button>
	                              </div>
	                              {!isArchived && !isEditingCarePrep ? (
	                                <div className="flex items-center gap-2">
	                                  <button
	                                    aria-label="Edit CarePrep"
	                                    className={appointmentToolIconButtonClass}
	                                    onClick={() =>
	                                      startEditingCarePrep(appointment.id, prep)
	                                    }
	                                    title="Edit CarePrep"
	                                    type="button"
	                                  >
	                                    <PencilSquareIcon className="h-5 w-5" />
	                                  </button>
	                                  <button
	                                    aria-label="Refresh CarePrep"
	                                    className={appointmentToolIconButtonClass}
	                                    disabled={
	                                      generatingCarePrepForId === appointment.id
	                                    }
	                                    onClick={() =>
	                                      handleGenerateCarePrep(appointment)
	                                    }
	                                    title="Refresh CarePrep"
	                                    type="button"
	                                  >
	                                    <RefreshCircleIcon className="h-5 w-5" />
	                                  </button>
	                                </div>
	                              ) : null}
	                            </div>
                            {generatingCarePrepForId === appointment.id ? (
                              <span className="mx-4 mb-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-900">
                                Generating...
                              </span>
                            ) : null}
                            {carePrepGenerationError ? (
                              <p className="mx-4 mb-3 rounded-md border border-blue-200 bg-[#f4faff] px-3 py-2 text-sm font-medium text-blue-950">
                                {carePrepGenerationError}
                              </p>
                            ) : null}
                            {isEditingCarePrep ? (
                              <div className="grid gap-4 border-t border-blue-100/70 p-4">
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
                                disabled={savingCarePrepForId === appointment.id}
                                onClick={() =>
                                  saveCurrentCarePrepEdit(appointment.id, prep)
                                }
                                type="button"
                              >
                                {savingCarePrepForId === appointment.id
                                  ? "Saving..."
                                  : "Save CarePrep edit"}
                              </button>
                              <button
                                className={`${gentleSecondaryButtonClass} text-sm`}
                                onClick={() =>
                                  cancelEditingCarePrep(appointment.id)
                                }
                                type="button"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="border-t border-blue-100/70 p-4">
                            <div className="grid gap-4">
                              <section className="px-2 py-1 sm:px-3">
                                <h4 className="font-semibold text-slate-900">
                                  Summary
                                </h4>
                                <p className="mt-1 text-slate-700">
                                  {prep.summary}
                                </p>
                              </section>

                              <div className="grid gap-4 lg:grid-cols-3">
                              <section className="px-2 py-1 sm:px-3">
                                <h4 className="font-semibold text-slate-900">
                                  Bring
                                </h4>
                                <DetailList
                                  emptyLabel="No bring-list items saved yet."
                                  items={bringList}
                                />
                              </section>

                              <section className="px-2 py-1 sm:px-3">
                                <h4 className="font-semibold text-slate-900">Ask</h4>
                                <DetailList
                                  emptyLabel="No questions saved yet."
                                  items={questions}
                                />
                              </section>

                              <section className="px-2 py-1 sm:px-3">
                                <h4 className="font-semibold text-slate-900">
                                  Watch for
                                </h4>
                                <DetailList
                                  emptyLabel="No watchouts saved yet."
                                  items={watchouts}
                                />
                              </section>
                            </div>

                            {(medReview.length > 0 || sinceLastVisit.length > 0) && (
                              <div className="grid gap-4 md:grid-cols-2">
                                <section className="px-2 py-1 sm:px-3">
                                  <h4 className="font-semibold text-slate-900">
                                    Medication review
                                  </h4>
                                  <DetailList
                                    emptyLabel="No medication review items saved yet."
                                    items={medReview}
                                  />
                                </section>

                                <section className="px-2 py-1 sm:px-3">
                                  <h4 className="font-semibold text-slate-900">
                                    Since last visit
                                  </h4>
                                  <DetailList
                                    emptyLabel="No prior-visit context saved yet."
                                    items={sinceLastVisit}
                                  />
                                </section>
                              </div>
                            )}
                            </div>
                          </div>
                        )}
                      </section>
                        ) : null}
                      </>
                    ) : null}

	                    {appointment.provider_name || appointmentSubject ? (
	                      <div className="order-40 mt-7 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-medium text-[#767676]">
	                        <span>{appointment.provider_name || ""}</span>
	                        {appointmentSubject ? (
	                          <span>for {appointmentSubject}</span>
	                        ) : null}
	                      </div>
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
      {canUseAskPanel && askPanelOpen ? (
        <>
	          <button
	            aria-label="Close Ask panel"
	            className="fixed inset-0 z-[65] cursor-default bg-transparent"
	            onClick={requestCloseAskPanel}
	            type="button"
	          />
	          <section
	            aria-label="Ask panel"
	            className="fixed inset-x-3 top-16 z-[70] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-xl sm:left-auto sm:right-5 sm:top-20 sm:w-[min(32rem,calc(100vw-2.5rem))]"
	          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Ask</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  {askConversationComplete
                    ? appContentText(askCompletionMessageKey)
                    : appContentText("ask_guidance_message")}
                </p>
	              </div>
		              <button
		                className={gentleSmallSecondaryButtonClass}
		                onClick={requestCloseAskPanel}
		                type="button"
		              >
	                Close
	              </button>
	            </div>

            {askCloseConfirmOpen ? (
              <section className="mt-4 rounded-xl border border-blue-200 bg-[#f4faff] p-3 shadow-sm">
                <p className="text-sm font-medium text-blue-950">
                  This Ask has unsent text or an active conversation. Close it
                  and discard what is here?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className={gentlePrimaryButtonClass}
                    onClick={resetAskPanelState}
                    type="button"
                  >
                    Discard and close
                  </button>
                  <button
                    className={gentleSmallSecondaryButtonClass}
                    onClick={() => setAskCloseConfirmOpen(false)}
                    type="button"
                  >
                    Keep writing
                  </button>
                </div>
              </section>
            ) : null}

	            {askMessages.length > 0 ? (
              <div className="mt-6 space-y-2">
                {askMessages.map((askMessage, index) => (
                  <div
	                    className={`max-w-[min(100%,42rem)] rounded-xl px-4 py-3 text-sm leading-relaxed ${
	                      askMessage.role === "user"
	                        ? "ml-auto border border-blue-100 bg-blue-50 text-slate-950"
	                        : "border border-blue-100 bg-white/85 text-slate-700"
	                    }`}
                    key={`${askMessage.role}-${index}`}
                  >
                    <p className="whitespace-pre-wrap">{askMessage.body}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {askPanelError ? (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
                {askPanelError}
              </p>
            ) : null}

            {!askConversationComplete ? (
              <form className="mt-8" onSubmit={handleSendAskMessage}>
                <label className="sr-only" htmlFor="ask-message">
                  Ask a question, share an idea, or describe a problem
                </label>
	                <textarea
	                  className="min-h-36 w-full rounded-xl border border-[#d8e0dc] bg-white px-4 py-4 text-base leading-relaxed text-slate-900 shadow-inner outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
	                  disabled={sendingAskMessage}
	                  id="ask-message"
	                  onChange={(event) => {
	                    setAskInput(event.target.value);
	                    setAskCloseConfirmOpen(false);
	                  }}
	                  placeholder="Ask a question, share an idea, or describe a problem"
	                  value={askInput}
	                />
	                <div className="mt-3 flex items-center justify-end">
	                  <button
	                    className={`${gentlePrimaryButtonClass} px-5 py-2.5 text-sm`}
	                    disabled={sendingAskMessage || !askInput.trim()}
	                    type="submit"
	                  >
                    {sendingAskMessage ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        </>
	      ) : null}
	      {signOutConfirmOpen ? (
	        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/20 px-4 py-6">
	          <button
	            aria-label="Review unsaved changes"
	            className="absolute inset-0 cursor-default"
	            onClick={() => setSignOutConfirmOpen(false)}
	            type="button"
	          />
	          <section className="relative w-full max-w-lg rounded-xl border border-blue-200 bg-[#f4faff] p-5 text-blue-950 shadow-lg">
	            <div>
	              <h2 className="text-xl font-semibold text-slate-950">
	                You have unsaved changes
	              </h2>
	              <p className="mt-2 text-sm leading-6 text-slate-700">
	                Signing out will discard this work.
	              </p>
	            </div>
	            {unsavedSignOutChanges.length > 0 ? (
	              <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
	                {unsavedSignOutChanges.map((change) => (
	                  <li
	                    className="rounded-lg border border-blue-100 bg-white/75 px-3 py-2 text-sm"
	                    key={change.key}
	                  >
	                    <span className="font-semibold text-slate-950">
	                      {change.label}
	                    </span>
	                    {change.detail ? (
	                      <span className="ml-2 text-slate-600">
	                        {change.detail}
	                      </span>
	                    ) : null}
	                  </li>
	                ))}
	              </ul>
	            ) : null}
	            <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
	              <button
	                className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 transition hover:bg-blue-100/70 hover:text-blue-900"
	                onClick={() => setSignOutConfirmOpen(false)}
	                type="button"
	              >
	                Go back
	              </button>
	              <button
	                className={gentleWarmButtonClass}
	                onClick={() =>
	                  void handleSignOut({ bypassUnsavedChangesWarning: true })
	                }
	                type="button"
	              >
	                Discard and sign out
	              </button>
	            </div>
	          </section>
	        </div>
	      ) : null}
	      <button
	        className="fixed bottom-2 left-2 z-[60] rounded px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
        onClick={() => setShowVersionInfo(true)}
        title="Show version info"
        type="button"
      >
        Version
      </button>
      {showVersionInfo ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/20 px-4 py-6">
          <button
            aria-label="Close version information"
            className="absolute inset-0 cursor-default"
            onClick={() => setShowVersionInfo(false)}
            type="button"
          />
          <section className="relative w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                  CarePland
                </p>
                <h2 className="mt-1 text-xl font-semibold">Version info</h2>
              </div>
              <button
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
                onClick={() => setShowVersionInfo(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-slate-500">Build number</dt>
                <dd className="mt-1 break-all font-mono text-slate-950">
                  {careplandBuildNumber}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Build time</dt>
                <dd className="mt-1 text-slate-950">{careplandBuildDttm}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Environment</dt>
                <dd className="mt-1 text-slate-950">
                  {runtimeEnvironmentLabel || "Production"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Host</dt>
                <dd className="mt-1 break-all text-slate-950">
                  {typeof window === "undefined"
                    ? "Unknown"
                    : window.location.hostname}
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-xs text-slate-500">
              Shortcut: Ctrl+Alt+V or Cmd+Option+V. Escape closes this panel.
            </p>
          </section>
        </div>
      ) : null}
      {locationSheetAppointment ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/20 px-3 pb-3">
          <button
            aria-label="Close location details"
            className="absolute inset-0 cursor-default"
            onClick={() => setLocationSheetAppointmentId(null)}
            type="button"
          />
          <section className="relative mx-auto w-full max-w-[900px] rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  {locationSheetPracticeLabel || "Appointment location"}
                </h2>
                {locationSheetAppointment.provider_name ? (
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {locationSheetAppointment.provider_name}
                  </p>
                ) : null}
              </div>
              <button
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
                onClick={() => setLocationSheetAppointmentId(null)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              {locationSheetAppointment.location_address ? (
                <p>{locationSheetAppointment.location_address}</p>
              ) : null}
              {locationSheetAppointment.location_phone ? (
                <p>{locationSheetAppointment.location_phone}</p>
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {locationSheetMapsLink ? (
                <a
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                  href={locationSheetMapsLink}
                  rel="noreferrer"
                  target="_blank"
                >
                  Maps
                </a>
              ) : null}
              {locationSheetPhoneHref ? (
                <a
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  href={locationSheetPhoneHref}
                >
                  Call
                </a>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
