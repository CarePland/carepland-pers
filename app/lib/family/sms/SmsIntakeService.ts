import { createFamilyEvent, newId } from "../audit/FamilyEventService";
import { createConcernCandidate } from "../concerns/ConcernService";
import {
  assignErrandToMember,
  completeErrand,
  findErrand,
  markErrandUnableToComplete,
  memberCanUpdateErrand,
} from "../errands/ErrandWorkflowService";
import type { FamilyMember } from "../types";
import { normalizePhoneNumber, normalizeSmsMessage } from "./CommandParser";
import {
  buildHelpReply,
  buildListReply,
  buildStatusReply,
  createOutboundPrompt,
} from "./SmsReplyBuilder";
import type {
  SmsInboundRequest,
  SmsIntakeResult,
  SmsInterpretedIntent,
  SmsMessage,
  SmsPromptContext,
  SmsPromptOptionAction,
  SmsRuleDecision,
  SmsWorkflowState,
} from "./types";

export function processInboundSms(
  currentState: SmsWorkflowState,
  inbound: SmsInboundRequest,
): SmsIntakeResult {
  const nowIso = new Date().toISOString();
  const normalized = normalizeSmsMessage(inbound.body);
  const fromPhone = normalizePhoneNumber(inbound.fromPhone);
  const toPhone = normalizePhoneNumber(inbound.toPhone);
  const sender = currentState.members.find(
    (member) => member.phoneNumber && normalizePhoneNumber(member.phoneNumber) === fromPhone,
  );
  const inboundMessage = createSmsMessage({
    body: inbound.body,
    direction: "inbound",
    fromPhone,
    toPhone,
    householdId: currentState.householdId,
    memberId: sender?.id,
    provider: inbound.transport,
    providerMessageId: inbound.providerMessageId,
    createdAt: nowIso,
  });
  let state: SmsWorkflowState = {
    ...currentState,
    messages: [inboundMessage, ...currentState.messages],
    auditEvents: [
      createFamilyEvent({
        type: "sms.received",
        actorName: sender?.displayName ?? "Unknown sender",
        detail: inbound.body,
        householdId: currentState.householdId,
        memberId: sender?.id,
        nowIso,
      }),
      ...currentState.auditEvents,
    ],
  };

  if (!sender) {
    const finalIntent = makeIntent(
      "unknown_sender",
      1,
      "Phone number does not match a Care Family member.",
    );
    const ruleDecision = makeRule(
      "reply_unknown_sender",
      true,
      "Unknown senders may not process workflow commands.",
    );
    const replyBody =
      "CarePland doesn't recognize this phone number yet. Please contact the Coordinator if you believe this is a mistake.";
    state = appendOutboundReply(state, inbound, replyBody, nowIso, undefined);

    return makeResult(state, replyBody, normalized, finalIntent, ruleDecision);
  }

  const activePrompt = findActivePrompt(state.promptContexts, sender.id, nowIso);
  const promptOption = activePrompt?.expectedOptions.find(
    (option) => option.token === normalized.token,
  );
  const aiInvoked = normalized.token === "freeform" && !activePrompt;
  const finalIntent = interpretMessage({
    activePrompt,
    promptAction: promptOption?.action,
    normalizedToken: normalized.token,
    rawBody: inbound.body,
  });
  const ruleDecision = decideAction(finalIntent, sender, state, activePrompt);
  const execution = executeDecision({
    state,
    inbound,
    sender,
    activePrompt,
    decision: ruleDecision,
    intent: finalIntent,
    nowIso,
  });

  return {
    state: execution.state,
    replyBody: execution.replyBody,
    trace: {
      normalized,
      deterministicMatch: promptOption
        ? `active_prompt:${promptOption.action}`
        : normalized.deterministicMatch,
      aiInvoked,
      aiOutput: aiInvoked ? finalIntent : undefined,
      finalIntent,
      ruleDecision,
    },
    sender,
    activePrompt,
  };
}

export { createOutboundPrompt };

