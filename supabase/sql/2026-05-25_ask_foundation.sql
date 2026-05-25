create table if not exists public.ask_routing_settings (
  settings_key text primary key default 'default',
  auto_route_enabled boolean not null default false,
  auto_create_min_confidence numeric not null default 0.9,
  clarify_default_max_turns integer not null default 3,
  clarify_absolute_max_turns integer not null default 5,
  updated_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (settings_key = 'default'),
  check (auto_create_min_confidence >= 0 and auto_create_min_confidence <= 1),
  check (clarify_default_max_turns >= 0),
  check (clarify_absolute_max_turns >= clarify_default_max_turns)
);

insert into public.ask_routing_settings (settings_key)
values ('default')
on conflict (settings_key) do nothing;

alter table public.ask_routing_settings enable row level security;

grant select on public.ask_routing_settings to authenticated;

drop policy if exists "Authenticated users can read ask routing settings"
  on public.ask_routing_settings;
create policy "Authenticated users can read ask routing settings"
  on public.ask_routing_settings
  for select
  to authenticated
  using (true);

create table if not exists public.ask_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_circle_id uuid references public.care_circles(id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'ready_to_route', 'routed', 'needs_review', 'closed')),
  source text not null default 'in_app_ask',
  current_page text,
  context jsonb not null default '{}'::jsonb,
  clarifying_turn_count integer not null default 0,
  clarifying_turn_limit integer not null default 3,
  clarifying_stop_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ask_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ask_threads(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_role text not null
    check (author_role in ('user', 'assistant', 'system', 'admin')),
  message_body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ask_submissions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ask_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  care_circle_id uuid references public.care_circles(id) on delete set null,
  source text not null default 'in_app_ask',
  current_page text,
  context jsonb not null default '{}'::jsonb,
  transcript text not null default '',
  original_user_wording text not null default '',
  ai_summary text not null default '',
  router_category text not null default 'unclear_or_needs_human_review'
    check (
      router_category in (
        'support_question',
        'bug_report',
        'feature_request',
        'workflow_feedback',
        'account_or_access_issue',
        'unclear_or_needs_human_review',
        'off_topic'
      )
    ),
  router_confidence numeric not null default 0,
  router_rationale text not null default '',
  recommended_actions jsonb not null default '[]'::jsonb,
  applied_actions jsonb not null default '[]'::jsonb,
  safety_flags jsonb not null default '{}'::jsonb,
  routing_state text not null default 'needs_review'
    check (routing_state in ('new', 'needs_review', 'auto_routed', 'admin_overridden', 'closed')),
  auto_routing_applied boolean not null default false,
  auto_routing_policy_version text,
  reviewed_by_user_id uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  instruction_version_id uuid references public.ai_instruction_versions(id) on delete set null,
  prompt_version text,
  model text,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (router_confidence >= 0 and router_confidence <= 1)
);

create table if not exists public.ask_submission_links (
  id uuid primary key default gen_random_uuid(),
  ask_submission_id uuid not null references public.ask_submissions(id) on delete cascade,
  target_table text not null,
  target_id uuid,
  relationship_type text not null default 'related_to'
    check (
      relationship_type in (
        'created_from',
        'related_to',
        'duplicate_of',
        'spawned',
        'mentions',
        'followup_to',
        'routed_in_error'
      )
    ),
  label text,
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  retracted_at timestamptz,
  retracted_by_user_id uuid references auth.users(id) on delete set null,
  retraction_reason text
);

create index if not exists ask_threads_user_updated_idx
  on public.ask_threads (user_id, updated_at desc);

create index if not exists ask_messages_thread_created_idx
  on public.ask_messages (thread_id, created_at);

create index if not exists ask_submissions_state_created_idx
  on public.ask_submissions (routing_state, created_at desc);

create index if not exists ask_submissions_user_created_idx
  on public.ask_submissions (user_id, created_at desc);

create index if not exists ask_submission_links_submission_idx
  on public.ask_submission_links (ask_submission_id, is_active);

