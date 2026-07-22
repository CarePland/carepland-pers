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
  'Initial CarePland glossary seed',
  md5(seeded.content_key || '|' || seeded.label || '|' || seeded.description || '|' || seeded.body)
from (
  values (
    'carepland_glossary',
    'CarePland Glossary',
    'Managed glossary shown as an optional setup page and from Profile settings.',
    '{
  "title": "CarePland Glossary",
  "intro": "",
  "entries": [
    {
      "active": true,
      "description": "Questions about CarePland?\n\nJust Ask.",
      "icon": "🤖",
      "order": 10,
      "term": "Ask"
    },
    {
      "active": true,
      "description": "You + the people and pets you care for = your Care Circle.",
      "icon": "❤️",
      "order": 20,
      "term": "Care VIPs"
    },
    {
      "active": true,
      "description": "A simpler experience for a Care VIP.\n\nSend messages and reminders.\n\nAsk or type.\n\nUse it as an always-on appliance.",
      "icon": "📱",
      "order": 30,
      "term": "Receiver"
    },
    {
      "active": true,
      "description": "Grabs useful care context from relevant files and images.",
      "icon": "📥",
      "order": 40,
      "term": "Import Anything"
    }
  ]
}'::text
  )
) as seeded(content_key, label, description, body)
where to_regclass('public.app_content_versions') is not null
  and not exists (
    select 1
    from public.app_content_versions existing
    where existing.content_key = seeded.content_key
  );
