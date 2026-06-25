import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  maxImportAnythingAppointmentCandidateFieldChars,
  maxImportAnythingAppointmentCandidates,
  normalizeImportAnythingAppointmentCandidates,
} from "./appointments";

describe("Import Anything appointment candidates", () => {
  it("normalizes only fields needed for matching", () => {
    const candidates = normalizeImportAnythingAppointmentCandidates([
      {
        care_subject_id: " subject-1 ",
        current_note_id: " note-1 ",
        id: " appt-1 ",
        location_address: " 123 Main St ",
        location_name: " Main Clinic ",
        location_phone: " 555-0101 ",
        provider_name: " Dr. Smith ",
        provider_organization: " Primary Care ",
        reason: " Blood pressure ",
        starts_at: " 2026-06-24T09:00:00Z ",
        status: " scheduled ",
        title: " Follow-up ",
      },
    ]);

    assert.deepEqual(candidates, [
      {
        care_subject_id: "subject-1",
        current_note_id: "note-1",
        id: "appt-1",
        location_address: "123 Main St",
        location_name: "Main Clinic",
        location_phone: "555-0101",
        provider_name: "Dr. Smith",
        provider_organization: "Primary Care",
        reason: "Blood pressure",
        starts_at: "2026-06-24T09:00:00Z",
        status: "scheduled",
        title: "Follow-up",
      },
    ]);
  });

  it("drops rows without ids and bounds long fields", () => {
    const candidates = normalizeImportAnythingAppointmentCandidates([
      {
        id: "",
        title: "No id",
      },
      {
        id: "appt-1",
        title: "x".repeat(maxImportAnythingAppointmentCandidateFieldChars + 20),
      },
    ]);

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.id, "appt-1");
    assert.equal(
      candidates[0]?.title.length,
      maxImportAnythingAppointmentCandidateFieldChars
    );
  });

  it("limits candidate count", () => {
    const candidates = normalizeImportAnythingAppointmentCandidates(
      Array.from(
        { length: maxImportAnythingAppointmentCandidates + 5 },
        (_, index) => ({ id: `appt-${index}` })
      )
    );

    assert.equal(candidates.length, maxImportAnythingAppointmentCandidates);
    assert.equal(
      candidates[maxImportAnythingAppointmentCandidates - 1]?.id,
      `appt-${maxImportAnythingAppointmentCandidates - 1}`
    );
  });
});
