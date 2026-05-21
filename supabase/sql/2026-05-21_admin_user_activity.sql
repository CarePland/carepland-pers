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
      coalesce(p.is_admin, false) as is_admin
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
    (
      pu.is_admin
      or pu.email ilike '%test%'
      or pu.email ilike '%@carepland.com'
      or pu.email in ('a@a.com', 'b@b.com', 'cc@c.com')
    ) as is_test_user
  from admin_check, profile_users pu
  left join appointment_activity aa on aa.user_id = pu.user_id
  left join note_activity na on na.user_id = pu.user_id
  left join careprep_activity cpa on cpa.user_id = pu.user_id
  left join support_activity sa on sa.user_id = pu.user_id
  order by coalesce(pu.last_seen_at, pu.account_created_at) desc nulls last;
$$;

grant execute on function public.get_admin_user_activity_summary()
  to authenticated;
