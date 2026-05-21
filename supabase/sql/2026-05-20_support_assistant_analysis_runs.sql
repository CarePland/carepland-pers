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

create or replace function public.update_support_assistant_analysis_run(
  p_run_id uuid,
  p_admin_status text,
  p_admin_note text default null
)
returns public.support_assistant_analysis_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  cleaned_status text;
  updated_run public.support_assistant_analysis_runs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to update assistant analysis runs';
  end if;

  select coalesce(p.is_admin, false)
    into caller_is_admin
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(caller_is_admin, false) = false then
    raise exception 'Admin access is required to update assistant analysis runs';
  end if;

  cleaned_status := coalesce(nullif(trim(p_admin_status), ''), 'reviewed');

  if cleaned_status not in ('new', 'reviewed', 'accepted', 'rejected', 'needs_more_data') then
    raise exception 'Unsupported analysis run status: %', cleaned_status;
  end if;

  update public.support_assistant_analysis_runs
  set admin_status = cleaned_status,
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      updated_at = now()
  where id = p_run_id
  returning * into updated_run;

  if not found then
    raise exception 'Assistant analysis run not found';
  end if;

  return updated_run;
end;
$$;

grant execute on function public.update_support_assistant_analysis_run(uuid, text, text)
  to authenticated;
