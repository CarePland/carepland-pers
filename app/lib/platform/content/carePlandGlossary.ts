export type CarePlandGlossaryEntry = {
  active: boolean;
  description: string;
  icon: string;
  order: number;
  term: string;
};

export type CarePlandGlossaryContent = {
  entries: CarePlandGlossaryEntry[];
  intro: string;
  title: string;
};

export const carePlandGlossaryContentKey = "carepland_glossary";

export const defaultCarePlandGlossaryContent: CarePlandGlossaryContent = {
  title: "CarePland Glossary",
  intro: "",
  entries: [
    {
      active: true,
      description: "Questions about CarePland?\n\nJust Ask.",
      icon: "🤖",
      order: 10,
      term: "Ask",
    },
    {
      active: true,
      description:
        "You + the people and pets you care for = your Care Circle.",
      icon: "❤️",
      order: 20,
      term: "Care VIPs",
    },
    {
      active: true,
      description:
        "A simpler experience for a Care VIP.\n\nSend messages and reminders.\n\nAsk or type.\n\nUse it as an always-on appliance.",
      icon: "📱",
      order: 30,
      term: "Receiver",
    },
    {
      active: true,
      description:
        "Grabs useful care context from relevant files and images.",
      icon: "📥",
      order: 40,
      term: "Import Anything",
    },
  ],
};

export const defaultCarePlandGlossaryBody = JSON.stringify(
  defaultCarePlandGlossaryContent,
  null,
  2
);

const maxTitleLength = 60;
const maxIntroLength = 220;
const maxTermLength = 40;
const maxIconLength = 8;
const maxDescriptionLength = 260;

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : true;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

export function normalizeCarePlandGlossaryContent(
  value: unknown
): CarePlandGlossaryContent {
  if (!value || typeof value !== "object") {
    return defaultCarePlandGlossaryContent;
  }

  const record = value as Record<string, unknown>;
  const rawEntries = Array.isArray(record.entries) ? record.entries : [];
  const entries = rawEntries.map((entry, index) => {
    const entryRecord =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};

    return {
      active: booleanValue(entryRecord.active),
      description: stringValue(entryRecord.description).slice(0, maxDescriptionLength),
      icon: stringValue(entryRecord.icon).slice(0, maxIconLength),
      order: numberValue(entryRecord.order, (index + 1) * 10),
      term: stringValue(entryRecord.term).slice(0, maxTermLength),
    };
  });

  return {
    entries: entries.length ? entries : defaultCarePlandGlossaryContent.entries,
    intro: stringValue(record.intro).slice(0, maxIntroLength),
    title:
      stringValue(record.title).slice(0, maxTitleLength) ||
      defaultCarePlandGlossaryContent.title,
  };
}

export function parseCarePlandGlossaryBody(
  body: string | null | undefined
): CarePlandGlossaryContent {
  if (!body?.trim()) {
    return defaultCarePlandGlossaryContent;
  }

  try {
    return normalizeCarePlandGlossaryContent(JSON.parse(body));
  } catch {
    return defaultCarePlandGlossaryContent;
  }
}

export function serializeCarePlandGlossaryContent(
  content: CarePlandGlossaryContent
) {
  return JSON.stringify(normalizeCarePlandGlossaryContent(content), null, 2);
}

export function validateCarePlandGlossaryContent(
  content: CarePlandGlossaryContent
) {
  const errors: string[] = [];
  const normalized = normalizeCarePlandGlossaryContent(content);
  const activeEntries = normalized.entries.filter((entry) => entry.active);
  const seenOrders = new Set<number>();

  if (!normalized.title.trim()) {
    errors.push("Glossary title is required.");
  }

  if (normalized.title.length > maxTitleLength) {
    errors.push(`Glossary title must be ${maxTitleLength} characters or fewer.`);
  }

  if (normalized.intro.length > maxIntroLength) {
    errors.push(`Intro text must be ${maxIntroLength} characters or fewer.`);
  }

  if (activeEntries.length === 0) {
    errors.push("At least one active glossary entry is required.");
  }

  normalized.entries.forEach((entry, index) => {
    if (entry.active && !entry.term.trim()) {
      errors.push(`Entry ${index + 1} needs a term.`);
    }

    if (entry.active && !entry.description.trim()) {
      errors.push(`Entry ${index + 1} needs a description.`);
    }

    if (entry.term.length > maxTermLength) {
      errors.push(`Entry ${index + 1} term is too long.`);
    }

    if (entry.icon.length > maxIconLength) {
      errors.push(`Entry ${index + 1} icon text is too long.`);
    }

    if (entry.description.length > maxDescriptionLength) {
      errors.push(`Entry ${index + 1} description is too long.`);
    }

    if (seenOrders.has(entry.order)) {
      errors.push("Display order values must be unique.");
    }

    seenOrders.add(entry.order);
  });

  return errors;
}
