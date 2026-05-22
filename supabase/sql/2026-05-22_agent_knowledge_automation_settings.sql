create table if not exists public.agent_knowledge_automation_settings (
  settings_key text primary key default 'default'
    check (settings_key = 'default'),
  auto_generation_enabled boolean not null default false,
  software_update_checks_enabled boolean not null default true,
  scheduled_checks_enabled boolean not null default false,
  background_generation_period_days integer not null default 7
    check (background_generation_period_days >= 1),
  feedback_clustering_enabled boolean not null default true,
  feedback_push_to_proposal_enabled boolean not null default true,
  feedback_min_not_helpful_count integer not null default 3
    check (feedback_min_not_helpful_count >= 1),
  feedback_min_admin_flags integer not null default 1
    check (feedback_min_admin_flags >= 1),
  feedback_window_days integer not null default 14
    check (feedback_window_days >= 1),
  severity_threshold text not null default 'medium'
    check (severity_threshold in ('low', 'medium', 'high', 'urgent')),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_knowledge_automation_settings
  add column if not exists background_generation_period_days integer not null default 7
    check (background_generation_period_days >= 1);

create table if not exists public.agent_knowledge_check_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null
    check (run_type in ('manual', 'software_update', 'scheduled', 'feedback_cluster')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  requested_by_user_id uuid references auth.users(id) on delete set null,
  source_context jsonb not null default '{}'::jsonb,
  settings_snapshot jsonb not null default '{}'::jsonb,
  proposal_id uuid references public.agent_knowledge_proposals(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists agent_knowledge_check_runs_status_idx
  on public.agent_knowledge_check_runs (status, created_at desc);

create index if not exists agent_knowledge_check_runs_type_idx
  on public.agent_knowledge_check_runs (run_type, created_at desc);

alter table public.agent_knowledge_automation_settings enable row level security;
alter table public.agent_knowledge_check_runs enable row level security;

grant select, update on public.agent_knowledge_automation_settings to authenticated;
grant select, insert, update on public.agent_knowledge_check_runs to authenticated;

drop policy if exists "Admins can manage Agent Knowledge automation settings"
  on public.agent_knowledge_automation_settings;
create policy "Admins can manage Agent Knowledge automation settings"
  on public.agent_knowledge_automation_settings
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Admins can manage Agent Knowledge check runs"
  on public.agent_knowledge_check_runs;
create policy "Admins can manage Agent Knowledge check runs"
  on public.agent_knowledge_check_runs
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

insert into public.agent_knowledge_automation_settings (settings_key)
values ('default')
on conflict (settings_key) do nothing;

drop function if exists public.update_agent_knowledge_automation_settings(boolean, boolean, boolean, boolean, boolean, integer, integer, integer, text);
drop function if exists public.update_agent_knowledge_automation_settings(boolean, boolean, boolean, integer, boolean, boolean, integer, integer, integer, text);

create or replace function public.update_agent_knowledge_automation_settings(
  p_auto_generation_enabled boolean,
  p_software_update_checks_enabled boolean,
  p_scheduled_checks_enabled boolean,
  p_background_generation_period_days integer,
  p_feedback_clustering_enabled boolean,
  p_feedback_push_to_proposal_enabled boolean,
  p_feedback_min_not_helpful_count integer,
  p_feedback_min_admin_flags integer,
  p_feedback_window_days integer,
  p_severity_threshold text
)
returns public.agent_knowledge_automation_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_settings public.agent_knowledge_automation_settings%rowtype;
  cleaned_severity text;
begin
  perform public.assert_current_user_is_admin();

  cleaned_severity := coalesce(nullif(trim(p_severity_threshold), ''), 'medium');

  if cleaned_severity not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Unsupported severity threshold: %', cleaned_severity;
  end if;

  insert into public.agent_knowledge_automation_settings (
    settings_key,
    auto_generation_enabled,
    software_update_checks_enabled,
    scheduled_checks_enabled,
    background_generation_period_days,
    feedback_clustering_enabled,
    feedback_push_to_proposal_enabled,
    feedback_min_not_helpful_count,
    feedback_min_admin_flags,
    feedback_window_days,
    severity_threshold,
    updated_by_user_id,
    updated_at
  )
  values (
    'default',
    coalesce(p_auto_generation_enabled, false),
    coalesce(p_software_update_checks_enabled, true),
    coalesce(p_scheduled_checks_enabled, false),
    greatest(1, coalesce(p_background_generation_period_days, 7)),
    coalesce(p_feedback_clustering_enabled, true),
    coalesce(p_feedback_push_to_proposal_enabled, true),
    greatest(1, coalesce(p_feedback_min_not_helpful_count, 3)),
    greatest(1, coalesce(p_feedback_min_admin_flags, 1)),
    greatest(1, coalesce(p_feedback_window_days, 14)),
    cleaned_severity,
    auth.uid(),
    now()
  )
  on conflict (settings_key) do update
  set auto_generation_enabled = excluded.auto_generation_enabled,
      software_update_checks_enabled = excluded.software_update_checks_enabled,
      scheduled_checks_enabled = excluded.scheduled_checks_enabled,
      background_generation_period_days = excluded.background_generation_period_days,
      feedback_clustering_enabled = excluded.feedback_clustering_enabled,
      feedback_push_to_proposal_enabled = excluded.feedback_push_to_proposal_enabled,
      feedback_min_not_helpful_count = excluded.feedback_min_not_helpful_count,
      feedback_min_admin_flags = excluded.feedback_min_admin_flags,
      feedback_window_days = excluded.feedback_window_days,
      severity_threshold = excluded.severity_threshold,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at
  returning * into updated_settings;

  return updated_settings;
end;
$$;

create or replace function public.queue_agent_knowledge_check_run(
  p_run_type text,
  p_source_context jsonb default '{}'::jsonb
)
returns public.agent_knowledge_check_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_run_type text;
  current_settings public.agent_knowledge_automation_settings%rowtype;
  new_run public.agent_knowledge_check_runs%rowtype;
begin
  perform public.assert_current_user_is_admin();

  cleaned_run_type := coalesce(nullif(trim(p_run_type), ''), 'manual');

  if cleaned_run_type not in ('manual', 'software_update', 'scheduled', 'feedback_cluster') then
    raise exception 'Unsupported Agent Knowledge check run type: %', cleaned_run_type;
  end if;

  select *
    into current_settings
  from public.agent_knowledge_automation_settings
  where settings_key = 'default';

  if not found then
    insert into public.agent_knowledge_automation_settings (settings_key)
    values ('default')
    returning * into current_settings;
  end if;

  insert into public.agent_knowledge_check_runs (
    run_type,
    requested_by_user_id,
    source_context,
    settings_snapshot
  )
  values (
    cleaned_run_type,
    auth.uid(),
    coalesce(p_source_context, '{}'::jsonb),
    to_jsonb(current_settings)
  )
  returning * into new_run;

  return new_run;
end;
$$;

grant execute on function public.update_agent_knowledge_automation_settings(boolean, boolean, boolean, integer, boolean, boolean, integer, integer, integer, text)
  to authenticated;
grant execute on function public.queue_agent_knowledge_check_run(text, jsonb)
  to authenticated;
