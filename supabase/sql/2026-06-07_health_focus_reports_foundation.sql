-- Health Focus / Reports foundation.
-- Adds a durable topic index and saved report layer above appointment records.

create table if not exists public.health_topics (
  id uuid primary key default gen_random_uuid(),
  parent_topic_id uuid references public.health_topics(id) on delete set null,
  slug text not null unique,
  display_name text not null,
  domain text not null default 'health',
  category text not null default 'general',
  description text,
  aliases text[] not null default '{}',
  catalog_source text not null default 'system_seed'
    check (catalog_source in ('system_seed', 'admin_created', 'admin_modified')),
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  is_standard boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (slug = lower(slug)),
  check (domain in ('health', 'care_logistics', 'general')),
  check (category <> '')
);

create table if not exists public.topic_mentions (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  topic_id uuid references public.health_topics(id) on delete set null,
  normalized_topic_slug text not null,
  source_table text not null
    check (source_table in ('appointments', 'appointment_notes', 'careprep_guidance', 'ask_messages', 'manual')),
  source_id uuid,
  appointment_id uuid references public.appointments(id) on delete cascade,
  source_snippet text,
  source_text_hash text,
  source_anchor jsonb not null default '{}'::jsonb,
  confidence numeric not null default 0.5,
  ai_suggested_status text
    check (ai_suggested_status in ('new', 'ongoing', 'resolved', 'follow_up', 'unknown')),
  status text not null default 'ongoing'
    check (status in ('new', 'ongoing', 'resolved', 'follow_up', 'unknown')),
  status_source text not null default 'ai'
    check (status_source in ('ai', 'user', 'system')),
  status_updated_by_user_id uuid references auth.users(id) on delete set null,
  status_updated_at timestamptz not null default now(),
  provider_name text,
  provider_organization text,
  appointment_starts_at timestamptz,
  related_topic_slugs text[] not null default '{}',
  extraction_method text not null default 'manual',
  extraction_run_key text,
  prompt_version text,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (confidence >= 0 and confidence <= 1),
  check (normalized_topic_slug = lower(normalized_topic_slug)),
  check (source_snippet is null or char_length(source_snippet) <= 240),
  check (
    (status_source = 'user' and status_updated_by_user_id is not null)
    or status_source <> 'user'
  )
);

create table if not exists public.topic_summaries (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  topic_id uuid references public.health_topics(id) on delete set null,
  topic_slug text not null,
  title text not null,
  date_range_start date,
  date_range_end date,
  generated_summary text not null,
  source_appointment_ids uuid[] not null default '{}',
  source_topic_mention_ids uuid[] not null default '{}',
  summary_status text not null default 'current'
    check (summary_status in ('draft', 'current', 'superseded', 'archived')),
  version_number integer not null default 1,
  generated_by_user_id uuid references auth.users(id) on delete set null,
  prompt_version text,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_at timestamptz,
  superseded_by_summary_id uuid references public.topic_summaries(id) on delete set null,
  check (topic_slug = lower(topic_slug)),
  check (version_number >= 1)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid references public.care_subjects(id) on delete set null,
  report_type text not null,
  topic_id uuid references public.health_topics(id) on delete set null,
  topic_slug text,
  title text not null,
  date_range_start date,
  date_range_end date,
  generated_summary text not null,
  source_appointment_ids uuid[] not null default '{}',
  source_topic_mention_ids uuid[] not null default '{}',
  source_topic_summary_ids uuid[] not null default '{}',
  report_status text not null default 'current'
    check (report_status in ('draft', 'current', 'superseded', 'archived')),
  version_number integer not null default 1,
  generated_by_user_id uuid references auth.users(id) on delete set null,
  prompt_version text,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_at timestamptz,
  superseded_by_report_id uuid references public.reports(id) on delete set null,
  check (report_type in ('topic_summary', 'date_range_overview', 'medication_changes', 'care_timeline', 'custom')),
  check (topic_slug is null or topic_slug = lower(topic_slug)),
  check (version_number >= 1)
);

