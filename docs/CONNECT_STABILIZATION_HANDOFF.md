# CarePland Connect Stabilization Handoff

Last updated: 2026-06-22

## Current Ownership Lanes

- Connect provisioning/model: Main Connect User, Connect participants, settings, appointment/message scoping.
- Connect avatars: avatar display/upload/remove for Pers-backed Care VIPs.
- Connect audio: recording, transcription, playback, hearing feedback, audio artifacts, audio profile summaries.

Avoid broad shared refactors while multiple chats are active. Prefer small, well-named helpers inside `app/lib/connect/*`.

## Main Connect User Rule

Connect must always be able to answer: whose Connect world is active?

The answer is `mainConnectUserPersonId`, an existing CarePland Pers person/Care VIP id from `care_subjects.id`.

Do not create Connect-only people in this pass.

## Global Focus Boundary

Global focus is the app-wide viewing context:

- Everyone
- a specific Care VIP/person

Main Connect User is Connect-local: the person whose Connect world is active.

If global focus is a specific person, Connect may derive Main Connect User from that person.

If global focus is Everyone, selecting a person inside Connect must not update global focus. It should only set Connect-local state and may be cleared when navigating away from Connect.

Connect must always resolve an active focus person for the UI when a signed-in
Pers person is available. If there is no specific global focus and no durable
Main Connect User, fall back to a default active Pers person for display/context.
Connect participant rows determine whether Receiver actions are enabled; they
must not be the source of whether a person can be the visible Connect focus.

Current dashboard behavior:

- The top CarePland focus control owns global focus.
- The Connect Home person chips are temporary Connect-local context when global focus is Everyone.
- The Settings > People selector writes the durable Main Connect User setting.
- Connect should default to the durable Main Connect User when global focus is Everyone and no temporary Connect-local person has been selected.
- Dashboard should not promote receiver-linked prototype people to active Main Connect User fallback. If no durable/global/temporary person exists, it may use a default active Pers person for display focus; if no Pers-backed person exists at all, person-facing actions and reads stay empty/disabled.
- Dashboard may show an active Pers-backed focus person even when that person is not yet Connect-enabled. In that state, actions stay disabled and explain that the person must be enabled for Connect first.
- Receiver should not restore local-storage person selection as active identity. It should use the verified durable Main Connect User from `/api/connect/context`; choosing a person updates that durable setting before Receiver treats the person as active.
- Receiver session storage may remember `mainConnectUserPersonId` for continuity/debugging, but it must not treat local storage as authority; `/api/connect/context` remains the active identity source.

## Person And Participant Model

- Canonical person model: `care_subjects`.
- Connect-enabled people: `connect_participants.person_id -> care_subjects.id`.
- Admin provisioning may still show unlinked prototype records for review, but those are not Connect-only people for this pass.
- Global focus people are active Pers `care_subjects` visible to the signed-in user. This list can be broader than Connect participants.
- Current runtime behavior:
  - If `connect_participants` exists, Connect lists active participants in the signed-in user's care circles.
  - If `connect_participants` is missing or empty, Connect lists no participants rather than falling back to every active Care VIP.
  - The SQL migration must not auto-enable every active Care VIP; participant rows should come from explicit provisioning/admin enablement until participant management exists.
- Main Connect User setting:
  - Durable storage target: `connect_settings.main_connect_user_person_id`.
  - Local dev fallback: `tmp/connect-settings/<user-id>-main-connect-user.json`.
- Server routes that need a selected, access-checked Main Connect User should reuse `verifyConnectPersonAccessForRequest` from `app/lib/connect/context/server/mainConnectUserContext.ts`.
- Main Connect User eligibility lives in `app/lib/connect/context/mainConnectUserEligibility.ts`: the person must be active, Pers-backed, and not a pet Care VIP. Pet Care VIPs may still appear in Connect household/person context and avatar surfaces.
- Dashboard receiver/provisioning status should come through `/api/connect/provisioning`; do not call the prototype `/receivers` registry directly from person-facing Dashboard refresh.
- Remaining Dashboard/Receiver prototype endpoint references should be limited to transport details such as local audio media URL conversion or opening a generated setup link, not person-owned data reads.

## Current Data Scoping

