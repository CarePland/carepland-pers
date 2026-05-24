# CarePland SQL Archive

This folder is the project-side archive for SQL that should be kept outside the
Supabase SQL editor history.

## Current Committed SQL

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
  Admin utility: seeds editable Profile plan-tier helper text.

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
