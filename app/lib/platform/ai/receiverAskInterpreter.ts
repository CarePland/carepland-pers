import type {
  AiPlatformRecord,
  DecisionTrace,
  InteractionFamilyClassification,
  MeaningFrame,
  Observation,
} from "./contracts";
import { createMeaningFrameFromObservation } from "./meaningFrame";
import { classifyInteractionFamily } from "./interactionFamilyClassifier";

export type ReceiverAskContact = {
  displayName: string;
  id: string;
};

export type ReceiverAskAnswer = {
  actionLabel: string;
  answer: string;
  diagnosticSummary?: string;
  messageBody: string;
  question: string;
  recipientId: string;
  type: "answer" | "message";
};

export type ReceiverAskIntent =
  | "appointment_lookup"
  | "past_visit_or_health_history"
  | "medication_status"
  | "household_status"
  | "item_location"
  | "item_status"
  | "upcoming_plan"
  | "appointment_preparation"
  | "context_reference"
  | "person_or_contact_lookup"
  | "general_unknown";

export type ReceiverAskCapabilityStatus =
  | "available"
  | "capability_missing"
  | "not_required";

export type ReceiverAskIntentInterpretation = {
  capabilityStatus: ReceiverAskCapabilityStatus;
  confidence: number;
  decisionTrace: DecisionTrace<"intent_router", ReceiverAskIntent>;
  entities: AiPlatformRecord;
  intent: ReceiverAskIntent;
  temporalReferences: string[];
};

export type ReceiverAskInterpretation = {
  answer?: ReceiverAskAnswer;
  askInterpretation?: ReceiverAskIntentInterpretation;
  familyClassification: InteractionFamilyClassification;
  meaningFrame: MeaningFrame;
  needsRecovery: boolean;
};

export function interpretReceiverAskObservation(input: {
  contacts: ReceiverAskContact[];
  fallbackContact: ReceiverAskContact;
  meaningFrame?: MeaningFrame;
  observation: Observation;
}): ReceiverAskInterpretation {
  const meaningFrame =
    input.meaningFrame ??
    createMeaningFrameFromObservation(input.observation, {
      legacyInterpreter: "receiver_ask_v1",
    });
  const question = meaningFrame.normalizedText;
  const familyClassification = classifyInteractionFamily(meaningFrame);
  const askInterpretation = receiverAskIntentShouldRun(familyClassification)
    ? interpretReceiverAskIntent(question, meaningFrame)
    : undefined;

  if (
    familyClassification.family === "unclear" ||
    familyClassification.family === "contextual_response"
  ) {
    return {
      familyClassification,
      meaningFrame,
      needsRecovery: true,
    };
  }

  if (
    familyClassification.family === "ask" &&
    askInterpretation?.intent === "general_unknown"
  ) {
    return {
      askInterpretation,
      familyClassification,
      meaningFrame,
      needsRecovery: true,
    };
  }

  const answer = answerReceiverAsk(
      question,
      input.fallbackContact,
      input.contacts[0],
      familyClassification,
      askInterpretation,
      input.contacts
    );

  return {
    answer: {
      ...answer,
      diagnosticSummary: receiverAskDiagnosticSummary(
        familyClassification,
        askInterpretation,
        input.observation.modality || "unknown",
        answer.type
      ),
    },
    askInterpretation,
    familyClassification,
    meaningFrame,
    needsRecovery: false,
  };
}