- Appointments: `/api/connect/appointments` requires `personId`, verifies the signed-in user can access that Pers person, and filters by `appointments.care_subject_id`.
- Appointment response shaping now lives in `app/lib/connect/appointments/appointmentScoping.ts` with tests. Routes should continue querying by selected `personId`/`care_subject_id` and use the helper for normalized Receiver-facing appointment payloads.
- Messages: `/api/connect/messages` requires `personId`, verifies the signed-in user can access that Pers person, and filters local/prototype messages by `mainConnectUserPersonId`.
- Dashboard should not request person-facing messages, call summary, or audio profile data when no active Main Connect User is resolved; show empty local state instead of calling scoped routes without `personId`.
- Message merge/filter/summary logic now lives in `app/lib/connect/messaging/server/messageScoping.ts` with tests. Local messages win over duplicate prototype messages, lists are newest-first, and summary counts reflect the scoped Main Connect User result set.
- Message route access lives in `app/lib/connect/messaging/server/messageAccess.ts`; message routes should use it for selected-person access checks and consistent denied responses.
- Message state: `/api/connect/messages/[messageId]/state` requires `mainConnectUserPersonId`, verifies access, and local state updates only apply when the message belongs to that Main Connect User.
- Calls: `/api/connect/calls`, `/api/connect/calls/summary`, and `/api/connect/calls/[callId]/state` require a Main Connect User/person id for person-facing flows, verify access, and proxy only tagged calls through the local Connect API.
- Call filtering and summary shaping now live in `app/lib/connect/calls/callScoping.ts` with tests. Routes should use those helpers rather than reimplementing person matching.
- Call route access lives in `app/lib/connect/calls/server/callAccess.ts`; call routes should use `verifyConnectCallPersonAccess` rather than sharing logic from sibling route modules or duplicating denied-response handling.
- Dashboard and Receiver message sends include `mainConnectUserPersonId` and signed-in auth headers.
- Receiver audio playback/feedback events require `mainConnectUserPersonId`, verify access, and carry that id for local profile learning.
- User-facing audio transcription uploads require `mainConnectUserPersonId`, verify access, and preserve local artifacts with that id.
- Dashboard and Receiver now guard user-facing record/transcribe/send/playback telemetry actions before the server call; if no Pers-backed Main Connect User is active, the UI asks the user to choose one instead of attempting to preserve or write audio.
- Audio routes should use `verifyConnectAudioPersonAccess` from `app/lib/connect/audio/server/audioAccess.ts` for selected-person access checks and consistent denied responses.
- Audio profile reads may pass `personId`; when provided, access is verified and local playback events are filtered to that person. Unscoped broad reads may still include prototype/device profile data.
- Dashboard and Receiver should load audio profile data through `/api/connect/audio/profile`, not the prototype receiver endpoint directly, so selected-person access checks and local event filtering are preserved. If no active Main Connect User is resolved, person-facing Dashboard/Receiver surfaces should skip profile/preference reads rather than falling back to broad prototype audio data.
- Audio profile event filtering and prototype/local profile merging now live in `app/lib/connect/audio/server/audioProfileScoping.ts` with tests. Person-scoped profiles should pass only local playback events for the selected Main Connect User and no prototype profile.
- Local audio artifacts now carry `mainConnectUserPersonId` when preserved from a person-scoped message. Artifact list/review/detail routes accept optional `personId`; when supplied, local artifact links are filtered to that Main Connect User and unscoped prototype artifact data is not merged.
- Audio artifact/review response shaping now lives in `app/lib/connect/audio/server/audioArtifactScoping.ts` with tests. Person-scoped artifact/review responses should pass only scoped local artifacts and no prototype artifact data.
- Audio profile/artifact/review responses that can be person-scoped or broad should expose `scope: "main_connect_user"` for selected-person reads and `scope: "admin_broad"` for intentional Admin/maintenance reads.
- Local audio artifact detail response shaping and integrity matching also live in `audioArtifactScoping.ts` with tests. Detail routes should keep returning 404 for person-scoped artifact misses rather than falling back to broad prototype detail.
- Local audio artifact and playback event storage tests now verify that preserved audio and playback feedback keep `mainConnectUserPersonId`, so later artifact review/profile reads can remain scoped to the selected Main Connect User.
- Receiver no longer seeds a fake "Mom" message world. If no person-scoped messages load, it starts with no messages rather than implying a different Main Connect User.
- Dashboard Settings > Advanced people diagnostics renders Main Connect User audio checks that pass the active Pers-backed `personId` and auth headers. Broad audio maintenance tools remain visible only under a separately labeled broad maintenance section with separate code paths.

## Audio Guidance

Audio code should tag person-scoped records with `mainConnectUserPersonId` whenever the audio belongs to the active Receiver world.

See `docs/CONNECT_AUDIO_BOUNDARIES.md` for the current Receiver/Dashboard/Settings audio scoping rules and broad-maintenance exceptions.

Safe audio-owned areas:

- `app/lib/connect/audio/**`
- `app/api/connect/audio/**`
- audio-specific message persistence helpers when preserving original audio
- Receiver playback and recording controls in `app/components/connect/receiver/ConnectReceiver.tsx`

Use the existing Connect context client when audio needs the active person:

- `fetchConnectMainUserContext()`
- `connectAuthHeaders()`

Avoid changing these without coordinating:

- `app/lib/connect/context/**`
- `app/api/connect/context/route.ts`
- `app/api/connect/appointments/route.ts`
- `supabase/sql/2026-06-19_connect_main_user_context.sql`

## Quick Recontext For Other Chats

