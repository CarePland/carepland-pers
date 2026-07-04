import { NextRequest, NextResponse } from "next/server";

import {
  homeContextClassifierDefaultSchema,
  homeContextClassifierDefaultSystemPrompt,
  homeContextClassifierDefaultUserPrompt,
  homeContextDefaultSchema,
  homeContextDefaultSystemPrompt,
  homeContextDefaultUserPrompt,
  homeContextPromptVersionLabel,
  loadHomeContextInstructionVersion,
} from "@/app/lib/personal/homeContext/prompts";
import { logOpenAiOperationCost } from "@/app/lib/platform/ai/operationLogs";
import {
  openAiResponseText,
  runOpenAiResponse,
} from "@/app/lib/platform/ai/responses";
import { createSupabaseUserClient } from "@/app/lib/platform/server/supabase";

type JsonObject = Record<string, unknown>;

const openAiApiKey = process.env.OPENAI_API_KEY ?? "";

type AppointmentRow = {
  care_subject_id: string;
  id: string;
  location_name: string | null;
  provider_name: string | null;
  provider_organization: string | null;
  reason: string | null;
  starts_at: string | null;
  status: string | null;
  title: string | null;
};

type AppointmentNoteRow = {
  appointment_id: string;
  followups: unknown;
  input_text: string | null;
  summary_short: string | null;
  takeaways: unknown;
};

type CarePrepRow = {
  appointment_id: string;
  bring_list: unknown;
  key_questions: unknown;
  next_steps: unknown;
  since_last_visit: unknown;
  summary: string | null;
  watchouts: unknown;
};

type CareCircleMembershipRow = {
  care_circle_id: string;
};

type HealthTopicRow = {
  display_name: string;
  slug: string;
};

type TopicMentionRow = {
  appointment_id: string | null;
  appointment_starts_at: string | null;
  normalized_topic_slug: string;
  provider_name: string | null;
  provider_organization: string | null;
  source_snippet: string | null;
  status: string | null;
};

type HomeContextIntentCategory =
  | "care_planning"
  | "care_story"
  | "health_focus"
  | "out_of_scope"
  | "personal_care_history"
  | "provider_context";

type HomeContextSourceType =
  | "appointments"
  | "careprep"
  | "health_focus"
  | "notes"
  | "providers";

type HomeContextLevel =
  | "appointment"
  | "careprep"
  | "global"
  | "home"
  | "health_focus"
  | "visit_note";

type HomeContextVisibleItem = {
  date?: string | null;
  id?: string | null;
  label: string;
  metadata?: Record<string, string | null | undefined>;
  type: "appointment" | "careprep" | "health_focus" | "provider" | "visit_note";
};

type HomeContextConversationTurn = {
  answer: string;
  question: string;
};

type HomeContextIntent = {
  category: HomeContextIntentCategory;
  confidence: number;
  rationale: string;
  sourceTypes: HomeContextSourceType[];
};

type HomeContextAskContext = {
  appointmentId?: string | null;
  careprepId?: string | null;
  careSubjectId?: string | null;
  conversationMode?: "correction" | "follow_up" | null;
  conversationTurns: HomeContextConversationTurn[];
  level: HomeContextLevel;
  noteId?: string | null;
  sourceIds: string[];
  topicId?: string | null;
  topicName?: string | null;
  visibleItems: HomeContextVisibleItem[];
};

type HomeContextQueryShape =
  | "appointment_count"
  | "entity_only"
  | "preparation"
  | "recent_change"
  | "relationship"
  | "unknown";

type HomeContextQueryInterpretation = {
  isShortQuery: boolean;
  normalizedQuery: string;
  queryShape: HomeContextQueryShape;
  termExpansions: Array<{
    from: string;
    to: string;
  }>;
};

const homeContextRedirectAnswer =
  "I couldn't find a clear connection between that question and your appointments, notes, or Health Focus. Try asking about appointments, providers, follow-ups, symptoms, or Health Focus topics.";

const homeContextIntentCategories = new Set<HomeContextIntentCategory>([
  "care_planning",
  "care_story",
  "health_focus",
  "out_of_scope",
  "personal_care_history",
  "provider_context",
]);

const homeContextSourceTypes = new Set<HomeContextSourceType>([
  "appointments",
  "careprep",
  "health_focus",
  "notes",
  "providers",
]);

