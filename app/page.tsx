"use client";

import { createClient } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Appointment = {
  id: string;
  care_subject_id: string | null;
  current_note_id: string | null;
  location_address: string | null;
  location_name: string | null;
  location_phone: string | null;
  provider_name: string | null;
  provider_organization: string | null;
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

type AppointmentView = "archived" | "logged" | "upcoming";
type AiAdminTab = "history" | "instructions";
type AuthMode = "reset" | "signIn" | "signUp";

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
  phone: string;
  postalCode: string;
  region: string;
  timezone: string;
};

const ALL_SUBJECTS = "all";

const defaultEntitlement: CareCircleEntitlement = {
  max_active_subjects: 1,
  plan_id: "personal",
  plan_name: "Personal",
};

const emptyProfileDraft: ProfileDraft = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  country: "US",
  displayName: "",
  email: "",
  phone: "",
  postalCode: "",
  region: "",
  timezone: "",
};

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

  if (rawMessage.includes("invalid login credentials")) {
    return "That email and password did not match. Try again or reset your password.";
  }

  if (rawMessage.includes("email not confirmed")) {
    return "This account exists, but the email address still needs to be confirmed. Check your inbox for the Supabase confirmation email.";
  }

  if (
    rawMessage.includes("user already registered") ||
    rawMessage.includes("already been registered") ||
    rawMessage.includes("already exists")
  ) {
    return "An account already exists for this email. Sign in instead, or reset the password.";
  }

  if (rawMessage.includes("password")) {
    return "The password was not accepted. Use at least 8 characters and try again.";
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

function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
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

function resetInstructionDraft(version: AiInstructionVersion | null) {
  return {
    model: version?.model ?? "gpt-4.1-mini",
    outputSchema: JSON.stringify(
      version?.output_schema ?? defaultCarePrepOutputSchema,
      null,
      2
    ),
    systemPrompt: version?.system_prompt ?? "",
    userPrompt: version?.user_prompt_template ?? "",
  };
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

export default function Home() {
  const [authMode, setAuthMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newAppointmentTitle, setNewAppointmentTitle] = useState("");
  const [newAppointmentReason, setNewAppointmentReason] = useState("");
  const [newAppointmentStartsAt, setNewAppointmentStartsAt] = useState("");
  const [newAppointmentProviderName, setNewAppointmentProviderName] =
    useState("");
  const [
    newAppointmentProviderOrganization,
    setNewAppointmentProviderOrganization,
  ] = useState("");
  const [newAppointmentLocationName, setNewAppointmentLocationName] =
    useState("");
  const [newAppointmentLocationAddress, setNewAppointmentLocationAddress] =
    useState("");
  const [newAppointmentLocationPhone, setNewAppointmentLocationPhone] =
    useState("");
  const [newAppointmentSubjectId, setNewAppointmentSubjectId] = useState("");
  const [textIntakeSubjectId, setTextIntakeSubjectId] = useState("");
  const [textIntakeValue, setTextIntakeValue] = useState("");
  const [textIntakeDraft, setTextIntakeDraft] =
    useState<TextIntakeDraft | null>(null);
  const [textIntakeAiDraft, setTextIntakeAiDraft] =
    useState<TextIntakeDraft | null>(null);
  const [textIntakeItemId, setTextIntakeItemId] = useState<string | null>(null);
  const [textIntakeMatches, setTextIntakeMatches] = useState<TextIntakeMatch[]>(
    []
  );
  const [selectedTextIntakeMatchId, setSelectedTextIntakeMatchId] =
    useState("new");
  const [textIntakeTargetAppointmentId, setTextIntakeTargetAppointmentId] =
    useState<string | null>(null);
  const [contextualTextIntakeValue, setContextualTextIntakeValue] =
    useState("");
  const [
    applyTextIntakeAppointmentDetails,
    setApplyTextIntakeAppointmentDetails,
  ] = useState(false);
  const [newCareVipName, setNewCareVipName] = useState("");
  const [managingCareVips, setManagingCareVips] = useState(false);
  const [showAiAdmin, setShowAiAdmin] = useState(false);
  const [aiAdminTab, setAiAdminTab] = useState<AiAdminTab>("instructions");
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
  const [noteDrafts, setNoteDrafts] = useState<
    Record<
      string,
      {
        followups: string;
        summary: string;
        takeaways: string;
      }
    >
  >({});
  const [appointmentDrafts, setAppointmentDrafts] = useState<
    Record<string, typeof emptyAppointmentDraft>
  >({});
  const [carePrepDrafts, setCarePrepDrafts] = useState<
    Record<string, typeof emptyCarePrepDraft>
  >({});
  const [editingCarePrepIds, setEditingCarePrepIds] = useState<
    Record<string, boolean>
  >({});
  const [editingAppointmentIds, setEditingAppointmentIds] = useState<
    Record<string, boolean>
  >({});
  const [editingNoteIds, setEditingNoteIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [processingTextIntake, setProcessingTextIntake] = useState(false);
  const [savingTextIntake, setSavingTextIntake] = useState(false);
  const [creatingCareVip, setCreatingCareVip] = useState(false);
  const [appointmentView, setAppointmentView] =
    useState<AppointmentView>("upcoming");
  const [selectedSubjectId, setSelectedSubjectId] = useState(ALL_SUBJECTS);
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
  const [onboardingCompletedAt, setOnboardingCompletedAt] = useState<
    string | null
  >(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [restoringAppointmentForId, setRestoringAppointmentForId] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
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
  const [historyAppointmentId, setHistoryAppointmentId] = useState("");

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

  const careVipLimit = Math.max(entitlement.max_active_subjects, 5);
  const canUseMultipleCareVips = careVipLimit > 1;
  const canAddCareVip = careSubjects.length < careVipLimit;
  const needsOnboarding = signedInEmail && !onboardingCompletedAt;
  const passwordsMismatch =
    authMode === "signUp" &&
    confirmPassword.length > 0 &&
    password !== confirmPassword;
  const canSubmitAuth = !loading && !passwordsMismatch;

  useEffect(() => {
    async function restoreSession() {
      const { data } = await supabase.auth.getSession();
      const sessionEmail = data.session?.user.email ?? null;

      if (sessionEmail) {
        setSignedInEmail(sessionEmail);
        setEmail(sessionEmail);
        setLoading(true);

        try {
          await loadAppointments();
        } catch (error) {
          setMessage(getErrorMessage(error));
        } finally {
          setLoading(false);
        }
      }
    }

    restoreSession();
    // This runs once on page load to restore Supabase session state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      phone: String(
        row?.phone ??
          (typeof row?.phone_e164 === "string"
            ? formatUsPhoneFromDigits(phoneDigits(row.phone_e164))
            : "")
      ),
      postalCode: String(row?.postal_code ?? ""),
      region: String(row?.region ?? ""),
      timezone: String(row?.timezone ?? browserTimezone()),
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
        "id,email,display_name,phone,phone_e164,timezone,address_line1,address_line2,city,region,postal_code,country,onboarding_completed_at,is_admin"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    setProfileDraft(profileDraftFromRow(profileRow, profileEmail));
    setIsAdmin(profileRow?.is_admin === true);
    if (profileRow?.is_admin !== true) {
      setShowAiAdmin(false);
    }
    setOnboardingCompletedAt(
      typeof profileRow?.onboarding_completed_at === "string"
        ? profileRow.onboarding_completed_at
        : null
    );

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
      .select("id,care_subject_id,current_note_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone")
      .in("care_circle_id", circleIds)
      .order("starts_at", { ascending: true });

    if (effectiveSubjectId !== ALL_SUBJECTS) {
      appointmentQuery = appointmentQuery.eq("care_subject_id", effectiveSubjectId);
    }

    let notesReminderQuery = supabase
      .from("appointments")
      .select("id,care_circle_id,care_subject_id,current_note_id,title,reason,starts_at,status,provider_name,provider_organization,location_name,location_address,location_phone")
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

      setSignedInEmail(email.trim());
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
        setMessage("Account created and signed in. Finish profile setup to continue.");
        await loadAppointments();
        return;
      }

      setAuthMode("signIn");
      setPassword("");
      setConfirmPassword("");
      setMessage(
        "Account created. Check your email to confirm the account, then sign in."
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
          redirectTo: authRedirectUrl(),
        }
      );

      if (error) {
        throw error;
      }

      setAuthMode("signIn");
      setPassword("");
      setConfirmPassword("");
      setMessage("If this email has an account, a password reset link has been sent.");
    } catch (error) {
      logAuthError("passwordReset", error);
      setMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
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

  async function loadCarePrepInstructions() {
    setLoadingInstructions(true);
    setMessage("");

    try {
      const { careCircleId } = await getPrimaryCareContext();

      const { data: instructionSets, error: instructionSetError } =
        await supabase
          .from("ai_instruction_sets")
          .select("id,instruction_key,name,description")
          .eq("care_circle_id", careCircleId)
          .eq("instruction_key", "careprep_generation")
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
        const draft = resetInstructionDraft(null);
        setInstructionSystemPrompt(draft.systemPrompt);
        setInstructionUserPrompt(draft.userPrompt);
        setInstructionOutputSchema(draft.outputSchema);
        setInstructionModel(draft.model);
        setInstructionChangeNote("Initial CarePrep instruction set");
        setMessage("No CarePrep instruction set exists yet. Paste instructions and save version 1.");
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
      const draft = resetInstructionDraft(version);
      setInstructionSystemPrompt(draft.systemPrompt);
      setInstructionUserPrompt(draft.userPrompt);
      setInstructionOutputSchema(draft.outputSchema);
      setInstructionModel(draft.model);
      setInstructionChangeNote("");
      setMessage(
        version
          ? `Loaded CarePrep instructions v${version.version_number}.`
          : "No current CarePrep instruction version exists yet."
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoadingInstructions(false);
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

  async function handleToggleAiAdmin() {
    if (!isAdmin) {
      setShowAiAdmin(false);
      setMessage("Admin access is not enabled for this account.");
      return;
    }

    const nextState = !showAiAdmin;
    setShowAiAdmin(nextState);

    if (nextState) {
      setAiAdminTab("instructions");
      await loadCarePrepInstructions();
    }
  }

  async function handleChangeAiAdminTab(tab: AiAdminTab) {
    setAiAdminTab(tab);

    if (tab === "instructions") {
      await loadCarePrepInstructions();
    } else {
      await loadCarePrepHistory();
    }
  }

  async function handleChangeHistoryAppointment(appointmentId: string) {
    setHistoryAppointmentId(appointmentId);
    await loadCarePrepHistory(appointmentId);
  }

  function loadInstructionVersionIntoEditor(version: AiInstructionVersion) {
    setDraftSourceVersion(version);
    const draft = resetInstructionDraft(version);
    setInstructionSystemPrompt(draft.systemPrompt);
    setInstructionUserPrompt(draft.userPrompt);
    setInstructionOutputSchema(draft.outputSchema);
    setInstructionModel(draft.model);
    setInstructionChangeNote(
      version.is_current ? "" : `Based on v${version.version_number}`
    );
    setMessage(`Loaded v${version.version_number} into the editor.`);
  }

  async function handleSaveCarePrepInstructions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingInstructions(true);
    setMessage("");

    try {
      const { careCircleId, userId } = await getPrimaryCareContext();
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
            description:
              "Instructions used to generate appointment preparation guidance.",
            instruction_key: "careprep_generation",
            name: "CarePrep generation",
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
      const draft = resetInstructionDraft(newVersion);
      setInstructionSystemPrompt(draft.systemPrompt);
      setInstructionUserPrompt(draft.userPrompt);
      setInstructionOutputSchema(draft.outputSchema);
      setInstructionModel(draft.model);
      setInstructionChangeNote("");
      setMessage(`Saved CarePrep instructions v${newVersion.version_number}.`);
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

      const draft = resetInstructionDraft(revertedVersion);
      setInstructionSystemPrompt(draft.systemPrompt);
      setInstructionUserPrompt(draft.userPrompt);
      setInstructionOutputSchema(draft.outputSchema);
      setInstructionModel(draft.model);
      setInstructionChangeNote("");
      setMessage(
        `Reverted v${version.version_number} into new current v${revertedVersion.version_number}.`
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setRevertingInstructionForId(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSignedInEmail(null);
    setIsAdmin(false);
    setShowAiAdmin(false);
    setOnboardingCompletedAt(null);
    setProfileDraft(emptyProfileDraft);
    setAuthMode("signIn");
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

      if (!profileDraft.email.trim()) {
        throw new Error("Email is required.");
      }

      if (!isLikelyEmail(profileDraft.email)) {
        throw new Error("Enter a valid email address.");
      }

      if (!profileDraft.timezone.trim()) {
        throw new Error("Time zone is required.");
      }

      const normalizedPhone = profileDraft.phone.trim()
        ? normalizeUsPhone(profileDraft.phone)
        : null;

      if (profileDraft.phone.trim() && !normalizedPhone) {
        throw new Error("Enter a valid 10-digit U.S. phone number.");
      }

      const completedAt = new Date().toISOString();
      const { error } = await supabase.from("profiles").upsert({
        address_line1: profileDraft.addressLine1.trim() || null,
        address_line2: profileDraft.addressLine2.trim() || null,
        city: profileDraft.city.trim() || null,
        country: profileDraft.country.trim() || null,
        display_name: profileDraft.displayName.trim() || null,
        email: profileDraft.email.trim(),
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

      setOnboardingCompletedAt(completedAt);
      await loadAppointments();
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setSavingProfile(false);
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

      const baseDraft = intakeDraftFromResult(result.draft);
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

  function updateTextIntakeDraft(
    field: keyof TextIntakeDraft,
    value: string | number
  ) {
    setTextIntakeDraft((currentDraft) => ({
      ...(currentDraft ?? emptyTextIntakeDraft),
      [field]: value,
    }));
  }

  function startContextualTextIntake(appointment: Appointment) {
    setEditingNoteIds((currentIds) => ({
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
    setSelectedTextIntakeMatchId(appointment.id);
    setTextIntakeSubjectId(appointment.care_subject_id ?? "");
    setApplyTextIntakeAppointmentDetails(false);
    setMessage("");
  }

  function startTypingNote(appointmentId: string) {
    cancelTextIntake();
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
    setTextIntakeDraft(null);
    setTextIntakeAiDraft(null);
    setTextIntakeItemId(null);
    setTextIntakeMatches([]);
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
      const hasAiNoteDraft = Boolean(
        textIntakeAiDraft &&
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

      if (selectedMatch && !hasNotes) {
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

      if (hasNotes) {
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
      setAppointmentView(hasNotes ? "logged" : "upcoming");
      await loadAppointments(hasNotes ? "logged" : "upcoming");
      setMessage("Intake saved.");
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
      await loadAppointments();
      setMessage("Appointment added.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setCreatingAppointment(false);
    }
  }

  function startEditingAppointment(appointment: Appointment) {
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
    const shouldArchive = window.confirm(
      "Archive this appointment? It will disappear from the active dashboard, but the data will stay available for history and recovery."
    );

    if (!shouldArchive) {
      return;
    }

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
      setMessage("Appointment archived.");
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
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          CarePland Personal
        </p>

        <h1 className="mt-3 max-w-4xl text-4xl font-bold">
          Appointment memory, rebuilt cleanly.
        </h1>

        <p className="mt-4 max-w-3xl text-lg text-slate-700">
          A first live dashboard for the new CP Pers data spine: appointments,
          visit notes, and CarePrep from Supabase.
        </p>

        {needsOnboarding ? (
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
                Email
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("email", event.target.value)
                  }
                  type="email"
                  value={profileDraft.email}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Phone
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
                  type="tel"
                  value={profileDraft.phone}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Display name
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("displayName", event.target.value)
                  }
                  placeholder="Optional"
                  type="text"
                  value={profileDraft.displayName}
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Time zone
                <select
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("timezone", event.target.value)
                  }
                  value={profileDraft.timezone}
                >
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
                Postal code
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                  onChange={(event) =>
                    updateProfileDraft("postalCode", event.target.value)
                  }
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
        ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
                  <button
                    className="w-full rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                    onClick={handleSignOut}
                    type="button"
                  >
                    Sign out
                  </button>
                  {isAdmin ? (
                    <button
                      className="w-full rounded-md border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                      onClick={handleToggleAiAdmin}
                      type="button"
                    >
                      {showAiAdmin ? "Close AI admin" : "AI admin"}
                    </button>
                  ) : null}
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
                        Create a new account
                      </button>
                      <button
                        className="block font-semibold text-blue-700"
                        onClick={() => {
                          setAuthMode("reset");
                          setMessage("");
                        }}
                        type="button"
                      >
                        Forgot password?
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
                    <p className="mt-1 text-xs text-blue-800">
                      Confidence {Math.round(textIntakeDraft.confidence * 100)}%
                      {textIntakeDraft.suggestedAction
                        ? ` · ${textIntakeDraft.suggestedAction}`
                        : ""}
                    </p>
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
            {showAiAdmin && isAdmin ? (
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold">AI admin</h2>
                    <p className="mt-1 text-slate-600">
                      {aiAdminTab === "instructions"
                        ? "CarePrep generation"
                        : "CarePrep output audit trail"}
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
                        ? loadCarePrepInstructions()
                        : loadCarePrepHistory()
                    }
                    type="button"
                  >
                    {loadingInstructions || loadingCarePrepHistory
                      ? "Loading..."
                      : "Reload"}
                  </button>
                </div>

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
                    CarePrep History
                  </button>
                </div>

                {aiAdminTab === "instructions" ? (
                  <>
                <form className="mt-5 space-y-4" onSubmit={handleSaveCarePrepInstructions}>
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
                      placeholder="Paste the CarePrep system instructions here."
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
                      placeholder="Paste the user/context prompt template here."
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
                ) : (
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
                )}
              </section>
            ) : null}

            {signedInEmail ? (
              <div className="flex flex-wrap gap-2">
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
                    </p>
                  </div>
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

            {appointments.length === 0 ? (
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
                const mapsLink = googleMapsUrl(appointment.location_address);
                const calendarLink = agicalUrl(appointment);
                const providerLine = [
                  appointment.provider_name,
                  appointment.provider_organization,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <article
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                    key={appointment.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-semibold">
                          {appointment.title || "Untitled appointment"}
                        </h2>
                        <p className="mt-1 text-slate-600">
                          {formatDate(appointment.starts_at)}
                        </p>
                        {providerLine ? (
                          <p className="mt-1 text-sm font-medium text-slate-700">
                            {providerLine}
                          </p>
                        ) : null}
                        {appointmentSubject ? (
                          <p className="mt-1 text-sm font-medium text-slate-500">
                            For {appointmentSubject.display_name}
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
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                        {appointment.status}
                      </span>
                    </div>

                    {!isEditingAppointment && !isArchived ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {mapsLink ? (
                          <a
                            aria-label="Open in Google Maps"
                            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            href={mapsLink}
                            rel="noreferrer"
                            target="_blank"
                            title="Open in Google Maps"
                          >
                            <svg
                              aria-hidden="true"
                              className="h-4 w-4"
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
                            Maps
                          </a>
                        ) : null}
                        {calendarLink ? (
                          <a
                            aria-label="Add to calendar"
                            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            href={calendarLink}
                            rel="noreferrer"
                            target="_blank"
                            title="Add to calendar"
                          >
                            <svg
                              aria-hidden="true"
                              className="h-4 w-4"
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
                            Calendar
                          </a>
                        ) : null}
                        {canPasteContextualNotes ? (
                          <button
                            className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700"
                            onClick={() => startTypingNote(appointment.id)}
                            type="button"
                          >
                            Type
                          </button>
                        ) : null}
                        {canPasteContextualNotes ? (
                          <button
                            className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700"
                            onClick={() => startContextualTextIntake(appointment)}
                            type="button"
                          >
                            Paste
                          </button>
                        ) : null}
                        <button
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                          onClick={() => startEditingAppointment(appointment)}
                          type="button"
                        >
                          Edit appointment
                        </button>
                        <button
                          className="rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:text-slate-400"
                          disabled={archivingAppointmentForId === appointment.id}
                          onClick={() => handleArchiveAppointment(appointment)}
                          type="button"
                        >
                          {archivingAppointmentForId === appointment.id
                            ? "Archiving..."
                            : "Archive appointment"}
                        </button>
                      </div>
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
                              Paste notes for this appointment
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
                            <p className="mt-3 text-xs text-blue-800">
                              Confidence{" "}
                              {Math.round(textIntakeDraft.confidence * 100)}%
                              {textIntakeDraft.suggestedAction
                                ? ` · ${textIntakeDraft.suggestedAction}`
                                : ""}
                            </p>
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
                        className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4"
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

                    {!isArchived &&
                    !isContextualTextIntake &&
                    ((note && !isEditingNote) || (!note && !isEditingNote) ? null : (
                      <form
                        className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4"
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
                          {note ? (
                            <button
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                              onClick={() => cancelEditingNote(appointment.id)}
                              type="button"
                            >
                              Cancel
                            </button>
                          ) : null}
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
                    ))}
                  </article>
                );
              })
            )}
          </div>
        </div>
        )}
      </section>
    </main>
  );
}
