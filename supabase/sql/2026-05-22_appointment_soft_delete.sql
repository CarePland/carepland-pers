alter table public.appointments
  add column if not exists deleted_at timestamptz;

create index if not exists appointments_deleted_at_idx
  on public.appointments (deleted_at);
