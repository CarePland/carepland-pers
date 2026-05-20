create table if not exists public.product_mgmt_areas (
  id uuid primary key default gen_random_uuid(),
  area_key text not null unique,
  label text not null,
  description text,
  display_order integer not null default 100,
  is_active boolean not null default true,
  current_version_number integer not null default 1,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_mgmt_area_versions (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.product_mgmt_areas(id) on delete cascade,
  area_key text not null,
  label text not null,
  description text,
  display_order integer not null,
  is_active boolean not null,
  version_number integer not null,
  change_note text not null,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (area_id, version_number)
);

create table if not exists public.product_mgmt_items (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.product_mgmt_areas(id),
  title text not null,
  body text not null default '',
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'deferred')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  current_version_number integer not null default 1,
  created_by_user_id uuid references auth.users(id),
  updated_by_user_id uuid references auth.users(id),
  resolved_by_user_id uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_mgmt_item_versions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.product_mgmt_items(id) on delete cascade,
  area_id uuid not null references public.product_mgmt_areas(id),
  title text not null,
  body text not null default '',
  status text not null
    check (status in ('open', 'in_progress', 'resolved', 'deferred')),
  priority text not null
    check (priority in ('low', 'medium', 'high')),
  version_number integer not null,
  change_note text not null,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (item_id, version_number)
);

create index if not exists product_mgmt_areas_order_idx
  on public.product_mgmt_areas (is_active, display_order, label);

create index if not exists product_mgmt_items_area_status_idx
  on public.product_mgmt_items (area_id, status, updated_at desc);

alter table public.product_mgmt_areas enable row level security;
alter table public.product_mgmt_area_versions enable row level security;
alter table public.product_mgmt_items enable row level security;
alter table public.product_mgmt_item_versions enable row level security;

grant select on public.product_mgmt_areas to authenticated;
grant select on public.product_mgmt_area_versions to authenticated;
grant select on public.product_mgmt_items to authenticated;
grant select on public.product_mgmt_item_versions to authenticated;

drop policy if exists "Admins can read product management areas" on public.product_mgmt_areas;
create policy "Admins can read product management areas"
  on public.product_mgmt_areas
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

drop policy if exists "Admins can read product management area versions" on public.product_mgmt_area_versions;
create policy "Admins can read product management area versions"
  on public.product_mgmt_area_versions
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

drop policy if exists "Admins can read product management items" on public.product_mgmt_items;
create policy "Admins can read product management items"
  on public.product_mgmt_items
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

drop policy if exists "Admins can read product management item versions" on public.product_mgmt_item_versions;
create policy "Admins can read product management item versions"
  on public.product_mgmt_item_versions
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

create or replace function public.create_product_mgmt_area(
  p_area_key text,
  p_label text,
  p_description text,
  p_display_order integer default 100
)
returns public.product_mgmt_areas
language plpgsql
security definer
set search_path = public
as $$
declare
  new_area public.product_mgmt_areas%rowtype;
  next_version_number integer;
begin
  perform public.assert_current_user_is_admin();

  if nullif(trim(p_area_key), '') is null then
    raise exception 'Area key is required';
  end if;

  if nullif(trim(p_label), '') is null then
    raise exception 'Label is required';
  end if;

  insert into public.product_mgmt_areas (
    area_key,
    label,
    description,
    display_order,
    created_by_user_id,
    updated_at
  )
  values (
    lower(regexp_replace(trim(p_area_key), '[^a-zA-Z0-9]+', '_', 'g')),
    trim(p_label),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_display_order, 100),
    auth.uid(),
    now()
  )
  on conflict (area_key) do update
    set label = excluded.label,
        description = excluded.description,
        display_order = excluded.display_order,
        is_active = true,
        current_version_number = public.product_mgmt_areas.current_version_number + 1,
        updated_at = now()
  returning * into new_area;

  select coalesce(max(version_number), 0) + 1
    into next_version_number
  from public.product_mgmt_area_versions
  where area_id = new_area.id;

  if new_area.current_version_number <> next_version_number then
    update public.product_mgmt_areas
      set current_version_number = next_version_number
    where id = new_area.id
    returning * into new_area;
  end if;

  insert into public.product_mgmt_area_versions (
    area_id,
    area_key,
    label,
    description,
    display_order,
    is_active,
    version_number,
    change_note,
    created_by_user_id
  )
  values (
    new_area.id,
    new_area.area_key,
    new_area.label,
    new_area.description,
    new_area.display_order,
    new_area.is_active,
    new_area.current_version_number,
    'Lane created or updated',
    auth.uid()
  );

  return new_area;
