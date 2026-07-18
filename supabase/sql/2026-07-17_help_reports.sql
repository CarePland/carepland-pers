create table if not exists public.help_reports (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  submitted_at timestamptz not null default now(),
  submitted_by_user_id uuid references auth.users(id) on delete set null,
  account_user_id uuid references auth.users(id) on delete set null,
  care_subject_id uuid references public.care_subjects(id) on delete set null,
  care_circle_id uuid references public.care_circles(id) on delete set null,
  current_route text,
  feature_area text not null default 'unknown',
  build_identifier text,
  device_summary text,
  browser_summary text,
  packet_schema_version integer not null default 1,
  user_trying_to_do text not null default '',
  user_happened_instead text not null default '',
  diagnostic_packet jsonb not null default '{}'::jsonb,
  derived_summary jsonb not null default '{}'::jsonb,
  likely_category text not null default 'unknown',
  severity text not null default 'low'
    check (severity in ('info', 'low', 'medium')),
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'needs_follow_up', 'resolved', 'dismissed')),
  assigned_admin_user_id uuid references auth.users(id) on delete set null,
  admin_notes text not null default '',
  first_reviewed_at timestamptz,
  resolved_at timestamptz,
  resolution_category text
    check (
      resolution_category is null
      or resolution_category in (
        'code_defect',
        'deployment_configuration',
        'network_device',
        'session_authentication',
        'permission_access',
        'user_confusion',
        'expected_behavior',
        'duplicate',
        'insufficient_information',
        'other'
      )
    ),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_report_events (
  id uuid primary key default gen_random_uuid(),
  help_report_id uuid not null references public.help_reports(id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists help_reports_status_submitted_idx
  on public.help_reports (status, submitted_at desc);

create index if not exists help_reports_feature_submitted_idx
  on public.help_reports (feature_area, submitted_at desc);

create index if not exists help_reports_reference_idx
  on public.help_reports (reference_id);

create index if not exists help_reports_user_submitted_idx
  on public.help_reports (submitted_by_user_id, submitted_at desc);

create index if not exists help_report_events_report_created_idx
  on public.help_report_events (help_report_id, created_at desc);

alter table public.help_reports enable row level security;
alter table public.help_report_events enable row level security;

grant select on public.help_reports to authenticated;
grant select on public.help_report_events to authenticated;
grant insert, update on public.help_reports to service_role;
grant insert on public.help_report_events to service_role;

drop policy if exists "Admins can read help reports" on public.help_reports;
create policy "Admins can read help reports"
  on public.help_reports
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

drop policy if exists "Admins can read help report events" on public.help_report_events;
create policy "Admins can read help report events"
  on public.help_report_events
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
