import { openAiResponseText } from "@/app/lib/platform/ai/responses";
import { buildConsumerCareKnowledgePromptContext } from "@/app/lib/personal/consumerCareKnowledge";

const defaultCareSummaryPrompt = `Create a brief care summary from this conversation. Include only information that could reasonably belong in a health or caregiving record. Do not summarize general conversation.

Include medication discussions, symptoms, pain, mobility, sleep, appetite, weight, blood sugar/BP readings, cognitive changes, clinically relevant mood/function changes, upcoming appointments, provider instructions, caregiver observations, follow-up actions, and equipment.

Do not include family gossip, politics, sports, TV shows, personal opinions, financial discussions unless directly related to obtaining care, vacation plans, relationships, general chatting, jokes, religious discussion, or embarrassing information with no care relevance.

Include contextual life details only if they directly affect care. When uncertain, omit. Err toward under-documenting rather than creating an unnecessarily invasive record.`;

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
    const consumerCareKnowledgeContext =
      buildConsumerCareKnowledgePromptContext(transcriptText, {
        useCase: "call_summary",
      });
    const systemPrompt = consumerCareKnowledgeContext
      ? `${defaultCareSummaryPrompt}\n\n${consumerCareKnowledgeContext}`
      : defaultCareSummaryPrompt;

    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
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
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const summaryText = openAiResponseText(json);

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
