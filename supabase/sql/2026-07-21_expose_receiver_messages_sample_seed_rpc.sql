-- Production patch for the Receiver + Messages sample-data layer.
--
-- Phase 2 UAT found that the app-facing RPCs below were absent from
-- PostgREST's production schema cache even though the core and meaning-layer
-- sample seed functions were available. This patch recreates the existing
-- Receiver/Messages layer with its original public signatures and asks
-- PostgREST to reload the schema after the functions/grants are in place.

create or replace function public.remove_sample_receiver_messages_layer_for_current_user()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  target_care_circle_id uuid;
  seed_version text := 'sample_seed_receiver_messages_v1';
  removed_call_count integer := 0;
  removed_checkpoint_count integer := 0;
  removed_device_count integer := 0;
  removed_help_report_count integer := 0;
  removed_interaction_count integer := 0;
  removed_message_count integer := 0;
begin
  if caller_user_id is null then
    raise exception 'Must be signed in to remove sample Receiver and Messages data';
  end if;

  select care_circle_id
    into target_care_circle_id
  from public.care_circle_memberships
  where user_id = caller_user_id
    and status = 'active'
  order by case when role = 'owner' then 0 else 1 end, created_at
  limit 1;

  if target_care_circle_id is null then
    return jsonb_build_object('status', 'missing_care_circle');
  end if;

  create temp table _sample_receiver_messages on commit drop as
  select id
  from public.connect_messages
  where care_circle_id = target_care_circle_id
    and coalesce(metadata->>'sample_data_seed_version', '') = seed_version;

  create temp table _sample_receiver_attempts on commit drop as
  select id
  from public.interaction_attempts
  where care_circle_id = target_care_circle_id
    and coalesce(metadata->>'sample_data_seed_version', '') = seed_version;

  create temp table _sample_receiver_calls on commit drop as
  select id
  from public.connect_calls
  where care_circle_id = target_care_circle_id
    and receiver_display_name = 'Sample Living Room Receiver'
    and caller_display_name = 'Sample: Caregiver';

  select count(*) into removed_message_count from _sample_receiver_messages;
  select count(*) into removed_interaction_count from _sample_receiver_attempts;
  select count(*) into removed_call_count from _sample_receiver_calls;

  delete from public.appointment_communication_summaries
  where care_circle_id = target_care_circle_id
    and (
      coalesce(prompt_metadata->>'sample_data_seed_version', '') = seed_version
      or source_message_ids && array(select id from _sample_receiver_messages)
    );

  delete from public.connect_message_events
  where care_circle_id = target_care_circle_id
    and (
      message_id in (select id from _sample_receiver_messages)
      or coalesce(details->>'sample_data_seed_version', '') = seed_version
    );

  delete from public.connect_messages
  where id in (select id from _sample_receiver_messages);

  delete from public.interaction_attempts
  where id in (select id from _sample_receiver_attempts);

  delete from public.connect_call_summaries
  where call_id in (select id from _sample_receiver_calls);

  delete from public.connect_call_events
  where call_id in (select id from _sample_receiver_calls);

  delete from public.connect_call_signals
  where call_id in (select id from _sample_receiver_calls);

  delete from public.connect_calls
  where id in (select id from _sample_receiver_calls);

  delete from public.help_report_events
  where help_report_id in (
    select id
    from public.help_reports
    where care_circle_id = target_care_circle_id
      and reference_id like 'SAMPLE-RECEIVER-%'
  );

  delete from public.help_reports
  where care_circle_id = target_care_circle_id
    and reference_id like 'SAMPLE-RECEIVER-%';
  get diagnostics removed_help_report_count = row_count;

  delete from public.checkpoint_runs
  where care_circle_id = target_care_circle_id
    and prompt_key = seed_version;
  get diagnostics removed_checkpoint_count = row_count;

  delete from public.connect_receiver_claims
  where receiver_device_id in (
    select id
    from public.connect_receiver_devices
    where care_circle_id = target_care_circle_id
      and id like 'sample-receiver-%'
  );

  delete from public.connect_receiver_devices
  where care_circle_id = target_care_circle_id
    and id like 'sample-receiver-%';
  get diagnostics removed_device_count = row_count;

  return jsonb_build_object(
    'status', 'removed',
    'calls_removed', removed_call_count,
    'checkpoint_runs_removed', removed_checkpoint_count,
    'receiver_devices_removed', removed_device_count,
    'help_reports_removed', removed_help_report_count,
    'interaction_attempts_removed', removed_interaction_count,
    'messages_removed', removed_message_count
  );
end;
$$;

