-- Read-only verification for the Connect Main Connect User / participant model.
-- Run after 2026-06-19_connect_main_user_context.sql has been applied.
--
-- This script does not modify data. It helps confirm that Connect is backed by
-- explicit Pers-linked participant rows rather than every active Care VIP.

-- 1) Current Connect participants by care circle.
select
  cp.care_circle_id,
  count(*) as connect_participant_count,
  count(*) filter (where cp.status = 'active') as active_connect_participant_count,
  count(*) filter (where cp.created_by_user_id is null) as participants_without_creator
from public.connect_participants cp
group by cp.care_circle_id
order by active_connect_participant_count desc, cp.care_circle_id;

-- 2) Participant detail for human review.
select
  cp.care_circle_id,
  cp.person_id,
  cs.display_name,
  cs.subject_type,
  cs.is_active as care_subject_is_active,
  cp.status as connect_status,
  cp.participant_role,
  cp.created_by_user_id,
  cp.created_at
from public.connect_participants cp
left join public.care_subjects cs
  on cs.id = cp.person_id
order by cp.care_circle_id, cs.display_name nulls last, cp.created_at;

-- 3) Connect participant rows whose stored care_circle_id does not match the
-- linked Pers person. This should return zero rows because Connect access and
-- RLS are care-circle scoped.
select
  cp.care_circle_id as participant_care_circle_id,
  cs.care_circle_id as person_care_circle_id,
  cp.person_id,
  cs.display_name,
  cp.status as connect_status,
  cp.created_at
from public.connect_participants cp
left join public.care_subjects cs
  on cs.id = cp.person_id
where cs.id is null
  or cp.care_circle_id <> cs.care_circle_id
order by cp.created_at;

-- 4) Main Connect User settings that point at a missing, inactive, pet,
-- inaccessible, or non-participating Pers person. This should return zero rows.
select
  settings.user_id,
  settings.main_connect_user_person_id,
  cs.display_name,
  cs.subject_type,
  cs.is_active as care_subject_is_active,
  cp.status as connect_status,
  ccm.user_id as membership_user_id
from public.connect_settings settings
left join public.care_subjects cs
  on cs.id = settings.main_connect_user_person_id
left join public.connect_participants cp
  on cp.person_id = settings.main_connect_user_person_id
left join public.care_circle_memberships ccm
  on ccm.care_circle_id = cs.care_circle_id
  and ccm.user_id = settings.user_id
where settings.main_connect_user_person_id is not null
  and (
    cs.id is null
    or cs.is_active is not true
    or lower(trim(coalesce(cs.subject_type, ''))) in ('cat', 'dog', 'pet')
    or lower(trim(coalesce(cs.subject_type, ''))) like 'pet:%'
    or cp.id is null
    or cp.status <> 'active'
    or ccm.user_id is null
  )
order by settings.user_id;

-- 5) Active pet Care VIPs enabled as Connect participants. Pets may appear in
-- household context, but they should not be enabled as Receiver/Main Connect
-- User participants in this pass. This should return zero rows.
select
  cp.care_circle_id,
  cp.person_id,
  cs.display_name,
  cs.subject_type,
  cp.status as connect_status,
  cp.created_at
from public.connect_participants cp
join public.care_subjects cs
  on cs.id = cp.person_id
where cp.status = 'active'
  and cs.is_active is true
  and (
    lower(trim(coalesce(cs.subject_type, ''))) in ('cat', 'dog', 'pet')
    or lower(trim(coalesce(cs.subject_type, ''))) like 'pet:%'
  )
order by cp.care_circle_id, cs.display_name nulls last;

-- 6) Care circles where active Connect participants equal all active Care VIPs.
-- This does not prove a problem, but it is the easiest place to spot an
-- accidental broad backfill from an older local copy of the migration.
with active_people as (
  select
    care_circle_id,
    count(*) as active_care_subject_count
  from public.care_subjects
  where is_active is true
  group by care_circle_id
),
active_participants as (
  select
    cp.care_circle_id,
    count(*) as active_connect_participant_count
  from public.connect_participants cp
  join public.care_subjects cs
    on cs.id = cp.person_id
  where cp.status = 'active'
    and cs.is_active is true
  group by cp.care_circle_id
)
select
  active_people.care_circle_id,
  active_people.active_care_subject_count,
  coalesce(active_participants.active_connect_participant_count, 0)
    as active_connect_participant_count
from active_people
left join active_participants
  on active_participants.care_circle_id = active_people.care_circle_id
where active_people.active_care_subject_count > 0
  and active_people.active_care_subject_count =
    coalesce(active_participants.active_connect_participant_count, 0)
order by active_people.active_care_subject_count desc, active_people.care_circle_id;
