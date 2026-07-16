alter table public.care_subjects
  add column if not exists account_user_id uuid references public.profiles(id) on delete set null;

create unique index if not exists care_subjects_account_user_id_unique
  on public.care_subjects(account_user_id)
  where account_user_id is not null;

comment on column public.care_subjects.account_user_id is
  'Optional canonical link from a real CarePland person row to the signed-in account profile that person represents. Used for Receiver self-use labeling such as (You); do not infer this from is_default.';
