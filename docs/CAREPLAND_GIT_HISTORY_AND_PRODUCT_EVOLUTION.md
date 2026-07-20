# CarePland Git History and Product Evolution

Last reviewed: 2026-07-19  
Repository path reviewed: `/Users/agoodloe/Projects/CarePland/carepland-cowork`  
Current branch reviewed: `cowork-main` at `882fcea0` (`2026-07-18`, `chore: refresh build metadata`)

## Scope and Branch Notes

This report summarizes the complete available Git history from the first commit through the current branch. It is written for a senior engineering AI that can inspect the current codebase but cannot inspect Git history.

Important branch context:

- The earliest available commit is `69e6857c` on `2026-05-17` (`Initial CarePland app`).
- The current branch, `cowork-main`, has 315 commits through `882fcea0` on `2026-07-18`.
- The original local `main` branch is different from the current branch. Its tip is `fd603ccf` on `2026-07-01` (`chore: update build metadata`) and it has 219 commits.
- `cowork-main` diverges after local `main` at the same merge base, `fd603ccf`. In practice, the current branch continues the Connect/AI/platform evolution past the original `main`.
- `origin/main` is older than local `main`, stopping at `5d4845bd` on `2026-06-11` (`Refine home and health focus UX`).
- `cowork-main` matches the local milestone line named `milestone/connect-evolution` at the same HEAD.

Evidence used here comes from commit messages, dates, branch relationships, and representative file-level change stats. Where the report infers product motivation or architectural intent, those statements are labeled as interpretation.

## Executive Narrative

CarePland began as a focused appointment memory and preparation app: store appointments, attach notes, generate CarePrep, and help a user bring better context to care visits. Within two days, it gained account setup, Care VIPs, note versioning, AI-assisted intake, admin-editable AI instructions, and beta gating. The earliest product center was "help me prepare for and remember appointments."

From late May into early June, the app shifted from feature accumulation toward a more coherent patient-facing surface: onboarding, trust copy, support/admin workflows, dynamic app content, profile modularization, Ask support, and Health Focus. This period shows repeated UX stabilization and an explicit attempt to make the app calmer and more understandable.

In late June and July, the project became a broader care platform. The codebase was modularized, Connect was introduced as a major surface, receiver devices and calls appeared, Import Anything expanded, and data model work moved toward participants, providers, calls, receivers, recommendations, tracks, messages, and observation records. By early July, development intensity shifted heavily toward making CarePland work across people, devices, messages, receiver screens, and AI-mediated care context.

The biggest architectural turning point is the July sequence where direct AI functions are reframed into a layered CarePland AI platform: consumer care knowledge, decision traces, interaction observations, message condensation, receiver Ask/Talk interpretation, and checkpoint/offline workflows. The history shows a move from "AI generates or interprets this one thing" toward "AI work is observable, auditable, scoped, and composed through platform services."

## Phase 1: Appointment Memory MVP

Approximate range: `2026-05-17`

Representative evidence:

- `69e6857c` (`2026-05-17`) initialized the CarePland app.
- `5a64bf77` connected the home page to Supabase appointments.
- `8d427b74` added manual appointment creation.
- `9daa4169` added manual appointment notes.
- `c3c15403` added versioned note editing.
- `2e0765b7` and `c8be6fff` added appointment editing, archiving, restore, and undo.
- `0e68a7b7` added care subject appointment filtering.
- `454c206a` added Care VIP creation with plan limits.

User-facing features introduced:

- Appointment dashboard connected to Supabase.
- Manual appointment creation and editing.
- Appointment notes, including versioning.
- Archive, restore, undo, and read-only archived appointment behavior.
- Care subject filtering.
- Early Care VIP creation and entitlement display.

Architectural and data-model changes:

- Supabase became the persistence layer very early, beginning with appointments.
- Notes were treated as versioned records rather than ephemeral text.
- The care-subject/Care VIP concept appeared on day one, establishing that the app was not only about a single user's calendar.

Stabilization, migration, and cleanup:

- Supabase error details were surfaced early (`339727b0`), suggesting setup and runtime visibility mattered from the start.
- Appointment archive behavior was refined across several commits, including read-only archived appointments and moving archive to card actions.

Replaced or rethought capabilities:

- Interpretation: early appointment management moved quickly from simple list CRUD to lifecycle-aware records: notes, versions, archive state, restore state, and care-subject scoping.

## Phase 2: CarePrep, Intake AI, Account Setup, and Onboarding Burst

Approximate range: `2026-05-18`

Representative evidence:

