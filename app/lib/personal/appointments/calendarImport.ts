export type BulkAppointmentDraft = {
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

export function bulkAppointmentDraftsFromResult(
  value: unknown
): BulkAppointmentDraft[] {
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

export function parseICalendarAppointments(
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
