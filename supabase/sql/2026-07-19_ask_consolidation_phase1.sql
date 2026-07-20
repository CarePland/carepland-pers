-- Ask Consolidation, Phase 1: additive schema only.
--
-- Revision note (2026-07-19): this file originally also stood up permanent
-- coexistence machinery (a union view over both review tables, a permanent
-- widening of support_assistant_analysis_runs, and an idempotent
-- attempt-logging table for incremental bridge population). Andrew's
-- direction is a real merge on a brief controlled migration window, not
-- indefinite dual-system coexistence, so that machinery has been removed
-- from this file -- see the note in section 6 below for the reasoning.
-- Nothing here was ever applied to a live database, so this was a plain
-- edit, not a rollback.
--
-- Context: support_tickets/support_assistant_interactions and
-- ask_threads/ask_messages/ask_submissions are two parallel systems solving
-- the same underlying problem (a user question, an AI attempt at it, and
-- sometimes a human follow-up). 2026-05-25_ask_foundation.sql already added
-- unused bridge columns (support_tickets.ask_submission_id,
-- support_assistant_interactions.ask_thread_id/ask_submission_id) showing
-- this convergence was the intent from the start. This migration ports the
-- proven support_ticket conversation-state model onto
-- ask_threads/ask_messages as a second, independent axis alongside Ask's
-- existing AI-pipeline state, and generalizes support-assistant's
-- append-only review pattern to also cover Ask. Phase 2 performs the actual
-- data migration and cutover; this file only prepares the canonical schema
-- it will migrate into.
--
-- Phase 1 explicitly does NOT: touch any existing route, UI, table
-- contents, write path, or grant/permission that is already in use. Nothing
-- is renamed, dropped, or rewritten. Every new column is additive; where a
-- new column needs an initial value for existing rows, that value is
-- computed once from existing data (documented inline below) and is never
-- destructive.
--
-- Rollback: every object created here can be dropped independently without
-- touching any pre-existing table, function, or policy:
--   drop function if exists public.create_ask_submission_review(uuid, text, text, text);
--   drop table if exists public.ask_submission_reviews;
--   drop function if exists public.update_ask_message_notification_status(uuid, text, text);
--   drop function if exists public.mark_ask_thread_seen(uuid);
--   drop function if exists public.update_ask_thread_case_status(uuid, text, boolean, text);
--   drop function if exists public.add_ask_message_with_case_transition(uuid, text, text, boolean, text, boolean, jsonb, text);
--   drop table if exists public.ask_thread_events;
--   drop index if exists public.support_assistant_interactions_ask_thread_idx;
--   drop index if exists public.support_assistant_interactions_ask_submission_idx;
--   alter table public.ask_messages drop column if exists is_internal, drop column if exists notification_channel, drop column if exists notification_status;
--   alter table public.ask_threads drop column if exists case_status, drop column if exists needs_admin_followup, drop column if exists user_has_unread_update, drop column if exists latest_user_message_at, drop column if exists latest_admin_message_at, drop column if exists latest_assistant_message_at, drop column if exists resolved_by_user_id, drop column if exists resolved_at, drop column if exists processing_stage;
-- Dropping ask_threads.processing_stage and ask_messages/ask_threads new
-- columns is safe at any point in Phase 1 since nothing reads them yet.
-- Once Phase 2 route code starts writing/reading them, treat these as
-- normal columns for rollback purposes (a real down-migration, not a bare
-- drop).

