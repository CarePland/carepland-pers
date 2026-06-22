export function shortId(value: string | null): string {
  return value ? value.slice(0, 8) : "—";
}

export function formatAdminDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
