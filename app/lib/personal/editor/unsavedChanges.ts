import {
  appointmentDetailsDraftHasChanges,
  carePrepDraftHasChanges,
  intakeDraftHasMeaningfulContent,
  intakeDraftHasSaveableNotes,
  sectionNoteDraftHasChanges,
  type AppointmentDetailsDraft,
  type CarePrepFormDraft,
  type IntakeDraftContent,
  type SavedAppointmentDetails,
  type SavedSectionNote,
  type SectionNoteDraft,
} from "./editorState";

export type UnsavedChangeSummary = {
  detail?: string;
  key: string;
  label: string;
};

export type AppointmentModifier = "add" | "edit" | "import";

type AppointmentSummarySource = {
  id: string;
  location_address: string | null;
  location_name: string | null;
  location_phone: string | null;
  provider_name: string | null;
  provider_organization: string | null;
  reason: string | null;
  starts_at: string | null;
  status: string;
  title: string | null;
};

type BuildUnsavedSignOutChangesInput = {
  adminRecommendationsReviewDraft?: {
    hasReviewNote: boolean;
    selectedCount: number;
  } | null;
  appointmentDrafts: Record<string, AppointmentDetailsDraft>;
  appointmentsById: Map<string, AppointmentSummarySource>;
  askConversationComplete: boolean;
  askInput: string;
  askMessagesLength: number;
  bulkAppointmentDraftsLength: number;
  carePrepDrafts: Record<string, CarePrepFormDraft>;
  contextualTextIntakeValue: string;
  editingAppointmentIds: Record<string, boolean>;
  editingNoteIds: Record<string, boolean>;
  emptyAppointmentDraft: AppointmentDetailsDraft;
  emptyNoteDraft: SectionNoteDraft;
  getCarePrepSavedDraft: (appointmentId: string) => CarePrepFormDraft | null;
  getSavedAppointmentDetails: (
    appointment: AppointmentSummarySource
  ) => SavedAppointmentDetails;
  hasUnaddedCareVipName: boolean;
  hasUnsavedProfileChanges: boolean;
  importAnythingItemsLength: number;
  importAnythingSourcesLength: number;
  newAppointmentDraft: AppointmentDetailsDraft;
  newCareVipName: string;
  noteDrafts: Record<string, SectionNoteDraft>;
  notesByAppointment: Map<string, SavedSectionNote>;
  textIntakeDraft: IntakeDraftContent | null;
  textIntakeTargetAppointmentId: string | null;
  textIntakeValue: string;
};

export function buildUnsavedSignOutChanges({
  adminRecommendationsReviewDraft,
  appointmentDrafts,
  appointmentsById,
  askConversationComplete,
  askInput,
  askMessagesLength,
  bulkAppointmentDraftsLength,
  carePrepDrafts,
  contextualTextIntakeValue,
  editingAppointmentIds,
  editingNoteIds,
  emptyAppointmentDraft,
  emptyNoteDraft,
  getCarePrepSavedDraft,
  getSavedAppointmentDetails,
  hasUnaddedCareVipName,
  hasUnsavedProfileChanges,
  importAnythingItemsLength,
  importAnythingSourcesLength,
  newAppointmentDraft,
  newCareVipName,
  noteDrafts,
  notesByAppointment,
  textIntakeDraft,
  textIntakeTargetAppointmentId,
  textIntakeValue,
}: BuildUnsavedSignOutChangesInput): UnsavedChangeSummary[] {
  const changes = new Map<string, UnsavedChangeSummary>();
  const addChange = (change: UnsavedChangeSummary) => {
    changes.set(change.key, change);
  };
  const appointmentLabel = (appointmentId: string, fallback = "") => {
    const appointment = appointmentsById.get(appointmentId);
    const draft = appointmentDrafts[appointmentId];

    return (
      appointment?.title?.trim() ||
      draft?.title?.trim() ||
      fallback ||
      "Appointment draft"
    );
  };

  if (hasUnsavedProfileChanges) {
    addChange({ key: "profile", label: "Profile" });
  }

  if (
    adminRecommendationsReviewDraft?.selectedCount ||
    adminRecommendationsReviewDraft?.hasReviewNote
  ) {
    addChange({
      detail: adminRecommendationsReviewDraft.selectedCount
        ? `${adminRecommendationsReviewDraft.selectedCount} selected`
        : "Review note drafted",
      key: "admin-todays-focus-review",
      label: "Today's Focus Review",
    });
  }

  if (hasUnaddedCareVipName) {
    addChange({
      detail: newCareVipName.trim(),
      key: "care-vip",
      label: "New Care VIP",
    });
  }

  if (newAppointmentDraftHasContent(newAppointmentDraft)) {
    addChange({
      detail: newAppointmentDraft.title.trim() || "Untitled appointment",
      key: "new-appointment",
      label: "New appointment",
    });
  }

  if (bulkAppointmentDraftsLength > 0) {
    addChange({
      detail: `${bulkAppointmentDraftsLength} draft${
        bulkAppointmentDraftsLength === 1 ? "" : "s"
      }`,
      key: "bulk-appointments",
      label: "Appointment import",
    });
  }

  if (textIntakeTargetAppointmentId) {
    if (
      textIntakeDraft
        ? intakeDraftHasSaveableNotes(textIntakeDraft)
        : contextualTextIntakeValue.trim()
    ) {
      addChange({
        detail: appointmentLabel(textIntakeTargetAppointmentId, "Appointment"),
        key: `visit-notes-intake-${textIntakeTargetAppointmentId}`,
        label: "Visit notes intake",
      });
    }
  } else if (
    textIntakePanelHasUnsavedChanges({
      bulkAppointmentDraftsLength: 0,
      importAnythingItemsLength,
      importAnythingSourcesLength,
      textIntakeDraft,
      textIntakeValue,
    })
  ) {
    addChange({
      detail: importAnythingItemsLength
        ? `${importAnythingItemsLength} review item${
            importAnythingItemsLength === 1 ? "" : "s"
          }`
        : undefined,
      key: importAnythingItemsLength ? "import-anything" : "text-intake",
      label: importAnythingItemsLength
        ? "Import Anything review"
        : "Appointment or notes intake",
    });
  }

  Object.entries(editingAppointmentIds).forEach(([appointmentId, isEditing]) => {
    if (!isEditing) {
      return;
    }

    const appointment = appointmentsById.get(appointmentId);
    if (appointment) {
      const draft = appointmentDrafts[appointment.id] ?? emptyAppointmentDraft;
      const hasChanges = appointmentDetailsDraftHasChanges(
        draft,
        getSavedAppointmentDetails(appointment)
      );

      if (!hasChanges) {
        return;
      }
    }

    addChange({
      detail: appointmentLabel(appointmentId),
      key: `appointment-edit-${appointmentId}`,
      label: "Appointment details",
    });
  });

  Object.entries(editingNoteIds).forEach(([appointmentId, isEditing]) => {
    if (!isEditing) {
      return;
    }

    const appointment = appointmentsById.get(appointmentId);
    if (appointment) {
      const draft = noteDrafts[appointment.id] ?? emptyNoteDraft;
      const existingNote = notesByAppointment.get(appointment.id);
      const hasChanges = sectionNoteDraftHasChanges(draft, existingNote);

      if (!hasChanges) {
        return;
      }
    }

    addChange({
      detail: appointmentLabel(appointmentId),
      key: `note-edit-${appointmentId}`,
      label: "Visit notes",
    });
  });

  Object.entries(carePrepDrafts).forEach(([appointmentId, draft]) => {
    const savedCarePrep = getCarePrepSavedDraft(appointmentId);
    const hasChanges = savedCarePrep
      ? carePrepDraftHasChanges(draft, savedCarePrep)
      : Object.values(draft).some((value) => String(value ?? "").trim());

    if (!hasChanges) {
      return;
    }

    addChange({
      detail: appointmentLabel(appointmentId),
      key: `careprep-${appointmentId}`,
      label: "CarePrep",
    });
  });

  if (askInput.trim() || (askMessagesLength > 0 && !askConversationComplete)) {
    addChange({ key: "ask", label: "Ask conversation" });
  }

  return Array.from(changes.values());
}

