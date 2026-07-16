export type ProfileDraft = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  displayName: string;
  email: string;
  familyName: string;
  givenName: string;
  phone: string;
  postalCode: string;
  region: string;
  timezone: string;
};

export const emptyProfileDraft: ProfileDraft = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  country: "US",
  displayName: "",
  email: "",
  familyName: "",
  givenName: "",
  phone: "",
  postalCode: "",
  region: "",
  timezone: "",
};

export function profileDisplayName(
  profile: Pick<ProfileDraft, "displayName" | "email" | "familyName" | "givenName">
) {
  const fullName = [profile.givenName.trim(), profile.familyName.trim()]
    .filter(Boolean)
    .join(" ");

  return profile.displayName.trim() || fullName || profile.email.trim();
}

export function profileDraftKey(profile: ProfileDraft) {
  return JSON.stringify(trimProfileDraft(profile));
}

export function profileDraftFromRow({
  fallbackEmail,
  fallbackTimezone,
  row,
}: {
  fallbackEmail: string;
  fallbackTimezone: string;
  row: Record<string, unknown> | null | undefined;
}): ProfileDraft {
  return {
    addressLine1: String(row?.address_line1 ?? ""),
    addressLine2: String(row?.address_line2 ?? ""),
    city: String(row?.city ?? ""),
    country: String(row?.country ?? "US"),
    displayName: String(row?.display_name ?? ""),
    email: String(row?.email ?? fallbackEmail),
    familyName: String(row?.family_name ?? ""),
    givenName: String(row?.given_name ?? ""),
    phone: String(
      row?.phone ??
        (typeof row?.phone_e164 === "string"
          ? formatUsPhoneFromDigits(phoneDigits(row.phone_e164))
          : "")
    ),
    postalCode: String(row?.postal_code ?? ""),
    region: String(row?.region ?? ""),
    timezone:
      typeof row?.timezone === "string" && row.timezone
        ? row.timezone
        : fallbackTimezone,
  };
}

export function formatUsPhoneFromDigits(digits: string): string {
  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const line = digits.slice(6, 10);

  if (digits.length <= 3) {
    return area ? `(${area}` : "";
  }

  if (digits.length <= 6) {
    return `(${area}) ${prefix}`;
  }

  return `(${area}) ${prefix}-${line}`;
}

export function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");

  if (digits.length > 10 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  return digits.slice(0, 10);
}

export function zipDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 9);
}

export function formatUsZipFromDigits(digits: string): string {
  const compactDigits = zipDigits(digits);

  if (compactDigits.length <= 5) {
    return compactDigits;
  }

  return `${compactDigits.slice(0, 5)}-${compactDigits.slice(5)}`;
}

export function normalizeUsPhone(value: string):
  | { display: string; e164: string }
  | null {
  const digits = phoneDigits(value);

  if (digits.length !== 10) {
    return null;
  }

  return {
    display: formatUsPhoneFromDigits(digits),
    e164: `+1${digits}`,
  };
}

export function isValidUsZip(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value.trim());
}

export function isProfileAddressComplete(profile: ProfileDraft): boolean {
  return Boolean(
    profile.addressLine1.trim() &&
      profile.city.trim() &&
      profile.region.trim() &&
      isValidUsZip(formatUsZipFromDigits(zipDigits(profile.postalCode)))
  );
}

export function trimProfileDraft(profile: ProfileDraft): ProfileDraft {
  return {
    addressLine1: profile.addressLine1.trim(),
    addressLine2: profile.addressLine2.trim(),
    city: profile.city.trim(),
    country: profile.country.trim(),
    displayName: profile.displayName.trim(),
    email: profile.email.trim(),
    familyName: profile.familyName.trim(),
    givenName: profile.givenName.trim(),
    phone: profile.phone.trim(),
    postalCode: profile.postalCode.trim(),
    region: profile.region.trim(),
    timezone: profile.timezone.trim(),
  };
}

export function validateProfileDraft({
  isLikelyEmail,
  profileDetailsRequired,
  profileDraft,
  profileEmail,
  requiresEmailUpdate,
  userEmail,
}: {
  isLikelyEmail: (value: string) => boolean;
  profileDetailsRequired: boolean;
  profileDraft: ProfileDraft;
  profileEmail: string;
  requiresEmailUpdate: boolean;
  userEmail?: string | null;
}) {
  if (!profileEmail) {
    throw new Error("Email is required.");
  }

  if (!isLikelyEmail(profileEmail)) {
    throw new Error("Enter a valid email address.");
  }

  if (
    requiresEmailUpdate &&
    userEmail &&
    profileEmail.toLowerCase() === userEmail.toLowerCase()
  ) {
    throw new Error("Enter an email you can access.");
  }

  if (profileDetailsRequired && !profileDraft.givenName.trim()) {
    throw new Error("First name is required.");
  }

  if (profileDetailsRequired && !profileDraft.familyName.trim()) {
    throw new Error("Last name is required.");
  }

  if (profileDetailsRequired && !profileDraft.timezone.trim()) {
    throw new Error("Time zone is required.");
  }

  if (profileDetailsRequired && !profileDraft.phone.trim()) {
    throw new Error("Phone number is required.");
  }

  if (profileDetailsRequired && !profileDraft.addressLine1.trim()) {
    throw new Error("Address line 1 is required.");
  }

  if (profileDetailsRequired && !profileDraft.city.trim()) {
    throw new Error("City is required.");
  }

  if (profileDetailsRequired && !profileDraft.region.trim()) {
    throw new Error("State is required.");
  }

  if (profileDetailsRequired && !profileDraft.postalCode.trim()) {
    throw new Error("ZIP code is required.");
  }

  if (
    profileDraft.postalCode.trim() &&
    !isValidUsZip(formatUsZipFromDigits(zipDigits(profileDraft.postalCode)))
  ) {
    throw new Error("Enter a valid ZIP code, like 12345 or 12345-6789.");
  }

  const normalizedPhone = profileDraft.phone.trim()
    ? normalizeUsPhone(profileDraft.phone)
    : null;

  if (
    (profileDetailsRequired || profileDraft.phone.trim()) &&
    !normalizedPhone
  ) {
    throw new Error("Enter a valid 10-digit U.S. phone number.");
  }

  return { normalizedPhone };
}
