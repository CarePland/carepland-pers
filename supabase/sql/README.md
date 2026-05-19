# CarePland SQL Archive

This folder is the project-side archive for SQL that should be kept outside the
Supabase SQL editor history.

## Current Committed SQL

- `2026-05-19_beta_agreement_profile_fields.sql`  
  Migration: beta acknowledgement fields on `profiles`.

- `2026-05-19_sample_data_seed.sql`  
  Migration/admin utility: sample-data flags plus seed/status functions.

- `2026-05-19_remove_sample_data_for_user.sql`  
  Admin utility: remove seeded sample rows for one user and reset sample flags.

- `2026-05-19_remove_demo_data_function.sql`
  Migration/admin utility: lets a signed-in user remove their own demo data.

- `2026-05-19_app_content_versions.sql`
  Migration/admin utility: versioned dynamic app text for beta/legal/support copy.

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
