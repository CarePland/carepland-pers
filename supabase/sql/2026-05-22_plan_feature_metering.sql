create table if not exists public.plan_features (
  plan_id text not null references public.plans(id) on delete cascade,
  feature_key text not null,
  is_enabled boolean not null default true,
  limit_quantity integer,
  period text not null default 'month'
    check (period in ('day', 'week', 'month', 'none')),
  user_facing_name text not null,
  limit_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, feature_key),
  check (limit_quantity is null or limit_quantity >= 0)
);

create table if not exists public.care_circle_feature_usage (
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  feature_key text not null,
  period text not null check (period in ('day', 'week', 'month', 'none')),
  period_start timestamptz not null,
  used_quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (care_circle_id, feature_key, period, period_start),
  check (used_quantity >= 0)
);

create index if not exists plan_features_feature_key_idx
  on public.plan_features (feature_key);

create index if not exists care_circle_feature_usage_lookup_idx
  on public.care_circle_feature_usage (care_circle_id, feature_key, period_start desc);

alter table public.plan_features enable row level security;
alter table public.care_circle_feature_usage enable row level security;

grant select on public.plan_features to authenticated;
grant select on public.care_circle_feature_usage to authenticated;

drop policy if exists "Authenticated users can read plan features"
  on public.plan_features;
create policy "Authenticated users can read plan features"
  on public.plan_features
  for select
  to authenticated
  using (true);

drop policy if exists "Care circle members can read feature usage"
  on public.care_circle_feature_usage;
create policy "Care circle members can read feature usage"
  on public.care_circle_feature_usage
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_circle_feature_usage.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

create or replace function public.feature_usage_period_start(
  p_period text,
  p_reference_time timestamptz default now()
)
returns timestamptz
language sql
stable
as $$
  select case p_period
    when 'day' then date_trunc('day', p_reference_time)
    when 'week' then date_trunc('week', p_reference_time)
    when 'month' then date_trunc('month', p_reference_time)
    else '1970-01-01 00:00:00+00'::timestamptz
  end;
$$;

create or replace function public.current_plan_feature_row(
  p_care_circle_id uuid,
  p_feature_key text
)
returns table (
  plan_id text,
  plan_name text,
  feature_key text,
  is_enabled boolean,
  limit_quantity integer,
  period text,
  user_facing_name text,
  limit_message text
)
language sql
stable
security definer
set search_path = public
as $$
  with active_entitlement as (
    select cce.plan_id
    from public.care_circle_entitlements cce
    where cce.care_circle_id = p_care_circle_id
      and cce.status = 'active'
    limit 1
  ),
  selected_plan as (
    select coalesce((select plan_id from active_entitlement), 'personal') as plan_id
  )
  select
    p.id as plan_id,
    p.name as plan_name,
    pf.feature_key,
    coalesce(pf.is_enabled, false) as is_enabled,
    pf.limit_quantity,
    coalesce(pf.period, 'month') as period,
    coalesce(pf.user_facing_name, p_feature_key) as user_facing_name,
    pf.limit_message
  from selected_plan sp
  join public.plans p
    on p.id = sp.plan_id
  left join public.plan_features pf
    on pf.plan_id = p.id
   and pf.feature_key = lower(trim(p_feature_key))
  where exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = p_care_circle_id
      and ccm.user_id = auth.uid()
      and ccm.status = 'active'
  );
$$;

