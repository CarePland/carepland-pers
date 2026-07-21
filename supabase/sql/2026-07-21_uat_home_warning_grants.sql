-- UAT follow-up: make optional Home loaders succeed quietly.
--
-- appointment_communication_summaries already had member RLS policies, but
-- the browser role also needs table SELECT privilege before those policies can
-- apply.
grant select on public.appointment_communication_summaries to authenticated;

-- Home's Health Focus backfill route writes deterministic retrofit mentions
-- with the service role after the signed-in user is authorized. Earlier grants
-- covered read-only admin review but not the write path used by backfill.
grant select on public.health_topics to service_role;
grant select, insert, update on public.topic_mentions to service_role;
