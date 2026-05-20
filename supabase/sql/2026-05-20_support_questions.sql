create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_circle_id uuid references public.care_circles(id) on delete set null,
  subject text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  category text not null default 'general',
  source text not null default 'in_app',
  current_page text,
  context jsonb not null default '{}'::jsonb,
  needs_admin_followup boolean not null default true,
  user_has_unread_update boolean not null default false,
  latest_user_message_at timestamptz,
  latest_admin_message_at timestamptz,
  resolved_by_user_id uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_role text not null
    check (author_role in ('user', 'admin', 'system')),
  message_body text not null,
  is_internal boolean not null default false,
  email_notification_status text not null default 'not_queued'
    check (email_notification_status in ('not_queued', 'queued', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  event_type text not null,
  old_value jsonb,
  new_value jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.support_ticket_links (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  link_type text not null default 'related',
  linked_table text not null,
  linked_id uuid,
  label text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_status_idx
  on public.support_tickets (user_id, status, updated_at desc);

create index if not exists support_tickets_admin_followup_idx
  on public.support_tickets (needs_admin_followup, status, updated_at desc);

create index if not exists support_ticket_messages_ticket_created_idx
  on public.support_ticket_messages (ticket_id, created_at);

create index if not exists support_ticket_events_ticket_created_idx
  on public.support_ticket_events (ticket_id, created_at desc);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_events enable row level security;
alter table public.support_ticket_links enable row level security;

grant select on public.support_tickets to authenticated;
grant select on public.support_ticket_messages to authenticated;
grant select on public.support_ticket_events to authenticated;
grant select on public.support_ticket_links to authenticated;

drop policy if exists "Users and admins can read support tickets" on public.support_tickets;
create policy "Users and admins can read support tickets"
  on public.support_tickets
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Users and admins can read support ticket messages" on public.support_ticket_messages;
create policy "Users and admins can read support ticket messages"
  on public.support_ticket_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.support_tickets t
      where t.id = ticket_id
        and t.user_id = auth.uid()
        and is_internal = false
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Admins can read support ticket events" on public.support_ticket_events;
create policy "Admins can read support ticket events"
  on public.support_ticket_events
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

drop policy if exists "Admins can read support ticket links" on public.support_ticket_links;
create policy "Admins can read support ticket links"
  on public.support_ticket_links
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

create or replace function public.create_support_question(
  p_subject text,
  p_message text,
  p_current_page text default null,
  p_context jsonb default '{}'::jsonb
)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  new_ticket public.support_tickets%rowtype;
  active_care_circle_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to ask a question';
  end if;

  if nullif(trim(p_subject), '') is null then
    raise exception 'Question subject is required';
  end if;

  if nullif(trim(p_message), '') is null then
    raise exception 'Question details are required';
  end if;

  select ccm.care_circle_id
    into active_care_circle_id
  from public.care_circle_memberships ccm
  where ccm.user_id = auth.uid()
    and ccm.status = 'active'
  order by ccm.created_at asc
  limit 1;

  insert into public.support_tickets (
    user_id,
    care_circle_id,
    subject,
    current_page,
    context,
    latest_user_message_at
  )
  values (
    auth.uid(),
    active_care_circle_id,
    trim(p_subject),
    nullif(trim(coalesce(p_current_page, '')), ''),
    coalesce(p_context, '{}'::jsonb),
    now()
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
    auth.uid(),
    'user',
    trim(p_message)
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
    'question_created',
    jsonb_build_object('subject', new_ticket.subject, 'status', new_ticket.status),
    auth.uid(),
    'User asked a support question'
  );

  return new_ticket;
end;
$$;

create or replace function public.add_support_ticket_message(
  p_ticket_id uuid,
  p_message text,
  p_is_internal boolean default false
)
returns public.support_ticket_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_ticket public.support_tickets%rowtype;
  is_admin boolean;
  new_message public.support_ticket_messages%rowtype;
  message_role text;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to reply';
  end if;

  if nullif(trim(p_message), '') is null then
    raise exception 'Reply text is required';
  end if;

  select coalesce(p.is_admin, false)
    into is_admin
  from public.profiles p
  where p.id = auth.uid();

  select *
    into existing_ticket
  from public.support_tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Support question not found';
  end if;

  if existing_ticket.user_id <> auth.uid() and coalesce(is_admin, false) = false then
    raise exception 'You do not have access to this support question';
  end if;

  if coalesce(p_is_internal, false) = true and coalesce(is_admin, false) = false then
    raise exception 'Only admins can add internal notes';
  end if;

  message_role := case when coalesce(is_admin, false) then 'admin' else 'user' end;

  insert into public.support_ticket_messages (
    ticket_id,
    author_user_id,
    author_role,
    message_body,
    is_internal
  )
  values (
    existing_ticket.id,
    auth.uid(),
    message_role,
    trim(p_message),
    coalesce(p_is_internal, false)
  )
  returning * into new_message;

  update public.support_tickets
    set status = case
          when coalesce(p_is_internal, false) then status
          when message_role = 'admin' and status in ('open', 'in_progress') then 'waiting_on_user'
          when message_role = 'user' and status in ('waiting_on_user', 'resolved') then 'open'
          else status
        end,
        needs_admin_followup = case
          when coalesce(p_is_internal, false) then needs_admin_followup
          when message_role = 'admin' then false
          else true
        end,
        user_has_unread_update = case
          when coalesce(p_is_internal, false) then user_has_unread_update
          when message_role = 'admin' then true
          else false
        end,
        latest_admin_message_at = case
          when message_role = 'admin' and coalesce(p_is_internal, false) = false then now()
          else latest_admin_message_at
        end,
        latest_user_message_at = case
          when message_role = 'user' then now()
          else latest_user_message_at
        end,
        resolved_by_user_id = case when message_role = 'user' then null else resolved_by_user_id end,
        resolved_at = case when message_role = 'user' then null else resolved_at end,
        updated_at = now()
  where id = existing_ticket.id;

  insert into public.support_ticket_events (
    ticket_id,
    event_type,
    new_value,
    actor_user_id,
    note
  )
  values (
    existing_ticket.id,
    case when coalesce(p_is_internal, false) then 'internal_note_added' else 'message_added' end,
    jsonb_build_object('message_id', new_message.id, 'author_role', new_message.author_role),
    auth.uid(),
    case when coalesce(p_is_internal, false) then 'Internal note added' else 'Support reply added' end
  );

  return new_message;
end;
$$;

create or replace function public.update_support_ticket_status(
  p_ticket_id uuid,
  p_status text,
  p_priority text default null,
  p_category text default null,
  p_needs_admin_followup boolean default null,
  p_note text default null
)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_ticket public.support_tickets%rowtype;
  updated_ticket public.support_tickets%rowtype;
  cleaned_status text;
  cleaned_priority text;
begin
  perform public.assert_current_user_is_admin();

  select *
    into existing_ticket
  from public.support_tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'Support question not found';
  end if;

  cleaned_status := coalesce(nullif(trim(p_status), ''), existing_ticket.status);
  cleaned_priority := coalesce(nullif(trim(coalesce(p_priority, '')), ''), existing_ticket.priority);

  if cleaned_status not in ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed') then
    raise exception 'Unsupported support status: %', cleaned_status;
  end if;

  if cleaned_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Unsupported support priority: %', cleaned_priority;
  end if;

  update public.support_tickets
    set status = cleaned_status,
        priority = cleaned_priority,
        category = coalesce(nullif(trim(coalesce(p_category, '')), ''), category),
        needs_admin_followup = coalesce(p_needs_admin_followup, needs_admin_followup),
        resolved_by_user_id = case when cleaned_status in ('resolved', 'closed') then auth.uid() else null end,
        resolved_at = case when cleaned_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end,
        updated_at = now()
  where id = existing_ticket.id
  returning * into updated_ticket;

  insert into public.support_ticket_events (
    ticket_id,
    event_type,
    old_value,
    new_value,
    actor_user_id,
    note
  )
  values (
    existing_ticket.id,
    'ticket_updated',
    jsonb_build_object(
      'status', existing_ticket.status,
      'priority', existing_ticket.priority,
      'category', existing_ticket.category,
      'needs_admin_followup', existing_ticket.needs_admin_followup
    ),
    jsonb_build_object(
      'status', updated_ticket.status,
      'priority', updated_ticket.priority,
      'category', updated_ticket.category,
      'needs_admin_followup', updated_ticket.needs_admin_followup
    ),
    auth.uid(),
    nullif(trim(coalesce(p_note, '')), '')
  );

  return updated_ticket;
end;
$$;

create or replace function public.mark_support_ticket_seen(
  p_ticket_id uuid
)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_ticket public.support_tickets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;

  update public.support_tickets
    set user_has_unread_update = false,
        updated_at = now()
  where id = p_ticket_id
    and user_id = auth.uid()
  returning * into updated_ticket;

  if not found then
    raise exception 'Support question not found';
  end if;

  insert into public.support_ticket_events (
    ticket_id,
    event_type,
    actor_user_id,
    note
  )
  values (
    updated_ticket.id,
    'user_viewed_update',
    auth.uid(),
    'User viewed support question update'
  );

  return updated_ticket;
end;
$$;

grant execute on function public.create_support_question(text, text, text, jsonb) to authenticated;
grant execute on function public.add_support_ticket_message(uuid, text, boolean) to authenticated;
grant execute on function public.update_support_ticket_status(uuid, text, text, text, boolean, text) to authenticated;
grant execute on function public.mark_support_ticket_seen(uuid) to authenticated;
