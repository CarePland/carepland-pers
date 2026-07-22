// Import Anything review-item domain types and pure derivations.
//
// This is the canonical shape for a single reviewable Import Anything item
// (an appointment/provider/note/task/medication_change/question/careprep
// candidate extracted from pasted text, an image, or a file) plus the pure
// functions that build, summarize, and group those items.
//
// importAnythingAppointmentChoiceLabel and importAnythingMatchedAppointmentLabel
// still remain in CarePlandPers.tsx: both take the app's core Appointment type,
// which is defined inline there and used far beyond Import Anything. Moving or
// exporting that type is a materially bigger call (where the canonical
// Appointment type should live) than this extraction's scope, so those two
// functions stay put until that's a decision worth making on its own.
//
// Other app/lib/personal/importAnything modules (e.g. review.ts) define their
// own narrower, purpose-specific item shapes for specific pipelines (such as
// CarePrep draft generation) rather than importing this full canonical type --
// that is an existing, deliberate pattern in this codebase, not something this
// file changes.

import { asTextList } from "../editor/editorState";
import {
  arrayFromUnknown,
  numberFromUnknown,
  stringFromUnknown,
} from "../../platform/unknownValueCoercion";

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

export function importAnythingPersonAssignmentFromUnknown(
  value: unknown
): ImportAnythingPersonAssignment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const assignment = value as Record<string, unknown>;
  const confidence =
    typeof assignment.confidence === "number" &&
    Number.isFinite(assignment.confidence)
      ? Math.min(1, Math.max(0, assignment.confidence))
      : 0;

  return {
    clusterId: stringFromUnknown(assignment.cluster_id),
    confidence,
    detectedName: stringFromUnknown(assignment.detected_name),
    matchedCareSubjectId: stringFromUnknown(
      assignment.matched_care_subject_id
    ),
    needsReview: assignment.needs_review === true,
    rationale: stringFromUnknown(assignment.rationale),
    suggestedNewPersonName: stringFromUnknown(
      assignment.suggested_new_person_name
    ),
  };
}

export function importAnythingReviewItem(
  kind: ImportAnythingItemKind,
  index: number,
  item: Record<string, unknown>,
  fields: Record<string, string>,
  titleFallback: string,
  summaryParts: string[]
): ImportAnythingReviewItem {
  const confidence = numberFromUnknown(item.confidence);
  const needsReview = item.needs_review === true || confidence < 0.86;
  const title = titleFallback.trim() || importAnythingKindLabel(kind);
  const summary =
    summaryParts.map((part) => part.trim()).filter(Boolean).join(" · ") ||
    title;
  const itemPersonAssignment = importAnythingPersonAssignmentFromUnknown(
    item.person_assignment
  );
  const matchedAppointmentId = stringFromUnknown(item.matched_appointment_id);
  const hasConfidentOwner =
    Boolean(itemPersonAssignment?.clusterId) &&
    (itemPersonAssignment?.confidence ?? 0) >= 0.85 &&
    itemPersonAssignment?.needsReview !== true;
  const itemNeedsReview = needsReview || !hasConfidentOwner;

  return {
    confidence,
    createsNewAppointment: false,
    fields,
    id: `${kind}-${index}-${title}`,
    kind,
    matchedAppointmentId,
    matchedProviderId: stringFromUnknown(item.matched_provider_id),
    needsReview: itemNeedsReview,
    ownerClusterId: hasConfidentOwner
      ? itemPersonAssignment?.clusterId ?? ""
      : "",
    ownerCareSubjectId:
      hasConfidentOwner &&
      itemPersonAssignment &&
      itemPersonAssignment.matchedCareSubjectId
        ? itemPersonAssignment.matchedCareSubjectId
        : "",
    ownerConfidence: itemPersonAssignment?.confidence ?? 0,
    ownerDetectedName: itemPersonAssignment?.detectedName ?? "",
    ownerNeedsReview: itemPersonAssignment?.needsReview ?? true,
    ownerNewPersonName:
      !itemPersonAssignment?.matchedCareSubjectId &&
      itemPersonAssignment?.suggestedNewPersonName
        ? itemPersonAssignment.suggestedNewPersonName
        : "",
    ownerRationale: itemPersonAssignment?.rationale ?? "",
    providerMatchNote: stringFromUnknown(item.provider_match_note),
    sourceExcerpt: stringFromUnknown(item.source_excerpt),
    status: itemNeedsReview ? "needs_review" : "approved",
    summary,
    title,
  };
}

