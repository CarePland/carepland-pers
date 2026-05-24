-- Align beta plan records with the four CarePland pricing tiers.
-- This keeps existing entitlement ids working while updating user-facing names.

insert into public.plans (id, name, max_active_subjects)
values
  ('personal', 'Free', 1),
  ('active_use', 'Active Use', 1),
  ('premium_individual', 'Premium Individual', 1),
  ('personal_plus', 'Group', 4),
  ('early_access', 'Early Access', 4)
on conflict (id) do update
set
  name = excluded.name,
  max_active_subjects = excluded.max_active_subjects;
