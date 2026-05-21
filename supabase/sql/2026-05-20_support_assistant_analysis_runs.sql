create table if not exists public.support_assistant_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by_user_id uuid not null references auth.users(id) on delete cascade,
  criteria jsonb not null default '{}'::jsonb,
  interaction_ids uuid[] not null default '{}',
  prompt_versions jsonb not null default '[]'::jsonb,
  interaction_count integer not null default 0,
  model text not null default 'gpt-4.1-mini',
  analysis_summary text not null default '',
  failure_patterns jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  prompt_recommendations jsonb not null default '[]'::jsonb,
  ui_recommendations jsonb not null default '[]'::jsonb,
  raw_output jsonb not null default '{}'::jsonb,
  admin_status text not null default 'new'
    check (admin_status in ('new', 'reviewed', 'accepted', 'rejected', 'needs_more_data')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_assistant_analysis_runs_created_idx
  on public.support_assistant_analysis_runs (created_at desc);

alter table public.support_assistant_analysis_runs enable row level security;

grant select, insert on public.support_assistant_analysis_runs to authenticated;

drop policy if exists "Admins can read support assistant analysis runs"
  on public.support_assistant_analysis_runs;
create policy "Admins can read support assistant analysis runs"
  on public.support_assistant_analysis_runs
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

drop policy if exists "Admins can create support assistant analysis runs"
  on public.support_assistant_analysis_runs;
create policy "Admins can create support assistant analysis runs"
  on public.support_assistant_analysis_runs
  for insert
  to authenticated
  with check (
    requested_by_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );
