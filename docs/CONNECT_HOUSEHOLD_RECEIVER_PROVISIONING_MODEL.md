# Connect Household / Receiver / Provisioning Model

Last updated: 2026-07-04

This document clarifies the Connect household, Receiver, person, and provisioning model. It is intentionally separate from the AI Platform notes. It describes current implementation, gaps, and a proposed durable model.

## Design Goals

The Receiver should be:

- predictable
- appliance-like
- resilient
- recoverable
- person-scoped
- remotely manageable
- understandable by caregivers
- understandable by facility IT

The Receiver should feel like a configured care appliance, not a fragile browser tab. A caregiver should be able to understand which person it serves, whether it is healthy, what room it belongs in, and what to do if setup is stale or revoked. Facility IT should be able to understand the device posture without needing to understand CarePland product internals.

## Current Implementation Snapshot

Connect currently has three overlapping layers:

- CarePland Personal people: durable `care_subjects` rows, shown to users as Care VIPs or people.
- Connect context: `connect_settings.main_connect_user_person_id` and `connect_participants`, which choose which CarePland person is active for Connect.
- Receiver shell provisioning: `connect_receiver_devices` and `connect_receiver_claims`, which bind an installed Android Receiver APK to a server-side device record.

There is also older prototype language for `receiverHouseholds`, `receiverPeople`, and `receiverDevices`. That model still appears in prototype files and dashboard/provisioning types, but the durable Supabase Receiver shell model mostly uses Care Circle, Receiver device, location label, and `main_connect_user_person_id`.

## Definitions

### Household

A Household should mean the real-world home or care setting where one or more Receiver devices are used.

In the durable model, Household is not yet a first-class Supabase table for Connect Receiver. The closest existing durable concept is `care_circle_id`, which represents the broader CarePland care group/account context.

Proposed rule:

- Care Circle is the account/data ownership boundary.
- Household is a real-world deployment grouping inside a Care Circle.
- A Care Circle may eventually have multiple Households.
- For the current near-term model, a Receiver can be bound directly to a Care Circle and person without requiring a separate Household table.

Gap:

- Prototype `receiverHouseholdId` exists, but durable Receiver shell records do not yet have a real household table.

### Care VIP / Person

A Care VIP/person is an existing CarePland Personal person stored in `care_subjects`.

Connect does not currently create separate durable Connect-only people. `connect_participants.person_id` references `care_subjects.id`.

Current rules:

- Main Connect User must be an active CarePland person.
- Pets are excluded from Main Connect User selection.
- Connect eligibility can be narrower than all Care VIPs, through `connect_participants`.
- During setup, active Care VIPs may still be listed when participant rows do not exist yet.

Proposed rule:

- Receiver experiences should always resolve to a concrete `care_subjects.id`.
- “Everyone” is allowed in Personal/Home UI, but not as the active identity for a Receiver session unless a future multi-person Receiver mode is explicitly designed.

### Receiver Active Person

Receiver Active Person is the clearer internal concept for the person currently served by a bound Receiver.

It may map to the existing `main_connect_user_person_id` field, but the concepts are not identical:

- Main Connect User is the broader Connect context selected by a signed-in account or dashboard.
- Receiver Active Person is the concrete CarePland person a specific Receiver is currently serving.

Near-term implementation decision:

- Keep `main_connect_user_person_id` as the stored field for now.
- Use Receiver Active Person as the conceptual/documentation name.
- Rename the database field later only if the existing name causes real implementation or product confusion.

Rule:

- A Receiver always writes to one concrete CarePland person.
- Never to Everyone.
- Never to Household.
- Never to Care Circle.

Changing the Receiver Active Person changes the concrete person context for Talk, Today’s Focus, appointments, messages, calls, and pending reviews.

### Receiver Device

A Receiver device is an installed Receiver endpoint, usually the Android APK shell plus hosted Receiver web UI.

Current durable table: `connect_receiver_devices`.

Current fields include:

- `id`
- `status`: `setup_pending`, `claim_pending`, `bound`, `revoked`
- `receiver_install_id`
- `receiver_url`
- `care_circle_id`
- `main_connect_user_person_id`
- `location_label`
- hardware/profile fields
- local Receiver mode and native capability statuses
- last-seen and recovery facts

Proposed rule:

- A Receiver device is not a user account.
- A Receiver device is not a credential by itself.
- It is a server-side record for a physical or installed endpoint, authorized by a claim/binding process.

