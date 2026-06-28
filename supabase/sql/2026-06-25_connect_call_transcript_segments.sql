-- Temporary chunk transcript storage for Connect calls.
--
-- Call transcription uses a 35-second window every 30 seconds, creating a
-- 5-second overlap so chunk boundaries do not lose mid-phrase speech. Segment
-- transcript text is temporary and exists only to build a care-only summary
-- for human approval. Approved summary cleanup must delete these segment rows
-- along with the assembled transcript on connect_calls.

create table if not exists public.connect_call_transcript_segments (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.connect_calls(id) on delete cascade,
  care_circle_id uuid not null,
  main_connect_user_person_id uuid not null references public.care_subjects(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  chunk_started_ms integer not null check (chunk_started_ms >= 0),
  chunk_ended_ms integer not null check (chunk_ended_ms >= chunk_started_ms),
  overlap_started_ms integer not null check (
    overlap_started_ms >= chunk_started_ms
    and overlap_started_ms <= chunk_ended_ms
  ),
  transcript_text text not null default '',
  transcript_status text not null default 'pending' check (
    transcript_status in ('pending', 'completed', 'failed', 'not_configured')
  ),
  error_message text not null default '',
  audio_mime_type text not null default '',
  audio_duration_ms integer check (audio_duration_ms is null or audio_duration_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_id, chunk_index)
);

comment on table public.connect_call_transcript_segments is
  'Temporary chunk transcripts for Connect calls. Delete after summary approval; do not treat segment transcripts as permanent records.';

comment on column public.connect_call_transcript_segments.transcript_text is
  'Temporary transcript text from a call audio chunk. It exists only for care-summary generation and approval.';

create index if not exists connect_call_transcript_segments_call_idx
  on public.connect_call_transcript_segments (call_id, chunk_index);

alter table public.connect_call_transcript_segments enable row level security;

drop policy if exists connect_call_transcript_segments_member_select on public.connect_call_transcript_segments;
create policy connect_call_transcript_segments_member_select
on public.connect_call_transcript_segments
for select
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_call_transcript_segments.care_circle_id
      and ccm.user_id = auth.uid()
  )
);

drop policy if exists connect_call_transcript_segments_member_write on public.connect_call_transcript_segments;
create policy connect_call_transcript_segments_member_write
on public.connect_call_transcript_segments
for all
using (
  exists (
    select 1
    from public.care_circle_memberships ccm
    where ccm.care_circle_id = connect_call_transcript_segments.care_circle_id
      and ccm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.connect_calls cc
    join public.care_circle_memberships ccm
      on ccm.care_circle_id = cc.care_circle_id
      and ccm.user_id = auth.uid()
    where cc.id = connect_call_transcript_segments.call_id
      and cc.care_circle_id = connect_call_transcript_segments.care_circle_id
      and cc.main_connect_user_person_id = connect_call_transcript_segments.main_connect_user_person_id
  )
);
