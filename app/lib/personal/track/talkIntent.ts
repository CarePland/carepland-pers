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
  decisionTrace: TalkDecisionTrace;
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

export type TalkDecisionTrace = {
  candidate_intents: Array<{
    confidence: number;
    intent: TalkIntent;
    rejection_reason?: string;
  }>;
  confidence: number;
  context_used: {
    active_person_id: string;
    active_today_focus_item_ids: string[];
    available_contact_ids: string[];
    current_surface: TalkSource;
    receiver_device_id?: string;
    upcoming_appointment_ids: string[];
  };
  critical_deciding_factors: string[];
  entities_detected: Record<string, unknown>;
  matched_phrases: string[];
  matched_rules: string[];
  model_version: "deterministic_v1";
  primary_intent: TalkIntent;
  proposed_action: TalkProposedAction;
  requires_confirmation: boolean;
  requires_review: boolean;
  router_version: "talk_router_v1";
  timestamp: string;
  write_policy: "no_write" | "review_required" | "write_allowed";
};

type TalkDecisionContext = {
  activePersonId: string;
  appointments: TalkAppointment[];
  contacts: TalkContact[];
  focusItems: TalkFocusItem[];
  receiverDeviceId?: string | null;
  source: TalkSource;
  timestamp: string;
};

type TalkDecisionInput = {
  candidateIntents?: TalkDecisionTrace["candidate_intents"];
  confidence: number;
  criticalDecidingFactors: string[];
  entitiesDetected?: Record<string, unknown>;
  intent: TalkIntent;
  matchedPhrases?: string[];
  matchedRules: string[];
  proposedAction: TalkProposedAction;
  requiresConfirmation?: boolean;
  requiresReview?: boolean;
  writePolicy?: TalkDecisionTrace["write_policy"];
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
  const decisionContext: TalkDecisionContext = {
    activePersonId: careSubjectId,
    appointments,
    contacts,
    focusItems,
    receiverDeviceId,
    source,
    timestamp: occurredAt,
  };

  if (!text) {
    return unknownResult(
      "I did not catch that. Please try again.",
      basePayload,
      decisionContext
    );
  }

  const appointmentResult = appointmentQuestionResult(
    normalizedText,
    appointments,
    basePayload,
    decisionContext
  );
  if (appointmentResult) {
    return appointmentResult;
  }

  const callResult = callRequestResult(
    normalizedText,
    contacts,
    basePayload,
    decisionContext
  );
  if (callResult) {
    return callResult;
  }

  const weight = parseWeight(normalizedText);
  if (weight) {
    return trackEventResult({
      careCircleId,
      careSubjectId,
      confidence: 0.94,
      decisionContext,
      decision: {
        criticalDecidingFactors: [
          "Weight rule matched a weight verb followed by a numeric value.",
        ],
        entitiesDetected: { unit: weight.unit, value: weight.value },
        matchedPhrases: weight.matchedPhrases,
        matchedRules: ["talk.measurement.weight.v1"],
      },
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
    decisionContext,
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
    decisionContext,
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
      decisionContext,
      decision: {
        criticalDecidingFactors: [
          "Symptom-like word matched, but symptom inputs require review in Talk v1.",
        ],
        matchedPhrases: matchedSymptomPhrases(normalizedText),
        matchedRules: ["talk.symptom.review.v1"],
      },
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
    basePayload,
    decisionContext
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
  basePayload: Record<string, unknown>,
  decisionContext: TalkDecisionContext
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

  const trace = decisionTrace(decisionContext, {
      confidence: 0.93,
      criticalDecidingFactors: [
        "Appointment question rule matched appointment language plus a next/upcoming time cue.",
      ],
      entitiesDetected: {
        appointment_id: nextAppointment?.id,
        appointment_starts_at: nextAppointment?.startsAt,
      },
      intent: "appointment_question",
      matchedPhrases: matchedPhrases(normalizedText, [
        "appointment",
        "doctor",
        "visit",
        "next",
        "upcoming",
        "when",
      ]),
      matchedRules: ["talk.appointment.next_question.v1"],
      proposedAction: "answer_appointment_question",
      requiresConfirmation: false,
      requiresReview: false,
      writePolicy: "no_write",
  });

  return {
    confidence: 0.93,
    decisionTrace: trace,
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
      talkDecisionTrace: trace,
    },
    title: "Next appointment",
  };
}

function callRequestResult(
  normalizedText: string,
  contacts: TalkContact[],
  basePayload: Record<string, unknown>,
  decisionContext: TalkDecisionContext
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
  const trace = decisionTrace(decisionContext, {
    confidence: contact ? 0.96 : 0.82,
    criticalDecidingFactors: [
      contact
        ? "Call request rule matched a call verb and a known contact name."
        : "Call request rule matched a call verb, but the contact was not known.",
    ],
    entitiesDetected: {
      contact_id: contact?.id,
      contact_name: displayName,
      requested_name: requestedName,
    },
    intent: "connect_call_request",
    matchedPhrases: matchedPhrases(normalizedText, [
      "call",
      "phone",
      "ring",
      requestedName,
    ]),
    matchedRules: ["talk.connect.call_request.v1"],
    proposedAction: "request_call",
    requiresConfirmation: !contact,
    requiresReview: false,
    writePolicy: "no_write",
  });

  return {
    confidence: contact ? 0.96 : 0.82,
    decisionTrace: trace,
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
      talkDecisionTrace: trace,
    },
    title: `Call ${displayName}`,
  };
}

function medicationResult({
  basePayload,
  careCircleId,
  careSubjectId,
  decisionContext,
  focusItems,
  normalizedText,
  occurredAt,
}: {
  basePayload: Record<string, unknown>;
  careCircleId: string;
  careSubjectId: string;
  decisionContext: TalkDecisionContext;
  focusItems: TalkFocusItem[];
  normalizedText: string;
  occurredAt: string;
}): TalkInterpretationResult | null {
  if (!/\b(med|meds|medication|medications|pills)\b/.test(normalizedText)) {
    return null;
  }

  if (/\b(question|ask|wonder|what|why|how|should)\b/.test(normalizedText)) {
    const trace = decisionTrace(decisionContext, {
      confidence: 0.86,
      criticalDecidingFactors: [
        "Medication keyword matched with question language; Talk v1 does not answer medication questions.",
      ],
      entitiesDetected: { medication_scope: "question" },
      intent: "unknown",
      matchedPhrases: matchedPhrases(normalizedText, [
        "med",
        "meds",
        "medication",
        "medications",
        "pills",
        "question",
        "ask",
        "should",
      ]),
      matchedRules: ["talk.medication.question_guardrail.v1"],
      proposedAction: "clarify",
      requiresConfirmation: true,
      requiresReview: true,
      writePolicy: "review_required",
    });

    return {
      confidence: 0.86,
      decisionTrace: trace,
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
        talkDecisionTrace: trace,
      },
      title: "Medication question",
    };
  }

  const skipped = /\b(skip|skipped|missed|did not take|didn't take|not take)\b/.test(normalizedText);
  const broadLabel = medicationWindowLabel(normalizedText);
  const matchedFocusItem = matchMedicationFocusItem(focusItems, broadLabel);

  if (matchedFocusItem) {
    const trace = decisionTrace(decisionContext, {
      confidence: 0.9,
      criticalDecidingFactors: [
        "Medication keyword matched an active broad medication Focus Item for this person.",
      ],
      entitiesDetected: {
        focus_item_id: matchedFocusItem.id,
        medication_scope: "broad",
        medication_window: broadLabel,
        outcome: skipped ? "skipped" : "taken",
      },
      intent: "focus_item_completion",
      matchedPhrases: [
        ...matchedPhrases(normalizedText, [
          "med",
          "meds",
          "medication",
          "medications",
          "pills",
          "morning",
          "evening",
          "afternoon",
          "took",
          "taken",
          "skipped",
        ]),
        matchedFocusItem.title,
      ],
      matchedRules: ["talk.focus.medication_completion.v1"],
      proposedAction: "complete_focus_item",
      requiresConfirmation: false,
      requiresReview: false,
    });
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
        talkDecisionTrace: trace,
      },
      title: skipped
        ? `${broadLabel} medications skipped`
        : `${broadLabel} medications taken`,
    });

    return {
      completedFocusItemId: matchedFocusItem.id,
      confidence: 0.9,
      decisionTrace: trace,
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
    decisionContext,
    decision: {
      criticalDecidingFactors: [
        "Medication keyword matched broad taken/skipped language without a specific Focus Item match.",
      ],
      entitiesDetected: {
        medication_scope: "broad",
        medication_window: broadLabel,
        outcome: skipped ? "skipped" : "taken",
      },
      matchedPhrases: matchedPhrases(normalizedText, [
        "med",
        "meds",
        "medication",
        "medications",
        "pills",
        "morning",
        "evening",
        "afternoon",
        "took",
        "taken",
        "skipped",
      ]),
      matchedRules: ["talk.track.medication_broad.v1"],
    },
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
  decisionContext,
  normalizedText,
  occurredAt,
}: {
  basePayload: Record<string, unknown>;
  careCircleId: string;
  careSubjectId: string;
  decisionContext: TalkDecisionContext;
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
    decisionContext,
    decision: {
      criticalDecidingFactors: [
        "Walking activity rule matched a walk/walked/walking keyword.",
      ],
      entitiesDetected: {
        activity_kind: "walking",
        destination: destination || undefined,
      },
      matchedPhrases: matchedPhrases(normalizedText, [
        "walk",
        "walked",
        "walking",
        destination,
      ]),
      matchedRules: ["talk.activity.walking.v1"],
    },
    eventType: "activity.walking",
    displayResponse: `This is an exercise entry. I recorded: ${title}.`,
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
  decisionContext,
  decision,
  eventType,
  displayResponse,
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
  decisionContext: TalkDecisionContext;
  decision: {
    criticalDecidingFactors: string[];
    entitiesDetected?: Record<string, unknown>;
    matchedPhrases?: string[];
    matchedRules: string[];
  };
  displayResponse?: string;
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
  const proposedAction = "create_track_event";
  const trace = decisionTrace(decisionContext, {
    confidence,
    criticalDecidingFactors: decision.criticalDecidingFactors,
    entitiesDetected: decision.entitiesDetected,
    intent,
    matchedPhrases: decision.matchedPhrases,
    matchedRules: decision.matchedRules,
    proposedAction,
    requiresConfirmation: false,
    requiresReview: needsReview,
    writePolicy:
      needsReview || confidence < highConfidenceThreshold
        ? "review_required"
        : "write_allowed",
  });
  const draft: TrackEventDraft = {
    careCircleId,
    careSubjectId,
    confidence,
    eventType,
    needsReview,
    note,
    occurredAt,
    source: "talk_voice",
    structuredPayload: {
      ...payload,
      talkDecisionTrace: trace,
    },
    title,
    unit: unit ?? null,
    value: value ?? null,
  };

  const response = displayResponse || (needsReview
    ? "I heard that, but I need someone to review it before saving."
    : `I recorded: ${title}.`);

  return {
    confidence,
    decisionTrace: trace,
    displayResponse: response,
    intent,
    needsConfirmation: false,
    needsReview,
    proposedAction,
    spokenResponse: response,
    structuredPayload: draft.structuredPayload ?? {},
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

  return {
    matchedPhrases: matchedPhrases(normalizedText, [match[0], match[1], rawUnit]),
    unit,
    value,
  };
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
  basePayload: Record<string, unknown>,
  decisionContext: TalkDecisionContext
): TalkInterpretationResult {
  const trace = decisionTrace(decisionContext, {
    confidence: 0.35,
    criticalDecidingFactors: [
      "No deterministic Talk v1 rule matched with enough specificity.",
    ],
    intent: "unknown",
    matchedRules: ["talk.unknown.no_rule_match.v1"],
    proposedAction: "clarify",
    requiresConfirmation: true,
    requiresReview: true,
    writePolicy: "review_required",
  });

  return {
    confidence: 0.35,
    decisionTrace: trace,
    displayResponse: response,
    intent: "unknown",
    needsConfirmation: true,
    needsReview: true,
    proposedAction: "clarify",
    spokenResponse: response,
    structuredPayload: {
      ...basePayload,
      talkDecisionTrace: trace,
    },
    title: "Needs clarification",
  };
}

function decisionTrace(
  context: TalkDecisionContext,
  {
  confidence,
  criticalDecidingFactors,
  entitiesDetected = {},
  intent,
  matchedPhrases = [],
  matchedRules,
  proposedAction,
  requiresConfirmation = false,
  requiresReview = false,
  writePolicy,
}: {
  confidence: number;
  criticalDecidingFactors: string[];
  entitiesDetected?: Record<string, unknown>;
  intent: TalkIntent;
  matchedPhrases?: string[];
  matchedRules: string[];
  proposedAction: TalkProposedAction;
  requiresConfirmation?: boolean;
  requiresReview?: boolean;
  writePolicy?: TalkDecisionTrace["write_policy"];
}): TalkDecisionTrace {
  const resolvedWritePolicy =
    writePolicy ??
    (confidence >= highConfidenceThreshold ? "write_allowed" : "review_required");

  return {
    candidate_intents: candidateIntents(intent, confidence),
    confidence,
    context_used: {
      active_person_id: context.activePersonId,
      active_today_focus_item_ids: context.focusItems.map((item) => item.id),
      available_contact_ids: context.contacts.map((contact) => contact.id),
      current_surface: context.source,
      receiver_device_id: context.receiverDeviceId || undefined,
      upcoming_appointment_ids: context.appointments.map((appointment) => appointment.id),
    },
    critical_deciding_factors: criticalDecidingFactors,
    entities_detected: compactRecord(entitiesDetected),
    matched_phrases: uniqueStrings(matchedPhrases),
    matched_rules: matchedRules,
    model_version: "deterministic_v1",
    primary_intent: intent,
    proposed_action: proposedAction,
    requires_confirmation: requiresConfirmation,
    requires_review: requiresReview,
    router_version: "talk_router_v1",
    timestamp: context.timestamp,
    write_policy: resolvedWritePolicy,
  };
}

function candidateIntents(
  primaryIntent: TalkIntent,
  confidence: number
): TalkDecisionTrace["candidate_intents"] {
  const candidates: TalkIntent[] = [
    "appointment_question",
    "connect_call_request",
    "measured_track_event",
    "focus_item_completion",
    "track_event_activity",
    "unknown",
  ];

  return candidates.map((intent) =>
    intent === primaryIntent
      ? { confidence, intent }
      : {
          confidence: fallbackCandidateConfidence(intent, primaryIntent),
          intent,
          rejection_reason: `Rejected because ${primaryIntent} had the strongest deterministic match.`,
        }
  );
}

function fallbackCandidateConfidence(intent: TalkIntent, primaryIntent: TalkIntent) {
  if (primaryIntent === "unknown") {
    return intent === "unknown" ? 0.35 : 0.15;
  }

  if (intent === "unknown") {
    return 0.05;
  }

  return 0.18;
}

function matchedPhrases(text: string, phrases: Array<string | null | undefined>) {
  return uniqueStrings(
    phrases
      .map((phrase) => phrase?.trim())
      .filter((phrase): phrase is string => Boolean(phrase))
      .filter((phrase) => phraseMatches(text, phrase))
  );
}

function phraseMatches(text: string, phrase: string) {
  const normalizedPhrase = phrase.toLowerCase().trim();
  if (!normalizedPhrase) return false;

  if (/^[a-z0-9\s'-]+$/.test(normalizedPhrase)) {
    return new RegExp(`\\b${escapeRegExp(normalizedPhrase)}\\b`).test(text);
  }

  return text.includes(normalizedPhrase);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchedSymptomPhrases(text: string) {
  return matchedPhrases(text, [
    "hurt",
    "hurts",
    "pain",
    "dizzy",
    "dizziness",
    "ache",
    "aches",
    "sore",
  ]);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== "")
  );
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
