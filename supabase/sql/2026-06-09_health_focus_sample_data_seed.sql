-- Expands demo/sample data so Health Focus demonstrates context over time.
-- Safe to re-run as a migration. The app continues to call the same RPC names.

alter table public.care_subjects
  add column if not exists is_sample_data boolean not null default false,
  add column if not exists sample_data_seed_version text;

create or replace function public.remove_demo_data_for_current_user()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  declined_at timestamptz := now();
  target_care_circle_id uuid;
  removed_count integer := 0;
begin
  if caller_user_id is null then
    raise exception 'Must be signed in to remove demo data';
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

  create temp table _demo_target_appointments on commit drop as
  select a.id
  from public.appointments a
  where a.care_circle_id = target_care_circle_id
    and a.is_sample_data = true;

  select count(*)
    into removed_count
  from _demo_target_appointments;

  delete from public.health_topic_user_context htc
  where htc.care_circle_id = target_care_circle_id
    and (
      coalesce(htc.metadata->>'is_sample_data', 'false') = 'true'
      or exists (
        select 1
        from unnest(htc.source_appointment_ids) as source_appointment_id
        where source_appointment_id in (select id from _demo_target_appointments)
      )
    );

  delete from public.health_topic_feedback htf
  where htf.care_circle_id = target_care_circle_id
    and (
      coalesce(htf.metadata->>'is_sample_data', 'false') = 'true'
      or exists (
        select 1
        from unnest(htf.source_appointment_ids) as source_appointment_id
        where source_appointment_id in (select id from _demo_target_appointments)
      )
    );

  delete from public.topic_mentions
  where care_circle_id = target_care_circle_id
    and appointment_id in (select id from _demo_target_appointments);

  update public.appointments
    set current_note_id = null
  where id in (select id from _demo_target_appointments);

  delete from public.careprep_guidance
  where is_sample_data = true
    and appointment_id in (select id from _demo_target_appointments);

  delete from public.appointment_notes
  where is_sample_data = true
    and appointment_id in (select id from _demo_target_appointments);

  delete from public.appointments
  where id in (select id from _demo_target_appointments);

  delete from public.care_subjects
  where care_circle_id = target_care_circle_id
    and is_sample_data = true;

  update public.profiles
    set sample_data_seeded_at = null,
        sample_data_declined_at = declined_at,
        sample_data_seed_version = null,
        sample_data_seeded_by_user_id = null
  where id = caller_user_id;

  return jsonb_build_object(
    'status', 'removed',
    'appointments_removed', removed_count,
    'declined_at', declined_at
  );
end;
$$;

grant execute on function public.remove_demo_data_for_current_user() to authenticated;

