alter table public.profiles
  add column if not exists is_test_user boolean not null default false;

update public.profiles p
set is_test_user = true
from auth.users au
where au.id = p.id
  and (
    coalesce(p.is_admin, false) = true
    or coalesce(p.email, au.email) ilike '%test%'
    or coalesce(p.email, au.email) ilike '%@carepland.com'
    or coalesce(p.email, au.email) in ('a@a.com', 'b@b.com', 'cc@c.com')
  );

create or replace function public.set_admin_profile_test_user(
  p_email text,
  p_is_test_user boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles%rowtype;
begin
  perform public.assert_current_user_is_admin();

  if nullif(trim(p_email), '') is null then
    raise exception 'Email is required';
  end if;

  update public.profiles p
  set is_test_user = coalesce(p_is_test_user, false)
  from auth.users au
  where au.id = p.id
    and lower(coalesce(p.email, au.email)) = lower(trim(p_email))
  returning p.* into updated_profile;

  if not found then
    raise exception 'Profile not found for email %', p_email;
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.set_admin_profile_test_user(text, boolean)
  to authenticated;

-- Usage examples:
-- select public.set_admin_profile_test_user('person@example.com', true);
-- select public.set_admin_profile_test_user('person@example.com', false);

create or replace function public.get_admin_user_activity_summary()
returns table (
  user_id uuid,
  email text,
  display_name text,
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
  left join appointment_activity aa on aa.user_id = pu.user_id
  left join note_activity na on na.user_id = pu.user_id
  left join careprep_activity cpa on cpa.user_id = pu.user_id
  left join support_activity sa on sa.user_id = pu.user_id
  order by coalesce(pu.last_seen_at, pu.account_created_at) desc nulls last;
$$;

grant execute on function public.get_admin_user_activity_summary()
  to authenticated;
