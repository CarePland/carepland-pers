export type AdminSensitiveResourceType =
  | "appointment_details"
  | "appointment_note"
  | "careprep_guidance"
  | "profile_contact";

export type AdminRevealedSensitiveData = Record<string, unknown> & {
  resource_type?: AdminSensitiveResourceType;
};

export type AdminReadonlyCareSubject = {
  display_name: string;
  id: string;
};

export type AdminReadonlyProfile = {
  account_created_at?: string | null;
  beta_disclaimer_acknowledged_at: string | null;
  beta_privacy_acknowledged_at: string | null;
  beta_terms_acknowledged_at: string | null;
  display_name: string | null;
  has_contact_details: boolean;
  id: string;
  is_admin: boolean;
  is_test_user: boolean;
  last_seen_at?: string | null;
  masked_email: string | null;
  onboarding_completed_at: string | null;
  requires_email_update: boolean;
};

export type AdminReadonlyCounts = {
  appointment_count: number;
  careprep_count: number;
  logged_appointment_count?: number;
  note_count: number;
  support_ticket_count?: number;
  upcoming_appointment_count?: number;
};

export type AdminReadonlyEntitlement = {
  care_circle_id: string;
  max_active_subjects?: number | null;
  plan_id: string | null;
  plan_name: string | null;
  status?: string | null;
};

export type AdminReadonlyAppointment = {
  care_subject_id: string | null;
  created_at: string | null;
  current_guidance_id: string | null;
  current_guidance_review_status: string | null;
  current_note_id: string | null;
  has_careprep: boolean;
  has_location_address: boolean;
  has_location_name: boolean;
  has_location_phone: boolean;
  has_note: boolean;
  has_provider_name: boolean;
  has_provider_organization: boolean;
  has_reason: boolean;
  has_starts_at: boolean;
  id: string;
  is_sample_data: boolean;
  location_name_preview: string | null;
  provider_name_preview: string | null;
  provider_organization_preview: string | null;
  starts_on: string | null;
  status: string;
  title_preview: string | null;
  updated_at: string | null;
};

export type AdminReadonlySnapshot = {
  appointments: AdminReadonlyAppointment[];
  care_subjects: AdminReadonlyCareSubject[];
  counts: AdminReadonlyCounts;
  entitlements: AdminReadonlyEntitlement[];
  profile: AdminReadonlyProfile;
};

export function adminSensitiveKey(
  resourceType: AdminSensitiveResourceType,
  resourceId: string | null = null
) {
  return `${resourceType}:${resourceId ?? "profile"}`;
}
