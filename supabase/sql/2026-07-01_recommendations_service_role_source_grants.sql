-- CarePland Recommendations scanner service-role grants.
--
-- The Admin Today's Focus Review scanner verifies profiles.is_admin and then
-- uses the server service-role client to scan across Care VIPs. Some existing
-- source tables were granted to authenticated users but not explicitly to
-- service_role in this project, which can produce per-Care-VIP scan failures
-- such as "permission denied for table topic_mentions".

grant usage on schema public to service_role;

-- Source tables read by app/api/personal/recommendations/route.ts.
grant select on public.appointments to service_role;
grant select on public.appointment_notes to service_role;
grant select on public.careprep_guidance to service_role;
grant select on public.topic_mentions to service_role;
grant select on public.track_events to service_role;

-- Recommendation review/write tables touched by Admin Today's Focus Review.
grant select, insert, update on public.care_recommendations to service_role;
grant select, insert, update on public.care_recommendation_evidence to service_role;
grant select, insert, update on public.care_recommendation_review_events to service_role;
grant select, insert, update on public.focus_items to service_role;
