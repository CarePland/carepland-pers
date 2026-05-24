create or replace function public.admin_list_non_early_access_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  care_circle_id uuid,
  plan_id text,
  plan_name text,
  entitlement_status text,
  onboarding_completed_at timestamptz,
  account_created_at timestamptz,
  last_seen_at timestamptz,
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
      p.onboarding_completed_at,
      au.created_at as account_created_at,
      p.last_seen_at,
      coalesce(p.is_admin, false) as is_admin,
      coalesce(p.is_test_user, false) as is_test_user
    from public.profiles p
    left join auth.users au on au.id = p.id
  ),
  primary_memberships as (
    select distinct on (ccm.user_id)
      ccm.user_id,
      ccm.care_circle_id
    from public.care_circle_memberships ccm
    where ccm.status = 'active'
    order by ccm.user_id, case when ccm.role = 'owner' then 0 else 1 end, ccm.created_at
  ),
  active_entitlements as (
    select distinct on (cce.care_circle_id)
      cce.care_circle_id,
      cce.plan_id,
      cce.status,
      pl.name as plan_name
    from public.care_circle_entitlements cce
    left join public.plans pl on pl.id = cce.plan_id
    where cce.status = 'active'
    order by cce.care_circle_id, cce.created_at desc
  )
  select
    pu.user_id,
    pu.email,
    pu.display_name,
    pm.care_circle_id,
    ae.plan_id,
    ae.plan_name,
    ae.status as entitlement_status,
    pu.onboarding_completed_at,
    pu.account_created_at,
    pu.last_seen_at,
    pu.is_admin,
    pu.is_test_user
  from admin_check
  cross join profile_users pu
  left join primary_memberships pm on pm.user_id = pu.user_id
  left join active_entitlements ae on ae.care_circle_id = pm.care_circle_id
  where coalesce(ae.plan_id, '') <> 'early_access'
  order by pu.account_created_at desc nulls last, pu.email;
$$;

grant execute on function public.admin_list_non_early_access_users()
  to authenticated;

-- Usage:
-- select * from public.admin_list_non_early_access_users();