function interpretMessage(input: {
  activePrompt?: SmsPromptContext;
  promptAction?: SmsPromptOptionAction;
  normalizedToken: string;
  rawBody: string;
}): SmsInterpretedIntent {
  if (input.promptAction) {
    return makeIntent(
      input.promptAction,
      1,
      "Reply matched an active SMS prompt option.",
      input.activePrompt?.relatedObjectType,
      input.activePrompt?.relatedObjectId,
    );
  }

  if (input.normalizedToken === "stop_command") {
    return makeIntent("opt_out", 1, "Sender used an opt-out command.");
  }

  if (input.normalizedToken === "help_command") {
    return makeIntent("help", 1, "Sender requested help.");
  }

  if (input.normalizedToken === "list_command") {
    return makeIntent("list", 1, "Sender requested open Errands.");
  }

  if (input.normalizedToken === "status_command") {
    return makeIntent("status", 1, "Sender requested status.");
  }

  if (input.normalizedToken === "completion_candidate") {
    return makeIntent("complete_errand", 0.72, "Completion language without an active prompt.");
  }

  if (input.normalizedToken === "unable_candidate") {
    return makeIntent("unable_to_complete", 0.72, "Unable-to-complete language without an active prompt.");
  }

  return makeIntent(
    "capture_concern",
    0.68,
    "Freeform message preserved as a Concern candidate for Coordinator review.",
    "concern",
    undefined,
    true,
  );
}

function decideAction(
  intent: SmsInterpretedIntent,
  sender: FamilyMember,
  state: SmsWorkflowState,
  activePrompt?: SmsPromptContext,
): SmsRuleDecision {
  if (intent.intent === "opt_out") {
    return makeRule("acknowledge_opt_out", true, "Opt-out commands receive a calm acknowledgement.");
  }

  if (intent.intent === "help") {
    return makeRule("reply_help", true, "Help is always available.");
  }

  if (intent.intent === "list") {
    return makeRule("reply_list", true, "Known members can list open Errands.");
  }

  if (intent.intent === "status") {
    return makeRule("reply_status", true, "Known members can request current status.");
  }

  if (!activePrompt && intent.intent !== "capture_concern") {
    return makeRule(
      "ask_clarifying_question",
      true,
      "Workflow-changing replies need an active prompt or a clearer Errand reference.",
    );
  }

  if (activePrompt?.relatedObjectType === "errand") {
    const errand = findErrand(state.errands, activePrompt.relatedObjectId);

    if (!errand) {
      return makeRule("ask_clarifying_question", true, "The referenced Errand was not found.");
    }

    if (!memberCanUpdateErrand(errand, sender)) {
      return makeRule(
        "ask_clarifying_question",
        true,
        "This member is not allowed to update the referenced Errand.",
      );
    }

    if (intent.intent === "accept_errand") {
      return makeRule("assign_errand", true, "Available Errand can be accepted by this member.");
    }

    if (intent.intent === "decline_errand") {
      return makeRule("decline_errand", true, "Decline leaves the Errand available.");
    }

    if (intent.intent === "ask_question") {
      return makeRule("open_question", true, "Questions should be routed to the Coordinator.");
    }

    if (intent.intent === "complete_errand") {
      return makeRule("complete_errand", true, "Assigned member can mark the Errand complete.");
    }

    if (intent.intent === "not_yet") {
      return makeRule("ask_not_yet_followup", true, "Not-yet replies keep ownership and ask when to check back.");
    }

    if (intent.intent === "unable_to_complete") {
      return makeRule("mark_unable_to_complete", true, "Assigned member can mark unable to complete.");
    }

    if (
      intent.intent === "check_later_today" ||
      intent.intent === "check_tomorrow" ||
      intent.intent === "self_report"
    ) {
      return makeRule("schedule_followup", true, "Follow-up preference can be stored without changing ownership.");
    }
  }

  return makeRule(
    "capture_concern",
    true,
    "Unprompted freeform messages become Concern candidates for human review.",
  );
}

