# CarePland Modularization Tracker

This tracker is for the `carepland-all` working copy. The goal is one CarePland
codebase with separate product modules and shared platform services.

## North Star

CarePland Connect is a separate product module using shared CarePland
infrastructure.

Connect should share auth, platform services, admin shell, UI primitives,
logging, permissions, household/person/contact concepts, and entitlement checks
where appropriate. Connect should not depend on CarePland Personal appointment,
CarePrep, Visit Notes, Health Focus, or provider-specific features.

## Current Working Repos

- Platform working copy: `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all`
- Original Personal copy: historical `carepland-pers` source copy
- Current Family parallel app: historical `carepland-family` source copy
- Current Connect prototype/static app:
  `/Users/agoodloe/Documents/Codex/2026-06-13/files-mentioned-by-the-user-pasted/outputs/carepland-connect`
- Current Connect prototype route:
  `http://localhost:4174/index.html`

## Product Boundary

- `personal`: appointment memory, Visit Notes, CarePrep, Health Focus, reports,
  Personal Ask, profile/onboarding surfaces tied to Personal use.
- `connect`: receiver/coordinator experience, receiver households, receiver
  people, receiver devices, setup/provisioning, receiver messages, audio,
  receiver theme, interaction traces, Connect request interpretation.
- `family`: operational care coordination across people, including errands,
  ownership/coverage, concerns, essentials, SMS intake/workflows, and
  accountable task state.
- `admin`: shared operational/admin shell with product-aware surfaces.
- `platform`: auth, Supabase/env, entitlements, logging/audit primitives,
  permissions, shared account/profile/contact/household concepts.

## Current State

- `app/CarePlandApp.tsx` has been renamed to `app/CarePlandPers.tsx`.
- `app/page.tsx` now imports and renders `CarePlandPers`.
- `app/admin/LegacyAdminRuntimeBridge.tsx` still bridges Admin into
  `CarePlandPers` while auth/session/admin runtime state remains there.
- `app/admin` already acts like a shared Admin entry point.
- `docs/ADMIN_ROOT_REGISTRY.md` already defines product-aware Admin areas for
  Personal, Family, and Connect.
- `app/connect/page.tsx` is currently a public Connect marketing route, not the
  operational receiver/dashboard app.
- `app/components/admin/AdminConnectPanel.tsx` already talks to the Connect
  prototype server on `http://localhost:8790`.
- The operational Connect prototype currently lives outside the Next app as
  static HTML/JS plus `local-trigger-server`.
- `app/components` now has first-pass ownership folders for Admin, Connect,
  Personal, public, and shared components.
- `app/lib/platform/server` now owns server env and Supabase client helpers.
- `app/lib/connect` and `app/lib/personal` landing zones exist.
- Personal Health Focus, profile, and reports libraries now live under
  `app/lib/personal`.
- Personal Ask, Home Context, appointment import, editor-state, and
  unsaved-change helpers now live under `app/lib/personal`.
- Shared platform helpers now live under `app/lib/platform` for AI usage costs,
  app content config, pricing/entitlements, session settings, Places
  integration, env, and Supabase clients.
- Admin contact detail helpers now live under `app/lib/admin`.
- Shared UI style constants now live under `app/components/shared`.
- Connect prototype source reference has been copied to
  `docs/reference/connect-prototype` without `node_modules`, uploads, logs, or
  generated Android build output.
- Connect prototype route contracts are inventoried in
  `docs/CONNECT_PROTOTYPE_CONTRACTS.md`.
- Admin Connect prototype endpoint access is centralized in
  `app/lib/connect/prototypeClient.ts`; Admin panels no longer construct
  `localhost:8790` URLs directly.
- First operational Connect module route exists at `/connect/dashboard`, backed
  by the current Connect prototype contracts through `app/lib/connect`.
- Family existed as a separate clean parallel Next app before its namespaced
  modules were copied into this consolidated working copy.
- Family already uses the desired product namespace shape internally:
  `app/family`, `app/components/family`, `app/lib/family`, and
  `app/api/family`.
