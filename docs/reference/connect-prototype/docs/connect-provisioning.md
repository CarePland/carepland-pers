# CarePland Connect Provisioning

This document describes the local prototype structure for Connect receiver provisioning.

It is intentionally not production auth. The goal is to establish the product shape, service boundaries, and Admin registry vocabulary before persistence and real credentials are added.

## Product Boundary

Receiver provisioning is device setup, not receiver-user login.

The receiver user should not enter a username, password, or admin credential on the appliance. A coordinator creates a single-use setup link or setup card, opens it on the receiver device, and the receiver exchanges that link for a scoped receiver-device token.

## Connect Area Mapping

AdminRoot registry area:

```text
product: "connect"
area: "provisioning"
registryAreaKey: "connect.provisioning"
```

Label:

```text
Connect Provisioning
```

Reserved Admin panel registration key:

```text
connect.provisioning.households
```

Related reserved Connect panel keys from the AdminRoot handoff:

```text
connect.audio.profile
connect.ask.interpreter
connect.ask.interactions
```

Suggested child surfaces:

- `receiver_households`
- `receiver_devices`
- `setup_links`
- `pairing_status`
- `revocation`
- `receiver_heartbeat`
- `audit_events`

This prototype dashboard is not the future Admin destination. It is a local coordinator/testing surface that exercises the provisioning service shape.

When Admin work resumes, new Admin-facing panels should target AdminRoot and `adminProductSurfaces.ts` / `adminPanelRegistrations`, not CP Personal route/page/runtime state. Connect domain/state/API work should remain under Connect-owned paths first.

## Domain Objects

### ReceiverHousehold

Represents the receiver-side household target that devices are provisioned into.

Current local fields:

- `id`
- `careCircleId`
- `displayName`
- `defaultTarget`
- `active`
- `receiverPeople`
- `receiverPersonCount`
- `createdAt`
- `updatedAt`

This is intentionally not modeled as a 1:1 user account. A household may include multiple receiver people and multiple receiver devices.

### ReceiverDevice

Represents a provisionable receiver endpoint.

Current local fields:

- `id`
- `careCircleId`
- `receiverHouseholdId`
- `receiverId`
- `name`
- `locationLabel`
- `status`
- `lastSeenAt`
- `pairedAt`
- `revokedAt`
- `createdAt`
- `updatedAt`
- `presence`

Local-only private field:

- `deviceToken`

The device token must not be returned by public list/read endpoints.

`presence` is computed in public responses and is not a stored lifecycle status. Current states:

- `online`: heartbeat seen in the last 15 seconds.
- `stale`: heartbeat seen in the last 2 minutes.
- `offline`: paired device has no recent heartbeat.
- `not_paired`: device has not exchanged a setup token/code.
- `revoked`: device token has been revoked.

### ReceiverSetupToken

Represents a single-use setup credential created by a coordinator.

Current local fields:

- `token`
- `setupCode`
- `receiverDeviceId`
- `careCircleId`
- `receiverHouseholdId`
- `expiresAt`
- `usedAt`
- `createdAt`
- `createdByUserId`
- `status`

Allowed statuses:

- `active`
- `used`
- `expired`
- `revoked`

### Device Token

Represents the local credential stored on a paired receiver device.

Rules:

- Scoped to exactly one `ReceiverDevice`.
- Used by the web receiver for heartbeat, event polling, and receiver-originated messages.
- Revocable.
- Not an admin credential.
- Replaced when a receiver is re-paired.

### ProvisioningAuditEvent

Represents a local, read-only trail of provisioning actions.

Current local fields:

- `id`
- `type`
- `productKey`
- `areaKey`
- `registryAreaKey`
- `createdAt`
- `receiverDeviceId`
- `receiverId`
- `careCircleId`
- `receiverHouseholdId`
- `setupCode`
- `name`
- `locationLabel`

Current event types:

