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
  'Initial editable Profile plan panel blocks',
  md5(seeded.content_key || '|' || seeded.label || '|' || seeded.description || '|' || seeded.body)
from (
  values
    (
      'plan_personal_profile_panel',
      'Free: Profile plan panel',
      'Whole editable block shown in the Profile plan helper. First line is the brief summary; following lines may use Label: value.',
      $$Light appointment tracking with manual preparation.
Care VIPs: 1 Care VIP
CarePrep: Limited manual CarePrep
Automation: Manual preparation only
Imports: Limited imports
Support: Self-service help$$
    ),
    (
      'plan_active_use_profile_panel',
      'Active Use: Profile plan panel',
      'Whole editable block shown in the Profile plan helper. First line is the brief summary; following lines may use Label: value.',
      $$More room for active healthcare management.
Care VIPs: 1 Care VIP
CarePrep: More manual CarePrep
Automation: Manual preparation
Imports: Expanded imports
Support: Assistant/chat support$$
    ),
    (
      'plan_premium_individual_profile_panel',
      'Premium Individual: Profile plan panel',
      'Whole editable block shown in the Profile plan helper. First line is the brief summary; following lines may use Label: value.',
      $$Automatic preparation for one Care VIP.
Care VIPs: 1 Care VIP
CarePrep: Automatic CarePrep
Automation: Automatic preparation
Imports: Generous imports
Support: Enhanced support$$
    ),
    (
      'plan_personal_plus_profile_panel',
      'Group: Profile plan panel',
      'Whole editable block shown in the Profile plan helper. First line is the brief summary; following lines may use Label: value.',
      $$Multi-person continuity and coordination.
Care VIPs: Multiple Care VIPs
CarePrep: Automatic CarePrep
Automation: Multi-person automation
Imports: Highest import allowances
Support: Most support access$$
    ),
    (
      'plan_early_access_profile_panel',
      'Early Access: Profile plan panel',
      'Whole editable block shown in the Profile plan helper. First line is the brief summary; following lines may use Label: value.',
      $$Broad early-adopter access while CarePland develops.
Care VIPs: Multiple Care VIPs
CarePrep: Automatic CarePrep
Automation: Multi-person automation
Imports: Highest import allowances
Support: Most support access$$
    )
) as seeded(content_key, label, description, body)
where not exists (
  select 1
  from public.app_content_versions existing
  where existing.content_key = seeded.content_key
);
