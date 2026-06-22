# CarePland App Audit: Personal, Connect, Admin, Shared Ask

Date: June 20, 2026

Scope: Appointments / Personal, Connect, Admin, shared navigation, shared layout, and shared Ask.

Excluded from this pass:

- Family.
- The active effort to link Connect people to CarePland Personal users and enrich those profiles with Connect-specific identifiers.
- The active Connect audio build-out. Audio is referenced only where UI wiring or product expectations affect non-audio surfaces.

This audit is intentionally a restoration inventory, not a redesign plan.

## Critical Issues

### Shared Ask Is Only Partly Shared

Severity: Critical

Area: Shared Ask / Connect / Personal

Current behavior: Personal has a mature Ask overlay. Connect has Ask entry points, but the shared top navigation still defaults Ask to `/?personal=1&ask=1`, and Connect-specific Ask behavior is not reliably exposed as the same platform Ask surface. The API has some Connect-context detection, but several prompt labels and fallback paths still refer to "CarePland Personal Ask."

Expected behavior: Ask should be a shared CarePland surface. Launching Ask from Connect should open the same Ask experience and submit `currentPage` / module context as Connect, including selected person, receiver status, active tab, recent call/message state, and relevant setup context.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/shared/CarePlandTopNav.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/CarePlandPers.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/personal/PersonalOverlays.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/api/ask/route.ts`

Recommended fix approach: Extract or route to one shared Ask shell, keep Personal and Connect context builders separate, and remove Personal-specific defaults from shared navigation. Update API-facing labels so the platform layer is "CarePland Ask" while module context drives the response.

### Guide Mode Loop Is Not Yet Product-Trustworthy

Severity: Critical

Area: Connect Receiver / Connect Dashboard / Guide Mode

Current behavior: The integrated code has guide target storage, guide CSS, red outlines, and receiver-side styling. The old prototype behavior, however, depends on a precise cross-device loop: the coordinator clicks the actual preview UI, the same red highlight and dimmed state appears on Mom's receiver, and Mom remains in control. This needs to be treated as a product behavior, not a visual overlay.

Expected behavior: Guide Mode should be "what you see is what they see." It should not use a separate guide button panel. The chosen UI target should appear on both coordinator preview and receiver. The receiver user's click should clear the highlight and report whether they chose the intended target.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.module.css`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/api/connect`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/docs/reference/connect-prototype/local-trigger-server/server.js`

Recommended fix approach: Promote Guide Mode to an explicit small state machine with stable target IDs shared by dashboard preview and receiver. Keep the existing merged module structure, but add verification around target selection, receiver acknowledgement, wrong-button feedback, and clearing behavior.

### Receiver Appliance Behavior Remains Fragile

Severity: Critical

Area: Connect Receiver UI

Current behavior: The receiver now has a fixed appliance canvas and scale variables, but several modals and message layouts have shown local distortion, over-pagination, clipping, or too much unused space under different window sizes and browser zoom states.

Expected behavior: The receiver should behave like an appliance. Resizing the browser window should make the whole receiver larger or smaller as a unit. Browser text zoom should not reshape individual controls. Modals should avoid scrolling unless explicitly designed for it.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.module.css`

Recommended fix approach: Centralize receiver layout around one fixed internal canvas and one scale transform. Treat modal row counts as measured layout, not fixed item counts. Add screenshot checks at normal, narrow, tall, and browser-zoomed states.

### Personal and Admin Are Still Too Entangled

Severity: Critical

Area: Personal / Admin separation

Current behavior: A standalone Admin route exists, but `CarePlandPers.tsx` still imports and coordinates many Admin components and runtime props. This keeps Admin concepts near Personal and increases the risk of Admin controls leaking into non-admin surfaces.

Expected behavior: Admin should live behind the Admin route/workspace. Personal should not own Admin runtime state. Shared components such as the top nav can be reused, but Admin data and UI should not be controlled by the Personal page.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/CarePlandPers.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/admin/AdminRoot.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/admin/page.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/admin/AdminWorkspace.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/shared/CarePlandTopNav.tsx`

