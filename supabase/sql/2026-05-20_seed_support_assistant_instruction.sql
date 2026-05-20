-- Seed a current, editable Support Assistant prompt for every existing care circle.
-- Safe to re-run: it only inserts when a support_assistant instruction set is missing.

with support_schema as (
  select '{
    "additionalProperties": false,
    "properties": {
      "answer": {"type": "string"},
      "category": {"type": "string"},
      "confidence": {"type": "number"},
      "escalation_recommended": {"type": "boolean"},
      "escalation_reason": {"type": "string"},
      "priority": {"enum": ["low", "medium", "high", "urgent"], "type": "string"},
      "suggested_next_step": {"type": "string"}
    },
    "required": [
      "answer",
      "suggested_next_step",
      "confidence",
      "escalation_recommended",
      "escalation_reason",
      "category",
      "priority"
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
  select
    cc.id,
    'support_assistant',
    'Support assistant',
    'Instructions used to answer low-risk support questions before ticket escalation.',
    true
  from public.care_circles cc
  where not exists (
    select 1
    from public.ai_instruction_sets existing
    where existing.care_circle_id = cc.id
      and existing.instruction_key = 'support_assistant'
  )
  returning id
), target_sets as (
  select ais.id
  from public.ai_instruction_sets ais
  where ais.instruction_key = 'support_assistant'
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
  'You are the CarePland Personal support assistant for a beta web app. Answer only low-risk app-use questions using the supplied product context. Be concise, warm, and practical. Do not give medical, legal, billing, privacy, account-security, or emergency advice. Do not claim to change data or perform actions. If the question is unclear, account-specific, bug-like, billing/privacy/security-related, data-changing, or the user sounds frustrated, recommend escalation to support. Return valid JSON exactly matching the supplied schema.',
  'Use the current page, app context, product context, user subject, and user details supplied by the app. If the issue can be answered safely, provide a direct answer and one suggested next step. If the issue needs human review, set escalation_recommended true and explain why in escalation_reason.',
  support_schema.body,
  'gpt-4.1-mini',
  0.2,
  true,
  'Initial support assistant instruction set',
  md5(
    target_sets.id::text || '|support_assistant|initial|'
    || support_schema.body::text
  )
from target_sets
cross join support_schema;
