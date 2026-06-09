-- Health Focus feedback and Admin-managed prompt foundation.
-- Safe to re-run. Adds first-class care-story feedback storage and seeds
-- Health Focus / Health Story prompt paths into the existing AI Prompts system.

create table if not exists public.health_topic_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  topic_id uuid references public.health_topics(id) on delete set null,
  topic_slug text not null,
  target_type text not null default 'health_story'
    check (target_type in (
      'health_focus_card',
      'health_story',
      'topic_summary',
      'report',
      'topic_relationship',
      'timeline',
      'source_snippet'
    )),
  feedback_mode text not null
    check (feedback_mode in ('binary', 'clarification')),
  feedback_value text
    check (
      feedback_value is null
      or feedback_value in (
        'looks_right',
        'not_accurate',
        'related',
        'unrelated',
        'resolved',
        'still_active',
        'unclear'
      )
    ),
  user_comment text,
  related_topic_slug text,
  relationship_feedback text
    check (
      relationship_feedback is null
      or relationship_feedback in ('related', 'unrelated', 'unclear')
    ),
  system_summary_text text,
  system_snapshot jsonb not null default '{}'::jsonb,
  interpreted_correction jsonb not null default '{}'::jsonb,
  source_appointment_ids uuid[] not null default '{}',
  source_topic_mention_ids uuid[] not null default '{}',
  topic_summary_id uuid references public.topic_summaries(id) on delete set null,
  report_id uuid references public.reports(id) on delete set null,
  prompt_version text,
  model text,
  should_influence_future_generation boolean not null default true,
  incorporation_status text not null default 'pending'
    check (incorporation_status in ('pending', 'incorporated', 'ignored', 'superseded')),
  incorporated_at timestamptz,
  incorporated_by_summary_id uuid references public.topic_summaries(id) on delete set null,
  incorporated_by_report_id uuid references public.reports(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (topic_slug = lower(topic_slug)),
  check (
    feedback_mode = 'clarification'
    or feedback_value is not null
  ),
  check (
    user_comment is null
    or char_length(user_comment) <= 2000
  )
);

create table if not exists public.health_topic_user_context (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  care_subject_id uuid not null references public.care_subjects(id) on delete cascade,
  topic_id uuid references public.health_topics(id) on delete set null,
  topic_slug text not null,
  context_type text not null
    check (context_type in (
      'topic_scope',
      'topic_relationship',
      'timeline_correction',
      'status_correction',
      'summary_preference',
      'source_correction',
      'other'
    )),
  context_text text not null,
  structured_context jsonb not null default '{}'::jsonb,
  related_topic_slug text,
  source_feedback_id uuid references public.health_topic_feedback(id) on delete set null,
  source_appointment_ids uuid[] not null default '{}',
  source_topic_mention_ids uuid[] not null default '{}',
  confidence numeric not null default 1,
  should_influence_health_focus boolean not null default true,
  should_influence_careprep boolean not null default true,
  should_influence_reports boolean not null default true,
  incorporation_status text not null default 'active'
    check (incorporation_status in ('active', 'superseded', 'ignored')),
  superseded_at timestamptz,
  superseded_by_context_id uuid references public.health_topic_user_context(id) on delete set null,
  prompt_version text,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (topic_slug = lower(topic_slug)),
  check (confidence >= 0 and confidence <= 1),
  check (char_length(context_text) <= 2000)
);

create index if not exists health_topic_feedback_subject_topic_idx
  on public.health_topic_feedback (care_subject_id, topic_slug, created_at desc);

create index if not exists health_topic_feedback_user_idx
  on public.health_topic_feedback (user_id, created_at desc);

create index if not exists health_topic_feedback_incorporation_idx
  on public.health_topic_feedback (incorporation_status, should_influence_future_generation);

create index if not exists health_topic_user_context_subject_topic_idx
  on public.health_topic_user_context (care_subject_id, topic_slug, incorporation_status, created_at desc);

create index if not exists health_topic_user_context_feedback_idx
  on public.health_topic_user_context (source_feedback_id);

alter table public.health_topic_feedback enable row level security;
alter table public.health_topic_user_context enable row level security;

grant select, insert, update on public.health_topic_feedback to authenticated;
grant select, insert, update on public.health_topic_user_context to authenticated;

drop policy if exists "Care circle members can read health topic feedback"
  on public.health_topic_feedback;
