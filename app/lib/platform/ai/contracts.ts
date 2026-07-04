export type AiPlatformJson =
  | boolean
  | null
  | number
  | string
  | AiPlatformJson[]
  | { [key: string]: AiPlatformJson };

export type AiPlatformRecord = Record<string, AiPlatformJson>;

export type AiPlatformLayer =
  | "input_surface"
  | "transcription_text_capture"
  | "consumer_care_knowledge"
  | "household_knowledge"
  | "knowledge_resolution"
  | "intent_router"
  | "workflow_selection"
  | "persistence_human_review";

export type DecisionTraceEvidence = {
  label?: string;
  sourceId?: string | null;
  sourceTable?: string | null;
  sourceType?: string;
  text?: string;
  weight?: number;
};

export type DecisionTraceCandidate<TKind extends string = string> = {
  confidence: number;
  kind: TKind;
  rejectionReason?: string;
};

export type DecisionTraceReview = {
  reason?: string;
  required: boolean;
};

export type DecisionTraceExecution = {
  policy: "no_write" | "review_required" | "write_allowed";
  status: "blocked" | "completed" | "not_started" | "queued" | "skipped";
};

export type DecisionTrace<
  TLayer extends AiPlatformLayer = AiPlatformLayer,
  TCandidateKind extends string = string,
> = {
  competingCandidates?: DecisionTraceCandidate<TCandidateKind>[];
  confidence: number;
  context?: AiPlatformRecord;
  criticalFactors?: string[];
  entitiesDetected?: AiPlatformRecord;
  evidence?: DecisionTraceEvidence[];
  execution?: DecisionTraceExecution;
  humanReview?: DecisionTraceReview;
  inputSummary: string;
  layer: TLayer;
  matchedPhrases?: string[];
  matchedRules?: string[];
  outputSummary: string;
  rejectionReasons?: string[];
  timestamp: string;
  traceId?: string;
  version: string;
};

export type Observation = {
  context?: {
    activeWorkflow?: string | null;
    careCircleId?: string | null;
    careSubjectId?: string | null;
    deviceId?: string | null;
    surface?: string | null;
  };
  metadata?: AiPlatformRecord;
  observedAt: string;
  observationId?: string;
  rawText?: string;
  source:
    | "appointment_import"
    | "call_summary"
    | "careprep"
    | "dashboard"
    | "ocr"
    | "receiver"
    | "voice_memo"
    | (string & {});
  structuredInput?: AiPlatformRecord;
  transcriptText?: string;
};

export type Concept = {
  ambiguity: "high" | "low" | "medium" | "none";
  category?: string;
  conceptId: string;
  confidence: number;
  decisionTrace?: DecisionTrace<"consumer_care_knowledge">;
  displayName?: string;
  evidence?: DecisionTraceEvidence[];
  matchedText?: string;
  normalizedText?: string;
  sourceVocabulary?: "consumer_care_knowledge" | (string & {});
};

export type HouseholdConcept = {
  aliases?: string[];
  careCircleId: string;
  careSubjectId?: string | null;
  confidence: number;
  decisionTrace?: DecisionTrace<"household_knowledge">;
  displayName: string;
  evidence?: DecisionTraceEvidence[];
  householdConceptId: string;
  linkedConceptId?: string | null;
  resolutionStatus: "ambiguous" | "resolved" | "unresolved";
};

export type ResolvedConcept = {
  ambiguity: "high" | "low" | "medium" | "none";
  conceptId: string;
  confidence: number;
  decisionTrace?: DecisionTrace<"knowledge_resolution">;
  evidence?: DecisionTraceEvidence[];
  householdConcept?: HouseholdConcept;
  resolution:
    | "household_only"
    | "merged"
    | "universal_only"
    | "unresolved";
  resolvedConceptId: string;
  universalConcept?: Concept;
};

export type IntentResult<
  TIntent extends string = string,
  TAction extends string = string,
> = {
  candidateIntents?: DecisionTraceCandidate<TIntent>[];
  confidence: number;
  decisionTrace: DecisionTrace<"intent_router", TIntent>;
  intent: TIntent;
  needsConfirmation: boolean;
  needsReview: boolean;
  proposedAction: TAction;
  resolvedConcepts?: ResolvedConcept[];
  structuredPayload?: AiPlatformRecord;
};

export type WorkflowSelection<
  TWorkflow extends string = string,
  TAction extends string = string,
> = {
  action: TAction;
  confidence: number;
  decisionTrace?: DecisionTrace<"workflow_selection", TWorkflow | TAction>;
  executionPolicy: DecisionTraceExecution["policy"];
  rationale: string;
  requiresHumanReview: boolean;
  structuredPayload?: AiPlatformRecord;
  target?: {
    id?: string | null;
    table?: string | null;
    type: string;
  };
  workflow: TWorkflow;
};
