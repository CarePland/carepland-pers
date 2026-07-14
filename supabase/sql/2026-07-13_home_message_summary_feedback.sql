-- Home Message Summary feedback foundation.
-- Safe to re-run. Captures user "Not quite" comments for improving
-- deterministic and future model-backed homepage message summaries.

create table if not exists public.home_message_summary_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  target_type text not null default 'home_message_summary'
    check (target_type in ('home_message_summary')),
  feedback_value text not null default 'not_quite'
    check (feedback_value in ('not_quite')),
  summary_text text not null,
  user_comment text not null,
  source_message_ids text[] not null default '{}',
  summary_snapshot jsonb not null default '{}'::jsonb,
  decision_trace jsonb not null default '{}'::jsonb,
  model text,
  should_influence_future_generation boolean not null default true,
  incorporation_status text not null default 'pending'
    check (incorporation_status in ('pending', 'incorporated', 'ignored', 'superseded')),
  incorporated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(summary_text) between 1 and 2000),
  check (char_length(user_comment) between 1 and 2000)
);

create index if not exists home_message_summary_feedback_subject_idx
  on public.home_message_summary_feedback (care_subject_id, created_at desc);

create index if not exists home_message_summary_feedback_user_idx
  on public.home_message_summary_feedback (user_id, created_at desc);

create index if not exists home_message_summary_feedback_incorporation_idx
  on public.home_message_summary_feedback (
    incorporation_status,
    should_influence_future_generation
  );

alter table public.home_message_summary_feedback enable row level security;

grant select, insert, update on public.home_message_summary_feedback to authenticated;

drop policy if exists "Care circle members can read home message summary feedback"
  on public.home_message_summary_feedback;
create policy "Care circle members can read home message summary feedback"
  on public.home_message_summary_feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = home_message_summary_feedback.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can write home message summary feedback"
  on public.home_message_summary_feedback;
create policy "Care circle members can write home message summary feedback"
  on public.home_message_summary_feedback
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = home_message_summary_feedback.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = home_message_summary_feedback.care_subject_id
        and cs.care_circle_id = home_message_summary_feedback.care_circle_id
    )
  );

drop policy if exists "Care circle members can update own home message summary feedback"
  on public.home_message_summary_feedback;
create policy "Care circle members can update own home message summary feedback"
  on public.home_message_summary_feedback
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = home_message_summary_feedback.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = home_message_summary_feedback.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );
