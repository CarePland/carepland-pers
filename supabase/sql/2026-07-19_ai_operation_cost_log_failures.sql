-- Companion to 2026-05-25_ai_operation_cost_logs.sql.
--
-- ai_operation_logs inserts were failing silently: every call site only
-- logged to the server console on error and moved on, so a broken insert
-- (RLS mismatch, bad payload, transient DB issue) had zero operational
-- visibility -- Admin's AI operation cost dashboard would just quietly
-- undercount usage with no signal that anything was wrong. This table gives
-- those failures a durable, admin-visible home instead.
create table if not exists public.ai_operation_cost_log_failures (
  id uuid primary key default gen_random_uuid(),
  operation_key text not null,
  error_message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_operation_cost_log_failures_created_idx
  on public.ai_operation_cost_log_failures (created_at desc);

alter table public.ai_operation_cost_log_failures enable row level security;

grant select on public.ai_operation_cost_log_failures to authenticated;

drop policy if exists "Admins can read AI operation cost log failures"
  on public.ai_operation_cost_log_failures;
create policy "Admins can read AI operation cost log failures"
  on public.ai_operation_cost_log_failures
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

-- Writes to this table always go through the service-role client from
-- logOpenAiOperationCost's failure path (see app/lib/platform/ai/operationLogs.ts),
-- which bypasses RLS, so no insert policy is granted to `authenticated`.

create or replace function public.ai_operation_cost_log_failure_count(
  p_since timestamptz default now() - interval '7 days'
)
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)
  from public.ai_operation_cost_log_failures
  where created_at >= p_since
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    );
$$;

grant execute on function public.ai_operation_cost_log_failure_count(timestamptz)
  to authenticated;
