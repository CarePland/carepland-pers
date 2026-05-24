insert into public.plans (id, name, max_active_subjects)
values ('early_access', 'Early Access', 4)
on conflict (id) do update
set
  name = excluded.name,
  max_active_subjects = excluded.max_active_subjects;

insert into public.plan_features (
  plan_id,
  feature_key,
  is_enabled,
  limit_quantity,
  period,
  user_facing_name,
  limit_message
)
values
  (
    'early_access',
    'careprep_manual',
    true,
    null,
    'month',
    'Manual CarePrep generations',
    null
  ),
  (
    'early_access',
    'careprep_auto',
    true,
    null,
    'month',
    'Automatic appointment preparation',
    null
  )
on conflict (plan_id, feature_key) do update
set
  is_enabled = excluded.is_enabled,
  limit_quantity = excluded.limit_quantity,
  period = excluded.period,
  user_facing_name = excluded.user_facing_name,
  limit_message = excluded.limit_message,
  updated_at = now();

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
          'profile_plan_tier_help_body',
          'Plan tier help note',
          'Expandable Profile page note that briefly explains plan tier differences. Supports line breaks and basic bold tags: <b> or <strong>.',
          $$- <b>Free</b> is for light use.
- <b>Active Use</b> adds larger manual CarePrep and import allowances.
- <b>Premium Individual</b> adds automatic appointment preparation for one Care VIP.
- <b>Group</b> supports multiple Care VIPs.
- <b>Early Access</b> currently includes Group-level access for early adopters.$$
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
      'Add Early Access plan tier',
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
