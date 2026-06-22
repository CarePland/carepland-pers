import type { Errand, FamilyMember } from "../types";

export type SmsTransport = "twilio" | "virtual";
export type SmsDirection = "inbound" | "outbound";

export type SmsPromptType =
  | "errand_offer"
  | "errand_completion_check"
  | "errand_not_yet_followup";

export type SmsRelatedObjectType = "errand" | "concern" | "member" | "system";

export type NormalizedSmsToken =
  | "option_1"
  | "option_2"
  | "option_3"
  | "affirmative"
  | "negative"
  | "help_command"
  | "list_command"
  | "status_command"
  | "completion_candidate"
  | "unable_candidate"
  | "stop_command"
  | "freeform";

export type SmsMessage = {
  id: string;
  direction: SmsDirection;
  fromPhone: string;
  toPhone: string;
  body: string;
  provider: SmsTransport;
  providerMessageId?: string;
  householdId: string;
  memberId?: string;
  relatedObjectType?: SmsRelatedObjectType;
  relatedObjectId?: string;
  createdAt: string;
};

export type SmsPromptOptionAction =
  | "accept_errand"
  | "decline_errand"
  | "ask_question"
  | "complete_errand"
  | "not_yet"
  | "unable_to_complete"
  | "check_later_today"
  | "check_tomorrow"
  | "self_report";

export type SmsPromptOption = {
  token: NormalizedSmsToken;
  label: string;
  action: SmsPromptOptionAction;
};

export type SmsPromptContext = {
  id: string;
  memberId: string;
  householdId: string;
  promptType: SmsPromptType;
  relatedObjectType: SmsRelatedObjectType;
  relatedObjectId: string;
  expectedOptions: SmsPromptOption[];
  lastOutboundMessageId: string;
  expiresAt: string;
  createdAt: string;
  resolvedAt?: string;
};

export type FamilyAuditEvent = {
  id: string;
  type: string;
  actorName: string;
  detail: string;
  householdId: string;
  memberId?: string;
  relatedObjectType?: SmsRelatedObjectType;
  relatedObjectId?: string;
  createdAt: string;
};

export type ConcernCandidate = {
  id: string;
  householdId: string;
  memberId: string;
  submittedByName: string;
  body: string;
  status: "needs_coordinator_review" | "reviewed";
  createdAt: string;
};

export type SmsNormalizedMessage = {
  rawInput: string;
  normalizedInput: string;
  token: NormalizedSmsToken;
  deterministicMatch?: string;
};

export type SmsInterpretedIntent = {
  intent:
    | SmsPromptOptionAction
    | "help"
    | "list"
    | "status"
    | "capture_concern"
    | "unknown_sender"
    | "opt_out"
    | "unknown";
  confidence: number;
  relatedObjectType?: SmsRelatedObjectType;
  relatedObjectId?: string;
  needsHumanReview?: boolean;
  reason: string;
};

export type SmsRuleDecision = {
  action:
    | "reply_unknown_sender"
    | "reply_help"
    | "reply_list"
    | "reply_status"
    | "assign_errand"
    | "decline_errand"
    | "open_question"
    | "complete_errand"
    | "ask_not_yet_followup"
    | "schedule_followup"
    | "mark_unable_to_complete"
    | "capture_concern"
    | "acknowledge_opt_out"
    | "ask_clarifying_question";
  allowed: boolean;
  reason: string;
};

export type SmsProcessingTrace = {
  normalized: SmsNormalizedMessage;
  deterministicMatch?: string;
  aiInvoked: boolean;
  aiOutput?: SmsInterpretedIntent;
  finalIntent: SmsInterpretedIntent;
  ruleDecision: SmsRuleDecision;
};

export type SmsWorkflowState = {
  householdId: string;
  coordinatorPhone: string;
  careVipName: string;
  members: FamilyMember[];
  errands: Errand[];
  messages: SmsMessage[];
  promptContexts: SmsPromptContext[];
  auditEvents: FamilyAuditEvent[];
  concerns: ConcernCandidate[];
};

export type SmsInboundRequest = {
  fromPhone: string;
  toPhone: string;
  body: string;
  providerMessageId?: string;
  transport: SmsTransport;
};

export type SmsIntakeResult = {
  state: SmsWorkflowState;
  replyBody: string;
  trace: SmsProcessingTrace;
  sender?: FamilyMember;
  activePrompt?: SmsPromptContext;
};
