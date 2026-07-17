-- Transfer Admin access from the Google-test profile to Andrew's primary login.
--
-- Google login testing can create a separate profile row, so this script also
-- repairs the missing Andrew profile row from auth.users when needed.

with andrew_auth_user as (
  select id, email
  from auth.users
  where lower(trim(email)) = lower('andrew@goodloe.org')
  limit 1
),
andrew_profile as (
  insert into public.profiles (
    id,
    email,
    display_name,
    given_name,
    family_name,
    beta_agreement_version,
    beta_terms_acknowledged_at,
    beta_privacy_acknowledged_at,
    beta_disclaimer_acknowledged_at,
    is_admin,
    updated_at
  )
  select
    id,
    email,
    'Andrew Goodloe',
    'Andrew',
    'Goodloe',
    'beta-2026-05-19',
    now(),
    now(),
    now(),
    true,
    now()
  from andrew_auth_user
  on conflict (id) do update
     set email = excluded.email,
         display_name = coalesce(nullif(public.profiles.display_name, ''), excluded.display_name),
         given_name = coalesce(nullif(public.profiles.given_name, ''), excluded.given_name),
         family_name = coalesce(nullif(public.profiles.family_name, ''), excluded.family_name),
         beta_agreement_version = coalesce(
           nullif(public.profiles.beta_agreement_version, ''),
           excluded.beta_agreement_version
         ),
         beta_terms_acknowledged_at = coalesce(
           public.profiles.beta_terms_acknowledged_at,
           excluded.beta_terms_acknowledged_at
         ),
         beta_privacy_acknowledged_at = coalesce(
           public.profiles.beta_privacy_acknowledged_at,
           excluded.beta_privacy_acknowledged_at
         ),
         beta_disclaimer_acknowledged_at = coalesce(
           public.profiles.beta_disclaimer_acknowledged_at,
           excluded.beta_disclaimer_acknowledged_at
         ),
         is_admin = true,
         updated_at = now()
  returning id, email, display_name, is_admin
),
former_google_profile as (
  update public.profiles
     set is_admin = false,
         updated_at = now()
   where lower(trim(coalesce(email, ''))) = lower('goodlorious@gmail.com')
  returning id, email, display_name, is_admin
)
select
  'andrew_admin' as result,
  id,
  email,
  display_name,
  is_admin
from andrew_profile
union all
select
  'former_google_admin_removed' as result,
  id,
  email,
  display_name,
  is_admin
from former_google_profile;
