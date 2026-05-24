do $$
declare
  current_row public.app_content_versions%rowtype;
  new_row public.app_content_versions%rowtype;
  next_version integer;
  product_facts_body text := 'CarePland Personal helps people remember appointment details, prepare for future visits, and bring saved context forward. Users can add appointments manually, import appointments from pasted text, images, and .ics calendar files, search Google Places for clinics/businesses/addresses, save favorite locations with nicknames, generate CarePrep for upcoming appointments, add notes to logged appointments, and ask support questions in the app. Early Access plan tiers are Free, Active Use, Premium Individual, Group, and Early Access. The Early Access plan is intended for early adopters and currently includes Group-level functionality; it is not the default assignment while account changes are still handled manually. Manual CarePrep generation can be metered by plan; automatic appointment preparation is intended for Premium Individual, Group, and Early Access tiers. After Visit Notes are saved, CarePland can automatically prepare the next upcoming appointment for the same Care VIP when the plan includes automatic CarePrep. CarePrep refresh is only available when there are additional appointments to consider.';
  limitations_body text := 'Calendar sync is not live yet. SMS/text notifications are not live yet. Favorite location management is basic. Google Places autocomplete can be temporarily unavailable if quota or key restrictions block requests. Self-service billing and plan changes are not wired up yet; plan questions or account-specific tier issues should be escalated to support.';
  voice_guidance_body text := 'Use a warm, steady, and practical tone. Be empathetic without pretending intimacy, supportive without being syrupy, and clear about limits without sounding cold. Be confident on app guidance, humble on care-related questions, and never corporate-deflective or fake-cheerful when a user is frustrated.';
begin
  select *
    into current_row
  from public.app_content_versions
  where content_key = 'support_agent_product_facts'
    and is_current = true
  for update;

  if current_row.id is null or current_row.body is distinct from product_facts_body then
    select coalesce(max(version_number), 0) + 1
      into next_version
    from public.app_content_versions
    where content_key = 'support_agent_product_facts';

    if current_row.id is not null then
      update public.app_content_versions
      set is_current = false,
          superseded_at = now()
      where id = current_row.id;
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
      'support_agent_product_facts',
      'Agent product facts',
      'Current product facts injected into the support assistant knowledge context.',
      product_facts_body,
      next_version,
      true,
      'Add plan tier and CarePrep metering context',
      md5('support_agent_product_facts|Agent product facts|Current product facts injected into the support assistant knowledge context.|' || product_facts_body),
      current_row.id
    )
    returning * into new_row;

    if current_row.id is not null then
      update public.app_content_versions
      set superseded_by_version_id = new_row.id
      where id = current_row.id;
    end if;
  end if;

  current_row := null;
  new_row := null;

  select *
    into current_row
  from public.app_content_versions
  where content_key = 'support_agent_known_limitations'
    and is_current = true
  for update;

  if current_row.id is null or current_row.body is distinct from limitations_body then
    select coalesce(max(version_number), 0) + 1
      into next_version
    from public.app_content_versions
    where content_key = 'support_agent_known_limitations';

    if current_row.id is not null then
      update public.app_content_versions
      set is_current = false,
          superseded_at = now()
      where id = current_row.id;
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
      'support_agent_known_limitations',
      'Agent known limitations',
      'Known limitations injected into the support assistant knowledge context.',
      limitations_body,
      next_version,
      true,
      'Add plan change and tier escalation context',
      md5('support_agent_known_limitations|Agent known limitations|Known limitations injected into the support assistant knowledge context.|' || limitations_body),
      current_row.id
    )
    returning * into new_row;

    if current_row.id is not null then
      update public.app_content_versions
      set superseded_by_version_id = new_row.id
      where id = current_row.id;
    end if;
  end if;

  current_row := null;
  new_row := null;

  select *
    into current_row
  from public.app_content_versions
  where content_key = 'support_agent_voice_guidance'
    and is_current = true
  for update;

  if current_row.id is null or current_row.body is distinct from voice_guidance_body then
    select coalesce(max(version_number), 0) + 1
      into next_version
    from public.app_content_versions
    where content_key = 'support_agent_voice_guidance';

    if current_row.id is not null then
      update public.app_content_versions
      set is_current = false,
          superseded_at = now()
      where id = current_row.id;
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
      'support_agent_voice_guidance',
      'Agent voice guidance',
      'Tone guidance injected into the support assistant knowledge context.',
      voice_guidance_body,
      next_version,
      true,
      'Add warm practical assistant voice guidance',
      md5('support_agent_voice_guidance|Agent voice guidance|Tone guidance injected into the support assistant knowledge context.|' || voice_guidance_body),
      current_row.id
    )
    returning * into new_row;

    if current_row.id is not null then
      update public.app_content_versions
      set superseded_by_version_id = new_row.id
      where id = current_row.id;
    end if;
  end if;
end;
$$;
