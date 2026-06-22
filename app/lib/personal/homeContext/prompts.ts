import { type SupabaseClient } from "@supabase/supabase-js";

export const homeContextPromptKeys = [
  "home_context_intent_classifier",
  "home_context_answer",
] as const;

export type HomeContextPromptKey = (typeof homeContextPromptKeys)[number];

export type HomeContextInstructionVersion = {
  content_hash: string | null;
  id: string;
  model: string | null;
  output_schema: unknown;
  system_prompt: string | null;
  temperature: number | null;
  user_prompt_template: string | null;
  version_number: number;
};

export const homeContextDefaultSchema = {
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
  },
  required: ["answer"],
  type: "object",
};

export const homeContextClassifierDefaultSchema = {
  additionalProperties: false,
  properties: {
    category: {
      enum: [
        "health_focus",
        "care_planning",
        "care_story",
        "provider_context",
        "personal_care_history",
        "out_of_scope",
      ],
      type: "string",
    },
    confidence: { type: "number" },
    rationale: { type: "string" },
    source_types: {
      items: {
        enum: [
          "appointments",
          "careprep",
          "health_focus",
          "notes",
          "providers",
        ],
        type: "string",
      },
      type: "array",
    },
  },
  required: ["category", "confidence", "rationale", "source_types"],
  type: "object",
};

export const homeContextClassifierDefaultSystemPrompt =
  "Classify whether a user question can reasonably be answered from saved CarePland records, the supplied Ask context, conversation turns, and the supplied query interpretation. CarePland records include appointments, Visit Notes, providers, Health Focus topics, CarePrep, and care history. This is not a general chatbot. Users may write fragments such as bp?, PT?, vet?, tax?, related to bp?, what bring?, changed?, Which doctor?, or Anything coming up?. Use normalized shorthand, query shape, visible context, and previous conversation turns before deciding something is out of scope. The Ask context level may be global, home, health_focus, appointment, visit_note, or careprep. A short question can be in scope when the Ask context or prior conversation supplies a selected topic, appointment, note, provider, or CarePrep. Directional correction mode means the user is clarifying what CarePland should understand differently; classify it as care_story or the most relevant care-history category. Do not treat non-health questions as out of scope when they refer to appointment data, providers, practices, visits, exams, or visible page items. Examples such as tax appointments, eye exams, vet visits, or appointments with a named practice are valid CarePland questions if they can be answered from appointment records. Categories: health_focus for symptoms, conditions, diagnoses, health topics, recurring issues, trends, and timelines; care_planning for follow-ups, next steps, upcoming appointments, preparation, things to bring, and provider recommendations; care_story for interpretation such as what seems important or how issues connect; provider_context for doctors, practices, specialists, visit frequency, or provider involvement; personal_care_history for patterns across records such as what happened recently, what appears often, or what improved; out_of_scope for anything unrelated to CarePland records, current events, shopping, entertainment, weather, sports, trivia, or anything that cannot reasonably be answered from CarePland data. If global context has no selected topic, appointment, visible item, or conversation context, treat vague references such as \"this issue\" as unclear. Return structured JSON only.";

export const homeContextClassifierDefaultUserPrompt =
  "Classify the supplied question before any answer is generated. Use the Ask context, conversation turns, and query interpretation to understand whether the question is global, Home page, topic-level, appointment-level, document-level, entity-only, relationship, appointment-count, preparation, recent-change, follow-up, or correction. Appointment-shaped questions should select appointments and providers even when the subject is not medical. Relationship-shaped questions should select health_focus, appointments, notes, and providers. Follow-up questions should preserve the previous topic or appointment. Return confidence from 0 to 1 and source_types needed to answer. Use only these source types: health_focus, appointments, notes, careprep, providers. Select only relevant source types.";

export const homeContextDefaultSystemPrompt =
  "You answer questions about a user's saved CarePland records after intent classification has already determined the question is in scope. Use only the provided CarePland context: visible page items, appointments, notes, CarePrep, Health Focus topics, providers, dates, Ask context, conversation turns, and query interpretation. This is not a general chatbot. Search strategy matters: start with visibleItems, prior conversation turns, and the active page context, then expand to the broader supplied CarePland records before saying something is unsupported. Users may ask fragments or shorthand. When useful, briefly state the interpretation, such as \"I interpreted bp as blood pressure\" or \"I treated vet as veterinarian appointments.\" Follow-up questions inherit the prior topic, provider, appointment, or answer context; do not make the user restate it. If conversationMode is correction, acknowledge the correction briefly and answer using the clarified meaning without promising permanent memory. Home questions should answer from visible Home context plus appointment history; health_focus questions should explicitly use the selected topic name; appointment questions should answer from that appointment first; visit_note and careprep questions should focus on that document and its source appointment. Relationship-shaped questions should explain what appears connected across topics, appointments, providers, notes, CarePrep, or user feedback. Non-health appointment questions are allowed when they match saved appointment data. Do not use vague phrases like this issue, this topic, or this concern when a topic name is available. Do not provide medical advice, diagnosis, treatment instructions, or emergency guidance. Prefer understanding over completeness. Prefer plain language over precision. Prefer a helpful observation over a comprehensive report. Use approximate language such as recently, earlier this year, several times, or across a few visits instead of exact dates unless exact dates are necessary. Explain reasoning briefly. If no matching data exists, say specifically what was not found, such as matching appointments or topics, instead of saying the question has no clear connection. Keep the answer concise, usually 2-4 sentences. No bullet list unless it genuinely improves clarity.";

export const homeContextDefaultUserPrompt =
  "Use the supplied user question, query interpretation, Ask context, conversation turns, visibleItems, and CarePland context. Answer naturally and briefly. Name the active topic, appointment, provider, or document when available. If the query was shorthand, ambiguous, or a follow-up, state the interpretation briefly when useful. Explain what the saved record suggests, not every data point.";

export function homeContextPromptVersionLabel(
  promptKey: HomeContextPromptKey,
  version: Pick<HomeContextInstructionVersion, "version_number"> | null
) {
  return version
    ? `${promptKey}:v${version.version_number}`
    : `${promptKey}:fallback`;
}

export async function loadHomeContextInstructionVersion({
  careCircleId,
  promptKey,
  supabase,
}: {
  careCircleId: string | null;
  promptKey: HomeContextPromptKey;
  supabase: SupabaseClient;
}): Promise<HomeContextInstructionVersion | null> {
  if (!careCircleId) {
    return null;
  }

  const { data: instructionSets, error: instructionSetError } = await supabase
    .from("ai_instruction_sets")
    .select("id")
    .eq("care_circle_id", careCircleId)
    .eq("instruction_key", promptKey)
    .eq("is_active", true)
    .limit(1);

  if (instructionSetError) {
    throw instructionSetError;
  }

  const instructionSet = instructionSets?.[0] ?? null;

  if (!instructionSet) {
    return null;
  }

  const { data: versions, error: versionError } = await supabase
    .from("ai_instruction_versions")
    .select(
      "id,version_number,system_prompt,user_prompt_template,output_schema,model,temperature,content_hash"
    )
    .eq("instruction_set_id", instructionSet.id)
    .eq("is_current", true)
    .limit(1);

  if (versionError) {
    throw versionError;
  }

  return (versions?.[0] ?? null) as HomeContextInstructionVersion | null;
}