create table if not exists public.context_relevance_policies (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid references public.care_circles(id) on delete cascade,
  policy_key text not null,
  display_name text not null,
  domain text not null default 'health',
  target_workflow text not null default 'careprep'
    check (target_workflow in ('careprep', 'health_focus', 'ask', 'reports')),
  description text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (policy_key = lower(policy_key)),
  check (domain in ('health', 'care_logistics', 'general'))
);

create unique index if not exists context_relevance_policies_scope_key_idx
  on public.context_relevance_policies (coalesce(care_circle_id, '00000000-0000-0000-0000-000000000000'::uuid), policy_key, target_workflow);

create table if not exists public.context_relevance_policy_factors (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.context_relevance_policies(id) on delete cascade,
  factor_key text not null,
  display_name text not null,
  weight numeric not null default 0,
  direction text not null default 'boost'
    check (direction in ('boost', 'penalty')),
  applies_when jsonb not null default '{}'::jsonb,
  decay_config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_id, factor_key),
  check (factor_key = lower(factor_key)),
  check (weight >= 0)
);

create index if not exists health_topics_parent_idx
  on public.health_topics (parent_topic_id, sort_order);

create index if not exists health_topics_domain_category_idx
  on public.health_topics (domain, category, sort_order);

create index if not exists topic_mentions_subject_topic_idx
  on public.topic_mentions (care_subject_id, normalized_topic_slug, appointment_starts_at desc);

create index if not exists topic_mentions_appointment_idx
  on public.topic_mentions (appointment_id, is_active);

create unique index if not exists topic_mentions_active_source_topic_idx
  on public.topic_mentions (source_table, source_id, normalized_topic_slug)
  where is_active = true and source_id is not null;

create index if not exists topic_summaries_subject_topic_idx
  on public.topic_summaries (care_subject_id, topic_slug, created_at desc);

create index if not exists reports_subject_type_idx
  on public.reports (care_subject_id, report_type, created_at desc);

alter table public.health_topics enable row level security;
alter table public.topic_mentions enable row level security;
alter table public.topic_summaries enable row level security;
alter table public.reports enable row level security;
alter table public.context_relevance_policies enable row level security;
alter table public.context_relevance_policy_factors enable row level security;

grant select on public.health_topics to authenticated;
grant select, insert, update on public.topic_mentions to authenticated;
grant select, insert, update on public.topic_summaries to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select on public.context_relevance_policies to authenticated;
grant select on public.context_relevance_policy_factors to authenticated;

drop policy if exists "Authenticated users can read standard health topics"
  on public.health_topics;
create policy "Authenticated users can read standard health topics"
  on public.health_topics
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "Care circle members can read topic mentions"
  on public.topic_mentions;
create policy "Care circle members can read topic mentions"
  on public.topic_mentions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = topic_mentions.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = topic_mentions.care_subject_id
        and cs.care_circle_id = topic_mentions.care_circle_id
    )
    and (
      topic_mentions.appointment_id is null
      or exists (
        select 1
        from public.appointments a
        where a.id = topic_mentions.appointment_id
          and a.care_circle_id = topic_mentions.care_circle_id
          and a.care_subject_id = topic_mentions.care_subject_id
      )
    )
  );

drop policy if exists "Care circle members can write topic mentions"
  on public.topic_mentions;
create policy "Care circle members can write topic mentions"
  on public.topic_mentions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = topic_mentions.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = topic_mentions.care_subject_id
        and cs.care_circle_id = topic_mentions.care_circle_id
    )
    and (
      topic_mentions.appointment_id is null
      or exists (
        select 1
        from public.appointments a
        where a.id = topic_mentions.appointment_id
          and a.care_circle_id = topic_mentions.care_circle_id
          and a.care_subject_id = topic_mentions.care_subject_id
      )
    )
  );

