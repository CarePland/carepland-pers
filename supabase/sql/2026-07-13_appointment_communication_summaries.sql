-- Appointment communication-derived knowledge foundation.
--
-- Raw Connect messages remain the authoritative evidence. This table stores a
-- maintained appointment-scoped inventory derived from appointment-linked
-- messages so it can be rendered alongside existing What to Know categories
-- without flattening communication into CarePrep rows.

create table if not exists public.appointment_communication_summaries (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  care_circle_id uuid not null,
  main_connect_user_person_id uuid not null references public.care_subjects(id) on delete cascade,
  summary_items jsonb not null default '[]'::jsonb,
  summary_version integer not null default 0 check (summary_version >= 0),
  last_processed_message_id uuid references public.connect_messages(id) on delete set null,
  last_substantive_message_id uuid references public.connect_messages(id) on delete set null,
  generation_status text not null default 'completed' check (
    generation_status in ('processing', 'completed', 'no_change', 'failed')
  ),
  model text,
  prompt_version text,
  prompt_metadata jsonb not null default '{}'::jsonb,
  decision_trace jsonb not null default '{}'::jsonb,
  source_message_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id)
);

comment on table public.appointment_communication_summaries is
  'Appointment-scoped inventory of knowledge derived from appointment-linked Connect messages. Raw messages remain authoritative evidence.';

comment on column public.appointment_communication_summaries.summary_items is
  'Structured communication-derived items with category, display text, source message ids, status, and timestamps.';

create index if not exists appointment_communication_summaries_person_idx
  on public.appointment_communication_summaries (
    main_connect_user_person_id,
    updated_at desc
  );

create index if not exists appointment_communication_summaries_care_circle_idx
  on public.appointment_communication_summaries (care_circle_id, updated_at desc);

create index if not exists appointment_communication_summaries_last_message_idx
  on public.appointment_communication_summaries (last_processed_message_id)
  where last_processed_message_id is not null;

alter table public.appointment_communication_summaries enable row level security;

drop policy if exists appointment_communication_summaries_member_select
  on public.appointment_communication_summaries;
create policy appointment_communication_summaries_member_select
on public.appointment_communication_summaries
for select
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = appointment_communication_summaries.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists appointment_communication_summaries_member_insert
  on public.appointment_communication_summaries;
create policy appointment_communication_summaries_member_insert
on public.appointment_communication_summaries
for insert
with check (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = appointment_communication_summaries.care_circle_id
      and ccm.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.appointments a
    where a.id = appointment_communication_summaries.appointment_id
      and a.care_circle_id = appointment_communication_summaries.care_circle_id
      and a.care_subject_id = appointment_communication_summaries.main_connect_user_person_id
      and a.deleted_at is null
  )
);

drop policy if exists appointment_communication_summaries_member_update
  on public.appointment_communication_summaries;
create policy appointment_communication_summaries_member_update
on public.appointment_communication_summaries
for update
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = appointment_communication_summaries.care_circle_id
      and ccm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = appointment_communication_summaries.care_circle_id
      and ccm.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.appointments a
    where a.id = appointment_communication_summaries.appointment_id
      and a.care_circle_id = appointment_communication_summaries.care_circle_id
      and a.care_subject_id = appointment_communication_summaries.main_connect_user_person_id
      and a.deleted_at is null
  )
);

grant select, insert, update, delete on public.appointment_communication_summaries to service_role;

with summary_schema as (
  select '{
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "action": { "type": "string", "enum": ["NO_CHANGE", "UPDATED"] },
      "inventory": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": false,
              "properties": {
                "id": { "type": "string" },
                "category": {
                  "type": "string",
                  "enum": [
                    "bring_list",
                    "key_questions",
                    "watchouts",
                    "med_review",
                    "since_last_visit",
                    "next_steps"
                  ]
                },
                "text": { "type": "string", "minLength": 1, "maxLength": 180 },
                "sourceType": { "type": "string", "const": "communication" },
                "sourceMessageIds": { "type": "array", "items": { "type": "string" } },
                "status": { "type": "string", "enum": ["active", "resolved"] }
              },
              "required": [
                "id",
                "category",
                "text",
                "sourceType",
                "sourceMessageIds",
                "status"
              ]
            }
          }
        },
        "required": ["items"]
      }
    },
    "required": ["action", "inventory"]
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
    'appointment_communication_summary',
    'Appointment communication summary',
    'Maintains appointment-scoped What to Know inventory derived from appointment-linked messages while preserving raw messages as evidence.',
    true
  from public.care_circles cc
  where not exists (
    select 1
    from public.ai_instruction_sets existing
    where existing.care_circle_id = cc.id
      and existing.instruction_key = 'appointment_communication_summary'
  )
  returning id
), target_sets as (
  select ais.id
  from public.ai_instruction_sets ais
  where ais.instruction_key = 'appointment_communication_summary'
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
  'Maintain a conservative appointment-scoped communication inventory. Raw Connect messages remain authoritative evidence. Use only the existing appointment categories: bring_list, key_questions, watchouts, med_review, since_last_visit, and next_steps. Do not infer facts, completion, acknowledgement, or commitments beyond the newest message. Trivial replies such as OK, thanks, got it, thumbs up, sounds good, and will do should normally return NO_CHANGE. Substantive messages may add, refine, replace, merge, resolve, or remove items only when the message clearly supports the change. Return structured JSON only.',
  'Inputs include the current communication-derived inventory, the newest appointment-linked message, sender/recipient context, minimal appointment context, and category definitions. Return NO_CHANGE with the unchanged inventory, or UPDATED with the complete revised inventory. Keep item text concise and user-facing. Preserve sourceMessageIds for every item and include the newest message id only on items supported by it. Do not include unsupported source message ids. Do not duplicate substantially identical items.',
  summary_schema.body,
  'gpt-4.1-mini',
  0.1,
  true,
  'Initial appointment communication-summary prompt contract',
  md5(
    target_sets.id::text || '|appointment_communication_summary|initial|'
    || summary_schema.body::text
  )
from target_sets
cross join summary_schema;