const homeContextLevels = new Set<HomeContextLevel>([
  "appointment",
  "careprep",
  "global",
  "home",
  "health_focus",
  "visit_note",
]);

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return String(error || "Something went wrong.");
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && "text" in item) {
        return String(item.text);
      }

      return "";
    })
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function cleanText(value: string | null | undefined, maxLength = 280) {
  const cleaned = (value ?? "").replace(/\s+/g, " ").trim();

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}...`;
}

function responseText(response: JsonObject): string {
  return openAiResponseText(response);
}

function parseOpenAiJson(response: JsonObject): JsonObject {
  const text = responseText(response);

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as JsonObject;
  } catch {
    return { answer: text };
  }
}

function parseIntent(value: JsonObject): HomeContextIntent {
  const category =
    typeof value.category === "string" &&
    homeContextIntentCategories.has(value.category as HomeContextIntentCategory)
      ? (value.category as HomeContextIntentCategory)
      : "out_of_scope";
  const confidence =
    typeof value.confidence === "number" && Number.isFinite(value.confidence)
      ? Math.max(0, Math.min(1, value.confidence))
      : 0;
  const sourceTypes = Array.isArray(value.source_types)
    ? value.source_types.filter((sourceType): sourceType is HomeContextSourceType => {
        return (
          typeof sourceType === "string" &&
          homeContextSourceTypes.has(sourceType as HomeContextSourceType)
        );
      })
    : [];

  return {
    category,
    confidence,
    rationale: cleanText(
      typeof value.rationale === "string" ? value.rationale : "",
      240
    ),
    sourceTypes,
  };
}

function cleanOptionalId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseVisibleItems(value: unknown): HomeContextVisibleItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): HomeContextVisibleItem | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const rawItem = item as Record<string, unknown>;
      const label = cleanText(
        typeof rawItem.label === "string" ? rawItem.label : "",
        120
      );
      const type =
        typeof rawItem.type === "string" &&
        ["appointment", "careprep", "health_focus", "provider", "visit_note"].includes(
          rawItem.type
        )
          ? (rawItem.type as HomeContextVisibleItem["type"])
          : null;

      if (!label || !type) {
        return null;
      }

      const metadata =
        rawItem.metadata && typeof rawItem.metadata === "object"
          ? Object.fromEntries(
              Object.entries(rawItem.metadata as Record<string, unknown>)
                .map(([key, metadataValue]) => [
                  key,
                  typeof metadataValue === "string"
                    ? cleanText(metadataValue, 120)
                    : null,
                ])
                .filter(([, metadataValue]) => Boolean(metadataValue))
            )
          : {};

      return {
        date: cleanOptionalId(rawItem.date),
        id: cleanOptionalId(rawItem.id),
        label,
        metadata,
        type,
      };
    })
    .filter((item): item is HomeContextVisibleItem => Boolean(item))
    .slice(0, 12);
}

function parseConversationTurns(value: unknown): HomeContextConversationTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((turn): HomeContextConversationTurn | null => {
      if (!turn || typeof turn !== "object") {
        return null;
      }

      const rawTurn = turn as Record<string, unknown>;
      const question = cleanText(
        typeof rawTurn.question === "string" ? rawTurn.question : "",
        180
      );
      const answer = cleanText(
        typeof rawTurn.answer === "string" ? rawTurn.answer : "",
        500
      );

      if (!question || !answer) {
        return null;
      }

      return { answer, question };
    })
    .filter((turn): turn is HomeContextConversationTurn => Boolean(turn))
    .slice(-4);
}

function parseAskContext(value: unknown): HomeContextAskContext {
  if (!value || typeof value !== "object") {
    return {
      conversationMode: null,
      conversationTurns: [],
      level: "global",
      sourceIds: [],
      visibleItems: [],
    };
  }

  const rawContext = value as Record<string, unknown>;
  const level =
    typeof rawContext.level === "string" &&
    homeContextLevels.has(rawContext.level as HomeContextLevel)
      ? (rawContext.level as HomeContextLevel)
      : "global";
  const sourceIds = Array.isArray(rawContext.sourceIds)
    ? rawContext.sourceIds
        .map((sourceId) => cleanOptionalId(sourceId))
        .filter((sourceId): sourceId is string => Boolean(sourceId))
        .slice(0, 30)
    : [];

  return {
    appointmentId: cleanOptionalId(rawContext.appointmentId),
    careprepId: cleanOptionalId(rawContext.careprepId),
    careSubjectId: cleanOptionalId(rawContext.careSubjectId),
    conversationMode:
      rawContext.conversationMode === "correction" ||
      rawContext.conversationMode === "follow_up"
        ? rawContext.conversationMode
        : null,
    conversationTurns: parseConversationTurns(rawContext.conversationTurns),
    level,
    noteId: cleanOptionalId(rawContext.noteId),
    sourceIds,
    topicId: cleanOptionalId(rawContext.topicId),
    topicName:
      typeof rawContext.topicName === "string"
        ? cleanText(rawContext.topicName, 80)
        : null,
    visibleItems: parseVisibleItems(rawContext.visibleItems),
  };
}

const shorthandExpansions: Array<{
  pattern: RegExp;
  phrase: string;
  replacement: string;
}> = [
  { pattern: /\bbp\b/gi, phrase: "bp", replacement: "blood pressure" },
  {
    pattern: /\bpt\b/gi,
    phrase: "pt",
    replacement: "physical therapy",
  },
  {
    pattern: /\bpcp\b/gi,
    phrase: "pcp",
    replacement: "primary care",
  },
  {
    pattern: /\bcardio\b/gi,
    phrase: "cardio",
    replacement: "cardiology",
  },
  { pattern: /\bneuro\b/gi, phrase: "neuro", replacement: "neurology" },
  {
    pattern: /\bortho\b/gi,
    phrase: "ortho",
    replacement: "orthopedics",
  },
  {
    pattern: /\bderm\b/gi,
    phrase: "derm",
    replacement: "dermatology",
  },
  {
    pattern: /\blabs\b/gi,
    phrase: "labs",
    replacement: "lab results blood work",
  },
  {
    pattern: /\bblood\b/gi,
    phrase: "blood",
    replacement: "blood pressure blood work lab results",
  },
  {
    pattern: /\brx\b/gi,
    phrase: "rx",
    replacement: "medication",
  },
  {
    pattern: /\bmeds\b/gi,
    phrase: "meds",
    replacement: "medication",
  },
  {
    pattern: /\bappt(s)?\b/gi,
    phrase: "appt",
    replacement: "appointment",
  },
  {
    pattern: /\bdoc\b/gi,
    phrase: "doc",
    replacement: "doctor provider",
  },
  {
    pattern: /\bdr\b/gi,
    phrase: "dr",
    replacement: "doctor provider",
  },
  {
    pattern: /\bvet\b/gi,
    phrase: "vet",
    replacement: "veterinarian pet appointment",
  },
  {
    pattern: /\bdental\b/gi,
    phrase: "dental",
    replacement: "dental dentist oral health",
  },
  {
    pattern: /\btax\b/gi,
    phrase: "tax",
    replacement: "tax appointment tax provider",
  },
];

function interpretQuestion(
  question: string,
  askContext: HomeContextAskContext
): HomeContextQueryInterpretation {
  const compactQuestion = question.replace(/[?!.]+/g, " ").trim();
  const words = compactQuestion.split(/\s+/).filter(Boolean);
  const termExpansions: HomeContextQueryInterpretation["termExpansions"] = [];
  let normalizedQuery = ` ${question} `;

  shorthandExpansions.forEach(({ pattern, phrase, replacement }) => {
    pattern.lastIndex = 0;

    if (!pattern.test(question)) {
      return;
    }

    termExpansions.push({ from: phrase, to: replacement });
    normalizedQuery = normalizedQuery.replace(pattern, replacement);
  });

  normalizedQuery = cleanText(normalizedQuery, 260);

  const relationshipLike =
    /\b(related|connected|linked|tied|associated|appears with|shows up with|goes with|what else|about|re:|regarding)\b/i.test(
      normalizedQuery
    ) ||
    (words.length <= 3 &&
      askContext.level === "health_focus" &&
      Boolean(askContext.topicName));
  const appointmentCountLike =
    /\b(how many|count|any|upcoming|past)\b/i.test(normalizedQuery) &&
    isAppointmentDataQuestion(normalizedQuery);
  const preparationLike =
    /\b(bring|prep|prepare|need|questions? for|ask (the )?(doctor|provider)|next appointment)\b/i.test(
      normalizedQuery
    );
  const recentChangeLike =
    /\b(changed|change|new|recent|recently|since last|last time)\b/i.test(
      normalizedQuery
    );
  const entityOnlyLike =
    words.length <= 3 &&
    (termExpansions.length > 0 ||
      isAppointmentDataQuestion(normalizedQuery) ||
      /\b(pain|sleep|fatigue|dizziness|headache|cholesterol|nutrition|weight|therapy|asthma|breathing)\b/i.test(
        normalizedQuery
      ));
  let queryShape: HomeContextQueryShape = "unknown";

  if (appointmentCountLike) {
    queryShape = "appointment_count";
  } else if (relationshipLike) {
    queryShape = "relationship";
  } else if (preparationLike) {
    queryShape = "preparation";
  } else if (recentChangeLike) {
    queryShape = "recent_change";
  } else if (entityOnlyLike) {
    queryShape = "entity_only";
  }

  return {
    isShortQuery: words.length <= 4,
    normalizedQuery,
    queryShape,
    termExpansions: Array.from(
      new Map(
        termExpansions.map((expansion) => [
          `${expansion.from}:${expansion.to}`,
          expansion,
        ])
      ).values()
    ),
  };
}

function fallbackIntentForQuestion(
  question: string,
  queryInterpretation: HomeContextQueryInterpretation
): HomeContextIntent {
  const normalizedQuestion = queryInterpretation.normalizedQuery.toLowerCase();
  const sourceTypes = new Set<HomeContextSourceType>(["appointments"]);
  let category: HomeContextIntentCategory = "out_of_scope";
  let confidence = 0.2;

  if (
    isAppointmentDataQuestion(queryInterpretation.normalizedQuery) ||
    queryInterpretation.queryShape === "appointment_count"
  ) {
    category = "personal_care_history";
    confidence = 0.8;
    sourceTypes.add("providers");
  }

  if (queryInterpretation.queryShape === "relationship") {
    category = "care_story";
    confidence = 0.75;
    sourceTypes.add("health_focus");
    sourceTypes.add("notes");
    sourceTypes.add("providers");
  }

  if (queryInterpretation.queryShape === "preparation") {
    category = "care_planning";
    confidence = 0.75;
    sourceTypes.add("careprep");
    sourceTypes.add("notes");
    sourceTypes.add("providers");
  }

  if (queryInterpretation.queryShape === "recent_change") {
    category = "personal_care_history";
    confidence = 0.75;
    sourceTypes.add("health_focus");
    sourceTypes.add("notes");
  }

  if (
    /\b(knee|pain|blood pressure|cholesterol|asthma|breathing|symptom|health focus|fatigue|sleep|dizziness|therapy|diagnosis|condition|topic|history|changed|recently|trend|timeline)\b/.test(
      normalizedQuestion
    )
  ) {
    category = "health_focus";
    confidence = 0.75;
    sourceTypes.add("health_focus");
    sourceTypes.add("notes");
  }

  if (
    /\b(follow[- ]?up|next|bring|ask|prepare|appointment|careprep|care prep|attention)\b/.test(
      normalizedQuestion
    )
  ) {
    category = "care_planning";
    confidence = 0.75;
    sourceTypes.add("careprep");
    sourceTypes.add("notes");
  }

  if (/\b(provider|doctor|practice|specialist|who|discussed)\b/.test(normalizedQuestion)) {
    category = "provider_context";
    confidence = 0.75;
    sourceTypes.add("providers");
    sourceTypes.add("notes");
  }

  if (/\b(biggest|important|connect|related|story|concern)\b/.test(normalizedQuestion)) {
    category = "care_story";
    confidence = 0.7;
    sourceTypes.add("health_focus");
    sourceTypes.add("notes");
  }

  return {
    category,
    confidence,
    rationale: "Fallback keyword classification.",
    sourceTypes: Array.from(sourceTypes),
  };
}

function hasAmbiguousGlobalReference(question: string) {
  return /\b(this|that)\s+(issue|topic|concern|story|visit|appointment)\b/i.test(
    question
  );
}

function isAppointmentDataQuestion(question: string) {
  return /\b(appt|appts|appointment|appointments|visit|visits|exam|exams|consult|consultation|follow[- ]?up|provider|doctor|practice|clinic|advisory|dentist|dental|vet|veterinary|tax|upcoming|past|scheduled)\b/i.test(
    question
  );
}

function applyAskContextToIntent(
  intent: HomeContextIntent,
  askContext: HomeContextAskContext,
  question: string,
  queryInterpretation: HomeContextQueryInterpretation
): HomeContextIntent {
  const sourceTypes = new Set(intent.sourceTypes);
  let category = intent.category;
  let confidence = intent.confidence;
  const isAppointmentQuestion =
    isAppointmentDataQuestion(question) ||
    isAppointmentDataQuestion(queryInterpretation.normalizedQuery) ||
    queryInterpretation.queryShape === "appointment_count";
  const isLikelyCarePlandShortQuery =
    queryInterpretation.isShortQuery &&
    (queryInterpretation.termExpansions.length > 0 ||
      queryInterpretation.queryShape !== "unknown");
  const hasConversationContext = askContext.conversationTurns.length > 0;

  if (hasConversationContext && queryInterpretation.isShortQuery) {
    if (category === "out_of_scope" || confidence < 0.5) {
      category =
        askContext.conversationMode === "correction"
          ? "care_story"
          : "personal_care_history";
      confidence = 0.75;
    }

    sourceTypes.add("appointments");
    sourceTypes.add("careprep");
    sourceTypes.add("health_focus");
    sourceTypes.add("notes");
    sourceTypes.add("providers");
  }

  if (isAppointmentQuestion) {
    if (category === "out_of_scope" || confidence < 0.5) {
      category = "personal_care_history";
      confidence = 0.8;
    }

    sourceTypes.add("appointments");
    sourceTypes.add("providers");
  }

  if (queryInterpretation.queryShape === "relationship") {
    if (category === "out_of_scope" || confidence < 0.5) {
      category = "care_story";
      confidence = 0.75;
    }

    sourceTypes.add("appointments");
    sourceTypes.add("health_focus");
    sourceTypes.add("notes");
    sourceTypes.add("providers");
  }

  if (queryInterpretation.queryShape === "entity_only") {
    if (category === "out_of_scope" || confidence < 0.5) {
      category = isAppointmentQuestion ? "personal_care_history" : "health_focus";
      confidence = 0.7;
    }

    sourceTypes.add("appointments");
    sourceTypes.add("health_focus");
    sourceTypes.add("notes");
    sourceTypes.add("providers");
  }

  if (queryInterpretation.queryShape === "preparation") {
    if (category === "out_of_scope" || confidence < 0.5) {
      category = "care_planning";
      confidence = 0.75;
    }

    sourceTypes.add("appointments");
    sourceTypes.add("careprep");
    sourceTypes.add("notes");
    sourceTypes.add("providers");
  }

  if (queryInterpretation.queryShape === "recent_change") {
    if (category === "out_of_scope" || confidence < 0.5) {
      category = "personal_care_history";
      confidence = 0.75;
    }

    sourceTypes.add("appointments");
    sourceTypes.add("careprep");
    sourceTypes.add("health_focus");
    sourceTypes.add("notes");
  }

  if (isLikelyCarePlandShortQuery && category === "out_of_scope") {
    category = "personal_care_history";
    confidence = 0.65;
    sourceTypes.add("appointments");
    sourceTypes.add("health_focus");
    sourceTypes.add("providers");
  }

  if (askContext.level === "health_focus") {
    if (category === "out_of_scope" || confidence < 0.5) {
      category = "health_focus";
      confidence = 0.75;
    }

    sourceTypes.add("appointments");
    sourceTypes.add("health_focus");
    sourceTypes.add("notes");

    if (/\b(provider|doctor|practice|specialist|who|discussed)\b/i.test(question)) {
      sourceTypes.add("providers");
    }
  }

  if (askContext.level === "home" && category !== "out_of_scope") {
    sourceTypes.add("appointments");
    sourceTypes.add("providers");
  }

  if (askContext.level === "appointment") {
    if (category === "out_of_scope" || confidence < 0.5) {
      category = "personal_care_history";
      confidence = 0.75;
    }

    sourceTypes.add("appointments");
    sourceTypes.add("providers");
    sourceTypes.add("notes");
    sourceTypes.add("careprep");
  }

  if (askContext.level === "careprep") {
    if (category === "out_of_scope" || confidence < 0.5) {
      category = "care_planning";
      confidence = 0.75;
    }

    sourceTypes.add("appointments");
    sourceTypes.add("careprep");
  }

  if (askContext.level === "visit_note") {
    if (category === "out_of_scope" || confidence < 0.5) {
      category = "personal_care_history";
      confidence = 0.75;
    }

    sourceTypes.add("appointments");
    sourceTypes.add("notes");
  }

  return {
    ...intent,
    category,
    confidence,
    sourceTypes: Array.from(sourceTypes),
  };
}

function displayNameFromSlug(slug: string) {
  return slug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function appointmentDateLabel(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!openAiApiKey) {
      throw new Error("Missing OPENAI_API_KEY in environment variables.");
    }

    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      throw new Error("Please sign in before asking for more context.");
    }

    const body = (await request.json().catch(() => ({}))) as {
      askContext?: unknown;
      careSubjectId?: string;
      question?: string;
    };
    const question = cleanText(body.question, 240);
    const askContext = parseAskContext(body.askContext);
    const queryInterpretation = interpretQuestion(question, askContext);
    const careSubjectId =
      body.careSubjectId?.trim() || askContext.careSubjectId || "";

    if (!question) {
      throw new Error("Ask a question about your saved CarePland records.");
    }

    const userClient = createSupabaseUserClient(accessToken);
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!userData.user?.id) {
      throw new Error("Please sign in before asking for more context.");
    }

    const { data: membershipRows, error: membershipError } = await userClient
      .from("care_circle_memberships")
      .select("care_circle_id")
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .order("created_at")
      .limit(1);

    if (membershipError) {
      throw membershipError;
    }

    const careCircleId =
      ((membershipRows ?? []) as CareCircleMembershipRow[])[0]?.care_circle_id ??
      null;
    const classifierInstructionVersion = await loadHomeContextInstructionVersion({
      careCircleId,
      promptKey: "home_context_intent_classifier",
      supabase: userClient,
    });
    const answerInstructionVersion = await loadHomeContextInstructionVersion({
      careCircleId,
      promptKey: "home_context_answer",
      supabase: userClient,
    });
    const classifierSchema =
      classifierInstructionVersion?.output_schema ??
      homeContextClassifierDefaultSchema;
    const classifierSystemPrompt =
      classifierInstructionVersion?.system_prompt?.trim() ||
      homeContextClassifierDefaultSystemPrompt;
    const classifierPromptTemplate =
      classifierInstructionVersion?.user_prompt_template?.trim() ||
      homeContextClassifierDefaultUserPrompt;
    const classifierModel = classifierInstructionVersion?.model ?? "gpt-4.1-mini";
    const classifierResponse = await runOpenAiResponse({
      apiKey: openAiApiKey,
      input: [
        {
          content: classifierSystemPrompt,
          role: "system",
        },
        {
          content: [
            `Instruction template:\n${classifierPromptTemplate}`,
            `Ask context:\n${JSON.stringify(askContext, null, 2)}`,
            `Query interpretation:\n${JSON.stringify(
              queryInterpretation,
              null,
              2
            )}`,
            `Question:\n${question}`,
          ].join("\n\n"),
          role: "user",
        },
      ],
      model: classifierModel,
      temperature: classifierInstructionVersion?.temperature ?? 0,
      text: {
        format: {
          name: "home_context_intent_classifier",
          schema: classifierSchema,
          strict: false,
          type: "json_schema",
        },
      },
    });
    const classifierJson = classifierResponse.json;
    if (classifierResponse.ok) {
      await logOpenAiOperationCost({
        careCircleId,
        metadata: { context_level: askContext.level },
        model: classifierModel,
        openAiJson: classifierJson,
        operationKey: "home_context_intent_classifier",
        operationLabel: "Home context intent classifier",
        promptVersion: homeContextPromptVersionLabel(
          "home_context_intent_classifier",
          classifierInstructionVersion
        ),
        providerRequestId: classifierResponse.requestId,
        supabase: userClient,
        userId: userData.user.id,
      });
    }
    const intent = applyAskContextToIntent(
      classifierResponse.ok
        ? parseIntent(parseOpenAiJson(classifierJson))
        : fallbackIntentForQuestion(question, queryInterpretation),
      askContext,
      question,
      queryInterpretation
    );

    const isAppointmentQuestion =
      isAppointmentDataQuestion(question) ||
      isAppointmentDataQuestion(queryInterpretation.normalizedQuery) ||
      queryInterpretation.queryShape === "appointment_count";

    if (
      ((askContext.level === "global" || askContext.level === "home") &&
        askContext.visibleItems.length === 0 &&
        askContext.conversationTurns.length === 0 &&
        !isAppointmentQuestion &&
        queryInterpretation.queryShape === "unknown" &&
        hasAmbiguousGlobalReference(question)) ||
      intent.category === "out_of_scope" ||
      intent.confidence < 0.5
    ) {
      return NextResponse.json({
        answer:
          queryInterpretation.isShortQuery ||
          queryInterpretation.termExpansions.length > 0
            ? `I couldn't find anything in your CarePland records related to "${question}". You can ask about appointments, providers, notes, follow-ups, or Health Focus topics.`
            : homeContextRedirectAnswer,
        intent,
        ok: true,
        promptVersion: homeContextPromptVersionLabel(
          "home_context_intent_classifier",
          classifierInstructionVersion
        ),
      });
    }
    const sourceTypes = new Set(intent.sourceTypes);
    const includeCarePrep = sourceTypes.has("careprep");
    const includeHealthFocus = sourceTypes.has("health_focus");
    const includeNotes = sourceTypes.has("notes");
    const includeProviders = sourceTypes.has("providers");
    const includeAppointments =
      sourceTypes.has("appointments") ||
      includeCarePrep ||
      includeNotes ||
      includeProviders ||
      sourceTypes.size === 0;

    let appointmentsQuery = userClient
      .from("appointments")
      .select(
        "id,care_subject_id,title,reason,starts_at,status,provider_name,provider_organization,location_name"
      )
      .is("deleted_at", null)
      .order("starts_at", { ascending: false, nullsFirst: false })
      .limit(isAppointmentQuestion ? 80 : 40);
    let topicMentionsQuery = userClient
      .from("topic_mentions")
      .select(
        "appointment_id,appointment_starts_at,normalized_topic_slug,provider_name,provider_organization,source_snippet,status"
      )
      .eq("is_active", true)
      .order("appointment_starts_at", { ascending: false, nullsFirst: false })
      .limit(includeHealthFocus ? 80 : 20);

    if (careSubjectId) {
      appointmentsQuery = appointmentsQuery.eq("care_subject_id", careSubjectId);
      topicMentionsQuery = topicMentionsQuery.eq("care_subject_id", careSubjectId);
    }

    if (askContext.appointmentId) {
      appointmentsQuery = appointmentsQuery.eq("id", askContext.appointmentId);
      topicMentionsQuery = topicMentionsQuery.eq(
        "appointment_id",
        askContext.appointmentId
      );
    } else if (askContext.sourceIds.length > 0) {
      appointmentsQuery = appointmentsQuery.in("id", askContext.sourceIds);
    }

    if (askContext.level === "health_focus" && askContext.topicId) {
      topicMentionsQuery = topicMentionsQuery.eq(
        "normalized_topic_slug",
        askContext.topicId
      );
    }

    const [
      { data: appointmentRows, error: appointmentsError },
      { data: topicRows, error: topicsError },
      { data: mentionRows, error: mentionsError },
    ] = await Promise.all([
      includeAppointments
        ? appointmentsQuery
        : Promise.resolve({ data: [], error: null }),
      includeHealthFocus || includeProviders
        ? userClient
            .from("health_topics")
            .select("slug,display_name")
            .eq("is_active", true)
        : Promise.resolve({ data: [], error: null }),
      includeHealthFocus || includeProviders
        ? topicMentionsQuery
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (appointmentsError) {
      throw appointmentsError;
    }

    if (topicsError) {
      throw topicsError;
    }

    if (mentionsError) {
      throw mentionsError;
    }

    const appointments = (appointmentRows ?? []) as AppointmentRow[];
    const appointmentIds = appointments.map((appointment) => appointment.id);
    const appointmentIdsForQuery = appointmentIds.slice(0, 30);
    const [
      { data: noteRows, error: notesError },
      { data: carePrepRows, error: carePrepError },
    ] =
      appointmentIdsForQuery.length > 0
        ? await Promise.all([
            includeNotes
              ? userClient
                  .from("appointment_notes")
                  .select(
                    "appointment_id,input_text,summary_short,takeaways,followups"
                  )
                  .in("appointment_id", appointmentIdsForQuery)
                  .eq("is_current", true)
                  .limit(30)
              : Promise.resolve({ data: [], error: null }),
            includeCarePrep
              ? userClient
                  .from("careprep_guidance")
                  .select(
                    "appointment_id,summary,key_questions,bring_list,watchouts,since_last_visit,next_steps"
                  )
                  .in("appointment_id", appointmentIdsForQuery)
                  .eq("is_current", true)
                  .limit(20)
              : Promise.resolve({ data: [], error: null }),
          ])
        : [
            { data: [], error: null },
            { data: [], error: null },
          ];

    if (notesError) {
      throw notesError;
    }

    if (carePrepError) {
      throw carePrepError;
    }

    const topicNamesBySlug = new Map(
      ((topicRows ?? []) as HealthTopicRow[]).map((topic) => [
        topic.slug,
        topic.display_name,
      ])
    );
    const notesByAppointmentId = new Map(
      ((noteRows ?? []) as AppointmentNoteRow[]).map((note) => [
        note.appointment_id,
        note,
      ])
    );
    const carePrepByAppointmentId = new Map(
      ((carePrepRows ?? []) as CarePrepRow[]).map((carePrep) => [
        carePrep.appointment_id,
        carePrep,
      ])
    );
    const topicSummaries = new Map<
      string,
      {
        displayName: string;
        latestDate: string;
        providers: Set<string>;
        snippets: string[];
        statuses: Set<string>;
        visitCount: number;
      }
    >();

    ((mentionRows ?? []) as TopicMentionRow[]).forEach((mention) => {
      const topicSlug = mention.normalized_topic_slug;
      const current =
        topicSummaries.get(topicSlug) ??
        ({
          displayName:
            topicNamesBySlug.get(topicSlug) ?? displayNameFromSlug(topicSlug),
          latestDate: appointmentDateLabel(mention.appointment_starts_at),
          providers: new Set<string>(),
          snippets: [],
          statuses: new Set<string>(),
          visitCount: 0,
        } satisfies {
          displayName: string;
          latestDate: string;
          providers: Set<string>;
          snippets: string[];
          statuses: Set<string>;
          visitCount: number;
        });

      current.visitCount += 1;

      const provider =
        mention.provider_organization?.trim() || mention.provider_name?.trim();

      if (provider) {
        current.providers.add(provider);
      }

      if (mention.status) {
        current.statuses.add(mention.status);
      }

      if (mention.source_snippet && current.snippets.length < 3) {
        current.snippets.push(cleanText(mention.source_snippet, 160));
      }

      topicSummaries.set(topicSlug, current);
    });

    const appointmentContext = appointments.slice(0, 30).map((appointment) => {
        const note = notesByAppointmentId.get(appointment.id);
        const carePrep = carePrepByAppointmentId.get(appointment.id);

        return {
          carePrep: includeCarePrep && carePrep
            ? {
                ask: asTextList(carePrep.key_questions),
                bring: asTextList(carePrep.bring_list),
                nextSteps: asTextList(carePrep.next_steps),
                sinceLastVisit: asTextList(carePrep.since_last_visit),
                summary: cleanText(carePrep.summary, 220),
                watch: asTextList(carePrep.watchouts),
              }
            : null,
          date: appointmentDateLabel(appointment.starts_at),
          note: includeNotes && note
            ? {
                followups: asTextList(note.followups),
                rawExcerpt: cleanText(note.input_text, 220),
                summary: cleanText(note.summary_short, 220),
                takeaways: asTextList(note.takeaways),
              }
            : null,
          provider:
            includeProviders || includeAppointments
              ? appointment.provider_organization?.trim() ||
                appointment.provider_name?.trim() ||
                ""
              : "",
          reason: cleanText(appointment.reason, 160),
          status: appointment.status,
          title: cleanText(appointment.title, 140),
        };
      });
    const healthFocusContext = Array.from(topicSummaries.values())
        .sort((left, right) => right.visitCount - left.visitCount)
        .slice(0, 12)
        .map((topic) => ({
          latest: topic.latestDate,
          name: topic.displayName,
          providers: Array.from(topic.providers).slice(0, 4),
          snippets: topic.snippets,
          statuses: Array.from(topic.statuses),
          visits: topic.visitCount,
        }));
    const selectedContextCount =
      askContext.visibleItems.length +
      appointmentContext.length +
      (includeNotes ? notesByAppointmentId.size : 0) +
      (includeCarePrep ? carePrepByAppointmentId.size : 0) +
      (includeHealthFocus ? healthFocusContext.length : 0);

    if (selectedContextCount === 0) {
      return NextResponse.json({
        answer: isAppointmentQuestion
          ? "I couldn't find matching appointments in your CarePland records. You can also ask about providers, notes, follow-ups, or Health Focus topics."
          : homeContextRedirectAnswer,
        intent,
        ok: true,
        promptVersion: homeContextPromptVersionLabel(
          "home_context_intent_classifier",
          classifierInstructionVersion
        ),
      });
    }

    const context = {
      appointments: includeAppointments ? appointmentContext : [],
      askContext,
      carePrepAvailable: includeCarePrep,
      healthFocus: includeHealthFocus ? healthFocusContext : [],
      intent,
      notesAvailable: includeNotes,
      providerContextRequested: includeProviders,
      queryInterpretation,
      visibleItems: askContext.visibleItems,
    };

    const schema =
      answerInstructionVersion?.output_schema ?? homeContextDefaultSchema;
    const systemPrompt =
      answerInstructionVersion?.system_prompt?.trim() ||
      homeContextDefaultSystemPrompt;
    const promptTemplate =
      answerInstructionVersion?.user_prompt_template?.trim() ||
      homeContextDefaultUserPrompt;
    const userPrompt = [
      `Instruction template:\n${promptTemplate}`,
      `Question:\n${question}`,
      `Query interpretation:\n${JSON.stringify(queryInterpretation, null, 2)}`,
      `CarePland context:\n${JSON.stringify(context, null, 2)}`,
    ].join("\n\n");
    const answerModel = answerInstructionVersion?.model ?? "gpt-4.1-mini";
    const openAiResponse = await runOpenAiResponse({
      apiKey: openAiApiKey,
      input: [
        {
          content: systemPrompt,
          role: "system",
        },
        {
          content: userPrompt,
          role: "user",
        },
      ],
      model: answerModel,
      temperature: answerInstructionVersion?.temperature ?? 0.2,
      text: {
        format: {
          name: "home_context_answer",
          schema,
          strict: false,
          type: "json_schema",
        },
      },
    });
    const openAiJson = openAiResponse.json;

    if (!openAiResponse.ok) {
      const apiError =
        openAiJson.error && typeof openAiJson.error === "object"
          ? (openAiJson.error as { message?: string }).message
          : "";
      throw new Error(apiError || "CarePland could not answer that yet.");
    }

    const parsed = parseOpenAiJson(openAiJson);
    const answer = cleanText(String(parsed.answer ?? ""), 900);

    if (!answer) {
      throw new Error("CarePland could not answer that yet.");
    }

    await logOpenAiOperationCost({
      careCircleId,
      metadata: {
        context_level: askContext.level,
        intent_category: intent.category,
      },
      model: answerModel,
      openAiJson,
      operationKey: "home_context_answer",
      operationLabel: "Home context answer",
      promptVersion: homeContextPromptVersionLabel(
        "home_context_answer",
        answerInstructionVersion
      ),
      providerRequestId: openAiResponse.requestId,
      supabase: userClient,
      userId: userData.user.id,
    });

    return NextResponse.json({
      answer,
      intent,
      ok: true,
      promptVersion: homeContextPromptVersionLabel(
        "home_context_answer",
        answerInstructionVersion
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error), ok: false },
      { status: 400 }
    );
  }
}
