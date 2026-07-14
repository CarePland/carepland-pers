-- Backfill appointment context for appointment-composer messages saved before
-- appointment_id was reliably persisted.

with appointment_message_candidates as (
  select
    cm.id as message_id,
    (
      regexp_match(
        cm.client_message_id,
        '^appointment-(?:text|audio)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})-[0-9]+$'
      )
    )[1]::uuid as appointment_id
  from public.connect_messages cm
  where cm.appointment_id is null
    and cm.client_message_id ~ '^appointment-(?:text|audio)-'
)
update public.connect_messages cm
set appointment_id = candidate.appointment_id
from appointment_message_candidates candidate,
  public.appointments appointment
where cm.id = candidate.message_id
  and appointment.id = candidate.appointment_id
  and appointment.care_circle_id = cm.care_circle_id
  and appointment.care_subject_id = cm.main_connect_user_person_id
  and appointment.deleted_at is null;
