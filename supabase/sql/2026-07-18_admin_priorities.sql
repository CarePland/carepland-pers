create table if not exists public.admin_priority_states (
  incident_key text primary key,
  source_type text not null,
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'in_progress', 'deferred', 'resolved', 'dismissed')),
  assigned_admin_user_id uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  deferred_until timestamptz,
  resolved_at timestamptz,
  dismissed_at timestamptz,
  note text not null default '',
  last_action_by_user_id uuid references auth.users(id) on delete set null,
  last_action_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_priority_events (
  id uuid primary key default gen_random_uuid(),
  incident_key text not null references public.admin_priority_states(incident_key) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  old_status text,
  new_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists admin_priority_states_status_action_idx
  on public.admin_priority_states (status, last_action_at desc);

create index if not exists admin_priority_events_incident_created_idx
  on public.admin_priority_events (incident_key, created_at desc);

alter table public.admin_priority_states enable row level security;
alter table public.admin_priority_events enable row level security;

grant select on public.admin_priority_states to authenticated;
grant select on public.admin_priority_events to authenticated;
grant insert, update on public.admin_priority_states to service_role;
grant insert on public.admin_priority_events to service_role;

drop policy if exists admin_priority_states_admin_select on public.admin_priority_states;
create policy admin_priority_states_admin_select
  on public.admin_priority_states
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

drop policy if exists admin_priority_events_admin_select on public.admin_priority_events;
create policy admin_priority_events_admin_select
  on public.admin_priority_events
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
