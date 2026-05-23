alter table public.profiles
  add column if not exists welcome_guide_dismissed_at timestamptz,
  add column if not exists welcome_guide_dismissed_version text;

comment on column public.profiles.welcome_guide_dismissed_at is
  'When the user last dismissed the first-time welcome explanation.';

comment on column public.profiles.welcome_guide_dismissed_version is
  'Welcome explanation version dismissed by the user. Bump the app version or clear this value to show the welcome again.';

-- Reset the welcome explanation for this rollout so existing local/browser
-- dismissals do not hide the new first-time welcome page.
update public.profiles
set welcome_guide_dismissed_at = null,
    welcome_guide_dismissed_version = null;
