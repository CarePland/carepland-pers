export type ConnectAppointmentRow = {
  care_subject_id: string | null;
  id: string;
  location_address: string | null;
  location_name: string | null;
  location_phone: string | null;
  provider_name: string | null;
  provider_organization: string | null;
  reason: string | null;
  starts_at: string | null;
  status: string | null;
  title: string | null;
};

export function normalizeConnectAppointment(row: ConnectAppointmentRow) {
  return {
    careSubjectId: row.care_subject_id,
    id: row.id,
    locationAddress: row.location_address ?? "",
    locationName: row.location_name ?? "",
    locationPhone: row.location_phone ?? "",
    providerName: row.provider_name ?? "",
    providerOrganization: row.provider_organization ?? "",
    reason: row.reason ?? "",
    startsAt: row.starts_at ?? "",
    title:
      row.title?.trim() ||
      row.reason?.trim() ||
      "Untitled appointment",
  };
}

export function normalizeConnectAppointments(rows: ConnectAppointmentRow[]) {
  return rows.map(normalizeConnectAppointment);
}
