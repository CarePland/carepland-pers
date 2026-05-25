-- Migration/admin utility: allow protected server-side admin routes to insert
-- required audit rows for sensitive admin user-view actions.
--
-- The app uses SUPABASE_SERVICE_ROLE_KEY in protected server routes for contact
-- reveal/update operations. Those operations must write admin_access_events
-- before exposing or changing contact details.

grant insert on public.admin_access_events to service_role;

