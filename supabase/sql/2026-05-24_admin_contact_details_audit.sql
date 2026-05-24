insert into public.admin_role_permissions (role_key, permission_scope, description)
values
  ('owner_admin', 'update_user_contact', 'Update profile contact details after a required admin justification.')
on conflict (role_key, permission_scope) do update
set description = excluded.description;

create or replace function public.reveal_admin_user_sensitive_data(
  p_target_user_id uuid,
  p_resource_type text,
  p_resource_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_resource_type text := lower(trim(coalesce(p_resource_type, '')));
  required_scope text;
  payload jsonb;
begin
  if cleaned_resource_type = 'profile_contact' then
    required_scope := 'reveal_user_contact';
  elsif cleaned_resource_type = 'appointment_details' then
    required_scope := 'reveal_appointment_details';
  elsif cleaned_resource_type = 'appointment_note' then
    required_scope := 'reveal_appointment_notes';
  elsif cleaned_resource_type = 'careprep_guidance' then
    required_scope := 'reveal_careprep_guidance';
  else
    raise exception 'Unsupported sensitive resource type: %', p_resource_type;
  end if;

  perform public.assert_current_admin_has_permission(required_scope);

  if p_target_user_id is null then
    raise exception 'Target user is required';
  end if;

  if cleaned_resource_type = 'profile_contact' and length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'A brief reason is required before viewing contact details';
  end if;

  if cleaned_resource_type <> 'profile_contact' and p_resource_id is null then
    raise exception 'Resource id is required';
  end if;

  if cleaned_resource_type = 'profile_contact' then
    select jsonb_build_object(
      'resource_type', cleaned_resource_type,
      'email', coalesce(nullif(trim(p.email), ''), au.email),
      'phone', p.phone,
      'phone_e164', p.phone_e164,
      'timezone', p.timezone,
      'address_line1', p.address_line1,
      'address_line2', p.address_line2,
      'city', p.city,
      'region', p.region,
      'postal_code', p.postal_code,
      'country', p.country
    )
      into payload
    from public.profiles p
    left join auth.users au on au.id = p.id
    where p.id = p_target_user_id;
  elsif cleaned_resource_type = 'appointment_details' then
    select jsonb_build_object(
      'resource_type', cleaned_resource_type,
      'appointment_id', a.id,
      'title', a.title,
      'starts_at', a.starts_at,
      'provider_name', a.provider_name,
      'provider_organization', a.provider_organization,
      'location_name', a.location_name,
      'reason', a.reason,
      'location_address', a.location_address,
      'location_phone', a.location_phone
    )
      into payload
    from public.appointments a
    join public.care_circle_memberships ccm
      on ccm.care_circle_id = a.care_circle_id
    where ccm.user_id = p_target_user_id
      and a.id = p_resource_id;
  elsif cleaned_resource_type = 'appointment_note' then
    select jsonb_build_object(
      'resource_type', cleaned_resource_type,
      'note_id', n.id,
      'appointment_id', n.appointment_id,
      'summary_short', n.summary_short,
      'takeaways', n.takeaways,
      'followups', n.followups,
      'version_number', n.version_number
    )
      into payload
    from public.appointment_notes n
    join public.appointments a on a.id = n.appointment_id
    join public.care_circle_memberships ccm
      on ccm.care_circle_id = a.care_circle_id
    where ccm.user_id = p_target_user_id
      and n.id = p_resource_id;
  elsif cleaned_resource_type = 'careprep_guidance' then
    select jsonb_build_object(
      'resource_type', cleaned_resource_type,
      'guidance_id', cg.id,
      'appointment_id', cg.appointment_id,
      'generated_at', cg.generated_at,
      'summary', cg.summary,
      'key_questions', cg.key_questions,
      'bring_list', cg.bring_list,
      'watchouts', cg.watchouts,
      'med_review', cg.med_review,
      'since_last_visit', cg.since_last_visit,
      'next_steps', cg.next_steps,
      'version_number', cg.version_number,
      'review_status', cg.review_status
    )
      into payload
    from public.careprep_guidance cg
    join public.appointments a on a.id = cg.appointment_id
    join public.care_circle_memberships ccm
      on ccm.care_circle_id = a.care_circle_id
    where ccm.user_id = p_target_user_id
      and cg.id = p_resource_id;
  end if;

  if payload is null then
    raise exception 'Sensitive resource not found or not owned by target user';
  end if;

  insert into public.admin_access_events (
    actor_user_id,
    target_user_id,
    event_type,
    resource_type,
    resource_id,
    permission_scope,
    reason,
    metadata
  )
  values (
    auth.uid(),
    p_target_user_id,
    case
      when cleaned_resource_type = 'profile_contact'
        then 'admin_contact_details_viewed'
      else 'admin_sensitive_data_revealed'
    end,
    cleaned_resource_type,
    p_resource_id,
    required_scope,
    nullif(trim(p_reason), ''),
    jsonb_build_object('resource_type', cleaned_resource_type)
  );

  return payload;
end;
$$;

grant execute on function public.reveal_admin_user_sensitive_data(uuid, text, uuid, text)
  to authenticated;