-- =========================================================================
-- 1. ask_threads: add case_status as a second, independent axis alongside
--    the existing `status` column (which is Ask's AI-pipeline stage).
-- =========================================================================

-- `processing_stage` is a read-only mirror of the existing `status` column.
-- It exists so the codebase can start referring to the AI-pipeline axis by
-- its correct name without any risk of the two drifting apart, and without
-- touching the existing `status` column that ask/route.ts already reads and
-- writes directly. When Phase 2/3 code is ready to treat this as the
-- authoritative column, converting it from generated to a normal column is
-- a small, explicit follow-up migration -- not implied by this one.
alter table public.ask_threads
  add column if not exists processing_stage text
    generated always as (status) stored;

-- Human-conversation state, ported from support_tickets. `case_status` is
-- deliberately explicit rather than reusing "in_progress": waiting_on_user
-- and waiting_on_admin say whose turn it is, which is the thing the old
-- ambiguous status could never answer on its own.
alter table public.ask_threads
  add column if not exists case_status text,
  add column if not exists needs_admin_followup boolean,
  add column if not exists user_has_unread_update boolean not null default false,
  add column if not exists latest_user_message_at timestamptz,
  add column if not exists latest_admin_message_at timestamptz,
  -- Ask has an `assistant` author_role that support_tickets never had to
  -- model. Tracking it separately from latest_admin_message_at lets a
  -- future admin queue distinguish "the AI answered five minutes ago" from
  -- "no human has looked at this in three days" -- a real distinction the
  -- old ticket model never needed to make.
  add column if not exists latest_assistant_message_at timestamptz,
  add column if not exists resolved_by_user_id uuid references auth.users(id),
  add column if not exists resolved_at timestamptz;

-- One-time backfill for existing rows, computed from data that already
-- exists -- not destructive, nothing is overwritten that had a prior value.
-- case_status: infer a reasonable starting point from the existing
-- pipeline-stage `status` column. This is a best-effort mapping, not a
-- reconstruction of true historical conversation state (that would require
-- inspecting each thread's message history in ways this migration
-- deliberately keeps simple and reviewable).
update public.ask_threads
set case_status = case
  when status = 'closed' then 'closed'
  when status = 'needs_review' then 'waiting_on_admin'
  else 'open'
end
where case_status is null;

update public.ask_threads
set needs_admin_followup = (case_status not in ('resolved', 'closed'))
where needs_admin_followup is null;

-- Backfill latest_*_message_at from existing ask_messages history (a
-- read-only aggregate, safe).
update public.ask_threads t
set latest_user_message_at = m.max_created_at
from (
  select thread_id, max(created_at) as max_created_at
  from public.ask_messages
  where author_role = 'user'
  group by thread_id
) m
where m.thread_id = t.id
  and t.latest_user_message_at is null;

update public.ask_threads t
set latest_admin_message_at = m.max_created_at
from (
  select thread_id, max(created_at) as max_created_at
  from public.ask_messages
  where author_role = 'admin'
  group by thread_id
) m
where m.thread_id = t.id
  and t.latest_admin_message_at is null;

update public.ask_threads t
set latest_assistant_message_at = m.max_created_at
from (
  select thread_id, max(created_at) as max_created_at
  from public.ask_messages
  where author_role = 'assistant'
  group by thread_id
) m
where m.thread_id = t.id
  and t.latest_assistant_message_at is null;

-- user_has_unread_update: no reliable way to reconstruct "has this user
-- actually seen the latest update" for historical rows, so the safe,
-- conservative default is false (never falsely alert a user to something
-- old as if it were new).

alter table public.ask_threads
  alter column case_status set not null,
  alter column case_status set default 'open',
  alter column needs_admin_followup set not null,
  alter column needs_admin_followup set default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ask_threads_case_status_check'
  ) then
    alter table public.ask_threads
      add constraint ask_threads_case_status_check
      check (case_status in ('open', 'waiting_on_user', 'waiting_on_admin', 'resolved', 'closed'));
  end if;
end $$;

create index if not exists ask_threads_case_status_followup_idx
  on public.ask_threads (needs_admin_followup, case_status, updated_at desc);

create index if not exists ask_threads_user_case_status_idx
  on public.ask_threads (user_id, case_status, updated_at desc);

-- Partial index for the unread queue -- selective by design, only indexes
-- the rows that actually matter for "does this user have something new".
create index if not exists ask_threads_unread_idx
  on public.ask_threads (user_id)
  where user_has_unread_update = true;