- `ae1251f6` added local CarePrep generation.
- `9f50ed4b` added an AI instruction admin editor.
- `9aeb16bb` added AI instruction version history.
- `e872ddf6` tracked CarePrep instruction metadata.
- `f1dfc0ef` wired AI CarePrep generation.
- `4edacfdf` added a CarePrep draft review workflow.
- `640346d2` added paste text intake.
- `192892b4` separated intake AI from accepted interpretations.
- `6c50024a` preserved AI intake notes as a note version.
- `00373602` suggested appointment matches for text intake.
- `33766d3e` added a profile onboarding gate.
- `ecab851a` added signup and auth recovery.
- `6ff9bce0`, `07080dc2`, `8f09ec3b`, and `9acd6ef9` refined onboarding requirements.
- `a1f14ec3` added an AI workflow selector for intake prompts.

User-facing features introduced:

- CarePrep generation for upcoming appointments.
- CarePrep draft review and editing.
- Pasted-text intake that can extract appointment and note context.
- Suggested matches between pasted text and existing appointments.
- Account signup, auth recovery, password validation, and onboarding profile gates.
- Profile tab and appointment workspace toolbar.

Architectural and data-model changes:

- AI instruction management became admin-editable and versioned almost immediately.
- CarePrep output was no longer just generated text; it carried instruction metadata and historical versions.
- Intake was deliberately split between raw AI interpretation and user-accepted interpretation.
- AI-generated intake notes were preserved as note versions, tying AI output into the existing audit/history model.

Stabilization, migration, and cleanup:

- Signup, password recovery, auth redirects, verified email display, timezone selection, ZIP validation, and display-name requirements were repeatedly tightened on the same day.
- CarePrep status and generation boundaries were refined, including limiting generation to upcoming appointments.

Replaced or rethought capabilities:

- Interpretation: CarePrep moved from local generation (`ae1251f6`) to admin-governed AI workflows (`9f50ed4b`, `9aeb16bb`, `f1dfc0ef`).
- Interpretation: intake AI was consciously made reviewable rather than automatically authoritative (`192892b4`, `6c50024a`).

## Phase 3: Beta Operations, Admin Tools, Support, Dynamic Content, and Public Presence

Approximate range: `2026-05-19` to `2026-05-24`

Representative evidence:

- `f898ea7d` added bulk appointment quick intake.
- `fd7f0dbd` and `bfdcee38` added image/OCR intake support.
- `dc819cfa` added a beta agreement gate.
- `b6d83857`, `dee45b6e`, and `9e0fb41b` added sample data seeding and cleanup.
- `648e7946` added versioned dynamic app content.
- `77426480`, `533f3e34`, and `d83f134b` added product management admin entries and backlog.
- `e9a39138` added in-app support questions.
- `e46fd76a` added an admin ticket queue and header counter.
- `1b5893c5`, `aad2775d`, `68d2c85e`, and `6be67799` added support assistant review and filtered QA analysis.
- `334c5fc7` added calendar file appointment import.
- `6d7536e6` added favorite location lookup.
- `1942ec33` added AI agent knowledge admin.
- `25d39eac` added a simple home dashboard.
- `804d8036` calmed the appointments page and added stable project context.
- `2dd2fb9c` added the public site and early access intake.
- `ed2191a7` routed the app subdomain to sign in.
- `08b64f1b` added Early Access assignment utilities.
- `11a84206` added a public trust statement.
- `b9c77df9` added configurable session idle timeout.
- `c14fe1f7` modularized admin panels.

User-facing features introduced:

- Bulk quick intake for appointments.
- OCR/image intake for appointment notes and multiple images.
- Beta welcome, beta agreement, support links, and support ticket flow.
- Calendar file appointment import.
- Favorite location lookup.
- Home dashboard.
- Public site, Early Access intake, trust statement, auth confirmation messaging, and production auth redirects.

Architectural and data-model changes:

- Dynamic content became versioned and admin-managed.
- Product management, support tickets, assistant answer reviews, admin user activity, integration error rollups, and admin content tooling created an operational back office.
- Sample data moved from ad hoc local testing into seeding and cleanup scripts.
- Stable project context documentation was added, which is a meta-architecture decision: future implementation should preserve explicit product assumptions.

Stabilization, migration, and cleanup:

- Authentication redirect behavior was refined repeatedly on `2026-05-24` (`87988923`, `a7cb444a`, `c4c2cf3f`, `9822ccf5`).
- UI polish was heavy: branding, header navigation, button grouping, responsive shell alignment, appointment cards, and beta copy.
- Demo data labeling and cleanup were added to prevent test data from contaminating the user experience.

Replaced or rethought capabilities:

- Interpretation: the project began moving from "app features" to "operated product." Admin review, support queues, dynamic content, trust statement, and early-access assignment all indicate a shift toward real users and managed rollout.
- Interpretation: the public site and app subdomain split made CarePland two surfaces: public acquisition/trust and authenticated product.

