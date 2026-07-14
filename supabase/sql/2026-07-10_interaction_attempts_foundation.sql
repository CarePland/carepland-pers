-- Interaction Attempts foundation.
--
-- Observations remain immutable captured inputs.
-- Decision Traces explain one interpretation.
-- Interaction Attempts explain how a user's overall effort unfolded across
-- observations, revisions, responses, feedback, and outcomes.
-- CarePland Work Events remain reserved for work CarePland actually handled.

create table if not exists public.interaction_attempts (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid references public.care_subjects(id) on delete set null,
  surface text not null default '',
  active_workflow text not null default '',
  status text not null default 'in_progress'
    check (
      status in (
        'in_progress',
        'completed',
        'cancelled',
        'abandoned',
        'timed_out',
        'escalated'
      )
    ),
  outcome text not null default ''
    check (
      outcome in (
        '',
        'answered',
        'communicated',
        'sent',
        'workflow_completed',
        'not_helpful',
        'cancelled',
        'abandoned',
        'timed_out'
      )
    ),
  latest_observation_id text,
  revision_count integer not null default 0 check (revision_count >= 0),
  receiver_device_id text,
  device_id text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (jsonb_typeof(metadata) = 'object')
);

comment on table public.interaction_attempts is
  'Platform diagnostic parent for one overall user effort across multiple immutable Observations, revisions, responses, and outcomes.';

comment on column public.interaction_attempts.latest_observation_id is
  'Text Observation id for the latest submitted Observation. Observation ids are platform ids and may not be UUIDs.';

create table if not exists public.interaction_attempt_observations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.interaction_attempts(id) on delete cascade,
  observation_id text not null,
  revision_index integer not null check (revision_index >= 0),
  parent_observation_id text,
  revision_reason text not null default 'initial'
    check (
      revision_reason in (
        'initial',
        'rephrase',
        'clarification',
        'retry',
        'correction',
        'modality_switch'
      )
    ),
  observation_snapshot jsonb not null default '{}'::jsonb,
  observed_at timestamptz,
  created_at timestamptz not null default now(),
  check (observation_id <> ''),
  check (jsonb_typeof(observation_snapshot) = 'object'),
  unique (attempt_id, observation_id),
  unique (attempt_id, revision_index)
);

comment on table public.interaction_attempt_observations is
  'Append-only membership of immutable Observations within an Interaction Attempt. Rephrases create new rows instead of mutating previous Observations.';

create table if not exists public.interaction_attempt_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.interaction_attempts(id) on delete cascade,
  event_type text not null
    check (
      event_type in (
        'attempt_started',
        'observation_submitted',
        'response_presented',
        'helpful_selected',
        'not_helpful_selected',
        'rephrase_selected',
        'revision_observation_submitted',
        'send_selected',
        'workflow_completed',
        'cancelled',
        'abandoned',
        'timed_out'
      )
    ),
  observation_id text,
  actor_role text not null default 'system'
    check (
      actor_role in (
        'system',
        'receiver_user',
        'caregiver',
        'dashboard',
        'admin'
      )
    ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(payload) = 'object')
);

comment on table public.interaction_attempt_events is
  'Append-only diagnostic event log for user feedback, recovery, revision, completion, cancellation, abandonment, and timeout events within an Interaction Attempt.';

create table if not exists public.interaction_attempt_platform_reviews (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.interaction_attempts(id) on delete cascade,
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  comment text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (length(trim(comment)) > 0),
  check (length(comment) <= 4000),
  check (jsonb_typeof(metadata) = 'object')
);

comment on table public.interaction_attempt_platform_reviews is
  'Append-only administrator reviews describing what was learned from an Interaction Attempt. Reviews are platform improvement artifacts and must not directly change production interpretation behavior.';

create table if not exists public.interaction_attempt_platform_review_analyses (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.interaction_attempt_platform_reviews(id) on delete cascade,
  attempt_id uuid not null references public.interaction_attempts(id) on delete cascade,
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  analysis_text text not null,
  identified_concerns text[] not null default '{}',
  affected_platform_layers text[] not null default '{}',
  suggested_refinement_areas text[] not null default '{}',
  model text not null default '',
  model_version text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (length(trim(analysis_text)) > 0),
  check (jsonb_typeof(metadata) = 'object')
);

comment on table public.interaction_attempt_platform_review_analyses is
  'Advisory analysis of a human Platform Review. Analyses are separate from human comments and must never become interpreter memory or modify production prompts, classification, workflow selection, or Receiver behavior.';

create index if not exists interaction_attempts_circle_created_idx
  on public.interaction_attempts (care_circle_id, created_at desc);

create index if not exists interaction_attempts_subject_created_idx
  on public.interaction_attempts (care_subject_id, created_at desc)
  where care_subject_id is not null;

create index if not exists interaction_attempts_status_idx
  on public.interaction_attempts (care_circle_id, status, updated_at desc);

create index if not exists interaction_attempt_observations_attempt_idx
  on public.interaction_attempt_observations (attempt_id, revision_index);

