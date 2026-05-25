create table if not exists public.ask_recommendation_decisions (
  id uuid primary key default gen_random_uuid(),
  ask_submission_id uuid not null references public.ask_submissions(id) on delete cascade,
  recommended_action_index integer,
  recommended_action jsonb not null default '{}'::jsonb,
  decision text not null
    check (decision in ('accepted', 'rejected', 'overridden')),
  created_target_table text,
  created_target_id uuid,
  override_action text,
  decision_note text,
  decided_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ask_recommendation_decisions_submission_idx
  on public.ask_recommendation_decisions (ask_submission_id, created_at desc);

create index if not exists ask_recommendation_decisions_decision_idx
  on public.ask_recommendation_decisions (decision, created_at desc);

alter table public.ask_recommendation_decisions enable row level security;

grant select on public.ask_recommendation_decisions to authenticated;

drop policy if exists "Admins can read ask recommendation decisions"
  on public.ask_recommendation_decisions;
create policy "Admins can read ask recommendation decisions"
  on public.ask_recommendation_decisions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

create or replace function public.record_ask_recommendation_decision(
  p_ask_submission_id uuid,
  p_recommended_action_index integer,
  p_recommended_action jsonb,
  p_decision text,
  p_created_target_table text default null,
  p_created_target_id uuid default null,
  p_override_action text default null,
  p_decision_note text default null
)
returns public.ask_recommendation_decisions
language plpgsql
security definer
set search_path = public
as $$
declare
  new_decision public.ask_recommendation_decisions%rowtype;
  cleaned_decision text;
begin
  perform public.assert_current_user_is_admin();

  if not exists (
    select 1 from public.ask_submissions where id = p_ask_submission_id
  ) then
    raise exception 'Ask submission not found';
  end if;

  cleaned_decision := coalesce(nullif(trim(p_decision), ''), 'rejected');

  if cleaned_decision not in ('accepted', 'rejected', 'overridden') then
    raise exception 'Unsupported recommendation decision';
  end if;

  insert into public.ask_recommendation_decisions (
    ask_submission_id,
    recommended_action_index,
    recommended_action,
    decision,
    created_target_table,
    created_target_id,
    override_action,
    decision_note,
    decided_by_user_id
  )
  values (
    p_ask_submission_id,
    p_recommended_action_index,
    coalesce(p_recommended_action, '{}'::jsonb),
    cleaned_decision,
    nullif(trim(coalesce(p_created_target_table, '')), ''),
    p_created_target_id,
    nullif(trim(coalesce(p_override_action, '')), ''),
    nullif(trim(coalesce(p_decision_note, '')), ''),
    auth.uid()
  )
  returning * into new_decision;

  return new_decision;
end;
$$;

create or replace function public.create_product_mgmt_item_from_ask(
  p_ask_submission_id uuid,
  p_area_key text,
  p_title text,
  p_body text,
  p_priority text default 'medium',
  p_status text default 'open',
  p_recommended_action_index integer default null,
  p_recommended_action jsonb default '{}'::jsonb,
  p_decision_note text default null
)
returns public.product_mgmt_items
language plpgsql
security definer
set search_path = public
as $$
declare
  target_area public.product_mgmt_areas%rowtype;
  new_item public.product_mgmt_items%rowtype;
  ask_row public.ask_submissions%rowtype;
  cleaned_priority text;
  cleaned_status text;
  metadata jsonb;
begin
  perform public.assert_current_user_is_admin();

  select *
    into ask_row
  from public.ask_submissions
  where id = p_ask_submission_id;

  if not found then
    raise exception 'Ask submission not found';
  end if;

  select *
    into target_area
  from public.product_mgmt_areas
  where area_key = p_area_key
    and is_active = true
  limit 1;

  if not found then
    raise exception 'Product management area not found';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Title is required';
  end if;

  cleaned_priority := coalesce(nullif(trim(p_priority), ''), 'medium');
  cleaned_status := coalesce(nullif(trim(p_status), ''), 'open');
  metadata := jsonb_build_object(
    'router_category', ask_row.router_category,
    'router_confidence', ask_row.router_confidence,
    'router_rationale', ask_row.router_rationale,
    'recommended_action_index', p_recommended_action_index,
    'recommended_action', coalesce(p_recommended_action, '{}'::jsonb)
  );

  insert into public.product_mgmt_items (
    area_id,
    title,
    body,
    status,
    priority,
    current_version_number,
    created_by_user_id,
    updated_by_user_id,
    source,
    submitted_by_user_id,
    care_circle_id,
    ask_submission_id,
    app_area,
    user_pain_point,
    desired_outcome,
    urgency_clues,
    original_user_wording,
    interpretation_metadata
  )
  values (
    target_area.id,
    trim(p_title),
    coalesce(p_body, ''),
    cleaned_status,
    cleaned_priority,
    1,
    auth.uid(),
    auth.uid(),
    'user_submitted',
    ask_row.user_id,
    ask_row.care_circle_id,
    ask_row.id,
    nullif(trim(coalesce(p_recommended_action->>'app_area', '')), ''),
    nullif(trim(coalesce(p_recommended_action->>'pain_point', '')), ''),
    nullif(trim(coalesce(p_recommended_action->>'desired_outcome', '')), ''),
    nullif(trim(coalesce(p_recommended_action->>'urgency', '')), ''),
    ask_row.original_user_wording,
    metadata
  )
  returning * into new_item;

  insert into public.product_mgmt_item_versions (
    item_id,
    area_id,
    title,
    body,
    status,
    priority,
    version_number,
    change_note,
    created_by_user_id,
    source,
    submitted_by_user_id,
    care_circle_id,
    ask_submission_id,
    app_area,
    user_pain_point,
    desired_outcome,
    urgency_clues,
    original_user_wording,
    interpretation_metadata
  )
  values (
    new_item.id,
    new_item.area_id,
    new_item.title,
    new_item.body,
    new_item.status,
    new_item.priority,
    1,
    'Created from Ask review',
    auth.uid(),
    'user_submitted',
    ask_row.user_id,
    ask_row.care_circle_id,
    ask_row.id,
    new_item.app_area,
    new_item.user_pain_point,
    new_item.desired_outcome,
    new_item.urgency_clues,
    new_item.original_user_wording,
    metadata
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
    'product_mgmt_items',
    new_item.id,
    'created_from',
    target_area.label,
    auth.uid()
  );

  perform public.record_ask_recommendation_decision(
    ask_row.id,
    p_recommended_action_index,
    coalesce(p_recommended_action, '{}'::jsonb),
    'accepted',
    'product_mgmt_items',
    new_item.id,
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

  return new_item;
end;
$$;

create or replace function public.ask_recommendation_decision_summary(
  p_since timestamptz default now() - interval '30 days'
)
returns table (
  decision text,
  router_category text,
  recommended_action text,
  decision_count bigint,
  avg_router_confidence numeric
)
language sql
security definer
set search_path = public
as $$
  select
    decisions.decision,
    submissions.router_category,
    coalesce(
      nullif(decisions.recommended_action->>'action', ''),
      nullif(decisions.override_action, ''),
      'unspecified'
    ) as recommended_action,
    count(*) as decision_count,
    avg(submissions.router_confidence) as avg_router_confidence
  from public.ask_recommendation_decisions decisions
  join public.ask_submissions submissions
    on submissions.id = decisions.ask_submission_id
  where decisions.created_at >= p_since
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  group by
    decisions.decision,
    submissions.router_category,
    coalesce(
      nullif(decisions.recommended_action->>'action', ''),
      nullif(decisions.override_action, ''),
      'unspecified'
    )
  order by decision_count desc, decisions.decision;
$$;

grant execute on function public.record_ask_recommendation_decision(
  uuid,
  integer,
  jsonb,
  text,
  text,
  uuid,
  text,
  text
) to authenticated;

grant execute on function public.create_product_mgmt_item_from_ask(
  uuid,
  text,
  text,
  text,
  text,
  text,
  integer,
  jsonb,
  text
) to authenticated;

grant execute on function public.ask_recommendation_decision_summary(timestamptz)
  to authenticated;
