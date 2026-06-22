# Connect Prototype Contracts

Source reference:

`docs/reference/connect-prototype/local-trigger-server/server.js`

This inventory is for migrating Connect from the static/local prototype into the
CarePland platform codebase. It is not an endorsement of the final route shape.

## Migration Principle

Keep Connect product-owned records explicit:

- receiver households
- receiver people
- receiver devices
- setup tokens/codes
- receiver messages
- calls
- audio artifacts and audio profile state
- interaction traces

Use platform services for auth, permissions, logging, entitlements, and
cross-product account/contact/household links.

## Health And Static Prototype

Prototype routes:

- `GET /health`
- `GET /`
- `GET /index.html`
- `GET /web-receiver.html`
- `POST /reset`
- `GET /debug`

Suggested migration:

- Keep `GET /health` only if a separate Connect service remains.
- Do not migrate static-file routes as API contracts.
- Replace `POST /reset` and `GET /debug` with dev-only tooling if still needed.

## Personal Bridge

Prototype route:

- `GET /personal/appointments/upcoming`

Suggested migration:

- Treat as a temporary bridge only.
- Connect should not depend on Personal appointment features.
- If Connect needs context from Personal, expose it through an explicit
  eligibility/link/context service, not a receiver runtime dependency.

## Receiver Registry And UI State

Prototype routes:

- `GET /receivers`
- `POST /receivers/register`
- `GET /receivers/:receiverId/events`
- `GET /receivers/:receiverId/ui-state`
- `POST /receivers/:receiverId/ui-state`
- `POST /receivers/:receiverId/guide-target`
- `POST /receivers/:receiverId/guide-target/clear`
- `POST /receivers/:receiverId/guide-target/:guideId/complete`

Suggested target modules:

- `app/lib/connect/receiver`
- `app/components/connect/receiver`
- `app/api/connect/receivers`

Notes:

- Separate durable receiver/device identity from ephemeral UI state.
- Guide target state may start as local/dev state until real receiver coaching
  behavior stabilizes.

## Receiver Devices And Setup Tokens

Prototype routes:

- `GET /receiver-devices`
- `GET /receiver-devices/:receiverDeviceId`
- `PATCH /receiver-devices/:receiverDeviceId`
- `POST /receiver-devices/:receiverDeviceId/household`
- `POST /receiver-devices/:receiverDeviceId/revoke`
- `POST /receiver-devices/:receiverDeviceId/setup-token`
- `POST /receiver-setup-tokens`
- `POST /receiver-setup-tokens/:token/revoke`
- `POST /receiver-setup-tokens/:token/exchange`
- `POST /receiver-setup-codes/:setupCode/exchange`

Suggested target modules:

- `app/lib/connect/provisioning`
- `app/api/connect/provisioning`

Notes:

- Prefer the namespaced `/connect/provisioning/*` versions as the future public
  API shape.
- Keep legacy non-namespaced routes only as prototype compatibility if needed.
- Approved Callers / Trusted Circle invitation management is a future
  coordinator/Admin feature, not an MVP user-facing Connect Settings panel.

## Connect Provisioning

Prototype routes:

- `GET /connect/provisioning`
- `GET /connect/provisioning/metadata`
- `GET /connect/provisioning/summary`
- `GET /connect/provisioning/receiver-devices`
- `GET /connect/provisioning/receiver-devices/:receiverDeviceId`
- `PATCH /connect/provisioning/receiver-devices/:receiverDeviceId`
- `POST /connect/provisioning/receiver-devices/:receiverDeviceId/household`
- `POST /connect/provisioning/receiver-devices/:receiverDeviceId/revoke`
- `POST /connect/provisioning/receiver-devices/:receiverDeviceId/setup-token`
- `GET /connect/provisioning/households`
- `POST /connect/provisioning/households`
- `GET /connect/provisioning/households/:receiverHouseholdId`
- `POST /connect/provisioning/households/:receiverHouseholdId/deactivate`
- `POST /connect/provisioning/households/:receiverHouseholdId/restore`
- `POST /connect/provisioning/households/:receiverHouseholdId/receiver-people`
- `POST /connect/provisioning/receiver-people/:receiverPersonId/deactivate`
- `POST /connect/provisioning/receiver-people/:receiverPersonId/restore`
- `GET /connect/provisioning/audit-events`
- `POST /connect/provisioning/setup-tokens`
- `POST /connect/provisioning/setup-tokens/:token/revoke`
- `POST /connect/provisioning/setup-tokens/:token/exchange`
- `POST /connect/provisioning/setup-codes/:setupCode/exchange`

Suggested target modules:

- `app/lib/connect/provisioning`
- `app/components/admin/AdminConnectPanel.tsx`
- `app/api/connect/provisioning`

