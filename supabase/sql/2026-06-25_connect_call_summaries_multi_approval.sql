-- Allow multiple approved/refined care summaries for one Connect call.
--
-- The first call-summary schema used a unique call_id because the initial
-- approval model assumed one canonical summary. The product decision is now to
-- preserve both parties' approved/refined summaries when they differ.

alter table public.connect_call_summaries
  drop constraint if exists connect_call_summaries_call_id_key;

create index if not exists connect_call_summaries_call_created_idx
  on public.connect_call_summaries (call_id, created_at desc);

comment on table public.connect_call_summaries is
  'Brief care-record summaries from Connect calls. These summaries intentionally omit general conversation and should err toward under-documenting. A call may have more than one approved summary when both parties refine/approve different care-relevant versions. Approval should permanently delete the temporary transcript from connect_calls.';
