-- Reset disposable test accounts by email while preserving auth.users logins.
--
-- Usage:
--   select public.admin_reset_test_accounts_by_email(array[
--     'account-one@example.com',
--     'account-two@example.com'
--   ]::text[], false); -- dry run
--
--   select public.admin_reset_test_accounts_by_email(array[
--     'account-one@example.com',
--     'account-two@example.com'
--   ]::text[], true); -- apply
--
-- This is intentionally destructive for app-side data. It deletes rows tied to
-- the target users, their Care Circles, and their Care VIP/person rows, then
-- resets profile onboarding fields so each login can go through setup again.
-- It does not delete auth.users rows. Leave p_delete_profiles false unless you
-- explicitly want to remove public.profiles rows too.

create or replace function public.admin_reset_test_accounts_by_email(
  p_emails text[],
  p_apply boolean default false,
  p_delete_profiles boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  caller_is_admin boolean := false;
  target_emails text[];
  target_user_ids uuid[];
  target_profile_emails text[];
  target_care_circle_ids uuid[];
  target_subject_ids uuid[];
  table_to_reset record;
  where_parts text[];
  where_sql text;
  affected_count bigint;
  report jsonb := '{}'::jsonb;
  table_report jsonb := '{}'::jsonb;
begin
  if caller_user_id is not null then
    select coalesce(is_admin, false)
      into caller_is_admin
    from public.profiles
    where id = caller_user_id;

    if not coalesce(caller_is_admin, false) then
      raise exception 'Admin access required';
    end if;
  end if;

  select array_agg(distinct lower(trim(email_value)))
    into target_emails
  from unnest(coalesce(p_emails, array[]::text[])) as email_value
  where nullif(trim(email_value), '') is not null;

  if coalesce(array_length(target_emails, 1), 0) = 0 then
    raise exception 'At least one email is required';
  end if;

  select
    array_agg(p.id order by lower(trim(coalesce(p.email, ''))), p.id),
    array_agg(p.email order by lower(trim(coalesce(p.email, ''))), p.id)
    into target_user_ids, target_profile_emails
  from public.profiles p
  where lower(trim(coalesce(p.email, ''))) = any(target_emails);

  if coalesce(array_length(target_user_ids, 1), 0) = 0 then
    return jsonb_build_object(
      'apply', p_apply,
      'status', 'no_matching_profiles',
      'requestedEmails', target_emails
    );
  end if;

  select coalesce(array_agg(distinct care_circle_id), array[]::uuid[])
    into target_care_circle_ids
  from (
    select ccm.care_circle_id
    from public.care_circle_memberships ccm
    where ccm.user_id = any(target_user_ids)
    union
    select cs.care_circle_id
    from public.care_subjects cs
    where cs.account_user_id = any(target_user_ids)
  ) target_circles
  where care_circle_id is not null;

  select coalesce(array_agg(distinct cs.id), array[]::uuid[])
    into target_subject_ids
  from public.care_subjects cs
  where cs.account_user_id = any(target_user_ids)
     or cs.care_circle_id = any(target_care_circle_ids);

  report := jsonb_build_object(
    'apply', p_apply,
    'deleteProfiles', p_delete_profiles,
    'requestedEmails', target_emails,
    'matchedProfiles', target_profile_emails,
    'targetUserIds', target_user_ids,
    'targetCareCircleIds', target_care_circle_ids,
    'targetCareSubjectIds', target_subject_ids
  );

  if to_regclass('public.appointments') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'appointments'
         and column_name = 'current_note_id'
     ) then
    execute
      'select count(*) from public.appointments
       where current_note_id is not null
         and (
           care_circle_id = any($1)
           or care_subject_id = any($2)
         )'
      into affected_count
      using target_care_circle_ids, target_subject_ids;

    table_report := table_report || jsonb_build_object(
      'appointments.current_note_id',
      jsonb_build_object('operation', 'clear_reference', 'rows', affected_count)
    );

    if p_apply and affected_count > 0 then
      execute
        'update public.appointments
         set current_note_id = null
         where current_note_id is not null
           and (
             care_circle_id = any($1)
             or care_subject_id = any($2)
           )'
      using target_care_circle_ids, target_subject_ids;
    end if;
  end if;

  for table_to_reset in
    select
      c.table_schema,
      c.table_name,
      bool_or(c.column_name = 'user_id' and c.udt_name = 'uuid') as has_user_id,
      bool_or(c.column_name = 'care_circle_id' and c.udt_name = 'uuid') as has_care_circle_id,
      bool_or(c.column_name = 'care_subject_id' and c.udt_name = 'uuid') as has_care_subject_id,
      bool_or(c.column_name = 'main_connect_user_person_id' and c.udt_name = 'uuid') as has_main_connect_user_person_id,
      bool_or(c.column_name = 'person_id' and c.udt_name = 'uuid') as has_person_id
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name in (
        'user_id',
        'care_circle_id',
        'care_subject_id',
        'main_connect_user_person_id',
        'person_id'
      )
      and exists (
        select 1
        from pg_catalog.pg_tables t
        where t.schemaname = c.table_schema
          and t.tablename = c.table_name
      )
      and c.table_name not in (
        'care_circle_memberships',
        'care_circles',
        'care_subjects',
        'profiles'
      )
    group by c.table_schema, c.table_name
    order by
      case c.table_name
        when 'careprep_guidance' then 10
        when 'appointment_notes' then 20
        when 'topic_mentions' then 30
        when 'health_topic_feedback' then 40
        when 'health_topic_user_context' then 50
        when 'appointment_communication_summaries' then 60
        when 'appointments' then 90
        else 70
      end,
      c.table_name
  loop
    where_parts := array[]::text[];

    if table_to_reset.has_user_id then
      where_parts := where_parts || array['user_id = any($1)'];
    end if;

    if table_to_reset.has_care_circle_id then
      where_parts := where_parts || array['care_circle_id = any($2)'];
    end if;

    if table_to_reset.has_care_subject_id then
      where_parts := where_parts || array['care_subject_id = any($3)'];
    end if;

    if table_to_reset.has_main_connect_user_person_id then
      where_parts := where_parts || array['main_connect_user_person_id = any($3)'];
    end if;

    if table_to_reset.has_person_id then
      where_parts := where_parts || array['person_id = any($3)'];
    end if;

    where_sql := array_to_string(where_parts, ' or ');

    execute format(
      'select count(*) from %I.%I where %s',
      table_to_reset.table_schema,
      table_to_reset.table_name,
      where_sql
    )
    into affected_count
    using target_user_ids, target_care_circle_ids, target_subject_ids;

    if affected_count > 0 then
      table_report := table_report || jsonb_build_object(
        table_to_reset.table_name,
        jsonb_build_object('operation', 'delete', 'rows', affected_count)
      );

      if p_apply then
        execute format(
          'delete from %I.%I where %s',
          table_to_reset.table_schema,
          table_to_reset.table_name,
          where_sql
        )
        using target_user_ids, target_care_circle_ids, target_subject_ids;
      end if;
    end if;
  end loop;

  select count(*)
    into affected_count
  from public.care_subjects cs
  where cs.id = any(target_subject_ids);

  table_report := table_report || jsonb_build_object(
    'care_subjects',
    jsonb_build_object('operation', 'delete', 'rows', affected_count)
  );

  if p_apply and affected_count > 0 then
    delete from public.care_subjects cs
    where cs.id = any(target_subject_ids);
  end if;

  select count(*)
    into affected_count
  from public.care_circle_memberships ccm
  where ccm.user_id = any(target_user_ids)
     or ccm.care_circle_id = any(target_care_circle_ids);

  table_report := table_report || jsonb_build_object(
    'care_circle_memberships',
    jsonb_build_object('operation', 'delete', 'rows', affected_count)
  );

  if p_apply and affected_count > 0 then
    delete from public.care_circle_memberships ccm
    where ccm.user_id = any(target_user_ids)
       or ccm.care_circle_id = any(target_care_circle_ids);
  end if;

  if to_regclass('public.care_circles') is not null then
    execute
      'select count(*) from public.care_circles where id = any($1)'
      into affected_count
      using target_care_circle_ids;

    table_report := table_report || jsonb_build_object(
      'care_circles',
      jsonb_build_object('operation', 'delete', 'rows', affected_count)
    );

    if p_apply and affected_count > 0 then
      execute
        'delete from public.care_circles where id = any($1)'
      using target_care_circle_ids;
    end if;
  end if;

  if p_delete_profiles then
    select count(*)
      into affected_count
    from public.profiles p
    where p.id = any(target_user_ids);

    table_report := table_report || jsonb_build_object(
      'profiles',
      jsonb_build_object('operation', 'delete', 'rows', affected_count)
    );

    if p_apply and affected_count > 0 then
      delete from public.profiles p
      where p.id = any(target_user_ids);
    end if;
  else
    select count(*)
      into affected_count
    from public.profiles p
    where p.id = any(target_user_ids);

    table_report := table_report || jsonb_build_object(
      'profiles',
      jsonb_build_object('operation', 'reset_onboarding', 'rows', affected_count)
    );

    if p_apply and affected_count > 0 then
      update public.profiles p
      set
        display_name = null,
        given_name = null,
        family_name = null,
        phone = null,
        phone_e164 = null,
        timezone = null,
        address_line1 = null,
        address_line2 = null,
        city = null,
        region = null,
        postal_code = null,
        country = null,
        beta_terms_acknowledged_at = null,
        beta_privacy_acknowledged_at = null,
        beta_disclaimer_acknowledged_at = null,
        beta_agreement_version = null,
        onboarding_completed_at = null,
        sample_data_seeded_at = null,
        sample_data_declined_at = null,
        sample_data_seed_version = null,
        sample_data_seeded_by_user_id = null,
        welcome_guide_dismissed_at = null,
        welcome_guide_dismissed_version = null
      where p.id = any(target_user_ids);
    end if;
  end if;

  return report || jsonb_build_object(
    'status', case when p_apply then 'applied' else 'dry_run' end,
    'tables', table_report
  );
end;
$$;

grant execute on function public.admin_reset_test_accounts_by_email(text[], boolean, boolean)
  to authenticated;
