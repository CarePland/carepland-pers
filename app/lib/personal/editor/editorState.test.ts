import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appointmentDetailsDraftHasChanges,
  carePrepDraftHasChanges,
  intakeDraftHasMeaningfulContent,
  intakeDraftHasSaveableNotes,
  sectionNoteDraftHasChanges,
} from "./editorState";

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

describe("editorState", () => {
  it("treats a restored section note draft as unchanged", () => {
    const savedNote = {
      followups: ["Schedule labs"],
      summary_short: "Blood pressure was mildly elevated.",
      takeaways: [{ text: "Continue current medication." }],
    };

    assert.equal(
      sectionNoteDraftHasChanges(
        {
          followups: "  Schedule labs  ",
          summary: " Blood pressure was mildly elevated. ",
          takeaways: "\nContinue current medication.\n",
        },
        savedNote
      ),
      false
    );
  });

  it("does not treat an empty new note draft as changed", () => {
    assert.equal(
      sectionNoteDraftHasChanges(
        { followups: "\n", summary: "   ", takeaways: "" },
        null
      ),
      false
    );
  });

  it("requires saveable note content before intake notes can be saved", () => {
    assert.equal(intakeDraftHasSaveableNotes(emptyIntakeDraft), false);
    assert.equal(
      intakeDraftHasSaveableNotes({
        ...emptyIntakeDraft,
        takeaways: "\nBring the home blood pressure log.\n",
      }),
      true
    );
  });

  it("counts appointment details as meaningful intake content", () => {
    assert.equal(intakeDraftHasMeaningfulContent(emptyIntakeDraft), false);
    assert.equal(
      intakeDraftHasMeaningfulContent({
        ...emptyIntakeDraft,
        appointmentTitle: "Cardiology follow-up",
      }),
      true
    );
  });

  it("compares appointment drafts against normalized saved values", () => {
    assert.equal(
      appointmentDetailsDraftHasChanges(
        {
          locationAddress: "",
          locationName: " Main Street Clinic ",
          locationPhone: "",
          providerName: "Dr. Smith",
          providerOrganization: "",
          reason: "Follow up",
          startsAt: "2026-06-07T05:10",
          status: "scheduled",
          title: "Primary care",
        },
        {
          location_address: null,
          location_name: "Main Street Clinic",
          location_phone: null,
          provider_name: "Dr. Smith",
          provider_organization: null,
          reason: "Follow up",
          startsAt: "2026-06-07T05:10",
          status: "scheduled",
          title: "Primary care",
        }
      ),
      false
    );
  });

  it("normalizes CarePrep line lists before comparing drafts", () => {
    const savedCarePrep = {
      bringList: "Medication list\nBlood pressure log",
      keyQuestions: "Is this dose still appropriate?",
      medReview: "",
      nextSteps: "",
      sinceLastVisit: "",
      summary: "Review dizziness patterns.",
      watchouts: "Chest pain",
    };

    assert.equal(
      carePrepDraftHasChanges(
        {
          ...savedCarePrep,
          bringList: "\nMedication list\nBlood pressure log\n",
          summary: " Review dizziness patterns. ",
        },
        savedCarePrep
      ),
      false
    );
  });
});
