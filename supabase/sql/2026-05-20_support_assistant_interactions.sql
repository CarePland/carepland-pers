create table if not exists public.support_assistant_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_circle_id uuid references public.care_circles(id) on delete set null,
  ticket_id uuid references public.support_tickets(id) on delete set null,
  question_subject text not null,
  question_body text not null,
  assistant_answer text not null,
  suggested_next_step text not null default '',
  confidence numeric not null default 0,
  escalation_recommended boolean not null default false,
  escalation_reason text not null default '',
  category text not null default 'general',
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  outcome text not null default 'answered'
    check (outcome in ('answered', 'helpful', 'not_helpful', 'escalated')),
  user_feedback text,
  current_page text,
  context jsonb not null default '{}'::jsonb,
  instruction_version_id uuid references public.ai_instruction_versions(id) on delete set null,
  prompt_version text,
  model text,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_assistant_interactions_user_created_idx
  on public.support_assistant_interactions (user_id, created_at desc);

create index if not exists support_assistant_interactions_outcome_idx
  on public.support_assistant_interactions (outcome, created_at desc);

alter table public.support_assistant_interactions enable row level security;

grant select, insert on public.support_assistant_interactions to authenticated;

drop policy if exists "Users and admins can read support assistant interactions"
  on public.support_assistant_interactions;
create policy "Users and admins can read support assistant interactions"
  on public.support_assistant_interactions
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

drop policy if exists "Users can create their own support assistant interactions"
  on public.support_assistant_interactions;
create policy "Users can create their own support assistant interactions"
  on public.support_assistant_interactions
  for insert
  to authenticated
  with check (user_id = auth.uid());

create or replace function public.update_support_assistant_interaction(
  p_interaction_id uuid,
  p_outcome text,
  p_user_feedback text default null,
  p_ticket_id uuid default null
)
returns public.support_assistant_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_interaction public.support_assistant_interactions%rowtype;
  updated_interaction public.support_assistant_interactions%rowtype;
  caller_is_admin boolean;
  cleaned_outcome text;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to update support assistant feedback';
  end if;

  select coalesce(p.is_admin, false)
    into caller_is_admin
  from public.profiles p
  where p.id = auth.uid();

  select *
    into existing_interaction
  from public.support_assistant_interactions
  where id = p_interaction_id
  for update;

  if not found then
    raise exception 'Support assistant interaction not found';
  end if;

  if existing_interaction.user_id <> auth.uid() and coalesce(caller_is_admin, false) = false then
    raise exception 'You do not have access to this support assistant interaction';
  end if;

  cleaned_outcome := coalesce(nullif(trim(p_outcome), ''), existing_interaction.outcome);

  if cleaned_outcome not in ('answered', 'helpful', 'not_helpful', 'escalated') then
    raise exception 'Unsupported support assistant outcome: %', cleaned_outcome;
  end if;

  update public.support_assistant_interactions
  set outcome = cleaned_outcome,
      user_feedback = nullif(trim(coalesce(p_user_feedback, user_feedback, '')), ''),
      ticket_id = coalesce(p_ticket_id, ticket_id),
      updated_at = now()
  where id = existing_interaction.id
  returning * into updated_interaction;

  insert into public.support_ticket_events (
    ticket_id,
    event_type,
    old_value,
    new_value,
    actor_user_id,
    note
  )
  select
    updated_interaction.ticket_id,
    'support_assistant_feedback',
    jsonb_build_object('outcome', existing_interaction.outcome),
    jsonb_build_object(
      'interaction_id', updated_interaction.id,
      'outcome', updated_interaction.outcome,
      'user_feedback', updated_interaction.user_feedback
    ),
    auth.uid(),
    'Support assistant feedback captured'
  where updated_interaction.ticket_id is not null;

  return updated_interaction;
end;
$$;

grant execute on function public.update_support_assistant_interaction(uuid, text, text, uuid) to authenticated;
