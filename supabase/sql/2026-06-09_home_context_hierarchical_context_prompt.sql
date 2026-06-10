-- Adds hierarchical Ask context awareness to the Home "Get more context"
-- Admin-managed prompts. Safe to re-run.

do $$
declare
  answer_schema jsonb := '{
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "answer": { "type": "string" }
    },
    "required": ["answer"]
  }'::jsonb;
  classifier_schema jsonb := '{
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
  }'::jsonb;
  matching_version_id uuid;
  next_version_number integer;
  target_content_hash text;
  target_set record;
  target_system_prompt text;
  target_temperature numeric;
  target_user_prompt text;
  target_schema jsonb;
begin
  for target_set in
    select ais.id as instruction_set_id, ais.instruction_key
    from public.ai_instruction_sets ais
    where ais.instruction_key in (
      'home_context_intent_classifier',
      'home_context_answer'
    )
  loop
    if target_set.instruction_key = 'home_context_intent_classifier' then
      target_system_prompt := 'Classify whether a user question can reasonably be answered from saved CarePland records and the supplied Ask context. CarePland records include appointments, Visit Notes, providers, Health Focus topics, CarePrep, and care history. This is not a general chatbot. The Ask context level may be global, health_focus, appointment, visit_note, or careprep. A short question such as "Summarize this story" can be in scope when the Ask context supplies a selected topic, appointment, note, or CarePrep. Categories: health_focus for symptoms, conditions, diagnoses, health topics, recurring issues, trends, and timelines; care_planning for follow-ups, next steps, upcoming appointments, preparation, things to bring, and provider recommendations; care_story for interpretation such as what seems important or how issues connect; provider_context for doctors, practices, specialists, visit frequency, or provider involvement; personal_care_history for patterns across records such as what happened recently, what appears often, or what improved; out_of_scope for anything unrelated to care records, current events, shopping, entertainment, weather, sports, trivia, or anything that cannot reasonably be answered from CarePland data. If global context has no selected topic or appointment, treat vague references such as "this issue" as unclear. Return structured JSON only.';
      target_user_prompt := 'Classify the supplied question before any answer is generated. Use the Ask context to understand whether the question is global, topic-level, appointment-level, or document-level. Return confidence from 0 to 1 and source_types needed to answer. Use only these source types: health_focus, appointments, notes, careprep, providers. Select only relevant source types.';
      target_schema := classifier_schema;
      target_temperature := 0;
    else
      target_system_prompt := 'You answer questions about a user''s saved CarePland records after intent classification has already determined the question is in scope. Use only the provided CarePland context: appointments, notes, CarePrep, Health Focus topics, providers, dates, and Ask context. This is not a general chatbot. Ask context level matters: global questions should answer from the overall care record; health_focus questions should explicitly use the selected topic name; appointment questions should answer from that appointment first; visit_note and careprep questions should focus on that document and its source appointment. Do not use vague phrases like this issue, this topic, or this concern when a topic name is available. Do not provide medical advice, diagnosis, treatment instructions, or emergency guidance. Prefer understanding over completeness. Prefer plain language over precision. Prefer a helpful observation over a comprehensive report. Use approximate language such as recently, earlier this year, several times, or across a few visits instead of exact dates unless exact dates are necessary. Explain reasoning briefly. If the selected context is thin or unclear, say so calmly. Keep the answer concise, usually 2-4 sentences. No bullet list unless it genuinely improves clarity.';
      target_user_prompt := 'Use the supplied user question, Ask context, and CarePland context. Answer naturally and briefly. Name the active topic, appointment, or document when available. Explain what the saved record suggests, not every data point.';
      target_schema := answer_schema;
      target_temperature := 0.2;
    end if;

    target_content_hash := md5(
      target_set.instruction_set_id::text ||
      '|home-context-hierarchical-context-v2|' ||
      target_set.instruction_key ||
      '|' ||
      target_system_prompt ||
      '|' ||
      target_user_prompt ||
      '|' ||
      target_schema::text
    );

    select existing.id
      into matching_version_id
    from public.ai_instruction_versions existing
    where existing.instruction_set_id = target_set.instruction_set_id
      and existing.content_hash = target_content_hash
    order by existing.version_number desc
    limit 1;

    if matching_version_id is not null then
      update public.ai_instruction_versions
        set is_current = false,
            superseded_at = coalesce(superseded_at, now())
      where instruction_set_id = target_set.instruction_set_id
        and id <> matching_version_id
        and is_current = true;

      update public.ai_instruction_versions
        set is_current = true,
            superseded_at = null
      where id = matching_version_id;
    else
      select coalesce(max(version_number), 0) + 1
        into next_version_number
      from public.ai_instruction_versions
      where instruction_set_id = target_set.instruction_set_id;

      update public.ai_instruction_versions
        set is_current = false,
            superseded_at = coalesce(superseded_at, now())
      where instruction_set_id = target_set.instruction_set_id
        and is_current = true;

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
      values (
        target_set.instruction_set_id,
        next_version_number,
        target_system_prompt,
        target_user_prompt,
        target_schema,
        'gpt-4.1-mini',
        target_temperature,
        true,
        'Add hierarchical Ask context awareness',
        target_content_hash
      );
    end if;
  end loop;
end;
$$;
