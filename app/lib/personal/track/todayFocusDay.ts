export const todayFocusResetHour = 4;

export type TodayFocusCompletionWindow = {
  endUtc: Date;
  startUtc: Date;
  timeZone: string;
};

type ZonedParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  year: number;
};

export function todayFocusCompletionWindow(
  now: Date = new Date(),
  requestedTimeZone?: string | null
): TodayFocusCompletionWindow {
  const timeZone = validTimeZoneOrLocal(requestedTimeZone);
  const localNow = zonedParts(now, timeZone);
  const resetDay =
    localNow.hour < todayFocusResetHour
      ? previousLocalDay(localNow)
      : localNow;
  const nextResetDay = addLocalDays(resetDay, 1);

  return {
    endUtc: zonedDateTimeToUtc(nextResetDay, todayFocusResetHour, timeZone),
    startUtc: zonedDateTimeToUtc(resetDay, todayFocusResetHour, timeZone),
    timeZone,
  };
}

function zonedDateTimeToUtc(
  dateParts: Pick<ZonedParts, "day" | "month" | "year">,
  hour: number,
  timeZone: string
) {
  const wantedUtc = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    hour,
    0,
    0,
    0
  );
  let utcMs = wantedUtc;

  for (let index = 0; index < 4; index += 1) {
    const parts = zonedParts(new Date(utcMs), timeZone);
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0
    );
    const diff = representedUtc - wantedUtc;

    if (diff === 0) break;
    utcMs -= diff;
  }

  return new Date(utcMs);
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  return {
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    month: values.month,
    second: values.second,
    year: values.year,
  };
}

function previousLocalDay(parts: Pick<ZonedParts, "day" | "month" | "year">) {
  return addLocalDays(parts, -1);
}

function addLocalDays(
  parts: Pick<ZonedParts, "day" | "month" | "year">,
  days: number
) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);

  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

function validTimeZoneOrLocal(requestedTimeZone?: string | null) {
  const fallback =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  const candidate = requestedTimeZone?.trim() || fallback;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return fallback;
  }
}
