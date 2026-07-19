export type SomethingWentWrongInteractionFamily =
  | "access_or_session_problem"
  | "how_to"
  | "navigation"
  | "technical_diagnostic"
  | "unexpected_behavior"
  | "unclear"
  | "workflow_request";

export type SomethingWentWrongDecisionTrace = {
  alternativesConsidered: string[];
  confidence: number;
  entryPoint: "something_went_wrong";
  interpretedQuestion: string;
  relevantContextUsed: string[];
  selectedInteractionFamily: SomethingWentWrongInteractionFamily;
  selectedWorkflow: string;
};

export type SomethingWentWrongOutcome =
  | {
      actionLabel?: string;
      actionUrl?: string;
      body: string;
      kind: "explain" | "navigate" | "troubleshooting";
      title: string;
    }
  | {
      body: string;
      kind: "diagnostic_report";
      title: string;
    }
  | {
      body: string;
      kind: "clarify";
      title: string;
    };

export type SomethingWentWrongInterpretation = {
  decisionTrace: SomethingWentWrongDecisionTrace;
  outcome: SomethingWentWrongOutcome;
};

type InterpretInput = {
  currentRoute?: string;
  hasFailedApiCalls?: boolean;
  hasFrontendErrors?: boolean;
  inputText: string;
  networkOnline?: boolean;
};

export function interpretSomethingWentWrong(
  input: InterpretInput
): SomethingWentWrongInterpretation {
  const text = normalizeText(input.inputText);
  const route = input.currentRoute || "";
  const context = [
    route ? `route:${route}` : "",
    input.networkOnline === false ? "network:offline" : "",
    input.hasFailedApiCalls ? "recent_failed_api" : "",
    input.hasFrontendErrors ? "recent_frontend_error" : "",
  ].filter(Boolean);

  const matched = classifyProblemText(text, input);
  const selectedWorkflow = workflowForFamily(matched.family, text, route);
  const interpretedQuestion = text || "The user opened Something Went Wrong without a description.";
  const outcome = outcomeForFamily(matched.family, text, selectedWorkflow, input);

  return {
    decisionTrace: {
      alternativesConsidered: matched.alternatives,
      confidence: matched.confidence,
      entryPoint: "something_went_wrong",
      interpretedQuestion,
      relevantContextUsed: context,
      selectedInteractionFamily: matched.family,
      selectedWorkflow,
    },
    outcome,
  };
}

function classifyProblemText(
  text: string,
  input: InterpretInput
): {
  alternatives: string[];
  confidence: number;
  family: SomethingWentWrongInteractionFamily;
} {
  if (!text) {
    return { alternatives: ["technical_diagnostic"], confidence: 0.3, family: "unclear" };
  }

  if (/\b(sign in|signed out|log in|logged out|password|permission|access|not allowed|denied)\b/.test(text)) {
    return {
      alternatives: ["technical_diagnostic", "how_to"],
      confidence: 0.82,
      family: "access_or_session_problem",
    };
  }

  if (/\b(take me|open|go to|where (are|is)|find|show me)\b/.test(text)) {
    return {
      alternatives: ["how_to", "workflow_request"],
      confidence: 0.78,
      family: "navigation",
    };
  }

  if (/\b(how do i|how to|what does|what is|what's|don'?t know what|change this|use this)\b/.test(text)) {
    return {
      alternatives: ["navigation", "workflow_request"],
      confidence: 0.76,
      family: "how_to",
    };
  }

  if (/\b(send|pair|connect|setup|set up|appointment|message|receiver|sound|audio|microphone|speaker)\b/.test(text)) {
    if (/\b(not working|doesn'?t work|failed|stuck|spinning|nothing happened|wrong|no sound|can'?t hear)\b/.test(text)) {
      return {
        alternatives: ["technical_diagnostic", "workflow_request"],
        confidence: 0.86,
        family: "unexpected_behavior",
      };
    }
    return {
      alternatives: ["how_to", "navigation"],
      confidence: 0.68,
      family: "workflow_request",
    };
  }

  if (
    input.networkOnline === false ||
    input.hasFailedApiCalls ||
    input.hasFrontendErrors ||
    /\b(error|broken|crash|blank|loading|stuck|spinning|nothing happened|page looks wrong)\b/.test(text)
  ) {
    return {
      alternatives: ["unexpected_behavior", "access_or_session_problem"],
      confidence: 0.74,
      family: "technical_diagnostic",
    };
  }

  return {
    alternatives: ["how_to", "technical_diagnostic"],
    confidence: 0.45,
    family: "unclear",
  };
}