- Family duplicates thin platform/shared helpers today: `app/lib/server/env.ts`,
  `app/lib/server/supabase.ts`, and `app/lib/uiStyles.ts`. These should map to
  `carepland-all` platform/shared modules during merge rather than being copied
  as second versions.

## Sticky Dependencies To Watch

- `CarePlandPers` still owns shared auth/session/admin runtime state.
- Admin is product-aware in shape, but some Admin runtime data still comes from
  Personal state.
- `AdminConnectPanel` depends on hardcoded local Connect endpoints and the
  hardcoded `living-room-receiver` receiver id.
- The Connect prototype local server reads from a Pers env path, which is a sign
  of platform dependency without a real platform boundary.
- The Connect prototype uses direct DOM/state patterns that should not be copied
  wholesale into React/Next.
- Connect data is currently file/in-memory prototype state, not Supabase-backed
  platform data.
- Family should preserve its operational workflow boundary and should not be
  collapsed into Personal appointment state. Appointment coverage may later
  reuse Family workflow patterns, but Family should not depend on Personal
  appointment implementation while merging.
- Family currently has standalone app-level pages (`app/page.tsx`,
  `app/login/page.tsx`, `app/profile/page.tsx`) that should not be copied over
  wholesale. Bring over the Family route module and adapters instead.
- Personal feature code is still concentrated in the large `CarePlandPers`
  runtime.
- `CarePlandPers` still imports across Personal, Admin, platform, and shared UI
  boundaries while the large runtime remains intact.

## Proposed Landing Zones

Use these as staging destinations as code moves:

```text
app/
  admin/
  connect/
    page.tsx
    receiver/
    dashboard/
  family/
    page.tsx
    errands/
    sms-simulator/
  components/
    admin/
    connect/
    family/
    personal/
    shared/
  lib/
    admin/
    connect/
      audio/
      provisioning/
      receiver/
      messaging/
      theme/
    family/
      audit/
      concerns/
      errands/
      sms/
      tasks/
    personal/
    platform/
      auth/
      entitlements/
      logging/
      permissions/
      supabase/
```

Do not make this tree perfect before moving code. Use it to create clear
landing zones and avoid letting Connect enter through Personal appointment
runtime.

## Safe First Operations

- Keep `app/admin` as shared Admin.
- Keep `CarePlandPers` working while gradually extracting platform services.
- Add `app/lib/platform` for env/Supabase/auth/permission/entitlement helpers.
- Add `app/lib/connect` and `app/components/connect` before importing prototype
  behavior.
- Copy Connect prototype files as reference/staging, then convert into React,
  typed service modules, and Next API routes gradually.
- Preserve the current prototype server until each contract has a replacement.
- Split component folders by obvious ownership before doing deeper runtime
  extraction.
- Merge Family by copying its namespaced product folders first:
  `app/family`, `app/components/family`, `app/lib/family`, and
  `app/api/family`.
- During Family merge, rewrite imports to use
  `app/components/shared/uiStyles.ts` and `app/lib/platform/server/*` instead
  of introducing duplicate `app/lib/uiStyles.ts` or `app/lib/server/*`.

## Component Separation Map

`app/components` has been split into first-pass ownership folders. Treat this
as a working boundary, not a final design system.

Personal-owned:

- `AppointmentViewToolbar.tsx`
- `HomeContextPanel.tsx`
- `HomeNextAppointmentPanel.tsx`
- `OnboardingGate.tsx`
- `PersonalOverlays.tsx`
- `WelcomeGuide.tsx`
- `healthTopics/*`
- `profile/*`

Public/marketing:

- `PublicWebsite.tsx`
- `CarePlandConnectWebsite.tsx`
- `UserFacingFooter.tsx` if it remains public-site/app-shell shared

Shared UI or platform shell:

- `InlineConfirmation.tsx`
- `icons.tsx`
- `AuthGatewayPanel.tsx`
- `PasswordUpdatePanel.tsx`

Admin/shared Admin:

- `admin/*`
- `AgentKnowledgeProposalsPanel.tsx` now lives under `components/admin`.
- `AIReviewBadge.tsx` now lives under `components/shared/ai`.

Current target shape:

```text
app/components/
  admin/
  connect/
  personal/
    appointments/
    healthTopics/
    home/
    onboarding/
    profile/
  public/
  shared/
```