## Phase 4: Patient-Facing Stabilization, Profile Modularization, Ask, and Health Focus

Approximate range: `2026-05-25` to `2026-06-11`

Representative evidence:

- `9c0b78db` added the Ask support UX foundation.
- `617bff90` documented patient-facing UX philosophy.
- `5d286254` configured the onboarding assistant and welcome flow.
- `03e78ef6` refined patient-facing appointment UI.
- `56f7f49c` standardized patient-facing editor state.
- `aace6e9a` improved appointment hydration performance.
- `1ebd4ed9` modularized profile page sections.
- `43e2d58e` standardized profile and unsaved-change policies.
- `27c06d6f` added trust policy tests and a shared profile setup form.
- `8007601a` extracted onboarding and welcome guide components.
- `e026207d` added server route helpers and a Health Focus plan.
- `ea443754` stabilized draft and admin shell boundaries.
- `827c4656` built the Health Focus story foundation.
- `d10111e0` aggregated Health Focus topics across Care VIPs.
- `c46307e0` added context-aware Health Focus questions.
- `c5e28176` refined home context Ask interpretation.
- `5d4845bd` refined home and Health Focus UX. This is also the `origin/main` tip.

User-facing features introduced:

- Ask support UX.
- Onboarding assistant and first-time welcome.
- More polished appointment UI.
- Health Focus story and questions.
- Aggregated Health Focus topics across Care VIPs.

Architectural and data-model changes:

- Profile page sections and onboarding/welcome guides were extracted into components.
- Editor state and unsaved-change policies were standardized.
- Server route helpers appeared, suggesting more shared backend route structure.
- Health Focus introduced a user-facing concept that aggregates across care subjects rather than staying appointment-only.

Stabilization, migration, and cleanup:

- Significant UX calming and polish continued.
- Hydration performance and draft/admin boundaries were stabilized.
- Trust policy tests were added, signaling a move from copy/policy ideas into testable behavior.

Replaced or rethought capabilities:

- Interpretation: this phase broadened the product from appointment preparation to continuing care context. Health Focus became a way to organize ongoing concerns across people and appointments.

## Phase 5: Modular App Surfaces, Import Anything, Connect Foundations, and Android Receiver

Approximate range: `2026-06-22` to `2026-06-27`

Representative evidence:

- `e0fb6d8a` organized personal shared modules.
- `f1136e88` added modular app surfaces. This was a very large change: 214 files changed, roughly 53,584 insertions and 20,139 deletions.
- `6deb333b` added modularization and Connect references. This was another large documentation burst: 53 files and roughly 26,595 insertions.
- `21f6f59b` added Connect participant migrations.
- `b1b49369` expanded the Import Anything workflow: 39 files and roughly 7,075 insertions.
- `51611475` added personal provider support.
- `0d949472` added Connect call storage migrations.
- `7501dc4c` added Connect call infrastructure.
- `f9a68a4a` wired Connect receiver live calls.
- `9ec48a3f` added the Connect receiver Android shell.
- `9e9d746b` updated Connect receiver handoff context.

User-facing features introduced:

- A more modular app layout with distinct personal/family/connect/admin-oriented surfaces.
- Expanded Import Anything workflow.
- Personal provider support.
- Connect calls and receiver live-call behavior.
- Android shell for a Connect receiver.

Architectural and data-model changes:

- Modular surfaces replaced a more monolithic app structure.
- Connect participants became first-class data-model entities.
- Connect calls gained storage migrations and infrastructure.
- Receiver behavior expanded beyond web UI into an Android shell.
- Provider support moved into the personal domain model.

Stabilization, migration, and cleanup:

- The history suggests heavy reorganization rather than only additive feature work.
- Connect documentation and handoff context were created alongside implementation, likely to keep the rapidly expanding system explainable.

Replaced or rethought capabilities:

- Interpretation: this is the clearest shift from isolated appointment/profile/admin features toward a coherent multi-surface platform.
- Interpretation: Connect created a new product direction: CarePland as a household/care coordination layer, not only a personal preparation tool.

## Phase 6: Track, Recommendations, Receiver Provisioning, and Focus Foundations

Approximate range: `2026-07-01` to `2026-07-03`

Representative evidence:

- `ccc63399` added receiver and focus foundations.
- `7378e6e1` added track and recommendation foundations.
- `bccbe759` added receiver shell provisioning flow.
- `c1a9a6ec` refined receiver calls and Focus UI.
- `5ff8d5bb` updated receiver, track, and recommendations context.
- `fd603ccf` is the local `main` tip and merge base for the current branch.
- `b27d5a86` created a checkpoint for CarePland Connect and household care evolution: 63 files and roughly 9,120 insertions.
- `183d0073` fixed a typed structured payload issue in `snoozeReturn`.

