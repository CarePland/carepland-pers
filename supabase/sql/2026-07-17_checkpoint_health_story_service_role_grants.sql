-- Checkpoint Health Story review reads existing Health Focus/Story source data
-- through the Admin service-role API path after the caller has passed
-- profiles.is_admin. This is read-only review access; generation and
-- persistence remain unchanged.

grant usage on schema public to service_role;

grant select on public.health_topics to service_role;
grant select on public.topic_mentions to service_role;
grant select on public.appointments to service_role;
grant select on public.care_subjects to service_role;
grant select on public.care_circle_memberships to service_role;
