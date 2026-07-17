-- Clear legacy CarePrep output artifacts before regenerating under the
-- minimal intro / Before the Visit / During the Visit contract.
--
-- This intentionally touches only CarePrep-specific generated artifacts.
-- Appointment notes, imports, messages, appointment communication summaries,
-- and other source evidence remain authoritative and are not removed here.

delete from public.checkpoint_runs
where checkpoint_use_key = 'careprep';

delete from public.careprep_guidance;
