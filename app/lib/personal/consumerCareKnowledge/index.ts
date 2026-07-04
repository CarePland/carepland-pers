export type ConsumerCareKnowledgeCategory =
  | "appointments_portals"
  | "caregiving_support"
  | "home_health_rehab"
  | "insurance_access"
  | "medication_access"
  | "medication_adherence"
  | "mobility_equipment"
  | "monitoring_supplies";

export type ConsumerCareKnowledgeEntry = {
  aliases: string[];
  canonicalTerm: string;
  careRelevance: string;
  category: ConsumerCareKnowledgeCategory;
  conceptId: string;
  confidenceNotes: string;
  consumerPhrases: string[];
  examples?: string[];
  interpretationGuidance: string;
  sourceUrls: string[];
  summaryGuidance: string;
  transcriptNormalizationHints: string[];
};

export type ConsumerCareKnowledgeMatch = {
  confidence: number;
  entry: ConsumerCareKnowledgeEntry;
  matchedText: string;
};

export type ConsumerCareKnowledgeUseCase =
  | "admin_review"
  | "call_summary"
  | "careprep_generation"
  | "health_topic_recognition"
  | "note_intake"
  | "transcript_interpretation"
  | "user_question";

export type ConsumerCareKnowledgeContext = {
  conceptIds: string[];
  hasMatches: boolean;
  matchedTerms: string[];
  matches: ConsumerCareKnowledgeMatch[];
  promptContext: string;
  useCase: ConsumerCareKnowledgeUseCase;
};

const useCaseGuidance: Record<ConsumerCareKnowledgeUseCase, string> = {
  admin_review:
    "Use matches to explain likely interpretation issues and prompt-review opportunities. Do not treat matched terms as new user facts.",
  call_summary:
    "Use matches to write a care-only call summary from the conversation. Include only concrete care details that were discussed.",
  careprep_generation:
    "Use matches to understand saved context and suggest appointment-preparation details only when supported by the user's records.",
  health_topic_recognition:
    "Use matches as a bridge from consumer language to broad Health Focus topics. Do not create new topics or diagnoses from a term alone.",
  note_intake:
    "Use matches to interpret imported or user-entered notes. Save only reviewed, care-relevant facts that are present in the source.",
  transcript_interpretation:
    "Use matches to normalize likely transcript terms and brand/service names. Do not preserve raw transcript text because of these matches.",
  user_question:
    "Use matches to understand shorthand in the user's question. Answer only from supplied CarePland context and do not promise permanent memory.",
};

