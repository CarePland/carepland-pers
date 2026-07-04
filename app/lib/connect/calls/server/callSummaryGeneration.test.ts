import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildConsumerCareKnowledgePromptContext } from "../../../personal/consumerCareKnowledge";
import {
  buildConnectCallCareSummarySystemPrompt,
  normalizeConnectCallCareSummaryCcklContext,
} from "./callSummaryGeneration";

const legacyDefaultCareSummaryPrompt = `Create a brief care summary from this conversation. Include only information that could reasonably belong in a health or caregiving record. Do not summarize general conversation.

Include medication discussions, symptoms, pain, mobility, sleep, appetite, weight, blood sugar/BP readings, cognitive changes, clinically relevant mood/function changes, upcoming appointments, provider instructions, caregiver observations, follow-up actions, and equipment.

Do not include family gossip, politics, sports, TV shows, personal opinions, financial discussions unless directly related to obtaining care, vacation plans, relationships, general chatting, jokes, religious discussion, or embarrassing information with no care relevance.

Include contextual life details only if they directly affect care. When uncertain, omit. Err toward under-documenting rather than creating an unnecessarily invasive record.`;

describe("Connect call summary generation", () => {
  it("preserves the legacy system prompt when CCKL context matches", () => {
    const transcript =
      "Mom said Ghee hah denied the refill, so Andrew checked MyChart and GoodRx.";

    assert.equal(
      buildConnectCallCareSummarySystemPrompt(transcript),
      legacyCallSummarySystemPrompt(transcript)
    );
  });

  it("preserves the legacy system prompt when CCKL has no matches", () => {
    const transcript = "They talked about lunch and a television show.";

    assert.equal(
      buildConnectCallCareSummarySystemPrompt(transcript),
      legacyCallSummarySystemPrompt(transcript)
    );
    assert.equal(
      buildConnectCallCareSummarySystemPrompt(transcript),
      legacyDefaultCareSummaryPrompt
    );
  });

  it("makes platform CCKL concepts and trace available without changing prompt output", () => {
    const transcript =
      "Mom said Ghee hah denied the refill, so Andrew checked MyChart and GoodRx.";
    const ccklNormalization =
      normalizeConnectCallCareSummaryCcklContext(transcript);

    assert.deepEqual(
      ccklNormalization.concepts.map((concept) => concept.conceptId).sort(),
      [
        "appointments_portals.mychart",
        "insurance_access.geha",
        "medication_access.goodrx",
      ].sort()
    );
    assert.equal(
      ccklNormalization.decisionTrace.layer,
      "consumer_care_knowledge"
    );
    assert.equal(ccklNormalization.decisionTrace.execution?.policy, "no_write");
    assert.equal(
      buildConnectCallCareSummarySystemPrompt(transcript),
      legacyCallSummarySystemPrompt(transcript)
    );
  });
});

function legacyCallSummarySystemPrompt(transcriptText: string) {
  const consumerCareKnowledgeContext = buildConsumerCareKnowledgePromptContext(
    transcriptText,
    {
      useCase: "call_summary",
    }
  );

  return consumerCareKnowledgeContext
    ? `${legacyDefaultCareSummaryPrompt}\n\n${consumerCareKnowledgeContext}`
    : legacyDefaultCareSummaryPrompt;
}
