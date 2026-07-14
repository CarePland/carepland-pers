-- Add optional appointment context to durable CarePland messages.
--
-- Messages remain person-scoped. Appointment context is nullable so existing
-- general messages remain valid and one durable message can be surfaced from
-- Home, Messages, and appointment history without copying content.

alter table public.connect_messages
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

comment on column public.connect_messages.appointment_id is
  'Optional appointment this person-scoped message relates to. Null means a general message for the Care VIP.';

create index if not exists connect_messages_appointment_created_idx
  on public.connect_messages (appointment_id, created_at desc)
  where appointment_id is not null;

create index if not exists connect_messages_person_appointment_created_idx
  on public.connect_messages (main_connect_user_person_id, appointment_id, created_at desc);

drop policy if exists connect_messages_member_insert on public.connect_messages;
create policy connect_messages_member_insert
on public.connect_messages
for insert
with check (
  exists (
    select 1
    from public.care_circle_memberships ccm
    join public.connect_participants cp
      on cp.care_circle_id = ccm.care_circle_id
      and cp.person_id = connect_messages.main_connect_user_person_id
      and cp.status = 'active'
    where ccm.care_circle_id = connect_messages.care_circle_id
      and ccm.user_id = auth.uid()
  )
  and (
    connect_messages.appointment_id is null
    or exists (
      select 1
      from public.appointments a
      where a.id = connect_messages.appointment_id
        and a.care_circle_id = connect_messages.care_circle_id
        and a.care_subject_id = connect_messages.main_connect_user_person_id
        and a.deleted_at is null
    )
  )
);
