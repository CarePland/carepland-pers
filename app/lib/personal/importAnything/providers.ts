export type ImportAnythingProviderReviewItem = {
  fields: Record<string, string | undefined>;
  kind: string;
  matchedProviderId?: string;
  status: string;
};

export type ImportAnythingProviderUpsert = {
  care_circle_id: string;
  care_subject_id: string;
  created_by_user_id: string;
  last_seen_at: string;
  location_address: string | null;
  location_name: string | null;
  normalized_provider_name: string;
  normalized_provider_organization: string;
  phone: string | null;
  provider_name: string | null;
  provider_organization: string | null;
  source: "import_anything";
  source_intake_item_id: string | null;
  updated_at: string;
};

type ImportAnythingProviderCandidateRow = {
  care_subject_id?: unknown;
  id?: unknown;
  location_address?: unknown;
  location_name?: unknown;
  nickname?: unknown;
  phone?: unknown;
  provider_name?: unknown;
  provider_organization?: unknown;
};

export type ImportAnythingProviderCandidate = {
  care_subject_id: string;
  id: string;
  location_address: string;
  location_name: string;
  nickname: string;
  phone: string;
  provider_name: string;
  provider_organization: string;
};

type BuildImportAnythingProviderUpsertsInput = {
  careCircleId: string;
  careSubjectId: string;
  generatedAt: string;
  intakeItemId: string | null;
  items: ImportAnythingProviderReviewItem[];
  userId: string;
};

export const maxImportAnythingProviderCandidates = 30;
export const maxImportAnythingProviderCandidateFieldChars = 240;

function stringFromUnknown(value: unknown): string {
  return typeof value === "string"
    ? value.trim().slice(0, maxImportAnythingProviderCandidateFieldChars)
    : "";
}

function normalizedProviderKey(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function nullableText(value: string | undefined): string | null {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

export function buildImportAnythingProviderUpserts({
  careCircleId,
  careSubjectId,
  generatedAt,
  intakeItemId,
  items,
  userId,
}: BuildImportAnythingProviderUpsertsInput): ImportAnythingProviderUpsert[] {
  const upserts = new Map<string, ImportAnythingProviderUpsert>();

  for (const item of items) {
    if (
      item.status !== "approved" ||
      (item.kind !== "appointment" && item.kind !== "provider") ||
      item.matchedProviderId?.trim()
    ) {
      continue;
    }

    const normalizedProviderName = normalizedProviderKey(
      item.fields.providerName
    );
    const normalizedProviderOrganization = normalizedProviderKey(
      item.fields.providerOrganization
    );

    if (!normalizedProviderName && !normalizedProviderOrganization) {
      continue;
    }

    const key = `${normalizedProviderName}:${normalizedProviderOrganization}`;

    if (upserts.has(key)) {
      continue;
    }

    upserts.set(key, {
      care_circle_id: careCircleId,
      care_subject_id: careSubjectId,
      created_by_user_id: userId,
      last_seen_at: generatedAt,
      location_address: nullableText(item.fields.locationAddress),
      location_name: nullableText(item.fields.locationName),
      normalized_provider_name: normalizedProviderName,
      normalized_provider_organization: normalizedProviderOrganization,
      phone: nullableText(item.fields.locationPhone ?? item.fields.phone),
      provider_name: nullableText(item.fields.providerName),
      provider_organization: nullableText(item.fields.providerOrganization),
      source: "import_anything",
      source_intake_item_id: intakeItemId,
      updated_at: generatedAt,
    });
  }

  return Array.from(upserts.values());
}

export function normalizeImportAnythingProviderCandidates(
  rows: ImportAnythingProviderCandidateRow[] | null | undefined
): ImportAnythingProviderCandidate[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => ({
      care_subject_id: stringFromUnknown(row.care_subject_id),
      id: stringFromUnknown(row.id),
      location_address: stringFromUnknown(row.location_address),
      location_name: stringFromUnknown(row.location_name),
      nickname: stringFromUnknown(row.nickname),
      phone: stringFromUnknown(row.phone),
      provider_name: stringFromUnknown(row.provider_name),
      provider_organization: stringFromUnknown(row.provider_organization),
    }))
    .filter((row) => row.id)
    .slice(0, maxImportAnythingProviderCandidates);
}