Recommended fix approach: Move Admin runtime ownership into `/admin`, keep role-gated shared navigation, and leave Personal focused on appointments, profile, and Personal Ask context.

## Important Issues

### Shared Top Navigation Uses Competing Route Models

Severity: Important

Area: Shared navigation

Current behavior: The shared nav mixes real routes such as `/connect/dashboard` with Personal query-string routes such as `/?personal=1&ask=1`. It also has special handling for those Personal URLs.

Expected behavior: The top nav should use a module-aware route map with stable active states and role visibility. Ask/Profile should not default to Personal-only destinations when rendered in Connect.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/shared/CarePlandTopNav.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/CarePlandPers.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/connect/page.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/connect/dashboard/page.tsx`

Recommended fix approach: Create a single route contract for shared nav callers. Pass module-specific Ask behavior through context rather than hard-coded Personal query URLs.

### Connect Settings Mix Product Setup, Admin, and Diagnostics

Severity: Important

Area: Connect Settings

Current behavior: Settings includes People, Receivers, Appearance, provisioning details, local receiver server diagnostics, prototype endpoint routing, audio diagnostics, and care-circle context. Some items are useful but too administrative or technical for ordinary Connect users.

Expected behavior: User-facing Connect settings should remain simple and low-jargon. Deeper provisioning, endpoint routing, and diagnostic controls should move to Admin or be clearly hidden as advanced admin tools.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/docs/reference/connect-prototype/app.js`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/docs/reference/connect-prototype/docs/connect-provisioning.md`

Recommended fix approach: Keep Settings for Receiver, Appearance, and simple Connect setup. Move Household / Receiver People management toward Admin. Keep Approved Callers documented as a future feature rather than a visible MVP concept.

### Dashboard Message History Detail View Is Still Regressed

Severity: Important

Area: Connect Dashboard / Message History

Current behavior: The current detail view is more compact and less informative than the old prototype. It has shown one-card layouts, reduced metadata, and navigation behavior that can appear inconsistent.

Expected behavior: Message history should support richer detail cards, two-across layout when space allows, clear sender/recipient/read/sent/transcript metadata, and visible nav arrows that become disabled rather than disappearing.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/lib/connect/messaging/types.ts`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/docs/reference/connect-prototype/app.js`

Recommended fix approach: Restore the old message detail presentation against the current message record type. Keep navigation controls visible and disabled when unavailable.

### Receiver All Messages Pagination Needs a Stable Rule

Severity: Important

Area: Connect Receiver / All Messages

Current behavior: All Messages has improved, but pagination can under-fill pages or over-split messages depending on text size and line wrapping.

Expected behavior: Show two-line message summaries, page based on total rendered line budget, keep nav arrows visible with disabled states, and open the same message reader when a summary is selected. If opened from All Messages, the reader should say "Go Back."

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.module.css`

Recommended fix approach: Base pagination on measured or conservatively estimated total row height, not a fixed number of messages. Preserve the message reader as the single detailed reading surface.

### Receiver Modal Exit Labels Need One Rule

Severity: Important

Area: Connect Receiver modals

Current behavior: Exit labels have varied between "Go Back," "Go Home," and "Exit this." Some nested flows need a true back action, while top-level modals should return home.

Expected behavior: Top-level receiver modals use "Go Home." Nested flows opened from a list or prior modal use "Go Back." This applies to Read, Ask, Ask Andrew, Optional Sounds, Record, and appointment followups.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.tsx`

Recommended fix approach: Store modal origin and render exit labels through a small helper. Avoid one-off label strings inside individual modal branches.

### Appearance Settings Are Closer, But Need Final Parity

Severity: Important

Area: Connect Settings / Appearance

Current behavior: Theme selection and preview behavior have been partially restored. Earlier regressions included extra advanced color controls, box-in-box layout, and reduced theme choices.

Expected behavior: Appearance should be select-only for MVP: Preset Theme first, Visual Skin second, preview reflecting chosen colors/layout, and no advanced color programming.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/docs/reference/connect-prototype/shared/connect-theme-service.js`

Recommended fix approach: Treat the prototype theme service as the source of theme names and preview tokens. Keep the merged settings page, but simplify the user-facing layout.

