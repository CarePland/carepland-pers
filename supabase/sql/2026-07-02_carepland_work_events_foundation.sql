-- CarePland Work Events foundation.
--
-- Track Events record reality: things that happened or were observed.
-- CarePland Work Events record Layer 2: what CarePland actually handled,
-- connected, prepared, coordinated, or made reviewable. These events are the
-- bridge between raw facts and future "CarePland at a Glance" human outcomes.

create table if not exists public.carepland_work_events (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid references public.care_subjects(id) on delete set null,
  work_type text not null
    check (
      work_type in (
        'appointment_context_organized',
        'assignment_conflict_resolved',
        'call_summary_prepared',
        'careprep_prepared',
        'duplicate_information_detected',
        'errand_reassigned',
        'focus_ranked',
        'health_story_connected',
        'message_delivery_confirmed',
        'note_linked',
        'recommendation_identified',
        'reminder_coordinated',
        'schedule_change_coordinated',
        'supporting_evidence_found'
      )
    ),
  outcome_category text not null
    check (
      outcome_category in (
        'context_connected',
        'coordination_reduced',
        'duplication_reduced',
        'focus_supported',
        'household_in_sync',
        'information_ready',
        'message_heard',
        'ownership_clarified',
        'recommendation_surfaced',
        'review_supported',
        'visit_prepared'
      )
    ),
  title text not null,
  summary text,
  occurred_at timestamptz not null default now(),
  source_type text not null default 'system'
    check (
      source_type in (
        'appointments',
        'careprep',
        'connect',
        'family',
        'health_focus',
        'import_anything',
        'recommendations',
        'reminders',
        'system',
        'today_focus',
        'track'
      )
    ),
  source_table text,
  source_id uuid,
  related_sources jsonb not null default '[]'::jsonb,
  confidence numeric not null default 1,
  avoided_effort_unit text
    check (
      avoided_effort_unit is null
      or avoided_effort_unit in (
        'call_or_text',
        'duplicate_entry',
        'handoff',
        'lookup',
        'minute',
        'schedule_check'
      )
    ),
  avoided_effort_min numeric,
  avoided_effort_max numeric,
  effort_model_version text,
  idempotency_key text,
  work_status text not null default 'active'
    check (
      work_status in (
        'active',
        'superseded',
        'retracted',
        'entered_in_error'
      )
    ),
  superseded_by_work_event_id uuid references public.carepland_work_events(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  structured_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  check (title <> ''),
  check (work_type = lower(work_type)),
  check (outcome_category = lower(outcome_category)),
  check (source_table is null or source_table = lower(source_table)),
  check (jsonb_typeof(related_sources) = 'array'),
  check (confidence >= 0 and confidence <= 1),
  check (
    avoided_effort_min is null
    or avoided_effort_max is null
    or avoided_effort_max >= avoided_effort_min
  )
);

comment on table public.carepland_work_events is
  'Layer 2 events: what CarePland actually handled, connected, prepared, coordinated, or made reviewable. These bridge raw facts to human outcomes for CarePland at a Glance.';

comment on column public.carepland_work_events.work_type is
  'Clean app-owned vocabulary for what CarePland did. Keep this constrained; add new values deliberately instead of using mushy custom types.';

comment on column public.carepland_work_events.outcome_category is
  'Clean category for the human outcome this work may support, such as visit_prepared, context_connected, or coordination_reduced.';

comment on column public.carepland_work_events.related_sources is
  'Array of source references that support the work event. Expected object shape: {source_type, source_table, source_id, label, role}. Store only source-traceable references or brief safe labels.';

comment on column public.carepland_work_events.confidence is
  'Confidence that CarePland actually performed the described work and that related_sources support it. This is not user confidence or clinical confidence.';

comment on column public.carepland_work_events.avoided_effort_unit is
  'Optional conservative avoided-effort unit for later At a Glance summaries. Keep estimates clearly labeled and avoid marketing claims.';

comment on column public.carepland_work_events.idempotency_key is
  'Optional deterministic key for rerunnable jobs so the same CarePland work is recorded once instead of duplicated.';

create index if not exists carepland_work_events_circle_occurred_idx
  on public.carepland_work_events (care_circle_id, occurred_at desc);

create index if not exists carepland_work_events_subject_occurred_idx
  on public.carepland_work_events (care_subject_id, occurred_at desc)
  where care_subject_id is not null;

create index if not exists carepland_work_events_work_type_idx
  on public.carepland_work_events (care_circle_id, work_type, occurred_at desc);

create index if not exists carepland_work_events_outcome_category_idx
  on public.carepland_work_events (care_circle_id, outcome_category, occurred_at desc);

create index if not exists carepland_work_events_source_idx
  on public.carepland_work_events (source_table, source_id)
  where source_table is not null and source_id is not null;

create index if not exists carepland_work_events_related_sources_gin_idx
  on public.carepland_work_events using gin (related_sources);

create unique index if not exists carepland_work_events_idempotency_idx
  on public.carepland_work_events (care_circle_id, idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

alter table public.carepland_work_events enable row level security;

grant select, insert, update on public.carepland_work_events to authenticated;

drop policy if exists "Care circle members can read work events"
  on public.carepland_work_events;
create policy "Care circle members can read work events"
  on public.carepland_work_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = carepland_work_events.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add work events"
  on public.carepland_work_events;
create policy "Care circle members can add work events"
  on public.carepland_work_events
  for insert
  to authenticated
  with check (
    (
      created_by_user_id is null
      or created_by_user_id = auth.uid()
    )
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = carepland_work_events.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and (
      care_subject_id is null
      or exists (
        select 1
        from public.care_subjects cs
        where cs.id = carepland_work_events.care_subject_id
          and cs.care_circle_id = carepland_work_events.care_circle_id
      )
    )
  );

drop policy if exists "Care circle members can update work events"
  on public.carepland_work_events;
create policy "Care circle members can update work events"
  on public.carepland_work_events
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = carepland_work_events.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = carepland_work_events.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and (
      care_subject_id is null
      or exists (
        select 1
        from public.care_subjects cs
        where cs.id = carepland_work_events.care_subject_id
          and cs.care_circle_id = carepland_work_events.care_circle_id
      )
    )
  );

-- Initial vocabulary examples:
--   careprep_prepared + visit_prepared
--   health_story_connected + context_connected
--   recommendation_identified + recommendation_surfaced
--   duplicate_information_detected + duplication_reduced
--   errand_reassigned + coordination_reduced
--   supporting_evidence_found + review_supported
--
-- TODO(work-events-ingestion): record work events from CarePrep generation,
-- Health Story connection, Recommendations scans, Connect delivery/summary,
-- future Family Errands coordination, reminders, and Daily Focus ranking.
-- TODO(at-a-glance): build summary generation from carepland_work_events plus
-- Layer 1 facts, presenting Layer 3 human outcomes with conservative estimates.
