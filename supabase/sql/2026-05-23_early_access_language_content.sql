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
          'beta_notice_intro',
          'Early Access notice intro',
          'Introductory text shown before Early Access acknowledgement checkboxes.',
          'CarePland Personal is currently available through Early Access. Formal Terms of Service and Privacy Policy pages are not enabled yet.'
        ),
        (
          'beta_terms_ack',
          'Early Access terms acknowledgement',
          'Checkbox text confirming Terms of Service status during Early Access.',
          'I understand formal Terms of Service are not currently enabled for this Early Access version.'
        ),
        (
          'beta_privacy_ack',
          'Early Access privacy acknowledgement',
          'Checkbox text confirming Privacy Policy status during Early Access.',
          'I understand formal Privacy Policy review is not currently enabled for this Early Access version.'
        ),
        (
          'beta_disclaimer_ack',
          'Early Access safety acknowledgement',
          'Checkbox text confirming Early Access safety limitations.',
          'I understand this Early Access version is not for emergencies or critical medical decisions.'
        ),
        (
          'welcome_guide_title',
          'Welcome guide title',
          'Headline for the first-run welcome card.',
          'Welcome to CarePland'
        ),
        (
          'careprep_manual_limit_message',
          'Manual CarePrep limit message',
          'Message shown when a user has used the current plan allowance for manual CarePrep generations.',
          'You have used this month''s manual CarePrep generations. Plan changes are not wired up yet, but support can help while account changes are still handled manually.'
        ),
        (
          'support_agent_product_facts',
          'Support agent product facts',
          'Product facts available to the support assistant.',
          'CarePland Personal helps people remember appointment details, prepare for future visits, and bring saved context forward. Users can add appointments manually, import appointments from pasted text, images, and .ics calendar files, search Google Places for clinics/businesses/addresses, save favorite locations with nicknames, generate CarePrep for upcoming appointments, add notes to logged appointments, and ask support questions in the app. Early Access plan tiers are Free, Active Use, Premium Individual, Group, and Early Access. The Early Access plan is intended for early adopters and currently includes Group-level functionality; it is not the default assignment while account changes are still handled manually. Manual CarePrep generation can be metered by plan; automatic appointment preparation is intended for Premium Individual, Group, and Early Access tiers. After Visit Notes are saved, CarePland can automatically prepare the next upcoming appointment for the same Care VIP when the plan includes automatic CarePrep. CarePrep refresh is only available when there are additional appointments to consider.'
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
      'Shift user-facing beta language to Early Access',
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

update public.plan_features
set limit_message = 'You have used this month''s manual CarePrep generations. Plan changes are not wired up yet, but support can help while account changes are still handled manually.'
where feature_key = 'careprep_manual'
  and limit_message = 'You have used this month''s manual CarePrep generations. Plan changes are not wired up yet, but support can help during beta.';