User-facing features introduced:

- Receiver provisioning flow.
- Track and recommendation foundations.
- Focus UI refinements.
- Household care evolution checkpoint.

Architectural and data-model changes:

- Recommendation, focus, receiver, and track foundations suggest the model became more eventful and longitudinal.
- The branch point matters: after `fd603ccf`, the current branch continues an evolution not present on original local `main`.
- The `snoozeReturn` type fix indicates structured payloads were becoming important enough to enforce at the type level.

Stabilization, migration, and cleanup:

- Build metadata updates surround major platform checkpoints.
- Documentation updates accompany new foundations.

Replaced or rethought capabilities:

- Interpretation: "Track" and "Recommendations" turn CarePland from a record-and-prepare app into a system that can notice, prioritize, suggest, and revisit care work over time.

## Phase 7: From Direct AI Features to the Layered CarePland AI Platform

Approximate range: `2026-07-04`

Representative evidence:

- `93a41212` expanded consumer care knowledge concepts.
- `e505e164` added Talk decision traces.
- `ee107cc1` added the AI platform architecture draft.
- `fc7b8a56` added the AI Platform Consolidation v1 foundation.

User-facing features introduced:

- The commits in this phase are more architectural than directly visual, but they support Talk, care knowledge, and future AI-mediated interactions.

Architectural and data-model changes:

- Consumer Care Knowledge became an explicit concept.
- Talk decisions gained traceability.
- AI platform architecture was documented and consolidated.
- Current code after this phase includes `app/lib/platform/ai/*` services such as contracts, CCKL, HKL, knowledge resolution, interaction attempts, interaction family classification, observation pipeline, message condensation, receiver Ask/Talk interpreters, responses, talk adapters, and trace composition.

Stabilization, migration, and cleanup:

- AI work moved into platform-level modules and tests rather than being scattered only inside feature components or endpoints.

Replaced or rethought capabilities:

- Evidence: early AI appeared as CarePrep generation, intake interpretation, support assistant answers, and Health Focus Ask interpretation (`2026-05-18` through `2026-06-09`).
- Interpretation: this phase reframed AI from direct task automation into layered services with contracts, traces, knowledge layers, and interpretation pipelines.

## Phase 8: Receiver Production Hardening, Classic WebView, Live Calls, and Durable Messages

Approximate range: `2026-07-05` to `2026-07-08`

Representative evidence:

- `fda7cbd4` hardened receiver pairing and device auth.
- `22ee394d` required a release APK URL in production setup.
- `2a1c1371` bundled a demo receiver APK for setup.
- `fcc85950` added a receiver setup modal to Connect.
- `00d92152` routed Android 7 receivers to a legacy UI.
- `de72085a` documented receiver renderer separation.
- `43ddc228` made Classic WebView receiver data-backed.
- `a21cb48a` redeemed receiver pairing before WebView launch.
- `1bd4b8c9` added a receiver runtime contract.
- `6aab1c2d` added a receiver UI schema registry.
- `6f9efbd9` wired Classic receiver to UI schema.
- `0e1ba411` integrated browser receiver pairing flow.
- `6a14cef3` detected GXV receiver layout from browser hints.
- `0acc002e` added receiver layout chooser.
- `a58382c7`, `6479120b`, `c0caaf8a`, `13459efa`, and `b2a32b99` made Classic receiver controls, Talk, lists, call closing, and guide support functional.
- `c830be4c`, `c03dce36`, `adafd897`, and `eac771ad` hardened incoming calls, polling auth, setup recovery, and deployed fallback storage.
- `6773f228` used a handset bridge for Classic Receiver calls.
- `8111797a` retired abandoned receiver call attempts.
- `349f20c3` merged Connect call signal stores.
- `c84540c3` gated receiver calls on live audio connection.
- `dfd21111` targeted Connect calls to the selected receiver.
- `90168ee4` required real binding before Receiver home.
- `84e6099f` added server ICE config.
- `60f981ff` used Twilio ICE credentials.
- `7a3afe14` added Connect call path diagnostics.
- `70cc05a4` allowed receiver person-scoped call fallback.
- `d83c4fb8` stabilized receiver call state transitions.
- `d42b2a2d` kept receiver calls connected despite audio setup failure.
- `cd870c8d` added durable Connect message foundation.

User-facing features introduced:

- Receiver setup modal and APK setup.
- Browser receiver pairing.
- Classic WebView receiver for older Android devices.
- Functional receiver controls, Talk actions, actionable lists, guide support, incoming calls, and call answer flows.
- Selected receiver targeting.
- More durable Connect messaging.

Architectural and data-model changes:

- Receiver runtime contract and UI schema registry formalized how receiver renderers are described.
- Renderer separation created room for modern browser receiver, Classic WebView receiver, and native shell behavior.
- Calls moved toward server-backed ICE/Twilio configuration and merged signal stores.
- Person-scoped receiver call fallback appeared (`70cc05a4`), a key step away from purely device-centric behavior.
- Durable Connect message storage began replacing transient/local-only communication patterns.

Stabilization, migration, and cleanup:

- This was the most obviously intense stabilization period. July 6 alone has 36 commits, almost all around pairing, Classic receiver, routing, calls, layout, auth, fallback storage, and recovery.
- Repeated "stabilize", "harden", "fix", "keep", and "retire" commits show receiver/call behavior was being driven toward production reliability after prototype-level pieces started working.

Replaced or rethought capabilities:

- Evidence: prototype/local receiver behavior was repeatedly replaced or backed by data-backed, authenticated, paired, schema-driven behavior (`43ddc228`, `1bd4b8c9`, `6aab1c2d`, `90168ee4`).
- Interpretation: the receiver work shifted from "can a screen/device show and answer things?" to "can a specific household receiver, tied to a person and authenticated binding, reliably participate in care workflows?"

## Phase 9: Observation Pipeline, Modern Connect Messaging, and Appointment Message Prep

Approximate range: `2026-07-13`

Representative evidence:

- `621e7f57` added the interaction observation pipeline: 26 files and roughly 7,401 insertions.
- `f0f17d60` modernized Connect messaging surfaces: 37 files and roughly 17,130 insertions and 2,996 deletions.
- `ddd93b0a` added appointment message prep workflow: 33 files and roughly 6,198 insertions.

User-facing features introduced:

- Modern Connect messaging surface.
- Appointment message preparation workflow.
- Summary and feedback surfaces for personal messages and appointment communication.

Architectural and data-model changes:

- Interaction attempts and observations became explicit platform artifacts.
- Messaging gained grouping, receiver attachments, message state, Supabase-backed stores, appointment context, and feedback summaries.
- Appointment communication summaries became a new layer between raw messages and care preparation.

Stabilization, migration, and cleanup:

- The large deletion count in `f0f17d60` indicates more than feature addition; it likely replaced earlier Connect messaging structures with modernized surfaces.
- New tests appear around messaging stores, message state, appointment context, observation pipeline, and summary feedback.

Replaced or rethought capabilities:

- Interpretation: Connect messaging became an observable, care-context-aware workflow rather than a simple message feed.
- Interpretation: appointment preparation expanded from "generate CarePrep from notes" to "prepare communication around appointments based on messages, summaries, and feedback."

## Phase 10: Receiver Setup Overlay, Personal Setup Refresh, and Account Scope Maintenance

Approximate range: `2026-07-15`

Representative evidence:

- `58fbb6b8` added a receiver setup overlay: 43 files and roughly 5,050 insertions.
- `af2b92df` refreshed personal setup flow.
- `872eb3fc` added account scope maintenance scripts.

User-facing features introduced:

- Multi-step receiver setup overlay.
- Refreshed personal setup/onboarding flow.
- Address autocomplete and offline access profile surfaces appear in the current diff from local `main`.

Architectural and data-model changes:

- Receiver setup was decomposed into explicit overlay steps: start, user/person choice, contact, install, pair, test, finish, status, QR card, footer navigation, and advanced Android setup.
- Account scope maintenance scripts suggest household/person/account relationships needed active repair and auditing.

Stabilization, migration, and cleanup:

- Account-scope SQL scripts included audit, repair, reset test accounts, and admin transfer work around `2026-07-15` to `2026-07-16`.
- The receiver setup flow moved from modal/route pieces into a structured overlay, indicating UX and supportability pressure.

Replaced or rethought capabilities:

- Interpretation: setup moved from an engineering-oriented provisioning flow toward a guided supportable workflow for real users/devices.

## Phase 11: Checkpoint, Offline Access, Help Diagnostics, Message Delivery, Admin Priorities, and Receiver Support

Approximate range: `2026-07-17` to `2026-07-18`

Representative evidence:

- `a5e85c6b` added checkpoint and offline access workflows: 50 files and roughly 7,334 insertions.
- `772e6790` refined receiver pairing and modern presentation.
- `b97d67fe` added help diagnostics reporting: 26 files and roughly 4,601 insertions.
- `f0227aa8` strengthened Connect message delivery.
- `f67ef037` added admin priorities and receiver support tools: 44 files and roughly 7,011 insertions.
- `882fcea0` refreshed build metadata and is the current HEAD.

User-facing features introduced:

- Offline access workflows.
- Checkpoint workflows for care preparation and health story continuity.
- Help diagnostics reporting and a "Something went wrong" runtime path.
- Stronger Connect message delivery.
- Admin priorities and receiver support tools.