export const consumerCareKnowledgeSeed: ConsumerCareKnowledgeEntry[] = [
  {
    aliases: ["pill pack", "pillpack", "amazon pillpack", "amazon pharmacy packets"],
    canonicalTerm: "PillPack",
    careRelevance:
      "May indicate medication packaging, delivery, refill coordination, pharmacy transfer, or adherence support.",
    category: "medication_adherence",
    conceptId: "medication_adherence.pillpack",
    confidenceNotes:
      "High confidence when used near medications, packets, refills, pharmacy, delivery, or Amazon Pharmacy.",
    consumerPhrases: [
      "PillPack sends her meds",
      "the pills come in packets",
      "Amazon packets",
    ],
    examples: [
      "PillPack was late this month, so the caregiver called the pharmacy.",
    ],
    interpretationGuidance:
      "Understand as a pharmacy packaging/delivery service, usually for people managing multiple recurring medications. Do not infer medication names, doses, or adherence problems unless discussed.",
    sourceUrls: ["https://www.amazon.com/pharmacy/pillpack"],
    summaryGuidance:
      "Mention only concrete care logistics that were discussed, such as delayed packets, refill coordination, pharmacy changes, or caregiver follow-up.",
    transcriptNormalizationHints: [
      "pill pack -> PillPack",
      "pillpack -> PillPack",
      "Amazon packets -> PillPack only when medication context is clear",
    ],
  },
  {
    aliases: ["blister pack", "blister packs", "bubble pack", "bubble packs", "med packs"],
    canonicalTerm: "Blister packs",
    careRelevance:
      "May indicate medication organization, adherence support, pharmacy packaging, or caregiver oversight.",
    category: "medication_adherence",
    conceptId: "medication_adherence.blister_packs",
    confidenceNotes:
      "High confidence when paired with pills, meds, pharmacy, morning/evening doses, or refill timing.",
    consumerPhrases: ["blister packs from the pharmacy", "bubble packs", "med packs"],
    interpretationGuidance:
      "Understand as pre-sorted medication packaging. Do not infer missed doses or cognitive impairment unless the conversation states that.",
    sourceUrls: ["https://en.wikipedia.org/wiki/Blister_pack"],
    summaryGuidance:
      "Store only care-relevant packaging or medication-management facts actually discussed.",
    transcriptNormalizationHints: ["bubble packs -> blister packs", "med packs -> medication packs"],
  },
  {
    aliases: ["pill box", "pillbox", "pill organizer", "med organizer", "weekly pill box"],
    canonicalTerm: "Pill organizer",
    careRelevance:
      "May indicate medication schedule management, caregiver setup tasks, or concern about missed/double doses.",
    category: "medication_adherence",
    conceptId: "medication_adherence.pill_organizer",
    confidenceNotes:
      "Common consumer phrase; interpret cautiously because it can be ordinary organization without a care issue.",
    consumerPhrases: ["filled the pill box", "weekly pill organizer", "mom's med box"],
    interpretationGuidance:
      "Understand as a medication organization tool. Do not assume nonadherence unless the user describes missed, extra, or confusing doses.",
    sourceUrls: ["https://en.wikipedia.org/wiki/Pill_organizer"],
    summaryGuidance:
      "Mention setup responsibility, schedule changes, or safety concerns only when explicitly discussed.",
    transcriptNormalizationHints: ["pillbox -> pill box", "med box -> medication organizer"],
  },
  {
    aliases: ["good rx", "goodrx", "rx coupon", "drug coupon", "prescription discount card"],
    canonicalTerm: "GoodRx",
    careRelevance:
      "May indicate medication affordability, cash pricing, coupon use, pharmacy selection, or insurance-workaround logistics.",
    category: "medication_access",
    conceptId: "medication_access.goodrx",
    confidenceNotes:
      "High confidence when near prescriptions, pharmacy prices, coupons, cash pay, or insurance.",
    consumerPhrases: ["used GoodRx", "coupon price", "discount card"],
    interpretationGuidance:
      "Understand as prescription price comparison/discount support, not health insurance. Do not infer financial hardship unless stated.",
    sourceUrls: ["https://www.goodrx.com/how-goodrx-works"],
    summaryGuidance:
      "Include only if affordability or access affects medication pickup, refill, adherence, or appointment follow-up.",
    transcriptNormalizationHints: ["good rx -> GoodRx", "RX coupon -> prescription discount coupon"],
  },
  {
    aliases: ["prior auth", "pre auth", "preauthorization", "prior authorization", "pre approval"],
    canonicalTerm: "Prior authorization",
    careRelevance:
      "May indicate an insurance approval step that can delay medications, equipment, tests, procedures, or referrals.",
    category: "insurance_access",
    conceptId: "insurance_access.prior_authorization",
    confidenceNotes:
      "High confidence in insurance, pharmacy, referral, procedure, DME, or medication contexts.",
    consumerPhrases: ["needs a prior auth", "waiting on preauth", "insurance approval"],
    interpretationGuidance:
      "Understand as a coverage/admin requirement, not as clinical approval or a guarantee of payment.",
    sourceUrls: ["https://www.healthcare.gov/glossary/preauthorization/"],
    summaryGuidance:
      "Mention pending approvals, denials, appeals, missing paperwork, or caregiver follow-up only when discussed.",
    transcriptNormalizationHints: ["pre auth -> prior authorization", "PA -> prior authorization only when insurance context is clear"],
  },
  {
    aliases: [
      "caremark",
      "care mark",
      "cvs caremark",
      "cvs care mark",
      "caremark pbm",
      "cvs pharmacy benefits",
    ],
    canonicalTerm: "CVS Caremark",
    careRelevance:
      "May indicate pharmacy-benefit management, mail-order pharmacy, formulary coverage, refill access, prior authorization, or prescription cost/coverage logistics.",
    category: "insurance_access",
    conceptId: "insurance_access.cvs_caremark",
    confidenceNotes:
      "High confidence when near prescriptions, pharmacy benefits, mail order, formulary, refills, insurance, copays, prior authorization, or CVS.",
    consumerPhrases: ["Caremark said it was denied", "CVS Caremark mail order", "Caremark needs approval"],
    interpretationGuidance:
      "Understand as a CVS Health pharmacy-benefit/pharmacy service identity. Do not infer coverage, denial, plan enrollment, or medication specifics unless discussed.",
    sourceUrls: ["https://www.caremark.com/"],
    summaryGuidance:
      "Mention only concrete prescription-access, refill, mail-order, coverage, or follow-up details actually discussed.",
    transcriptNormalizationHints: [
      "care mark -> Caremark",
      "CVS care mark -> CVS Caremark",
      "Caremark -> CVS Caremark when prescription/insurance context is clear",
    ],
  },
  {
    aliases: [
      "silverscript",
      "silver script",
      "silver scripts",
      "aetna silverscript",
      "silverscript part d",
      "silver script part d",
    ],
    canonicalTerm: "SilverScript",
    careRelevance:
      "May indicate a Medicare Part D prescription drug plan, drug coverage, formulary, pharmacy network, copays, or prescription-plan paperwork.",
    category: "insurance_access",
    conceptId: "insurance_access.silverscript",
    confidenceNotes:
      "High confidence when near Medicare, Part D, prescriptions, drug plan, formulary, pharmacy, copays, coverage, or Aetna.",
    consumerPhrases: ["SilverScript covers it", "Silver Script Part D", "Aetna SilverScript plan"],
    interpretationGuidance:
      "Understand as an Aetna/CVS-associated Medicare prescription drug plan identity. Do not infer active enrollment, covered medications, or coverage decisions unless stated.",
    sourceUrls: ["https://www.silverscript.com/"],
    summaryGuidance:
      "Include only if prescription coverage, cost, pharmacy access, paperwork, or caregiver follow-up was actually discussed.",
    transcriptNormalizationHints: [
      "silver script -> SilverScript",
      "silver scripts -> SilverScript",
      "SilverScript -> Medicare Part D prescription plan context when prescriptions or coverage are discussed",
    ],
  },
  {
    aliases: [
      "geha",
      "g e h a",
      "g.e.h.a",
      "gee ha",
      "gee hah",
      "ghee ha",
      "ghee hah",
      "ghee-hah",
      "government employees health association",
    ],
    canonicalTerm: "G.E.H.A",
    careRelevance:
      "May indicate health, dental, prescription, provider-network, portal, claims, benefits, or federal employee/retiree coverage logistics.",
    category: "insurance_access",
    conceptId: "insurance_access.geha",
    confidenceNotes:
      "High confidence for GEHA/G.E.H.A in insurance, benefits, provider, claim, prescription, dental, FEHB, PSHB, or federal employee context. Phonetic forms like 'ghee hah' are user-specific/high-value but need surrounding coverage context.",
    consumerPhrases: ["G.E.H.A said the provider is in network", "ghee hah covers it", "GEHA claim"],
    interpretationGuidance:
      "Understand as Government Employees Health Association, a health/dental benefits organization for federal employees, retirees, and families. Do not infer plan type, eligibility, coverage, or claim status unless discussed.",
    sourceUrls: ["https://www.geha.com/"],
    summaryGuidance:
      "Mention only concrete insurance, claim, provider-network, prescription, dental, portal, or benefits details actually discussed.",
    transcriptNormalizationHints: [
      "ghee hah -> G.E.H.A when insurance/benefits context is clear",
      "gee ha -> G.E.H.A when insurance/benefits context is clear",
      "GEHA -> G.E.H.A",
      "G E H A -> G.E.H.A",
    ],
  },
  {
    aliases: ["my chart", "mychart", "patient portal", "portal message", "portal"],
    canonicalTerm: "MyChart",
    careRelevance:
      "May indicate appointment scheduling, test results, medication lists, provider messages, pre-visit tasks, or shared records.",
    category: "appointments_portals",
    conceptId: "appointments_portals.mychart",
    confidenceNotes:
      "High confidence for MyChart/My Chart. Generic portal needs healthcare context.",
    consumerPhrases: ["sent a MyChart message", "check the portal", "results are in MyChart"],
    interpretationGuidance:
      "Understand as a patient portal, often Epic MyChart. Do not infer that CarePland has portal access or can retrieve records.",
    sourceUrls: ["https://www.mychart.org/"],
    summaryGuidance:
      "Record only the user-discussed care action or information, such as a message sent, result reviewed, or appointment task.",
    transcriptNormalizationHints: ["my chart -> MyChart", "portal -> patient portal when healthcare context is clear"],
  },
  {
    aliases: ["dme", "durable medical equipment", "medical equipment", "home medical equipment"],
    canonicalTerm: "Durable medical equipment",
    careRelevance:
      "May indicate equipment needed at home, supplier coordination, coverage requirements, rentals, repairs, or replacement.",
    category: "mobility_equipment",
    conceptId: "mobility_equipment.durable_medical_equipment",
    confidenceNotes:
      "High confidence for DME phrase; generic equipment needs care context.",
    consumerPhrases: ["DME supplier", "medical equipment for home", "Medicare equipment"],
    interpretationGuidance:
      "Understand as reusable home equipment ordered for a medical/care reason. Do not infer coverage eligibility.",
    sourceUrls: ["https://www.medicare.gov/coverage/durable-medical-equipment-dme-coverage"],
    summaryGuidance:
      "Mention equipment, supplier, order, delivery, repair, or coverage tasks only when actually discussed.",
    transcriptNormalizationHints: ["DME -> durable medical equipment"],
  },
  {
    aliases: ["walker", "walking frame", "front wheel walker", "two wheel walker"],
    canonicalTerm: "Walker",
    careRelevance:
      "May indicate mobility support, fall-risk context, rehab, home safety, transport planning, or equipment needs.",
    category: "mobility_equipment",
    conceptId: "mobility_equipment.walker",
    confidenceNotes:
      "High confidence when used with walking, balance, falls, PT, rehab, home, or DME.",
    consumerPhrases: ["uses a walker", "needs the walker", "bring the walker"],
    interpretationGuidance:
      "Understand as mobility support equipment. Do not infer diagnosis, level of disability, or fall history unless discussed.",
    sourceUrls: ["https://www.medicare.gov/coverage/durable-medical-equipment-dme-coverage"],
    summaryGuidance:
      "Include mobility/equipment details when they affect safety, appointments, rehab, or caregiver tasks.",
    transcriptNormalizationHints: ["walking frame -> walker"],
  },
  {
    aliases: ["rollator", "rolling walker", "wheeled walker", "walker with seat"],
    canonicalTerm: "Rollator",
    careRelevance:
      "May indicate a wheeled mobility aid with brakes and often a seat, relevant to walking tolerance, fatigue, transport, and safety.",
    category: "mobility_equipment",
    conceptId: "mobility_equipment.rollator",
    confidenceNotes:
      "High confidence for rollator; 'walker with seat' should be interpreted as rollator-like, not a standard walker.",
    consumerPhrases: ["walker with a seat", "rolling walker", "rollator brakes"],
    interpretationGuidance:
      "Understand as a wheeled walker variant. Do not infer improper use or fall risk unless discussed.",
    sourceUrls: ["https://www.medicare.gov/coverage/durable-medical-equipment-dme-coverage"],
    summaryGuidance:
      "Mention only concrete mobility, safety, equipment, or appointment logistics discussed.",
    transcriptNormalizationHints: ["walker with seat -> rollator", "rolling walker -> rollator"],
  },
  {
    aliases: ["compression socks", "compression stockings", "support hose", "compression hose"],
    canonicalTerm: "Compression socks",
    careRelevance:
      "May indicate leg swelling, circulation support, lymphedema, post-procedure instructions, or equipment/sizing tasks.",
    category: "mobility_equipment",
    conceptId: "mobility_equipment.compression_socks",
    confidenceNotes:
      "Care relevance depends on context; avoid treating casual travel/athletic use as a medical issue unless stated.",
    consumerPhrases: ["wearing compression socks", "support hose", "stockings for swelling"],
    interpretationGuidance:
      "Understand as compression garments. Do not infer a vascular diagnosis, clot risk, or treatment plan unless discussed.",
    sourceUrls: ["https://www.nhlbi.nih.gov/health/lymphedema/treatment"],
    summaryGuidance:
      "Include when tied to swelling, provider instructions, fitting, comfort, adherence, or care logistics.",
    transcriptNormalizationHints: ["support hose -> compression stockings"],
  },
  {
    aliases: ["blood sugar meter", "glucose meter", "glucometer", "finger stick", "test strips", "lancets"],
    canonicalTerm: "Blood sugar meter",
    careRelevance:
      "May indicate diabetes monitoring, supplies, readings to bring to appointments, refill needs, or caregiver tracking.",
    category: "monitoring_supplies",
    conceptId: "monitoring_supplies.blood_sugar_meter",
    confidenceNotes:
      "High confidence when paired with diabetes, sugar readings, strips, lancets, or finger sticks.",
    consumerPhrases: ["check sugar", "finger stick", "out of test strips"],
    interpretationGuidance:
      "Understand as home blood glucose monitoring. Do not infer diabetes type, targets, or treatment changes unless discussed.",
    sourceUrls: ["https://www.cdc.gov/diabetes/treatment/index.html"],
    summaryGuidance:
      "Mention specific readings, supply needs, or monitoring instructions only when discussed.",
    transcriptNormalizationHints: ["glucometer -> blood sugar meter", "finger stick -> blood sugar check"],
  },
  {
    aliases: ["cgm", "continuous glucose monitor", "dexcom", "freestyle libre", "libre sensor"],
    canonicalTerm: "Continuous glucose monitor",
    careRelevance:
      "May indicate ongoing glucose monitoring, sensors, alerts, device supplies, data sharing, or appointment review.",
    category: "monitoring_supplies",
    conceptId: "monitoring_supplies.continuous_glucose_monitor",
    confidenceNotes:
      "High confidence for CGM and common brand names in diabetes context.",
    consumerPhrases: ["CGM alarm", "Libre sensor", "Dexcom readings"],
    interpretationGuidance:
      "Understand as a sensor-based glucose monitoring device. Do not infer readings, trends, or treatment needs unless stated.",
    sourceUrls: ["https://www.cdc.gov/diabetes/treatment/index.html"],
    summaryGuidance:
      "Include only concrete monitoring details, supply issues, alarms, readings, or provider-review tasks discussed.",
    transcriptNormalizationHints: ["CGM -> continuous glucose monitor"],
  },
  {
    aliases: ["pt", "physical therapy", "physio", "rehab exercises", "therapy exercises"],
    canonicalTerm: "Physical therapy",
    careRelevance:
      "May indicate rehabilitation, mobility/function goals, home exercises, appointment follow-up, or caregiver transport.",
    category: "home_health_rehab",
    conceptId: "home_health_rehab.physical_therapy",
    confidenceNotes:
      "PT is ambiguous; use only when healthcare, rehab, exercise, mobility, surgery, injury, or appointment context is present.",
    consumerPhrases: ["going to PT", "doing rehab exercises", "physical therapy appointment"],
    interpretationGuidance:
      "Understand as rehabilitation/supportive therapy, not psychotherapy unless the context clearly indicates mental health therapy.",
    sourceUrls: ["https://medlineplus.gov/rehabilitation.html"],
    summaryGuidance:
      "Mention therapy schedule, exercises, progress, barriers, or follow-up only when actually discussed.",
    transcriptNormalizationHints: ["PT -> physical therapy when rehab/mobility context is clear"],
  },
  {
    aliases: ["home health", "home nurse", "visiting nurse", "home aide", "home care nurse"],
    canonicalTerm: "Home health",
    careRelevance:
      "May indicate in-home skilled care, nursing visits, therapy, aide support, eligibility/coverage logistics, or caregiver coordination.",
    category: "home_health_rehab",
    conceptId: "home_health_rehab.home_health",
    confidenceNotes:
      "Home care can mean non-medical support; use the surrounding context to avoid overstating skilled services.",
    consumerPhrases: ["home health is coming", "visiting nurse", "home nurse checked"],
    interpretationGuidance:
      "Understand as in-home care support; distinguish skilled home health from general caregiving only when the conversation makes it clear.",
    sourceUrls: ["https://www.medicare.gov/coverage/home-health-services"],
    summaryGuidance:
      "Include visit schedules, tasks, instructions, or coordination needs only when care-relevant and discussed.",
    transcriptNormalizationHints: ["visiting nurse -> home health nurse"],
  },
];

