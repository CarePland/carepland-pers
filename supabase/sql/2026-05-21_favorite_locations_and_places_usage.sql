create table if not exists public.favorite_locations (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  nickname text not null,
  place_name text,
  address text,
  phone text,
  google_place_id text,
  google_maps_uri text,
  source text not null default 'manual'
    check (source in ('manual', 'google_places')),
  usage_count integer not null default 0,
  last_used_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists favorite_locations_care_circle_idx
  on public.favorite_locations (care_circle_id, updated_at desc);

create index if not exists favorite_locations_google_place_idx
  on public.favorite_locations (google_place_id)
  where google_place_id is not null;

alter table public.favorite_locations enable row level security;

grant select, insert, update on public.favorite_locations to authenticated;

drop policy if exists "Care circle members can read favorite locations"
  on public.favorite_locations;
create policy "Care circle members can read favorite locations"
  on public.favorite_locations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = favorite_locations.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add favorite locations"
  on public.favorite_locations;
create policy "Care circle members can add favorite locations"
  on public.favorite_locations
  for insert
  to authenticated
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = favorite_locations.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can update favorite locations"
  on public.favorite_locations;
create policy "Care circle members can update favorite locations"
  on public.favorite_locations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = favorite_locations.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = favorite_locations.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

create table if not exists public.integration_usage_counters (
  integration_key text not null,
  window_grain text not null check (window_grain in ('day', 'minute')),
  window_start timestamptz not null,
  call_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (integration_key, window_grain, window_start)
);

alter table public.integration_usage_counters enable row level security;

grant select on public.integration_usage_counters to authenticated;

drop policy if exists "Admins can read integration usage counters"
  on public.integration_usage_counters;
create policy "Admins can read integration usage counters"
  on public.integration_usage_counters
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

create or replace function public.increment_integration_usage_counter(
  p_integration_key text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  day_count integer;
  minute_count integer;
begin
  insert into public.integration_usage_counters (
    integration_key,
    window_grain,
    window_start,
    call_count,
    updated_at
  )
  values (
    lower(trim(p_integration_key)),
    'day',
    date_trunc('day', now()),
    1,
    now()
  )
  on conflict (integration_key, window_grain, window_start)
  do update
    set call_count = public.integration_usage_counters.call_count + 1,
        updated_at = now()
  returning call_count into day_count;

  insert into public.integration_usage_counters (
    integration_key,
    window_grain,
    window_start,
    call_count,
    updated_at
  )
  values (
    lower(trim(p_integration_key)),
    'minute',
    date_trunc('minute', now()),
    1,
    now()
  )
  on conflict (integration_key, window_grain, window_start)
  do update
    set call_count = public.integration_usage_counters.call_count + 1,
        updated_at = now()
  returning call_count into minute_count;

  return greatest(coalesce(day_count, 0), coalesce(minute_count, 0));
end;
$$;

grant execute on function public.increment_integration_usage_counter(text)
  to authenticated;
