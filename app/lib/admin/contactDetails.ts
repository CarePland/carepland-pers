export type AdminContactDetails = {
  address_line1: string;
  address_line2: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  phone_e164: string;
  postal_code: string;
  region: string;
  timezone: string;
};

export const emptyAdminContactDetails: AdminContactDetails = {
  address_line1: "",
  address_line2: "",
  city: "",
  country: "",
  email: "",
  phone: "",
  phone_e164: "",
  postal_code: "",
  region: "",
  timezone: "",
};

export const adminContactDetailFields: Array<{
  key: keyof AdminContactDetails;
  label: string;
}> = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "timezone", label: "Time zone" },
  { key: "address_line1", label: "Address" },
  { key: "address_line2", label: "Address 2" },
  { key: "city", label: "City" },
  { key: "region", label: "State" },
  { key: "postal_code", label: "ZIP" },
  { key: "country", label: "Country" },
];

export function adminContactDetailsFromValue(
  value: unknown
): AdminContactDetails {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    address_line1: stringValue(source.address_line1),
    address_line2: stringValue(source.address_line2),
    city: stringValue(source.city),
    country: stringValue(source.country),
    email: stringValue(source.email),
    phone: stringValue(source.phone),
    phone_e164: stringValue(source.phone_e164),
    postal_code: stringValue(source.postal_code),
    region: stringValue(source.region),
    timezone: stringValue(source.timezone),
  };
}

export function contactDetailsChangedFields(
  before: AdminContactDetails,
  after: AdminContactDetails
) {
  return adminContactDetailFields
    .filter(({ key }) => before[key].trim() !== after[key].trim())
    .map(({ key }) => key);
}

export function isLikelyContactEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeAdminPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const normalizedDigits =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (normalizedDigits.length !== 10) {
    return {
      display: value.trim(),
      e164: "",
    };
  }

  return {
    display: `(${normalizedDigits.slice(0, 3)}) ${normalizedDigits.slice(
      3,
      6
    )}-${normalizedDigits.slice(6)}`,
    e164: `+1${normalizedDigits}`,
  };
}

export function redactedContactDetails(details: AdminContactDetails) {
  return Object.fromEntries(
    adminContactDetailFields.map(({ key }) => [
      key,
      redactContactValue(details[key]),
    ])
  );
}

function redactContactValue(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("@")) {
    return trimmed.replace(/(^.).*(@.*$)/, "$1***$2");
  }

  if (trimmed.length <= 4) {
    return `${trimmed.slice(0, 1)}...`;
  }

  return `${trimmed.slice(0, 4)}...`;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