- `receiver_device.created`
- `receiver_household.created`
- `receiver_household.deactivated`
- `receiver_household.restored`
- `receiver_person.created`
- `receiver_person.deactivated`
- `receiver_person.restored`
- `receiver_device.repair_started`
- `receiver_device.paired`
- `receiver_device.heartbeat`
- `receiver_device.updated`
- `receiver_device.household_assigned`
- `receiver_device.revoked`
- `setup_token.created`
- `setup_token.superseded`
- `setup_token.revoked`
- `setup_token.exchanged`

## State Model

### ReceiverDevice.status

Current local statuses:

- `setup_pending`
- `available`
- `ringing`
- `connected`
- `revoked`

Prototype interpretation:

- `setup_pending`: a setup link/card exists or the device is awaiting pairing.
- `available`: device has paired successfully and may heartbeat.
- `revoked`: current device token is invalid and the receiver must be re-paired.

Current online/offline display should use `ReceiverDevice.presence.state`, not `ReceiverDevice.status`.

### Setup Lifecycle

```text
coordinator creates setup token
  -> ReceiverSetupToken.active
  -> ReceiverDevice.setup_pending

receiver opens setup link
  -> token exchanged
  -> ReceiverSetupToken.used
  -> device token issued
  -> ReceiverDevice.available

receiver heartbeats
  -> lastSeenAt updated
  -> ReceiverDevice.status refreshed
  -> receiver_device.heartbeat audit event throttled locally
  -> dashboard can route calls to receiverId

coordinator revokes device
  -> device token invalidated
  -> active setup tokens revoked
  -> ReceiverDevice.revoked
  -> receiver sees Setup Needed on next authenticated request

coordinator re-pairs device
  -> old device token invalidated
  -> new ReceiverSetupToken.active
  -> ReceiverDevice.setup_pending
```

## Local Route Contracts

Base URL:

```text
http://localhost:8790
```

### Metadata

Connect-owned route:

```http
GET /connect/provisioning/metadata
```

Returns:

- registry product/area keys
- reserved panel keys
- related Connect areas
- child surface names

### List Receiver Devices

Connect-owned route:

```http
GET /connect/provisioning/receiver-devices
```

Legacy prototype alias:

```http
GET /receiver-devices
```

Returns:

- `careCircle`
- `summary`
- `receiverHouseholds`
- `receiverDevices`
- `setupTokens`

This is currently a local coordinator/testing endpoint. It includes receiver household metadata and setup token metadata, including setup codes, but never returns device tokens.

### Receiver Device Detail

Connect-owned route:

```http
GET /connect/provisioning/receiver-devices/:receiverDeviceId
```

Legacy prototype alias:

```http
GET /receiver-devices/:receiverDeviceId
```

Returns:

- registry metadata
- public receiver device record, including computed presence
- receiver household
- setup tokens for that device
- recent provisioning audit events for that device

This endpoint is intended for Admin-style drill-down panels that need device history without loading or filtering the full provisioning snapshot.

### Update Receiver Device Metadata

Connect-owned route:

```http
PATCH /connect/provisioning/receiver-devices/:receiverDeviceId
```

Legacy prototype alias:

```http
PATCH /receiver-devices/:receiverDeviceId
```

Body:

```json
{
  "name": "Kitchen Receiver",
  "locationLabel": "Kitchen"
}
```

Effects:

- updates display/inventory metadata only
- does not change pairing, household membership, or the scoped receiver token
- writes a `receiver_device.updated` provisioning audit event with previous and current values

### Assign Receiver Device Household

Connect-owned route:

```http
POST /connect/provisioning/receiver-devices/:receiverDeviceId/household
```

Legacy prototype alias:

```http
POST /receiver-devices/:receiverDeviceId/household
```

Body:

```json
{
  "receiverHouseholdId": "receiver-household-elizabeth-robert"
}
```

Effects:

- moves the receiver device between Connect receiver households
- does not change Personal profile or appointment state
- does not revoke an already paired receiver device token
- revokes active setup tokens for that device so stale setup links cannot pair into the previous household context
- writes a `receiver_device.household_assigned` provisioning audit event

### Provisioning Summary

Connect-owned route:

```http
GET /connect/provisioning/summary?careCircleId=care-circle-mom
```

Returns:

