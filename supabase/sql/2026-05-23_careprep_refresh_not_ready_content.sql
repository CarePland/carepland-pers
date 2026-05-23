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
  'Initial CarePrep refresh not-ready message',
  md5(seeded.content_key || '|' || seeded.label || '|' || seeded.description || '|' || seeded.body)
from (
  values
    (
      'careprep_refresh_not_ready_message',
      'CarePrep refresh not-ready message',
      'Message shown when a user tries to refresh CarePrep before new appointment history is available.',
      $$CarePrep can't be run yet because you have no additional appointments to consider.$$
    )
) as seeded(content_key, label, description, body)
where not exists (
  select 1
  from public.app_content_versions existing
  where existing.content_key = seeded.content_key
);
