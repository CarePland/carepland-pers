-- Connect Receiver native device profile mirror.
--
-- These fields are reported by the standalone Android Receiver shell after
-- local Receiver Mode setup completes. They are diagnostics/profile data, not
-- login credentials and not a replacement for the existing claim/binding path.

alter table public.connect_receiver_devices
  add column if not exists receiver_mode text not null default '' check (
    receiver_mode in ('', 'dedicated', 'personal')
  ),
  add column if not exists provisioning_completed_at timestamptz,
  add column if not exists capability_statuses jsonb not null default '{}'::jsonb,
  add column if not exists native_version_code integer,
  add column if not exists native_version_name text not null default '',
  add column if not exists shell_version text not null default '',
  add column if not exists native_manufacturer text not null default '',
  add column if not exists native_model text not null default '',
  add column if not exists native_sdk integer,
  add column if not exists device_owner boolean,
  add column if not exists lock_task_permitted boolean,
  add column if not exists lock_task_active boolean,
  add column if not exists last_recovery_action text not null default '',
  add column if not exists last_recovery_at timestamptz;

comment on column public.connect_receiver_devices.receiver_mode is
  'Local Receiver Mode selected in the Android shell provisioning wizard: dedicated or personal.';

comment on column public.connect_receiver_devices.capability_statuses is
  'Native setup capability statuses reported by the Android shell, using supported, enabled, unavailable, or unknown.';

comment on column public.connect_receiver_devices.provisioning_completed_at is
  'Timestamp reported by the Android shell when local Receiver Mode setup completed.';
