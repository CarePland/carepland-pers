-- CarePland Recommendations priority language patch.
--
-- Avoid emergency-sounding recommendation priority labels in medical-adjacent
-- contexts. The top recommendation priority is now "strong" instead of
-- "critical"; old rows are migrated for display and future review.

update public.care_recommendations
set priority = 'strong'
where priority = 'critical';

alter table public.care_recommendations
  drop constraint if exists care_recommendations_priority_check;

alter table public.care_recommendations
  add constraint care_recommendations_priority_check
  check (priority in ('strong', 'high', 'normal', 'low'));

comment on column public.care_recommendations.priority is
  'Simple priority based on evidence strength/source, not autonomous AI opinion. Use strong, high, normal, or low; avoid emergency-sounding priority labels.';