Architectural and data-model changes:

- Checkpoint services and SQL grants make certain AI/care-prep outputs more durable and reviewable.
- Offline authorization and offline access modules were added.
- Help diagnostics and reports became first-class platform/admin concepts.
- Admin priorities added an operational triage layer.

Stabilization, migration, and cleanup:

- This phase is explicitly reliability-oriented: offline behavior, diagnostics, admin review, message delivery hardening, and receiver support.
- The implementation includes tests for checkpoint CarePrep, admin priorities, help reports, session validity, offline/receiver caches, and call/messaging scoping.

Replaced or rethought capabilities:

- Interpretation: this is the strongest evidence of movement from prototype behavior toward production-minded reliability and auditability. Failures, offline states, diagnostics, admin attention, and delivery state are now product surfaces rather than hidden engineering concerns.

## Major Turning Points

### Isolated Features to Coherent Platform

Evidence:

- The first day was appointment CRUD, notes, archive, and Care VIP filtering (`69e6857c` through `454c206a`, `2026-05-17`).
- Admin content, support, product management, dynamic content, and sample-data tooling appeared by `2026-05-20` to `2026-05-24` (`77426480`, `e9a39138`, `e46fd76a`, `648e7946`, `2dd2fb9c`).
- Modular app surfaces landed on `2026-06-22` (`f1136e88`) with a large cross-codebase change.
- Connect participant migrations (`21f6f59b`) and call infrastructure (`7501dc4c`) created platform-scale domains.

Interpretation:

CarePland crossed from feature set to platform in two steps. The first step was operational: admin, support, dynamic content, beta, trust, and product management. The second step was architectural: modular surfaces and Connect-specific data models.

### Device-Centric to Person-Centric Behavior

Evidence:

- Care VIPs and care-subject appointment filtering were present on day one (`0e68a7b7`, `454c206a`).
- Health Focus aggregated topics across Care VIPs (`d10111e0`, `2026-06-08`).
- Connect participant migrations arrived on `2026-06-22` (`21f6f59b`).
- Receiver and focus foundations arrived on `2026-07-01` (`ccc63399`).
- Connect calls began targeting a selected receiver (`dfd21111`, `2026-07-07`), but receiver call fallback became person-scoped (`70cc05a4`, `2026-07-08`).
- Account-scope maintenance scripts landed on `2026-07-15` (`872eb3fc`).

Interpretation:

The history does not show a pure device-centric beginning; person/care-subject concepts existed early. But Connect and receiver work initially had a strong device-pairing/device-auth focus. The important evolution is that receiver behavior became increasingly tied to people, care subjects, account scope, and household relationships rather than just to a device binding.

### Direct AI Features to Layered CarePland AI Platform

Evidence:

- Direct AI features began with CarePrep and intake (`ae1251f6`, `f1dfc0ef`, `640346d2`, `192892b4`) on `2026-05-18`.
- AI instruction admin and version history were added the same day (`9f50ed4b`, `9aeb16bb`).
- Support assistant review and QA analysis arrived `2026-05-20` to `2026-05-21` (`1b5893c5`, `aad2775d`, `68d2c85e`, `6be67799`).
- AI agent knowledge admin arrived `2026-05-21` (`1942ec33`).
- Health Focus Ask interpretation arrived by `2026-06-09` (`c46307e0`, `c5e28176`).
- AI platform architecture/consolidation landed on `2026-07-04` (`ee107cc1`, `fc7b8a56`).
- Interaction observation pipeline landed on `2026-07-13` (`621e7f57`).

Interpretation:

The project repeatedly moved AI outputs into reviewable, versioned, traceable, or observable containers. The July AI platform work formalized a pattern already emerging in May: AI should assist, but the system should keep the prompts, decisions, accepted interpretations, traces, and review workflows inspectable.

### Prototype Behavior to Production-Minded Reliability and Auditability

Evidence:

- Auth redirects, email confirmation, password recovery, onboarding gates, beta gates, and session idle timeout were repeatedly refined in May (`ecab851a`, `dc819cfa`, `87988923`, `9822ccf5`, `b9c77df9`).
- Stable project context was added on `2026-05-22` (`804d8036`).
- Receiver pairing, auth, release APK requirements, runtime contracts, UI schemas, fallback storage, and real binding checks were hardened July 5-8 (`fda7cbd4`, `22ee394d`, `1bd4b8c9`, `6aab1c2d`, `eac771ad`, `90168ee4`).
- Server ICE/Twilio credentials and call diagnostics landed on `2026-07-08` (`84e6099f`, `60f981ff`, `7a3afe14`).
- Checkpoint/offline/help diagnostics/admin priorities landed July 17-18 (`a5e85c6b`, `b97d67fe`, `f67ef037`).

