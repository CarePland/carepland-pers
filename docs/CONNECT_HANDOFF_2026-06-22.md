# CarePland Connect Handoff - 2026-06-22

Use this as the first recontext document for Connect work. The deeper living
spec remains `docs/CONNECT_STABILIZATION_HANDOFF.md`.

## Executive Summary

Connect now treats CarePland Pers as the source of identity.

- Canonical person records live in `care_subjects`.
- Connect participants live in `connect_participants.person_id`, which must
  reference `care_subjects.id`.
- The active Receiver-world person is called the `Main Connect User`.
- Connect must always be able to answer: whose Connect world am I viewing?
- Connect should not create Connect-only people, guest users, or external
  invitees in the current pass.

The important correction from the latest work:

Connect focus and Connect enablement are separate.

- Focus says which Pers person is visible/active in Connect.
- Enablement says whether that person has a `connect_participants` row and can
  use Receiver actions, messages, calls, audio, and other person-scoped Connect
  behavior.
- A signed-in user with an available Pers person should not see a personless
  Connect UI merely because no participant row exists.

## Current Focus Resolution Rule

When Connect needs the active person, resolve in this order:

1. Specific global CarePland focus, if the global focus is not `Everyone`.
2. Temporary Connect-local target selected inside Connect while global focus is
   `Everyone`.
3. Durable `connect_settings.main_connect_user_person_id`.
4. Default/logged-in active Pers person as last-resort display focus.

If the resolved person is not Connect-enabled, user-facing actions stay disabled
and the UI should explain that the person must be enabled for Connect first.

Do not let a Connect-local selection under `Everyone` update global focus.

## Current Work Completed

The latest stabilization pass fixed the "no users available / none selected"
problem caused by using Connect participants as the only person list.

Added or updated:

- `app/api/connect/focus-people/route.ts`
  - New endpoint for active Pers people visible to the signed-in user.
  - This endpoint is intentionally broader than `connect_participants`.
- `app/lib/connect/context/server/mainConnectUserContext.ts`
  - Added `listPersFocusPeopleForConnect`.
  - Keeps participant listing separate from focus-person listing.
- `app/lib/connect/context/client.ts`
  - Added `fetchConnectFocusPeople`.
- `app/lib/connect/context/focus.ts`
  - Added fallback person support to focus resolution.
- `app/lib/connect/context/focus.test.ts`
  - Added coverage for default Pers fallback.
- `app/components/connect/dashboard/ConnectDashboard.tsx`
  - Loads focus people separately from Connect-enabled participants.
  - Uses focus people for the global focus menu and Connect Home chips.
  - Shows a Main Connect User pill even when the focused person is not yet
    Connect-enabled.
  - Skips person-facing messages, calls, and audio profile reads unless the
    focused person is also a Connect participant.
  - Uses clearer copy for "focused but not Connect-enabled" state.
- `docs/CONNECT_STABILIZATION_HANDOFF.md`
  - Updated with the focus/participant distinction.
- `docs/CAREPLAND_STABLE_PROJECT_CONTEXT.md`
  - Updated with the same durable design rule.

## Current Verification

Latest local checks:

- `npm run test` passes with 117 tests.
- `npm run lint` exits with no errors.
- Current lint warnings are unrelated Import Anything warnings in
  `app/CarePlandPers.tsx`.

Manual browser verification still needs a fresh local dev server and an
authenticated local session with visible seeded Pers people.

Happy-path UI check:

1. Open Connect while global focus is `Everyone`.
2. Confirm the top-right focus menu includes the same Pers/Care VIP options as
   the Personal/Profile context.
3. Select a person inside Connect Home.
4. Confirm global focus remains `Everyone`.
5. Confirm the Main Connect User pill changes to that person.
6. If the person is not Connect-enabled, confirm action areas explain that.
7. If the person is Connect-enabled, confirm appointments, messages, calls,
   Receiver identity, and person-facing audio actions scope to that person.

## Current Data Model

Canonical Pers identity:

- `care_subjects`

Connect-specific tables:

- `connect_settings`
  - Durable target: `main_connect_user_person_id`.