-- =========================================================================
-- 2. ask_messages: private admin notes + a generalized notification model
--    (not coupled to email specifically).
-- =========================================================================

alter table public.ask_messages
  add column if not exists is_internal boolean not null default false,
  add column if not exists notification_channel text not null default 'email'
    check (notification_channel in ('email', 'sms', 'push', 'in_app')),
  add column if not exists notification_status text not null default 'not_queued'
    check (notification_status in ('not_queued', 'queued', 'sent', 'failed'));

-- Defense in depth: today ask_messages grants direct INSERT to
-- authenticated users (unlike support_ticket_messages, which only grants
-- SELECT and requires the add_support_ticket_message() RPC for writes --
-- see the naming/compatibility notes in the implementation report). This
-- constraint at least prevents a non-admin-authored row from being marked
-- internal, regardless of write path.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ask_messages_internal_admin_only_check'
  ) then
    alter table public.ask_messages
      add constraint ask_messages_internal_admin_only_check
      check (is_internal = false or author_role = 'admin');
  end if;
end $$;

-- =========================================================================
-- 3. ask_thread_events: generic append-only audit trail, mirroring
--    support_ticket_events. Admin-only read, matching the existing
--    ticket-events visibility precedent exactly.
-- =========================================================================

create table if not exists public.ask_thread_events (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ask_threads(id) on delete cascade,
  event_type text not null,
  old_value jsonb,
  new_value jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists ask_thread_events_thread_created_idx
  on public.ask_thread_events (thread_id, created_at desc);

alter table public.ask_thread_events enable row level security;

grant select on public.ask_thread_events to authenticated;

drop policy if exists "Admins can read ask thread events" on public.ask_thread_events;
create policy "Admins can read ask thread events"
  on public.ask_thread_events
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
-- 4. Transactional transition functions, porting support_ticket_messages'
--    proven add_support_ticket_message() behavior onto ask_threads /
--    ask_messages. These are new functions; nothing about the existing
--    direct-insert write path used by ask/route.ts today is changed or
--    removed. Wiring the route to call these instead of raw inserts is
--    Phase 2 work.
-- =========================================================================

create or replace function public.add_ask_message_with_case_transition(
  p_thread_id uuid,
  p_message_body text,
  p_author_role text,
  p_is_internal boolean default false,
  p_notification_channel text default 'email',
  p_needs_admin_followup boolean default null,
  p_metadata jsonb default '{}'::jsonb,
  -- Added while wiring Phase 2's ask/route.ts cutover: the AI pipeline runs
  -- under the requesting user's own token (never admin), but needs to set
  -- an authoritative terminal case_status (e.g. "resolved" for a confident
  -- answer_now, "waiting_on_admin" for anything routed for human review) at
  -- the moment it posts its own reply. update_ask_thread_case_status() is
  -- deliberately admin-only (a human overriding a case), so it is the wrong
  -- tool for the AI pipeline's own automated verdict. This optional
  -- override lets the message's own author set case_status directly,
  -- through the same ownership check as everything else in this function,
  -- instead of inferring it from author_role alone. Trailing + optional +
  -- Supabase's named-parameter RPC calling convention means this is
  -- backward compatible with every existing call site.
  p_case_status_override text default null
)
returns public.ask_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_thread public.ask_threads%rowtype;
  caller_is_admin boolean;
  new_message public.ask_messages%rowtype;
  old_case_status text;
  old_needs_admin_followup boolean;
  new_case_status text;
  new_needs_admin_followup boolean;
begin
  if p_case_status_override is not null
    and p_case_status_override not in ('open', 'waiting_on_user', 'waiting_on_admin', 'resolved', 'closed')
  then
    raise exception 'Unsupported Ask case status override: %', p_case_status_override;
  end if;

  -- SECURITY: the override exists for the AI pipeline's and admins' own
  -- authoritative verdicts, not for a user to declare their own case's
  -- outcome. This function is granted to every authenticated user (Ask's
  -- pipeline runs under the caller's own token, not a service role -- see
  -- the comment on the p_case_status_override parameter), so without this
  -- check any signed-in user could call this RPC directly with
  -- p_author_role='user' and an override to self-resolve or hide their own
  -- case from the admin queue. A 'user'-authored message may never carry
  -- an override; it always goes through the normal role-based inference
  -- below. An 'assistant'-authored override (the untrusted-in-practice AI
  -- pipeline path) is further restricted to exactly the two values Ask's
  -- own routing logic produces -- 'resolved' for a confident answer,
  -- 'waiting_on_admin' for anything routed for review -- so even a forged
  -- assistant message cannot reach 'open', 'waiting_on_user', or 'closed'
  -- (all of which either belong to a real human/user transition or to an
  -- admin's own deliberate action).
  if p_case_status_override is not null and p_author_role = 'user' then
    raise exception 'A user-authored Ask message cannot override case status';
  end if;

  if p_case_status_override is not null
    and p_author_role = 'assistant'
    and p_case_status_override not in ('resolved', 'waiting_on_admin')
  then
    raise exception 'Ask case status override % is not permitted for an assistant-authored message', p_case_status_override;
  end if;

  if auth.uid() is null then
    raise exception 'Must be signed in to add an Ask message';
  end if;

  if nullif(trim(p_message_body), '') is null then
    raise exception 'Message text is required';
  end if;

  if p_author_role not in ('user', 'assistant', 'system', 'admin') then
    raise exception 'Unsupported Ask message author role: %', p_author_role;
  end if;

  select coalesce(p.is_admin, false)
    into caller_is_admin
  from public.profiles p
  where p.id = auth.uid();

  select *
    into existing_thread
  from public.ask_threads
  where id = p_thread_id
  for update;

  if not found then
    raise exception 'Ask thread not found';
  end if;

  if existing_thread.user_id <> auth.uid() and coalesce(caller_is_admin, false) = false then
    raise exception 'You do not have access to this Ask thread';
  end if;

  -- Only admins may author admin/system messages. Any authenticated caller
  -- who owns the thread may author user/assistant messages -- Ask's current
  -- architecture has the route insert the AI's own reply using the calling
  -- user's own token (not a service-role identity), so this function cannot
  -- distinguish "the trusted route inserted this after a real OpenAI call"
  -- from "the client inserted it directly." That is a pre-existing
  -- limitation of Ask's write path, not something introduced here -- see
  -- the implementation report for the recommended Phase 2/3 hardening.
  if p_author_role in ('admin', 'system') and coalesce(caller_is_admin, false) = false then
    raise exception 'Admin access is required to author this type of Ask message';
  end if;

  if coalesce(p_is_internal, false) = true and p_author_role <> 'admin' then
    raise exception 'Only admin messages can be marked internal';
  end if;

  insert into public.ask_messages (
    thread_id,
    author_user_id,
    author_role,
    message_body,
    is_internal,
    notification_channel,
    metadata
  )
  values (
    existing_thread.id,
    auth.uid(),
    p_author_role,
    trim(p_message_body),
    coalesce(p_is_internal, false),
    coalesce(nullif(trim(coalesce(p_notification_channel, '')), ''), 'email'),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into new_message;

  old_case_status := existing_thread.case_status;
  old_needs_admin_followup := existing_thread.needs_admin_followup;
  new_case_status := existing_thread.case_status;
  new_needs_admin_followup := existing_thread.needs_admin_followup;

  if coalesce(p_is_internal, false) = false and p_case_status_override is not null then
    -- Explicit override from the message's own author (see comment on the
    -- parameter above) -- skip the generic role-based inference below.
    new_case_status := p_case_status_override;
    new_needs_admin_followup := case
      -- Force consistency for the assistant path rather than trusting
      -- whatever p_needs_admin_followup the caller passed: a
      -- 'waiting_on_admin' override must always need follow-up, a
      -- 'resolved' override never does. This closes the "queue-visible but
      -- flagged as not needing attention" (or the reverse) combination
      -- even from a forged call, without relying on the caller to get it
      -- right.
      when p_author_role = 'assistant' and p_case_status_override = 'waiting_on_admin' then true
      when p_author_role = 'assistant' and p_case_status_override = 'resolved' then false
      else coalesce(p_needs_admin_followup, new_needs_admin_followup)
    end;
  elsif coalesce(p_is_internal, false) = false then
    if p_author_role = 'user' then
      -- A user message always means the case now needs a response --
      -- there is no case_status a user message should leave unchanged.
      -- (This used to omit 'open', a fresh thread's default value, which
      -- left a thread's very first message stuck showing case_status =
      -- 'open' instead of moving to waiting_on_admin.)
      new_case_status := 'waiting_on_admin';
      new_needs_admin_followup := true;
    elsif p_author_role in ('admin', 'assistant') then
      new_case_status := case
        when existing_thread.case_status in ('open', 'waiting_on_admin')
          then 'waiting_on_user'
        else existing_thread.case_status
      end;
      new_needs_admin_followup := coalesce(p_needs_admin_followup, false);
    end if;
    -- p_author_role = 'system': informational only, no case_status change.
  end if;

  update public.ask_threads
  set case_status = new_case_status,
      needs_admin_followup = case
        when coalesce(p_is_internal, false) then needs_admin_followup
        else new_needs_admin_followup
      end,
      user_has_unread_update = case
        when coalesce(p_is_internal, false) then user_has_unread_update
        when p_author_role in ('admin', 'assistant') then true
        when p_author_role = 'user' then false
        else user_has_unread_update
      end,
      latest_user_message_at = case
        when p_author_role = 'user' then now()
        else latest_user_message_at
      end,
      latest_admin_message_at = case
        when p_author_role = 'admin' and coalesce(p_is_internal, false) = false then now()
        else latest_admin_message_at
      end,
      latest_assistant_message_at = case
        when p_author_role = 'assistant' then now()
        else latest_assistant_message_at
      end,
      resolved_by_user_id = case
        when p_author_role = 'user' and coalesce(p_is_internal, false) = false then null
        -- Only an admin's own override attributes resolution to a person;
        -- an assistant-driven (AI) resolution sets resolved_at below but
        -- deliberately leaves resolved_by_user_id null -- attributing an
        -- automated close to the human who merely asked the question would
        -- misrepresent who (or what) actually resolved it.
        when p_case_status_override in ('resolved', 'closed')
          and existing_thread.case_status not in ('resolved', 'closed')
          and p_author_role = 'admin'
          then auth.uid()
        else resolved_by_user_id
      end,
      resolved_at = case
        when p_author_role = 'user' and coalesce(p_is_internal, false) = false then null
        when new_case_status in ('resolved', 'closed')
          and existing_thread.case_status not in ('resolved', 'closed')
          then now()
        else resolved_at
      end,
      updated_at = now()
  where id = existing_thread.id;

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
    case when coalesce(p_is_internal, false) then 'internal_note_added' else 'message_added' end,
    jsonb_build_object('case_status', old_case_status, 'needs_admin_followup', old_needs_admin_followup),
    jsonb_build_object(
      'case_status', new_case_status,
      'needs_admin_followup', new_needs_admin_followup,
      'message_id', new_message.id,
      'author_role', new_message.author_role
    ),
    auth.uid(),
    case when coalesce(p_is_internal, false) then 'Internal note added' else 'Ask message added' end
  );

  return new_message;
end;
$$;

grant execute on function public.add_ask_message_with_case_transition(uuid, text, text, boolean, text, boolean, jsonb, text)
  to authenticated;

create or replace function public.update_ask_thread_case_status(
  p_thread_id uuid,
  p_case_status text,
  p_needs_admin_followup boolean default null,
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

  select *
    into existing_thread
  from public.ask_threads
  where id = p_thread_id
  for update;

  if not found then
    raise exception 'Ask thread not found';
  end if;

  cleaned_status := coalesce(nullif(trim(p_case_status), ''), existing_thread.case_status);

  if cleaned_status not in ('open', 'waiting_on_user', 'waiting_on_admin', 'resolved', 'closed') then
    raise exception 'Unsupported Ask case status: %', cleaned_status;
  end if;

  update public.ask_threads
  set case_status = cleaned_status,
      needs_admin_followup = coalesce(p_needs_admin_followup, needs_admin_followup),
      resolved_by_user_id = case when cleaned_status in ('resolved', 'closed') then auth.uid() else null end,
      resolved_at = case when cleaned_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end,
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
    'case_status_updated',
    jsonb_build_object('case_status', existing_thread.case_status, 'needs_admin_followup', existing_thread.needs_admin_followup),
    jsonb_build_object('case_status', updated_thread.case_status, 'needs_admin_followup', updated_thread.needs_admin_followup),
    auth.uid(),
    nullif(trim(coalesce(p_note, '')), '')
  );

  return updated_thread;
end;
$$;

grant execute on function public.update_ask_thread_case_status(uuid, text, boolean, text)
  to authenticated;

create or replace function public.mark_ask_thread_seen(
  p_thread_id uuid
)
returns public.ask_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_thread public.ask_threads%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;

  update public.ask_threads
  set user_has_unread_update = false,
      updated_at = now()
  where id = p_thread_id
    and user_id = auth.uid()
  returning * into updated_thread;

  if not found then
    raise exception 'Ask thread not found';
  end if;

  insert into public.ask_thread_events (
    thread_id,
    event_type,
    actor_user_id,
    note
  )
  values (
    updated_thread.id,
    'user_viewed_update',
    auth.uid(),
    'User viewed Ask thread update'
  );

  return updated_thread;
end;
$$;

grant execute on function public.mark_ask_thread_seen(uuid)
  to authenticated;

create or replace function public.update_ask_message_notification_status(
  p_message_id uuid,
  p_status text,
  p_channel text default null
)
returns public.ask_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_status text;
  cleaned_channel text;
  updated_message public.ask_messages%rowtype;
begin
  perform public.assert_current_user_is_admin();

  cleaned_status := coalesce(nullif(trim(p_status), ''), 'not_queued');
  if cleaned_status not in ('not_queued', 'queued', 'sent', 'failed') then
    raise exception 'Unsupported Ask message notification status: %', cleaned_status;
  end if;

  update public.ask_messages
  set notification_status = cleaned_status,
      notification_channel = coalesce(
        nullif(trim(coalesce(p_channel, '')), ''),
        notification_channel
      )
  where id = p_message_id
  returning * into updated_message;

  if not found then
    raise exception 'Ask message not found';
  end if;

  cleaned_channel := updated_message.notification_channel;
  if cleaned_channel not in ('email', 'sms', 'push', 'in_app') then
    raise exception 'Unsupported Ask message notification channel: %', cleaned_channel;
  end if;

  return updated_message;
end;
$$;

grant execute on function public.update_ask_message_notification_status(uuid, text, text)
  to authenticated;

-- =========================================================================
-- 5. ask_submission_reviews: generalizes support_assistant_admin_reviews'
--    one-to-many, append-only review-log pattern (never overwritten -- a
--    changed opinion is a new row, so full review history is preserved) to
--    cover ask_submissions. The existing support_assistant_admin_reviews
--    table, its RPC, and its admin UI are untouched.
-- =========================================================================

create table if not exists public.ask_submission_reviews (
  id uuid primary key default gen_random_uuid(),
  ask_submission_id uuid not null references public.ask_submissions(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'good_answer', 'needs_prompt_work', 'needs_ui_work', 'should_escalate', 'not_actionable')),
  admin_note text not null default '',
  recommended_action text,
  created_at timestamptz not null default now()
);

