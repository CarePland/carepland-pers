-- Smallest safe user lifecycle foundation.
--
-- V1 intentionally exposes one user-facing inactive state. The metadata columns
-- are extensible for future suspend/archive/privacy workflows, but this pass
-- does not implement archive, deletion, anonymization, or household offboarding.

alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'inactive')),
  add column if not exists account_inactivated_at timestamptz,
  add column if not exists account_inactivated_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists account_restored_at timestamptz,
  add column if not exists account_restored_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists account_lifecycle_reason text;

create index if not exists profiles_account_status_idx
  on public.profiles (account_status, updated_at desc);

comment on column public.profiles.account_status is
  'User-facing lifecycle status for the login account. V1 supports active and inactive only.';

comment on column public.profiles.account_inactivated_at is
  'When an Admin marked this login account inactive.';

comment on column public.profiles.account_restored_at is
  'When an Admin restored this login account to active.';

create or replace function public.current_account_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.account_status, 'active') = 'active'
  );
$$;

grant execute on function public.current_account_is_active() to authenticated;

create or replace function public.assert_current_user_is_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
      and coalesce(p.account_status, 'active') = 'active'
  ) then
    raise exception 'Active Admin access required';
  end if;
end;
$$;

grant execute on function public.assert_current_user_is_admin() to authenticated;

drop function if exists public.get_admin_user_activity_summary();

