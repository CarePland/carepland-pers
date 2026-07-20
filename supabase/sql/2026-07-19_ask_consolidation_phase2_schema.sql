-- Ask Consolidation, Phase 2a: canonical schema completion.
--
-- This is the schema half of the real merge approved after Phase 1: it
-- finishes the canonical Ask model (outcome/feedback on submissions, a
-- native analysis-runs table) and adds plain provenance columns so
-- migrated records can always be traced back to their original row --
-- without a permanent bridge subsystem. Provenance here is just two
-- columns living directly on the canonical row (source_system,
-- source_record_id), not a separate tracking table.
--
-- Applied after this file: 2026-07-19_ask_consolidation_phase2_migration.sql
-- (the one-shot data move) and the route/UI cutover described in the
-- implementation report.
--
-- Rollback (safe at any point before the data migration script runs; once
-- migrated rows exist, treat as a real down-migration instead):
--   drop function if exists public.update_ask_analysis_run(uuid, text, text);
--   drop table if exists public.ask_analysis_runs;
--   drop function if exists public.update_ask_submission_outcome(uuid, text, text);
--   alter table public.ask_submission_reviews drop column if exists source_system, drop column if exists source_record_id;
--   alter table public.ask_submissions drop column if exists outcome, drop column if exists user_feedback, drop column if exists user_feedback_at, drop column if exists source_system, drop column if exists source_record_id;
--   alter table public.ask_messages drop column if exists source_system, drop column if exists source_record_id;
--   alter table public.ask_threads drop column if exists source_system, drop column if exists source_record_id;
--   alter table public.support_tickets drop column if exists ask_thread_id;

-- =========================================================================
-- 1. Provenance columns. 'ask' is the default for every row created
--    natively going forward; migrated rows get 'legacy_support_ticket' or
--    'legacy_support_assistant' and the id of the row they came from.
-- =========================================================================

alter table public.ask_threads
  add column if not exists source_system text not null default 'ask'
    check (source_system in ('ask', 'legacy_support_ticket', 'legacy_support_assistant')),
  add column if not exists source_record_id uuid;

alter table public.ask_messages
  add column if not exists source_system text not null default 'ask'
    check (source_system in ('ask', 'legacy_support_ticket', 'legacy_support_assistant')),
  add column if not exists source_record_id uuid;

alter table public.ask_submissions
  add column if not exists source_system text not null default 'ask'
    check (source_system in ('ask', 'legacy_support_ticket', 'legacy_support_assistant')),
  add column if not exists source_record_id uuid;

alter table public.ask_submission_reviews
  add column if not exists source_system text not null default 'ask'
    check (source_system in ('ask', 'legacy_support_assistant')),
  add column if not exists source_record_id uuid;

-- UNIQUE, not a plain index: idempotency for the Phase 2 migration script
-- depends on this being a real database constraint, not just an
-- application-level "check then insert." Postgres treats NULL as distinct
-- from NULL in a unique index by default, so this still allows unlimited
-- natively-created rows (source_system = 'ask', source_record_id = null)
-- while rejecting a second row for the same migrated source record --
-- including under a race (e.g. the migration function invoked twice
-- concurrently), where the loser gets a real constraint-violation
-- exception instead of silently duplicating data.
create unique index if not exists ask_threads_source_idx
  on public.ask_threads (source_system, source_record_id);

-- Plain, not unique: a single legacy interaction legitimately produces two
-- ask_messages rows (the migrated question and the migrated answer), both
-- carrying the same source_record_id -- uniqueness only holds at the
-- thread/submission/review level, where each source row maps to exactly
-- one destination row.
create index if not exists ask_messages_source_idx
  on public.ask_messages (source_system, source_record_id);

create unique index if not exists ask_submissions_source_idx
  on public.ask_submissions (source_system, source_record_id);

create unique index if not exists ask_submission_reviews_source_idx
  on public.ask_submission_reviews (source_system, source_record_id);

-- One new column on the old side, for the migration script's own
-- reconciliation queries (support_tickets.ask_submission_id, added in
-- ask_foundation.sql, points at the wrong target type -- a ticket becomes a
-- thread, not a single AI verdict). This is not a bridge subsystem: it is
-- populated once, during the migration window, and both old table and
-- column go away together at the final DROP TABLE step.
alter table public.support_tickets
  add column if not exists ask_thread_id uuid references public.ask_threads(id) on delete set null;

create index if not exists support_tickets_ask_thread_idx
  on public.support_tickets (ask_thread_id);

-- =========================================================================
-- 2. Outcome / user feedback on ask_submissions, ported from
--    support_assistant_interactions -- Ask's answer_now responses have had
--    no feedback loop until now. Changes are logged to ask_thread_events
--    (old_value/new_value) rather than silently overwritten, so a changed
--    mind is visible history, not an invisible mutation.
-- =========================================================================

alter table public.ask_submissions
  add column if not exists outcome text not null default 'answered'
    check (outcome in ('answered', 'helpful', 'not_helpful', 'escalated')),
  add column if not exists user_feedback text,
  add column if not exists user_feedback_at timestamptz;

create index if not exists ask_submissions_outcome_idx
  on public.ask_submissions (outcome, created_at desc);

