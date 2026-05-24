-- One-off test utility.
-- Removes only sample/demo data for Andrew and clears sample-data prompt flags.

begin;

create temp table _sample_target_appointments on commit drop as
select a.id
from public.appointments a
join public.care_circle_memberships m
  on m.care_circle_id = a.care_circle_id
join public.profiles p
  on p.id = m.user_id
where lower(p.email) = lower('andrew@goodloe.org')
  and a.is_sample_data = true;

update public.appointments
set current_note_id = null
where id in (select id from _sample_target_appointments);

delete from public.careprep_guidance
where is_sample_data = true
  and appointment_id in (select id from _sample_target_appointments);

delete from public.appointment_notes
where is_sample_data = true
  and appointment_id in (select id from _sample_target_appointments);

update public.intake_items
set appointment_id = null,
    suggested_appointment_id = null
where appointment_id in (select id from _sample_target_appointments)
   or suggested_appointment_id in (select id from _sample_target_appointments);

delete from public.appointments
where id in (select id from _sample_target_appointments);

update public.profiles
set sample_data_seeded_at = null,
    sample_data_declined_at = null,
    sample_data_seed_version = null,
    sample_data_seeded_by_user_id = null
where lower(email) = lower('andrew@goodloe.org');

commit;
