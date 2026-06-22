import type { NormalizedSmsToken, SmsNormalizedMessage } from "./types";

const affirmativeWords = new Set(["yes", "y", "yeah", "yep", "sure", "ok", "okay"]);
const negativeWords = new Set(["no", "n", "nope"]);
const helpWords = new Set(["help", "?"]);
const listWords = new Set(["list", "errands", "tasks", "open"]);
const statusWords = new Set(["status", "update"]);
const completionWords = new Set([
  "done",
  "completed",
  "complete",
  "finished",
  "got it",
  "already done",
]);
const unableWords = new Set([
  "cant",
  "can't",
  "cannot",
  "unable",
  "i can't",
  "i cant",
  "can't do it",
  "cant do it",
]);
const stopWords = new Set(["stop", "unsubscribe", "cancel", "quit"]);

export function normalizePhoneNumber(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return phoneNumber.trim();
}

export function normalizeSmsMessage(rawInput: string): SmsNormalizedMessage {
  const normalizedInput = rawInput
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ");
  const compactInput = normalizedInput.replace(/[.,!]/g, "");
  const token = tokenForInput(compactInput);
  const deterministicMatch = token === "freeform" ? undefined : token;

  return {
    rawInput,
    normalizedInput: compactInput,
    token,
    deterministicMatch,
  };
}

function tokenForInput(input: string): NormalizedSmsToken {
  if (input === "1") {
    return "option_1";
  }

  if (input === "2") {
    return "option_2";
  }

  if (input === "3") {
    return "option_3";
  }

  if (stopWords.has(input)) {
    return "stop_command";
  }

  if (helpWords.has(input)) {
    return "help_command";
  }

  if (listWords.has(input)) {
    return "list_command";
  }

  if (statusWords.has(input)) {
    return "status_command";
  }

  if (affirmativeWords.has(input)) {
    return "affirmative";
  }

  if (negativeWords.has(input)) {
    return "negative";
  }

  if (completionWords.has(input)) {
    return "completion_candidate";
  }

  if (unableWords.has(input)) {
    return "unable_candidate";
  }

  return "freeform";
}
