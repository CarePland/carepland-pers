import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConnectMessageRecord } from "@/app/lib/connect/messaging";
import type { ConnectPersonScopedAccess } from "@/app/lib/connect/context/server/personScopedAccess";
import { mergeWhatToKnowCategoryItems } from "./whatToKnow";

export const appointmentCommunicationSummaryPromptKey =
  "appointment_communication_summary";

export const appointmentCommunicationSummaryModelVersion =
  "deterministic_v1";

export const appointmentCommunicationSummaryCategories = [
  "bring_list",
  "key_questions",
  "watchouts",
  "med_review",
  "since_last_visit",
  "next_steps",
] as const;

export const appointmentCommunicationSummaryOutputSchema = {
  additionalProperties: false,
  properties: {
    action: { enum: ["NO_CHANGE", "UPDATED"], type: "string" },
    inventory: {
      additionalProperties: false,
      properties: {
        items: {
          items: {
            additionalProperties: false,
            properties: {
              category: { enum: [...appointmentCommunicationSummaryCategories], type: "string" },
              id: { type: "string" },
              sourceDisplayNames: { items: { type: "string" }, type: "array" },
              sourceMessageIds: { items: { type: "string" }, type: "array" },
              sourceType: { const: "communication", type: "string" },
              status: { enum: ["active", "resolved"], type: "string" },
              text: { maxLength: 180, minLength: 1, type: "string" },
            },
            required: ["id", "category", "text", "sourceType", "sourceMessageIds", "status"],
            type: "object",
          },
          type: "array",
        },
      },
      required: ["items"],
      type: "object",
    },
  },
  required: ["action", "inventory"],
  type: "object",
} as const;

export type AppointmentCommunicationSummaryCategory =
  (typeof appointmentCommunicationSummaryCategories)[number];

export type AppointmentCommunicationSummaryItem = {
  id: string;
  category: AppointmentCommunicationSummaryCategory;
  text: string;
  sourceType: "communication";
  sourceDisplayNames?: string[];
  sourceMessageIds: string[];
  createdAt: string;
  updatedAt: string;
  status: "active" | "resolved";
};

export type AppointmentCommunicationInventory = {
  items: AppointmentCommunicationSummaryItem[];
};

export type AppointmentCommunicationSummaryDecision =
  | {
      action: "NO_CHANGE";
      inventory: AppointmentCommunicationInventory;
      trace: AppointmentCommunicationDecisionTrace;
    }
  | {
      action: "UPDATED";
      inventory: AppointmentCommunicationInventory;
      trace: AppointmentCommunicationDecisionTrace;
    };

export type AppointmentCommunicationDecisionTrace = {
  layer: "appointment_communication_summary";
  useCase: "appointment_communication_summary";
  version: string;
  messageId: string;
  appointmentId: string;
  category?: AppointmentCommunicationSummaryCategory;
  matchedRule: string;
  rationale: string;
};

type SummaryRow = {
  id?: string;
  summary_items?: unknown;
  summary_version?: number | null;
  last_processed_message_id?: string | null;
};

type MessageRow = {
  id: string;
  appointment_id: string | null;
  body: string | null;
  transcript: string | null;
  metadata?: Record<string, unknown> | null;
  recipient_display_name?: string | null;
  sender_display_name?: string | null;
  sender_role?: string | null;
  created_at: string;
  main_connect_user_person_id: string;
};

const trivialMessagePattern =
  /^(?:ok|okay|k|kk|thanks|thank you|thx|got it|sounds good|will do|👍|👌|yes|yep|no problem|sure)\.?$/i;

const categoryRules: Array<{
  category: AppointmentCommunicationSummaryCategory;
  pattern: RegExp;
  cleanup: (message: string) => string;
  rule: string;
}> = [
  {
    category: "bring_list",
    pattern: /\b(bring|take|pack|carry|remember to bring)\b/i,
    cleanup: cleanBringText,
    rule: "bring_request",
  },
  {
    category: "key_questions",
    pattern: /\b(ask|question|whether|find out|check if|ask about)\b/i,
    cleanup: cleanAskText,
    rule: "question_or_ask_request",
  },
  {
    category: "watchouts",
    pattern: /\b(dizzy|dizziness|rash|pain|headache|symptom|watch|worse|since|started|new )\b/i,
    cleanup: cleanWatchText,
    rule: "symptom_or_watch_item",
  },
  {
    category: "med_review",
    pattern: /\b(medication|medicine|meds|rx|dose|dosage|insulin|prescription)\b/i,
    cleanup: cleanMedicationText,
    rule: "medication_review_item",
  },
  {
    category: "next_steps",
    pattern: /\b(follow up|schedule|call|portal|appointment moved|rescheduled|downtown|office|fast|fasting)\b/i,
    cleanup: cleanNextStepText,
    rule: "logistics_or_next_step",
  },
];

