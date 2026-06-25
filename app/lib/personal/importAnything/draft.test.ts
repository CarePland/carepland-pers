import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  maxImportAnythingDraftItemsPerKind,
  maxImportAnythingDraftListItems,
  maxImportAnythingDraftStringChars,
  maxImportAnythingDraftSummaryChars,
  normalizeImportAnythingDraft,
} from "./draft";

describe("Import Anything draft normalization", () => {
  it("returns the complete review shape for empty or malformed drafts", () => {
    const draft = normalizeImportAnythingDraft(null);

    assert.deepEqual(draft, {
      appointments: [],
      careprep_items: [],
      import_summary: "",
      medication_changes: [],
      notes: [],
      ownership_clusters: [],
      person_assignment: {
        cluster_id: "",
        confidence: 0,
        detected_name: "",
        matched_care_subject_id: "",
        needs_review: false,
        rationale: "",
        suggested_new_person_name: "",
      },
      providers: [],
      questions_to_ask: [],
      tasks: [],
    });
  });

  it("keeps only known matched Care VIP ids in person assignment", () => {
    const draft = normalizeImportAnythingDraft(
      {
        person_assignment: {
          cluster_id: "cluster_rob",
          confidence: 0.94,
          detected_name: "Rob Robson",
          matched_care_subject_id: "rob",
          needs_review: false,
          rationale: "The note names Rob Robson.",
          suggested_new_person_name: "",
        },
      },
      { allowedMatchedCareSubjectIds: ["rob"] }
    );

    assert.deepEqual(draft.person_assignment, {
      confidence: 0.94,
      cluster_id: "cluster_rob",
      detected_name: "Rob Robson",
      matched_care_subject_id: "rob",
      needs_review: false,
      rationale: "The note names Rob Robson.",
      suggested_new_person_name: "",
    });

    const unknownDraft = normalizeImportAnythingDraft(
      {
        person_assignment: {
          cluster_id: "cluster_unknown",
          confidence: 0.94,
          detected_name: "Someone Else",
          matched_care_subject_id: "made-up",
          needs_review: false,
          rationale: "The note names Someone Else.",
          suggested_new_person_name: "Someone Else",
        },
      },
      { allowedMatchedCareSubjectIds: ["rob"] }
    );

    assert.equal(
      (unknownDraft.person_assignment as Record<string, unknown>)
        .matched_care_subject_id,
      ""
    );
  });

  it("keeps only known matched Care VIP ids on individual items", () => {
    const draft = normalizeImportAnythingDraft(
      {
        appointments: [
          {
            appointment_title: "Rob appointment",
            confidence: 0.94,
            needs_review: false,
            person_assignment: {
              cluster_id: "cluster_rob",
              confidence: 0.95,
              detected_name: "Rob Robson",
              matched_care_subject_id: "rob",
              needs_review: false,
              rationale: "The item names Rob.",
              suggested_new_person_name: "",
            },
          },
          {
            appointment_title: "Unknown appointment",
            confidence: 0.94,
            needs_review: false,
            person_assignment: {
              cluster_id: "cluster_unknown",
              confidence: 0.9,
              detected_name: "Someone Else",
              matched_care_subject_id: "made-up",
              needs_review: false,
              rationale: "The item names Someone Else.",
              suggested_new_person_name: "Someone Else",
            },
          },
        ],
      },
      { allowedMatchedCareSubjectIds: ["rob"] }
    );

    const appointments = draft.appointments as Array<Record<string, unknown>>;
    assert.equal(
      (
        appointments[0]?.person_assignment as Record<string, unknown>
      ).matched_care_subject_id,
      "rob"
    );
    assert.equal(
      (
        appointments[1]?.person_assignment as Record<string, unknown>
      ).matched_care_subject_id,
      ""
    );
    assert.equal(
      (appointments[1]?.person_assignment as Record<string, unknown>)
        .needs_review,
      true
    );
  });

  it("normalizes detected ownership clusters", () => {
    const draft = normalizeImportAnythingDraft(
      {
        ownership_clusters: [
          {
            cluster_id: " cluster_rob ",
            confidence: 0.96,
            display_name: " Rob Robson ",
            entity_type: " person ",
            matched_care_subject_id: " rob ",
            rationale: "Explicit heading.",
            suggested_new_person_name: "",
          },
          {
            cluster_id: " cluster_bob ",
            confidence: 0.88,
            display_name: " Bob Bobson ",
            entity_type: " person ",
            matched_care_subject_id: "made-up",
            rationale: "Explicit heading.",
            suggested_new_person_name: " Bob Bobson ",
          },
        ],
      },
      { allowedMatchedCareSubjectIds: ["rob"] }
    );

    const clusters = draft.ownership_clusters as Array<Record<string, unknown>>;
    assert.deepEqual(clusters, [
      {
        cluster_id: "cluster_rob",
        confidence: 0.96,
        display_name: "Rob Robson",
        entity_type: "person",
        matched_care_subject_id: "rob",
        rationale: "Explicit heading.",
        suggested_new_person_name: "",
      },
      {
        cluster_id: "cluster_bob",
        confidence: 0.88,
        display_name: "Bob Bobson",
        entity_type: "person",
        matched_care_subject_id: "",
        rationale: "Explicit heading.",
        suggested_new_person_name: "Bob Bobson",
      },
    ]);
  });

  it("uses person assignment confidence when item confidence is missing", () => {
    const draft = normalizeImportAnythingDraft({
      appointments: [
        {
          appointment_title: "Annual Physical",
          person_assignment: {
            cluster_id: "cluster_rob",
            confidence: 0.97,
            detected_name: "Rob Robson",
            matched_care_subject_id: "",
            needs_review: false,
            rationale: "Explicit heading.",
            suggested_new_person_name: "",
          },
        },
      ],
    });

    const appointments = draft.appointments as Array<Record<string, unknown>>;
    assert.equal(appointments[0]?.confidence, 0.97);
    assert.equal(appointments[0]?.needs_review, false);
  });

  it("keeps practice names separate from street addresses", () => {
    const draft = normalizeImportAnythingDraft({
      appointments: [
        {
          appointment_title: "Annual Physical",
          location_address: "1425 Harbor View Blvd, Suffolk, VA",
          location_name: "1425 Harbor View Blvd, Suffolk, VA",
          provider_organization: "Suffolk Family Medicine",
        },
      ],
      providers: [
        {
          location_address: "1425 Harbor View Blvd, Suffolk, VA",
          location_name: "1425 Harbor View Blvd, Suffolk, VA",
          provider_name: "Dr. Emily Chen",
          provider_organization: "Suffolk Family Medicine",
        },
      ],
    });

    const appointments = draft.appointments as Array<Record<string, unknown>>;
    assert.equal(appointments[0]?.location_name, "Suffolk Family Medicine");
    assert.equal(
      appointments[0]?.location_address,
      "1425 Harbor View Blvd, Suffolk, VA"
    );

    const providers = draft.providers as Array<Record<string, unknown>>;
    assert.equal(providers[0]?.location_name, "Suffolk Family Medicine");
    assert.equal(
      providers[0]?.location_address,
      "1425 Harbor View Blvd, Suffolk, VA"
    );
  });

  it("bounds item counts, strings, confidence, and review lists", () => {
    const draft = normalizeImportAnythingDraft({
      import_summary: "s".repeat(maxImportAnythingDraftSummaryChars + 10),
      notes: [
        {
          appointment_title: "  Follow-up  ",
          confidence: 2,
          followups: Array.from(
            { length: maxImportAnythingDraftListItems + 3 },
            (_, index) => ` follow-up-${index} `
          ),
          matched_appointment_id: " appt-1 ",
          needs_review: "true",
          source_excerpt: "x".repeat(maxImportAnythingDraftStringChars + 10),
          summary: "  Visit summary  ",
          takeaways: ["  keep tracking symptoms  ", 7, ""],
        },
      ],
      tasks: Array.from(
        { length: maxImportAnythingDraftItemsPerKind + 4 },
        (_, index) => ({
          confidence: -1,
          details: `details-${index}`,
          due_at_local: "",
          matched_appointment_id: "",
          needs_review: index === 0,
          source_excerpt: `task-${index}`,
          title: `Task ${index}`,
        })
      ),
    });

    assert.equal(
      String(draft.import_summary).length,
      maxImportAnythingDraftSummaryChars
    );

    const notes = draft.notes as Array<Record<string, unknown>>;
    assert.equal(notes[0]?.appointment_title, "Follow-up");
    assert.equal(notes[0]?.confidence, 1);
    assert.equal(notes[0]?.needs_review, false);
    assert.equal(
      String(notes[0]?.source_excerpt).length,
      maxImportAnythingDraftStringChars
    );
    assert.equal(
      (notes[0]?.followups as string[]).length,
      maxImportAnythingDraftListItems
    );
    assert.deepEqual(notes[0]?.takeaways, ["keep tracking symptoms"]);

    const tasks = draft.tasks as Array<Record<string, unknown>>;
    assert.equal(tasks.length, maxImportAnythingDraftItemsPerKind);
    assert.equal(tasks[0]?.confidence, 0);
    assert.equal(tasks[0]?.needs_review, true);
  });

  it("keeps matched appointment ids on appointment-linked review items", () => {
    const draft = normalizeImportAnythingDraft(
      {
        careprep_items: [
          {
            confidence: 0.9,
            detail: "Bring home readings.",
            matched_appointment_id: " appt-1 ",
            needs_review: false,
            source_excerpt: "Bring readings.",
          },
        ],
        medication_changes: [
          {
            change_summary: "Dose changed",
            confidence: 0.9,
            instructions: "Take with food",
            matched_appointment_id: " appt-2 ",
            medication_name: "Lisinopril",
            needs_review: false,
            source_excerpt: "Dose changed.",
          },
        ],
        questions_to_ask: [
          {
            confidence: 0.9,
            matched_appointment_id: " appt-3 ",
            needs_review: false,
            question: "What should we monitor?",
            source_excerpt: "Ask what to monitor.",
            topic: "Monitoring",
          },
        ],
        tasks: [
          {
            confidence: 0.9,
            details: "Before visit",
            due_at_local: "2026-06-24T09:00",
            matched_appointment_id: " appt-4 ",
            needs_review: false,
            source_excerpt: "Schedule labs.",
            title: "Schedule labs",
          },
        ],
      },
      {
        allowedMatchedAppointmentIds: ["appt-1", "appt-2", "appt-3", "appt-4"],
      }
    );

    assert.equal(
      (draft.careprep_items as Array<Record<string, unknown>>)[0]
        ?.matched_appointment_id,
      "appt-1"
    );
    assert.equal(
      (draft.medication_changes as Array<Record<string, unknown>>)[0]
        ?.matched_appointment_id,
      "appt-2"
    );
    assert.equal(
      (draft.questions_to_ask as Array<Record<string, unknown>>)[0]
        ?.matched_appointment_id,
      "appt-3"
    );
    assert.equal(
      (draft.tasks as Array<Record<string, unknown>>)[0]
        ?.matched_appointment_id,
      "appt-4"
    );
  });

  it("clears unknown matched appointment ids and requires review", () => {
    const draft = normalizeImportAnythingDraft(
      {
        appointments: [
          {
            appointment_title: "Follow-up",
            confidence: 0.91,
            matched_appointment_id: "known-appt",
            needs_review: false,
            source_excerpt: "Follow-up.",
          },
        ],
        notes: [
          {
            appointment_title: "Specialist visit",
            confidence: 0.92,
            matched_appointment_id: "made-up-appt",
            needs_review: false,
            source_excerpt: "Specialist notes.",
            summary: "Visit summary",
          },
        ],
        tasks: [
          {
            confidence: 0.95,
            matched_appointment_id: "unknown-task-appt",
            needs_review: false,
            source_excerpt: "Schedule labs.",
            title: "Schedule labs",
          },
        ],
      },
      { allowedMatchedAppointmentIds: ["known-appt"] }
    );

    const appointments = draft.appointments as Array<Record<string, unknown>>;
    assert.equal(appointments[0]?.matched_appointment_id, "known-appt");
    assert.equal(appointments[0]?.needs_review, false);

    const notes = draft.notes as Array<Record<string, unknown>>;
    assert.equal(notes[0]?.matched_appointment_id, "");
    assert.equal(notes[0]?.needs_review, true);

    const tasks = draft.tasks as Array<Record<string, unknown>>;
    assert.equal(tasks[0]?.matched_appointment_id, "");
    assert.equal(tasks[0]?.needs_review, true);
  });

  it("keeps known provider matches for future confirmation surfaces", () => {
    const draft = normalizeImportAnythingDraft(
      {
        appointments: [
          {
            appointment_title: "Follow-up",
            confidence: 0.92,
            matched_provider_id: "provider-1",
            needs_review: false,
            provider_match_note: "Same doctor and clinic.",
            provider_name: "Dr. Smith",
            source_excerpt: "Appointment with Dr. Smith.",
          },
        ],
        providers: [
          {
            confidence: 0.93,
            matched_provider_id: "provider-2",
            needs_review: false,
            provider_match_note: "Same practice phone.",
            provider_name: "Dr. Patel",
            source_excerpt: "Call Dr. Patel.",
          },
        ],
      },
      { allowedMatchedProviderIds: ["provider-1", "provider-2"] }
    );

    const appointments = draft.appointments as Array<Record<string, unknown>>;
    assert.equal(appointments[0]?.matched_provider_id, "provider-1");
    assert.equal(appointments[0]?.provider_match_note, "Same doctor and clinic.");
    assert.equal(appointments[0]?.needs_review, false);

    const providers = draft.providers as Array<Record<string, unknown>>;
    assert.equal(providers[0]?.matched_provider_id, "provider-2");
    assert.equal(providers[0]?.provider_match_note, "Same practice phone.");
    assert.equal(providers[0]?.needs_review, false);
  });

  it("clears unknown provider matches and requires review", () => {
    const draft = normalizeImportAnythingDraft(
      {
        providers: [
          {
            confidence: 0.93,
            matched_provider_id: "made-up-provider",
            needs_review: false,
            provider_match_note: "Looks similar.",
            provider_name: "Dr. Smith",
            source_excerpt: "Dr. Smith.",
          },
        ],
      },
      { allowedMatchedProviderIds: ["known-provider"] }
    );

    const providers = draft.providers as Array<Record<string, unknown>>;
    assert.equal(providers[0]?.matched_provider_id, "");
    assert.equal(providers[0]?.provider_match_note, "Looks similar.");
    assert.equal(providers[0]?.needs_review, true);
  });
});
