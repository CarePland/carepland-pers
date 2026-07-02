import {
  type FocusCompletionType,
  type TrackEventDraft,
  buildTrackEventFromFocusCompletion,
} from ".";

export type TalkIntent =
  | "appointment_question"
  | "connect_call_request"
  | "focus_item_completion"
  | "measured_track_event"
  | "track_event_activity"
  | "unknown";

export type TalkProposedAction =
  | "answer_appointment_question"
  | "clarify"
  | "complete_focus_item"
  | "create_track_event"
  | "request_call";

export type TalkSource = "receiver_talk";

export type TalkFocusItem = {
  careCircleId: string;
  careSubjectId: string;
  completionConfig?: {
    unit?: string | null;
    unitOptions?: string[];
  };
  completionEventType?: string | null;
  completionType: FocusCompletionType;
  id: string;
  promptText?: string | null;
  title: string;
};

export type TalkAppointment = {
  id: string;
  providerName?: string | null;
  providerOrganization?: string | null;
  reason?: string | null;
  startsAt: string;
  title: string;
};

export type TalkContact = {
  displayName: string;
  id: string;
};

export type TalkInterpretationInput = {
  appointments?: TalkAppointment[];
  careCircleId: string;
  careSubjectId: string;
  contacts?: TalkContact[];
  focusItems?: TalkFocusItem[];
  inputText: string;
  now?: Date;
  receiverDeviceId?: string | null;
  source?: TalkSource;
};

export type TalkInterpretationResult = {
  completedFocusItemId?: string;
  confidence: number;
  createdTrackEventId?: string;
  displayResponse: string;
  intent: TalkIntent;
  needsConfirmation: boolean;
  needsReview: boolean;
  proposedAction: TalkProposedAction;
  spokenResponse: string;
  structuredPayload: Record<string, unknown>;
  title: string;
  trackEventDraft?: TrackEventDraft;
};

const highConfidenceThreshold = 0.78;

export function interpretTalkInput({
  appointments = [],
  careCircleId,
  careSubjectId,
  contacts = [],
  focusItems = [],
  inputText,
  now = new Date(),
  receiverDeviceId = null,
  source = "receiver_talk",
}: TalkInterpretationInput): TalkInterpretationResult {
  const text = inputText.trim();
  const normalizedText = normalizeTalkText(text);
  const occurredAt = now.toISOString();
  const basePayload = {
    receiverDeviceId: receiverDeviceId || undefined,
    source,
    version: 1,
  };

  if (!text) {
    return unknownResult("I did not catch that. Please try again.", basePayload);
  }

  const appointmentResult = appointmentQuestionResult(
    normalizedText,
    appointments,
    basePayload
  );
  if (appointmentResult) {
    return appointmentResult;
  }

  const callResult = callRequestResult(normalizedText, contacts, basePayload);
  if (callResult) {
    return callResult;
  }

  const weight = parseWeight(normalizedText);
  if (weight) {
    return trackEventResult({
      careCircleId,
      careSubjectId,
      confidence: 0.94,
      eventType: "measurement.weight",
      intent: "measured_track_event",
      needsReview: false,
      note: null,
      occurredAt,
      payload: {
        ...basePayload,
        measurementKind: "weight",
        parsedValue: weight.value,
        parsedUnit: weight.unit,
      },
      title: "Weight",
      value: weight.value,
      unit: weight.unit,
    });
  }

  const medication = medicationResult({
    basePayload,
    careCircleId,
    careSubjectId,
    focusItems,
    normalizedText,
    occurredAt,
  });
  if (medication) {
    return medication;
  }

  const walking = walkingActivityResult({
    basePayload,
    careCircleId,
    careSubjectId,
    normalizedText,
    occurredAt,
  });
  if (walking) {
    return walking;
  }

  if (symptomLike(normalizedText)) {
    return trackEventResult({
      careCircleId,
      careSubjectId,
      confidence: 0.72,
      eventType: "symptom.check",
      intent: "track_event_activity",
      needsReview: true,
      note: null,
      occurredAt,
      payload: {
        ...basePayload,
        category: "symptom",
        reviewReason: "Symptom-like Talk input needs human review before durable use.",
      },
      title: "Symptom note",
    });
  }

  return unknownResult(
    "I am not sure what to do with that yet. Please try saying it another way.",
    basePayload
  );
}

export function talkResultShouldWrite(result: TalkInterpretationResult) {
  return Boolean(
    result.trackEventDraft &&
      !result.needsConfirmation &&
      !result.needsReview &&
      result.confidence >= highConfidenceThreshold
  );
}