create or replace function public.get_admin_user_activity_summary()
returns table (
  user_id uuid,
  email text,
  display_name text,
  account_status text,
  account_inactivated_at timestamptz,
  care_subjects jsonb,
  user_group text,
  account_created_at timestamptz,
  last_seen_at timestamptz,
  appointment_count bigint,
  upcoming_appointment_count bigint,
  logged_appointment_count bigint,
  note_count bigint,
  careprep_count bigint,
  support_ticket_count bigint,
  open_support_ticket_count bigint,
  last_appointment_created_at timestamptz,
  last_appointment_starts_at timestamptz,
  last_note_created_at timestamptz,
  last_careprep_generated_at timestamptz,
  last_support_ticket_at timestamptz,
  is_admin boolean,
  is_test_user boolean
)
language sql
security definer
set search_path = public
as $$
  with admin_check as (
    select public.assert_current_user_is_admin()
  ),
  profile_users as (
    select
      p.id as user_id,
      coalesce(nullif(trim(p.email), ''), au.email) as email,
      coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(concat_ws(' ', p.given_name, p.family_name)), ''),
        coalesce(nullif(trim(p.email), ''), au.email)
      ) as display_name,
      coalesce(p.account_status, 'active') as account_status,
      p.account_inactivated_at,
      au.created_at as account_created_at,
      p.last_seen_at,
      coalesce(p.is_admin, false) as is_admin,
      coalesce(p.is_test_user, false) as is_test_user
    from public.profiles p
    left join auth.users au on au.id = p.id
  ),
  user_circles as (
    select distinct user_id, care_circle_id
    from public.care_circle_memberships
  ),
  owner_rows as (
    select distinct on (uc.user_id)
      uc.user_id,
      coalesce(
        nullif(trim(owner_profile.display_name), ''),
        nullif(trim(concat_ws(' ', owner_profile.given_name, owner_profile.family_name)), ''),
        nullif(trim(owner_profile.email), ''),
        owner_auth.email,
        'Unknown owner'
      ) as user_group
    from user_circles uc
    left join public.care_circle_memberships owner_membership
      on owner_membership.care_circle_id = uc.care_circle_id
      and owner_membership.role = 'owner'
    left join public.profiles owner_profile
      on owner_profile.id = owner_membership.user_id
    left join auth.users owner_auth
      on owner_auth.id = owner_membership.user_id
    order by
      uc.user_id,
      case when owner_membership.user_id = uc.user_id then 0 else 1 end,
      owner_membership.created_at asc nulls last
  ),
  care_subject_rows as (
    select
      uc.user_id,
      jsonb_agg(
        jsonb_build_object(
          'id', cs.id,
          'care_circle_id', cs.care_circle_id,
          'display_name', cs.display_name,
          'subject_type', cs.subject_type,
          'is_default', cs.is_default,
          'is_active', cs.is_active
        )
        order by cs.is_default desc, cs.display_name asc
      ) filter (where cs.id is not null) as care_subjects
    from user_circles uc
    left join public.care_subjects cs
      on cs.care_circle_id = uc.care_circle_id
      and coalesce(cs.is_active, true) = true
    group by uc.user_id
  ),
  appointment_activity as (
    select
      uc.user_id,
      count(distinct a.id) as appointment_count,
      count(distinct a.id) filter (
        where a.status <> 'archived'
          and a.current_note_id is null
          and (a.starts_at is null or a.starts_at >= date_trunc('day', now()))
      ) as upcoming_appointment_count,
      count(distinct a.id) filter (
        where a.status <> 'archived'
          and a.current_note_id is not null
      ) as logged_appointment_count,
      max(a.created_at) as last_appointment_created_at,
      max(a.starts_at) as last_appointment_starts_at
    from user_circles uc
    join public.appointments a on a.care_circle_id = uc.care_circle_id
    group by uc.user_id
  ),
  note_activity as (
    select
      uc.user_id,
      count(distinct n.id) as note_count,
      max(n.created_at) as last_note_created_at
    from user_circles uc
    join public.appointments a on a.care_circle_id = uc.care_circle_id
    join public.appointment_notes n on n.appointment_id = a.id
    group by uc.user_id
  ),
  careprep_activity as (
    select
      uc.user_id,
      count(distinct cg.id) as careprep_count,
      max(cg.generated_at) as last_careprep_generated_at
    from user_circles uc
    join public.appointments a on a.care_circle_id = uc.care_circle_id
    join public.careprep_guidance cg on cg.appointment_id = a.id
    group by uc.user_id
  ),
  support_activity as (
    select
      st.user_id,
      count(distinct st.id) as support_ticket_count,
      count(distinct st.id) filter (
        where st.status not in ('resolved', 'closed')
      ) as open_support_ticket_count,
      max(st.updated_at) as last_support_ticket_at
    from public.support_tickets st
    group by st.user_id
  )
  select
    pu.user_id,
    pu.email,
    pu.display_name,
    pu.account_status,
    pu.account_inactivated_at,
    coalesce(csr.care_subjects, '[]'::jsonb) as care_subjects,
    coalesce(ow.user_group, pu.display_name, pu.email, 'Unknown owner') as user_group,
    pu.account_created_at,
    pu.last_seen_at,
    coalesce(aa.appointment_count, 0) as appointment_count,
    coalesce(aa.upcoming_appointment_count, 0) as upcoming_appointment_count,
    coalesce(aa.logged_appointment_count, 0) as logged_appointment_count,
    coalesce(na.note_count, 0) as note_count,
    coalesce(cpa.careprep_count, 0) as careprep_count,
    coalesce(sa.support_ticket_count, 0) as support_ticket_count,
    coalesce(sa.open_support_ticket_count, 0) as open_support_ticket_count,
    aa.last_appointment_created_at,
    aa.last_appointment_starts_at,
    na.last_note_created_at,
    cpa.last_careprep_generated_at,
    sa.last_support_ticket_at,
    pu.is_admin,
    pu.is_admin or pu.is_test_user as is_test_user
  from admin_check, profile_users pu
  left join owner_rows ow on ow.user_id = pu.user_id
  left join care_subject_rows csr on csr.user_id = pu.user_id
  left join appointment_activity aa on aa.user_id = pu.user_id
  left join note_activity na on na.user_id = pu.user_id
  left join careprep_activity cpa on cpa.user_id = pu.user_id
  left join support_activity sa on sa.user_id = pu.user_id
  order by coalesce(pu.last_seen_at, pu.account_created_at) desc nulls last;
$$;

grant execute on function public.get_admin_user_activity_summary()
  to authenticated;
