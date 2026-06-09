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
  'Initial Health Focus context pill labels',
  md5(seeded.content_key || '|' || seeded.label || '|' || seeded.description || '|' || seeded.body)
from (
  values
    (
      'health_focus_context_recency_labels',
      'Context pill labels: Recency',
      'Display labels for Health Focus recency pills. Format each line as: canonical = label_full;label_short.',
      $$No Date = No Date;None
Today = Today
Yesterday = Yesterday
Past Few Days = Past Few Days;Few Days
This Week = This Week
This Month = This Month
Last Month = Last Month
Earlier This Year = Earlier This Year;This Year
Last Year = Last Year
Before Last Year = Before Last Year;Older$$
    ),
    (
      'health_focus_context_frequency_labels',
      'Context pill labels: Frequency',
      'Display labels for Health Focus frequency pills. Format each line as: canonical = label_full;label_short.',
      $$Once = Once
A Few Times = A Few Times;Few
Occasionally = Occasionally
Fairly Often = Fairly Often;Often
Frequent = Frequent
Most Visits = Most Visits;Most$$
    ),
    (
      'health_focus_context_span_labels',
      'Context pill labels: Span',
      'Display labels for Health Focus span pills. Format each line as: canonical = label_full;label_short.',
      $$One Visit = One Visit
Several Weeks = Several Weeks;Weeks
Several Months = Several Months;Months
About a Year = About a Year;Year
Multiple Years = Multiple Years;Years$$
    )
) as seeded(content_key, label, description, body)
where not exists (
  select 1
  from public.app_content_versions existing
  where existing.content_key = seeded.content_key
);
