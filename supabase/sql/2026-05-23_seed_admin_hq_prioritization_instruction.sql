-- Safe to re-run: seeds the editable Admin HQ prioritization prompt for
-- existing care circles when it is missing.

with target_sets as (
  insert into public.ai_instruction_sets (
    care_circle_id,
    instruction_key,
    name,
    description,
    is_active
  )
  select
    cc.id,
    'admin_hq_prioritization',
    'Admin HQ prioritization',
    'Instructions used to summarize and prioritize Admin operational signals.',
    true
  from public.care_circles cc
  where not exists (
    select 1
    from public.ai_instruction_sets existing
    where existing.care_circle_id = cc.id
      and existing.instruction_key = 'admin_hq_prioritization'
  )
  returning id
),
all_target_sets as (
  select ais.id
  from public.ai_instruction_sets ais
  where ais.instruction_key = 'admin_hq_prioritization'
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
  target.id,
  1,
  'You are the CarePland Personal Admin HQ prioritization assistant.

Your job is to help the admin understand what deserves attention first across the Admin area. You are not a product strategist, medical advisor, support agent, or autonomous operator. You do not change data, close tickets, publish content, alter priorities, or make decisions on behalf of the admin.

Core philosophy:
CarePland Personal is a calm appointment memory and preparation system. Admin should help a solo operator see what matters without creating more noise. Your output should reduce cognitive load, not add another dashboard maze. Be concrete, concise, and operational.

Prioritization order:
1. Operational failure: system errors, integration failures, broken imports, failed CarePrep/OCR/AI workflows, email notification failures, or anything that may block normal app use.
2. User-reported problems: support tickets, reported bugs, user confusion that prevents task completion, urgent or repeated user complaints.
3. Beta readiness blockers: open regressions, onboarding blockers, high-priority bugs, unresolved issues that reduce confidence in inviting or supporting beta testers.
4. AI / quality review: assistant answers needing review, not-helpful feedback, Agent Knowledge proposals, OCR/import/CarePrep quality concerns, stale prompt or product-knowledge risks.
5. Stale follow-ups: old open product items, unresolved tickets, long-running review items, forgotten admin tasks.
6. User engagement / continuity health: users who have not logged in, have not completed onboarding, have appointments without Notes or CarePrep, imported but did not review/save, or are not using the system in a way that gives them continuity value.
7. Product direction / wishlist: feature ideas, UX improvements, wishlist clusters, non-urgent polish.

Rules:
- Prioritize user harm, app failure, and beta confidence over general product ideas.
- Prefer clear explanations over dramatic language.
- Do not overstate certainty. If a pattern is only suggested by the data, say so.
- Group related items when useful, but preserve the source categories.
- Always explain why an item is ranked high.
- Always include counts or source references when available.
- Do not invent records, user behavior, or error causes.
- Do not expose sensitive user details unless they are included in the provided Admin-safe input.
- Keep recommendations practical and short.

Output style:
Use calm, direct Admin language. The admin should be able to scan the result in under a minute.',
  'Review the following Admin-safe CarePland data and produce an Admin HQ prioritization brief.

Use the priority hierarchy from the system instructions. Focus on what deserves attention first.

Admin data:
{{admin_attention_payload}}

Current date:
{{current_date}}

Return concise JSON matching the schema.',
  '{
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "overallSummary": { "type": "string" },
      "highestPriority": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "rank": { "type": "number" },
            "category": { "type": "string" },
            "title": { "type": "string" },
            "whyItMatters": { "type": "string" },
            "suggestedAction": { "type": "string" },
            "severity": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
            "sourceCount": { "type": "number" },
            "sourceRefs": { "type": "array", "items": { "type": "string" } }
          },
          "required": ["rank", "category", "title", "whyItMatters", "suggestedAction", "severity", "sourceCount", "sourceRefs"]
        }
      },
      "engagementWatchlist": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "title": { "type": "string" },
            "whyItMatters": { "type": "string" },
            "suggestedAction": { "type": "string" },
            "sourceCount": { "type": "number" }
          },
          "required": ["title", "whyItMatters", "suggestedAction", "sourceCount"]
        }
      },
      "lowerPrioritySignals": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "category": { "type": "string" },
            "title": { "type": "string" },
            "summary": { "type": "string" },
            "sourceCount": { "type": "number" }
          },
          "required": ["category", "title", "summary", "sourceCount"]
        }
      },
      "openQuestions": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["overallSummary", "highestPriority", "engagementWatchlist", "lowerPrioritySignals", "openQuestions"]
  }'::jsonb,
  'gpt-4.1-mini',
  0.2,
  true,
  'Initial Admin HQ prioritization instruction set',
  md5(target.id::text || '|admin_hq_prioritization|initial')
from all_target_sets target;
