alter table public.profiles
  add column if not exists beta_terms_acknowledged_at timestamptz,
  add column if not exists beta_privacy_acknowledged_at timestamptz,
  add column if not exists beta_disclaimer_acknowledged_at timestamptz,
  add column if not exists beta_agreement_version text;