### Receiver Preview Can Drift From Real Receiver

Severity: Important

Area: Connect Dashboard / Receiver preview

Current behavior: Dashboard preview and real receiver are separate surfaces. They have already drifted during consolidation and restoration.

Expected behavior: The preview does not have to reuse the exact receiver component, but it must match the receiver's interaction map, target IDs, and core visual structure for Guide Mode and troubleshooting.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.tsx`

Recommended fix approach: Share the receiver action model and guide target registry. Allow styling differences only when they do not affect behavior or target mapping.

### Product UI Still Exposes Prototype or Debug Language

Severity: Important

Area: Connect / Ask / Settings

Current behavior: Some strings still expose implementation concepts such as prototype routing, phase draft labels, transcript statuses like `not requested`, internal sender labels, or local server details.

Expected behavior: Product UI should be simple and human. Debug language belongs in Admin, diagnostics, or explicitly advanced sections.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/api/ask/route.ts`

Recommended fix approach: Add a product-label mapping layer for internal values. Move local/prototype diagnostics behind Admin or advanced diagnostics.

### Admin Visibility and Navigation Spacing Need Verification

Severity: Important

Area: Shared navigation / Admin

Current behavior: The shared nav has a `canShowAdmin` prop, but earlier screenshots showed Admin visible in places where it should not be. Nav spacing can also shift depending on Dev / Early Access / Admin chip visibility.

Expected behavior: Admin is hidden for non-admin users. The top nav remains stable whether optional chips are present or not.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/shared/CarePlandTopNav.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/CarePlandPers.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/connect/dashboard/page.tsx`

Recommended fix approach: Verify every caller passes role flags consistently. Add nav snapshots for admin and non-admin states.

## Polish / Consistency Issues

### Button and Pill Styles Vary Across Modules

Severity: Minor

Area: Shared UI / Connect / Personal / Admin

Current behavior: Receiver physical buttons intentionally have a distinct appliance style, but dashboard, settings, Personal, and Admin pills/buttons vary in density, padding, active state, and disabled state.

Expected behavior: Receiver can remain a separate appliance language. All app/dashboard/admin surfaces should share a quieter operational style.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/shared/CarePlandTopNav.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/CarePlandPers.tsx`

Recommended fix approach: Define a small shared set of pill/button classes for app surfaces while leaving receiver CSS isolated.

### Disabled Navigation Should Not Disappear

Severity: Minor

Area: Receiver / Dashboard message navigation

Current behavior: Some navigation controls have disappeared when inactive.

Expected behavior: Keep Previous/Next visible and greyed out when inactive to avoid disorientation.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`

Recommended fix approach: Use disabled styles rather than conditional rendering for navigation buttons.

### Older-Eye Typography Needs Consistent Application

Severity: Minor

Area: Receiver / Connect Dashboard

Current behavior: Several receiver labels have been enlarged, but small text still appears in subsidiary status labels, modal action buttons, and some settings cards.

Expected behavior: Receiver text should favor older-eye readability. Dashboard/settings text can be denser but should avoid tiny metadata when it is user-facing.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.module.css`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`

Recommended fix approach: Keep receiver typography tokenized by role: primary, secondary, button, modal body, metadata.

### Connect Settings Still Has Box-In-Box Density

Severity: Minor

Area: Connect Settings

Current behavior: Some settings sections still use nested boxes and compact diagnostic cards.

Expected behavior: Product settings should feel organized but not like a diagnostic console. Deep diagnostic cards are acceptable only in Admin/advanced areas.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`

Recommended fix approach: Keep main setting groups unboxed where possible; use cards only for repeated records or true framed tools.

### Ready Indicator Alignment Is Finicky

Severity: Minor

Area: Connect Dashboard / Voice panel

Current behavior: The Ready dot, Ready label, receiver name, and Reset button have been difficult to align, especially with longer receiver names.

Expected behavior: The Ready text aligns visually with Reset, the dot anchors to the receiver label column, and longer receiver names wrap or travel under Reset without truncating awkwardly.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`