drop policy if exists "Care circle members can update topic mentions"
  on public.topic_mentions;
create policy "Care circle members can update topic mentions"
  on public.topic_mentions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = topic_mentions.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = topic_mentions.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = topic_mentions.care_subject_id
        and cs.care_circle_id = topic_mentions.care_circle_id
    )
    and (
      topic_mentions.appointment_id is null
      or exists (
        select 1
        from public.appointments a
        where a.id = topic_mentions.appointment_id
          and a.care_circle_id = topic_mentions.care_circle_id
          and a.care_subject_id = topic_mentions.care_subject_id
      )
    )
  );

drop policy if exists "Care circle members can read topic summaries"
  on public.topic_summaries;
create policy "Care circle members can read topic summaries"
  on public.topic_summaries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = topic_summaries.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can write topic summaries"
  on public.topic_summaries;
create policy "Care circle members can write topic summaries"
  on public.topic_summaries
  for insert
  to authenticated
  with check (
    generated_by_user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = topic_summaries.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = topic_summaries.care_subject_id
        and cs.care_circle_id = topic_summaries.care_circle_id
    )
  );

drop policy if exists "Care circle members can update topic summaries"
  on public.topic_summaries;
create policy "Care circle members can update topic summaries"
  on public.topic_summaries
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = topic_summaries.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = topic_summaries.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = topic_summaries.care_subject_id
        and cs.care_circle_id = topic_summaries.care_circle_id
    )
  );

drop policy if exists "Care circle members can read reports"
  on public.reports;
create policy "Care circle members can read reports"
  on public.reports
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = reports.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can write reports"
  on public.reports;
create policy "Care circle members can write reports"
  on public.reports
  for insert
  to authenticated
  with check (
    generated_by_user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = reports.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and (
      reports.care_subject_id is null
      or exists (
        select 1
        from public.care_subjects cs
        where cs.id = reports.care_subject_id
          and cs.care_circle_id = reports.care_circle_id
      )
    )
  );

drop policy if exists "Care circle members can update reports"
  on public.reports;
create policy "Care circle members can update reports"
  on public.reports
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = reports.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = reports.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and (
      reports.care_subject_id is null
      or exists (
        select 1
        from public.care_subjects cs
        where cs.id = reports.care_subject_id
          and cs.care_circle_id = reports.care_circle_id
      )
    )
  );

drop policy if exists "Authenticated users can read relevance policies"
  on public.context_relevance_policies;
create policy "Authenticated users can read relevance policies"
  on public.context_relevance_policies
  for select
  to authenticated
  using (
    care_circle_id is null
    or exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = context_relevance_policies.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Authenticated users can read relevance factors"
  on public.context_relevance_policy_factors;
create policy "Authenticated users can read relevance factors"
  on public.context_relevance_policy_factors
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.context_relevance_policies p
      where p.id = context_relevance_policy_factors.policy_id
        and (
          p.care_circle_id is null
          or exists (
            select 1
            from public.care_circle_memberships ccm
            where ccm.care_circle_id = p.care_circle_id
              and ccm.user_id = auth.uid()
              and ccm.status = 'active'
          )
        )
    )
  );

