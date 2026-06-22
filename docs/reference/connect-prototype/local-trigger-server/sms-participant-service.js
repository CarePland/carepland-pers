const careCircleService = require("./care-circle-service");

const SmsParticipantMessageStatus = Object.freeze({
  PENDING_CONFIRMATION: "pending_confirmation",
  SENT: "sent",
  CANCELED: "canceled",
  NEEDS_RECIPIENT: "needs_recipient",
  REJECTED: "rejected",
});

const pendingConfirmations = new Map();
const smsParticipantMessages = [];

function normalizeSmsText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeChoice(value) {
  return normalizeSmsText(value).toLowerCase();
}

function inboundSms(fromPhone, body) {
  const normalizedPhone = careCircleService.normalizePhoneNumber(fromPhone);
  const text = normalizeSmsText(body);
  const participant = careCircleService.findMemberByPhone(normalizedPhone);

  if (
    !participant ||
    participant.role === careCircleService.MemberRole.RECEIVER_PERSON ||
    participant.role === careCircleService.MemberRole.RECEIVER_USER
  ) {
    return {
      ok: true,
      action: "unmatched_phone",
      reply: "This phone number is not currently connected to a CarePland Connect care circle.",
    };
  }

  const existing = pendingConfirmations.get(normalizedPhone);
  const choice = normalizeChoice(text);
  if (existing?.status === SmsParticipantMessageStatus.NEEDS_RECIPIENT && ["1", "2"].includes(choice)) {
    return chooseRecipientForPendingMessage(normalizedPhone, choice);
  }
  if (existing && ["yes", "y", "1", "send"].includes(choice)) {
    return confirmPendingMessage(normalizedPhone, true);
  }
  if (existing && ["no", "n", "2", "cancel"].includes(choice)) {
    return confirmPendingMessage(normalizedPhone, false);
  }

  const routed = routeParticipantSms(participant, text);
  if (!routed.ok) return routed;
  if (routed.action === "rejected" || routed.action === "empty_message") {
    return routed;
  }
  if (routed.action === "needs_recipient" && routed.message) {
    pendingConfirmations.set(normalizedPhone, routed.message);
    return routed;
  }

  pendingConfirmations.set(normalizedPhone, routed.message);
  return {
    ok: true,
    action: "pending_confirmation",
    message: routed.message,
    reply: confirmationPrompt(routed.message),
  };
}

function chooseRecipientForPendingMessage(normalizedPhone, choice) {
  const message = pendingConfirmations.get(normalizedPhone);
  if (!message || message.status !== SmsParticipantMessageStatus.NEEDS_RECIPIENT) {
    return {
      ok: true,
      action: "no_pending_recipient_choice",
      reply: "There is no CarePland recipient choice pending.",
    };
  }

  const participant = careCircleService.findMember(message.fromParticipantId);
  const receiver = careCircleService.findMember("member-mom");
  const coordinator = careCircleService.findMember("member-andrew");
  const target = choice === "1" ? receiver : coordinator;
  const canSendToTarget = choice === "1"
    ? careCircleService.canMemberMessageReceiver(participant)
    : careCircleService.canMemberContactTarget(participant, target);
  if (!canSendToTarget) {
    pendingConfirmations.delete(normalizedPhone);
    message.status = SmsParticipantMessageStatus.REJECTED;
    message.updatedAt = new Date().toISOString();
    smsParticipantMessages.push({ ...message });
    return {
      ok: true,
      action: "rejected",
      message,
      reply: `CarePland cannot send that message to ${target.displayName} from this phone number.`,
    };
  }

  message.toType = target.role;
  if (
    target.role === careCircleService.MemberRole.RECEIVER_USER ||
    target.role === careCircleService.MemberRole.RECEIVER_PERSON
  ) {
    message.toType = "receiver_user";
  } else if (
    target.role === careCircleService.MemberRole.COORDINATOR ||
    careCircleService.hasAdminAccess(target)
  ) {
    message.toType = "coordinator";
  }
  message.toId = target.id;
  message.toDisplayName = target.displayName;
  message.status = SmsParticipantMessageStatus.PENDING_CONFIRMATION;
  message.updatedAt = new Date().toISOString();
  pendingConfirmations.set(normalizedPhone, message);
  return {
    ok: true,
    action: "pending_confirmation",
    message,
    reply: confirmationPrompt(message),
  };
}

