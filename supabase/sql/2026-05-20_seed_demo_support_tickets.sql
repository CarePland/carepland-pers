-- Seed varied demo support tickets for one existing user so the Admin > Tix UI
-- can be reviewed with different statuses, priorities, and message histories.
--
-- Before running: change target_email below if needed.
-- Cleanup script: 2026-05-20_remove_demo_support_tickets.sql

do $$
declare
  target_email text := 'andrew@goodloe.org';
  target_user_id uuid;
  target_care_circle_id uuid;
  admin_user_id uuid;
  ticket_id uuid;
begin
  select p.id
    into target_user_id
  from public.profiles p
  where lower(p.email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No profile found for %', target_email;
  end if;

  select ccm.care_circle_id
    into target_care_circle_id
  from public.care_circle_memberships ccm
  where ccm.user_id = target_user_id
    and ccm.status = 'active'
  order by ccm.created_at asc
  limit 1;

  select p.id
    into admin_user_id
  from public.profiles p
  where coalesce(p.is_admin, false) = true
  order by p.created_at asc
  limit 1;

  admin_user_id := coalesce(admin_user_id, target_user_id);

  delete from public.support_tickets
  where user_id = target_user_id
    and context ->> 'demo_support_ticket' = 'true';

  insert into public.support_tickets (
    user_id,
    care_circle_id,
    subject,
    status,
    priority,
    category,
    source,
    current_page,
    context,
    needs_admin_followup,
    user_has_unread_update,
    latest_user_message_at,
    latest_admin_message_at,
    created_at,
    updated_at
  )
  values (
    target_user_id,
    target_care_circle_id,
    'I cannot tell where my archived appointment went',
    'open',
    'medium',
    'navigation',
    'demo_seed',
    'appointments',
    jsonb_build_object('demo_support_ticket', true, 'demo_label', 'open needs admin reply'),
    true,
    false,
    now() - interval '42 minutes',
    null,
    now() - interval '45 minutes',
    now() - interval '42 minutes'
  )
  returning id into ticket_id;

  insert into public.support_ticket_messages (ticket_id, author_user_id, author_role, message_body, created_at)
  values
    (ticket_id, target_user_id, 'user', 'I archived an appointment while testing and now I cannot figure out how to get it back. Is it deleted?', now() - interval '42 minutes');

  insert into public.support_ticket_events (ticket_id, event_type, new_value, actor_user_id, note, created_at)
  values
    (ticket_id, 'demo_ticket_seeded', jsonb_build_object('status', 'open', 'priority', 'medium'), admin_user_id, 'Demo support ticket seeded for UI review', now() - interval '42 minutes');

  insert into public.support_tickets (
    user_id,
    care_circle_id,
    subject,
    status,
    priority,
    category,
    source,
    current_page,
    context,
    needs_admin_followup,
    user_has_unread_update,
    latest_user_message_at,
    latest_admin_message_at,
    created_at,
    updated_at
  )
  values (
    target_user_id,
    target_care_circle_id,
    'Quick Add made the wrong date',
    'in_progress',
    'high',
    'ai_intake',
    'demo_seed',
    'appointments',
    jsonb_build_object('demo_support_ticket', true, 'demo_label', 'back and forth needs admin reply'),
    true,
    false,
    now() - interval '11 minutes',
    now() - interval '24 minutes',
    now() - interval '2 hours',
    now() - interval '11 minutes'
  )
  returning id into ticket_id;

  insert into public.support_ticket_messages (ticket_id, author_user_id, author_role, message_body, is_internal, created_at)
  values
    (ticket_id, target_user_id, 'user', 'I typed "dentist next Thursday at 10" and it picked Friday instead.', false, now() - interval '2 hours'),
    (ticket_id, admin_user_id, 'admin', 'Thanks. I am checking the date parsing path. Was this typed from the Quick Add box on the appointments page?', false, now() - interval '24 minutes'),
    (ticket_id, admin_user_id, 'admin', 'Possible timezone or relative-date parsing issue. Ask for exact entered text if user replies.', true, now() - interval '23 minutes'),
    (ticket_id, target_user_id, 'user', 'Yes, Quick Add. I entered exactly: dentist next Thursday at 10.', false, now() - interval '11 minutes');

  insert into public.support_ticket_events (ticket_id, event_type, old_value, new_value, actor_user_id, note, created_at)
  values
    (ticket_id, 'demo_ticket_seeded', null, jsonb_build_object('status', 'in_progress', 'priority', 'high'), admin_user_id, 'Demo ticket with back-and-forth messages', now() - interval '2 hours'),
    (ticket_id, 'internal_note_added', null, jsonb_build_object('note', 'Possible timezone or relative-date parsing issue'), admin_user_id, 'Demo internal note', now() - interval '23 minutes');

  insert into public.support_tickets (
    user_id,
    care_circle_id,
    subject,
    status,
    priority,
    category,
    source,
    current_page,
    context,
    needs_admin_followup,
    user_has_unread_update,
    latest_user_message_at,
    latest_admin_message_at,
    created_at,
    updated_at
  )
  values (
    target_user_id,
    target_care_circle_id,
    'How do I remove demo data?',
    'waiting_on_user',
    'low',
    'how_to',
    'demo_seed',
    'profile',
    jsonb_build_object('demo_support_ticket', true, 'demo_label', 'waiting on user unread update'),
    false,
    true,
    now() - interval '1 day 3 hours',
    now() - interval '1 day 2 hours',
    now() - interval '1 day 3 hours',
    now() - interval '1 day 2 hours'
  )
  returning id into ticket_id;

  insert into public.support_ticket_messages (ticket_id, author_user_id, author_role, message_body, created_at)
  values
    (ticket_id, target_user_id, 'user', 'I added demo data and now I want to start clean. Where is that?', now() - interval '1 day 3 hours'),
    (ticket_id, admin_user_id, 'admin', 'Go to Profile, then use Remove demo data. That only removes the demo examples and leaves your real appointments alone.', now() - interval '1 day 2 hours');

  insert into public.support_ticket_events (ticket_id, event_type, new_value, actor_user_id, note, created_at)
  values
    (ticket_id, 'demo_ticket_seeded', jsonb_build_object('status', 'waiting_on_user', 'priority', 'low'), admin_user_id, 'Demo ticket showing user unread admin response', now() - interval '1 day 2 hours');

  insert into public.support_tickets (
    user_id,
    care_circle_id,
    subject,
    status,
    priority,
    category,
    source,
    current_page,
    context,
    needs_admin_followup,
    user_has_unread_update,
    latest_user_message_at,
    latest_admin_message_at,
    resolved_by_user_id,
    resolved_at,
    created_at,
    updated_at
  )
  values (
    target_user_id,
    target_care_circle_id,
    'Password reset link worked after second try',
    'resolved',
    'medium',
    'account',
    'demo_seed',
    'profile',
    jsonb_build_object('demo_support_ticket', true, 'demo_label', 'resolved ticket'),
    false,
    false,
    now() - interval '3 days 5 hours',
    now() - interval '3 days 4 hours',
    admin_user_id,
    now() - interval '3 days 3 hours',
    now() - interval '3 days 5 hours',
    now() - interval '3 days 3 hours'
  )
  returning id into ticket_id;

  insert into public.support_ticket_messages (ticket_id, author_user_id, author_role, message_body, created_at)
  values
    (ticket_id, target_user_id, 'user', 'The first password reset link did not seem to work, but the second one did.', now() - interval '3 days 5 hours'),
    (ticket_id, admin_user_id, 'admin', 'Glad it worked. I am marking this resolved, but please reopen if it happens again.', now() - interval '3 days 4 hours'),
    (ticket_id, target_user_id, 'user', 'Works now. Thanks.', now() - interval '3 days 3 hours');

  insert into public.support_ticket_events (ticket_id, event_type, new_value, actor_user_id, note, created_at)
  values
    (ticket_id, 'demo_ticket_seeded', jsonb_build_object('status', 'resolved', 'priority', 'medium'), admin_user_id, 'Demo resolved ticket', now() - interval '3 days 3 hours');

  insert into public.support_tickets (
    user_id,
    care_circle_id,
    subject,
    status,
    priority,
    category,
    source,
    current_page,
    context,
    needs_admin_followup,
    user_has_unread_update,
    latest_user_message_at,
    latest_admin_message_at,
    created_at,
    updated_at
  )
  values (
    target_user_id,
    target_care_circle_id,
    'CarePrep keeps mentioning the wrong appointment',
    'open',
    'urgent',
    'careprep',
    'demo_seed',
    'appointments',
    jsonb_build_object('demo_support_ticket', true, 'demo_label', 'urgent needs followup'),
    true,
    false,
    now() - interval '6 minutes',
    null,
    now() - interval '6 minutes',
    now() - interval '6 minutes'
  )
  returning id into ticket_id;

  insert into public.support_ticket_messages (ticket_id, author_user_id, author_role, message_body, created_at)
  values
    (ticket_id, target_user_id, 'user', 'I generated CarePrep for cardiology, but it pulled in a vet appointment and now I do not trust the summary.', now() - interval '6 minutes');

  insert into public.support_ticket_events (ticket_id, event_type, new_value, actor_user_id, note, created_at)
  values
    (ticket_id, 'demo_ticket_seeded', jsonb_build_object('status', 'open', 'priority', 'urgent'), admin_user_id, 'Demo urgent CarePrep ticket', now() - interval '6 minutes');

  raise notice 'Seeded demo support tickets for %', target_email;
end $$;