function executeDecision(input: {
  state: SmsWorkflowState;
  inbound: SmsInboundRequest;
  sender: FamilyMember;
  activePrompt?: SmsPromptContext;
  decision: SmsRuleDecision;
  intent: SmsInterpretedIntent;
  nowIso: string;
}) {
  const { sender, decision, activePrompt, nowIso } = input;
  let state = input.state;
  let replyBody = "I am not quite sure what you mean. Could you reply with help, list, or status?";

  if (decision.action === "reply_help") {
    replyBody = buildHelpReply();
  }

  if (decision.action === "reply_list") {
    replyBody = buildListReply(state.errands, sender);
  }

  if (decision.action === "reply_status") {
    replyBody = buildStatusReply(state.errands, sender);
  }

  if (decision.action === "acknowledge_opt_out") {
    replyBody = "Understood. Please contact the Coordinator if you need CarePland SMS restarted.";
  }

  if (decision.action === "assign_errand" && activePrompt) {
    const workflow = assignErrandToMember(state.errands, activePrompt.relatedObjectId, sender);
    state = appendAudit(state, "errand.accepted", sender, workflow.detail, activePrompt, nowIso, workflow.errands);
    replyBody = "Thanks. I have marked this Errand as assigned to you.";
  }

  if (decision.action === "decline_errand" && activePrompt) {
    state = appendAudit(
      state,
      "errand.declined",
      sender,
      `${sender.displayName} declined this Errand offer`,
      activePrompt,
      nowIso,
    );
    replyBody = "No problem. I will leave this Errand available for the Care Family.";
  }

  if (decision.action === "open_question" && activePrompt) {
    state = appendAudit(
      state,
      "errand.question",
      sender,
      `${sender.displayName} has a question about this Errand`,
      activePrompt,
      nowIso,
    );
    replyBody = "Thanks. I will flag this for the Coordinator.";
  }

  if (decision.action === "complete_errand" && activePrompt) {
    const workflow = completeErrand(state.errands, activePrompt.relatedObjectId, sender);
    state = appendAudit(state, "errand.completed", sender, workflow.detail, activePrompt, nowIso, workflow.errands);
    replyBody = "Thank you. I marked the Errand complete.";
  }

  if (decision.action === "ask_not_yet_followup" && activePrompt) {
    state = appendAudit(
      state,
      "errand.not_yet",
      sender,
      `${sender.displayName} has not completed this yet`,
      activePrompt,
      nowIso,
    );
    state = createOutboundPrompt(state, {
      promptType: "errand_not_yet_followup",
      errandId: activePrompt.relatedObjectId,
      memberId: sender.id,
      transport: input.inbound.transport,
      nowIso,
    });
    replyBody =
      state.messages.find((message) => message.id === state.promptContexts[0]?.lastOutboundMessageId)?.body ??
      "No problem. When should I check back?";
  }

  if (decision.action === "schedule_followup" && activePrompt) {
    state = appendAudit(
      state,
      "errand.followup_scheduled",
      sender,
      `${sender.displayName} chose ${input.intent.intent.replace(/_/g, " ")}`,
      activePrompt,
      nowIso,
    );
    replyBody = "Got it. I will keep this Errand assigned to you.";
  }

  if (decision.action === "mark_unable_to_complete" && activePrompt) {
    const workflow = markErrandUnableToComplete(state.errands, activePrompt.relatedObjectId, sender);
    state = appendAudit(
      state,
      "errand.unable_to_complete",
      sender,
      workflow.detail,
      activePrompt,
      nowIso,
      workflow.errands,
    );
    replyBody = "No problem. I marked this as needing attention so the Coordinator can reassign it.";
  }

  if (decision.action === "capture_concern") {
    const concern = createConcernCandidate({
      householdId: state.householdId,
      member: sender,
      body: input.inbound.body,
      nowIso,
    });
    state = {
      ...state,
      concerns: [concern, ...state.concerns],
      auditEvents: [
        createFamilyEvent({
          type: "concern.created",
          actorName: sender.displayName,
          detail: `New Concern from ${sender.displayName}: "${input.inbound.body}"`,
          householdId: state.householdId,
          memberId: sender.id,
          relatedObjectType: "concern",
          relatedObjectId: concern.id,
          nowIso,
        }),
        ...state.auditEvents,
      ],
    };
    replyBody = "Thanks. I saved this for Coordinator review.";
  }

  if (activePrompt && decision.action !== "ask_not_yet_followup") {
    state = resolvePrompt(state, activePrompt.id, nowIso);
  }

  state = appendOutboundReply(state, input.inbound, replyBody, nowIso, sender);

  return { state, replyBody };
}