export function importAnythingItemsFromDraft(
  draftValue: unknown
): ImportAnythingReviewItem[] {
  const draft =
    draftValue && typeof draftValue === "object" && !Array.isArray(draftValue)
      ? (draftValue as Record<string, unknown>)
      : {};
  const items: ImportAnythingReviewItem[] = [];

  arrayFromUnknown(draft.appointments).forEach((item, index) => {
    const fields = {
      appointmentReason: stringFromUnknown(item.appointment_reason),
      appointmentTitle: stringFromUnknown(item.appointment_title),
      locationAddress: stringFromUnknown(item.location_address),
      locationName: stringFromUnknown(item.location_name),
      locationPhone: stringFromUnknown(item.location_phone),
      providerName: stringFromUnknown(item.provider_name),
      providerOrganization: stringFromUnknown(item.provider_organization),
      startsAt: stringFromUnknown(item.starts_at_local),
      suggestedAction: stringFromUnknown(item.suggested_action),
    };
    items.push(
      importAnythingReviewItem(
        "appointment",
        index,
        item,
        fields,
        fields.appointmentTitle || fields.appointmentReason,
        [
          fields.startsAt,
          fields.providerName || fields.providerOrganization,
          fields.locationName,
          fields.suggestedAction,
        ]
      )
    );
  });

  arrayFromUnknown(draft.providers).forEach((item, index) => {
    const fields = {
      locationAddress: stringFromUnknown(item.location_address),
      locationName: stringFromUnknown(item.location_name),
      phone: stringFromUnknown(item.phone),
      providerName: stringFromUnknown(item.provider_name),
      providerOrganization: stringFromUnknown(item.provider_organization),
    };
    items.push(
      importAnythingReviewItem(
        "provider",
        index,
        item,
        fields,
        fields.providerName || fields.providerOrganization,
        [fields.providerOrganization, fields.locationName, fields.phone]
      )
    );
  });

  arrayFromUnknown(draft.notes).forEach((item, index) => {
    const fields = {
      appointmentReason: stringFromUnknown(item.appointment_reason),
      appointmentTitle: stringFromUnknown(item.appointment_title),
      followups: asTextList(item.followups).join("\n"),
      locationAddress: stringFromUnknown(item.location_address),
      locationName: stringFromUnknown(item.location_name),
      locationPhone: stringFromUnknown(item.location_phone),
      providerName: stringFromUnknown(item.provider_name),
      providerOrganization: stringFromUnknown(item.provider_organization),
      startsAt: stringFromUnknown(item.starts_at_local),
      summary: stringFromUnknown(item.summary),
      takeaways: asTextList(item.takeaways).join("\n"),
    };
    items.push(
      importAnythingReviewItem(
        "note",
        index,
        item,
        fields,
        fields.appointmentTitle || "Visit note",
        [fields.summary]
      )
    );
  });

  arrayFromUnknown(draft.tasks).forEach((item, index) => {
    const fields = {
      details: stringFromUnknown(item.details),
      dueAt: stringFromUnknown(item.due_at_local),
      title: stringFromUnknown(item.title),
    };
    items.push(
      importAnythingReviewItem("task", index, item, fields, fields.title, [
        fields.dueAt,
        fields.details,
      ])
    );
  });

  arrayFromUnknown(draft.medication_changes).forEach((item, index) => {
    const fields = {
      changeSummary: stringFromUnknown(item.change_summary),
      instructions: stringFromUnknown(item.instructions),
      medicationName: stringFromUnknown(item.medication_name),
    };
    items.push(
      importAnythingReviewItem(
        "medication_change",
        index,
        item,
        fields,
        fields.medicationName || "Medication change",
        [fields.changeSummary, fields.instructions]
      )
    );
  });

  arrayFromUnknown(draft.questions_to_ask).forEach((item, index) => {
    const fields = {
      question: stringFromUnknown(item.question),
      topic: stringFromUnknown(item.topic),
    };
    items.push(
      importAnythingReviewItem(
        "question",
        index,
        item,
        fields,
        fields.question,
        [fields.topic]
      )
    );
  });

  arrayFromUnknown(draft.careprep_items).forEach((item, index) => {
    const fields = {
      appointmentTitle: stringFromUnknown(item.appointment_title),
      detail: stringFromUnknown(item.detail),
    };
    items.push(
      importAnythingReviewItem(
        "careprep",
        index,
        item,
        fields,
        fields.appointmentTitle || "CarePrep item",
        [fields.detail]
      )
    );
  });

  return items.map((item) => {
    if (item.kind !== "note" || item.matchedAppointmentId) {
      return item;
    }

    const supportsExtractedAppointment = items.some(
      (candidate) =>
        candidate.kind === "appointment" &&
        importAnythingFindSupportingNotes(candidate, items).some(
          (supportItem) => supportItem.id === item.id
        )
    );

    if (supportsExtractedAppointment) {
      return item;
    }

    return {
      ...item,
      createsNewAppointment: true,
      needsReview: true,
      status: "needs_review",
    };
  });
}

export function importAnythingOwnershipClustersFromDraft(
  draftValue: unknown
): ImportAnythingOwnershipCluster[] {
  const draft =
    draftValue && typeof draftValue === "object" && !Array.isArray(draftValue)
      ? (draftValue as Record<string, unknown>)
      : {};

  return arrayFromUnknown(draft.ownership_clusters).map((cluster) => ({
    clusterId: stringFromUnknown(cluster.cluster_id),
    confidence: numberFromUnknown(cluster.confidence),
    displayName: stringFromUnknown(cluster.display_name),
    entityType: stringFromUnknown(cluster.entity_type),
    matchedCareSubjectId: stringFromUnknown(cluster.matched_care_subject_id),
    rationale: stringFromUnknown(cluster.rationale),
    suggestedNewPersonName: stringFromUnknown(
      cluster.suggested_new_person_name
    ),
  }));
}
