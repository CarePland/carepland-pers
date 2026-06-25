type JsonObject = Record<string, unknown>;

export const maxImportAnythingDraftItemsPerKind = 12;
export const maxImportAnythingDraftStringChars = 2_000;
export const maxImportAnythingDraftListItems = 12;
export const maxImportAnythingDraftSummaryChars = 800;
export const maxImportAnythingOwnershipClusters = 12;

type NormalizeImportAnythingDraftOptions = {
  allowedMatchedAppointmentIds?: Iterable<string>;
  allowedMatchedCareSubjectIds?: Iterable<string>;
  allowedMatchedProviderIds?: Iterable<string>;
};

function objectFromUnknown(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function arrayFromUnknown(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value
        .map((item) => objectFromUnknown(item))
        .slice(0, maxImportAnythingDraftItemsPerKind)
    : [];
}

function stringFromUnknown(
  value: unknown,
  maxChars = maxImportAnythingDraftStringChars
): string {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}

function booleanFromUnknown(value: unknown): boolean {
  return value === true;
}

function confidenceFromUnknown(value: unknown): number {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(1, Math.max(0, numericValue));
}

function textListFromUnknown(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => stringFromUnknown(item))
        .filter(Boolean)
        .slice(0, maxImportAnythingDraftListItems)
    : [];
}

function itemConfidence(item: JsonObject) {
  const itemValue = confidenceFromUnknown(item.confidence);
  const itemPersonAssignment = objectFromUnknown(item.person_assignment);
  const ownerValue = confidenceFromUnknown(itemPersonAssignment.confidence);

  return itemValue || ownerValue;
}

function reviewFields(item: JsonObject, forceNeedsReview = false) {
  const confidence = itemConfidence(item);

  return {
    confidence,
    needs_review:
      forceNeedsReview ||
      booleanFromUnknown(item.needs_review) ||
      confidence < 0.86,
    source_excerpt: stringFromUnknown(item.source_excerpt),
  };
}