insert into public.health_topics (
  slug,
  display_name,
  domain,
  category,
  description,
  aliases,
  sort_order
)
values
  ('blood_pressure', 'Blood Pressure', 'health', 'vitals', 'Blood pressure readings, hypertension discussions, and home monitoring.', array['bp', 'hypertension', 'high blood pressure', 'home readings'], 10),
  ('cholesterol', 'Cholesterol', 'health', 'labs', 'Cholesterol, lipid panels, and related medication discussions.', array['lipids', 'lipid panel', 'ldl', 'hdl', 'triglycerides'], 20),
  ('medication_changes', 'Medication Changes', 'health', 'medications', 'Medication starts, stops, dose changes, timing, and side effects.', array['med changes', 'prescriptions', 'dose change', 'medication timing'], 30),
  ('pain', 'Pain', 'health', 'symptoms', 'Pain symptoms and follow-up context.', array['aches', 'soreness'], 40),
  ('knee_pain', 'Knee Pain', 'health', 'symptoms', 'Knee pain, orthopedic follow-up, imaging, and mobility concerns.', array['knee', 'joint pain'], 41),
  ('dizziness', 'Dizziness', 'health', 'symptoms', 'Dizziness, lightheadedness, vertigo, and related follow-up.', array['lightheaded', 'vertigo'], 50),
  ('fatigue', 'Fatigue', 'health', 'symptoms', 'Fatigue, tiredness, low energy, and related discussions.', array['tired', 'low energy'], 60),
  ('sleep', 'Sleep', 'health', 'lifestyle', 'Sleep quality, insomnia, sleep apnea, and related care context.', array['insomnia', 'sleep apnea'], 70),
  ('lab_results', 'Lab Results', 'health', 'labs', 'Lab orders, lab results, and lab follow-up.', array['labs', 'bloodwork', 'blood work'], 80),
  ('imaging', 'Imaging', 'health', 'diagnostics', 'Imaging orders, results, and follow-up.', array['xray', 'x-ray', 'mri', 'ct scan', 'ultrasound'], 90),
  ('dental_oral_health', 'Dental / Oral Health', 'health', 'dental', 'Dental visits, oral health, teeth, gums, cleanings, and dental follow-up.', array['dental', 'dentist', 'oral health', 'tooth', 'teeth', 'gum', 'gums', 'cleaning', 'cavity', 'cavities', 'crown', 'root canal'], 95),
  ('diabetes', 'Diabetes', 'health', 'conditions', 'Diabetes, blood sugar, A1C, insulin, and related care context.', array['blood sugar', 'glucose', 'a1c', 'insulin'], 110),
  ('arthritis', 'Arthritis', 'health', 'conditions', 'Arthritis, joint stiffness, inflammation, and related mobility context.', array['joint stiffness', 'joint inflammation'], 120),
  ('asthma_breathing', 'Asthma / Breathing', 'health', 'conditions', 'Asthma, breathing symptoms, inhalers, and respiratory follow-up.', array['asthma', 'breathing', 'shortness of breath', 'wheezing', 'inhaler'], 130),
  ('procedures', 'Procedures', 'health', 'procedures', 'Procedures, surgeries, biopsies, colonoscopies, and procedure follow-up.', array['procedure', 'surgery', 'biopsy', 'colonoscopy', 'operation'], 140),
  ('physical_therapy', 'Physical Therapy', 'health', 'therapy', 'Physical therapy, rehab exercises, and therapy follow-up.', array['pt', 'physio', 'rehab', 'rehabilitation', 'therapy exercises'], 150),
  ('walking_balance', 'Walking / Balance', 'health', 'mobility', 'Walking, balance, falls, mobility, and exercise tolerance.', array['walking', 'balance', 'fall risk', 'falls', 'mobility', 'exercise tolerance'], 160),
  ('anxiety_stress', 'Anxiety / Stress', 'health', 'mental_health', 'Anxiety, stress, worry, and related care context.', array['anxiety', 'stress', 'worry', 'panic'], 170),
  ('mood_depression', 'Mood / Depression', 'health', 'mental_health', 'Mood, depression, low mood, and emotional health context.', array['depression', 'depressed', 'mood', 'low mood'], 180),
  ('preventive_care', 'Preventive Care', 'health', 'preventive_care', 'Annual visits, screenings, vaccines, and preventive care planning.', array['annual physical', 'wellness visit', 'screening', 'screenings', 'vaccination', 'vaccinations', 'vaccine'], 190),
  ('nutrition_weight', 'Nutrition / Weight', 'health', 'nutrition', 'Nutrition, diet, weight, appetite, and related care context.', array['nutrition', 'diet', 'weight', 'appetite', 'eating'], 200),
  ('cardiology', 'Cardiology', 'health', 'specialists', 'Cardiology visits and heart-related specialist context.', array['cardiologist', 'heart doctor'], 210),
  ('orthopedics', 'Orthopedics', 'health', 'specialists', 'Orthopedics visits and bone, joint, or muscle specialist context.', array['orthopedic', 'orthopedist', 'ortho'], 220),
  ('neurology', 'Neurology', 'health', 'specialists', 'Neurology visits and nervous-system specialist context.', array['neurologist', 'neuro'], 230),
  ('home_monitoring', 'Home Monitoring', 'care_logistics', 'follow_up', 'Home readings, logs, tracking, and monitoring between appointments.', array['home monitoring', 'home readings', 'tracking at home', 'log readings'], 240),
  ('follow_up', 'Follow-Up', 'care_logistics', 'follow_up', 'Follow-up tasks, referrals, scheduling, and next steps.', array['next steps', 'referral', 'follow up'], 250)
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

