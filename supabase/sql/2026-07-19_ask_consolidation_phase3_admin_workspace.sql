-- Ask Consolidation, Phase 3: unified admin workspace support.
--
-- Adds the review taxonomy the unified admin workspace needs (splitting
-- "was the AI's answer good" from "what's the underlying improvement
-- category" -- ask_submission_reviews shipped in Phase 1 with a single
-- conflated review_status enum that was never wired to any UI and holds
-- zero rows, so this replaces rather than migrates it), a status-only
-- thread transition RPC for the "confirm and close, no new message
-- needed" case, and two indexes the new admin queues query by.
--
-- Applied after: 2026-07-19_ask_consolidation_phase2_schema.sql and
-- 2026-07-19_ask_consolidation_phase2_migration.sql.
--
-- Rollback (safe at any point -- nothing here has migrated data riding on
-- it; review_status held zero rows before this file ran):
--   drop function if exists public.set_ask_thread_case_status(uuid, text, text);
--   drop index if exists ask_threads_case_status_updated_idx;
--   drop index if exists ask_submissions_thread_created_idx;
--   drop function if exists public.create_ask_submission_review(uuid, text, text, text, text);
--   alter table public.ask_submission_reviews drop column if exists answer_quality, drop column if exists improvement_category;
--   -- review_status is not restored -- see note above.

-- =========================================================================
-- 1. Review taxonomy: two independent axes instead of one conflated enum.
--    answer_quality is a verdict on the specific AI answer; improvement_
--    category is a root-cause classification for product/prompt work.
--    Either, both, or neither may be set on a given review row -- only
--    the free-text note is meaningful on its own; a review with nothing
--    at all is rejected by create_ask_submission_review below.
-- =========================================================================

drop function if exists public.create_ask_submission_review(uuid, text, text, text);

alter table public.ask_submission_reviews
  drop column if exists review_status,
  add column if not exists answer_quality text
    check (answer_quality in ('good', 'incomplete', 'misleading', 'poorly_routed', 'unnecessary')),
  add column if not exists improvement_category text
    check (improvement_category in ('prompt_issue', 'missing_knowledge', 'ui_confusion', 'product_bug', 'routing_error', 'non_actionable'));

create or replace function public.create_ask_submission_review(
  p_ask_submission_id uuid,
  p_answer_quality text default null,
  p_improvement_category text default null,
  p_admin_note text default null,
  p_recommended_action text default null
)
returns public.ask_submission_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  new_review public.ask_submission_reviews%rowtype;
  cleaned_quality text;
  cleaned_category text;
begin
  perform public.assert_current_user_is_admin();

  if not exists (
    select 1 from public.ask_submissions s where s.id = p_ask_submission_id
  ) then
    raise exception 'Ask submission not found';
  end if;

  cleaned_quality := nullif(trim(coalesce(p_answer_quality, '')), '');
  cleaned_category := nullif(trim(coalesce(p_improvement_category, '')), '');

  if cleaned_quality is not null
    and cleaned_quality not in ('good', 'incomplete', 'misleading', 'poorly_routed', 'unnecessary')
  then
    raise exception 'Unsupported Ask answer quality: %', cleaned_quality;
  end if;

  if cleaned_category is not null
    and cleaned_category not in ('prompt_issue', 'missing_knowledge', 'ui_confusion', 'product_bug', 'routing_error', 'non_actionable')
  then
    raise exception 'Unsupported Ask improvement category: %', cleaned_category;
  end if;

  if cleaned_quality is null
    and cleaned_category is null
    and nullif(trim(coalesce(p_admin_note, '')), '') is null
  then
    raise exception 'A review needs a quality rating, an improvement category, or a note';
  end if;

  insert into public.ask_submission_reviews (
    ask_submission_id,
    reviewer_user_id,
    answer_quality,
    improvement_category,
    admin_note,
    recommended_action
  ) values (
    p_ask_submission_id,
    auth.uid(),
    cleaned_quality,
    cleaned_category,
    trim(coalesce(p_admin_note, '')),
    nullif(trim(coalesce(p_recommended_action, '')), '')
  )
  returning * into new_review;

  return new_review;
end;
$$;

grant execute on function public.create_ask_submission_review(uuid, text, text, text, text)
  to authenticated;

-- =========================================================================
-- 2. Indexes the unified admin workspace's two queues query by: "Needs
--    Response" filters/sorts ask_threads by (case_status, updated_at);
--    both that queue and the per-thread workspace look up "the most
--    recent submission for this thread" by (thread_id, created_at desc).
-- =========================================================================

create index if not exists ask_threads_case_status_updated_idx
  on public.ask_threads (case_status, updated_at);

create index if not exists ask_submissions_thread_created_idx
  on public.ask_submissions (thread_id, created_at desc);

-- =========================================================================
-- 3. Status-only thread transition, for "the AI already answered well,
--    just confirm and close" or "reopen this" -- cases that don't need a
--    new visible message. This is a secondary, explicit one-click action;
--    the primary path for changing case_status stays the reply/note form
--    via add_ask_message_with_case_transition's p_case_status_override,
--    since most resolves/reopens naturally come with something to tell
--    the user. Admin-only; logs to ask_thread_events like every other
--    thread-state change, so the audit trail has one consistent shape
--    regardless of which path caused the transition.
-- =========================================================================

create or replace function public.set_ask_thread_case_status(
  p_thread_id uuid,
  p_case_status text,
  p_note text default null
)
returns public.ask_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_thread public.ask_threads%rowtype;
  updated_thread public.ask_threads%rowtype;
  cleaned_status text;
begin
  perform public.assert_current_user_is_admin();

  cleaned_status := coalesce(nullif(trim(p_case_status), ''), '');

  if cleaned_status not in ('open', 'waiting_on_user', 'waiting_on_admin', 'resolved', 'closed') then
    raise exception 'Unsupported Ask case status: %', cleaned_status;
  end if;

  select *
    into existing_thread
  from public.ask_threads
  where id = p_thread_id
  for update;

  if not found then
    raise exception 'Ask thread not found';
  end if;

  update public.ask_threads
  set case_status = cleaned_status,
      needs_admin_followup = case
        when cleaned_status = 'waiting_on_admin' then true
        when cleaned_status in ('resolved', 'closed') then false
        else needs_admin_followup
      end,
      resolved_by_user_id = case
        when cleaned_status in ('resolved', 'closed')
          and existing_thread.case_status not in ('resolved', 'closed')
          then auth.uid()
        when cleaned_status not in ('resolved', 'closed') then null
        else resolved_by_user_id
      end,
      resolved_at = case
        when cleaned_status in ('resolved', 'closed')
          and existing_thread.case_status not in ('resolved', 'closed')
          then now()
        when cleaned_status not in ('resolved', 'closed') then null
        else resolved_at
      end,
      updated_at = now()
  where id = existing_thread.id
  returning * into updated_thread;

  insert into public.ask_thread_events (
    thread_id,
    event_type,
    old_value,
    new_value,
    actor_user_id,
    note
  )
  values (
    existing_thread.id,
    'case_status_changed',
    jsonb_build_object(
      'case_status', existing_thread.case_status,
      'needs_admin_followup', existing_thread.needs_admin_followup
    ),
    jsonb_build_object(
      'case_status', updated_thread.case_status,
      'needs_admin_followup', updated_thread.needs_admin_followup
    ),
    auth.uid(),
    coalesce(nullif(trim(p_note), ''), 'Status changed without a new message')
  );

  return updated_thread;
end;
$$;

grant execute on function public.set_ask_thread_case_status(uuid, text, text)
  to authenticated;
