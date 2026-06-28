-- Connect durable call/care-summary foundation.
--
-- This adds production-shaped storage for Connect calls. Call transcripts are
-- temporary: they may be stored on the call record only until the AI-generated
-- call summary is approved, then the transcript must be deleted while the
-- approved care summary remains. Call summaries are intentionally care-record
-- summaries only, not general conversation summaries.

create table if not exists public.connect_calls (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null,
  main_connect_user_person_id uuid not null references public.care_subjects(id) on delete cascade,
  caller_user_id uuid references auth.users(id) on delete set null,
  caller_display_name text not null default '',
  receiver_display_name text not null default '',
  state text not null default 'ringing' check (
    state in (
      'ringing',
      'answered',
      'connected',
      'declined',
      'receiver_unavailable',
      'hung_up',
      'missed',
      'failed'
    )
  ),
  started_at timestamptz,
  answered_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  ended_reason text not null default '',
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  transcript_text text not null default '',
  transcript_status text not null default 'not_started' check (
    transcript_status in ('not_started', 'capturing', 'ready_for_summary', 'deleted', 'failed')
  ),
  transcript_deleted_at timestamptz,
  summary_status text not null default 'not_requested' check (
    summary_status in ('not_requested', 'pending', 'completed', 'failed', 'not_needed')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.connect_calls is
  'Durable Connect call records scoped to a Care Circle and Main Connect User. Transcript text is temporary and must be deleted after the generated care summary is approved.';

comment on column public.connect_calls.main_connect_user_person_id is
  'CarePland Pers person/Care VIP whose Receiver world the call belongs to.';

comment on column public.connect_calls.summary_status is
  'Lifecycle for brief care-only call summaries. This is not a transcript status.';

comment on column public.connect_calls.transcript_text is
  'Temporary transcript used only for AI summary generation and human verification. Delete permanently once the call summary is approved.';

comment on column public.connect_calls.transcript_status is
  'Temporary transcript lifecycle. Unapproved transcript cleanup policy is a required future design decision.';

-- TODO(connect-call-transcripts): define cleanup for transcripts that never
-- receive summary approval, including expiration timing, reminders, and any
-- archival/delete audit expectations.
-- TODO(connect-call-summary-refinement): define the "Not Quite" clarification
-- and regeneration flow. Initial Receiver UI only shows a placeholder.
-- TODO(connect-call-summary-approval): define the long-term approval surface
-- if approval moves from the Receiver to Coordinator, Call History, or another
-- review workflow.

create index if not exists connect_calls_care_circle_created_idx
  on public.connect_calls (care_circle_id, created_at desc);

create index if not exists connect_calls_main_user_created_idx
  on public.connect_calls (main_connect_user_person_id, created_at desc);

create index if not exists connect_calls_state_idx
  on public.connect_calls (state, updated_at desc);

create table if not exists public.connect_call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.connect_calls(id) on delete cascade,
  care_circle_id uuid not null,
  main_connect_user_person_id uuid not null references public.care_subjects(id) on delete cascade,
  sender text not null check (sender in ('dashboard', 'receiver')),
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice_candidate', 'media_state')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);

comment on table public.connect_call_signals is
  'Short-lived WebRTC signaling for Connect calls. These rows are operational and should be pruned; do not store transcripts here.';

create index if not exists connect_call_signals_call_created_idx
  on public.connect_call_signals (call_id, created_at);

create index if not exists connect_call_signals_expires_idx
  on public.connect_call_signals (expires_at);

create table if not exists public.connect_call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.connect_calls(id) on delete cascade,
  care_circle_id uuid not null,
  main_connect_user_person_id uuid not null references public.care_subjects(id) on delete cascade,
  event_type text not null,
  actor_role text not null default '' check (actor_role in ('', 'dashboard', 'receiver', 'system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.connect_call_events is
  'Operational Connect call diagnostics such as permission state, ICE state, mute, timeout, and hangup source. Details must not include full transcripts or raw audio.';

create index if not exists connect_call_events_call_created_idx
  on public.connect_call_events (call_id, created_at);

create index if not exists connect_call_events_type_created_idx
  on public.connect_call_events (event_type, created_at desc);

create table if not exists public.connect_call_summaries (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.connect_calls(id) on delete cascade,
  care_circle_id uuid not null,
  main_connect_user_person_id uuid not null references public.care_subjects(id) on delete cascade,
  summary_text text not null default '',
  summary_status text not null default 'pending' check (
    summary_status in ('pending', 'completed', 'approved', 'failed', 'not_needed')
  ),
  summary_policy text not null default 'care_record_only_when_uncertain_omit',
  approved_at timestamptz,
  approved_by_role text not null default '' check (approved_by_role in ('', 'dashboard', 'receiver', 'system')),
  approved_by_user_id uuid references auth.users(id) on delete set null,
  prompt_version text not null default '',
  model text not null default '',
  generated_at timestamptz,
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.connect_call_summaries is
  'Brief care-record summaries from Connect calls. These summaries intentionally omit general conversation and should err toward under-documenting. A call may have more than one approved summary when both parties refine/approve different care-relevant versions. Approval should permanently delete the temporary transcript from connect_calls.';

comment on column public.connect_call_summaries.summary_policy is
  'Reminder that call summaries include only care-relevant information and omit uncertain or invasive non-care details.';

create index if not exists connect_call_summaries_main_user_created_idx
  on public.connect_call_summaries (main_connect_user_person_id, created_at desc);

create index if not exists connect_call_summaries_call_created_idx
  on public.connect_call_summaries (call_id, created_at desc);

alter table public.connect_calls enable row level security;
alter table public.connect_call_signals enable row level security;
alter table public.connect_call_events enable row level security;
alter table public.connect_call_summaries enable row level security;

drop policy if exists connect_calls_member_select on public.connect_calls;
create policy connect_calls_member_select
on public.connect_calls
for select
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_calls.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists connect_calls_member_insert on public.connect_calls;
create policy connect_calls_member_insert
on public.connect_calls
for insert
with check (
  exists (
    select 1
    from public.care_circle_memberships ccm
    join public.connect_participants cp
      on cp.care_circle_id = ccm.care_circle_id
      and cp.person_id = connect_calls.main_connect_user_person_id
      and cp.status = 'active'
    where ccm.care_circle_id = connect_calls.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists connect_calls_member_update on public.connect_calls;
create policy connect_calls_member_update
on public.connect_calls
for update
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_calls.care_circle_id
      and ccm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_calls.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists connect_call_signals_member_select on public.connect_call_signals;
create policy connect_call_signals_member_select
on public.connect_call_signals
for select
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_call_signals.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists connect_call_signals_member_insert on public.connect_call_signals;
create policy connect_call_signals_member_insert
on public.connect_call_signals
for insert
with check (
  exists (
    select 1
    from public.connect_calls cc
    join public.care_circle_memberships ccm
      on ccm.care_circle_id = cc.care_circle_id
      and ccm.user_id = auth.uid()
    where cc.id = connect_call_signals.call_id
      and cc.care_circle_id = connect_call_signals.care_circle_id
      and cc.main_connect_user_person_id = connect_call_signals.main_connect_user_person_id
  )
);

drop policy if exists connect_call_events_member_select on public.connect_call_events;
create policy connect_call_events_member_select
on public.connect_call_events
for select
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_call_events.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists connect_call_events_member_insert on public.connect_call_events;
create policy connect_call_events_member_insert
on public.connect_call_events
for insert
with check (
  exists (
    select 1
    from public.connect_calls cc
    join public.care_circle_memberships ccm
      on ccm.care_circle_id = cc.care_circle_id
      and ccm.user_id = auth.uid()
    where cc.id = connect_call_events.call_id
      and cc.care_circle_id = connect_call_events.care_circle_id
      and cc.main_connect_user_person_id = connect_call_events.main_connect_user_person_id
  )
);

drop policy if exists connect_call_summaries_member_select on public.connect_call_summaries;
create policy connect_call_summaries_member_select
on public.connect_call_summaries
for select
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_call_summaries.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists connect_call_summaries_member_write on public.connect_call_summaries;
create policy connect_call_summaries_member_write
on public.connect_call_summaries
for all
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_call_summaries.care_circle_id
      and ccm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.connect_calls cc
    join public.care_circle_memberships ccm
      on ccm.care_circle_id = cc.care_circle_id
      and ccm.user_id = auth.uid()
    where cc.id = connect_call_summaries.call_id
      and cc.care_circle_id = connect_call_summaries.care_circle_id
      and cc.main_connect_user_person_id = connect_call_summaries.main_connect_user_person_id
  )
);