end;
$$;

create or replace function public.create_product_mgmt_item(
  p_area_id uuid,
  p_title text,
  p_body text,
  p_priority text default 'medium',
  p_status text default 'open',
  p_change_note text default 'Initial entry'
)
returns public.product_mgmt_items
language plpgsql
security definer
set search_path = public
as $$
declare
  new_item public.product_mgmt_items%rowtype;
  cleaned_priority text;
  cleaned_status text;
begin
  perform public.assert_current_user_is_admin();

  if not exists (
    select 1 from public.product_mgmt_areas where id = p_area_id and is_active = true
  ) then
    raise exception 'Product management area not found';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Title is required';
  end if;

  cleaned_priority := coalesce(nullif(trim(p_priority), ''), 'medium');
  cleaned_status := coalesce(nullif(trim(p_status), ''), 'open');

  insert into public.product_mgmt_items (
    area_id,
    title,
    body,
    status,
    priority,
    current_version_number,
    created_by_user_id,
    updated_by_user_id
  )
  values (
    p_area_id,
    trim(p_title),
    coalesce(p_body, ''),
    cleaned_status,
    cleaned_priority,
    1,
    auth.uid(),
    auth.uid()
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
    created_by_user_id
  )
  values (
    new_item.id,
    new_item.area_id,
    new_item.title,
    new_item.body,
    new_item.status,
    new_item.priority,
    1,
    coalesce(nullif(trim(p_change_note), ''), 'Initial entry'),
    auth.uid()
  );

  return new_item;
end;
$$;

create or replace function public.retire_product_mgmt_area(
  p_area_id uuid
)
returns public.product_mgmt_areas
language plpgsql
security definer
set search_path = public
as $$
declare
  retired_area public.product_mgmt_areas%rowtype;
  next_version_number integer;
begin
  perform public.assert_current_user_is_admin();

  if not exists (
    select 1 from public.product_mgmt_areas where id = p_area_id
  ) then
    raise exception 'Product management area not found';
  end if;

  update public.product_mgmt_areas
    set is_active = false,
        current_version_number = current_version_number + 1,
        updated_at = now()
  where id = p_area_id
  returning * into retired_area;

  select coalesce(max(version_number), 0) + 1
    into next_version_number
  from public.product_mgmt_area_versions
  where area_id = retired_area.id;

  if retired_area.current_version_number <> next_version_number then
    update public.product_mgmt_areas
      set current_version_number = next_version_number
    where id = retired_area.id
    returning * into retired_area;
  end if;

  insert into public.product_mgmt_area_versions (
    area_id,
    area_key,
    label,
    description,
    display_order,
    is_active,
    version_number,
    change_note,
    created_by_user_id
  )
  values (
    retired_area.id,
    retired_area.area_key,
    retired_area.label,
    retired_area.description,
    retired_area.display_order,
    retired_area.is_active,
    retired_area.current_version_number,
    'Lane retired',
    auth.uid()
  );

  return retired_area;
end;
$$;

create or replace function public.update_product_mgmt_item(
  p_item_id uuid,
  p_area_id uuid,
  p_title text,
  p_body text,
  p_priority text,
  p_status text,
  p_change_note text
)
returns public.product_mgmt_items
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_item public.product_mgmt_items%rowtype;
  updated_item public.product_mgmt_items%rowtype;
  next_version_number integer;
  cleaned_priority text;
  cleaned_status text;