Interpretation:

Reliability became a product feature. The system increasingly exposes status, diagnostics, review queues, offline state, admin attention, and delivery state instead of depending on invisible logs or optimistic UI behavior.

## Unusually Intense Development Periods and Repeated Rework

Commit density by date shows several bursts:

- `2026-05-18`: 51 commits. This was the first major expansion day: CarePrep, AI instruction admin, intake workflows, onboarding, auth, profile, and navigation.
- `2026-05-19`: 46 commits. This concentrated on bulk/image intake, beta gates, password recovery, demo data, dynamic content, branding, and admin organization.
- `2026-06-22`: fewer commits, but very large impact. `f1136e88` alone changed 214 files, while `6deb333b` added a large documentation base.
- `2026-07-06`: 36 commits. This was the receiver hardening day: pairing, Classic WebView, UI schemas, layout detection, setup recovery, controls, Talk, calls, fallback storage, and auth.
- `2026-07-13`: three large feature commits totaling tens of thousands of lines around observation, messaging, and appointment communication preparation.
- `2026-07-17` to `2026-07-18`: reliability and operations burst: offline access, checkpoint, diagnostics, message delivery, admin priorities, and receiver support.

Repeated rework areas:

- Authentication and email confirmation: multiple May commits refine redirects, recovery, confirmation messaging, profile identity, and copy.
- Intake and AI review: paste intake, appointment matching, accepted interpretations, note versions, image OCR, and workflow selectors recur across early history.
- Admin organization: admin tabs, content blocks, product management, support queues, QA review, AI knowledge, admin panels, priorities, and diagnostics recur throughout.
- Receiver pairing/calls: July 5-8 shows repeated hardening of pairing, claims, polling, answer state, selected receiver targeting, fallback, and audio cleanup.
- Messaging: durable Connect messages on July 8, then modernized messaging and appointment-context workflows on July 13, followed by strengthened delivery on July 17.

## How the Current Architecture Emerged

The current architecture is best understood as layers added in response to product pressure:

1. **Personal care memory layer**: appointments, notes, versions, archive/restore, Care VIPs, and profile setup came first.
2. **AI-assisted preparation layer**: CarePrep, intake AI, instruction admin, prompt versioning, accepted interpretations, and review workflows were added almost immediately.
3. **Operational/admin layer**: beta gates, product management, dynamic content, support tickets, assistant answer review, integration errors, sample data, and trust/session policies made the app operable.
4. **Patient-facing coherence layer**: onboarding, profile modularization, welcome guides, shared setup forms, Health Focus, and patient-facing UX philosophy made the product less like a collection of tools.
5. **Connect/receiver layer**: Connect participants, calls, receiver devices, receiver shell provisioning, Android shell, browser receiver, Classic WebView receiver, renderer contracts, UI schemas, call state, and receiver targeting made the product multi-surface and device-aware.
6. **Person/household scope layer**: care subjects, participant migrations, managed household/account-scope scripts, Health Focus across Care VIPs, person-scoped receiver fallback, and primary coordinator context moved behavior toward people and relationships rather than device IDs alone.
7. **Platform AI and observation layer**: CCKL, decision traces, interaction attempts, observation pipeline, message condensation, receiver Ask/Talk interpreters, checkpoints, and communication summaries made AI work more structured and auditable.
8. **Reliability/support layer**: offline access, help diagnostics, Something Went Wrong runtime, long-operation status, admin priorities, data health, receiver support tools, and message delivery hardening made failure handling part of the platform.

## Current-State Summary

As of `882fcea0` on `2026-07-18`, CarePland is no longer only an appointment preparation app. It is a multi-surface care coordination platform with:

- Personal care workflows: appointments, notes, profile, onboarding, Health Focus, recommendations, messages, offline access, and appointment communication prep.
- Connect workflows: receiver devices, setup overlay, pairing, calls, messaging, receiver Talk/Ask, and receiver presentation modes.
- Admin operations: support, product management, dynamic content, AI workflows, user activity, checkpoints, data health, recommendations review, help reports, priorities, and receiver support.
- Platform AI: care knowledge, decision traces, interaction observation, normalization, message condensation, receiver interpretation, and checkpoint-oriented workflows.
- Supabase-backed data evolution across appointments, participants, providers, calls, receivers, recommendations, messages, observations, offline access, checkpoints, and admin/account maintenance.

## Unresolved Evolutionary Tensions and Technical Debt Visible from History

