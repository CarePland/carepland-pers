create or replace function public.admin_assign_early_access_by_email(
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  target_user_id uuid;
  target_care_circle_id uuid;
  updated_plan_id text;
begin
  perform public.assert_current_user_is_admin();

  if normalized_email = '' then
    raise exception 'Email is required';
  end if;

  select p.id
    into target_user_id
  from public.profiles p
  left join auth.users au on au.id = p.id
  where lower(coalesce(nullif(trim(p.email), ''), au.email)) = normalized_email
  order by p.created_at desc nulls last
  limit 1;

  if target_user_id is null then
    return jsonb_build_object(
      'status', 'user_not_found',
      'email', normalized_email
    );
  end if;

  select ccm.care_circle_id
    into target_care_circle_id
  from public.care_circle_memberships ccm
  where ccm.user_id = target_user_id
    and ccm.status = 'active'
  order by case when ccm.role = 'owner' then 0 else 1 end, ccm.created_at
  limit 1;

  if target_care_circle_id is null then
    return jsonb_build_object(
      'status', 'missing_care_circle',
      'email', normalized_email,
      'user_id', target_user_id
    );
  end if;

  update public.care_circle_entitlements cce
  set plan_id = 'early_access'
  where cce.care_circle_id = target_care_circle_id
    and cce.status = 'active'
  returning cce.plan_id into updated_plan_id;

  if updated_plan_id is null then
    return jsonb_build_object(
      'status', 'missing_active_entitlement',
      'email', normalized_email,
      'user_id', target_user_id,
      'care_circle_id', target_care_circle_id
    );
  end if;

  return jsonb_build_object(
    'status', 'updated',
    'email', normalized_email,
    'user_id', target_user_id,
    'care_circle_id', target_care_circle_id,
    'plan_id', updated_plan_id
  );
end;
$$;

grant execute on function public.admin_assign_early_access_by_email(text)
  to authenticated;

-- Usage:
-- select public.admin_assign_early_access_by_email('person@example.com');