create policy "Care circle members can read health topic feedback"
  on public.health_topic_feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = health_topic_feedback.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can write health topic feedback"
  on public.health_topic_feedback;
create policy "Care circle members can write health topic feedback"
  on public.health_topic_feedback
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = health_topic_feedback.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = health_topic_feedback.care_subject_id
        and cs.care_circle_id = health_topic_feedback.care_circle_id
    )
  );

drop policy if exists "Care circle members can update own health topic feedback"
  on public.health_topic_feedback;
create policy "Care circle members can update own health topic feedback"
  on public.health_topic_feedback
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = health_topic_feedback.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = health_topic_feedback.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can read health topic user context"
  on public.health_topic_user_context;
create policy "Care circle members can read health topic user context"
  on public.health_topic_user_context
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = health_topic_user_context.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

drop policy if exists "Care circle members can write health topic user context"
  on public.health_topic_user_context;
create policy "Care circle members can write health topic user context"
  on public.health_topic_user_context
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = health_topic_user_context.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
    and exists (
      select 1
      from public.care_subjects cs
      where cs.id = health_topic_user_context.care_subject_id
        and cs.care_circle_id = health_topic_user_context.care_circle_id
    )
  );

drop policy if exists "Care circle members can update own health topic user context"
  on public.health_topic_user_context;
create policy "Care circle members can update own health topic user context"
  on public.health_topic_user_context
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = health_topic_user_context.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.care_circle_memberships ccm
      where ccm.care_circle_id = health_topic_user_context.care_circle_id
        and ccm.user_id = auth.uid()
        and ccm.status = 'active'
    )
  );

