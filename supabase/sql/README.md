# CarePland SQL Archive

This folder is the project-side archive for SQL that should be kept outside the
Supabase SQL editor history.

## Current Committed SQL

- `2026-07-01_care_recommendations_foundation.sql`
  Migration: adds reviewable CarePland Recommendation candidates and supporting evidence rows. Recommendations bridge existing CarePland knowledge to possible Focus Items, but are not automatically shown or converted; initial generation is deterministic and evidence-based, with no AI prompt seeded. The v1 backend uses `dedupe_key` and `evidence_hash` so repeated scans can update open candidates without duplicating evidence.

- `2026-07-01_track_today_focus_foundation.sql`
  Migration: adds the first Track / Today's Focus foundation with person-scoped `focus_items` for intentions/prompts and `track_events` for recorded reality. Focus Items include an `importance_score` ranking hint for the first Receiver proof of concept. The model is source-traceable, non-destructive, compatible with future Talk/Receiver/reminder/CarePrep ingestion, and intentionally avoids diagnosis or clinical decision support logic.

- `2026-06-19_connect_main_user_context.sql`
  Migration: adds Connect-local settings in `connect_settings`, Pers-backed Connect participant enablement in `connect_participants`, and RLS policies for the Main Connect User model. This migration intentionally does not backfill every active `care_subjects` row into Connect.

- `2026-06-20_care_subject_avatars.sql`
  Migration: adds lightweight avatar metadata to `care_subjects` and creates the private `carepland-avatars` Supabase Storage bucket for uploaded person/Care VIP avatars.

- `2026-06-22_verify_connect_participants.sql`
  Read-only verification utility: reviews Connect participant counts/details, flags participant/person care-circle mismatches, flags Main Connect User settings that do not point to an accessible active Connect participant, reports active pet Care VIPs enabled as Connect participants, and highlights care circles where every active Care VIP is enabled for Connect.

- `2026-06-22_connect_settings_participant_policy.sql`
  Migration patch: tightens `connect_settings` writes so the durable Main Connect User can only be set to an active non-pet Connect participant in one of the signed-in user's care circles.

- `2026-06-25_connect_call_records.sql`
  Migration: adds durable Connect call records, short-lived WebRTC signaling rows, operational call events, and brief care-only call summaries. Call transcripts are temporary on the call record until summary approval; approval should delete the transcript while retaining approved care summaries. Multiple approved summaries can be preserved for one call if both parties approve different/refined versions.

- `2026-06-25_connect_call_summaries_multi_approval.sql`
  Migration patch: removes the initial one-summary-per-call uniqueness constraint so both parties can preserve different approved/refined care summaries for the same call.

- `2026-06-25_connect_call_transcript_segments.sql`
  Migration: adds temporary call transcript segments for the 35-second window / 30-second step / 5-second overlap transcription model. Segment transcript text is deleted after summary approval and should not be treated as a permanent record.

- `2026-06-25_connect_call_summary_prompt.sql`
  Migration/admin prompt seed: adds an Admin-managed `connect_call_care_summary` prompt path for brief care-only call summaries. The prompt explicitly omits general conversation and tells the model to omit when uncertain.

- `2026-06-22_care_subject_pet_types_text.sql`
  Migration patch: converts `care_subjects.subject_type` from the older enum to constrained text so Profile can save cat, dog, generic pet, and `pet:<label>` values.

- `2026-06-22_care_providers.sql`
  Migration: adds per-Care-VIP durable provider records for Personal, scoped by `care_subject_id` so provider nicknames and edits do not merge across patients.

- `2026-05-19_beta_agreement_profile_fields.sql`  
  Migration: Early Access acknowledgement fields on `profiles` (legacy column names retain `beta_*`).

- `2026-05-19_sample_data_seed.sql`  
  Migration/admin utility: sample-data flags plus seed/status functions.

- `2026-05-19_remove_sample_data_for_user.sql`  
  Admin utility: remove seeded sample rows for one user and reset sample flags.

- `2026-05-19_remove_demo_data_function.sql`
  Migration/admin utility: lets a signed-in user remove their own demo data.

- `2026-05-19_app_content_versions.sql`
  Migration/admin utility: versioned dynamic app text for Early Access/legal/support copy.

- `2026-05-20_product_management.sql`
  Migration/admin utility: versioned product-management lanes, bugs, wishlist, and release notes.

- `2026-05-20_seed_product_management_backlog.sql`
  Admin utility: seeds the initial product-management backlog from running notes.

- `2026-05-20_support_questions.sql`
  Migration/admin utility: in-app support questions, admin ticket workflow, message history, and audit events.

- `2026-05-20_seed_demo_support_tickets.sql`
  Admin utility: seeds varied demo support tickets for one user so Admin > Tix can be reviewed.