with inserted_policy as (
  insert into public.context_relevance_policies (
    policy_key,
    display_name,
    domain,
    target_workflow,
    description,
    is_default
  )
  select
    'default_health_context',
    'Default health context relevance',
    'health',
    'careprep',
    'Default ranking factors for selecting prior context for appointment preparation.',
    true
  where not exists (
    select 1
    from public.context_relevance_policies existing
    where existing.care_circle_id is null
      and existing.policy_key = 'default_health_context'
      and existing.target_workflow = 'careprep'
  )
  returning id
),
default_policy as (
  select id from inserted_policy
  union all
  select id
  from public.context_relevance_policies existing
  where existing.care_circle_id is null
    and existing.policy_key = 'default_health_context'
    and existing.target_workflow = 'careprep'
  limit 1
)
insert into public.context_relevance_policy_factors (
  policy_id,
  factor_key,
  display_name,
  weight,
  direction,
  applies_when,
  decay_config,
  sort_order
)
select
  default_policy.id,
  factor.factor_key,
  factor.display_name,
  factor.weight,
  factor.direction,
  factor.applies_when::jsonb,
  factor.decay_config::jsonb,
  factor.sort_order
from default_policy
cross join (
  values
    ('topic_overlap', 'Topic overlap', 45, 'boost', '{"requiresSharedTopic":true}', '{}', 10),
    ('unresolved_follow_up', 'Unresolved follow-up', 28, 'boost', '{"mentionStatus":["new","ongoing","follow_up"]}', '{}', 20),
    ('user_marked_important', 'User-marked important', 30, 'boost', '{"metadataFlag":"important"}', '{}', 30),
    ('same_provider', 'Same provider', 24, 'boost', '{"providerNameMatch":true}', '{}', 40),
    ('same_practice', 'Same practice', 20, 'boost', '{"providerOrganizationMatch":true}', '{}', 50),
    ('same_specialty', 'Same specialty', 16, 'boost', '{"specialtyMatch":true}', '{}', 60),
    ('same_appointment_type', 'Same appointment type', 12, 'boost', '{"appointmentTypeMatch":true}', '{}', 70),
    ('recent_urgent_care', 'Recent urgent care', 20, 'boost', '{"appointmentType":"urgent_care","targetWindowDays":30}', '{}', 80),
    ('pcp_broad_context', 'Primary care broad context', 8, 'boost', '{"targetAppointmentType":"primary_care"}', '{}', 90),
    ('recency_decay', 'Recency', 18, 'boost', '{}', '{"halfLifeDays":180,"floor":0.15}', 100)
) as factor(factor_key, display_name, weight, direction, applies_when, decay_config, sort_order)
on conflict (policy_id, factor_key) do update
set
  display_name = excluded.display_name,
  weight = excluded.weight,
  direction = excluded.direction,
  applies_when = excluded.applies_when,
  decay_config = excluded.decay_config,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
