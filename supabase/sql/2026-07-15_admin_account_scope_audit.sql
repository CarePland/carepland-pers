-- Read-only account scope audit for suspected cross-account dependencies.
--
-- Usage:
--   select public.admin_audit_account_scope_by_email(array[
--     'account-one@example.com',
--     'account-two@example.com'
--   ]);
--
-- This function does not modify data. It summarizes profile rows, active Care
-- Circle memberships, account-linked CarePland people, and row counts in public
-- tables that scope by user_id, care_circle_id, care_subject_id,
-- main_connect_user_person_id, or person_id.
-- Repeated Care VIP display names are reported for review only; this audit does
-- not use names as ownership evidence.

create or replace function public.admin_audit_account_scope_by_email(
  p_emails text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  caller_is_admin boolean := false;
  target_profile record;
  target_result jsonb;
  membership_summary jsonb;
  subject_summary jsonb;
  duplicate_subject_name_summary jsonb;
  user_scoped_counts jsonb;
  circle_scoped_counts jsonb;
  person_scoped_counts jsonb;
  table_to_count record;
  row_count bigint;
  target_emails text[];
  results jsonb := '[]'::jsonb;
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
    return jsonb_build_object('accounts', '[]'::jsonb);
  end if;

  for target_profile in
    select
      p.id,
      p.email,
      p.display_name,
      p.given_name,
      p.family_name,
      p.is_admin,
      p.onboarding_completed_at,
      p.created_at
    from public.profiles p
    where lower(trim(coalesce(p.email, ''))) = any(target_emails)
    order by lower(trim(coalesce(p.email, ''))), p.created_at
  loop
    select coalesce(jsonb_agg(row_to_json(membership_row)::jsonb), '[]'::jsonb)
      into membership_summary
    from (
      select
        ccm.care_circle_id,
        ccm.role,
        ccm.status,
        ccm.created_at,
        (
          select count(*)
          from public.care_circle_memberships peer
          where peer.care_circle_id = ccm.care_circle_id
            and peer.status = 'active'
        ) as active_member_count,
        (
          select jsonb_agg(jsonb_build_object(
            'userId', peer.user_id,
            'email', peer_profile.email,
            'role', peer.role,
            'status', peer.status
          ) order by case when peer.role = 'owner' then 0 else 1 end, peer.created_at)
          from public.care_circle_memberships peer
          left join public.profiles peer_profile on peer_profile.id = peer.user_id
          where peer.care_circle_id = ccm.care_circle_id
            and peer.status = 'active'
        ) as active_members
      from public.care_circle_memberships ccm
      where ccm.user_id = target_profile.id
      order by case when ccm.role = 'owner' then 0 else 1 end, ccm.created_at
    ) membership_row;

    select coalesce(jsonb_agg(row_to_json(subject_row)::jsonb), '[]'::jsonb)
      into subject_summary
    from (
      select
        cs.id,
        cs.care_circle_id,
        cs.display_name,
        cs.subject_type,
        cs.is_default,
        cs.is_active,
        cs.account_user_id
      from public.care_subjects cs
      where cs.account_user_id = target_profile.id
         or exists (
           select 1
           from public.care_circle_memberships ccm
           where ccm.user_id = target_profile.id
             and ccm.status = 'active'
             and ccm.care_circle_id = cs.care_circle_id
         )
      order by cs.care_circle_id, cs.is_default desc, cs.display_name
    ) subject_row;

    select coalesce(jsonb_agg(row_to_json(duplicate_name_row)::jsonb), '[]'::jsonb)
      into duplicate_subject_name_summary
    from (
      with scoped_subjects as (
        select
          cs.id,
          cs.care_circle_id,
          cs.display_name,
          cs.account_user_id,
          lower(regexp_replace(trim(coalesce(cs.display_name, '')), '[[:space:]]+', ' ', 'g'))
            as normalized_display_name
        from public.care_subjects cs
        where cs.is_active = true
          and (
            cs.account_user_id = target_profile.id
            or exists (
              select 1
              from public.care_circle_memberships ccm
              where ccm.user_id = target_profile.id
                and ccm.status = 'active'
                and ccm.care_circle_id = cs.care_circle_id
            )
          )
      )
      select
        normalized_display_name,
        count(*) as subject_count,
        jsonb_agg(jsonb_build_object(
          'id', id,
          'careCircleId', care_circle_id,
          'displayName', display_name,
          'accountUserId', account_user_id
        ) order by care_circle_id, display_name, id) as subjects
      from scoped_subjects
      where normalized_display_name <> ''
      group by normalized_display_name
      having count(*) > 1
      order by subject_count desc, normalized_display_name
    ) duplicate_name_row;

    user_scoped_counts := '{}'::jsonb;
    for table_to_count in
      select c.table_schema, c.table_name
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.column_name = 'user_id'
        and exists (
          select 1
          from pg_catalog.pg_tables t
          where t.schemaname = c.table_schema
            and t.tablename = c.table_name
        )
      order by c.table_name
    loop
      execute format(
        'select count(*) from %I.%I where user_id = $1',
        table_to_count.table_schema,
        table_to_count.table_name
      )
      into row_count
      using target_profile.id;

      if row_count > 0 then
        user_scoped_counts := user_scoped_counts || jsonb_build_object(
          table_to_count.table_name,
          row_count
        );
      end if;
    end loop;

    circle_scoped_counts := '{}'::jsonb;
    for table_to_count in
      select c.table_schema, c.table_name
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.column_name = 'care_circle_id'
        and exists (
          select 1
          from pg_catalog.pg_tables t
          where t.schemaname = c.table_schema
            and t.tablename = c.table_name
        )
      order by c.table_name
    loop
      execute format(
        'select count(*) from %I.%I where care_circle_id in (
           select care_circle_id
           from public.care_circle_memberships
           where user_id = $1
             and status = ''active''
         )',
        table_to_count.table_schema,
        table_to_count.table_name
      )
      into row_count
      using target_profile.id;

      if row_count > 0 then
        circle_scoped_counts := circle_scoped_counts || jsonb_build_object(
          table_to_count.table_name,
          row_count
        );
      end if;
    end loop;

    person_scoped_counts := '{}'::jsonb;
    for table_to_count in
      select
        c.table_schema,
        c.table_name,
        c.column_name
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.column_name in (
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
      order by c.table_name, c.column_name
    loop
      execute format(
        'select count(*) from %I.%I where %I in (
           select id
           from public.care_subjects
           where account_user_id = $1
              or care_circle_id in (
                select care_circle_id
                from public.care_circle_memberships
                where user_id = $1
                  and status = ''active''
              )
         )',
        table_to_count.table_schema,
        table_to_count.table_name,
        table_to_count.column_name
      )
      into row_count
      using target_profile.id;

      if row_count > 0 then
        person_scoped_counts := person_scoped_counts || jsonb_build_object(
          table_to_count.table_name || '.' || table_to_count.column_name,
          row_count
        );
      end if;
    end loop;

    target_result := jsonb_build_object(
      'profile',
      jsonb_build_object(
        'id', target_profile.id,
        'email', target_profile.email,
        'displayName', target_profile.display_name,
        'givenName', target_profile.given_name,
        'familyName', target_profile.family_name,
        'isAdmin', target_profile.is_admin,
        'onboardingCompletedAt', target_profile.onboarding_completed_at,
        'createdAt', target_profile.created_at
      ),
      'memberships', membership_summary,
      'subjects', subject_summary,
      'duplicateSubjectNames', duplicate_subject_name_summary,
      'counts',
      jsonb_build_object(
        'byUserId', user_scoped_counts,
        'byActiveMembershipCareCircle', circle_scoped_counts,
        'byAccessibleOrAccountLinkedPerson', person_scoped_counts
      )
    );

    results := results || target_result;
  end loop;

  return jsonb_build_object(
    'requestedEmails', target_emails,
    'accounts', results,
    'missingEmails',
    (
      select coalesce(jsonb_agg(email_value), '[]'::jsonb)
      from unnest(target_emails) as email_value
      where not exists (
        select 1
        from public.profiles p
        where lower(trim(coalesce(p.email, ''))) = email_value
      )
    )
  );
