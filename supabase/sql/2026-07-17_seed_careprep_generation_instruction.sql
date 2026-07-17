-- Backfill the dynamic CarePrep generation prompt for care circles that do not
-- yet have a current editable instruction version.

do $$
declare
  careprep_schema jsonb := '{
    "additionalProperties": false,
    "properties": {
      "beforeVisit": { "items": { "type": "string" }, "maxItems": 3, "type": "array" },
      "duringVisit": { "items": { "type": "string" }, "maxItems": 4, "type": "array" },
      "intro": { "maxLength": 180, "type": "string" }
    },
    "required": ["beforeVisit", "duringVisit"],
    "type": "object"
  }'::jsonb;
  careprep_system_prompt text := 'You generate deliberately minimal CarePrep for a specific upcoming appointment using only the supplied CarePland evidence. The goal is to reduce the user''s appointment-preparation workload, not to provide medical advice. Return only a short optional intro, Before the Visit suggestions, and During the Visit suggestions. Less is better: do not fill slots just because they exist, and leave arrays empty when evidence does not support materially useful preparation. Do not ask the user to retrieve or re-enter information CarePland already reliably possesses; use, summarize, connect, or ask only about changes since known information. Avoid generic advice, post-visit follow-up, clinical authority, diagnosis, treatment changes, urgency, bureaucratic phrasing, and formal question lists. Tone should be natural, calm, concise, practical, non-clinical, and suggestion-oriented. Return valid JSON exactly matching the schema.';
  careprep_user_prompt text := 'Use the supplied future appointment and past appointments to create concise user-facing CarePrep. intro is optional, maximum 180 characters, and should briefly establish why the visit matters now; do not label it Summary and do not justify CarePrep. beforeVisit should contain 0-3 genuinely useful things to do or remember before arriving. duringVisit should contain 0-3 suggestions for what may be worth mentioning, clarifying, or discussing during the appointment; use a fourth item only when it is clearly distinct, strongly supported, and genuinely important. Do not create separate Bring, Questions, Medication Review, Since Last Visit, Watchouts, or Next Steps sections. If there is no materially useful preparation, return an empty intro and empty arrays.';
  next_version_number integer;
  target_content_hash text;
  target_set record;
begin
  insert into public.ai_instruction_sets (
    care_circle_id,
    instruction_key,
    name,
    description,
    is_active
  )
  select
    cc.id,
    'careprep_generation',
    'CarePrep generation',
    'Instructions used to generate appointment preparation guidance.',
    true
  from public.care_circles cc
  where not exists (
    select 1
    from public.ai_instruction_sets existing
    where existing.care_circle_id = cc.id
      and existing.instruction_key = 'careprep_generation'
  );

  update public.ai_instruction_sets
    set is_active = true,
        name = coalesce(nullif(name, ''), 'CarePrep generation'),
        description = coalesce(
          nullif(description, ''),
          'Instructions used to generate appointment preparation guidance.'
        )
  where instruction_key = 'careprep_generation'
    and is_active is distinct from true;

  for target_set in
    select ais.id as instruction_set_id
    from public.ai_instruction_sets ais
    where ais.instruction_key = 'careprep_generation'
      and ais.is_active = true
      and not exists (
        select 1
        from public.ai_instruction_versions aiv
        where aiv.instruction_set_id = ais.id
          and aiv.is_current = true
          and aiv.output_schema #> '{properties,beforeVisit}' is not null
      )
  loop
    select coalesce(max(version_number), 0) + 1
      into next_version_number
    from public.ai_instruction_versions
    where instruction_set_id = target_set.instruction_set_id;

    target_content_hash := md5(
      target_set.instruction_set_id::text ||
      '|careprep-generation-default|' ||
      next_version_number::text ||
      '|' ||
      careprep_system_prompt ||
      '|' ||
      careprep_user_prompt ||
      '|' ||
      careprep_schema::text
    );

    update public.ai_instruction_versions
      set is_current = false
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
      careprep_system_prompt,
      careprep_user_prompt,
      careprep_schema,
      'gpt-4.1-mini',
      0.2,
      true,
      'Backfill current CarePrep generation instruction for Checkpoint and CarePrep generation',
      target_content_hash
    );
  end loop;
end;
$$;
