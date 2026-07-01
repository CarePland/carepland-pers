-- CarePland Recommendations foundation.
--
-- Recommendations are candidates, not user-visible Daily Focus items and not
-- autonomous care actions. They retain evidence so a person can later approve,
-- modify, dismiss, or convert them to Focus Items.

create table if not exists public.care_recommendations (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  recommendation_type text not null default 'daily_focus_candidate'
    check (
      recommendation_type in (
        'daily_focus_candidate',
        'careprep_candidate',
        'reminder_candidate',
        'health_focus_candidate',
        'custom'
      )
    ),
  title text not null,
  description text,
  reason text not null,
  dedupe_key text not null default '',
  source_type text not null default 'system'
    check (
      source_type in (
        'provider_recommendation',
        'user_goal',
        'caregiver_goal',
        'appointment_note',
        'careprep_guidance',
        'health_focus',
        'track_history',
        'reminder',
        'caregiver_note',
        'manual_note',
        'talk_voice',
        'import_anything',
        'system',
        'custom'
      )
    ),
  source_table text,
  source_id uuid,
  confidence numeric not null default 0.5,
  priority text not null default 'normal'
    check (priority in ('critical', 'high', 'normal', 'low')),
  expires_at timestamptz,
  status text not null default 'candidate'
    check (
      status in (
        'candidate',
        'approved',
        'dismissed',
        'expired',
        'converted_to_focus'
      )
    ),
  converted_focus_item_id uuid references public.focus_items(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_updated_by_user_id uuid references auth.users(id) on delete set null,
  status_updated_at timestamptz,
  structured_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  check (title <> ''),
  check (reason <> ''),
  check (confidence >= 0 and confidence <= 1),
  check (source_table is null or source_table = lower(source_table))
);

comment on table public.care_recommendations is
  'Reviewable recommendation candidates for possible Focus Items, reminders, or preparation prompts. Candidates are not automatically shown or converted.';

comment on column public.care_recommendations.reason is
  'Plain-language explanation of why this recommendation exists. This should be safe to show to a user or caregiver.';

comment on column public.care_recommendations.dedupe_key is
  'Deterministic generation key used to merge repeated v1 scans into the same open candidate instead of creating duplicates.';

comment on column public.care_recommendations.priority is
  'Simple priority based on evidence strength/source, not autonomous AI opinion. Critical is reserved for explicit source wording and should not be inferred.';

comment on column public.care_recommendations.structured_payload is
  'Recommended completion type, event type, prompt config, matched topics, and other reviewable details for future approval workflows.';

create table if not exists public.care_recommendation_evidence (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.care_recommendations(id) on delete cascade,
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  source_type text not null
    check (
      source_type in (
        'provider_recommendation',
        'user_goal',
        'caregiver_goal',
        'appointment_note',
        'careprep_guidance',
        'health_focus',
        'track_history',
        'reminder',
        'caregiver_note',
        'manual_note',
        'talk_voice',
        'import_anything',
        'system',
        'custom'
      )
    ),
  source_table text,
  source_id uuid,
  source_label text,
  evidence_text text not null,
  evidence_hash text not null default '',
  occurred_at timestamptz,
  confidence numeric not null default 0.5,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (evidence_text <> ''),
  check (confidence >= 0 and confidence <= 1),
  check (source_table is null or source_table = lower(source_table))
);

comment on table public.care_recommendation_evidence is
  'Supporting evidence for recommendation candidates. A recommendation can retain multiple appointment note, CarePrep, Health Focus, goal, or Track sources.';

create index if not exists care_recommendations_subject_status_idx
  on public.care_recommendations (care_subject_id, status, priority, created_at desc);

create index if not exists care_recommendations_subject_type_idx
  on public.care_recommendations (care_subject_id, recommendation_type, status, created_at desc);

create unique index if not exists care_recommendations_open_dedupe_idx
  on public.care_recommendations (care_subject_id, recommendation_type, dedupe_key)
  where dedupe_key <> '' and status in ('candidate', 'approved');

create index if not exists care_recommendations_expires_idx
  on public.care_recommendations (expires_at)
  where expires_at is not null and status = 'candidate';

create index if not exists care_recommendation_evidence_recommendation_idx
  on public.care_recommendation_evidence (recommendation_id, created_at);

create index if not exists care_recommendation_evidence_source_idx
  on public.care_recommendation_evidence (source_table, source_id)
  where source_table is not null and source_id is not null;

create unique index if not exists care_recommendation_evidence_hash_idx
  on public.care_recommendation_evidence (recommendation_id, evidence_hash)
  where evidence_hash <> '';

alter table public.care_recommendations enable row level security;
alter table public.care_recommendation_evidence enable row level security;

grant select, insert, update on public.care_recommendations to authenticated;
grant select, insert, update on public.care_recommendation_evidence to authenticated;

drop policy if exists "Care circle members can read care recommendations"
  on public.care_recommendations;
create policy "Care circle members can read care recommendations"
  on public.care_recommendations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_recommendations.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add care recommendations"
  on public.care_recommendations;
create policy "Care circle members can add care recommendations"
  on public.care_recommendations
  for insert
  to authenticated
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_recommendations.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = care_recommendations.care_subject_id
        and cs.care_circle_id = care_recommendations.care_circle_id
    )
  );

drop policy if exists "Care circle members can update care recommendations"
  on public.care_recommendations;
create policy "Care circle members can update care recommendations"
  on public.care_recommendations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_recommendations.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_recommendations.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = care_recommendations.care_subject_id
        and cs.care_circle_id = care_recommendations.care_circle_id
    )
  );

drop policy if exists "Care circle members can read recommendation evidence"
  on public.care_recommendation_evidence;
create policy "Care circle members can read recommendation evidence"
  on public.care_recommendation_evidence
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_recommendation_evidence.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add recommendation evidence"
  on public.care_recommendation_evidence;
create policy "Care circle members can add recommendation evidence"
  on public.care_recommendation_evidence
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.care_recommendations cr
      join public.care_circle_memberships ccm
        on ccm.care_circle_id = cr.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
      where cr.id = care_recommendation_evidence.recommendation_id
        and cr.care_circle_id = care_recommendation_evidence.care_circle_id
        and cr.care_subject_id = care_recommendation_evidence.care_subject_id
    )
  );

drop policy if exists "Care circle members can update recommendation evidence"
  on public.care_recommendation_evidence;
create policy "Care circle members can update recommendation evidence"
  on public.care_recommendation_evidence
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_recommendation_evidence.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.care_recommendations cr
      join public.care_circle_memberships ccm
        on ccm.care_circle_id = cr.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
      where cr.id = care_recommendation_evidence.recommendation_id
        and cr.care_circle_id = care_recommendation_evidence.care_circle_id
        and cr.care_subject_id = care_recommendation_evidence.care_subject_id
    )
  );

-- No AI prompt is seeded in this foundation. Initial generation should be
-- deterministic and evidence-based. If AI-assisted recommendation generation
-- or ranking is introduced later, seed that prompt through the existing
-- Admin-managed ai_instruction_versions workflow before product use.
--
-- TODO(recommendations-approval): design approval/edit/dismiss UX before
-- converting candidates to focus_items.
-- TODO(recommendations-conversion): define how converted_to_focus stores the
-- final focus item and whether evidence should be copied into Focus metadata.