create index if not exists ask_submission_reviews_submission_idx
  on public.ask_submission_reviews (ask_submission_id, created_at desc);

create index if not exists ask_submission_reviews_status_idx
  on public.ask_submission_reviews (review_status, created_at desc);

alter table public.ask_submission_reviews enable row level security;

grant select on public.ask_submission_reviews to authenticated;

drop policy if exists "Admins can read ask submission reviews" on public.ask_submission_reviews;
create policy "Admins can read ask submission reviews"
  on public.ask_submission_reviews
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

create or replace function public.create_ask_submission_review(
  p_ask_submission_id uuid,
  p_review_status text,
  p_admin_note text,
  p_recommended_action text default null
)
returns public.ask_submission_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_status text;
  new_review public.ask_submission_reviews%rowtype;
begin
  perform public.assert_current_user_is_admin();

  if not exists (
    select 1 from public.ask_submissions s where s.id = p_ask_submission_id
  ) then
    raise exception 'Ask submission not found';
  end if;

  cleaned_status := coalesce(nullif(trim(p_review_status), ''), 'needs_review');

  if cleaned_status not in ('needs_review', 'good_answer', 'needs_prompt_work', 'needs_ui_work', 'should_escalate', 'not_actionable') then
    raise exception 'Unsupported Ask submission review status: %', cleaned_status;
  end if;

  insert into public.ask_submission_reviews (
    ask_submission_id,
    reviewer_user_id,
    review_status,
    admin_note,
    recommended_action
  ) values (
    p_ask_submission_id,
    auth.uid(),
    cleaned_status,
    trim(coalesce(p_admin_note, '')),
    nullif(trim(coalesce(p_recommended_action, '')), '')
  )
  returning * into new_review;

  return new_review;
