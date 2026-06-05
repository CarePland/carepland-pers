export type SectionNoteDraft = {
  followups: string;
  summary: string;
  takeaways: string;
};

export type SavedSectionNote = {
  followups: unknown;
  summary_short: string | null;
  takeaways: unknown;
};

export type IntakeDraftContent = {
  appointmentReason: string;
  appointmentTitle: string;
  followups: string;
  locationAddress: string;
  locationName: string;
  locationPhone: string;
  notesSummary: string;
  providerName: string;
  providerOrganization: string;
  startsAt: string;
  takeaways: string;
};

export type IntakeReviewDraftContent = IntakeDraftContent & {
  confidence: number;
  suggestedAction: string;
};

export type AppointmentDetailsDraft = {
  locationAddress: string;
  locationName: string;
  locationPhone: string;
  providerName: string;
  providerOrganization: string;
  reason: string;
  startsAt: string;
  status: string;
  title: string;
};

export type SavedAppointmentDetails = {
  location_address: string | null;
  location_name: string | null;
  location_phone: string | null;
  provider_name: string | null;
  provider_organization: string | null;
  reason: string | null;
  startsAt: string;
  status: string;
  title: string | null;
};

export type CarePrepFormDraft = {
  bringList: string;
  keyQuestions: string;
  medReview: string;
  nextSteps: string;
  sinceLastVisit: string;
  summary: string;
  watchouts: string;
};

export type SavedCarePrepGuidance = {
  bring_list: unknown;
  key_questions: unknown;
  med_review?: unknown;
  next_steps?: unknown;
  since_last_visit?: unknown;
  summary: string | null;
  watchouts: unknown;
};

export function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && "text" in item) {
        return String(item.text);
      }

      return "";
    })
    .filter(Boolean);
}

export function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function normalizeLineList(value: string): string {
  return linesToList(value).join("\n");
}

export function normalizeSavedLineList(value: unknown): string {
  return asTextList(value)
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");
}

export function sectionNoteDraftHasContent(draft: SectionNoteDraft): boolean {
  return Boolean(
    normalizeText(draft.summary) ||
      normalizeLineList(draft.takeaways) ||
      normalizeLineList(draft.followups)
  );
}

export function sectionNoteDraftHasChanges(
  draft: SectionNoteDraft,
  savedNote: SavedSectionNote | null | undefined
): boolean {
  if (!savedNote) {
    return sectionNoteDraftHasContent(draft);
  }

  return (
    normalizeText(draft.summary) !== normalizeText(savedNote.summary_short) ||
    normalizeLineList(draft.takeaways) !==
      normalizeSavedLineList(savedNote.takeaways) ||
    normalizeLineList(draft.followups) !==
      normalizeSavedLineList(savedNote.followups)
  );
}

export function intakeDraftHasSaveableNotes(
  draft: IntakeDraftContent | null
): boolean {
  if (!draft) {
    return false;
  }

  return Boolean(
    normalizeText(draft.notesSummary) ||
      normalizeLineList(draft.takeaways) ||
      normalizeLineList(draft.followups)
  );
}

export function intakeDraftHasMeaningfulContent(
  draft: IntakeDraftContent | null
): boolean {
  if (!draft) {
    return false;
  }

  return Boolean(
    normalizeText(draft.appointmentTitle) ||
      normalizeText(draft.appointmentReason) ||
      normalizeText(draft.startsAt) ||
      normalizeText(draft.providerName) ||
      normalizeText(draft.providerOrganization) ||
      normalizeText(draft.locationName) ||
      normalizeText(draft.locationAddress) ||
      normalizeText(draft.locationPhone) ||
      intakeDraftHasSaveableNotes(draft)
  );
}

export function appointmentDetailsDraftHasChanges(
  draft: AppointmentDetailsDraft,
  savedAppointment: SavedAppointmentDetails
): boolean {
  return (
    normalizeText(draft.locationAddress) !==
      normalizeText(savedAppointment.location_address) ||
    normalizeText(draft.locationName) !==
      normalizeText(savedAppointment.location_name) ||
    normalizeText(draft.locationPhone) !==
      normalizeText(savedAppointment.location_phone) ||
    normalizeText(draft.providerName) !==
      normalizeText(savedAppointment.provider_name) ||
    normalizeText(draft.providerOrganization) !==
      normalizeText(savedAppointment.provider_organization) ||
    normalizeText(draft.reason) !== normalizeText(savedAppointment.reason) ||
    normalizeText(draft.startsAt) !== normalizeText(savedAppointment.startsAt) ||
    normalizeText(draft.status) !== normalizeText(savedAppointment.status) ||
    normalizeText(draft.title) !== normalizeText(savedAppointment.title)
  );
}

export function carePrepDraftHasChanges(
  draft: CarePrepFormDraft,
  savedCarePrep: CarePrepFormDraft
): boolean {
  return (
    normalizeLineList(draft.bringList) !==
      normalizeLineList(savedCarePrep.bringList) ||
    normalizeLineList(draft.keyQuestions) !==
      normalizeLineList(savedCarePrep.keyQuestions) ||
    normalizeLineList(draft.medReview) !==
      normalizeLineList(savedCarePrep.medReview) ||
    normalizeLineList(draft.nextSteps) !==
      normalizeLineList(savedCarePrep.nextSteps) ||
    normalizeLineList(draft.sinceLastVisit) !==
      normalizeLineList(savedCarePrep.sinceLastVisit) ||
    normalizeText(draft.summary) !== normalizeText(savedCarePrep.summary) ||
    normalizeLineList(draft.watchouts) !==
      normalizeLineList(savedCarePrep.watchouts)
  );
}

export function carePrepGuidanceFormValues(
  guidance: SavedCarePrepGuidance,
  draftOverrides: Partial<CarePrepFormDraft> = {}
): CarePrepFormDraft {
  return {
    bringList: asTextList(guidance.bring_list).join("\n"),
    keyQuestions: asTextList(guidance.key_questions).join("\n"),
    medReview: asTextList(guidance.med_review).join("\n"),
    nextSteps: asTextList(guidance.next_steps).join("\n"),
    sinceLastVisit: asTextList(guidance.since_last_visit).join("\n"),
    summary: guidance.summary ?? "",
    watchouts: asTextList(guidance.watchouts).join("\n"),
    ...draftOverrides,
  };
}

export function carePrepGuidanceHasDraftChanges(
  guidance: SavedCarePrepGuidance,
  draftOverrides: Partial<CarePrepFormDraft> = {}
): boolean {
  return carePrepDraftHasChanges(
    carePrepGuidanceFormValues(guidance, draftOverrides),
    carePrepGuidanceFormValues(guidance)
  );
}
