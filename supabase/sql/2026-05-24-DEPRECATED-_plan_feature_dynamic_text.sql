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
  'Initial editable plan feature wording',
  md5(seeded.content_key || '|' || seeded.label || '|' || seeded.description || '|' || seeded.body)
from (
  values
    ('plan_personal_care_vips', 'Free: Care VIPs', 'Care VIP access shown in the Profile plan helper.', '1 Care VIP.'),
    ('plan_personal_care_prep', 'Free: CarePrep', 'CarePrep access shown in the Profile plan helper.', 'Limited manual CarePrep.'),
    ('plan_personal_automation', 'Free: Automation', 'Automation access shown in the Profile plan helper.', 'Manual preparation only.'),
    ('plan_personal_imports', 'Free: Imports', 'Import allowance wording shown in the Profile plan helper.', 'Limited imports.'),
    ('plan_personal_support', 'Free: Support', 'Support access wording shown in the Profile plan helper.', 'Self-service help.'),
    ('plan_active_use_care_vips', 'Active Use: Care VIPs', 'Care VIP access shown in the Profile plan helper.', '1 Care VIP.'),
    ('plan_active_use_care_prep', 'Active Use: CarePrep', 'CarePrep access shown in the Profile plan helper.', 'More manual CarePrep.'),
    ('plan_active_use_automation', 'Active Use: Automation', 'Automation access shown in the Profile plan helper.', 'Manual preparation.'),
    ('plan_active_use_imports', 'Active Use: Imports', 'Import allowance wording shown in the Profile plan helper.', 'Expanded imports.'),
    ('plan_active_use_support', 'Active Use: Support', 'Support access wording shown in the Profile plan helper.', 'Assistant/chat support.'),
    ('plan_premium_individual_care_vips', 'Premium Individual: Care VIPs', 'Care VIP access shown in the Profile plan helper.', '1 Care VIP.'),
    ('plan_premium_individual_care_prep', 'Premium Individual: CarePrep', 'CarePrep access shown in the Profile plan helper.', 'Automatic CarePrep.'),
    ('plan_premium_individual_automation', 'Premium Individual: Automation', 'Automation access shown in the Profile plan helper.', 'Automatic preparation.'),
    ('plan_premium_individual_imports', 'Premium Individual: Imports', 'Import allowance wording shown in the Profile plan helper.', 'Generous imports.'),
    ('plan_premium_individual_support', 'Premium Individual: Support', 'Support access wording shown in the Profile plan helper.', 'Enhanced support.'),
    ('plan_personal_plus_care_vips', 'Group: Care VIPs', 'Care VIP access shown in the Profile plan helper.', 'Multiple Care VIPs.'),
    ('plan_personal_plus_care_prep', 'Group: CarePrep', 'CarePrep access shown in the Profile plan helper.', 'Automatic CarePrep.'),
    ('plan_personal_plus_automation', 'Group: Automation', 'Automation access shown in the Profile plan helper.', 'Multi-person automation.'),
    ('plan_personal_plus_imports', 'Group: Imports', 'Import allowance wording shown in the Profile plan helper.', 'Highest import allowances.'),
    ('plan_personal_plus_support', 'Group: Support', 'Support access wording shown in the Profile plan helper.', 'Most support access.'),
    ('plan_early_access_care_vips', 'Early Access: Care VIPs', 'Care VIP access shown in the Profile plan helper.', 'Multiple Care VIPs.'),
    ('plan_early_access_care_prep', 'Early Access: CarePrep', 'CarePrep access shown in the Profile plan helper.', 'Automatic CarePrep.'),
    ('plan_early_access_automation', 'Early Access: Automation', 'Automation access shown in the Profile plan helper.', 'Multi-person automation.'),
    ('plan_early_access_imports', 'Early Access: Imports', 'Import allowance wording shown in the Profile plan helper.', 'Highest import allowances.'),
    ('plan_early_access_support', 'Early Access: Support', 'Support access wording shown in the Profile plan helper.', 'Most support access.')
) as seeded(content_key, label, description, body)
where not exists (
  select 1
  from public.app_content_versions existing
  where existing.content_key = seeded.content_key
);
