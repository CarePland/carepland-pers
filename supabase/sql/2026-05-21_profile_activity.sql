alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create or replace function public.touch_profile_activity()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to update profile activity';
  end if;

  update public.profiles
  set last_seen_at = now()
  where id = auth.uid()
  returning * into updated_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.touch_profile_activity()
  to authenticated;