alter table public.ask_threads enable row level security;
alter table public.ask_messages enable row level security;
alter table public.ask_submissions enable row level security;
alter table public.ask_submission_links enable row level security;

grant select, insert, update on public.ask_threads to authenticated;
grant select, insert on public.ask_messages to authenticated;
grant select, insert, update on public.ask_submissions to authenticated;
grant select, insert, update on public.ask_submission_links to authenticated;

insert into public.app_content_versions (
  content_key,
  label,
  description,
  body,
  version_number,
  is_current,
  change_note,
  content_hash
)
select
  seeded.content_key,
  seeded.label,
  seeded.description,
  seeded.body,
  1,
  true,
  'Initial Ask message content seed',
  md5(seeded.content_key || '|' || seeded.label || '|' || seeded.description || '|' || seeded.body)
from (
  values
    (
      'ask_guidance_message',
      'Ask guidance message',
      'Guidance text shown at the top of the Ask panel before a user sends a message.',
      'Questions, ideas, workflow feedback, or things that felt confusing — tell us what’s on your mind.'
    ),
    (
      'ask_acknowledgement_message',
      'Ask acknowledgement message',
      'Message shown after an Ask conversation has been accepted for review.',
      'Thank you for taking the time to ask us. We do review every request!'
    ),
    (
      'ask_duplicate_message',
      'Ask duplicate message',
      'Message shown when a user tries to submit the same Ask message more than once.',
      'Thanks — we got your question!'
    )
) as seeded(content_key, label, description, body)
where to_regclass('public.app_content_versions') is not null
  and not exists (
    select 1
    from public.app_content_versions existing
    where existing.content_key = seeded.content_key
  );

drop policy if exists "Users and admins can read ask threads" on public.ask_threads;
create policy "Users and admins can read ask threads"
  on public.ask_threads
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Users can create their own ask threads" on public.ask_threads;
create policy "Users can create their own ask threads"
  on public.ask_threads
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own ask threads" on public.ask_threads;
create policy "Users can update their own ask threads"
  on public.ask_threads
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users and admins can read ask messages" on public.ask_messages;
create policy "Users and admins can read ask messages"
  on public.ask_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.ask_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Users can create ask messages on their threads" on public.ask_messages;
create policy "Users can create ask messages on their threads"
  on public.ask_messages
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.ask_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "Users and admins can read ask submissions" on public.ask_submissions;
create policy "Users and admins can read ask submissions"
  on public.ask_submissions
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Users can create their own ask submissions" on public.ask_submissions;
create policy "Users can create their own ask submissions"
  on public.ask_submissions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins can update ask submissions" on public.ask_submissions;
create policy "Admins can update ask submissions"
  on public.ask_submissions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Users and admins can read ask submission links" on public.ask_submission_links;
create policy "Users and admins can read ask submission links"
  on public.ask_submission_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.ask_submissions s
      where s.id = ask_submission_id
        and s.user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Admins can create ask submission links" on public.ask_submission_links;
create policy "Admins can create ask submission links"
  on public.ask_submission_links
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Admins can update ask submission links" on public.ask_submission_links;
create policy "Admins can update ask submission links"
  on public.ask_submission_links
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

alter table public.support_tickets
  add column if not exists ask_submission_id uuid references public.ask_submissions(id) on delete set null;

create index if not exists support_tickets_ask_submission_idx
  on public.support_tickets (ask_submission_id);

alter table public.support_assistant_interactions
  add column if not exists ask_thread_id uuid references public.ask_threads(id) on delete set null,
  add column if not exists ask_submission_id uuid references public.ask_submissions(id) on delete set null;

alter table public.product_mgmt_items
  add column if not exists source text not null default 'admin_created',
  add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists care_circle_id uuid references public.care_circles(id) on delete set null,
  add column if not exists ask_submission_id uuid references public.ask_submissions(id) on delete set null,
  add column if not exists app_area text,
  add column if not exists user_pain_point text,
  add column if not exists desired_outcome text,
  add column if not exists urgency_clues text,
  add column if not exists original_user_wording text,
  add column if not exists interpretation_metadata jsonb not null default '{}'::jsonb;

