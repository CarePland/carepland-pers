-- Remove only demo support tickets created by
-- 2026-05-20_seed_demo_support_tickets.sql.
--
-- Before running: change target_email below if needed.

do $$
declare
  target_email text := 'andrew@goodloe.org';
  target_user_id uuid;
  deleted_count integer;
begin
  select p.id
    into target_user_id
  from public.profiles p
  where lower(p.email) = lower(target_email)
  limit 1;

  if target_user_id is null then
    raise exception 'No profile found for %', target_email;
  end if;

  with deleted as (
    delete from public.support_tickets
    where user_id = target_user_id
      and context ->> 'demo_support_ticket' = 'true'
    returning id
  )
  select count(*)
    into deleted_count
  from deleted;

  raise notice 'Removed % demo support ticket(s) for %', deleted_count, target_email;
end $$;
