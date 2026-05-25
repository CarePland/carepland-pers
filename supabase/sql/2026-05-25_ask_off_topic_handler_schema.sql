do $$
declare
  off_topic_schema jsonb := '{
    "additionalProperties": false,
    "properties": {
      "confidence": { "type": "number" },
      "review_reason": { "type": "string" },
      "should_close": { "type": "boolean" },
      "user_response": { "type": "string" }
    },
    "required": [
      "confidence",
      "review_reason",
      "should_close",
      "user_response"
    ],
    "type": "object"
  }'::jsonb;
  matching_version_id uuid;
  next_version_number integer;
  target_content_hash text;
  target_set record;
begin
  for target_set in
    select ais.id as instruction_set_id, ais.instruction_key
    from public.ai_instruction_sets ais
    where ais.instruction_key = 'ask_off_topic_handler'
  loop
    target_content_hash := md5(
      target_set.instruction_set_id::text ||
      '|ask-off-topic-handler-schema|' ||
      target_set.instruction_key ||
      '|' ||
      off_topic_schema::text
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
        'You are the CarePland Personal Ask off-topic handler. Your job is narrow: briefly and kindly redirect clearly out-of-scope messages back to CarePland questions, appointment organization, bugs, ideas, workflow feedback, or support review. If the message includes possible medical, emergency, legal, privacy, security, account-access, abuse, or data-loss risk, do not close it as harmless off-topic; mark it for human review. Do not shame the user. Do not continue the conversation unnecessarily. Return valid JSON exactly matching the schema.',
        'Use the supplied Ask thread, router decision, current page, app context, and product context. Decide whether this can close as harmless off-topic or should be sent for human review. Return a brief user-facing response either way.',
        off_topic_schema,
        'gpt-4.1-mini',
        0.2,
        true,
        'Add structured Ask off-topic handler runtime schema',
        target_content_hash
      );
    end if;
  end loop;
end;
$$;