create or replace function public.check_feature_access(
  p_care_circle_id uuid,
  p_feature_key text,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  feature_row record;
  v_period_start timestamptz;
  used integer := 0;
  requested integer := greatest(coalesce(p_quantity, 1), 1);
begin
  if not exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = p_care_circle_id
      and ccm.user_id = auth.uid()
      and ccm.status = 'active'
  ) then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'not_member',
      'message', 'You do not have access to this Care Circle.'
    );
  end if;

  select *
  into feature_row
  from public.current_plan_feature_row(p_care_circle_id, p_feature_key)
  limit 1;

  if feature_row.feature_key is null or coalesce(feature_row.is_enabled, false) = false then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'not_enabled',
      'plan_id', feature_row.plan_id,
      'plan_name', feature_row.plan_name,
      'feature_key', lower(trim(p_feature_key)),
      'message', coalesce(feature_row.limit_message, 'This feature is not included in your current plan.')
    );
  end if;

  v_period_start := public.feature_usage_period_start(feature_row.period);

  select coalesce(cfu.used_quantity, 0)
  into used
  from public.care_circle_feature_usage cfu
  where cfu.care_circle_id = p_care_circle_id
    and cfu.feature_key = feature_row.feature_key
    and cfu.period = feature_row.period
    and cfu.period_start = v_period_start;

  used := coalesce(used, 0);

  if feature_row.limit_quantity is not null
     and used + requested > feature_row.limit_quantity then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'limit_reached',
      'plan_id', feature_row.plan_id,
      'plan_name', feature_row.plan_name,
      'feature_key', feature_row.feature_key,
      'feature_name', feature_row.user_facing_name,
      'period', feature_row.period,
      'limit', feature_row.limit_quantity,
      'used', used,
      'remaining', greatest(feature_row.limit_quantity - used, 0),
      'message', coalesce(
        feature_row.limit_message,
        'You have used this plan allowance for now.'
      )
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'reason', 'allowed',
    'plan_id', feature_row.plan_id,
    'plan_name', feature_row.plan_name,
    'feature_key', feature_row.feature_key,
    'feature_name', feature_row.user_facing_name,
    'period', feature_row.period,
    'limit', feature_row.limit_quantity,
    'used', used,
    'remaining', case
      when feature_row.limit_quantity is null then null
      else greatest(feature_row.limit_quantity - used, 0)
    end
  );
end;
$$;

