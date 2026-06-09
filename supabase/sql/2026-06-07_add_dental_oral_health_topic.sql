insert into public.health_topics (
  slug,
  display_name,
  domain,
  category,
  description,
  aliases,
  sort_order
)
values (
  'dental_oral_health',
  'Dental / Oral Health',
  'health',
  'dental',
  'Dental visits, oral health, teeth, gums, cleanings, and dental follow-up.',
  array[
    'dental',
    'dentist',
    'oral health',
    'tooth',
    'teeth',
    'gum',
    'gums',
    'cleaning',
    'cavity',
    'cavities',
    'crown',
    'root canal'
  ],
  95
)
on conflict (slug) do update
set
  display_name = excluded.display_name,
  domain = excluded.domain,
  category = excluded.category,
  description = excluded.description,
  aliases = excluded.aliases,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
