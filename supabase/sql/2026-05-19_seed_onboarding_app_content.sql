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
  'Initial onboarding/support content seed',
  md5(seeded.content_key || '|' || seeded.label || '|' || seeded.description || '|' || seeded.body)
from (
  values
    (
      'welcome_guide_title',
      'Welcome guide title',
      'Headline for the first-run welcome card on the appointments screen.',
      'Welcome to CarePland'
    ),
    (
      'welcome_guide_body',
      'Welcome guide body',
      'Introductory guidance shown in the first-run welcome card.',
      'Start with an appointment, import appointment text or images, or contact support if something feels off.'
    ),
    (
      'demo_prompt_title',
      'Demo data prompt title',
      'Headline for the first-run demo data offer.',
      'Want demo data to explore?'
    ),
    (
      'demo_prompt_body',
      'Demo data prompt body',
      'Body text explaining the first-run demo data offer.',
      'Add a few demo appointments, notes, and CarePrep examples. You can skip this if you want to start clean.'
    ),
    (
      'demo_profile_remove_body',
      'Demo data removal note',
      'Profile page explanation shown before removing demo data.',
      'Demo appointments are not real appointments. Removing demo data deletes only items marked as demo data and keeps your real information.'
    ),
    (
      'demo_profile_add_body',
      'Demo data add note',
      'Profile page explanation shown before adding demo data.',
      'Add a few fictional appointments, notes, and CarePrep examples if you want a guided workspace to explore.'
    )
) as seeded(content_key, label, description, body)
where not exists (
  select 1
  from public.app_content_versions existing
  where existing.content_key = seeded.content_key
);