with seeded_prompts as (
  select *
  from (
    values
      ('health_topic_extraction', 'Health topic extraction', 'Extracts candidate health topics from appointment notes and source text.'),
      ('health_topic_normalization', 'Health topic normalization', 'Maps extracted topic language to the standard Health Focus topic catalog.'),
      ('health_topic_relationship_detection', 'Health topic relationship detection', 'Detects whether topics in the same source appear related, separate, or unclear.'),
      ('health_focus_card_summary', 'Health Focus card summary', 'Writes compact human-facing Health Focus card summaries.'),
      ('health_story_narrative_summary', 'Health Story narrative summary', 'Writes concise plain-language Health Story summaries from saved source data.'),
      ('health_story_timeline_summary', 'Health Story timeline summary', 'Summarizes timeline events for a topic using approximate, user-friendly language.'),
      ('health_story_source_snippet_selection', 'Health Story source snippet selection', 'Chooses short source snippets that support Health Story trust and auditability.'),
      ('health_story_feedback_acknowledgement', 'Health Story feedback acknowledgement', 'Acknowledges saved Health Story feedback without implying retraining or guaranteed outcomes.'),
      ('health_topic_feedback_interpretation', 'Health topic feedback interpretation', 'Interprets whether user feedback confirms, corrects, or clarifies a Health Story.'),
      ('health_topic_correction_structuring', 'Health topic correction structuring', 'Turns user clarifications into structured care-context corrections for future use.'),
      ('health_report_generation', 'Health report generation', 'Generates saved Health Focus reports and reusable Health Narratives.')
  ) as seeded(instruction_key, name, description)
),
inserted_sets as (
  insert into public.ai_instruction_sets (
    care_circle_id,
    instruction_key,
    name,
    description,
    is_active
  )
  select cc.id, seeded.instruction_key, seeded.name, seeded.description, true
  from public.care_circles cc
  cross join seeded_prompts seeded
  where not exists (
    select 1
    from public.ai_instruction_sets existing
    where existing.care_circle_id = cc.id
      and existing.instruction_key = seeded.instruction_key
  )
  returning id, instruction_key
),
target_sets as (
  select ais.id, ais.instruction_key
  from public.ai_instruction_sets ais
  where ais.instruction_key in (select instruction_key from seeded_prompts)
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
    when 'health_topic_extraction' then 'You extract Health Focus topics from CarePland source text. Use only supplied data. Prefer user-friendly topics over diagnosis coding. Return structured JSON only.'
    when 'health_topic_normalization' then 'You map health-related language to CarePland standard topic slugs. Preserve user language, avoid over-medicalizing, and return structured JSON only.'
    when 'health_topic_relationship_detection' then 'You decide whether co-mentioned topics appear related, separate, or unclear based only on supplied CarePland source data. Avoid medical conclusions. Return structured JSON only.'
    when 'health_focus_card_summary' then 'You write condensed Health Focus card summaries. The three context pills already explain recency, frequency, and span, so do not repeat those details. Target 120-160 characters, hard max 200. Choose the most important insight and stop.'
    when 'health_story_narrative_summary' then 'You write concise Health Story summaries from saved CarePland data. Explain the care story in human language, not a topic relationship graph. Use varied, conversational phrase patterns. Avoid repeating phrases like appears in, was discussed in, or was mentioned in. Only include statuses or relationships that are supported by the supplied data. Do not provide medical advice or diagnosis. Return structured JSON only.'
    when 'health_story_timeline_summary' then 'You write approximate Health Story timeline notes. Use broad timing labels and source-backed events. Avoid timestamps unless explicitly requested. Return structured JSON only.'
    when 'health_story_source_snippet_selection' then 'You select short source snippets that help users trust a Health Story. Prefer meaningful source text over matched-term fallbacks. Return structured JSON only.'
    when 'health_story_feedback_acknowledgement' then 'You define how CarePland acknowledges saved Health Story feedback. Reinforce that the user is improving their own story and context. Avoid promises about model learning, permanent changes, guaranteed future behavior, or retraining. Keep the tone calm, clear, brief, and human.'
    when 'health_topic_feedback_interpretation' then 'You interpret user feedback on Health Focus or Health Story output. Decide whether the user confirmed, corrected, clarified, or rejected the interpretation. Return structured JSON only.'
    when 'health_topic_correction_structuring' then 'You convert user clarification into structured care-context corrections that can influence future Health Focus, CarePrep, and reports. Use only the user correction and supplied CarePland context. Return structured JSON only.'
    else 'You generate saved CarePland Health Focus reports from source-backed topic context and user corrections. Do not provide medical advice or diagnosis. Return structured JSON only.'
  end,
  case target_sets.instruction_key
    when 'health_topic_extraction' then 'Use the supplied source text, appointment metadata, topic catalog, and prior user corrections. Return candidate topic mentions with confidence, status suggestion, source anchor, and related topic slugs.'
    when 'health_topic_normalization' then 'Use the supplied candidate topic language and topic catalog. Return normalized topic slugs and any uncertain mappings.'
    when 'health_topic_relationship_detection' then 'Use the supplied topic mentions, source snippets, appointment metadata, and user corrections. Return relationship assessments and rationale.'
    when 'health_focus_card_summary' then 'Use the supplied source mentions, related topics, provider context, and user corrections. Return both full_summary and condensed_summary. condensed_summary must be human, specific, and under 200 characters.'
    when 'health_story_narrative_summary' then 'Use the supplied source appointments, topic mentions, context signature, related topics, timeline, and user corrections. Return a concise Health Story summary. Prefer observations over explanations, avoid exact counts or percentages unless requested, and choose the most natural relevant phrasing from care journey, context, time, and connection language.'
    when 'health_story_timeline_summary' then 'Use the supplied dated source mentions and corrections. Return timeline items using approximate date labels and source-backed event summaries.'
    when 'health_story_source_snippet_selection' then 'Use the supplied source text and topic focus. Return the most helpful short snippets and source anchors.'
    when 'health_story_feedback_acknowledgement' then 'After Health Story feedback is saved, select one approved acknowledgement phrase, summarize what the user indicated, show Undo for a limited period, and then remove the acknowledgement. Approved phrases: Thank you — your context will improve future stories. Thank you — your context improves future stories. Thank you — your context helps build better stories. Thank you — your feedback helps improve your stories. Thank you — your care history improves with this feedback. Thank you — your context helps connect future visits.'
    when 'health_topic_feedback_interpretation' then 'Use the system output shown to the user and the user feedback. Return feedback mode, value, relationship feedback if any, and whether it should influence future generation.'
    when 'health_topic_correction_structuring' then 'Use the user clarification and target topic/story context. Return durable structured context for future Health Focus, CarePrep, and report generation.'
    else 'Use the supplied topic summaries, source appointments, topic mentions, user corrections, and requested report type. Return a saved-report draft with source references.'
  end,
  '{}'::jsonb,
  'gpt-4.1-mini',
  0.2,
  true,
  'Initial Health Focus prompt path seed',
  md5(target_sets.id::text || '|' || target_sets.instruction_key || '|health-focus-feedback-prompts-v1')
from target_sets;
