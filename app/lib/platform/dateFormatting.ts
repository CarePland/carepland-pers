// Shared display-date formatting. Uses the runtime's local timezone (there is
// no explicit timeZone option), matching how this has always rendered in
// CarePlandPers.tsx -- moving it here does not change that behavior.

export function formatDate(value: string | null): string {
  if (!value) {
    return "Date not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
