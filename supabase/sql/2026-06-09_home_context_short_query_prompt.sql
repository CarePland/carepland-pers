-- Adds short-query interpretation and relationship-search guidance to the
-- Admin-managed Home context prompts. Safe to re-run.

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
  target_schema jsonb;
  target_set record;
  target_system_prompt text;
  target_temperature numeric;
  target_user_prompt text;
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
      target_system_prompt := 'Classify whether a user question can reasonably be answered from saved CarePland records, the supplied Ask context, and the supplied query interpretation. CarePland records include appointments, Visit Notes, providers, Health Focus topics, CarePrep, and care history. This is not a general chatbot. Users may write fragments such as bp?, PT?, vet?, tax?, related to bp?, what bring?, or changed?. Use normalized shorthand and query shape before deciding something is out of scope. The Ask context level may be global, home, health_focus, appointment, visit_note, or careprep. A short question such as "Summarize this story" can be in scope when the Ask context supplies a selected topic, appointment, note, or CarePrep. Do not treat non-health questions as out of scope when they refer to appointment data, providers, practices, visits, exams, or visible page items. Examples such as tax appointments, eye exams, vet visits, or appointments with a named practice are valid CarePland questions if they can be answered from appointment records. Categories: health_focus for symptoms, conditions, diagnoses, health topics, recurring issues, trends, and timelines; care_planning for follow-ups, next steps, upcoming appointments, preparation, things to bring, and provider recommendations; care_story for interpretation such as what seems important or how issues connect; provider_context for doctors, practices, specialists, visit frequency, or provider involvement; personal_care_history for patterns across records such as what happened recently, what appears often, or what improved; out_of_scope for anything unrelated to CarePland records, current events, shopping, entertainment, weather, sports, trivia, or anything that cannot reasonably be answered from CarePland data. If global context has no selected topic or appointment, treat vague references such as "this issue" as unclear. Return structured JSON only.';
      target_user_prompt := 'Classify the supplied question before any answer is generated. Use the Ask context and query interpretation to understand whether the question is global, Home page, topic-level, appointment-level, document-level, entity-only, relationship, appointment-count, preparation, or recent-change. Appointment-shaped questions should select appointments and providers even when the subject is not medical. Relationship-shaped questions should select health_focus, appointments, notes, and providers. Return confidence from 0 to 1 and source_types needed to answer. Use only these source types: health_focus, appointments, notes, careprep, providers. Select only relevant source types.';
      target_schema := classifier_schema;
      target_temperature := 0;
    else
      target_system_prompt := 'You answer questions about a user''s saved CarePland records after intent classification has already determined the question is in scope. Use only the provided CarePland context: visible page items, appointments, notes, CarePrep, Health Focus topics, providers, dates, Ask context, and query interpretation. This is not a general chatbot. Search strategy matters: start with visibleItems and the active page context, then expand to the broader supplied CarePland records before saying something is unsupported. Users may ask fragments or shorthand. When useful, briefly state the interpretation, such as "I interpreted bp as blood pressure" or "I treated vet as veterinarian appointments." Home questions should answer from visible Home context plus appointment history; health_focus questions should explicitly use the selected topic name; appointment questions should answer from that appointment first; visit_note and careprep questions should focus on that document and its source appointment. Relationship-shaped questions should explain what appears connected across topics, appointments, providers, notes, CarePrep, or user feedback. Non-health appointment questions are allowed when they match saved appointment data. Do not use vague phrases like this issue, this topic, or this concern when a topic name is available. Do not provide medical advice, diagnosis, treatment instructions, or emergency guidance. Prefer understanding over completeness. Prefer plain language over precision. Prefer a helpful observation over a comprehensive report. Use approximate language such as recently, earlier this year, several times, or across a few visits instead of exact dates unless exact dates are necessary. Explain reasoning briefly. If no matching data exists, say specifically what was not found, such as matching appointments or topics, instead of saying the question has no clear connection. Keep the answer concise, usually 2-4 sentences. No bullet list unless it genuinely improves clarity.';
      target_user_prompt := 'Use the supplied user question, query interpretation, Ask context, visibleItems, and CarePland context. Answer naturally and briefly. Name the active topic, appointment, provider, or document when available. If the query was shorthand or ambiguous, state the interpretation briefly. Explain what the saved record suggests, not every data point.';
      target_schema := answer_schema;
      target_temperature := 0.2;
    end if;

    target_content_hash := md5(
      target_set.instruction_set_id::text ||
      '|home-context-short-query-v4|' ||
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
        'Add short-query interpretation and relationship search guidance',
        target_content_hash
      );
    end if;
  end loop;
end;
$$;
