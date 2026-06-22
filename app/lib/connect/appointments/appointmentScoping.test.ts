import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeConnectAppointment,
  normalizeConnectAppointments,
} from "./appointmentScoping";

describe("Connect appointment scoping", () => {
  it("preserves the selected Pers person id on normalized appointments", () => {
    const appointment = normalizeConnectAppointment({
      care_subject_id: "person-bob",
      id: "appointment-1",
      location_address: null,
      location_name: null,
      location_phone: null,
      provider_name: null,
      provider_organization: null,
      reason: "Follow-up",
      starts_at: "2026-06-22T21:00:00.000Z",
      status: "scheduled",
      title: "  ",
    });

    assert.equal(appointment.careSubjectId, "person-bob");
    assert.equal(appointment.title, "Follow-up");
    assert.equal(appointment.startsAt, "2026-06-22T21:00:00.000Z");
  });

  it("uses a stable fallback title when title and reason are missing", () => {
    const appointment = normalizeConnectAppointment({
      care_subject_id: "person-bob",
      id: "appointment-2",
      location_address: null,
      location_name: null,
      location_phone: null,
      provider_name: null,
      provider_organization: null,
      reason: null,
      starts_at: null,
      status: null,
      title: null,
    });

    assert.equal(appointment.title, "Untitled appointment");
    assert.equal(appointment.reason, "");
    assert.equal(appointment.startsAt, "");
  });

  it("normalizes every appointment row without changing row order", () => {
    const appointments = normalizeConnectAppointments([
      {
        care_subject_id: "person-bob",
        id: "first",
        location_address: "123 Main",
        location_name: "Clinic",
        location_phone: "555-0100",
        provider_name: "Dr. One",
        provider_organization: "Care Clinic",
        reason: null,
        starts_at: "2026-06-22T21:00:00.000Z",
        status: "scheduled",
        title: "First appointment",
      },
      {
        care_subject_id: "person-bob",
        id: "second",
        location_address: null,
        location_name: null,
        location_phone: null,
        provider_name: null,
        provider_organization: null,
        reason: "Second reason",
        starts_at: "2026-06-23T21:00:00.000Z",
        status: "scheduled",
        title: null,
      },
    ]);

    assert.deepEqual(
      appointments.map((appointment) => appointment.id),
      ["first", "second"]
    );
    assert.equal(appointments[0]?.locationName, "Clinic");
    assert.equal(appointments[1]?.title, "Second reason");
  });
});
