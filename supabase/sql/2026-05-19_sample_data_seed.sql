alter table public.profiles
  add column if not exists sample_data_seeded_at timestamptz,
  add column if not exists sample_data_declined_at timestamptz,
  add column if not exists sample_data_seed_version text,
  add column if not exists sample_data_seeded_by_user_id uuid references auth.users(id);

alter table public.appointments
  add column if not exists is_sample_data boolean not null default false,
  add column if not exists sample_data_seed_version text;

alter table public.appointment_notes
  add column if not exists is_sample_data boolean not null default false,
  add column if not exists sample_data_seed_version text;

alter table public.careprep_guidance
  add column if not exists is_sample_data boolean not null default false,
  add column if not exists sample_data_seed_version text;

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
  seeded_at timestamptz := now();
  seed_version text := 'sample_seed_v1';
  cardiology_id uuid;
  primary_care_id uuid;
  dental_id uuid;
  ortho_id uuid;
  lab_id uuid;
  primary_note_id uuid;
  ortho_note_id uuid;
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
    is_sample_data,
    sample_data_seed_version
  )
  values (
    target_care_circle_id,
    target_subject_id,
    target_user_id,
    'Sample: Cardiology follow-up',
    'Review blood pressure log and dizziness since medication change',
    seeded_at + interval '14 days',
    'scheduled',
    'Dr. Rebecca Allen',
    'Heart & Vascular Clinic',
    'Heart & Vascular Clinic',
    '100 Medical Pkwy, Springfield, IL',
    '555-0201',
    'manual',
    true,
    seed_version
  )
  returning id into cardiology_id;

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
    is_sample_data,
    sample_data_seed_version
  )
  values (
    target_care_circle_id,
    target_subject_id,
    target_user_id,
    'Sample: Primary care follow-up',
    'Follow up on blood pressure, fatigue, and lab orders',
    seeded_at - interval '18 days',
    'scheduled',
    'Dr. John Smith',
    'Main Street Clinic',
    'Main Street Clinic',
    '22 Main Street, Springfield, IL',
    '555-0102',
    'manual',
    true,
    seed_version
  )
  returning id into primary_care_id;

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
    is_sample_data,
    sample_data_seed_version
  )
  values (
    target_care_circle_id,
    target_subject_id,
    target_user_id,
    'Sample: Dental cleaning',
    'Routine cleaning and checkup',
    seeded_at + interval '35 days',
    'scheduled',
    'Dr. Priya Patel',
    'Bright Dental',
    'Bright Dental',
    '455 Oak Ave, Springfield, IL',
    '555-0144',
    'manual',
    true,
    seed_version
  )
  returning id into dental_id;

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
    source,
    archived_at,
    is_sample_data,
    sample_data_seed_version
  )
  values (
    target_care_circle_id,
    target_subject_id,
    target_user_id,
    'Sample: Orthopedic visit',
    'Knee pain follow-up after MRI',
    seeded_at - interval '75 days',
    'archived',
    'Dr. Michael Smith',
    'Orthopedic Associates',
    'Orthopedic Associates',
    '18 Medical Plaza, Springfield, IL',
    'manual',
    seeded_at,
    true,
    seed_version
  )
  returning id into ortho_id;

  insert into public.appointments (
    care_circle_id,
    care_subject_id,
    owner_user_id,
    title,
    reason,
    starts_at,
    status,
    provider_organization,
    location_name,
    source,
    is_sample_data,
    sample_data_seed_version
  )
  values (
    target_care_circle_id,
    target_subject_id,
    target_user_id,
    'Sample: Lab appointment',
    'Complete CBC, CMP, TSH, and B12 labs',
    seeded_at - interval '5 days',
    'scheduled',
    'Main Street Clinic Lab',
    'Main Street Clinic Lab',
    'manual',
    true,
    seed_version
  )
  returning id into lab_id;

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
  values (
    primary_care_id,
    target_care_circle_id,
    target_user_id,
    'Sample note: blood pressure follow-up, fatigue discussion, labs ordered.',
    'Blood pressure was mildly elevated. Fatigue was discussed, and labs were ordered to check CBC, CMP, TSH, and B12.',
    jsonb_build_array(
      'Continue current blood pressure medication.',
      'Complete ordered labs within 1-2 weeks.',
      'Track home blood pressure readings before the next visit.'
    ),
    jsonb_build_array(
      'Schedule follow-up in about 3 months.',
      'Message clinic if home blood pressure is consistently above 150/90.'
    ),
    true,
    1,
    'manual',
    false,
    true,
    true,
    seed_version
  )
  returning id into primary_note_id;

  update public.appointments
    set current_note_id = primary_note_id
  where id = primary_care_id;

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
  values (
    ortho_id,
    target_care_circle_id,
    target_user_id,
    'Sample note: MRI showed degenerative meniscus tear and mild arthritis. PT recommended.',
    'MRI showed a degenerative meniscus tear with mild arthritis. Conservative treatment was recommended first.',
    jsonb_build_array(
      'Start physical therapy.',
      'Avoid repetitive twisting or squatting for now.'
    ),
    jsonb_build_array(
      'Follow up in about 6 weeks if symptoms continue.'
    ),
    true,
    1,
    'manual',
    false,
    true,
    true,
    seed_version
  )
  returning id into ortho_note_id;

  update public.appointments
    set current_note_id = ortho_note_id
  where id = ortho_id;

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
  values (
    cardiology_id,
    target_care_circle_id,
    target_user_id,
    seeded_at,
    'Prepare for the cardiology follow-up by reviewing recent blood pressure readings and dizziness patterns.',
    jsonb_build_array(
      'Could medication timing contribute to dizziness?',
      'Is the current blood pressure range acceptable?',
      'Should any labs or tests be reviewed before changing medications?'
    ),
    jsonb_build_array(
      'Medication list',
      'Home blood pressure readings',
      'Recent lab results, if available'
    ),
    jsonb_build_array(
      'Worsening dizziness, fainting, chest pain, or shortness of breath'
    ),
    jsonb_build_array(
      'Review current blood pressure medication and timing.'
    ),
    jsonb_build_array(
      'Primary care visit noted mildly elevated blood pressure and fatigue.'
    ),
    jsonb_build_array(
      'Bring any home blood pressure readings to the visit.'
    ),
    true,
    1,
    'accepted',
    'ai_generated',
    'succeeded',
    'sample',
    seed_version,
    true,
    seed_version
  );

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
    'appointments_created', 5
  );
