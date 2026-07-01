-- Connect Receiver screen-cleaning usage sessions.
--
-- These records support appliance usage analysis without changing the Receiver
-- user experience. Browser/client code should post through the app route, not
-- access this table directly.

create table if not exists public.connect_receiver_cleaning_sessions (
  session_id text primary key,
  cleaning_count integer check (cleaning_count is null or cleaning_count > 0),
  cleaning_started_at timestamptz not null,
  cleaning_completed_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  main_connect_user_person_id uuid references public.care_subjects(id) on delete set null,
  receiver_device_id text references public.connect_receiver_devices(id) on delete set null,
  receiver_id text not null default '',
  receiver_install_id text not null default '',
  device_identifier text not null default '',
  receiver_mode text not null default 'Dedicated' check (receiver_mode in ('Dedicated', 'Personal')),
  message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.connect_receiver_cleaning_sessions is
  'Usage records for Receiver screen-cleaning appliance mode sessions.';

create index if not exists connect_receiver_cleaning_sessions_started_idx
  on public.connect_receiver_cleaning_sessions (cleaning_started_at desc);

create index if not exists connect_receiver_cleaning_sessions_device_idx
  on public.connect_receiver_cleaning_sessions (receiver_device_id, cleaning_started_at desc);

create index if not exists connect_receiver_cleaning_sessions_person_idx
  on public.connect_receiver_cleaning_sessions (main_connect_user_person_id, cleaning_started_at desc);

alter table public.connect_receiver_cleaning_sessions enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.connect_receiver_cleaning_sessions to service_role;

-- No end-user RLS policies yet. App routes use service-role writes while the
-- Receiver provisioning/auth model is being stabilized.
