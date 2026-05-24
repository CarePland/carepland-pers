-- Targeted test reset for Andrew's Dental Cleaning appointments.
-- This clears Visit Notes and CarePrep only; appointments remain in place.
-- Review the preview first. If it looks right, run the transaction below.

select
  a.id,
  a.title,
  a.starts_at,
  a.current_note_id,
  count(distinct n.id) as note_count,
  count(distinct cg.id) as careprep_count
from public.appointments a
join public.care_circle_memberships m
  on m.care_circle_id = a.care_circle_id
join public.profiles p
  on p.id = m.user_id
left join public.appointment_notes n
  on n.appointment_id = a.id
left join public.careprep_guidance cg
  on cg.appointment_id = a.id
where lower(coalesce(p.email, '')) = lower('andrew@goodloe.org')
  and m.status = 'active'
  and a.title ilike '%Dental Cleaning%'
group by a.id, a.title, a.starts_at, a.current_note_id
order by a.starts_at nulls last, a.created_at;

begin;

create temp table _andrew_dental_cleaning_appointments on commit drop as
select distinct a.id
from public.appointments a
join public.care_circle_memberships m
  on m.care_circle_id = a.care_circle_id
join public.profiles p
  on p.id = m.user_id
where lower(coalesce(p.email, '')) = lower('andrew@goodloe.org')
  and m.status = 'active'
  and a.title ilike '%Dental Cleaning%';

update public.appointments
set current_note_id = null,
    updated_at = now()
where id in (select id from _andrew_dental_cleaning_appointments);

delete from public.careprep_guidance
where appointment_id in (select id from _andrew_dental_cleaning_appointments);

delete from public.appointment_notes
where appointment_id in (select id from _andrew_dental_cleaning_appointments);

select
  (select count(*) from _andrew_dental_cleaning_appointments) as appointments_reset;

commit;
