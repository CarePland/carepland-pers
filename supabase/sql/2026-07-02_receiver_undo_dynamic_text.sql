insert into public.app_content_versions (
  content_key,
  label,
  description,
  body,
  version_number,
  is_current,
  change_note,
  content_hash
)
select
  seeded.content_key,
  seeded.label,
  seeded.description,
  seeded.body,
  1,
  true,
  'Initial Receiver undo duration setting.',
  md5(seeded.content_key || '|' || seeded.label || '|' || seeded.description || '|' || seeded.body)
from (
  values
    (
      'connect_receiver_undo_seconds',
      'Receiver undo seconds',
      'Number of seconds the Receiver shows Undo after a reversible action. Enter a number, such as 10.',
      '10'
    )
) as seeded(content_key, label, description, body)
where not exists (
  select 1
  from public.app_content_versions existing
  where existing.content_key = seeded.content_key
);