First migration candidate:

- Add a typed Connect provisioning client used by `AdminConnectPanel`.
- Keep it pointed at `localhost:8790` initially.
- Then replace one endpoint group at a time with Next/platform services.

## Care Circles And Receiver Settings

Prototype routes:

- `GET /care-circles`
- `GET /care-circles/:careCircleId`
- `GET /care-circles/:careCircleId/member-view/:viewerMemberId`
- `GET /care-circles/:careCircleId/connections`
- `POST /care-circles/:careCircleId/connections/request`
- `POST /care-circles/:careCircleId/connections/:connectionId/state`
- `GET /receiver-settings`
- `PUT /receiver-settings/identity`
- `PUT /receiver-settings/lockdown`
- `PUT /receiver-settings/contact-permissions/:memberId`

Suggested target modules:

- `app/lib/connect/careCircle`
- shared platform household/contact/account link services when real persistence
  is introduced

Notes:

- Do not assume a Connect receiver household is a Personal Care VIP.
- Model links explicitly.

## Calls

Prototype routes:

- `POST /call`
- `GET /calls`
- `GET /calls/summary`
- `GET /calls/:callId`
- `POST /calls/:callId/state`

Suggested target modules:

- `app/lib/connect/calls`
- `app/api/connect/calls`
- `app/components/connect/receiver`
- `app/components/connect/dashboard`

Notes:

- Keep call state transitions explicit.
- Separate call state from notification transport.

## Messages

Prototype routes:

- `GET /messages`
- `POST /messages`
- `PATCH /messages/:messageId/state`

Suggested target modules:

- `app/lib/connect/messaging`
- `app/api/connect/messages`

Notes:

- Message text, transcript, audio artifact link, delivery state, and sender role
  should be modeled separately.

## Theme

Prototype routes:

- `GET /connect/theme`
- `PUT /connect/theme`
- `DELETE /connect/theme`

Suggested target modules:

- `app/lib/connect/theme`
- `app/components/connect/receiver`
- `app/components/admin/AdminConnectPanel.tsx`

Notes:

- `app/lib/connect/theme` now owns the typed prototype client for Admin theme
  load/save/reset operations.
- Good early migration candidate because it is bounded and already has shared
  prototype code.

## Audio

Prototype routes:

- `POST /audio/transcriptions`
- `GET /audio/artifacts`
- `GET /audio/artifacts/:artifactId/detail`
- `POST /audio/artifacts/reconcile`
- `POST /audio/artifacts/backfill-integrity`
- `POST /audio/artifacts/:artifactId/transcribe`
- `POST /audio/artifacts/transcribe-pending`
- `POST /audio/timeline/backfill`
- `GET /audio/timeline`
- `POST /audio/events/backfill-artifact-links`
- `POST /audio/hearing-feedback`
- `GET /audio/hearing-profile`
- `GET /audio/storage-health`
- `POST /audio/enhancement-events`
- `GET /audio/enhancement-events`
- `GET /audio/domain-model`
- `GET /audio/domain-catalogs`
- `GET /audio/state-metadata`
- `GET /audio/migration-readiness`
- `GET /audio/capabilities`
- `GET /audio/readiness-catalog`
- `GET /audio/event-catalog`
- `GET /audio/artifact-catalog`
- `GET /audio/maintenance-preview`
- `GET /audio/maintenance-catalog`
- `GET /audio/manifest`
- `GET /audio/export-manifest`
- `GET /audio/export-index`
- `GET /audio/media-manifest`
- `GET /audio/transcript-manifest`
- `GET /audio/hearing-profile-manifest`
- `GET /audio/review`
- `GET /audio/review-bundle`

Suggested target modules:

- `app/lib/connect/audio`
- `app/api/connect/audio`
- object/file storage service when persistence moves beyond local prototype

Notes:

- Audio is large enough to migrate after provisioning/theme/client boundaries
  exist.
- Preserve domain catalog concepts; they are useful migration scaffolding.
- Future sender-voice work is documented separately in
  `docs/CONNECT_ANDREW_VOICE_FUTURE.md`. It is consent-gated, sender-authored
  only, and not part of current provider wiring.

## SMS Participant

Prototype routes:

- `GET /sms/participant/messages`
- `POST /sms/participant/inbound`

Suggested target modules:

- `app/lib/connect/sms`
- future integration service, not core receiver UI

Notes:

- Keep SMS as an integration adapter around Connect messaging/participants.

## Recommended First Contracts

1. `connect/theme`
2. `connect/provisioning` read/summary client
3. `connect/provisioning` household/device setup mutations
4. `connect/messages`
5. `connect/calls`
6. `connect/audio`
