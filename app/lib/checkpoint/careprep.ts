import type { DecisionTrace } from "@/app/lib/platform/ai/contracts";

export type CheckpointDecision =
  | "hold"
  | "needs_more_evidence"
  | "needs_work"
  | "proceed"
  | "suppress";

export type CheckpointEvaluationTag =
  | "appointment_specific_usefulness"
  | "appropriately_cautious"
  | "appropriate_information_request"
  | "connected_existing_knowledge"
  | "decision_stopped_one_step_too_early"
  | "duplicated_existing_evidence"
  | "eliminated_user_work"
  | "generic"
  | "grounded"
  | "irrelevant_emphasis"
  | "merely_restated_evidence"
  | "missed_important_evidence"
  | "missing_preparation"
  | "reduced_interpretation_work"
  | "reassigned_work_to_user"
  | "requested_known_information"
  | "saved_interpretation_work"
  | "specific"
  | "technically_true_not_useful"
  | "too_vague"
  | "too_verbose"
  | "unnecessary_preparation"
  | "unsupported_conclusion"
  | "useful";

export type CarePrepCheckpointGuidance = {
  beforeVisit?: string[] | null;
  bring_list?: string[] | null;
  duringVisit?: string[] | null;
  key_questions?: string[] | null;
  intro?: string | null;
  summary?: string | null;
};

export type CarePrepCheckpointEvidencePacket = {
  future_appointment?: {
    id?: string | null;
    title?: string | null;
    reason?: string | null;
    starts_at?: string | null;
    status?: string | null;
    care_vip_name?: string | null;
    current_note?: Record<string, unknown> | null;
  } | null;
  generation_mode?: string | null;
  past_appointment_total_count?: number | null;
  past_appointments?: Array<{
    id?: string | null;
    title?: string | null;
    reason?: string | null;
    starts_at?: string | null;
    status?: string | null;
    note?: Record<string, unknown> | null;
  }> | null;
};

export type CarePrepCheckpointObservation = {
  category: string;
  confidence: number;
  kind: "inferred" | "observed";
  observation: string;
  reasonsItMightMislead: string[];
  supportingEvidenceRefs: string[];
};

export type CarePrepCheckpointUserWorkOutcome =
  | "appropriately_requested_new_information"
  | "connected_information"
  | "duplicated_existing_evidence"
  | "eliminated_user_work"
  | "organized_information"
  | "reduced_interpretation"
  | "requested_information_already_known"
  | "sent_user_to_rediscover_known_information"
  | "unnecessary_preparation";

export type CarePrepCheckpointDecisionQualityReview = {
  category: string;
  checkpointReview: string;
  decision: string;
  evidence: string[];
  itemText: string;
  suggestedBetterDecision?: string;
  userWorkOutcome: CarePrepCheckpointUserWorkOutcome;
};

export type CarePrepCheckpointStructuredInterpretation = {
  decisionQualityReviews: CarePrepCheckpointDecisionQualityReview[];
  evaluationQuestion: string;
  platformRule: string;
  observations: CarePrepCheckpointObservation[];
  usefulnessFocus: string[];
};

export type CarePrepCheckpointProposedOutput = {
  beforeVisit: string[];
  duringVisit: string[];
  intro: string;
};

const evaluationQuestion =
  "If I were attending this appointment tomorrow, would this preparation genuinely reduce my cognitive workload?";

const decisionQualityQuestion =
  "For every recommendation or preparation item: did CarePland reduce work, or did it give work back to the user?";

const platformRule =
  "Whenever CarePland already possesses reliable information, it should prefer using that information over asking the user to rediscover or re-enter it, except for explicit verification, confirmation, changed circumstances, or intentionally collecting new observations.";

const usefulnessFocus = [
  "grounded recommendations",
  "appropriate prioritization",
  "missing preparation",
  "unnecessary preparation",
  "generic advice",
  "appointment-specific usefulness",
  "reduced interpretation work",
  "decision quality",
  "whether CarePland reduced user work or reassigned work to the user",
  "confidence that this output deserves to reach users",
];