## Device Binding, Authorization, And Identity

These are separate concepts:

- Provisioning is not authorization.
- Authorization is not identity.
- Identity is not person context.

A Receiver is:

- not a user account
- not a credential by itself
- a bound appliance endpoint acting within server-defined permissions

Provisioning creates or updates the relationship between an installed endpoint and a server-side Receiver device record. Authorization determines what that bound endpoint is allowed to do. Identity describes the endpoint itself. Person context is the Receiver Active Person whose data and workflows the endpoint may access.

The server must remain authoritative for:

- whether a Receiver binding is valid
- whether a Receiver has been revoked
- which Care Circle owns the Receiver
- which person or approved person list the Receiver may serve
- which actions the Receiver may perform

Local APK state may help recover and relaunch, but it should not grant authority by itself.

## Relationship Rules

### Can One Household Have Multiple Receivers?

Yes.

Example:

- Kitchen Receiver
- Bedroom Receiver
- Living Room Receiver

Each should have its own `connect_receiver_devices` row, location label, status, hardware profile, and last-seen state.

Near-term implementation can model this under one Care Circle without a separate durable Household table.

### Can One Receiver Serve Multiple People?

Not in the current durable behavior.

Current Receiver data paths expect one active `mainConnectUserPersonId` / `personId` for messages, calls, appointments, Talk, and Today’s Focus.

Proposed near-term rule:

- One Receiver serves one Receiver Active Person at a time.
- A Receiver may be re-bound, reconfigured, or allowed to switch among explicitly approved Care VIPs.
- Multiple selectable Care VIPs are controlled switching, not simultaneous multi-person mode.
- Multi-person simultaneous mode should be a later explicit feature, not an accidental result of “Everyone” focus.

Future option:

- A shared-area Receiver could support multiple eligible people, but all person-scoped actions would need an explicit person choice or a deterministic household default.

### Controlled Care VIP Switching

Future v1.5 rule:

- A Receiver may allow switching the Receiver Active Person, but only among Care VIPs explicitly approved for that Receiver by Care Coordinator/Profile settings.

V1 default:

- A Receiver serves only the bound Receiver Active Person.
- Approved Care VIP switching is deferred until the single-person appliance model is stable.
- If eligibility is added later, it should be stored server-side, not in local device state.
- A future table could look like `connect_receiver_person_eligibility`.

UX idea:

- The current person name on the Receiver may be encapsulated as a button.
- Tapping it opens a simple Care VIP selector.
- Selecting a different approved Care VIP changes the Receiver Active Person.

Important rules:

- This is not Everyone mode.
- It does not commingle data.
- Every action remains person-scoped.
- Switching person changes the concrete person context for Talk, Today’s Focus, appointments, messages, calls, and pending reviews.
- The selectable list is limited by coordinator-approved Receiver eligibility.
- Person changes should be audited.
- Local cached person-specific state should be cleared or reloaded after switching.

Default behavior remains: one Receiver serves one active person at a time.

### What Is The Main Connect User?

The Main Connect User is the CarePland person whose Connect world is active.

It is not necessarily the signed-in account owner.

Current durable field:

- `connect_settings.main_connect_user_person_id`

Receiver devices also have:

- `connect_receiver_devices.main_connect_user_person_id`

Proposed rule:

- For dashboard/web Connect, Main Connect User can follow the signed-in user's selected Connect context.
- For a bound Receiver, Main Connect User should be stored on the Receiver device record, so the appliance can load the correct person without depending on a human browser login session.

Gap:

- The Receiver web UI currently still tries to load person-scoped APIs using Supabase browser auth headers. A dedicated appliance needs a bound-device authorization path.

### What Happens When Global Focus Is Everyone?

Current Personal/Home behavior supports Everyone for overview surfaces.

Proposed Connect rule:

- Everyone is a dashboard/account-level viewing mode.
- Everyone is not a Receiver identity.
- If global focus is Everyone, Connect should fall back to:
  - the saved Main Connect User, or
  - the Receiver device's bound person, or
  - a setup-required state if neither exists.

Receiver actions should never write Talk, Today’s Focus, calls, or messages to Everyone.

## Provisioning Model

Provisioning is not static. It is a lifecycle.