alter table public.product_mgmt_item_versions
  add column if not exists source text,
  add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists care_circle_id uuid references public.care_circles(id) on delete set null,
  add column if not exists ask_submission_id uuid references public.ask_submissions(id) on delete set null,
  add column if not exists app_area text,
  add column if not exists user_pain_point text,
  add column if not exists desired_outcome text,
  add column if not exists urgency_clues text,
  add column if not exists original_user_wording text,
  add column if not exists interpretation_metadata jsonb;

create index if not exists product_mgmt_items_source_area_idx
  on public.product_mgmt_items (source, area_id, status, updated_at desc);

create index if not exists product_mgmt_items_ask_submission_idx
  on public.product_mgmt_items (ask_submission_id);

with router_schema as (
  select '{
    "additionalProperties": false,
    "properties": {
      "action": {
        "enum": ["answer_now", "ask_clarifying_question", "route_now", "needs_human_review", "off_topic"],
        "type": "string"
      },
      "assistant_response": { "type": "string" },
      "brief_summary": { "type": "string" },
      "clarifying_question": { "type": "string" },
      "confidence": { "type": "number" },
      "primary_category": {
        "enum": [
          "support_question",
          "bug_report",
          "feature_request",
          "workflow_feedback",
          "account_or_access_issue",
          "unclear_or_needs_human_review",
          "off_topic"
        ],
        "type": "string"
      },
      "rationale": { "type": "string" },
      "recommended_actions": {
        "items": {
          "additionalProperties": true,
          "properties": {
            "action": { "type": "string" },
            "app_area": { "type": "string" },
            "category": { "type": "string" },
            "confidence": { "type": "number" },
            "priority": { "type": "string" },
            "rationale": { "type": "string" },
            "title": { "type": "string" }
          },
          "required": ["action", "confidence", "rationale"],
          "type": "object"
        },
        "type": "array"
      },
      "risk_flags": {
        "additionalProperties": false,
        "properties": {
          "account_or_access": { "type": "boolean" },
          "data_loss": { "type": "boolean" },
          "medical_or_emergency": { "type": "boolean" },
          "privacy_or_security": { "type": "boolean" },
          "spam_or_abuse": { "type": "boolean" }
        },
        "required": [
          "account_or_access",
          "data_loss",
          "medical_or_emergency",
          "privacy_or_security",
          "spam_or_abuse"
        ],
        "type": "object"
      }
    },
    "required": [
      "action",
      "assistant_response",
      "brief_summary",
      "clarifying_question",
      "confidence",
      "primary_category",
      "rationale",
      "recommended_actions",
      "risk_flags"
    ],
    "type": "object"
  }'::jsonb as body
), inserted_sets as (
  insert into public.ai_instruction_sets (
    care_circle_id,
    instruction_key,
    name,
    description,
    is_active
  )
  select cc.id, seeded.instruction_key, seeded.name, seeded.description, true
  from public.care_circles cc
  cross join (
    values
      ('ask_router', 'Ask router', 'Classifies Ask conversations and recommends modular downstream routing.'),
      ('ask_clarifier', 'Ask clarifier', 'Asks limited useful follow-up questions when Ask input is not yet actionable.'),
      ('ask_feature_interpreter', 'Ask feature interpreter', 'Turns user feature ideas and workflow feedback into structured review candidates.'),
      ('ask_bug_interpreter', 'Ask bug interpreter', 'Turns user friction and possible bugs into structured bug review candidates.'),
      ('ask_off_topic_handler', 'Ask off-topic handler', 'Handles clearly out-of-scope Ask messages briefly and safely.')
  ) as seeded(instruction_key, name, description)
  where not exists (
    select 1
    from public.ai_instruction_sets existing
    where existing.care_circle_id = cc.id
      and existing.instruction_key = seeded.instruction_key
  )
  returning id, instruction_key
), target_sets as (
  select ais.id, ais.instruction_key
  from public.ai_instruction_sets ais
  where ais.instruction_key in (
    'ask_router',
    'ask_clarifier',
    'ask_feature_interpreter',
    'ask_bug_interpreter',
    'ask_off_topic_handler'
  )
    and not exists (
      select 1
      from public.ai_instruction_versions aiv
      where aiv.instruction_set_id = ais.id
    )
)
insert into public.ai_instruction_versions (
  instruction_set_id,
  version_number,
  system_prompt,
  user_prompt_template,
  output_schema,
  model,
  temperature,
  is_current,
  change_note,
  content_hash
)
select
  target_sets.id,
  1,
  case target_sets.instruction_key
    when 'ask_router' then
      'You are the CarePland Personal Ask router. Your job is triage and recommendation, not doing every downstream task yourself. Review the current Ask conversation and decide whether to answer a safe app-use question, ask one useful clarifying question, route the intake for review, or mark it off-topic. Keep CarePland patient-facing language calm and plain. Do not deny that you are AI and do not pretend to be human, but keep that fact in the background unless the user asks or it matters for consent, review, or trust. If a user asks what you are, you may say: "I''m an AI assistant designed to help route questions, feedback, and ideas throughout CarePland. I''m not a replacement for real people. I''m here to help the CarePland team better understand and respond to what you need, almost like CarePrep for support and product feedback." Do not provide medical, legal, privacy, account-security, billing, or emergency advice. Do not perform destructive actions or claim that data has been changed. Prefer human review for account/access, privacy/security, possible data loss, medical/emergency, abusive/spam, or unclear cases. If asking a clarifying question, ask only when the answer would materially improve routing, troubleshooting, or admin usefulness. Clarifying questions should sound conversational, brief, and a little forgiving, not formal or interrogative. For likely typos or near-matches, prefer simple language such as "Just to make sure I understand — did you mean ''prep''?" or "I may have misunderstood ''perp.'' Did you mean ''prep''?" Return valid JSON exactly matching the schema.'
    when 'ask_clarifier' then
      'You are the CarePland Personal Ask clarifier. Ask at most one concise follow-up question at a time, only when the answer would materially improve routing or troubleshooting. Clarifying questions should sound conversational, brief, and a little forgiving, not formal or interrogative. For likely typos or near-matches, prefer simple language such as "Just to make sure I understand — did you mean ''prep''?" or "I may have misunderstood ''perp.'' Did you mean ''prep''?" If further questioning is low value, summarize what you understand and send the item for review. Return structured JSON when this module is wired into runtime.'
    when 'ask_feature_interpreter' then
      'You are the CarePland Personal Ask feature interpreter. Convert user ideas into structured wishlist or workflow feedback candidates. Preserve original wording and extract desired outcome, pain point, affected app area, and urgency clues. Do not make roadmap commitments.'
    when 'ask_bug_interpreter' then
      'You are the CarePland Personal Ask bug interpreter. Convert user friction into structured bug candidates. Capture what the user tried, expected, and what happened instead. Distinguish possible product defects from usability confusion when possible.'
    else
      'You are the CarePland Personal Ask off-topic handler. Briefly and kindly redirect clearly out-of-scope messages back to CarePland questions, appointment organization, bugs, ideas, workflow feedback, or support review. Escalate risky medical, legal, privacy, security, or emergency topics instead of trying to answer them.'
  end,
  case target_sets.instruction_key
    when 'ask_router' then
      'Use the supplied Ask thread, current page, app context, routing settings, and product context. Recommend a route and next action. If the thread has reached the clarifying limit, do not ask another question; summarize and route for review.'
    else
      'Use the supplied Ask thread and app context. Return the structured result requested by the module instructions.'
  end,
  case when target_sets.instruction_key = 'ask_router'
    then router_schema.body
    else '{}'::jsonb
  end,
  'gpt-4.1-mini',
  0.2,
  true,
  'Initial Ask modular instruction seed',
  md5(target_sets.id::text || '|' || target_sets.instruction_key || '|ask-phase-1')
from target_sets
cross join router_schema;
