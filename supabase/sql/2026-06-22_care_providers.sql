create table if not exists public.care_providers (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  provider_name text,
  provider_organization text,
  nickname text,
  location_name text,
  location_address text,
  phone text,
  normalized_provider_name text not null default '',
  normalized_provider_organization text not null default '',
  source text not null default 'manual'
    check (source in ('manual', 'import_anything')),
  source_intake_item_id uuid references public.intake_items(id) on delete set null,
  last_seen_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    normalized_provider_name <> ''
    or normalized_provider_organization <> ''
  )
);

create unique index if not exists care_providers_subject_normalized_unique
  on public.care_providers (
    care_subject_id,
    normalized_provider_name,
    normalized_provider_organization
  );

create index if not exists care_providers_care_subject_idx
  on public.care_providers (care_subject_id, updated_at desc);

create index if not exists care_providers_care_circle_idx
  on public.care_providers (care_circle_id, updated_at desc);

alter table public.care_providers enable row level security;

grant select, insert, update on public.care_providers to authenticated;

drop policy if exists "Care circle members can read care providers"
  on public.care_providers;
create policy "Care circle members can read care providers"
  on public.care_providers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_providers.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can add care providers"
  on public.care_providers;
create policy "Care circle members can add care providers"
  on public.care_providers
  for insert
  to authenticated
  with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_providers.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = care_providers.care_subject_id
        and cs.care_circle_id = care_providers.care_circle_id
    )
  );

drop policy if exists "Care circle members can update care providers"
  on public.care_providers;
create policy "Care circle members can update care providers"
  on public.care_providers
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_providers.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = care_providers.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = care_providers.care_subject_id
        and cs.care_circle_id = care_providers.care_circle_id
    )
  );