Safe early component moves:

- Done: `CarePlandConnectWebsite.tsx` moved to `app/components/connect`.
- Done: `PublicWebsite.tsx` and `UserFacingFooter.tsx` moved to
  `app/components/public`.
- Done: `AgentKnowledgeProposalsPanel.tsx` moved to `app/components/admin`.
- Done: `InlineConfirmation.tsx`, `icons.tsx`, `AuthGatewayPanel.tsx`, and
  `PasswordUpdatePanel.tsx` moved to `app/components/shared`.

Defer or move carefully:

- `HomeContextPanel` has type imports from `app/lib/ask`; moving it requires
  updating those imports.
- `OnboardingGate` imports profile draft types and profile form components.
- `PersonalOverlays` imports `InlineConfirmation`.
- `AIReviewBadge` is cross-surface; decide whether it is shared UI or
  Admin/review domain before moving.

## Avoid For Now

- Do not fold Connect receiver households/devices/users into Personal Care VIPs
  or appointment data.
- Do not make Connect depend on CarePrep, Visit Notes, Health Focus, or Personal
  appointment route state.
- Do not copy `app.js` directly into a Next route as permanent architecture.
- Do not deeply split `CarePlandPers` before there is a concrete dependency that
  needs to move.
- Do not remove the local Connect prototype server until Admin and receiver
  routes have replacement contracts.

## Migration Checklist

- [x] Create `carepland-all` as the merge working copy.
- [x] Rename `CarePlandApp` runtime to `CarePlandPers`.
- [x] Create platform landing zones under `app/lib/platform`.
- [x] Identify lowest-risk shared helpers to move first.
- [x] Create Connect landing zones under `app/lib/connect` and
  `app/components/connect`.
- [x] Split obvious component folders: `components/personal`,
  `components/public`, `components/shared`, and `components/connect`.
- [x] Inventory Connect prototype contracts by area: provisioning, calls,
  messages, audio, theme, care circle, SMS.
- [x] Copy Connect prototype shared files into a staging/reference area.
- [x] Build the first Next Connect operational route, likely
  `/connect/receiver` or `/connect/dashboard`.
- [x] Replace hardcoded `localhost:8790` calls with a module-level Connect API
  client.
- [x] Identify Family as a third product module candidate and inventory its
  clean namespace shape.
- [x] Copy Family namespaced route/component/lib/API modules into
  `carepland-all`.
- [x] Rewrite Family shared imports to platform/shared modules.
- [ ] Move one Connect contract at a time from prototype server to platform
  services.
- [ ] Add Supabase schema/RLS only after the domain boundary is stable enough to
  model.

## Contract Inventory Seed

Current prototype server contract areas:

- Health/static: `/health`, `/`, `/index.html`
- Personal bridge: `/personal/appointments/upcoming`
- Receiver registry: `/receivers`, `/receivers/register`,
  `/receivers/:receiverId/events`, `/receivers/:receiverId/ui-state`
- Receiver devices: `/receiver-devices`, setup token, revoke, household
  assignment endpoints
- Connect provisioning: `/connect/provisioning`, households, receiver people,
  receiver devices, setup tokens, audit events
- Care circles: `/care-circles`, member views, connections, receiver settings
- Calls: `/call`, `/calls`, `/calls/:callId`, `/calls/:callId/state`
- Messages: `/messages`, `/messages/:messageId/state`
- Theme: `/connect/theme`
- Audio: transcription, artifacts, timelines, hearing feedback, enhancement
  events, domain model, catalogs, review bundle, maintenance preview
- SMS participant: `/sms/participant/messages`, `/sms/participant/inbound`

## Open Questions

- Should public Connect marketing remain at `/connect`, with the operational app
  under `/connect/receiver` and `/connect/dashboard`?
- What is the first real Connect identity link: signed-in coordinator, receiver
  person, receiver household, or device setup token?
- Does `early_access` remain the only shared entitlement during the first merge?
- Which Connect data should become durable first: provisioning, messages, audio,
  calls, or theme?
- Should Connect Admin continue to read prototype endpoints during the first
  Next route migration?
