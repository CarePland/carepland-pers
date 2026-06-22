export const CONNECT_ASK_INTERPRETER_PROMPT_KEY = "connect_ask_interpreter";

export const connectAskInterpreterPromptShape = {
  productArea: "connect",
  promptName: "Ask Interpreter Prompt",
  promptKey: CONNECT_ASK_INTERPRETER_PROMPT_KEY,
  description:
    "Classifies open-ended receiver requests and returns short, confirmation-first next actions.",
  expectedOutput: {
    intent: "household_request",
    confidence: "high",
    receiverMessage: "I can send this to Andrew.",
    proposedAction: {
      type: "send_message",
      recipientRole: "coordinator",
      recipientName: "Andrew",
      body: "I need milk.",
    },
    buttons: [
      { label: "Send to Andrew", action: "confirm_send" },
      { label: "Edit", action: "edit" },
      { label: "Go Back", action: "cancel" },
    ],
  },
};

export function getReceiverAskSuggestions(context = {}) {
  // TODO: replace local suggestions with GET /api/connect/receiver/ask-suggestions.
  const suggestions = [
    "I need milk",
    "What time am I leaving?",
    "I feel dizzy",
    "My TV isn't working",
  ];

  if (context.nextAppointment?.title) {
    return [
      "What time am I leaving?",
      "What should I bring?",
      ...suggestions.filter((suggestion) => suggestion !== "What time am I leaving?"),
    ].slice(0, 4);
  }

  return suggestions;
}

export function interpretReceiverAskRequest(requestText, context = {}) {
  // TODO: replace local classifier with POST /api/connect/receiver/ask/interpret.
  // TODO: retrieve the active Connect Admin prompt for CONNECT_ASK_INTERPRETER_PROMPT_KEY.
  const rawText = clean(requestText);
  const lower = rawText.toLowerCase();
  const selectedContact = context.selectedContact?.displayName || "Andrew";
  const adminContact = context.adminContact?.displayName || selectedContact || "Andrew";
  const appointment = context.nextAppointment || {};

  if (!rawText) {
    return interpretation({
      rawText,
      intent: "unknown",
      confidence: "low",
      receiverMessage: "Type what you need, then I can help.",
      proposedAction: { type: "none" },
      buttons: [
        { label: "Edit", action: "edit" },
        { label: "Go Back", action: "cancel" },
      ],
    });
  }

  if (containsAny(lower, ["appointment", "doctor", "cardiology", "leaving", "leave", "bring", "where"])) {
    const appointmentSummary = summarizeAppointment(appointment);
    const appointmentAnswer = appointmentAnswerFor(lower, appointment, adminContact);
    return interpretation({
      rawText,
      intent: "appointment_question",
      confidence: "high",
      answerType: appointmentAnswer.answerType,
      receiverMessage: appointmentAnswer.message,
      proposedAction: appointmentSummary
        ? {
            type: "show_appointment_context",
            appointmentId: appointment.id || "",
            body: rawText,
            recipientName: adminContact,
          }
        : { type: "send_message", recipientRole: "coordinator", recipientName: adminContact, body: rawText },
      buttons: appointmentAnswer.buttons,
      futureCandidates: ["appointment", "message"],
    });
  }

  if (containsAny(lower, ["dizzy", "not feeling well", "hurt", "fell", "pain", "sick", "weak", "confused"])) {
    return interpretation({
      rawText,
      intent: "concern_or_symptom",
      confidence: "high",
      receiverMessage: `This may be important. Would you like me to tell ${adminContact}?`,
      proposedAction: {
        type: "send_message",
        recipientRole: "coordinator",
        recipientName: adminContact,
        body: rawText,
        safetyConcern: true,
      },
      buttons: [
        { label: `Tell ${adminContact}`, action: "confirm_send" },
        { label: `Call ${adminContact}`, action: "call_contact" },
        { label: "Go Back", action: "cancel" },
      ],
      futureCandidates: ["concern", "callback_request"],
      safetyConcern: true,
    });
  }

  if (containsAny(lower, ["tell ", "message ", "send ", "ready", "call me", "call back"])) {
    return interpretation({
      rawText,
      intent: "message_to_caregiver",
      confidence: "medium",
      receiverMessage: `I can send this to ${selectedContact}:`,
      proposedAction: {
        type: "send_message",
        recipientRole: "selected_contact",
        recipientName: selectedContact,
        body: stripMessagePrefix(rawText),
      },
      buttons: confirmationButtons(selectedContact),
      futureCandidates: ["message"],
    });
  }

  if (containsAny(lower, ["tv", "remote", "sound", "volume", "phone", "internet", "wifi", "wi-fi", "not working"])) {
    return interpretation({
      rawText,
      intent: "device_help",
      confidence: "medium",
      receiverMessage: `I can send this to ${adminContact}:`,
      proposedAction: {
        type: "send_message",
        recipientRole: "coordinator",
        recipientName: adminContact,
        body: rawText,
      },
      buttons: confirmationButtons(adminContact),
      futureCandidates: ["household_request", "device_help"],
    });
  }

  if (containsAny(lower, ["what was happening", "what's happening", "this week", "happening this week", "remember what"])) {
    return interpretation({
      rawText,
      intent: "needs_clarification",
      confidence: "medium",
      answerType: "clarification",
      receiverMessage: "I'm not totally sure what you mean. Pick the one you prefer.",
      proposedAction: { type: "clarify" },
      buttons: [
        { label: "Show what's happening this week", action: "show_week" },
        { label: `Send a message to ${adminContact}`, action: "confirm_send" },
        { label: `Call ${adminContact}`, action: "call_contact" },
      ],
      futureCandidates: ["appointments", "message", "call"],
    });
  }

  if (containsAny(lower, ["milk", "grocery", "groceries", "store", "pharmacy", "food", "trash", "paperwork"])) {
    return interpretation({
      rawText,
      intent: "household_request",
      confidence: "high",
      receiverMessage: `I can send this to ${adminContact}:`,
      proposedAction: {
        type: "send_message",
        recipientRole: "coordinator",
        recipientName: adminContact,
        body: rawText,
      },
      buttons: confirmationButtons(adminContact),
      futureCandidates: ["errand", "household_request"],
    });
  }

  return interpretation({
    rawText,
    intent: "unknown",
    confidence: "low",
    answerType: "low_confidence",
    receiverMessage: "I didn't quite understand. What would you like to do?",
    proposedAction: {
      type: "needs_user_input",
      recipientRole: "coordinator",
      recipientName: adminContact,
      body: `${context.careVipName || "Mom"} asked:\n"${rawText}"\n\nAsk could not determine an answer.`,
    },
    buttons: [
      { label: "I'll try saying it differently", action: "edit" },
      { label: `Send this to ${adminContact}`, action: "confirm_send" },
    ],
    futureCandidates: ["message", "call", "clarification"],
  });
}