- Do not change CP Pers ownership or identity. Connect consumes Pers people.
- Do not introduce Connect-only people, guest users, or external invitees in this pass.
- CP Pers import/interpreter work may create or update `care_subjects`, appointments, notes, and other Pers-owned records, but it should not automatically create `connect_participants` rows or change the durable Main Connect User setting.
- Do not make a Connect person chip write global focus.
- Do not treat the signed-in account as the appointment/message owner unless that Pers person is explicitly selected as the Main Connect User or by global focus.
- For person-scoped Connect records, carry `mainConnectUserPersonId`.
- When adding an API that reads person-scoped Connect data, require a Pers `personId` and verify access through the signed-in user's CarePland collection.
- Prefer the domain access helpers for route-level checks; use `verifyConnectPersonAccessForRequest` directly only when a route needs its returned access token or user context.
- For person-facing message APIs, use `verifyConnectMessagePersonAccess` from `app/lib/connect/messaging/server/messageAccess.ts` instead of duplicating denied-response handling.
- For person-facing call APIs, use `verifyConnectCallPersonAccess` from `app/lib/connect/calls/server/callAccess.ts` instead of importing from another route file.
- Keep broad prototype/maintenance routes clearly separate from Receiver person flows unless they are made access-checked and person-scoped.
- Do not call prototype call endpoints directly from person-facing Dashboard or Receiver flows; use `/api/connect/calls/**`.
- In Dashboard/Settings diagnostics, person-facing audio checks must use the active Main Connect User. Broad endpoints such as individual artifact transcript retry, pending-transcript maintenance, backfills, reconciliation, and manifest must stay labeled as broad maintenance/admin tools.
- Do not let user-facing Receiver, Dashboard, or Settings diagnostic actions write, transcribe, preserve, or learn from audio unless a Pers-backed Main Connect User has been selected and access has been verified by the API.

## Avatar Guidance

Avatar metadata belongs on the canonical Pers person row for now:

- `care_subjects.avatar_url`
- `care_subjects.avatar_type`
- `care_subjects.avatar_alt_text`

Avatar upload/remove should continue to verify that the person belongs to the signed-in user's CarePland collection.

## Current Verification

Known current check state:

- `npm run lint` exits successfully.
- `npm run test` exits successfully with 117 passing tests.
- Connect participant filtering has focused tests in `app/lib/connect/context/connectParticipantFiltering.test.ts`; empty/missing participant ids do not widen Connect to all active Care VIPs.
- Local Supabase SQL archive verification:
  - `supabase/sql/2026-06-19_connect_main_user_context.sql` creates `connect_settings.main_connect_user_person_id -> care_subjects.id`, creates `connect_participants.person_id -> care_subjects.id`, enables RLS, and keeps Connect-only people out of the model.
  - The Connect context migration no longer backfills every active `care_subjects` row into `connect_participants`; participant enablement must be explicit.
  - `supabase/sql/2026-06-20_care_subject_avatars.sql` adds `care_subjects.avatar_url`, `care_subjects.avatar_type`, `care_subjects.avatar_alt_text`, and the private `carepland-avatars` bucket.
- Supabase SQL was reported executed on 2026-06-22. Next live-data check is to confirm `connect_participants` contains only intentionally enabled Pers people.
- Added `supabase/sql/2026-06-22_verify_connect_participants.sql` as a read-only Supabase verification utility for participant counts/details, participant/person care-circle mismatches, invalid Main Connect User settings, pet participants, and possible broad backfill review.
- Added `supabase/sql/2026-06-22_connect_settings_participant_policy.sql` as a policy patch so direct Supabase writes to `connect_settings.main_connect_user_person_id` must point to an active non-pet Connect participant in one of the signed-in user's care circles.
- Earlier manual browser check verified the old no-person/failure-safe path. That is no longer the desired signed-in UX: Connect should show an active Pers-backed focus person when one is available, while disabling actions if that person is not Connect-enabled.
- 2026-06-22 browser retries reached `http://localhost:3000/connect/dashboard`, but the local browser session was signed out and displayed "Sign in to load people." Seeded happy-path UI verification still needs an authenticated local session with visible Connect participants.
- Settings > People > Advanced people diagnostics renders on the active Settings surface. With no Main Connect User selected, person-facing audio profile copy asks the user to choose one; profile diagnostics and Main Connect User audio checks use only the active Main Connect User, while Broad audio maintenance tools remain visibly separate.

Happy-path browser check to run when seeded Care VIPs/Connect participants are visible:

- Set global focus to Everyone.
- Select a person inside Connect Home.
- Confirm global focus stays Everyone.
- Confirm the Main Connect User pill changes to the selected person.
- Confirm Dashboard messages, appointments, calls, Receiver identity, and person-facing audio actions scope to that selected Main Connect User.

## Remaining Stabilization TODOs

- Apply `supabase/sql/2026-06-22_connect_settings_participant_policy.sql`, then run `supabase/sql/2026-06-22_verify_connect_participants.sql` against live Supabase. If an earlier local copy of `2026-06-19_connect_main_user_context.sql` was already run with the broad backfill, review `connect_participants` and remove unintended rows before trusting the seeded happy path.
- Continue moving any remaining non-Admin prototype text from "receiver people" to Main Connect User / Connect participant language where user-facing.
- Continue moving audio profile/preferences toward explicit Main Connect User scoping where prototype data is still receiver/device-only.
- Continue separating Receiver identity copy from prototype contact/caller copy. Current Andrew labels are contact/caller placeholders, not Main Connect User identity.
