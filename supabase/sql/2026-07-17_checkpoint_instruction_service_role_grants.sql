-- Checkpoint generation reads current CarePrep prompt definitions through the
-- service-role Admin API path after the caller has passed profiles.is_admin.

grant usage on schema public to service_role;
grant select on public.ai_instruction_sets to service_role;
grant select on public.ai_instruction_versions to service_role;
