create table if not exists public.support_assistant_admin_reviews (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null references public.support_assistant_interactions(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'good_answer', 'needs_prompt_work', 'needs_ui_work', 'should_escalate', 'not_actionable')),
  admin_note text not null default '',
  recommended_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_assistant_admin_reviews_interaction_idx
  on public.support_assistant_admin_reviews (interaction_id, created_at desc);

create index if not exists support_assistant_admin_reviews_status_idx
  on public.support_assistant_admin_reviews (review_status, created_at desc);

alter table public.support_assistant_admin_reviews enable row level security;

grant select on public.support_assistant_admin_reviews to authenticated;

drop policy if exists "Admins can read support assistant admin reviews"
  on public.support_assistant_admin_reviews;
create policy "Admins can read support assistant admin reviews"
  on public.support_assistant_admin_reviews
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

create or replace function public.create_support_assistant_admin_review(
  p_interaction_id uuid,
  p_review_status text,
  p_admin_note text,
  p_recommended_action text default null
)
returns public.support_assistant_admin_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_is_admin boolean;
  cleaned_status text;
  new_review public.support_assistant_admin_reviews%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to review assistant answers';
  end if;

  select coalesce(p.is_admin, false)
    into caller_is_admin
  from public.profiles p
  where p.id = auth.uid();

  if coalesce(caller_is_admin, false) = false then
    raise exception 'Admin access is required to review assistant answers';
  end if;

  if not exists (
    select 1
    from public.support_assistant_interactions sai
    where sai.id = p_interaction_id
  ) then
    raise exception 'Support assistant interaction not found';
  end if;

  cleaned_status := coalesce(nullif(trim(p_review_status), ''), 'needs_review');

  if cleaned_status not in ('needs_review', 'good_answer', 'needs_prompt_work', 'needs_ui_work', 'should_escalate', 'not_actionable') then
    raise exception 'Unsupported assistant review status: %', cleaned_status;
  end if;

  insert into public.support_assistant_admin_reviews (
    interaction_id,
    reviewer_user_id,
    review_status,
    admin_note,
    recommended_action
  ) values (
    p_interaction_id,
    auth.uid(),
    cleaned_status,
    trim(coalesce(p_admin_note, '')),
    nullif(trim(coalesce(p_recommended_action, '')), '')
  )
  returning * into new_review;

  return new_review;
end;
$$;

grant execute on function public.create_support_assistant_admin_review(uuid, text, text, text)
  to authenticated;
