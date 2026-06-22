# AdminRoot Registry

`app/admin/AdminRoot.tsx` is the Admin product entry point. It currently wraps the legacy shared runtime, but new Admin-facing product concepts should register against the AdminRoot model instead of reaching into Personal route state.

## Registry

Use `app/admin/adminProductSurfaces.ts` for product and area metadata.

- `personal`: support, AI ops, users, product
- `family`: households, shared care
- `connect`: provisioning, users, households, devices, audio, request interpretation, interaction traces

Connect branches should prefer these area keys:

- `connect.provisioning`: setup links, activation, consent, identity-link review, provisioning events
- `connect.users`: Connect receiver users, active/inactive lifecycle, identity links, product membership
- `connect.households`: receiver households, active/inactive lifecycle, membership, plan context
- `connect.devices`: receiver devices, assignment, setup state, activity, provisioning health
- `connect.audio`: audio user profiles, clarity, sound checks, device sound help, feedback summaries
- `connect.request_interpretation`: receiver request interpreter prompts/review
- `connect.interaction_traces`: durable `ConnectAskInteraction` trails and child recovery/escalation/outcome events

## Panel Registration

Add planned or active Admin panels to `adminPanelRegistrations` with:

- `productKey`
- `areaKey`
- `key`
- `label`
- `description`
- `owner`
- `status`

Panel keys should be stable dotted identifiers, for example:

- `connect.audio.profile`
- `connect.users.registry`
- `connect.provisioning.households`
- `connect.devices.registry`
- `connect.ask.interactions`

`connect.audio.profile` represents the Audio > Users profile surface for Connect-specific hearing feedback, playback preferences, EQ/normalization, and clarity summaries.

## Shape Guidance

Do not assume 1:1 relationships. Prefer parent trail records plus child event records:

- one receiver can belong to a household
- one household can have multiple admins
- one receiver can have multiple devices
- one care circle can have multiple participants
- one Connect interaction can have multiple recovery, escalation, or follow-up events

Connect receiver household/user lifecycle records such as create, deactivate,
restore, setup tokens, and identity-link review are Admin concerns, not ordinary
receiver end-user settings. Keep Connect-specific users, households, and devices
in the Connect Admin surface while the product is its own platform. Do not fold
these into Global Users unless the operation is truly cross-product account
administration.

For Connect Ask, `ConnectAskInteraction` should be the durable parent trail. `AskRecovery` should be a child or related event, not the whole story.

## Current Entitlement Assumption

For the current build, `early_access` is the single tier that should allow
access to both CarePland Personal and CarePland Connect. Dedicated Connect
tiers do not exist yet, and no determination has been made about whether any
existing Personal tiers should exclude Connect. Model Connect eligibility as a
product entitlement/capability decision, not as an inherent property of a
Personal account, Care VIP, or receiver household.

Personal and Connect should be able to run concurrently for the same signed-in
user when the tier allows it. Navigation between the products may be exposed by
top-level app buttons, but backend relationships should remain explicit:
Connect receiver users, households, devices, and setup links are Connect-owned;
links to `profiles`, `care_subjects`, care circles, and plan entitlements should
be represented as links or eligibility context rather than assumed 1:1 joins.
