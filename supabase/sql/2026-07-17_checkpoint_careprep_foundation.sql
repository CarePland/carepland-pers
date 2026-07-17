-- CarePland Checkpoint foundation.
--
-- Checkpoint is an Admin-only evaluation surface for preserved interpretive
-- runs. V0 supports CarePrep as the first complete Checkpoint Use.

create table if not exists public.checkpoint_runs (
  id uuid primary key default gen_random_uuid(),
  checkpoint_use_key text not null check (checkpoint_use_key in ('careprep')),
  account_user_id uuid not null references auth.users(id) on delete cascade,
  care_circle_id uuid not null,
  care_subject_id uuid references public.care_subjects(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  requested_range jsonb not null default '{}'::jsonb,
  effective_evidence_range jsonb not null default '{}'::jsonb,
  evidence_packet jsonb not null default '{}'::jsonb,
  structured_interpretation jsonb not null default '{}'::jsonb,
  proposed_output jsonb not null default '{}'::jsonb,
  decision_trace jsonb not null default '{}'::jsonb,
  prompt_key text,
  prompt_version text,
  model_metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  generation_status text not null default 'succeeded' check (
    generation_status in ('succeeded', 'failed')
  ),
  generated_by_user_id uuid references auth.users(id) on delete set null,
  evaluator_id uuid references auth.users(id) on delete set null,
  checkpoint_decision text check (
    checkpoint_decision in (
      'proceed',
      'needs_work',
      'needs_more_evidence',
      'hold',
      'suppress'
    )
  ),
  evaluation_tags text[] not null default '{}',
  evaluator_notes text,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.checkpoint_runs is
  'Admin-only preserved snapshots of interpretive runs and human Checkpoint Decisions.';

comment on column public.checkpoint_runs.evidence_packet is
  'Exact normalized evidence snapshot supplied to the Checkpoint Use.';

comment on column public.checkpoint_runs.proposed_output is
  'Exact proposed user-facing output reviewed by Admin.';

create index if not exists checkpoint_runs_use_created_idx
  on public.checkpoint_runs (checkpoint_use_key, created_at desc);

create index if not exists checkpoint_runs_account_created_idx
  on public.checkpoint_runs (account_user_id, created_at desc);

create index if not exists checkpoint_runs_subject_created_idx
  on public.checkpoint_runs (care_subject_id, created_at desc)
  where care_subject_id is not null;

create index if not exists checkpoint_runs_decision_idx
  on public.checkpoint_runs (checkpoint_decision, created_at desc)
  where checkpoint_decision is not null;

alter table public.checkpoint_runs enable row level security;

drop policy if exists checkpoint_runs_admin_select on public.checkpoint_runs;
create policy checkpoint_runs_admin_select
on public.checkpoint_runs
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists checkpoint_runs_admin_insert on public.checkpoint_runs;
create policy checkpoint_runs_admin_insert
on public.checkpoint_runs
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

drop policy if exists checkpoint_runs_admin_update on public.checkpoint_runs;
create policy checkpoint_runs_admin_update
on public.checkpoint_runs
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

grant usage on schema public to service_role;
grant select on public.ai_instruction_sets to service_role;
grant select on public.ai_instruction_versions to service_role;
grant select, insert, update on public.checkpoint_runs to authenticated;
grant select, insert, update, delete on public.checkpoint_runs to service_role;
