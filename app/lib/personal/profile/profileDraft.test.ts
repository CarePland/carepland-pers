import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatUsPhoneFromDigits,
  isValidUsZip,
  normalizeUsPhone,
  phoneDigits,
  profileDisplayName,
  profileDraftFromRow,
  profileDraftKey,
  trimProfileDraft,
  validateProfileDraft,
} from "./profileDraft";

const baseProfileDraft = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  country: "US",
  displayName: "",
  email: "user@example.com",
  familyName: "Patient",
  givenName: "Pat",
  phone: "(310) 555-1212",
  postalCode: "90292",
  region: "",
  timezone: "America/Los_Angeles",
};

const isLikelyEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

describe("profileDraft", () => {
  it("hydrates profile rows with auth email and timezone fallbacks", () => {
    assert.deepEqual(
      profileDraftFromRow({
        fallbackEmail: "auth@example.com",
        fallbackTimezone: "America/Los_Angeles",
        row: null,
      }),
      {
        addressLine1: "",
        addressLine2: "",
        city: "",
        country: "US",
        displayName: "",
        email: "auth@example.com",
        familyName: "",
        givenName: "",
        phone: "",
        postalCode: "",
        region: "",
        timezone: "America/Los_Angeles",
      }
    );
  });

  it("formats and normalizes U.S. phone values", () => {
    assert.equal(phoneDigits("+1 (310) 555-1212"), "3105551212");
    assert.equal(formatUsPhoneFromDigits("3105551212"), "(310) 555-1212");
    assert.deepEqual(normalizeUsPhone("310.555.1212"), {
      display: "(310) 555-1212",
      e164: "+13105551212",
    });
    assert.equal(normalizeUsPhone("555"), null);
  });

  it("validates U.S. ZIP code formats", () => {
    assert.equal(isValidUsZip("90292"), true);
    assert.equal(isValidUsZip("90292-1234"), true);
    assert.equal(isValidUsZip("9029"), false);
  });

  it("uses display name, full name, then email for profile labels", () => {
    assert.equal(
      profileDisplayName({
        displayName: "Care Captain",
        email: "pat@example.com",
        familyName: "Patient",
        givenName: "Pat",
      }),
      "Care Captain"
    );
    assert.equal(
      profileDisplayName({
        displayName: "",
        email: "pat@example.com",
        familyName: "Patient",
        givenName: "Pat",
      }),
      "Pat Patient"
    );
    assert.equal(
      profileDisplayName({
        displayName: "",
        email: "pat@example.com",
        familyName: "",
        givenName: "",
      }),
      "pat@example.com"
    );
  });

  it("uses trimmed values for dirty-state keys", () => {
    assert.equal(
      profileDraftKey({
        ...baseProfileDraft,
        givenName: " Pat ",
        postalCode: " 90292 ",
      }),
      profileDraftKey(baseProfileDraft)
    );
    assert.deepEqual(trimProfileDraft({ ...baseProfileDraft, city: " LA " }), {
      ...baseProfileDraft,
      city: "LA",
    });
  });

  it("validates required profile details and returns normalized phone data", () => {
    assert.deepEqual(
      validateProfileDraft({
        isLikelyEmail,
        profileDetailsRequired: true,
        profileDraft: baseProfileDraft,
        profileEmail: baseProfileDraft.email,
        requiresEmailUpdate: false,
        userEmail: baseProfileDraft.email,
      }),
      {
        normalizedPhone: {
          display: "(310) 555-1212",
          e164: "+13105551212",
        },
      }
    );
  });

  it("keeps OAuth-style optional profile fields optional", () => {
    assert.deepEqual(
      validateProfileDraft({
        isLikelyEmail,
        profileDetailsRequired: false,
        profileDraft: {
          ...baseProfileDraft,
          familyName: "",
          givenName: "",
          phone: "",
          postalCode: "",
          timezone: "",
        },
        profileEmail: baseProfileDraft.email,
        requiresEmailUpdate: false,
        userEmail: baseProfileDraft.email,
      }),
      { normalizedPhone: null }
    );
  });

  it("rejects required missing timezone and invalid optional phone", () => {
    assert.throws(
      () =>
        validateProfileDraft({
          isLikelyEmail,
          profileDetailsRequired: true,
          profileDraft: { ...baseProfileDraft, timezone: "" },
          profileEmail: baseProfileDraft.email,
          requiresEmailUpdate: false,
          userEmail: baseProfileDraft.email,
        }),
      /Time zone is required/
    );

    assert.throws(
      () =>
        validateProfileDraft({
          isLikelyEmail,
          profileDetailsRequired: false,
          profileDraft: { ...baseProfileDraft, phone: "555" },
          profileEmail: baseProfileDraft.email,
          requiresEmailUpdate: false,
          userEmail: baseProfileDraft.email,
        }),
      /valid 10-digit/
    );
  });
});
