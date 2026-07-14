import type {
  AppointmentCommunicationSummaryCategory,
  AppointmentCommunicationSummaryItem,
} from "./communicationSummary";

export type WhatToKnowSourceType = "careprep" | "communication";

export type WhatToKnowDisplayItem = {
  key: string;
  sourceLabel?: string;
  text: string;
  sourceTypes: WhatToKnowSourceType[];
};

export type WhatToKnowCategoryItems = Record<
  AppointmentCommunicationSummaryCategory,
  WhatToKnowDisplayItem[]
>;

export type WhatToKnowDisplayModel = {
  categories: WhatToKnowCategoryItems;
  hasItems: boolean;
};

export type WhatToKnowCarePrepInput = Partial<
  Record<AppointmentCommunicationSummaryCategory, string[]>
>;

export function buildWhatToKnowDisplayModel({
  carePrep = {},
  communicationItems = [],
}: {
  carePrep?: WhatToKnowCarePrepInput;
  communicationItems?: AppointmentCommunicationSummaryItem[];
}): WhatToKnowDisplayModel {
  const categories: WhatToKnowCategoryItems = {
    bring_list: mergeWhatToKnowCategoryItems({
      carePrepItems: carePrep.bring_list ?? [],
      communicationItems: itemsForCategory(communicationItems, "bring_list"),
    }),
    key_questions: mergeWhatToKnowCategoryItems({
      carePrepItems: carePrep.key_questions ?? [],
      communicationItems: itemsForCategory(communicationItems, "key_questions"),
    }),
    watchouts: mergeWhatToKnowCategoryItems({
      carePrepItems: carePrep.watchouts ?? [],
      communicationItems: itemsForCategory(communicationItems, "watchouts"),
    }),
    med_review: mergeWhatToKnowCategoryItems({
      carePrepItems: carePrep.med_review ?? [],
      communicationItems: itemsForCategory(communicationItems, "med_review"),
    }),
    since_last_visit: mergeWhatToKnowCategoryItems({
      carePrepItems: carePrep.since_last_visit ?? [],
      communicationItems: itemsForCategory(communicationItems, "since_last_visit"),
    }),
    next_steps: mergeWhatToKnowCategoryItems({
      carePrepItems: carePrep.next_steps ?? [],
      communicationItems: itemsForCategory(communicationItems, "next_steps"),
    }),
  };

  return {
    categories,
    hasItems: Object.values(categories).some((items) => items.length > 0),
  };
}

export function mergeWhatToKnowCategoryItems({
  carePrepItems,
  communicationItems,
}: {
  carePrepItems: string[];
  communicationItems: AppointmentCommunicationSummaryItem[];
}): WhatToKnowDisplayItem[] {
  const displayItems: WhatToKnowDisplayItem[] = [];

  for (const item of carePrepItems) {
    const text = cleanText(item);
    if (!text) continue;
    displayItems.push({
      key: `careprep:${normalizeComparableText(text)}`,
      sourceTypes: ["careprep"],
      text,
    });
  }

  for (const item of communicationItems.filter((candidate) => candidate.status === "active")) {
    const text = cleanText(item.text);
    if (!text) continue;
    const comparable = normalizeComparableText(text);
    const existing = displayItems.find((candidate) =>
      areSimilarWhatToKnowItems(candidate.text, comparable)
    );
    if (existing) {
      if (!existing.sourceTypes.includes("communication")) {
        existing.sourceTypes.push("communication");
      }
      const nextSourceLabel = mergeSourceLabels(
        existing.sourceLabel,
        sourceLabelForCommunicationItem(item)
      );
      if (nextSourceLabel) {
        existing.sourceLabel = nextSourceLabel;
      }
      continue;
    }
    const sourceLabel = sourceLabelForCommunicationItem(item);
    displayItems.push({
      key: `communication:${item.id}`,
      ...(sourceLabel ? { sourceLabel } : {}),
      sourceTypes: ["communication"],
      text,
    });
  }

  return displayItems;
}

function itemsForCategory(
  items: AppointmentCommunicationSummaryItem[],
  category: AppointmentCommunicationSummaryCategory
) {
  return items.filter((item) => item.category === category && item.status === "active");
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function sourceLabelForCommunicationItem(item: AppointmentCommunicationSummaryItem) {
  const names = Array.from(
    new Set((item.sourceDisplayNames ?? []).map((name) => cleanText(name)).filter(Boolean))
  );
  if (names.length === 0) return undefined;
  return names.length === 1 ? names[0] : `${names[0]} et al`;
}

function mergeSourceLabels(currentLabel: string | undefined, nextLabel: string | undefined) {
  if (!currentLabel) return nextLabel;
  if (!nextLabel || currentLabel === nextLabel) return currentLabel;
  const currentBase = currentLabel.replace(/\s+et al$/i, "");
  const nextBase = nextLabel.replace(/\s+et al$/i, "");
  return currentBase === nextBase ? currentLabel : `${currentBase} et al`;
}

function normalizeComparableText(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\b(the|a|an|current|your|please|remember|to)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function areSimilarWhatToKnowItems(existingText: string, normalizedCandidate: string) {
  const normalizedExisting = normalizeComparableText(existingText);
  return (
    normalizedExisting === normalizedCandidate ||
    normalizedExisting.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedExisting) ||
    (/\b(glasses|sunglasses)\b/.test(normalizedExisting) &&
      /\b(glasses|sunglasses)\b/.test(normalizedCandidate))
  );
}
