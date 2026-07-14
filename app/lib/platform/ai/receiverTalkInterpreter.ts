import type {
  MeaningFrame,
  Observation,
} from "./contracts";
import { createMeaningFrameFromObservation } from "./meaningFrame";
import {
  interpretTalkInput,
  type TalkAppointment,
  type TalkContact,
  type TalkFocusItem,
  type TalkInterpretationResult,
} from "../../personal/track/talkIntent";

export type ReceiverTalkInterpretation = {
  meaningFrame: MeaningFrame;
  result: TalkInterpretationResult;
};

export type ReceiverTalkSerializedResult = {
  completed_focus_item_id?: string;
  confidence: number;
  created_track_event_id?: string;
  decision_trace: TalkInterpretationResult["decisionTrace"];
  display_response: string;
  intent: TalkInterpretationResult["intent"];
  needs_confirmation: boolean;
  needs_review: boolean;
  proposed_action: TalkInterpretationResult["proposedAction"];
  spoken_response: string;
  structured_payload: Record<string, unknown>;
  title: string;
};

export function interpretReceiverTalkObservation(input: {
  appointments?: TalkAppointment[];
  careCircleId: string;
  contacts?: TalkContact[];
  focusItems?: TalkFocusItem[];
  meaningFrame?: MeaningFrame;
  now?: Date;
  observation: Observation;
  receiverDeviceId?: string | null;
}): ReceiverTalkInterpretation {
  const meaningFrame =
    input.meaningFrame ??
    createMeaningFrameFromObservation(input.observation, {
      legacyInterpreter: "receiver_talk_v1",
    });

  return {
    meaningFrame,
    result: interpretTalkInput({
      appointments: input.appointments,
      careCircleId: input.careCircleId,
      careSubjectId: input.observation.context?.careSubjectId || "",
      contacts: input.contacts,
      focusItems: input.focusItems,
      inputText: meaningFrame.normalizedText,
      now: input.now,
      receiverDeviceId:
        input.receiverDeviceId ?? input.observation.context?.deviceId ?? null,
      source: "receiver_talk",
    }),
  };
}

export function serializeReceiverTalkResult(
  result: TalkInterpretationResult
): ReceiverTalkSerializedResult {
  return {
    completed_focus_item_id: result.completedFocusItemId,
    confidence: result.confidence,
    created_track_event_id: result.createdTrackEventId,
    decision_trace: result.decisionTrace,
    display_response: result.displayResponse,
    intent: result.intent,
    needs_confirmation: result.needsConfirmation,
    needs_review: result.needsReview,
    proposed_action: result.proposedAction,
    spoken_response: result.spokenResponse,
    structured_payload: result.structuredPayload,
    title: result.title,
  };
}

export function receiverTalkShouldHandleText(rawText: string) {
  const text = rawText.trim().toLowerCase();
  if (!text) return false;

  if (/\b(walk|walked|walking)\b/.test(text)) {
    return true;
  }

  if (/\b(weigh|weighed|weight)\b/.test(text) && /\d/.test(text)) {
    return true;
  }

  if (
    /\b(med|meds|medication|medications|pills)\b/.test(text) &&
    !/\b(question|ask|wonder|what|why|how|should)\b/.test(text)
  ) {
    return true;
  }

  return false;
}
