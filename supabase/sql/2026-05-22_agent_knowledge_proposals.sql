create table if not exists public.agent_knowledge_proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  source_type text not null default 'manual'
    check (source_type in ('manual', 'software_update', 'scheduled_check', 'drift_check', 'feedback_review')),
  status text not null default 'draft'
    check (status in ('draft', 'needs_review', 'approved', 'published', 'rejected', 'archived')),
  proposed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  published_by_user_id uuid references auth.users(id) on delete set null,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz
);

create table if not exists public.agent_knowledge_proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.agent_knowledge_proposals(id) on delete cascade,
  content_key text not null,
  content_label text not null,
  source_version_id uuid references public.app_content_versions(id) on delete set null,
  source_version_number integer,
  original_body text not null default '',
  ai_proposed_body text not null default '',
  admin_final_body text,
  justification text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  risk_category text not null default 'general',
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'accepted', 'edited', 'rejected', 'needs_later_review')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_knowledge_proposal_feedback_links (
  id uuid primary key default gen_random_uuid(),
  proposal_item_id uuid not null references public.agent_knowledge_proposal_items(id) on delete cascade,
  interaction_id uuid not null references public.support_assistant_interactions(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (proposal_item_id, interaction_id)
);

create index if not exists agent_knowledge_proposals_status_idx
  on public.agent_knowledge_proposals (status, created_at desc);

create index if not exists agent_knowledge_proposal_items_proposal_idx
  on public.agent_knowledge_proposal_items (proposal_id, review_status);

create index if not exists agent_knowledge_proposal_items_content_key_idx
  on public.agent_knowledge_proposal_items (content_key, created_at desc);

create index if not exists agent_knowledge_proposal_feedback_links_interaction_idx
  on public.agent_knowledge_proposal_feedback_links (interaction_id);

alter table public.agent_knowledge_proposals enable row level security;
alter table public.agent_knowledge_proposal_items enable row level security;
alter table public.agent_knowledge_proposal_feedback_links enable row level security;

grant select, insert, update on public.agent_knowledge_proposals to authenticated;
grant select, insert, update on public.agent_knowledge_proposal_items to authenticated;
grant select, insert, update on public.agent_knowledge_proposal_feedback_links to authenticated;

drop policy if exists "Admins can manage agent knowledge proposals"
  on public.agent_knowledge_proposals;
create policy "Admins can manage agent knowledge proposals"
  on public.agent_knowledge_proposals
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Admins can manage agent knowledge proposal items"
  on public.agent_knowledge_proposal_items;
create policy "Admins can manage agent knowledge proposal items"
  on public.agent_knowledge_proposal_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Admins can manage agent knowledge proposal feedback links"
  on public.agent_knowledge_proposal_feedback_links;
create policy "Admins can manage agent knowledge proposal feedback links"
  on public.agent_knowledge_proposal_feedback_links
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

create or replace function public.create_agent_knowledge_proposal(
  p_title text,
  p_summary text,
  p_source_type text,
  p_items jsonb
)
returns public.agent_knowledge_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_source_type text;
  item jsonb;
  new_proposal public.agent_knowledge_proposals%rowtype;
begin
  perform public.assert_current_user_is_admin();

  if nullif(trim(p_title), '') is null then
    raise exception 'Proposal title is required';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Proposal items must be a JSON array';
  end if;

  cleaned_source_type := coalesce(nullif(trim(p_source_type), ''), 'manual');

  if cleaned_source_type not in ('manual', 'software_update', 'scheduled_check', 'drift_check', 'feedback_review') then
    raise exception 'Unsupported proposal source type: %', cleaned_source_type;
  end if;

  insert into public.agent_knowledge_proposals (
    title,
    summary,
    source_type,
    status,
    proposed_by_user_id
  )
  values (
    trim(p_title),
    trim(coalesce(p_summary, '')),
    cleaned_source_type,
    'needs_review',
    auth.uid()
  )
  returning * into new_proposal;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.agent_knowledge_proposal_items (
      proposal_id,
      content_key,
      content_label,
      source_version_id,
      source_version_number,
      original_body,
      ai_proposed_body,
      admin_final_body,
      justification,
      evidence,
      risk_category,
      confidence
    )
    values (
      new_proposal.id,
      trim(item->>'content_key'),
      coalesce(nullif(trim(item->>'content_label'), ''), trim(item->>'content_key')),
      nullif(item->>'source_version_id', '')::uuid,
      nullif(item->>'source_version_number', '')::integer,
      coalesce(item->>'original_body', ''),
      coalesce(item->>'ai_proposed_body', ''),
      nullif(item->>'admin_final_body', ''),
      coalesce(item->>'justification', ''),
      coalesce(item->'evidence', '[]'::jsonb),
      coalesce(nullif(trim(item->>'risk_category'), ''), 'general'),
      least(1, greatest(0, coalesce(nullif(item->>'confidence', '')::numeric, 0)))
    );
  end loop;

  return new_proposal;
end;
$$;

create or replace function public.review_agent_knowledge_proposal_item(
  p_item_id uuid,
  p_review_status text,
  p_admin_final_body text default null,
  p_admin_note text default null
)
returns public.agent_knowledge_proposal_items
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_status text;
  updated_item public.agent_knowledge_proposal_items%rowtype;
begin
  perform public.assert_current_user_is_admin();

  cleaned_status := coalesce(nullif(trim(p_review_status), ''), 'pending');

  if cleaned_status not in ('pending', 'accepted', 'edited', 'rejected', 'needs_later_review') then
    raise exception 'Unsupported proposal item review status: %', cleaned_status;
  end if;

  update public.agent_knowledge_proposal_items
  set review_status = cleaned_status,
      admin_final_body = case
        when cleaned_status = 'accepted' then null
        else nullif(coalesce(p_admin_final_body, admin_final_body), '')
      end,
      admin_note = nullif(trim(coalesce(p_admin_note, admin_note, '')), ''),
      updated_at = now()
  where id = p_item_id
  returning * into updated_item;

  if not found then
    raise exception 'Proposal item not found';
  end if;

  update public.agent_knowledge_proposals
  set reviewed_by_user_id = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = updated_item.proposal_id;

  return updated_item;
end;
$$;

create or replace function public.publish_agent_knowledge_proposal(
  p_proposal_id uuid,
  p_change_note text
)
returns public.agent_knowledge_proposals
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.agent_knowledge_proposal_items%rowtype;
  proposal public.agent_knowledge_proposals%rowtype;
  body_to_publish text;
begin
  perform public.assert_current_user_is_admin();

  if nullif(trim(p_change_note), '') is null then
    raise exception 'Change note is required';
  end if;

  select *
    into proposal
  from public.agent_knowledge_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Agent Knowledge proposal not found';
  end if;

  for item in
    select *
    from public.agent_knowledge_proposal_items
    where proposal_id = p_proposal_id
      and review_status in ('accepted', 'edited')
    order by created_at, id
  loop
    body_to_publish := case
      when item.review_status = 'edited' then coalesce(item.admin_final_body, '')
      else item.ai_proposed_body
    end;

    if nullif(body_to_publish, '') is null then
      raise exception 'Reviewed proposal item % has no publishable body', item.id;
    end if;

    perform public.save_app_content_version(
      item.content_key,
      item.content_label,
      'Support assistant Agent Knowledge managed through proposals.',
      body_to_publish,
      trim(p_change_note)
    );
  end loop;

  update public.agent_knowledge_proposals
  set status = 'published',
      published_by_user_id = auth.uid(),
      published_at = now(),
      updated_at = now()
  where id = p_proposal_id
  returning * into proposal;

  return proposal;
end;
$$;

grant execute on function public.create_agent_knowledge_proposal(text, text, text, jsonb)
  to authenticated;
grant execute on function public.review_agent_knowledge_proposal_item(uuid, text, text, text)
  to authenticated;
grant execute on function public.publish_agent_knowledge_proposal(uuid, text)
  to authenticated;
