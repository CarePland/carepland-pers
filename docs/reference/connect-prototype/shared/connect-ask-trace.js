export const ConnectAskEventType = Object.freeze({
  AUDIO_CAPTURED: "audio_captured",
  AUDIO_TRANSCRIBED: "audio_transcribed",
  INPUT_CAPTURED: "input_captured",
  INTERPRETATION_RETURNED: "interpretation_returned",
  ANSWER_SHOWN: "answer_shown",
  BUTTON_SELECTED: "button_selected",
  FOLLOWUP_INPUT_CAPTURED: "followup_input_captured",
  MESSAGE_ESCALATED: "message_escalated",
  CALL_ESCALATED: "call_escalated",
  RECOVERY_STARTED: "recovery_started",
  RECOVERY_SENT: "recovery_sent",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
});

export const ConnectAskOutcome = Object.freeze({
  IN_PROGRESS: "in_progress",
  ANSWERED: "answered",
  ESCALATED: "escalated",
  RECOVERY_SENT: "recovery_sent",
  ABANDONED: "abandoned",
});

export function createConnectAskInteraction(input, context = {}) {
  // TODO: replace local trace creation with POST /api/connect/ask-interactions.
  const now = new Date().toISOString();
  return {
    id: `ask-interaction-${Date.now()}`,
    careCircleId: context.careCircleId || "care-circle-local",
    receiverDeviceId: context.receiver?.id || "living-room-receiver",
    receiverHouseholdId: context.receiverHouseholdId || "household-local",
    receiverPersonId: context.receiverPersonId || "receiver-person-mom",
    coordinatorUserId: context.adminContact?.id || "contact-andrew",
    receiverUserDisplayName: context.careVipName || "Mom",
    originalInput: clean(input.text),
    inputMethod: input.method || "typed",
    selectedSuggestion: input.selectedSuggestion || null,
    surface: context.surface || "web_receiver",
    interpreterVersion: context.interpreterVersion || "local-web-v1",
    promptKey: context.promptKey || "connect_ask_interpreter",
    promptVersion: context.promptVersion || "local",
    outcome: ConnectAskOutcome.IN_PROGRESS,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    events: [],
  };
}

export function createConnectAskEvent(type, payload = {}) {
  return {
    id: `ask-event-${Date.now()}-${Math.round(Math.random() * 100000)}`,
    type,
    createdAt: new Date().toISOString(),
    payload,
  };
}

export function appendConnectAskEvent(interaction, type, payload = {}) {
  // TODO: replace local append with POST /api/connect/ask-interactions/:id/events.
  if (!interaction) return null;
  const event = createConnectAskEvent(type, payload);
  interaction.events.push(event);
  interaction.updatedAt = event.createdAt;
  return event;
}

export function completeConnectAskInteraction(interaction, outcome) {
  // TODO: replace local completion with PATCH /api/connect/ask-interactions/:id.
  if (!interaction) return null;
  const now = new Date().toISOString();
  interaction.outcome = outcome;
  interaction.updatedAt = now;
  interaction.completedAt = now;
  return interaction;
}

function clean(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}
