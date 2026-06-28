-- Seeds the Admin-managed Connect call care-summary prompt.
-- Safe to re-run. Creates the instruction set/version only when missing.

with summary_schema as (
  select '{
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "summary_text": { "type": "string" },
      "has_care_relevant_content": { "type": "boolean" },
      "omitted_reason": { "type": "string" }
    },
    "required": ["summary_text", "has_care_relevant_content", "omitted_reason"]
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
    'connect_call_care_summary',
    'Connect call care summary',
    'Creates brief care-record summaries from temporary call transcripts while omitting general conversation.',
    true
  from public.care_circles cc
  where not exists (
    select 1
    from public.ai_instruction_sets existing
    where existing.care_circle_id = cc.id
      and existing.instruction_key = 'connect_call_care_summary'
  )
  returning id
), target_sets as (
  select ais.id
  from public.ai_instruction_sets ais
  where ais.instruction_key = 'connect_call_care_summary'
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
  'Create a brief care summary from this Connect call transcript. Include only information that could reasonably belong in a health or caregiving record. Do not summarize general conversation. Include medication discussions, symptoms, pain, mobility, sleep, appetite, weight, blood sugar or blood pressure readings, cognitive changes, clinically relevant mood or function changes, upcoming appointments, provider instructions, caregiver observations, follow-up actions, and equipment such as walker, hearing aids, oxygen, or similar. Do not include family gossip, politics, sports, TV shows, personal opinions, financial discussions unless directly related to obtaining care, vacation plans, relationships, general chatting, jokes, religious discussion, or embarrassing details with no care relevance. Include contextual life details only if they directly affect care. When uncertain, omit. CarePland should err toward under-documenting rather than creating an unnecessarily invasive record. Return structured JSON only.',
  'Use the supplied temporary call transcript. Write 1-2 concise sentences in summary_text when care-relevant content is present. If there is no care-relevant content, set has_care_relevant_content false, leave summary_text empty, and explain briefly in omitted_reason. Do not include or quote the full transcript.',
  summary_schema.body,
  'gpt-4.1-mini',
  0.1,
  true,
  'Initial Connect call care-summary prompt',
  md5(
    target_sets.id::text || '|connect_call_care_summary|initial|'
    || summary_schema.body::text
  )
from target_sets
cross join summary_schema;
