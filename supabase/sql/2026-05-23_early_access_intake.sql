create table if not exists public.early_access_intake (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  care_role text not null default 'unspecified'
    check (care_role in ('patient', 'caregiver', 'clinician_partner', 'other', 'unspecified')),
  interest_context text not null default '',
  communication_preference text not null default 'email'
    check (communication_preference in ('email', 'phone', 'either')),
  communication_consent boolean not null default false,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'contacted', 'interested', 'invited', 'converted', 'not_a_fit', 'closed')),
  source text not null default 'admin',
  admin_notes text not null default '',
  last_contacted_at timestamptz,
  invited_at timestamptz,
  converted_user_id uuid references auth.users(id),
  created_by_user_id uuid references auth.users(id),
  updated_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists early_access_intake_email_unique_idx
  on public.early_access_intake (lower(email));

create index if not exists early_access_intake_status_updated_idx
  on public.early_access_intake (status, updated_at desc);

alter table public.early_access_intake enable row level security;

grant select, insert, update on public.early_access_intake to authenticated;

drop policy if exists "Admins can read early access intake" on public.early_access_intake;
create policy "Admins can read early access intake"
  on public.early_access_intake
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

drop policy if exists "Admins can create early access intake" on public.early_access_intake;
create policy "Admins can create early access intake"
  on public.early_access_intake
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Admins can update early access intake" on public.early_access_intake;
create policy "Admins can update early access intake"
  on public.early_access_intake
  for update
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

create or replace function public.touch_early_access_intake_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.communication_consent is distinct from new.communication_consent then
    raise exception 'Communication consent is captured at intake and cannot be edited here';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists early_access_intake_updated_at on public.early_access_intake;
create trigger early_access_intake_updated_at
  before update on public.early_access_intake
  for each row
  execute function public.touch_early_access_intake_updated_at();