export function normalizeCarePrepProposedOutput(
  guidance: CarePrepCheckpointGuidance
): CarePrepCheckpointProposedOutput {
  return {
    beforeVisit: stringList(guidance.beforeVisit ?? guidance.bring_list).slice(0, 3),
    duringVisit: stringList(guidance.duringVisit ?? guidance.key_questions).slice(0, 4),
    intro: stringValue(guidance.intro ?? guidance.summary).slice(0, 180),
  };
}

export function buildCarePrepStructuredInterpretation(
  guidance: CarePrepCheckpointGuidance,
  evidencePacket: CarePrepCheckpointEvidencePacket
): CarePrepCheckpointStructuredInterpretation {
  const output = normalizeCarePrepProposedOutput(guidance);
  const decisionQualityReviews = buildCarePrepDecisionQualityReviews(
    output,
    evidencePacket
  );
  const observations: CarePrepCheckpointObservation[] = [];
  const futureRef = evidencePacket.future_appointment?.id
    ? `appointment:${evidencePacket.future_appointment.id}`
    : "appointment:selected";
  const currentNote = evidencePacket.future_appointment?.current_note;
  const priorAppointments = evidencePacket.past_appointments ?? [];
  const priorWithNotes = priorAppointments.filter((appointment) =>
    Boolean(appointment.note)
  );

  if (output.intro) {
    observations.push({
      category: "intro",
      confidence: currentNote || priorWithNotes.length > 0 ? 0.82 : 0.62,
      kind: "inferred",
      observation: output.intro,
      reasonsItMightMislead:
        currentNote || priorWithNotes.length > 0
          ? []
          : ["The evidence packet has little note context for this appointment."],
      supportingEvidenceRefs: [
        futureRef,
        ...priorWithNotes.slice(0, 3).map((appointment) => `appointment:${appointment.id}`),
      ],
    });
  }

  addSectionObservations(observations, "before_visit", output.beforeVisit, futureRef);
  addSectionObservations(
    observations,
    "during_visit",
    output.duringVisit,
    futureRef
  );

  return {
    decisionQualityReviews,
    evaluationQuestion,
    platformRule,
    observations,
    usefulnessFocus,
  };
}

