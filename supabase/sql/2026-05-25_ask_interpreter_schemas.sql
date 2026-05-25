with interpreter_schemas as (
  select
    'ask_feature_interpreter'::text as instruction_key,
    'You are the CarePland Personal Ask feature/workflow interpreter. Convert the routed Ask conversation into structured review candidates for Admin. Preserve the user''s original wording and intent. Extract the suggested feature or workflow, pain point, desired outcome, affected app area, urgency clues, and a concise recommended action. Do not make roadmap commitments. Return valid JSON exactly matching the schema.'::text as system_prompt,
    'Use the supplied Ask thread, router decision, current page, and app context. Return structured review data for wishlist/workflow routing. Preserve the user''s original language and intent; do not invent commitments.'::text as user_prompt_template,
    '{
      "additionalProperties": false,
      "properties": {
        "interpretation": {
          "additionalProperties": false,
          "properties": {
            "affected_app_area": { "type": "string" },
            "desired_outcome": { "type": "string" },
            "pain_point": { "type": "string" },
            "suggested_feature_or_workflow": { "type": "string" },
            "urgency_clues": { "type": "string" }
          },
          "required": [
            "affected_app_area",
            "desired_outcome",
            "pain_point",
            "suggested_feature_or_workflow",
            "urgency_clues"
          ],
          "type": "object"
        },
        "recommended_actions": {
          "items": {
            "additionalProperties": false,
            "properties": {
              "action": {
                "enum": [
                  "create_wishlist_item",
                  "create_workflow_item",
                  "needs_human_review"
                ],
                "type": "string"
              },
              "app_area": { "type": "string" },
              "category": {
                "enum": ["feature_request", "workflow_feedback"],
                "type": "string"
              },
              "confidence": { "type": "number" },
              "desired_outcome": { "type": "string" },
              "pain_point": { "type": "string" },
              "priority": { "enum": ["low", "medium", "high"], "type": "string" },
              "rationale": { "type": "string" },
              "suggested_feature": { "type": "string" },
              "title": { "type": "string" },
              "urgency": { "type": "string" }
            },
            "required": [
              "action",
              "app_area",
              "category",
              "confidence",
              "desired_outcome",
              "pain_point",
              "priority",
              "rationale",
              "suggested_feature",
              "title",
              "urgency"
            ],
            "type": "object"
          },
          "type": "array"
        }
      },
      "required": ["interpretation", "recommended_actions"],
      "type": "object"
    }'::jsonb as output_schema
  union all
  select
    'ask_bug_interpreter',
    'You are the CarePland Personal Ask bug/friction interpreter. Convert the routed Ask conversation into structured review candidates for Admin. Capture what the user tried to do, what they expected, what happened instead, affected app area, reproducibility clues, and whether this may be usability confusion rather than a product defect. Do not overstate certainty. Return valid JSON exactly matching the schema.',
    'Use the supplied Ask thread, router decision, current page, and app context. Return structured review data for bug/friction routing. Distinguish likely product defects from usability confusion when possible, without overstating certainty.',
    '{
      "additionalProperties": false,
      "properties": {
        "interpretation": {
          "additionalProperties": false,
          "properties": {
            "actual_behavior": { "type": "string" },
            "affected_app_area": { "type": "string" },
            "expected_behavior": { "type": "string" },
            "possible_usability_confusion": { "type": "boolean" },
            "reproducibility_clues": { "type": "string" },
            "tried_to_do": { "type": "string" }
          },
          "required": [
            "actual_behavior",
            "affected_app_area",
            "expected_behavior",
            "possible_usability_confusion",
            "reproducibility_clues",
            "tried_to_do"
          ],
          "type": "object"
        },
        "recommended_actions": {
          "items": {
            "additionalProperties": false,
            "properties": {
              "action": {
                "enum": [
                  "create_bug_item",
                  "create_workflow_item",
                  "needs_human_review"
                ],
                "type": "string"
              },
              "actual_behavior": { "type": "string" },
              "app_area": { "type": "string" },
              "category": {
                "enum": ["bug_report", "workflow_feedback"],
                "type": "string"
              },
              "confidence": { "type": "number" },
              "expected_behavior": { "type": "string" },
              "possible_usability_confusion": { "type": "boolean" },
              "priority": { "enum": ["low", "medium", "high"], "type": "string" },
              "rationale": { "type": "string" },
              "reproducibility_clues": { "type": "string" },
              "title": { "type": "string" },
              "tried_to_do": { "type": "string" }
            },
            "required": [
              "action",
              "actual_behavior",
              "app_area",
              "category",
              "confidence",
              "expected_behavior",
              "possible_usability_confusion",
              "priority",
              "rationale",
              "reproducibility_clues",
              "title",
              "tried_to_do"
            ],
            "type": "object"
          },
          "type": "array"
        }
      },
      "required": ["interpretation", "recommended_actions"],
      "type": "object"
    }'::jsonb
), target_sets as (
  select
    ais.id as instruction_set_id,
    ais.instruction_key,
    interpreter_schemas.system_prompt,
    interpreter_schemas.user_prompt_template,
    interpreter_schemas.output_schema,
    coalesce(max(aiv.version_number), 0) + 1 as next_version_number
  from public.ai_instruction_sets ais
  join interpreter_schemas
    on interpreter_schemas.instruction_key = ais.instruction_key
  left join public.ai_instruction_versions aiv
    on aiv.instruction_set_id = ais.id
  where ais.instruction_key in (
    'ask_feature_interpreter',
    'ask_bug_interpreter'
  )
  group by
    ais.id,
    ais.instruction_key,
    interpreter_schemas.system_prompt,
    interpreter_schemas.user_prompt_template,
    interpreter_schemas.output_schema
), inserted_versions as (
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
    target_sets.instruction_set_id,
    target_sets.next_version_number,
    target_sets.system_prompt,
    target_sets.user_prompt_template,
    target_sets.output_schema,
    'gpt-4.1-mini',
    0.2,
    true,
    'Add structured Ask interpreter runtime schemas',
    md5(
      target_sets.instruction_set_id::text ||
      '|ask-interpreter-schema|' ||
      target_sets.instruction_key ||
      '|' ||
      target_sets.output_schema::text
    )
  from target_sets
  where not exists (
    select 1
    from public.ai_instruction_versions existing
    where existing.instruction_set_id = target_sets.instruction_set_id
      and existing.content_hash = md5(
        target_sets.instruction_set_id::text ||
        '|ask-interpreter-schema|' ||
        target_sets.instruction_key ||
        '|' ||
        target_sets.output_schema::text
      )
  )
  returning id, instruction_set_id
)
update public.ai_instruction_versions existing
set is_current = false
where existing.instruction_set_id in (
    select instruction_set_id from inserted_versions
  )
  and existing.id not in (
    select id from inserted_versions
  );