begin
  perform public.assert_current_user_is_admin();

  select *
    into existing_item
  from public.product_mgmt_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Product management item not found';
  end if;

  if not exists (
    select 1 from public.product_mgmt_areas where id = p_area_id and is_active = true
  ) then
    raise exception 'Product management area not found';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Title is required';
  end if;

  if nullif(trim(p_change_note), '') is null then
    raise exception 'Change note is required';
  end if;

  cleaned_priority := coalesce(nullif(trim(p_priority), ''), 'medium');
  cleaned_status := coalesce(nullif(trim(p_status), ''), 'open');
  next_version_number := existing_item.current_version_number + 1;

  update public.product_mgmt_items
    set area_id = p_area_id,
        title = trim(p_title),
        body = coalesce(p_body, ''),
        priority = cleaned_priority,
        status = cleaned_status,
        current_version_number = next_version_number,
        updated_by_user_id = auth.uid(),
        updated_at = now(),
        resolved_by_user_id = case when cleaned_status = 'resolved' then auth.uid() else null end,
        resolved_at = case when cleaned_status = 'resolved' then coalesce(existing_item.resolved_at, now()) else null end
  where id = p_item_id
  returning * into updated_item;

  insert into public.product_mgmt_item_versions (
    item_id,
    area_id,
    title,
    body,
    status,
    priority,
    version_number,
    change_note,
    created_by_user_id
  )
  values (
    updated_item.id,
    updated_item.area_id,
    updated_item.title,
    updated_item.body,
    updated_item.status,
    updated_item.priority,
    updated_item.current_version_number,
    trim(p_change_note),
    auth.uid()
  );

  return updated_item;
end;
$$;

create or replace function public.resolve_product_mgmt_item(
  p_item_id uuid,
  p_change_note text default 'Marked resolved'
)
returns public.product_mgmt_items
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_item public.product_mgmt_items%rowtype;
begin
  perform public.assert_current_user_is_admin();

  select *
    into existing_item
  from public.product_mgmt_items
  where id = p_item_id;

  if not found then
    raise exception 'Product management item not found';
  end if;

  return public.update_product_mgmt_item(
    existing_item.id,
    existing_item.area_id,
    existing_item.title,
    existing_item.body,
    existing_item.priority,
    'resolved',
    coalesce(nullif(trim(p_change_note), ''), 'Marked resolved')
  );
end;
$$;

grant execute on function public.create_product_mgmt_area(text, text, text, integer) to authenticated;
grant execute on function public.retire_product_mgmt_area(uuid) to authenticated;
grant execute on function public.create_product_mgmt_item(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.update_product_mgmt_item(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.resolve_product_mgmt_item(uuid, text) to authenticated;

insert into public.product_mgmt_areas (
  area_key,
  label,
  description,
  display_order
)
select seeded.area_key, seeded.label, seeded.description, seeded.display_order
from (
  values
    ('bug', 'Bugs', 'Regressions, confusing behavior, and things that should be verified as fixed.', 10),
    ('beta', 'Beta Readiness', 'Must-have items before inviting beta testers over Memorial Day weekend.', 20),
    ('release', 'Release Notes', 'Visible changes, deployment notes, and known limitations.', 30),
    ('wishlist', 'Wishlist', 'Useful ideas that should not interrupt the current beta path.', 40),
    ('ai_qa', 'AI / QA', 'AI interpretation quality, prompt behavior, and review tooling.', 50),
    ('admin_ops', 'Admin / Ops', 'Maintenance tools, test data, error visibility, and support workflows.', 60)
) as seeded(area_key, label, description, display_order)
where not exists (
  select 1
  from public.product_mgmt_areas existing
  where existing.area_key = seeded.area_key
);

insert into public.product_mgmt_area_versions (
  area_id,
  area_key,
  label,
  description,
  display_order,
  is_active,
  version_number,
  change_note
)
select
  area.id,
  area.area_key,
  area.label,
  area.description,
  area.display_order,
  area.is_active,
  1,
  'Initial product management lane seed'
from public.product_mgmt_areas area
where not exists (
  select 1
  from public.product_mgmt_area_versions existing
  where existing.area_id = area.id
    and existing.version_number = 1
);
