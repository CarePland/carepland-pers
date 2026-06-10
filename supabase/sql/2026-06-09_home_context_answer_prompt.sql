-- Seeds the Admin-managed prompt paths for the Home "Get more context" panel.
-- Safe to re-run. Creates the instruction set/version only when missing.

with seeded_prompts as (
  select *
  from (
    values
      (
        'home_context_intent_classifier',
        'Home context intent classifier',
        'Classifies Home context questions before answer generation and redirects out-of-scope requests.'
      ),
      (
        'home_context_answer',
        'Home context answer',
        'Answers short homepage questions using saved appointments, notes, CarePrep, providers, and Health Focus context.'
      )
  ) as seeded(instruction_key, name, description)
),
inserted_sets as (
  insert into public.ai_instruction_sets (
    care_circle_id,
    instruction_key,
    name,
    description,
    is_active
  )
  select cc.id, seeded_prompts.instruction_key, seeded_prompts.name, seeded_prompts.description, true
  from public.care_circles cc
  cross join seeded_prompts
  where not exists (
    select 1
    from public.ai_instruction_sets existing
    where existing.care_circle_id = cc.id
      and existing.instruction_key = seeded_prompts.instruction_key
  )
  returning id, instruction_key
),
target_sets as (
  select ais.id, ais.instruction_key
  from public.ai_instruction_sets ais
  where ais.instruction_key in (select instruction_key from seeded_prompts)
    and not exists (
      select 1
      from public.ai_instruction_versions aiv
      where aiv.instruction_set_id = ais.id
    )
)
insert into public.ai_instruction_versions (
  instruction_set_id,
  version_number,
  system_prompt,
  user_prompt_template,
  output_schema,
  model,
  temperature,
  is_current,
  change_note,
  content_hash
)
select
  target_sets.id,
  1,
  case target_sets.instruction_key
    when 'home_context_intent_classifier' then 'Classify whether a user question can reasonably be answered from saved CarePland records. CarePland records include appointments, Visit Notes, providers, Health Focus topics, CarePrep, and care history. This is not a general chatbot. Categories: health_focus for symptoms, conditions, diagnoses, health topics, recurring issues, trends, and timelines; care_planning for follow-ups, next steps, upcoming appointments, preparation, things to bring, and provider recommendations; care_story for interpretation such as what seems important or how issues connect; provider_context for doctors, practices, specialists, visit frequency, or provider involvement; personal_care_history for patterns across records such as what happened recently, what appears often, or what improved; out_of_scope for anything unrelated to care records, current events, shopping, entertainment, weather, sports, trivia, or anything that cannot reasonably be answered from CarePland data. If confidence is low, use out_of_scope. Return structured JSON only.'
    else 'You answer questions about a user''s saved CarePland records after intent classification has already determined the question is in scope. Use only the provided CarePland context: appointments, notes, CarePrep, Health Focus topics, providers, and dates. This is not a general chatbot. Do not provide medical advice, diagnosis, treatment instructions, or emergency guidance. Prefer understanding over completeness. Prefer plain language over precision. Prefer a helpful observation over a comprehensive report. Use approximate language such as recently, earlier this year, several times, or across a few visits instead of exact dates unless exact dates are necessary. Explain reasoning briefly. If the selected context is thin or unclear, say so calmly. Keep the answer concise, usually 2-4 sentences. No bullet list unless it genuinely improves clarity.'
  end,
  case target_sets.instruction_key
    when 'home_context_intent_classifier' then 'Classify the supplied question before any answer is generated. Return confidence from 0 to 1 and source_types needed to answer. Use only these source types: health_focus, appointments, notes, careprep, providers. Select only relevant source types.'
    else 'Use the supplied user question and CarePland context. Answer naturally and briefly. Explain what the saved record suggests, not every data point.'
  end,
  case target_sets.instruction_key
    when 'home_context_intent_classifier' then '{
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "category": {
          "type": "string",
          "enum": [
            "health_focus",
            "care_planning",
            "care_story",
            "provider_context",
            "personal_care_history",
            "out_of_scope"
          ]
        },
        "confidence": { "type": "number" },
        "rationale": { "type": "string" },
        "source_types": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "appointments",
              "careprep",
              "health_focus",
              "notes",
              "providers"
            ]
          }
        }
      },
      "required": ["category", "confidence", "rationale", "source_types"]
    }'::jsonb
    else '{
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "answer": { "type": "string" }
      },
      "required": ["answer"]
    }'::jsonb
  end,
  'gpt-4.1-mini',
  case target_sets.instruction_key
    when 'home_context_intent_classifier' then 0
    else 0.2
  end,
  true,
  case target_sets.instruction_key
    when 'home_context_intent_classifier' then 'Initial Home context intent classifier prompt'
    else 'Initial Home context answer prompt'
  end,
  md5(target_sets.id::text || '|' || target_sets.instruction_key || '|home-context-prompts-v1')
from target_sets;