Recommended fix approach: Make the status row a fixed grid with dot, text block, and reset button columns.

## Known Technical Debt

### Large Multi-Responsibility Components

Severity: Important

Area: Architecture

Current behavior: `CarePlandPers.tsx` and `ConnectDashboard.tsx` each own many domains: navigation, state, product UI, settings, diagnostics, Admin or provisioning behavior, Ask context, and local prototype state.

Expected behavior: The merged architecture can remain, but each module should delegate to focused components and context builders.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/CarePlandPers.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`

Recommended fix approach: Extract behavior by product surface, not by generic abstraction: Ask context, message history, receiver setup, appearance, guide mode, and admin runtime.

### Prototype Reference Files Are Valuable But Heavy

Severity: Minor

Area: Repository / documentation

Current behavior: The reference prototype directory includes code, assets, local server files, uploads, and local server dependencies. It is useful for restoration, but it can pollute search output and confuse build/debug work.

Expected behavior: Reference material should remain available but clearly excluded from app build and routine code searches.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/docs/reference/connect-prototype`

Recommended fix approach: Keep the reference directory, add a short README note about restoration-only usage, and consider excluding heavy generated/dependency folders from normal tooling.

### State Is Split Across Several Stores

Severity: Important

Area: App state / prototype integration

Current behavior: Connect state spans local component state, localStorage, prototype server JSON, local trigger server endpoints, and app API routes.

Expected behavior: Runtime product state should have a clear source of truth. Prototype/local server state should be clearly marked as local development scaffolding.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/receiver/ConnectReceiver.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/api/connect`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/docs/reference/connect-prototype/local-trigger-server`

Recommended fix approach: Document dev-only state paths and gradually route production-facing state through app APIs.

### Ask Prompt Taxonomy Still Carries Personal Naming

Severity: Important

Area: Ask

Current behavior: The Ask route contains Connect detection, but prompt names and fallback framing still refer to Personal Ask.

Expected behavior: Ask should be platform-level with module-specific context.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/api/ask/route.ts`

Recommended fix approach: Rename the shared prompt taxonomy and keep module-specific context blocks for Personal, Connect, and later Admin.

### Audio Surfaces Are In Flight

Severity: Known active work

Area: Connect audio

Current behavior: Audio recording, audio profile, playback event, local proxy, and artifact review code are present and evolving.

Expected behavior: This should continue as an active implementation track and should not be treated as a regression in this audit.

Likely files:

- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/lib/connect/audio`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/app/components/connect/dashboard/ConnectDashboard.tsx`
- `/Users/agoodloe/Documents/Codex/CarePland/APP_CODE/carepland-all/docs/reference/connect-prototype/shared/audio-*`

Recommended fix approach: Keep audio work separate from this audit's fix queue except where a UI button appears available but has no feedback.

## Recommended Fix Order

1. Stabilize shared navigation and shared Ask.
   - Make Ask open reliably from Connect.
   - Pass module-aware Connect context.
   - Remove Personal-specific defaults from shared nav.

2. Lock the receiver appliance shell.
   - Prevent browser zoom from distorting internal layout.
   - Stabilize modal pagination and message summaries.
   - Keep nav arrows visible and disabled rather than disappearing.

3. Restore Guide Mode as a real cross-device loop.
   - Shared target IDs.
   - Dashboard preview and receiver highlight parity.
   - Receiver click acknowledgement and wrong-target feedback.

4. Finish Connect message surfaces.
   - Dashboard message history/detail parity.
   - Receiver All Messages summary-to-reader flow.
   - Modal origin labels: Go Home vs Go Back.

5. Normalize Connect Settings.
   - Remove Approved Callers from MVP UI and document as future.
   - Move admin/provisioning concepts toward Admin.
   - Keep Appearance select-only and theme-preview driven.

6. Continue Admin / Personal separation.
   - Move Admin runtime ownership out of Personal.
   - Verify Admin visibility for non-admin users.

7. Sweep product language and visual consistency.
   - Replace prototype/debug labels in product UI.
   - Align app-surface buttons/pills.
   - Keep receiver's appliance language distinct and consistent.

