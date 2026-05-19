create table if not exists public.app_content_versions (
  id uuid primary key default gen_random_uuid(),
  content_key text not null,
  label text not null,
  description text,
  body text not null default '',
  version_number integer not null,
  is_current boolean not null default true,
  change_note text,
  content_hash text,
  created_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  superseded_at timestamptz,
  superseded_by_version_id uuid references public.app_content_versions(id),
  copied_from_version_id uuid references public.app_content_versions(id),
  unique (content_key, version_number)
);

create unique index if not exists app_content_versions_one_current_per_key
  on public.app_content_versions (content_key)
  where is_current;

alter table public.app_content_versions enable row level security;

drop policy if exists "Authenticated users can read current app content" on public.app_content_versions;
create policy "Authenticated users can read current app content"
  on public.app_content_versions
  for select
  to authenticated
  using (is_current);

drop policy if exists "Admins can read all app content versions" on public.app_content_versions;
create policy "Admins can read all app content versions"
  on public.app_content_versions
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

create or replace function public.assert_current_user_is_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
  ) then
    raise exception 'Admin access required';
  end if;
end;
$$;

create or replace function public.save_app_content_version(
  p_content_key text,
  p_label text,
  p_description text,
  p_body text,
  p_change_note text
)
returns public.app_content_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_version public.app_content_versions%rowtype;
  new_version public.app_content_versions%rowtype;
  next_version_number integer;
begin
  perform public.assert_current_user_is_admin();

  if nullif(trim(p_content_key), '') is null then
    raise exception 'Content key is required';
  end if;

  if nullif(trim(p_label), '') is null then
    raise exception 'Label is required';
  end if;

  if nullif(trim(p_change_note), '') is null then
    raise exception 'Change note is required';
  end if;

  select *
    into current_version
  from public.app_content_versions
  where content_key = trim(p_content_key)
    and is_current = true
  for update;

  select coalesce(max(version_number), 0) + 1
    into next_version_number
  from public.app_content_versions
  where content_key = trim(p_content_key);

  if current_version.id is not null then
    update public.app_content_versions
      set is_current = false,
          superseded_at = now()
    where id = current_version.id;
  end if;

  insert into public.app_content_versions (
    content_key,
    label,
    description,
    body,
    version_number,
    is_current,
    change_note,
    content_hash,
    created_by_user_id,
    copied_from_version_id
  )
  values (
    trim(p_content_key),
    trim(p_label),
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_body, ''),
    next_version_number,
    true,
    trim(p_change_note),
    md5(trim(p_content_key) || '|' || trim(p_label) || '|' || coalesce(p_description, '') || '|' || coalesce(p_body, '')),
    auth.uid(),
    case when current_version.id is not null then current_version.id else null end
  )
  returning * into new_version;

  if current_version.id is not null then
    update public.app_content_versions
      set superseded_by_version_id = new_version.id
    where id = current_version.id;
  end if;

  return new_version;
end;
$$;

create or replace function public.revert_app_content_version(
  p_version_id uuid,
  p_change_note text
)
returns public.app_content_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  source_version public.app_content_versions%rowtype;
begin
  perform public.assert_current_user_is_admin();

  select *
    into source_version
  from public.app_content_versions
  where id = p_version_id;

  if not found then
    raise exception 'Content version not found';
  end if;

  return public.save_app_content_version(
    source_version.content_key,
    source_version.label,
    source_version.description,
    source_version.body,
    coalesce(nullif(trim(p_change_note), ''), 'Reverted from v' || source_version.version_number)
  );
end;
$$;

grant execute on function public.assert_current_user_is_admin() to authenticated;
grant execute on function public.save_app_content_version(text, text, text, text, text) to authenticated;
grant execute on function public.revert_app_content_version(uuid, text) to authenticated;

insert into public.app_content_versions (
  content_key,
  label,
  description,
  body,
  version_number,
  is_current,
  change_note,
  content_hash
)
select seeded.content_key, seeded.label, seeded.description, seeded.body, 1, true, 'Initial dynamic content seed', md5(seeded.content_key || '|' || seeded.label || '|' || seeded.description || '|' || seeded.body)
from (
  values
    (
      'beta_notice_intro',
      'Beta testing notice intro',
      'Introductory text shown before beta acknowledgement checkboxes.',
      'CarePland Personal is currently in testing. Formal Terms of Service and Privacy Policy pages are not enabled yet.'
    ),
    (
      'beta_terms_ack',
      'Beta terms acknowledgement',
      'Checkbox text confirming Terms of Service status during beta.',
      'I understand formal Terms of Service are not currently enabled for this testing version.'
    ),
    (
      'beta_privacy_ack',
      'Beta privacy acknowledgement',
      'Checkbox text confirming Privacy Policy status during beta.',
      'I understand formal Privacy Policy review is not currently enabled for this testing version.'
    ),
    (
      'beta_disclaimer_ack',
      'Beta safety acknowledgement',
      'Checkbox text confirming beta safety limitations.',
      'I understand this beta is not for emergencies or critical medical decisions.'
    ),
    (
      'support_contact_note',
      'Support contact note',
      'General support context for beta users.',
      'Need help or want to report an issue? Contact support from the app and include what you were trying to do.'
    )
) as seeded(content_key, label, description, body)
where not exists (
  select 1
  from public.app_content_versions existing
  where existing.content_key = seeded.content_key
);
