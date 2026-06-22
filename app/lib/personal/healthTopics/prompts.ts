import { type SupabaseClient } from "@supabase/supabase-js";

export const healthFocusPromptKeys = [
  "health_topic_extraction",
  "health_topic_normalization",
  "health_topic_relationship_detection",
  "health_focus_card_summary",
  "health_story_narrative_summary",
  "health_story_timeline_summary",
  "health_story_source_snippet_selection",
  "health_story_feedback_acknowledgement",
  "health_topic_feedback_interpretation",
  "health_topic_correction_structuring",
  "health_report_generation",
] as const;

export type HealthFocusPromptKey = (typeof healthFocusPromptKeys)[number];

export type HealthFocusInstructionVersion = {
  content_hash: string | null;
  id: string;
  model: string | null;
  output_schema: unknown;
  system_prompt: string | null;
  temperature: number | null;
  user_prompt_template: string | null;
  version_number: number;
};

export const healthFocusPromptMetadata: Record<
  HealthFocusPromptKey,
  { description: string; label: string }
> = {
  health_focus_card_summary: {
    description: "Writes compact human-facing Health Focus card summaries.",
    label: "Health Focus card summary",
  },
  health_report_generation: {
    description: "Generates saved Health Focus reports and Health Narratives.",
    label: "Health report generation",
  },
  health_story_narrative_summary: {
    description: "Writes concise plain-language Health Story summaries.",
    label: "Health Story narrative summary",
  },
  health_story_source_snippet_selection: {
    description: "Chooses supporting snippets for Health Story source trust.",
    label: "Health Story source snippet selection",
  },
  health_story_feedback_acknowledgement: {
    description: "Acknowledges saved Health Story feedback in a calm, user-owned way.",
    label: "Health Story feedback acknowledgement",
  },
  health_story_timeline_summary: {
    description: "Summarizes Health Story timeline events.",
    label: "Health Story timeline summary",
  },
  health_topic_correction_structuring: {
    description: "Turns user clarifications into reusable care context.",
    label: "Health topic correction structuring",
  },
  health_topic_extraction: {
    description: "Extracts candidate health topics from source text.",
    label: "Health topic extraction",
  },
  health_topic_feedback_interpretation: {
    description: "Interprets user feedback on Health Focus and Health Stories.",
    label: "Health topic feedback interpretation",
  },
  health_topic_normalization: {
    description: "Maps topic language to the standard Health Focus catalog.",
    label: "Health topic normalization",
  },
  health_topic_relationship_detection: {
    description: "Detects whether topics appear related, separate, or unclear.",
    label: "Health topic relationship detection",
  },
};

export function healthFocusPromptVersionLabel(
  promptKey: HealthFocusPromptKey,
  version: Pick<HealthFocusInstructionVersion, "version_number"> | null
) {
  return version ? `${promptKey}:v${version.version_number}` : `${promptKey}:fallback`;
}

export async function loadHealthFocusInstructionVersion({
  careCircleId,
  promptKey,
  supabase,
}: {
  careCircleId: string | null;
  promptKey: HealthFocusPromptKey;
  supabase: SupabaseClient;
}): Promise<HealthFocusInstructionVersion | null> {
  let instructionSetQuery = supabase
    .from("ai_instruction_sets")
    .select("id")
    .eq("instruction_key", promptKey)
    .eq("is_active", true)
    .limit(1);

  if (careCircleId) {
    instructionSetQuery = instructionSetQuery.eq("care_circle_id", careCircleId);
  } else {
    instructionSetQuery = instructionSetQuery.is("care_circle_id", null);
  }

  const { data: instructionSets, error: instructionSetError } =
    await instructionSetQuery;

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

  return (versions?.[0] ?? null) as HealthFocusInstructionVersion | null;
}