- `2026-05-20_remove_demo_support_tickets.sql`
  Admin utility: removes only the demo support tickets created by the seed script.

- `2026-05-20_support_assistant_interactions.sql`
  Migration/admin utility: stores auditable support assistant answers, outcomes, escalation links, and user feedback.

- `2026-05-20_seed_support_assistant_content.sql`
  Admin utility: seeds editable support assistant UI copy into dynamic app content.

- `2026-05-20_seed_support_assistant_instruction.sql`
  Admin utility: seeds the editable Support Assistant AI prompt/instruction set for existing care circles.

- `2026-05-22_agent_knowledge_proposals.sql`
  Migration/admin utility: stores reviewable Agent Knowledge update proposals, per-block review decisions, Admin-edited final text, evidence, and feedback links before publication.

- `2026-05-22_agent_knowledge_automation_settings.sql`
  Migration/admin utility: stores Agent Knowledge proposal-generation settings and queued check runs for manual, software-update, scheduled, and feedback-cluster cycles.

- `2026-05-22_pricing_tiers.sql`
  Admin utility: aligns internal beta plan ids and public names for Free, Active Use, Premium Individual, Group, and Early Access.

- `2026-05-22_plan_feature_metering.sql`
  Migration/admin utility: adds plan feature definitions, Care Circle usage counters, and feature usage check/consume/refund functions.

- `2026-05-22_admin_view_states.sql`
  Migration/admin utility: stores per-admin Admin view timestamps and summarizes red/yellow Admin attention breadcrumbs for operational response queues, excluding admin-authored backlog/content surfaces such as Product Mgmt.

- `2026-05-22_profile_plan_tier_help_content.sql`
  Historical admin utility: seeds the former editable Profile plan-tier helper text. The current Profile plan helper uses structured plan metadata instead.

- `2026-05-22_careprep_limit_message_content.sql`
  Admin utility: seeds the editable manual CarePrep plan-limit message for Admin > Dynamic Text.

- `2026-05-23_careprep_refresh_not_ready_content.sql`
  Admin utility: seeds the editable message shown when CarePrep refresh has no additional appointment history to consider.

- `2026-05-23_careprep_auto_success_message_content.sql`
  Admin utility: seeds the editable expiring success status shown after automatic CarePrep prepares an appointment.

- `2026-05-23_careprep_generation_outlier_tracking.sql`
  Admin utility: adds an admin RPC for finding short-window CarePrep generation and refresh-like outliers by Care Circle/user.

- `2026-05-23_early_access_language_content.sql`
  Admin utility: shifts user-facing Dynamic Text and metered CarePrep limit copy from beta/testing language to Early Access language.

- `2026-05-23_early_access_intake.sql`
  Migration/admin utility: stores Early Access prospect/intake records, follow-up preferences, statuses, and admin notes separately from auth users.

- `2026-05-24_public_early_access_intake.sql`
  Migration: lets the public website create consented Early Access intake records as anonymous visitors while preserving Admin-only read/update access.

- `2026-05-24_assign_early_access_onboarding.sql`
  Migration/admin utility: adds a signed-in helper for assigning the current user's primary Care Circle entitlement to Early Access after account setup.

- `2026-05-24_assign_early_access_by_email.sql`
  Admin utility: assigns a user's primary active Care Circle entitlement to Early Access by email.

- `2026-05-24_list_non_early_access_users.sql`
  Admin utility: lists users whose primary active Care Circle entitlement is not Early Access or is missing.

- `2026-05-24_sql_editor_assign_early_access_by_email.sql`
  SQL Editor utility: directly assigns Early Access by email when running from Supabase SQL Editor without an app auth session.

- `2026-05-24_sql_editor_list_non_early_access_users.sql`
  SQL Editor utility: directly lists users not on Early Access when running from Supabase SQL Editor without an app auth session.

- `2026-05-24_plan_feature_dynamic_text.sql`
  Admin utility: seeds editable plan feature wording for the Profile current-plan helper under Admin > Dynamic Text > Plans.

- `2026-05-24_plan_profile_panel_dynamic_text.sql`
  Admin utility: seeds one whole editable Dynamic Text block per plan for the Profile current-plan helper.

- `2026-05-24_admin_contact_details_audit.sql`
  Migration/admin utility: adds contact-update permission scope and requires a reason before Admin contact-detail reveals.

- `2026-05-24_admin_access_events_insert_grant.sql`
  Migration/admin utility: grants the protected server role permission to insert required Admin access audit events.

- `2026-05-24_admin_user_activity_vips_sorting.sql`
  Migration/admin utility: extends the Admin Users / Activity summary with Care Circle/account-owner group labels and Care VIP name pills for row expansion.

- `2026-05-24_reset_welcome_screen_for_all_users.sql`
  One-off utility: clears welcome-guide dismissal fields so every user sees the Welcome screen again.

