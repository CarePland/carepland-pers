create table if not exists public.integration_error_events (
  id uuid primary key default gen_random_uuid(),
  integration_key text not null,
  error_key text not null,
  error_message text,
  user_id uuid references auth.users(id) on delete set null,
  attempted_call_count integer,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists integration_error_events_lookup_idx
  on public.integration_error_events (
    integration_key,
    error_key,
    occurred_at desc
  );

create index if not exists integration_error_events_user_idx
  on public.integration_error_events (user_id, occurred_at desc);

alter table public.integration_error_events enable row level security;

grant select on public.integration_error_events to authenticated;

drop policy if exists "Admins can read integration error events"
  on public.integration_error_events;
create policy "Admins can read integration error events"
  on public.integration_error_events
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

create or replace function public.record_integration_error(
  p_integration_key text,
  p_error_key text,
  p_error_message text default null,
  p_attempted_call_count integer default null,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.integration_error_events (
    integration_key,
    error_key,
    error_message,
    user_id,
    attempted_call_count,
    context
  )
  values (
    lower(trim(p_integration_key)),
    lower(trim(p_error_key)),
    nullif(trim(coalesce(p_error_message, '')), ''),
    auth.uid(),
    p_attempted_call_count,
    coalesce(p_context, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.record_integration_error(
  text,
  text,
  text,
  integer,
  jsonb
) to authenticated;

create or replace function public.get_admin_integration_error_summary()
returns table (
  window_grain text,
  window_start timestamptz,
  integration_key text,
  error_key text,
  occurrence_count bigint,
  affected_user_count bigint,
  latest_occurred_at timestamptz,
  max_attempted_call_count integer,
  latest_error_message text
)
language sql
security definer
set search_path = public
as $$
  with admin_check as (
    select public.assert_current_user_is_admin()
  ),
  recent_events as (
    select *
    from public.integration_error_events
    where occurred_at >= now() - interval '30 days'
  ),
  minute_rollup as (
    select
      'minute'::text as window_grain,
      date_trunc('minute', occurred_at) as window_start,
      integration_key,
      error_key,
      count(*) as occurrence_count,
      count(distinct user_id) as affected_user_count,
      max(occurred_at) as latest_occurred_at,
      max(attempted_call_count) as max_attempted_call_count,
      (array_agg(error_message order by occurred_at desc))[1] as latest_error_message
    from recent_events
    group by
      date_trunc('minute', occurred_at),
      integration_key,
      error_key
  ),
  day_rollup as (
    select
      'day'::text as window_grain,
      date_trunc('day', occurred_at) as window_start,
      integration_key,
      error_key,
      count(*) as occurrence_count,
      count(distinct user_id) as affected_user_count,
      max(occurred_at) as latest_occurred_at,
      max(attempted_call_count) as max_attempted_call_count,
      (array_agg(error_message order by occurred_at desc))[1] as latest_error_message
    from recent_events
    group by
      date_trunc('day', occurred_at),
      integration_key,
      error_key
  )
  select
    rollup.window_grain,
    rollup.window_start,
    rollup.integration_key,
    rollup.error_key,
    rollup.occurrence_count,
    rollup.affected_user_count,
    rollup.latest_occurred_at,
    rollup.max_attempted_call_count,
    rollup.latest_error_message
  from admin_check, (
    select * from minute_rollup
    union all
    select * from day_rollup
  ) rollup
  order by rollup.latest_occurred_at desc
  limit 100;
$$;

grant execute on function public.get_admin_integration_error_summary()
  to authenticated;

insert into public.integration_error_events (
  integration_key,
  error_key,
  error_message,
  user_id,
  attempted_call_count,
  context,
  occurred_at
)
select
  'google_places',
  'quota_exceeded',
  'Google Places lookup is over quota.',
  (select id from public.profiles order by created_at desc limit 1),
  487,
  '{"source":"seed","window":"day"}'::jsonb,
  now() - interval '1 day'
where not exists (
  select 1
  from public.integration_error_events
  where integration_key = 'google_places'
    and error_key = 'quota_exceeded'
    and context->>'source' = 'seed'
);

insert into public.integration_error_events (
  integration_key,
  error_key,
  error_message,
  user_id,
  attempted_call_count,
  context,
  occurred_at
)
select
  'google_places',
  'rate_limited',
  'Google Places lookup is temporarily rate-limited.',
  (select id from public.profiles order by created_at asc limit 1),
  62,
  '{"source":"seed","window":"minute"}'::jsonb,
  now() - interval '2 hours'
where not exists (
  select 1
  from public.integration_error_events
  where integration_key = 'google_places'
    and error_key = 'rate_limited'
    and context->>'source' = 'seed'
);
