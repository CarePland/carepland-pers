-- CarePland Track / Today's Focus foundation.
--
-- Focus items are intentions/prompts. Track events are recorded reality.
-- A checkbox, Receiver tap, voice capture, reminder action, note import, or
-- future AI ingestion may create a track event, but none of those UI actions
-- is the data model itself.

create table if not exists public.focus_items (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  title text not null,
  focus_type text not null default 'daily_prompt',
  prompt_text text,
  recurrence_rule text,
  schedule jsonb not null default '{}'::jsonb,
  active_start_date date,
  active_end_date date,
  completion_type text not null default 'simple_done'
    check (
      completion_type in (
        'simple_done',
        'measured_value',
        'medication',
        'symptom_check',
        'yes_no',
        'note_required',
        'custom'
      )
    ),
  completion_event_type text,
  completion_prompt_text text,
  completion_config jsonb not null default '{}'::jsonb,
  importance_score integer not null default 50,
  status text not null default 'active'
    check (status in ('active', 'paused', 'archived')),
  sort_order integer not null default 100,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  check (title <> ''),
  check (focus_type = lower(focus_type)),
  check (completion_event_type is null or completion_event_type = lower(completion_event_type)),
  check (importance_score >= 0 and importance_score <= 100),
  check (active_end_date is null or active_start_date is null or active_end_date >= active_start_date)
);

comment on table public.focus_items is
  'Person-scoped intentions/prompts for Today''s Focus. These are not facts that something happened.';

comment on column public.focus_items.recurrence_rule is
  'Optional iCalendar-style recurrence rule or simple app rule. schedule stores app-specific timing such as days, windows, or local times.';

comment on column public.focus_items.completion_event_type is
  'Default track_events.event_type to create when this focus item is completed, such as activity.walking, medication.taken, or measurement.weight.';

comment on column public.focus_items.completion_config is
  'JSON configuration for the completion flow: measured units, medication outcome options, required note flags, or custom prompt details.';

comment on column public.focus_items.importance_score is
  'Simple ranking hint for Today''s Focus. Higher is more important. This is intentionally conservative and can be refined later.';

create table if not exists public.track_events (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  focus_item_id uuid references public.focus_items(id) on delete set null,
  event_type text not null,
  title text not null,
  occurred_at timestamptz not null default now(),
  source text not null default 'manual'
    check (
      source in (
        'manual',
        'focus_item',
        'receiver_today_focus',
        'talk_voice',
        'appointment_note',
        'connect_call_summary',
        'caregiver_note',
        'reminder',
        'import_anything',
        'system',
        'ai_suggestion',
        'custom'
      )
    ),
  source_table text,
  source_id uuid,
  value numeric,
  unit text,
  note text,
  structured_payload jsonb not null default '{}'::jsonb,
  confidence numeric not null default 1,
  needs_review boolean not null default false,
  event_status text not null default 'active'
    check (event_status in ('active', 'needs_review', 'retracted', 'superseded', 'entered_in_error')),
  superseded_by_track_event_id uuid references public.track_events(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (event_type <> ''),
  check (event_type = lower(event_type)),
  check (title <> ''),
  check (confidence >= 0 and confidence <= 1)
);

comment on table public.track_events is
  'Person-scoped facts that something happened or was observed. Events are append-friendly and should be retracted/superseded instead of hard-deleted.';

comment on column public.track_events.focus_item_id is
  'Optional link to the Focus Item that prompted this event. Many events will come from other sources and have no focus item.';

comment on column public.track_events.structured_payload is
  'Flexible source-specific details, such as medication outcome, symptom answer, original voice transcript snippet, or note extraction context.';

comment on column public.track_events.source is
  'Origin of the event. Future Talk, reminders, appointment notes, call summaries, and caregiver notes should create events through this source vocabulary.';

create index if not exists focus_items_subject_status_idx
  on public.focus_items (care_subject_id, status, importance_score desc, sort_order, created_at desc);

create index if not exists focus_items_care_circle_status_idx
  on public.focus_items (care_circle_id, status, updated_at desc);

create index if not exists track_events_subject_occurred_idx
  on public.track_events (care_subject_id, occurred_at desc);

create index if not exists track_events_subject_type_occurred_idx
  on public.track_events (care_subject_id, event_type, occurred_at desc);

create index if not exists track_events_focus_item_occurred_idx
  on public.track_events (focus_item_id, occurred_at desc)
  where focus_item_id is not null;

create index if not exists track_events_needs_review_idx
  on public.track_events (care_circle_id, needs_review, occurred_at desc)
  where needs_review = true or event_status = 'needs_review';

alter table public.focus_items enable row level security;
alter table public.track_events enable row level security;

grant select, insert, update on public.focus_items to authenticated;
grant select, insert, update on public.track_events to authenticated;

drop policy if exists "Care circle members can read focus items"
  on public.focus_items;
create policy "Care circle members can read focus items"
  on public.focus_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = focus_items.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add focus items"
  on public.focus_items;
create policy "Care circle members can add focus items"
  on public.focus_items
  for insert
  to authenticated
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = focus_items.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = focus_items.care_subject_id
        and cs.care_circle_id = focus_items.care_circle_id
    )
  );

drop policy if exists "Care circle members can update focus items"
  on public.focus_items;
create policy "Care circle members can update focus items"
  on public.focus_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = focus_items.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = focus_items.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = focus_items.care_subject_id
        and cs.care_circle_id = focus_items.care_circle_id
    )
  );

drop policy if exists "Care circle members can read track events"
  on public.track_events;
create policy "Care circle members can read track events"
  on public.track_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = track_events.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add track events"
  on public.track_events;
create policy "Care circle members can add track events"
  on public.track_events
  for insert
  to authenticated
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = track_events.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = track_events.care_subject_id
        and cs.care_circle_id = track_events.care_circle_id
    )
    and (
      track_events.focus_item_id is null
      or exists (
        select 1
        from public.focus_items fi
        where fi.id = track_events.focus_item_id
          and fi.care_circle_id = track_events.care_circle_id
          and fi.care_subject_id = track_events.care_subject_id
      )
    )
  );

drop policy if exists "Care circle members can update track events"
  on public.track_events;
create policy "Care circle members can update track events"
  on public.track_events
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = track_events.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = track_events.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = track_events.care_subject_id
        and cs.care_circle_id = track_events.care_circle_id
    )
    and (
      track_events.focus_item_id is null
      or exists (
        select 1
        from public.focus_items fi
        where fi.id = track_events.focus_item_id
          and fi.care_circle_id = track_events.care_circle_id
          and fi.care_subject_id = track_events.care_subject_id
      )
    )
  );

-- Event type conventions are intentionally dot-namespaced and app-owned, not
-- clinical codes. Initial examples:
--   activity.walking
--   medication.taken
--   medication.skipped
--   measurement.weight
--   measurement.blood_sugar
--   symptom.check
--   note.caregiver
--   reminder.response
--
-- TODO(track-talk): Talk button ingestion should write track_events with
-- source = 'talk_voice', needs_review based on confidence, and only the
-- care-relevant structured payload/snippet required for review.
-- TODO(track-receiver): Receiver Today's Focus should render focus_items for
-- the active care_subject_id and create track_events instead of treating a
-- checkbox/tap as durable state.
