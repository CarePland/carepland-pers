import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildImportAnythingProviderUpserts,
  maxImportAnythingProviderCandidateFieldChars,
  maxImportAnythingProviderCandidates,
  normalizeImportAnythingProviderCandidates,
} from "./providers";

describe("Import Anything provider mapping", () => {
  it("builds durable per-Care-VIP provider rows from approved providers and appointments", () => {
    const rows = buildImportAnythingProviderUpserts({
      careCircleId: "circle-1",
      careSubjectId: "subject-1",
      generatedAt: "2026-06-22T17:00:00.000Z",
      intakeItemId: "intake-1",
      items: [
        {
          fields: {
            locationName: "Main Clinic",
            phone: "555-0101",
            providerName: " Dr. Smith ",
            providerOrganization: " Primary Care ",
          },
          kind: "provider",
          status: "approved",
        },
        {
          fields: {
            locationAddress: "123 Main St",
            locationName: "Heart Center",
            locationPhone: "555-0202",
            providerName: "Dr. Patel",
            providerOrganization: "Cardiology",
          },
          kind: "appointment",
          status: "approved",
        },
      ],
      userId: "user-1",
    });

    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], {
      care_circle_id: "circle-1",
      care_subject_id: "subject-1",
      created_by_user_id: "user-1",
      last_seen_at: "2026-06-22T17:00:00.000Z",
      location_address: null,
      location_name: "Main Clinic",
      normalized_provider_name: "dr. smith",
      normalized_provider_organization: "primary care",
      phone: "555-0101",
      provider_name: "Dr. Smith",
      provider_organization: "Primary Care",
      source: "import_anything",
      source_intake_item_id: "intake-1",
      updated_at: "2026-06-22T17:00:00.000Z",
    });
    assert.equal(rows[1]?.location_address, "123 Main St");
    assert.equal(rows[1]?.phone, "555-0202");
  });

  it("deduplicates provider rows within one import by normalized name and organization", () => {
    const rows = buildImportAnythingProviderUpserts({
      careCircleId: "circle-1",
      careSubjectId: "subject-1",
      generatedAt: "2026-06-22T17:00:00.000Z",
      intakeItemId: null,
      items: [
        {
          fields: {
            providerName: "Dr. Smith",
            providerOrganization: "Primary Care",
          },
          kind: "provider",
          status: "approved",
        },
        {
          fields: {
            providerName: " dr. smith ",
            providerOrganization: " primary   care ",
          },
          kind: "appointment",
          status: "approved",
        },
      ],
      userId: "user-1",
    });

    assert.equal(rows.length, 1);
  });

  it("does not insert a new provider row for items matched to a saved provider", () => {
    const rows = buildImportAnythingProviderUpserts({
      careCircleId: "circle-1",
      careSubjectId: "subject-1",
      generatedAt: "2026-06-22T17:00:00.000Z",
      intakeItemId: null,
      items: [
        {
          fields: {
            providerName: "Slightly different Dr. Smith",
            providerOrganization: "Primary Care",
          },
          kind: "provider",
          matchedProviderId: "provider-1",
          status: "approved",
        },
        {
          fields: {
            providerName: "Dr. Patel",
            providerOrganization: "Cardiology",
          },
          kind: "appointment",
          matchedProviderId: "provider-2",
          status: "approved",
        },
      ],
      userId: "user-1",
    });

    assert.deepEqual(rows, []);
  });

  it("skips rejected items and rows without provider identity", () => {
    const rows = buildImportAnythingProviderUpserts({
      careCircleId: "circle-1",
      careSubjectId: "subject-1",
      generatedAt: "2026-06-22T17:00:00.000Z",
      intakeItemId: null,
      items: [
        {
          fields: { providerName: "Dr. Smith" },
          kind: "provider",
          status: "rejected",
        },
        {
          fields: { locationName: "Main Clinic" },
          kind: "provider",
          status: "approved",
        },
      ],
      userId: "user-1",
    });

    assert.deepEqual(rows, []);
  });

  it("normalizes saved provider candidates for AI context", () => {
    const candidates = normalizeImportAnythingProviderCandidates([
      {
        care_subject_id: " subject-1 ",
        id: " provider-1 ",
        location_address: " 123 Main St ",
        location_name: " Main Clinic ",
        nickname: " Primary ",
        phone: " 555-0101 ",
        provider_name: " Dr. Smith ",
        provider_organization: " Primary Care ",
      },
    ]);

    assert.deepEqual(candidates, [
      {
        care_subject_id: "subject-1",
        id: "provider-1",
        location_address: "123 Main St",
        location_name: "Main Clinic",
        nickname: "Primary",
        phone: "555-0101",
        provider_name: "Dr. Smith",
        provider_organization: "Primary Care",
      },
    ]);
  });

  it("bounds saved provider candidates for prompt context", () => {
    const candidates = normalizeImportAnythingProviderCandidates(
      Array.from(
        { length: maxImportAnythingProviderCandidates + 3 },
        (_, index) => ({
          id: `provider-${index}`,
          provider_name: "x".repeat(
            maxImportAnythingProviderCandidateFieldChars + 10
          ),
        })
      )
    );

    assert.equal(candidates.length, maxImportAnythingProviderCandidates);
    assert.equal(
      candidates[0]?.provider_name.length,
      maxImportAnythingProviderCandidateFieldChars
    );
  });
});