function appendAudit(
  state: SmsWorkflowState,
  type: string,
  sender: FamilyMember,
  detail: string,
  activePrompt: SmsPromptContext,
  nowIso: string,
  errands = state.errands,
) {
  return {
    ...state,
    errands,
    auditEvents: [
      createFamilyEvent({
        type,
        actorName: sender.displayName,
        detail,
        householdId: state.householdId,
        memberId: sender.id,
        relatedObjectType: activePrompt.relatedObjectType,
        relatedObjectId: activePrompt.relatedObjectId,
        nowIso,
      }),
      ...state.auditEvents,
    ],
  };
}

function appendOutboundReply(
  state: SmsWorkflowState,
  inbound: SmsInboundRequest,
  replyBody: string,
  nowIso: string,
  sender?: FamilyMember,
) {
  const replyMessage = createSmsMessage({
    body: replyBody,
    direction: "outbound",
    fromPhone: normalizePhoneNumber(inbound.toPhone),
    toPhone: normalizePhoneNumber(inbound.fromPhone),
    householdId: state.householdId,
    memberId: sender?.id,
    provider: inbound.transport,
    createdAt: nowIso,
  });

  return {
    ...state,
    messages: [replyMessage, ...state.messages],
    auditEvents: [
      createFamilyEvent({
        type: "sms.sent",
        actorName: "CarePland",
        detail: replyBody,
        householdId: state.householdId,
        memberId: sender?.id,
        nowIso,
      }),
      ...state.auditEvents,
    ],
  };
}

function createSmsMessage(input: Omit<SmsMessage, "id">): SmsMessage {
  return {
    ...input,
    id: newId("sms"),
  };
}

function findActivePrompt(
  promptContexts: SmsPromptContext[],
  memberId: string,
  nowIso: string,
) {
  const now = new Date(nowIso).getTime();

  return promptContexts.find(
    (context) =>
      context.memberId === memberId &&
      !context.resolvedAt &&
      new Date(context.expiresAt).getTime() > now,
  );
}

function resolvePrompt(state: SmsWorkflowState, promptId: string, nowIso: string) {
  return {
    ...state,
    promptContexts: state.promptContexts.map((context) =>
      context.id === promptId ? { ...context, resolvedAt: nowIso } : context,
    ),
  };
}

function makeIntent(
  intent: SmsInterpretedIntent["intent"],
  confidence: number,
  reason: string,
  relatedObjectType?: SmsInterpretedIntent["relatedObjectType"],
  relatedObjectId?: string,
  needsHumanReview?: boolean,
): SmsInterpretedIntent {
  return {
    intent,
    confidence,
    reason,
    relatedObjectType,
    relatedObjectId,
    needsHumanReview,
  };
}

function makeRule(
  action: SmsRuleDecision["action"],
  allowed: boolean,
  reason: string,
): SmsRuleDecision {
  return { action, allowed, reason };
}

function makeResult(
  state: SmsWorkflowState,
  replyBody: string,
  normalized: SmsIntakeResult["trace"]["normalized"],
  finalIntent: SmsInterpretedIntent,
  ruleDecision: SmsRuleDecision,
): SmsIntakeResult {
  return {
    state,
    replyBody,
    trace: {
      normalized,
      deterministicMatch: normalized.deterministicMatch,
      aiInvoked: false,
      finalIntent,
      ruleDecision,
    },
  };
}
