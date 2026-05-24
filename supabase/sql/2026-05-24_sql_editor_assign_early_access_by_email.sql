-- Supabase SQL Editor utility.
-- Replace the email below, then run the whole query.
-- This is intentionally a direct SQL update, not an RPC/function call,
-- because SQL Editor does not provide an app auth.uid() session.

with target_user as (
  select
    au.id as user_id,
    coalesce(nullif(trim(p.email), ''), au.email) as email
  from auth.users au
  left join public.profiles p on p.id = au.id
  where lower(coalesce(nullif(trim(p.email), ''), au.email)) =
    lower(trim('person@example.com'))
  order by au.created_at desc nulls last
  limit 1
),
primary_membership as (
  select distinct on (ccm.user_id)
    ccm.user_id,
    ccm.care_circle_id
  from public.care_circle_memberships ccm
  join target_user tu on tu.user_id = ccm.user_id
  where ccm.status = 'active'
  order by ccm.user_id, case when ccm.role = 'owner' then 0 else 1 end, ccm.created_at
),
updated_entitlement as (
  update public.care_circle_entitlements cce
  set plan_id = 'early_access'
  from primary_membership pm
  where cce.care_circle_id = pm.care_circle_id
    and cce.status = 'active'
  returning cce.care_circle_id, cce.plan_id, cce.status
)
select
  coalesce(ue.plan_id, 'not_updated') as result,
  tu.email,
  tu.user_id,
  pm.care_circle_id,
  ue.status as entitlement_status
from target_user tu
left join primary_membership pm on pm.user_id = tu.user_id
left join updated_entitlement ue on ue.care_circle_id = pm.care_circle_id;
