create or replace function public.remove_demo_data_for_current_user()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  target_care_circle_id uuid;
  removed_count integer := 0;
begin
  if caller_user_id is null then
    raise exception 'Must be signed in to remove demo data';
  end if;

  select care_circle_id
    into target_care_circle_id
  from public.care_circle_memberships
  where user_id = caller_user_id
    and status = 'active'
  order by case when role = 'owner' then 0 else 1 end, created_at
  limit 1;

  if target_care_circle_id is null then
    return jsonb_build_object('status', 'missing_care_circle');
  end if;

  create temp table _demo_target_appointments on commit drop as
  select a.id
  from public.appointments a
  where a.care_circle_id = target_care_circle_id
    and a.is_sample_data = true;

  select count(*)
    into removed_count
  from _demo_target_appointments;

  update public.appointments
    set current_note_id = null
  where id in (select id from _demo_target_appointments);

  delete from public.careprep_guidance
  where is_sample_data = true
    and appointment_id in (select id from _demo_target_appointments);

  delete from public.appointment_notes
  where is_sample_data = true
    and appointment_id in (select id from _demo_target_appointments);

  delete from public.appointments
  where id in (select id from _demo_target_appointments);

  update public.profiles
    set sample_data_seeded_at = null,
        sample_data_declined_at = null,
        sample_data_seed_version = null,
        sample_data_seeded_by_user_id = null
  where id = caller_user_id;

  return jsonb_build_object(
    'status', 'removed',
    'appointments_removed', removed_count
  );
end;
$$;

grant execute on function public.remove_demo_data_for_current_user() to authenticated;
