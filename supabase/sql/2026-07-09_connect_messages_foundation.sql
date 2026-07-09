-- Connect durable message foundation.
--
-- Connect's launch communication path is message-first: a caregiver sends a
-- person-scoped message to a Receiver Active Person, the Receiver can make the
-- message understandable, and the recipient can acknowledge or request a
-- callback without requiring live audio/WebRTC.

create table if not exists public.connect_messages (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null,
  main_connect_user_person_id uuid not null references public.care_subjects(id) on delete cascade,
  receiver_device_id text references public.connect_receiver_devices(id) on delete set null,
  sender_role text not null default 'dashboard' check (
    sender_role in ('dashboard', 'receiver', 'system')
  ),
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_display_name text not null default '',
  recipient_display_name text not null default '',
  body text not null default '',
  message_type text not null default 'text' check (
    message_type in ('text', 'audio')
  ),
  audio_artifact_id text not null default '',
  audio_url text not null default '',
  audio_mime_type text not null default '',
  audio_duration_ms integer check (
    audio_duration_ms is null or audio_duration_ms >= 0
  ),
  transcript text not null default '',
  transcript_status text not null default '',
  requires_acknowledgement boolean not null default false,
  allows_callback_request boolean not null default false,
  delivered_at timestamptz,
  read_at timestamptz,
  heard_at timestamptz,
  acknowledged_at timestamptz,
  callback_requested_at timestamptz,
  client_message_id text not null default '',
  source text not null default 'connect_message',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.connect_messages is
  'Durable person-scoped Connect messages for Receiver delivery, acknowledgement, and callback request workflows. This is not an emergency or phone system.';

comment on column public.connect_messages.main_connect_user_person_id is
  'CarePland person / Receiver Active Person whose Receiver world this message belongs to.';

create index if not exists connect_messages_main_user_created_idx
  on public.connect_messages (main_connect_user_person_id, created_at desc);

create index if not exists connect_messages_care_circle_created_idx
  on public.connect_messages (care_circle_id, created_at desc);

create index if not exists connect_messages_receiver_device_idx
  on public.connect_messages (receiver_device_id, created_at desc);

create index if not exists connect_messages_attention_idx
  on public.connect_messages (
    main_connect_user_person_id,
    acknowledged_at,
    callback_requested_at,
    created_at desc
  );

create table if not exists public.connect_message_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.connect_messages(id) on delete cascade,
  care_circle_id uuid not null,
  main_connect_user_person_id uuid not null references public.care_subjects(id) on delete cascade,
  receiver_device_id text references public.connect_receiver_devices(id) on delete set null,
  event_type text not null check (
    event_type in (
      'created',
      'delivered',
      'read',
      'heard',
      'acknowledged',
      'callback_requested'
    )
  ),
  actor_role text not null default 'system' check (
    actor_role in ('dashboard', 'receiver', 'system')
  ),
  actor_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.connect_message_events is
  'Append-only lifecycle events for Connect message delivery, read/heard state, explicit acknowledgement, and callback requests.';

create index if not exists connect_message_events_message_created_idx
  on public.connect_message_events (message_id, created_at);

create index if not exists connect_message_events_main_user_created_idx
  on public.connect_message_events (main_connect_user_person_id, created_at desc);

alter table public.connect_messages enable row level security;
alter table public.connect_message_events enable row level security;

drop policy if exists connect_messages_member_select on public.connect_messages;
create policy connect_messages_member_select
on public.connect_messages
for select
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_messages.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists connect_messages_member_insert on public.connect_messages;
create policy connect_messages_member_insert
on public.connect_messages
for insert
with check (
  exists (
    select 1
    from public.care_circle_memberships ccm
    join public.connect_participants cp
      on cp.care_circle_id = ccm.care_circle_id
      and cp.person_id = connect_messages.main_connect_user_person_id
      and cp.status = 'active'
    where ccm.care_circle_id = connect_messages.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists connect_messages_member_update on public.connect_messages;
create policy connect_messages_member_update
on public.connect_messages
for update
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_messages.care_circle_id
      and ccm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_messages.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists connect_message_events_member_select on public.connect_message_events;
create policy connect_message_events_member_select
on public.connect_message_events
for select
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_message_events.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists connect_message_events_member_insert on public.connect_message_events;
create policy connect_message_events_member_insert
on public.connect_message_events
for insert
with check (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_message_events.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

grant select, insert, update, delete on public.connect_messages to service_role;
grant select, insert, update, delete on public.connect_message_events to service_role;
