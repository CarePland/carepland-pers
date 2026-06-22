import type { ErrandDueDateOption, ErrandDueIntent } from "../types";

const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const weekdayLookup = new Map(
  weekdayNames.flatMap((weekday, index) => {
    const normalized = weekday.toLowerCase();
    const aliases = [normalized, normalized.slice(0, 3)];

    if (normalized === "tuesday") {
      aliases.push("tu", "tues");
    }

    if (normalized === "thursday") {
      aliases.push("th", "thur", "thurs");
    }

    return aliases.map((alias) => [alias, index] as const);
  }),
);

const weekdayPattern =
  "sun|sunday|mon|monday|tu|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday";

const monthLookup = new Map(
  [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].flatMap((month, index) => [
    [month, index],
    [month.slice(0, 3), index],
  ]),
);

monthLookup.set("sept", 8);

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function nextWeekday(baseDate: Date, targetDay: number) {
  const baseDay = baseDate.getDay();
  const distance = (targetDay - baseDay + 7) % 7 || 7;
  return addDays(baseDate, distance);
}

function nextMonday(baseDate: Date) {
  return nextWeekday(baseDate, 1);
}

function nextSaturday(baseDate: Date) {
  return nextWeekday(baseDate, 6);
}

function toDateIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function dateIntent(
  sourceText: string,
  date: Date,
  confidence: "high" | "medium" = "high",
): ErrandDueDateOption {
  return {
    kind: "date",
    sourceText,
    dateIso: toDateIso(date),
    displayLabel: formatDate(date),
    confidence,
  };
}

function ambiguousDateIntent(
  sourceText: string,
  options: ErrandDueDateOption[],
): ErrandDueIntent {
  return {
    kind: "ambiguous_date",
    sourceText,
    displayLabel: "Which date?",
    options,
    confidence: "medium",
  };
}

function dateTimeIntent(
  sourceText: string,
  date: Date,
  timeLabel: string,
  confidence: "high" | "medium" = "high",
): ErrandDueDateOption {
  return {
    kind: "date_time",
    sourceText,
    dateIso: toDateIso(date),
    timeLabel,
    displayLabel: `${formatDate(date)}, ${timeLabel}`,
    confidence,
  };
}

export function addTimeToDueIntent(
  intent: ErrandDueIntent,
  timeLabel: string,
): ErrandDueIntent {
  if (intent.kind !== "date" && intent.kind !== "date_time") {
    return intent;
  }

  const date = new Date(`${intent.dateIso}T12:00:00`);

  return {
    kind: "date_time",
    sourceText: intent.sourceText,
    dateIso: intent.dateIso,
    timeLabel,
    displayLabel: `${formatDate(date)}, ${timeLabel}`,
    confidence: intent.confidence,
  };
}

