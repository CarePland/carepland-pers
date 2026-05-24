create or replace function public.assign_current_user_primary_plan(
  p_plan_id text default 'early_access'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  target_care_circle_id uuid;
  updated_plan_id text;
begin
  if caller_user_id is null then
    raise exception 'Must be signed in to assign a plan';
  end if;

  if not exists (
    select 1
    from public.plans p
    where p.id = p_plan_id
  ) then
    raise exception 'Unknown plan id: %', p_plan_id;
  end if;

  select ccm.care_circle_id
    into target_care_circle_id
  from public.care_circle_memberships ccm
  where ccm.user_id = caller_user_id
    and ccm.status = 'active'
  order by case when ccm.role = 'owner' then 0 else 1 end, ccm.created_at
  limit 1;

  if target_care_circle_id is null then
    return jsonb_build_object(
      'status', 'missing_care_circle',
      'plan_id', p_plan_id
    );
  end if;

  update public.care_circle_entitlements cce
  set plan_id = p_plan_id
  where cce.care_circle_id = target_care_circle_id
    and cce.status = 'active'
  returning cce.plan_id into updated_plan_id;

  if updated_plan_id is null then
    return jsonb_build_object(
      'status', 'missing_active_entitlement',
      'care_circle_id', target_care_circle_id,
      'plan_id', p_plan_id
    );
  end if;

  return jsonb_build_object(
    'status', 'updated',
    'care_circle_id', target_care_circle_id,
    'plan_id', updated_plan_id
  );
end;
$$;

grant execute on function public.assign_current_user_primary_plan(text)
  to authenticated;