export function createReceiverAskMessage(interpretationResult, context = {}) {
  // TODO: persist via POST /api/connect/receiver/messages and keep browser state as a cache.
  const action = interpretationResult.proposedAction || {};
  const recipientName = action.recipientName || context.selectedContact?.displayName || "Andrew";
  const body = action.body || interpretationResult.rawText || "";
  return {
    id: `message-ask-${Date.now()}`,
    from: "receiver_user",
    to: recipientName,
    receiverId: context.receiver?.id || "living-room-receiver",
    messageType: "text",
    body,
    transcript: "",
    transcriptStatus: "not_requested",
    audioUrl: "",
    audioDurationMs: 0,
    heardAt: "",
    createdAt: new Date().toISOString(),
    source: "receiver_ask",
    interpretation: {
      intent: interpretationResult.intent,
      confidence: interpretationResult.confidence,
      futureCandidates: interpretationResult.futureCandidates || [],
      safetyConcern: Boolean(interpretationResult.safetyConcern || action.safetyConcern),
      receiverMessage: interpretationResult.receiverMessage,
    },
  };
}

export function createAskRecovery(recoveryInput, context = {}) {
  // TODO: replace local recovery capture with POST /api/connect/receiver/ask-recoveries.
  const now = new Date().toISOString();
  const result = recoveryInput.interpretationResult || {};
  const action = result.proposedAction || {};
  return {
    id: `ask-recovery-${Date.now()}`,
    careCircleId: context.careCircleId || "care-circle-local",
    receiverDeviceId: context.receiver?.id || "living-room-receiver",
    receiverHouseholdId: context.receiverHouseholdId || "household-local",
    receiverPersonId: context.receiverPersonId || "receiver-person-mom",
    coordinatorUserId: context.adminContact?.id || "contact-andrew",
    originalQuestion: result.rawText || "",
    interpreterIntent: result.intent || "unknown",
    answerShown: result.receiverMessage || "",
    selectedActionBeforeFeedback: recoveryInput.selectedActionBeforeFeedback || "not_helpful",
    feedbackType: "not_helpful",
    clarificationText: clean(recoveryInput.clarificationText),
    clarificationAudioUrl: recoveryInput.clarificationAudioUrl || null,
    clarificationAudioArtifactId: recoveryInput.clarificationAudioArtifactId || null,
    clarificationAudioCaptureId: recoveryInput.clarificationAudioCaptureId || null,
    transcriptText: recoveryInput.transcriptText || null,
    createdAt: now,
    status: "sent_to_coordinator",
    source: "receiver_ask_recovery",
  };
}

