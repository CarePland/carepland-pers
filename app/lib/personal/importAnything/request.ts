export const maxImportAnythingRawTextChars = 80_000;
export const maxImportAnythingSourceSummaries = 25;
export const maxImportAnythingSourceSummaryChars = 240;

export type NormalizedImportAnythingRequest = {
  rawText: string;
  requestedCareSubjectId: string;
  sourceSummaries: string[];
};

function normalizedSourceSummary(value: unknown): string {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, maxImportAnythingSourceSummaryChars)
    : "";
}

export function normalizeImportAnythingRequest(
  body: unknown
): NormalizedImportAnythingRequest {
  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const rawText =
    typeof payload.rawText === "string" ? payload.rawText.trim() : "";

  if (!rawText) {
    throw new Error("Add text or extracted file content before reviewing.");
  }

  if (rawText.length > maxImportAnythingRawTextChars) {
    throw new Error(
      `Import Anything can review up to ${maxImportAnythingRawTextChars.toLocaleString()} characters at a time. Try a smaller batch.`
    );
  }

  const sourceSummaries = Array.isArray(payload.sourceSummaries)
    ? Array.from(
        new Set(
          payload.sourceSummaries
            .map((item) => normalizedSourceSummary(item))
            .filter(Boolean)
        )
      ).slice(0, maxImportAnythingSourceSummaries)
    : [];

  return {
    rawText,
    requestedCareSubjectId:
      typeof payload.careSubjectId === "string"
        ? payload.careSubjectId.trim()
        : "",
    sourceSummaries,
  };
}