function allowedIdSet(
  ids: Iterable<string> | undefined
): Set<string> | null {
  if (!ids) {
    return null;
  }

  return new Set(
    Array.from(ids)
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

function matchedAppointment(
  item: JsonObject,
  allowedMatchedAppointmentIds: Set<string> | null
): { id: string; unknownId: boolean } {
  const id = stringFromUnknown(item.matched_appointment_id);

  if (!id || !allowedMatchedAppointmentIds) {
    return { id, unknownId: false };
  }

  if (allowedMatchedAppointmentIds.has(id)) {
    return { id, unknownId: false };
  }

  return { id: "", unknownId: true };
}

function matchedProvider(
  item: JsonObject,
  allowedMatchedProviderIds: Set<string> | null
): { id: string; unknownId: boolean } {
  const id = stringFromUnknown(item.matched_provider_id);

  if (!id || !allowedMatchedProviderIds) {
    return { id, unknownId: false };
  }

  if (allowedMatchedProviderIds.has(id)) {
    return { id, unknownId: false };
  }

  return { id: "", unknownId: true };
}

function normalizePersonAssignment(
  value: unknown,
  allowedMatchedCareSubjectIds: Set<string> | null
) {
  const assignment = objectFromUnknown(value);
  const matchedCareSubjectId = stringFromUnknown(
    assignment.matched_care_subject_id
  );

  return {
    cluster_id: stringFromUnknown(assignment.cluster_id),
    confidence: confidenceFromUnknown(assignment.confidence),
    detected_name: stringFromUnknown(assignment.detected_name),
    matched_care_subject_id:
      matchedCareSubjectId &&
      (!allowedMatchedCareSubjectIds ||
        allowedMatchedCareSubjectIds.has(matchedCareSubjectId))
        ? matchedCareSubjectId
        : "",
    needs_review:
      booleanFromUnknown(assignment.needs_review) ||
      Boolean(
        matchedCareSubjectId &&
          allowedMatchedCareSubjectIds &&
          !allowedMatchedCareSubjectIds.has(matchedCareSubjectId)
      ),
    rationale: stringFromUnknown(assignment.rationale),
    suggested_new_person_name: stringFromUnknown(
      assignment.suggested_new_person_name
    ),
  };
}

function looksLikeAddress(value: string) {
  const normalizedValue = value.trim();

  return (
    /^\d+\s+\S+/.test(normalizedValue) ||
    /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|lane|ln|parkway|pkwy|way)\b/i.test(
      normalizedValue
    ) ||
    /,\s*[A-Z]{2}\b/.test(normalizedValue)
  );
}

function normalizeLocationName({
  locationAddress,
  locationName,
  providerOrganization,
}: {
  locationAddress: string;
  locationName: string;
  providerOrganization: string;
}) {
  const normalizedLocationName = locationName.trim();
  const normalizedLocationAddress = locationAddress.trim();

  if (
    providerOrganization &&
    normalizedLocationName &&
    (normalizedLocationName === normalizedLocationAddress ||
      looksLikeAddress(normalizedLocationName))
  ) {
    return providerOrganization;
  }

  return normalizedLocationName;
}

export function normalizeImportAnythingDraft(
  draftValue: unknown,
  options: NormalizeImportAnythingDraftOptions = {}
): JsonObject {
  const draft = objectFromUnknown(draftValue);
  const matchedIds = allowedIdSet(options.allowedMatchedAppointmentIds);
  const matchedCareSubjectIds = allowedIdSet(options.allowedMatchedCareSubjectIds);
  const matchedProviderIds = allowedIdSet(options.allowedMatchedProviderIds);
  const personAssignment = objectFromUnknown(draft.person_assignment);

  return {
    appointments: arrayFromUnknown(draft.appointments).map((item) => {
      const match = matchedAppointment(item, matchedIds);
      const providerMatch = matchedProvider(item, matchedProviderIds);
      const locationAddress = stringFromUnknown(item.location_address);
      const providerOrganization = stringFromUnknown(
        item.provider_organization
      );

      return {
        appointment_reason: stringFromUnknown(item.appointment_reason),
        appointment_title: stringFromUnknown(item.appointment_title),
        location_address: locationAddress,
        location_name: normalizeLocationName({
          locationAddress,
          locationName: stringFromUnknown(item.location_name),
          providerOrganization,
        }),
        location_phone: stringFromUnknown(item.location_phone),
        matched_appointment_id: match.id,
        matched_provider_id: providerMatch.id,
        person_assignment: normalizePersonAssignment(
          item.person_assignment,
          matchedCareSubjectIds
        ),
        provider_match_note: stringFromUnknown(item.provider_match_note),
        provider_name: stringFromUnknown(item.provider_name),
        provider_organization: providerOrganization,
        starts_at_local: stringFromUnknown(item.starts_at_local),
        suggested_action: stringFromUnknown(item.suggested_action),
        ...reviewFields(item, match.unknownId || providerMatch.unknownId),
      };
    }),
    careprep_items: arrayFromUnknown(draft.careprep_items).map((item) => {
      const match = matchedAppointment(item, matchedIds);

      return {
        appointment_title: stringFromUnknown(item.appointment_title),
        detail: stringFromUnknown(item.detail),
        matched_appointment_id: match.id,
        person_assignment: normalizePersonAssignment(
          item.person_assignment,
          matchedCareSubjectIds
        ),
        ...reviewFields(item, match.unknownId),
      };
    }),
    import_summary: stringFromUnknown(
      draft.import_summary,
      maxImportAnythingDraftSummaryChars
    ),
    ownership_clusters: arrayFromUnknown(draft.ownership_clusters)
      .slice(0, maxImportAnythingOwnershipClusters)
      .map((cluster) => {
        const matchedCareSubjectId = stringFromUnknown(
          cluster.matched_care_subject_id
        );

        return {
          cluster_id: stringFromUnknown(cluster.cluster_id),
          confidence: confidenceFromUnknown(cluster.confidence),
          display_name: stringFromUnknown(cluster.display_name),
          entity_type: stringFromUnknown(cluster.entity_type),
          matched_care_subject_id:
            matchedCareSubjectId &&
            (!matchedCareSubjectIds ||
              matchedCareSubjectIds.has(matchedCareSubjectId))
              ? matchedCareSubjectId
              : "",
          rationale: stringFromUnknown(cluster.rationale),
          suggested_new_person_name: stringFromUnknown(
            cluster.suggested_new_person_name
          ),
        };
      })
      .filter((cluster) => cluster.cluster_id || cluster.display_name),
    medication_changes: arrayFromUnknown(draft.medication_changes).map(
      (item) => {
        const match = matchedAppointment(item, matchedIds);

        return {
          change_summary: stringFromUnknown(item.change_summary),
          instructions: stringFromUnknown(item.instructions),
          matched_appointment_id: match.id,
          medication_name: stringFromUnknown(item.medication_name),
          person_assignment: normalizePersonAssignment(
            item.person_assignment,
            matchedCareSubjectIds
          ),
          ...reviewFields(item, match.unknownId),
        };
      }
    ),
    notes: arrayFromUnknown(draft.notes).map((item) => {
      const match = matchedAppointment(item, matchedIds);

      return {
        appointment_title: stringFromUnknown(item.appointment_title),
        followups: textListFromUnknown(item.followups),
        matched_appointment_id: match.id,
        person_assignment: normalizePersonAssignment(
          item.person_assignment,
          matchedCareSubjectIds
        ),
        summary: stringFromUnknown(item.summary),
        takeaways: textListFromUnknown(item.takeaways),
        ...reviewFields(item, match.unknownId),
      };
    }),
    providers: arrayFromUnknown(draft.providers).map((item) => {
      const providerMatch = matchedProvider(item, matchedProviderIds);
      const locationAddress = stringFromUnknown(item.location_address);
      const providerOrganization = stringFromUnknown(
        item.provider_organization
      );

      return {
        location_address: locationAddress,
        location_name: normalizeLocationName({
          locationAddress,
          locationName: stringFromUnknown(item.location_name),
          providerOrganization,
        }),
        matched_provider_id: providerMatch.id,
        person_assignment: normalizePersonAssignment(
          item.person_assignment,
          matchedCareSubjectIds
        ),
        phone: stringFromUnknown(item.phone),
        provider_match_note: stringFromUnknown(item.provider_match_note),
        provider_name: stringFromUnknown(item.provider_name),
        provider_organization: providerOrganization,
        ...reviewFields(item, providerMatch.unknownId),
      };
    }),
    person_assignment: normalizePersonAssignment(
      personAssignment,
      matchedCareSubjectIds
    ),
    questions_to_ask: arrayFromUnknown(draft.questions_to_ask).map((item) => {
      const match = matchedAppointment(item, matchedIds);

      return {
        matched_appointment_id: match.id,
        person_assignment: normalizePersonAssignment(
          item.person_assignment,
          matchedCareSubjectIds
        ),
        question: stringFromUnknown(item.question),
        topic: stringFromUnknown(item.topic),
        ...reviewFields(item, match.unknownId),
      };
    }),
    tasks: arrayFromUnknown(draft.tasks).map((item) => {
      const match = matchedAppointment(item, matchedIds);

      return {
        details: stringFromUnknown(item.details),
        due_at_local: stringFromUnknown(item.due_at_local),
        matched_appointment_id: match.id,
        person_assignment: normalizePersonAssignment(
          item.person_assignment,
          matchedCareSubjectIds
        ),
        title: stringFromUnknown(item.title),
        ...reviewFields(item, match.unknownId),
      };
    }),
  };
}