export function buildCarePrepDecisionTrace(
  runId: string,
  guidance: CarePrepCheckpointGuidance,
  evidencePacket: CarePrepCheckpointEvidencePacket,
  generatedAt: string
): DecisionTrace<"workflow_selection", "careprep_checkpoint"> {
  const output = normalizeCarePrepProposedOutput(guidance);
  const populatedSections = Object.entries(output)
    .filter(([, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value))
    .map(([key]) => key);
  const priorAppointments = evidencePacket.past_appointments ?? [];
  const priorWithNotes = priorAppointments.filter((appointment) =>
    Boolean(appointment.note)
  );

  return {
    confidence:
      output.intro || output.beforeVisit.length > 0 || output.duringVisit.length > 0
        ? 0.78
        : 0.42,
    context: {
      appointmentId: evidencePacket.future_appointment?.id ?? null,
      careVipName: evidencePacket.future_appointment?.care_vip_name ?? null,
      currentAppointmentHasNote: Boolean(
        evidencePacket.future_appointment?.current_note
      ),
      pastAppointmentCount:
        evidencePacket.past_appointment_total_count ?? priorAppointments.length,
      pastAppointmentsInPacket: priorAppointments.length,
      pastAppointmentsWithNotes: priorWithNotes.length,
      populatedSections: populatedSections.join(","),
    },
    criticalFactors: [
      "Checkpoint evaluates CarePrep usefulness, not publication readiness.",
      decisionQualityQuestion,
      platformRule,
      "Evidence is limited to the selected appointment and same-Care-VIP prior appointment notes.",
      "The preserved run stores the exact CarePrep guidance and evidence snapshot reviewed by Admin.",
    ],
    evidence: [
      {
        label: "Selected appointment",
        sourceId: evidencePacket.future_appointment?.id ?? null,
        sourceTable: "appointments",
        sourceType: "appointment",
        text:
          evidencePacket.future_appointment?.title ??
          evidencePacket.future_appointment?.reason ??
          "Selected appointment",
        weight: 1,
      },
      ...priorWithNotes.slice(0, 8).map((appointment) => ({
        label: appointment.title ?? "Prior appointment",
        sourceId: appointment.id ?? null,
        sourceTable: "appointments",
        sourceType: "prior_appointment_note",
        text: appointment.reason ?? appointment.title ?? "Prior appointment note",
        weight: 0.7,
      })),
    ],
    execution: {
      policy: "review_required",
      status: "completed",
    },
    humanReview: {
      reason: evaluationQuestion,
      required: true,
    },
    inputSummary: "CarePrep guidance and its saved input context snapshot.",
    layer: "workflow_selection",
    matchedRules: ["checkpoint.careprep.v1"],
    outputSummary: populatedSections.length
      ? `careprep_sections:${populatedSections.join(",")}`
      : "careprep_empty_output",
    timestamp: generatedAt,
    traceId: runId,
    version: "checkpoint_careprep:v1",
  };
}

export function buildCarePrepDecisionQualityReviews(
  output: CarePrepCheckpointProposedOutput,
  evidencePacket: CarePrepCheckpointEvidencePacket
): CarePrepCheckpointDecisionQualityReview[] {
  const evidenceItems = flattenEvidenceItems(evidencePacket);
  const reviews: CarePrepCheckpointDecisionQualityReview[] = [];
  const sections: Array<[string, string[]]> = [
    ["before_visit", output.beforeVisit],
    ["during_visit", output.duringVisit],
  ];

  sections.forEach(([category, items]) => {
    items.forEach((itemText) => {
      const matchingEvidence = evidenceItems.filter((evidence) =>
        textAppearsGroundedInEvidence(itemText, evidence.text)
      );
      const asksUserToRetrieveKnownInfo =
        category === "before_visit" &&
        /\b(bring|find|gather|retrieve|collect|look up|information|details|records?|paperwork|notes?)\b/i.test(
          itemText
        ) &&
        matchingEvidence.length > 0;
      const duplicatesEvidence =
        !asksUserToRetrieveKnownInfo &&
        matchingEvidence.length > 0 &&
        normalizeForComparison(itemText).length > 20 &&
        matchingEvidence.some((evidence) =>
          normalizeForComparison(evidence.text).includes(
            normalizeForComparison(itemText).slice(0, 80)
          )
        );

      if (asksUserToRetrieveKnownInfo) {
        reviews.push({
          category,
          checkpointReview:
            "CarePland appears to already possess the information this item asks the user to bring or rediscover.",
          decision: decisionForCarePrepItem(category, itemText),
          evidence: matchingEvidence.slice(0, 4).map((evidence) => evidence.label),
          itemText,
          suggestedBetterDecision:
            "Use the known information directly in the opening line or during-visit context, or ask only for changes since that known event.",
          userWorkOutcome: "requested_information_already_known",
        });
        return;
      }

      if (duplicatesEvidence) {
        reviews.push({
          category,
          checkpointReview:
            "This item substantially repeats evidence without clearly organizing, connecting, or reducing interpretation work.",
          decision: decisionForCarePrepItem(category, itemText),
          evidence: matchingEvidence.slice(0, 4).map((evidence) => evidence.label),
          itemText,
          suggestedBetterDecision:
            "Transform the evidence into a clearer preparation decision, connection, or question instead of restating it.",
          userWorkOutcome: "duplicated_existing_evidence",
        });
        return;
      }

      reviews.push({
        category,
        checkpointReview:
          matchingEvidence.length > 0
            ? "This decision uses existing evidence to organize appointment preparation."
            : "This decision may be useful if it asks for information not present in the evidence packet.",
        decision: decisionForCarePrepItem(category, itemText),
        evidence: matchingEvidence.slice(0, 4).map((evidence) => evidence.label),
        itemText,
        userWorkOutcome:
          matchingEvidence.length > 0
            ? userWorkOutcomeForCategory(category)
            : "appropriately_requested_new_information",
      });
    });
  });

  return reviews;
}

export function checkpointDecisionLabel(decision: CheckpointDecision) {
  switch (decision) {
    case "proceed":
      return "Proceed";
    case "needs_work":
      return "Needs Work";
    case "needs_more_evidence":
      return "Needs More Evidence";
    case "hold":
      return "Hold";
    case "suppress":
      return "Suppress";
  }
}

function addSectionObservations(
  observations: CarePrepCheckpointObservation[],
  category: string,
  values: string[],
  ...supportingEvidenceRefs: string[]
) {
  values.forEach((value) => {
    observations.push({
      category,
      confidence: 0.76,
      kind: "inferred",
      observation: value,
      reasonsItMightMislead: [],
      supportingEvidenceRefs: supportingEvidenceRefs.filter(Boolean),
    });
  });
}

function decisionForCarePrepItem(category: string, itemText: string) {
  switch (category) {
    case "before_visit":
      return `Suggest before-visit preparation: ${itemText}`;
    case "during_visit":
      return `Suggest during-visit discussion: ${itemText}`;
    default:
      return `Include preparation item: ${itemText}`;
  }
}

function userWorkOutcomeForCategory(
  category: string
): CarePrepCheckpointUserWorkOutcome {
  switch (category) {
    case "during_visit":
      return "reduced_interpretation";
    case "before_visit":
    default:
      return "appropriately_requested_new_information";
  }
}

function flattenEvidenceItems(evidencePacket: CarePrepCheckpointEvidencePacket) {
  const items: Array<{ label: string; text: string }> = [];
  const future = evidencePacket.future_appointment;

  if (future) {
    items.push({
      label: `Selected appointment: ${future.title ?? future.reason ?? future.id ?? "appointment"}`,
      text: [
        future.title,
        future.reason,
        future.starts_at,
        noteText(future.current_note),
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  (evidencePacket.past_appointments ?? []).forEach((appointment) => {
    items.push({
      label: `Prior appointment: ${appointment.title ?? appointment.reason ?? appointment.id ?? "appointment"}`,
      text: [
        appointment.title,
        appointment.reason,
        appointment.starts_at,
        noteText(appointment.note),
      ]
        .filter(Boolean)
        .join(" "),
    });
  });

  return items.filter((item) => item.text.trim());
}

function noteText(note: Record<string, unknown> | null | undefined) {
  if (!note) return "";

  return [
    note.summary_short,
    ...(Array.isArray(note.takeaways) ? note.takeaways : []),
    ...(Array.isArray(note.followups) ? note.followups : []),
  ]
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean)
    .join(" ");
}

function textAppearsGroundedInEvidence(itemText: string, evidenceText: string) {
  const itemTokens = meaningfulTokens(itemText);
  const evidenceTokens = new Set(meaningfulTokens(evidenceText));

  if (itemTokens.length === 0 || evidenceTokens.size === 0) {
    return false;
  }

  const matches = itemTokens.filter((token) => evidenceTokens.has(token));
  return matches.length >= Math.min(2, itemTokens.length);
}

function meaningfulTokens(value: string) {
  const stopwords = new Set([
    "about",
    "after",
    "and",
    "any",
    "are",
    "bring",
    "carepland",
    "details",
    "for",
    "from",
    "have",
    "information",
    "into",
    "notes",
    "prior",
    "records",
    "the",
    "this",
    "to",
    "visit",
    "with",
    "you",
    "your",
  ]);

  return normalizeForComparison(value)
    .split(" ")
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function normalizeForComparison(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}