- **Branch drift and release truth**: `origin/main`, local `main`, and `cowork-main` represent different project states. This creates a real risk that future agents or servers operate from the wrong workspace or branch.
- **Large-commit archaeology**: several major implementation bursts are huge. `f1136e88`, `f0f17d60`, `a5e85c6b`, and `f67ef037` are useful checkpoints but difficult to review surgically.
- **Receiver complexity**: modern browser receiver, Classic WebView receiver, native Android shell, layout detection, APK setup, pairing claims, fallback storage, polling, and call routing are all active concepts. This complexity appears necessary, but it is a major maintenance area.
- **Person/account/device scoping**: the history repeatedly revisits account scope, household sharing, care subjects, selected receivers, and person-scoped fallback. This area deserves continued test coverage and explicit invariants.
- **AI platform completeness**: July adds strong AI platform scaffolding, but the current codebase should be checked for which services are authoritative versus foundational/no-op/placeholders. History suggests the direction is clear, but rollout may be uneven.
- **Local/prototype fallbacks versus durable stores**: local call/message/receiver stores and Supabase-backed stores coexist in multiple areas. Future work should keep clear which fallback behavior is acceptable in production.
- **Operational UX debt**: help diagnostics, offline state, Something Went Wrong runtime, long operations, and admin priorities were added late. These should be treated as first-class flows, not only error handling.
- **Onboarding/auth sensitivity**: the earliest auth/onboarding flows saw repeated rework, and later product changes add more setup paths. Account creation, email confirmation, receiver setup, and personal setup should remain tightly tested.

## Milestone Timeline

| Date range | Milestone | Representative commits | Notes |
|---|---|---|---|
| 2026-05-17 | Appointment memory MVP | `69e6857c`, `5a64bf77`, `8d427b74`, `9daa4169`, `c3c15403`, `454c206a` | Supabase appointments, notes, versions, archive/restore, Care VIPs. |
| 2026-05-18 | CarePrep, AI intake, onboarding, auth | `ae1251f6`, `9f50ed4b`, `9aeb16bb`, `f1dfc0ef`, `640346d2`, `192892b4`, `33766d3e`, `ecab851a` | First major AI and account setup burst. |
| 2026-05-19 to 2026-05-21 | Beta/admin/support/import operations | `f898ea7d`, `fd7f0dbd`, `dc819cfa`, `648e7946`, `e9a39138`, `e46fd76a`, `334c5fc7`, `1942ec33` | OCR intake, beta gate, dynamic content, support/admin workflows, calendar import. |
| 2026-05-22 to 2026-05-24 | Public site, trust, stable context, Early Access | `804d8036`, `2dd2fb9c`, `ed2191a7`, `08b64f1b`, `11a84206`, `b9c77df9`, `c14fe1f7` | Public/product rollout and trust/session maturity. |
| 2026-05-25 to 2026-06-11 | Patient-facing stabilization and Health Focus | `9c0b78db`, `617bff90`, `5d286254`, `1ebd4ed9`, `43e2d58e`, `827c4656`, `d10111e0`, `c46307e0`, `5d4845bd` | Ask, onboarding assistant, profile modularization, Health Focus. |
| 2026-06-22 to 2026-06-27 | Modular surfaces, Import Anything, Connect calls, Android receiver | `f1136e88`, `6deb333b`, `21f6f59b`, `b1b49369`, `7501dc4c`, `f9a68a4a`, `9ec48a3f` | Coherent platform turn and first receiver infrastructure. |
| 2026-07-01 | Track/recommendations/receiver provisioning and branch point | `ccc63399`, `7378e6e1`, `bccbe759`, `c1a9a6ec`, `fd603ccf`, `b27d5a86` | Local `main` ends at `fd603ccf`; current branch continues Connect evolution. |
| 2026-07-04 | AI platform consolidation | `93a41212`, `e505e164`, `ee107cc1`, `fc7b8a56` | Consumer care knowledge, decision traces, architecture draft, consolidation foundation. |
| 2026-07-05 to 2026-07-08 | Receiver/call hardening and durable messages | `fda7cbd4`, `00d92152`, `1bd4b8c9`, `6aab1c2d`, `43ddc228`, `dfd21111`, `60f981ff`, `70cc05a4`, `cd870c8d` | Pairing, auth, Classic WebView, runtime contracts, Twilio ICE, person-scoped fallback, durable messages. |
| 2026-07-13 | Observation pipeline and modern messaging | `621e7f57`, `f0f17d60`, `ddd93b0a` | Interaction observations, modern Connect messaging, appointment message prep. |
| 2026-07-15 | Receiver setup overlay and account scope maintenance | `58fbb6b8`, `af2b92df`, `872eb3fc` | Guided setup UX and account/household repair tooling. |
| 2026-07-17 to 2026-07-18 | Offline/checkpoint/help diagnostics/admin priorities | `a5e85c6b`, `772e6790`, `b97d67fe`, `f0227aa8`, `f67ef037`, `882fcea0` | Production-minded reliability, supportability, and admin triage. |
