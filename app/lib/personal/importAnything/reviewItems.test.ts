import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasImportAnythingProviderIdentity,
  importAnythingDeterministicSummary,
  importAnythingFieldLabel,
  importAnythingFindSupportingNotes,
  importAnythingKindLabel,
  importAnythingNewAppointmentNoteCount,
  importAnythingOwnerKey,
  importAnythingOwnershipClusterCounts,
  importAnythingPetKindFromSubjectType,
  importAnythingPetLabel,
  importAnythingPetSubjectType,
  importAnythingPracticeOfficeValue,
  importAnythingSimpleFieldEntries,
  importAnythingStagingItems,
  importAnythingSummaryCounts,
  isImportAnythingProviderStoreUnavailable,
  normalizedImportAnythingText,
  pluralizeCount,
  type ImportAnythingOwnershipCluster,
  type ImportAnythingReviewItem,
} from "./reviewItems";

function reviewItem(
  overrides: Partial<ImportAnythingReviewItem> = {}
): ImportAnythingReviewItem {
  return {
    createsNewAppointment: false,
    confidence: 0.9,
    fields: {},
    id: "item-1",
    kind: "appointment",
    matchedAppointmentId: "",
    matchedProviderId: "",
    needsReview: false,
    ownerCareSubjectId: "",
    ownerClusterId: "",
    ownerConfidence: 0,
    ownerDetectedName: "",
    ownerNeedsReview: true,
    ownerNewPersonName: "",
    ownerRationale: "",
    providerMatchNote: "",
    sourceExcerpt: "",
    status: "approved",
    summary: "Summary",
    title: "Title",
    ...overrides,
  };
}

describe("Import Anything pet kind mapping", () => {
  it("maps subject types to pet kinds", () => {
    assert.equal(importAnythingPetKindFromSubjectType("dog"), "dog");
    assert.equal(importAnythingPetKindFromSubjectType("pet"), "other");
    assert.equal(importAnythingPetKindFromSubjectType("pet:bird"), "other");
    assert.equal(importAnythingPetKindFromSubjectType("cat"), "cat");
    assert.equal(importAnythingPetKindFromSubjectType(null), "cat");
  });

  it("labels and round-trips pet kinds through subject type strings", () => {
    assert.equal(importAnythingPetLabel("dog", ""), "Dog");
    assert.equal(importAnythingPetLabel("other", "Bird"), "Bird");
    assert.equal(importAnythingPetLabel("other", "  "), "Pet");

    assert.equal(importAnythingPetSubjectType("dog", ""), "dog");
    assert.equal(importAnythingPetSubjectType("other", "Bird"), "pet:Bird");
    assert.equal(importAnythingPetSubjectType("other", ""), "pet");
  });
});

describe("Import Anything provider identity helpers", () => {
  it("recognizes a missing care_providers table as an unavailable store", () => {
    assert.equal(
      isImportAnythingProviderStoreUnavailable({ code: "42P01" }),
      true
    );
    assert.equal(
      isImportAnythingProviderStoreUnavailable({
        message: "relation care_providers does not exist",
      }),
      true
    );
    assert.equal(isImportAnythingProviderStoreUnavailable({ code: "23505" }), false);
  });

  it("detects a provider identity from either provider field", () => {
    assert.equal(
      hasImportAnythingProviderIdentity(
        reviewItem({ fields: { providerName: "Dr. Lee" } })
      ),
      true
    );
    assert.equal(
      hasImportAnythingProviderIdentity(
        reviewItem({ fields: { providerOrganization: "Riverside Clinic" } })
      ),
      true
    );
    assert.equal(hasImportAnythingProviderIdentity(reviewItem({ fields: {} })), false);
  });
});

describe("Import Anything labels", () => {
  it("labels every item kind", () => {
    assert.equal(importAnythingKindLabel("appointment"), "Appointment");
    assert.equal(importAnythingKindLabel("medication_change"), "Medication Change");
    assert.equal(importAnythingKindLabel("careprep"), "CarePrep");
  });

  it("turns camelCase field names into readable labels", () => {
    assert.equal(importAnythingFieldLabel("providerOrganization"), "Provider Organization");
    assert.equal(importAnythingFieldLabel("startsAt"), "Starts At");
  });

  it("pluralizes counts", () => {
    assert.equal(pluralizeCount(1, "task"), "1 task");
    assert.equal(pluralizeCount(2, "task"), "2 tasks");
  });
});

describe("Import Anything owner matching", () => {
  it("normalizes text for comparison", () => {
    assert.equal(normalizedImportAnythingText("  Jane   Doe  "), "jane doe");
  });

  it("prefers a matched care subject id as the owner key", () => {
    assert.equal(
      importAnythingOwnerKey(
        reviewItem({
          ownerCareSubjectId: "subject-1",
          ownerDetectedName: "Jane",
        })
      ),
      "subject-1"
    );
  });

  it("falls back to a normalized detected or new person name", () => {
    assert.equal(
      importAnythingOwnerKey(reviewItem({ ownerDetectedName: "Jane Doe" })),
      "jane doe"
    );
  });
});

