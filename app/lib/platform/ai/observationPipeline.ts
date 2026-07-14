import type {
  AiPlatformRecord,
  MeaningFrame,
  Observation,
} from "./contracts";
import { createMeaningFrameFromObservation } from "./meaningFrame";

export type ObservationModality = NonNullable<Observation["modality"]>;

export type ObservationSource = Observation["source"];

export type SubmitObservationInput = {
  activeWorkflow?: string | null;
  careCircleId?: string | null;
  deviceId?: string | null;
  metadata?: Record<string, unknown>;
  modality: ObservationModality;
  observedAt?: Date | string;
  observationId?: string;
  personId?: string | null;
  source: ObservationSource;
  structuredInput?: Record<string, unknown>;
  surface?: string | null;
  text: string;
};

export type ObservationLegacyRoute =
  | "legacy_speech_talk"
  | "legacy_text_ask"
  | "legacy_text_ask_fallback";

export type ObservationHandlerOutcome<TResult> =
  | {
      handled: true;
      result: TResult;
    }
  | {
      handled: false;
      result?: TResult;
    };

export type SubmitObservationHandlers<TResult> = {
  handleSpeech?: (observation: Observation, meaningFrame: MeaningFrame) => Promise<ObservationHandlerOutcome<TResult>> | ObservationHandlerOutcome<TResult>;
  handleText: (observation: Observation, meaningFrame: MeaningFrame) => Promise<TResult> | TResult;
};

export type SubmitObservationResult<TResult> = {
  meaningFrame: MeaningFrame;
  observation: Observation;
  result: TResult;
  route: ObservationLegacyRoute;
};

export function createObservation(input: SubmitObservationInput): Observation {
  const text = input.text.trim();
  const observedAt =
    input.observedAt instanceof Date
      ? input.observedAt.toISOString()
      : input.observedAt || new Date().toISOString();

  return {
    context: {
      activeWorkflow: input.activeWorkflow ?? null,
      careCircleId: input.careCircleId ?? null,
      careSubjectId: input.personId ?? null,
      deviceId: input.deviceId ?? null,
      surface: input.surface ?? null,
    },
    metadata: platformRecordFromUnknownRecord(input.metadata ?? {}),
    modality: input.modality,
    observedAt,
    observationId: input.observationId || createObservationId(),
    rawText: text,
    source: input.source,
    structuredInput: platformRecordFromUnknownRecord(input.structuredInput ?? {}),
    transcriptText: input.modality === "speech" ? text : undefined,
  };
}

export async function submitObservation<TResult>(
  input: SubmitObservationInput,
  handlers: SubmitObservationHandlers<TResult>
): Promise<SubmitObservationResult<TResult>> {
  const observation = createObservation(input);
  const meaningFrame = createMeaningFrameFromObservation(observation);

  if (observation.modality === "speech" && handlers.handleSpeech) {
    const speechOutcome = await handlers.handleSpeech(observation, meaningFrame);
    if (speechOutcome.handled) {
      return {
        meaningFrame,
        observation,
        result: speechOutcome.result,
        route: "legacy_speech_talk",
      };
    }

    return {
      meaningFrame,
      observation,
      result: await handlers.handleText(observation, meaningFrame),
      route: "legacy_text_ask_fallback",
    };
  }

  return {
    meaningFrame,
    observation,
    result: await handlers.handleText(observation, meaningFrame),
    route: "legacy_text_ask",
  };
}

function createObservationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `obs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
