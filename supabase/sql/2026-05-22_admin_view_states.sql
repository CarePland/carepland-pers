create table if not exists public.admin_view_states (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  scope_type text not null,
  scope_key text not null,
  last_viewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (admin_user_id, scope_type, scope_key),
  check (scope_type in ('admin_tab', 'ai_admin_tab', 'product_area')),
  check (length(trim(scope_key)) > 0)
);

create index if not exists admin_view_states_admin_scope_idx
  on public.admin_view_states (admin_user_id, scope_type, scope_key);

alter table public.admin_view_states enable row level security;

grant select, insert, update on public.admin_view_states to authenticated;

drop policy if exists "Admins can read their admin view states"
  on public.admin_view_states;
create policy "Admins can read their admin view states"
  on public.admin_view_states
  for select
  using (
    admin_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Admins can create their admin view states"
  on public.admin_view_states;
create policy "Admins can create their admin view states"
  on public.admin_view_states
  for insert
  with check (
    admin_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Admins can update their admin view states"
  on public.admin_view_states;
create policy "Admins can update their admin view states"
  on public.admin_view_states
  for update
  using (
    admin_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    admin_user_id = auth.uid()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

create or replace function public.mark_admin_view_state(
  p_scope_type text,
  p_scope_key text
)
returns public.admin_view_states
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_state public.admin_view_states%rowtype;
begin
  perform public.assert_current_user_is_admin();

  if p_scope_type not in ('admin_tab', 'ai_admin_tab', 'product_area') then
    raise exception 'Unsupported admin view scope type: %', p_scope_type;
  end if;

  if length(trim(coalesce(p_scope_key, ''))) = 0 then
    raise exception 'Admin view scope key is required';
  end if;

  insert into public.admin_view_states (
    admin_user_id,
    scope_type,
    scope_key,
    last_viewed_at,
    updated_at
  )
  values (
    auth.uid(),
    p_scope_type,
    trim(p_scope_key),
    now(),
    now()
  )
  on conflict (admin_user_id, scope_type, scope_key)
  do update
    set last_viewed_at = excluded.last_viewed_at,
        updated_at = now()
  returning * into updated_state;

  return updated_state;
end;
$$;

grant execute on function public.mark_admin_view_state(text, text)
  to authenticated;

create or replace function public.get_admin_attention_summary()
returns table (
  scope_type text,
  scope_key text,
  latest_activity_at timestamptz,
  attention_count bigint
)
language sql
security definer
set search_path = public
as $$
  with admin_check as (
    select public.assert_current_user_is_admin()
  ),
  states as (
    select scope_type, scope_key, last_viewed_at
    from public.admin_view_states
    where admin_user_id = auth.uid()
  ),
  product_area_activity as (
    select
      'product_area'::text as scope_type,
      pma.area_key as scope_key,
      max(pmi.updated_at) as latest_activity_at,
      count(*) filter (
        where pmi.updated_at > coalesce(s.last_viewed_at, '-infinity'::timestamptz)
      ) as attention_count
    from public.product_mgmt_areas pma
    left join public.product_mgmt_items pmi on pmi.area_id = pma.id
    left join states s
      on s.scope_type = 'product_area'
     and s.scope_key = pma.area_key
    where pma.is_active = true
    group by pma.area_key
  ),
  ai_subsections as (
    select
      'ai_admin_tab'::text as scope_type,
      'instructions'::text as scope_key,
      max(created_at) as latest_activity_at
    from public.ai_instruction_versions
    union all
    select
      'ai_admin_tab'::text,
      'agentKnowledge'::text,
      max(created_at)
    from public.app_content_versions
    where content_key in (
      'support_agent_product_facts',
      'support_agent_known_limitations',
      'support_agent_escalation_guidance',
      'support_agent_voice_guidance'
    )
    union all
    select
      'ai_admin_tab'::text,
      'proposals'::text,
      max(updated_at)
    from public.agent_knowledge_proposals
    union all
    select
      'ai_admin_tab'::text,
      'history'::text,
      max(created_at)
    from (
      select created_at from public.ai_instruction_versions
      union all
      select created_at from public.support_assistant_analysis_runs
    ) history_rows
  ),
  ai_activity as (
    select
      a.scope_type,
      a.scope_key,
      a.latest_activity_at,
      case
        when a.latest_activity_at > coalesce(s.last_viewed_at, '-infinity'::timestamptz)
          then 1::bigint
        else 0::bigint
      end as attention_count
    from ai_subsections a
    left join states s
      on s.scope_type = a.scope_type
     and s.scope_key = a.scope_key
  ),
  tab_activity as (
    select
      'admin_tab'::text as scope_type,
      'tickets'::text as scope_key,
      max(updated_at) as latest_activity_at,
      count(*) filter (
        where updated_at > coalesce(
          (select last_viewed_at from states where scope_type = 'admin_tab' and scope_key = 'tickets'),
          '-infinity'::timestamptz
        )
      ) as attention_count
    from public.support_tickets
    union all
    select
      'admin_tab'::text,
      'errors'::text,
      max(occurred_at),
      count(*) filter (
        where occurred_at > coalesce(
          (select last_viewed_at from states where scope_type = 'admin_tab' and scope_key = 'errors'),
          '-infinity'::timestamptz
        )
      )
    from public.integration_error_events
    where occurred_at >= now() - interval '30 days'
    union all
    select
      'admin_tab'::text,
      'assistantReview'::text,
      max(updated_at),
      count(*) filter (
        where updated_at > coalesce(
          (select last_viewed_at from states where scope_type = 'admin_tab' and scope_key = 'assistantReview'),
          '-infinity'::timestamptz
        )
      )
    from public.support_assistant_interactions
    union all
    select
      'admin_tab'::text,
      'users'::text,
      max(created_at),
      count(*) filter (
        where created_at > coalesce(
          (select last_viewed_at from states where scope_type = 'admin_tab' and scope_key = 'users'),
          '-infinity'::timestamptz
        )
      )
    from public.profiles
    union all
    select
      'admin_tab'::text,
      'content'::text,
      max(created_at),
      count(*) filter (
        where created_at > coalesce(
          (select last_viewed_at from states where scope_type = 'admin_tab' and scope_key = 'content'),
          '-infinity'::timestamptz
        )
      )
    from public.app_content_versions
    union all
    select
      'admin_tab'::text,
      'product'::text,
      max(updated_at),
      count(*) filter (
        where updated_at > coalesce(
          (select last_viewed_at from states where scope_type = 'admin_tab' and scope_key = 'product'),
          '-infinity'::timestamptz
        )
      )
    from public.product_mgmt_items
    union all
    select
      'admin_tab'::text,
      'ai'::text,
      max(latest_activity_at),
      sum(attention_count)
    from ai_activity
    union all
    select
      'admin_tab'::text,
      'tools'::text,
      null::timestamptz,
      0::bigint
  )
  select tab_activity.scope_type, tab_activity.scope_key, tab_activity.latest_activity_at, tab_activity.attention_count
  from admin_check, tab_activity
  union all
  select ai_activity.scope_type, ai_activity.scope_key, ai_activity.latest_activity_at, ai_activity.attention_count
  from ai_activity
  union all
  select product_area_activity.scope_type, product_area_activity.scope_key, product_area_activity.latest_activity_at, product_area_activity.attention_count
  from product_area_activity;
$$;

grant execute on function public.get_admin_attention_summary()
  to authenticated;