- `2026-05-25_ask_foundation.sql`
  Migration/admin utility: adds the Ask thread/message/submission/link foundation, routing settings, Product Mgmt/support cross-reference fields, and initial modular Ask AI instruction seeds.

- `2026-05-25_ai_operation_cost_logs.sql`
  Migration/admin utility: adds reusable AI operation usage/cost logs and an Admin summary RPC for future operational-cost dashboard tiles.

- `2026-05-25_ask_recommendation_decisions.sql`
  Migration/admin utility: tracks Admin accept/reject/override decisions for Ask AI recommendations, creates linked Product Mgmt items from Ask submissions, and summarizes agreement data for model-quality review.

- `2026-05-25_ask_support_resolution.sql`
  Migration/admin utility: lets Admin accept answered Ask support questions as closed or create linked support tickets from Ask review while recording the recommendation decision trail.

- `2026-05-25_ask_interpreter_schemas.sql`
  Migration/admin utility: adds current structured output schemas/prompts for the Ask feature/workflow and bug/friction interpreter modules.

- `2026-05-25_ask_clarifier_schema.sql`
  Migration/admin utility: adds the current structured output schema/prompt for The Clarifier Ask module.

- `2026-05-25_ask_off_topic_handler_schema.sql`
  Migration/admin utility: adds the current structured output schema/prompt for the bounded Ask off-topic handler.

- `2026-05-25_ask_routing_settings_admin.sql`
  Migration/admin utility: adds a protected Admin RPC for updating Ask routing thresholds and clarification limits.

- `2026-05-25_ask_user_response_rubric_instruction.sql`
  Migration/admin utility: adds an Admin-visible global Ask user-facing response rubric in AI Prompts and appends it to current Ask module prompts.

- `2026-05-26_onboarding_assistant_knowledge.sql`
  Migration/admin utility: adds the dedicated Ask onboarding helper module/prompt and light supporting Dynamic Text / Agent Knowledge copy.

- `2026-06-07_health_focus_reports_foundation.sql`
  Migration: adds the Health Focus topic catalog, topic mentions, saved topic summaries, saved reports, and row-stored relevance policy factors for future person-level context retrieval.

- `2026-06-07_add_dental_oral_health_topic.sql`
  Migration patch: adds the Dental / Oral Health topic to the Health Focus catalog for already-applied foundation databases.

- `2026-06-07_expand_health_focus_story_topics.sql`
  Migration patch: expands the Health Focus catalog with narrative-friendly condition, procedure, therapy, mobility, mental health, preventive care, nutrition, specialist, and home-monitoring topics.

- `2026-06-08_health_focus_feedback_prompts.sql`
  Migration/admin utility: adds first-class Health Focus / Health Story feedback and user-context correction tables, then seeds Health Focus prompt paths into the existing Admin AI Prompts system.

- `2026-06-08_health_focus_context_label_content.sql`
  Admin utility: seeds editable Health Focus context pill labels into Admin > Dynamic Text.

- `2026-06-09_health_focus_sample_data_seed.sql`
  Migration/admin utility: replaces the demo-data seed RPC with a broader Health Focus care-history seed, including a continuity-of-care hero story, caregiver Care VIP scenario, recurring topics, direct topic mentions, related-topic ambiguity, accepted/separate relationship feedback, future CarePrep payoff appointments, timelines, and richer removal cleanup.

- `2026-06-09_home_context_answer_prompt.sql`
  Admin utility: seeds the Home `Get more context` intent classifier and answer prompts into the existing Admin AI Prompts system. These prompts are independent from the existing Ask assistant.
- `2026-06-09_home_context_hierarchical_context_prompt.sql`
  Admin utility: creates a new current version of the Home context prompts so `Get more context` can use the active context level, such as global Home or a selected Health Focus topic.
- `2026-06-09_home_context_visible_context_prompt.sql`
  Admin utility: creates a new current version of the Home context prompts so visible page items are considered first, appointment-shaped non-health questions are routed to appointments/providers, and unsupported responses are more specific.
- `2026-06-09_home_context_short_query_prompt.sql`
  Admin utility: creates a new current version of the Home context prompts so shorthand, fragments, entity-only queries, relationship queries, preparation queries, and recent-change queries are interpreted before unsupported fallback.
- `2026-06-09_home_context_conversation_prompt.sql`
  Admin utility: creates a new current version of the Home context prompts so lightweight session conversation turns and directional corrections can guide follow-up questions without creating a general chatbot.

- `2026-05-23_early_access_plan_tier.sql`
  Admin utility: adds the Early Access plan tier with current Group-level/full-access feature settings and updates editable plan/agent text.

- `2026-05-23_reset_andrew_dental_cleaning_notes_careprep.sql`
  One-off test utility: clears Visit Notes and CarePrep from Andrew's Dental Cleaning appointments while preserving the appointments.