describe("Import Anything supporting notes and staging", () => {
  it("finds notes/careprep items that share an appointment title and owner", () => {
    const appointment = reviewItem({
      id: "appt-1",
      kind: "appointment",
      fields: { appointmentTitle: "Wellness Visit" },
      ownerCareSubjectId: "subject-1",
    });
    const matchingNote = reviewItem({
      id: "note-1",
      kind: "note",
      fields: { appointmentTitle: "Wellness Visit" },
      ownerCareSubjectId: "subject-1",
    });
    const mismatchedOwnerNote = reviewItem({
      id: "note-2",
      kind: "note",
      fields: { appointmentTitle: "Wellness Visit" },
      ownerCareSubjectId: "subject-2",
    });

    const supporting = importAnythingFindSupportingNotes(appointment, [
      appointment,
      matchingNote,
      mismatchedOwnerNote,
    ]);

    assert.deepEqual(supporting.map((item) => item.id), ["note-1"]);
  });

  it("excludes providers and notes already attached to an appointment from staging", () => {
    const appointment = reviewItem({
      id: "appt-1",
      kind: "appointment",
      fields: { appointmentTitle: "Wellness Visit" },
    });
    const attachedNote = reviewItem({
      id: "note-1",
      kind: "note",
      fields: { appointmentTitle: "Wellness Visit" },
      needsReview: false,
      status: "approved",
    });
    const provider = reviewItem({ id: "provider-1", kind: "provider" });

    const staged = importAnythingStagingItems([appointment, attachedNote, provider]);

    assert.deepEqual(
      staged.map((item) => item.id).sort(),
      ["appt-1"]
    );
  });
});

describe("Import Anything field helpers", () => {
  it("prefers provider organization over location name", () => {
    assert.equal(
      importAnythingPracticeOfficeValue(
        reviewItem({
          fields: {
            locationName: "Suite 200",
            providerOrganization: "Riverside Clinic",
          },
        })
      ),
      "Riverside Clinic"
    );
  });

  it("omits providerOrganization and locationName from simple field entries", () => {
    const entries = importAnythingSimpleFieldEntries(
      reviewItem({
        fields: {
          locationName: "Suite 200",
          providerOrganization: "Riverside Clinic",
          startsAt: "2026-08-01T09:00",
        },
      })
    );

    assert.deepEqual(
      entries.map(([field]) => field),
      ["startsAt"]
    );
  });
});

describe("Import Anything summary counts", () => {
  it("counts items by kind", () => {
    const items = [
      reviewItem({ id: "1", kind: "appointment" }),
      reviewItem({ id: "2", kind: "task" }),
      reviewItem({ id: "3", kind: "task" }),
    ];

    assert.deepEqual(importAnythingSummaryCounts(items), {
      appointments: 1,
      careprep: 0,
      medicationChanges: 0,
      notes: 0,
      providers: 0,
      questions: 0,
      tasks: 2,
    });
  });

  it("counts only non-rejected notes that create a new appointment", () => {
    const items = [
      reviewItem({ id: "1", kind: "note", createsNewAppointment: true }),
      reviewItem({
        id: "2",
        kind: "note",
        createsNewAppointment: true,
        status: "rejected",
      }),
      reviewItem({ id: "3", kind: "note", createsNewAppointment: false }),
    ];

    assert.equal(importAnythingNewAppointmentNoteCount(items), 1);
  });

  it("groups items by ownership cluster, keeping unassigned and orphan clusters visible", () => {
    const clusters: ImportAnythingOwnershipCluster[] = [
      {
        clusterId: "cluster-1",
        confidence: 0.9,
        displayName: "Andrew",
        entityType: "person",
        matchedCareSubjectId: "",
        rationale: "",
        suggestedNewPersonName: "",
      },
    ];
    const items = [
      reviewItem({ id: "1", ownerClusterId: "cluster-1", ownerConfidence: 0.9 }),
      reviewItem({ id: "2", ownerClusterId: "", ownerConfidence: 0 }),
    ];

    const counts = importAnythingOwnershipClusterCounts(items, clusters);

    assert.deepEqual(counts, [
      { count: 1, label: "Andrew" },
      { count: 1, label: "Unassigned" },
    ]);
  });

  it("builds a deterministic human-readable summary", () => {
    const items = [
      reviewItem({ id: "1", kind: "appointment" }),
      reviewItem({ id: "2", kind: "task" }),
    ];

    assert.equal(
      importAnythingDeterministicSummary(items, []),
      "Found 1 appointment, 1 task across Unassigned."
    );
  });
});
