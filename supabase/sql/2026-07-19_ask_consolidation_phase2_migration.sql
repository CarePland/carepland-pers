-- Ask Consolidation, Phase 2b: one-shot data migration.
--
-- Requires 2026-07-19_ask_consolidation_phase1.sql and
-- 2026-07-19_ask_consolidation_phase2_schema.sql already applied.
--
-- This moves support_tickets/support_ticket_messages/support_ticket_events
-- and support_assistant_interactions/support_assistant_admin_reviews into
-- the canonical ask_* tables. It is not a bridge: it is a real copy, run
-- once, safe to re-run (already-migrated rows are skipped by checking
-- source_system/source_record_id on the destination row), and it never
-- touches or deletes the old tables' contents -- they stay exactly as they
-- are until the separate, explicit DROP TABLE step at the very end of this
-- whole project, after backup and your final go-ahead.
--
-- Row-by-row failure isolation: each source row is migrated inside its own
-- nested BEGIN/EXCEPTION block. A bad row is skipped and logged to
-- ask_migration_exceptions with the real Postgres error text -- it is never
-- forced through with coerced/guessed values, and it never aborts the rest
-- of the run. Re-running public.run_ask_consolidation_migration() after
-- fixing a flagged row (or the source data) will pick up only what is
-- still missing.
--
-- What is deliberately NOT migrated: support_tickets never spawns an
-- ask_submission on its own -- a ticket is a human conversation with no AI
-- verdict of its own in the old model, and manufacturing one would
-- misrepresent what actually happened. support_assistant_analysis_runs is
-- left as frozen historical data (see the Phase 2 report for why); it is
-- not copied into ask_analysis_runs.
--
-- Rollback: this script only ever inserts new ask_* rows and sets the new
-- ask_thread_id/ask_submission_id pointer columns on the old tables. To
-- undo before the old tables are dropped:
--   delete from public.ask_submission_reviews where source_system = 'legacy_support_assistant';
--   delete from public.ask_submissions where source_system = 'legacy_support_assistant';
--   delete from public.ask_messages where source_system in ('legacy_support_ticket', 'legacy_support_assistant');
--   delete from public.ask_thread_events where thread_id in (select id from public.ask_threads where source_system in ('legacy_support_ticket', 'legacy_support_assistant'));
--   delete from public.ask_threads where source_system in ('legacy_support_ticket', 'legacy_support_assistant');
--   update public.support_tickets set ask_thread_id = null;
--   update public.support_assistant_interactions set ask_thread_id = null, ask_submission_id = null;
--   truncate public.ask_migration_exceptions;

-- =========================================================================
-- Exception log. Scaffolding for this migration window only -- drop this
-- table alongside the old tables at the final cleanup step, not kept
-- indefinitely.
-- =========================================================================

create table if not exists public.ask_migration_exceptions (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id uuid not null,
  error_message text not null,
  attempted_at timestamptz not null default now()
);

alter table public.ask_migration_exceptions enable row level security;

grant select on public.ask_migration_exceptions to authenticated;

drop policy if exists "Admins can read ask migration exceptions" on public.ask_migration_exceptions;
create policy "Admins can read ask migration exceptions"
  on public.ask_migration_exceptions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

-- =========================================================================
-- Migration function. Admin-only. Returns a summary row set; the exception
-- table has the per-row detail for anything skipped.
-- =========================================================================