export function findConsumerCareKnowledgeMatches(
  text: string,
  entries: ConsumerCareKnowledgeEntry[] = consumerCareKnowledgeSeed
): ConsumerCareKnowledgeMatch[] {
  const normalizedText = normalizeKnowledgeText(text);

  if (!normalizedText) {
    return [];
  }

  return entries
    .map((entry) => {
      const searchableTerms = [
        entry.canonicalTerm,
        ...entry.aliases,
        ...entry.consumerPhrases,
      ];
      const matchedText = searchableTerms.find((term) =>
        containsKnowledgeTerm(normalizedText, normalizeKnowledgeText(term))
      );

      if (!matchedText) {
        return null;
      }

      return {
        confidence: confidenceForKnowledgeMatch(matchedText, entry),
        entry,
        matchedText,
      };
    })
    .filter((match): match is ConsumerCareKnowledgeMatch => Boolean(match))
    .sort((left, right) => {
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      return left.entry.canonicalTerm.localeCompare(right.entry.canonicalTerm);
    });
}

export function buildConsumerCareKnowledgePromptContext(
  text: string,
  options: {
    entries?: ConsumerCareKnowledgeEntry[];
    maxEntries?: number;
    useCase?: ConsumerCareKnowledgeUseCase;
  } = {}
): string {
  return buildConsumerCareKnowledgeContext(text, options).promptContext;
}