create index if not exists interaction_attempt_events_attempt_idx
  on public.interaction_attempt_events (attempt_id, created_at);

create index if not exists interaction_attempt_events_type_idx
  on public.interaction_attempt_events (event_type, created_at desc);

create index if not exists interaction_attempt_platform_reviews_attempt_idx
  on public.interaction_attempt_platform_reviews (attempt_id, created_at);

create index if not exists interaction_attempt_platform_review_analyses_review_idx
  on public.interaction_attempt_platform_review_analyses (review_id, created_at);

create index if not exists interaction_attempt_platform_review_analyses_attempt_idx
  on public.interaction_attempt_platform_review_analyses (attempt_id, created_at);

alter table public.interaction_attempts enable row level security;
alter table public.interaction_attempt_observations enable row level security;
alter table public.interaction_attempt_events enable row level security;
alter table public.interaction_attempt_platform_reviews enable row level security;
alter table public.interaction_attempt_platform_review_analyses enable row level security;

grant select, insert, update on public.interaction_attempts to authenticated;
grant select, insert on public.interaction_attempt_observations to authenticated;
grant select, insert on public.interaction_attempt_events to authenticated;
grant select, insert on public.interaction_attempt_platform_reviews to authenticated;
grant select, insert on public.interaction_attempt_platform_review_analyses to authenticated;

drop policy if exists "Care circle members can read interaction attempts"
  on public.interaction_attempts;
create policy "Care circle members can read interaction attempts"
  on public.interaction_attempts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = interaction_attempts.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add interaction attempts"
  on public.interaction_attempts;
create policy "Care circle members can add interaction attempts"
  on public.interaction_attempts
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
      where ccm.care_circle_id = interaction_attempts.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and (
      care_subject_id is null
      or exists (
        select 1
        from public.care_subjects cs
        where cs.id = interaction_attempts.care_subject_id
          and cs.care_circle_id = interaction_attempts.care_circle_id
      )
    )
  );

drop policy if exists "Care circle members can update interaction attempts"
  on public.interaction_attempts;
create policy "Care circle members can update interaction attempts"
  on public.interaction_attempts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = interaction_attempts.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = interaction_attempts.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can read attempt observations"
  on public.interaction_attempt_observations;
create policy "Care circle members can read attempt observations"
  on public.interaction_attempt_observations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.interaction_attempts ia
      join public.care_circle_memberships ccm
        on ccm.care_circle_id = ia.care_circle_id
      where ia.id = interaction_attempt_observations.attempt_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add attempt observations"
  on public.interaction_attempt_observations;
create policy "Care circle members can add attempt observations"
  on public.interaction_attempt_observations
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.interaction_attempts ia
      join public.care_circle_memberships ccm
        on ccm.care_circle_id = ia.care_circle_id
      where ia.id = interaction_attempt_observations.attempt_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can read attempt events"
  on public.interaction_attempt_events;
create policy "Care circle members can read attempt events"
  on public.interaction_attempt_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.interaction_attempts ia
      join public.care_circle_memberships ccm
        on ccm.care_circle_id = ia.care_circle_id
      where ia.id = interaction_attempt_events.attempt_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add attempt events"
  on public.interaction_attempt_events;
create policy "Care circle members can add attempt events"
  on public.interaction_attempt_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.interaction_attempts ia
      join public.care_circle_memberships ccm
        on ccm.care_circle_id = ia.care_circle_id
      where ia.id = interaction_attempt_events.attempt_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Admins can read platform reviews"
  on public.interaction_attempt_platform_reviews;
create policy "Admins can read platform reviews"
  on public.interaction_attempt_platform_reviews
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = interaction_attempt_platform_reviews.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Admins can add platform reviews"
  on public.interaction_attempt_platform_reviews;
create policy "Admins can add platform reviews"
  on public.interaction_attempt_platform_reviews
  for insert
  to authenticated
  with check (
    (
      reviewer_user_id is null
      or reviewer_user_id = auth.uid()
    )
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
    and exists (
      select 1
      from public.interaction_attempts ia
      where ia.id = interaction_attempt_platform_reviews.attempt_id
        and ia.care_circle_id = interaction_attempt_platform_reviews.care_circle_id
    )
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = interaction_attempt_platform_reviews.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Admins can read platform review analyses"
  on public.interaction_attempt_platform_review_analyses;
create policy "Admins can read platform review analyses"
  on public.interaction_attempt_platform_review_analyses
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = interaction_attempt_platform_review_analyses.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Admins can add platform review analyses"
  on public.interaction_attempt_platform_review_analyses;
create policy "Admins can add platform review analyses"
  on public.interaction_attempt_platform_review_analyses
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_admin = true
    )
    and exists (
      select 1
      from public.interaction_attempt_platform_reviews review
      where review.id = interaction_attempt_platform_review_analyses.review_id
        and review.attempt_id = interaction_attempt_platform_review_analyses.attempt_id
        and review.care_circle_id = interaction_attempt_platform_review_analyses.care_circle_id
    )
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = interaction_attempt_platform_review_analyses.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );
