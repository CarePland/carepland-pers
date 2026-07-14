import type {
  AiPlatformRecord,
  MeaningFrame,
  Observation,
} from "./contracts";

export function createMeaningFrameFromObservation(
  observation: Observation,
  metadata: Record<string, unknown> = {}
): MeaningFrame {
  const normalizedText = String(
    observation.transcriptText || observation.rawText || ""
  )
    .replace(/\s+/g, " ")
    .trim();

  return {
    ambiguity: normalizedText ? "none" : "high",
    confidence: normalizedText ? 1 : 0,
    concepts: [],
    contactReferences: [],
    decisionTraceFragments: [],
    householdReferences: [],
    metadata: platformRecordFromUnknownRecord(metadata),
    normalizedText,
    observationId: observation.observationId,
    personReferences: [],
    provenance: {
      deviceId: observation.context?.deviceId ?? null,
      modality: observation.modality,
      observedAt: observation.observedAt,
      observationId: observation.observationId,
      source: observation.source,
      surface: observation.context?.surface ?? null,
    },
    temporalReferences: [],
  };
}

function platformRecordFromUnknownRecord(record: Record<string, unknown>): AiPlatformRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => isPlatformJson(value))
  ) as AiPlatformRecord;
}

function isPlatformJson(value: unknown): boolean {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isPlatformJson);
  }

  if (value && typeof value === "object") {
    return Object.values(value).every(isPlatformJson);
  }

  return false;
}
