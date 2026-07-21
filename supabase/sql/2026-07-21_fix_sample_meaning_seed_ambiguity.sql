-- Refreshes demo/sample data so it exercises the current "meaning becomes
-- action" surfaces: Recommendations, Today's Focus, Track, Connect messages,
-- and CarePland Work Events.
--
-- This intentionally layers on top of the existing Health Focus sample seed
-- instead of replacing that larger longitudinal care-history scenario.

create or replace function public.remove_sample_meaning_layer_for_current_user()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_user_id uuid := auth.uid();
  v_target_care_circle_id uuid;
  v_seed_version text := 'sample_seed_meaning_v3';
  removed_focus_count integer := 0;
  removed_message_count integer := 0;
  removed_recommendation_count integer := 0;
  removed_work_event_count integer := 0;
begin
  if v_caller_user_id is null then
    raise exception 'Must be signed in to remove sample meaning data';
  end if;

  select ccm.care_circle_id
    into v_target_care_circle_id
  from public.care_circle_memberships ccm
  where ccm.user_id = v_caller_user_id
    and ccm.status = 'active'
  order by case when ccm.role = 'owner' then 0 else 1 end, ccm.created_at
  limit 1;

  if v_target_care_circle_id is null then
    return jsonb_build_object('status', 'missing_care_circle');
  end if;

  create temp table _sample_meaning_recommendations on commit drop as
  select cr.id
  from public.care_recommendations cr
  where cr.care_circle_id = v_target_care_circle_id
    and coalesce(cr.metadata->>'sample_data_seed_version', '') = v_seed_version;

  create temp table _sample_meaning_focus_items on commit drop as
  select fi.id
  from public.focus_items fi
  where fi.care_circle_id = v_target_care_circle_id
    and coalesce(fi.metadata->>'sample_data_seed_version', '') = v_seed_version;

  create temp table _sample_meaning_messages on commit drop as
  select cm.id
  from public.connect_messages cm
  where cm.care_circle_id = v_target_care_circle_id
    and coalesce(cm.metadata->>'sample_data_seed_version', '') = v_seed_version;

  select count(*) into removed_recommendation_count from _sample_meaning_recommendations;
  select count(*) into removed_focus_count from _sample_meaning_focus_items;
  select count(*) into removed_message_count from _sample_meaning_messages;

  delete from public.care_recommendation_review_events crre
  where crre.care_circle_id = v_target_care_circle_id
    and (
      crre.recommendation_id in (
        select smr.id from _sample_meaning_recommendations smr
      )
      or coalesce(crre.metadata->>'sample_data_seed_version', '') = v_seed_version
    );

  delete from public.care_recommendation_evidence cre
  where cre.care_circle_id = v_target_care_circle_id
    and cre.recommendation_id in (
      select smr.id from _sample_meaning_recommendations smr
    );

  delete from public.care_recommendations cr
  where cr.id in (select smr.id from _sample_meaning_recommendations smr);

  delete from public.track_events te
  where te.care_circle_id = v_target_care_circle_id
    and (
      te.focus_item_id in (select smf.id from _sample_meaning_focus_items smf)
      or coalesce(te.metadata->>'sample_data_seed_version', '') = v_seed_version
    );

  delete from public.focus_items fi
  where fi.id in (select smf.id from _sample_meaning_focus_items smf);

  delete from public.connect_message_events cme
  where cme.care_circle_id = v_target_care_circle_id
    and (
      cme.message_id in (select smm.id from _sample_meaning_messages smm)
      or coalesce(cme.details->>'sample_data_seed_version', '') = v_seed_version
    );

  delete from public.connect_messages cm
  where cm.id in (select smm.id from _sample_meaning_messages smm);

  delete from public.focus_cadence_preferences fcp
  where fcp.care_circle_id = v_target_care_circle_id
    and coalesce(fcp.metadata->>'sample_data_seed_version', '') = v_seed_version;

  delete from public.carepland_work_events cwe
  where cwe.care_circle_id = v_target_care_circle_id
    and coalesce(cwe.metadata->>'sample_data_seed_version', '') = v_seed_version;
  get diagnostics removed_work_event_count = row_count;

  update public.profiles p
    set sample_data_seed_version = case
      when p.sample_data_seed_version = v_seed_version then 'sample_seed_health_focus_v2'
      else p.sample_data_seed_version
    end
  where p.id = v_caller_user_id;

  return jsonb_build_object(
    'status', 'removed',
    'focus_items_removed', removed_focus_count,
    'messages_removed', removed_message_count,
    'recommendations_removed', removed_recommendation_count,
    'work_events_removed', removed_work_event_count
  );
