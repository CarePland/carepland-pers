export type ReceiverCachedAppointment = {
  id: string;
  locationAddress: string;
  locationName: string;
  locationPhone: string;
  providerName: string;
  providerOrganization: string;
  reason: string;
  startsAt: string;
  title: string;
};

export type ReceiverAppointmentCacheEntry = {
  appointments: ReceiverCachedAppointment[];
  cachedAt: string;
  personId: string;
  version: 1;
};

export type ReceiverStorageLike = {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

const receiverAppointmentCachePrefix =
  "carepland-connect-receiver-appointment-cache-v1";

export function receiverAppointmentCacheKey(personId: string) {
  return `${receiverAppointmentCachePrefix}:${encodeURIComponent(personId)}`;
}

export function normalizeReceiverAppointmentCacheFields(
  appointment: Partial<ReceiverCachedAppointment> & { id?: string },
  fallbackIndex = 0
): ReceiverCachedAppointment {
  return {
    id: String(appointment.id || `appointment-${fallbackIndex}`),
    locationAddress: String(appointment.locationAddress || ""),
    locationName: String(appointment.locationName || ""),
    locationPhone: String(appointment.locationPhone || ""),
    providerName: String(appointment.providerName || ""),
    providerOrganization: String(appointment.providerOrganization || ""),
    reason: String(appointment.reason || ""),
    startsAt: String(appointment.startsAt || ""),
    title: String(appointment.title || "Appointment"),
  };
}

export function writeReceiverAppointmentCache(
  storage: ReceiverStorageLike,
  personId: string,
  appointments: Array<Partial<ReceiverCachedAppointment> & { id?: string }>,
  cachedAt = new Date().toISOString()
): ReceiverAppointmentCacheEntry | null {
  if (!personId) return null;

  const entry: ReceiverAppointmentCacheEntry = {
    appointments: appointments.map((appointment, index) =>
      normalizeReceiverAppointmentCacheFields(appointment, index)
    ),
    cachedAt,
    personId,
    version: 1,
  };

  storage.setItem(receiverAppointmentCacheKey(personId), JSON.stringify(entry));
  return entry;
}

export function readReceiverAppointmentCache(
  storage: ReceiverStorageLike,
  personId: string
): ReceiverAppointmentCacheEntry | null {
  if (!personId) return null;

  const raw = storage.getItem(receiverAppointmentCacheKey(personId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ReceiverAppointmentCacheEntry>;
    if (
      parsed.version !== 1 ||
      parsed.personId !== personId ||
      typeof parsed.cachedAt !== "string" ||
      !Array.isArray(parsed.appointments)
    ) {
      storage.removeItem(receiverAppointmentCacheKey(personId));
      return null;
    }

    return {
      appointments: parsed.appointments.map((appointment, index) =>
        normalizeReceiverAppointmentCacheFields(appointment, index)
      ),
      cachedAt: parsed.cachedAt,
      personId,
      version: 1,
    };
  } catch {
    storage.removeItem(receiverAppointmentCacheKey(personId));
    return null;
  }
}

export function receiverOfflineActionMessage() {
  return "CarePland is offline right now. This feature needs an internet connection.";
}

export function receiverConnectivityStatusLabel(input: {
  cachedAppointmentCount?: number;
  online: boolean;
}) {
  if (input.online) return "Online";
  return input.cachedAppointmentCount ? "Offline — using saved appointment info" : "Offline";
}

export function formatReceiverCacheTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}
