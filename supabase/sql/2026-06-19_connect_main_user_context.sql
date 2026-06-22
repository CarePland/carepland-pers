-- Connect settings/context model.
-- Main Connect User is an existing CarePland Pers person (`care_subjects.id`).
-- This deliberately avoids Connect-only people, guest users, and external invitees.

create table if not exists public.connect_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  main_connect_user_person_id uuid references public.care_subjects(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.connect_settings.user_id is
  'Signed-in CarePland account whose Connect context is being stored.';

comment on column public.connect_settings.main_connect_user_person_id is
  'CarePland Pers person/Care VIP in the signed-in user''s collection whose Connect world is currently active.';

create table if not exists public.connect_participants (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null,
  person_id uuid not null references public.care_subjects(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'inactive')),
  participant_role text not null default 'receiver' check (participant_role in ('receiver')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id)
);

comment on table public.connect_participants is
  'Pers-backed people who are enabled for CarePland Connect. This intentionally excludes Connect-only people for now.';

comment on column public.connect_participants.person_id is
  'Existing CarePland Pers person/Care VIP enabled for Connect.';

-- Do not backfill every active care_subject into Connect.
-- Connect eligibility is intentionally narrower than "all Care VIPs"; rows in
-- connect_participants should be created only by explicit provisioning/admin
-- enablement until a participant-management UI exists.

alter table public.connect_settings enable row level security;
alter table public.connect_participants enable row level security;

drop policy if exists connect_settings_owner_select on public.connect_settings;
create policy connect_settings_owner_select
on public.connect_settings
for select
using (user_id = auth.uid());

drop policy if exists connect_settings_owner_write on public.connect_settings;
create policy connect_settings_owner_write
on public.connect_settings
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists connect_participants_member_select on public.connect_participants;
create policy connect_participants_member_select
on public.connect_participants
for select
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_participants.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

-- TODO(connect-participants): add participant management UI and richer roles
-- once Connect supports multi-recipient, Connect-only, or external participants.
