# Dirty Worktree Summary - 2026-06-22

This file summarizes the current dirty worktree so cleanup/prioritization can
happen in a separate chat without losing the thread.

## Verified Status

- `npm run lint` passes.
- `npm run test` passes with 127 tests.
- Worktree is intentionally dirty; do not bulk-revert without reviewing each
  cluster.

## Main UI / Navigation Work

Files:
- `app/CarePlandPers.tsx`
- `app/components/connect/dashboard/ConnectDashboard.tsx`
- `app/components/personal/appointments/AppointmentViewToolbar.tsx`
- `app/components/shared/CarePlandTopNav.tsx`

Summary:
- Connect top-level nav was simplified: Connect Home removed as a visible tab,
  Settings moved to a de-emphasized text link, and Settings sections now use
  People / Guide / Receiver / Appearance.
- Connect Settings gained an Exit text action.
- Connect Ask panel was restyled to match the Appointments Ask panel and now
  uses Connect-specific guidance copy while keeping the same Ask flow.
- Connect local people pills were compacted, pets are filtered out, and the
  pill list hides when only one eligible non-pet Connect user exists.
- Appointments toolbar was reshaped: Upcoming is the unlabeled default, Older
  reveals Logged / Archived plus Exit, and person filters use compact pills.
- Top nav removed Profile/Admin as standard page pills. Profile remains
  accessible through the user/focus pill, and Admin is represented by the
  compact admin metric pill for admins.

## Session Page View State

Files:
- `app/lib/navigation/pageViewState.ts`
- `docs/SESSION_PAGE_VIEW_STATE.md`
- `app/CarePlandPers.tsx`
- `app/components/connect/dashboard/ConnectDashboard.tsx`
- `app/components/family/errands/ErrandsWorkspace.tsx`

Summary:
- Added a session-only helper for saving/restoring page view state.
- Appointments restores meaningful state such as Older expansion, selected
  Logged/Archived view, expanded notes, active appointment panel, and scroll.
- Connect restores current page, Settings subsection, and scroll.
- Family Errands has initial session restore behavior.
- Temporary Connect-local person selection is intentionally not persisted.
- Page view state is cleared on sign-out paths wired through the app.

## Appointments Mid-Session Performance

File:
- `app/CarePlandPers.tsx`

Summary:
- Added mid-session appointment state restoration/snapshot behavior so returning
  to Appointments during the same session can render useful context faster.
- Earlier runtime ordering issues around `appointmentView` and
  `saveAppointmentsViewState` were fixed by moving callbacks/effects after
  their dependent state declarations.

## Profile / Pet Type Detour

Files:
- `app/api/personal/pet-type/route.ts`
- `app/components/personal/profile/ProfileContactDetailsForm.tsx`
- `supabase/sql/2026-06-22_care_subject_pet_types_text.sql`
- `supabase/sql/README.md`

Summary:
- Profile pet type UI no longer shows a temporary Cat/Dog/Pet icon before the
  save succeeds.
- API maps the old enum failure to a user-readable message.
- Added a SQL patch converting `care_subjects.subject_type` from the older enum
  to constrained text so `cat`, `dog`, `pet`, and `pet:<label>` can save.
- The SQL patch must be applied in Supabase for pet types to work at runtime.

## Import Anything Cluster

Files:
- `app/api/import-anything/route.ts`
- `app/lib/personal/importAnything/`
- `docs/PERSONAL_IMPORT_ANYTHING_WORKFLOW.md`
- `package.json`

Summary:
- This appears to be a separate work cluster from the navigation/UI changes.
- Adds request and draft normalization helpers with tests.
- Adds review mapping that can group approved matched questions, medication
  changes, tasks, and CarePrep details into draft `careprep_guidance` rows.
- Updates the test script to include Import Anything tests.
- Review separately before bundling with the Connect/Appointments UI changes.

## Generated / Environment-Sensitive File

File:
- `app/build-info.ts`

Summary:
- Dirty because build metadata changed. Treat as generated/churn unless a
  release build intentionally needs it.

## Suggested Prioritization

1. Commit or stage the main Connect/Appointments UI and session-state changes
   together if the current visual behavior is approved.
2. Review and commit the pet-type SQL/API/UI guardrail separately.
3. Review Import Anything normalization/review mapping as a separate feature
   cluster.
4. Decide whether `app/build-info.ts` should be kept or reset before commit.
