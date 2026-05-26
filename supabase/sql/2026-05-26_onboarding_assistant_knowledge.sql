-- Configures a separate Ask onboarding helper module and light supporting copy.
-- Safe to re-run: creates a new current version only when the body changes.

do $$
declare
  content_record record;
  current_version public.app_content_versions%rowtype;
  new_version public.app_content_versions%rowtype;
  next_version_number integer;
begin
  for content_record in
    select *
    from (
      values
        (
          'support_agent_product_facts',
          'Agent product facts',
          'Current product facts injected into the support assistant knowledge context.',
          'CarePland Personal helps people remember appointment details, prepare for future visits, and bring saved context forward. Users can add appointments manually, import appointments from pasted text, images, and .ics calendar files, search Google Places for clinics/businesses/addresses, save favorite locations with nicknames, generate CarePrep for upcoming appointments, add notes to logged appointments, and ask questions in the app. New users complete profile basics, Early Access acknowledgements, Care Circle setup, and a Home welcome guide before regular app use. Early Access currently gives early adopters full access, including multiple Care VIPs and automatic appointment preparation where available. Manual CarePrep generation can be metered by plan; automatic appointment preparation is intended for Premium Individual, Group, and Early Access tiers. After Visit Notes are saved, CarePland can automatically prepare the next upcoming appointment for the same Care VIP when the plan includes automatic CarePrep. CarePrep refresh is only available when there are additional appointments to consider.'
        ),
        (
          'support_agent_escalation_guidance',
          'Agent escalation guidance',
          'Escalation rules injected into the support assistant knowledge context.',
          'Escalate bugs, account access issues, data loss, billing/privacy/security concerns, emergency or medical advice requests, data-changing requests, unclear issues, and frustrated users. Escalate onboarding issues when profile setup, Early Access acknowledgement, email update, Care Circle setup, or welcome-guide dismissal appears blocked or account-specific.'
        ),
        (
          'ask_guidance_message',
          'Ask guidance message',
          'Guidance text shown at the top of the Ask panel before a user sends a message.',
          'Questions, ideas, onboarding help, workflow feedback, or things that felt confusing — tell us what''s on your mind.'
        )
    ) as seeded(content_key, label, description, body)
  loop
    select *
      into current_version
    from public.app_content_versions
    where content_key = content_record.content_key
      and is_current = true
    for update;

    if current_version.id is not null and current_version.body = content_record.body then
      continue;
    end if;

    select coalesce(max(version_number), 0) + 1
      into next_version_number
    from public.app_content_versions
    where content_key = content_record.content_key;

    if current_version.id is not null then
      update public.app_content_versions
      set is_current = false,
          superseded_at = now()
      where id = current_version.id;
    end if;

    insert into public.app_content_versions (
      content_key,
      label,
      description,
      body,
      version_number,
      is_current,
      change_note,
      content_hash,
      copied_from_version_id
    )
    values (
      content_record.content_key,
      content_record.label,
      content_record.description,
      content_record.body,
      next_version_number,
      true,
      'Configure assistant onboarding support copy',
      md5(content_record.content_key || '|' || content_record.label || '|' || content_record.description || '|' || content_record.body),
      current_version.id
    )
    returning * into new_version;

    if current_version.id is not null then
      update public.app_content_versions
      set superseded_by_version_id = new_version.id
      where id = current_version.id;
    end if;
  end loop;
end $$;

do $$
declare
  onboarding_schema jsonb := '{
    "additionalProperties": false,
    "properties": {
      "answer": { "type": "string" },
      "confidence": { "type": "number" },
      "escalation_reason": { "type": "string" },
      "escalation_recommended": { "type": "boolean" },
      "recommended_actions": {
        "items": {
          "additionalProperties": true,
          "properties": {
            "action": { "type": "string" },
            "confidence": { "type": "number" },
            "priority": { "type": "string" },
            "rationale": { "type": "string" },
            "title": { "type": "string" }
          },
          "required": ["action", "confidence", "rationale", "title"],
          "type": "object"
        },
        "type": "array"
      },
      "summary": { "type": "string" }
    },
    "required": [
      "answer",
      "confidence",
      "escalation_reason",
      "escalation_recommended",
      "recommended_actions",
      "summary"
    ],
    "type": "object"
  }'::jsonb;
  onboarding_system_prompt text := 'You are the CarePland Personal Ask onboarding helper. Answer low-risk getting-started questions about profile setup, Early Access acknowledgements, Care Circle setup, the first-run Home welcome guide, adding a first appointment, importing appointment details, and demo examples. For profile setup, explain that CarePland asks for basic account/contact details so dates, reminders, time zones, and support follow-up work correctly: first and last name, phone, time zone, and ZIP are required; display name and street address details are optional unless the app marks them otherwise. Keep this from sounding like a medical intake form. If the user says they are confused, lost, unsure what the welcome screen means, or asks what to do next, respond with gentle orientation: reassure them briefly, explain that CarePland helps carry important appointment context forward from one visit to the next, name a few examples such as what changed, what mattered, and what to ask next, then suggest the easiest next step: adding or importing a first appointment. Keep answers brief, calm, and practical. Avoid first-person assistant phrasing such as I, me, my, we, we''re, we''ve, and we''ll whenever practical. Do not give medical, legal, privacy, account-security, billing, or emergency advice. Do not claim to change data. Escalate if the user appears blocked by account state, email update, authentication, profile saving, missing Care Circle setup, data loss, or frustration. Return valid JSON exactly matching the schema.';
  onboarding_user_prompt text := 'Use the supplied Ask thread, current page, app context, and onboarding facts. Either answer the onboarding question or recommend review when account-specific help is needed.';
  matching_version_id uuid;
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
    'ask_onboarding_helper',
    'Ask onboarding helper',
    'Answers low-risk onboarding and getting-started questions before review.',
    true
  from public.care_circles cc
  where not exists (
    select 1
    from public.ai_instruction_sets existing
    where existing.care_circle_id = cc.id
      and existing.instruction_key = 'ask_onboarding_helper'
  );

  for target_set in
    select ais.id as instruction_set_id
    from public.ai_instruction_sets ais
    where ais.instruction_key = 'ask_onboarding_helper'
  loop
    target_content_hash := md5(
      target_set.instruction_set_id::text ||
      '|ask-onboarding-helper|' ||
      onboarding_system_prompt ||
      '|' ||
      onboarding_user_prompt ||
      '|' ||
      onboarding_schema::text
    );

    select existing.id
      into matching_version_id
    from public.ai_instruction_versions existing
    where existing.instruction_set_id = target_set.instruction_set_id
      and existing.content_hash = target_content_hash
    order by existing.version_number desc
    limit 1;

    update public.ai_instruction_versions
      set is_current = false,
          superseded_at = coalesce(superseded_at, now())
    where instruction_set_id = target_set.instruction_set_id
      and is_current = true
      and (matching_version_id is null or id <> matching_version_id);

    if matching_version_id is not null then
      update public.ai_instruction_versions
        set is_current = true,
            superseded_at = null
      where id = matching_version_id;
    else
      select coalesce(max(version_number), 0) + 1
        into next_version_number
      from public.ai_instruction_versions
      where instruction_set_id = target_set.instruction_set_id;

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
        onboarding_system_prompt,
        onboarding_user_prompt,
        onboarding_schema,
        'gpt-4.1-mini',
        0.2,
        true,
        'Add Ask onboarding helper module',
        target_content_hash
      );
    end if;
  end loop;
end $$;
