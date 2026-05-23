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
  new_count bigint,
  followup_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_current_user_is_admin();

  create temporary table if not exists pg_temp.admin_attention_rows (
    scope_type text,
    scope_key text,
    latest_activity_at timestamptz,
    new_count bigint,
    followup_count bigint
  ) on commit drop;
  truncate table pg_temp.admin_attention_rows;

  insert into pg_temp.admin_attention_rows
  values ('admin_tab', 'tools', null, 0, 0);

  if to_regclass('public.ai_instruction_versions') is not null then
    execute $sql$
      insert into pg_temp.admin_attention_rows
      select
        'ai_admin_tab',
        'instructions',
        max(aiv.created_at),
        case
          when max(aiv.created_at) > coalesce(avs.last_viewed_at, '-infinity'::timestamptz)
            then 1::bigint
          else 0::bigint
        end,
        0::bigint
      from public.ai_instruction_versions aiv
      left join public.admin_view_states avs
        on avs.admin_user_id = auth.uid()
       and avs.scope_type = 'ai_admin_tab'
       and avs.scope_key = 'instructions'
      group by avs.last_viewed_at
    $sql$;

    execute $sql$
      insert into pg_temp.admin_attention_rows
      select
        'ai_admin_tab',
        'history',
        max(aiv.created_at),
        case
          when max(aiv.created_at) > coalesce(avs.last_viewed_at, '-infinity'::timestamptz)
            then 1::bigint
          else 0::bigint
        end,
        0::bigint
      from public.ai_instruction_versions aiv
      left join public.admin_view_states avs
        on avs.admin_user_id = auth.uid()
       and avs.scope_type = 'ai_admin_tab'
       and avs.scope_key = 'history'
      group by avs.last_viewed_at
    $sql$;
  end if;

  if to_regclass('public.app_content_versions') is not null then
    execute $sql$
      insert into pg_temp.admin_attention_rows
      select
        'ai_admin_tab',
        'agentKnowledge',
        max(acv.created_at),
        case
          when max(acv.created_at) > coalesce(avs.last_viewed_at, '-infinity'::timestamptz)
            then 1::bigint
          else 0::bigint
        end,
        0::bigint
      from public.app_content_versions acv
      left join public.admin_view_states avs
        on avs.admin_user_id = auth.uid()
       and avs.scope_type = 'ai_admin_tab'
       and avs.scope_key = 'agentKnowledge'
      where acv.content_key in (
        'support_agent_product_facts',
        'support_agent_known_limitations',
        'support_agent_escalation_guidance',
        'support_agent_voice_guidance'
      )
      group by avs.last_viewed_at
    $sql$;

    execute $sql$
      insert into pg_temp.admin_attention_rows
      select
        'admin_tab',
        'content',
        max(acv.created_at),
        count(*) filter (
          where acv.created_at > coalesce(avs.last_viewed_at, '-infinity'::timestamptz)
        ),
        0::bigint
      from public.app_content_versions acv
      left join public.admin_view_states avs
        on avs.admin_user_id = auth.uid()
       and avs.scope_type = 'admin_tab'
       and avs.scope_key = 'content'
      group by avs.last_viewed_at
    $sql$;
  end if;

  if to_regclass('public.agent_knowledge_proposals') is not null then
    execute $sql$
      insert into pg_temp.admin_attention_rows
      select
        'ai_admin_tab',
        'proposals',
        max(akp.updated_at),
        case
          when max(akp.updated_at) > coalesce(avs.last_viewed_at, '-infinity'::timestamptz)
            then 1::bigint
          else 0::bigint
        end,
        count(*) filter (where akp.status in ('draft', 'needs_review'))
      from public.agent_knowledge_proposals akp
      left join public.admin_view_states avs
        on avs.admin_user_id = auth.uid()
       and avs.scope_type = 'ai_admin_tab'
       and avs.scope_key = 'proposals'
      group by avs.last_viewed_at
    $sql$;
  end if;

  if to_regclass('public.product_mgmt_areas') is not null
     and to_regclass('public.product_mgmt_items') is not null then
    execute $sql$
      insert into pg_temp.admin_attention_rows
      select
        'product_area',
        pma.area_key,
        max(pmi.updated_at),
        count(*) filter (
          where pmi.updated_at > coalesce(avs.last_viewed_at, '-infinity'::timestamptz)
        ),
        count(*) filter (where pmi.status in ('open', 'in_progress'))
      from public.product_mgmt_areas pma
      left join public.product_mgmt_items pmi on pmi.area_id = pma.id
      left join public.admin_view_states avs
        on avs.admin_user_id = auth.uid()
       and avs.scope_type = 'product_area'
       and avs.scope_key = pma.area_key
      where pma.is_active = true
      group by pma.area_key, avs.last_viewed_at
    $sql$;
  end if;

  if to_regclass('public.support_tickets') is not null then
    execute $sql$
      insert into pg_temp.admin_attention_rows
      select
        'admin_tab',
        'tickets',
        max(st.updated_at),
        count(*) filter (
          where st.updated_at > coalesce(avs.last_viewed_at, '-infinity'::timestamptz)
        ),
        count(*) filter (
          where st.needs_admin_followup = true
            and st.status not in ('closed', 'resolved')
        )
      from public.support_tickets st
      left join public.admin_view_states avs
        on avs.admin_user_id = auth.uid()
       and avs.scope_type = 'admin_tab'
       and avs.scope_key = 'tickets'
      group by avs.last_viewed_at
    $sql$;
  end if;

  if to_regclass('public.integration_error_events') is not null then
    execute $sql$
      insert into pg_temp.admin_attention_rows
      select
        'admin_tab',
        'errors',
        max(iee.occurred_at),
        count(*) filter (
          where iee.occurred_at > coalesce(avs.last_viewed_at, '-infinity'::timestamptz)
        ),
        count(*)
      from public.integration_error_events iee
      left join public.admin_view_states avs
        on avs.admin_user_id = auth.uid()
       and avs.scope_type = 'admin_tab'
       and avs.scope_key = 'errors'
      where iee.occurred_at >= now() - interval '30 days'
      group by avs.last_viewed_at
    $sql$;
  end if;

  if to_regclass('public.support_assistant_interactions') is not null then
    if to_regclass('public.support_assistant_admin_reviews') is not null then
      execute $sql$
        insert into pg_temp.admin_attention_rows
        select
          'admin_tab',
          'assistantReview',
          max(sai.updated_at),
          count(*) filter (
            where sai.updated_at > coalesce(avs.last_viewed_at, '-infinity'::timestamptz)
          ),
          count(*) filter (
            where not exists (
              select 1
              from public.support_assistant_admin_reviews saar
              where saar.interaction_id = sai.id
            )
          )
        from public.support_assistant_interactions sai
        left join public.admin_view_states avs
          on avs.admin_user_id = auth.uid()
         and avs.scope_type = 'admin_tab'
         and avs.scope_key = 'assistantReview'
        group by avs.last_viewed_at
      $sql$;
    else
      execute $sql$
        insert into pg_temp.admin_attention_rows
        select
          'admin_tab',
          'assistantReview',
          max(sai.updated_at),
          count(*) filter (
            where sai.updated_at > coalesce(avs.last_viewed_at, '-infinity'::timestamptz)
          ),
          count(*)
        from public.support_assistant_interactions sai
        left join public.admin_view_states avs
          on avs.admin_user_id = auth.uid()
         and avs.scope_type = 'admin_tab'
         and avs.scope_key = 'assistantReview'
        group by avs.last_viewed_at
      $sql$;
    end if;
  end if;

  if to_regclass('public.profiles') is not null then
    execute $sql$
      insert into pg_temp.admin_attention_rows
      select
        'admin_tab',
        'users',
        max(p.created_at),
        count(*) filter (
          where p.created_at > coalesce(avs.last_viewed_at, '-infinity'::timestamptz)
        ),
        0::bigint
      from public.profiles p
      left join public.admin_view_states avs
        on avs.admin_user_id = auth.uid()
       and avs.scope_type = 'admin_tab'
       and avs.scope_key = 'users'
      group by avs.last_viewed_at
    $sql$;
  end if;

  insert into pg_temp.admin_attention_rows
  select
    'admin_tab',
    'product',
    max(latest_activity_at),
    coalesce(sum(new_count), 0)::bigint,
    coalesce(sum(followup_count), 0)::bigint
  from pg_temp.admin_attention_rows
  where scope_type = 'product_area';

  insert into pg_temp.admin_attention_rows
  select
    'admin_tab',
    'ai',
    max(latest_activity_at),
    coalesce(sum(new_count), 0)::bigint,
    coalesce(sum(followup_count), 0)::bigint
  from pg_temp.admin_attention_rows
  where scope_type = 'ai_admin_tab';

  return query
  select
    rows.scope_type,
    rows.scope_key,
    rows.latest_activity_at,
    coalesce(rows.new_count, 0)::bigint,
    coalesce(rows.followup_count, 0)::bigint
  from pg_temp.admin_attention_rows rows;
end;
$$;

grant execute on function public.get_admin_attention_summary()
  to authenticated;