create or replace function public.seed_sample_data_for_user(
  target_user_id uuid default auth.uid(),
  force_if_declined boolean default false
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
  caregiver_subject_id uuid;
  seeded_at timestamptz := now();
  seed_version text := 'sample_seed_health_focus_v2';
  created_appointment_count integer := 0;
begin
  if caller_user_id is null then
    raise exception 'Must be signed in to seed sample data';
  end if;

  target_user_id := coalesce(target_user_id, caller_user_id);

  select coalesce(is_admin, false)
    into caller_is_admin
  from public.profiles
  where id = caller_user_id;

  if target_user_id <> caller_user_id and not coalesce(caller_is_admin, false) then
    raise exception 'Only an admin can seed sample data for another user';
  end if;

  select *
    into target_profile
  from public.profiles
  where id = target_user_id
  for update;

  if not found then
    return jsonb_build_object('status', 'no_profile');
  end if;

  if target_profile.sample_data_seeded_at is not null then
    return jsonb_build_object(
      'status', 'already_seeded',
      'seeded_at', target_profile.sample_data_seeded_at,
      'seed_version', target_profile.sample_data_seed_version
    );
  end if;

  if target_profile.sample_data_declined_at is not null and not force_if_declined then
    return jsonb_build_object(
      'status', 'declined',
      'declined_at', target_profile.sample_data_declined_at
    );
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

  select id
    into target_subject_id
  from public.care_subjects
  where care_circle_id = target_care_circle_id
    and is_active = true
  order by is_default desc, created_at
  limit 1;

  if target_subject_id is null then
    insert into public.care_subjects (
      care_circle_id,
      display_name,
      is_active,
      is_default,
      subject_type
    )
    values (
      target_care_circle_id,
      coalesce(
        nullif(target_profile.display_name, ''),
        nullif(target_profile.given_name, ''),
        target_profile.email,
        'Care VIP'
      ),
      true,
      true,
      'other'
    )
    returning id into target_subject_id;
  end if;

  insert into public.care_subjects (
    care_circle_id,
    display_name,
    is_active,
    is_default,
    subject_type,
    is_sample_data,
    sample_data_seed_version
  )
  values (
    target_care_circle_id,
    'Sample: Mom Bobson',
    true,
    false,
    'other',
    true,
    seed_version
  )
  returning id into caregiver_subject_id;

  create temp table _sample_seed_appointments (
    seed_key text primary key,
    care_subject_id uuid not null,
    appointment_id uuid not null,
    note_id uuid
  ) on commit drop;

  with seeded_appointments(
    care_subject_id,
    seed_key,
    title,
    reason,
    starts_at,
    status,
    provider_name,
    provider_organization,
    location_name,
    location_address,
    location_phone,
    archived_at
  ) as (
    values
      (target_subject_id, 'knee_primary_initial', 'Primary care visit for right knee pain', 'Primary care evaluation after fall; imaging referral for right knee pain', seeded_at - interval '16 months', 'scheduled', 'Dr. John Smith', 'Main Street Clinic', 'Main Street Clinic', '22 Main Street, Springfield, IL', '555-0102', null::timestamptz),
      (target_subject_id, 'knee_mri_review', 'MRI review for right knee pain', 'Review MRI and arthritis findings', seeded_at - interval '14 months', 'scheduled', 'Dr. John Smith', 'Main Street Clinic Imaging', 'Main Street Clinic Imaging', '22 Main Street, Springfield, IL', '555-0102', null::timestamptz),
      (target_subject_id, 'knee_ortho_initial', 'Orthopedic consult for right knee pain', 'Orthopedics reviewed persistent knee pain after imaging', seeded_at - interval '13 months', 'scheduled', 'Dr. Michael Smith', 'Orthopedic Associates', 'Orthopedic Associates', '18 Medical Plaza, Springfield, IL', '555-0301', null::timestamptz),
      (target_subject_id, 'knee_pt_start', 'Physical therapy intake', 'Start PT for right knee pain and mobility', seeded_at - interval '11 months', 'scheduled', 'Jordan Lee, PT', 'Riverbend Physical Therapy', 'Riverbend Physical Therapy', '230 River Road, Springfield, IL', '555-0302', null::timestamptz),
      (target_subject_id, 'knee_followup_resolved', 'Orthopedic follow-up after PT', 'Follow up after PT for right knee pain', seeded_at - interval '8 months', 'scheduled', 'Dr. Michael Smith', 'Orthopedic Associates', 'Orthopedic Associates', '18 Medical Plaza, Springfield, IL', '555-0301', null::timestamptz),
      (target_subject_id, 'dental_pain', 'Dental visit for tooth pain', 'Evaluate tooth pain and possible crown issue', seeded_at - interval '7 months', 'scheduled', 'Dr. Priya Patel', 'Harbor Dental', 'Harbor Dental', '455 Oak Ave, Springfield, IL', '555-0144', null::timestamptz),
      (target_subject_id, 'primary_bp_dizziness', 'Primary care blood pressure visit', 'Blood pressure, dizziness, stress, and medication timing', seeded_at - interval '6 months', 'scheduled', 'Dr. John Smith', 'Main Street Clinic', 'Main Street Clinic', '22 Main Street, Springfield, IL', '555-0102', null::timestamptz),
      (target_subject_id, 'urgent_dizzy_bp', 'Urgent care for dizziness', 'Dizziness with elevated home blood pressure readings', seeded_at - interval '5 months', 'scheduled', 'Patricia Jones, PA', 'QuickCare Urgent Care', 'QuickCare Urgent Care', '77 North Ave, Springfield, IL', '555-0401', null::timestamptz),
      (target_subject_id, 'procedure_oneoff', 'One-time dermatology procedure', 'Mole biopsy procedure and wound care follow-up', seeded_at - interval '4 months', 'scheduled', 'Dr. Elena Cruz', 'Springfield Dermatology', 'Springfield Dermatology', '8 Lake Street, Springfield, IL', '555-0501', null::timestamptz),
      (target_subject_id, 'cardiology_followup', 'Cardiology follow-up', 'Review blood pressure log, dizziness, cholesterol, and medication timing', seeded_at - interval '3 months', 'scheduled', 'Dr. Rebecca Allen', 'Heart & Vascular Clinic', 'Heart & Vascular Clinic', '100 Medical Pkwy, Springfield, IL', '555-0201', null::timestamptz),
      (target_subject_id, 'nutrition_labs', 'Nutrition and lab review', 'Review weight, nutrition, cholesterol, and lab results', seeded_at - interval '2 months', 'scheduled', 'Dr. John Smith', 'Main Street Clinic', 'Main Street Clinic', '22 Main Street, Springfield, IL', '555-0102', null::timestamptz),
      (target_subject_id, 'breathing_sleep', 'Breathing and fatigue visit', 'Asthma, breathing symptoms, fatigue, sleep, and follow-up', seeded_at - interval '15 days', 'scheduled', 'Dr. Maya Chen', 'Main Street Clinic', 'Main Street Clinic', '22 Main Street, Springfield, IL', '555-0102', null::timestamptz),
      (target_subject_id, 'future_cardiology_plan', 'Upcoming cardiology follow-up', 'Bring prior BP readings, dizziness history, cholesterol discussion, and medication timing questions', seeded_at + interval '10 days', 'scheduled', 'Dr. Rebecca Allen', 'Heart & Vascular Clinic', 'Heart & Vascular Clinic', '100 Medical Pkwy, Springfield, IL', '555-0201', null::timestamptz),
      (target_subject_id, 'dental_cleaning', 'Dental cleaning', 'Routine cleaning and gum check', seeded_at + interval '35 days', 'scheduled', 'Dr. Priya Patel', 'Harbor Dental', 'Harbor Dental', '455 Oak Ave, Springfield, IL', '555-0144', null::timestamptz),
      (target_subject_id, 'vet_visit_dixie', 'Dixie vet appetite check', 'Care VIP example for a pet: appetite, weight, and dental tartar questions', seeded_at + interval '52 days', 'scheduled', 'Dr. Avery Morgan', 'Animal Hospital', 'Animal Hospital', '12 Pet Care Lane, Springfield, IL', '555-0701', null::timestamptz),
      (caregiver_subject_id, 'mom_pcp_initial', 'Mom primary care fatigue and blood pressure', 'Caregiver visit: blood pressure, fatigue, and medication list review', seeded_at - interval '7 months', 'scheduled', 'Dr. Elise Carter', 'Family Care Partners', 'Family Care Partners', '44 Caregiver Way, Springfield, IL', '555-0801', null::timestamptz),
      (caregiver_subject_id, 'mom_lab_review', 'Mom lab review', 'Caregiver visit: cholesterol, kidney function, fatigue labs, and follow-up', seeded_at - interval '5 months', 'scheduled', 'Dr. Elise Carter', 'Family Care Partners', 'Family Care Partners', '44 Caregiver Way, Springfield, IL', '555-0801', null::timestamptz),
      (caregiver_subject_id, 'mom_cardiology_med_review', 'Mom cardiology medication review', 'Caregiver visit: cardiology, blood pressure, cholesterol, dizziness, and medication timing', seeded_at - interval '3 months', 'scheduled', 'Dr. Rebecca Allen', 'Heart & Vascular Clinic', 'Heart & Vascular Clinic', '100 Medical Pkwy, Springfield, IL', '555-0201', null::timestamptz),
      (caregiver_subject_id, 'mom_future_pcp', 'Mom upcoming PCP follow-up', 'Review cardiology recommendations, lab results, and medication timing', seeded_at + interval '21 days', 'scheduled', 'Dr. Elise Carter', 'Family Care Partners', 'Family Care Partners', '44 Caregiver Way, Springfield, IL', '555-0801', null::timestamptz)
  ),
  inserted as (
    insert into public.appointments (
      care_circle_id,
      care_subject_id,
      owner_user_id,
      title,
      reason,
      starts_at,
      status,
      provider_name,
      provider_organization,
      location_name,
      location_address,
      location_phone,
      source,
      archived_at,
      is_sample_data,
      sample_data_seed_version
    )
    select
      target_care_circle_id,
      seeded_appointments.care_subject_id,
      target_user_id,
      title,
      reason,
      starts_at,
      status::public.appointment_status,
      provider_name,
      provider_organization,
      location_name,
      location_address,
      location_phone,
      'sample:' || seed_key,
      archived_at,
      true,
      seed_version
    from seeded_appointments
    returning id, source
  )
  insert into _sample_seed_appointments (seed_key, care_subject_id, appointment_id)
  select replace(inserted.source, 'sample:', ''), seeded_appointments.care_subject_id, inserted.id
  from inserted
  join seeded_appointments
    on inserted.source = 'sample:' || seeded_appointments.seed_key;

  with seeded_notes(seed_key, input_text, summary_short, takeaways, followups, topic_status) as (
    values
      ('knee_primary_initial',
       'Sample note: Primary care evaluated right knee pain after a fall. Imaging was ordered and orthopedics was suggested if symptoms continued.',
       'Primary care started the right knee pain thread and ordered imaging.',
       jsonb_build_array('Knee pain began after a fall.', 'Primary care ordered imaging before specialty follow-up.'),
       jsonb_build_array('Complete knee imaging and consider orthopedics if pain continues.'),
       'new'),
      ('knee_ortho_initial',
       'Sample note: Right knee pain began after a fall. Orthopedics discussed exam findings, x-ray, possible MRI, and mild arthritis. Pain is worse with stairs.',
       'Right knee pain was evaluated after a fall. Imaging and arthritis were discussed.',
       jsonb_build_array('Right knee pain appears to be the main orthopedic concern.', 'MRI may be considered if pain continues.'),
       jsonb_build_array('Follow up with orthopedics if swelling or pain persists.'),
       'ongoing'),
      ('knee_mri_review',
       'Sample note: MRI showed degenerative meniscus changes and mild arthritis. Conservative treatment was recommended before considering procedures.',
       'MRI results connected knee pain with arthritis. Conservative treatment was recommended.',
       jsonb_build_array('MRI did not lead directly to surgery.', 'Arthritis may contribute to knee pain.'),
       jsonb_build_array('Begin conservative care and reassess symptoms.'),
       'follow_up'),
      ('knee_pt_start',
       'Sample note: Physical therapy started for right knee pain. PT reviewed strengthening, walking tolerance, balance, and exercises.',
       'Physical therapy began for right knee pain and mobility.',
       jsonb_build_array('PT is tied to the knee pain care thread.', 'Walking tolerance and balance were reviewed.'),
       jsonb_build_array('Continue PT exercises at home.'),
       'ongoing'),
      ('knee_followup_resolved',
       'Sample note: Knee pain improved after physical therapy. Orthopedics marked the current episode resolved, with follow-up only if symptoms return.',
       'Knee pain improved after PT and was marked resolved for now.',
       jsonb_build_array('PT helped the knee pain episode.', 'Return if swelling or pain comes back.'),
       jsonb_build_array('No routine orthopedic follow-up unless symptoms return.'),
       'resolved'),
      ('dental_pain',
       'Sample note: Dental pain was from a cracked crown. Dentist adjusted the crown and said this tooth pain is separate from knee pain or orthopedic care.',
       'Dental pain was tied to a cracked crown and treated as a separate issue.',
       jsonb_build_array('Tooth pain appears separate from orthopedic pain.', 'Crown adjustment was completed.'),
       jsonb_build_array('Call Harbor Dental if tooth sensitivity returns.'),
       'resolved'),
      ('primary_bp_dizziness',
       'Sample note: Blood pressure was elevated at home. Dizziness, stress, medication timing, cholesterol history, and home monitoring were discussed.',
       'Blood pressure was discussed with dizziness, stress, medication timing, and home monitoring.',
       jsonb_build_array('Track home blood pressure readings.', 'Medication timing may matter for dizziness.'),
       jsonb_build_array('Bring the home BP log to the next visit.'),
       'ongoing'),
      ('urgent_dizzy_bp',
       'Sample note: Urgent care visit for dizziness and high home blood pressure. No fainting. Follow up with primary care or cardiology was recommended.',
       'Dizziness and elevated blood pressure led to urgent care follow-up.',
       jsonb_build_array('Dizziness overlapped with elevated blood pressure.', 'Follow-up was recommended.'),
       jsonb_build_array('Follow up if dizziness continues or readings stay elevated.'),
       'follow_up'),
      ('procedure_oneoff',
       'Sample note: Dermatology performed a small mole biopsy procedure. Wound care was reviewed. This was a one-time procedure with routine lab/pathology follow-up.',
       'A one-time dermatology procedure was completed.',
       jsonb_build_array('Procedure appears as a one-time item.', 'Pathology follow-up was routine.'),
       jsonb_build_array('Watch biopsy site for redness or drainage.'),
       'resolved'),
      ('cardiology_followup',
       'Sample note: Cardiology reviewed blood pressure log, dizziness, cholesterol, medication timing, and home monitoring. No medication change today.',
       'Cardiology connected blood pressure with dizziness, cholesterol, medication timing, and home monitoring.',
       jsonb_build_array('Cardiology reviewed the BP log.', 'No medication change was made.'),
       jsonb_build_array('Continue home monitoring and send readings if dizziness worsens.'),
       'follow_up'),
      ('nutrition_labs',
       'Sample note: Nutrition and weight were reviewed with cholesterol labs. Primary care discussed diet, walking, blood pressure, and repeat lab results.',
       'Nutrition and weight were reviewed alongside cholesterol, labs, walking, and blood pressure.',
       jsonb_build_array('Nutrition is loosely tied to BP and cholesterol monitoring.', 'Repeat labs were discussed.'),
       jsonb_build_array('Repeat cholesterol labs later this year.'),
       'ongoing'),
      ('breathing_sleep',
       'Sample note: Asthma and breathing symptoms were discussed with fatigue and sleep. Provider noted this may overlap with stress, but not necessarily blood pressure or cholesterol.',
       'Breathing symptoms were discussed with fatigue, sleep, stress, and follow-up.',
       jsonb_build_array('Asthma/breathing overlaps with fatigue and sleep.', 'Relationship to blood pressure is unclear.'),
       jsonb_build_array('Use inhaler as directed and follow up if wheezing increases.'),
       'ongoing'),
      ('mom_pcp_initial',
       'Sample note: Caregiver visit for Mom Bobson. Primary care reviewed blood pressure, fatigue, medication list, and possible lab work.',
       'Mom''s primary care visit connected blood pressure, fatigue, medications, and lab follow-up.',
       jsonb_build_array('Caregiver context includes medication list and fatigue.', 'Labs were ordered to support follow-up.'),
       jsonb_build_array('Bring medication bottles and home BP readings to the next visit.'),
       'ongoing'),
      ('mom_lab_review',
       'Sample note: Mom''s lab review covered cholesterol, kidney function, fatigue labs, and medication monitoring. Primary care recommended cardiology follow-up.',
       'Mom''s labs connected cholesterol, fatigue, and medication monitoring.',
       jsonb_build_array('Cholesterol and labs were reviewed together.', 'Cardiology follow-up was recommended.'),
       jsonb_build_array('Share lab results with cardiology.'),
       'follow_up'),
      ('mom_cardiology_med_review',
       'Sample note: Cardiology reviewed Mom''s blood pressure log, dizziness, cholesterol history, and medication timing. PCP follow-up was recommended.',
       'Mom''s cardiology visit tied BP, dizziness, cholesterol, and medication timing together.',
       jsonb_build_array('Cardiology reviewed blood pressure and medication timing.', 'PCP should review follow-up plan.'),
       jsonb_build_array('Bring cardiology notes to PCP follow-up.'),
       'follow_up')
  ),
  inserted as (
    insert into public.appointment_notes (
      appointment_id,
      care_circle_id,
      user_id,
      input_text,
      summary_short,
      takeaways,
      followups,
      is_current,
      version_number,
      source,
      generated_by_ai,
      accepted_by_user,
      is_sample_data,
      sample_data_seed_version
    )
    select
      map.appointment_id,
      target_care_circle_id,
      target_user_id,
      seeded_notes.input_text,
      seeded_notes.summary_short,
      seeded_notes.takeaways,
      seeded_notes.followups,
      true,
      1,
      'sample:' || seeded_notes.seed_key,
      false,
      true,
      true,
      seed_version
    from seeded_notes
    join _sample_seed_appointments map
      on map.seed_key = seeded_notes.seed_key
    returning id, appointment_id, source
  )
  update _sample_seed_appointments map
    set note_id = inserted.id
  from inserted
  where map.appointment_id = inserted.appointment_id;

  update public.appointments a
    set current_note_id = map.note_id
  from _sample_seed_appointments map
  where a.id = map.appointment_id
    and map.note_id is not null;

  insert into public.topic_mentions (
    care_circle_id,
    care_subject_id,
    topic_id,
    normalized_topic_slug,
    source_table,
    source_id,
    appointment_id,
    source_snippet,
    source_text_hash,
    source_anchor,
    confidence,
    ai_suggested_status,
    status,
    status_source,
    provider_name,
    provider_organization,
    appointment_starts_at,
    related_topic_slugs,
    extraction_method,
    extraction_run_key,
    prompt_version,
    model,
    metadata,
    is_active
  )
  select
    target_care_circle_id,
    map.care_subject_id,
    ht.id,
    mention.topic_slug,
    'appointment_notes',
    map.note_id,
    map.appointment_id,
    mention.snippet,
    md5(mention.snippet),
    jsonb_build_object('sampleSeedKey', mention.seed_key),
    mention.confidence,
    mention.topic_status,
    mention.topic_status,
    'system',
    a.provider_name,
    a.provider_organization,
    a.starts_at,
    mention.related_topic_slugs,
    'sample_seed',
    seed_version,
    seed_version,
    'sample',
    jsonb_build_object('is_sample_data', true, 'sample_seed_version', seed_version),
    true
  from (
    values
      ('knee_primary_initial', 'knee_pain', 'Primary care started the right knee pain thread after a fall.', 0.98, 'new', array['pain','imaging','follow_up']),
      ('knee_primary_initial', 'pain', 'Pain was localized to the right knee after a fall.', 0.88, 'new', array['knee_pain','imaging']),
      ('knee_primary_initial', 'imaging', 'Primary care ordered imaging for right knee pain.', 0.9, 'follow_up', array['knee_pain','pain']),
      ('knee_primary_initial', 'follow_up', 'Orthopedic follow-up was suggested if symptoms continued.', 0.82, 'follow_up', array['knee_pain','imaging']),
      ('knee_ortho_initial', 'knee_pain', 'Right knee pain began after a fall and was evaluated by orthopedics.', 0.98, 'ongoing', array['pain','orthopedics','imaging','arthritis','follow_up']),
      ('knee_ortho_initial', 'pain', 'Pain was localized to the right knee and worse with stairs.', 0.9, 'ongoing', array['knee_pain','orthopedics','imaging']),
      ('knee_ortho_initial', 'orthopedics', 'Orthopedics discussed exam findings and possible MRI.', 0.88, 'ongoing', array['knee_pain','imaging','arthritis']),
      ('knee_ortho_initial', 'imaging', 'X-ray and possible MRI were discussed for knee pain.', 0.86, 'follow_up', array['knee_pain','orthopedics','arthritis']),
      ('knee_ortho_initial', 'arthritis', 'Mild arthritis was discussed as possible knee context.', 0.82, 'ongoing', array['knee_pain','imaging']),
      ('knee_mri_review', 'knee_pain', 'MRI results connected right knee pain with degenerative meniscus changes.', 0.98, 'follow_up', array['imaging','arthritis','orthopedics','procedures']),
      ('knee_mri_review', 'imaging', 'MRI showed degenerative meniscus changes.', 0.95, 'follow_up', array['knee_pain','arthritis','orthopedics']),
      ('knee_mri_review', 'arthritis', 'Mild arthritis was reviewed with the MRI.', 0.9, 'ongoing', array['knee_pain','imaging']),
      ('knee_mri_review', 'procedures', 'Procedures were discussed but conservative treatment came first.', 0.62, 'unknown', array['knee_pain','imaging']),
      ('knee_pt_start', 'physical_therapy', 'Physical therapy started for right knee pain.', 0.98, 'ongoing', array['knee_pain','pain','walking_balance','follow_up']),
      ('knee_pt_start', 'knee_pain', 'PT reviewed strengthening for right knee pain.', 0.96, 'ongoing', array['physical_therapy','pain','walking_balance']),
      ('knee_pt_start', 'walking_balance', 'Walking tolerance and balance were reviewed in PT.', 0.8, 'ongoing', array['physical_therapy','knee_pain']),
      ('knee_pt_start', 'pain', 'Pain was discussed during PT for the right knee.', 0.86, 'ongoing', array['knee_pain','physical_therapy']),
      ('knee_followup_resolved', 'knee_pain', 'Knee pain improved after physical therapy.', 0.98, 'resolved', array['physical_therapy','arthritis','follow_up']),
      ('knee_followup_resolved', 'physical_therapy', 'Physical therapy helped the knee pain episode.', 0.9, 'resolved', array['knee_pain','follow_up']),
      ('knee_followup_resolved', 'arthritis', 'Arthritis remains background context for the knee.', 0.7, 'ongoing', array['knee_pain','physical_therapy']),
      ('knee_followup_resolved', 'follow_up', 'Follow up only if symptoms return.', 0.78, 'resolved', array['knee_pain','physical_therapy']),
      ('dental_pain', 'dental_oral_health', 'Dental pain was tied to a cracked crown.', 0.98, 'resolved', array['pain','follow_up']),
      ('dental_pain', 'pain', 'Tooth pain was treated as separate from orthopedic pain.', 0.85, 'resolved', array['dental_oral_health','follow_up']),
      ('dental_pain', 'follow_up', 'Call dental office if sensitivity returns.', 0.75, 'resolved', array['dental_oral_health','pain']),
      ('primary_bp_dizziness', 'blood_pressure', 'Blood pressure was elevated at home.', 0.98, 'ongoing', array['dizziness','medication_changes','home_monitoring','anxiety_stress','cholesterol']),
      ('primary_bp_dizziness', 'dizziness', 'Dizziness was discussed with blood pressure and medication timing.', 0.92, 'ongoing', array['blood_pressure','medication_changes','anxiety_stress']),
      ('primary_bp_dizziness', 'medication_changes', 'Medication timing may matter for dizziness.', 0.86, 'follow_up', array['blood_pressure','dizziness']),
      ('primary_bp_dizziness', 'home_monitoring', 'Home blood pressure readings were requested.', 0.9, 'follow_up', array['blood_pressure']),
      ('primary_bp_dizziness', 'anxiety_stress', 'Stress was discussed as possible context for symptoms.', 0.72, 'unknown', array['blood_pressure','dizziness']),
      ('urgent_dizzy_bp', 'blood_pressure', 'Urgent care noted elevated home blood pressure readings.', 0.95, 'follow_up', array['dizziness','medication_changes','follow_up']),
      ('urgent_dizzy_bp', 'dizziness', 'Dizziness prompted urgent care evaluation.', 0.95, 'follow_up', array['blood_pressure','medication_changes']),
      ('urgent_dizzy_bp', 'medication_changes', 'Medication timing was reviewed during urgent care.', 0.78, 'follow_up', array['blood_pressure','dizziness']),
      ('urgent_dizzy_bp', 'follow_up', 'Primary care or cardiology follow-up was recommended.', 0.84, 'follow_up', array['blood_pressure','dizziness']),
      ('procedure_oneoff', 'procedures', 'A small mole biopsy procedure was completed.', 0.98, 'resolved', array['preventive_care','lab_results']),
      ('procedure_oneoff', 'preventive_care', 'Dermatology procedure was routine preventive follow-up.', 0.68, 'resolved', array['procedures']),
      ('procedure_oneoff', 'lab_results', 'Pathology follow-up was routine after the biopsy.', 0.58, 'resolved', array['procedures']),
      ('cardiology_followup', 'blood_pressure', 'Cardiology reviewed blood pressure log and home monitoring.', 0.98, 'follow_up', array['dizziness','cholesterol','medication_changes','home_monitoring','cardiology']),
      ('cardiology_followup', 'dizziness', 'Dizziness was reviewed with cardiology.', 0.9, 'follow_up', array['blood_pressure','medication_changes','cardiology']),
      ('cardiology_followup', 'cholesterol', 'Cholesterol history was reviewed by cardiology.', 0.86, 'ongoing', array['blood_pressure','cardiology','lab_results']),
      ('cardiology_followup', 'medication_changes', 'No medication change was made today.', 0.82, 'follow_up', array['blood_pressure','dizziness']),
      ('cardiology_followup', 'cardiology', 'Cardiology reviewed BP, dizziness, and cholesterol.', 0.95, 'follow_up', array['blood_pressure','dizziness','cholesterol']),
      ('nutrition_labs', 'nutrition_weight', 'Nutrition and weight were reviewed with cholesterol labs.', 0.96, 'ongoing', array['cholesterol','lab_results','blood_pressure','walking_balance']),
      ('nutrition_labs', 'lab_results', 'Repeat cholesterol labs were discussed.', 0.9, 'follow_up', array['nutrition_weight','cholesterol','blood_pressure']),
      ('nutrition_labs', 'cholesterol', 'Cholesterol labs were reviewed with nutrition and weight.', 0.9, 'ongoing', array['nutrition_weight','lab_results','blood_pressure']),
      ('nutrition_labs', 'blood_pressure', 'Blood pressure was part of broader nutrition and lab monitoring.', 0.72, 'ongoing', array['nutrition_weight','cholesterol','lab_results']),
      ('nutrition_labs', 'walking_balance', 'Walking was discussed as part of activity planning.', 0.55, 'unknown', array['nutrition_weight']),
      ('breathing_sleep', 'asthma_breathing', 'Asthma and breathing symptoms were discussed.', 0.96, 'ongoing', array['fatigue','sleep','follow_up','anxiety_stress','blood_pressure','cholesterol']),
      ('breathing_sleep', 'fatigue', 'Fatigue was discussed with breathing symptoms and sleep.', 0.88, 'ongoing', array['asthma_breathing','sleep']),
      ('breathing_sleep', 'sleep', 'Sleep quality was discussed with fatigue.', 0.86, 'ongoing', array['asthma_breathing','fatigue']),
      ('breathing_sleep', 'follow_up', 'Follow up if wheezing increases.', 0.78, 'follow_up', array['asthma_breathing','fatigue']),
      ('breathing_sleep', 'anxiety_stress', 'Stress may overlap with breathing symptoms.', 0.62, 'unknown', array['asthma_breathing','fatigue']),
      ('mom_pcp_initial', 'blood_pressure', 'Mom Bobson had primary care blood pressure follow-up.', 0.96, 'ongoing', array['fatigue','medication_changes','lab_results','home_monitoring']),
      ('mom_pcp_initial', 'fatigue', 'Fatigue was reviewed with primary care.', 0.88, 'ongoing', array['blood_pressure','lab_results']),
      ('mom_pcp_initial', 'medication_changes', 'Medication list review was part of the caregiver visit.', 0.86, 'follow_up', array['blood_pressure','fatigue']),
      ('mom_pcp_initial', 'lab_results', 'Labs were ordered to support fatigue and medication follow-up.', 0.82, 'follow_up', array['fatigue','blood_pressure']),
      ('mom_lab_review', 'lab_results', 'Mom Bobson reviewed lab results with primary care.', 0.95, 'follow_up', array['cholesterol','fatigue','medication_changes']),
      ('mom_lab_review', 'cholesterol', 'Cholesterol labs were reviewed as part of caregiver follow-up.', 0.92, 'ongoing', array['lab_results','cardiology','blood_pressure']),
      ('mom_lab_review', 'fatigue', 'Fatigue labs were part of the review.', 0.82, 'ongoing', array['lab_results','medication_changes']),
      ('mom_lab_review', 'medication_changes', 'Medication monitoring was discussed after labs.', 0.78, 'follow_up', array['lab_results','cholesterol']),
      ('mom_cardiology_med_review', 'cardiology', 'Mom Bobson saw cardiology for BP and medication review.', 0.96, 'follow_up', array['blood_pressure','cholesterol','medication_changes','dizziness']),
      ('mom_cardiology_med_review', 'blood_pressure', 'Cardiology reviewed Mom''s blood pressure log.', 0.95, 'follow_up', array['cardiology','medication_changes','dizziness']),
      ('mom_cardiology_med_review', 'cholesterol', 'Cholesterol history was reviewed by cardiology.', 0.86, 'ongoing', array['cardiology','lab_results','blood_pressure']),
      ('mom_cardiology_med_review', 'medication_changes', 'Medication timing was reviewed by cardiology.', 0.9, 'follow_up', array['blood_pressure','dizziness','cardiology']),
      ('mom_cardiology_med_review', 'dizziness', 'Dizziness was reviewed with medication timing.', 0.78, 'follow_up', array['blood_pressure','medication_changes'])
  ) as mention(seed_key, topic_slug, snippet, confidence, topic_status, related_topic_slugs)
  join _sample_seed_appointments map
    on map.seed_key = mention.seed_key
  join public.appointments a
    on a.id = map.appointment_id
  left join public.health_topics ht
    on ht.slug = mention.topic_slug
  where map.note_id is not null
  on conflict (source_table, source_id, normalized_topic_slug)
    where is_active = true and source_id is not null
  do update
    set source_snippet = excluded.source_snippet,
        source_text_hash = excluded.source_text_hash,
        confidence = excluded.confidence,
        ai_suggested_status = excluded.ai_suggested_status,
        status = excluded.status,
        provider_name = excluded.provider_name,
        provider_organization = excluded.provider_organization,
        appointment_starts_at = excluded.appointment_starts_at,
        related_topic_slugs = excluded.related_topic_slugs,
        extraction_method = excluded.extraction_method,
        extraction_run_key = excluded.extraction_run_key,
        prompt_version = excluded.prompt_version,
        model = excluded.model,
        metadata = excluded.metadata,
        is_active = true,
        updated_at = now();

  insert into public.careprep_guidance (
    appointment_id,
    care_circle_id,
    user_id,
    generated_at,
    summary,
    key_questions,
    bring_list,
    watchouts,
    med_review,
    since_last_visit,
    next_steps,
    is_current,
    version_number,
    review_status,
    source,
    status,
    model,
    prompt_version,
    is_sample_data,
    sample_data_seed_version
  )
  select
    map.appointment_id,
    target_care_circle_id,
    target_user_id,
    seeded_at,
    guidance.summary,
    guidance.key_questions,
    guidance.bring_list,
    guidance.watchouts,
    guidance.med_review,
    guidance.since_last_visit,
    guidance.next_steps,
    true,
    1,
    'accepted',
    'ai_generated',
    'succeeded',
    'sample',
    seed_version,
    true,
    seed_version
  from (
    values
      ('future_cardiology_plan',
       'Prepare for cardiology by carrying forward the blood pressure, dizziness, cholesterol, home-monitoring, and medication-timing story.',
       jsonb_build_array('Do dizziness episodes line up with medication timing?', 'Do home BP readings suggest a change is needed?', 'Should cholesterol or nutrition context affect the plan?'),
       jsonb_build_array('Home blood pressure log', 'Medication list with timing', 'Recent cholesterol/lab notes'),
       jsonb_build_array('Fainting, chest pain, worsening dizziness, or very high readings'),
       jsonb_build_array('Review blood pressure medication timing and whether dizziness could be related.'),
       jsonb_build_array('Primary care, urgent care, cardiology, and nutrition/lab visits all touched this thread.'),
       jsonb_build_array('Ask whether monitoring, medication timing, or cardiology follow-up should change.')),
      ('dental_cleaning',
       'Prepare for the dental cleaning by bringing context from the prior cracked crown visit.',
       jsonb_build_array('Has tooth sensitivity returned since the crown adjustment?', 'Do any gums or teeth need follow-up?'),
       jsonb_build_array('Medication list', 'Dental insurance card'),
       jsonb_build_array('New tooth pain or swelling'),
       jsonb_build_array('Review any medications that affect dental care.'),
       jsonb_build_array('Prior dental pain was tied to a cracked crown and treated separately from knee pain.'),
       jsonb_build_array('Ask whether routine follow-up is enough.')),
      ('vet_visit_dixie',
       'Prepare for Dixie''s vet visit by noting appetite, weight, and dental tartar questions.',
       jsonb_build_array('Has appetite changed recently?', 'Should dental tartar be monitored or cleaned?'),
       jsonb_build_array('Pet medication list', 'Recent food notes'),
       jsonb_build_array('Reduced appetite, vomiting, or lethargy'),
       jsonb_build_array('Review any flea/tick or heartworm medications.'),
       jsonb_build_array('This demo shows a Care VIP can be a pet or family member.'),
       jsonb_build_array('Ask whether weight or appetite needs follow-up.')),
      ('mom_future_pcp',
       'Prepare for Mom Bobson''s PCP follow-up by carrying forward cardiology, lab, cholesterol, blood pressure, dizziness, and medication timing context.',
       jsonb_build_array('How should cardiology recommendations change the medication plan?', 'Do lab results affect cholesterol or BP follow-up?', 'Could dizziness relate to medication timing?'),
       jsonb_build_array('Mom''s medication bottles/list', 'Cardiology notes', 'Recent lab results', 'Home BP readings'),
       jsonb_build_array('New dizziness, falls, confusion, chest pain, or very high BP readings'),
       jsonb_build_array('Review medication timing, BP medications, and any cardiology changes.'),
       jsonb_build_array('Mom had PCP fatigue/BP review, labs, and cardiology medication review before this appointment.'),
       jsonb_build_array('Ask for a clear caregiver-friendly plan for medications, labs, and follow-up.'))
  ) as guidance(seed_key, summary, key_questions, bring_list, watchouts, med_review, since_last_visit, next_steps)
  join _sample_seed_appointments map
    on map.seed_key = guidance.seed_key;

  with asthma_mentions as (
    select id, appointment_id
    from public.topic_mentions
    where care_circle_id = target_care_circle_id
      and care_subject_id = target_subject_id
      and normalized_topic_slug = 'asthma_breathing'
      and extraction_run_key = seed_version
  ),
  asthma_sources as (
    select
      coalesce(array_agg(distinct appointment_id) filter (where appointment_id is not null), '{}'::uuid[]) as appointment_ids,
      coalesce(array_agg(id), '{}'::uuid[]) as mention_ids
    from asthma_mentions
  ),
  inserted_feedback as (
    insert into public.health_topic_feedback (
      user_id,
      care_circle_id,
      care_subject_id,
      topic_slug,
      target_type,
      feedback_mode,
      feedback_value,
      related_topic_slug,
      relationship_feedback,
      system_summary_text,
      system_snapshot,
      interpreted_correction,
      source_appointment_ids,
      source_topic_mention_ids,
      should_influence_future_generation,
      incorporation_status,
      metadata
    )
    select
      target_user_id,
      target_care_circle_id,
      target_subject_id,
      'asthma_breathing',
      'topic_relationship',
      'binary',
      'unrelated',
      'cholesterol',
      'unrelated',
      'Breathing symptoms may overlap with monitoring topics, but cholesterol was marked separate in demo context.',
      jsonb_build_object('sampleScenario', 'related-topic ambiguity'),
      jsonb_build_object(
        'feedback_value', 'unrelated',
        'related_topic_slug', 'cholesterol',
        'target_type', 'topic_relationship',
        'topic_slug', 'asthma_breathing'
      ),
      asthma_sources.appointment_ids,
      asthma_sources.mention_ids,
      true,
      'pending',
      jsonb_build_object('is_sample_data', true, 'sample_seed_version', seed_version)
    from asthma_sources
    returning id, source_appointment_ids, source_topic_mention_ids
  )
  insert into public.health_topic_user_context (
    user_id,
    care_circle_id,
    care_subject_id,
    topic_slug,
    context_type,
    context_text,
    structured_context,
    related_topic_slug,
    source_feedback_id,
    source_appointment_ids,
    source_topic_mention_ids,
    confidence,
    should_influence_health_focus,
    should_influence_careprep,
    should_influence_reports,
    incorporation_status,
    metadata
  )
  select
    target_user_id,
    target_care_circle_id,
    target_subject_id,
    'asthma_breathing',
    'topic_relationship',
    'You marked Cholesterol as a separate topic.',
    jsonb_build_object(
      'feedback_mode', 'binary',
      'feedback_value', 'unrelated',
      'relationship_feedback', 'unrelated',
      'target_type', 'topic_relationship'
    ),
    'cholesterol',
    inserted_feedback.id,
    inserted_feedback.source_appointment_ids,
    inserted_feedback.source_topic_mention_ids,
    1,
    true,
    true,
    true,
    'active',
    jsonb_build_object('is_sample_data', true, 'sample_seed_version', seed_version)
  from inserted_feedback;

  with knee_mentions as (
    select id, appointment_id
    from public.topic_mentions
    where care_circle_id = target_care_circle_id
      and care_subject_id = target_subject_id
      and normalized_topic_slug = 'knee_pain'
      and extraction_run_key = seed_version
  ),
  knee_sources as (
    select
      coalesce(array_agg(distinct appointment_id) filter (where appointment_id is not null), '{}'::uuid[]) as appointment_ids,
      coalesce(array_agg(id), '{}'::uuid[]) as mention_ids
    from knee_mentions
  ),
  inserted_feedback as (
    insert into public.health_topic_feedback (
      user_id,
      care_circle_id,
      care_subject_id,
      topic_slug,
      target_type,
      feedback_mode,
      feedback_value,
      related_topic_slug,
      relationship_feedback,
      system_summary_text,
      system_snapshot,
      interpreted_correction,
      source_appointment_ids,
      source_topic_mention_ids,
      should_influence_future_generation,
      incorporation_status,
      metadata
    )
    select
      target_user_id,
      target_care_circle_id,
      target_subject_id,
      'knee_pain',
      'topic_relationship',
      'binary',
      'related',
      'physical_therapy',
      'related',
      'Knee pain and physical therapy were confirmed as part of the same demo care thread.',
      jsonb_build_object('sampleScenario', 'accepted related-topic connection'),
      jsonb_build_object(
        'feedback_value', 'related',
        'related_topic_slug', 'physical_therapy',
        'target_type', 'topic_relationship',
        'topic_slug', 'knee_pain'
      ),
      knee_sources.appointment_ids,
      knee_sources.mention_ids,
      true,
      'pending',
      jsonb_build_object('is_sample_data', true, 'sample_seed_version', seed_version)
    from knee_sources
    returning id, source_appointment_ids, source_topic_mention_ids
  )
  insert into public.health_topic_user_context (
    user_id,
    care_circle_id,
    care_subject_id,
    topic_slug,
    context_type,
    context_text,
    structured_context,
    related_topic_slug,
    source_feedback_id,
    source_appointment_ids,
    source_topic_mention_ids,
    confidence,
    should_influence_health_focus,
    should_influence_careprep,
    should_influence_reports,
    incorporation_status,
    metadata
  )
  select
    target_user_id,
    target_care_circle_id,
    target_subject_id,
    'knee_pain',
    'topic_relationship',
    'You marked Physical Therapy as a Related Topic.',
    jsonb_build_object(
      'feedback_mode', 'binary',
      'feedback_value', 'related',
      'relationship_feedback', 'related',
      'target_type', 'topic_relationship'
    ),
    'physical_therapy',
    inserted_feedback.id,
    inserted_feedback.source_appointment_ids,
    inserted_feedback.source_topic_mention_ids,
    1,
    true,
    true,
    true,
    'active',
    jsonb_build_object('is_sample_data', true, 'sample_seed_version', seed_version)
  from inserted_feedback;

  select count(*)
    into created_appointment_count
  from _sample_seed_appointments;

  update public.profiles
    set sample_data_seeded_at = seeded_at,
        sample_data_declined_at = null,
        sample_data_seed_version = seed_version,
        sample_data_seeded_by_user_id = caller_user_id
  where id = target_user_id;

  return jsonb_build_object(
    'status', 'seeded',
    'seeded_at', seeded_at,
    'seed_version', seed_version,
    'appointments_created', created_appointment_count,
    'health_focus_topics_seeded', true
  );
end;
$$;

grant execute on function public.seed_sample_data_for_user(uuid, boolean) to authenticated;
