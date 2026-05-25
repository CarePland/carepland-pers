create or replace function public.resolve_ask_answer_from_review(
  p_ask_submission_id uuid,
  p_recommended_action_index integer default null,
  p_recommended_action jsonb default '{}'::jsonb,
  p_decision_note text default null
)
returns public.ask_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  ask_row public.ask_submissions%rowtype;
  updated_submission public.ask_submissions%rowtype;
begin
  perform public.assert_current_user_is_admin();

  select *
    into ask_row
  from public.ask_submissions
  where id = p_ask_submission_id;

  if not found then
    raise exception 'Ask submission not found';
  end if;

  perform public.record_ask_recommendation_decision(
    ask_row.id,
    p_recommended_action_index,
    coalesce(p_recommended_action, '{}'::jsonb),
    'accepted',
    null,
    null,
    null,
    p_decision_note
  );

  update public.ask_submissions
    set routing_state = 'closed',
        reviewed_by_user_id = auth.uid(),
        reviewed_at = now(),
        review_note = coalesce(nullif(trim(p_decision_note), ''), review_note),
        updated_at = now()
  where id = ask_row.id
  returning * into updated_submission;

  update public.ask_threads
    set status = 'closed',
        clarifying_stop_reason = coalesce(
          nullif(clarifying_stop_reason, ''),
          'answer_accepted_by_admin'
        ),
        updated_at = now()
  where id = ask_row.thread_id;

  return updated_submission;
end;
$$;

create or replace function public.create_support_ticket_from_ask(
  p_ask_submission_id uuid,
  p_subject text,
  p_message text,
  p_priority text default 'medium',
  p_category text default 'ask_support',
  p_recommended_action_index integer default null,
  p_recommended_action jsonb default '{}'::jsonb,
  p_decision_note text default null
)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  ask_row public.ask_submissions%rowtype;
  cleaned_priority text;
  cleaned_category text;
  new_ticket public.support_tickets%rowtype;
begin
  perform public.assert_current_user_is_admin();

  select *
    into ask_row
  from public.ask_submissions
  where id = p_ask_submission_id;

  if not found then
    raise exception 'Ask submission not found';
  end if;

  if nullif(trim(p_subject), '') is null then
    raise exception 'Support ticket subject is required';
  end if;

  cleaned_priority := coalesce(nullif(trim(p_priority), ''), 'medium');
  if cleaned_priority not in ('low', 'medium', 'high', 'urgent') then
    cleaned_priority := 'medium';
  end if;

  cleaned_category := coalesce(
    nullif(trim(p_category), ''),
    nullif(trim(ask_row.router_category), ''),
    'ask_support'
  );

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
    latest_user_message_at,
    ask_submission_id
  )
  values (
    ask_row.user_id,
    ask_row.care_circle_id,
    trim(p_subject),
    'open',
    cleaned_priority,
    cleaned_category,
    'ask_review',
    ask_row.current_page,
    coalesce(ask_row.context, '{}'::jsonb) ||
      jsonb_build_object(
        'ask_submission_id', ask_row.id,
        'ask_thread_id', ask_row.thread_id,
        'router_category', ask_row.router_category,
        'router_confidence', ask_row.router_confidence,
        'recommended_action_index', p_recommended_action_index,
        'recommended_action', coalesce(p_recommended_action, '{}'::jsonb)
      ),
    true,
    ask_row.created_at,
    ask_row.id
  )
  returning * into new_ticket;

  insert into public.support_ticket_messages (
    ticket_id,
    author_user_id,
    author_role,
    message_body
  )
  values (
    new_ticket.id,
    ask_row.user_id,
    'user',
    ask_row.original_user_wording
  );

  insert into public.support_ticket_messages (
    ticket_id,
    author_user_id,
    author_role,
    message_body,
    is_internal
  )
  values (
    new_ticket.id,
    auth.uid(),
    'system',
    concat(
      'Created from Ask review.',
      E'\n\nAdmin handoff note:\n',
      coalesce(nullif(trim(p_message), ''), 'No handoff note provided.'),
      E'\n\nAsk submission: ', ask_row.id,
      E'\n\nRouter rationale: ', ask_row.router_rationale,
      E'\n\nTranscript:\n', ask_row.transcript
    ),
    true
  );

  insert into public.support_ticket_events (
    ticket_id,
    event_type,
    new_value,
    actor_user_id,
    note
  )
  values (
    new_ticket.id,
    'created_from_ask',
    jsonb_build_object(
      'ask_submission_id', ask_row.id,
      'subject', new_ticket.subject,
      'status', new_ticket.status
    ),
    auth.uid(),
    'Admin created a support ticket from Ask review'
  );

  insert into public.support_ticket_links (
    ticket_id,
    link_type,
    linked_table,
    linked_id,
    label,
    created_by_user_id
  )
  values (
    new_ticket.id,
    'created_from',
    'ask_submissions',
    ask_row.id,
    'Ask submission',
    auth.uid()
  );

  insert into public.ask_submission_links (
    ask_submission_id,
    target_table,
    target_id,
    relationship_type,
    label,
    created_by_user_id
  )
  values (
    ask_row.id,
    'support_tickets',
    new_ticket.id,
    'created_from',
    'Support ticket',
    auth.uid()
  );

  perform public.record_ask_recommendation_decision(
    ask_row.id,
    p_recommended_action_index,
    coalesce(p_recommended_action, '{}'::jsonb),
    'accepted',
    'support_tickets',
    new_ticket.id,
    null,
    p_decision_note
  );

  update public.ask_submissions
    set routing_state = 'admin_overridden',
        reviewed_by_user_id = auth.uid(),
        reviewed_at = now(),
        review_note = coalesce(nullif(trim(p_decision_note), ''), review_note),
        updated_at = now()
  where id = ask_row.id;

  update public.ask_threads
    set status = 'routed',
        clarifying_stop_reason = coalesce(
          nullif(clarifying_stop_reason, ''),
          'support_ticket_created_by_admin'
        ),
        updated_at = now()
  where id = ask_row.thread_id;

  return new_ticket;
end;
$$;

grant execute on function public.resolve_ask_answer_from_review(
  uuid,
  integer,
  jsonb,
  text
) to authenticated;

grant execute on function public.create_support_ticket_from_ask(
  uuid,
  text,
  text,
  text,
  text,
  integer,
  jsonb,
  text
) to authenticated;