create or replace function public.consume_feature_usage(
  p_care_circle_id uuid,
  p_feature_key text,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  access_result jsonb;
  feature_row record;
  v_period_start timestamptz;
  requested integer := greatest(coalesce(p_quantity, 1), 1);
  new_used integer;
begin
  access_result := public.check_feature_access(
    p_care_circle_id,
    p_feature_key,
    requested
  );

  if coalesce((access_result ->> 'allowed')::boolean, false) = false then
    return access_result;
  end if;

  select *
  into feature_row
  from public.current_plan_feature_row(p_care_circle_id, p_feature_key)
  limit 1;

  v_period_start := public.feature_usage_period_start(feature_row.period);

  if feature_row.limit_quantity is null then
    insert into public.care_circle_feature_usage (
      care_circle_id,
      feature_key,
      period,
      period_start,
      used_quantity,
      updated_at
    )
    values (
      p_care_circle_id,
      feature_row.feature_key,
      feature_row.period,
      v_period_start,
      requested,
      now()
    )
    on conflict (care_circle_id, feature_key, period, period_start)
    do update
      set used_quantity = public.care_circle_feature_usage.used_quantity + requested,
          updated_at = now()
    returning used_quantity into new_used;
  else
    insert into public.care_circle_feature_usage (
      care_circle_id,
      feature_key,
      period,
      period_start,
      used_quantity,
      updated_at
    )
    values (
      p_care_circle_id,
      feature_row.feature_key,
      feature_row.period,
      v_period_start,
      requested,
      now()
    )
    on conflict (care_circle_id, feature_key, period, period_start)
    do update
      set used_quantity = public.care_circle_feature_usage.used_quantity + requested,
          updated_at = now()
      where public.care_circle_feature_usage.used_quantity + requested <= feature_row.limit_quantity
    returning used_quantity into new_used;

    if new_used is null then
      return public.check_feature_access(p_care_circle_id, p_feature_key, requested);
    end if;
  end if;

  return access_result || jsonb_build_object(
    'used', new_used,
    'remaining', case
      when feature_row.limit_quantity is null then null
      else greatest(feature_row.limit_quantity - new_used, 0)
    end
  );
end;
$$;

create or replace function public.refund_feature_usage(
  p_care_circle_id uuid,
  p_feature_key text,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  feature_row record;
  v_period_start timestamptz;
  requested integer := greatest(coalesce(p_quantity, 1), 1);
  new_used integer;
begin
  if not exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = p_care_circle_id
      and ccm.user_id = auth.uid()
      and ccm.status = 'active'
  ) then
    return jsonb_build_object('refunded', false, 'reason', 'not_member');
  end if;

  select *
  into feature_row
  from public.current_plan_feature_row(p_care_circle_id, p_feature_key)
  limit 1;

  if feature_row.feature_key is null then
    return jsonb_build_object('refunded', false, 'reason', 'feature_not_found');
  end if;

  v_period_start := public.feature_usage_period_start(feature_row.period);

  update public.care_circle_feature_usage
  set used_quantity = greatest(used_quantity - requested, 0),
      updated_at = now()
  where care_circle_id = p_care_circle_id
    and feature_key = feature_row.feature_key
    and period = feature_row.period
    and period_start = v_period_start
  returning used_quantity into new_used;

  return jsonb_build_object(
    'refunded', new_used is not null,
    'feature_key', feature_row.feature_key,
    'used', new_used
  );
end;
$$;

grant execute on function public.feature_usage_period_start(text, timestamptz)
  to authenticated;
grant execute on function public.current_plan_feature_row(uuid, text)
  to authenticated;
grant execute on function public.check_feature_access(uuid, text, integer)
  to authenticated;
grant execute on function public.consume_feature_usage(uuid, text, integer)
  to authenticated;
grant execute on function public.refund_feature_usage(uuid, text, integer)
  to authenticated;

insert into public.plan_features (
  plan_id,
  feature_key,
  is_enabled,
  limit_quantity,
  period,
  user_facing_name,
  limit_message
)
values
  (
    'personal',
    'careprep_manual',
    true,
    3,
    'month',
    'Manual CarePrep generations',
    'You have used this month''s manual CarePrep generations. Plan changes are not wired up yet, but support can help while account changes are still handled manually.'
  ),
  (
    'active_use',
    'careprep_manual',
    true,
    25,
    'month',
    'Manual CarePrep generations',
    'You have used this month''s manual CarePrep generations. Plan changes are not wired up yet, but support can help while account changes are still handled manually.'
  ),
  (
    'premium_individual',
    'careprep_manual',
    true,
    null,
    'month',
    'Manual CarePrep generations',
    null
  ),
  (
    'personal_plus',
    'careprep_manual',
    true,
    1,
    'month',
    'Manual CarePrep generations',
    'You have used this month''s manual CarePrep generations. Plan changes are not wired up yet, but support can help while account changes are still handled manually.'
  ),
  (
    'early_access',
    'careprep_manual',
    true,
    null,
    'month',
    'Manual CarePrep generations',
    null
  ),
  (
    'personal',
    'careprep_auto',
    false,
    0,
    'month',
    'Automatic appointment preparation',
    'Automatic appointment preparation is not included in your current plan.'
  ),
  (
    'active_use',
    'careprep_auto',
    false,
    0,
    'month',
    'Automatic appointment preparation',
    'Automatic appointment preparation is not included in your current plan.'
  ),
  (
    'premium_individual',
    'careprep_auto',
    true,
    null,
    'month',
    'Automatic appointment preparation',
    null
  ),
  (
    'personal_plus',
    'careprep_auto',
    true,
    null,
    'month',
    'Automatic appointment preparation',
    null
  ),
  (
    'early_access',
    'careprep_auto',
    true,
    null,
    'month',
    'Automatic appointment preparation',
    null
  )
on conflict (plan_id, feature_key) do update
set
  is_enabled = excluded.is_enabled,
  limit_quantity = excluded.limit_quantity,
  period = excluded.period,
  user_facing_name = excluded.user_facing_name,
  limit_message = excluded.limit_message,
  updated_at = now();