function confirmPendingMessage(normalizedPhone, shouldSend) {
  const message = pendingConfirmations.get(normalizedPhone);
  if (!message) {
    return {
      ok: true,
      action: "no_pending_confirmation",
      reply: "There is no pending CarePland message to confirm.",
    };
  }

  pendingConfirmations.delete(normalizedPhone);
  if (!shouldSend) {
    message.status = SmsParticipantMessageStatus.CANCELED;
    message.updatedAt = new Date().toISOString();
    smsParticipantMessages.push({ ...message });
    return {
      ok: true,
      action: "canceled",
      message,
      reply: "Canceled. Your CarePland message was not sent.",
    };
  }

  message.status = SmsParticipantMessageStatus.SENT;
  message.sentAt = new Date().toISOString();
  message.updatedAt = message.sentAt;
  smsParticipantMessages.push({ ...message });
  return {
    ok: true,
    action: "sent",
    message,
    reply: `Your message was sent to ${message.toDisplayName}.`,
  };
}

function routeParticipantSms(participant, text) {
  if (!text) {
    return {
      ok: true,
      action: "empty_message",
      reply: "Please send the message you want CarePland to deliver.",
    };
  }

  const receiver = careCircleService.findMember("member-mom");
  const coordinator = careCircleService.findMember("member-andrew");
  const parsed = parseSimpleRouting(text, receiver.displayName, coordinator.displayName);

  if (!parsed.toType) {
    const message = createSmsParticipantMessage(participant, "", text, "", "", SmsParticipantMessageStatus.NEEDS_RECIPIENT);
    return {
      ok: true,
      action: "needs_recipient",
      reply: `Who should receive this?\n1. ${receiver.displayName}\n2. ${coordinator.displayName}\nReply 1 or 2.`,
      message,
    };
  }

  const target = parsed.toType === "receiver_user" ? receiver : coordinator;
  const canSendToTarget = parsed.toType === "receiver_user"
    ? careCircleService.canMemberMessageReceiver(participant)
    : careCircleService.canMemberContactTarget(participant, target);
  if (!canSendToTarget) {
    return {
      ok: true,
      action: "rejected",
      reply: `CarePland cannot send that message to ${target.displayName} from this phone number.`,
    };
  }

  return {
    ok: true,
    message: createSmsParticipantMessage(
      participant,
      parsed.toType,
      parsed.body,
      target.id,
      target.displayName,
      SmsParticipantMessageStatus.PENDING_CONFIRMATION
    ),
  };
}

function parseSimpleRouting(text, receiverName, coordinatorName) {
  const lower = text.toLowerCase();
  const receiverNames = ["mom", "elizabeth", receiverName.toLowerCase()];
  const coordinatorNames = ["andrew", coordinatorName.toLowerCase()];

  const receiverMatch = receiverNames.find(name => lower.startsWith(`tell ${name} `) || lower.startsWith(`text ${name} `));
  if (receiverMatch) {
    return { toType: "receiver_user", body: stripRecipientPrefix(text, receiverMatch) };
  }

  const coordinatorMatch = coordinatorNames.find(name => lower.startsWith(`tell ${name} `) || lower.startsWith(`text ${name} `));
  if (coordinatorMatch) {
    return { toType: "coordinator", body: stripRecipientPrefix(text, coordinatorMatch) };
  }

  if (lower.includes("andrew")) {
    return { toType: "coordinator", body: text };
  }
  if (lower.includes("elizabeth") || lower.includes("mom")) {
    return { toType: "receiver_user", body: text };
  }

  return { toType: "", body: text };
}

function stripRecipientPrefix(text, recipientName) {
  const pattern = new RegExp(`^(tell|text)\\s+${escapeRegExp(recipientName)}\\s+`, "i");
  return normalizeSmsText(text.replace(pattern, ""));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createSmsParticipantMessage(participant, toType, body, toId, toDisplayName, status) {
  const timestamp = new Date().toISOString();
  return {
    id: `sms-participant-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    careCircleId: participant.careCircleId,
    fromParticipantId: participant.id,
    fromDisplayName: participant.displayName,
    fromPhone: careCircleService.normalizePhoneNumber(participant.phoneNumber),
    toType,
    toId,
    toDisplayName,
    body,
    source: "sms_participant",
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
    sentAt: "",
    heardAt: null,
    readAt: null,
  };
}

function confirmationPrompt(message) {
  return `Send this to ${message.toDisplayName}?\n\n"${message.body}"\n\nReply YES to send or NO to cancel.`;
}

function listSmsParticipantMessages() {
  return smsParticipantMessages.map(message => ({ ...message }));
}

function listPendingConfirmations() {
  return [...pendingConfirmations.values()].map(message => ({ ...message }));
}

module.exports = {
  SmsParticipantMessageStatus,
  inboundSms,
  listSmsParticipantMessages,
  listPendingConfirmations,
};
