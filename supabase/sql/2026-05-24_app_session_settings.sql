create table if not exists public.app_session_settings (
  settings_key text primary key default 'default'
    check (settings_key = 'default'),
  user_idle_timeout_hours integer
    check (
      user_idle_timeout_hours is null
      or user_idle_timeout_hours between 1 and 8760
    ),
  admin_idle_timeout_hours integer
    check (
      admin_idle_timeout_hours is null
      or admin_idle_timeout_hours between 1 and 8760
    ),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_session_settings
  add column if not exists user_idle_timeout_hours integer
    check (
      user_idle_timeout_hours is null
      or user_idle_timeout_hours between 1 and 8760
    ),
  add column if not exists admin_idle_timeout_hours integer
    check (
      admin_idle_timeout_hours is null
      or admin_idle_timeout_hours between 1 and 8760
    ),
  add column if not exists updated_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.app_session_settings enable row level security;

grant select on public.app_session_settings to authenticated;

drop policy if exists "Authenticated users can read app session settings"
  on public.app_session_settings;
create policy "Authenticated users can read app session settings"
  on public.app_session_settings
  for select
  to authenticated
  using (true);

insert into public.app_session_settings (
  settings_key,
  user_idle_timeout_hours,
  admin_idle_timeout_hours
)
values ('default', 24, null)
on conflict (settings_key) do nothing;

create or replace function public.update_app_session_settings(
  p_user_idle_timeout_hours integer,
  p_admin_idle_timeout_hours integer
)
returns public.app_session_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_settings public.app_session_settings%rowtype;
begin
  perform public.assert_current_user_is_admin();

  if p_user_idle_timeout_hours is not null
    and (p_user_idle_timeout_hours < 1 or p_user_idle_timeout_hours > 8760)
  then
    raise exception 'User idle timeout must be blank or between 1 and 8760 hours';
  end if;

  if p_admin_idle_timeout_hours is not null
    and (p_admin_idle_timeout_hours < 1 or p_admin_idle_timeout_hours > 8760)
  then
    raise exception 'Admin idle timeout must be blank or between 1 and 8760 hours';
  end if;

  insert into public.app_session_settings (
    settings_key,
    user_idle_timeout_hours,
    admin_idle_timeout_hours,
    updated_by_user_id,
    updated_at
  )
  values (
    'default',
    p_user_idle_timeout_hours,
    p_admin_idle_timeout_hours,
    auth.uid(),
    now()
  )
  on conflict (settings_key) do update
  set user_idle_timeout_hours = excluded.user_idle_timeout_hours,
      admin_idle_timeout_hours = excluded.admin_idle_timeout_hours,
      updated_by_user_id = excluded.updated_by_user_id,
      updated_at = excluded.updated_at
  returning * into updated_settings;

  return updated_settings;
end;
$$;

grant execute on function public.update_app_session_settings(integer, integer)
  to authenticated;
