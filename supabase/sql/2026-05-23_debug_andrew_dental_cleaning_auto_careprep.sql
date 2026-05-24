-- Debug Andrew's Dental Cleaning auto-CarePrep test state.
-- Read-only: shows note/CarePrep state and whether each future Dental Cleaning
-- appointment is currently eligible as an auto-CarePrep target.

with target_appointments as (
  select distinct
    a.id,
    a.care_circle_id,
    a.care_subject_id,
    a.title,
    a.reason,
    a.starts_at,
    a.status,
    a.current_note_id,
    a.deleted_at,
    a.provider_name,
    a.provider_organization,
    a.location_name
  from public.appointments a
  join public.care_circle_memberships m
    on m.care_circle_id = a.care_circle_id
  join public.profiles p
    on p.id = m.user_id
  where lower(coalesce(p.email, '')) = lower('andrew@goodloe.org')
    and m.status = 'active'
    and a.title ilike '%Dental Cleaning%'
),
careprep_rows as (
  select
    cg.appointment_id,
    count(*) as careprep_count,
    max(cg.generated_at) as latest_careprep_generated_at,
    string_agg(distinct coalesce(cg.review_status, 'unknown'), ', ' order by coalesce(cg.review_status, 'unknown')) as careprep_statuses
  from public.careprep_guidance cg
  where cg.appointment_id in (select id from target_appointments)
  group by cg.appointment_id
),
note_rows as (
  select
    n.appointment_id,
    count(*) as note_count,
    max(n.created_at) as latest_note_created_at,
    count(*) filter (where n.is_current = true) as current_note_count
  from public.appointment_notes n
  where n.appointment_id in (select id from target_appointments)
  group by n.appointment_id
)
select
  ta.id,
  ta.title,
  ta.starts_at,
  ta.status,
  ta.current_note_id,
  coalesce(nr.note_count, 0) as note_count,
  coalesce(nr.current_note_count, 0) as current_note_count,
  nr.latest_note_created_at,
  coalesce(cr.careprep_count, 0) as careprep_count,
  cr.careprep_statuses,
  cr.latest_careprep_generated_at,
  case
    when ta.deleted_at is not null then 'not eligible: deleted'
    when ta.status = 'archived' then 'not eligible: archived'
    when ta.current_note_id is not null then 'not eligible: has current_note_id/logged'
    when ta.starts_at is not null and ta.starts_at < date_trunc('day', now()) then 'not eligible: before today'
    else 'eligible as future target'
  end as auto_target_eligibility
from target_appointments ta
left join note_rows nr on nr.appointment_id = ta.id
left join careprep_rows cr on cr.appointment_id = ta.id
order by ta.starts_at nulls last;