Provisioning begins before an APK is installed, continues through claim approval and device binding, and remains active through health checks, recovery, revocation, and reprovisioning. A Receiver should never assume that yesterday's provisioning state is still valid without checking server authority.

### Current Flow

The current Receiver path uses compatible setup paths. The normal browser path is Receiver-generated pairing from the web Receiver itself:

1. Unpaired browser Receiver at `/connect/receiver` creates a browser-local receiver install id and starts a short-lived pairing session through `/api/connect/receiver-shell/pairing-sessions`.
2. Receiver displays a six-digit code such as `123 456`.
3. Signed-in caregiver/admin opens Connect -> Receiver -> Pair Receiver and enters the code.
4. The in-app Pair Receiver flow calls `/api/connect/receiver-shell/pairing-sessions/pair`, binding the Receiver to the currently selected Main Connect User / Receiver Active Person.
5. Receiver polls pairing status, receives the internal app claim once paired, redeems it, stores the bound receiver-device identity locally, and continues as the paired Receiver.

The Android APK uses the same pairing-session API and claim/redeem internals, but the browser Receiver path does not depend on APK behavior. `/connect/receiver/setup` remains available for direct/public setup links and install-oriented flows; it should not be the required path when the caregiver is already in the signed-in Connect app.
6. Server marks the device as bound.
7. Receiver heartbeats through `/api/connect/receiver-shell/devices/binding`.

The compatibility/dashboard-created setup path still exists:

1. Authenticated dashboard/setup flow creates a short-lived setup code through `/api/connect/provisioning/receiver-devices/:receiverDeviceId/setup-token`.
2. The typed setup link `/r/<setup-code>` opens `/connect/receiver/setup?code=<setup-code>`.
3. Advanced/local setup can exchange the existing setup code for a short-lived app claim through `/api/connect/receiver-shell/claims`.

Important current limitation:

- Prototype setup code `12345` and a fixed local-dev device id still exist for local/dev fallback only.
- Durable household assignment is not fully modeled yet, but setup-token creation now carries the selected Care Circle/person into the claim/device path where available.

### Proposed Durable Binding

Provisioning should bind:

```text
installed APK
  -> receiver_install_id
  -> connect_receiver_devices.id
  -> care_circle_id
  -> main_connect_user_person_id
  -> optional household/location
```

The claim should be short-lived and single-use. It should never be a permanent account credential.

The device should receive enough durable binding information to prove:

- this install matches the server device record
- the device has not been revoked
- which Care Circle it belongs to
- which person it serves
- which Receiver URL/profile/layout to use

### Receiver Lifecycle / State Machine

Representative Receiver states:

- Factory / uninstalled: no APK, no local install id, no server-bound endpoint.
- Installed: APK exists, but local setup or server claim may not be complete.
- Setup pending: device has started setup but does not yet have a valid claim/binding.
- Claim pending: server has issued or expects a short-lived claim, but the installed app has not completed binding.
- Bound: install id and Receiver device id match an active server-side device record.
- Healthy: bound Receiver has recently checked in and its required capabilities are acceptable for its mode.
- Offline: bound Receiver has not checked in recently or cannot reach the Receiver page/server.
- Recovered: Receiver reopened after boot, app update, power connection, crash, or temporary server/page failure.
- Revoked: server has invalidated the binding; the Receiver must stop showing person data and return to setup.
- Reprovisioned: Receiver has been moved to a new claim/binding/person/location/profile after an intentional setup action.

State transitions should be auditable where they affect server-side authority or person context.

Examples:

- Factory / uninstalled -> Installed: APK installation.
- Installed -> Setup pending: first launch without a valid claim.
- Setup pending -> Claim pending: authorized setup creates a claim.
- Claim pending -> Bound: APK redeems claim with matching install id.
- Bound -> Healthy: binding heartbeat succeeds.
- Healthy -> Offline: heartbeats stop or Receiver page cannot load.
- Offline -> Recovered: native shell relaunches/retries and the Receiver becomes reachable again.
- Bound/Healthy/Offline -> Revoked: admin/caregiver revokes the Receiver.
- Revoked -> Reprovisioned: a new authorized setup flow binds the endpoint again.

### Moving A Receiver

Moving rooms:

- Update `location_label`.
- Keep the same device id and person binding.
- Audit the change.

Moving people:

- Change the Receiver Active Person, currently likely represented by `main_connect_user_person_id`.
- Confirm the target person is active, eligible, and in the same accessible Care Circle.
- Clear or review person-specific local cached state.
- Audit the change.

