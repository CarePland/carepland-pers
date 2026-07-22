// Import Anything review-item domain types and pure derivations.
//
// This is the canonical shape for a single reviewable Import Anything item
// (an appointment/provider/note/task/medication_change/question/careprep
// candidate extracted from pasted text, an image, or a file) plus the pure
// functions that build, summarize, and group those items. It intentionally
// only covers logic with no dependency on React state or on the still-inline
// stringFromUnknown/numberFromUnknown/arrayFromUnknown/formatDate helpers in
// CarePlandPers.tsx -- functions that need those (importAnythingReviewItem,
// importAnythingItemsFromDraft, importAnythingPersonAssignmentFromUnknown,
// importAnythingOwnershipClustersFromDraft, importAnythingAppointmentChoiceLabel,
// importAnythingMatchedAppointmentLabel) remain in CarePlandPers.tsx pending a
// separate extraction of those shared parsing/formatting helpers.
//
// Other app/lib/personal/importAnything modules (e.g. review.ts) define their
// own narrower, purpose-specific item shapes for specific pipelines (such as
// CarePrep draft generation) rather than importing this full canonical type --
// that is an existing, deliberate pattern in this codebase, not something this
// file changes.

export type ImportAnythingItemKind =
  | "appointment"
  | "careprep"
  | "medication_change"
  | "note"
  | "provider"
  | "question"
  | "task";

export type ImportAnythingReviewStatus = "approved" | "needs_review" | "rejected";

export type ImportAnythingReviewItem = {
  createsNewAppointment: boolean;
  confidence: number;
  fields: Record<string, string>;
  id: string;
  ownerClusterId: string;
  ownerCareSubjectId: string;
  ownerConfidence: number;
  ownerDetectedName: string;
  ownerNeedsReview: boolean;
  ownerNewPersonName: string;
  ownerRationale: string;
  kind: ImportAnythingItemKind;
  matchedAppointmentId: string;
  matchedProviderId: string;
  needsReview: boolean;
  providerMatchNote: string;
  sourceExcerpt: string;
  status: ImportAnythingReviewStatus;
  summary: string;
  title: string;
  userReviewed?: boolean;
};

export type ImportAnythingPersonAssignment = {
  clusterId: string;
  confidence: number;
  detectedName: string;
  matchedCareSubjectId: string;
  needsReview: boolean;
  rationale: string;
  suggestedNewPersonName: string;
};

export type ImportAnythingOwnershipCluster = {
  clusterId: string;
  confidence: number;
  displayName: string;
  entityType: string;
  matchedCareSubjectId: string;
  rationale: string;
  suggestedNewPersonName: string;
};

export type ImportAnythingPetKind = "cat" | "dog" | "other";

export function importAnythingPetKindFromSubjectType(
  subjectType?: string | null
): ImportAnythingPetKind {
  const normalizedSubjectType = subjectType?.trim().toLowerCase() ?? "";

  if (normalizedSubjectType === "dog") {
    return "dog";
  }

  if (normalizedSubjectType === "pet" || normalizedSubjectType.startsWith("pet:")) {
    return "other";
  }

  return "cat";
}

export function importAnythingPetLabel(kind: ImportAnythingPetKind, otherValue: string) {
  if (kind === "cat") {
    return "Cat";
  }

  if (kind === "dog") {
    return "Dog";
  }

  return otherValue.trim() || "Pet";
}

export function importAnythingPetSubjectType(
  kind: ImportAnythingPetKind,
  otherValue: string
) {
  if (kind === "cat" || kind === "dog") {
    return kind;
  }

  const customType = otherValue.trim();

  return customType ? `pet:${customType}` : "pet";
}

export function isImportAnythingProviderStoreUnavailable(error: unknown): boolean {
  const maybeError = error as { code?: string; message?: string } | null;
  const message = maybeError?.message?.toLowerCase() ?? "";

  return (
    maybeError?.code === "42P01" ||
    maybeError?.code === "42703" ||
    message.includes("care_providers")
  );
}

export function hasImportAnythingProviderIdentity(item: ImportAnythingReviewItem) {
  return Boolean(
    item.fields.providerName?.trim() || item.fields.providerOrganization?.trim()
  );
}

export function importAnythingKindLabel(kind: ImportAnythingItemKind): string {
  switch (kind) {
    case "appointment":
      return "Appointment";
    case "provider":
      return "Provider";
    case "note":
      return "Note";
    case "task":
      return "Task";
    case "medication_change":
      return "Medication Change";
    case "question":
      return "Question";
    case "careprep":
      return "CarePrep";
  }
}

export function importAnythingFieldLabel(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
}

export function pluralizeCount(count: number, singularLabel: string) {
  return `${count} ${singularLabel}${count === 1 ? "" : "s"}`;
}

export function normalizedImportAnythingText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function importAnythingOwnerKey(item: ImportAnythingReviewItem) {
  return (
    item.ownerCareSubjectId ||
    normalizedImportAnythingText(item.ownerNewPersonName) ||
    normalizedImportAnythingText(item.ownerDetectedName)
  );
}

