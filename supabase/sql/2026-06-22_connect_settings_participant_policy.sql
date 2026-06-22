-- Tighten Connect settings writes so the durable Main Connect User cannot be
-- set directly through Supabase to an inaccessible or non-participating person.
--
-- App routes already verify this before writing. This policy keeps the same
-- boundary at the database layer for direct authenticated client writes.

drop policy if exists connect_settings_owner_write on public.connect_settings;

create policy connect_settings_owner_write
on public.connect_settings
for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    main_connect_user_person_id is null
    or exists (
      select 1
      from public.care_subjects cs
      join public.connect_participants cp
        on cp.person_id = cs.id
        and cp.care_circle_id = cs.care_circle_id
        and cp.status = 'active'
      join public.care_circle_memberships ccm
        on ccm.care_circle_id = cs.care_circle_id
        and ccm.user_id = auth.uid()
      where cs.id = connect_settings.main_connect_user_person_id
        and cs.is_active is true
        and not (
          lower(trim(coalesce(cs.subject_type, ''))) in ('cat', 'dog', 'pet')
          or lower(trim(coalesce(cs.subject_type, ''))) like 'pet:%'
        )
    )
  )
);