function workflowForFamily(
  family: SomethingWentWrongInteractionFamily,
  text: string,
  route: string
) {
  if (/\b(receiver|pair|connect|setup|set up)\b/.test(text) || route.startsWith("/connect/receiver")) {
    return "receiver_troubleshooting";
  }
  if (/\b(sound|audio|microphone|speaker|hear)\b/.test(text)) return "audio_availability";
  if (/\b(message|send)\b/.test(text)) return "failed_message_delivery";
  if (/\b(sign in|session|logged out|permission|access)\b/.test(text)) {
    return "session_or_access_recovery";
  }
  if (family === "navigation") return "navigation_confirmation";
  if (family === "how_to") return "carepland_feature_explanation";
  if (family === "unclear") return "clarify_once";
  return "diagnostic_report_preparation";
}

function outcomeForFamily(
  family: SomethingWentWrongInteractionFamily,
  text: string,
  workflow: string,
  input: InterpretInput
): SomethingWentWrongOutcome {
  const navigation = navigationTarget(text);

  if (family === "navigation" && navigation) {
    return {
      actionLabel: `Open ${navigation.label}`,
      actionUrl: navigation.url,
      body: `I found ${navigation.label}. Open it when you are ready.`,
      kind: "navigate",
      title: "Open a CarePland page",
    };
  }

  if (family === "how_to") {
    return {
      actionLabel: navigation?.label ? `Open ${navigation.label}` : undefined,
      actionUrl: navigation?.url,
      body: howToAnswer(text),
      kind: "explain",
      title: "Quick answer",
    };
  }

  if (workflow !== "diagnostic_report_preparation" && family !== "unclear") {
    return {
      body: troubleshootingAnswer(workflow, input),
      kind: "troubleshooting",
      title: "What CarePland checked",
    };
  }

  if (family === "unclear") {
    return {
      body: "What were you trying to do right before this happened?",
      kind: "clarify",
      title: "One more detail",
    };
  }

  return {
    body:
      "I couldn’t resolve this automatically. CarePland can send a report containing your description and recent technical activity.",
    kind: "diagnostic_report",
    title: "Prepare a diagnostic report",
  };
}

function navigationTarget(text: string) {
  if (/\b(message|messages|send)\b/.test(text)) {
    return { label: "Messages", url: "/connect/dashboard" };
  }
  if (/\b(appointment|appointments|visit|visits)\b/.test(text)) {
    return { label: "Appointments", url: "/?personal=1&appointments=1&view=upcoming" };
  }
  if (/\b(profile|settings|receiver settings)\b/.test(text)) {
    return { label: "Profile & Settings", url: "/?personal=1&profile=1" };
  }
  if (/\b(admin|help reports|diagnostics)\b/.test(text)) {
    return { label: "Help Reports", url: "/admin?section=helpReports" };
  }
  return null;
}

function howToAnswer(text: string) {
  if (/\b(message|send)\b/.test(text)) {
    return "Open Messages, start a new message, choose the person, write or record it, then send.";
  }
  if (/\b(appointment|appointments)\b/.test(text)) {
    return "Open Appointments and choose Upcoming to see the next saved visits for the selected Care VIP.";
  }
  if (/\b(sound|audio|microphone|speaker)\b/.test(text)) {
    return "Check that the device volume is up, the browser has microphone permission, and the Receiver is online.";
  }
  if (/\b(change|profile|settings)\b/.test(text)) {
    return "Open Profile & Settings, choose the section you want to update, make the change, and save.";
  }
  return "Try the page’s primary action first. If it does not work, send a report so CarePland can include recent activity.";
}

function troubleshootingAnswer(workflow: string, input: InterpretInput) {
  if (input.networkOnline === false) {
    return "This device appears to be offline. Check the internet connection, then try the action again.";
  }
  if (input.hasFrontendErrors || input.hasFailedApiCalls) {
    return "CarePland detected recent technical activity that may explain this. You can send a report for review.";
  }
  if (workflow === "audio_availability") {
    return "Check device volume, speaker output, and browser microphone permission. If this is a Receiver, make sure it is online.";
  }
  if (workflow === "receiver_troubleshooting") {
    return "Check Receiver pairing, internet connection, and assigned Receiver user. If it still looks wrong, send a report.";
  }
  if (workflow === "failed_message_delivery") {
    return "Check that a concrete Care VIP or Receiver user is selected, then try sending again. If it stays stuck, send a report.";
  }
  if (workflow === "session_or_access_recovery") {
    return "CarePland may need you to sign in again or use an account with access to this page.";
  }
  return "CarePland checked recent activity. A report can include the useful technical context for review.";
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