export function emptyAppointmentCommunicationInventory(): AppointmentCommunicationInventory {
  return { items: [] };
}

export function normalizeAppointmentCommunicationInventory(
  value: unknown
): AppointmentCommunicationInventory {
  const rawItems = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : [];
  const seenIds = new Set<string>();
  const items: AppointmentCommunicationSummaryItem[] = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as Record<string, unknown>;
    const id = cleanText(item.id).slice(0, 80);
    const category = cleanText(item.category) as AppointmentCommunicationSummaryCategory;
    const text = cleanText(item.text).slice(0, 180);
    const sourceMessageIds = Array.isArray(item.sourceMessageIds)
      ? item.sourceMessageIds.map((idValue) => cleanText(idValue)).filter(Boolean)
      : [];
    const sourceDisplayNames = Array.isArray(item.sourceDisplayNames)
      ? Array.from(
          new Set(
            item.sourceDisplayNames
              .map((nameValue) => firstName(cleanText(nameValue)))
              .filter(Boolean)
          )
        )
      : [];
    if (
      !id ||
      seenIds.has(id) ||
      !appointmentCommunicationSummaryCategories.includes(category) ||
      !text ||
      sourceMessageIds.length === 0
    ) {
      continue;
    }
    seenIds.add(id);
    items.push({
      id,
      category,
      text,
      sourceType: "communication",
      sourceDisplayNames,
      sourceMessageIds: Array.from(new Set(sourceMessageIds)),
      createdAt: cleanText(item.createdAt) || new Date(0).toISOString(),
      updatedAt: cleanText(item.updatedAt) || new Date(0).toISOString(),
      status: item.status === "resolved" ? "resolved" : "active",
    });
  }

  return { items };
}

