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
    askInput: "",
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
    importAnythingItemsLength: 0,
    importAnythingSourcesLength: 0,
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

  it("treats Import Anything review state as unsaved work", () => {
    assert.equal(
      textIntakePanelHasUnsavedChanges({
        bulkAppointmentDraftsLength: 0,
        importAnythingItemsLength: 1,
        textIntakeDraft: null,
        textIntakeValue: "",
      }),
      true
    );
    assert.equal(
      textIntakePanelHasUnsavedChanges({
        bulkAppointmentDraftsLength: 0,
        importAnythingSourcesLength: 1,
        textIntakeDraft: null,
        textIntakeValue: "",
      }),
      true
    );

    const changes = buildEmptySignOutChanges({
      importAnythingItemsLength: 2,
    });

    assert.deepEqual(changes, [
      {
        detail: "2 review items",
        key: "import-anything",
        label: "Import Anything review",
      },
    ]);
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

  it("treats Ask as dirty only while text is typed or a reply is in flight", () => {
    assert.deepEqual(
      buildEmptySignOutChanges({
      }),
      []
    );
    assert.deepEqual(buildEmptySignOutChanges({ askInput: "Help me" }), [
      { key: "ask", label: "Ask conversation" },
    ]);
    assert.deepEqual(buildEmptySignOutChanges({ askInFlight: true }), [
      { key: "ask", label: "Ask conversation" },
    ]);
  });

  it("summarizes appointment message drafts for sign-out", () => {
    const changes = buildEmptySignOutChanges({
      appointmentMessageDraft: {
        allowsCallbackRequest: true,
        appointmentId: "appointment-1",
        requiresAcknowledgement: true,
        text: "Please bring the insurance card.",
      },
      appointmentsById: new Map([
        [
          "appointment-1",
          {
            id: "appointment-1",
            location_address: null,
            location_name: null,
            location_phone: null,
            provider_name: null,
            provider_organization: null,
            reason: null,
            starts_at: null,
            status: "scheduled",
            title: "Eye Exam",
          },
        ],
      ]),
    });

    assert.deepEqual(changes, [
      {
        detail: "Eye Exam",
        key: "appointment-message-appointment-1",
        label: "Appointment message",
      },
    ]);
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

  it("summarizes pending Today's Focus review work", () => {
    assert.deepEqual(
      buildEmptySignOutChanges({
        adminRecommendationsReviewDraft: {
          hasReviewNote: false,
          selectedCount: 3,
        },
      }),
      [
        {
          detail: "3 selected",
          key: "admin-todays-focus-review",
          label: "Today's Focus Review",
        },
      ]
    );

    assert.deepEqual(
      buildEmptySignOutChanges({
        adminRecommendationsReviewDraft: {
          hasReviewNote: true,
          selectedCount: 0,
        },
      }),
      [
        {
          detail: "Review note drafted",
          key: "admin-todays-focus-review",
          label: "Today's Focus Review",
        },
      ]
    );
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
