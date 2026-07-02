-- CarePland Recommendation review audit events.
--
-- Run after 2026-07-01_care_recommendations_foundation.sql.
-- This keeps approve/dismiss/write-to-focus decisions append-only and
-- person-scoped without changing the recommendation candidate/evidence model.

create table if not exists public.care_recommendation_review_events (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.care_recommendations(id) on delete cascade,
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  action text not null
    check (action in ('approve', 'dismiss', 'expire', 'convert_to_focus')),
  recommendation_outcome text
    check (
      recommendation_outcome in (
        'approved',
        'dismissed_temporary',
        'dismissed_permanent',
        'snoozed_time',
        'snoozed_until_new_evidence',
        'written_to_focus'
      )
    ),
  dismissal_type text
    check (
      dismissal_type in (
        'temporary',
        'permanent',
        'snooze_until_new_evidence'
      )
    ),
  prior_status text,
  resulting_status text not null
    check (
      resulting_status in (
        'approved',
        'candidate',
        'converted_to_focus',
        'dismissed',
        'expired'
      )
    ),
  review_note text,
  focus_item_id uuid references public.focus_items(id) on delete set null,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (review_note is null or length(btrim(review_note)) > 0)
);

alter table public.care_recommendation_review_events
  add column if not exists recommendation_outcome text;

alter table public.care_recommendation_review_events
  drop constraint if exists care_recommendation_review_events_recommendation_outcome_check;

alter table public.care_recommendation_review_events
  add constraint care_recommendation_review_events_recommendation_outcome_check
  check (
    recommendation_outcome is null
    or recommendation_outcome in (
      'approved',
      'dismissed_temporary',
      'dismissed_permanent',
      'snoozed_time',
      'snoozed_until_new_evidence',
      'written_to_focus'
    )
  );

comment on table public.care_recommendation_review_events is
  'Append-only audit trail for approve, dismiss, expire, and write-to-focus decisions on CarePland recommendation candidates.';

comment on column public.care_recommendation_review_events.review_note is
  'Human-entered review note. Required by app policy when dismissing a candidate so future model tuning can understand why it was rejected.';

comment on column public.care_recommendation_review_events.recommendation_outcome is
  'First-class learning outcome for recommendation review: approved, dismissed_temporary, dismissed_permanent, snoozed_time, snoozed_until_new_evidence, or written_to_focus.';

create index if not exists care_recommendation_review_events_recommendation_idx
  on public.care_recommendation_review_events (recommendation_id, reviewed_at desc);

create index if not exists care_recommendation_review_events_subject_idx
  on public.care_recommendation_review_events (care_subject_id, action, reviewed_at desc);

alter table public.care_recommendation_review_events enable row level security;

grant select, insert on public.care_recommendation_review_events to authenticated;

drop policy if exists "Care circle members can read recommendation review events"
  on public.care_recommendation_review_events;
create policy "Care circle members can read recommendation review events"
  on public.care_recommendation_review_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_recommendation_review_events.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add recommendation review events"
  on public.care_recommendation_review_events;
create policy "Care circle members can add recommendation review events"
  on public.care_recommendation_review_events
  for insert
  to authenticated
  with check (
    reviewed_by_user_id = auth.uid()
    and exists (
      select 1
      from public.care_recommendations cr
      join public.care_circle_memberships ccm
        on ccm.care_circle_id = cr.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
      where cr.id = care_recommendation_review_events.recommendation_id
        and cr.care_circle_id = care_recommendation_review_events.care_circle_id
        and cr.care_subject_id = care_recommendation_review_events.care_subject_id
    )
  );
