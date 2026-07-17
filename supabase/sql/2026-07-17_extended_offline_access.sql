create table if not exists public.offline_authorizations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.care_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  requested_at timestamptz not null default now(),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  reason_code text,
  subscription_tier_at_issue text,
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked')),
  authorization_fingerprint text,
  created_at timestamptz not null default now(),
  check (device_id <> ''),
  check (
    reason_code is null or reason_code in (
      'travel',
      'hospital_or_care_facility',
      'limited_internet_access',
      'emergency_preparation',
      'other',
      'prefer_not_to_say'
    )
  )
);

create index if not exists offline_authorizations_account_requested_idx
  on public.offline_authorizations (account_id, requested_at desc);

create index if not exists offline_authorizations_active_device_idx
  on public.offline_authorizations (account_id, device_id, expires_at desc)
  where status = 'active';

alter table public.offline_authorizations enable row level security;

grant select on public.offline_authorizations to authenticated;

drop policy if exists "Care circle members can read offline authorizations"
  on public.offline_authorizations;
create policy "Care circle members can read offline authorizations"
  on public.offline_authorizations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = offline_authorizations.account_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

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
    'extended_offline_access',
    false,
    0,
    'none',
    'Extended offline access',
    'Extended offline access is not included with this plan.'
  ),
  (
    'active_use',
    'extended_offline_access',
    true,
    null,
    'none',
    'Extended offline access',
    null
  ),
  (
    'premium_individual',
    'extended_offline_access',
    true,
    null,
    'none',
    'Extended offline access',
    null
  ),
  (
    'personal_plus',
    'extended_offline_access',
    true,
    null,
    'none',
    'Extended offline access',
    null
  ),
  (
    'early_access',
    'extended_offline_access',
    true,
    null,
    'none',
    'Extended offline access',
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

create or replace function public.issue_offline_authorization(
  p_account_id uuid,
  p_device_id text,
  p_reason_code text default null
)
returns table (
  id uuid,
  account_id uuid,
  user_id uuid,
  device_id text,
  requested_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  reason_code text,
  subscription_tier_at_issue text,
  status text,
  next_eligible_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  access_result jsonb;
  latest_issue_at timestamptz;
  now_at timestamptz := now();
  inserted_row public.offline_authorizations%rowtype;
  normalized_reason text := nullif(trim(coalesce(p_reason_code, '')), '');
begin
  if p_device_id is null or trim(p_device_id) = '' then
    raise exception 'Device is required.' using errcode = '22023';
  end if;

  if normalized_reason is not null and normalized_reason not in (
    'travel',
    'hospital_or_care_facility',
    'limited_internet_access',
    'emergency_preparation',
    'other',
    'prefer_not_to_say'
  ) then
    raise exception 'Unsupported offline access reason.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = p_account_id
      and ccm.user_id = auth.uid()
      and ccm.status = 'active'
  ) then
    raise exception 'You do not have access to this CarePland account.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_account_id::text));

  access_result := public.check_feature_access(
    p_account_id,
    'extended_offline_access',
    1
  );

  if coalesce((access_result ->> 'allowed')::boolean, false) = false then
    raise exception '%', coalesce(
      access_result ->> 'message',
      'Extended offline access is not included with this plan.'
    ) using errcode = '42501';
  end if;

  select max(oa.requested_at)
  into latest_issue_at
  from public.offline_authorizations oa
  where oa.account_id = p_account_id
    and oa.status in ('active', 'expired', 'revoked');

  if latest_issue_at is not null
     and latest_issue_at + interval '30 days' > now_at then
    raise exception 'Extended offline access is available again on %.',
      latest_issue_at + interval '30 days'
      using errcode = 'P0001';
  end if;

  insert into public.offline_authorizations (
    account_id,
    user_id,
    device_id,
    requested_at,
    starts_at,
    expires_at,
    reason_code,
    subscription_tier_at_issue,
    status
  )
  values (
    p_account_id,
    auth.uid(),
    trim(p_device_id),
    now_at,
    now_at,
    now_at + interval '14 days',
    normalized_reason,
    access_result ->> 'plan_id',
    'active'
  )
  returning * into inserted_row;

  return query
  select
    inserted_row.id,
    inserted_row.account_id,
    inserted_row.user_id,
    inserted_row.device_id,
    inserted_row.requested_at,
    inserted_row.starts_at,
    inserted_row.expires_at,
    inserted_row.reason_code,
    inserted_row.subscription_tier_at_issue,
    inserted_row.status,
    inserted_row.requested_at + interval '30 days';
end;
$$;

grant execute on function public.issue_offline_authorization(uuid, text, text)
  to authenticated;