end;
$$;

grant execute on function public.create_ask_submission_review(uuid, text, text, text)
  to authenticated;

-- =========================================================================
-- 6. Bridge lookup indexes. support_tickets.ask_submission_id was already
--    indexed in ask_foundation.sql; the two support_assistant_interactions
--    bridge columns added in that same migration were not. These are kept
--    (unlike the rest of this section -- see note below) because Phase 2's
--    one-time data migration will actually populate them, pointing each
--    legacy row at the canonical Ask row it became, for audit purposes
--    during the migration window and until the old tables are dropped.
-- =========================================================================

create index if not exists support_assistant_interactions_ask_thread_idx
  on public.support_assistant_interactions (ask_thread_id);

create index if not exists support_assistant_interactions_ask_submission_idx
  on public.support_assistant_interactions (ask_submission_id);

-- NOTE ON REVISED SCOPE (2026-07-19): this migration originally also
-- contained (a) a permanent union view over
-- support_assistant_admin_reviews + ask_submission_reviews, (b) a
-- permanent widening of support_assistant_analysis_runs with an
-- ask_submission_ids column, and (c) an ask_bridge_link_events table plus
-- record_ask_bridge_link_attempt() function for logging incremental,
-- retryable bridge-population attempts.
--
-- All three were designed for indefinite coexistence between the old and
-- new systems. That is no longer the goal: Phase 2 performs one real,
-- transactional, verified data migration during a brief controlled window,
-- not an ongoing dual-write bridge. So:
--   (a) is unnecessary once support_assistant_admin_reviews rows are copied
--       into ask_submission_reviews -- ask_submission_reviews alone becomes
--       canonical and complete; ad hoc queries suffice during the migration
--       window instead of a permanent view object.
--   (b) is superseded by a native ask_analysis_runs table in Phase 2
--       (interaction_ids was never a natural fit for Ask submissions; better
--       to migrate the handful of valuable historical runs than carry a
--       dual-shape column on the old table forever).
--   (c) is more machinery than a single controlled migration needs -- an
--       idempotent INSERT ... SELECT ... WHERE NOT EXISTS migration script,
--       verified by row-count and spot-check assertions before the old
--       tables are dropped, does the same job without a permanent
--       attempt-logging table.
-- None of this was ever applied to a live database, so removing it here is
-- a plain edit, not a rollback.
