grant insert on public.early_access_intake to anon;

drop policy if exists "Public website can create early access intake" on public.early_access_intake;
create policy "Public website can create early access intake"
  on public.early_access_intake
  for insert
  to anon
  with check (
    source = 'public_website'
    and status = 'new'
    and communication_consent = true
    and communication_preference = 'email'
    and care_role = 'unspecified'
    and coalesce(admin_notes, '') = ''
    and phone is null
    and created_by_user_id is null
    and updated_by_user_id is null
    and converted_user_id is null
  );
