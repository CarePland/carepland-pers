"use client";

import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AIReviewBadge, aiReviewLevel } from "./components/AIReviewBadge";

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
};

type NotesReminderAppointment = Appointment & {
  care_circle_id: string;
};

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

type SupportTicket = {
  id: string;
  category: string;
  created_at: string;
  current_page: string | null;
  needs_admin_followup: boolean;
  priority: SupportTicketPriority;
  profiles?: {
    display_name: string | null;
    email: string | null;
    family_name: string | null;
    given_name: string | null;
  } | null;
  status: SupportTicketStatus;
  subject: string;
  updated_at: string;
  user_has_unread_update: boolean;
  user_id: string;
};

type SupportTicketMessage = {
  id: string;
  author_role: "admin" | "system" | "user";
  created_at: string;
  is_internal: boolean;
  message_body: string;
  ticket_id: string;
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

type AppointmentView = "archived" | "logged" | "upcoming";
type AiAdminTab = "history" | "instructions";
type AdminTab =
  | "ai"
  | "assistantReview"
  | "content"
  | "messages"
  | "product"
  | "tickets"
  | "tools";
type AiWorkflowKey =
  | "bulk_appointment_intake"
  | "careprep_generation"
  | "note_intake_interpretation"
  | "support_assistant";
type AuthMode = "reset" | "signIn" | "signUp" | "updatePassword";
type AppointmentPanel = "add" | "quickAdd";
type AppointmentModifier = "add" | "edit" | "import";
type MainTab = "admin" | "appointments" | "profile";
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
type SupportTicketStatus =
  | "closed"
  | "in_progress"
  | "open"
  | "resolved"
  | "waiting_on_user";
type SupportTicketPriority = "high" | "low" | "medium" | "urgent";

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
  target: AppointmentModifier;
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
  adminTab?: AdminTab;
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

const ALL_SUBJECTS = "all";
const appUiStateStorageKey = "carepland-ui-state:v1";
const appDraftStateStorageKey = "carepland-draft-state:v1";

const defaultEntitlement: CareCircleEntitlement = {
  max_active_subjects: 1,
  plan_id: "personal",
  plan_name: "Personal",
};

const appContentDefaults = {
  beta_disclaimer_ack:
    "I understand this beta is not for emergencies or critical medical decisions.",
  beta_notice_intro:
    "CarePland Personal is currently in testing. Formal Terms of Service and Privacy Policy pages are not enabled yet.",
  beta_privacy_ack:
    "I understand formal Privacy Policy review is not currently enabled for this testing version.",
  beta_terms_ack:
    "I understand formal Terms of Service are not currently enabled for this testing version.",
  demo_profile_add_body:
    "Add a few fictional appointments, notes, and CarePrep examples if you want a guided workspace to explore.",
  demo_profile_remove_body:
    "Demo appointments are not real appointments. Removing demo data deletes only items marked as demo data and keeps your real information.",
  demo_prompt_body:
    "Add a few demo appointments, notes, and CarePrep examples. You can skip this if you want to start clean.",
  demo_prompt_title: "Want demo data to explore?",
  support_contact_note:
    "Need help or want to report an issue? Contact support from the app and include what you were trying to do.",
  support_missing_feedback_prompt: "What was missing?",
  welcome_guide_body:
    "Start with an appointment, import appointment text or images, or contact support if something feels off.",
  welcome_guide_title: "Welcome to the CarePland beta",
};

const appContentOptions = [
  {
    category: "beta",
    contentKey: "beta_notice_intro",
    description: "Introductory text shown before beta acknowledgement checkboxes.",
    label: "Beta testing notice intro",
  },
  {
    category: "beta",
    contentKey: "beta_terms_ack",
    description: "Checkbox text confirming Terms of Service status during beta.",
    label: "Beta terms acknowledgement",
  },
  {
    category: "beta",
    contentKey: "beta_privacy_ack",
    description: "Checkbox text confirming Privacy Policy status during beta.",
    label: "Beta privacy acknowledgement",
  },
  {
    category: "beta",
    contentKey: "beta_disclaimer_ack",
    description: "Checkbox text confirming beta safety limitations.",
    label: "Beta safety acknowledgement",
  },
  {
    category: "support",
    contentKey: "support_contact_note",
    description: "General support context for beta users.",
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
];

const appContentCategories = [
  {
    description: "Testing notices, temporary legal acknowledgements, and safety language.",
    key: "beta",
    label: "Beta and legal",
  },
  {
    description: "Support guidance and help text shown to users.",
    key: "support",
    label: "Support",
  },
  {
    description: "First-run guidance, demo data prompts, and welcome copy.",
    key: "onboarding",
    label: "Onboarding",
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
    description: "Must-have items before inviting beta testers over Memorial Day weekend.",
    key: "beta",
    label: "Beta Readiness",
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
const welcomeGuideStoragePrefix = "carepland-welcome-guide-dismissed:";

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

const aiWorkflows: Record<
  AiWorkflowKey,
  {
    defaultChangeNote: string;
    defaultSchema: unknown;
    description: string;
    historyLabel: string;
    label: string;
  }
> = {
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
  if (appUrl) {
    return appUrl;
  }

  if (typeof window === "undefined") {
    return undefined;
  }

  if (window.location.hostname === "localhost") {
    return undefined;
  }

  return window.location.origin;
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

function clearPasswordRecoveryUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const cleanedUrl = new URL(window.location.href);
  cleanedUrl.searchParams.delete("auth_action");
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
    <section className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
      <h4 className="font-semibold text-amber-950">
        Appointment details found
      </h4>
      <div className="mt-2 space-y-2 text-sm text-amber-950">
        {changes.map((change) => (
          <p key={change.field}>
            <span className="font-semibold">{change.label}:</span>{" "}
            {change.currentValue || "Blank"} -&gt; {change.newValue}
          </p>
        ))}
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-amber-950">
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
    systemPrompt: version?.system_prompt ?? "",
    userPrompt: version?.user_prompt_template ?? "",
  };
}

function supportMailtoHref(
  userEmail: string | null,
  area = "CarePland beta",
  includeRuntimeContext = true
) {
  const subject = `CarePland beta support: ${area}`;
  const body = [
    "Hi CarePland support,",
    "",
    "I need help with:",
    "",
    "",
    "---",
    `User email: ${userEmail ?? "not signed in"}`,
    ...(includeRuntimeContext
      ? [
          `Timestamp: ${new Date().toISOString()}`,
          `Time zone: ${browserTimezone() || "unknown"}`,
        ]
      : []),
    `Area: ${area}`,
  ].join("\n");

  return `mailto:support@carepland.com?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
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

function welcomeGuideWasDismissed(email: string | null) {
  if (!email || typeof window === "undefined") {
    return false;
  }

  return (
    window.localStorage.getItem(`${welcomeGuideStoragePrefix}${email}`) ===
    "true"
  );
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

export default function Home() {
  const mainHeaderRef = useRef<HTMLElement | null>(null);
  const [stickySecondaryOffset, setStickySecondaryOffset] = useState(0);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [runtimeEnvironmentLabel, setRuntimeEnvironmentLabel] = useState("");
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
  const [activeAppointmentPanel, setActiveAppointmentPanel] =
    useState<AppointmentPanel | null>(
      initialUiState?.activeAppointmentPanel ?? null
    );
  const [mainTab, setMainTab] = useState<MainTab>(
    initialUiState?.mainTab ?? "appointments"
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
    initialUiState?.adminTab ?? "tools"
  );
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
  const [editingAppointmentIds, setEditingAppointmentIds] = useState<
    Record<string, boolean>
  >(initialDraftState?.editingAppointmentIds ?? {});
  const [editingNoteIds, setEditingNoteIds] = useState<Record<string, boolean>>(
    initialDraftState?.editingNoteIds ?? {}
  );
  const [pendingModifierSwitch, setPendingModifierSwitch] =
    useState<PendingModifierSwitch | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [processingTextIntake, setProcessingTextIntake] = useState(false);
  const [extractingImageText, setExtractingImageText] = useState(false);
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
  const [savingNoteForId, setSavingNoteForId] = useState<string | null>(null);
  const [generatingCarePrepForId, setGeneratingCarePrepForId] = useState<
    string | null
  >(null);
  const [savingCarePrepForId, setSavingCarePrepForId] = useState<string | null>(
    null
  );
  const [discardingCarePrepForId, setDiscardingCarePrepForId] = useState<
    string | null
  >(null);
  const [profileDraft, setProfileDraft] =
    useState<ProfileDraft>(emptyProfileDraft);
  const [savedProfileLabel, setSavedProfileLabel] = useState("");
  const [sampleDataSeededAt, setSampleDataSeededAt] = useState<string | null>(
    null
  );
  const [sampleDataDeclinedAt, setSampleDataDeclinedAt] = useState<
    string | null
  >(null);
  const [sampleDataSeedVersion, setSampleDataSeedVersion] = useState<
    string | null
  >(null);
  const [seedingSampleData, setSeedingSampleData] = useState(false);
  const [decliningSampleData, setDecliningSampleData] = useState(false);
  const [removingSampleData, setRemovingSampleData] = useState(false);
  const [adminSampleEmail, setAdminSampleEmail] = useState("");
  const [adminSampleStatus, setAdminSampleStatus] =
    useState<SampleDataStatus | null>(null);
  const [adminSampleForceDeclined, setAdminSampleForceDeclined] =
    useState(false);
  const [loadingAdminSampleStatus, setLoadingAdminSampleStatus] =
    useState(false);
  const [seedingAdminSampleData, setSeedingAdminSampleData] = useState(false);
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
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingPasswordReset, setSendingPasswordReset] = useState(false);
  const [welcomeGuideDismissed, setWelcomeGuideDismissed] = useState(false);
  const [restoringAppointmentForId, setRestoringAppointmentForId] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
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
  const selectedAssistantAnalysisRun =
    assistantAnalysisRuns.find((run) => run.id === selectedAssistantAnalysisRunId) ??
    assistantAnalysisRuns[0] ??
    null;

  function appContentText(key: keyof typeof appContentDefaults) {
    return currentAppContentByKey.get(key)?.body ?? appContentDefaults[key];
  }

  const notesByAppointment = useMemo(() => {
    return new Map(notes.map((note) => [note.appointment_id, note]));
  }, [notes]);

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
  const canUseMultipleCareVips = careVipLimit > 1;
  const canAddCareVip = careSubjects.length < careVipLimit;
  const hasAcceptedBetaAgreement =
    Boolean(betaDisclaimerAcknowledgedAt) &&
    Boolean(betaPrivacyAcknowledgedAt) &&
    Boolean(betaTermsAcknowledgedAt);
  const needsBetaAgreement =
    Boolean(signedInEmail) && !hasAcceptedBetaAgreement;
  const needsOnboarding =
    Boolean(signedInEmail) && hasAcceptedBetaAgreement && !onboardingCompletedAt;
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
    mainTab === "appointments" &&
    !welcomeGuideDismissed;
  const shouldOfferSampleData =
    Boolean(signedInEmail) &&
    !needsBetaAgreement &&
    !needsOnboarding &&
    !sampleDataSeededAt &&
    !sampleDataDeclinedAt;

  async function establishPasswordRecoverySession(): Promise<string | null> {
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
      setHasHydrated(true);
      setRuntimeEnvironmentLabel(
        nonProductionEnvironmentLabel(
          window.location.hostname,
          process.env.NEXT_PUBLIC_CAREPLAND_ENV
        )
      );
    }, 0);

    async function restoreSession() {
      const isRecoveryRedirect = isPasswordRecoveryRedirect();

      if (isRecoveryRedirect) {
        setLoading(true);

        try {
          const recoveryEmail = await establishPasswordRecoverySession();

          if (recoveryEmail) {
            setSignedInEmail(recoveryEmail);
            setWelcomeGuideDismissed(welcomeGuideWasDismissed(recoveryEmail));
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
        }

        return;
      }

      const { data } = await supabase.auth.getSession();
      const sessionEmail = data.session?.user.email ?? null;

      if (sessionEmail) {
        setSignedInEmail(sessionEmail);
        setWelcomeGuideDismissed(welcomeGuideWasDismissed(sessionEmail));
        setEmail(sessionEmail);

        setLoading(true);

        try {
          await loadAppContent();
          await loadAppointments(
            initialUiState?.appointmentView,
            initialUiState?.selectedSubjectId
          );
          await loadCurrentUserSupportTickets();

          if (initialUiState?.mainTab === "admin") {
            if (initialUiState.adminTab === "ai") {
              await loadAiInstructions(initialUiState.selectedAiWorkflow);
            } else if (initialUiState.adminTab === "product") {
              await loadProductMgmt();
            } else if (initialUiState.adminTab === "tickets") {
              await loadAdminSupportTickets();
            } else if (
              initialUiState.adminTab === "content" ||
              initialUiState.adminTab === "messages"
            ) {
              await loadAppContent(initialUiState.selectedAppContentKey);
            }
          }
        } catch (error) {
          setMessage(getErrorMessage(error));
        } finally {
          setLoading(false);
        }
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

  function dismissWelcomeGuide() {
    if (signedInEmail) {
      window.localStorage.setItem(
        `${welcomeGuideStoragePrefix}${signedInEmail}`,
        "true"
      );
    }

    setWelcomeGuideDismissed(true);
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

    const profileEmail = user.email ?? signedInEmail ?? "";
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id,email,display_name,given_name,family_name,phone,phone_e164,timezone,address_line1,address_line2,city,region,postal_code,country,beta_terms_acknowledged_at,beta_privacy_acknowledged_at,beta_disclaimer_acknowledged_at,beta_agreement_version,onboarding_completed_at,is_admin,sample_data_seeded_at,sample_data_declined_at,sample_data_seed_version"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const loadedProfileDraft = profileDraftFromRow(profileRow, profileEmail);
    setProfileDraft(loadedProfileDraft);
    setSavedProfileLabel(profileDisplayName(loadedProfileDraft));
    const userIsAdmin = profileRow?.is_admin === true;
    setIsAdmin(userIsAdmin);
    if (userIsAdmin) {
      void loadAdminSupportTickets();
    }
    if (!userIsAdmin) {
      setMainTab((currentTab) =>
        currentTab === "admin" ? "appointments" : currentTab
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
    setSampleDataSeedVersion(
      typeof profileRow?.sample_data_seed_version === "string"
        ? profileRow.sample_data_seed_version
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
      setNotesReminderAppointment(null);
      setCareSubjects([]);
      setEntitlement(defaultEntitlement);
      setNotes([]);
      setGuidance([]);
      setCarePrepHistory([]);
      setHistoryAppointmentId("");
      setMessage("Review the beta testing notice to continue.");
      return;
    }

    if (!profileRow?.onboarding_completed_at) {
      setAppointments([]);
      setNotesReminderAppointment(null);
      setCareSubjects([]);
      setEntitlement(defaultEntitlement);
      setNotes([]);
      setGuidance([]);
      setCarePrepHistory([]);
      setHistoryAppointmentId("");
      setMessage("Finish profile setup to continue.");
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
      .select("id,care_subject_id,current_note_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone,is_sample_data")
      .in("care_circle_id", circleIds)
      .order("starts_at", { ascending: true });

    if (effectiveSubjectId !== ALL_SUBJECTS) {
      appointmentQuery = appointmentQuery.eq("care_subject_id", effectiveSubjectId);
    }

    let notesReminderQuery = supabase
      .from("appointments")
      .select("id,care_circle_id,care_subject_id,current_note_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone,is_sample_data")
      .in("care_circle_id", circleIds)
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

    setNotesReminderAppointment(reminderRows?.[0] ?? null);

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
    setAppointments(visibleAppointments);

    if (appointmentIds.length === 0) {
      setNotes([]);
      setGuidance([]);
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
      ]);

    if (notesError) {
      throw notesError;
    }

    if (guidanceError) {
      throw guidanceError;
    }

    setNotes(noteRows ?? []);
    setGuidance(guidanceRows ?? []);
    setMessage(`Loaded ${visibleAppointments.length} appointment(s).`);
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
      setSignedInEmail(trimmedEmail);
      setWelcomeGuideDismissed(welcomeGuideWasDismissed(trimmedEmail));
      await loadAppContent();
      await loadAppointments();
    } catch (error) {
      logAuthError("signIn", error);
      setMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
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
          emailRedirectTo: authRedirectUrl(),
        },
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        setSignedInEmail(trimmedEmail);
        setWelcomeGuideDismissed(welcomeGuideWasDismissed(trimmedEmail));
        setMessage("Account created and signed in. Finish profile setup to continue.");
        await loadAppContent();
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
        await establishPasswordRecoverySession();
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
      clearPasswordRecoveryUrl();
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

  async function handleRefresh() {
    setLoading(true);
    setMessage("");

    try {
      await loadAppointments();
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleChangeAppointmentView(view: AppointmentView) {
    setAppointmentView(view);
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
          "id,area_id,title,body,status,priority,current_version_number,created_at,updated_at,resolved_at"
        )
        .order("status", { ascending: true })
        .order("updated_at", { ascending: false });

      if (itemError) {
        throw itemError;
      }

      setProductMgmtItems((items ?? []) as ProductMgmtItem[]);
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
      setMessage(`Loaded ${historyRows?.length ?? 0} CarePrep history row(s).`);
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
      setMessage(`Loaded ${historyRows.length} intake history row(s).`);
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

    if (tab === "admin") {
      await Promise.all([loadAiInstructions(), loadAppContent()]);
    }
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
          "id,user_id,subject,status,priority,category,current_page,needs_admin_followup,user_has_unread_update,created_at,updated_at"
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

  function supportTicketUserLabel(ticket: SupportTicket) {
    const profile = ticket.profiles;
    const displayName = profile?.display_name?.trim();
    const fullName = [profile?.given_name, profile?.family_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    return displayName || fullName || profile?.email || ticket.user_id;
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
      const { error } = await supabase.rpc("add_support_ticket_message", {
        p_is_internal: false,
        p_message: adminTicketReplyBody,
        p_ticket_id: selectedAdminTicket.id,
      });

      if (error) {
        throw error;
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

    if (tab === "ai") {
      await loadAiInstructions();
    }

    if (tab === "content" || tab === "messages") {
      await loadAppContent();
    }

    if (tab === "product") {
      await loadProductMgmt();
    }

    if (tab === "tickets") {
      await loadAdminSupportTickets();
    }

    if (tab === "assistantReview") {
      await loadAssistantReviewInteractions();
    }
  }

  async function handleChangeAiAdminTab(tab: AiAdminTab) {
    setAiAdminTab(tab);

    if (tab === "instructions") {
      await loadAiInstructions();
    } else if (selectedAiWorkflow === "careprep_generation") {
      await loadCarePrepHistory();
    } else {
      await loadIntakeHistory();
    }
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

  async function handleSignOut() {
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
    setSampleDataSeedVersion(null);
    setAdminSampleEmail("");
    setAdminSampleStatus(null);
    setAdminSampleForceDeclined(false);
    setWelcomeGuideDismissed(false);
    setIsAdmin(false);
    setOnboardingCompletedAt(null);
    setProfileDraft(emptyProfileDraft);
    setSavedProfileLabel("");
    setAuthMode("signIn");
    setActiveAppointmentPanel(null);
    setMainTab("appointments");
    setPassword("");
    setConfirmPassword("");
    setAppointments([]);
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
    setMessage("Signed out.");
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
        throw new Error("Please acknowledge each beta testing item to continue.");
      }

      const acknowledgedAt = new Date().toISOString();
      const profileEmail = user.email ?? profileDraft.email.trim();
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
      showToast("Beta acknowledgement saved.", {
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

      const completedAt = new Date().toISOString();
      const storedDisplayName = profileDraft.displayName.trim() || null;
      const visibleDisplayName = profileDisplayName({
        displayName: profileDraft.displayName,
        email: profileEmail,
        familyName: profileDraft.familyName,
        givenName: profileDraft.givenName,
      });
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
        setSampleDataSeedVersion(status.seed_version ?? null);
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

  async function handleDeclineSampleData() {
    setDecliningSampleData(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "decline_sample_data_for_current_user"
      );

      if (error) {
        throw error;
      }

      const status = sampleDataStatusFromValue(data);
      setSampleDataDeclinedAt(status.declined_at ?? new Date().toISOString());
      showToast("Demo data skipped.", { type: "success" });
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setDecliningSampleData(false);
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
      setSampleDataSeedVersion(null);
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
    }
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

  function discardAndSwitchAppointmentModifier(appointment: Appointment) {
    if (!pendingModifierSwitch) {
      return;
    }

    const currentModifier = currentAppointmentModifier(appointment.id);

    discardAppointmentModifier(appointment.id, currentModifier);
    openAppointmentModifier(appointment, pendingModifierSwitch.target);
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
  }

  async function findTextIntakeMatches(
    draft: TextIntakeDraft,
    careCircleId: string,
    careSubjectId: string
  ): Promise<TextIntakeMatch[]> {
    const { data: appointmentRows, error: appointmentError } = await supabase
      .from("appointments")
      .select(
            "id,care_subject_id,current_note_id,title,reason,starts_at,status,archived_at,provider_name,provider_organization,location_name,location_address,location_phone"
      )
      .eq("care_circle_id", careCircleId)
      .eq("care_subject_id", careSubjectId)
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

      const { error } = await supabase.from("appointments").insert({
        care_circle_id: careCircleId,
        care_subject_id: careSubjectId,
        location_address: newAppointmentLocationAddress.trim() || null,
        location_name: newAppointmentLocationName.trim() || null,
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

      setNewAppointmentTitle("");
      setNewAppointmentReason("");
      setNewAppointmentStartsAt("");
      setNewAppointmentProviderName("");
      setNewAppointmentProviderOrganization("");
      setNewAppointmentLocationName("");
      setNewAppointmentLocationAddress("");
      setNewAppointmentLocationPhone("");
      setNewAppointmentSubjectId(careSubjectId);
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

  async function handleGenerateCarePrep(appointment: Appointment) {
    setGeneratingCarePrepForId(appointment.id);
    setMessage("");

    try {
      if (!appointment.care_subject_id) {
        throw new Error("This appointment needs a Care VIP before CarePrep can run.");
      }

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
        body: JSON.stringify({ appointmentId: appointment.id }),
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

      await loadAppointments();
      setMessage(result.message ?? "CarePrep generated with AI.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setGeneratingCarePrepForId(null);
    }
  }

  function carePrepFormValues(appointmentId: string, draft: CarePrepGuidance) {
    return {
      bringList:
        carePrepDrafts[appointmentId]?.bringList ??
        asTextList(draft.bring_list).join("\n"),
      keyQuestions:
        carePrepDrafts[appointmentId]?.keyQuestions ??
        asTextList(draft.key_questions).join("\n"),
      medReview:
        carePrepDrafts[appointmentId]?.medReview ??
        asTextList(draft.med_review).join("\n"),
      nextSteps:
        carePrepDrafts[appointmentId]?.nextSteps ??
        asTextList(draft.next_steps).join("\n"),
      sinceLastVisit:
        carePrepDrafts[appointmentId]?.sinceLastVisit ??
        asTextList(draft.since_last_visit).join("\n"),
      summary: carePrepDrafts[appointmentId]?.summary ?? draft.summary ?? "",
      watchouts:
        carePrepDrafts[appointmentId]?.watchouts ??
        asTextList(draft.watchouts).join("\n"),
    };
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
    action: "accept" | "discard" | "save_edit";
    appointmentId: string;
    draft: CarePrepGuidance;
  }) {
    if (action === "discard") {
      setDiscardingCarePrepForId(appointmentId);
    } else {
      setSavingCarePrepForId(appointmentId);
    }
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
      setMessage(result.message ?? "CarePrep reviewed.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingCarePrepForId(null);
      setDiscardingCarePrepForId(null);
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

  async function handleStartReminderNotes(appointment: NotesReminderAppointment) {
    setMessage("");
    startTypingNote(appointment.id);
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
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingNoteForId(null);
    }
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-slate-50 px-3 py-6 text-slate-900 sm:px-4 lg:px-6 lg:py-8">
      <section className="mx-auto w-full max-w-5xl 2xl:max-w-6xl">
        <header
          className="sticky top-0 z-50 flex flex-col gap-4 border-b border-slate-200 bg-slate-50/95 py-3 backdrop-blur lg:flex-row lg:items-center lg:justify-between"
          ref={mainHeaderRef}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Image
                alt="CarePland"
                className="h-auto w-24"
                height={100}
                priority
                src="/carepland-logo.png"
                width={160}
              />
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                Personal
              </span>
              {runtimeEnvironmentLabel ? (
                <span
                  className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900"
                  title="Non-production environment"
                >
                  {runtimeEnvironmentLabel}
                </span>
              ) : null}
            </div>

            {signedInEmail &&
            authMode !== "updatePassword" &&
            !needsBetaAgreement &&
            !needsOnboarding ? (
              <nav className="flex flex-wrap gap-2" aria-label="Main navigation">
              <button
                className={`rounded-md px-4 py-2 font-semibold ${
                  mainTab === "appointments"
                    ? "bg-blue-700 text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
                onClick={() => handleChangeMainTab("appointments")}
                type="button"
              >
                Appointments
              </button>
              <button
                className={`rounded-md px-4 py-2 font-semibold ${
                  mainTab === "profile"
                    ? "bg-blue-700 text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
                onClick={() => handleChangeMainTab("profile")}
                type="button"
              >
                Profile
              </button>
              {isAdmin ? (
                <button
                  className={`rounded-md px-4 py-2 font-semibold ${
                    mainTab === "admin"
                      ? "bg-blue-700 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  onClick={() => handleChangeMainTab("admin")}
                  type="button"
                >
                  Admin
                </button>
              ) : null}
              </nav>
            ) : null}
          </div>

          <div className="flex flex-col items-start gap-1 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-x-2 lg:text-right">
            {signedInEmail &&
            authMode !== "updatePassword" &&
            !needsBetaAgreement &&
            !needsOnboarding ? (
              <span>
                <span className="font-semibold text-slate-900">
                  Welcome, {savedProfileLabel || signedInEmail}
                </span>
                <span className="mx-2 text-slate-300">·</span>
                <span className="break-all">{signedInEmail}</span>
              </span>
            ) : null}
            {signedInEmail &&
            authMode !== "updatePassword" &&
            !needsBetaAgreement &&
            !needsOnboarding ? (
              <span className="hidden text-slate-300 sm:inline">·</span>
            ) : null}
            {signedInEmail &&
            authMode !== "updatePassword" &&
            !needsBetaAgreement &&
            !needsOnboarding ? (
              isAdmin ? (
                <button
                  className="font-semibold text-sky-800"
                  onClick={async () => {
                    setMainTab("admin");
                    await handleChangeAdminTab("tickets");
                  }}
                  type="button"
                >
                  Tix{" "}
                  <span
                    className={
                      adminTicketsNeedingFollowup.length > 0
                        ? "text-red-600"
                        : "text-slate-600"
                    }
                  >
                    {adminTicketsNeedingFollowup.length}
                  </span>
                  /{adminOpenTickets.length}
                </button>
              ) : (
                <button
                  className="font-semibold text-blue-700"
                  onClick={() => {
                    setAskingSupportQuestion(true);
                    setSupportQuestionExpanded(true);
                  }}
                  type="button"
                >
                  Get help
                </button>
              )
            ) : (
              <a
                className="font-semibold text-blue-700"
                href={supportMailtoHref(
                  signedInEmail,
                  hasHydrated ? mainTab : "CarePland beta",
                  hasHydrated
                )}
              >
                Support
              </a>
            )}
          </div>
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
                  clearPasswordRecoveryUrl();
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
                <h2 className="text-2xl font-semibold">Beta testing notice</h2>
                <p className="mt-1 max-w-3xl text-slate-600">
                  {appContentText("beta_notice_intro")}
                </p>
              </div>
              <button
                className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                onClick={handleSignOut}
                type="button"
              >
                Sign out
              </button>
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
                  Confirm the basics CP Pers needs for dates, contact, and later
                  billing setup.
                </p>
              </div>
              <button
                className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                onClick={handleSignOut}
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
                <div className="mt-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-base text-slate-700">
                  {verifiedAccountEmail || "Verified account email"}
                </div>
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
        ) : mainTab === "profile" ? (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Profile</h2>
                <p className="mt-1 text-slate-600">
                  Account details, contact basics, and current CarePland plan.
                </p>
              </div>
              <button
                className="rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                onClick={handleSignOut}
                type="button"
              >
                Sign out
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Current plan</p>
                <p className="mt-2">
                  {entitlement.plan_name} · Care VIPs {careSubjects.length}/
                  {careVipLimit}
                </p>
                {sampleDataSeededAt ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Demo data: {sampleDataSeedVersion ?? "added"}
                  </p>
                ) : null}
              </div>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Plan changes</p>
                <button
                  className="mt-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
                  onClick={() =>
                    setMessage("Plan changes are not wired up yet.")
                  }
                  type="button"
                >
                  Change plan
                </button>
              </div>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Beta support</p>
                <p className="mt-2 text-slate-600">
                  {appContentText("support_contact_note")}
                </p>
                <a
                  className="mt-2 inline-block rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
                  href={supportMailtoHref(signedInEmail, "profile")}
                >
                  Contact support
                </a>
              </div>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Account security</p>
                <button
                  className="mt-2 rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 disabled:bg-slate-200"
                  disabled={sendingPasswordReset}
                  onClick={handleSendProfilePasswordReset}
                  type="button"
                >
                  {sendingPasswordReset ? "Sending..." : "Send reset email"}
                </button>
              </div>
            </div>

            {sampleDataSeededAt ? (
              <section className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-amber-950">
                      Demo data
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm text-amber-900">
                      {appContentText("demo_profile_remove_body")}
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 disabled:text-slate-400"
                    disabled={removingSampleData}
                    onClick={handleRemoveSampleData}
                    type="button"
                  >
                    {removingSampleData ? "Removing..." : "Remove demo data"}
                  </button>
                </div>
              </section>
            ) : (
              <section className="mt-5 rounded-md border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Demo data
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm text-slate-600">
                      {appContentText("demo_profile_add_body")}
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                    disabled={seedingSampleData}
                    onClick={() => handleSeedSampleDataForCurrentUser(true)}
                    type="button"
                  >
                    {seedingSampleData ? "Adding..." : "Add demo data"}
                  </button>
                </div>
              </section>
            )}

            {canUseMultipleCareVips ? (
              <section className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4">
                <h3 className="text-lg font-semibold">Care VIPs</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Manage the people, pets, and important lives connected to this
                  account.
                </p>
                {careSubjects.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {careSubjects.map((subject) => (
                      <span
                        className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
                        key={subject.id}
                      >
                        {subject.display_name}
                      </span>
                    ))}
                  </div>
                ) : null}
                <form
                  className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
                  onSubmit={handleCreateCareVip}
                >
                  <label className="block text-sm font-medium text-slate-700">
                    Add Care VIP
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                      disabled={!canAddCareVip}
                      onChange={(event) =>
                        setNewCareVipName(event.target.value)
                      }
                      placeholder="e.g. Dixie"
                      type="text"
                      value={newCareVipName}
                    />
                  </label>
                  <button
                    className="self-end rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                    disabled={creatingCareVip || !canAddCareVip}
                    type="submit"
                  >
                    {creatingCareVip ? "Adding..." : "+ Add Care VIP"}
                  </button>
                </form>
                {!canAddCareVip ? (
                  <p className="mt-3 text-sm text-slate-500">
                    {entitlement.plan_name} includes {careVipLimit} active Care
                    VIPs.
                  </p>
                ) : null}
              </section>
            ) : null}

            <form
              className="mt-6 grid gap-4 md:grid-cols-2"
              onSubmit={handleSaveProfile}
            >
              <label className="block text-sm font-medium text-slate-700">
                <span className="flex items-center justify-between gap-3">
                  <span>Email</span>
                  <span className="text-xs font-normal text-slate-400">
                    required
                  </span>
                </span>
                <div className="mt-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-base text-slate-700">
                  {verifiedAccountEmail || "Verified account email"}
                </div>
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
                  className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                  disabled={savingProfile}
                  type="submit"
                >
                  {savingProfile ? "Saving..." : "Save profile"}
                </button>
              </div>
            </form>

            {message ? (
              <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            ) : null}
          </section>
        ) : (
        <div className="mt-8 space-y-4">
          <aside
            className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${
              signedInEmail ? "hidden" : "mx-auto max-w-xl"
            }`}
          >
            {signedInEmail ? (
              <div>
                <h2 className="text-xl font-semibold">Signed in</h2>
                <p className="mt-2 break-words text-slate-600">{signedInEmail}</p>
                <div className="mt-5 space-y-3">
                  <button
                    className="w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                    disabled={loading}
                    onClick={handleRefresh}
                    type="button"
                  >
                    {loading ? "Refreshing..." : "Refresh appointments"}
                  </button>
                </div>
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
                <h2 className="text-xl font-semibold">
                  {authMode === "signUp"
                    ? "Create account"
                    : authMode === "reset"
                      ? "Reset password"
                      : "Sign in"}
                </h2>
                <label className="mt-5 block text-sm font-medium text-slate-700">
                  Email
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                  className="mt-5 w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
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
                <div className="mt-4 space-y-2 text-sm">
                  {authMode !== "signIn" ? (
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
                    <>
                      <button
                        className="block font-semibold text-blue-700"
                        onClick={() => {
                          setAuthMode("signUp");
                          setMessage("");
                        }}
                        type="button"
                      >
                        Don&apos;t have an account? Sign up
                      </button>
                      <button
                        className="block font-semibold text-blue-700"
                        onClick={() => {
                          setAuthMode("reset");
                          setMessage("");
                        }}
                        type="button"
                      >
                        Forgot your password?
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}

            <div className="mt-6 rounded-md bg-slate-100 p-4 text-sm text-slate-700">
              <p className="font-semibold">Current slice</p>
              <p className="mt-1">
                Create appointments and view note synthesis plus CarePrep
                guidance.
              </p>
              {signedInEmail ? (
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Plan: {entitlement.plan_name} · Care VIPs{" "}
                  {careSubjects.length}/{careVipLimit}
                </p>
              ) : null}
            </div>

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
                      className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
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
                        className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                        disabled={savingTextIntake}
                        type="submit"
                      >
                        {savingTextIntake ? "Saving..." : "Save intake"}
                      </button>
                      <button
                        className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
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
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Title
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                    onChange={(event) => setNewAppointmentTitle(event.target.value)}
                    placeholder="e.g. Follow-up with Dr. Smith"
                    type="text"
                    value={newAppointmentTitle}
                  />
                </label>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Date & time
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                    className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                    onChange={(event) => setNewAppointmentReason(event.target.value)}
                    placeholder="What is this appointment for?"
                    value={newAppointmentReason}
                  />
                </label>
                <button
                  className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                  disabled={creatingAppointment}
                  type="submit"
                >
                  {creatingAppointment ? "Adding..." : "+ Add appointment"}
                </button>
              </form>
            ) : null}

            {message ? (
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
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : toast.type === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-950"
                      : toast.type === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-950"
                        : "border-blue-200 bg-blue-50 text-blue-950"
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

            {signedInEmail && message ? (
              <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            ) : null}

            {signedInEmail &&
            !needsBetaAgreement &&
            !needsOnboarding ? (
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
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
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
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
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
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
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
                            className="mt-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
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
                                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                                    disabled={savingSupportAssistantFeedback}
                                    onClick={() => handleSupportAssistantFeedback("helpful")}
                                    type="button"
                                  >
                                    Helpful
                                  </button>
                                  <button
                                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
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
                                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                                  disabled={savingSupportAssistantFeedback}
                                  onClick={() => handleSupportAssistantFeedback("not_helpful")}
                                  type="button"
                                >
                                  {savingSupportAssistantFeedback ? "Saving..." : "Save feedback"}
                                </button>
                              ) : null}
                              {supportAssistantFeedbackMode === "not_helpful" ? (
                                <button
                                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
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
                                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
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
                                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
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
                            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
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
                              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
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

            {showWelcomeGuide ? (
              <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-blue-950">
                      {appContentText("welcome_guide_title")}
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm text-blue-900">
                      {appContentText("welcome_guide_body")}
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-700"
                    onClick={dismissWelcomeGuide}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => setActiveAppointmentPanel("add")}
                    type="button"
                  >
                    + Add appointment
                  </button>
                  <button
                    className="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700"
                    onClick={() => setActiveAppointmentPanel("quickAdd")}
                    type="button"
                  >
                    Quick Add
                  </button>
                  <button
                    className="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700"
                    onClick={() => {
                      setAskingSupportQuestion(true);
                      setSupportQuestionExpanded(true);
                    }}
                    type="button"
                  >
                    Ask a question
                  </button>
                </div>
                {shouldOfferSampleData ? (
                  <div className="mt-4 rounded-md border border-blue-100 bg-white p-3">
                    <p className="text-sm font-semibold text-blue-950">
                      {appContentText("demo_prompt_title")}
                    </p>
                    <p className="mt-1 text-sm text-blue-900">
                      {appContentText("demo_prompt_body")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                        disabled={seedingSampleData || decliningSampleData}
                        onClick={() => handleSeedSampleDataForCurrentUser()}
                        type="button"
                      >
                        {seedingSampleData ? "Adding..." : "Add demo data"}
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                        disabled={seedingSampleData || decliningSampleData}
                        onClick={handleDeclineSampleData}
                        type="button"
                      >
                        {decliningSampleData ? "Skipping..." : "Skip demo data"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {signedInEmail && mainTab === "appointments" ? (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="min-w-60 flex-1">
                    {canUseMultipleCareVips ? (
                      <label className="block text-sm font-medium text-slate-700">
                        Showing appointments
                        <select
                          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                          disabled={loading || careSubjects.length === 0}
                          onChange={(event) =>
                            handleChangeSubject(event.target.value)
                          }
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
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          Showing appointments
                        </p>
                        <p className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-base text-slate-700">
                          All appointments
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                      disabled={loading}
                      onClick={handleRefresh}
                      type="button"
                    >
                      ↻ Refresh
                    </button>
                    <button
                      className={`rounded-md px-4 py-2 text-sm font-semibold ${
                        activeAppointmentPanel === "add"
                          ? "bg-blue-700 text-white"
                          : "border border-slate-300 bg-white text-slate-700"
                      }`}
                      onClick={() =>
                        setActiveAppointmentPanel((currentPanel) =>
                          currentPanel === "add" ? null : "add"
                        )
                      }
                      type="button"
                    >
                      + Add appointment
                    </button>
                    <button
                      className={`rounded-md px-4 py-2 text-sm font-semibold ${
                        activeAppointmentPanel === "quickAdd"
                          ? "bg-blue-700 text-white"
                          : "border border-slate-300 bg-white text-slate-700"
                      }`}
                      onClick={() =>
                        setActiveAppointmentPanel((currentPanel) =>
                          currentPanel === "quickAdd" ? null : "quickAdd"
                        )
                      }
                      type="button"
                    >
                      Quick Add
                    </button>
                  </div>
                </div>

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
                    <label className="block text-sm font-medium text-slate-700">
                      Title
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                        className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                        onChange={(event) =>
                          setNewAppointmentReason(event.target.value)
                        }
                        placeholder="What is this appointment for?"
                        value={newAppointmentReason}
                      />
                    </label>
                    <div className="flex flex-wrap gap-3 md:col-span-2">
                      <button
                        className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                        disabled={creatingAppointment}
                        type="submit"
                      >
                        {creatingAppointment ? "Adding..." : "+ Add appointment"}
                      </button>
                      <button
                        className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
                        onClick={() => setActiveAppointmentPanel(null)}
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
                        <label className="block text-sm font-medium text-slate-700">
                          Image to text
                          <input
                            accept="image/gif,image/jpeg,image/png,image/webp"
                            className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
                            disabled={extractingImageText}
                            multiple
                            onChange={(event) => {
                              void handleExtractImageText(event.target.files);
                              event.target.value = "";
                            }}
                            type="file"
                          />
                        </label>
                        <p className="mt-2 text-xs text-slate-500">
                          {extractingImageText
                            ? "Extracting text..."
                            : "Up to 10 images are converted to text only and are not stored."}
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
                          className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                          disabled={processingTextIntake}
                          type="submit"
                        >
                          {processingTextIntake
                            ? "Interpreting..."
                            : "Review appointments"}
                        </button>
                        <button
                          className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
                          onClick={() => setActiveAppointmentPanel(null)}
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
                            className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                            disabled={savingTextIntake}
                            type="submit"
                          >
                            {savingTextIntake ? "Saving..." : "Save intake"}
                          </button>
                          <button
                            className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
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

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            className="rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                            disabled={savingTextIntake}
                            type="submit"
                          >
                            {savingTextIntake
                              ? "Saving..."
                              : "Save selected appointments"}
                          </button>
                          <button
                            className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
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
                  {[
                    ["tools", "Tools"],
                    ["content", "Content"],
                    ["ai", "AI Prompts"],
                    ["assistantReview", "Asst Review"],
                    ["messages", "Messages"],
                    ["product", "Prod Mgmt"],
                    [
                      "tickets",
                      `Tix ${adminTicketsNeedingFollowup.length}/${adminOpenTickets.length}`,
                    ],
                  ].map(([tab, label]) => (
                    <button
                      className={`rounded-md px-4 py-2 text-sm font-semibold ${
                        adminTab === tab
                          ? "bg-blue-700 text-white"
                          : "border border-slate-300 bg-white text-slate-700"
                      }`}
                      key={tab}
                      onClick={() => handleChangeAdminTab(tab as AdminTab)}
                      type="button"
                    >
                      {tab === "tickets" ? (
                        <span>
                          Tix{" "}
                          <span
                            className={
                              adminTicketsNeedingFollowup.length > 0
                                ? adminTab === "tickets"
                                  ? "text-red-100"
                                  : "text-red-600"
                                : ""
                            }
                          >
                            {adminTicketsNeedingFollowup.length}
                          </span>
                          /{adminOpenTickets.length}
                        </span>
                      ) : (
                        label
                      )}
                    </button>
                  ))}
                </div>
              </section>

              {adminTab === "tools" ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">Admin tools</h2>
                    <p className="mt-1 text-slate-600">
                      Add sample data for beta testers and review account setup
                      state.
                    </p>
                  </div>
                </div>

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
              ) : null}

              {adminTab === "tickets" ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">Support questions</h2>
                    <p className="mt-1 text-slate-600">
                      Review user questions, reply, and track follow-up state.
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                    disabled={loadingAdminTickets}
                    onClick={() => loadAdminSupportTickets()}
                    type="button"
                  >
                    {loadingAdminTickets ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
                  <aside className="space-y-2">
                    {adminSupportTickets.length === 0 ? (
                      <div className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
                        No support questions yet.
                      </div>
                    ) : (
                      adminSupportTickets.map((ticket) => {
                        const selected = selectedAdminTicket?.id === ticket.id;

                        return (
                          <button
                            className={`w-full rounded-md border p-3 text-left transition ${
                              selected
                                ? "border-sky-300 bg-sky-50"
                                : ticket.needs_admin_followup
                                  ? "border-red-200 bg-red-50/70"
                                  : "border-slate-200 bg-white hover:border-sky-200"
                            }`}
                            key={ticket.id}
                            onClick={() => selectAdminTicket(ticket)}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-slate-900">
                                {ticket.subject}
                              </span>
                              {ticket.needs_admin_followup ? (
                                <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                  Follow up
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {supportTicketUserLabel(ticket)}
                            </p>
                            <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
                              {ticket.status.replace("_", " ")} · {ticket.priority}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Updated {formatDate(ticket.updated_at)}
                            </p>
                          </button>
                        );
                      })
                    )}
                  </aside>

                  {selectedAdminTicket ? (
                    <div className="rounded-md border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">
                            {selectedAdminTicket.subject}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {supportTicketUserLabel(selectedAdminTicket)} · {selectedAdminTicket.category}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Opened {formatDate(selectedAdminTicket.created_at)} · updated {formatDate(selectedAdminTicket.updated_at)}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                            {selectedAdminTicket.status.replace("_", " ")}
                          </span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                            {selectedAdminTicket.priority}
                          </span>
                          {selectedAdminTicket.needs_admin_followup ? (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                              Needs response
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                              No admin follow-up
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 max-h-[28rem] space-y-3 overflow-auto rounded-md bg-slate-50 p-3">
                        {selectedAdminTicketMessages.length === 0 ? (
                          <p className="text-sm text-slate-600">
                            No messages found for this question.
                          </p>
                        ) : (
                          selectedAdminTicketMessages.map((messageRow) => (
                            <div
                              className={`rounded-md border p-3 ${
                                messageRow.is_internal
                                  ? "border-amber-200 bg-amber-50 text-amber-950"
                                  : messageRow.author_role === "admin"
                                    ? "border-sky-200 bg-sky-50 text-slate-800"
                                    : "border-slate-200 bg-white text-slate-800"
                              }`}
                              key={messageRow.id}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <span>
                                  {messageRow.is_internal
                                    ? "Internal note"
                                    : messageRow.author_role === "admin"
                                      ? "Admin reply"
                                      : "User"}
                                </span>
                                <span>{formatDate(messageRow.created_at)}</span>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm">
                                {messageRow.message_body}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <form
                          className="rounded-md border border-slate-200 p-3"
                          onSubmit={handleAddAdminTicketReply}
                        >
                          <h4 className="font-semibold text-slate-900">
                            Reply to user
                          </h4>
                          <textarea
                            className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
                            onChange={(event) =>
                              setAdminTicketReplyBody(event.target.value)
                            }
                            placeholder="Write a user-visible reply."
                            value={adminTicketReplyBody}
                          />
                          <button
                            className="mt-3 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                            disabled={savingAdminTicketReply || !adminTicketReplyBody.trim()}
                            type="submit"
                          >
                            {savingAdminTicketReply ? "Sending..." : "Send reply"}
                          </button>
                        </form>

                        <form
                          className="rounded-md border border-slate-200 p-3"
                          onSubmit={handleAddAdminInternalNote}
                        >
                          <h4 className="font-semibold text-slate-900">
                            Internal note
                          </h4>
                          <textarea
                            className="mt-2 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2"
                            onChange={(event) =>
                              setAdminTicketInternalNote(event.target.value)
                            }
                            placeholder="Private admin note."
                            value={adminTicketInternalNote}
                          />
                          <button
                            className="mt-3 rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:text-slate-400"
                            disabled={savingAdminTicketReply || !adminTicketInternalNote.trim()}
                            type="submit"
                          >
                            {savingAdminTicketReply ? "Saving..." : "Add internal note"}
                          </button>
                        </form>
                      </div>

                      <form
                        className="mt-4 rounded-md border border-slate-200 p-3"
                        onSubmit={handleUpdateAdminTicketStatus}
                      >
                        <h4 className="font-semibold text-slate-900">
                          Status and routing
                        </h4>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <label className="block text-sm font-medium text-slate-700">
                            Status
                            <select
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                              onChange={(event) =>
                                setAdminTicketStatus(event.target.value as SupportTicketStatus)
                              }
                              value={adminTicketStatus}
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In progress</option>
                              <option value="waiting_on_user">Waiting on user</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Priority
                            <select
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                              onChange={(event) =>
                                setAdminTicketPriority(event.target.value as SupportTicketPriority)
                              }
                              value={adminTicketPriority}
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            Category
                            <input
                              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                              onChange={(event) =>
                                setAdminTicketCategory(event.target.value)
                              }
                              value={adminTicketCategory}
                            />
                          </label>
                        </div>
                        <label className="mt-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input
                            checked={adminTicketNeedsFollowup}
                            onChange={(event) =>
                              setAdminTicketNeedsFollowup(event.target.checked)
                            }
                            type="checkbox"
                          />
                          Needs admin follow-up
                        </label>
                        <label className="mt-3 block text-sm font-medium text-slate-700">
                          Change note
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                            onChange={(event) =>
                              setAdminTicketChangeNote(event.target.value)
                            }
                            placeholder="What changed and why?"
                            value={adminTicketChangeNote}
                          />
                        </label>
                        <button
                          className="mt-3 rounded-md bg-slate-900 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                          disabled={savingAdminTicketStatus}
                          type="submit"
                        >
                          {savingAdminTicketStatus ? "Saving..." : "Save ticket status"}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </section>
              ) : null}

              {adminTab === "assistantReview" ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">Assistant answer review</h2>
                    <p className="mt-1 text-slate-600">
                      Review every support assistant answer, including helpful and untouched responses.
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

                        return (
                          <button
                            className={`w-full rounded-md border p-3 text-left transition ${
                              selected
                                ? "border-sky-300 bg-sky-50"
                                : interaction.outcome === "not_helpful"
                                  ? "border-amber-200 bg-amber-50/70"
                                  : interaction.outcome === "escalated"
                                    ? "border-red-200 bg-red-50/70"
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
              ) : null}

              {adminTab === "content" ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">Content admin</h2>
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
                      Content area
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
                        Content block
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
                      className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                    disabled={loadingInstructions || loadingCarePrepHistory}
                    onClick={() =>
                      aiAdminTab === "instructions"
                        ? loadAiInstructions()
                        : selectedAiWorkflow === "careprep_generation"
                          ? loadCarePrepHistory()
                          : loadIntakeHistory()
                    }
                    type="button"
                  >
                    {loadingInstructions || loadingCarePrepHistory
                      ? "Loading..."
                      : "Reload"}
                  </button>
                </div>

                <label className="mt-5 block max-w-xl text-sm font-medium text-slate-700">
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

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    className={`rounded-md px-4 py-2 text-sm font-semibold ${
                      aiAdminTab === "instructions"
                        ? "bg-blue-700 text-white"
                        : "border border-slate-300 bg-white text-slate-700"
                    }`}
                    disabled={loadingInstructions || loadingCarePrepHistory}
                    onClick={() => handleChangeAiAdminTab("instructions")}
                    type="button"
                  >
                    AI Instructions
                  </button>
                  <button
                    className={`rounded-md px-4 py-2 text-sm font-semibold ${
                      aiAdminTab === "history"
                        ? "bg-blue-700 text-white"
                        : "border border-slate-300 bg-white text-slate-700"
                    }`}
                    disabled={loadingInstructions || loadingCarePrepHistory}
                    onClick={() => handleChangeAiAdminTab("history")}
                    type="button"
                  >
                    {selectedAiWorkflowConfig.historyLabel}
                  </button>
                </div>

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
              </section>
              ) : null}

              {adminTab === "messages" ? (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-2xl font-semibold">Messages</h2>
                  <p className="mt-1 max-w-3xl text-slate-600">
                    Short app messages will live here: success notices, warning
                    text, validation messages, and toast wording. This tab is
                    ready for the message catalog once we promote those strings
                    into managed content.
                  </p>
                </section>
              ) : null}

              {adminTab === "product" ? (
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div>
                    <h2 className="text-2xl font-semibold">Product management</h2>
                    <p className="mt-1 max-w-3xl text-slate-600">
                      Track bugs, beta readiness, release notes, wishlist items,
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
                            <button
                              className={`w-full rounded-md border px-3 py-3 text-left transition ${
                                isSelected
                                  ? "border-blue-300 bg-blue-50 text-blue-950"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                              }`}
                              key={section.key}
                              onClick={() =>
                                setSelectedProductMgmtSection(
                                  section.key as ProductMgmtSection
                                )
                              }
                              type="button"
                            >
                              <span className="block font-semibold">
                                {section.label}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                {productMgmtAreas.length > 0
                                  ? `${itemCount} item${itemCount === 1 ? "" : "s"}`
                                  : "Run SQL to enable entries"}
                              </span>
                            </button>
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
              <div
                className="sticky z-40 flex flex-wrap gap-2 bg-slate-50/95 py-3 backdrop-blur"
                style={{ top: stickySecondaryOffset }}
              >
                <button
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${
                    appointmentView === "upcoming"
                      ? "bg-blue-700 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  disabled={loading}
                  onClick={() => handleChangeAppointmentView("upcoming")}
                  type="button"
                >
                  Upcoming
                </button>
                <button
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${
                    appointmentView === "logged"
                      ? "bg-blue-700 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  disabled={loading}
                  onClick={() => handleChangeAppointmentView("logged")}
                  type="button"
                >
                  Logged
                </button>
                <button
                  className={`rounded-md px-4 py-2 text-sm font-semibold ${
                    appointmentView === "archived"
                      ? "bg-blue-700 text-white"
                      : "border border-slate-300 bg-white text-slate-700"
                  }`}
                  disabled={loading}
                  onClick={() => handleChangeAppointmentView("archived")}
                  type="button"
                >
                  Archived
                </button>
              </div>
            ) : null}

            {signedInEmail &&
            mainTab === "appointments" &&
            appointmentView === "upcoming" &&
            notesReminderAppointment ? (
              <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-blue-950">
                      Add notes for your last appointment
                    </h2>
                    <p className="mt-1 text-sm text-blue-900">
                      {notesReminderAppointment.title || "Untitled appointment"} ·{" "}
                      {formatDate(notesReminderAppointment.starts_at)}
                      {notesReminderAppointment.is_sample_data ? (
                        <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                          Demo
                        </span>
                      ) : null}
                    </p>
                    {notesReminderAppointment.is_sample_data ? (
                      <p className="mt-1 text-xs italic text-blue-800">
                        Note: This is not an actual appointment.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                      disabled={loading}
                      onClick={() =>
                        handleStartReminderNotes(notesReminderAppointment)
                      }
                      type="button"
                    >
                      Type
                    </button>
                    <button
                      className="rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-700 disabled:text-slate-400"
                      disabled={loading}
                      onClick={() =>
                        startContextualTextIntake(notesReminderAppointment)
                      }
                      type="button"
                    >
                      Paste
                    </button>
                  </div>
                </div>
                {editingNoteIds[notesReminderAppointment.id] ? (
                  <form
                    className="mt-4 rounded-md border border-blue-100 bg-white p-4"
                    onSubmit={(event) =>
                      handleSaveNote(event, notesReminderAppointment)
                    }
                  >
                    <div className="grid gap-4 lg:grid-cols-3">
                      <label className="block text-sm font-medium text-slate-700 lg:col-span-3">
                        Visit summary
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                          onChange={(event) =>
                            updateNoteDraft(
                              notesReminderAppointment.id,
                              "summary",
                              event.target.value
                            )
                          }
                          placeholder="What happened in the visit?"
                          value={
                            noteDrafts[notesReminderAppointment.id]?.summary ?? ""
                          }
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Takeaways
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                          onChange={(event) =>
                            updateNoteDraft(
                              notesReminderAppointment.id,
                              "takeaways",
                              event.target.value
                            )
                          }
                          placeholder={"One per line\nExample: Medication changed"}
                          value={
                            noteDrafts[notesReminderAppointment.id]?.takeaways ??
                            ""
                          }
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Follow-ups
                        <textarea
                          className="mt-2 min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                          onChange={(event) =>
                            updateNoteDraft(
                              notesReminderAppointment.id,
                              "followups",
                              event.target.value
                            )
                          }
                          placeholder={"One per line\nExample: Schedule labs"}
                          value={
                            noteDrafts[notesReminderAppointment.id]?.followups ??
                            ""
                          }
                        />
                      </label>
                      <div className="flex items-end gap-3">
                        <button
                          className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                          disabled={savingNoteForId === notesReminderAppointment.id}
                          type="submit"
                        >
                          {savingNoteForId === notesReminderAppointment.id
                            ? "Saving..."
                            : "Save notes"}
                        </button>
                        <button
                          className="rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700"
                          onClick={() =>
                            cancelEditingNote(notesReminderAppointment.id)
                          }
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                ) : null}
                {textIntakeTargetAppointmentId ===
                notesReminderAppointment.id ? (
                  <form
                    className="mt-4 rounded-md border border-blue-100 bg-white p-4"
                    onSubmit={
                      textIntakeDraft
                        ? handleSaveTextIntakeDraft
                        : handleInterpretTextIntake
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-blue-950">
                          Paste notes for this appointment
                        </h3>
                        <p className="mt-1 text-sm text-blue-800">
                          The interpreted notes will be attached here.
                        </p>
                      </div>
                      <button
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        onClick={cancelTextIntake}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>

                    {!textIntakeDraft ? (
                      <>
                        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <label className="block text-sm font-medium text-slate-700">
                            Image to text
                            <input
                              accept="image/gif,image/jpeg,image/png,image/webp"
                              className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
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
                          <p className="mt-2 text-xs text-slate-500">
                            {extractingImageText
                              ? "Extracting text..."
                              : "Up to 10 images are converted to text only and are not stored."}
                          </p>
                        </div>
                        <label className="mt-4 block text-sm font-medium text-slate-700">
                          Text
                          <textarea
                            className="mt-2 min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                            onChange={(event) =>
                              setContextualTextIntakeValue(event.target.value)
                            }
                            placeholder="Paste portal notes, after-visit summaries, or visit details."
                            value={contextualTextIntakeValue}
                          />
                        </label>
                        <button
                          className="mt-4 rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                          disabled={processingTextIntake}
                          type="submit"
                        >
                          {processingTextIntake
                            ? "Interpreting..."
                            : "Interpret notes"}
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
                            className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
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

            {mainTab === "appointments" ? (
              appointments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-600">
                {appointmentView === "archived"
                  ? "No archived appointments found."
                  : appointmentView === "logged"
                    ? "No logged appointments found yet."
                    : "No upcoming appointments found yet."}
              </div>
            ) : (
              appointments.map((appointment) => {
                const note = notesByAppointment.get(appointment.id);
                const prep = guidanceByAppointment.get(appointment.id);
                const carePrepDraft = draftGuidanceByAppointment.get(
                  appointment.id
                );
                const appointmentSubject = appointment.care_subject_id
                  ? subjectsById.get(appointment.care_subject_id)
                  : null;
                const appointmentDraft =
                  appointmentDrafts[appointment.id] ?? emptyAppointmentDraft;
                const isEditingAppointment =
                  editingAppointmentIds[appointment.id] ?? false;
                const noteDraft = noteDrafts[appointment.id] ?? emptyNoteDraft;
                const isEditingNote = editingNoteIds[appointment.id] ?? false;
                const isEditingCarePrep =
                  editingCarePrepIds[appointment.id] ?? false;
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
                const prepEditValues = prep
                  ? carePrepFormValues(appointment.id, prep)
                  : emptyCarePrepDraft;
                const isArchived = appointment.status === "archived";
                const isLogged = Boolean(appointment.current_note_id);
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
                const modifierButtonBase =
                  "h-11 px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-300";
                const modifierButtonActive = "bg-blue-700 text-white";
                const modifierButtonInactive =
                  "bg-white text-blue-700 hover:bg-blue-50";
                const mapsLink = googleMapsUrl(appointment.location_address);
                const calendarLink = agicalUrl(appointment);
                return (
                  <article
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                    key={appointment.id}
                  >
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            className={`text-2xl font-semibold ${
                              appointment.is_sample_data
                                ? "text-slate-500"
                                : "text-slate-900"
                            }`}
                          >
                            {appointment.title || "Untitled appointment"}
                          </h2>
                          {appointment.is_sample_data ? (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                              Demo
                            </span>
                          ) : null}
                          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                            {appointment.status}
                          </span>
                        </div>
                        {appointment.is_sample_data ? (
                          <p className="mt-1 text-sm italic text-slate-500">
                            Note: This is not an actual appointment.
                          </p>
                        ) : null}
                        {appointment.location_name ||
                        appointment.location_address ||
                        appointment.location_phone ? (
                          <div className="mt-2 text-sm text-slate-600">
                            {appointment.location_name ? (
                              <p>{appointment.location_name}</p>
                            ) : null}
                            {appointment.location_address ? (
                              <p>{appointment.location_address}</p>
                            ) : null}
                            {appointment.location_phone ? (
                              <p>{appointment.location_phone}</p>
                            ) : null}
                          </div>
                        ) : null}

                        {!isArchived ? (
                          <div className="mt-4 flex flex-wrap gap-3">
                            {mapsLink ? (
                              <a
                                aria-label="Open in Google Maps"
                                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                href={mapsLink}
                                rel="noreferrer"
                                target="_blank"
                                title="Open in Google Maps"
                              >
                                <MapPinIcon className="h-5 w-5" />
                              </a>
                            ) : null}
                            {calendarLink ? (
                              <a
                                aria-label="Add to Calendar"
                                className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                href={calendarLink}
                                rel="noreferrer"
                                target="_blank"
                                title="Add to Calendar"
                              >
                                <CalendarIcon className="h-5 w-5" />
                              </a>
                            ) : null}
                            {canPasteContextualNotes ? (
                              <div
                                aria-label="Appointment modifier actions"
                                className="inline-flex h-11 overflow-hidden rounded-md border border-blue-300 bg-white"
                              >
                                <button
                                  className={`${modifierButtonBase} ${
                                    activeModifier === "add"
                                      ? modifierButtonActive
                                      : modifierButtonInactive
                                  }`}
                                  onClick={() =>
                                    requestAppointmentModifier(
                                      appointment,
                                      "add"
                                    )
                                  }
                                  title="Type appointment notes"
                                  type="button"
                                >
                                  Add Notes
                                </button>
                                <button
                                  className={`${modifierButtonBase} border-l border-blue-300 ${
                                    activeModifier === "import"
                                      ? modifierButtonActive
                                      : modifierButtonInactive
                                  }`}
                                  onClick={() =>
                                    requestAppointmentModifier(
                                      appointment,
                                      "import"
                                    )
                                  }
                                  title="Paste or upload notes"
                                  type="button"
                                >
                                  Import Notes
                                </button>
                                <button
                                  aria-label="Edit Appointment"
                                  className={`${modifierButtonBase} inline-flex items-center gap-2 border-l border-blue-300 ${
                                    activeModifier === "edit"
                                      ? modifierButtonActive
                                      : modifierButtonInactive
                                  }`}
                                  onClick={() =>
                                    requestAppointmentModifier(
                                      appointment,
                                      "edit"
                                    )
                                  }
                                  title="Edit appointment"
                                  type="button"
                                >
                                  <PencilSquareIcon className="h-5 w-5" />
                                  Edit
                                </button>
                              </div>
                            ) : null}
                            {!canPasteContextualNotes ? (
                              <button
                                aria-label="Edit Appointment"
                                className={`inline-flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                                  activeModifier === "edit"
                                    ? "border-blue-700 bg-blue-700 text-white"
                                    : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                                }`}
                                onClick={() =>
                                  requestAppointmentModifier(appointment, "edit")
                                }
                                title="Edit appointment"
                                type="button"
                              >
                                <PencilSquareIcon className="h-5 w-5" />
                                Edit
                              </button>
                            ) : null}
                            <button
                              aria-label="Archive Appointment"
                              className={`inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                                archivingAppointmentForId === appointment.id
                                  ? "border-blue-300 bg-blue-50 text-blue-800"
                                  : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                              }`}
                              disabled={
                                archivingAppointmentForId === appointment.id
                              }
                              onClick={() =>
                                handleArchiveAppointment(appointment)
                              }
                              title={
                                archivingAppointmentForId === appointment.id
                                  ? "Archiving..."
                                  : "Archive Appointment"
                              }
                              type="button"
                            >
                              {archivingAppointmentForId === appointment.id
                                ? "Archiving..."
                                : "Archive"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-left md:min-w-64 md:text-right">
                        <p className="text-lg font-medium text-slate-700">
                          {formatDate(appointment.starts_at)}
                        </p>
                        {appointment.provider_name ? (
                          <p className="mt-1 text-sm font-medium text-slate-700">
                            {appointment.provider_name}
                          </p>
                        ) : null}
                        {appointmentSubject ? (
                          <p className="mt-1 text-sm font-medium text-slate-500">
                            for {appointmentSubject.display_name}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {pendingModifierSwitch?.appointmentId === appointment.id ? (
                      <section className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-sm font-medium text-amber-950">
                            Switching will discard your unsaved changes. Proceed?
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="rounded-md bg-amber-900 px-3 py-2 text-sm font-semibold text-white"
                              onClick={() =>
                                discardAndSwitchAppointmentModifier(appointment)
                              }
                              type="button"
                            >
                              Discard and switch
                            </button>
                            <button
                              className="rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950"
                              onClick={() => setPendingModifierSwitch(null)}
                              type="button"
                            >
                              Return to editing
                            </button>
                          </div>
                        </div>
                      </section>
                    ) : null}

                    {isContextualTextIntake && canPasteContextualNotes ? (
                      <form
                        className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4"
                        onSubmit={
                          textIntakeDraft
                            ? handleSaveTextIntakeDraft
                            : handleInterpretTextIntake
                        }
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-blue-950">
                              Import notes for this appointment
                            </h3>
                            <p className="mt-1 text-sm text-blue-800">
                              The notes will be attached here and versioned.
                            </p>
                          </div>
                          <button
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                            onClick={cancelTextIntake}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>

                        {!textIntakeDraft ? (
                          <>
                            <div className="mt-4 rounded-md border border-blue-100 bg-white p-3">
                              <label className="block text-sm font-medium text-slate-700">
                                Image to text
                                <input
                                  accept="image/gif,image/jpeg,image/png,image/webp"
                                  className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700"
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
                              <p className="mt-2 text-xs text-slate-500">
                                {extractingImageText
                                  ? "Extracting text..."
                                  : "Up to 10 images are converted to text only and are not stored."}
                              </p>
                            </div>
                            <label className="mt-4 block text-sm font-medium text-slate-700">
                              Text
                              <textarea
                                className="mt-2 min-h-32 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                                onChange={(event) =>
                                  setContextualTextIntakeValue(event.target.value)
                                }
                                placeholder="Paste portal notes, after-visit summaries, or visit details."
                                value={contextualTextIntakeValue}
                              />
                            </label>
                            <button
                              className="mt-4 rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
                              disabled={processingTextIntake}
                              type="submit"
                            >
                              {processingTextIntake
                                ? "Interpreting..."
                                : "Interpret notes"}
                            </button>
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
                                  className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
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
                        className="mt-5 rounded-md border border-blue-100 bg-blue-50 p-4"
                        onSubmit={(event) => handleSaveNote(event, appointment)}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-900">
                              {note ? "Edit notes" : "Add notes"}
                            </h3>
                            {note ? (
                              <p className="mt-1 text-sm text-slate-500">
                                Saving creates version {note.version_number + 1}
                                and keeps the old one archived.
                              </p>
                            ) : null}
                          </div>
                          <button
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                            onClick={() => cancelEditingNote(appointment.id)}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
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
                              className="w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
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

                    {isArchived ? (
                      <div className="mt-4">
                        <button
                          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                          disabled={restoringAppointmentForId === appointment.id}
                          onClick={() => restoreAppointment(appointment.id)}
                          type="button"
                        >
                          {restoringAppointmentForId === appointment.id
                            ? "Restoring..."
                            : "Restore appointment"}
                        </button>
                      </div>
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
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            onClick={() => cancelEditingAppointment(appointment.id)}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>

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
                            className="rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
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
                      <section className="mt-5">
                        <h3 className="font-semibold text-slate-900">Reason</h3>
                        <p className="mt-1 text-slate-700">{appointment.reason}</p>
                      </section>
                    ) : null}

                    {canGenerateCarePrep ? (
                      <div className="mt-5">
                        <button
                          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                          disabled={generatingCarePrepForId === appointment.id}
                          onClick={() => handleGenerateCarePrep(appointment)}
                          type="button"
                        >
                          {generatingCarePrepForId === appointment.id
                            ? "Generating CarePrep..."
                            : carePrepDraft
                              ? "Regenerate CarePrep"
                              : prep
                                ? "Generate new CarePrep"
                                : "Generate CarePrep"}
                        </button>
                      </div>
                    ) : null}

                    {carePrepDraft && !isArchived ? (
                      <section className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-blue-900">
                              Review new CarePrep
                            </h3>
                            <p className="mt-1 text-sm text-blue-800">
                              AI prepared this version. Accept it as-is, edit it
                              into your version, or discard it.
                            </p>
                          </div>
                          <button
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400"
                            disabled={
                              savingCarePrepForId === appointment.id ||
                              discardingCarePrepForId === appointment.id
                            }
                            onClick={() =>
                              submitCarePrepReview({
                                action: "discard",
                                appointmentId: appointment.id,
                                draft: carePrepDraft,
                              })
                            }
                            type="button"
                          >
                            {discardingCarePrepForId === appointment.id
                              ? "Discarding..."
                              : "Discard"}
                          </button>
                        </div>

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
                            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                            disabled={savingCarePrepForId === appointment.id}
                            onClick={() =>
                              submitCarePrepReview({
                                action: "accept",
                                appointmentId: appointment.id,
                                draft: carePrepDraft,
                              })
                            }
                            type="button"
                          >
                            {savingCarePrepForId === appointment.id
                              ? "Accepting..."
                              : "Accept CarePrep"}
                          </button>
                          <button
                            className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                            disabled={savingCarePrepForId === appointment.id}
                            onClick={() =>
                              submitCarePrepReview({
                                action: "save_edit",
                                appointmentId: appointment.id,
                                draft: carePrepDraft,
                              })
                            }
                            type="button"
                          >
                            {savingCarePrepForId === appointment.id
                              ? "Saving..."
                              : "Save edited version"}
                          </button>
                        </div>
                      </section>
                    ) : null}

                    {note ? (
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-blue-800">
                            Visit notes
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Current version {note.version_number}
                          </p>
                        </div>
                        {!isEditingNote && !isArchived ? (
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            onClick={() => startEditingNote(appointment.id, note)}
                            type="button"
                          >
                            Edit notes
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {note?.summary_short ? (
                      <section className="mt-5">
                        <h3 className="font-semibold text-blue-800">Visit summary</h3>
                        <p className="mt-1 text-slate-700">{note.summary_short}</p>
                      </section>
                    ) : null}

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <section className="rounded-md border border-slate-200 p-4">
                        <h3 className="font-semibold text-blue-800">Takeaways</h3>
                        <DetailList
                          emptyLabel="No takeaways saved yet."
                          items={takeaways}
                        />
                      </section>

                      <section className="rounded-md border border-slate-200 p-4">
                        <h3 className="font-semibold text-blue-800">Follow-ups</h3>
                        <DetailList
                          emptyLabel="No follow-ups saved yet."
                          items={followups}
                        />
                      </section>
                    </div>

                    {prep?.summary ? (
                      <section className="mt-5 rounded-md bg-blue-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-lg font-semibold text-blue-900">
                              CarePrep
                            </h3>
                            <p className="mt-1 text-xs font-medium text-blue-700">
                              Current version {prep.version_number}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {!isArchived && !isEditingCarePrep ? (
                              <button
                                className="rounded-md border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800"
                                onClick={() =>
                                  startEditingCarePrep(appointment.id, prep)
                                }
                                type="button"
                              >
                                Edit CarePrep
                              </button>
                            ) : null}
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                              Prep for visit
                            </span>
                          </div>
                        </div>
                        {isEditingCarePrep ? (
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
                                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
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
                                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
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
                          <>
                            <p className="mt-2 text-slate-700">{prep.summary}</p>

                            <div className="mt-5 grid gap-4 lg:grid-cols-3">
                              <section className="rounded-md bg-white p-4">
                                <h4 className="font-semibold text-slate-900">Bring</h4>
                                <DetailList
                                  emptyLabel="No bring-list items saved yet."
                                  items={bringList}
                                />
                              </section>

                              <section className="rounded-md bg-white p-4">
                                <h4 className="font-semibold text-slate-900">Ask</h4>
                                <DetailList
                                  emptyLabel="No questions saved yet."
                                  items={questions}
                                />
                              </section>

                              <section className="rounded-md bg-white p-4">
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
                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <section className="rounded-md bg-white p-4">
                                  <h4 className="font-semibold text-slate-900">
                                    Medication review
                                  </h4>
                                  <DetailList
                                    emptyLabel="No medication review items saved yet."
                                    items={medReview}
                                  />
                                </section>

                                <section className="rounded-md bg-white p-4">
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
                          </>
                        )}
                      </section>
                    ) : null}

                  </article>
                );
              })
              )
            ) : null}
          </div>
        </div>
        )}
      </section>
    </main>
  );
}
