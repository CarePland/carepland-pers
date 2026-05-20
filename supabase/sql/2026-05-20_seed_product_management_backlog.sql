-- Seed Andrew's initial product management backlog.
-- Safe to re-run: it will not duplicate items with the same area + title.

with seeded_areas(area_key, label, description, display_order) as (
  values
    ('bugs_regression', 'Bugs / Regression Checks', 'Regressions and validation checks to run before beta tester invites.', 10),
    ('ai_quick_add', 'AI / Quick Add Wishlist', 'Quick Add, clarification, OCR, voice, and AI-assisted intake ideas.', 20),
    ('ai_admin_qa', 'AI Admin / QA Tooling', 'Admin review tools for AI output quality, prompt behavior, and corrections.', 30),
    ('multi_user', 'Multi-User / Care Circle', 'Shared care circle, secondary user, permission, and account-conversion ideas.', 40),
    ('admin_dev', 'Admin / Dev Tooling', 'Admin utilities for test accounts, seed data, protected tools, and maintenance.', 50),
    ('messaging_ux', 'Messaging / UX Admin', 'Toast/message catalog behavior, message styling, timing, and versioning.', 60),
    ('error_support', 'Error Logging / Support', 'Centralized error tracking, escalation, Freshdesk, and failure monitoring.', 70),
    ('beta_program', 'Beta Program Features', 'Beta tester tracking, rollout, cohorts, incentives, and admin notes.', 80)
),
upserted_areas as (
  insert into public.product_mgmt_areas (
    area_key,
    label,
    description,
    display_order,
    is_active
  )
  select area_key, label, description, display_order, true
  from seeded_areas
  on conflict (area_key) do update
    set label = excluded.label,
        description = excluded.description,
        display_order = excluded.display_order,
        is_active = true,
        updated_at = now()
  returning id, area_key, label, description, display_order, is_active, current_version_number
),
area_version_seed as (
  insert into public.product_mgmt_area_versions (
    area_id,
    area_key,
    label,
    description,
    display_order,
    is_active,
    version_number,
    change_note
  )
  select
    area.id,
    area.area_key,
    area.label,
    area.description,
    area.display_order,
    area.is_active,
    1,
    'Initial backlog lane seed'
  from upserted_areas area
  where not exists (
    select 1
    from public.product_mgmt_area_versions existing
    where existing.area_id = area.id
      and existing.version_number = 1
  )
  returning id
),
seeded_items(area_key, title, body, priority, status) as (
  values
    ('bugs_regression', 'Personal account filtering/UI validation', '', 'high', 'open'),
    ('bugs_regression', 'Personal Plus shared care circle validation', '', 'high', 'open'),
    ('bugs_regression', 'Secondary user sync visibility testing', '', 'medium', 'open'),
    ('bugs_regression', 'Quick Add Care VIP assignment validation', '', 'medium', 'open'),
    ('bugs_regression', 'Archived tab regression check', '', 'medium', 'open'),
    ('bugs_regression', 'Logged tab regression check', '', 'medium', 'open'),
    ('bugs_regression', 'Profile save regression check', '', 'medium', 'open'),
    ('bugs_regression', 'Refresh/filter persistence regression check', '', 'medium', 'open'),
    ('bugs_regression', 'Appointment list refresh consistency', '', 'medium', 'open'),
    ('bugs_regression', 'Care VIP filter state consistency', '', 'medium', 'open'),

    ('ai_quick_add', 'Quick Add clarification prompts', '', 'medium', 'open'),
    ('ai_quick_add', 'Safe address enrichment from profile', '', 'medium', 'open'),
    ('ai_quick_add', 'Use home address confirmation flow', '', 'medium', 'open'),
    ('ai_quick_add', 'Lightweight missing-details review prompts', '', 'medium', 'open'),
    ('ai_quick_add', 'AI draft review screen', '', 'medium', 'open'),
    ('ai_quick_add', 'Voice-to-appointment intake', '', 'low', 'open'),
    ('ai_quick_add', 'OCR confidence metadata layer', '', 'medium', 'open'),
    ('ai_quick_add', 'OCR warning detection', '', 'medium', 'open'),
    ('ai_quick_add', 'Multi-appointment voice parsing', '', 'low', 'open'),

    ('ai_admin_qa', 'AI interpretation review dashboard', '', 'medium', 'open'),
    ('ai_admin_qa', 'Compare AI draft vs saved result', '', 'medium', 'open'),
    ('ai_admin_qa', 'Track user field corrections', '', 'medium', 'open'),
    ('ai_admin_qa', 'Track discarded/failed AI drafts', '', 'medium', 'open'),
    ('ai_admin_qa', 'Prompt version tracking', '', 'medium', 'open'),
    ('ai_admin_qa', 'AI outcome quality ratings', '', 'medium', 'open'),
    ('ai_admin_qa', 'Admin notes on AI mistakes', '', 'medium', 'open'),
    ('ai_admin_qa', 'Periodic AI quality report', '', 'low', 'open'),
    ('ai_admin_qa', 'Prompt performance analytics', '', 'low', 'open'),

    ('multi_user', 'Care VIP invite flow', '', 'medium', 'open'),
    ('multi_user', 'Shared care circle onboarding', '', 'medium', 'open'),
    ('multi_user', 'Permissions/role system', '', 'medium', 'open'),
    ('multi_user', 'Optional Care VIP login conversion', '', 'low', 'open'),
    ('multi_user', 'Secondary/fallback email support', '', 'low', 'open'),
    ('multi_user', 'Account email change flow', '', 'low', 'open'),
    ('multi_user', 'Pending email verification state', '', 'medium', 'open'),

    ('admin_dev', 'Test account generator', '', 'medium', 'open'),
    ('admin_dev', 'Seed demo appointments/data', '', 'medium', 'open'),
    ('admin_dev', 'Test account cleanup tool', '', 'medium', 'open'),
    ('admin_dev', 'Protected admin API tooling', '', 'medium', 'open'),
    ('admin_dev', 'Test account flags/metadata', '', 'medium', 'open'),

    ('messaging_ux', 'Global toast/message catalog', '', 'medium', 'open'),
    ('messaging_ux', 'Configurable message durations', '', 'medium', 'open'),
    ('messaging_ux', 'Message version history/archive', '', 'medium', 'open'),
    ('messaging_ux', 'Global message behavior settings', '', 'medium', 'open'),
    ('messaging_ux', 'Tone/color management for messages', '', 'low', 'open'),

    ('error_support', 'Centralized error logging system', '', 'high', 'open'),
    ('error_support', 'User-friendly error toast layer', '', 'high', 'open'),
    ('error_support', 'Admin error review dashboard', '', 'medium', 'open'),
    ('error_support', 'Severity-based escalation rules', '', 'medium', 'open'),
    ('error_support', 'Freshdesk/support escalation integration', '', 'medium', 'open'),
    ('error_support', 'Repeated failure detection', '', 'medium', 'open'),
    ('error_support', 'AI/database failure monitoring', '', 'medium', 'open'),

    ('beta_program', 'Beta tester profile flags', '', 'medium', 'open'),
    ('beta_program', 'Beta cohort/version tracking', '', 'medium', 'open'),
    ('beta_program', 'Beta participation timestamps', '', 'medium', 'open'),
    ('beta_program', 'Beta tester admin notes', '', 'medium', 'open'),
    ('beta_program', 'Staged rollout support', '', 'low', 'open'),
    ('beta_program', 'Founding tester incentives/badges', '', 'low', 'open')
),
inserted_items as (
  insert into public.product_mgmt_items (
    area_id,
    title,
    body,
    priority,
    status,
    current_version_number
  )
  select
    area.id,
    seeded.title,
    seeded.body,
    seeded.priority,
    seeded.status,
    1
  from seeded_items seeded
  join public.product_mgmt_areas area
    on area.area_key = seeded.area_key
  where not exists (
    select 1
    from public.product_mgmt_items existing
    where existing.area_id = area.id
      and lower(existing.title) = lower(seeded.title)
  )
  returning id, area_id, title, body, priority, status, current_version_number
)
insert into public.product_mgmt_item_versions (
  item_id,
  area_id,
  title,
  body,
  status,
  priority,
  version_number,
  change_note
)
select
  item.id,
  item.area_id,
  item.title,
  item.body,
  item.status,
  item.priority,
  item.current_version_number,
  'Bulk seed from running product notes'
from inserted_items item;
