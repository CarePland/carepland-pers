-- One-off utility: show the Welcome screen again for every user.
--
-- This clears only the welcome-guide dismissal fields on profiles.
-- It does not change onboarding, Early Access acknowledgement, appointments,
-- notes, CarePrep, sample data, or auth state.

update public.profiles
set
  welcome_guide_dismissed_at = null,
  welcome_guide_dismissed_version = null;

select
  count(*) as profiles_reset
from public.profiles
where welcome_guide_dismissed_at is null
  and welcome_guide_dismissed_version is null;
