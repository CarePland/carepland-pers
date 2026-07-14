-- Calm the user-facing CarePrep refresh gate copy.
--
-- The refresh gate remains diagnostic internally, but the ordinary UI should
-- not expose target appointment names, prior-appointment counts, or snapshot
-- timestamps as part of a failed refresh message.

update public.app_content_versions
set
  body = 'CarePrep is already up to date for this appointment. Add or save new Visit Notes, then try again.',
  updated_at = now()
where content_key = 'careprep_refresh_not_ready_message'
  and is_current = true
  and body = 'CarePrep can''t be run yet because you have no additional appointments to consider.';