create or replace function public.seed_sample_receiver_messages_layer_for_user(
  target_user_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  caller_is_admin boolean := false;
  target_profile public.profiles%rowtype;
  target_care_circle_id uuid;
  target_subject_id uuid;
  target_subject_name text := 'Care VIP';
  target_appointment_id uuid;
  seeded_at timestamptz := now();
  seed_version text := 'sample_seed_receiver_messages_v1';
  sample_receiver_device_id text;
  receiver_claim text;
  pending_attempt_id uuid;
  completed_attempt_id uuid;
  call_id uuid;
  help_report_id uuid;
  device_count integer := 0;
  message_count integer := 0;
begin
  if caller_user_id is null then
    raise exception 'Must be signed in to seed sample Receiver and Messages data';
  end if;

  target_user_id := coalesce(target_user_id, caller_user_id);

  select coalesce(is_admin, false)
    into caller_is_admin
  from public.profiles
  where id = caller_user_id;

  if target_user_id <> caller_user_id and not coalesce(caller_is_admin, false) then
    raise exception 'Only an admin can seed sample Receiver and Messages data for another user';
  end if;

  select *
    into target_profile
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    return jsonb_build_object('status', 'no_profile');
  end if;

  if target_profile.sample_data_seeded_at is null then
    return jsonb_build_object('status', 'sample_data_not_seeded');
  end if;

  select care_circle_id
    into target_care_circle_id
  from public.care_circle_memberships
  where user_id = target_user_id
    and status = 'active'
  order by case when role = 'owner' then 0 else 1 end, created_at
  limit 1;

  if target_care_circle_id is null then
    return jsonb_build_object('status', 'missing_care_circle');
  end if;

  select id, display_name
    into target_subject_id, target_subject_name
  from public.care_subjects
  where care_circle_id = target_care_circle_id
    and is_active = true
    and coalesce(is_sample_data, false) = false
  order by is_default desc, created_at
  limit 1;

  if target_subject_id is null then
    select id, display_name
      into target_subject_id, target_subject_name
    from public.care_subjects
    where care_circle_id = target_care_circle_id
      and is_active = true
    order by is_default desc, created_at
    limit 1;
  end if;

  if target_subject_id is null then
    return jsonb_build_object('status', 'missing_care_vip');
  end if;

  select id
    into target_appointment_id
  from public.appointments
  where care_circle_id = target_care_circle_id
    and care_subject_id = target_subject_id
    and source = 'sample:future_cardiology_plan'
    and deleted_at is null
  order by starts_at desc
  limit 1;

  if target_appointment_id is null then
    select id
      into target_appointment_id
    from public.appointments
    where care_circle_id = target_care_circle_id
      and care_subject_id = target_subject_id
      and starts_at >= seeded_at - interval '1 day'
      and deleted_at is null
    order by starts_at
    limit 1;
  end if;

  if target_user_id = caller_user_id then
    perform public.remove_sample_receiver_messages_layer_for_current_user();
  else
    delete from public.appointment_communication_summaries
    where care_circle_id = target_care_circle_id
      and coalesce(prompt_metadata->>'sample_data_seed_version', '') = seed_version;
    delete from public.connect_message_events
    where care_circle_id = target_care_circle_id
      and coalesce(details->>'sample_data_seed_version', '') = seed_version;
    delete from public.connect_messages
    where care_circle_id = target_care_circle_id
      and coalesce(metadata->>'sample_data_seed_version', '') = seed_version;
    delete from public.interaction_attempts
    where care_circle_id = target_care_circle_id
      and coalesce(metadata->>'sample_data_seed_version', '') = seed_version;
    delete from public.connect_call_summaries
    where care_circle_id = target_care_circle_id
      and call_id in (
        select id from public.connect_calls
        where care_circle_id = target_care_circle_id
          and receiver_display_name = 'Sample Living Room Receiver'
          and caller_display_name = 'Sample: Caregiver'
      );
    delete from public.connect_call_events
    where care_circle_id = target_care_circle_id
      and call_id in (
        select id from public.connect_calls
        where care_circle_id = target_care_circle_id
          and receiver_display_name = 'Sample Living Room Receiver'
          and caller_display_name = 'Sample: Caregiver'
      );
    delete from public.connect_calls
    where care_circle_id = target_care_circle_id
      and receiver_display_name = 'Sample Living Room Receiver'
      and caller_display_name = 'Sample: Caregiver';
    delete from public.help_reports
    where care_circle_id = target_care_circle_id
      and reference_id like 'SAMPLE-RECEIVER-%';
    delete from public.checkpoint_runs
    where care_circle_id = target_care_circle_id
      and prompt_key = seed_version;
    delete from public.connect_receiver_claims
    where receiver_device_id in (
      select id from public.connect_receiver_devices
      where care_circle_id = target_care_circle_id
        and id like 'sample-receiver-%'
    );
    delete from public.connect_receiver_devices
    where care_circle_id = target_care_circle_id
      and id like 'sample-receiver-%';
  end if;

  sample_receiver_device_id := 'sample-receiver-' || replace(target_care_circle_id::text, '-', '');
  receiver_claim := 'sample-claim-' || md5(sample_receiver_device_id || seed_version);

  insert into public.connect_participants (
    care_circle_id,
    person_id,
    status,
    participant_role,
    created_by_user_id,
    updated_at
  )
  values (
    target_care_circle_id,
    target_subject_id,
    'active',
    'receiver',
    target_user_id,
    seeded_at
  )
  on conflict (person_id) do update
    set status = 'active',
        updated_at = excluded.updated_at;

  insert into public.connect_settings (
    user_id,
    main_connect_user_person_id,
    updated_at
  )
  values (
    target_user_id,
    target_subject_id,
    seeded_at
  )
  on conflict (user_id) do update
    set main_connect_user_person_id = excluded.main_connect_user_person_id,
        updated_at = excluded.updated_at;

  insert into public.connect_receiver_devices (
    id,
    status,
    receiver_install_id,
    receiver_url,
    device_profile,
    hardware_profile,
    ui_layout,
    care_circle_id,
    main_connect_user_person_id,
    location_label,
    last_seen_at,
    bound_at,
    receiver_mode,
    provisioning_completed_at,
    capability_statuses,
    native_version_code,
    native_version_name,
    shell_version,
    native_manufacturer,
    native_model,
    native_sdk,
    device_owner,
    lock_task_permitted,
    lock_task_active,
    last_recovery_action,
    last_recovery_at,
    created_at,
    updated_at
  )
  values (
    sample_receiver_device_id,
    'bound',
    'sample-browser-install',
    '/connect/receiver',
    'gxv3370',
    'studio_gxv3370_1024x600',
    'desk_phone_1024x600',
    target_care_circle_id,
    target_subject_id,
    'Sample Living Room',
    seeded_at - interval '4 minutes',
    seeded_at - interval '3 days',
    'dedicated',
    seeded_at - interval '3 days',
    jsonb_build_object(
      'audio', 'enabled',
      'browser_receiver', 'enabled',
      'kiosk', 'permitted',
      'messages', 'enabled',
      'microphone', 'enabled',
      'screen_cleaning', 'enabled',
      'today_focus', 'enabled'
    ),
    12,
    '0.2.0-demo',
    'web-demo',
    'CarePland',
    'Browser Test Receiver',
    30,
    false,
    true,
    false,
    'heartbeat',
    seeded_at - interval '4 minutes',
    seeded_at - interval '3 days',
    seeded_at
  )
  on conflict (id) do update
    set status = excluded.status,
        receiver_install_id = excluded.receiver_install_id,
        receiver_url = excluded.receiver_url,
        device_profile = excluded.device_profile,
        hardware_profile = excluded.hardware_profile,
        ui_layout = excluded.ui_layout,
        care_circle_id = excluded.care_circle_id,
        main_connect_user_person_id = excluded.main_connect_user_person_id,
        location_label = excluded.location_label,
        last_seen_at = excluded.last_seen_at,
        bound_at = excluded.bound_at,
        receiver_mode = excluded.receiver_mode,
        provisioning_completed_at = excluded.provisioning_completed_at,
        capability_statuses = excluded.capability_statuses,
        native_version_code = excluded.native_version_code,
        native_version_name = excluded.native_version_name,
        shell_version = excluded.shell_version,
        native_manufacturer = excluded.native_manufacturer,
        native_model = excluded.native_model,
        native_sdk = excluded.native_sdk,
        device_owner = excluded.device_owner,
        lock_task_permitted = excluded.lock_task_permitted,
        lock_task_active = excluded.lock_task_active,
        last_recovery_action = excluded.last_recovery_action,
        last_recovery_at = excluded.last_recovery_at,
        updated_at = excluded.updated_at;
  get diagnostics device_count = row_count;

  insert into public.connect_receiver_claims (
    claim,
    receiver_device_id,
    setup_code,
    status,
    receiver_install_id,
    receiver_url,
    device_profile,
    hardware_profile,
    ui_layout,
    created_by_user_id,
    created_at,
    expires_at,
    redeemed_at
  )
  values (
    receiver_claim,
    sample_receiver_device_id,
    '12345',
    'used',
    'sample-browser-install',
    '/connect/receiver',
    'gxv3370',
    'studio_gxv3370_1024x600',
    'desk_phone_1024x600',
    target_user_id,
    seeded_at - interval '3 days',
    seeded_at + interval '30 days',
    seeded_at - interval '3 days' + interval '2 minutes'
  )
  on conflict (claim) do update
    set status = excluded.status,
        receiver_install_id = excluded.receiver_install_id,
        redeemed_at = excluded.redeemed_at;

  create temp table _sample_receiver_message_map (
    client_message_id text primary key,
    message_id uuid not null
  ) on commit drop;

  with seeded_messages(client_message_id, appointment_id, sender_role, sender_display_name, body, created_offset, delivered_offset, read_offset, heard_offset, acknowledged_offset, callback_offset, requires_ack, allows_callback) as (
    values
      ('sample:receiver:v1:appt-med-list', target_appointment_id, 'dashboard', 'Sarah', 'Please bring the current medication list and the home blood pressure log to the cardiology visit.', interval '4 days', interval '4 days' - interval '5 minutes', interval '4 days' - interval '2 minutes', interval '4 days' - interval '2 minutes', interval '4 days' - interval '1 minute', null::interval, true, false),
      ('sample:receiver:v1:appt-question', target_appointment_id, 'dashboard', 'Amy', 'Could you ask Dr. Allen whether the dizziness might be related to medication timing?', interval '3 days', interval '3 days' - interval '5 minutes', interval '3 days' - interval '3 minutes', null::interval, null::interval, null::interval, false, false),
      ('sample:receiver:v1:callback', null::uuid, 'dashboard', 'Caregiver', 'If the dizziness comes back today, tap Call Back and I will check in.', interval '2 days', interval '2 days' - interval '5 minutes', null::interval, null::interval, null::interval, interval '2 days' - interval '1 minute', false, true),
      ('sample:receiver:v1:receiver-reply', null::uuid, 'receiver', target_subject_name, 'I took a short walk and wrote down the blood pressure reading.', interval '1 day', interval '1 day' - interval '5 minutes', interval '1 day' - interval '4 minutes', null::interval, null::interval, null::interval, false, false),
      ('sample:receiver:v1:logistics', target_appointment_id, 'dashboard', 'Sarah', 'The cardiology office is still at Heart & Vascular Clinic. Plan on leaving by 1:15.', interval '12 hours', interval '12 hours' - interval '5 minutes', null::interval, null::interval, null::interval, null::interval, false, false)
  ),
  inserted as (
    insert into public.connect_messages (
      care_circle_id,
      main_connect_user_person_id,
      receiver_device_id,
      appointment_id,
      sender_role,
      sender_user_id,
      sender_display_name,
      recipient_display_name,
      body,
      requires_acknowledgement,
      allows_callback_request,
      delivered_at,
      read_at,
      heard_at,
      acknowledged_at,
      callback_requested_at,
      client_message_id,
      source,
      metadata,
      created_at,
      updated_at
    )
    select
      target_care_circle_id,
      target_subject_id,
      case when sender_role = 'receiver' then sample_receiver_device_id else null end,
      appointment_id,
      sender_role,
      case when sender_role = 'dashboard' then target_user_id else null end,
      sender_display_name,
      target_subject_name,
      body,
      requires_ack,
      allows_callback,
      seeded_at - delivered_offset,
      case when read_offset is null then null else seeded_at - read_offset end,
      case when heard_offset is null then null else seeded_at - heard_offset end,
      case when acknowledged_offset is null then null else seeded_at - acknowledged_offset end,
      case when callback_offset is null then null else seeded_at - callback_offset end,
      client_message_id,
      'sample_receiver_messages_layer',
      jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', seed_version),
      seeded_at - created_offset,
      seeded_at
    from seeded_messages
    returning id, client_message_id
  )
  insert into _sample_receiver_message_map (client_message_id, message_id)
  select client_message_id, id from inserted;

  select count(*) into message_count from _sample_receiver_message_map;

  insert into public.connect_message_events (
    message_id,
    care_circle_id,
    main_connect_user_person_id,
    receiver_device_id,
    event_type,
    actor_role,
    actor_user_id,
    details,
    created_at
  )
  select
    m.id,
    m.care_circle_id,
    m.main_connect_user_person_id,
    sample_receiver_device_id,
    event.event_type,
    event.actor_role,
    case when event.actor_role = 'dashboard' then target_user_id else null end,
    jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', seed_version),
    event.created_at
  from public.connect_messages m
  join _sample_receiver_message_map map on map.message_id = m.id
  join lateral (
    select 'created'::text as event_type, m.sender_role as actor_role, m.created_at as created_at
    union all select 'delivered', 'system', m.delivered_at where m.delivered_at is not null
    union all select 'read', 'receiver', m.read_at where m.read_at is not null
    union all select 'heard', 'receiver', m.heard_at where m.heard_at is not null
    union all select 'acknowledged', 'receiver', m.acknowledged_at where m.acknowledged_at is not null
    union all select 'callback_requested', 'receiver', m.callback_requested_at where m.callback_requested_at is not null
  ) event on true;

  if target_appointment_id is not null then
    insert into public.appointment_communication_summaries (
      appointment_id,
      care_circle_id,
      main_connect_user_person_id,
      summary_items,
      summary_version,
      last_processed_message_id,
      last_substantive_message_id,
      generation_status,
      model,
      prompt_version,
      prompt_metadata,
      decision_trace,
      source_message_ids,
      created_at,
      updated_at
    )
    select
      target_appointment_id,
      target_care_circle_id,
      target_subject_id,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'sample-bring-med-list-bp-log',
          'category', 'bring_list',
          'text', 'Bring the current medication list and home blood pressure log.',
          'sourceType', 'communication',
          'sourceDisplayNames', jsonb_build_array('Sarah'),
          'sourceMessageIds', jsonb_build_array((select message_id::text from _sample_receiver_message_map where client_message_id = 'sample:receiver:v1:appt-med-list')),
          'createdAt', seeded_at,
          'updatedAt', seeded_at,
          'status', 'active'
        ),
        jsonb_build_object(
          'id', 'sample-ask-dizziness-med-timing',
          'category', 'key_questions',
          'text', 'Ask whether dizziness might be related to medication timing.',
          'sourceType', 'communication',
          'sourceDisplayNames', jsonb_build_array('Amy'),
          'sourceMessageIds', jsonb_build_array((select message_id::text from _sample_receiver_message_map where client_message_id = 'sample:receiver:v1:appt-question')),
          'createdAt', seeded_at,
          'updatedAt', seeded_at,
          'status', 'active'
        ),
        jsonb_build_object(
          'id', 'sample-office-leave-time',
          'category', 'next_steps',
          'text', 'Heart & Vascular Clinic is unchanged; leave by 1:15.',
          'sourceType', 'communication',
          'sourceDisplayNames', jsonb_build_array('Sarah'),
          'sourceMessageIds', jsonb_build_array((select message_id::text from _sample_receiver_message_map where client_message_id = 'sample:receiver:v1:logistics')),
          'createdAt', seeded_at,
          'updatedAt', seeded_at,
          'status', 'active'
        )
      ),
      3,
      (select message_id from _sample_receiver_message_map where client_message_id = 'sample:receiver:v1:logistics'),
      (select message_id from _sample_receiver_message_map where client_message_id = 'sample:receiver:v1:logistics'),
      'completed',
      'deterministic_v1',
      'appointment_communication_summary',
      jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', seed_version),
      jsonb_build_object('layer', 'appointment_communication_summary', 'sampleSeedVersion', seed_version),
      array(select message_id from _sample_receiver_message_map where client_message_id in ('sample:receiver:v1:appt-med-list', 'sample:receiver:v1:appt-question', 'sample:receiver:v1:logistics')),
      seeded_at,
      seeded_at
    on conflict (appointment_id) do update
      set summary_items = excluded.summary_items,
          summary_version = excluded.summary_version,
          last_processed_message_id = excluded.last_processed_message_id,
          last_substantive_message_id = excluded.last_substantive_message_id,
          generation_status = excluded.generation_status,
          model = excluded.model,
          prompt_version = excluded.prompt_version,
          prompt_metadata = excluded.prompt_metadata,
          decision_trace = excluded.decision_trace,
          source_message_ids = excluded.source_message_ids,
          updated_at = excluded.updated_at;
  end if;

  insert into public.interaction_attempts (
    care_circle_id,
    care_subject_id,
    surface,
    active_workflow,
    status,
    outcome,
    latest_observation_id,
    revision_count,
    receiver_device_id,
    device_id,
    created_by_user_id,
    metadata,
    created_at,
    updated_at,
    completed_at
  )
  values (
    target_care_circle_id,
    target_subject_id,
    'receiver_talk',
    'talk_to_track',
    'completed',
    'workflow_completed',
    'sample-observation-walk',
    0,
    sample_receiver_device_id,
    sample_receiver_device_id,
    target_user_id,
    jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', seed_version, 'sample_seed_key', 'walk_completed'),
    seeded_at - interval '1 day',
    seeded_at - interval '1 day' + interval '1 minute',
    seeded_at - interval '1 day' + interval '1 minute'
  )
  returning id into completed_attempt_id;

  insert into public.interaction_attempt_observations (
    attempt_id,
    observation_id,
    revision_index,
    revision_reason,
    observation_snapshot,
    observed_at,
    created_at
  )
  values (
    completed_attempt_id,
    'sample-observation-walk',
    0,
    'initial',
    jsonb_build_object('text', 'I took a short walk.', 'modality', 'speech', 'surface', 'receiver'),
    seeded_at - interval '1 day',
    seeded_at - interval '1 day'
  );

  insert into public.interaction_attempt_events (
    attempt_id,
    event_type,
    observation_id,
    actor_role,
    payload,
    created_at
  )
  values
    (completed_attempt_id, 'attempt_started', null, 'receiver_user', jsonb_build_object('sample_data_seed_version', seed_version), seeded_at - interval '1 day'),
    (completed_attempt_id, 'observation_submitted', 'sample-observation-walk', 'receiver_user', jsonb_build_object('sample_data_seed_version', seed_version), seeded_at - interval '1 day' + interval '5 seconds'),
    (completed_attempt_id, 'workflow_completed', 'sample-observation-walk', 'system', jsonb_build_object('sample_data_seed_version', seed_version, 'trackEventType', 'activity.walking'), seeded_at - interval '1 day' + interval '1 minute');

  insert into public.interaction_attempts (
    care_circle_id,
    care_subject_id,
    surface,
    active_workflow,
    status,
    outcome,
    latest_observation_id,
    revision_count,
    receiver_device_id,
    device_id,
    created_by_user_id,
    metadata,
    created_at,
    updated_at,
    completed_at
  )
  values (
    target_care_circle_id,
    target_subject_id,
    'receiver_ask',
    'ask_recovery',
    'timed_out',
    'timed_out',
    'sample-observation-unclear-2',
    1,
    sample_receiver_device_id,
    sample_receiver_device_id,
    target_user_id,
    jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', seed_version, 'sample_seed_key', 'unclear_helpful_review'),
    seeded_at - interval '6 hours',
    seeded_at - interval '5 hours 55 minutes',
    seeded_at - interval '5 hours 55 minutes'
  )
  returning id into pending_attempt_id;

  insert into public.interaction_attempt_observations (
    attempt_id,
    observation_id,
    revision_index,
    parent_observation_id,
    revision_reason,
    observation_snapshot,
    observed_at,
    created_at
  )
  values
    (pending_attempt_id, 'sample-observation-unclear-1', 0, null, 'initial', jsonb_build_object('text', 'What about that thing for tomorrow?', 'modality', 'speech', 'surface', 'receiver'), seeded_at - interval '6 hours', seeded_at - interval '6 hours'),
    (pending_attempt_id, 'sample-observation-unclear-2', 1, 'sample-observation-unclear-1', 'rephrase', jsonb_build_object('text', 'What should I bring to the heart doctor tomorrow?', 'modality', 'speech', 'surface', 'receiver'), seeded_at - interval '5 hours 58 minutes', seeded_at - interval '5 hours 58 minutes');

  insert into public.interaction_attempt_events (
    attempt_id,
    event_type,
    observation_id,
    actor_role,
    payload,
    created_at
  )
  values
    (pending_attempt_id, 'attempt_started', null, 'receiver_user', jsonb_build_object('sample_data_seed_version', seed_version), seeded_at - interval '6 hours'),
    (pending_attempt_id, 'observation_submitted', 'sample-observation-unclear-1', 'receiver_user', jsonb_build_object('sample_data_seed_version', seed_version), seeded_at - interval '6 hours' + interval '5 seconds'),
    (pending_attempt_id, 'response_presented', 'sample-observation-unclear-1', 'system', jsonb_build_object('sample_data_seed_version', seed_version, 'responseKind', 'clarify'), seeded_at - interval '6 hours' + interval '10 seconds'),
    (pending_attempt_id, 'revision_observation_submitted', 'sample-observation-unclear-2', 'receiver_user', jsonb_build_object('sample_data_seed_version', seed_version), seeded_at - interval '5 hours 58 minutes'),
    (pending_attempt_id, 'timed_out', 'sample-observation-unclear-2', 'system', jsonb_build_object('sample_data_seed_version', seed_version, 'needsReview', true), seeded_at - interval '5 hours 55 minutes');

  insert into public.interaction_attempt_platform_reviews (
    attempt_id,
    care_circle_id,
    reviewer_user_id,
    comment,
    metadata,
    created_at
  )
  values (
    pending_attempt_id,
    target_care_circle_id,
    target_user_id,
    'Sample review: preparation questions should find appointment-linked MessagePrep when available, not stay in generic recovery.',
    jsonb_build_object('is_sample_data', true, 'sample_data_seed_version', seed_version),
    seeded_at - interval '5 hours'
  );

  insert into public.connect_calls (
    care_circle_id,
    main_connect_user_person_id,
    caller_user_id,
    caller_display_name,
    receiver_display_name,
    state,
    started_at,
    answered_at,
    connected_at,
    ended_at,
    ended_reason,
    duration_seconds,
    transcript_text,
    transcript_status,
    summary_status,
    generated_summary_text,
    approved_summary_text,
    summary_approved_at,
    summary_approved_by,
    summary_review_status,
    transcript_cleanup_status,
    transcript_expires_at,
    summary_approval_draft_text,
    summary_approval_draft_updated_at,
    summary_approval_draft_updated_by,
    created_at,
    updated_at
  )
  values (
    target_care_circle_id,
    target_subject_id,
    target_user_id,
    'Sample: Caregiver',
    'Sample Living Room Receiver',
    'hung_up',
    seeded_at - interval '20 hours',
    seeded_at - interval '20 hours' + interval '8 seconds',
    seeded_at - interval '20 hours' + interval '10 seconds',
    seeded_at - interval '20 hours' + interval '4 minutes',
    'normal_hangup',
    230,
    '',
    'deleted',
    'approved',
    'Care-relevant call summary: dizziness did not return today. Medication list and BP log are ready for cardiology.',
    'Dizziness did not return today. Medication list and BP log are ready for cardiology.',
    seeded_at - interval '19 hours 50 minutes',
    'dashboard',
    'approved',
    'completed',
    seeded_at - interval '13 hours',
    'Dizziness did not return today. Medication list and BP log are ready for cardiology.',
    seeded_at - interval '19 hours 55 minutes',
    'dashboard',
    seeded_at - interval '20 hours',
    seeded_at - interval '19 hours 50 minutes'
  )
  returning id into call_id;

  insert into public.connect_call_events (
    call_id,
    care_circle_id,
    main_connect_user_person_id,
    event_type,
    actor_role,
    actor_user_id,
    details,
    created_at
  )
  values
    (call_id, target_care_circle_id, target_subject_id, 'created', 'dashboard', target_user_id, jsonb_build_object('sample_data_seed_version', seed_version), seeded_at - interval '20 hours'),
    (call_id, target_care_circle_id, target_subject_id, 'answered', 'receiver', null, jsonb_build_object('sample_data_seed_version', seed_version, 'receiverDeviceId', sample_receiver_device_id), seeded_at - interval '20 hours' + interval '8 seconds'),
    (call_id, target_care_circle_id, target_subject_id, 'summary_approved', 'dashboard', target_user_id, jsonb_build_object('sample_data_seed_version', seed_version), seeded_at - interval '19 hours 50 minutes');

  insert into public.connect_call_summaries (
    call_id,
    care_circle_id,
    main_connect_user_person_id,
    summary_text,
    summary_status,
    approved_at,
    approved_by_role,
    approved_by_user_id,
    prompt_version,
    model,
    generated_at,
    created_at,
    updated_at
  )
  values (
    call_id,
    target_care_circle_id,
    target_subject_id,
    'Dizziness did not return today. Medication list and BP log are ready for cardiology.',
    'approved',
    seeded_at - interval '19 hours 50 minutes',
    'dashboard',
    target_user_id,
    'connect_call_care_summary',
    'sample_seed',
    seeded_at - interval '19 hours 55 minutes',
    seeded_at - interval '19 hours 55 minutes',
    seeded_at - interval '19 hours 50 minutes'
  );

  insert into public.help_reports (
    reference_id,
    submitted_at,
    submitted_by_user_id,
    account_user_id,
    care_subject_id,
    care_circle_id,
    current_route,
    feature_area,
    build_identifier,
    device_summary,
    browser_summary,
    user_trying_to_do,
    user_happened_instead,
    diagnostic_packet,
    derived_summary,
    likely_category,
    severity,
    status,
    updated_at
  )
  values (
    'SAMPLE-RECEIVER-' || substr(replace(target_care_circle_id::text, '-', ''), 1, 12),
    seeded_at - interval '5 hours',
    target_user_id,
    target_user_id,
    target_subject_id,
    target_care_circle_id,
    '/connect/receiver',
    'receiver',
    'sample-seed',
    'Sample Living Room Receiver',
    'Browser Test Receiver',
    'Use Ask/Tell on the Receiver.',
    'The Receiver asked for clarification and then timed out.',
    jsonb_build_object('sample_data_seed_version', seed_version, 'receiverDeviceId', sample_receiver_device_id),
    jsonb_build_object('summary', 'Sample Receiver Ask/Tell timeout for admin triage.'),
    'receiver_interaction',
    'medium',
    'new',
    seeded_at - interval '5 hours'
  )
  on conflict (reference_id) do update
    set submitted_at = excluded.submitted_at,
        submitted_by_user_id = excluded.submitted_by_user_id,
        account_user_id = excluded.account_user_id,
        care_subject_id = excluded.care_subject_id,
        care_circle_id = excluded.care_circle_id,
        current_route = excluded.current_route,
        feature_area = excluded.feature_area,
        device_summary = excluded.device_summary,
        browser_summary = excluded.browser_summary,
        user_trying_to_do = excluded.user_trying_to_do,
        user_happened_instead = excluded.user_happened_instead,
        diagnostic_packet = excluded.diagnostic_packet,
        derived_summary = excluded.derived_summary,
        likely_category = excluded.likely_category,
        severity = excluded.severity,
        status = excluded.status,
        updated_at = excluded.updated_at
  returning id into help_report_id;

  insert into public.help_report_events (
    help_report_id,
    event_type,
    actor_user_id,
    new_value,
    note,
    created_at
  )
  values (
    help_report_id,
    'submitted',
    target_user_id,
    jsonb_build_object('status', 'new', 'sample_data_seed_version', seed_version),
    'Sample Receiver diagnostics report.',
    seeded_at - interval '5 hours'
  );

  if target_appointment_id is not null then
    insert into public.checkpoint_runs (
      checkpoint_use_key,
      account_user_id,
      care_circle_id,
      care_subject_id,
      appointment_id,
      requested_range,
      effective_evidence_range,
      evidence_packet,
      structured_interpretation,
      proposed_output,
      decision_trace,
      prompt_key,
      prompt_version,
      model_metadata,
      generated_at,
      generation_status,
      generated_by_user_id,
      created_at,
      updated_at
    )
    values (
      'careprep',
      target_user_id,
      target_care_circle_id,
      target_subject_id,
      target_appointment_id,
      jsonb_build_object('sampleScenario', 'appointment_linked_messageprep'),
      jsonb_build_object('messages', message_count),
      jsonb_build_object('sourceMessageIds', array(select message_id::text from _sample_receiver_message_map where client_message_id like 'sample:receiver:v1:appt-%')),
      jsonb_build_object('meaning', 'Appointment messages added bring-list and medication-timing questions.'),
      jsonb_build_object('whatToKnow', jsonb_build_array('Bring medication list and BP log.', 'Ask about dizziness and medication timing.')),
      jsonb_build_object('layer', 'checkpoint', 'sampleSeedVersion', seed_version),
      seed_version,
      'sample_v1',
      jsonb_build_object('model', 'sample_seed'),
      seeded_at - interval '4 hours',
      'succeeded',
      target_user_id,
      seeded_at - interval '4 hours',
      seeded_at - interval '4 hours'
    );
  end if;

  update public.profiles
    set sample_data_seed_version = seed_version
  where id = target_user_id;

  return jsonb_build_object(
    'status', 'seeded',
    'seeded_at', seeded_at,
    'seed_version', seed_version,
    'receiver_devices_created', device_count,
    'messages_created', message_count,
    'interaction_attempts_created', 2,
    'calls_created', 1,
    'help_reports_created', 1,
    'checkpoint_runs_created', case when target_appointment_id is null then 0 else 1 end
  );