export function buildConsumerCareKnowledgeContext(
  text: string,
  options: {
    entries?: ConsumerCareKnowledgeEntry[];
    maxEntries?: number;
    useCase?: ConsumerCareKnowledgeUseCase;
  } = {}
): ConsumerCareKnowledgeContext {
  const useCase = options.useCase ?? "transcript_interpretation";
  const matches = findConsumerCareKnowledgeMatches(text, options.entries).slice(
    0,
    options.maxEntries ?? defaultMaxEntriesForUseCase(useCase)
  );

  if (matches.length === 0) {
    return {
      hasMatches: false,
      conceptIds: [],
      matchedTerms: [],
      matches: [],
      promptContext: "",
      useCase,
    };
  }

  const lines = [
    `Consumer Care Knowledge Layer context (${useCase.replaceAll("_", " ")}):`,
    "Use these entries only to interpret ordinary consumer/caregiver language. This is not medical advice, diagnosis, clinical decision support, or permission to store extra details. Store/summarize only care-relevant facts actually discussed. When uncertain, omit.",
    useCaseGuidance[useCase],
    ...matches.map((match) => {
      const entry = match.entry;

      return [
        `- ${entry.canonicalTerm} (${entry.category}; matched "${match.matchedText}")`,
        `  Concept ID: ${entry.conceptId}`,
        `  Interpretation: ${entry.interpretationGuidance}`,
        `  Care relevance: ${entry.careRelevance}`,
        `  Transcript normalization: ${entry.transcriptNormalizationHints.join("; ")}`,
        `  Summary guidance: ${entry.summaryGuidance}`,
        `  Confidence note: ${entry.confidenceNotes}`,
      ].join("\n");
    }),
  ];

  return {
    conceptIds: matches.map((match) => match.entry.conceptId),
    hasMatches: true,
    matchedTerms: matches.map((match) => match.entry.canonicalTerm),
    matches,
    promptContext: lines.join("\n"),
    useCase,
  };
}

function confidenceForKnowledgeMatch(
  matchedText: string,
  entry: ConsumerCareKnowledgeEntry
): number {
  const normalizedMatch = normalizeKnowledgeText(matchedText);
  const normalizedCanonical = normalizeKnowledgeText(entry.canonicalTerm);

  if (normalizedMatch === normalizedCanonical) {
    return 0.94;
  }

  if (normalizedMatch.length <= 3) {
    return 0.62;
  }

  return 0.8;
}

function normalizeKnowledgeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function defaultMaxEntriesForUseCase(useCase: ConsumerCareKnowledgeUseCase): number {
  if (useCase === "user_question") {
    return 4;
  }

  if (useCase === "admin_review") {
    return 12;
  }

  return 8;
}

function containsKnowledgeTerm(normalizedText: string, normalizedTerm: string): boolean {
  if (!normalizedTerm) {
    return false;
  }

  return new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}(\\s|$)`).test(
    normalizedText
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
