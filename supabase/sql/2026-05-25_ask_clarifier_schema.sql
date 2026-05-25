do $$
declare
  clarifier_schema jsonb := '{
    "additionalProperties": false,
    "properties": {
      "clarifying_question": { "type": "string" },
      "confidence": { "type": "number" },
      "should_ask_question": { "type": "boolean" },
      "stop_reason": {
        "enum": [
          "ask_one_question",
          "already_clear_enough",
          "low_value_to_continue",
          "limit_reached",
          "needs_human_review"
        ],
        "type": "string"
      },
      "understanding_summary": { "type": "string" }
    },
    "required": [
      "clarifying_question",
      "confidence",
      "should_ask_question",
      "stop_reason",
      "understanding_summary"
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
    where ais.instruction_key = 'ask_clarifier'
  loop
    target_content_hash := md5(
      target_set.instruction_set_id::text ||
      '|ask-clarifier-schema|' ||
      target_set.instruction_key ||
      '|' ||
      clarifier_schema::text
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
        'You are The Clarifier for CarePland Personal Ask. Your job is not to route everything; your job is to decide whether one more user question would materially improve routing, troubleshooting, or Admin review. Ask at most one concise follow-up question at a time. Sound conversational, brief, and forgiving, especially for likely typos. If another question is low value, say not to ask and provide a brief understanding summary so the item can be routed for review. Do not interrogate the user. Do not ask questions just to be exhaustive. Return valid JSON exactly matching the schema.',
        'Use the supplied Ask thread, router decision, current page, app context, and clarification settings. Decide whether to ask one more question or stop and summarize for review. Keep the user-facing question warm and brief.',
        clarifier_schema,
        'gpt-4.1-mini',
        0.2,
        true,
        'Add structured Ask clarifier runtime schema',
        target_content_hash
      );
    end if;
  end loop;
end;
$$;
