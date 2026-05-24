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
  'Initial Profile plan tier help content',
  md5(seeded.content_key || '|' || seeded.label || '|' || seeded.description || '|' || seeded.body)
from (
  values
    (
      'profile_plan_tier_help_body',
      'Plan tier help note',
      'Expandable Profile page note that briefly explains plan tier differences. Supports line breaks and basic bold tags: <b> or <strong>.',
      $$- <b>Free</b> is for light use.
- <b>Active Use</b> adds larger manual CarePrep and import allowances.
- <b>Premium Individual</b> adds automatic appointment preparation for one Care VIP.
- <b>Group</b> supports multiple Care VIPs.
- <b>Early Access</b> currently includes Group-level access for early adopters.$$
    )
) as seeded(content_key, label, description, body)
where not exists (
  select 1
  from public.app_content_versions existing
  where existing.content_key = seeded.content_key
);
