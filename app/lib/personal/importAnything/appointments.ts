type ImportAnythingAppointmentCandidateRow = {
  care_subject_id?: unknown;
  current_note_id?: unknown;
  id?: unknown;
  location_address?: unknown;
  location_name?: unknown;
  location_phone?: unknown;
  provider_name?: unknown;
  provider_organization?: unknown;
  reason?: unknown;
  starts_at?: unknown;
  status?: unknown;
  title?: unknown;
};

export type ImportAnythingAppointmentCandidate = {
  care_subject_id: string;
  current_note_id: string;
  id: string;
  location_address: string;
  location_name: string;
  location_phone: string;
  provider_name: string;
  provider_organization: string;
  reason: string;
  starts_at: string;
  status: string;
  title: string;
};

export const maxImportAnythingAppointmentCandidates = 60;
export const maxImportAnythingAppointmentCandidateFieldChars = 240;

function stringFromUnknown(value: unknown): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxImportAnythingAppointmentCandidateFieldChars)
    : "";
}

export function normalizeImportAnythingAppointmentCandidates(
  rows: ImportAnythingAppointmentCandidateRow[] | null | undefined
): ImportAnythingAppointmentCandidate[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => ({
      care_subject_id: stringFromUnknown(row.care_subject_id),
      current_note_id: stringFromUnknown(row.current_note_id),
      id: stringFromUnknown(row.id),
      location_address: stringFromUnknown(row.location_address),
      location_name: stringFromUnknown(row.location_name),
      location_phone: stringFromUnknown(row.location_phone),
      provider_name: stringFromUnknown(row.provider_name),
      provider_organization: stringFromUnknown(row.provider_organization),
      reason: stringFromUnknown(row.reason),
      starts_at: stringFromUnknown(row.starts_at),
      status: stringFromUnknown(row.status),
      title: stringFromUnknown(row.title),
    }))
    .filter((row) => row.id)
    .slice(0, maxImportAnythingAppointmentCandidates);
}
