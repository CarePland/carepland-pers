-- Connect Receiver provisioning foundation.
--
-- This stores standalone Android Receiver device bindings and short-lived
-- native app claims. Claims are not permanent credentials. They exist only to
-- bridge an approved web setup session into the installed APK/Receiver shell.

create table if not exists public.connect_receiver_devices (
  id text primary key,
  status text not null default 'setup_pending' check (
    status in ('setup_pending', 'claim_pending', 'bound', 'revoked')
  ),
  receiver_install_id text not null default '',
  receiver_url text not null default '',
  device_profile text not null default '',
  hardware_profile text not null default '',
  ui_layout text not null default '',
  care_circle_id uuid,
  main_connect_user_person_id uuid references public.care_subjects(id) on delete set null,
  location_label text not null default '',
  last_seen_at timestamptz,
  bound_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.connect_receiver_devices is
  'Standalone Connect Receiver device records. These identify installed receiver appliances; they are not user login credentials.';

comment on column public.connect_receiver_devices.receiver_install_id is
  'Pseudonymous app-private install id reported by the Android shell after provisioning.';

comment on column public.connect_receiver_devices.main_connect_user_person_id is
  'Future durable binding to the Pers person whose Receiver world this device opens.';

create index if not exists connect_receiver_devices_status_idx
  on public.connect_receiver_devices (status, updated_at desc);

create index if not exists connect_receiver_devices_care_circle_idx
  on public.connect_receiver_devices (care_circle_id, updated_at desc);

create table if not exists public.connect_receiver_claims (
  claim text primary key,
  receiver_device_id text not null references public.connect_receiver_devices(id) on delete cascade,
  setup_code text not null default '',
  status text not null default 'available' check (
    status in ('available', 'used', 'expired', 'revoked')
  ),
  receiver_install_id text not null default '',
  receiver_url text not null default '',
  device_profile text not null default '',
  hardware_profile text not null default '',
  ui_layout text not null default '',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  revoked_at timestamptz
);

comment on table public.connect_receiver_claims is
  'Short-lived native app claims used to bind an approved setup session to an installed Receiver APK. Claims must not be treated as permanent account credentials.';

create index if not exists connect_receiver_claims_device_created_idx
  on public.connect_receiver_claims (receiver_device_id, created_at desc);

create index if not exists connect_receiver_claims_status_expires_idx
  on public.connect_receiver_claims (status, expires_at);

alter table public.connect_receiver_devices enable row level security;
alter table public.connect_receiver_claims enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.connect_receiver_devices to service_role;
grant select, insert, update, delete on public.connect_receiver_claims to service_role;

-- No end-user RLS policies yet. App routes use the service role while the
-- authenticated approval/admin model is being designed. Service role bypasses
-- RLS; browser/client code must never access these tables directly.