export function evaluateAppointmentCommunicationMessage({
  appointmentId,
  currentInventory,
  message,
  now = new Date().toISOString(),
}: {
  appointmentId: string;
  currentInventory?: AppointmentCommunicationInventory;
  message: Pick<
    ConnectMessageRecord,
    "body" | "createdAt" | "from" | "id" | "metadata" | "senderRole" | "to" | "transcript"
  >;
  now?: string;
}): AppointmentCommunicationSummaryDecision {
  const inventory = normalizeAppointmentCommunicationInventory(
    currentInventory ?? emptyAppointmentCommunicationInventory()
  );
  const messageText = messageTextForAppointmentCommunication(message);
  const baseTrace = {
    appointmentId,
    layer: "appointment_communication_summary" as const,
    messageId: message.id,
    useCase: "appointment_communication_summary" as const,
    version: appointmentCommunicationSummaryModelVersion,
  };

  if (!messageText || trivialMessagePattern.test(messageText)) {
    return {
      action: "NO_CHANGE",
      inventory,
      trace: {
        ...baseTrace,
        matchedRule: "trivial_or_empty_message",
        rationale: "The message does not add appointment knowledge.",
      },
    };
  }

  const rule = categoryRules.find((candidate) => candidate.pattern.test(messageText));
  if (!rule) {
    return {
      action: "NO_CHANGE",
      inventory,
      trace: {
        ...baseTrace,
        matchedRule: "no_supported_category_match",
        rationale: "No existing appointment category could safely hold this message.",
      },
    };
  }

  const text = rule.cleanup(messageText);
  if (!text) {
    return {
      action: "NO_CHANGE",
      inventory,
      trace: {
        ...baseTrace,
        category: rule.category,
        matchedRule: `${rule.rule}_empty_after_cleanup`,
        rationale: "The candidate item was empty after normalization.",
      },
    };
  }

  const normalizedCandidate = normalizeComparableText(text);
  const existingIndex = inventory.items.findIndex(
    (item) =>
      item.status === "active" &&
      item.category === rule.category &&
      areSimilarAppointmentCommunicationItems(item.text, normalizedCandidate)
  );
  const messageCreatedAt = message.createdAt || now;
  const sourceDisplayName = sourceDisplayNameForMessage(message);
  const items = [...inventory.items];

  if (existingIndex >= 0) {
    const existing = items[existingIndex];
    const nextText = chooseRicherItemText(existing.text, text);
    const nextSourceIds = Array.from(
      new Set([...existing.sourceMessageIds, message.id].filter(Boolean))
    );
    const nextSourceDisplayNames = Array.from(
      new Set([...(existing.sourceDisplayNames ?? []), sourceDisplayName].filter(Boolean))
    );
    if (
      existing.text === nextText &&
      existing.sourceMessageIds.includes(message.id) &&
      nextSourceDisplayNames.length === (existing.sourceDisplayNames ?? []).length
    ) {
      return {
        action: "NO_CHANGE",
        inventory,
        trace: {
          ...baseTrace,
          category: rule.category,
          matchedRule: `${rule.rule}_already_processed`,
          rationale: "The item already reflects this message.",
        },
      };
    }
    items[existingIndex] = {
      ...existing,
      sourceDisplayNames: nextSourceDisplayNames,
      sourceMessageIds: nextSourceIds,
      text: nextText,
      updatedAt: now,
    };
  } else {
    items.push({
      id: communicationItemId(rule.category, text),
      category: rule.category,
      text,
      sourceMessageIds: [message.id],
      sourceDisplayNames: sourceDisplayName ? [sourceDisplayName] : [],
      sourceType: "communication",
      createdAt: messageCreatedAt,
      updatedAt: now,
      status: "active",
    });
  }

  return {
    action: "UPDATED",
    inventory: { items },
    trace: {
      ...baseTrace,
      category: rule.category,
      matchedRule: rule.rule,
      rationale: "The message contains appointment-specific knowledge for an existing category.",
    },
  };
}

export function mergeCarePrepAndCommunicationItems(
  carePrepItems: string[],
  communicationItems: AppointmentCommunicationSummaryItem[]
) {
  return mergeWhatToKnowCategoryItems({ carePrepItems, communicationItems });
}