- `2026-05-23_reset_andrew_sample_data.sql`
  One-off test utility: removes Andrew's sample/demo appointments and clears sample-data prompt flags.

- `2026-05-23_debug_andrew_dental_cleaning_auto_careprep.sql`
  One-off read-only debug utility: shows Andrew's Dental Cleaning note/CarePrep state and auto-target eligibility.

- `2026-05-22_seed_plan_metering_agent_knowledge.sql`
  Admin utility: seeds Agent Knowledge updates for pricing tiers, metering, and Early Access plan-change limitations.

- `2026-05-23_welcome_guide_dismissal.sql`
  Migration/reset utility: stores welcome-guide dismissal state on `profiles` and resets the current rollout for all users.

- `2026-05-23_seed_admin_attention_demo.sql`
  Admin utility: seeds clearly labeled demo records across Admin tabs so red/yellow attention breadcrumbs can be reviewed, including nested Product Mgmt lanes.

- `2026-05-23_remove_admin_attention_demo.sql`
  Admin utility: removes the Admin attention demo records and refreshes the demo-related Admin view states so test breadcrumb lights turn off.

- `2026-05-23_seed_admin_hq_prioritization_instruction.sql`
  Admin utility: seeds the editable Admin HQ prioritization prompt/instruction set for existing care circles.

## Supabase SQL History Triage

Recommended categories for the visible Supabase SQL editor history.

### Keep or Recreate as Migrations

These changed durable schema, RLS, permissions, functions, or production logic.
If the original SQL is not already in this folder, recreate/export it before
clearing it from Supabase history.

- Care Circle Schema with RLS and Appointment AI Workflows
- Create Personal Care Circle
- Create Care Circle for User
- Create Personal Care Circle Setup
- Ensure Personal Care Circle Setup
- Grant Public Schema Permissions to Authenticated
- Grant Access to Public Tables
- Grant Permissions on Intake Items
- Intake Items Storage Table
- Add Match Tracking Fields to Intake Items
- Enhance Intake Items for Matching Workflow
- Add Appointment Provider and Location Fields
- Add versioning and supersession fields to appointment notes
- Appointments Current Note Link
- Add Versioning to Careprep Guidance Records
- Add review and acceptance metadata to careprep guidance
- AI Instruction Sets and Versioning
- Add Instruction References and Input Snapshot
- Add Instruction Content Hash Columns and Indexes
- Add Instruction Metadata Columns
- Enable RLS and Restrict Instruction Access
- Add Profile Phone Number Field
- Add Profile Contact and Address Fields
- Add Name Fields to Profiles
- Add Profile Name Fields
- Add Admin Flag to Profiles
- Add Beta Acknowledgement Columns
- Seedable Sample Data Workflow for User Profiles

### Keep as Admin Utilities

These are useful operational scripts, but not necessarily migrations. Keep them
as named utility scripts if they are still useful.

- Reset Beta Acknowledgements for Profile
- Assign personal_plus entitlement plan
- Align beta pricing tiers
- Add Early Access plan tier
- Add plan feature metering
- Seed Profile plan tier help content
- Seed CarePrep limit message content
- Seed CarePrep refresh not-ready message
- Seed automatic CarePrep success message
- Add CarePrep generation outlier tracking
- Reset Andrew Dental Cleaning notes/CarePrep
- Debug Andrew Dental Cleaning auto-CarePrep
- Seed plan metering Agent Knowledge
- Activate Care Circle Entitlement
- Add Member and Upgrade Care Circle Plan
- Seed manual appointments for a user
- Seed Follow-Up Appointments for a User's Care Circle
- Create Past Reminder Test Appointment
- Fetch User Confirmation Status by Email
- Fetch Active Past Appointments Without Notes
- Appointment and Note Search by Keywords

### One-Off Lookup / Scratch

These are likely safe to let live only in Supabase history or archive as notes,
because they read state rather than changing durable structure.

- Fetch Latest Guidance Records
- Fetch Latest Guidance for Appointment
- Fetch Personal Plus Plan
- Fetch Personal Plus Plan Details
- Fetch User Care Circle Entitlements
- User Email to Care Circle Membership and Plan Details
- User Membership and Subject Circle Check
- User Membership and Entitlements Lookup
- User Care Circle Membership Lookup
- Care Subjects List
- Fetch Membership Records for Users
- Email-Based Membership and Entitlement Lookup

## Rule of Thumb

Before clearing anything from Supabase history:

1. Keep any `alter table`, `create table`, `create function`, `create policy`,
   `grant`, or `create index` SQL as a migration.
2. Keep any reusable user/admin action as an admin utility.
3. Archive one-off `select` queries only when they answer a recurring support
   question.
