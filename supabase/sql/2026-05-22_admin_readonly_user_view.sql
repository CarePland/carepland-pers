create table if not exists public.admin_access_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  resource_type text,
  resource_id uuid,
  permission_scope text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_access_events_actor_created_idx
  on public.admin_access_events (actor_user_id, created_at desc);

create index if not exists admin_access_events_target_created_idx
  on public.admin_access_events (target_user_id, created_at desc);

alter table public.admin_access_events enable row level security;

grant select on public.admin_access_events to authenticated;

drop policy if exists "Admins can read admin access events" on public.admin_access_events;
create policy "Admins can read admin access events"
  on public.admin_access_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

create table if not exists public.admin_role_permissions (
  role_key text not null,
  permission_scope text not null,
  description text,
  created_at timestamptz not null default now(),
  primary key (role_key, permission_scope)
);

create table if not exists public.admin_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null,
  assigned_by_user_id uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_key)
);

alter table public.admin_role_permissions enable row level security;
alter table public.admin_user_roles enable row level security;

grant select on public.admin_role_permissions to authenticated;
grant select on public.admin_user_roles to authenticated;

drop policy if exists "Admins can read admin role permissions" on public.admin_role_permissions;
create policy "Admins can read admin role permissions"
  on public.admin_role_permissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "Admins can read admin user roles" on public.admin_user_roles;
create policy "Admins can read admin user roles"
  on public.admin_user_roles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_admin, false) = true
    )
  );

insert into public.admin_role_permissions (role_key, permission_scope, description)
values
  ('owner_admin', 'view_user_metadata', 'View non-sensitive user/account metadata in the read-only admin user view.'),
  ('owner_admin', 'reveal_user_contact', 'Reveal profile contact details such as email, phone, address, ZIP, and time zone.'),
  ('owner_admin', 'reveal_appointment_details', 'Reveal sensitive appointment shell details such as reason and location contact details.'),
  ('owner_admin', 'reveal_appointment_notes', 'Reveal appointment note summaries, takeaways, and follow-ups.'),
  ('owner_admin', 'reveal_careprep_guidance', 'Reveal CarePrep guidance body fields.')
on conflict (role_key, permission_scope) do update
set description = excluded.description;

create or replace function public.current_admin_has_permission(p_permission_scope text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.is_admin, false) = true
  )
  or exists (
    select 1
    from public.admin_user_roles aur
    join public.admin_role_permissions arp
      on arp.role_key = aur.role_key
    where aur.user_id = auth.uid()
      and arp.permission_scope = p_permission_scope
  );
$$;

grant execute on function public.current_admin_has_permission(text) to authenticated;