export async function updateAppointmentCommunicationSummaryForMessage(
  supabase: SupabaseClient,
  access: Pick<
    ConnectPersonScopedAccess,
    "careCircleId" | "mainConnectUserPersonId"
  >,
  message: ConnectMessageRecord
) {
  const appointmentId = cleanText(message.appointmentId);
  if (!appointmentId) return null;

  const { data: existingRow, error: existingError } = await supabase
    .from("appointment_communication_summaries")
    .select("id,summary_items,summary_version,last_processed_message_id")
    .eq("appointment_id", appointmentId)
    .eq("care_circle_id", access.careCircleId)
    .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
    .maybeSingle();

  if (existingError) throw existingError;
  const existing = existingRow as SummaryRow | null;
  if (existing?.last_processed_message_id === message.id) {
    return existing;
  }

  const currentInventory = normalizeAppointmentCommunicationInventory(
    existing?.summary_items
  );
  const decision = evaluateAppointmentCommunicationMessage({
    appointmentId,
    currentInventory,
    message,
  });
  const sourceMessageIds = Array.from(
    new Set(decision.inventory.items.flatMap((item) => item.sourceMessageIds))
  );
  const summaryVersion = Math.max(0, existing?.summary_version ?? 0) + 1;
  const status = decision.action === "NO_CHANGE" ? "no_change" : "completed";
  const upsertPayload = {
    appointment_id: appointmentId,
    care_circle_id: access.careCircleId,
    decision_trace: decision.trace,
    generation_status: status,
    last_processed_message_id: message.id,
    last_substantive_message_id:
      decision.action === "UPDATED" ? message.id : null,
    main_connect_user_person_id: access.mainConnectUserPersonId,
    model: appointmentCommunicationSummaryModelVersion,
    prompt_metadata: {
      categories: appointmentCommunicationSummaryCategories,
      promptKey: appointmentCommunicationSummaryPromptKey,
    },
    prompt_version: appointmentCommunicationSummaryPromptKey,
    source_message_ids: sourceMessageIds,
    summary_items: decision.inventory.items,
    summary_version: summaryVersion,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("appointment_communication_summaries")
    .upsert(upsertPayload, { onConflict: "appointment_id" })
    .select("id,appointment_id,generation_status,summary_items,summary_version,last_processed_message_id")
    .single();

  if (error) throw error;
  return data;
}

export async function markAppointmentCommunicationSummaryFailed(
  supabase: SupabaseClient,
  access: Pick<
    ConnectPersonScopedAccess,
    "careCircleId" | "mainConnectUserPersonId"
  >,
  message: ConnectMessageRecord,
  error: unknown
) {
  const appointmentId = cleanText(message.appointmentId);
  if (!appointmentId) return;

  await supabase.from("appointment_communication_summaries").upsert(
    {
      appointment_id: appointmentId,
      care_circle_id: access.careCircleId,
      decision_trace: {
        error: error instanceof Error ? error.message : String(error || "Unknown error"),
        layer: "appointment_communication_summary",
        messageId: message.id,
        useCase: "appointment_communication_summary",
        version: appointmentCommunicationSummaryModelVersion,
      },
      generation_status: "failed",
      main_connect_user_person_id: access.mainConnectUserPersonId,
      model: appointmentCommunicationSummaryModelVersion,
      prompt_version: appointmentCommunicationSummaryPromptKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "appointment_id" }
  );
}

export async function rebuildAppointmentCommunicationSummary(
  supabase: SupabaseClient,
  access: Pick<
    ConnectPersonScopedAccess,
    "careCircleId" | "mainConnectUserPersonId"
  >,
  appointmentId: string
) {
  const { data, error } = await supabase
    .from("connect_messages")
    .select("id,appointment_id,body,transcript,metadata,sender_role,sender_display_name,recipient_display_name,created_at,main_connect_user_person_id")
    .eq("appointment_id", appointmentId)
    .eq("care_circle_id", access.careCircleId)
    .eq("main_connect_user_person_id", access.mainConnectUserPersonId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  let inventory = emptyAppointmentCommunicationInventory();
  let lastProcessedMessageId: string | null = null;
  let lastSubstantiveMessageId: string | null = null;
  let lastTrace: AppointmentCommunicationDecisionTrace | null = null;

  for (const row of (data ?? []) as MessageRow[]) {
    const decision = evaluateAppointmentCommunicationMessage({
      appointmentId,
      currentInventory: inventory,
      message: {
        body: row.body || "",
        createdAt: row.created_at,
        from: row.sender_display_name || "",
        id: row.id,
        metadata: row.metadata ?? {},
        senderRole: row.sender_role || "",
        to: row.recipient_display_name || "",
        transcript: row.transcript || "",
      },
    });
    inventory = decision.inventory;
    lastProcessedMessageId = row.id;
    if (decision.action === "UPDATED") {
      lastSubstantiveMessageId = row.id;
    }
    lastTrace = decision.trace;
  }

  const { data: saved, error: saveError } = await supabase
    .from("appointment_communication_summaries")
    .upsert(
      {
        appointment_id: appointmentId,
        care_circle_id: access.careCircleId,
        decision_trace: lastTrace,
        generation_status: "completed",
        last_processed_message_id: lastProcessedMessageId,
        last_substantive_message_id: lastSubstantiveMessageId,
        main_connect_user_person_id: access.mainConnectUserPersonId,
        model: appointmentCommunicationSummaryModelVersion,
        prompt_metadata: {
          categories: appointmentCommunicationSummaryCategories,
          promptKey: appointmentCommunicationSummaryPromptKey,
          rebuild: true,
        },
        prompt_version: appointmentCommunicationSummaryPromptKey,
        source_message_ids: inventory.items.flatMap((item) => item.sourceMessageIds),
        summary_items: inventory.items,
        summary_version: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "appointment_id" }
    )
    .select("id,appointment_id,generation_status,summary_items,summary_version,last_processed_message_id")
    .single();

  if (saveError) throw saveError;
  return saved;
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function messageTextForAppointmentCommunication(
  message: Pick<ConnectMessageRecord, "body" | "transcript" | "metadata">
) {
  const metadata = message.metadata && typeof message.metadata === "object"
    ? message.metadata
    : {};
  const summaryCandidates = [
    metadata.messagePrepSummary,
    metadata.appointmentSummary,
    metadata.summaryText,
    metadata.summary,
    metadata.condensedDraft,
    metadata.condensedMessage,
  ];

  for (const candidate of summaryCandidates) {
    const text = cleanText(candidate);
    if (text) return text;
  }

  return cleanText(message.body || message.transcript);
}

function sourceDisplayNameForMessage(
  message: Pick<ConnectMessageRecord, "from" | "senderRole" | "to">
) {
  const senderRole = cleanText(message.senderRole).toLowerCase();
  const recipientName = firstName(message.to);
  const senderName = firstName(message.from);

  if ((senderRole === "dashboard" || senderRole === "system") && recipientName) {
    return recipientName;
  }

  return senderName || recipientName;
}

function firstName(value: unknown) {
  const cleaned = cleanText(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /^care coordinator$/i.test(cleaned) || /^receiver$/i.test(cleaned)) {
    return "";
  }

  return cleaned.split(" ")[0] ?? "";
}

function cleanBringText(message: string) {
  const eyewearSummary = conciseEyewearBringText(message);
  if (eyewearSummary) return eyewearSummary;

  return sentenceCase(
    message
      .replace(/^(please\s+)?(remember to\s+)?/i, "")
      .replace(/\bthis time\b/gi, "")
      .replace(/\byour\b/gi, "")
  );
}

function cleanAskText(message: string) {
  const cleaned = message.replace(/^(please\s+)?/i, "");
  return sentenceCase(/\bask\b/i.test(cleaned) ? cleaned : `Ask ${cleaned}`);
}

function cleanWatchText(message: string) {
  const cleaned = message.replace(/^(i have been|i am|i'm|there is|there's)\s+/i, "");
  return sentenceCase(cleaned);
}

function cleanMedicationText(message: string) {
  if (/\bbring\b/i.test(message)) return cleanBringText(message);
  return sentenceCase(message);
}

function cleanNextStepText(message: string) {
  return sentenceCase(message);
}

function sentenceCase(value: string) {
  const cleaned = cleanText(value).replace(/\s+\.$/, ".");
  if (!cleaned) return "";
  const withPeriod = /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
  return `${withPeriod.charAt(0).toUpperCase()}${withPeriod.slice(1)}`;
}

function normalizeComparableText(value: string) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\b(the|a|an|current|your|please|remember|to)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function areSimilarAppointmentCommunicationItems(
  existingText: string,
  normalizedCandidate: string
) {
  const normalizedExisting = normalizeComparableText(existingText);
  return (
    normalizedExisting === normalizedCandidate ||
    normalizedExisting.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedExisting) ||
    (/\b(glasses|sunglasses)\b/.test(normalizedExisting) &&
      /\b(glasses|sunglasses)\b/.test(normalizedCandidate))
  );
}

function chooseRicherItemText(existingText: string, candidateText: string) {
  const eyewearSummary = conciseEyewearBringText(`${existingText} ${candidateText}`);
  if (eyewearSummary) return eyewearSummary;

  return cleanText(candidateText).length > cleanText(existingText).length
    ? candidateText
    : existingText;
}

function conciseEyewearBringText(value: string) {
  const normalized = cleanText(value).toLowerCase();
  const hasGlasses = /\b(glasses|eyeglasses|spectacles)\b/.test(normalized);
  const hasSunglasses = /\bsunglasses\b/.test(normalized);
  const hasPrescription = /\b(rx|prescription)\b/.test(normalized);

  if (!hasGlasses && !hasSunglasses) return "";
  if (hasGlasses && hasSunglasses) {
    return hasPrescription
      ? "Bring prescription glasses and sunglasses."
      : "Bring glasses and sunglasses.";
  }
  if (hasSunglasses) {
    return hasPrescription
      ? "Bring prescription sunglasses."
      : "Bring sunglasses.";
  }

  return hasPrescription ? "Bring prescription glasses." : "Bring glasses.";
}

function communicationItemId(
  category: AppointmentCommunicationSummaryCategory,
  text: string
) {
  const slug = normalizeComparableText(text).replace(/\s+/g, "-").slice(0, 48);
  return `${category}:${slug || "item"}`;
}
