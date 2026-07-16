-- Repair accidental shared Care Circles created during single-account beta use.
--
-- Usage:
--   select * from public.admin_preview_shared_care_circles();
--   select public.admin_repair_shared_care_circles(true);  -- dry run
--   select public.admin_repair_shared_care_circles(false); -- apply
--
-- The repair keeps the owner/earliest account on the original Care Circle,
-- moves each additional active account membership to a new Care Circle, copies
-- the active entitlement, and moves only rows scoped to that account-linked
-- `care_subjects.account_user_id`. Ambiguous Care VIPs remain with the original
-- owner circle for manual review.
--
-- Important: if the active/default Care VIP has `account_user_id is null`, this
-- repair will not guess ownership from display names. Use the account-scope
-- audit first and handle ambiguous Care VIP/history movement manually.

create or replace function public.admin_preview_shared_care_circles()
returns table (
  care_circle_id uuid,
  active_member_count integer,
  keeper_user_id uuid,
  keeper_email text,
  extra_user_ids uuid[],
  extra_emails text[],
  account_linked_subject_count integer,
  ambiguous_subject_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  caller_is_admin boolean := false;
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

  return query
  with ranked_memberships as (
    select
      ccm.care_circle_id,
      ccm.user_id,
      p.email,
      row_number() over (
        partition by ccm.care_circle_id
        order by case when ccm.role = 'owner' then 0 else 1 end, ccm.created_at, ccm.user_id
      ) as membership_rank,
      count(*) over (partition by ccm.care_circle_id) as member_count
    from public.care_circle_memberships ccm
    left join public.profiles p on p.id = ccm.user_id
    where ccm.status = 'active'
  ),
  shared_circles as (
    select distinct care_circle_id
    from ranked_memberships
    where member_count > 1
  )
  select
    sc.care_circle_id,
    max(rm.member_count)::integer as active_member_count,
    max(rm.user_id) filter (where rm.membership_rank = 1) as keeper_user_id,
    max(rm.email) filter (where rm.membership_rank = 1) as keeper_email,
    coalesce(
      array_agg(rm.user_id order by rm.membership_rank)
        filter (where rm.membership_rank > 1),
      array[]::uuid[]
    ) as extra_user_ids,
    coalesce(
      array_agg(rm.email order by rm.membership_rank)
        filter (where rm.membership_rank > 1),
      array[]::text[]
    ) as extra_emails,
    count(distinct cs.id)
      filter (where cs.account_user_id is not null)::integer
      as account_linked_subject_count,
    count(distinct cs.id)
      filter (where cs.account_user_id is null)::integer
      as ambiguous_subject_count
  from shared_circles sc
  join ranked_memberships rm on rm.care_circle_id = sc.care_circle_id
  left join public.care_subjects cs on cs.care_circle_id = sc.care_circle_id
    and cs.is_active = true
  group by sc.care_circle_id
  order by active_member_count desc, sc.care_circle_id;
end;
$$;

grant execute on function public.admin_preview_shared_care_circles()
  to authenticated;

create or replace function public.admin_repair_shared_care_circles(
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  caller_is_admin boolean := false;
  shared_membership record;
  new_care_circle_id uuid;
  new_subject_id uuid;
  moved_subject_ids uuid[];
  result_items jsonb := '[]'::jsonb;
  table_to_update record;
  account_display_name text;
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

  for shared_membership in
    with ranked_memberships as (
      select
        ccm.care_circle_id,
        ccm.user_id,
        ccm.role,
        ccm.created_at,
        p.email,
        p.display_name,
        p.given_name,
        p.family_name,
        row_number() over (
          partition by ccm.care_circle_id
          order by case when ccm.role = 'owner' then 0 else 1 end, ccm.created_at, ccm.user_id
        ) as membership_rank,
        count(*) over (partition by ccm.care_circle_id) as member_count
      from public.care_circle_memberships ccm
      left join public.profiles p on p.id = ccm.user_id
      where ccm.status = 'active'
    )
    select *
    from ranked_memberships
    where member_count > 1
      and membership_rank > 1
    order by care_circle_id, membership_rank
  loop
    new_care_circle_id := null;
    new_subject_id := null;
    moved_subject_ids := array[]::uuid[];

    select coalesce(
      nullif(trim(shared_membership.display_name), ''),
      nullif(trim(concat_ws(' ', shared_membership.given_name, shared_membership.family_name)), ''),
      nullif(trim(shared_membership.email), ''),
      'Care VIP'
    )
      into account_display_name;

    select coalesce(array_agg(cs.id), array[]::uuid[])
      into moved_subject_ids
    from public.care_subjects cs
    where cs.care_circle_id = shared_membership.care_circle_id
      and cs.account_user_id = shared_membership.user_id;

    if not p_dry_run then
      insert into public.care_circles default values
      returning id into new_care_circle_id;

      update public.care_circle_memberships ccm
      set care_circle_id = new_care_circle_id,
          role = 'owner'
      where ccm.care_circle_id = shared_membership.care_circle_id
        and ccm.user_id = shared_membership.user_id
        and ccm.status = 'active';

      insert into public.care_circle_entitlements (
        care_circle_id,
        plan_id,
        status
      )
      select
        new_care_circle_id,
        cce.plan_id,
        cce.status
      from public.care_circle_entitlements cce
      where cce.care_circle_id = shared_membership.care_circle_id
        and cce.status = 'active'
      limit 1;

      if array_length(moved_subject_ids, 1) is null then
        insert into public.care_subjects (
          account_user_id,
          care_circle_id,
          display_name,
          is_active,
          is_default,
          subject_type
        )
        values (
          shared_membership.user_id,
          new_care_circle_id,
          account_display_name,
          true,
          true,
          'other'
        )
        returning id into new_subject_id;

        moved_subject_ids := array[new_subject_id];
      end if;

      update public.care_subjects cs
      set care_circle_id = new_care_circle_id,
          is_default = true
      where cs.id = any(moved_subject_ids);

      for table_to_update in
        select
          c.table_schema,
          c.table_name,
          person_column.column_name as person_column_name
        from information_schema.columns c
        join information_schema.columns person_column
          on person_column.table_schema = c.table_schema
          and person_column.table_name = c.table_name
          and person_column.column_name in (
            'care_subject_id',
            'main_connect_user_person_id',
            'person_id'
          )
        where c.table_schema = 'public'
          and c.column_name = 'care_circle_id'
          and exists (
            select 1
            from pg_catalog.pg_tables t
            where t.schemaname = c.table_schema
              and t.tablename = c.table_name
          )
          and c.table_name <> 'care_subjects'
      loop
        execute format(
          'update %I.%I set care_circle_id = $1 where care_circle_id = $2 and %I = any($3)',
          table_to_update.table_schema,
          table_to_update.table_name,
          table_to_update.person_column_name
        )
        using new_care_circle_id, shared_membership.care_circle_id, moved_subject_ids;
      end loop;
    end if;

    result_items := result_items || jsonb_build_object(
      'status', case when p_dry_run then 'would_split' else 'split' end,
      'oldCareCircleId', shared_membership.care_circle_id,
      'newCareCircleId', new_care_circle_id,
      'userId', shared_membership.user_id,
      'email', shared_membership.email,
      'movedSubjectIds', moved_subject_ids
    );
  end loop;

  return jsonb_build_object(
    'dryRun', p_dry_run,
    'repairCount', jsonb_array_length(result_items),
    'repairs', result_items
  );
end;
$$;

grant execute on function public.admin_repair_shared_care_circles(boolean)
  to authenticated;
