import { newId } from "../audit/FamilyEventService";
import type { Errand, FamilyMember } from "../types";
import type {
  SmsMessage,
  SmsPromptContext,
  SmsPromptOption,
  SmsPromptType,
  SmsTransport,
  SmsWorkflowState,
} from "./types";

const promptOptionsByType: Record<SmsPromptType, SmsPromptOption[]> = {
  errand_offer: [
    { token: "option_1", label: "Yes, I can", action: "accept_errand" },
    { token: "option_2", label: "Not this time", action: "decline_errand" },
    { token: "option_3", label: "I have a question", action: "ask_question" },
  ],
  errand_completion_check: [
    { token: "option_1", label: "Yes", action: "complete_errand" },
    { token: "option_2", label: "Not yet, but I will", action: "not_yet" },
    { token: "option_3", label: "I can't do it", action: "unable_to_complete" },
  ],
  errand_not_yet_followup: [
    { token: "option_1", label: "Later today", action: "check_later_today" },
    { token: "option_2", label: "Tomorrow", action: "check_tomorrow" },
    { token: "option_3", label: "I'll tell you when it's done", action: "self_report" },
  ],
};

export function buildHelpReply() {
  return [
    "You can reply with numbers when CarePland gives options.",
    "",
    "Useful commands:",
    "list = show your open Errands",
    "status = show current Errands",
    "help = show this message",
  ].join("\n");
}

export function buildListReply(errands: Errand[], member: FamilyMember) {
  const openErrands = errands.filter(
    (errand) =>
      errand.status !== "completed" &&
      (!errand.assignedMemberName ||
        errand.assignedMemberName === member.displayName),
  );

  if (openErrands.length === 0) {
    return "You do not have any open Errands right now.";
  }

  return [
    "Your open Errands:",
    "",
    ...openErrands.map((errand, index) => `${index + 1}. ${errand.title}`),
    "",
    "Reply with the number to manage an Errand.",
  ].join("\n");
}

export function buildStatusReply(errands: Errand[], member: FamilyMember) {
  const relatedErrands = errands.filter(
    (errand) =>
      errand.status !== "completed" &&
      (!errand.assignedMemberName ||
        errand.assignedMemberName === member.displayName),
  );

  if (relatedErrands.length === 0) {
    return "No open Errands need your attention right now.";
  }

  return relatedErrands
    .map((errand) => {
      const owner =
        errand.status === "available"
          ? "Available"
          : `Assigned to ${errand.assignedMemberName ?? "Care Family"}`;
      return `${errand.title}: ${owner}`;
    })
    .join("\n");
}

export function buildErrandPromptBody(promptType: SmsPromptType, errand: Errand) {
  if (promptType === "errand_offer") {
    return [
      `Can you ${lowercaseFirst(errand.title)}${errand.dueLabel ? ` ${errand.dueLabel.toLowerCase()}` : ""}?`,
      "",
      "Reply:",
      "1 = Yes, I can",
      "2 = Not this time",
      "3 = I have a question",
    ].join("\n");
  }

  if (promptType === "errand_completion_check") {
    return [
      `Did you ${lowercaseFirst(errand.title)}?`,
      "",
      "Reply:",
      "1 = Yes",
      "2 = Not yet, but I will",
      "3 = I can't do it",
    ].join("\n");
  }

  return [
    "No problem. When should I check back?",
    "",
    "Reply:",
    "1 = Later today",
    "2 = Tomorrow",
    "3 = I'll tell you when it's done",
  ].join("\n");
}

export function createOutboundPrompt(
  state: SmsWorkflowState,
  input: {
    promptType: SmsPromptType;
    errandId: string;
    memberId: string;
    transport: SmsTransport;
    nowIso: string;
  },
) {
  const member = state.members.find((candidate) => candidate.id === input.memberId);
  const errand = state.errands.find((candidate) => candidate.id === input.errandId);

  if (!member?.phoneNumber || !errand) {
    return state;
  }

  const body = buildErrandPromptBody(input.promptType, errand);
  const message: SmsMessage = {
    id: newId("sms"),
    direction: "outbound",
    fromPhone: state.coordinatorPhone,
    toPhone: member.phoneNumber,
    body,
    provider: input.transport,
    householdId: state.householdId,
    memberId: member.id,
    relatedObjectType: "errand",
    relatedObjectId: errand.id,
    createdAt: input.nowIso,
  };
  const promptContext: SmsPromptContext = {
    id: newId("sms-prompt"),
    memberId: member.id,
    householdId: state.householdId,
    promptType: input.promptType,
    relatedObjectType: "errand",
    relatedObjectId: errand.id,
    expectedOptions: promptOptionsByType[input.promptType],
    lastOutboundMessageId: message.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    createdAt: input.nowIso,
  };

  return {
    ...state,
    messages: [message, ...state.messages],
    promptContexts: [
      promptContext,
      ...state.promptContexts.map((context) =>
        context.memberId === member.id && !context.resolvedAt
          ? { ...context, resolvedAt: input.nowIso }
          : context,
      ),
    ],
  };
}

function lowercaseFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