- registry metadata
- generated timestamp
- total household, receiver person, receiver device, and setup-token counts
- receiver device counts by lifecycle status
- receiver device counts by computed presence
- setup token counts by status
- household-level device counts by status and presence

This endpoint exists for Admin-style overview panels that should not need to infer summary state from raw provisioning rows.

### List Receiver Households

Connect-owned route:

```http
GET /connect/provisioning/households?careCircleId=care-circle-mom
```

Returns:

- registry metadata
- receiver households
- receiver people nested under each household

### Create Receiver Household

Connect-owned route:

```http
POST /connect/provisioning/households
```

Body:

```json
{
  "careCircleId": "care-circle-mom",
  "displayName": "Bedroom suite",
  "defaultTarget": "household"
}
```

Effects:

- creates a Connect-local receiver household in provisioning state
- does not create or modify a Personal profile, appointment household, or care-circle membership
- writes a `receiver_household.created` provisioning audit event

### Deactivate Receiver Household

Connect-owned route:

```http
POST /connect/provisioning/households/:receiverHouseholdId/deactivate
```

Effects:

- archives a Connect-created receiver household
- refuses to archive if non-revoked receiver devices are still assigned
- does not affect Personal profile, appointment household, or care-circle membership state
- writes a `receiver_household.deactivated` provisioning audit event

### Restore Receiver Household

Connect-owned route:

```http
POST /connect/provisioning/households/:receiverHouseholdId/restore
```

Effects:

- restores a Connect-created inactive receiver household
- does not affect Personal profile, appointment household, or care-circle membership state
- writes a `receiver_household.restored` provisioning audit event

### Create Receiver Person

Connect-owned route:

```http
POST /connect/provisioning/households/:receiverHouseholdId/receiver-people
```

Body:

```json
{
  "careCircleId": "care-circle-mom",
  "displayName": "Elizabeth"
}
```

Effects:

- creates a Connect-local receiver person under a receiver household
- does not create a Personal profile, member, user account, or Care VIP
- writes a `receiver_person.created` provisioning audit event

### Deactivate Receiver Person

Connect-owned route:

```http
POST /connect/provisioning/receiver-people/:receiverPersonId/deactivate
```

Effects:

- deactivates a Connect-created receiver person in provisioning state
- does not remove static care-circle receiver people
- does not delete a Personal profile, member, user account, or Care VIP
- writes a `receiver_person.deactivated` provisioning audit event

### Restore Receiver Person

Connect-owned route:

```http
POST /connect/provisioning/receiver-people/:receiverPersonId/restore
```

Effects:

- reactivates a Connect-created inactive receiver person in provisioning state
- does not create a Personal profile, member, user account, or Care VIP
- writes a `receiver_person.restored` provisioning audit event

### Receiver Household Detail

Connect-owned route:

```http
GET /connect/provisioning/households/:receiverHouseholdId?careCircleId=care-circle-mom
```

Returns:

- registry metadata
- receiver household row
- receiver people nested under that household
- inactive Connect-created receiver people when `includeInactivePeople=1`
- household provisioning summary
- public receiver devices in the household
- setup tokens for those devices
- recent provisioning audit events for that household or its devices

This endpoint is intended for `connect.provisioning.households` style Admin panels that need a household drill-down without mixing Connect receiver provisioning into Personal profile or appointment state.

### List Audit Events

Connect-owned route:

```http
GET /connect/provisioning/audit-events?limit=20
```

Returns:

- registry metadata
- recent provisioning audit events

### Create Setup Token

Connect-owned route:

```http
POST /connect/provisioning/setup-tokens
```

Legacy prototype alias:

```http
POST /receiver-setup-tokens
```

Body:

```json
{
  "careCircleId": "care-circle-mom",
  "receiverHouseholdId": "receiver-household-elizabeth-robert",
  "name": "Kitchen Receiver",
  "locationLabel": "Kitchen",
  "createdByUserId": "user-andrew",
  "expiresInMinutes": 30
}
```

Returns:

- `receiverDevice`
- `setupToken`
- `setupPath`

### Exchange Setup Token

Connect-owned route:

```http
POST /connect/provisioning/setup-tokens/:token/exchange
```

Legacy prototype alias:

