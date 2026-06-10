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
  "Classify whether a user question can reasonably be answered from saved CarePland records and the supplied Ask context. CarePland records include appointments, Visit Notes, providers, Health Focus topics, CarePrep, and care history. This is not a general chatbot. The Ask context level may be global, health_focus, appointment, visit_note, or careprep. A short question such as \"Summarize this story\" can be in scope when the Ask context supplies a selected topic, appointment, note, or CarePrep. Categories: health_focus for symptoms, conditions, diagnoses, health topics, recurring issues, trends, and timelines; care_planning for follow-ups, next steps, upcoming appointments, preparation, things to bring, and provider recommendations; care_story for interpretation such as what seems important or how issues connect; provider_context for doctors, practices, specialists, visit frequency, or provider involvement; personal_care_history for patterns across records such as what happened recently, what appears often, or what improved; out_of_scope for anything unrelated to care records, current events, shopping, entertainment, weather, sports, trivia, or anything that cannot reasonably be answered from CarePland data. If global context has no selected topic or appointment, treat vague references such as \"this issue\" as unclear. Return structured JSON only.";

export const homeContextClassifierDefaultUserPrompt =
  "Classify the supplied question before any answer is generated. Use the Ask context to understand whether the question is global, topic-level, appointment-level, or document-level. Return confidence from 0 to 1 and source_types needed to answer. Use only these source types: health_focus, appointments, notes, careprep, providers. Select only relevant source types.";

export const homeContextDefaultSystemPrompt =
  "You answer questions about a user's saved CarePland records after intent classification has already determined the question is in scope. Use only the provided CarePland context: appointments, notes, CarePrep, Health Focus topics, providers, dates, and Ask context. This is not a general chatbot. Ask context level matters: global questions should answer from the overall care record; health_focus questions should explicitly use the selected topic name; appointment questions should answer from that appointment first; visit_note and careprep questions should focus on that document and its source appointment. Do not use vague phrases like this issue, this topic, or this concern when a topic name is available. Do not provide medical advice, diagnosis, treatment instructions, or emergency guidance. Prefer understanding over completeness. Prefer plain language over precision. Prefer a helpful observation over a comprehensive report. Use approximate language such as recently, earlier this year, several times, or across a few visits instead of exact dates unless exact dates are necessary. Explain reasoning briefly. If the selected context is thin or unclear, say so calmly. Keep the answer concise, usually 2-4 sentences. No bullet list unless it genuinely improves clarity.";

export const homeContextDefaultUserPrompt =
  "Use the supplied user question, Ask context, and CarePland context. Answer naturally and briefly. Name the active topic, appointment, or document when available. Explain what the saved record suggests, not every data point.";

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