Moving households:

- If future Household table exists, update household assignment.
- If moving across Care Circles, require re-provisioning or admin-level reassignment.
- Clear old person binding unless explicitly reselected.
- Audit the change.

Moving to a different account/Care Circle:

- Treat as re-provisioning.
- Revoke old binding or mark transferred.
- Require a new short-lived claim from an authorized user.

## Dedicated vs Personal Mode

Receiver mode is local-first device configuration, currently stored in the Android shell and mirrored to `connect_receiver_devices.receiver_mode`.

### Dedicated Receiver

Dedicated mode means the device is primarily for CarePland Receiver.

Behavior differences:

- starts directly into CarePland when possible
- can reopen after restart/app update/power connection
- uses keep-awake/full-screen appliance behavior
- may use Device Owner / lock-task mode where supported
- reports native capabilities and recovery status
- minimizes accidental exits

Dedicated mode does not currently guarantee silent APK self-updates. Update behavior is advisory unless a managed installer path is added later.

### Personal Device

Personal mode means CarePland runs like a normal app.

Behavior differences:

- no aggressive auto-launch behavior
- app can be closed like any other app
- reminders/calls may be affected by Android settings, other apps, and battery behavior
- suitable for a personal phone or tablet

## Local vs Server-Side Storage

### Stored Locally On Device

Current/proposed local items:

- `receiver_install_id`
- selected `receiver_mode`
- provisioning completion timestamp
- capability statuses
- Receiver URL
- current receiver device id/binding hints
- last recovery facts
- native hardware facts
- non-secret UI/profile preferences

Local data should be treated as hints and cached setup state, not authority.

### Stored Server-Side

Current/proposed server authority:

- device id
- device status: setup pending, claim pending, bound, revoked
- Care Circle binding
- active person binding
- location label
- hardware profile / UI layout
- receiver mode mirror
- capability status mirror
- last seen
- revocation status
- claim issuance/redeem status
- audit events

Server-side binding wins over stale local state.

## Stale Or Revoked Provisioning

Current behavior:

- Binding heartbeat rejects missing, incomplete, mismatched, or revoked device bindings.
- Revocation sets device status to `revoked` and revokes related claims.

Proposed Receiver behavior:

- If binding is revoked, stop showing person data.
- Show a simple local message: “This Receiver needs setup.”
- Offer a setup/provisioning path, not a broken Receiver page.
- Clear local binding hints only after the server explicitly rejects the binding as revoked, not for temporary network failure.

Temporary outage:

- Keep the Receiver usable in a limited local/fallback state.
- Retry automatically.
- Do not erase provisioning.

Stale person binding:

- If the person is inactive, inaccessible, or removed from Connect eligibility, the Receiver should stop loading that person’s data and require admin/caregiver attention.

## Permissions For Calls, Messages, And Audio

Current account-backed routes verify a signed-in user can access the person.

Receiver appliance gap:

- A bound Receiver should not depend on a signed-in Supabase browser session.
- It needs a server-side device authorization path for the specific bound person.

Bound Receiver Authorization v1:

- A provisioned Receiver may present `receiverDeviceId` plus `receiverInstallId` as device/session proof.
- The server verifies that proof against `connect_receiver_devices`.
- The server resolves the Receiver Active Person from `connect_receiver_devices.main_connect_user_person_id`.
- The server resolves the Care Circle from the bound Receiver device record.
- If a Receiver request includes a `personId`, it must match the server-resolved Receiver Active Person.
- Revoked, incomplete, missing, or stale bindings return a setup-required response instead of falling back to arbitrary person access.
- Dashboard/coordinator users continue to use normal signed-in user permissions.

Proposed rule:

- A bound Receiver can read/write only for its Receiver Active Person.
- A bound Receiver cannot switch people unless the server device record or coordinator-approved eligibility list allows it.
- Dashboard/coordinator users continue to use normal signed-in user permissions.

Receiver device permissions should cover:

- implemented in v1: writing Talk-derived Track events for the bound person
- implemented in v1: reading/completing Today’s Focus for the bound person
- implemented in v1: saving Today’s Focus cadence/preference actions for the bound person
- implemented in v1: reading upcoming appointments for the bound person
- implemented in v1: reading calls, answering/ending calls, and approving/saving pending call summaries for the bound person
- implemented in v1: reading incoming messages for the bound person
- implemented in v1: sending messages from the Receiver for its bound person
- implemented in v1: message read/dismissed state for the bound person
- implemented in v1: audio playback events, transcription requests, person-scoped audio profile/review/artifact views, and audio diagnostics for the bound person
- implemented in v1: Receiver cleaning sessions as device-scoped appliance telemetry

Receiver-facing API classification:

- Person-scoped and migrated to Bound Receiver Authorization v1: Talk, Today’s Focus fetch/complete, Today’s Focus preferences, appointments, messages, message state, calls, call state, call summaries/review, call events, call signals, call transcript chunks, and person-scoped audio profile/review/artifact/transcription/playback routes.
- Device-scoped and migrated to bound device verification: Receiver cleaning sessions.
- Public/static or provisioning-scoped and intentionally not migrated: APK download, update-policy, QR/setup page rendering, claim creation/redeem/binding checks, and static Receiver shell assets. These routes either already use claim/binding semantics or must remain reachable before the Receiver is bound.
- Admin/prototype/maintenance and intentionally not migrated: broad audio maintenance proxies, pending transcription maintenance, prototype artifact transcription jobs, and admin-oriented diagnostic routes.
- Static media and intentionally skipped for this pass: audio media serving by storage key. It is not currently person-addressed in the request. Future hardening should prefer signed URLs or a person/device-scoped media authorization boundary without changing Receiver playback behavior.
- Receiver guide is intentionally skipped for this pass. It is currently a local/dev coordination surface rather than a person-scoped appliance API; a production remote-guide workflow should get explicit admin/device authorization before it is exposed broadly.

## Person-Scoped Product Behavior

### Pending Reviews

Pending call summary reviews are person-scoped through `mainConnectUserPersonId` or `recipientPersonId`.

Rule:

- A Receiver shows pending reviews only for its Receiver Active Person.

Future integration point:

- Work Events introduces `call_summary_prepared`, but call-summary approval does not need to write Work Events immediately.
- The likely future boundary is: once a call summary is generated/prepared for review, CarePland may record a source-traceable Work Event.
- Do not wire every call-summary action into Work Events until the workflow and review semantics are stable.

### Talk

Talk currently requires `personId`, loads that person's active Focus items and upcoming appointments, and writes Track Events to that person.

Rule:

- Talk is always person-scoped.
- Talk should use the Receiver Active Person by default.
- Talk should not write to Everyone.
- Talk should not write to Household.
- Talk should not write to Care Circle.

### Today’s Focus

Today’s Focus is stored in `focus_items` and completed through `track_events`.

Current Receiver behavior:

- Fetches active focus items for a concrete person.
- Filters out appointment reminders from Focus display.
- Completion writes a `track_events` row for that person.

Rule:

- Today’s Focus is person-scoped.
- Receiver Today’s Focus should use the Receiver Active Person.
- Appointment reminders should stay separate from Focus.

### Calls

Calls are filtered by `mainConnectUserPersonId` / `recipientPersonId`.

Rule:

- Receiver calls belong to the Receiver Active Person.
- Coordinator/dashboard calls may originate from a signed-in user, but the Receiver side should remain bound-person scoped.

### Messages

Messages are filtered by `mainConnectUserPersonId`.

Current gap:

- Message storage is still local/prototype-heavy compared with device provisioning and calls.

Rule:

- Receiver messages belong to the Receiver Active Person.
- Message sending from Receiver should be authorized by device binding plus allowed contacts, not broad account auth.

### Appointments

Appointments are fetched by `care_subject_id`.

Rule:

- Receiver appointment panel shows upcoming appointments for the Receiver Active Person only.
- Everyone/global dashboard behavior should not leak into Receiver appointment display.

## Gap Analysis

### Clear / Mostly Stable

- Care VIP/person should be an existing `care_subjects` row.
- Main Connect User is a person, not the account owner.
- Receiver devices have a durable Supabase table.
- Receiver claims are short-lived and not permanent credentials.
- Receiver mode (`dedicated` / `personal`) is local-first and mirrored server-side.
- Today’s Focus, Talk, appointments, calls, and messages are intended to be person-scoped.
- Receiver Active Person is the correct conceptual target for Receiver-scoped work, even if current fields still use `main_connect_user_person_id`.
- `main_connect_user_person_id` remains acceptable as the storage field for now.
- Bound Receiver Authorization v1 is the highest-leverage unresolved item for the appliance model.

