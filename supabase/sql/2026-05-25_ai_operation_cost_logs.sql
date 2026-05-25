create table if not exists public.ai_operation_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openai',
  operation_key text not null,
  operation_label text,
  user_id uuid references auth.users(id) on delete set null,
  care_circle_id uuid references public.care_circles(id) on delete set null,
  source_table text,
  source_id uuid,
  provider_request_id text,
  provider_response_id text,
  model text not null,
  prompt_version text,
  input_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric(12, 8),
  currency text not null default 'USD',
  pricing_snapshot jsonb not null default '{}'::jsonb,
  usage_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (input_tokens >= 0),
  check (cached_input_tokens >= 0),
  check (output_tokens >= 0),
  check (total_tokens >= 0),
  check (estimated_cost_usd is null or estimated_cost_usd >= 0)
);

create index if not exists ai_operation_logs_operation_created_idx
  on public.ai_operation_logs (operation_key, created_at desc);

create index if not exists ai_operation_logs_user_created_idx
  on public.ai_operation_logs (user_id, created_at desc);

create index if not exists ai_operation_logs_care_circle_created_idx
  on public.ai_operation_logs (care_circle_id, created_at desc);

create index if not exists ai_operation_logs_source_idx
  on public.ai_operation_logs (source_table, source_id);

alter table public.ai_operation_logs enable row level security;

grant select, insert on public.ai_operation_logs to authenticated;

drop policy if exists "Admins can read AI operation logs"
  on public.ai_operation_logs;
create policy "Admins can read AI operation logs"
  on public.ai_operation_logs
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

drop policy if exists "Users can create their own AI operation logs"
  on public.ai_operation_logs;
create policy "Users can create their own AI operation logs"
  on public.ai_operation_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

create or replace function public.ai_operation_cost_summary(
  p_since timestamptz default now() - interval '30 days'
)
returns table (
  operation_key text,
  model text,
  call_count bigint,
  input_tokens bigint,
  cached_input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint,
  estimated_cost_usd numeric
)
language sql
security definer
set search_path = public
as $$
  select
    logs.operation_key,
    logs.model,
    count(*) as call_count,
    coalesce(sum(logs.input_tokens), 0)::bigint as input_tokens,
    coalesce(sum(logs.cached_input_tokens), 0)::bigint as cached_input_tokens,
    coalesce(sum(logs.output_tokens), 0)::bigint as output_tokens,
    coalesce(sum(logs.total_tokens), 0)::bigint as total_tokens,
    coalesce(sum(logs.estimated_cost_usd), 0)::numeric as estimated_cost_usd
  from public.ai_operation_logs logs
  where logs.created_at >= p_since
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  group by logs.operation_key, logs.model
  order by estimated_cost_usd desc, call_count desc;
$$;

grant execute on function public.ai_operation_cost_summary(timestamptz)
  to authenticated;
