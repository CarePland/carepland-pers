export const maxImportAnythingSourceTextChars = 20_000;

type ImportAnythingSourceFile = {
  name: string;
  size?: number;
  type?: string;
};

export function normalizeImportAnythingSourceName(name: string): string {
  return name.trim().replace(/\s+/g, " ") || "Untitled source";
}

function readableFileSize(size: number | undefined): string {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return "";
  }

  if (size < 1_000) {
    return `${size} B`;
  }

  if (size < 1_000_000) {
    return `${Math.round(size / 100) / 10} KB`;
  }

  return `${Math.round(size / 100_000) / 10} MB`;
}

export function formatImportAnythingSourceSummary(
  file: ImportAnythingSourceFile
): string {
  const details = [file.type?.trim() || "file", readableFileSize(file.size)]
    .filter(Boolean)
    .join(", ");

  return `${normalizeImportAnythingSourceName(file.name)} (${details})`;
}

export function formatImportAnythingTextSection({
  name,
  text,
}: {
  name: string;
  text: string;
}): string {
  const trimmedText = text.trim();
  const boundedText = trimmedText.slice(0, maxImportAnythingSourceTextChars);
  const truncated = trimmedText.length > maxImportAnythingSourceTextChars;

  return [
    `--- ${normalizeImportAnythingSourceName(name)} ---`,
    boundedText || "[Text file was empty.]",
    truncated
      ? `[Text truncated to ${maxImportAnythingSourceTextChars.toLocaleString()} characters for Import Anything review.]`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatImportAnythingPlaceholderSection({
  message,
  name,
}: {
  message: string;
  name: string;
}): string {
  return `--- ${normalizeImportAnythingSourceName(name)} ---\n[${message}]`;
}
