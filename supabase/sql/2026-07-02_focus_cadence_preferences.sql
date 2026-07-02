-- Today’s Focus cadence/preferences foundation.
--
-- This is not a reminder scheduler. These rows represent user preference
-- signals that influence how often recommendation-backed Focus Items surface.
-- New evidence may allow a recommendation to reappear even after suppression.

create table if not exists public.focus_cadence_preferences (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  focus_item_id uuid references public.focus_items(id) on delete set null,
  recommendation_id uuid references public.care_recommendations(id) on delete set null,
  target_type text not null default 'focus_item'
    check (
      target_type in (
        'focus_item',
        'recommendation',
        'recommendation_type',
        'dedupe_key',
        'custom'
      )
    ),
  target_key text not null,
  preference_action text not null
    check (
      preference_action in (
        'show_less_often',
        'hide_until_next_appointment',
        'snooze_30_days',
        'stop_suggesting'
      )
    ),
  cadence text
    check (
      cadence is null or cadence in (
        'few_times_a_week',
        'weekly',
        'every_couple_of_weeks',
        'monthly',
        'only_before_appointments'
      )
    ),
  snoozed_until date,
  evidence_signature text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_key <> '')
);

comment on table public.focus_cadence_preferences is
  'User-specific preferences that influence how often recommendation-backed Today’s Focus items appear. Not a reminder schedule.';

comment on column public.focus_cadence_preferences.evidence_signature is
  'Evidence/recommendation fingerprint at the time the preference was set. New evidence can allow a recommendation to surface again.';

create unique index if not exists focus_cadence_preferences_user_target_idx
  on public.focus_cadence_preferences (
    care_subject_id,
    created_by_user_id,
    target_type,
    target_key
  );

create index if not exists focus_cadence_preferences_subject_action_idx
  on public.focus_cadence_preferences (
    care_subject_id,
    preference_action,
    updated_at desc
  );

alter table public.focus_cadence_preferences enable row level security;

grant select, insert, update on public.focus_cadence_preferences to authenticated;

drop policy if exists "Care circle members can read focus cadence preferences"
  on public.focus_cadence_preferences;
create policy "Care circle members can read focus cadence preferences"
  on public.focus_cadence_preferences
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = focus_cadence_preferences.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add focus cadence preferences"
  on public.focus_cadence_preferences;
create policy "Care circle members can add focus cadence preferences"
  on public.focus_cadence_preferences
  for insert
  to authenticated
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = focus_cadence_preferences.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = focus_cadence_preferences.care_subject_id
        and cs.care_circle_id = focus_cadence_preferences.care_circle_id
    )
  );

drop policy if exists "Care circle members can update focus cadence preferences"
  on public.focus_cadence_preferences;
create policy "Care circle members can update focus cadence preferences"
  on public.focus_cadence_preferences
  for update
  to authenticated
  using (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = focus_cadence_preferences.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = focus_cadence_preferences.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );
