-- Tests for 2026-07-19_ask_consolidation_phase1.sql.
--
-- Run this against a Supabase SQL editor / staging branch AFTER applying
-- the Phase 1 migration. It creates its own fixture rows (a thread, some
-- messages, a submission, some reviews, a bridge-link attempt) using an
-- existing is_test_user profile and an existing is_admin profile, and rolls
-- everything back at the end regardless of pass/fail -- nothing here is
-- left behind in the database.
--
-- This script authors a `pg_temp` helper to simulate auth.uid() for a
-- chosen user, since these are SECURITY DEFINER functions written against
-- Supabase's auth.uid() (backed by the request.jwt.claim.sub /
-- request.jwt.claims GUCs), and this script runs as a superuser/service
-- role outside of PostgREST's normal request context. If your Supabase
-- project's auth.uid() is implemented differently, adjust
-- pg_temp.set_test_auth_uid() accordingly before relying on this script.
--
-- I was not able to execute this against a live Postgres/Supabase instance
-- in the sandbox this was written in (no local Postgres, no docker, no
-- root) -- this has been carefully hand-verified but not run. Please run it
-- for real before trusting Phase 1's transition logic.

begin;

do $$
begin
  create or replace function pg_temp.set_test_auth_uid(p_user_id uuid) returns void as $inner$
  begin
    perform set_config('request.jwt.claim.sub', p_user_id::text, true);
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
      true
    );
    perform set_config('role', 'authenticated', true);
  end;
  $inner$ language plpgsql;
end $$;

do $$
declare
  test_user_id uuid;
  other_user_id uuid;
  admin_user_id uuid;
  test_care_circle_id uuid;
  thread_id uuid;
  submission_id uuid;
  msg_row public.ask_messages%rowtype;
  thread_row public.ask_threads%rowtype;
  review_count integer;
  failed_as_expected boolean;
begin
  raise notice '--- Ask consolidation Phase 1 tests starting ---';

  -- ------------------------------------------------------------------
  -- Fixture setup
  -- ------------------------------------------------------------------
  select id into test_user_id
  from public.profiles
  where coalesce(is_test_user, false) = true
  order by created_at asc
  limit 1;

  select id into admin_user_id
  from public.profiles
  where coalesce(is_admin, false) = true
  order by created_at asc
  limit 1;

  select id into other_user_id
  from public.profiles
  where coalesce(is_test_user, false) = true
    and id <> test_user_id
  order by created_at asc
  limit 1;

  if test_user_id is null then
    raise exception 'FIXTURE SETUP FAILED: no profile with is_test_user = true exists. Seed one before running these tests.';
  end if;

  if admin_user_id is null then
    raise exception 'FIXTURE SETUP FAILED: no profile with is_admin = true exists. Seed one before running these tests.';
  end if;

  if other_user_id is null then
    -- Not fatal -- the cross-account rejection test just gets skipped with
    -- a notice if there is only one test user in this environment.
    raise notice 'SKIP NOTE: only one is_test_user profile found; cross-account rejection test will be skipped.';
  end if;

  select ccm.care_circle_id into test_care_circle_id
  from public.care_circle_memberships ccm
  where ccm.user_id = test_user_id
    and ccm.status = 'active'
  order by ccm.created_at asc
  limit 1;

  perform pg_temp.set_test_auth_uid(test_user_id);

  insert into public.ask_threads (user_id, care_circle_id, status, source)
  values (test_user_id, test_care_circle_id, 'open', 'in_app_ask')
  returning id into thread_id;

  raise notice 'Fixture thread created: %', thread_id;

  -- ------------------------------------------------------------------
  -- Test 1: processing_stage mirrors status (generated column sanity)
  -- ------------------------------------------------------------------
  select * into thread_row from public.ask_threads where id = thread_id;
  if thread_row.processing_stage is distinct from thread_row.status then
    raise exception 'FAILED (processing_stage mirror): expected % got %', thread_row.status, thread_row.processing_stage;
  end if;
  raise notice 'PASS: processing_stage mirrors status (%)', thread_row.processing_stage;

  update public.ask_threads set status = 'routed' where id = thread_id;
  select * into thread_row from public.ask_threads where id = thread_id;
  if thread_row.processing_stage <> 'routed' then
    raise exception 'FAILED (processing_stage mirror after update): expected routed got %', thread_row.processing_stage;
  end if;
  raise notice 'PASS: processing_stage stays in sync after status update';

  -- ------------------------------------------------------------------
  -- Test 2: fresh thread backfill defaults (case_status independent of
  -- processing_stage / status)
  -- ------------------------------------------------------------------
  if thread_row.case_status <> 'open' or thread_row.needs_admin_followup <> true or thread_row.user_has_unread_update <> false then
    raise exception 'FAILED (initial case_status defaults): got case_status=%, needs_admin_followup=%, user_has_unread_update=%',
      thread_row.case_status, thread_row.needs_admin_followup, thread_row.user_has_unread_update;
  end if;
  raise notice 'PASS: fresh thread has case_status=open, needs_admin_followup=true, user_has_unread_update=false';

  -- ------------------------------------------------------------------
  -- Test 3: user message -> case_status waiting_on_admin, unread cleared,
  -- latest_user_message_at set
  -- ------------------------------------------------------------------
  msg_row := public.add_ask_message_with_case_transition(
    thread_id, 'I cannot find where CarePrep is generated.', 'user'
  );
  select * into thread_row from public.ask_threads where id = thread_id;

  if thread_row.case_status <> 'waiting_on_admin' then
    raise exception 'FAILED (user message transition): expected case_status=waiting_on_admin got %', thread_row.case_status;
  end if;
  if thread_row.needs_admin_followup <> true then
    raise exception 'FAILED (user message transition): expected needs_admin_followup=true got %', thread_row.needs_admin_followup;
  end if;
  if thread_row.user_has_unread_update <> false then
    raise exception 'FAILED (user message transition): expected user_has_unread_update=false got %', thread_row.user_has_unread_update;
  end if;
  if thread_row.latest_user_message_at is null then
    raise exception 'FAILED (user message transition): latest_user_message_at was not set';
  end if;
  raise notice 'PASS: user message moves case_status to waiting_on_admin and sets latest_user_message_at';

  -- ------------------------------------------------------------------
  -- Test 4: a non-admin cannot author an admin message
  -- ------------------------------------------------------------------
  failed_as_expected := false;
  begin
    perform public.add_ask_message_with_case_transition(
      thread_id, 'Pretending to be an admin.', 'admin'
    );
  exception when others then
    failed_as_expected := true;
  end;
  if not failed_as_expected then
    raise exception 'FAILED (authorization): non-admin was able to author an admin-role Ask message';
  end if;
  raise notice 'PASS: non-admin author_role=admin attempt is rejected';

  -- ------------------------------------------------------------------
  -- Test 5: is_internal requires author_role = admin
  -- ------------------------------------------------------------------
  failed_as_expected := false;
  begin
    perform public.add_ask_message_with_case_transition(
      thread_id, 'Trying to sneak an internal user note.', 'user', true
    );
  exception when others then
    failed_as_expected := true;
  end;
  if not failed_as_expected then
    raise exception 'FAILED (is_internal guard): a user-authored message was accepted as internal';
  end if;
  raise notice 'PASS: is_internal=true with author_role<>admin is rejected';

  -- ------------------------------------------------------------------
  -- Test 6: assistant reply -> waiting_on_user, latest_assistant_message_at
  -- set, needs_admin_followup honors explicit override
  -- ------------------------------------------------------------------
  msg_row := public.add_ask_message_with_case_transition(
    thread_id, 'CarePrep is generated from the appointment detail screen.', 'assistant',
    false, 'email', false
  );
  select * into thread_row from public.ask_threads where id = thread_id;

  if thread_row.case_status <> 'waiting_on_user' then
    raise exception 'FAILED (assistant message transition): expected case_status=waiting_on_user got %', thread_row.case_status;
  end if;
  if thread_row.needs_admin_followup <> false then
    raise exception 'FAILED (assistant message transition): expected needs_admin_followup=false (explicit override) got %', thread_row.needs_admin_followup;
  end if;
  if thread_row.user_has_unread_update <> true then
    raise exception 'FAILED (assistant message transition): expected user_has_unread_update=true got %', thread_row.user_has_unread_update;
  end if;
  if thread_row.latest_assistant_message_at is null then
    raise exception 'FAILED (assistant message transition): latest_assistant_message_at was not set';
  end if;
  if thread_row.latest_admin_message_at is not null then
    raise exception 'FAILED (assistant message transition): latest_admin_message_at should remain untouched by an assistant reply';
  end if;
  raise notice 'PASS: assistant reply moves case_status to waiting_on_user, sets latest_assistant_message_at only, honors needs_admin_followup override';

  -- ------------------------------------------------------------------
  -- Test 7: user reopens after an answer -> waiting_on_admin again,
  -- resolved fields cleared (tested together with test 9's resolve step)
  -- ------------------------------------------------------------------
  msg_row := public.add_ask_message_with_case_transition(
    thread_id, 'That did not fully answer it, can someone follow up?', 'user'
  );
  select * into thread_row from public.ask_threads where id = thread_id;
  if thread_row.case_status <> 'waiting_on_admin' then
    raise exception 'FAILED (reopen transition): expected case_status=waiting_on_admin got %', thread_row.case_status;
  end if;
  raise notice 'PASS: user message after an answer reopens the case (waiting_on_admin)';

  -- ------------------------------------------------------------------
  -- Test 8: admin reply as internal note -> no case_status/timestamp
  -- change, but message is recorded
  -- ------------------------------------------------------------------
  perform pg_temp.set_test_auth_uid(admin_user_id);
  msg_row := public.add_ask_message_with_case_transition(
    thread_id, 'Internal: escalate to product for prompt review.', 'admin', true
  );
  select * into thread_row from public.ask_threads where id = thread_id;
  if thread_row.case_status <> 'waiting_on_admin' then
    raise exception 'FAILED (internal note): case_status should not change for an internal note, got %', thread_row.case_status;
  end if;
  if thread_row.user_has_unread_update <> false then
    raise exception 'FAILED (internal note): user_has_unread_update should not change for an internal note, got %', thread_row.user_has_unread_update;
  end if;
  if msg_row.is_internal <> true then
    raise exception 'FAILED (internal note): message was not stored as internal';
  end if;
  raise notice 'PASS: internal admin note is recorded without changing case state';

  -- ------------------------------------------------------------------
  -- Test 9: real admin reply -> waiting_on_user, unread=true,
  -- latest_admin_message_at set; then update_ask_thread_case_status to
  -- resolved sets resolved_at/resolved_by_user_id; a further user message
  -- clears them again.
  -- ------------------------------------------------------------------
  msg_row := public.add_ask_message_with_case_transition(
    thread_id, 'Following up now -- this is being reviewed.', 'admin'
  );
  select * into thread_row from public.ask_threads where id = thread_id;
  if thread_row.case_status <> 'waiting_on_user' or thread_row.user_has_unread_update <> true or thread_row.latest_admin_message_at is null then
    raise exception 'FAILED (admin reply transition): got case_status=%, unread=%, latest_admin_message_at=%',
      thread_row.case_status, thread_row.user_has_unread_update, thread_row.latest_admin_message_at;
  end if;
  raise notice 'PASS: admin reply moves case_status to waiting_on_user, sets unread and latest_admin_message_at';

  thread_row := public.update_ask_thread_case_status(thread_id, 'resolved', false, 'Confirmed answered.');
  if thread_row.case_status <> 'resolved' or thread_row.resolved_at is null or thread_row.resolved_by_user_id is null then
    raise exception 'FAILED (resolve transition): got case_status=%, resolved_at=%, resolved_by_user_id=%',
      thread_row.case_status, thread_row.resolved_at, thread_row.resolved_by_user_id;
  end if;
  raise notice 'PASS: update_ask_thread_case_status(resolved) sets resolved_at and resolved_by_user_id';

  perform pg_temp.set_test_auth_uid(test_user_id);
  msg_row := public.add_ask_message_with_case_transition(
    thread_id, 'Actually I have one more question.', 'user'
  );
  select * into thread_row from public.ask_threads where id = thread_id;
  if thread_row.case_status <> 'waiting_on_admin' or thread_row.resolved_at is not null or thread_row.resolved_by_user_id is not null then
    raise exception 'FAILED (reopen clears resolution): got case_status=%, resolved_at=%, resolved_by_user_id=%',
      thread_row.case_status, thread_row.resolved_at, thread_row.resolved_by_user_id;
  end if;
  raise notice 'PASS: a further user message clears resolved_at/resolved_by_user_id and reopens the case';

  -- ------------------------------------------------------------------
  -- Test 10: mark_ask_thread_seen clears user_has_unread_update
  -- ------------------------------------------------------------------
  perform pg_temp.set_test_auth_uid(admin_user_id);
  msg_row := public.add_ask_message_with_case_transition(thread_id, 'Answer incoming.', 'admin');
  perform pg_temp.set_test_auth_uid(test_user_id);
  select * into thread_row from public.ask_threads where id = thread_id;
  if thread_row.user_has_unread_update <> true then
    raise exception 'FAILED (seen precondition): expected unread=true before mark_ask_thread_seen';
  end if;
  thread_row := public.mark_ask_thread_seen(thread_id);
  if thread_row.user_has_unread_update <> false then
    raise exception 'FAILED (mark seen): user_has_unread_update should be false after mark_ask_thread_seen';
  end if;
  raise notice 'PASS: mark_ask_thread_seen clears user_has_unread_update';

  -- ------------------------------------------------------------------
  -- Test 11: cross-account rejection on add_ask_message_with_case_transition
  -- ------------------------------------------------------------------
  if other_user_id is not null then
    perform pg_temp.set_test_auth_uid(other_user_id);
    failed_as_expected := false;
    begin
      perform public.add_ask_message_with_case_transition(thread_id, 'Not my thread.', 'user');
    exception when others then
      failed_as_expected := true;
    end;
    if not failed_as_expected then
      raise exception 'FAILED (cross-account): a different user was able to post into another user''s Ask thread';
    end if;
    raise notice 'PASS: cross-account message attempt is rejected';
  end if;

  -- ------------------------------------------------------------------
  -- Test 12: ask_submission_reviews preserves history (append-only,
  -- multiple reviews per submission survive)
  -- ------------------------------------------------------------------
  perform pg_temp.set_test_auth_uid(test_user_id);
  insert into public.ask_submissions (thread_id, user_id, care_circle_id, router_category, original_user_wording)
  values (thread_id, test_user_id, test_care_circle_id, 'support_question', 'Fixture submission for Phase 1 tests')
  returning id into submission_id;

  perform pg_temp.set_test_auth_uid(admin_user_id);
  perform public.create_ask_submission_review(submission_id, 'needs_prompt_work', 'First pass: too vague.');
  perform public.create_ask_submission_review(submission_id, 'good_answer', 'Reconsidered after prompt fix.');

  select count(*) into review_count
  from public.ask_submission_reviews
  where ask_submission_id = submission_id;

  if review_count <> 2 then
    raise exception 'FAILED (review history): expected 2 review rows for one submission, got %', review_count;
  end if;
  raise notice 'PASS: ask_submission_reviews preserves both reviews as separate rows (history intact)';

  -- Tests for a permanent unified_ai_verdict_reviews view, a permanent
  -- support_assistant_analysis_runs widening, and ask_bridge_link_events
  -- idempotency were removed along with that machinery (see the revision
  -- note at the top of the Phase 1 migration) -- those were built for
  -- indefinite coexistence, which is no longer the plan. Phase 2's
  -- migration script gets its own tests when it is written.

  raise notice '--- Ask consolidation Phase 1 tests: ALL PASSED ---';
end $$;

rollback;