- `connect_participants`
  - Explicit Connect enablement.
  - `person_id` references `care_subjects.id`.

Current SQL files of interest:

- `supabase/sql/2026-06-19_connect_main_user_context.sql`
- `supabase/sql/2026-06-20_care_subject_avatars.sql`
- `supabase/sql/2026-06-22_connect_settings_participant_policy.sql`
- `supabase/sql/2026-06-22_verify_connect_participants.sql`

Important SQL guidance:

- Do not auto-backfill every active `care_subjects` row into
  `connect_participants`.
- Connect participant enablement should remain explicit until participant
  management is intentionally designed.
- Live Supabase should be checked with the verification SQL before relying on
  seeded participant behavior.

## Current Runtime Boundaries

Person-facing Connect routes should require a Pers person id and verify access.

Use existing helpers instead of duplicating checks:

- `verifyConnectPersonAccessForRequest`
- `verifyConnectMessagePersonAccess`
- `verifyConnectCallPersonAccess`
- `verifyConnectAudioPersonAccess`

Person-facing reads/writes must not silently fall back to broad prototype data.

Broad/admin/maintenance tools may remain, but they should be visibly and
code-path distinct from Receiver/Dashboard/Settings actions intended for a
specific Main Connect User.

## Audio Boundary

User-facing Receiver, Dashboard, or Settings diagnostic actions must not write,
transcribe, preserve, or learn from audio unless:

- a Pers-backed Main Connect User is selected or resolved,
- that person is access-checked by the API, and
- the stored/read data is tagged or filtered by `mainConnectUserPersonId`.

Broad maintenance audio tools may still exist for Admin/DEV use. Keep them
visually separate and labeled as broad maintenance.

See `docs/CONNECT_AUDIO_BOUNDARIES.md`.

## Avatar Boundary

Avatar metadata belongs on Pers person rows:

- `care_subjects.avatar_url`
- `care_subjects.avatar_type`
- `care_subjects.avatar_alt_text`

Connect should display avatars but should not own avatar identity setup. Profile
is the home for Care VIP avatar management.

## CP Pers Boundary

Do not change CP Pers ownership for this Connect pass.

Connect can consume Pers people and may read active Pers focus people, but it
should not:

- introduce a second Connect user identity model,
- create Pers people as a side effect of Connect actions,
- alter global focus when a Connect-local target is selected under `Everyone`,
- automatically enable imported Pers people as Connect participants.

Future CP Pers import/interpreter work may create or update Pers-owned data, but
it should not automatically create `connect_participants` rows or change
`connect_settings.main_connect_user_person_id`.

## Dirty State Warning

This worktree currently has broad dirty/untracked state from parallel chats and
the ongoing modularization work. Do not infer that every changed file belongs to
Connect stabilization.

For this handoff, the most relevant files are:

- `app/api/connect/**`
- `app/components/connect/**`
- `app/lib/connect/**`
- `docs/CONNECT_STABILIZATION_HANDOFF.md`
- `docs/CONNECT_AUDIO_BOUNDARIES.md`
- `docs/CAREPLAND_STABLE_PROJECT_CONTEXT.md`
- `supabase/sql/2026-06-19_connect_main_user_context.sql`
- `supabase/sql/2026-06-22_connect_settings_participant_policy.sql`
- `supabase/sql/2026-06-22_verify_connect_participants.sql`

## Suggested Next Work

Keep the next pass boring and stabilizing:

1. Restart the local dev server so the browser is not using stale compiled code.
2. Verify the happy-path UI with seeded Pers people and Connect participants.
3. Run the participant verification SQL against live Supabase.
4. Remove or reword remaining prototype/demo assumptions as they appear.
5. Keep broad audio/admin maintenance paths separate from person-facing
   Receiver/Dashboard/Settings paths.
6. Continue reducing Connect user-facing Settings to meaningful Receiver
   defaults, while moving provisioning and diagnostics to Admin/DEV surfaces.

## Key Rule To Preserve

Connect can be temporarily limited, underprovisioned, or action-disabled, but it
should not be existentially confused.

When a signed-in user's Pers collection has at least one active person, Connect
should always have a focused person. Whether that focused person is enabled for
Connect actions is a separate question.