export function hasAnyUnsavedWork(
  changes: readonly UnsavedChangeSummary[]
): boolean {
  return changes.length > 0;
}

export function newAppointmentDraftHasContent(
  draft: AppointmentDetailsDraft
): boolean {
  return Boolean(
    draft.title.trim() ||
      draft.reason.trim() ||
      draft.startsAt.trim() ||
      draft.providerName.trim() ||
      draft.providerOrganization.trim() ||
      draft.locationName.trim() ||
      draft.locationAddress.trim() ||
      draft.locationPhone.trim()
  );
}

export function textIntakePanelHasUnsavedChanges({
  bulkAppointmentDraftsLength,
  importAnythingItemsLength = 0,
  importAnythingSourcesLength = 0,
  textIntakeDraft,
  textIntakeValue,
}: {
  bulkAppointmentDraftsLength: number;
  importAnythingItemsLength?: number;
  importAnythingSourcesLength?: number;
  textIntakeDraft: IntakeDraftContent | null;
  textIntakeValue: string;
}): boolean {
  // Match candidates are process state; warnings require visible/saveable work.
  return Boolean(
    bulkAppointmentDraftsLength > 0 ||
      importAnythingItemsLength > 0 ||
      importAnythingSourcesLength > 0 ||
      (textIntakeDraft
        ? intakeDraftHasMeaningfulContent(textIntakeDraft)
        : textIntakeValue.trim())
  );
}

export function appointmentModifierHasUnsavedChanges({
  appointmentDraft,
  contextualTextIntakeValue,
  existingNote,
  modifier,
  noteDraft,
  savedAppointmentDetails,
  textIntakeDraft,
}: {
  appointmentDraft: AppointmentDetailsDraft;
  contextualTextIntakeValue: string;
  existingNote: SavedSectionNote | null | undefined;
  modifier: AppointmentModifier | null;
  noteDraft: SectionNoteDraft;
  savedAppointmentDetails: SavedAppointmentDetails;
  textIntakeDraft: IntakeDraftContent | null;
}): boolean {
  if (modifier === "add") {
    return sectionNoteDraftHasChanges(noteDraft, existingNote);
  }

  if (modifier === "import") {
    return Boolean(
      textIntakeDraft
        ? intakeDraftHasSaveableNotes(textIntakeDraft)
        : contextualTextIntakeValue.trim()
    );
  }

  if (modifier === "edit") {
    return appointmentDetailsDraftHasChanges(
      appointmentDraft,
      savedAppointmentDetails
    );
  }

  return false;
}