export function parseNaturalDueInput(
  sourceText: string,
  baseDate = new Date(),
): ErrandDueIntent {
  const trimmedSource = sourceText.trim();
  const normalizedSource = normalizeCommonDueWords(trimmedSource);
  const normalized = normalizedSource.toLowerCase();
  const today = startOfDay(baseDate);

  if (!trimmedSource) {
    return {
      kind: "none",
      sourceText: "",
      displayLabel: "Open",
    };
  }

  const explicitDateTime = parseExplicitDateTime(
    trimmedSource,
    today,
    normalizedSource,
  );
  if (explicitDateTime) {
    return explicitDateTime;
  }

  const contextualMatch = normalized.match(
    /^(before|after|during)\s+(?:mom'?s\s+)?(.+)$/,
  );
  if (contextualMatch) {
    const relation = contextualMatch[1] as "before" | "after" | "during";
    const anchorText = contextualMatch[2].trim();
    const anchorLabel = anchorText === "appointment"
      ? "Appointment"
      : anchorText.includes("cardiology")
      ? "Mom's Cardiology Follow-Up"
      : titleCase(anchorText);

    return {
      kind: "contextual",
      sourceText: trimmedSource,
      relation,
      anchorLabel,
      anchorSearchText: anchorText === "appointment" ? undefined : anchorText,
      displayLabel: `${titleCase(relation)} ${anchorLabel}`,
      confidence: "medium",
    };
  }

  const nextAppointmentMatch = normalized.match(
    /^next\s+appointment\s+with\s+(.+)$/,
  );
  if (nextAppointmentMatch) {
    const anchorText = nextAppointmentMatch[1].trim();

    return {
      kind: "contextual",
      sourceText: trimmedSource,
      relation: "before",
      anchorLabel: titleCase(anchorText),
      anchorSearchText: anchorText,
      displayLabel: `Before ${titleCase(anchorText)}`,
      confidence: "medium",
    };
  }

  const appointmentCandidate = appointmentCandidateSearchText(normalized);
  if (appointmentCandidate) {
    return {
      kind: "appointment_candidate",
      sourceText: trimmedSource,
      anchorSearchText: appointmentCandidate,
      displayLabel: "Which appointment?",
      confidence: "medium",
    };
  }

  if (normalized === "today") {
    return dateIntent(trimmedSource, today);
  }

  if (normalized === "tomorrow") {
    return dateIntent(trimmedSource, addDays(today, 1));
  }

  const inDaysMatch = normalized.match(/^in\s+(\d{1,2})\s+days?$/);
  if (inDaysMatch) {
    return dateIntent(trimmedSource, addDays(today, Number(inDaysMatch[1])));
  }

  if (normalized === "next week") {
    return dateIntent(trimmedSource, nextMonday(today), "medium");
  }

  if (normalized === "this weekend") {
    return dateIntent(trimmedSource, nextSaturday(today), "medium");
  }

  const weekdayMatch = normalized.match(
    new RegExp(`^(?:next\\s+)?(${weekdayPattern})(?:\\s+(morning|afternoon|evening))?$`),
  );
  if (weekdayMatch) {
    const weekday = weekdayLookup.get(weekdayMatch[1]);
    if (weekday !== undefined) {
      const intent = dateIntent(trimmedSource, nextWeekday(today, weekday));
      const daypart = weekdayMatch[2];

      if (daypart) {
        const defaultTime =
          daypart === "morning"
            ? "9 AM"
            : daypart === "afternoon"
              ? "2 PM"
              : "6 PM";
        return addTimeToDueIntent(intent, defaultTime);
      }

      return intent;
    }
  }

  const datePickerDate = new Date(`${trimmedSource}T12:00:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedSource) && !Number.isNaN(datePickerDate.valueOf())) {
    return dateIntent(trimmedSource, datePickerDate);
  }

  return {
    kind: "unparsed",
    sourceText: trimmedSource,
    displayLabel: trimmedSource,
    confidence: "low",
  };
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function appointmentCandidateSearchText(normalized: string) {
  const doctorMatch = normalized.match(/^(?:doctor|dr\.?)\s+(.+)$/);
  if (doctorMatch) {
    return doctorMatch[1].trim();
  }

  const appointmentMatch = normalized.match(/^(.+?)\s+appointments?$/);
  if (appointmentMatch) {
    const searchText = appointmentMatch[1].trim();

    if (searchText && !["doctor", "mom", "the"].includes(searchText)) {
      return searchText;
    }
  }

  return undefined;
}

function normalizeCommonDueWords(value: string) {
  return value
    .trim()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((token) => {
      const normalizedToken = token.toLowerCase();
      const replacements: Record<string, string> = {
        appt: "appointment",
        appts: "appointments",
        febuary: "february",
        februrary: "february",
        nxt: "next",
        tmr: "tomorrow",
        tmrw: "tomorrow",
        tomorow: "tomorrow",
        tommorrow: "tomorrow",
      };

      return replacements[normalizedToken] ?? token;
    })
    .join(" ");
}

function parseExplicitDateTime(
  sourceText: string,
  baseDate: Date,
  normalizedSourceText = sourceText,
): ErrandDueIntent | undefined {
  const normalized = normalizedSourceText
    .trim()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");
  const weekdayPrefixMatch = normalized.match(
    new RegExp(`^(?:next\\s+)?(${weekdayPattern})\\s+(.+)$`, "i"),
  );
  const statedWeekday = weekdayPrefixMatch
    ? weekdayLookup.get(weekdayPrefixMatch[1].toLowerCase())
    : undefined;
  const dateText = weekdayPrefixMatch ? weekdayPrefixMatch[2] : normalized;

  const monthDateMatch = dateText.match(
    /^([a-zA-Z]{3,9})\s+(\d{1,2})(?:\s+(\d{4}))?(?:\s+(?:at\s+)?)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?$/i,
  );
  if (monthDateMatch) {
    const monthIndex = monthLookup.get(monthDateMatch[1].toLowerCase());
    if (monthIndex !== undefined) {
      const date = buildDate(
        baseDate,
        monthIndex,
        Number(monthDateMatch[2]),
        monthDateMatch[3] ? Number(monthDateMatch[3]) : undefined,
      );
      const timeLabel = normalizeTimeLabel(monthDateMatch[4]);
      const intent = timeLabel
        ? dateTimeIntent(sourceText, date, timeLabel)
        : dateIntent(sourceText, date);

      return resolveWeekdayDateIntent(sourceText, intent, statedWeekday);
    }
  }

  const slashDateMatch = dateText.match(
    /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(?:at\s+)?)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?$/i,
  );
  if (slashDateMatch) {
    const monthIndex = Number(slashDateMatch[1]) - 1;
    const date = buildDate(
      baseDate,
      monthIndex,
      Number(slashDateMatch[2]),
      slashDateMatch[3] ? normalizeYear(Number(slashDateMatch[3])) : undefined,
    );
    const timeLabel = normalizeTimeLabel(slashDateMatch[4]);
    const intent = timeLabel
      ? dateTimeIntent(sourceText, date, timeLabel)
      : dateIntent(sourceText, date);

    return resolveWeekdayDateIntent(sourceText, intent, statedWeekday);
  }

  const isoDateTimeMatch = dateText.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:\s+(?:at\s+)?)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?$/i,
  );
  if (isoDateTimeMatch) {
    const date = new Date(
      Number(isoDateTimeMatch[1]),
      Number(isoDateTimeMatch[2]) - 1,
      Number(isoDateTimeMatch[3]),
    );
    const timeLabel = normalizeTimeLabel(isoDateTimeMatch[4]);
    const intent = timeLabel
      ? dateTimeIntent(sourceText, date, timeLabel)
      : dateIntent(sourceText, date);

    return resolveWeekdayDateIntent(sourceText, intent, statedWeekday);
  }

  return undefined;
}

function resolveWeekdayDateIntent(
  sourceText: string,
  literalIntent: ErrandDueDateOption,
  statedWeekday?: number,
) {
  if (statedWeekday === undefined) {
    return literalIntent;
  }

  const literalDate = new Date(`${literalIntent.dateIso}T12:00:00`);
  if (literalDate.getDay() === statedWeekday) {
    return literalIntent;
  }

  const matchingWeekdayDate = nearestWeekday(literalDate, statedWeekday);
  const matchingIntent =
    literalIntent.kind === "date_time"
      ? dateTimeIntent(
          sourceText,
          matchingWeekdayDate,
          literalIntent.timeLabel,
          "medium",
        )
      : dateIntent(sourceText, matchingWeekdayDate, "medium");

  return ambiguousDateIntent(sourceText, [
    { ...literalIntent, confidence: "medium" },
    matchingIntent,
  ]);
}

function nearestWeekday(date: Date, targetDay: number) {
  const currentDay = date.getDay();
  const forwardDistance = (targetDay - currentDay + 7) % 7;
  const backwardDistance = (currentDay - targetDay + 7) % 7;

  if (forwardDistance <= backwardDistance) {
    return addDays(date, forwardDistance);
  }

  return addDays(date, -backwardDistance);
}

function buildDate(
  baseDate: Date,
  monthIndex: number,
  day: number,
  providedYear?: number,
) {
  const year = providedYear ?? baseDate.getFullYear();
  const date = new Date(year, monthIndex, day);

  if (!providedYear && date < startOfDay(baseDate)) {
    return new Date(year + 1, monthIndex, day);
  }

  return date;
}

function normalizeYear(year: number) {
  if (year < 100) {
    return 2000 + year;
  }

  return year;
}

function normalizeTimeLabel(rawTime?: string) {
  if (!rawTime) {
    return undefined;
  }

  const time = rawTime.trim().replace(/\s+/g, "").toLowerCase();
  const match = time.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);

  if (!match) {
    return rawTime.trim();
  }

  const hour = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[3]?.toUpperCase();

  if (meridiem) {
    return `${hour}${minutes ? `:${minutes}` : ""} ${meridiem}`;
  }

  return `${hour}${minutes ? `:${minutes}` : ""}`;
}
