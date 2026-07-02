-- Adds a person-level flag for Care VIPs who are primarily managed by the
-- household/caregiver rather than self-managed.

alter table public.care_subjects
  add column if not exists managed_by_household boolean not null default false;

comment on column public.care_subjects.managed_by_household is
  'True when this Care VIP is primarily managed by the account household/caregiver. Pets are treated as managed by household.';

update public.care_subjects
set managed_by_household = true
where lower(coalesce(subject_type, '')) in ('cat', 'dog', 'pet')
   or lower(coalesce(subject_type, '')) like 'pet:%';