### Ambiguous / Needs Decision

- Whether Household should become a durable table or remain represented by Care Circle plus location labels for now.
- Whether controlled Care VIP switching should be surfaced in v1.5 on the Receiver itself, in caregiver settings only, or both.
- Whether Receiver person changes are a simple device setting or a full re-provisioning event.
- How Connect participants should be managed as a user-facing/admin workflow.

### Implementation Gaps

- Bound Receiver device authorization now covers the core Receiver-facing person-scoped routes, but route coverage should keep being audited as new Receiver APIs are added.
- Claim creation now has a signed-in setup-token path that binds a setup session to a selected Care Circle/person where available; the broader durable household model is still intentionally narrow.
- Claim creation does not yet define an approved person list for controlled Receiver Active Person switching; this can wait until v1.5.
- Prototype setup code `12345` and local-dev device id still exist for local/dev fallback only.
- Message storage is still less mature than provisioning and calls, although Receiver-facing message access now uses the shared bound-device authorization path.
- Household exists in prototype types/state but not as a durable Connect table.
- Receiver stale/revoked handling exists at heartbeat level but needs a complete user-facing appliance recovery flow.
- Device/profile status is captured, but admin-facing reassignment workflows are still thin.

## Proposed Near-Term Model

For the next implementation phase, keep the model intentionally narrow:

1. A Receiver belongs to one Care Circle.
2. A Receiver serves one Receiver Active Person at a time.
3. A Receiver may have a location label.
4. Household is deferred unless multiple real households per Care Circle become necessary.
5. Dedicated vs Personal changes device behavior, not data ownership.
6. Server-side Receiver device binding is authoritative.
7. Local device state is recovery/setup cache only.
8. Everyone/global focus never becomes a Receiver write target.
9. Revoke means the Receiver stops showing person data and returns to setup.
10. Moving a Receiver to a different person or Care Circle is an audited admin/setup action.
11. Controlled Care VIP switching is v1.5; v1 serves only the bound Receiver Active Person.
12. Receiver lifecycle state should be treated as ongoing operational state, not one-time setup.

## Recommended Next Architecture Work

Current implementation status:

- Bound Receiver Authorization v1 exists as a shared server helper.
- Published setup can create short-lived, typeable setup codes from the signed-in Connect Dashboard path. The setup page exchanges only existing available codes for native claims; `12345` is no longer the normal published provisioning path.
- Migrated person-scoped Receiver routes include Talk, Today’s Focus, Today’s Focus preferences, appointments, messages, message state, calls, call state, call summary review, call events, call signals, call transcript chunks, and person-scoped audio profile/review/artifact/transcription/playback endpoints.
- Migrated device-scoped Receiver routes include cleaning sessions.
- The hosted Receiver web component sends Receiver device credentials with API calls when a native shell or stored binding provides them.
- This is device-bound authorization only; it does not make the Receiver a user account.

Highest priority:

- Keep `connect_receiver_devices.main_connect_user_person_id` as the Receiver Active Person source of truth for now.
- During setup-token creation, require/select the Care Circle and initial Receiver Active Person.
- Keep new Receiver-facing person-scoped APIs on the same device-bound authorization helper by default.
- Add admin UI to revoke/reassign Receiver devices.

Then:

- Continue hardening durable short setup phrases/codes, including admin visibility, expiration/reissue UX, and audit events.
- Decide whether Household deserves a durable table.
- Move messages to a durable, person-scoped server model.
- Add audit events for binding, revoke, Receiver Active Person change, location change, lifecycle recovery, and mode change.
- Treat `call_summary_prepared` Work Events as a future integration point, not a required part of the current call-summary approval flow.

Later:

- Add server-side Receiver eligibility for controlled Care VIP switching, likely through a table such as `connect_receiver_person_eligibility`.
- Decide whether controlled switching belongs on the Receiver itself, in caregiver settings only, or both.

## Working Product Language

Use these terms in user-facing setup:

- CarePland Receiver
- Dedicated CarePland Device
- Install as a regular app
- Person using this Receiver
- Room or location
- Setup code
- This Receiver needs setup

Avoid exposing these terms to normal users unless needed:

- `care_circle_id`
- `main_connect_user_person_id`
- claim
- binding
- Receiver install id
- device owner
- lock task
