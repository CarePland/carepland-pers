// Generic, permissive coercions from an untyped JSON value (e.g. parsed API
// response bodies) into a plain string/number/array of records. These make no
// assumptions about the shape of the source data and are not specific to any
// one product surface -- several app/lib/personal/importAnything modules
// (draft.ts, providers.ts, appointments.ts) define their own similarly named
// but behaviorally different local coercions (they only accept real strings
// and truncate to a field-specific max length; these do not). That is
// pre-existing, deliberate-looking variation for different call sites, not
// something this module unifies.

export function stringFromUnknown(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.map(stringFromUnknown).filter(Boolean).join("\n");
  }

  return String(value);
}

export function numberFromUnknown(value: unknown): number {
  return typeof value === "number" ? value : Number(value) || 0;
}

export function arrayFromUnknown(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : [];
}