end;
$$;

create or replace function public.seed_sample_receiver_messages_layer_for_current_user()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.seed_sample_receiver_messages_layer_for_user(auth.uid());
$$;

create or replace function public.admin_seed_sample_receiver_messages_layer(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  caller_is_admin boolean := false;
  target_user_id uuid;
begin
  if caller_user_id is null then
    raise exception 'Must be signed in';
  end if;

  select coalesce(is_admin, false)
    into caller_is_admin
  from public.profiles
  where id = caller_user_id;

  if not coalesce(caller_is_admin, false) then
    raise exception 'Admin access required';
  end if;

  select id
    into target_user_id
  from public.profiles
  where lower(email) = lower(trim(target_email))
  limit 1;

  if target_user_id is null then
    return jsonb_build_object('status', 'no_profile');
  end if;

  return public.seed_sample_receiver_messages_layer_for_user(target_user_id);
end;
$$;

grant execute on function public.remove_sample_receiver_messages_layer_for_current_user() to authenticated;
grant execute on function public.seed_sample_receiver_messages_layer_for_user(uuid) to authenticated;
grant execute on function public.seed_sample_receiver_messages_layer_for_current_user() to authenticated;
grant execute on function public.admin_seed_sample_receiver_messages_layer(text) to authenticated;

notify pgrst, 'reload schema';
