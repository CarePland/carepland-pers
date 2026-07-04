import type { DecisionTrace } from "./contracts";

export type PlatformKnowledgeDecisionTrace =
  | DecisionTrace<"consumer_care_knowledge">
  | DecisionTrace<"household_knowledge">
  | DecisionTrace<"knowledge_resolution">;

export type PlatformKnowledgeTraceInput = {
  consumerCareKnowledge?: DecisionTrace<"consumer_care_knowledge"> | null;
  householdKnowledge?: DecisionTrace<"household_knowledge"> | null;
  knowledgeResolution?: DecisionTrace<"knowledge_resolution"> | null;
};

export function composePlatformKnowledgeTraces({
  consumerCareKnowledge,
  householdKnowledge,
  knowledgeResolution,
}: PlatformKnowledgeTraceInput = {}): PlatformKnowledgeDecisionTrace[] {
  return [
    consumerCareKnowledge,
    householdKnowledge,
    knowledgeResolution,
  ].filter((trace): trace is PlatformKnowledgeDecisionTrace => Boolean(trace));
}
