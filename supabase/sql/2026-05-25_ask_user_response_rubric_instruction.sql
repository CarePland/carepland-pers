-- Adds an Admin-visible global Ask response rubric and appends it to current Ask module prompts.
-- Safe to re-run.

do $$
declare
  rubric_prompt text := 'Ask should sound like a CarePland routing surface, not a human agent. Avoid first-person assistant phrasing such as I, me, my, we, we''re, we''ve, and we''ll whenever practical. Prefer neutral constructions such as "This will be raised for review," "This may need a closer look," "A little more detail would help route this correctly," or "Thanks for adding this." Do not deny that Ask is AI or pretend to be human. If AI identity is directly relevant, explain it plainly without overemphasizing it. Keep responses brief, calm, respectful, and non-corporate.';
  rubric_template text := 'Apply this rubric to user-facing Ask module responses unless a more specific approved instruction overrides it.';
  matching_version_id uuid;
  next_version_number integer;
  target_content_hash text;
  target_set record;
  target_version record;
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
    'ask_user_response_rubric',
    'Ask user response rubric',
    'Global response philosophy used by Ask modules when writing user-facing text.',
    true
  from public.care_circles cc
  where not exists (
    select 1
    from public.ai_instruction_sets existing
    where existing.care_circle_id = cc.id
      and existing.instruction_key = 'ask_user_response_rubric'
  );

  for target_set in
    select ais.id as instruction_set_id
    from public.ai_instruction_sets ais
    where ais.instruction_key = 'ask_user_response_rubric'
  loop
    target_content_hash := md5(
      target_set.instruction_set_id::text ||
      '|ask-user-response-rubric|' ||
      rubric_prompt ||
      '|' ||
      rubric_template
    );

    select existing.id
      into matching_version_id
    from public.ai_instruction_versions existing
    where existing.instruction_set_id = target_set.instruction_set_id
      and existing.content_hash = target_content_hash
    order by existing.version_number desc
    limit 1;

    if matching_version_id is null then
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
        rubric_prompt,
        rubric_template,
        '{}'::jsonb,
        'gpt-4.1-mini',
        0.2,
        true,
        'Add global Ask user-facing response rubric',
        target_content_hash
      );
    else
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
    end if;
  end loop;

  for target_version in
    select
      aiv.id as current_version_id,
      aiv.instruction_set_id,
      aiv.version_number,
      aiv.system_prompt,
      aiv.user_prompt_template,
      aiv.output_schema,
      aiv.model,
      aiv.temperature
    from public.ai_instruction_versions aiv
    join public.ai_instruction_sets ais
      on ais.id = aiv.instruction_set_id
    where aiv.is_current = true
      and ais.instruction_key in (
        'ask_router',
        'ask_clarifier',
        'ask_feature_interpreter',
        'ask_bug_interpreter',
        'ask_off_topic_handler'
      )
      and coalesce(aiv.system_prompt, '') not like '%Global user-facing response rubric:%'
  loop
    target_content_hash := md5(
      target_version.instruction_set_id::text ||
      '|append-ask-user-response-rubric|' ||
      coalesce(target_version.system_prompt, '') ||
      '|' ||
      rubric_prompt
    );

    select existing.id
      into matching_version_id
    from public.ai_instruction_versions existing
    where existing.instruction_set_id = target_version.instruction_set_id
      and existing.content_hash = target_content_hash
    order by existing.version_number desc
    limit 1;

    update public.ai_instruction_versions
      set is_current = false,
          superseded_at = coalesce(superseded_at, now())
    where instruction_set_id = target_version.instruction_set_id
      and is_current = true;

    if matching_version_id is not null then
      update public.ai_instruction_versions
        set is_current = true,
            superseded_at = null
      where id = matching_version_id;
    else
      select coalesce(max(version_number), 0) + 1
        into next_version_number
      from public.ai_instruction_versions
      where instruction_set_id = target_version.instruction_set_id;

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
        target_version.instruction_set_id,
        next_version_number,
        coalesce(target_version.system_prompt, '') ||
          E'\n\nGlobal user-facing response rubric:\n' ||
          rubric_prompt,
        target_version.user_prompt_template,
        coalesce(target_version.output_schema, '{}'::jsonb),
        coalesce(target_version.model, 'gpt-4.1-mini'),
        coalesce(target_version.temperature, 0.2),
        true,
        'Append global Ask user-facing response rubric',
        target_content_hash
      );
    end if;
  end loop;
end;
$$;
