-- Lightweight avatar support for CarePland Pers people / Care VIPs.
-- Connect currently treats Main Connect User as an existing care_subjects row,
-- so avatar metadata belongs on the canonical person model.

alter table public.care_subjects
  add column if not exists avatar_url text,
  add column if not exists avatar_type text not null default 'initials'
    check (avatar_type in ('initials', 'uploaded', 'generated')),
  add column if not exists avatar_alt_text text;

comment on column public.care_subjects.avatar_url is
  'Supabase Storage object path or externally resolvable URL for this CarePland Pers person avatar.';

comment on column public.care_subjects.avatar_type is
  'Avatar source type: initials fallback, user-uploaded image, or future generated illustrated avatar.';

comment on column public.care_subjects.avatar_alt_text is
  'Short accessible description for the avatar image; display name remains the fallback.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'carepland-avatars',
  'carepland-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Runtime avatar upload/remove goes through authenticated CarePland API routes.
-- The bucket stays private so browser clients never need broad Storage write access.