create or replace function public.run_ask_consolidation_migration()
returns table (metric text, metric_count bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_row record;
  message_row record;
  event_row record;
  interaction_row record;
  review_row record;
  new_thread_id uuid;
  new_submission_id uuid;
  wrapping_thread_id uuid;
  case_status_value text;
  needs_followup_value boolean;
  unread_value boolean;
  migrated_tickets integer := 0;
  skipped_tickets integer := 0;
  migrated_ticket_messages integer := 0;
  migrated_ticket_events integer := 0;
  migrated_interactions integer := 0;
  skipped_interactions integer := 0;
  migrated_reviews integer := 0;
  skipped_reviews integer := 0;
  exception_total integer := 0;
begin
  perform public.assert_current_user_is_admin();

  -- -----------------------------------------------------------------
  -- Part A: support_tickets -> ask_threads (+ messages, + events).
  --
  -- Explicit status mapping (legacy support_tickets.status ->
  -- case_status / needs_admin_followup):
  --   closed          -> closed,          needs_admin_followup = false
  --   resolved        -> resolved,        needs_admin_followup = false
  --   waiting_on_user -> waiting_on_user, needs_admin_followup = false
  --   in_progress     -> waiting_on_admin, needs_admin_followup = true
  --   open            -> waiting_on_admin, needs_admin_followup = true
  -- user_has_unread_update, resolved_at, and resolved_by_user_id are
  -- carried forward exactly from the old row rather than guessed --
  -- the old model already tracked these accurately.
  -- -----------------------------------------------------------------
  for ticket_row in
    select st.*
    from public.support_tickets st
    where not exists (
      select 1 from public.ask_threads t
      where t.source_system = 'legacy_support_ticket'
        and t.source_record_id = st.id
    )
    order by st.created_at asc
  loop
    begin
      case ticket_row.status
        when 'closed' then
          case_status_value := 'closed';
          needs_followup_value := false;
        when 'resolved' then
          case_status_value := 'resolved';
          needs_followup_value := false;
        when 'waiting_on_user' then
          case_status_value := 'waiting_on_user';
          needs_followup_value := false;
        when 'in_progress' then
          case_status_value := 'waiting_on_admin';
          needs_followup_value := true;
        when 'open' then
          case_status_value := 'waiting_on_admin';
          needs_followup_value := true;
        else
          raise exception 'Unrecognized legacy support_ticket status: %', ticket_row.status;
      end case;

      unread_value := coalesce(ticket_row.user_has_unread_update, false);

      insert into public.ask_threads (
        user_id, care_circle_id, status, source, current_page, context,
        case_status, needs_admin_followup, user_has_unread_update,
        latest_user_message_at, latest_admin_message_at,
        resolved_by_user_id, resolved_at,
        source_system, source_record_id, created_at, updated_at
      )
      values (
        ticket_row.user_id, ticket_row.care_circle_id,
        case when case_status_value in ('resolved', 'closed') then 'closed' else 'needs_review' end,
        ticket_row.source, ticket_row.current_page, ticket_row.context,
        case_status_value, needs_followup_value, unread_value,
        ticket_row.latest_user_message_at, ticket_row.latest_admin_message_at,
        ticket_row.resolved_by_user_id, ticket_row.resolved_at,
        'legacy_support_ticket', ticket_row.id, ticket_row.created_at, ticket_row.updated_at
      )
      returning id into new_thread_id;

      update public.support_tickets
      set ask_thread_id = new_thread_id
      where id = ticket_row.id;

      for message_row in
        select * from public.support_ticket_messages
        where ticket_id = ticket_row.id
        order by created_at asc
      loop
        insert into public.ask_messages (
          thread_id, author_user_id, author_role, message_body, is_internal,
          notification_channel, notification_status,
          source_system, source_record_id, created_at
        )
        values (
          new_thread_id, message_row.author_user_id, message_row.author_role,
          message_row.message_body, message_row.is_internal,
          'email', message_row.email_notification_status,
          'legacy_support_ticket', message_row.id, message_row.created_at
        );
        migrated_ticket_messages := migrated_ticket_messages + 1;
      end loop;

      for event_row in
        select * from public.support_ticket_events
        where ticket_id = ticket_row.id
        order by created_at asc
      loop
        insert into public.ask_thread_events (
          thread_id, event_type, old_value, new_value, actor_user_id, note, created_at
        )
        values (
          new_thread_id, event_row.event_type, event_row.old_value, event_row.new_value,
          event_row.actor_user_id, event_row.note, event_row.created_at
        );
        migrated_ticket_events := migrated_ticket_events + 1;
      end loop;

      migrated_tickets := migrated_tickets + 1;
    exception when others then
      skipped_tickets := skipped_tickets + 1;
      exception_total := exception_total + 1;
      -- Logging the exception is itself wrapped: if this insert somehow
      -- failed too, it must degrade to a warning rather than propagate and
      -- abort the whole migration run (undoing every row already migrated
      -- in earlier loop iterations, which would otherwise all roll back
      -- together with it).
      begin
        insert into public.ask_migration_exceptions (source_table, source_id, error_message)
        values ('support_tickets', ticket_row.id, sqlerrm);
      exception when others then
        raise warning 'Failed to log migration exception for support_tickets %: %', ticket_row.id, sqlerrm;
      end;
    end;
  end loop;

  -- -----------------------------------------------------------------
  -- Part B: support_assistant_interactions -> ask_submissions.
  --
  -- Never creates a submission for a ticket (see file header). If the
  -- interaction was already linked to a ticket (ticket_id is not null),
  -- it attaches to that ticket's already-migrated thread rather than
  -- creating a second, duplicate thread. Only a pure, never-escalated
  -- interaction gets its own minimal wrapping thread, built from exactly
  -- two messages (the question, the answer) so the unified UI renders it
  -- like any other Ask conversation instead of a special-cased legacy
  -- view.
  --
  -- Explicit outcome mapping for that wrapping thread's case_status
  -- (only used when there is no linked ticket):
  --   answered / helpful -> closed,          needs_admin_followup = false
  --   not_helpful        -> waiting_on_admin, needs_admin_followup = true
  --   escalated          -> waiting_on_admin, needs_admin_followup = true
  -- (escalated interactions almost always have a ticket_id in practice;
  -- one that does not is exactly the kind of thing that should surface,
  -- not disappear.) user_has_unread_update is always false for these --
  -- nothing is newly "unread" about a historical AI answer today.
  -- -----------------------------------------------------------------
  for interaction_row in
    select sai.*
    from public.support_assistant_interactions sai
    where not exists (
      select 1 from public.ask_submissions s
      where s.source_system = 'legacy_support_assistant'
        and s.source_record_id = sai.id
    )
    order by sai.created_at asc
  loop
    begin
      wrapping_thread_id := null;

      if interaction_row.ticket_id is not null then
        select ask_thread_id into wrapping_thread_id
        from public.support_tickets
        where id = interaction_row.ticket_id;

        if wrapping_thread_id is null then
          raise exception 'Linked support ticket % has not been migrated yet', interaction_row.ticket_id;
        end if;
      end if;

      if wrapping_thread_id is null then
        case interaction_row.outcome
          when 'answered' then
            case_status_value := 'closed';
            needs_followup_value := false;
          when 'helpful' then
            case_status_value := 'closed';
            needs_followup_value := false;
          when 'not_helpful' then
            case_status_value := 'waiting_on_admin';
            needs_followup_value := true;
          when 'escalated' then
            case_status_value := 'waiting_on_admin';
            needs_followup_value := true;
          else
            raise exception 'Unrecognized legacy support_assistant outcome: %', interaction_row.outcome;
        end case;

        insert into public.ask_threads (
          user_id, care_circle_id, status, source, current_page, context,
          case_status, needs_admin_followup, user_has_unread_update,
          resolved_at,
          source_system, source_record_id, created_at, updated_at
        )
        values (
          interaction_row.user_id, interaction_row.care_circle_id, 'closed', 'in_app_ask',
          interaction_row.current_page, coalesce(interaction_row.context, '{}'::jsonb),
          case_status_value, needs_followup_value, false,
          case when case_status_value = 'closed' then coalesce(interaction_row.updated_at, interaction_row.created_at) else null end,
          'legacy_support_assistant', interaction_row.id, interaction_row.created_at, interaction_row.updated_at
        )
        returning id into wrapping_thread_id;

        insert into public.ask_messages (
          thread_id, author_user_id, author_role, message_body,
          source_system, source_record_id, created_at
        )
        values (
          wrapping_thread_id, interaction_row.user_id, 'user', interaction_row.question_body,
          'legacy_support_assistant', interaction_row.id, interaction_row.created_at
        );

        insert into public.ask_messages (
          thread_id, author_role, message_body,
          source_system, source_record_id, created_at
        )
        values (
          wrapping_thread_id, 'assistant', interaction_row.assistant_answer,
          'legacy_support_assistant', interaction_row.id, interaction_row.created_at
        );
      end if;

      insert into public.ask_submissions (
        thread_id, user_id, care_circle_id, current_page, context,
        router_category, router_confidence, router_rationale, routing_state,
        recommended_actions, safety_flags, source,
        transcript, original_user_wording,
        model, prompt_version, instruction_version_id, raw_response,
        outcome, user_feedback, user_feedback_at,
        source_system, source_record_id, created_at, updated_at
      )
      values (
        wrapping_thread_id, interaction_row.user_id, interaction_row.care_circle_id,
        interaction_row.current_page, coalesce(interaction_row.context, '{}'::jsonb),
        'support_question', interaction_row.confidence, interaction_row.escalation_reason,
        case when interaction_row.escalation_recommended then 'needs_review' else 'closed' end,
        '[]'::jsonb, '{}'::jsonb, 'in_app_ask',
        interaction_row.question_body || E'\n\n' || interaction_row.assistant_answer,
        interaction_row.question_body,
        interaction_row.model, interaction_row.prompt_version, interaction_row.instruction_version_id,
        interaction_row.raw_response,
        interaction_row.outcome, interaction_row.user_feedback,
        case when interaction_row.user_feedback is not null then interaction_row.updated_at else null end,
        'legacy_support_assistant', interaction_row.id, interaction_row.created_at, interaction_row.updated_at
      )
      returning id into new_submission_id;

      update public.support_assistant_interactions
      set ask_thread_id = wrapping_thread_id,
          ask_submission_id = new_submission_id
      where id = interaction_row.id;

      migrated_interactions := migrated_interactions + 1;
    exception when others then
      skipped_interactions := skipped_interactions + 1;
      exception_total := exception_total + 1;
      begin
        insert into public.ask_migration_exceptions (source_table, source_id, error_message)
        values ('support_assistant_interactions', interaction_row.id, sqlerrm);
      exception when others then
        raise warning 'Failed to log migration exception for support_assistant_interactions %: %', interaction_row.id, sqlerrm;
      end;
    end;
  end loop;

  -- -----------------------------------------------------------------
  -- Part C: support_assistant_admin_reviews -> ask_submission_reviews.
  -- Depends on Part B having already migrated the interaction the review
  -- belongs to (idempotent re-runs will pick these up once that is true).
  -- -----------------------------------------------------------------
  for review_row in
    select r.*
    from public.support_assistant_admin_reviews r
    where not exists (
      select 1 from public.ask_submission_reviews asr
      where asr.source_system = 'legacy_support_assistant'
        and asr.source_record_id = r.id
    )
    order by r.created_at asc
  loop
    begin
      select ask_submission_id into new_submission_id
      from public.support_assistant_interactions
      where id = review_row.interaction_id;

      if new_submission_id is null then
        raise exception 'No migrated Ask submission found yet for interaction %', review_row.interaction_id;
      end if;

      insert into public.ask_submission_reviews (
        ask_submission_id, reviewer_user_id, review_status, admin_note,
        recommended_action, source_system, source_record_id, created_at
      )
      values (
        new_submission_id, review_row.reviewer_user_id, review_row.review_status,
        review_row.admin_note, review_row.recommended_action,
        'legacy_support_assistant', review_row.id, review_row.created_at
      );

      migrated_reviews := migrated_reviews + 1;
    exception when others then
      skipped_reviews := skipped_reviews + 1;
      exception_total := exception_total + 1;
      begin
        insert into public.ask_migration_exceptions (source_table, source_id, error_message)
        values ('support_assistant_admin_reviews', review_row.id, sqlerrm);
      exception when others then
        raise warning 'Failed to log migration exception for support_assistant_admin_reviews %: %', review_row.id, sqlerrm;
      end;
    end;
  end loop;

  return query
    select 'migrated_tickets'::text, migrated_tickets::bigint
    union all select 'skipped_tickets', skipped_tickets::bigint
    union all select 'migrated_ticket_messages', migrated_ticket_messages::bigint
    union all select 'migrated_ticket_events', migrated_ticket_events::bigint
    union all select 'migrated_interactions', migrated_interactions::bigint
    union all select 'skipped_interactions', skipped_interactions::bigint
    union all select 'migrated_reviews', migrated_reviews::bigint
    union all select 'skipped_reviews', skipped_reviews::bigint
    union all select 'total_exceptions', exception_total::bigint;
end;
$$;

grant execute on function public.run_ask_consolidation_migration() to authenticated;

-- =========================================================================
-- Run it:
--   select * from public.run_ask_consolidation_migration();
--   select * from public.ask_migration_exceptions order by attempted_at desc;
--
-- Re-runnable: rows already migrated (matched by source_system +
-- source_record_id) are skipped automatically, so re-running after fixing
-- a flagged row only processes what is still missing.
-- =========================================================================

-- =========================================================================
-- Row-count reconciliation. Run after the migration function. Every row
-- here should read zero, or be fully explained by
-- ask_migration_exceptions.
-- =========================================================================

-- Tickets: old count vs. migrated count vs. exceptions should sum evenly.
select
  (select count(*) from public.support_tickets) as legacy_ticket_count,
  (select count(*) from public.ask_threads where source_system = 'legacy_support_ticket') as migrated_thread_count,
  (select count(*) from public.ask_migration_exceptions where source_table = 'support_tickets') as ticket_exception_count;

select
  (select count(*) from public.support_ticket_messages) as legacy_ticket_message_count,
  (select count(*) from public.ask_messages where source_system = 'legacy_support_ticket') as migrated_ticket_message_count;

select
  (select count(*) from public.support_ticket_events) as legacy_ticket_event_count,
  (select count(*) from public.ask_thread_events e
     join public.ask_threads t on t.id = e.thread_id
     where t.source_system = 'legacy_support_ticket') as migrated_ticket_event_count;

-- Interactions: every legacy row should be migrated or excepted; no
-- interaction should be missing its ask_thread_id/ask_submission_id
-- pointer after a clean run.
select
  (select count(*) from public.support_assistant_interactions) as legacy_interaction_count,
  (select count(*) from public.ask_submissions where source_system = 'legacy_support_assistant') as migrated_submission_count,
  (select count(*) from public.ask_migration_exceptions where source_table = 'support_assistant_interactions') as interaction_exception_count,
  (select count(*) from public.support_assistant_interactions where ask_submission_id is null) as interactions_missing_pointer;

select
  (select count(*) from public.support_assistant_admin_reviews) as legacy_review_count,
  (select count(*) from public.ask_submission_reviews where source_system = 'legacy_support_assistant') as migrated_review_count,
  (select count(*) from public.ask_migration_exceptions where source_table = 'support_assistant_admin_reviews') as review_exception_count;

-- Spot-check sample: five migrated threads with their message counts,
-- for manual comparison against the source ticket in the app/admin UI.
select
  t.id as ask_thread_id,
  t.source_record_id as legacy_ticket_id,
  t.case_status,
  t.needs_admin_followup,
  t.user_has_unread_update,
  (select count(*) from public.ask_messages m where m.thread_id = t.id) as message_count
from public.ask_threads t
where t.source_system = 'legacy_support_ticket'
order by t.created_at desc
limit 5;
