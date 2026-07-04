import type {
  TalkDecisionTrace,
  TalkIntent,
  TalkInterpretationResult,
  TalkProposedAction,
} from "../../personal/track/talkIntent";
import type {
  AiPlatformJson,
  AiPlatformRecord,
  DecisionTrace,
  IntentResult,
} from "./contracts";

export type PlatformTalkIntentResult = IntentResult<
  TalkIntent,
  TalkProposedAction
>;

export function talkIntentResultToPlatformIntent(
  result: TalkInterpretationResult
): PlatformTalkIntentResult {
  return {
    candidateIntents: result.decisionTrace.candidate_intents.map((candidate) => ({
      confidence: candidate.confidence,
      kind: candidate.intent,
      rejectionReason: candidate.rejection_reason,
    })),
    confidence: result.confidence,
    decisionTrace: talkDecisionTraceToPlatformTrace(result.decisionTrace),
    intent: result.intent,
    needsConfirmation: result.needsConfirmation,
    needsReview: result.needsReview,
    proposedAction: result.proposedAction,
    structuredPayload: platformRecordFromUnknownRecord({
      ...result.structuredPayload,
      completedFocusItemId: result.completedFocusItemId,
      createdTrackEventId: result.createdTrackEventId,
      displayResponse: result.displayResponse,
      spokenResponse: result.spokenResponse,
      title: result.title,
    }),
  };
}

export function talkDecisionTraceToPlatformTrace(
  trace: TalkDecisionTrace
): DecisionTrace<"intent_router", TalkIntent> {
  return {
    competingCandidates: trace.candidate_intents.map((candidate) => ({
      confidence: candidate.confidence,
      kind: candidate.intent,
      rejectionReason: candidate.rejection_reason,
    })),
    confidence: trace.confidence,
    context: platformRecordFromUnknownRecord({
      activePersonId: trace.context_used.active_person_id,
      activeTodayFocusItemIds: trace.context_used.active_today_focus_item_ids,
      availableContactIds: trace.context_used.available_contact_ids,
      currentSurface: trace.context_used.current_surface,
      receiverDeviceId: trace.context_used.receiver_device_id,
      upcomingAppointmentIds: trace.context_used.upcoming_appointment_ids,
    }),
    criticalFactors: trace.critical_deciding_factors,
    // TODO(ai-platform): Talk persists snake_case `entities_detected` as
    // `Record<string, unknown>`. Keep persistence stable; narrow Talk payloads
    // to JSON-safe platform records in a later migration.
    entitiesDetected: platformRecordFromUnknownRecord(trace.entities_detected),
    execution: {
      policy: trace.write_policy,
      status: trace.write_policy === "write_allowed" ? "queued" : "not_started",
    },
    humanReview: {
      required: trace.requires_review,
    },
    inputSummary: trace.matched_phrases.join(", ") || trace.primary_intent,
    layer: "intent_router",
    matchedPhrases: trace.matched_phrases,
    matchedRules: trace.matched_rules,
    outputSummary: trace.proposed_action,
    // TODO(ai-platform): Preserve persisted snake_case Talk trace fields while
    // exposing camelCase platform fields through this adapter. Do not rewrite
    // stored `talkDecisionTrace` payloads in this pass.
    timestamp: trace.timestamp,
    version: `${trace.router_version}/${trace.model_version}`,
  };
}

function platformRecordFromUnknownRecord(
  record: Record<string, unknown>
): AiPlatformRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => isPlatformJson(value))
  ) as AiPlatformRecord;
}

function isPlatformJson(value: unknown): value is AiPlatformJson {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return Number.isFinite(value) || typeof value !== "number";
  }

  if (Array.isArray(value)) {
    return value.every(isPlatformJson);
  }

  if (value && typeof value === "object") {
    return Object.values(value).every(isPlatformJson);
  }

  return false;
}