export function interpretReceiverAskIntent(
  rawText: string,
  meaningFrame: MeaningFrame
): ReceiverAskIntentInterpretation {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const temporalReferences = extractTemporalReferences(lower);
  let intent: ReceiverAskIntent = "general_unknown";
  let confidence = 0.35;
  let capabilityStatus: ReceiverAskCapabilityStatus = "capability_missing";
  let entities: AiPlatformRecord = {};
  const matchedRules: string[] = [];

  const hasCareVisitTerm = /\b(appointment|doctor|provider|visit|clinic|dr\.?|note|notes)\b/.test(lower);
  const asksForPastCareContext =
    hasCareVisitTerm &&
    /\b(what did|what was|what were|what happened|talk about|discuss|discussed|said|notes?|last|previous|past|history)\b/.test(lower);
  const asksForUpcomingAppointment =
    hasCareVisitTerm &&
    /\b(next|upcoming|when|what time|leave|leaving|tomorrow|today)\b/.test(lower);

  if (asksForPastCareContext) {
    intent = "past_visit_or_health_history";
    confidence = 0.88;
    entities = { topic: extractTopicAfterAbout(text) || extractCareTopic(text) };
    matchedRules.push("past_care_context_terms");
  } else if (asksForUpcomingAppointment) {
    intent = "appointment_lookup";
    confidence = 0.9;
    capabilityStatus = "available";
    matchedRules.push("upcoming_appointment_terms");
  } else if (
    /\b(medicine|medication|meds|pills?)\b/.test(lower) &&
    /\b(did|have|has|take|taken|took)\b/.test(lower)
  ) {
    intent = "medication_status";
    confidence = 0.86;
    entities = { action: "take", entity: "medicine" };
    matchedRules.push("medication_status_terms");
  } else if (
    /^where\b/.test(lower) &&
    /\b(glasses|keys|phone|remote|wallet|hearing aids?|bags?|trash bags?)\b/.test(lower)
  ) {
    intent = "item_location";
    confidence = 0.84;
    entities = { entity: extractItemLocationEntity(text) };
    matchedRules.push("where_item_terms");
  } else if (
    /\b(does she|does he|does mom|does mother|does dad|does father)\b/.test(lower) &&
    /\bappointment\b/.test(lower)
  ) {
    intent = "appointment_lookup";
    confidence = 0.78;
    capabilityStatus = "capability_missing";
    entities = extractCareSubjectAppointmentEntities(text);
    matchedRules.push("care_subject_appointment_terms");
  } else if (
    /\b(has anyone|did anyone|has somebody|did somebody|did mom|did mother|did dad|did father|is she|is he|does she|does he|is someone)\b/.test(lower)
  ) {
    intent = "household_status";
    confidence = 0.82;
    entities = extractHouseholdStatusEntities(text);
    matchedRules.push("household_status_actor_terms");
  } else if (/\b(?:did|has|have)\s+(she|he|they)\s+(call|called|phone|phoned)\b/.test(lower)) {
    intent = "person_or_contact_lookup";
    confidence = 0.78;
    entities = extractPronounContactLookupEntities(text);
    matchedRules.push("unresolved_contact_reference_terms");
  } else if (/\bwhat happened to\b/.test(lower)) {
    intent = "item_status";
    confidence = 0.78;
    entities = { entity: extractAfterPhrase(text, "what happened to") };
    matchedRules.push("item_status_what_happened");
  } else if (
    (/^where\b/.test(lower) && /\b(we|i)\b.*\b(going|go)\b/.test(lower)) ||
    /\b(what should i bring|what am i doing next|what happens next|what comes next|where are we going)\b/.test(lower)
  ) {
    intent = "upcoming_plan";
    confidence = 0.8;
    matchedRules.push("upcoming_plan_terms");
  } else if (
    /\b(what do i need tomorrow|what do i need before i leave|what should i ask|am i ready|is everything set)\b/.test(lower)
  ) {
    intent = "appointment_preparation";
    confidence = 0.78;
    matchedRules.push("appointment_preparation_terms");
  } else if (/\b(when is that|what about that|is that right|what does that mean)\b/.test(lower)) {
    intent = "context_reference";
    confidence = 0.74;
    capabilityStatus = "capability_missing";
    entities = { reference: "that", requiresContext: true };
    matchedRules.push("unresolved_context_reference");
  } else if (/\b(who is|who's|phone number|number for|call|contact)\b/.test(lower)) {
    intent = "person_or_contact_lookup";
    confidence = 0.75;
    entities = { contact: extractContactName(text) };
    matchedRules.push("person_or_contact_terms");
  }

  if (intent === "general_unknown") {
    capabilityStatus = "not_required";
    matchedRules.push("no_ask_intent_match");
  }

  return {
    capabilityStatus,
    confidence,
    decisionTrace: {
      confidence,
      context: {
        askIntent: intent,
        capabilityStatus,
        entities,
        temporalReferences,
      },
      criticalFactors: matchedRules,
      execution: {
        policy: "no_write",
        status: "completed",
      },
      inputSummary: meaningFrame.normalizedText,
      layer: "intent_router",
      matchedRules,
      outputSummary: intent,
      timestamp: new Date().toISOString(),
      version: "receiver_ask_intent_v1",
    },
    entities,
    intent,
    temporalReferences,
  };
}

export function receiverAskNeedsRecovery(rawText: string) {
  const meaningFrame = createMeaningFrameFromObservation({
    observedAt: new Date().toISOString(),
    rawText,
    source: "receiver",
  });
  const classification = classifyInteractionFamily(meaningFrame);
  if (!receiverAskIntentShouldRun(classification)) return false;
  return interpretReceiverAskIntent(rawText, meaningFrame).intent === "general_unknown";
}

export function answerReceiverAsk(
  rawText: string,
  selectedContact: ReceiverAskContact,
  defaultContact = selectedContact,
  familyClassification?: InteractionFamilyClassification,
  askInterpretation?: ReceiverAskIntentInterpretation,
  availableContacts: ReceiverAskContact[] = [selectedContact, defaultContact]
): ReceiverAskAnswer {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const family = familyClassification?.family;
  const hasCareVisitTerm = /\b(appointment|doctor|provider|visit|clinic)\b/.test(lower);
  const asksForPastCareContext =
    hasCareVisitTerm &&
    /\b(what did|what was|what were|what happened|talk about|discuss|discussed|said|notes?|last|previous|past|history)\b/.test(lower);
  const asksForUpcomingAppointment =
    hasCareVisitTerm &&
    /\b(next|upcoming|when|what time|leave|leaving|tomorrow|today|bring)\b/.test(lower);

  if (family === "ask") {
    const effectiveAskInterpretation =
      askInterpretation ??
      interpretReceiverAskIntent(
        rawText,
        createMeaningFrameFromObservation({
          observedAt: new Date().toISOString(),
          rawText,
          source: "receiver",
        })
      );
    const askAnswer = answerForAskIntent(text, effectiveAskInterpretation);
    if (askAnswer) {
      return {
        ...askAnswer,
        question: text,
      };
    }
    return {
      question: text,
      answer: "More detail is needed to answer that.",
      actionLabel: "OK",
      messageBody: "",
      recipientId: "",
      type: "answer",
    };
  }

  if (asksForPastCareContext) {
    return {
      question: text,
      answer: "Past visit notes are not available from this Receiver view yet.",
      actionLabel: "That answered my question",
      messageBody: "",
      recipientId: "",
      type: "answer",
    };
  }

  if (asksForUpcomingAppointment || lower.includes("leave") || lower.includes("leaving")) {
    return {
      question: text,
      answer: "Upcoming appointments are available for the active Main Connect User.",
      actionLabel: "That answered my question",
      messageBody: "",
      recipientId: "",
      type: "answer",
    };
  }

  if (family === "remind") {
    return {
      question: text,
      answer: "This sounds like a reminder. Reminders are not available in this preview yet.",
      actionLabel: "OK",
      messageBody: "",
      recipientId: "",
      type: "answer",
    };
  }

  if (family === "need") {
    const needClarification = needObjectClarification(text);
    if (needClarification) {
      return {
        question: text,
        answer: needClarification,
        actionLabel: "OK",
        messageBody: "",
        recipientId: "",
        type: "answer",
      };
    }
    const recipient = resolveReceiverAskRecipient(text, availableContacts, defaultContact);
    if (recipient.needsClarification) {
      return recipientClarificationAnswer(text, recipient);
    }
    if (familyClassification?.secondaryFamilies?.includes("communicate") && recipient.explicit) {
      return {
        question: text,
        answer: `Ready to send to ${recipient.contact.displayName}.`,
        actionLabel: `Send to ${recipient.contact.displayName}`,
        messageBody: stripNeedCommunicationPayload(text, recipient.contact),
        recipientId: recipient.contact.id,
        type: "message",
      };
    }
    return {
      question: text,
      answer: "This sounds like something that needs attention.",
      actionLabel: `Send to ${recipient.contact.displayName}`,
      messageBody: text,
      recipientId: recipient.contact.id,
      type: "message",
    };
  }

  if (family === "observe") {
    const healthConcern = /\b(dizzy|hurt|hurts|pain|fell|fallen|chest|scared|breathe|breathing|medicine|medication|meds|pills?|don'?t feel well|do not feel well|feel well)\b/.test(lower);
    const recipient = resolveReceiverAskRecipient(text, availableContacts, defaultContact);
    if (recipient.needsClarification) {
      return recipientClarificationAnswer(text, recipient);
    }
    return {
      question: text,
      answer: healthConcern
        ? "This sounds like a health concern."
        : "This looks like something that happened.",
      actionLabel: `Send to ${recipient.contact.displayName}`,
      messageBody: text,
      recipientId: recipient.contact.id,
      type: "message",
    };
  }

  if (family === "communicate") {
    const recipient = resolveReceiverAskRecipient(text, availableContacts, defaultContact);
    if (recipient.needsClarification && isGenericAwarenessRecipientFallback(text, recipient)) {
      return {
        question: text,
        answer: `We can send this to ${recipient.contact.displayName}.`,
        actionLabel: `Send to ${recipient.contact.displayName}`,
        messageBody: text,
        recipientId: recipient.contact.id,
        type: "message",
      };
    }
    if (recipient.needsClarification || !recipient.explicit) {
      return recipientClarificationAnswer(text, recipient);
    }
    return {
      question: text,
      answer: `Ready to send to ${recipient.contact.displayName}.`,
      actionLabel: `Send to ${recipient.contact.displayName}`,
      messageBody: stripCommunicationPrefix(text, recipient.contact),
      recipientId: recipient.contact.id,
      type: "message",
    };
  }

  if (family === "decide") {
    const recipient = resolveReceiverAskRecipient(text, availableContacts, defaultContact);
    return {
      question: text,
      answer: "CarePland cannot make that decision from the available information.",
      actionLabel: `Send to ${recipient.contact.displayName}`,
      messageBody: text,
      recipientId: recipient.contact.id,
      type: "message",
    };
  }

  if (family === "escalate") {
    const recipient = resolveReceiverAskRecipient(text, availableContacts, defaultContact);
    return {
      question: text,
      answer: "This may need prompt attention.",
      actionLabel: `Send to ${recipient.contact.displayName}`,
      messageBody: text,
      recipientId: recipient.contact.id,
      type: "message",
    };
  }

  if (lower.includes("dizzy") || lower.includes("hurt") || lower.includes("pain")) {
    return {
      question: text,
      answer: "This may be important.",
      actionLabel: `Send to ${defaultContact.displayName}`,
      messageBody: text,
      recipientId: defaultContact.id,
      type: "message",
    };
  }

  return {
    question: text,
    answer: `Ready to send to ${selectedContact.displayName}.`,
    actionLabel: `Send to ${selectedContact.displayName}`,
    messageBody: text.replace(/^(tell|message|send)\s+/i, ""),
    recipientId: selectedContact.id,
    type: "message",
  };
}

function stripCommunicationPrefix(text: string, contact: ReceiverAskContact) {
  const withoutVerb = text.replace(/^(tell|message|send|let)\s+/i, "");
  const escapedName = contact.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutRecipient = withoutVerb.replace(new RegExp(`^${escapedName}\\s+`, "i"), "");
  return withoutRecipient.trim() || text;
}

function stripNeedCommunicationPayload(text: string, contact: ReceiverAskContact) {
  const escapedName = contact.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutTrailingCommunication = text
    .replace(new RegExp(`\\s+(?:and\\s+)?(?:tell|message|send|let)\\s+${escapedName}\\.?$`, "i"), "")
    .trim();
  return stripTrailingPunctuation(withoutTrailingCommunication) + ".";
}

type ReceiverAskRecipientResolution = {
  contact: ReceiverAskContact;
  explicit: boolean;
  intendedRecipientName?: string;
  needsClarification: boolean;
  reason: "ambiguous_pronoun" | "missing_recipient" | "unknown_named_recipient" | "";
};

function needObjectClarification(text: string) {
  const lower = text.toLowerCase();
  if (/\bi need another one\b/.test(lower)) {
    return "What do you need another one of?";
  }
  if (/\bi need it soon\b/.test(lower)) {
    return "What do you need soon?";
  }
  return "";
}

function resolveReceiverAskRecipient(
  text: string,
  availableContacts: ReceiverAskContact[],
  fallbackContact: ReceiverAskContact
): ReceiverAskRecipientResolution {
  const lower = text.toLowerCase();
  const uniqueContacts = uniqueReceiverAskContacts([...availableContacts, fallbackContact]);
  const namedContact = uniqueContacts.find((contact) =>
    new RegExp(`\\b${escapeRegExp(contact.displayName)}\\b`, "i").test(text)
  );

  if (namedContact) {
    return {
      contact: namedContact,
      explicit: true,
      intendedRecipientName: namedContact.displayName,
      needsClarification: false,
      reason: "",
    };
  }

  const ambiguousPronoun =
    text.match(/\b(?:tell|message|send|let|ask)\s+(her|him|them|everyone|somebody|someone)\b/i)?.[1] ||
    text.match(/\b(?:talk\s+to|call|phone)\s+(someone|somebody|her|him|them)\b/i)?.[1] ||
    text.match(/\b(someone|somebody)\s+(?:ought\s+to|needs?|should)\s+(?:to\s+)?(?:hear|know|be told)/i)?.[1];

  if (ambiguousPronoun) {
    return {
      contact: fallbackContact,
      explicit: false,
      intendedRecipientName: ambiguousPronoun,
      needsClarification: true,
      reason: "ambiguous_pronoun",
    };
  }

  const unknownNamedRecipient =
    text.match(/\b(?:tell|message|send|let|ask|call|phone)\s+([A-Z][a-z]+)\b/i)?.[1] ||
    text.match(/\b(?:need|want)\s+to\s+(?:talk\s+to|tell|message|send|call|phone)\s+([A-Z][a-z]+)\b/i)?.[1] ||
    text.match(/\b(my\s+daughter|my\s+son|my\s+sister|my\s+brother|my\s+mom|my\s+mother|my\s+dad|my\s+father|my\s+caregiver|my\s+doctor|my\s+nurse)\s+(?:ought\s+to|needs?|should)\s+(?:to\s+)?(?:hear|know|be told)/i)?.[1];

  if (unknownNamedRecipient) {
    return {
      contact: fallbackContact,
      explicit: true,
      intendedRecipientName: unknownNamedRecipient,
      needsClarification: true,
      reason: "unknown_named_recipient",
    };
  }

  return {
    contact: fallbackContact,
    explicit: false,
    intendedRecipientName: "",
    needsClarification: false,
    reason: "",
  };
}

function recipientClarificationAnswer(
  question: string,
  recipient: ReceiverAskRecipientResolution
): ReceiverAskAnswer {
  const answer =
    recipient.reason === "unknown_named_recipient"
      ? recipient.intendedRecipientName && /^my\s+/i.test(recipient.intendedRecipientName)
        ? relationshipRecipientClarification(recipient.intendedRecipientName)
        : `${recipient.intendedRecipientName || "That recipient"} is not available as a recipient in this preview. Choose an available recipient.`
      : "Who should receive this?";
  return {
    question,
    answer,
    actionLabel: "OK",
    messageBody: "",
    recipientId: "",
    type: "answer",
  };
}

function isGenericAwarenessRecipientFallback(
  text: string,
  recipient: ReceiverAskRecipientResolution
) {
  if (recipient.reason !== "ambiguous_pronoun") return false;
  if (!/^(someone|somebody)$/i.test(recipient.intendedRecipientName || "")) return false;
  return /\b(?:someone|somebody)\s+(?:ought\s+to|needs?|should)\s+(?:to\s+)?(?:hear|know|be told)\b/i.test(
    text
  );
}

function relationshipRecipientClarification(value: string) {
  const relation = value.replace(/^my\s+/i, "").toLowerCase();
  return `Which available person is your ${relation}?`;
}

function uniqueReceiverAskContacts(contacts: ReceiverAskContact[]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = contact.id || contact.displayName.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(contact.displayName);
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function answerForAskIntent(
  text: string,
  interpretation: ReceiverAskIntentInterpretation
): Omit<ReceiverAskAnswer, "question"> | null {
  if (interpretation.intent === "general_unknown") return null;
  const contextAnswer = requiredContextAnswer(interpretation);
  if (contextAnswer) {
    return {
      answer: contextAnswer,
      actionLabel: "OK",
      messageBody: "",
      recipientId: "",
      type: "answer",
    };
  }
  if (interpretation.intent === "appointment_lookup") {
    return {
      answer: "Upcoming appointments are available for the active Main Connect User.",
      actionLabel: "That answered my question",
      messageBody: "",
      recipientId: "",
      type: "answer",
    };
  }
  if (interpretation.intent === "past_visit_or_health_history") {
    return {
      answer: "Past visit notes are not available from this Receiver view yet.",
      actionLabel: "OK",
      messageBody: "",
      recipientId: "",
      type: "answer",
    };
  }
  return {
    answer: capabilityMissingAnswer(interpretation.intent),
    actionLabel: "OK",
    messageBody: "",
    recipientId: "",
    type: "answer",
  };
}

function requiredContextAnswer(interpretation: ReceiverAskIntentInterpretation) {
  if (!interpretation.entities.requiresContext) return "";
  if (interpretation.entities.subjectReference) {
    return "Who are you asking about?";
  }
  if (interpretation.intent === "context_reference") {
    return "More context is needed for that question.";
  }
  return "More context is needed for that question.";
}

function capabilityMissingAnswer(intent: ReceiverAskIntent) {
  if (intent === "item_location") {
    return "This is a question about where something is. Item location is not available in this preview yet.";
  }
  if (intent === "context_reference") {
    return "More context is needed for that question.";
  }
  if (intent === "household_status" || intent === "item_status") {
    return "This is a question about household status. That information is not available in this preview yet.";
  }
  if (intent === "upcoming_plan") {
    return "This is a question about upcoming plans. Plan details are not available in this preview yet.";
  }
  if (intent === "appointment_preparation") {
    return "This is a question about preparing to leave. Preparation details are not available in this preview yet.";
  }
  if (intent === "medication_status") {
    return "This is a question about medicine status. Medication tracking is not available in this preview yet.";
  }
  if (intent === "person_or_contact_lookup") {
    return "This is a question about a person or contact. Contact lookup is not available in this preview yet.";
  }
  return "More detail is needed to answer that.";
}

function receiverAskDiagnosticSummary(
  classification: InteractionFamilyClassification,
  askInterpretation: ReceiverAskIntentInterpretation | undefined,
  modality: string,
  responseType: ReceiverAskAnswer["type"]
) {
  const secondary = classification.secondaryFamilies?.length
    ? `; secondary ${classification.secondaryFamilies.join(", ")}`
    : "";
  const parts = [
    `Observation receiver/${modality}`,
    "MeaningFrame",
    `Family ${classification.family} ${Math.round(classification.confidence * 100)}%${secondary}`,
  ];
  if (askInterpretation) {
    parts.push(
      `AskIntent ${askInterpretation.intent} ${Math.round(askInterpretation.confidence * 100)}%`,
      `Capability ${askInterpretation.capabilityStatus}`
    );
  } else {
    parts.push("No family-specific interpretation yet");
  }
  parts.push("ReceiverAskInterpreter", `Response ${responseType}`);
  return parts.join(" -> ");
}

function receiverAskIntentShouldRun(
  classification: InteractionFamilyClassification
) {
  return classification.family === "ask";
}

function extractTemporalReferences(lower: string) {
  return ["later", "today", "tomorrow", "tonight", "next", "upcoming"].filter(
    (term) => lower.includes(term)
  );
}

function extractTopicAfterAbout(text: string) {
  return stripTrailingPunctuation(
    text.match(/\babout\s+(?:my\s+|the\s+)?(.+?)$/i)?.[1] || ""
  );
}

function extractCareTopic(text: string) {
  const match = text.match(/\b(?:my|the)\s+([a-z][a-z\s-]{1,40})\??$/i);
  return stripTrailingPunctuation(match?.[1] || "");
}

function extractItemLocationEntity(text: string) {
  const match =
    text.match(/\bwhere\s+(?:are|is)\s+(?:my|the|our)?\s*(.+?)\??$/i) ||
    text.match(/\bwhere\s+(?:did|do)\s+(?:i|we)\s+(?:put|leave)\s+(?:my|the|our)?\s*(.+?)\??$/i);
  return stripTrailingPunctuation(match?.[1] || "");
}

function extractHouseholdStatusEntities(text: string): AiPlatformRecord {
  const checkedOnMatch = text.match(/\bhas\s+anyone\s+checked\s+on\s+(her|him|them|[A-Z][a-z]+)\??$/i);
  if (checkedOnMatch) {
    const subject = checkedOnMatch[1];
    return {
      action: "checked_on",
      subject: /^[A-Z]/.test(subject) ? subject : "",
      subjectReference: /^[A-Z]/.test(subject) ? "" : subject.toLowerCase(),
      requiresContext: !/^[A-Z]/.test(subject),
    };
  }

  const fedMatch = text.match(/\b(?:has|did)\s+anyone\s+(fed|feed)\s+([a-z][a-z'-]*)\??$/i);
  if (fedMatch) {
    return {
      action: fedMatch[1].toLowerCase() === "feed" ? "fed" : fedMatch[1].toLowerCase(),
      subject: fedMatch[2],
    };
  }
  const careSubjectAction = text.match(/\bdid\s+(Mom|Mother|Dad|Father|[A-Z][a-z]+)\s+([a-z]+)\??$/i);
  if (careSubjectAction) {
    return {
      action: careSubjectAction[2].toLowerCase(),
      subject: careSubjectAction[1],
    };
  }
  const pronounState = text.match(/\bis\s+(she|he|they)\s+([a-z]+)\??$/i);
  if (pronounState) {
    return {
      action: pronounState[2].toLowerCase(),
      subject: "",
      subjectReference: pronounState[1].toLowerCase(),
      requiresContext: true,
    };
  }
  const pronounTimedState = text.match(/\bis\s+(she|he|they)\s+([a-z]+)(?:\s+(later|today|tomorrow|tonight))?\??$/i);
  if (pronounTimedState) {
    return {
      action: pronounTimedState[2].toLowerCase(),
      subject: "",
      subjectReference: pronounTimedState[1].toLowerCase(),
      timeReference: pronounTimedState[3]?.toLowerCase() || "",
      requiresContext: true,
    };
  }
  const someoneWithPronoun = text.match(/\bis\s+someone\s+with\s+(her|him|them)\??$/i);
  if (someoneWithPronoun) {
    return {
      action: "with",
      subject: "",
      subjectReference: someoneWithPronoun[1].toLowerCase(),
      requiresContext: true,
    };
  }
  const generic = text.match(/\b(?:has|did)\s+anyone\s+([a-z]+)\s+(.+?)\??$/i);
  return {
    action: generic?.[1]?.toLowerCase() || "",
    subject: stripTrailingPunctuation(generic?.[2] || ""),
  };
}

function extractPronounContactLookupEntities(text: string): AiPlatformRecord {
  const match = text.match(/\b(?:did|has|have)\s+(she|he|they)\s+(call|called|phone|phoned)\??$/i);
  return {
    action: normalizeContactAction(match?.[2] || ""),
    subject: "",
    subjectReference: match?.[1]?.toLowerCase() || "",
    requiresContext: true,
  };
}

function normalizeContactAction(value: string) {
  const lower = value.toLowerCase();
  if (lower === "called") return "call";
  if (lower === "phoned") return "phone";
  return lower;
}

function extractCareSubjectAppointmentEntities(text: string): AiPlatformRecord {
  const pronoun = text.match(/\bdoes\s+(she|he|they)\s+have\s+(?:an?\s+)?appointment/i)?.[1];
  if (pronoun) {
    return {
      subject: "",
      subjectReference: pronoun.toLowerCase(),
      requiresContext: true,
    };
  }
  const namedSubject = text.match(/\bdoes\s+(Mom|Mother|Dad|Father|[A-Z][a-z]+)\s+have\s+(?:an?\s+)?appointment/)?.[1];
  return {
    subject: namedSubject || "",
    requiresContext: !namedSubject,
  };
}

function extractAfterPhrase(text: string, phrase: string) {
  const index = text.toLowerCase().indexOf(phrase);
  if (index < 0) return "";
  return stripTrailingPunctuation(text.slice(index + phrase.length));
}

function extractContactName(text: string) {
  const match = text.match(/\b(?:who is|who's|phone number for|number for|call|contact)\s+([a-z][a-z'-]*)/i);
  return stripTrailingPunctuation(match?.[1] || "");
}

function stripTrailingPunctuation(value: string) {
  return value.trim().replace(/[?.!,]+$/g, "").trim();
}