```http
POST /receiver-setup-tokens/:token/exchange
```

Returns:

- `receiverDevice`
- `deviceToken`
- `tokenScope: receiver_device`

The setup token becomes `used`. A second exchange returns an error.

### Exchange Setup Code

Connect-owned route:

```http
POST /connect/provisioning/setup-codes/:setupCode/exchange
```

Legacy prototype alias:

```http
POST /receiver-setup-codes/:setupCode/exchange
```

Returns:

- `receiverDevice`
- `deviceToken`
- `tokenScope: receiver_device`

The setup code is normalized before matching, so `ABC123` and `ABC-123` are equivalent. The backing setup token becomes `used`.

### Revoke Setup Token

Connect-owned route:

```http
POST /connect/provisioning/setup-tokens/:token/revoke
```

Legacy prototype alias:

```http
POST /receiver-setup-tokens/:token/revoke
```

Effects:

- sets an active setup token to `revoked`
- does not revoke the receiver device
- does not invalidate an already paired receiver device token
- writes a `setup_token.revoked` provisioning audit event

### Revoke Receiver Device

Connect-owned route:

```http
POST /connect/provisioning/receiver-devices/:receiverDeviceId/revoke
```

Legacy prototype alias:

```http
POST /receiver-devices/:receiverDeviceId/revoke
```

Effects:

- invalidates the current device token
- removes active receiver presence
- revokes active setup tokens for that device
- sets `ReceiverDevice.status` to `revoked`

### Re-Pair Receiver Device

Connect-owned route:

```http
POST /connect/provisioning/receiver-devices/:receiverDeviceId/setup-token
```

Legacy prototype alias:

```http
POST /receiver-devices/:receiverDeviceId/setup-token
```

Effects:

- invalidates any current device token
- revokes any active setup token for that device
- creates a fresh active setup token
- sets `ReceiverDevice.status` to `setup_pending`

### Receiver Heartbeat

```http
POST /receivers/register
Authorization: Bearer <deviceToken>
```

Paired web receivers should send the bearer token. Legacy/demo receiver registration without a token still works for local prototype compatibility.

For paired receiver devices, this route updates and persists:

- `ReceiverDevice.status`
- `ReceiverDevice.lastSeenAt`
- `ReceiverDevice.updatedAt`

The local server writes a throttled `receiver_device.heartbeat` provisioning audit event so the Admin-facing provisioning trail can distinguish pairing from ongoing device presence.

## Dashboard Behavior

The local dashboard currently supports:

- creating setup cards
- selecting the target receiver household for new setup cards
- showing setup code and setup link
- showing a QR-style visual placeholder
- showing receiver household context
- listing receiver devices
- grouping receiver devices by household
- showing setup token history
- re-pairing a device
- revoking a device
- showing a setup progress checklist
- auto-selecting the latest non-revoked provisioned receiver for Connect requests

The QR-style visual is deterministic but not a production QR implementation. It exists to validate the setup-card product shape.

## Receiver Behavior

The web receiver currently supports:

- reading `setupToken` and `serverUrl` from the setup link
- exchanging the setup token for a receiver device token
- exchanging a setup code from the activation screen for a receiver device token
- storing the device token locally
- using the device token for local API calls
- returning to Setup Needed when the token is revoked
- showing clear setup states on the appliance activation screen

## Admin Boundary

Do not build heavy Connect Admin UI inside this prototype unless explicitly requested.

The future Admin surface should consume this area as `connect.provisioning`, alongside:

- `connect.audio`
- `connect.request_interpretation`
- `connect.interaction_traces`

The prototype may expose local data and route shapes to support that Admin work, but Admin navigation, root registry ownership, and durable configuration belong to the separated CP Pers/Admin effort.

## Known Prototype Limits

- Local prototype persistence only; provisioning state is stored in `local-trigger-server/data/connect-provisioning-state.json`.
- No production authentication.
- Setup codes are display aids, not independent exchange credentials.
- Device tokens are local prototype secrets.
- Audit events are persisted locally, but this is not a production durable audit log.
- No real QR encoding yet.
- Android receiver is intentionally unchanged in this pass.