function appointmentQuestionResult(
  normalizedText: string,
  appointments: TalkAppointment[],
  basePayload: Record<string, unknown>
): TalkInterpretationResult | null {
  if (
    !/\b(appointment|doctor|visit)\b/.test(normalizedText) ||
    !/\b(next|upcoming|when|what time|leav(?:e|ing))\b/.test(normalizedText)
  ) {
    return null;
  }

  const nextAppointment = appointments
    .filter((appointment) => !Number.isNaN(new Date(appointment.startsAt).getTime()))
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0];

  const answer = nextAppointment
    ? `Your next appointment is ${nextAppointment.title} on ${formatAppointmentTime(nextAppointment.startsAt)}.`
    : "I do not see an upcoming appointment right now.";

  return {
    confidence: 0.93,
    displayResponse: answer,
    intent: "appointment_question",
    needsConfirmation: false,
    needsReview: false,
    proposedAction: "answer_appointment_question",
    spokenResponse: answer,
    structuredPayload: {
      ...basePayload,
      appointmentId: nextAppointment?.id,
      appointmentStartsAt: nextAppointment?.startsAt,
    },
    title: "Next appointment",
  };
}

function callRequestResult(
  normalizedText: string,
  contacts: TalkContact[],
  basePayload: Record<string, unknown>
): TalkInterpretationResult | null {
  const match = normalizedText.match(/\b(?:call|phone|ring)\s+([a-z][a-z\s'-]{0,40})$/);
  const requestedName = match?.[1]?.trim();

  if (!requestedName) {
    return null;
  }

  const contact = contacts.find((item) =>
    normalizeTalkText(item.displayName).includes(requestedName)
  );
  const displayName = contact?.displayName || titleCase(requestedName);
  const response = contact
    ? `Calling ${displayName}.`
    : `I heard a call request for ${displayName}.`;

  return {
    confidence: contact ? 0.96 : 0.82,
    displayResponse: response,
    intent: "connect_call_request",
    needsConfirmation: !contact,
    needsReview: false,
    proposedAction: "request_call",
    spokenResponse: response,
    structuredPayload: {
      ...basePayload,
      contactId: contact?.id,
      contactName: displayName,
      requestedName,
    },
    title: `Call ${displayName}`,
  };
}

function medicationResult({
  basePayload,
  careCircleId,
  careSubjectId,
  focusItems,
  normalizedText,
  occurredAt,
}: {
  basePayload: Record<string, unknown>;
  careCircleId: string;
  careSubjectId: string;
  focusItems: TalkFocusItem[];
  normalizedText: string;
  occurredAt: string;
}): TalkInterpretationResult | null {
  if (!/\b(med|meds|medication|medications|pills)\b/.test(normalizedText)) {
    return null;
  }

  if (/\b(question|ask|wonder|what|why|how|should)\b/.test(normalizedText)) {
    return {
      confidence: 0.86,
      displayResponse:
        "I heard a medication question. I will not guess about medications from here.",
      intent: "unknown",
      needsConfirmation: true,
      needsReview: true,
      proposedAction: "clarify",
      spokenResponse:
        "I heard a medication question. I will not guess about medications from here.",
      structuredPayload: {
        ...basePayload,
        medicationIntent: "question",
      },
      title: "Medication question",
    };
  }

  const skipped = /\b(skip|skipped|missed|did not take|didn't take|not take)\b/.test(normalizedText);
  const broadLabel = medicationWindowLabel(normalizedText);
  const matchedFocusItem = matchMedicationFocusItem(focusItems, broadLabel);

  if (matchedFocusItem) {
    const event = buildTrackEventFromFocusCompletion({
      focusItem: {
        ...matchedFocusItem,
        completionEventType: skipped ? "medication.skipped" : "medication.taken",
      },
      occurredAt,
      source: "talk_voice",
      structuredPayload: {
        ...basePayload,
        medicationScope: "broad",
        medicationWindow: broadLabel,
        outcome: skipped ? "skipped" : "taken",
      },
      title: skipped
        ? `${broadLabel} medications skipped`
        : `${broadLabel} medications taken`,
    });

    return {
      completedFocusItemId: matchedFocusItem.id,
      confidence: 0.9,
      displayResponse: skipped
        ? "I recorded that the broad medication routine was skipped."
        : "I recorded that the broad medication routine was taken.",
      intent: "focus_item_completion",
      needsConfirmation: false,
      needsReview: false,
      proposedAction: "complete_focus_item",
      spokenResponse: skipped
        ? "I recorded that the broad medication routine was skipped."
        : "I recorded that the broad medication routine was taken.",
      structuredPayload: event.structuredPayload ?? {},
      title: event.title,
      trackEventDraft: event,
    };
  }

  return trackEventResult({
    careCircleId,
    careSubjectId,
    confidence: 0.84,
    eventType: skipped ? "medication.skipped" : "medication.taken",
    intent: "track_event_activity",
    needsReview: false,
    note: null,
    occurredAt,
    payload: {
      ...basePayload,
      medicationScope: "broad",
      medicationWindow: broadLabel,
      outcome: skipped ? "skipped" : "taken",
    },
    title: skipped
      ? `${broadLabel} medications skipped`
      : `${broadLabel} medications taken`,
  });
}

function walkingActivityResult({
  basePayload,
  careCircleId,
  careSubjectId,
  normalizedText,
  occurredAt,
}: {
  basePayload: Record<string, unknown>;
  careCircleId: string;
  careSubjectId: string;
  normalizedText: string;
  occurredAt: string;
}): TalkInterpretationResult | null {
  if (!/\b(walk|walked|walking)\b/.test(normalizedText)) {
    return null;
  }

  const destination = normalizedText.match(/\bto the ([a-z0-9\s'-]{2,40})/)?.[1]?.trim();
  const title = destination
    ? `Walked to ${destination}`
    : "Walking activity";

  return trackEventResult({
    careCircleId,
    careSubjectId,
    confidence: 0.88,
    eventType: "activity.walking",
    intent: "track_event_activity",
    needsReview: false,
    note: null,
    occurredAt,
    payload: {
      ...basePayload,
      activityKind: "walking",
      destination: destination || undefined,
    },
    title,
  });
}

function trackEventResult({
  careCircleId,
  careSubjectId,
  confidence,
  eventType,
  intent,
  needsReview,
  note,
  occurredAt,
  payload,
  title,
  unit,
  value,
}: {
  careCircleId: string;
  careSubjectId: string;
  confidence: number;
  eventType: string;
  intent: TalkIntent;
  needsReview: boolean;
  note: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
  title: string;
  unit?: string | null;
  value?: number | null;
}): TalkInterpretationResult {
  const draft: TrackEventDraft = {
    careCircleId,
    careSubjectId,
    confidence,
    eventType,
    needsReview,
    note,
    occurredAt,
    source: "talk_voice",
    structuredPayload: payload,
    title,
    unit: unit ?? null,
    value: value ?? null,
  };

  const response = needsReview
    ? "I heard that, but I need someone to review it before saving."
    : `I recorded: ${title}.`;

  return {
    confidence,
    displayResponse: response,
    intent,
    needsConfirmation: false,
    needsReview,
    proposedAction: "create_track_event",
    spokenResponse: response,
    structuredPayload: payload,
    title,
    trackEventDraft: draft,
  };
}

function parseWeight(normalizedText: string) {
  const match = normalizedText.match(
    /\b(?:weigh(?:ed)?|weight(?: is| was)?|weighed in at)\s+(\d{2,3}(?:\.\d+)?)\s*(pounds?|lbs?|kg|kilograms?)?\b/
  );
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return null;

  const rawUnit = match[2] || "pounds";
  const unit = /^k/.test(rawUnit) ? "kg" : "lb";

  return { unit, value };
}

function matchMedicationFocusItem(
  focusItems: TalkFocusItem[],
  broadLabel: string
) {
  const windowWord = broadLabel.toLowerCase();

  return focusItems.find((item) => {
    const text = normalizeTalkText(`${item.title} ${item.promptText ?? ""}`);

    return (
      item.completionType === "medication" ||
      (item.completionEventType ?? "").startsWith("medication.") ||
      (text.includes("med") && (!windowWord || text.includes(windowWord)))
    );
  });
}

function medicationWindowLabel(normalizedText: string) {
  if (normalizedText.includes("evening") || normalizedText.includes("night")) {
    return "Evening";
  }

  if (normalizedText.includes("afternoon")) {
    return "Afternoon";
  }

  return "Morning";
}

function symptomLike(normalizedText: string) {
  return /\b(hurt|hurts|pain|dizzy|dizziness|ache|aches|sore)\b/.test(normalizedText);
}

function unknownResult(
  response: string,
  basePayload: Record<string, unknown>
): TalkInterpretationResult {
  return {
    confidence: 0.35,
    displayResponse: response,
    intent: "unknown",
    needsConfirmation: true,
    needsReview: true,
    proposedAction: "clarify",
    spokenResponse: response,
    structuredPayload: basePayload,
    title: "Needs clarification",
  };
}

function normalizeTalkText(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatAppointmentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "the scheduled time";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