export function createAskRecoveryCoordinatorMessage(recovery, context = {}) {
  // TODO: surface this in Connect Admin/Coordinator message center, not only local receiver state.
  const coordinatorName = context.adminContact?.displayName || "Andrew";
  const careVipName = context.careVipName || "Mom";
  return {
    id: `message-ask-recovery-${Date.now()}`,
    from: "receiver_user",
    to: coordinatorName,
    receiverId: recovery.receiverDeviceId,
    messageType: recovery.clarificationAudioUrl ? "audio" : "text",
    body: recovery.clarificationText || "Audio clarification recorded.",
    transcript: recovery.transcriptText || recovery.clarificationText || "",
    transcriptStatus: recovery.transcriptText || recovery.clarificationText ? "completed" : "not_requested",
    audioUrl: recovery.clarificationAudioUrl || "",
    audioDurationMs: 0,
    heardAt: "",
    createdAt: recovery.createdAt,
    source: "receiver_ask_recovery",
    recovery,
    adminSummary: [
      `${careVipName} said the answer was not helpful.`,
      "",
      `Original question: ${recovery.originalQuestion}`,
      `Answer shown: ${recovery.answerShown}`,
      `Clarified: ${recovery.clarificationText || "Audio clarification recorded."}`,
      `Intent: ${recovery.interpreterIntent}`,
    ].join("\n"),
  };
}

function interpretation(value) {
  return {
    rawText: value.rawText || "",
    normalizedText: normalize(value.rawText || ""),
    intent: value.intent || "unknown",
    answerType: value.answerType || value.intent || "unknown",
    confidence: value.confidence || "low",
    suggestedRoute: value.proposedAction?.type || "none",
    receiverMessage: value.receiverMessage || "",
    proposedAction: value.proposedAction || { type: "none" },
    buttons: value.buttons || [],
    futureCandidates: value.futureCandidates || [],
    requiresClarification: false,
    clarifyingQuestion: null,
    safetyConcern: Boolean(value.safetyConcern),
    summaryForCaregiver: value.rawText ? `Receiver user asked: ${value.rawText}` : "",
  };
}

function appointmentAnswerFor(lowerText, appointment, adminContact) {
  const appointmentSummary = summarizeAppointment(appointment);
  const hasAppointment = Boolean(appointmentSummary);

  if (containsAny(lowerText, ["bring", "take", "need for", "need to bring"])) {
    return {
      answerType: "appointment_bring_list",
      message: hasAppointment
        ? "For this appointment, bring prior blood pressure readings, dizziness history, cholesterol discussion notes, and medication timing questions."
        : `I can ask ${adminContact} what you should bring.`,
      buttons: [
        { label: "That answered my question", action: "done" },
        { label: "This wasn't helpful", action: "not_helpful" },
        { label: `Ask ${adminContact}`, action: "confirm_send" },
      ],
    };
  }

  if (containsAny(lowerText, ["where", "address", "place", "location"])) {
    return {
      answerType: "appointment_location",
      message: hasAppointment
        ? `I found ${appointmentSummary}. I do not have a saved address for this appointment yet.`
        : `I can ask ${adminContact} where the appointment is.`,
      buttons: [
        { label: "That answered my question", action: "done" },
        { label: "Wrong place", action: "context_not_quite_right" },
        { label: "This wasn't helpful", action: "not_helpful" },
        { label: `Ask ${adminContact}`, action: "confirm_send" },
      ],
    };
  }

  if (containsAny(lowerText, ["leaving", "leave", "time", "when"])) {
    return {
      answerType: "appointment_time",
      message: hasAppointment
        ? `Your next appointment is ${appointmentSummary}. I do not have a pickup time saved yet.`
        : `I can ask ${adminContact} what time you are leaving.`,
      buttons: [
        { label: "That answered my question", action: "done" },
        { label: "Wrong time", action: "context_not_quite_right" },
        { label: "This wasn't helpful", action: "not_helpful" },
        { label: `Ask ${adminContact}`, action: "confirm_send" },
      ],
    };
  }

  return {
    answerType: "appointment_summary",
    message: hasAppointment
      ? `Your next appointment is ${appointmentSummary}.`
      : `I can ask ${adminContact} about your appointment.`,
    buttons: hasAppointment
      ? [
          { label: "That answered my question", action: "done" },
          { label: "I meant a different appointment", action: "choose_appointment" },
          { label: "This wasn't helpful", action: "not_helpful" },
          { label: `Ask ${adminContact}`, action: "confirm_send" },
        ]
      : confirmationButtons(adminContact),
  };
}

function confirmationButtons(recipientName) {
  return [
    { label: `Send to ${recipientName}`, action: "confirm_send" },
    { label: "Edit", action: "edit" },
    { label: "Go Back", action: "cancel" },
  ];
}

function summarizeAppointment(appointment) {
  if (!appointment?.title) return "";
  return [
    appointment.title,
    appointment.dayLabel,
    appointment.timeLabel,
  ].filter(Boolean).join(" • ");
}

function stripMessagePrefix(text) {
  return clean(text)
    .replace(/^tell\s+[a-z]+\s+/i, "")
    .replace(/^message\s+[a-z]+\s+/i, "")
    .replace(/^send\s+[a-z]+\s+/i, "");
}

function containsAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function normalize(text) {
  const value = clean(text);
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}