end;
$$;

grant execute on function public.admin_audit_account_scope_by_email(text[])
  to authenticated;

create or replace function public.admin_audit_cross_account_care_circle_rows(
  p_emails text[]
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
  table_to_count record;
  row_count bigint;
  row_counts jsonb := '{}'::jsonb;
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
    return jsonb_build_object('tables', '{}'::jsonb);
  end if;

  for table_to_count in
    select c.table_schema, c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'care_circle_id'
      and exists (
        select 1
        from information_schema.columns user_column
        where user_column.table_schema = c.table_schema
          and user_column.table_name = c.table_name
          and user_column.column_name = 'user_id'
      )
      and exists (
        select 1
        from pg_catalog.pg_tables t
        where t.schemaname = c.table_schema
          and t.tablename = c.table_name
      )
    order by c.table_name
  loop
    execute format(
      'with target_profiles as (
         select id, email
         from public.profiles
         where lower(trim(coalesce(email, ''''))) = any($1)
       ),
       shared_memberships as (
         select ccm.care_circle_id
         from public.care_circle_memberships ccm
         where ccm.status = ''active''
           and ccm.user_id in (select id from target_profiles)
         group by ccm.care_circle_id
         having count(distinct ccm.user_id) > 1
       )
       select count(*)
       from %I.%I row_to_check
       where row_to_check.user_id in (select id from target_profiles)
         and row_to_check.care_circle_id in (select care_circle_id from shared_memberships)',
      table_to_count.table_schema,
      table_to_count.table_name
    )
    into row_count
    using target_emails;

    if row_count > 0 then
      row_counts := row_counts || jsonb_build_object(
        table_to_count.table_name,
        row_count
      );
    end if;
  end loop;

  return jsonb_build_object(
    'requestedEmails', target_emails,
    'tables', row_counts
  );
end;
$$;

grant execute on function public.admin_audit_cross_account_care_circle_rows(text[])
  to authenticated;
