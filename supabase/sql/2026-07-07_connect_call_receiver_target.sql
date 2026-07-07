-- Scope Connect calls to the intended Receiver device when one is selected.

alter table public.connect_calls
  add column if not exists receiver_device_id text;

comment on column public.connect_calls.receiver_device_id is
  'Provisioned Receiver device id targeted by the dashboard call. Blank/null preserves legacy person-scoped calls.';

create index if not exists connect_calls_receiver_device_idx
  on public.connect_calls (receiver_device_id, updated_at desc)
  where receiver_device_id is not null and receiver_device_id <> '';
