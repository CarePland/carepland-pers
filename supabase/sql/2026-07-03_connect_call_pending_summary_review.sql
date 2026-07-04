-- Pending review lifecycle for Connect call summaries.
--
-- Transcripts are temporary. Generated summaries may be retained for review,
-- but only explicitly approved summaries should be treated as approved.

alter table public.connect_calls
  add column if not exists generated_summary_text text not null default '',
  add column if not exists approved_summary_text text not null default '',
  add column if not exists summary_approved_at timestamptz,
  add column if not exists summary_approved_by text not null default '',
  add column if not exists summary_review_note text not null default '',
  add column if not exists summary_review_status text not null default '',
  add column if not exists transcript_cleanup_status text not null default '',
  add column if not exists transcript_expires_at timestamptz,
  add column if not exists summary_approval_draft_text text not null default '',
  add column if not exists summary_approval_draft_updated_at timestamptz,
  add column if not exists summary_approval_draft_updated_by text not null default '';

alter table public.connect_calls
  drop constraint if exists connect_calls_summary_status_check;

alter table public.connect_calls
  add constraint connect_calls_summary_status_check
  check (
    summary_status in (
      'not_requested',
      'pending_review',
      'approved',
      'expired_unreviewed',
      'cleanup_pending',
      'summary_failed',
      'failed',
      'not_needed',
      'pending',
      'completed'
    )
  );

alter table public.connect_calls
  drop constraint if exists connect_calls_transcript_cleanup_status_check;

alter table public.connect_calls
  add constraint connect_calls_transcript_cleanup_status_check
  check (transcript_cleanup_status in ('', 'completed', 'pending'));

alter table public.connect_call_summaries
  drop constraint if exists connect_call_summaries_summary_status_check;

alter table public.connect_call_summaries
  add constraint connect_call_summaries_summary_status_check
  check (
    summary_status in (
      'pending_review',
      'approved',
      'expired_unreviewed',
      'cleanup_pending',
      'summary_failed',
      'failed',
      'not_needed',
      'pending',
      'completed'
    )
  );

update public.connect_calls cc
set
  generated_summary_text = coalesce(latest.summary_text, cc.generated_summary_text, ''),
  summary_approval_draft_text = coalesce(nullif(cc.summary_approval_draft_text, ''), latest.summary_text, ''),
  transcript_expires_at = coalesce(cc.transcript_expires_at, cc.created_at + interval '7 days'),
  summary_review_status = case
    when cc.summary_status = 'approved' then 'approved'
    when cc.summary_status in ('completed', 'pending') then 'pending_review'
    else cc.summary_review_status
  end,
  summary_status = case
    when cc.summary_status in ('completed', 'pending') then 'pending_review'
    else cc.summary_status
  end
from (
  select distinct on (call_id)
    call_id,
    summary_text
  from public.connect_call_summaries
  where summary_status in ('completed', 'pending_review', 'pending')
  order by call_id, created_at desc
) latest
where latest.call_id = cc.id
  and coalesce(cc.generated_summary_text, '') = '';

update public.connect_calls cc
set
  approved_summary_text = coalesce(nullif(cc.approved_summary_text, ''), latest.summary_text, ''),
  summary_approved_at = coalesce(cc.summary_approved_at, latest.approved_at),
  summary_approved_by = coalesce(nullif(cc.summary_approved_by, ''), latest.approved_by_role, ''),
  summary_review_status = 'approved'
from (
  select distinct on (call_id)
    call_id,
    summary_text,
    approved_at,
    approved_by_role
  from public.connect_call_summaries
  where summary_status = 'approved'
  order by call_id, approved_at desc nulls last, created_at desc
) latest
where latest.call_id = cc.id
  and cc.summary_status = 'approved';

comment on column public.connect_calls.generated_summary_text is
  'AI-generated care-only call summary retained for review/audit. This is not an approved summary.';

comment on column public.connect_calls.approved_summary_text is
  'Reviewer-approved durable care summary. Only this field should be treated as approved long-term summary text.';

comment on column public.connect_calls.summary_status is
  'Honest call-summary lifecycle: pending_review, approved, expired_unreviewed, cleanup_pending, summary_failed, not_needed, or legacy transitional values.';

comment on column public.connect_calls.summary_approval_draft_text is
  'Reviewer draft persisted while a pending summary is being edited before approval.';

comment on column public.connect_calls.transcript_expires_at is
  'Time after which temporary transcript text must be deleted if the summary was not formally approved.';

comment on column public.connect_calls.summary_review_note is
  'Human-readable review/cleanup note, including expired-unreviewed explanations.';

create index if not exists connect_calls_pending_summary_review_idx
  on public.connect_calls (main_connect_user_person_id, transcript_expires_at, updated_at desc)
  where summary_status in ('pending_review', 'pending', 'completed');

create index if not exists connect_calls_transcript_expiration_idx
  on public.connect_calls (transcript_expires_at)
  where transcript_status <> 'deleted';
