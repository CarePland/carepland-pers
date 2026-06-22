# CarePland Connect Audio Boundaries

Last updated: 2026-06-22

This note is for chats working on Connect audio. It is intentionally narrow: protect the Main Connect User scoping model while audio diagnostics, transcription, playback, and maintenance continue to evolve.

## Core Rule

Person-facing Connect audio belongs to the active Main Connect User.

For this pass, the Main Connect User must be an existing Pers person/Care VIP from `care_subjects.id`. Do not add Connect-only people, guests, invitees, or alternate account flows from audio work.

Any user-facing Receiver, Dashboard, or Settings diagnostic action that reads, writes, transcribes, preserves, or learns from person audio must carry `mainConnectUserPersonId` or `personId` and must verify that the signed-in user can access that Pers person before doing the work.

## Person-Facing Surfaces

These surfaces must use the active Main Connect User:

- Dashboard message recording and send.
- Receiver Ask microphone recording.
- Receiver contact message recording and send.
- Receiver audio playback/feedback telemetry.
- Settings > People > Advanced people diagnostics > Main Connect User audio checks.
- Message heard/read state when tied to a Receiver-person world.

If no Pers-backed Main Connect User is active, the UI should stop before the server call and ask the user to choose one.

## Broad Maintenance Surfaces

Broad/admin maintenance tools may remain unscoped while they are clearly separate from Receiver-person checks.

Examples:

- Pending transcript retry.
- Individual preserved-artifact transcript retry from Admin Connect.
- Upload index reconciliation.
- Integrity/hash backfill.
- Timeline/event-link backfills.
- Manifest review.
- Broad maintenance preview.

These controls should stay visually labeled as broad maintenance/admin tools and should not appear as ordinary Receiver-person actions.

Shared broad audio client helpers in `app/lib/connect/audio/prototypeAudioClient.ts` are intentionally named with `admin` / `fetchAdmin` prefixes. Do not import them into Receiver or Dashboard person-facing flows.

Route-level audio access checks should use `verifyConnectAudioPersonAccess` from `app/lib/connect/audio/server/audioAccess.ts` so denied Main Connect User responses stay consistent across profile, artifact, transcription, and playback endpoints.

Routes that can serve either selected-person data or broad Admin data should return a `scope` marker:

- `main_connect_user` when a verified `personId` / `mainConnectUserPersonId` is active.
- `admin_broad` when no person id was supplied and the route intentionally serves a broad Admin/maintenance read.

## Current Endpoint Boundary

Person-scoped or access-checked routes:

- `POST /api/connect/audio/transcriptions`
- `POST /api/connect/audio/playback-events`
- `GET /api/connect/audio/profile?personId=...`
- `GET /api/connect/audio/artifacts?personId=...`
- `GET /api/connect/audio/review?personId=...`
- `GET /api/connect/audio/artifacts/[artifactId]/detail?personId=...`
- `GET/POST /api/connect/messages`
- `PATCH /api/connect/messages/[messageId]/state`
- `GET/POST /api/connect/calls`
- `GET /api/connect/calls/summary`
- `POST /api/connect/calls/[callId]/state`

Broad maintenance routes:

- `POST /api/connect/audio/artifacts/[artifactId]/transcribe`
- `POST /api/connect/audio/artifacts/transcribe-pending`
- `GET /api/connect/audio/manifest`
- `GET /api/connect/audio/maintenance-preview`
- `POST /api/connect/audio/maintenance/reconcile`
- `POST /api/connect/audio/maintenance/backfill-integrity`
- `POST /api/connect/audio/maintenance/backfill-timeline`
- `POST /api/connect/audio/maintenance/backfill-event-links`

Local media transport:

- `GET /api/connect/audio/media/[...storageKey]` serves preserved local audio bytes for playback. Treat artifact/review/detail routes as the scoped read APIs; do not use the media URL itself as a diagnostic listing or access-decision surface.

## Do Not Regress

- Do not default person-facing audio to the logged-in account unless that account is explicitly selected as the Main Connect User.
- Do not merge unscoped prototype audio artifacts into person-scoped review/detail responses.
- Do not let Dashboard or Receiver preserve original audio without a selected Main Connect User.
- Do not let playback feedback train a person profile without a selected Main Connect User.
- Do not move broad maintenance actions into ordinary Receiver or Dashboard user flows.

## Quick Verification

- With no Pers-backed Main Connect User loaded, Dashboard call/send buttons should be disabled and Record should not start server-side transcription or preservation.
- With no Main Connect User in Receiver, ask/contact recording and send actions should stop before audio write/preserve calls.
- Settings person diagnostics should call audio artifact/review routes with `personId` and auth headers.
- Broad maintenance tools should remain under the separately labeled "Broad audio maintenance tools" section.