end;
$$;

create or replace function public.seed_sample_meaning_layer_for_user(
  target_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_user_id uuid := auth.uid();
  v_caller_is_admin boolean := false;
  v_effective_target_user_id uuid;
  v_target_profile public.profiles%rowtype;
  v_target_care_circle_id uuid;
  v_target_subject_id uuid;
  v_caregiver_subject_id uuid;
  v_seeded_at timestamptz := now();
  v_seed_version text := 'sample_seed_meaning_v3';
  v_focus_count integer := 0;
  v_message_count integer := 0;
  v_recommendation_count integer := 0;
  v_work_event_count integer := 0;
begin
  if v_caller_user_id is null then
    raise exception 'Must be signed in to seed sample meaning data';
  end if;

  v_effective_target_user_id := coalesce(target_user_id, v_caller_user_id);

  select coalesce(p.is_admin, false)
    into v_caller_is_admin
  from public.profiles p
  where p.id = v_caller_user_id;

  if v_effective_target_user_id <> v_caller_user_id and not coalesce(v_caller_is_admin, false) then
    raise exception 'Only an admin can seed sample meaning data for another user';
  end if;

  select p.*
    into v_target_profile
  from public.profiles p
  where p.id = v_effective_target_user_id
  for update;

  if not found then
    return jsonb_build_object('status', 'no_profile');
  end if;

  if v_target_profile.sample_data_seeded_at is null then
    return jsonb_build_object('status', 'sample_data_not_seeded');
  end if;

  select ccm.care_circle_id
    into v_target_care_circle_id
  from public.care_circle_memberships ccm
  where ccm.user_id = v_effective_target_user_id
    and ccm.status = 'active'
  order by case when ccm.role = 'owner' then 0 else 1 end, ccm.created_at
  limit 1;

  if v_target_care_circle_id is null then
    return jsonb_build_object('status', 'missing_care_circle');
  end if;

  select cs.id
    into v_target_subject_id
  from public.care_subjects cs
  where cs.care_circle_id = v_target_care_circle_id
    and cs.is_active = true
    and coalesce(cs.is_sample_data, false) = false
  order by cs.is_default desc, cs.created_at
  limit 1;

  if v_target_subject_id is null then
    select cs.id
      into v_target_subject_id
    from public.care_subjects cs
    where cs.care_circle_id = v_target_care_circle_id
      and cs.is_active = true
    order by cs.is_default desc, cs.created_at
    limit 1;
  end if;

  select cs.id
    into v_caregiver_subject_id
  from public.care_subjects cs
  where cs.care_circle_id = v_target_care_circle_id
    and cs.display_name = 'Sample: Mom Bobson'
    and coalesce(cs.is_sample_data, false) = true
  order by cs.created_at desc
  limit 1;

  if v_target_subject_id is null then
    return jsonb_build_object('status', 'missing_care_vip');
  end if;

  perform public.remove_sample_meaning_layer_for_current_user()
  where v_effective_target_user_id = v_caller_user_id;

  if v_effective_target_user_id <> v_caller_user_id then
    -- Admin reseeds another user's sample meaning layer directly.
    delete from public.care_recommendation_review_events crre
    where crre.care_circle_id = v_target_care_circle_id
      and coalesce(crre.metadata->>'sample_data_seed_version', '') = v_seed_version;
    delete from public.care_recommendation_evidence cre
    where cre.care_circle_id = v_target_care_circle_id
      and cre.recommendation_id in (
        select cr.id from public.care_recommendations cr
        where cr.care_circle_id = v_target_care_circle_id
          and coalesce(cr.metadata->>'sample_data_seed_version', '') = v_seed_version
      );
    delete from public.care_recommendations cr
    where cr.care_circle_id = v_target_care_circle_id
      and coalesce(cr.metadata->>'sample_data_seed_version', '') = v_seed_version;
    delete from public.track_events te
    where te.care_circle_id = v_target_care_circle_id
      and coalesce(te.metadata->>'sample_data_seed_version', '') = v_seed_version;
    delete from public.focus_items fi
    where fi.care_circle_id = v_target_care_circle_id
      and coalesce(fi.metadata->>'sample_data_seed_version', '') = v_seed_version;
    delete from public.connect_message_events cme
    where cme.care_circle_id = v_target_care_circle_id
      and coalesce(cme.details->>'sample_data_seed_version', '') = v_seed_version;
    delete from public.connect_messages cm
    where cm.care_circle_id = v_target_care_circle_id
      and coalesce(cm.metadata->>'sample_data_seed_version', '') = v_seed_version;
    delete from public.focus_cadence_preferences fcp
    where fcp.care_circle_id = v_target_care_circle_id
      and coalesce(fcp.metadata->>'sample_data_seed_version', '') = v_seed_version;
    delete from public.carepland_work_events cwe
    where cwe.care_circle_id = v_target_care_circle_id
      and coalesce(cwe.metadata->>'sample_data_seed_version', '') = v_seed_version;
  end if;

  create temp table _sample_meaning_focus_map (
    seed_key text primary key,
    focus_item_id uuid not null
  ) on commit drop;

  with seeded_focus(seed_key, title, prompt_text, completion_type, completion_event_type, completion_prompt_text, completion_config, importance_score, sort_order) as (
    values
      ('bp_log', 'Track home blood pressure readings', 'Add today''s home BP reading if you have one.', 'measured_value', 'measurement.blood_pressure', 'Enter the systolic and diastolic reading.', jsonb_build_object('unit', 'mmHg', 'fields', jsonb_build_array('systolic', 'diastolic')), 90, 10),
      ('short_walk', 'Take a short walk', 'A short walk helps keep the mobility thread visible.', 'simple_done', 'activity.walking', 'Mark when the walk is done.', '{}'::jsonb, 76, 20),
      ('weight_check', 'Record weight', 'Record weight when it is part of the nutrition and lab follow-up.', 'measured_value', 'measurement.weight', 'Enter weight.', jsonb_build_object('unit', 'lb'), 72, 30),
      ('med_timing_note', 'Review medication timing notes', 'Capture anything new about dizziness and medication timing.', 'note_required', 'note.caregiver', 'Add a short note about timing or dizziness.', '{}'::jsonb, 68, 40)
  ),
  inserted as (
    insert into public.focus_items (
      care_circle_id,
      care_subject_id,
      title,
      focus_type,
      prompt_text,
      active_start_date,
      completion_type,
      completion_event_type,
      completion_prompt_text,
      completion_config,
      importance_score,
      sort_order,
      created_by_user_id,
      metadata
    )
    select
      v_target_care_circle_id,
      v_target_subject_id,
      sf.title,
      'sample_meaning',
      sf.prompt_text,
      v_seeded_at::date - 7,
      sf.completion_type,
      sf.completion_event_type,
      sf.completion_prompt_text,
      sf.completion_config,
      sf.importance_score,
      sf.sort_order,
      v_effective_target_user_id,
      jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', v_seed_version, 'sample_seed_key', sf.seed_key)
    from seeded_focus sf
    returning id, metadata
  )
  insert into _sample_meaning_focus_map (seed_key, focus_item_id)
  select i.metadata->>'sample_seed_key', i.id
  from inserted i;

  select count(*) into v_focus_count from _sample_meaning_focus_map;

  insert into public.track_events (
    care_circle_id,
    care_subject_id,
    focus_item_id,
    event_type,
    title,
    occurred_at,
    source,
    value,
    unit,
    note,
    structured_payload,
    confidence,
    created_by_user_id,
    metadata
  )
  select
    v_target_care_circle_id,
    v_target_subject_id,
    focus_map.focus_item_id,
    event.event_type,
    event.title,
    event.occurred_at,
    event.source,
    event.value,
    event.unit,
    event.note,
    event.structured_payload,
    1,
    v_effective_target_user_id,
    jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', v_seed_version, 'sample_seed_key', event.seed_key)
  from (
    values
      ('short_walk', 'activity.walking', 'Short walk completed', v_seeded_at - interval '1 day', 'receiver_today_focus', null::numeric, null::text, 'Marked done from Receiver Today''s Focus.', jsonb_build_object('durationMinutes', 12)),
      ('weight_check', 'measurement.weight', 'Weight recorded', v_seeded_at - interval '2 days', 'manual', 168.4::numeric, 'lb', 'Sample weight entry for nutrition follow-up.', jsonb_build_object('unit', 'lb')),
      ('bp_log', 'measurement.blood_pressure', 'Home blood pressure reading', v_seeded_at - interval '3 days', 'talk_voice', null::numeric, 'mmHg', 'Sample Talk capture: BP was 132 over 78 this morning.', jsonb_build_object('systolic', 132, 'diastolic', 78, 'transcript', 'My blood pressure was 132 over 78 this morning.'))
  ) as event(seed_key, event_type, title, occurred_at, source, value, unit, note, structured_payload)
  join _sample_meaning_focus_map focus_map
    on focus_map.seed_key = event.seed_key;

  create temp table _sample_meaning_recommendation_map (
    dedupe_key text primary key,
    recommendation_id uuid not null
  ) on commit drop;

  with seeded_recommendations(dedupe_key, title, description, reason, source_type, priority, confidence, structured_payload) as (
    values
      ('home_blood_pressure_monitoring', 'Track home blood pressure readings', 'A reviewable candidate to keep home BP readings ready for cardiology.', 'Primary care, urgent care, and cardiology notes all mention home blood pressure readings.', 'appointment_note', 'high', 0.88, jsonb_build_object('completionType', 'measured_value', 'completionEventType', 'measurement.blood_pressure', 'matchedTopics', jsonb_build_array('blood_pressure', 'home_monitoring'))),
      ('walking_balance_followup', 'Take a short walk', 'A gentle Focus candidate from PT and walking-tolerance context.', 'Physical therapy and nutrition notes mention walking tolerance and activity planning.', 'health_focus', 'normal', 0.74, jsonb_build_object('completionType', 'simple_done', 'completionEventType', 'activity.walking', 'matchedTopics', jsonb_build_array('walking_balance', 'physical_therapy'))),
      ('weight_nutrition_followup', 'Record weight', 'A measured-value candidate connected to nutrition and lab review.', 'Nutrition and weight were reviewed with cholesterol labs.', 'appointment_note', 'normal', 0.72, jsonb_build_object('completionType', 'measured_value', 'completionEventType', 'measurement.weight', 'matchedTopics', jsonb_build_array('nutrition_weight', 'lab_results'))),
      ('medication_timing_note', 'Review medication timing notes', 'A note-required candidate that avoids turning medication timing into an instruction.', 'Medication timing may matter for dizziness, so the useful action is to keep notes ready for review.', 'appointment_note', 'normal', 0.8, jsonb_build_object('completionType', 'note_required', 'completionEventType', 'note.caregiver', 'matchedTopics', jsonb_build_array('medication_changes', 'dizziness')))
  ),
  inserted as (
    insert into public.care_recommendations (
      care_circle_id,
      care_subject_id,
      recommendation_type,
      title,
      description,
      reason,
      dedupe_key,
      source_type,
      confidence,
      priority,
      status,
      created_by_user_id,
      structured_payload,
      metadata
    )
    select
      v_target_care_circle_id,
      v_target_subject_id,
      'daily_focus_candidate',
      sr.title,
      sr.description,
      sr.reason,
      sr.dedupe_key,
      sr.source_type,
      sr.confidence,
      sr.priority,
      case when sr.dedupe_key = 'home_blood_pressure_monitoring' then 'approved' else 'candidate' end,
      v_effective_target_user_id,
      sr.structured_payload || jsonb_build_object('recommendationTrace', jsonb_build_object('sampleSeedVersion', v_seed_version, 'generationRule', sr.dedupe_key)),
      jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', v_seed_version, 'sample_seed_key', sr.dedupe_key)
    from seeded_recommendations sr
    returning id, dedupe_key
  )
  insert into _sample_meaning_recommendation_map (dedupe_key, recommendation_id)
  select i.dedupe_key, i.id from inserted i;

  select count(*) into v_recommendation_count from _sample_meaning_recommendation_map;

  insert into public.care_recommendation_evidence (
    recommendation_id,
    care_circle_id,
    care_subject_id,
    source_type,
    source_table,
    source_id,
    source_label,
    evidence_text,
    evidence_hash,
    occurred_at,
    confidence,
    metadata
  )
  select
    rec.recommendation_id,
    v_target_care_circle_id,
    v_target_subject_id,
    evidence.source_type,
    evidence.source_table,
    evidence.source_id,
    evidence.source_label,
    evidence.evidence_text,
    md5(rec.dedupe_key || '|' || evidence.evidence_text),
    evidence.occurred_at,
    evidence.confidence,
    jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', v_seed_version)
  from _sample_meaning_recommendation_map rec
  join lateral (
    select
      case
        when rec.dedupe_key = 'home_blood_pressure_monitoring' then 'appointment_note'
        when rec.dedupe_key = 'walking_balance_followup' then 'health_focus'
        when rec.dedupe_key = 'weight_nutrition_followup' then 'appointment_note'
        else 'appointment_note'
      end as source_type,
      case
        when rec.dedupe_key = 'walking_balance_followup' then 'topic_mentions'
        else 'appointment_notes'
      end as source_table,
      case
        when rec.dedupe_key = 'home_blood_pressure_monitoring' then (
          select n.id from public.appointment_notes n where n.care_circle_id = v_target_care_circle_id and n.source = 'sample:primary_bp_dizziness' limit 1
        )
        when rec.dedupe_key = 'walking_balance_followup' then (
          select tm.id from public.topic_mentions tm where tm.care_circle_id = v_target_care_circle_id and tm.care_subject_id = v_target_subject_id and tm.normalized_topic_slug = 'walking_balance' limit 1
        )
        when rec.dedupe_key = 'weight_nutrition_followup' then (
          select n.id from public.appointment_notes n where n.care_circle_id = v_target_care_circle_id and n.source = 'sample:nutrition_labs' limit 1
        )
        else (
          select n.id from public.appointment_notes n where n.care_circle_id = v_target_care_circle_id and n.source = 'sample:cardiology_followup' limit 1
        )
      end as source_id,
      case
        when rec.dedupe_key = 'home_blood_pressure_monitoring' then 'Primary care blood pressure visit'
        when rec.dedupe_key = 'walking_balance_followup' then 'Walking and balance topic mention'
        when rec.dedupe_key = 'weight_nutrition_followup' then 'Nutrition and lab review'
        else 'Cardiology follow-up'
      end as source_label,
      case
        when rec.dedupe_key = 'home_blood_pressure_monitoring' then 'Track home blood pressure readings and bring the log to cardiology.'
        when rec.dedupe_key = 'walking_balance_followup' then 'Walking tolerance and balance were reviewed in PT.'
        when rec.dedupe_key = 'weight_nutrition_followup' then 'Nutrition and weight were reviewed with cholesterol labs.'
        else 'Medication timing may matter for dizziness.'
      end as evidence_text,
      v_seeded_at - interval '1 day' as occurred_at,
      0.86::numeric as confidence
  ) evidence on true;

  insert into public.care_recommendation_review_events (
    recommendation_id,
    care_circle_id,
    care_subject_id,
    action,
    recommendation_outcome,
    prior_status,
    resulting_status,
    review_note,
    reviewed_by_user_id,
    reviewed_at,
    metadata
  )
  select
    rec_map.recommendation_id,
    v_target_care_circle_id,
    v_target_subject_id,
    'approve',
    'approved',
    'candidate',
    'approved',
    'Sample review: this is useful because multiple visits mention home BP readings.',
    v_effective_target_user_id,
    v_seeded_at,
    jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', v_seed_version)
  from _sample_meaning_recommendation_map
    rec_map
  where rec_map.dedupe_key = 'home_blood_pressure_monitoring';

  create temp table _sample_meaning_message_map (
    client_message_id text primary key,
    message_id uuid not null
  ) on commit drop;

  with seeded_messages(client_message_id, sender_display_name, body, created_offset, delivered_offset, read_offset, acknowledged_offset, callback_offset, requires_ack, allows_callback) as (
    values
      ('sample:meaning:v3:med-list:sarah', 'Sarah', 'Please bring the current medication list to the upcoming visit. Dr. Allen may ask about timing.', interval '4 days', interval '4 days' - interval '5 minutes', interval '4 days' - interval '2 minutes', interval '4 days' - interval '1 minute', null::interval, true, false),
      ('sample:meaning:v3:med-list:amy', 'Amy', 'I also think the medication list should go with you, especially the timing notes.', interval '3 days', interval '3 days' - interval '5 minutes', interval '3 days' - interval '3 minutes', null::interval, null::interval, false, false),
      ('sample:meaning:v3:callback', 'Caregiver', 'If the dizziness comes back, tap call back and I will check in.', interval '2 days', interval '2 days' - interval '5 minutes', null::interval, null::interval, interval '2 days' - interval '1 minute', false, true)
  ),
  inserted as (
    insert into public.connect_messages (
      care_circle_id,
      main_connect_user_person_id,
      sender_role,
      sender_user_id,
      sender_display_name,
      recipient_display_name,
      body,
      requires_acknowledgement,
      allows_callback_request,
      delivered_at,
      read_at,
      acknowledged_at,
      callback_requested_at,
      client_message_id,
      source,
      metadata,
      created_at,
      updated_at
    )
    select
      v_target_care_circle_id,
      v_target_subject_id,
      'dashboard',
      v_effective_target_user_id,
      sm.sender_display_name,
      coalesce(nullif(v_target_profile.display_name, ''), nullif(v_target_profile.given_name, ''), 'Care VIP'),
      sm.body,
      sm.requires_ack,
      sm.allows_callback,
      v_seeded_at - sm.delivered_offset,
      case when sm.read_offset is null then null else v_seeded_at - sm.read_offset end,
      case when sm.acknowledged_offset is null then null else v_seeded_at - sm.acknowledged_offset end,
      case when sm.callback_offset is null then null else v_seeded_at - sm.callback_offset end,
      sm.client_message_id,
      'sample_meaning_layer',
      jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', v_seed_version),
      v_seeded_at - sm.created_offset,
      v_seeded_at
    from seeded_messages sm
    returning id, client_message_id
  )
  insert into _sample_meaning_message_map (client_message_id, message_id)
  select i.client_message_id, i.id from inserted i;

  select count(*) into v_message_count from _sample_meaning_message_map;

  insert into public.connect_message_events (
    message_id,
    care_circle_id,
    main_connect_user_person_id,
    event_type,
    actor_role,
    actor_user_id,
    details,
    created_at
  )
  select
    msg.message_id,
    v_target_care_circle_id,
    v_target_subject_id,
    event.event_type,
    event.actor_role,
    v_effective_target_user_id,
    jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', v_seed_version),
    event.created_at
  from _sample_meaning_message_map msg
  join lateral (
    values
      ('created', 'dashboard', v_seeded_at - interval '4 days'),
      ('delivered', 'system', v_seeded_at - interval '4 days' + interval '5 minutes')
  ) as event(event_type, actor_role, created_at) on true;

  insert into public.focus_cadence_preferences (
    care_circle_id,
    care_subject_id,
    target_type,
    target_key,
    recommendation_id,
    preference_action,
    cadence,
    evidence_signature,
    note,
    created_by_user_id,
    metadata
  )
  select
    v_target_care_circle_id,
    v_target_subject_id,
    'recommendation',
    'walking_balance_followup',
    rec_map.recommendation_id,
    'show_less_often',
    'weekly',
    md5(v_seed_version || '|walking_balance_followup'),
    'Sample preference: walking is useful, but not every day.',
    v_effective_target_user_id,
    jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', v_seed_version)
  from _sample_meaning_recommendation_map rec_map
  where rec_map.dedupe_key = 'walking_balance_followup';

  insert into public.carepland_work_events (
    care_circle_id,
    care_subject_id,
    work_type,
    outcome_category,
    title,
    summary,
    occurred_at,
    source_type,
    source_table,
    source_id,
    related_sources,
    confidence,
    avoided_effort_unit,
    avoided_effort_min,
    avoided_effort_max,
    effort_model_version,
    idempotency_key,
    created_by_user_id,
    structured_payload,
    metadata
  )
  select
    v_target_care_circle_id,
    v_target_subject_id,
    work.work_type,
    work.outcome_category,
    work.title,
    work.summary,
    work.occurred_at,
    work.source_type,
    work.source_table,
    work.source_id,
    work.related_sources,
    work.confidence,
    work.avoided_effort_unit,
    work.avoided_effort_min,
    work.avoided_effort_max,
    'sample_effort_v1',
    work.idempotency_key,
    v_effective_target_user_id,
    work.structured_payload,
    jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', v_seed_version)
  from (
    values
      ('careprep_prepared', 'visit_prepared', 'Cardiology CarePrep prepared', 'CarePland carried forward BP, dizziness, cholesterol, home-monitoring, and medication-timing context for the upcoming cardiology visit.', v_seeded_at - interval '1 hour', 'careprep', 'careprep_guidance', (select cg.id from public.careprep_guidance cg join public.appointments a on a.id = cg.appointment_id where a.care_circle_id = v_target_care_circle_id and a.source = 'sample:future_cardiology_plan' limit 1), jsonb_build_array(jsonb_build_object('source_type', 'appointments', 'source_table', 'appointments', 'label', 'Upcoming cardiology follow-up', 'role', 'target_visit')), 0.95, 'lookup', 2::numeric, 4::numeric, 'sample:meaning:v3:careprep-prepared', jsonb_build_object('sampleScenario', 'visit preparation')),
      ('recommendation_identified', 'recommendation_surfaced', 'Home BP recommendation identified', 'CarePland found repeated source-backed evidence that a home blood pressure log may be useful to keep ready.', v_seeded_at - interval '50 minutes', 'recommendations', 'care_recommendations', (select rec_map.recommendation_id from _sample_meaning_recommendation_map rec_map where rec_map.dedupe_key = 'home_blood_pressure_monitoring'), jsonb_build_array(jsonb_build_object('source_type', 'health_focus', 'source_table', 'topic_mentions', 'label', 'Blood pressure mentions', 'role', 'evidence')), 0.9, 'lookup', 1::numeric, 2::numeric, 'sample:meaning:v3:recommendation-bp', jsonb_build_object('sampleScenario', 'reviewable recommendation')),
      ('focus_ranked', 'focus_supported', 'Today''s Focus ranked from current context', 'CarePland ranked BP tracking, walking, weight, and medication-timing notes as separate prompts instead of flattening them into one task.', v_seeded_at - interval '40 minutes', 'today_focus', 'focus_items', (select focus_map.focus_item_id from _sample_meaning_focus_map focus_map where focus_map.seed_key = 'bp_log'), jsonb_build_array(jsonb_build_object('source_type', 'recommendations', 'source_table', 'care_recommendations', 'label', 'Recommendation candidates', 'role', 'ranking_input')), 0.88, null::text, null::numeric, null::numeric, 'sample:meaning:v3:focus-ranked', jsonb_build_object('sampleScenario', 'focus ranking')),
      ('message_delivery_confirmed', 'message_heard', 'Medication-list message acknowledged', 'A Receiver-style message about bringing the medication list was delivered and acknowledged.', v_seeded_at - interval '30 minutes', 'connect', 'connect_messages', (select msg_map.message_id from _sample_meaning_message_map msg_map where msg_map.client_message_id = 'sample:meaning:v3:med-list:sarah'), jsonb_build_array(jsonb_build_object('source_type', 'connect', 'source_table', 'connect_messages', 'label', 'Medication list message', 'role', 'delivery_state')), 0.92, 'call_or_text', 1::numeric, 1::numeric, 'sample:meaning:v3:message-ack', jsonb_build_object('sampleScenario', 'message acknowledgement')),
      ('health_story_connected', 'context_connected', 'Knee pain story connected over time', 'CarePland connected primary care, imaging, orthopedics, PT, and resolution into one inspectable care story.', v_seeded_at - interval '20 minutes', 'health_focus', 'topic_mentions', (select tm.id from public.topic_mentions tm where tm.care_circle_id = v_target_care_circle_id and tm.care_subject_id = v_target_subject_id and tm.normalized_topic_slug = 'knee_pain' limit 1), jsonb_build_array(jsonb_build_object('source_type', 'appointments', 'source_table', 'appointments', 'label', 'Knee care thread', 'role', 'timeline')), 0.9, 'lookup', 3::numeric, 5::numeric, 'sample:meaning:v3:health-story-knee', jsonb_build_object('sampleScenario', 'health story continuity'))
  ) as work(work_type, outcome_category, title, summary, occurred_at, source_type, source_table, source_id, related_sources, confidence, avoided_effort_unit, avoided_effort_min, avoided_effort_max, idempotency_key, structured_payload);

  get diagnostics v_work_event_count = row_count;

  update public.profiles p
    set sample_data_seed_version = v_seed_version
  where p.id = v_effective_target_user_id;

  return jsonb_build_object(
    'status', 'seeded',
    'seeded_at', v_seeded_at,
    'seed_version', v_seed_version,
    'focus_items_created', v_focus_count,
    'messages_created', v_message_count,
    'recommendations_created', v_recommendation_count,
    'work_events_created', v_work_event_count
  );
end;
$$;

create or replace function public.seed_sample_meaning_layer_for_current_user()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.seed_sample_meaning_layer_for_user(auth.uid());
$$;

create or replace function public.admin_seed_sample_meaning_layer(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_user_id uuid := auth.uid();
  v_caller_is_admin boolean := false;
  v_target_user_id uuid;
begin
  if v_caller_user_id is null then
    raise exception 'Must be signed in';
  end if;

  select coalesce(p.is_admin, false)
    into v_caller_is_admin
  from public.profiles p
  where p.id = v_caller_user_id;

  if not coalesce(v_caller_is_admin, false) then
    raise exception 'Admin access required';
  end if;

  select p.id
    into v_target_user_id
  from public.profiles p
  where lower(p.email) = lower(trim(target_email))
  limit 1;

  if v_target_user_id is null then
    return jsonb_build_object('status', 'no_profile');
  end if;

  return public.seed_sample_meaning_layer_for_user(v_target_user_id);
end;
$$;

grant execute on function public.remove_sample_meaning_layer_for_current_user() to authenticated;
grant execute on function public.seed_sample_meaning_layer_for_user(uuid) to authenticated;
grant execute on function public.seed_sample_meaning_layer_for_current_user() to authenticated;
grant execute on function public.admin_seed_sample_meaning_layer(text) to authenticated;