create or replace function public.assert_current_admin_has_permission(
  p_permission_scope text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;

  if not public.current_admin_has_permission(p_permission_scope) then
    raise exception 'Admin permission required: %', p_permission_scope;
  end if;
end;
$$;

grant execute on function public.assert_current_admin_has_permission(text)
  to authenticated;

create or replace function public.admin_sensitive_preview(p_value text)
returns text
language sql
immutable
as $$
  select
    case
      when nullif(trim(p_value), '') is null then null
      when length(trim(p_value)) <= 4 then left(trim(p_value), 1) || '...'
      else left(trim(p_value), 4) || '...'
    end;
$$;

create or replace function public.get_admin_user_readonly_snapshot(
  p_target_user_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
begin
  perform public.assert_current_admin_has_permission('view_user_metadata');

  if p_target_user_id is null then
    raise exception 'Target user is required';
  end if;

  insert into public.admin_access_events (
    actor_user_id,
    target_user_id,
    event_type,
    permission_scope,
    reason,
    metadata
  )
  values (
    auth.uid(),
    p_target_user_id,
    'admin_readonly_view_opened',
    'view_user_metadata',
    nullif(trim(p_reason), ''),
    '{}'::jsonb
  );

  with target_profile as (
    select
      p.*,
      au.email as auth_email,
      au.created_at as auth_created_at,
      au.raw_user_meta_data
    from public.profiles p
    left join auth.users au on au.id = p.id
    where p.id = p_target_user_id
  ),
  user_circles as (
    select distinct ccm.care_circle_id
    from public.care_circle_memberships ccm
    where ccm.user_id = p_target_user_id
  ),
  entitlement_rows as (
    select
      cce.care_circle_id,
      cce.plan_id,
      cce.status,
      pl.name as plan_name,
      pl.max_active_subjects
    from public.care_circle_entitlements cce
    left join public.plans pl on pl.id = cce.plan_id
    where cce.care_circle_id in (select care_circle_id from user_circles)
      and cce.status = 'active'
  ),
  subject_rows as (
    select
      cs.id,
      cs.care_circle_id,
      cs.display_name,
      cs.subject_type,
      cs.is_default,
      cs.is_active
    from public.care_subjects cs
    where cs.care_circle_id in (select care_circle_id from user_circles)
    order by cs.is_default desc, cs.display_name asc
  ),
  appointment_rows as (
    select
      a.id,
      a.care_subject_id,
      a.current_note_id,
      a.created_at,
      a.title,
      a.reason,
      a.starts_at,
      a.status,
      a.updated_at,
      a.provider_name,
      a.provider_organization,
      a.location_name,
      a.location_address,
      a.location_phone,
      coalesce(a.is_sample_data, false) as is_sample_data,
      cg.id as current_guidance_id,
      cg.review_status as current_guidance_review_status
    from public.appointments a
    left join lateral (
      select cg_inner.id, cg_inner.review_status
      from public.careprep_guidance cg_inner
      where cg_inner.appointment_id = a.id
        and (
          cg_inner.is_current = true
          or cg_inner.review_status = 'draft'
        )
      order by
        case when cg_inner.review_status = 'draft' then 0 else 1 end,
        cg_inner.generated_at desc nulls last
      limit 1
    ) cg on true
    where a.care_circle_id in (select care_circle_id from user_circles)
    order by a.starts_at asc nulls last, a.created_at desc
  ),
  counts as (
    select
      count(distinct a.id) as appointment_count,
      count(distinct a.id) filter (
        where a.status <> 'archived'
          and a.current_note_id is null
          and (a.starts_at is null or a.starts_at >= date_trunc('day', now()))
      ) as upcoming_appointment_count,
      count(distinct a.id) filter (
        where a.status <> 'archived'
          and a.current_note_id is not null
      ) as logged_appointment_count,
      count(distinct n.id) as note_count,
      count(distinct cg_all.id) as careprep_count,
      count(distinct st.id) as support_ticket_count
    from user_circles uc
    left join public.appointments a on a.care_circle_id = uc.care_circle_id
    left join public.appointment_notes n on n.appointment_id = a.id
    left join public.careprep_guidance cg_all on cg_all.appointment_id = a.id
    left join public.support_tickets st on st.user_id = p_target_user_id
  )
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', tp.id,
      'display_name', coalesce(
        nullif(trim(tp.display_name), ''),
        nullif(trim(concat_ws(' ', tp.given_name, tp.family_name)), ''),
        'User'
      ),
      'masked_email',
        case
          when coalesce(nullif(trim(tp.email), ''), tp.auth_email) is null then null
          else regexp_replace(
            coalesce(nullif(trim(tp.email), ''), tp.auth_email),
            '(^.).*(@.*$)',
            '\1***\2'
          )
        end,
      'account_created_at', tp.auth_created_at,
      'last_seen_at', tp.last_seen_at,
      'onboarding_completed_at', tp.onboarding_completed_at,
      'beta_terms_acknowledged_at', tp.beta_terms_acknowledged_at,
      'beta_privacy_acknowledged_at', tp.beta_privacy_acknowledged_at,
      'beta_disclaimer_acknowledged_at', tp.beta_disclaimer_acknowledged_at,
      'requires_email_update', coalesce((tp.raw_user_meta_data ->> 'requires_email_update')::boolean, false),
      'is_admin', coalesce(tp.is_admin, false),
      'is_test_user', coalesce(tp.is_test_user, false),
      'has_contact_details',
        coalesce(nullif(trim(tp.email), ''), tp.auth_email, nullif(trim(tp.phone), ''), nullif(trim(tp.address_line1), ''), nullif(trim(tp.postal_code), '')) is not null
    ),
    'counts', jsonb_build_object(
      'appointment_count', coalesce(c.appointment_count, 0),
      'upcoming_appointment_count', coalesce(c.upcoming_appointment_count, 0),
      'logged_appointment_count', coalesce(c.logged_appointment_count, 0),
      'note_count', coalesce(c.note_count, 0),
      'careprep_count', coalesce(c.careprep_count, 0),
      'support_ticket_count', coalesce(c.support_ticket_count, 0)
    ),
    'entitlements', coalesce((
      select jsonb_agg(to_jsonb(er))
      from entitlement_rows er
    ), '[]'::jsonb),
    'care_subjects', coalesce((
      select jsonb_agg(to_jsonb(sr))
      from subject_rows sr
    ), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ar.id,
          'care_subject_id', ar.care_subject_id,
          'current_note_id', ar.current_note_id,
          'current_guidance_id', ar.current_guidance_id,
          'current_guidance_review_status', ar.current_guidance_review_status,
          'created_at', ar.created_at,
          'title_preview',
            public.admin_sensitive_preview(ar.title),
          'starts_on',
            case when ar.starts_at is null then null else ar.starts_at::date end,
          'status', ar.status,
          'updated_at', ar.updated_at,
          'is_sample_data', ar.is_sample_data,
          'has_starts_at', ar.starts_at is not null,
          'has_provider_name', nullif(trim(ar.provider_name), '') is not null,
          'has_provider_organization', nullif(trim(ar.provider_organization), '') is not null,
          'has_location_name', nullif(trim(ar.location_name), '') is not null,
          'provider_name_preview', public.admin_sensitive_preview(ar.provider_name),
          'provider_organization_preview', public.admin_sensitive_preview(ar.provider_organization),
          'location_name_preview', public.admin_sensitive_preview(ar.location_name),
          'has_reason', nullif(trim(ar.reason), '') is not null,
          'has_location_address', nullif(trim(ar.location_address), '') is not null,
          'has_location_phone', nullif(trim(ar.location_phone), '') is not null,
          'has_note', ar.current_note_id is not null,
          'has_careprep', ar.current_guidance_id is not null
        )
      )
      from appointment_rows ar
    ), '[]'::jsonb)
  )
    into snapshot
  from target_profile tp
  cross join counts c;

  if snapshot is null then
    raise exception 'Profile not found for target user';
  end if;

  return snapshot;
end;
$$;

grant execute on function public.get_admin_user_readonly_snapshot(uuid, text)
  to authenticated;

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
    'admin_sensitive_data_revealed',
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