export function importAnythingFindSupportingNotes(
  appointment: ImportAnythingReviewItem,
  items: ImportAnythingReviewItem[]
) {
  if (appointment.kind !== "appointment") {
    return [];
  }

  const appointmentTitle = normalizedImportAnythingText(
    appointment.fields.appointmentTitle || appointment.title
  );
  const appointmentOwner = importAnythingOwnerKey(appointment);

  if (!appointmentTitle) {
    return [];
  }

  return items.filter((item) => {
    if (item.kind !== "note" && item.kind !== "careprep") {
      return false;
    }

    const itemTitle = normalizedImportAnythingText(
      item.fields.appointmentTitle || item.title
    );

    return (
      itemTitle === appointmentTitle &&
      (!appointmentOwner || importAnythingOwnerKey(item) === appointmentOwner)
    );
  });
}

export function importAnythingStagingItems(items: ImportAnythingReviewItem[]) {
  const supportedItemIds = new Set(
    items
      .filter((item) => item.kind === "appointment")
      .flatMap((item) =>
        importAnythingFindSupportingNotes(item, items)
          .filter(
            (supportItem) =>
              !supportItem.needsReview && supportItem.status !== "needs_review"
          )
          .map((supportItem) => supportItem.id)
      )
  );

  return items.filter(
    (item) => item.kind !== "provider" && !supportedItemIds.has(item.id)
  );
}

export function importAnythingPracticeOfficeValue(item: ImportAnythingReviewItem) {
  return (
    item.fields.providerOrganization?.trim() ||
    item.fields.locationName?.trim() ||
    ""
  );
}

export function importAnythingSimpleFieldEntries(item: ImportAnythingReviewItem) {
  return Object.entries(item.fields).filter(
    ([field]) => field !== "providerOrganization" && field !== "locationName"
  );
}

export function importAnythingSummaryCounts(items: ImportAnythingReviewItem[]) {
  return {
    appointments: items.filter((item) => item.kind === "appointment").length,
    careprep: items.filter((item) => item.kind === "careprep").length,
    medicationChanges: items.filter(
      (item) => item.kind === "medication_change"
    ).length,
    notes: items.filter((item) => item.kind === "note").length,
    providers: items.filter((item) => item.kind === "provider").length,
    questions: items.filter((item) => item.kind === "question").length,
    tasks: items.filter((item) => item.kind === "task").length,
  };
}

export function importAnythingNewAppointmentNoteCount(
  items: ImportAnythingReviewItem[]
) {
  return items.filter(
    (item) =>
      item.kind === "note" &&
      item.createsNewAppointment &&
      item.status !== "rejected"
  ).length;
}

export function importAnythingOwnershipClusterCounts(
  items: ImportAnythingReviewItem[],
  clusters: ImportAnythingOwnershipCluster[]
) {
  const counts = new Map<string, number>();
  const clusterLabelById = new Map(
    clusters.map((cluster) => [
      cluster.clusterId,
      cluster.displayName || cluster.suggestedNewPersonName || "Unnamed",
    ])
  );

  for (const item of items) {
    const key =
      item.ownerClusterId && item.ownerConfidence >= 0.85
        ? item.ownerClusterId
        : "unassigned";

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const clusterRows = clusters.map((cluster) => ({
    count: counts.get(cluster.clusterId) ?? 0,
    label:
      cluster.displayName ||
      cluster.suggestedNewPersonName ||
      cluster.clusterId ||
      "Unnamed",
  }));
  const assignedClusterIds = new Set(clusters.map((cluster) => cluster.clusterId));
  const orphanRows = Array.from(counts.entries())
    .filter(([clusterId]) => clusterId !== "unassigned" && !assignedClusterIds.has(clusterId))
    .map(([clusterId, count]) => ({
      count,
      label: clusterLabelById.get(clusterId) ?? clusterId,
    }));
  const unassignedCount = counts.get("unassigned") ?? 0;

  return [
    ...clusterRows,
    ...orphanRows,
    ...(unassignedCount > 0 ? [{ count: unassignedCount, label: "Unassigned" }] : []),
  ].filter((row) => row.count > 0 || row.label !== "Unassigned");
}

export function importAnythingDeterministicSummary(
  items: ImportAnythingReviewItem[],
  clusters: ImportAnythingOwnershipCluster[]
) {
  const counts = importAnythingSummaryCounts(items);
  const itemParts = [
    counts.appointments
      ? pluralizeCount(counts.appointments, "appointment")
      : "",
    importAnythingNewAppointmentNoteCount(items)
      ? pluralizeCount(
          importAnythingNewAppointmentNoteCount(items),
          "appointment from Visit Notes"
        )
      : "",
    counts.tasks ? pluralizeCount(counts.tasks, "task") : "",
    counts.medicationChanges
      ? pluralizeCount(counts.medicationChanges, "medication change")
      : "",
    counts.questions ? pluralizeCount(counts.questions, "question") : "",
    counts.careprep ? pluralizeCount(counts.careprep, "CarePrep item") : "",
  ].filter(Boolean);
  const clusterRows = importAnythingOwnershipClusterCounts(items, clusters);
  const clusterLabels = clusterRows
    .filter((row) => row.count > 0)
    .map((row) => row.label);

  return `Found ${itemParts.join(", ") || "review items"}${
    clusterLabels.length > 0
      ? ` across ${clusterLabels.join(", ")}`
      : ""
  }.${counts.notes ? " Supporting notes were attached automatically." : ""}`;
}
