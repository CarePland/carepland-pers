import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appointmentModifierHasUnsavedChanges,
  buildUnsavedSignOutChanges,
  hasAnyUnsavedWork,
  newAppointmentDraftHasContent,
  textIntakePanelHasUnsavedChanges,
} from "./unsavedChanges";

const emptyAppointmentDraft = {
  locationAddress: "",
  locationName: "",
  locationPhone: "",
  providerName: "",
  providerOrganization: "",
  reason: "",
  startsAt: "",
  status: "scheduled",
  title: "",
};

const emptyNoteDraft = {
  followups: "",
  summary: "",
  takeaways: "",
};

const emptyIntakeDraft = {
  appointmentReason: "",
  appointmentTitle: "",
  followups: "",
  locationAddress: "",
  locationName: "",
  locationPhone: "",
  notesSummary: "",
  providerName: "",
  providerOrganization: "",
  startsAt: "",
  takeaways: "",
};

const savedAppointment = {
  location_address: null,
  location_name: null,
  location_phone: null,
  provider_name: null,
  provider_organization: null,
  reason: null,
  startsAt: "",
  status: "scheduled",
  title: null,
};

function buildEmptySignOutChanges(overrides = {}) {
  return buildUnsavedSignOutChanges({
    appointmentDrafts: {},
    appointmentsById: new Map(),
    askConversationComplete: true,
    askInput: "",
    askMessagesLength: 0,
    bulkAppointmentDraftsLength: 0,
    carePrepDrafts: {},
    contextualTextIntakeValue: "",
    editingAppointmentIds: {},
    editingNoteIds: {},
    emptyAppointmentDraft,
    emptyNoteDraft,
    getCarePrepSavedDraft: () => null,
    getSavedAppointmentDetails: () => savedAppointment,
    hasUnaddedCareVipName: false,
    hasUnsavedProfileChanges: false,
    newAppointmentDraft: emptyAppointmentDraft,
    newCareVipName: "",
    noteDrafts: {},
    notesByAppointment: new Map(),
    textIntakeDraft: null,
    textIntakeTargetAppointmentId: null,
    textIntakeValue: "",
    ...overrides,
  });
}

describe("unsavedChanges", () => {
  it("does not treat match candidates alone as unsaved work", () => {
    assert.equal(
      textIntakePanelHasUnsavedChanges({
        bulkAppointmentDraftsLength: 0,
        textIntakeDraft: null,
        textIntakeValue: "",
      }),
      false
    );
  });

  it("treats raw pasted text and bulk drafts as unsaved work", () => {
    assert.equal(
      textIntakePanelHasUnsavedChanges({
        bulkAppointmentDraftsLength: 0,
        textIntakeDraft: null,
        textIntakeValue: "Some pasted portal notes",
      }),
      true
    );
    assert.equal(
      textIntakePanelHasUnsavedChanges({
        bulkAppointmentDraftsLength: 1,
        textIntakeDraft: null,
        textIntakeValue: "",
      }),
      true
    );
  });

  it("does not treat an empty generated intake draft as unsaved work", () => {
    assert.equal(
      textIntakePanelHasUnsavedChanges({
        bulkAppointmentDraftsLength: 0,
        textIntakeDraft: emptyIntakeDraft,
        textIntakeValue: "",
      }),
      false
    );
  });

  it("builds no sign-out changes for a clean state", () => {
    const changes = buildEmptySignOutChanges();

    assert.deepEqual(changes, []);
    assert.equal(hasAnyUnsavedWork(changes), false);
  });

  it("summarizes profile and new appointment work for sign-out", () => {
    const changes = buildEmptySignOutChanges({
      hasUnsavedProfileChanges: true,
      newAppointmentDraft: {
        ...emptyAppointmentDraft,
        title: "Cardiology follow-up",
      },
    });

    assert.deepEqual(
      changes.map((change) => change.key),
      ["profile", "new-appointment"]
    );
    assert.equal(hasAnyUnsavedWork(changes), true);
  });

  it("ignores appointment edits restored to saved values", () => {
    const changes = buildEmptySignOutChanges({
      appointmentDrafts: {
        appt_1: {
          ...emptyAppointmentDraft,
          title: "Primary care",
        },
      },
      appointmentsById: new Map([
        [
          "appt_1",
          {
            id: "appt_1",
            location_address: null,
            location_name: null,
            location_phone: null,
            provider_name: null,
            provider_organization: null,
            reason: null,
            starts_at: null,
            status: "scheduled",
            title: "Primary care",
          },
        ],
      ]),
      editingAppointmentIds: { appt_1: true },
      getSavedAppointmentDetails: () => ({
        ...savedAppointment,
        title: "Primary care",
      }),
    });

    assert.deepEqual(changes, []);
  });

  it("detects meaningful new appointment content", () => {
    assert.equal(newAppointmentDraftHasContent(emptyAppointmentDraft), false);
    assert.equal(
      newAppointmentDraftHasContent({
        ...emptyAppointmentDraft,
        reason: "Follow-up",
      }),
      true
    );
  });

  it("uses modifier-specific unsaved rules", () => {
    assert.equal(
      appointmentModifierHasUnsavedChanges({
        appointmentDraft: emptyAppointmentDraft,
        contextualTextIntakeValue: "",
        existingNote: null,
        modifier: "import",
        noteDraft: emptyNoteDraft,
        savedAppointmentDetails: savedAppointment,
        textIntakeDraft: { ...emptyIntakeDraft, appointmentTitle: "Ignored" },
      }),
      false
    );

    assert.equal(
      appointmentModifierHasUnsavedChanges({
        appointmentDraft: emptyAppointmentDraft,
        contextualTextIntakeValue: "",
        existingNote: null,
        modifier: "import",
        noteDraft: emptyNoteDraft,
        savedAppointmentDetails: savedAppointment,
        textIntakeDraft: { ...emptyIntakeDraft, notesSummary: "Visit notes" },
      }),
      true
    );
  });
});
