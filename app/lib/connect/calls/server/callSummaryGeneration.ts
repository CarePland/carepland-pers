import {
  type CcklNormalizationResult,
  normalizeConsumerCareKnowledge,
  runOpenAiResponse,
} from "../../../platform/ai";

const defaultCareSummaryPrompt = `Create a brief care summary from this conversation. Include only information that could reasonably belong in a health or caregiving record. Do not summarize general conversation.

Include medication discussions, symptoms, pain, mobility, sleep, appetite, weight, blood sugar/BP readings, cognitive changes, clinically relevant mood/function changes, upcoming appointments, provider instructions, caregiver observations, follow-up actions, and equipment.

Do not include family gossip, politics, sports, TV shows, personal opinions, financial discussions unless directly related to obtaining care, vacation plans, relationships, general chatting, jokes, religious discussion, or embarrassing information with no care relevance.

Include contextual life details only if they directly affect care. When uncertain, omit. Err toward under-documenting rather than creating an unnecessarily invasive record.`;

export function normalizeConnectCallCareSummaryCcklContext(
  transcriptText: string
): CcklNormalizationResult {
  return normalizeConsumerCareKnowledge({
    text: transcriptText,
    useCase: "call_summary",
  });
}

export function buildConnectCallCareSummarySystemPrompt(transcriptText: string) {
  const ccklNormalization =
    normalizeConnectCallCareSummaryCcklContext(transcriptText);
  // Platform Concepts and DecisionTrace are intentionally available here for
  // future explainability, but call summary v1 preserves legacy prompt behavior
  // and does not persist CCKL artifacts.
  const consumerCareKnowledgeContext =
    ccklNormalization.existingContext.promptContext;

  return consumerCareKnowledgeContext
    ? `${defaultCareSummaryPrompt}\n\n${consumerCareKnowledgeContext}`
    : defaultCareSummaryPrompt;
}

export async function generateConnectCallCareSummary(input: {
  transcriptText: string;
}) {
  const transcriptText = input.transcriptText.trim();
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!transcriptText) {
    return {
      summaryStatus: "not_needed",
      summaryText: "No care-relevant details were captured for this call.",
    };
  }

  if (!apiKey) {
    return {
      summaryStatus: "failed",
      summaryText: "",
    };
  }

  try {
    const systemPrompt = buildConnectCallCareSummarySystemPrompt(transcriptText);

    const response = await runOpenAiResponse({
      apiKey,
      input: [
        {
          content: systemPrompt,
          role: "system",
        },
        {
          content: `Conversation transcript:\n${transcriptText}`,
          role: "user",
        },
      ],
      model: process.env.OPENAI_CALL_SUMMARY_MODEL || "gpt-4.1-mini",
      temperature: 0.1,
    });
    const summaryText = response.text;

    if (!response.ok || !summaryText) {
      return {
        summaryStatus: "failed",
        summaryText: "",
      };
    }

    return {
      summaryStatus: "completed",
      summaryText,
    };
  } catch {
    return {
      summaryStatus: "failed",
      summaryText: "",
    };
  }
}