end;
$$;

create or replace function public.seed_sample_data_for_current_user(
  force_if_declined boolean default false
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.seed_sample_data_for_user(auth.uid(), force_if_declined);
$$;

create or replace function public.decline_sample_data_for_current_user()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  declined_at timestamptz := now();
begin
  if caller_user_id is null then
    raise exception 'Must be signed in to decline sample data';
  end if;

  update public.profiles
    set sample_data_declined_at = declined_at
  where id = caller_user_id
    and sample_data_seeded_at is null;

  return jsonb_build_object('status', 'declined', 'declined_at', declined_at);
end;
$$;

create or replace function public.admin_sample_data_status(target_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_user_id uuid := auth.uid();
  caller_is_admin boolean := false;
  target_profile public.profiles%rowtype;
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

  select *
    into target_profile
  from public.profiles
  where lower(email) = lower(trim(target_email))
  limit 1;

  if not found then
    return jsonb_build_object('status', 'no_profile');
  end if;

  return jsonb_build_object(
    'status',
    case
      when target_profile.sample_data_seeded_at is not null then 'already_seeded'
      when target_profile.sample_data_declined_at is not null then 'declined'
      else 'available'
    end,
    'user_id', target_profile.id,
    'email', target_profile.email,
    'seeded_at', target_profile.sample_data_seeded_at,
    'declined_at', target_profile.sample_data_declined_at,
    'seed_version', target_profile.sample_data_seed_version
  );
end;
$$;

create or replace function public.admin_seed_sample_data(
  target_email text,
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

  return public.seed_sample_data_for_user(target_user_id, force_if_declined);
end;
$$;

grant execute on function public.seed_sample_data_for_user(uuid, boolean) to authenticated;
grant execute on function public.seed_sample_data_for_current_user(boolean) to authenticated;
grant execute on function public.decline_sample_data_for_current_user() to authenticated;
grant execute on function public.admin_sample_data_status(text) to authenticated;
grant execute on function public.admin_seed_sample_data(text, boolean) to authenticated;