create or replace function public.update_ask_submission_outcome(
  p_ask_submission_id uuid,
  p_outcome text,
  p_user_feedback text default null
)
returns public.ask_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_submission public.ask_submissions%rowtype;
  updated_submission public.ask_submissions%rowtype;
  caller_is_admin boolean;
  cleaned_outcome text;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to update Ask submission feedback';
  end if;

  select coalesce(p.is_admin, false)
    into caller_is_admin
  from public.profiles p
  where p.id = auth.uid();

  select *
    into existing_submission
  from public.ask_submissions
  where id = p_ask_submission_id
  for update;

  if not found then
    raise exception 'Ask submission not found';
  end if;

  if existing_submission.user_id <> auth.uid() and coalesce(caller_is_admin, false) = false then
    raise exception 'You do not have access to this Ask submission';
  end if;

  cleaned_outcome := coalesce(nullif(trim(p_outcome), ''), existing_submission.outcome);

  if cleaned_outcome not in ('answered', 'helpful', 'not_helpful', 'escalated') then
    raise exception 'Unsupported Ask submission outcome: %', cleaned_outcome;
  end if;

  update public.ask_submissions
  set outcome = cleaned_outcome,
      user_feedback = nullif(trim(coalesce(p_user_feedback, user_feedback, '')), ''),
      user_feedback_at = case
        when cleaned_outcome <> existing_submission.outcome
          or nullif(trim(coalesce(p_user_feedback, '')), '') is distinct from existing_submission.user_feedback
        then now()
        else user_feedback_at
      end,
      updated_at = now()
  where id = existing_submission.id
  returning * into updated_submission;

  insert into public.ask_thread_events (
    thread_id,
    event_type,
    old_value,
    new_value,
    actor_user_id,
    note
  )
  values (
    existing_submission.thread_id,
    'submission_feedback_updated',
    jsonb_build_object(
      'ask_submission_id', existing_submission.id,
      'outcome', existing_submission.outcome,
      'user_feedback', existing_submission.user_feedback
    ),
    jsonb_build_object(
      'ask_submission_id', updated_submission.id,
      'outcome', updated_submission.outcome,
      'user_feedback', updated_submission.user_feedback
    ),
    auth.uid(),
    'Ask submission outcome/feedback updated'
  );

  return updated_submission;
end;
$$;

grant execute on function public.update_ask_submission_outcome(uuid, text, text)
  to authenticated;

-- =========================================================================
-- 3. ask_analysis_runs: native replacement for
--    support_assistant_analysis_runs, shaped around ask_submission_ids only
--    (no dual-shape interaction_ids column -- that table stays frozen and
--    read-only after cutover; its handful of historical runs analyzed a
--    different record shape and are not force-migrated into this one).
--    Reproducible by design: the exact submission set, the filter criteria
--    used to select them, the model, the instruction/prompt version, the
--    full result, and both queued and completed timestamps are all
--    retained.
-- =========================================================================

create table if not exists public.ask_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by_user_id uuid not null references auth.users(id) on delete cascade,
  criteria jsonb not null default '{}'::jsonb,
  ask_submission_ids uuid[] not null default '{}',
  submission_count integer not null default 0,
  model text not null default 'gpt-4.1-mini',
  instruction_version_id uuid references public.ai_instruction_versions(id) on delete set null,
  prompt_version text,
  analysis_summary text not null default '',
  failure_patterns jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  prompt_recommendations jsonb not null default '[]'::jsonb,
  ui_recommendations jsonb not null default '[]'::jsonb,
  raw_output jsonb not null default '{}'::jsonb,
  admin_status text not null default 'new'
    check (admin_status in ('new', 'reviewed', 'accepted', 'rejected', 'needs_more_data')),
  admin_note text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ask_analysis_runs_created_idx
  on public.ask_analysis_runs (created_at desc);

create index if not exists ask_analysis_runs_submission_ids_idx
  on public.ask_analysis_runs using gin (ask_submission_ids);

alter table public.ask_analysis_runs enable row level security;

grant select, insert on public.ask_analysis_runs to authenticated;

drop policy if exists "Admins can read ask analysis runs" on public.ask_analysis_runs;
create policy "Admins can read ask analysis runs"
  on public.ask_analysis_runs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Admins can create ask analysis runs" on public.ask_analysis_runs;
create policy "Admins can create ask analysis runs"
  on public.ask_analysis_runs
  for insert
  to authenticated
  with check (
    requested_by_user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

create or replace function public.update_ask_analysis_run(
  p_run_id uuid,
  p_admin_status text,
  p_admin_note text default null
)
returns public.ask_analysis_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_status text;
  updated_run public.ask_analysis_runs%rowtype;
begin
  perform public.assert_current_user_is_admin();

  cleaned_status := coalesce(nullif(trim(p_admin_status), ''), 'reviewed');

  if cleaned_status not in ('new', 'reviewed', 'accepted', 'rejected', 'needs_more_data') then
    raise exception 'Unsupported Ask analysis run status: %', cleaned_status;
  end if;

  update public.ask_analysis_runs
  set admin_status = cleaned_status,
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      updated_at = now()
  where id = p_run_id
  returning * into updated_run;

  if not found then
    raise exception 'Ask analysis run not found';
  end if;

  return updated_run;
end;
$$;

grant execute on function public.update_ask_analysis_run(uuid, text, text)
  to authenticated;
