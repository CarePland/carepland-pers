-- Profile pet species can be Cat, Dog, generic Pet, or a user-entered
-- "Other" species stored as pet:<label>. The previous enum rejected the
-- newer pet-specific values before the Profile UI could save them.

alter table public.care_subjects
  alter column subject_type drop default;

alter table public.care_subjects
  alter column subject_type type text using subject_type::text;

alter table public.care_subjects
  alter column subject_type set default 'other';

alter table public.care_subjects
  drop constraint if exists care_subjects_subject_type_known;

alter table public.care_subjects
  add constraint care_subjects_subject_type_known
  check (
    subject_type is null
    or subject_type in ('person', 'other', 'cat', 'dog', 'pet')
    or subject_type like 'pet:%'
  );
